"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { countActiveAdmins, countUserAppointments } from "./user-queries";
import type { Role, Status } from "@/lib/supabase/types";
import { revalidatePublicSite } from "@/lib/revalidate-public-site";
import { syncProfessionalStatus } from "@/modules/professionals/services/professional-actions";

const ALL_ROLES: Role[] = ["admin", "recepcionista", "profissional", "paciente"];
const LAST_ADMIN_ERROR = "Não é possível remover o último administrador ativo do sistema.";

async function requireAdmin() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") {
    throw new Error("Acesso negado.");
  }
  return session;
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** true quando a mudança tiraria o papel/status de admin ativo de quem hoje é admin ativo. */
function removesActiveAdminAccess(
  current: { role: Role; status: Status },
  next: { role: Role; status: Status },
) {
  return current.role === "admin" && current.status === "active" && (next.role !== "admin" || next.status !== "active");
}

export interface UpdateUserInput {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  role: Role;
  status: Status;
  password?: string;
}

export async function updateUser(input: UpdateUserInput): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  if (!input.full_name.trim()) return { error: "Informe o nome completo." };
  if (!ALL_ROLES.includes(input.role)) return { error: "Tipo de usuário inválido." };
  if (input.email && !validateEmail(input.email)) return { error: "E-mail inválido." };
  if (input.password && input.password.length < 8) {
    return { error: "A senha precisa ter ao menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", input.id)
    .single();
  if (!current) return { error: "Usuário não encontrado." };

  const isSelf = input.id === session.user.id;
  if (isSelf && (input.role !== "admin" || input.status !== "active")) {
    return { error: "Você não pode remover seu próprio acesso de administrador." };
  }

  if (!isSelf && removesActiveAdminAccess(current, input)) {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) return { error: LAST_ADMIN_ERROR };
  }

  const admin = createAdminClient();

  const trimmedEmail = input.email.trim();
  const { data: authUser } = await admin.auth.admin.getUserById(input.id);
  const emailChanged = Boolean(trimmedEmail) && trimmedEmail !== authUser.user?.email;

  if (emailChanged || input.password) {
    const authUpdate: { email?: string; email_confirm?: boolean; password?: string } = {};
    if (emailChanged) {
      authUpdate.email = trimmedEmail;
      authUpdate.email_confirm = true;
    }
    if (input.password) authUpdate.password = input.password;

    const { error: authError } = await admin.auth.admin.updateUserById(input.id, authUpdate);
    if (authError) {
      const message = authError.message.includes("already been registered")
        ? "Já existe um usuário com esse e-mail."
        : "Não foi possível atualizar o acesso do usuário.";
      return { error: message };
    }
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone.trim() || null,
      role: input.role,
      status: input.status,
    })
    .eq("id", input.id);

  if (updateError) return { error: "Não foi possível salvar as alterações." };

  // professionals.status é o que controla se o profissional aparece no site
  // público (getPublicWebsiteData não olha profiles.status/role) — sem isto,
  // mudar o cargo/status por aqui (em vez da tela de Equipe) não reflete lá.
  if (current.role === "profissional" || input.role === "profissional") {
    await syncProfessionalStatus(supabase, input.id, input.role, input.status);
  }

  revalidatePublicSite();

  await logAudit({
    actorId: session.user.id,
    action: "user.updated",
    entity: "profiles",
    entityId: input.id,
    metadata: {
      role_before: current.role,
      role_after: input.role,
      status_before: current.status,
      status_after: input.status,
      email_changed: emailChanged,
      password_reset: Boolean(input.password),
    },
  });

  return { error: null };
}

export async function resetUserPassword(
  id: string,
  password: string,
): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  if (password.length < 8) return { error: "A senha precisa ter ao menos 8 caracteres." };

  const rateLimit = checkRateLimit(`reset-password:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { error: "Não foi possível redefinir a senha." };

  await logAudit({
    actorId: session.user.id,
    action: "user.password_reset",
    entity: "profiles",
    entityId: id,
  });

  return { error: null };
}

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function uploadUserAvatar(
  userId: string,
  formData: FormData,
): Promise<{ error: string | null; path?: string }> {
  const session = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Nenhum arquivo selecionado." };
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return { error: "Formato inválido. Envie PNG, JPG ou WEBP." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Arquivo muito grande. Limite de 3MB." };
  }

  const admin = createAdminClient();
  // Extensão vem do MIME já validado (ALLOWED_AVATAR_TYPES acima), não do
  // nome do arquivo — file.name é controlado pelo client.
  const extension = AVATAR_EXTENSION_BY_MIME[file.type] ?? "jpg";
  const path = `${userId}/avatar.${extension}`;

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: "Falha ao enviar a foto. Tente novamente." };

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", userId);
  if (updateError) return { error: "Foto enviada, mas houve falha ao salvar o perfil." };

  // A foto pode ser de um profissional (avatar aparece publicamente em
  // /profissionais) mesmo trocada por esta tela genérica de Usuários.
  revalidatePublicSite();

  await logAudit({
    actorId: session.user.id,
    action: "user.photo_updated",
    entity: "profiles",
    entityId: userId,
  });

  return { error: null, path };
}

export async function setUserStatus(
  id: string,
  status: Status,
): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  const isSelf = id === session.user.id;
  if (isSelf && status === "inactive") {
    return { error: "Você não pode desativar a própria conta." };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", id)
    .single();
  if (!current) return { error: "Usuário não encontrado." };

  if (!isSelf && removesActiveAdminAccess(current, { role: current.role, status })) {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) return { error: LAST_ADMIN_ERROR };
  }

  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
  if (error) return { error: "Não foi possível atualizar o status do usuário." };

  if (current.role === "profissional") {
    await syncProfessionalStatus(supabase, id, current.role, status);
  }

  revalidatePublicSite();

  await logAudit({
    actorId: session.user.id,
    action: "user.status_changed",
    entity: "profiles",
    entityId: id,
    metadata: { status },
  });

  return { error: null };
}

export async function deleteUser(id: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  if (id === session.user.id) {
    return { error: "Você não pode excluir a própria conta." };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", id)
    .single();
  if (!current) return { error: "Usuário não encontrado." };

  if (current.role === "admin" && current.status === "active") {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) return { error: LAST_ADMIN_ERROR };
  }

  const appointmentsCount = await countUserAppointments(id, current.role);
  if (appointmentsCount > 0) {
    return {
      error:
        "Este usuário possui atendimentos/histórico vinculado. Para preservar os dados, desative a conta em vez de excluí-la.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: "Não foi possível excluir este usuário." };

  revalidatePublicSite();

  await logAudit({
    actorId: session.user.id,
    action: "user.deleted",
    entity: "profiles",
    entityId: id,
    metadata: { role: current.role },
  });

  return { error: null };
}

"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Role } from "@/lib/supabase/types";
import { logAudit } from "./audit";

const TEAM_ROLES: Role[] = ["admin", "recepcionista", "profissional"];

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

interface ProfessionalInsuranceInput {
  insurance_id: string;
  value: number;
}

export interface CreateTeamMemberInput {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  role: Role;
  specialty_id?: string;
  license_number?: string;
  bio?: string;
  agenda_color?: string;
  consultation_duration_minutes?: number;
  price_particular_card?: number;
  price_particular_pix?: number;
  price_particular_cash?: number;
  insurances?: ProfessionalInsuranceInput[];
}

export async function createTeamMember(
  input: CreateTeamMemberInput,
): Promise<{ error: string | null; id?: string }> {
  const session = await requireAdmin();

  const rateLimit = checkRateLimit(`create-team:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  if (!input.full_name.trim()) return { error: "Informe o nome completo." };
  if (!validateEmail(input.email)) return { error: "E-mail inválido." };
  if (input.password.length < 8) return { error: "A senha precisa ter ao menos 8 caracteres." };
  if (!TEAM_ROLES.includes(input.role)) return { error: "Cargo inválido." };

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name.trim(), role: input.role },
  });

  if (createError) {
    const message = createError.message.includes("already been registered")
      ? "Já existe um usuário com esse e-mail."
      : "Não foi possível criar o usuário.";
    return { error: message };
  }

  const userId = created.user.id;
  const supabase = await createClient();

  if (input.phone.trim()) {
    await supabase.from("profiles").update({ phone: input.phone.trim() }).eq("id", userId);
  }

  if (input.role === "profissional") {
    await supabase.from("professionals").insert({
      id: userId,
      specialty_id: input.specialty_id || null,
      license_number: input.license_number?.trim() || null,
      bio: input.bio?.trim() || null,
      agenda_color: input.agenda_color || "#2F8F83",
      consultation_duration_minutes: input.consultation_duration_minutes || 30,
      price_particular_card: input.price_particular_card ?? null,
      price_particular_pix: input.price_particular_pix ?? null,
      price_particular_cash: input.price_particular_cash ?? null,
    });

    if (input.insurances && input.insurances.length > 0) {
      await supabase.from("professional_insurances").insert(
        input.insurances.map((insurance) => ({
          professional_id: userId,
          insurance_id: insurance.insurance_id,
          value: insurance.value,
        })),
      );
    }
  }

  await logAudit({
    actorId: session.user.id,
    action: "team_member.created",
    entity: "profiles",
    entityId: userId,
    metadata: { role: input.role, email: input.email },
  });

  return { error: null, id: userId };
}

export interface UpdateTeamMemberInput {
  id: string;
  full_name: string;
  phone: string;
  role: Role;
  status: "active" | "inactive";
  password?: string;
  specialty_id?: string;
  license_number?: string;
  bio?: string;
  agenda_color?: string;
  consultation_duration_minutes?: number;
  price_particular_card?: number;
  price_particular_pix?: number;
  price_particular_cash?: number;
  insurances?: ProfessionalInsuranceInput[];
}

export async function updateTeamMember(
  input: UpdateTeamMemberInput,
): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  if (!input.full_name.trim()) return { error: "Informe o nome completo." };
  if (!TEAM_ROLES.includes(input.role)) return { error: "Cargo inválido." };

  const isSelf = input.id === session.user.id;
  if (isSelf && (input.role !== "admin" || input.status !== "active")) {
    return { error: "Você não pode remover seu próprio acesso de administrador." };
  }

  if (input.password && input.password.length < 8) {
    return { error: "A senha precisa ter ao menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone.trim() || null,
      role: input.role,
      status: input.status,
    })
    .eq("id", input.id);

  if (updateError) {
    return { error: "Não foi possível salvar as alterações." };
  }

  if (input.role === "profissional") {
    await supabase.from("professionals").upsert({
      id: input.id,
      specialty_id: input.specialty_id || null,
      license_number: input.license_number?.trim() || null,
      bio: input.bio?.trim() || null,
      agenda_color: input.agenda_color || "#2F8F83",
      consultation_duration_minutes: input.consultation_duration_minutes || 30,
      price_particular_card: input.price_particular_card ?? null,
      price_particular_pix: input.price_particular_pix ?? null,
      price_particular_cash: input.price_particular_cash ?? null,
    });

    await supabase.from("professional_insurances").delete().eq("professional_id", input.id);
    if (input.insurances && input.insurances.length > 0) {
      await supabase.from("professional_insurances").insert(
        input.insurances.map((insurance) => ({
          professional_id: input.id,
          insurance_id: insurance.insurance_id,
          value: insurance.value,
        })),
      );
    }
  }

  const admin = createAdminClient();

  if (input.password) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(input.id, {
      password: input.password,
    });
    if (passwordError) return { error: "Dados salvos, mas houve falha ao alterar a senha." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "team_member.updated",
    entity: "profiles",
    entityId: input.id,
    metadata: { role: input.role, status: input.status },
  });

  return { error: null };
}

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

export async function uploadTeamMemberAvatar(
  memberId: string,
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
  const extension = file.name.split(".").pop() || "jpg";
  const path = `${memberId}/avatar.${extension}`;

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: "Falha ao enviar a foto. Tente novamente." };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", memberId);

  if (updateError) {
    return { error: "Foto enviada, mas houve falha ao salvar o perfil." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "team_member.photo_updated",
    entity: "profiles",
    entityId: memberId,
  });

  return { error: null, path };
}

export async function deleteTeamMember(id: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  if (id === session.user.id) {
    return { error: "Você não pode excluir a própria conta." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    return { error: "Não foi possível excluir este usuário." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "team_member.deleted",
    entity: "profiles",
    entityId: id,
  });

  return { error: null };
}

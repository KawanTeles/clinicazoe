"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Modality, Role } from "@/lib/supabase/types";
import { logAudit } from "./audit";
import { deleteUser } from "@/modules/user-management/services/user-actions";

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
  modality: Modality;
  value: number;
  duration_minutes?: number;
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
    user_metadata: { full_name: input.full_name.trim() },
    app_metadata: { role: input.role },
  });

  if (createError) {
    const message = createError.message.includes("already been registered")
      ? "Já existe um usuário com esse e-mail."
      : "Não foi possível criar o usuário.";
    return { error: message };
  }

  const userId = created.user.id;
  const supabase = await createClient();

  // GoTrue aplica o app_metadata passado ao admin.createUser() (acima) numa
  // escrita separada, depois que a trigger on_auth_user_created (AFTER
  // INSERT em auth.users) já disparou — então o profile pode nascer com o
  // role padrão ("paciente") mesmo com app_metadata.role correto salvo em
  // auth.users. Confere e corrige aqui: como quem chama esta action já é um
  // admin autenticado (supabase = client desta sessão, is_admin() = true),
  // um UPDATE direto passa pelo trigger prevent_role_self_escalation sem
  // problema — mesmo bug e mesmo diagnóstico do create-admin.mjs, mas ali a
  // correção precisou apagar e recriar o profile porque o script roda com a
  // service role (sem JWT de usuário, não passa em is_admin()).
  const { data: createdProfile, error: profileCheckError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileCheckError) {
    return { error: "Usuário criado, mas houve falha ao conferir o cargo. Edite o membro para corrigir." };
  }

  if (createdProfile.role !== input.role) {
    const { error: roleFixError } = await supabase.from("profiles").update({ role: input.role }).eq("id", userId);
    if (roleFixError) {
      return { error: "Usuário criado, mas houve falha ao definir o cargo correto. Edite o membro para corrigir." };
    }
  }

  if (input.phone.trim()) {
    const { error: phoneError } = await supabase
      .from("profiles")
      .update({ phone: input.phone.trim() })
      .eq("id", userId);
    if (phoneError) {
      return { error: "Usuário criado, mas houve falha ao salvar o telefone. Edite o membro para completar." };
    }
  }

  if (input.role === "profissional") {
    const { error: professionalError } = await supabase.from("professionals").insert({
      id: userId,
      specialty_id: input.specialty_id || null,
      license_number: input.license_number?.trim() || null,
      bio: input.bio?.trim() || null,
      agenda_color: input.agenda_color || "#2F8F83",
      consultation_duration_minutes: input.consultation_duration_minutes || 30,
    });
    if (professionalError) {
      return { error: "Usuário criado, mas houve falha ao salvar os dados profissionais. Edite o membro para completar." };
    }

    if (input.insurances && input.insurances.length > 0) {
      const { error: insurancesError } = await supabase.from("professional_insurances").insert(
        input.insurances.map((insurance) => ({
          professional_id: userId,
          insurance_id: insurance.insurance_id,
          modality: insurance.modality,
          value: insurance.value,
          duration_minutes: insurance.duration_minutes ?? null,
        })),
      );
      if (insurancesError) {
        return { error: "Usuário criado, mas houve falha ao salvar os convênios. Edite o membro para completar." };
      }
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
    });

    await supabase.from("professional_insurances").delete().eq("professional_id", input.id);
    if (input.insurances && input.insurances.length > 0) {
      await supabase.from("professional_insurances").insert(
        input.insurances.map((insurance) => ({
          professional_id: input.id,
          insurance_id: insurance.insurance_id,
          modality: insurance.modality,
          value: insurance.value,
          duration_minutes: insurance.duration_minutes ?? null,
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
  // Reaproveita a mesma política de exclusão do módulo de usuários (admin-only,
  // bloqueio do último admin ativo e bloqueio quando há consultas/histórico
  // vinculado) para não duplicar essa lógica em dois módulos.
  return deleteUser(id);
}

"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildIlikeFilterValue } from "@/lib/postgrest-filter";
import { logAudit } from "@/modules/team/services/audit";

async function requireStaff() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) {
    throw new Error("Acesso negado.");
  }
  return session;
}

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

export interface PatientDetailsInput {
  cpf?: string;
  birth_date?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  preferred_insurance_id?: string;
  insurance_card_number?: string;
  insurance_card_valid_until?: string;
  notes?: string;
  preferred_professional_id?: string;
}

export interface CreatePatientInput {
  full_name: string;
  phone: string;
  details: PatientDetailsInput;
}

function cleanDetails(details: PatientDetailsInput) {
  return {
    cpf: details.cpf?.trim() || null,
    birth_date: details.birth_date || null,
    email: details.email?.trim() || null,
    whatsapp: details.whatsapp?.trim() || null,
    address: details.address?.trim() || null,
    city: details.city?.trim() || null,
    preferred_insurance_id: details.preferred_insurance_id || null,
    insurance_card_number: details.insurance_card_number?.trim() || null,
    insurance_card_valid_until: details.insurance_card_valid_until || null,
    notes: details.notes?.trim() || null,
    preferred_professional_id: details.preferred_professional_id || null,
  };
}

export async function createPatient(
  input: CreatePatientInput,
): Promise<{ error: string | null; id?: string }> {
  const session = await requireStaff();

  const rateLimit = checkRateLimit(`create-patient:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  if (!input.full_name.trim()) return { error: "Informe o nome completo." };

  const email = input.details.email?.trim();
  if (email && !validateEmail(email)) return { error: "E-mail inválido." };

  const admin = createAdminClient();
  const loginEmail = email && email.includes("@") ? email : `paciente_${Date.now()}@clinicazoe.com.br`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginEmail,
    email_confirm: true,
    user_metadata: { full_name: input.full_name.trim() },
    app_metadata: { role: "paciente" },
  });

  if (createError) {
    const message = createError.message.includes("already been registered")
      ? "Já existe um paciente cadastrado com esse e-mail."
      : "Não foi possível cadastrar o paciente.";
    return { error: message };
  }

  const patientId = created.user.id;

  await admin
    .from("profiles")
    .update({ phone: input.phone.trim() || null })
    .eq("id", patientId);

  const { error: detailsError } = await admin.from("patient_details").insert({
    id: patientId,
    ...cleanDetails(input.details),
  });

  if (detailsError) {
    return { error: "Paciente criado, mas houve falha ao salvar os dados complementares." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "patient.created",
    entity: "profiles",
    entityId: patientId,
  });

  return { error: null, id: patientId };
}

export interface UpdatePatientInput {
  id: string;
  full_name: string;
  phone: string;
  details: PatientDetailsInput;
}

export async function updatePatient(input: UpdatePatientInput): Promise<{ error: string | null }> {
  const session = await requireStaff();

  if (!input.full_name.trim()) return { error: "Informe o nome completo." };

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ full_name: input.full_name.trim(), phone: input.phone.trim() || null })
    .eq("id", input.id)
    .eq("role", "paciente");

  if (updateError) return { error: "Não foi possível salvar as alterações." };

  const { error: detailsError } = await supabase
    .from("patient_details")
    .upsert({ id: input.id, ...cleanDetails(input.details) });

  if (detailsError) return { error: "Dados salvos, mas houve falha nos dados complementares." };

  await logAudit({
    actorId: session.user.id,
    action: "patient.updated",
    entity: "profiles",
    entityId: input.id,
  });

  return { error: null };
}

export interface PatientSearchResult {
  id: string;
  fullName: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  avatarUrl: string | null;
  city: string | null;
  preferredInsuranceId: string | null;
  preferredProfessionalId: string | null;
}

const PATIENT_LIST_LIMIT = 200;

/** Busca para o combobox de paciente do agendamento da recepção — pré-preenche
 * telefone, WhatsApp, convênio e cidade a partir do cadastro do paciente.
 * Com `query` vazia, devolve todos os pacientes ativos (ordenados por nome)
 * para abrir a lista completa assim que o campo recebe foco. */
export async function searchPatientsForBooking(query: string): Promise<PatientSearchResult[]> {
  await requireStaff();

  const search = query.trim();
  const supabase = await createClient();

  let matchingIds: string[] | null = null;

  if (search.length > 0) {
    const ilikeValue = buildIlikeFilterValue(search);
    const [{ data: byProfile }, { data: byDetails }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .eq("role", "paciente")
        .or(`full_name.ilike.${ilikeValue},phone.ilike.${ilikeValue}`),
      supabase
        .from("patient_details")
        .select("id")
        .or(`whatsapp.ilike.${ilikeValue},email.ilike.${ilikeValue}`),
    ]);

    const idSet = new Set<string>([
      ...(byProfile ?? []).map((p) => p.id),
      ...(byDetails ?? []).map((d) => d.id),
    ]);
    matchingIds = Array.from(idSet);
    if (matchingIds.length === 0) return [];
  }

  let profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, phone, avatar_path")
    .eq("role", "paciente")
    .eq("status", "active")
    .order("full_name")
    .limit(PATIENT_LIST_LIMIT);

  if (matchingIds) {
    profilesQuery = profilesQuery.in("id", matchingIds);
  }

  const { data: profiles } = await profilesQuery;
  if (!profiles || profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);
  const { data: details } = await supabase
    .from("patient_details")
    .select("id, whatsapp, email, city, preferred_insurance_id, preferred_professional_id")
    .in("id", ids);
  const detailsById = new Map((details ?? []).map((d) => [d.id, d]));

  return Promise.all(
    profiles.map(async (profile) => {
      const detail = detailsById.get(profile.id);
      return {
        id: profile.id,
        fullName: profile.full_name,
        phone: profile.phone,
        whatsapp: detail?.whatsapp ?? null,
        email: detail?.email ?? null,
        avatarUrl: await getAvatarSignedUrl(supabase, profile.avatar_path),
        city: detail?.city ?? null,
        preferredInsuranceId: detail?.preferred_insurance_id ?? null,
        preferredProfessionalId: detail?.preferred_professional_id ?? null,
      };
    }),
  );
}

export async function setPatientStatus(
  id: string,
  status: "active" | "inactive",
): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", id)
    .eq("role", "paciente");

  if (error) return { error: "Não foi possível atualizar o status do paciente." };

  await logAudit({
    actorId: session.user.id,
    action: "patient.status_updated",
    entity: "profiles",
    entityId: id,
    metadata: { status },
  });

  return { error: null };
}

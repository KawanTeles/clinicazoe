import { createClient } from "@/lib/supabase/server";

export interface ProfessionalOption {
  id: string;
  fullName: string;
}

/** Profissionais ativos, exceto o próprio — picker de "liberar anexos para". */
export async function listActiveProfessionalsExcept(excludeId: string): Promise<ProfessionalOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "profissional")
    .eq("status", "active")
    .neq("id", excludeId)
    .order("full_name");

  return (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name }));
}

/** Profissionais inativos — picker da Coordenação para escolher de QUEM
 * liberar o acesso (regra: ela só libera quando o autor está inativo). */
export async function listInactiveProfessionals(): Promise<ProfessionalOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "profissional")
    .eq("status", "inactive")
    .order("full_name");

  return (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name }));
}

export interface PatientWithAttachments {
  patientId: string;
  patientName: string;
  attachmentCount: number;
}

/** Pacientes com anexo de um autor INATIVO — via RPC (get_patients_with_
 * evolution_attachments, migração 0084), que nunca expõe o anexo em si, só
 * identificador/contagem. A autorização (is_coordinator() + autor inativo)
 * é checada DENTRO da função — se alguém sem ser Coordenação chamar, a RPC
 * simplesmente devolve erro, que vira lista vazia aqui. */
export async function getPatientsWithAttachmentsForInactiveAuthor(
  authorProfessionalId: string,
): Promise<PatientWithAttachments[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_patients_with_evolution_attachments", {
    p_author_professional_id: authorProfessionalId,
  });

  if (error || !data) return [];
  return data.map((row) => ({
    patientId: row.patient_id,
    patientName: row.patient_name,
    attachmentCount: row.attachment_count,
  }));
}

export interface AttachmentGrantView {
  id: string;
  grantedToId: string;
  grantedToName: string;
  justification: string;
  grantedAt: string;
}

/** Liberações ATIVAS de um autor para um paciente — mostra pra quem já
 * liberou o quê, com opção de revogar (ver AttachmentAccessPanel). */
export async function getActiveGrantsForAuthorPatient(
  authorProfessionalId: string,
  patientId: string,
): Promise<AttachmentGrantView[]> {
  const supabase = await createClient();
  const { data: grants } = await supabase
    .from("attachment_access_grants")
    .select("id, granted_to_professional_id, justification, granted_at")
    .eq("author_professional_id", authorProfessionalId)
    .eq("patient_id", patientId)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });

  if (!grants || grants.length === 0) return [];

  const ids = grants.map((g) => g.granted_to_professional_id);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return grants.map((g) => ({
    id: g.id,
    grantedToId: g.granted_to_professional_id,
    grantedToName: nameById.get(g.granted_to_professional_id) ?? "—",
    justification: g.justification,
    grantedAt: g.granted_at,
  }));
}

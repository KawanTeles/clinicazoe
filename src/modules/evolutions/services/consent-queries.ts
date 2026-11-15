import { createClient } from "@/lib/supabase/server";

export interface ConsentTemplateView {
  id: string;
  version: number;
  body: string;
  createdAt: string;
}

/** Modelo de termo vigente (status 'active') — nunca há mais de um (índice
 * único na migração 0084). Null quando a administração ainda não publicou
 * nenhum modelo — nesse caso não é possível colher termo nenhum. */
export async function getActiveConsentTemplate(): Promise<ConsentTemplateView | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consent_templates")
    .select("id, version, body, created_at")
    .eq("status", "active")
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, version: data.version, body: data.body, createdAt: data.created_at };
}

export interface ConsentTemplateHistoryItem {
  id: string;
  version: number;
  status: "active" | "archived";
  createdAt: string;
}

/** Histórico de versões do modelo — tela do admin, para conferir o que
 * mudou. status aqui reaproveita a coluna `status` da tabela, que só usa
 * 'active'/'archived' na prática; mapeado para o Status genérico do projeto
 * (active/inactive) só porque é o que já existe em types.ts. */
export async function getConsentTemplateHistory(): Promise<ConsentTemplateHistoryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consent_templates")
    .select("id, version, status, created_at")
    .order("version", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export interface ActiveConsentView {
  id: string;
  guardianName: string;
  guardianRelationship: string;
  signedAt: string;
}

/** Termo vigente (não revogado) de um paciente, se houver — índice único
 * (patient_id) where revoked_at is null garante que nunca há mais de um. */
export async function getActiveConsentForPatient(patientId: string): Promise<ActiveConsentView | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("image_consents")
    .select("id, guardian_name, guardian_relationship, signed_at")
    .eq("patient_id", patientId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, guardianName: data.guardian_name, guardianRelationship: data.guardian_relationship, signedAt: data.signed_at };
}

export interface ConsentHistoryItem {
  id: string;
  guardianName: string;
  guardianRelationship: string;
  signedAt: string;
  revokedAt: string | null;
}

/** Histórico completo (vigente + revogados) de um paciente — usado na ficha,
 * para mostrar que um termo antigo foi revogado sem escondê-lo (revogação
 * não apaga nada, decisão Q2). */
export async function getConsentHistoryForPatient(patientId: string): Promise<ConsentHistoryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("image_consents")
    .select("id, guardian_name, guardian_relationship, signed_at, revoked_at")
    .eq("patient_id", patientId)
    .order("signed_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    guardianName: row.guardian_name,
    guardianRelationship: row.guardian_relationship,
    signedAt: row.signed_at,
    revokedAt: row.revoked_at,
  }));
}

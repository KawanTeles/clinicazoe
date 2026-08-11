import { createClient } from "@/lib/supabase/server";

export interface ClinicalDocumentView {
  id: string;
  patientId: string;
  evolutionId: string | null;
  description: string | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

/** Documentos clínicos de um paciente, mais recente primeiro. RLS
 * (clinical_documents_select_own) já restringe ao profissional que enviou
 * cada documento — mesmo sigilo profissional de patient_evolutions/ai_reports
 * desde a Etapa 31; admin não recebe nenhuma linha aqui. */
export async function getClinicalDocumentsForPatient(patientId: string): Promise<ClinicalDocumentView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinical_documents")
    .select("id, patient_id, evolution_id, description, file_name, mime_type, file_size_bytes, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    evolutionId: row.evolution_id,
    description: row.description,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    createdAt: row.created_at,
  }));
}

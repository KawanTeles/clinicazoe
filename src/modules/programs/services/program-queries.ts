import { createClient } from "@/lib/supabase/server";
import type { TherapeuticProgramStatus } from "@/lib/supabase/types";

export interface TherapeuticProgramView {
  id: string;
  name: string;
  description: string | null;
  masteryCriteria: string | null;
  status: TherapeuticProgramStatus;
  createdAt: string;
}

/** Programas de um paciente — RLS (therapeutic_programs_select) já restringe
 * a quem está vinculado ao paciente (principal ou coterapeuta, em qualquer
 * atendimento); admin/coordenação/recepção não recebem nenhuma linha. */
export async function getTherapeuticProgramsForPatient(patientId: string): Promise<TherapeuticProgramView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("therapeutic_programs")
    .select("id, name, description, mastery_criteria, status, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    masteryCriteria: row.mastery_criteria,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export interface ProgramDataSessionView {
  id: string;
  sessionDate: string;
  independentCount: number;
  verbalPromptCount: number;
  gesturalPromptCount: number;
  physicalPromptCount: number;
  incorrectCount: number;
  notes: string | null;
  createdAt: string;
}

/** Sessões de coleta de um programa, mais antiga primeiro — ordem que o
 * gráfico de evolução (ProgramDataChart) espera. */
export async function getDataSessionsForProgram(programId: string): Promise<ProgramDataSessionView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_data_sessions")
    .select(
      "id, session_date, independent_count, verbal_prompt_count, gestural_prompt_count, physical_prompt_count, incorrect_count, notes, created_at",
    )
    .eq("program_id", programId)
    .order("session_date", { ascending: true })
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    sessionDate: row.session_date,
    independentCount: row.independent_count,
    verbalPromptCount: row.verbal_prompt_count,
    gesturalPromptCount: row.gestural_prompt_count,
    physicalPromptCount: row.physical_prompt_count,
    incorrectCount: row.incorrect_count,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

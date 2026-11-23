import { createClient } from "@/lib/supabase/server";
import type { MasteryCriteriaType, TherapeuticProgramStatus } from "@/lib/supabase/types";

export interface TherapeuticProgramView {
  id: string;
  name: string;
  description: string | null;
  masteryCriteria: string | null;
  masteryCriteriaType: MasteryCriteriaType | null;
  masteryCriteriaThreshold: number | null;
  masteryCriteriaConsecutiveSessions: number | null;
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
    .select(
      "id, name, description, mastery_criteria, mastery_criteria_type, mastery_criteria_threshold, mastery_criteria_consecutive_sessions, status, created_at",
    )
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    masteryCriteria: row.mastery_criteria,
    masteryCriteriaType: row.mastery_criteria_type,
    masteryCriteriaThreshold: row.mastery_criteria_threshold,
    masteryCriteriaConsecutiveSessions: row.mastery_criteria_consecutive_sessions,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export interface TherapeuticProgramDetail extends TherapeuticProgramView {
  patientId: string;
  professionalId: string;
}

/** Um programa específico, com patient_id/professional_id (que a listagem
 * por paciente não precisa expor) — usado pela exportação em PDF, que
 * precisa buscar nome do paciente/profissional sem já ter o patientId à
 * mão. RLS (therapeutic_programs_select) continua sendo quem decide se a
 * linha aparece. */
export async function getTherapeuticProgramById(programId: string): Promise<TherapeuticProgramDetail | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("therapeutic_programs")
    .select(
      "id, patient_id, professional_id, name, description, mastery_criteria, mastery_criteria_type, mastery_criteria_threshold, mastery_criteria_consecutive_sessions, status, created_at",
    )
    .eq("id", programId)
    .maybeSingle();

  if (!row) return null;

  return {
    id: row.id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    name: row.name,
    description: row.description,
    masteryCriteria: row.mastery_criteria,
    masteryCriteriaType: row.mastery_criteria_type,
    masteryCriteriaThreshold: row.mastery_criteria_threshold,
    masteryCriteriaConsecutiveSessions: row.mastery_criteria_consecutive_sessions,
    status: row.status,
    createdAt: row.created_at,
  };
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

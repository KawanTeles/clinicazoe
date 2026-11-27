"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { notify } from "@/modules/notifications/services/notify";
import {
  getDataSessionsForProgram,
  getTherapeuticProgramsForPatient,
  type ProgramDataSessionView,
  type TherapeuticProgramView,
} from "@/modules/programs/services/program-queries";
import { evaluateMasteryCriteria } from "@/lib/mastery-criteria";
import type { MasteryCriteriaType, TherapeuticProgramStatus } from "@/lib/supabase/types";

async function requireProfessional() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Wrapper "use server" — TherapeuticProgramManager (client component) não
 * pode importar createClient("@/lib/supabase/server") direto. */
export async function loadTherapeuticPrograms(patientId: string): Promise<TherapeuticProgramView[]> {
  const session = await getCurrentUser();
  if (!session) return [];
  return getTherapeuticProgramsForPatient(patientId);
}

export async function loadDataSessions(programId: string): Promise<ProgramDataSessionView[]> {
  const session = await getCurrentUser();
  if (!session) return [];
  return getDataSessionsForProgram(programId);
}

export interface StructuredMasteryCriteriaInput {
  type: MasteryCriteriaType;
  threshold: number;
  consecutiveSessions: number;
}

export interface CreateProgramInput {
  patientId: string;
  name: string;
  description?: string;
  masteryCriteria?: string;
  structuredCriteria?: StructuredMasteryCriteriaInput | null;
}

function validateStructuredCriteria(
  criteria: StructuredMasteryCriteriaInput | null | undefined,
): { error: string | null } {
  if (!criteria) return { error: null };
  if (!Number.isFinite(criteria.threshold) || criteria.threshold < 0) {
    return { error: "Informe um valor numérico válido para o critério." };
  }
  if (criteria.type === "percentage_independent" && criteria.threshold > 100) {
    return { error: "Percentual do critério não pode passar de 100." };
  }
  if (!Number.isInteger(criteria.consecutiveSessions) || criteria.consecutiveSessions < 1) {
    return { error: "Número de sessões consecutivas precisa ser um inteiro de 1 ou mais." };
  }
  return { error: null };
}

export async function createTherapeuticProgram(
  input: CreateProgramInput,
): Promise<{ error: string | null; id?: string }> {
  const session = await requireProfessional();

  const rateLimit = checkRateLimit(`create-program:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const name = input.name.trim();
  if (!name) return { error: "Dê um nome ao programa." };

  const { error: criteriaError } = validateStructuredCriteria(input.structuredCriteria);
  if (criteriaError) return { error: criteriaError };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("therapeutic_programs")
    .insert({
      patient_id: input.patientId,
      professional_id: session.user.id,
      name,
      description: input.description?.trim() || null,
      mastery_criteria: input.masteryCriteria?.trim() || null,
      mastery_criteria_type: input.structuredCriteria?.type ?? null,
      mastery_criteria_threshold: input.structuredCriteria?.threshold ?? null,
      mastery_criteria_consecutive_sessions: input.structuredCriteria?.consecutiveSessions ?? null,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message || "Não foi possível criar o programa." };

  await logAudit({
    actorId: session.user.id,
    action: "therapeutic_program.created",
    entity: "therapeutic_programs",
    entityId: created.id,
    metadata: { patient_id: input.patientId },
  });

  return { error: null, id: created.id };
}

/** Define/edita/remove o critério estruturado de um programa já existente —
 * separado de updateProgramStatus porque são decisões diferentes (critério é
 * configuração do alvo, status é o estágio atual do programa). O texto
 * livre (mastery_criteria) não é tocado aqui, cada um edita o que quiser
 * independente do outro. */
export async function updateProgramMasteryCriteria(
  programId: string,
  structuredCriteria: StructuredMasteryCriteriaInput | null,
): Promise<{ error: string | null }> {
  const session = await requireProfessional();

  const { error: criteriaError } = validateStructuredCriteria(structuredCriteria);
  if (criteriaError) return { error: criteriaError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("therapeutic_programs")
    .update({
      mastery_criteria_type: structuredCriteria?.type ?? null,
      mastery_criteria_threshold: structuredCriteria?.threshold ?? null,
      mastery_criteria_consecutive_sessions: structuredCriteria?.consecutiveSessions ?? null,
    })
    .eq("id", programId);

  if (error) return { error: "Não foi possível salvar o critério." };

  await logAudit({
    actorId: session.user.id,
    action: "therapeutic_program.mastery_criteria_updated",
    entity: "therapeutic_programs",
    entityId: programId,
    metadata: { structured: structuredCriteria != null },
  });

  return { error: null };
}

export async function updateProgramStatus(
  programId: string,
  status: TherapeuticProgramStatus,
): Promise<{ error: string | null }> {
  const session = await requireProfessional();
  const supabase = await createClient();

  const { error } = await supabase.from("therapeutic_programs").update({ status }).eq("id", programId);
  if (error) return { error: "Não foi possível atualizar o status do programa." };

  await logAudit({
    actorId: session.user.id,
    action: "therapeutic_program.status_changed",
    entity: "therapeutic_programs",
    entityId: programId,
    metadata: { status },
  });

  return { error: null };
}

export interface AddDataSessionInput {
  programId: string;
  patientId: string;
  appointmentId?: string | null;
  sessionDate: string;
  independentCount: number;
  verbalPromptCount: number;
  gesturalPromptCount: number;
  physicalPromptCount: number;
  incorrectCount: number;
  notes?: string;
}

/** Registra uma sessão de coleta — mesma filosofia de patient_evolutions:
 * é o registro clínico daquela sessão, insert-only, nunca editado depois
 * (sem policy de UPDATE na tabela). */
export async function addProgramDataSession(
  input: AddDataSessionInput,
): Promise<{ error: string | null; id?: string }> {
  const session = await requireProfessional();

  const rateLimit = checkRateLimit(`add-program-session:${session.user.id}`, 60, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const total =
    input.independentCount +
    input.verbalPromptCount +
    input.gesturalPromptCount +
    input.physicalPromptCount +
    input.incorrectCount;
  if (total <= 0) return { error: "Registre ao menos uma tentativa antes de salvar." };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("program_data_sessions")
    .insert({
      program_id: input.programId,
      patient_id: input.patientId,
      professional_id: session.user.id,
      appointment_id: input.appointmentId || null,
      session_date: input.sessionDate,
      independent_count: input.independentCount,
      verbal_prompt_count: input.verbalPromptCount,
      gestural_prompt_count: input.gesturalPromptCount,
      physical_prompt_count: input.physicalPromptCount,
      incorrect_count: input.incorrectCount,
      notes: input.notes?.trim() || null,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message || "Não foi possível salvar a sessão." };

  await logAudit({
    actorId: session.user.id,
    action: "program_data_session.created",
    entity: "program_data_sessions",
    entityId: created.id,
    metadata: { patient_id: input.patientId, program_id: input.programId, total_trials: total },
  });

  // Aviso automático de "critério atingido" (F10) — só na TRANSIÇÃO (não
  // bate critério -> bate), pra não notificar de novo em toda sessão
  // seguinte enquanto o programa continuar sendo coletado já dominado.
  // Nunca muda status/fase sozinho: quem decide avançar é sempre o
  // profissional, isto aqui só avisa.
  const { data: program } = await supabase
    .from("therapeutic_programs")
    .select("name, mastery_criteria_type, mastery_criteria_threshold, mastery_criteria_consecutive_sessions")
    .eq("id", input.programId)
    .maybeSingle();

  if (program?.mastery_criteria_type && program.mastery_criteria_threshold != null && program.mastery_criteria_consecutive_sessions != null) {
    const allSessions = await getDataSessionsForProgram(input.programId);
    const criteria = {
      type: program.mastery_criteria_type,
      threshold: program.mastery_criteria_threshold,
      consecutiveSessions: program.mastery_criteria_consecutive_sessions,
    };
    const beforeThisOne = allSessions.filter((s) => s.id !== created.id);
    const wasMetBefore = evaluateMasteryCriteria(beforeThisOne, criteria).met;
    const isMetNow = evaluateMasteryCriteria(allSessions, criteria).met;

    if (isMetNow && !wasMetBefore) {
      await notify({
        userId: session.user.id,
        type: "program.mastery_criteria_met",
        title: "Critério de domínio atingido",
        message: `O programa "${program.name}" atingiu o critério de domínio configurado. A decisão de avançar de fase é sua.`,
        entity: "therapeutic_programs",
        entityId: input.programId,
      });
    }
  }

  return { error: null, id: created.id };
}

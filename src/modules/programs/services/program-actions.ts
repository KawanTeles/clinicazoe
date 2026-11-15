"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import {
  getDataSessionsForProgram,
  getTherapeuticProgramsForPatient,
  type ProgramDataSessionView,
  type TherapeuticProgramView,
} from "@/modules/programs/services/program-queries";
import type { TherapeuticProgramStatus } from "@/lib/supabase/types";

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

export interface CreateProgramInput {
  patientId: string;
  name: string;
  description?: string;
  masteryCriteria?: string;
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

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("therapeutic_programs")
    .insert({
      patient_id: input.patientId,
      professional_id: session.user.id,
      name,
      description: input.description?.trim() || null,
      mastery_criteria: input.masteryCriteria?.trim() || null,
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

  return { error: null, id: created.id };
}

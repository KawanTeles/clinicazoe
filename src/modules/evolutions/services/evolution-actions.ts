"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";

async function requireProfessional() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  return session;
}

export interface EvolutionContentInput {
  session_summary?: string;
  clinical_evolution: string;
  objectives?: string;
  interventions?: string;
  patient_response?: string;
  home_guidance?: string;
  observations?: string;
}

function cleanContent(input: EvolutionContentInput) {
  return {
    session_summary: input.session_summary?.trim() || null,
    clinical_evolution: input.clinical_evolution.trim(),
    objectives: input.objectives?.trim() || null,
    interventions: input.interventions?.trim() || null,
    patient_response: input.patient_response?.trim() || null,
    home_guidance: input.home_guidance?.trim() || null,
    observations: input.observations?.trim() || null,
  };
}

export interface CreateEvolutionInput extends EvolutionContentInput {
  appointment_id: string;
}

/** Cria a evolução de uma consulta já realizada. Só o profissional
 * responsável pela consulta pode chamar isso — a RLS (patient_evolutions_
 * insert_own) reforça a mesma regra no banco caso algo escape daqui. */
export async function createEvolution(
  input: CreateEvolutionInput,
): Promise<{ error: string | null; id?: string }> {
  const session = await requireProfessional();

  const rateLimit = checkRateLimit(`create-evolution:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  if (!input.clinical_evolution.trim()) {
    return { error: "Descreva a evolução clínica do paciente." };
  }

  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id, professional_id, specialty_id, status")
    .eq("id", input.appointment_id)
    .maybeSingle();

  if (!appointment) return { error: "Consulta não encontrada." };
  if (appointment.professional_id !== session.user.id) {
    return { error: "Você só pode registrar evolução das suas próprias consultas." };
  }
  if (!["confirmada", "concluida"].includes(appointment.status)) {
    return { error: "Só é possível registrar evolução para consultas realizadas." };
  }

  let specialtyId = appointment.specialty_id;
  if (!specialtyId) {
    const { data: professional } = await supabase
      .from("professionals")
      .select("specialty_id")
      .eq("id", session.user.id)
      .maybeSingle();
    specialtyId = professional?.specialty_id ?? null;
  }

  const { data: created, error } = await supabase
    .from("patient_evolutions")
    .insert({
      appointment_id: appointment.id,
      patient_id: appointment.patient_id,
      professional_id: session.user.id,
      specialty_id: specialtyId,
      created_by: session.user.id,
      ...cleanContent(input),
    })
    .select("id")
    .single();

  if (error) {
    const message =
      error.code === "23505" ? "Essa consulta já tem uma evolução registrada." : "Não foi possível salvar a evolução.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "evolution.created",
    entity: "patient_evolutions",
    entityId: created.id,
    metadata: { appointment_id: appointment.id, patient_id: appointment.patient_id },
  });

  return { error: null, id: created.id };
}

/** Edita uma evolução já existente. Só quem criou pode editar — reforçado
 * também pela RLS (patient_evolutions_update_own). Admin nunca chega aqui
 * pela UI, e mesmo que chamasse, a RLS bloqueia o update no banco. */
export async function updateEvolution(
  id: string,
  input: EvolutionContentInput,
): Promise<{ error: string | null }> {
  const session = await requireProfessional();

  if (!input.clinical_evolution.trim()) {
    return { error: "Descreva a evolução clínica do paciente." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("patient_evolutions")
    .select("id, professional_id, appointment_id, patient_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { error: "Evolução não encontrada." };
  if (existing.professional_id !== session.user.id) {
    return { error: "Você só pode editar as evoluções que você mesmo criou." };
  }

  const { error } = await supabase.from("patient_evolutions").update(cleanContent(input)).eq("id", id);

  if (error) return { error: "Não foi possível salvar as alterações." };

  await logAudit({
    actorId: session.user.id,
    action: "evolution.updated",
    entity: "patient_evolutions",
    entityId: id,
    metadata: { appointment_id: existing.appointment_id, patient_id: existing.patient_id },
  });

  return { error: null };
}

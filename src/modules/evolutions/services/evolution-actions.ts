"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import {
  getEvolutionsForPatientPage,
  type EvolutionView,
} from "@/modules/evolutions/services/evolution-queries";

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

/** Cria a evolução de uma consulta já realizada. O profissional precisa
 * estar vinculado à consulta — como principal (appointments.professional_id)
 * ou como coterapeuta (appointment_professionals, atendimento
 * compartilhado, Fase 2) — a RLS (patient_evolutions_insert_own) e o
 * trigger patient_evolutions_validate reforçam a mesma regra no banco caso
 * algo escape daqui. */
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

  const isPrincipal = appointment.professional_id === session.user.id;
  let isCoTherapist = false;
  if (!isPrincipal) {
    const { data: link } = await supabase
      .from("appointment_professionals")
      .select("professional_id")
      .eq("appointment_id", input.appointment_id)
      .eq("professional_id", session.user.id)
      .maybeSingle();
    isCoTherapist = Boolean(link);
  }

  if (!isPrincipal && !isCoTherapist) {
    return { error: "Você só pode registrar evolução das consultas às quais está vinculado." };
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

/** Carrega a próxima página da timeline clínica de um paciente, chamada
 * pelo botão "Carregar mais" no client (EvolutionTimeline). Não restringe
 * por role além de exigir sessão — a RLS de patient_evolutions já garante
 * que só quem tem acesso de fato recebe alguma linha. */
export async function loadMoreEvolutionsForPatient(
  patientId: string,
  page: number,
): Promise<{ items: EvolutionView[]; totalPages: number }> {
  const session = await getCurrentUser();
  if (!session) return { items: [], totalPages: 1 };

  return getEvolutionsForPatientPage(patientId, page);
}

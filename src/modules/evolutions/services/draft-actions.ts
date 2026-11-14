"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import type { EvolutionTopicContent } from "@/lib/supabase/types";
import { normalizeTopics, flattenTopics } from "./topic-content";
import { resolveEvolutionTemplate, visibleTopics } from "./template-queries";

async function requireProfessional() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  return session;
}

export interface DraftTopicInput {
  label: string;
  content: string;
  order?: number;
}

export interface EvolutionDraftView {
  id: string;
  appointmentId: string;
  templateId: string | null;
  templateVersion: number | null;
  topics: EvolutionTopicContent[];
  rawSummaryInput: string | null;
  updatedAt: string;
}

/**
 * Abre o formulário de evolução de um atendimento: devolve o modelo resolvido
 * (pessoal -> área -> fábrica) e o rascunho salvo, se houver.
 *
 * O rascunho vive no servidor desde a Etapa 79. Antes vivia só no
 * `localStorage` do navegador, então sumia se o terapeuta trocasse de
 * aparelho — e a coordenação não tinha como saber que alguém tinha começado a
 * escrever.
 */
export async function openEvolutionEditor(appointmentId: string): Promise<{
  error: string | null;
  template?: { id: string; name: string; version: number; topics: { label: string; hint: string | null }[] };
  draft?: EvolutionDraftView | null;
}> {
  const session = await requireProfessional();
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id, professional_id, specialty_id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) return { error: "Atendimento não encontrado." };

  // Defesa em profundidade: os dois pontos de entrada (EvolutionPanel,
  // NewEvolutionLauncher) já filtram por confirmada/concluida antes de
  // oferecer o formulário, e o gatilho evolution_drafts_validate recusaria o
  // autosave de qualquer forma — mas um erro claro aqui, antes de renderizar
  // o editor, é melhor do que deixar o autosave falhar em silêncio.
  if (!["confirmada", "concluida"].includes(appointment.status)) {
    return { error: "Só é possível registrar evolução para atendimentos realizados." };
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

  const template = await resolveEvolutionTemplate(session.user.id, specialtyId);
  if (!template) {
    return { error: "Nenhum modelo de evolução disponível. Avise a administração." };
  }

  const { data: draftRow } = await supabase
    .from("evolution_drafts")
    .select("id, appointment_id, template_id, template_version, topic_contents, raw_summary_input, updated_at")
    .eq("appointment_id", appointmentId)
    .eq("professional_id", session.user.id)
    .maybeSingle();

  return {
    error: null,
    template: {
      id: template.id,
      name: template.name,
      version: template.version,
      topics: visibleTopics(template).map((t) => ({ label: t.label, hint: t.hint })),
    },
    draft: draftRow
      ? {
          id: draftRow.id,
          appointmentId: draftRow.appointment_id,
          templateId: draftRow.template_id,
          templateVersion: draftRow.template_version,
          topics: draftRow.topic_contents ?? [],
          rawSummaryInput: draftRow.raw_summary_input,
          updatedAt: draftRow.updated_at,
        }
      : null,
  };
}

export interface SaveDraftInput {
  appointment_id: string;
  topics: DraftTopicInput[];
  raw_summary_input?: string | null;
  ai_prompt_version?: string | null;
  template_id?: string | null;
  template_version?: number | null;
}

/** Salva (ou atualiza) o rascunho. Chamado pelo autosave do formulário, então
 * é silencioso de propósito: erro aqui nunca deve atrapalhar quem está
 * escrevendo — o texto continua na tela. */
export async function saveEvolutionDraft(
  input: SaveDraftInput,
): Promise<{ error: string | null; savedAt?: string }> {
  const session = await requireProfessional();

  const rateLimit = checkRateLimit(`save-evolution-draft:${session.user.id}`, 120, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas gravações seguidas. Aguarde ${rateLimit.retryAfterSeconds}s.` };
  }

  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id, specialty_id")
    .eq("id", input.appointment_id)
    .maybeSingle();

  if (!appointment) return { error: "Atendimento não encontrado." };

  const topics = normalizeTopics(input.topics);

  // O vínculo com o atendimento e o status dele são conferidos pelo gatilho
  // evolution_drafts_validate; a RLS confere que o rascunho é do autor. Aqui
  // não repetimos essas checagens — repetir regra de segurança em dois lugares
  // é como ela se perde quando um deles muda.
  const { data: saved, error } = await supabase
    .from("evolution_drafts")
    .upsert(
      {
        appointment_id: input.appointment_id,
        patient_id: appointment.patient_id,
        professional_id: session.user.id,
        specialty_id: appointment.specialty_id,
        template_id: input.template_id ?? null,
        template_version: input.template_version ?? null,
        topic_contents: topics,
        raw_summary_input: input.raw_summary_input?.trim() || null,
        ai_prompt_version: input.ai_prompt_version ?? null,
        created_by: session.user.id,
        updated_by: session.user.id,
      },
      { onConflict: "appointment_id,professional_id" },
    )
    .select("updated_at")
    .single();

  if (error) return { error: "Não foi possível salvar o rascunho." };

  return { error: null, savedAt: saved.updated_at };
}

/** Descarta o rascunho. Rascunho PODE ser apagado — é a diferença deliberada
 * em relação à evolução assinada, que não tem policy de delete para ninguém. */
export async function discardEvolutionDraft(
  appointmentId: string,
): Promise<{ error: string | null }> {
  const session = await requireProfessional();
  const supabase = await createClient();

  const { error } = await supabase
    .from("evolution_drafts")
    .delete()
    .eq("appointment_id", appointmentId)
    .eq("professional_id", session.user.id);

  if (error) return { error: "Não foi possível descartar o rascunho." };
  return { error: null };
}

export interface SignEvolutionInput {
  appointment_id: string;
  topics: DraftTopicInput[];
  raw_summary_input?: string | null;
  ai_prompt_version?: string | null;
  template_id?: string | null;
  template_version?: number | null;
}

/**
 * Assina a evolução: grava em `patient_evolutions` (o INSERT imutável de
 * sempre) e apaga o rascunho.
 *
 * Ordem importa. A evolução é inserida PRIMEIRO; o rascunho só é apagado
 * depois do insert dar certo. Se a limpeza do rascunho falhar, o prontuário já
 * está salvo e o pior resultado é um rascunho órfão — que a própria tela trata
 * (o atendimento já tem evolução, então não oferece mais o editor). O inverso
 * — apagar antes e falhar ao inserir — perderia o texto do terapeuta, que é
 * exatamente o que não se pode perder.
 */
export async function signEvolutionFromDraft(
  input: SignEvolutionInput,
): Promise<{ error: string | null; id?: string }> {
  const session = await requireProfessional();

  const rateLimit = checkRateLimit(`sign-evolution:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const topics = normalizeTopics(input.topics);
  const clinicalEvolution = flattenTopics(topics);

  if (!clinicalEvolution) {
    return { error: "Descreva a evolução antes de assinar." };
  }

  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id, specialty_id, status")
    .eq("id", input.appointment_id)
    .maybeSingle();

  if (!appointment) return { error: "Atendimento não encontrado." };

  // Mesma defesa em profundidade de openEvolutionEditor: o gatilho
  // patient_evolutions_validate recusaria de qualquer forma, mas aqui dá pra
  // devolver uma mensagem específica em vez do genérico "Não foi possível
  // salvar a evolução" que o catch de erro do insert devolveria.
  if (!["confirmada", "concluida"].includes(appointment.status)) {
    return { error: "Só é possível registrar evolução para atendimentos realizados." };
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
      clinical_evolution: clinicalEvolution,
      topic_contents: topics,
      template_id: input.template_id ?? null,
      template_version: input.template_version ?? null,
      raw_summary_input: input.raw_summary_input?.trim() || null,
      ai_prompt_version: input.ai_prompt_version ?? null,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique (appointment_id, professional_id) da 0037.
    const message =
      error.code === "23505"
        ? "Você já registrou evolução para este atendimento."
        : "Não foi possível salvar a evolução.";
    return { error: message };
  }

  await supabase
    .from("evolution_drafts")
    .delete()
    .eq("appointment_id", input.appointment_id)
    .eq("professional_id", session.user.id);

  await logAudit({
    actorId: session.user.id,
    action: "evolution.created",
    entity: "patient_evolutions",
    entityId: created.id,
    metadata: {
      appointment_id: appointment.id,
      patient_id: appointment.patient_id,
      template_id: input.template_id ?? null,
      template_version: input.template_version ?? null,
      topic_count: topics.length,
    },
  });

  return { error: null, id: created.id };
}

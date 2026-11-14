"use server";

import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { getAIFeatureFlags } from "./ai-settings-queries";
import { getActiveAIConfig, checkAIUsageLimits } from "./ai-runtime";
import { AIService } from "./ai-service";
import { normalizeDictationFillers } from "./filler-normalization";
import { QUICK_EVOLUTION_PROMPT_VERSION } from "./quick-evolution-prompt";
import { parseTopicResponse } from "./topic-marker";

async function requireProfessionalWithAIAccess() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  const allowed = await can(session.profile, "ai.evolution_assistant.use");
  if (!allowed) throw new Error("Acesso negado.");
  return session;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Mascara o nome do paciente (nome completo e primeiro nome) no texto
 * mandado à IA — nunca no texto original do profissional, que continua
 * intacto no campo e no resumo bruto salvo (item 13 do pedido de produto).
 * Best-effort: cobre o nome do paciente desta consulta, não CPF/telefone/
 * outros identificadores, que ficam fora do escopo pedido. */
function maskPatientName(text: string, patientFullName: string): string {
  const trimmedFullName = patientFullName.trim();
  if (!trimmedFullName) return text;

  let masked = text.replace(new RegExp(escapeRegExp(trimmedFullName), "gi"), "[paciente]");

  const firstName = trimmedFullName.split(/\s+/)[0];
  if (firstName && firstName.length >= 3) {
    masked = masked.replace(new RegExp(`(?<![\\p{L}])${escapeRegExp(firstName)}(?![\\p{L}])`, "giu"), "[paciente]");
  }

  return masked;
}

export interface GenerateQuickEvolutionDraftInput {
  rawSummary: string;
  appointmentId: string;
  /** Rótulos dos tópicos do modelo do profissional (Etapa 79). Com mais de um,
   * a resposta volta já distribuída em `topics`; com um só, volta em `text`,
   * como antes. */
  topicLabels?: string[];
}

/** Gera o rascunho da evolução a partir do resumo único (ditado ou
 * digitado) do profissional — fluxo padrão de "Evolução Rápida". Nunca
 * salva nem assina nada: devolve o texto para a tela, que só grava quando o
 * profissional clicar em "Salvar e assinar" (signEvolutionFromDraft,
 * draft-actions.ts). */
export async function generateQuickEvolutionDraft(
  input: GenerateQuickEvolutionDraftInput,
): Promise<{
  error: string | null;
  text?: string;
  topics?: { label: string; content: string }[];
  promptVersion?: string;
}> {
  let session;
  try {
    session = await requireProfessionalWithAIAccess();
  } catch {
    return { error: "Acesso negado." };
  }

  const rawSummary = input.rawSummary.trim();
  if (!rawSummary) {
    return { error: "Descreva ou dite o resumo da sessão antes de gerar a evolução." };
  }

  const flags = await getAIFeatureFlags();
  if (!flags.enabled || !flags.quickEvolutionEnabled) {
    return { error: "A Evolução Rápida está desabilitada pelo administrador da clínica." };
  }

  const rateLimit = checkRateLimit(`ai-quick-evolution:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const limitCheck = await checkAIUsageLimits(session.user.id);
  if (limitCheck.blocked) return { error: limitCheck.reason };

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id, professional_id, status")
    .eq("id", input.appointmentId)
    .maybeSingle();
  if (!appointment) return { error: "Atendimento não encontrado." };

  const isPrincipal = appointment.professional_id === session.user.id;
  let isCoTherapist = false;
  if (!isPrincipal) {
    const { data: link } = await supabase
      .from("appointment_professionals")
      .select("professional_id")
      .eq("appointment_id", input.appointmentId)
      .eq("professional_id", session.user.id)
      .maybeSingle();
    isCoTherapist = Boolean(link);
  }
  if (!isPrincipal && !isCoTherapist) {
    return { error: "Você só pode gerar evolução dos atendimentos aos quais está vinculado." };
  }
  if (!["confirmada", "concluida"].includes(appointment.status)) {
    return { error: "Só é possível registrar evolução para atendimentos realizados." };
  }

  const { data: patientProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", appointment.patient_id)
    .maybeSingle();

  const { error: configError, config } = await getActiveAIConfig();
  if (configError || !config) return { error: configError };

  const normalized = normalizeDictationFillers(rawSummary);
  const payload = patientProfile?.full_name ? maskPatientName(normalized, patientProfile.full_name) : normalized;

  let generated: { text: string; usage?: { inputTokens: number; outputTokens: number } };
  try {
    generated = await AIService.generateQuickEvolution({
      summary: payload,
      topicLabels: input.topicLabels,
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });
  } catch (err) {
    console.error("[ai] generateQuickEvolution falhou:", err);
    return { error: "Não foi possível gerar a evolução com IA. Tente novamente ou escreva manualmente." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "ai.quick_evolution.generated",
    entity: "patient_evolutions",
    entityId: input.appointmentId,
    metadata: {
      provider: config.provider,
      tokens_in: generated.usage?.inputTokens,
      tokens_out: generated.usage?.outputTokens,
      topic_count: input.topicLabels?.length ?? 1,
      prompt_version: QUICK_EVOLUTION_PROMPT_VERSION,
    },
  });

  // Modelo com mais de um tópico: a resposta volta já distribuída nos campos.
  // parseTopicResponse nunca descarta texto em silêncio — rótulo inventado
  // pela IA vira [[REVISAR:]], que por sua vez bloqueia a assinatura.
  if (input.topicLabels && input.topicLabels.length > 1) {
    return {
      error: null,
      topics: parseTopicResponse(generated.text, input.topicLabels),
      promptVersion: QUICK_EVOLUTION_PROMPT_VERSION,
    };
  }

  return { error: null, text: generated.text, promptVersion: QUICK_EVOLUTION_PROMPT_VERSION };
}

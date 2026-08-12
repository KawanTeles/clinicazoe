"use server";

import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { getAIFeatureFlags } from "./ai-settings-queries";
import { getActiveAIConfig, checkAIUsageLimits } from "./ai-runtime";
import { AIService } from "./ai-service";
import type { ImproveMode } from "./provider-types";

async function requireProfessionalWithAIAccess() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  const allowed = await can(session.profile.role, "ai.evolution_assistant.use");
  if (!allowed) throw new Error("Acesso negado.");
  return session;
}

export async function improveEvolutionText(input: {
  rawText: string;
  mode: ImproveMode;
  appointmentId: string;
}): Promise<{ error: string | null; text?: string }> {
  let session;
  try {
    session = await requireProfessionalWithAIAccess();
  } catch {
    return { error: "Acesso negado." };
  }

  if (!input.rawText.trim()) {
    return { error: "Escreva ou grave algum texto antes de melhorar com IA." };
  }

  const flags = await getAIFeatureFlags();
  if (!flags.enabled || !flags.evolutionAssistantEnabled) {
    return { error: "O assistente de escrita por IA está desabilitado pelo administrador da clínica." };
  }

  const rateLimit = checkRateLimit(`ai-improve-evolution:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const limitCheck = await checkAIUsageLimits(session.user.id);
  if (limitCheck.blocked) return { error: limitCheck.reason };

  const { error: configError, config } = await getActiveAIConfig();
  if (configError || !config) return { error: configError };

  let improved: { text: string; usage?: { inputTokens: number; outputTokens: number } };
  try {
    improved = await AIService.improveEvolution({
      rawText: input.rawText,
      mode: input.mode,
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });
  } catch (err) {
    console.error("[ai] improveEvolution falhou:", err);
    return { error: "Não foi possível processar o texto com IA. Tente novamente ou contate o administrador." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "ai.evolution.improved",
    entity: "patient_evolutions",
    entityId: input.appointmentId,
    metadata: {
      mode: input.mode,
      provider: config.provider,
      tokens_in: improved.usage?.inputTokens,
      tokens_out: improved.usage?.outputTokens,
    },
  });

  return { error: null, text: improved.text };
}

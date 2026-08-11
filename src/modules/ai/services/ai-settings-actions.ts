"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { logAudit } from "@/modules/team/services/audit";
import { AIService } from "./ai-service";
import type { AIProviderId } from "./provider-types";
import type { Database } from "@/lib/supabase/types";

type AISettingsUpdate = Database["public"]["Tables"]["ai_settings"]["Update"];

type ActionResult = { error: string | null };

const VALID_PROVIDERS: AIProviderId[] = ["mock", "openai", "anthropic", "gemini"];

async function requireAIAdmin() {
  const session = await requireAdmin().catch(() => null);
  if (!session) return null;
  return session;
}

export async function updateAIProviderSettings(input: {
  provider: AIProviderId;
  model: string;
  apiKey: string;
}): Promise<ActionResult> {
  const session = await requireAIAdmin();
  if (!session) return { error: "Acesso negado." };

  if (!VALID_PROVIDERS.includes(input.provider)) return { error: "Provedor inválido." };

  const supabase = await createClient();
  const update: AISettingsUpdate = {
    provider: input.provider,
    model: input.model.trim() || null,
    updated_by: session.user.id,
    connection_status: "not_configured",
    connection_tested_at: null,
  };

  const trimmedKey = input.apiKey.trim();
  if (trimmedKey) {
    update.api_key_ciphertext = encryptSecret(trimmedKey);
    update.api_key_last4 = trimmedKey.slice(-4);
  }

  const { error } = await supabase.from("ai_settings").update(update).eq("id", 1);
  if (error) return { error: "Não foi possível salvar as configurações de IA." };

  await logAudit({
    actorId: session.user.id,
    action: "ai.settings.provider_updated",
    entity: "ai_settings",
    entityId: "1",
    metadata: { provider: input.provider, model: input.model.trim() || null, key_changed: Boolean(trimmedKey) },
  });

  return { error: null };
}

export async function testAIConnection(input: {
  provider: AIProviderId;
  model: string;
  apiKey: string;
}): Promise<ActionResult> {
  const session = await requireAIAdmin();
  if (!session) return { error: "Acesso negado." };

  if (!VALID_PROVIDERS.includes(input.provider)) return { error: "Provedor inválido." };

  const supabase = await createClient();
  let apiKey = input.apiKey.trim() || null;

  if (!apiKey && input.provider !== "mock") {
    const { data } = await supabase.from("ai_settings").select("api_key_ciphertext").eq("id", 1).maybeSingle();
    if (data?.api_key_ciphertext) {
      try {
        apiKey = decryptSecret(data.api_key_ciphertext);
      } catch {
        apiKey = null;
      }
    }
  }

  try {
    await AIService.testConnection(input.provider, apiKey, input.model.trim() || null);
  } catch (err) {
    await supabase
      .from("ai_settings")
      .update({ connection_status: "error", connection_tested_at: new Date().toISOString() })
      .eq("id", 1);
    await logAudit({
      actorId: session.user.id,
      action: "ai.settings.connection_tested",
      entity: "ai_settings",
      entityId: "1",
      metadata: { provider: input.provider, result: "error" },
    });
    const message = err instanceof Error ? err.message : "Falha ao testar a conexão.";
    return { error: message };
  }

  await supabase
    .from("ai_settings")
    .update({ connection_status: "connected", connection_tested_at: new Date().toISOString() })
    .eq("id", 1);

  await logAudit({
    actorId: session.user.id,
    action: "ai.settings.connection_tested",
    entity: "ai_settings",
    entityId: "1",
    metadata: { provider: input.provider, result: "connected" },
  });

  return { error: null };
}

export async function updateAIFeatureToggles(input: {
  ai_enabled: boolean;
  evolution_assistant_enabled: boolean;
  show_review_notice: boolean;
  reports_enabled: boolean;
  patient_assistant_enabled: boolean;
}): Promise<ActionResult> {
  const session = await requireAIAdmin();
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_settings")
    .update({
      ai_enabled: input.ai_enabled,
      evolution_assistant_enabled: input.evolution_assistant_enabled,
      show_review_notice: input.show_review_notice,
      reports_enabled: input.reports_enabled,
      patient_assistant_enabled: input.patient_assistant_enabled,
      updated_by: session.user.id,
    })
    .eq("id", 1);

  if (error) return { error: "Não foi possível salvar os recursos de IA." };

  await logAudit({
    actorId: session.user.id,
    action: "ai.settings.toggles_updated",
    entity: "ai_settings",
    entityId: "1",
    metadata: input,
  });

  return { error: null };
}

export async function updateTranscriptionSettings(input: {
  transcription_enabled: boolean;
  transcription_api_key: string;
}): Promise<ActionResult> {
  const session = await requireAIAdmin();
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const update: AISettingsUpdate = {
    transcription_enabled: input.transcription_enabled,
    updated_by: session.user.id,
  };

  // Mesmo padrão de updateAIProviderSettings: campo vazio = mantém a chave
  // já salva (não apaga); só sobrescreve quando o admin cola uma chave nova.
  const trimmedKey = input.transcription_api_key.trim();
  if (trimmedKey) {
    update.transcription_api_key_ciphertext = encryptSecret(trimmedKey);
    update.transcription_api_key_last4 = trimmedKey.slice(-4);
  }

  const { error } = await supabase.from("ai_settings").update(update).eq("id", 1);
  if (error) return { error: "Não foi possível salvar as configurações de transcrição." };

  await logAudit({
    actorId: session.user.id,
    action: "ai.settings.transcription_updated",
    entity: "ai_settings",
    entityId: "1",
    metadata: { transcription_enabled: input.transcription_enabled, key_changed: Boolean(trimmedKey) },
  });

  return { error: null };
}

function parseOptionalLimit(value: string): { ok: true; parsed: number | null } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, parsed: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) return { ok: false };
  return { ok: true, parsed };
}

export async function updateAIUsageLimits(input: {
  monthly_request_limit: string;
  daily_request_limit: string;
  monthly_request_limit_per_user: string;
  limit_action: "block" | "warn" | "allow";
}): Promise<ActionResult> {
  const session = await requireAIAdmin();
  if (!session) return { error: "Acesso negado." };

  const monthly = parseOptionalLimit(input.monthly_request_limit);
  const daily = parseOptionalLimit(input.daily_request_limit);
  const perUser = parseOptionalLimit(input.monthly_request_limit_per_user);
  if (!monthly.ok || !daily.ok || !perUser.ok) {
    return { error: "Informe limites válidos (números inteiros maiores que zero) ou deixe os campos em branco." };
  }

  if (!["block", "warn", "allow"].includes(input.limit_action)) return { error: "Ação de limite inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_settings")
    .update({
      monthly_request_limit: monthly.parsed,
      daily_request_limit: daily.parsed,
      monthly_request_limit_per_user: perUser.parsed,
      limit_action: input.limit_action,
      updated_by: session.user.id,
    })
    .eq("id", 1);

  if (error) return { error: "Não foi possível salvar os limites de uso." };

  await logAudit({
    actorId: session.user.id,
    action: "ai.settings.limits_updated",
    entity: "ai_settings",
    entityId: "1",
    metadata: {
      monthly_request_limit: monthly.parsed,
      daily_request_limit: daily.parsed,
      monthly_request_limit_per_user: perUser.parsed,
      limit_action: input.limit_action,
    },
  });

  return { error: null };
}

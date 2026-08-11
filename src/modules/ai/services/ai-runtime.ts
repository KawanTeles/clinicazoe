import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import type { AIProviderId } from "./provider-types";

export interface ActiveAIConfig {
  provider: AIProviderId;
  apiKey: string | null;
  model: string | null;
}

/** Lê o provedor/chave configurados pelo admin. Único ponto que descriptografa a chave — nunca sai daqui além do provider adapter. */
export async function getActiveAIConfig(): Promise<{ error: string | null; config?: ActiveAIConfig }> {
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("ai_settings")
    .select("provider, model, api_key_ciphertext")
    .eq("id", 1)
    .maybeSingle();

  if (!settings) return { error: "Configuração de IA não encontrada." };

  const provider = settings.provider as AIProviderId;
  let apiKey: string | null = null;
  if (settings.api_key_ciphertext) {
    try {
      apiKey = decryptSecret(settings.api_key_ciphertext);
    } catch {
      return { error: "Não foi possível acessar a chave de IA configurada. Contate o administrador." };
    }
  }

  if (provider !== "mock" && !apiKey) {
    return { error: "Nenhuma chave de API configurada para o provedor de IA selecionado." };
  }

  return { error: null, config: { provider, apiKey, model: settings.model } };
}

export interface TranscriptionAIConfig {
  apiKey: string;
}

/** Lê e descriptografa a chave de transcrição — independente da chave do
 * provedor de texto (getActiveAIConfig, acima). Não confere
 * transcription_enabled aqui: mesmo padrão de getActiveAIConfig não
 * conferir ai_enabled — é responsabilidade do caller via
 * getAIFeatureFlags(), verificado antes de chegar até aqui. */
export async function getTranscriptionAIConfig(): Promise<{ error: string | null; config?: TranscriptionAIConfig }> {
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("ai_settings")
    .select("transcription_api_key_ciphertext")
    .eq("id", 1)
    .maybeSingle();

  if (!settings?.transcription_api_key_ciphertext) {
    return { error: "Nenhuma chave de API configurada para transcrição de áudio. Contate o administrador." };
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(settings.transcription_api_key_ciphertext);
  } catch {
    return { error: "Não foi possível acessar a chave de transcrição configurada. Contate o administrador." };
  }

  return { error: null, config: { apiKey } };
}

async function countAIRequests(admin: ReturnType<typeof createAdminClient>, since: string, actorId?: string) {
  let query = admin.from("audit_logs").select("id", { count: "exact", head: true }).like("action", "ai.%").gte("created_at", since);
  if (actorId) query = query.eq("actor_id", actorId);
  const { count } = await query;
  return count ?? 0;
}

type UsageLimitCheck = { blocked: false } | { blocked: true; reason: string };

/** Checa os três limites de uso de IA configurados (mensal por clínica, diário, mensal por usuário) contra o uso já registrado em audit_logs. */
export async function checkAIUsageLimits(actorId: string): Promise<UsageLimitCheck> {
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("ai_settings")
    .select("monthly_request_limit, daily_request_limit, monthly_request_limit_per_user, limit_action")
    .eq("id", 1)
    .maybeSingle();

  if (!settings || settings.limit_action !== "block") return { blocked: false };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  if (settings.monthly_request_limit) {
    const count = await countAIRequests(admin, startOfMonth);
    if (count >= settings.monthly_request_limit) {
      return { blocked: true, reason: "Limite mensal de uso de IA da clínica foi atingido. Contate o administrador." };
    }
  }

  if (settings.daily_request_limit) {
    const count = await countAIRequests(admin, startOfDay);
    if (count >= settings.daily_request_limit) {
      return { blocked: true, reason: "Limite diário de uso de IA da clínica foi atingido. Tente novamente amanhã." };
    }
  }

  if (settings.monthly_request_limit_per_user) {
    const count = await countAIRequests(admin, startOfMonth, actorId);
    if (count >= settings.monthly_request_limit_per_user) {
      return { blocked: true, reason: "Você atingiu seu limite mensal individual de uso de IA. Contate o administrador." };
    }
  }

  return { blocked: false };
}

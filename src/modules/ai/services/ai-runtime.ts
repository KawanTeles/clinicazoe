import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { notifyStaff } from "@/modules/notifications/services/notify";
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

/** Em modo "warn", garante no máximo uma notificação por período (mês/dia)
 * para cada tipo de limite, checando se já existe uma notificação desse
 * tipo (e, para o limite por usuário, desse usuário) criada dentro do
 * período atual antes de gravar outra — evita spammar o admin a cada
 * requisição de IA feita depois que o limite já foi cruzado. Assim como
 * notify()/notifyStaff(), nunca deve lançar: em modo "warn" a IA precisa
 * continuar liberada mesmo que essa checagem de duplicidade falhe. */
async function warnLimitReachedOnce(
  admin: ReturnType<typeof createAdminClient>,
  params: { type: string; since: string; title: string; message: string; entityId?: string },
) {
  try {
    let query = admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("type", params.type)
      .gte("created_at", params.since);
    if (params.entityId) query = query.eq("entity_id", params.entityId);
    const { count } = await query;
    if ((count ?? 0) > 0) return;

    await notifyStaff({
      type: params.type,
      title: params.title,
      message: params.message,
      entity: "profiles",
      entityId: params.entityId,
    });
  } catch (err) {
    console.error("[checkAIUsageLimits] falha ao notificar limite atingido:", err);
  }
}

/** Checa os três limites de uso de IA configurados (mensal por clínica, diário, mensal por usuário) contra o uso já registrado em audit_logs. */
export async function checkAIUsageLimits(actorId: string): Promise<UsageLimitCheck> {
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("ai_settings")
    .select("monthly_request_limit, daily_request_limit, monthly_request_limit_per_user, limit_action")
    .eq("id", 1)
    .maybeSingle();

  if (!settings || settings.limit_action === "allow") return { blocked: false };

  const shouldBlock = settings.limit_action === "block";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  if (settings.monthly_request_limit) {
    const count = await countAIRequests(admin, startOfMonth);
    if (count >= settings.monthly_request_limit) {
      if (shouldBlock) {
        return { blocked: true, reason: "Limite mensal de uso de IA da clínica foi atingido. Contate o administrador." };
      }
      await warnLimitReachedOnce(admin, {
        type: "ai_usage_limit.monthly_clinic",
        since: startOfMonth,
        title: "Limite mensal de IA atingido",
        message: `O limite mensal de uso de IA da clínica (${settings.monthly_request_limit} requisições) foi atingido. Como o modo está configurado como "Avisar apenas", a IA continua liberada para a equipe.`,
      });
    }
  }

  if (settings.daily_request_limit) {
    const count = await countAIRequests(admin, startOfDay);
    if (count >= settings.daily_request_limit) {
      if (shouldBlock) {
        return { blocked: true, reason: "Limite diário de uso de IA da clínica foi atingido. Tente novamente amanhã." };
      }
      await warnLimitReachedOnce(admin, {
        type: "ai_usage_limit.daily_clinic",
        since: startOfDay,
        title: "Limite diário de IA atingido",
        message: `O limite diário de uso de IA da clínica (${settings.daily_request_limit} requisições) foi atingido hoje. Como o modo está configurado como "Avisar apenas", a IA continua liberada para a equipe.`,
      });
    }
  }

  if (settings.monthly_request_limit_per_user) {
    const count = await countAIRequests(admin, startOfMonth, actorId);
    if (count >= settings.monthly_request_limit_per_user) {
      if (shouldBlock) {
        return { blocked: true, reason: "Você atingiu seu limite mensal individual de uso de IA. Contate o administrador." };
      }
      const { data: actorProfile } = await admin.from("profiles").select("full_name").eq("id", actorId).maybeSingle();
      await warnLimitReachedOnce(admin, {
        type: "ai_usage_limit.monthly_user",
        since: startOfMonth,
        entityId: actorId,
        title: "Limite individual de IA atingido",
        message: `${actorProfile?.full_name ?? "Um usuário"} atingiu o limite mensal individual de uso de IA (${settings.monthly_request_limit_per_user} requisições). Como o modo está configurado como "Avisar apenas", a IA continua liberada.`,
      });
    }
  }

  return { blocked: false };
}

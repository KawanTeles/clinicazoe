import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AIProviderId } from "./provider-types";

export interface AISettingsForAdmin {
  provider: AIProviderId;
  model: string | null;
  hasApiKey: boolean;
  apiKeyLast4: string | null;
  connectionStatus: "not_configured" | "connected" | "error";
  connectionTestedAt: string | null;
  aiEnabled: boolean;
  evolutionAssistantEnabled: boolean;
  showReviewNotice: boolean;
  reportsEnabled: boolean;
  patientAssistantEnabled: boolean;
  monthlyRequestLimit: number | null;
  dailyRequestLimit: number | null;
  monthlyRequestLimitPerUser: number | null;
  limitAction: "block" | "warn" | "allow";
}

/** Usado só pela tela de admin. Nunca retorna a chave em texto puro — apenas os últimos 4 dígitos. */
export async function getAISettingsForAdmin(): Promise<AISettingsForAdmin | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_settings")
    .select(
      "provider, model, api_key_last4, connection_status, connection_tested_at, ai_enabled, evolution_assistant_enabled, show_review_notice, reports_enabled, patient_assistant_enabled, monthly_request_limit, daily_request_limit, monthly_request_limit_per_user, limit_action",
    )
    .eq("id", 1)
    .maybeSingle();

  if (!data) return null;

  return {
    provider: data.provider as AIProviderId,
    model: data.model,
    hasApiKey: Boolean(data.api_key_last4),
    apiKeyLast4: data.api_key_last4,
    connectionStatus: data.connection_status as AISettingsForAdmin["connectionStatus"],
    connectionTestedAt: data.connection_tested_at,
    aiEnabled: data.ai_enabled,
    evolutionAssistantEnabled: data.evolution_assistant_enabled,
    showReviewNotice: data.show_review_notice,
    reportsEnabled: data.reports_enabled,
    patientAssistantEnabled: data.patient_assistant_enabled,
    monthlyRequestLimit: data.monthly_request_limit,
    dailyRequestLimit: data.daily_request_limit,
    monthlyRequestLimitPerUser: data.monthly_request_limit_per_user,
    limitAction: data.limit_action as AISettingsForAdmin["limitAction"],
  };
}

export interface AIFeatureFlags {
  enabled: boolean;
  evolutionAssistantEnabled: boolean;
  showReviewNotice: boolean;
  reportsEnabled: boolean;
  patientAssistantEnabled: boolean;
}

/**
 * Subconjunto seguro (só booleans) para telas fora do admin decidirem se
 * mostram o recurso de IA. Usa o client de service role porque a RLS de
 * ai_settings é admin-only — mesmo padrão de logAudit() gravando em
 * audit_logs sem policy de insert para authenticated.
 */
export async function getAIFeatureFlags(): Promise<AIFeatureFlags> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_settings")
    .select("ai_enabled, evolution_assistant_enabled, show_review_notice, reports_enabled, patient_assistant_enabled")
    .eq("id", 1)
    .maybeSingle();

  return {
    enabled: data?.ai_enabled ?? false,
    evolutionAssistantEnabled: data?.evolution_assistant_enabled ?? false,
    showReviewNotice: data?.show_review_notice ?? true,
    reportsEnabled: data?.reports_enabled ?? false,
    patientAssistantEnabled: data?.patient_assistant_enabled ?? false,
  };
}

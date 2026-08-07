import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd, type AIProviderId } from "./provider-types";

export interface AIUsageStats {
  requestsThisMonth: number;
  evolutionsImproved: number;
  reportsGenerated: number;
  assistantQuestions: number;
  tokensThisMonth: number;
  estimatedCostUsd: number;
  estimatedMinutesSaved: number;
  monthlyLimit: number | null;
  limitUsagePercent: number | null;
  monthlyLimitPerUser: number | null;
  byProfessional: { name: string; count: number }[];
  last6Months: { label: string; count: number }[];
}

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Estatísticas de uso de IA da clínica, agregadas em memória a partir de
 * audit_logs (nenhuma tabela extra) — só metadata técnica (provider, modo,
 * tokens), nunca conteúdo clínico. Só deve ser chamada por telas admin-only
 * (checagem de permissão fica no chamador).
 */
export async function getAIUsageStats(): Promise<AIUsageStats> {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const sixMonthsAgoStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1)).toISOString();

  const [{ data: settings }, { data: monthRows }, { data: sixMonthRows }] = await Promise.all([
    admin.from("ai_settings").select("monthly_request_limit, monthly_request_limit_per_user").eq("id", 1).maybeSingle(),
    admin
      .from("audit_logs")
      .select("action, actor_id, metadata, created_at")
      .like("action", "ai.%")
      .gte("created_at", monthStart),
    admin.from("audit_logs").select("action, created_at").like("action", "ai.%").gte("created_at", sixMonthsAgoStart),
  ]);

  const rows = monthRows ?? [];

  let evolutionsImproved = 0;
  let reportsGenerated = 0;
  let assistantQuestions = 0;
  let tokensThisMonth = 0;
  let estimatedCostUsd = 0;
  const countByActor = new Map<string, number>();

  for (const row of rows) {
    if (row.action === "ai.evolution.improved") evolutionsImproved += 1;
    else if (row.action === "ai.report.generated") reportsGenerated += 1;
    else if (row.action === "ai.assistant.question") assistantQuestions += 1;

    const metadata = row.metadata ?? {};
    const tokensIn = typeof metadata.tokens_in === "number" ? metadata.tokens_in : 0;
    const tokensOut = typeof metadata.tokens_out === "number" ? metadata.tokens_out : 0;
    tokensThisMonth += tokensIn + tokensOut;
    if (typeof metadata.provider === "string") {
      estimatedCostUsd += estimateCostUsd(metadata.provider as AIProviderId, tokensIn, tokensOut);
    }

    if (row.actor_id) countByActor.set(row.actor_id, (countByActor.get(row.actor_id) ?? 0) + 1);
  }

  const requestsThisMonth = rows.length;
  const estimatedMinutesSaved = evolutionsImproved * 4 + reportsGenerated * 15 + assistantQuestions * 2;

  let byProfessional: { name: string; count: number }[] = [];
  const actorIds = Array.from(countByActor.keys());
  if (actorIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", actorIds);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    byProfessional = actorIds
      .map((id) => ({ name: nameById.get(id) ?? "Usuário removido", count: countByActor.get(id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }

  const monthlyLimit = settings?.monthly_request_limit ?? null;
  const limitUsagePercent = monthlyLimit ? Math.round((requestsThisMonth / monthlyLimit) * 100) : null;
  const monthlyLimitPerUser = settings?.monthly_request_limit_per_user ?? null;

  const monthCounts = new Map<string, number>();
  for (const row of sixMonthRows ?? []) {
    const d = new Date(row.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const last6Months: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    last6Months.push({ label: MONTH_LABELS[d.getMonth()], count: monthCounts.get(key) ?? 0 });
  }

  return {
    requestsThisMonth,
    evolutionsImproved,
    reportsGenerated,
    assistantQuestions,
    tokensThisMonth,
    estimatedCostUsd,
    estimatedMinutesSaved,
    monthlyLimit,
    limitUsagePercent,
    monthlyLimitPerUser,
    byProfessional,
    last6Months,
  };
}

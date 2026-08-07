import type { AIUsageStats } from "@/modules/ai/services/usage-stats-queries";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

export function AIUsageStatsCard({ stats }: { stats: AIUsageStats }) {
  const showLimitWarning = stats.limitUsagePercent !== null && stats.limitUsagePercent >= 80;
  const maxMonthCount = Math.max(1, ...stats.last6Months.map((m) => m.count));

  return (
    <div className="flex flex-col gap-5">
      {showLimitWarning && (
        <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs font-semibold text-text-primary">
          ⚠️ A clínica já usou {stats.limitUsagePercent}% do limite mensal de requisições de IA configurado (
          {stats.requestsThisMonth} / {stats.monthlyLimit}).
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="Requisições este mês" value={numberFormatter.format(stats.requestsThisMonth)} />
        <Tile label="Evoluções melhoradas" value={numberFormatter.format(stats.evolutionsImproved)} />
        <Tile label="Relatórios gerados" value={numberFormatter.format(stats.reportsGenerated)} />
        <Tile label="Perguntas ao assistente" value={numberFormatter.format(stats.assistantQuestions)} />
        <Tile label="Tokens utilizados" value={numberFormatter.format(stats.tokensThisMonth)} />
        <Tile label="Custo estimado" value={currencyFormatter.format(stats.estimatedCostUsd)} />
        <Tile label="Tempo estimado economizado" value={formatMinutes(stats.estimatedMinutesSaved)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-secondary">Uso por profissional</p>
          {stats.byProfessional.length === 0 ? (
            <p className="text-xs text-text-muted">Nenhum uso registrado este mês.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.byProfessional.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-primary">{p.name}</span>
                  <span className="text-text-secondary">
                    {p.count}
                    {stats.monthlyLimitPerUser ? ` / ${stats.monthlyLimitPerUser}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-secondary">Últimos 6 meses</p>
          <div className="flex flex-col gap-2">
            {stats.last6Months.map((m) => (
              <div key={m.label} className="flex items-center gap-2.5 text-xs">
                <span className="w-8 shrink-0 font-semibold uppercase text-text-secondary">{m.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-card-elevated">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(m.count / maxMonthCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-text-secondary">{m.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-text-muted">
        Custo e tokens são estimativas aproximadas calculadas a partir do consumo informado pelos provedores — não
        substituem a fatura real. O provedor Mock nunca gera custo.
      </p>
    </div>
  );
}

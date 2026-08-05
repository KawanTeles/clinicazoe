import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { getAuditLogs } from "@/modules/audit/services/audit-queries";

export const metadata = {
  title: "Auditoria — ClinicaZoe",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { items: logs, totalPages } = await getAuditLogs(page);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Auditoria</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Ações registradas no sistema, com autor, data e hora.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-5 py-4 font-bold">Quando</th>
              <th className="px-5 py-4 font-bold">Autor</th>
              <th className="px-5 py-4 font-bold">Ação</th>
              <th className="px-5 py-4 font-bold">Entidade</th>
              <th className="px-5 py-4 font-bold">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-text-muted">
                  Nenhum evento registrado ainda.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="transition-colors hover:bg-surface/50">
                <td className="whitespace-nowrap px-5 py-4 font-medium text-text-secondary">
                  {dateFormatter.format(new Date(log.created_at))}
                </td>
                <td className="px-5 py-4 font-semibold text-text-primary">{log.actorName}</td>
                <td className="px-5 py-4">
                  <Badge tone="neutral">{log.action}</Badge>
                </td>
                <td className="px-5 py-4 text-text-secondary">
                  {log.entity}
                  {log.entity_id && (
                    <span className="ml-1 font-mono text-xs text-[var(--link)]">
                      #{log.entity_id.slice(0, 8)}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {log.metadata && Object.keys(log.metadata).length > 0 ? (
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-[var(--link)] hover:text-[var(--link-hover)]">ver detalhes</summary>
                      <pre className="mt-2 max-w-xs overflow-x-auto rounded-xl border border-border bg-card-elevated p-3 font-mono text-xs text-text-secondary">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} basePath="/audit" />
    </div>
  );
}


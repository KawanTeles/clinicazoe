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
        <h1 className="text-xl font-semibold text-text-primary">Auditoria</h1>
        <p className="text-sm text-text-secondary">
          Ações registradas no sistema, com autor, data e hora.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Quando</th>
              <th className="px-4 py-3 font-medium">Autor</th>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Entidade</th>
              <th className="px-4 py-3 font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-secondary">
                  Nenhum evento registrado ainda.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                  {dateFormatter.format(new Date(log.created_at))}
                </td>
                <td className="px-4 py-3 text-text-primary">{log.actorName}</td>
                <td className="px-4 py-3">
                  <Badge tone="neutral">{log.action}</Badge>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {log.entity}
                  {log.entity_id && (
                    <span className="ml-1 font-mono text-xs text-text-secondary/70">
                      #{log.entity_id.slice(0, 8)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {log.metadata && Object.keys(log.metadata).length > 0 ? (
                    <details>
                      <summary className="cursor-pointer text-xs text-accent">ver</summary>
                      <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-bg-soft p-2 text-xs text-text-secondary">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <span className="text-xs text-text-secondary">—</span>
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

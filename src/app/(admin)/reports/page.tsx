import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { listAIReports } from "@/modules/ai/services/reports-queries";
import { getAIFeatureFlags } from "@/modules/ai/services/ai-settings-queries";
import { REPORT_TEMPLATE_LABELS } from "@/modules/ai/services/provider-types";

export const metadata = {
  title: "Relatórios IA — Espaço Zoe",
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function ReportsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/equipe");

  const [canUse, flags] = await Promise.all([can(session.profile.role, "ai.reports.use"), getAIFeatureFlags()]);
  if (!canUse || !flags.enabled || !flags.reportsEnabled) redirect("/dashboard");

  const reports = await listAIReports();
  const isProfessional = session.profile.role === "profissional";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">📋 Relatórios IA</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {isProfessional
              ? "Gere relatórios a partir das evoluções já registradas dos seus pacientes."
              : "Relatórios gerados pelos profissionais da clínica."}
          </p>
        </div>
        {isProfessional && (
          <Link href="/reports/new">
            <Button>+ Novo Relatório IA</Button>
          </Link>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm font-medium text-text-secondary">
          Nenhum relatório gerado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-5 py-3.5 font-bold">Paciente</th>
                <th className="px-5 py-3.5 font-bold">Profissional</th>
                <th className="px-5 py-3.5 font-bold">Modelo</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold">Criado em</th>
                <th className="px-5 py-3.5 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {reports.map((report) => (
                <tr key={report.id} className="transition-colors hover:bg-card-elevated/40">
                  <td className="px-5 py-4 font-semibold text-text-primary">{report.patientName}</td>
                  <td className="px-5 py-4 text-text-secondary">{report.professionalName}</td>
                  <td className="px-5 py-4 text-text-secondary">{REPORT_TEMPLATE_LABELS[report.template]}</td>
                  <td className="px-5 py-4">
                    <Badge tone={report.status === "finalized" ? "success" : "warning"}>
                      {report.status === "finalized" ? "No prontuário" : "Rascunho"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{dateTimeFormatter.format(new Date(report.createdAt))}</td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/reports/${report.id}`}>
                      <Button size="sm" variant="secondary" className="h-8 px-3 text-xs">
                        Abrir
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

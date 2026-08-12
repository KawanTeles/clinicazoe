import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAIFeatureFlags } from "@/modules/ai/services/ai-settings-queries";
import { getAIReport } from "@/modules/ai/services/reports-queries";
import { getClinicSettings } from "@/modules/settings/services/settings-queries";
import { PrintOnMount } from "@/modules/ai/components/PrintOnMount";

export const metadata = {
  title: "Imprimir Relatório — Espaço Zoe",
  robots: { index: false, follow: false, nocache: true },
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function ReportPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) redirect("/equipe");

  const [canUse, flags] = await Promise.all([can(session.profile.role, "ai.reports.use"), getAIFeatureFlags()]);
  if (!canUse || !flags.enabled || !flags.reportsEnabled) redirect("/dashboard");

  const { id } = await params;
  const [report, clinic] = await Promise.all([getAIReport(id), getClinicSettings()]);
  if (!report) notFound();

  return (
    <div className="min-h-screen bg-white">
    <div className="mx-auto max-w-3xl px-8 py-10 text-black print:px-0 print:py-0">
      <style>{`@media print { @page { margin: 2cm; } body { background: white; } }`}</style>
      <PrintOnMount />
      <div className="mb-8 flex items-center justify-between border-b border-gray-300 pb-4">
        <h2 className="text-lg font-bold">{clinic?.name ?? "Espaço Zoe"}</h2>
        <span className="text-xs text-gray-500">Gerado em {dateFormatter.format(new Date(report.createdAt))}</span>
      </div>

      <h1 className="mb-2 text-2xl font-bold">{report.title}</h1>
      <p className="mb-6 text-sm text-gray-600">Paciente: {report.patientName}</p>

      <div className="whitespace-pre-wrap text-sm leading-relaxed">{report.content}</div>

      <p className="mt-10 border-t border-gray-300 pt-3 text-[10px] text-gray-500">
        Este conteúdo foi gerado com auxílio de Inteligência Artificial e foi revisado e validado pelo profissional
        responsável ({report.professionalName}) antes de sua utilização.
      </p>
    </div>
    </div>
  );
}

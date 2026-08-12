import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAIFeatureFlags } from "@/modules/ai/services/ai-settings-queries";
import { getAIReport } from "@/modules/ai/services/reports-queries";
import { ReportEditor } from "@/modules/ai/components/ReportEditor";

export const metadata = {
  title: "Relatório IA — Espaço Zoe",
};

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) redirect("/equipe");

  const [canUse, flags] = await Promise.all([can(session.profile.role, "ai.reports.use"), getAIFeatureFlags()]);
  if (!canUse || !flags.enabled || !flags.reportsEnabled) redirect("/dashboard");

  const { id } = await params;
  const report = await getAIReport(id);
  if (!report) notFound();

  const canEdit = session.profile.role === "profissional" && report.professionalId === session.user.id;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">{report.title}</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <ReportEditor report={report} canEdit={canEdit} />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAIFeatureFlags } from "@/modules/ai/services/ai-settings-queries";
import { ReportWizard } from "@/modules/ai/components/ReportWizard";

export const metadata = {
  title: "Novo Relatório IA — ClinicaZoe",
};

export default async function NewReportPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/equipe");
  if (session.profile.role !== "profissional") redirect("/reports");

  const [canUse, flags] = await Promise.all([can(session.profile.role, "ai.reports.use"), getAIFeatureFlags()]);
  if (!canUse || !flags.enabled || !flags.reportsEnabled) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">✨ Novo Relatório IA</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Escolha o paciente, o período, as evoluções e o modelo de relatório.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <ReportWizard />
      </div>
    </div>
  );
}

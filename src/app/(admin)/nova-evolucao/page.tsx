import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPendingEvolutionsForProfessional } from "@/modules/evolutions/services/evolution-queries";
import { getAIFeatureFlags } from "@/modules/ai/services/ai-settings-queries";
import { PendingEvolutionsScreen } from "@/modules/evolutions/components/PendingEvolutionsScreen";

export const metadata = {
  title: "Evolução — Espaço Zoe",
};

export default async function NovaEvolucaoPage({
  searchParams,
}: {
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const { appointmentId } = await searchParams;

  const [pendingItems, hasEvolutionAssistantPermission, flags] = await Promise.all([
    getPendingEvolutionsForProfessional(session.user.id),
    can(session.profile, "ai.evolution_assistant.use"),
    getAIFeatureFlags(),
  ]);

  // Mesmo critério de my-patients/[id]/page.tsx para o formulário de evolução.
  const aiEnabled = hasEvolutionAssistantPermission && flags.enabled && flags.evolutionAssistantEnabled;
  const transcriptionEnabled = hasEvolutionAssistantPermission && flags.enabled && flags.transcriptionEnabled;
  const quickEvolutionEnabled = hasEvolutionAssistantPermission && flags.enabled && flags.quickEvolutionEnabled;

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Evolução</h1>
        <p className="mt-1 text-sm text-text-secondary">Atendimentos ainda sem evolução registrada.</p>
      </div>

      <PendingEvolutionsScreen
        items={pendingItems}
        initialAppointmentId={appointmentId ?? null}
        aiEnabled={aiEnabled}
        transcriptionEnabled={transcriptionEnabled}
        quickEvolutionEnabled={quickEvolutionEnabled}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEvolutionTracking, getProfessionalOptions } from "@/modules/evolutions/services/tracking-queries";
import { getActiveSpecialties } from "@/modules/specialties/services/specialty-queries";
import { EvolutionTrackingView } from "@/modules/evolutions/components/EvolutionTrackingView";

export const metadata = {
  title: "Acompanhamento de Evoluções — Espaço Zoe",
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default async function EvolutionTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    professional?: string;
    specialty?: string;
    status?: string;
  }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const allowed = await can(session.profile, "evolution_tracking.view");
  if (!allowed) redirect("/dashboard");

  const params = await searchParams;
  const dateFrom = params.from || isoDaysAgo(14);
  const dateTo = params.to || isoDaysAgo(0);

  const [tracking, professionalOptions, specialties] = await Promise.all([
    getEvolutionTracking({
      dateFrom,
      dateTo,
      professionalId: params.professional || undefined,
      specialtyId: params.specialty || undefined,
    }),
    getProfessionalOptions(),
    getActiveSpecialties(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">
          Acompanhamento de Evoluções
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-text-secondary">
          Quais atendimentos já têm evolução registrada e quais estão pendentes, por terapeuta. O texto da evolução
          não é exibido aqui — só a situação.
        </p>
      </div>

      <EvolutionTrackingView
        rows={tracking.rows}
        counts={tracking.counts}
        lateAfterHours={tracking.lateAfterHours}
        professionalOptions={professionalOptions}
        specialties={specialties}
        filters={{
          from: dateFrom,
          to: dateTo,
          professional: params.professional ?? "",
          specialty: params.specialty ?? "",
          status: params.status ?? "",
        }}
      />
    </div>
  );
}

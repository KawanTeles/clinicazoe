import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTeamMember } from "@/modules/team/services/team-queries";
import {
  getActiveInsurances,
  getScheduleExceptions,
  getScheduleForProfessional,
} from "@/modules/schedule/services/schedule-queries";
import { ScheduleManager } from "@/modules/schedule/components/ScheduleManager";

export const metadata = {
  title: "Agenda do profissional — ClinicaZoe",
};

export default async function ProfessionalSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const result = await getTeamMember(id);
  if (!result || result.profile.role !== "profissional") redirect("/team");

  const [slots, insurances, exceptions] = await Promise.all([
    getScheduleForProfessional(id),
    getActiveInsurances(),
    getScheduleExceptions(id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/team/${id}`} className="text-sm text-text-secondary hover:text-text-primary">
          ← Voltar para {result.profile.full_name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-text-primary">
          Agenda de {result.profile.full_name}
        </h1>
        <p className="text-sm text-text-secondary">
          Horários recorrentes por dia da semana e convênios aceitos em cada um.
        </p>
      </div>

      <ScheduleManager professionalId={id} slots={slots} insurances={insurances} exceptions={exceptions} />
    </div>
  );
}

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
        <Link href={`/team/${id}`} className="inline-flex items-center text-sm font-semibold text-[#5ED39D] hover:text-[#86E5B8] transition-colors">
          ← Voltar para {result.profile.full_name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#F5F7F6]">
          Agenda de {result.profile.full_name}
        </h1>
        <p className="mt-1 text-sm text-[#C8D4CF]">
          Horários recorrentes por dia da semana e convênios aceitos em cada um.
        </p>
      </div>

      <ScheduleManager professionalId={id} slots={slots} insurances={insurances} exceptions={exceptions} />
    </div>
  );
}


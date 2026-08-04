import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getActiveInsurances,
  getScheduleExceptions,
  getScheduleForProfessional,
} from "@/modules/schedule/services/schedule-queries";
import { ScheduleManager } from "@/modules/schedule/components/ScheduleManager";

export const metadata = {
  title: "Minha Agenda — ClinicaZoe",
};

export default async function MySchedulePage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const [slots, insurances, exceptions] = await Promise.all([
    getScheduleForProfessional(session.user.id),
    getActiveInsurances(),
    getScheduleExceptions(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#F5F7F6]">Minha Agenda</h1>
        <p className="mt-1 text-sm text-[#C8D4CF]">
          Configure seus dias, horários, vagas e convênios aceitos por horário.
        </p>
      </div>

      <ScheduleManager
        professionalId={session.user.id}
        slots={slots}
        insurances={insurances}
        exceptions={exceptions}
      />
    </div>
  );
}


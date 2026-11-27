import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTodayAppointmentsForProfessional } from "@/modules/appointments/services/appointment-queries";
import { TodayAgendaView } from "@/modules/schedule/components/TodayAgendaView";

export const metadata = {
  title: "Hoje — Espaço Zoe",
};

export default async function HojePage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const appointments = await getTodayAppointmentsForProfessional(session.user.id);

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Hoje</h1>
        <p className="mt-1 text-sm text-text-secondary">Seus atendimentos de hoje, em ordem de horário.</p>
      </div>

      <TodayAgendaView appointments={appointments} />
    </div>
  );
}

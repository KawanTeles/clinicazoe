import { redirect } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { getAppointmentsForViewer } from "@/modules/appointments/services/appointment-queries";
import { AppointmentsList } from "@/modules/appointments/components/AppointmentsList";

export const metadata = {
  title: "Consultas — ClinicaZoe",
};

const TITLES: Record<string, { title: string; subtitle: string }> = {
  paciente: { title: "Minhas Consultas", subtitle: "Suas consultas agendadas e o histórico." },
  profissional: { title: "Minha Agenda", subtitle: "Consultas marcadas com você." },
  admin: { title: "Consultas", subtitle: "Fila de consultas de todos os pacientes e profissionais." },
  recepcionista: {
    title: "Consultas",
    subtitle: "Fila de consultas de todos os pacientes e profissionais.",
  },
};

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { items, totalPages } = await getAppointmentsForViewer(
    session.profile.role,
    session.user.id,
    page,
  );
  const copy = TITLES[session.profile.role] ?? TITLES.paciente;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">{copy.title}</h1>
        <p className="mt-1 text-sm text-text-secondary">{copy.subtitle}</p>
      </div>

      <AppointmentsList viewerRole={session.profile.role} appointments={items} />
      <Pagination page={page} totalPages={totalPages} basePath="/appointments" />
    </div>
  );
}


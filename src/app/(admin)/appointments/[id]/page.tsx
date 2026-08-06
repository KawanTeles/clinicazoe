import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAppointmentById } from "@/modules/appointments/services/appointment-queries";
import { getEvolutionForAppointment } from "@/modules/evolutions/services/evolution-queries";
import { AppointmentDetailTabs } from "@/modules/appointments/components/AppointmentDetailTabs";

export const metadata = {
  title: "Detalhes da Consulta — ClinicaZoe",
};

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.profile.role === "paciente") redirect("/appointments");

  const { id } = await params;
  const appointment = await getAppointmentById(id);
  if (!appointment) notFound();

  const isOwnerProfessional =
    session.profile.role === "profissional" && appointment.professionalId === session.user.id;

  if (session.profile.role === "profissional" && !isOwnerProfessional) notFound();

  const canViewEvolution = session.profile.role === "admin" || isOwnerProfessional;
  const evolution = canViewEvolution ? await getEvolutionForAppointment(appointment.id) : null;

  return (
    <AppointmentDetailTabs
      appointment={appointment}
      canViewEvolution={canViewEvolution}
      isOwnerProfessional={isOwnerProfessional}
      evolution={evolution}
    />
  );
}

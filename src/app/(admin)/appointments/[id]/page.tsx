import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAppointmentById } from "@/modules/appointments/services/appointment-queries";
import { getEvolutionForAppointment } from "@/modules/evolutions/services/evolution-queries";
import { AppointmentDetailTabs } from "@/modules/appointments/components/AppointmentDetailTabs";
import { getAIFeatureFlags } from "@/modules/ai/services/ai-settings-queries";

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

  // Evolução é prontuário clínico: acesso exclusivo do profissional
  // responsável pela consulta (sigilo profissional / LGPD). Admin só vê os
  // dados administrativos, já exibidos na aba "Detalhes".
  const canViewEvolution = isOwnerProfessional;
  const evolution = canViewEvolution ? await getEvolutionForAppointment(appointment.id) : null;

  let aiEnabled = false;
  if (isOwnerProfessional) {
    const [hasPermission, flags] = await Promise.all([
      can(session.profile.role, "ai.evolution_assistant.use"),
      getAIFeatureFlags(),
    ]);
    aiEnabled = hasPermission && flags.enabled && flags.evolutionAssistantEnabled;
  }

  return (
    <AppointmentDetailTabs
      appointment={appointment}
      canViewEvolution={canViewEvolution}
      isOwnerProfessional={isOwnerProfessional}
      evolution={evolution}
      aiEnabled={aiEnabled}
    />
  );
}

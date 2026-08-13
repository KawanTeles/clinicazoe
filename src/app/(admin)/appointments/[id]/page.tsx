import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAppointmentById } from "@/modules/appointments/services/appointment-queries";
import { getCoTherapistsForAppointment } from "@/modules/appointments/services/booking-queries";
import { getEvolutionForAppointment } from "@/modules/evolutions/services/evolution-queries";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";
import { AppointmentDetailTabs } from "@/modules/appointments/components/AppointmentDetailTabs";
import { getAIFeatureFlags } from "@/modules/ai/services/ai-settings-queries";

export const metadata = {
  title: "Detalhes do Atendimento — Espaço Zoe",
};

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (session.profile.role === "paciente") redirect("/appointments");

  const { id } = await params;
  const appointment = await getAppointmentById(id);
  if (!appointment) notFound();

  const coTherapists = await getCoTherapistsForAppointment(appointment.id);

  const isPrincipalProfessional =
    session.profile.role === "profissional" && appointment.professionalId === session.user.id;
  const isCoTherapist =
    session.profile.role === "profissional" &&
    coTherapists.some((c) => c.professionalId === session.user.id);
  // Vinculado à consulta como principal ou coterapeuta (atendimento
  // compartilhado, Fase 2) — decide quem pode ver a página e registrar a
  // PRÓPRIA evolução. Editar/cancelar a consulta em si continua exclusivo
  // do principal/equipe (não afetado por isCoTherapist).
  const isLinkedProfessional = isPrincipalProfessional || isCoTherapist;

  if (session.profile.role === "profissional" && !isLinkedProfessional) notFound();

  // Evolução é prontuário clínico: acesso exclusivo de quem está vinculado
  // à consulta — principal ou coterapeuta (sigilo profissional / LGPD).
  // Admin só vê os dados administrativos, já exibidos na aba "Detalhes".
  const canViewEvolution = isLinkedProfessional;
  const evolution = canViewEvolution ? await getEvolutionForAppointment(appointment.id) : null;

  let aiEnabled = false;
  let transcriptionEnabled = false;
  if (isLinkedProfessional) {
    const [hasPermission, flags] = await Promise.all([
      can(session.profile.role, "ai.evolution_assistant.use"),
      getAIFeatureFlags(),
    ]);
    aiEnabled = hasPermission && flags.enabled && flags.evolutionAssistantEnabled;
    transcriptionEnabled = hasPermission && flags.enabled && flags.transcriptionEnabled;
  }

  // Admin, recepção ou o profissional principal podem adicionar/remover
  // coterapeuta — mesma regra de autorização aplicada em
  // addCoTherapist/removeCoTherapist (booking-actions.ts).
  const canManageCoTherapists = isPrincipalProfessional || ["admin", "recepcionista"].includes(session.profile.role);
  const availableProfessionals = canManageCoTherapists
    ? (await getActiveProfessionals())
        .filter((p) => p.id !== appointment.professionalId)
        .map((p) => ({ id: p.id, fullName: p.full_name }))
    : [];

  return (
    <AppointmentDetailTabs
      appointment={appointment}
      canViewEvolution={canViewEvolution}
      canManageEvolution={isLinkedProfessional}
      evolution={evolution}
      aiEnabled={aiEnabled}
      transcriptionEnabled={transcriptionEnabled}
      coTherapists={coTherapists}
      availableProfessionals={availableProfessionals}
      canManageCoTherapists={canManageCoTherapists}
    />
  );
}

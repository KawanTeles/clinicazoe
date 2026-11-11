"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";
import { logScheduleChange } from "@/modules/schedule/services/change-log";
import { insuranceRequiresModality } from "@/lib/constants";
import { todayLocalIso } from "@/lib/date";
import type { Modality, ParticularProduct, PaymentMethod } from "@/lib/supabase/types";

export interface UpdateAppointmentDetailsInput {
  appointmentId: string;
  patientId: string;
  insuranceId: string;
  insuranceName: string;
  paymentMethod: PaymentMethod;
  value: number | null;
  modality?: Modality | null;
  particularProduct?: ParticularProduct | null;
}

/** Edição de paciente/convênio/pagamento/valor/modalidade de UM atendimento
 * já existente — complementa updateRecurringAppointment (recurrence-actions,
 * só mexe em data/hora) e updateAppointmentStatus/Value (booking-actions, só
 * status/valor isolados). Usado pela tela de Agenda (editar direto na
 * grade). A trava de quem pode mexer em quê continua sendo a RLS +
 * prevent_appointment_tampering (migração 0076) — aqui só filtramos cedo pra
 * dar uma mensagem amigável em vez do erro cru do Postgres. */
export async function updateAppointmentDetails(
  input: UpdateAppointmentDetailsInput,
): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("professional_id, appointment_date, status")
    .eq("id", input.appointmentId)
    .single();
  if (!appointment) return { error: "Atendimento não encontrado." };

  const isStaff = ["admin", "recepcionista"].includes(session.profile.role);
  const isOwnProfessional = session.profile.role === "profissional" && appointment.professional_id === session.user.id;
  if (!isStaff && !isOwnProfessional) return { error: "Acesso negado." };

  if (isOwnProfessional && appointment.appointment_date < todayLocalIso()) {
    return { error: "Atendimentos passados só podem ter o status atualizado (falta ou concluída)." };
  }

  const requiresModality = insuranceRequiresModality(input.insuranceName);
  if (requiresModality && !input.modality) return { error: "Selecione a modalidade." };
  if (!requiresModality && !input.particularProduct) return { error: "Selecione o produto particular." };

  const { error } = await supabase
    .from("appointments")
    .update({
      patient_id: input.patientId,
      insurance_id: input.insuranceId,
      payment_method: input.paymentMethod,
      value: input.value,
      modality: requiresModality ? input.modality : null,
      particular_product: requiresModality ? null : input.particularProduct,
    })
    .eq("id", input.appointmentId);

  if (error) return { error: "Não foi possível salvar as alterações deste atendimento." };

  await logAudit({
    actorId: session.user.id,
    action: "appointment.details_updated",
    entity: "appointments",
    entityId: input.appointmentId,
  });

  await logScheduleChange({
    changedBy: session.user.id,
    professionalId: appointment.professional_id,
    entityType: "appointment",
    entityId: input.appointmentId,
    action: "updated",
    changes: [
      { field: "patient_id", old: null, new: input.patientId },
      { field: "insurance_id", old: null, new: input.insuranceId },
      { field: "value", old: null, new: input.value },
    ],
  });

  return { error: null };
}

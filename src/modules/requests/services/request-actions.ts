"use server";

import {
  confirmAppointment,
  rejectAppointmentRequest,
} from "@/modules/appointments/services/booking-actions";

/**
 * Aprovar uma solicitação reaproveita exatamente `confirmAppointment` — já
 * seta status "confirmada", gera o lançamento financeiro, notifica paciente
 * e profissional, e monta o link de WhatsApp de confirmação. Nenhuma lógica
 * nova é necessária: a consulta some da lista de Solicitações porque deixa
 * de bater no filtro `status = 'pendente'`, e passa a aparecer normalmente
 * em Consultas.
 */
export async function approveRequest(
  appointmentId: string,
): Promise<{ error: string | null; whatsappLink?: string | null }> {
  return confirmAppointment(appointmentId);
}

export async function rejectRequest(
  appointmentId: string,
): Promise<{ error: string | null; whatsappLink?: string | null }> {
  return rejectAppointmentRequest(appointmentId);
}

"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildBookingMessage,
  buildCancellationMessage,
  buildConfirmationMessage,
  buildReminderMessage,
  buildWhatsAppLink,
} from "@/lib/whatsapp";
import { logAudit } from "@/modules/team/services/audit";
import { notify, notifyStaff } from "@/modules/notifications/services/notify";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAvailableTimes, getProfessionalPricing } from "./booking-queries";
import type { PaymentMethod } from "@/lib/supabase/types";

async function requirePatient() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "paciente") {
    throw new Error("Acesso negado.");
  }
  return session;
}

async function requireStaff() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) {
    throw new Error("Acesso negado.");
  }
  return session;
}

export interface CreateAppointmentInput {
  professionalId: string;
  specialtyId: string;
  insuranceId: string;
  scheduleSlotId: string;
  date: string;
  startTime: string;
  endTime: string;
  paymentMethod: PaymentMethod;
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<{ error: string | null; whatsappLink?: string | null }> {
  const session = await requirePatient();

  const rateLimit = checkRateLimit(`booking:${session.user.id}`, 5, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const supabase = await createClient();

  // Nunca confia no valor vindo do client: recalcula a partir da precificação real.
  const pricingOptions = await getProfessionalPricing(input.professionalId, input.insuranceId);
  const pricing = pricingOptions.find((option) => option.paymentMethod === input.paymentMethod);
  if (!pricing) {
    return { error: "Forma de pagamento indisponível para este profissional/convênio." };
  }

  // Revalida a disponibilidade no servidor antes de gravar (evita duplo agendamento).
  const availableTimes = await getAvailableTimes(input.professionalId, input.insuranceId, input.date);
  const stillAvailable = availableTimes.some(
    (slot) => slot.slotId === input.scheduleSlotId && slot.startTime === input.startTime,
  );
  if (!stillAvailable) {
    return { error: "Esse horário não está mais disponível. Escolha outro." };
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: session.user.id,
      professional_id: input.professionalId,
      specialty_id: input.specialtyId,
      insurance_id: input.insuranceId,
      schedule_slot_id: input.scheduleSlotId,
      appointment_date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      payment_method: input.paymentMethod,
      value: pricing.value,
      status: "pendente",
    })
    .select("id")
    .single();

  if (error || !appointment) {
    return { error: "Não foi possível criar o agendamento. Tente novamente." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "appointment.created",
    entity: "appointments",
    entityId: appointment.id,
    metadata: { professionalId: input.professionalId, date: input.date, startTime: input.startTime },
  });

  const [{ data: professional }, { data: specialty }, { data: insurance }, { data: clinic }] =
    await Promise.all([
      supabase.from("professionals").select("id").eq("id", input.professionalId).single(),
      supabase.from("specialties").select("name").eq("id", input.specialtyId).single(),
      supabase.from("insurances").select("name").eq("id", input.insuranceId).single(),
      supabase.from("clinic_settings").select("whatsapp_number").eq("id", 1).single(),
    ]);

  const [{ data: professionalProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", input.professionalId).single(),
  ]);

  if (!professional) return { error: null, whatsappLink: null };

  const message = buildBookingMessage({
    patientName: session.profile.full_name,
    patientPhone: session.profile.phone ?? "",
    specialtyName: specialty?.name ?? "",
    professionalName: professionalProfile?.full_name ?? "",
    insuranceName: insurance?.name ?? "",
    appointmentDate: input.date,
    startTime: input.startTime,
    value: pricing.value,
    paymentMethod: input.paymentMethod,
  });

  const whatsappLink = buildWhatsAppLink(clinic?.whatsapp_number, message);

  await notifyStaff({
    type: "appointment.pending",
    title: "Nova consulta pendente",
    message: `${session.profile.full_name} agendou com ${professionalProfile?.full_name ?? "um profissional"} para ${input.date} às ${input.startTime.slice(0, 5)}.`,
    entity: "appointments",
    entityId: appointment.id,
  });

  return { error: null, whatsappLink };
}

export async function cancelAppointment(
  appointmentId: string,
  options?: { rescheduled?: boolean },
): Promise<{ error: string | null; whatsappLink?: string | null }> {
  const session = await getCurrentUser();
  if (!session) return { error: "Acesso negado." };

  const rateLimit = checkRateLimit(`cancel:${session.user.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const supabase = await createClient();
  const rescheduled = options?.rescheduled ?? false;

  const { data: appointment } = await supabase
    .from("appointments")
    .select("appointment_date, start_time, professional_id")
    .eq("id", appointmentId)
    .single();

  const { error } = await supabase
    .from("appointments")
    .update({ status: rescheduled ? "remarcada" : "cancelada" })
    .eq("id", appointmentId);

  if (error) return { error: "Não foi possível cancelar a consulta." };

  await logAudit({
    actorId: session.user.id,
    action: rescheduled ? "appointment.rescheduled" : "appointment.cancelled",
    entity: "appointments",
    entityId: appointmentId,
  });

  if (session.profile.role !== "paciente" || !appointment) {
    return { error: null };
  }

  await notifyStaff({
    type: rescheduled ? "appointment.rescheduled" : "appointment.cancelled",
    title: rescheduled ? "Consulta será remarcada pelo paciente" : "Consulta cancelada pelo paciente",
    message: `${session.profile.full_name} — consulta de ${appointment.appointment_date} às ${appointment.start_time.slice(0, 5)}.`,
    entity: "appointments",
    entityId: appointmentId,
  });

  const [{ data: professionalProfile }, { data: clinic }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", appointment.professional_id).single(),
    supabase.from("clinic_settings").select("whatsapp_number").eq("id", 1).single(),
  ]);

  const message = buildCancellationMessage({
    patientName: session.profile.full_name,
    professionalName: professionalProfile?.full_name ?? "",
    appointmentDate: appointment.appointment_date,
    startTime: appointment.start_time,
    rescheduled,
  });

  const whatsappLink = buildWhatsAppLink(clinic?.whatsapp_number, message);

  return { error: null, whatsappLink };
}

export async function confirmAppointment(
  appointmentId: string,
): Promise<{ error: string | null; whatsappLink?: string | null }> {
  const session = await requireStaff();
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (!appointment) return { error: "Consulta não encontrada." };

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "confirmada" })
    .eq("id", appointmentId);

  if (updateError) return { error: "Não foi possível confirmar a consulta." };

  const admin = createAdminClient();
  const { error: financialError } = await admin.from("financial_entries").insert({
    appointment_id: appointment.id,
    patient_id: appointment.patient_id,
    professional_id: appointment.professional_id,
    insurance_id: appointment.insurance_id,
    value: appointment.value,
    payment_method: appointment.payment_method,
    due_date: appointment.appointment_date,
  });

  if (financialError && !financialError.message.includes("duplicate")) {
    return { error: "Consulta confirmada, mas houve falha ao gerar o lançamento financeiro." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "appointment.confirmed",
    entity: "appointments",
    entityId: appointmentId,
  });

  const [{ data: patient }, { data: professionalProfile }, { data: clinic }] = await Promise.all([
    supabase.from("profiles").select("phone").eq("id", appointment.patient_id).single(),
    supabase.from("profiles").select("full_name").eq("id", appointment.professional_id).single(),
    supabase.from("clinic_settings").select("name, whatsapp_number, address").eq("id", 1).single(),
  ]);

  const message = buildConfirmationMessage({
    professionalName: professionalProfile?.full_name ?? "",
    appointmentDate: appointment.appointment_date,
    startTime: appointment.start_time,
    clinicName: clinic?.name ?? "Clínica",
    clinicAddress: clinic?.address,
    value: appointment.value,
  });

  const whatsappLink = buildWhatsAppLink(patient?.phone, message);

  await Promise.all([
    notify({
      userId: appointment.patient_id,
      type: "appointment.confirmed",
      title: "Consulta confirmada",
      message: `Sua consulta com ${professionalProfile?.full_name ?? "o profissional"} em ${appointment.appointment_date} às ${appointment.start_time.slice(0, 5)} foi confirmada.`,
      entity: "appointments",
      entityId: appointmentId,
    }),
    notify({
      userId: appointment.professional_id,
      type: "appointment.confirmed",
      title: "Nova consulta confirmada na sua agenda",
      message: `${appointment.appointment_date} às ${appointment.start_time.slice(0, 5)}.`,
      entity: "appointments",
      entityId: appointmentId,
    }),
  ]);

  return { error: null, whatsappLink };
}

const STATUS_LABELS: Record<string, string> = {
  cancelada: "cancelada",
  remarcada: "remarcada",
  concluida: "concluída",
  faltou: "marcada como falta",
};

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "cancelada" | "remarcada" | "concluida" | "faltou",
): Promise<{ error: string | null }> {
  const session = await requireStaff();
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("patient_id, appointment_date, start_time")
    .eq("id", appointmentId)
    .single();

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);

  if (error) return { error: "Não foi possível atualizar a consulta." };

  await logAudit({
    actorId: session.user.id,
    action: "appointment.status_updated",
    entity: "appointments",
    entityId: appointmentId,
    metadata: { status },
  });

  if (appointment && (status === "cancelada" || status === "remarcada")) {
    await notify({
      userId: appointment.patient_id,
      type: `appointment.${status}`,
      title: `Consulta ${STATUS_LABELS[status]}`,
      message: `Sua consulta de ${appointment.appointment_date} às ${appointment.start_time.slice(0, 5)} foi ${STATUS_LABELS[status]} pela clínica.`,
      entity: "appointments",
      entityId: appointmentId,
    });
  }

  return { error: null };
}

export async function sendReminder(
  appointmentId: string,
): Promise<{ error: string | null; whatsappLink?: string | null }> {
  await requireStaff();
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (!appointment) return { error: "Consulta não encontrada." };

  const [{ data: patient }, { data: professionalProfile }, { data: clinic }] = await Promise.all([
    supabase.from("profiles").select("phone").eq("id", appointment.patient_id).single(),
    supabase.from("profiles").select("full_name").eq("id", appointment.professional_id).single(),
    supabase.from("clinic_settings").select("name, whatsapp_number, address").eq("id", 1).single(),
  ]);

  const message = buildReminderMessage({
    professionalName: professionalProfile?.full_name ?? "",
    appointmentDate: appointment.appointment_date,
    startTime: appointment.start_time,
    clinicName: clinic?.name ?? "Clínica",
    clinicAddress: clinic?.address,
  });

  const whatsappLink = buildWhatsAppLink(patient?.phone, message);
  if (!whatsappLink) return { error: "Paciente sem telefone cadastrado." };

  return { error: null, whatsappLink };
}

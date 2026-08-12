"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildBookingMessage,
  buildCancellationMessage,
  buildConfirmationMessage,
  buildRejectionMessage,
  buildReminderMessage,
  buildStaffBookingConfirmationMessage,
  buildWhatsAppLink,
} from "@/lib/whatsapp";
import { logAudit } from "@/modules/team/services/audit";
import { notify, notifyStaff } from "@/modules/notifications/services/notify";
import { logPatientMessage } from "@/modules/patients/services/message-log";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyWaitlistMatches } from "@/modules/waitlist/services/waitlist-actions";
import { getAvailableTimes, getCoTherapistsForAppointment, resolveAppointmentValue } from "./booking-queries";
import type { Modality, ParticularProduct, PaymentMethod } from "@/lib/supabase/types";

/** Notifica a lista de espera para cada profissional envolvido na consulta
 * (principal + coterapeutas) — cancelar um atendimento compartilhado libera
 * a vaga na agenda de todos eles, não só do principal. */
async function notifyWaitlistForAllInvolved(params: {
  appointmentId: string;
  specialtyId: string | null;
  principalProfessionalId: string;
  insuranceId: string;
  modality: Modality | null;
  appointmentDate: string;
  startTime: string;
}) {
  const coTherapists = await getCoTherapistsForAppointment(params.appointmentId);
  const professionalIds = [params.principalProfessionalId, ...coTherapists.map((c) => c.professionalId)];

  for (const professionalId of professionalIds) {
    await notifyWaitlistMatches({
      specialtyId: params.specialtyId,
      professionalId,
      insuranceId: params.insuranceId,
      modality: params.modality,
      appointmentDate: params.appointmentDate,
      startTime: params.startTime,
    });
  }
}

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
  modality?: Modality;
  particularProduct?: ParticularProduct;
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
  const pricing = await resolveAppointmentValue(
    input.professionalId,
    input.insuranceId,
    input.modality,
    input.particularProduct,
  );
  if (pricing.value == null) {
    return { error: pricing.error ?? "Não foi possível calcular o valor da consulta." };
  }

  // Revalida a disponibilidade no servidor antes de gravar (evita duplo agendamento).
  const availableTimes = await getAvailableTimes(
    input.professionalId,
    input.insuranceId,
    input.date,
    input.modality,
  );
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
      modality: input.modality ?? null,
      particular_product: input.particularProduct ?? null,
      status: "pendente",
      source: "paciente",
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
      supabase.from("clinic_settings").select("name, whatsapp_number").eq("id", 1).single(),
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
    modality: input.modality,
    particularProduct: input.particularProduct,
    clinicName: clinic?.name,
  });

  const whatsappLink = buildWhatsAppLink(clinic?.whatsapp_number, message);

  await notifyStaff({
    type: "appointment.pending",
    title: "Nova consulta pendente",
    message: `${session.profile.full_name} agendou com ${professionalProfile?.full_name ?? "um profissional"} para ${input.date} às ${input.startTime.slice(0, 5)}.`,
    entity: "appointments",
    entityId: appointment.id,
  });

  await logPatientMessage({ patientId: session.user.id, appointmentId: appointment.id, type: "booking", sentBy: session.user.id });

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
    .select("appointment_date, start_time, professional_id, specialty_id, insurance_id, modality")
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

  if (appointment && !rescheduled) {
    await notifyWaitlistForAllInvolved({
      appointmentId,
      specialtyId: appointment.specialty_id,
      principalProfessionalId: appointment.professional_id,
      insuranceId: appointment.insurance_id,
      modality: appointment.modality,
      appointmentDate: appointment.appointment_date,
      startTime: appointment.start_time,
    });
  }

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
    supabase.from("clinic_settings").select("name, whatsapp_number").eq("id", 1).single(),
  ]);

  const message = buildCancellationMessage({
    patientName: session.profile.full_name,
    professionalName: professionalProfile?.full_name ?? "",
    appointmentDate: appointment.appointment_date,
    startTime: appointment.start_time,
    rescheduled,
    clinicName: clinic?.name,
  });

  const whatsappLink = buildWhatsAppLink(clinic?.whatsapp_number, message);

  await logPatientMessage({
    patientId: session.user.id,
    appointmentId,
    type: "cancellation",
    sentBy: session.user.id,
  });

  return { error: null, whatsappLink };
}

/** Confirma uma consulta e gera o lançamento financeiro correspondente.
 *
 * Decisão de financeiro em atendimento compartilhado (confirmada — revisar
 * com a clínica antes de operar com dados reais de pagamento): o lançamento
 * é criado só para o profissional principal (`appointment.professional_id`).
 * Um coterapeuta vinculado via `appointment_professionals` (0036) registra a
 * própria evolução clínica (0037), mas não gera lançamento financeiro
 * próprio — não há split de valor nem duplicação de lançamento por
 * profissional envolvido. Esse é o comportamento já implementado desde a
 * Fase 2 de atendimento compartilhado, mantido como está por ora. */
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
    modality: appointment.modality,
    particular_product: appointment.particular_product,
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
    clinicName: clinic?.name ?? "Espaço Zoe",
    clinicAddress: clinic?.address,
    value: appointment.value,
    clinicPhone: clinic?.whatsapp_number,
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

  await logPatientMessage({
    patientId: appointment.patient_id,
    appointmentId,
    type: "confirmation",
    sentBy: session.user.id,
  });

  return { error: null, whatsappLink };
}

export async function rejectAppointmentRequest(
  appointmentId: string,
): Promise<{ error: string | null; whatsappLink?: string | null }> {
  const session = await requireStaff();
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (!appointment) return { error: "Solicitação não encontrada." };

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "recusada" })
    .eq("id", appointmentId);

  if (updateError) return { error: "Não foi possível recusar a solicitação." };

  await logAudit({
    actorId: session.user.id,
    action: "appointment.rejected",
    entity: "appointments",
    entityId: appointmentId,
  });

  const [{ data: patient }, { data: professionalProfile }, { data: clinic }] = await Promise.all([
    supabase.from("profiles").select("phone").eq("id", appointment.patient_id).single(),
    supabase.from("profiles").select("full_name").eq("id", appointment.professional_id).single(),
    supabase.from("clinic_settings").select("name, whatsapp_number").eq("id", 1).single(),
  ]);

  const message = buildRejectionMessage({
    professionalName: professionalProfile?.full_name ?? "",
    appointmentDate: appointment.appointment_date,
    startTime: appointment.start_time,
    clinicName: clinic?.name ?? "Espaço Zoe",
    clinicPhone: clinic?.whatsapp_number,
  });

  const whatsappLink = buildWhatsAppLink(patient?.phone, message);

  await notify({
    userId: appointment.patient_id,
    type: "appointment.rejected",
    title: "Solicitação não aprovada",
    message: `Sua solicitação de consulta com ${professionalProfile?.full_name ?? "o profissional"} em ${appointment.appointment_date} às ${appointment.start_time.slice(0, 5)} não foi aprovada. Entre em contato com a clínica para mais informações.`,
    entity: "appointments",
    entityId: appointmentId,
  });

  await logPatientMessage({
    patientId: appointment.patient_id,
    appointmentId,
    type: "rejection",
    sentBy: session.user.id,
  });

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
    .select("patient_id, appointment_date, start_time, professional_id, specialty_id, insurance_id, modality")
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

  if (appointment && status === "cancelada") {
    await notifyWaitlistForAllInvolved({
      appointmentId,
      specialtyId: appointment.specialty_id,
      principalProfessionalId: appointment.professional_id,
      insuranceId: appointment.insurance_id,
      modality: appointment.modality,
      appointmentDate: appointment.appointment_date,
      startTime: appointment.start_time,
    });
  }

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
  const session = await requireStaff();
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
    clinicName: clinic?.name ?? "Espaço Zoe",
    clinicAddress: clinic?.address,
    clinicPhone: clinic?.whatsapp_number,
  });

  const whatsappLink = buildWhatsAppLink(patient?.phone, message);
  if (!whatsappLink) return { error: "Paciente sem telefone cadastrado." };

  await supabase.from("appointments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", appointmentId);

  await logPatientMessage({
    patientId: appointment.patient_id,
    appointmentId,
    type: "reminder",
    sentBy: session.user.id,
  });

  return { error: null, whatsappLink };
}

export interface CreateAppointmentForPatientInput {
  patientId: string;
  professionalId: string;
  specialtyId: string;
  insuranceId: string;
  scheduleSlotId: string;
  date: string;
  startTime: string;
  endTime: string;
  paymentMethod: PaymentMethod;
  modality?: Modality;
  particularProduct?: ParticularProduct;
}

/** Agendamento avulso criado pela recepção/admin para um paciente já
 * cadastrado (fluxo "agendamento mais rápido") — não cria conta nova, só usa
 * o patientId selecionado. Não gera nem edita recorrência (isso é
 * responsabilidade de createRecurringAppointments, em recurrence-actions). */
export async function createAppointmentForPatient(
  input: CreateAppointmentForPatientInput,
): Promise<{ error: string | null; whatsappLink?: string | null; appointmentId?: string }> {
  const session = await requireStaff();

  const rateLimit = checkRateLimit(`staff-booking:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const pricing = await resolveAppointmentValue(
    input.professionalId,
    input.insuranceId,
    input.modality,
    input.particularProduct,
  );
  if (pricing.value == null) {
    return { error: pricing.error ?? "Não foi possível calcular o valor da consulta." };
  }

  const availableTimes = await getAvailableTimes(
    input.professionalId,
    input.insuranceId,
    input.date,
    input.modality,
  );
  const stillAvailable = availableTimes.some(
    (slot) => slot.slotId === input.scheduleSlotId && slot.startTime === input.startTime,
  );
  if (!stillAvailable) {
    return { error: "Esse horário não está mais disponível. Escolha outro." };
  }

  const admin = createAdminClient();
  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      patient_id: input.patientId,
      professional_id: input.professionalId,
      specialty_id: input.specialtyId,
      insurance_id: input.insuranceId,
      schedule_slot_id: input.scheduleSlotId,
      appointment_date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      payment_method: input.paymentMethod,
      value: pricing.value,
      modality: input.modality ?? null,
      particular_product: input.particularProduct ?? null,
      status: "pendente",
      source: "staff",
    })
    .select("id")
    .single();

  if (error || !appointment) {
    return { error: "Não foi possível criar o agendamento. Tente novamente." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "appointment.created_by_staff",
    entity: "appointments",
    entityId: appointment.id,
    metadata: { professionalId: input.professionalId, date: input.date, startTime: input.startTime },
  });

  const [{ data: patient }, { data: professionalProfile }, { data: clinic }] = await Promise.all([
    admin.from("profiles").select("full_name, phone").eq("id", input.patientId).single(),
    admin.from("profiles").select("full_name").eq("id", input.professionalId).single(),
    admin.from("clinic_settings").select("name, whatsapp_number").eq("id", 1).single(),
  ]);

  // Dirigida ao paciente (não à clínica) — confirma o agendamento manual
  // criado pela recepção/admin no painel.
  const message = buildStaffBookingConfirmationMessage({
    patientName: patient?.full_name ?? "",
    professionalName: professionalProfile?.full_name ?? "",
    appointmentDate: input.date,
    startTime: input.startTime,
    clinicName: clinic?.name ?? "Espaço Zoe",
    clinicPhone: clinic?.whatsapp_number,
  });

  const whatsappLink = buildWhatsAppLink(patient?.phone, message);

  await logPatientMessage({ patientId: input.patientId, appointmentId: appointment.id, type: "booking", sentBy: session.user.id });

  return { error: null, whatsappLink, appointmentId: appointment.id };
}

/** Admin, recepção ou o profissional principal podem adicionar um
 * coterapeuta a uma consulta (decisão de negócio confirmada — atendimento
 * compartilhado, Fase 2). Reaproveita getAvailableTimes para garantir que o
 * profissional adicionado realmente tem disponibilidade nesse horário
 * (mesma checagem usada para criar uma consulta nova). */
export async function addCoTherapist(
  appointmentId: string,
  professionalId: string,
): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, professional_id, appointment_date, start_time, insurance_id, modality, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) return { error: "Consulta não encontrada." };

  const isPrincipal = appointment.professional_id === session.user.id;
  const isStaff = ["admin", "recepcionista"].includes(session.profile.role);
  if (!isPrincipal && !isStaff) {
    return { error: "Só o profissional principal ou a equipe podem adicionar um coterapeuta." };
  }

  if (professionalId === appointment.professional_id) {
    return { error: "Este profissional já é o principal desta consulta." };
  }

  const availableTimes = await getAvailableTimes(
    professionalId,
    appointment.insurance_id,
    appointment.appointment_date,
    appointment.modality ?? undefined,
  );
  const isAvailable = availableTimes.some((t) => t.startTime === appointment.start_time.slice(0, 5));
  if (!isAvailable) {
    return { error: "Este profissional não tem disponibilidade nesse horário." };
  }

  const { error } = await supabase
    .from("appointment_professionals")
    .insert({ appointment_id: appointmentId, professional_id: professionalId, created_by: session.user.id });

  if (error) {
    const message =
      error.code === "23505" ? "Este profissional já está vinculado a esta consulta." : "Não foi possível adicionar o coterapeuta.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "appointment.cotherapist.added",
    entity: "appointment_professionals",
    entityId: appointmentId,
    metadata: { appointment_id: appointmentId, professional_id: professionalId },
  });

  return { error: null };
}

/** Remove um coterapeuta da consulta. A trigger
 * appointment_professionals_prevent_delete_with_evolution (0036) bloqueia a
 * remoção se ele já tiver registrado evolução — aqui só traduzimos a
 * mensagem de erro do banco para algo amigável. */
export async function removeCoTherapist(
  appointmentId: string,
  professionalId: string,
): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("professional_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) return { error: "Consulta não encontrada." };

  const isPrincipal = appointment.professional_id === session.user.id;
  const isStaff = ["admin", "recepcionista"].includes(session.profile.role);
  if (!isPrincipal && !isStaff) {
    return { error: "Só o profissional principal ou a equipe podem remover um coterapeuta." };
  }

  const { error } = await supabase
    .from("appointment_professionals")
    .delete()
    .eq("appointment_id", appointmentId)
    .eq("professional_id", professionalId);

  if (error) {
    const message = error.message.includes("já registrou evolução")
      ? "Não é possível remover: este profissional já registrou evolução para esta consulta."
      : "Não foi possível remover o coterapeuta.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "appointment.cotherapist.removed",
    entity: "appointment_professionals",
    entityId: appointmentId,
    metadata: { appointment_id: appointmentId, professional_id: professionalId },
  });

  return { error: null };
}


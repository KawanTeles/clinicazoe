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
import { cancelFinancialEntryForAppointment } from "@/modules/financial/services/financial-actions";
import { getAvailableTimes, getCoTherapistsForAppointment, resolveAppointmentValue } from "./booking-queries";
import { isPatientConflictError, isSlotFullError } from "./booking-errors";
import {
  getAppointmentsForViewer,
  type AppointmentStatusFilter,
  type AppointmentView,
} from "./appointment-queries";
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
    return { error: pricing.error ?? "Não foi possível calcular o valor do atendimento." };
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

  // Grava via RPC (book_appointment, migração 0066) em vez de INSERT direto:
  // a checagem de capacidade + o INSERT rodam atômicos no banco (lock por
  // profissional+data+horário), fechando a janela de corrida que a
  // pré-checagem acima (getAvailableTimes) sozinha não cobre.
  const { data: appointment, error } = await supabase.rpc("book_appointment", {
    p_patient_id: session.user.id,
    p_professional_id: input.professionalId,
    p_specialty_id: input.specialtyId,
    p_insurance_id: input.insuranceId,
    p_schedule_slot_id: input.scheduleSlotId,
    p_appointment_date: input.date,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_payment_method: input.paymentMethod,
    p_value: pricing.value,
    p_modality: input.modality ?? null,
    p_particular_product: input.particularProduct ?? null,
    p_source: "paciente",
  });

  if (error || !appointment) {
    if (isSlotFullError(error)) {
      return { error: "Esse horário acabou de ser ocupado por outra pessoa. Escolha outro horário." };
    }
    if (isPatientConflictError(error)) {
      return { error: "Você já tem outro atendimento marcado nesse horário." };
    }
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
    paymentMethod: input.paymentMethod,
    modality: input.modality,
    particularProduct: input.particularProduct,
    clinicName: clinic?.name,
  });

  const whatsappLink = buildWhatsAppLink(clinic?.whatsapp_number, message);

  await notifyStaff({
    type: "appointment.pending",
    title: "Novo atendimento pendente",
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

  if (error) return { error: "Não foi possível cancelar o atendimento." };

  if (!rescheduled) {
    await cancelFinancialEntryForAppointment(appointmentId);
  }

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
    title: rescheduled ? "Atendimento será remarcado pelo paciente" : "Atendimento cancelado pelo paciente",
    message: `${session.profile.full_name} — atendimento de ${appointment.appointment_date} às ${appointment.start_time.slice(0, 5)}.`,
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

  if (!appointment) return { error: "Atendimento não encontrado." };

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "confirmada" })
    .eq("id", appointmentId);

  if (updateError) return { error: "Não foi possível confirmar o atendimento." };

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
    return { error: "Atendimento confirmado, mas houve falha ao gerar o lançamento financeiro." };
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
    clinicPhone: clinic?.whatsapp_number,
  });

  const whatsappLink = buildWhatsAppLink(patient?.phone, message);

  await Promise.all([
    notify({
      userId: appointment.patient_id,
      type: "appointment.confirmed",
      title: "Atendimento confirmado",
      message: `Seu atendimento com ${professionalProfile?.full_name ?? "o profissional"} em ${appointment.appointment_date} às ${appointment.start_time.slice(0, 5)} foi confirmado.`,
      entity: "appointments",
      entityId: appointmentId,
    }),
    notify({
      userId: appointment.professional_id,
      type: "appointment.confirmed",
      title: "Novo atendimento confirmado na sua agenda",
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
    message: `Sua solicitação de atendimento com ${professionalProfile?.full_name ?? "o profissional"} em ${appointment.appointment_date} às ${appointment.start_time.slice(0, 5)} não foi aprovada. Entre em contato com a clínica para mais informações.`,
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
  cancelada: "cancelado",
  remarcada: "remarcado",
  concluida: "concluído",
  faltou: "marcado como falta",
};

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "cancelada" | "remarcada" | "concluida" | "faltou" | "faltou_justificada",
  reason?: string,
): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session) throw new Error("Acesso negado.");

  const isStaff = ["admin", "recepcionista"].includes(session.profile.role);
  const isProfessional = session.profile.role === "profissional";
  if (!isStaff && !isProfessional) {
    throw new Error("Acesso negado.");
  }

  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("patient_id, appointment_date, start_time, professional_id, specialty_id, insurance_id, modality")
    .eq("id", appointmentId)
    .single();

  const isAbsenceStatus = status === "faltou" || status === "faltou_justificada";

  // Profissional só pode marcar falta no próprio atendimento — qualquer
  // outra transição (cancelar/remarcar/concluir) continua exclusiva de
  // admin/recepcionista. A RLS (prevent_appointment_tampering, migração
  // 0064) reforça a mesma regra no banco caso algo escape daqui.
  if (isProfessional && (!isAbsenceStatus || appointment?.professional_id !== session.user.id)) {
    return { error: "Você só pode marcar falta em atendimentos seus." };
  }

  if (status === "faltou_justificada" && !reason?.trim()) {
    return { error: "Informe o motivo da falta justificada." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status, absence_reason: isAbsenceStatus ? reason?.trim() || null : null })
    .eq("id", appointmentId);

  if (error) return { error: "Não foi possível atualizar o atendimento." };

  if (status === "cancelada") {
    await cancelFinancialEntryForAppointment(appointmentId);
  }

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
      title: `Atendimento ${STATUS_LABELS[status]}`,
      message: `Seu atendimento de ${appointment.appointment_date} às ${appointment.start_time.slice(0, 5)} foi ${STATUS_LABELS[status]} pela clínica.`,
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

  if (!appointment) return { error: "Atendimento não encontrado." };

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
    return { error: pricing.error ?? "Não foi possível calcular o valor do atendimento." };
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
  // Grava via RPC (book_appointment, migração 0066) em vez de INSERT direto
  // — ver comentário equivalente em createAppointment, acima.
  const { data: appointment, error } = await admin.rpc("book_appointment", {
    p_patient_id: input.patientId,
    p_professional_id: input.professionalId,
    p_specialty_id: input.specialtyId,
    p_insurance_id: input.insuranceId,
    p_schedule_slot_id: input.scheduleSlotId,
    p_appointment_date: input.date,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_payment_method: input.paymentMethod,
    p_value: pricing.value,
    p_modality: input.modality ?? null,
    p_particular_product: input.particularProduct ?? null,
    p_source: "staff",
  });

  if (error || !appointment) {
    if (isSlotFullError(error)) {
      return { error: "Esse horário acabou de ser ocupado por outra pessoa. Escolha outro horário." };
    }
    if (isPatientConflictError(error)) {
      return { error: "Este paciente já tem outro atendimento marcado nesse horário." };
    }
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

export interface GroupParticipantInput {
  patientId: string;
  insuranceId: string;
  paymentMethod: PaymentMethod;
  modality?: Modality;
  particularProduct?: ParticularProduct;
}

export interface CreateGroupAppointmentInput {
  principalProfessionalId: string;
  /** Vazio = grupo simples com 1 profissional só (N pacientes). */
  coTherapistProfessionalIds: string[];
  specialtyId?: string;
  scheduleSlotId: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Mínimo 1 — cada paciente aparece no máximo uma vez (multi-profissional
   * para o mesmo paciente é resolvido com coterapeutas, não com uma segunda
   * linha). */
  participants: GroupParticipantInput[];
}

/** Cria um "atendimento conjugado" (dupla/grupo/multidisciplinar): uma
 * âncora appointment_groups + uma linha de appointments por participante
 * (via book_appointment, migração 0067, mesmo lock atômico do fluxo simples)
 * + coterapeutas vinculados a TODAS as linhas do grupo — é isso que faz
 * "grupo coletivo sem dono" funcionar (qualquer profissional do grupo
 * documenta/marca falta de qualquer paciente do grupo) e dá visibilidade
 * cruzada entre participantes de graça via is_appointment_cotherapist
 * (migração 0040), sem precisar de RLS nova em appointments.
 *
 * Staff-only, mesmo padrão de createAppointmentForPatient — grupo também não
 * é self-service. Não é uma única transação Postgres (cada book_appointment
 * é sua própria chamada RPC): em caso de erro no meio do loop, o rollback é
 * compensatório (apaga o que já foi criado neste lote), não atômico entre
 * participantes. */
export async function createGroupAppointment(
  input: CreateGroupAppointmentInput,
): Promise<{
  error: string | null;
  groupId?: string;
  appointmentIds?: string[];
  whatsappLinks?: { patientId: string; whatsappLink: string | null }[];
}> {
  const session = await requireStaff();

  if (input.participants.length === 0) {
    return { error: "Selecione ao menos um paciente." };
  }

  const uniquePatientIds = new Set(input.participants.map((p) => p.patientId));
  if (uniquePatientIds.size !== input.participants.length) {
    return { error: "Cada paciente só pode aparecer uma vez nesta sessão." };
  }

  if (input.coTherapistProfessionalIds.includes(input.principalProfessionalId)) {
    return { error: "O profissional principal não pode ser adicionado também como coterapeuta." };
  }

  const rateLimit = checkRateLimit(`staff-booking:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  // Convênio/modalidade do primeiro participante usados como referência para
  // checar disponibilidade do principal e dos coterapeutas — limitação de v1
  // documentada no plano: se outro participante tiver convênio incompatível
  // com o slot, o erro só aparece no submit (na chamada de book_appointment
  // daquele participante), não antes.
  const representative = input.participants[0];

  const principalAvailability = await getAvailableTimes(
    input.principalProfessionalId,
    representative.insuranceId,
    input.date,
    representative.modality,
  );
  const principalSlotFree = principalAvailability.some(
    (slot) => slot.slotId === input.scheduleSlotId && slot.startTime === input.startTime,
  );
  if (!principalSlotFree) {
    return { error: "Esse horário não está mais disponível para o profissional principal." };
  }

  for (const coProfessionalId of input.coTherapistProfessionalIds) {
    const coAvailability = await getAvailableTimes(
      coProfessionalId,
      representative.insuranceId,
      input.date,
      representative.modality,
    );
    const coSlotFree = coAvailability.some((slot) => slot.startTime === input.startTime);
    if (!coSlotFree) {
      return { error: "Um dos profissionais adicionais não tem disponibilidade nesse horário." };
    }
  }

  const resolvedValues: number[] = [];
  for (const participant of input.participants) {
    const pricing = await resolveAppointmentValue(
      input.principalProfessionalId,
      participant.insuranceId,
      participant.modality,
      participant.particularProduct,
    );
    if (pricing.value == null) {
      return { error: pricing.error ?? "Não foi possível calcular o valor de um dos participantes." };
    }
    resolvedValues.push(pricing.value);
  }

  const admin = createAdminClient();

  const { data: group, error: groupError } = await admin
    .from("appointment_groups")
    .insert({
      appointment_date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (groupError || !group) {
    return { error: "Não foi possível criar a sessão conjugada." };
  }

  const createdAppointmentIds: string[] = [];

  for (let i = 0; i < input.participants.length; i++) {
    const participant = input.participants[i];
    const { data: appointment, error } = await admin.rpc("book_appointment", {
      p_patient_id: participant.patientId,
      p_professional_id: input.principalProfessionalId,
      p_specialty_id: input.specialtyId ?? null,
      p_insurance_id: participant.insuranceId,
      p_schedule_slot_id: input.scheduleSlotId,
      p_appointment_date: input.date,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
      p_payment_method: participant.paymentMethod,
      p_value: resolvedValues[i],
      p_modality: participant.modality ?? null,
      p_particular_product: participant.particularProduct ?? null,
      p_source: "staff",
      p_group_id: group.id,
    });

    if (error || !appointment) {
      if (createdAppointmentIds.length > 0) {
        await admin.from("appointments").delete().in("id", createdAppointmentIds);
      }
      await admin.from("appointment_groups").delete().eq("id", group.id);

      if (isSlotFullError(error)) {
        return { error: "O horário lotou no meio da criação da sessão. Tente novamente." };
      }
      if (isPatientConflictError(error)) {
        return { error: "Um dos pacientes já tem outro atendimento marcado nesse horário." };
      }
      return { error: "Não foi possível criar um dos atendimentos da sessão." };
    }

    createdAppointmentIds.push(appointment.id);
  }

  if (input.coTherapistProfessionalIds.length > 0) {
    const links = createdAppointmentIds.flatMap((appointmentId) =>
      input.coTherapistProfessionalIds.map((professionalId) => ({
        appointment_id: appointmentId,
        professional_id: professionalId,
        created_by: session.user.id,
      })),
    );
    const { error: linkError } = await admin.from("appointment_professionals").insert(links);
    if (linkError) {
      await admin.from("appointments").delete().in("id", createdAppointmentIds);
      await admin.from("appointment_groups").delete().eq("id", group.id);
      return { error: "Não foi possível vincular os profissionais adicionais à sessão." };
    }
  }

  await logAudit({
    actorId: session.user.id,
    action: "appointment.group.created",
    entity: "appointment_groups",
    entityId: group.id,
    metadata: {
      principalProfessionalId: input.principalProfessionalId,
      coTherapistProfessionalIds: input.coTherapistProfessionalIds,
      date: input.date,
      startTime: input.startTime,
      appointmentIds: createdAppointmentIds,
    },
  });

  const [{ data: professionalProfile }, { data: clinic }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", input.principalProfessionalId).single(),
    admin.from("clinic_settings").select("name, whatsapp_number").eq("id", 1).single(),
  ]);

  const whatsappLinks: { patientId: string; whatsappLink: string | null }[] = [];
  for (let i = 0; i < input.participants.length; i++) {
    const participant = input.participants[i];
    const { data: patient } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", participant.patientId)
      .single();

    const message = buildStaffBookingConfirmationMessage({
      patientName: patient?.full_name ?? "",
      professionalName: professionalProfile?.full_name ?? "",
      appointmentDate: input.date,
      startTime: input.startTime,
      clinicName: clinic?.name ?? "Espaço Zoe",
      clinicPhone: clinic?.whatsapp_number,
    });

    whatsappLinks.push({ patientId: participant.patientId, whatsappLink: buildWhatsAppLink(patient?.phone, message) });

    await logPatientMessage({
      patientId: participant.patientId,
      appointmentId: createdAppointmentIds[i],
      type: "booking",
      sentBy: session.user.id,
    });
  }

  return { error: null, groupId: group.id, appointmentIds: createdAppointmentIds, whatsappLinks };
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

  if (!appointment) return { error: "Atendimento não encontrado." };

  const isPrincipal = appointment.professional_id === session.user.id;
  const isStaff = ["admin", "recepcionista"].includes(session.profile.role);
  if (!isPrincipal && !isStaff) {
    return { error: "Só o profissional principal ou a equipe podem adicionar um coterapeuta." };
  }

  if (professionalId === appointment.professional_id) {
    return { error: "Este profissional já é o principal deste atendimento." };
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
      error.code === "23505" ? "Este profissional já está vinculado a este atendimento." : "Não foi possível adicionar o coterapeuta.";
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

  if (!appointment) return { error: "Atendimento não encontrado." };

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
      ? "Não é possível remover: este profissional já registrou evolução para este atendimento."
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

/** Marca falta (normal ou justificada) de um coterapeuta especificamente —
 * independente do status da linha principal de appointments, já que cada
 * profissional de uma sessão multidisciplinar pode ter comparecimento
 * diferente. Autoral, mesmo espírito de patient_evolutions: só o próprio
 * coterapeuta ou staff (admin/recepcionista) — decisão confirmada, o
 * profissional principal da sessão NÃO marca falta pelos outros. RLS
 * (appointment_professionals_update_absence, migração 0067) reforça a mesma
 * regra no banco. */
export async function markCoTherapistAbsence(
  appointmentId: string,
  professionalId: string,
  status: "faltou" | "faltou_justificada",
  reason?: string,
): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session) return { error: "Acesso negado." };

  const isStaff = ["admin", "recepcionista"].includes(session.profile.role);
  if (!isStaff && session.user.id !== professionalId) {
    return { error: "Você só pode marcar a própria falta." };
  }

  if (status === "faltou_justificada" && !reason?.trim()) {
    return { error: "Informe o motivo da falta justificada." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointment_professionals")
    .update({ absence_status: status, absence_reason: reason?.trim() || null })
    .eq("appointment_id", appointmentId)
    .eq("professional_id", professionalId);

  if (error) return { error: "Não foi possível registrar a falta." };

  await logAudit({
    actorId: session.user.id,
    action: "appointment.cotherapist.absence_marked",
    entity: "appointment_professionals",
    entityId: appointmentId,
    metadata: { appointment_id: appointmentId, professional_id: professionalId, status },
  });

  return { error: null };
}

/** Busca uma página de atendimentos já filtrada por status no banco, chamada
 * pelas abas de status em AppointmentsList — sem isso, a paginação era
 * calculada sobre o total bruto (sem filtro) e o filtro de status rodava só
 * no client em cima da página recebida, podendo mostrar "Nenhum atendimento
 * encontrado" mesmo com mais páginas disponíveis. */
export async function getAppointmentsPage(
  page: number,
  statusFilter: AppointmentStatusFilter,
): Promise<{ items: AppointmentView[]; totalPages: number }> {
  const session = await getCurrentUser();
  if (!session) return { items: [], totalPages: 1 };

  return getAppointmentsForViewer(session.profile.role, session.user.id, page, statusFilter);
}


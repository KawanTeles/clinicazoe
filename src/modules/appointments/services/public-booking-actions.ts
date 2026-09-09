"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestIp } from "@/lib/request-ip";
import { buildBookingMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { logAudit } from "@/modules/team/services/audit";
import { notifyStaff } from "@/modules/notifications/services/notify";
import { logPatientMessage } from "@/modules/patients/services/message-log";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAvailableTimes, resolveAppointmentValue } from "./booking-queries";
import type { Modality, ParticularProduct, PaymentMethod } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof createAdminClient>;

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Procura um paciente já cadastrado pelo telefone (compara os dígitos
 * normalizados, já que o telefone pode estar salvo com formatação diferente
 * em profiles.phone ou patient_details.whatsapp) antes de criar um novo
 * usuário — evita duplicar o cadastro quando a mesma pessoa agenda mais de
 * uma vez pelo site sem conta. Varre toda a base de pacientes (escala de
 * clínica pequena/média, mesmo padrão de esforço de searchPatientsForBooking
 * em patient-actions.ts) em vez de tentar um filtro `ilike` — o telefone
 * salvo pode ter pontuação que quebraria uma busca por substring nos dígitos
 * puros. */
async function findExistingPatientIdByPhone(admin: AdminClient, phone: string): Promise<string | null> {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;

  const [{ data: profiles }, { data: details }] = await Promise.all([
    admin.from("profiles").select("id, phone").eq("role", "paciente"),
    admin.from("patient_details").select("id, whatsapp"),
  ]);

  const byProfile = (profiles ?? []).find((p) => p.phone && normalizePhoneDigits(p.phone) === digits);
  if (byProfile) return byProfile.id;

  const byDetails = (details ?? []).find((d) => d.whatsapp && normalizePhoneDigits(d.whatsapp) === digits);
  return byDetails?.id ?? null;
}

/** Acha o paciente pelo telefone ou cria um novo usuário Auth sem senha
 * (mesmo padrão de createPatient em patients/services/patient-actions.ts,
 * usado pela recepção) — marca password_pending=true só nesse caso, que é o
 * que autoriza claimPublicPatientAccount a definir a senha depois sem
 * sessão. Paciente reaproveitado por dedup não tem esse campo alterado. */
async function findOrCreatePublicPatient(
  admin: AdminClient,
  patient: { fullName: string; phone: string; email?: string },
): Promise<{ patientId: string; error: string | null }> {
  const existingId = await findExistingPatientIdByPhone(admin, patient.phone);
  if (existingId) return { patientId: existingId, error: null };

  const email = patient.email?.trim();
  if (email && !validateEmail(email)) return { patientId: "", error: "E-mail inválido." };

  const loginEmail = email && email.includes("@") ? email : `paciente_${Date.now()}@clinicazoe.com.br`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginEmail,
    email_confirm: true,
    user_metadata: { full_name: patient.fullName.trim() },
    app_metadata: { role: "paciente" },
  });

  if (createError || !created?.user) {
    const message = createError?.message.includes("already been registered")
      ? "Já existe um cadastro com esse e-mail. Tente novamente informando o telefone usado anteriormente."
      : "Não foi possível concluir o cadastro. Tente novamente.";
    return { patientId: "", error: message };
  }

  const patientId = created.user.id;

  await admin
    .from("profiles")
    .update({ phone: patient.phone.trim() || null, password_pending: true })
    .eq("id", patientId);

  await admin.from("patient_details").insert({
    id: patientId,
    whatsapp: patient.phone.trim() || null,
    email: email || null,
  });

  return { patientId, error: null };
}

export interface CreatePublicAppointmentInput {
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
  patient: {
    fullName: string;
    phone: string;
    email?: string;
  };
}

/** Equivalente público de createAppointment (booking-actions.ts): mesma
 * revalidação de preço/disponibilidade no servidor, mas sem sessão — grava
 * com createAdminClient() (service role, bypassa RLS) e source="site_publico"
 * para um patientId achado/criado por findOrCreatePublicPatient. Não
 * enfraquece nenhuma policy: appointments_insert_patient_own continua
 * exigindo sessão própria para quem tenta inserir via client autenticado. */
export async function createPublicAppointment(
  input: CreatePublicAppointmentInput,
): Promise<{ error: string | null; whatsappLink?: string | null; patientId?: string; appointmentId?: string }> {
  if (!input.patient.fullName.trim() || !input.patient.phone.trim()) {
    return { error: "Nome e WhatsApp são obrigatórios." };
  }

  const ip = (await getRequestIp()) ?? "unknown";
  const rateLimit = checkRateLimit(`public-booking:${ip}`, 5, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const admin = createAdminClient();

  const { patientId, error: patientError } = await findOrCreatePublicPatient(admin, input.patient);
  if (patientError) return { error: patientError };

  // Nunca confia no valor vindo do client: recalcula a partir da precificação real.
  const pricing = await resolveAppointmentValue(
    input.professionalId,
    input.insuranceId,
    input.modality,
    input.particularProduct,
    true,
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
    true,
  );
  const stillAvailable = availableTimes.some(
    (slot) => slot.slotId === input.scheduleSlotId && slot.startTime === input.startTime,
  );
  if (!stillAvailable) {
    return { error: "Esse horário não está mais disponível. Escolha outro." };
  }

  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      patient_id: patientId,
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
      source: "site_publico",
    })
    .select("id")
    .single();

  if (error || !appointment) {
    return { error: "Não foi possível criar o agendamento. Tente novamente." };
  }

  await logAudit({
    actorId: patientId,
    action: "appointment.created",
    entity: "appointments",
    entityId: appointment.id,
    metadata: {
      professionalId: input.professionalId,
      date: input.date,
      startTime: input.startTime,
      source: "site_publico",
    },
  });

  const [{ data: professional }, { data: specialty }, { data: insurance }, { data: clinic }, { data: professionalProfile }] =
    await Promise.all([
      admin.from("professionals").select("id").eq("id", input.professionalId).single(),
      admin.from("specialties").select("name").eq("id", input.specialtyId).single(),
      admin.from("insurances").select("name").eq("id", input.insuranceId).single(),
      admin.from("clinic_settings").select("name, whatsapp_number").eq("id", 1).single(),
      admin.from("profiles").select("full_name").eq("id", input.professionalId).single(),
    ]);

  if (!professional) {
    return { error: null, whatsappLink: null, patientId, appointmentId: appointment.id };
  }

  const message = buildBookingMessage({
    patientName: input.patient.fullName,
    patientPhone: input.patient.phone,
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
    title: "Novo atendimento pendente (site)",
    message: `${input.patient.fullName} agendou pelo site com ${professionalProfile?.full_name ?? "um profissional"} para ${input.date} às ${input.startTime.slice(0, 5)}.`,
    entity: "appointments",
    entityId: appointment.id,
  });

  await logPatientMessage({ patientId, appointmentId: appointment.id, type: "booking", sentBy: patientId });

  return { error: null, whatsappLink, patientId, appointmentId: appointment.id };
}

export interface ClaimPublicPatientAccountInput {
  patientId: string;
  appointmentId: string;
  email: string;
  password: string;
}

/** Define a senha (e opcionalmente troca o e-mail sintético pelo real) de um
 * paciente criado pelo agendamento público, sem exigir sessão — a
 * autorização vem de duas checagens: (1) existe um agendamento desse
 * patientId, com esse appointmentId, criado nos últimos 30 minutos (amarra o
 * claim a um agendamento real e recente, não a um patientId arbitrário); (2)
 * profiles.password_pending está true e account_claimed_at ainda é nulo
 * (só true para contas criadas sem senha por este mesmo fluxo — contas com
 * senha própria, inclusive Google, têm password_pending=false por padrão e
 * nunca podem ser "reclamadas" por aqui). */
export async function claimPublicPatientAccount(
  input: ClaimPublicPatientAccountInput,
): Promise<{ error: string | null }> {
  const email = input.email.trim();
  if (!validateEmail(email)) return { error: "E-mail inválido." };
  if (input.password.length < 6) return { error: "A senha precisa ter pelo menos 6 caracteres." };

  const ip = (await getRequestIp()) ?? "unknown";
  const rateLimit = checkRateLimit(`claim-public-account:${ip}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const admin = createAdminClient();

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: appointment } = await admin
    .from("appointments")
    .select("id")
    .eq("id", input.appointmentId)
    .eq("patient_id", input.patientId)
    .gte("created_at", thirtyMinutesAgo)
    .maybeSingle();

  if (!appointment) {
    return { error: "Não foi possível confirmar o agendamento para criar o acesso." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("password_pending, account_claimed_at")
    .eq("id", input.patientId)
    .single();

  if (!profile?.password_pending || profile.account_claimed_at) {
    return { error: "Esta conta já foi configurada. Faça login normalmente." };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(input.patientId, {
    email,
    password: input.password,
    email_confirm: true,
  });

  if (updateError) {
    const message = updateError.message.includes("already been registered")
      ? "Já existe uma conta com esse e-mail."
      : "Não foi possível criar o acesso. Tente novamente.";
    return { error: message };
  }

  await admin.from("patient_details").update({ email }).eq("id", input.patientId);
  await admin
    .from("profiles")
    .update({ password_pending: false, account_claimed_at: new Date().toISOString() })
    .eq("id", input.patientId);

  return { error: null };
}

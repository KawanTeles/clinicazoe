"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildRescheduleMessage, buildStaffBookingConfirmationMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { logAudit } from "@/modules/team/services/audit";
import { notify, notifyStaff } from "@/modules/notifications/services/notify";
import { logPatientMessage } from "@/modules/patients/services/message-log";
import type { Database, Modality, ParticularProduct, PaymentMethod, RecurrenceFrequency } from "@/lib/supabase/types";
import { toLocalIsoDate, todayLocalIso } from "@/lib/date";
import { getAvailableTimes, resolveAppointmentValue } from "./booking-queries";
import { generateOccurrenceDates, WEEKDAY_LABELS } from "./recurrence-generator";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

async function requireStaff() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) {
    throw new Error("Acesso negado.");
  }
  return session;
}

async function requireAdmin() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Admin/recepcionista sempre podem gerenciar; profissional só a própria
 * série (e nunca cria/exclui, só edita dia/horário — reforçado também por
 * RLS/trigger no banco). */
export async function requireCanManageSeries(seriesId: string) {
  const session = await getCurrentUser();
  if (!session) throw new Error("Acesso negado.");

  if (["admin", "recepcionista"].includes(session.profile.role)) return session;

  if (session.profile.role === "profissional") {
    const supabase = await createClient();
    const { data: series } = await supabase
      .from("appointment_series")
      .select("professional_id")
      .eq("id", seriesId)
      .single();
    if (series?.professional_id === session.user.id) return session;
  }

  throw new Error("Acesso negado.");
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalIsoDate(d);
}

export interface OccurrencePreview {
  date: string;
  available: boolean;
  reason?: string;
  slotId?: string;
  endTime?: string;
}

export interface RecurringBookingInput {
  patientId: string;
  professionalId: string;
  specialtyId: string;
  insuranceId: string;
  paymentMethod: PaymentMethod;
  modality?: Modality;
  particularProduct?: ParticularProduct;
  dayOfWeek: number;
  startTime: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
  notes?: string;
}

async function buildPreview(
  professionalId: string,
  insuranceId: string,
  dates: string[],
  startTime: string,
  modality?: Modality,
): Promise<OccurrencePreview[]> {
  // Uma consulta ao banco por data candidata — roda em paralelo, senão uma
  // recorrência sem data final (até 12 meses ~52 datas) demora dezenas de
  // segundos rodando sequencialmente.
  return Promise.all(
    dates.map(async (date): Promise<OccurrencePreview> => {
      const availableTimes = await getAvailableTimes(professionalId, insuranceId, date, modality);
      const match = availableTimes.find((t) => t.startTime === startTime);
      return match
        ? { date, available: true, slotId: match.slotId, endTime: match.endTime }
        : { date, available: false, reason: "Horário indisponível (bloqueio, feriado ou conflito)." };
    }),
  );
}

export async function previewRecurringAppointments(
  input: RecurringBookingInput,
): Promise<{ error: string | null; occurrences?: OccurrencePreview[] }> {
  await requireStaff();

  if (!input.patientId || !input.professionalId || !input.insuranceId) {
    return { error: "Preencha paciente, profissional e convênio." };
  }

  const dates = generateOccurrenceDates({
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    frequency: input.frequency,
    dayOfWeek: input.dayOfWeek,
    maxOccurrences: input.maxOccurrences ?? null,
  });

  if (dates.length === 0) {
    return { error: "Nenhuma data gerada para esses parâmetros. Revise dia da semana e datas." };
  }

  const occurrences = await buildPreview(input.professionalId, input.insuranceId, dates, input.startTime, input.modality);
  return { error: null, occurrences };
}

export interface CreateRecurringInput extends RecurringBookingInput {
  skipDates: string[];
  /** Para datas em conflito onde o staff escolheu "outro horário" em vez de
   * ignorar — mapa data (YYYY-MM-DD) -> horário alternativo (HH:MM). */
  overrides?: Record<string, string>;
}

interface ResolvedOccurrence {
  date: string;
  startTime: string;
  endTime: string;
  slotId: string;
}

/** Resolve a lista final de ocorrências a criar: ignora as em skipDates,
 * usa o horário alternativo escolhido para as que têm override (revalidando
 * a disponibilidade desse horário específico), e usa o horário padrão para
 * as demais que já estavam disponíveis no preview. */
async function resolveOccurrences(
  professionalId: string,
  insuranceId: string,
  defaultStartTime: string,
  occurrences: OccurrencePreview[],
  skipDates: string[],
  overrides?: Record<string, string>,
  modality?: Modality,
): Promise<ResolvedOccurrence[]> {
  const skip = new Set(skipDates);
  const resolved: ResolvedOccurrence[] = [];

  for (const occ of occurrences) {
    if (skip.has(occ.date)) continue;

    const overrideTime = overrides?.[occ.date];
    if (overrideTime) {
      const altTimes = await getAvailableTimes(professionalId, insuranceId, occ.date, modality);
      const match = altTimes.find((t) => t.startTime === overrideTime);
      if (match) resolved.push({ date: occ.date, startTime: match.startTime, endTime: match.endTime, slotId: match.slotId });
      continue;
    }

    if (occ.available) {
      resolved.push({ date: occ.date, startTime: defaultStartTime, endTime: occ.endTime!, slotId: occ.slotId! });
    }
  }

  return resolved;
}

export async function createRecurringAppointments(
  input: CreateRecurringInput,
): Promise<{ error: string | null; seriesId?: string; createdCount?: number; whatsappLink?: string | null }> {
  const session = await requireStaff();

  const rateLimit = checkRateLimit(`create-recurring:${session.user.id}`, 10, 60_000);
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
  const appointmentValue = pricing.value;

  const preview = await previewRecurringAppointments(input);
  if (preview.error || !preview.occurrences) {
    return { error: preview.error ?? "Não foi possível gerar as datas." };
  }

  const toCreate = await resolveOccurrences(
    input.professionalId,
    input.insuranceId,
    input.startTime,
    preview.occurrences,
    input.skipDates,
    input.overrides,
    input.modality,
  );
  if (toCreate.length === 0) return { error: "Nenhuma data disponível para criar." };

  // Só staff chega aqui (requireStaff já validou) — usa service role porque
  // não existe policy de INSERT em appointments para admin/recepcionista
  // (só para o próprio paciente), mesmo padrão de createAppointmentForPatient.
  const supabase = createAdminClient();

  const defaultEndTime = preview.occurrences.find((o) => o.available)?.endTime ?? toCreate[0].endTime;

  const { data: series, error: seriesError } = await supabase
    .from("appointment_series")
    .insert({
      patient_id: input.patientId,
      professional_id: input.professionalId,
      specialty_id: input.specialtyId || null,
      insurance_id: input.insuranceId,
      payment_method: input.paymentMethod,
      modality: input.modality ?? null,
      particular_product: input.particularProduct ?? null,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: defaultEndTime,
      frequency: input.frequency,
      start_date: input.startDate,
      end_date: input.endDate || null,
      max_occurrences: input.maxOccurrences || null,
      notes: input.notes?.trim() || null,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (seriesError || !series) return { error: "Não foi possível criar a recorrência." };

  const rows = toCreate.map((occ) => ({
    patient_id: input.patientId,
    professional_id: input.professionalId,
    specialty_id: input.specialtyId || null,
    insurance_id: input.insuranceId,
    schedule_slot_id: occ.slotId,
    appointment_date: occ.date,
    start_time: occ.startTime,
    end_time: occ.endTime,
    payment_method: input.paymentMethod,
    value: appointmentValue,
    modality: input.modality ?? null,
    particular_product: input.particularProduct ?? null,
    status: "pendente" as const,
    series_id: series.id,
    notes: input.notes?.trim() || null,
  }));

  const { error: insertError } = await supabase.from("appointments").insert(rows);
  if (insertError) return { error: "Recorrência criada, mas houve falha ao gerar os atendimentos." };

  await logAudit({
    actorId: session.user.id,
    action: "appointment_series.created",
    entity: "appointment_series",
    entityId: series.id,
    metadata: {
      count: rows.length,
      frequency: input.frequency,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
    },
  });

  await notifyStaff({
    type: "appointment_series.created",
    title: "Novo atendimento recorrente criado",
    message: `${rows.length} atendimentos gerados.`,
    entity: "appointment_series",
    entityId: series.id,
  });

  const [{ data: patient }, { data: professionalProfile }, { data: clinic }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", input.patientId).single(),
    supabase.from("profiles").select("full_name").eq("id", input.professionalId).single(),
    supabase.from("clinic_settings").select("name, whatsapp_number").eq("id", 1).single(),
  ]);

  const message = buildStaffBookingConfirmationMessage({
    patientName: patient?.full_name ?? "",
    professionalName: professionalProfile?.full_name ?? "",
    appointmentDate: rows[0].appointment_date,
    startTime: rows[0].start_time,
    clinicName: clinic?.name ?? "Espaço Zoe",
    clinicPhone: clinic?.whatsapp_number,
  });
  const whatsappLink = buildWhatsAppLink(patient?.phone, message);

  await logPatientMessage({ patientId: input.patientId, type: "booking", sentBy: session.user.id });

  return { error: null, seriesId: series.id, createdCount: rows.length, whatsappLink };
}

export type RecurrenceScope = "only" | "following" | "all";

export interface PreviewRecurrenceUpdateInput {
  appointmentId: string;
  scope: Extract<RecurrenceScope, "following" | "all">;
  dayOfWeek: number;
  startTime: string;
  /** Quando omitidos, mantém o valor atual da série (comportamento de
   * apenas trocar dia/horário, preservado para não quebrar o fluxo hoje). */
  frequency?: RecurrenceFrequency;
  /** Ancora a geração das novas ocorrências numa data diferente do corte
   * padrão do escopo (ex.: "esse novo horário vale a partir de 15/09").
   * As ocorrências antigas dentro do escopo continuam sendo substituídas a
   * partir do corte padrão — só o início do NOVO padrão muda. */
  startDate?: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
}

export async function previewRecurrenceUpdate(
  input: PreviewRecurrenceUpdateInput,
): Promise<{ error: string | null; occurrences?: OccurrencePreview[] }> {
  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", input.appointmentId)
    .single();
  if (!appointment || !appointment.series_id) return { error: "Atendimento não faz parte de uma recorrência." };

  await requireCanManageSeries(appointment.series_id);

  const { data: series } = await supabase
    .from("appointment_series")
    .select("*")
    .eq("id", appointment.series_id)
    .single();
  if (!series) return { error: "Recorrência não encontrada." };

  const todayIso = todayLocalIso();
  const cutoff = input.scope === "following" ? appointment.appointment_date : todayIso;
  const generationStart = input.startDate || cutoff;

  let remainingMax: number | null = null;
  if (input.maxOccurrences !== undefined) {
    // Quantidade redefinida explicitamente na edição — vale como novo teto
    // a partir daqui, sem descontar ocorrências já criadas no padrão antigo.
    remainingMax = input.maxOccurrences;
  } else if (series.max_occurrences) {
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("series_id", series.id)
      .lt("appointment_date", cutoff);
    remainingMax = Math.max(0, series.max_occurrences - (count ?? 0));
    if (remainingMax === 0) {
      return { error: "Essa recorrência já atingiu o número máximo de repetições." };
    }
  }

  const dates = generateOccurrenceDates({
    startDate: generationStart,
    endDate: input.endDate !== undefined ? input.endDate : series.end_date,
    frequency: input.frequency ?? series.frequency,
    dayOfWeek: input.dayOfWeek,
    maxOccurrences: remainingMax,
  });

  if (dates.length === 0) {
    return { error: "Nenhuma data gerada para os novos parâmetros. Revise dia da semana, datas e frequência." };
  }

  const occurrences = await buildPreview(
    series.professional_id,
    series.insurance_id,
    dates,
    input.startTime,
    series.modality ?? undefined,
  );
  return { error: null, occurrences };
}

export interface UpdateRecurringAppointmentInput {
  appointmentId: string;
  scope: RecurrenceScope;
  dayOfWeek?: number;
  startTime?: string;
  date?: string;
  skipDates?: string[];
  /** Para datas em conflito onde foi escolhido "outro horário" em vez de
   * ignorar (escopo following/all) — mapa data -> horário alternativo. */
  overrides?: Record<string, string>;
  reason?: string;
  /** Escopo following/all: quando omitidos, mantém os valores atuais da série. */
  frequency?: RecurrenceFrequency;
  startDate?: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
}

async function updateSingleOccurrence(
  appointment: AppointmentRow,
  input: UpdateRecurringAppointmentInput,
): Promise<{ error: string | null; whatsappLink?: string | null }> {
  const session = await getCurrentUser();
  if (!session) return { error: "Acesso negado." };

  const isStaff = ["admin", "recepcionista"].includes(session.profile.role);
  const isOwnerProfessional =
    session.profile.role === "profissional" && appointment.professional_id === session.user.id;
  if (!isStaff && !isOwnerProfessional) return { error: "Acesso negado." };

  if (!input.date || !input.startTime) return { error: "Informe a nova data e horário." };

  const availableTimes = await getAvailableTimes(
    appointment.professional_id,
    appointment.insurance_id,
    input.date,
    appointment.modality ?? undefined,
  );
  const match = availableTimes.find((t) => t.startTime === input.startTime);
  if (!match) return { error: "Horário indisponível para essa data. Escolha outro." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      appointment_date: input.date,
      start_time: input.startTime,
      end_time: match.endTime,
      schedule_slot_id: match.slotId,
    })
    .eq("id", appointment.id);

  if (error) return { error: "Não foi possível reagendar este atendimento." };

  await logAudit({
    actorId: session.user.id,
    action: "appointment.rescheduled_occurrence",
    entity: "appointments",
    entityId: appointment.id,
    metadata: {
      seriesId: appointment.series_id,
      previousDate: appointment.appointment_date,
      previousTime: appointment.start_time,
      newDate: input.date,
      newTime: input.startTime,
      reason: input.reason ?? null,
    },
  });

  const [{ data: patientProfile }, { data: professionalProfile }, { data: clinic }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", appointment.patient_id).single(),
    supabase.from("profiles").select("full_name").eq("id", appointment.professional_id).single(),
    supabase.from("clinic_settings").select("name, whatsapp_number").eq("id", 1).single(),
  ]);

  const message = buildRescheduleMessage({
    patientName: patientProfile?.full_name ?? "",
    professionalName: professionalProfile?.full_name ?? "",
    newDate: input.date,
    newStartTime: input.startTime,
    clinicPhone: clinic?.whatsapp_number,
    clinicName: clinic?.name,
  });
  const whatsappLink = buildWhatsAppLink(patientProfile?.phone, message);

  await logPatientMessage({
    patientId: appointment.patient_id,
    appointmentId: appointment.id,
    type: "reschedule",
    sentBy: session.user.id,
  });

  return { error: null, whatsappLink };
}

export async function updateRecurringAppointment(
  input: UpdateRecurringAppointmentInput,
): Promise<{ error: string | null; whatsappLink?: string | null; skippedConfirmed?: number }> {
  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", input.appointmentId)
    .single();
  if (!appointment) return { error: "Atendimento não encontrado." };

  if (input.scope === "only") {
    return updateSingleOccurrence(appointment, input);
  }

  if (!appointment.series_id) return { error: "Atendimento não faz parte de uma recorrência." };
  const session = await requireCanManageSeries(appointment.series_id);

  if (input.dayOfWeek === undefined || !input.startTime) {
    return { error: "Informe o novo dia da semana e horário." };
  }

  const rateLimit = checkRateLimit(`update-recurring:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const { data: series } = await supabase
    .from("appointment_series")
    .select("*")
    .eq("id", appointment.series_id)
    .single();
  if (!series) return { error: "Recorrência não encontrada." };

  const todayIso = todayLocalIso();
  const cutoff = input.scope === "following" ? appointment.appointment_date : todayIso;

  const { data: candidates } = await supabase
    .from("appointments")
    .select("id, appointment_date, start_time, status")
    .eq("series_id", series.id)
    .gte("appointment_date", cutoff)
    .in("status", ["pendente", "confirmada"]);

  const { data: billed } = await supabase.from("financial_entries").select("appointment_id");
  const billedIds = new Set((billed ?? []).map((b) => b.appointment_id));
  const toReplace = (candidates ?? []).filter((c) => !billedIds.has(c.id));
  const skippedConfirmed = (candidates ?? []).length - toReplace.length;

  if (toReplace.length === 0) {
    return { error: "Não há ocorrências futuras editáveis nessa recorrência (já concluídas ou faturadas)." };
  }

  const preview = await previewRecurrenceUpdate({
    appointmentId: input.appointmentId,
    scope: input.scope,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    frequency: input.frequency,
    startDate: input.startDate,
    endDate: input.endDate,
    maxOccurrences: input.maxOccurrences,
  });
  if (preview.error || !preview.occurrences) {
    return { error: preview.error ?? "Não foi possível validar as novas datas." };
  }

  const toCreate = await resolveOccurrences(
    series.professional_id,
    series.insurance_id,
    input.startTime,
    preview.occurrences,
    input.skipDates ?? [],
    input.overrides,
    series.modality ?? undefined,
  );
  if (toCreate.length === 0) return { error: "Nenhuma data disponível para o novo horário." };

  const pricing = await resolveAppointmentValue(
    series.professional_id,
    series.insurance_id,
    series.modality ?? undefined,
    series.particular_product ?? undefined,
  );
  if (pricing.value == null) {
    return { error: pricing.error ?? "Não foi possível calcular o valor do atendimento." };
  }
  const appointmentValue = pricing.value;

  // Marca as ocorrências substituídas como remarcadas (nunca exclui —
  // preserva histórico), depois cria as novas com o dia/horário atualizado.
  await supabase
    .from("appointments")
    .update({ status: "remarcada" })
    .in(
      "id",
      toReplace.map((c) => c.id),
    );

  const rows = toCreate.map((occ) => ({
    patient_id: series.patient_id,
    professional_id: series.professional_id,
    specialty_id: series.specialty_id,
    insurance_id: series.insurance_id,
    schedule_slot_id: occ.slotId,
    appointment_date: occ.date,
    start_time: occ.startTime,
    end_time: occ.endTime,
    payment_method: series.payment_method,
    value: appointmentValue,
    modality: series.modality,
    particular_product: series.particular_product,
    status: "pendente" as const,
    series_id: series.id,
    notes: series.notes,
  }));

  // Sem policy de INSERT em appointments para staff/profissional — a
  // autorização já foi validada acima (requireCanManageSeries), então usa
  // service role só para esta gravação (mesmo padrão de createRecurringAppointments).
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("appointments").insert(rows);
  if (insertError) return { error: "Não foi possível gerar as novas ocorrências." };

  await supabase
    .from("appointment_series")
    .update({
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      frequency: input.frequency ?? series.frequency,
      start_date: input.startDate ?? series.start_date,
      end_date: input.endDate !== undefined ? input.endDate : series.end_date,
      max_occurrences: input.maxOccurrences !== undefined ? input.maxOccurrences : series.max_occurrences,
      end_time: rows[0]?.end_time ?? series.end_time,
    })
    .eq("id", series.id);

  await logAudit({
    actorId: session.user.id,
    action: "appointment_series.rescheduled",
    entity: "appointment_series",
    entityId: series.id,
    metadata: {
      scope: input.scope,
      previousDayOfWeek: series.day_of_week,
      previousStartTime: series.start_time,
      previousFrequency: series.frequency,
      newDayOfWeek: input.dayOfWeek,
      newStartTime: input.startTime,
      newFrequency: input.frequency ?? series.frequency,
      reason: input.reason ?? null,
      occurrencesReplaced: toReplace.length,
      occurrencesCreated: rows.length,
    },
  });

  const [{ data: patientProfile }, { data: professionalProfile }, { data: clinic }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", series.patient_id).single(),
    supabase.from("profiles").select("full_name").eq("id", series.professional_id).single(),
    supabase.from("clinic_settings").select("name, whatsapp_number").eq("id", 1).single(),
  ]);

  const message = buildRescheduleMessage({
    patientName: patientProfile?.full_name ?? "",
    professionalName: professionalProfile?.full_name ?? "",
    newDate: rows[0]?.appointment_date ?? cutoff,
    newStartTime: input.startTime,
    clinicPhone: clinic?.whatsapp_number,
    clinicName: clinic?.name,
  });
  const whatsappLink = buildWhatsAppLink(patientProfile?.phone, message);

  await logPatientMessage({
    patientId: series.patient_id,
    type: "reschedule",
    sentBy: session.user.id,
  });

  await notify({
    userId: series.patient_id,
    type: "appointment_series.rescheduled",
    title: "Seu atendimento recorrente foi reagendado",
    message: `Novo horário: ${WEEKDAY_LABELS[input.dayOfWeek]} às ${input.startTime}.`,
    entity: "appointment_series",
    entityId: series.id,
  });

  return { error: null, whatsappLink, skippedConfirmed };
}

async function cancelRecurringAppointmentCore(
  session: { user: { id: string } },
  appointmentId: string,
  scope: RecurrenceScope,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: appointment } = await supabase.from("appointments").select("*").eq("id", appointmentId).single();
  if (!appointment) return { error: "Atendimento não encontrado." };

  if (scope === "only" || !appointment.series_id) {
    const { error } = await supabase.from("appointments").update({ status: "cancelada" }).eq("id", appointmentId);
    if (error) return { error: "Não foi possível cancelar." };
    await logAudit({
      actorId: session.user.id,
      action: "appointment.cancelled",
      entity: "appointments",
      entityId: appointmentId,
    });
    return { error: null };
  }

  const todayIso = todayLocalIso();
  const cutoff = scope === "following" ? appointment.appointment_date : todayIso;

  const { data: toCancel } = await supabase
    .from("appointments")
    .select("id")
    .eq("series_id", appointment.series_id)
    .gte("appointment_date", cutoff)
    .in("status", ["pendente", "confirmada"]);

  const ids = (toCancel ?? []).map((a) => a.id);
  if (ids.length > 0) {
    await supabase.from("appointments").update({ status: "cancelada" }).in("id", ids);
  }

  await supabase
    .from("appointment_series")
    .update({ status: "cancelled", end_date: cutoff })
    .eq("id", appointment.series_id);

  await logAudit({
    actorId: session.user.id,
    action: "appointment_series.cancelled",
    entity: "appointment_series",
    entityId: appointment.series_id,
    metadata: { scope, cancelledCount: ids.length },
  });

  return { error: null };
}

/** Usado para "parar a repetição a partir daqui" dentro da edição — admin e
 * recepcionista podem cancelar/parar consultas (item de negócio "Cancelar"). */
export async function cancelRecurringAppointment(
  appointmentId: string,
  scope: RecurrenceScope,
): Promise<{ error: string | null }> {
  const session = await requireStaff();
  return cancelRecurringAppointmentCore(session, appointmentId, scope);
}

/** Usado pelo botão "Excluir" de uma consulta recorrente — exclusão é
 * restrita ao Administrador; a recepção continua podendo cancelar. */
export async function deleteRecurringAppointment(
  appointmentId: string,
  scope: RecurrenceScope,
): Promise<{ error: string | null }> {
  const session = await requireAdmin();
  return cancelRecurringAppointmentCore(session, appointmentId, scope);
}

export async function extendSeries(
  seriesId: string,
  additionalMonths = 6,
): Promise<{ error: string | null; createdCount?: number }> {
  const session = await requireStaff();
  const supabase = await createClient();

  const { data: series } = await supabase.from("appointment_series").select("*").eq("id", seriesId).single();
  if (!series || series.status !== "active") return { error: "Recorrência não encontrada ou cancelada." };

  const { data: lastAppointment } = await supabase
    .from("appointments")
    .select("appointment_date")
    .eq("series_id", seriesId)
    .order("appointment_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextStart = lastAppointment ? addDaysIso(lastAppointment.appointment_date, 1) : series.start_date;

  const dates = generateOccurrenceDates({
    startDate: nextStart,
    endDate: series.end_date,
    frequency: series.frequency,
    dayOfWeek: series.day_of_week,
    maxOccurrences: null,
    horizonMonths: additionalMonths,
  });

  if (dates.length === 0) return { error: "Nenhuma data nova para gerar." };

  const occurrences = await buildPreview(
    series.professional_id,
    series.insurance_id,
    dates,
    series.start_time,
    series.modality ?? undefined,
  );
  const toCreate = occurrences.filter((o) => o.available);
  if (toCreate.length === 0) return { error: "Nenhuma data disponível no período." };

  const pricing = await resolveAppointmentValue(
    series.professional_id,
    series.insurance_id,
    series.modality ?? undefined,
    series.particular_product ?? undefined,
  );
  if (pricing.value == null) {
    return { error: pricing.error ?? "Não foi possível calcular o valor do atendimento." };
  }
  const appointmentValue = pricing.value;

  const rows = toCreate.map((occ) => ({
    patient_id: series.patient_id,
    professional_id: series.professional_id,
    specialty_id: series.specialty_id,
    insurance_id: series.insurance_id,
    schedule_slot_id: occ.slotId!,
    appointment_date: occ.date,
    start_time: series.start_time,
    end_time: occ.endTime!,
    payment_method: series.payment_method,
    value: appointmentValue,
    modality: series.modality,
    particular_product: series.particular_product,
    status: "pendente" as const,
    series_id: series.id,
    notes: series.notes,
  }));

  // Só staff chega aqui — sem policy de INSERT em appointments para
  // admin/recepcionista, usa service role (mesmo padrão das demais funções
  // deste arquivo).
  const admin = createAdminClient();
  const { error } = await admin.from("appointments").insert(rows);
  if (error) return { error: "Não foi possível gerar as novas ocorrências." };

  await logAudit({
    actorId: session.user.id,
    action: "appointment_series.extended",
    entity: "appointment_series",
    entityId: series.id,
    metadata: { createdCount: rows.length },
  });

  return { error: null, createdCount: rows.length };
}

export interface AttachRecurrenceInput {
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
  notes?: string;
  skipDates?: string[];
  overrides?: Record<string, string>;
}

/** Gera o preview de ocorrências ao transformar uma consulta avulsa já
 * existente em recorrente — a própria consulta conta como a 1ª ocorrência
 * (nunca duplicada), só as datas futuras entram no preview de conflitos. */
export async function previewAttachRecurrence(
  appointmentId: string,
  input: Omit<AttachRecurrenceInput, "notes" | "skipDates" | "overrides">,
): Promise<{ error: string | null; occurrences?: OccurrencePreview[] }> {
  await requireStaff();

  const supabase = await createClient();
  const { data: appointment } = await supabase.from("appointments").select("*").eq("id", appointmentId).single();
  if (!appointment) return { error: "Atendimento não encontrado." };
  if (appointment.series_id) return { error: "Este atendimento já faz parte de uma recorrência." };

  const dayOfWeek = new Date(`${input.startDate}T00:00:00`).getDay();
  const dates = generateOccurrenceDates({
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    frequency: input.frequency,
    dayOfWeek,
    maxOccurrences: input.maxOccurrences ?? null,
  });

  const futureDates = dates.filter((d) => d !== appointment.appointment_date);
  if (futureDates.length === 0) {
    return { error: null, occurrences: [] };
  }

  const occurrences = await buildPreview(
    appointment.professional_id,
    appointment.insurance_id,
    futureDates,
    appointment.start_time.slice(0, 5),
    appointment.modality ?? undefined,
  );
  return { error: null, occurrences };
}

/** Cria uma `appointment_series` a partir de uma consulta avulsa já
 * existente (paciente/profissional/convênio/pagamento/valor herdados dela,
 * nunca redigitados) e vincula essa mesma consulta como a 1ª ocorrência. */
export async function attachRecurrenceToAppointment(
  appointmentId: string,
  input: AttachRecurrenceInput,
): Promise<{ error: string | null; seriesId?: string; createdCount?: number }> {
  const session = await requireStaff();

  const rateLimit = checkRateLimit(`attach-recurrence:${session.user.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const supabase = await createClient();
  const { data: appointment } = await supabase.from("appointments").select("*").eq("id", appointmentId).single();
  if (!appointment) return { error: "Atendimento não encontrado." };
  if (appointment.series_id) return { error: "Este atendimento já faz parte de uma recorrência." };
  if (!["pendente", "confirmada"].includes(appointment.status)) {
    return { error: "Só é possível tornar recorrente um atendimento pendente ou confirmado." };
  }

  const dayOfWeek = new Date(`${input.startDate}T00:00:00`).getDay();
  const dates = generateOccurrenceDates({
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    frequency: input.frequency,
    dayOfWeek,
    maxOccurrences: input.maxOccurrences ?? null,
  });
  const futureDates = dates.filter((d) => d !== appointment.appointment_date);

  const preview =
    futureDates.length > 0
      ? await buildPreview(
          appointment.professional_id,
          appointment.insurance_id,
          futureDates,
          appointment.start_time.slice(0, 5),
          appointment.modality ?? undefined,
        )
      : [];

  const toCreate = await resolveOccurrences(
    appointment.professional_id,
    appointment.insurance_id,
    appointment.start_time.slice(0, 5),
    preview,
    input.skipDates ?? [],
    input.overrides,
    appointment.modality ?? undefined,
  );

  const admin = createAdminClient();

  const { data: series, error: seriesError } = await admin
    .from("appointment_series")
    .insert({
      patient_id: appointment.patient_id,
      professional_id: appointment.professional_id,
      specialty_id: appointment.specialty_id,
      insurance_id: appointment.insurance_id,
      payment_method: appointment.payment_method,
      modality: appointment.modality,
      particular_product: appointment.particular_product,
      day_of_week: dayOfWeek,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      frequency: input.frequency,
      start_date: input.startDate,
      end_date: input.endDate || null,
      max_occurrences: input.maxOccurrences || null,
      notes: input.notes?.trim() || null,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (seriesError || !series) return { error: "Não foi possível criar a recorrência." };

  // UPDATE (diferente do INSERT acima) passa pelo trigger prevent_appointment_tampering,
  // que decide o bypass de staff olhando auth.uid() — com o client admin (service role)
  // isso retorna null e a atualização é bloqueada. Por isso aqui usa o client autenticado
  // normal (mesmo padrão das demais UPDATEs em appointments neste arquivo).
  const { error: linkError } = await supabase
    .from("appointments")
    .update({ series_id: series.id })
    .eq("id", appointmentId);
  if (linkError) return { error: "Recorrência criada, mas não foi possível vincular o atendimento original." };

  if (toCreate.length > 0) {
    const rows = toCreate.map((occ) => ({
      patient_id: appointment.patient_id,
      professional_id: appointment.professional_id,
      specialty_id: appointment.specialty_id,
      insurance_id: appointment.insurance_id,
      schedule_slot_id: occ.slotId,
      appointment_date: occ.date,
      start_time: occ.startTime,
      end_time: occ.endTime,
      payment_method: appointment.payment_method,
      value: appointment.value,
      modality: appointment.modality,
      particular_product: appointment.particular_product,
      status: "pendente" as const,
      series_id: series.id,
      notes: input.notes?.trim() || null,
    }));
    const { error: insertError } = await admin.from("appointments").insert(rows);
    if (insertError) return { error: "Recorrência criada, mas houve falha ao gerar os próximos atendimentos." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "appointment_series.created",
    entity: "appointment_series",
    entityId: series.id,
    metadata: {
      count: toCreate.length + 1,
      frequency: input.frequency,
      dayOfWeek,
      startTime: appointment.start_time,
      attachedFromAppointmentId: appointmentId,
    },
  });

  return { error: null, seriesId: series.id, createdCount: toCreate.length + 1 };
}

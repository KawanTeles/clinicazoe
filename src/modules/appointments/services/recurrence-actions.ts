"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildRescheduleMessage, buildStaffBookingConfirmationMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { logAudit } from "@/modules/team/services/audit";
import { notify, notifyStaff } from "@/modules/notifications/services/notify";
import { logPatientMessage } from "@/modules/patients/services/message-log";
import {
  cancelFinancialEntryForAppointment,
  cancelFinancialEntriesForAppointments,
} from "@/modules/financial/services/financial-actions";
import type { AppointmentSource, Database, Modality, ParticularProduct, PaymentMethod, RecurrenceFrequency } from "@/lib/supabase/types";
import { toLocalIsoDate, todayLocalIso } from "@/lib/date";
import { getAvailableTimes, hasPatientConflict, resolveAppointmentValue } from "./booking-queries";
import { isPatientConflictError, isSlotFullError } from "./booking-errors";
import { generateOccurrenceDates, WEEKDAY_LABELS } from "./recurrence-generator";
import type { GroupParticipantInput } from "./booking-actions";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type AdminClient = ReturnType<typeof createAdminClient>;

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

/** Um participante (profissional ou paciente) específico que impede uma
 * ocorrência de sessão conjugada de ser gerada numa data — usado para
 * avisar claramente quem/o quê está em conflito, em vez de um "indisponível"
 * genérico (migração 0068). */
export interface ParticipantConflict {
  kind: "professional" | "patient";
  name: string;
  reason: string;
}

export interface OccurrencePreview {
  date: string;
  available: boolean;
  reason?: string;
  /** Só preenchido quando a ocorrência é de uma sessão conjugada (migração
   * 0068) — um item por participante em conflito nessa data. */
  conflicts?: ParticipantConflict[];
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
  /** Presença de qualquer um destes dois campos (não vazio) faz a série
   * inteira ser tratada como uma sessão conjugada recorrente (migração
   * 0068) — todas as ocorrências geram 1 appointment_groups + N linhas em
   * vez de 1 linha simples. */
  additionalParticipants?: GroupParticipantInput[];
  coTherapistProfessionalIds?: string[];
}

function isGroupRecurrence(input: Pick<RecurringBookingInput, "additionalParticipants" | "coTherapistProfessionalIds">): boolean {
  return (input.additionalParticipants?.length ?? 0) > 0 || (input.coTherapistProfessionalIds?.length ?? 0) > 0;
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

async function resolveDisplayNames(ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", uniqueIds);
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}

/** Equivalente a buildPreview, mas para uma sessão conjugada: checa, POR
 * DATA, a disponibilidade do profissional principal, de cada coterapeuta
 * (migração 0067) e conflito de agenda de cada paciente (migração 0067,
 * via hasPatientConflict) — reporta exatamente quem está em conflito em
 * `conflicts`, em vez de um "indisponível" genérico. Convênio/modalidade
 * usados para checar disponibilidade dos PROFISSIONAIS é sempre o do
 * participante 1 (mesma limitação de v1 já documentada em
 * GroupAppointmentForm — cada participante pode ter seu próprio convênio
 * para fins de cobrança, mas a checagem de agenda usa um representante). */
async function buildGroupPreview(
  principalProfessionalId: string,
  coTherapistProfessionalIds: string[],
  patientIds: string[],
  insuranceId: string,
  dates: string[],
  startTime: string,
  modality?: Modality,
): Promise<OccurrencePreview[]> {
  const nameById = await resolveDisplayNames([principalProfessionalId, ...coTherapistProfessionalIds, ...patientIds]);

  return Promise.all(
    dates.map(async (date): Promise<OccurrencePreview> => {
      const conflicts: ParticipantConflict[] = [];
      let slotId: string | undefined;
      let endTime: string | undefined;

      const principalTimes = await getAvailableTimes(principalProfessionalId, insuranceId, date, modality);
      const principalMatch = principalTimes.find((t) => t.startTime === startTime);
      if (principalMatch) {
        slotId = principalMatch.slotId;
        endTime = principalMatch.endTime;
      } else {
        conflicts.push({
          kind: "professional",
          name: nameById.get(principalProfessionalId) ?? "Profissional principal",
          reason: "Sem disponibilidade (bloqueio, feriado ou horário lotado).",
        });
      }

      for (const coId of coTherapistProfessionalIds) {
        const coTimes = await getAvailableTimes(coId, insuranceId, date, modality);
        const coMatch = coTimes.find((t) => t.startTime === startTime);
        if (!coMatch) {
          conflicts.push({
            kind: "professional",
            name: nameById.get(coId) ?? "Coterapeuta",
            reason: "Sem disponibilidade nesse horário.",
          });
        }
      }

      for (const patientId of patientIds) {
        const conflicted = await hasPatientConflict(patientId, date, startTime);
        if (conflicted) {
          conflicts.push({
            kind: "patient",
            name: nameById.get(patientId) ?? "Paciente",
            reason: "Já tem outro atendimento marcado nesse horário.",
          });
        }
      }

      if (conflicts.length > 0) {
        return {
          date,
          available: false,
          reason: conflicts.map((c) => `${c.name}: ${c.reason}`).join(" "),
          conflicts,
        };
      }

      return { date, available: true, slotId, endTime };
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

  const occurrences = isGroupRecurrence(input)
    ? await buildGroupPreview(
        input.professionalId,
        input.coTherapistProfessionalIds ?? [],
        [input.patientId, ...(input.additionalParticipants ?? []).map((p) => p.patientId)],
        input.insuranceId,
        dates,
        input.startTime,
        input.modality,
      )
    : await buildPreview(input.professionalId, input.insuranceId, dates, input.startTime, input.modality);
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

export interface SkippedDate {
  date: string;
  reason: string;
}

interface GroupOccurrenceParticipant {
  patientId: string;
  insuranceId: string;
  paymentMethod: PaymentMethod;
  modality: Modality | null;
  particularProduct: ParticularProduct | null;
  value: number;
}

/** Gera as ocorrências de uma série CONJUGADA: para cada data resolvida,
 * cria 1 appointment_groups novo + 1 linha em appointments por participante
 * (via book_appointment, migração 0068 — mesmo lock atômico do fluxo
 * avulso) + vincula os coterapeutas em todas as linhas daquela data (mesmo
 * padrão "grupo coletivo sem dono" de createGroupAppointment). Best-effort
 * POR DATA: se qualquer participante falhar numa data específica, desfaz só
 * as linhas dessa data (rollback compensatório) e segue para as próximas —
 * uma corrida rara numa data não derruba a série inteira. */
async function createGroupOccurrences(
  admin: AdminClient,
  seriesId: string,
  principalProfessionalId: string,
  participants: GroupOccurrenceParticipant[],
  coTherapistProfessionalIds: string[],
  specialtyId: string | null,
  toCreate: ResolvedOccurrence[],
  source: AppointmentSource,
  actorId: string,
): Promise<{ createdCount: number; skippedDates: SkippedDate[] }> {
  let createdCount = 0;
  const skippedDates: SkippedDate[] = [];

  for (const occ of toCreate) {
    const { data: group, error: groupError } = await admin
      .from("appointment_groups")
      .insert({ appointment_date: occ.date, start_time: occ.startTime, end_time: occ.endTime, created_by: actorId })
      .select("id")
      .single();

    if (groupError || !group) {
      skippedDates.push({ date: occ.date, reason: "Não foi possível criar a sessão desta data." });
      continue;
    }

    const createdIds: string[] = [];
    let failReason: string | null = null;

    for (const participant of participants) {
      const { data: appointment, error } = await admin.rpc("book_appointment", {
        p_patient_id: participant.patientId,
        p_professional_id: principalProfessionalId,
        p_specialty_id: specialtyId,
        p_insurance_id: participant.insuranceId,
        p_schedule_slot_id: occ.slotId,
        p_appointment_date: occ.date,
        p_start_time: occ.startTime,
        p_end_time: occ.endTime,
        p_payment_method: participant.paymentMethod,
        p_value: participant.value,
        p_modality: participant.modality,
        p_particular_product: participant.particularProduct,
        p_source: source,
        p_group_id: group.id,
        p_series_id: seriesId,
      });

      if (error || !appointment) {
        failReason = isSlotFullError(error)
          ? "Horário lotou nesta data."
          : isPatientConflictError(error)
            ? "Um dos participantes já tem outro atendimento nesta data/horário."
            : "Não foi possível criar um dos atendimentos desta data.";
        break;
      }
      createdIds.push(appointment.id);
    }

    if (failReason) {
      if (createdIds.length > 0) await admin.from("appointments").delete().in("id", createdIds);
      await admin.from("appointment_groups").delete().eq("id", group.id);
      skippedDates.push({ date: occ.date, reason: failReason });
      continue;
    }

    if (coTherapistProfessionalIds.length > 0) {
      const links = createdIds.flatMap((appointmentId) =>
        coTherapistProfessionalIds.map((professionalId) => ({
          appointment_id: appointmentId,
          professional_id: professionalId,
          created_by: actorId,
        })),
      );
      const { error: linkError } = await admin.from("appointment_professionals").insert(links);
      if (linkError) {
        await admin.from("appointments").delete().in("id", createdIds);
        await admin.from("appointment_groups").delete().eq("id", group.id);
        skippedDates.push({ date: occ.date, reason: "Não foi possível vincular os profissionais adicionais nesta data." });
        continue;
      }
    }

    createdCount += 1;
  }

  return { createdCount, skippedDates };
}

export async function createRecurringAppointments(
  input: CreateRecurringInput,
): Promise<{
  error: string | null;
  seriesId?: string;
  createdCount?: number;
  whatsappLink?: string | null;
  skippedDates?: SkippedDate[];
}> {
  const session = await requireStaff();

  const rateLimit = checkRateLimit(`create-recurring:${session.user.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const isGroup = isGroupRecurrence(input);

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

  const additionalPricing: number[] = [];
  if (isGroup) {
    for (const participant of input.additionalParticipants ?? []) {
      const p = await resolveAppointmentValue(
        input.professionalId,
        participant.insuranceId,
        participant.modality,
        participant.particularProduct,
      );
      if (p.value == null) {
        return { error: p.error ?? "Não foi possível calcular o valor de um dos participantes adicionais." };
      }
      additionalPricing.push(p.value);
    }
  }

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

  if (isGroup) {
    if (input.additionalParticipants && input.additionalParticipants.length > 0) {
      const { error: participantsError } = await supabase.from("appointment_series_participants").insert(
        input.additionalParticipants.map((p) => ({
          series_id: series.id,
          patient_id: p.patientId,
          insurance_id: p.insuranceId,
          payment_method: p.paymentMethod,
          modality: p.modality ?? null,
          particular_product: p.particularProduct ?? null,
        })),
      );
      if (participantsError) {
        await supabase.from("appointment_series").delete().eq("id", series.id);
        return { error: "Não foi possível salvar os participantes adicionais da recorrência." };
      }
    }
    if (input.coTherapistProfessionalIds && input.coTherapistProfessionalIds.length > 0) {
      const { error: cotherapistsError } = await supabase.from("appointment_series_cotherapists").insert(
        input.coTherapistProfessionalIds.map((professionalId) => ({ series_id: series.id, professional_id: professionalId })),
      );
      if (cotherapistsError) {
        await supabase.from("appointment_series").delete().eq("id", series.id);
        return { error: "Não foi possível salvar os coterapeutas da recorrência." };
      }
    }
  }

  let createdCount = 0;
  let skippedDates: SkippedDate[] = [];

  if (isGroup) {
    const participants: GroupOccurrenceParticipant[] = [
      {
        patientId: input.patientId,
        insuranceId: input.insuranceId,
        paymentMethod: input.paymentMethod,
        modality: input.modality ?? null,
        particularProduct: input.particularProduct ?? null,
        value: appointmentValue,
      },
      ...(input.additionalParticipants ?? []).map((p, i) => ({
        patientId: p.patientId,
        insuranceId: p.insuranceId,
        paymentMethod: p.paymentMethod,
        modality: p.modality ?? null,
        particularProduct: p.particularProduct ?? null,
        value: additionalPricing[i],
      })),
    ];

    const result = await createGroupOccurrences(
      supabase,
      series.id,
      input.professionalId,
      participants,
      input.coTherapistProfessionalIds ?? [],
      input.specialtyId || null,
      toCreate,
      "staff",
      session.user.id,
    );
    createdCount = result.createdCount;
    skippedDates = result.skippedDates;
  } else {
    for (const occ of toCreate) {
      const { data: appointment, error } = await supabase.rpc("book_appointment", {
        p_patient_id: input.patientId,
        p_professional_id: input.professionalId,
        p_specialty_id: input.specialtyId || null,
        p_insurance_id: input.insuranceId,
        p_schedule_slot_id: occ.slotId,
        p_appointment_date: occ.date,
        p_start_time: occ.startTime,
        p_end_time: occ.endTime,
        p_payment_method: input.paymentMethod,
        p_value: appointmentValue,
        p_modality: input.modality ?? null,
        p_particular_product: input.particularProduct ?? null,
        p_source: "staff",
        p_series_id: series.id,
      });
      if (error || !appointment) {
        skippedDates.push({
          date: occ.date,
          reason: isSlotFullError(error) ? "Horário lotou nesta data." : "Não foi possível criar o atendimento desta data.",
        });
        continue;
      }
      createdCount += 1;
    }
  }

  if (createdCount === 0) {
    await supabase.from("appointment_series").delete().eq("id", series.id);
    return { error: "Não foi possível criar nenhuma ocorrência (todas as datas tiveram conflito de última hora)." };
  }

  const skippedDateSet = new Set(skippedDates.map((s) => s.date));
  const firstSuccessful = toCreate.find((occ) => !skippedDateSet.has(occ.date)) ?? toCreate[0];

  await logAudit({
    actorId: session.user.id,
    action: "appointment_series.created",
    entity: "appointment_series",
    entityId: series.id,
    metadata: {
      count: createdCount,
      frequency: input.frequency,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      isGroup,
    },
  });

  await notifyStaff({
    type: "appointment_series.created",
    title: "Novo atendimento recorrente criado",
    message: `${createdCount} atendimento(s) gerados.`,
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
    appointmentDate: firstSuccessful.date,
    startTime: firstSuccessful.startTime,
    clinicName: clinic?.name ?? "Espaço Zoe",
    clinicPhone: clinic?.whatsapp_number,
  });
  const whatsappLink = buildWhatsAppLink(patient?.phone, message);

  await logPatientMessage({ patientId: input.patientId, type: "booking", sentBy: session.user.id });

  return { error: null, seriesId: series.id, createdCount, whatsappLink, skippedDates };
}

interface SeriesGroupParticipant {
  patientId: string;
  insuranceId: string;
  paymentMethod: PaymentMethod;
  modality: Modality | null;
  particularProduct: ParticularProduct | null;
}

interface SeriesGroupConfig {
  additionalParticipants: SeriesGroupParticipant[];
  coTherapistProfessionalIds: string[];
  isGroup: boolean;
}

/** Lê o molde de participantes/coterapeutas extras de uma série (migração
 * 0068) — vazio para toda série simples de hoje, sem exceção. Reaproveitado
 * por preview/edição/extensão de recorrência para decidir se cada ocorrência
 * gera 1 linha ou 1 sessão inteira. */
async function getSeriesGroupConfig(seriesId: string): Promise<SeriesGroupConfig> {
  const supabase = await createClient();
  const [{ data: participants }, { data: cotherapists }] = await Promise.all([
    supabase
      .from("appointment_series_participants")
      .select("patient_id, insurance_id, payment_method, modality, particular_product")
      .eq("series_id", seriesId),
    supabase.from("appointment_series_cotherapists").select("professional_id").eq("series_id", seriesId),
  ]);

  const additionalParticipants: SeriesGroupParticipant[] = (participants ?? []).map((p) => ({
    patientId: p.patient_id,
    insuranceId: p.insurance_id,
    paymentMethod: p.payment_method,
    modality: p.modality,
    particularProduct: p.particular_product,
  }));
  const coTherapistProfessionalIds = (cotherapists ?? []).map((c) => c.professional_id);

  return {
    additionalParticipants,
    coTherapistProfessionalIds,
    isGroup: additionalParticipants.length > 0 || coTherapistProfessionalIds.length > 0,
  };
}

/** Mesma checagem de buildGroupPreview, só que para 1 data — usada ao
 * reagendar uma única ocorrência (escopo "only") de uma sessão conjugada,
 * onde a validação precisa ser síncrona com a resposta ao staff. */
async function checkGroupOccurrenceConflicts(
  principalProfessionalId: string,
  coTherapistProfessionalIds: string[],
  patientIds: string[],
  insuranceId: string,
  date: string,
  startTime: string,
  modality?: Modality,
): Promise<{ available: boolean; conflicts: ParticipantConflict[]; slotId?: string; endTime?: string }> {
  const [preview] = await buildGroupPreview(
    principalProfessionalId,
    coTherapistProfessionalIds,
    patientIds,
    insuranceId,
    [date],
    startTime,
    modality,
  );
  return {
    available: preview.available,
    conflicts: preview.conflicts ?? [],
    slotId: preview.slotId,
    endTime: preview.endTime,
  };
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

  const groupConfig = await getSeriesGroupConfig(series.id);
  const occurrences = groupConfig.isGroup
    ? await buildGroupPreview(
        series.professional_id,
        groupConfig.coTherapistProfessionalIds,
        [series.patient_id, ...groupConfig.additionalParticipants.map((p) => p.patientId)],
        series.insurance_id,
        dates,
        input.startTime,
        series.modality ?? undefined,
      )
    : await buildPreview(
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

  const supabase = await createClient();

  if (appointment.group_id) {
    const { data: siblingRows } = await supabase
      .from("appointments")
      .select("id, patient_id")
      .eq("group_id", appointment.group_id);
    const patientIds = Array.from(new Set((siblingRows ?? []).map((r) => r.patient_id)));
    const siblingIds = (siblingRows ?? []).map((r) => r.id);

    const { data: cotherapistRows } = siblingIds.length
      ? await supabase.from("appointment_professionals").select("professional_id").in("appointment_id", siblingIds)
      : { data: [] as { professional_id: string }[] };
    const coTherapistIds = Array.from(new Set((cotherapistRows ?? []).map((r) => r.professional_id)));

    const check = await checkGroupOccurrenceConflicts(
      appointment.professional_id,
      coTherapistIds,
      patientIds,
      appointment.insurance_id,
      input.date,
      input.startTime,
      appointment.modality ?? undefined,
    );
    if (!check.available || !check.slotId || !check.endTime) {
      const detail = check.conflicts.map((c) => `${c.name}: ${c.reason}`).join(" ");
      return { error: detail || "Horário indisponível para um ou mais participantes desta sessão." };
    }

    // appointment_groups precisa ser atualizado ANTES das linhas de
    // appointments — a trigger appointments_validate_group_biu (migração
    // 0067) exige que data/hora da linha bata com a do grupo. Sem policy de
    // UPDATE para authenticated em appointment_groups (só service role) —
    // por isso só essa gravação usa o client admin. As linhas de
    // appointments em si já têm policy de UPDATE para staff via o client
    // normal (mesmo padrão do caso simples logo abaixo); usar o client admin
    // ali faria auth.uid() virar null dentro de prevent_appointment_tampering
    // e o trigger bloquear a alteração com "Não autorizado.".
    const admin = createAdminClient();
    const { error: groupError } = await admin
      .from("appointment_groups")
      .update({ appointment_date: input.date, start_time: input.startTime, end_time: check.endTime })
      .eq("id", appointment.group_id);
    if (groupError) return { error: "Não foi possível reagendar esta sessão." };

    // Um UPDATE por linha (em vez de .eq("group_id", ...) em lote) — mais
    // previsível sob RLS/triggers por linha do que um único UPDATE multi-row.
    for (const siblingId of siblingIds) {
      const { error: rowError } = await supabase
        .from("appointments")
        .update({
          appointment_date: input.date,
          start_time: input.startTime,
          end_time: check.endTime,
          schedule_slot_id: check.slotId,
        })
        .eq("id", siblingId);
      if (rowError) return { error: "Não foi possível reagendar esta sessão." };
    }

    await logAudit({
      actorId: session.user.id,
      action: "appointment.rescheduled_occurrence",
      entity: "appointment_groups",
      entityId: appointment.group_id,
      metadata: {
        seriesId: appointment.series_id,
        previousDate: appointment.appointment_date,
        previousTime: appointment.start_time,
        newDate: input.date,
        newTime: input.startTime,
        reason: input.reason ?? null,
        participantCount: patientIds.length,
      },
    });

    const [{ data: patientProfile }, { data: professionalProfile }, { data: clinic }] = await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", appointment.patient_id).single(),
      supabase.from("profiles").select("full_name").eq("id", appointment.professional_id).single(),
      supabase.from("clinic_settings").select("name, whatsapp_number").eq("id", 1).single(),
    ]);

    const groupMessage = buildRescheduleMessage({
      patientName: patientProfile?.full_name ?? "",
      professionalName: professionalProfile?.full_name ?? "",
      newDate: input.date,
      newStartTime: input.startTime,
      clinicPhone: clinic?.whatsapp_number,
      clinicName: clinic?.name,
    });
    const groupWhatsappLink = buildWhatsAppLink(patientProfile?.phone, groupMessage);

    await logPatientMessage({
      patientId: appointment.patient_id,
      appointmentId: appointment.id,
      type: "reschedule",
      sentBy: session.user.id,
    });

    return { error: null, whatsappLink: groupWhatsappLink };
  }

  const availableTimes = await getAvailableTimes(
    appointment.professional_id,
    appointment.insurance_id,
    input.date,
    appointment.modality ?? undefined,
  );
  const match = availableTimes.find((t) => t.startTime === input.startTime);
  if (!match) return { error: "Horário indisponível para essa data. Escolha outro." };

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
): Promise<{
  error: string | null;
  whatsappLink?: string | null;
  skippedConfirmed?: number;
  skippedDates?: SkippedDate[];
}> {
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

  const groupConfig = await getSeriesGroupConfig(series.id);

  // Marca as ocorrências substituídas como remarcadas (nunca exclui —
  // preserva histórico), depois cria as novas com o dia/horário atualizado.
  await supabase
    .from("appointments")
    .update({ status: "remarcada" })
    .in(
      "id",
      toReplace.map((c) => c.id),
    );

  // Sem policy de INSERT em appointments para staff/profissional — a
  // autorização já foi validada acima (requireCanManageSeries), então usa
  // service role só para esta gravação (mesmo padrão de createRecurringAppointments).
  const admin = createAdminClient();

  let createdCount: number;
  let skippedDates: SkippedDate[] = [];
  let resultDate: string;
  let resultEndTime: string;

  if (groupConfig.isGroup) {
    const additionalPricing: number[] = [];
    for (const participant of groupConfig.additionalParticipants) {
      const p = await resolveAppointmentValue(
        series.professional_id,
        participant.insuranceId,
        participant.modality ?? undefined,
        participant.particularProduct ?? undefined,
      );
      if (p.value == null) {
        return { error: p.error ?? "Não foi possível calcular o valor de um dos participantes adicionais." };
      }
      additionalPricing.push(p.value);
    }

    const participants: GroupOccurrenceParticipant[] = [
      {
        patientId: series.patient_id,
        insuranceId: series.insurance_id,
        paymentMethod: series.payment_method,
        modality: series.modality,
        particularProduct: series.particular_product,
        value: appointmentValue,
      },
      ...groupConfig.additionalParticipants.map((p, i) => ({
        patientId: p.patientId,
        insuranceId: p.insuranceId,
        paymentMethod: p.paymentMethod,
        modality: p.modality,
        particularProduct: p.particularProduct,
        value: additionalPricing[i],
      })),
    ];

    const result = await createGroupOccurrences(
      admin,
      series.id,
      series.professional_id,
      participants,
      groupConfig.coTherapistProfessionalIds,
      series.specialty_id,
      toCreate,
      "staff",
      session.user.id,
    );
    createdCount = result.createdCount;
    skippedDates = result.skippedDates;

    if (createdCount === 0) {
      return { error: "Não foi possível gerar nenhuma das novas ocorrências (conflitos de última hora)." };
    }

    const skippedSet = new Set(skippedDates.map((s) => s.date));
    const firstSuccessful = toCreate.find((occ) => !skippedSet.has(occ.date)) ?? toCreate[0];
    resultDate = firstSuccessful.date;
    resultEndTime = firstSuccessful.endTime;
  } else {
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

    const { error: insertError } = await admin.from("appointments").insert(rows);
    if (insertError) return { error: "Não foi possível gerar as novas ocorrências." };

    createdCount = rows.length;
    resultDate = rows[0]?.appointment_date ?? cutoff;
    resultEndTime = rows[0]?.end_time ?? series.end_time;
  }

  await supabase
    .from("appointment_series")
    .update({
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      frequency: input.frequency ?? series.frequency,
      start_date: input.startDate ?? series.start_date,
      end_date: input.endDate !== undefined ? input.endDate : series.end_date,
      max_occurrences: input.maxOccurrences !== undefined ? input.maxOccurrences : series.max_occurrences,
      end_time: resultEndTime,
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
      occurrencesCreated: createdCount,
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
    newDate: resultDate,
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

  return { error: null, whatsappLink, skippedConfirmed, skippedDates };
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
    if (appointment.group_id) {
      const { data: siblingRows } = await supabase.from("appointments").select("id").eq("group_id", appointment.group_id);
      const ids = (siblingRows ?? []).map((r) => r.id);
      if (ids.length === 0) return { error: "Não foi possível cancelar esta sessão." };

      // Um UPDATE por linha (em vez de .in() em lote) — mais previsível sob
      // RLS/triggers por linha do que um único UPDATE multi-row.
      for (const id of ids) {
        const { error } = await supabase.from("appointments").update({ status: "cancelada" }).eq("id", id);
        if (error) return { error: "Não foi possível cancelar esta sessão." };
      }
      await cancelFinancialEntriesForAppointments(ids);
      await logAudit({
        actorId: session.user.id,
        action: "appointment.cancelled",
        entity: "appointment_groups",
        entityId: appointment.group_id,
        metadata: { cancelledCount: ids.length },
      });
      return { error: null };
    }

    const { error } = await supabase.from("appointments").update({ status: "cancelada" }).eq("id", appointmentId);
    if (error) return { error: "Não foi possível cancelar." };
    await cancelFinancialEntryForAppointment(appointmentId);
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
    await cancelFinancialEntriesForAppointments(ids);
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

  const groupConfig = await getSeriesGroupConfig(series.id);

  const occurrences = groupConfig.isGroup
    ? await buildGroupPreview(
        series.professional_id,
        groupConfig.coTherapistProfessionalIds,
        [series.patient_id, ...groupConfig.additionalParticipants.map((p) => p.patientId)],
        series.insurance_id,
        dates,
        series.start_time,
        series.modality ?? undefined,
      )
    : await buildPreview(series.professional_id, series.insurance_id, dates, series.start_time, series.modality ?? undefined);
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

  // Só staff chega aqui — sem policy de INSERT em appointments para
  // admin/recepcionista, usa service role (mesmo padrão das demais funções
  // deste arquivo).
  const admin = createAdminClient();

  let createdCount: number;

  if (groupConfig.isGroup) {
    const additionalPricing: number[] = [];
    for (const participant of groupConfig.additionalParticipants) {
      const p = await resolveAppointmentValue(
        series.professional_id,
        participant.insuranceId,
        participant.modality ?? undefined,
        participant.particularProduct ?? undefined,
      );
      if (p.value == null) {
        return { error: p.error ?? "Não foi possível calcular o valor de um dos participantes adicionais." };
      }
      additionalPricing.push(p.value);
    }

    const participants: GroupOccurrenceParticipant[] = [
      {
        patientId: series.patient_id,
        insuranceId: series.insurance_id,
        paymentMethod: series.payment_method,
        modality: series.modality,
        particularProduct: series.particular_product,
        value: appointmentValue,
      },
      ...groupConfig.additionalParticipants.map((p, i) => ({
        patientId: p.patientId,
        insuranceId: p.insuranceId,
        paymentMethod: p.paymentMethod,
        modality: p.modality,
        particularProduct: p.particularProduct,
        value: additionalPricing[i],
      })),
    ];

    const resolvedToCreate = toCreate.map((occ) => ({
      date: occ.date,
      startTime: series.start_time,
      endTime: occ.endTime!,
      slotId: occ.slotId!,
    }));

    const result = await createGroupOccurrences(
      admin,
      series.id,
      series.professional_id,
      participants,
      groupConfig.coTherapistProfessionalIds,
      series.specialty_id,
      resolvedToCreate,
      "staff",
      session.user.id,
    );
    createdCount = result.createdCount;
    if (createdCount === 0) {
      return { error: "Não foi possível gerar nenhuma das novas ocorrências (conflitos de última hora)." };
    }
  } else {
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

    const { error } = await admin.from("appointments").insert(rows);
    if (error) return { error: "Não foi possível gerar as novas ocorrências." };
    createdCount = rows.length;
  }

  await logAudit({
    actorId: session.user.id,
    action: "appointment_series.extended",
    entity: "appointment_series",
    entityId: series.id,
    metadata: { createdCount },
  });

  return { error: null, createdCount };
}

interface GroupSiblingParticipant {
  patientId: string;
  insuranceId: string;
  paymentMethod: PaymentMethod;
  modality: Modality | null;
  particularProduct: ParticularProduct | null;
  value: number;
}

interface GroupSiblingInfo {
  patientIds: string[];
  coTherapistProfessionalIds: string[];
  participants: GroupSiblingParticipant[];
}

/** Lê as linhas-irmãs de uma sessão conjugada (mesmo group_id) e os
 * coterapeutas vinculados a qualquer uma delas — usado para auto-detectar
 * participantes/coterapeutas ao transformar em recorrente uma consulta
 * avulsa que já é uma sessão conjugada, sem o staff precisar redigitá-los. */
async function getGroupSiblingInfo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  excludeAppointmentId?: string,
): Promise<GroupSiblingInfo> {
  const { data: rows } = await supabase
    .from("appointments")
    .select("id, patient_id, insurance_id, payment_method, modality, particular_product, value")
    .eq("group_id", groupId);

  const allIds = (rows ?? []).map((r) => r.id);
  const { data: cotherapistRows } = allIds.length
    ? await supabase.from("appointment_professionals").select("professional_id").in("appointment_id", allIds)
    : { data: [] as { professional_id: string }[] };

  const participantRows = (rows ?? []).filter((r) => r.id !== excludeAppointmentId);

  return {
    patientIds: Array.from(new Set((rows ?? []).map((r) => r.patient_id))),
    coTherapistProfessionalIds: Array.from(new Set((cotherapistRows ?? []).map((r) => r.professional_id))),
    participants: participantRows.map((r) => ({
      patientId: r.patient_id,
      insuranceId: r.insurance_id,
      paymentMethod: r.payment_method,
      modality: r.modality,
      particularProduct: r.particular_product,
      value: r.value,
    })),
  };
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

  let occurrences: OccurrencePreview[];
  if (appointment.group_id) {
    const sibling = await getGroupSiblingInfo(supabase, appointment.group_id);
    occurrences = await buildGroupPreview(
      appointment.professional_id,
      sibling.coTherapistProfessionalIds,
      sibling.patientIds,
      appointment.insurance_id,
      futureDates,
      appointment.start_time.slice(0, 5),
      appointment.modality ?? undefined,
    );
  } else {
    occurrences = await buildPreview(
      appointment.professional_id,
      appointment.insurance_id,
      futureDates,
      appointment.start_time.slice(0, 5),
      appointment.modality ?? undefined,
    );
  }
  return { error: null, occurrences };
}

/** Cria uma `appointment_series` a partir de uma consulta avulsa já
 * existente (paciente/profissional/convênio/pagamento/valor herdados dela,
 * nunca redigitados) e vincula essa mesma consulta como a 1ª ocorrência. */
export async function attachRecurrenceToAppointment(
  appointmentId: string,
  input: AttachRecurrenceInput,
): Promise<{ error: string | null; seriesId?: string; createdCount?: number; skippedDates?: SkippedDate[] }> {
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

  const sibling = appointment.group_id ? await getGroupSiblingInfo(supabase, appointment.group_id, appointmentId) : null;

  const preview =
    futureDates.length === 0
      ? []
      : sibling
        ? await buildGroupPreview(
            appointment.professional_id,
            sibling.coTherapistProfessionalIds,
            [appointment.patient_id, ...sibling.participants.map((p) => p.patientId)],
            appointment.insurance_id,
            futureDates,
            appointment.start_time.slice(0, 5),
            appointment.modality ?? undefined,
          )
        : await buildPreview(
            appointment.professional_id,
            appointment.insurance_id,
            futureDates,
            appointment.start_time.slice(0, 5),
            appointment.modality ?? undefined,
          );

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

  if (sibling) {
    if (sibling.participants.length > 0) {
      const { error: participantsError } = await admin.from("appointment_series_participants").insert(
        sibling.participants.map((p) => ({
          series_id: series.id,
          patient_id: p.patientId,
          insurance_id: p.insuranceId,
          payment_method: p.paymentMethod,
          modality: p.modality,
          particular_product: p.particularProduct,
        })),
      );
      if (participantsError) {
        await admin.from("appointment_series").delete().eq("id", series.id);
        return { error: "Não foi possível salvar os participantes adicionais da recorrência." };
      }
    }
    if (sibling.coTherapistProfessionalIds.length > 0) {
      const { error: cotherapistsError } = await admin.from("appointment_series_cotherapists").insert(
        sibling.coTherapistProfessionalIds.map((professionalId) => ({ series_id: series.id, professional_id: professionalId })),
      );
      if (cotherapistsError) {
        await admin.from("appointment_series").delete().eq("id", series.id);
        return { error: "Não foi possível salvar os coterapeutas da recorrência." };
      }
    }
  }

  // UPDATE (diferente do INSERT acima) passa pelo trigger prevent_appointment_tampering,
  // que decide o bypass de staff olhando auth.uid() — com o client admin (service role)
  // isso retorna null e a atualização é bloqueada. Por isso aqui usa o client autenticado
  // normal (mesmo padrão das demais UPDATEs em appointments neste arquivo).
  const { error: linkError } = await supabase
    .from("appointments")
    .update({ series_id: series.id })
    .eq("id", appointmentId);
  if (linkError) return { error: "Recorrência criada, mas não foi possível vincular o atendimento original." };

  let createdCount = toCreate.length;
  let skippedDates: SkippedDate[] = [];

  if (sibling) {
    const participants: GroupOccurrenceParticipant[] = [
      {
        patientId: appointment.patient_id,
        insuranceId: appointment.insurance_id,
        paymentMethod: appointment.payment_method,
        modality: appointment.modality,
        particularProduct: appointment.particular_product,
        value: appointment.value,
      },
      ...sibling.participants.map((p) => ({
        patientId: p.patientId,
        insuranceId: p.insuranceId,
        paymentMethod: p.paymentMethod,
        modality: p.modality,
        particularProduct: p.particularProduct,
        value: p.value,
      })),
    ];

    if (toCreate.length > 0) {
      const result = await createGroupOccurrences(
        admin,
        series.id,
        appointment.professional_id,
        participants,
        sibling.coTherapistProfessionalIds,
        appointment.specialty_id,
        toCreate,
        "staff",
        session.user.id,
      );
      createdCount = result.createdCount;
      skippedDates = result.skippedDates;
    } else {
      createdCount = 0;
    }
  } else if (toCreate.length > 0) {
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
      count: createdCount + 1,
      frequency: input.frequency,
      dayOfWeek,
      startTime: appointment.start_time,
      attachedFromAppointmentId: appointmentId,
      isGroup: !!sibling,
    },
  });

  return {
    error: null,
    seriesId: series.id,
    createdCount: createdCount + 1,
    skippedDates: skippedDates.length ? skippedDates : undefined,
  };
}

export interface SeriesDetail {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  specialtyId: string | null;
  insuranceId: string;
  insuranceName: string;
  paymentMethod: string;
  modality: Modality | null;
  particularProduct: ParticularProduct | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  maxOccurrences: number | null;
  status: string;
  additionalParticipantsCount: number;
  coTherapistCount: number;
}

export async function getSeriesDetail(id: string): Promise<SeriesDetail | null> {
  const supabase = await createClient();
  const { data: series } = await supabase.from("appointment_series").select("*").eq("id", id).single();
  if (!series) return null;

  const [{ data: patient }, { data: professional }, { data: insurance }, groupConfig] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", series.patient_id).single(),
    supabase.from("profiles").select("full_name").eq("id", series.professional_id).single(),
    supabase.from("insurances").select("name").eq("id", series.insurance_id).single(),
    getSeriesGroupConfig(series.id),
  ]);

  return {
    id: series.id,
    patientId: series.patient_id,
    patientName: patient?.full_name ?? "Paciente",
    professionalId: series.professional_id,
    professionalName: professional?.full_name ?? "Profissional",
    specialtyId: series.specialty_id,
    insuranceId: series.insurance_id,
    insuranceName: insurance?.name ?? "",
    paymentMethod: series.payment_method,
    modality: series.modality,
    particularProduct: series.particular_product,
    dayOfWeek: series.day_of_week,
    startTime: series.start_time,
    endTime: series.end_time,
    frequency: series.frequency,
    startDate: series.start_date,
    endDate: series.end_date,
    maxOccurrences: series.max_occurrences,
    status: series.status,
    additionalParticipantsCount: groupConfig.additionalParticipants.length,
    coTherapistCount: groupConfig.coTherapistProfessionalIds.length,
  };
}

export interface PatientSeriesRow {
  id: string;
  professionalName: string;
  frequency: string;
  dayLabel: string;
  startTime: string;
  status: string;
}

export async function listSeriesForPatient(patientId: string): Promise<PatientSeriesRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointment_series")
    .select("id, professional_id, frequency, day_of_week, start_time, status")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return [];

  const professionalIds = Array.from(new Set(data.map((s) => s.professional_id)));
  const { data: professionals } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", professionalIds);
  const nameById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));

  return data.map((s) => ({
    id: s.id,
    professionalName: nameById.get(s.professional_id) ?? "Profissional",
    frequency: s.frequency,
    dayLabel: WEEKDAY_LABELS[s.day_of_week],
    startTime: s.start_time,
    status: s.status,
  }));
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "semanal",
  biweekly: "quinzenal",
  monthly: "mensal",
};

const SCOPE_LABELS: Record<string, string> = {
  only: "apenas este atendimento",
  following: "este atendimento e os próximos",
  all: "toda a sequência",
};

function formatIsoDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatHm(time: string) {
  return time.slice(0, 5);
}

/** Traduz uma entrada crua de `audit_logs` (action + metadata em jsonb) numa
 * frase legível para quem não é técnico — recepção/admin, não só auditoria. */
function translateAuditEntry(action: string, metadata: Record<string, unknown>): string {
  switch (action) {
    case "appointment_series.created": {
      const dayOfWeek = metadata.dayOfWeek as number | undefined;
      const startTime = metadata.startTime as string | undefined;
      const count = metadata.count as number | undefined;
      const attached = Boolean(metadata.attachedFromAppointmentId);
      const dayLabel = dayOfWeek !== undefined ? WEEKDAY_LABELS[dayOfWeek] : "—";
      const timeLabel = startTime ? formatHm(startTime) : "—";
      return `${attached ? "Atendimento avulso transformado em recorrência" : "Recorrência criada"}: toda ${dayLabel} às ${timeLabel}${count ? ` (${count} atendimento${count > 1 ? "s" : ""})` : ""}.`;
    }
    case "appointment.rescheduled_occurrence": {
      const previousDate = metadata.previousDate as string | undefined;
      const previousTime = metadata.previousTime as string | undefined;
      const newDate = metadata.newDate as string | undefined;
      const newTime = metadata.newTime as string | undefined;
      const reason = metadata.reason as string | null | undefined;
      const from = previousDate ? `${formatIsoDate(previousDate)} ${formatHm(previousTime ?? "")}` : "—";
      const to = newDate ? `${formatIsoDate(newDate)} ${formatHm(newTime ?? "")}` : "—";
      return `Reagendou este atendimento de ${from} para ${to}${reason ? ` — motivo: ${reason}` : ""}.`;
    }
    case "appointment_series.rescheduled": {
      const scope = metadata.scope as string | undefined;
      const prevDay = metadata.previousDayOfWeek as number | undefined;
      const prevTime = metadata.previousStartTime as string | undefined;
      const newDay = metadata.newDayOfWeek as number | undefined;
      const newTime = metadata.newStartTime as string | undefined;
      const prevFreq = metadata.previousFrequency as string | undefined;
      const newFreq = metadata.newFrequency as string | undefined;
      const reason = metadata.reason as string | null | undefined;
      const replaced = metadata.occurrencesReplaced as number | undefined;
      const created = metadata.occurrencesCreated as number | undefined;
      const from = prevDay !== undefined ? `${WEEKDAY_LABELS[prevDay]} ${formatHm(prevTime ?? "")}` : "—";
      const to = newDay !== undefined ? `${WEEKDAY_LABELS[newDay]} ${formatHm(newTime ?? "")}` : "—";
      const freqChange =
        prevFreq && newFreq && prevFreq !== newFreq
          ? `, frequência ${FREQUENCY_LABELS[prevFreq] ?? prevFreq} → ${FREQUENCY_LABELS[newFreq] ?? newFreq}`
          : "";
      const scopeLabel = scope ? SCOPE_LABELS[scope] ?? scope : "";
      return `Alterou a recorrência (${scopeLabel}): de ${from} para ${to}${freqChange} — ${replaced ?? 0} atendimento(s) substituído(s), ${created ?? 0} novo(s)${reason ? ` — motivo: ${reason}` : ""}.`;
    }
    case "appointment_series.cancelled": {
      const scope = metadata.scope as string | undefined;
      const cancelledCount = metadata.cancelledCount as number | undefined;
      const scopeLabel = scope ? SCOPE_LABELS[scope] ?? scope : "";
      return `Cancelou a recorrência (${scopeLabel}) — ${cancelledCount ?? 0} atendimento(s) cancelado(s).`;
    }
    case "appointment_series.extended": {
      const createdCount = metadata.createdCount as number | undefined;
      return `Estendeu a recorrência — ${createdCount ?? 0} novo(s) atendimento(s) gerados.`;
    }
    default:
      return action;
  }
}

export interface SeriesHistoryEntry {
  id: number;
  actorName: string;
  date: string;
  summary: string;
}

/** Histórico de alterações de uma série, legível para admin/recepção — não
 * é o log técnico de `/audit` (que é admin-only e mostra JSON cru): aqui
 * reaproveitamos a mesma tabela `audit_logs`, só filtrada por esta série e
 * traduzida para frases humanas. */
export async function getSeriesHistory(seriesId: string): Promise<SeriesHistoryEntry[]> {
  await requireCanManageSeries(seriesId);
  const admin = createAdminClient();

  const [{ data: seriesLogs }, { data: apptLogs }] = await Promise.all([
    admin
      .from("audit_logs")
      .select("id, actor_id, action, metadata, created_at")
      .eq("entity", "appointment_series")
      .eq("entity_id", seriesId),
    admin
      .from("audit_logs")
      .select("id, actor_id, action, metadata, created_at")
      .eq("entity", "appointments")
      .eq("action", "appointment.rescheduled_occurrence")
      .contains("metadata", { seriesId }),
  ]);

  const all = [...(seriesLogs ?? []), ...(apptLogs ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  if (all.length === 0) return [];

  const actorIds = Array.from(new Set(all.map((l) => l.actor_id).filter((id): id is string => Boolean(id))));
  const { data: profiles } =
    actorIds.length > 0
      ? await admin.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return all.map((log) => ({
    id: log.id,
    actorName: log.actor_id ? nameById.get(log.actor_id) ?? "Equipe" : "Sistema",
    date: log.created_at,
    summary: translateAuditEntry(log.action, (log.metadata ?? {}) as Record<string, unknown>),
  }));
}

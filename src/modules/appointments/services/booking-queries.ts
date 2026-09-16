"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { PARTICULAR_INSURANCE_NAME } from "@/lib/constants";
import { toLocalIsoDate, todayLocalIso } from "@/lib/date";
import type { AppointmentStatus, Modality, ParticularProduct } from "@/lib/supabase/types";
import { generateSlotInstances, filterAvailableInstances } from "./slot-generator";

/** Status que ocupam vaga de horário (opostos: cancelada/remarcada/recusada
 * liberam). Exportada para reuso em recurrence-actions.ts (checagem de
 * conflito por paciente no preview de recorrência). */
export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "pendente",
  "confirmada",
  "concluida",
  "faltou",
  "faltou_justificada",
];

interface OccupancyRow {
  id: string;
  start_time: string;
  status: string;
  group_id: string | null;
}

/** Conta quantas vagas um profissional ocupa em cada horário, deduplicando
 * por sessão conjugada: várias linhas do mesmo group_id (ex.: um coterapeuta
 * vinculado a N pacientes da mesma sessão) contam como 1 ocupação, não N —
 * senão a capacidade dele esgotaria artificialmente. Linhas sem group_id
 * (o caso comum, atendimento simples ou grupo "implícito" via capacity)
 * continuam contando cada uma por si, igual sempre contou. */
function countOccupiedByStartTime(rows: OccupancyRow[]): Record<string, number> {
  const keysByStartTime = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!(ACTIVE_APPOINTMENT_STATUSES as string[]).includes(row.status)) continue;
    const startTime = row.start_time.slice(0, 5);
    const dedupeKey = row.group_id ?? row.id;
    const keys = keysByStartTime.get(startTime) ?? new Set<string>();
    keys.add(dedupeKey);
    keysByStartTime.set(startTime, keys);
  }
  const result: Record<string, number> = {};
  for (const [startTime, keys] of keysByStartTime) {
    result[startTime] = keys.size;
  }
  return result;
}

/** Checagem de leitura (não atômica — só para dar feedback no preview de
 * recorrência, migration 0068) do mesmo predicado de conflito por paciente
 * que book_appointment() garante de forma atômica na criação real: o
 * paciente já tem outro atendimento ativo nesse dia+horário fora do grupo
 * que está sendo montado? `excludeGroupId` deixa passar linhas que já
 * pertencem à MESMA sessão conjugada sendo gerada (não é conflito). */
export async function hasPatientConflict(
  patientId: string,
  date: string,
  startTime: string,
  excludeGroupId?: string | null,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, group_id")
    .eq("patient_id", patientId)
    .eq("appointment_date", date)
    .eq("start_time", startTime)
    .in("status", ACTIVE_APPOINTMENT_STATUSES);

  if (!data || data.length === 0) return false;
  if (!excludeGroupId) return true;
  return data.some((row) => row.group_id !== excludeGroupId);
}

/** Quando isPublic=true, usa o client de service role (bypassa RLS) — é o
 * que permite o wizard de agendamento público (sem sessão) ler
 * especialidades/convênios/profissionais/agenda, que hoje têm policy
 * `to authenticated`. Default false preserva o comportamento de todo call
 * site existente (client ligado à sessão, respeitando RLS). */
async function getBookingClient(isPublic: boolean) {
  return isPublic ? createAdminClient() : await createClient();
}

/** Rótulos usados só para compor o motivo textual de indisponibilidade —
 * a convenção de índice (0=domingo) é a mesma de `Date.prototype.getDay()`
 * usada em todo o módulo. */
const WEEKDAY_UNAVAILABLE_LABELS = [
  "aos domingos",
  "às segundas-feiras",
  "às terças-feiras",
  "às quartas-feiras",
  "às quintas-feiras",
  "às sextas-feiras",
  "aos sábados",
];

export async function getInsuranceByName(name: string, isPublic = false) {
  const supabase = await getBookingClient(isPublic);
  const { data } = await supabase.from("insurances").select("id, name").eq("name", name).single();
  return data;
}

export async function getBookableSpecialties(isPublic = false) {
  const supabase = await getBookingClient(isPublic);
  const { data } = await supabase
    .from("specialties")
    .select("id, name")
    .eq("status", "active")
    .order("name");
  return data ?? [];
}

export async function getBookableInsurances(specialtyId: string, isPublic = false) {
  const supabase = await getBookingClient(isPublic);

  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, status")
    .eq("specialty_id", specialtyId)
    .eq("status", "active");

  if (!professionals || professionals.length === 0) return [];

  const professionalIds = professionals.map((p) => p.id);
  // Particular é um valor global da clínica (Configurações da Clínica), não
  // mais por profissional — qualquer profissional ativo aceita Particular.
  const hasParticular = true;

  const { data: links } = await supabase
    .from("professional_insurances")
    .select("insurance_id")
    .in("professional_id", professionalIds);

  const insuranceIds = Array.from(new Set((links ?? []).map((l) => l.insurance_id)));

  const { data: insurances } =
    insuranceIds.length > 0
      ? await supabase
          .from("insurances")
          .select("id, name")
          .eq("status", "active")
          .in("id", insuranceIds)
      : { data: [] as { id: string; name: string }[] };

  const result = [...(insurances ?? [])];

  if (hasParticular) {
    const particular = await getInsuranceByName(PARTICULAR_INSURANCE_NAME, isPublic);
    if (particular && !result.some((i) => i.id === particular.id)) {
      result.unshift(particular);
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getBookableProfessionals(specialtyId: string, insuranceId: string, isPublic = false) {
  const supabase = await getBookingClient(isPublic);
  const particular = await getInsuranceByName(PARTICULAR_INSURANCE_NAME, isPublic);
  const isParticular = particular?.id === insuranceId;

  const { data: professionals } = await supabase
    .from("professionals")
    .select("*")
    .eq("specialty_id", specialtyId)
    .eq("status", "active");

  if (!professionals || professionals.length === 0) return [];

  let filtered = professionals;

  if (!isParticular) {
    const { data: links } = await supabase
      .from("professional_insurances")
      .select("professional_id")
      .eq("insurance_id", insuranceId)
      .in(
        "professional_id",
        professionals.map((p) => p.id),
      );
    const allowedIds = new Set((links ?? []).map((l) => l.professional_id));
    filtered = professionals.filter((p) => allowedIds.has(p.id));
  }
  // isParticular: Particular é global (Configurações da Clínica) — todo
  // profissional ativo aceita, sem filtro adicional.

  const profileIds = filtered.map((p) => p.id);
  if (profileIds.length === 0) return [];

  const { data: profiles } = await supabase.from("profiles").select("*").in("id", profileIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return Promise.all(
    filtered.map(async (professional) => {
      const profile = profileById.get(professional.id);
      return {
        ...professional,
        fullName: profile?.full_name ?? "Profissional",
        avatarUrl: profile ? await getAvatarSignedUrl(supabase, profile.avatar_path) : null,
      };
    }),
  );
}

/**
 * Igual a getBookableProfessionals, mas sem filtrar por especialidade — usado
 * no agendamento manual da recepção, onde a especialidade não é uma etapa
 * própria: ela é carregada automaticamente a partir do profissional
 * escolhido (cada profissional tem uma única especialidade).
 */
export async function getBookableProfessionalsByInsurance(insuranceId: string) {
  const supabase = await createClient();
  const particular = await getInsuranceByName(PARTICULAR_INSURANCE_NAME);
  const isParticular = particular?.id === insuranceId;

  const { data: professionals } = await supabase
    .from("professionals")
    .select("*")
    .eq("status", "active");

  if (!professionals || professionals.length === 0) return [];

  let filtered = professionals;

  if (!isParticular) {
    const { data: links } = await supabase
      .from("professional_insurances")
      .select("professional_id")
      .eq("insurance_id", insuranceId)
      .in(
        "professional_id",
        professionals.map((p) => p.id),
      );
    const allowedIds = new Set((links ?? []).map((l) => l.professional_id));
    filtered = professionals.filter((p) => allowedIds.has(p.id));
  }
  // isParticular: Particular é global (Configurações da Clínica) — todo
  // profissional ativo aceita, sem filtro adicional.

  if (filtered.length === 0) return [];

  const profileIds = filtered.map((p) => p.id);
  const specialtyIds = Array.from(
    new Set(filtered.map((p) => p.specialty_id).filter((id): id is string => Boolean(id))),
  );

  const [{ data: profiles }, { data: specialties }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", profileIds),
    specialtyIds.length > 0
      ? supabase.from("specialties").select("id, name").in("id", specialtyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const specialtyNameById = new Map((specialties ?? []).map((s) => [s.id, s.name]));

  return Promise.all(
    filtered.map(async (professional) => {
      const profile = profileById.get(professional.id);
      return {
        ...professional,
        fullName: profile?.full_name ?? "Profissional",
        specialtyName: professional.specialty_id
          ? specialtyNameById.get(professional.specialty_id) ?? "Especialista"
          : "Especialista",
        avatarUrl: profile ? await getAvatarSignedUrl(supabase, profile.avatar_path) : null,
      };
    }),
  );
}

function isBlockedDate(
  date: string,
  exceptions: { start_date: string; end_date: string }[],
  holidays?: Set<string>,
) {
  if (holidays?.has(date)) return true;
  return exceptions.some((exception) => date >= exception.start_date && date <= exception.end_date);
}

async function getHolidaySet(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("clinic_holidays").select("date");
  return new Set((data ?? []).map((h) => h.date));
}

/** Ids das consultas onde este profissional é COTERAPEUTA (não o principal)
 * — usado para somar a ocupação da agenda dele nas checagens de
 * disponibilidade/conflito abaixo, já que um coterapeuta também fica
 * ocupado no horário do atendimento compartilhado. */
async function getCoTherapistAppointmentIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  professionalId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("appointment_professionals")
    .select("appointment_id")
    .eq("professional_id", professionalId);
  return (data ?? []).map((r) => r.appointment_id);
}

export interface CoTherapistInfo {
  professionalId: string;
  fullName: string;
  absenceStatus: "faltou" | "faltou_justificada" | null;
  absenceReason: string | null;
}

/** Coterapeutas vinculados a uma consulta específica (não inclui o
 * principal). RLS de appointment_professionals já restringe quem pode ver
 * isso a quem já tem acesso à consulta. */
export async function getCoTherapistsForAppointment(appointmentId: string): Promise<CoTherapistInfo[]> {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("appointment_professionals")
    .select("professional_id, absence_status, absence_reason")
    .eq("appointment_id", appointmentId);

  if (!links || links.length === 0) return [];

  const professionalIds = links.map((l) => l.professional_id);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", professionalIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return links.map((link) => ({
    professionalId: link.professional_id,
    fullName: nameById.get(link.professional_id) ?? "Profissional",
    absenceStatus: link.absence_status,
    absenceReason: link.absence_reason,
  }));
}

/** Duração efetiva de uma consulta: override por convênio+profissional (e
 * modalidade, quando o convênio for Unimed/Postal Saúde) se existir, senão a
 * duração padrão do profissional. Nunca fixo no código. */
export async function getEffectiveDuration(
  professionalId: string,
  insuranceId: string,
  modality?: Modality,
  isPublic = false,
): Promise<number> {
  const supabase = await getBookingClient(isPublic);

  let query = supabase
    .from("professional_insurances")
    .select("duration_minutes")
    .eq("professional_id", professionalId)
    .eq("insurance_id", insuranceId);
  if (modality) query = query.eq("modality", modality);

  const { data: link } = await query.maybeSingle();

  if (link?.duration_minutes) return link.duration_minutes;

  const { data: professional } = await supabase
    .from("professionals")
    .select("consultation_duration_minutes")
    .eq("id", professionalId)
    .single();

  return professional?.consultation_duration_minutes ?? 30;
}

export async function getAvailableDates(professionalId: string, daysAhead = 45, isPublic = false) {
  const supabase = await getBookingClient(isPublic);
  const [{ data: slots }, { data: exceptions }, holidays] = await Promise.all([
    supabase
      .from("schedule_slots")
      .select("day_of_week")
      .eq("professional_id", professionalId)
      .eq("status", "active"),
    supabase
      .from("schedule_exceptions")
      .select("start_date, end_date")
      .eq("professional_id", professionalId),
    getHolidaySet(supabase),
  ]);

  const validWeekdays = new Set((slots ?? []).map((s) => s.day_of_week));
  if (validWeekdays.size === 0) return [];

  const dates: string[] = [];
  const today = new Date();
  for (let i = 1; i <= daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const iso = toLocalIsoDate(date);
    if (validWeekdays.has(date.getDay()) && !isBlockedDate(iso, exceptions ?? [], holidays)) {
      dates.push(iso);
    }
  }
  return dates;
}

export type DayAvailabilityStatus = "available" | "no-schedule" | "blocked" | "full" | "past";

export interface DayAvailability {
  date: string;
  status: DayAvailabilityStatus;
  reason?: string;
  freeSlotsCount: number;
}

/**
 * Disponibilidade de um mês inteiro para um profissional+convênio, num único
 * lote de queries (não uma por dia) — alimenta o calendário visual. Nunca
 * devolve um status "genérico": todo dia sem horário livre carrega o motivo
 * concreto (sem expediente naquele dia da semana, bloqueio/férias com o
 * `reason` cadastrado, feriado, ou agenda cheia).
 */
export async function getMonthAvailability(
  professionalId: string,
  insuranceId: string,
  year: number,
  month: number,
  modality?: Modality,
): Promise<DayAvailability[]> {
  const supabase = await createClient();

  let durationQuery = supabase
    .from("professional_insurances")
    .select("duration_minutes")
    .eq("professional_id", professionalId)
    .eq("insurance_id", insuranceId);
  if (modality) durationQuery = durationQuery.eq("modality", modality);

  const [{ data: professional }, { data: durationOverride }] = await Promise.all([
    supabase
      .from("professionals")
      .select("consultation_duration_minutes")
      .eq("id", professionalId)
      .single(),
    durationQuery.maybeSingle(),
  ]);
  if (!professional) return [];
  const effectiveDuration = durationOverride?.duration_minutes ?? professional.consultation_duration_minutes;

  const [{ data: slots }, { data: exceptions }, holidays] = await Promise.all([
    supabase
      .from("schedule_slots")
      .select("*")
      .eq("professional_id", professionalId)
      .eq("status", "active"),
    supabase
      .from("schedule_exceptions")
      .select("start_date, end_date, reason")
      .eq("professional_id", professionalId),
    getHolidaySet(supabase),
  ]);

  const slotsByWeekday = new Map<number, NonNullable<typeof slots>>();
  for (const slot of slots ?? []) {
    const list = slotsByWeekday.get(slot.day_of_week) ?? [];
    list.push(slot);
    slotsByWeekday.set(slot.day_of_week, list);
  }

  const { data: links } = await supabase
    .from("schedule_slot_insurances")
    .select("slot_id, insurance_id")
    .in(
      "slot_id",
      (slots ?? []).map((s) => s.id),
    );
  const insurancesBySlot = new Map<string, Set<string>>();
  for (const link of links ?? []) {
    if (!insurancesBySlot.has(link.slot_id)) insurancesBySlot.set(link.slot_id, new Set());
    insurancesBySlot.get(link.slot_id)!.add(link.insurance_id);
  }

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const monthStart = toLocalIsoDate(firstDay);
  const monthEnd = toLocalIsoDate(lastDay);

  const coTherapistAppointmentIds = await getCoTherapistAppointmentIds(supabase, professionalId);

  const [{ data: appointments }, { data: coTherapistAppointments }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, appointment_date, start_time, status, group_id")
      .eq("professional_id", professionalId)
      .gte("appointment_date", monthStart)
      .lte("appointment_date", monthEnd),
    coTherapistAppointmentIds.length > 0
      ? supabase
          .from("appointments")
          .select("id, appointment_date, start_time, status, group_id")
          .in("id", coTherapistAppointmentIds)
          .gte("appointment_date", monthStart)
          .lte("appointment_date", monthEnd)
      : Promise.resolve({ data: [] as (OccupancyRow & { appointment_date: string })[] }),
  ]);

  // Mesmo dedupe de countOccupiedByStartTime, mas por dia: um group_id nunca
  // atravessa datas diferentes (garantido pela trigger
  // appointments_validate_group, migração 0067), então deduplicar dentro de
  // cada dia já é suficiente e mantém a estrutura por-data existente.
  const rowsByDate = new Map<string, OccupancyRow[]>();
  for (const appt of [...(appointments ?? []), ...(coTherapistAppointments ?? [])]) {
    const rows = rowsByDate.get(appt.appointment_date) ?? [];
    rows.push(appt);
    rowsByDate.set(appt.appointment_date, rows);
  }
  const bookedByDate = new Map<string, Record<string, number>>();
  for (const [date, rows] of rowsByDate) {
    bookedByDate.set(date, countOccupiedByStartTime(rows));
  }

  const todayIso = todayLocalIso();
  const results: DayAvailability[] = [];
  const daysInMonth = lastDay.getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const current = new Date(year, month - 1, day);
    const iso = toLocalIsoDate(current);
    const weekday = current.getDay();

    if (iso < todayIso) {
      results.push({ date: iso, status: "past", freeSlotsCount: 0 });
      continue;
    }

    if (holidays.has(iso)) {
      results.push({ date: iso, status: "blocked", reason: "Feriado.", freeSlotsCount: 0 });
      continue;
    }

    const exception = (exceptions ?? []).find((e) => iso >= e.start_date && iso <= e.end_date);
    if (exception) {
      results.push({
        date: iso,
        status: "blocked",
        reason: exception.reason || "Bloqueio na agenda do profissional.",
        freeSlotsCount: 0,
      });
      continue;
    }

    const daySlots = slotsByWeekday.get(weekday) ?? [];
    const matchingSlots = daySlots.filter((slot) => {
      const restricted = insurancesBySlot.get(slot.id);
      return !restricted || restricted.size === 0 || restricted.has(insuranceId);
    });

    if (matchingSlots.length === 0) {
      results.push({
        date: iso,
        status: "no-schedule",
        reason: `O profissional não atende ${WEEKDAY_UNAVAILABLE_LABELS[weekday]}.`,
        freeSlotsCount: 0,
      });
      continue;
    }

    const bookedCountByStartTime = bookedByDate.get(iso) ?? {};
    let freeSlotsCount = 0;
    for (const slot of matchingSlots) {
      const instances = generateSlotInstances(
        slot.start_time.slice(0, 5),
        slot.end_time.slice(0, 5),
        effectiveDuration,
      );
      freeSlotsCount += filterAvailableInstances(instances, slot.capacity, bookedCountByStartTime).length;
    }

    if (freeSlotsCount === 0) {
      results.push({
        date: iso,
        status: "full",
        reason: "Todos os horários deste dia já foram ocupados.",
        freeSlotsCount: 0,
      });
    } else {
      results.push({ date: iso, status: "available", freeSlotsCount });
    }
  }

  return results;
}

export async function getAvailableTimes(
  professionalId: string,
  insuranceId: string,
  date: string,
  modality?: Modality,
  isPublic = false,
) {
  const supabase = await getBookingClient(isPublic);

  let durationQuery = supabase
    .from("professional_insurances")
    .select("duration_minutes")
    .eq("professional_id", professionalId)
    .eq("insurance_id", insuranceId);
  if (modality) durationQuery = durationQuery.eq("modality", modality);

  const [{ data: professional }, { data: durationOverride }] = await Promise.all([
    supabase
      .from("professionals")
      .select("consultation_duration_minutes")
      .eq("id", professionalId)
      .single(),
    durationQuery.maybeSingle(),
  ]);
  if (!professional) return [];
  const effectiveDuration = durationOverride?.duration_minutes ?? professional.consultation_duration_minutes;

  const [{ data: exceptions }, holidays] = await Promise.all([
    supabase
      .from("schedule_exceptions")
      .select("start_date, end_date")
      .eq("professional_id", professionalId),
    getHolidaySet(supabase),
  ]);
  if (isBlockedDate(date, exceptions ?? [], holidays)) return [];

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();

  const { data: slots } = await supabase
    .from("schedule_slots")
    .select("*")
    .eq("professional_id", professionalId)
    .eq("day_of_week", dayOfWeek)
    .eq("status", "active");

  if (!slots || slots.length === 0) return [];

  const { data: links } = await supabase
    .from("schedule_slot_insurances")
    .select("slot_id, insurance_id")
    .in(
      "slot_id",
      slots.map((s) => s.id),
    );

  const insurancesBySlot = new Map<string, Set<string>>();
  for (const link of links ?? []) {
    if (!insurancesBySlot.has(link.slot_id)) insurancesBySlot.set(link.slot_id, new Set());
    insurancesBySlot.get(link.slot_id)!.add(link.insurance_id);
  }

  const matchingSlots = slots.filter((slot) => {
    const restricted = insurancesBySlot.get(slot.id);
    return !restricted || restricted.size === 0 || restricted.has(insuranceId);
  });

  if (matchingSlots.length === 0) return [];

  const coTherapistAppointmentIds = await getCoTherapistAppointmentIds(supabase, professionalId);

  const [{ data: existingAppointments }, { data: coTherapistAppointments }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, start_time, status, group_id")
      .eq("professional_id", professionalId)
      .eq("appointment_date", date),
    coTherapistAppointmentIds.length > 0
      ? supabase
          .from("appointments")
          .select("id, start_time, status, group_id")
          .in("id", coTherapistAppointmentIds)
          .eq("appointment_date", date)
      : Promise.resolve({ data: [] as OccupancyRow[] }),
  ]);

  const bookedCountByStartTime = countOccupiedByStartTime([
    ...(existingAppointments ?? []),
    ...(coTherapistAppointments ?? []),
  ]);

  const results: { slotId: string; startTime: string; endTime: string }[] = [];
  for (const slot of matchingSlots) {
    const instances = generateSlotInstances(
      slot.start_time.slice(0, 5),
      slot.end_time.slice(0, 5),
      effectiveDuration,
    );
    const available = filterAvailableInstances(instances, slot.capacity, bookedCountByStartTime);
    for (const instance of available) {
      results.push({ slotId: slot.id, ...instance });
    }
  }

  return results.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export type ProfessionalPricingResult =
  | { insuranceKind: "convenio"; options: { modality: Modality; value: number }[] }
  | { insuranceKind: "particular"; options: { product: ParticularProduct; value: number }[] };

/** Preço aplicável a um profissional+convênio: para Particular, lê os 2
 * valores globais em Configurações da Clínica (Consulta/Pacote); para os
 * demais convênios (Unimed, Postal Saúde), lê o valor por modalidade
 * (ABA/Comum) cadastrado para aquele profissional — se a modalidade não
 * tiver linha cadastrada, ela simplesmente não aparece nas opções, o que é a
 * base para bloquear o agendamento nesse caso. */
export async function getProfessionalPricing(
  professionalId: string,
  insuranceId: string,
  isPublic = false,
): Promise<ProfessionalPricingResult> {
  const supabase = await getBookingClient(isPublic);
  const particular = await getInsuranceByName(PARTICULAR_INSURANCE_NAME, isPublic);

  if (particular?.id === insuranceId) {
    const { data: settings } = await supabase
      .from("clinic_settings")
      .select("price_particular_consultation, price_particular_package")
      .eq("id", 1)
      .single();

    const options: { product: ParticularProduct; value: number }[] = [];
    if (settings?.price_particular_consultation != null)
      options.push({ product: "consulta", value: settings.price_particular_consultation });
    if (settings?.price_particular_package != null)
      options.push({ product: "pacote", value: settings.price_particular_package });

    return { insuranceKind: "particular", options };
  }

  const { data } = await supabase
    .from("professional_insurances")
    .select("modality, value")
    .eq("professional_id", professionalId)
    .eq("insurance_id", insuranceId);

  return {
    insuranceKind: "convenio",
    options: (data ?? []).map((row) => ({ modality: row.modality, value: row.value })),
  };
}

/** Resolve o valor de uma consulta a partir da precificação real (nunca do
 * client) e valida que a modalidade/produto escolhido tem valor cadastrado.
 * Mesma mensagem de erro em ambos os casos, como pedido na regra de negócio. */
export async function resolveAppointmentValue(
  professionalId: string,
  insuranceId: string,
  modality?: Modality,
  particularProduct?: ParticularProduct,
  isPublic = false,
): Promise<{ value: number | null; error: string | null }> {
  const pricing = await getProfessionalPricing(professionalId, insuranceId, isPublic);

  const match =
    pricing.insuranceKind === "convenio"
      ? pricing.options.find((option) => option.modality === modality)
      : pricing.options.find((option) => option.product === particularProduct);

  if (!match) {
    return { value: null, error: "Este profissional ainda não possui um valor cadastrado para essa modalidade." };
  }

  return { value: match.value, error: null };
}

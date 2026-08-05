"use server";

import { createClient } from "@/lib/supabase/server";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { PARTICULAR_INSURANCE_NAME } from "@/lib/constants";
import { generateSlotInstances, filterAvailableInstances } from "./slot-generator";

const ACTIVE_APPOINTMENT_STATUSES = ["pendente", "confirmada", "concluida", "faltou"];

export async function getInsuranceByName(name: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("insurances").select("id, name").eq("name", name).single();
  return data;
}

export async function getBookableSpecialties() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("specialties")
    .select("id, name")
    .eq("status", "active")
    .order("name");
  return data ?? [];
}

export async function getBookableInsurances(specialtyId: string) {
  const supabase = await createClient();

  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, price_particular_card, price_particular_pix, price_particular_cash, status")
    .eq("specialty_id", specialtyId)
    .eq("status", "active");

  if (!professionals || professionals.length === 0) return [];

  const professionalIds = professionals.map((p) => p.id);
  const hasParticular = professionals.some(
    (p) => p.price_particular_card || p.price_particular_pix || p.price_particular_cash,
  );

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
    const particular = await getInsuranceByName(PARTICULAR_INSURANCE_NAME);
    if (particular && !result.some((i) => i.id === particular.id)) {
      result.unshift(particular);
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getBookableProfessionals(specialtyId: string, insuranceId: string) {
  const supabase = await createClient();
  const particular = await getInsuranceByName(PARTICULAR_INSURANCE_NAME);
  const isParticular = particular?.id === insuranceId;

  const { data: professionals } = await supabase
    .from("professionals")
    .select("*")
    .eq("specialty_id", specialtyId)
    .eq("status", "active");

  if (!professionals || professionals.length === 0) return [];

  let filtered = professionals;

  if (isParticular) {
    filtered = professionals.filter(
      (p) => p.price_particular_card || p.price_particular_pix || p.price_particular_cash,
    );
  } else {
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

  if (isParticular) {
    filtered = professionals.filter(
      (p) => p.price_particular_card || p.price_particular_pix || p.price_particular_cash,
    );
  } else {
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

/** Duração efetiva de uma consulta: override por convênio+profissional se
 * existir, senão a duração padrão do profissional. Nunca fixo no código. */
export async function getEffectiveDuration(professionalId: string, insuranceId: string): Promise<number> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("professional_insurances")
    .select("duration_minutes")
    .eq("professional_id", professionalId)
    .eq("insurance_id", insuranceId)
    .maybeSingle();

  if (link?.duration_minutes) return link.duration_minutes;

  const { data: professional } = await supabase
    .from("professionals")
    .select("consultation_duration_minutes")
    .eq("id", professionalId)
    .single();

  return professional?.consultation_duration_minutes ?? 30;
}

export async function getAvailableDates(professionalId: string, daysAhead = 45) {
  const supabase = await createClient();
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
    const iso = date.toISOString().slice(0, 10);
    if (validWeekdays.has(date.getDay()) && !isBlockedDate(iso, exceptions ?? [], holidays)) {
      dates.push(iso);
    }
  }
  return dates;
}

export async function getAvailableTimes(
  professionalId: string,
  insuranceId: string,
  date: string,
) {
  const supabase = await createClient();

  const [{ data: professional }, { data: durationOverride }] = await Promise.all([
    supabase
      .from("professionals")
      .select("consultation_duration_minutes")
      .eq("id", professionalId)
      .single(),
    supabase
      .from("professional_insurances")
      .select("duration_minutes")
      .eq("professional_id", professionalId)
      .eq("insurance_id", insuranceId)
      .maybeSingle(),
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

  const { data: existingAppointments } = await supabase
    .from("appointments")
    .select("start_time, status")
    .eq("professional_id", professionalId)
    .eq("appointment_date", date);

  const bookedCountByStartTime: Record<string, number> = {};
  for (const appt of existingAppointments ?? []) {
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(appt.status)) continue;
    bookedCountByStartTime[appt.start_time.slice(0, 5)] =
      (bookedCountByStartTime[appt.start_time.slice(0, 5)] ?? 0) + 1;
  }

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

export async function getProfessionalPricing(professionalId: string, insuranceId: string) {
  const supabase = await createClient();
  const particular = await getInsuranceByName(PARTICULAR_INSURANCE_NAME);

  if (particular?.id === insuranceId) {
    const { data: professional } = await supabase
      .from("professionals")
      .select("price_particular_card, price_particular_pix, price_particular_cash")
      .eq("id", professionalId)
      .single();

    const options: { paymentMethod: "cartao" | "pix" | "dinheiro"; value: number }[] = [];
    if (professional?.price_particular_card)
      options.push({ paymentMethod: "cartao", value: professional.price_particular_card });
    if (professional?.price_particular_pix)
      options.push({ paymentMethod: "pix", value: professional.price_particular_pix });
    if (professional?.price_particular_cash)
      options.push({ paymentMethod: "dinheiro", value: professional.price_particular_cash });
    return options;
  }

  const { data } = await supabase
    .from("professional_insurances")
    .select("value")
    .eq("professional_id", professionalId)
    .eq("insurance_id", insuranceId)
    .single();

  return data ? [{ paymentMethod: "convenio" as const, value: data.value }] : [];
}

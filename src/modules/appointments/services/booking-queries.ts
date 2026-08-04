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

function isBlockedDate(date: string, exceptions: { start_date: string; end_date: string }[]) {
  return exceptions.some((exception) => date >= exception.start_date && date <= exception.end_date);
}

export async function getAvailableDates(professionalId: string, daysAhead = 45) {
  const supabase = await createClient();
  const [{ data: slots }, { data: exceptions }] = await Promise.all([
    supabase
      .from("schedule_slots")
      .select("day_of_week")
      .eq("professional_id", professionalId)
      .eq("status", "active"),
    supabase
      .from("schedule_exceptions")
      .select("start_date, end_date")
      .eq("professional_id", professionalId),
  ]);

  const validWeekdays = new Set((slots ?? []).map((s) => s.day_of_week));
  if (validWeekdays.size === 0) return [];

  const dates: string[] = [];
  const today = new Date();
  for (let i = 1; i <= daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const iso = date.toISOString().slice(0, 10);
    if (validWeekdays.has(date.getDay()) && !isBlockedDate(iso, exceptions ?? [])) {
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

  const { data: professional } = await supabase
    .from("professionals")
    .select("consultation_duration_minutes")
    .eq("id", professionalId)
    .single();
  if (!professional) return [];

  const { data: exceptions } = await supabase
    .from("schedule_exceptions")
    .select("start_date, end_date")
    .eq("professional_id", professionalId);
  if (isBlockedDate(date, exceptions ?? [])) return [];

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
      professional.consultation_duration_minutes,
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

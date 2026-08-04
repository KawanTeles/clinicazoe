import { createClient } from "@/lib/supabase/server";

export { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";

export async function getScheduleExceptions(professionalId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedule_exceptions")
    .select("*")
    .eq("professional_id", professionalId)
    .order("start_date", { ascending: false });
  return data ?? [];
}

export async function getScheduleForProfessional(professionalId: string) {
  const supabase = await createClient();

  const { data: slots } = await supabase
    .from("schedule_slots")
    .select("*")
    .eq("professional_id", professionalId)
    .order("day_of_week")
    .order("start_time");

  if (!slots || slots.length === 0) return [];

  const { data: links } = await supabase
    .from("schedule_slot_insurances")
    .select("slot_id, insurance_id")
    .in(
      "slot_id",
      slots.map((s) => s.id),
    );

  const insuranceIds = Array.from(new Set((links ?? []).map((link) => link.insurance_id)));
  const { data: insurances } =
    insuranceIds.length > 0
      ? await supabase.from("insurances").select("id, name").in("id", insuranceIds)
      : { data: [] as { id: string; name: string }[] };

  const nameById = new Map((insurances ?? []).map((i) => [i.id, i.name]));

  return slots.map((slot) => ({
    ...slot,
    insuranceNames: (links ?? [])
      .filter((link) => link.slot_id === slot.id)
      .map((link) => nameById.get(link.insurance_id))
      .filter((name): name is string => Boolean(name)),
  }));
}

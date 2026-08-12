import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildIlikeFilterValue } from "@/lib/postgrest-filter";
import type { Modality, WaitlistPeriod, WaitlistStatus } from "@/lib/supabase/types";

const PAGE_SIZE = 20;

export interface WaitlistListItem {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  specialtyId: string;
  specialtyName: string;
  professionalId: string | null;
  professionalName: string | null;
  insuranceId: string;
  insuranceName: string;
  modality: Modality | null;
  periodPreference: WaitlistPeriod | null;
  preferredDays: number[];
  notes: string | null;
  status: WaitlistStatus;
  appointmentId: string | null;
  contactedAt: string | null;
  offeredAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
}

export interface WaitlistFilters {
  specialtyId?: string;
  professionalId?: string;
  insuranceId?: string;
  status?: WaitlistStatus;
  date?: string;
  search?: string;
  page?: number;
}

async function denormalize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: {
    id: string;
    patient_id: string;
    patient_name: string;
    patient_phone: string;
    patient_email: string | null;
    specialty_id: string;
    professional_id: string | null;
    insurance_id: string;
    modality: Modality | null;
    period_preference: WaitlistPeriod | null;
    preferred_days: number[];
    notes: string | null;
    status: WaitlistStatus;
    appointment_id: string | null;
    contacted_at: string | null;
    offered_at: string | null;
    accepted_at: string | null;
    declined_at: string | null;
    created_at: string;
  }[],
): Promise<WaitlistListItem[]> {
  if (rows.length === 0) return [];

  const specialtyIds = Array.from(new Set(rows.map((r) => r.specialty_id)));
  const professionalIds = Array.from(
    new Set(rows.map((r) => r.professional_id).filter((id): id is string => Boolean(id))),
  );
  const insuranceIds = Array.from(new Set(rows.map((r) => r.insurance_id)));

  const [{ data: specialties }, { data: professionals }, { data: insurances }] = await Promise.all([
    supabase.from("specialties").select("id, name").in("id", specialtyIds),
    professionalIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", professionalIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    supabase.from("insurances").select("id, name").in("id", insuranceIds),
  ]);

  const specialtyById = new Map((specialties ?? []).map((s) => [s.id, s.name]));
  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));
  const insuranceById = new Map((insurances ?? []).map((i) => [i.id, i.name]));

  return rows.map((row): WaitlistListItem => ({
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientPhone: row.patient_phone,
    patientEmail: row.patient_email,
    specialtyId: row.specialty_id,
    specialtyName: specialtyById.get(row.specialty_id) ?? "",
    professionalId: row.professional_id,
    professionalName: row.professional_id ? professionalById.get(row.professional_id) ?? null : null,
    insuranceId: row.insurance_id,
    insuranceName: insuranceById.get(row.insurance_id) ?? "",
    modality: row.modality,
    periodPreference: row.period_preference,
    preferredDays: row.preferred_days ?? [],
    notes: row.notes,
    status: row.status,
    appointmentId: row.appointment_id,
    contactedAt: row.contacted_at,
    offeredAt: row.offered_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    createdAt: row.created_at,
  }));
}

export async function getWaitlistEntries(
  filters: WaitlistFilters,
): Promise<{ items: WaitlistListItem[]; totalPages: number }> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);

  let query = supabase.from("waitlist_entries").select("*", { count: "exact" }).order("created_at", { ascending: false });

  if (filters.specialtyId) query = query.eq("specialty_id", filters.specialtyId);
  if (filters.professionalId) query = query.eq("professional_id", filters.professionalId);
  if (filters.insuranceId) query = query.eq("insurance_id", filters.insuranceId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.search?.trim()) {
    const ilikeValue = buildIlikeFilterValue(filters.search.trim());
    query = query.or(`patient_name.ilike.${ilikeValue},patient_phone.ilike.${ilikeValue}`);
  }
  if (filters.date) {
    const start = `${filters.date}T00:00:00.000Z`;
    const end = `${filters.date}T23:59:59.999Z`;
    query = query.gte("created_at", start).lte("created_at", end);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  const items = await denormalize(supabase, data ?? []);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return { items, totalPages };
}

/** Total de pacientes aguardando — usado no card do Dashboard. */
export async function getWaitlistWaitingCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("waitlist_entries")
    .select("id", { count: "exact", head: true })
    .eq("status", "aguardando");
  return count ?? 0;
}

/** Aguardando E ainda não vistas pela equipe — usado no badge da sidebar.
 * Zera automaticamente quando a equipe abre o módulo (markWaitlistAsSeen). */
export async function getWaitlistUnseenCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("waitlist_entries")
    .select("id", { count: "exact", head: true })
    .eq("status", "aguardando")
    .is("viewed_at", null);
  return count ?? 0;
}

export async function getWaitlistStatusCounts(): Promise<Record<WaitlistStatus, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("waitlist_entries").select("status");

  const counts: Record<WaitlistStatus, number> = {
    aguardando: 0,
    contato_realizado: 0,
    vaga_oferecida: 0,
    agendado: 0,
    cancelado: 0,
    sem_interesse: 0,
  };
  for (const row of data ?? []) {
    counts[row.status as WaitlistStatus] += 1;
  }
  return counts;
}

export async function getWaitlistEntry(id: string): Promise<WaitlistListItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("waitlist_entries").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const [item] = await denormalize(supabase, [data]);
  return item ?? null;
}

/** Usada ao cancelar uma consulta: encontra entradas "aguardando" compatíveis
 * com a vaga liberada (mesma especialidade e convênio sempre; profissional e
 * modalidade só quando a entrada tiver essa preferência definida). */
export async function findCompatibleWaitlistEntries(params: {
  specialtyId: string | null;
  professionalId: string;
  insuranceId: string;
  modality: Modality | null;
}): Promise<WaitlistListItem[]> {
  if (!params.specialtyId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("waitlist_entries")
    .select("*")
    .eq("status", "aguardando")
    .eq("specialty_id", params.specialtyId)
    .eq("insurance_id", params.insuranceId);

  const rows = (data ?? []).filter(
    (row) =>
      (row.professional_id === null || row.professional_id === params.professionalId) &&
      (row.modality === null || row.modality === params.modality),
  );

  return denormalize(supabase, rows);
}

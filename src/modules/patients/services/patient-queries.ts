import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PatientDetailsRow = Database["public"]["Tables"]["patient_details"]["Row"];

export interface PatientListItem {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  cpf: string | null;
  city: string | null;
  preferredInsuranceName: string | null;
  createdAt: string;
}

const PAGE_SIZE = 20;

export async function listPatients(params: {
  search?: string;
  insuranceId?: string;
  status?: "active" | "inactive";
  page?: number;
}): Promise<{ items: PatientListItem[]; totalPages: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim();

  let matchingIds: string[] | null = null;

  if (search) {
    const [{ data: byProfile }, { data: byCpf }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .eq("role", "paciente")
        .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`),
      supabase.from("patient_details").select("id").ilike("cpf", `%${search}%`),
    ]);

    matchingIds = Array.from(
      new Set([...(byProfile ?? []).map((p) => p.id), ...(byCpf ?? []).map((p) => p.id)]),
    );

    if (matchingIds.length === 0) return { items: [], totalPages: 1 };
  }

  if (params.insuranceId) {
    const { data: byInsurance } = await supabase
      .from("patient_details")
      .select("id")
      .eq("preferred_insurance_id", params.insuranceId);
    const insuranceIds = new Set((byInsurance ?? []).map((p) => p.id));
    matchingIds = matchingIds ? matchingIds.filter((id) => insuranceIds.has(id)) : Array.from(insuranceIds);
    if (matchingIds.length === 0) return { items: [], totalPages: 1 };
  }

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("role", "paciente")
    .order("full_name", { ascending: true });

  if (params.status) query = query.eq("status", params.status);
  if (matchingIds) query = query.in("id", matchingIds);

  const from = (page - 1) * PAGE_SIZE;
  const { data: profiles, count } = await query.range(from, from + PAGE_SIZE - 1);

  const items = await denormalize(supabase, profiles ?? []);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return { items, totalPages };
}

async function denormalize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profiles: ProfileRow[],
): Promise<PatientListItem[]> {
  if (profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);
  const { data: details } = await supabase
    .from("patient_details")
    .select("id, cpf, city, preferred_insurance_id")
    .in("id", ids);

  const detailsById = new Map((details ?? []).map((d) => [d.id, d]));

  const insuranceIds = Array.from(
    new Set((details ?? []).map((d) => d.preferred_insurance_id).filter((id): id is string => Boolean(id))),
  );
  const { data: insurances } =
    insuranceIds.length > 0
      ? await supabase.from("insurances").select("id, name").in("id", insuranceIds)
      : { data: [] as { id: string; name: string }[] };
  const insuranceNameById = new Map((insurances ?? []).map((i) => [i.id, i.name]));

  return profiles.map((profile) => {
    const detail = detailsById.get(profile.id);
    return {
      id: profile.id,
      fullName: profile.full_name,
      phone: profile.phone,
      status: profile.status,
      cpf: detail?.cpf ?? null,
      city: detail?.city ?? null,
      preferredInsuranceName: detail?.preferred_insurance_id
        ? insuranceNameById.get(detail.preferred_insurance_id) ?? null
        : null,
      createdAt: profile.created_at,
    };
  });
}

export interface PatientDetail {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  avatarPath: string | null;
  details: Omit<PatientDetailsRow, "id" | "created_at" | "updated_at"> | null;
}

export async function getPatientDetail(id: string): Promise<PatientDetail | null> {
  const supabase = await createClient();

  const [{ data: profile }, { data: details }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).eq("role", "paciente").maybeSingle(),
    supabase.from("patient_details").select("*").eq("id", id).maybeSingle(),
  ]);

  if (!profile) return null;

  return {
    id: profile.id,
    fullName: profile.full_name,
    phone: profile.phone,
    status: profile.status,
    avatarPath: profile.avatar_path,
    details: details
      ? {
          cpf: details.cpf,
          birth_date: details.birth_date,
          email: details.email,
          whatsapp: details.whatsapp,
          address: details.address,
          city: details.city,
          preferred_insurance_id: details.preferred_insurance_id,
          insurance_card_number: details.insurance_card_number,
          insurance_card_valid_until: details.insurance_card_valid_until,
          notes: details.notes,
          preferred_professional_id: details.preferred_professional_id,
        }
      : null,
  };
}

export async function getPatientMessages(patientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_messages")
    .select("id, type, appointment_id, created_at, sent_by")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return [];

  const senderIds = Array.from(new Set(data.map((m) => m.sent_by).filter((id): id is string => Boolean(id))));
  const { data: senders } =
    senderIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", senderIds)
      : { data: [] as { id: string; full_name: string }[] };
  const senderById = new Map((senders ?? []).map((s) => [s.id, s.full_name]));

  return data.map((m) => ({
    id: m.id,
    type: m.type,
    appointmentId: m.appointment_id,
    createdAt: m.created_at,
    sentByName: m.sent_by ? senderById.get(m.sent_by) ?? null : null,
  }));
}

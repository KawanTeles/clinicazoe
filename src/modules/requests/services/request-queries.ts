import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

/** Origens que representam uma solicitação feita pelo próprio paciente,
 * ainda pendente de aprovação da equipe (agendamento criado pela recepção
 * já nasce fora desse fluxo — ver `source: 'staff'` em booking-actions.ts). */
const REQUEST_SOURCES = ["paciente", "site_publico"] as const;

export interface RequestView {
  id: string;
  patientName: string;
  patientPhone: string | null;
  professionalName: string;
  specialtyName: string;
  insuranceName: string;
  date: string;
  startTime: string;
  endTime: string;
  value: number;
  paymentMethod: string;
  status: string;
  requestedAt: string;
}

async function denormalize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: AppointmentRow[],
): Promise<RequestView[]> {
  if (rows.length === 0) return [];

  const patientIds = Array.from(new Set(rows.map((r) => r.patient_id)));
  const professionalIds = Array.from(new Set(rows.map((r) => r.professional_id)));
  const specialtyIds = Array.from(
    new Set(rows.map((r) => r.specialty_id).filter((id): id is string => Boolean(id))),
  );
  const insuranceIds = Array.from(new Set(rows.map((r) => r.insurance_id)));

  const [{ data: patients }, { data: professionals }, { data: specialties }, { data: insurances }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, phone").in("id", patientIds),
      supabase.from("profiles").select("id, full_name").in("id", professionalIds),
      specialtyIds.length > 0
        ? supabase.from("specialties").select("id, name").in("id", specialtyIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      supabase.from("insurances").select("id, name").in("id", insuranceIds),
    ]);

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));
  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p]));
  const specialtyById = new Map((specialties ?? []).map((s) => [s.id, s.name]));
  const insuranceById = new Map((insurances ?? []).map((i) => [i.id, i.name]));

  return rows.map((row): RequestView => ({
    id: row.id,
    patientName: patientById.get(row.patient_id)?.full_name ?? "Paciente",
    patientPhone: patientById.get(row.patient_id)?.phone ?? null,
    professionalName: professionalById.get(row.professional_id)?.full_name ?? "Profissional",
    specialtyName: row.specialty_id ? specialtyById.get(row.specialty_id) ?? "" : "",
    insuranceName: insuranceById.get(row.insurance_id) ?? "",
    date: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    value: row.value,
    paymentMethod: row.payment_method,
    status: row.status,
    requestedAt: row.created_at,
  }));
}

export async function getPendingRequests(): Promise<RequestView[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("status", "pendente")
    .in("source", REQUEST_SOURCES)
    .order("created_at", { ascending: false });

  return denormalize(supabase, data ?? []);
}

export async function getPendingRequestsCount(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente")
    .in("source", REQUEST_SOURCES);

  return count ?? 0;
}

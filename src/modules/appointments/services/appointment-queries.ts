import { createClient } from "@/lib/supabase/server";
import type { Database, Role } from "@/lib/supabase/types";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

export interface AppointmentView {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  professionalId: string;
  professionalName: string;
  specialtyName: string;
  insuranceName: string;
  date: string;
  startTime: string;
  endTime: string;
  value: number;
  paymentMethod: string;
  status: string;
}

async function denormalize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: AppointmentRow[],
) {
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

  return rows.map((row): AppointmentView => ({
    id: row.id,
    patientId: row.patient_id,
    patientName: patientById.get(row.patient_id)?.full_name ?? "Paciente",
    patientPhone: patientById.get(row.patient_id)?.phone ?? null,
    professionalId: row.professional_id,
    professionalName: professionalById.get(row.professional_id)?.full_name ?? "Profissional",
    specialtyName: row.specialty_id ? specialtyById.get(row.specialty_id) ?? "" : "",
    insuranceName: insuranceById.get(row.insurance_id) ?? "",
    date: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    value: row.value,
    paymentMethod: row.payment_method,
    status: row.status,
  }));
}

const PAGE_SIZE = 20;

export async function getAppointmentsForViewer(
  role: Role,
  userId: string,
  page = 1,
): Promise<{ items: AppointmentView[]; totalPages: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("appointments")
    .select("*", { count: "exact" })
    .order("appointment_date", { ascending: false });

  if (role === "paciente") {
    query = query.eq("patient_id", userId);
  } else if (role === "profissional") {
    query = query.eq("professional_id", userId);
  }
  // admin / recepcionista: vê tudo, sem filtro extra.

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  const items = await denormalize(supabase, data ?? []);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return { items, totalPages };
}

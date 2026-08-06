import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type EvolutionRow = Database["public"]["Tables"]["patient_evolutions"]["Row"];
type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface EvolutionView {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  specialtyId: string | null;
  specialtyName: string | null;
  appointmentDate: string;
  appointmentStartTime: string;
  sessionSummary: string | null;
  clinicalEvolution: string;
  objectives: string | null;
  interventions: string | null;
  patientResponse: string | null;
  homeGuidance: string | null;
  observations: string | null;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  updatedByName: string | null;
  wasEdited: boolean;
}

async function denormalize(supabase: Supabase, rows: EvolutionRow[]): Promise<EvolutionView[]> {
  if (rows.length === 0) return [];

  const appointmentIds = Array.from(new Set(rows.map((r) => r.appointment_id)));
  const specialtyIds = Array.from(
    new Set(rows.map((r) => r.specialty_id).filter((id): id is string => Boolean(id))),
  );
  const peopleIds = Array.from(
    new Set(
      rows.flatMap((r) => [r.patient_id, r.professional_id, r.created_by, r.updated_by]).filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );

  const [{ data: appointments }, { data: people }, { data: specialties }] = await Promise.all([
    supabase.from("appointments").select("id, appointment_date, start_time").in("id", appointmentIds),
    supabase.from("profiles").select("id, full_name").in("id", peopleIds),
    specialtyIds.length > 0
      ? supabase.from("specialties").select("id, name").in("id", specialtyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const appointmentById = new Map((appointments ?? []).map((a) => [a.id, a]));
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const specialtyNameById = new Map((specialties ?? []).map((s) => [s.id, s.name]));

  return rows.map((row): EvolutionView => {
    const appointment = appointmentById.get(row.appointment_id);
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      patientId: row.patient_id,
      patientName: nameById.get(row.patient_id) ?? "Paciente",
      professionalId: row.professional_id,
      professionalName: nameById.get(row.professional_id) ?? "Profissional",
      specialtyId: row.specialty_id,
      specialtyName: row.specialty_id ? specialtyNameById.get(row.specialty_id) ?? null : null,
      appointmentDate: appointment?.appointment_date ?? "",
      appointmentStartTime: appointment?.start_time ?? "",
      sessionSummary: row.session_summary,
      clinicalEvolution: row.clinical_evolution,
      objectives: row.objectives,
      interventions: row.interventions,
      patientResponse: row.patient_response,
      homeGuidance: row.home_guidance,
      observations: row.observations,
      createdAt: row.created_at,
      createdByName: nameById.get(row.created_by) ?? null,
      updatedAt: row.updated_at,
      updatedByName: row.updated_by ? nameById.get(row.updated_by) ?? null : null,
      wasEdited: row.updated_at !== row.created_at,
    };
  });
}

/** Evolução de uma consulta específica, se já existir (relação 1:1 com appointments). */
export async function getEvolutionForAppointment(appointmentId: string): Promise<EvolutionView | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_evolutions")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (!data) return null;
  const [view] = await denormalize(supabase, [data]);
  return view ?? null;
}

/** Timeline cronológica de um paciente. A RLS já resolve o escopo: admin vê
 * tudo, profissional só vê as evoluções que ele mesmo escreveu (que, por
 * construção, são só as de pacientes vinculados a ele). */
export async function getEvolutionsForPatient(patientId: string): Promise<EvolutionView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_evolutions")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  return denormalize(supabase, data ?? []);
}

const PAGE_SIZE = 20;

export interface EvolutionSearchParams {
  patientQuery?: string;
  professionalId?: string;
  specialtyId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

/** Busca global (paciente, profissional, especialidade, período). Usada pela
 * tela /evolutions, restrita a admin na página — aqui a RLS já garante que um
 * profissional só enxergaria as próprias evoluções mesmo se chamasse isso. */
export async function searchEvolutions(
  params: EvolutionSearchParams,
): Promise<{ items: EvolutionView[]; totalPages: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);

  let matchingPatientIds: string[] | null = null;
  const patientQuery = params.patientQuery?.trim();
  if (patientQuery) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "paciente")
      .ilike("full_name", `%${patientQuery}%`);
    matchingPatientIds = (data ?? []).map((p) => p.id);
    if (matchingPatientIds.length === 0) return { items: [], totalPages: 1 };
  }

  let matchingAppointmentIds: string[] | null = null;
  if (params.dateFrom || params.dateTo) {
    let appointmentQuery = supabase.from("appointments").select("id");
    if (params.dateFrom) appointmentQuery = appointmentQuery.gte("appointment_date", params.dateFrom);
    if (params.dateTo) appointmentQuery = appointmentQuery.lte("appointment_date", params.dateTo);
    const { data } = await appointmentQuery;
    matchingAppointmentIds = (data ?? []).map((a) => a.id);
    if (matchingAppointmentIds.length === 0) return { items: [], totalPages: 1 };
  }

  let query = supabase
    .from("patient_evolutions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (matchingPatientIds) query = query.in("patient_id", matchingPatientIds);
  if (matchingAppointmentIds) query = query.in("appointment_id", matchingAppointmentIds);
  if (params.professionalId) query = query.eq("professional_id", params.professionalId);
  if (params.specialtyId) query = query.eq("specialty_id", params.specialtyId);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  const items = await denormalize(supabase, data ?? []);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return { items, totalPages };
}

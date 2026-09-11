import { createClient } from "@/lib/supabase/server";
import type { Database, Modality, ParticularProduct, Role } from "@/lib/supabase/types";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

export interface AppointmentView {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  professionalId: string;
  professionalName: string;
  specialtyName: string;
  insuranceId: string;
  insuranceName: string;
  date: string;
  startTime: string;
  endTime: string;
  value: number;
  paymentMethod: string;
  modality: Modality | null;
  particularProduct: ParticularProduct | null;
  status: string;
  seriesId: string | null;
  reminderSentAt: string | null;
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
    insuranceId: row.insurance_id,
    insuranceName: insuranceById.get(row.insurance_id) ?? "",
    date: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    value: row.value,
    paymentMethod: row.payment_method,
    modality: row.modality,
    particularProduct: row.particular_product,
    status: row.status,
    seriesId: row.series_id,
    reminderSentAt: row.reminder_sent_at,
  }));
}

const PAGE_SIZE = 20;

export type AppointmentStatusFilter = "todos" | "pendente" | "confirmada" | "concluida" | "cancelada";

/** Ids das consultas onde o profissional é coterapeuta (atendimento
 * compartilhado, Fase 2) — sem isso, a própria agenda dele nunca mostraria
 * uma consulta compartilhada da qual ele participa mas não é o principal. */
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

export async function getAppointmentsForViewer(
  role: Role,
  userId: string,
  page = 1,
  statusFilter: AppointmentStatusFilter = "todos",
): Promise<{ items: AppointmentView[]; totalPages: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("appointments")
    .select("*", { count: "exact" })
    .order("appointment_date", { ascending: false });

  if (role === "paciente") {
    query = query.eq("patient_id", userId);
  } else if (role === "profissional") {
    const coTherapistAppointmentIds = await getCoTherapistAppointmentIds(supabase, userId);
    query =
      coTherapistAppointmentIds.length > 0
        ? query.or(`professional_id.eq.${userId},id.in.(${coTherapistAppointmentIds.join(",")})`)
        : query.eq("professional_id", userId);
  } else {
    // admin / recepcionista: vê tudo, exceto solicitações de cliente ainda
    // pendentes de aprovação — essas ficam só no módulo Solicitações até
    // serem aprovadas/recusadas. Agendamento manual da recepção
    // (source='staff') continua aparecendo normalmente aqui, como sempre.
    query = query.or("status.neq.pendente,source.eq.staff");
  }

  // Filtro de status aplicado no banco (antes do .range()) para que o count/
  // total de páginas reflita o conjunto já filtrado — caso contrário uma
  // página pode vir vazia no client mesmo com "Página X de Y" > 1.
  if (statusFilter === "todos") {
    query = query.not("status", "in", '("cancelada","remarcada")');
  } else if (statusFilter === "cancelada") {
    query = query.in("status", ["cancelada", "remarcada"]);
  } else {
    query = query.eq("status", statusFilter);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  const items = await denormalize(supabase, data ?? []);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return { items, totalPages };
}

/** Consulta única para a tela de detalhes (/appointments/[id]). A RLS de
 * `appointments` já restringe o retorno: paciente só a própria, profissional
 * só as suas, admin/recepção veem qualquer uma. */
export async function getAppointmentById(id: string): Promise<AppointmentView | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("appointments").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const [item] = await denormalize(supabase, [data]);
  return item ?? null;
}

export type AbsencePeriodFilter = "30d" | "mes_atual" | "todos";

export interface AbsencePatientGroup {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  patientWhatsapp: string | null;
  totalAbsences: number;
  lastAbsenceDate: string;
  appointments: AppointmentView[];
}

const ABSENCE_GROUPS_PAGE_SIZE = 20;
/** Teto de segurança para a agregação em memória — bem acima do volume
 * real de faltas de uma clínica de porte pequeno/médio; existe só para não
 * deixar a query sem limite algum. */
const ABSENCES_FETCH_CAP = 5000;

function periodStartDate(period: AbsencePeriodFilter): string | null {
  const now = new Date();
  if (period === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return from.toISOString().slice(0, 10);
  }
  if (period === "mes_atual") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }
  return null;
}

/** Visão consolidada de faltas (/faltas), agrupada por paciente — mesmo
 * escopo por papel de getAppointmentsForViewer (profissional só vê as
 * próprias + coterapeuta; admin/recepcionista vêem todas, com filtro
 * opcional por profissional e por período). Paginação é sobre os grupos
 * (pacientes), não sobre os atendimentos individuais. */
export async function getAbsencesForViewer(
  role: Role,
  userId: string,
  page = 1,
  filters: { professionalId?: string; period?: AbsencePeriodFilter } = {},
): Promise<{ groups: AbsencePatientGroup[]; totalPages: number; totalAbsences: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("appointments")
    .select("*")
    .eq("status", "faltou")
    .order("appointment_date", { ascending: false });

  if (role === "profissional") {
    const coTherapistAppointmentIds = await getCoTherapistAppointmentIds(supabase, userId);
    query =
      coTherapistAppointmentIds.length > 0
        ? query.or(`professional_id.eq.${userId},id.in.(${coTherapistAppointmentIds.join(",")})`)
        : query.eq("professional_id", userId);
  } else if (filters.professionalId) {
    query = query.eq("professional_id", filters.professionalId);
  }

  const since = periodStartDate(filters.period ?? "todos");
  if (since) {
    query = query.gte("appointment_date", since);
  }

  const { data } = await query.limit(ABSENCES_FETCH_CAP);
  const items = await denormalize(supabase, data ?? []);

  const patientIds = Array.from(new Set(items.map((item) => item.patientId)));
  const { data: details } =
    patientIds.length > 0
      ? await supabase.from("patient_details").select("id, whatsapp").in("id", patientIds)
      : { data: [] as { id: string; whatsapp: string | null }[] };
  const whatsappById = new Map((details ?? []).map((d) => [d.id, d.whatsapp]));

  const groupsByPatient = new Map<string, AbsencePatientGroup>();
  for (const item of items) {
    const existing = groupsByPatient.get(item.patientId);
    if (existing) {
      existing.totalAbsences += 1;
      existing.appointments.push(item);
      if (item.date > existing.lastAbsenceDate) existing.lastAbsenceDate = item.date;
    } else {
      groupsByPatient.set(item.patientId, {
        patientId: item.patientId,
        patientName: item.patientName,
        patientPhone: item.patientPhone,
        patientWhatsapp: whatsappById.get(item.patientId) ?? null,
        totalAbsences: 1,
        lastAbsenceDate: item.date,
        appointments: [item],
      });
    }
  }

  // Atendimentos já vêm ordenados por data desc da query; ordenar os grupos
  // pela falta mais recente de cada paciente preserva "mais recente
  // primeiro" também na visão agrupada.
  const groups = Array.from(groupsByPatient.values()).sort((a, b) =>
    b.lastAbsenceDate.localeCompare(a.lastAbsenceDate),
  );

  const totalPages = Math.max(1, Math.ceil(groups.length / ABSENCE_GROUPS_PAGE_SIZE));
  const from = (page - 1) * ABSENCE_GROUPS_PAGE_SIZE;
  const pageGroups = groups.slice(from, from + ABSENCE_GROUPS_PAGE_SIZE);

  return { groups: pageGroups, totalPages, totalAbsences: items.length };
}

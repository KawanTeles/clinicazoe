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
  groupId: string | null;
  absenceReason: string | null;
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
    groupId: row.group_id,
    absenceReason: row.absence_reason,
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

/** Uma falta individual — do profissional principal (appointments.status)
 * ou de um coterapeuta (appointment_professionals.absence_status,
 * migração 0067). professionalName é sempre o de quem faltou, não
 * necessariamente o principal da consulta. */
export interface AbsenceItem {
  id: string;
  professionalName: string;
  insuranceName: string;
  paymentMethod: string;
  modality: Modality | null;
  particularProduct: ParticularProduct | null;
  date: string;
  startTime: string;
  justified: boolean;
  reason: string | null;
  source: "principal" | "cotherapist";
}

export interface AbsencePatientGroup {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  patientWhatsapp: string | null;
  /** Só as NÃO-justificadas — é o número que a administração acompanha. */
  totalAbsences: number;
  totalJustified: number;
  lastAbsenceDate: string;
  appointments: AbsenceItem[];
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

interface PatientBasics {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
}

/** Visão consolidada de faltas (/faltas), agrupada por paciente — mesmo
 * escopo por papel de getAppointmentsForViewer (profissional só vê as
 * próprias + coterapeuta; admin/recepcionista vêem todas, com filtro
 * opcional por profissional e por período). Paginação é sobre os grupos
 * (pacientes), não sobre os atendimentos individuais.
 *
 * Une duas fontes (migração 0067): falta do profissional principal
 * (appointments.status) e falta de coterapeuta
 * (appointment_professionals.absence_status) — cada participação de uma
 * sessão multidisciplinar tem seu próprio comparecimento, então o mesmo
 * paciente pode faltar numa especialidade e comparecer em outra no mesmo
 * horário. totalAbsences conta só as NÃO-justificadas (controle
 * administrativo); totalJustified fica à parte, só para consulta. */
export async function getAbsencesForViewer(
  role: Role,
  userId: string,
  page = 1,
  filters: { professionalId?: string; period?: AbsencePeriodFilter } = {},
): Promise<{ groups: AbsencePatientGroup[]; totalPages: number; totalAbsences: number; totalJustified: number }> {
  const supabase = await createClient();
  const since = periodStartDate(filters.period ?? "todos");

  // 1) Faltas do profissional principal.
  let principalQuery = supabase
    .from("appointments")
    .select("*")
    .in("status", ["faltou", "faltou_justificada"])
    .order("appointment_date", { ascending: false });

  if (role === "profissional") {
    principalQuery = principalQuery.eq("professional_id", userId);
  } else if (filters.professionalId) {
    principalQuery = principalQuery.eq("professional_id", filters.professionalId);
  }
  if (since) principalQuery = principalQuery.gte("appointment_date", since);

  const { data: principalRows } = await principalQuery.limit(ABSENCES_FETCH_CAP);
  const principalAppointments = await denormalize(supabase, principalRows ?? []);

  // 2) Faltas de coterapeuta — mesmo escopo por papel, mas a fonte é
  // appointment_professionals, não appointments.
  let coTherapistLinksQuery = supabase
    .from("appointment_professionals")
    .select("appointment_id, professional_id, absence_status, absence_reason")
    .not("absence_status", "is", null);

  if (role === "profissional") {
    coTherapistLinksQuery = coTherapistLinksQuery.eq("professional_id", userId);
  } else if (filters.professionalId) {
    coTherapistLinksQuery = coTherapistLinksQuery.eq("professional_id", filters.professionalId);
  }

  const { data: coTherapistLinks } = await coTherapistLinksQuery.limit(ABSENCES_FETCH_CAP);

  let coTherapistAppointmentById = new Map<string, AppointmentView>();
  let coTherapistNameByProfessionalId = new Map<string, string>();
  if (coTherapistLinks && coTherapistLinks.length > 0) {
    const appointmentIds = Array.from(new Set(coTherapistLinks.map((l) => l.appointment_id)));
    let coApptQuery = supabase.from("appointments").select("*").in("id", appointmentIds);
    if (since) coApptQuery = coApptQuery.gte("appointment_date", since);
    const { data: coApptRows } = await coApptQuery;
    const coApptViews = await denormalize(supabase, coApptRows ?? []);
    coTherapistAppointmentById = new Map(coApptViews.map((a) => [a.id, a]));

    const professionalIds = Array.from(new Set(coTherapistLinks.map((l) => l.professional_id)));
    const { data: professionals } = await supabase.from("profiles").select("id, full_name").in("id", professionalIds);
    coTherapistNameByProfessionalId = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));
  }

  const allItems: { patient: PatientBasics; item: AbsenceItem }[] = [];

  for (const appt of principalAppointments) {
    allItems.push({
      patient: { patientId: appt.patientId, patientName: appt.patientName, patientPhone: appt.patientPhone },
      item: {
        id: appt.id,
        professionalName: appt.professionalName,
        insuranceName: appt.insuranceName,
        paymentMethod: appt.paymentMethod,
        modality: appt.modality,
        particularProduct: appt.particularProduct,
        date: appt.date,
        startTime: appt.startTime,
        justified: appt.status === "faltou_justificada",
        reason: appt.absenceReason,
        source: "principal",
      },
    });
  }

  for (const link of coTherapistLinks ?? []) {
    const appt = coTherapistAppointmentById.get(link.appointment_id);
    if (!appt) continue;
    // Falta do próprio principal fica de fora daqui por construção — este
    // loop só existe porque absence_status não é nulo, e só coterapeutas
    // gravam nessa coluna (a do principal é a de "appointments" acima).
    allItems.push({
      patient: { patientId: appt.patientId, patientName: appt.patientName, patientPhone: appt.patientPhone },
      item: {
        id: appt.id,
        professionalName: coTherapistNameByProfessionalId.get(link.professional_id) ?? "Profissional",
        insuranceName: appt.insuranceName,
        paymentMethod: appt.paymentMethod,
        modality: appt.modality,
        particularProduct: appt.particularProduct,
        date: appt.date,
        startTime: appt.startTime,
        justified: link.absence_status === "faltou_justificada",
        reason: link.absence_reason,
        source: "cotherapist",
      },
    });
  }

  const patientIds = Array.from(new Set(allItems.map(({ patient }) => patient.patientId)));
  const { data: details } =
    patientIds.length > 0
      ? await supabase.from("patient_details").select("id, whatsapp").in("id", patientIds)
      : { data: [] as { id: string; whatsapp: string | null }[] };
  const whatsappById = new Map((details ?? []).map((d) => [d.id, d.whatsapp]));

  const groupsByPatient = new Map<string, AbsencePatientGroup>();
  for (const { patient, item } of allItems) {
    const existing = groupsByPatient.get(patient.patientId);
    if (existing) {
      if (item.justified) existing.totalJustified += 1;
      else existing.totalAbsences += 1;
      existing.appointments.push(item);
      if (item.date > existing.lastAbsenceDate) existing.lastAbsenceDate = item.date;
    } else {
      groupsByPatient.set(patient.patientId, {
        patientId: patient.patientId,
        patientName: patient.patientName,
        patientPhone: patient.patientPhone,
        patientWhatsapp: whatsappById.get(patient.patientId) ?? null,
        totalAbsences: item.justified ? 0 : 1,
        totalJustified: item.justified ? 1 : 0,
        lastAbsenceDate: item.date,
        appointments: [item],
      });
    }
  }

  for (const group of groupsByPatient.values()) {
    group.appointments.sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`));
  }

  const groups = Array.from(groupsByPatient.values()).sort((a, b) =>
    b.lastAbsenceDate.localeCompare(a.lastAbsenceDate),
  );

  const totalPages = Math.max(1, Math.ceil(groups.length / ABSENCE_GROUPS_PAGE_SIZE));
  const from = (page - 1) * ABSENCE_GROUPS_PAGE_SIZE;
  const pageGroups = groups.slice(from, from + ABSENCE_GROUPS_PAGE_SIZE);

  const totalAbsences = allItems.filter(({ item }) => !item.justified).length;
  const totalJustified = allItems.filter(({ item }) => item.justified).length;

  return { groups: pageGroups, totalPages, totalAbsences, totalJustified };
}

export interface GroupParticipant {
  appointmentId: string;
  patientName: string;
  professionalName: string;
  coTherapistNames: string[];
  status: string;
}

/** Linhas-irmãs de uma sessão conjugada (mesmo group_id) — usado na tela de
 * detalhes para listar "quem mais está nesta sessão". A RLS de appointments
 * já restringe o retorno certo por papel (staff vê tudo; profissional só o
 * que é principal ou coterapeuta em alguma linha, via
 * is_appointment_cotherapist, migração 0040) — não precisa de lógica de
 * permissão adicional aqui. */
export async function getGroupParticipants(
  groupId: string,
  excludeAppointmentId?: string,
): Promise<GroupParticipant[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("appointments")
    .select("id, patient_id, professional_id, status")
    .eq("group_id", groupId);

  const filtered = (rows ?? []).filter((r) => r.id !== excludeAppointmentId);
  if (filtered.length === 0) return [];

  const appointmentIds = filtered.map((r) => r.id);
  const patientIds = Array.from(new Set(filtered.map((r) => r.patient_id)));
  const professionalIds = Array.from(new Set(filtered.map((r) => r.professional_id)));

  const [{ data: patients }, { data: professionals }, { data: coTherapistLinks }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", patientIds),
    supabase.from("profiles").select("id, full_name").in("id", professionalIds),
    supabase.from("appointment_professionals").select("appointment_id, professional_id").in("appointment_id", appointmentIds),
  ]);

  const patientNameById = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
  const professionalNameById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));

  const coTherapistProfessionalIds = Array.from(new Set((coTherapistLinks ?? []).map((l) => l.professional_id)));
  const { data: coTherapistProfiles } =
    coTherapistProfessionalIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", coTherapistProfessionalIds)
      : { data: [] as { id: string; full_name: string }[] };
  const coTherapistNameById = new Map((coTherapistProfiles ?? []).map((p) => [p.id, p.full_name]));

  const coTherapistNamesByAppointment = new Map<string, string[]>();
  for (const link of coTherapistLinks ?? []) {
    const list = coTherapistNamesByAppointment.get(link.appointment_id) ?? [];
    list.push(coTherapistNameById.get(link.professional_id) ?? "Profissional");
    coTherapistNamesByAppointment.set(link.appointment_id, list);
  }

  return filtered.map((r) => ({
    appointmentId: r.id,
    patientName: patientNameById.get(r.patient_id) ?? "Paciente",
    professionalName: professionalNameById.get(r.professional_id) ?? "Profissional",
    coTherapistNames: coTherapistNamesByAppointment.get(r.id) ?? [],
    status: r.status,
  }));
}

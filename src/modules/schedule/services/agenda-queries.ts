"use server";

import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus, Modality, ParticularProduct, PaymentMethod } from "@/lib/supabase/types";

export interface AgendaSlotWindow {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
}

export interface AgendaBlockCell {
  id: string;
  blockType: string;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  label: string | null;
}

export interface AgendaAppointmentCell {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  patientId: string;
  patientName: string;
  insuranceId: string;
  insuranceName: string;
  insuranceColor: string | null;
  status: AppointmentStatus;
  value: number | null;
  paymentMethod: PaymentMethod;
  modality: Modality | null;
  particularProduct: ParticularProduct | null;
  groupId: string | null;
  /** Nomes dos outros pacientes da mesma sessão conjugada (vazio se não for conjugado). */
  groupPatientNames: string[];
  /** Profissionais coterapeutas vinculados (além do principal). */
  coTherapistNames: string[];
}

export interface ProfessionalAgenda {
  professionalId: string;
  professionalName: string;
  slots: AgendaSlotWindow[];
  blocks: AgendaBlockCell[];
  appointments: AgendaAppointmentCell[];
}

const ACTIVE_STATUSES: AppointmentStatus[] = ["pendente", "confirmada", "concluida", "faltou", "faltou_justificada"];

/** Carrega a grade completa (horário de trabalho + bloqueios + atendimentos)
 * de um ou mais profissionais, num intervalo de datas — serve tanto a visão
 * "um profissional" (semana inteira) quanto "Todos" (um dia, vários
 * profissionais) da tela de Agenda. Segue o padrão de denormalização manual
 * já usado em appointment-queries.ts (sem embedded select do Supabase, pra
 * não depender de hint de FK quando a mesma tabela é referenciada mais de
 * uma vez). */
export async function getAgendaForProfessionals(
  professionalIds: string[],
  startDate: string,
  endDate: string,
): Promise<Map<string, ProfessionalAgenda>> {
  const result = new Map<string, ProfessionalAgenda>();
  if (professionalIds.length === 0) return result;

  const supabase = await createClient();

  const [{ data: professionals }, { data: slots }, { data: blocks }, { data: ownAppointments }, { data: coTherapistLinks }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", professionalIds),
      supabase
        .from("schedule_slots")
        .select("id, professional_id, day_of_week, start_time, end_time, capacity")
        .in("professional_id", professionalIds)
        .eq("status", "active"),
      supabase
        .from("schedule_blocks")
        .select("id, professional_id, block_type, day_of_week, specific_date, start_time, end_time, label")
        .in("professional_id", professionalIds)
        .eq("status", "active"),
      supabase
        .from("appointments")
        .select("*")
        .in("professional_id", professionalIds)
        .gte("appointment_date", startDate)
        .lte("appointment_date", endDate)
        .in("status", ACTIVE_STATUSES),
      supabase
        .from("appointment_professionals")
        .select("appointment_id, professional_id")
        .in("professional_id", professionalIds),
    ]);

  const professionalNameById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));

  // Atendimentos onde o profissional é coterapeuta (não o principal) também
  // precisam aparecer na agenda dele — busca as linhas principais pelos ids.
  const coAppointmentIds = Array.from(new Set((coTherapistLinks ?? []).map((l) => l.appointment_id)));
  const { data: coAppointments } =
    coAppointmentIds.length > 0
      ? await supabase
          .from("appointments")
          .select("*")
          .in("id", coAppointmentIds)
          .gte("appointment_date", startDate)
          .lte("appointment_date", endDate)
          .in("status", ACTIVE_STATUSES)
      : { data: [] as NonNullable<typeof ownAppointments> };

  const allAppointmentsById = new Map<string, NonNullable<typeof ownAppointments>[number]>();
  for (const appt of ownAppointments ?? []) allAppointmentsById.set(appt.id, appt);
  for (const appt of coAppointments ?? []) allAppointmentsById.set(appt.id, appt);
  const allAppointments = Array.from(allAppointmentsById.values());

  const patientIds = Array.from(new Set(allAppointments.map((a) => a.patient_id)));
  const insuranceIds = Array.from(new Set(allAppointments.map((a) => a.insurance_id)));
  const groupIds = Array.from(new Set(allAppointments.map((a) => a.group_id).filter((id): id is string => !!id)));
  const appointmentIds = allAppointments.map((a) => a.id);

  const [{ data: patients }, { data: insurances }, { data: groupSiblings }, { data: allCoTherapistLinks }] = await Promise.all([
    patientIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", patientIds) : Promise.resolve({ data: [] }),
    insuranceIds.length > 0
      ? supabase.from("insurances").select("id, name, color").in("id", insuranceIds)
      : Promise.resolve({ data: [] }),
    groupIds.length > 0
      ? supabase.from("appointments").select("id, group_id, patient_id").in("group_id", groupIds)
      : Promise.resolve({ data: [] }),
    appointmentIds.length > 0
      ? supabase.from("appointment_professionals").select("appointment_id, professional_id").in("appointment_id", appointmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const patientNameById = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
  const insuranceById = new Map((insurances ?? []).map((i) => [i.id, i]));

  const groupPatientNamesByGroupId = new Map<string, string[]>();
  for (const row of groupSiblings ?? []) {
    if (!row.group_id) continue;
    const list = groupPatientNamesByGroupId.get(row.group_id) ?? [];
    const name = patientNameById.get(row.patient_id);
    if (name) list.push(name);
    groupPatientNamesByGroupId.set(row.group_id, list);
  }

  const coTherapistNamesByAppointmentId = new Map<string, string[]>();
  const coTherapistProfessionalIds = Array.from(new Set((allCoTherapistLinks ?? []).map((l) => l.professional_id)));
  const { data: coTherapistProfiles } =
    coTherapistProfessionalIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", coTherapistProfessionalIds)
      : { data: [] as { id: string; full_name: string }[] };
  const coTherapistNameById = new Map((coTherapistProfiles ?? []).map((p) => [p.id, p.full_name]));
  for (const link of allCoTherapistLinks ?? []) {
    const list = coTherapistNamesByAppointmentId.get(link.appointment_id) ?? [];
    const name = coTherapistNameById.get(link.professional_id);
    if (name) list.push(name);
    coTherapistNamesByAppointmentId.set(link.appointment_id, list);
  }

  for (const professionalId of professionalIds) {
    result.set(professionalId, {
      professionalId,
      professionalName: professionalNameById.get(professionalId) ?? "—",
      slots: (slots ?? [])
        .filter((s) => s.professional_id === professionalId)
        .map((s) => ({ id: s.id, dayOfWeek: s.day_of_week, startTime: s.start_time, endTime: s.end_time, capacity: s.capacity })),
      blocks: (blocks ?? [])
        .filter((b) => b.professional_id === professionalId)
        .map((b) => ({
          id: b.id,
          blockType: b.block_type,
          dayOfWeek: b.day_of_week,
          specificDate: b.specific_date,
          startTime: b.start_time,
          endTime: b.end_time,
          label: b.label,
        })),
      appointments: [],
    });
  }

  for (const appt of allAppointments) {
    // Uma linha de appointments pertence ao profissional principal
    // (appt.professional_id) e também aparece na agenda de cada coterapeuta
    // vinculado — por isso adicionamos em todos que estiverem na lista
    // pedida, não só no principal.
    const involvedIds = new Set<string>([appt.professional_id]);
    for (const link of allCoTherapistLinks ?? []) {
      if (link.appointment_id === appt.id) involvedIds.add(link.professional_id);
    }

    const insurance = insuranceById.get(appt.insurance_id);
    const cell: AgendaAppointmentCell = {
      id: appt.id,
      date: appt.appointment_date,
      startTime: appt.start_time,
      endTime: appt.end_time,
      patientId: appt.patient_id,
      patientName: patientNameById.get(appt.patient_id) ?? "—",
      insuranceId: appt.insurance_id,
      insuranceName: insurance?.name ?? "—",
      insuranceColor: insurance?.color ?? null,
      status: appt.status,
      value: appt.value,
      paymentMethod: appt.payment_method,
      modality: appt.modality,
      particularProduct: appt.particular_product,
      groupId: appt.group_id,
      groupPatientNames: appt.group_id
        ? (groupPatientNamesByGroupId.get(appt.group_id) ?? []).filter((n) => n !== patientNameById.get(appt.patient_id))
        : [],
      coTherapistNames: coTherapistNamesByAppointmentId.get(appt.id) ?? [],
    };

    for (const professionalId of involvedIds) {
      const agenda = result.get(professionalId);
      if (agenda) agenda.appointments.push(cell);
    }
  }

  return result;
}

export interface ScheduleChangeLogRow {
  id: string;
  changedByName: string;
  professionalName: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: { field: string; old: unknown; new: unknown }[];
  createdAt: string;
}

export interface ScheduleChangeLogFilters {
  professionalId?: string;
  entityType?: string;
  changedBy?: string;
  startDate?: string;
  endDate?: string;
}

/** Lista o histórico de alterações da agenda (schedule_change_log) já com
 * nomes resolvidos — a RLS da tabela (migração 0076) já restringe
 * automaticamente o profissional a só ver as próprias linhas; aqui só
 * aplicamos os filtros extras pedidos na tela. */
export async function getScheduleChangeLog(filters: ScheduleChangeLogFilters): Promise<ScheduleChangeLogRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("schedule_change_log")
    .select("id, changed_by, professional_id, entity_type, entity_id, action, changes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.professionalId) query = query.eq("professional_id", filters.professionalId);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.changedBy) query = query.eq("changed_by", filters.changedBy);
  if (filters.startDate) query = query.gte("created_at", filters.startDate);
  if (filters.endDate) query = query.lte("created_at", `${filters.endDate}T23:59:59`);

  const { data: rows } = await query;
  if (!rows || rows.length === 0) return [];

  const profileIds = Array.from(
    new Set(rows.flatMap((r) => [r.changed_by, r.professional_id].filter((id): id is string => !!id))),
  );
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((r) => ({
    id: r.id,
    changedByName: r.changed_by ? nameById.get(r.changed_by) ?? "—" : "Sistema",
    professionalName: nameById.get(r.professional_id) ?? "—",
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    changes: Array.isArray(r.changes) ? (r.changes as { field: string; old: unknown; new: unknown }[]) : [],
    createdAt: r.created_at,
  }));
}

/** Lista só profissionais ativos (id + nome) para popular o filtro da tela
 * de Alterações da Agenda. */
export async function getActiveProfessionalsForFilter(): Promise<{ id: string; fullName: string }[]> {
  const supabase = await createClient();
  const { data: professionals } = await supabase.from("professionals").select("id").eq("status", "active");
  const ids = (professionals ?? []).map((p) => p.id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return (profiles ?? [])
    .map((p) => ({ id: p.id, fullName: p.full_name }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
}

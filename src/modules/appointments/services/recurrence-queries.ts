"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WEEKDAY_LABELS } from "./recurrence-generator";
import { requireCanManageSeries } from "./recurrence-actions";
import type { Modality, ParticularProduct } from "@/lib/supabase/types";

export interface SeriesDetail {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  specialtyId: string | null;
  insuranceId: string;
  insuranceName: string;
  paymentMethod: string;
  modality: Modality | null;
  particularProduct: ParticularProduct | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  maxOccurrences: number | null;
  status: string;
}

export async function getSeriesDetail(id: string): Promise<SeriesDetail | null> {
  const supabase = await createClient();
  const { data: series } = await supabase.from("appointment_series").select("*").eq("id", id).single();
  if (!series) return null;

  const [{ data: patient }, { data: professional }, { data: insurance }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", series.patient_id).single(),
    supabase.from("profiles").select("full_name").eq("id", series.professional_id).single(),
    supabase.from("insurances").select("name").eq("id", series.insurance_id).single(),
  ]);

  return {
    id: series.id,
    patientId: series.patient_id,
    patientName: patient?.full_name ?? "Paciente",
    professionalId: series.professional_id,
    professionalName: professional?.full_name ?? "Profissional",
    specialtyId: series.specialty_id,
    insuranceId: series.insurance_id,
    insuranceName: insurance?.name ?? "",
    paymentMethod: series.payment_method,
    modality: series.modality,
    particularProduct: series.particular_product,
    dayOfWeek: series.day_of_week,
    startTime: series.start_time,
    endTime: series.end_time,
    frequency: series.frequency,
    startDate: series.start_date,
    endDate: series.end_date,
    maxOccurrences: series.max_occurrences,
    status: series.status,
  };
}

export interface PatientSeriesRow {
  id: string;
  professionalName: string;
  frequency: string;
  dayLabel: string;
  startTime: string;
  status: string;
}

export async function listSeriesForPatient(patientId: string): Promise<PatientSeriesRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointment_series")
    .select("id, professional_id, frequency, day_of_week, start_time, status")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return [];

  const professionalIds = Array.from(new Set(data.map((s) => s.professional_id)));
  const { data: professionals } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", professionalIds);
  const nameById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));

  return data.map((s) => ({
    id: s.id,
    professionalName: nameById.get(s.professional_id) ?? "Profissional",
    frequency: s.frequency,
    dayLabel: WEEKDAY_LABELS[s.day_of_week],
    startTime: s.start_time,
    status: s.status,
  }));
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "semanal",
  biweekly: "quinzenal",
  monthly: "mensal",
};

const SCOPE_LABELS: Record<string, string> = {
  only: "apenas este atendimento",
  following: "este atendimento e os próximos",
  all: "toda a sequência",
};

function formatIsoDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatHm(time: string) {
  return time.slice(0, 5);
}

/** Traduz uma entrada crua de `audit_logs` (action + metadata em jsonb) numa
 * frase legível para quem não é técnico — recepção/admin, não só auditoria. */
function translateAuditEntry(action: string, metadata: Record<string, unknown>): string {
  switch (action) {
    case "appointment_series.created": {
      const dayOfWeek = metadata.dayOfWeek as number | undefined;
      const startTime = metadata.startTime as string | undefined;
      const count = metadata.count as number | undefined;
      const attached = Boolean(metadata.attachedFromAppointmentId);
      const dayLabel = dayOfWeek !== undefined ? WEEKDAY_LABELS[dayOfWeek] : "—";
      const timeLabel = startTime ? formatHm(startTime) : "—";
      return `${attached ? "Atendimento avulso transformado em recorrência" : "Recorrência criada"}: toda ${dayLabel} às ${timeLabel}${count ? ` (${count} atendimento${count > 1 ? "s" : ""})` : ""}.`;
    }
    case "appointment.rescheduled_occurrence": {
      const previousDate = metadata.previousDate as string | undefined;
      const previousTime = metadata.previousTime as string | undefined;
      const newDate = metadata.newDate as string | undefined;
      const newTime = metadata.newTime as string | undefined;
      const reason = metadata.reason as string | null | undefined;
      const from = previousDate ? `${formatIsoDate(previousDate)} ${formatHm(previousTime ?? "")}` : "—";
      const to = newDate ? `${formatIsoDate(newDate)} ${formatHm(newTime ?? "")}` : "—";
      return `Reagendou este atendimento de ${from} para ${to}${reason ? ` — motivo: ${reason}` : ""}.`;
    }
    case "appointment_series.rescheduled": {
      const scope = metadata.scope as string | undefined;
      const prevDay = metadata.previousDayOfWeek as number | undefined;
      const prevTime = metadata.previousStartTime as string | undefined;
      const newDay = metadata.newDayOfWeek as number | undefined;
      const newTime = metadata.newStartTime as string | undefined;
      const prevFreq = metadata.previousFrequency as string | undefined;
      const newFreq = metadata.newFrequency as string | undefined;
      const reason = metadata.reason as string | null | undefined;
      const replaced = metadata.occurrencesReplaced as number | undefined;
      const created = metadata.occurrencesCreated as number | undefined;
      const from = prevDay !== undefined ? `${WEEKDAY_LABELS[prevDay]} ${formatHm(prevTime ?? "")}` : "—";
      const to = newDay !== undefined ? `${WEEKDAY_LABELS[newDay]} ${formatHm(newTime ?? "")}` : "—";
      const freqChange =
        prevFreq && newFreq && prevFreq !== newFreq
          ? `, frequência ${FREQUENCY_LABELS[prevFreq] ?? prevFreq} → ${FREQUENCY_LABELS[newFreq] ?? newFreq}`
          : "";
      const scopeLabel = scope ? SCOPE_LABELS[scope] ?? scope : "";
      return `Alterou a recorrência (${scopeLabel}): de ${from} para ${to}${freqChange} — ${replaced ?? 0} atendimento(s) substituído(s), ${created ?? 0} novo(s)${reason ? ` — motivo: ${reason}` : ""}.`;
    }
    case "appointment_series.cancelled": {
      const scope = metadata.scope as string | undefined;
      const cancelledCount = metadata.cancelledCount as number | undefined;
      const scopeLabel = scope ? SCOPE_LABELS[scope] ?? scope : "";
      return `Cancelou a recorrência (${scopeLabel}) — ${cancelledCount ?? 0} atendimento(s) cancelado(s).`;
    }
    case "appointment_series.extended": {
      const createdCount = metadata.createdCount as number | undefined;
      return `Estendeu a recorrência — ${createdCount ?? 0} novo(s) atendimento(s) gerados.`;
    }
    default:
      return action;
  }
}

export interface SeriesHistoryEntry {
  id: number;
  actorName: string;
  date: string;
  summary: string;
}

/** Histórico de alterações de uma série, legível para admin/recepção — não
 * é o log técnico de `/audit` (que é admin-only e mostra JSON cru): aqui
 * reaproveitamos a mesma tabela `audit_logs`, só filtrada por esta série e
 * traduzida para frases humanas. */
export async function getSeriesHistory(seriesId: string): Promise<SeriesHistoryEntry[]> {
  await requireCanManageSeries(seriesId);
  const admin = createAdminClient();

  const [{ data: seriesLogs }, { data: apptLogs }] = await Promise.all([
    admin
      .from("audit_logs")
      .select("id, actor_id, action, metadata, created_at")
      .eq("entity", "appointment_series")
      .eq("entity_id", seriesId),
    admin
      .from("audit_logs")
      .select("id, actor_id, action, metadata, created_at")
      .eq("entity", "appointments")
      .eq("action", "appointment.rescheduled_occurrence")
      .contains("metadata", { seriesId }),
  ]);

  const all = [...(seriesLogs ?? []), ...(apptLogs ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  if (all.length === 0) return [];

  const actorIds = Array.from(new Set(all.map((l) => l.actor_id).filter((id): id is string => Boolean(id))));
  const { data: profiles } =
    actorIds.length > 0
      ? await admin.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return all.map((log) => ({
    id: log.id,
    actorName: log.actor_id ? nameById.get(log.actor_id) ?? "Equipe" : "Sistema",
    date: log.created_at,
    summary: translateAuditEntry(log.action, (log.metadata ?? {}) as Record<string, unknown>),
  }));
}

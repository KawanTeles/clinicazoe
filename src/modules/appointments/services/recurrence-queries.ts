import { createClient } from "@/lib/supabase/server";
import { WEEKDAY_LABELS } from "./recurrence-generator";

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

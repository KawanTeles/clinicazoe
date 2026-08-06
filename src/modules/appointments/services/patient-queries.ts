import { createClient } from "@/lib/supabase/server";

export interface ProfessionalPatientView {
  patientId: string;
  fullName: string;
  phone: string | null;
  lastAppointmentDate: string;
  appointmentCount: number;
}

export async function getPatientsForProfessional(
  professionalId: string,
): Promise<ProfessionalPatientView[]> {
  const supabase = await createClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("patient_id, appointment_date")
    .eq("professional_id", professionalId)
    .order("appointment_date", { ascending: false });

  if (!appointments || appointments.length === 0) return [];

  const byPatient = new Map<string, { lastDate: string; count: number }>();
  for (const appt of appointments) {
    const existing = byPatient.get(appt.patient_id);
    if (existing) {
      existing.count += 1;
    } else {
      byPatient.set(appt.patient_id, { lastDate: appt.appointment_date, count: 1 });
    }
  }

  const patientIds = Array.from(byPatient.keys());
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", patientIds);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return patientIds
    .map((id) => {
      const info = byPatient.get(id)!;
      const profile = profileById.get(id);
      return {
        patientId: id,
        fullName: profile?.full_name ?? "Paciente",
        phone: profile?.phone ?? null,
        lastAppointmentDate: info.lastDate,
        appointmentCount: info.count,
      };
    })
    .sort((a, b) => b.lastAppointmentDate.localeCompare(a.lastAppointmentDate));
}

export async function getAppointmentsForPatient(patientId: string) {
  const supabase = await createClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, appointment_date, start_time, end_time, status, value, payment_method, modality, particular_product, professional_id, specialty_id, insurance_id",
    )
    .eq("patient_id", patientId)
    .order("appointment_date", { ascending: false });

  if (!appointments || appointments.length === 0) return [];

  const profIds = Array.from(new Set(appointments.map((a) => a.professional_id)));
  const specIds = Array.from(new Set(appointments.map((a) => a.specialty_id).filter(Boolean))) as string[];
  const insIds = Array.from(new Set(appointments.map((a) => a.insurance_id)));

  const [{ data: profiles }, { data: specialties }, { data: insurances }] = await Promise.all([
    profIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", profIds) : { data: [] },
    specIds.length > 0 ? supabase.from("specialties").select("id, name").in("id", specIds) : { data: [] },
    insIds.length > 0 ? supabase.from("insurances").select("id, name").in("id", insIds) : { data: [] },
  ]);

  const profMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const specMap = new Map((specialties ?? []).map((s) => [s.id, s.name]));
  const insMap = new Map((insurances ?? []).map((i) => [i.id, i.name]));

  return appointments.map((appt) => ({
    ...appt,
    professionalName: profMap.get(appt.professional_id) ?? "Profissional",
    specialtyName: appt.specialty_id ? specMap.get(appt.specialty_id) ?? "Consulta" : "Consulta",
    insuranceName: insMap.get(appt.insurance_id) ?? "Particular",
  }));
}

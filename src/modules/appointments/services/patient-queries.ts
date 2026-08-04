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

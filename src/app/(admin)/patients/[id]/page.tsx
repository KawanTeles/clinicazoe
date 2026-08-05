import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getInsurances } from "@/modules/insurances/services/insurance-queries";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";
import { getPatientDetail, getPatientMessages } from "@/modules/patients/services/patient-queries";
import { getAppointmentsForPatient } from "@/modules/appointments/services/patient-queries";
import { listSeriesForPatient } from "@/modules/appointments/services/recurrence-queries";
import { PatientDetailTabs } from "@/modules/patients/components/PatientDetailTabs";

export const metadata = {
  title: "Paciente — ClinicaZoe",
};

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  const { id } = await params;

  const [patient, appointments, messages, insurances, professionals, series] = await Promise.all([
    getPatientDetail(id),
    getAppointmentsForPatient(id),
    getPatientMessages(id),
    getInsurances(),
    getActiveProfessionals(),
    listSeriesForPatient(id),
  ]);

  if (!patient) notFound();

  const insuranceNameById = new Map(insurances.map((i) => [i.id, i.name]));
  const professionalNameById = new Map(professionals.map((p) => [p.id, p.full_name]));

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = appointments
    .filter((a) => a.appointment_date >= todayIso && a.status !== "cancelada")
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
  const history = appointments.filter((a) => a.appointment_date < todayIso || a.status === "cancelada");

  return (
    <PatientDetailTabs
      patient={{
        id: patient.id,
        fullName: patient.fullName,
        phone: patient.phone,
        status: patient.status,
        details: patient.details,
        preferredInsuranceName: patient.details?.preferred_insurance_id
          ? insuranceNameById.get(patient.details.preferred_insurance_id) ?? null
          : null,
        preferredProfessionalName: patient.details?.preferred_professional_id
          ? professionalNameById.get(patient.details.preferred_professional_id) ?? null
          : null,
      }}
      upcoming={upcoming}
      history={history}
      series={series}
      messages={messages}
      canManage
      canChangeStatus={session.profile.role === "admin"}
    />
  );
}

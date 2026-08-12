import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";
import { getPatientDetail } from "@/modules/patients/services/patient-queries";
import { PatientForm } from "@/modules/patients/components/PatientForm";

export const metadata = {
  title: "Editar Paciente — Espaço Zoe",
};

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  const { id } = await params;
  const [patient, insurances, professionals] = await Promise.all([
    getPatientDetail(id),
    getActiveInsurances(),
    getActiveProfessionals(),
  ]);

  if (!patient) notFound();

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary font-heading">Editar Paciente</h1>
        <p className="mt-0.5 text-xs text-text-secondary">{patient.fullName}</p>
      </div>

      <PatientForm
        mode="edit"
        patientId={patient.id}
        insurances={insurances}
        professionals={professionals.map((p) => ({ id: p.id, name: p.full_name }))}
        initial={{
          full_name: patient.fullName,
          phone: patient.phone ?? "",
          details: {
            cpf: patient.details?.cpf ?? undefined,
            birth_date: patient.details?.birth_date ?? undefined,
            email: patient.details?.email ?? undefined,
            whatsapp: patient.details?.whatsapp ?? undefined,
            address: patient.details?.address ?? undefined,
            city: patient.details?.city ?? undefined,
            preferred_insurance_id: patient.details?.preferred_insurance_id ?? undefined,
            insurance_card_number: patient.details?.insurance_card_number ?? undefined,
            insurance_card_valid_until: patient.details?.insurance_card_valid_until ?? undefined,
            notes: patient.details?.notes ?? undefined,
            preferred_professional_id: patient.details?.preferred_professional_id ?? undefined,
          },
        }}
      />
    </div>
  );
}

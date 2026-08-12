import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { getPatientDetail } from "@/modules/patients/services/patient-queries";
import { StaffAppointmentForm } from "@/modules/appointments/components/StaffAppointmentForm";
import type { PatientSearchResult } from "@/modules/patients/services/patient-actions";
import type { Modality } from "@/lib/supabase/types";

export const metadata = {
  title: "Novo Agendamento — Espaço Zoe",
};

interface NewAppointmentPageProps {
  searchParams: Promise<{
    patientId?: string;
    insuranceId?: string;
    professionalId?: string;
    modality?: string;
    waitlistId?: string;
  }>;
}

export default async function NewAppointmentPage({ searchParams }: NewAppointmentPageProps) {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  const { patientId, insuranceId, professionalId, modality, waitlistId } = await searchParams;

  const insurances = await getActiveInsurances();

  let initialPatient: PatientSearchResult | undefined;
  if (patientId) {
    const detail = await getPatientDetail(patientId);
    if (detail) {
      initialPatient = {
        id: detail.id,
        fullName: detail.fullName,
        phone: detail.phone,
        whatsapp: detail.details?.whatsapp ?? null,
        email: detail.details?.email ?? null,
        avatarUrl: null,
        city: detail.details?.city ?? null,
        preferredInsuranceId: detail.details?.preferred_insurance_id ?? null,
        preferredProfessionalId: detail.details?.preferred_professional_id ?? null,
      };
    }
  }

  const initialInsurance = insuranceId ? insurances.find((i) => i.id === insuranceId) : undefined;
  const initialModality: Modality | undefined = modality === "aba" || modality === "comum" ? modality : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Novo Agendamento</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Mesmo fluxo utilizado pelo paciente na Área do Cliente — só quem realiza o agendamento muda.
        </p>
      </div>

      {insurances.length === 0 ? (
        <p className="text-sm font-medium text-text-secondary">Nenhum convênio disponível no momento.</p>
      ) : (
        <StaffAppointmentForm
          insurances={insurances}
          initialPatient={initialPatient}
          initialInsurance={initialInsurance}
          initialProfessionalId={professionalId || undefined}
          initialModality={initialModality}
          waitlistEntryId={waitlistId || undefined}
        />
      )}
    </div>
  );
}

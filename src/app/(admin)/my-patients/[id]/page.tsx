import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientDetail } from "@/modules/patients/services/patient-queries";
import { getEvolutionsForPatient } from "@/modules/evolutions/services/evolution-queries";
import { getAIFeatureFlags } from "@/modules/ai/services/ai-settings-queries";
import { MyPatientDetailTabs } from "@/modules/patients/components/MyPatientDetailTabs";

export const metadata = {
  title: "Paciente — ClinicaZoe",
};

export default async function MyPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const { id } = await params;

  // getPatientDetail depende da RLS de profiles/patient_details, que só
  // libera dados de pacientes com quem este profissional já teve consulta —
  // se não pertencer a ele, volta null e cai no notFound() abaixo.
  const [patient, evolutions, hasAssistantPermission, flags] = await Promise.all([
    getPatientDetail(id),
    getEvolutionsForPatient(id),
    can(session.profile.role, "ai.patient_assistant.use"),
    getAIFeatureFlags(),
  ]);

  if (!patient) notFound();

  const aiAssistantEnabled = hasAssistantPermission && flags.enabled && flags.patientAssistantEnabled;

  return <MyPatientDetailTabs patient={patient} evolutions={evolutions} aiAssistantEnabled={aiAssistantEnabled} />;
}

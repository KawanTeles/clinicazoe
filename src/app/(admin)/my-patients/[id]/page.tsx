import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientDetail } from "@/modules/patients/services/patient-queries";
import { getEvolutionsForPatientPage } from "@/modules/evolutions/services/evolution-queries";
import { getAIFeatureFlags } from "@/modules/ai/services/ai-settings-queries";
import { getClinicalDocumentsForPatient } from "@/modules/clinical-documents/services/clinical-document-queries";
import { MyPatientDetailTabs } from "@/modules/patients/components/MyPatientDetailTabs";

export const metadata = {
  title: "Paciente — Espaço Zoe",
};

export default async function MyPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const { id } = await params;

  // getPatientDetail depende da RLS de profiles/patient_details, que só
  // libera dados de pacientes com quem este profissional já teve consulta —
  // se não pertencer a ele, volta null e cai no notFound() abaixo.
  const [patient, evolutionsPage, hasAssistantPermission, flags, documents] = await Promise.all([
    getPatientDetail(id),
    getEvolutionsForPatientPage(id, 1),
    can(session.profile.role, "ai.patient_assistant.use"),
    getAIFeatureFlags(),
    getClinicalDocumentsForPatient(id),
  ]);

  if (!patient) notFound();

  const aiAssistantEnabled = hasAssistantPermission && flags.enabled && flags.patientAssistantEnabled;

  return (
    <MyPatientDetailTabs
      patient={patient}
      evolutions={evolutionsPage.items}
      evolutionsTotalPages={evolutionsPage.totalPages}
      aiAssistantEnabled={aiAssistantEnabled}
      documents={documents}
    />
  );
}

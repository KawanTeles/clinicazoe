import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";
import { PatientForm } from "@/modules/patients/components/PatientForm";

export const metadata = {
  title: "Novo Paciente — ClinicaZoe",
};

export default async function NewPatientPage() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  const [insurances, professionals] = await Promise.all([
    getActiveInsurances(),
    getActiveProfessionals(),
  ]);

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary font-heading">Novo Paciente</h1>
        <p className="mt-0.5 text-xs text-text-secondary">
          Cadastre um paciente e organize seu histórico em formulário compacto.
        </p>
      </div>

      <PatientForm
        mode="create"
        insurances={insurances}
        professionals={professionals.map((p) => ({ id: p.id, name: p.full_name }))}
      />
    </div>
  );
}

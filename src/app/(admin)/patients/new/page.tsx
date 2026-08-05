import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";
import { PatientForm } from "@/modules/patients/components/PatientForm";

export const metadata = {
  title: "Novo paciente — ClinicaZoe",
};

export default async function NewPatientPage() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  const [insurances, professionals] = await Promise.all([
    getActiveInsurances(),
    getActiveProfessionals(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Novo paciente</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Cadastre um paciente antes mesmo de realizar o primeiro agendamento.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <PatientForm
            mode="create"
            insurances={insurances}
            professionals={professionals.map((p) => ({ id: p.id, name: p.full_name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSpecialties } from "@/modules/specialties/services/specialty-queries";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { TeamMemberForm } from "@/modules/team/components/TeamMemberForm";

export const metadata = {
  title: "Novo membro — ClinicaZoe",
};

export default async function NewTeamMemberPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const [specialties, insurances] = await Promise.all([
    getActiveSpecialties(),
    getActiveInsurances(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Novo membro</h1>
        <p className="text-sm text-text-secondary">
          Cadastre um administrador, recepcionista ou profissional.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do membro</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamMemberForm mode="create" specialties={specialties} insurances={insurances} />
        </CardContent>
      </Card>
    </div>
  );
}

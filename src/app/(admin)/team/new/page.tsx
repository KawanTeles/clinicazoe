import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSpecialties } from "@/modules/specialties/services/specialty-queries";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { TeamMemberForm } from "@/modules/team/components/TeamMemberForm";

export const metadata = {
  title: "Novo Membro — ClinicaZoe",
};

export default async function NewTeamMemberPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const [specialties, insurances] = await Promise.all([
    getActiveSpecialties(),
    getActiveInsurances(),
  ]);

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary font-heading">Novo Membro</h1>
        <p className="mt-0.5 text-xs text-text-secondary">
          Cadastre um administrador, recepcionista ou profissional da equipe.
        </p>
      </div>

      <TeamMemberForm mode="create" specialties={specialties} insurances={insurances} />
    </div>
  );
}

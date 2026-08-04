import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSpecialties } from "@/modules/specialties/services/specialty-queries";
import { SpecialtyManager } from "@/modules/specialties/components/SpecialtyManager";

export const metadata = {
  title: "Especialidades — ClinicaZoe",
};

export default async function SpecialtiesPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const specialties = await getSpecialties();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Especialidades</h1>
        <p className="text-sm text-text-secondary">
          Especialidades disponíveis para os profissionais da clínica.
        </p>
      </div>

      <SpecialtyManager specialties={specialties} />
    </div>
  );
}

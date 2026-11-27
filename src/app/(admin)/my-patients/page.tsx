import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPatientsForProfessional } from "@/modules/appointments/services/patient-queries";
import { MyPatientsList } from "@/modules/appointments/components/MyPatientsList";

export const metadata = {
  title: "Meus Pacientes — Espaço Zoe",
};

export default async function MyPatientsPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") redirect("/dashboard");

  const patients = await getPatientsForProfessional(session.user.id);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Meus Pacientes</h1>
        <p className="mt-1 text-sm text-text-secondary">Pacientes que já consultaram com você.</p>
      </div>

      <MyPatientsList patients={patients} />
    </div>
  );
}


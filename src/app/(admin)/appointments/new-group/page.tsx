import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";
import { GroupAppointmentForm } from "@/modules/appointments/components/GroupAppointmentForm";

export const metadata = {
  title: "Atendimento Conjugado — Espaço Zoe",
};

export default async function NewGroupAppointmentPage() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  const [insurances, professionals] = await Promise.all([getActiveInsurances(), getActiveProfessionals()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Atendimento Conjugado</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Dupla, grupo ou multidisciplinar — vários pacientes e/ou profissionais no mesmo horário.
        </p>
      </div>

      {insurances.length === 0 ? (
        <p className="text-sm font-medium text-text-secondary">Nenhum convênio disponível no momento.</p>
      ) : professionals.length === 0 ? (
        <p className="text-sm font-medium text-text-secondary">Nenhum profissional disponível no momento.</p>
      ) : (
        <GroupAppointmentForm
          insurances={insurances}
          professionals={professionals.map((p) => ({ id: p.id, fullName: p.full_name }))}
        />
      )}
    </div>
  );
}

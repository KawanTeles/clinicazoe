import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { StaffAppointmentForm } from "@/modules/appointments/components/StaffAppointmentForm";

export const metadata = {
  title: "Novo Agendamento — ClinicaZoe",
};

export default async function NewAppointmentPage() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  const insurances = await getActiveInsurances();

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
        <StaffAppointmentForm insurances={insurances} />
      )}
    </div>
  );
}

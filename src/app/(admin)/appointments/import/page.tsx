import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { getActiveProfessionalsForSelect } from "@/modules/financial/services/financial-transaction-queries";
import { listImportBatches } from "@/modules/appointments/services/import-actions";
import { ImportAppointmentsPanel } from "@/modules/appointments/components/ImportAppointmentsPanel";

export const metadata = {
  title: "Lançar atendimento já existente — Espaço Zoe",
};

export default async function ImportAppointmentsPage() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  const [insurances, professionals, batches] = await Promise.all([
    getActiveInsurances(),
    getActiveProfessionalsForSelect(),
    listImportBatches(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">
          Lançar atendimento já existente
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Para consultas que já estavam marcadas à mão (fora do sistema) — entram direto confirmadas, sem
          notificação, sem mensagem ao paciente e sem contar como nova solicitação.
        </p>
      </div>

      <ImportAppointmentsPanel
        insurances={insurances.map((i) => ({ id: i.id, name: i.name }))}
        professionals={professionals.map((p) => ({ id: p.id, fullName: p.full_name }))}
        isAdmin={session.profile.role === "admin"}
        initialBatches={batches}
      />
    </div>
  );
}

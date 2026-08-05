import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { listPatients } from "@/modules/patients/services/patient-queries";
import { PatientsTable } from "@/modules/patients/components/PatientsTable";

export const metadata = {
  title: "Pacientes — ClinicaZoe",
};

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; insurance?: string; status?: string; page?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) redirect("/dashboard");

  const { q, insurance, status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ items, totalPages }, insurances] = await Promise.all([
    listPatients({
      search: q,
      insuranceId: insurance,
      status: status === "active" || status === "inactive" ? status : undefined,
      page,
    }),
    getActiveInsurances(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Pacientes</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cadastro completo de pacientes, com busca instantânea e histórico.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/patients/new">
            <Button variant="secondary">Novo paciente</Button>
          </Link>
          <Link href="/appointments/new">
            <Button>Novo Agendamento</Button>
          </Link>
        </div>
      </div>

      <PatientsTable
        patients={items}
        page={page}
        totalPages={totalPages}
        insurances={insurances}
        filters={{ q: q ?? "", insurance: insurance ?? "", status: status ?? "" }}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getInsurances } from "@/modules/insurances/services/insurance-queries";
import { InsuranceManager } from "@/modules/insurances/components/InsuranceManager";

export const metadata = {
  title: "Convênios — Espaço Zoe",
};

export default async function InsurancesPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const insurances = await getInsurances();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Convênios</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Cadastre e gerencie os convênios aceitos pela clínica. &ldquo;Particular&rdquo; também
          é configurável como qualquer outro convênio.
        </p>
      </div>

      <InsuranceManager insurances={insurances} />
    </div>
  );
}


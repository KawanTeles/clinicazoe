import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProfessionals } from "@/modules/professionals/services/professional-queries";
import { getActiveSpecialties } from "@/modules/specialties/services/specialty-queries";
import { getActiveInsurances } from "@/modules/insurances/services/insurance-queries";
import { ProfessionalsListClient } from "@/modules/professionals/components/ProfessionalsListClient";

export const metadata = {
  title: "Profissionais — Espaço Zoe",
};

const STAFF_ROLES = ["admin", "recepcionista"];

export default async function ProfessionalsPage() {
  const session = await getCurrentUser();
  if (!session || !STAFF_ROLES.includes(session.profile.role)) redirect("/dashboard");

  const [professionals, specialties, insurances] = await Promise.all([
    getActiveProfessionals(),
    getActiveSpecialties(),
    getActiveInsurances(),
  ]);

  const canAdd = session.profile.role === "admin";

  return (
    <ProfessionalsListClient
      professionals={professionals}
      specialties={specialties}
      insurances={insurances}
      canAdd={canAdd}
    />
  );
}

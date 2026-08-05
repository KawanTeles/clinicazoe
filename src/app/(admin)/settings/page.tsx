import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getClinicLogoUrl, getClinicSettings } from "@/modules/settings/services/settings-queries";
import { ClinicSettingsForm } from "@/modules/settings/components/ClinicSettingsForm";
import { getHolidays } from "@/modules/holidays/services/holiday-queries";
import { HolidayManager } from "@/modules/holidays/components/HolidayManager";

export const metadata = {
  title: "Configurações — ClinicaZoe",
};

export default async function SettingsPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const [settings, holidays] = await Promise.all([getClinicSettings(), getHolidays()]);
  const logoUrl = await getClinicLogoUrl(settings?.logo_path ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#F5F7F6]">Configurações</h1>
        <p className="mt-1 text-sm text-[#C8D4CF]">Dados gerais da clínica.</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Dados da clínica</CardTitle>
        </CardHeader>
        <CardContent>
          <ClinicSettingsForm
            logoUrl={logoUrl}
            initial={{
              name: settings?.name ?? "",
              whatsapp_number: settings?.whatsapp_number ?? "",
              address: settings?.address ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Feriados</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-text-secondary">
            Datas bloqueadas para todos os profissionais — usadas na checagem de conflito de
            agendamentos avulsos e recorrentes.
          </p>
          <HolidayManager holidays={holidays} />
        </CardContent>
      </Card>
    </div>
  );
}


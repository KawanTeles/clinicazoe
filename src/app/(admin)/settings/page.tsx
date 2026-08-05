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
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Configurações da Clínica</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Gerencie dados da empresa, identidade e calendários de exceção / feriados.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="py-3.5 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              Dados Principais & Logotipo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
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

        <Card>
          <CardHeader className="py-3.5 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              Calendário de Feriados & Bloqueios
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex flex-col gap-4">
            <p className="text-xs text-text-secondary">
              Feriados bloqueiam automaticamente agendamentos normais e recorrentes para todos os profissionais.
            </p>
            <HolidayManager holidays={holidays} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

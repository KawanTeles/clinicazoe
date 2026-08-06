import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinicLogoUrl, getClinicSettings } from "@/modules/settings/services/settings-queries";
import { ClinicSettingsPanel } from "@/modules/settings/components/ClinicSettingsPanel";
import { getHolidays } from "@/modules/holidays/services/holiday-queries";
import { HolidayManager } from "@/modules/holidays/components/HolidayManager";

export const metadata = {
  title: "Configurações — ClinicaZoe",
};

export default async function SettingsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/equipe");

  const canManage = await can(session.profile.role, "settings.manage");
  const canView = canManage || (await can(session.profile.role, "settings.view"));
  if (!canView) redirect("/dashboard");

  const [settings, holidays] = await Promise.all([getClinicSettings(), getHolidays()]);
  const logoUrl = await getClinicLogoUrl(settings?.logo_path ?? null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">Configurações da Clínica</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Gerencie a identidade institucional exibida no site: contatos, endereço, horários, redes sociais e localização.
        </p>
      </div>

      <ClinicSettingsPanel initial={settings} logoUrl={logoUrl} readOnly={!canManage} />

      {canManage && (
        <Card className="mt-2">
          <CardHeader className="py-3.5 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              📅 Calendário de Feriados & Bloqueios
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 flex flex-col gap-4">
            <p className="text-xs text-text-secondary">
              Feriados bloqueiam automaticamente agendamentos normais e recorrentes para todos os profissionais.
            </p>
            <HolidayManager holidays={holidays} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}


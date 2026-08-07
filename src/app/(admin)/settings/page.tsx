import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinicLogoUrl, getClinicSettings } from "@/modules/settings/services/settings-queries";
import { ClinicSettingsPanel } from "@/modules/settings/components/ClinicSettingsPanel";
import { getHolidays } from "@/modules/holidays/services/holiday-queries";
import { HolidayManager } from "@/modules/holidays/components/HolidayManager";
import { getAISettingsForAdmin } from "@/modules/ai/services/ai-settings-queries";
import { AISettingsCard } from "@/modules/ai/components/AISettingsCard";
import { getAIUsageStats } from "@/modules/ai/services/usage-stats-queries";
import { AIUsageStatsCard } from "@/modules/ai/components/AIUsageStatsCard";

export const metadata = {
  title: "Configurações — ClinicaZoe",
};

export default async function SettingsPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/equipe");

  const canManage = await can(session.profile.role, "settings.manage");
  const canView = canManage || (await can(session.profile.role, "settings.view"));
  if (!canView) redirect("/dashboard");

  const canManageAI = await can(session.profile.role, "ai.settings.manage");

  const [settings, holidays, aiSettings, aiUsageStats] = await Promise.all([
    getClinicSettings(),
    getHolidays(),
    canManageAI ? getAISettingsForAdmin() : Promise.resolve(null),
    canManageAI ? getAIUsageStats() : Promise.resolve(null),
  ]);
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

      {canManageAI && aiSettings && (
        <Card className="mt-2">
          <CardHeader className="py-3.5 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              🤖 Inteligência Artificial
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <AISettingsCard initial={aiSettings} />
          </CardContent>
        </Card>
      )}

      {canManageAI && aiUsageStats && (
        <Card className="mt-2">
          <CardHeader className="py-3.5 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              📊 Estatísticas de Uso da IA
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <AIUsageStatsCard stats={aiUsageStats} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}


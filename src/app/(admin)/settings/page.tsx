import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getClinicLogoUrl, getClinicSettings } from "@/modules/settings/services/settings-queries";
import { ClinicSettingsForm } from "@/modules/settings/components/ClinicSettingsForm";

export const metadata = {
  title: "Configurações — ClinicaZoe",
};

export default async function SettingsPage() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") redirect("/dashboard");

  const settings = await getClinicSettings();
  const logoUrl = await getClinicLogoUrl(settings?.logo_path ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Configurações</h1>
        <p className="text-sm text-text-secondary">Dados gerais da clínica.</p>
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
    </div>
  );
}

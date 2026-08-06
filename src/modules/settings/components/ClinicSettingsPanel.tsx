"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { IdentityCard } from "@/modules/settings/components/IdentityCard";
import { AddressCard } from "@/modules/settings/components/AddressCard";
import { ContactsCard } from "@/modules/settings/components/ContactsCard";
import { BusinessHoursCard } from "@/modules/settings/components/BusinessHoursCard";
import { SocialMediaCard } from "@/modules/settings/components/SocialMediaCard";
import { LocationCard } from "@/modules/settings/components/LocationCard";
import { SitePreview } from "@/modules/settings/components/SitePreview";
import { updateAllClinicSettings } from "@/modules/settings/services/settings-actions";
import { toFormState, type ClinicSettingsRow } from "@/modules/settings/utils/form-state";

interface ClinicSettingsPanelProps {
  initial: ClinicSettingsRow | null;
  logoUrl: string | null;
  readOnly: boolean;
}

export function ClinicSettingsPanel({ initial, logoUrl, readOnly }: ClinicSettingsPanelProps) {
  const router = useRouter();
  const [data, setData] = useState(() => toFormState(initial));
  const [savingAll, setSavingAll] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function patch(partial: Partial<typeof data>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  async function handleSaveAll() {
    setSavingAll(true);
    setMessage(null);
    const result = await updateAllClinicSettings(data);
    setSavingAll(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Todas as configurações foram salvas." });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {readOnly && (
        <div className="rounded-xl border border-border bg-card-elevated/50 px-4 py-3 text-xs font-semibold text-text-secondary">
          Você tem acesso somente para visualização. Apenas administradores podem alterar essas configurações.
        </div>
      )}

      {/* Main settings grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
        {/* Configuration cards arranged in balanced responsive grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
          <div className="md:col-span-2">
            <IdentityCard data={data} onChange={patch} logoUrl={logoUrl} readOnly={readOnly} />
          </div>
          <div className="md:col-span-2">
            <AddressCard data={data} onChange={patch} readOnly={readOnly} />
          </div>
          <div className="md:col-span-1">
            <ContactsCard data={data} onChange={patch} readOnly={readOnly} />
          </div>
          <div className="md:col-span-1">
            <SocialMediaCard data={data} onChange={patch} readOnly={readOnly} />
          </div>
          <div className="md:col-span-2">
            <LocationCard data={data} onChange={patch} readOnly={readOnly} />
          </div>
          <div className="md:col-span-2">
            <BusinessHoursCard data={data} onChange={patch} readOnly={readOnly} />
          </div>
        </div>

        {/* Live Site Preview sticky sidebar */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <SitePreview data={data} logoUrl={logoUrl} />
        </div>
      </div>

      {/* Global save button action bar docked right after the configuration cards */}
      {!readOnly && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between transition-all">
          <div className="min-w-0">
            {message ? (
              <p className={message.type === "success" ? "text-xs font-bold text-success animate-fade-in" : "text-xs font-bold text-danger animate-fade-in"}>
                {message.text}
              </p>
            ) : (
              <p className="text-xs font-medium text-text-muted hidden sm:block">
                Salvar todas as alterações da clínica de uma só vez
              </p>
            )}
          </div>
          <Button size="lg" isLoading={savingAll} onClick={handleSaveAll} className="px-8 font-bold shadow-button w-full sm:w-auto shrink-0">
            Salvar Tudo
          </Button>
        </div>
      )}
    </div>
  );
}


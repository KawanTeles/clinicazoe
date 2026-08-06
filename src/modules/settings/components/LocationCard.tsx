"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateClinicLocation } from "@/modules/settings/services/settings-actions";
import { buildFullAddress } from "@/modules/settings/utils/address";
import { buildMapsViewUrl } from "@/lib/maps";
import type { ClinicSettingsFormState } from "@/modules/settings/utils/form-state";

interface LocationCardProps {
  data: ClinicSettingsFormState;
  onChange: (patch: Partial<ClinicSettingsFormState>) => void;
  readOnly: boolean;
}

export function LocationCard({ data, onChange, readOnly }: LocationCardProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateClinicLocation({
      maps_url: data.maps_url,
      latitude: data.latitude,
      longitude: data.longitude,
    });
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Localização salva." });
    router.refresh();
  }

  const previewUrl = buildMapsViewUrl({
    mapsUrl: data.maps_url,
    latitude: data.latitude ? Number(data.latitude) : null,
    longitude: data.longitude ? Number(data.longitude) : null,
    address: buildFullAddress(data),
  });

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="py-3.5 px-5">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
          🗺️ Localização
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 flex flex-col gap-4 flex-1 justify-between">
        <div className="flex flex-col gap-3.5">
          <Input
            label="Link do Google Maps"
            placeholder="https://maps.google.com/?q=..."
            value={data.maps_url}
            disabled={readOnly}
            onChange={(e) => onChange({ maps_url: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3.5">
            <Input
              label="Latitude"
              placeholder="-23.561684"
              value={data.latitude}
              disabled={readOnly}
              onChange={(e) => onChange({ latitude: e.target.value })}
            />
            <Input
              label="Longitude"
              placeholder="-46.655981"
              value={data.longitude}
              disabled={readOnly}
              onChange={(e) => onChange({ longitude: e.target.value })}
            />
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Prioridade de exibição: link do Google Maps &gt; coordenadas &gt; endereço em texto.
          </p>

          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
              <Button type="button" variant="secondary" size="sm" withArrow className="w-full font-bold">
                Visualizar no Google Maps
              </Button>
            </a>
          )}
        </div>

        {message && (
          <p className={message.type === "success" ? "text-xs font-semibold text-success animate-fade-in" : "text-xs font-semibold text-danger animate-fade-in"}>
            {message.text}
          </p>
        )}

        {!readOnly && (
          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button size="sm" isLoading={saving} onClick={handleSave} className="px-5 font-bold">
              Salvar Localização
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateClinicAddress } from "@/modules/settings/services/settings-actions";
import type { ClinicSettingsFormState } from "@/modules/settings/utils/form-state";

interface AddressCardProps {
  data: ClinicSettingsFormState;
  onChange: (patch: Partial<ClinicSettingsFormState>) => void;
  readOnly: boolean;
}

export function AddressCard({ data, onChange, readOnly }: AddressCardProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateClinicAddress({
      address_zip: data.address_zip,
      address_street: data.address_street,
      address_number: data.address_number,
      address_complement: data.address_complement,
      address_neighborhood: data.address_neighborhood,
      address_city: data.address_city,
      address_state: data.address_state,
      address_country: data.address_country,
    });
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Endereço salvo." });
    router.refresh();
  }

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="py-3.5 px-5">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
          📍 Endereço da Clínica
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 flex flex-col gap-4 flex-1 justify-between">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-4">
          {/* Row 1: CEP (1 col) | Rua (3 cols) */}
          <Input
            label="CEP"
            placeholder="00000-000"
            className="sm:col-span-1"
            value={data.address_zip}
            disabled={readOnly}
            onChange={(e) => onChange({ address_zip: e.target.value })}
          />
          <Input
            label="Rua / Logradouro"
            className="sm:col-span-3"
            value={data.address_street}
            disabled={readOnly}
            onChange={(e) => onChange({ address_street: e.target.value })}
          />

          {/* Row 2: Número (1 col) | Complemento (1 col) | Bairro (2 cols) */}
          <Input
            label="Número"
            className="sm:col-span-1"
            value={data.address_number}
            disabled={readOnly}
            onChange={(e) => onChange({ address_number: e.target.value })}
          />
          <Input
            label="Complemento"
            placeholder="Opcional"
            className="sm:col-span-1"
            value={data.address_complement}
            disabled={readOnly}
            onChange={(e) => onChange({ address_complement: e.target.value })}
          />
          <Input
            label="Bairro"
            className="sm:col-span-2"
            value={data.address_neighborhood}
            disabled={readOnly}
            onChange={(e) => onChange({ address_neighborhood: e.target.value })}
          />

          {/* Row 3: Cidade (2 cols) | Estado (1 col) | País (1 col) */}
          <Input
            label="Cidade"
            className="sm:col-span-2"
            value={data.address_city}
            disabled={readOnly}
            onChange={(e) => onChange({ address_city: e.target.value })}
          />
          <Input
            label="Estado"
            placeholder="UF"
            className="sm:col-span-1"
            value={data.address_state}
            disabled={readOnly}
            onChange={(e) => onChange({ address_state: e.target.value })}
          />
          <Input
            label="País"
            className="sm:col-span-1"
            value={data.address_country}
            disabled={readOnly}
            onChange={(e) => onChange({ address_country: e.target.value })}
          />
        </div>

        {message && (
          <p className={message.type === "success" ? "text-xs font-semibold text-success animate-fade-in" : "text-xs font-semibold text-danger animate-fade-in"}>
            {message.text}
          </p>
        )}

        {!readOnly && (
          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button size="sm" isLoading={saving} onClick={handleSave} className="px-5 font-bold">
              Salvar Endereço
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}



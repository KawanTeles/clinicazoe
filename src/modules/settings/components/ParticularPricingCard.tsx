"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateClinicParticularPricing } from "@/modules/settings/services/settings-actions";
import type { ClinicSettingsFormState } from "@/modules/settings/utils/form-state";

interface ParticularPricingCardProps {
  data: ClinicSettingsFormState;
  onChange: (patch: Partial<ClinicSettingsFormState>) => void;
  readOnly: boolean;
}

export function ParticularPricingCard({ data, onChange, readOnly }: ParticularPricingCardProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateClinicParticularPricing({
      price_particular_consultation: data.price_particular_consultation,
      price_particular_package: data.price_particular_package,
    });
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Valores particulares salvos." });
    router.refresh();
  }

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="py-3.5 px-5">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
          💳 Valores Particular
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 flex flex-col gap-4 flex-1 justify-between">
        <div className="flex flex-col gap-3.5">
          <p className="text-xs text-text-secondary leading-relaxed">
            Valores únicos para toda a clínica — não variam por profissional. A forma de pagamento
            escolhida no agendamento particular (Cartão/PIX/Dinheiro) é só um registro e não altera esses valores.
          </p>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Input
              label="Atendimento Particular (R$) *"
              type="number"
              min={0}
              step="0.01"
              placeholder="0,00"
              value={data.price_particular_consultation}
              disabled={readOnly}
              onChange={(e) => onChange({ price_particular_consultation: e.target.value })}
            />
            <Input
              label="Pacote Particular — 1 mês (R$) *"
              type="number"
              min={0}
              step="0.01"
              placeholder="0,00"
              value={data.price_particular_package}
              disabled={readOnly}
              onChange={(e) => onChange({ price_particular_package: e.target.value })}
            />
          </div>
        </div>

        {message && (
          <p className={message.type === "success" ? "text-xs font-semibold text-success animate-fade-in" : "text-xs font-semibold text-danger animate-fade-in"}>
            {message.text}
          </p>
        )}

        {!readOnly && (
          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button size="sm" isLoading={saving} onClick={handleSave} className="px-5 font-bold">
              Salvar Valores
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

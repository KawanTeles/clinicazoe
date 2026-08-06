"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateClinicContacts } from "@/modules/settings/services/settings-actions";
import type { ClinicSettingsFormState } from "@/modules/settings/utils/form-state";

interface ContactsCardProps {
  data: ClinicSettingsFormState;
  onChange: (patch: Partial<ClinicSettingsFormState>) => void;
  readOnly: boolean;
}

export function ContactsCard({ data, onChange, readOnly }: ContactsCardProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateClinicContacts({
      whatsapp_number: data.whatsapp_number,
      phone_primary: data.phone_primary,
      phone_secondary: data.phone_secondary,
      emergency_phone: data.emergency_phone,
    });
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Contatos salvos." });
    router.refresh();
  }

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="py-3.5 px-5">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
          📞 Contatos
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 flex flex-col gap-4 flex-1 justify-between">
        <div className="flex flex-col gap-3.5">
          <p className="text-xs text-text-secondary leading-relaxed">
            O WhatsApp é o canal principal em destaque no site. Os demais telefones aparecem como informação adicional.
          </p>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Input
              label="WhatsApp de Contato *"
              type="tel"
              placeholder="(00) 00000-0000"
              value={data.whatsapp_number}
              disabled={readOnly}
              onChange={(e) => onChange({ whatsapp_number: e.target.value })}
            />
            <Input
              label="Telefone Principal"
              type="tel"
              placeholder="Opcional"
              value={data.phone_primary}
              disabled={readOnly}
              onChange={(e) => onChange({ phone_primary: e.target.value })}
            />
            <Input
              label="Telefone Secundário"
              type="tel"
              placeholder="Opcional"
              value={data.phone_secondary}
              disabled={readOnly}
              onChange={(e) => onChange({ phone_secondary: e.target.value })}
            />
            <Input
              label="Telefone de Emergência"
              type="tel"
              placeholder="Opcional"
              value={data.emergency_phone}
              disabled={readOnly}
              onChange={(e) => onChange({ emergency_phone: e.target.value })}
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
              Salvar Contatos
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


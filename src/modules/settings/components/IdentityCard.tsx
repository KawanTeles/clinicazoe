"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LogoUploader } from "@/modules/settings/components/LogoUploader";
import { updateClinicIdentity } from "@/modules/settings/services/settings-actions";
import type { ClinicSettingsFormState } from "@/modules/settings/utils/form-state";

interface IdentityCardProps {
  data: ClinicSettingsFormState;
  onChange: (patch: Partial<ClinicSettingsFormState>) => void;
  logoUrl: string | null;
  readOnly: boolean;
}

export function IdentityCard({ data, onChange, logoUrl, readOnly }: IdentityCardProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateClinicIdentity({
      name: data.name,
      legal_name: data.legal_name,
      email: data.email,
      website_url: data.website_url,
    });
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Identidade salva." });
    router.refresh();
  }

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="py-3.5 px-5">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
          🏥 Identidade da Clínica
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 flex flex-col gap-4 flex-1 justify-between">
        <div className="flex flex-col gap-4">
          <LogoUploader logoUrl={logoUrl} readOnly={readOnly} />

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Input
              label="Nome Público da Clínica *"
              value={data.name}
              disabled={readOnly}
              onChange={(e) => onChange({ name: e.target.value })}
            />
            <Input
              label="Nome Empresarial / Razão Social"
              placeholder="Opcional"
              value={data.legal_name}
              disabled={readOnly}
              onChange={(e) => onChange({ legal_name: e.target.value })}
            />
            <Input
              label="E-mail Principal"
              type="email"
              placeholder="contato@clinica.com.br"
              value={data.email}
              disabled={readOnly}
              onChange={(e) => onChange({ email: e.target.value })}
            />
            <Input
              label="Site Oficial"
              placeholder="https://www.clinica.com.br"
              value={data.website_url}
              disabled={readOnly}
              onChange={(e) => onChange({ website_url: e.target.value })}
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
              Salvar Identidade
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateClinicSettings, uploadClinicLogo } from "@/modules/settings/services/settings-actions";

export function ClinicSettingsForm({
  initial,
  logoUrl,
}: {
  initial: { name: string; whatsapp_number: string; address: string };
  logoUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp_number);
  const [address, setAddress] = useState(initial.address);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const result = await updateClinicSettings({
      name,
      whatsapp_number: whatsapp,
      address,
    });

    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({ type: "success", text: "Configurações salvas." });
    router.refresh();
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setMessage(null);
    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadClinicLogo(formData);

    setUploadingLogo(false);
    if (result.error) {
      setPreview(logoUrl);
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({ type: "success", text: "Logo atualizado." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-4xl">
      <div className="rounded-xl border border-border/80 bg-card p-4 flex flex-col gap-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
            Identidade & Marca da Clínica
          </span>
          <span className="text-[10px] font-medium text-text-muted">Logo e nome público</span>
        </div>

        {/* Header Logo Upload */}
        <div className="flex items-center gap-4 bg-card-elevated/40 p-3 rounded-lg border border-border/50">
          {preview ? (
            <Image
              src={preview}
              alt="Logo da clínica"
              width={52}
              height={52}
              className="h-13 w-13 rounded-lg border border-border object-contain bg-card-elevated p-1.5"
              unoptimized
            />
          ) : (
            <div className="flex h-13 w-13 items-center justify-center rounded-lg border border-dashed border-border bg-card-elevated text-[11px] text-text-muted">
              Sem logo
            </div>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs px-3 font-semibold"
                isLoading={uploadingLogo}
                onClick={() => fileInputRef.current?.click()}
              >
                Alterar Logo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
            <span className="text-[11px] text-text-muted">PNG, JPG, WEBP ou SVG até 2MB</span>
          </div>
        </div>

        {/* 2-Column Fields */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Nome da Clínica *" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="WhatsApp de Contato *"
            name="whatsapp_number"
            type="tel"
            placeholder="(00) 00000-0000"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>

        <Input
          label="Endereço da Clínica"
          name="address"
          placeholder="Rua, Número, Bairro, Cidade - UF"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      {message && (
        <p className={message.type === "success" ? "text-xs font-semibold text-success" : "text-xs font-semibold text-danger"}>
          {message.text}
        </p>
      )}

      {/* Sticky Bottom Bar */}
      <div className="flex items-center justify-end gap-2.5 rounded-xl border border-border bg-card p-3 shadow-sm">
        <Button type="submit" size="sm" isLoading={saving} className="px-5 font-bold shadow-button">
          Salvar Configurações
        </Button>
      </div>
    </form>
  );
}

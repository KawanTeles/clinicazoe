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
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {preview ? (
          <Image
            src={preview}
            alt="Logo da clínica"
            width={64}
            height={64}
            className="h-16 w-16 rounded-xl border border-[#255044] object-contain bg-[#17382D] p-2"
            unoptimized
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-[#255044] bg-[#17382D] text-xs text-[#7A9187]">
            Sem logo
          </div>
        )}
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={uploadingLogo}
            onClick={() => fileInputRef.current?.click()}
          >
            Alterar logo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
          <p className="mt-1.5 text-xs text-[#7A9187]">PNG, JPG, WEBP ou SVG até 2MB.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nome da clínica" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="WhatsApp da clínica"
          name="whatsapp_number"
          type="tel"
          placeholder="(00) 00000-0000"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
        <p className="-mt-2 text-xs text-[#7A9187]">
          Recebe os avisos de novo agendamento (link do WhatsApp).
        </p>
        <Input
          label="Endereço"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        {message && (
          <p className={message.type === "success" ? "text-sm font-semibold text-[#5ED39D]" : "text-sm font-semibold text-[#FF8A8A]"}>
            {message.text}
          </p>
        )}

        <Button type="submit" isLoading={saving} className="w-fit">
          Salvar
        </Button>
      </form>

    </div>
  );
}

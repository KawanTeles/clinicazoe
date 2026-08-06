"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { uploadClinicLogo } from "@/modules/settings/services/settings-actions";

export function LogoUploader({ logoUrl, readOnly }: { logoUrl: string | null; readOnly: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadClinicLogo(formData);

    setUploading(false);
    if (result.error) {
      setPreview(logoUrl);
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({ type: "success", text: "Logo atualizado." });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
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
        {!readOnly && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs px-3 font-semibold"
                isLoading={uploading}
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
        )}
      </div>
      {message && (
        <p className={message.type === "success" ? "text-xs font-semibold text-success" : "text-xs font-semibold text-danger"}>
          {message.text}
        </p>
      )}
    </div>
  );
}

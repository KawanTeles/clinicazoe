"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { uploadInsuranceLogo } from "@/modules/insurances/services/insurance-actions";

export function InsuranceLogoUploader({ insuranceId, logoUrl }: { insuranceId: string; logoUrl: string | null }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadInsuranceLogo(insuranceId, formData);

    setUploading(false);
    if (result.error) {
      setPreview(logoUrl);
      setError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        {preview ? (
          <Image
            src={preview}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-md border border-border object-contain bg-card-elevated p-1"
            unoptimized
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border bg-card-elevated text-[9px] text-text-muted">
            —
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] px-2 font-semibold"
          isLoading={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {preview ? "Trocar" : "Adicionar logo"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleLogoChange}
        />
      </div>
      {error && <p className="text-[10px] font-semibold text-danger">{error}</p>}
    </div>
  );
}

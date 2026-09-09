"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { uploadClinicFacadeImage } from "@/modules/settings/services/settings-actions";

export function FacadeImageUploader({ facadeImageUrl, readOnly }: { facadeImageUrl: string | null; readOnly: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(facadeImageUrl);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadClinicFacadeImage(formData);

    setUploading(false);
    if (result.error) {
      setPreview(facadeImageUrl);
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({ type: "success", text: "Foto de capa atualizada." });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 bg-card-elevated/40 p-3 rounded-lg border border-border/50">
        {preview ? (
          <Image
            src={preview}
            alt="Foto de capa/fachada"
            width={80}
            height={52}
            className="h-13 w-20 rounded-lg border border-border object-cover bg-card-elevated"
            unoptimized
          />
        ) : (
          <div className="flex h-13 w-20 items-center justify-center rounded-lg border border-dashed border-border bg-card-elevated text-[10px] text-text-muted text-center px-1">
            Sem foto — fundo padrão
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
                {preview ? "Alterar Foto" : "Enviar Foto"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <span className="text-[11px] text-text-muted">PNG, JPG ou WEBP até 5MB</span>
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

"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateOwnProfile, uploadAvatar } from "@/modules/users/services/profile-client";

interface ProfileFormProps {
  userId: string;
  initialFullName: string;
  initialPhone: string;
  avatarUrl: string | null;
}

export function ProfileForm({ userId, initialFullName, initialPhone, avatarUrl }: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await updateOwnProfile(userId, { full_name: fullName, phone });

    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: "Não foi possível salvar as alterações." });
      return;
    }

    setMessage({ type: "success", text: "Perfil atualizado com sucesso." });
    router.refresh();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const result = await uploadAvatar(userId, file);

    setUploading(false);
    if (result.error) {
      setPreview(avatarUrl);
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({ type: "success", text: "Foto atualizada com sucesso." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar src={preview} name={fullName || "Usuário"} size={64} />
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Alterar foto
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="mt-1 text-xs text-text-secondary">PNG, JPG ou WEBP até 3MB.</p>
        </div>
      </div>

      <Input
        label="Nome completo"
        name="full_name"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <Input
        label="Telefone"
        name="phone"
        type="tel"
        placeholder="(00) 00000-0000"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      {message && (
        <p className={message.type === "success" ? "text-sm font-semibold text-[#5ED39D]" : "text-sm font-semibold text-[#FF8A8A]"}>
          {message.text}
        </p>
      )}

      <Button type="submit" isLoading={saving} className="w-fit">
        Salvar alterações
      </Button>
    </form>
  );
}


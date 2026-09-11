"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateOwnPassword, updateOwnProfile, uploadAvatar } from "@/modules/users/services/profile-client";
import { updateOwnProfessionalBio } from "@/modules/professionals/services/professional-profile-actions";

const MAX_BIO_LENGTH = 500;

interface ProfileFormProps {
  userId: string;
  initialFullName: string;
  initialPhone: string;
  avatarUrl: string | null;
  /** Só profissionais têm biografia própria — especialidade, convênios e status continuam exclusivos da administradora. */
  isProfessional?: boolean;
  initialBio?: string;
}

export function ProfileForm({ userId, initialFullName, initialPhone, avatarUrl, isProfessional = false, initialBio = "" }: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [bio, setBio] = useState(initialBio);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await updateOwnProfile(userId, { full_name: fullName, phone });
    if (error) {
      setSaving(false);
      setMessage({ type: "error", text: "Não foi possível salvar as alterações." });
      return;
    }

    if (isProfessional) {
      const bioResult = await updateOwnProfessionalBio(bio);
      setSaving(false);
      if (bioResult.error) {
        setMessage({ type: "error", text: bioResult.error });
        return;
      }
    } else {
      setSaving(false);
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

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "A senha precisa ter ao menos 8 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "As senhas não coincidem." });
      return;
    }

    setPasswordSaving(true);
    const { error } = await updateOwnPassword(newPassword);
    setPasswordSaving(false);

    if (error) {
      setPasswordMessage({ type: "error", text: error });
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage({ type: "success", text: "Senha alterada com sucesso." });
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/80 bg-card p-4 flex flex-col gap-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
            Meu Perfil de Usuário
          </span>
        </div>

        <div className="flex items-center gap-4 bg-card-elevated/40 p-3 rounded-lg border border-border/50">
          <Avatar src={preview} name={fullName || "Usuário"} size={52} />
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
                Alterar foto
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <span className="text-[11px] text-text-muted">PNG, JPG ou WEBP até 3MB</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Nome completo *"
            name="full_name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="Telefone / Celular"
            name="phone"
            type="tel"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      {isProfessional && (
        <div className="rounded-xl border border-border/80 bg-card p-4 flex flex-col gap-2.5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
              Biografia / Apresentação
            </span>
            <span className="text-[11px] text-text-muted">{bio.length}/{MAX_BIO_LENGTH}</span>
          </div>
          <p className="text-xs text-text-secondary">
            Esse texto aparece no seu perfil público no site da clínica.
          </p>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={MAX_BIO_LENGTH}
            placeholder="Resumo de experiência, especializações e atendimento ao público..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-lg border border-border bg-card-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 resize-none"
          />
        </div>
      )}

      {message && (
        <p className={message.type === "success" ? "text-xs font-semibold text-success" : "text-xs font-semibold text-danger"}>
          {message.text}
        </p>
      )}

      <div className="flex items-center justify-end gap-2.5 rounded-xl border border-border bg-card p-3 shadow-sm">
        <Button type="submit" size="sm" isLoading={saving} className="px-5 font-bold shadow-button">
          Salvar Alterações
        </Button>
      </div>
    </form>

    <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/80 bg-card p-4 flex flex-col gap-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
            Alterar Senha
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Nova senha"
            name="new_password"
            type="password"
            placeholder="Mínimo de 8 caracteres"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Confirmar nova senha"
            name="confirm_password"
            type="password"
            placeholder="Repita a nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {passwordMessage && (
          <p
            className={
              passwordMessage.type === "success"
                ? "text-xs font-semibold text-success"
                : "text-xs font-semibold text-danger"
            }
          >
            {passwordMessage.text}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2.5 rounded-xl border border-border bg-card p-3 shadow-sm">
        <Button type="submit" size="sm" isLoading={passwordSaving} className="px-5 font-bold shadow-button">
          Salvar Nova Senha
        </Button>
      </div>
    </form>
    </div>
  );
}

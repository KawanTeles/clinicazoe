"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ROLE_LABELS } from "@/lib/navigation";
import type { Role, Status } from "@/lib/supabase/types";
import { updateUser, uploadUserAvatar } from "@/modules/user-management/services/user-actions";

const ALL_ROLES: Role[] = ["admin", "recepcionista", "profissional", "paciente"];

interface UserEditFormProps {
  userId: string;
  isSelf: boolean;
  avatarUrl: string | null;
  initial: {
    full_name: string;
    email: string;
    phone: string;
    role: Role;
    status: Status;
  };
}

export function UserEditForm({ userId, isSelf, avatarUrl, initial }: UserEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initial.full_name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [role, setRole] = useState<Role>(initial.role);
  const [status, setStatus] = useState<Status>(initial.status);
  const [password, setPassword] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedBySelf = isSelf;

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const result = await updateUser({
      id: userId,
      full_name: fullName,
      phone,
      email,
      role,
      status,
      password: password || undefined,
    });

    if (result.error) {
      setSaving(false);
      setError(result.error);
      return;
    }

    if (photoFile) {
      const photoData = new FormData();
      photoData.set("file", photoFile);
      const photoResult = await uploadUserAvatar(userId, photoData);
      setSaving(false);
      if (photoResult.error) {
        setError(photoResult.error);
        return;
      }
    } else {
      setSaving(false);
    }

    router.push("/users");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
            Dados da Conta
          </span>
          <span className="text-[10px] font-medium text-text-muted">Informações básicas do usuário</span>
        </div>

        <div className="flex items-center gap-3.5 bg-card-elevated/40 p-2.5 rounded-lg border border-border/50">
          <Avatar src={preview} name={fullName || "Usuário"} size={44} />
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-[11px] px-2.5 py-0 font-semibold"
                onClick={() => fileInputRef.current?.click()}
              >
                Alterar Foto
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <span className="text-[10px] text-text-muted hidden sm:inline">JPG, PNG ou WEBP</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Nome Completo *"
            name="full_name"
            required
            placeholder="Nome completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="E-mail *"
            name="email"
            type="email"
            required
            placeholder="usuario@clinicazoe.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Telefone / WhatsApp"
            name="phone"
            type="tel"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Select
            label="Tipo de Usuário"
            name="role"
            value={role}
            disabled={lockedBySelf}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Select
            label="Status no Sistema"
            name="status"
            value={status}
            disabled={lockedBySelf}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </Select>
          <Input
            label="Nova Senha (opcional)"
            name="password"
            type="password"
            placeholder="Manter senha atual"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {lockedBySelf && (
          <p className="text-[11px] text-text-muted">
            Você está editando sua própria conta — tipo de usuário e status não podem ser alterados por aqui.
          </p>
        )}
      </div>

      {/* Sticky Bottom Action Footer */}
      <div className="sticky bottom-0 z-20 mt-3 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-3.5 sm:px-5 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
          <svg className="w-4 h-4 text-emerald-500 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span>Campos marcados com (<strong className="text-danger">*</strong>) são de preenchimento obrigatório</span>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => router.push("/users")} className="font-semibold text-text-secondary hover:text-text-primary">
            Cancelar
          </Button>
          <Button type="submit" size="sm" isLoading={saving} className="px-6 font-bold shadow-button bg-primary hover:bg-primary-hover text-white">
            Salvar Alterações
          </Button>
        </div>
      </div>
    </form>
  );
}

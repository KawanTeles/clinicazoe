"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ROLE_LABELS } from "@/lib/navigation";
import { UNIMED_INSURANCE_NAME, POSTAL_SAUDE_INSURANCE_NAME } from "@/lib/constants";
import type { Modality, Role } from "@/lib/supabase/types";
import {
  createTeamMember,
  updateTeamMember,
  uploadTeamMemberAvatar,
} from "@/modules/team/services/team-actions";

const TEAM_ROLES: Role[] = ["profissional", "recepcionista", "admin"];
const MODALITIES: Modality[] = ["aba", "comum"];
const MODALITY_TITLES: Record<Modality, string> = { aba: "ABA", comum: "Comum" };

interface InsuranceOption {
  id: string;
  name: string;
}

interface InsuranceSelection {
  insurance_id: string;
  modality: Modality;
  value: string;
  duration_minutes?: string;
}

interface TeamMemberFormProps {
  mode: "create" | "edit";
  memberId?: string;
  isSelf?: boolean;
  avatarUrl?: string | null;
  specialties: { id: string; name: string }[];
  insurances: InsuranceOption[];
  onCancel?: () => void;
  initial?: {
    full_name: string;
    email: string;
    phone: string;
    role: Role;
    status: "active" | "inactive";
    specialty_id: string;
    license_number: string;
    bio: string;
    agenda_color: string;
    consultation_duration_minutes: string;
    insurances: InsuranceSelection[];
  };
}

const DEFAULTS = {
  full_name: "",
  email: "",
  phone: "",
  role: "profissional" as Role,
  status: "active" as const,
  specialty_id: "",
  license_number: "",
  bio: "",
  agenda_color: "#2F8F83",
  consultation_duration_minutes: "30",
  insurances: [] as InsuranceSelection[],
};

export function TeamMemberForm({
  mode,
  memberId,
  isSelf,
  avatarUrl,
  specialties,
  insurances,
  onCancel,
  initial,
}: TeamMemberFormProps) {
  const router = useRouter();
  const toast = useToast();
  const values = initial ?? DEFAULTS;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unimed = insurances.find((i) => i.name === UNIMED_INSURANCE_NAME);
  const postal = insurances.find((i) => i.name === POSTAL_SAUDE_INSURANCE_NAME);

  const [fullName, setFullName] = useState(values.full_name);
  const [email, setEmail] = useState(values.email);
  const [phone, setPhone] = useState(values.phone);
  const [role, setRole] = useState<Role>(values.role);
  const [status, setStatus] = useState<"active" | "inactive">(values.status);
  const [password, setPassword] = useState("");
  const [specialtyId, setSpecialtyId] = useState(values.specialty_id);
  const [licenseNumber, setLicenseNumber] = useState(values.license_number);
  const [bio, setBio] = useState(values.bio);
  const [agendaColor, setAgendaColor] = useState(values.agenda_color);
  const [duration, setDuration] = useState(values.consultation_duration_minutes);
  const [modalityCells, setModalityCells] = useState<Record<string, { value: string; duration_minutes: string }>>(
    Object.fromEntries(
      values.insurances.map((i) => [
        `${i.insurance_id}:${i.modality}`,
        { value: i.value, duration_minutes: i.duration_minutes ?? "" },
      ]),
    ),
  );

  function modalityCell(insuranceId: string, modality: Modality) {
    return modalityCells[`${insuranceId}:${modality}`] ?? { value: "", duration_minutes: "" };
  }

  function setModalityCell(insuranceId: string, modality: Modality, patch: Partial<{ value: string; duration_minutes: string }>) {
    const key = `${insuranceId}:${modality}`;
    setModalityCells((prev) => ({ ...prev, [key]: { ...modalityCell(insuranceId, modality), ...patch } }));
  }

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl ?? null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedBySelf = mode === "edit" && isSelf;

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function buildInsurancesPayload(): { insurance_id: string; modality: Modality; value: number; duration_minutes?: number }[] {
    const result: { insurance_id: string; modality: Modality; value: number; duration_minutes?: number }[] = [];
    for (const insurance of [unimed, postal]) {
      if (!insurance) continue;
      for (const modality of MODALITIES) {
        const cell = modalityCell(insurance.id, modality);
        const value = Number(cell.value.replace(",", "."));
        if (cell.value.trim() && value > 0) {
          result.push({
            insurance_id: insurance.id,
            modality,
            value,
            duration_minutes: cell.duration_minutes ? Number(cell.duration_minutes) : undefined,
          });
        }
      }
    }
    return result;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const invalidCell = Object.values(modalityCells).find(
      (cell) => cell.value.trim() && Number(cell.value.replace(",", ".")) <= 0,
    );
    if (role === "profissional" && invalidCell) {
      setError("Informe um valor maior que zero para os campos preenchidos.");
      return;
    }

    setSaving(true);

    try {
      let targetId = memberId;
      const professionalFields = {
        specialty_id: specialtyId || undefined,
        license_number: licenseNumber,
        bio,
        agenda_color: agendaColor,
        consultation_duration_minutes: Number(duration) || 30,
        insurances: buildInsurancesPayload(),
      };

      if (mode === "create") {
        const result = await createTeamMember({
          full_name: fullName,
          email,
          password,
          phone,
          role,
          ...professionalFields,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        targetId = result.id;
      } else {
        const result = await updateTeamMember({
          id: memberId!,
          full_name: fullName,
          phone,
          role,
          status,
          password: password || undefined,
          ...professionalFields,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
      }

      if (photoFile && targetId) {
        const photoData = new FormData();
        photoData.set("file", photoFile);
        const photoResult = await uploadTeamMemberAvatar(targetId, photoData);
        if (photoResult.error) {
          setError(photoResult.error);
          return;
        }
      }

      toast.success(
        mode === "create" ? `"${fullName}" foi cadastrado com sucesso.` : "Alterações salvas com sucesso.",
      );

      router.refresh();

      if (onCancel) {
        onCancel();
      } else {
        router.push("/team");
      }
    } catch {
      setError("Não foi possível concluir a operação. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/team");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </div>
      )}

      {/* GROUP 1: DADOS PESSOAIS */}
      <div className="rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
            1. Dados Pessoais & Acesso
          </span>
          <span className="text-[10px] font-medium text-text-muted">Informações básicas do membro</span>
        </div>

        {/* Compact Avatar Header */}
        <div className="flex items-center gap-3.5 bg-card-elevated/40 p-2.5 rounded-lg border border-border/50">
          <Avatar src={preview} name={fullName || "Novo membro"} size={44} />
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-[11px] px-2.5 py-0 font-semibold"
                onClick={() => fileInputRef.current?.click()}
              >
                {mode === "create" ? "Selecionar Foto" : "Alterar Foto"}
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

        {/* 3-Column Field Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Nome Completo *"
            name="full_name"
            required
            placeholder="Ex: Dra. Ana Clara Silva"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="E-mail *"
            name="email"
            type="email"
            required
            disabled={mode === "edit"}
            placeholder="membro@clinicazoe.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Telefone / Celular"
            name="phone"
            type="tel"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Select
            label="Cargo / Função"
            name="role"
            value={role}
            disabled={lockedBySelf}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {TEAM_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>

          {mode === "edit" ? (
            <Select
              label="Status no Sistema"
              name="status"
              value={status}
              disabled={lockedBySelf}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </Select>
          ) : null}

          <Input
            label={mode === "create" ? "Senha de Acesso *" : "Nova Senha (opcional)"}
            name="password"
            type="password"
            required={mode === "create"}
            placeholder={mode === "edit" ? "Manter senha atual" : "••••••••"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {/* GROUP 2: DADOS PROFISSIONAIS (When role === profissional) */}
      {role === "profissional" && (
        <div className="rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
              2. Dados Profissionais & Convênios
            </span>
            <span className="text-[10px] font-medium text-text-muted">Atendimento e tabela de valores</span>
          </div>

          {/* 4-Column Compact Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Especialidade"
              name="specialty_id"
              value={specialtyId}
              onChange={(e) => setSpecialtyId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input
              label="Registro (CRM / CRO)"
              name="license_number"
              placeholder="CRM/SP 123456"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
            />
            <Input
              label="Duração do Atendimento (min)"
              name="consultation_duration_minutes"
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Cor na Agenda</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={agendaColor}
                  onChange={(e) => setAgendaColor(e.target.value)}
                  className="h-9.5 w-14 cursor-pointer rounded-lg border border-border bg-card-elevated p-1"
                />
                <span className="text-xs font-mono font-semibold text-text-primary uppercase">{agendaColor}</span>
              </div>
            </div>
          </div>

          {/* Valores dos Convênios: Unimed e Postal Saúde, cada uma com ABA/Comum */}
          <div className="flex flex-col gap-2.5 border-t border-border/40 pt-3">
            <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
              Valores dos Convênios
            </span>
            {!unimed && !postal && (
              <span className="text-xs text-text-muted">
                Convênios Unimed e Postal Saúde não encontrados. Cadastre-os em Convênios.
              </span>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[unimed, postal].filter((i): i is InsuranceOption => Boolean(i)).map((insurance) => (
                <div key={insurance.id} className="rounded-lg border border-border bg-card-elevated/40 p-3 flex flex-col gap-2.5">
                  <span className="text-xs font-bold text-text-primary">{insurance.name}</span>
                  <div className="grid grid-cols-2 gap-3">
                    {MODALITIES.map((modality) => {
                      const cell = modalityCell(insurance.id, modality);
                      return (
                        <div key={modality} className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                            {MODALITY_TITLES[modality]}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="R$ Valor"
                              value={cell.value}
                              onChange={(e) => setModalityCell(insurance.id, modality, { value: e.target.value })}
                              className="h-8 w-24 rounded-md border border-border bg-card px-2 text-xs text-text-primary"
                            />
                            <input
                              type="number"
                              min={5}
                              step={5}
                              placeholder="Min"
                              value={cell.duration_minutes}
                              onChange={(e) => setModalityCell(insurance.id, modality, { duration_minutes: e.target.value })}
                              className="h-8 w-16 rounded-md border border-border bg-card px-2 text-xs text-text-primary"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-text-muted">
              Deixe em branco a modalidade que o profissional não atende. Os valores de Particular são configurados em Configurações da Clínica.
            </p>
          </div>
        </div>
      )}

      {/* GROUP 3: CONFIGURAÇÕES & BIOGRAFIA */}
      <div className="rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 flex flex-col gap-2.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
            3. Biografia / Apresentação (opcional)
          </span>
        </div>
        <textarea
          id="bio"
          name="bio"
          rows={2}
          placeholder="Resumo de experiência, especializações e atendimento ao público..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full rounded-lg border border-border bg-card-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 resize-none"
        />
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
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={handleCancelClick} className="font-semibold text-text-secondary hover:text-text-primary">
            Cancelar
          </Button>
          <Button type="submit" size="sm" isLoading={saving} className="px-6 font-bold shadow-button bg-primary hover:bg-primary-hover text-white">
            {mode === "create" ? "Criar Membro" : "Salvar Alterações"}
          </Button>
        </div>
      </div>
    </form>
  );
}

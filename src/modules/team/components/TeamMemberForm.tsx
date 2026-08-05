"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ROLE_LABELS } from "@/lib/navigation";
import { PARTICULAR_INSURANCE_NAME } from "@/lib/constants";
import type { Role } from "@/lib/supabase/types";
import {
  createTeamMember,
  updateTeamMember,
  uploadTeamMemberAvatar,
} from "@/modules/team/services/team-actions";

const TEAM_ROLES: Role[] = ["profissional", "recepcionista", "admin"];

interface InsuranceOption {
  id: string;
  name: string;
}

interface InsuranceSelection {
  insurance_id: string;
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
    price_particular_card: string;
    price_particular_pix: string;
    price_particular_cash: string;
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
  price_particular_card: "",
  price_particular_pix: "",
  price_particular_cash: "",
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
  const values = initial ?? DEFAULTS;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const convenios = insurances.filter((i) => i.name !== PARTICULAR_INSURANCE_NAME);

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
  const [priceCard, setPriceCard] = useState(values.price_particular_card);
  const [pricePix, setPricePix] = useState(values.price_particular_pix);
  const [priceCash, setPriceCash] = useState(values.price_particular_cash);
  const [insuranceValues, setInsuranceValues] = useState<Record<string, string>>(
    Object.fromEntries(values.insurances.map((i) => [i.insurance_id, i.value]))
  );
  const [insuranceDurations, setInsuranceDurations] = useState<Record<string, string>>(
    Object.fromEntries(values.insurances.map((i) => [i.insurance_id, i.duration_minutes ?? ""]))
  );

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

  function toggleInsurance(id: string) {
    setInsuranceValues((prev) => {
      const next = { ...prev };
      if (id in next) {
        delete next[id];
      } else {
        next[id] = "";
      }
      return next;
    });
    setInsuranceDurations((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function buildInsurancesPayload(): { insurance_id: string; value: number; duration_minutes?: number }[] {
    return Object.entries(insuranceValues).map(([insurance_id, value]) => ({
      insurance_id,
      value: Number(value.replace(",", ".")) || 0,
      duration_minutes: insuranceDurations[insurance_id]
        ? Number(insuranceDurations[insurance_id])
        : undefined,
    }));
  }

  function parsePrice(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const missingPrice = Object.entries(insuranceValues).find(
      ([, value]) => !value.trim() || Number(value.replace(",", ".")) <= 0
    );
    if (role === "profissional" && missingPrice) {
      setError("Informe um valor maior que zero para cada convênio marcado.");
      return;
    }

    setSaving(true);

    let targetId = memberId;
    const professionalFields = {
      specialty_id: specialtyId || undefined,
      license_number: licenseNumber,
      bio,
      agenda_color: agendaColor,
      consultation_duration_minutes: Number(duration) || 30,
      price_particular_card: parsePrice(priceCard),
      price_particular_pix: parsePrice(pricePix),
      price_particular_cash: parsePrice(priceCash),
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
        setSaving(false);
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
        setSaving(false);
        setError(result.error);
        return;
      }
    }

    if (photoFile && targetId) {
      const photoData = new FormData();
      photoData.set("file", photoFile);
      const photoResult = await uploadTeamMemberAvatar(targetId, photoData);
      setSaving(false);
      if (photoResult.error) {
        setError(photoResult.error);
        return;
      }
    } else {
      setSaving(false);
    }

    if (onCancel) {
      onCancel();
    } else {
      router.push("/team");
      router.refresh();
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
              label="Duração da Consulta (min)"
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

          {/* Values & Convenios sub-grid */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 border-t border-border/40 pt-3">
            {/* Particular Prices */}
            <div className="lg:col-span-5 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
                Valores Particulares (R$)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Cartão"
                  name="price_particular_card"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={priceCard}
                  onChange={(e) => setPriceCard(e.target.value)}
                />
                <Input
                  label="PIX"
                  name="price_particular_pix"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={pricePix}
                  onChange={(e) => setPricePix(e.target.value)}
                />
                <Input
                  label="Dinheiro"
                  name="price_particular_cash"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={priceCash}
                  onChange={(e) => setPriceCash(e.target.value)}
                />
              </div>
            </div>

            {/* Insurance List */}
            <div className="lg:col-span-7 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
                Convênios Aceitos
              </span>
              <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
                {convenios.length === 0 && (
                  <span className="text-xs text-text-muted">Nenhum convênio cadastrado.</span>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {convenios.map((insurance) => {
                    const checked = insurance.id in insuranceValues;
                    return (
                      <div key={insurance.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card-elevated/40 p-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleInsurance(insurance.id)}
                            className="h-3.5 w-3.5 rounded border-border bg-card accent-primary"
                          />
                          <span className="truncate">{insurance.name}</span>
                        </label>
                        {checked && (
                          <div className="flex items-center gap-1.5 pl-5">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="R$ Valor"
                              value={insuranceValues[insurance.id]}
                              onChange={(e) =>
                                setInsuranceValues((prev) => ({ ...prev, [insurance.id]: e.target.value }))
                              }
                              className="h-7 w-20 rounded-md border border-border bg-card px-2 text-xs text-text-primary"
                            />
                            <input
                              type="number"
                              min={5}
                              step={5}
                              placeholder="Min"
                              value={insuranceDurations[insurance.id] ?? ""}
                              onChange={(e) =>
                                setInsuranceDurations((prev) => ({ ...prev, [insurance.id]: e.target.value }))
                              }
                              className="h-7 w-14 rounded-md border border-border bg-card px-2 text-xs text-text-primary"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
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

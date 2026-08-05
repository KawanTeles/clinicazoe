"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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

    router.push("/team");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      )}

      {/* Grid 1: Informações da Conta e Acesso */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Foto e Perfil (4 colunas no LG) */}
        <Card className="lg:col-span-4 flex flex-col justify-between">
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              Foto de Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-4">
            <Avatar src={preview} name={fullName || "Novo membro"} size={96} />
            <div className="flex flex-col items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                {mode === "create" ? "Escolher foto" : "Alterar foto"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <span className="text-[11px] text-text-muted">Formatos JPG, PNG ou WEBP (até 3MB)</span>
            </div>
          </CardContent>
        </Card>

        {/* Dados da Conta (8 colunas no LG) */}
        <Card className="lg:col-span-8">
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              Informações Pessoais & Acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex flex-col gap-4">
            <Input
              label="Nome Completo *"
              name="full_name"
              required
              placeholder="Ex: Dra. Ana Clara Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                label="Telefone"
                name="phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

              {mode === "edit" && (
                <Select
                  label="Status"
                  name="status"
                  value={status}
                  disabled={lockedBySelf}
                  onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </Select>
              )}

              <Input
                label={mode === "create" ? "Senha *" : "Nova Senha"}
                name="password"
                type="password"
                required={mode === "create"}
                placeholder={mode === "edit" ? "Manter senha atual" : "••••••••"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {lockedBySelf && (
              <span className="text-xs text-text-muted">Nota: Você não pode alterar seu próprio cargo ou status.</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grid 2: Dados Profissionais se cargo == profissional */}
      {role === "profissional" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card: Configuração de Atendimento */}
          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                Configurações da Agenda & Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Especialidade Principal"
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
                  label="Registro Profissional"
                  name="license_number"
                  placeholder="CRM, CRO, CREFITO..."
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Duração da Consulta (min)"
                  name="consultation_duration_minutes"
                  type="number"
                  min={5}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-text-secondary">Cor na Agenda</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={agendaColor}
                      onChange={(e) => setAgendaColor(e.target.value)}
                      className="h-11 w-16 cursor-pointer rounded-xl border border-border bg-card-elevated p-1"
                    />
                    <span className="text-xs font-mono text-text-muted uppercase">{agendaColor}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-text-secondary" htmlFor="bio">
                  Biografia / Apresentação Profissional
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={3}
                  placeholder="Breve resumo sobre especialização, experiência e atendimento..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card: Tabela de Preços & Convênios */}
          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                Valores de Consulta & Convênios
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col gap-4">
              <div>
                <span className="mb-2 block text-xs font-bold text-text-primary">Consultas Particulares (R$)</span>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Cartão"
                    name="price_particular_card"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={priceCard}
                    onChange={(e) => setPriceCard(e.target.value)}
                  />
                  <Input
                    label="PIX"
                    name="price_particular_pix"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={pricePix}
                    onChange={(e) => setPricePix(e.target.value)}
                  />
                  <Input
                    label="Dinheiro"
                    name="price_particular_cash"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={priceCash}
                    onChange={(e) => setPriceCash(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-bold text-text-primary">Convênios Aceitos</span>
                <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {convenios.length === 0 && (
                    <span className="text-xs text-text-muted">Nenhum convênio cadastrado.</span>
                  )}
                  {convenios.map((insurance) => {
                    const checked = insurance.id in insuranceValues;
                    return (
                      <div key={insurance.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card-elevated/40 p-2.5">
                        <label className="flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleInsurance(insurance.id)}
                            className="h-4 w-4 rounded border-border bg-card accent-primary"
                          />
                          <span className="truncate">{insurance.name}</span>
                        </label>
                        {checked && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Valor (R$)"
                              value={insuranceValues[insurance.id]}
                              onChange={(e) =>
                                setInsuranceValues((prev) => ({ ...prev, [insurance.id]: e.target.value }))
                              }
                              className="h-8 w-24 rounded-lg border border-border bg-card px-2 text-xs text-text-primary"
                            />
                            <input
                              type="number"
                              min={5}
                              step={5}
                              placeholder="Min."
                              value={insuranceDurations[insurance.id] ?? ""}
                              onChange={(e) =>
                                setInsuranceDurations((prev) => ({ ...prev, [insurance.id]: e.target.value }))
                              }
                              className="h-8 w-16 rounded-lg border border-border bg-card px-2 text-xs text-text-primary"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <Button type="button" variant="ghost" disabled={saving} onClick={() => router.push("/team")}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={saving} className="px-6 font-bold shadow-button">
          {mode === "create" ? "Criar Membro" : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}

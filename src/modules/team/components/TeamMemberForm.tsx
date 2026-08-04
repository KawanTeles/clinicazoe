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
    Object.fromEntries(values.insurances.map((i) => [i.insurance_id, i.value])),
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
  }

  function buildInsurancesPayload(): { insurance_id: string; value: number }[] {
    return Object.entries(insuranceValues).map(([insurance_id, value]) => ({
      insurance_id,
      value: Number(value.replace(",", ".")) || 0,
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
      ([, value]) => !value.trim() || Number(value.replace(",", ".")) <= 0,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar src={preview} name={fullName || "Novo membro"} size={64} />
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
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
        label="E-mail"
        name="email"
        type="email"
        required
        disabled={mode === "edit"}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Cargo"
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
      </div>

      {lockedBySelf && (
        <p className="text-xs text-text-secondary">
          Você não pode alterar seu próprio cargo ou status.
        </p>
      )}

      <Input
        label={mode === "create" ? "Senha" : "Nova senha (opcional)"}
        name="password"
        type="password"
        required={mode === "create"}
        placeholder={mode === "edit" ? "Deixe em branco para manter a atual" : undefined}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {role === "profissional" && (
        <div className="flex flex-col gap-5 rounded-2xl border border-[#255044] bg-[#17382D]/50 p-6">
          <p className="text-base font-bold text-[#F5F7F6]">Dados profissionais</p>
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
            label="Registro profissional"
            name="license_number"
            placeholder="CRM, CRO, CREFITO..."
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#C8D4CF]" htmlFor="bio">
              Descrição / Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-[#255044] bg-[#17382D] px-4 py-3 text-sm text-[#F5F7F6] placeholder:text-[#7A9187] transition-all focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30"
            />
          </div>

          <Input
            label="Duração da consulta (minutos)"
            name="consultation_duration_minutes"
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />

          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-[#F5F7F6]">
              Valores particular (deixe em branco se não atender por esse meio)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Cartão (R$)"
                name="price_particular_card"
                type="number"
                min={0}
                step="0.01"
                value={priceCard}
                onChange={(e) => setPriceCard(e.target.value)}
              />
              <Input
                label="PIX (R$)"
                name="price_particular_pix"
                type="number"
                min={0}
                step="0.01"
                value={pricePix}
                onChange={(e) => setPricePix(e.target.value)}
              />
              <Input
                label="Dinheiro (R$)"
                name="price_particular_cash"
                type="number"
                min={0}
                step="0.01"
                value={priceCash}
                onChange={(e) => setPriceCash(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-[#F5F7F6]">Convênios aceitos e valores</p>
            <div className="flex flex-col gap-3">
              {convenios.length === 0 && (
                <span className="text-xs text-[#7A9187]">Nenhum convênio ativo cadastrado.</span>
              )}
              {convenios.map((insurance) => {
                const checked = insurance.id in insuranceValues;
                return (
                  <div key={insurance.id} className="flex items-center gap-3">
                    <label className="flex w-44 items-center gap-2 text-sm font-medium text-[#F5F7F6] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleInsurance(insurance.id)}
                        className="h-4 w-4 rounded border-[#255044] bg-[#17382D] accent-[#2E8B57]"
                      />
                      {insurance.name}
                    </label>
                    {checked && (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Valor (R$)"
                        value={insuranceValues[insurance.id]}
                        onChange={(e) =>
                          setInsuranceValues((prev) => ({ ...prev, [insurance.id]: e.target.value }))
                        }
                        className="h-10 w-36 rounded-xl border border-[#255044] bg-[#17382D] px-3 text-sm text-[#F5F7F6] transition-all focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-[#C8D4CF]">Cor da agenda</label>
            <input
              type="color"
              value={agendaColor}
              onChange={(e) => setAgendaColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-xl border border-[#255044] bg-[#17382D] p-1"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm font-medium text-[#FF8A8A]">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" isLoading={saving}>
          Salvar
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => router.push("/team")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}


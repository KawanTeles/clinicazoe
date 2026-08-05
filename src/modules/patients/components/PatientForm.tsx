"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createPatient, updatePatient, type PatientDetailsInput } from "@/modules/patients/services/patient-actions";

interface Option {
  id: string;
  name: string;
}

interface PatientFormProps {
  mode: "create" | "edit";
  patientId?: string;
  insurances: Option[];
  professionals: Option[];
  onCancel?: () => void;
  initial?: {
    full_name: string;
    phone: string;
    details: PatientDetailsInput;
  };
}

const DEFAULTS = {
  full_name: "",
  phone: "",
  details: {} as PatientDetailsInput,
};

export function PatientForm({ mode, patientId, insurances, professionals, onCancel, initial }: PatientFormProps) {
  const router = useRouter();
  const values = initial ?? DEFAULTS;

  const [fullName, setFullName] = useState(values.full_name);
  const [phone, setPhone] = useState(values.phone);
  const [cpf, setCpf] = useState(values.details.cpf ?? "");
  const [birthDate, setBirthDate] = useState(values.details.birth_date ?? "");
  const [email, setEmail] = useState(values.details.email ?? "");
  const [whatsapp, setWhatsapp] = useState(values.details.whatsapp ?? "");
  const [address, setAddress] = useState(values.details.address ?? "");
  const [city, setCity] = useState(values.details.city ?? "");
  const [insuranceId, setInsuranceId] = useState(values.details.preferred_insurance_id ?? "");
  const [cardNumber, setCardNumber] = useState(values.details.insurance_card_number ?? "");
  const [cardValidUntil, setCardValidUntil] = useState(values.details.insurance_card_valid_until ?? "");
  const [notes, setNotes] = useState(values.details.notes ?? "");
  const [professionalId, setProfessionalId] = useState(values.details.preferred_professional_id ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildDetails(): PatientDetailsInput {
    return {
      cpf: cpf || undefined,
      birth_date: birthDate || undefined,
      email: email || undefined,
      whatsapp: whatsapp || undefined,
      address: address || undefined,
      city: city || undefined,
      preferred_insurance_id: insuranceId || undefined,
      insurance_card_number: cardNumber || undefined,
      insurance_card_valid_until: cardValidUntil || undefined,
      notes: notes || undefined,
      preferred_professional_id: professionalId || undefined,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Informe o nome completo do paciente.");
      return;
    }

    setSaving(true);

    const result =
      mode === "create"
        ? await createPatient({ full_name: fullName, phone, details: buildDetails() })
        : await updatePatient({ id: patientId!, full_name: fullName, phone, details: buildDetails() });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (onCancel) {
      onCancel();
    } else {
      router.push("/patients");
      router.refresh();
    }
  }

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/patients");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </div>
      )}

      {/* GROUP 1: DADOS PESSOAIS & CONTATO */}
      <div className="rounded-xl border border-border/80 bg-card p-3.5 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
            1. Dados Pessoais & Contato
          </span>
          <span className="text-[10px] font-medium text-text-muted">Identificação e comunicação</span>
        </div>

        {/* 3-Column Field Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Nome Completo *"
            name="full_name"
            required
            placeholder="Ex: Maria Silva Santos"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="CPF"
            name="cpf"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
          />
          <Input
            label="Data de Nascimento"
            name="birth_date"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <Input
            label="Telefone Principal"
            name="phone"
            type="tel"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="WhatsApp"
            name="whatsapp"
            type="tel"
            placeholder="(00) 00000-0000"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
          <Input
            label="E-mail"
            name="email"
            type="email"
            placeholder="paciente@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 border-t border-border/40 pt-2.5">
          <Input label="Endereço" name="address" placeholder="Rua / Av..." value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input label="Cidade" name="city" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>

      {/* GROUP 2: CONVÊNIO & OBSERVAÇÕES */}
      <div className="rounded-xl border border-border/80 bg-card p-3.5 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
            2. Convênio & Observações Internas
          </span>
          <span className="text-[10px] font-medium text-text-muted">Plano de saúde e preferências</span>
        </div>

        {/* 3-Column Field Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Convênio Atrelado" name="insurance_id" value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)}>
            <option value="">Particular / Nenhum</option>
            {insurances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
          <Input
            label="Nº da Carteirinha"
            name="insurance_card_number"
            placeholder="000000000"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
          />
          <Input
            label="Validade da Carteirinha"
            name="insurance_card_valid_until"
            type="date"
            value={cardValidUntil}
            onChange={(e) => setCardValidUntil(e.target.value)}
          />
          <Select
            label="Profissional Preferencial"
            name="preferred_professional_id"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">Sem preferência</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary" htmlFor="notes">
              Observações / Histórico Clínico
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Alergias, observações relevantes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-border bg-card-elevated px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Footer */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2.5 rounded-xl border border-border bg-card/95 backdrop-blur-md p-3 shadow-lg">
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={handleCancelClick}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" isLoading={saving} className="px-5 font-bold shadow-button">
          {mode === "create" ? "Cadastrar Paciente" : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}

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

export function PatientForm({ mode, patientId, insurances, professionals, initial }: PatientFormProps) {
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
      setError("Informe o nome completo.");
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

    router.push("/patients");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nome completo"
        name="full_name"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="CPF (opcional)" name="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        <Input
          label="Data de nascimento"
          name="birth_date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Telefone"
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
      </div>

      <Input
        label="E-mail (opcional)"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Endereço" name="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label="Cidade" name="city" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card-elevated/60 p-6">
        <p className="text-base font-bold text-text-primary">Convênio</p>
        <Select label="Convênio" name="insurance_id" value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)}>
          <option value="">Nenhum / Particular</option>
          {insurances.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Número da carteirinha"
            name="insurance_card_number"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
          />
          <Input
            label="Validade da carteirinha (opcional)"
            name="insurance_card_valid_until"
            type="date"
            value={cardValidUntil}
            onChange={(e) => setCardValidUntil(e.target.value)}
          />
        </div>
      </div>

      <Select
        label="Profissional de preferência (opcional)"
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

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary" htmlFor="notes">
          Observações
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border border-border bg-card-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" isLoading={saving}>
          Salvar
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={() => router.push("/patients")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

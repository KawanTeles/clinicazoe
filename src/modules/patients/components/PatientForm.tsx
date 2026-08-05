"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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

    router.push("/patients");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      )}

      {/* Grid Section 1: Dados Pessoais & Contato */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card: Dados Pessoais */}
        <Card>
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex flex-col gap-4">
            <Input
              label="Nome Completo *"
              name="full_name"
              required
              placeholder="Ex: Maria Silva Santos"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
          </CardContent>
        </Card>

        {/* Card: Contato & Endereço */}
        <Card>
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              Contato & Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex flex-col gap-4">
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
              label="E-mail"
              name="email"
              type="email"
              placeholder="paciente@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Endereço" name="address" placeholder="Rua / Av..." value={address} onChange={(e) => setAddress(e.target.value)} />
              <Input label="Cidade" name="city" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid Section 2: Convênio & Observações */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card: Convênio e Preferência */}
        <Card>
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              Convênio & Preferência
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex flex-col gap-4">
            <Select label="Convênio Atrelado" name="insurance_id" value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)}>
              <option value="">Particular / Nenhum</option>
              {insurances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
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
          </CardContent>
        </Card>

        {/* Card: Observações Adicionais */}
        <Card>
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
              Observações Médicas / Internas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex flex-col gap-4 justify-between">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-secondary" htmlFor="notes">
                Notas do Paciente
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={5}
                placeholder="Alergias, histórico clínico ou notas relevantes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border bg-card-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <Button type="button" variant="ghost" disabled={saving} onClick={() => router.push("/patients")}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={saving} className="px-6 font-bold shadow-button">
          {mode === "create" ? "Cadastrar Paciente" : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}

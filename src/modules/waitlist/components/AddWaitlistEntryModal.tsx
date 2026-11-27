"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils/cn";
import { insuranceRequiresModality } from "@/lib/constants";
import { createWaitlistEntryForStaff } from "@/modules/waitlist/services/waitlist-actions";
import { PatientPickerField } from "@/modules/patients/components/PatientPickerField";
import type { PatientSearchResult } from "@/modules/patients/services/patient-actions";
import type { Modality, WaitlistPeriod } from "@/lib/supabase/types";

interface Option {
  id: string;
  name: string;
}

interface AddWaitlistEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  specialties: Option[];
  professionals: Option[];
  insurances: Option[];
}

const PERIODS: { value: WaitlistPeriod; label: string }[] = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
];

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

function ChoiceChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full text-xs font-semibold border transition-all",
        active
          ? "border-primary bg-[var(--badge-bg)] text-[var(--primary)]"
          : "border-border text-text-secondary hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

/** "Adicionar à Lista de Espera" pela Equipe — única forma de criar uma
 * entrada depois que o portal do paciente (self-service) foi removido.
 * Mesmos campos de WaitlistEntryModal, só troca o nome/telefone/e-mail
 * digitados por um paciente já cadastrado (PatientPickerField). */
export function AddWaitlistEntryModal({
  isOpen,
  onClose,
  onAdded,
  specialties,
  professionals,
  insurances,
}: AddWaitlistEntryModalProps) {
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [specialtyId, setSpecialtyId] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [modality, setModality] = useState<Modality | "">("");
  const [period, setPeriod] = useState<WaitlistPeriod | "">("");
  const [days, setDays] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insuranceName = insurances.find((i) => i.id === insuranceId)?.name ?? "";
  const requiresModality = insuranceRequiresModality(insuranceName);

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function reset() {
    setPatient(null);
    setSpecialtyId("");
    setInsuranceId("");
    setProfessionalId("");
    setModality("");
    setPeriod("");
    setDays([]);
    setNotes("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient) {
      setError("Escolha o paciente.");
      return;
    }
    if (!specialtyId || !insuranceId) {
      setError("Escolha a especialidade e o convênio.");
      return;
    }
    if (!patient.phone && !patient.whatsapp) {
      setError("Esse paciente não tem telefone cadastrado — atualize o cadastro antes de continuar.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createWaitlistEntryForStaff({
      patientId: patient.id,
      patientName: patient.fullName,
      patientPhone: (patient.whatsapp || patient.phone)!,
      patientEmail: patient.email ?? undefined,
      specialtyId,
      professionalId: professionalId || undefined,
      insuranceId,
      modality: modality || undefined,
      periodPreference: period || undefined,
      preferredDays: days,
      notes: notes || undefined,
    });

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    reset();
    onAdded();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Adicionar à Lista de Espera" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs font-medium text-danger">
            {error}
          </div>
        )}

        <PatientPickerField
          onSelect={setPatient}
          onClear={() => setPatient(null)}
          selectedName={patient?.fullName}
          selectedPhone={patient?.whatsapp || patient?.phone}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Especialidade *" value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)} required>
            <option value="">Selecione</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select label="Convênio *" value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)} required>
            <option value="">Selecione</option>
            {insurances.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </Select>
          <Select label="Profissional desejado (opcional)" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Sem preferência</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          {requiresModality && (
            <Select label="Modalidade" value={modality} onChange={(e) => setModality(e.target.value as Modality)}>
              <option value="">Selecione</option>
              <option value="aba">ABA</option>
              <option value="comum">Comum</option>
            </Select>
          )}
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Período de preferência</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <ChoiceChip key={p.value} active={period === p.value} onClick={() => setPeriod(p.value)}>
                {p.label}
              </ChoiceChip>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Disponibilidade</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <ChoiceChip key={d.value} active={days.includes(d.value)} onClick={() => toggleDay(d.value)}>
                {d.label}
              </ChoiceChip>
            ))}
          </div>
        </div>

        <Textarea
          label="Observações (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Alguma informação adicional que possa ajudar..."
        />

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={submitting} className="font-bold">
            Adicionar à lista
          </Button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { EvolutionContentInput } from "@/modules/evolutions/services/evolution-actions";

interface EvolutionFormProps {
  initial?: Partial<EvolutionContentInput>;
  submitLabel: string;
  onSubmit: (input: EvolutionContentInput) => Promise<{ error: string | null }>;
  onCancel: () => void;
  onSaved: () => void;
}

const FIELDS: {
  key: keyof EvolutionContentInput;
  label: string;
  hint: string;
  required?: boolean;
  rows?: number;
}[] = [
  { key: "session_summary", label: "Resumo da Sessão", hint: "Descrição geral do atendimento." },
  {
    key: "clinical_evolution",
    label: "Evolução Clínica",
    hint: "Texto livre para registrar a evolução do paciente.",
    required: true,
    rows: 6,
  },
  { key: "objectives", label: "Objetivos Trabalhados", hint: "" },
  { key: "interventions", label: "Intervenções Realizadas", hint: "" },
  { key: "patient_response", label: "Resposta do Paciente", hint: "" },
  { key: "home_guidance", label: "Orientações para Casa", hint: "" },
  { key: "observations", label: "Observações", hint: "" },
];

export function EvolutionForm({ initial, submitLabel, onSubmit, onCancel, onSaved }: EvolutionFormProps) {
  const [values, setValues] = useState<EvolutionContentInput>({
    session_summary: initial?.session_summary ?? "",
    clinical_evolution: initial?.clinical_evolution ?? "",
    objectives: initial?.objectives ?? "",
    interventions: initial?.interventions ?? "",
    patient_response: initial?.patient_response ?? "",
    home_guidance: initial?.home_guidance ?? "",
    observations: initial?.observations ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.clinical_evolution.trim()) {
      setError("Descreva a evolução clínica do paciente.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSubmit(values);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {FIELDS.map((field) => (
        <Textarea
          key={field.key}
          label={field.required ? `${field.label} *` : field.label}
          placeholder={field.hint || undefined}
          rows={field.rows ?? 3}
          value={values[field.key] ?? ""}
          onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
        />
      ))}
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

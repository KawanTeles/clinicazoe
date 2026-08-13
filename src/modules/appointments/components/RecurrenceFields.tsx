"use client";

import { Input } from "@/components/ui/Input";
import { WEEKDAY_LABELS } from "@/modules/appointments/services/recurrence-generator";
import type { RecurrenceFrequency } from "@/lib/supabase/types";

export interface RecurrenceValue {
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string;
  maxOccurrences: string;
  notes: string;
}

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: "weekly", label: "Semanalmente" },
  { value: "biweekly", label: "Quinzenalmente" },
  { value: "monthly", label: "Mensalmente" },
];

export function RecurrenceFields({
  value,
  onChange,
  lockStartDate = false,
}: {
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
  /** Trava a data de início (usada quando ela já é definida pela consulta de
   * origem, ex.: transformar uma consulta avulsa existente em recorrente —
   * não faz sentido a recepção escolher outra data de início nesse caso). */
  lockStartDate?: boolean;
}) {
  const weekdayLabel = value.startDate
    ? WEEKDAY_LABELS[new Date(`${value.startDate}T00:00:00`).getDay()]
    : null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card-elevated/60 p-6">
      <p className="text-base font-bold text-text-primary">Repetir</p>

      <div className="flex flex-wrap gap-3">
        {FREQUENCY_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-text-primary has-[:checked]:border-primary has-[:checked]:bg-primary/10"
          >
            <input
              type="radio"
              name="frequency"
              value={option.value}
              checked={value.frequency === option.value}
              onChange={() => onChange({ ...value, frequency: option.value })}
              className="h-4 w-4 accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>

      <Input
        label="Data de início"
        type="date"
        value={value.startDate}
        disabled={lockStartDate}
        onChange={(e) => onChange({ ...value, startDate: e.target.value })}
      />
      {lockStartDate && (
        <p className="-mt-2.5 text-xs text-text-secondary">A data deste atendimento define o dia da semana da recorrência.</p>
      )}

      {weekdayLabel && (
        <p className="text-sm text-text-secondary">
          Repete toda <span className="font-semibold text-text-primary">{weekdayLabel}</span>.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Data final (opcional)"
          type="date"
          value={value.endDate}
          onChange={(e) => onChange({ ...value, endDate: e.target.value })}
        />
        <Input
          label="Quantidade máxima de repetições (opcional)"
          type="number"
          min={1}
          value={value.maxOccurrences}
          onChange={(e) => onChange({ ...value, maxOccurrences: e.target.value })}
        />
      </div>

      {!value.endDate && !value.maxOccurrences && (
        <p className="text-xs text-text-secondary">
          Sem data final: geramos até 12 meses de atendimentos de uma vez. Depois disso, é possível gerar mais
          ocorrências a partir da tela da recorrência.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary" htmlFor="recurrence_notes">
          Observações (opcional)
        </label>
        <textarea
          id="recurrence_notes"
          rows={2}
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
    </div>
  );
}

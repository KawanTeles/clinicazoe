"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConflictsReview } from "@/modules/appointments/components/ConflictsReview";
import { RecurrenceFields, type RecurrenceValue } from "@/modules/appointments/components/RecurrenceFields";
import {
  attachRecurrenceToAppointment,
  previewAttachRecurrence,
  type OccurrencePreview,
} from "@/modules/appointments/services/recurrence-actions";

interface AttachRecurrenceDialogProps {
  appointmentId: string;
  date: string;
  professionalId: string;
  insuranceId: string;
  onClose: () => void;
  onDone: (createdCount: number) => void;
}

export function AttachRecurrenceDialog({
  appointmentId,
  date,
  professionalId,
  insuranceId,
  onClose,
  onDone,
}: AttachRecurrenceDialogProps) {
  const [recurrence, setRecurrence] = useState<RecurrenceValue>({
    frequency: "weekly",
    startDate: date,
    endDate: "",
    maxOccurrences: "",
    notes: "",
  });
  const [occurrences, setOccurrences] = useState<OccurrencePreview[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildInput() {
    return {
      frequency: recurrence.frequency,
      startDate: date,
      endDate: recurrence.endDate || null,
      maxOccurrences: recurrence.maxOccurrences ? Number(recurrence.maxOccurrences) : null,
    };
  }

  async function handleConfirmCreate(skipDates: string[], overrides: Record<string, string>) {
    setSaving(true);
    setError(null);
    const result = await attachRecurrenceToAppointment(appointmentId, {
      ...buildInput(),
      notes: recurrence.notes || undefined,
      skipDates,
      overrides,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      setOccurrences(null);
      return;
    }
    onDone(result.createdCount ?? 1);
  }

  async function handleReview() {
    setSaving(true);
    setError(null);
    const result = await previewAttachRecurrence(appointmentId, buildInput());
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (!result.occurrences || result.occurrences.length === 0) {
      // Nenhuma data futura gerada (ex.: qtd. máxima = 1) — nada a revisar,
      // só cria a série com a própria consulta como única ocorrência.
      await handleConfirmCreate([], {});
      return;
    }
    setOccurrences(result.occurrences);
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-fade-up"
      >
        {occurrences ? (
          <ConflictsReview
            occurrences={occurrences}
            professionalId={professionalId}
            insuranceId={insuranceId}
            confirming={saving}
            onConfirm={handleConfirmCreate}
            onCancel={() => setOccurrences(null)}
          />
        ) : (
          <>
            <h2 className="text-lg font-bold text-text-primary">Tornar esta consulta recorrente</h2>
            <p className="text-xs text-text-secondary">
              A consulta atual vira a primeira ocorrência da recorrência — mesmo paciente, profissional, convênio,
              valor e duração se repetem automaticamente.
            </p>

            <RecurrenceFields value={recurrence} onChange={setRecurrence} lockStartDate />

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" disabled={saving} onClick={onClose}>
                Cancelar
              </Button>
              <Button size="sm" isLoading={saving} onClick={handleReview}>
                Revisar e confirmar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

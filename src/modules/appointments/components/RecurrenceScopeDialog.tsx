"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ConflictsReview } from "@/modules/appointments/components/ConflictsReview";
import {
  cancelRecurringAppointment,
  previewRecurrenceUpdate,
  updateRecurringAppointment,
  type OccurrencePreview,
  type RecurrenceScope,
} from "@/modules/appointments/services/recurrence-actions";

interface RecurrenceScopeDialogProps {
  mode: "edit" | "delete";
  appointmentId: string;
  currentDate: string;
  currentStartTime: string;
  professionalId: string;
  insuranceId: string;
  onClose: () => void;
  onDone: (whatsappLink?: string | null) => void;
}

const SCOPE_OPTIONS: { value: RecurrenceScope; label: string; description: string }[] = [
  { value: "only", label: "Apenas esta consulta", description: "Só essa ocorrência muda; o resto da recorrência continua igual." },
  { value: "following", label: "Esta consulta e todas as próximas", description: "As consultas já realizadas ficam como estão." },
  { value: "all", label: "Toda a sequência de consultas", description: "Todas as ocorrências futuras da recorrência mudam." },
];

export function RecurrenceScopeDialog({
  mode,
  appointmentId,
  currentDate,
  currentStartTime,
  professionalId,
  insuranceId,
  onClose,
  onDone,
}: RecurrenceScopeDialogProps) {
  const toast = useToast();
  const [scope, setScope] = useState<RecurrenceScope>("only");
  const [date, setDate] = useState(currentDate);
  const [startTime, setStartTime] = useState(currentStartTime.slice(0, 5));
  const [reason, setReason] = useState("");
  const [occurrences, setOccurrences] = useState<OccurrencePreview[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSaving(true);
    setError(null);
    const result = await cancelRecurringAppointment(appointmentId, scope);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone();
  }

  async function handleEditOnly() {
    setSaving(true);
    setError(null);
    const result = await updateRecurringAppointment({
      appointmentId,
      scope: "only",
      date,
      startTime,
      reason: reason || undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone(result.whatsappLink);
  }

  async function handlePreviewBulk() {
    setSaving(true);
    setError(null);
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
    const result = await previewRecurrenceUpdate({
      appointmentId,
      scope: scope as "following" | "all",
      dayOfWeek,
      startTime,
    });
    setSaving(false);
    if (result.error || !result.occurrences) {
      setError(result.error ?? "Não foi possível validar as novas datas.");
      return;
    }
    setOccurrences(result.occurrences);
  }

  async function handleConfirmBulk(skipDates: string[], overrides: Record<string, string>) {
    setSaving(true);
    setError(null);
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
    const result = await updateRecurringAppointment({
      appointmentId,
      scope,
      dayOfWeek,
      startTime,
      skipDates,
      overrides,
      reason: reason || undefined,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onDone(result.whatsappLink);
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
            onConfirm={handleConfirmBulk}
            onCancel={() => setOccurrences(null)}
          />
        ) : (
          <>
            <h2 className="text-lg font-bold text-text-primary">
              {mode === "edit" ? "O que deseja alterar?" : "O que deseja excluir?"}
            </h2>

            <div className="flex flex-col gap-2">
              {SCOPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card-elevated/50 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                >
                  <input
                    type="radio"
                    name="scope"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">{option.label}</span>
                    <span className="block text-xs text-text-secondary">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {mode === "edit" && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label={scope === "only" ? "Nova data" : "A partir de (define o novo dia da semana)"}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  <Input
                    label="Novo horário"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <Input
                  label="Motivo (opcional)"
                  placeholder="Ex.: feriado, troca de agenda..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </>
            )}

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" disabled={saving} onClick={onClose}>
                Cancelar
              </Button>
              {mode === "delete" ? (
                <Button variant="danger" size="sm" isLoading={saving} onClick={handleDelete}>
                  Excluir
                </Button>
              ) : (
                <Button
                  size="sm"
                  isLoading={saving}
                  onClick={scope === "only" ? handleEditOnly : handlePreviewBulk}
                >
                  {scope === "only" ? "Salvar" : "Revisar alterações"}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

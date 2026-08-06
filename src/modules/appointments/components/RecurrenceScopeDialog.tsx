"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ConflictsReview } from "@/modules/appointments/components/ConflictsReview";
import { RecurrenceFields, type RecurrenceValue } from "@/modules/appointments/components/RecurrenceFields";
import {
  getSeriesDetail,
  getSeriesHistory,
  type SeriesDetail,
  type SeriesHistoryEntry,
} from "@/modules/appointments/services/recurrence-queries";
import type { RecurrenceFrequency } from "@/lib/supabase/types";
import {
  cancelRecurringAppointment,
  deleteRecurringAppointment,
  previewRecurrenceUpdate,
  updateRecurringAppointment,
  type OccurrencePreview,
  type RecurrenceScope,
} from "@/modules/appointments/services/recurrence-actions";

interface RecurrenceScopeDialogProps {
  mode: "edit" | "delete";
  appointmentId: string;
  seriesId: string;
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

const EMPTY_RECURRENCE: RecurrenceValue = { frequency: "weekly", startDate: "", endDate: "", maxOccurrences: "", notes: "" };
const HISTORY_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function RecurrenceScopeDialog({
  mode,
  appointmentId,
  seriesId,
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

  // Escopos following/all: edição completa (frequência, datas, qtd), reaproveitando
  // o mesmo formulário da criação. Só o que o usuário realmente alterar é enviado.
  const [originalSeries, setOriginalSeries] = useState<SeriesDetail | null>(null);
  const [recurrence, setRecurrence] = useState<RecurrenceValue>({ ...EMPTY_RECURRENCE, startDate: currentDate });
  const [bulkStartTime, setBulkStartTime] = useState(currentStartTime.slice(0, 5));
  const [stopRecurrence, setStopRecurrence] = useState(false);

  const [history, setHistory] = useState<SeriesHistoryEntry[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (mode !== "edit") return;
    getSeriesDetail(seriesId).then((series) => {
      if (!series) return;
      setOriginalSeries(series);
      setRecurrence({
        frequency: series.frequency as RecurrenceFrequency,
        startDate: currentDate,
        endDate: series.endDate ?? "",
        maxOccurrences: series.maxOccurrences ? String(series.maxOccurrences) : "",
        notes: "",
      });
    });
    getSeriesHistory(seriesId).then(setHistory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, seriesId]);

  async function handleDelete() {
    setSaving(true);
    setError(null);
    const result = await deleteRecurringAppointment(appointmentId, scope);
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

  async function handleStopRecurrence() {
    setSaving(true);
    setError(null);
    const result = await cancelRecurringAppointment(appointmentId, scope as "following" | "all");
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("A repetição foi interrompida a partir daqui.");
    onDone();
  }

  function buildBulkInput() {
    const dayOfWeek = new Date(`${recurrence.startDate}T00:00:00`).getDay();
    const frequency = originalSeries && recurrence.frequency !== originalSeries.frequency ? recurrence.frequency : undefined;
    const startDate = recurrence.startDate !== currentDate ? recurrence.startDate : undefined;
    const originalEndDateStr = originalSeries?.endDate ?? "";
    const endDate = recurrence.endDate !== originalEndDateStr ? recurrence.endDate || null : undefined;
    const originalMaxStr = originalSeries?.maxOccurrences ? String(originalSeries.maxOccurrences) : "";
    const maxOccurrences =
      recurrence.maxOccurrences !== originalMaxStr ? (recurrence.maxOccurrences ? Number(recurrence.maxOccurrences) : null) : undefined;
    return { dayOfWeek, frequency, startDate, endDate, maxOccurrences };
  }

  async function handlePreviewBulk() {
    setSaving(true);
    setError(null);
    const { dayOfWeek, frequency, startDate, endDate, maxOccurrences } = buildBulkInput();
    const result = await previewRecurrenceUpdate({
      appointmentId,
      scope: scope as "following" | "all",
      dayOfWeek,
      startTime: bulkStartTime,
      frequency,
      startDate,
      endDate,
      maxOccurrences,
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
    const { dayOfWeek, frequency, startDate, endDate, maxOccurrences } = buildBulkInput();
    const result = await updateRecurringAppointment({
      appointmentId,
      scope,
      dayOfWeek,
      startTime: bulkStartTime,
      skipDates,
      overrides,
      reason: reason || undefined,
      frequency,
      startDate,
      endDate,
      maxOccurrences,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onDone(result.whatsappLink);
  }

  const isBulkScope = scope === "following" || scope === "all";

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
            modality={originalSeries?.modality ?? undefined}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {mode === "delete" && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </span>
                )}
                <h2 className="text-lg font-bold text-text-primary">
                  {mode === "edit" ? "O que deseja alterar?" : "O que deseja excluir?"}
                </h2>
              </div>
              {history && history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {showHistory ? "Ocultar histórico" : `Ver histórico (${history.length})`}
                </button>
              )}
            </div>

            {showHistory && history && (
              <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-card-elevated/40 p-3">
                {history.map((entry) => (
                  <div key={entry.id} className="border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <p className="text-xs text-text-primary">{entry.summary}</p>
                    <p className="text-[10px] text-text-muted">
                      {entry.actorName} — {HISTORY_DATE_FORMATTER.format(new Date(entry.date))}
                    </p>
                  </div>
                ))}
              </div>
            )}

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
                    onChange={() => {
                      setScope(option.value);
                      setStopRecurrence(false);
                    }}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">{option.label}</span>
                    <span className="block text-xs text-text-secondary">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {mode === "edit" && scope === "only" && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Nova data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  <Input label="Novo horário" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <Input
                  label="Motivo (opcional)"
                  placeholder="Ex.: feriado, troca de agenda..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </>
            )}

            {mode === "edit" && isBulkScope && (
              <>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-text-primary">
                  <input
                    type="checkbox"
                    checked={stopRecurrence}
                    onChange={(e) => setStopRecurrence(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-primary"
                  />
                  Parar a repetição a partir daqui (virar consulta única)
                </label>

                {!stopRecurrence && (
                  <>
                    <Input
                      label="Novo horário"
                      type="time"
                      value={bulkStartTime}
                      onChange={(e) => setBulkStartTime(e.target.value)}
                    />
                    <RecurrenceFields value={recurrence} onChange={setRecurrence} />
                    <Input
                      label="Motivo (opcional)"
                      placeholder="Ex.: feriado, troca de agenda..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </>
                )}
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
              ) : scope === "only" ? (
                <Button size="sm" isLoading={saving} onClick={handleEditOnly}>
                  Salvar
                </Button>
              ) : stopRecurrence ? (
                <Button variant="danger" size="sm" isLoading={saving} onClick={handleStopRecurrence}>
                  Parar repetição
                </Button>
              ) : (
                <Button size="sm" isLoading={saving} onClick={handlePreviewBulk}>
                  Revisar alterações
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

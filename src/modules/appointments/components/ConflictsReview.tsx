"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getAvailableTimes } from "@/modules/appointments/services/booking-queries";
import type { OccurrencePreview } from "@/modules/appointments/services/recurrence-actions";
import type { Modality } from "@/lib/supabase/types";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

interface TimeOption {
  slotId: string;
  startTime: string;
  endTime: string;
}

interface ConflictsReviewProps {
  occurrences: OccurrencePreview[];
  professionalId: string;
  insuranceId: string;
  confirming: boolean;
  onConfirm: (skipDates: string[], overrides: Record<string, string>) => void;
  onCancel: () => void;
  modality?: Modality;
}

export function ConflictsReview({
  occurrences,
  professionalId,
  insuranceId,
  confirming,
  onConfirm,
  onCancel,
  modality,
}: ConflictsReviewProps) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [alternatives, setAlternatives] = useState<Record<string, TimeOption[]>>({});
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [loadingDate, setLoadingDate] = useState<string | null>(null);

  const available = occurrences.filter((o) => o.available);
  const conflicting = occurrences.filter((o) => !o.available);
  const resolvedCount = available.length + Object.keys(overrides).length;
  const ignoredCount = conflicting.length - Object.keys(overrides).length;

  async function handleChooseAnother(date: string) {
    if (expandedDate === date) {
      setExpandedDate(null);
      return;
    }
    setExpandedDate(date);
    if (!alternatives[date]) {
      setLoadingDate(date);
      const times = await getAvailableTimes(professionalId, insuranceId, date, modality);
      setAlternatives((prev) => ({ ...prev, [date]: times }));
      setLoadingDate(null);
    }
  }

  function selectAlternative(date: string, startTime: string) {
    setOverrides((prev) => ({ ...prev, [date]: startTime }));
    setExpandedDate(null);
  }

  function clearOverride(date: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  }

  function handleConfirm() {
    const skipDates = conflicting.filter((o) => !overrides[o.date]).map((o) => o.date);
    onConfirm(skipDates, overrides);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
      <div>
        <p className="text-base font-bold text-text-primary">
          {resolvedCount} atendimento(s) serão criados
          {ignoredCount > 0 ? ` — ${ignoredCount} data(s) com conflito serão ignoradas` : ""}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Para uma data em conflito, escolha outro horário ou deixe que ela seja ignorada.
        </p>
      </div>

      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {occurrences.map((occ) => {
          const override = overrides[occ.date];
          const isExpanded = expandedDate === occ.date;

          return (
            <div key={occ.date} className="rounded-xl border border-border">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm font-medium text-text-primary">
                  {dateFormatter.format(new Date(`${occ.date}T00:00:00`))}
                </span>

                <div className="flex items-center gap-2">
                  {occ.available && <Badge tone="success">Disponível</Badge>}

                  {!occ.available && override && (
                    <>
                      <Badge tone="success">Novo horário: {override}</Badge>
                      <Button size="sm" variant="secondary" type="button" onClick={() => clearOverride(occ.date)}>
                        Desfazer
                      </Button>
                    </>
                  )}

                  {!occ.available && !override && (
                    <>
                      <Badge tone="danger">{occ.reason ?? "Conflito"}</Badge>
                      <Button size="sm" variant="secondary" type="button" onClick={() => handleChooseAnother(occ.date)}>
                        Escolher outro horário
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                  {loadingDate === occ.date && <p className="text-xs text-text-secondary">Carregando horários...</p>}
                  {loadingDate !== occ.date && (alternatives[occ.date]?.length ?? 0) === 0 && (
                    <p className="text-xs text-text-secondary">Nenhum outro horário livre nessa data.</p>
                  )}
                  {loadingDate !== occ.date &&
                    alternatives[occ.date]?.map((time) => (
                      <button
                        key={`${time.slotId}-${time.startTime}`}
                        type="button"
                        onClick={() => selectAlternative(occ.date, time.startTime)}
                        className="rounded-lg border border-border bg-card-elevated px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-primary/50"
                      >
                        {time.startTime}
                      </button>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button type="button" isLoading={confirming} disabled={resolvedCount === 0} onClick={handleConfirm}>
          Confirmar
        </Button>
        <Button type="button" variant="secondary" disabled={confirming} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

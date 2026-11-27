"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EvolutionForm } from "@/modules/evolutions/components/EvolutionForm";
import { QuickEvolutionForm } from "@/modules/evolutions/components/QuickEvolutionForm";
import { createEvolution } from "@/modules/evolutions/services/evolution-actions";
import type { PendingEvolutionItem } from "@/modules/evolutions/services/evolution-queries";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

interface PendingEvolutionsScreenProps {
  items: PendingEvolutionItem[];
  /** Vindo de ?appointmentId= (atalho da aba "Hoje") — abre direto nessa
   * evolução, pulando a lista, se ela ainda estiver pendente. */
  initialAppointmentId: string | null;
  aiEnabled?: boolean;
  transcriptionEnabled?: boolean;
  quickEvolutionEnabled?: boolean;
}

export function PendingEvolutionsScreen({
  items,
  initialAppointmentId,
  aiEnabled,
  transcriptionEnabled,
  quickEvolutionEnabled,
}: PendingEvolutionsScreenProps) {
  const router = useRouter();
  const validInitialId = useMemo(
    () => (initialAppointmentId && items.some((i) => i.id === initialAppointmentId) ? initialAppointmentId : null),
    [initialAppointmentId, items],
  );
  const [selectedId, setSelectedId] = useState<string | null>(validInitialId);
  const [detailedMode, setDetailedMode] = useState(false);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  function handleSaved() {
    setSelectedId(null);
    setDetailedMode(false);
    router.refresh();
  }

  if (selected) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-card">
        {detailedMode ? (
          <EvolutionForm
            submitLabel="Registrar evolução"
            onSubmit={(input) => createEvolution({ appointment_id: selected.id, ...input })}
            onCancel={() => setSelectedId(null)}
            onSaved={handleSaved}
            aiEnabled={aiEnabled}
            transcriptionEnabled={transcriptionEnabled}
            appointmentId={selected.id}
            onSwitchToQuickMode={() => setDetailedMode(false)}
          />
        ) : (
          <QuickEvolutionForm
            appointmentId={selected.id}
            patientName={selected.patientName}
            onCancel={() => setSelectedId(null)}
            onSaved={handleSaved}
            onSwitchToDetailedMode={() => setDetailedMode(true)}
            aiEnabled={quickEvolutionEnabled}
            transcriptionEnabled={transcriptionEnabled}
          />
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm font-medium text-text-secondary">
        Nenhuma evolução pendente. Tudo registrado por aqui.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => setSelectedId(item.id)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-card transition-colors hover:border-primary/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-text-primary">{item.patientName}</p>
              <p className="truncate text-xs text-text-secondary">
                {dateFormatter.format(new Date(`${item.date}T00:00:00`))}
                <span className="ml-1.5">{item.startTime.slice(0, 5)}</span>
                {item.specialtyName && <span className="ml-1.5">· {item.specialtyName}</span>}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger">
              Pendente
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

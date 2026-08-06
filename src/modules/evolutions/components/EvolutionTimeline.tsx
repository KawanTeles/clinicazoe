"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EvolutionDetailModal } from "@/modules/evolutions/components/EvolutionDetailModal";
import type { EvolutionView } from "@/modules/evolutions/services/evolution-queries";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

/** Linha do tempo cronológica de evoluções de um paciente — usada tanto na
 * ficha do profissional (/my-patients/[id]) quanto na aba "Histórico
 * Clínico" do admin (/patients/[id]). */
export function EvolutionTimeline({ evolutions }: { evolutions: EvolutionView[] }) {
  const [selected, setSelected] = useState<EvolutionView | null>(null);

  if (evolutions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm font-medium text-text-secondary">
        Nenhuma evolução registrada ainda.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {evolutions.map((evolution) => (
        <div key={evolution.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-text-primary">
                {evolution.appointmentDate
                  ? dateFormatter.format(new Date(`${evolution.appointmentDate}T00:00:00`))
                  : "—"}
                {evolution.appointmentStartTime && (
                  <span className="ml-1.5 font-semibold text-text-secondary">
                    {evolution.appointmentStartTime.slice(0, 5)}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {evolution.professionalName}
                {evolution.specialtyName && ` · ${evolution.specialtyName}`}
              </p>
            </div>
            {evolution.wasEdited && (
              <Badge tone="neutral" className="text-[10px]">
                Editado
              </Badge>
            )}
          </div>

          {evolution.sessionSummary && (
            <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{evolution.sessionSummary}</p>
          )}

          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => setSelected(evolution)}>
              Ver Evolução
            </Button>
          </div>
        </div>
      ))}

      <EvolutionDetailModal evolution={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

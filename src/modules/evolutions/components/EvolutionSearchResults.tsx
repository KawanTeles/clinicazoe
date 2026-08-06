"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EvolutionDetailModal } from "@/modules/evolutions/components/EvolutionDetailModal";
import type { EvolutionView } from "@/modules/evolutions/services/evolution-queries";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function EvolutionSearchResults({ items }: { items: EvolutionView[] }) {
  const [selected, setSelected] = useState<EvolutionView | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
        Nenhuma evolução encontrada com esses filtros.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
          <tr>
            <th className="px-5 py-3.5 font-bold">Data</th>
            <th className="px-5 py-3.5 font-bold">Paciente</th>
            <th className="px-5 py-3.5 font-bold">Profissional</th>
            <th className="px-5 py-3.5 font-bold">Especialidade</th>
            <th className="px-5 py-3.5 font-bold text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {items.map((evolution) => (
            <tr key={evolution.id} className="transition-colors hover:bg-card-elevated/40">
              <td className="px-5 py-4 text-text-secondary">
                {evolution.appointmentDate
                  ? dateFormatter.format(new Date(`${evolution.appointmentDate}T00:00:00`))
                  : "—"}{" "}
                {evolution.appointmentStartTime && (
                  <span className="font-semibold text-text-primary">{evolution.appointmentStartTime.slice(0, 5)}</span>
                )}
              </td>
              <td className="px-5 py-4 font-semibold text-text-primary">{evolution.patientName}</td>
              <td className="px-5 py-4 text-text-secondary">{evolution.professionalName}</td>
              <td className="px-5 py-4 text-text-secondary">{evolution.specialtyName ?? "—"}</td>
              <td className="px-5 py-4 text-right">
                <Button size="sm" variant="secondary" onClick={() => setSelected(evolution)}>
                  Ver
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <EvolutionDetailModal evolution={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EvolutionForm } from "@/modules/evolutions/components/EvolutionForm";
import {
  createEvolution,
  loadAppointmentsAvailableForEvolution,
} from "@/modules/evolutions/services/evolution-actions";
import type { EvolutionEligibleAppointment } from "@/modules/evolutions/services/evolution-queries";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

interface NewEvolutionLauncherProps {
  patientId: string;
  aiEnabled?: boolean;
  transcriptionEnabled?: boolean;
}

/** Botão "Nova evolução" da ficha do paciente (aba Histórico Clínico).
 * Evolução é sempre vinculada a um atendimento realizado
 * (patient_evolutions.appointment_id), então criar aqui significa escolher,
 * entre os atendimentos deste paciente com este profissional ainda sem
 * evolução própria, qual deles está sendo documentado — complementa
 * EvolutionPanel (aba "Evolução" de um atendimento específico), que resolve
 * o mesmo caso quando o profissional já está dentro do atendimento certo. */
export function NewEvolutionLauncher({ patientId, aiEnabled, transcriptionEnabled }: NewEvolutionLauncherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<EvolutionEligibleAppointment[] | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    const items = await loadAppointmentsAvailableForEvolution(patientId);
    setOptions(items);
    setLoading(false);
  }

  function handleClose() {
    setOpen(false);
    setOptions(null);
    setSelectedAppointmentId(null);
  }

  function handleSaved() {
    handleClose();
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" onClick={handleOpen}>
          + Nova evolução
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-text-secondary shadow-card">
        Carregando atendimentos...
      </div>
    );
  }

  if (selectedAppointmentId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <EvolutionForm
          submitLabel="Registrar evolução"
          onSubmit={(input) => createEvolution({ appointment_id: selectedAppointmentId, ...input })}
          onCancel={() => setSelectedAppointmentId(null)}
          onSaved={handleSaved}
          aiEnabled={aiEnabled}
          transcriptionEnabled={transcriptionEnabled}
          appointmentId={selectedAppointmentId}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-text-primary">Escolha o atendimento</p>
        <button
          type="button"
          onClick={handleClose}
          className="text-xs font-semibold text-text-secondary hover:underline"
        >
          Cancelar
        </button>
      </div>
      {!options || options.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Nenhum atendimento deste paciente está disponível para um novo registro agora — evolução é sempre
          vinculada a um atendimento confirmado/concluído que ainda não tenha evolução sua. Agende ou conclua um
          atendimento para poder registrar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelectedAppointmentId(o.id)}
              className="flex items-center justify-between rounded-xl border border-border bg-card-elevated/40 px-3.5 py-2.5 text-left text-sm transition-colors hover:border-primary/50"
            >
              <span className="font-semibold text-text-primary">
                {dateFormatter.format(new Date(`${o.date}T00:00:00`))}
                <span className="ml-1.5 text-text-secondary">{o.startTime.slice(0, 5)}</span>
              </span>
              {o.specialtyName && <span className="text-xs text-text-secondary">{o.specialtyName}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

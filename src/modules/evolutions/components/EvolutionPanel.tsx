"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EvolutionForm } from "@/modules/evolutions/components/EvolutionForm";
import { createEvolution, updateEvolution } from "@/modules/evolutions/services/evolution-actions";
import type { EvolutionView } from "@/modules/evolutions/services/evolution-queries";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const SECTIONS: { key: keyof EvolutionView; label: string }[] = [
  { key: "sessionSummary", label: "Resumo da Sessão" },
  { key: "clinicalEvolution", label: "Evolução Clínica" },
  { key: "objectives", label: "Objetivos Trabalhados" },
  { key: "interventions", label: "Intervenções Realizadas" },
  { key: "patientResponse", label: "Resposta do Paciente" },
  { key: "homeGuidance", label: "Orientações para Casa" },
  { key: "observations", label: "Observações" },
];

const REALIZED_STATUSES = ["confirmada", "concluida"];

interface EvolutionPanelProps {
  appointmentId: string;
  appointmentStatus: string;
  isOwnerProfessional: boolean;
  evolution: EvolutionView | null;
  aiEnabled?: boolean;
}

/** Conteúdo da aba "Evolução" da tela de detalhes da consulta. */
export function EvolutionPanel({
  appointmentId,
  appointmentStatus,
  isOwnerProfessional,
  evolution,
  aiEnabled,
}: EvolutionPanelProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const canCreate = isOwnerProfessional && REALIZED_STATUSES.includes(appointmentStatus);
  const canEdit = isOwnerProfessional && evolution !== null;

  function handleSaved() {
    setShowForm(false);
    router.refresh();
  }

  if (showForm) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <EvolutionForm
          initial={
            evolution
              ? {
                  session_summary: evolution.sessionSummary ?? undefined,
                  clinical_evolution: evolution.clinicalEvolution,
                  objectives: evolution.objectives ?? undefined,
                  interventions: evolution.interventions ?? undefined,
                  patient_response: evolution.patientResponse ?? undefined,
                  home_guidance: evolution.homeGuidance ?? undefined,
                  observations: evolution.observations ?? undefined,
                }
              : undefined
          }
          submitLabel={evolution ? "Salvar alterações" : "Registrar evolução"}
          onSubmit={(input) =>
            evolution ? updateEvolution(evolution.id, input) : createEvolution({ appointment_id: appointmentId, ...input })
          }
          onCancel={() => setShowForm(false)}
          onSaved={handleSaved}
          aiEnabled={aiEnabled}
          appointmentId={appointmentId}
        />
      </div>
    );
  }

  if (!evolution) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm font-medium text-text-secondary">
          {canCreate
            ? "Nenhuma evolução registrada para esta consulta ainda."
            : "Esta consulta ainda não tem evolução registrada pelo profissional responsável."}
        </p>
        {canCreate && <Button onClick={() => setShowForm(true)}>Adicionar Evolução</Button>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Profissional responsável</p>
          <p className="mt-0.5 text-sm font-semibold text-text-primary">{evolution.professionalName}</p>
          {evolution.specialtyName && <p className="text-xs text-text-secondary">{evolution.specialtyName}</p>}
        </div>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
            Editar
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-5">
        {SECTIONS.map((section) => {
          const value = evolution[section.key] as string | null;
          if (!value) return null;
          return (
            <div key={section.key}>
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{section.label}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{value}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-border/60 pt-3 text-xs text-text-muted">
        Criado por {evolution.createdByName ?? "—"} em {dateTimeFormatter.format(new Date(evolution.createdAt))}
        {evolution.wasEdited && evolution.updatedByName && (
          <>
            {" "}
            · Última edição por {evolution.updatedByName} em {dateTimeFormatter.format(new Date(evolution.updatedAt))}
          </>
        )}
      </div>
    </div>
  );
}

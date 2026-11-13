"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EvolutionForm } from "@/modules/evolutions/components/EvolutionForm";
import { AddendumForm, SignatureLine } from "@/modules/evolutions/components/AddendumForm";
import { createEvolution } from "@/modules/evolutions/services/evolution-actions";
import type { EvolutionView } from "@/modules/evolutions/services/evolution-queries";

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
  canManageEvolution: boolean;
  evolution: EvolutionView | null;
  aiEnabled?: boolean;
  transcriptionEnabled?: boolean;
}

/** Conteúdo da aba "Evolução" da tela de detalhes da consulta. Evolução
 * assinada é imutável (sem policy de UPDATE desde a Etapa 69) — não existe
 * mais "Editar". Correção/acréscimo depois de assinada é sempre uma
 * complementação (novo registro, própria assinatura), nunca sobrescrita. */
export function EvolutionPanel({
  appointmentId,
  appointmentStatus,
  canManageEvolution,
  evolution,
  aiEnabled,
  transcriptionEnabled,
}: EvolutionPanelProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showAddendumForm, setShowAddendumForm] = useState(false);

  const canCreate = canManageEvolution && REALIZED_STATUSES.includes(appointmentStatus);
  const canAddAddendum = canManageEvolution && evolution !== null;

  function handleSaved() {
    setShowForm(false);
    setShowAddendumForm(false);
    router.refresh();
  }

  if (showForm) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <EvolutionForm
          submitLabel="Registrar evolução"
          onSubmit={(input) => createEvolution({ appointment_id: appointmentId, ...input })}
          onCancel={() => setShowForm(false)}
          onSaved={handleSaved}
          aiEnabled={aiEnabled}
          transcriptionEnabled={transcriptionEnabled}
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
            ? "Nenhuma evolução registrada para este atendimento ainda."
            : "Este atendimento ainda não tem evolução registrada pelo profissional responsável."}
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
          <p className="mt-0.5 text-sm font-semibold text-text-primary">{evolution.professionalNameSnapshot}</p>
          {evolution.specialtyName && <p className="text-xs text-text-secondary">{evolution.specialtyName}</p>}
        </div>
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

      <div className="mt-5 border-t border-border/60 pt-3">
        <SignatureLine name={evolution.professionalNameSnapshot} at={evolution.createdAt} />
      </div>

      {evolution.addenda.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 border-t border-border/60 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Complementações</p>
          {evolution.addenda.map((addendum) => (
            <div key={addendum.id} className="rounded-xl border border-border bg-card-elevated/50 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{addendum.content}</p>
              <div className="mt-2">
                <SignatureLine name={addendum.professionalNameSnapshot} at={addendum.createdAt} />
              </div>
            </div>
          ))}
        </div>
      )}

      {canAddAddendum && (
        <div className="mt-5 border-t border-border/60 pt-4">
          {showAddendumForm ? (
            <AddendumForm
              evolutionId={evolution.id}
              onCancel={() => setShowAddendumForm(false)}
              onSaved={handleSaved}
            />
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setShowAddendumForm(true)}>
              Adicionar complementação
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

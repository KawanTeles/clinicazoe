"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AddendumForm, SignatureLine } from "@/modules/evolutions/components/AddendumForm";
import { loadEvolutionVersions, type EvolutionAddendumResult } from "@/modules/evolutions/services/evolution-actions";
import type { EvolutionVersionView, EvolutionView } from "@/modules/evolutions/services/evolution-queries";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const SECTIONS: { key: keyof EvolutionView & keyof EvolutionVersionView; label: string }[] = [
  { key: "sessionSummary", label: "Resumo da Sessão" },
  { key: "clinicalEvolution", label: "Evolução Clínica" },
  { key: "objectives", label: "Objetivos Trabalhados" },
  { key: "interventions", label: "Intervenções Realizadas" },
  { key: "patientResponse", label: "Resposta do Paciente" },
  { key: "homeGuidance", label: "Orientações para Casa" },
  { key: "observations", label: "Observações" },
];

/** Exportar em PDF: o navegador já resolve isso via "Imprimir → Salvar como
 * PDF"; o print CSS abaixo isola só o conteúdo da evolução na impressão, sem
 * mexer em nenhum estilo global do sistema. */
export function EvolutionDetailModal({
  evolution,
  onClose,
  canAddAddendum = false,
  onAddendumSaved,
}: {
  evolution: EvolutionView | null;
  onClose: () => void;
  /** Só true quando o profissional atual está vinculado ao paciente desta
   * evolução (mesmo critério de leitura, Etapa 69) — não depende de ter
   * sido o autor original. */
  canAddAddendum?: boolean;
  onAddendumSaved?: (addendum: EvolutionAddendumResult) => void;
}) {
  const [versions, setVersions] = useState<EvolutionVersionView[] | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showAddendumForm, setShowAddendumForm] = useState(false);

  useEffect(() => {
    setVersions(null);
    setLoadingVersions(false);
    setShowAddendumForm(false);
  }, [evolution?.id]);

  async function handleLoadHistory() {
    if (!evolution) return;
    setLoadingVersions(true);
    const result = await loadEvolutionVersions(evolution.id);
    setVersions(result);
    setLoadingVersions(false);
  }

  return (
    <Modal
      isOpen={evolution !== null}
      onClose={onClose}
      title="Evolução Clínica"
      subtitle={evolution?.patientName}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </>
      }
    >
      {evolution && (
        <>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #evolution-print-area, #evolution-print-area * { visibility: visible; }
              #evolution-print-area { position: absolute; inset: 0; padding: 24px; }
            }
          `}</style>
          <div id="evolution-print-area" className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card-elevated/50 p-4 sm:grid-cols-4">
              <MetaField
                label="Data"
                value={
                  evolution.appointmentDate
                    ? dateFormatter.format(new Date(`${evolution.appointmentDate}T00:00:00`))
                    : "—"
                }
              />
              <MetaField
                label="Hora"
                value={evolution.appointmentStartTime ? evolution.appointmentStartTime.slice(0, 5) : "—"}
              />
              <MetaField label="Profissional" value={evolution.professionalNameSnapshot} />
              <MetaField label="Especialidade" value={evolution.specialtyName ?? "—"} />
            </div>

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

            <div className="border-t border-border/60 pt-3">
              <SignatureLine name={evolution.professionalNameSnapshot} at={evolution.createdAt} />
            </div>

            {evolution.addenda.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
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
              <div className="border-t border-border/60 pt-3 print:hidden">
                {showAddendumForm ? (
                  <AddendumForm
                    evolutionId={evolution.id}
                    onCancel={() => setShowAddendumForm(false)}
                    onSaved={(addendum) => {
                      setShowAddendumForm(false);
                      onAddendumSaved?.(addendum);
                    }}
                  />
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setShowAddendumForm(true)}>
                    Adicionar complementação
                  </Button>
                )}
              </div>
            )}

            {evolution.wasEdited && (
              <div className="border-t border-border/60 pt-3 print:hidden">
                {versions === null ? (
                  <Button size="sm" variant="secondary" isLoading={loadingVersions} onClick={handleLoadHistory}>
                    Ver histórico de edições
                  </Button>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Histórico de Edições
                    </p>
                    {versions.length === 0 ? (
                      <p className="text-sm text-text-secondary">Nenhuma versão anterior encontrada.</p>
                    ) : (
                      versions.map((version) => (
                        <div
                          key={version.versionNumber}
                          className="flex flex-col gap-3 rounded-xl border border-border bg-card-elevated/50 p-4"
                        >
                          <p className="text-xs font-semibold text-text-secondary">
                            Versão {version.versionNumber} · antes da edição de{" "}
                            {version.editedByName ?? "—"} em {dateTimeFormatter.format(new Date(version.editedAt))}
                          </p>
                          {SECTIONS.map((section) => {
                            const value = version[section.key];
                            if (!value) return null;
                            return (
                              <div key={section.key}>
                                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                                  {section.label}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                                  {value}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}

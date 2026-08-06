"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { EvolutionView } from "@/modules/evolutions/services/evolution-queries";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
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

/** Exportar em PDF: o navegador já resolve isso via "Imprimir → Salvar como
 * PDF"; o print CSS abaixo isola só o conteúdo da evolução na impressão, sem
 * mexer em nenhum estilo global do sistema. */
export function EvolutionDetailModal({
  evolution,
  onClose,
}: {
  evolution: EvolutionView | null;
  onClose: () => void;
}) {
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
              <MetaField label="Profissional" value={evolution.professionalName} />
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

            <div className="border-t border-border/60 pt-3 text-xs text-text-muted">
              Criado por {evolution.createdByName ?? "—"} em {dateTimeFormatter.format(new Date(evolution.createdAt))}
              {evolution.wasEdited && evolution.updatedByName && (
                <>
                  {" "}
                  · Última edição por {evolution.updatedByName} em{" "}
                  {dateTimeFormatter.format(new Date(evolution.updatedAt))}
                </>
              )}
            </div>
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

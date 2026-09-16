"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getAttendanceInfo } from "@/lib/attendance";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { AbsencePatientGroup } from "@/modules/appointments/services/appointment-queries";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

function absenceBadgeTone(total: number): "neutral" | "warning" | "danger" {
  if (total >= 3) return "danger";
  if (total === 2) return "warning";
  return "neutral";
}

type CategoryFilter = "todas" | "nao_justificadas" | "justificadas";

const CATEGORY_OPTIONS: { id: CategoryFilter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "nao_justificadas", label: "Não justificadas" },
  { id: "justificadas", label: "Justificadas" },
];

export function AbsencePatientList({
  groups,
  isStaff,
}: {
  groups: AbsencePatientGroup[];
  isStaff: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("todas");

  function toggle(patientId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  }

  // Filtro client-side sobre os grupos já carregados — as duas categorias
  // (falta normal / justificada) vêm juntas do backend na mesma página;
  // aqui só decide o que fica visível, sem round-trip ao servidor.
  const visibleGroups = groups
    .map((group) => {
      if (categoryFilter === "todas") return group;
      const filteredAppointments = group.appointments.filter((appt) =>
        categoryFilter === "justificadas" ? appt.justified : !appt.justified,
      );
      return filteredAppointments.length > 0 ? { ...group, appointments: filteredAppointments } : null;
    })
    .filter((group): group is AbsencePatientGroup => group !== null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {CATEGORY_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setCategoryFilter(option.id)}
            className={`rounded-xl px-3 py-1.5 font-semibold transition-all ${
              categoryFilter === option.id
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "bg-card-elevated/40 text-text-secondary hover:text-text-primary hover:bg-card-elevated"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visibleGroups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
          Nenhuma falta nesta categoria.
        </div>
      )}

      {visibleGroups.map((group) => {
        const isExpanded = expanded.has(group.patientId);
        const whatsappMessage = `Olá ${group.patientName.split(" ")[0]}, notamos sua falta no atendimento de ${dateFormatter.format(
          new Date(`${group.lastAbsenceDate}T00:00:00`),
        )}. Podemos ajudar a remarcar?`;
        const whatsappLink = buildWhatsAppLink(group.patientWhatsapp ?? group.patientPhone, whatsappMessage);
        const telLink = group.patientPhone ? `tel:${group.patientPhone.replace(/\D/g, "")}` : null;

        return (
          <div key={group.patientId} className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-bold text-text-primary">{group.patientName}</span>
                <Badge tone={absenceBadgeTone(group.totalAbsences)}>
                  {group.totalAbsences} {group.totalAbsences === 1 ? "falta" : "faltas"}
                </Badge>
                {group.totalJustified > 0 && (
                  <Badge tone="warning">
                    {group.totalJustified} justificada{group.totalJustified > 1 ? "s" : ""}
                  </Badge>
                )}
                <span className="text-xs text-text-secondary">
                  Última falta: {dateFormatter.format(new Date(`${group.lastAbsenceDate}T00:00:00`))}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {group.patientPhone && (
                  <span className="text-xs font-medium text-text-secondary">{group.patientPhone}</span>
                )}
                {telLink && (
                  <a href={telLink}>
                    <Button size="sm" variant="outline">
                      Ligar
                    </Button>
                  </a>
                )}
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="secondary">
                      WhatsApp
                    </Button>
                  </a>
                )}
                <Button size="sm" variant="ghost" onClick={() => toggle(group.patientId)}>
                  {isExpanded ? "▲ Ocultar" : `▼ Ver ${group.appointments.length > 1 ? "todas as faltas" : "detalhes"}`}
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border/60 divide-y divide-border/40">
                {group.appointments.map((appt) => {
                  const attendance = getAttendanceInfo(
                    appt.insuranceName,
                    appt.paymentMethod,
                    appt.modality,
                    appt.particularProduct,
                  );
                  return (
                    <div
                      key={appt.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-3 text-text-secondary">
                        {isStaff && <span className="font-semibold text-text-primary">{appt.professionalName}</span>}
                        <span>{attendance.attendanceType}</span>
                        <span>
                          {dateFormatter.format(new Date(`${appt.date}T00:00:00`))}{" "}
                          <span className="font-semibold text-text-primary">{appt.startTime.slice(0, 5)}</span>
                        </span>
                        {appt.justified ? (
                          <Badge tone="warning" className="text-[10px]" title={appt.reason ?? undefined}>
                            Justificada
                          </Badge>
                        ) : (
                          <Badge tone="danger" className="text-[10px]">
                            Não avisou
                          </Badge>
                        )}
                      </div>
                      <Link href={`/appointments/${appt.id}`}>
                        <Button size="sm" variant="outline">
                          Detalhes
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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

export function AbsencePatientList({
  groups,
  isStaff,
}: {
  groups: AbsencePatientGroup[];
  isStaff: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(patientId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
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

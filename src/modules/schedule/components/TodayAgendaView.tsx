"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { updateAppointmentStatus } from "@/modules/appointments/services/booking-actions";
import { useToast } from "@/components/ui/Toast";
import type { TodayAppointmentItem } from "@/modules/appointments/services/appointment-queries";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  concluida: "Concluída",
  faltou: "Faltou",
  faltou_justificada: "Falta justificada",
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  pendente: "warning",
  confirmada: "neutral",
  concluida: "success",
  faltou: "danger",
  faltou_justificada: "warning",
};

function currentTimeHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
}

export function TodayAgendaView({ appointments }: { appointments: TodayAppointmentItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextId = useMemo(() => {
    const now = currentTimeHHMM();
    const upcoming = appointments.find(
      (a) => a.startTime >= now && a.status !== "faltou" && a.status !== "faltou_justificada" && a.status !== "concluida",
    );
    return upcoming?.id ?? null;
  }, [appointments]);

  function handleStatus(id: string, status: "concluida" | "faltou") {
    startTransition(async () => {
      const result = await updateAppointmentStatus(id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(status === "concluida" ? "Presença registrada." : "Falta registrada.");
      router.refresh();
    });
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm font-medium text-text-secondary">
        Nenhum atendimento para hoje.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {appointments.map((appt) => {
        const isNext = appt.id === nextId;
        const expanded = expandedId === appt.id;
        const isClosed = appt.status === "concluida" || appt.status === "faltou" || appt.status === "faltou_justificada";

        return (
          <li
            key={appt.id}
            className={`rounded-2xl border bg-card shadow-card transition-all ${
              isNext ? "border-primary ring-2 ring-primary/30" : "border-border"
            }`}
          >
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : appt.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className="flex min-w-16 flex-col items-center justify-center">
                <span className="text-base font-bold text-text-primary">{appt.startTime.slice(0, 5)}</span>
                {isNext && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Próxima</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text-primary">{appt.patientName}</p>
                <p className="truncate text-xs text-text-secondary">{appt.specialtyName || "—"}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={STATUS_TONE[appt.status] ?? "neutral"}>
                  {STATUS_LABELS[appt.status] ?? appt.status}
                </Badge>
                {!appt.hasEvolution && isClosed && (
                  <span className="text-[10px] font-bold text-danger">Evolução pendente</span>
                )}
              </div>
            </button>

            {expanded && (
              <div className="flex flex-col gap-2 border-t border-border/70 px-4 py-3.5">
                {!appt.hasEvolution && (
                  <Link href={`/nova-evolucao?appointmentId=${appt.id}`} className="w-full">
                    <Button size="sm" className="w-full">
                      Registrar evolução
                    </Button>
                  </Link>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={isPending || appt.status === "concluida"}
                    onClick={() => handleStatus(appt.id, "concluida")}
                  >
                    Marcar presença
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={isPending || appt.status === "faltou"}
                    onClick={() => handleStatus(appt.id, "faltou")}
                  >
                    Marcar falta
                  </Button>
                </div>
                <Link href={`/my-patients/${appt.patientId}`} className="w-full">
                  <Button size="sm" variant="ghost" className="w-full">
                    Abrir paciente
                  </Button>
                </Link>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

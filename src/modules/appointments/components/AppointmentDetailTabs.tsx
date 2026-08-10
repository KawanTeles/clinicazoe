"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/whatsapp";
import { getAttendanceInfo } from "@/lib/attendance";
import type { AppointmentView } from "@/modules/appointments/services/appointment-queries";
import type { CoTherapistInfo } from "@/modules/appointments/services/booking-queries";
import type { EvolutionView } from "@/modules/evolutions/services/evolution-queries";
import { EvolutionPanel } from "@/modules/evolutions/components/EvolutionPanel";
import { CoTherapistManager } from "@/modules/appointments/components/CoTherapistManager";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
  concluida: "Concluída",
  faltou: "Faltou",
  recusada: "Recusada",
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "premium"> = {
  pendente: "warning",
  confirmada: "success",
  cancelada: "neutral",
  remarcada: "neutral",
  concluida: "success",
  faltou: "danger",
  recusada: "danger",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

interface AppointmentDetailTabsProps {
  appointment: AppointmentView;
  canViewEvolution: boolean;
  /** Pode registrar/editar a PRÓPRIA evolução desta consulta — principal ou
   * coterapeuta (atendimento compartilhado, Fase 2). Não confundir com
   * gerenciar a consulta em si (editar/cancelar), que continua exclusivo do
   * principal/equipe. */
  canManageEvolution: boolean;
  evolution: EvolutionView | null;
  aiEnabled?: boolean;
  coTherapists: CoTherapistInfo[];
  availableProfessionals: { id: string; fullName: string }[];
  canManageCoTherapists: boolean;
}

export function AppointmentDetailTabs({
  appointment,
  canViewEvolution,
  canManageEvolution,
  evolution,
  aiEnabled,
  coTherapists,
  availableProfessionals,
  canManageCoTherapists,
}: AppointmentDetailTabsProps) {
  const [tab, setTab] = useState<"Detalhes" | "Evolução">("Detalhes");
  const attendance = getAttendanceInfo(
    appointment.insuranceName,
    appointment.paymentMethod,
    appointment.modality,
    appointment.particularProduct,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary font-heading">{appointment.patientName}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[appointment.status] ?? "neutral"}>
            {STATUS_LABELS[appointment.status] ?? appointment.status}
          </Badge>
          <span className="text-sm text-text-secondary">
            {dateFormatter.format(new Date(`${appointment.date}T00:00:00`))} às {appointment.startTime.slice(0, 5)}
          </span>
        </div>
      </div>

      {canViewEvolution && (
        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          {(["Detalhes", "Evolução"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={
                tab === item
                  ? "rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white"
                  : "rounded-full border border-border bg-card-elevated px-4 py-1.5 text-xs font-semibold text-text-secondary hover:border-primary/50"
              }
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {tab === "Detalhes" && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:grid-cols-2">
          <Field label="Paciente" value={appointment.patientName} />
          <Field label="Profissional" value={appointment.professionalName} />
          <Field label="Especialidade" value={appointment.specialtyName} />
          <Field label="Data" value={dateFormatter.format(new Date(`${appointment.date}T00:00:00`))} />
          <Field label="Horário" value={`${appointment.startTime.slice(0, 5)} – ${appointment.endTime.slice(0, 5)}`} />
          <Field label="Tipo de Atendimento" value={attendance.attendanceType} />
          <Field
            label={attendance.isConvenio ? "Convênio" : "Forma de Pagamento"}
            value={(attendance.isConvenio ? attendance.insuranceName : attendance.paymentMethodLabel) ?? ""}
          />
          {attendance.modalityLabel && <Field label="Modalidade" value={attendance.modalityLabel} />}
          {attendance.particularProductLabel && <Field label="Produto" value={attendance.particularProductLabel} />}
          <Field label="Valor" value={formatCurrency(appointment.value)} />
          {appointment.patientPhone && <Field label="Telefone do paciente" value={appointment.patientPhone} />}
          <CoTherapistManager
            appointmentId={appointment.id}
            coTherapists={coTherapists}
            availableProfessionals={availableProfessionals}
            canManage={canManageCoTherapists}
          />
        </div>
      )}

      {tab === "Evolução" && canViewEvolution && (
        <EvolutionPanel
          appointmentId={appointment.id}
          appointmentStatus={appointment.status}
          canManageEvolution={canManageEvolution}
          evolution={evolution}
          aiEnabled={aiEnabled}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-1 text-sm text-text-primary">{value || "—"}</p>
    </div>
  );
}

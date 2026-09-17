"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/whatsapp";
import { getAttendanceInfo } from "@/lib/attendance";
import Link from "next/link";
import type { AppointmentView, GroupParticipant } from "@/modules/appointments/services/appointment-queries";
import type { CoTherapistInfo } from "@/modules/appointments/services/booking-queries";
import type { EvolutionView } from "@/modules/evolutions/services/evolution-queries";
import { EvolutionPanel } from "@/modules/evolutions/components/EvolutionPanel";
import { CoTherapistManager } from "@/modules/appointments/components/CoTherapistManager";
import { updateAppointmentValue } from "@/modules/appointments/services/booking-actions";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
  concluida: "Concluída",
  faltou: "Faltou",
  recusada: "Recusada",
  faltou_justificada: "Falta justificada",
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "premium"> = {
  pendente: "warning",
  confirmada: "success",
  cancelada: "neutral",
  remarcada: "neutral",
  concluida: "success",
  faltou: "danger",
  recusada: "danger",
  faltou_justificada: "warning",
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
  transcriptionEnabled?: boolean;
  coTherapists: CoTherapistInfo[];
  availableProfessionals: { id: string; fullName: string }[];
  canManageCoTherapists: boolean;
  viewerId: string;
  isStaff: boolean;
  /** Linhas-irmãs da mesma sessão conjugada (migração 0067) — vazio quando o
   * atendimento não faz parte de nenhum grupo. */
  groupParticipants: GroupParticipant[];
}

export function AppointmentDetailTabs({
  appointment,
  canViewEvolution,
  canManageEvolution,
  evolution,
  aiEnabled,
  transcriptionEnabled,
  coTherapists,
  availableProfessionals,
  canManageCoTherapists,
  viewerId,
  isStaff,
  groupParticipants,
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
          <ValueField appointmentId={appointment.id} value={appointment.value} editable={isStaff} />
          {appointment.patientPhone && <Field label="Telefone do paciente" value={appointment.patientPhone} />}
          {(appointment.status === "faltou" || appointment.status === "faltou_justificada") &&
            appointment.absenceReason && <Field label="Motivo da falta" value={appointment.absenceReason} />}
          <CoTherapistManager
            appointmentId={appointment.id}
            coTherapists={coTherapists}
            availableProfessionals={availableProfessionals}
            canManage={canManageCoTherapists}
            viewerId={viewerId}
            isStaff={isStaff}
          />
          {groupParticipants.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Participantes desta sessão
              </p>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {groupParticipants.map((participant) => (
                  <Link
                    key={participant.appointmentId}
                    href={`/appointments/${participant.appointmentId}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card-elevated/40 px-3.5 py-2 text-sm transition-colors hover:border-primary/50"
                  >
                    <span className="font-semibold text-text-primary">{participant.patientName}</span>
                    <span className="text-xs text-text-secondary">
                      {participant.professionalName}
                      {participant.coTherapistNames.length > 0 && ` + ${participant.coTherapistNames.join(", ")}`}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "Evolução" && canViewEvolution && (
        <EvolutionPanel
          appointmentId={appointment.id}
          appointmentStatus={appointment.status}
          canManageEvolution={canManageEvolution}
          evolution={evolution}
          aiEnabled={aiEnabled}
          transcriptionEnabled={transcriptionEnabled}
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

/** Correção pontual do valor do atendimento — só admin/recepcionista
 * (editable). Nunca mexe na tabela de preços do convênio, só nesta linha. */
function ValueField({ appointmentId, value, editable }: { appointmentId: string; value: number; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editable) return <Field label="Valor" value={formatCurrency(value)} />;

  if (!editing) {
    return (
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Valor</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-text-primary">{formatCurrency(value)}</p>
          <button
            type="button"
            onClick={() => {
              setDraft(String(value));
              setError(null);
              setEditing(true);
            }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Editar
          </button>
        </div>
      </div>
    );
  }

  async function handleSave() {
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Informe um valor válido.");
      return;
    }
    setSaving(true);
    const result = await updateAppointmentValue(appointmentId, parsed);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Valor</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          className="w-28 rounded-md border border-border bg-card-elevated px-2 py-1 text-sm text-text-primary"
        />
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
        >
          Salvar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setEditing(false)}
          className="text-xs font-semibold text-text-secondary hover:underline disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

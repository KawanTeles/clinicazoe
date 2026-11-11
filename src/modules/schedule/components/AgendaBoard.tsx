"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { getAgendaForProfessionals, type ProfessionalAgenda, type AgendaAppointmentCell } from "@/modules/schedule/services/agenda-queries";
import { cancelAppointment, updateAppointmentStatus } from "@/modules/appointments/services/booking-actions";
import { updateAppointmentDetails } from "@/modules/schedule/services/agenda-actions";
import { updateRecurringAppointment } from "@/modules/appointments/services/recurrence-actions";
import { toLocalIsoDate } from "@/lib/date";

interface ProfessionalOption {
  id: string;
  fullName: string;
  specialtyId: string | null;
}

interface InsuranceOption {
  id: string;
  name: string;
  color: string | null;
}

interface AgendaBoardProps {
  professionals: ProfessionalOption[];
  insurances: InsuranceOption[];
  canViewAll: boolean;
  defaultProfessionalId: string | null;
  initialWeekStart: string;
  initialAgenda: ProfessionalAgenda | null;
  viewerRole: string;
}

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const BLOCK_LABELS: Record<string, string> = {
  almoco: "Almoço",
  nao_agendar: "Não Agendar",
  reuniao: "Reunião",
  reposicao: "Reposição",
  sublocacao: "Sublocação",
  outro: "Bloqueado",
};
const STATUS_BADGE: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "premium" }> = {
  pendente: { label: "Pendente", tone: "warning" },
  confirmada: { label: "Confirmada", tone: "neutral" },
  concluida: { label: "Concluída", tone: "success" },
  faltou: { label: "Faltou", tone: "danger" },
  faltou_justificada: { label: "Falta justificada", tone: "danger" },
};

function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

function weekDatesFrom(mondayIso: string): string[] {
  return Array.from({ length: 5 }, (_, i) => addDays(mondayIso, i));
}

function hourRangeFromSlots(agendas: ProfessionalAgenda[]): string[] {
  let minHour = 8;
  let maxHour = 18;
  for (const agenda of agendas) {
    for (const slot of agenda.slots) {
      minHour = Math.min(minHour, Number(slot.startTime.slice(0, 2)));
      maxHour = Math.max(maxHour, Number(slot.endTime.slice(0, 2)));
    }
  }
  const hours: string[] = [];
  for (let h = minHour; h < maxHour; h++) hours.push(`${String(h).padStart(2, "0")}:00`);
  return hours;
}

function isWithinSlot(agenda: ProfessionalAgenda, dayOfWeek: number, hour: string): boolean {
  return agenda.slots.some((s) => s.dayOfWeek === dayOfWeek && s.startTime.slice(0, 5) <= hour && s.endTime.slice(0, 5) > hour);
}

function findBlock(agenda: ProfessionalAgenda, date: string, dayOfWeek: number, hour: string) {
  return agenda.blocks.find((b) => {
    const matchesTime = b.startTime.slice(0, 5) <= hour && b.endTime.slice(0, 5) > hour;
    if (!matchesTime) return false;
    if (b.specificDate) return b.specificDate === date;
    return b.dayOfWeek === dayOfWeek;
  });
}

function findAppointment(agenda: ProfessionalAgenda, date: string, hour: string) {
  return agenda.appointments.find((a) => a.date === date && a.startTime.slice(0, 5) === hour);
}

export function AgendaBoard({
  professionals,
  insurances,
  canViewAll,
  defaultProfessionalId,
  initialWeekStart,
  initialAgenda,
  viewerRole,
}: AgendaBoardProps) {
  const [mode, setMode] = useState<"profissional" | "todos">("profissional");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(defaultProfessionalId ?? "");
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [todosDate, setTodosDate] = useState(initialWeekStart);
  const [agendaByProfessionalId, setAgendaByProfessionalId] = useState<Map<string, ProfessionalAgenda>>(
    initialAgenda && defaultProfessionalId ? new Map([[defaultProfessionalId, initialAgenda]]) : new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AgendaAppointmentCell | null>(null);
  const router = useRouter();

  const dates = mode === "profissional" ? weekDatesFrom(weekStart) : [todosDate];
  const columns =
    mode === "profissional"
      ? dates.map((date) => ({ key: date, label: `${DAY_LABELS[new Date(`${date}T00:00:00`).getDay()]} ${date.split("-").reverse().slice(0, 2).join("/")}` }))
      : professionals.map((p) => ({ key: p.id, label: p.fullName }));

  const relevantIds = mode === "profissional" ? [selectedProfessionalId].filter(Boolean) : professionals.map((p) => p.id);
  const agendas = relevantIds.map((id) => agendaByProfessionalId.get(id)).filter((a): a is ProfessionalAgenda => !!a);
  const hours = hourRangeFromSlots(agendas.length > 0 ? agendas : []);

  async function refetch(professionalIds: string[], startDate: string, endDate: string) {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await getAgendaForProfessionals(professionalIds, startDate, endDate);
      setAgendaByProfessionalId((prev) => {
        const next = new Map(prev);
        for (const [id, agenda] of result) next.set(id, agenda);
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleModeChange(value: string) {
    if (value === "todos") {
      setMode("todos");
      void refetch(professionals.map((p) => p.id), todosDate, todosDate);
    } else {
      setMode("profissional");
      setSelectedProfessionalId(value);
      const w = weekDatesFrom(weekStart);
      void refetch([value], w[0], w[4]);
    }
  }

  function handleWeekChange(newMonday: string) {
    setWeekStart(newMonday);
    if (selectedProfessionalId) {
      const w = weekDatesFrom(newMonday);
      void refetch([selectedProfessionalId], w[0], w[4]);
    }
  }

  function handleTodosDateChange(newDate: string) {
    setTodosDate(newDate);
    void refetch(professionals.map((p) => p.id), newDate, newDate);
  }

  function currentAgendaFor(columnKey: string): ProfessionalAgenda | undefined {
    const professionalId = mode === "profissional" ? selectedProfessionalId : columnKey;
    return agendaByProfessionalId.get(professionalId);
  }

  async function handleMove(targetProfessionalId: string, targetDate: string, targetHour: string) {
    if (!draggingId) return;
    const id = draggingId;
    setDraggingId(null);

    const result = await updateRecurringAppointment({
      appointmentId: id,
      scope: "only",
      date: targetDate,
      startTime: `${targetHour}:00`,
    });
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    const idsToRefresh = mode === "profissional" ? [selectedProfessionalId] : professionals.map((p) => p.id);
    const start = mode === "profissional" ? dates[0] : todosDate;
    const end = mode === "profissional" ? dates[dates.length - 1] : todosDate;
    void refetch(idsToRefresh, start, end);
  }

  function reloadCurrent() {
    const idsToRefresh = mode === "profissional" ? [selectedProfessionalId] : professionals.map((p) => p.id);
    const start = mode === "profissional" ? dates[0] : todosDate;
    const end = mode === "profissional" ? dates[dates.length - 1] : todosDate;
    void refetch(idsToRefresh, start, end);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {professionals.length > 1 && (
                <Select
                  value={mode === "profissional" ? selectedProfessionalId : "todos"}
                  onChange={(e) => handleModeChange(e.target.value)}
                  className="w-64"
                >
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                  {canViewAll && <option value="todos">Todos (admin/recepção)</option>}
                </Select>
              )}
              {professionals.length === 1 && (
                <span className="text-sm font-bold text-text-primary">{professionals[0].fullName}</span>
              )}

              {mode === "profissional" ? (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => handleWeekChange(addDays(weekStart, -7))} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold hover:bg-card-elevated">
                    ← Semana anterior
                  </button>
                  <button type="button" onClick={() => handleWeekChange(addDays(weekStart, 7))} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold hover:bg-card-elevated">
                    Próxima semana →
                  </button>
                </div>
              ) : (
                <input
                  type="date"
                  value={todosDate}
                  onChange={(e) => handleTodosDateChange(e.target.value)}
                  className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs font-medium text-text-primary"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {insurances.map((ins) => (
                <span key={ins.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card-elevated px-2.5 py-1 text-[11px] font-bold text-text-primary">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ins.color ?? "#999" }} />
                  {ins.name}
                </span>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs font-semibold text-danger">
              {errorMessage}
              <button type="button" className="ml-2 underline" onClick={() => setErrorMessage(null)}>
                Fechar
              </button>
            </div>
          )}

          {!selectedProfessionalId && mode === "profissional" ? (
            <p className="py-8 text-center text-sm text-text-muted">Nenhum profissional cadastrado.</p>
          ) : hours.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              Nenhum horário de trabalho cadastrado. Configure em Equipe → Horários.
            </p>
          ) : (
            <div className={`overflow-x-auto ${loading ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="grid min-w-[720px] gap-1" style={{ gridTemplateColumns: `80px repeat(${columns.length}, minmax(140px, 1fr))` }}>
                <div />
                {columns.map((col) => (
                  <div key={col.key} className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-text-secondary">
                    {col.label}
                  </div>
                ))}

                {hours.map((hour) => (
                  <>
                    <div key={`hour-${hour}`} className="flex items-center justify-end pr-2 text-xs font-bold text-text-muted">
                      {hour}
                    </div>
                    {columns.map((col) => {
                      const professionalId = mode === "profissional" ? selectedProfessionalId : col.key;
                      const date = mode === "profissional" ? col.key : todosDate;
                      const agenda = currentAgendaFor(col.key);
                      const dayOfWeek = new Date(`${date}T00:00:00`).getDay();

                      if (!agenda || !isWithinSlot(agenda, dayOfWeek, hour)) {
                        return <div key={`${col.key}-${hour}`} className="h-14 rounded-lg bg-transparent" />;
                      }

                      const block = findBlock(agenda, date, dayOfWeek, hour);
                      if (block) {
                        return (
                          <div
                            key={`${col.key}-${hour}`}
                            className="flex h-14 flex-col items-center justify-center rounded-lg border border-border bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.04),rgba(0,0,0,0.04)_6px,transparent_6px,transparent_12px)] text-[11px] font-bold text-text-muted"
                          >
                            {BLOCK_LABELS[block.blockType] ?? block.blockType}
                            {block.label && <span className="font-normal text-[10px]">{block.label}</span>}
                          </div>
                        );
                      }

                      const appt = findAppointment(agenda, date, hour);
                      if (!appt) {
                        return (
                          <button
                            key={`${col.key}-${hour}`}
                            type="button"
                            onClick={() =>
                              router.push(
                                `/appointments/new?professionalId=${professionalId}&date=${date}&startTime=${hour}`,
                              )
                            }
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => void handleMove(professionalId, date, hour)}
                            className="h-14 rounded-lg border border-dashed border-border/70 bg-card-elevated/30 text-[11px] text-text-muted hover:border-primary hover:bg-[var(--badge-bg)] hover:text-[var(--primary)] transition-colors"
                          >
                            + Livre
                          </button>
                        );
                      }

                      const statusBadge = STATUS_BADGE[appt.status];
                      return (
                        <button
                          key={`${col.key}-${hour}`}
                          type="button"
                          draggable
                          onDragStart={() => setDraggingId(appt.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => void handleMove(professionalId, date, hour)}
                          onClick={() => setEditingAppointment(appt)}
                          className="flex h-14 flex-col items-start justify-center gap-0.5 rounded-lg border-l-4 bg-card px-2.5 text-left shadow-xs hover:shadow-card transition-shadow cursor-grab active:cursor-grabbing"
                          style={{ borderLeftColor: appt.insuranceColor ?? "#999" }}
                        >
                          <span className="text-xs font-bold text-text-primary leading-tight line-clamp-1">
                            {appt.patientName}
                            {appt.groupPatientNames.length > 0 && ` + ${appt.groupPatientNames.join(", ")}`}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-text-secondary">
                            {appt.groupId && <Badge tone="premium" className="px-1.5 py-0 text-[9px]">Conjugado</Badge>}
                            {statusBadge && statusBadge.label !== "Confirmada" && (
                              <Badge tone={statusBadge.tone} className="px-1.5 py-0 text-[9px]">
                                {statusBadge.label}
                              </Badge>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={!!editingAppointment} onClose={() => setEditingAppointment(null)} title="Editar atendimento" size="sm">
        {editingAppointment && (
          <EditAppointmentForm
            appointment={editingAppointment}
            insurances={insurances}
            viewerRole={viewerRole}
            onDone={() => {
              setEditingAppointment(null);
              reloadCurrent();
            }}
            onError={(msg) => setErrorMessage(msg)}
          />
        )}
      </Modal>
    </div>
  );
}


function EditAppointmentForm({
  appointment,
  insurances,
  viewerRole,
  onDone,
  onError,
}: {
  appointment: AgendaAppointmentCell;
  insurances: InsuranceOption[];
  viewerRole: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [value, setValue] = useState(appointment.value != null ? String(appointment.value) : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSaveValue() {
    setBusy(true);
    const parsed = value.trim() ? Number(value) : null;
    const result = await updateAppointmentDetails({
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      insuranceId: appointment.insuranceId,
      insuranceName: insurances.find((i) => i.id === appointment.insuranceId)?.name ?? "",
      paymentMethod: appointment.paymentMethod,
      value: parsed,
      modality: appointment.modality,
      particularProduct: appointment.particularProduct,
    });
    setBusy(false);
    if (result.error) return onError(result.error);
    onDone();
  }

  async function handleCancel() {
    setBusy(true);
    const result = await cancelAppointment(appointment.id, { reason });
    setBusy(false);
    if (result.error) return onError(result.error);
    onDone();
  }

  async function handleMarkStatus(status: "concluida" | "faltou" | "faltou_justificada") {
    setBusy(true);
    const result = await updateAppointmentStatus(appointment.id, status, status === "faltou_justificada" ? reason : undefined);
    setBusy(false);
    if (result.error) return onError(result.error);
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card-elevated/50 p-3 text-xs">
        <p className="font-bold text-text-primary">{appointment.patientName}</p>
        <p className="text-text-secondary">
          {appointment.date.split("-").reverse().join("/")} às {appointment.startTime.slice(0, 5)} —{" "}
          {insurances.find((i) => i.id === appointment.insuranceId)?.name}
        </p>
        {appointment.groupPatientNames.length > 0 && (
          <p className="mt-1 text-text-secondary">Sessão conjugada com: {appointment.groupPatientNames.join(", ")}</p>
        )}
        {appointment.coTherapistNames.length > 0 && (
          <p className="mt-1 text-text-secondary">Coterapeutas: {appointment.coTherapistNames.join(", ")}</p>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Valor (opcional)</label>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-card-elevated px-3.5 text-xs font-medium text-text-primary"
          />
        </div>
        <Button variant="outline" onClick={handleSaveValue} disabled={busy}>Salvar valor</Button>
      </div>

      <Textarea label="Motivo (cancelamento ou falta justificada)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: paciente remarcou por telefone" />

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => handleMarkStatus("concluida")} disabled={busy}>Marcar concluída</Button>
        <Button variant="outline" onClick={() => handleMarkStatus("faltou")} disabled={busy}>Marcar falta</Button>
        <Button variant="danger" onClick={handleCancel} disabled={busy}>Cancelar atendimento</Button>
      </div>
      {viewerRole === "profissional" && (
        <p className="text-[11px] text-text-muted">Atendimentos passados só podem ter o status atualizado.</p>
      )}
    </div>
  );
}

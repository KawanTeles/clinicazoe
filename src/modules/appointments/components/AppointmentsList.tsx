"use client";

import { Fragment, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/whatsapp";
import type { Modality, Role } from "@/lib/supabase/types";
import type { AppointmentView } from "@/modules/appointments/services/appointment-queries";
import {
  cancelAppointment,
  confirmAppointment,
  sendReminder,
  updateAppointmentStatus,
} from "@/modules/appointments/services/booking-actions";
import { RecurrenceScopeDialog } from "@/modules/appointments/components/RecurrenceScopeDialog";
import { AttachRecurrenceDialog } from "@/modules/appointments/components/AttachRecurrenceDialog";

import { getAttendanceInfo } from "@/lib/attendance";

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

interface ScopeDialogState {
  mode: "edit" | "delete";
  appointmentId: string;
  seriesId: string;
  date: string;
  startTime: string;
  professionalId: string;
  insuranceId: string;
}

interface AttachDialogState {
  appointmentId: string;
  date: string;
  professionalId: string;
  insuranceId: string;
  modality: Modality | null;
}

export function AppointmentsList({
  viewerRole,
  viewerId,
  appointments,
}: {
  viewerRole: Role;
  viewerId: string;
  appointments: AppointmentView[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scopeDialog, setScopeDialog] = useState<ScopeDialogState | null>(null);
  const [attachDialog, setAttachDialog] = useState<AttachDialogState | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());

  const isStaff = viewerRole === "admin" || viewerRole === "recepcionista";
  const isAdmin = viewerRole === "admin";
  const isPatient = viewerRole === "paciente";
  const isProfessional = viewerRole === "profissional";

  const filteredAppointments = useMemo(() => {
    return appointments.filter((item) => {
      const matchesSearch =
        search === "" ||
        item.patientName.toLowerCase().includes(search.toLowerCase()) ||
        item.professionalName.toLowerCase().includes(search.toLowerCase()) ||
        item.insuranceName.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "todos" ? item.status !== "cancelada" : item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [appointments, search, statusFilter]);

  const appointmentGroups = useMemo(() => {
    const map = new Map<string, AppointmentView[]>();
    const order: string[] = [];

    for (const appt of filteredAppointments) {
      const key = appt.seriesId ?? `single-${appt.id}`;
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(appt);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const sortByDateTime = (a: AppointmentView, b: AppointmentView) =>
      `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`);

    return order.map((key) => {
      const items = map.get(key)!;
      const seriesId = items[0].seriesId ?? null;

      if (!seriesId || items.length === 1) {
        return { key, seriesId, primary: items[0], others: [] as AppointmentView[] };
      }

      const sorted = [...items].sort(sortByDateTime);
      const candidates = sorted.filter((item) => item.status === "pendente" || item.status === "confirmada");
      const pool = candidates.length > 0 ? candidates : sorted;

      // Prioriza a próxima ocorrência futura (>= hoje); se não houver, cai para a mais recente do passado.
      const primary = pool.find((item) => item.date >= todayStr) ?? pool[pool.length - 1];

      const others = sorted.filter((item) => item.id !== primary.id);
      return { key, seriesId, primary, others };
    });
  }, [filteredAppointments]);

  function toggleSeriesExpanded(seriesId: string) {
    setExpandedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) {
        next.delete(seriesId);
      } else {
        next.add(seriesId);
      }
      return next;
    });
  }

  async function handleCancel(id: string) {
    const confirmed = await confirm({
      title: "Cancelar este atendimento?",
      description: "O horário será liberado e o paciente poderá agendar novamente.",
      confirmLabel: "Cancelar atendimento",
      tone: "danger",
    });
    if (!confirmed) return;
    setBusyId(id);
    const result = await cancelAppointment(id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Atendimento cancelado com sucesso.");
    if (result.whatsappLink) window.open(result.whatsappLink, "_blank");
    router.refresh();
  }

  async function handleReschedule(id: string) {
    const confirmed = await confirm({
      title: "Remarcar este atendimento?",
      description: "O atendimento atual será cancelado e você escolherá um novo horário.",
      confirmLabel: "Continuar",
    });
    if (!confirmed) return;
    setBusyId(id);
    const result = await cancelAppointment(id, { rescheduled: true });
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.whatsappLink) window.open(result.whatsappLink, "_blank");
    router.push("/book");
  }

  async function handleSendReminder(id: string) {
    setBusyId(id);
    const result = await sendReminder(id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Lembrete enviado com sucesso.");
    if (result.whatsappLink) window.open(result.whatsappLink, "_blank");
    router.refresh();
  }

  async function handleConfirm(id: string) {
    setBusyId(id);
    const result = await confirmAppointment(id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Atendimento confirmado com sucesso.");
    if (result.whatsappLink) {
      window.open(result.whatsappLink, "_blank");
    }
    router.refresh();
  }

  async function handleStaffCancel(id: string) {
    const confirmed = await confirm({
      title: "Cancelar este atendimento?",
      description: "O horário será liberado na agenda do profissional.",
      confirmLabel: "Cancelar atendimento",
      tone: "danger",
    });
    if (!confirmed) return;
    setBusyId(id);
    const result = await updateAppointmentStatus(id, "cancelada");
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Atendimento cancelado com sucesso.");
    router.refresh();
  }

  function handleScopeDialogDone(whatsappLink?: string | null) {
    setScopeDialog(null);
    toast.success(scopeDialog?.mode === "edit" ? "Atendimento reagendado com sucesso." : "Atendimento excluído com sucesso.");
    if (whatsappLink) window.open(whatsappLink, "_blank");
    router.refresh();
  }

  function handleAttachDialogDone(createdCount: number) {
    setAttachDialog(null);
    toast.success(
      createdCount > 1 ? `Recorrência criada: ${createdCount} atendimentos.` : "Atendimento transformado em recorrente.",
    );
    router.refresh();
  }

  function renderAppointmentRow(
    appt: AppointmentView,
    opts: {
      otherCount?: number;
      isExpanded?: boolean;
      onToggleExpand?: () => void;
      isSub?: boolean;
    } = {},
  ) {
    const { otherCount = 0, isExpanded = false, onToggleExpand, isSub = false } = opts;
    const isOwnProfessional = isProfessional && appt.professionalId === viewerId;
    const canManageRecurrence = isStaff || isOwnProfessional;
    const attendance = getAttendanceInfo(appt.insuranceName, appt.paymentMethod, appt.modality, appt.particularProduct);

    return (
      <tr
        key={appt.id}
        className={`transition-colors hover:bg-card-elevated/40 ${
          isSub ? "bg-card-elevated/20" : ""
        }`}
      >
        {isStaff && (
          <td className={`px-5 py-4 font-bold text-text-primary ${isSub ? "border-l-2 border-[var(--primary)]/30 pl-4" : ""}`}>
            {isSub && <span className="mr-1.5 text-text-muted">↳</span>}
            {appt.patientName}
          </td>
        )}
        <td className="px-5 py-4 font-semibold text-text-primary">{appt.professionalName}</td>
        <td className="px-5 py-4 text-text-secondary">
          <span className="font-semibold text-text-primary">{attendance.attendanceType}</span>
          {attendance.isConvenio ? (
            <>
              <span className="block text-xs text-text-muted">{attendance.insuranceName}</span>
              {attendance.modalityLabel && (
                <span className="block text-[10px] text-text-muted">Modalidade: {attendance.modalityLabel}</span>
              )}
            </>
          ) : (
            <>
              <span className="block text-xs text-text-muted">{attendance.paymentMethodLabel}</span>
              {attendance.particularProductLabel && (
                <span className="block text-[10px] text-text-muted">{attendance.particularProductLabel}</span>
              )}
            </>
          )}
        </td>
        <td className="px-5 py-4 text-text-secondary">
          {dateFormatter.format(new Date(`${appt.date}T00:00:00`))}{" "}
          <span className="font-semibold text-text-primary">{appt.startTime.slice(0, 5)}</span>
          {appt.seriesId && (
            <Badge tone="premium" className="ml-2 text-[10px]">
              Recorrente
            </Badge>
          )}
          {onToggleExpand && otherCount > 0 && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="ml-2 inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/10"
            >
              {isExpanded ? "▲" : "▼"} +{otherCount} outra{otherCount > 1 ? "s" : ""} data{otherCount > 1 ? "s" : ""}
            </button>
          )}
        </td>
        <td className="px-5 py-4 font-medium text-text-secondary">{formatCurrency(appt.value)}</td>
        <td className="px-5 py-4">
          <Badge tone={STATUS_TONE[appt.status] ?? "neutral"}>{STATUS_LABELS[appt.status] ?? appt.status}</Badge>
        </td>
        {isStaff && (
          <td className="px-5 py-4">
            {appt.reminderSentAt ? (
              <Badge tone="success" className="text-[10px]">Enviado</Badge>
            ) : (
              <Badge tone="neutral" className="text-[10px]">—</Badge>
            )}
          </td>
        )}
        <td className="px-5 py-4">
          <div className="flex flex-wrap justify-end gap-1.5">
            {(isStaff || isProfessional) && (
              <Link href={`/appointments/${appt.id}`}>
                <Button size="sm" variant="outline">
                  Detalhes
                </Button>
              </Link>
            )}
            {isStaff && appt.status === "pendente" && (
              <>
                <Button size="sm" isLoading={busyId === appt.id} onClick={() => handleConfirm(appt.id)}>
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isLoading={busyId === appt.id}
                  onClick={() => handleStaffCancel(appt.id)}
                >
                  Cancelar
                </Button>
              </>
            )}
            {isStaff && appt.status === "confirmada" && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={busyId === appt.id}
                  onClick={() => handleSendReminder(appt.id)}
                >
                  Lembrete
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isLoading={busyId === appt.id}
                  onClick={() => handleStaffCancel(appt.id)}
                >
                  Cancelar
                </Button>
              </>
            )}
            {canManageRecurrence &&
              appt.seriesId &&
              (appt.status === "pendente" || appt.status === "confirmada") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setScopeDialog({
                      mode: "edit",
                      appointmentId: appt.id,
                      seriesId: appt.seriesId!,
                      date: appt.date,
                      startTime: appt.startTime,
                      professionalId: appt.professionalId,
                      insuranceId: appt.insuranceId,
                    })
                  }
                >
                  Recorrência
                </Button>
              )}
            {isStaff &&
              !appt.seriesId &&
              (appt.status === "pendente" || appt.status === "confirmada") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setAttachDialog({
                      appointmentId: appt.id,
                      date: appt.date,
                      professionalId: appt.professionalId,
                      insuranceId: appt.insuranceId,
                      modality: appt.modality,
                    })
                  }
                >
                  Recorrência
                </Button>
              )}
            {isAdmin && appt.seriesId && (appt.status === "pendente" || appt.status === "confirmada") && (
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  setScopeDialog({
                    mode: "delete",
                    appointmentId: appt.id,
                    seriesId: appt.seriesId!,
                    date: appt.date,
                    startTime: appt.startTime,
                    professionalId: appt.professionalId,
                    insuranceId: appt.insuranceId,
                  })
                }
              >
                Excluir
              </Button>
            )}
            {isPatient && (appt.status === "pendente" || appt.status === "confirmada") && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={busyId === appt.id}
                  onClick={() => handleReschedule(appt.id)}
                >
                  Remarcar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isLoading={busyId === appt.id}
                  onClick={() => handleCancel(appt.id)}
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Control Bar: Search & Status Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Pesquisar por paciente, médico ou convênio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            { id: "todos", label: "Todos" },
            { id: "pendente", label: "Pendentes" },
            { id: "confirmada", label: "Confirmados" },
            { id: "concluida", label: "Concluídos" },
            { id: "cancelada", label: "Cancelados" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-xl px-3 py-1.5 font-semibold transition-all ${
                statusFilter === tab.id
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "bg-card-elevated/40 text-text-secondary hover:text-text-primary hover:bg-card-elevated"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
          Nenhum atendimento encontrado com esses filtros.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                {isStaff && <th className="px-5 py-3.5 font-bold">Paciente</th>}
                <th className="px-5 py-3.5 font-bold">Profissional</th>
                <th className="px-5 py-3.5 font-bold">Tipo de Atendimento</th>
                <th className="px-5 py-3.5 font-bold">Data/Hora</th>
                <th className="px-5 py-3.5 font-bold">Valor</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                {isStaff && <th className="px-5 py-3.5 font-bold">Lembrete</th>}
                <th className="px-5 py-3.5 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {appointmentGroups.map((group) => {
                const isExpanded = group.seriesId ? expandedSeries.has(group.seriesId) : false;

                return (
                  <Fragment key={group.key}>
                    {renderAppointmentRow(group.primary, {
                      otherCount: group.others.length,
                      isExpanded,
                      onToggleExpand: group.seriesId ? () => toggleSeriesExpanded(group.seriesId!) : undefined,
                    })}
                    {isExpanded &&
                      group.others.map((appt) => renderAppointmentRow(appt, { isSub: true }))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {scopeDialog && (
        <RecurrenceScopeDialog
          mode={scopeDialog.mode}
          appointmentId={scopeDialog.appointmentId}
          seriesId={scopeDialog.seriesId}
          currentDate={scopeDialog.date}
          currentStartTime={scopeDialog.startTime}
          professionalId={scopeDialog.professionalId}
          insuranceId={scopeDialog.insuranceId}
          onClose={() => setScopeDialog(null)}
          onDone={handleScopeDialogDone}
        />
      )}

      {attachDialog && (
        <AttachRecurrenceDialog
          appointmentId={attachDialog.appointmentId}
          date={attachDialog.date}
          professionalId={attachDialog.professionalId}
          insuranceId={attachDialog.insuranceId}
          modality={attachDialog.modality ?? undefined}
          onClose={() => setAttachDialog(null)}
          onDone={handleAttachDialogDone}
        />
      )}
    </div>
  );
}

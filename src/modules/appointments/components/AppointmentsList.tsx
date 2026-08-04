"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/whatsapp";
import type { Role } from "@/lib/supabase/types";
import type { AppointmentView } from "@/modules/appointments/services/appointment-queries";
import {
  cancelAppointment,
  confirmAppointment,
  sendReminder,
  updateAppointmentStatus,
} from "@/modules/appointments/services/booking-actions";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
  concluida: "Concluída",
  faltou: "Faltou",
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "premium"> = {
  pendente: "warning",
  confirmada: "success",
  cancelada: "neutral",
  remarcada: "neutral",
  concluida: "success",
  faltou: "danger",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function AppointmentsList({
  viewerRole,
  appointments,
}: {
  viewerRole: Role;
  appointments: AppointmentView[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const isStaff = viewerRole === "admin" || viewerRole === "recepcionista";
  const isPatient = viewerRole === "paciente";

  async function handleCancel(id: string) {
    const confirmed = await confirm({
      title: "Cancelar esta consulta?",
      description: "O horário será liberado e o paciente poderá agendar novamente.",
      confirmLabel: "Cancelar consulta",
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
    toast.success("Consulta cancelada com sucesso.");
    if (result.whatsappLink) window.open(result.whatsappLink, "_blank");
    router.refresh();
  }

  async function handleReschedule(id: string) {
    const confirmed = await confirm({
      title: "Remarcar esta consulta?",
      description: "A consulta atual será cancelada e você escolherá um novo horário.",
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
  }

  async function handleConfirm(id: string) {
    setBusyId(id);
    const result = await confirmAppointment(id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Consulta confirmada com sucesso.");
    if (result.whatsappLink) {
      window.open(result.whatsappLink, "_blank");
    }
    router.refresh();
  }

  async function handleStaffCancel(id: string) {
    const confirmed = await confirm({
      title: "Cancelar esta consulta?",
      description: "O horário será liberado na agenda do profissional.",
      confirmLabel: "Cancelar consulta",
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
    toast.success("Consulta cancelada com sucesso.");
    router.refresh();
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#255044] bg-[#102A22] p-12 text-center text-sm font-medium text-[#C8D4CF]">
        Nenhuma consulta encontrada.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-2xl border border-[#255044] bg-[#102A22] shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[#255044] bg-[#17382D]/80 text-xs font-bold uppercase tracking-wider text-[#C8D4CF]">
            <tr>
              {isStaff && <th className="px-5 py-4 font-bold">Paciente</th>}
              <th className="px-5 py-4 font-bold">Profissional</th>
              <th className="px-5 py-4 font-bold">Convênio</th>
              <th className="px-5 py-4 font-bold">Data/Hora</th>
              <th className="px-5 py-4 font-bold">Valor</th>
              <th className="px-5 py-4 font-bold">Status</th>
              <th className="px-5 py-4 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#255044]/40">
            {appointments.map((appt) => (
              <tr key={appt.id} className="transition-colors hover:bg-[#17382D]/50">
                {isStaff && <td className="px-5 py-4 font-semibold text-[#F5F7F6]">{appt.patientName}</td>}
                <td className="px-5 py-4 font-semibold text-[#F5F7F6]">{appt.professionalName}</td>
                <td className="px-5 py-4 text-[#C8D4CF]">{appt.insuranceName}</td>
                <td className="px-5 py-4 text-[#C8D4CF]">
                  {dateFormatter.format(new Date(`${appt.date}T00:00:00`))} <span className="font-semibold text-[#F5F7F6]">{appt.startTime.slice(0, 5)}</span>
                </td>
                <td className="px-5 py-4 font-medium text-[#C8D4CF]">{formatCurrency(appt.value)}</td>
                <td className="px-5 py-4">
                  <Badge tone={STATUS_TONE[appt.status] ?? "neutral"}>
                    {STATUS_LABELS[appt.status] ?? appt.status}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    {isStaff && appt.status === "pendente" && (
                      <>
                        <Button
                          size="sm"
                          isLoading={busyId === appt.id}
                          onClick={() => handleConfirm(appt.id)}
                        >
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


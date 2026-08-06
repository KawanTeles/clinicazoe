"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/whatsapp";
import type { RequestView } from "@/modules/requests/services/request-queries";
import { approveRequest, rejectRequest } from "@/modules/requests/services/request-actions";

import { getAttendanceInfo } from "@/lib/attendance";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function RequestsList({ requests }: { requests: RequestView[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<RequestView | null>(null);

  async function handleApprove(id: string) {
    const confirmed = await confirm({
      title: "Aprovar esta solicitação?",
      description: "A consulta será criada na Agenda com status Confirmada e o paciente será notificado.",
      confirmLabel: "Aprovar",
    });
    if (!confirmed) return;
    setBusyId(id);
    const result = await approveRequest(id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Solicitação aprovada e consulta confirmada.");
    if (result.whatsappLink) window.open(result.whatsappLink, "_blank");
    setViewing(null);
    router.refresh();
  }

  async function handleReject(id: string) {
    const confirmed = await confirm({
      title: "Recusar esta solicitação?",
      description: "O paciente será notificado de que a solicitação não foi aprovada.",
      confirmLabel: "Recusar",
      tone: "danger",
    });
    if (!confirmed) return;
    setBusyId(id);
    const result = await rejectRequest(id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Solicitação recusada.");
    if (result.whatsappLink) window.open(result.whatsappLink, "_blank");
    setViewing(null);
    router.refresh();
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
        Nenhuma solicitação pendente por aqui. Novos pedidos da Área do Cliente aparecem automaticamente.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-5 py-3.5 font-bold">Paciente</th>
              <th className="px-5 py-3.5 font-bold">Profissional</th>
              <th className="px-5 py-3.5 font-bold">Especialidade</th>
              <th className="px-5 py-3.5 font-bold">Tipo de Atendimento</th>
              <th className="px-5 py-3.5 font-bold">Data/Hora</th>
              <th className="px-5 py-3.5 font-bold">Valor</th>
              <th className="px-5 py-3.5 font-bold">Solicitado em</th>
              <th className="px-5 py-3.5 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {requests.map((req) => {
              const attendance = getAttendanceInfo(req.insuranceName, req.paymentMethod);
              return (
                <tr key={req.id} className="transition-colors hover:bg-card-elevated/40">
                  <td className="px-5 py-4 font-bold text-text-primary">{req.patientName}</td>
                  <td className="px-5 py-4 font-semibold text-text-primary">{req.professionalName}</td>
                  <td className="px-5 py-4 text-text-secondary">{req.specialtyName}</td>
                  <td className="px-5 py-4 text-text-secondary">
                    <span className="font-semibold text-text-primary">{attendance.attendanceType}</span>
                    {attendance.isConvenio ? (
                      <span className="block text-xs text-text-muted">{attendance.insuranceName}</span>
                    ) : (
                      <span className="block text-xs text-text-muted">{attendance.paymentMethodLabel}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-text-secondary">
                    {dateFormatter.format(new Date(`${req.date}T00:00:00`))}{" "}
                    <span className="font-semibold text-text-primary">{req.startTime.slice(0, 5)}</span>
                  </td>
                  <td className="px-5 py-4 font-medium text-text-secondary">{formatCurrency(req.value)}</td>
                  <td className="px-5 py-4 text-text-secondary">{dateTimeFormatter.format(new Date(req.requestedAt))}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setViewing(req)}>
                        Visualizar
                      </Button>
                      <Button size="sm" isLoading={busyId === req.id} onClick={() => handleApprove(req.id)}>
                        Aprovar
                      </Button>
                      <Button size="sm" variant="danger" isLoading={busyId === req.id} onClick={() => handleReject(req.id)}>
                        Recusar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={viewing !== null}
        onClose={() => setViewing(null)}
        title="Detalhes da Solicitação"
        subtitle={viewing?.patientName}
        size="md"
        footer={
          viewing && (
            <>
              <Button variant="danger" isLoading={busyId === viewing.id} onClick={() => handleReject(viewing.id)}>
                Recusar
              </Button>
              <Button isLoading={busyId === viewing.id} onClick={() => handleApprove(viewing.id)}>
                Aprovar
              </Button>
            </>
          )
        }
      >
        {viewing && (() => {
          const attendance = getAttendanceInfo(viewing.insuranceName, viewing.paymentMethod);
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-text-muted">Paciente</span>
                <p className="font-bold text-text-primary">{viewing.patientName}</p>
                <p className="text-xs text-text-secondary">{viewing.patientPhone ?? "Sem telefone cadastrado"}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Profissional</span>
                <p className="font-bold text-text-primary">{viewing.professionalName}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Especialidade</span>
                <p className="font-bold text-text-primary">{viewing.specialtyName || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Tipo de Atendimento</span>
                <p className="font-bold text-text-primary">{attendance.attendanceType}</p>
              </div>
              {attendance.isConvenio ? (
                <div>
                  <span className="text-xs text-text-muted">Convênio</span>
                  <p className="font-bold text-text-primary">{attendance.insuranceName}</p>
                </div>
              ) : (
                <div>
                  <span className="text-xs text-text-muted">Forma de Pagamento</span>
                  <p className="font-bold text-text-primary">{attendance.paymentMethodLabel}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-text-muted">Data & Horário</span>
                <p className="font-bold text-[var(--primary)]">
                  {dateFormatter.format(new Date(`${viewing.date}T00:00:00`))} às {viewing.startTime.slice(0, 5)}
                </p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Valor da consulta</span>
                <p className="font-black text-text-primary">{formatCurrency(viewing.value)}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Solicitado em</span>
                <p className="font-bold text-text-primary">{dateTimeFormatter.format(new Date(viewing.requestedAt))}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Status</span>
                <p>
                  <Badge tone="warning">Pendente</Badge>
                </p>
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}

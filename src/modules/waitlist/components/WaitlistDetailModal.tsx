"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { MODALITY_LABELS } from "@/lib/constants";
import {
  markContacted,
  offerSlot,
  markNoInterest,
  cancelWaitlistEntry,
} from "@/modules/waitlist/services/waitlist-actions";
import type { WaitlistListItem } from "@/modules/waitlist/services/waitlist-queries";
import { STATUS_LABELS, STATUS_TONES } from "./WaitlistTable";

const PERIOD_LABELS: Record<string, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
const DAY_LABELS: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

interface WaitlistDetailModalProps {
  entry: WaitlistListItem;
  onClose: () => void;
  canManage: boolean;
}

export function WaitlistDetailModal({ entry, onClose, canManage }: WaitlistDetailModalProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [offering, setOffering] = useState(false);
  const [offerDate, setOfferDate] = useState("");
  const [offerTime, setOfferTime] = useState("");

  function refreshAndClose() {
    router.refresh();
    onClose();
  }

  async function handleMarkContacted() {
    setBusy(true);
    const res = await markContacted(entry.id);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Contato registrado.");
    refreshAndClose();
  }

  async function handleOfferSlot() {
    if (!offerDate || !offerTime) {
      toast.error("Informe a data e o horário da vaga.");
      return;
    }
    setBusy(true);
    const res = await offerSlot(entry.id, { date: offerDate, startTime: offerTime });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.whatsappLink) window.open(res.whatsappLink, "_blank");
    toast.success("Vaga oferecida ao paciente.");
    refreshAndClose();
  }

  async function handleNoInterest() {
    const confirmed = await confirm({
      title: "Marcar como sem interesse?",
      description: "O paciente sai da fila ativa da Lista de Espera.",
      confirmLabel: "Marcar sem interesse",
      tone: "danger",
    });
    if (!confirmed) return;
    setBusy(true);
    const res = await markNoInterest(entry.id);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    refreshAndClose();
  }

  async function handleCancel() {
    const confirmed = await confirm({
      title: "Cancelar este registro?",
      description: "O registro sai da Lista de Espera ativa.",
      confirmLabel: "Cancelar registro",
      tone: "danger",
    });
    if (!confirmed) return;
    setBusy(true);
    const res = await cancelWaitlistEntry(entry.id);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    refreshAndClose();
  }

  const scheduleHref = `/appointments/new?patientId=${entry.patientId}&insuranceId=${entry.insuranceId}${
    entry.professionalId ? `&professionalId=${entry.professionalId}` : ""
  }${entry.modality ? `&modality=${entry.modality}` : ""}&waitlistId=${entry.id}`;

  const timeline = [
    { label: "Entrou na lista", at: entry.createdAt },
    { label: "Contato realizado", at: entry.contactedAt },
    { label: "Vaga oferecida", at: entry.offeredAt },
    { label: "Agendamento aceito", at: entry.acceptedAt },
    { label: "Recusado / sem interesse", at: entry.declinedAt },
  ].filter((t) => t.at);

  return (
    <Modal isOpen onClose={onClose} title={entry.patientName} subtitle={entry.patientPhone} size="lg">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONES[entry.status]}>{STATUS_LABELS[entry.status]}</Badge>
          {entry.periodPreference && <Badge tone="neutral">Período: {PERIOD_LABELS[entry.periodPreference]}</Badge>}
          {entry.preferredDays.length > 0 && (
            <Badge tone="neutral">
              Dias: {entry.preferredDays.slice().sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(", ")}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card-elevated/70 p-5 text-xs sm:grid-cols-2">
          <div>
            <span className="text-text-muted">Especialidade:</span>
            <p className="mt-0.5 text-sm font-bold text-text-primary">{entry.specialtyName || "—"}</p>
          </div>
          <div>
            <span className="text-text-muted">Profissional desejado:</span>
            <p className="mt-0.5 text-sm font-bold text-text-primary">{entry.professionalName || "Sem preferência"}</p>
          </div>
          <div>
            <span className="text-text-muted">Convênio:</span>
            <p className="mt-0.5 text-sm font-bold text-text-primary">{entry.insuranceName || "—"}</p>
          </div>
          <div>
            <span className="text-text-muted">Modalidade:</span>
            <p className="mt-0.5 text-sm font-bold text-text-primary">
              {entry.modality ? MODALITY_LABELS[entry.modality] : "—"}
            </p>
          </div>
          <div>
            <span className="text-text-muted">E-mail:</span>
            <p className="mt-0.5 text-sm font-bold text-text-primary">{entry.patientEmail || "—"}</p>
          </div>
        </div>

        {entry.notes && (
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Observações</span>
            <p className="mt-1 text-sm text-text-secondary">{entry.notes}</p>
          </div>
        )}

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Histórico</span>
          <div className="mt-2 space-y-2 border-l-2 border-border pl-4">
            {timeline.map((t) => (
              <div key={t.label} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                <p className="text-xs font-bold text-text-primary">{t.label}</p>
                <p className="text-[11px] text-text-muted">{dateTimeFormatter.format(new Date(t.at as string))}</p>
              </div>
            ))}
          </div>
        </div>

        {canManage && entry.status !== "agendado" && entry.status !== "cancelado" && (
          <div className="space-y-4 border-t border-border/80 pt-5">
            {offering ? (
              <div className="space-y-3 rounded-xl border border-primary/40 bg-[var(--badge-bg)] p-4">
                <p className="text-xs font-bold text-text-primary">Data e horário da vaga a oferecer:</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={offerDate} onChange={(e) => setOfferDate(e.target.value)} />
                  <Input type="time" value={offerTime} onChange={(e) => setOfferTime(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setOffering(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleOfferSlot} isLoading={busy}>
                    Enviar oferta pelo WhatsApp
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {entry.status === "aguardando" && (
                  <Button variant="secondary" size="sm" onClick={handleMarkContacted} isLoading={busy}>
                    Marcar contato realizado
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => setOffering(true)}>
                  Oferecer Vaga
                </Button>
                <Link href={scheduleHref}>
                  <Button size="sm" className="font-bold">
                    Agendar Consulta
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleNoInterest} isLoading={busy}>
                  Sem interesse
                </Button>
                <Button variant="danger" size="sm" onClick={handleCancel} isLoading={busy}>
                  Cancelar registro
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

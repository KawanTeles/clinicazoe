"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { addCoTherapist, markCoTherapistAbsence, removeCoTherapist } from "@/modules/appointments/services/booking-actions";
import { MarkAbsenceDialog } from "@/modules/appointments/components/MarkAbsenceDialog";
import type { CoTherapistInfo } from "@/modules/appointments/services/booking-queries";
import type { AbsenceStatus } from "@/lib/supabase/types";

interface ProfessionalOption {
  id: string;
  fullName: string;
}

interface CoTherapistManagerProps {
  appointmentId: string;
  coTherapists: CoTherapistInfo[];
  availableProfessionals: ProfessionalOption[];
  /** Admin, recepção ou o profissional principal — decisão de negócio já
   * confirmada para o atendimento compartilhado (Fase 2). */
  canManage: boolean;
  /** Usado para decidir quem pode marcar a falta de CADA coterapeuta: só o
   * próprio (falta é autoral, migração 0067) ou staff — nunca o principal,
   * mesmo que ele possa gerenciar quem entra/sai da lista. */
  viewerId: string;
  isStaff: boolean;
}

/** Lista e gerencia os coterapeutas de uma consulta — atendimento
 * compartilhado (Fase 2). Edição/cancelamento da consulta em si continua
 * exclusivo do profissional principal ou da equipe; isto aqui só adiciona
 * ou remove o vínculo de coterapeuta, e agora também deixa cada coterapeuta
 * marcar a própria falta (normal ou justificada) dentro da sessão. */
export function CoTherapistManager({
  appointmentId,
  coTherapists,
  availableProfessionals,
  canManage,
  viewerId,
  isStaff,
}: CoTherapistManagerProps) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [absenceTargetId, setAbsenceTargetId] = useState<string | null>(null);
  const [markingAbsence, setMarkingAbsence] = useState(false);

  const linkedIds = new Set(coTherapists.map((c) => c.professionalId));
  const options = availableProfessionals.filter((p) => !linkedIds.has(p.id));

  async function handleAdd() {
    if (!selected) return;
    setAdding(true);
    const result = await addCoTherapist(appointmentId, selected);
    setAdding(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Coterapeuta adicionado.");
    setSelected("");
    router.refresh();
  }

  async function handleRemove(professionalId: string, fullName: string) {
    const confirmed = await confirm({
      title: `Remover ${fullName}?`,
      description: "Ele deixará de ter acesso a este atendimento. Se já tiver registrado evolução, a remoção não é permitida.",
      confirmLabel: "Remover",
      tone: "danger",
    });
    if (!confirmed) return;

    setRemovingId(professionalId);
    const result = await removeCoTherapist(appointmentId, professionalId);
    setRemovingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Coterapeuta removido.");
    router.refresh();
  }

  async function handleMarkAbsence(status: AbsenceStatus, reason?: string) {
    if (!absenceTargetId) return;
    setMarkingAbsence(true);
    const result = await markCoTherapistAbsence(appointmentId, absenceTargetId, status, reason);
    setMarkingAbsence(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(status === "faltou_justificada" ? "Falta justificada registrada." : "Falta registrada.");
    router.refresh();
  }

  if (!canManage && coTherapists.length === 0) return null;

  const absenceTarget = coTherapists.find((c) => c.professionalId === absenceTargetId) ?? null;

  return (
    <div className="sm:col-span-2">
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Coterapeutas</p>

      {coTherapists.length === 0 ? (
        <p className="mt-1 text-sm text-text-primary">—</p>
      ) : (
        <div className="mt-1.5 flex flex-col gap-2">
          {coTherapists.map((c) => {
            const canMarkAbsence = c.professionalId === viewerId || isStaff;
            return (
              <div key={c.professionalId} className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">
                  {c.fullName}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleRemove(c.professionalId, c.fullName)}
                      disabled={removingId === c.professionalId}
                      aria-label={`Remover ${c.fullName}`}
                      className="-mr-1 text-text-muted transition-colors hover:text-danger disabled:opacity-50"
                    >
                      ×
                    </button>
                  )}
                </Badge>
                {c.absenceStatus && (
                  <Badge
                    tone={c.absenceStatus === "faltou_justificada" ? "warning" : "danger"}
                    className="text-[10px]"
                    title={c.absenceReason ?? undefined}
                  >
                    {c.absenceStatus === "faltou_justificada" ? "Falta justificada" : "Faltou"}
                  </Badge>
                )}
                {canMarkAbsence && (
                  <Button size="sm" variant="ghost" onClick={() => setAbsenceTargetId(c.professionalId)}>
                    Marcar falta
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManage && options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-9 max-w-[240px]"
          >
            <option value="">Selecione um profissional</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="secondary" isLoading={adding} disabled={!selected} onClick={handleAdd}>
            Adicionar coterapeuta
          </Button>
        </div>
      )}

      <MarkAbsenceDialog
        isOpen={absenceTargetId !== null}
        onClose={() => setAbsenceTargetId(null)}
        onConfirm={handleMarkAbsence}
        isSubmitting={markingAbsence}
        subjectLabel={absenceTarget?.fullName}
      />
    </div>
  );
}

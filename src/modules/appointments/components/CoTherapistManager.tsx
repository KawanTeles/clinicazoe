"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { addCoTherapist, removeCoTherapist } from "@/modules/appointments/services/booking-actions";
import type { CoTherapistInfo } from "@/modules/appointments/services/booking-queries";

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
}

/** Lista e gerencia os coterapeutas de uma consulta — atendimento
 * compartilhado (Fase 2). Edição/cancelamento da consulta em si continua
 * exclusivo do profissional principal ou da equipe; isto aqui só adiciona
 * ou remove o vínculo de coterapeuta. */
export function CoTherapistManager({
  appointmentId,
  coTherapists,
  availableProfessionals,
  canManage,
}: CoTherapistManagerProps) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

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
      description: "Ele deixará de ter acesso a esta consulta. Se já tiver registrado evolução, a remoção não é permitida.",
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

  if (!canManage && coTherapists.length === 0) return null;

  return (
    <div className="sm:col-span-2">
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Coterapeutas</p>

      {coTherapists.length === 0 ? (
        <p className="mt-1 text-sm text-text-primary">—</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {coTherapists.map((c) => (
            <Badge key={c.professionalId} tone="neutral">
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
          ))}
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
    </div>
  );
}

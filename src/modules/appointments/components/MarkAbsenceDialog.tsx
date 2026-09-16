"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { AbsenceStatus } from "@/lib/supabase/types";

interface MarkAbsenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: AbsenceStatus, reason?: string) => Promise<void> | void;
  /** Nome de quem está tendo a falta marcada — só para deixar o título claro
   * em telas com mais de um participante (ex.: falta de um coterapeuta). */
  subjectLabel?: string;
  isSubmitting?: boolean;
}

/** Dialog reutilizável para marcar falta — normal ou justificada, com motivo
 * obrigatório na justificada. Usado tanto pelo atendimento principal
 * (AppointmentsList) quanto pela falta de um coterapeuta específico
 * (CoTherapistManager), migração 0067. */
export function MarkAbsenceDialog({
  isOpen,
  onClose,
  onConfirm,
  subjectLabel,
  isSubmitting = false,
}: MarkAbsenceDialogProps) {
  const [status, setStatus] = useState<AbsenceStatus>("faltou");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setStatus("faltou");
    setReason("");
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (status === "faltou_justificada" && !reason.trim()) {
      setError("Informe o motivo da falta justificada.");
      return;
    }
    setError(null);
    await onConfirm(status, reason.trim() || undefined);
    handleClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Marcar falta"
      subtitle={subjectLabel}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="danger" size="sm" onClick={handleSubmit} isLoading={isSubmitting}>
            Marcar falta
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setStatus("faltou")}
            className={`rounded-xl border px-3.5 py-3 text-left text-xs font-semibold transition-colors ${
              status === "faltou"
                ? "border-danger bg-danger/10 text-danger"
                : "border-border bg-card-elevated text-text-secondary hover:border-danger/50"
            }`}
          >
            Faltou
            <p className="mt-1 text-[10px] font-medium text-text-muted">
              Não avisou — entra no controle de faltas.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setStatus("faltou_justificada")}
            className={`rounded-xl border px-3.5 py-3 text-left text-xs font-semibold transition-colors ${
              status === "faltou_justificada"
                ? "border-warning bg-warning/10 text-warning"
                : "border-border bg-card-elevated text-text-secondary hover:border-warning/50"
            }`}
          >
            Faltou (justificada)
            <p className="mt-1 text-[10px] font-medium text-text-muted">
              Avisou antes — fica no histórico, fora do controle de faltas.
            </p>
          </button>
        </div>

        <Textarea
          label={status === "faltou_justificada" ? "Motivo (obrigatório)" : "Motivo (opcional)"}
          placeholder="Como/quando o paciente avisou, ou observações sobre a falta..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

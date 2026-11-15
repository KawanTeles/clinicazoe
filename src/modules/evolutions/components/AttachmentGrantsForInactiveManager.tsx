"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  grantAttachmentAccess,
  loadPatientsWithAttachmentsForInactiveAuthor,
} from "@/modules/evolutions/services/grant-actions";
import type { PatientWithAttachments, ProfessionalOption } from "@/modules/evolutions/services/grant-queries";

/**
 * Liberação de anexo de evolução quando o autor está INATIVO (saiu da
 * clínica) — a Coordenação é quem pode liberar nesse caso (gatilho
 * attachment_access_grants_validate, migração 0084). Sempre uma liberação
 * TOTAL (todos os anexos daquele autor, daquele paciente) — a Coordenação
 * nunca vê o anexo em si pra escolher "só este", só a contagem (RPC
 * get_patients_with_evolution_attachments).
 */
export function AttachmentGrantsForInactiveManager({
  inactiveProfessionals,
  activeProfessionals,
}: {
  inactiveProfessionals: ProfessionalOption[];
  activeProfessionals: ProfessionalOption[];
}) {
  const [authorId, setAuthorId] = useState("");
  const [patients, setPatients] = useState<PatientWithAttachments[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [granteeId, setGranteeId] = useState("");
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setPatientId("");
    setPatients([]);
    if (!authorId) return;
    setLoadingPatients(true);
    (async () => {
      const result = await loadPatientsWithAttachmentsForInactiveAuthor(authorId);
      setPatients(result);
      setLoadingPatients(false);
    })();
  }, [authorId]);

  async function handleSubmit() {
    if (!authorId || !patientId || !granteeId || !justification.trim()) {
      setError("Preencha todos os campos.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = await grantAttachmentAccess({
      patientId,
      authorProfessionalId: authorId,
      grantedToProfessionalId: granteeId,
      justification,
      attachmentId: null,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setJustification("");
    setGranteeId("");
  }

  if (inactiveProfessionals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-text-secondary">Nenhum profissional inativo no momento.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
      <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
        Profissional inativo (autor dos anexos)
        <select
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-card-elevated px-3 text-xs font-medium normal-case text-text-primary"
        >
          <option value="">Selecione</option>
          {inactiveProfessionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
      </label>

      {authorId && (
        <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
          Paciente
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            disabled={loadingPatients}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-card-elevated px-3 text-xs font-medium normal-case text-text-primary"
          >
            <option value="">{loadingPatients ? "Carregando..." : "Selecione"}</option>
            {patients.map((p) => (
              <option key={p.patientId} value={p.patientId}>
                {p.patientName} ({p.attachmentCount} anexo{p.attachmentCount === 1 ? "" : "s"})
              </option>
            ))}
          </select>
          {!loadingPatients && patients.length === 0 && (
            <span className="mt-1 block text-[11px] font-normal text-text-muted">
              Este profissional não tem anexo de evolução registrado.
            </span>
          )}
        </label>
      )}

      {patientId && (
        <>
          <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            Liberar para
            <select
              value={granteeId}
              onChange={(e) => setGranteeId(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-card-elevated px-3 text-xs font-medium normal-case text-text-primary"
            >
              <option value="">Selecione</option>
              {activeProfessionals
                .filter((p) => p.id !== authorId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
            </select>
          </label>

          <Textarea label="Motivo" rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} />

          {error && <p className="text-xs font-semibold text-danger">{error}</p>}
          {success && <p className="text-xs font-semibold text-success">Acesso liberado.</p>}

          <div className="flex justify-end">
            <Button type="button" isLoading={saving} onClick={handleSubmit}>
              Liberar acesso
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  loadAttachmentAccessPanelData,
  type AttachmentAccessPanelData,
} from "@/modules/evolutions/services/attachment-access-actions";
import { getEvolutionAttachmentDownloadUrl } from "@/modules/evolutions/services/attachment-actions";
import { grantAttachmentAccess, revokeAttachmentGrant } from "@/modules/evolutions/services/grant-actions";
import type { EvolutionAttachmentKind } from "@/lib/supabase/types";

const KIND_LABEL: Record<EvolutionAttachmentKind, string> = {
  imagem: "Imagem",
  documento: "Documento",
  audio: "Áudio",
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * Anexos de uma evolução já assinada — visível só para o autor (D3); outro
 * profissional vinculado só vê o que foi explicitamente liberado para ele
 * (a RLS filtra isso sozinha, este componente só exibe o que o servidor
 * já decidiu mostrar). Controles de "Liberar acesso" só aparecem para quem
 * `loadAttachmentAccessPanelData` confirmou ser o autor.
 */
export function AttachmentAccessPanel({ evolutionId }: { evolutionId: string }) {
  const [data, setData] = useState<AttachmentAccessPanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [grantTo, setGrantTo] = useState("");
  const [grantScope, setGrantScope] = useState<"all" | string>("all");
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const result = await loadAttachmentAccessPanelData(evolutionId);
    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [evolutionId]);

  async function handleOpen(id: string) {
    const result = await getEvolutionAttachmentDownloadUrl(id);
    if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleGrant() {
    if (!data || !grantTo || !justification.trim()) {
      setError("Escolha o profissional e informe o motivo da liberação.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await grantAttachmentAccess({
      patientId: data.patientId,
      authorProfessionalId: data.authorProfessionalId,
      grantedToProfessionalId: grantTo,
      justification,
      attachmentId: grantScope === "all" ? null : grantScope,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowGrantForm(false);
    setGrantTo("");
    setJustification("");
    setGrantScope("all");
    await reload();
  }

  async function handleRevoke(id: string) {
    setError(null);
    const result = await revokeAttachmentGrant(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    await reload();
  }

  if (loading || !data || data.attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card-elevated/40 p-4 print:hidden">
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Anexos</p>

      <ul className="flex flex-col gap-1.5">
        {data.attachments.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs"
          >
            <button type="button" onClick={() => handleOpen(a.id)} className="truncate text-left font-medium text-text-primary hover:underline">
              {KIND_LABEL[a.kind]} · {a.fileName}
            </button>
          </li>
        ))}
      </ul>

      {data.isAuthor && (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
          {data.activeGrants.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Acesso liberado para</p>
              {data.activeGrants.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs">
                  <span>
                    <span className="font-semibold">{g.grantedToName}</span>
                    <span className="text-text-muted"> — {g.justification}</span>
                  </span>
                  <button type="button" onClick={() => handleRevoke(g.id)} className="shrink-0 font-semibold text-danger hover:underline">
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          )}

          {showGrantForm ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Liberar para
                <select
                  value={grantTo}
                  onChange={(e) => setGrantTo(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-card-elevated px-2 text-xs font-medium normal-case text-text-primary"
                >
                  <option value="">Selecione um profissional</option>
                  {data.colleagues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Quais anexos
                <select
                  value={grantScope}
                  onChange={(e) => setGrantScope(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-card-elevated px-2 text-xs font-medium normal-case text-text-primary"
                >
                  <option value="all">Todos os anexos deste paciente (inclusive futuros)</option>
                  {data.attachments.map((a) => (
                    <option key={a.id} value={a.id}>
                      Só {KIND_LABEL[a.kind].toLowerCase()} · {a.fileName}
                    </option>
                  ))}
                </select>
              </label>

              <Textarea label="Motivo" rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} />

              {error && <p className="text-xs font-semibold text-danger">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setShowGrantForm(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" isLoading={saving} onClick={handleGrant}>
                  Liberar
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setShowGrantForm(true)}>
              Liberar acesso para outro profissional
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

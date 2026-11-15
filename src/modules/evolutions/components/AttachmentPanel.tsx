"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConsentCollectionModal } from "@/modules/evolutions/components/ConsentCollectionModal";
import {
  deleteEvolutionAttachment,
  getEvolutionAttachmentDownloadUrl,
  loadAttachmentsForDraft,
  uploadEvolutionAttachment,
} from "@/modules/evolutions/services/attachment-actions";
import type { EvolutionAttachmentView } from "@/modules/evolutions/services/attachment-queries";
import type { EvolutionAttachmentKind } from "@/lib/supabase/types";

interface AttachmentPanelProps {
  appointmentId: string;
  patientId: string;
  draftId: string | null;
  onDraftIdResolved: (id: string) => void;
}

const KIND_LABEL: Record<EvolutionAttachmentKind, string> = {
  imagem: "Imagem",
  documento: "Documento",
  audio: "Áudio",
};

const KIND_ACCEPT: Record<EvolutionAttachmentKind, string> = {
  imagem: "image/png,image/jpeg,image/webp",
  documento: "application/pdf",
  audio: "audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/m4a,audio/wav,audio/x-wav,audio/webm",
};

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * "Anexar" (item 6/D1 do pedido original) — vive na etapa de rascunho da
 * Evolução Rápida, nunca no Modo detalhado (que submete direto, sem
 * rascunho intermediário; ver draft-actions.ts). Imagem/áudio sem termo
 * vigente abre o `ConsentCollectionModal` em vez de um erro seco — assim
 * que o termo é colhido, reenvia automaticamente o MESMO arquivo, sem o
 * profissional precisar selecioná-lo de novo.
 */
export function AttachmentPanel({ appointmentId, patientId, draftId, onDraftIdResolved }: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<EvolutionAttachmentView[]>([]);
  const [uploadingKind, setUploadingKind] = useState<EvolutionAttachmentKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ kind: EvolutionAttachmentKind; file: File } | null>(null);
  const inputs = useRef<Partial<Record<EvolutionAttachmentKind, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (!draftId) return;
    let cancelado = false;
    (async () => {
      const list = await loadAttachmentsForDraft(draftId);
      if (!cancelado) setAttachments(list);
    })();
    return () => {
      cancelado = true;
    };
  }, [draftId]);

  async function doUpload(kind: EvolutionAttachmentKind, file: File) {
    setUploadingKind(kind);
    setError(null);

    const formData = new FormData();
    formData.set("appointment_id", appointmentId);
    formData.set("kind", kind);
    formData.set("file", file);

    const result = await uploadEvolutionAttachment(formData);
    setUploadingKind(null);

    if (result.draftId && result.draftId !== draftId) onDraftIdResolved(result.draftId);

    if (result.error) {
      if (result.needsConsent) {
        setPending({ kind, file });
      } else {
        setError(result.error);
      }
      return;
    }

    if (result.attachment) setAttachments((prev) => [...prev, result.attachment!]);
  }

  function handleFileChange(kind: EvolutionAttachmentKind) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void doUpload(kind, file);
    };
  }

  async function handleRemove(id: string) {
    setError(null);
    const result = await deleteEvolutionAttachment(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleOpen(id: string) {
    const result = await getEvolutionAttachmentDownloadUrl(id);
    if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card-elevated/40 p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Anexos</p>

      {attachments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs"
            >
              <button
                type="button"
                onClick={() => handleOpen(a.id)}
                className="truncate text-left font-medium text-text-primary hover:underline"
              >
                {KIND_LABEL[a.kind]} · {a.fileName} ({formatBytes(a.fileSizeBytes)})
              </button>
              <button type="button" onClick={() => handleRemove(a.id)} className="shrink-0 font-semibold text-danger hover:underline">
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(KIND_LABEL) as EvolutionAttachmentKind[]).map((kind) => (
          <div key={kind}>
            <input
              ref={(el) => {
                inputs.current[kind] = el;
              }}
              type="file"
              accept={KIND_ACCEPT[kind]}
              className="hidden"
              onChange={handleFileChange(kind)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              isLoading={uploadingKind === kind}
              onClick={() => inputs.current[kind]?.click()}
            >
              Anexar {KIND_LABEL[kind].toLowerCase()}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-text-muted">
        Anexos ficam visíveis só para você. Imagem/áudio exigem termo de consentimento do responsável.
      </p>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <ConsentCollectionModal
        isOpen={pending !== null}
        patientId={patientId}
        onClose={() => setPending(null)}
        onCollected={() => {
          const toRetry = pending;
          setPending(null);
          if (toRetry) void doUpload(toRetry.kind, toRetry.file);
        }}
      />
    </div>
  );
}

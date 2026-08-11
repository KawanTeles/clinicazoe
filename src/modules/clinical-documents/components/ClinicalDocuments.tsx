"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  deleteClinicalDocument,
  getClinicalDocumentDownloadUrl,
  uploadClinicalDocument,
} from "@/modules/clinical-documents/services/clinical-document-actions";
import type { ClinicalDocumentView } from "@/modules/clinical-documents/services/clinical-document-queries";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WEBP",
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface EvolutionOption {
  id: string;
  label: string;
}

interface ClinicalDocumentsProps {
  patientId: string;
  initialDocuments: ClinicalDocumentView[];
  evolutionOptions: EvolutionOption[];
}

/** Aba "Documentos" da ficha do paciente (visão do profissional). Upload e
 * exclusão passam por Server Actions que já cuidam de logAudit e RLS de
 * dupla camada (tabela + storage) — este componente só orquestra o estado
 * otimista da lista. */
export function ClinicalDocuments({ patientId, initialDocuments, evolutionOptions }: ClinicalDocumentsProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [description, setDescription] = useState("");
  const [evolutionId, setEvolutionId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("patient_id", patientId);
    if (evolutionId) formData.set("evolution_id", evolutionId);
    if (description.trim()) formData.set("description", description.trim());

    const result = await uploadClinicalDocument(formData);
    setUploading(false);
    event.target.value = "";

    if (result.error || !result.id) {
      toast.error(result.error ?? "Não foi possível enviar o documento.");
      return;
    }

    toast.success("Documento enviado.");
    setDocuments((prev) => [
      {
        id: result.id!,
        patientId,
        evolutionId: evolutionId || null,
        description: description.trim() || null,
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setDescription("");
    setEvolutionId("");
  }

  async function handleOpen(id: string) {
    setOpeningId(id);
    const result = await getClinicalDocumentDownloadUrl(id);
    setOpeningId(null);

    if (result.error || !result.url) {
      toast.error(result.error ?? "Não foi possível abrir o documento.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(doc: ClinicalDocumentView) {
    const confirmed = await confirm({
      title: `Excluir "${doc.description || doc.fileName}"?`,
      description: "O arquivo será removido permanentemente. Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;

    setDeletingId(doc.id);
    const result = await deleteClinicalDocument(doc.id);
    setDeletingId(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Documento excluído.");
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-bold text-text-primary">Enviar documento</h3>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Descrição (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Laudo médico, exame de imagem..."
              className="mt-1 h-10 w-full rounded-lg border border-border bg-card-elevated px-3 text-sm text-text-primary"
            />
          </div>
          {evolutionOptions.length > 0 && (
            <div className="flex-1">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Vincular à evolução (opcional)
              </label>
              <select
                value={evolutionId}
                onChange={(e) => setEvolutionId(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card-elevated px-3 text-sm text-text-primary"
              >
                <option value="">Nenhuma</option>
                {evolutionOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Button
              type="button"
              variant="secondary"
              isLoading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Selecionar arquivo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-text-muted">PDF, PNG, JPEG ou WEBP até 10MB.</p>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm font-medium text-text-secondary">
          Nenhum documento enviado ainda.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-text-primary">{doc.description || doc.fileName}</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {TYPE_LABELS[doc.mimeType] ?? doc.mimeType} · {formatSize(doc.fileSizeBytes)} ·{" "}
                  {dateTimeFormatter.format(new Date(doc.createdAt))}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" isLoading={openingId === doc.id} onClick={() => handleOpen(doc.id)}>
                  Abrir
                </Button>
                <Button size="sm" variant="danger" isLoading={deletingId === doc.id} onClick={() => handleDelete(doc)}>
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

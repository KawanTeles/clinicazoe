"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SignaturePad } from "@/modules/evolutions/components/SignaturePad";
import { collectImageConsent, loadActiveConsentTemplate } from "@/modules/evolutions/services/consent-actions";
import type { ConsentTemplateView } from "@/modules/evolutions/services/consent-queries";

interface ConsentCollectionModalProps {
  isOpen: boolean;
  patientId: string;
  onClose: () => void;
  onCollected: () => void;
}

/**
 * Termo de imagem/áudio (item 7 do pedido original) — assinatura na tela OU
 * upload do termo já assinado em papel. Carrega o modelo vigente sob
 * demanda (não recebido por prop) porque pode ter sido publicado/alterado
 * entre a abertura da tela de evolução e o momento em que este modal abre.
 */
export function ConsentCollectionModal({ isOpen, patientId, onClose, onCollected }: ConsentCollectionModalProps) {
  const [template, setTemplate] = useState<ConsentTemplateView | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setGuardianName("");
    setGuardianRelationship("");
    setMode("draw");
    setSignatureDataUrl(null);
    setError(null);
    setLoadingTemplate(true);
    (async () => {
      const result = await loadActiveConsentTemplate();
      setTemplate(result);
      setLoadingTemplate(false);
    })();
  }, [isOpen]);

  async function handleSubmit() {
    if (!guardianName.trim() || !guardianRelationship.trim()) {
      setError("Informe o nome e o parentesco/vínculo do responsável.");
      return;
    }
    const file = fileInputRef.current?.files?.[0];
    if (mode === "draw" && !signatureDataUrl) {
      setError("Colete a assinatura na tela ou troque para \"Enviar termo assinado\".");
      return;
    }
    if (mode === "upload" && !file) {
      setError("Selecione o arquivo do termo assinado.");
      return;
    }

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.set("patient_id", patientId);
    formData.set("guardian_name", guardianName.trim());
    formData.set("guardian_relationship", guardianRelationship.trim());
    if (mode === "draw" && signatureDataUrl) {
      formData.set("signature_data_url", signatureDataUrl);
    } else if (file) {
      formData.set("signed_document", file);
    }

    const result = await collectImageConsent(formData);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    onCollected();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Termo de consentimento de imagem/áudio"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} isLoading={saving}>
            Confirmar termo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {loadingTemplate ? (
          <div className="h-24 w-full animate-pulse rounded-xl bg-card-elevated" />
        ) : template ? (
          <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-card-elevated/50 p-3.5">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{template.body}</p>
          </div>
        ) : (
          <p className="text-xs font-semibold text-danger">
            Nenhum modelo de termo publicado ainda. Avise a administração.
          </p>
        )}

        <Input
          label="Nome do responsável"
          value={guardianName}
          onChange={(e) => setGuardianName(e.target.value)}
          placeholder="Nome completo"
        />
        <Input
          label="Parentesco / vínculo"
          value={guardianRelationship}
          onChange={(e) => setGuardianRelationship(e.target.value)}
          placeholder="Ex.: mãe, pai, responsável legal"
        />

        <div className="flex gap-2">
          <Button type="button" size="sm" variant={mode === "draw" ? "primary" : "outline"} onClick={() => setMode("draw")}>
            Assinar na tela
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "upload" ? "primary" : "outline"}
            onClick={() => setMode("upload")}
          >
            Enviar termo assinado
          </Button>
        </div>

        {mode === "draw" ? (
          <SignaturePad onChange={setSignatureDataUrl} />
        ) : (
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="text-xs"
          />
        )}

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

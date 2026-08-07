"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { AIDisclaimerNotice } from "./AIDisclaimerNotice";
import { updateAIReport, duplicateAIReport, finalizeAIReport } from "@/modules/ai/services/reports-actions";
import { REPORT_TEMPLATE_LABELS } from "@/modules/ai/services/provider-types";
import type { AIReportDetail } from "@/modules/ai/services/reports-queries";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function downloadAsWord(title: string, content: string) {
  const bodyHtml = content
    .split("\n")
    .map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`)
    .join("");
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body><h1>${escapeHtml(title)}</h1>${bodyHtml}</body>
</html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportEditor({ report, canEdit }: { report: AIReportDetail; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [title, setTitle] = useState(report.title);
  const [content, setContent] = useState(report.content);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateAIReport({ id: report.id, title, content });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Relatório salvo.");
    router.refresh();
  }

  async function handleDuplicate() {
    setDuplicating(true);
    const result = await duplicateAIReport(report.id);
    setDuplicating(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Relatório duplicado.");
    router.push(`/reports/${result.reportId}`);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`${title}\n\n${content}`);
    toast.success("Texto copiado.");
  }

  async function handleFinalize() {
    const confirmed = await confirm({
      title: "Salvar no prontuário?",
      description: "O relatório ficará marcado como finalizado e visível no histórico do paciente.",
      confirmLabel: "Salvar no prontuário",
    });
    if (!confirmed) return;

    setFinalizing(true);
    const result = await finalizeAIReport(report.id);
    setFinalizing(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Relatório salvo no prontuário.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <AIDisclaimerNotice />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{REPORT_TEMPLATE_LABELS[report.template]}</Badge>
        <Badge tone={report.status === "finalized" ? "success" : "warning"}>
          {report.status === "finalized" ? "Salvo no prontuário" : "Rascunho"}
        </Badge>
        <span className="text-xs text-text-secondary">
          Paciente: <span className="font-semibold text-text-primary">{report.patientName}</span>
        </span>
      </div>

      <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
      <Textarea
        label="Conteúdo do relatório"
        rows={18}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={!canEdit}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
          Copiar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => window.open(`/reports/${report.id}/print`, "_blank")}>
          Exportar PDF
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => downloadAsWord(title, content)}>
          Exportar Word
        </Button>
        {canEdit && (
          <>
            <Button type="button" size="sm" variant="secondary" isLoading={duplicating} onClick={handleDuplicate}>
              Duplicar
            </Button>
            <Button type="button" size="sm" isLoading={saving} onClick={handleSave}>
              Salvar
            </Button>
            {report.status !== "finalized" && (
              <Button type="button" size="sm" variant="primary" isLoading={finalizing} onClick={handleFinalize}>
                Salvar no Prontuário
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

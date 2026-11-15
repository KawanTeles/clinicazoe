"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { saveConsentTemplate } from "@/modules/evolutions/services/consent-actions";
import type { ConsentTemplateHistoryItem } from "@/modules/evolutions/services/consent-queries";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const DEFAULT_PLACEHOLDER = `Ex.: Autorizo o Espaço Zoe a registrar imagens e/ou áudios do(a) paciente durante os atendimentos, exclusivamente para fins de acompanhamento clínico e evolução terapêutica, sem qualquer finalidade de divulgação ou publicação. Este consentimento pode ser revogado a qualquer momento, mediante solicitação por escrito, sem efeito retroativo sobre os registros já realizados.`;

/**
 * Editar aqui NUNCA sobrescreve o texto anterior — publica cria uma versão
 * NOVA (consent_templates é append-only, migração 0084); um termo já
 * assinado continua apontando pro texto exato da hora da assinatura, mesmo
 * que esta tela publique uma correção depois.
 */
export function ConsentTemplateManager({
  currentBody,
  history,
}: {
  currentBody: string | null;
  history: ConsentTemplateHistoryItem[];
}) {
  const [body, setBody] = useState(currentBody ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  async function handlePublish() {
    if (!body.trim()) {
      setError("O texto do termo não pode ficar vazio.");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedVersion(null);
    const result = await saveConsentTemplate(body);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSavedVersion((history[0]?.version ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <Textarea
          label="Texto do termo"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={DEFAULT_PLACEHOLDER}
        />
        {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
        {savedVersion && <p className="mt-2 text-xs font-semibold text-success">Versão {savedVersion} publicada.</p>}
        <div className="mt-4 flex justify-end">
          <Button type="button" isLoading={saving} onClick={handlePublish}>
            Publicar nova versão
          </Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Histórico de versões</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {history.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-primary">Versão {item.version}</span>
                <span className="text-text-muted">
                  {item.status === "active" ? "Vigente" : "Arquivada"} · {dateTimeFormatter.format(new Date(item.createdAt))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

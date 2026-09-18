"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { addEvolutionAddendum, type EvolutionAddendumResult } from "@/modules/evolutions/services/evolution-actions";

/** Formulário curto de complementação/adendo — sempre um registro novo e
 * independente vinculado à evolução original, nunca uma edição do que já
 * foi assinado (evolução é imutável desde a Etapa 69). `onSaved` recebe o
 * adendo recém-criado (já com a assinatura em snapshot) para quem chama
 * poder inserir na lista local sem precisar recarregar a página inteira. */
export function AddendumForm({
  evolutionId,
  onCancel,
  onSaved,
}: {
  evolutionId: string;
  onCancel: () => void;
  onSaved: (addendum: EvolutionAddendumResult) => void;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("Descreva a complementação.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await addEvolutionAddendum(evolutionId, content);
    setSaving(false);
    if (result.error || !result.addendum) {
      setError(result.error ?? "Não foi possível salvar a complementação.");
      return;
    }
    onSaved(result.addendum);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Textarea
        label="Complementação *"
        placeholder="Informação adicional ou correção — a evolução original não é alterada."
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={saving}>
          Assinar complementação
        </Button>
      </div>
    </form>
  );
}

const signatureDateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const signatureTimeFormatter = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" });

export function SignatureLine({ name, at }: { name: string; at: string }) {
  const date = new Date(at);
  return (
    <p className="text-xs font-semibold text-text-secondary">
      Assinado por <span className="text-text-primary">{name}</span> em {signatureDateFormatter.format(date)} às{" "}
      {signatureTimeFormatter.format(date)}
    </p>
  );
}

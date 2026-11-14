import type { EvolutionTopicContent } from "@/lib/supabase/types";

/** Puro, sem acesso a banco — usado no servidor (ao assinar) e no client (para
 * exibir o rascunho), por isso NÃO tem "server-only". */

/**
 * Transforma os tópicos preenchidos no texto único que vai para
 * `patient_evolutions.clinical_evolution`.
 *
 * Por que isso existe: `clinical_evolution` é obrigatório e é dele que já
 * dependem a tela de detalhe, a impressão, os relatórios de IA e os adendos.
 * Ele continua sendo a versão oficial, assinada e legível da evolução —
 * `topic_contents` é o espelho estruturado, para a tela poder exibir tópico a
 * tópico. Assim nenhuma leitura existente precisou mudar.
 *
 * Formato: texto puro, com o rótulo em linha própria. Nada de markdown — a
 * tela renderiza com `whitespace-pre-wrap`, então um `##` apareceria
 * literalmente para o terapeuta.
 *
 * Caso do modelo padrão de fábrica (UM tópico só): devolve apenas o texto, sem
 * linha de rótulo — byte a byte o que o terapeuta escreveu, igual ao
 * comportamento anterior à Etapa 79.
 */
export function flattenTopics(topics: EvolutionTopicContent[]): string {
  const preenchidos = topics
    .filter((t) => t.content.trim())
    .sort((a, b) => a.order - b.order);

  if (preenchidos.length === 0) return "";
  if (preenchidos.length === 1) return preenchidos[0].content.trim();

  return preenchidos.map((t) => `${t.label.trim()}\n${t.content.trim()}`).join("\n\n");
}

/** Normaliza o que veio do formulário: descarta tópico vazio, apara espaços e
 * reindexa a ordem. O rótulo é congelado aqui — é este array que vai para o
 * banco e nunca mais muda. */
export function normalizeTopics(
  topics: { label: string; content: string; order?: number }[],
): EvolutionTopicContent[] {
  return topics
    .map((t, i) => ({
      label: t.label.trim(),
      content: t.content.trim(),
      order: t.order ?? i,
    }))
    .filter((t) => t.content.length > 0)
    .sort((a, b) => a.order - b.order)
    .map((t, i) => ({ ...t, order: i }));
}

/** Lê `topic_contents` vindo do banco com desconfiança: é jsonb, então o
 * Postgres aceita qualquer forma ali. Uma linha gravada fora do app (script,
 * correção manual) não pode quebrar a renderização do prontuário. */
export function parseTopicContents(value: unknown): EvolutionTopicContent[] | null {
  if (!Array.isArray(value)) return null;

  const parsed: EvolutionTopicContent[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.label !== "string" || typeof row.content !== "string") continue;
    parsed.push({
      label: row.label,
      content: row.content,
      order: typeof row.order === "number" ? row.order : parsed.length,
    });
  }

  return parsed.length > 0 ? parsed.sort((a, b) => a.order - b.order) : null;
}

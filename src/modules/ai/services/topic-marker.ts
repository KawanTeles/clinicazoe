/**
 * Delimitador usado pela IA (ver buildTopicModePrompt em
 * quick-evolution-prompt.ts) para separar os tópicos do rascunho quando o
 * profissional usa um modelo com mais de um tópico.
 *
 * Sem "server-only", mesmo motivo do review-marker: a action do servidor usa
 * para montar o rascunho e o componente client usa para distribuir o texto nos
 * campos.
 */
const TOPIC_MARKER_SOURCE = /\[\[TOPICO:([^\]]*)\]\]/g;

export interface ParsedTopic {
  label: string;
  content: string;
}

/** Normaliza para comparar rótulo da IA com rótulo do modelo: a IA às vezes
 * devolve com acento diferente, caixa diferente ou espaço sobrando. */
function chaveDoRotulo(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    // Remove as marcas combinantes geradas pelo NFD (U+0300 a U+036F), para
    // "Evolução" e "evolucao" baterem como o mesmo rótulo.
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Distribui a resposta da IA nos tópicos do modelo.
 *
 * `expectedLabels` manda: só volta tópico que existe no modelo do
 * profissional, e sempre na ordem do modelo. Se a IA inventar um rótulo, o
 * texto dele não é descartado em silêncio — vai para o primeiro tópico, com
 * marcador de revisão, para o profissional ver e decidir. Perder texto que o
 * terapeuta ditou seria pior do que colocá-lo no lugar errado e avisar.
 *
 * Se a resposta vier sem nenhum delimitador (a IA ignorou o formato), o texto
 * inteiro volta no primeiro tópico — o profissional reorganiza na mão, que é
 * melhor do que uma tela vazia.
 */
export function parseTopicResponse(text: string, expectedLabels: string[]): ParsedTopic[] {
  const regex = new RegExp(TOPIC_MARKER_SOURCE);
  const encontrados: { label: string; content: string }[] = [];
  let match: RegExpExecArray | null;
  let anterior: { label: string; start: number } | null = null;

  while ((match = regex.exec(text)) !== null) {
    if (anterior) {
      encontrados.push({
        label: anterior.label,
        content: text.slice(anterior.start, match.index).trim(),
      });
    }
    anterior = { label: match[1].trim(), start: match.index + match[0].length };
  }
  if (anterior) {
    encontrados.push({ label: anterior.label, content: text.slice(anterior.start).trim() });
  }

  // A IA não usou o formato: devolve tudo no primeiro tópico em vez de nada.
  if (encontrados.length === 0) {
    const limpo = text.trim();
    return expectedLabels.map((label, i) => ({
      label,
      content: i === 0 ? limpo : "",
    }));
  }

  const porChave = new Map<string, string>();
  const orfaos: string[] = [];

  const chavesEsperadas = new Set(expectedLabels.map(chaveDoRotulo));
  for (const item of encontrados) {
    if (!item.content) continue;
    const chave = chaveDoRotulo(item.label);
    if (chavesEsperadas.has(chave)) {
      const jaTinha = porChave.get(chave);
      porChave.set(chave, jaTinha ? `${jaTinha}\n\n${item.content}` : item.content);
    } else {
      orfaos.push(`[[REVISAR: ${item.label}: ${item.content}]]`);
    }
  }

  return expectedLabels.map((label, i) => {
    const base = porChave.get(chaveDoRotulo(label)) ?? "";
    // Texto de rótulo inventado entra no primeiro tópico, sinalizado — a
    // assinatura fica bloqueada enquanto houver [[REVISAR:]] pendente.
    const extra = i === 0 && orfaos.length > 0 ? orfaos.join("\n\n") : "";
    return {
      label,
      content: [base, extra].filter(Boolean).join("\n\n"),
    };
  });
}

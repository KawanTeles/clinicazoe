/**
 * Delimitador usado pela IA (ver quick-evolution-prompt.ts) para marcar
 * trechos ambíguos/inaudíveis dentro do rascunho da Evolução Rápida.
 * Sem "server-only": usado tanto pela action do servidor (para bloquear a
 * assinatura enquanto houver marcador pendente) quanto pelo componente
 * client (para desenhar o realce amarelo).
 */
const MARKER_SOURCE = /\[\[REVISAR:([^\]]*)\]\]/g;

export function hasPendingReviewMarkers(text: string): boolean {
  return /\[\[REVISAR:/.test(text);
}

export interface ReviewMarkerSegment {
  type: "text" | "marker";
  content: string;
}

/** Quebra o rascunho em segmentos de texto normal e de trecho sinalizado
 * (sem os delimitadores) — pronto para renderizar com <mark> no segmento
 * "marker". Instancia um regex novo a cada chamada: regex /g é stateful
 * (lastIndex), uma instância compartilhada quebraria com chamadas
 * intercaladas (ex.: hasPendingReviewMarkers + split no mesmo render). */
export function splitReviewMarkers(text: string): ReviewMarkerSegment[] {
  const regex = new RegExp(MARKER_SOURCE);
  const segments: ReviewMarkerSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "marker", content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }
  return segments;
}

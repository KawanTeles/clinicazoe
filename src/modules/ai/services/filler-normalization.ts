/**
 * Limpeza leve do texto ditado/digitado antes de mandar para a IA (item 11a
 * do pedido de produto). Escopo deliberadamente pequeno: só remove ruído que
 * nunca carrega sentido clínico — nunca "é" sozinho (é o verbo "ser", comum
 * e significativo em frases como "o paciente é colaborativo") nem palavras
 * como "tipo"/"assim" (podem ser conteúdo real, ex. "um tipo de atividade").
 *
 * Duas transformações seguras:
 *   1) Colapsa repetição imediata da mesma palavra (gagueira do ditado:
 *      "não não não quis" -> "não quis").
 *   2) Remove a partícula "né" isolada (sempre interjeição em português,
 *      nunca carrega informação clínica) e limpa a pontuação/espaços que
 *      sobram no lugar.
 */
export function normalizeDictationFillers(text: string): string {
  let result = text.replace(/\b(\p{L}+)(\s+\1\b)+/giu, "$1");

  result = result.replace(/,?\s*\bné\b\s*,?/giu, (match: string, offset: number, full: string) => {
    const before = full.slice(0, offset);
    const after = full.slice(offset + match.length);
    const needsComma = /\S\s*$/.test(before) && /^\s*\S/.test(after) && !match.includes(".");
    return needsComma ? ", " : " ";
  });

  result = result.replace(/[ \t]{2,}/g, " ");
  result = result.replace(/\s+([,.!?])/g, "$1");
  result = result.replace(/^[,\s]+|[,\s]+$/g, "");

  return result.trim();
}

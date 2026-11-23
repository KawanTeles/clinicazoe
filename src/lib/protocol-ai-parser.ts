/**
 * Parser puro da resposta da IA ao gerar itens de protocolo (F9,
 * protocol-ai-prompt.ts) — mesmo formato "domínio, item" por linha já usado
 * no import CSV do construtor manual (ProtocolTemplateManager.tsx), um só
 * parser pros dois casos. Sem "server-only": usado pela action do servidor
 * (que processa a resposta da IA) e testado isoladamente.
 */
export interface ParsedProtocolAiItem {
  domain: string | null;
  label: string;
}

export function parseProtocolAiResponse(text: string): ParsedProtocolAiItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const commaIndex = line.indexOf(",");
      if (commaIndex === -1) return { domain: null, label: line.trim() };
      const domain = line.slice(0, commaIndex).trim();
      const label = line
        .slice(commaIndex + 1)
        .trim()
        .replace(/^"|"$/g, "");
      return { domain: domain || null, label };
    })
    .filter((item) => item.label.length > 0);
}

import "server-only";
import type { TextCompletionInput, TextCompletionResult, TextProvider } from "../provider-types";

/**
 * Provider offline usado em desenvolvimento/teste e como opção "Mock" no
 * admin — nunca faz chamada de rede, então nunca tem custo nem depende de
 * chave de API. Faz uma transformação simples e determinística do texto de
 * entrada para permitir validar o fluxo ponta a ponta (gravação → melhoria
 * → revisão) sem precisar de uma chave real de OpenAI/Anthropic/Gemini.
 */
export const mockProvider: TextProvider = {
  async complete(_apiKey: string | null, input: TextCompletionInput): Promise<TextCompletionResult> {
    const cleaned = input.user
      .trim()
      .replace(/\s+/g, " ")
      .replace(/(^|[.!?]\s+)([a-zà-ú])/g, (_match, sep: string, letter: string) => sep + letter.toUpperCase());

    const withPunctuation = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;

    return {
      text: `${withPunctuation}\n\n[Resposta gerada pelo provedor Mock — configure um provedor real em Configurações → Inteligência Artificial para usar um modelo de verdade.]`,
    };
  },
};

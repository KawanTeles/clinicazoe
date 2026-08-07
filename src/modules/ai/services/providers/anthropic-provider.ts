import "server-only";
import type { TextCompletionInput, TextCompletionResult, TextProvider } from "../provider-types";
import { PROVIDER_DEFAULT_MODEL } from "../provider-types";

export const anthropicProvider: TextProvider = {
  async complete(apiKey: string | null, input: TextCompletionInput): Promise<TextCompletionResult> {
    if (!apiKey) throw new Error("Chave de API da Anthropic não configurada.");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model || PROVIDER_DEFAULT_MODEL.anthropic,
        system: input.system,
        max_tokens: input.maxTokens ?? 1200,
        messages: [{ role: "user", content: input.user }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Falha na chamada à Anthropic (${response.status}): ${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Resposta vazia da Anthropic.");
    }

    const usage =
      typeof data?.usage?.input_tokens === "number" && typeof data?.usage?.output_tokens === "number"
        ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
        : undefined;

    return { text, usage };
  },
};

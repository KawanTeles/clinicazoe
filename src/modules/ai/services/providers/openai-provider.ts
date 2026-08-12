import "server-only";
import type { TextCompletionInput, TextCompletionResult, TextProvider } from "../provider-types";
import { PROVIDER_DEFAULT_MODEL } from "../provider-types";

export const openaiProvider: TextProvider = {
  async complete(apiKey: string | null, input: TextCompletionInput): Promise<TextCompletionResult> {
    if (!apiKey) throw new Error("Chave de API da OpenAI não configurada.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: input.model || PROVIDER_DEFAULT_MODEL.openai,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        max_tokens: input.maxTokens ?? 1200,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Falha na chamada à OpenAI (${response.status}): ${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Resposta vazia da OpenAI.");
    }

    const usage =
      typeof data?.usage?.prompt_tokens === "number" && typeof data?.usage?.completion_tokens === "number"
        ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
        : undefined;

    return { text, usage };
  },
};

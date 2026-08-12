import "server-only";
import type { TextCompletionInput, TextCompletionResult, TextProvider } from "../provider-types";
import { PROVIDER_DEFAULT_MODEL } from "../provider-types";

export const geminiProvider: TextProvider = {
  async complete(apiKey: string | null, input: TextCompletionInput): Promise<TextCompletionResult> {
    if (!apiKey) throw new Error("Chave de API do Google Gemini não configurada.");

    const model = input.model || PROVIDER_DEFAULT_MODEL.gemini;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.user }] }],
        generationConfig: {
          maxOutputTokens: input.maxTokens ?? 1200,
          temperature: 0.2,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Falha na chamada ao Gemini (${response.status}): ${detail.slice(0, 300)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Resposta vazia do Gemini.");
    }

    const usage =
      typeof data?.usageMetadata?.promptTokenCount === "number" &&
      typeof data?.usageMetadata?.candidatesTokenCount === "number"
        ? { inputTokens: data.usageMetadata.promptTokenCount, outputTokens: data.usageMetadata.candidatesTokenCount }
        : undefined;

    return { text, usage };
  },
};

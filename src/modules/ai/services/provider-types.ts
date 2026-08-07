export type AIProviderId = "mock" | "openai" | "anthropic" | "gemini";

export interface TextCompletionInput {
  /** Instrução de sistema — regras fixas (o que a IA pode e não pode fazer). */
  system: string;
  /** Conteúdo enviado pelo profissional (texto a transformar). */
  user: string;
  model?: string;
  maxTokens?: number;
}

export interface TextUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface TextCompletionResult {
  text: string;
  /** Ausente quando o provedor não informa consumo (ex.: mock) — sem custo estimado nesse caso. */
  usage?: TextUsage;
}

export interface TextProvider {
  /** Gera uma resposta de texto a partir de um prompt de sistema + conteúdo do usuário. */
  complete(apiKey: string | null, input: TextCompletionInput): Promise<TextCompletionResult>;
}

export const PROVIDER_LABELS: Record<AIProviderId, string> = {
  mock: "Mock (desenvolvimento)",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini",
};

export const PROVIDER_DEFAULT_MODEL: Record<AIProviderId, string> = {
  mock: "mock-v1",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  gemini: "gemini-1.5-flash",
};

export type ImproveMode =
  | "ortografia"
  | "linguagem_tecnica"
  | "resumir"
  | "expandir"
  | "topicos"
  | "texto_corrido"
  | "padronizar_evolucao";

/** Sem dependência de "server-only" — pode ser importado por Client Components (ex.: o menu de modos no assistente de escrita). */
export const IMPROVE_MODE_LABELS: Record<ImproveMode, string> = {
  ortografia: "Correção Ortográfica",
  linguagem_tecnica: "Linguagem Técnica",
  resumir: "Resumir",
  expandir: "Expandir mantendo o significado",
  topicos: "Organizar em tópicos",
  texto_corrido: "Organizar em texto corrido",
  padronizar_evolucao: "Padronizar evolução",
};

export type ReportTemplate =
  | "clinico"
  | "resumo_terapeutico"
  | "evolucao_consolidada"
  | "convenio"
  | "escola"
  | "encaminhamento"
  | "alta";

export const REPORT_TEMPLATE_LABELS: Record<ReportTemplate, string> = {
  clinico: "Relatório Clínico",
  resumo_terapeutico: "Resumo Terapêutico",
  evolucao_consolidada: "Evolução Consolidada",
  convenio: "Relatório para Convênio",
  escola: "Relatório para Escola",
  encaminhamento: "Relatório para Encaminhamento",
  alta: "Relatório de Alta",
};

/** Preço aproximado em US$ por 1000 tokens (tabela pública, best-effort — nunca é a fatura real do provedor). */
const PROVIDER_MODEL_PRICING: Record<Exclude<AIProviderId, "mock">, { inputPer1k: number; outputPer1k: number }> = {
  openai: { inputPer1k: 0.00015, outputPer1k: 0.0006 }, // gpt-4o-mini
  anthropic: { inputPer1k: 0.003, outputPer1k: 0.015 }, // claude-3.5-sonnet
  gemini: { inputPer1k: 0.000075, outputPer1k: 0.0003 }, // gemini-1.5-flash
};

/** Estimativa de custo — provider "mock" é sempre US$0 (nenhuma chamada real ocorreu). */
export function estimateCostUsd(provider: AIProviderId, inputTokens: number, outputTokens: number): number {
  if (provider === "mock") return 0;
  const pricing = PROVIDER_MODEL_PRICING[provider];
  return (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
}

import "server-only";
import type { AIProviderId, ImproveMode, ReportTemplate, TextProvider, TextUsage } from "./provider-types";
import { REPORT_TEMPLATE_LABELS } from "./provider-types";
import { mockProvider } from "./providers/mock-provider";
import { openaiProvider } from "./providers/openai-provider";
import { anthropicProvider } from "./providers/anthropic-provider";
import { geminiProvider } from "./providers/gemini-provider";

const MODE_INSTRUCTIONS: Record<ImproveMode, string> = {
  ortografia: "Corrija apenas ortografia, gramática e pontuação. Não reescreva frases além do necessário para a correção.",
  linguagem_tecnica: "Reescreva em linguagem técnica de prontuário clínico, mantendo o registro formal usado por profissionais de saúde.",
  resumir: "Resuma o texto, preservando apenas as informações essenciais, sem perder nenhum fato relatado.",
  expandir: "Expanda o texto em prosa mais completa e clara, sem adicionar nenhuma informação que não esteja implícita no original.",
  topicos: "Reorganize o conteúdo em tópicos curtos (bullet points), agrupando por tema quando fizer sentido.",
  texto_corrido: "Reorganize o conteúdo em texto corrido, em parágrafos bem estruturados.",
  padronizar_evolucao: "Reorganize seguindo a estrutura padrão de uma evolução clínica (queixa/contexto, condução da sessão, resposta do paciente, encaminhamentos), sem inventar seções que não têm conteúdo correspondente no original.",
};

const BASE_SYSTEM_PROMPT = `Você é um assistente de escrita para profissionais de saúde que estão registrando a evolução clínica de um paciente.

Regras obrigatórias, sem exceção:
- Nunca invente informações que não estejam no texto original.
- Nunca adicione diagnósticos, CID, nomes de medicamentos, doses ou qualquer interpretação clínica que o profissional não tenha escrito.
- Mantenha exatamente o mesmo significado do texto original — você só pode corrigir ortografia, gramática e pontuação, organizar parágrafos, melhorar a clareza e deixar a linguagem técnica quando apropriado.
- Responda apenas com o texto final revisado, sem comentários, sem explicações, sem aspas ao redor do texto.
- Escreva em português do Brasil.`;

export interface ImproveEvolutionInput {
  rawText: string;
  mode: ImproveMode;
  provider: AIProviderId;
  apiKey: string | null;
  model: string | null;
}

const REPORT_BASE_PROMPT = `Você é um assistente que ajuda profissionais de saúde a redigir relatórios clínicos a partir das evoluções já registradas no prontuário de um paciente.

Regras obrigatórias, sem exceção:
- Use exclusivamente as informações fornecidas nas evoluções abaixo. Nunca invente dados, diagnósticos, CID, medicações ou fatos que não estejam no texto fornecido.
- Se uma seção não tiver informação suficiente nas evoluções, escreva "Sem informações suficientes para esta seção" em vez de inventar conteúdo.
- Estruture o relatório com estas seções, nesta ordem: Dados Básicos, Resumo do Período, Principais Demandas, Intervenções Realizadas, Progressos Observados, Objetivos Terapêuticos, Pontos para Continuidade, Conclusão, Observações.
- Escreva em português do Brasil, de forma clara e profissional.`;

const REPORT_TEMPLATE_INSTRUCTIONS: Record<ReportTemplate, string> = {
  clinico: "Linguagem técnica completa, para uso interno da equipe clínica.",
  resumo_terapeutico: "Seja mais conciso, priorizando uma visão geral rápida do processo terapêutico.",
  evolucao_consolidada: "Organize como uma consolidação cronológica das evoluções, destacando a progressão ao longo do período.",
  convenio: "Linguagem técnica objetiva, focada em justificar clinicamente a continuidade do tratamento para fins de auditoria/autorização junto ao convênio. Evite opiniões, cite só fatos observáveis.",
  escola: "Linguagem acessível a educadores, sem jargão clínico, focando em orientações práticas para o ambiente escolar.",
  encaminhamento: "Seja objetivo e direcionado ao profissional que receberá o encaminhamento, destacando o motivo e o contexto relevante para a continuidade do cuidado.",
  alta: "Enfatize os objetivos alcançados, o estado final do paciente ao término do acompanhamento e recomendações para o futuro.",
};

export interface GenerateReportInput {
  patientName: string;
  template: ReportTemplate;
  periodLabel: string;
  evolutionsText: string;
  provider: AIProviderId;
  apiKey: string | null;
  model: string | null;
}

const PATIENT_ASSISTANT_SYSTEM_PROMPT = `Você é um assistente que ajuda um profissional de saúde a consultar o prontuário de um paciente específico.

Regras obrigatórias, sem exceção:
- Responda usando exclusivamente as evoluções clínicas fornecidas abaixo. Nunca use conhecimento externo, nunca invente informações.
- Se a resposta não puder ser encontrada nas evoluções fornecidas, diga claramente que a informação não está disponível no prontuário.
- Não adicione diagnósticos, CID ou interpretações clínicas que não estejam explícitas no texto original.
- Escreva em português do Brasil, de forma objetiva.`;

export interface AnswerPatientQuestionInput {
  patientName: string;
  question: string;
  evolutionsText: string;
  provider: AIProviderId;
  apiKey: string | null;
  model: string | null;
}

class NotImplementedError extends Error {
  constructor(method: string) {
    super(`AIService.${method}() ainda não está disponível — recurso planejado para uma fase futura.`);
  }
}

function resolveProvider(id: AIProviderId): TextProvider {
  switch (id) {
    case "openai":
      return openaiProvider;
    case "anthropic":
      return anthropicProvider;
    case "gemini":
      return geminiProvider;
    case "mock":
    default:
      return mockProvider;
  }
}

/**
 * Ponto único de comunicação com provedores de IA. Toda a aplicação deve
 * chamar métodos daqui — nunca um provider adapter diretamente — para que
 * trocar de provedor não exija mudanças em nenhuma outra parte do sistema.
 */
export const AIService = {
  async improveEvolution(input: ImproveEvolutionInput): Promise<{ text: string; usage?: TextUsage }> {
    const provider = resolveProvider(input.provider);
    const system = `${BASE_SYSTEM_PROMPT}\n\nInstrução específica deste pedido: ${MODE_INSTRUCTIONS[input.mode]}`;
    const result = await provider.complete(input.apiKey, {
      system,
      user: input.rawText,
      model: input.model ?? undefined,
    });
    return { text: result.text.trim(), usage: result.usage };
  },

  async testConnection(provider: AIProviderId, apiKey: string | null, model: string | null): Promise<{ text: string }> {
    const adapter = resolveProvider(provider);
    const result = await adapter.complete(apiKey, {
      system: "Responda apenas com a palavra: ok",
      user: "teste de conexão",
      model: model ?? undefined,
      maxTokens: 10,
    });
    return { text: result.text.trim() };
  },

  async transcribeAudio(): Promise<never> {
    throw new NotImplementedError("transcribeAudio");
  },

  /** Gera o texto de um relatório a partir das evoluções já formatadas pelo chamador (reports-actions.ts). */
  async generateReport(input: GenerateReportInput): Promise<{ title: string; content: string; usage?: TextUsage }> {
    const provider = resolveProvider(input.provider);
    const system = `${REPORT_BASE_PROMPT}\n\nTipo de relatório solicitado — ${REPORT_TEMPLATE_LABELS[input.template]}: ${REPORT_TEMPLATE_INSTRUCTIONS[input.template]}`;
    const user = `Paciente: ${input.patientName}\nPeríodo: ${input.periodLabel}\n\nEvoluções registradas:\n${input.evolutionsText}`;
    const result = await provider.complete(input.apiKey, {
      system,
      user,
      model: input.model ?? undefined,
      maxTokens: 2000,
    });
    return {
      title: `${REPORT_TEMPLATE_LABELS[input.template]} — ${input.patientName}`,
      content: result.text.trim(),
      usage: result.usage,
    };
  },

  /** Responde uma pergunta do profissional usando só as evoluções fornecidas do paciente (nunca conhecimento externo). */
  async answerPatientQuestion(input: AnswerPatientQuestionInput): Promise<{ text: string; usage?: TextUsage }> {
    const provider = resolveProvider(input.provider);
    const user = `Paciente: ${input.patientName}\n\nEvoluções registradas:\n${input.evolutionsText}\n\nPergunta do profissional: ${input.question}`;
    const result = await provider.complete(input.apiKey, {
      system: PATIENT_ASSISTANT_SYSTEM_PROMPT,
      user,
      model: input.model ?? undefined,
      maxTokens: 1200,
    });
    return { text: result.text.trim(), usage: result.usage };
  },
};

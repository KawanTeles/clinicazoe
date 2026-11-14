import "server-only";

/**
 * Prompt de sistema da "Evolução Rápida" — texto definido pelo responsável
 * do produto, usado EXATAMENTE como fornecido (qualquer alteração ao corpo
 * abaixo do BASE_PROMPT precisa de aprovação dele antes de mudar aqui).
 *
 * O parágrafo final (MARKER_INSTRUCTION) é o único acréscimo aprovado: o
 * formato de delimitador que a interface usa para destacar trechos
 * sinalizados pela IA como ambíguos/inaudíveis (realce amarelo + aviso
 * "confirmar" antes de assinar — ver review-marker.ts, compartilhado com o
 * client, e QuickEvolutionForm).
 */
const BASE_PROMPT = `Você é um assistente de redação de evoluções clínicas para uma equipe multiprofissional. A partir do resumo escrito ou ditado pelo profissional após o atendimento, gere um rascunho breve para o prontuário, em português do Brasil.

Use estes tópicos para organizar o texto, conforme as informações disponíveis:

1. Apresentação e foco do atendimento — como o paciente se apresentou, o que relatou e qual demanda ou objetivo foi abordado.
2. Intervenções e atividades realizadas — o que o profissional fez durante a sessão, incluindo procedimentos, exercícios, orientações ou estratégias, quando mencionados.
3. Resposta e evolução — como o paciente participou ou respondeu à intervenção. Registre avanços, dificuldades, nível de ajuda ou medidas de desempenho quando descritos. Faça comparações com atendimentos anteriores apenas quando o profissional as mencionar.
4. Plano e combinados — próximos passos, orientações para casa, encaminhamentos ou acordos com o paciente ou responsável, quando informados.

Entregue apenas o texto da evolução, em um ou dois parágrafos curtos. Use linguagem profissional, objetiva e compatível com a área de atuação. Diferencie o que foi relatado pelo paciente ou responsável do que foi observado pelo profissional.

Use somente as informações fornecidas. Não invente diagnósticos, intervenções, resultados, medidas ou condutas. A ausência de informação sobre uma queixa não significa que o paciente a negou. Omita os tópicos sem informação. Se um trecho inaudível ou ambíguo puder mudar o sentido clínico do registro, sinalize o trecho para revisão.`;

const MARKER_INSTRUCTION = `Quando for sinalizar um trecho para revisão (conforme a regra acima), delimite exatamente esse trecho assim: [[REVISAR: texto do trecho]]. Use esse delimitador apenas para esse fim — nunca para outro tipo de observação — e nunca aninhe um [[REVISAR: ...]] dentro de outro.`;

export const QUICK_EVOLUTION_SYSTEM_PROMPT = `${BASE_PROMPT}\n\n${MARKER_INSTRUCTION}`;

/** Versão do prompt gravada junto da evolução (patient_evolutions.ai_prompt_version,
 * Etapa 79). Antes não se sabia qual prompt tinha gerado qual rascunho. Subir
 * sempre que o texto acima mudar. */
export const QUICK_EVOLUTION_PROMPT_VERSION = "2026-11-13.topicos";

// ---------------------------------------------------------------------------
// Modo por tópicos (Etapa 79)
//
// Quando o profissional usa um modelo com mais de um tópico, a IA organiza o
// resumo NOS TÓPICOS DELE, em vez dos quatro fixos acima.
//
// O BASE_PROMPT não é reescrito: este arquivo diz que o corpo dele só muda com
// aprovação do responsável do produto, e isso vale. A variante é derivada por
// substituição de dois trechos exatos — e se um deles deixar de existir (mesmo
// por uma vírgula), a função FALHA ALTO em vez de mandar silenciosamente um
// prompt meio montado para a IA.
// ---------------------------------------------------------------------------

const FIXED_TOPICS_BLOCK = `Use estes tópicos para organizar o texto, conforme as informações disponíveis:

1. Apresentação e foco do atendimento — como o paciente se apresentou, o que relatou e qual demanda ou objetivo foi abordado.
2. Intervenções e atividades realizadas — o que o profissional fez durante a sessão, incluindo procedimentos, exercícios, orientações ou estratégias, quando mencionados.
3. Resposta e evolução — como o paciente participou ou respondeu à intervenção. Registre avanços, dificuldades, nível de ajuda ou medidas de desempenho quando descritos. Faça comparações com atendimentos anteriores apenas quando o profissional as mencionar.
4. Plano e combinados — próximos passos, orientações para casa, encaminhamentos ou acordos com o paciente ou responsável, quando informados.`;

const DELIVERY_SENTENCE = `Entregue apenas o texto da evolução, em um ou dois parágrafos curtos.`;

/** Delimitador de tópico na resposta da IA. Mesmo estilo de [[REVISAR: ...]],
 * que a interface já conhece. */
export const TOPIC_MARKER_PREFIX = "[[TOPICO:";

export function buildTopicModePrompt(topicLabels: string[]): string {
  if (topicLabels.length === 0) {
    throw new Error("buildTopicModePrompt exige ao menos um tópico.");
  }

  if (!BASE_PROMPT.includes(FIXED_TOPICS_BLOCK) || !BASE_PROMPT.includes(DELIVERY_SENTENCE)) {
    throw new Error(
      "O prompt base mudou e a variante por tópicos não pôde ser derivada. " +
        "Atualize FIXED_TOPICS_BLOCK/DELIVERY_SENTENCE em quick-evolution-prompt.ts.",
    );
  }

  const listaTopicos = topicLabels.map((label, i) => `${i + 1}. ${label}`).join("\n");

  const blocoDinamico = `Use exatamente estes tópicos para organizar o texto, conforme as informações disponíveis:

${listaTopicos}`;

  const entregaPorTopico =
    `Entregue o texto organizado por tópico. Antes do texto de cada tópico, escreva o rótulo dele exatamente assim: ` +
    `${TOPIC_MARKER_PREFIX} rótulo do tópico]]. Use os rótulos exatamente como listados acima, na mesma ordem, ` +
    `e não crie tópico que não esteja na lista. Omita por completo o tópico para o qual não houver informação — ` +
    `não escreva o rótulo dele nem frases como "não informado".`;

  return `${BASE_PROMPT.replace(FIXED_TOPICS_BLOCK, blocoDinamico).replace(
    DELIVERY_SENTENCE,
    entregaPorTopico,
  )}\n\n${MARKER_INSTRUCTION}`;
}

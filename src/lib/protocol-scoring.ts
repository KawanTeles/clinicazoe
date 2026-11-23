/**
 * Lógica pura de pontuação de uma avaliação por protocolo (F9) — sem acesso
 * a banco, usada tanto no formulário (prévia em tempo real enquanto o
 * profissional marca os itens) quanto na tela de histórico (avaliação já
 * assinada). Pontuação é "melhor esforço" simples: soma de point_value dos
 * itens atingidos, por domínio (subescala) e total. Faixa de interpretação
 * é um intervalo [min,max] configurado por quem monta o protocolo — a
 * primeira faixa cujo intervalo contém a pontuação vence; sem faixa
 * configurada, ou pontuação fora de todas as faixas, não há interpretação
 * (não inventamos rótulo).
 */

export interface ScorableResponse {
  domain: string | null;
  achieved: boolean;
  pointValue: number;
}

export interface InterpretationBand {
  /** null = faixa da pontuação TOTAL; preenchido = faixa daquele domínio/subescala. */
  domain: string | null;
  minScore: number;
  maxScore: number;
  label: string;
  description?: string | null;
}

export interface DomainScore {
  domain: string | null;
  score: number;
  maxPossible: number;
  band: InterpretationBand | null;
}

/** Pontuação máxima possível de um conjunto de itens — soma de point_value
 * independente de terem sido atingidos ou não. Usado pra mostrar "12/20",
 * não só o número absoluto. */
export function computeMaxPossibleScore(responses: ScorableResponse[]): number {
  return responses.reduce((sum, r) => sum + r.pointValue, 0);
}

export function computeTotalScore(responses: ScorableResponse[]): number {
  return responses.reduce((sum, r) => sum + (r.achieved ? r.pointValue : 0), 0);
}

/** Agrupa por domain (null vira a chave "" internamente, devolvido como
 * null) e soma pontuação + máximo possível de cada subescala. Preserva a
 * ordem de primeira aparição dos domínios na lista de respostas. */
export function computeDomainScores(responses: ScorableResponse[]): { domain: string | null; score: number; maxPossible: number }[] {
  const order: (string | null)[] = [];
  const scoreByDomain = new Map<string | null, number>();
  const maxByDomain = new Map<string | null, number>();

  for (const r of responses) {
    if (!scoreByDomain.has(r.domain)) {
      order.push(r.domain);
      scoreByDomain.set(r.domain, 0);
      maxByDomain.set(r.domain, 0);
    }
    maxByDomain.set(r.domain, (maxByDomain.get(r.domain) ?? 0) + r.pointValue);
    if (r.achieved) {
      scoreByDomain.set(r.domain, (scoreByDomain.get(r.domain) ?? 0) + r.pointValue);
    }
  }

  return order.map((domain) => ({
    domain,
    score: scoreByDomain.get(domain) ?? 0,
    maxPossible: maxByDomain.get(domain) ?? 0,
  }));
}

/** Primeira faixa cujo [min,max] contém a pontuação, entre as faixas do
 * domínio pedido (null = faixa da pontuação total). Ordem da lista de
 * entrada é a ordem de prioridade — quem monta o protocolo evita
 * sobreposição na própria tela do construtor, não é verificado aqui. */
export function matchInterpretationBand(
  score: number,
  domain: string | null,
  bands: InterpretationBand[],
): InterpretationBand | null {
  return bands.find((b) => b.domain === domain && score >= b.minScore && score <= b.maxScore) ?? null;
}

/** Visão completa: pontuação total + por domínio, cada uma já casada com a
 * faixa de interpretação correspondente (ou null se nenhuma bater). */
export function scoreAssessment(
  responses: ScorableResponse[],
  bands: InterpretationBand[],
): { total: DomainScore; byDomain: DomainScore[] } {
  const totalScore = computeTotalScore(responses);
  const totalMax = computeMaxPossibleScore(responses);

  const domainScores = computeDomainScores(responses).filter((d) => d.domain !== null);

  return {
    total: {
      domain: null,
      score: totalScore,
      maxPossible: totalMax,
      band: matchInterpretationBand(totalScore, null, bands),
    },
    byDomain: domainScores.map((d) => ({
      ...d,
      band: matchInterpretationBand(d.score, d.domain, bands),
    })),
  };
}

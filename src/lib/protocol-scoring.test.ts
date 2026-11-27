import { describe, expect, it } from "vitest";
import {
  computeDomainScores,
  computeMaxPossibleScore,
  computeTotalScore,
  matchInterpretationBand,
  scoreAssessment,
  type InterpretationBand,
  type ScorableResponse,
} from "./protocol-scoring";

const responses: ScorableResponse[] = [
  { domain: "Linguagem", achieved: true, pointValue: 2 },
  { domain: "Linguagem", achieved: false, pointValue: 2 },
  { domain: "Motor", achieved: true, pointValue: 1 },
  { domain: "Motor", achieved: true, pointValue: 1 },
  { domain: null, achieved: true, pointValue: 3 },
];

describe("computeTotalScore / computeMaxPossibleScore", () => {
  it("soma só os pontos dos itens atingidos", () => {
    expect(computeTotalScore(responses)).toBe(2 + 1 + 1 + 3);
  });

  it("soma todos os pontos possíveis, atingidos ou não", () => {
    expect(computeMaxPossibleScore(responses)).toBe(2 + 2 + 1 + 1 + 3);
  });

  it("devolve 0 para lista vazia", () => {
    expect(computeTotalScore([])).toBe(0);
    expect(computeMaxPossibleScore([])).toBe(0);
  });
});

describe("computeDomainScores", () => {
  it("agrupa por domínio preservando ordem de primeira aparição", () => {
    const result = computeDomainScores(responses);
    expect(result).toEqual([
      { domain: "Linguagem", score: 2, maxPossible: 4 },
      { domain: "Motor", score: 2, maxPossible: 2 },
      { domain: null, score: 3, maxPossible: 3 },
    ]);
  });
});

describe("matchInterpretationBand", () => {
  const bands: InterpretationBand[] = [
    { domain: null, minScore: 0, maxScore: 5, label: "Atraso significativo" },
    { domain: null, minScore: 6, maxScore: 10, label: "Atraso leve" },
    { domain: null, minScore: 11, maxScore: 999, label: "Dentro do esperado" },
    { domain: "Motor", minScore: 0, maxScore: 1, label: "Motor atrasado" },
    { domain: "Motor", minScore: 2, maxScore: 999, label: "Motor adequado" },
  ];

  it("encontra a faixa correta pela pontuação total", () => {
    expect(matchInterpretationBand(3, null, bands)?.label).toBe("Atraso significativo");
    expect(matchInterpretationBand(8, null, bands)?.label).toBe("Atraso leve");
    expect(matchInterpretationBand(15, null, bands)?.label).toBe("Dentro do esperado");
  });

  it("encontra a faixa correta por domínio, não confunde com a faixa total", () => {
    expect(matchInterpretationBand(2, "Motor", bands)?.label).toBe("Motor adequado");
    expect(matchInterpretationBand(2, null, bands)?.label).toBe("Atraso significativo");
  });

  it("devolve null quando nenhuma faixa bate (ex.: domínio sem faixa configurada)", () => {
    expect(matchInterpretationBand(10, "Linguagem", bands)).toBeNull();
  });

  it("limites da faixa são inclusivos", () => {
    expect(matchInterpretationBand(5, null, bands)?.label).toBe("Atraso significativo");
    expect(matchInterpretationBand(6, null, bands)?.label).toBe("Atraso leve");
  });
});

describe("scoreAssessment", () => {
  it("monta o total e as subescalas já com a faixa de interpretação casada", () => {
    const bands: InterpretationBand[] = [
      { domain: null, minScore: 0, maxScore: 7, label: "Baixo" },
      { domain: null, minScore: 8, maxScore: 99, label: "Alto" },
      { domain: "Motor", minScore: 0, maxScore: 2, label: "Motor ok" },
    ];
    const result = scoreAssessment(responses, bands);

    expect(result.total.score).toBe(7);
    expect(result.total.maxPossible).toBe(9);
    expect(result.total.band?.label).toBe("Baixo");

    const motor = result.byDomain.find((d) => d.domain === "Motor");
    expect(motor?.score).toBe(2);
    expect(motor?.band?.label).toBe("Motor ok");

    const linguagem = result.byDomain.find((d) => d.domain === "Linguagem");
    expect(linguagem?.band).toBeNull();

    // domínio null (item sem subescala) não entra em byDomain — só no total.
    expect(result.byDomain.some((d) => d.domain === null)).toBe(false);
  });

  it("não quebra sem nenhuma faixa configurada", () => {
    const result = scoreAssessment(responses, []);
    expect(result.total.band).toBeNull();
    expect(result.byDomain.every((d) => d.band === null)).toBe(true);
  });
});

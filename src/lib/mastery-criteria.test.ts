import { describe, expect, it } from "vitest";
import { evaluateMasteryCriteria, type DataSessionTally } from "./mastery-criteria";

function session(
  sessionDate: string,
  independent: number,
  others: Partial<DataSessionTally> = {},
): DataSessionTally & { sessionDate: string } {
  return {
    sessionDate,
    independentCount: independent,
    verbalPromptCount: others.verbalPromptCount ?? 0,
    gesturalPromptCount: others.gesturalPromptCount ?? 0,
    physicalPromptCount: others.physicalPromptCount ?? 0,
    incorrectCount: others.incorrectCount ?? 0,
  };
}

describe("evaluateMasteryCriteria — percentage_independent", () => {
  const criteria = { type: "percentage_independent" as const, threshold: 80, consecutiveSessions: 3 };

  it("não atinge sem sessões suficientes", () => {
    const sessions = [session("2026-01-01", 9, { incorrectCount: 1 })];
    const result = evaluateMasteryCriteria(sessions, criteria);
    expect(result.met).toBe(false);
    expect(result.currentStreak).toBe(1);
  });

  it("atinge com 3 sessões consecutivas >= 80% de independência", () => {
    const sessions = [
      session("2026-01-01", 8, { incorrectCount: 2 }), // 80%
      session("2026-01-02", 9, { incorrectCount: 1 }), // 90%
      session("2026-01-03", 10, { incorrectCount: 0 }), // 100%
    ];
    const result = evaluateMasteryCriteria(sessions, criteria);
    expect(result.met).toBe(true);
    expect(result.currentStreak).toBe(3);
  });

  it("uma sessão fraca no meio reseta a sequência a partir dela, não atinge", () => {
    const sessions = [
      session("2026-01-01", 10, {}), // 100% — fora da janela de 3, mas quebraria a sequência se contasse
      session("2026-01-02", 3, { incorrectCount: 7 }), // 30% — fraca
      session("2026-01-03", 9, { incorrectCount: 1 }), // 90%
      session("2026-01-04", 10, {}), // 100%
    ];
    const result = evaluateMasteryCriteria(sessions, criteria);
    // janela das últimas 3: 30%, 90%, 100% — a primeira (mais antiga da
    // janela) não bate, mas currentStreak conta de trás pra frente e para
    // antes de chegar nela porque as duas últimas já bateram.
    expect(result.currentStreak).toBe(2);
    expect(result.met).toBe(false);
  });

  it("sessão sem nenhuma tentativa não quebra com divisão por zero", () => {
    const sessions = [session("2026-01-01", 0, {})];
    expect(() => evaluateMasteryCriteria(sessions, criteria)).not.toThrow();
  });
});

describe("evaluateMasteryCriteria — consecutive_correct_count", () => {
  const criteria = { type: "consecutive_correct_count" as const, threshold: 8, consecutiveSessions: 2 };

  it("compara contagem bruta de independentes, não percentual", () => {
    const sessions = [
      session("2026-01-01", 8, { incorrectCount: 20 }), // mesmo com muitos erros, 8 independentes bate o threshold de contagem
      session("2026-01-02", 9, {}),
    ];
    const result = evaluateMasteryCriteria(sessions, criteria);
    expect(result.met).toBe(true);
  });

  it("não atinge se a contagem cair abaixo do threshold em alguma das últimas N sessões", () => {
    const sessions = [
      session("2026-01-01", 9, {}),
      session("2026-01-02", 7, {}), // abaixo de 8
    ];
    const result = evaluateMasteryCriteria(sessions, criteria);
    expect(result.met).toBe(false);
    expect(result.currentStreak).toBe(0);
  });
});

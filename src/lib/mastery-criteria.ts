/**
 * Lógica pura de avaliação do critério de domínio ESTRUTURADO de um
 * programa terapêutico (F10) — compara as sessões de coleta mais recentes
 * contra o critério configurado e diz se foi atingido. Nunca decide nada
 * por conta própria: só avisa. Avançar de fase/status continua uma ação
 * manual do profissional (updateProgramStatus).
 */

export interface DataSessionTally {
  independentCount: number;
  verbalPromptCount: number;
  gesturalPromptCount: number;
  physicalPromptCount: number;
  incorrectCount: number;
}

export type MasteryCriteriaType = "percentage_independent" | "consecutive_correct_count";

export interface StructuredMasteryCriteria {
  type: MasteryCriteriaType;
  /** Percentual (0-100) se type=percentage_independent; contagem mínima se type=consecutive_correct_count. */
  threshold: number;
  /** Quantas sessões SEGUIDAS mais recentes precisam bater o threshold. */
  consecutiveSessions: number;
}

export interface MasteryEvaluationResult {
  met: boolean;
  /** Quantas das sessões mais recentes (até consecutiveSessions) já bateram o threshold, contando a partir da mais recente. Para quando a primeira falha. */
  currentStreak: number;
  /** Null quando não há sessões suficientes ainda para avaliar. */
  sessionsEvaluated: { sessionDate: string; value: number; metThreshold: boolean }[];
}

function totalTrials(session: DataSessionTally): number {
  return (
    session.independentCount +
    session.verbalPromptCount +
    session.gesturalPromptCount +
    session.physicalPromptCount +
    session.incorrectCount
  );
}

function sessionValue(session: DataSessionTally, type: MasteryCriteriaType): number {
  if (type === "percentage_independent") {
    const total = totalTrials(session);
    return total === 0 ? 0 : (session.independentCount / total) * 100;
  }
  return session.independentCount;
}

/**
 * `sessions` deve vir ordenada da mais ANTIGA para a mais RECENTE (mesma
 * ordem que getDataSessionsForProgram já devolve) — aqui olhamos só a
 * "cauda" (as últimas N) pra decidir a sequência atual.
 */
export function evaluateMasteryCriteria(
  sessions: (DataSessionTally & { sessionDate: string })[],
  criteria: StructuredMasteryCriteria,
): MasteryEvaluationResult {
  const recent = sessions.slice(-criteria.consecutiveSessions);

  const evaluated = recent.map((session) => {
    const value = sessionValue(session, criteria.type);
    return { sessionDate: session.sessionDate, value, metThreshold: value >= criteria.threshold };
  });

  // Sequência atual: anda da mais recente para a mais antiga, parando na
  // primeira que não bateu o critério — uma sessão fraca no meio do
  // histórico não "some" retroativamente, só reseta a contagem a partir
  // dela.
  let currentStreak = 0;
  for (let i = evaluated.length - 1; i >= 0; i--) {
    if (evaluated[i].metThreshold) currentStreak++;
    else break;
  }

  const met = sessions.length >= criteria.consecutiveSessions && currentStreak >= criteria.consecutiveSessions;

  return { met, currentStreak, sessionsEvaluated: evaluated };
}

import type { RecurrenceFrequency } from "@/lib/supabase/types";

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export interface GenerateOccurrencesParams {
  startDate: string;
  endDate: string | null;
  frequency: RecurrenceFrequency;
  dayOfWeek: number;
  maxOccurrences: number | null;
  /** Horizonte quando não há data final nem quantidade máxima — evita gerar
   * infinito. A recepção pode gerar mais ocorrências depois (extendSeries). */
  horizonMonths?: number;
}

const SAFETY_MAX_OCCURRENCES = 104;

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIso(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function firstOccurrenceDate(startDate: string, dayOfWeek: number): Date {
  const d = parseIso(startDate);
  while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
  return d;
}

function lastWeekdayOfMonth(year: number, monthIndex: number, dayOfWeek: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0);
  const offset = (lastDay.getDay() - dayOfWeek + 7) % 7;
  lastDay.setDate(lastDay.getDate() - offset);
  return lastDay;
}

/** N-ésima ocorrência de um dia da semana num mês (ex.: 2ª terça). Se o mês
 * não tiver essa ordinal (ex. "5ª sexta"), cai na última ocorrência do mês —
 * mesmo comportamento de agendas como o Google Calendar. */
function nthWeekdayOfMonth(year: number, monthIndex: number, dayOfWeek: number, ordinal: number): Date {
  const first = new Date(year, monthIndex, 1);
  const offset = (dayOfWeek - first.getDay() + 7) % 7;
  const day = 1 + offset + (ordinal - 1) * 7;
  const candidate = new Date(year, monthIndex, day);
  if (candidate.getMonth() !== monthIndex) {
    return lastWeekdayOfMonth(year, monthIndex, dayOfWeek);
  }
  return candidate;
}

/**
 * Gera as datas (YYYY-MM-DD) das ocorrências de uma recorrência. Semanal =
 * +7 dias; quinzenal = +14 dias; mensal = mesma ocorrência ordinal do dia da
 * semana a cada mês (ex. "toda 2ª terça"). Teto de segurança de 104
 * ocorrências por geração, independente dos parâmetros recebidos.
 */
export function generateOccurrenceDates(params: GenerateOccurrencesParams): string[] {
  const { startDate, endDate, frequency, dayOfWeek, maxOccurrences, horizonMonths = 12 } = params;

  const first = firstOccurrenceDate(startDate, dayOfWeek);

  let horizonCutoff: string | null = null;
  if (!endDate && !maxOccurrences) {
    const cutoff = parseIso(startDate);
    cutoff.setMonth(cutoff.getMonth() + horizonMonths);
    horizonCutoff = toIso(cutoff);
  }

  const limit = maxOccurrences ? Math.min(maxOccurrences, SAFETY_MAX_OCCURRENCES) : SAFETY_MAX_OCCURRENCES;
  const results: string[] = [];

  if (frequency === "monthly") {
    const ordinal = Math.ceil(first.getDate() / 7);
    let monthIndex = first.getMonth();
    let year = first.getFullYear();

    for (let i = 0; i < limit; i++) {
      const candidate = nthWeekdayOfMonth(year, monthIndex, dayOfWeek, ordinal);
      const iso = toIso(candidate);
      if (endDate && iso > endDate) break;
      if (horizonCutoff && iso > horizonCutoff) break;
      results.push(iso);

      monthIndex += 1;
      if (monthIndex > 11) {
        monthIndex = 0;
        year += 1;
      }
    }
    return results;
  }

  const stepDays = frequency === "biweekly" ? 14 : 7;
  const cursor = new Date(first);

  for (let i = 0; i < limit; i++) {
    const iso = toIso(cursor);
    if (endDate && iso > endDate) break;
    if (horizonCutoff && iso > horizonCutoff) break;
    results.push(iso);
    cursor.setDate(cursor.getDate() + stepDays);
  }

  return results;
}

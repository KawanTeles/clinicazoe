/**
 * Formata um Date como YYYY-MM-DD usando os componentes de calendário
 * LOCAIS (nunca `toISOString()`, que é UTC). Misturar os dois quadros de
 * referência na mesma função — validar `date.getDay()` (local) e devolver
 * `date.toISOString()` (UTC) — faz a data "rolar" para o dia seguinte ou
 * anterior sempre que a hora do processo estiver perto da virada de meia-
 * noite UTC, quebrando a comparação com `day_of_week` armazenado no banco.
 */
export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "Hoje" no calendário local do processo (nunca UTC) como YYYY-MM-DD. */
export function todayLocalIso(): string {
  return toLocalIsoDate(new Date());
}

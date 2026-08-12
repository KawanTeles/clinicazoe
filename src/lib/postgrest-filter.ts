/**
 * Monta o valor de um filtro `ilike` do PostgREST (`coluna.ilike.VALOR`)
 * para uso dentro de `.or()`/`.and()`, a partir de um termo de busca livre
 * do usuário. A sintaxe do PostgREST usa vírgula para separar condições e
 * parênteses para aninhar `and()`/`or()` — um termo de busca contendo
 * vírgula quebraria isso, injetando uma cláusula de filtro extra não
 * pretendida. A forma de proteger caracteres reservados (`,`, `.`, `:`,
 * `(`, `)`) é envolver o valor inteiro (aqui, já com os wildcards `%`)
 * entre aspas duplas — não um escape por backslash antes da vírgula, que
 * o parser do PostgREST ignora (a divisão em condições acontece num nível
 * de parsing anterior ao dos escapes de valor individual).
 * Referência: https://docs.postgrest.org — "If the filter value has a
 * reserved character, then you need to wrap it in double quotes".
 */
export function buildIlikeFilterValue(term: string): string {
  const escaped = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

/**
 * Slugs amigáveis para URLs públicas (ex.: /profissionais/dra-beatriz-lima-a1b2c3d4).
 * O sufixo com os 8 primeiros caracteres do UUID garante unicidade mesmo
 * quando dois registros têm nomes iguais, sem exigir uma coluna extra no
 * banco nem alterar regra de negócio nenhuma — é derivado só para roteamento.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildEntitySlug(name: string, id: string): string {
  return `${slugify(name)}-${id.slice(0, 8)}`;
}

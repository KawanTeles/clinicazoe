import { revalidatePath } from "next/cache";

// Todas essas páginas — mais /profissionais/[slug] e /especialidades/[slug],
// revalidadas à parte por serem rotas dinâmicas — chamam getPublicWebsiteData()
// (src/lib/public-queries.ts) e são pré-renderizadas estaticamente: sem
// revalidação sob demanda, ficam com cache antigo até o próximo redeploy.
// clinic_settings, specialties e professionals/profiles afetam esse conjunto
// inteiro (ex: renomear uma especialidade muda o card do profissional em
// várias dessas páginas), por isso o mesmo conjunto amplo serve os três.
const PUBLIC_SITE_PATHS = [
  "/",
  "/clinica",
  "/contato",
  "/estrutura",
  "/convenios",
  "/especialidades",
  "/profissionais",
  "/equipe",
  "/cliente/login",
  "/cliente/signup",
];

/** Revalida todo o site público que depende de getPublicWebsiteData()
 * (clínica, especialidades, profissionais) — chame ao final de qualquer
 * mutação em clinic_settings, specialties ou professionals/profiles que
 * afete o que aparece publicamente. */
export function revalidatePublicSite() {
  for (const path of PUBLIC_SITE_PATHS) revalidatePath(path);
  revalidatePath("/profissionais/[slug]", "page");
  revalidatePath("/especialidades/[slug]", "page");
}

// Convênios hoje só aparecem em /convenios — getPublicWebsiteData().insurances
// não é consumido por nenhuma outra página pública (conferido em todos os
// consumidores de getPublicWebsiteData()).
/** Revalida as páginas públicas que listam convênios aceitos. */
export function revalidatePublicInsurancePages() {
  revalidatePath("/convenios");
}

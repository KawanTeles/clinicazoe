/**
 * Feature bundle do Framer Motion carregado sob demanda pelo LazyMotion.
 * Separado em arquivo próprio para virar um chunk assíncrono independente
 * do bundle inicial — só é baixado depois que a página já pintou. Precisa
 * ser domMax (não domAnimation): o indicador ativo do menu de navegação usa
 * `layoutId="activePill"` (PublicHeader), e a feature de layout animation só
 * existe no bundle domMax.
 *
 * Seguro carregar assíncrono porque nada no caminho crítico de LCP depende
 * dele: o hero (PageEntrance) foi migrado para CSS puro exatamente por
 * causa disso — antes, o conteúdo do hero ficava em opacity:0 esperando
 * este import resolver, o que empurrava o LCP para trás. Componentes que
 * ainda usam m.* (AnimatedCard, ScrollReveal, header) só animam
 * hover/scroll/menu — nenhum é o elemento de LCP da página.
 */
export default async function loadFramerFeatures() {
  const { domMax } = await import("framer-motion");
  return domMax;
}

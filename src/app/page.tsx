import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { LocationSection } from "@/components/public/LocationSection";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { EmptyState } from "@/components/public/EmptyState";
import { PhotoCarousel, type PhotoCarouselSlide } from "@/components/public/PhotoCarousel";
import { MarqueeCarousel, type MarqueeSlide } from "@/components/public/MarqueeCarousel";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { AnimatedCounter } from "@/components/animation/AnimatedCounter";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { FeaturedProfessionalCard } from "@/components/public/FeaturedProfessionalCard";
import { SpecialtyIcon } from "@/components/public/SpecialtyIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CTA_PRIMARY, CTA_VIEW_ALL_PROFESSIONALS, CTA_VIEW_ALL_SPECIALTIES } from "@/lib/cta-labels";
import { SITE_URL } from "@/lib/site-url";
import { buildEntitySlug } from "@/lib/slug";

const TITLE = "Espaço Zoe — Medicina de Alta Performance e Saúde Integrada";
const DESCRIPTION =
  "Referência em atendimento clínico de excelência, corpo clínico renomado, tecnologia de ponta e agendamento 100% online. Marque seu atendimento com o Espaço Zoe.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Fallback enquanto não há fotos cadastradas em Configurações → Galeria —
// sem imageUrl, o PhotoCarousel renderiza o placeholder "Foto em breve".
const HOME_GALLERY_PLACEHOLDER_SLIDES: PhotoCarouselSlide[] = [
  { id: "recepcao", caption: "Recepção" },
  { id: "consultorios", caption: "Consultórios" },
  { id: "sala-espera", caption: "Sala de Espera" },
  { id: "area-externa", caption: "Área Externa" },
];

// Texto placeholder da Jornada do Paciente — estrutura aprovada, mas a
// redação ainda deve ser revisada/ajustada pelo Espaço Zoe antes de publicar.
const PATIENT_JOURNEY_STEPS: { title: string; description: string; note: string }[] = [
  {
    title: "Contato inicial e acolhimento",
    description:
      "Você entra em contato pelo WhatsApp ou telefone. Nossa equipe tira as primeiras dúvidas e agenda uma conversa inicial de escuta.",
    note: "Um espaço aberto para ouvir a família e entender as necessidades da criança.",
  },
  {
    title: "Avaliação multidisciplinar",
    description:
      "Nossa equipe realiza uma avaliação inicial para compreender o perfil de desenvolvimento e as demandas específicas da criança.",
    note: "Um olhar integrado sobre comunicação, comportamento e desenvolvimento.",
  },
  {
    title: "Plano terapêutico individualizado",
    description:
      "Construímos um plano de atendimento sob medida, alinhando especialidades, frequência e metas terapêuticas com a família.",
    note: "Planejamento pensado para a realidade e o ritmo de cada família.",
  },
  {
    title: "Acompanhamento contínuo",
    description:
      "Início dos atendimentos com acompanhamento constante da evolução, em parceria com a família e, quando necessário, com a escola.",
    note: "Evolução acompanhada de perto, com comunicação transparente.",
  },
];

// "Por que escolher" — condensado a partir dos Valores já publicados em
// /clinica (mesmo conteúdo, redação mais curta para o formato de card).
const WHY_CHOOSE_ZOE_ITEMS: { title: string; description: string; icon: ReactNode }[] = [
  {
    title: "Acolhimento",
    description: "Cada família é recebida com empatia, escuta e cuidado, desde o primeiro contato.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    title: "Respeito ao ritmo da criança",
    description: "Acreditamos no tempo, no ritmo e na singularidade de cada criança — sem fórmulas prontas.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
        <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" />
        <path d="M16 17h4" />
        <path d="M4 13h4" />
      </svg>
    ),
  },
  {
    title: "Cuidado com quem cuida",
    description: "Fortalecemos profissionais e famílias com suporte contínuo, não só a criança.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Excelência com leveza",
    description: "Qualidade técnica e científica, sem perder a humanidade no dia a dia do atendimento.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18" />
        <path d="M5 8l-3 5a5 5 0 0 0 6 0l-3-5" />
        <path d="M19 8l-3 5a5 5 0 0 0 6 0l-3-5" />
        <path d="M5 8h14" />
      </svg>
    ),
  },
  {
    title: "Compromisso com a transformação",
    description: "Cada atendimento é pensado como um passo real na evolução e autonomia da criança.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 6l-9.5 9.5-5-5L1 18" />
        <path d="M17 6h6v6" />
      </svg>
    ),
  },
];

export default async function HomePage() {
  const { clinic, specialties, professionals, featuredProfessionals, galleryImages, insurances } = await getPublicWebsiteData();

  // Sem curadoria manual ainda (Configurações → Profissionais em Destaque),
  // cai para os primeiros por ordem alfabética — a seção nunca fica vazia
  // só porque ninguém configurou o destaque.
  const homeProfessionals = featuredProfessionals.length > 0 ? featuredProfessionals : professionals.slice(0, 4);

  const gallerySlides: PhotoCarouselSlide[] =
    galleryImages.length > 0
      ? galleryImages.map((image) => ({
          id: image.id,
          imageUrl: image.url,
          alt: image.altText ?? "",
          caption: image.altText ?? undefined,
        }))
      : HOME_GALLERY_PLACEHOLDER_SLIDES;

  const specialtySlides: MarqueeSlide[] = specialties.map((spec) => ({
    id: spec.id,
    content: (
      <AnimatedCard className="p-6 h-full flex flex-col justify-between">
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated text-[var(--icon-informative)] border border-[rgba(130,169,160,0.25)] mb-4 shadow-sm">
            <SpecialtyIcon name={spec.name} />
          </div>
          <h3 className="text-base font-bold text-text-primary font-heading">
            {spec.name}
          </h3>
          {spec.description && (
            <p className="mt-1 text-xs text-text-secondary leading-relaxed line-clamp-3">{spec.description}</p>
          )}
        </div>
        <Link href={`/especialidades/${buildEntitySlug(spec.name, spec.id)}`} className="mt-6 text-xs font-bold text-[var(--link)] hover:underline inline-flex items-center gap-1">
          Ver detalhes →
        </Link>
      </AnimatedCard>
    ),
  }));

  // FAQ — conjunto fixo revisável no código (sem admin nesta primeira
  // versão). Respostas com dado real (especialidades, endereço) puxam de
  // getPublicWebsiteData() ou linkam para a página com a informação completa,
  // em vez de duplicar texto fixo.
  const specialtyNamesList = specialties.length > 0 ? specialties.map((s) => s.name).join(", ") : null;

  const faqItems: { question: string; answer: ReactNode }[] = [
    {
      question: "Quais especialidades a Espaço Zoe oferece?",
      answer: specialtyNamesList
        ? `Nosso corpo clínico multidisciplinar atua em: ${specialtyNamesList}. Veja detalhes de cada especialidade na página de Especialidades.`
        : "Nosso quadro de especialidades está sendo atualizado. Entre em contato para saber mais.",
    },
    {
      question: "Como faço para agendar minha primeira consulta?",
      answer:
        "Você pode agendar diretamente pelo botão \"Agendar Atendimento\" no site, ou falar com nossa equipe pelo WhatsApp para tirar dúvidas antes de marcar.",
    },
    {
      question: "A Espaço Zoe atende por convênio?",
      answer: (
        <>
          Trabalhamos com convênios e também atendimento particular.{" "}
          <Link href="/convenios" className="font-bold text-[var(--link)] hover:underline">
            Veja a lista completa de convênios aceitos →
          </Link>
        </>
      ),
    },
    {
      question: "Qual o endereço e horário de funcionamento?",
      answer: (
        <>
          {clinic.address ? `Estamos localizados em ${clinic.address}. ` : ""}
          Confira o mapa, os horários detalhados e como chegar na página de{" "}
          <Link href="/contato" className="font-bold text-[var(--link)] hover:underline">
            Contato →
          </Link>
        </>
      ),
    },
    {
      question: "Como funciona o acompanhamento da evolução da criança?",
      answer:
        "Após o início dos atendimentos, a equipe acompanha a evolução de perto, com comunicação transparente com a família e, quando necessário, articulação com a escola.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} logoUrl={clinic.logo_url} />

      <main>
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-36 lg:pt-24 lg:pb-40 bg-gradient-forest-subtle">
        {/* Ambient Glow & Organic Shapes — fundo padrão, usado sozinho
            quando não há foto de capa configurada. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Main Purple Blob */}
          <div className="absolute -top-[10%] -left-[10%] h-[500px] w-[500px] rounded-full bg-[var(--primary)]/5 blur-[100px] animate-float-organic" />

          {/* Secondary Green Blob */}
          <div className="absolute top-[20%] right-[5%] h-[400px] w-[400px] rounded-[100px] bg-[var(--secondary)]/5 blur-[80px] animate-float-organic-slow rotate-12" />

          {/* Small Decorative Accent */}
          <div className="absolute bottom-[10%] left-[20%] h-[300px] w-[300px] rounded-full bg-[var(--primary)]/5 blur-[90px] animate-float-organic-slow" />
        </div>

        {/* Foto de capa full-bleed (Configurações → Foto de Capa) — sem foto
            configurada, o fundo padrão acima segue normalmente, sem nenhuma
            mudança. Foto em opacidade total; só um véu bem sutil e
            concentrado no lado do texto (esquerda) pra manter o título
            legível, quase transparente no restante da imagem. */}
        {clinic.facade_image_url && (
          <div className="absolute inset-0">
            <Image
              src={clinic.facade_image_url}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              unoptimized
              priority
            />
            {/* Nuance colorida (verde e lilás) com boa transparência, e um fundo sutil pra legibilidade sem lavar a imagem */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)]/50 from-0% via-[var(--background)]/10 via-40% to-transparent to-70%" />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/25 from-0% via-[var(--secondary)]/20 via-40% to-transparent to-70%" />
          </div>
        )}

        {/* Espaçamento progressivo usando margens fixas em 'rem' para garantir um recuo elegante que nunca fica colado e nem centraliza demais */}
        <div className="w-full px-6 sm:px-8 lg:pl-32 xl:pl-48 2xl:pl-64 relative z-10">
          <PageEntrance>
            {/* -ml-4 aplica exatamente -16px de margem esquerda total */}
            <div className="max-w-3xl space-y-6 -ml-38">
              <PageEntranceItem>
                <h1 className="tracking-hero text-4xl sm:text-5xl lg:text-6xl font-black text-[var(--primary)] leading-[1.12] font-heading">
                  Atendimentos com{" "}
                  <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent drop-shadow-sm">
                    excelência
                  </span>{" "}
                  e acolhimento.
                </h1>
              </PageEntranceItem>

              <PageEntranceItem>
                <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl font-normal">
                  No {clinic.name || "Espaço Zoe"}, possuímos uma equipe terapêutica especializada para oferecer um atendimento verdadeiramente humanizado.
                </p>
              </PageEntranceItem>

              <PageEntranceItem>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                  <Link href="/agendar">
                    <Button
                      size="lg"
                      withArrow
                      className="w-full sm:w-auto font-bold shadow-[0_12px_35px_rgba(30,104,90,0.35)]"
                    >
                      {CTA_PRIMARY}
                    </Button>
                  </Link>
                  <Link href="/profissionais">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full sm:w-auto font-bold border border-border/80 hover:border-primary/60"
                    >
                      Conhecer corpo clínico
                    </Button>
                  </Link>
                </div>
              </PageEntranceItem>
            </div>
          </PageEntrance>
        </div>
      </section>

      {/* FAIXA DE TRANSIÇÃO (Números Flutuantes na Emenda) — o card sempre
          sobrepõe a emenda entre hero e Diferenciais (mesmo no mobile), só
          que com um puxão pra cima menor (-translate-y-[35%] em vez de
          -translate-y-1/2): como a % é sempre relativa à própria altura do
          card, ela se ajusta sozinha a qualquer altura de card, e a menor
          fração deixa folga suficiente pros botões da hero mesmo com o
          card mais alto (empilhado em coluna). */}
      <div className="relative z-20 h-0 w-full">
        <div className="absolute top-0 left-0 right-0 -translate-y-[35%] px-4 sm:-translate-y-1/2 sm:px-6 lg:px-8">
          <ScrollReveal animation="fade-up">
            <div className="mx-auto flex max-w-[900px] flex-col items-center justify-between gap-3 rounded-2xl border border-[rgba(130,169,160,0.2)] bg-card p-5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] sm:flex-row sm:gap-8 sm:p-8">
              <div className="flex w-full flex-1 flex-col items-center">
                <p className="text-2xl font-black text-[var(--link)] font-heading drop-shadow-sm sm:text-4xl">
                  <AnimatedCounter value="99.8%" />
                </p>
                <p className="mt-0.5 text-center text-[11px] font-bold uppercase tracking-wider text-text-secondary sm:mt-2 sm:text-xs">Satisfação</p>
              </div>

              {/* Divisor */}
              <div className="hidden h-12 w-px bg-border/80 sm:block"></div>
              <div className="h-px w-16 bg-border/80 sm:hidden"></div>

              <div className="flex w-full flex-1 flex-col items-center">
                <p className="text-2xl font-black text-[var(--link)] font-heading drop-shadow-sm sm:text-4xl">
                  <AnimatedCounter value="+15k" />
                </p>
                <p className="mt-0.5 text-center text-[11px] font-bold uppercase tracking-wider text-text-secondary sm:mt-2 sm:text-xs">Atendimentos</p>
              </div>

              {/* Divisor */}
              <div className="hidden h-12 w-px bg-border/80 sm:block"></div>
              <div className="h-px w-16 bg-border/80 sm:hidden"></div>

              <div className="flex w-full flex-1 flex-col items-center">
                <p className="text-2xl font-black text-[var(--link)] font-heading drop-shadow-sm sm:text-4xl">
                  <AnimatedCounter value="100%" />
                </p>
                <p className="mt-0.5 text-center text-[11px] font-bold uppercase tracking-wider text-text-secondary sm:mt-2 sm:text-xs">Especialistas</p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* SEÇÃO DIFERENCIAIS DA CLÍNICA */}
      {/* pt no mobile acomoda os ~65% do card flutuante que ficam abaixo da
          linha (só 35% sobem pra dentro da hero); sm:pt-32/lg:pt-36
          acomodam a metade do card (overlap de 50%, como no desktop). */}
      <section className="pb-24 pt-48 sm:pt-32 lg:pt-36 bg-gradient-brand-light relative overflow-hidden">
        {/* Soft floating background element */}
        <div className="absolute top-1/4 -right-[10%] h-[400px] w-[400px] rounded-full bg-[var(--primary)]/5 blur-[80px] animate-float-organic-slow pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <ScrollReveal animation="fade-up">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--primary)] mt-2 font-heading">
                Diferenciais que garantem sua tranquilidade
              </h2>
              <p className="text-sm sm:text-base text-text-secondary">
                Compromisso com o cuidado contínuo, diagnósticos ágeis e ambiente acolhedor.
              </p>
            </ScrollReveal>
          </div>

          {/* Bento grid with AnimatedCard */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 lg:row-span-2">
              <AnimatedCard delayMs={100} className="h-full rounded-[1.75rem] p-2">
                <div className="rounded-[calc(1.75rem-0.375rem)] border border-border/80 bg-card-elevated/90 p-8 lg:p-10 shadow-inner h-full flex flex-col justify-between group">
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-[var(--icon-informative)] border border-[rgba(130,169,160,0.3)] shadow-[0_0_15px_rgba(130,169,160,0.18)] mb-6 transition-transform duration-300 group-hover:scale-110">
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-[var(--primary)] font-heading">Atendimento Humanizado</h3>
                    <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-md">
                      Atendimentos individuais estendidos, sem correria, focados no histórico biológico, estilo de vida e necessidades do paciente. Uma experiência de cuidado pensada em cada detalhe.
                    </p>
                  </div>
                  <Link href="/clinica" className="mt-8 text-xs font-bold text-[var(--link)] hover:underline inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Saiba mais sobre a clínica →
                  </Link>
                </div>
              </AnimatedCard>
            </div>

            <div className="lg:col-span-5">
              <AnimatedCard delayMs={200} className="p-6 sm:p-7 h-full">
                <div className="flex items-center gap-5 group">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card-elevated text-[var(--icon-informative)] border border-[rgba(130,169,160,0.3)] shadow-[0_0_15px_rgba(130,169,160,0.15)] group-hover:scale-105 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--primary)] font-heading">Convênios</h3>
                    <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                      Ampla cobertura de planos de saúde e atendimento particular com facilidades.
                    </p>
                    <Link href="/convenios" className="mt-3 text-xs font-bold text-[var(--link)] hover:underline inline-flex items-center gap-1">
                      Ver convênios →
                    </Link>
                  </div>
                </div>
              </AnimatedCard>
            </div>

            <div className="lg:col-span-5">
              <AnimatedCard delayMs={300} className="p-6 sm:p-7 h-full">
                <div className="flex items-center gap-5 group">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card-elevated text-[var(--icon-informative)] border border-[rgba(130,169,160,0.3)] shadow-[0_0_15px_rgba(130,169,160,0.15)] group-hover:scale-105 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
                      <path d="M22 10v6" />
                      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--primary)] font-heading">Corpo Clínico Qualificado</h3>
                    <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                      Especialistas com atuação em hospitais renomados.
                    </p>
                    <Link href="/profissionais" className="mt-3 text-xs font-bold text-[var(--link)] hover:underline inline-flex items-center gap-1">
                      Ver corpo clínico →
                    </Link>
                  </div>
                </div>
              </AnimatedCard>
            </div>
          </div>

          {insurances.length > 0 && (
            <ScrollReveal animation="fade-up">
              <div className="pt-2 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-5">Convênios Aceitos</p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {insurances.map((ins) =>
                    ins.logo_url ? (
                      <span
                        key={ins.id}
                        className="inline-flex items-center gap-2 rounded-full border border-[rgba(130,169,160,0.25)] bg-card pl-2 pr-4 py-2 text-xs font-bold text-text-primary"
                      >
                        <Image
                          src={ins.logo_url}
                          alt=""
                          width={20}
                          height={20}
                          className="h-5 w-5 rounded-full object-contain bg-white"
                          unoptimized
                        />
                        {ins.name}
                      </span>
                    ) : (
                      <span
                        key={ins.id}
                        className="rounded-full border border-[rgba(130,169,160,0.25)] bg-card px-4 py-2 text-xs font-bold text-text-primary"
                      >
                        {ins.name}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </ScrollReveal>
          )}
        </div>
      </section>

      {/* SEÇÃO GALERIA DO ESPAÇO */}
      <section className="py-24 border-t border-border/70 bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <ScrollReveal animation="fade-up">
              <Badge tone="premium" className="border border-[rgba(130,169,160,0.3)]">Nosso Espaço</Badge>
              <h2 className="text-3xl font-extrabold text-[var(--primary)] mt-2 font-heading">
                Conheça o Espaço Zoe
              </h2>
              <p className="text-sm text-text-secondary">
                Ambientes pensados para o seu conforto e acolhimento em cada visita.
              </p>
            </ScrollReveal>
          </div>

          <ScrollReveal animation="scale-up">
            <PhotoCarousel slides={gallerySlides} className="max-w-4xl mx-auto" />
          </ScrollReveal>

          <ScrollReveal animation="fade-up">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-2.5 rounded-full border border-[rgba(130,169,160,0.25)] bg-card px-4 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--link)]">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="text-xs font-bold text-text-primary">Segurança sensorial</span>
              </div>

              <div className="flex items-center gap-2.5 rounded-full border border-[rgba(130,169,160,0.25)] bg-card px-4 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--link)]">
                  <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
                  <path d="m16 9-5.5 5.5L8 12" />
                </svg>
                <span className="text-xs font-bold text-text-primary">Materiais certificados</span>
              </div>

              <div className="flex items-center gap-2.5 rounded-full border border-[rgba(130,169,160,0.25)] bg-card px-4 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--link)]">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <span className="text-xs font-bold text-text-primary">Fácil acesso</span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* SEÇÃO PREVIEW ESPECIALIDADES */}
      <section className="py-24 border-t border-border/70 bg-background relative overflow-hidden">
        {/* Soft floating organic shape in background */}
        <div className="absolute top-1/3 -left-[5%] h-[300px] w-[300px] rounded-full bg-[var(--secondary)]/5 blur-[70px] animate-float-organic-slow pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <ScrollReveal animation="slide-left">
              <Badge tone="premium" className="border border-[var(--border)]">Especialidades Terapêuticas</Badge>
              <h2 className="text-3xl font-extrabold text-[var(--primary)] mt-2 font-heading">
                Atendimento integral para todas as idades
              </h2>
            </ScrollReveal>
            <ScrollReveal animation="slide-right">
              <Link href="/especialidades">
                <Button variant="secondary" size="sm" withArrow className="font-bold border border-border/80 hover:border-primary/60">
                  {CTA_VIEW_ALL_SPECIALTIES}
                </Button>
              </Link>
            </ScrollReveal>
          </div>

          {specialties.length === 0 ? (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              }
              title="Especialidades em cadastro"
              description="Nosso quadro de especialidades está sendo atualizado. Entre em contato para saber mais."
              action={{ label: "Falar com nossa equipe", href: "/contato" }}
            />
          ) : (
            <MarqueeCarousel slides={specialtySlides} cardClassName="w-64 sm:w-72" ariaLabel="Especialidades em destaque" />
          )}
        </div>
      </section>

      {/* SEÇÃO PREVIEW PROFISSIONAIS */}
      <section className="py-24 border-t border-border/70 bg-gradient-brand-light relative overflow-hidden">
        {/* Soft floating organic shape in background */}
        <div className="absolute bottom-0 right-[5%] h-[350px] w-[350px] rounded-full bg-[var(--primary)]/5 blur-[80px] animate-float-organic pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <ScrollReveal animation="fade-up">
              <Badge tone="success" className="border border-[var(--border)] bg-white/50">Corpo Clínico</Badge>
              <h2 className="text-3xl font-extrabold text-[var(--primary)] font-heading">
                Conheça nosso corpo clínico
              </h2>
              <p className="text-sm text-text-secondary">
                Profissionais qualificados prontos para acolher você e sua família.
              </p>
            </ScrollReveal>
          </div>

          {professionals.length === 0 ? (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
              title="Equipe em formação"
              description="Estamos ampliando nosso corpo clínico. Entre em contato para saber mais."
              action={{ label: "Falar com nossa equipe", href: "/contato" }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {homeProfessionals.map((prof, index) => (
                <ScrollReveal key={prof.id} animation="fade-up" delayMs={index * 100}>
                  <FeaturedProfessionalCard professional={prof} />
                </ScrollReveal>
              ))}
            </div>
          )}

          <div className="text-center pt-4">
            <ScrollReveal animation="fade-up">
              <Link href="/profissionais">
                <Button size="lg" variant="secondary" withArrow className="font-bold border border-border/80 hover:border-primary/60">
                  {CTA_VIEW_ALL_PROFESSIONALS}
                </Button>
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* SEÇÃO JORNADA DO PACIENTE */}
      <section className="py-24 border-t border-border/70 bg-background relative overflow-hidden">
        {/* Soft floating organic shape in background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[350px] w-[600px] rounded-full bg-[var(--primary)]/5 blur-[100px] animate-float-organic-slow pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <ScrollReveal animation="fade-up">
              <Badge tone="premium" className="border border-[var(--border)]">Jornada do Paciente</Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--primary)] mt-2 font-heading">
                Como funciona o atendimento
              </h2>
              <p className="text-sm sm:text-base text-text-secondary">
                Um processo estruturado, com transparência em cada etapa, desde o primeiro contato até o acompanhamento contínuo.
              </p>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PATIENT_JOURNEY_STEPS.map((step, index) => (
              <AnimatedCard key={step.title} delayMs={index * 120} className="p-6 sm:p-7 h-full flex flex-col">
                <span className="text-3xl font-black text-[var(--primary)]/25 font-heading">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-base font-bold text-text-primary font-heading">{step.title}</h3>
                <p className="mt-2 text-xs text-text-secondary leading-relaxed flex-1">{step.description}</p>
                <p className="mt-4 pt-4 border-t border-border/60 text-[11px] text-[var(--link)] font-medium leading-relaxed">
                  {step.note}
                </p>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO POR QUE ESCOLHER */}
      <section className="py-24 border-t border-border/70 bg-gradient-brand-light relative overflow-hidden">
        {/* Soft floating organic shape in background */}
        <div className="absolute bottom-0 left-[10%] h-[350px] w-[350px] rounded-full bg-[var(--secondary)]/5 blur-[80px] animate-float-organic-slow pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <ScrollReveal animation="fade-up">
              <Badge tone="success" className="border border-[var(--border)] bg-white/50">Nossos Valores</Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--primary)] mt-2 font-heading">
                Por que escolher a Espaço Zoe
              </h2>
              <p className="text-sm sm:text-base text-text-secondary">
                Princípios que guiam cada atendimento, do primeiro contato ao acompanhamento contínuo.
              </p>
            </ScrollReveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_CHOOSE_ZOE_ITEMS.map((item, index) => (
              <AnimatedCard key={item.title} delayMs={index * 100} className="p-6 sm:p-7 h-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card-elevated text-[var(--icon-informative)] border border-[rgba(130,169,160,0.3)] shadow-[0_0_15px_rgba(130,169,160,0.15)] mb-5">
                  {item.icon}
                </div>
                <h3 className="text-base font-bold text-[var(--primary)] font-heading">{item.title}</h3>
                <p className="mt-2 text-xs text-text-secondary leading-relaxed">{item.description}</p>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO COMO CHEGAR / LOCALIZAÇÃO */}
      <LocationSection
        clinicName={clinic.name}
        address={clinic.address}
        whatsappNumber={clinic.whatsapp_number}
        email={clinic.email}
        businessHours={clinic.business_hours}
        holidayOpen={clinic.holiday_open}
        holidayOpenTime={clinic.holiday_open_time}
        holidayCloseTime={clinic.holiday_close_time}
        mapsUrl={clinic.maps_url}
        latitude={clinic.latitude}
        longitude={clinic.longitude}
      />

      {/* SEÇÃO FAQ */}
      <section className="py-24 border-t border-border/70 bg-surface/40">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <ScrollReveal animation="fade-up">
              <Badge tone="premium" className="border border-[var(--border)]">Dúvidas Frequentes</Badge>
              <h2 className="text-3xl font-extrabold text-[var(--primary)] mt-2 font-heading">
                Perguntas & Respostas
              </h2>
              <p className="text-sm text-text-secondary">
                Respostas claras para as principais dúvidas sobre o atendimento na Espaço Zoe.
              </p>
            </ScrollReveal>
          </div>

          <ScrollReveal animation="fade-up">
            <div className="space-y-4">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border border-border/70 bg-card px-6 py-5 open:shadow-card transition-shadow"
                >
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-bold text-sm text-text-primary [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-[var(--link)] transition-transform duration-300 group-open:rotate-180"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </summary>
                  <div className="mt-4 pt-4 border-t border-border/60 text-xs sm:text-sm text-text-secondary leading-relaxed">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-20 bg-[var(--primary)] relative overflow-hidden">
        {/* Decorative elements for the purple background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-0 h-64 w-64 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white/5 blur-[40px]" />
          <div className="absolute bottom-0 right-0 h-80 w-80 translate-y-1/3 translate-x-1/3 rounded-full bg-[var(--secondary)]/10 blur-[50px] animate-float-organic" />
        </div>
        <div className="mx-auto max-w-5xl px-4 text-center space-y-6 relative z-10">
          <ScrollReveal animation="scale-up">
            <Badge tone="neutral" className="bg-white/10 text-white border-white/20">Atendimento Prioritário</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 font-heading">
              Pronto para agendar seu atendimento?
            </h2>
            <p className="text-sm sm:text-base text-white/80 max-w-xl mx-auto">
              Nossa equipe está disponível para acolher você e sua família. Escolha o melhor horário.
            </p>
            <div className="pt-6">
              <Link href="/agendar">
                <Button size="lg" withArrow className="px-8 py-4 text-base font-bold shadow-[0_12px_35px_rgba(30,104,90,0.35)]">
                  {CTA_PRIMARY}
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
      </main>

      <PublicFooter
        clinicName={clinic.name}
        logoUrl={clinic.logo_url}
        address={clinic.address}
        whatsappNumber={clinic.whatsapp_number}
        email={clinic.email}
        phonePrimary={clinic.phone_primary}
        phoneSecondary={clinic.phone_secondary}
        emergencyPhone={clinic.emergency_phone}
        socialMedia={{
          instagram: clinic.instagram_url,
          facebook: clinic.facebook_url,
          linkedin: clinic.linkedin_url,
          youtube: clinic.youtube_url,
        }}
      />
    </div>
  );
}

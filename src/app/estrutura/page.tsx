import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PageHero } from "@/components/public/PageHero";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { PhotoCarousel, type PhotoCarouselSlide } from "@/components/public/PhotoCarousel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CTA_PRIMARY } from "@/lib/cta-labels";
import { SITE_URL } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/json-ld";

// Fallback enquanto não há fotos cadastradas em Configurações → Galeria —
// sem imageUrl, o PhotoCarousel renderiza o placeholder "Foto em breve".
const ESTRUTURA_GALLERY_PLACEHOLDER_SLIDES: PhotoCarouselSlide[] = [
  { id: "consultorio", caption: "Consultório Climatizado" },
  { id: "central-diagnostica", caption: "Central Diagnóstica" },
  { id: "esterilizacao", caption: "Sala de Esterilização" },
  { id: "recepcao", caption: "Recepção Premium" },
];

export const metadata = {
  title: "Estrutura e Tecnologia — Espaço Zoe",
  description: "Conheça a estrutura do Espaço Zoe: consultórios climatizados, central diagnóstica integrada, biossegurança rigorosa e acessibilidade para todos os pacientes.",
  alternates: { canonical: `${SITE_URL}/estrutura` },
  openGraph: {
    title: "Estrutura e Tecnologia — Espaço Zoe",
    description: "Conheça a estrutura do Espaço Zoe: consultórios climatizados, central diagnóstica integrada, biossegurança rigorosa e acessibilidade para todos os pacientes.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Estrutura e Tecnologia — Espaço Zoe",
    description: "Conheça a estrutura do Espaço Zoe: consultórios climatizados, central diagnóstica integrada, biossegurança rigorosa e acessibilidade para todos os pacientes.",
  },
};

export default async function EstruturaPage() {
  const { clinic, galleryImages } = await getPublicWebsiteData();

  const gallerySlides: PhotoCarouselSlide[] =
    galleryImages.length > 0
      ? galleryImages.map((image) => ({
          id: image.id,
          imageUrl: image.url,
          alt: image.altText ?? "",
          caption: image.altText ?? undefined,
        }))
      : ESTRUTURA_GALLERY_PLACEHOLDER_SLIDES;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Estrutura", item: `${SITE_URL}/estrutura` },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <PublicHeader clinicName={clinic.name} logoUrl={clinic.logo_url} />

      <main className="flex-1 py-16 lg:py-24">
        <PageEntrance className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-20">
          <PageEntranceItem>
            <PageHero
              breadcrumbItems={[{ label: "Início", href: "/" }, { label: "Estrutura" }]}
              title="Estrutura & Tecnologia"
              subtitle="Ambientes projetados para garantir segurança sanitária, privacidade e o máximo conforto durante o seu atendimento."
            />
          </PageEntranceItem>

          <h2 className="sr-only">Nossa Infraestrutura</h2>
          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ScrollReveal animation="slide-left">
              <AnimatedCard delayMs={100} className="rounded-3xl p-8 space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-elevated text-[var(--link)] border border-border">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
                    <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
                    <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-text-primary font-heading">Consultórios Climatizados & Acústicos</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Salas amplas com isolamento acústico total para sigilo e conforto do diálogo entre profissional e paciente.
                </p>
              </AnimatedCard>
            </ScrollReveal>

            <ScrollReveal animation="slide-right">
              <AnimatedCard delayMs={200} className="rounded-3xl p-8 space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-elevated text-[var(--link)] border border-border">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 2v2" />
                    <path d="M5 2v2" />
                    <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />
                    <path d="M8 15a6 6 0 0 0 12 0v-3" />
                    <circle cx="20" cy="10" r="2" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-text-primary font-heading">Central Diagnóstica Integrada</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Equipamentos modernos para exames de triagem e diagnósticos rápidos no próprio complexo.
                </p>
              </AnimatedCard>
            </ScrollReveal>

            <ScrollReveal animation="slide-left">
              <AnimatedCard delayMs={300} className="rounded-3xl p-8 space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-elevated text-[var(--link)] border border-border">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-text-primary font-heading">Biossegurança e Esterilização Rígida</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Controle rigoroso de assepsia seguindo protocolos da Anvisa e órgãos internacionais de saúde.
                </p>
              </AnimatedCard>
            </ScrollReveal>

            <ScrollReveal animation="slide-right">
              <AnimatedCard delayMs={400} className="rounded-3xl p-8 space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-elevated text-[var(--link)] border border-border">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                    <circle cx="7" cy="17" r="2" />
                    <path d="M9 17h6" />
                    <circle cx="17" cy="17" r="2" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-text-primary font-heading">Recepção Premium e Estacionamento</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Ambiente receptivo, serviço de valete e acessibilidade universal para pessoas com mobilidade reduzida.
                </p>
              </AnimatedCard>
            </ScrollReveal>
          </div>

          {/* Galeria do Espaço */}
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <ScrollReveal animation="fade-up">
                <Badge tone="premium" className="border border-[rgba(135,201,179,0.3)]">Galeria</Badge>
                <h2 className="text-3xl font-extrabold text-text-primary mt-2 font-heading">
                  Conheça nosso espaço físico
                </h2>
                <p className="text-sm text-text-secondary">
                  Um passeio visual pelos ambientes projetados para o seu bem-estar.
                </p>
              </ScrollReveal>
            </div>

            <ScrollReveal animation="scale-up">
              <PhotoCarousel slides={gallerySlides} className="max-w-4xl mx-auto" />
            </ScrollReveal>
          </div>

          <ScrollReveal animation="fade-up">
            <div className="text-center pt-8 border-t border-border/60">
              <Link href="/agendar">
                <Button size="lg" withArrow className="font-bold">
                  {CTA_PRIMARY}
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </PageEntrance>
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

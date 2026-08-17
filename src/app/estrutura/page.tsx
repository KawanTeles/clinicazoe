import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PageHero } from "@/components/public/PageHero";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { Button } from "@/components/ui/Button";
import { CTA_PRIMARY } from "@/lib/cta-labels";
import { SITE_URL } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/json-ld";

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
  const { clinic } = await getPublicWebsiteData();

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
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <line x1="3" x2="21" y1="9" y2="9" />
                    <line x1="9" x2="9" y1="21" y2="9" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-text-primary font-heading">Consultórios Climatizados & Acústicos</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Salas amplas com isolamento acústico total para sigilo e conforto do diálogo entre médico e paciente.
                </p>
              </AnimatedCard>
            </ScrollReveal>

            <ScrollReveal animation="slide-right">
              <AnimatedCard delayMs={200} className="rounded-3xl p-8 space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-elevated text-[var(--link)] border border-border">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
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
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-text-primary font-heading">Recepção Premium e Estacionamento</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Ambiente receptivo, serviço de valete e acessibilidade universal para pessoas com mobilidade reduzida.
                </p>
              </AnimatedCard>
            </ScrollReveal>
          </div>

          <ScrollReveal animation="fade-up">
            <div className="text-center pt-8 border-t border-border/60">
              <Link href="/cliente/login">
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

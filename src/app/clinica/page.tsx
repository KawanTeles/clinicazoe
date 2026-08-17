import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PageHero } from "@/components/public/PageHero";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CTA_PRIMARY } from "@/lib/cta-labels";
import { SITE_URL } from "@/lib/site-url";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata = {
  title: "A Clínica — História, Missão e Valores | Espaço Zoe",
  description: "Conheça a história, missão, visão e valores do Espaço Zoe: atendimento humanizado, ética médica e padrão internacional de qualidade em saúde integrada.",
  alternates: { canonical: `${SITE_URL}/clinica` },
  openGraph: {
    title: "A Clínica — História, Missão e Valores | Espaço Zoe",
    description: "Conheça a história, missão, visão e valores do Espaço Zoe: atendimento humanizado, ética médica e padrão internacional de qualidade em saúde integrada.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "A Clínica — História, Missão e Valores | Espaço Zoe",
    description: "Conheça a história, missão, visão e valores do Espaço Zoe: atendimento humanizado, ética médica e padrão internacional de qualidade em saúde integrada.",
  },
};

export default async function ClinicaPage() {
  const { clinic } = await getPublicWebsiteData();

  const breadcrumbItems = [{ label: "Início", href: "/" }, { label: "A Clínica" }];
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "A Clínica", item: `${SITE_URL}/clinica` },
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
              breadcrumbItems={breadcrumbItems}
              title={`A ${clinic.name || "Espaço Zoe"}`}
              subtitle="Inovação, ética e o acolhimento humano no centro de tudo que fazemos."
            />
          </PageEntranceItem>

          {/* History & Mission */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal animation="slide-left">
              <div className="space-y-6">
                <Badge tone="success">Nossa História</Badge>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary font-heading">
                  Uma trajetória construída com dedicação e rigor científico
                </h2>
                <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                  Fundada com o propósito de transformar a relação entre médicos e pacientes, o {clinic.name || "Espaço Zoe"} nasceu para combinar a alta precisão diagnóstica ao conforto e escuta ativa que cada indivíduo merece.
                </p>
                <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                  Ao longo dos anos, expandimos nossas especialidades e investimos continuamente na modernização de equipamentos e treinamento de nossa equipe.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="slide-right">
              <AnimatedCard className="rounded-3xl p-8 space-y-6">
                <div className="p-4 rounded-2xl bg-card-elevated border border-border/60">
                  <h3 className="text-base font-bold text-[var(--link)] font-heading">Missão</h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    Promover a saúde integral e prevenção personalizada através de condutas baseadas em evidências e atendimento humanizado.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-card-elevated border border-border/60">
                  <h3 className="text-base font-bold text-[var(--link)] font-heading">Visão</h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    Ser reconhecida como o centro médico modelo em inovação, satisfação do paciente e segurança clínica na região.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-card-elevated border border-border/60">
                  <h3 className="text-base font-bold text-[var(--link)] font-heading">Valores</h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    Ética inabalável, respeito à vida, transparência total e constante evolução técnica.
                  </p>
                </div>
              </AnimatedCard>
            </ScrollReveal>
          </div>

          {/* CTA */}
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

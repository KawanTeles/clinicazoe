import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PageHero } from "@/components/public/PageHero";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { EmptyState } from "@/components/public/EmptyState";
import { SmartGrid } from "@/components/public/SmartGrid";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CTA_PRIMARY } from "@/lib/cta-labels";
import { SITE_URL } from "@/lib/site-url";
import { buildEntitySlug } from "@/lib/slug";
import { safeJsonLd } from "@/lib/json-ld";

export const metadata = {
  title: "Especialidades Terapêuticas — Espaço Zoe",
  description: "Conheça todas as especialidades médicas atendidas no Espaço Zoe, com corpo clínico qualificado, diagnóstico preciso e cuidado humanizado em cada atendimento.",
  alternates: { canonical: `${SITE_URL}/especialidades` },
  openGraph: {
    title: "Especialidades Terapêuticas — Espaço Zoe",
    description: "Conheça todas as especialidades médicas atendidas no Espaço Zoe, com corpo clínico qualificado, diagnóstico preciso e cuidado humanizado em cada atendimento.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Especialidades Terapêuticas — Espaço Zoe",
    description: "Conheça todas as especialidades médicas atendidas no Espaço Zoe, com corpo clínico qualificado, diagnóstico preciso e cuidado humanizado em cada atendimento.",
  },
};

export default async function EspecialidadesPage() {
  const { clinic, specialties, professionals } = await getPublicWebsiteData();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Especialidades", item: `${SITE_URL}/especialidades` },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <PublicHeader clinicName={clinic.name} logoUrl={clinic.logo_url} />

      <main className="flex-1 py-16 lg:py-24">
        <PageEntrance className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <PageEntranceItem>
            <PageHero
              breadcrumbItems={[{ label: "Início", href: "/" }, { label: "Especialidades" }]}
              title="Especialidades Terapêuticas"
              subtitle="Cuidados especializados e tratamentos personalizados para sua saúde integral."
            />
          </PageEntranceItem>

          <h2 className="sr-only">Lista de Especialidades</h2>
          <SmartGrid
            items={specialties}
            minColumns={3}
            gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            emptyState={
              <EmptyState
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                }
                title="Especialidades em cadastro"
                description="Nosso quadro de especialidades está sendo atualizado. Entre em contato para saber quais atendimentos já estão disponíveis."
                action={{ label: "Falar com nossa equipe", href: "/contato" }}
              />
            }
            renderItem={(spec, index) => {
              const relatedProfs = professionals.filter((p) => p.specialtyName === spec.name);

              return (
                <AnimatedCard key={spec.id} delayMs={index * 100} className="p-8 flex flex-col justify-between h-full rounded-3xl">
                  <div className="space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-elevated text-[var(--link)] border border-border">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-text-primary font-heading">
                      <Link
                        href={`/especialidades/${buildEntitySlug(spec.name, spec.id)}`}
                        className="hover:text-[var(--link)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      >
                        {spec.name}
                      </Link>
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Atendimento preventivo, diagnóstico avançado e acompanhamento personalizado nesta especialidade.
                    </p>
                    <Link
                      href={`/especialidades/${buildEntitySlug(spec.name, spec.id)}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[var(--link)] hover:underline"
                    >
                      Saiba mais →
                    </Link>

                    {relatedProfs.length > 0 && (
                      <div className="pt-3 border-t border-border/60">
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                          Profissionais desta área:
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {relatedProfs.map((p) => (
                            <Badge key={p.id} tone="neutral" className="text-[11px]">
                              {p.fullName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-4 border-t border-border/60">
                    <Link href="/cliente/login" className="block w-full">
                      <Button variant="secondary" className="w-full font-bold" size="sm" withArrow>
                        {CTA_PRIMARY}
                      </Button>
                    </Link>
                  </div>
                </AnimatedCard>
              );
            }}
          />
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

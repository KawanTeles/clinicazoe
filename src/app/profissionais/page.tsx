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
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/whatsapp";
import { CTA_PRIMARY, CTA_VIEW_PROFILE } from "@/lib/cta-labels";
import { SITE_URL } from "@/lib/site-url";

export const metadata = {
  title: "Corpo Médico e Profissionais — Clínica Zoe",
  description: "Conheça nossos médicos especialistas, qualificações, horários e agende sua consulta.",
  alternates: { canonical: `${SITE_URL}/profissionais` },
  openGraph: {
    title: "Corpo Médico e Profissionais — Clínica Zoe",
    description: "Conheça nossos médicos especialistas, qualificações, horários e agende sua consulta.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Corpo Médico e Profissionais — Clínica Zoe",
    description: "Conheça nossos médicos especialistas, qualificações, horários e agende sua consulta.",
  },
};

export default async function ProfissionaisPage() {
  const { clinic, professionals } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} logoUrl={clinic.logo_url} />

      <main className="flex-1 py-16 lg:py-24">
        <PageEntrance className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <PageEntranceItem>
            <PageHero
              breadcrumbItems={[{ label: "Início", href: "/" }, { label: "Profissionais" }]}
              title="Nossos Profissionais"
              subtitle="Médicos experientes e dedicados a oferecer a melhor assistência à sua saúde."
            />
          </PageEntranceItem>

          <h2 className="sr-only">Lista de Profissionais</h2>
          <SmartGrid
            items={professionals}
            minColumns={3}
            gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            emptyState={
              <EmptyState
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
                title="Equipe em formação"
                description="Estamos ampliando nosso corpo clínico. Entre em contato para saber quais especialistas já estão atendendo."
                action={{ label: "Falar com nossa equipe", href: "/contato" }}
              />
            }
            renderItem={(prof, index) => (
              <AnimatedCard key={prof.id} delayMs={index * 120} className="p-8 flex flex-col justify-between h-full rounded-3xl">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar src={prof.avatarUrl} name={prof.fullName} size={80} rounded="2xl" className="shadow-md" />
                    <div>
                      <h3 className="text-lg font-bold text-text-primary font-heading">{prof.fullName}</h3>
                      <Badge tone="success" className="mt-1 text-xs">{prof.specialtyName}</Badge>
                      <p className="text-xs text-text-muted mt-1 font-mono">{prof.licenseNumber}</p>
                    </div>
                  </div>

                  <p className="text-xs text-text-secondary leading-relaxed">{prof.bio}</p>

                  <div className="p-4 rounded-2xl bg-card-elevated/70 border border-border/60 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Duração da consulta:</span>
                      <span className="font-bold text-text-primary">{prof.consultationDuration} minutos</span>
                    </div>
                    {prof.priceParticularPix && (
                      <div className="flex justify-between items-center text-text-secondary">
                        <span>Valor da sessão (Pix):</span>
                        <span className="font-bold text-[var(--link)]">{formatCurrency(prof.priceParticularPix)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-border/60 space-y-3">
                  <Link href={`/profissionais/${prof.id}`} className="block w-full">
                    <Button variant="secondary" className="w-full font-bold" size="sm">
                      {CTA_VIEW_PROFILE}
                    </Button>
                  </Link>
                  <Link href="/cliente/login" className="block w-full">
                    <Button variant="outline" className="w-full font-bold" size="sm" withArrow>
                      {CTA_PRIMARY}
                    </Button>
                  </Link>
                </div>
              </AnimatedCard>
            )}
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

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
import { Button } from "@/components/ui/Button";
import { CTA_PRIMARY } from "@/lib/cta-labels";
import { SITE_URL } from "@/lib/site-url";

export const metadata = {
  title: "Convênios Atendidos — Clínica Zoe",
  description: "Confira a lista de planos de saúde e convênios aceitos na Clínica Zoe.",
  alternates: { canonical: `${SITE_URL}/convenios` },
  openGraph: {
    title: "Convênios Atendidos — Clínica Zoe",
    description: "Confira a lista de planos de saúde e convênios aceitos na Clínica Zoe.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Convênios Atendidos — Clínica Zoe",
    description: "Confira a lista de planos de saúde e convênios aceitos na Clínica Zoe.",
  },
};

export default async function ConveniosPage() {
  const { clinic, insurances } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-16 lg:py-24">
        <PageEntrance className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <PageEntranceItem>
            <PageHero
              breadcrumbItems={[{ label: "Início", href: "/" }, { label: "Convênios" }]}
              title="Convênios Aceitos"
              subtitle="Trabalhamos com os principais planos de saúde do país e também atendimento particular com facilidades."
            />
          </PageEntranceItem>

          <h2 className="sr-only">Convênios Disponíveis</h2>
          <SmartGrid
            items={insurances}
            minColumns={4}
            gridClassName="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
            emptyState={
              <EmptyState
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                }
                title="Convênios em atualização"
                description="Estamos atualizando nossa lista de convênios parceiros. Entre em contato para confirmar se atendemos seu plano de saúde."
                action={{ label: "Falar com nossa equipe", href: "/contato" }}
              />
            }
            renderItem={(ins, index) => (
              <AnimatedCard key={ins.id} delayMs={index * 80} className="p-6 flex flex-col justify-between h-full rounded-2xl">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card-elevated text-[var(--link)] border border-border mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-text-primary font-heading">{ins.name}</h3>
                  <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                    Cobertura para consultas médicas especializadas na Clínica Zoe.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border/60">
                  <Link href="/cliente/login" className="block w-full">
                    <Button variant="secondary" size="sm" className="w-full font-bold">
                      {CTA_PRIMARY}
                    </Button>
                  </Link>
                </div>
              </AnimatedCard>
            )}
          />

          {/* Info Card */}
          <ScrollReveal animation="fade-up">
            <AnimatedCard className="rounded-3xl p-8 text-center max-w-3xl mx-auto space-y-4">
              <h3 className="text-xl font-bold text-text-primary font-heading">Não encontrou seu plano de saúde?</h3>
              <p className="text-xs sm:text-sm text-text-secondary">
                Atendemos também na modalidade particular com reembolso para diversos convênios. Entre em contato para entender como solicitar seu recibo de reembolso.
              </p>
              <div className="pt-2">
                <Link href="/contato">
                  <Button size="lg" withArrow className="font-bold">Falar com nossa equipe</Button>
                </Link>
              </div>
            </AnimatedCard>
          </ScrollReveal>
        </PageEntrance>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}

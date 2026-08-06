import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { LocationSection } from "@/components/public/LocationSection";
import { PageHero } from "@/components/public/PageHero";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { buildWhatsAppLink, formatWhatsAppDisplay } from "@/lib/whatsapp";
import { CTA_PRIMARY, CTA_WHATSAPP } from "@/lib/cta-labels";
import { SITE_URL } from "@/lib/site-url";

export const metadata = {
  title: "Contato e Localização — Clínica Zoe",
  description: "Fale com nossa central de atendimento, confira nosso endereço e horários de funcionamento.",
  alternates: { canonical: `${SITE_URL}/contato` },
  openGraph: {
    title: "Contato e Localização — Clínica Zoe",
    description: "Fale com nossa central de atendimento, confira nosso endereço e horários de funcionamento.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contato e Localização — Clínica Zoe",
    description: "Fale com nossa central de atendimento, confira nosso endereço e horários de funcionamento.",
  },
};

export default async function ContatoPage() {
  const { clinic } = await getPublicWebsiteData();
  const whatsappLink = buildWhatsAppLink(clinic.whatsapp_number, "Olá! Vim pelo site da Clínica Zoe.");
  const whatsappDisplay = formatWhatsAppDisplay(clinic.whatsapp_number);

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 py-16 lg:py-24">
        <PageEntrance className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <PageEntranceItem>
            <PageHero
              breadcrumbItems={[{ label: "Início", href: "/" }, { label: "Contato" }]}
              title="Contato & Localização"
              subtitle="Estamos prontos para atender você com agilidade e atenção."
            />
          </PageEntranceItem>

          <h2 className="sr-only">Formas de Contato</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Info Cards */}
            <ScrollReveal animation="slide-left">
              <div className="space-y-6">
                <AnimatedCard delayMs={100} className="rounded-3xl p-8 space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-elevated text-[var(--link)] border border-border">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-text-primary font-heading">Endereço</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {clinic.address || "Av. Paulista, 1000 - Bela Vista, São Paulo - SP, CEP 01310-100"}
                  </p>
                </AnimatedCard>

                <AnimatedCard delayMs={200} className="rounded-3xl p-8 space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-elevated text-[var(--link)] border border-border">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-text-primary font-heading">Horário de Atendimento</h3>
                  <div className="space-y-1 text-xs text-text-secondary">
                    <p><strong className="text-text-primary">Segunda a Sexta:</strong> 07:00 às 20:00</p>
                    <p><strong className="text-text-primary">Sábados:</strong> 08:00 às 14:00</p>
                    <p><strong className="text-text-primary">Domingos e Feriados:</strong> Fechado</p>
                  </div>
                </AnimatedCard>

                {whatsappLink && (
                  <AnimatedCard delayMs={300} className="rounded-3xl border-[#25D366]/40 p-8 space-y-4">
                    <h3 className="text-lg font-bold text-text-primary font-heading">Central de WhatsApp</h3>
                    <p className="text-xs text-text-secondary">
                      Tire suas dúvidas ou solicite informações diretamente no nosso canal oficial{whatsappDisplay ? ` — ${whatsappDisplay}` : ""}.
                    </p>
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#1EBE5A] shadow-[0_10px_30px_rgba(37,211,102,0.3)] w-full active:scale-98"
                    >
                      <span>{CTA_WHATSAPP}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </a>
                  </AnimatedCard>
                )}
              </div>
            </ScrollReveal>

            {/* Direct Booking CTA */}
            <ScrollReveal animation="slide-right">
              <AnimatedCard className="rounded-3xl p-8 sm:p-10 text-center space-y-6">
                <Badge tone="success">Agendamento 100% Online</Badge>
                <h3 className="text-2xl font-black text-text-primary font-heading">Prefere agendar diretamente?</h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Acesse a área do cliente para visualizar os horários em tempo real e agendar sua consulta sem espera telefônica.
                </p>
                <div className="pt-4">
                  <Link href="/cliente/login">
                    <Button size="lg" withArrow className="w-full font-bold py-4">
                      {CTA_PRIMARY}
                    </Button>
                  </Link>
                </div>
              </AnimatedCard>
            </ScrollReveal>
          </div>
        </PageEntrance>
      </main>

      <LocationSection clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}

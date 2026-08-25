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
              title={clinic.name || "Espaço Zoe"}
              subtitle="Inovação, ética e o acolhimento humano no centro de tudo que fazemos."
            />
          </PageEntranceItem>

          {/* Nossa História */}
          <ScrollReveal animation="fade-up">
            <div className="space-y-6 max-w-3xl">
              <Badge tone="success">Nossa História</Badge>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary font-heading">
                Uma trajetória construída com dedicação
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                {clinic.name || "Espaço Zoe"} nasceu em 2025 com o propósito de criar um espaço dedicado ao desenvolvimento humano e acolhimento de famílias.
              </p>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                O nome Zoe, que significa &quot;vida&quot; em grego, representa nossa essência: valorizar cada pessoa em sua individualidade, respeitando sua história, suas necessidades e seu processo de desenvolvimento.
              </p>
            </div>
          </ScrollReveal>

          {/* Missão / Visão / Valores */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AnimatedCard
              delayMs={100}
              className="rounded-3xl p-8 sm:p-10 h-full border-t-2 border-t-[rgba(110,231,183,0.6)] bg-gradient-to-b from-[rgba(110,231,183,0.05)] to-transparent hover:from-[rgba(110,231,183,0.1)] group"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-[0_4px_20px_rgba(15,118,110,0.15)] mb-6 transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-primary font-heading mb-4">Missão</h3>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                Acolher, cuidar e desenvolver crianças e adultos, promovendo o bem-estar emocional, cognitivo e social em cada fase da vida, através de um olhar humano, sensível e interdisciplinar. Cuidar de quem cuida, fortalecer famílias, e inspirar transformação por meio do afeto, da escuta e do respeito à individualidade de cada ser.
              </p>
            </AnimatedCard>

            <AnimatedCard
              delayMs={200}
              className="rounded-3xl p-8 sm:p-10 h-full border-t-2 border-t-[rgba(94,211,157,0.6)] bg-gradient-to-b from-[rgba(94,211,157,0.05)] to-transparent hover:from-[rgba(94,211,157,0.1)] group"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-[0_4px_20px_rgba(15,118,110,0.15)] mb-6 transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-primary font-heading mb-4">Visão</h3>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                Construir um espaço de referência em desenvolvimento humano, onde o cuidado seja integral, e cada profissional atue com propósito e verdade. Ser um núcleo que transforma vidas com empatia e excelência, gerando impacto positivo na comunidade e liberdade para quem sonha grande.
              </p>
            </AnimatedCard>

            <AnimatedCard
              delayMs={300}
              className="rounded-3xl p-8 sm:p-10 h-full border-t-2 border-t-[rgba(46,139,87,0.6)] bg-gradient-to-b from-[rgba(46,139,87,0.05)] to-transparent hover:from-[rgba(46,139,87,0.1)] group"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-[0_4px_20px_rgba(15,118,110,0.15)] mb-6 transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-primary font-heading mb-4">Valores</h3>
              <ul className="text-sm sm:text-base text-text-secondary leading-relaxed space-y-3">
                <li className="flex items-start"><span className="text-primary mr-2">•</span><span><span className="font-bold text-text-primary">Acolhimento:</span> Cada pessoa é recebida com empatia, escuta e amor.</span></li>
                <li className="flex items-start"><span className="text-primary mr-2">•</span><span><span className="font-bold text-text-primary">Verdade:</span> Agir com autenticidade, integridade e coerência.</span></li>
                <li className="flex items-start"><span className="text-primary mr-2">•</span><span><span className="font-bold text-text-primary">Afetividade:</span> Relações humanas estão no centro de tudo que fazemos.</span></li>
                <li className="flex items-start"><span className="text-primary mr-2">•</span><span><span className="font-bold text-text-primary">Respeito à infância:</span> Acreditamos no tempo, no ritmo e na singularidade de cada criança.</span></li>
                <li className="flex items-start"><span className="text-primary mr-2">•</span><span><span className="font-bold text-text-primary">Cuidado com quem cuida:</span> Fortalecer profissionais e famílias com suporte e carinho.</span></li>
                <li className="flex items-start"><span className="text-primary mr-2">•</span><span><span className="font-bold text-text-primary">Excelência com leveza:</span> Oferecer qualidade sem perder a humanidade.</span></li>
                <li className="flex items-start"><span className="text-primary mr-2">•</span><span><span className="font-bold text-text-primary">Transformação:</span> Trabalhar para que cada atendimento seja um passo de mudança real.</span></li>
              </ul>
            </AnimatedCard>
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

import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CTA_PRIMARY, CTA_VIEW_PROFILE } from "@/lib/cta-labels";
import { SITE_URL } from "@/lib/site-url";
import { buildEntitySlug } from "@/lib/slug";

async function findSpecialty(slug: string) {
  const { specialties, professionals, clinic } = await getPublicWebsiteData();
  const bySlug = specialties.find((s) => buildEntitySlug(s.name, s.id) === slug);
  const spec = bySlug ?? specialties.find((s) => s.id === slug);
  if (!spec) return null;

  const canonicalSlug = buildEntitySlug(spec.name, spec.id);
  const relatedProfessionals = professionals.filter((p) => p.specialtyName === spec.name);

  return { spec, canonicalSlug, relatedProfessionals, clinic };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await findSpecialty(slug);
  if (!result) return { title: "Especialidade Médica | Espaço Zoe" };
  const { spec, canonicalSlug, clinic } = result;
  const clinicName = clinic.name || "Espaço Zoe";

  const title = `${spec.name} — Especialidade Médica | ${clinicName}`;
  const description = `Consultas de ${spec.name} na ${clinicName}: diagnóstico preciso, tecnologia moderna e atendimento humanizado com especialistas qualificados. Agende online.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/especialidades/${canonicalSlug}` },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SpecialtyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await findSpecialty(slug);

  if (!result) notFound();
  const { spec, canonicalSlug, relatedProfessionals, clinic } = result;

  if (canonicalSlug !== slug) {
    permanentRedirect(`/especialidades/${canonicalSlug}`);
  }

  const breadcrumbItems = [
    { label: "Início", href: "/" },
    { label: "Especialidades", href: "/especialidades" },
    { label: spec.name },
  ];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };

  const specialtyJsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: `${spec.name} — ${clinic.name || "Espaço Zoe"}`,
    url: `${SITE_URL}/especialidades/${canonicalSlug}`,
    inLanguage: "pt-BR",
    about: { "@type": "MedicalSpecialty", name: spec.name },
    specialty: spec.name,
    mainEntity: {
      "@type": "MedicalClinic",
      name: clinic.name || "Espaço Zoe",
      url: SITE_URL,
    },
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(specialtyJsonLd) }} />

      <PublicHeader clinicName={clinic.name} logoUrl={clinic.logo_url} />

      <main className="flex-1 py-16 lg:py-24">
        <PageEntrance className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
          <PageEntranceItem>
            <Breadcrumb items={breadcrumbItems} />
          </PageEntranceItem>

          <PageEntranceItem>
            <div className="space-y-4">
              <Badge tone="premium">Especialidade Médica</Badge>
              <h1 className="tracking-hero text-3xl sm:text-4xl font-black text-text-primary font-heading leading-[1.15]">
                {spec.name}
              </h1>
              <h2 className="text-lg font-bold text-text-primary font-heading">
                Sobre a especialidade
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl">
                A especialidade de {spec.name} na {clinic.name || "Espaço Zoe"} reúne diagnóstico preciso, tecnologia médica moderna e
                acompanhamento contínuo, com escuta ativa e atendimento humanizado em cada consulta.
              </p>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl">
                Agende sua consulta em {spec.name} pela área do cliente e escolha o melhor dia e horário, com
                confirmação rápida e suporte da nossa equipe em todas as etapas do atendimento.
              </p>
            </div>
          </PageEntranceItem>

          {relatedProfessionals.length > 0 && (
            <PageEntranceItem>
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-text-primary font-heading">
                  Profissionais de {spec.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {relatedProfessionals.map((prof) => (
                    <AnimatedCard key={prof.id} className="p-6 flex flex-col justify-between h-full rounded-2xl">
                      <div className="flex items-center gap-4">
                        <Avatar src={prof.avatarUrl} name={prof.fullName} size={56} rounded="2xl" />
                        <div>
                          <h3 className="text-sm font-bold text-text-primary font-heading">{prof.fullName}</h3>
                          <p className="text-[11px] text-text-muted mt-0.5 font-mono">{prof.licenseNumber}</p>
                        </div>
                      </div>
                      <div className="mt-5 pt-4 border-t border-border/60">
                        <Link href={`/profissionais/${buildEntitySlug(prof.fullName, prof.id)}`} className="block w-full">
                          <Button variant="secondary" size="sm" className="w-full font-bold">
                            {CTA_VIEW_PROFILE}
                          </Button>
                        </Link>
                      </div>
                    </AnimatedCard>
                  ))}
                </div>
              </div>
            </PageEntranceItem>
          )}

          <PageEntranceItem>
            <div className="text-center pt-4 border-t border-border/60">
              <Link href="/cliente/login">
                <Button size="lg" withArrow className="font-bold">
                  {CTA_PRIMARY}
                </Button>
              </Link>
            </div>
          </PageEntranceItem>
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

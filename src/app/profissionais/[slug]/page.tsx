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
import { formatCurrency } from "@/lib/whatsapp";
import { CTA_PRIMARY } from "@/lib/cta-labels";
import { SITE_URL } from "@/lib/site-url";
import { buildEntitySlug } from "@/lib/slug";

async function findProfessional(slug: string) {
  const { professionals } = await getPublicWebsiteData();
  const bySlug = professionals.find((p) => buildEntitySlug(p.fullName, p.id) === slug);
  if (bySlug) return { prof: bySlug, professionals, canonicalSlug: slug };

  // Compatibilidade com o formato antigo (UUID puro na URL): resolve o
  // profissional pelo id e redireciona permanentemente para a URL amigável,
  // preservando o valor de SEO de links/indexação já existentes.
  const byId = professionals.find((p) => p.id === slug);
  if (byId) return { prof: byId, professionals, canonicalSlug: buildEntitySlug(byId.fullName, byId.id) };

  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await findProfessional(slug);
  if (!result) return { title: "Profissional | Espaço Zoe" };
  const { prof, canonicalSlug } = result;
  const { clinic: metaClinic } = await getPublicWebsiteData();
  const clinicName = metaClinic.name || "Espaço Zoe";

  const title = `${prof.fullName} — ${prof.specialtyName} | ${clinicName}`;
  const description = prof.bio.length > 160 ? `${prof.bio.slice(0, 157)}...` : prof.bio;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/profissionais/${canonicalSlug}` },
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProfissionalDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await findProfessional(slug);

  if (!result) notFound();
  const { prof, canonicalSlug } = result;

  if (canonicalSlug !== slug) {
    permanentRedirect(`/profissionais/${canonicalSlug}`);
  }

  const { clinic } = await getPublicWebsiteData();

  const breadcrumbItems = [
    { label: "Início", href: "/" },
    { label: "Profissionais", href: "/profissionais" },
    { label: prof.fullName },
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

  const physicianJsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: prof.fullName,
    medicalSpecialty: prof.specialtyName,
    description: prof.bio,
    url: `${SITE_URL}/profissionais/${canonicalSlug}`,
    ...(prof.avatarUrl ? { image: prof.avatarUrl } : {}),
    ...(prof.licenseNumber ? { identifier: prof.licenseNumber } : {}),
    worksFor: {
      "@type": "MedicalClinic",
      name: clinic.name || "Espaço Zoe",
      url: SITE_URL,
    },
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(physicianJsonLd) }}
      />

      <PublicHeader clinicName={clinic.name} logoUrl={clinic.logo_url} />

      <main className="flex-1 py-16 lg:py-24">
        <PageEntrance className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
          <PageEntranceItem>
            <Breadcrumb items={breadcrumbItems} />
          </PageEntranceItem>

          <PageEntranceItem>
            <AnimatedCard className="rounded-3xl p-8 sm:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.4)] space-y-8">
              <div className="flex flex-col sm:flex-row items-center gap-8 border-b border-border/60 pb-8">
                <Avatar src={prof.avatarUrl} name={prof.fullName} size={112} rounded="3xl" className="shadow-xl" />

                <div className="space-y-2 text-center sm:text-left">
                  <Badge tone="premium">{prof.specialtyName}</Badge>
                  <h1 className="tracking-hero text-2xl sm:text-3xl font-black text-text-primary font-heading">{prof.fullName}</h1>
                  <p className="text-xs font-mono text-text-muted">{prof.licenseNumber}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2 font-heading">Sobre o Profissional</h2>
                  <p className="text-sm text-text-secondary leading-relaxed">{prof.bio}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/60">
                  <div className="p-4 rounded-2xl bg-card-elevated/70 border border-border/60">
                    <span className="text-xs text-text-muted">Duração Média da Consulta</span>
                    <p className="text-base font-bold text-text-primary mt-1 font-heading">{prof.consultationDuration} minutos</p>
                  </div>
                  {clinic.price_particular_consultation != null && (
                    <div className="p-4 rounded-2xl bg-card-elevated/70 border border-border/60">
                      <span className="text-xs text-text-muted">Consulta Particular</span>
                      <p className="text-base font-bold text-[var(--link)] mt-1 font-heading">{formatCurrency(clinic.price_particular_consultation)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-border/60 text-center">
                <Link href="/cliente/login">
                  <Button size="lg" withArrow className="w-full sm:w-auto font-bold px-8 py-4">
                    {CTA_PRIMARY}
                  </Button>
                </Link>
              </div>
            </AnimatedCard>
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

import { notFound } from "next/navigation";
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { professionals } = await getPublicWebsiteData();
  const prof = professionals.find((p) => p.id === id);
  if (!prof) return { title: "Profissional | Clínica Zoe" };
  return {
    title: `${prof.fullName} — ${prof.specialtyName} | Clínica Zoe`,
    description: prof.bio,
    alternates: { canonical: `${SITE_URL}/profissionais/${prof.id}` },
    openGraph: {
      title: `${prof.fullName} — ${prof.specialtyName} | Clínica Zoe`,
      description: prof.bio,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${prof.fullName} — ${prof.specialtyName} | Clínica Zoe`,
      description: prof.bio,
    },
  };
}

export default async function ProfissionalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { clinic, professionals } = await getPublicWebsiteData();
  const prof = professionals.find((p) => p.id === id);

  if (!prof) notFound();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} logoUrl={clinic.logo_url} />

      <main className="flex-1 py-16 lg:py-24">
        <PageEntrance className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
          <PageEntranceItem>
            <Breadcrumb
              items={[
                { label: "Início", href: "/" },
                { label: "Profissionais", href: "/profissionais" },
                { label: prof.fullName },
              ]}
            />
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

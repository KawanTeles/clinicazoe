import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Área da Equipe — Clínica Zoe",
  description: "Acesso restrito para colaboradores da Clínica Zoe.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function EquipePublicPage() {
  const session = await getCurrentUser();
  const { clinic } = await getPublicWebsiteData();

  const isStaffSession = session && ["admin", "recepcionista", "profissional"].includes(session.profile.role);

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans">
      <PublicHeader clinicName={clinic.name} logoUrl={clinic.logo_url} />

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <PageEntrance className="w-full max-w-md">
          <PageEntranceItem>
            {isStaffSession ? (
              <AnimatedCard className="border-primary/50 shadow-2xl">
                <CardContent className="p-8 text-center space-y-6">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--badge-bg)] text-2xl font-extrabold text-[var(--primary)] border border-primary/30">
                    {session.profile.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-primary font-heading">{session.profile.full_name}</h2>
                    <p className="text-xs text-text-secondary mt-1 capitalize">Sessão da Equipe Ativa ({session.profile.role})</p>
                  </div>

                  <Link href="/dashboard" className="block w-full">
                    <Button size="lg" className="w-full font-bold shadow-button">
                      Acessar Painel Principal →
                    </Button>
                  </Link>
                </CardContent>
              </AnimatedCard>
            ) : (
              <AnimatedCard className="shadow-2xl border-border">
                <CardContent className="p-6 sm:p-8">
                  <Suspense>
                    <LoginForm signupHref={null} />
                  </Suspense>
                </CardContent>
              </AnimatedCard>
            )}
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

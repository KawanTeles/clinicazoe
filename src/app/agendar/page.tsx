import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { PublicBookingWizard } from "@/components/public/PublicBookingWizard";
import { SITE_URL } from "@/lib/site-url";

const TITLE = "Agendar Atendimento — Espaço Zoe";
const DESCRIPTION =
  "Marque seu atendimento em poucos passos, sem precisar criar conta agora. Escolha especialidade, convênio, profissional e horário.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/agendar` },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website" },
};

export default async function AgendarPage() {
  const { clinic, specialties, professionals } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} logoUrl={clinic.logo_url} />

      <main className="flex-1 py-16 px-4">
        <PageEntrance className="mx-auto max-w-4xl space-y-8">
          <PageEntranceItem>
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-text-primary tracking-tight font-heading">
                Agendar Atendimento
              </h1>
              <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto">
                Marque seu atendimento em poucos passos, sem precisar criar conta agora. Se quiser, você
                pode criar uma senha só no final para acompanhar tudo por aqui.
              </p>
            </div>
          </PageEntranceItem>

          <PageEntranceItem>
            <PublicBookingWizard
              specialties={specialties.map((s) => ({ id: s.id, name: s.name }))}
              initialProfessionals={professionals.map((p) => ({
                id: p.id,
                fullName: p.fullName,
                specialtyName: p.specialtyName,
                bio: p.bio,
                avatarUrl: p.avatarUrl,
              }))}
              whatsappNumber={clinic.whatsapp_number}
            />
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

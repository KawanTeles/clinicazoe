import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getPublicWebsiteData } from "@/lib/public-queries";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Área da Equipe — ClinicaZoe",
  description: "Acesso restrito para colaboradores da Clínica Zoe.",
};

export default async function EquipePublicPage() {
  const session = await getCurrentUser();
  const { clinic } = await getPublicWebsiteData();

  const isStaffSession = session && ["admin", "recepcionista", "profissional"].includes(session.profile.role);

  return (
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md">
          {isStaffSession ? (
            <Card className="border-[#2E8B57]/50 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
              <CardContent className="p-8 text-center space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#17382D] text-2xl font-bold text-[#5ED39D] border border-[#255044]">
                  {session.profile.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{session.profile.full_name}</h2>
                  <p className="text-xs text-[#7A9187] mt-1 capitalize">Sessão da Equipe Ativa ({session.profile.role})</p>
                </div>

                <Link href="/dashboard" className="block w-full">
                  <Button size="lg" className="w-full font-bold">
                    Acessar Painel Principal →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
              <CardContent className="p-6 sm:p-8">
                <Suspense>
                  <LoginForm signupHref={null} />
                </Suspense>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}

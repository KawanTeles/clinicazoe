import { Suspense } from "react";
import Link from "next/link";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { CardContent } from "@/components/ui/Card";
import { SignupForm } from "@/modules/auth/components/SignupForm";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { getPublicWebsiteData } from "@/lib/public-queries";

export const metadata = {
  title: "Cadastro de Paciente — Clínica Zoe",
  description: "Crie sua conta de paciente em instantes para agendar consultas.",
};

export default async function PatientSignUpPage() {
  const { clinic } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <PageEntrance className="w-full max-w-md space-y-6">
          <PageEntranceItem>
            <div className="text-center space-y-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-forest text-lg font-black text-white shadow-md mb-2 font-heading">
                CZ
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary font-heading">Criar Conta de Paciente</h1>
              <p className="text-xs sm:text-sm text-text-secondary">
                Informe seus dados para primeiro acesso ao sistema.
              </p>
            </div>
          </PageEntranceItem>

          <PageEntranceItem>
            <AnimatedCard className="shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
              <CardContent className="p-6 sm:p-8 space-y-4">
                <Suspense>
                  <SignupForm />
                </Suspense>

                <div className="pt-4 border-t border-border/60 text-center">
                  <p className="text-xs text-text-secondary">
                    Já tem uma conta?{" "}
                    <Link href="/cliente/login" className="font-bold text-[var(--link)] hover:underline">
                      Entrar com e-mail
                    </Link>
                  </p>
                </div>
              </CardContent>
            </AnimatedCard>
          </PageEntranceItem>
        </PageEntrance>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}

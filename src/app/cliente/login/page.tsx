import { Suspense } from "react";
import Link from "next/link";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { CardContent } from "@/components/ui/Card";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { getPublicWebsiteData } from "@/lib/public-queries";

export const metadata = {
  title: "Acessar Área do Cliente — Clínica Zoe",
  description: "Entre na sua conta para agendar e gerenciar suas consultas.",
};

export default async function PatientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm_error?: string }>;
}) {
  const { confirm_error } = await searchParams;
  const { clinic } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <PageEntrance className="w-full max-w-md space-y-6">
          {confirm_error === "1" && (
            <PageEntranceItem>
              <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-primary">
                Não foi possível confirmar sua conta automaticamente. Faça login para continuar.
              </div>
            </PageEntranceItem>
          )}

          <PageEntranceItem>
            <div className="text-center space-y-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-forest text-lg font-black text-white shadow-card font-heading mb-2">
                CZ
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary font-heading">Área do Paciente</h1>
              <p className="text-xs sm:text-sm text-text-secondary">
                Acesse sua conta para agendar ou acompanhar suas consultas.
              </p>
            </div>
          </PageEntranceItem>

          <PageEntranceItem>
            <AnimatedCard className="shadow-card">
              <CardContent className="p-6 sm:p-8">
                <Suspense>
                  <LoginForm signupHref="/cliente/signup" />
                </Suspense>
              </CardContent>
            </AnimatedCard>
          </PageEntranceItem>
        </PageEntrance>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}

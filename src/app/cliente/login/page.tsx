import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { getPublicWebsiteData } from "@/lib/public-queries";

export const metadata = {
  title: "Acessar Área do Cliente — Clínica Zoe",
  description: "Entre na sua conta para agendar e gerenciar suas consultas.",
};

export default async function PatientLoginPage() {
  const { clinic } = await getPublicWebsiteData();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-forest text-lg font-black text-white shadow-card font-heading mb-2">
              CZ
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary font-heading">Área do Paciente</h1>
            <p className="text-xs sm:text-sm text-text-secondary">
              Acesse sua conta para agendar ou acompanhar suas consultas.
            </p>
          </div>

          <Card className="shadow-card">
            <CardContent className="p-6 sm:p-8">
              <Suspense>
                <LoginForm signupHref="/cliente/signup" />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}

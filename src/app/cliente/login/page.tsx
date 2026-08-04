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
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-forest text-lg font-black text-white shadow-md mb-2">
              CZ
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Área do Paciente</h1>
            <p className="text-xs sm:text-sm text-[#C8D4CF]">
              Acesse sua conta para agendar ou acompanhar suas consultas.
            </p>
          </div>

          <Card className="shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
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

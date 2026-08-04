import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
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
    <div className="min-h-screen bg-[#081C15] text-[#F5F7F6] flex flex-col font-sans selection:bg-[#2E8B57] selection:text-white">
      <PublicHeader clinicName={clinic.name} />

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-forest text-lg font-black text-white shadow-md mb-2">
              CZ
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Criar Conta de Paciente</h1>
            <p className="text-xs sm:text-sm text-[#C8D4CF]">
              Informe seus dados para primeiro acesso ao sistema.
            </p>
          </div>

          <Card className="shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
            <CardContent className="p-6 sm:p-8 space-y-4">
              <Suspense>
                <SignupForm />
              </Suspense>

              <div className="pt-4 border-t border-[#255044]/60 text-center">
                <p className="text-xs text-[#C8D4CF]">
                  Já tem uma conta?{" "}
                  <Link href="/cliente/login" className="font-bold text-[#5ED39D] hover:underline">
                    Entrar com e-mail
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <PublicFooter clinicName={clinic.name} address={clinic.address} whatsappNumber={clinic.whatsapp_number} />
    </div>
  );
}

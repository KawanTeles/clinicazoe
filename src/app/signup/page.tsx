import { Card, CardContent } from "@/components/ui/Card";
import { SignupForm } from "@/modules/auth/components/SignupForm";
import { DeveloperSignature } from "@/components/public/DeveloperSignature";

export const metadata = {
  title: "Criar conta — ClinicaZoe",
  description: "Crie sua conta de acesso ao painel administrativo da Clínica Zoe.",
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-background px-4 py-8">
      <div className="h-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-forest text-lg font-bold text-white shadow-[0_0_20px_rgba(46,139,87,0.3)] mb-3">
            CZ
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">ClinicaZoe</h1>
          <p className="mt-1.5 text-sm text-text-secondary">Crie sua conta de paciente</p>
        </div>
        <Card className="shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
          <CardContent className="py-6">
            <SignupForm />
          </CardContent>
        </Card>
      </div>
      <footer className="w-full max-w-2xl mt-6 border-t border-border/30 pt-2 pb-2">
        <DeveloperSignature />
      </footer>
    </main>
  );
}


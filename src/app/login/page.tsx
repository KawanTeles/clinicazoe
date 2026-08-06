import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { DeveloperSignature } from "@/components/public/DeveloperSignature";

export const metadata = {
  title: "Entrar — ClinicaZoe",
  description: "Acesse o painel administrativo da Clínica Zoe.",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-background text-text-primary px-4 py-8">
      <div className="h-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-forest text-lg font-black text-white shadow-md mb-3">
            CZ
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-primary font-heading">ClinicaZoe</h1>
          <p className="mt-1.5 text-xs font-medium text-text-secondary">
            Acesse o painel administrativo da clínica
          </p>
        </div>
        <Card className="shadow-2xl border-border">
          <CardContent className="py-6 px-6">
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
      <footer className="w-full max-w-2xl mt-6 border-t border-border/40 pt-2 pb-2">
        <DeveloperSignature />
      </footer>
    </main>
  );
}

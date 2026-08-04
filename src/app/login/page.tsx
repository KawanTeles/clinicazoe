import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { LoginForm } from "@/modules/auth/components/LoginForm";

export const metadata = {
  title: "Entrar — ClinicaZoe",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#081C15] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-forest text-lg font-bold text-white shadow-[0_0_20px_rgba(46,139,87,0.3)] mb-3">
            CZ
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#F5F7F6]">ClinicaZoe</h1>
          <p className="mt-1.5 text-sm text-[#C8D4CF]">
            Acesse o painel administrativo
          </p>
        </div>
        <Card className="shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
          <CardContent className="py-6">
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}


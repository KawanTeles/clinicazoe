import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { LoginForm } from "@/modules/auth/components/LoginForm";

export const metadata = {
  title: "Entrar — ClinicaZoe",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-soft px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-primary-dark">ClinicaZoe</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Acesse o painel administrativo
          </p>
        </div>
        <Card>
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

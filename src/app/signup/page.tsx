import { Card, CardContent } from "@/components/ui/Card";
import { SignupForm } from "@/modules/auth/components/SignupForm";

export const metadata = {
  title: "Criar conta — ClinicaZoe",
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-soft px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-primary-dark">ClinicaZoe</h1>
          <p className="mt-1 text-sm text-text-secondary">Crie sua conta de paciente</p>
        </div>
        <Card>
          <CardContent className="py-6">
            <SignupForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

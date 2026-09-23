import { Suspense } from "react";
import Image from "next/image";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { CardContent } from "@/components/ui/Card";
import { ForgotPasswordForm } from "@/modules/auth/components/ForgotPasswordForm";

export const metadata = {
  title: "Recuperar Senha — Espaço Zoe",
  description: "Redefina a senha da sua conta.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;
  const loginHref = from === "cliente" ? "/cliente/login" : "/login";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-text-primary px-4 py-8">
      <PageEntrance className="w-full max-w-sm space-y-6">
        {error === "1" && (
          <PageEntranceItem>
            <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-primary">
              O link de redefinição expirou ou já foi usado. Peça um novo abaixo.
            </div>
          </PageEntranceItem>
        )}

        <PageEntranceItem>
          <div className="mb-2 text-center flex flex-col items-center">
            <Image
              src="/brand-logo.png?v=2"
              alt="Espaço Zoe"
              width={64}
              height={64}
              priority
              className="h-16 w-16 rounded-full object-cover shadow-lg border-2 border-primary/30 mb-3"
            />
            <h1 className="text-2xl font-extrabold tracking-tight text-text-primary font-heading">Recuperar senha</h1>
            <p className="mt-1.5 text-xs font-medium text-text-secondary">
              Informe seu e-mail para receber um link de redefinição.
            </p>
          </div>
        </PageEntranceItem>

        <PageEntranceItem>
          <AnimatedCard className="shadow-2xl border-border">
            <CardContent className="py-6 px-6">
              <Suspense>
                <ForgotPasswordForm loginHref={loginHref} />
              </Suspense>
            </CardContent>
          </AnimatedCard>
        </PageEntranceItem>
      </PageEntrance>
    </main>
  );
}

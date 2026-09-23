import { Suspense } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { CardContent } from "@/components/ui/Card";
import { NewPasswordForm } from "@/modules/auth/components/NewPasswordForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "Definir Nova Senha — Espaço Zoe",
  robots: { index: false, follow: false, nocache: true },
};

export default async function NewPasswordPage() {
  // Só chega com sessão válida quem veio do link de e-mail (o code exchange
  // acontece em /auth/reset-password antes de redirecionar pra cá). Sem
  // sessão, o link expirou/já foi usado ou a pessoa abriu essa URL direto.
  const session = await getCurrentUser();
  if (!session) {
    redirect("/recuperar-senha?error=1");
  }

  const redirectTo = session.profile.role === "paciente" ? "/cliente" : "/dashboard";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-text-primary px-4 py-8">
      <PageEntrance className="w-full max-w-sm">
        <PageEntranceItem>
          <div className="mb-8 text-center flex flex-col items-center">
            <Image
              src="/brand-logo.png?v=2"
              alt="Espaço Zoe"
              width={64}
              height={64}
              priority
              className="h-16 w-16 rounded-full object-cover shadow-lg border-2 border-primary/30 mb-3"
            />
            <h1 className="text-2xl font-extrabold tracking-tight text-text-primary font-heading">Definir nova senha</h1>
            <p className="mt-1.5 text-xs font-medium text-text-secondary">
              Escolha uma nova senha para sua conta.
            </p>
          </div>
          <AnimatedCard className="shadow-2xl border-border">
            <CardContent className="py-6 px-6">
              <Suspense>
                <NewPasswordForm redirectTo={redirectTo} />
              </Suspense>
            </CardContent>
          </AnimatedCard>
        </PageEntranceItem>
      </PageEntrance>
    </main>
  );
}

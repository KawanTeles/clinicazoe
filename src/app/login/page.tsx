import { Suspense } from "react";
import Image from "next/image";
import { AnimatedCard } from "@/components/animation/AnimatedCard";
import { PageEntrance, PageEntranceItem } from "@/components/animation/PageEntrance";
import { CardContent } from "@/components/ui/Card";
import { LoginForm } from "@/modules/auth/components/LoginForm";

export const metadata = {
  title: "Entrar — Espaço Zoe",
  description: "Acesse o painel administrativo do Espaço Zoe.",
  robots: { index: false, follow: false, nocache: true },
};

export default function LoginPage() {
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
            <h1 className="text-2xl font-extrabold tracking-tight text-text-primary font-heading">Espaço Zoe</h1>
            <p className="mt-1.5 text-xs font-medium text-text-secondary">
              Acesse o painel administrativo da clínica
            </p>
          </div>
          <AnimatedCard className="shadow-2xl border-border">
            <CardContent className="py-6 px-6">
              <Suspense>
                <LoginForm />
              </Suspense>
            </CardContent>
          </AnimatedCard>
        </PageEntranceItem>
      </PageEntrance>
    </main>
  );
}

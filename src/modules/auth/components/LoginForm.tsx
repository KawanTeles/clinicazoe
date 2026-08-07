"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInWithGoogle, signInWithPassword } from "@/modules/auth/services/auth-client";

interface LoginFormProps {
  signupHref?: string | null;
  /**
   * O login com Google é exclusivo do Portal do Paciente — nunca deve
   * aparecer nas telas de acesso da equipe (admin/recepcionista/profissional).
   */
  allowGoogle?: boolean;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export function LoginForm({ signupHref = null, allowGoogle = false }: LoginFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("oauth_error") === "1"
      ? "Não foi possível concluir o login com o Google. Tente novamente."
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await signInWithPassword(email, password);

    if (signInError) {
      setLoading(false);
      setError("E-mail ou senha inválidos.");
      return;
    }

    const next = searchParams.get("next") ?? "/dashboard";
    router.push(next);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);

    const { error: oauthError } = await signInWithGoogle(pathname);

    if (oauthError) {
      setGoogleLoading(false);
      setError("Não foi possível iniciar o login com o Google. Tente novamente.");
    }
    // Em caso de sucesso o navegador é redirecionado para o Google, então
    // não há necessidade de desligar o loading aqui.
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Senha"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" isLoading={loading} disabled={googleLoading} className="w-full font-bold">
          Entrar
        </Button>
      </form>

      {allowGoogle && (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-text-secondary">ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="secondary"
            isLoading={googleLoading}
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full gap-2.5"
          >
            {!googleLoading && <GoogleIcon />}
            Entrar com Google
          </Button>
        </>
      )}

      {signupHref && (
        <p className="text-center text-xs text-text-secondary mt-2">
          Primeiro acesso?{" "}
          <Link href={signupHref} className="font-semibold text-[var(--link)] hover:text-[var(--link-hover)] hover:underline">
            Criar conta de paciente
          </Link>
        </p>
      )}
    </div>
  );
}

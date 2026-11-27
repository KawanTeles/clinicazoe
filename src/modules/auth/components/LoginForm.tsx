"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { signInWithPassword } from "@/modules/auth/services/auth-client";

/** Login exclusivo da equipe (admin/recepção/profissional/coordenação) — o
 * paciente não tem login próprio. */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("reason") === "inactivity"
      ? "Sua sessão expirou por inatividade. Faça login novamente."
      : null,
  );
  const [loading, setLoading] = useState(false);

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

  return (
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
      <div className="flex flex-col gap-1.5">
        <PasswordInput
          label="Senha"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Link
          href="/recuperar-senha"
          className="self-end text-[11px] font-semibold text-[var(--link)] hover:text-[var(--link-hover)] hover:underline"
        >
          Esqueci minha senha
        </Link>
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" isLoading={loading} className="w-full font-bold">
        Entrar
      </Button>
    </form>
  );
}

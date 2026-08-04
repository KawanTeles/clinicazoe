"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInWithPassword } from "@/modules/auth/services/auth-client";

interface LoginFormProps {
  signupHref?: string | null;
}

export function LoginForm({ signupHref = "/cliente/signup" }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      <Input
        label="Senha"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm font-medium text-[#FF8A8A]">{error}</p>}
      <Button type="submit" isLoading={loading} className="w-full font-bold">
        Entrar
      </Button>
      {signupHref && (
        <p className="text-center text-xs text-[#C8D4CF] mt-2">
          Primeiro acesso?{" "}
          <Link href={signupHref} className="font-semibold text-[#5ED39D] hover:text-[#86E5B8] hover:underline">
            Criar conta de paciente
          </Link>
        </p>
      )}
    </form>
  );
}


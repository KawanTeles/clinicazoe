"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signUpPatient } from "@/modules/auth/services/auth-client";

export function SignupForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }

    setLoading(true);
    const { error: signUpError } = await signUpPatient({ fullName, email, phone, password });
    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.includes("already registered")
          ? "Já existe uma conta com esse e-mail."
          : "Não foi possível criar sua conta. Tente novamente.",
      );
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-sm text-text-primary">
          Enviamos um link de confirmação para <strong>{email}</strong>.
        </p>
        <p className="text-sm text-text-secondary">
          Abra seu e-mail e clique no link para ativar sua conta e fazer login.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nome completo"
        name="full_name"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <Input
        label="E-mail"
        name="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Telefone (WhatsApp)"
        name="phone"
        type="tel"
        required
        placeholder="(00) 00000-0000"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <Input
        label="Senha"
        name="password"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" isLoading={loading} className="w-full">
        Criar conta
      </Button>
      <p className="text-center text-sm text-text-secondary">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-[var(--link)] hover:text-[var(--link-hover)] hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}


"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestPasswordReset } from "@/modules/auth/services/auth-client";

interface ForgotPasswordFormProps {
  /** Pra onde o link "Entrar" deve levar — depende de qual tela originou o pedido (equipe ou paciente). */
  loginHref?: string;
}

export function ForgotPasswordForm({ loginHref = "/login" }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    await requestPasswordReset(email);
    setLoading(false);
    // Sempre mostra sucesso, exista ou não conta com esse e-mail — evita
    // revelar pra quem está tentando adivinhar quais e-mails têm cadastro.
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-sm text-text-primary">
          Se houver uma conta com o e-mail <strong>{email}</strong>, enviamos um link para redefinir a senha.
        </p>
        <p className="text-xs text-text-muted">
          Não encontrou? Confira também a caixa de spam ou lixo eletrônico.
        </p>
      </div>
    );
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
      <Button type="submit" isLoading={loading} className="w-full font-bold">
        Enviar link de redefinição
      </Button>
      <p className="text-center text-xs text-text-secondary">
        Lembrou a senha?{" "}
        <Link href={loginHref} className="font-semibold text-[var(--link)] hover:text-[var(--link-hover)] hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}

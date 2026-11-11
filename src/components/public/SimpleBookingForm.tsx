"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { buildWhatsAppLink } from "@/lib/whatsapp";

interface Specialty {
  id: string;
  name: string;
}

interface SimpleBookingFormProps {
  specialties: Specialty[];
  whatsappNumber?: string | null;
}

// Conta letras unicode (acentos inclusos) sem contar emoji/pontuação —
// \p{L} cobre "Ana", "José", "María" etc., mas não 👍 ou "!!".
function countLetters(value: string): number {
  return (value.match(/[\p{L}]/gu) ?? []).length;
}

export function SimpleBookingForm({ specialties, whatsappNumber }: SimpleBookingFormProps) {
  const [specialtyId, setSpecialtyId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const specialtyName = specialties.find((s) => s.id === specialtyId)?.name ?? "";

  const message = `Olá! Meu nome é ${trimmedName} e gostaria de agendar um atendimento de ${specialtyName}.`;
  const whatsappLink = buildWhatsAppLink(whatsappNumber, message);

  // Mantém <a href> real (em vez de window.open em callback) para a
  // navegação continuar sendo disparada pelo clique do usuário — isso evita
  // bloqueio de pop-up mesmo em navegadores mais restritivos.
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!specialtyId) {
      e.preventDefault();
      setError("Selecione a especialidade desejada.");
      return;
    }
    if (countLetters(trimmedName) < 2) {
      e.preventDefault();
      setError("Informe seu nome completo.");
      return;
    }
    if (!whatsappLink) {
      e.preventDefault();
      setError("O WhatsApp da clínica ainda não foi configurado. Entre em contato por outro canal.");
      return;
    }
    setError(null);
  }

  return (
    <Card className="animate-fade-up">
      <CardContent className="p-6 sm:p-8 space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-text-secondary mb-3">Selecione a especialidade desejada:</h4>
          {specialties.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">Nenhuma especialidade disponível no momento.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {specialties.map((spec) => (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => {
                    setSpecialtyId(spec.id);
                    setError(null);
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    specialtyId === spec.id
                      ? "border-primary bg-[var(--badge-bg)] text-[var(--primary)]"
                      : "border-border bg-card-elevated/70 hover:border-primary hover:bg-card-elevated"
                  }`}
                >
                  <h5 className="text-sm font-bold text-text-primary font-heading">{spec.name}</h5>
                </button>
              ))}
            </div>
          )}
        </div>

        <Input
          label="Seu nome *"
          placeholder="Ex: Maria Oliveira"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs font-semibold text-danger">
            {error}
          </div>
        )}

        <a href={whatsappLink ?? "#"} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
          <Button size="lg" withArrow className="w-full font-bold">
            Falar no WhatsApp
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

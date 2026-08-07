"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { AIDisclaimerNotice } from "./AIDisclaimerNotice";
import { askPatientAssistant } from "@/modules/ai/services/patient-assistant-actions";

const PRESET_QUESTIONS = [
  "Resuma os últimos 6 meses.",
  "Quais foram as principais queixas?",
  "Liste todas as intervenções realizadas.",
  "Quais objetivos ainda não foram alcançados?",
  "Crie um relatório para convênio.",
  "Crie um relatório para escola.",
  "Crie um resumo para os responsáveis.",
  "Faça uma linha do tempo da evolução.",
  "Quais padrões podem ser observados nas evoluções?",
];

interface Message {
  question: string;
  answer: string;
}

export function PatientAIAssistant({ patientId }: { patientId: string }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    const result = await askPatientAssistant({ patientId, question: trimmed });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessages((prev) => [...prev, { question: trimmed, answer: result.answer ?? "" }]);
    setQuestion("");
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">🤖 Assistente do Prontuário</p>
      <AIDisclaimerNotice />
      <p className="text-[11px] text-text-muted">
        As respostas usam somente as evoluções já registradas deste paciente — nenhuma pergunta ou resposta fica salva.
      </p>

      <div className="flex flex-wrap gap-2">
        {PRESET_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleAsk(q)}
            disabled={loading}
            className="rounded-full border border-border bg-card-elevated px-3 py-1.5 text-[11px] font-semibold text-text-secondary transition-colors hover:border-primary/50 hover:text-text-primary disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {messages.length > 0 && (
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-xs font-bold text-text-primary">{m.question}</p>
              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{m.answer}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="flex gap-2">
        <Textarea
          placeholder="Digite sua pergunta sobre este paciente..."
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1"
        />
        <Button type="button" isLoading={loading} onClick={() => handleAsk(question)} className="self-end">
          Perguntar
        </Button>
      </div>
    </div>
  );
}

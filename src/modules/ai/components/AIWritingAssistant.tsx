"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { AIDisclaimerNotice } from "./AIDisclaimerNotice";
import { improveEvolutionText } from "@/modules/ai/services/evolution-assistant-actions";
import { transcribeSessionAudio } from "@/modules/ai/services/transcription-actions";
import { IMPROVE_MODE_LABELS, type ImproveMode } from "@/modules/ai/services/provider-types";

const MODES = Object.keys(IMPROVE_MODE_LABELS) as ImproveMode[];

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export const EVOLUTION_TARGET_FIELDS = [
  { value: "clinical_evolution", label: "Evolução Clínica" },
  { value: "objectives", label: "Objetivos Trabalhados" },
  { value: "interventions", label: "Intervenções Realizadas" },
  { value: "patient_response", label: "Resposta do Paciente" },
  { value: "home_guidance", label: "Orientações para Casa" },
  { value: "observations", label: "Observações" },
] as const;

export type EvolutionTargetField = (typeof EVOLUTION_TARGET_FIELDS)[number]["value"];

interface AIWritingAssistantProps {
  appointmentId: string;
  onTextReady: (text: string, field: EvolutionTargetField) => void;
  /** Só true quando o admin habilitou a transcrição de áudio e configurou a chave dedicada da OpenAI. */
  transcriptionEnabled?: boolean;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AIWritingAssistant({ appointmentId, onTextReady, transcriptionEnabled }: AIWritingAssistantProps) {
  // Lazy initializer: este componente só monta no cliente (dentro do fluxo de
  // "Adicionar Evolução", disparado por clique), então window já existe aqui.
  const [Ctor] = useState<SpeechRecognitionConstructor | null>(getSpeechRecognitionConstructor);
  const supported = Ctor !== null;

  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [improvedText, setImprovedText] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [targetField, setTargetField] = useState<EvolutionTargetField>("clinical_evolution");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
        if (event.results[i].isFinal) text += " ";
      }
      setTranscript(text);
    };
    recognition.onerror = (event) => {
      console.error("[AIWritingAssistant] Erro no reconhecimento de voz:", event.error);
      if (event.error === "no-speech") {
        // Nenhuma fala detectada num intervalo — não é um erro real, o navegador
        // já reemite onend em seguida para permitir reiniciar a gravação.
        return;
      }
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Permissão de microfone negada pelo navegador. Verifique as permissões do site."
          : `Erro no reconhecimento de voz: ${event.error}`,
      );
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
  }, [Ctor]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleRecording() {
    if (!recognitionRef.current) {
      setError("Reconhecimento de voz ainda não está pronto. Aguarde um instante e tente novamente.");
      console.error("[AIWritingAssistant] toggleRecording chamado antes da instância de SpeechRecognition existir.");
      return;
    }
    if (recording) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("[AIWritingAssistant] Erro ao parar gravação:", err);
      }
      setRecording(false);
    } else {
      setError(null);
      try {
        recognitionRef.current.start();
        setRecording(true);
      } catch (err) {
        console.error("[AIWritingAssistant] Erro ao iniciar gravação:", err);
        setError("Não foi possível iniciar a gravação de voz. Recarregue a página e tente novamente.");
      }
    }
  }

  async function handleAudioUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setTranscribing(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("appointment_id", appointmentId);

    const result = await transcribeSessionAudio(formData);
    setTranscribing(false);
    event.target.value = "";

    if (result.error || !result.text) {
      setError(result.error ?? "Não foi possível transcrever o áudio.");
      return;
    }
    setTranscript(result.text);
  }

  async function handleImprove(mode: ImproveMode) {
    setMenuOpen(false);
    setError(null);
    setLoading(true);
    const result = await improveEvolutionText({ rawText: transcript, mode, appointmentId });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setImprovedText(result.text ?? null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
          ✨ Assistente de Escrita por IA
        </p>
      </div>

      <AIDisclaimerNotice />

      {!supported && (
        <p className="text-xs text-text-secondary">
          Ditado por voz não é suportado neste navegador — digite o texto manualmente no campo
          abaixo e use o botão &quot;Melhorar texto com IA&quot;.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {supported && (
          <Button
            type="button"
            size="sm"
            variant={recording ? "danger" : "secondary"}
            onClick={toggleRecording}
          >
            {recording ? "⏹ Parar gravação" : "🎤 Gravar voz"}
          </Button>
        )}
        {recording && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> Gravando...
          </span>
        )}

        {transcriptionEnabled && (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              isLoading={transcribing}
              onClick={() => audioInputRef.current?.click()}
            >
              🎧 Transcrever áudio
            </Button>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/m4a,audio/wav,audio/x-wav,audio/webm,.mp3,.m4a,.wav,.webm,.mp4,.mpeg,.mpga"
              className="hidden"
              onChange={handleAudioUpload}
            />
          </>
        )}

        <div className="relative ml-auto" ref={menuRef}>
          <Button
            type="button"
            size="sm"
            onClick={() => setMenuOpen((prev) => !prev)}
            disabled={!transcript.trim() || loading}
            isLoading={loading}
          >
            ✨ Melhorar texto com IA
          </Button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-card-hover">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleImprove(mode)}
                  className="block w-full px-3.5 py-2.5 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface/60"
                >
                  {IMPROVE_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {transcriptionEnabled && (
        <p className="text-[11px] text-text-muted">
          Áudio até 25MB — grave em formato comprimido (m4a/mp3, padrão de gravador de celular): cobre
          tranquilamente 50–90min de sessão. Em WAV sem compressão o limite chega bem mais cedo (~20min).
        </p>
      )}

      <Textarea
        label="Transcrição / rascunho"
        placeholder="Fale naturalmente durante o atendimento ou digite aqui..."
        rows={5}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      />

      {transcript.trim() && (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onTextReady(transcript.trim(), "clinical_evolution")}
          >
            Usar texto sem alterações
          </Button>
        </div>
      )}

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      {improvedText && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            Texto melhorado pela IA — revise antes de usar
          </p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-primary">{improvedText}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
              Destino:
              <select
                value={targetField}
                onChange={(e) => setTargetField(e.target.value as EvolutionTargetField)}
                className="h-8 rounded-lg border border-border bg-card-elevated px-2 text-xs font-medium text-text-primary transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 [&>option]:bg-card-elevated [&>option]:text-text-primary"
              >
                {EVOLUTION_TARGET_FIELDS.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" size="sm" variant="secondary" onClick={() => setImprovedText(null)}>
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onTextReady(improvedText, targetField);
                setImprovedText(null);
              }}
            >
              Usar este texto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

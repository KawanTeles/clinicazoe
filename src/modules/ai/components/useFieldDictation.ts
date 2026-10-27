"use client";

import { useEffect, useRef, useState } from "react";
import type { EvolutionContentInput } from "@/modules/evolutions/services/evolution-actions";

export type EvolutionTargetField = keyof EvolutionContentInput;

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

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type DictationStatus = "idle" | "recording" | "paused";

export interface FieldDictationController {
  supported: boolean;
  activeField: EvolutionTargetField | null;
  status: DictationStatus;
  interimText: string;
  error: string | null;
  start: (field: EvolutionTargetField, textarea: HTMLTextAreaElement | null) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/** Insere `insertion` em `original` na posição `pos` (cursor de onde a
 * gravação partiu) — ou no final, se a posição não existir mais (campo foi
 * limpo/editado por fora enquanto gravava). Nunca sobrescreve o que já
 * estava no campo. */
export function insertTextAt(original: string, insertion: string, pos: number | null): string {
  const trimmed = insertion.trim();
  if (!trimmed) return original;
  if (pos === null || pos < 0 || pos > original.length) {
    return original ? `${original} ${trimmed}` : trimmed;
  }
  const before = original.slice(0, pos);
  const after = original.slice(pos);
  const spaceBefore = before && !/[\s\n]$/.test(before) ? " " : "";
  const spaceAfter = after && !/^[\s\n]/.test(after) ? " " : "";
  return `${before}${spaceBefore}${trimmed}${spaceAfter}${after}`;
}

/** Controlador único de ditado por voz compartilhado entre todos os campos
 * da evolução. Só existe UMA instância de SpeechRecognition ativa por vez
 * (limitação do navegador) — então "qual campo está gravando" mora aqui,
 * não em cada campo individualmente. Cada <FieldVoiceAssistant> só chama
 * start/pause/resume/stop e compara `activeField` com o próprio campo para
 * saber se é ele quem está com o microfone aberto agora.
 *
 * `onCommit` só é chamado quando a gravação de um campo é finalizada (parar,
 * ou trocar para outro campo) — nunca durante a gravação em si, que só
 * atualiza `interimText` para a prévia ao vivo. */
export function useFieldDictation(onCommit: (field: EvolutionTargetField, text: string, cursorPos: number | null) => void) {
  const [Ctor] = useState<SpeechRecognitionConstructor | null>(getSpeechRecognitionConstructor);
  const supported = Ctor !== null;

  const [activeField, setActiveField] = useState<EvolutionTargetField | null>(null);
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const bufferRef = useRef({
    committed: "",
    session: "",
    cursorPos: null as number | null,
    field: null as EvolutionTargetField | null,
  });
  const pendingActionRef = useRef<"pause" | "stop" | null>(null);
  const queuedStartRef = useRef<{ field: EvolutionTargetField; textarea: HTMLTextAreaElement | null } | null>(null);

  function commitCurrent() {
    const buf = bufferRef.current;
    const field = buf.field;
    const text = buf.committed;
    const cursorPos = buf.cursorPos;
    buf.committed = "";
    buf.session = "";
    buf.cursorPos = null;
    buf.field = null;
    setInterimText("");
    if (field && text.trim()) onCommitRef.current(field, text, cursorPos);
  }

  function beginRecording(field: EvolutionTargetField, textarea: HTMLTextAreaElement | null) {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    const buf = bufferRef.current;
    buf.committed = "";
    buf.session = "";
    buf.cursorPos = textarea ? textarea.selectionStart : null;
    buf.field = field;
    setActiveField(field);
    setStatus("recording");
    setError(null);
    try {
      recognition.start();
    } catch (err) {
      console.error("[useFieldDictation] Erro ao iniciar gravação:", err);
      setError("Não foi possível iniciar a gravação. Tente novamente.");
      setStatus("idle");
      setActiveField(null);
      buf.field = null;
    }
  }

  // Instancia e conecta o SpeechRecognition uma única vez — os handlers só
  // leem/gravam em refs e chamam setState, nunca dependem de closures de um
  // render específico, então não precisam ser recriados.
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
      bufferRef.current.session = text;
      setInterimText([bufferRef.current.committed, text].filter(Boolean).join(" "));
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      console.error("[useFieldDictation] Erro no reconhecimento de voz:", event.error);
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Permissão de microfone negada pelo navegador. Verifique as permissões do site."
          : `Erro no reconhecimento de voz: ${event.error}`,
      );
    };

    recognition.onend = () => {
      const buf = bufferRef.current;
      buf.committed = [buf.committed, buf.session].filter(Boolean).join(" ").trim();
      buf.session = "";

      const action = pendingActionRef.current;
      pendingActionRef.current = null;

      if (action === "stop") {
        commitCurrent();
        setStatus("idle");
        setActiveField(null);
        const queued = queuedStartRef.current;
        queuedStartRef.current = null;
        if (queued) beginRecording(queued.field, queued.textarea);
      } else {
        // Pausa explícita OU corte espontâneo do navegador (silêncio/limite
        // de tempo) — nos dois casos preserva o texto já dito; o
        // profissional só vê "Pausado" e pode continuar de onde parou.
        setStatus("paused");
      }
    };

    recognitionRef.current = recognition;
  }, [Ctor]);

  function start(field: EvolutionTargetField, textarea: HTMLTextAreaElement | null) {
    if (!recognitionRef.current) {
      setError("Ditado por voz não é suportado neste navegador.");
      return;
    }

    if (status === "idle") {
      beginRecording(field, textarea);
      return;
    }

    if (bufferRef.current.field === field) {
      if (status === "paused") resume();
      return;
    }

    // Campo diferente do que está ativo: termina a gravação atual (e
    // confirma o texto dela no campo dela) antes de começar a nova.
    queuedStartRef.current = { field, textarea };
    if (status === "recording") {
      pendingActionRef.current = "stop";
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("[useFieldDictation] Erro ao trocar de campo:", err);
      }
    } else {
      commitCurrent();
      const queued = queuedStartRef.current;
      queuedStartRef.current = null;
      if (queued) beginRecording(queued.field, queued.textarea);
    }
  }

  function pause() {
    if (status !== "recording" || !recognitionRef.current) return;
    pendingActionRef.current = "pause";
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error("[useFieldDictation] Erro ao pausar:", err);
    }
  }

  function resume() {
    if (status !== "paused" || !recognitionRef.current) return;
    setStatus("recording");
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error("[useFieldDictation] Erro ao retomar:", err);
      setError("Não foi possível retomar a gravação.");
      setStatus("paused");
    }
  }

  function stop() {
    if (status === "idle" || !recognitionRef.current) return;
    if (status === "paused") {
      commitCurrent();
      setStatus("idle");
      setActiveField(null);
      return;
    }
    pendingActionRef.current = "stop";
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error("[useFieldDictation] Erro ao parar:", err);
    }
  }

  const controller: FieldDictationController = { supported, activeField, status, interimText, error, start, pause, resume, stop };
  return controller;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EvolutionTargetField } from "./useFieldDictation";

export type RecorderStatus =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "paused"
  | "stopped"
  | "permission-denied"
  | "error";

/** Teto de segurança por gravação — nenhuma sessão clínica real chega perto
 * disso. Existe só para não deixar um microfone esquecido aberto em segundo
 * plano rodando indefinidamente (item 9 do pedido: limitar duração máxima
 * para evitar abuso e custo). Para quando atinge, como se tivesse clicado
 * "Parar". */
const MAX_DURATION_SECONDS = 90 * 60;

/** Primeiro tipo suportado pelo navegador, nessa ordem de preferência: Opus
 * em WebM (Chrome/Firefox/Edge/Android) tem a melhor relação
 * qualidade/tamanho para voz; MP4/AAC cobre o Safari (desktop e iOS, que não
 * suporta webm). Sem isso, `new MediaRecorder(stream)` deixa o navegador
 * escolher sozinho — no Safari isso às vezes resulta num contêiner que o
 * servidor rejeita. */
function pickMimeType(): { mimeType: string; extension: string } {
  const candidates: { mimeType: string; extension: string }[] = [
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/mp4", extension: "mp4" },
    { mimeType: "audio/mpeg", extension: "mp3" },
  ];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }
  // Sem nenhum isTypeSupported batendo (navegador antigo/incomum): deixa o
  // MediaRecorder decidir o próprio mimeType, só sem forçar extensão errada.
  return { mimeType: "", extension: "webm" };
}

/** Mesmo padrão de detecção de recurso do useFieldDictation (inicializador
 * preguiçoso do useState, não efeito): evita o ciclo de render extra de
 * "falso no primeiro render, true logo depois" que um useEffect causaria. */
function detectSupport(): boolean {
  if (typeof window === "undefined") return false;
  const secure = window.isSecureContext || window.location.hostname === "localhost";
  return secure && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;
}

export interface AudioRecorderController<TField extends string = EvolutionTargetField> {
  /** Suporte detectado em tempo de montagem — false em contexto não seguro
   * (http sem TLS, exceto localhost) ou navegador sem MediaRecorder. */
  supported: boolean;
  /** Qual campo está gravando agora — null quando nenhum. Mesmo papel de
   * `activeField` em useFieldDictation: só pode existir UMA gravação de
   * áudio ativa por vez no navegador, então "qual campo" mora aqui, não em
   * cada campo individualmente. */
  activeField: TField | null;
  status: RecorderStatus;
  /** Segundos decorridos da gravação atual (zera ao regravar). */
  elapsedSeconds: number;
  error: string | null;
  /** Preenchido só depois de "parar" — o áudio pronto para transcrever.
   * Continua em memória (nunca sobe sozinho) até o chamador decidir o que
   * fazer com ele; permite "tentar de novo" sem regravar se a transcrição
   * falhar (item 7 do pedido). */
  blob: Blob | null;
  fileExtension: string;
  start: (field: TField) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Descarta a gravação atual (parada ou com erro) e volta para "idle" —
   * usado tanto por "Regravar" quanto depois de uma transcrição bem-sucedida
   * (o áudio não precisa continuar em memória depois de virar texto). */
  discard: () => void;
}

/** Grava áudio pelo microfone do navegador (MediaRecorder), para alimentar a
 * transcrição por IA sem precisar gravar num app separado e depois
 * selecionar o arquivo.
 *
 * Controlador ÚNICO E COMPARTILHADO entre todos os campos de um formulário —
 * mesma arquitetura de useFieldDictation, pelo mesmo motivo: um microfone só
 * pode estar gravando uma coisa por vez. Quem monta o formulário cria UMA
 * instância (ex.: em EvolutionForm) e passa como prop para cada campo (ex.:
 * FieldVoiceAssistant); cada campo só chama start(próprioField) e compara
 * `activeField` com o próprio nome para saber se é ele quem está gravando.
 *
 * NUNCA sobe o áudio sozinho: devolve o Blob pronto e quem usa o hook decide
 * quando (e se) mandar para transcrição. O hook em si não sabe nada sobre
 * rede — só grava e para. */
export function useAudioRecorder<TField extends string = EvolutionTargetField>(): AudioRecorderController<TField> {
  const [supported] = useState(detectSupport);
  const [activeField, setActiveField] = useState<TField | null>(null);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [fileExtension, setFileExtension] = useState("webm");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    // Desmontou com gravação ativa (navegou pra outro lugar sem parar) —
    // solta o microfone, nunca deixa a luz de "gravando" acesa à toa.
    return () => {
      stopTimer();
      releaseStream();
    };
  }, [stopTimer, releaseStream]);

  const tick = useCallback(() => {
    const elapsedMs = Date.now() - startedAtRef.current + pausedAccumRef.current;
    const seconds = Math.floor(elapsedMs / 1000);
    setElapsedSeconds(seconds);
    if (seconds >= MAX_DURATION_SECONDS) {
      recorderRef.current?.stop();
    }
  }, []);

  const start = useCallback(
    async (field: TField) => {
      // Trocar de campo no meio de outra gravação perderia o trecho em
      // andamento — mesma regra de useFieldDictation, aqui reforçada no
      // próprio hook (não só na UI que desabilita o botão de outros campos).
      if (activeField !== null && activeField !== field) return;

      setError(null);
      setBlob(null);
      setActiveField(field);
      setStatus("requesting-permission");

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("permission-denied");
          setError(
            "Permissão de microfone negada. Clique no ícone de cadeado/câmera ao lado do endereço do site, " +
              "permita o microfone e tente de novo — em alguns navegadores é preciso recarregar a página depois.",
          );
        } else if (name === "NotFoundError") {
          setStatus("error");
          setError("Nenhum microfone encontrado neste aparelho.");
        } else {
          setStatus("error");
          setError("Não foi possível acessar o microfone. Tente novamente.");
        }
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];
      pausedAccumRef.current = 0;
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);

      const { mimeType, extension } = pickMimeType();
      setFileExtension(extension);

      let recorder: MediaRecorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch {
        releaseStream();
        setStatus("error");
        setError("Este navegador não conseguiu iniciar a gravação. Tente outro navegador ou digite manualmente.");
        return;
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTimer();
        releaseStream();
        const finalType = mimeType || recorder.mimeType || "audio/webm";
        setBlob(new Blob(chunksRef.current, { type: finalType }));
        setStatus("stopped");
      };
      recorder.onerror = () => {
        stopTimer();
        releaseStream();
        setStatus("error");
        setError("A gravação foi interrompida por um erro. Tente novamente.");
      };

      recorderRef.current = recorder;
      // timeslice de 1s: ondataavailable dispara em pedaços, não só no stop —
      // uma gravação de 40 minutos não fica um único Blob gigante só montado
      // no fim (e sobrevive melhor a uma aba que trava no meio).
      recorder.start(1000);
      setStatus("recording");
      timerRef.current = setInterval(tick, 500);
    },
    [activeField, releaseStream, stopTimer, tick],
  );

  const pause = useCallback(() => {
    if (recorderRef.current?.state !== "recording") return;
    recorderRef.current.pause();
    stopTimer();
    pausedAccumRef.current += Date.now() - startedAtRef.current;
    setStatus("paused");
  }, [stopTimer]);

  const resume = useCallback(() => {
    if (recorderRef.current?.state !== "paused") return;
    recorderRef.current.resume();
    startedAtRef.current = Date.now();
    timerRef.current = setInterval(tick, 500);
    setStatus("recording");
  }, [tick]);

  const stop = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    recorderRef.current.stop();
  }, []);

  const discard = useCallback(() => {
    stopTimer();
    releaseStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setBlob(null);
    setElapsedSeconds(0);
    setError(null);
    setActiveField(null);
    setStatus("idle");
  }, [stopTimer, releaseStream]);

  return { supported, activeField, status, elapsedSeconds, error, blob, fileExtension, start, pause, resume, stop, discard };
}

export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

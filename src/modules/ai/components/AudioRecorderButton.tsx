"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { transcribeSessionAudio } from "@/modules/ai/services/transcription-actions";
import { formatElapsed, type AudioRecorderController } from "./useAudioRecorder";
import type { EvolutionTargetField } from "./useFieldDictation";

interface AudioRecorderButtonProps<TField extends string = EvolutionTargetField> {
  field: TField;
  recorder: AudioRecorderController<TField>;
  appointmentId: string;
  /** Chamado com o texto já transcrito e limpo (vícios de fala já
   * removidos no servidor) — o componente nunca mexe no campo diretamente,
   * quem usa decide onde inserir. */
  onTranscribed: (text: string) => void;
  /** Esconde o próprio componente quando false — mesmo controle que já
   * existe para o upload de arquivo (admin liga/desliga por clínica). */
  enabled?: boolean;
}

/**
 * Botão de microfone com gravação ao vivo (iniciar/pausar/retomar/parar) +
 * transcrição automática ao parar. Aviso "Transcrição automática. Revise
 * antes de assinar." fica por conta de quem usa este componente (ex.:
 * AIDisclaimerNotice já cobre isso na Evolução Rápida) — não duplicado aqui
 * para não repetir o aviso campo a campo no Modo detalhado.
 *
 * `recorder` é um controlador COMPARTILHADO entre todos os campos do
 * formulário (ver useAudioRecorder) — este componente só inicia a própria
 * gravação quando nenhum outro campo está com o microfone aberto, e só
 * desenha os controles de gravação/transcrição quando `recorder.activeField`
 * é o campo dele.
 *
 * O áudio em si nunca é gravado no servidor: o Blob fica só na memória do
 * navegador até a transcrição terminar (ou falhar, para permitir "tentar de
 * novo" sem regravar) — a mesma garantia que o upload de arquivo já tinha,
 * estendida para a gravação ao vivo.
 */
export function AudioRecorderButton<TField extends string = EvolutionTargetField>({
  field,
  recorder,
  appointmentId,
  onTranscribed,
  enabled,
}: AudioRecorderButtonProps<TField>) {
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const isActive = recorder.activeField === field;

  useEffect(() => {
    if (isActive) blobRef.current = recorder.blob;
  }, [isActive, recorder.blob]);

  useEffect(() => {
    if (isActive && recorder.status === "stopped" && recorder.blob) {
      void transcrever(recorder.blob);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, recorder.status]);

  async function transcrever(blob: Blob) {
    setTranscribeError(null);
    setTranscribing(true);
    const formData = new FormData();
    formData.set("file", blob, `gravacao.${recorder.fileExtension}`);
    formData.set("appointment_id", appointmentId);
    const result = await transcribeSessionAudio(formData);
    setTranscribing(false);
    if (result.error || !result.text) {
      setTranscribeError(result.error ?? "Não foi possível transcrever o áudio.");
      return;
    }
    onTranscribed(result.text);
    recorder.discard();
  }

  if (!enabled) return null;

  if (!recorder.supported) {
    return (
      <p className="text-[11px] text-text-muted">
        Este navegador não suporta gravação de áudio pelo microfone — use o ditado por voz ou digite.
      </p>
    );
  }

  // Outro campo está gravando: não oferece iniciar aqui — o microfone é um
  // só e trocar de campo no meio perderia o trecho em andamento.
  if (recorder.activeField !== null && !isActive) return null;

  if (!isActive) {
    return (
      <div className="flex flex-col gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => void recorder.start(field)}>
          🎙️ Gravar e transcrever
        </Button>
        <TranscriptionNotice />
      </div>
    );
  }

  if (recorder.status === "requesting-permission") {
    return (
      <Button type="button" size="sm" variant="outline" disabled isLoading>
        Aguardando permissão do microfone...
      </Button>
    );
  }

  if (recorder.status === "permission-denied" || recorder.status === "error") {
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-danger/30 bg-danger/[0.04] p-3">
        <p className="text-xs font-semibold text-danger">{recorder.error}</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void recorder.start(field)}>
            Tentar de novo
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={recorder.discard}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (recorder.status === "recording" || recorder.status === "paused") {
    const recording = recorder.status === "recording";
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/30 bg-danger/[0.04] px-3 py-2">
        <span className={`h-2.5 w-2.5 rounded-full ${recording ? "animate-pulse bg-danger" : "bg-text-muted"}`} />
        <span className="font-mono text-sm font-bold tabular-nums text-text-primary">
          {formatElapsed(recorder.elapsedSeconds)}
        </span>
        <span className="text-[11px] font-semibold text-text-secondary">{recording ? "Gravando..." : "Pausado"}</span>
        <div className="ml-auto flex gap-2">
          {recording ? (
            <Button type="button" size="sm" variant="outline" onClick={recorder.pause}>
              ⏸ Pausar
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={recorder.resume}>
              ▶ Continuar
            </Button>
          )}
          <Button type="button" size="sm" variant="danger" onClick={recorder.stop}>
            ⏹ Parar
          </Button>
        </div>
      </div>
    );
  }

  // status === "stopped": transcrevendo, ou falhou e espera decisão.
  if (transcribing) {
    return (
      <Button type="button" size="sm" variant="outline" disabled isLoading>
        Transcrevendo áudio...
      </Button>
    );
  }

  if (transcribeError) {
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-danger/30 bg-danger/[0.04] p-3">
        <p className="text-xs font-semibold text-danger">{transcribeError}</p>
        <p className="text-[11px] text-text-secondary">
          A gravação continua disponível — tente transcrever de novo, ou regrave.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => blobRef.current && void transcrever(blobRef.current)}
          >
            Tentar de novo
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={recorder.discard}>
            Regravar
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

/** Aviso específico de transcrição (item 11 do pedido) — separado do
 * AIDisclaimerNotice genérico porque a transcrição pode estar habilitada
 * mesmo com o assistente de IA de texto desligado (são dois toggles
 * independentes, ai_settings.transcription_enabled e
 * .evolution_assistant_enabled); sem isto, quem só usa transcrição nunca
 * veria nenhum aviso. */
function TranscriptionNotice() {
  return <p className="text-[10px] text-text-muted">Transcrição automática. Revise antes de assinar.</p>;
}

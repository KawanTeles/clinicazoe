"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { improveEvolutionText } from "@/modules/ai/services/evolution-assistant-actions";
import { transcribeSessionAudio } from "@/modules/ai/services/transcription-actions";
import { IMPROVE_MODE_LABELS, type ImproveMode } from "@/modules/ai/services/provider-types";
import { insertTextAt, type EvolutionTargetField, type FieldDictationController } from "./useFieldDictation";

const MODES = Object.keys(IMPROVE_MODE_LABELS) as ImproveMode[];

interface FieldVoiceAssistantProps {
  field: EvolutionTargetField;
  label: string;
  value: string;
  onChangeValue: (text: string) => void;
  getTextarea: () => HTMLTextAreaElement | null;
  dictation: FieldDictationController;
  appointmentId: string;
  /** Só true quando o profissional está vinculado à consulta e o recurso está habilitado pelo admin. */
  aiEnabled?: boolean;
  /** Só true quando, além do acima, o admin também habilitou a transcrição de áudio. */
  transcriptionEnabled?: boolean;
}

/** Ditado por voz + melhoria de texto por IA de UM campo específico da
 * evolução. Várias instâncias disto são renderizadas (uma por campo) dentro
 * de EvolutionForm, todas compartilhando o mesmo `dictation` (controlador
 * único — só pode existir uma gravação de voz ativa por vez no navegador). */
export function FieldVoiceAssistant({
  field,
  label,
  value,
  onChangeValue,
  getTextarea,
  dictation,
  appointmentId,
  aiEnabled,
  transcriptionEnabled,
}: FieldVoiceAssistantProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [undoValue, setUndoValue] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const isActive = dictation.activeField === field;
  const isRecording = isActive && dictation.status === "recording";
  const isPaused = isActive && dictation.status === "paused";

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleImprove(mode: ImproveMode) {
    setMenuOpen(false);
    setAiError(null);
    setLoading(true);
    const result = await improveEvolutionText({ rawText: value, mode, appointmentId });
    setLoading(false);
    if (result.error) {
      setAiError(result.error);
      return;
    }
    setPreviewText(result.text ?? null);
  }

  function applyPreview() {
    if (previewText === null) return;
    setUndoValue(value);
    onChangeValue(previewText);
    setPreviewText(null);
  }

  function discardPreview() {
    setPreviewText(null);
  }

  function retryPreview() {
    setPreviewText(null);
    setMenuOpen(true);
  }

  function undo() {
    if (undoValue === null) return;
    onChangeValue(undoValue);
    setUndoValue(null);
  }

  async function handleAudioUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAiError(null);
    setTranscribing(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("appointment_id", appointmentId);

    const result = await transcribeSessionAudio(formData);
    setTranscribing(false);
    event.target.value = "";

    if (result.error || !result.text) {
      setAiError(result.error ?? "Não foi possível transcrever o áudio.");
      return;
    }
    const textarea = getTextarea();
    onChangeValue(insertTextAt(value, result.text, textarea ? textarea.selectionStart : value.length));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {dictation.supported && !isActive && (
          <Button type="button" size="sm" variant="outline" onClick={() => dictation.start(field, getTextarea())}>
            🎤 Ditar
          </Button>
        )}
        {isRecording && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={dictation.pause}>
              ⏸ Pausar
            </Button>
            <Button type="button" size="sm" variant="danger" onClick={dictation.stop}>
              ⏹ Parar
            </Button>
          </>
        )}
        {isPaused && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={dictation.resume}>
              ▶ Continuar
            </Button>
            <Button type="button" size="sm" variant="danger" onClick={dictation.stop}>
              ⏹ Parar
            </Button>
          </>
        )}

        {transcriptionEnabled && !isActive && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
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

        {aiEnabled && (
          <div className="relative ml-auto" ref={menuRef}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setMenuOpen((prev) => !prev)}
              disabled={!value.trim() || loading || isActive}
              isLoading={loading}
            >
              ✨ Melhorar texto
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
        )}

        {undoValue !== null && !isActive && (
          <Button type="button" size="sm" variant="outline" onClick={undo}>
            ↩ Desfazer
          </Button>
        )}
      </div>

      {isActive && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-danger/30 bg-danger/[0.04] p-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-danger">
            {isRecording ? (
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-warning" />
            )}
            {isRecording ? `Gravando em: ${label}` : `Pausado — Gravando em: ${label}`}
          </span>
          {dictation.interimText && (
            <p className="whitespace-pre-wrap text-xs italic leading-relaxed text-text-secondary">
              {dictation.interimText}
            </p>
          )}
        </div>
      )}

      {dictation.error && (isActive || !dictation.activeField) && (
        <p className="text-xs font-semibold text-danger">{dictation.error}</p>
      )}
      {aiError && <p className="text-xs font-semibold text-danger">{aiError}</p>}

      {previewText !== null && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            Texto melhorado pela IA — revise antes de aplicar
          </p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-primary">{previewText}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={discardPreview}>
              Descartar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={retryPreview}>
              Tentar outra opção
            </Button>
            <Button type="button" size="sm" onClick={applyPreview}>
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

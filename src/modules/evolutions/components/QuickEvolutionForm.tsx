"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { AIDisclaimerNotice } from "@/modules/ai/components/AIDisclaimerNotice";
import { insertTextAt, useFieldDictation } from "@/modules/ai/components/useFieldDictation";
import { generateQuickEvolutionDraft } from "@/modules/ai/services/quick-evolution-actions";
import { transcribeSessionAudio } from "@/modules/ai/services/transcription-actions";
import { hasPendingReviewMarkers, splitReviewMarkers } from "@/modules/ai/services/review-marker";
import type { EvolutionContentInput } from "@/modules/evolutions/services/evolution-actions";

type QuickField = "summary";

interface QuickEvolutionFormProps {
  appointmentId: string;
  patientName?: string | null;
  onSubmit: (input: EvolutionContentInput) => Promise<{ error: string | null }>;
  onCancel: () => void;
  onSaved: () => void;
  onSwitchToDetailedMode?: () => void;
  /** Só true quando o profissional está vinculado ao atendimento e o admin
   * habilitou a Evolução Rápida (ai_settings.quick_evolution_enabled). */
  aiEnabled?: boolean;
  transcriptionEnabled?: boolean;
}

interface DraftState {
  rawSummary: string;
  draft: string | null;
}

function draftStorageKey(appointmentId: string) {
  return `quick-evolution-draft:${appointmentId}`;
}

function loadStoredDraft(appointmentId: string): DraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftStorageKey(appointmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    if (typeof parsed.rawSummary !== "string") return null;
    return { rawSummary: parsed.rawSummary, draft: typeof parsed.draft === "string" ? parsed.draft : null };
  } catch {
    return null;
  }
}

/** Fluxo padrão de registro de evolução: um único campo "Resumo da sessão"
 * (falado ou digitado) + IA gera o rascunho, que o profissional revisa e
 * assina. Ver EvolutionForm para o "Modo detalhado" (campo a campo), que
 * continua disponível como alternativa. */
export function QuickEvolutionForm({
  appointmentId,
  patientName,
  onSubmit,
  onCancel,
  onSaved,
  onSwitchToDetailedMode,
  aiEnabled,
  transcriptionEnabled,
}: QuickEvolutionFormProps) {
  // QuickEvolutionForm só monta depois de um clique explícito (nunca durante
  // o SSR/hidratação inicial da página), então ler localStorage direto no
  // estado inicial é seguro — restaura resumo/rascunho se a pessoa saiu da
  // tela sem assinar, sem precisar de um efeito de montagem.
  const [rawSummary, setRawSummary] = useState(() => loadStoredDraft(appointmentId)?.rawSummary ?? "");
  const [draft, setDraft] = useState<string | null>(() => loadStoredDraft(appointmentId)?.draft ?? null);
  const [generatedByAI, setGeneratedByAI] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "edit">(() =>
    loadStoredDraft(appointmentId)?.draft ? "preview" : "edit",
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const summaryTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const dictation = useFieldDictation<QuickField>((_field, text, cursorPos) => {
    setRawSummary((prev) => insertTextAt(prev, text, cursorPos));
  });
  const isDictating = dictation.activeField === "summary";
  const isRecording = isDictating && dictation.status === "recording";
  const isPaused = isDictating && dictation.status === "paused";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timeout = setTimeout(() => {
      window.localStorage.setItem(draftStorageKey(appointmentId), JSON.stringify({ rawSummary, draft }));
    }, 400);
    return () => clearTimeout(timeout);
  }, [appointmentId, rawSummary, draft]);

  function clearStoredDraft() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(draftStorageKey(appointmentId));
  }

  const mentionsPatientName = useMemo(() => {
    const firstName = patientName?.trim().split(/\s+/)[0];
    if (!firstName || firstName.length < 3 || !rawSummary.trim()) return false;
    return new RegExp(`(?<![\\p{L}])${firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu").test(
      rawSummary,
    );
  }, [patientName, rawSummary]);

  const pendingReview = draft !== null && hasPendingReviewMarkers(draft);

  async function handleGenerate() {
    if (!rawSummary.trim() || generating || dictation.status !== "idle") return;
    setGenError(null);
    setGenerating(true);
    const result = await generateQuickEvolutionDraft({ rawSummary, appointmentId });
    setGenerating(false);
    if (result.error || !result.text) {
      setGenError(result.error ?? "Não foi possível gerar a evolução com IA.");
      return;
    }
    setDraft(result.text);
    setGeneratedByAI(true);
    setViewMode("preview");
  }

  function handleWriteManually() {
    setGenError(null);
    setDraft((prev) => prev ?? "");
    setGeneratedByAI(false);
    setViewMode("edit");
  }

  function handleBackToSummary() {
    setDraft(null);
    setGeneratedByAI(false);
    setGenError(null);
  }

  async function handleSave() {
    if (draft === null || !draft.trim()) {
      setSaveError("Escreva a evolução antes de salvar.");
      return;
    }
    if (hasPendingReviewMarkers(draft)) {
      setSaveError("Ainda há trechos marcados para revisão — resolva-os antes de assinar.");
      return;
    }
    if (dictation.status !== "idle") {
      setSaveError("Pare a gravação de voz em andamento antes de salvar.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await onSubmit({
      clinical_evolution: draft.trim(),
      raw_summary_input: rawSummary.trim() || null,
    });
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    clearStoredDraft();
    onSaved();
  }

  async function handleAudioUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setGenError(null);
    setTranscribing(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("appointment_id", appointmentId);
    const result = await transcribeSessionAudio(formData);
    setTranscribing(false);
    event.target.value = "";
    if (result.error || !result.text) {
      setGenError(result.error ?? "Não foi possível transcrever o áudio.");
      return;
    }
    setRawSummary((prev) => insertTextAt(prev, result.text ?? "", summaryTextareaRef.current?.selectionStart ?? prev.length));
  }

  function handleSummaryKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      handleGenerate();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {aiEnabled && <AIDisclaimerNotice />}

      {draft === null ? (
        <div className="flex flex-col gap-2">
          <Textarea
            ref={(el) => {
              summaryTextareaRef.current = el;
            }}
            label="Resumo da sessão"
            placeholder='Ex.: "Paciente chegou colaborativo, relatou melhora na rotina de sono. Trabalhamos exercícios de regulação emocional, respondeu bem e pediu ajuda em um momento. Combinamos repetir a atividade em casa até a próxima sessão."'
            rows={7}
            value={rawSummary}
            onChange={(e) => setRawSummary(e.target.value)}
            onKeyDown={handleSummaryKeyDown}
            disabled={isDictating}
          />

          {mentionsPatientName && (
            <p className="text-xs font-medium text-warning">
              Evite citar o nome do paciente no resumo — o texto enviado à IA é mascarado automaticamente, mas o
              prontuário já identifica o paciente pelo atendimento.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {dictation.supported && !isDictating && (
              <Button type="button" size="sm" variant="outline" onClick={() => dictation.start("summary", summaryTextareaRef.current)}>
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
            {transcriptionEnabled && !isDictating && (
              <>
                <Button type="button" size="sm" variant="outline" isLoading={transcribing} onClick={() => audioInputRef.current?.click()}>
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
          </div>

          {isDictating && dictation.interimText && (
            <p className="whitespace-pre-wrap text-xs italic leading-relaxed text-text-secondary">{dictation.interimText}</p>
          )}
          {dictation.error && <p className="text-xs font-semibold text-danger">{dictation.error}</p>}

          {aiEnabled ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-text-muted">Atalho: Ctrl+Enter para gerar</p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={handleWriteManually} disabled={generating}>
                  Escrever manualmente
                </Button>
                <Button type="button" onClick={handleGenerate} isLoading={generating} disabled={!rawSummary.trim() || isDictating}>
                  ✨ Gerar evolução
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button type="button" onClick={handleWriteManually} disabled={!rawSummary.trim()}>
                Continuar
              </Button>
            </div>
          )}

          {genError && (
            <div className="flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger/[0.04] p-3">
              <p className="text-xs font-semibold text-danger">{genError}</p>
              <p className="text-xs text-text-secondary">
                Você pode tentar gerar de novo ou escrever/colar a evolução manualmente — o resumo acima não foi perdido.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={generating}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {generatedByAI && (
            <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-[11px] font-medium text-text-secondary">
              Rascunho gerado por IA. Revise antes de assinar.
            </p>
          )}

          {viewMode === "preview" ? (
            <div className="flex flex-col gap-2">
              <div className="min-h-[9rem] w-full rounded-xl border border-border bg-card-elevated px-3.5 py-2.5 text-xs font-medium leading-relaxed text-text-primary whitespace-pre-wrap">
                {splitReviewMarkers(draft).map((segment, index) =>
                  segment.type === "marker" ? (
                    <mark
                      key={index}
                      title="Trecho sinalizado pela IA — confirme ou corrija antes de assinar"
                      className="rounded bg-warning/40 px-1 text-text-primary"
                    >
                      {segment.content}
                      <span className="ml-1 text-[9px] font-bold uppercase text-warning">confirmar</span>
                    </mark>
                  ) : (
                    <span key={index}>{segment.content}</span>
                  ),
                )}
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="outline" onClick={() => setViewMode("edit")}>
                  ✏️ Editar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Textarea
                label="Evolução (edite o que quiser antes de assinar)"
                rows={10}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="outline" onClick={() => setViewMode("preview")}>
                  👁 Pré-visualizar
                </Button>
              </div>
            </div>
          )}

          {pendingReview && (
            <p className="text-xs font-semibold text-danger">
              Ainda há trecho(s) marcado(s) para revisão — edite o texto para resolvê-los antes de assinar.
            </p>
          )}
          {saveError && <p className="text-xs font-semibold text-danger">{saveError}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={handleBackToSummary} disabled={saving}>
              ← Voltar ao resumo
            </Button>
            <div className="flex flex-wrap gap-2">
              {generatedByAI && (
                <Button type="button" variant="secondary" onClick={handleGenerate} isLoading={generating} disabled={saving}>
                  Gerar de novo
                </Button>
              )}
              <Button type="button" onClick={handleSave} isLoading={saving} disabled={pendingReview || generating}>
                Salvar e assinar
              </Button>
            </div>
          </div>
        </div>
      )}

      {onSwitchToDetailedMode && draft === null && (
        <button
          type="button"
          onClick={onSwitchToDetailedMode}
          className="self-start text-xs font-semibold text-text-secondary hover:underline"
        >
          Usar modo detalhado (campo a campo)
        </button>
      )}
    </div>
  );
}

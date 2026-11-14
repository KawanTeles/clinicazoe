"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { AIDisclaimerNotice } from "@/modules/ai/components/AIDisclaimerNotice";
import { AudioRecorderButton } from "@/modules/ai/components/AudioRecorderButton";
import { useAudioRecorder } from "@/modules/ai/components/useAudioRecorder";
import {
  insertTextAt,
  useFieldDictation,
  type FieldDictationController,
} from "@/modules/ai/components/useFieldDictation";
import { generateQuickEvolutionDraft } from "@/modules/ai/services/quick-evolution-actions";
import { transcribeSessionAudio } from "@/modules/ai/services/transcription-actions";
import { hasPendingReviewMarkers, splitReviewMarkers } from "@/modules/ai/services/review-marker";
import {
  discardEvolutionDraft,
  openEvolutionEditor,
  saveEvolutionDraft,
  signEvolutionFromDraft,
} from "@/modules/evolutions/services/draft-actions";

/** Campo em foco para o ditado: o resumo único, ou o tópico de índice N. */
type DictationField = "summary" | `topic-${number}`;

interface TemplateInfo {
  id: string;
  name: string;
  version: number;
  topics: { label: string; hint: string | null }[];
}

interface QuickEvolutionFormProps {
  appointmentId: string;
  patientName?: string | null;
  onCancel: () => void;
  onSaved: () => void;
  onSwitchToDetailedMode?: () => void;
  /** Só true quando o profissional está vinculado ao atendimento e o admin
   * habilitou a Evolução Rápida (ai_settings.quick_evolution_enabled). */
  aiEnabled?: boolean;
  transcriptionEnabled?: boolean;
}

const horaFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Botões de ditado de um campo. O ditado usa o reconhecimento de voz do próprio
 * navegador — o áudio nunca sai do aparelho e nada é gravado (decisão D2).
 *
 * Fica no escopo do módulo, não dentro do formulário: componente declarado
 * dentro do render vira um tipo novo a cada ciclo e o React remonta a subárvore
 * inteira — num campo de texto isso significa perder o foco e a posição do
 * cursor no meio da digitação.
 *
 * `getTarget` é função, não o elemento: ler `ref.current` durante o render é o
 * que o React desaconselha, porque o valor pode estar defasado e não dispara
 * re-render. Assim o ref só é lido dentro do onClick.
 */
function DictationControls({
  field,
  getTarget,
  dictation,
}: {
  field: DictationField;
  getTarget: () => HTMLTextAreaElement | null;
  dictation: FieldDictationController<DictationField>;
}) {
  if (!dictation.supported) return null;

  const ativo = dictation.activeField === field;

  if (!ativo) {
    // Com outro campo gravando, não oferece iniciar aqui — o reconhecimento de
    // voz é um só e trocar de campo no meio perderia o trecho em andamento.
    return dictation.activeField !== null ? null : (
      <Button type="button" size="sm" variant="outline" onClick={() => dictation.start(field, getTarget())}>
        🎤 Ditar
      </Button>
    );
  }

  return (
    <>
      {dictation.status === "recording" && (
        <Button type="button" size="sm" variant="outline" onClick={dictation.pause}>
          ⏸ Pausar
        </Button>
      )}
      {dictation.status === "paused" && (
        <Button type="button" size="sm" variant="outline" onClick={dictation.resume}>
          ▶ Continuar
        </Button>
      )}
      <Button type="button" size="sm" variant="danger" onClick={dictation.stop}>
        ⏹ Parar
      </Button>
    </>
  );
}

/** Fluxo padrão de registro de evolução: um único campo "Resumo da sessão"
 * (falado ou digitado) + IA gera o rascunho, que o profissional revisa e
 * assina. Desde a Etapa 79 o rascunho é gravado NO SERVIDOR (sobrevive à troca
 * de aparelho) e os campos vêm do modelo de evolução do profissional —
 * pessoal, da área, ou o padrão de fábrica de um tópico só. Ver EvolutionForm
 * para o "Modo detalhado" (campo a campo), que continua disponível. */
export function QuickEvolutionForm({
  appointmentId,
  patientName,
  onCancel,
  onSaved,
  onSwitchToDetailedMode,
  aiEnabled,
  transcriptionEnabled,
}: QuickEvolutionFormProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateInfo | null>(null);

  const [rawSummary, setRawSummary] = useState("");
  /** Um texto por tópico, na mesma ordem de `template.topics`. */
  const [topicValues, setTopicValues] = useState<string[]>([]);
  /** false = etapa do resumo; true = etapa de revisar e assinar. */
  const [drafting, setDrafting] = useState(false);

  const [generatedByAI, setGeneratedByAI] = useState(false);
  const [promptVersion, setPromptVersion] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("edit");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const summaryTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const topicRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const dictation = useFieldDictation<DictationField>((field, text, cursorPos) => {
    if (field === "summary") {
      setRawSummary((prev) => insertTextAt(prev, text, cursorPos));
      return;
    }
    const index = Number(field.split("-")[1]);
    setTopicValues((prev) => prev.map((v, i) => (i === index ? insertTextAt(v, text, cursorPos) : v)));
  });

  // Só o resumo tem gravação ao vivo (os campos por tópico, quando existem,
  // são preenchidos pela IA a partir do resumo — não têm botão de gravação
  // próprio, mesma assimetria que já existia no upload de arquivo).
  const audioRecorder = useAudioRecorder<"summary">();

  const isDictating = dictation.activeField !== null;
  const isDictatingSummary = dictation.activeField === "summary";

  const singleTopic = (template?.topics.length ?? 0) <= 1;

  // Carrega modelo + rascunho do servidor. Antes da Etapa 79 isso vinha do
  // localStorage, então sumia ao trocar de aparelho e a coordenação não tinha
  // como saber que alguém tinha começado a escrever.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      const result = await openEvolutionEditor(appointmentId);
      if (cancelado) return;

      if (result.error || !result.template) {
        setLoadError(result.error ?? "Não foi possível abrir o editor de evolução.");
        setLoading(false);
        return;
      }

      setTemplate(result.template);

      const salvos = result.draft?.topics ?? [];
      setTopicValues(
        result.template.topics.map(
          (t) => salvos.find((s) => s.label === t.label)?.content ?? "",
        ),
      );
      setRawSummary(result.draft?.rawSummaryInput ?? "");
      // Rascunho com texto já escrito volta direto na etapa de revisão.
      const temTexto = salvos.some((s) => s.content.trim());
      setDrafting(temTexto);
      setViewMode(temTexto ? "preview" : "edit");
      if (result.draft) setSavedAt(result.draft.updatedAt);
      setLoading(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [appointmentId]);

  const topicsPayload = useMemo(
    () =>
      (template?.topics ?? []).map((t, i) => ({
        label: t.label,
        content: topicValues[i] ?? "",
        order: i,
      })),
    [template, topicValues],
  );

  const temConteudo = topicsPayload.some((t) => t.content.trim()) || rawSummary.trim().length > 0;

  const persistirRascunho = useCallback(async () => {
    if (!template) return;
    const result = await saveEvolutionDraft({
      appointment_id: appointmentId,
      topics: topicsPayload,
      raw_summary_input: rawSummary,
      ai_prompt_version: promptVersion,
      template_id: template.id,
      template_version: template.version,
    });
    if (!result.error && result.savedAt) setSavedAt(result.savedAt);
  }, [appointmentId, template, topicsPayload, rawSummary, promptVersion]);

  // Autosave. Silencioso de propósito: falha de gravação nunca pode atrapalhar
  // quem está escrevendo — o texto segue na tela e a próxima tecla tenta de
  // novo. O aviso explícito só aparece ao assinar, que é quando importa.
  useEffect(() => {
    if (loading || !template || !temConteudo) return;
    const timeout = setTimeout(() => {
      void persistirRascunho();
    }, 1500);
    return () => clearTimeout(timeout);
  }, [loading, template, temConteudo, persistirRascunho]);

  const mentionsPatientName = useMemo(() => {
    const firstName = patientName?.trim().split(/\s+/)[0];
    if (!firstName || firstName.length < 3 || !rawSummary.trim()) return false;
    return new RegExp(`(?<![\\p{L}])${firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu").test(
      rawSummary,
    );
  }, [patientName, rawSummary]);

  const pendingReview = topicValues.some((v) => hasPendingReviewMarkers(v));

  function setTopicValue(index: number, value: string) {
    setTopicValues((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  async function handleGenerate() {
    if (!rawSummary.trim() || generating || dictation.status !== "idle" || !template) return;
    setGenError(null);
    setGenerating(true);

    const result = await generateQuickEvolutionDraft({
      rawSummary,
      appointmentId,
      topicLabels: template.topics.map((t) => t.label),
    });

    setGenerating(false);

    if (result.error) {
      setGenError(result.error);
      return;
    }

    if (result.topics) {
      setTopicValues(template.topics.map((t) => result.topics!.find((r) => r.label === t.label)?.content ?? ""));
    } else if (result.text) {
      setTopicValues(template.topics.map((_, i) => (i === 0 ? result.text! : "")));
    } else {
      setGenError("Não foi possível gerar a evolução com IA.");
      return;
    }

    setPromptVersion(result.promptVersion ?? null);
    setGeneratedByAI(true);
    setDrafting(true);
    setViewMode("preview");
  }

  function handleWriteManually() {
    setGenError(null);
    setGeneratedByAI(false);
    setPromptVersion(null);
    setDrafting(true);
    setViewMode("edit");
  }

  function handleBackToSummary() {
    setDrafting(false);
    setGeneratedByAI(false);
    setGenError(null);
  }

  async function handleSave() {
    if (!template) return;

    if (!topicsPayload.some((t) => t.content.trim())) {
      setSaveError("Escreva a evolução antes de assinar.");
      return;
    }
    if (pendingReview) {
      setSaveError("Ainda há trechos marcados para revisão — resolva-os antes de assinar.");
      return;
    }
    if (dictation.status !== "idle") {
      setSaveError("Pare a gravação de voz em andamento antes de salvar.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const result = await signEvolutionFromDraft({
      appointment_id: appointmentId,
      topics: topicsPayload,
      raw_summary_input: rawSummary,
      ai_prompt_version: promptVersion,
      template_id: template.id,
      template_version: template.version,
    });

    setSaving(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }
    onSaved();
  }

  async function handleDiscard() {
    if (!savedAt) {
      onCancel();
      return;
    }
    setSaving(true);
    await discardEvolutionDraft(appointmentId);
    setSaving(false);
    onCancel();
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
    setRawSummary((prev) =>
      insertTextAt(prev, result.text ?? "", summaryTextareaRef.current?.selectionStart ?? prev.length),
    );
  }

  function handleSummaryKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      handleGenerate();
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="h-4 w-40 animate-pulse rounded bg-card-elevated" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-card-elevated" />
        <div className="h-8 w-48 animate-pulse rounded bg-card-elevated" />
      </div>
    );
  }

  if (loadError || !template) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-danger">{loadError}</p>
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {aiEnabled && <AIDisclaimerNotice />}

      {/* Só vale mostrar o modelo quando ele não é o padrão de um tópico — aí a
          informação explica por que há vários campos. */}
      {!singleTopic && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          Modelo: {template.name}
          <span className="ml-1.5 font-medium normal-case tracking-normal text-text-muted">
            {template.topics.length} tópicos
          </span>
        </p>
      )}

      {!drafting ? (
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
            disabled={isDictatingSummary}
          />

          {mentionsPatientName && (
            <p className="text-xs font-medium text-warning">
              Evite citar o nome do paciente no resumo — o texto enviado à IA é mascarado automaticamente, mas o
              prontuário já identifica o paciente pelo atendimento.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Ditado (Web Speech API) e gravação (MediaRecorder) nunca ativos
                ao mesmo tempo no mesmo campo — são dois consumidores de
                microfone distintos, abrir os dois juntos é, na melhor das
                hipóteses, confuso, e em alguns navegadores disputa o mesmo
                dispositivo de captura. */}
            {audioRecorder.activeField === null && (
              <DictationControls field="summary" getTarget={() => summaryTextareaRef.current} dictation={dictation} />
            )}
            {transcriptionEnabled && !isDictating && (
              <AudioRecorderButton
                field="summary"
                recorder={audioRecorder}
                appointmentId={appointmentId}
                enabled
                onTranscribed={(text) =>
                  setRawSummary((prev) =>
                    insertTextAt(prev, text, summaryTextareaRef.current?.selectionStart ?? prev.length),
                  )
                }
              />
            )}
          </div>

          {isDictatingSummary && dictation.interimText && (
            <p className="whitespace-pre-wrap text-xs italic leading-relaxed text-text-secondary">
              {dictation.interimText}
            </p>
          )}
          {dictation.error && <p className="text-xs font-semibold text-danger">{dictation.error}</p>}

          {transcriptionEnabled && !isDictating && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="text-[11px] font-semibold text-text-secondary hover:underline"
              >
                {transcribing ? "Transcrevendo arquivo..." : "ou envie um arquivo de áudio já gravado"}
              </button>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/m4a,audio/wav,audio/x-wav,audio/webm,.mp3,.m4a,.wav,.webm,.mp4,.mpeg,.mpga"
                className="hidden"
                onChange={handleAudioUpload}
              />
            </div>
          )}

          {aiEnabled ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-text-muted">Atalho: Ctrl+Enter para gerar</p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={handleWriteManually} disabled={generating}>
                  Escrever manualmente
                </Button>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  isLoading={generating}
                  disabled={!rawSummary.trim() || isDictating}
                >
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
                Você pode tentar gerar de novo ou escrever/colar a evolução manualmente — o resumo acima não foi
                perdido.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {savedAt ? (
              <p className="text-[11px] text-text-muted">
                Rascunho salvo às {horaFormatter.format(new Date(savedAt))}
              </p>
            ) : (
              <span />
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleDiscard} disabled={generating || saving}>
              {savedAt ? "Descartar rascunho" : "Cancelar"}
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
              <div className="flex min-h-[9rem] w-full flex-col gap-3 rounded-xl border border-border bg-card-elevated px-3.5 py-2.5">
                {topicsPayload.filter((t) => t.content.trim()).length === 0 ? (
                  <p className="text-xs italic text-text-muted">Nada escrito ainda.</p>
                ) : (
                  topicsPayload
                    .filter((t) => t.content.trim())
                    .map((t) => (
                      <div key={t.order} className="flex flex-col gap-0.5">
                        {!singleTopic && (
                          <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                            {t.label}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-text-primary">
                          {splitReviewMarkers(t.content).map((segment, index) =>
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
                        </p>
                      </div>
                    ))
                )}
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="outline" onClick={() => setViewMode("edit")}>
                  ✏️ Editar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {template.topics.map((topic, index) => (
                <div key={`${topic.label}-${index}`} className="flex flex-col gap-1.5">
                  <Textarea
                    ref={(el) => {
                      topicRefs.current[index] = el;
                    }}
                    label={singleTopic ? "Evolução (edite o que quiser antes de assinar)" : topic.label}
                    rows={singleTopic ? 10 : 5}
                    value={topicValues[index] ?? ""}
                    onChange={(e) => setTopicValue(index, e.target.value)}
                    disabled={dictation.activeField === `topic-${index}`}
                  />
                  {topic.hint && <p className="text-[11px] text-text-muted">{topic.hint}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <DictationControls
                      field={`topic-${index}`}
                      getTarget={() => topicRefs.current[index]}
                      dictation={dictation}
                    />
                    {dictation.activeField === `topic-${index}` && dictation.interimText && (
                      <p className="whitespace-pre-wrap text-xs italic leading-relaxed text-text-secondary">
                        {dictation.interimText}
                      </p>
                    )}
                  </div>
                </div>
              ))}
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
            <div className="flex flex-col gap-0.5">
              <Button type="button" variant="outline" size="sm" onClick={handleBackToSummary} disabled={saving}>
                ← Voltar ao resumo
              </Button>
              {savedAt && (
                <p className="text-[11px] text-text-muted">
                  Rascunho salvo às {horaFormatter.format(new Date(savedAt))}
                </p>
              )}
            </div>
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

      {onSwitchToDetailedMode && !drafting && (
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

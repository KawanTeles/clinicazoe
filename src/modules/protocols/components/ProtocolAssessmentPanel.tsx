"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import {
  loadAvailableProtocolTemplates,
  loadProtocolAssessments,
  submitProtocolAssessment,
} from "@/modules/protocols/services/protocol-actions";
import type { ProtocolAssessmentView, ProtocolTemplateView } from "@/modules/protocols/services/protocol-queries";
import type { ProtocolAssessmentResponse } from "@/lib/supabase/types";
import { scoreAssessment, type ScorableResponse } from "@/lib/protocol-scoring";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const todayISO = () => new Date().toISOString().slice(0, 10);

export function ProtocolAssessmentPanel({ patientId }: { patientId: string }) {
  const [templates, setTemplates] = useState<ProtocolTemplateView[]>([]);
  const [assessments, setAssessments] = useState<ProtocolAssessmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function reload() {
    const [templateList, assessmentList] = await Promise.all([
      loadAvailableProtocolTemplates(),
      loadProtocolAssessments(patientId),
    ]);
    setTemplates(templateList);
    setAssessments(assessmentList);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [patientId]);

  const applyingTemplate = templates.find((t) => t.id === applyingTemplateId) ?? null;
  const previewTemplate = templates.find((t) => t.id === previewTemplateId) ?? null;

  if (loading) {
    return <div className="h-32 w-full animate-pulse rounded-xl bg-card-elevated" />;
  }

  if (applyingTemplate) {
    return (
      <AssessmentForm
        template={applyingTemplate}
        patientId={patientId}
        previewOnly={false}
        onCancel={() => setApplyingTemplateId(null)}
        onSaved={async () => {
          setApplyingTemplateId(null);
          await reload();
        }}
      />
    );
  }

  if (previewTemplate) {
    return (
      <AssessmentForm
        template={previewTemplate}
        patientId={patientId}
        previewOnly
        onCancel={() => setPreviewTemplateId(null)}
        onSaved={() => setPreviewTemplateId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">Aplicar protocolo</p>
        {templates.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Nenhum protocolo disponível ainda. Peça para a administração ou monte e publique um protocolo pessoal em
            &quot;Protocolos de Avaliação&quot; nas configurações.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card-elevated/50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.items.length} itens{t.scoringEnabled ? " · com pontuação" : ""}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPreviewTemplateId(t.id)}>
                    Prévia
                  </Button>
                  <Button size="sm" onClick={() => setApplyingTemplateId(t.id)}>
                    Aplicar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Avaliações anteriores</p>
        {assessments.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhuma avaliação registrada para este paciente ainda.</p>
        ) : (
          assessments.map((a) => {
            const achievedCount = a.responses.filter((r) => r.achieved).length;
            const expanded = expandedId === a.id;
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : a.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{a.templateName}</p>
                    <p className="text-xs text-text-secondary">{dateFormatter.format(new Date(`${a.assessmentDate}T00:00:00`))}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.totalScore != null && (
                      <Badge tone="neutral" className="text-[10px]">
                        {a.totalScore} pts{a.interpretationLabel ? ` · ${a.interpretationLabel}` : ""}
                      </Badge>
                    )}
                    <span className="text-xs font-semibold text-text-secondary">
                      {achievedCount}/{a.responses.length} atingidos
                    </span>
                  </div>
                </button>
                {expanded && (
                  <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3">
                    {a.responses.map((r, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 text-xs">
                        <span className="text-text-primary">
                          {r.domain && <span className="font-bold uppercase text-text-muted">{r.domain} · </span>}
                          {r.label}
                        </span>
                        <span className={r.achieved ? "font-bold text-success" : "font-bold text-text-muted"}>
                          {r.achieved ? "Atingido" : "Não atingido"}
                        </span>
                      </div>
                    ))}
                    {a.notes && <p className="mt-1 text-xs text-text-secondary">Nota: {a.notes}</p>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AssessmentForm({
  template,
  patientId,
  previewOnly,
  onCancel,
  onSaved,
}: {
  template: ProtocolTemplateView;
  patientId: string;
  previewOnly: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [achieved, setAchieved] = useState<Record<string, boolean>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [assessmentDate, setAssessmentDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof template.items>();
    for (const item of template.items) {
      const key = item.domain ?? "";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [template]);

  const liveScore = useMemo(() => {
    if (!template.scoringEnabled) return null;
    const responses: ScorableResponse[] = template.items.map((item) => ({
      domain: item.domain,
      achieved: Boolean(achieved[item.id]),
      pointValue: item.pointValue,
    }));
    return scoreAssessment(responses, template.bands);
  }, [template, achieved]);

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const responses: ProtocolAssessmentResponse[] = template.items.map((item) => ({
      domain: item.domain,
      label: item.label,
      achieved: Boolean(achieved[item.id]),
      notes: itemNotes[item.id]?.trim() || null,
      pointValue: item.pointValue,
    }));

    const result = await submitProtocolAssessment({
      templateId: template.id,
      templateName: template.name,
      templateVersion: template.version,
      patientId,
      assessmentDate,
      responses,
      notes,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onCancel} className="self-start text-xs font-semibold text-text-secondary hover:underline">
        ← Voltar
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-text-primary">{template.name}</h3>
            {template.description && <p className="mt-1 text-sm text-text-secondary">{template.description}</p>}
          </div>
          {previewOnly && <Badge tone="warning">Prévia — nada aqui é salvo</Badge>}
        </div>
      </div>

      <Input
        label="Data da avaliação"
        type="date"
        value={assessmentDate}
        onChange={(e) => setAssessmentDate(e.target.value)}
        max={todayISO()}
        disabled={previewOnly}
      />

      {grouped.map(([domain, items]) => (
        <div key={domain} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          {domain && <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">{domain}</p>}
          {items.map((item) => (
            <label
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card-elevated/40 px-3 py-2.5"
            >
              <input
                type="checkbox"
                checked={Boolean(achieved[item.id])}
                onChange={(e) => setAchieved((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span className="flex-1 text-sm text-text-primary">{item.label}</span>
              {template.scoringEnabled && <span className="text-xs font-semibold text-text-muted">{item.pointValue} pt(s)</span>}
            </label>
          ))}
          {liveScore && domain && (
            <p className="mt-1 text-xs font-semibold text-text-secondary">
              Subtotal:{" "}
              {liveScore.byDomain.find((d) => d.domain === domain)?.score ?? 0}/
              {liveScore.byDomain.find((d) => d.domain === domain)?.maxPossible ?? 0}
              {liveScore.byDomain.find((d) => d.domain === domain)?.band && (
                <> · {liveScore.byDomain.find((d) => d.domain === domain)?.band?.label}</>
              )}
            </p>
          )}
        </div>
      ))}

      {liveScore && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-bold text-text-primary">
            Pontuação total: {liveScore.total.score}/{liveScore.total.maxPossible}
          </p>
          {liveScore.total.band && (
            <p className="mt-1 text-xs font-semibold text-[var(--primary)]">{liveScore.total.band.label}</p>
          )}
        </div>
      )}

      <Textarea label="Observações gerais (opcional)" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={previewOnly} />

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          {previewOnly ? "Fechar prévia" : "Cancelar"}
        </Button>
        {!previewOnly && (
          <Button type="button" isLoading={saving} onClick={handleSubmit}>
            Salvar avaliação
          </Button>
        )}
      </div>
    </div>
  );
}

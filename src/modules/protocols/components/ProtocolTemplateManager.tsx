"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import {
  addInterpretationBand,
  addProtocolItems,
  archiveProtocolTemplate,
  createProtocolTemplate,
  duplicateProtocolTemplate,
  hideProtocolItem,
  loadInterpretationBands,
  loadProtocolTemplateItems,
  publishProtocolTemplate,
  removeInterpretationBand,
  setTemplateScoringEnabled,
  unpublishProtocolTemplate,
  updateItemPointValue,
} from "@/modules/protocols/services/protocol-actions";
import {
  getMyProtocolAiRequests,
  requestProtocolTemplateFromAI,
  type ProtocolAiRequestView,
} from "@/modules/ai/services/protocol-ai-actions";
import type { ProtocolTemplateSummary, ProtocolItemView, InterpretationBandView } from "@/modules/protocols/services/protocol-queries";
import type { EvolutionTemplateScope } from "@/lib/supabase/types";

const AI_REQUEST_STATUS_LABELS: Record<ProtocolAiRequestView["status"], string> = {
  pending: "Na fila",
  processing: "Criando…",
  done: "Pronto",
  error: "Erro",
};

const AI_REQUEST_STATUS_TONE: Record<ProtocolAiRequestView["status"], "neutral" | "warning" | "success" | "danger"> = {
  pending: "neutral",
  processing: "warning",
  done: "success",
  error: "danger",
};

const SCOPE_LABELS: Record<EvolutionTemplateScope, string> = {
  global: "Padrão da clínica",
  area: "Padrão da área",
  personal: "Meu protocolo",
};

interface ProtocolTemplateManagerProps {
  templates: ProtocolTemplateSummary[];
  specialties: { id: string; name: string }[];
  canManageOwn: boolean;
  canManageShared: boolean;
  aiEnabled: boolean;
}

export function ProtocolTemplateManager({ templates, specialties, canManageOwn, canManageShared, aiEnabled }: ProtocolTemplateManagerProps) {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAiForm, setShowAiForm] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);

  const managing = templates.find((t) => t.id === managingId) ?? null;

  if (managing) {
    return <ItemsManager template={managing} onBack={() => setManagingId(null)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {aiEnabled && (canManageOwn || canManageShared) && <ProtocolAiRequestsPanel />}

      <div className="flex flex-wrap justify-end gap-2">
        {aiEnabled && (canManageOwn || canManageShared) && (
          <Button size="sm" variant="outline" onClick={() => setShowAiForm((v) => !v)}>
            {showAiForm ? "Cancelar" : "✨ Criar com IA"}
          </Button>
        )}
        <Button size="sm" onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? "Cancelar" : "+ Novo protocolo"}
        </Button>
      </div>

      {showAiForm && (
        <CreateWithAiForm
          specialties={specialties}
          onRequested={() => {
            setShowAiForm(false);
            router.refresh();
          }}
          onCancel={() => setShowAiForm(false)}
        />
      )}

      {showCreateForm && (
        <CreateTemplateForm
          specialties={specialties}
          canManageOwn={canManageOwn}
          canManageShared={canManageShared}
          onCreated={() => {
            setShowCreateForm(false);
            router.refresh();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-text-secondary">Nenhum protocolo criado ainda.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div>
                <p className="font-semibold text-text-primary">{t.name}</p>
                <p className="text-xs text-text-secondary">
                  {t.itemCount} item{t.itemCount === 1 ? "" : "s"} · versão {t.version}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{SCOPE_LABELS[t.scope]}</Badge>
                <Badge tone={t.publishedAt ? "success" : "warning"}>{t.publishedAt ? "Publicado" : "Rascunho"}</Badge>
                <Button size="sm" variant="outline" onClick={() => setManagingId(t.id)}>
                  Itens
                </Button>
                <PublishButton templateId={t.id} published={t.publishedAt != null} onChanged={() => router.refresh()} />
                <DuplicateButton templateId={t.id} onDuplicated={() => router.refresh()} />
                <ArchiveButton templateId={t.id} onArchived={() => router.refresh()} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PublishButton({
  templateId,
  published,
  onChanged,
}: {
  templateId: string;
  published: boolean;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = published ? await unpublishProtocolTemplate(templateId) : await publishProtocolTemplate(templateId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onChanged();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant={published ? "outline" : "primary"} isLoading={loading} onClick={handleClick}>
        {published ? "Despublicar" : "Publicar"}
      </Button>
      {error && <p className="text-[11px] font-semibold text-danger">{error}</p>}
    </div>
  );
}

function DuplicateButton({ templateId, onDuplicated }: { templateId: string; onDuplicated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await duplicateProtocolTemplate(templateId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDuplicated();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" isLoading={loading} onClick={handleClick}>
        Duplicar / Personalizar
      </Button>
      {error && <p className="text-[11px] font-semibold text-danger">{error}</p>}
    </div>
  );
}

function ArchiveButton({ templateId, onArchived }: { templateId: string; onArchived: () => void }) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    if (!confirm("Arquivar este protocolo? Ele deixa de aparecer para aplicar em pacientes, mas avaliações já feitas continuam acessíveis.")) return;
    setLoading(true);
    await archiveProtocolTemplate(templateId);
    setLoading(false);
    onArchived();
  }
  return (
    <Button size="sm" variant="danger" isLoading={loading} onClick={handleClick}>
      Arquivar
    </Button>
  );
}

function CreateTemplateForm({
  specialties,
  canManageOwn,
  canManageShared,
  onCreated,
  onCancel,
}: {
  specialties: { id: string; name: string }[];
  canManageOwn: boolean;
  canManageShared: boolean;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const defaultScope: EvolutionTemplateScope = canManageShared ? "global" : "personal";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<EvolutionTemplateScope>(defaultScope);
  const [specialtyId, setSpecialtyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Dê um nome ao protocolo.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createProtocolTemplate({
      name,
      description,
      scope,
      specialtyId: scope === "area" ? specialtyId : null,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <Input label="Nome do protocolo" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea label="Descrição (opcional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />

      {(canManageOwn || canManageShared) && (
        <Select label="Abrangência" value={scope} onChange={(e) => setScope(e.target.value as EvolutionTemplateScope)}>
          {canManageShared && <option value="global">{SCOPE_LABELS.global}</option>}
          {canManageShared && <option value="area">{SCOPE_LABELS.area}</option>}
          {canManageOwn && <option value="personal">{SCOPE_LABELS.personal}</option>}
        </Select>
      )}

      {scope === "area" && (
        <Select label="Especialidade" value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)}>
          <option value="">Selecione</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" isLoading={saving} onClick={handleSubmit}>
          Criar protocolo
        </Button>
      </div>
    </div>
  );
}

function parseCsv(text: string): { domain: string | null; label: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Aceita com ou sem cabeçalho ("dominio,item" / "domain,label") — se a
  // primeira linha não tem vírgula nenhuma, trata como item sem domínio.
  const startIndex = /^dom[ií]nio|^domain/i.test(lines[0]) ? 1 : 0;

  return lines.slice(startIndex).map((line) => {
    const commaIndex = line.indexOf(",");
    if (commaIndex === -1) return { domain: null, label: line.trim() };
    const domain = line.slice(0, commaIndex).trim();
    const label = line.slice(commaIndex + 1).trim().replace(/^"|"$/g, "");
    return { domain: domain || null, label };
  }).filter((item) => item.label.length > 0);
}

function ItemsManager({ template, onBack }: { template: ProtocolTemplateSummary; onBack: () => void }) {
  const [items, setItems] = useState<ProtocolItemView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [csvText, setCsvText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scoringEnabled, setScoringEnabled] = useState(template.scoringEnabled);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const list = await loadProtocolTemplateItems(template.id);
    setItems(list);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [template.id]);

  async function handleToggleScoring(next: boolean) {
    setScoringEnabled(next);
    await setTemplateScoringEnabled(template.id, next);
  }

  async function handlePointValueChange(itemId: string, pointValue: number) {
    setItems((prev) => prev?.map((i) => (i.id === itemId ? { ...i, pointValue } : i)) ?? prev);
    await updateItemPointValue(itemId, pointValue);
  }

  async function handleAddSingle() {
    if (!newLabel.trim()) return;
    setSaving(true);
    setError(null);
    const result = await addProtocolItems(template.id, [{ domain: newDomain, label: newLabel }]);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNewDomain("");
    setNewLabel("");
    await reload();
  }

  async function handleImportCsv() {
    const parsed = parseCsv(csvText);
    if (parsed.length === 0) {
      setError("Nenhum item reconhecido no CSV.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const result = await addProtocolItems(template.id, parsed);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(`${result.added} item(ns) importado(s).`);
    setCsvText("");
    await reload();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  }

  async function handleHide(itemId: string) {
    await hideProtocolItem(itemId);
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="self-start text-xs font-semibold text-text-secondary hover:underline">
        ← Voltar aos protocolos
      </button>

      <h3 className="text-lg font-bold text-text-primary">{template.name}</h3>

      <div className="rounded-2xl border border-border bg-card p-4">
        <Switch
          label="Pontuação (soma pontos dos itens atingidos, com faixas de interpretação)"
          checked={scoringEnabled}
          onChange={handleToggleScoring}
        />
      </div>

      {scoringEnabled && <InterpretationBandsEditor templateId={template.id} />}

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Adicionar item</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="sm:w-1/3">
            <Input placeholder="Domínio (opcional)" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
          </div>
          <div className="flex-1">
            <Input placeholder="Texto do item" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </div>
          <Button type="button" isLoading={saving} onClick={handleAddSingle} disabled={!newLabel.trim()}>
            Adicionar
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Importar CSV</p>
        <p className="text-[11px] text-text-muted">
          Duas colunas: domínio, item (domínio pode ficar vazio). Cole o conteúdo abaixo ou envie um arquivo .csv.
        </p>
        <Textarea
          rows={5}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"Linguagem, Aponta para objetos de interesse\nLinguagem, Atende ao nome\nMotor, Sobe escada alternando os pés"}
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] font-semibold text-text-secondary hover:underline"
          >
            ou selecione um arquivo .csv
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          <Button type="button" size="sm" isLoading={saving} onClick={handleImportCsv} disabled={!csvText.trim()}>
            Importar
          </Button>
        </div>
        {success && <p className="text-xs font-semibold text-success">{success}</p>}
      </div>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">Itens ({items?.length ?? 0})</p>
        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-card-elevated" />
        ) : items && items.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card-elevated/40 px-3 py-2 text-xs">
                <span>
                  {item.domain && <span className="font-bold uppercase text-text-muted">{item.domain} · </span>}
                  {item.label}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {scoringEnabled && (
                    <label className="flex items-center gap-1 text-[11px] text-text-muted">
                      Pontos
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        defaultValue={item.pointValue}
                        onBlur={(e) => handlePointValueChange(item.id, Number(e.target.value))}
                        className="h-6 w-14 rounded border border-border bg-card px-1 text-center text-xs text-text-primary"
                      />
                    </label>
                  )}
                  <button type="button" onClick={() => handleHide(item.id)} className="font-semibold text-danger hover:underline">
                    Ocultar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">Nenhum item ainda.</p>
        )}
      </div>
    </div>
  );
}

/** Faixas de interpretação (F9): "null" = faixa da pontuação TOTAL; com
 * domínio preenchido = faixa daquela subescala. Mostradas na aplicação e no
 * histórico de avaliações (ProtocolAssessmentPanel), calculadas ali com
 * src/lib/protocol-scoring.ts. */
function InterpretationBandsEditor({ templateId }: { templateId: string }) {
  const [bands, setBands] = useState<InterpretationBandView[] | null>(null);
  const [domain, setDomain] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [maxScore, setMaxScore] = useState("10");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setBands(await loadInterpretationBands(templateId));
  }

  useEffect(() => {
    void reload();
  }, [templateId]);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    const result = await addInterpretationBand(templateId, {
      domain: domain.trim() || null,
      minScore: Number(minScore),
      maxScore: Number(maxScore),
      label,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLabel("");
    await reload();
  }

  async function handleRemove(bandId: string) {
    await removeInterpretationBand(bandId);
    await reload();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Faixas de interpretação</p>
      <p className="text-[11px] text-text-muted">
        Deixe &quot;Subescala&quot; vazio para configurar a faixa da pontuação TOTAL; preencha com o nome de um domínio para uma
        faixa só daquela subescala.
      </p>

      {bands && bands.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {bands.map((band) => (
            <li key={band.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card-elevated/40 px-3 py-2 text-xs">
              <span>
                <span className="font-bold text-text-primary">{band.domain ?? "Total"}</span>: {band.minScore}–{band.maxScore} →{" "}
                {band.label}
              </span>
              <button type="button" onClick={() => handleRemove(band.id)} className="shrink-0 font-semibold text-danger hover:underline">
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Input placeholder="Subescala (opcional)" value={domain} onChange={(e) => setDomain(e.target.value)} />
        <Input type="number" placeholder="Mín." value={minScore} onChange={(e) => setMinScore(e.target.value)} />
        <Input type="number" placeholder="Máx." value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
        <Input placeholder="Rótulo (ex.: Dentro do esperado)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button type="button" size="sm" isLoading={saving} disabled={!label.trim()} onClick={handleAdd}>
          Adicionar
        </Button>
      </div>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}

/** Fila "Pedidos de IA" (F9) — status muda de "Na fila"/"Criando..." para
 * "Pronto"/"Erro" a cada refresh da página (mesmo nível de "tempo real" do
 * sininho de notificações: sem WebSocket, só refetch). Só aparece pra quem
 * pode gerenciar algum protocolo (own ou shared) e com a IA habilitada. */
function ProtocolAiRequestsPanel() {
  const [requests, setRequests] = useState<ProtocolAiRequestView[] | null>(null);

  async function reload() {
    setRequests(await getMyProtocolAiRequests());
  }

  useEffect(() => {
    void reload();
  }, []);

  if (!requests || requests.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">Pedidos de IA</p>
      <ul className="flex flex-col gap-1.5">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card-elevated/40 px-3 py-2 text-xs">
            <span className="flex-1 text-text-primary">{r.description}</span>
            <Badge tone={AI_REQUEST_STATUS_TONE[r.status]} className="text-[10px]">
              {AI_REQUEST_STATUS_LABELS[r.status]}
            </Badge>
            {r.status === "error" && r.errorMessage && (
              <span className="text-[11px] text-danger" title={r.errorMessage}>
                ⚠
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreateWithAiForm({
  specialties,
  onRequested,
  onCancel,
}: {
  specialties: { id: string; name: string }[];
  onRequested: () => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const result = await requestProtocolTemplateFromAI(description, specialtyId || null);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onRequested();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <p className="text-xs text-text-secondary">
        Descreva o que você quer avaliar — a IA gera uma lista de itens genéricos (nunca copia instrumentos protegidos
        por direitos autorais) como RASCUNHO pessoal. Você revisa, ajusta e publica quando quiser; isso roda em
        segundo plano, acompanhe em &quot;Pedidos de IA&quot; acima.
      </p>
      <Textarea
        label="O que você quer avaliar?"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ex.: marcos de linguagem expressiva para crianças de 2 a 4 anos"
      />
      {specialties.length > 0 && (
        <Select label="Área (opcional, ajuda a IA a focar)" value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)}>
          <option value="">Sem área específica</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" isLoading={saving} disabled={description.trim().length < 10} onClick={handleSubmit}>
          Pedir à IA
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import {
  addProtocolItems,
  archiveProtocolTemplate,
  createProtocolTemplate,
  hideProtocolItem,
  loadProtocolTemplateItems,
} from "@/modules/protocols/services/protocol-actions";
import type { ProtocolTemplateSummary, ProtocolItemView } from "@/modules/protocols/services/protocol-queries";
import type { EvolutionTemplateScope } from "@/lib/supabase/types";

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
}

export function ProtocolTemplateManager({ templates, specialties, canManageOwn, canManageShared }: ProtocolTemplateManagerProps) {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);

  const managing = templates.find((t) => t.id === managingId) ?? null;

  if (managing) {
    return <ItemsManager template={managing} onBack={() => setManagingId(null)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? "Cancelar" : "+ Novo protocolo"}
        </Button>
      </div>

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
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div>
                <p className="font-semibold text-text-primary">{t.name}</p>
                <p className="text-xs text-text-secondary">
                  {t.itemCount} item{t.itemCount === 1 ? "" : "s"} · versão {t.version}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{SCOPE_LABELS[t.scope]}</Badge>
                <Button size="sm" variant="outline" onClick={() => setManagingId(t.id)}>
                  Itens
                </Button>
                <ArchiveButton templateId={t.id} onArchived={() => router.refresh()} />
              </div>
            </li>
          ))}
        </ul>
      )}
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const list = await loadProtocolTemplateItems(template.id);
    setItems(list);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [template.id]);

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
                <button type="button" onClick={() => handleHide(item.id)} className="shrink-0 font-semibold text-danger hover:underline">
                  Ocultar
                </button>
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

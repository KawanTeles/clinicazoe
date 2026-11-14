"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { EvolutionTemplateScope } from "@/lib/supabase/types";
import type { EvolutionTemplateView } from "@/modules/evolutions/services/template-queries";
import {
  archiveEvolutionTemplate,
  createEvolutionTemplate,
  updateEvolutionTemplate,
  type TemplateTopicInput,
} from "@/modules/evolutions/services/template-actions";

interface EvolutionTemplateManagerProps {
  templates: EvolutionTemplateView[];
  specialties: { id: string; name: string }[];
  currentProfessionalId: string;
  canManageOwn: boolean;
  canManageShared: boolean;
}

interface TopicDraft {
  id?: string;
  label: string;
  hint: string;
  hidden: boolean;
}

const SCOPE_LABELS: Record<EvolutionTemplateScope, string> = {
  global: "Padrão da clínica",
  area: "Padrão da área",
  personal: "Meu modelo",
};

function topicsToDraft(template: EvolutionTemplateView): TopicDraft[] {
  return template.topics.map((t) => ({ id: t.id, label: t.label, hint: t.hint ?? "", hidden: t.hidden }));
}

function toPayload(topics: TopicDraft[]): TemplateTopicInput[] {
  return topics.map((t) => ({ id: t.id, label: t.label, hint: t.hint, hidden: t.hidden }));
}

/** Editor de tópicos de um modelo. Usado tanto para editar um existente quanto
 * para montar um novo. */
function TopicEditor({
  topics,
  onChange,
  disabled,
}: {
  topics: TopicDraft[];
  onChange: (topics: TopicDraft[]) => void;
  disabled?: boolean;
}) {
  function atualizar(index: number, patch: Partial<TopicDraft>) {
    onChange(topics.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function mover(index: number, direcao: -1 | 1) {
    const destino = index + direcao;
    if (destino < 0 || destino >= topics.length) return;
    const copia = [...topics];
    [copia[index], copia[destino]] = [copia[destino], copia[index]];
    onChange(copia);
  }

  function remover(index: number) {
    onChange(topics.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {topics.map((topic, index) => (
        <div
          key={topic.id ?? `novo-${index}`}
          className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card-elevated/40 p-3"
        >
          <div className="flex items-start gap-2">
            <span className="mt-2.5 w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-text-muted">
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Input
                label="Nome do tópico"
                value={topic.label}
                disabled={disabled}
                placeholder="Ex.: Intervenções realizadas"
                onChange={(e) => atualizar(index, { label: e.target.value })}
              />
              <Input
                label="Dica de preenchimento (opcional)"
                value={topic.hint}
                disabled={disabled}
                placeholder="Aparece em cinza abaixo do campo"
                onChange={(e) => atualizar(index, { hint: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pl-7">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary">
              <input
                type="checkbox"
                checked={topic.hidden}
                disabled={disabled}
                onChange={(e) => atualizar(index, { hidden: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              Ocultar do formulário
              <span className="font-medium text-text-muted">(mantém nas evoluções já assinadas)</span>
            </label>

            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || index === 0}
                onClick={() => mover(index, -1)}
                aria-label={`Mover ${topic.label || "tópico"} para cima`}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || index === topics.length - 1}
                onClick={() => mover(index, 1)}
                aria-label={`Mover ${topic.label || "tópico"} para baixo`}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={disabled || topics.length === 1}
                onClick={() => remover(index)}
                aria-label={`Remover ${topic.label || "tópico"}`}
              >
                Remover
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() => onChange([...topics, { label: "", hint: "", hidden: false }])}
      >
        + Acrescentar tópico
      </Button>
    </div>
  );
}

export function EvolutionTemplateManager({
  templates,
  specialties,
  currentProfessionalId,
  canManageOwn,
  canManageShared,
}: EvolutionTemplateManagerProps) {
  const router = useRouter();
  const toast = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTopics, setEditTopics] = useState<TopicDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newScope, setNewScope] = useState<EvolutionTemplateScope>(canManageOwn ? "personal" : "area");
  const [newName, setNewName] = useState("");
  const [newSpecialtyId, setNewSpecialtyId] = useState("");
  const [newTopics, setNewTopics] = useState<TopicDraft[]>([{ label: "", hint: "", hidden: false }]);

  function podeEditar(template: EvolutionTemplateView) {
    if (template.scope === "personal") {
      return canManageOwn && template.ownerProfessionalId === currentProfessionalId;
    }
    return canManageShared;
  }

  function abrirEdicao(template: EvolutionTemplateView) {
    setEditingId(template.id);
    setEditName(template.name);
    setEditTopics(topicsToDraft(template));
    setError(null);
  }

  async function salvarEdicao() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    const result = await updateEvolutionTemplate({
      id: editingId,
      name: editName,
      topics: toPayload(editTopics),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("Modelo salvo.");
    setEditingId(null);
    router.refresh();
  }

  async function salvarNovo() {
    setSaving(true);
    setError(null);
    const result = await createEvolutionTemplate({
      name: newName,
      scope: newScope,
      specialty_id: newScope === "area" ? newSpecialtyId || null : null,
      topics: toPayload(newTopics),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("Modelo criado.");
    setCreating(false);
    setNewName("");
    setNewSpecialtyId("");
    setNewTopics([{ label: "", hint: "", hidden: false }]);
    router.refresh();
  }

  async function arquivar(template: EvolutionTemplateView) {
    setSaving(true);
    setError(null);
    const result = await archiveEvolutionTemplate(template.id);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("Modelo arquivado.");
    router.refresh();
  }

  const escoposDisponiveis: EvolutionTemplateScope[] = [
    ...(canManageOwn ? (["personal"] as const) : []),
    ...(canManageShared ? (["area"] as const) : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/[0.04] px-3.5 py-2.5 text-xs font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {templates.map((template) => {
          const editavel = podeEditar(template);
          const emEdicao = editingId === template.id;
          const visiveis = template.topics.filter((t) => !t.hidden).length;

          return (
            <div key={template.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-text-primary">{template.name}</p>
                    <span className="rounded-full border border-border bg-card-elevated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                      {SCOPE_LABELS[template.scope]}
                      {template.specialtyName ? ` · ${template.specialtyName}` : ""}
                    </span>
                    {template.isFactoryDefault && (
                      <span className="text-[10px] font-semibold text-text-muted">
                        usado por quem não tem modelo próprio
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {visiveis} {visiveis === 1 ? "tópico" : "tópicos"}
                    {template.topics.length !== visiveis && ` (+${template.topics.length - visiveis} oculto)`}
                    {" · "}versão {template.version}
                  </p>
                </div>

                {editavel && !emEdicao && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => abrirEdicao(template)}>
                      Editar tópicos
                    </Button>
                    {!template.isFactoryDefault && (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={saving}
                        onClick={() => arquivar(template)}
                      >
                        Arquivar
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {emEdicao ? (
                <div className="mt-4 flex flex-col gap-4 border-t border-border/60 pt-4">
                  <Input
                    label="Nome do modelo"
                    value={editName}
                    disabled={saving || template.isFactoryDefault}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <TopicEditor topics={editTopics} onChange={setEditTopics} disabled={saving} />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                    <Button type="button" size="sm" isLoading={saving} onClick={salvarEdicao}>
                      Salvar modelo
                    </Button>
                  </div>
                </div>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {template.topics.map((topic) => (
                    <li
                      key={topic.id}
                      className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                        topic.hidden
                          ? "border-dashed border-border text-text-muted line-through"
                          : "border-border bg-card-elevated/50 text-text-secondary"
                      }`}
                    >
                      {topic.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {escoposDisponiveis.length > 0 &&
        (creating ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-primary/40 bg-card p-5 shadow-card">
            <p className="text-sm font-bold text-text-primary">Novo modelo</p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Abrangência"
                value={newScope}
                disabled={saving || escoposDisponiveis.length === 1}
                onChange={(e) => setNewScope(e.target.value as EvolutionTemplateScope)}
              >
                {escoposDisponiveis.map((scope) => (
                  <option key={scope} value={scope}>
                    {SCOPE_LABELS[scope]}
                  </option>
                ))}
              </Select>

              {newScope === "area" && (
                <Select
                  label="Área (especialidade)"
                  value={newSpecialtyId}
                  disabled={saving}
                  onChange={(e) => setNewSpecialtyId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {specialties.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <Input
              label="Nome do modelo"
              value={newName}
              disabled={saving}
              placeholder="Ex.: Fonoaudiologia — sessão de treino"
              onChange={(e) => setNewName(e.target.value)}
            />

            <TopicEditor topics={newTopics} onChange={setNewTopics} disabled={saving} />

            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" isLoading={saving} onClick={salvarNovo}>
                Criar modelo
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              + Novo modelo
            </Button>
          </div>
        ))}
    </div>
  );
}

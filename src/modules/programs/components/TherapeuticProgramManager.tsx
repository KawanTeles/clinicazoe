"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { ProgramDataChart } from "@/modules/programs/components/ProgramDataChart";
import {
  addProgramDataSession,
  createTherapeuticProgram,
  loadDataSessions,
  loadTherapeuticPrograms,
  updateProgramMasteryCriteria,
  updateProgramStatus,
  type StructuredMasteryCriteriaInput,
} from "@/modules/programs/services/program-actions";
import type { ProgramDataSessionView, TherapeuticProgramView } from "@/modules/programs/services/program-queries";
import { evaluateMasteryCriteria } from "@/lib/mastery-criteria";
import type { MasteryCriteriaType, TherapeuticProgramStatus } from "@/lib/supabase/types";

const CRITERIA_TYPE_LABELS: Record<MasteryCriteriaType, string> = {
  percentage_independent: "% de respostas independentes",
  consecutive_correct_count: "Contagem de respostas independentes",
};

const STATUS_LABEL: Record<TherapeuticProgramStatus, string> = {
  active: "Em andamento",
  mastered: "Dominado",
  paused: "Pausado",
  discontinued: "Descontinuado",
};

const STATUS_TONE: Record<TherapeuticProgramStatus, "neutral" | "success" | "warning" | "danger"> = {
  active: "neutral",
  mastered: "success",
  paused: "warning",
  discontinued: "danger",
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const todayISO = () => new Date().toISOString().slice(0, 10);

export function TherapeuticProgramManager({ patientId }: { patientId: string }) {
  const [programs, setPrograms] = useState<TherapeuticProgramView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function reload() {
    const list = await loadTherapeuticPrograms(patientId);
    setPrograms(list);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [patientId]);

  const selected = programs.find((p) => p.id === selectedId) ?? null;

  if (loading) {
    return <div className="h-32 w-full animate-pulse rounded-xl bg-card-elevated" />;
  }

  if (selected) {
    return (
      <ProgramDetail
        program={selected}
        patientId={patientId}
        onBack={() => setSelectedId(null)}
        onStatusChanged={reload}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? "Cancelar" : "+ Novo programa"}
        </Button>
      </div>

      {showCreateForm && (
        <CreateProgramForm
          patientId={patientId}
          onCreated={async () => {
            setShowCreateForm(false);
            await reload();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {programs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-text-secondary">Nenhum programa terapêutico registrado para este paciente ainda.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {programs.map((program) => (
            <li key={program.id}>
              <button
                type="button"
                onClick={() => setSelectedId(program.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
              >
                <div>
                  <p className="font-semibold text-text-primary">{program.name}</p>
                  {program.masteryCriteria && (
                    <p className="mt-0.5 text-xs text-text-secondary">Critério: {program.masteryCriteria}</p>
                  )}
                </div>
                <Badge tone={STATUS_TONE[program.status]}>{STATUS_LABEL[program.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateProgramForm({
  patientId,
  onCreated,
  onCancel,
}: {
  patientId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [masteryCriteria, setMasteryCriteria] = useState("");
  const [structuredCriteria, setStructuredCriteria] = useState<StructuredMasteryCriteriaInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Dê um nome ao programa.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createTherapeuticProgram({ patientId, name, description, masteryCriteria, structuredCriteria });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <Input label="Nome do programa" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Contato visual ao ser chamado pelo nome" />
      <Textarea
        label="Descrição / alvo"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ex.: Olhar para o examinador em até 3s quando chamado pelo nome, em 3 contextos diferentes."
      />
      <Input
        label="Critério de domínio (observação em texto livre, opcional)"
        value={masteryCriteria}
        onChange={(e) => setMasteryCriteria(e.target.value)}
        placeholder="Ex.: 80% de independência em 3 sessões consecutivas"
      />
      <StructuredCriteriaFields value={structuredCriteria} onChange={setStructuredCriteria} />
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" isLoading={saving} onClick={handleSubmit}>
          Criar programa
        </Button>
      </div>
    </div>
  );
}

/** Campos numéricos do critério de domínio estruturado (F10) — reaproveitado
 * na criação do programa e na edição de um já existente. null = sem
 * critério estruturado (só o texto livre acima, ou nenhum critério). */
function StructuredCriteriaFields({
  value,
  onChange,
}: {
  value: StructuredMasteryCriteriaInput | null;
  onChange: (value: StructuredMasteryCriteriaInput | null) => void;
}) {
  const type = value?.type ?? "";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card-elevated/30 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
        Critério estruturado (opcional) — o sistema avisa automaticamente quando for atingido
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          value={type}
          onChange={(e) => {
            const nextType = e.target.value as MasteryCriteriaType | "";
            if (!nextType) {
              onChange(null);
              return;
            }
            onChange({ type: nextType, threshold: value?.threshold ?? 80, consecutiveSessions: value?.consecutiveSessions ?? 3 });
          }}
          className="h-10 rounded-xl border border-border bg-card-elevated px-3 text-xs font-medium text-text-primary"
        >
          <option value="">Nenhum critério estruturado</option>
          {(Object.keys(CRITERIA_TYPE_LABELS) as MasteryCriteriaType[]).map((t) => (
            <option key={t} value={t}>
              {CRITERIA_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {value && (
          <>
            <Input
              label={value.type === "percentage_independent" ? "Percentual (%)" : "Quantidade mínima"}
              type="number"
              min={0}
              max={value.type === "percentage_independent" ? 100 : undefined}
              value={String(value.threshold)}
              onChange={(e) => onChange({ ...value, threshold: Number(e.target.value) })}
            />
            <Input
              label="Sessões consecutivas"
              type="number"
              min={1}
              value={String(value.consecutiveSessions)}
              onChange={(e) => onChange({ ...value, consecutiveSessions: Number(e.target.value) })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ProgramDetail({
  program,
  patientId,
  onBack,
  onStatusChanged,
}: {
  program: TherapeuticProgramView;
  patientId: string;
  onBack: () => void;
  onStatusChanged: () => void;
}) {
  const [sessions, setSessions] = useState<ProgramDataSessionView[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState(false);
  const [criteriaDraft, setCriteriaDraft] = useState<StructuredMasteryCriteriaInput | null>(
    program.masteryCriteriaType && program.masteryCriteriaThreshold != null && program.masteryCriteriaConsecutiveSessions != null
      ? {
          type: program.masteryCriteriaType,
          threshold: program.masteryCriteriaThreshold,
          consecutiveSessions: program.masteryCriteriaConsecutiveSessions,
        }
      : null,
  );
  const [savingCriteria, setSavingCriteria] = useState(false);

  async function reloadSessions() {
    const list = await loadDataSessions(program.id);
    setSessions(list);
    setLoadingSessions(false);
  }

  useEffect(() => {
    void reloadSessions();
  }, [program.id]);

  async function handleStatusChange(status: TherapeuticProgramStatus) {
    setChangingStatus(true);
    await updateProgramStatus(program.id, status);
    setChangingStatus(false);
    onStatusChanged();
  }

  async function handleSaveCriteria() {
    setSavingCriteria(true);
    await updateProgramMasteryCriteria(program.id, criteriaDraft);
    setSavingCriteria(false);
    setEditingCriteria(false);
    onStatusChanged();
  }

  const mastery =
    program.masteryCriteriaType && program.masteryCriteriaThreshold != null && program.masteryCriteriaConsecutiveSessions != null
      ? evaluateMasteryCriteria(sessions, {
          type: program.masteryCriteriaType,
          threshold: program.masteryCriteriaThreshold,
          consecutiveSessions: program.masteryCriteriaConsecutiveSessions,
        })
      : null;

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="self-start text-xs font-semibold text-text-secondary hover:underline">
        ← Voltar aos programas
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-text-primary">{program.name}</h3>
            {program.description && <p className="mt-1 text-sm text-text-secondary">{program.description}</p>}
            {program.masteryCriteria && (
              <p className="mt-1 text-xs font-semibold text-text-secondary">Observação: {program.masteryCriteria}</p>
            )}
            {program.masteryCriteriaType && program.masteryCriteriaThreshold != null && program.masteryCriteriaConsecutiveSessions != null && (
              <p className="mt-1 text-xs text-text-muted">
                Critério estruturado: {CRITERIA_TYPE_LABELS[program.masteryCriteriaType]} ≥{" "}
                {program.masteryCriteriaThreshold}
                {program.masteryCriteriaType === "percentage_independent" ? "%" : ""} em{" "}
                {program.masteryCriteriaConsecutiveSessions} sessões consecutivas
              </p>
            )}
            <button
              type="button"
              onClick={() => setEditingCriteria((v) => !v)}
              className="mt-1 text-[11px] font-semibold text-[var(--primary)] hover:underline"
            >
              {editingCriteria ? "Cancelar edição do critério" : "Editar critério estruturado"}
            </button>
          </div>
          <select
            value={program.status}
            disabled={changingStatus}
            onChange={(e) => handleStatusChange(e.target.value as TherapeuticProgramStatus)}
            className="h-9 rounded-lg border border-border bg-card-elevated px-2 text-xs font-semibold text-text-primary"
          >
            {(Object.keys(STATUS_LABEL) as TherapeuticProgramStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>

        {editingCriteria && (
          <div className="mt-3 flex flex-col gap-2">
            <StructuredCriteriaFields value={criteriaDraft} onChange={setCriteriaDraft} />
            <div className="flex justify-end">
              <Button size="sm" isLoading={savingCriteria} onClick={handleSaveCriteria}>
                Salvar critério
              </Button>
            </div>
          </div>
        )}
      </div>

      {mastery?.met && (
        <div className="rounded-2xl border border-success/40 bg-success/10 p-4">
          <p className="text-sm font-bold text-success">🎯 Critério de domínio atingido</p>
          <p className="mt-1 text-xs text-text-secondary">
            As últimas {mastery.sessionsEvaluated.length} sessões bateram o critério configurado. A decisão de avançar
            de fase (mudar o status acima) é sua.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">% de independência por sessão</p>
        {loadingSessions ? (
          <div className="h-[120px] animate-pulse rounded-xl bg-card-elevated" />
        ) : (
          <ProgramDataChart sessions={sessions} />
        )}
      </div>

      <div className="flex justify-end gap-2">
        <a href={`/api/programs/${program.id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline">
            Exportar PDF
          </Button>
        </a>
        <Button size="sm" onClick={() => setShowEntryForm((v) => !v)}>
          {showEntryForm ? "Cancelar" : "+ Registrar sessão"}
        </Button>
      </div>

      {showEntryForm && (
        <DataEntryForm
          programId={program.id}
          patientId={patientId}
          onSaved={async () => {
            setShowEntryForm(false);
            await reloadSessions();
          }}
          onCancel={() => setShowEntryForm(false)}
        />
      )}

      {!loadingSessions && sessions.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Independente</th>
                <th className="px-4 py-3">Dica verbal</th>
                <th className="px-4 py-3">Dica gestual</th>
                <th className="px-4 py-3">Dica física</th>
                <th className="px-4 py-3">Incorreta</th>
                <th className="px-4 py-3">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[...sessions].reverse().map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-text-secondary">{dateTimeFormatter.format(new Date(s.createdAt))}</td>
                  <td className="px-4 py-3 font-semibold text-text-primary">{s.independentCount}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.verbalPromptCount}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.gesturalPromptCount}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.physicalPromptCount}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.incorrectCount}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TALLY_FIELDS: { key: "independent" | "verbal" | "gestural" | "physical" | "incorrect"; label: string }[] = [
  { key: "independent", label: "Independente" },
  { key: "verbal", label: "Dica verbal" },
  { key: "gestural", label: "Dica gestual" },
  { key: "physical", label: "Dica física" },
  { key: "incorrect", label: "Incorreta" },
];

function DataEntryForm({
  programId,
  patientId,
  onSaved,
  onCancel,
}: {
  programId: string;
  patientId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({
    independent: 0,
    verbal: 0,
    gestural: 0,
    physical: 0,
    incorrect: 0,
  });
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function bump(key: string, delta: number) {
    setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const result = await addProgramDataSession({
      programId,
      patientId,
      sessionDate,
      independentCount: counts.independent,
      verbalPromptCount: counts.verbal,
      gesturalPromptCount: counts.gestural,
      physicalPromptCount: counts.physical,
      incorrectCount: counts.incorrect,
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
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <Input
        label="Data da sessão"
        type="date"
        value={sessionDate}
        onChange={(e) => setSessionDate(e.target.value)}
        max={todayISO()}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TALLY_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center justify-between rounded-xl border border-border bg-card-elevated px-3 py-2">
            <span className="text-xs font-semibold text-text-primary">{field.label}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => bump(field.key, -1)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm font-bold text-text-secondary hover:bg-card"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-bold text-text-primary">{counts[field.key]}</span>
              <button
                type="button"
                onClick={() => bump(field.key, 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-sm font-bold text-primary hover:bg-primary/20"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <Textarea label="Nota (opcional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" isLoading={saving} onClick={handleSubmit}>
          Salvar sessão
        </Button>
      </div>
    </div>
  );
}

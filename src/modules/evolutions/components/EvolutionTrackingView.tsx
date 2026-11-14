"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { TrackingResult, TrackingRow } from "@/modules/evolutions/services/tracking-queries";
import {
  sendEvolutionPendingReminder,
  updateEvolutionLateThreshold,
} from "@/modules/evolutions/services/tracking-actions";

interface EvolutionTrackingViewProps {
  rows: TrackingRow[];
  counts: TrackingResult["counts"];
  lateAfterHours: number;
  professionalOptions: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  filters: { from: string; to: string; professional: string; specialty: string; status: string };
}

const STATUS_LABEL: Record<TrackingRow["status"], string> = {
  concluida: "Concluída",
  em_rascunho: "Em rascunho",
  pendente: "Pendente",
  atrasada: "Atrasada",
};

const STATUS_BADGE: Record<TrackingRow["status"], string> = {
  concluida: "border-primary/30 bg-primary/10 text-primary",
  em_rascunho: "border-border bg-card-elevated text-text-secondary",
  pendente: "border-warning/30 bg-warning/10 text-warning",
  atrasada: "border-danger/30 bg-danger/10 text-danger",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function baixarCsv(rows: TrackingRow[]) {
  const cabecalho = ["Data", "Hora", "Terapeuta", "Paciente", "Área", "Situação"];
  const linhas = rows.map((r) =>
    [
      dateFormatter.format(new Date(`${r.appointmentDate}T00:00:00`)),
      r.startTime.slice(0, 5),
      r.professionalName,
      r.patientName,
      r.specialtyName ?? "",
      STATUS_LABEL[r.status],
    ]
      .map((v) => csvEscape(v))
      .join(","),
  );
  const csv = [cabecalho.join(","), ...linhas].join("\n");
  // BOM UTF-8: sem isso o Excel abre acento quebrado.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acompanhamento-evolucoes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EvolutionTrackingView({
  rows,
  counts,
  lateAfterHours,
  professionalOptions,
  specialties,
  filters,
}: EvolutionTrackingViewProps) {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState(filters.status);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdValue, setThresholdValue] = useState(String(lateAfterHours));
  const [savingThreshold, setSavingThreshold] = useState(false);

  const rowsFiltradas = useMemo(
    () => (statusFilter ? rows.filter((r) => r.status === statusFilter) : rows),
    [rows, statusFilter],
  );

  const nomeDoProfissional = useMemo(() => {
    const mapa = new Map(professionalOptions.map((p) => [p.id, p.name]));
    for (const r of rows) if (!mapa.has(r.professionalId)) mapa.set(r.professionalId, r.professionalName);
    return mapa;
  }, [rows, professionalOptions]);

  const profissionaisComContagem = Object.keys(counts).sort((a, b) =>
    (nomeDoProfissional.get(a) ?? "").localeCompare(nomeDoProfissional.get(b) ?? "", "pt-BR"),
  );

  async function lembrar(professionalId: string, pendentes: number) {
    setSendingReminder(professionalId);
    const result = await sendEvolutionPendingReminder(professionalId, pendentes);
    setSendingReminder(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.sent ? "Lembrete enviado." : "Lembrete já estava ativo — atualizado.");
  }

  async function salvarPrazo() {
    const horas = Number(thresholdValue);
    setSavingThreshold(true);
    const result = await updateEvolutionLateThreshold(horas);
    setSavingThreshold(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Prazo salvo.");
    setEditingThreshold(false);
    // Recarrega a página pra já refletir o prazo novo nos status calculados
    // no servidor — mais simples e confiável que recalcular tudo no client.
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      {profissionaisComContagem.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profissionaisComContagem.map((profId) => {
            const c = counts[profId];
            const pendentesTotais = c.pendente + c.atrasada;
            return (
              <div key={profId} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-card">
                <p className="truncate text-sm font-bold text-text-primary">{nomeDoProfissional.get(profId) ?? "—"}</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-extrabold text-primary">{c.concluida}</p>
                    <p className="text-[10px] uppercase text-text-muted">Concluídas</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-text-secondary">{c.emRascunho}</p>
                    <p className="text-[10px] uppercase text-text-muted">Rascunho</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-warning">{c.pendente}</p>
                    <p className="text-[10px] uppercase text-text-muted">Pendentes</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-danger">{c.atrasada}</p>
                    <p className="text-[10px] uppercase text-text-muted">Atrasadas</p>
                  </div>
                </div>
                {pendentesTotais > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isLoading={sendingReminder === profId}
                    onClick={() => lembrar(profId, pendentesTotais)}
                  >
                    Lembrar pendência
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <Input label="De" type="date" name="from" defaultValue={filters.from} />
          <Input label="Até" type="date" name="to" defaultValue={filters.to} />
          <Select label="Terapeuta" name="professional" defaultValue={filters.professional}>
            <option value="">Todos</option>
            {professionalOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select label="Área" name="specialty" defaultValue={filters.specialty}>
            <option value="">Todas</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm">
            Filtrar
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Situação</span>
            {(["", "pendente", "atrasada", "em_rascunho", "concluida"] as const).map((s) => (
              <button
                key={s || "todas"}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-secondary hover:border-primary/40"
                }`}
              >
                {s === "" ? "Todas" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {editingThreshold ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  className="w-20"
                />
                <span className="text-xs text-text-secondary">horas</span>
                <Button type="button" size="sm" isLoading={savingThreshold} onClick={salvarPrazo}>
                  Salvar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingThreshold(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingThreshold(true)}
                className="text-xs font-semibold text-text-secondary hover:underline"
              >
                Prazo de atraso: {lateAfterHours}h
              </button>
            )}
            <Button type="button" size="sm" variant="outline" disabled={rowsFiltradas.length === 0} onClick={() => baixarCsv(rowsFiltradas)}>
              Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3">Terapeuta</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Área</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rowsFiltradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-secondary">
                  Nenhum atendimento no período e filtros selecionados.
                </td>
              </tr>
            ) : (
              rowsFiltradas.map((r) => (
                <tr key={`${r.appointmentId}-${r.professionalId}`} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-text-primary">
                    {dateFormatter.format(new Date(`${r.appointmentDate}T00:00:00`))}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.startTime.slice(0, 5)}</td>
                  <td className="px-4 py-2.5 text-text-primary">{r.professionalName}</td>
                  <td className="px-4 py-2.5 text-text-primary">{r.patientName}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.specialtyName ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { DAY_LABELS } from "@/modules/schedule/constants";
import {
  createScheduleException,
  createSlot,
  deleteScheduleException,
  deleteSlot,
  setSlotStatus,
} from "@/modules/schedule/services/schedule-actions";

interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: "active" | "inactive";
  capacity: number;
  insuranceNames: string[];
}

interface Insurance {
  id: string;
  name: string;
}

interface ScheduleException {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function ScheduleManager({
  professionalId,
  slots,
  insurances,
  exceptions,
}: {
  professionalId: string;
  slots: Slot[];
  insurances: Insurance[];
  exceptions: ScheduleException[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [capacity, setCapacity] = useState("1");
  const [selectedInsurances, setSelectedInsurances] = useState<string[]>([]);
  const [allInsurances, setAllInsurances] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockBusyId, setBlockBusyId] = useState<string | null>(null);

  function toggleInsurance(id: string) {
    setSelectedInsurances((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const result = await createSlot({
      professionalId,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      capacity: Number(capacity) || 1,
      insuranceIds: allInsurances ? [] : selectedInsurances,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSelectedInsurances([]);
    setAllInsurances(true);
    toast.success("Horário adicionado com sucesso.");
    router.refresh();
  }

  async function handleToggleStatus(slot: Slot) {
    setBusyId(slot.id);
    const result = await setSlotStatus(slot.id, slot.status === "active" ? "inactive" : "active");
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete(slot: Slot) {
    const confirmed = await confirm({
      title: "Excluir este horário?",
      description: `${slot.start_time.slice(0, 5)} às ${slot.end_time.slice(0, 5)} — essa ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;

    setBusyId(slot.id);
    const result = await deleteSlot(slot.id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Horário excluído com sucesso.");
    router.refresh();
  }

  async function handleCreateBlock(event: FormEvent) {
    event.preventDefault();
    setBlockError(null);

    if (!blockStart || !blockEnd) {
      setBlockError("Informe as duas datas.");
      return;
    }

    setBlockSaving(true);
    const result = await createScheduleException({
      professionalId,
      startDate: blockStart,
      endDate: blockEnd,
      reason: blockReason,
    });
    setBlockSaving(false);

    if (result.error) {
      setBlockError(result.error);
      return;
    }

    setBlockStart("");
    setBlockEnd("");
    setBlockReason("");
    toast.success("Bloqueio adicionado com sucesso.");
    router.refresh();
  }

  async function handleDeleteBlock(id: string) {
    setBlockBusyId(id);
    const result = await deleteScheduleException(id);
    setBlockBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Bloqueio removido com sucesso.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Form: Add Shift */}
      <form onSubmit={handleCreate} className="flex flex-col gap-3.5 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] font-heading">
          Novo Horário de Atendimento
        </span>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Dia da semana" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            {DAY_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </Select>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Início</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs text-text-primary transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Fim</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs text-text-primary transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Vagas simultâneas</label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs text-text-primary transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={allInsurances}
              onChange={(e) => setAllInsurances(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-primary"
            />
            Aceita todos os convênios neste horário
          </label>

          {!allInsurances && (
            <div className="flex flex-wrap gap-2.5 rounded-lg border border-border bg-card-elevated/40 p-3">
              {insurances.length === 0 && (
                <span className="text-xs text-text-muted">Nenhum convênio ativo cadastrado.</span>
              )}
              {insurances.map((insurance) => (
                <label key={insurance.id} className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary cursor-pointer hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={selectedInsurances.includes(insurance.id)}
                    onChange={() => toggleInsurance(insurance.id)}
                    className="h-3.5 w-3.5 rounded accent-primary"
                  />
                  {insurance.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}

        <Button type="submit" size="sm" isLoading={saving} className="w-fit h-9 px-4 text-xs font-bold shadow-button">
          + Adicionar Horário
        </Button>
      </form>

      {/* Slots Table */}
      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="border-b border-border/80 bg-card-elevated/70 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-4 py-2.5 font-bold">Dia</th>
              <th className="px-4 py-2.5 font-bold">Horário</th>
              <th className="px-4 py-2.5 font-bold">Convênios</th>
              <th className="px-4 py-2.5 font-bold">Vagas</th>
              <th className="px-4 py-2.5 font-bold">Status</th>
              <th className="px-4 py-2.5 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {slots.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-5 text-center text-text-muted text-xs">
                  Nenhum horário cadastrado.
                </td>
              </tr>
            )}
            {slots.map((slot) => (
              <tr key={slot.id} className="transition-colors hover:bg-card-elevated/40">
                <td className="px-4 py-3 font-bold text-text-primary">{DAY_LABELS[slot.day_of_week]}</td>
                <td className="px-4 py-3 font-semibold text-text-primary">
                  {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                </td>
                <td className="px-4 py-3">
                  {slot.insuranceNames.length === 0 ? (
                    <Badge tone="neutral" className="text-[10px]">Todos</Badge>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {slot.insuranceNames.map((name) => (
                        <Badge key={name} tone="neutral" className="text-[10px]">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-bold text-text-primary">{slot.capacity}</td>
                <td className="px-4 py-3">
                  <Badge tone={slot.status === "active" ? "success" : "neutral"} className="text-[10px]">
                    {slot.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px] px-2.5"
                      isLoading={busyId === slot.id}
                      onClick={() => handleToggleStatus(slot)}
                    >
                      {slot.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="h-7 text-[11px] px-2.5"
                      isLoading={busyId === slot.id}
                      onClick={() => handleDelete(slot)}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Block Exception Section */}
      <div className="flex flex-col gap-3 pt-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary font-heading">
            Bloqueios e Férias
          </h3>
          <p className="text-[11px] text-text-secondary">
            Desative temporariamente o atendimento em datas específicas.
          </p>
        </div>

        <form
          onSubmit={handleCreateBlock}
          className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-xs"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">De</label>
              <input
                type="date"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs text-text-primary transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Até</label>
              <input
                type="date"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs text-text-primary transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Motivo (opcional)</label>
              <input
                type="text"
                placeholder="Férias, congresso..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="h-9.5 rounded-lg border border-border bg-card-elevated px-3 text-xs text-text-primary placeholder:text-text-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </div>
          </div>

          {blockError && <p className="text-xs font-semibold text-danger">{blockError}</p>}

          <Button type="submit" size="sm" isLoading={blockSaving} className="w-fit h-9 px-4 text-xs font-bold shadow-button">
            Bloquear Período
          </Button>
        </form>

        {exceptions.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="border-b border-border/80 bg-card-elevated/70 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Período</th>
                  <th className="px-4 py-2.5 font-bold">Motivo</th>
                  <th className="px-4 py-2.5 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {exceptions.map((exception) => (
                  <tr key={exception.id} className="transition-colors hover:bg-card-elevated/40">
                    <td className="px-4 py-3 font-bold text-text-primary">
                      {dateFormatter.format(new Date(`${exception.start_date}T00:00:00`))} –{" "}
                      {dateFormatter.format(new Date(`${exception.end_date}T00:00:00`))}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{exception.reason || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="danger"
                        className="h-7 text-[11px] px-2.5"
                        isLoading={blockBusyId === exception.id}
                        onClick={() => handleDeleteBlock(exception.id)}
                      >
                        Remover
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

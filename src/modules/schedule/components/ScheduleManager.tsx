"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
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
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
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
    router.refresh();
  }

  async function handleToggleStatus(slot: Slot) {
    setBusyId(slot.id);
    const result = await setSlotStatus(slot.id, slot.status === "active" ? "inactive" : "active");
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete(slot: Slot) {
    const confirmed = window.confirm(
      `Excluir o horário de ${slot.start_time.slice(0, 5)} às ${slot.end_time.slice(0, 5)}?`,
    );
    if (!confirmed) return;

    setBusyId(slot.id);
    const result = await deleteSlot(slot.id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
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
    router.refresh();
  }

  async function handleDeleteBlock(id: string) {
    setBlockBusyId(id);
    const result = await deleteScheduleException(id);
    setBlockBusyId(null);
    if (result.error) {
      setBlockError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-text-primary">Novo horário</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Dia da semana" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            {DAY_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </Select>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">Início</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">Fim</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">Vagas simultâneas</label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={allInsurances}
              onChange={(e) => setAllInsurances(e.target.checked)}
            />
            Aceita todos os convênios
          </label>

          {!allInsurances && (
            <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-bg-soft p-3">
              {insurances.length === 0 && (
                <span className="text-xs text-text-secondary">Nenhum convênio ativo cadastrado.</span>
              )}
              {insurances.map((insurance) => (
                <label key={insurance.id} className="flex items-center gap-1.5 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={selectedInsurances.includes(insurance.id)}
                    onChange={() => toggleInsurance(insurance.id)}
                  />
                  {insurance.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={saving} className="w-fit">
          {saving ? "Adicionando..." : "Adicionar horário"}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Dia</th>
              <th className="px-4 py-3 font-medium">Horário</th>
              <th className="px-4 py-3 font-medium">Convênios</th>
              <th className="px-4 py-3 font-medium">Vagas</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slots.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  Nenhum horário cadastrado.
                </td>
              </tr>
            )}
            {slots.map((slot) => (
              <tr key={slot.id}>
                <td className="px-4 py-3 text-text-primary">{DAY_LABELS[slot.day_of_week]}</td>
                <td className="px-4 py-3 text-text-primary">
                  {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                </td>
                <td className="px-4 py-3">
                  {slot.insuranceNames.length === 0 ? (
                    <Badge tone="neutral">Todos</Badge>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {slot.insuranceNames.map((name) => (
                        <Badge key={name} tone="neutral">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-text-primary">{slot.capacity}</td>
                <td className="px-4 py-3">
                  <Badge tone={slot.status === "active" ? "success" : "neutral"}>
                    {slot.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === slot.id}
                      onClick={() => handleToggleStatus(slot)}
                    >
                      {slot.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId === slot.id}
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

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">Bloqueios e férias</p>
          <p className="text-xs text-text-secondary">
            Período em que você fica indisponível — some das datas de agendamento.
          </p>
        </div>

        <form
          onSubmit={handleCreateBlock}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">De</label>
              <input
                type="date"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Até</label>
              <input
                type="date"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Motivo (opcional)</label>
              <input
                type="text"
                placeholder="Férias, congresso..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
              />
            </div>
          </div>

          {blockError && <p className="text-sm text-danger">{blockError}</p>}

          <Button type="submit" disabled={blockSaving} className="w-fit">
            {blockSaving ? "Adicionando..." : "Bloquear período"}
          </Button>
        </form>

        {exceptions.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Período</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exceptions.map((exception) => (
                  <tr key={exception.id}>
                    <td className="px-4 py-3 text-text-primary">
                      {dateFormatter.format(new Date(`${exception.start_date}T00:00:00`))} –{" "}
                      {dateFormatter.format(new Date(`${exception.end_date}T00:00:00`))}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{exception.reason || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={blockBusyId === exception.id}
                          onClick={() => handleDeleteBlock(exception.id)}
                        >
                          Remover
                        </Button>
                      </div>
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

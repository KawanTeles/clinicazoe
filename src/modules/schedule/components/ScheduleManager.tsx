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
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-5 rounded-2xl border border-[#255044] bg-[#102A22] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
        <p className="text-base font-bold text-[#F5F7F6]">Novo horário de atendimento</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Dia da semana" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            {DAY_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </Select>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#C8D4CF]">Início</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-11 rounded-xl border border-[#255044] bg-[#17382D] px-4 text-sm text-[#F5F7F6] transition-all focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#C8D4CF]">Fim</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-11 rounded-xl border border-[#255044] bg-[#17382D] px-4 text-sm text-[#F5F7F6] transition-all focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#C8D4CF]">Vagas simultâneas</label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="h-11 rounded-xl border border-[#255044] bg-[#17382D] px-4 text-sm text-[#F5F7F6] transition-all focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-[#F5F7F6] cursor-pointer">
            <input
              type="checkbox"
              checked={allInsurances}
              onChange={(e) => setAllInsurances(e.target.checked)}
              className="h-4 w-4 rounded border-[#255044] bg-[#17382D] accent-[#2E8B57]"
            />
            Aceita todos os convênios
          </label>

          {!allInsurances && (
            <div className="flex flex-wrap gap-3 rounded-xl border border-[#255044] bg-[#17382D]/60 p-4">
              {insurances.length === 0 && (
                <span className="text-xs text-[#7A9187]">Nenhum convênio ativo cadastrado.</span>
              )}
              {insurances.map((insurance) => (
                <label key={insurance.id} className="flex items-center gap-2 text-sm text-[#C8D4CF] cursor-pointer hover:text-[#F5F7F6]">
                  <input
                    type="checkbox"
                    checked={selectedInsurances.includes(insurance.id)}
                    onChange={() => toggleInsurance(insurance.id)}
                    className="h-4 w-4 rounded border-[#255044] bg-[#17382D] accent-[#2E8B57]"
                  />
                  {insurance.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm font-medium text-[#FF8A8A]">{error}</p>}

        <Button type="submit" isLoading={saving} className="w-fit">
          Adicionar horário
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-[#255044] bg-[#102A22] shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-[#255044] bg-[#17382D]/80 text-xs font-bold uppercase tracking-wider text-[#C8D4CF]">
            <tr>
              <th className="px-5 py-4 font-bold">Dia</th>
              <th className="px-5 py-4 font-bold">Horário</th>
              <th className="px-5 py-4 font-bold">Convênios</th>
              <th className="px-5 py-4 font-bold">Vagas</th>
              <th className="px-5 py-4 font-bold">Status</th>
              <th className="px-5 py-4 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#255044]/40">
            {slots.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-[#7A9187]">
                  Nenhum horário cadastrado.
                </td>
              </tr>
            )}
            {slots.map((slot) => (
              <tr key={slot.id} className="transition-colors hover:bg-[#17382D]/50">
                <td className="px-5 py-4 font-semibold text-[#F5F7F6]">{DAY_LABELS[slot.day_of_week]}</td>
                <td className="px-5 py-4 font-semibold text-[#F5F7F6]">
                  {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                </td>
                <td className="px-5 py-4">
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
                <td className="px-5 py-4 font-semibold text-[#F5F7F6]">{slot.capacity}</td>
                <td className="px-5 py-4">
                  <Badge tone={slot.status === "active" ? "success" : "neutral"}>
                    {slot.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={busyId === slot.id}
                      onClick={() => handleToggleStatus(slot)}
                    >
                      {slot.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
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

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-base font-bold text-[#F5F7F6]">Bloqueios e férias</p>
          <p className="text-xs text-[#C8D4CF]">
            Período em que você fica indisponível — desabilita os horários em datas específicas.
          </p>
        </div>

        <form
          onSubmit={handleCreateBlock}
          className="flex flex-col gap-4 rounded-2xl border border-[#255044] bg-[#102A22] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#C8D4CF]">De</label>
              <input
                type="date"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="h-11 rounded-xl border border-[#255044] bg-[#17382D] px-4 text-sm text-[#F5F7F6] transition-all focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#C8D4CF]">Até</label>
              <input
                type="date"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="h-11 rounded-xl border border-[#255044] bg-[#17382D] px-4 text-sm text-[#F5F7F6] transition-all focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#C8D4CF]">Motivo (opcional)</label>
              <input
                type="text"
                placeholder="Férias, congresso..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="h-11 rounded-xl border border-[#255044] bg-[#17382D] px-4 text-sm text-[#F5F7F6] placeholder:text-[#7A9187] transition-all focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30"
              />
            </div>
          </div>

          {blockError && <p className="text-sm font-medium text-[#FF8A8A]">{blockError}</p>}

          <Button type="submit" isLoading={blockSaving} className="w-fit">
            Bloquear período
          </Button>
        </form>

        {exceptions.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-[#255044] bg-[#102A22] shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="border-b border-[#255044] bg-[#17382D]/80 text-xs font-bold uppercase tracking-wider text-[#C8D4CF]">
                <tr>
                  <th className="px-5 py-4 font-bold">Período</th>
                  <th className="px-5 py-4 font-bold">Motivo</th>
                  <th className="px-5 py-4 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#255044]/40">
                {exceptions.map((exception) => (
                  <tr key={exception.id} className="transition-colors hover:bg-[#17382D]/50">
                    <td className="px-5 py-4 font-semibold text-[#F5F7F6]">
                      {dateFormatter.format(new Date(`${exception.start_date}T00:00:00`))} –{" "}
                      {dateFormatter.format(new Date(`${exception.end_date}T00:00:00`))}
                    </td>
                    <td className="px-5 py-4 text-[#C8D4CF]">{exception.reason || "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="danger"
                          isLoading={blockBusyId === exception.id}
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


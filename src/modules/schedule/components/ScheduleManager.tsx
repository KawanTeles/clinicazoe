"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DAY_LABELS } from "@/modules/schedule/constants";
import {
  createSlot,
  deleteSlot,
  setSlotStatus,
} from "@/modules/schedule/services/schedule-actions";

interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: "active" | "inactive";
  insuranceNames: string[];
}

interface Insurance {
  id: string;
  name: string;
}

export function ScheduleManager({
  professionalId,
  slots,
  insurances,
}: {
  professionalId: string;
  slots: Slot[];
  insurances: Insurance[];
}) {
  const router = useRouter();

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [selectedInsurances, setSelectedInsurances] = useState<string[]>([]);
  const [allInsurances, setAllInsurances] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-text-primary">Novo horário</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slots.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-secondary">
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
                    <Badge tone="premium">Todos</Badge>
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
    </div>
  );
}

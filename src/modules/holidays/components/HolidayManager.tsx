"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { Database } from "@/lib/supabase/types";
import { createHoliday, deleteHoliday } from "@/modules/holidays/services/holiday-actions";

type Holiday = Database["public"]["Tables"]["clinic_holidays"]["Row"];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function HolidayManager({ holidays }: { holidays: Holiday[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!date) return;
    setError(null);
    setCreating(true);

    const result = await createHoliday({ date, description });
    setCreating(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setDate("");
    setDescription("");
    toast.success("Feriado adicionado com sucesso.");
    router.refresh();
  }

  async function handleDelete(holiday: Holiday) {
    const confirmed = await confirm({
      title: `Excluir feriado de ${dateFormatter.format(new Date(`${holiday.date}T00:00:00`))}?`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;

    setBusyId(holiday.id);
    const result = await deleteHoliday(holiday.id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Feriado excluído com sucesso.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div>
          <Input label="Data *" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 text-xs" />
        </div>
        <div className="w-full max-w-sm">
          <Input
            label="Descrição (opcional)"
            placeholder="Ex: Natal, Confraternização, Feriado Local..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-10 text-xs"
          />
        </div>
        <Button type="submit" isLoading={creating} className="h-10 text-xs font-bold px-5">
          + Adicionar Feriado
        </Button>
      </form>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      {holidays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-xs font-semibold text-text-secondary">
          Nenhum feriado cadastrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-5 py-3.5 font-bold">Data</th>
                <th className="px-5 py-3.5 font-bold">Descrição</th>
                <th className="px-5 py-3.5 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {holidays.map((holiday) => (
                <tr key={holiday.id} className="transition-colors hover:bg-card-elevated/40">
                  <td className="px-5 py-4 font-bold text-text-primary">
                    {dateFormatter.format(new Date(`${holiday.date}T00:00:00`))}
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{holiday.description || "—"}</td>
                  <td className="px-5 py-4 text-right">
                    <Button size="sm" variant="danger" className="h-8 text-xs px-3" isLoading={busyId === holiday.id} onClick={() => handleDelete(holiday)}>
                      Excluir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { Database } from "@/lib/supabase/types";
import {
  createInsurance,
  deleteInsurance,
  reorderInsurances,
  updateInsurance,
} from "@/modules/insurances/services/insurance-actions";

type Insurance = Database["public"]["Tables"]["insurances"]["Row"];

export function InsuranceManager({ insurances }: { insurances: Insurance[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= insurances.length || reordering) return;

    const reordered = [...insurances];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    setReordering(true);
    const result = await reorderInsurances(reordered.map((insurance) => insurance.id));
    setReordering(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    setCreating(true);

    const result = await createInsurance(newName);
    setCreating(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNewName("");
    toast.success("Convênio adicionado com sucesso.");
    router.refresh();
  }

  async function handleToggleStatus(insurance: Insurance) {
    setBusyId(insurance.id);
    setError(null);
    const result = await updateInsurance(insurance.id, {
      status: insurance.status === "active" ? "inactive" : "active",
    });
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleSaveName(id: string) {
    setBusyId(id);
    setError(null);
    const result = await updateInsurance(id, { name: editingName });
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setEditingId(null);
    toast.success("Convênio atualizado com sucesso.");
    router.refresh();
  }

  async function handleDelete(insurance: Insurance) {
    const confirmed = await confirm({
      title: `Excluir "${insurance.name}"?`,
      description: "Essa ação é permanente e não pode ser desfeita.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;

    setBusyId(insurance.id);
    const result = await deleteInsurance(insurance.id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Convênio excluído com sucesso.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border/80 bg-card p-3 shadow-xs">
        <div className="flex-1 min-w-[240px]">
          <Input
            label="Novo Convênio"
            name="new_insurance"
            placeholder="Ex: Unimed, Bradesco Saúde, Cassi..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" isLoading={creating} className="h-9 text-xs font-bold px-4">
          + Adicionar Convênio
        </Button>
      </form>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
        <table className="w-full min-w-[500px] text-left text-xs">
          <thead className="border-b border-border/80 bg-card-elevated/70 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-4 py-2.5 font-bold">Ordem</th>
              <th className="px-4 py-2.5 font-bold">Nome do Convênio</th>
              <th className="px-4 py-2.5 font-bold">Status</th>
              <th className="px-4 py-2.5 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {insurances.map((insurance, index) => (
              <tr key={insurance.id} className="transition-colors hover:bg-card-elevated/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={index === 0 || reordering}
                      onClick={() => handleMove(index, -1)}
                      aria-label={`Mover ${insurance.name} para cima`}
                    >
                      ▲
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={index === insurances.length - 1 || reordering}
                      onClick={() => handleMove(index, 1)}
                      aria-label={`Mover ${insurance.name} para baixo`}
                    >
                      ▼
                    </Button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingId === insurance.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 rounded-md border border-border bg-card-elevated px-2.5 text-xs text-text-primary focus:border-primary focus:outline-none"
                      />
                      <Button
                        size="sm"
                        isLoading={busyId === insurance.id}
                        onClick={() => handleSaveName(insurance.id)}
                        className="h-7 text-[11px] px-2.5"
                      >
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-[11px] px-2.5">
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <span className="font-bold text-text-primary">{insurance.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={insurance.status === "active" ? "success" : "neutral"} className="text-[10px]">
                    {insurance.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {editingId !== insurance.id && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[11px] px-2.5"
                        onClick={() => {
                          setEditingId(insurance.id);
                          setEditingName(insurance.name);
                        }}
                      >
                        Editar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px] px-2.5"
                      isLoading={busyId === insurance.id}
                      onClick={() => handleToggleStatus(insurance)}
                    >
                      {insurance.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="h-7 text-[11px] px-2.5"
                      isLoading={busyId === insurance.id}
                      onClick={() => handleDelete(insurance)}
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

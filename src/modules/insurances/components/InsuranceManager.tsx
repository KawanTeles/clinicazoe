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
    <div className="flex flex-col gap-5">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="w-full max-w-sm">
          <Input
            label="Novo Convênio"
            name="new_insurance"
            placeholder="Ex: Unimed, Bradesco Saúde, Cassi..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-10 text-xs"
          />
        </div>
        <Button type="submit" isLoading={creating} className="h-10 text-xs font-bold px-5">
          + Adicionar Convênio
        </Button>
      </form>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[540px] text-left text-sm">
          <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-5 py-3.5 font-bold">Nome do Convênio</th>
              <th className="px-5 py-3.5 font-bold">Status</th>
              <th className="px-5 py-3.5 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {insurances.map((insurance) => (
              <tr key={insurance.id} className="transition-colors hover:bg-card-elevated/40">
                <td className="px-5 py-4">
                  {editingId === insurance.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-9 rounded-xl border border-border bg-card-elevated px-3 text-xs text-text-primary focus:border-primary focus:outline-none"
                      />
                      <Button
                        size="sm"
                        isLoading={busyId === insurance.id}
                        onClick={() => handleSaveName(insurance.id)}
                        className="h-8 text-xs px-3"
                      >
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 text-xs px-3">
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <span className="font-bold text-text-primary">{insurance.name}</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <Badge tone={insurance.status === "active" ? "success" : "neutral"} className="text-[10px]">
                    {insurance.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1.5">
                    {editingId !== insurance.id && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs px-3"
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
                      className="h-8 text-xs px-3"
                      isLoading={busyId === insurance.id}
                      onClick={() => handleToggleStatus(insurance)}
                    >
                      {insurance.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="h-8 text-xs px-3"
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

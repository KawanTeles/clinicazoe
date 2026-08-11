"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { Database, FinancialCategoryKind } from "@/lib/supabase/types";
import { createFinancialCategory, updateFinancialCategory } from "@/modules/financial/services/financial-category-actions";

type FinancialCategory = Database["public"]["Tables"]["financial_categories"]["Row"];

/** Sem botão de excluir de propósito — categoria financeira nunca é
 * apagada, só desativada (0044), mesmo princípio de patient_evolutions e
 * financial_entries: histórico financeiro nunca se perde, mesmo indireto
 * (lançamentos antigos continuam referenciando a categoria mesmo inativa). */
export function FinancialCategoryManager({ categories }: { categories: FinancialCategory[] }) {
  const router = useRouter();
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<FinancialCategoryKind>("despesa");
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

    const result = await createFinancialCategory(newName, newKind);
    setCreating(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNewName("");
    toast.success("Categoria adicionada com sucesso.");
    router.refresh();
  }

  async function handleToggleStatus(category: FinancialCategory) {
    setBusyId(category.id);
    setError(null);
    const result = await updateFinancialCategory(category.id, {
      status: category.status === "active" ? "inactive" : "active",
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
    const result = await updateFinancialCategory(id, { name: editingName });
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setEditingId(null);
    toast.success("Categoria atualizada com sucesso.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border/80 bg-card p-3 shadow-xs">
        <div className="flex-1 min-w-[240px]">
          <Input
            label="Nova Categoria"
            name="new_category"
            placeholder="Ex: Aluguel, Material de consumo, Reembolso..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            label="Direção"
            name="new_category_kind"
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as FinancialCategoryKind)}
          >
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </Select>
        </div>
        <Button type="submit" size="sm" isLoading={creating} className="h-9 text-xs font-bold px-4">
          + Adicionar Categoria
        </Button>
      </form>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="border-b border-border/80 bg-card-elevated/70 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-4 py-2.5 font-bold">Nome</th>
              <th className="px-4 py-2.5 font-bold">Direção</th>
              <th className="px-4 py-2.5 font-bold">Status</th>
              <th className="px-4 py-2.5 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {categories.map((category) => (
              <tr key={category.id} className="transition-colors hover:bg-card-elevated/40">
                <td className="px-4 py-3">
                  {editingId === category.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 rounded-md border border-border bg-card-elevated px-2.5 text-xs text-text-primary focus:border-primary focus:outline-none"
                      />
                      <Button
                        size="sm"
                        isLoading={busyId === category.id}
                        onClick={() => handleSaveName(category.id)}
                        className="h-7 text-[11px] px-2.5"
                      >
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-[11px] px-2.5">
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <span className="font-bold text-text-primary">{category.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={category.kind === "receita" ? "success" : "warning"} className="text-[10px]">
                    {category.kind === "receita" ? "Receita" : "Despesa"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={category.status === "active" ? "success" : "neutral"} className="text-[10px]">
                    {category.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {editingId !== category.id && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[11px] px-2.5"
                        onClick={() => {
                          setEditingId(category.id);
                          setEditingName(category.name);
                        }}
                      >
                        Editar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px] px-2.5"
                      isLoading={busyId === category.id}
                      onClick={() => handleToggleStatus(category)}
                    >
                      {category.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                  Nenhuma categoria cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

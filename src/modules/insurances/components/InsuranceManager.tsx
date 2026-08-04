"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Database } from "@/lib/supabase/types";
import {
  createInsurance,
  deleteInsurance,
  updateInsurance,
} from "@/modules/insurances/services/insurance-actions";

type Insurance = Database["public"]["Tables"]["insurances"]["Row"];

export function InsuranceManager({ insurances }: { insurances: Insurance[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);

    const result = await createInsurance(newName);
    setCreating(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNewName("");
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
      setError(result.error);
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
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(insurance: Insurance) {
    const confirmed = window.confirm(`Excluir o convênio "${insurance.name}"?`);
    if (!confirmed) return;

    setBusyId(insurance.id);
    setError(null);
    const result = await deleteInsurance(insurance.id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Input
            label="Novo convênio"
            name="new_insurance"
            placeholder="Ex: Unimed, Postal Saúde..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={creating}>
          {creating ? "Adicionando..." : "Adicionar"}
        </Button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {insurances.map((insurance) => (
              <tr key={insurance.id}>
                <td className="px-4 py-3">
                  {editingId === insurance.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-9 rounded-lg border border-border bg-white px-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
                      />
                      <Button
                        size="sm"
                        disabled={busyId === insurance.id}
                        onClick={() => handleSaveName(insurance.id)}
                      >
                        Salvar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <span className="font-medium text-text-primary">{insurance.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={insurance.status === "active" ? "success" : "neutral"}>
                    {insurance.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {editingId !== insurance.id && (
                      <Button
                        size="sm"
                        variant="secondary"
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
                      disabled={busyId === insurance.id}
                      onClick={() => handleToggleStatus(insurance)}
                    >
                      {insurance.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId === insurance.id}
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

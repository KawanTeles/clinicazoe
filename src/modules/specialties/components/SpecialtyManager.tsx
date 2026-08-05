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
  createSpecialty,
  deleteSpecialty,
  updateSpecialty,
} from "@/modules/specialties/services/specialty-actions";

type Specialty = Database["public"]["Tables"]["specialties"]["Row"];

export function SpecialtyManager({ specialties }: { specialties: Specialty[] }) {
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

    const result = await createSpecialty(newName);
    setCreating(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNewName("");
    toast.success("Especialidade adicionada com sucesso.");
    router.refresh();
  }

  async function handleToggleStatus(specialty: Specialty) {
    setBusyId(specialty.id);
    setError(null);
    const result = await updateSpecialty(specialty.id, {
      status: specialty.status === "active" ? "inactive" : "active",
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
    const result = await updateSpecialty(id, { name: editingName });
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setEditingId(null);
    toast.success("Especialidade atualizada com sucesso.");
    router.refresh();
  }

  async function handleDelete(specialty: Specialty) {
    const confirmed = await confirm({
      title: `Excluir "${specialty.name}"?`,
      description: "Essa ação é permanente e não pode ser desfeita.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;

    setBusyId(specialty.id);
    const result = await deleteSpecialty(specialty.id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Especialidade excluída com sucesso.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border/80 bg-card p-3 shadow-xs">
        <div className="flex-1 min-w-[240px]">
          <Input
            label="Nova Especialidade"
            name="new_specialty"
            placeholder="Ex: Cardiologia, Dermatologia, Ortopedia..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" isLoading={creating} className="h-9 text-xs font-bold px-4">
          + Adicionar Especialidade
        </Button>
      </form>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
        <table className="w-full min-w-[500px] text-left text-xs">
          <thead className="border-b border-border/80 bg-card-elevated/70 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-4 py-2.5 font-bold">Nome da Especialidade</th>
              <th className="px-4 py-2.5 font-bold">Status</th>
              <th className="px-4 py-2.5 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {specialties.map((specialty) => (
              <tr key={specialty.id} className="transition-colors hover:bg-card-elevated/40">
                <td className="px-4 py-3">
                  {editingId === specialty.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 rounded-md border border-border bg-card-elevated px-2.5 text-xs text-text-primary focus:border-primary focus:outline-none"
                      />
                      <Button
                        size="sm"
                        isLoading={busyId === specialty.id}
                        onClick={() => handleSaveName(specialty.id)}
                        className="h-7 text-[11px] px-2.5"
                      >
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-[11px] px-2.5">
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <span className="font-bold text-text-primary">{specialty.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={specialty.status === "active" ? "success" : "neutral"} className="text-[10px]">
                    {specialty.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {editingId !== specialty.id && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[11px] px-2.5"
                        onClick={() => {
                          setEditingId(specialty.id);
                          setEditingName(specialty.name);
                        }}
                      >
                        Editar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px] px-2.5"
                      isLoading={busyId === specialty.id}
                      onClick={() => handleToggleStatus(specialty)}
                    >
                      {specialty.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="h-7 text-[11px] px-2.5"
                      isLoading={busyId === specialty.id}
                      onClick={() => handleDelete(specialty)}
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

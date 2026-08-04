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
    <div className="flex flex-col gap-5">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Input
            label="Nova especialidade"
            name="new_specialty"
            placeholder="Ex: Cardiologia, Ortopedia..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button type="submit" isLoading={creating}>
          Adicionar
        </Button>
      </form>

      {error && <p className="text-sm font-medium text-[#FF8A8A]">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-[#255044] bg-[#102A22] shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-[#255044] bg-[#17382D]/80 text-xs font-bold uppercase tracking-wider text-[#C8D4CF]">
            <tr>
              <th className="px-5 py-4 font-bold">Nome</th>
              <th className="px-5 py-4 font-bold">Status</th>
              <th className="px-5 py-4 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#255044]/40">
            {specialties.map((specialty) => (
              <tr key={specialty.id} className="transition-colors hover:bg-[#17382D]/50">
                <td className="px-5 py-4">
                  {editingId === specialty.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-10 rounded-xl border border-[#255044] bg-[#17382D] px-3 text-sm text-[#F5F7F6] transition-all focus:border-[#2E8B57] focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30"
                      />
                      <Button
                        size="sm"
                        isLoading={busyId === specialty.id}
                        onClick={() => handleSaveName(specialty.id)}
                      >
                        Salvar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <span className="font-semibold text-[#F5F7F6]">{specialty.name}</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <Badge tone={specialty.status === "active" ? "success" : "neutral"}>
                    {specialty.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    {editingId !== specialty.id && (
                      <Button
                        size="sm"
                        variant="secondary"
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
                      isLoading={busyId === specialty.id}
                      onClick={() => handleToggleStatus(specialty)}
                    >
                      {specialty.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
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


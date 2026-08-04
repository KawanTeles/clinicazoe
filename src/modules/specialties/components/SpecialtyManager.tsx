"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Database } from "@/lib/supabase/types";
import {
  createSpecialty,
  deleteSpecialty,
  updateSpecialty,
} from "@/modules/specialties/services/specialty-actions";

type Specialty = Database["public"]["Tables"]["specialties"]["Row"];

export function SpecialtyManager({ specialties }: { specialties: Specialty[] }) {
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

    const result = await createSpecialty(newName);
    setCreating(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNewName("");
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
      setError(result.error);
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
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(specialty: Specialty) {
    const confirmed = window.confirm(`Excluir a especialidade "${specialty.name}"?`);
    if (!confirmed) return;

    setBusyId(specialty.id);
    setError(null);
    const result = await deleteSpecialty(specialty.id);
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
            label="Nova especialidade"
            name="new_specialty"
            placeholder="Ex: Cardiologia, Ortopedia..."
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
            {specialties.map((specialty) => (
              <tr key={specialty.id}>
                <td className="px-4 py-3">
                  {editingId === specialty.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-9 rounded-lg border border-border bg-white px-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-accent"
                      />
                      <Button
                        size="sm"
                        disabled={busyId === specialty.id}
                        onClick={() => handleSaveName(specialty.id)}
                      >
                        Salvar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <span className="font-medium text-text-primary">{specialty.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={specialty.status === "active" ? "success" : "neutral"}>
                    {specialty.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
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
                      disabled={busyId === specialty.id}
                      onClick={() => handleToggleStatus(specialty)}
                    >
                      {specialty.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId === specialty.id}
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

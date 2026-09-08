"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  reorderHomeFeaturedProfessionals,
  setProfessionalHomeFeatured,
} from "@/modules/professionals/services/professional-home-feature-actions";

export interface HomeFeatureProfessional {
  id: string;
  fullName: string;
  specialtyName: string | null;
  homeDisplayOrder: number | null;
}

export function HomeFeaturedProfessionalsManager({ professionals }: { professionals: HomeFeatureProfessional[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState("");

  const featured = professionals
    .filter((p) => p.homeDisplayOrder != null)
    .sort((a, b) => (a.homeDisplayOrder as number) - (b.homeDisplayOrder as number));
  const available = professionals.filter((p) => p.homeDisplayOrder == null);

  async function handleAdd() {
    if (!selectedToAdd) return;
    setBusyId(selectedToAdd);
    const result = await setProfessionalHomeFeatured(selectedToAdd, true);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSelectedToAdd("");
    toast.success("Profissional adicionado aos destaques da home.");
    router.refresh();
  }

  async function handleRemove(professional: HomeFeatureProfessional) {
    setBusyId(professional.id);
    const result = await setProfessionalHomeFeatured(professional.id, false);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Profissional removido dos destaques da home.");
    router.refresh();
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= featured.length || reordering) return;

    const reordered = [...featured];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    setReordering(true);
    const result = await reorderHomeFeaturedProfessionals(reordered.map((p) => p.id));
    setReordering(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border/80 bg-card p-3 shadow-xs">
        <div className="flex-1 min-w-[240px]">
          <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1 block">
            Adicionar aos destaques
          </label>
          <select
            value={selectedToAdd}
            onChange={(e) => setSelectedToAdd(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-card-elevated px-2.5 text-xs text-text-primary focus:border-primary focus:outline-none"
          >
            <option value="">Selecione um profissional...</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {p.specialtyName ? ` — ${p.specialtyName}` : ""}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          className="h-9 text-xs font-bold px-4"
          disabled={!selectedToAdd}
          isLoading={busyId !== null && busyId === selectedToAdd}
          onClick={handleAdd}
        >
          + Adicionar
        </Button>
      </div>

      {featured.length === 0 ? (
        <p className="text-xs text-text-secondary py-6 text-center rounded-xl border border-dashed border-border/80">
          Nenhum profissional em destaque ainda. Enquanto isso, a home mostra automaticamente os primeiros profissionais por ordem alfabética.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="border-b border-border/80 bg-card-elevated/70 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-2.5 font-bold">Ordem</th>
                <th className="px-4 py-2.5 font-bold">Profissional</th>
                <th className="px-4 py-2.5 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {featured.map((prof, index) => (
                <tr key={prof.id} className="transition-colors hover:bg-card-elevated/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={index === 0 || reordering}
                        onClick={() => handleMove(index, -1)}
                        aria-label={`Mover ${prof.fullName} para cima`}
                      >
                        ▲
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={index === featured.length - 1 || reordering}
                        onClick={() => handleMove(index, 1)}
                        aria-label={`Mover ${prof.fullName} para baixo`}
                      >
                        ▼
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-text-primary">{prof.fullName}</span>
                    {prof.specialtyName && <span className="block text-[11px] text-text-muted">{prof.specialtyName}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      className="h-7 text-[11px] px-2.5"
                      isLoading={busyId === prof.id}
                      onClick={() => handleRemove(prof)}
                    >
                      Remover
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

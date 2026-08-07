"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { MODALITY_LABELS } from "@/lib/constants";
import type { WaitlistListItem } from "@/modules/waitlist/services/waitlist-queries";
import type { WaitlistStatus } from "@/lib/supabase/types";
import { WaitlistDetailModal } from "./WaitlistDetailModal";

interface Option {
  id: string;
  name: string;
}

interface Filters {
  specialty: string;
  professional: string;
  insurance: string;
  status: string;
  date: string;
  q: string;
}

interface WaitlistTableProps {
  entries: WaitlistListItem[];
  page: number;
  totalPages: number;
  statusCounts: Record<WaitlistStatus, number>;
  specialties: Option[];
  professionals: Option[];
  insurances: Option[];
  filters: Filters;
  canManage: boolean;
}

export const STATUS_LABELS: Record<WaitlistStatus, string> = {
  aguardando: "Aguardando",
  contato_realizado: "Contato realizado",
  vaga_oferecida: "Vaga oferecida",
  agendado: "Agendado",
  cancelado: "Cancelado",
  sem_interesse: "Não teve interesse",
};

export const STATUS_TONES: Record<WaitlistStatus, "neutral" | "success" | "warning" | "danger" | "premium"> = {
  aguardando: "warning",
  contato_realizado: "neutral",
  vaga_oferecida: "premium",
  agendado: "success",
  cancelado: "danger",
  sem_interesse: "neutral",
};

const STATUS_ORDER: WaitlistStatus[] = [
  "aguardando",
  "contato_realizado",
  "vaga_oferecida",
  "agendado",
  "cancelado",
  "sem_interesse",
];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function WaitlistTable({
  entries,
  page,
  totalPages,
  statusCounts,
  specialties,
  professionals,
  insurances,
  filters,
  canManage,
}: WaitlistTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function applyFilters(next: Partial<Filters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.specialty) params.set("specialty", merged.specialty);
    if (merged.professional) params.set("professional", merged.professional);
    if (merged.insurance) params.set("insurance", merged.insurance);
    if (merged.status) params.set("status", merged.status);
    if (merged.date) params.set("date", merged.date);
    if (merged.q) params.set("q", merged.q);
    params.set("page", "1");
    router.push(`/waitlist?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search === filters.q) return;
    debounceRef.current = setTimeout(() => applyFilters({ q: search }), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => applyFilters({ status: filters.status === s ? "" : s })}
            className={`rounded-2xl border p-3.5 text-left transition-all ${
              filters.status === s
                ? "border-primary bg-[var(--badge-bg)]"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{STATUS_LABELS[s]}</p>
            <p className="mt-1 text-xl font-extrabold text-text-primary font-heading">{statusCounts[s]}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Pesquisar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40">
            <Select value={filters.specialty} onChange={(e) => applyFilters({ specialty: e.target.value })} className="h-10 text-xs py-0">
              <option value="">Especialidade</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={filters.professional} onChange={(e) => applyFilters({ professional: e.target.value })} className="h-10 text-xs py-0">
              <option value="">Profissional</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={filters.insurance} onChange={(e) => applyFilters({ insurance: e.target.value })} className="h-10 text-xs py-0">
              <option value="">Convênio</option>
              {insurances.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </Select>
          </div>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => applyFilters({ date: e.target.value })}
            className="h-10 rounded-lg border border-border bg-card-elevated px-3 text-xs font-medium text-text-primary transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
          Nenhum registro encontrado com esses filtros.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-5 py-3.5 font-bold">Nome</th>
                <th className="px-5 py-3.5 font-bold">Especialidade</th>
                <th className="px-5 py-3.5 font-bold">Profissional</th>
                <th className="px-5 py-3.5 font-bold">Convênio</th>
                <th className="px-5 py-3.5 font-bold">Modalidade</th>
                <th className="px-5 py-3.5 font-bold">Solicitado em</th>
                <th className="px-5 py-3.5 font-bold">Telefone</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  className="cursor-pointer transition-colors hover:bg-card-elevated/40"
                >
                  <td className="px-5 py-4 font-bold text-text-primary">{entry.patientName}</td>
                  <td className="px-5 py-4 text-text-secondary">{entry.specialtyName || "—"}</td>
                  <td className="px-5 py-4 text-text-secondary">{entry.professionalName || "Sem preferência"}</td>
                  <td className="px-5 py-4 text-text-secondary">{entry.insuranceName || "—"}</td>
                  <td className="px-5 py-4 text-text-secondary">{entry.modality ? MODALITY_LABELS[entry.modality] : "—"}</td>
                  <td className="px-5 py-4 text-text-secondary">{dateFormatter.format(new Date(entry.createdAt))}</td>
                  <td className="px-5 py-4 text-text-secondary">{entry.patientPhone}</td>
                  <td className="px-5 py-4">
                    <Badge tone={STATUS_TONES[entry.status]} className="text-[10px]">
                      {STATUS_LABELS[entry.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/waitlist"
        searchParams={{
          specialty: filters.specialty,
          professional: filters.professional,
          insurance: filters.insurance,
          status: filters.status,
          date: filters.date,
          q: filters.q,
        }}
      />

      {selectedEntry && (
        <WaitlistDetailModal entry={selectedEntry} onClose={() => setSelectedId(null)} canManage={canManage} />
      )}
    </div>
  );
}

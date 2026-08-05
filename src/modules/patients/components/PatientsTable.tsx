"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import type { PatientListItem } from "@/modules/patients/services/patient-queries";

interface Option {
  id: string;
  name: string;
}

interface PatientsTableProps {
  patients: PatientListItem[];
  page: number;
  totalPages: number;
  insurances: Option[];
  filters: { q: string; insurance: string; status: string };
}

export function PatientsTable({ patients, page, totalPages, insurances, filters }: PatientsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function applyFilters(next: Partial<{ q: string; insurance: string; status: string }>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.insurance) params.set("insurance", merged.insurance);
    if (merged.status) params.set("status", merged.status);
    params.set("page", "1");
    router.push(`/patients?${params.toString()}`);
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

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Filter Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Pesquisar por nome, telefone ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 text-xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-44">
            <Select
              value={filters.insurance}
              onChange={(e) => applyFilters({ insurance: e.target.value })}
              className="h-10 text-xs py-0"
            >
              <option value="">Todos os Convênios</option>
              {insurances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-36">
            <Select
              value={filters.status}
              onChange={(e) => applyFilters({ status: e.target.value })}
              className="h-10 text-xs py-0"
            >
              <option value="">Todos os Status</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </Select>
          </div>
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
          Nenhum paciente encontrado com esses parâmetros.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-5 py-3.5 font-bold">Paciente</th>
                <th className="px-5 py-3.5 font-bold">Telefone</th>
                <th className="px-5 py-3.5 font-bold">CPF</th>
                <th className="px-5 py-3.5 font-bold">Cidade</th>
                <th className="px-5 py-3.5 font-bold">Convênio</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {patients.map((patient) => (
                <tr key={patient.id} className="transition-colors hover:bg-card-elevated/40">
                  <td className="px-5 py-4 font-bold text-text-primary">{patient.fullName}</td>
                  <td className="px-5 py-4 text-text-secondary">{patient.phone || "—"}</td>
                  <td className="px-5 py-4 text-text-secondary font-mono text-xs">{patient.cpf || "—"}</td>
                  <td className="px-5 py-4 text-text-secondary">{patient.city || "—"}</td>
                  <td className="px-5 py-4 text-text-secondary">{patient.preferredInsuranceName || "Particular"}</td>
                  <td className="px-5 py-4">
                    <Badge tone={patient.status === "active" ? "success" : "neutral"} className="text-[10px]">
                      {patient.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/patients/${patient.id}`}>
                      <Button size="sm" variant="secondary" className="h-8 text-xs px-3">
                        Ver Detalhes
                      </Button>
                    </Link>
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
        basePath="/patients"
        searchParams={{ q: filters.q, insurance: filters.insurance, status: filters.status }}
      />
    </div>
  );
}

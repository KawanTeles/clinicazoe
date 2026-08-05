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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Buscar"
          placeholder="Nome, telefone ou CPF"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Convênio"
          value={filters.insurance}
          onChange={(e) => applyFilters({ insurance: e.target.value })}
        >
          <option value="">Todos</option>
          {insurances.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <Select label="Status" value={filters.status} onChange={(e) => applyFilters({ status: e.target.value })}>
          <option value="">Todos</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </Select>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm font-medium text-text-secondary">
          Nenhum paciente encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-card-elevated/80 text-xs font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-5 py-4 font-bold">Nome</th>
                <th className="px-5 py-4 font-bold">Telefone</th>
                <th className="px-5 py-4 font-bold">CPF</th>
                <th className="px-5 py-4 font-bold">Cidade</th>
                <th className="px-5 py-4 font-bold">Convênio</th>
                <th className="px-5 py-4 font-bold">Status</th>
                <th className="px-5 py-4 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {patients.map((patient) => (
                <tr key={patient.id} className="transition-colors hover:bg-surface/50">
                  <td className="px-5 py-4 font-semibold text-text-primary">{patient.fullName}</td>
                  <td className="px-5 py-4 text-text-secondary">{patient.phone || "—"}</td>
                  <td className="px-5 py-4 text-text-secondary">{patient.cpf || "—"}</td>
                  <td className="px-5 py-4 text-text-secondary">{patient.city || "—"}</td>
                  <td className="px-5 py-4 text-text-secondary">{patient.preferredInsuranceName || "—"}</td>
                  <td className="px-5 py-4">
                    <Badge tone={patient.status === "active" ? "success" : "neutral"}>
                      {patient.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/patients/${patient.id}`}>
                      <Button size="sm" variant="secondary">
                        Ver
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

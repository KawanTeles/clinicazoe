"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/whatsapp";
import type { FinancialEntryView } from "@/modules/financial/services/financial-queries";
import { markAsPaid } from "@/modules/financial/services/financial-actions";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function FinancialTable({ entries }: { entries: FinancialEntryView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        search === "" ||
        entry.patientName.toLowerCase().includes(search.toLowerCase()) ||
        entry.professionalName.toLowerCase().includes(search.toLowerCase()) ||
        entry.insuranceName.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "todos" || entry.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [entries, search, statusFilter]);

  async function handleMarkAsPaid(id: string) {
    setBusyId(id);
    const result = await markAsPaid(id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Lançamento marcado como pago.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Search & Filter Header Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center justify-between rounded-xl border border-border/80 bg-card p-3 shadow-xs">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Pesquisar lançamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-1 text-xs">
          {[
            { id: "todos", label: "Todos" },
            { id: "em_aberto", label: "Em Aberto" },
            { id: "pago", label: "Pagos" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                statusFilter === tab.id
                  ? "bg-primary text-white shadow-xs font-bold"
                  : "bg-card-elevated/40 text-text-secondary hover:text-text-primary hover:bg-card-elevated"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-xs font-medium text-text-secondary">
          Nenhum lançamento financeiro encontrado com estes filtros.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-border/80 bg-card-elevated/70 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-2.5 font-bold">Paciente</th>
                <th className="px-4 py-2.5 font-bold">Profissional</th>
                <th className="px-4 py-2.5 font-bold">Convênio</th>
                <th className="px-4 py-2.5 font-bold">Vencimento</th>
                <th className="px-4 py-2.5 font-bold">Valor</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
                <th className="px-4 py-2.5 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-card-elevated/40">
                  <td className="px-4 py-3 font-bold text-text-primary">{entry.patientName}</td>
                  <td className="px-4 py-3 font-semibold text-text-primary">{entry.professionalName}</td>
                  <td className="px-4 py-3 text-text-secondary">{entry.insuranceName}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {dateFormatter.format(new Date(`${entry.dueDate}T00:00:00`))}
                  </td>
                  <td className="px-4 py-3 font-bold text-text-primary">{formatCurrency(entry.value)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={entry.status === "pago" ? "success" : "warning"} className="text-[10px]">
                      {entry.status === "pago" ? "Pago" : "Em aberto"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entry.status === "em_aberto" && (
                      <Button
                        size="sm"
                        isLoading={busyId === entry.id}
                        onClick={() => handleMarkAsPaid(entry.id)}
                        className="h-7 text-[11px] px-2.5 font-semibold"
                      >
                        Marcar como pago
                      </Button>
                    )}
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

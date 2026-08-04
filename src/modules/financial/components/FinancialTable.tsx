"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/whatsapp";
import type { FinancialEntryView } from "@/modules/financial/services/financial-queries";
import { markAsPaid } from "@/modules/financial/services/financial-actions";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function FinancialTable({ entries }: { entries: FinancialEntryView[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkAsPaid(id: string) {
    setBusyId(id);
    setError(null);
    const result = await markAsPaid(id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-text-secondary">
        Nenhum lançamento financeiro ainda.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Profissional</th>
              <th className="px-4 py-3 font-medium">Convênio</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-text-primary">{entry.patientName}</td>
                <td className="px-4 py-3 text-text-primary">{entry.professionalName}</td>
                <td className="px-4 py-3 text-text-secondary">{entry.insuranceName}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {dateFormatter.format(new Date(`${entry.dueDate}T00:00:00`))}
                </td>
                <td className="px-4 py-3 text-text-secondary">{formatCurrency(entry.value)}</td>
                <td className="px-4 py-3">
                  <Badge tone={entry.status === "pago" ? "success" : "warning"}>
                    {entry.status === "pago" ? "Pago" : "Em aberto"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {entry.status === "em_aberto" && (
                    <Button
                      size="sm"
                      disabled={busyId === entry.id}
                      onClick={() => handleMarkAsPaid(entry.id)}
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
    </div>
  );
}

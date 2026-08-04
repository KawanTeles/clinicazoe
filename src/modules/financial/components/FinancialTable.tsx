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
      <div className="rounded-2xl border border-dashed border-[#255044] bg-[#102A22] p-12 text-center text-sm font-medium text-[#C8D4CF]">
        Nenhum lançamento financeiro ainda.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm font-medium text-[#FF8A8A]">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-[#255044] bg-[#102A22] shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[#255044] bg-[#17382D]/80 text-xs font-bold uppercase tracking-wider text-[#C8D4CF]">
            <tr>
              <th className="px-5 py-4 font-bold">Paciente</th>
              <th className="px-5 py-4 font-bold">Profissional</th>
              <th className="px-5 py-4 font-bold">Convênio</th>
              <th className="px-5 py-4 font-bold">Vencimento</th>
              <th className="px-5 py-4 font-bold">Valor</th>
              <th className="px-5 py-4 font-bold">Status</th>
              <th className="px-5 py-4 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#255044]/40">
            {entries.map((entry) => (
              <tr key={entry.id} className="transition-colors hover:bg-[#17382D]/50">
                <td className="px-5 py-4 font-semibold text-[#F5F7F6]">{entry.patientName}</td>
                <td className="px-5 py-4 font-semibold text-[#F5F7F6]">{entry.professionalName}</td>
                <td className="px-5 py-4 text-[#C8D4CF]">{entry.insuranceName}</td>
                <td className="px-5 py-4 text-[#C8D4CF]">
                  {dateFormatter.format(new Date(`${entry.dueDate}T00:00:00`))}
                </td>
                <td className="px-5 py-4 font-semibold text-[#F5F7F6]">{formatCurrency(entry.value)}</td>
                <td className="px-5 py-4">
                  <Badge tone={entry.status === "pago" ? "success" : "warning"}>
                    {entry.status === "pago" ? "Pago" : "Em aberto"}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-right">
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


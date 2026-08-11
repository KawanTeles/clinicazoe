"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/whatsapp";
import type { FinancialTransactionView } from "@/modules/financial/services/financial-transaction-queries";
import {
  loadMoreFinancialTransactions,
  markTransactionAsPaid,
} from "@/modules/financial/services/financial-transaction-actions";
import {
  FinancialTransactionForm,
  type FinancialCategoryOption,
  type FinancialTransactionEditTarget,
} from "@/modules/financial/components/FinancialTransactionForm";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

/** Só admin/recepcionista chegam aqui — a página /financial já filtra isso
 * antes de renderizar esta seção; RLS de financial_transactions (0044)
 * reforça o mesmo escopo no banco independente do que a UI decidir. */
export function FinancialTransactionsSection({
  initialItems,
  initialTotalPages,
  categories,
  professionals,
}: {
  initialItems: FinancialTransactionView[];
  initialTotalPages: number;
  categories: FinancialCategoryOption[];
  professionals: { id: string; full_name: string }[];
}) {
  const toast = useToast();
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [directionFilter, setDirectionFilter] = useState<"todos" | "entrada" | "saida">("todos");
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialTransactionEditTarget | null>(null);

  async function refresh(direction: "todos" | "entrada" | "saida" = directionFilter) {
    const result = await loadMoreFinancialTransactions(direction === "todos" ? undefined : direction, 1);
    setItems(result.items);
    setTotalPages(result.totalPages);
    setPage(1);
  }

  async function handleFilterChange(direction: "todos" | "entrada" | "saida") {
    setDirectionFilter(direction);
    await refresh(direction);
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    const result = await loadMoreFinancialTransactions(
      directionFilter === "todos" ? undefined : directionFilter,
      nextPage,
    );
    setItems((prev) => [...prev, ...result.items]);
    setTotalPages(result.totalPages);
    setPage(nextPage);
    setLoadingMore(false);
  }

  async function handleMarkAsPaid(id: string) {
    setBusyId(id);
    const result = await markTransactionAsPaid(id);
    setBusyId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Lançamento marcado como pago.");
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary font-heading">Lançamentos Manuais</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          + Novo Lançamento
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 text-xs">
        {[
          { id: "todos", label: "Todos" },
          { id: "entrada", label: "Entradas" },
          { id: "saida", label: "Saídas" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleFilterChange(tab.id as "todos" | "entrada" | "saida")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              directionFilter === tab.id
                ? "bg-primary text-white shadow-xs font-bold"
                : "bg-card-elevated/40 text-text-secondary hover:text-text-primary hover:bg-card-elevated"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-xs font-medium text-text-secondary">
          Nenhum lançamento manual registrado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead className="border-b border-border/80 bg-card-elevated/70 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-2.5 font-bold">Descrição</th>
                <th className="px-4 py-2.5 font-bold">Categoria</th>
                <th className="px-4 py-2.5 font-bold">Vencimento</th>
                <th className="px-4 py-2.5 font-bold">Valor</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
                <th className="px-4 py-2.5 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-card-elevated/40">
                  <td className="px-4 py-3">
                    <p className="font-bold text-text-primary">{item.description}</p>
                    {item.professionalName && (
                      <p className="text-[11px] text-text-secondary">{item.professionalName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    <div className="flex flex-col gap-1">
                      <span>{item.categoryName}</span>
                      <Badge tone={item.direction === "entrada" ? "success" : "warning"} className="w-fit text-[10px]">
                        {item.direction === "entrada" ? "Entrada" : "Saída"}
                        {item.expenseType ? ` · ${item.expenseType === "fixa" ? "Fixa" : "Variável"}` : ""}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {dateFormatter.format(new Date(`${item.dueDate}T00:00:00`))}
                  </td>
                  <td className="px-4 py-3 font-bold text-text-primary">{formatCurrency(item.value)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={item.status === "pago" ? "success" : "warning"} className="text-[10px]">
                      {item.status === "pago" ? "Pago" : "Em aberto"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[11px] px-2.5"
                        onClick={() => {
                          setEditing({
                            id: item.id,
                            direction: item.direction,
                            category_id: item.categoryId,
                            expense_type: item.expenseType,
                            professional_id: item.professionalId,
                            description: item.description,
                            value: item.value,
                            payment_method: (item.paymentMethod as FinancialTransactionEditTarget["payment_method"]) ?? null,
                            due_date: item.dueDate,
                            notes: item.notes,
                          });
                          setFormOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      {item.status === "em_aberto" && (
                        <Button
                          size="sm"
                          isLoading={busyId === item.id}
                          className="h-7 text-[11px] px-2.5 font-semibold"
                          onClick={() => handleMarkAsPaid(item.id)}
                        >
                          Marcar como pago
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page < totalPages && (
        <div className="flex justify-center pt-1">
          <Button size="sm" variant="secondary" isLoading={loadingMore} onClick={handleLoadMore}>
            Carregar mais
          </Button>
        </div>
      )}

      <FinancialTransactionForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => refresh()}
        categories={categories}
        professionals={professionals}
        editing={editing}
      />
    </div>
  );
}

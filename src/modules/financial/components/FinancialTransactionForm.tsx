"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { ExpenseType, FinancialDirection, TransactionPaymentMethod } from "@/lib/supabase/types";
import {
  createFinancialTransaction,
  updateFinancialTransaction,
  type FinancialTransactionInput,
} from "@/modules/financial/services/financial-transaction-actions";

export interface FinancialCategoryOption {
  id: string;
  name: string;
  kind: "receita" | "despesa";
}

export interface FinancialTransactionEditTarget {
  id: string;
  direction: FinancialDirection;
  category_id: string;
  expense_type: ExpenseType | null;
  professional_id: string | null;
  description: string;
  value: number;
  payment_method: TransactionPaymentMethod | null;
  due_date: string;
  notes: string | null;
}

const PAYMENT_METHODS: { value: TransactionPaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

export function FinancialTransactionForm({
  isOpen,
  onClose,
  onSaved,
  categories,
  professionals,
  editing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: FinancialCategoryOption[];
  professionals: { id: string; full_name: string }[];
  /** Se presente, edita um lançamento existente — direção fica travada
   * (imutável depois de criado, mesma regra do trigger no banco). */
  editing: FinancialTransactionEditTarget | null;
}) {
  const isEditing = editing !== null;
  const [direction, setDirection] = useState<FinancialDirection>(editing?.direction ?? "saida");
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [expenseType, setExpenseType] = useState<ExpenseType | "">(editing?.expense_type ?? "");
  const [professionalId, setProfessionalId] = useState(editing?.professional_id ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [value, setValue] = useState(editing ? String(editing.value) : "");
  const [paymentMethod, setPaymentMethod] = useState<TransactionPaymentMethod | "">(editing?.payment_method ?? "");
  const [dueDate, setDueDate] = useState(editing?.due_date ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCategories = categories.filter((c) => c.kind === (direction === "entrada" ? "receita" : "despesa"));

  function resetAndClose() {
    setDirection("saida");
    setCategoryId("");
    setExpenseType("");
    setProfessionalId("");
    setDescription("");
    setValue("");
    setPaymentMethod("");
    setDueDate("");
    setNotes("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const numericValue = Number(value.replace(",", "."));
    if (!categoryId) return setError("Selecione uma categoria.");
    if (!description.trim()) return setError("Descreva o lançamento.");
    if (!Number.isFinite(numericValue) || numericValue < 0) return setError("Informe um valor válido.");
    if (!dueDate) return setError("Informe a data de vencimento.");

    const input: FinancialTransactionInput = {
      direction,
      category_id: categoryId,
      expense_type: direction === "saida" && expenseType ? expenseType : null,
      professional_id: professionalId || null,
      description,
      value: numericValue,
      payment_method: paymentMethod || null,
      due_date: dueDate,
      notes: notes || null,
    };

    setSaving(true);
    const result = isEditing
      ? await updateFinancialTransaction(editing.id, input)
      : await createFinancialTransaction(input);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSaved();
    resetAndClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={isEditing ? "Editar Lançamento" : "Novo Lançamento Manual"}
      subtitle="Entrada ou saída não ligada a uma consulta"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} isLoading={saving}>
            {isEditing ? "Salvar alterações" : "Registrar lançamento"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(["saida", "entrada"] as const).map((d) => (
            <button
              key={d}
              type="button"
              disabled={isEditing}
              onClick={() => {
                setDirection(d);
                setCategoryId("");
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                direction === d
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card-elevated text-text-secondary hover:text-text-primary"
              } ${isEditing ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {d === "saida" ? "Saída (despesa)" : "Entrada"}
            </button>
          ))}
        </div>

        <Select label="Categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Selecione...</option>
          {availableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        {direction === "saida" && (
          <Select
            label="Tipo de despesa"
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value as ExpenseType | "")}
          >
            <option value="">Não classificado</option>
            <option value="fixa">Fixa</option>
            <option value="variavel">Variável</option>
          </Select>
        )}

        <Input
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Aluguel de agosto, reembolso de material..."
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Valor (R$)"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0,00"
          />
          <Input
            label="Vencimento"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Forma de pagamento (opcional)"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as TransactionPaymentMethod | "")}
          >
            <option value="">—</option>
            {PAYMENT_METHODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Select
            label="Profissional (opcional)"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">—</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          label="Observações (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      </form>
    </Modal>
  );
}

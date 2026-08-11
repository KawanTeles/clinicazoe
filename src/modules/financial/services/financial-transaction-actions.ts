"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getFinancialTransactions,
  type FinancialTransactionView,
} from "@/modules/financial/services/financial-transaction-queries";
import type { ExpenseType, FinancialDirection, TransactionPaymentMethod } from "@/lib/supabase/types";

async function requireFinancialStaff() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) {
    throw new Error("Acesso negado.");
  }
  return session;
}

export interface FinancialTransactionInput {
  direction: FinancialDirection;
  category_id: string;
  expense_type?: ExpenseType | null;
  professional_id?: string | null;
  description: string;
  value: number;
  payment_method?: TransactionPaymentMethod | null;
  due_date: string;
  notes?: string | null;
}

function cleanInput(input: FinancialTransactionInput) {
  return {
    direction: input.direction,
    category_id: input.category_id,
    expense_type: input.direction === "saida" ? input.expense_type ?? null : null,
    professional_id: input.professional_id || null,
    description: input.description.trim(),
    value: input.value,
    payment_method: input.payment_method || null,
    due_date: input.due_date,
    notes: input.notes?.trim() || null,
  };
}

/** Cria um lançamento manual (entrada ou saída), não ligado a um
 * appointment — despesas da clínica, receitas avulsas etc. Restrito a
 * admin/recepcionista, reforçado pela RLS (financial_transactions_insert,
 * 0044); categoria e direção são validadas de novo no banco pelo trigger
 * financial_transactions_validate, então mesmo um payload malformado aqui
 * não cria inconsistência. */
export async function createFinancialTransaction(
  input: FinancialTransactionInput,
): Promise<{ error: string | null; id?: string }> {
  const session = await requireFinancialStaff();

  const rateLimit = checkRateLimit(`create-financial-transaction:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  if (!input.description.trim()) return { error: "Descreva o lançamento." };
  if (!(input.value >= 0)) return { error: "Informe um valor válido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({ ...cleanInput(input), created_by: session.user.id })
    .select("id")
    .single();

  if (error) {
    const message =
      error.message.includes("compatível com a direção")
        ? "A categoria escolhida não é compatível com a direção do lançamento."
        : "Não foi possível criar o lançamento.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "financial_transaction.created",
    entity: "financial_transactions",
    entityId: data.id,
    metadata: { direction: input.direction, category_id: input.category_id, value: input.value },
  });

  return { error: null, id: data.id };
}

/** Edita um lançamento manual já existente. direction e created_by são
 * imutáveis depois de criado — reforçado pelo trigger
 * financial_transactions_validate (0044); se o valor/categoria/etc estava
 * errado, corrige-se aqui, mas a direção e a autoria original nunca mudam
 * (um engano de direção gera um novo lançamento de correção, não uma
 * reescrita do histórico). */
export async function updateFinancialTransaction(
  id: string,
  input: Omit<FinancialTransactionInput, "direction">,
): Promise<{ error: string | null }> {
  const session = await requireFinancialStaff();

  if (!input.description.trim()) return { error: "Descreva o lançamento." };
  if (!(input.value >= 0)) return { error: "Informe um valor válido." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("financial_transactions")
    .select("direction")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { error: "Lançamento não encontrado." };

  const { error } = await supabase
    .from("financial_transactions")
    .update(cleanInput({ ...input, direction: existing.direction }))
    .eq("id", id);

  if (error) {
    const message =
      error.message.includes("compatível com a direção")
        ? "A categoria escolhida não é compatível com a direção do lançamento."
        : "Não foi possível salvar as alterações.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "financial_transaction.updated",
    entity: "financial_transactions",
    entityId: id,
    metadata: { category_id: input.category_id, value: input.value },
  });

  return { error: null };
}

/** Marca um lançamento manual como pago — mesmo padrão de markAsPaid
 * (financial-actions.ts): usa `.select().maybeSingle()` para detectar se a
 * RLS de fato afetou alguma linha, evitando um audit_log de baixa que nunca
 * aconteceu. */
export async function markTransactionAsPaid(id: string): Promise<{ error: string | null }> {
  const session = await requireFinancialStaff();

  const rateLimit = checkRateLimit(`mark-transaction-paid:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("financial_transactions")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Não foi possível marcar como pago." };
  if (!updated) return { error: "Lançamento não encontrado ou você não tem permissão para alterá-lo." };

  await logAudit({
    actorId: session.user.id,
    action: "financial_transaction.paid",
    entity: "financial_transactions",
    entityId: id,
  });

  return { error: null };
}

/** Carrega a próxima página de lançamentos manuais, chamada pelo botão
 * "Carregar mais" no client (FinancialTransactionsSection) — paginação
 * client-side em vez de ?page= na URL, para não colidir com a paginação de
 * financial_entries que já usa esse mesmo query param na página /financial. */
export async function loadMoreFinancialTransactions(
  direction: "entrada" | "saida" | undefined,
  page: number,
): Promise<{ items: FinancialTransactionView[]; totalPages: number }> {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) {
    return { items: [], totalPages: 1 };
  }

  return getFinancialTransactions({ direction, page });
}

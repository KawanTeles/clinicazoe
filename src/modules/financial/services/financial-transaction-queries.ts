import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type FinancialTransactionRow = Database["public"]["Tables"]["financial_transactions"]["Row"];

export interface FinancialTransactionView {
  id: string;
  direction: "entrada" | "saida";
  categoryId: string;
  categoryName: string;
  expenseType: "fixa" | "variavel" | null;
  professionalId: string | null;
  professionalName: string | null;
  description: string;
  value: number;
  paymentMethod: string | null;
  dueDate: string;
  status: string;
  paidAt: string | null;
  notes: string | null;
}

const PAGE_SIZE = 20;

async function denormalize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: FinancialTransactionRow[],
): Promise<FinancialTransactionView[]> {
  if (rows.length === 0) return [];

  const categoryIds = Array.from(new Set(rows.map((r) => r.category_id)));
  const professionalIds = Array.from(
    new Set(rows.map((r) => r.professional_id).filter((id): id is string => Boolean(id))),
  );

  const [{ data: categories }, { data: professionals }] = await Promise.all([
    supabase.from("financial_categories").select("id, name").in("id", categoryIds),
    professionalIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", professionalIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const professionalById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    categoryId: row.category_id,
    categoryName: categoryById.get(row.category_id) ?? "—",
    expenseType: row.expense_type,
    professionalId: row.professional_id,
    professionalName: row.professional_id ? professionalById.get(row.professional_id) ?? null : null,
    description: row.description,
    value: row.value,
    paymentMethod: row.payment_method,
    dueDate: row.due_date,
    status: row.status,
    paidAt: row.paid_at,
    notes: row.notes,
  }));
}

export interface FinancialTransactionFilters {
  direction?: "entrada" | "saida";
  page?: number;
}

export async function getFinancialTransactions(
  filters: FinancialTransactionFilters = {},
): Promise<{ items: FinancialTransactionView[]; totalPages: number }> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);

  let query = supabase
    .from("financial_transactions")
    .select("*", { count: "exact" })
    .order("due_date", { ascending: false });

  if (filters.direction) query = query.eq("direction", filters.direction);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
  const rows: FinancialTransactionRow[] = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const items = await denormalize(supabase, rows);
  return { items, totalPages };
}

/** Lista mínima (id + nome) para o seletor opcional de profissional no
 * formulário de lançamento manual — não precisa do resto do perfil
 * (avatar, especialidade etc.) que getActiveProfessionals carrega. */
export async function getActiveProfessionalsForSelect() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "profissional")
    .eq("status", "active")
    .order("full_name");
  return data ?? [];
}

/** Resumo simples por direção/status — RLS já restringe a admin/recepcionista,
 * então não há filtro adicional por usuário aqui (diferente de
 * getFinancialSummary de financial_entries, que filtra por profissional). */
export async function getFinancialTransactionsSummary() {
  const supabase = await createClient();
  const { data } = await supabase.from("financial_transactions").select("direction, value, status");
  const rows = data ?? [];

  const entradas = rows.filter((r) => r.direction === "entrada").reduce((sum, r) => sum + r.value, 0);
  const saidas = rows.filter((r) => r.direction === "saida").reduce((sum, r) => sum + r.value, 0);
  const emAberto = rows.filter((r) => r.status === "em_aberto").reduce((sum, r) => sum + r.value, 0);

  return { entradas, saidas, emAberto };
}

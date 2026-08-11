import { createClient } from "@/lib/supabase/server";
import type { FinancialCategoryKind } from "@/lib/supabase/types";

export async function getFinancialCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financial_categories")
    .select("*")
    .order("kind")
    .order("name");
  return data ?? [];
}

/** Para o formulário de lançamento manual: só categorias ativas da direção
 * escolhida (receita/despesa) — o trigger financial_transactions_validate
 * (0044) reforça essa mesma regra no banco caso algo escape daqui. */
export async function getActiveFinancialCategories(kind: FinancialCategoryKind) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financial_categories")
    .select("id, name")
    .eq("kind", kind)
    .eq("status", "active")
    .order("name");
  return data ?? [];
}

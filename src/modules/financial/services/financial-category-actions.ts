"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";
import type { FinancialCategoryKind } from "@/lib/supabase/types";

async function requireAdmin() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Categoria financeira nunca é excluída, só desativada via status — mesmo
 * princípio de financial_entries/patient_evolutions (nunca perder histórico
 * financeiro): uma categoria desativada continua legível em lançamentos
 * antigos que já a referenciam, só some das opções para lançamentos novos. */
export async function createFinancialCategory(
  name: string,
  kind: FinancialCategoryKind,
): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) return { error: "Informe o nome da categoria." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_categories")
    .insert({ name: trimmed, kind })
    .select("id")
    .single();

  if (error) {
    const message =
      error.code === "23505" ? "Já existe uma categoria com esse nome para essa direção." : "Não foi possível criar a categoria.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "financial_category.created",
    entity: "financial_categories",
    entityId: data.id,
    metadata: { name: trimmed, kind },
  });

  return { error: null };
}

export async function updateFinancialCategory(
  id: string,
  input: { name?: string; status?: "active" | "inactive" },
): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  if (input.name !== undefined && !input.name.trim()) {
    return { error: "O nome não pode ficar vazio." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("financial_categories")
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .eq("id", id);

  if (error) {
    const message =
      error.code === "23505" ? "Já existe uma categoria com esse nome para essa direção." : "Não foi possível salvar as alterações.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "financial_category.updated",
    entity: "financial_categories",
    entityId: id,
    metadata: input,
  });

  return { error: null };
}

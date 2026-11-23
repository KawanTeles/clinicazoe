"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";
import { checkRateLimit } from "@/lib/rate-limit";

/** [DECISÃO 1] da Fase 2 (auditoria pós-correções): só admin e recepção dão
 * baixa num lançamento — antes (migration 0022) o profissional também podia
 * marcar o próprio Pix/lançamento como pago, decisão revista com o cliente
 * (quem atende não deveria também confirmar o próprio recebimento). RLS
 * (migration 0087, financial_entries_update) já bloqueia no banco; esta
 * checagem é só pra devolver uma mensagem clara em vez do genérico
 * "lançamento não encontrado" que a RLS causaria. */
async function requireFinancialStaff() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Marca UM lançamento financeiro como pago. Idempotente por natureza do
 * filtro `.eq("status", "em_aberto")`: clique duplo ou duas pessoas ao mesmo
 * tempo no mesmo lançamento — só a primeira chamada a efetivamente mudar o
 * status conta linha afetada (a segunda, mesmo que já tenha passado pela RLS,
 * encontra `status != 'em_aberto'` e não atualiza nada; `.maybeSingle()`
 * detecta isso e devolve erro amigável em vez de sucesso falso). */
export async function markAsPaid(entryId: string): Promise<{ error: string | null }> {
  let session;
  try {
    session = await requireFinancialStaff();
  } catch {
    return { error: "Acesso negado." };
  }

  const rateLimit = checkRateLimit(`mark-paid:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("financial_entries")
    .update({ status: "pago", paid_at: new Date().toISOString(), paid_by: session.user.id })
    .eq("id", entryId)
    .eq("status", "em_aberto")
    .select("value")
    .maybeSingle();

  if (error) return { error: "Não foi possível marcar como pago." };
  if (!updated) return { error: "Lançamento não encontrado, já estava pago/cancelado, ou você não tem permissão para alterá-lo." };

  await logAudit({
    actorId: session.user.id,
    action: "financial_entry.paid",
    entity: "financial_entries",
    entityId: entryId,
  });

  return { error: null };
}

export interface MarkEntriesAsPaidResult {
  error: string | null;
  paidCount: number;
  skippedCount: number;
}

/** Mesma coisa, em lote. Um único UPDATE com `.in(ids).eq("em_aberto")` —
 * atômico por linha no Postgres (cada linha é travada e revalidada
 * individualmente), então chamar isso duas vezes em paralelo com os mesmos
 * ids, ou clicar duas vezes rápido, nunca duplica a baixa nem quebra: a
 * segunda chamada simplesmente não encontra mais nada em `em_aberto` entre os
 * ids que a primeira já pagou, e `skippedCount` reflete isso pro usuário. */
export async function markEntriesAsPaid(entryIds: string[]): Promise<MarkEntriesAsPaidResult> {
  let session;
  try {
    session = await requireFinancialStaff();
  } catch {
    return { error: "Acesso negado.", paidCount: 0, skippedCount: 0 };
  }

  if (entryIds.length === 0) return { error: "Nenhum lançamento selecionado.", paidCount: 0, skippedCount: 0 };

  const rateLimit = checkRateLimit(`mark-paid-batch:${session.user.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return {
      error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.`,
      paidCount: 0,
      skippedCount: 0,
    };
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("financial_entries")
    .update({ status: "pago", paid_at: new Date().toISOString(), paid_by: session.user.id })
    .in("id", entryIds)
    .eq("status", "em_aberto")
    .select("id");

  if (error) return { error: "Não foi possível marcar os lançamentos selecionados como pagos.", paidCount: 0, skippedCount: 0 };

  const paidCount = updated?.length ?? 0;

  await logAudit({
    actorId: session.user.id,
    action: "financial_entry.paid_batch",
    entity: "financial_entries",
    metadata: { requested: entryIds.length, paidCount, entryIds: updated?.map((e) => e.id) ?? [] },
  });

  return { error: null, paidCount, skippedCount: entryIds.length - paidCount };
}

/** Reverte pago -> em_aberto, com motivo obrigatório (registrado na própria
 * linha — visível na tela — e no audit_log). Só funciona em cima de um
 * lançamento que ainda está "pago": se alguém já cancelou o atendimento
 * (status vira "cancelado", `cancelFinancialEntryForAppointment`), desfazer
 * não se aplica mais — a baixa deixou de ser o problema. Não apaga o
 * comprovante nem paid_by/paid_at anteriores do histórico do audit_log,
 * só limpa os campos "ativos" (status/paid_at/paid_by) que voltam a valer
 * quando o lançamento for pago de novo. */
export async function undoMarkAsPaid(entryId: string, reason: string): Promise<{ error: string | null }> {
  let session;
  try {
    session = await requireFinancialStaff();
  } catch {
    return { error: "Acesso negado." };
  }

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: "Informe o motivo de desfazer o pagamento." };

  const rateLimit = checkRateLimit(`undo-paid:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("financial_entries")
    .update({
      status: "em_aberto",
      paid_at: null,
      paid_by: null,
      undone_at: new Date().toISOString(),
      undone_by: session.user.id,
      undo_reason: trimmedReason,
    })
    .eq("id", entryId)
    .eq("status", "pago")
    .select("id")
    .maybeSingle();

  if (error) return { error: "Não foi possível desfazer o pagamento." };
  if (!updated) return { error: "Lançamento não encontrado ou não está mais marcado como pago." };

  await logAudit({
    actorId: session.user.id,
    action: "financial_entry.payment_undone",
    entity: "financial_entries",
    entityId: entryId,
    metadata: { reason: trimmedReason },
  });

  return { error: null };
}

// cancelFinancialEntryForAppointment e cancelFinancialEntriesForAppointments
// mudaram para financial-internal.ts (achado da auditoria de segurança:
// este arquivo é "use server", então as duas viviam expostas como Server
// Action chamável por qualquer um, sem login, sem checar dono do
// appointmentId — financial-internal.ts não é "use server", só é alcançável
// a partir de outra Server Action já autenticada).

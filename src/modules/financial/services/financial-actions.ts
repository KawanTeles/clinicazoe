"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/modules/team/services/audit";
import { notifyStaff } from "@/modules/notifications/services/notify";
import { checkRateLimit } from "@/lib/rate-limit";

/** Marca um lançamento financeiro como pago. O escopo de quem pode dar baixa
 * em qual lançamento é decidido pela RLS de `financial_entries` (não por
 * essa função, que não filtra por dono) — comportamento confirmado e
 * intencional na migration 0022_receptionist_mark_as_paid.sql:
 *   - admin: qualquer lançamento (`is_admin()`).
 *   - recepcionista: qualquer lançamento (`current_role() = 'recepcionista'`,
 *     sem checar `professional_id`) — é rotina de recepção dar baixa em
 *     pagamentos de qualquer profissional no balcão.
 *   - profissional: só os próprios (`professional_id = auth.uid()`).
 *
 * O update usa `.select().maybeSingle()` para saber se a RLS de fato afetou
 * alguma linha — sem isso, um profissional tentando dar baixa no lançamento
 * de outro recebia falso sucesso (RLS nega a alteração em silêncio, sem
 * erro, só zero linhas afetadas) e ainda gerava um audit_log de uma baixa
 * que nunca aconteceu. */
export async function markAsPaid(entryId: string): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session || !["admin", "profissional", "recepcionista"].includes(session.profile.role)) {
    return { error: "Acesso negado." };
  }

  const rateLimit = checkRateLimit(`mark-paid:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("financial_entries")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", entryId)
    .select("value")
    .maybeSingle();

  if (error) return { error: "Não foi possível marcar como pago." };
  if (!updated) return { error: "Lançamento não encontrado ou você não tem permissão para alterá-lo." };

  await logAudit({
    actorId: session.user.id,
    action: "financial_entry.paid",
    entity: "financial_entries",
    entityId: entryId,
  });

  if (session.profile.role === "profissional") {
    await notifyStaff({
      type: "financial.paid",
      title: "Pagamento registrado",
      message: `${session.profile.full_name} marcou um lançamento de R$ ${updated.value.toFixed(2)} como pago.`,
      entity: "financial_entries",
      entityId: entryId,
    });
  }

  return { error: null };
}

/** Cancelar um atendimento não desfazia o lançamento financeiro gerado na
 * confirmação (financial_entries) — o registro ficava órfão em 'em_aberto'
 * pra sempre, continuando a pedir "Marcar como pago" por um atendimento que
 * não vai mais acontecer (booking-actions.ts e recurrence-actions.ts, que
 * chamam esta função, cobrem os 3 fluxos de cancelamento: avulso, avulso
 * dentro de série recorrente, e série inteira). Só cancela quem ainda está
 * em_aberto: se já foi pago antes do cancelamento, o dinheiro foi mesmo
 * recebido — mexer nisso automaticamente apagaria um registro de receita
 * real; um eventual reembolso é decisão manual, fora deste fluxo. Usa o
 * client admin (mesmo padrão do insert em confirmAppointment) porque quem
 * cancela pode ser o próprio paciente, que não tem permissão de RLS para
 * editar financial_entries. */
export async function cancelFinancialEntryForAppointment(appointmentId: string) {
  const admin = createAdminClient();
  await admin
    .from("financial_entries")
    .update({ status: "cancelado" })
    .eq("appointment_id", appointmentId)
    .eq("status", "em_aberto");
}

/** Mesma coisa, em lote — usado no cancelamento de uma série recorrente
 * inteira (vários appointment_id de uma vez). */
export async function cancelFinancialEntriesForAppointments(appointmentIds: string[]) {
  if (appointmentIds.length === 0) return;
  const admin = createAdminClient();
  await admin
    .from("financial_entries")
    .update({ status: "cancelado" })
    .in("appointment_id", appointmentIds)
    .eq("status", "em_aberto");
}

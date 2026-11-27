import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Helpers internos do módulo financeiro — NUNCA "use server": estas funções
 * não verificam quem está chamando (confiam que o chamador, uma Server
 * Action já autenticada, já validou que o ator pode cancelar aquele
 * atendimento específico) e usam o client admin (bypassa RLS, necessário
 * porque quem cancela pode ser o próprio paciente, sem permissão de RLS
 * para editar financial_entries). Se este arquivo tivesse "use server", as
 * duas funções abaixo virariam Server Actions chamáveis diretamente por
 * qualquer um, sem login e sem checar se o appointmentId pertence a quem
 * chamou — foi exatamente isso que a auditoria de segurança encontrou
 * quando elas viviam em financial-actions.ts (que é "use server").
 */

/** Cancelar um atendimento não desfazia o lançamento financeiro gerado na
 * confirmação (financial_entries) — o registro ficava órfão em 'em_aberto'
 * pra sempre, continuando a pedir "Marcar como pago" por um atendimento que
 * não vai mais acontecer (booking-actions.ts e recurrence-actions.ts, que
 * chamam esta função, cobrem os 3 fluxos de cancelamento: avulso, avulso
 * dentro de série recorrente, e série inteira). Só cancela quem ainda está
 * em_aberto: se já foi pago antes do cancelamento, o dinheiro foi mesmo
 * recebido — mexer nisso automaticamente apagaria um registro de receita
 * real; um eventual reembolso é decisão manual, fora deste fluxo. */
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

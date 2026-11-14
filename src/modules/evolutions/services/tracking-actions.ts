"use server";

import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { notifyEvolutionPendingReminder } from "@/modules/notifications/services/notify";

async function requireTrackingAccess() {
  const session = await getCurrentUser();
  if (!session) throw new Error("Acesso negado.");
  const allowed = await can(session.profile, "evolution_tracking.view");
  if (!allowed) throw new Error("Acesso negado.");
  return session;
}

/** Dispara o lembrete de pendência para um profissional. Chamado pelo botão
 * da tela de Acompanhamento — nunca automático (não há agendador configurado
 * no projeto, decisão Q6 pendente de confirmação do usuário). `pendingCount`
 * vem de quem chama (já carregou a lista), não é recalculado aqui — a
 * própria RPC get_evolution_tracking (0081) é a fonte de verdade. */
export async function sendEvolutionPendingReminder(
  professionalId: string,
  pendingCount: number,
): Promise<{ error: string | null; sent?: boolean }> {
  let session;
  try {
    session = await requireTrackingAccess();
  } catch {
    return { error: "Acesso negado." };
  }

  if (pendingCount <= 0) return { error: "Não há pendência para lembrar." };

  const rateLimit = checkRateLimit(`evolution-reminder:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const result = await notifyEvolutionPendingReminder({ professionalId, pendingCount });

  await logAudit({
    actorId: session.user.id,
    action: "evolution_tracking.reminder_sent",
    entity: "profiles",
    entityId: professionalId,
    metadata: { pending_count: pendingCount, grouped: !result.sent },
  });

  return { error: null, sent: result.sent };
}

/** Prazo (em horas) a partir do qual uma pendência vira "atrasada" — item 10
 * do pedido original ("prazo configurável"). Tabela dedicada
 * evolution_tracking_settings, não clinic_settings: dar à Coordenação
 * escrita em clinic_settings abriria endereço, telefone, preço, logo — tudo —
 * só para liberar este único número. */
export async function updateEvolutionLateThreshold(hours: number): Promise<{ error: string | null }> {
  let session;
  try {
    session = await requireTrackingAccess();
  } catch {
    return { error: "Acesso negado." };
  }

  if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 30) {
    return { error: "Informe um número de horas entre 1 e 720 (30 dias)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("evolution_tracking_settings")
    .update({ late_after_hours: hours })
    .eq("id", 1);

  if (error) return { error: "Não foi possível salvar o prazo." };

  await logAudit({
    actorId: session.user.id,
    action: "evolution_tracking.threshold_updated",
    entity: "evolution_tracking_settings",
    entityId: "1",
    metadata: { late_after_hours: hours },
  });

  return { error: null };
}

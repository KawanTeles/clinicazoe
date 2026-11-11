import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Notificação é efeito colateral de melhor esforço em cima de uma operação
 * principal já concluída (ex.: agendamento criado, pagamento marcado) —
 * nunca deve lançar. Sem o try/catch, uma falha aqui (instabilidade
 * transitória do Postgres, por exemplo) subiria como exceção não tratada
 * depois que a operação principal já foi persistida com sucesso, e o
 * chamador veria uma tela de erro genérica mesmo tudo tendo funcionado. */
export async function notify(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  entity?: string;
  entityId?: string;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entity: params.entity,
      entity_id: params.entityId,
    });
  } catch (err) {
    console.error("[notify] falha ao gravar notificação:", err);
  }
}

/** Notificação de alteração de agenda (Agenda por Profissional) — agrupa
 * edições seguidas do mesmo autor na mesma agenda num período curto (evita
 * um "spam" de notificações quando alguém ajusta vários horários seguidos).
 * Antes de inserir, procura uma notificação NÃO LIDA do mesmo destinatário +
 * mesmo profissional afetado + mesmo autor, criada nos últimos 2 minutos; se
 * achar, atualiza a mensagem (contador) e o horário em vez de inserir outra
 * linha. O histórico de verdade (uma linha por alteração) continua intacto
 * em schedule_change_log — esse agrupamento é só da notificação. */
export async function notifyAgendaChange(params: {
  userId: string;
  changedByName: string;
  professionalName: string;
  description: string;
}) {
  try {
    const admin = createAdminClient();
    const groupWindowStart = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const entity = "schedule_change_log";

    const { data: existing } = await admin
      .from("notifications")
      .select("id, message")
      .eq("user_id", params.userId)
      .eq("entity", entity)
      .eq("type", `agenda_change:${params.changedByName}:${params.professionalName}`)
      .is("read_at", null)
      .gte("created_at", groupWindowStart)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const countMatch = existing.message.match(/^\((\d+)\)/);
      const count = countMatch ? Number(countMatch[1]) + 1 : 2;
      await admin
        .from("notifications")
        .update({
          message: `(${count}) ${params.changedByName} fez ${count} alterações na agenda de ${params.professionalName}.`,
          created_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return;
    }

    await admin.from("notifications").insert({
      user_id: params.userId,
      type: `agenda_change:${params.changedByName}:${params.professionalName}`,
      title: "Alteração na agenda",
      message: `${params.changedByName} ${params.description} na agenda de ${params.professionalName}.`,
      entity,
    });
  } catch (err) {
    console.error("[notify] falha ao gravar notificação de alteração de agenda:", err);
  }
}

/** Notifica todos os admins e recepcionistas ativos (ex.: nova consulta
 * pendente). Mesma cautela de notify() acima: melhor esforço, nunca lança. */
export async function notifyStaff(params: {
  type: string;
  title: string;
  message: string;
  entity?: string;
  entityId?: string;
}) {
  try {
    const admin = createAdminClient();
    const { data: staff } = await admin
      .from("profiles")
      .select("id")
      .in("role", ["admin", "recepcionista"])
      .eq("status", "active");

    if (!staff || staff.length === 0) return;

    await admin.from("notifications").insert(
      staff.map((member) => ({
        user_id: member.id,
        type: params.type,
        title: params.title,
        message: params.message,
        entity: params.entity,
        entity_id: params.entityId,
      })),
    );
  } catch (err) {
    console.error("[notify] falha ao gravar notificação de staff:", err);
  }
}

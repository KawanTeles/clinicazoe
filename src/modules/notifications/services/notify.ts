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

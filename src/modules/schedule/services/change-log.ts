import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAgendaChange } from "@/modules/notifications/services/notify";

export type ScheduleEntityType = "appointment" | "schedule_slot" | "schedule_block" | "schedule_exception";

export interface ScheduleChangeField {
  field: string;
  old: unknown;
  new: unknown;
}

const ACTION_LABELS: Record<string, string> = {
  created: "criou um atendimento",
  updated: "alterou um atendimento",
  rescheduled: "remarcou um atendimento",
  cancelled: "cancelou um atendimento",
  status_changed: "mudou o status de um atendimento",
  slot_created: "criou um horário de trabalho",
  slot_updated: "alterou um horário de trabalho",
  slot_deleted: "removeu um horário de trabalho",
  block_created: "criou um bloqueio",
  block_updated: "alterou um bloqueio",
  block_deleted: "removeu um bloqueio",
  exception_created: "criou um período de férias/ausência",
  exception_deleted: "removeu um período de férias/ausência",
};

/** Registra uma alteração na agenda (schedule_change_log, imutável — nunca
 * editar/apagar uma linha já gravada) e dispara notificação agrupada pra
 * admin + recepção + o profissional afetado, sempre excluindo quem fez a
 * própria alteração. Melhor esforço: nunca lança — uma falha aqui não pode
 * derrubar a operação principal (atendimento/horário) que já foi persistida
 * com sucesso antes desta chamada. */
export async function logScheduleChange(params: {
  changedBy: string;
  professionalId: string;
  entityType: ScheduleEntityType;
  entityId: string;
  action: string;
  changes?: ScheduleChangeField[];
}): Promise<void> {
  try {
    const admin = createAdminClient();

    await admin.from("schedule_change_log").insert({
      changed_by: params.changedBy,
      professional_id: params.professionalId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      changes: params.changes ?? [],
    });

    // Agenda e Atendimentos leem a mesma tabela (appointments) — uma única
    // fonte de dados (Parte 6 do pedido). Sem isso, uma mutação feita numa
    // tela só aparece na outra depois de um refresh manual, porque cada
    // tela é uma rota Next com seu próprio cache de Server Component.
    revalidatePath("/schedule");
    revalidatePath("/appointments");

    const { data: staff } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("role", ["admin", "recepcionista"])
      .eq("status", "active");

    const { data: professional } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", params.professionalId)
      .maybeSingle();

    const { data: actor } = await admin.from("profiles").select("full_name").eq("id", params.changedBy).maybeSingle();

    const changedByName = actor?.full_name ?? "Alguém";
    const professionalName = professional?.full_name ?? "profissional";
    const description = ACTION_LABELS[params.action] ?? "fez uma alteração";

    const recipientIds = new Set<string>((staff ?? []).map((s) => s.id));
    recipientIds.add(params.professionalId);
    recipientIds.delete(params.changedBy);

    for (const userId of recipientIds) {
      await notifyAgendaChange({ userId, changedByName, professionalName, description });
    }
  } catch (err) {
    console.error("[schedule] falha ao registrar alteração de agenda:", err);
  }
}

"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";
import { logScheduleChange } from "@/modules/schedule/services/change-log";

export type ScheduleBlockType = "almoco" | "nao_agendar" | "reuniao" | "reposicao" | "sublocacao" | "outro";

// A escrita de fato é decidida pela RLS (admin ou o próprio profissional
// dono do bloqueio) — mesmo padrão de schedule-actions.ts.
async function requireAuthenticated() {
  const session = await getCurrentUser();
  if (!session) {
    throw new Error("Acesso negado.");
  }
  return session;
}

export interface CreateScheduleBlockInput {
  professionalId: string;
  blockType: ScheduleBlockType;
  dayOfWeek?: number;
  specificDate?: string;
  startTime: string;
  endTime: string;
  label?: string;
}

export async function createScheduleBlock(input: CreateScheduleBlockInput): Promise<{ error: string | null }> {
  const session = await requireAuthenticated();

  if (input.startTime >= input.endTime) {
    return { error: "O horário final precisa ser depois do horário inicial." };
  }
  const hasDayOfWeek = input.dayOfWeek !== undefined && input.dayOfWeek !== null;
  const hasSpecificDate = !!input.specificDate;
  if (hasDayOfWeek === hasSpecificDate) {
    return { error: "Informe o dia da semana (recorrente) OU uma data específica, não os dois." };
  }
  if (hasDayOfWeek && (input.dayOfWeek! < 0 || input.dayOfWeek! > 6)) {
    return { error: "Dia da semana inválido." };
  }

  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from("schedule_blocks")
    .insert({
      professional_id: input.professionalId,
      block_type: input.blockType,
      day_of_week: hasDayOfWeek ? input.dayOfWeek : null,
      specific_date: hasSpecificDate ? input.specificDate : null,
      start_time: input.startTime,
      end_time: input.endTime,
      label: input.label?.trim() || null,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: "Não foi possível criar o bloqueio." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "schedule_block.created",
    entity: "schedule_blocks",
    entityId: created.id,
    metadata: { professionalId: input.professionalId, blockType: input.blockType },
  });

  await logScheduleChange({
    changedBy: session.user.id,
    professionalId: input.professionalId,
    entityType: "schedule_block",
    entityId: created.id,
    action: "block_created",
    changes: [
      { field: "block_type", old: null, new: input.blockType },
      { field: "start_time", old: null, new: input.startTime },
      { field: "end_time", old: null, new: input.endTime },
    ],
  });

  return { error: null };
}

export async function deleteScheduleBlock(blockId: string): Promise<{ error: string | null }> {
  const session = await requireAuthenticated();

  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("schedule_blocks")
    .delete()
    .eq("id", blockId)
    .select("id, professional_id, block_type")
    .maybeSingle();

  if (error) return { error: "Não foi possível remover o bloqueio." };
  if (!deleted) return { error: "Bloqueio não encontrado ou você não tem permissão para removê-lo." };

  await logAudit({
    actorId: session.user.id,
    action: "schedule_block.deleted",
    entity: "schedule_blocks",
    entityId: blockId,
  });

  await logScheduleChange({
    changedBy: session.user.id,
    professionalId: deleted.professional_id,
    entityType: "schedule_block",
    entityId: blockId,
    action: "block_deleted",
    changes: [{ field: "block_type", old: deleted.block_type, new: null }],
  });

  return { error: null };
}

"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";

// A escrita de fato é decidida pela RLS (admin ou o próprio profissional
// dono do horário) — aqui só garantimos que existe uma sessão válida.
async function requireAuthenticated() {
  const session = await getCurrentUser();
  if (!session) {
    throw new Error("Acesso negado.");
  }
  return session;
}

export interface CreateSlotInput {
  professionalId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
  insuranceIds: string[];
}

export async function createSlot(input: CreateSlotInput): Promise<{ error: string | null }> {
  const session = await requireAuthenticated();

  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) return { error: "Dia da semana inválido." };
  if (input.startTime >= input.endTime) {
    return { error: "O horário final precisa ser depois do horário inicial." };
  }
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    return { error: "Vagas precisa ser um número inteiro maior que zero." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("schedule_slots")
    .select("start_time, end_time")
    .eq("professional_id", input.professionalId)
    .eq("day_of_week", input.dayOfWeek)
    .eq("status", "active");

  const overlaps = (existing ?? []).some(
    (slot) => input.startTime < slot.end_time && input.endTime > slot.start_time,
  );
  if (overlaps) {
    return { error: "Esse horário se sobrepõe a um horário já cadastrado nesse dia." };
  }

  const { data: created, error } = await supabase
    .from("schedule_slots")
    .insert({
      professional_id: input.professionalId,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
      capacity: input.capacity,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: "Não foi possível criar o horário." };
  }

  if (input.insuranceIds.length > 0) {
    const { error: linkError } = await supabase.from("schedule_slot_insurances").insert(
      input.insuranceIds.map((insuranceId) => ({ slot_id: created.id, insurance_id: insuranceId })),
    );
    if (linkError) {
      return { error: "Horário criado, mas houve falha ao salvar os convênios." };
    }
  }

  await logAudit({
    actorId: session.user.id,
    action: "schedule_slot.created",
    entity: "schedule_slots",
    entityId: created.id,
    metadata: {
      professionalId: input.professionalId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      insuranceIds: input.insuranceIds,
    },
  });

  return { error: null };
}

export async function setSlotStatus(
  slotId: string,
  status: "active" | "inactive",
): Promise<{ error: string | null }> {
  const session = await requireAuthenticated();

  const supabase = await createClient();
  const { error } = await supabase.from("schedule_slots").update({ status }).eq("id", slotId);

  if (error) return { error: "Não foi possível atualizar o horário." };

  await logAudit({
    actorId: session.user.id,
    action: "schedule_slot.status_updated",
    entity: "schedule_slots",
    entityId: slotId,
    metadata: { status },
  });

  return { error: null };
}

export async function deleteSlot(slotId: string): Promise<{ error: string | null }> {
  const session = await requireAuthenticated();

  const supabase = await createClient();
  const { error } = await supabase.from("schedule_slots").delete().eq("id", slotId);

  if (error) return { error: "Não foi possível excluir o horário." };

  await logAudit({
    actorId: session.user.id,
    action: "schedule_slot.deleted",
    entity: "schedule_slots",
    entityId: slotId,
  });

  return { error: null };
}

export interface CreateExceptionInput {
  professionalId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export async function createScheduleException(
  input: CreateExceptionInput,
): Promise<{ error: string | null }> {
  const session = await requireAuthenticated();

  if (input.endDate < input.startDate) {
    return { error: "A data final precisa ser depois (ou igual) da data inicial." };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("schedule_exceptions")
    .insert({
      professional_id: input.professionalId,
      start_date: input.startDate,
      end_date: input.endDate,
      reason: input.reason?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: "Não foi possível registrar o bloqueio." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "schedule_exception.created",
    entity: "schedule_exceptions",
    entityId: created.id,
    metadata: {
      professionalId: input.professionalId,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
    },
  });

  return { error: null };
}

export async function deleteScheduleException(id: string): Promise<{ error: string | null }> {
  const session = await requireAuthenticated();

  const supabase = await createClient();
  const { error } = await supabase.from("schedule_exceptions").delete().eq("id", id);

  if (error) return { error: "Não foi possível remover o bloqueio." };

  await logAudit({
    actorId: session.user.id,
    action: "schedule_exception.deleted",
    entity: "schedule_exceptions",
    entityId: id,
  });

  return { error: null };
}

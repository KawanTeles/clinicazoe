"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";

async function requireAdmin() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") {
    throw new Error("Acesso negado.");
  }
  return session;
}

export async function createHoliday(input: { date: string; description?: string }): Promise<{
  error: string | null;
}> {
  const session = await requireAdmin();

  if (!input.date) return { error: "Informe a data do feriado." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_holidays")
    .insert({ date: input.date, description: input.description?.trim() || null })
    .select("id")
    .single();

  if (error) {
    const message = error.message.includes("duplicate") ? "Já existe um feriado nessa data." : "Não foi possível salvar o feriado.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "clinic_holiday.created",
    entity: "clinic_holidays",
    entityId: data.id,
    metadata: { date: input.date },
  });

  return { error: null };
}

export async function deleteHoliday(id: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("clinic_holidays").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o feriado." };

  await logAudit({
    actorId: session.user.id,
    action: "clinic_holiday.deleted",
    entity: "clinic_holidays",
    entityId: id,
  });

  return { error: null };
}

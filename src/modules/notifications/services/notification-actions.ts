"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) return { error: "Não foi possível marcar como lida." };
  return { error: null };
}

export async function markAllNotificationsRead(): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("read_at", null);

  if (error) return { error: "Não foi possível marcar todas como lidas." };
  return { error: null };
}

"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";
import { notifyStaff } from "@/modules/notifications/services/notify";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const { data: entry } = await supabase
    .from("financial_entries")
    .select("value")
    .eq("id", entryId)
    .single();

  const { error } = await supabase
    .from("financial_entries")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) return { error: "Não foi possível marcar como pago." };

  await logAudit({
    actorId: session.user.id,
    action: "financial_entry.paid",
    entity: "financial_entries",
    entityId: entryId,
  });

  if (session.profile.role === "profissional" && entry) {
    await notifyStaff({
      type: "financial.paid",
      title: "Pagamento registrado",
      message: `${session.profile.full_name} marcou um lançamento de R$ ${entry.value.toFixed(2)} como pago.`,
      entity: "financial_entries",
      entityId: entryId,
    });
  }

  return { error: null };
}

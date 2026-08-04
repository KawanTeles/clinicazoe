import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function notify(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  entity?: string;
  entityId?: string;
}) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    entity: params.entity,
    entity_id: params.entityId,
  });
}

/** Notifica todos os admins e recepcionistas ativos (ex.: nova consulta pendente). */
export async function notifyStaff(params: {
  type: string;
  title: string;
  message: string;
  entity?: string;
  entityId?: string;
}) {
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
}

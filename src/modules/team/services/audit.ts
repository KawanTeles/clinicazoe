import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestIp } from "@/lib/request-ip";

export async function logAudit(params: {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const ip = await getRequestIp();
  await admin.from("audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
    ip,
  });
}

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/** Extrai o IP do cliente a partir dos cabeçalhos da requisição (proxy/CDN à frente da app). Retorna null se indisponível — nunca vem do client. */
async function getRequestIp(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const forwardedFor = hdrs.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
    return hdrs.get("x-real-ip");
  } catch {
    return null;
  }
}

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

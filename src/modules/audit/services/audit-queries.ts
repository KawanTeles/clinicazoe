import { createClient } from "@/lib/supabase/server";

export async function getAuditLogs(limit = 100) {
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!logs || logs.length === 0) return [];

  const actorIds = Array.from(
    new Set(logs.map((log) => log.actor_id).filter((id): id is string => Boolean(id))),
  );

  const { data: profiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string }[] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return logs.map((log) => ({
    ...log,
    actorName: log.actor_id ? nameById.get(log.actor_id) ?? "Usuário removido" : "Sistema",
  }));
}

import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

export async function getAuditLogs(page = 1) {
  const supabase = await createClient();

  const from = (page - 1) * PAGE_SIZE;
  const { data: logs, count } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  if (!logs || logs.length === 0) return { items: [], totalPages };

  const actorIds = Array.from(
    new Set(logs.map((log) => log.actor_id).filter((id): id is string => Boolean(id))),
  );

  const { data: profiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string }[] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const items = logs.map((log) => ({
    ...log,
    actorName: log.actor_id ? nameById.get(log.actor_id) ?? "Usuário removido" : "Sistema",
  }));

  return { items, totalPages };
}

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/supabase/types";

/**
 * Busca a matriz de permissões do cargo diretamente do banco
 * (tabela role_permissions), nunca de uma constante fixa no código.
 */
export async function getPermissions(role: Role): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("permission")
    .eq("role", role)
    .eq("allowed", true);

  return new Set((data ?? []).map((row) => row.permission));
}

export async function can(role: Role, permission: string): Promise<boolean> {
  const permissions = await getPermissions(role);
  return permissions.has(permission);
}

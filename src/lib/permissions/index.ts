import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/supabase/types";

/**
 * Quem está sendo autorizado. Recebe o profile inteiro, não só o cargo, de
 * propósito: desde a Etapa 78 uma pessoa pode ser 'profissional' E acumular a
 * função de Coordenação (profiles.is_coordinator), e as permissões dela são a
 * UNIÃO dos dois conjuntos. Se a assinatura aceitasse apenas o Role, cada
 * chamada que passasse `profile.role` perderia o acúmulo em silêncio — o tipo
 * de falha que não aparece em teste, só em produção, como permissão faltando
 * pra quem deveria ter. Com o profile, o compilador cobra o dado completo.
 */
export interface PermissionSubject {
  role: Role;
  is_coordinator?: boolean | null;
}

/** Cargos cujas permissões se aplicam a este usuário, do mais específico ao acumulado. */
function rolesFor(subject: PermissionSubject): Role[] {
  const roles: Role[] = [subject.role];
  // 'coordenacao' puro já tem o próprio cargo acima; o acúmulo só existe
  // sobre 'profissional' (garantido pelo gatilho profiles_normalize_coordinator).
  if (subject.is_coordinator && subject.role === "profissional") {
    roles.push("coordenacao");
  }
  return roles;
}

/**
 * Busca a matriz de permissões do cargo diretamente do banco
 * (tabela role_permissions), nunca de uma constante fixa no código.
 */
export async function getPermissions(subject: PermissionSubject): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("permission")
    .in("role", rolesFor(subject))
    .eq("allowed", true);

  return new Set((data ?? []).map((row) => row.permission));
}

export async function can(subject: PermissionSubject, permission: string): Promise<boolean> {
  const permissions = await getPermissions(subject);
  return permissions.has(permission);
}

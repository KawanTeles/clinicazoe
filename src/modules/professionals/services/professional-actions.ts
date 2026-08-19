import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Role, Status } from "@/lib/supabase/types";

/**
 * A visibilidade pública de um profissional (getPublicWebsiteData, em
 * src/lib/public-queries.ts) é controlada só por professionals.status — a
 * query pública não olha profiles.role nem profiles.status. Sem chamar isto
 * ao editar um usuário, desativar/promover um profissional em qualquer tela
 * admin (Equipe ou Usuários) não reflete no site público: ele continua (ou
 * some) de forma dessincronizada com o que o admin configurou em profiles.
 */
export async function syncProfessionalStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  role: Role,
  status: Status,
) {
  if (role !== "profissional") {
    // Deixou de ser profissional (ex: promovido a admin) — some do site
    // público mesmo que a linha antiga em professionals ainda exista.
    await supabase.from("professionals").update({ status: "inactive" }).eq("id", id);
    return;
  }
  await supabase.from("professionals").upsert({ id, status });
}

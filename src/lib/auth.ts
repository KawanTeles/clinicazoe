import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Memoizado por requisição (React.cache): o layout do painel e a page.tsx de
// cada rota chamam getCurrentUser() de forma independente (page não recebe o
// session do layout via props). Sem isso, toda navegação pagava 2x o custo de
// autenticar — auth.getUser() sempre vai à rede validar o JWT no Supabase,
// não é leitura local de cookie — mais o select em profiles. Medição em
// produção (localhost) não mostrou ganho líquido claro de TTFB porque o
// keep-alive do cliente HTTP do Supabase já amortiza boa parte do custo de
// conexão entre chamadas within-process; mesmo assim, elimina uma chamada de
// rede genuinamente redundante por navegação — correto manter mesmo sem
// prova visual forte nesta medição específica.
export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  // "Desativar" (setUserStatus/setPatientStatus, status = 'inactive') só
  // tirava a pessoa de listas e do site público — sem checagem aqui, a
  // sessão dela continuava funcionando normalmente, contradizendo o aviso
  // já mostrado na UI ("perde acesso ao sistema imediatamente"). Sem
  // middleware.ts no projeto, este é o único funil de autenticação (painel
  // admin e área do cliente), então basta bloquear aqui.
  if (profile.status !== "active") return null;

  return { user, profile };
});

/** Garante que o usuário atual é admin, lançando erro caso contrário — usado por server actions restritas a admin. */
export async function requireAdmin() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") {
    throw new Error("Acesso negado.");
  }
  return session;
}

// Cria (ou promove) um usuário administrador.
// Uso: node --env-file=.env.local scripts/create-admin.mjs <email> <senha> ["Nome completo"]
import { createClient } from "@supabase/supabase-js";

const [, , email, password, fullName = "Administrador"] = process.argv;

if (!email || !password) {
  console.error("Uso: node --env-file=.env.local scripts/create-admin.mjs <email> <senha> [\"Nome\"]");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Desde a migration 0033 (hybrid_auth_role_hardening), handle_new_user só
// aceita role de raw_app_meta_data — user_metadata é o mesmo campo que
// supabase.auth.signUp() no client preenche, então nunca pode decidir
// cargo (senão qualquer um vira admin chamando signUp com options.data.role
// = "admin"). app_metadata só pode ser setado pela service role.
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
  app_metadata: { role: "admin" },
});

if (error) {
  console.error("Falha ao criar usuário:", error.message);
  process.exit(1);
}

const userId = data.user.id;

// GoTrue aplica o app_metadata passado ao admin.createUser() numa escrita
// separada, depois que a trigger on_auth_user_created (AFTER INSERT em
// auth.users) já disparou — então o profile sempre nasce com o role padrão
// ("paciente"), mesmo com app_metadata.role="admin" já salvo em
// auth.users. Corrige aqui: como o profile acabou de nascer, nenhuma outra
// tabela ainda referencia essa linha, então apagar e recriar com o role
// certo é seguro. Um UPDATE direto não resolveria — o trigger
// prevent_role_self_escalation bloqueia qualquer troca de role/status que
// não venha de uma sessão com is_admin() = true, e a service role (sem JWT
// de usuário autenticado) não passa nesse teste.
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", userId)
  .single();

if (profileError) {
  console.error("Usuário criado, mas falha ao conferir o cargo:", profileError.message);
  process.exit(1);
}

if (profile.role !== "admin") {
  const { error: delErr } = await supabase.from("profiles").delete().eq("id", userId);
  if (delErr) {
    console.error("Usuário criado, mas falha ao corrigir o cargo:", delErr.message);
    process.exit(1);
  }
  const { error: insErr } = await supabase
    .from("profiles")
    .insert({ id: userId, full_name: fullName, role: "admin", status: "active" });
  if (insErr) {
    console.error("Usuário criado, mas falha ao recriar o profile com o cargo correto:", insErr.message);
    process.exit(1);
  }
}

console.log("Usuário administrador criado:", userId, data.user.email);

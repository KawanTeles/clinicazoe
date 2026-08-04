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

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, role: "admin" },
});

if (error) {
  console.error("Falha ao criar usuário:", error.message);
  process.exit(1);
}

console.log("Usuário administrador criado:", data.user.id, data.user.email);

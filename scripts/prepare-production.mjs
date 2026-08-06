// Limpa os dados de demonstração/teste do banco antes da entrega ao cliente,
// preservando estrutura, migrations, policies, triggers, buckets e a conta do
// administrador informada.
//
// Estratégia: deletar cada auth.users (exceto o admin preservado) via
// supabase.auth.admin.deleteUser(). Todas as tabelas de negócio (professionals,
// patient_details, appointments, appointment_series, financial_entries,
// schedule_exceptions, professional_insurances, schedule_slots, patient_messages)
// têm FK "on delete cascade" até auth.users/profiles/professionals — deixamos o
// Postgres resolver a cascata em vez de apagar tabela por tabela na mão, que é
// o jeito de não quebrar a integridade referencial nem esquecer uma tabela nova
// que apareça em migrations futuras.
//
// O que este script NUNCA toca: clinic_settings, role_permissions, insurances,
// specialties, clinic_holidays, buckets do Storage (avatars/clinic-assets) e a
// conta do administrador informada.
//
// Uso:
//   node --env-file=.env.local scripts/prepare-production.mjs admin@clinica.com
//     -> modo dry-run (só mostra o que seria removido, não altera nada)
//   node --env-file=.env.local scripts/prepare-production.mjs admin@clinica.com --yes
//     -> executa a limpeza de fato
//
// Pode ser executado quantas vezes forem necessárias: rodar de novo depois de
// já estar limpo simplesmente não encontra nada para remover.

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const adminEmail = args.find((a) => !a.startsWith("--"));
const execute = args.includes("--yes");

if (!adminEmail) {
  console.error(
    'Uso: node --env-file=.env.local scripts/prepare-production.mjs <email-do-admin> [--yes]\n' +
      "Sem --yes o script roda em modo dry-run (não altera nada).",
  );
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Faltam variáveis de ambiente. Rode com: node --env-file=.env.local scripts/prepare-production.mjs ...",
  );
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const BUSINESS_TABLES = [
  "profiles",
  "professionals",
  "patient_details",
  "appointments",
  "appointment_series",
  "financial_entries",
  "schedule_exceptions",
  "professional_insurances",
  "schedule_slots",
  "patient_messages",
  "notifications",
  "audit_logs",
];

const CATALOG_TABLES_PRESERVED = [
  "clinic_settings",
  "role_permissions",
  "insurances",
  "specialties",
  "clinic_holidays",
  "schedule_slot_insurances",
];

async function countRows(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`Falha ao contar ${table}: ${error.message}`);
  return count ?? 0;
}

async function fetchAllAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Falha ao listar usuários: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return users;
}

async function fetchAllProfiles() {
  const profiles = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, status, full_name, avatar_path")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Falha ao listar profiles: ${error.message}`);
    profiles.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return profiles;
}

async function main() {
  console.log(`Modo: ${execute ? "EXECUÇÃO (vai apagar dados)" : "DRY-RUN (nenhuma alteração será feita)"}`);
  console.log("");

  const [authUsers, profiles] = await Promise.all([fetchAllAuthUsers(), fetchAllProfiles()]);

  const authUser = authUsers.find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase());
  if (!authUser) {
    console.error(`Nenhum usuário encontrado com o e-mail "${adminEmail}". Abortando — nenhuma alteração feita.`);
    process.exit(1);
  }

  const adminProfile = profiles.find((p) => p.id === authUser.id);
  if (!adminProfile || adminProfile.role !== "admin") {
    console.error(
      `O e-mail "${adminEmail}" existe, mas o profile associado não tem role = 'admin' (role atual: ${adminProfile?.role ?? "profile inexistente"}). Abortando.`,
    );
    process.exit(1);
  }
  if (adminProfile.status !== "active") {
    console.warn(`Aviso: a conta admin "${adminEmail}" está com status "${adminProfile.status}", não "active".`);
  }

  console.log(`Conta preservada: ${adminEmail} (id ${authUser.id}, role admin, status ${adminProfile.status})`);
  console.log("");

  const usersToDelete = authUsers.filter((u) => u.id !== authUser.id);
  const profilesToDelete = profiles.filter((p) => p.id !== authUser.id);

  const byRole = profilesToDelete.reduce((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Usuários a remover: ${usersToDelete.length}`);
  for (const [role, n] of Object.entries(byRole)) {
    console.log(`  - ${role}: ${n}`);
  }
  const orphanProfileAuthMismatch = usersToDelete.length - profilesToDelete.length;
  if (orphanProfileAuthMismatch !== 0) {
    console.log(
      `  (${usersToDelete.length} contas em auth.users vs ${profilesToDelete.length} profiles — a diferença são contas sem profile, também serão removidas)`,
    );
  }

  const avatarPaths = profilesToDelete.map((p) => p.avatar_path).filter(Boolean);
  console.log(`Avatares órfãos a remover do bucket "avatars": ${avatarPaths.length}`);
  console.log("");

  console.log("Contagem atual das tabelas de negócio:");
  for (const table of BUSINESS_TABLES) {
    console.log(`  - ${table}: ${await countRows(table)}`);
  }
  console.log("");
  console.log("Tabelas de configuração (não serão tocadas):");
  for (const table of CATALOG_TABLES_PRESERVED) {
    console.log(`  - ${table}: ${await countRows(table)}`);
  }
  console.log("");

  if (!execute) {
    console.log("Dry-run concluído. Nada foi alterado.");
    console.log("Para executar de verdade, rode novamente com --yes.");
    return;
  }

  if (usersToDelete.length === 0) {
    console.log("Nenhum usuário de teste encontrado para remover.");
  } else {
    if (avatarPaths.length > 0) {
      console.log(`Removendo ${avatarPaths.length} avatar(es) do bucket "avatars"...`);
      const { error: storageError } = await supabase.storage.from("avatars").remove(avatarPaths);
      if (storageError) {
        console.warn(`Aviso: falha ao remover alguns avatares: ${storageError.message}`);
      }
    }

    console.log(`Removendo ${usersToDelete.length} usuário(s) (cascata cuida das tabelas dependentes)...`);
    let deleted = 0;
    let failed = 0;
    for (const user of usersToDelete) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        failed += 1;
        console.warn(`  Falha ao remover ${user.email ?? user.id}: ${error.message}`);
      } else {
        deleted += 1;
      }
    }
    console.log(`  Removidos: ${deleted}. Falhas: ${failed}.`);
  }

  console.log("Limpando notificações (inclui notificações de teste endereçadas ao admin preservado)...");
  const { error: notifError } = await supabase
    .from("notifications")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (notifError) console.warn(`Aviso: falha ao limpar notifications: ${notifError.message}`);

  console.log("Limpando audit_logs (histórico de demonstração)...");
  const { error: auditError } = await supabase.from("audit_logs").delete().gte("id", 0);
  if (auditError) console.warn(`Aviso: falha ao limpar audit_logs: ${auditError.message}`);

  console.log("");
  console.log("Contagem final:");
  for (const table of BUSINESS_TABLES) {
    console.log(`  - ${table}: ${await countRows(table)}`);
  }

  const { data: finalAdmin, error: finalAdminError } = await supabase.auth.admin.getUserById(authUser.id);
  console.log("");
  if (finalAdminError || !finalAdmin?.user) {
    console.error("ATENÇÃO: não foi possível confirmar a conta admin após a limpeza! Verifique manualmente.");
  } else {
    console.log(`Conta admin confirmada: ${finalAdmin.user.email} (id ${finalAdmin.user.id}) — login preservado.`);
  }

  console.log("");
  console.log("Limpeza concluída. Validação recomendada:");
  console.log("  1. Login com a conta admin preservada.");
  console.log("  2. Conferir Agenda, Pacientes, Profissionais, Recepção, Financeiro e Solicitações vazios.");
  console.log("  3. Conferir console do navegador sem erros.");
  console.log("  4. Revisar Convênios/Especialidades manualmente na tela de admin, caso alguma seja de teste");
  console.log("     (este script não remove convênios/especialidades automaticamente, de propósito).");
}

main().catch((err) => {
  console.error("Erro inesperado:", err);
  process.exit(1);
});

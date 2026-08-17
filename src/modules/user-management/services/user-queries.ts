import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarSignedUrl } from "@/lib/supabase/storage";
import { requireAdmin } from "@/lib/auth";
import type { Database, Role } from "@/lib/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface UserListItem extends ProfileRow {
  email: string;
  avatarUrl: string | null;
}

const LIST_USERS_PAGE_SIZE = 1000;

/** Pagina auth.users até esgotar e monta um mapa id -> email (profiles não tem coluna de e-mail). */
export async function listAllAuthEmails(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const emailById = new Map<string, string>();

  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: LIST_USERS_PAGE_SIZE });
    if (error || !data) break;

    for (const user of data.users) {
      if (user.email) emailById.set(user.id, user.email);
    }

    if (data.users.length < LIST_USERS_PAGE_SIZE) break;
    page += 1;
  }

  return emailById;
}

export async function getAllUsers(): Promise<UserListItem[]> {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, emailById] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    listAllAuthEmails(),
  ]);

  const profiles = data ?? [];

  return Promise.all(
    profiles.map(async (profile) => ({
      ...profile,
      email: emailById.get(profile.id) ?? "",
      avatarUrl: await getAvatarSignedUrl(supabase, profile.avatar_path),
    })),
  );
}

export interface UserDetail {
  profile: ProfileRow;
  email: string;
  avatarUrl: string | null;
  appointmentsCount: number;
}

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!profile) return null;

  const admin = createAdminClient();
  const [{ data: authUser }, avatarUrl, appointmentsCount] = await Promise.all([
    admin.auth.admin.getUserById(id),
    getAvatarSignedUrl(supabase, profile.avatar_path),
    countUserAppointments(id, profile.role),
  ]);

  return {
    profile,
    email: authUser.user?.email ?? "",
    avatarUrl,
    appointmentsCount,
  };
}

/** Quantos administradores ativos existem — usado para nunca deixar o sistema sem admin. */
export async function countActiveAdmins(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("status", "active");
  return count ?? 0;
}

/** Consultas vinculadas ao usuário (como paciente, como profissional principal, ou como
 * coterapeuta — Etapa 36) — usado para bloquear exclusões que apagariam histórico clínico,
 * mesma cautela já aplicada ao módulo de Pacientes. Sem contar appointment_professionals, um
 * profissional que só atuou como coterapeuta passava por aqui com "0 consultas" mesmo já tendo
 * registrado evolução própria (Etapa 37) — achado C2 da varredura de segurança. */
export async function countUserAppointments(id: string, role: Role): Promise<number> {
  if (role !== "paciente" && role !== "profissional") return 0;

  const supabase = await createClient();

  if (role === "paciente") {
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", id);
    return count ?? 0;
  }

  const [principal, coTherapist] = await Promise.all([
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("professional_id", id),
    supabase.from("appointment_professionals").select("appointment_id", { count: "exact", head: true }).eq("professional_id", id),
  ]);
  return (principal.count ?? 0) + (coTherapist.count ?? 0);
}

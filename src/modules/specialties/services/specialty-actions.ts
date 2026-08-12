"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";

async function requireAdmin() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") {
    throw new Error("Acesso negado.");
  }
  return session;
}

export async function createSpecialty(name: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) return { error: "Informe o nome da especialidade." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("specialties")
    .insert({ name: trimmed })
    .select("id")
    .single();

  if (error) {
    const message =
      error.code === "23505" ? "Já existe uma especialidade com esse nome." : "Não foi possível criar a especialidade.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "specialty.created",
    entity: "specialties",
    entityId: data.id,
    metadata: { name: trimmed },
  });

  return { error: null };
}

export async function updateSpecialty(
  id: string,
  input: { name?: string; status?: "active" | "inactive" },
): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  if (input.name !== undefined && !input.name.trim()) {
    return { error: "O nome não pode ficar vazio." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("specialties")
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .eq("id", id);

  if (error) {
    const message =
      error.code === "23505" ? "Já existe uma especialidade com esse nome." : "Não foi possível salvar as alterações.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "specialty.updated",
    entity: "specialties",
    entityId: id,
    metadata: input,
  });

  return { error: null };
}

export async function deleteSpecialty(id: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  // RLS (specialties_write_admin_only) já cobre isso — client de sessão
  // basta, sem precisar de bypass via service role.
  const supabase = await createClient();
  const { error } = await supabase.from("specialties").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir esta especialidade." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "specialty.deleted",
    entity: "specialties",
    entityId: id,
  });

  return { error: null };
}

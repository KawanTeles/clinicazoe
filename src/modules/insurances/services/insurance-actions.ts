"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";
import { revalidatePublicInsurancePages } from "@/lib/revalidate-public-site";

async function requireAdmin() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") {
    throw new Error("Acesso negado.");
  }
  return session;
}

export async function createInsurance(name: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) return { error: "Informe o nome do convênio." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insurances")
    .insert({ name: trimmed })
    .select("id")
    .single();

  if (error) {
    const message = error.code === "23505" ? "Já existe um convênio com esse nome." : "Não foi possível criar o convênio.";
    return { error: message };
  }

  revalidatePublicInsurancePages();

  await logAudit({
    actorId: session.user.id,
    action: "insurance.created",
    entity: "insurances",
    entityId: data.id,
    metadata: { name: trimmed },
  });

  return { error: null };
}

export async function updateInsurance(
  id: string,
  input: { name?: string; status?: "active" | "inactive" },
): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  if (input.name !== undefined && !input.name.trim()) {
    return { error: "O nome não pode ficar vazio." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("insurances")
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .eq("id", id);

  if (error) {
    const message = error.code === "23505" ? "Já existe um convênio com esse nome." : "Não foi possível salvar as alterações.";
    return { error: message };
  }

  revalidatePublicInsurancePages();

  await logAudit({
    actorId: session.user.id,
    action: "insurance.updated",
    entity: "insurances",
    entityId: id,
    metadata: input,
  });

  return { error: null };
}

export async function deleteInsurance(id: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  // RLS (insurances_write_admin_only) já cobre isso — client de sessão
  // basta, sem precisar de bypass via service role.
  const supabase = await createClient();
  const { error } = await supabase.from("insurances").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir este convênio." };
  }

  revalidatePublicInsurancePages();

  await logAudit({
    actorId: session.user.id,
    action: "insurance.deleted",
    entity: "insurances",
    entityId: id,
  });

  return { error: null };
}

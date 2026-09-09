"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/modules/team/services/audit";
import { revalidatePublicInsurancePages } from "@/lib/revalidate-public-site";

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

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
  const { data: last } = await supabase
    .from("insurances")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.display_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("insurances")
    .insert({ name: trimmed, display_order: nextOrder })
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

export async function reorderInsurances(orderedIds: string[]): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("insurances").update({ display_order: index }).eq("id", id)),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    return { error: "Não foi possível reordenar os convênios." };
  }

  revalidatePublicInsurancePages();

  await logAudit({
    actorId: session.user.id,
    action: "insurance.reordered",
    entity: "insurances",
    metadata: { order: orderedIds },
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

export async function uploadInsuranceLogo(id: string, formData: FormData): Promise<{ error: string | null }> {
  const session = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Nenhum arquivo selecionado." };
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: "Formato inválido. Envie PNG, JPG, WEBP ou SVG." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "Arquivo muito grande. Limite de 2MB." };
  }

  const admin = createAdminClient();
  // Extensão vem do MIME já validado (ALLOWED_LOGO_TYPES acima), não do
  // nome do arquivo — file.name é controlado pelo client.
  const extension = LOGO_EXTENSION_BY_MIME[file.type] ?? "png";
  const path = `${id}.${extension}`;

  const { error: uploadError } = await admin.storage
    .from("insurance-logos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: "Falha ao enviar o logo. Tente novamente." };

  const { error: updateError } = await admin
    .from("insurances")
    .update({ logo_path: path })
    .eq("id", id);

  if (updateError) return { error: "Logo enviado, mas houve falha ao salvar." };

  await logAudit({
    actorId: session.user.id,
    action: "insurance.logo_updated",
    entity: "insurances",
    entityId: id,
  });
  revalidatePublicInsurancePages();

  return { error: null };
}

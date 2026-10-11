"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/modules/team/services/audit";
import { revalidatePublicInsurancePages } from "@/lib/revalidate-public-site";
import { processImageToWebp } from "@/lib/images/process-image";

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_MAX_DIMENSION = 500;
const LOGO_QUALITY = 85;

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
    return { error: "Arquivo muito grande. Limite de 5MB." };
  }

  const admin = createAdminClient();

  // SVG é vetorial — redimensionar/converter pra WebP não faz sentido.
  const isSvg = file.type === "image/svg+xml";
  const path = isSvg ? `${id}.svg` : `${id}.webp`;
  const uploadBody = isSvg
    ? file
    : (await processImageToWebp(Buffer.from(await file.arrayBuffer()), {
        maxDimension: LOGO_MAX_DIMENSION,
        quality: LOGO_QUALITY,
      })).buffer;

  const { error: uploadError } = await admin.storage.from("insurance-logos").upload(path, uploadBody, {
    upsert: true,
    contentType: isSvg ? file.type : "image/webp",
    cacheControl: "31536000",
  });

  if (uploadError) return { error: "Falha ao enviar o logo. Tente novamente." };

  // Best-effort: remove extensão antiga (de antes desta etapa de otimização,
  // ou trocar PNG<->SVG) — path é fixo por convênio, então upsert não limpa
  // sozinho um arquivo salvo antes com outra extensão.
  const legacyLogoPaths = [`${id}.png`, `${id}.jpg`, `${id}.webp`, `${id}.svg`].filter((p) => p !== path);
  await admin.storage.from("insurance-logos").remove(legacyLogoPaths);

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

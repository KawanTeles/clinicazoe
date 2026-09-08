"use server";

import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/modules/team/services/audit";
import { revalidatePublicGalleryPages } from "@/lib/revalidate-public-site";

const ALLOWED_GALLERY_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_GALLERY_BYTES = 5 * 1024 * 1024;

const GALLERY_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

type ActionResult = { error: string | null };

export async function uploadGalleryImages(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) return { error: "Nenhum arquivo selecionado." };

  for (const file of files) {
    if (!ALLOWED_GALLERY_TYPES.includes(file.type)) {
      return { error: "Formato inválido. Envie PNG, JPG ou WEBP." };
    }
    if (file.size > MAX_GALLERY_BYTES) {
      return { error: "Arquivo muito grande. Limite de 5MB por imagem." };
    }
  }

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("clinic_gallery_images")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextOrder = (last?.display_order ?? -1) + 1;

  const uploadedPaths: string[] = [];

  for (const file of files) {
    // Extensão vem do MIME já validado (ALLOWED_GALLERY_TYPES acima), não do
    // nome do arquivo — file.name é controlado pelo client.
    const extension = GALLERY_EXTENSION_BY_MIME[file.type] ?? "jpg";
    const path = `${randomUUID()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from("clinic-gallery")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      await admin.storage.from("clinic-gallery").remove(uploadedPaths);
      return { error: "Falha ao enviar uma das imagens. Tente novamente." };
    }
    uploadedPaths.push(path);

    const { error: insertError } = await admin
      .from("clinic_gallery_images")
      .insert({ storage_path: path, display_order: nextOrder });
    if (insertError) {
      await admin.storage.from("clinic-gallery").remove(uploadedPaths);
      return { error: "Imagem enviada, mas houve falha ao salvar." };
    }
    nextOrder += 1;
  }

  await logAudit({
    actorId: session.user.id,
    action: "clinic_gallery.images_uploaded",
    entity: "clinic_gallery_images",
    metadata: { count: files.length },
  });
  revalidatePublicGalleryPages();

  return { error: null };
}

export async function updateGalleryImageAlt(id: string, altText: string): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_gallery_images")
    .update({ alt_text: altText.trim() || null })
    .eq("id", id);

  if (error) return { error: "Não foi possível salvar o texto alternativo." };

  await logAudit({
    actorId: session.user.id,
    action: "clinic_gallery.alt_updated",
    entity: "clinic_gallery_images",
    entityId: id,
  });
  revalidatePublicGalleryPages();

  return { error: null };
}

export async function reorderGalleryImages(orderedIds: string[]): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("clinic_gallery_images").update({ display_order: index }).eq("id", id)),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) return { error: "Não foi possível reordenar as imagens." };

  await logAudit({
    actorId: session.user.id,
    action: "clinic_gallery.reordered",
    entity: "clinic_gallery_images",
    metadata: { order: orderedIds },
  });
  revalidatePublicGalleryPages();

  return { error: null };
}

export async function deleteGalleryImage(id: string): Promise<ActionResult> {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { error: "Acesso negado." };

  const admin = createAdminClient();
  const { data: image } = await admin
    .from("clinic_gallery_images")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("clinic_gallery_images").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir esta imagem." };

  if (image?.storage_path) {
    await admin.storage.from("clinic-gallery").remove([image.storage_path]);
  }

  await logAudit({
    actorId: session.user.id,
    action: "clinic_gallery.deleted",
    entity: "clinic_gallery_images",
    entityId: id,
  });
  revalidatePublicGalleryPages();

  return { error: null };
}

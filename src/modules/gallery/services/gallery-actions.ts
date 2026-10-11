"use server";

import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/modules/team/services/audit";
import { revalidatePublicGalleryPages } from "@/lib/revalidate-public-site";
import { processImageToWebp } from "@/lib/images/process-image";

const ALLOWED_GALLERY_TYPES = ["image/png", "image/jpeg", "image/webp"];
// A foto original pode ser grande (ex.: celular) — o que fica salvo é a
// versão já redimensionada/comprimida abaixo.
const MAX_GALLERY_BYTES = 10 * 1024 * 1024;
const GALLERY_MAX_DIMENSION = 1600;
const GALLERY_QUALITY = 78;

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
      return { error: "Arquivo muito grande. Limite de 10MB por imagem." };
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
    const path = `${randomUUID()}.webp`;
    let processed;
    try {
      processed = await processImageToWebp(Buffer.from(await file.arrayBuffer()), {
        maxDimension: GALLERY_MAX_DIMENSION,
        quality: GALLERY_QUALITY,
      });
    } catch {
      await admin.storage.from("clinic-gallery").remove(uploadedPaths);
      return { error: "Não foi possível processar uma das imagens. Tente outro arquivo." };
    }

    const { error: uploadError } = await admin.storage.from("clinic-gallery").upload(path, processed.buffer, {
      contentType: processed.contentType,
      cacheControl: "31536000",
    });
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

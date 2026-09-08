import { createClient } from "@/lib/supabase/server";
import type { GalleryImageItem } from "@/modules/gallery/components/GalleryManager";

export async function getGalleryImages(): Promise<GalleryImageItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_gallery_images")
    .select("*")
    .order("display_order");

  return (data ?? []).map((row) => ({
    id: row.id,
    url: supabase.storage.from("clinic-gallery").getPublicUrl(row.storage_path).data.publicUrl,
    alt_text: row.alt_text,
  }));
}

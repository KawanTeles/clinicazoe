import { createClient } from "@/lib/supabase/server";

export async function getClinicSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("clinic_settings").select("*").eq("id", 1).single();
  return data;
}

export async function getClinicLogoUrl(logoPath: string | null) {
  if (!logoPath) return null;
  const supabase = await createClient();
  const { data } = supabase.storage.from("clinic-assets").getPublicUrl(logoPath);
  return data.publicUrl;
}

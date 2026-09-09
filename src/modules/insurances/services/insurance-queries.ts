import { createClient } from "@/lib/supabase/server";

export async function getInsurances() {
  const supabase = await createClient();
  const { data } = await supabase.from("insurances").select("*").order("display_order");
  return data ?? [];
}

export async function getActiveInsurances() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("insurances")
    .select("id, name, logo_path")
    .eq("status", "active")
    .order("display_order");
  return data ?? [];
}

export async function getInsuranceLogoUrl(logoPath: string | null) {
  if (!logoPath) return null;
  const supabase = await createClient();
  const { data } = supabase.storage.from("insurance-logos").getPublicUrl(logoPath);
  return data.publicUrl;
}

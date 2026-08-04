import { createClient } from "@/lib/supabase/server";

export async function getSpecialties() {
  const supabase = await createClient();
  const { data } = await supabase.from("specialties").select("*").order("name");
  return data ?? [];
}

export async function getActiveSpecialties() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("specialties")
    .select("id, name")
    .eq("status", "active")
    .order("name");
  return data ?? [];
}

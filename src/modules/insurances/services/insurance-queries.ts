import { createClient } from "@/lib/supabase/server";

export async function getInsurances() {
  const supabase = await createClient();
  const { data } = await supabase.from("insurances").select("*").order("name");
  return data ?? [];
}

export async function getActiveInsurances() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("insurances")
    .select("id, name")
    .eq("status", "active")
    .order("name");
  return data ?? [];
}

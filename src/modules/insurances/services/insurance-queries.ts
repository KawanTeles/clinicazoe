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
    .select("id, name")
    .eq("status", "active")
    .order("display_order");
  return data ?? [];
}

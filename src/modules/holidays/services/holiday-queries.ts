import { createClient } from "@/lib/supabase/server";

export async function getHolidays() {
  const supabase = await createClient();
  const { data } = await supabase.from("clinic_holidays").select("*").order("date");
  return data ?? [];
}

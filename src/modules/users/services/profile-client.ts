import { createClient } from "@/lib/supabase/client";

export async function updateOwnProfile(userId: string, values: { full_name: string; phone: string }) {
  const supabase = createClient();
  return supabase
    .from("profiles")
    .update({ full_name: values.full_name, phone: values.phone || null })
    .eq("id", userId);
}

export async function updateOwnPassword(password: string): Promise<{ error: string | null }> {
  if (password.length < 8) {
    return { error: "A senha precisa ter ao menos 8 caracteres." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Não foi possível alterar a senha. Tente novamente." };
  }

  return { error: null };
}

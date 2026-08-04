import { createClient } from "@/lib/supabase/client";

export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = createClient();
  return supabase.auth.signOut();
}

export async function signUpPatient(params: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}) {
  const supabase = createClient();
  return supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
      data: { full_name: params.fullName, phone: params.phone },
    },
  });
}

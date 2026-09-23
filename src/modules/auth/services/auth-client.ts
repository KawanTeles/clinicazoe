import { createClient } from "@/lib/supabase/client";

export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = createClient();
  return supabase.auth.signOut();
}

export async function signInWithGoogle(fromPath?: string) {
  const supabase = createClient();
  const redirectTo = new URL("/auth/confirm", window.location.origin);
  if (fromPath) {
    redirectTo.searchParams.set("from", fromPath);
  }

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo.toString() },
  });
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

export async function requestPasswordReset(email: string) {
  const supabase = createClient();
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
}

/** Só funciona com uma sessão de recuperação ativa (ver /auth/reset-password). */
export async function updatePassword(password: string) {
  const supabase = createClient();
  return supabase.auth.updateUser({ password });
}

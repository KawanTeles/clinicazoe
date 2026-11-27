import { createClient } from "@/lib/supabase/client";

export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = createClient();
  const result = await supabase.auth.signOut();
  clearServiceWorkerCaches();
  return result;
}

/** Defesa extra de privacidade no PWA: o service worker (public/sw.js) já
 * não cacheia nada autenticado, mas no logout limpamos o Cache Storage
 * mesmo assim — nenhum dado deve sobreviver no aparelho depois que a
 * pessoa sai da conta. */
function clearServiceWorkerCaches() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage("clear-caches");
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

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import type { Role } from "./types";

const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Resolve a URL de exibição de um avatar. Foto de profissional (role
 * "profissional") é institucional, não dado sensível — vive no bucket
 * público `professional-avatars` (Etapa 72) e usa URL pública direta e
 * estável, cacheável pelo navegador/CDN. Qualquer outro role (paciente,
 * recepcionista, admin) continua no bucket privado `avatars`, por signed
 * URL com TTL curto — mesmo comportamento de antes desta etapa.
 *
 * Passar `role` incorretamente como "profissional" para um avatar que na
 * verdade está só no bucket privado simplesmente resulta em URL pública
 * que 404 — por isso todo call site deve usar o role real do profile.
 */
export async function getAvatarDisplayUrl(
  supabase: SupabaseClient<Database>,
  avatarPath: string | null,
  role?: Role | null,
  /** Foto externa (ex.: Google OAuth) usada quando não há upload em avatar_path. */
  fallbackAvatarUrl?: string | null,
) {
  if (!avatarPath) return fallbackAvatarUrl ?? null;

  if (role === "profissional") {
    const { data } = supabase.storage.from("professional-avatars").getPublicUrl(avatarPath);
    return data.publicUrl;
  }

  const { data } = await supabase.storage
    .from("avatars")
    .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL_SECONDS);

  return data?.signedUrl ?? fallbackAvatarUrl ?? null;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function getAvatarSignedUrl(
  supabase: SupabaseClient<Database>,
  avatarPath: string | null,
  /** Foto externa (ex.: Google OAuth) usada quando não há upload em avatar_path. */
  fallbackAvatarUrl?: string | null,
) {
  if (!avatarPath) return fallbackAvatarUrl ?? null;

  const { data } = await supabase.storage
    .from("avatars")
    .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL_SECONDS);

  return data?.signedUrl ?? fallbackAvatarUrl ?? null;
}

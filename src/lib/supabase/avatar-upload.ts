import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { processImageToWebp } from "@/lib/images/process-image";

const ALLOWED_AVATAR_INPUT_TYPES = ["image/png", "image/jpeg", "image/webp"];
// A foto original enviada pode ser grande (ex.: foto de celular, 5MB+) — o
// que importa é o tamanho depois do processamento abaixo, não o do upload.
const MAX_AVATAR_INPUT_BYTES = 8 * 1024 * 1024;
const AVATAR_MAX_DIMENSION = 1000;
const AVATAR_QUALITY = 80;
const LEGACY_AVATAR_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export interface SaveAvatarResult {
  error: string | null;
  path?: string;
}

/**
 * Processa (resize a 1000px no lado maior + WebP qualidade 80 + remove
 * metadados) e salva a foto de perfil de `targetUserId`, escolhendo o
 * bucket pelo role atual do profile: profissional vai para o bucket público
 * `professional-avatars` (Etapa 72, foto institucional, cacheável); qualquer
 * outro role (paciente/recepcionista/admin) vai para o bucket privado
 * `avatars`, como sempre foi — dado pessoal, não institucional.
 *
 * Aceita tanto um client de sessão (upload em nome do próprio usuário,
 * governado por RLS) quanto o client admin (service role, usado quando é a
 * administradora enviando a foto de outra pessoa).
 *
 * Limpeza de arquivos legados é best-effort: nem toda extensão antiga existe
 * de fato, e um client de sessão pode não ter policy de delete no bucket
 * "errado" — falha ao limpar nunca impede o upload novo de ter sucesso.
 */
export async function saveProfileAvatar(
  supabase: SupabaseClient<Database>,
  targetUserId: string,
  file: File,
): Promise<SaveAvatarResult> {
  if (!ALLOWED_AVATAR_INPUT_TYPES.includes(file.type)) {
    return { error: "Formato inválido. Envie PNG, JPG ou WEBP." };
  }
  if (file.size === 0 || file.size > MAX_AVATAR_INPUT_BYTES) {
    return { error: "Arquivo muito grande. Limite de 8MB." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .single();
  if (profileError || !profile) {
    return { error: "Perfil não encontrado." };
  }

  let processed;
  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    processed = await processImageToWebp(inputBuffer, {
      maxDimension: AVATAR_MAX_DIMENSION,
      quality: AVATAR_QUALITY,
    });
  } catch {
    return { error: "Não foi possível processar essa imagem. Tente outro arquivo." };
  }

  const bucket = profile.role === "profissional" ? "professional-avatars" : "avatars";
  const otherBucket = bucket === "professional-avatars" ? "avatars" : "professional-avatars";
  const path = `${targetUserId}/avatar.webp`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, processed.buffer, {
    upsert: true,
    contentType: processed.contentType,
    cacheControl: bucket === "professional-avatars" ? "31536000" : "3600",
  });
  if (uploadError) {
    return { error: "Falha ao enviar a foto. Tente novamente." };
  }

  const legacyPathsInBucket = LEGACY_AVATAR_EXTENSIONS.map((ext) => `${targetUserId}/avatar.${ext}`).filter(
    (legacyPath) => legacyPath !== path,
  );
  await Promise.allSettled([
    supabase.storage.from(bucket).remove(legacyPathsInBucket),
    supabase.storage.from(otherBucket).remove([...legacyPathsInBucket, path]),
  ]);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", targetUserId);
  if (updateError) {
    return { error: "Foto enviada, mas houve falha ao salvar o perfil." };
  }

  return { error: null, path };
}

import { createClient } from "@/lib/supabase/client";

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function updateOwnProfile(userId: string, values: { full_name: string; phone: string }) {
  const supabase = createClient();
  return supabase
    .from("profiles")
    .update({ full_name: values.full_name, phone: values.phone || null })
    .eq("id", userId);
}

export async function uploadAvatar(userId: string, file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Formato inválido. Envie PNG, JPG ou WEBP." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Arquivo muito grande. Limite de 3MB." };
  }

  const supabase = createClient();
  const extension = file.name.split(".").pop();
  const path = `${userId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: "Falha ao enviar a foto. Tente novamente." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", userId);

  if (updateError) {
    return { error: "Foto enviada, mas houve falha ao salvar o perfil." };
  }

  return { error: null, path };
}

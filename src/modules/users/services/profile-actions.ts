"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveProfileAvatar } from "@/lib/supabase/avatar-upload";
import { revalidatePublicSite } from "@/lib/revalidate-public-site";

/**
 * Upload da própria foto de perfil (qualquer role) — Server Action porque o
 * processamento de imagem (resize/WebP, Etapa 72) usa `sharp`, que só roda
 * no servidor. userId vem sempre da sessão, nunca de input do client: o
 * usuário só pode trocar a própria foto por esta tela.
 */
export async function uploadOwnAvatar(formData: FormData): Promise<{ error: string | null; path?: string }> {
  const session = await getCurrentUser();
  if (!session) return { error: "Acesso negado." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Nenhum arquivo selecionado." };
  }

  const supabase = await createClient();
  const result = await saveProfileAvatar(supabase, session.user.id, file);

  if (!result.error) {
    // A foto pode ser de um profissional (avatar aparece publicamente em
    // /profissionais) mesmo trocada por esta tela genérica de perfil.
    revalidatePublicSite();
  }

  return result;
}

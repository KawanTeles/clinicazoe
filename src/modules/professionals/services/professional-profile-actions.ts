"use server";

import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePublicSite } from "@/lib/revalidate-public-site";

const MAX_BIO_LENGTH = 500;

/**
 * Permite que o próprio profissional logado edite sua biografia — a mesma
 * coluna que a administradora já edita em /team/[id]. Especialidade,
 * convênios e status continuam exclusivos da administradora (não expostos
 * aqui). Usa o client admin (service role) em vez de depender de uma policy
 * de UPDATE em `professionals`, restringindo por aplicação o que pode ser
 * escrito (só bio, só a própria linha) em vez de abrir a linha inteira via RLS.
 */
export async function updateOwnProfessionalBio(bio: string): Promise<{ error: string | null }> {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    return { error: "Acesso negado." };
  }

  const trimmed = bio.trim();
  if (trimmed.length > MAX_BIO_LENGTH) {
    return { error: `A biografia deve ter no máximo ${MAX_BIO_LENGTH} caracteres.` };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("professionals")
    .update({ bio: trimmed || null })
    .eq("id", session.user.id);

  if (error) return { error: "Não foi possível salvar a biografia." };

  revalidatePublicSite();
  return { error: null };
}

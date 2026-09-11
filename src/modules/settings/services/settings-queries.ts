import { createClient } from "@/lib/supabase/server";

export async function getClinicSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("clinic_settings").select("*").eq("id", 1).single();
  return data;
}

export async function getClinicLogoUrl(logoPath: string | null) {
  if (!logoPath) return null;
  const supabase = await createClient();
  const { data } = supabase.storage.from("clinic-assets").getPublicUrl(logoPath);
  return data.publicUrl;
}

// `?v=<updated_at>` evita servir do cache do navegador uma imagem antiga:
// como o upload sempre grava no mesmo caminho (upsert), a URL pública nunca
// muda sozinha, então sem esse parâmetro o navegador continua mostrando o
// arquivo anterior mesmo depois de reenviar uma foto nova. updated_at é
// bumped pelo trigger clinic_settings_set_updated_at em qualquer alteração
// da linha (não só nas fotos) — troca a versão com folga, sem custo real
// além de um novo download da mesma imagem se outro campo mudar junto.
function withCacheBust(url: string, version?: string | null) {
  if (!version) return url;
  return `${url}?v=${encodeURIComponent(version)}`;
}

export async function getClinicFacadeImageUrl(facadeImagePath: string | null, updatedAt?: string | null) {
  if (!facadeImagePath) return null;
  const supabase = await createClient();
  const { data } = supabase.storage.from("clinic-assets").getPublicUrl(facadeImagePath);
  return withCacheBust(data.publicUrl, updatedAt);
}

export async function getClinicFacadeImageMobileUrl(facadeImageMobilePath: string | null, updatedAt?: string | null) {
  if (!facadeImageMobilePath) return null;
  const supabase = await createClient();
  const { data } = supabase.storage.from("clinic-assets").getPublicUrl(facadeImageMobilePath);
  return withCacheBust(data.publicUrl, updatedAt);
}

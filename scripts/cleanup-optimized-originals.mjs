// Limpeza pós-otimização (rodar só depois de confirmar que o site está ok
// com as imagens novas): apaga os arquivos ORIGINAIS que o
// optimize-existing-storage.mjs manteve de propósito como backup.
//
// Critério de segurança: nunca apaga pelo nome "parece antigo" — sempre
// confere contra o banco (clinic_settings/clinic_gallery_images/insurances/
// profiles) o que está DE FATO em uso hoje, e só remove o que não é mais
// referenciado por nenhuma linha.
//
// Uso: node --env-file=.env.local scripts/cleanup-optimized-originals.mjs

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function listAll(bucket, prefix = "") {
  const all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        all.push(...(await listAll(bucket, fullPath)));
      } else {
        all.push(fullPath);
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

async function cleanupClinicAssets() {
  const { data: clinic } = await supabase.from("clinic_settings").select("*").eq("id", 1).single();
  const keep = new Set([clinic?.logo_path, clinic?.facade_image_path, clinic?.facade_image_mobile_path].filter(Boolean));
  const all = await listAll("clinic-assets");
  const toRemove = all.filter((p) => !keep.has(p));
  if (toRemove.length > 0) {
    const { error } = await supabase.storage.from("clinic-assets").remove(toRemove);
    if (error) throw new Error(`remove clinic-assets: ${error.message}`);
  }
  console.log(`[clinic-assets] mantidos: ${[...keep].join(", ")}`);
  console.log(`[clinic-assets] removidos (${toRemove.length}): ${toRemove.join(", ") || "(nenhum)"}`);
}

async function cleanupGallery() {
  const { data: images } = await supabase.from("clinic_gallery_images").select("storage_path");
  const keep = new Set((images ?? []).map((i) => i.storage_path));
  const all = await listAll("clinic-gallery");
  const toRemove = all.filter((p) => !keep.has(p));
  if (toRemove.length > 0) {
    const { error } = await supabase.storage.from("clinic-gallery").remove(toRemove);
    if (error) throw new Error(`remove clinic-gallery: ${error.message}`);
  }
  console.log(`[clinic-gallery] removidos (${toRemove.length}): ${toRemove.join(", ") || "(nenhum)"}`);
}

async function cleanupInsuranceLogos() {
  const { data: insurances } = await supabase.from("insurances").select("logo_path");
  const keep = new Set((insurances ?? []).map((i) => i.logo_path).filter(Boolean));
  const all = await listAll("insurance-logos");
  const toRemove = all.filter((p) => !keep.has(p));
  if (toRemove.length > 0) {
    const { error } = await supabase.storage.from("insurance-logos").remove(toRemove);
    if (error) throw new Error(`remove insurance-logos: ${error.message}`);
  }
  console.log(`[insurance-logos] removidos (${toRemove.length}): ${toRemove.join(", ") || "(nenhum)"}`);
}

async function cleanupAvatars() {
  // Qualquer profile cujo avatar_path atual é servido por professional-avatars
  // (role profissional, já migrado) deixa de precisar do arquivo irmão que
  // ficou para trás no bucket privado "avatars".
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "profissional")
    .not("avatar_path", "is", null);

  const toRemove = [];
  for (const profile of profiles ?? []) {
    const files = await listAll("avatars", profile.id);
    toRemove.push(...files);
  }
  if (toRemove.length > 0) {
    const { error } = await supabase.storage.from("avatars").remove(toRemove);
    if (error) throw new Error(`remove avatars: ${error.message}`);
  }
  console.log(`[avatars] removidos (${toRemove.length}): ${toRemove.join(", ") || "(nenhum)"}`);
}

async function main() {
  await cleanupClinicAssets();
  await cleanupGallery();
  await cleanupInsuranceLogos();
  await cleanupAvatars();
  console.log("\nLimpeza concluída.");
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});

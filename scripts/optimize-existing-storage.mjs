// Script único (Parte 3, item 9 do pedido de performance de imagens): otimiza
// as imagens que já estão no Storage com as mesmas regras aplicadas a partir
// de agora em todo upload novo (resize + WebP + remove metadados).
//
// Por padrão roda em DRY-RUN: baixa cada arquivo, processa em memória, mostra
// o antes/depois de tamanho — não escreve nada no Storage nem no banco.
// Só com --apply ele de fato envia a versão otimizada (upload NOVO; nenhum
// arquivo original é apagado por este script — isso fica para uma limpeza
// manual posterior, depois de confirmado que está tudo certo).
//
// Uso:
//   node --env-file=.env.local scripts/optimize-existing-storage.mjs
//     -> dry-run (padrão), só mostra o relatório
//   node --env-file=.env.local scripts/optimize-existing-storage.mjs --apply
//     -> aplica de verdade (upload da versão otimizada + atualiza o banco)

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { randomUUID } from "crypto";

const APPLY = process.argv.includes("--apply");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function processToWebp(buffer, maxDimension, quality) {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

async function downloadFile(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw new Error(`Falha ao baixar ${bucket}/${path}: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

const report = [];

function record(category, label, beforeBytes, afterBytes) {
  report.push({ category, label, beforeBytes, afterBytes });
}

// --- clinic-assets: logo, facade, facade-mobile ---------------------------
async function processClinicAssets() {
  const { data: clinic } = await supabase.from("clinic_settings").select("*").eq("id", 1).single();
  if (!clinic) return;

  const jobs = [
    { field: "logo_path", newPath: "logo.webp", maxDimension: 600, quality: 85, label: "logo" },
    { field: "facade_image_path", newPath: "facade.webp", maxDimension: 1600, quality: 78, label: "facade" },
    {
      field: "facade_image_mobile_path",
      newPath: "facade-mobile.webp",
      maxDimension: 1600,
      quality: 78,
      label: "facade-mobile",
    },
  ];

  for (const job of jobs) {
    const currentPath = clinic[job.field];
    if (!currentPath) continue;
    if (currentPath === job.newPath) {
      console.log(`  [clinic-assets] ${job.label}: já otimizado (${currentPath}), pulando.`);
      continue;
    }
    // Logo pode ser SVG — vetorial, não processa.
    if (currentPath.endsWith(".svg")) {
      console.log(`  [clinic-assets] ${job.label}: é SVG (${currentPath}), não precisa de otimização raster.`);
      continue;
    }

    const original = await downloadFile("clinic-assets", currentPath);
    const optimized = await processToWebp(original, job.maxDimension, job.quality);
    record("clinic-assets", job.label, original.length, optimized.length);

    if (APPLY) {
      const { error: uploadError } = await supabase.storage
        .from("clinic-assets")
        .upload(job.newPath, optimized, { upsert: true, contentType: "image/webp", cacheControl: "31536000" });
      if (uploadError) throw new Error(`Falha ao subir ${job.newPath}: ${uploadError.message}`);

      const { error: updateError } = await supabase
        .from("clinic_settings")
        .update({ [job.field]: job.newPath })
        .eq("id", 1);
      if (updateError) throw new Error(`Falha ao atualizar clinic_settings.${job.field}: ${updateError.message}`);

      console.log(`  [clinic-assets] ${job.label}: aplicado -> ${job.newPath}`);
    }
  }
}

// --- clinic-gallery: cada foto vira um novo arquivo otimizado -------------
async function processGallery() {
  const { data: images } = await supabase.from("clinic_gallery_images").select("id, storage_path");
  for (const image of images ?? []) {
    if (image.storage_path.endsWith(".webp")) {
      console.log(`  [clinic-gallery] ${image.storage_path}: já é webp, pulando.`);
      continue;
    }
    const original = await downloadFile("clinic-gallery", image.storage_path);
    const optimized = await processToWebp(original, 1600, 78);
    record("clinic-gallery", image.storage_path, original.length, optimized.length);

    if (APPLY) {
      const newPath = `${randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("clinic-gallery")
        .upload(newPath, optimized, { contentType: "image/webp", cacheControl: "31536000" });
      if (uploadError) throw new Error(`Falha ao subir ${newPath}: ${uploadError.message}`);

      const { error: updateError } = await supabase
        .from("clinic_gallery_images")
        .update({ storage_path: newPath })
        .eq("id", image.id);
      if (updateError) throw new Error(`Falha ao atualizar clinic_gallery_images ${image.id}: ${updateError.message}`);

      console.log(`  [clinic-gallery] ${image.storage_path} -> ${newPath}`);
    }
  }
}

// --- insurance-logos --------------------------------------------------------
async function processInsuranceLogos() {
  const { data: insurances } = await supabase.from("insurances").select("id, logo_path");
  for (const insurance of insurances ?? []) {
    if (!insurance.logo_path) continue;
    const newPath = `${insurance.id}.webp`;
    if (insurance.logo_path === newPath) {
      console.log(`  [insurance-logos] ${insurance.id}: já otimizado, pulando.`);
      continue;
    }
    if (insurance.logo_path.endsWith(".svg")) {
      console.log(`  [insurance-logos] ${insurance.id}: é SVG, não precisa de otimização raster.`);
      continue;
    }

    const original = await downloadFile("insurance-logos", insurance.logo_path);
    const optimized = await processToWebp(original, 500, 85);
    record("insurance-logos", insurance.logo_path, original.length, optimized.length);

    if (APPLY) {
      const { error: uploadError } = await supabase.storage
        .from("insurance-logos")
        .upload(newPath, optimized, { upsert: true, contentType: "image/webp", cacheControl: "31536000" });
      if (uploadError) throw new Error(`Falha ao subir ${newPath}: ${uploadError.message}`);

      const { error: updateError } = await supabase
        .from("insurances")
        .update({ logo_path: newPath })
        .eq("id", insurance.id);
      if (updateError) throw new Error(`Falha ao atualizar insurances ${insurance.id}: ${updateError.message}`);

      console.log(`  [insurance-logos] ${insurance.logo_path} -> ${newPath}`);
    }
  }
}

// --- avatars de profissional: migram para o bucket público novo -----------
async function processProfessionalAvatars() {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, avatar_path")
    .eq("role", "profissional")
    .not("avatar_path", "is", null);

  for (const profile of profiles ?? []) {
    const original = await downloadFile("avatars", profile.avatar_path);
    const optimized = await processToWebp(original, 1000, 80);
    record("avatars->professional-avatars", profile.avatar_path, original.length, optimized.length);

    if (APPLY) {
      const newPath = `${profile.id}/avatar.webp`;
      const { error: uploadError } = await supabase.storage
        .from("professional-avatars")
        .upload(newPath, optimized, { upsert: true, contentType: "image/webp", cacheControl: "31536000" });
      if (uploadError) throw new Error(`Falha ao subir ${newPath}: ${uploadError.message}`);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_path: newPath })
        .eq("id", profile.id);
      if (updateError) throw new Error(`Falha ao atualizar profiles ${profile.id}: ${updateError.message}`);

      console.log(`  [avatars] ${profile.id}: migrado para professional-avatars/${newPath}`);
      console.log(`    (original mantido em avatars/${profile.avatar_path} — remover manualmente só depois de confirmar)`);
    }
  }
}

async function main() {
  console.log(`Modo: ${APPLY ? "APLICAR (faz upload + atualiza banco)" : "DRY-RUN (só mede, não altera nada)"}`);
  console.log("Nenhum arquivo original é apagado por este script, em nenhum modo.\n");

  console.log("Processando clinic-assets (logo, capa, capa mobile)...");
  await processClinicAssets();
  console.log("Processando clinic-gallery (fotos do espaço)...");
  await processGallery();
  console.log("Processando insurance-logos (logos de convênio)...");
  await processInsuranceLogos();
  console.log("Processando avatars de profissional (migração para bucket público)...");
  await processProfessionalAvatars();

  const totalBefore = report.reduce((sum, r) => sum + r.beforeBytes, 0);
  const totalAfter = report.reduce((sum, r) => sum + r.afterBytes, 0);

  console.log("\n=== RELATÓRIO POR ARQUIVO ===");
  for (const r of report) {
    const pct = (((r.beforeBytes - r.afterBytes) / r.beforeBytes) * 100).toFixed(0);
    console.log(
      `[${r.category}] ${r.label}: ${(r.beforeBytes / 1024).toFixed(0)}KB -> ${(r.afterBytes / 1024).toFixed(0)}KB (-${pct}%)`,
    );
  }

  console.log("\n=== TOTAL ===");
  console.log(`Antes:  ${(totalBefore / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Depois: ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Economia: ${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}%`);

  if (!APPLY) {
    console.log("\nDry-run concluído — nada foi alterado. Rode com --apply para aplicar de verdade.");
  }
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});

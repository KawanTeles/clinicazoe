// Script de investigação (somente leitura) — lista arquivos e tamanhos em
// todos os buckets do Storage para o levantamento de peso de imagens do site
// público. Não apaga nem altera nada.
//
// Uso: node --env-file=.env.local scripts/audit-storage-sizes.mjs

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
if (bucketsError) {
  console.error("Falha ao listar buckets:", bucketsError.message);
  process.exit(1);
}

async function listAllFiles(bucketId, prefix = "") {
  const all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(bucketId).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      console.error(`  erro ao listar ${bucketId}/${prefix}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        // É uma "pasta" (sem metadata própria) — desce recursivamente.
        const nested = await listAllFiles(bucketId, fullPath);
        all.push(...nested);
      } else {
        all.push({ path: fullPath, size: entry.metadata?.size ?? 0, mimetype: entry.metadata?.mimetype ?? "?" });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

const results = [];

for (const bucket of buckets) {
  const files = await listAllFiles(bucket.id);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  results.push({ bucket: bucket.id, public: bucket.public, fileCount: files.length, totalBytes, files });
}

console.log("\n=== RESUMO POR BUCKET ===");
for (const r of results) {
  console.log(
    `${r.bucket.padEnd(20)} público=${String(r.public).padEnd(5)} arquivos=${String(r.fileCount).padEnd(5)} total=${(r.totalBytes / 1024 / 1024).toFixed(2)} MB`,
  );
}

const allFiles = results.flatMap((r) => r.files.map((f) => ({ ...f, bucket: r.bucket })));
allFiles.sort((a, b) => b.size - a.size);

console.log("\n=== TOP 15 ARQUIVOS MAIS PESADOS (todos os buckets) ===");
for (const f of allFiles.slice(0, 15)) {
  console.log(`${(f.size / 1024).toFixed(0).padStart(7)} KB  [${f.bucket}] ${f.path}  (${f.mimetype})`);
}

const grandTotal = results.reduce((sum, r) => sum + r.totalBytes, 0);
console.log(`\nTOTAL GERAL: ${(grandTotal / 1024 / 1024).toFixed(2)} MB em ${allFiles.length} arquivos`);

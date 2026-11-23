"use server";

import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { sniffImageType } from "@/lib/images/sniff-image-type";
import { sniffDocumentType } from "@/lib/images/sniff-document-type";
import { processImageToWebp } from "@/lib/images/process-image";

const BUCKET = "payment-proofs";
const SIGNED_URL_TTL_SECONDS = 60;
const MAX_BYTES = 5 * 1024 * 1024;

async function requireFinancialStaff() {
  const session = await getCurrentUser();
  if (!session || !["admin", "recepcionista"].includes(session.profile.role)) {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Comprovante é sempre imagem (reprocessada em WebP, removendo EXIF/GPS,
 * mesmo pipeline de evolution-attachments) ou PDF cru — nunca o profissional
 * nem o paciente têm acesso a este bucket (RLS da migration 0087 é só
 * admin/recepcionista, por role, não por dono). */
export async function uploadPaymentProof(
  entryId: string,
  formData: FormData,
): Promise<{ error: string | null }> {
  let session;
  try {
    session = await requireFinancialStaff();
  } catch {
    return { error: "Acesso negado." };
  }

  const rateLimit = checkRateLimit(`upload-payment-proof:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Nenhum arquivo selecionado." };
  if (file.size > MAX_BYTES) return { error: `Arquivo muito grande. Limite de ${Math.round(MAX_BYTES / (1024 * 1024))}MB.` };

  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("financial_entries")
    .select("id, payment_proof_path")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Lançamento não encontrado." };

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let finalBuffer: Buffer;
  let mimeType: string;
  let extension: string;

  const sniffedImage = sniffImageType(rawBuffer);
  if (sniffedImage === "image/png" || sniffedImage === "image/jpeg" || sniffedImage === "image/webp") {
    const processed = await processImageToWebp(rawBuffer, { maxDimension: 2000, quality: 82 });
    finalBuffer = processed.buffer;
    mimeType = "image/webp";
    extension = "webp";
  } else if (sniffDocumentType(rawBuffer) === "pdf") {
    finalBuffer = rawBuffer;
    mimeType = "application/pdf";
    extension = "pdf";
  } else {
    return { error: "Formato inválido. Envie uma imagem (PNG/JPEG/WEBP) ou um PDF." };
  }

  const path = `${entryId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, finalBuffer, { upsert: false, contentType: mimeType });
  if (uploadError) return { error: "Falha ao enviar o comprovante. Tente novamente." };

  const previousPath = entry.payment_proof_path;

  const { error } = await supabase.from("financial_entries").update({ payment_proof_path: path }).eq("id", entryId);
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: "Não foi possível salvar o comprovante." };
  }

  // Substituir um comprovante anterior: remove o arquivo antigo do storage
  // depois do UPDATE confirmar a troca (mesma ordem de segurança do upload
  // de anexos — nunca apaga o antigo antes do novo estar gravado e
  // referenciado).
  if (previousPath) {
    await supabase.storage.from(BUCKET).remove([previousPath]);
  }

  await logAudit({
    actorId: session.user.id,
    action: "financial_entry.proof_uploaded",
    entity: "financial_entries",
    entityId: entryId,
    metadata: { file_size_bytes: finalBuffer.length },
  });

  return { error: null };
}

/** Link assinado de curta duração — gerado sob demanda, mesmo padrão de
 * getEvolutionAttachmentDownloadUrl (60s, nunca pré-gerado na carga da
 * página). */
export async function getPaymentProofUrl(entryId: string): Promise<{ url: string | null; error: string | null }> {
  try {
    await requireFinancialStaff();
  } catch {
    return { url: null, error: "Acesso negado." };
  }

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("financial_entries")
    .select("payment_proof_path")
    .eq("id", entryId)
    .maybeSingle();

  if (!entry?.payment_proof_path) return { url: null, error: "Nenhum comprovante anexado a este lançamento." };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(entry.payment_proof_path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return { url: null, error: "Não foi possível gerar o link do comprovante." };

  return { url: data.signedUrl, error: null };
}

"use server";

import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { sniffImageType } from "@/lib/images/sniff-image-type";
import { sniffDocumentType } from "@/lib/images/sniff-document-type";
import { processImageToWebp } from "@/lib/images/process-image";
import { ensureDraftId } from "@/modules/evolutions/services/draft-actions";
import type { EvolutionAttachmentKind } from "@/lib/supabase/types";
import {
  getAttachmentsForDraft,
  getAttachmentsForEvolution,
  type EvolutionAttachmentView,
} from "@/modules/evolutions/services/attachment-queries";

const BUCKET = "evolution-attachments";
const SIGNED_URL_TTL_SECONDS = 60;

const MAX_BYTES_BY_KIND: Record<EvolutionAttachmentKind, number> = {
  imagem: 15 * 1024 * 1024,
  documento: 10 * 1024 * 1024,
  audio: 15 * 1024 * 1024,
};

const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
]);

async function requireProfessional() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Wrappers "use server" para as duas queries de leitura — um client
 * component (AttachmentPanel, AttachmentAccessPanel) nunca pode importar
 * createClient("@/lib/supabase/server") direto, porque ele lê cookies via
 * next/headers, exclusivo de contexto de servidor. Mesmo padrão de
 * loadClinicalDocumentsForPatient em clinical-document-actions.ts. */
export async function loadAttachmentsForDraft(draftId: string): Promise<EvolutionAttachmentView[]> {
  const session = await getCurrentUser();
  if (!session) return [];
  return getAttachmentsForDraft(draftId);
}

export async function loadAttachmentsForEvolution(evolutionId: string): Promise<EvolutionAttachmentView[]> {
  const session = await getCurrentUser();
  if (!session) return [];
  return getAttachmentsForEvolution(evolutionId);
}

export interface UploadAttachmentResult {
  error: string | null;
  needsConsent?: boolean;
  draftId?: string;
  attachment?: EvolutionAttachmentView;
}

/**
 * Anexa um arquivo ao rascunho de evolução (um clique, D1). Imagem e áudio
 * exigem termo de consentimento vigente do paciente — se não houver, devolve
 * `needsConsent: true` em vez de um erro genérico, pra a tela oferecer
 * "Colher termo agora" sem o profissional precisar adivinhar o motivo.
 *
 * Imagem é SEMPRE reprocessada pelo sharp (processImageToWebp) antes de
 * subir — nunca o arquivo original — o que recomprime, redimensiona e
 * remove EXIF/GPS como efeito colateral da reconversão (mesmo pipeline dos
 * avatares/galeria). Documento (PDF) e áudio sobem como vieram: reprocessar
 * um PDF ou um áudio não faz sentido do mesmo jeito que faz para imagem.
 */
export async function uploadEvolutionAttachment(formData: FormData): Promise<UploadAttachmentResult> {
  const session = await requireProfessional();

  const rateLimit = checkRateLimit(`upload-evolution-attachment:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as EvolutionAttachmentKind;
  if (!appointmentId) return { error: "Atendimento não informado." };
  if (!["imagem", "documento", "audio"].includes(kind)) return { error: "Tipo de anexo inválido." };

  const captionRaw = formData.get("caption");
  const caption = typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim() : null;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Nenhum arquivo selecionado." };
  if (file.size > MAX_BYTES_BY_KIND[kind]) {
    return { error: `Arquivo muito grande. Limite de ${Math.round(MAX_BYTES_BY_KIND[kind] / (1024 * 1024))}MB.` };
  }

  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appointment) return { error: "Atendimento não encontrado." };

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let finalBuffer: Buffer;
  let mimeType: string;
  let extension: string;

  if (kind === "imagem") {
    const sniffed = sniffImageType(rawBuffer);
    if (sniffed !== "image/png" && sniffed !== "image/jpeg" && sniffed !== "image/webp") {
      return { error: "Formato de imagem inválido. Envie PNG, JPEG ou WEBP." };
    }
    const processed = await processImageToWebp(rawBuffer, { maxDimension: 2000, quality: 82 });
    finalBuffer = processed.buffer;
    mimeType = "image/webp";
    extension = "webp";
  } else if (kind === "documento") {
    if (sniffDocumentType(rawBuffer) !== "pdf") {
      return { error: "Formato inválido. Envie um PDF." };
    }
    finalBuffer = rawBuffer;
    mimeType = "application/pdf";
    extension = "pdf";
  } else {
    if (!ALLOWED_AUDIO_MIME.has(file.type)) {
      return { error: "Formato de áudio inválido." };
    }
    // WAV e WebM têm magic number confiável e são checados por bytes; os
    // demais containers (mp3/m4a) ficam só na checagem de Content-Type
    // declarado — mesmo nível de confiança que o pipeline de transcrição
    // (Etapa 46) já aceita para esses formatos.
    const sniffed = sniffDocumentType(rawBuffer);
    if ((file.type === "audio/wav" || file.type === "audio/x-wav") && sniffed !== "wav") {
      return { error: "Arquivo de áudio corrompido ou inválido." };
    }
    if (file.type === "audio/webm" && sniffed !== "webm") {
      return { error: "Arquivo de áudio corrompido ou inválido." };
    }
    finalBuffer = rawBuffer;
    mimeType = file.type;
    extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  }

  let consentId: string | null = null;
  if (kind === "imagem" || kind === "audio") {
    const { data: consent } = await supabase
      .from("image_consents")
      .select("id")
      .eq("patient_id", appointment.patient_id)
      .is("revoked_at", null)
      .maybeSingle();
    if (!consent) {
      return {
        error: "Nenhum termo de consentimento vigente para este paciente. Colha o termo antes de anexar imagem ou áudio.",
        needsConsent: true,
      };
    }
    consentId = consent.id;
  }

  const draftResult = await ensureDraftId(appointmentId);
  if (draftResult.error || !draftResult.draftId) {
    return { error: draftResult.error ?? "Não foi possível preparar o rascunho para o anexo." };
  }
  const draftId = draftResult.draftId;

  const attachmentId = randomUUID();
  const path = `${session.user.id}/${appointment.patient_id}/${attachmentId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, finalBuffer, { upsert: false, contentType: mimeType });
  if (uploadError) return { error: "Falha ao enviar o arquivo. Tente novamente.", draftId };

  const { data: created, error } = await supabase
    .from("evolution_attachments")
    .insert({
      id: attachmentId,
      draft_id: draftId,
      patient_id: appointment.patient_id,
      professional_id: session.user.id,
      kind,
      caption,
      file_name: file.name,
      file_path: path,
      mime_type: mimeType,
      file_size_bytes: finalBuffer.length,
      consent_id: consentId,
      created_by: session.user.id,
    })
    .select("id, kind, caption, file_name, mime_type, file_size_bytes, created_at")
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: error.message || "Não foi possível salvar o anexo.", draftId };
  }

  await logAudit({
    actorId: session.user.id,
    action: "evolution_attachment.uploaded",
    entity: "evolution_attachments",
    entityId: created.id,
    metadata: { patient_id: appointment.patient_id, kind, file_name: file.name, file_size_bytes: finalBuffer.length },
  });

  return {
    error: null,
    draftId,
    attachment: {
      id: created.id,
      kind: created.kind,
      caption: created.caption,
      fileName: created.file_name,
      mimeType: created.mime_type,
      fileSizeBytes: created.file_size_bytes,
      createdAt: created.created_at,
    },
  };
}

/** Remove um anexo — só enquanto ainda é rascunho (RLS
 * evolution_attachments_delete_while_draft); depois de assinar, nunca. */
export async function deleteEvolutionAttachment(id: string): Promise<{ error: string | null }> {
  const session = await requireProfessional();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("evolution_attachments")
    .select("id, file_path, patient_id, file_name, draft_id, created_by")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { error: "Anexo não encontrado." };
  if (existing.created_by !== session.user.id) return { error: "Você só pode remover anexos que você mesmo enviou." };
  if (!existing.draft_id) return { error: "Anexo de evolução já assinada não pode ser removido." };

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([existing.file_path]);
  if (storageError) return { error: "Não foi possível remover o arquivo. Tente novamente." };

  const { error } = await supabase.from("evolution_attachments").delete().eq("id", id);
  if (error) return { error: "Arquivo removido, mas houve falha ao atualizar o registro." };

  await logAudit({
    actorId: session.user.id,
    action: "evolution_attachment.deleted",
    entity: "evolution_attachments",
    entityId: id,
    metadata: { patient_id: existing.patient_id, file_name: existing.file_name },
  });

  return { error: null };
}

/** Link assinado de curta duração (60s, desenho P2 já aprovado) — gerado sob
 * demanda, nunca pré-gerado na carga da página. A RLS de evolution_attachments
 * (select) já garante que só autor ou quem tem liberação ativa consegue ler
 * a linha e, por tabela, assinar o path; o logAudit aqui é o que fecha "quem
 * anexou e quem visualizou" (item 8 do pedido original). */
export async function getEvolutionAttachmentDownloadUrl(
  id: string,
): Promise<{ url: string | null; error: string | null }> {
  const session = await getCurrentUser();
  if (!session) return { url: null, error: "Acesso negado." };

  const supabase = await createClient();
  const { data: attachment } = await supabase
    .from("evolution_attachments")
    .select("file_path, patient_id")
    .eq("id", id)
    .maybeSingle();

  if (!attachment) return { url: null, error: "Anexo não encontrado." };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(attachment.file_path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return { url: null, error: "Não foi possível gerar o link de acesso." };

  await logAudit({
    actorId: session.user.id,
    action: "evolution_attachment.viewed",
    entity: "evolution_attachments",
    entityId: id,
    metadata: { patient_id: attachment.patient_id },
  });

  return { url: data.signedUrl, error: null };
}

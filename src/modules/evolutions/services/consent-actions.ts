"use server";

import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { sniffImageType } from "@/lib/images/sniff-image-type";
import { sniffDocumentType } from "@/lib/images/sniff-document-type";
import { processImageToWebp } from "@/lib/images/process-image";
import { getActiveConsentTemplate, type ConsentTemplateView } from "@/modules/evolutions/services/consent-queries";

const SIGNATURE_BUCKET = "consent-signatures";
const MAX_SIGNED_DOCUMENT_BYTES = 5 * 1024 * 1024;

async function requireAdmin() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "admin") {
    throw new Error("Acesso negado.");
  }
  return session;
}

async function requireProfessional() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Wrapper "use server" — ConsentCollectionModal (client component) não pode
 * importar createClient("@/lib/supabase/server") direto. */
export async function loadActiveConsentTemplate(): Promise<ConsentTemplateView | null> {
  const session = await getCurrentUser();
  if (!session) return null;
  return getActiveConsentTemplate();
}

/**
 * Publica uma nova versão do modelo de termo. É sempre um INSERT (nunca
 * update) — consent_templates é append-only de propósito (ver comentário na
 * migração 0084): um termo já assinado precisa continuar apontando para o
 * texto EXATO que foi mostrado na hora, mesmo que esta versão seja corrigida
 * depois.
 */
export async function saveConsentTemplate(body: string): Promise<{ error: string | null }> {
  const session = await requireAdmin();
  const text = body.trim();
  if (!text) return { error: "O texto do termo não pode ficar vazio." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("consent_templates")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (last?.version ?? 0) + 1;

  const { data: created, error } = await supabase
    .from("consent_templates")
    .insert({ version: nextVersion, body: text, status: "active", created_by: session.user.id })
    .select("id")
    .single();

  if (error) return { error: "Não foi possível publicar o termo." };

  await logAudit({
    actorId: session.user.id,
    action: "consent_template.published",
    entity: "consent_templates",
    entityId: created.id,
    metadata: { version: nextVersion },
  });

  return { error: null };
}

export interface CollectImageConsentResult {
  error: string | null;
  id?: string;
}

/**
 * Colhe o termo de um paciente: assinatura desenhada na tela (PNG em
 * data URL) OU upload do termo já assinado em papel (foto/PDF) — a ação
 * aceita os dois, a tabela exige pelo menos um (check na migração 0084).
 *
 * O texto vigente é lido do SERVIDOR (nunca do que o client manda) — o
 * `template_id` não vem no formulário por isso: se o admin publicar uma
 * versão nova entre a hora que a tela abriu e a hora que o terapeuta aperta
 * "Assinar", o termo é colhido referenciando a versão que estava ativa
 * NESTE instante, nunca uma stale lida minutos antes.
 */
export async function collectImageConsent(formData: FormData): Promise<CollectImageConsentResult> {
  const session = await requireProfessional();

  const rateLimit = checkRateLimit(`collect-image-consent:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const patientId = String(formData.get("patient_id") ?? "").trim();
  const guardianName = String(formData.get("guardian_name") ?? "").trim();
  const guardianRelationship = String(formData.get("guardian_relationship") ?? "").trim();
  if (!patientId) return { error: "Paciente não informado." };
  if (!guardianName) return { error: "Informe o nome do responsável." };
  if (!guardianRelationship) return { error: "Informe o parentesco/vínculo do responsável." };

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("consent_templates")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  if (!template) return { error: "Nenhum modelo de termo publicado. Avise a administração." };

  const signatureDataUrl = String(formData.get("signature_data_url") ?? "");
  const signedDocument = formData.get("signed_document");

  let buffer: Buffer | null = null;
  let extension: string | null = null;

  if (signatureDataUrl.startsWith("data:image/png;base64,")) {
    buffer = Buffer.from(signatureDataUrl.slice("data:image/png;base64,".length), "base64");
    if (sniffImageType(buffer) !== "image/png") {
      return { error: "Assinatura inválida. Desenhe novamente." };
    }
    const processed = await processImageToWebp(buffer, { maxDimension: 900, quality: 85 });
    buffer = processed.buffer;
    extension = "webp";
  } else if (signedDocument instanceof File && signedDocument.size > 0) {
    if (signedDocument.size > MAX_SIGNED_DOCUMENT_BYTES) {
      return { error: "Arquivo muito grande. Limite de 5MB." };
    }
    const raw = Buffer.from(await signedDocument.arrayBuffer());
    const imageKind = sniffImageType(raw);
    if (imageKind === "image/png" || imageKind === "image/jpeg") {
      const processed = await processImageToWebp(raw, { maxDimension: 1600, quality: 85 });
      buffer = processed.buffer;
      extension = "webp";
    } else if (sniffDocumentType(raw) === "pdf") {
      buffer = raw;
      extension = "pdf";
    } else {
      return { error: "Formato inválido. Envie PDF, PNG ou JPEG." };
    }
  } else {
    return { error: "Assine na tela ou envie o termo já assinado em papel." };
  }

  const consentId = randomUUID();
  const path = `${patientId}/${consentId}.${extension}`;
  const contentType = extension === "pdf" ? "application/pdf" : "image/webp";

  const { error: uploadError } = await supabase.storage
    .from(SIGNATURE_BUCKET)
    .upload(path, buffer, { upsert: false, contentType });

  if (uploadError) return { error: "Falha ao enviar a assinatura. Tente novamente." };

  const isSignatureDrawing = signatureDataUrl.startsWith("data:image/png;base64,");

  const { data: created, error } = await supabase
    .from("image_consents")
    .insert({
      id: consentId,
      patient_id: patientId,
      template_id: template.id,
      guardian_name: guardianName,
      guardian_relationship: guardianRelationship,
      signature_image_path: isSignatureDrawing ? path : null,
      signed_document_path: isSignatureDrawing ? null : path,
      collected_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from(SIGNATURE_BUCKET).remove([path]);
    // Mensagens do gatilho image_consents_validate e do índice único (termo
    // já vigente) já são claras o bastante para mostrar direto.
    const message =
      error.code === "23505"
        ? "Este paciente já tem um termo vigente. Revogue o termo atual antes de colher um novo."
        : error.message || "Não foi possível salvar o termo.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "image_consent.collected",
    entity: "image_consents",
    entityId: created.id,
    metadata: { patient_id: patientId },
  });

  return { error: null, id: created.id };
}

/** Revoga o termo vigente. NÃO apaga nada (decisão Q2) — anexos já enviados
 * continuam acessíveis ao autor; só bloqueia envio de imagem/áudio novo
 * (gatilho evolution_attachments_validate confere revoked_at na hora do
 * envio, não na hora da revogação). */
export async function revokeImageConsent(consentId: string): Promise<{ error: string | null }> {
  const session = await requireProfessional();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("image_consents")
    .select("id, patient_id, revoked_at")
    .eq("id", consentId)
    .maybeSingle();

  if (!existing) return { error: "Termo não encontrado." };
  if (existing.revoked_at) return { error: "Este termo já estava revogado." };

  const { error } = await supabase
    .from("image_consents")
    .update({ revoked_at: new Date().toISOString(), revoked_by: session.user.id })
    .eq("id", consentId);

  if (error) return { error: "Não foi possível revogar o termo." };

  await logAudit({
    actorId: session.user.id,
    action: "image_consent.revoked",
    entity: "image_consents",
    entityId: consentId,
    metadata: { patient_id: existing.patient_id },
  });

  return { error: null };
}

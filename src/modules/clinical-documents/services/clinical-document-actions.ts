"use server";

import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import {
  getClinicalDocumentsForPatient,
  type ClinicalDocumentView,
} from "@/modules/clinical-documents/services/clinical-document-queries";

const BUCKET = "clinical-documents";
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 5 * 60;

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function requireProfessional() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Carrega os documentos de um paciente para a aba "Documentos" da ficha —
 * mesmo padrão de loadMoreEvolutionsForPatient (evolution-actions.ts): não
 * restringe por role além de exigir sessão, porque a RLS de
 * clinical_documents já garante que só quem tem acesso de fato recebe
 * alguma linha. */
export async function loadClinicalDocumentsForPatient(patientId: string): Promise<ClinicalDocumentView[]> {
  const session = await getCurrentUser();
  if (!session) return [];

  return getClinicalDocumentsForPatient(patientId);
}

export async function uploadClinicalDocument(formData: FormData): Promise<{ error: string | null; id?: string }> {
  const session = await requireProfessional();

  const rateLimit = checkRateLimit(`upload-clinical-document:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const patientId = String(formData.get("patient_id") ?? "").trim();
  if (!patientId) return { error: "Paciente não informado." };

  const evolutionIdRaw = formData.get("evolution_id");
  const evolutionId = typeof evolutionIdRaw === "string" && evolutionIdRaw.trim() ? evolutionIdRaw.trim() : null;

  const descriptionRaw = formData.get("description");
  const description = typeof descriptionRaw === "string" && descriptionRaw.trim() ? descriptionRaw.trim() : null;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Nenhum arquivo selecionado." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Formato inválido. Envie PDF, PNG, JPEG ou WEBP." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Arquivo muito grande. Limite de 10MB." };
  }

  const supabase = await createClient();

  // Confere aqui (não só no trigger clinical_documents_validate) para dar um
  // erro amigável — mesmo espírito de createEvolution, que valida a consulta
  // em JS antes de deixar o trigger de banco barrar como última linha de
  // defesa.
  if (evolutionId) {
    const { data: evolution } = await supabase
      .from("patient_evolutions")
      .select("patient_id, professional_id")
      .eq("id", evolutionId)
      .maybeSingle();

    if (!evolution) return { error: "Evolução vinculada não encontrada." };
    if (evolution.patient_id !== patientId || evolution.professional_id !== session.user.id) {
      return { error: "A evolução vinculada precisa ser do mesmo paciente e profissional." };
    }
  }

  const documentId = randomUUID();
  // Extensão vem do MIME já validado (ALLOWED_TYPES acima), não do nome do
  // arquivo — file.name é controlado pelo client e não deveria decidir o
  // path do objeto no Storage.
  const extension = EXTENSION_BY_MIME[file.type] ?? "bin";
  const path = `${session.user.id}/${patientId}/${documentId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (uploadError) return { error: "Falha ao enviar o arquivo. Tente novamente." };

  const { data: created, error } = await supabase
    .from("clinical_documents")
    .insert({
      id: documentId,
      patient_id: patientId,
      professional_id: session.user.id,
      evolution_id: evolutionId,
      description,
      file_name: file.name,
      file_path: path,
      mime_type: file.type,
      file_size_bytes: file.size,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: "Não foi possível salvar o documento." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "clinical_document.uploaded",
    entity: "clinical_documents",
    entityId: created.id,
    metadata: { patient_id: patientId, file_name: file.name, mime_type: file.type, file_size_bytes: file.size },
  });

  return { error: null, id: created.id };
}

/** Exclusão física — exceção deliberada ao padrão de histórico imutável do
 * resto do prontuário (ver comentário na migration 0045). Só quem enviou
 * pode excluir, reforçado pela RLS (clinical_documents_delete_own). O
 * logAudit é o que garante que o rastro sobrevive mesmo quando o arquivo é
 * removido — essencial em clínica de alto volume, onde envio errado
 * acontece com frequência. */
export async function deleteClinicalDocument(id: string): Promise<{ error: string | null }> {
  const session = await requireProfessional();

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("clinical_documents")
    .select("id, file_path, patient_id, file_name, created_by")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { error: "Documento não encontrado." };
  if (existing.created_by !== session.user.id) {
    return { error: "Você só pode excluir documentos que você mesmo enviou." };
  }

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([existing.file_path]);
  if (storageError) return { error: "Não foi possível remover o arquivo. Tente novamente." };

  const { error } = await supabase.from("clinical_documents").delete().eq("id", id);
  if (error) return { error: "Arquivo removido, mas houve falha ao atualizar o registro." };

  await logAudit({
    actorId: session.user.id,
    action: "clinical_document.deleted",
    entity: "clinical_documents",
    entityId: id,
    metadata: { patient_id: existing.patient_id, file_name: existing.file_name },
  });

  return { error: null };
}

/** Gera um link assinado de curta duração (5min) para visualizar/baixar um
 * documento — chamado sob demanda pelo botão "Abrir" no client, nunca
 * pré-gerado na carga da página. A RLS de storage.objects
 * (clinical_documents_storage_select_owner) já garante que só o profissional
 * dono consegue de fato assinar o path. */
export async function getClinicalDocumentDownloadUrl(id: string): Promise<{ url: string | null; error: string | null }> {
  const session = await getCurrentUser();
  if (!session) return { url: null, error: "Acesso negado." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("clinical_documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  if (!doc) return { url: null, error: "Documento não encontrado." };

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return { url: null, error: "Não foi possível gerar o link de acesso." };

  return { url: data.signedUrl, error: null };
}

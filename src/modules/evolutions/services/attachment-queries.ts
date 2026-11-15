import { createClient } from "@/lib/supabase/server";
import type { EvolutionAttachmentKind } from "@/lib/supabase/types";

export interface EvolutionAttachmentView {
  id: string;
  kind: EvolutionAttachmentKind;
  caption: string | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

function mapRow(row: {
  id: string;
  kind: EvolutionAttachmentKind;
  caption: string | null;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
}): EvolutionAttachmentView {
  return {
    id: row.id,
    kind: row.kind,
    caption: row.caption,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    createdAt: row.created_at,
  };
}

/** Anexos de um rascunho (ainda não assinado) — RLS já restringe a quem
 * enviou (evolution_attachments_select); outro profissional nunca lê
 * anexo de rascunho de ninguém, nem com liberação (a liberação só existe
 * para anexo já assinado, ver migração 0084). */
export async function getAttachmentsForDraft(draftId: string): Promise<EvolutionAttachmentView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("evolution_attachments")
    .select("id, kind, caption, file_name, mime_type, file_size_bytes, created_at")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: true });

  return (data ?? []).map(mapRow);
}

/** Anexos de uma evolução já assinada — autor sempre vê os seus; outro
 * profissional só vê com liberação ativa (específica ou "liberação total"),
 * tudo resolvido pela RLS (evolution_attachments_select, migração 0084). */
export async function getAttachmentsForEvolution(evolutionId: string): Promise<EvolutionAttachmentView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("evolution_attachments")
    .select("id, kind, caption, file_name, mime_type, file_size_bytes, created_at")
    .eq("evolution_id", evolutionId)
    .order("created_at", { ascending: true });

  return (data ?? []).map(mapRow);
}

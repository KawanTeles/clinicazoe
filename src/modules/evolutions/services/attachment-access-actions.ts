"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAttachmentsForEvolution, type EvolutionAttachmentView } from "@/modules/evolutions/services/attachment-queries";
import {
  getActiveGrantsForAuthorPatient,
  listActiveProfessionalsExcept,
  type AttachmentGrantView,
  type ProfessionalOption,
} from "@/modules/evolutions/services/grant-queries";

export interface AttachmentAccessPanelData {
  /** true quando quem está vendo é o próprio autor da evolução — só ele (ou
   * a Coordenação, numa tela separada, quando ele está inativo) pode
   * liberar acesso. Controles de liberação ficam escondidos para qualquer
   * outro profissional vinculado, mesmo coterapeuta. */
  isAuthor: boolean;
  attachments: EvolutionAttachmentView[];
  colleagues: ProfessionalOption[];
  activeGrants: AttachmentGrantView[];
  patientId: string;
  authorProfessionalId: string;
}

/**
 * Carrega, num só lugar, tudo que o painel de anexos de uma evolução
 * assinada precisa — inclusive a decisão "é o autor?", que só o servidor
 * pode responder com segurança (comparar contra session.user.id), evitando
 * ter que espalhar um prop `viewerId` pelos três pontos de entrada que
 * acabam mostrando uma evolução assinada (EvolutionPanel, EvolutionDetailModal
 * via EvolutionSearchResults/EvolutionTimeline).
 */
export async function loadAttachmentAccessPanelData(evolutionId: string): Promise<AttachmentAccessPanelData | null> {
  const session = await getCurrentUser();
  if (!session) return null;

  const supabase = await createClient();
  const { data: evolution } = await supabase
    .from("patient_evolutions")
    .select("professional_id, patient_id")
    .eq("id", evolutionId)
    .maybeSingle();

  if (!evolution) return null;

  const isAuthor = evolution.professional_id === session.user.id;
  const attachments = await getAttachmentsForEvolution(evolutionId);

  const [colleagues, activeGrants] = isAuthor
    ? await Promise.all([
        listActiveProfessionalsExcept(session.user.id),
        getActiveGrantsForAuthorPatient(evolution.professional_id, evolution.patient_id),
      ])
    : [[], []];

  return {
    isAuthor,
    attachments,
    colleagues,
    activeGrants,
    patientId: evolution.patient_id,
    authorProfessionalId: evolution.professional_id,
  };
}

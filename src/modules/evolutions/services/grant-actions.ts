"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/modules/team/services/audit";
import { notify } from "@/modules/notifications/services/notify";
import {
  getPatientsWithAttachmentsForInactiveAuthor,
  type PatientWithAttachments,
} from "@/modules/evolutions/services/grant-queries";

/** Quem pode CHAMAR esta action: qualquer profissional (vai liberar o
 * próprio anexo) ou quem acumula/é Coordenação (vai liberar em nome de um
 * autor inativo). A regra de verdade — quem pode liberar O QUÊ — é
 * reforçada pelo gatilho attachment_access_grants_validate (migração 0084);
 * esta checagem aqui só evita que um papel sem nenhuma relação com o
 * recurso (recepção, paciente) chegue perto da action. */
async function requireProfessionalOrCoordinator() {
  const session = await getCurrentUser();
  if (!session || (session.profile.role !== "profissional" && !session.profile.is_coordinator)) {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Wrapper "use server" — a tela da Coordenação (client component) escolhe
 * o autor inativo dinamicamente, então a lista de pacientes não pode vir
 * pré-carregada pelo server component da página. */
export async function loadPatientsWithAttachmentsForInactiveAuthor(
  authorProfessionalId: string,
): Promise<PatientWithAttachments[]> {
  await requireProfessionalOrCoordinator();
  return getPatientsWithAttachmentsForInactiveAuthor(authorProfessionalId);
}

export interface GrantAttachmentAccessInput {
  patientId: string;
  authorProfessionalId: string;
  grantedToProfessionalId: string;
  justification: string;
  /** null = liberação total (todos os anexos deste autor, deste paciente,
   * inclusive futuros) — ver comentário na tabela, migração 0084. */
  attachmentId: string | null;
}

export async function grantAttachmentAccess(
  input: GrantAttachmentAccessInput,
): Promise<{ error: string | null }> {
  const session = await requireProfessionalOrCoordinator();

  const justification = input.justification.trim();
  if (!justification) return { error: "Informe o motivo da liberação." };
  if (input.grantedToProfessionalId === input.authorProfessionalId) {
    return { error: "Não é possível liberar o acesso para o próprio autor." };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("attachment_access_grants")
    .insert({
      attachment_id: input.attachmentId,
      patient_id: input.patientId,
      author_professional_id: input.authorProfessionalId,
      granted_to_professional_id: input.grantedToProfessionalId,
      granted_by: session.user.id,
      justification,
    })
    .select("id")
    .single();

  if (error) {
    // Mensagem do gatilho attachment_access_grants_validate já é clara
    // (explica se é porque o autor ainda está ativo, por exemplo).
    return { error: error.message || "Não foi possível liberar o acesso." };
  }

  await logAudit({
    actorId: session.user.id,
    action: "attachment_access_grant.created",
    entity: "attachment_access_grants",
    entityId: created.id,
    metadata: {
      patient_id: input.patientId,
      author_professional_id: input.authorProfessionalId,
      granted_to_professional_id: input.grantedToProfessionalId,
      attachment_id: input.attachmentId,
    },
  });

  const isBlanket = input.attachmentId === null;
  await notify({
    userId: input.grantedToProfessionalId,
    type: "attachment_access.granted",
    title: "Acesso a anexos liberado",
    message: isBlanket
      ? `${session.profile.full_name} liberou acesso aos anexos de evolução de um paciente para você.`
      : `${session.profile.full_name} liberou acesso a um anexo de evolução para você.`,
    entity: "attachment_access_grants",
    entityId: created.id,
  });

  if (session.user.id !== input.authorProfessionalId) {
    await notify({
      userId: input.authorProfessionalId,
      type: "attachment_access.granted_on_behalf",
      title: "Acesso aos seus anexos liberado pela Coordenação",
      message: `A Coordenação (${session.profile.full_name}) liberou acesso aos anexos de evolução de um de seus pacientes para outro profissional.`,
      entity: "attachment_access_grants",
      entityId: created.id,
    });
  }

  return { error: null };
}

export async function revokeAttachmentGrant(id: string): Promise<{ error: string | null }> {
  const session = await requireProfessionalOrCoordinator();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("attachment_access_grants")
    .select("id, patient_id, author_professional_id, granted_to_professional_id, revoked_at")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { error: "Liberação não encontrada." };
  if (existing.revoked_at) return { error: "Esta liberação já estava revogada." };

  const { error } = await supabase
    .from("attachment_access_grants")
    .update({ revoked_at: new Date().toISOString(), revoked_by: session.user.id })
    .eq("id", id);

  if (error) return { error: "Não foi possível revogar a liberação." };

  await logAudit({
    actorId: session.user.id,
    action: "attachment_access_grant.revoked",
    entity: "attachment_access_grants",
    entityId: id,
    metadata: { patient_id: existing.patient_id, author_professional_id: existing.author_professional_id },
  });

  await notify({
    userId: existing.granted_to_professional_id,
    type: "attachment_access.revoked",
    title: "Acesso a anexos revogado",
    message: `${session.profile.full_name} revogou seu acesso a anexos de evolução de um paciente.`,
    entity: "attachment_access_grants",
    entityId: id,
  });

  return { error: null };
}

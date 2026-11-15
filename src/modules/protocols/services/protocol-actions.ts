"use server";

import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import {
  getAvailableProtocolTemplates,
  getManagedProtocolTemplates,
  getProtocolAssessmentsForPatient,
  getProtocolTemplateItems,
  type ProtocolAssessmentView,
  type ProtocolItemView,
  type ProtocolTemplateSummary,
  type ProtocolTemplateView,
} from "@/modules/protocols/services/protocol-queries";
import type { EvolutionTemplateScope, ProtocolAssessmentResponse } from "@/lib/supabase/types";

async function requireSession() {
  const session = await getCurrentUser();
  if (!session) throw new Error("Acesso negado.");
  return session;
}

async function requireProfessional() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  return session;
}

/** Mesma regra de assertPodeGerenciar de template-actions.ts (evoluções):
 * pessoal é só do dono, global/área é só admin/coordenação — texto do erro
 * aqui, a regra de verdade está na RLS (migração 0086). */
async function assertPodeGerenciar(
  session: Awaited<ReturnType<typeof requireSession>>,
  scope: EvolutionTemplateScope,
  ownerProfessionalId: string | null,
) {
  if (scope === "personal") {
    const podeProprio = await can(session.profile, "protocol_templates.manage.own");
    if (!podeProprio || ownerProfessionalId !== session.user.id) {
      throw new Error("Você só pode editar o seu próprio protocolo.");
    }
    return;
  }
  const podeCompartilhado = await can(session.profile, "protocol_templates.manage.shared");
  if (!podeCompartilhado) {
    throw new Error("Só a administração e a coordenação editam protocolos globais/de área.");
  }
}

// --- Wrappers "use server" de leitura -------------------------------------

export async function loadAvailableProtocolTemplates(): Promise<ProtocolTemplateView[]> {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") return [];
  return getAvailableProtocolTemplates(session.user.id);
}

export async function loadProtocolAssessments(patientId: string): Promise<ProtocolAssessmentView[]> {
  const session = await getCurrentUser();
  if (!session) return [];
  return getProtocolAssessmentsForPatient(patientId);
}

export async function loadManagedProtocolTemplates(): Promise<ProtocolTemplateSummary[]> {
  const session = await getCurrentUser();
  if (!session) return [];
  const [canOwn, canShared] = await Promise.all([
    can(session.profile, "protocol_templates.manage.own"),
    can(session.profile, "protocol_templates.manage.shared"),
  ]);
  if (!canOwn && !canShared) return [];
  return getManagedProtocolTemplates({
    ownProfessionalId: canOwn ? session.user.id : undefined,
    includeShared: canShared,
  });
}

export async function loadProtocolTemplateItems(templateId: string): Promise<ProtocolItemView[]> {
  const session = await getCurrentUser();
  if (!session) return [];
  return getProtocolTemplateItems(templateId);
}

// --- Construtor -------------------------------------------------------------

export interface CreateProtocolTemplateInput {
  name: string;
  description?: string;
  scope: EvolutionTemplateScope;
  specialtyId?: string | null;
}

export async function createProtocolTemplate(
  input: CreateProtocolTemplateInput,
): Promise<{ error: string | null; id?: string }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "Acesso negado." };
  }

  const rateLimit = checkRateLimit(`protocol-template-write:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const name = input.name.trim();
  if (!name) return { error: "Dê um nome ao protocolo." };
  if (input.scope === "area" && !input.specialtyId) {
    return { error: "Escolha a área (especialidade) do protocolo." };
  }

  const ownerProfessionalId = input.scope === "personal" ? session.user.id : null;

  try {
    await assertPodeGerenciar(session, input.scope, ownerProfessionalId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Acesso negado." };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("protocol_templates")
    .insert({
      name,
      description: input.description?.trim() || null,
      scope: input.scope,
      specialty_id: input.scope === "area" ? input.specialtyId : null,
      owner_professional_id: ownerProfessionalId,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) return { error: "Não foi possível criar o protocolo." };

  await logAudit({
    actorId: session.user.id,
    action: "protocol_template.created",
    entity: "protocol_templates",
    entityId: created.id,
    metadata: { scope: input.scope },
  });

  return { error: null, id: created.id };
}

export async function archiveProtocolTemplate(id: string): Promise<{ error: string | null }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "Acesso negado." };
  }

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("protocol_templates")
    .select("scope, owner_professional_id")
    .eq("id", id)
    .maybeSingle();
  if (!template) return { error: "Protocolo não encontrado." };

  try {
    await assertPodeGerenciar(session, template.scope, template.owner_professional_id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Acesso negado." };
  }

  const { error } = await supabase.from("protocol_templates").update({ status: "inactive" }).eq("id", id);
  if (error) return { error: "Não foi possível arquivar o protocolo." };

  await logAudit({
    actorId: session.user.id,
    action: "protocol_template.archived",
    entity: "protocol_templates",
    entityId: id,
  });

  return { error: null };
}

export interface ProtocolItemInput {
  domain?: string | null;
  label: string;
}

/** Adiciona itens ao protocolo (construtor manual, um por um) — reaproveitado
 * também pelo import CSV (uma linha de CSV = um item). */
export async function addProtocolItems(
  templateId: string,
  items: ProtocolItemInput[],
): Promise<{ error: string | null; added?: number }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "Acesso negado." };
  }

  const cleaned = items.map((i) => ({ domain: i.domain?.trim() || null, label: i.label.trim() })).filter((i) => i.label.length > 0);
  if (cleaned.length === 0) return { error: "Nenhum item válido para adicionar." };
  if (cleaned.length > 500) return { error: "No máximo 500 itens por vez." };

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("protocol_templates")
    .select("scope, owner_professional_id")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) return { error: "Protocolo não encontrado." };

  try {
    await assertPodeGerenciar(session, template.scope, template.owner_professional_id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Acesso negado." };
  }

  const { count: currentCount } = await supabase
    .from("protocol_items")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);

  const { error } = await supabase.from("protocol_items").insert(
    cleaned.map((item, i) => ({
      template_id: templateId,
      domain: item.domain,
      label: item.label,
      display_order: (currentCount ?? 0) + i,
    })),
  );

  if (error) return { error: "Não foi possível salvar os itens." };

  await logAudit({
    actorId: session.user.id,
    action: "protocol_template.items_added",
    entity: "protocol_templates",
    entityId: templateId,
    metadata: { count: cleaned.length },
  });

  return { error: null, added: cleaned.length };
}

/** Oculta o item (nunca apaga) — mesmo princípio de evolution_template_
 * topics.hidden: um item já usado em avaliação respondida some do
 * construtor sem sumir da resposta histórica (que guarda o label direto). */
export async function hideProtocolItem(itemId: string): Promise<{ error: string | null }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "Acesso negado." };
  }

  const supabase = await createClient();
  const { data: item } = await supabase.from("protocol_items").select("template_id").eq("id", itemId).maybeSingle();
  if (!item) return { error: "Item não encontrado." };

  const { data: template } = await supabase
    .from("protocol_templates")
    .select("scope, owner_professional_id")
    .eq("id", item.template_id)
    .maybeSingle();
  if (!template) return { error: "Protocolo não encontrado." };

  try {
    await assertPodeGerenciar(session, template.scope, template.owner_professional_id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Acesso negado." };
  }

  const { error } = await supabase.from("protocol_items").update({ hidden: true }).eq("id", itemId);
  if (error) return { error: "Não foi possível ocultar o item." };

  return { error: null };
}

// --- Aplicar avaliação a um paciente ---------------------------------------

export interface SubmitProtocolAssessmentInput {
  templateId: string;
  templateName: string;
  templateVersion: number;
  patientId: string;
  assessmentDate: string;
  responses: ProtocolAssessmentResponse[];
  notes?: string;
}

export async function submitProtocolAssessment(
  input: SubmitProtocolAssessmentInput,
): Promise<{ error: string | null; id?: string }> {
  const session = await requireProfessional();

  const rateLimit = checkRateLimit(`submit-protocol-assessment:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  if (input.responses.length === 0) return { error: "Responda ao menos um item antes de salvar." };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("patient_protocol_assessments")
    .insert({
      template_id: input.templateId,
      template_name: input.templateName,
      template_version: input.templateVersion,
      patient_id: input.patientId,
      professional_id: session.user.id,
      assessment_date: input.assessmentDate,
      responses: input.responses,
      notes: input.notes?.trim() || null,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message || "Não foi possível salvar a avaliação." };

  await logAudit({
    actorId: session.user.id,
    action: "protocol_assessment.created",
    entity: "patient_protocol_assessments",
    entityId: created.id,
    metadata: { patient_id: input.patientId, template_id: input.templateId, item_count: input.responses.length },
  });

  return { error: null, id: created.id };
}

import { createClient } from "@/lib/supabase/server";
import type { EvolutionTemplateScope, ProtocolAssessmentResponse } from "@/lib/supabase/types";

export interface ProtocolItemView {
  id: string;
  domain: string | null;
  label: string;
  displayOrder: number;
  pointValue: number;
}

export interface InterpretationBandView {
  id: string;
  domain: string | null;
  minScore: number;
  maxScore: number;
  label: string;
  description: string | null;
}

export interface ProtocolTemplateView {
  id: string;
  name: string;
  description: string | null;
  scope: EvolutionTemplateScope;
  version: number;
  scoringEnabled: boolean;
  items: ProtocolItemView[];
  bands: InterpretationBandView[];
}

function mapBandRow(row: { id: string; domain: string | null; min_score: number; max_score: number; label: string; description: string | null }): InterpretationBandView {
  return { id: row.id, domain: row.domain, minScore: row.min_score, maxScore: row.max_score, label: row.label, description: row.description };
}

/** Resolve os protocolos disponíveis para um profissional: os pessoais dele
 * + os de abrangência global/área (mesmo critério de leitura de
 * evolution_templates) — usado no picker "Aplicar protocolo". Só modelos
 * PUBLICADOS aparecem (F9 — rascunho não fica disponível pra aplicar em
 * paciente) e só itens não ocultos (hidden=false); itens ocultos continuam
 * existindo só para não quebrar avaliações antigas que já os referenciam (o
 * label fica congelado na resposta, não no item). */
export async function getAvailableProtocolTemplates(professionalId: string): Promise<ProtocolTemplateView[]> {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("protocol_templates")
    .select("id, name, description, scope, version, scoring_enabled")
    .eq("status", "active")
    .not("published_at", "is", null)
    .order("name");

  if (!templates || templates.length === 0) return [];

  const ids = templates.map((t) => t.id);
  const [{ data: items }, { data: bands }] = await Promise.all([
    supabase
      .from("protocol_items")
      .select("id, template_id, domain, label, display_order, point_value")
      .in("template_id", ids)
      .eq("hidden", false)
      .order("display_order"),
    supabase
      .from("protocol_interpretation_bands")
      .select("id, template_id, domain, min_score, max_score, label, description")
      .in("template_id", ids),
  ]);

  const itemsByTemplate = new Map<string, ProtocolItemView[]>();
  for (const item of items ?? []) {
    const list = itemsByTemplate.get(item.template_id) ?? [];
    list.push({ id: item.id, domain: item.domain, label: item.label, displayOrder: item.display_order, pointValue: item.point_value });
    itemsByTemplate.set(item.template_id, list);
  }

  const bandsByTemplate = new Map<string, InterpretationBandView[]>();
  for (const band of bands ?? []) {
    const list = bandsByTemplate.get(band.template_id) ?? [];
    list.push(mapBandRow(band));
    bandsByTemplate.set(band.template_id, list);
  }

  return templates
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      scope: t.scope,
      version: t.version,
      scoringEnabled: t.scoring_enabled,
      items: itemsByTemplate.get(t.id) ?? [],
      bands: bandsByTemplate.get(t.id) ?? [],
    }))
    .filter((t) => t.items.length > 0);
}

export interface ProtocolAssessmentView {
  id: string;
  templateName: string;
  templateVersion: number;
  assessmentDate: string;
  responses: ProtocolAssessmentResponse[];
  notes: string | null;
  totalScore: number | null;
  interpretationLabel: string | null;
  createdAt: string;
}

/** Avaliações já aplicadas a um paciente — RLS (patient_protocol_assessments_
 * select) restringe a quem está vinculado; admin/coordenação não recebem
 * nenhuma linha (conteúdo clínico). */
export async function getProtocolAssessmentsForPatient(patientId: string): Promise<ProtocolAssessmentView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_protocol_assessments")
    .select("id, template_name, template_version, assessment_date, responses, notes, total_score, interpretation_label, created_at")
    .eq("patient_id", patientId)
    .order("assessment_date", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    templateName: row.template_name,
    templateVersion: row.template_version,
    assessmentDate: row.assessment_date,
    responses: row.responses,
    notes: row.notes,
    totalScore: row.total_score,
    interpretationLabel: row.interpretation_label,
    createdAt: row.created_at,
  }));
}

export interface ProtocolTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  scope: EvolutionTemplateScope;
  specialtyId: string | null;
  version: number;
  itemCount: number;
  publishedAt: string | null;
  scoringEnabled: boolean;
}

/** Modelos geridos por quem chama (pessoais do profissional, ou
 * globais/de área para admin/coordenação) — tela de construtor. Inclui
 * rascunhos (publishedAt null) — só getAvailableProtocolTemplates (picker
 * de aplicar) exige publicação. */
export async function getManagedProtocolTemplates(params: {
  ownProfessionalId?: string;
  includeShared: boolean;
}): Promise<ProtocolTemplateSummary[]> {
  const supabase = await createClient();
  let query = supabase.from("protocol_templates").select("id, name, description, scope, specialty_id, version, published_at, scoring_enabled");

  if (params.includeShared && params.ownProfessionalId) {
    query = query.or(`scope.in.(global,area),owner_professional_id.eq.${params.ownProfessionalId}`);
  } else if (params.includeShared) {
    query = query.in("scope", ["global", "area"]);
  } else if (params.ownProfessionalId) {
    query = query.eq("owner_professional_id", params.ownProfessionalId);
  } else {
    return [];
  }

  const { data: templates } = await query.order("name");
  if (!templates || templates.length === 0) return [];

  const ids = templates.map((t) => t.id);
  const { data: itemCounts } = await supabase.from("protocol_items").select("template_id").in("template_id", ids);
  const countByTemplate = new Map<string, number>();
  for (const row of itemCounts ?? []) {
    countByTemplate.set(row.template_id, (countByTemplate.get(row.template_id) ?? 0) + 1);
  }

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    scope: t.scope,
    specialtyId: t.specialty_id,
    version: t.version,
    itemCount: countByTemplate.get(t.id) ?? 0,
    publishedAt: t.published_at,
    scoringEnabled: t.scoring_enabled,
  }));
}

export async function getProtocolTemplateItems(templateId: string): Promise<ProtocolItemView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("protocol_items")
    .select("id, domain, label, display_order, point_value")
    .eq("template_id", templateId)
    .order("display_order");

  return (data ?? []).map((row) => ({
    id: row.id,
    domain: row.domain,
    label: row.label,
    displayOrder: row.display_order,
    pointValue: row.point_value,
  }));
}

export async function getInterpretationBands(templateId: string): Promise<InterpretationBandView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("protocol_interpretation_bands")
    .select("id, domain, min_score, max_score, label, description")
    .eq("template_id", templateId)
    .order("display_order");

  return (data ?? []).map(mapBandRow);
}

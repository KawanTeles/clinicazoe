import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { EvolutionTemplateScope } from "@/lib/supabase/types";

export interface EvolutionTemplateTopic {
  id: string;
  label: string;
  hint: string | null;
  displayOrder: number;
  hidden: boolean;
}

export interface EvolutionTemplateView {
  id: string;
  name: string;
  scope: EvolutionTemplateScope;
  specialtyId: string | null;
  specialtyName: string | null;
  ownerProfessionalId: string | null;
  version: number;
  isFactoryDefault: boolean;
  topics: EvolutionTemplateTopic[];
}

interface TopicRow {
  id: string;
  label: string;
  hint: string | null;
  display_order: number;
  hidden: boolean;
}

interface TemplateRow {
  id: string;
  name: string;
  scope: EvolutionTemplateScope;
  specialty_id: string | null;
  owner_professional_id: string | null;
  version: number;
  is_factory_default: boolean;
  specialties: { name: string } | { name: string }[] | null;
  evolution_template_topics: TopicRow[] | null;
}

const TEMPLATE_SELECT = `
  id, name, scope, specialty_id, owner_professional_id, version, is_factory_default,
  specialties ( name ),
  evolution_template_topics ( id, label, hint, display_order, hidden )
`;

function toView(row: TemplateRow): EvolutionTemplateView {
  const specialty = Array.isArray(row.specialties) ? row.specialties[0] : row.specialties;

  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    specialtyId: row.specialty_id,
    specialtyName: specialty?.name ?? null,
    ownerProfessionalId: row.owner_professional_id,
    version: row.version,
    isFactoryDefault: row.is_factory_default,
    // Tópicos ocultos SAEM aqui: quem monta formulário filtra (ver
    // visibleTopics), quem administra o modelo precisa enxergá-los para poder
    // reexibir.
    topics: (row.evolution_template_topics ?? [])
      .sort((a, b) => a.display_order - b.display_order)
      .map((t) => ({
        id: t.id,
        label: t.label,
        hint: t.hint,
        displayOrder: t.display_order,
        hidden: t.hidden,
      })),
  };
}

/** Os tópicos que de fato viram campo no formulário. Ocultar serve para tirar
 * do formulário um tópico que já foi usado em evolução assinada, sem sumir do
 * histórico — então a evolução antiga continua exibindo o tópico, e a nova não
 * o oferece mais. */
export function visibleTopics(template: EvolutionTemplateView): EvolutionTemplateTopic[] {
  return template.topics.filter((t) => !t.hidden);
}

/**
 * Resolve QUAL modelo um profissional usa para uma especialidade:
 * pessoal -> da área -> padrão de fábrica.
 *
 * O padrão de fábrica (um tópico só, "Evolução") é o último recurso e é
 * protegido no banco contra exclusão e arquivamento (Etapa 79) — sem ele um
 * profissional sem modelo próprio e sem modelo de área ficaria sem formulário.
 *
 * Tópicos ocultos já saem filtrados: ocultar serve para tirar do formulário um
 * tópico que já foi usado em evolução assinada, sem sumir do histórico.
 */
export async function resolveEvolutionTemplate(
  professionalId: string,
  specialtyId: string | null,
): Promise<EvolutionTemplateView | null> {
  const supabase = await createClient();

  const { data: pessoal } = await supabase
    .from("evolution_templates")
    .select(TEMPLATE_SELECT)
    .eq("scope", "personal")
    .eq("owner_professional_id", professionalId)
    .eq("status", "active")
    .maybeSingle();

  if (pessoal) return toView(pessoal as unknown as TemplateRow);

  if (specialtyId) {
    const { data: area } = await supabase
      .from("evolution_templates")
      .select(TEMPLATE_SELECT)
      .eq("scope", "area")
      .eq("specialty_id", specialtyId)
      .eq("status", "active")
      .maybeSingle();

    if (area) return toView(area as unknown as TemplateRow);
  }

  const { data: fabrica } = await supabase
    .from("evolution_templates")
    .select(TEMPLATE_SELECT)
    .eq("is_factory_default", true)
    .maybeSingle();

  return fabrica ? toView(fabrica as unknown as TemplateRow) : null;
}

/** Modelos que o usuário atual enxerga. A RLS (Etapa 79) já limita: modelo
 * pessoal só aparece para o dono; global e de área aparecem para a equipe
 * clínica, admin e coordenação. */
export async function getEvolutionTemplates(): Promise<EvolutionTemplateView[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("evolution_templates")
    .select(TEMPLATE_SELECT)
    .eq("status", "active")
    .order("scope")
    .order("name");

  return ((data ?? []) as unknown as TemplateRow[]).map(toView);
}

export async function getEvolutionTemplateById(id: string): Promise<EvolutionTemplateView | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("evolution_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", id)
    .maybeSingle();

  return data ? toView(data as unknown as TemplateRow) : null;
}

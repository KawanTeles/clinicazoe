"use server";

import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import type { EvolutionTemplateScope } from "@/lib/supabase/types";

export interface TemplateTopicInput {
  /** Presente ao editar um tópico que já existe; ausente num tópico novo. */
  id?: string;
  label: string;
  hint?: string | null;
  hidden?: boolean;
}

async function requireSession() {
  const session = await getCurrentUser();
  if (!session) throw new Error("Acesso negado.");
  return session;
}

/** Quem pode mexer num modelo desta abrangência?
 *  - `personal` -> o próprio profissional, no modelo dele;
 *  - `area`/`global` -> admin e Coordenação (decisão Q1: o modelo de evolução é
 *    instrumento de gestão clínica e não dá acesso a dado de paciente nenhum).
 *  A mesma regra está nas policies da Etapa 79 — aqui serve para devolver uma
 *  mensagem clara em vez de deixar a RLS recusar com erro genérico. */
async function assertPodeGerenciar(
  session: Awaited<ReturnType<typeof requireSession>>,
  scope: EvolutionTemplateScope,
  ownerProfessionalId: string | null,
) {
  if (scope === "personal") {
    const podeProprio = await can(session.profile, "evolution_templates.manage.own");
    if (!podeProprio || ownerProfessionalId !== session.user.id) {
      throw new Error("Você só pode editar o seu próprio modelo.");
    }
    return;
  }

  const podeCompartilhado = await can(session.profile, "evolution_templates.manage.shared");
  if (!podeCompartilhado) {
    throw new Error("Só a administração e a coordenação editam o modelo padrão da área.");
  }
}

function limparTopicos(topics: TemplateTopicInput[]) {
  return topics
    .map((t) => ({
      id: t.id,
      label: t.label.trim(),
      hint: t.hint?.trim() || null,
      hidden: t.hidden ?? false,
    }))
    .filter((t) => t.label.length > 0);
}

export interface CreateTemplateInput {
  name: string;
  scope: EvolutionTemplateScope;
  specialty_id?: string | null;
  topics: TemplateTopicInput[];
}

export async function createEvolutionTemplate(
  input: CreateTemplateInput,
): Promise<{ error: string | null; id?: string }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "Acesso negado." };
  }

  const rateLimit = checkRateLimit(`evolution-template-write:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const nome = input.name.trim();
  if (!nome) return { error: "Dê um nome ao modelo." };

  const topicos = limparTopicos(input.topics);
  if (topicos.length === 0) return { error: "O modelo precisa de ao menos um tópico." };

  if (input.scope === "global") {
    return { error: "O modelo global é o padrão de fábrica e não pode ser duplicado." };
  }
  if (input.scope === "area" && !input.specialty_id) {
    return { error: "Escolha a área (especialidade) do modelo." };
  }

  const ownerProfessionalId = input.scope === "personal" ? session.user.id : null;

  try {
    await assertPodeGerenciar(session, input.scope, ownerProfessionalId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Acesso negado." };
  }

  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from("evolution_templates")
    .insert({
      name: nome,
      scope: input.scope,
      specialty_id: input.scope === "area" ? input.specialty_id : null,
      owner_professional_id: ownerProfessionalId,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique parcial: já existe modelo ativo para essa área, ou o
    // profissional já tem um modelo pessoal.
    const message =
      error.code === "23505"
        ? input.scope === "area"
          ? "Esta área já tem um modelo ativo. Edite o existente em vez de criar outro."
          : "Você já tem um modelo pessoal. Edite o existente."
        : "Não foi possível criar o modelo.";
    return { error: message };
  }

  const { error: topicsError } = await supabase.from("evolution_template_topics").insert(
    topicos.map((t, i) => ({
      template_id: created.id,
      label: t.label,
      hint: t.hint,
      hidden: t.hidden,
      display_order: i,
    })),
  );

  if (topicsError) {
    // Modelo sem tópico nenhum não serve para nada e ainda ocuparia a unique
    // da área, impedindo uma nova tentativa — desfaz.
    await supabase.from("evolution_templates").delete().eq("id", created.id);
    return { error: "Não foi possível salvar os tópicos. Tente de novo." };
  }

  await supabase.from("evolution_templates").update({ version: 1 }).eq("id", created.id);

  await logAudit({
    actorId: session.user.id,
    action: "evolution_template.created",
    entity: "evolution_templates",
    entityId: created.id,
    metadata: { scope: input.scope, specialty_id: input.specialty_id ?? null, topic_count: topicos.length },
  });

  return { error: null, id: created.id };
}

export interface UpdateTemplateInput {
  id: string;
  name: string;
  topics: TemplateTopicInput[];
}

/**
 * Atualiza nome e tópicos. Os tópicos são comparados um a um em vez de apagados
 * e recriados: recriar trocaria todos os ids a cada gravação e faria a versão
 * do modelo pular de 1 em 1 por tópico, o que deixaria o número de versão
 * (mostrado ao lado do modelo e gravado em cada evolução) sem relação com
 * quantas vezes o modelo foi de fato editado.
 */
export async function updateEvolutionTemplate(
  input: UpdateTemplateInput,
): Promise<{ error: string | null }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "Acesso negado." };
  }

  const rateLimit = checkRateLimit(`evolution-template-write:${session.user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const nome = input.name.trim();
  if (!nome) return { error: "Dê um nome ao modelo." };

  const topicos = limparTopicos(input.topics);
  if (topicos.length === 0) return { error: "O modelo precisa de ao menos um tópico." };
  if (topicos.every((t) => t.hidden)) {
    return { error: "Ao menos um tópico precisa ficar visível." };
  }

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("evolution_templates")
    .select("id, scope, owner_professional_id, is_factory_default")
    .eq("id", input.id)
    .maybeSingle();

  if (!template) return { error: "Modelo não encontrado." };

  try {
    await assertPodeGerenciar(session, template.scope, template.owner_professional_id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Acesso negado." };
  }

  const { data: atuais } = await supabase
    .from("evolution_template_topics")
    .select("id, label, hint, hidden, display_order")
    .eq("template_id", input.id);

  const atualPorId = new Map((atuais ?? []).map((t) => [t.id, t]));
  const idsMantidos = new Set(topicos.map((t) => t.id).filter((id): id is string => Boolean(id)));

  const remover = [...atualPorId.keys()].filter((id) => !idsMantidos.has(id));
  if (remover.length > 0) {
    await supabase.from("evolution_template_topics").delete().in("id", remover);
  }

  // O gatilho evolution_templates_bump_version soma 1 a cada INSERT/UPDATE/
  // DELETE em evolution_template_topics, sem olhar se o conteúdo de fato
  // mudou (ver 0079). Um UPDATE disparado para um tópico sem alteração real
  // ainda assim soma a versão — por isso aqui só escreve quem mudou de fato,
  // não todo tópico mantido. Sem essa checagem, editar um único tópico num
  // modelo de 5 somaria 5 à versão, e o número deixaria de significar "quantas
  // vezes o modelo foi editado".
  for (const [i, topico] of topicos.entries()) {
    const topicoId = topico.id;
    const atual = topicoId ? atualPorId.get(topicoId) : undefined;

    if (atual && topicoId) {
      const mudou =
        atual.label !== topico.label ||
        atual.hint !== topico.hint ||
        atual.hidden !== topico.hidden ||
        atual.display_order !== i;
      if (!mudou) continue;

      await supabase
        .from("evolution_template_topics")
        .update({ label: topico.label, hint: topico.hint, hidden: topico.hidden, display_order: i })
        .eq("id", topicoId);
    } else {
      await supabase.from("evolution_template_topics").insert({
        template_id: input.id,
        label: topico.label,
        hint: topico.hint,
        hidden: topico.hidden,
        display_order: i,
      });
    }
  }

  const { error: nameError } = await supabase
    .from("evolution_templates")
    .update({ name: nome })
    .eq("id", input.id);

  if (nameError) return { error: "Não foi possível salvar o nome do modelo." };

  await logAudit({
    actorId: session.user.id,
    action: "evolution_template.updated",
    entity: "evolution_templates",
    entityId: input.id,
    metadata: { topic_count: topicos.length, removed: remover.length },
  });

  return { error: null };
}

/** Arquiva em vez de apagar (item 24 do pedido: dado clínico nunca perde
 * histórico). Evolução já assinada guarda os rótulos congelados em
 * `topic_contents`, então arquivar o modelo não muda nada no prontuário. O
 * padrão de fábrica é protegido por gatilho no banco e nem chega aqui. */
export async function archiveEvolutionTemplate(id: string): Promise<{ error: string | null }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "Acesso negado." };
  }

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("evolution_templates")
    .select("id, scope, owner_professional_id, is_factory_default")
    .eq("id", id)
    .maybeSingle();

  if (!template) return { error: "Modelo não encontrado." };
  if (template.is_factory_default) {
    return { error: "O modelo padrão de fábrica não pode ser arquivado." };
  }

  try {
    await assertPodeGerenciar(session, template.scope, template.owner_professional_id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Acesso negado." };
  }

  const { error } = await supabase
    .from("evolution_templates")
    .update({ status: "inactive" })
    .eq("id", id);

  if (error) return { error: "Não foi possível arquivar o modelo." };

  await logAudit({
    actorId: session.user.id,
    action: "evolution_template.archived",
    entity: "evolution_templates",
    entityId: id,
    metadata: { scope: template.scope },
  });

  return { error: null };
}

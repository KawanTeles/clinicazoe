"use server";

import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { notify } from "@/modules/notifications/services/notify";
import { getAIFeatureFlags } from "./ai-settings-queries";
import { getActiveAIConfig, checkAIUsageLimits } from "./ai-runtime";
import { AIService } from "./ai-service";
import { parseProtocolAiResponse } from "@/lib/protocol-ai-parser";
import type { ProtocolAiRequestStatus } from "@/lib/supabase/types";

export interface ProtocolAiRequestView {
  id: string;
  description: string;
  specialtyId: string | null;
  status: ProtocolAiRequestStatus;
  resultTemplateId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

/** Fila "Pedidos de IA" (F9) — só os próprios pedidos de quem chama (RLS
 * protocol_ai_requests_select também libera admin, mas a tela de cada
 * profissional só precisa dos dele mesmo). */
export async function getMyProtocolAiRequests(): Promise<ProtocolAiRequestView[]> {
  const session = await getCurrentUser();
  if (!session) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("protocol_ai_requests")
    .select("id, description, specialty_id, status, result_template_id, error_message, created_at")
    .eq("requested_by", session.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    specialtyId: row.specialty_id,
    status: row.status,
    resultTemplateId: row.result_template_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

/**
 * Registra o pedido e devolve na hora (status "pending") — o processamento
 * de verdade (chamar a IA, criar o protocolo) roda depois da resposta via
 * `after()` do Next.js (suportado nativamente em servidor Node.js
 * self-hosted, sem infraestrutura de fila nova — ver docs/after.md). A
 * tela de "Pedidos de IA" mostra o status mudando pra "Criando..." ->
 * "Pronto"/"Erro" a cada refresh/reload, mesmo padrão de polling já usado
 * no sininho de notificações.
 *
 * Sempre cria um protocolo PESSOAL (nunca global/área, mesmo se quem pediu
 * tiver permissão de gerenciar protocolo compartilhado) — mesma decisão de
 * duplicateProtocolTemplate: a IA nunca decide sozinha que algo é padrão da
 * clínica, só gera um rascunho pessoal pra revisão humana.
 */
export async function requestProtocolTemplateFromAI(
  description: string,
  specialtyId?: string | null,
): Promise<{ error: string | null; requestId?: string }> {
  const session = await getCurrentUser();
  if (!session) return { error: "Acesso negado." };

  const [canOwn, canShared] = await Promise.all([
    can(session.profile, "protocol_templates.manage.own"),
    can(session.profile, "protocol_templates.manage.shared"),
  ]);
  if (!canOwn && !canShared) return { error: "Você não tem permissão para criar protocolos." };

  const trimmed = description.trim();
  if (trimmed.length < 10) return { error: "Descreva com um pouco mais de detalhe o que você quer avaliar." };

  const rateLimit = checkRateLimit(`protocol-ai-request:${session.user.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const flags = await getAIFeatureFlags();
  if (!flags.enabled) {
    return { error: "O recurso de IA está desabilitado pelo administrador da clínica." };
  }

  const limitCheck = await checkAIUsageLimits(session.user.id);
  if (limitCheck.blocked) return { error: limitCheck.reason };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("protocol_ai_requests")
    .insert({ requested_by: session.user.id, description: trimmed, specialty_id: specialtyId || null })
    .select("id")
    .single();

  if (error) return { error: "Não foi possível registrar o pedido." };

  const requestId = created.id;
  const ownerProfessionalId = session.user.id;

  after(async () => {
    await processProtocolAiRequest(requestId, ownerProfessionalId);
  });

  await logAudit({
    actorId: session.user.id,
    action: "protocol_ai_request.created",
    entity: "protocol_ai_requests",
    entityId: requestId,
  });

  return { error: null, requestId };
}

/** Roda em segundo plano (after()), depois da resposta já ter voltado pro
 * profissional — por isso usa client admin (service role) pra tudo: não dá
 * pra confiar em cookie/sessão de request depois que a resposta terminou,
 * então `ownerProfessionalId` vem por parâmetro (capturado ANTES do
 * after()), nunca relido daqui. Nunca lança pra fora: todo erro é
 * capturado e grava status "error" com a mensagem, pra a fila mostrar o
 * que aconteceu em vez de travar pedido. */
async function processProtocolAiRequest(requestId: string, ownerProfessionalId: string): Promise<void> {
  const admin = createAdminClient();

  await admin.from("protocol_ai_requests").update({ status: "processing" }).eq("id", requestId);

  try {
    const { data: request } = await admin
      .from("protocol_ai_requests")
      .select("description, specialty_id")
      .eq("id", requestId)
      .maybeSingle();
    if (!request) throw new Error("Pedido não encontrado.");

    let specialtyName: string | null = null;
    if (request.specialty_id) {
      const { data: specialty } = await admin.from("specialties").select("name").eq("id", request.specialty_id).maybeSingle();
      specialtyName = specialty?.name ?? null;
    }

    const { error: configError, config } = await getActiveAIConfig();
    if (configError || !config) throw new Error(configError ?? "Configuração de IA indisponível.");

    const generated = await AIService.generateProtocolTemplateItems({
      description: request.description,
      specialtyName,
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });

    const items = parseProtocolAiResponse(generated.text);
    if (items.length === 0) {
      throw new Error("A IA não devolveu nenhum item reconhecível. Tente descrever de outra forma.");
    }

    const { data: template, error: templateError } = await admin
      .from("protocol_templates")
      .insert({
        name: `Protocolo gerado por IA — ${new Date().toLocaleDateString("pt-BR")}`,
        description: request.description,
        scope: "personal",
        owner_professional_id: ownerProfessionalId,
        created_by: ownerProfessionalId,
      })
      .select("id")
      .single();
    if (templateError || !template) throw new Error("Não foi possível criar o protocolo a partir dos itens gerados.");

    const { error: itemsError } = await admin.from("protocol_items").insert(
      items.map((item, i) => ({ template_id: template.id, domain: item.domain, label: item.label, display_order: i })),
    );
    if (itemsError) throw new Error("Protocolo criado, mas houve falha ao salvar os itens gerados.");

    await admin
      .from("protocol_ai_requests")
      .update({ status: "done", result_template_id: template.id, error_message: null })
      .eq("id", requestId);

    await notify({
      userId: ownerProfessionalId,
      type: "protocol_ai_request.done",
      title: "Protocolo gerado por IA está pronto",
      message: "Revise os itens, ajuste pontuação/faixas se quiser, e publique quando estiver satisfeito.",
      entity: "protocol_templates",
      entityId: template.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao gerar o protocolo.";
    console.error("[protocol-ai] falha ao processar pedido:", err);
    await admin.from("protocol_ai_requests").update({ status: "error", error_message: message }).eq("id", requestId);
  }
}

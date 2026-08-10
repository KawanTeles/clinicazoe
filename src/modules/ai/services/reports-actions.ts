"use server";

import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { getEvolutionsForPatient, type EvolutionView } from "@/modules/evolutions/services/evolution-queries";
import { listPatients, searchOwnPatients, type PatientOption } from "@/modules/patients/services/patient-queries";
import { getAIFeatureFlags } from "./ai-settings-queries";
import { getActiveAIConfig, checkAIUsageLimits } from "./ai-runtime";
import { AIService } from "./ai-service";
import type { ReportTemplate } from "./provider-types";

async function requireProfessionalWithReportsAccess() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  const allowed = await can(session.profile.role, "ai.reports.use");
  if (!allowed) throw new Error("Acesso negado.");
  return session;
}

/** Busca de paciente para o assistente de Relatórios IA: profissional só vê
 * os próprios pacientes. Desde a migration 0031 (sigilo profissional/LGPD)
 * a permissão `ai.reports.use` foi removida do admin, então o ramo abaixo
 * que usa a busca ampla de `listPatients` na prática não é mais alcançado
 * por ninguém além de profissional — mantido apenas para não quebrar o
 * contrato da função caso a permissão do admin seja restaurada no futuro. */
export async function searchPatientsForReport(query: string): Promise<PatientOption[]> {
  const session = await getCurrentUser();
  if (!session) return [];
  const allowed = await can(session.profile.role, "ai.reports.use");
  if (!allowed) return [];

  if (session.profile.role === "profissional") {
    return searchOwnPatients(session.user.id, query);
  }

  const { items } = await listPatients({ search: query || undefined, page: 1 });
  return items.map((p) => ({ id: p.id, fullName: p.fullName, phone: p.phone }));
}

export interface EvolutionOption {
  id: string;
  date: string;
  preview: string;
}

/** Evoluções do paciente escolhido, dentro do período (se informado), para o profissional marcar quais usar no relatório. */
export async function listEvolutionsForReport(
  patientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<EvolutionOption[]> {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") return [];
  const allowed = await can(session.profile.role, "ai.reports.use");
  if (!allowed) return [];

  const evolutions = await getEvolutionsForPatient(patientId);
  const filtered = evolutions.filter((e) => {
    if (!periodStart && !periodEnd) return true;
    if (!e.appointmentDate) return false;
    if (periodStart && e.appointmentDate < periodStart) return false;
    if (periodEnd && e.appointmentDate > periodEnd) return false;
    return true;
  });

  return filtered.map((e) => ({
    id: e.id,
    date: e.appointmentDate,
    preview: e.clinicalEvolution.slice(0, 140),
  }));
}

function formatEvolutionsText(evolutions: EvolutionView[]): string {
  return evolutions
    .map((e) => {
      const date = e.appointmentDate
        ? new Date(`${e.appointmentDate}T00:00:00`).toLocaleDateString("pt-BR")
        : "data não informada";
      const parts = [
        `Data: ${date}`,
        e.sessionSummary && `Resumo da sessão: ${e.sessionSummary}`,
        `Evolução clínica: ${e.clinicalEvolution}`,
        e.objectives && `Objetivos trabalhados: ${e.objectives}`,
        e.interventions && `Intervenções: ${e.interventions}`,
        e.patientResponse && `Resposta do paciente: ${e.patientResponse}`,
        e.homeGuidance && `Orientações para casa: ${e.homeGuidance}`,
        e.observations && `Observações: ${e.observations}`,
      ].filter(Boolean);
      return parts.join("\n");
    })
    .join("\n\n---\n\n");
}

export async function generateAIReport(input: {
  patientId: string;
  template: ReportTemplate;
  periodStart: string;
  periodEnd: string;
  evolutionIds: string[];
}): Promise<{ error: string | null; reportId?: string }> {
  let session;
  try {
    session = await requireProfessionalWithReportsAccess();
  } catch {
    return { error: "Acesso negado." };
  }

  if (input.evolutionIds.length === 0) {
    return { error: "Selecione ao menos uma evolução para gerar o relatório." };
  }

  const flags = await getAIFeatureFlags();
  if (!flags.enabled || !flags.reportsEnabled) {
    return { error: "O recurso de Relatórios IA está desabilitado pelo administrador da clínica." };
  }

  const rateLimit = checkRateLimit(`ai-generate-report:${session.user.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const limitCheck = await checkAIUsageLimits(session.user.id);
  if (limitCheck.blocked) return { error: limitCheck.reason };

  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", input.patientId)
    .maybeSingle();
  if (!patient) return { error: "Paciente não encontrado." };

  // getEvolutionsForPatient já é restrita pela RLS às evoluções do próprio profissional.
  const allEvolutions = await getEvolutionsForPatient(input.patientId);
  const selected = allEvolutions.filter((e) => input.evolutionIds.includes(e.id));
  if (selected.length === 0) {
    return { error: "Nenhuma evolução válida foi selecionada." };
  }

  const { error: configError, config } = await getActiveAIConfig();
  if (configError || !config) return { error: configError };

  const periodLabel =
    input.periodStart && input.periodEnd
      ? `${new Date(`${input.periodStart}T00:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${input.periodEnd}T00:00:00`).toLocaleDateString("pt-BR")}`
      : "todas as evoluções selecionadas";

  let generated: { title: string; content: string; usage?: { inputTokens: number; outputTokens: number } };
  try {
    generated = await AIService.generateReport({
      patientName: patient.full_name,
      template: input.template,
      periodLabel,
      evolutionsText: formatEvolutionsText(selected),
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao gerar o relatório com IA.";
    return { error: message };
  }

  const { data: created, error } = await supabase
    .from("ai_reports")
    .insert({
      patient_id: input.patientId,
      professional_id: session.user.id,
      template: input.template,
      period_start: input.periodStart || null,
      period_end: input.periodEnd || null,
      evolution_ids: selected.map((e) => e.id),
      title: generated.title,
      content: generated.content,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) return { error: "Relatório gerado, mas houve falha ao salvar. Tente novamente." };

  // Integridade referencial: além do array evolution_ids (mantido por
  // compatibilidade com as leituras existentes), grava o mesmo vínculo na
  // tabela ai_report_evolutions (FK real para ai_reports/patient_evolutions).
  await supabase
    .from("ai_report_evolutions")
    .insert(selected.map((e) => ({ report_id: created.id, evolution_id: e.id })));

  await logAudit({
    actorId: session.user.id,
    action: "ai.report.generated",
    entity: "ai_reports",
    entityId: created.id,
    metadata: {
      template: input.template,
      patient_id: input.patientId,
      provider: config.provider,
      tokens_in: generated.usage?.inputTokens,
      tokens_out: generated.usage?.outputTokens,
    },
  });

  return { error: null, reportId: created.id };
}

async function requireOwnedReport(id: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("ai_reports").select("id, professional_id").eq("id", id).maybeSingle();
  if (!data) return { error: "Relatório não encontrado.", supabase };
  if (data.professional_id !== userId) return { error: "Você só pode editar os próprios relatórios.", supabase };
  return { error: null, supabase };
}

export async function updateAIReport(input: {
  id: string;
  title: string;
  content: string;
}): Promise<{ error: string | null }> {
  let session;
  try {
    session = await requireProfessionalWithReportsAccess();
  } catch {
    return { error: "Acesso negado." };
  }

  if (!input.title.trim()) return { error: "Informe um título para o relatório." };

  const { error: ownError, supabase } = await requireOwnedReport(input.id, session.user.id);
  if (ownError) return { error: ownError };

  const { error } = await supabase
    .from("ai_reports")
    .update({ title: input.title.trim(), content: input.content, updated_by: session.user.id })
    .eq("id", input.id);

  if (error) return { error: "Não foi possível salvar as alterações." };

  await logAudit({ actorId: session.user.id, action: "ai.report.updated", entity: "ai_reports", entityId: input.id });

  return { error: null };
}

export async function duplicateAIReport(id: string): Promise<{ error: string | null; reportId?: string }> {
  let session;
  try {
    session = await requireProfessionalWithReportsAccess();
  } catch {
    return { error: "Acesso negado." };
  }

  const { error: ownError, supabase } = await requireOwnedReport(id, session.user.id);
  if (ownError) return { error: ownError };

  const { data: original } = await supabase.from("ai_reports").select("*").eq("id", id).single();
  if (!original) return { error: "Relatório não encontrado." };

  const { data: created, error } = await supabase
    .from("ai_reports")
    .insert({
      patient_id: original.patient_id,
      professional_id: session.user.id,
      template: original.template,
      period_start: original.period_start,
      period_end: original.period_end,
      evolution_ids: original.evolution_ids,
      title: `${original.title} (cópia)`,
      content: original.content,
      status: "draft",
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) return { error: "Não foi possível duplicar o relatório." };

  if (original.evolution_ids.length > 0) {
    await supabase
      .from("ai_report_evolutions")
      .insert(original.evolution_ids.map((evolutionId) => ({ report_id: created.id, evolution_id: evolutionId })));
  }

  await logAudit({
    actorId: session.user.id,
    action: "ai.report.duplicated",
    entity: "ai_reports",
    entityId: created.id,
    metadata: { source_id: id },
  });

  return { error: null, reportId: created.id };
}

export async function finalizeAIReport(id: string): Promise<{ error: string | null }> {
  let session;
  try {
    session = await requireProfessionalWithReportsAccess();
  } catch {
    return { error: "Acesso negado." };
  }

  const { error: ownError, supabase } = await requireOwnedReport(id, session.user.id);
  if (ownError) return { error: ownError };

  const { error } = await supabase
    .from("ai_reports")
    .update({ status: "finalized", updated_by: session.user.id })
    .eq("id", id);

  if (error) return { error: "Não foi possível salvar no prontuário." };

  await logAudit({ actorId: session.user.id, action: "ai.report.finalized", entity: "ai_reports", entityId: id });

  return { error: null };
}

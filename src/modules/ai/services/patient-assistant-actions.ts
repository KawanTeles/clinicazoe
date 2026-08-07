"use server";

import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { getEvolutionsForPatient } from "@/modules/evolutions/services/evolution-queries";
import { getPatientDetail } from "@/modules/patients/services/patient-queries";
import { getAIFeatureFlags } from "./ai-settings-queries";
import { getActiveAIConfig, checkAIUsageLimits } from "./ai-runtime";
import { AIService } from "./ai-service";

async function requireProfessionalWithAssistantAccess() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  const allowed = await can(session.profile.role, "ai.patient_assistant.use");
  if (!allowed) throw new Error("Acesso negado.");
  return session;
}

function formatEvolutionsText(
  evolutions: Awaited<ReturnType<typeof getEvolutionsForPatient>>,
): string {
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

export async function askPatientAssistant(input: {
  patientId: string;
  question: string;
}): Promise<{ error: string | null; answer?: string }> {
  let session;
  try {
    session = await requireProfessionalWithAssistantAccess();
  } catch {
    return { error: "Acesso negado." };
  }

  if (!input.question.trim()) return { error: "Escreva uma pergunta para o assistente." };

  const flags = await getAIFeatureFlags();
  if (!flags.enabled || !flags.patientAssistantEnabled) {
    return { error: "O Assistente do Prontuário está desabilitado pelo administrador da clínica." };
  }

  const rateLimit = checkRateLimit(`ai-patient-assistant:${session.user.id}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const limitCheck = await checkAIUsageLimits(session.user.id);
  if (limitCheck.blocked) return { error: limitCheck.reason };

  const patient = await getPatientDetail(input.patientId);
  if (!patient) return { error: "Paciente não encontrado ou sem acesso." };

  const evolutions = await getEvolutionsForPatient(input.patientId);
  if (evolutions.length === 0) {
    return { error: "Este paciente ainda não tem evoluções registradas para consultar." };
  }

  const { error: configError, config } = await getActiveAIConfig();
  if (configError || !config) return { error: configError };

  let result: { text: string; usage?: { inputTokens: number; outputTokens: number } };
  try {
    result = await AIService.answerPatientQuestion({
      patientName: patient.fullName,
      question: input.question,
      evolutionsText: formatEvolutionsText(evolutions),
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar o assistente de IA.";
    return { error: message };
  }

  await logAudit({
    actorId: session.user.id,
    action: "ai.assistant.question",
    entity: "profiles",
    entityId: input.patientId,
    metadata: {
      provider: config.provider,
      tokens_in: result.usage?.inputTokens,
      tokens_out: result.usage?.outputTokens,
    },
  });

  return { error: null, answer: result.text };
}

"use server";

import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/modules/team/services/audit";
import { getAIFeatureFlags } from "./ai-settings-queries";
import { getTranscriptionAIConfig, checkAIUsageLimits } from "./ai-runtime";
import { transcribeAudioWithWhisper } from "./providers/openai-whisper";

const BUCKET = "session-audio";
const MAX_BYTES = 25 * 1024 * 1024; // teto rígido da própria API do Whisper — não configurável
const ALLOWED_EXTENSIONS = ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"];

async function requireProfessionalWithAIAccess() {
  const session = await getCurrentUser();
  if (!session || session.profile.role !== "profissional") {
    throw new Error("Acesso negado.");
  }
  const allowed = await can(session.profile.role, "ai.evolution_assistant.use");
  if (!allowed) throw new Error("Acesso negado.");
  return session;
}

/** Envia o áudio da sessão para transcrição (Whisper) e retorna o texto
 * bruto — o mesmo texto que já alimenta improveEvolutionText hoje, sem
 * nenhuma mudança nesse fluxo. O áudio nunca fica: sobe para o bucket
 * `session-audio`, é enviado à OpenAI, e o objeto é removido logo em
 * seguida — sucesso ou falha, só o texto (em caso de sucesso) sobrevive. */
export async function transcribeSessionAudio(formData: FormData): Promise<{ error: string | null; text?: string }> {
  let session;
  try {
    session = await requireProfessionalWithAIAccess();
  } catch {
    return { error: "Acesso negado." };
  }

  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  if (!appointmentId) return { error: "Consulta não informada." };

  // Mesmo padrão de improveEvolutionText: confere o toggle global (ai_enabled)
  // e o toggle específico do recurso (aqui, transcriptionEnabled) antes de
  // gastar qualquer chamada de API.
  const flags = await getAIFeatureFlags();
  if (!flags.enabled || !flags.transcriptionEnabled) {
    return { error: "A transcrição de áudio está desabilitada pelo administrador da clínica." };
  }

  const rateLimit = checkRateLimit(`transcribe-audio:${session.user.id}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return { error: `Muitas tentativas. Aguarde ${rateLimit.retryAfterSeconds}s e tente de novo.` };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Nenhum áudio selecionado." };
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { error: "Formato inválido. Envie um áudio MP3, M4A, WAV, WEBM ou MP4." };
  }
  if (file.size > MAX_BYTES) {
    return {
      error: "Áudio muito grande (limite de 25MB, teto da própria API). Grave em formato comprimido (m4a/mp3).",
    };
  }

  const limitCheck = await checkAIUsageLimits(session.user.id);
  if (limitCheck.blocked) return { error: limitCheck.reason };

  const { error: configError, config } = await getTranscriptionAIConfig();
  if (configError || !config) return { error: configError };

  const supabase = await createClient();

  // Confirma o vínculo com a consulta em JS antes de gastar a chamada à
  // OpenAI — mesmo espírito de createEvolution (evolution-actions.ts)
  // validando antes de deixar o trigger de banco (session_transcriptions_validate)
  // barrar como última linha de defesa.
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id, professional_id, status")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appointment) return { error: "Consulta não encontrada." };

  const isPrincipal = appointment.professional_id === session.user.id;
  let isCoTherapist = false;
  if (!isPrincipal) {
    const { data: link } = await supabase
      .from("appointment_professionals")
      .select("professional_id")
      .eq("appointment_id", appointmentId)
      .eq("professional_id", session.user.id)
      .maybeSingle();
    isCoTherapist = Boolean(link);
  }
  if (!isPrincipal && !isCoTherapist) {
    return { error: "Você só pode transcrever áudio das consultas às quais está vinculado." };
  }
  if (!["confirmada", "concluida"].includes(appointment.status)) {
    return { error: "Só é possível transcrever áudio de consultas realizadas." };
  }

  const path = `${session.user.id}/${appointmentId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (uploadError) return { error: "Falha ao enviar o áudio. Tente novamente." };

  let transcribedText: string;
  try {
    const result = await transcribeAudioWithWhisper(config.apiKey, file, file.name);
    transcribedText = result.text;
  } catch (err) {
    await supabase.storage.from(BUCKET).remove([path]);
    const message = err instanceof Error ? err.message : "Falha ao transcrever o áudio.";
    return { error: message };
  }

  // Sucesso: apaga o áudio do storage imediatamente — só o texto fica.
  await supabase.storage.from(BUCKET).remove([path]);

  // Se o insert falhar aqui, o profissional já tem o texto na mão (é o que
  // importa para o fluxo) — só não sobra registro de auditoria da
  // transcrição em si. Não vale barrar o retorno do texto por causa disso.
  await supabase.from("session_transcriptions").insert({
    appointment_id: appointmentId,
    patient_id: appointment.patient_id,
    professional_id: session.user.id,
    transcribed_text: transcribedText,
    created_by: session.user.id,
  });

  await logAudit({
    actorId: session.user.id,
    action: "ai.transcription.completed",
    entity: "session_transcriptions",
    entityId: appointmentId,
    metadata: { appointment_id: appointmentId, patient_id: appointment.patient_id, file_size_bytes: file.size },
  });

  return { error: null, text: transcribedText };
}

import "server-only";

export interface TranscriptionResult {
  text: string;
}

/** Modelo de transcrição da OpenAI. Trocado de whisper-1 para
 * gpt-4o-mini-transcribe (decisão do usuário, Etapa 83): mesmo endpoint
 * (/v1/audio/transcriptions, que a documentação da OpenAI lista sem nenhuma
 * retenção por padrão — nem os 30 dias de monitoramento de abuso que valem
 * para outros endpoints), menor taxa de erro e menor custo por minuto que o
 * Whisper original. Mantido como constante (não como parâmetro) porque não
 * há hoje nenhum motivo de produto para variar por chamada. */
const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

/** Transcreve um áudio via API de transcrição da OpenAI. Chave dedicada
 * (ai_settings.transcription_api_key_ciphertext), independente do provedor
 * de texto principal.
 *
 * `language: "pt"` e `prompt` (glossário de termos da área, Etapa 83) são
 * parâmetros aceitos por este modelo especificamente (não presumir que
 * funcionam em qualquer modelo de transcrição — gpt-4o-mini-transcribe e
 * gpt-4o-transcribe só devolvem `response_format: json`, por isso o parsing
 * abaixo nunca tenta outro formato).
 */
export async function transcribeAudio(
  apiKey: string,
  audio: Blob,
  fileName: string,
  options?: { glossary?: string | null },
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("file", audio, fileName);
  formData.append("model", TRANSCRIPTION_MODEL);
  formData.append("language", "pt");
  if (options?.glossary?.trim()) {
    formData.append("prompt", options.glossary.trim());
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    // Timeout maior que os providers de texto: até 25MB de áudio (~50-90min
    // de sessão em m4a/mp3) leva mais tempo pra processar do que uma
    // chamada de chat completion comum.
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha na chamada à OpenAI (${TRANSCRIPTION_MODEL}, ${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  if (typeof data?.text !== "string" || !data.text.trim()) {
    throw new Error("A OpenAI retornou uma transcrição vazia.");
  }

  return { text: data.text.trim() };
}

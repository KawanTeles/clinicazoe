import "server-only";

export interface TranscriptionResult {
  text: string;
}

/** Transcreve um áudio via API de transcrição da OpenAI (Whisper). Chave
 * dedicada (ai_settings.transcription_api_key_ciphertext), independente do
 * provedor de texto principal. */
export async function transcribeAudioWithWhisper(
  apiKey: string,
  audio: Blob,
  fileName: string,
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("file", audio, fileName);
  formData.append("model", "whisper-1");

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
    throw new Error(`Falha na chamada à OpenAI Whisper (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  if (typeof data?.text !== "string" || !data.text.trim()) {
    throw new Error("A OpenAI retornou uma transcrição vazia.");
  }

  return { text: data.text.trim() };
}

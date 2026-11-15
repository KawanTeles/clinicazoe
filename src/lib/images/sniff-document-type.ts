import "server-only";

/**
 * Mesmo princípio de sniff-image-type.ts (Etapa 78): o `file.type` que o
 * navegador manda num upload é uma string que o client escolhe livremente —
 * aqui, anexo de evolução aceita PDF e áudio além de imagem, então a
 * validação por bytes precisa cobrir os dois formatos novos também.
 *
 * Áudio não tem um único magic number confiável para todo container (ID3 de
 * MP3 varia, M4A/MP4 têm o átomo "ftyp" num offset que também varia um
 * pouco) — por isso só WAV e WebM são efetivamente verificados por bytes;
 * MP3/M4A caem no mesmo nível de confiança que o pipeline de transcrição já
 * aceita desde a Etapa 46 (extensão + Content-Type declarado), sem regressão
 * em relação ao que já existia.
 */
export type SniffedDocumentKind = "pdf" | "wav" | "webm" | "unknown";

export function sniffDocumentType(buffer: Buffer): SniffedDocumentKind {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "pdf";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    return "wav";
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return "webm";
  }
  return "unknown";
}

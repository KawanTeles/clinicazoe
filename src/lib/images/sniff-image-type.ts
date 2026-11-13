import "server-only";

/**
 * Detecta o formato real de um arquivo pelos primeiros bytes (magic
 * numbers), em vez de confiar em `file.type` — o Content-Type que o
 * navegador manda num upload é só uma string que o próprio client
 * (potencialmente um atacante usando a API `File` direto, fora do
 * formulário) escolhe livremente. Sem essa checagem, alguém podia declarar
 * "image/webp" e mandar bytes de AVIF/TIFF/outro formato que o sharp
 * decodifica de qualquer jeito (ele detecta o formato pelo conteúdo, não
 * pelo Content-Type) — abrindo os endpoints de upload para qualquer
 * vulnerabilidade de decodificação do sharp além dos três formatos que cada
 * endpoint realmente pretende aceitar.
 */
export type SniffedImageType = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml" | null;

export function sniffImageType(buffer: Buffer): SniffedImageType {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  // SVG é texto, não tem magic number binário — aceita BOM UTF-8 opcional e
  // comentários/doctype antes do elemento <svg>, igual todo parser XML.
  const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^<(\?xml|!--|!doctype|svg)/i.test(head) && /<svg[\s>]/i.test(head)) {
    return "image/svg+xml";
  }
  return null;
}

import "server-only";
import sharp from "sharp";

export interface ProcessImageOptions {
  /** Lado maior em pixels — a imagem nunca é alargada, só reduzida (withoutEnlargement). */
  maxDimension: number;
  /** Qualidade WebP (0-100). */
  quality?: number;
}

export interface ProcessedImage {
  buffer: Buffer;
  contentType: "image/webp";
}

/**
 * Redimensiona, converte para WebP e remove metadados (EXIF/ICC) de uma
 * imagem enviada pelo usuário. `.rotate()` sem argumento aplica a
 * orientação já gravada no EXIF da foto original antes de descartar o
 * próprio EXIF — sem isso, fotos tiradas em celular na vertical apareceriam
 * rotacionadas 90°, já que o WebP de saída não carrega mais essa tag.
 */
export async function processImageToWebp(
  input: Buffer,
  { maxDimension, quality = 80 }: ProcessImageOptions,
): Promise<ProcessedImage> {
  const buffer = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  return { buffer, contentType: "image/webp" };
}

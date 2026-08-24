import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.AI_SECRET_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "AI_SECRET_KEY não configurada corretamente (defina uma chave hex de 32 bytes, ex.: openssl rand -hex 32).",
    );
  }
  return Buffer.from(hex, "hex");
}

/** Criptografa um segredo (ex.: API key de provedor de IA) para armazenamento em banco. Nunca guardar o valor em texto puro. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(".");
}

/** Reverte encryptSecret. Lança erro se o payload estiver corrompido ou a chave tiver mudado. */
export function decryptSecret(ciphertext: string): string {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = ciphertext.split(".");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Formato inválido de segredo criptografado.");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"), {
    authTagLength: 16,
  });
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

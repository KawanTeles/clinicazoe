import "server-only";
import { headers } from "next/headers";

/** Extrai o IP do cliente a partir dos cabeçalhos da requisição (proxy/CDN à frente da app). Retorna null se indisponível — nunca vem do client. */
export async function getRequestIp(): Promise<string | null> {
  try {
    const hdrs = await headers();
    const forwardedFor = hdrs.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
    return hdrs.get("x-real-ip");
  } catch {
    return null;
  }
}

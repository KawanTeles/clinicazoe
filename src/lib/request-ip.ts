import "server-only";
import { headers } from "next/headers";

/** Extrai o IP do cliente a partir dos cabeçalhos da requisição (proxy/CDN à frente da app).
 * Retorna null se indisponível — nunca vem do client.
 * x-forwarded-for/x-real-ip são forjáveis por definição por quem faz a requisição
 * diretamente à origem (sem passar pelo proxy/CDN que os define de verdade); isso
 * só compromete a confiabilidade forense do audit log e do rate-limit por IP, não
 * é uma trava de segurança — aceito como limitação conhecida, sem correção real
 * possível sem controlar a borda de rede (ex.: validar a origem da conexão). */
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

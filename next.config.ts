import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

// CSP: 'unsafe-inline' em script-src é necessário pelo script de tema (evita
// FOUC lendo localStorage antes do primeiro paint) e pelos blocos JSON-LD,
// ambos inline por natureza no App Router. connect-src/frame-src liberam
// apenas Supabase (dados/storage) e o embed do Google Maps já usado em
// LocationSection — nenhum outro host de terceiros é carregado pelo site.
// 'unsafe-eval' só em dev: o React usa eval() para stack traces do modo
// desenvolvimento (nunca em produção), e o Turbopack/Fast Refresh também
// depende dele — sem isso o CSP bloqueia o próprio HMR.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self'${supabaseHostname ? ` https://${supabaseHostname}` : ""}`,
  `frame-src 'self' https://www.google.com https://maps.google.com`,
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  // Sem isso, o Next só desabilita metadata em streaming (title/description
  // resolvidos de forma assíncrona, fora do HTML inicial) para uma lista
  // padrão de bots. Auditoria com Lighthouse (UA genérico de Chrome) expôs
  // páginas dinâmicas sem <meta name="description"> no HTML inicial — mesmo
  // risco vale para rastreadores/unfurlers não cobertos pela lista padrão
  // (ex.: WhatsApp, usado pesadamente pela clínica). Desabilitar streaming
  // de metadata por completo garante que title/description/OG sempre
  // cheguem no primeiro payload, para qualquer visitante ou bot.
  htmlLimitedBots: /.*/,
  experimental: {
    serverActions: {
      // Default do Next é 1MB — abaixo até dos uploads menores que já
      // existiam (avatar 3MB, logo da clínica 2MB, documentos clínicos
      // 10MB), fora o áudio de sessão (25MB, teto da própria API do
      // Whisper). Sem isso, qualquer arquivo acima de 1MB falha ao chegar
      // na Server Action antes mesmo da validação de tamanho no código.
      bodySizeLimit: "30mb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      ...(supabaseHostname
        ? [
            { protocol: "https" as const, hostname: supabaseHostname, pathname: "/storage/v1/object/sign/**" },
            { protocol: "https" as const, hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" },
          ]
        : []),
      { protocol: "https" as const, hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // www.espacozoeoficial.com.br respondia 200 duplicado, sem redirecionar
  // para o apex — mesmo conteúdo em dois hosts, o que o Search Console pode
  // tratar como URL fora do domínio verificado ("URL não permitido") quando
  // a propriedade cobre só um host. Canonical/sitemap já usam o apex sem
  // www (src/lib/site-url.ts), então força esse mesmo host aqui.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.espacozoeoficial.com.br" }],
        destination: "https://espacozoeoficial.com.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

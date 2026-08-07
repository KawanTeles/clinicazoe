import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

// CSP: 'unsafe-inline' em script-src é necessário pelo script de tema (evita
// FOUC lendo localStorage antes do primeiro paint) e pelos blocos JSON-LD,
// ambos inline por natureza no App Router. connect-src/frame-src liberam
// apenas Supabase (dados/storage) e o embed do Google Maps já usado em
// LocationSection — nenhum outro host de terceiros é carregado pelo site.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'`,
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
};

export default nextConfig;

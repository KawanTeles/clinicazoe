// Service worker do PWA "Espaço Zoe" — escopo deliberadamente mínimo.
//
// REGRA DE PRIVACIDADE (obrigatória, dado de saúde de criança): este SW
// NUNCA guarda em cache página autenticada, resposta de API, anexo ou
// evolução. Só cacheia arquivos estáticos (ícones, JS/CSS gerado pelo
// Next, fontes) e a tela offline genérica abaixo. Qualquer requisição que
// não bata num dos padrões de STATIC_PATTERNS vai direto pra rede, sem
// passar pelo Cache Storage — inclusive toda navegação autenticada (o
// fallback de offline.html só entra quando a rede falha, nunca cacheando a
// página real). Se alterar este arquivo, não adicione padrões que cubram
// /api/, RSC payloads ou rotas do painel (admin)/cliente.
const CACHE_NAME = "zoe-static-v1";

const PRECACHE_URLS = [
  "/offline.html",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/favicon.ico",
];

const STATIC_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /^\/fonts\//,
  /^\/sounds\//,
  /^\/(favicon|favicon-16x16|favicon-32x32|apple-touch-icon|android-chrome-192x192|android-chrome-512x512|maskable-icon-512|brand-logo|logo|og-image)\.(ico|png|jpg|jpeg|svg)$/,
  /^\/site\.webmanifest$/,
];

function isStaticAsset(pathname) {
  return STATIC_PATTERNS.some((pattern) => pattern.test(pathname));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação de página (endereço digitado, link, refresh): direto pra
  // rede; só cai pra tela offline estática se a rede falhar de verdade.
  // Nunca serve uma página autenticada antiga do cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  if (!isStaticAsset(url.pathname)) {
    // API, RSC, dados do painel — sempre rede, nunca Cache Storage.
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

// Limpa qualquer cache deste SW quando a página pede (logout) — defesa
// extra: mesmo não cacheando dado clínico, garante que nada do Cache
// Storage sobrevive ao fim da sessão.
self.addEventListener("message", (event) => {
  if (event.data === "clear-caches") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
  }
});

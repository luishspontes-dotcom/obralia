// Obralia — service worker mínimo
// Estratégia: network-first pra HTML/API, cache-first pra assets estáticos.

const CACHE = "obralia-v1";
const STATIC_ASSETS = [
  "/",
  "/inicio",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pula chamadas a APIs (Supabase, /api/*)
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/api/")) return;

  // Cache-first pra assets estáticos do _next/static
  if (url.pathname.startsWith("/_next/static") || /\.(png|jpg|jpeg|webp|svg|ico|css|js|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() => caches.match("/"));
      })
    );
    return;
  }

  // Network-first com fallback de cache pra navegação
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req).then((c) => c ?? caches.match("/")))
    );
  }
});

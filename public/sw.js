// Obralia — service worker v2 (offline real pro canteiro)
// Estratégias:
//   • Navegações: network-first → fallback cache → /offline
//   • Assets estáticos (_next/static, fonts, ícones): cache-first
//   • Imagens do Supabase Storage: stale-while-revalidate com cap de ~200 entradas
//   • NUNCA cacheia POST / server actions / APIs (auth, rest)

const CACHE = "obralia-v2";
const IMG_CACHE = "obralia-img-v2";
const IMG_CACHE_MAX = 200;

const PRECACHE_SHELL = [
  "/",
  "/inicio",
  "/obras",
  "/offline",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll falha em bloco se uma rota der erro — cacheia uma a uma
      Promise.all(
        PRECACHE_SHELL.map((url) =>
          cache.add(url).catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== IMG_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/** Mantém o cache de imagens limitado (FIFO simples ≈ LRU pra esse uso). */
async function trimImageCache() {
  const cache = await caches.open(IMG_CACHE);
  const keys = await cache.keys();
  if (keys.length <= IMG_CACHE_MAX) return;
  const excess = keys.length - IMG_CACHE_MAX;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // NUNCA cacheia POST/PUT/etc — server actions e mutações passam direto
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Imagens do Supabase Storage: stale-while-revalidate com cap
  if (url.hostname.includes("supabase.co") && url.pathname.includes("/storage/")) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              cache.put(req, res.clone()).then(() => trimImageCache()).catch(() => null);
            }
            return res;
          })
          .catch(() => null);
        if (cached) return cached;
        const res = await network;
        return res ?? Response.error();
      })
    );
    return;
  }

  // Demais chamadas ao Supabase (auth, rest, realtime) e /api/*: nunca interceptar
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/api/")) return;

  // Cache-first pra assets estáticos (_next/static, fonts, ícones, css/js)
  if (
    url.pathname.startsWith("/_next/static") ||
    /\.(png|jpg|jpeg|webp|svg|ico|css|js|woff2?|ttf)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Navegações: network-first → cache da própria rota → /offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          if (offline) return offline;
          const home = await caches.match("/");
          return home ?? Response.error();
        })
    );
  }
});

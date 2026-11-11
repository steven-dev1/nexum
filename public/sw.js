/* Nexum · service worker
 *
 * Mínimo a propósito: hace instalable la app y, si no hay conexión al abrir una página,
 * muestra /offline. No guarda en caché páginas ni datos (son privados y cambian a diario).
 */
const VERSION = "nexum-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Solo navegaciones (abrir una página); todo lo demás va directo a la red.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(VERSION);
      return (await cache.match(OFFLINE_URL)) ?? Response.error();
    }),
  );
});

/* Nexum · service worker
 *
 * - Hace instalable la app y recibe las notificaciones push.
 * - Modo sin conexión: guarda los recursos estáticos y las últimas páginas que viste, para abrirlas si se cae la red.
 *   Las páginas tienen datos personales, así que: solo se guardan las navegaciones normales (no /api, /login ni
 *   /invitacion), duran 24 h, son pocas, y se borran todas al llegar a /login (cerrar sesión o sesión vencida).
 * - No hay escritura sin conexión: las acciones de guardar necesitan red.
 */
const VERSION = "nexum-v3";
const STATIC_CACHE = "nexum-static-v3";
const PAGES_CACHE = "nexum-pages-v3";
const OFFLINE_URL = "/offline";
const PAGE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PAGES = 12;
const NETWORK_TIMEOUT_MS = 4000;
const NEVER_CACHE = ["/api/", "/login", "/invitacion", "/acceso", "/sw.js", "/offline"];

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
      .then((keys) => Promise.all(keys.filter((k) => ![VERSION, STATIC_CACHE, PAGES_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// --- Notificaciones push ----------------------------------------------------
// Payload esperado (JSON): { title, body, url, tag }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Nexum";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/pwa-icon/192",
      badge: "/pwa-icon/192",
      tag: data.tag, // una notificación con el mismo tag reemplaza a la anterior
      data: { url: data.url || "/" },
    }),
  );
});

// Al tocar la notificación: enfoca la app si está abierta, o la abre en la sección indicada.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    }),
  );
});

// --- Sin conexión ---------------------------------------------------------------

const isStaticAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon/");
const isNeverCached = (url) => NEVER_CACHE.some((p) => url.pathname === p || url.pathname.startsWith(p));

/** Guarda una copia de la página con su fecha, y mantiene solo las más recientes. */
async function savePage(request, response) {
  const cache = await caches.open(PAGES_CACHE);
  const headers = new Headers(response.headers);
  headers.set("x-sw-cached-at", String(Date.now()));
  const body = await response.blob();
  await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }));
  const keys = await cache.keys();
  if (keys.length > MAX_PAGES) await Promise.all(keys.slice(0, keys.length - MAX_PAGES).map((k) => cache.delete(k)));
}

/** Última copia guardada de la página, si no tiene más de 24 h. */
async function savedPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  const hit = await cache.match(request, { ignoreVary: true });
  if (!hit) return null;
  const at = Number(hit.headers.get("x-sw-cached-at") || 0);
  if (Date.now() - at > PAGE_TTL_MS) {
    await cache.delete(request);
    return null;
  }
  return hit;
}

/** Red primero (con tiempo límite); si falla, la última copia; si no hay, la página «sin conexión». */
async function navigate(event) {
  const request = event.request;
  const url = new URL(request.url);

  // Llegar a /login (cerrar sesión o sesión vencida) borra las copias: no deben sobrevivir a la sesión.
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) await caches.delete(PAGES_CACHE);

  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)),
    ]);
    // Solo se guardan respuestas normales de páginas de la app (no redirecciones, errores ni rutas privadas aparte).
    if (response.ok && !response.redirected && response.type === "basic" && !isNeverCached(url)) {
      event.waitUntil(savePage(request, response.clone()).catch(() => {}));
    }
    return response;
  } catch {
    const saved = isNeverCached(url) ? null : await savedPage(request);
    if (saved) return saved;
    const cache = await caches.open(VERSION);
    return (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

/** Recursos con nombre único (/_next/static): primero la copia, y se actualiza en segundo plano. */
async function staticAsset(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  const network = fetch(event.request)
    .then((response) => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(event));
  } else if (isStaticAsset(url)) {
    event.respondWith(staticAsset(event));
  }
  // Todo lo demás (datos de Next, /api, acciones) va directo a la red.
});

// La app puede pedir borrar las copias (p. ej. al cerrar sesión).
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES_CACHE));
});

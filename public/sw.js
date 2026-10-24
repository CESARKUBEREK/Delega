// Service worker de Orkesta.
// - Sin conexión: si una navegación falla, muestra la página /offline.
// - No guarda en caché páginas ni datos de clientes: solo /offline y los iconos.
// - Avisos: muestra los avisos Web Push y abre la app al tocarlos.
const CACHE = "orkesta-v1"
const OFFLINE_URL = "/offline"
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/badge-96.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.mode !== "navigate" || request.method !== "GET") return
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL)
      return cached || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    }),
  )
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = typeof data.title === "string" ? data.title : "Orkesta"
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/abrir"
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      renotify: typeof data.tag === "string",
      lang: "es",
      data: { url },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const path = event.notification.data && typeof event.notification.data.url === "string" ? event.notification.data.url : "/abrir"
  const target = new URL(path.startsWith("/") ? path : "/abrir", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Si la app ya está abierta, se reutiliza esa ventana.
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (!open) return self.clients.openWindow(target)
      return open
        .focus()
        .then((w) => (w && "navigate" in w ? w.navigate(target) : null))
        .catch(() => self.clients.openWindow(target))
    }),
  )
})

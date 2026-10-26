// Comandero sin internet: guarda la app en el aparato para que abra aunque no haya señal.
// La página siempre se pide primero a internet (así llegan las versiones nuevas); si no hay, sale la guardada.
const CACHE = "comandero-v1";
const BASE = ["/", "/index.html", "/icono.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== self.location.origin) return; // los datos van directo a Supabase
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put("/index.html", copia)); return r; })
      .catch(() => caches.match("/index.html")));
    return;
  }
  // Archivos con huella en el nombre (/assets/…) no cambian: se sirven de lo guardado
  if (u.pathname.startsWith("/assets/") || /\.(svg|png|webp|woff2?|webmanifest)$/.test(u.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return r;
    })));
  }
});

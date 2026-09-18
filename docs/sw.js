/* Service worker de la edición web de ParlaIbero · Explorador de Diarios de Sesiones.
 * Guarda en caché la aplicación (HTML, CSS, JS, worker, wasm y capitulares) para abrirla sin conexión; la versión
 * es el build_id del ensamblado, así que cada ensamblado nuevo se instala aparte y se activa al recargar. */
const VERSION = '38f86229a49ad1a5';
const CACHE = `diarios-explorer-${VERSION}`;
const PRECARGA = ["./", "./index.html", "./app.css?v=38f86229a49ad1a5", "./app.js?v=38f86229a49ad1a5", "./worker.js?v=38f86229a49ad1a5", "./sqlite3.wasm?v=38f86229a49ad1a5"];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECARGA)).catch(() => {}));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('diarios-explorer-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (ev) => {
  const d = ev.data || {};
  if (d.tipo === 'saltar_espera') self.skipWaiting();
  else if (d.tipo === 'version' && ev.source) ev.source.postMessage({ tipo: 'version_sw', version: VERSION, almacen: CACHE });
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  ev.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: false });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok && (u.pathname.endsWith('.svg') || u.pathname.endsWith('.wasm') || u.pathname.endsWith('.js') || u.pathname.endsWith('.css') || u.pathname.endsWith('.html') || u.pathname.endsWith('/'))) {
        c.put(req, r.clone()).catch(() => {});
      }
      return r;
    } catch (e) {
      const alt = await c.match('./index.html');
      if (alt && req.mode === 'navigate') return alt;
      throw e;
    }
  })());
});

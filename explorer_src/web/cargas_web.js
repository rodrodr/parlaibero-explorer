(function (R2) {
  'use strict';
  // Edición web (GitHub Pages): los recursos no viajan embebidos en el HTML; se descargan del mismo sitio.
  // Misma API que src/cargas/cargas.js (preparar, info, nombres, bytes, texto, wasm, urlWorker, archivoCorpus, errorDatos).
  const hayDom = typeof document !== 'undefined';
  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const tiempos = {};
  let datosLeidos = null;

  function danado(causa) {
    const e = new Error(`Recurso dañado: ${causa}`);
    e.codigo = 'RECURSO_DANADO';
    e.causa = causa;
    return e;
  }

  function leerDatos() {
    const el = hayDom ? document.getElementById('r2-datos') : null;
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { throw danado(`datos estáticos: ${e.message}`); }
  }

  const recursos = () => (R2.datos && R2.datos.recursos) || {};
  // version_web: huella de todas las fuentes (también los datos); build_id solo cambia con el worker.
  const version = () => (R2.datos && R2.datos.edicion && (R2.datos.edicion.version_web || R2.datos.edicion.build_id)) || '';
  const url = (nombre) => `${(recursos()[nombre] && recursos()[nombre].archivo) || nombre}?v=${encodeURIComponent(version())}`;

  async function descargar(nombre) {
    const t0 = ahora();
    const meta = recursos()[nombre] || {};
    let u8;
    try {
      const r = await fetch(url(nombre), { credentials: 'same-origin' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      u8 = new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      throw danado(`${nombre}: no se pudo descargar (${e && e.message ? e.message : e})`);
    }
    if (meta.bytes != null && u8.length !== Number(meta.bytes)) throw danado(`${nombre}: ${u8.length} bytes en lugar de ${meta.bytes}`);
    if (meta.sha256 && R2.sha256 && typeof R2.sha256.hex === 'function') {
      const h = R2.sha256.hex(u8);
      if (h !== meta.sha256) throw danado(`${nombre}: SHA-256 ${h} en lugar de ${meta.sha256}`);
    }
    tiempos[nombre] = { total_ms: ahora() - t0, bytes: u8.length };
    return u8;
  }

  const cache = new Map();
  function bytes(nombre) {
    if (!cache.has(nombre)) {
      const p = descargar(nombre);
      p.catch(() => cache.delete(nombre));
      cache.set(nombre, p);
    }
    return cache.get(nombre).then((u8) => u8.slice());
  }
  const texto = (nombre) => bytes(nombre).then((u8) => new TextDecoder('utf-8', { fatal: true }).decode(u8));
  const wasm = () => bytes('wasm').then((u8) => u8.buffer);
  const urlWorker = () => Promise.resolve(url('worker'));
  const preparar = () => Promise.all([wasm(), urlWorker()]).then(([w, u]) => ({ wasm: w, urlWorker: u, tiempos }));
  /** Nombres de los recursos que hay en el sitio (los descargables), no los embebidos. */
  const nombres = () => Object.keys(recursos());
  /** info(nombre): null para «corpus» y «capitales» (no viajan con la página); el resto, su ficha. */
  const info = (nombre) => (nombre === 'corpus' || nombre === 'capitales' ? null : (recursos()[nombre] || null));
  const archivoCorpus = () => Promise.resolve(null);

  R2.cargas = { nombres, info, bytes, texto, wasm, urlWorker, archivoCorpus, preparar, tiempos, errorDatos: null, web: true };

  try {
    datosLeidos = leerDatos();
    if (datosLeidos) R2.datos = Object.assign({}, datosLeidos, R2.datos || {});
  } catch (e) {
    R2.cargas.errorDatos = e;
  }

  if (hayDom) {
    document.addEventListener('click', (ev) => {
      const t = ev.target && typeof ev.target.closest === 'function' ? ev.target : null;
      if (!t) return;
      const abrir = t.closest('[data-abrir-creditos]');
      if (abrir) {
        const dlg = document.getElementById('dlgCreditos');
        if (dlg && !dlg.open && typeof dlg.showModal === 'function') { ev.preventDefault(); dlg.showModal(); }
        return;
      }
      const cerrar = t.closest('#dlgCreditos [data-close]');
      if (cerrar) cerrar.closest('dialog').close();
    });
  }
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=diarios-explorer/web/cargas_web.js

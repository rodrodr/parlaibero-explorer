




























(function (R2) {
  'use strict';

  const PREFIJO = 'r2-carga-';
  const hayDom = typeof document !== 'undefined' && typeof document.getElementById === 'function';
  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const decodificadas = new Map();
  const metas = new Map();
  const tiempos = {};

  function danado(causa) {
    const e = new Error(`Recurso dañado: ${causa}`);
    e.codigo = 'RECURSO_DANADO';
    e.causa = causa;
    return e;
  }

  function desdeBase64(texto, nombre) {
    const limpio = String(texto).replace(/\s+/g, '');
    try {
      if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(limpio);
      const bin = atob(limpio);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    } catch (e) {
      throw danado(`${nombre}: base64 inválido (${e && e.message ? e.message : e})`);
    }
  }


  function decodificar(texto, { bytes = null, sha256 = null, nombre = 'carga', tiempos: t = {} } = {}) {
    let t0 = ahora();
    const gz = desdeBase64(texto, nombre);
    t.base64_ms = ahora() - t0;
    t0 = ahora();
    let u8;
    try { u8 = R2.inflate.gunzip(gz); } catch (e) { throw danado(`${nombre}: ${e && e.message ? e.message : e}`); }
    t.inflate_ms = ahora() - t0;
    if (bytes != null && u8.length !== Number(bytes)) throw danado(`${nombre}: ${u8.length} bytes en lugar de ${bytes}`);
    t0 = ahora();
    if (sha256) {
      const h = R2.sha256.hex(u8);

      if (h !== sha256) throw danado(`${nombre}: SHA-256 ${h} en lugar de ${String(sha256)}`);
    }
    t.sha256_ms = ahora() - t0;
    return u8;
  }

  const elemento = (nombre) => (hayDom ? document.getElementById(PREFIJO + nombre) : null);

  function info(nombre) {
    if (metas.has(nombre)) return metas.get(nombre);
    const el = elemento(nombre);
    if (!el) return null;
    const m = { nombre, enc: el.getAttribute('data-enc'), bytes: Number(el.getAttribute('data-bytes')),
      sha256: el.getAttribute('data-sha256'), bytes_base64: el.textContent.length };
    metas.set(nombre, m);
    return m;
  }

  function nombres() {
    const s = new Set(metas.keys());
    if (hayDom) for (const el of document.querySelectorAll(`script[id^="${PREFIJO}"]`)) s.add(el.id.slice(PREFIJO.length));
    return [...s];
  }


  const ceder = () => new Promise((resolver) => setTimeout(resolver, 0));

  function bytes(nombre) {
    let p = decodificadas.get(nombre);
    if (!p) {
      p = (async () => {
        const m = info(nombre), el = elemento(nombre);
        if (!m || !el) throw danado(`falta la carga «${nombre}»`);
        if (m.enc !== 'gzip+base64') throw danado(`${nombre}: codificación «${m.enc}» desconocida`);
        await ceder();
        const t0 = ahora(), t = {};
        const u8 = decodificar(el.textContent, { bytes: m.bytes, sha256: m.sha256, nombre, tiempos: t });
        t.total_ms = ahora() - t0;
        tiempos[nombre] = t;
        el.remove();
        return u8;
      })();
      decodificadas.set(nombre, p);
      p.catch(() => { if (decodificadas.get(nombre) === p) decodificadas.delete(nombre); });
    }
    return p.then((u8) => u8.slice());
  }

  const texto = (nombre) => bytes(nombre).then((u8) => new TextDecoder('utf-8', { fatal: true }).decode(u8));
  const wasm = () => bytes('wasm').then((u8) => u8.buffer);










  function archivoCorpus() {
    const m = info('corpus'), el = elemento('corpus');
    if (!m || !el) return Promise.resolve(null);
    const nombre = el.getAttribute('data-nombre') || 'corpus.csv';
    if (m.enc !== 'gzip+base64') return Promise.reject(danado(`corpus: codificación «${m.enc}» desconocida`));
    return ceder().then(async () => {
      if (typeof DecompressionStream !== 'function' || typeof Response !== 'function') {
        return new File([await bytes('corpus')], nombre, { type: 'text/csv' });
      }
      const t0 = ahora(), t = {};
      const gz = desdeBase64(el.textContent, 'corpus');
      t.base64_ms = ahora() - t0;
      el.remove();
      const t1 = ahora();
      let blob;
      try {
        blob = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).blob();
      } catch (e) {
        throw danado(`corpus: ${e && e.message ? e.message : e}`);
      }
      t.inflate_ms = ahora() - t1;
      t.total_ms = ahora() - t0;
      tiempos.corpus = t;
      if (m.bytes && blob.size !== Number(m.bytes)) throw danado(`corpus: ${blob.size} bytes en lugar de ${m.bytes}`);
      return new File([blob], nombre, { type: 'text/csv' });
    });
  }

  let promesaUrl = null;
  function urlWorker() {
    if (!promesaUrl) {
      promesaUrl = bytes('worker').then((u8) => URL.createObjectURL(new Blob([u8], { type: 'text/javascript' })));
      promesaUrl.catch(() => { promesaUrl = null; });
    }
    return promesaUrl;
  }

  const preparar = () => Promise.all([wasm(), urlWorker()]).then(([w, url]) => ({ wasm: w, urlWorker: url, tiempos }));

  function leerDatos() {
    const el = hayDom ? document.getElementById('r2-datos') : null;
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { throw danado(`datos estáticos: ${e.message}`); }
  }

  R2.cargas = { nombres, info, bytes, texto, wasm, urlWorker, archivoCorpus, preparar, decodificar, tiempos, errorDatos: null };

  try {
    const datos = leerDatos();
    if (datos) R2.datos = Object.assign({}, datos, R2.datos || {});
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
//# sourceURL=2rep-standalone/src/cargas/cargas.js

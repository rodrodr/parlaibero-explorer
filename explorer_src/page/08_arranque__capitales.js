











(function (R2) {
  'use strict';

  const g = globalThis;
  const cache = new Map();
  let embebidas = null;
  const BASE = { Á: 'A', À: 'A', Â: 'A', Ä: 'A', É: 'E', È: 'E', Ê: 'E', Ë: 'E', Í: 'I', Ì: 'I', Ï: 'I', Ó: 'O', Ò: 'O', Ô: 'O', Ö: 'O', Ú: 'U', Ù: 'U', Û: 'U', Ü: 'U' };
  const MARGEN = 0.033;

  function datos() { return (R2.datos && R2.datos.capitales) || null; }
  function disponible() { const d = datos(); return !!(d && d.letras && d.letras.length); }
  function letraDe(c) {
    const L = String(c || '').slice(0, 1).toUpperCase();
    return BASE[L] || L;
  }


  function preparar(svg) {
    if (typeof svg !== 'string' || !/^<svg\b/.test(svg)) return null;
    return svg.replace(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/, (m, w, h) => {
      const W = +w, H = +h, mx = W * MARGEN, my = H * MARGEN;
      return `viewBox="${mx.toFixed(1)} ${my.toFixed(1)} ${(W - 2 * mx).toFixed(1)} ${(H - 2 * my).toFixed(1)}"`;
    });
  }

  function desdeEmbebidas(L) {
    if (!embebidas) {
      embebidas = R2.cargas.texto('capitales').then((t) => JSON.parse(t));
      embebidas.catch(() => { embebidas = null; });
    }
    return embebidas.then((mapa) => preparar(mapa[L]));
  }

  function desdeServidas(L, d) {
    const url = `${d.dir || 'capitales'}/${encodeURIComponent(L)}.svg`;
    return g.fetch(url, { credentials: 'same-origin' }).then((r) => (r.ok ? r.text() : null)).then(preparar);
  }

  function svg(letra) {
    const d = datos();
    const L = letraDe(letra);
    if (!d || !d.letras.includes(L)) return Promise.resolve(null);
    if (!cache.has(L)) {
      const p = (d.modo === 'embebidas' && R2.cargas && R2.cargas.info && R2.cargas.info('capitales') ? desdeEmbebidas(L) : desdeServidas(L, d))
        .catch(() => null);
      cache.set(L, p);
      p.then((v) => { if (v === null) cache.delete(L); });
    }
    return cache.get(L);
  }

  R2.capitales = { svg, disponible, letraDe };
}(globalThis.R2 = globalThis.R2 || {}));
//# sourceURL=2rep-standalone/src/arranque/capitales.js

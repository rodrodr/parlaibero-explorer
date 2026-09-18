/* ===== src/engine/generated/hitos.js ===== */
/* Diarios Explorer · engine/generated/hitos.js
 *
 * R2.gen.hitos: hitos (acontecimientos) que se pintan numerados sobre la tendencia, por país. Los datos vienen del
 * registro datos/hitos_parlaibero.json (tools/hitos_parlaibero.py: cada hito con su fuente y su fecha contrastada),
 * que build.py incorpora al worker como R2.datos.hitos = { <país>: { desde, hasta, hitos: [...] } }.
 * Formato de cada hito: { id, date, date_end, label, desc, kind, rank, fuente, verificar }.
 *   kind: electoral | politico | parlamentario | conflicto | economico | social
 *   rank: 1 principal · 2 relevante · 3 contexto (la interfaz elige cuántos dibuja según el espacio)
 *
 * API (R2.gen.hitos)
 *   de(pais) → lista congelada ordenada por fecha (vacía si el país no está en el registro)
 *   paises() → códigos con hitos · KINDS → etiqueta de cada kind
 */
(function (R2) {
  'use strict';
  const gen = R2.gen = R2.gen || {};

  const KINDS = Object.freeze({
    electoral: 'Elecciones', politico: 'Política', parlamentario: 'Parlamento',
    conflicto: 'Conflicto', economico: 'Economía', social: 'Sociedad',
  });
  const RE_FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const cache = new Map();

  const registro = () => (R2.datos && R2.datos.hitos && typeof R2.datos.hitos === 'object' ? R2.datos.hitos : null);

  function de(pais) {
    const p = String(pais || '').toUpperCase();
    if (cache.has(p)) return cache.get(p);
    const reg = registro();
    const e = reg && reg[p];
    const lista = (e && Array.isArray(e.hitos) ? e.hitos : [])
      .filter((h) => h && RE_FECHA.test(String(h.date || '')) && h.label)
      .map((h) => Object.freeze({
        id: String(h.id || ''), date: String(h.date), date_end: h.date_end ? String(h.date_end) : null,
        label: String(h.label), desc: String(h.desc || ''), kind: KINDS[h.kind] ? h.kind : 'politico',
        rank: [1, 2, 3].includes(Number(h.rank)) ? Number(h.rank) : 2, fuente: String(h.fuente || ''),
        verificar: !!h.verificar, pais: p,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.rank - b.rank));
    const out = Object.freeze(lista);
    cache.set(p, out);
    return out;
  }

  const paises = () => { const reg = registro(); return reg ? Object.keys(reg).sort() : []; };

  gen.hitos = Object.freeze({ de, paises, KINDS });
})(globalThis.R2 = globalThis.R2 || {});

/* ===== src/engine/rutas_ngram.js ===== */
/* 2REP_Standalone · engine/rutas_ngram.js
 *
 * Ruta POST /ngram (M5, prioridad «fondo»): port de server.api_ngram y Corpus._locked_ngram.
 *   terms: lista de textos (chips) o texto con comas; si falta (None, "" o []) y query_from_search trae texto, se
 *   siembra con R2.query.seedTerms (la sintaxis de búsqueda de esta edición). apply_filters aplica los filtros del cuerpo
 *   (incluida la biblioteca, filters.collection_id) como máscara de ids: numeradores y denominadores del mismo subconjunto.
 * Mismos errores que el escritorio: 400 si terms no es lista de textos ni texto, 400 si no queda ningún término; 422 de
 * validación de filtros y query_from_search (R2.filters, R2.router.validar).
 * El índice de tendencias se construye la primera vez (ctx.cache.ngram) con el sidecar R2.datos.sesiones.
 */
(function (R2) {
  'use strict';

  const RT = R2.router, F = R2.filters, N = R2.ngram, Q = R2.query, S = R2.sql, TR = R2.transformar;
  if (!RT || !F || !N || !Q || !S || !TR) throw new Error('engine/rutas_ngram.js necesita R2.router, R2.filters, R2.ngram, R2.query, R2.sql y R2.transformar');
  const V = RT.validar;

  /** bool(x) de Python para un valor JSON. */
  const verdad = (x) => !(x === undefined || x === null || x === false || x === 0 || x === ''
    || (Array.isArray(x) && !x.length) || (RT.esDict(x) && !Object.keys(x).length));

  const bdDe = (ctx) => ({ db: ctx.db, sqlite3: ctx.sqlite3 });
  const sidecar = () => (R2.datos ? R2.datos.sesiones : undefined);

  /** Corpus._locked_ngram. */
  async function ngram(ctx, terms, f, variants, applyFilters) {
    const bd = bdDe(ctx);
    const cache = ctx.cache || (ctx.cache = {});
    const ix = N.indice(bd, cache, sidecar());
    let allowed = null;
    if (applyFilters && f) {
      const [where, params] = F.where(f);
      if (where !== '1=1') {
        F.preparar(bd, f, cache);
        const ids = S.columna(bd, `SELECT s.id FROM speeches s WHERE ${where}`, params);
        allowed = N.mascara(ix, ids);
      }
    }
    const res = await N.compute(bd, ix, terms, { variants: !!variants, allowed, ceder: ctx.ceder || null });
    res.apply_filters = !!applyFilters;
    return res;
  }

  async function rutaNgram(pet, ctx) {
    const b = V.cuerpo(pet.cuerpo);
    let terms = RT.get(b, 'terms');
    let seeded = null;
    const sinTerms = terms === undefined || terms === null || terms === '' || (Array.isArray(terms) && !terms.length);
    if (sinTerms && TR.pyStrip(V.texto(b, 'query_from_search'))) {
      seeded = Q.seedTerms(b.query_from_search);
      terms = seeded;
    }
    if (terms === undefined || terms === null) terms = [];
    let vacio;
    if (typeof terms === 'string') {
      vacio = !TR.pyStrip(terms);
    } else if (Array.isArray(terms) && terms.every((t) => typeof t === 'string')) {
      vacio = !terms.some((t) => TR.pyStrip(t));
    } else {
      throw RT.solicitud('terms debe ser una lista de textos o un texto con términos separados por comas.');
    }
    if (vacio) {
      throw RT.solicitud(seeded === null ? 'Escriba al menos un término (separe varios con comas).'
        : 'La búsqueda no contiene ningún término de contenido para la tendencia.');
    }
    const apply = verdad(RT.get(b, 'apply_filters'));
    const f = apply ? await F.resolver(b, ctx) : null;
    const res = await ngram(ctx, terms, f, verdad(RT.get(b, 'variants')), apply);
    res.seeded_from_search = seeded;
    return res;
  }

  RT.registrar('POST', '/ngram', rutaNgram, { prioridad: 'fondo' });

  R2.rutasNgram = Object.freeze({ rutaNgram, ngram });
})(globalThis.R2 = globalThis.R2 || {});

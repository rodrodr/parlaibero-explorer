/* ===== src/engine/search.js ===== */
/* 2REP_Standalone · engine/search.js
 *
 * Búsqueda por palabras, navegación sin texto, estadística de resultados y lista completa de una búsqueda (M4). Mismo SQL
 * que app/backend/search.py (bm25, snippet('<<<','>>>',' … ',38), órdenes y desempates de _ORDEN_SQL_*, filtros con TEMP
 * sel_ids) y server.py (api_search, api_stats, _lista_busqueda); la consulta la traduce shared/query.js (sintaxis nueva)
 * en lugar de build_fts_query.
 *
 * API (R2.search); bd = { db, sqlite3 }; cache = objeto del núcleo (TEMP sel_ids)
 *   buscar(bd, query, f, limit, offset, order, cache)   search_keyword (y _browse sin texto)
 *   navegar(bd, f, limit, offset, order)                _browse
 *   idsFor(bd, query, f, order, cap, cache)             _locked_ids_for, rama de palabras y navegación
 *   estadisticas(bd, query, f, cache)                   _locked_stats, rama de palabras
 *   async listaBusqueda(cuerpo, ctx)                    server._lista_busqueda (la usa «Guardar todo»)
 *   async membership(ctx, ids)                          library.membership con R2.router.servicios.biblioteca
 * Rutas: POST /search (interactiva) y POST /stats (fondo).
 *
 * Contrato frente al escritorio (lo comprueba la suite 2 con el backend real):
 *   - mode: «keyword» (también si falta o es cualquier otro valor distinto de «semantic»); «semantic» → 400 «La búsqueda
 *     por significado no está disponible en esta versión.». La respuesta dice mode «keyword» o «browse» y stats, modo
 *     «keyword». variants y el filtro de la Combinada no existen en esta edición y se ignoran.
 *   - Clima de sala (M5): como Corpus.search con climate=True. Cada resultado lleva climate y climate_units
 *     (R2.climate.attachClimate con climate_budget_ms); lo que no cabe en el presupuesto llega a null y sus ids en
 *     climate_pending, para pedirlos a POST /climate.
 *   - Consulta: los errores de la sintaxis nueva van en `error` con el mismo formato de respuesta que la consulta sin
 *     términos buscables del escritorio. Toda respuesta con texto trae además `consulta`: { interpretacion, avisos,
 *     omitidas, ignoradas, error } (la línea «Se busca: …» de la interfaz).
 */
(function (R2) {
  'use strict';

  const RT = R2.router, F = R2.filters, Q = R2.query, S = R2.sql;
  const C = R2.py && R2.py.core, TR = R2.transformar;
  if (!RT || !F || !Q || !S || !C || !TR) throw new Error('engine/search.js necesita R2.router, R2.filters, R2.query, R2.sql, R2.py.core y R2.transformar');
  const K = R2.gen.constantes.search;
  const ORDEN_PALABRAS = K._ORDEN_SQL_PALABRAS;
  const ORDEN_NAVEGAR = K._ORDEN_SQL_NAVEGAR;
  const V = RT.validar;

  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const ms = (t0) => C.pyRound(ahora() - t0, 1);
  const strip = (s) => TR.pyStrip(s || '');

  const COLUMNAS = 's.id, s.id_int, s.date, s.num_session, s.session_number, s.ord, s.legislature, s.legislative_session, '
    + 's.session_type, s.speaker, s.rep_id, s.id_dep, s.rep_name, s.sex, s.district, s.party, s.dm_speech, s.nwords';

  /** Corpus._row */
  const fila = (r) => ({ id: r.id, id_int: r.id_int, date: r.date, num_session: r.num_session, session_number: r.session_number,
    ord: r.ord, legislature: r.legislature, legislative_session: r.legislative_session, session_type: r.session_type,
    speaker: r.speaker, rep_id: r.rep_id, id_dep: r.id_dep, rep_name: r.rep_name, sex: r.sex, district: r.district, party: r.party,
    dm_speech: r.dm_speech, nwords: r.nwords });

  const resumenConsulta = (an) => ({ interpretacion: an.interpretacion, avisos: an.avisos.slice(), omitidas: an.omitidas.slice(),
    ignoradas: an.ignoradas.slice(), error: an.error ? Object.assign({}, an.error) : null });

  const mensajeSinTerminos = (an) => (an.error ? an.error.mensaje : Q.MENSAJES.NADA);

  // ------------------------------------------------------------------------------------------------ búsqueda
  function navegar(bd, f, limit, offset, order, t0 = ahora()) {
    const [where, params] = F.where(f);
    const orderSql = ORDEN_NAVEGAR[order] || ORDEN_NAVEGAR.relevance;
    const total = S.valor(bd, `SELECT COUNT(*) FROM speeches s WHERE ${where}`, params);
    const rows = S.filas(bd, `SELECT ${COLUMNAS}, substr(s.speech, 1, 320) AS frag FROM speeches s WHERE ${where} `
      + `ORDER BY ${orderSql} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const results = rows.map((r) => Object.assign(fila(r), { snippet: (r.frag || '').replace(/\n/g, ' '), score: null }));
    return { mode: 'browse', query_fts: '', total, results, ms: ms(t0) };
  }

  function buscar(bd, query, f, limit, offset, order = 'relevance', cache = {}) {
    const t0 = ahora();
    F.preparar(bd, f, cache);
    const an = Q.analizar(query || '');
    if (!an.fts) {
      if (strip(query)) {
        // Escribió algo pero no queda nada buscable (o la sintaxis no es válida): 0 resultados con el motivo.
        return { mode: 'keyword', query_fts: '', total: 0, results: [], error: mensajeSinTerminos(an), ms: ms(t0), consulta: resumenConsulta(an) };
      }
      return navegar(bd, f, limit, offset, order, t0);
    }
    const [where, params] = F.where(f);
    const orderSql = ORDEN_PALABRAS[order] || ORDEN_PALABRAS.relevance;
    const base = `FROM speeches_fts JOIN speeches s ON s.id = speeches_fts.rowid WHERE speeches_fts MATCH ? AND ${where}`;
    let total, rows;
    try {
      total = S.valor(bd, `SELECT COUNT(*) ${base}`, [an.fts, ...params]);
      // Dos fases: primero los ids de la página (sin fragmento, que obliga a descomprimir el texto de cada fila candidata)
      // y después el fragmento y las columnas solo de esos ids, en el mismo orden.
      const ids = S.columna(bd, `SELECT s.id ${base} ORDER BY ${orderSql} LIMIT ? OFFSET ?`, [an.fts, ...params, limit, offset]);
      if (ids.length) {
        const pagina = S.filas(bd, `SELECT ${COLUMNAS}, bm25(speeches_fts) AS bm25, snippet(speeches_fts, 0, '<<<', '>>>', ' … ', 38) AS frag `
          + `FROM speeches_fts JOIN speeches s ON s.id = speeches_fts.rowid WHERE speeches_fts MATCH ? AND s.id IN (${ids.map(() => '?').join(',')})`,
        [an.fts, ...ids]);
        const porId = new Map(pagina.map((r) => [String(r.id), r]));
        rows = ids.map((i) => porId.get(String(i))).filter(Boolean);
      } else rows = [];
    } catch (e) {
      return { error: `Consulta no valida: ${S.errorSqlite(bd, e)}`, query_fts: an.fts, results: [], total: 0, ms: 0, consulta: resumenConsulta(an) };
    }
    let best = -1.0;
    if (rows.length) best = rows.reduce((m, r) => (r.bm25 < m ? r.bm25 : m), rows[0].bm25);
    if (!best) best = -1.0; // `or -1.0`
    const results = rows.map((r) => Object.assign(fila(r), { snippet: r.frag, score: best ? C.pyRound(r.bm25 / best, 4) : 0.0 }));
    return { mode: 'keyword', query_fts: an.fts, total, results, ms: ms(t0), consulta: resumenConsulta(an) };
  }

  /** Corpus._browse_ids */
  function navegarIds(bd, f, order, cap) {
    const [where, params] = F.where(f);
    const orderSql = ORDEN_NAVEGAR[order] || ORDEN_NAVEGAR.relevance;
    return S.columna(bd, `SELECT s.id FROM speeches s WHERE ${where} ORDER BY ${orderSql} LIMIT ?`, [...params, cap]);
  }

  /** Corpus._locked_ids_for (palabras y navegación): la lista en el orden en que se ve; cap null = sin tope. */
  function idsFor(bd, query, f, order = 'relevance', cap = null, cache = {}) {
    order = V.orden(order);
    const limite = cap === null || cap === undefined ? -1 : Math.max(0, Number(cap));
    F.preparar(bd, f, cache);
    if (!strip(query)) return navegarIds(bd, f, order, limite);
    const an = Q.analizar(query);
    if (!an.fts) return [];
    const [where, params] = F.where(f);
    try {
      return S.columna(bd, `SELECT s.id FROM speeches_fts JOIN speeches s ON s.id = speeches_fts.rowid WHERE speeches_fts MATCH ? `
        + `AND ${where} ORDER BY ${ORDEN_PALABRAS[order]} LIMIT ?`, [an.fts, ...params, limite]);
    } catch (e) {
      return [];
    }
  }

  // ------------------------------------------------------------------------------------------------ estadística
  const cmpSql = (a, b) => {
    // _clave_sql: NULL antes que cualquier valor; textos por punto de código; números por valor.
    if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
    if (b === null || b === undefined) return 1;
    return C.cmp(a, b);
  };

  function contar(mapa, clave, valor, n) {
    const e = mapa.get(clave);
    if (e) e.n += n;
    else mapa.set(clave, { valor, n });
  }

  /** Corpus._locked_stats, rama de palabras (y corpus filtrado sin texto). */
  function estadisticas(bd, query, f, cache = {}) {
    F.preparar(bd, f, cache);
    const [where, params] = F.where(f);
    const an = Q.analizar(query || '');
    let base, args;
    if (!an.fts && strip(query)) {
      return { error: mensajeSinTerminos(an), years: [], sexes: [], session_types: [], parties: [], speakers: [], n: 0, modo: 'keyword',
        consulta: resumenConsulta(an) };
    }
    if (an.fts) {
      base = `FROM speeches_fts JOIN speeches s ON s.id = speeches_fts.rowid WHERE speeches_fts MATCH ? AND ${where}`;
      args = [an.fts, ...params];
    } else {
      base = `FROM speeches s WHERE ${where}`;
      args = params;
    }
    let grupos;
    try {
      grupos = S.tuplas(bd, `SELECT s.year, s.sex, s.rep_name, s.rep_id, s.session_type, s.party, COUNT(*) ${base} GROUP BY 1, 2, 3, 4, 5, 6`, args);
    } catch (e) {
      return { error: S.errorSqlite(bd, e), years: [], sexes: [], session_types: [], parties: [], speakers: [] };
    }
    const cYear = new Map(), cSex = new Map(), cSpk = new Map(), cTipo = new Map(), cPartido = new Map();
    let total = 0;
    for (const [year, sex, repName, repId, tipo, partido, n] of grupos) {
      contar(cYear, year, year, n);
      contar(cSex, sex, sex, n);
      if (repId !== null && repId !== undefined) {
        contar(cSpk, JSON.stringify([repName, typeof repId === 'bigint' ? repId.toString() : repId]), [repName, repId], n);
      }
      contar(cTipo, tipo, tipo, n);
      contar(cPartido, partido, partido, n);
      total += n;
    }
    const porN = (mapa) => [...mapa.values()].sort((a, b) => b.n - a.n || cmpSql(a.valor, b.valor)).map((e) => ({ value: e.valor, n: e.n }));
    const years = [...cYear.values()].sort((a, b) => cmpSql(a.valor, b.valor)).map((e) => ({ year: e.valor, n: e.n }));
    const speakers = [...cSpk.values()]
      .sort((a, b) => b.n - a.n || cmpSql(a.valor[0], b.valor[0]) || cmpSql(a.valor[1], b.valor[1]))
      .slice(0, 25)
      .map((e) => ({ value: e.valor[0], rep_id: e.valor[1], n: e.n }));
    const out = { years, sexes: porN(cSex), session_types: porN(cTipo), parties: porN(cPartido).slice(0, 15), speakers, n: total, modo: 'keyword' };
    if (strip(query)) out.consulta = resumenConsulta(an);
    return out;
  }

  // ------------------------------------------------------------------------------------------------ biblioteca
  async function membership(ctx, ids) {
    if (!ids.length) return {};
    const lib = F.biblioteca(ctx);
    if (!lib || typeof lib.membership !== 'function') return {};
    const r = await lib.membership(ctx.corpus && ctx.corpus.nombre, ids);
    if (r instanceof Map) {
      const o = {};
      for (const [k, v] of r) o[String(k)] = Array.from(v);
      return o;
    }
    return r || {};
  }

  const bdDe = (ctx) => ({ db: ctx.db, sqlite3: ctx.sqlite3 });
  const modoDe = (b) => V.texto(b, 'mode') || 'keyword';

  /** server._lista_busqueda (sin la búsqueda por vectores): ids, total_lista, tope_modo, recorte, query, mode, order. */
  async function listaBusqueda(cuerpo, ctx) {
    const b = V.cuerpo(cuerpo);
    const query = strip(V.texto(b, 'query'));
    const mode = modoDe(b);
    const order = V.orden(RT.get(b, 'order'));
    const cap = V.cap(b, ctx.corpus ? ctx.corpus.n_speeches : 0);
    const f = await F.resolver(b, ctx);
    if (mode === 'semantic') throw RT.solicitud(RT.MSG_MODO_NO_DISPONIBLE);
    const lista = idsFor(bdDe(ctx), query, f, order, null, ctx.cache);
    const total = lista.length;
    const ids = cap === null ? lista : lista.slice(0, Number(cap));
    const recorte = ids.length < total ? { motivo: 'cap', tomadas: ids.length, de: total } : null;
    return { ids, total_lista: total, tope_modo: null, recorte, query, mode: 'keyword', order };
  }

  // ------------------------------------------------------------------------------------------------ rutas
  async function rutaBuscar(pet, ctx) {
    const b = V.cuerpo(pet.cuerpo);
    const query = strip(V.texto(b, 'query'));
    const mode = modoDe(b);
    const limit = V.num(b, 'limit', 50, 1, 200);
    const offset = V.num(b, 'offset', 0, 0, 10000000);
    const order = V.orden(RT.get(b, 'order'));
    const f = await F.resolver(b, ctx);
    const presupuesto = RT.get(b, 'climate_budget_ms');
    const budget = presupuesto === undefined || presupuesto === null || presupuesto === ''
      ? null : V.num(b, 'climate_budget_ms', 60, 0, 10000);
    if (mode === 'semantic') throw RT.solicitud(RT.MSG_MODO_NO_DISPONIBLE);
    const res = buscar(bdDe(ctx), query, f, Number(limit), Number(offset), order, ctx.cache);
    if (!R2.climate) throw new Error('engine/search.js necesita R2.climate (engine/climate.js) para el clima de sala');
    const pend = R2.climate.attachClimate(ctx, res.results || [], budget === null ? null : Number(budget));
    if (pend.length) res.climate_pending = pend;
    res.membership = await membership(ctx, res.results.map((r) => r.id));
    return res;
  }

  async function rutaStats(pet, ctx) {
    const b = V.cuerpo(pet.cuerpo);
    const query = strip(V.texto(b, 'query'));
    const f = await F.resolver(b, ctx);
    const mode = modoDe(b);
    if (mode === 'semantic') throw RT.solicitud(RT.MSG_MODO_NO_DISPONIBLE);
    return estadisticas(bdDe(ctx), query, f, ctx.cache);
  }

  RT.registrar('POST', '/search', rutaBuscar, { prioridad: 'interactiva' });
  RT.registrar('POST', '/stats', rutaStats, { prioridad: 'fondo' });

  R2.search = Object.freeze({ COLUMNAS, fila, buscar, navegar, navegarIds, idsFor, estadisticas, listaBusqueda, membership,
    resumenConsulta, rutaBuscar, rutaStats });
})(globalThis.R2 = globalThis.R2 || {});

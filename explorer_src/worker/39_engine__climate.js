/* ===== src/engine/climate.js ===== */
/* 2REP_Standalone · engine/climate.js
 *
 * Documentos del Diario en caché y clima de sala (M5). Port de app/backend/search.py: _DocCache, DOC_CACHE (4.000 docs o
 * 40 M de caracteres), CLIMATE_CACHE (200.000 entradas), climate_units, Corpus._doc_key, _doc, docs_for,
 * _locked_speeches_bulk, _climate_entry, attach_climate y climate_for; y de server.api_climate.
 *
 * Programa contra la interfaz de engine/diario.js (R2.diario.parse_speech y R2.diario.climate), que se busca al llamar:
 * este archivo puede cargarse antes o después de diario.js en src/orden.json.
 *
 * API (R2.climate); ctx = contexto del enrutador ({ db, sqlite3, … })
 *   DocCache(maxDocs, maxChars) · DOC_CACHE · CLIMATE_CACHE
 *   docKey(ctx, sid)                          (corpus, id, ENGINE_VERSION); el corpus es la base abierta (ctx.db)
 *   iterUnits(doc) · climateUnits(doc)        diario._iter_units y search.climate_units
 *   speechesBulk(ctx, ids) → [{id, speaker, rep_name, speech}]   en el orden pedido, sin repetidos ni inexistentes
 *   doc(ctx, sid, text, speaker, repName)     documento desde la caché o analizándolo
 *   docsFor(ctx, ids) → Map(id → doc)
 *   climateEntry(ctx, sid, doc) → [climate, climate_units]
 *   attachClimate(ctx, results, budgetMs = null) → ids pendientes   (añade climate y climate_units a cada resultado)
 *   climateFor(ctx, ids) → {id: {climate, climate_units}}
 * Ruta: POST /climate (interactiva): {ids} (como mucho 200) → {climate}.
 */
(function (R2) {
  'use strict';

  const RT = R2.router, S = R2.sql, C = R2.py && R2.py.core;
  if (!RT || !S || !C || !R2.gen || !R2.gen.constantes) throw new Error('engine/climate.js necesita R2.router, R2.sql, R2.py.core y R2.gen.constantes');
  const K = R2.gen.constantes.search;
  const ENGINE_VERSION = R2.gen.constantes.diario.ENGINE_VERSION;
  const V = RT.validar;
  const tiene = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function diario() {
    const D = R2.diario;
    if (!D || typeof D.parse_speech !== 'function' || typeof D.climate !== 'function') {
      throw new Error('engine/climate.js necesita R2.diario (engine/diario.js)');
    }
    return D;
  }

  /** len() de Python: puntos de código. */
  function largo(s) {
    let n = s.length;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        const d = s.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) { n--; i++; }
      }
    }
    return n;
  }

  /** search._DocCache: LRU por clave con tope de documentos y de caracteres. Lo guardado se comparte: no modificarlo. */
  class DocCache {
    constructor(maxDocs, maxChars) {
      this.max_docs = maxDocs;
      this.max_chars = maxChars;
      this._d = new Map();
      this._chars = 0;
      this.hits = 0;
      this.misses = 0;
    }

    get(key) {
      const v = this._d.get(key);
      if (v === undefined) { this.misses++; return null; }
      this._d.delete(key);
      this._d.set(key, v);
      this.hits++;
      return v[0];
    }

    put(key, doc, size) {
      const old = this._d.get(key);
      if (old !== undefined) { this._d.delete(key); this._chars -= old[1]; }
      this._d.set(key, [doc, size]);
      this._chars += size;
      while (this._d.size > this.max_docs || (this._chars > this.max_chars && this._d.size > 1)) {
        const [k, v] = this._d.entries().next().value;
        this._d.delete(k);
        this._chars -= v[1];
      }
    }

    clear() { this._d.clear(); this._chars = 0; this.hits = 0; this.misses = 0; }
    contiene(key) { return this._d.has(key); }
    info() { return { docs: this._d.size, chars: this._chars, hits: this.hits, misses: this.misses }; }
  }

  const DOC_CACHE = new DocCache(K.DOC_CACHE_MAX_DOCS, K.DOC_CACHE_MAX_CHARS);
  const CLIMATE_CACHE = new DocCache(200000, 200000);

  // El escritorio usa la ruta del corpus; aquí, la base abierta (una base nueva, otra clave).
  const fichas = new WeakMap();
  let nFichas = 0;
  function corpusDe(ctx) {
    const db = ctx && ctx.db;
    if (!db || typeof db !== 'object') return 0;
    let f = fichas.get(db);
    if (f === undefined) { f = ++nFichas; fichas.set(db, f); }
    return f;
  }
  const docKey = (ctx, sid) => `${corpusDe(ctx)}|${String(sid)}|${ENGINE_VERSION}`;
  const bdDe = (ctx) => ({ db: ctx.db, sqlite3: ctx.sqlite3 });

  /** diario._iter_units */
  function* iterUnits(doc) {
    for (const x of doc.blocks) {
      if (x.t === 'stage') {
        yield* x.u;
      } else if (tiene(x, 's')) {
        for (const s of x.s) if (s.k === 'acot') yield* s.u;
      }
    }
  }

  /** search.climate_units: [{lab, c, n}] por etiqueta y clase, de más a menos (empate por (lab, c)). */
  function climateUnits(doc) {
    const cuenta = new Map();
    for (const u of iterUnits(doc)) {
      const c = u.c, lab = u.lab;
      if (c && lab) {
        const k = JSON.stringify([lab, c]);
        const e = cuenta.get(k);
        if (e) e.n++;
        else cuenta.set(k, { lab, c, n: 1 });
      }
    }
    return [...cuenta.values()]
      .sort((a, b) => b.n - a.n || C.cmpStr(a.lab, b.lab) || C.cmpStr(a.c, b.c))
      .map((e) => ({ lab: e.lab, c: e.c, n: e.n }));
  }

  const unicos = (ids) => {
    const vistos = new Set(), out = [];
    for (const i of ids) {
      const k = String(i);
      if (!vistos.has(k)) { vistos.add(k); out.push(i); }
    }
    return out;
  };

  /** Corpus._locked_speeches_bulk */
  function speechesBulk(ctx, ids) {
    const orden = unicos(ids);
    const filas = new Map();
    const bd = bdDe(ctx);
    for (let k = 0; k < orden.length; k += K.INLINE_ID_LIMIT) {
      const lote = orden.slice(k, k + K.INLINE_ID_LIMIT);
      const sql = `SELECT id, speaker, rep_name, speech FROM speeches WHERE id IN (${lote.map(() => '?').join(',')})`;
      for (const r of S.tuplas(bd, sql, lote)) {
        filas.set(String(r[0]), { id: r[0], speaker: r[1], rep_name: r[2], speech: r[3] || '' });
      }
    }
    return orden.filter((i) => filas.has(String(i))).map((i) => filas.get(String(i)));
  }

  /** Corpus._doc */
  function doc(ctx, sid, text, speaker, repName) {
    const key = docKey(ctx, sid);
    let d = DOC_CACHE.get(key);
    if (d === null) {
      const t = text || '';
      d = diario().parse_speech(t, speaker === undefined ? null : speaker, repName === undefined ? null : repName);
      DOC_CACHE.put(key, d, largo(t));
    }
    return d;
  }

  /** Corpus.docs_for */
  function docsFor(ctx, ids) {
    const out = new Map();
    const faltan = [];
    for (const i of unicos(ids)) {
      const d = DOC_CACHE.get(docKey(ctx, i));
      if (d === null) faltan.push(i);
      else out.set(i, d);
    }
    if (faltan.length) {
      for (const r of speechesBulk(ctx, faltan)) out.set(r.id, doc(ctx, r.id, r.speech, r.speaker, r.rep_name));
    }
    return out;
  }

  /** Corpus._climate_entry */
  function climateEntry(ctx, sid, d) {
    const key = docKey(ctx, sid);
    let hit = CLIMATE_CACHE.get(key);
    if (hit === null) {
      hit = [diario().climate(d), climateUnits(d)];
      CLIMATE_CACHE.put(key, hit, 1);
    }
    return hit;
  }

  /** Corpus.attach_climate: añade climate y climate_units; devuelve los ids que no cupieron en budgetMs. */
  function attachClimate(ctx, results, budgetMs = null) {
    const ids = unicos(results.filter((r) => r && r.id !== undefined && r.id !== null).map((r) => r.id));
    const hechos = new Map();
    const faltan = [];
    for (const i of ids) {
      const key = docKey(ctx, i);
      let c = CLIMATE_CACHE.get(key);
      if (c === null) {
        const d = DOC_CACHE.get(key);
        if (d !== null) c = climateEntry(ctx, i, d);
      }
      if (c === null) faltan.push(i);
      else hechos.set(String(i), c);
    }
    let pendientes = [];
    if (faltan.length) {
      if (budgetMs === null || budgetMs === undefined) {
        for (const [i, d] of docsFor(ctx, faltan)) hechos.set(String(i), climateEntry(ctx, i, d));
      } else {
        const limite = ahora() + Math.max(0, Number(budgetMs));
        const filas = speechesBulk(ctx, faltan);
        for (let k = 0; k < filas.length; k++) {
          if (ahora() >= limite) { pendientes = filas.slice(k).map((x) => x.id); break; }
          const r = filas[k];
          hechos.set(String(r.id), climateEntry(ctx, r.id, doc(ctx, r.id, r.speech, r.speaker, r.rep_name)));
        }
      }
    }
    const pend = new Set(pendientes.map(String));
    for (const r of results) {
      const c = r && r.id !== undefined && r.id !== null ? hechos.get(String(r.id)) : undefined;
      r.climate = c !== undefined ? c[0] : null;
      r.climate_units = c !== undefined ? c[1] : null;
    }
    return ids.filter((i) => pend.has(String(i)));
  }

  /** Corpus.climate_for */
  function climateFor(ctx, ids) {
    const filas = unicos(ids).map((i) => ({ id: i }));
    attachClimate(ctx, filas);
    const out = {};
    for (const f of filas) if (f.climate !== null) out[String(f.id)] = { climate: f.climate, climate_units: f.climate_units };
    return out;
  }

  /** Verdad de Python para `body.get("ids") or []`. */
  const falso = (v) => v === undefined || v === null || v === false || v === 0 || v === '' || v === 0n
    || (Array.isArray(v) && !v.length) || (RT.esDict(v) && !Object.keys(v).length);

  /** server.api_climate */
  async function rutaClima(pet, ctx) {
    const b = V.cuerpo(pet.cuerpo);
    let v = RT.get(b, 'ids');
    if (falso(v)) v = [];
    const ids = V.ids(v, 'ids');
    if (ids.length > 200) throw RT.noValido('ids admite como mucho 200 intervenciones por petición.');
    return { climate: climateFor(ctx, ids) };
  }

  RT.registrar('POST', '/climate', rutaClima, { prioridad: 'interactiva' });

  R2.climate = Object.freeze({
    ENGINE_VERSION, DocCache, DOC_CACHE, CLIMATE_CACHE, docKey, iterUnits, climateUnits, speechesBulk, doc, docsFor,
    climateEntry, attachClimate, climateFor, rutaClima, largo,
  });
})(globalThis.R2 = globalThis.R2 || {});

/* ===== src/engine/filters.js ===== */
/* 2REP_Standalone · engine/filters.js
 *
 * Filtros de la búsqueda (M4): port exacto de search.Filters (from_dict, where, needs_temp_ids), Corpus._prepare (tabla
 * TEMP sel_ids por encima de INLINE_ID_LIMIT = 900 ids, reutilizada si el conjunto no cambia) y server._resolve_filters
 * (filters.collection_id resuelto con la biblioteca: 404 si no existe, intersección con speech_ids, [-1] si queda vacía).
 *
 * API (R2.filters)
 *   vacios() → Filters sin nada              desdeDict(d) → Filters (422 con el texto de Python)
 *   where(f) → [sql, params]                 necesitaTemporal(f) → bool
 *   preparar(bd, f, cache)                   crea o reutiliza TEMP sel_ids (bd = {db, sqlite3}; cache = objeto del núcleo)
 *   async resolver(cuerpo, { servicios, corpus }) → Filters
 *
 * Diferencias de contrato (el JSON de JavaScript no distingue 1 de 1.0): un texto de filtro que llega como número entero
 * con decimales en el JSON («1.0») se convierte en «1», no en «1.0» como str(float) de Python.
 */
(function (R2) {
  'use strict';

  const RT = R2.router;
  const C = R2.py && R2.py.core;
  if (!RT || !C) throw new Error('engine/filters.js necesita R2.router (engine/router.js) y R2.py.core');
  const V = RT.validar;
  const INLINE_ID_LIMIT = (R2.gen && R2.gen.constantes && R2.gen.constantes.search && R2.gen.constantes.search.INLINE_ID_LIMIT) || 900;

  const LISTAS = Object.freeze({ legislatures: 'str', legislative_sessions: 'str', session_types: 'str', sexes: 'str', parties: 'str',
    districts: 'str', rep_ids: 'int', speakers: 'str', speech_ids: 'int' });
  const ENTEROS = Object.freeze(['min_words', 'max_words', 'num_session', 'collection_id']);
  const TEXTOS = Object.freeze(['date_from', 'date_to']);
  const BOOLEANOS = Object.freeze(['exclude_docs']);
  const CAMPOS = Object.freeze(['legislatures', 'legislative_sessions', 'session_types', 'sexes', 'parties', 'districts', 'rep_ids',
    'speakers', 'date_from', 'date_to', 'min_words', 'max_words', 'num_session', 'collection_id', 'speech_ids', 'exclude_docs']);
  /** Las etiquetas de speaker que no son de nadie (engine/diario.js): SUMARIO y COMENTARIOS. */
  const FILAS_DOC = Object.freeze(['SUMARIO', 'COMENTARIOS']);

  function vacios() {
    return { legislatures: [], legislative_sessions: [], session_types: [], sexes: [], parties: [], districts: [], rep_ids: [], speakers: [],
      date_from: null, date_to: null, min_words: null, max_words: null, num_session: null, collection_id: null, speech_ids: null,
      exclude_docs: false };
  }

  const textoPy = (x) => (typeof x === 'string' ? x : C.pyStr(x));

  /** Filters.from_dict. */
  function desdeDict(d) {
    if (d === null || d === undefined) return vacios();
    if (!RT.esDict(d)) throw RT.noValido('filters debe ser un objeto JSON.');
    const f = vacios();
    for (const k of Object.keys(d)) {
      const v = d[k];
      if (!CAMPOS.includes(k) || v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
      if (LISTAS[k]) {
        if (!Array.isArray(v)) throw RT.noValido(`filters.${k} debe ser una lista (p. ej. ["${textoPy(v)}"]).`);
        if (LISTAS[k] === 'int') {
          f[k] = v.map((x) => V.entero(x, `filters.${k}`));
        } else {
          if (!v.every((x) => typeof x === 'string' || typeof x === 'number' || typeof x === 'bigint')) {
            throw RT.noValido(`filters.${k} debe ser una lista de textos.`);
          }
          f[k] = v.map(textoPy);
        }
      } else if (ENTEROS.includes(k)) {
        f[k] = V.entero(v, `filters.${k}`);
      } else if (TEXTOS.includes(k)) {
        if (typeof v !== 'string') throw RT.noValido(`filters.${k} debe ser una fecha AAAA-MM-DD.`);
        f[k] = v;
      } else if (BOOLEANOS.includes(k)) {
        if (typeof v !== 'boolean') throw RT.noValido(`filters.${k} debe ser true o false.`);
        f[k] = v;
      }
    }
    return f;
  }

  /** Filters.where: cláusula sobre speeches con alias s. */
  function where(f) {
    const cl = [], pa = [];
    const inlist = (col, vals) => {
      if (vals && vals.length) {
        cl.push(`s.${col} IN (${vals.map(() => '?').join(',')})`);
        pa.push(...vals);
      }
    };
    inlist('legislature', f.legislatures);
    inlist('legislative_session', f.legislative_sessions);
    inlist('session_type', f.session_types);
    inlist('sex', f.sexes);
    inlist('party', f.parties);
    inlist('district', f.districts);
    inlist('rep_id', f.rep_ids);
    inlist('speaker', f.speakers);
    if (f.date_from) { cl.push('s.date >= ?'); pa.push(f.date_from); }
    if (f.date_to) { cl.push('s.date <= ?'); pa.push(f.date_to); }
    if (f.min_words !== null && f.min_words !== undefined) { cl.push('s.nwords >= ?'); pa.push(f.min_words); }
    if (f.max_words !== null && f.max_words !== undefined) { cl.push('s.nwords <= ?'); pa.push(f.max_words); }
    if (f.num_session !== null && f.num_session !== undefined) { cl.push('s.num_session = ?'); pa.push(f.num_session); }
    if (f.exclude_docs) cl.push('s.dm_speech = 1');
    if (f.speech_ids && f.speech_ids.length) {
      if (f.speech_ids.length > INLINE_ID_LIMIT) {
        cl.push('s.id IN (SELECT id FROM sel_ids)');
      } else {
        cl.push(`s.id IN (${f.speech_ids.map(() => '?').join(',')})`);
        pa.push(...f.speech_ids);
      }
    }
    return [cl.length ? cl.join(' AND ') : '1=1', pa];
  }

  const necesitaTemporal = (f) => !!(f.speech_ids && f.speech_ids.length > INLINE_ID_LIMIT);

  /** Conjunto ordenado y sin repetir de los ids (null si hay alguno fuera de 2^53: entonces no se reutiliza). */
  function conjunto(ids) {
    const a = new Float64Array(ids.length);
    for (let i = 0; i < ids.length; i++) {
      if (typeof ids[i] !== 'number') return null;
      a[i] = ids[i];
    }
    a.sort();
    let n = 0;
    for (let i = 0; i < a.length; i++) if (i === 0 || a[i] !== a[i - 1]) a[n++] = a[i];
    return a.subarray(0, n);
  }

  function iguales(x, y) {
    if (!x || !y || x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  /** Corpus._prepare: materializa speech_ids en TEMP sel_ids (una sola vez por conjunto). */
  function preparar(bd, f, cache) {
    if (!necesitaTemporal(f)) return;
    const c = cache || {};
    const conj = conjunto(f.speech_ids);
    if (conj && iguales(conj, c.selIds)) return;
    c.selIds = null;
    const { db } = bd;
    db.exec('DROP TABLE IF EXISTS sel_ids');
    db.exec('CREATE TEMP TABLE sel_ids (id INTEGER PRIMARY KEY)');
    db.exec('SAVEPOINT r2_sel_ids');
    const st = db.prepare('INSERT OR IGNORE INTO sel_ids VALUES (?)');
    try {
      for (const id of f.speech_ids) st.bind([id]).stepReset();
      db.exec('RELEASE r2_sel_ids');
    } catch (e) {
      try { db.exec('ROLLBACK TO r2_sel_ids'); db.exec('RELEASE r2_sel_ids'); } catch (e2) { /* nada */ }
      throw e;
    } finally {
      st.finalize();
    }
    c.selIds = conj;
  }

  /** La biblioteca vigente: entorno.servicios.biblioteca, R2.router.servicios.biblioteca o R2.library.actual(). */
  function biblioteca(entorno = {}) {
    const s = (entorno && entorno.servicios) || RT.servicios;
    if (s && s.biblioteca) return s.biblioteca;
    if (RT.servicios && RT.servicios.biblioteca) return RT.servicios.biblioteca;
    if (R2.library && typeof R2.library.actual === 'function') return R2.library.actual() || null;
    return null;
  }

  /** server._resolve_filters. `entorno` = { servicios: {biblioteca}, corpus: {nombre} }. */
  async function resolver(cuerpo, entorno = {}) {
    // raw = body.get("filters") or {}: los valores falsos de Python (None, False, 0, "", [], {}) valen {}.
    let raw = RT.get(cuerpo, 'filters');
    if (raw === undefined || raw === null || raw === '' || raw === 0 || raw === false || (Array.isArray(raw) && !raw.length)
      || (RT.esDict(raw) && !Object.keys(raw).length)) raw = {};
    if (!RT.esDict(raw)) throw RT.noValido('filters debe ser un objeto JSON.');
    raw = Object.assign({}, raw);
    const cid0 = RT.get(raw, 'collection_id');
    delete raw.collection_id;
    const f = desdeDict(raw);
    if (!(cid0 === undefined || cid0 === null || cid0 === '' || cid0 === 0 || cid0 === false)) {
      const cid = V.entero(cid0, 'filters.collection_id', 1);
      const lib = biblioteca(entorno);
      const col = lib ? await lib.get_collection(cid) : null;
      if (col === null || col === undefined) {
        const existio = lib ? await lib.collection_existio(cid) : null;
        const motivo = existio === true ? 'ya no existe (se ha borrado)' : existio === false ? 'no existe' : 'no existe (quizá se ha borrado)';
        throw new RT.ErrorHttp(404, `La biblioteca ${cid} a la que se restringe la búsqueda ${motivo}. `
          + 'Quite la restricción «Restringir a una biblioteca» y vuelva a buscar.');
      }
      let ids = Array.from(await lib.item_ids(cid, entorno.corpus && entorno.corpus.nombre));
      if (f.speech_ids && f.speech_ids.length) {
        const dentro = new Set(f.speech_ids.map((i) => String(i)));
        ids = ids.filter((i) => dentro.has(String(i)));
      }
      f.speech_ids = ids.length ? ids : [-1];
    }
    return f;
  }

  R2.filters = Object.freeze({ INLINE_ID_LIMIT, LISTAS, ENTEROS, TEXTOS, BOOLEANOS, CAMPOS, FILAS_DOC, vacios, desdeDict,
    where, necesitaTemporal, preparar, resolver, biblioteca });
})(globalThis.R2 = globalThis.R2 || {});

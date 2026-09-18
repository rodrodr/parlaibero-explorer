/* ===== src/engine/ngram.js ===== */
/* 2REP_Standalone · engine/ngram.js
 *
 * Motor de tendencias (M5): port de app/backend/ngram.py. Menciones mensuales de términos con sus denominadores en bruto
 * (tokens e intervenciones del mes), calendario con las fechas reales de sessions.json (R2.datos.sesiones), fiabilidad,
 * hitos (R2.gen.hitos), filtros como máscara por id, avisos y sugerencias (R2.py.difflib) y el mismo planificador
 * (fts5vocab row → fts5vocab instance | bm25 | posiciones | highlight). Mismos textos en español.
 *
 * Diferencias deliberadas con el escritorio:
 *   - Sin presupuesto de tiempo por consulta: nunca hay error «presupuesto», incomplete es siempre false y budget.ms es
 *     null. El tope por término (termino_costoso, MAX_MS_TERMINO) y el de prefijos (prefijo_amplio) se conservan: salen del
 *     planificador, que es determinista.
 *   - calendar.sidecar.path es «sessions.json» (la copia versionada), no la ruta del disco.
 *   - Plegado y tokenización: R2.tokenize (tablas medidas de unicode61 remove_diacritics 2), no un FTS5 en memoria.
 *   - Rendimiento (WebKit): analyze_term no usa R2.py.re (las clases \w \s \d cuestan 36–68 ms la primera vez) sino los
 *     predicados de R2.py.core con la misma semántica; los recuentos recorren las filas con las exportaciones directas del
 *     wasm (sin group_concat ni printf) y cuentan en arrays tipados.
 *
 * API (R2.ngram); bd = { db, sqlite3 }
 *   parseTerms(texto | lista) · analyzeTerm(raw, variants) · fold(texto) · tokenize(texto) · fiabilidad(tokens)
 *   construir(bd, sidecar, ruta = 'sessions.json') → índice      (sidecar = objeto JSON o undefined)
 *   indice(bd, cache, sidecar) → índice perezoso guardado en cache.ngram
 *   monthFilter(ix, mes) · monthSpeechIds(ix, mes) · milestones(ix)
 *   async compute(bd, ix, terms, { variants, allowed, useCache, includeMilestones, ceder }) → respuesta
 *   mascara(ix, ids) → Uint8Array
 */
(function (R2) {
  'use strict';

  const C = R2.py && R2.py.core, TK = R2.tokenize, S = R2.sql, DL = R2.py && R2.py.difflib, TR = R2.transformar;
  if (!C || !TK || !S || !DL || !TR || !R2.gen || !R2.gen.constantes || !R2.gen.hitos || !R2.gen.vacias) {
    throw new Error('engine/ngram.js necesita R2.py.core, R2.py.difflib, R2.tokenize, R2.sql, R2.transformar y R2.gen (constantes, hitos, vacias)');
  }
  const K = R2.gen.constantes.ngram;
  const ENGINE_VERSION = K.ENGINE_VERSION;
  const MAX_TERMS = K.MAX_TERMS;
  const MIN_PREFIX_CHARS = K.MIN_PREFIX_CHARS;
  const MAX_PREFIX_INSTANCES = K.MAX_PREFIX_INSTANCES;
  const MAX_MS_TERMINO = K.MAX_MS_TERMINO;
  const UMBRAL_NORMAL = K.UMBRAL_NORMAL;
  const UMBRAL_BAJA = K.UMBRAL_BAJA;
  const CACHE_TERMS = K.CACHE_TERMS;
  const FTS_TABLE = K.FTS_TABLE;
  const MS_APARICION = K._MS_APARICION;
  const MS_APARICION_PREFIJO = K._MS_APARICION_PREFIJO;
  const MS_DOC_BM25 = K._MS_DOC_BM25;
  const MS_DOC_FRASE = K._MS_DOC_FRASE;
  const BM25_K1 = 1.2, BM25_B = 0.75;
  const OPS = new Set(K._OPS);
  const VACIAS = new Set(R2.gen.vacias.VACIAS);
  const MAX_CP = '\u{10FFFF}';
  const SQLITE_ROW = 100, SQLITE_DONE = 101;

  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const strip = (s) => TR.pyStrip(s);
  const len = (s) => C.pyLen(s);
  const esEspacios = (s) => s === '' || C.isspace(s);
  const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const COMILLAS = /[«»“”„]/g;
  const comillas = (s) => s.replace(COMILLAS, '"');
  /** Primeros / últimos puntos de código (s[:n], s[:-1], s[-1]). */
  const cpsDe = (s) => Array.from(s);

  // ------------------------------------------------------------------------------------------------ plegado
  /** ngram.tokenize: tokens plegados en el orden del texto, como los registra FTS5. */
  function tokenize(texto) {
    return TK.tokens(texto || '').map((x) => x.t);
  }

  /** ngram.fold: minúsculas y sin diacríticos; los separadores se conservan (en minúscula). */
  function fold(texto) {
    const s = texto || '';
    if (/^[\x00-\x7F]*$/.test(s)) return s.toLowerCase();
    let out = '';
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (TK.esToken(cp)) {
        const f = TK.plegar(cp);
        if (f) out += String.fromCodePoint(f);
      } else out += C.lower(ch);
    }
    return out;
  }

  /** re.sub(r"[^\w\-]", "", s) de Python (\w = isalnum o «_»). */
  function soloPalabra(s) {
    let out = '';
    for (const ch of s) {
      if (ch === '_' || ch === '-' || C.isalnum(ch)) out += ch;
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------------ términos
  /** ngram.parse_terms. */
  function parseTerms(text) {
    if (text === null || text === undefined) return [];
    if (typeof text !== 'string') {
      const out = [];
      for (const t of text) {
        if (t === null || t === undefined) continue;
        const v = strip(typeof t === 'string' ? t : C.pyStr(t));
        if (v) out.push(v);
      }
      return out;
    }
    const s = comillas(text);
    let nq = 0;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 34) nq++;
    const sinCerrar = nq % 2 ? s.lastIndexOf('"') : -1;
    const trozos = [];
    let ini = 0, dentro = false, actual = '';
    for (let k = 0; k < s.length; k++) {
      const ch = s[k];
      if (ch === '"' && k !== sinCerrar) dentro = !dentro;
      if (ch === ',' && !dentro) {
        trozos.push(actual + s.slice(ini, k));
        actual = '';
        ini = k + 1;
      }
    }
    trozos.push(actual + s.slice(ini));
    return trozos.map(strip).filter((t) => t);
  }

  /** ngram.analyze_term. */
  function analyzeTerm(raw, variants = false) {
    const texto = strip(comillas(raw || ''));
    const t = { input: raw, label: texto, ok: false, warnings: [] };
    const error = (code, message, suggestion) => Object.assign(t, { error: code, message, suggestion });

    // re.fullmatch(r'"[^"]*"\s*\*', texto)
    if (texto.startsWith('"')) {
      const j = texto.indexOf('"', 1);
      if (j > 0 && texto.endsWith('*') && texto.length >= j + 2 && esEspacios(texto.slice(j + 1, -1))) {
        return error('asterisco', 'El asterisco no trunca frases ni términos entre comillas.',
          'Quite las comillas y ponga el asterisco al final de una sola palabra (p. ej. republic*).');
      }
    }

    const quoted = texto.startsWith('"');
    let inner;
    if (quoted) {
      inner = texto.slice(1);
      if (inner.endsWith('"')) inner = inner.slice(0, -1);
      else t.warnings.push({ code: 'comillas_sin_cerrar', message: 'Faltaban las comillas de cierre; se han añadido.' });
      if (inner.includes('"')) {
        return error('comillas', 'Hay comillas en medio del término.',
          'Ponga cada frase entre sus propias comillas y sepárelas con comas.');
      }
    } else {
      if (texto.includes('"')) {
        const limpio = strip(texto.split('"').join(''));
        return error('comillas', 'Las comillas deben rodear el término completo.',
          `Escriba "${limpio}" o separe las partes con comas.`);
      }
      inner = texto;
    }
    inner = strip(inner);
    t.quoted = quoted;

    if (!inner) {
      return error('vacio', 'El término está vacío.',
        'Escriba una palabra, un prefijo con * (p. ej. republic*) o una frase entre comillas.');
    }

    if (!quoted) {
      const palabras = C.split(inner);
      const ops = palabras.filter((w) => OPS.has(w) || (palabras.length > 1 && OPS.has(C.upper(w))));
      let near = false;
      if (inner.startsWith('NEAR')) {
        let i = 4;
        while (i < inner.length && C.isspace(inner[i])) i++;
        near = inner[i] === '(';
      }
      if (ops.length || near) {
        const nombres = [...new Set(ops.map((w) => C.upper(w)))].sort(C.cmpStr).join(', ') || 'NEAR';
        return error('operador',
          `Los operadores de búsqueda (${nombres}) no se admiten en tendencias: cada término se cuenta por separado.`,
          'Separe los términos con comas (p. ej. «iglesia, estado») o ponga la palabra entre comillas para contarla '
          + 'literalmente (p. ej. "not").');
      }
    }

    if (inner.includes('*')) {
      if (quoted) return error('asterisco', 'Entre comillas el asterisco no trunca.', `Quite las comillas: ${inner}`);
      const base = inner.endsWith('*') ? inner.slice(0, -1) : cpsDe(inner).slice(0, -1).join('');
      let nAst = 0;
      for (let i = 0; i < inner.length; i++) if (inner[i] === '*') nAst++;
      if (nAst > 1 || !inner.endsWith('*') || !base || tokenize(cpsDe(base).slice(-1)[0]).length === 0) {
        return error('asterisco', 'El asterisco solo puede ir pegado al final de una palabra.', 'Ejemplo: republic*');
      }
      const toks = tokenize(base);
      if (toks.length !== 1) {
        return error('asterisco', 'El asterisco solo trunca una palabra suelta, no una frase.',
          `Cuente la frase completa ("${base}") o solo el prefijo de una palabra.`);
      }
      if (len(toks[0]) < MIN_PREFIX_CHARS) {
        return error('prefijo_corto',
          `El prefijo «${inner}» es demasiado corto: se exigen al menos ${MIN_PREFIX_CHARS} letras o cifras antes del asterisco.`,
          'Alargue el prefijo (p. ej. «agrar*») o escriba la palabra completa.');
      }
      Object.assign(t, { type: 'prefijo', tokens: toks, variant: false, match: `"${toks[0]}" *`, query: `${strip(base)}*` });
    } else {
      const toks = tokenize(inner);
      if (!toks.length) {
        return error('sin_palabras', 'El término no contiene letras ni cifras que registre el índice.', 'Escriba al menos una palabra.');
      }
      if (toks.length === 1) {
        const limpio = soloPalabra(inner);
        if (variants && !quoted && len(limpio) >= 4 && len(toks[0]) >= 4 && !VACIAS.has(fold(limpio))) {
          Object.assign(t, { type: 'prefijo', tokens: toks, variant: true, match: `"${toks[0]}" *`, query: `${limpio}*` });
        } else {
          Object.assign(t, { type: 'palabra', tokens: toks, variant: false, match: `"${toks[0]}"`, query: `"${inner}"` });
        }
      } else {
        Object.assign(t, { type: 'frase', tokens: toks, variant: false, match: `"${toks.join(' ')}"`, query: `"${inner}"` });
        if (variants && !quoted) t.warnings.push({ code: 'variantes_no_frase', message: 'Las variantes no se aplican a las frases.' });
      }
    }
    t.ok = true;
    t.key = `${t.type}:${t.tokens.join(' ')}`;
    return t;
  }

  function fiabilidad(tokens) {
    if (tokens <= 0) return 'vacio';
    if (tokens >= UMBRAL_NORMAL) return 'normal';
    if (tokens >= UMBRAL_BAJA) return 'baja';
    return 'muy_baja';
  }

  // ------------------------------------------------------------------------------------------------ lectura rápida
  /** Recorre las filas con las exportaciones del wasm: porFila(X, p) lee con X.sqlite3_column_*(p, i). */
  function recorrer(bd, sql, bind, porFila) {
    const stmt = bd.db.prepare(sql);
    try {
      if (bind !== undefined && bind !== null && (!Array.isArray(bind) || bind.length)) stmt.bind(bind);
      const X = bd.sqlite3.wasm.exports;
      const p = stmt.pointer;
      let rc;
      while ((rc = X.sqlite3_step(p)) === SQLITE_ROW) porFila(X, p);
      if (rc !== SQLITE_DONE) throw new Error(S.errorSqlite(bd, null));
    } finally {
      stmt.finalize();
    }
  }

  /** Varints de SQLite en unos bytes (1-9 bytes; el noveno aporta sus 8 bits). */
  function varints(b) {
    const out = [];
    let i = 0;
    while (i < b.length) {
      let v = 0;
      for (let j = 0; j < 9; j++) {
        if (i >= b.length) break;
        const x = b[i++];
        if (j === 8) { v = v * 256 + x; break; }
        v = v * 128 + (x & 0x7F);
        if (x < 0x80) break;
      }
      out.push(v);
    }
    return out;
  }

  const bitLength = (x) => (x <= 0 ? 0 : Math.floor(Math.log2(x)) + 1);

  /** Primeros 4 dígitos-guion-2 dígitos (y opcionalmente -2 más) con \d de Python; devuelve [texto, año, mes] o null. */
  function buscarFecha(s, conDia, anclado) {
    const d = (ch) => ch !== undefined && C.isdecimal(ch);
    const ult = anclado ? 0 : s.length - 1;
    for (let i = 0; i <= ult; i++) {
      const L = conDia ? 10 : 7;
      if (i + L > s.length) break;
      let ok = d(s[i]) && d(s[i + 1]) && d(s[i + 2]) && d(s[i + 3]) && s[i + 4] === '-' && d(s[i + 5]) && d(s[i + 6]);
      if (ok && conDia) ok = s[i + 7] === '-' && d(s[i + 8]) && d(s[i + 9]);
      if (ok) {
        const txt = s.slice(i, i + L);
        return [txt, TR.pyInt(txt.slice(0, 4)), TR.pyInt(txt.slice(5, 7))];
      }
    }
    return null;
  }

  /** int(x) de Python para los campos del sidecar, o null si Python lanzaría. */
  function enteroPy(v) {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
    if (typeof v === 'string') { try { return Number(TR.pyInt(v)); } catch (e) { return null; } }
    return null;
  }

  /** ngram._leer_sidecar sobre el objeto JSON ya leído. */
  function leerSidecar(data, ruta) {
    const info = { path: ruta, found: true, rows: 0, invalid: 0, without_date: 0 };
    let filas = data;
    const esObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    if (esObj(data)) {
      const vacio = (v) => v === undefined || v === null || v === '' || v === 0 || v === false
        || (Array.isArray(v) && !v.length) || (esObj(v) && !Object.keys(v).length);
      filas = !vacio(data.sessions) ? data.sessions : !vacio(data.sesiones) ? data.sesiones : [];
    }
    if (esObj(filas)) filas = Object.values(filas);
    const mapa = new Map();
    for (const f of Array.isArray(filas) ? filas : []) {
      if (!esObj(f)) { info.invalid++; continue; }
      info.rows++;
      const a = enteroPy(f.id_min), b = enteroPy(f.id_max), n = enteroPy(f.n);
      if (a === null || b === null || n === null) { info.invalid++; continue; }
      let fecha = null;
      for (const k of ['date_real', 'fecha_real', 'date']) {
        const v = f[k];
        if (v !== undefined && v !== null && v !== '' && v !== 0 && v !== false) { fecha = v; break; }
      }
      const m = buscarFecha(fecha === null ? '' : (typeof fecha === 'string' ? fecha : C.pyStr(fecha)), true, false);
      if (!m || !(m[2] >= 1 && m[2] <= 12)) { info.without_date++; continue; }
      mapa.set(`${a},${b},${n}`, m[0]);
    }
    return [mapa, info];
  }

  // ------------------------------------------------------------------------------------------------ índice
  /** NgramIndex.build. */
  function construir(bd, sidecar, ruta = 'sessions.json') {
    const t0 = ahora();
    const fts = FTS_TABLE;
    // Sesiones del corpus: (date, num_session) → ids
    const grupos = S.tuplas(bd, 'SELECT date, num_session, min(id), max(id), count(*), group_concat(id) FROM speeches '
      + 'GROUP BY date, num_session');
    let nSpeeches = 0, maxId = 0;
    for (const g of grupos) { nSpeeches += g[4]; if (g[3] > maxId) maxId = g[3]; }
    const n = maxId + 1;

    const tokens = new Int32Array(n);
    let nDocsize = 0, maxTok = 0, sumaTok = 0;
    try {
      recorrer(bd, `SELECT id, sz FROM ${fts}_docsize`, null, (X, p) => {
        nDocsize++;
        const rid = X.sqlite3_column_int64 ? Number(X.sqlite3_column_int64(p, 0)) : X.sqlite3_column_int(p, 0);
        const nb = X.sqlite3_column_bytes(p, 1);
        if (rid >= 0 && rid < n && nb > 0) {
          const ptr = X.sqlite3_column_blob(p, 1);
          const heap = bd.sqlite3.wasm.heap8u();
          let v = 0;
          for (let i = 0; i < nb; i++) {
            const x = heap[ptr + i];
            v = v * 128 + (x & 0x7F);
            if (x < 0x80) break;
          }
          tokens[rid] = v;
        }
      });
    } catch (e) {
      throw new Error(`Falta la tabla ${fts}_docsize (${e.message}). El motor de tendencias necesita los tokens por `
        + 'intervencion que guarda FTS5; el indice debe crearse sin columnsize=0 (como hace tools/build_corpus.py).');
    }
    for (let i = 0; i < n; i++) { const v = tokens[i]; if (v > maxTok) maxTok = v; sumaTok += v; }
    const shift = Math.max(8, bitLength(maxTok + 64));

    let v = [];
    try {
      const blob = S.valor(bd, `SELECT block FROM ${fts}_data WHERE id = 1`);
      v = blob && blob.length ? varints(blob) : [];
    } catch (e) { v = []; }
    let ftsRows, ftsTotal, ftsFuente = 'averages';
    if (v.length >= 2) {
      ftsRows = v[0];
      ftsTotal = 0;
      for (let i = 1; i < v.length; i++) ftsTotal += v[i];
    } else {
      ftsRows = nDocsize; ftsTotal = sumaTok; ftsFuente = 'docsize';
    }

    const sesiones = grupos.map((g) => ({ fecha: g[0], num: g[1], rango: `${g[2]},${g[3]},${g[4]}`, n: g[4], ids: g[5] }));

    // Fechas reales del sidecar, si casa fila a fila.
    let sidecarInfo;
    let dateSource = 'corpus';
    const reales = new Map();
    if (sidecar !== undefined && sidecar !== null) {
      const [mapa, info] = leerSidecar(sidecar, ruta);
      const porRango = new Map(sesiones.map((s) => [s.rango, s]));
      let aplicadas = 0, cambiadas = 0;
      for (const [rango, fechaReal] of mapa) {
        const s = porRango.get(rango);
        if (!s) continue;
        reales.set(s, fechaReal);
        aplicadas++;
        if (fechaReal !== s.fecha) cambiadas++;
      }
      Object.assign(info, { applied: aplicadas, discarded: mapa.size - aplicadas, dates_changed: cambiadas });
      sidecarInfo = info;
      if (aplicadas) dateSource = 'sessions.json';
    } else {
      sidecarInfo = { found: false, path: null };
    }

    const mes = (fecha) => {
      if (typeof fecha !== 'string') return null;
      const m = buscarFecha(fecha, false, true);
      return m && m[2] >= 1 && m[2] <= 12 ? [m[1], m[2]] : null;
    };
    for (const s of sesiones) {
      s.efectiva = reales.has(s) ? reales.get(s) : s.fecha;
      s.ym = mes(s.efectiva);
    }
    const validos = sesiones.filter((s) => s.ym).map((s) => s.ym);
    const months = [];
    let base = null;
    if (validos.length) {
      const cmpYm = (a, b) => a[0] - b[0] || a[1] - b[1];
      const lo = validos.reduce((a, b) => (cmpYm(b, a) < 0 ? b : a));
      const hi = validos.reduce((a, b) => (cmpYm(b, a) > 0 ? b : a));
      const total = (hi[0] - lo[0]) * 12 + (hi[1] - lo[1]) + 1;
      for (let i = 0; i < total; i++) {
        const y = lo[0] + Math.floor((lo[1] - 1 + i) / 12);
        const m = ((lo[1] - 1 + i) % 12) + 1;
        months.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`);
      }
      base = lo;
    }
    const M = months.length;

    const monthOf = new Int16Array(n).fill(-1);
    const monthTokens = new Float64Array(M), monthSpeeches = new Float64Array(M), monthSessions = new Array(M).fill(0);
    const first = new Array(M).fill(null), last = new Array(M).fill(null);
    let cmin = new Array(M).fill(null), cmax = new Array(M).fill(null);
    let undated = 0;
    const existe = new Uint8Array(n);
    for (const s of sesiones) {
      const i = M && s.ym ? (s.ym[0] - base[0]) * 12 + (s.ym[1] - base[1]) : -1;
      s.indice = i;
      const txt = s.ids || '';
      let x = 0, hay = false;
      for (let k = 0; k <= txt.length; k++) {
        const c = k < txt.length ? txt.charCodeAt(k) : 44;
        if (c === 44) {
          if (hay) { monthOf[x] = i; existe[x] = 1; if (i >= 0) { monthTokens[i] += tokens[x]; monthSpeeches[i]++; } }
          x = 0; hay = false;
        } else { x = x * 10 + (c - 48); hay = true; }
      }
      if (i < 0) { undated += s.n; continue; }
      monthSessions[i]++;
      const f = s.efectiva;
      if (first[i] === null || f < first[i]) first[i] = f;
      if (last[i] === null || f > last[i]) last[i] = f;
      const c = s.fecha;
      if (c === null || c === undefined) continue;
      if (cmin[i] === null || c < cmin[i]) cmin[i] = c;
      if (cmax[i] === null || c > cmax[i]) cmax[i] = c;
    }

    // Rangos de ids de cada mes: tramos consecutivos de ids existentes (los huecos no cortan).
    const rangos = Array.from({ length: M }, () => []);
    let ini = -1, fin = -1, mAct = -2;
    for (let id = 0; id < n; id++) {
      if (!existe[id]) continue;
      const m = monthOf[id];
      if (m !== mAct) {
        if (mAct >= 0) rangos[mAct].push([ini, fin]);
        mAct = m; ini = id;
      }
      fin = id;
    }
    if (mAct >= 0 && ini >= 0) rangos[mAct].push([ini, fin]);

    // Rango de fechas del corpus: solo vale si no mete intervenciones de otros meses.
    const exacto = new Array(M).fill(false);
    for (let i = 0; i < M; i++) {
      if (cmin[i] === null || !monthSpeeches[i]) continue;
      let dentro = 0;
      for (const s of sesiones) {
        if (s.fecha !== null && s.fecha !== undefined && s.fecha >= cmin[i] && s.fecha <= cmax[i]) dentro += s.n;
      }
      exacto[i] = dentro === monthSpeeches[i];
      if (!exacto[i]) { cmin[i] = null; cmax[i] = null; }
    }

    return {
      fts_table: fts, max_id: maxId, n_speeches: nSpeeches, month_of: monthOf, tokens, fts_rows: ftsRows,
      fts_total_tokens: ftsTotal, fts_totals_source: ftsFuente, months, month_tokens: monthTokens,
      month_speeches: monthSpeeches, month_sessions: monthSessions, month_first: first, month_last: last,
      month_corpus_min: cmin, month_corpus_max: cmax, month_date_exact: exacto, month_ranges: rangos, undated, shift,
      date_source: dateSource, sidecar: sidecarInfo, vocab: null, build_ms: C.pyRound(ahora() - t0, 1),
      cache: new Map(), stats: new Map(),
    };
  }

  /** Índice perezoso por corpus, guardado en el objeto de caché del núcleo (un worker = un corpus). */
  function indice(bd, cache, sidecar) {
    const c = cache || {};
    if (!c.ngram || c.ngram.db !== bd.db) c.ngram = { db: bd.db, ix: construir(bd, sidecar) };
    return c.ngram.ix;
  }

  function cacheGet(ix, key) {
    const e = ix.cache.get(key);
    if (e !== undefined) { ix.cache.delete(key); ix.cache.set(key, e); }
    return e;
  }

  function cachePut(ix, key, entry) {
    ix.cache.delete(key);
    ix.cache.set(key, entry);
    while (ix.cache.size > CACHE_TERMS) ix.cache.delete(ix.cache.keys().next().value);
  }

  function indiceMes(ix, month) {
    if (typeof month === 'number') {
      if (!(Number.isInteger(month) && month >= 0 && month < ix.months.length)) throw new Error(`Mes fuera del calendario: ${month}`);
      return month;
    }
    const i = ix.months.indexOf(String(month).slice(0, 7));
    if (i < 0) throw new Error(`Mes fuera del calendario: ${month}`);
    return i;
  }

  function monthSpeechIds(ix, month) {
    const i = indiceMes(ix, month);
    const out = [];
    for (let id = 0; id < ix.month_of.length; id++) if (ix.month_of[id] === i) out.push(id);
    return out;
  }

  function monthFilter(ix, month) {
    const i = indiceMes(ix, month);
    const exacto = ix.month_date_exact.length ? !!ix.month_date_exact[i] : false;
    return { month: ix.months[i], speeches: ix.month_speeches[i],
      kind: !ix.month_speeches[i] ? 'empty' : (exacto ? 'dates' : 'id_ranges'),
      date_range_exact: exacto, date_from: exacto ? ix.month_corpus_min[i] : null, date_to: exacto ? ix.month_corpus_max[i] : null,
      speech_id_ranges: ix.month_ranges[i].map((r) => r.slice()) };
  }

  // ------------------------------------------------------------------------------------------------ recuento
  function asegurarVocab(bd, ix) {
    if (ix.vocab === false) return false;
    try {
      S.ejecutar(bd, `CREATE VIRTUAL TABLE IF NOT EXISTS temp.ngram_vi USING fts5vocab(main, ${ix.fts_table}, instance)`);
      S.ejecutar(bd, `CREATE VIRTUAL TABLE IF NOT EXISTS temp.ngram_vr USING fts5vocab(main, ${ix.fts_table}, row)`);
      if (ix.vocab === null) S.filas(bd, 'SELECT term FROM temp.ngram_vr LIMIT 1');
      ix.vocab = true;
    } catch (e) {
      ix.vocab = false;
    }
    return ix.vocab;
  }

  const VACIO = new Int32Array(0);

  /** Recuentos densos por documento → (ids, recuentos) sin ceros. */
  function disperso(dense) {
    let k = 0;
    for (let i = 0; i < dense.length; i++) if (dense[i]) k++;
    const ids = new Int32Array(k), cnt = new Int32Array(k);
    k = 0;
    for (let i = 0; i < dense.length; i++) if (dense[i]) { ids[k] = i; cnt[k++] = dense[i]; }
    return [ids, cnt];
  }

  function autosolapada(tokens) {
    const k = tokens.length;
    for (let s = 1; s < k; s++) {
      let igual = true;
      for (let i = 0; i < k - s; i++) if (tokens[s + i] !== tokens[i]) { igual = false; break; }
      if (igual) return true;
    }
    return false;
  }

  function contarEnMarcas(h, tokens) {
    const k = tokens.length;
    let total = 0;
    for (const m of h.matchAll(/\x01([\s\S]*?)\x02/g)) {
      const tk = tokenize(m[1]);
      let c = 0;
      for (let i = 0; i + k <= tk.length; i++) {
        let ok = true;
        for (let j = 0; j < k; j++) if (tk[i + j] !== tokens[j]) { ok = false; break; }
        if (ok) c++;
      }
      total += Math.max(1, c);
    }
    return total;
  }

  function porHighlight(bd, ix, spec) {
    const fts = ix.fts_table;
    const solapa = spec.type === 'frase' && autosolapada(spec.tokens);
    const pares = [];
    for (const [rid, h] of S.tuplas(bd, `SELECT rowid, highlight(${fts}, 0, char(1), char(2)) FROM ${fts} WHERE ${fts} MATCH ?`, [spec.match])) {
      if (!h) continue;
      const c = solapa ? contarEnMarcas(h, spec.tokens) : h.split('\x01').length - 1;
      if (c) pares.push([rid, c]);
    }
    pares.sort((a, b) => a[0] - b[0]);
    return [Int32Array.from(pares, (p) => p[0]), Int32Array.from(pares, (p) => p[1])];
  }

  /** Frecuencia por documento despejada de bm25(). null si no sale entera. */
  function porBm25(bd, ix, spec) {
    const fts = ix.fts_table;
    if (ix.fts_rows <= 0 || ix.fts_total_tokens <= 0) return null;
    const ids = [], sc = [];
    try {
      recorrer(bd, `SELECT rowid, bm25(${fts}) FROM ${fts} WHERE ${fts} MATCH ?`, [spec.match], (X, p) => {
        ids.push(X.sqlite3_column_int(p, 0));
        sc.push(X.sqlite3_column_double(p, 1));
      });
    } catch (e) {
      return null;
    }
    const nHit = ids.length;
    if (nHit === 0) return [VACIO, VACIO];
    let ordenado = true;
    for (let i = 0; i < nHit; i++) {
      if (ids[i] < 0 || ids[i] > ix.max_id) return null;
      if (i && ids[i] < ids[i - 1]) ordenado = false;
    }
    const N = ix.fts_rows;
    let idf = Math.log((N - nHit + 0.5) / (nHit + 0.5));
    if (idf <= 0.0) idf = 1e-6;
    const avgdl = ix.fts_total_tokens / ix.fts_rows;
    const outIds = new Int32Array(nHit), outCnt = new Int32Array(nHit);
    for (let i = 0; i < nHit; i++) {
      const s = -sc[i] / idf;
      const D = ix.tokens[ids[i]];
      const Kd = BM25_K1 * (1 - BM25_B + BM25_B * D / avgdl);
      const f = s * Kd / ((BM25_K1 + 1.0) - s);
      const fr = Math.round(f);
      if (!Number.isFinite(f) || Math.abs(f - fr) > 1e-6 || fr < 1) return null;
      outIds[i] = ids[i];
      outCnt[i] = fr;
    }
    if (!ordenado) {
      const orden = Array.from(outIds.keys()).sort((a, b) => outIds[a] - outIds[b]);
      return [Int32Array.from(orden, (k) => outIds[k]), Int32Array.from(orden, (k) => outCnt[k])];
    }
    return [outIds, outCnt];
  }

  /** Frase exacta: posiciones consecutivas en fts5vocab(instance). */
  function porPosiciones(bd, ix, tokens) {
    const escala = 2 ** ix.shift;
    const claves = new Map();
    for (const tok of new Set(tokens)) {
      const a = [];
      recorrer(bd, 'SELECT doc, "offset" FROM temp.ngram_vi WHERE term = ?', [tok], (X, p) => {
        a.push(X.sqlite3_column_int(p, 0) * escala + X.sqlite3_column_int(p, 1));
      });
      const arr = Float64Array.from(a);
      let orden = true;
      for (let i = 1; i < arr.length; i++) if (arr[i] < arr[i - 1]) { orden = false; break; }
      if (!orden) arr.sort();
      claves.set(tok, arr);
    }
    let r = 0;
    for (let j = 1; j < tokens.length; j++) if (claves.get(tokens[j]).length < claves.get(tokens[r]).length) r = j;
    let inicio = Array.from(claves.get(tokens[r]), (x) => x - r);
    for (let j = 0; j < tokens.length; j++) {
      if (j === r || !inicio.length) continue;
      const arr = claves.get(tokens[j]);
      if (!arr.length) { inicio = []; break; }
      const sig = [];
      for (const x of inicio) {
        const cand = x + j;
        let lo = 0, hi = arr.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < cand) lo = m + 1; else hi = m; }
        if (arr[Math.min(lo, arr.length - 1)] === cand) sig.push(x);
      }
      inicio = sig;
    }
    const dense = new Int32Array(ix.max_id + 1);
    for (const x of inicio) {
      const doc = Math.floor(x / escala);
      if (doc >= 0 && doc <= ix.max_id) dense[doc]++;
    }
    return disperso(dense);
  }

  function statsToken(bd, ix, tok, useCache = true) {
    if (useCache && ix.stats.has(tok)) return ix.stats.get(tok);
    const f = S.tuplas(bd, 'SELECT doc, cnt FROM temp.ngram_vr WHERE term = ?', [tok])[0];
    const r = f ? [Number(f[0]), Number(f[1])] : [0, 0];
    if (useCache) {
      if (ix.stats.size >= 8192) ix.stats.clear();
      ix.stats.set(tok, r);
    }
    return r;
  }

  /** ngram._planificar. */
  function planificar(bd, ix, spec, vocab, useCache = true) {
    const tipo = spec.type, toks = spec.tokens;
    if (!vocab) return { method: 'bm25', est_ms: null };
    const plan = {};
    let costes;
    if (tipo === 'prefijo') {
      const lo = toks[0], hi = toks[0] + MAX_CP;
      const [nFormas, apariciones, docs] = S.tuplas(bd, 'SELECT count(*), coalesce(sum(cnt), 0), coalesce(sum(doc), 0) '
        + 'FROM temp.ngram_vr WHERE term >= ? AND term < ?', [lo, hi])[0].map(Number);
      const formas = S.tuplas(bd, 'SELECT term, cnt FROM temp.ngram_vr WHERE term >= ? AND term < ? ORDER BY cnt DESC, term LIMIT 8',
        [lo, hi]).map((r) => ({ form: r[0], n: Number(r[1]) }));
      Object.assign(plan, { n_forms: nFormas, forms: formas, instances: apariciones });
      if (apariciones > MAX_PREFIX_INSTANCES) {
        Object.assign(plan, { method: 'fts5vocab', est_ms: null, error: 'prefijo_amplio' });
        return plan;
      }
      costes = [['fts5vocab', apariciones * MS_APARICION_PREFIJO + 0.2], ['bm25', docs * MS_DOC_BM25 + 0.5]];
    } else if (tipo === 'palabra') {
      const [doc, cnt] = statsToken(bd, ix, toks[0], useCache);
      Object.assign(plan, { instances: cnt, n_docs: doc });
      if (cnt === 0) {
        Object.assign(plan, { method: 'fts5vocab', est_ms: 0.0, missing_tokens: [toks[0]] });
        return plan;
      }
      costes = [['fts5vocab', cnt * MS_APARICION + 0.2], ['bm25', doc * MS_DOC_BM25 + 0.5]];
    } else {
      const stats = new Map();
      for (const tok of new Set(toks)) stats.set(tok, statsToken(bd, ix, tok, useCache));
      const faltan = [...stats].filter(([, dc]) => dc[1] === 0).map(([t]) => t);
      if (faltan.length) {
        Object.assign(plan, { method: 'fts5vocab', est_ms: 0.0, missing_tokens: faltan });
        return plan;
      }
      costes = [['bm25', Math.min(...[...stats.values()].map((dc) => dc[0])) * MS_DOC_FRASE + 0.5]];
    }
    let mejor = costes[0];
    for (const c of costes) if (c[1] < mejor[1]) mejor = c;
    Object.assign(plan, { method: mejor[0], est_ms: C.pyRound(mejor[1], 1) });
    if (mejor[1] > MAX_MS_TERMINO) plan.error = 'termino_costoso';
    return plan;
  }

  /** ngram._ejecutar: recuento por documento sin filtros. */
  function ejecutar(bd, ix, spec, plan) {
    const entry = {};
    for (const k of ['n_forms', 'forms', 'instances', 'est_ms', 'missing_tokens']) if (k in plan) entry[k] = plan[k];
    entry.method = plan.method;
    if (plan.error) { entry.error = plan.error; return entry; }
    const tipo = spec.type, toks = spec.tokens;
    if (plan.missing_tokens && plan.missing_tokens.length) { entry.ids = VACIO; entry.counts = VACIO; return entry; }

    let metodo = plan.method;
    if (metodo === 'bm25') {
      const r = porBm25(bd, ix, spec);
      if (r !== null) { [entry.ids, entry.counts] = r; return entry; }
      entry.bm25_fallback = true;
      metodo = ix.vocab ? (tipo === 'frase' ? 'posiciones' : 'fts5vocab') : 'highlight';
    }
    entry.method = metodo;

    if (metodo === 'fts5vocab' && tipo !== 'frase') {
      const dense = new Int32Array(ix.max_id + 1);
      const maxId = ix.max_id;
      const contar = (X, p) => { const d = X.sqlite3_column_int(p, 0); if (d >= 0 && d <= maxId) dense[d]++; };
      if (tipo === 'prefijo') recorrer(bd, 'SELECT doc FROM temp.ngram_vi WHERE term >= ? AND term < ?', [toks[0], toks[0] + MAX_CP], contar);
      else recorrer(bd, 'SELECT doc FROM temp.ngram_vi WHERE term = ?', [toks[0]], contar);
      [entry.ids, entry.counts] = disperso(dense);
      return entry;
    }
    if (metodo === 'posiciones' || metodo === 'fts5vocab') {
      entry.method = 'posiciones';
      [entry.ids, entry.counts] = porPosiciones(bd, ix, toks);
      return entry;
    }
    entry.method = 'highlight';
    [entry.ids, entry.counts] = porHighlight(bd, ix, spec);
    return entry;
  }

  /** ngram._recuento: planifica y cuenta; `metodo` fuerza un camino (comprobaciones). */
  function recuento(bd, ix, spec, vocab, metodo = null) {
    let plan = planificar(bd, ix, spec, vocab);
    if (metodo && !plan.missing_tokens) {
      if ((metodo === 'fts5vocab' || metodo === 'posiciones') && !vocab) throw new Error(`El camino ${metodo} necesita fts5vocab`);
      if (metodo === 'fts5vocab' && spec.type === 'frase') metodo = 'posiciones';
      if (metodo === 'posiciones' && spec.type !== 'frase') metodo = 'fts5vocab';
      plan = Object.assign({}, plan);
      delete plan.error;
      plan.method = metodo;
    }
    return ejecutar(bd, ix, spec, plan);
  }

  function parecidas(bd, tok, n = 3) {
    const cps = cpsDe(tok);
    if (cps.length < 2) return [];
    const lo = cps.slice(0, 2).join('');
    const filas = S.tuplas(bd, 'SELECT term, cnt FROM temp.ngram_vr WHERE term >= ? AND term < ? ORDER BY cnt DESC LIMIT 20000', [lo, lo + MAX_CP]);
    const cnt = new Map();
    for (const r of filas) cnt.set(r[0], Number(r[1]));
    return DL.get_close_matches(tok, [...cnt.keys()], n, 0.75).map((f) => ({ form: f, n: cnt.get(f) }));
  }

  function datosCero(bd, spec, entry, vocab) {
    if (!vocab) return {};
    const toks = spec.tokens;
    if (spec.type === 'frase') {
      const faltan = entry.missing_tokens || [];
      const propuestas = {};
      for (const t of faltan) propuestas[t] = parecidas(bd, t);
      return { faltan, propuestas };
    }
    if (spec.type === 'prefijo') {
      let p = cpsDe(toks[0]).slice(0, -1);
      while (p.length >= MIN_PREFIX_CHARS) {
        const ps = p.join('');
        const formas = S.tuplas(bd, 'SELECT term, cnt FROM temp.ngram_vr WHERE term >= ? AND term < ? ORDER BY cnt DESC LIMIT 5',
          [ps, ps + MAX_CP]).map((r) => ({ form: r[0], n: Number(r[1]) }));
        if (formas.length) return { prefijo: ps, formas };
        p = p.slice(0, -1);
      }
      return {};
    }
    return { alternativas: parecidas(bd, toks[0]) };
  }

  function avisoCero(spec, datos, vocab) {
    if (!vocab) return { code: 'sin_menciones', message: 'El término no aparece en el corpus.' };
    const toks = spec.tokens;
    if (spec.type === 'frase') {
      if (!(datos.faltan && datos.faltan.length)) {
        return { code: 'sin_menciones', message: 'Las palabras aparecen en el corpus, pero nunca seguidas en este orden.' };
      }
      return { code: 'sin_menciones', message: `No aparecen en el corpus: ${datos.faltan.join(', ')}.`, alternatives: datos.propuestas };
    }
    if (spec.type === 'prefijo') {
      const out = { code: 'sin_menciones', message: `Ninguna palabra empieza por «${toks[0]}».` };
      if (datos.formas && datos.formas.length) Object.assign(out, { suggestion: `Pruebe «${datos.prefijo}*».`, alternatives: datos.formas });
      return out;
    }
    const alternativas = datos.alternativas || [];
    const out = { code: 'sin_menciones', message: `«${spec.label}» no aparece en el corpus.` };
    if (alternativas.length) {
      out.suggestion = `¿Quería decir ${alternativas.map((a) => `«${a.form}»`).join(' o ')}?`;
      out.alternatives = alternativas;
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------------ consulta
  /** Máscara Uint8Array por id desde una lista de ids (o una máscara ya hecha). */
  function mascara(ix, allowed) {
    if (allowed === null || allowed === undefined) return null;
    const n = ix.max_id + 1;
    if (allowed instanceof Uint8Array && allowed.length === n) return allowed;
    const mask = new Uint8Array(n);
    for (const id of allowed) { const i = Number(id); if (i >= 0 && i < n) mask[i] = 1; }
    return mask;
  }

  function milestones(ix = null) {
    const pos = new Map();
    if (ix) ix.months.forEach((m, i) => pos.set(m, i));
    return R2.gen.hitos.map((h) => {
      const d = Object.assign({}, h);
      d.month = h.date.slice(0, 7);
      const i = pos.has(d.month) ? pos.get(d.month) : null;
      d.month_index = i;
      if (ix && ix.months.length) {
        d.in_calendar = i !== null;
        d.position = i !== null ? 'dentro' : (d.month < ix.months[0] ? 'antes' : 'despues');
        d.month_empty = !!(i !== null && ix.month_speeches[i] === 0);
      }
      return d;
    });
  }

  /** ngram._contar (sin presupuesto). */
  function contar(bd, ix, spec, mask, vocab, useCache, gasto) {
    const t1 = ahora();
    let entry = useCache ? cacheGet(ix, spec.key) : undefined;
    spec.cached = entry !== undefined;
    if (entry === undefined) {
      const plan = planificar(bd, ix, spec, vocab, useCache);
      entry = ejecutar(bd, ix, spec, plan);
      gasto.contados++;
      if (useCache) cachePut(ix, spec.key, entry);
    }
    for (const k of ['n_forms', 'forms', 'est_ms']) if (k in entry) spec[k] = entry[k];
    spec.method = entry.method;
    const cerrar = () => {
      const d = ahora() - t1;
      gasto.ms += d;
      spec.ms = C.pyRound(d, 1);
    };
    if (entry.error) {
      spec.ok = false;
      spec.error = entry.error;
      if (entry.error === 'prefijo_amplio') {
        spec.message = `«${spec.query}» abarca ${miles(entry.n_forms)} formas y ${miles(entry.instances)} apariciones; el tope es `
          + `${miles(MAX_PREFIX_INSTANCES)}.`;
        spec.message = spec.message.split(',').join('.');
        spec.suggestion = `Alargue el prefijo o cuente alguna de sus formas: ${(entry.forms || []).slice(0, 5).map((f) => f.form).join(', ')}`;
      } else {
        spec.message = `«${spec.label}» costaría unos ${C.pyFormat(entry.est_ms === undefined || entry.est_ms === null ? 0 : entry.est_ms, '.0f')} ms `
          + `(tope ${MAX_MS_TERMINO} ms por término): sus palabras aparecen en demasiadas intervenciones.`;
        spec.suggestion = 'Cuente una forma más específica: añada a la frase una palabra menos frecuente.';
      }
      cerrar();
      return;
    }

    const ids = entry.ids, cnt = entry.counts;
    let totalCorpus = 0;
    for (let i = 0; i < cnt.length; i++) totalCorpus += cnt[i];
    spec.total_corpus = totalCorpus;
    spec.docs_corpus = ids.length;
    const M = ix.months.length;
    const counts = new Array(M).fill(0), docs = new Array(M).fill(0);
    let total = 0, totalDocs = 0;
    const monthOf = ix.month_of;
    for (let k = 0; k < ids.length; k++) {
      const id = ids[k];
      if (mask && !mask[id]) continue;
      const m = monthOf[id];
      if (m < 0) continue;
      counts[m] += cnt[k];
      docs[m]++;
      total += cnt[k];
      totalDocs++;
    }
    spec.counts = counts;
    spec.docs = docs;
    spec.total = total;
    spec.total_docs = totalDocs;
    if (spec.total_corpus === 0) {
      let datos = entry.zero_data;
      if (datos === undefined) {
        datos = datosCero(bd, spec, entry, vocab);
        entry.zero_data = datos;
      }
      spec.warnings.push(avisoCero(spec, datos, vocab));
    } else if (spec.total === 0) {
      spec.warnings.push({ code: 'sin_menciones_filtradas',
        message: `Ninguna mención con los filtros aplicados; hay ${miles(spec.total_corpus)} en todo el corpus.`.split(',').join('.') });
    }
    cerrar();
  }

  /** ngram.compute sin presupuesto. `ceder` (opcional, async) se llama entre términos. */
  async function compute(bd, ix, terms, opciones = {}) {
    const { variants = false, allowed = null, useCache = true, includeMilestones = true, ceder = null } = opciones;
    const t0 = ahora();
    const lista = parseTerms(terms);
    const mask = mascara(ix, allowed);
    const vocab = asegurarVocab(bd, ix);
    const M = ix.months.length;

    let denTokens = ix.month_tokens, denSpeeches = ix.month_speeches, nAllowed = null;
    if (mask) {
      denTokens = new Float64Array(M);
      denSpeeches = new Float64Array(M);
      nAllowed = 0;
      const mo = ix.month_of, tk = ix.tokens;
      for (let id = 0; id < mask.length; id++) {
        if (!mask[id]) continue;
        const m = mo[id];
        if (m < 0) continue;
        denTokens[m] += tk[id];
        denSpeeches[m]++;
        nAllowed++;
      }
    }

    const gasto = { ms: 0.0, contados: 0 };
    const resultados = [];
    for (let i = 0; i < lista.length; i++) {
      const raw = lista[i];
      if (i >= MAX_TERMS) {
        resultados.push({ input: raw, label: raw, ok: false, warnings: [], error: 'demasiados_terminos',
          message: `Se cuentan como mucho ${MAX_TERMS} términos por consulta.`, suggestion: 'Quite alguno de los términos anteriores.' });
        continue;
      }
      if (ceder && i) await ceder();
      const spec = analyzeTerm(raw, variants);
      if (spec.ok) contar(bd, ix, spec, mask, vocab, useCache, gasto);
      resultados.push(spec);
    }

    const claves = new Map();
    resultados.forEach((r, i) => {
      if (!r.ok) return;
      if (claves.has(r.key)) {
        r.duplicate_of = claves.get(r.key);
        r.warnings.push({ code: 'duplicado', message: `Cuenta lo mismo que el término ${claves.get(r.key) + 1}.` });
      } else claves.set(r.key, i);
    });

    const suma = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
    const out = {
      engine: 'ngram',
      version: ENGINE_VERSION,
      method: vocab ? 'fts5vocab+bm25' : 'bm25',
      calendar: { from: M ? ix.months[0] : null, to: M ? ix.months[M - 1] : null, n_months: M, date_source: ix.date_source,
        sidecar: ix.sidecar, undated_speeches: ix.undated },
      months: ix.months.slice(),
      thresholds: { normal: UMBRAL_NORMAL, baja: UMBRAL_BAJA },
      filtered: mask !== null,
      n_allowed: nAllowed,
      denominators: {
        tokens: Array.from(denTokens),
        speeches: Array.from(denSpeeches),
        reliability: Array.from(denTokens, (x) => fiabilidad(x)),
        tokens_total: suma(denTokens),
        speeches_total: suma(denSpeeches),
      },
      corpus_months: {
        tokens: Array.from(ix.month_tokens),
        speeches: Array.from(ix.month_speeches),
        sessions: ix.month_sessions.slice(),
        first_date: ix.month_first.slice(),
        last_date: ix.month_last.slice(),
        date_range_exact: ix.month_date_exact.slice(),
        corpus_date_min: ix.month_corpus_min.map((c, i) => (ix.month_date_exact[i] ? c : null)),
        corpus_date_max: ix.month_corpus_max.map((c, i) => (ix.month_date_exact[i] ? c : null)),
        speech_id_ranges: ix.month_ranges.map((rs) => rs.map((r) => r.slice())),
      },
      terms: resultados,
      errors: resultados.filter((r) => !r.ok).length,
      incomplete: false,
      budget: { ms: null, spent_ms: C.pyRound(gasto.ms, 1), counted: gasto.contados },
    };
    if (!lista.length) {
      out.error = 'sin_terminos';
      out.message = 'Escriba al menos un término (separe varios con comas).';
    }
    if (includeMilestones) out.milestones = milestones(ix);
    out.ms = C.pyRound(ahora() - t0, 1);
    return out;
  }

  R2.ngram = Object.freeze({
    ENGINE_VERSION, MAX_TERMS, MIN_PREFIX_CHARS, MAX_PREFIX_INSTANCES, MAX_MS_TERMINO, UMBRAL_NORMAL, UMBRAL_BAJA, CACHE_TERMS,
    parseTerms, analyzeTerm, fold, tokenize, fiabilidad, construir, indice, leerSidecar, monthFilter, monthSpeechIds,
    milestones, compute, mascara, planificar, ejecutar, recuento,
  });
})(globalThis.R2 = globalThis.R2 || {});

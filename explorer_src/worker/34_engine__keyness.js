/* ===== src/engine/keyness.js ===== */
/* 2REP_Standalone · engine/keyness.js
 *
 * Port de app/backend/keyness.py (Léxico: qué palabras distinguen a una colección del resto del corpus) y de
 * search.accented_forms. Mismas fórmulas, mismo SQL y mismos textos:
 *   - tokens de la colección con los patrones del backend (_TOKEN_SIMPLE / _TOKEN_COMPLETO / _RAROS) sobre R2.py.re,
 *     str.lower de Python (R2.py.core.lower) y _plegar_caracter (NFD, base ASCII + marcas Mn de Unicode 15.0);
 *   - frecuencias de referencia exactas de fts5vocab `row` (temp.keyness_vr, lotes de 500 términos);
 *   - tokens del corpus desde el registro de promedios de <fts>_data (id = 1) o, si falla, sumando <fts>_docsize;
 *   - G² de Dunning con signo (tabla 2×2 completa, o·log1p((o−e)/e)) y log-ratio de Hardie (cero → 0,5);
 *   - insignias Exclusivo / Muy distintivo / Significativo; palabras vacías de R2.gen.vacias.STOPWORDS_KEYNESS.
 *
 * API (R2.keyness)
 *   keyness(bd, textos, {min_freq, threshold, stopwords, limit, limit_negative, fts_table}) → dict como keyness.keyness
 *   fold(s) · tokenize(texto) · crudos(texto) · count_terms(textos) → [Map término → n, tokens] · plegar_token(w)
 *   crudos_tramos(texto) · tokenize_tramos(texto) → los mismos tokens en tramos que no cruzan puntuación (SIGNOS_CORTE)
 *   corpus_tokens(bd, fts) · reference_counts(bd, términos, fts) → Map · g2_signed(a, b, c, d) · log_ratio(a, b, c, d)
 *   badge(lr, freq_ref) · accented_forms(textos, términos) → Map término → Map forma → n
 *   bd = { db, sqlite3 } (R2.sql)
 */
(function (R2) {
  'use strict';

  const C = R2.py && R2.py.core;
  const RE = R2.py && R2.py.re;
  const G = R2.gen && R2.gen.constantes && R2.gen.constantes.keyness;
  const VAC = R2.gen && R2.gen.vacias;
  if (!C || !RE || !G || !VAC || !R2.sql || !R2.transformar) {
    throw new Error('engine/keyness.js necesita R2.py.core, R2.py.re, R2.gen.constantes, R2.gen.vacias, R2.sql y R2.transformar (src/orden.json)');
  }
  const S = R2.sql;

  const KEYNESS_VERSION = G.KEYNESS_VERSION;
  const MIN_FREQ = G.MIN_FREQ;
  const UMBRAL_G2 = G.UMBRAL_G2;
  const P_UMBRAL = G.P_UMBRAL;
  const LIMITE_NEGATIVOS = G.LIMITE_NEGATIVOS;
  const LOTE_SQL = G.LOTE_SQL;
  const CORTE_EXCLUSIVO = G.CORTE_EXCLUSIVO;
  const CORTE_MUY_DISTINTIVO = G.CORTE_MUY_DISTINTIVO;
  const CORRECCION_CERO = G.CORRECCION_CERO;
  const INSIGNIAS = G.INSIGNIAS;
  const FORMAS_MAX_CHARS = 4000000;

  // ------------------------------------------------------------------------------------------------ tokenización
  const DIACRITICOS_CP = new Set(G._DIACRITICOS_CP);
  const DIACRITICOS = G._DIACRITICOS;
  const USO_PRIVADO = '-\u{f0000}-\u{ffffd}\u{100000}-\u{10fffd}';
  const TOKEN_SIMPLE = RE.compile('[^\\W_]+');
  const TOKEN_COMPLETO = RE.compile(`(?:[^\\W_]|[${USO_PRIVADO}])(?:[^\\W_]|[${USO_PRIVADO}${DIACRITICOS}])*`);
  const RAROS = RE.compile(`[${USO_PRIVADO}${DIACRITICOS}]`);
  const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const ASCII = /^[\x00-\x7f]*$/;
  const PLEGADO_ESPECIAL = G._PLEGADO_ESPECIAL;

  // Marcas Mn de Unicode 15.0 (las de Python 3.12.7), en el formato compacto de R2.transformar.TRAMOS_FOLD.
  const MN_15 = (() => {
    const n = R2.transformar.TRAMOS_FOLD.mn.split(',').map((x) => parseInt(x, 36));
    const t = new Int32Array(n.length);
    let v = 0;
    for (let i = 0; i < n.length; i++) { v += n[i]; t[i] = v; }
    return t;
  })();
  function esMn(cp) {
    const t = MN_15;
    if (cp < t[0] || cp > t[t.length - 1]) return false;
    let lo = 0, hi = t.length / 2 - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (t[2 * m] <= cp) lo = m; else hi = m - 1;
    }
    return cp <= t[2 * lo + 1];
  }

  const cacheCaracter = new Map();
  /** keyness._plegar_caracter. */
  function plegarCaracter(ch) {
    let r = cacheCaracter.get(ch);
    if (r !== undefined) return r;
    if (Object.prototype.hasOwnProperty.call(PLEGADO_ESPECIAL, ch)) r = PLEGADO_ESPECIAL[ch];
    else if (DIACRITICOS_CP.has(ch.codePointAt(0))) r = '';
    else {
      const d = Array.from(ch.normalize('NFD'));
      r = ch;
      if (d.length > 1 && d[0].codePointAt(0) < 0x80 && d.slice(1).every((x) => esMn(x.codePointAt(0)))) r = d[0];
    }
    if (cacheCaracter.size > 4096) cacheCaracter.clear();
    cacheCaracter.set(ch, r);
    return r;
  }

  function quitarMarcas(s) {
    let out = '';
    for (const ch of s) out += ch.codePointAt(0) < 0x80 ? ch : plegarCaracter(ch);
    return out;
  }

  const cacheToken = new Map();
  function plegarToken(w) {
    let r = cacheToken.get(w);
    if (r === undefined) {
      r = quitarMarcas(w);
      if (cacheToken.size >= 200000) cacheToken.clear();
      cacheToken.set(w, r);
    }
    return r;
  }

  /** Minúsculas y sin diacríticos, como los términos del índice FTS5. */
  function fold(s) {
    s = C.lower(s || '');
    return ASCII.test(s) ? s : quitarMarcas(s);
  }

  /** Tokens en minúsculas y aún sin plegar. */
  function crudos(text) {
    const t = C.lower(text || '');
    if (RAROS.search(t)) return TOKEN_COMPLETO.findall(t);
    // Camino rápido: la misma RegExp traducida de TOKEN_SIMPLE ([^\W_]+ nunca casa vacío), sin el envoltorio por token.
    const rx = TOKEN_SIMPLE._re('g');
    rx.lastIndex = 0;
    const out = [];
    let m;
    while ((m = rx.exec(t)) !== null) out.push(m[0]);
    return out;
  }

  function tokenize(text) {
    return crudos(text).map((w) => (ASCII.test(w) ? w : plegarToken(w)));
  }

  // Signos que separan tramos: una expresión de varias palabras (engine/expresiones.js) no cruza la puntuación de frase
  // o de inciso, las comillas, los paréntesis ni los saltos de línea o tabuladores (las filas de las listas de
  // asistencia y de votación). Ninguno es parte de un token, así que los tokens son los mismos que los de crudos.
  const SIGNOS_CORTE = '.,;:!?¿¡()[]{}«»"“”„–—…•|\n\r\t';
  const CORTE = new Uint8Array(0x2030);
  for (const ch of SIGNOS_CORTE) CORTE[ch.charCodeAt(0)] = 1;
  const RX_CORTE = new RegExp(`[${SIGNOS_CORTE.replace(/[\]\\^-]/g, '\\$&')}]+`);
  function hayCorte(t, desde, hasta) {
    for (let i = desde; i < hasta; i++) { const c = t.charCodeAt(i); if (c < 0x2030 && CORTE[c] === 1) return true; }
    return false;
  }
  /** Tokens en minúsculas y aún sin plegar, en tramos sin signos de corte dentro: [[token, …], …]. */
  function crudosTramos(text) {
    const t = C.lower(text || '');
    const tramos = [];
    if (RAROS.search(t)) {
      for (const s of t.split(RX_CORTE)) { const x = TOKEN_COMPLETO.findall(s); if (x.length) tramos.push(x); }
      return tramos;
    }
    const rx = TOKEN_SIMPLE._re('g');
    rx.lastIndex = 0;
    let actual = [], fin = 0, m;
    while ((m = rx.exec(t)) !== null) {
      if (actual.length && hayCorte(t, fin, m.index)) { tramos.push(actual); actual = []; }
      actual.push(m[0]);
      fin = m.index + m[0].length;
    }
    if (actual.length) tramos.push(actual);
    return tramos;
  }
  /** tokenize por tramos: [[token plegado, …], …]. */
  function tokenizeTramos(text) {
    return crudosTramos(text).map((tr) => tr.map((w) => (ASCII.test(w) ? w : plegarToken(w))));
  }

  /** [Map término plegado → apariciones, total de tokens]. */
  function countTerms(texts) {
    const brutos = new Map();
    let n = 0;
    for (const t of texts) {
      const toks = crudos(t);
      n += toks.length;
      for (const w of toks) brutos.set(w, (brutos.get(w) || 0) + 1);
    }
    const plegados = new Map();
    for (const [w, k] of brutos) {
      const f = ASCII.test(w) ? w : plegarToken(w);
      plegados.set(f, (plegados.get(f) || 0) + k);
    }
    return [plegados, n];
  }

  const STOPWORDS = new Set(VAC.STOPWORDS_KEYNESS);

  // ------------------------------------------------------------------------------------------------ frecuencias del corpus
  function ident(nombre) {
    if (!IDENT.test(nombre || '')) throw new C.PyError('ValueError', `Nombre de tabla FTS no valido: ${C.pyRepr(nombre)}`);
    return nombre;
  }

  function varints(blob) {
    const out = [];
    let i = 0;
    const n = blob.length;
    while (i < n) {
      let v = 0;
      for (let k = 0; k < 9; k++) {
        const x = blob[i];
        i += 1;
        if (k === 8) { v = v * 256 + x; break; }
        v = v * 128 + (x & 0x7f);
        if (!(x & 0x80)) break;
      }
      out.push(v);
    }
    return out;
  }

  const esErrorSqlite = (e) => !!e && (e.name === 'SQLite3Error' || /SQLite3Error|SQLITE_/.test(String(e && e.message)));

  function corpusTokens(bd, ftsTable = 'speeches_fts') {
    const fts = ident(ftsTable);
    try {
      const block = S.valor(bd, `SELECT block FROM ${fts}_data WHERE id = 1`);
      if (block !== undefined && block !== null && block.length) {
        const vals = varints(block);
        if (vals.length >= 2) return vals.slice(1).reduce((x, y) => x + y, 0);
      }
    } catch (e) {
      if (!esErrorSqlite(e)) throw e;
    }
    let total = 0;
    for (const sz of S.columna(bd, `SELECT sz FROM ${fts}_docsize`)) for (const v of varints(sz)) total += v;
    return total;
  }

  function tablaVocab(bd, fts) {
    const nombre = fts === 'speeches_fts' ? 'keyness_vr' : `keyness_vr_${fts}`;
    S.ejecutar(bd, `CREATE VIRTUAL TABLE IF NOT EXISTS temp.${nombre} USING fts5vocab(main, ${fts}, row)`);
    return nombre;
  }

  // Frecuencias del corpus ya consultadas, por conexión (el índice no cambia mientras la base está abierta): el segundo
  // léxico de una biblioteca parecida, o el mismo con «Solo discurso» cambiado, no vuelve a leer el vocabulario FTS5.
  const CACHE_REFERENCIA = new WeakMap();
  const CACHE_REFERENCIA_MAX = 400000;

  /** Map término → apariciones en TODO el corpus (fts5vocab row.cnt); los ausentes valen 0 (se guardan como 0). */
  function referenceCounts(bd, terms, ftsTable = 'speeches_fts', alProgreso = null) {
    const fts = ident(ftsTable);
    const nombre = tablaVocab(bd, fts);
    let cache = CACHE_REFERENCIA.get(bd.db);
    if (!cache || cache.fts !== fts) { cache = { fts, mapa: new Map() }; CACHE_REFERENCIA.set(bd.db, cache); }
    const out = new Map();
    const faltan = [];
    for (const t of terms) {
      const v = cache.mapa.get(t);
      if (v === undefined) faltan.push(t);
      else if (v > 0) out.set(t, v);
    }
    if (alProgreso) alProgreso(0, faltan.length);
    for (let i = 0; i < faltan.length; i += LOTE_SQL) {
      const lote = faltan.slice(i, i + LOTE_SQL);
      const filas = S.tuplas(bd, `SELECT term, cnt FROM temp.${nombre} WHERE term IN (${lote.map(() => '?').join(',')})`, lote);
      if (alProgreso) alProgreso(Math.min(faltan.length, i + lote.length), faltan.length);
      const vistos = new Map();
      for (const [term, cnt] of filas) vistos.set(term, Number(cnt));
      if (cache.mapa.size + lote.length > CACHE_REFERENCIA_MAX) cache.mapa.clear();
      for (const t of lote) {
        const v = vistos.get(t) || 0;
        cache.mapa.set(t, v);
        if (v > 0) out.set(t, v);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------------ estadísticos
  /** o·ln(o/e), con 0·ln 0 = 0 (log1p, como _xlog). */
  const xlog = (o, e) => (o > 0 ? o * Math.log1p((o - e) / e) : 0);

  function g2Signed(a, b, c, d) {
    const n = c + d;
    const k = a + b;
    const e11 = c * k / n;
    const e12 = d * k / n;
    let g2 = 2.0 * (xlog(a, e11) + xlog(b, e12) + xlog(c - a, c - e11) + xlog(d - b, d - e12));
    g2 = Number.isNaN(g2) ? g2 : Math.max(g2, 0.0);
    return a * d >= b * c ? g2 : -g2;
  }

  function logRatio(a, b, c, d) {
    const x = a > 0 ? a : CORRECCION_CERO;
    const y = b > 0 ? b : CORRECCION_CERO;
    return Math.log2((x / c) / (y / d));
  }

  function badge(lr, freqRef) {
    if (freqRef === 0 || lr >= CORTE_EXCLUSIVO) return 'Exclusivo';
    if (lr >= CORTE_MUY_DISTINTIVO) return 'Muy distintivo';
    return 'Significativo';
  }

  const redondeo = (x, n) => C.pyRound(x, n);

  // ------------------------------------------------------------------------------------------------ motor
  function keyness(bd, texts, opciones = {}) {
    const t0 = performance.now();
    const minFreq = opciones.min_freq === undefined || opciones.min_freq === null ? MIN_FREQ : opciones.min_freq;
    const threshold = opciones.threshold === undefined || opciones.threshold === null ? UMBRAL_G2 : opciones.threshold;
    const limit = opciones.limit === undefined ? null : opciones.limit;
    const limitNegative = opciones.limit_negative === undefined || opciones.limit_negative === null ? LIMITE_NEGATIVOS : opciones.limit_negative;
    const ftsTable = opciones.fts_table || 'speeches_fts';
    if (minFreq < 1) throw new C.PyError('ValueError', 'min_freq debe ser al menos 1');
    const fts = ident(ftsTable);
    const vacias = opciones.stopwords === undefined || opciones.stopwords === null ? STOPWORDS : new Set(Array.from(opciones.stopwords, fold));
    // opciones.progreso(fase, hecho, total): avance de las fases «referencia» y «estadisticos» (léxico de una biblioteca).
    const progreso = typeof opciones.progreso === 'function' ? opciones.progreso : () => {};
    const textos = Array.from(texts);

    // opciones.cuentas: [Map término plegado → n, tokens] ya calculado (por trozos, cediendo el hilo) por el llamador.
    const [cuentas, c] = Array.isArray(opciones.cuentas) ? opciones.cuentas : countTerms(textos);
    const tipos = cuentas.size;
    const ms = () => redondeo((performance.now() - t0), 1);
    const salida = {
      version: KEYNESS_VERSION,
      n_texts: textos.length,
      metrics: { tokens: c, types: tipos, ttr: c ? redondeo(tipos / c, 4) : 0.0, g2_max: 0.0 },
      corpus_tokens: null, reference_tokens: null,
      min_freq: minFreq, threshold, p: P_UMBRAL,
      candidates: 0, significant: 0,
      excluded: { stopwords: 0, one_char: 0 },
      terms: [], negative: [],
      badges: INSIGNIAS,
      notes: {
        ttr: 'El TTR baja al crecer la colección: compare solo colecciones de tamaño parecido.',
        g2: 'G² de Dunning con signo frente al resto del corpus (corpus − colección): + sobreuso, − infrauso. '
          + '|G²| ≥ 10,83 equivale a p < 0,001 (χ², 1 g.l.). Al evaluar miles de términos a la vez, fíjese también en el log-ratio.',
        log_ratio: 'log2 del cociente de frecuencias relativas; cada punto duplica. Una frecuencia cero cuenta como 0,5 (Hardie 2014).',
        tokens: 'Tokens según el tokenizador del índice (unicode61): «S. S.» son dos tokens, por eso difiere del recuento de palabras.',
      },
    };

    let nCorpus, total;
    try {
      nCorpus = corpusTokens(bd, fts);
      salida.corpus_tokens = nCorpus;
      if (c === 0) {
        salida.reference_tokens = nCorpus;
        salida.ms = ms();
        return salida;
      }
      // Solo se consultan en el índice los términos que pueden entrar en la tabla (freq ≥ min_freq): los demás no se
      // puntúan y consultarlos duplicaba las lecturas del vocabulario FTS5 sin cambiar el resultado.
      progreso('referencia', 0, 1);
      total = referenceCounts(bd, Array.from(cuentas.keys()).filter((t) => cuentas.get(t) >= minFreq), fts,
        (h, t) => progreso('referencia', h, t));
    } catch (e) {
      if (!esErrorSqlite(e)) throw e;
      salida.error = `No se pudo leer el vocabulario del índice FTS5: ${S.errorSqlite(bd, e)}`;
      salida.ms = ms();
      return salida;
    }

    const d = nCorpus - c;
    salida.reference_tokens = d;
    const incoherentes = [];
    for (const [t, k] of cuentas) if (k >= minFreq && (total.get(t) || 0) < k) incoherentes.push(t);
    if (d <= 0 || incoherentes.length) {
      const ejemplos = incoherentes.slice().sort(C.cmpStr).slice(0, 5).join(', ');
      salida.error = 'La colección no es un subconjunto de este corpus: '
        + (incoherentes.length ? `${incoherentes.length} términos aparecen más veces en la colección que en todo el corpus (p. ej. ${ejemplos}). ` : '')
        + '¿Hay textos repetidos o de otro corpus?';
      salida.ms = ms();
      return salida;
    }

    const cand = [];
    for (const [t, k] of cuentas) if (k >= minFreq) cand.push(t);
    cand.sort(C.cmpStr);
    salida.candidates = cand.length;
    if (!cand.length) {
      salida.ms = ms();
      return salida;
    }

    progreso('estadisticos', 0, 1);
    const positivos = [], negativos = [];
    let nVacias = 0, nCortos = 0;
    for (const term of cand) {
      const fa = cuentas.get(term);
      const fb = total.get(term) - fa;
      const g2 = g2Signed(fa, fb, c, d);
      if (!(Math.abs(g2) >= threshold)) continue;
      if (vacias.has(term)) { nVacias += 1; continue; }
      if (Array.from(term).length === 1) { nCortos += 1; continue; }
      const lr = logRatio(fa, fb, c, d);
      const fila = {
        term,
        freq: fa,
        freq_ref: fb,
        pm: redondeo(fa / c * 1000, 4),
        pm_ref: redondeo(fb / d * 1000, 4),
        g2: redondeo(g2, 2),
        log_ratio: redondeo(lr, 2),
      };
      if (g2 > 0) {
        fila.badge = badge(lr, fb);
        positivos.push(fila);
      } else {
        fila.badge = null;
        negativos.push(fila);
      }
    }

    positivos.sort((x, y) => (y.g2 - x.g2) || C.cmpStr(x.term, y.term));
    negativos.sort((x, y) => (x.g2 - y.g2) || C.cmpStr(x.term, y.term));
    salida.significant = positivos.length + negativos.length;
    salida.excluded = { stopwords: nVacias, one_char: nCortos };
    salida.metrics.g2_max = positivos.length ? positivos[0].g2 : 0.0;
    salida.n_positive = positivos.length;
    salida.n_negative = negativos.length;
    salida.terms = limit ? positivos.slice(0, limit) : positivos;
    salida.negative = limitNegative ? negativos.slice(0, limitNegative) : [];
    progreso('estadisticos', 1, 1);
    salida.ms = ms();
    return salida;
  }

  // ------------------------------------------------------------------------------------------------ formas con tilde (search.py)
  const PALABRA_NO_ASCII = RE.compile('\\b[a-z0-9]*[^\\x00-\\x7f\\W_][^\\W_]*');

  /** search.accented_forms: Map término plegado → Map forma con tilde o eñe → apariciones. */
  function accentedForms(texts, terms) {
    const buscados = new Set();
    for (const t of terms) if (t) buscados.add(t);
    const formas = new Map();
    if (!buscados.size) return formas;
    for (const tx of texts) {
      if (!tx || ASCII.test(tx)) continue;
      for (const w of PALABRA_NO_ASCII.findall(C.lower(tx))) {
        const f = plegarToken(w);
        if (f !== w && buscados.has(f)) {
          let m = formas.get(f);
          if (!m) { m = new Map(); formas.set(f, m); }
          m.set(w, (m.get(w) || 0) + 1);
        }
      }
    }
    return formas;
  }

  R2.keyness = Object.freeze({
    KEYNESS_VERSION, MIN_FREQ, UMBRAL_G2, P_UMBRAL, LIMITE_NEGATIVOS, LOTE_SQL, CORTE_EXCLUSIVO, CORTE_MUY_DISTINTIVO,
    CORRECCION_CERO, INSIGNIAS, STOPWORDS, FORMAS_MAX_CHARS, DIACRITICOS_CP,
    keyness, fold, tokenize, crudos, crudos_tramos: crudosTramos, tokenize_tramos: tokenizeTramos, SIGNOS_CORTE, count_terms: countTerms, plegar_token: plegarToken, plegar_caracter: plegarCaracter,
    corpus_tokens: corpusTokens, reference_counts: referenceCounts, g2_signed: g2Signed, log_ratio: logRatio, badge,
    accented_forms: accentedForms, varints,
  });
})(globalThis.R2 = globalThis.R2 || {});

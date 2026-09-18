/* ===== src/engine/partition.js ===== */
/* 2REP_Standalone · engine/partition.js
 *
 * Léxico «solo discurso» y keyness de una colección: port de search.py (speech_partition, prose_summary,
 * Corpus._prose_texts, Corpus.keyness y la elección de la forma con tilde). El documento del Diario sale de
 * R2.diario.parse_speech(texto, speaker, rep_name) (engine/diario.js), que se busca al llamar, no al cargar.
 *
 * API (R2.partition)
 *   speech_partition(doc, texto) → [[categoría, a, b]]      partición contigua de [0, len) sin cortar tokens
 *   prose_summary(doc, texto) → [[[a, b], …], {categoría: tokens}]
 *   keynessColeccion(ctx, ids, {min_freq, limit, limit_negative, solo_discurso}) → dict como Corpus.keyness (promesa)
 *     (guarda los últimos resultados por biblioteca y opciones; `desde_cache` marca los que salen de ahí)
 *   prose_texts(ctx, filas) · prose_texts_rapida(ctx, filas) → [textos, excluidos]: el discurso que analiza el léxico
 *   CATEGORIAS_EXCLUIDAS, limpiarCache()
 */
(function (R2) {
  'use strict';

  const C = R2.py && R2.py.core;
  const H = R2.py && R2.py.heap;
  const K = R2.keyness;
  if (!C || !H || !K || !R2.sql) throw new Error('engine/partition.js necesita R2.py.core, R2.py.heap, R2.keyness y R2.sql (src/orden.json)');
  const S = R2.sql;

  const CATEGORIAS_EXCLUIDAS = Object.freeze(['listas', 'cronica', 'acotaciones', 'tablas', 'notas', 'cabeceras', 'etiquetas', 'otros']);
  const CAT_BLOQUE = Object.freeze({ par: 'discurso', turn: 'discurso', stage: 'acotaciones', chron: 'cronica', list: 'listas', table: 'tablas', note: 'notas', art: 'cabeceras' });
  const CAT_SEGMENTO = Object.freeze({ acot: 'acotaciones', note: 'notas' });
  const INLINE_ID_LIMIT = (R2.gen && R2.gen.constantes && R2.gen.constantes.search && R2.gen.constantes.search.INLINE_ID_LIMIT) || 900;
  const tiene = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const campo = (o, k) => (o instanceof Map ? o.get(k) : (tiene(o, k) ? o[k] : undefined));

  /** ¿Puede el carácter formar parte de un token de unicode61? ([^\W_] ≡ isalnum). */
  function enPalabra(ch) {
    if (C.isalnum(ch)) return true;
    const o = ch.codePointAt(0);
    return K.DIACRITICOS_CP.has(o) || (o >= 0xE000 && o <= 0xF8FF) || (o >= 0xF0000 && o <= 0x10FFFD);
  }

  function ajustaCorte(text, p) {
    const n = text.length;
    while (p > 0 && p < n && enPalabra(text[p]) && enPalabra(text[p - 1])) p += 1;
    return p;
  }

  function cmpTramo(x, y) {
    return (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]) || C.cmpStr(x[3], y[3]);
  }

  function speechPartition(doc, text) {
    const n = text.length;
    const tramos = [];   // [a, -prioridad, b, categoría]
    const add = (a, b, prio, cat) => {
      a = Math.max(0, a);
      b = Math.min(n, b);
      if (b > a) tramos.push([a, -prio, b, cat]);
    };
    for (const x of campo(doc, 'blocks') || []) {
      const t = campo(x, 't');
      const cat = tiene(CAT_BLOQUE, t) ? CAT_BLOQUE[t] : undefined;
      if (cat === undefined) continue;
      add(campo(x, 'a'), campo(x, 'b'), 1, cat);
      if (t === 'par' || t === 'turn') {
        for (const s of campo(x, 's') || []) {
          const k = campo(s, 'k');
          const c2 = tiene(CAT_SEGMENTO, k) ? CAT_SEGMENTO[k] : undefined;
          if (c2) add(campo(s, 'a'), campo(s, 'b'), 2, c2);
        }
        if (t === 'turn') {
          const who = campo(x, 'who');
          add(campo(who, 'a'), campo(who, 'b'), 2, 'etiquetas');
        }
      }
    }
    for (const f of campo(doc, 'fix') || []) {
      const [fa, fb, rep, tipo] = Array.isArray(f) ? f : [campo(f, 'a'), campo(f, 'b'), campo(f, 'rep'), campo(f, 'tipo')];
      if (tipo === 'header' || tipo === 'join') add(fa, fb, 3, 'cabeceras');
      else if (tipo === 'hyphen') add(fa, fb - (rep || '').length, 3, 'cabeceras');
      else if (tipo === 'lead_speaker') add(fa, fb, 3, 'etiquetas');
    }
    if (!tramos.length) return n ? [['otros', 0, n]] : [];

    tramos.sort(cmpTramo);
    const setCortes = new Set([0, n]);
    for (const t of tramos) { setCortes.add(t[0]); setCortes.add(t[2]); }
    const cortes = Array.from(setCortes).sort((x, y) => x - y);
    const vivos = [];
    let i = 0;
    const elem = [];
    for (let k = 0; k < cortes.length - 1; k++) {
      const p = cortes[k], q = cortes[k + 1];
      while (i < tramos.length && tramos[i][0] <= p) {
        const [a, nprio, b, cat] = tramos[i];
        H.heappush(vivos, [nprio, -a, b, cat]);
        i += 1;
      }
      while (vivos.length && vivos[0][2] <= p) H.heappop(vivos);
      const cat = vivos.length ? vivos[0][3] : 'otros';
      if (elem.length && elem[elem.length - 1][0] === cat) elem[elem.length - 1][2] = q;
      else elem.push([cat, p, q]);
    }

    const out = [];
    let inicio = 0;
    for (const [cat, , b] of elem) {
      const e = ajustaCorte(text, b);
      if (e <= inicio) continue;
      if (out.length && out[out.length - 1][0] === cat) out[out.length - 1] = [cat, out[out.length - 1][1], e];
      else out.push([cat, inicio, e]);
      inicio = e;
    }
    return out;
  }

  function proseSummary(doc, text) {
    const prosa = [];
    const excl = {};
    for (const [cat, a, b] of speechPartition(doc, text)) {
      if (cat === 'discurso') prosa.push([a, b]);
      else {
        const k = K.crudos(text.slice(a, b)).length;
        if (k) excl[cat] = (excl[cat] || 0) + k;
      }
    }
    return [prosa, excl];
  }

  // Partición ya calculada por id (un worker = un corpus) y versión del motor del Diario.
  const PROSE_CACHE = new Map();
  const PROSE_MAX = 150000, PROSE_MAX_TRAMOS = 3000000;
  let proseTramos = 0;

  function diario() {
    const D = R2.diario;
    if (!D || typeof D.parse_speech !== 'function') throw new Error('El Léxico «solo discurso» necesita R2.diario (engine/diario.js)');
    return D;
  }

  async function ceder(ctx) {
    if (ctx && typeof ctx.ceder === 'function') await ctx.ceder();
  }

  /** Corpus.speeches_bulk: una fila por id distinto, en el orden pedido; los que no existen se omiten. */
  function speechesBulk(bd, ids) {
    const orden = Array.from(new Set(ids.map((x) => Number(x))));
    const filas = new Map();
    for (let k = 0; k < orden.length; k += INLINE_ID_LIMIT) {
      const lote = orden.slice(k, k + INLINE_ID_LIMIT);
      for (const r of S.filas(bd, `SELECT id, speaker, rep_name, speech FROM speeches WHERE id IN (${lote.map(() => '?').join(',')})`, lote)) {
        filas.set(r.id, { id: r.id, speaker: r.speaker, rep_name: r.rep_name, speech: r.speech || '' });
      }
    }
    return orden.filter((i) => filas.has(i)).map((i) => filas.get(i));
  }

  /** Por encima de estos caracteres, la biblioteca usa la segmentación rápida en lugar del análisis completo del Diario. */
  const RAPIDA_DESDE_CHARS = 25 * 1000 * 1000;
  const RX_ACOTACION = /\([^()\n]{1,400}\)/g;
  const RX_MAYUSCULA = /[A-ZÁÉÍÓÚÑÃÕÇÀÈÌÒÙÂÊÔÜ]/g;
  const RX_MINUSCULA = /[a-záéíóúñãõçàèìòùâêôü]/g;
  const TEXTO_RAPIDA = 'Solo discurso (segmentación rápida): la biblioteca supera los 25 millones de caracteres, así que se excluyen '
    + 'solo las acotaciones entre paréntesis y las líneas en mayúsculas (listas de votación, cabeceras), sin el análisis '
    + 'completo del Diario que se aplica a bibliotecas menores. La referencia es el corpus menos ese discurso.';

  /**
   * Partición rápida de un texto: [[a, b] de prosa, {categoría: tokens excluidos}]. Excluye las acotaciones entre paréntesis
   * y las líneas en mayúsculas (≥ 8 letras mayúsculas y más del triple que minúsculas), que en los diarios son listas de
   * votación, cabeceras y rótulos. Cuesta una pequeña fracción de parse_speech.
   */
  function particionRapida(texto) {
    const n = texto.length;
    const excluir = []; // [a, b, categoría]
    let m;
    RX_ACOTACION.lastIndex = 0;
    while ((m = RX_ACOTACION.exec(texto)) !== null) excluir.push([m.index, m.index + m[0].length, 'acotaciones']);
    let ini = 0;
    while (ini < n) {
      let fin = texto.indexOf('\n', ini);
      if (fin < 0) fin = n;
      if (fin - ini >= 8) {
        const linea = texto.slice(ini, fin);
        const may = (linea.match(RX_MAYUSCULA) || []).length;
        if (may >= 8) {
          const min = (linea.match(RX_MINUSCULA) || []).length;
          if (may > 3 * min) excluir.push([ini, fin, 'listas']);
        }
      }
      ini = fin + 1;
    }
    if (!excluir.length) return [[[0, n]], {}];
    excluir.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const prosa = [];
    const excl = {};
    let pos = 0;
    for (const [a, b, cat] of excluir) {
      if (b <= pos) continue;
      const a2 = Math.max(a, pos);
      if (a2 > pos) prosa.push([pos, a2]);
      const k = K.crudos(texto.slice(a2, b)).length;
      if (k) excl[cat] = (excl[cat] || 0) + k;
      pos = b;
    }
    if (pos < n) prosa.push([pos, n]);
    return [prosa, excl];
  }

  /** Fases del léxico de una biblioteca y su peso en la barra de progreso (medidas con la biblioteca de Brasil de 85.318). */
  const FASES_LEXICO = Object.freeze([
    { id: 'lectura', etiqueta: 'Leyendo las intervenciones', peso: 0.14 },
    { id: 'segmentacion', etiqueta: 'Separando el discurso del resto del acta', peso: 0.08 },
    { id: 'recuento', etiqueta: 'Contando las palabras', peso: 0.48 },
    { id: 'referencia', etiqueta: 'Consultando el vocabulario del corpus', peso: 0.22 },
    { id: 'estadisticos', etiqueta: 'Calculando G² y log-ratio', peso: 0.05 },
    { id: 'formas', etiqueta: 'Eligiendo las formas con tilde', peso: 0.03 },
  ]);
  const MS_ENTRE_AVISOS = 120;

  /** Emisor de progreso hacia ctx.progreso (principal.js → progreso_op): fase, hecho/total y fracción global 0–1. */
  function crearProgreso(ctx, conSegmentacion, nTextos) {
    const fn = ctx && typeof ctx.progreso === 'function' ? ctx.progreso : null;
    const fases = FASES_LEXICO.filter((f) => conSegmentacion || f.id !== 'segmentacion');
    const sumaPesos = fases.reduce((s, f) => s + f.peso, 0);
    const t0 = performance.now();
    let ultimo = 0;
    return {
      emitir(id, hecho, total, forzar = false) {
        if (!fn) return;
        const ya = performance.now();
        if (!forzar && ya - ultimo < MS_ENTRE_AVISOS) return;
        ultimo = ya;
        const i = fases.findIndex((f) => f.id === id);
        if (i < 0) return;
        let acumulado = 0;
        for (let k = 0; k < i; k++) acumulado += fases[k].peso;
        const parte = total ? Math.max(0, Math.min(1, hecho / total)) : 0;
        try {
          fn({ fase: id, etiqueta: fases[i].etiqueta, indice: i + 1, n_fases: fases.length, hecho, total,
            fraccion: (acumulado + fases[i].peso * parte) / sumaPesos, ms: Math.round(ya - t0), n_textos: nTextos });
        } catch (e) { /* el progreso nunca interrumpe el cálculo */ }
      },
    };
  }

  /** Textos (o tramos de prosa) de las filas con la partición rápida, cediendo el hilo cada 500. */
  async function proseTextsRapida(ctx, filas, alProgreso = null) {
    const textos = [];
    const excl = {};
    for (const c of CATEGORIAS_EXCLUIDAS) excl[c] = 0;
    for (let k = 0; k < filas.length; k++) {
      const texto = filas[k].speech || '';
      const [tramos, cuentas] = particionRapida(texto);
      if (tramos.length === 1 && tramos[0][0] === 0 && tramos[0][1] === texto.length) textos.push(texto);
      else textos.push(tramos.map(([a, b]) => texto.slice(a, b)).join('\n'));
      for (const [cat, v] of Object.entries(cuentas)) excl[cat] = (excl[cat] || 0) + v;
      if (k % 500 === 499) { if (alProgreso) alProgreso(k + 1, filas.length); await ceder(ctx); }
    }
    return [textos, excl];
  }

  /** count_terms por trozos, cediendo el hilo: [Map término plegado → n, tokens]. */
  async function contarPorTrozos(ctx, textos, alProgreso = null) {
    const brutos = new Map();
    let n = 0;
    for (let k = 0; k < textos.length; k++) {
      const toks = K.crudos(textos[k]);
      n += toks.length;
      for (const w of toks) brutos.set(w, (brutos.get(w) || 0) + 1);
      if (k % 300 === 299) { if (alProgreso) alProgreso(k + 1, textos.length); await ceder(ctx); }
    }
    const plegados = new Map();
    let i = 0;
    for (const [w, k] of brutos) {
      const f = /^[\x00-\x7f]*$/.test(w) ? w : K.plegar_token(w);
      plegados.set(f, (plegados.get(f) || 0) + k);
      if (++i % 50000 === 0) await ceder(ctx);
    }
    return [plegados, n];
  }

  /** Filas {id, speaker, rep_name, speech} de los ids (ordenados por id): lectura masiva de bloques si existe R2.texto. */
  async function leerFilas(ctx, bd, pedidos, alProgreso = null) {
    if (R2.texto && typeof R2.texto.leerTextos === 'function') {
      const mapa = await R2.texto.leerTextos(bd.db, pedidos, { ceder: () => ceder(ctx), alProgreso });
      return pedidos.filter((i) => mapa.has(i)).map((i) => mapa.get(i));
    }
    const filas = [];
    for (let k = 0; k < pedidos.length; k += 500) {
      for (const f of speechesBulk(bd, pedidos.slice(k, k + 500))) filas.push(f);
      if (alProgreso) alProgreso(Math.min(pedidos.length, k + 500), pedidos.length);
      await ceder(ctx);
    }
    return filas;
  }

  async function proseTexts(ctx, filas, alProgreso = null) {
    const D = diario();
    const version = D.ENGINE_VERSION === undefined ? '' : String(D.ENGINE_VERSION);
    const textos = [];
    const excl = {};
    for (const c of CATEGORIAS_EXCLUIDAS) excl[c] = 0;
    for (let k = 0; k < filas.length; k++) {
      const r = filas[k];
      const clave = `${version} ${r.id}`;
      const texto = r.speech || '';
      let hit = PROSE_CACHE.get(clave);
      if (hit === undefined) {
        const doc = D.parse_speech(texto, r.speaker, r.rep_name);
        hit = proseSummary(doc, texto);
        if (PROSE_CACHE.size >= PROSE_MAX || proseTramos > PROSE_MAX_TRAMOS) { PROSE_CACHE.clear(); proseTramos = 0; }
        PROSE_CACHE.set(clave, hit);
        proseTramos += hit[0].length + 1;
      }
      const [tramos, cuentas] = hit;
      if (tramos.length === 1 && tramos[0][0] === 0 && tramos[0][1] === texto.length) textos.push(texto);
      else textos.push(tramos.map(([a, b]) => texto.slice(a, b)).join('\n'));
      for (const [cat, v] of Object.entries(cuentas)) excl[cat] = (excl[cat] || 0) + v;
      if (k % 200 === 199) { if (alProgreso) alProgreso(k + 1, filas.length); await ceder(ctx); }
    }
    return [textos, excl];
  }

  // Caché del léxico por corpus (WeakMap por conexión): las coocurrencias parten del vocabulario del léxico y, si el
  // usuario ya abrió el léxico de la misma biblioteca con las mismas opciones, no hace falta volver a calcularlo.
  // La clave incluye una huella de los ids, así que añadir o quitar intervenciones de la biblioteca la invalida.
  const CACHE_LEXICO = new WeakMap();
  const CACHE_LEXICO_MAX = 4;
  function huellaIds(pedidos) {
    let h = 0x811c9dc5;
    for (const i of pedidos) { h ^= i & 0xffff; h = Math.imul(h, 0x01000193); h ^= i >>> 16; h = Math.imul(h, 0x01000193); }
    return `${pedidos.length}:${(h >>> 0).toString(16)}`;
  }

  /** Añade al resultado del léxico las expresiones con G² significativo, con las mismas columnas que las palabras. */
  function anadirExpresiones(res, ix, textos, opciones) {
    const cuentas = R2.expresiones.contar(ix, textos);
    const c = Number((res.metrics || {}).tokens || 0), d = Number(res.reference_tokens || 0);
    const minFreq = opciones.min_freq === undefined ? K.MIN_FREQ : opciones.min_freq;
    const umbral = res.threshold === undefined ? K.UMBRAL_G2 : res.threshold;
    const redondeo = (x, n) => Math.round(x * 10 ** n) / 10 ** n;
    const pos = [], neg = [];
    if (c > 0 && d > 0) {
      for (const [i, fa] of cuentas) {
        if (fa < minFreq) continue;
        const fb = Math.max(0, ix.frec[i] - fa);
        const g2 = K.g2_signed(fa, fb, c, d);
        if (!(Math.abs(g2) >= umbral)) continue;
        const lr = K.log_ratio(fa, fb, c, d);
        const fila = { term: ix.formas[i], display: ix.mostrar[i], freq: fa, freq_ref: fb, pm: redondeo(fa / c * 1000, 4),
          pm_ref: redondeo(fb / d * 1000, 4), g2: redondeo(g2, 2), log_ratio: redondeo(lr, 2), expresion: true };
        if (g2 > 0) { fila.badge = K.badge(lr, fb); pos.push(fila); } else { fila.badge = null; neg.push(fila); }
      }
    }
    const orden = (x, y) => (y.g2 - x.g2) || C.cmpStr(x.term, y.term);
    const limit = opciones.limit === undefined ? null : opciones.limit;
    const limitNeg = opciones.limit_negative === undefined ? K.LIMITE_NEGATIVOS : opciones.limit_negative;
    res.terms = (res.terms || []).concat(pos).sort(orden);
    if (limit) res.terms = res.terms.slice(0, limit);
    res.negative = (res.negative || []).concat(neg).sort((x, y) => (x.g2 - y.g2) || C.cmpStr(x.term, y.term));
    if (limitNeg) res.negative = res.negative.slice(0, limitNeg);
    res.n_positive = Number(res.n_positive || 0) + pos.length;
    res.n_negative = Number(res.n_negative || 0) + neg.length;
    res.significant = Number(res.significant || 0) + pos.length + neg.length;
    if (res.metrics && res.terms.length) res.metrics.g2_max = Math.max(Number(res.metrics.g2_max || 0), res.terms[0].g2);
    res.expresiones = { inventario: ix.n, en_biblioteca: cuentas.size, significativas: pos.length + neg.length,
      de_sobreuso: pos.length, deteccion: ix.meta };
  }

  /** Corpus.keyness, con caché de los últimos resultados por biblioteca y opciones. */
  async function keynessColeccion(ctx, ids, opciones = {}) {
    const pedidos = Array.from(new Set(Array.from(ids, (i) => Number(i)))).sort((a, b) => a - b);
    const clave = [huellaIds(pedidos), opciones.solo_discurso === undefined ? true : !!opciones.solo_discurso,
      opciones.min_freq, opciones.limit, opciones.limit_negative, opciones.expresiones !== false].join('|');
    let mapa = ctx && ctx.db ? CACHE_LEXICO.get(ctx.db) : null;
    if (ctx && ctx.db && !mapa) { mapa = new Map(); CACHE_LEXICO.set(ctx.db, mapa); }
    if (mapa && mapa.has(clave)) {
      const hit = mapa.get(clave);
      mapa.delete(clave); mapa.set(clave, hit);               // el más reciente, al final
      return Object.assign({}, hit, { desde_cache: true });
    }
    const res = await keynessColeccionCalcular(ctx, pedidos, opciones);
    if (mapa) {
      mapa.set(clave, res);
      while (mapa.size > CACHE_LEXICO_MAX) mapa.delete(mapa.keys().next().value);
    }
    return Object.assign({}, res);
  }

  async function keynessColeccionCalcular(ctx, ids, opciones = {}) {
    const bd = { db: ctx.db, sqlite3: ctx.sqlite3 };
    const soloDiscurso = opciones.solo_discurso === undefined ? true : !!opciones.solo_discurso;
    // Los ids se leen en orden ascendente: el texto vive en bloques comprimidos (worker/texto.js) y leerlos en orden
    // descomprime cada bloque una sola vez en lugar de una por intervención. El orden no afecta al resultado.
    const pedidos = Array.from(new Set(Array.from(ids, (i) => Number(i)))).sort((a, b) => a - b);
    const prog = crearProgreso(ctx, soloDiscurso, pedidos.length);
    prog.emitir('lectura', 0, pedidos.length, true);
    const tLectura = performance.now();
    const filas = await leerFilas(ctx, bd, pedidos, (h, t) => prog.emitir('lectura', h, t));
    const msLectura = performance.now() - tLectura;
    const totalCaracteres = filas.reduce((s, r) => s + (r.speech ? r.speech.length : 0), 0);
    const rapida = soloDiscurso && totalCaracteres > RAPIDA_DESDE_CHARS;
    const t0 = performance.now();
    let textos, excluidos;
    if (soloDiscurso) {
      prog.emitir('segmentacion', 0, filas.length, true);
      const alSegmentar = (h, t) => prog.emitir('segmentacion', h, t);
      [textos, excluidos] = rapida ? await proseTextsRapida(ctx, filas, alSegmentar) : await proseTexts(ctx, filas, alSegmentar);
    } else {
      textos = filas.map((r) => r.speech);
      excluidos = {};
      for (const c of CATEGORIAS_EXCLUIDAS) excluidos[c] = 0;
    }
    const msTexto = performance.now() - t0;
    prog.emitir('recuento', 0, textos.length, true);
    const tCuentas = performance.now();
    const cuentas = await contarPorTrozos(ctx, textos, (h, t) => prog.emitir('recuento', h, t));
    const msCuentas = performance.now() - tCuentas;
    prog.emitir('referencia', 0, 1, true);
    const res = K.keyness(bd, textos, {
      min_freq: opciones.min_freq === undefined ? K.MIN_FREQ : opciones.min_freq,
      limit: opciones.limit === undefined ? null : opciones.limit,
      limit_negative: opciones.limit_negative === undefined ? K.LIMITE_NEGATIVOS : opciones.limit_negative,
      cuentas,
      progreso: (fase, h, t) => prog.emitir(fase, h, t, h === 0 || h === t),
    });
    // Expresiones de varias palabras (R2.expresiones, detectadas al construir la base): se cuentan en el mismo texto y
    // se miden igual que las palabras. La referencia es su frecuencia en el corpus menos la de la biblioteca.
    if (!res.error && opciones.expresiones !== false && R2.expresiones) {
      const ix = R2.expresiones.cargar(bd);
      if (ix) anadirExpresiones(res, ix, textos, opciones);
    }
    prog.emitir('formas', 0, 1, true);
    res.n_requested = pedidos.length;
    res.n_found = filas.length;
    const analizados = Number((res.metrics || {}).tokens || 0);
    const nExcl = Object.values(excluidos).reduce((x, y) => x + y, 0);
    res.modo_texto = soloDiscurso ? (rapida ? 'discurso_rapido' : 'discurso') : 'completo';
    res.solo_discurso = soloDiscurso;
    res.texto = {
      tokens_brutos: analizados + nExcl, tokens_analizados: analizados, tokens_excluidos: nExcl, excluidos,
      segmentacion: soloDiscurso ? (rapida ? 'rapida' : 'diario') : 'ninguna',
      caracteres: totalCaracteres,
      ms_lectura: C.pyRound(msLectura, 1), ms_segmentacion: C.pyRound(msTexto, 1), ms_recuento: C.pyRound(msCuentas, 1),
    };
    const notas = res.notes || (res.notes = {});
    notas.modo_texto = soloDiscurso
      ? (rapida ? TEXTO_RAPIDA
        : 'Solo discurso: se analiza la prosa de los oradores y se excluyen listas de votación, crónica del acta, acotaciones, '
        + 'tablas, notas y cabeceras de página. La referencia es el corpus menos ese discurso.')
      : 'Texto completo: cada intervención entera, con listas, crónica, acotaciones y tablas.';
    res.ms = C.pyRound(Number(res.ms || 0) + msTexto + msLectura + msCuentas, 1);

    // Forma que se muestra: la escrita con tilde o eñe si es la mayoritaria (muestra uniforme en bibliotecas grandes).
    // Las expresiones traen ya la suya, guardada al detectarlas.
    const filasTabla = [...(res.terms || []), ...(res.negative || [])].filter((t) => !t.expresion);
    const totalChars = textos.reduce((x, t) => x + t.length, 0);
    const paso = Math.max(1, Math.ceil(totalChars / K.FORMAS_MAX_CHARS));
    const muestra = textos.filter((_, i) => i % paso === 0);
    const escala = totalChars / Math.max(1, muestra.reduce((x, t) => x + t.length, 0));
    const formas = K.accented_forms(muestra, filasTabla.map((t) => t.term));
    for (const t of filasTabla) {
      const cands = formas.get(t.term);
      let disp = t.term;
      if (cands) {
        let forma = null, n = -1;
        for (const [w, k] of cands) if (k > n || (k === n && C.cmpStr(w, forma) > 0)) { forma = w; n = k; }
        if (n * escala * 2 > Math.trunc(Number(t.freq || 0))) disp = forma;
      }
      t.display = disp;
    }
    res.display_sampled = paso > 1;
    prog.emitir('formas', 1, 1, true);
    return res;
  }

  R2.partition = Object.freeze({
    CATEGORIAS_EXCLUIDAS, CAT_BLOQUE, CAT_SEGMENTO,
    speech_partition: speechPartition, prose_summary: proseSummary, speeches_bulk: speechesBulk,
    particion_rapida: particionRapida, RAPIDA_DESDE_CHARS, FASES_LEXICO, leerFilas, contarPorTrozos,
    keynessColeccion, en_palabra: enPalabra, ajusta_corte: ajustaCorte,
    prose_texts: proseTexts, prose_texts_rapida: proseTextsRapida, crear_progreso: crearProgreso,
    limpiarCache() { PROSE_CACHE.clear(); proseTramos = 0; },
  });
})(globalThis.R2 = globalThis.R2 || {});

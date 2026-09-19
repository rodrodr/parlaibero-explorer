/* ===== src/engine/expresiones.js ===== */
/* Diarios Explorer · engine/expresiones.js
 *
 * Expresiones de varias palabras del corpus («seguridad pública», «régimen de excepción», «Fuerzas y Cuerpos de
 * Seguridad»). Se detectan una sola vez, al construir la base, con la estadística del corpus entero: decidir si una
 * secuencia es una unidad exige muchas apariciones, y una biblioteca pequeña no las tiene. Cada biblioteca las
 * reconoce luego en su texto y mide su carácter distintivo en el léxico igual que el de las palabras.
 *
 * Candidatas: secuencias de 2 a 7 tokens que empiezan y terminan en palabra de contenido (≥ 3 letras, no vacía según
 * Snowball de la lengua del corpus, no cifra) y llevan dentro solo palabras de contenido o conectores de una lista
 * cerrada («de», «y», «del», «para»…). No hace falta etiquetador gramatical. No cruzan:
 *   - la puntuación, los saltos de línea ni los huecos de 6 o más espacios (keyness.crudos_tramos): «Gracias, señor
 *     presidente. Buenas tardes» no es una expresión, y en las listas de asistencia y de votación, tablas con el
 *     nombre y el estado separados por espacios, ni se encadenan las filas ni se une el nombre con «presente»;
 *   - las cifras, con dígitos o con letras: en las transcripciones las fechas, los artículos, los tomos y los recuentos
 *     de votos se leen en voz alta («dos mil veintidós», «romano seis», «cero abstenciones»); en El Salvador eran el
 *     7,5 % de las expresiones y ninguna un concepto.
 *
 * Se recorren las intervenciones marcadas como discurso (dm_speech = 1). Las filas sin orador (crónica, votaciones, actas
 * en tercera persona, cuentas de la sesión) llenarían el inventario de fórmulas y de filas de tablas: probado, en Argentina
 * aparecían «aca aca aca» o «buenos aires afirmativo» entre las más frecuentes. La muestra y el umbral se calculan con el
 * tamaño de ese texto (suma de nwords), no con el del corpus entero: la versión 1 usaba el del corpus y en la República
 * Dominicana, con el 81 % del texto en filas sin orador, muestreaba 1 de cada 4 intervenciones de un discurso que no llega
 * a 15 millones de palabras y perdía muchas expresiones. La referencia del G² sigue siendo el índice entero (frecuencias
 * de fts5vocab y su total), que conserva las proporciones.
 *
 * Recuento en dos pasadas, con memoria acotada (medido en Brasil: 48 MB frente a 2,3 GB del recuento exacto directo):
 *   1. Una muestra fija de 1 de cada M intervenciones. Un filtro de Bloom recuerda las candidatas vistas una vez; la
 *      tabla solo guarda las que se repiten.
 *   2. Recuento exacto, en todo el corpus, de las candidatas vistas al menos dos veces en la muestra, con cuántas
 *      intervenciones las contienen y qué palabra las rodea. Recupera el 99 % de las expresiones de 50 o más
 *      apariciones y todas las de 100 (medido en Brasil).
 *   En corpus de menos de 30 millones de tokens no hay muestra (M = 1) y basta una pasada: el Bloom hace que la tabla
 *   cuente cada candidata desde su segunda aparición sumando la primera, y el número de intervenciones puede quedarse
 *   corto en una, la de la primera aparición si fue en otra intervención.
 * Selección:
 *   - frecuencia ≥ F, con F = máx(20, 0,25 por millón de tokens del corpus), y presentes en al menos 3 intervenciones;
 *   - no ser un trozo de una secuencia más larga: si casi siempre (≥ 80-90 %) la precede o la sigue la misma palabra
 *     de contenido (a través de conectores), la unidad es la secuencia larga, no el trozo. Así caen las ventanas de
 *     las fórmulas leídas una y otra vez («consejo aprobó por unanimidad proponer») y «corte suprema» sin «de
 *     justicia». La palabra mayoritaria de cada lado se estima en la misma pasada con el voto de Boyer y Moore
 *     (1991): un contador por lado, que al final es ≥ (2p − 1)·f si esa palabra está en una proporción p de las f
 *     apariciones y ≤ p·f; se descarta con contador ≥ 0,8·f;
 *   - asociación positiva y significativa (G² ≥ 10,83) entre la parte izquierda y la última palabra: descarta
 *     secuencias de palabras muy frecuentes que coinciden por azar;
 *   - frecuencia independiente ≥ F: la frecuencia menos la de su contenedor más frecuente, para no guardar fragmentos
 *     que casi nunca aparecen solos («unidos de américa» dentro de «estados unidos de américa»). Se calcula también el
 *     C-value (Frantzi, Ananiadou y Mima, 2000), que se guarda como estadístico pero no decide: descuenta la frecuencia
 *     MEDIA de los contenedores, y cuando uno domina y hay una cola de contenedores raros (como aquí) deja pasar el
 *     fragmento.
 * Se guardan en la tabla `expresiones` de la base, con la forma plegada, la forma con tildes y sus recuentos.
 *
 * Reconocimiento en una biblioteca: cada tramo se parte en el menor número de unidades (expresiones o palabras) y, a
 * igualdad, en las más largas; el léxico cuenta en cambio todas las apariciones, también dentro de otras.
 * Huellas de 64 bits: cada token se resume una vez por tramo y las secuencias encadenan esos resúmenes (MurmurHash3).
 * Tablas hash con los campos de cada hueco juntos y etiquetas de un byte; Bloom por bloques de una línea de caché.
 *
 * API (R2.expresiones)
 *   detectar({ db, sqlite3, pais, alProgreso(hecho, total), ceder, depurar(candidata) }) → resumen (promesa); crea y
 *   llena la tabla · cargar(bd) → índice en memoria (null si la base no tiene expresiones)
 *   unidades(ix, tokens de un tramo[, out]) · unidadesTexto(ix, texto) → tokens con las expresiones unidas (para la red
 *   de coocurrencias: cada expresión, un solo nodo)
 *   contar(ix, textos) → Map índice → apariciones, todas, también dentro de otras (para el léxico)
 *   huellaTokens(tokens) → [a, b] · recorrer(tokens, tipo, f(a, b, i, j)) · tipoDe(pais) → w ↦ 0 corta, 1 conector,
 *   2 contenido · lenguaDe(pais) · vaciasDe(pais) · conectoresDe(pais) · contenidoDe(pais) · numeralesDe(pais)
 *   fuenteVacias(pais) · CONECTORES · MAX_TOKENS
 *   Revisión: listar(bd, {q, orden, limite, desde, solo}) · rechazadas(bd) → Set · fijarRechazadas(bd, formas) ·
 *   revision(bd) → n.º de cambios (clave de las cachés que dependen de las expresiones)
 *   Precalculadas: paquete(bd) → { version, meta, columnas, filas } · cargarPaquete({ db, sqlite3, paquete, origen,
 *   csvSha256 }) → resumen (lanza si el paquete no es de esta VERSION)
 */
(function (R2) {
  'use strict';

  const K = () => R2.keyness;                         // se carga antes; se busca al llamar
  const VERSION = 2;                                  // cambia cuando cambia lo que se detecta (y deja sin valor lo precalculado)
  const MAX_TOKENS = 7;
  const UMBRAL_G2 = 10.83;
  const MIN_INTERVENCIONES = 3;
  const VECINO_DOMINANTE = 0.8;
  const TOKENS_SIN_MUESTRA = 30e6;
  const TOKENS_POR_MUESTRA = 20e6;
  const PORTUGUES = new Set(['BR', 'PT']);
  const CONECTORES = Object.freeze({
    es: ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'para', 'a', 'al', 'con', 'por', 'sobre', 'contra', 'sin', 'entre'],
    pt: ['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'para', 'a', 'ao', 'aos', 'as', 'os', 'o', 'com',
      'por', 'pelo', 'pela', 'pelos', 'pelas', 'sobre', 'contra', 'sem', 'entre'],
  });
  // Numerales cardinales escritos con letras: cortan las candidatas igual que los dígitos (ver la cabecera).
  const NUMERALES = Object.freeze({
    es: ('cero uno una dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete '
      + 'dieciocho diecinueve veinte veintiuno veintiuna veintidos veintitres veinticuatro veinticinco veintiseis veintisiete '
      + 'veintiocho veintinueve treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ciento cientos doscientos '
      + 'doscientas trescientos trescientas cuatrocientos cuatrocientas quinientos quinientas seiscientos seiscientas setecientos '
      + 'setecientas ochocientos ochocientas novecientos novecientas mil millon millones billon billones').split(' '),
    pt: ('zero um uma dois duas tres quatro cinco seis sete oito nove dez onze doze treze quatorze catorze quinze dezesseis '
      + 'dezasseis dezessete dezassete dezoito dezenove dezanove vinte trinta quarenta cinquenta sessenta setenta oitenta noventa '
      + 'cem cento duzentos duzentas trezentos trezentas quatrocentos quatrocentas quinhentos quinhentas seiscentos seiscentas '
      + 'setecentos setecentas oitocentos oitocentas novecentos novecentas mil milhao milhoes bilhao bilhoes trilhao trilhoes').split(' '),
  });
  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const ceder = async (c) => { if (c && typeof c.ceder === 'function') await c.ceder(); };

  // ------------------------------------------------------------------------------------------------ lengua y vacías
  const lenguaDe = (pais) => (PORTUGUES.has(String(pais || '').toUpperCase()) ? 'pt' : 'es');
  const cacheVacias = new Map(), cacheConect = new Map();
  function vaciasDe(pais) {
    const lengua = lenguaDe(pais);
    if (!cacheVacias.has(lengua)) {
      const reg = R2.datos && R2.datos.vacias_lengua;
      const ent = reg && reg.lenguas && reg.lenguas[lengua] ? reg.lenguas[lengua] : null;
      const lista = ent ? ent.palabras : [];
      // Excepciones: palabras de la lista que en este dominio son sustantivos centrales («estado», «estados»).
      const excepciones = new Set((ent && ent.excepciones ? ent.excepciones : []).map((w) => K().fold(w)));
      cacheVacias.set(lengua, new Set(lista.map((w) => K().fold(w)).filter((w) => !excepciones.has(w))));
    }
    return cacheVacias.get(lengua);
  }
  function conectoresDe(pais) {
    const lengua = lenguaDe(pais);
    if (!cacheConect.has(lengua)) cacheConect.set(lengua, new Set(CONECTORES[lengua].map((w) => K().fold(w))));
    return cacheConect.get(lengua);
  }
  /** Palabra de contenido de la lengua: ≥ 3 letras, no vacía, no cifra (con dígitos o numeral escrito). La misma al
   *  detectar y al reconocer: si difirieran, una biblioteca no encontraría expresiones que la base sí tiene. */
  const cacheNumerales = new Map();
  /** Numerales cardinales escritos con letras de la lengua del país, plegados (Set). */
  function numeralesDe(pais) {
    const lengua = lenguaDe(pais);
    if (!cacheNumerales.has(lengua)) cacheNumerales.set(lengua, new Set(NUMERALES[lengua]));
    return cacheNumerales.get(lengua);
  }
  const cacheContenido = new Map();
  function contenidoDe(pais) {
    const lengua = lenguaDe(pais);
    if (!cacheContenido.has(lengua)) {
      const vacias = vaciasDe(pais), numerales = numeralesDe(pais);
      cacheContenido.set(lengua, (w) => w.length >= 3 && !vacias.has(w) && !numerales.has(w) && !(w.charCodeAt(0) < 58 && /^[0-9]+$/.test(w)));
    }
    return cacheContenido.get(lengua);
  }
  function fuenteVacias(pais) {
    const reg = R2.datos && R2.datos.vacias_lengua;
    const lengua = lenguaDe(pais);
    if (!reg || !reg.lenguas || !reg.lenguas[lengua]) return { lengua, fuente: null, n: 0 };
    return { lengua, fuente: reg.fuente, web: reg.web, licencia: reg.licencia, url: reg.lenguas[lengua].url,
      n: reg.lenguas[lengua].n, excepciones: reg.lenguas[lengua].excepciones || [], consultado: reg.consultado };
  }

  // ------------------------------------------------------------------------------------------------ tramos y huellas
  // Tipo de cada token: 0 corta la candidata (vacía que no es conector, cifra, palabra de menos de 3 letras), 1 conector,
  // 2 palabra de contenido.
  const cacheTipo = new Map();
  function tipoDe(pais) {
    const lengua = lenguaDe(pais);
    if (!cacheTipo.has(lengua)) {
      const cont = contenidoDe(pais), con = conectoresDe(pais);
      cacheTipo.set(lengua, (w) => (cont(w) ? 2 : con.has(w) ? 1 : 0));
    }
    return cacheTipo.get(lengua);
  }

  // Huella de 64 bits de una secuencia de tokens plegados, en dos mitades de 32: cada token se resume una vez con dos
  // funciones distintas (FNV-1a y una mezcla tipo Murmur sobre sus caracteres) y las secuencias encadenan esos resúmenes
  // con el paso de bloque de MurmurHash3 y su mezcla final. huellaTokens (desde la forma guardada) y recorrer (sobre el
  // texto) hacen la misma aritmética.
  const mezclar = (h, k) => {
    k = Math.imul(k, 0xcc9e2d51); k = (k << 15) | (k >>> 17); k = Math.imul(k, 0x1b873593);
    h ^= k; h = (h << 13) | (h >>> 19);
    return (Math.imul(h, 5) + 0xe6546b64) | 0;
  };
  const acabar = (h) => {
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    return h ^ (h >>> 16);
  };
  const SEMILLA_A = 0x3c6ef372, SEMILLA_B = 0x6a09e667, SEMILLA_IZQ = 0x1b873593, SEMILLA_DER = 0x2545f491;
  function resumenToken(w, par) {
    let h1 = 0x811c9dc5, h2 = 0x9747b28c;
    for (let c = 0; c < w.length; c++) {
      const x = w.charCodeAt(c);
      h1 = Math.imul(h1 ^ x, 0x01000193); h2 = Math.imul(h2 ^ x, 0x5bd1e995); h2 ^= h2 >>> 15;
    }
    par[0] = h1; par[1] = h2;
  }
  function huellaTokens(toks) {
    const par = [0, 0];
    let a = SEMILLA_A, b = SEMILLA_B;
    for (const w of toks) { resumenToken(w, par); a = mezclar(a, par[0]); b = mezclar(b, par[1]); }
    return [(acabar(a) | 1) >>> 0, acabar(b) >>> 0];
  }

  /**
   * Estado del tramo en curso (arrays reutilizados): tipo y resumen de cada token y, si se piden, sus vecinos: izq[i] es
   * la huella de la extensión por la izquierda de una candidata que empieza en i (la palabra de contenido más cercana
   * y los conectores, hasta 3, que la separan de i), der[j] la de la extensión por la derecha de una que acaba en j;
   * 0 si no la hay (puntuación, principio o fin del tramo, o una vacía que no es conector).
   */
  const T = { n: 0, tipo: new Uint8Array(256), x1: new Int32Array(256), x2: new Int32Array(256), izq: new Uint32Array(256), der: new Uint32Array(256) };
  const parT = [0, 0];
  function preparar(tk, tipo, vecinos = false) {
    const n = tk.length;
    if (T.tipo.length < n) {
      let m = T.tipo.length;
      while (m < n) m *= 2;
      T.tipo = new Uint8Array(m); T.x1 = new Int32Array(m); T.x2 = new Int32Array(m); T.izq = new Uint32Array(m); T.der = new Uint32Array(m);
    }
    const ti = T.tipo, x1 = T.x1, x2 = T.x2;
    for (let i = 0; i < n; i++) {
      const t = tipo(tk[i]);
      ti[i] = t;
      if (t !== 0) { resumenToken(tk[i], parT); x1[i] = parT[0]; x2[i] = parT[1]; }
    }
    T.n = n;
    if (!vecinos) return;
    const izq = T.izq, der = T.der;
    for (let i = 0; i < n; i++) {
      let k = i - 1;
      while (k >= 0 && ti[k] === 1 && i - k <= 3) k--;
      if (k >= 0 && ti[k] === 2) {
        let h = SEMILLA_IZQ;
        for (let q = k; q < i; q++) h = mezclar(h, x1[q]);
        izq[i] = (acabar(h) | 1) >>> 0;
      } else izq[i] = 0;
      k = i + 1;
      while (k < n && ti[k] === 1 && k - i <= 3) k++;
      if (k < n && ti[k] === 2) {
        let h = SEMILLA_DER;
        for (let q = i + 1; q <= k; q++) h = mezclar(h, x1[q]);
        der[i] = (acabar(h) | 1) >>> 0;
      } else der[i] = 0;
    }
  }
  /** f(a, b, i, j) por cada candidata [i, j] del tramo preparado que empieza en desde ≤ i < hasta. */
  function recorrerPreparado(f, desde = 0, hasta = T.n) {
    const ti = T.tipo, x1 = T.x1, x2 = T.x2, n = T.n;
    for (let i = desde; i < hasta; i++) {
      if (ti[i] !== 2) continue;
      let a = mezclar(SEMILLA_A, x1[i]), b = mezclar(SEMILLA_B, x2[i]);
      const fin = Math.min(n, i + MAX_TOKENS);
      for (let j = i + 1; j < fin; j++) {
        const t = ti[j];
        if (t === 0) break;
        a = mezclar(a, x1[j]); b = mezclar(b, x2[j]);
        if (t === 2) f((acabar(a) | 1) >>> 0, acabar(b) >>> 0, i, j);
      }
    }
  }
  /**
   * Recorre las candidatas de una secuencia de tokens plegados sin puntuación dentro: f(a, b, i, j) por cada tramo
   * [i, j] que empieza y termina en contenido, con conectores dentro. tipo: el de tipoDe(pais).
   */
  function recorrer(tk, tipo, f, desde = 0, hasta = tk.length) {
    preparar(tk, tipo);
    recorrerPreparado(f, desde, hasta);
  }

  // ------------------------------------------------------------------------------------------------ estructuras
  /**
   * Tabla hash de direccionamiento abierto con claves de 64 bits (a ≠ 0). Los campos de cada hueco van seguidos en un
   * solo array (una línea de caché por consulta) y un array de etiquetas de un byte, que se sondea primero, descarta
   * casi siempre sin salir de él las claves ausentes, que son la mayoría al recorrer el corpus.
   * Campos por hueco: a, b (huella), c (apariciones) y, en la de recuento (w = 9), d (intervenciones), s (última vista
   * + 1) y, por cada lado, el vecino candidato a mayoritario y su contador (voto de Boyer y Moore, 1991).
   * hueco(a, b) → número de hueco h; sus campos empiezan en v[h · w]; vacío si v[h · w] === 0.
   */
  class Tabla {
    constructor(bits = 16, recuento = false) { this.w = recuento ? 9 : 3; this.iniciar(bits); }
    iniciar(bits) {
      this.bits = bits; this.cap = 1 << bits; this.n = 0;
      this.v = new Uint32Array(this.cap * this.w);
      this.t = new Uint8Array(this.cap);
    }
    hueco(a, b) {
      const t = this.t, v = this.v, w = this.w, m = this.cap - 1, e = (b & 0xff) | 1;
      let h = a & m;
      for (;;) {
        const x = t[h];
        if (x === 0) return h;
        if (x === e) { const q = h * w; if (v[q] === a && v[q + 1] === b) return h; }
        h = (h + 1) & m;
      }
    }
    /** Ocupa el hueco vacío h con la clave. Puede hacer crecer la tabla: después, h ya no vale. */
    poner(h, a, b, c, d = 0, s = 0, vi = 0, vd = 0) {
      const v = this.v, q = h * this.w;
      v[q] = a; v[q + 1] = b; v[q + 2] = c;
      if (this.w === 9) { v[q + 3] = d; v[q + 4] = s; v[q + 5] = vi; v[q + 6] = 1; v[q + 7] = vd; v[q + 8] = 1; }
      this.t[h] = (b & 0xff) | 1;
      if (++this.n > this.cap * 0.7) this.crecer();
    }
    crecer() {
      const ov = this.v, w = this.w;
      this.iniciar(this.bits + 1);
      for (let q = 0; q < ov.length; q += w) {
        if (ov[q] === 0) continue;
        const h = this.hueco(ov[q], ov[q + 1]), r = h * w;
        for (let k = 0; k < w; k++) this.v[r + k] = ov[q + k];
        this.t[h] = (ov[q + 1] & 0xff) | 1;
        this.n++;
      }
    }
  }
  /**
   * Filtro de Bloom por bloques (Putze, Sanders y Singler, 2007): los k bits de una clave caen en un mismo bloque de
   * 512 bits, una línea de caché, así que cada consulta toca una sola línea de memoria en lugar de k.
   */
  class Bloom {
    constructor(bits, k) {
      let nb = 2;
      while (nb * 512 < bits) nb *= 2;
      this.sh = 32 - Math.log2(nb); this.k = k; this.v = new Uint32Array(nb * 16);
    }
    /** true si la clave ya estaba (o por un falso positivo); la deja marcada. */
    visto(a, b) {
      const v = this.v, base = (Math.imul(a ^ Math.imul(b, 0x85ebca6b), 0x9e3779b1) >>> this.sh) << 4;
      const paso = (b >>> 16) | 1;
      let todos = true, x = b;
      for (let i = 0; i < this.k; i++) {
        const q = x & 511, p = base + (q >>> 5), bit = 1 << (q & 31);
        if ((v[p] & bit) === 0) { todos = false; v[p] |= bit; }
        x = (x + paso) | 0;
      }
      return todos;
    }
  }

  // ------------------------------------------------------------------------------------------------ detección
  const SQL_TABLA = `CREATE TABLE IF NOT EXISTS expresiones (
    id INTEGER PRIMARY KEY, forma TEXT NOT NULL UNIQUE, mostrar TEXT NOT NULL, n_tokens INTEGER NOT NULL,
    n_palabras INTEGER NOT NULL, frecuencia INTEGER NOT NULL, independiente INTEGER NOT NULL, intervenciones INTEGER NOT NULL,
    g2 REAL, cvalue REAL)`;

  async function detectar(ctx) {
    const t0 = ahora();
    const KK = K();
    const bd = { db: ctx.db, sqlite3: ctx.sqlite3 };
    const S = R2.sql;
    const pais = ctx.pais || '';
    const esContenido = contenidoDe(pais), tipo = tipoDe(pais);
    const alProgreso = typeof ctx.alProgreso === 'function' ? ctx.alProgreso : () => {};
    S.ejecutar(bd, SQL_TABLA);
    S.ejecutar(bd, 'DELETE FROM expresiones');

    const ids = S.columna(bd, 'SELECT id FROM speeches WHERE dm_speech = 1 ORDER BY id');
    const tokensCorpus = Number(KK.corpus_tokens(bd)) || 0;          // el índice entero: referencia del G² con fts5vocab
    // Tamaño del texto que se recorre (el discurso): decide la muestra y el umbral.
    const tokensDiscurso = Number(S.valor(bd, 'SELECT coalesce(sum(nwords), 0) FROM speeches WHERE dm_speech = 1')) || tokensCorpus;
    const M = tokensDiscurso > TOKENS_SIN_MUESTRA ? Math.max(2, Math.round(tokensDiscurso / TOKENS_POR_MUESTRA)) : 1;
    const F = Math.max(20, Math.ceil(0.25 * tokensDiscurso / 1e6));
    const enMuestra = (id) => M === 1 || (Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) >>> 0) % M === 0;
    const muestra = M === 1 ? ids : ids.filter(enMuestra);
    const totalTrabajo = M === 1 ? ids.length : muestra.length + ids.length;   // con M = 1 hay una sola pasada
    let hecho = 0;
    const TROZO = 4000;

    const bloom = new Bloom(128 * 1024 * 1024, 7);
    const registros = new Map();                                  // huella → [a, b, forma, mostrar] al alcanzar F
    const clave = (a, b) => a * 4294967296 + b;
    let tabla, inst1 = 0, nMuestra = 0;
    const ASCII = /^[\x00-\x7f]*$/;
    const plegar = (w) => (ASCII.test(w) ? w : KK.plegar_token(w));
    /**
     * Lee los textos por trozos y, en cada tramo sin puntuación dentro, prepara tipos, resúmenes y (con vecinos) las
     * extensiones de cada posición, y llama a f(a, b, i, j, tokens plegados, tokens crudos, id) por candidata.
     */
    const recorrerTextos = async (lista, vecinos, f) => {
      for (let k = 0; k < lista.length; k += TROZO) {
        const mapa = await R2.texto.leerTextos(ctx.db, lista.slice(k, k + TROZO), {});
        for (const x of mapa.values()) {
          for (const crudos of KK.crudos_tramos(x.speech || '')) {
            if (crudos.length < 2) continue;
            const tk = crudos.map(plegar), id = x.id;
            preparar(tk, tipo, vecinos);
            recorrerPreparado((a, b, i, j) => f(a, b, i, j, tk, crudos, id));
          }
        }
        hecho += Math.min(TROZO, lista.length - k);
        alProgreso(hecho, totalTrabajo);
        await ceder(ctx);
      }
    };

    // Recuento de una aparición en la tabla de recuento: apariciones, intervenciones y votos de los vecinos.
    const contar1 = (v, q, i, j, sello) => {
      const c = ++v[q + 2];
      if (v[q + 4] !== sello) { v[q + 4] = sello; v[q + 3]++; }
      const x = T.izq[i], y = T.der[j];
      if (v[q + 6] === 0) { v[q + 5] = x; v[q + 6] = 1; } else if (v[q + 5] === x) v[q + 6]++; else v[q + 6]--;
      if (v[q + 8] === 0) { v[q + 7] = y; v[q + 8] = 1; } else if (v[q + 7] === y) v[q + 8]++; else v[q + 8]--;
      return c;
    };

    if (M === 1) {
      // Corpus pequeño: una sola pasada descubre y cuenta a la vez.
      tabla = new Tabla(18, true);
      await recorrerTextos(ids, true, (a, b, i, j, tk, crudos, doc) => {
        inst1++;
        const h = tabla.hueco(a, b), v = tabla.v, q = h * 9;
        // La primera aparición solo la ve el Bloom: la tabla empieza en 2 con la segunda, que ya vota.
        if (v[q] === 0) { if (bloom.visto(a, b)) tabla.poner(h, a, b, 2, 1, doc + 1, T.izq[i], T.der[j]); return; }
        if (contar1(v, q, i, j, doc + 1) === F) registros.set(clave(a, b), [a, b, tk.slice(i, j + 1).join(' '), crudos.slice(i, j + 1).join(' ')]);
      });
      nMuestra = tabla.n;
    } else {
      // Pasada 1: muestra, con Bloom para las candidatas vistas una sola vez.
      const t1 = new Tabla(18);
      await recorrerTextos(muestra, false, (a, b) => {
        inst1++;
        const h = t1.hueco(a, b), q = h * 3;
        if (t1.v[q] !== 0) { t1.v[q + 2]++; return; }
        if (bloom.visto(a, b)) t1.poner(h, a, b, 2);
      });
      // Pasada 2: recuento exacto en todo el corpus de las candidatas repetidas en la muestra (tabla fija: sin crecer).
      let bits = 16;
      while ((1 << bits) * 0.6 < t1.n) bits++;
      tabla = new Tabla(bits, true);
      for (let q = 0; q < t1.v.length; q += 3) {
        if (t1.v[q] === 0) continue;
        const h = tabla.hueco(t1.v[q], t1.v[q + 1]), r = h * 9;
        tabla.poner(h, t1.v[q], t1.v[q + 1], 0);
        tabla.v[r + 6] = 0; tabla.v[r + 8] = 0;                   // sin votos todavía
      }
      nMuestra = t1.n;
      t1.iniciar(1);                                              // libera la memoria de la primera pasada
      bloom.v = null;
      await recorrerTextos(ids, true, (a, b, i, j, tk, crudos, doc) => {
        const h = tabla.hueco(a, b), v = tabla.v, q = h * 9;
        if (v[q] === 0) return;
        if (contar1(v, q, i, j, doc + 1) === F) registros.set(clave(a, b), [a, b, tk.slice(i, j + 1).join(' '), crudos.slice(i, j + 1).join(' ')]);
      });
    }

    // Selección: frecuencia y dispersión, tramos de secuencias más largas, asociación con la última palabra, C-value.
    const cand = new Map();                                       // forma → { forma, mostrar, f, df, toks, cont }
    let tramosLargos = 0;
    const depurar = typeof ctx.depurar === 'function' ? ctx.depurar : null;
    for (const [a, b, forma, mostrar] of registros.values()) {
      const v = tabla.v, q = tabla.hueco(a, b) * 9, f = v[q + 2], df = v[q + 3];
      if (df < MIN_INTERVENCIONES) continue;
      // El mismo vecino en casi todas las apariciones: la candidata es un trozo de una secuencia más larga (una fórmula
      // leída una y otra vez, un nombre de más de 7 tokens), no una unidad.
      const domIzq = v[q + 5] !== 0 && v[q + 6] >= VECINO_DOMINANTE * f, domDer = v[q + 7] !== 0 && v[q + 8] >= VECINO_DOMINANTE * f;
      if (depurar) depurar({ forma, mostrar, f, df, izq: v[q + 5] !== 0 ? v[q + 6] / f : 0, der: v[q + 7] !== 0 ? v[q + 8] / f : 0 });
      if (domIzq || domDer) { tramosLargos++; continue; }
      const toks = forma.split(' ');
      const cont = [];
      toks.forEach((w, q) => { if (esContenido(w)) cont.push(q); });
      cand.set(forma, { forma, mostrar, f, df, toks, cont, g2: null, cvalue: null, indep: null });
    }
    const palabras = new Set();
    for (const x of cand.values()) { palabras.add(x.toks[x.toks.length - 1]); palabras.add(x.toks[0]); }
    const uni = KK.reference_counts(bd, palabras);
    // Frecuencia de la parte izquierda: de la tabla, también si se descartó por ser un trozo («supremo tribunal» de
    // «supremo tribunal federal»); llegó a F, porque es al menos tan frecuente como la expresión.
    const frecTabla = new Map();
    for (const [a, b, forma] of registros.values()) frecTabla.set(forma, tabla.v[tabla.hueco(a, b) * 9 + 2]);
    const frecDe = (toks) => (toks.length === 1 ? Number(uni.get(toks[0]) || 0) : frecTabla.get(toks.join(' ')));
    const asociadas = [];
    for (const x of cand.values()) {
      const pc = x.cont[x.cont.length - 2];                        // última palabra de contenido de la parte izquierda
      const fP = frecDe(x.toks.slice(0, pc + 1));
      const fW = Number(uni.get(x.toks[x.toks.length - 1]) || 0);
      if (fP && fW && tokensCorpus > fP) {
        x.g2 = KK.g2_signed(x.f, Math.max(0, fW - x.f), fP, tokensCorpus - fP);
        if (!(x.g2 >= UMBRAL_G2)) continue;
      }
      asociadas.push(x);
    }
    const conjunto = new Map(asociadas.map((x) => [x.forma, x]));
    const suma = new Map(), cuantas = new Map(), mayor = new Map();
    for (const x of asociadas) {
      for (let p = 0; p < x.cont.length; p++) {
        for (let q = p + 1; q < x.cont.length; q++) {
          if (p === 0 && q === x.cont.length - 1) continue;         // el tramo completo es la propia expresión
          const sub = x.toks.slice(x.cont[p], x.cont[q] + 1).join(' ');
          if (!conjunto.has(sub)) continue;
          suma.set(sub, (suma.get(sub) || 0) + x.f);
          cuantas.set(sub, (cuantas.get(sub) || 0) + 1);
          if (x.f > (mayor.get(sub) || 0)) mayor.set(sub, x.f);
        }
      }
    }
    const elegidas = [];
    let fragmentos = 0;
    for (const x of asociadas) {
      const n = cuantas.get(x.forma) || 0;
      x.cvalue = Math.log2(x.toks.length) * (x.f - (n ? suma.get(x.forma) / n : 0));
      x.indep = x.f - (mayor.get(x.forma) || 0);
      if (x.indep >= F) elegidas.push(x); else fragmentos++;
    }
    elegidas.sort((a, b) => b.f - a.f || (a.forma < b.forma ? -1 : 1));

    S.ejecutar(bd, 'BEGIN');
    try {
      const st = ctx.db.prepare('INSERT INTO expresiones (forma, mostrar, n_tokens, n_palabras, frecuencia, independiente, intervenciones, g2, cvalue) VALUES (?,?,?,?,?,?,?,?,?)');
      try {
        for (const x of elegidas) {
          st.bind([x.forma, x.mostrar, x.toks.length, x.cont.length, x.f, x.indep, x.df, x.g2 === null ? null : Math.round(x.g2 * 100) / 100,
            Math.round(x.cvalue * 100) / 100]).stepReset();
        }
      } finally { st.finalize(); }
      S.ejecutar(bd, 'COMMIT');
    } catch (e) { S.ejecutar(bd, 'ROLLBACK'); throw e; }

    const resumen = {
      version: VERSION, muestra_1_de: M, frecuencia_minima: F, intervenciones_minimas: MIN_INTERVENCIONES, max_tokens: MAX_TOKENS,
      umbral_g2: UMBRAL_G2, tokens_corpus: tokensCorpus, tokens_discurso: tokensDiscurso, intervenciones: ids.length, candidatas_muestra: inst1,
      repetidas_muestra: nMuestra, tramos_de_secuencias_largas: tramosLargos, con_frecuencia_minima: cand.size, tras_asociacion: asociadas.length,
      fragmentos_descartados: fragmentos, seleccionadas: elegidas.length, vacias: fuenteVacias(pais), conectores: CONECTORES[lenguaDe(pais)],
      ms: Math.round(ahora() - t0),
    };
    S.ejecutar(bd, "INSERT OR REPLACE INTO meta (key, value) VALUES ('expresiones', ?)", [JSON.stringify(resumen)]);
    cacheIndices.delete(ctx.db);
    return resumen;
  }

  // ------------------------------------------------------------------------------------------------ uso en bibliotecas
  const cacheIndices = new WeakMap();

  /** Índice en memoria de las expresiones de la base (null si no tiene la tabla o está vacía). */
  function cargar(bd) {
    if (cacheIndices.has(bd.db)) return cacheIndices.get(bd.db);
    let filas = [];
    try {
      filas = R2.sql.filas(bd, 'SELECT id, forma, mostrar, frecuencia, intervenciones FROM expresiones ORDER BY id');
    } catch (e) { filas = []; }
    let ix = null;
    const fuera = filas.length ? rechazadas(bd) : new Set();
    if (fuera.size) filas = filas.filter((r) => !fuera.has(r.forma));
    if (filas.length) {
      let bits = 10;
      while ((1 << bits) * 0.6 < filas.length) bits++;
      const t = new Tabla(bits);
      const formas = [], mostrar = [], frec = [], df = [], ids = [];
      filas.forEach((r, k) => {
        const [a, b] = huellaTokens(r.forma.split(' '));
        t.poner(t.hueco(a, b), a, b, k + 1);                        // c = índice + 1
        formas.push(r.forma); mostrar.push(r.mostrar); frec.push(Number(r.frecuencia)); df.push(Number(r.intervenciones)); ids.push(Number(r.id));
      });
      let meta = null;
      try { meta = JSON.parse(R2.sql.valor(bd, "SELECT value FROM meta WHERE key = 'expresiones'") || 'null'); } catch (e) { meta = null; }
      let pais = '';
      try { pais = String(R2.sql.valor(bd, "SELECT value FROM meta WHERE key = 'pais'") || ''); } catch (e) { pais = ''; }
      ix = { tabla: t, formas, mostrar, frec, df, ids, meta, n: filas.length, rechazadas: fuera.size, tipo: tipoDe(pais),
        esContenido: contenidoDe(pais) };
    }
    cacheIndices.set(bd.db, ix);
    return ix;
  }

  // Segmentación de un tramo en unidades (programación dinámica de derecha a izquierda): el menor número de unidades y,
  // a igualdad, las más largas (suma de los cuadrados de sus longitudes). La más larga desde la izquierda partía «por
  // medio del ministro de justicia y seguridad pública» en «medio del ministro | de | justicia y seguridad pública»; así
  // queda «medio | del | ministro de justicia y seguridad pública».
  let costeU = new Int32Array(256), puntosU = new Int32Array(256), finU = new Int32Array(256), exprU = new Int32Array(256);
  /** Tokens de un tramo con las expresiones unidas (la forma plegada con espacios). Añade a `out` si se da. */
  function unidades(ix, tk, out = []) {
    if (!ix) { for (const w of tk) out.push(w); return out; }
    const n = tk.length;
    preparar(tk, ix.tipo);
    if (costeU.length < n + 1) {
      let m = costeU.length;
      while (m < n + 1) m *= 2;
      costeU = new Int32Array(m); puntosU = new Int32Array(m); finU = new Int32Array(m); exprU = new Int32Array(m);
    }
    const ti = T.tipo, x1 = T.x1, x2 = T.x2, t = ix.tabla;
    costeU[n] = 0; puntosU[n] = 0;
    for (let i = n - 1; i >= 0; i--) {
      let coste = 1 + costeU[i + 1], puntos = 1 + puntosU[i + 1], fin = i, ex = -1;
      if (ti[i] === 2) {
        let a = mezclar(SEMILLA_A, x1[i]), b = mezclar(SEMILLA_B, x2[i]);
        const tope = Math.min(n, i + MAX_TOKENS);
        for (let j = i + 1; j < tope; j++) {
          const tj = ti[j];
          if (tj === 0) break;
          a = mezclar(a, x1[j]); b = mezclar(b, x2[j]);
          if (tj !== 2) continue;
          const q = t.hueco((acabar(a) | 1) >>> 0, acabar(b) >>> 0) * 3;
          if (t.v[q] === 0) continue;
          const L = j - i + 1, c = 1 + costeU[j + 1], p = L * L + puntosU[j + 1];
          if (c < coste || (c === coste && p > puntos)) { coste = c; puntos = p; fin = j; ex = t.v[q + 2] - 1; }
        }
      }
      costeU[i] = coste; puntosU[i] = puntos; finU[i] = fin; exprU[i] = ex;
    }
    for (let i = 0; i < n; i = finU[i] + 1) out.push(exprU[i] >= 0 ? ix.formas[exprU[i]] : tk[i]);
    return out;
  }
  /** Los tokens de un texto (los de keyness.tokenize) con las expresiones unidas, sin cruzar la puntuación. */
  function unidadesTexto(ix, texto) {
    if (!ix) return K().tokenize(texto || '');
    const out = [];
    for (const tk of K().tokenize_tramos(texto || '')) unidades(ix, tk, out);
    return out;
  }

  /**
   * Apariciones de cada expresión en unos textos, TODAS: también las que están dentro de otra más larga, igual que la
   * frecuencia del corpus con la que se compara en el léxico y que el léxico cuenta las palabras. Si se contara solo
   * la más larga, «seguridad pública» perdería las apariciones que se queda «justicia y seguridad pública» y parecería
   * infrausada frente al corpus. Map índice → n.
   */
  function contar(ix, textos) {
    const n = new Map();
    if (!ix) return n;
    const t = ix.tabla, cuenta = new Uint32Array(ix.n);
    const f = (a, b) => { const q = t.hueco(a, b) * 3; if (t.v[q] !== 0) cuenta[t.v[q + 2] - 1]++; };
    for (const tx of textos) for (const tk of K().tokenize_tramos(tx || '')) if (tk.length > 1) recorrer(tk, ix.tipo, f);
    for (let e = 0; e < cuenta.length; e++) if (cuenta[e]) n.set(e, cuenta[e]);
    return n;
  }

  // ------------------------------------------------------------------------------------------------ revisión
  // El investigador puede pedir que una expresión no se una (un nombre con su estado en una fila de asistencia, una
  // fórmula del género). Las rechazadas no entran en el índice de cargar(), ni por tanto en el léxico ni en las
  // coocurrencias, y sus palabras vuelven a contar sueltas. La lista vive en la memoria del motor, no en la base: la base
  // no cambia después de construirla (la recordada se comprueba con la huella de todas sus páginas al abrirla); la
  // página la guarda en el navegador por corpus y la vuelve a enviar al abrirlo.
  const rechazos = new WeakMap();                                 // conexión → Set de formas
  const revisiones = new WeakMap();
  /** Número de cambios de la lista de rechazadas en esta conexión (para las cachés que dependen de las expresiones). */
  const revision = (bd) => revisiones.get(bd.db) || 0;
  function hayTabla(bd) {
    try { return !!R2.sql.valor(bd, "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'expresiones'"); } catch (e) { return false; }
  }
  /** Formas plegadas de las expresiones que no se unen (Set, copia). */
  const rechazadas = (bd) => new Set(rechazos.get(bd.db) || []);
  /** Fija la lista entera de rechazadas (formas; se ignoran las que no están en la tabla) → { rechazadas: n, formas }. */
  function fijarRechazadas(bd, formas) {
    if (!hayTabla(bd)) return { rechazadas: 0, formas: [] };
    const existen = new Set(R2.sql.columna(bd, 'SELECT forma FROM expresiones'));
    const lista = [...new Set((formas || []).map((f) => K().fold(String(f)).trim().replace(/\s+/g, ' ')))].filter((f) => existen.has(f)).sort();
    const antes = rechazos.get(bd.db) || new Set();
    if (lista.length === antes.size && lista.every((f) => antes.has(f))) return { rechazadas: lista.length, formas: lista };
    rechazos.set(bd.db, new Set(lista));
    cacheIndices.delete(bd.db);
    revisiones.set(bd.db, revision(bd) + 1);
    return { rechazadas: lista.length, formas: lista };
  }
  const ORDENES = Object.freeze({ frecuencia: 'frecuencia DESC, forma', alfabetico: 'forma', g2: 'g2 DESC, forma',
    longitud: 'n_tokens DESC, frecuencia DESC, forma' });
  /**
   * Inventario para revisarlo: { disponible, total, filas, rechazadas, meta }. o = { q (texto que contienen, sin tildes
   * ni mayúsculas), orden (frecuencia | alfabetico | g2 | longitud), limite (0 = todas), desde, solo (todas | rechazadas) }.
   */
  function listar(bd, o = {}) {
    if (!hayTabla(bd)) return { disponible: false, total: 0, filas: [], rechazadas: 0, meta: null };
    const S = R2.sql, fuera = rechazadas(bd);
    const q = K().fold(String(o.q || '')).trim().replace(/\s+/g, ' ');
    const donde = q ? "WHERE forma LIKE ? ESCAPE '\\'" : '';
    const args = q ? ['%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'] : [];
    const orden = ORDENES[o.orden] || ORDENES.frecuencia;
    const limite = Math.max(0, Math.floor(Number(o.limite) || 0)), desde = Math.max(0, Math.floor(Number(o.desde) || 0));
    const cols = 'forma, mostrar, n_tokens, n_palabras, frecuencia, independiente, intervenciones, g2, cvalue';
    let filas, total;
    if (o.solo === 'rechazadas') {
      const todas = S.filas(bd, `SELECT ${cols} FROM expresiones ${donde} ORDER BY ${orden}`, args).filter((r) => fuera.has(r.forma));
      total = todas.length;
      filas = limite ? todas.slice(desde, desde + limite) : todas.slice(desde);
    } else {
      total = Number(S.valor(bd, `SELECT count(*) FROM expresiones ${donde}`, args)) || 0;
      filas = S.filas(bd, `SELECT ${cols} FROM expresiones ${donde} ORDER BY ${orden}${limite ? ` LIMIT ${limite} OFFSET ${desde}` : ''}`, args);
    }
    for (const r of filas) r.rechazada = fuera.has(r.forma);
    let meta = null;
    try { meta = JSON.parse(S.valor(bd, "SELECT value FROM meta WHERE key = 'expresiones'") || 'null'); } catch (e) { meta = null; }
    return { disponible: true, total, filas, rechazadas: fuera.size, meta };
  }

  // ------------------------------------------------------------------------------------------------ precalculadas
  // Paquete compacto con la tabla de una base, para servirla ya calculada (tools/expresiones_precalculadas.py la genera
  // para los CSV publicados en Dataverse y la edición web la carga si el CSV elegido es idéntico: misma SHA-256).
  const COLUMNAS_PAQUETE = Object.freeze(['forma', 'mostrar', 'n_tokens', 'n_palabras', 'frecuencia', 'independiente',
    'intervenciones', 'g2', 'cvalue']);
  /** { version, meta, columnas, filas } de la tabla de la base; mostrar = 0 cuando coincide con la forma. */
  function paquete(bd) {
    const filas = R2.sql.filas(bd, `SELECT ${COLUMNAS_PAQUETE.join(', ')} FROM expresiones ORDER BY id`);
    const meta = JSON.parse(R2.sql.valor(bd, "SELECT value FROM meta WHERE key = 'expresiones'") || 'null');
    if (meta) delete meta.ms;                                       // sin tiempos: el mismo CSV da el mismo paquete
    return { version: VERSION, meta, columnas: COLUMNAS_PAQUETE.slice(),
      filas: filas.map((x) => COLUMNAS_PAQUETE.map((c) => (c === 'mostrar' && x.mostrar === x.forma ? 0 : x[c]))) };
  }
  /**
   * Crea y llena la tabla con un paquete ya calculado (sin recorrer el corpus) → resumen, el guardado en
   * meta.expresiones con `precalculada: { origen, csv_sha256 }`. Lanza si el paquete no es de esta versión o no tiene la
   * forma esperada: quien llama detecta entonces las expresiones como siempre.
   */
  function cargarPaquete({ db, sqlite3, paquete: pq, origen = null, csvSha256 = null }) {
    const t0 = ahora();
    if (!pq || pq.version !== VERSION) throw new Error(`paquete de la versión ${pq && pq.version}, se esperaba la ${VERSION}`);
    if (!Array.isArray(pq.columnas) || pq.columnas.join() !== COLUMNAS_PAQUETE.join() || !Array.isArray(pq.filas)) {
      throw new Error('paquete sin las columnas esperadas');
    }
    const bd = { db, sqlite3 };
    const S = R2.sql;
    S.ejecutar(bd, SQL_TABLA);
    S.ejecutar(bd, 'DELETE FROM expresiones');
    S.ejecutar(bd, 'BEGIN');
    try {
      const st = db.prepare('INSERT INTO expresiones (forma, mostrar, n_tokens, n_palabras, frecuencia, independiente, intervenciones, g2, cvalue) VALUES (?,?,?,?,?,?,?,?,?)');
      try {
        for (const f of pq.filas) {
          if (!Array.isArray(f) || f.length !== COLUMNAS_PAQUETE.length || typeof f[0] !== 'string' || !f[0]) throw new Error('fila de paquete no válida');
          st.bind([f[0], f[1] === 0 ? f[0] : f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8]]).stepReset();
        }
      } finally { st.finalize(); }
      S.ejecutar(bd, 'COMMIT');
    } catch (e) { S.ejecutar(bd, 'ROLLBACK'); S.ejecutar(bd, 'DELETE FROM expresiones'); throw e; }
    const resumen = Object.assign({}, pq.meta || {}, { seleccionadas: pq.filas.length,
      precalculada: { origen, csv_sha256: csvSha256, ms_carga: Math.round(ahora() - t0) } });
    S.ejecutar(bd, "INSERT OR REPLACE INTO meta (key, value) VALUES ('expresiones', ?)", [JSON.stringify(resumen)]);
    cacheIndices.delete(db);
    return resumen;
  }

  R2.expresiones = Object.freeze({
    VERSION, MAX_TOKENS, CONECTORES, detectar, cargar, unidades, unidadesTexto, contar, huellaTokens, recorrer,
    lenguaDe, vaciasDe, conectoresDe, contenidoDe, numeralesDe, tipoDe, fuenteVacias, listar, rechazadas, fijarRechazadas,
    revision, paquete, cargarPaquete, COLUMNAS_PAQUETE,
  });
})(globalThis.R2 = globalThis.R2 || {});

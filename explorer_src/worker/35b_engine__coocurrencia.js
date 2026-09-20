/* ===== src/engine/coocurrencia.js ===== */
/* Diarios Explorer · engine/coocurrencia.js
 *
 * Red de coocurrencias de una biblioteca y temas por detección de comunidades.
 *
 *  1. Vocabulario: los términos de sobreuso del léxico de la biblioteca (R2.partition.keynessColeccion, que guarda los
 *     últimos resultados), en su orden de G², sin cifras (con dígitos o con letras: «treinta», «mil») ni las palabras
 *     vacías publicadas de la lengua del país
 *     (Snowball, la lista conservadora que usa quanteda por defecto: portugués para Brasil y Portugal, español para el
 *     resto; se conservan «estado» y «estados», que Snowball incluye como formas de «estar»).
 *  2. Texto: el mismo que analiza el léxico (solo discurso o texto completo, con la misma segmentación), tokenizado con
 *     el mismo plegado (R2.keyness.tokenize), de modo que cada término del vocabulario se encuentra en el texto.
 *  3. Unidad de contexto: la intervención entera, o fragmentos consecutivos de N palabras dentro de cada intervención.
 *  4. Recuento en matriz triangular densa. El vocabulario está acotado (500 términos son 124.750 pares, medio
 *     megabyte) y la red de términos característicos resulta casi completa: medido en la biblioteca de reforma
 *     tributaria de Brasil, el 99,8 % de los pares coinciden en alguna intervención, así que la matriz densa ocupa la
 *     mitad que una lista de adyacencia.
 *  5. Asociación de cada par: G² de Dunning con signo sobre la tabla 2×2 de unidades (R2.keyness.g2_signed) y fuerza
 *     de asociación, observado / esperado (la normalización de van Eck y Waltman, 2009, que usa VOSviewer).
 *  6. Poda: se conservan las aristas con asociación positiva y G² ≥ umbral (10,83 ⇔ p < 0,001, un grado de libertad)
 *     que están entre los k vecinos de mayor G² de alguno de sus extremos. El peso de la arista es la fuerza de
 *     asociación: el G² decide qué aristas existen y la fuerza cuánto pesan.
 *  7. Comunidades: Leiden (R2.leiden) con resolución γ y semilla fija; cada comunidad es un tema candidato.
 *  8. Por tema: sus términos ordenados por fuerza interna, cuántas intervenciones de la biblioteca contienen alguno y
 *     cuántas palabras de su vocabulario dice cada partido. Con las palabras que dice cada partido en toda la biblioteca
 *     (`partidos`), el peso de un partido en un tema es una frecuencia relativa —palabras del tema por cada mil suyas—,
 *     comparable entre partidos de tamaño distinto.
 *  9. Jerarquía de lectura: cada intervención se puntúa con BM25 (k1 = 1,2, b = 0,75, los de FTS5), pero con el peso de
 *     cada término dado por su G² en el léxico, en escala logarítmica, en lugar del IDF: puntúa alto la intervención que
 *     concentra el vocabulario característico de la biblioteca, con saturación por repetición y corrección por longitud.
 *     Se obtiene una puntuación por tema (solo sus términos) y otra global, y una selección variada que toma por turnos
 *     la mejor de cada tema. Sirve para priorizar la lectura y, más adelante, para elegir qué intervenciones enviar a un
 *     modelo de lenguaje. Los temas se ordenan por el G² medio de sus
 *     términos en el léxico, es decir, por lo característicos que son de la biblioteca.
 *  El investigador puede excluir términos (opción `excluir`) tras revisar los temas y recalcular sin ellos.
 *
 * API (R2.coocurrencia)
 *   red(ctx, ids, opciones) → promesa del resultado (véase DEFECTOS para las opciones)
 *   lenguaDe(pais) → 'es' | 'pt'   ·   vaciasDe(pais) → Set de formas plegadas
 */
(function (R2) {
  'use strict';

  const P = R2.partition, K = R2.keyness, L = R2.leiden;
  if (!P || !K || !L) throw new Error('engine/coocurrencia.js necesita R2.partition, R2.keyness y R2.leiden');

  const DEFECTOS = Object.freeze({
    solo_discurso: true, unidad: 'intervencion', fragmento: 20, vocabulario: 250, vecinos: 10,
    resolucion: 1.0, semilla: 1, g2_min: 10.83, excluir: [], expresiones: true,
  });
  const LEXICO = Object.freeze({ limit: 2000, limit_negative: 200, min_freq: 5 });   // las mismas que pide la página
  const TROZO = 2000;             // intervenciones por lectura
  const LECTURA_TEMA = 25;        // intervenciones mejor puntuadas que se devuelven por tema
  const LECTURA_GLOBAL = 200;     // … y en el conjunto de la biblioteca
  const LECTURA_VARIADA = 100;    // selección variada: la mejor de cada tema por turnos
  const BM25_K1 = 1.2, BM25_B = 0.75;   // los de FTS5 y el motor de tendencias
  const PORTUGUES = new Set(['BR', 'PT']);
  const MIN_TEMA = 3;             // una comunidad de menos términos no es un tema: se lista aparte, como términos sueltos

  // La lectura y el recuento van por trozos alternos, así que forman una sola fase: si fueran dos, la barra de
  // progreso saltaría adelante y atrás.
  const FASES = Object.freeze([
    { id: 'lexico', etiqueta: 'Obteniendo el vocabulario del léxico', peso: 0.45 },
    { id: 'coocurrencias', etiqueta: 'Leyendo las intervenciones y contando coocurrencias', peso: 0.50 },
    { id: 'red', etiqueta: 'Podando la red y detectando comunidades', peso: 0.05 },
  ]);

  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const redondea = (x, d = 4) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x);

  // ------------------------------------------------------------------------------------------------ palabras vacías
  const EX = R2.expresiones;
  const lenguaDe = (pais) => (EX ? EX.lenguaDe(pais) : (PORTUGUES.has(String(pais || '').toUpperCase()) ? 'pt' : 'es'));
  const cacheVacias = new Map();
  function vaciasDe(pais) {
    if (EX) return EX.vaciasDe(pais);
    const lengua = lenguaDe(pais);
    if (!cacheVacias.has(lengua)) {
      const reg = R2.datos && R2.datos.vacias_lengua;
      const ent = reg && reg.lenguas && reg.lenguas[lengua] ? reg.lenguas[lengua] : null;
      const lista = ent ? ent.palabras : [];
      // Excepciones: palabras de la lista que en este dominio son sustantivos centrales («estado», «estados»).
      const excepciones = new Set((ent && ent.excepciones ? ent.excepciones : []).map((w) => K.fold(w)));
      cacheVacias.set(lengua, new Set(lista.map((w) => K.fold(w)).filter((w) => !excepciones.has(w))));
    }
    return cacheVacias.get(lengua);
  }
  function fuenteVacias(pais) {
    const reg = R2.datos && R2.datos.vacias_lengua;
    const lengua = lenguaDe(pais);
    if (!reg || !reg.lenguas || !reg.lenguas[lengua]) return { lengua, fuente: null, n: 0 };
    return { lengua, fuente: reg.fuente, web: reg.web, licencia: reg.licencia, url: reg.lenguas[lengua].url,
      n: reg.lenguas[lengua].n, excepciones: reg.lenguas[lengua].excepciones || [], consultado: reg.consultado };
  }

  // ------------------------------------------------------------------------------------------------ progreso
  function crearProgreso(ctx, nTextos) {
    const fn = ctx && typeof ctx.progreso === 'function' ? ctx.progreso : null;
    const t0 = ahora();
    let ultimo = 0;
    const emitir = (id, fraccionFase, hecho = 0, total = 0, forzar = false) => {
      if (!fn) return;
      const t = ahora();
      if (!forzar && t - ultimo < 120) return;
      ultimo = t;
      const i = FASES.findIndex((f) => f.id === id);
      let acumulado = 0;
      for (let k = 0; k < i; k++) acumulado += FASES[k].peso;
      const parte = Math.max(0, Math.min(1, fraccionFase));
      try {
        fn({ fase: id, etiqueta: FASES[i].etiqueta, indice: i + 1, n_fases: FASES.length, hecho, total,
          fraccion: acumulado + FASES[i].peso * parte, ms: Math.round(t - t0), n_textos: nTextos });
      } catch (e) { /* el progreso nunca interrumpe el cálculo */ }
    };
    return { emitir };
  }

  const ceder = async (ctx) => { if (ctx && typeof ctx.ceder === 'function') await ctx.ceder(); };
  const idxPar = (i, j, n) => i * (2 * n - i - 1) / 2 + (j - i - 1);          // i < j

  // ------------------------------------------------------------------------------------------------ red
  async function red(ctx, ids, opciones = {}) {
    const o = Object.assign({}, DEFECTOS, opciones);
    const t0 = ahora();
    const tiempos = {};
    const bd = { db: ctx.db, sqlite3: ctx.sqlite3 };
    const pedidos = Array.from(new Set(Array.from(ids, (i) => Number(i)))).sort((a, b) => a - b);
    const prog = crearProgreso(ctx, pedidos.length);
    const pais = ctx.nucleo && ctx.nucleo.pais ? ctx.nucleo.pais : '';
    const vacias = vaciasDe(pais);
    // Cifras escritas con letras («treinta», «mil»): en las transcripciones son fechas, artículos y votaciones leídos.
    const numerales = EX ? EX.numeralesDe(pais) : new Set();
    // Expresiones de varias palabras detectadas al construir la base: cada una es una unidad del texto y un nodo.
    const ixExpr = o.expresiones && EX ? EX.cargar(bd) : null;

    // 1. Vocabulario del léxico (con su caché) y el modo de texto que usó.
    prog.emitir('lexico', 0, 0, 0, true);
    let t = ahora();
    const ctxLexico = Object.create(ctx);
    ctxLexico.progreso = (ev) => prog.emitir('lexico', ev && ev.fraccion ? ev.fraccion : 0, ev && ev.hecho, ev && ev.total);
    const lex = await P.keynessColeccion(ctxLexico, pedidos, Object.assign({ solo_discurso: !!o.solo_discurso }, LEXICO));
    tiempos.lexico = ahora() - t;
    if (lex.error) return { error: lex.error, message: lex.message || 'No se pudo calcular el léxico de la biblioteca.' };
    // Términos que el investigador excluye a mano tras revisar los temas (se comparan ya plegados).
    const excluir = new Set((o.excluir || []).map((w) => K.fold(String(w))).filter(Boolean));
    const descartadas = { vacias: 0, cifras: 0, excluidos: 0 };
    const vocab = [];
    for (const x of lex.terms || []) {
      if (vocab.length >= o.vocabulario) break;
      const w = x.term;
      if (!w || w.length < 2) continue;
      if (/^[0-9]+$/.test(w) || numerales.has(w)) { descartadas.cifras++; continue; }
      if (vacias.has(w)) { descartadas.vacias++; continue; }
      if (excluir.has(w)) { descartadas.excluidos++; continue; }
      if (x.expresion && !ixExpr) continue;                        // sin unir expresiones no pueden aparecer en el texto
      vocab.push({ term: w, display: x.display || w, freq: Number(x.freq || 0), g2: Number(x.g2 || 0), expresion: !!x.expresion });
    }
    const V = vocab.length;
    const base = {
      parametros: Object.assign({}, o, { lexico: Object.assign({}, LEXICO), modo_texto: lex.modo_texto || null,
        vacias: fuenteVacias(pais), expresiones: { unidas: !!ixExpr, inventario: ixExpr ? ixExpr.n : 0 } }),
      vocabulario: { disponibles: (lex.terms || []).length, usados: V, descartados: descartadas, desde_cache: !!lex.desde_cache },
    };
    if (V < 3) {
      return Object.assign(base, { nodos: [], aristas: [], comunidades: [], estadisticas: { n_intervenciones: pedidos.length },
        aviso: 'La biblioteca no tiene términos característicos suficientes para construir una red de coocurrencias.' });
    }
    const id = new Map(vocab.map((v, i) => [v.term, i]));

    // 2 y 3. Texto del discurso por trozos, unidades de contexto y recuento de pares.
    const nPares = V * (V - 1) / 2;
    const co = new Uint32Array(nPares);
    const dfUnidad = new Uint32Array(V);
    const dfDoc = new Uint32Array(V);
    const sello = new Int32Array(V).fill(-1);
    let selloN = 0;
    let nUnidades = 0, nDocs = 0, nTokens = 0;
    const docIds = [], docOff = [0], docTokens = [];
    let docTerm = new Uint16Array(1 << 16), docTF = new Uint16Array(1 << 16), docLen = 0;
    const tfDoc = new Uint32Array(V);
    const rapida = lex.modo_texto === 'discurso_rapido';
    const presentes = [];
    const contarUnidad = () => {
      nUnidades++;
      presentes.sort((a, b) => a - b);
      const m = presentes.length;
      for (let a = 0; a < m; a++) {
        const i = presentes[a];
        dfUnidad[i]++;
        const baseI = i * (2 * V - i - 1) / 2 - i - 1;
        for (let b = a + 1; b < m; b++) co[baseI + presentes[b]]++;
      }
    };
    t = ahora();
    let tLectura = 0;
    for (let k = 0; k < pedidos.length; k += TROZO) {
      const tl = ahora();
      const trozo = pedidos.slice(k, k + TROZO);
      const filas = await P.leerFilas(ctx, bd, trozo);
      let textos;
      if (!o.solo_discurso) textos = filas.map((f) => f.speech || '');
      else textos = (rapida ? await P.prose_texts_rapida(ctx, filas) : await P.prose_texts(ctx, filas))[0];
      tLectura += ahora() - tl;
      for (let d = 0; d < textos.length; d++) {
        const toks = ixExpr ? EX.unidadesTexto(ixExpr, textos[d]) : K.tokenize(textos[d]);
        nTokens += toks.length;
        nDocs++;
        // Términos del vocabulario presentes en la intervención y su frecuencia (cobertura y puntuación de lectura).
        selloN++;
        const enDoc = [];
        const pos = o.unidad === 'fragmento' ? new Int32Array(toks.length) : null;
        for (let p = 0; p < toks.length; p++) {
          const i = id.get(toks[p]);
          const v = i === undefined ? -1 : i;
          if (pos) pos[p] = v;
          if (v < 0) continue;
          tfDoc[v]++;
          if (sello[v] !== selloN) { sello[v] = selloN; enDoc.push(v); }
        }
        for (const i of enDoc) dfDoc[i]++;
        if (docLen + enDoc.length > docTerm.length) {
          const tam = Math.max(docTerm.length * 2, docLen + enDoc.length);
          const mas = new Uint16Array(tam); mas.set(docTerm.subarray(0, docLen)); docTerm = mas;
          const masTF = new Uint16Array(tam); masTF.set(docTF.subarray(0, docLen)); docTF = masTF;
        }
        for (const i of enDoc) { docTerm[docLen] = i; docTF[docLen++] = Math.min(65535, tfDoc[i]); tfDoc[i] = 0; }
        docIds.push(filas[d] ? filas[d].id : -1); docOff.push(docLen); docTokens.push(toks.length);
        if (o.unidad === 'fragmento') {
          const F = o.fragmento;
          for (let a = 0; a < toks.length; a += F) {
            selloN++;
            presentes.length = 0;
            const fin = Math.min(toks.length, a + F);
            for (let p = a; p < fin; p++) { const v = pos[p]; if (v >= 0 && sello[v] !== selloN) { sello[v] = selloN; presentes.push(v); } }
            contarUnidad();
          }
        } else {
          presentes.length = 0;
          for (const i of enDoc) presentes.push(i);
          contarUnidad();
        }
        if (d % 250 === 249) {
          prog.emitir('coocurrencias', (k + d + 1) / pedidos.length, k + d + 1, pedidos.length);
          await ceder(ctx);
        }
      }
      prog.emitir('coocurrencias', Math.min(1, (k + trozo.length) / pedidos.length), k + trozo.length, pedidos.length);
      await ceder(ctx);
    }
    tiempos.lectura = tLectura;
    tiempos.coocurrencias = ahora() - t - tLectura;

    // 5 y 6. Asociación y poda por vecinos.
    prog.emitir('red', 0, 0, 0, true);
    t = ahora();
    const N = nUnidades;
    let observados = 0, positivos = 0;
    const cand = [];                     // [i, j, co, esperado, g2, fuerza]
    for (let i = 0; i < V; i++) {
      const baseI = i * (2 * V - i - 1) / 2 - i - 1;
      for (let j = i + 1; j < V; j++) {
        const a = co[baseI + j];
        if (!a) continue;
        observados++;
        const e = dfUnidad[i] * dfUnidad[j] / N;
        if (!(a > e)) continue;
        const g2 = K.g2_signed(a, dfUnidad[j] - a, dfUnidad[i], N - dfUnidad[i]);
        if (!(g2 >= o.g2_min)) continue;
        positivos++;
        cand.push([i, j, a, e, g2, a / e]);
      }
      if (i % 50 === 49) await ceder(ctx);
    }
    const porNodo = Array.from({ length: V }, () => []);
    cand.forEach((c, k) => { porNodo[c[0]].push(k); porNodo[c[1]].push(k); });
    const guardar = new Uint8Array(cand.length);
    for (let i = 0; i < V; i++) {
      const l = porNodo[i];
      l.sort((x, y) => cand[y][4] - cand[x][4] || cand[x][0] - cand[y][0] || cand[x][1] - cand[y][1]);
      for (let r = 0; r < Math.min(o.vecinos, l.length); r++) guardar[l[r]] = 1;
    }
    const aristas = cand.filter((_, k) => guardar[k]);
    tiempos.poda = ahora() - t;

    // 7. Comunidades con Leiden.
    t = ahora();
    const lei = L.comunidades({ n: V, aristas: aristas.map((c) => [c[0], c[1], c[5]]) }, { resolucion: o.resolucion, semilla: o.semilla });
    tiempos.leiden = ahora() - t;
    const com = lei.comunidad;

    // Fuerza (grado ponderado) total e interna de cada término.
    const fuerza = new Float64Array(V), interna = new Float64Array(V), grado = new Int32Array(V);
    for (const [i, j, , , , w] of aristas) {
      fuerza[i] += w; fuerza[j] += w; grado[i]++; grado[j]++;
      if (com[i] === com[j]) { interna[i] += w; interna[j] += w; }
    }

    // 8. Temas: miembros ordenados por su fuerza dentro del tema.
    const nc = lei.n_comunidades;
    const miembros = Array.from({ length: nc }, () => []);
    for (let i = 0; i < V; i++) miembros[com[i]].push(i);
    for (const m of miembros) m.sort((a, b) => interna[b] - interna[a] || vocab[b].g2 - vocab[a].g2 || a - b);
    // 9. Cobertura de cada tema y puntuación BM25 ponderada por el léxico, por tema y global.
    const cobertura = new Uint32Array(nc);
    const pesoTermino = new Float64Array(V);
    for (let i = 0; i < V; i++) pesoTermino[i] = Math.log1p(Math.max(0, vocab[i].g2));
    let sumaLong = 0;
    for (const n of docTokens) sumaLong += n;
    const longMedia = docTokens.length ? sumaLong / docTokens.length : 1;
    const topTema = Array.from({ length: nc }, () => []);           // [puntuación, índice de intervención]
    const topGlobal = [];
    const meter = (lista, tope, punt, d) => {
      if (lista.length >= tope && punt <= lista[lista.length - 1][0]) return;
      let k = lista.length;
      lista.push(null);
      while (k > 0 && (lista[k - 1][0] < punt || (lista[k - 1][0] === punt && docIds[lista[k - 1][1]] > docIds[d]))) { lista[k] = lista[k - 1]; k--; }
      lista[k] = [punt, d];
      if (lista.length > tope) lista.pop();
    };
    // Partido de cada intervención (la ingesta guarda ya el canónico). Con él se cuenta, por tema y partido, cuántas
    // palabras del tema dice cada uno y cuántas dice en total: así el peso de un partido en un tema es una frecuencia
    // relativa (palabras del tema por cada mil suyas) y no depende de cuánto hable en la biblioteca.
    const partidos = [], idPartido = new Map(), docPartido = new Int32Array(docIds.length).fill(-1);
    {
      const pos = new Map();
      docIds.forEach((id, d) => { if (id >= 0) pos.set(Number(id), d); });
      const ids = [...pos.keys()];
      for (let k = 0; k < ids.length; k += 900) {
        const lote = ids.slice(k, k + 900);
        for (const f of R2.sql.filas(bd, `SELECT id, party FROM speeches WHERE id IN (${lote.map(() => '?').join(',')})`, lote)) {
          const bruto = String(f.party == null ? '' : f.party).trim();
          if (!bruto || /^(\?|sin identificar)$/i.test(bruto)) continue;
          let q = idPartido.get(bruto);
          if (q === undefined) { q = partidos.length; idPartido.set(bruto, q); partidos.push(bruto); }
          docPartido[pos.get(f.id)] = q;
        }
        await ceder(ctx);
      }
    }
    const nPart = partidos.length;
    const porTema = Array.from({ length: nc }, () => new Int32Array(nPart));        // intervenciones que tocan el tema
    const palabrasTema = Array.from({ length: nc }, () => new Float64Array(nPart)); // palabras del vocabulario del tema
    const totalPartido = new Int32Array(nPart);                                     // intervenciones de cada partido
    const palabrasPartido = new Float64Array(nPart);                                // palabras de cada partido
    let conPartido = 0, palabrasConPartido = 0, palabrasTotales = 0;

    const puntTema = new Float64Array(nc), tocadas = [];
    for (let d = 0; d < docIds.length; d++) {
      const pq = docPartido[d];
      palabrasTotales += docTokens[d];
      if (pq >= 0) { totalPartido[pq]++; conPartido++; palabrasPartido[pq] += docTokens[d]; palabrasConPartido += docTokens[d]; }
      const norma = BM25_K1 * (1 - BM25_B + BM25_B * docTokens[d] / longMedia);
      let global = 0;
      for (let q = docOff[d]; q < docOff[d + 1]; q++) {
        const i = docTerm[q], tf = docTF[q];
        const parte = pesoTermino[i] * tf * (BM25_K1 + 1) / (tf + norma);
        global += parte;
        const c = com[i];
        if (puntTema[c] === 0) tocadas.push(c);
        puntTema[c] += parte;
        if (pq >= 0) palabrasTema[c][pq] += tf;
      }
      for (const c of tocadas) {
        cobertura[c]++;
        if (pq >= 0) porTema[c][pq]++;
        meter(topTema[c], LECTURA_TEMA, puntTema[c], d); puntTema[c] = 0;
      }
      tocadas.length = 0;
      if (global > 0) meter(topGlobal, LECTURA_GLOBAL, global, d);
      if (d % 5000 === 4999) await ceder(ctx);
    }
    /** Términos de la intervención d (de un tema o de todos) ordenados por su aportación a la puntuación. */
    const terminosDe = (d, tema = null, max = 8) => {
      const norma = BM25_K1 * (1 - BM25_B + BM25_B * docTokens[d] / longMedia);
      const out = [];
      for (let q = docOff[d]; q < docOff[d + 1]; q++) {
        const i = docTerm[q];
        if (tema !== null && com[i] !== tema) continue;
        out.push([pesoTermino[i] * docTF[q] * (BM25_K1 + 1) / (docTF[q] + norma), i, docTF[q]]);
      }
      out.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
      return out.slice(0, max).map(([, i, tf]) => ({ display: vocab[i].display, tf }));
    };
    const fila = ([punt, d], tema = null) => ({ id: docIds[d], puntuacion: redondea(punt, 3), palabras: docTokens[d],
      terminos: terminosDe(d, tema) });
    /** Reparto entre partidos: intervenciones (`n`) y palabras (`pal`) de cada uno, los más presentes primero y el resto
     *  agregado. En un tema, `pal` son las palabras de su vocabulario; en la biblioteca, todas las del partido. */
    const repartoDe = (cuenta, palabras, tope) => {
      const lista = [];
      let total = 0, totalPal = 0;
      for (let q = 0; q < nPart; q++) {
        const pal = palabras ? palabras[q] : 0;
        if (!cuenta[q] && !pal) continue;
        lista.push({ p: partidos[q], n: cuenta[q], pal: Math.round(pal) });
        total += cuenta[q]; totalPal += pal;
      }
      lista.sort((a, b) => b.pal - a.pal || b.n - a.n || (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
      const resto = lista.slice(tope);
      return { con_partido: total, palabras: Math.round(totalPal), lista: lista.slice(0, tope),
        otros: resto.length ? { n: resto.reduce((s, x) => s + x.n, 0), pal: resto.reduce((s, x) => s + x.pal, 0), partidos: resto.length } : null };
    };
    let pesoTotal = 0;
    const pesoInterno = new Float64Array(nc);
    for (const [i, j, , , , w] of aristas) { pesoTotal += w; if (com[i] === com[j]) pesoInterno[com[i]] += w; }
    // Cuán característico de la biblioteca es cada tema: el G² medio de sus términos en el léxico. Ordenar por
    // cobertura, o por la suma del G², pondría primero los temas genéricos y grandes (lenguaje de dictamen, cifras
    // leídas), que tocan casi todas las intervenciones justamente por serlo.
    const temas = miembros.map((m, c) => ({
      id: c,
      etiqueta: m.slice(0, 3).map((i) => vocab[i].display).join(' · '),
      n_terminos: m.length,
      g2_lexico: redondea(m.reduce((x, i) => x + vocab[i].g2, 0), 1),
      g2_medio: redondea(m.reduce((x, i) => x + vocab[i].g2, 0) / Math.max(1, m.length), 1),
      terminos: m.map((i) => ({ i, term: vocab[i].term, display: vocab[i].display, expresion: vocab[i].expresion, fuerza_interna: redondea(interna[i], 3) })),
      intervenciones: cobertura[c],
      porcentaje: nDocs ? redondea(100 * cobertura[c] / nDocs, 1) : 0,
      peso_interno: redondea(pesoInterno[c], 3),
      partidos: repartoDe(porTema[c], palabrasTema[c], 25),
      lectura: topTema[c].map((x) => fila(x, c)),
    }))
      .sort((a, b) => b.g2_medio - a.g2_medio || b.intervenciones - a.intervenciones || a.id - b.id);
    // Las comunidades de uno o dos términos no son temas (nodos casi aislados): pasan a la lista de términos sueltos.
    const sueltos = [];
    for (const tm of temas.filter((x) => x.n_terminos < MIN_TEMA)) for (const t of tm.terminos) sueltos.push(t);
    temas.splice(0, temas.length, ...temas.filter((x) => x.n_terminos >= MIN_TEMA));
    // Renumerar los temas por su G² medio en el léxico, para que el primero sea el más característico de la biblioteca.
    const renum = new Int32Array(nc).fill(-1);
    temas.forEach((tm, k) => { renum[tm.id] = k; tm.id = k; });

    const global = topGlobal.map((x) => fila(x));
    const variada = [];
    const usados = new Set(), cursor = new Int32Array(temas.length);
    for (let vuelta = 0; variada.length < LECTURA_VARIADA; vuelta++) {
      let alguno = false;
      for (let k = 0; k < temas.length && variada.length < LECTURA_VARIADA; k++) {
        const lst = temas[k].lectura;
        while (cursor[k] < lst.length && usados.has(lst[cursor[k]].id)) cursor[k]++;
        if (cursor[k] >= lst.length) continue;
        const x = lst[cursor[k]++];
        usados.add(x.id); alguno = true;
        variada.push(Object.assign({ tema: k }, x));
      }
      if (!alguno) break;
    }
    const idsMeta = [...new Set([...global, ...variada, ...temas.flatMap((tm) => tm.lectura)].map((x) => x.id))];
    const metadatos = {};
    for (let k = 0; k < idsMeta.length; k += 500) {
      const lote = idsMeta.slice(k, k + 500);
      const filasMeta = R2.sql.filas(bd, `SELECT id, date, speaker, rep_name, party, session_type FROM speeches WHERE id IN (${lote.map(() => '?').join(',')})`, lote);
      for (const m of filasMeta) metadatos[m.id] = { date: m.date, speaker: m.speaker, rep_name: m.rep_name, party: m.party, session_type: m.session_type };
    }

    const nodos = vocab.map((v, i) => ({
      i, term: v.term, display: v.display, expresion: v.expresion, freq: v.freq, g2_lexico: redondea(v.g2, 2), df_unidad: dfUnidad[i],
      df_intervencion: dfDoc[i], comunidad: renum[com[i]], fuerza: redondea(fuerza[i], 3), grado: grado[i],
    }));
    const salidaAristas = aristas.map(([i, j, a, e, g2, w]) => ({ a: i, b: j, co: a, esperado: redondea(e, 3), g2: redondea(g2, 2), fuerza: redondea(w, 4) }));
    prog.emitir('red', 1, 0, 0, true);
    tiempos.total = ahora() - t0;

    return Object.assign(base, {
      nodos, aristas: salidaAristas, comunidades: temas, sueltos,
      partidos: Object.assign({ intervenciones: nDocs, palabras_totales: Math.round(palabrasTotales),
        palabras_con_partido: Math.round(palabrasConPartido) }, repartoDe(totalPartido, palabrasPartido, 60)),
      lectura: { global, variada, metadatos, longitud_media: redondea(longMedia, 1),
        metodo: { formula: 'BM25', k1: BM25_K1, b: BM25_B, peso_termino: 'ln(1 + G² del término en el léxico)' } },
      estadisticas: {
        n_intervenciones: nDocs, n_unidades: N, tokens: nTokens, pares_posibles: nPares, pares_observados: observados,
        densidad: nPares ? redondea(observados / nPares, 4) : 0, aristas_significativas: positivos,
        aristas_conservadas: aristas.length, n_comunidades: temas.length, n_comunidades_leiden: nc, n_sueltos: sueltos.length,
        modularidad: redondea(lei.modularidad, 4),
        calidad: redondea(lei.calidad, 4), peso_total: redondea(pesoTotal, 3),
        memoria_recuento_bytes: co.byteLength,
      },
      leiden: lei.parametros,
      tiempos_ms: Object.fromEntries(Object.entries(tiempos).map(([k, v]) => [k, Math.round(v)])),
    });
  }

  R2.coocurrencia = Object.freeze({ red, lenguaDe, vaciasDe, fuenteVacias, DEFECTOS, FASES });
})(globalThis.R2 = globalThis.R2 || {});

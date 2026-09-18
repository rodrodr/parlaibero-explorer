/* ===== src/shared/query.js ===== */
/* 2REP_Standalone · shared/query.js
 *
 * Sintaxis de la búsqueda por palabras de 2REP_Standalone y su traducción a FTS5. Corre en el worker (búsqueda, stats,
 * «Guardar todo») y en el hilo principal (resaltado, «Se busca: …», términos de Tendencia): el mismo código en los dos.
 *
 * Gramática
 *   orExpr  := andExpr ('|' andExpr)*
 *   andExpr := primary ('+'? primary)*          dos términos seguidos sin operador equivalen a +
 *   primary := WORD | PHRASE | '(' orExpr ')'
 *   + tiene prioridad sobre |: «a b | c» es (a + b) | c.
 *
 * Léxico (sobre el texto normalizado: NFC y « » “ ” „ → ")
 *   PHRASE  "…" hasta la comilla siguiente;  + | ( )  operadores y paréntesis;  espacio = str.isspace de Python;
 *   WORD    cualquier otra racha de caracteres. Una WORD con puntuación («art.26») se divide con la tokenización de FTS5
 *           y se busca como frase («"art 26"»).
 *
 * Reglas
 *   - Cada hoja se emite entre comillas con sus tokens separados por un espacio (anula NEAR, ^, * y col:); cada nodo
 *     interior, entre paréntesis y con AND u OR explícitos; la raíz, sin paréntesis. Los grupos del mismo operador se
 *     aplanan y los de un solo elemento se deshacen.
 *   - Palabras vacías (R2.gen.vacias.VACIAS): una WORD de un solo token cuyo pliegue está en VACIAS se omite en un grupo
 *     + si en ese grupo queda otro término. Nunca se omite dentro de una frase, entre paréntesis propios «(de)», sola en
 *     una rama | ni cuando todo el grupo son palabras vacías («de la» se busca tal cual). Se avisa.
 *   - Una hoja sin ningún token (solo signos: «-», "…") se ignora y se avisa; si no queda nada, es error.
 *   - Errores (en español, con posición en el texto normalizado): asterisco, AND/OR/NOT en mayúsculas, comillas vacías o
 *     sin cerrar, operador al principio o al final, dos operadores seguidos, paréntesis vacíos o descompensados y nada
 *     buscable. Se informa del primero de izquierda a derecha.
 *
 * API (R2.query)
 *   analizar(texto) → { ok, vacia, error: null | {codigo, mensaje, posicion}, fts, interpretacion, avisos: [texto],
 *                       omitidas: [texto], ignoradas: [texto], terminos: [texto], normalizado }
 *   interpretar(texto)       lo mismo que analizar (memorizado): lo usa la línea «Se busca: …» de la interfaz
 *   queryTerms(texto)        términos a resaltar: cada uno, los tokens plegados de una hoja separados por un espacio
 *   termRanges(raw, terms)   rangos [a, b) de las secuencias consecutivas de tokens de cada término, fusionados y ordenados
 *   seedTerms(texto, max=8)  términos de Tendencia sembrados desde la caja de búsqueda
 *   parseTerms(texto)        ngram.parse_terms de Python (comas fuera de comillas)
 *   MENSAJES
 */
(function (R2) {
  'use strict';

  const T = R2.tokenize;
  const V = R2.gen && R2.gen.vacias;
  if (!T || !V || !Array.isArray(V.VACIAS)) {
    throw new Error('shared/query.js necesita R2.tokenize (shared/tokenize.js) y R2.gen.vacias (engine/generated/vacias.js), cargados antes en src/orden.json');
  }
  const VACIAS = new Set(V.VACIAS);

  // str.isspace() de Python 3.12.
  const ESPACIOS = new Set([0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x1C, 0x1D, 0x1E, 0x1F, 0x20, 0x85, 0xA0, 0x1680,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F,
    0x3000]);
  const esEspacio = (u) => ESPACIOS.has(u);
  const COMILLAS = /[«»“”„]/g;

  const MENSAJES = Object.freeze({
    ASTERISCO: 'El asterisco (*) no se admite en esta búsqueda: escriba la palabra completa o varias formas unidas con | (p. ej. agrario | agraria).',
    OPERADOR_TEXTO: (w) => `«${w}» no es un operador en esta búsqueda. Use + para exigir varias palabras y | para admitir cualquiera de ellas; NOT no está disponible. Si quiere buscar la palabra, escríbala en minúsculas.`,
    COMILLAS_VACIAS: 'Hay unas comillas vacías: escriba la frase entre ellas o quítelas.',
    COMILLAS_ABIERTAS: 'Faltan unas comillas de cierre: cada frase exacta va entre dos comillas (p. ej. "voto femenino").',
    PARENTESIS_VACIOS: 'Hay unos paréntesis vacíos: escriba algo dentro o quítelos.',
    FALTA_CIERRE: 'Falta cerrar un paréntesis: añada «)».',
    SOBRA_CIERRE: 'Sobra un paréntesis de cierre «)» (o falta el de apertura).',
    OP_INICIO: (op) => `Falta una palabra o frase antes de «${op}».`,
    OP_FINAL: (op) => `Falta una palabra o frase después de «${op}».`,
    OP_SEGUIDOS: (a, b) => `Hay dos operadores seguidos («${a} ${b}»): escriba una palabra o frase entre ellos.`,
    NADA: 'La consulta no contiene nada que buscar: escriba al menos una palabra con letras o cifras.',
    AVISO_OMITIDAS: (lista) => `Se han omitido palabras muy frecuentes (${lista}): casi todas las intervenciones las contienen. Si las necesita, póngalas entre comillas.`,
    AVISO_IGNORADAS: (lista, n) => `Se ${n === 1 ? 'ha ignorado un término' : 'han ignorado términos'} sin letras ni cifras (${lista}).`,
  });

  class ErrorConsulta extends Error {
    constructor(codigo, mensaje, posicion) {
      super(mensaje);
      this.name = 'ErrorConsulta';
      this.codigo = codigo;
      this.posicion = posicion;
    }
  }
  const fallo = (codigo, posicion, ...args) => {
    const m = MENSAJES[codigo];
    return new ErrorConsulta(codigo, typeof m === 'function' ? m(...args) : m, posicion);
  };

  function normalizar(texto) {
    let s = texto == null ? '' : String(texto);
    try { s = s.normalize('NFC'); } catch (e) { /* sustitutos sueltos: se deja tal cual */ }
    return s.replace(COMILLAS, '"');
  }

  // ------------------------------------------------------------------------------------------------ léxico
  const ESPECIALES = '"+|()*';

  /** Lexemas: {tipo: 'palabra'|'frase'|'+'|'|'|'('|')'|'error', texto, a, b, desde, error}. No lanza: los errores léxicos
   *  van como lexemas 'error' para que el analizador informe del primero de izquierda a derecha. */
  function lexemas(s) {
    const out = [];
    const n = s.length;
    let i = 0;
    while (i < n) {
      const u = s.charCodeAt(i);
      if (esEspacio(u)) { i++; continue; }
      const ch = s[i];
      if (ch === '"') {
        const j = s.indexOf('"', i + 1);
        if (j < 0) { out.push({ tipo: 'error', a: i, b: n, error: fallo('COMILLAS_ABIERTAS', i) }); break; }
        const dentro = s.slice(i + 1, j);
        const ast = dentro.indexOf('*');
        if (ast >= 0) out.push({ tipo: 'error', a: i, b: j + 1, error: fallo('ASTERISCO', i + 1 + ast) });
        else if (![...dentro].some((c) => !esEspacio(c.charCodeAt(0)))) out.push({ tipo: 'error', a: i, b: j + 1, error: fallo('COMILLAS_VACIAS', i) });
        else out.push({ tipo: 'frase', texto: dentro, a: i, b: j + 1, desde: i + 1 });
        i = j + 1;
        continue;
      }
      if (ch === '*') { out.push({ tipo: 'error', a: i, b: i + 1, error: fallo('ASTERISCO', i) }); i++; continue; }
      if (ch === '+' || ch === '|' || ch === '(' || ch === ')') { out.push({ tipo: ch, a: i, b: i + 1 }); i++; continue; }
      let j = i;
      while (j < n && !esEspacio(s.charCodeAt(j)) && ESPECIALES.indexOf(s[j]) < 0) j++;
      const w = s.slice(i, j);
      if (w === 'AND' || w === 'OR' || w === 'NOT') out.push({ tipo: 'error', a: i, b: j, error: fallo('OPERADOR_TEXTO', i, w) });
      else out.push({ tipo: 'palabra', texto: w, a: i, b: j, desde: i });
      i = j;
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------------ sintaxis
  function analizarSintaxis(s, L) {
    let k = 0;
    const fin = { tipo: 'fin', a: s.length, b: s.length };
    const ver = () => (k < L.length ? L[k] : fin);
    const esOp = (t) => t && (t.tipo === '+' || t.tipo === '|');

    function sinPrimario() {
      const t = ver();
      const p = k > 0 ? L[k - 1] : null;
      if (t.tipo === 'error') throw t.error;
      if (esOp(t)) {
        if (esOp(p)) throw fallo('OP_SEGUIDOS', t.a, p.tipo, t.tipo);
        throw fallo('OP_INICIO', t.a, t.tipo);
      }
      if (t.tipo === ')') {
        if (p && p.tipo === '(') throw fallo('PARENTESIS_VACIOS', p.a);
        if (esOp(p)) throw fallo('OP_FINAL', p.a, p.tipo);
        throw fallo('SOBRA_CIERRE', t.a);
      }
      if (esOp(p)) throw fallo('OP_FINAL', p.a, p.tipo);
      if (p && p.tipo === '(') throw fallo('FALTA_CIERRE', p.a);
      throw fallo('NADA', 0);
    }

    function hoja(t) {
      const toks = T.tokens(t.texto).map((x) => ({ t: x.t, a: x.a + t.desde, b: x.b + t.desde }));
      return { tipo: t.tipo, texto: t.texto, a: t.a, b: t.b, tokens: toks };
    }

    function primario() {
      const t = ver();
      if (t.tipo === 'palabra' || t.tipo === 'frase') { k++; return hoja(t); }
      if (t.tipo === '(') {
        k++;
        const dentro = orExpr();
        const c = ver();
        if (c.tipo !== ')') {
          if (c.tipo === 'error') throw c.error;
          throw fallo('FALTA_CIERRE', t.a);
        }
        k++;
        return { tipo: 'grupo', hijo: dentro, a: t.a, b: c.b };
      }
      return sinPrimario();
    }

    function andExpr() {
      const hijos = [primario()];
      for (;;) {
        const t = ver();
        if (t.tipo === '+') { k++; hijos.push(primario()); continue; }
        if (t.tipo === 'palabra' || t.tipo === 'frase' || t.tipo === '(' || t.tipo === 'error') { hijos.push(primario()); continue; }
        return { tipo: 'y', hijos };
      }
    }

    function orExpr() {
      const hijos = [andExpr()];
      while (ver().tipo === '|') { k++; hijos.push(andExpr()); }
      return { tipo: 'o', hijos };
    }

    const arbol = orExpr();
    const resto = ver();
    if (resto.tipo === ')') throw fallo('SOBRA_CIERRE', resto.a);
    if (resto.tipo === 'error') throw resto.error;
    return arbol;
  }

  // ------------------------------------------------------------------------------------------------ simplificación
  const textoHoja = (h) => (h.tipo === 'frase' ? `"${h.texto}"` : h.texto);

  function simplificar(nodo, info) {
    switch (nodo.tipo) {
      case 'palabra':
      case 'frase':
        if (!nodo.tokens.length) { info.ignoradas.push(textoHoja(nodo)); return null; }
        return nodo;
      case 'grupo': {
        const h = simplificar(nodo.hijo, info);
        if (h) h.protegido = true;
        return h;
      }
      case 'y': {
        let hijos = nodo.hijos.map((h) => simplificar(h, info)).filter(Boolean);
        const esVacia = (h) => h.tipo === 'palabra' && !h.protegido && h.tokens.length === 1 && VACIAS.has(h.tokens[0].t);
        if (hijos.some((h) => !esVacia(h))) {
          for (const h of hijos) if (esVacia(h)) info.omitidas.push(h.texto);
          hijos = hijos.filter((h) => !esVacia(h));
        }
        return combinar('y', hijos);
      }
      case 'o':
        return combinar('o', nodo.hijos.map((h) => simplificar(h, info)).filter(Boolean));
      default:
        throw new Error(`query: nodo desconocido ${nodo.tipo}`);
    }
  }

  function combinar(tipo, hijos) {
    const planos = [];
    for (const h of hijos) {
      if (h.tipo === tipo) planos.push(...h.hijos);
      else planos.push(h);
    }
    if (!planos.length) return null;
    if (planos.length === 1) return planos[0];
    return { tipo, hijos: planos };
  }

  // ------------------------------------------------------------------------------------------------ salida
  const originales = (s, h) => h.tokens.map((x) => s.slice(x.a, x.b)).join(' ');

  function fts(s, nodo) {
    if (nodo.tipo === 'palabra' || nodo.tipo === 'frase') return `"${originales(s, nodo)}"`;
    return nodo.hijos.map((h) => (h.tipo === 'y' || h.tipo === 'o' ? `(${fts(s, h)})` : fts(s, h))).join(nodo.tipo === 'y' ? ' AND ' : ' OR ');
  }

  function interpretacion(s, nodo) {
    if (nodo.tipo === 'palabra' || nodo.tipo === 'frase') {
      return nodo.tipo === 'palabra' && nodo.tokens.length === 1 ? originales(s, nodo) : `«${originales(s, nodo)}»`;
    }
    return nodo.hijos.map((h) => (h.tipo === 'y' || h.tipo === 'o' ? `(${interpretacion(s, h)})` : interpretacion(s, h))).join(nodo.tipo === 'y' ? ' Y ' : ' O ');
  }

  function hojas(nodo, out = []) {
    if (nodo.tipo === 'palabra' || nodo.tipo === 'frase') out.push(nodo);
    else for (const h of nodo.hijos) hojas(h, out);
    return out;
  }

  const unicos = (lista) => [...new Set(lista)];

  function analizarSinMemo(texto) {
    const normalizado = normalizar(texto);
    const res = { ok: true, vacia: false, error: null, fts: '', interpretacion: '', avisos: [], omitidas: [], ignoradas: [],
      terminos: [], normalizado };
    const L = lexemas(normalizado);
    if (!L.length) { res.vacia = true; return res; }
    try {
      const info = { omitidas: [], ignoradas: [] };
      const arbol = simplificar(analizarSintaxis(normalizado, L), info);
      res.omitidas = unicos(info.omitidas);
      res.ignoradas = unicos(info.ignoradas);
      if (!arbol) throw fallo('NADA', 0);
      res.fts = fts(normalizado, arbol);
      res.interpretacion = interpretacion(normalizado, arbol);
      res.terminos = unicos(hojas(arbol).map((h) => h.tokens.map((x) => x.t).join(' ')));
      if (res.omitidas.length) res.avisos.push(MENSAJES.AVISO_OMITIDAS(res.omitidas.join(', ')));
      if (res.ignoradas.length) res.avisos.push(MENSAJES.AVISO_IGNORADAS(res.ignoradas.join(' '), res.ignoradas.length));
      res.arbol = arbol;
    } catch (e) {
      if (!(e instanceof ErrorConsulta)) throw e;
      res.ok = false;
      res.error = { codigo: e.codigo, mensaje: e.message, posicion: e.posicion };
      res.fts = '';
      res.interpretacion = '';
      res.terminos = [];
      res.avisos = [];
    }
    return res;
  }

  // Memoria de los últimos análisis: la interfaz pide los términos de la misma consulta muchas veces al pintar.
  const MEMO_MAX = 16;
  const memo = new Map();
  function analizar(texto) {
    const clave = texto == null ? '' : String(texto);
    let r = memo.get(clave);
    if (r) { memo.delete(clave); memo.set(clave, r); return r; }
    r = analizarSinMemo(clave);
    memo.set(clave, r);
    if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value);
    return r;
  }

  function queryTerms(texto) {
    const r = analizar(texto);
    return r.ok ? r.terminos.slice() : [];
  }

  /** Rangos [a, b) de `raw` donde aparece cada término como secuencia consecutiva de tokens; fusionados y ordenados. */
  function termRanges(raw, terms) {
    if (!raw || !terms || !terms.length) return [];
    const porPrimero = new Map();
    for (const term of terms) {
      // Los términos de queryTerms ya vienen plegados; se vuelven a tokenizar para admitir también texto sin plegar
      // («femenino votó») o listas de palabras. Plegar dos veces da lo mismo.
      const seq = (Array.isArray(term) ? term : [term]).flatMap((x) => T.tokens(String(x)).map((tk) => tk.t));
      if (!seq.length) continue;
      let l = porPrimero.get(seq[0]);
      if (!l) porPrimero.set(seq[0], (l = []));
      l.push(seq);
    }
    if (!porPrimero.size) return [];
    const toks = T.tokens(raw);
    const marcas = [];
    for (let i = 0; i < toks.length; i++) {
      const cands = porPrimero.get(toks[i].t);
      if (!cands) continue;
      for (const seq of cands) {
        if (i + seq.length > toks.length) continue;
        let ok = true;
        for (let j = 1; j < seq.length; j++) if (toks[i + j].t !== seq[j]) { ok = false; break; }
        if (ok) marcas.push([toks[i].a, toks[i + seq.length - 1].b]);
      }
    }
    marcas.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const fusion = [];
    for (const m of marcas) {
      const u = fusion[fusion.length - 1];
      if (u && m[0] <= u[1]) u[1] = Math.max(u[1], m[1]);
      else fusion.push([m[0], m[1]]);
    }
    return fusion;
  }

  // ------------------------------------------------------------------------------------------------ Tendencia
  function stripPy(s) {
    let a = 0, b = s.length;
    while (a < b && esEspacio(s.charCodeAt(a))) a++;
    while (b > a && esEspacio(s.charCodeAt(b - 1))) b--;
    return s.slice(a, b);
  }

  /** ngram.parse_terms(texto) de Python para un texto: trozos separados por comas fuera de comillas. */
  function parseTerms(texto) {
    if (texto == null) return [];
    const s = String(texto).replace(COMILLAS, '"');
    const nComillas = (s.match(/"/g) || []).length;
    const sinCerrar = nComillas % 2 ? s.lastIndexOf('"') : -1;
    const trozos = [];
    let actual = '', dentro = false;
    for (let k = 0; k < s.length; k++) {
      const ch = s[k];
      if (ch === '"' && k !== sinCerrar) dentro = !dentro;
      if (ch === ',' && !dentro) { trozos.push(actual); actual = ''; }
      else actual += ch;
    }
    trozos.push(actual);
    return trozos.map(stripPy).filter(Boolean);
  }

  /**
   * Términos de Tendencia desde la caja de búsqueda (la regla de search.seed_terms con la sintaxis nueva):
   *   - con comas fuera de comillas, cada trozo es un término (ngram.parse_terms);
   *   - si no, cada frase entre comillas y cada palabra de contenido; los operadores (+ | paréntesis) separan y no cuentan;
   *     AND/OR/NOT en mayúsculas no cuentan (y lo que sigue a NOT tampoco); las palabras vacías se omiten; una palabra con
   *     puntuación va como frase («"art 26"»); «republic*» se conserva para Tendencia, que sí admite el asterisco.
   *   Nunca falla: con una consulta mal formada siembra lo que se pueda leer. Como mucho `max`, sin repetir (sin tildes
   *   ni mayúsculas).
   */
  function seedTerms(texto, max = 8) {
    const q = stripPy(normalizar(texto));
    if (!q) return [];
    let brutos = [];
    if (q.replace(/"[^"]*"/g, '').includes(',')) {
      brutos = parseTerms(q);
    } else {
      let saltar = false;
      const n = q.length;
      let i = 0;
      while (i < n) {
        const u = q.charCodeAt(i);
        if (esEspacio(u) || '+|()'.indexOf(q[i]) >= 0) { i++; continue; }
        if (q[i] === '"') {
          let j = q.indexOf('"', i + 1);
          if (j < 0) j = n;
          const toks = T.tokens(q.slice(i + 1, j));
          if (saltar) saltar = false;
          else if (toks.length) brutos.push(`"${toks.map((x) => q.slice(i + 1 + x.a, i + 1 + x.b)).join(' ')}"`);
          i = j + 1;
          continue;
        }
        let j = i;
        while (j < n && !esEspacio(q.charCodeAt(j)) && '"+|()'.indexOf(q[j]) < 0) j++;
        const w = q.slice(i, j);
        i = j;
        if (w === 'AND' || w === 'OR' || w === 'NOT') { saltar = w === 'NOT'; continue; }
        if (saltar) { saltar = false; continue; }
        const toks = T.tokens(w);
        if (!toks.length) continue;
        if (toks.length === 1) {
          if (VACIAS.has(toks[0].t)) continue;
          brutos.push(w.slice(toks[0].a, toks[0].b) + (w.endsWith('*') ? '*' : ''));
        } else {
          brutos.push(`"${toks.map((x) => w.slice(x.a, x.b)).join(' ')}"`);
        }
      }
    }
    const out = [], vistos = new Set();
    for (const t of brutos) {
      const clave = T.plegarLibre(t);
      if (!vistos.has(clave)) { vistos.add(clave); out.push(t); }
    }
    return out.slice(0, Math.max(0, max));
  }

  R2.query = Object.freeze({
    MENSAJES, ErrorConsulta, normalizar, lexemas, analizar, interpretar: analizar, queryTerms, termRanges, seedTerms,
    parseTerms, hojas,
  });
})(globalThis.R2 = globalThis.R2 || {});

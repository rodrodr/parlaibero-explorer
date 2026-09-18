/* ===== src/engine/router.js ===== */
/* 2REP_Standalone · engine/router.js
 *
 * Enrutador genérico de la API /api en el worker (M4): el adaptador del hilo principal (shim/api-shim.js) manda cada
 * petición como op «api» {metodo, ruta, query, queryLista, cuerpoTexto} y worker/principal.js la despacha aquí.
 *
 * Rutas: R2.router.registrar(metodo, patron, manejador, { prioridad: 'interactiva' | 'fondo', corpus: true | false })
 *   patron   '/collections/{cid}/items' (sin /api). Un parámetro {x} casa con un segmento no vacío cualquiera: el tipo lo
 *            valida el manejador (en FastAPI, «/collections/abc» es 422, no 404).
 *   corpus   si la ruta necesita el corpus construido (por defecto sí): antes de «listo» responde 503.
 *   Registrar otra vez el mismo método y patrón sustituye el manejador conservando su puesto (así las rutas «próxima
 *   versión» se sustituyen al implementarse; también desde otros módulos, p. ej. rutas_biblioteca.js).
 *   Se casa como Starlette: en orden de registro; la primera ruta que casa en ruta y método gana; si alguna casa en ruta
 *   pero no en método, 405; si ninguna casa, 404.
 *
 * Manejador: async (pet, ctx) → cuerpo JSON | new R2.router.Respuesta(cuerpo, { status, tipo, cabeceras })
 *   pet = { metodo, ruta, params, query, queryLista, cuerpo }   (cuerpo: JSON ya analizado o null)
 *   ctx = { db, sqlite3, corpusListo, corpus: { nombre, n_speeches }, nucleo, cache, servicios, ceder(), cancelada,
 *           presupuestoMs }   (lo construye principal.js)
 *   Errores: throw new R2.router.ErrorHttp(status, mensaje) → {status, cuerpo: {error: mensaje}}. Cualquier otra excepción
 *   sale del despacho (principal.js responde 500 «Error interno: …»).
 *
 * Errores del enrutador (mismos textos que server.py): 404 «No existe ese recurso.», 405 «Método no permitido en esta
 * ruta.», 422 cuerpo que no es JSON («Parametros no validos. JSON decode error»), 501 «Esta función llega en una próxima
 * versión de 2REP_Standalone.» (rutas del escritorio que aún no están), 503 corpus no listo.
 *
 * Validación (R2.router.validar), port de server.py/search.py: entero (_entero), texto (_texto), num (_num), cuerpo
 * (_body), ids (_ids), cap (_cap), orden (orden_valido). 422 = ParametroNoValido; 400 = SolicitudNoValida.
 *
 * Servicios entre módulos: R2.router.servicios.biblioteca lo pone el módulo de bibliotecas con los métodos (síncronos o
 * con promesa) get_collection(cid), collection_existio(cid), item_ids(cid, corpus) y membership(corpus, ids), con la
 * semántica de library.py; la búsqueda los usa para filters.collection_id y membership.
 */
(function (R2) {
  'use strict';

  const MSG_PROXIMA = 'Esta función llega en una próxima versión de 2REP_Standalone.';
  const MSG_NO_LISTO = 'El corpus todavía no está listo.';
  const MSG_MODO_NO_DISPONIBLE = 'La búsqueda por significado no está disponible en esta versión.';
  const MSG_JSON = 'Parametros no validos. JSON decode error';
  const TEXTO_HTTP = Object.freeze({ 404: 'No existe ese recurso.', 405: 'Método no permitido en esta ruta.' });
  const ENTERO_MAX = 9223372036854775807n;
  const MAX_SEGURO = 9007199254740991n;
  const ORDENES = Object.freeze(['relevance', 'date_asc', 'date_desc', 'length_desc', 'length_asc']);

  class ErrorHttp extends Error {
    constructor(status, mensaje) {
      super(mensaje);
      this.name = 'ErrorHttp';
      this.status = status;
    }
  }
  const esErrorHttp = (e) => !!e && e.name === 'ErrorHttp' && Number.isInteger(e.status);

  class Respuesta {
    constructor(cuerpo, opciones = {}) {
      this.cuerpo = cuerpo;
      this.status = opciones.status || 200;
      this.tipo = opciones.tipo || 'json';
      this.cabeceras = opciones.cabeceras || {};
    }
  }

  const noValido = (m) => new ErrorHttp(422, m);
  const solicitud = (m) => new ErrorHttp(400, m);

  const esDict = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !ArrayBuffer.isView(v);
  const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  /** dict.get(k) de Python sobre un objeto JSON: undefined si no está (None). */
  const get = (o, k) => (o && tiene(o, k) ? o[k] : undefined);

  function repr(v) {
    const C = R2.py && R2.py.core;
    return C ? C.pyRepr(v === undefined ? null : v) : JSON.stringify(v);
  }

  // ------------------------------------------------------------------------------------------------ validación
  /** int(v) de Python para un valor JSON, o null si Python daría TypeError, ValueError u OverflowError. */
  function aEntero(v) {
    if (v === null || v === undefined || typeof v === 'boolean') return null;
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number') return Number.isFinite(v) && Number.isInteger(v) ? BigInt(v) : null;
    if (typeof v === 'string') {
      if (!R2.transformar || typeof R2.transformar.pyInt !== 'function') throw new Error('R2.router necesita R2.transformar.pyInt');
      try {
        const r = R2.transformar.pyInt(v);
        return typeof r === 'bigint' ? r : BigInt(r);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  const aNumero = (n) => (n >= -MAX_SEGURO && n <= MAX_SEGURO ? Number(n) : n);

  /** search._entero: entero de un valor JSON (número o texto con cifras) o 422. */
  function entero(v, campo, lo = -ENTERO_MAX, hi = ENTERO_MAX) {
    const n = aEntero(v);
    if (n === null) throw noValido(`${campo} debe ser un número entero (recibido: ${repr(v)}).`);
    if (n < BigInt(lo) || n > BigInt(hi)) throw noValido(`${campo} está fuera de rango (${lo}–${hi}).`);
    return aNumero(n);
  }

  /** server._texto: campo de texto; ausente o null → defecto; otro tipo → 422. */
  function texto(cuerpo, clave, defecto = '') {
    const v = get(cuerpo, clave);
    if (v === undefined || v === null) return defecto;
    if (typeof v !== 'string') throw noValido(`${clave} debe ser un texto.`);
    return v;
  }

  /** server._num: entero recortado a [lo, hi]; ausente, null o "" → defecto. */
  function num(cuerpo, clave, defecto, lo, hi) {
    const v = get(cuerpo, clave);
    if (v === undefined || v === null || v === '') return defecto;
    let n = BigInt(entero(v, clave));
    if (n > BigInt(hi)) n = BigInt(hi);
    if (n < BigInt(lo)) n = BigInt(lo);
    return aNumero(n);
  }

  /** server._body: None → {}; lo que no es un objeto JSON → 422. */
  function cuerpo(b) {
    if (b === undefined || b === null) return {};
    if (!esDict(b)) throw new ErrorHttp(422, 'El cuerpo de la petición debe ser un objeto JSON.');
    return b;
  }

  /** server._ids: lista de enteros ≥ 0. */
  function ids(v, campo) {
    if (!Array.isArray(v)) throw noValido(`${campo} debe ser una lista de ids.`);
    return v.map((x) => entero(x, campo, 0));
  }

  /** server._cap: tope opcional en 1..n_speeches. */
  function cap(b, nSpeeches) {
    const v = get(b, 'cap');
    if (v === undefined || v === null || v === '') return null;
    return entero(v, 'cap', 1, Math.max(1, Number(nSpeeches) || 0));
  }

  /** search.orden_valido. */
  function orden(v) {
    if (v === undefined || v === null || v === '') return 'relevance';
    if (typeof v !== 'string' || !ORDENES.includes(v)) {
      throw noValido(`order debe ser relevance, date_asc, date_desc, length_desc o length_asc (recibido: ${repr(v)}).`);
    }
    return v;
  }

  // ------------------------------------------------------------------------------------------------ rutas
  const RUTAS = [];

  function compilar(patron) {
    if (typeof patron !== 'string' || !patron.startsWith('/')) throw new TypeError(`R2.router: patrón no válido: ${patron}`);
    return patron.split('/').slice(1).map((p) => (/^\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(p) ? { param: p.slice(1, -1) } : { literal: p }));
  }

  function registrar(metodo, patron, manejador, opciones = {}) {
    if (typeof manejador !== 'function') throw new TypeError(`R2.router.registrar(${metodo} ${patron}): falta el manejador`);
    const def = {
      metodo: String(metodo).toUpperCase(),
      patron,
      partes: compilar(patron),
      manejador,
      prioridad: opciones.prioridad === 'fondo' ? 'fondo' : 'interactiva',
      corpus: opciones.corpus !== false,
    };
    const i = RUTAS.findIndex((r) => r.metodo === def.metodo && r.patron === patron);
    if (i >= 0) RUTAS[i] = def;
    else RUTAS.push(def);
    return def;
  }

  function decodificar(seg) {
    try { return decodeURIComponent(seg); } catch (e) { return seg; }
  }

  function casar(partes, segs) {
    if (partes.length !== segs.length) return null;
    const params = {};
    for (let i = 0; i < partes.length; i++) {
      const p = partes[i];
      if (p.literal !== undefined) {
        if (segs[i] !== p.literal) return null;
      } else {
        if (segs[i] === '') return null;
        params[p.param] = segs[i];
      }
    }
    return params;
  }

  /** { def, params, ruta } si casa; { status: 404 | 405 } si no. */
  function buscar(metodo, ruta) {
    let r = String(ruta || '/').split('#')[0].split('?')[0];
    if (!r.startsWith('/')) r = `/${r}`;
    if (r.length > 1 && r.endsWith('/')) r = r.slice(0, -1);
    const segs = r.split('/').slice(1).map(decodificar);
    const m = String(metodo || 'GET').toUpperCase();
    let enRuta = false;
    for (const def of RUTAS) {
      const params = casar(def.partes, segs);
      if (!params) continue;
      if (def.metodo === m) return { def, params, ruta: `/${segs.join('/')}` };
      enRuta = true;
    }
    return { status: enRuta ? 405 : 404 };
  }

  function prioridad(metodo, ruta) {
    const r = buscar(metodo, ruta);
    return r.def ? r.def.prioridad : 'interactiva';
  }

  async function despachar(pet, ctx = {}) {
    const metodo = String((pet && pet.metodo) || 'GET').toUpperCase();
    const r = buscar(metodo, pet && pet.ruta);
    if (!r.def) return { status: r.status, cuerpo: { error: TEXTO_HTTP[r.status] }, tipo: 'json', cabeceras: {} };
    try {
      if (r.def.corpus && ctx.corpusListo === false) throw new ErrorHttp(503, MSG_NO_LISTO);
      let c = pet.cuerpo;
      if (c === undefined && typeof pet.cuerpoTexto === 'string' && pet.cuerpoTexto !== '') {
        try { c = JSON.parse(pet.cuerpoTexto); } catch (e) { throw new ErrorHttp(422, MSG_JSON); }
      }
      const res = await r.def.manejador({
        metodo, ruta: r.ruta, params: r.params, query: pet.query || {}, queryLista: pet.queryLista || [],
        cuerpo: c === undefined ? null : c,
      }, ctx);
      if (res instanceof Respuesta) return { status: res.status, cuerpo: res.cuerpo, tipo: res.tipo, cabeceras: res.cabeceras };
      return { status: 200, cuerpo: res, tipo: 'json', cabeceras: {} };
    } catch (e) {
      if (esErrorHttp(e)) return { status: e.status, cuerpo: { error: e.message }, tipo: 'json', cabeceras: {} };
      throw e;
    }
  }

  const proxima = () => { throw new ErrorHttp(501, MSG_PROXIMA); };

  // Rutas del escritorio que Standalone atenderá (en el orden de server.py). Las que ya existen en esta versión las
  // sustituyen info.js, search.js y el módulo de bibliotecas; las demás responden 501. Las exclusivas del escritorio
  // (abrir otro corpus, búsqueda por vectores) no se registran: 404.
  const PROXIMAS = [
    ['GET', '/info'], ['GET', '/facets'], ['POST', '/search'], ['POST', '/climate'], ['POST', '/stats'],
    ['GET', '/speech/{sid}'], ['GET', '/session/outline/{sid}'], ['GET', '/session/texts'], ['POST', '/ngram'],
    ['GET', '/collections/{cid}/keyness'], ['GET', '/careo/{sid}'], ['GET', '/session'],
    ['GET', '/collections'], ['POST', '/collections'], ['PATCH', '/collections/{cid}'], ['DELETE', '/collections/{cid}'],
    ['GET', '/collections/{cid}/items'], ['POST', '/collections/{cid}/items'], ['POST', '/collections/{cid}/items/remove'],
    ['PATCH', '/collections/{cid}/items/{sid}'], ['GET', '/searches'], ['POST', '/searches'], ['DELETE', '/searches/{sid}'],
    ['POST', '/export'], ['POST', '/export/estimate'], ['POST', '/import'],
  ];
  for (const [m, p] of PROXIMAS) registrar(m, p, proxima, { corpus: false });

  R2.router = Object.freeze({
    MSG_PROXIMA, MSG_NO_LISTO, MSG_MODO_NO_DISPONIBLE, MSG_JSON, TEXTO_HTTP, ORDENES, ENTERO_MAX,
    ErrorHttp, Respuesta, esErrorHttp, noValido, solicitud,
    registrar, buscar, prioridad, despachar, rutas: () => RUTAS.map((r) => ({ metodo: r.metodo, patron: r.patron, prioridad: r.prioridad, corpus: r.corpus })),
    esDict, get,
    validar: Object.freeze({ entero, texto, num, cuerpo, ids, cap, orden, aEntero }),
    /** Servicios entre módulos del worker (mutable): { biblioteca }. */
    servicios: { biblioteca: null },
  });
})(globalThis.R2 = globalThis.R2 || {});

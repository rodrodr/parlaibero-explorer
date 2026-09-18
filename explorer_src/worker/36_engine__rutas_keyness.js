/* ===== src/engine/rutas_keyness.js ===== */
/* 2REP_Standalone · engine/rutas_keyness.js
 *
 * GET /collections/{cid}/keyness (Léxico de una biblioteca), port de server.api_collection_keyness:
 *   cid (ruta, int) · min_freq 1..1000 (5) · limit 1..20000 (500) · limit_negative 0..1000 (50) · solo_discurso bool (true)
 *   404 «No existe esa biblioteca.» · 422 con los mensajes de pydantic («Parametros no validos. limit: …»)
 * La biblioteca es la vigente de R2.library (la abre rutas_biblioteca.js si aún no existe); el corpus de los ítems es
 * ctx.corpus.nombre. El cálculo es R2.partition.keynessColeccion (search.Corpus.keyness).
 */
(function (R2) {
  'use strict';

  const RT = R2.router;
  const L = R2.library;
  const RB = R2.rutasBiblioteca;
  if (!RT || !L || !RB || !R2.partition || !R2.keyness) {
    throw new Error('engine/rutas_keyness.js necesita R2.router, R2.library, R2.rutasBiblioteca, R2.keyness y R2.partition (src/orden.json)');
  }
  const ErrorHttp = RT.ErrorHttp;
  const MSG_BOOL = 'Input should be a valid boolean, unable to interpret input';
  const VERDAD = new Set(['1', 'on', 't', 'true', 'y', 'yes']);
  const FALSO = new Set(['0', 'off', 'f', 'false', 'n', 'no']);
  const get = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
  const nada = (v) => v === undefined || v === null;

  function parametros(pet) {
    const defs = [
      ['ruta', 'cid', {}],
      ['consulta', 'min_freq', { defecto: 5, ge: 1, le: 1000 }],
      ['consulta', 'limit', { defecto: 500, ge: 1, le: 20000 }],
      ['consulta', 'limit_negative', { defecto: 50, ge: 0, le: 1000 }],
      ['consulta', 'solo_discurso', { defecto: true, bool: true }],
    ];
    const out = {}, errores = [];
    for (const [origen, nombre, reglas] of defs) {
      const bruto = origen === 'ruta' ? get(pet.params, nombre) : get(pet.query, nombre);
      if (nada(bruto)) { out[nombre] = reglas.defecto; continue; }
      if (reglas.bool) {
        const s = String(bruto).toLowerCase();
        if (VERDAD.has(s)) out[nombre] = true;
        else if (FALSO.has(s)) out[nombre] = false;
        else errores.push(`${nombre}: ${MSG_BOOL}`);
        continue;
      }
      const r = RB.enteroPydantic(bruto);
      if (r.error) { errores.push(`${nombre}: ${r.error}`); continue; }
      if (reglas.ge !== undefined && r.valor < reglas.ge) { errores.push(`${nombre}: Input should be greater than or equal to ${reglas.ge}`); continue; }
      if (reglas.le !== undefined && r.valor > reglas.le) { errores.push(`${nombre}: Input should be less than or equal to ${reglas.le}`); continue; }
      out[nombre] = r.valor;
    }
    if (errores.length) throw new ErrorHttp(422, `Parametros no validos. ${errores.join('; ')}`);
    return out;
  }

  async function bibliotecaVigente(ctx) {
    let lib = L.actual();
    if (!lib) {
      // rutas_biblioteca.js abre la biblioteca del worker con la primera petición que la usa.
      await RT.despachar({ metodo: 'GET', ruta: '/_biblioteca/estado' }, ctx);
      lib = L.actual();
    }
    if (!lib) throw new Error('rutas_keyness: no hay biblioteca abierta en el worker');
    return lib;
  }

  async function rutaKeyness(pet, ctx) {
    const p = parametros(pet);
    const lib = await bibliotecaVigente(ctx);
    const corpus = ctx && ctx.corpus && ctx.corpus.nombre;
    if (typeof corpus !== 'string') throw new Error('rutas_keyness: falta el nombre del corpus en el contexto');
    let col, ids;
    try {
      col = lib.get_collection(p.cid);
      if (!col) throw new ErrorHttp(404, 'No existe esa biblioteca.');
      ids = lib.item_ids(p.cid, corpus);
    } catch (e) {
      if (e && e.name === 'OverflowError') throw new ErrorHttp(422, RB.MSG_OVERFLOW);
      throw e;
    }
    const res = await R2.partition.keynessColeccion(ctx, ids, {
      min_freq: p.min_freq, limit: p.limit, limit_negative: p.limit_negative, solo_discurso: p.solo_discurso,
    });
    res.collection = { id: col.id, name: nada(col.name) ? null : col.name, n_items: ids.length };
    return res;
  }

  // Fondo: el cálculo cede el hilo por trozos y deja pasar las peticiones interactivas (búsquedas, lector) mientras dura.
  RT.registrar('GET', '/collections/{cid}/keyness', rutaKeyness, { prioridad: 'fondo' });

  R2.rutasKeyness = Object.freeze({ parametros, rutaKeyness });
})(globalThis.R2 = globalThis.R2 || {});

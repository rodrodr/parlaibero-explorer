/* ===== src/engine/rutas_menciones.js ===== */
/* Diarios Explorer · engine/rutas_menciones.js
 *
 * GET /collections/{cid}/mentions: menciones a personas en las intervenciones de una biblioteca y red de quién menciona
 * a quién (R2.menciones.red).
 *   resolucion 0,1..5 (1) · semilla 1..1000000 (1) · personas 5..200 (40) · contextos 1..20 (6)
 *   404 «No existe esa biblioteca.» · 422 «Parametros no validos. …»
 *   Si el corpus no está en el registro de menciones, devuelve { disponible: false, motivo }.
 * Prioridad de fondo: el cálculo cede el hilo por trozos y las búsquedas y el lector siguen respondiendo mientras dura.
 */
(function (R2) {
  'use strict';

  const RT = R2.router, L = R2.library, RB = R2.rutasBiblioteca, ME = R2.menciones;
  if (!RT || !L || !RB || !ME) throw new Error('engine/rutas_menciones.js necesita R2.router, R2.library, R2.rutasBiblioteca y R2.menciones');
  const ErrorHttp = RT.ErrorHttp;
  const get = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
  const nada = (v) => v === undefined || v === null || v === '';

  const REGLAS = Object.freeze({
    resolucion: { tipo: 'real', defecto: ME.DEFECTOS.resolucion, ge: 0.1, le: 5 },
    semilla: { tipo: 'entero', defecto: ME.DEFECTOS.semilla, ge: 1, le: 1000000 },
    personas: { tipo: 'entero', defecto: ME.DEFECTOS.personas, ge: 5, le: 200 },
    contextos: { tipo: 'entero', defecto: ME.DEFECTOS.contextos, ge: 1, le: 20 },
  });

  function parametros(pet) {
    const out = {}, errores = [];
    const cid = RB.enteroPydantic(get(pet.params, 'cid'));
    if (cid.error) errores.push(`cid: ${cid.error}`); else out.cid = cid.valor;
    for (const [nombre, r] of Object.entries(REGLAS)) {
      const bruto = get(pet.query, nombre);
      if (nada(bruto)) { out[nombre] = r.defecto; continue; }
      const s = String(bruto).trim();
      const v = r.tipo === 'entero' ? (/^-?\d+$/.test(s) ? Number(s) : NaN) : Number(s.replace(',', '.'));
      if (!Number.isFinite(v)) { errores.push(`${nombre}: debe ser un número${r.tipo === 'entero' ? ' entero' : ''}`); continue; }
      if (v < r.ge || v > r.le) { errores.push(`${nombre}: debe estar entre ${r.ge} y ${r.le}`); continue; }
      out[nombre] = v;
    }
    if (errores.length) throw new ErrorHttp(422, `Parametros no validos. ${errores.join('; ')}`);
    return out;
  }

  async function bibliotecaVigente(ctx) {
    let lib = L.actual();
    if (!lib) {
      await RT.despachar({ metodo: 'GET', ruta: '/_biblioteca/estado' }, ctx);
      lib = L.actual();
    }
    if (!lib) throw new Error('rutas_menciones: no hay biblioteca abierta en el worker');
    return lib;
  }

  async function rutaMenciones(pet, ctx) {
    const p = parametros(pet);
    const lib = await bibliotecaVigente(ctx);
    const corpus = ctx && ctx.corpus && ctx.corpus.nombre;
    if (typeof corpus !== 'string') throw new Error('rutas_menciones: falta el nombre del corpus en el contexto');
    let col, ids;
    try {
      col = lib.get_collection(p.cid);
      if (!col) throw new ErrorHttp(404, 'No existe esa biblioteca.');
      ids = lib.item_ids(p.cid, corpus);
    } catch (e) {
      if (e && e.name === 'OverflowError') throw new ErrorHttp(422, RB.MSG_OVERFLOW);
      throw e;
    }
    const { cid, ...opciones } = p;
    const res = await ME.red(ctx, ids, opciones);
    res.collection = { id: col.id, name: nada(col.name) ? null : col.name, n_items: ids.length };
    return res;
  }

  RT.registrar('GET', '/collections/{cid}/mentions', rutaMenciones, { prioridad: 'fondo' });

  R2.rutasMenciones = Object.freeze({ parametros, rutaMenciones });
})(globalThis.R2 = globalThis.R2 || {});

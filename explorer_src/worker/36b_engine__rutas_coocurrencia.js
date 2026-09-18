/* ===== src/engine/rutas_coocurrencia.js ===== */
/* Diarios Explorer · engine/rutas_coocurrencia.js
 *
 * GET /collections/{cid}/cooccurrence: red de coocurrencias de una biblioteca y sus temas (R2.coocurrencia.red).
 *   solo_discurso bool (true) · unidad intervencion|fragmento (intervencion) · fragmento 5..200 (20)
 *   vocabulario 20..1000 (250) · vecinos 2..50 (10) · resolucion 0,1..5 (1) · semilla 1..1000000 (1)
 *   excluir: términos separados por comas que se quitan del vocabulario
 *   expresiones bool (true): une las expresiones de varias palabras detectadas en el corpus en una sola unidad
 *   404 «No existe esa biblioteca.» · 422 «Parametros no validos. …»
 * Prioridad de fondo: el cálculo cede el hilo por trozos y las búsquedas y el lector siguen respondiendo mientras dura.
 */
(function (R2) {
  'use strict';

  const RT = R2.router, L = R2.library, RB = R2.rutasBiblioteca, CO = R2.coocurrencia;
  if (!RT || !L || !RB || !CO) throw new Error('engine/rutas_coocurrencia.js necesita R2.router, R2.library, R2.rutasBiblioteca y R2.coocurrencia');
  const ErrorHttp = RT.ErrorHttp;
  const get = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
  const nada = (v) => v === undefined || v === null || v === '';
  const VERDAD = new Set(['1', 'on', 't', 'true', 'y', 'yes']);
  const FALSO = new Set(['0', 'off', 'f', 'false', 'n', 'no']);

  const REGLAS = Object.freeze({
    solo_discurso: { tipo: 'bool', defecto: CO.DEFECTOS.solo_discurso },
    expresiones: { tipo: 'bool', defecto: CO.DEFECTOS.expresiones },
    unidad: { tipo: 'opcion', defecto: CO.DEFECTOS.unidad, opciones: ['intervencion', 'fragmento'] },
    fragmento: { tipo: 'entero', defecto: CO.DEFECTOS.fragmento, ge: 5, le: 200 },
    vocabulario: { tipo: 'entero', defecto: CO.DEFECTOS.vocabulario, ge: 20, le: 1000 },
    vecinos: { tipo: 'entero', defecto: CO.DEFECTOS.vecinos, ge: 2, le: 50 },
    resolucion: { tipo: 'real', defecto: CO.DEFECTOS.resolucion, ge: 0.1, le: 5 },
    semilla: { tipo: 'entero', defecto: CO.DEFECTOS.semilla, ge: 1, le: 1000000 },
  });

  function parametros(pet) {
    const out = {}, errores = [];
    const cid = RB.enteroPydantic(get(pet.params, 'cid'));
    if (cid.error) errores.push(`cid: ${cid.error}`); else out.cid = cid.valor;
    for (const [nombre, r] of Object.entries(REGLAS)) {
      const bruto = get(pet.query, nombre);
      if (nada(bruto)) { out[nombre] = r.defecto; continue; }
      const s = String(bruto).trim();
      if (r.tipo === 'bool') {
        if (VERDAD.has(s.toLowerCase())) out[nombre] = true;
        else if (FALSO.has(s.toLowerCase())) out[nombre] = false;
        else errores.push(`${nombre}: debe ser verdadero o falso`);
        continue;
      }
      if (r.tipo === 'opcion') {
        if (r.opciones.includes(s)) out[nombre] = s; else errores.push(`${nombre}: debe ser ${r.opciones.join(' o ')}`);
        continue;
      }
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
    if (!lib) throw new Error('rutas_coocurrencia: no hay biblioteca abierta en el worker');
    return lib;
  }

  async function rutaCoocurrencia(pet, ctx) {
    const p = parametros(pet);
    const lib = await bibliotecaVigente(ctx);
    const corpus = ctx && ctx.corpus && ctx.corpus.nombre;
    if (typeof corpus !== 'string') throw new Error('rutas_coocurrencia: falta el nombre del corpus en el contexto');
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
    // excluir: términos separados por comas, en la consulta (los decide el investigador al revisar los temas).
    const ex = get(pet.query, 'excluir');
    opciones.excluir = nada(ex) ? [] : String(ex).split(',').map((w) => w.trim()).filter(Boolean).slice(0, 2000);
    const res = await CO.red(ctx, ids, opciones);
    res.collection = { id: col.id, name: nada(col.name) ? null : col.name, n_items: ids.length };
    return res;
  }

  RT.registrar('GET', '/collections/{cid}/cooccurrence', rutaCoocurrencia, { prioridad: 'fondo' });

  R2.rutasCoocurrencia = Object.freeze({ parametros, rutaCoocurrencia });
})(globalThis.R2 = globalThis.R2 || {});

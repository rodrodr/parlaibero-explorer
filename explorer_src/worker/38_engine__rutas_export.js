/* ===== src/engine/rutas_export.js ===== */
/* 2REP_Standalone · engine/rutas_export.js
 *
 * Rutas de exportación (M6), port de app/backend/server.py 752-1050: _seleccion_export, _fuente_export, _meta_export,
 * _exportar, api_export y api_export_estimate (con _bytes_fuente y _bytes_notas), sobre R2.exports.
 *
 *   POST /export             csv · json · markdown · citations → Blob (tipo «bytes») con Content-Disposition,
 *                            X-Export-Filas, X-Export-Total-Lista y, si hay tope, X-Export-Recorte-Motivo / -De.
 *                            format=bundle (.2replib) lo sigue atendiendo el manejador de engine/rutas_biblioteca.js.
 *   POST /export/estimate    {filas, total_lista, recorte, tope_modo, palabras, bytes_texto, bytes_estimados, aproximado,
 *                            confirmar_desde}
 *
 * Selección: biblioteca (collection_id, con cap) o la lista de la búsqueda del cuerpo (R2.search.listaBusqueda: palabras o
 * navegación sin texto). En esta edición la búsqueda siempre es «keyword»: no hay descripción de la Combinada ni tope_modo.
 */
(function (R2) {
  'use strict';

  const RT = R2.router, X = R2.exports, P = R2.paquetes, F = R2.fuente, L = R2.library;
  const C = R2.py && R2.py.core;
  if (!RT || !X || !P || !F || !L || !C || !R2.search) {
    throw new Error('engine/rutas_export.js necesita R2.router, R2.exports, R2.paquetes, R2.fuente, R2.library y R2.search (src/orden.json)');
  }
  const V = RT.validar;
  const ErrorHttp = RT.ErrorHttp;
  const KS = R2.gen.constantes.server;
  const FORMATOS = X.FORMATOS_EXPORT;

  const tiene = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const get = (o, k) => (tiene(o, k) ? o[k] : undefined);
  const nada = (v) => v === undefined || v === null;
  const verdad = L.verdad;
  const vacio = (v) => nada(v) || v === '' || v === 0 || v === false || v === 0n;
  const strip = (t) => C.strip(t || '');

  function nombreCorpus(ctx) {
    const n = ctx && ctx.corpus && ctx.corpus.nombre;
    if (typeof n !== 'string') throw new Error('rutas_export: falta el nombre del corpus en el contexto');
    return n;
  }

  const biblioteca = () => L.actual();

  /** search.orden_efectivo. */
  function ordenEfectivo(mode, query, order) {
    order = V.orden(order);
    if (!strip(query)) return mode === 'semantic' || order === 'relevance' ? 'date_asc' : order;
    return mode === 'semantic' ? 'relevance' : order;
  }

  /** server._seleccion_export. */
  async function seleccion(ctx, b) {
    const name = nombreCorpus(ctx);
    const cid0 = get(b, 'collection_id');
    const cid = vacio(cid0) ? null : V.entero(cid0, 'collection_id', 1);
    if (cid) {
      const lib = biblioteca();
      const col = lib ? lib.get_collection(cid) : null;
      if (col === null || col === undefined) throw new ErrorHttp(404, 'No existe esa biblioteca.');
      const cap = V.cap(b, ctx.corpus && ctx.corpus.n_speeches);
      const todos = lib.item_ids(cid, name);
      const ids = cap === null ? todos : todos.slice(0, Number(cap));
      const recorte = ids.length < todos.length ? { motivo: 'cap', tomadas: ids.length, de: todos.length } : null;
      let description = verdad(get(col, 'description')) ? col.description : '';
      if (recorte) {
        description = (description ? `${description} ` : '')
          + `Recortada a las ${ids.length} primeras de las ${todos.length} de la biblioteca (tope pedido).`;
      }
      return { cid, ids, metas: lib.items_meta(cid, name), cap, title: tiene(col, 'name') ? col.name : 'Biblioteca',
        description, extra_meta: {}, total_lista: todos.length, recorte, tope_modo: null };
    }
    const lista = await R2.search.listaBusqueda(b, ctx);
    let description = '';
    const extra = { mode: lista.mode, order: ordenEfectivo(lista.mode, lista.query, lista.order),
      total_lista: lista.total_lista, recorte: lista.recorte };
    if (lista.tope_modo) {
      extra.tope_modo = lista.tope_modo;
      description = 'Búsqueda por significado, en orden de proximidad. ' + lista.tope_modo.texto;
    }
    if (lista.recorte && lista.recorte.motivo === 'cap') {
      description = (description ? `${description} ` : '')
        + `Recortada a las ${lista.recorte.tomadas} primeras de las ${lista.recorte.de} de la lista (tope pedido).`;
    }
    const q = get(b, 'query');
    return { cid: null, ids: lista.ids, metas: null, title: `Búsqueda: ${C.pyStr(verdad(q) ? q : 'sin texto')}`, description,
      extra_meta: extra, total_lista: lista.total_lista, recorte: lista.recorte, tope_modo: lista.tope_modo };
  }

  /** server._fuente_export. */
  function fuenteExport(lib, cid, b, ctx) {
    let f = R2.info && R2.info.fuenteDeclarada ? R2.info.fuenteDeclarada(ctx && ctx.corpus ? ctx.corpus.nombre : null) : null;
    const filtros = get(b || {}, 'filters');
    if (f === null && !cid && RT.esDict(filtros)) {
      const fc = get(filtros, 'collection_id');
      const valido = (typeof fc === 'number' && Number.isInteger(fc)) || typeof fc === 'string';
      cid = valido && C.isdigit(C.pyStr(fc)) ? Number(L.pyIntExacto(C.pyStr(fc))) : null;
    }
    if (f === null && cid) f = F.desde_metadatos(tiene(lib && lib.get_collection(cid) || {}, 'fuente') ? lib.get_collection(cid).fuente : null);
    return f;
  }

  /** server._meta_export. */
  function metaExport(sel, b, name, n) {
    const meta = { title: sel.title, description: sel.description, corpus: name, n, query: tiene(b, 'query') ? b.query : '', filas: n };
    if (!sel.cid) Object.assign(meta, sel.extra_meta);
    return meta;
  }

  const TIPOS = { csv: 'text/csv; charset=utf-8', json: 'application/json', markdown: 'text/markdown; charset=utf-8',
    citations: 'text/plain; charset=utf-8', bundle: 'application/json' };

  /** server._exportar → {datos (Blob o Uint8Array), nombre, tipo}. */
  function exportar(fmt, rows, meta, incluirTexto, f, lib, cid, name, stem) {
    const fImp = cid && lib ? X.fuenteImportada(lib.get_collection(cid), f) : null;
    if (fmt === 'csv') return { datos: X.exportCsv(rows, incluirTexto, f, fImp), nombre: `${stem}.csv`, tipo: TIPOS.csv };
    if (fmt === 'json') return { datos: X.exportJson(rows, meta, f, fImp), nombre: `${stem}.json`, tipo: TIPOS.json };
    if (fmt === 'markdown') return { datos: X.exportMarkdown(rows, meta, f, fImp), nombre: `${stem}.md`, tipo: TIPOS.markdown };
    if (fmt === 'citations') return { datos: X.exportCitations(rows, meta, f, fImp), nombre: `${stem}_referencias.txt`, tipo: TIPOS.citations };
    return { datos: P.exportarBiblioteca(lib, Number(cid), name, rows, f), nombre: `${stem}.2replib`, tipo: TIPOS.bundle };
  }

  const tamano = (d) => (d instanceof Uint8Array ? d.length : d.size);

  // El .2replib lo atiende el manejador de rutas_biblioteca.js (comprobado byte a byte en la suite 3).
  const previa = RT.buscar('POST', '/export');
  const manejadorBundle = previa && previa.def ? previa.def.manejador : null;

  /** server.api_export. */
  async function rutaExport(pet, ctx) {
    const b = V.cuerpo(pet.cuerpo);
    const name = nombreCorpus(ctx);
    const fmt = C.lower(V.texto(b, 'format') || 'csv');
    if (!FORMATOS.includes(fmt)) throw new ErrorHttp(400, `Formato no soportado: ${fmt}`);
    if (fmt === 'bundle') {
      if (!manejadorBundle) throw new ErrorHttp(501, RT.MSG_PROXIMA);
      return manejadorBundle(pet, ctx);
    }
    const incluirTexto = tiene(b, 'include_text') ? verdad(b.include_text) : true;
    const sel = await seleccion(ctx, b);
    const lib = biblioteca();
    const stem = P.slug(sel.title) || 'seleccion';
    const f = fuenteExport(lib, sel.cid, b, ctx);
    const rows = await X.filasExport(ctx, sel.ids, incluirTexto);
    if (sel.metas instanceof Map && sel.metas.size) {
      for (const d of rows) {
        const m = sel.metas.get(d.id) || {};
        d.note = tiene(m, 'note') ? m.note : '';
        d.tags = tiene(m, 'tags') ? m.tags : [];
      }
    }
    const n = rows.length;
    const r = exportar(fmt, rows, metaExport(sel, b, name, n), incluirTexto, f, lib, sel.cid, name, stem);
    const cab = {
      'content-type': r.tipo,
      'content-disposition': `attachment; filename="${r.nombre}"`,
      'x-export-filas': String(n),
      'x-export-total-lista': String(sel.total_lista),
    };
    if (sel.recorte) Object.assign(cab, { 'x-export-recorte-motivo': sel.recorte.motivo, 'x-export-recorte-de': String(sel.recorte.de) });
    return new RT.Respuesta(r.datos, { tipo: 'bytes', cabeceras: cab });
  }

  /** server._bytes_fuente. */
  function bytesFuente(ctx, lib, sel, b, n) {
    const name = nombreCorpus(ctx);
    const f = fuenteExport(lib, sel.cid, b, ctx);
    const meta = metaExport(sel, b, name, n);
    const out = {};
    for (const fmt of FORMATOS) {
      if (fmt === 'bundle' && !sel.cid) { out[fmt] = 0; continue; }
      out[fmt] = tamano(exportar(fmt, [], meta, false, f, lib, sel.cid, name, 'x').datos) + X.bytesFuentePorFila(fmt, f) * n;
    }
    return out;
  }

  /** server.api_export_estimate. */
  async function rutaEstimar(pet, ctx) {
    const b = V.cuerpo(pet.cuerpo);
    const sel = await seleccion(ctx, b);
    const lib = biblioteca();
    const med = X.medidaExport(ctx, sel.ids);
    const n = med.filas, bt = med.bytes_texto;
    const name = nombreCorpus(ctx);
    const notas = sel.cid ? X.bytesNotas(lib.notas_resumen(sel.cid, name, sel.cap)) : X.bytesNotas(null);
    const fuenteB = bytesFuente(ctx, lib, sel, b, n);
    const est = {};
    for (const fmt of FORMATOS) {
      const base = KS.EXPORT_BYTES_FILA[fmt] * n + KS.EXPORT_BYTES_AVISO[fmt] * med.filas_aviso + notas[fmt] + fuenteB[fmt];
      est[fmt] = { sin_texto: Math.trunc(base), con_texto: Math.trunc(base + KS.EXPORT_FACTOR_TEXTO[fmt] * bt) };
    }
    return { filas: n, total_lista: sel.total_lista, recorte: sel.recorte, tope_modo: sel.tope_modo, palabras: med.palabras,
      bytes_texto: bt, bytes_estimados: est, aproximado: true, confirmar_desde: KS.CONFIRMAR_DESDE };
  }

  RT.registrar('POST', '/export', rutaExport, { prioridad: 'fondo' });
  RT.registrar('POST', '/export/estimate', rutaEstimar, { prioridad: 'interactiva' });

  R2.rutasExport = Object.freeze({ ordenEfectivo, seleccion, fuenteExport, metaExport, exportar, bytesFuente, rutaExport, rutaEstimar });
})(globalThis.R2 = globalThis.R2 || {});

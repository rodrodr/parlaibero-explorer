/* ===== src/engine/info.js ===== */
/* Diarios Explorer · engine/info.js
 *
 * GET /api/info y GET /api/facets. /api/info tiene las claves de server.api_info (corpus, available: [], library_path: null,
 * model_present: false) más edicion: 'standalone'; corpus lleva las claves de search.Corpus.info() en su orden, con la
 * fuente (R2.fuente, si hay una declarada en R2.datos.fuente) y sessions = SessionIndex.info(). Lo propio de esta edición
 * va en corpus.standalone. /api/facets devuelve el JSON de meta.facets tal cual.
 *
 * El corpus se identifica por el país: las dos letras iniciales de id_session (ES, BR, SV…), guardadas en meta.pais al
 * construir. Las bibliotecas del investigador se guardan con la clave «Diarios_<país>», así que las de cada país solo se
 * ven con el CSV de ese país cargado.
 *
 * API (R2.info)
 *   cuerpoInfo(nucleo) · corpusInfo(nucleo) · nombreCorpus(informe) · plano(v) · fuenteDeclarada() · fuenteInfo()
 *   corpusBibliotecas(nucleo) · nombrePais(codigo) · PAISES
 *   nucleo = { informe, construidoEn, errorHuella, huellaPendiente, modoLectura, pais, facetasTexto(), sesiones() }
 */
(function (R2) {
  'use strict';

  const RT = R2.router;
  if (!RT) throw new Error('engine/info.js necesita R2.router (engine/router.js)');

  const PAISES = Object.freeze({
    AD: 'Andorra', AR: 'Argentina', BO: 'Bolivia', BR: 'Brasil', CL: 'Chile', CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba',
    DO: 'República Dominicana', EC: 'Ecuador', ES: 'España', GQ: 'Guinea Ecuatorial', GT: 'Guatemala', HN: 'Honduras',
    MX: 'México', NI: 'Nicaragua', PA: 'Panamá', PE: 'Perú', PH: 'Filipinas', PR: 'Puerto Rico', PT: 'Portugal',
    PY: 'Paraguay', SV: 'El Salvador', UY: 'Uruguay', VE: 'Venezuela',
  });
  const PREFIJO_BIBLIOTECAS = 'Diarios_';

  const nombrePais = (codigo) => {
    const c = String(codigo || '').toUpperCase();
    return PAISES[c] || (c ? `país ${c}` : 'país sin identificar');
  };

  /** Valores del modelo Python de R2.fuente (Map, BigInt, float envuelto) → JSON plano. */
  function plano(v) {
    if (v instanceof Map) {
      const o = {};
      for (const [k, x] of v) o[String(k)] = plano(x);
      return o;
    }
    if (Array.isArray(v)) return v.map(plano);
    if (typeof v === 'bigint') return Number(v);
    if (v && typeof v === 'object') {
      const core = R2.py && R2.py.core;
      if (core && typeof core.esFloatEnvuelto === 'function' && core.esFloatEnvuelto(v)) return Number(v.valor !== undefined ? v.valor : v.valueOf());
      const o = {};
      for (const k of Object.keys(v)) o[k] = plano(v[k]);
      return o;
    }
    return v;
  }

  /** «Diarios_SV» → «SV» (el corpus de las bibliotecas lleva el país). */
  function paisDeCorpus(nombre) {
    const m = /^Diarios_([A-Z]{2})$/.exec(String(nombre || ''));
    return m ? m[1] : '';
  }

  /**
   * La fuente declarada del país (R2.datos.fuentes[país], el registro de ParlaIbero generado por tools/fuentes_parlaibero.py)
   * o, si no hay país, la fuente global R2.datos.fuente (esta edición no declara ninguna). `pais`: código de dos letras,
   * el nombre de corpus de las bibliotecas («Diarios_SV») o un objeto con `pais`.
   */
  function fuenteDeclarada(pais) {
    if (!R2.fuente) return null;
    let p = pais && typeof pais === 'object' ? pais.pais : pais;
    p = String(p || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(p)) p = paisDeCorpus(pais);
    const fuentes = R2.datos && R2.datos.fuentes;
    if (p && fuentes && fuentes[p]) return R2.fuente.desde_manifest({ fuente: fuentes[p] });
    const d = R2.datos && R2.datos.fuente;
    if (!d || typeof d !== 'object') return null;
    return R2.fuente.desde_manifest(Object.prototype.hasOwnProperty.call(d, 'fuente') ? d : { fuente: d });
  }

  const cacheFuente = new Map();
  function fuenteInfo(pais) {
    const clave = String(pais && typeof pais === 'object' ? pais.pais : pais || '').toUpperCase();
    if (cacheFuente.has(clave)) return cacheFuente.get(clave);
    if (!R2.fuente) { cacheFuente.set(clave, null); return null; }
    const F = R2.fuente;
    const f = fuenteDeclarada(clave);
    const info = plano(Object.assign(F.completa(f), {
      lineas: F.lineas(f, ''), columnas: F.columnas(f), licencia_texto: F.licencia(f), sin_fuente: F.SIN_FUENTE,
    }));
    cacheFuente.set(clave, info);
    return info;
  }

  function nombreCorpus(informe) {
    const base = String((informe && informe.huella && informe.huella.nombre) || '').replace(/\.[^.]*$/, '');
    return base || 'corpus';
  }

  const paisDe = (nucleo) => {
    const p = nucleo && nucleo.pais ? String(nucleo.pais).toUpperCase() : '';
    return /^[A-Z]{2}$/.test(p) ? p : '';
  };

  /**
   * Corpus de las bibliotecas (ctx.corpus.nombre: items.corpus, saved_searches.corpus, «corpus» del .2replib, marcas ◆ y
   * filtro por biblioteca): «Diarios_<país>», estable entre copias del mismo CSV y distinto para cada país.
   */
  function corpusBibliotecas(nucleo) {
    return PREFIJO_BIBLIOTECAS + (paisDe(nucleo) || 'XX');
  }

  function estadoStandalone(nucleo) {
    const inf = nucleo.informe;
    const p = paisDe(nucleo);
    const man = (R2.datos && R2.datos.fuentes && p && R2.datos.fuentes[p]) || null;
    return {
      dataset: man ? { titulo: man.titulo, doi: man.doi, url: man.url, version: man.version_cita } : null,
      archivo: { nombre: inf.huella.nombre, bytes: inf.huella.bytes, sha256: inf.huella.sha256 },
      huella: nucleo.errorHuella ? 'fallida' : nucleo.huellaPendiente ? 'pendiente' : 'comprobada',
      publicado: null,
      version_csv: null,
      correcciones_fechas: null,
      referencia: null,
      avisos: inf.avisos,
      fallo_huella: nucleo.errorHuella,
      n_filas: inf.n_filas,
      n_sesiones: inf.n_sesiones != null ? inf.n_sesiones : null,
      n_doc: inf.n_doc != null ? inf.n_doc : null,
      pais: paisDe(nucleo) || null,
      pais_nombre: nombrePais(paisDe(nucleo)),
      duplicadas: inf.duplicadas || 0,
      tiempos: inf.tiempos,
      memoria: inf.memoria,
      texto: inf.detalles ? { bytes: inf.detalles.bytes_texto, bytes_comprimido: inf.detalles.bytes_texto_comprimido,
        bloques: inf.detalles.bloques, optimizado: inf.detalles.optimizado } : null,
      sqlite: inf.detalles ? inf.detalles.sqlite : null,
      modo_lectura: nucleo.modoLectura,
      construido_en: nucleo.construidoEn,
    };
  }

  function corpusInfo(nucleo) {
    const inf = nucleo.informe;
    const f = JSON.parse(nucleo.facetasTexto());
    const legislaturas = Array.isArray(f.legislatures) ? f.legislatures : [];
    const palabras = f.words_total != null ? Number(f.words_total) : legislaturas.reduce((s, x) => s + (Number(x.words) || 0), 0);
    const nombre = nombreCorpus(inf);
    const pais = paisDe(nucleo);
    const diario = R2.gen && R2.gen.constantes && R2.gen.constantes.diario;
    let indice = null;
    try { indice = typeof nucleo.sesiones === 'function' ? nucleo.sesiones() : null; } catch (e) { indice = null; }
    const manifiesto = (R2.datos && R2.datos.fuentes && pais && R2.datos.fuentes[pais]) || null;
    return {
      name: nombre,
      title: `ParlaIbero · ${nombrePais(pais)}`,
      pais: pais || null,
      pais_nombre: nombrePais(pais),
      dataset: manifiesto ? { titulo: manifiesto.titulo, doi: manifiesto.doi, url: manifiesto.url, version: manifiesto.version_cita,
        archivo: manifiesto.archivo || null } : null,
      coleccion: (R2.datos && R2.datos.parlaibero) || null,
      corpus_bibliotecas: corpusBibliotecas(nucleo),
      path: null,
      n_speeches: inf.n_filas,
      n_chunks: 0,
      n_words: palabras || null,
      n_sessions: f.sessions_total != null ? f.sessions_total : null,
      n_deputies: f.deputies_total != null ? f.deputies_total : null,
      rows: f.rows || null,
      date_min: f.date_min != null ? f.date_min : null,
      date_max: f.date_max != null ? f.date_max : null,
      has_semantic: false,
      embed_model: null,
      built_at: nucleo.construidoEn,
      normalization: {},
      precision_check: null,
      sessions: indice ? indice.info() : null,
      has_session_meta: indice ? indice.has_sidecar : false,
      doc_engine: diario && diario.ENGINE_VERSION != null ? diario.ENGINE_VERSION : null,
      fuente: fuenteInfo(pais),
      standalone: estadoStandalone(nucleo),
    };
  }

  const cuerpoInfo = (nucleo) => ({ edicion: 'standalone', corpus: corpusInfo(nucleo), available: [], library_path: null, model_present: false });

  RT.registrar('GET', '/info', (pet, ctx) => cuerpoInfo(ctx.nucleo), { prioridad: 'interactiva' });
  RT.registrar('GET', '/facets', (pet, ctx) => new RT.Respuesta(ctx.nucleo.facetasTexto(), { tipo: 'json-texto' }), { prioridad: 'interactiva' });

  R2.info = Object.freeze({ PAISES, PREFIJO_BIBLIOTECAS, nombrePais, paisDeCorpus, plano, fuenteDeclarada, fuenteInfo, nombreCorpus, corpusBibliotecas,
    estadoStandalone, corpusInfo, cuerpoInfo });
})(globalThis.R2 = globalThis.R2 || {});

/* ===== src/engine/paquetes.js ===== */
/* 2REP_Standalone · engine/paquetes.js
 *
 * Archivos de bibliotecas (worker, grupo «engine»):
 *   - .2replib (formato 2replib/1): port exacto de library.export_library_bundle (mismos bytes: json.dumps con indent=2,
 *     ensure_ascii=False, orden de claves, «fuente» y «fuente_importada») y de library.import_library_bundle (mismas
 *     validaciones, mensajes y «(importada)»).
 *   - «Exportar todas» (formato 2replib-copia/1, solo Standalone): copia de seguridad de TODAS las bibliotecas (con sus
 *     items completos: nota, etiquetas, tramo, fecha de alta y posición) y las búsquedas guardadas; al importarla se crean
 *     bibliotecas nuevas (ids reasignados) en una sola transacción y las búsquedas restringidas a una biblioteca de la copia
 *     pasan a apuntar a la nueva. Formato en ARQUITECTURA.md §9.4.
 *   - _slug de server.py (nombre del archivo).
 *   - Comprobación del PAÍS al importar (solo aquí, no en server.py: el escritorio abre un único corpus). Los speech_id
 *     son números de fila del CSV de un país; importarlos sobre el corpus de otro creaba en silencio una biblioteca de
 *     intervenciones ajenas. Si el archivo dice de qué país es («corpus» Diarios_XX o, si no, el DOI de su «fuente»
 *     contra R2.datos.fuentes) y no es el del corpus abierto, se rechaza con ValueError (400) antes de escribir nada.
 *
 * Caracteres fuera del BMP (decisión de M4, «como separadores antes de aplicar regex»): en la importación no hace falta
 * cambiarlos. Las validaciones de speech_id usan las tablas de R2.py.core (isdigit, strip), no expresiones regulares;
 * notas, etiquetas y nombres se guardan tal cual; y los bloques «fuente» solo pasan por _CONTROL y \s{2,} de
 * fuente._una_linea, clases sin \w, \d ni miradas atrás, que no tocan los fallos A–D de WebKit (ARQUITECTURA.md §7.3).
 * Así se conserva la paridad con el escritorio también con emojis; test/navegador/test_biblioteca.py comprueba que
 * WebKit, Chromium y Firefox dan los mismos bytes.
 *
 * API: R2.paquetes = { FORMATO, FORMATO_COPIA, exportarBiblioteca, importarBiblioteca, exportarTodas, importarCopia,
 *   leerFilas, slug, nombreCopia }
 */
(function (R2) {
  'use strict';

  const C = R2.py.core;
  const J = R2.py.json;
  const F = R2.fuente;
  const L = R2.library;
  const I = R2.info;
  if (!L || !F || !I) throw new Error('paquetes.js necesita R2.library, R2.fuente y R2.info (src/orden.json)');

  const FORMATO = '2replib/1';
  const FORMATO_COPIA = '2replib-copia/1';
  const INLINE_ID_LIMIT = 900;
  const ENC = new TextEncoder();
  const DEC = new TextDecoder('utf-8', { ignoreBOM: true });
  const ErrorPy = L.ErrorPy;
  const verdad = L.verdad;

  const esDict = (v) => v instanceof Map || (v !== null && typeof v === 'object' && !Array.isArray(v) && !C.esFloatEnvuelto(v));
  const tiene = (d, k) => (d instanceof Map ? d.has(k) : Object.prototype.hasOwnProperty.call(d, k));
  const dget = (d, k, defecto = null) => (d !== null && d !== undefined && esDict(d) && tiene(d, k) ? (d instanceof Map ? d.get(k) : d[k]) : defecto);
  const o = (a, b) => (verdad(a) ? a : b);
  const esEntero = (v) => (typeof v === 'number' && Number.isInteger(v)) || typeof v === 'bigint';
  const dumpsBytes = (v) => ENC.encode(J.dumps(v, { ensure_ascii: false, indent: 2 }));

  /** _slug de server.py: NFD sin marcas, [^a-zA-Z0-9]+ → «_», sin «_» en los bordes, 60 caracteres, minúsculas. */
  function slug(s) {
    // transformar.fold = NFD, sin Mn (tablas de Unicode 15.0), lower y strip: el resultado solo conserva ASCII, así que
    // bajar a minúsculas antes de sustituir da lo mismo que el lower() final de _slug.
    let t = R2.transformar.fold(typeof s === 'string' ? s : '');
    t = t.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60).toLowerCase();
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(t)) t += '_';
    return t;
  }

  /**
   * Filas {id, date, rep_name, speaker} del corpus en el orden de `ids` (los que no existen se omiten; un id repetido da
   * otra fila), leídas por lotes de 900 como filas_export. Texto exacto (con U+FEFF inicial).
   */
  function leerFilas(sqlite3, db, ids) {
    const { capi, wasm } = sqlite3;
    const unicos = [...new Set(ids.map((x) => String(x)))];
    const filas = new Map();
    for (let k = 0; k < unicos.length; k += INLINE_ID_LIMIT) {
      const lote = unicos.slice(k, k + INLINE_ID_LIMIT);
      const st = db.prepare(`SELECT id, CAST(date AS BLOB), CAST(rep_name AS BLOB), CAST(speaker AS BLOB) FROM speeches WHERE id IN (${lote.map(() => '?').join(',')})`);
      try {
        st.bind(L.enlazar(lote.map((x) => (/^-?\d{1,15}$/.test(x) ? Number(x) : BigInt(x)))));
        while (st.step()) {
          const texto = (i) => {
            if (capi.sqlite3_column_type(st.pointer, i) === capi.SQLITE_NULL) return null;
            const p = capi.sqlite3_column_blob(st.pointer, i);
            const n = capi.sqlite3_column_bytes(st.pointer, i);
            return n ? DEC.decode(wasm.heap8u().slice(p, p + n)) : '';
          };
          const id = st.get(0);
          filas.set(String(id), { id: typeof id === 'bigint' ? Number(id) : id, date: texto(1), rep_name: texto(2), speaker: texto(3) });
        }
      } finally {
        st.finalize();
      }
    }
    const out = [];
    for (const i of ids) {
      const d = filas.get(String(i));
      if (d) out.push(Object.assign({}, d));
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------------ 2replib/1
  /**
   * export_library_bundle(lib, cid, corpus_name, rows, f) → Uint8Array. `filas` son las de Exportar con note y tags
   * (leerFilas + items_meta).
   */
  function exportarBiblioteca(lib, cid, nombreCorpus, filas, f) {
    const col = lib.get_collection(cid) || {};
    const fc = F.columnas(f);
    const paquete = { format: FORMATO, exported_at: L.now(), corpus: nombreCorpus, fuente: F.completa(f) };
    const previa = dget(col, 'fuente');
    if (verdad(previa) && dget(previa, 'cita') !== F.cita(f)) paquete.fuente_importada = previa;
    paquete.collection = { name: dget(col, 'name'), description: dget(col, 'description'), color: dget(col, 'color') };
    paquete.items = filas.map((r) => Object.assign({
      speech_id: r.id,
      note: tiene(r, 'note') ? r.note : '',
      tags: tiene(r, 'tags') ? r.tags : [],
      date: dget(r, 'date'),
      rep_name: dget(r, 'rep_name'),
      speaker: dget(r, 'speaker'),
    }, plano(fc)));
    return dumpsBytes(paquete);
  }

  const plano = (d) => (d instanceof Map ? Object.fromEntries(d) : d);

  /** speech_id válido de un item (isinstance int|str, no bool, str(sid).strip().isdigit()) → int(sid), o null. */
  function speechIdDe(it) {
    const sid = esDict(it) ? dget(it, 'speech_id') : null;
    if (typeof sid === 'boolean' || !(esEntero(sid) || typeof sid === 'string')) return null;
    const s = typeof sid === 'string' ? sid : C.pyStr(sid);
    if (!C.isdigit(C.strip(s))) return null;
    return { valor: L.pyIntExacto(s) };
  }

  // ------------------------------------------------------------------------------------------------ país del archivo
  /** País de un nombre de corpus de bibliotecas («Diarios_SV» → «SV»); '' si no lo lleva o es el comodín «Diarios_XX». */
  function paisDeNombre(nombre) {
    const p = typeof nombre === 'string' ? I.paisDeCorpus(nombre) : '';
    return p === 'XX' ? '' : p;
  }

  /** «https://doi.org/10.7910/DVN/X», «doi:10.7910/dvn/x» y «10.7910/DVN/X» → «10.7910/dvn/x» (el DOI no distingue caja). */
  const doiCanonico = (d) => C.lower(C.strip(d)).replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/, '');

  /** País de ParlaIbero cuyo conjunto de datos tiene ese DOI (R2.datos.fuentes[país].doi), o ''. */
  function paisDeDoi(doi) {
    const fuentes = R2.datos && R2.datos.fuentes;
    if (typeof doi !== 'string' || !doiCanonico(doi) || !fuentes) return '';
    const buscado = doiCanonico(doi);
    for (const p of Object.keys(fuentes)) {
      const d = fuentes[p] && fuentes[p].doi;
      if (typeof d === 'string' && doiCanonico(d) === buscado) return p;
    }
    return '';
  }

  /**
   * De qué país dice ser un archivo: su «corpus» si es un Diarios_XX reconocible y, si no, el DOI de su «fuente» (o de la
   * «fuente_importada», en el orden de fuenteDePaquete). → {pais, prueba} o null si el archivo no lo dice.
   */
  function paisDeArchivo(payload) {
    const corpus = dget(payload, 'corpus');
    const p = paisDeNombre(corpus);
    if (p) return { pais: p, prueba: __('su «corpus» es {0}', corpus) };
    for (const campo of ['fuente', 'fuente_importada']) {
      const f = dget(payload, campo);
      const doi = esDict(f) ? dget(f, 'doi') : null;
      const q = paisDeDoi(doi);
      if (q) return { pais: q, prueba: __('el DOI de su fuente, {0}, es el de ParlaIbero-{1}', C.strip(doi), q) };
    }
    return null;
  }

  /**
   * Rechaza (ValueError → 400) lo que se guardaría en el corpus abierto siendo de otro país. `que` es el sujeto del mensaje
   * («Este archivo», «Esta copia») y `extra`, una frase que se añade tras la primera. Un archivo que no dice su país pasa
   * como antes: no hay con qué compararlo.
   */
  function comprobarPais(origen, nombreCorpus, que, extra = '') {
    if (!origen) return;
    const abierto = paisDeNombre(nombreCorpus);
    if (origen.pais === abierto) return;
    const suyo = I.nombrePais(origen.pais);
    const aqui = abierto ? __('el de {0} ({1})', I.nombrePais(abierto), nombreCorpus) : __('{0}, que no es de ningún país de ParlaIbero', C.pyStr(nombreCorpus));
    throw new ErrorPy('ValueError', __('{0} es de {1} ({2}) y el corpus abierto es {3}.', __(que), suyo, origen.prueba, aqui) + ` ${__(extra)}`
      + __('Sus speech_id son números de fila del CSV de {0}: aquí apuntarían a intervenciones de otro corpus que no tienen nada que ver. Abra el CSV de {0} y vuelva a importar el archivo.', suyo));
  }

  /** import_library_bundle(lib, payload, corpus_name) → {collection, n_items, fuente}. ValueError → 400. */
  function importarBiblioteca(lib, payload, nombreCorpus) {
    if (dget(payload, 'format') !== FORMATO) throw new ErrorPy('ValueError', __('El archivo no tiene el formato 2replib/1'));
    comprobarPais(paisDeArchivo(payload), nombreCorpus, N_('Este archivo'));
    const colMeta = o(dget(payload, 'collection'), {});
    if (!esDict(colMeta)) throw new ErrorPy('ValueError', __('«collection» debe ser un objeto.'));
    const items = o(dget(payload, 'items'), []);
    if (!Array.isArray(items)) throw new ErrorPy('ValueError', __('«items» debe ser una lista.'));
    // Se valida todo ANTES de crear la biblioteca: un archivo roto no deja una biblioteca vacía a medias.
    const filas = [];
    items.forEach((it, i) => {
      const sid = speechIdDe(it);
      if (sid === null) throw new ErrorPy('ValueError', __('El item {0} no tiene un speech_id válido.', i + 1));
      const note = dget(it, 'note');
      const tags = dget(it, 'tags');
      filas.push([sid.valor, typeof note === 'string' ? note : '', Array.isArray(tags) ? tags.filter((t) => typeof t === 'string') : []]);
    });
    const f = fuenteDePaquete(payload);
    const nombre = o(dget(colMeta, 'name'), __('Biblioteca importada'));
    const col = lib.create_collection(__('{0} (importada)', C.pyStr(nombre)), dget(colMeta, 'description', ''), dget(colMeta, 'color', 'indigo'));
    if (f) lib.set_collection_fuente(col.id, F.metadatos(f));
    lib.add_items_bulk(col.id, nombreCorpus, filas);
    return { collection: lib.get_collection(col.id), n_items: items.length, fuente: F.metadatos(f) };
  }

  /** La fuente del paquete o, si el paquete ya era una reexportación sin fuente propia, la importada. */
  function fuenteDePaquete(payload) {
    return F.desde_metadatos(dget(payload, 'fuente')) || F.desde_metadatos(dget(payload, 'fuente_importada'));
  }

  // ------------------------------------------------------------------------------------------------ 2replib-copia/1
  function nombreCopia() {
    return `2rep_bibliotecas_${L.now().slice(0, 10)}.2replib`;
  }

  /** «Exportar todas»: copia completa de la base de bibliotecas → Uint8Array. */
  function exportarTodas(lib, nombreCorpus, f) {
    const fc = plano(F.columnas(f));
    const colecciones = lib._filas('SELECT * FROM collections ORDER BY id').map((c) => {
      let fuente = null;
      try { fuente = verdad(c.fuente) ? JSON.parse(c.fuente) : null; } catch (e) { fuente = null; }
      const items = lib._filas('SELECT * FROM items WHERE collection_id = ? ORDER BY position, id', [c.id]).map((it) => Object.assign({
        corpus: it.corpus, speech_id: it.speech_id, note: it.note, tags: JSON.parse(it.tags || '[]'),
        char_start: it.char_start, char_end: it.char_end, added_at: it.added_at, position: it.position,
      }, fc));
      return { id: c.id, name: c.name, description: c.description, color: c.color, created_at: c.created_at,
        updated_at: c.updated_at, fuente: esDict(fuente) ? fuente : null, n_items: items.length, items };
    });
    const busquedas = lib._filas('SELECT * FROM saved_searches ORDER BY id').map((s) => ({
      id: s.id, name: s.name, corpus: s.corpus, mode: s.mode, query: s.query, filters: JSON.parse(s.filters || '{}'),
      variants: s.variants, created_at: s.created_at,
    }));
    return dumpsBytes({
      format: FORMATO_COPIA,
      exported_at: L.now(),
      edicion: 'standalone',
      corpus: nombreCorpus,
      fuente: F.completa(f),
      n_collections: colecciones.length,
      n_items: colecciones.reduce((s, c) => s + c.items.length, 0),
      n_searches: busquedas.length,
      collections: colecciones,
      searches: busquedas,
    });
  }

  const textoO = (v, defecto) => (typeof v === 'string' ? v : defecto);
  const enteroO = (v, defecto) => (esEntero(v) && typeof v !== 'boolean' ? v : defecto);

  // ---- validación de la copia (revisión de M4): lo que la interfaz no sabe pintar o SQLite no puede guardar se rechaza
  // ANTES de escribir, con un mensaje que dice dónde está el problema.
  const MODOS_COPIA = ['keyword', 'hybrid'];
  const LISTAS_FILTRO = ['legislatures', 'legislative_sessions', 'session_types', 'sexes', 'parties', 'districts', 'speakers', 'rep_ids', 'speech_ids',
    'party_families', 'ideologies'];
  const ESCALARES_FILTRO = ['min_words', 'max_words', 'num_session', 'date_from', 'date_to'];

  /** Un entero de la copia que no cabe en 64 bits (JSON.parse no distingue 1e300 de un entero de 301 cifras). */
  function fueraDe64(v) {
    if (typeof v === 'bigint') return v > L.INT64_MAX || v < L.INT64_MIN;
    if (typeof v !== 'number' || Number.isSafeInteger(v)) return false;
    const b = BigInt(v);
    return b > L.INT64_MAX || b < L.INT64_MIN;
  }

  function enteroCopia(v, defecto, campo, donde) {
    const x = enteroO(v, defecto);
    if (x !== defecto && fueraDe64(x)) throw new ErrorPy('ValueError', __('«{0}» {1} no cabe en 64 bits.', campo, donde));
    return x;
  }

  /** Recorre textos (también claves) de un valor JSON: el primer sustituto UTF-16 suelto → ValueError con el sitio. */
  function sinSustitutos(v, campo, donde) {
    const pila = [v];
    while (pila.length) {
      const x = pila.pop();
      if (typeof x === 'string') {
        if (L.sustitutosSueltos(x)) throw new ErrorPy('ValueError', __('«{0}» {1} tiene un carácter que no se puede guardar (un sustituto UTF-16 suelto).', campo, donde));
      } else if (Array.isArray(x)) {
        for (const y of x) pila.push(y);
      } else if (x instanceof Map) {
        for (const [k, y] of x) { pila.push(k); pila.push(y); }
      } else if (x !== null && typeof x === 'object' && !C.esFloatEnvuelto(x)) {
        for (const k of Object.keys(x)) { pila.push(k); pila.push(x[k]); }
      }
    }
    return v;
  }

  /**
   * Filtros de una búsqueda guardada tal como los lee la interfaz al lanzarla (expandFilters, renderPills, renderFilters):
   * listas de textos o números, escalares y el periodo de la tendencia con sus rangos. Antes, «legislatures»: "texto" rompía
   * la interfaz (TypeError en .map) y [{…}] salía como «[object Object]» en la píldora.
   */
  function validarFiltros(filtros, k) {
    const donde = __('de la búsqueda guardada {0} de la copia', k);
    const mal = (campo, como) => new ErrorPy('ValueError', __('«filters.{0}» {1} debe ser {2}.', campo, donde, como));
    const escalar = (x) => typeof x === 'string' || (typeof x === 'number' && Number.isFinite(x)) || typeof x === 'bigint';
    for (const campo of LISTAS_FILTRO) {
      if (!tiene(filtros, campo)) continue;
      const v = dget(filtros, campo);
      if (v === null) continue;
      if (!Array.isArray(v) || !v.every(escalar)) throw mal(campo, __('una lista de textos o números'));
    }
    for (const campo of ESCALARES_FILTRO) {
      if (!tiene(filtros, campo)) continue;
      const v = dget(filtros, campo);
      if (v !== null && !escalar(v)) throw mal(campo, __('un texto o un número'));
    }
    if (tiene(filtros, 'period')) {
      const p = dget(filtros, 'period');
      if (p !== null) {
        if (!esDict(p)) throw mal('period', __('un objeto'));
        const r = dget(p, 'ranges');
        if (r !== null && !(Array.isArray(r) && r.every((x) => Array.isArray(x) && x.length === 2 && x.every((y) => escalar(y) && Number.isFinite(Number(y)))))) {
          throw mal('period.ranges', __('una lista de pares [desde, hasta]'));
        }
        for (const campo of ['label', 'key', 'kind']) {
          const x = dget(p, campo);
          if (x !== null && !escalar(x)) throw mal(`period.${campo}`, __('un texto'));
        }
      }
    }
    sinSustitutos(filtros, 'filters', donde);
  }

  /**
   * Importa una copia 2replib-copia/1: valida TODO antes de escribir y lo escribe en una transacción. Bibliotecas nuevas
   * (ids reasignados); búsquedas guardadas con filters.collection_id de una biblioteca de la copia → el id nuevo; con un id
   * que no está en la copia → -1 (se listan como «biblioteca borrada», nunca apuntan a otra biblioteca de este navegador).
   * Devuelve {format, collections, n_collections, n_items, n_searches, ids: {antiguo: nuevo}}.
   */
  function importarCopia(lib, payload, nombreCorpus) {
    if (dget(payload, 'format') !== FORMATO_COPIA) throw new ErrorPy('ValueError', __('El archivo no tiene el formato 2replib-copia/1'));
    const cols = dget(payload, 'collections', []);
    if (!Array.isArray(cols)) throw new ErrorPy('ValueError', __('«collections» debe ser una lista.'));
    const busq = o(dget(payload, 'searches'), []);
    if (!Array.isArray(busq)) throw new ErrorPy('ValueError', __('«searches» debe ser una lista.'));
    // Cada item y cada búsqueda guardada llevan su propio «corpus» y se guardan en él (una copia puede tener bibliotecas
    // de varios países, y eso es legítimo). Solo lo que NO lo lleva cae en el corpus abierto: eso sí se comprueba, con el
    // país que declara la copia.
    const sinCorpus = (x) => esDict(x) && typeof dget(x, 'corpus') !== 'string';
    const huerfanos = cols.some((c) => esDict(c) && Array.isArray(dget(c, 'items')) && dget(c, 'items').some(sinCorpus)) || busq.some(sinCorpus);
    if (huerfanos) {
      comprobarPais(paisDeArchivo(payload), nombreCorpus, N_('Esta copia'),
        N_('Tiene items o búsquedas guardadas sin «corpus» propio, que se guardarían en el corpus abierto. '));
    }
    const ahora = L.now();
    const preparadas = cols.map((c, i) => {
      const k = i + 1;
      if (!esDict(c)) throw new ErrorPy('ValueError', __('La biblioteca {0} de la copia no es un objeto.', k));
      const items = o(dget(c, 'items'), []);
      if (!Array.isArray(items)) throw new ErrorPy('ValueError', __('«items» de la biblioteca {0} debe ser una lista.', k));
      const filas = items.map((it, j) => {
        const sid = speechIdDe(it);
        const donde = __('del item {0} de la biblioteca {1} de la copia', j + 1, k);
        if (sid === null) throw new ErrorPy('ValueError', __('El item {0} de la biblioteca {1} no tiene un speech_id válido.', j + 1, k));
        const v = sid.valor;
        if (typeof v === 'bigint' && (v > L.INT64_MAX || v < L.INT64_MIN)) throw new ErrorPy('ValueError', __('El item {0} de la biblioteca {1} tiene un speech_id que no cabe en 64 bits.', j + 1, k));
        const tags = dget(it, 'tags');
        const fila = {
          corpus: textoO(dget(it, 'corpus'), nombreCorpus), speech_id: v, note: textoO(dget(it, 'note'), ''),
          tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string') : [],
          char_start: enteroCopia(dget(it, 'char_start'), null, 'char_start', donde),
          char_end: enteroCopia(dget(it, 'char_end'), null, 'char_end', donde),
          added_at: textoO(dget(it, 'added_at'), ahora), position: enteroCopia(dget(it, 'position'), null, 'position', donde),
        };
        for (const campo of ['corpus', 'note', 'tags', 'added_at']) sinSustitutos(fila[campo], campo, donde);
        return fila;
      });
      const f = F.desde_metadatos(dget(c, 'fuente'));
      const idAntiguo = dget(c, 'id');
      const col = {
        idAntiguo: esEntero(idAntiguo) || typeof idAntiguo === 'string' ? C.strip(C.pyStr(idAntiguo)) : null,
        name: C.strip(textoO(dget(c, 'name'), '')) || __('Biblioteca sin titulo'),
        description: textoO(dget(c, 'description'), ''), color: textoO(dget(c, 'color'), 'indigo') || 'indigo',
        created_at: textoO(dget(c, 'created_at'), ahora), updated_at: textoO(dget(c, 'updated_at'), ahora),
        fuente: f ? F.metadatos(f) : null, filas,
      };
      for (const campo of ['name', 'description', 'color', 'created_at', 'updated_at', 'fuente']) sinSustitutos(col[campo], campo, __('de la biblioteca {0} de la copia', k));
      return col;
    });
    const busquedas = busq.map((s, i) => {
      if (!esDict(s)) throw new ErrorPy('ValueError', __('La búsqueda guardada {0} de la copia no es un objeto.', i + 1));
      const filtros = dget(s, 'filters', {});
      if (!esDict(filtros)) throw new ErrorPy('ValueError', __('«filters» de la búsqueda guardada {0} debe ser un objeto.', i + 1));
      validarFiltros(filtros, i + 1);
      const query = textoO(dget(s, 'query'), '');
      const modo = dget(s, 'mode');
      const mode = modo === null || modo === '' ? 'keyword' : modo;
      if (typeof mode !== 'string' || !MODOS_COPIA.includes(mode)) {
        throw new ErrorPy('ValueError', __('La búsqueda guardada {0} de la copia usa un modo de búsqueda que esta versión no admite ({1}).', i + 1, C.pyRepr(mode)));
      }
      const b = {
        name: C.strip(textoO(dget(s, 'name'), '')) || L.cortar(query, 40) || __('Busqueda'), corpus: textoO(dget(s, 'corpus'), nombreCorpus),
        mode, query, filters: plano(filtros),
        variants: verdad(dget(s, 'variants')) ? 1 : 0, created_at: textoO(dget(s, 'created_at'), ahora),
      };
      for (const campo of ['name', 'corpus', 'query', 'created_at']) sinSustitutos(b[campo], campo, __('de la búsqueda guardada {0} de la copia', i + 1));
      return b;
    });

    const ids = {};
    const nuevas = [];
    let nItems = 0;
    lib._tx(() => {
      const L2 = lib;
      for (const c of preparadas) {
        L2._ejecutar('INSERT INTO collections (name, description, color, created_at, updated_at, fuente) VALUES (?,?,?,?,?,?)',
          [c.name, c.description, c.color, c.created_at, c.updated_at, c.fuente ? J.dumps(c.fuente, { ensure_ascii: false }) : null]);
        const id = Number(lib.sqlite3.capi.sqlite3_last_insert_rowid(lib.db.pointer));
        if (c.idAntiguo !== null && !(c.idAntiguo in ids)) ids[c.idAntiguo] = id;
        nuevas.push(id);
        let base = 0;
        for (const it of c.filas) if (it.position !== null && it.position > base) base = Number(it.position);
        let k = 0;
        for (const it of c.filas) {
          const pos = it.position !== null ? it.position : base + (++k);
          nItems += L2._ejecutar(`INSERT OR IGNORE INTO items (collection_id, corpus, speech_id, note, tags, char_start, char_end, added_at, position)
            VALUES (?,?,?,?,?,?,?,?,?)`, [id, it.corpus, it.speech_id, it.note, J.dumps(it.tags, { ensure_ascii: false }), it.char_start, it.char_end, it.added_at, pos]);
        }
      }
      for (const s of busquedas) {
        const filtros = Object.assign({}, s.filters);
        if (Object.prototype.hasOwnProperty.call(filtros, 'collection_id')) {
          const cid = filtros.collection_id;
          const vacio = cid === null || cid === '' || cid === 0 || cid === false;
          if (!vacio) {
            const clave = esEntero(cid) || typeof cid === 'string' ? C.strip(C.pyStr(cid)) : null;
            filtros.collection_id = clave !== null && Object.prototype.hasOwnProperty.call(ids, clave) ? ids[clave] : -1;
          }
        }
        L2._ejecutar('INSERT INTO saved_searches (name, corpus, mode, query, filters, variants, created_at) VALUES (?,?,?,?,?,?,?)',
          [s.name, s.corpus, s.mode, s.query, J.dumps(filtros, { ensure_ascii: false }), s.variants, s.created_at]);
      }
    });
    return {
      format: FORMATO_COPIA,
      collections: nuevas.map((id) => lib.get_collection(id)),
      n_collections: nuevas.length,
      n_items: nItems,
      n_searches: busquedas.length,
      ids,
    };
  }

  R2.paquetes = {
    FORMATO, FORMATO_COPIA, exportarBiblioteca, importarBiblioteca, exportarTodas, importarCopia, leerFilas, slug,
    nombreCopia,
  };
})(globalThis.R2 = globalThis.R2 || {});

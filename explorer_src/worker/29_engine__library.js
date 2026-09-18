/* ===== src/engine/library.js ===== */
/* 2REP_Standalone · engine/library.js
 *
 * Port de app/backend/library.py (clase Library): bibliotecas del investigador sobre una SEGUNDA base SQLite en memoria
 * (sqlite-wasm), con el SCHEMA exacto del escritorio, así que se conservan igual AUTOINCREMENT y sqlite_sequence,
 * INSERT OR IGNORE, position = max + k, updated_at, los órdenes (updated_at DESC, created_at DESC, position), el borrado
 * atómico y collection_existio. Corre en el worker (grupo «engine» de src/orden.json); no toca el DOM.
 *
 * Divergencias deliberadas (ARQUITECTURA.md §9):
 *   - saved_searches no lleva la columna de la búsqueda Combinada que añade la migración del escritorio: Standalone no
 *     tiene búsqueda semántica (la clave tampoco sale en /api/searches). La migración aditiva de «fuente» sí se aplica.
 *   - Persistencia: la base se serializa (sqlite3_js_db_export) tras cada cambio confirmado y se reinyecta con
 *     sqlite3_deserialize; `version` cuenta los cambios confirmados.
 *
 * API
 *   const lib = R2.library.abrir(sqlite3, { bytes, reloj })   bytes: Uint8Array de exportarBytes() o nada (base nueva)
 *   lib.list_collections() · create_collection(name, description, color) · get_collection(cid) ·
 *   set_collection_fuente(cid, metadatos) · update_collection(cid, campos) · delete_collection(cid) ·
 *   collection_existio(cid) · add_items(cid, corpus, ids, note, tags, span) · add_items_bulk(cid, corpus, items) ·
 *   notas_resumen(cid, corpus, limit) · remove_items(cid, ids, corpus) · update_item(cid, corpus, sid, note, tags) ·
 *   item_ids(cid, corpus) · items_meta(cid, corpus) → Map · item_meta(cid, corpus, sid) ·
 *   membership(corpus, ids) → Map · list_searches(corpus) · save_search(name, corpus, mode, query, filters, variants) ·
 *   delete_search(sid) · exportarBytes() · cerrar() · version · alCambiar(fn)
 *   R2.library.establecer(lib) / actual() / membershipObjeto(corpus, ids)   biblioteca vigente del worker (la usan las
 *   rutas de la biblioteca y /api/search para las marcas ◆)
 *   R2.library.reloj: () => Date   hora de pared (las pruebas de paridad la congelan)
 *
 * Valores Python: bool se enlaza como entero (True → 1), None como NULL, int y str como tales; una lista o un dict dan
 * ProgrammingError «Error binding parameter N: type 'list' is not supported», como sqlite3 de Python 3.12. El TEXT se
 * lee como bytes y se decodifica sin quitar un U+FEFF inicial (la API oo1 lo quita; ARQUITECTURA.md §4.2).
 */
(function (R2) {
  'use strict';

  const C = R2.py.core;
  const J = R2.py.json;

  const SCHEMA = `
CREATE TABLE IF NOT EXISTS collections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    color       TEXT DEFAULT 'indigo',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    corpus        TEXT NOT NULL,
    speech_id     INTEGER NOT NULL,
    note          TEXT DEFAULT '',
    tags          TEXT DEFAULT '[]',
    char_start    INTEGER,
    char_end      INTEGER,
    added_at      TEXT NOT NULL,
    position      INTEGER DEFAULT 0,
    UNIQUE(collection_id, corpus, speech_id)
);
CREATE INDEX IF NOT EXISTS idx_items_col ON items(collection_id, position);

CREATE TABLE IF NOT EXISTS saved_searches (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    corpus     TEXT NOT NULL,
    mode       TEXT NOT NULL,
    query      TEXT DEFAULT '',
    filters    TEXT DEFAULT '{}',
    variants   INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);
`;

  const INT64_MAX = 2n ** 63n - 1n;
  const INT64_MIN = -(2n ** 63n);
  const DEC = new TextDecoder('utf-8', { ignoreBOM: true });

  /** Excepción con la clase de Python (name = pyTipo), para que «Error interno: Tipo: mensaje» sea el del escritorio. */
  class ErrorPy extends Error {
    constructor(tipo, mensaje) {
      super(mensaje);
      this.name = tipo;
      this.pyTipo = tipo;
    }
  }

  const reloj = { ahora: () => new Date() };
  /** library.now(): time.strftime("%Y-%m-%dT%H:%M:%S") en hora local. */
  const now = () => C.strftime('%Y-%m-%dT%H:%M:%S', reloj.ahora());

  /** Nombre de tipo de Python de un valor JSON (para los mensajes de enlace). */
  function tipoPy(v) {
    if (Array.isArray(v)) return 'list';
    if (v instanceof Map) return 'dict';
    if (v !== null && typeof v === 'object') return C.esFloatEnvuelto(v) ? 'float' : 'dict';
    return typeof v;
  }

  /**
   * Primer tramo de sustitutos UTF-16 sueltos de un texto, en puntos de código como los cuenta Python ({desde, hasta, unidad})
   * o null. Un par alto+bajo bien formado es un solo punto de código y corta el tramo.
   */
  function sustitutosSueltos(s) {
    let cp = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { i++; cp++; continue; }
      if (c >= 0xd800 && c <= 0xdfff) {
        let hasta = cp + 1;
        for (let j = i + 1; j < s.length; j++) {
          const d = s.charCodeAt(j);
          if (d < 0xd800 || d > 0xdfff) break;
          if (d <= 0xdbff && j + 1 < s.length && (s.charCodeAt(j + 1) & 0xfc00) === 0xdc00) break;
          hasta++;
        }
        return { desde: cp, hasta, unidad: c };
      }
      cp++;
    }
    return null;
  }

  /**
   * UnicodeEncodeError de sqlite3 de Python al enlazar un texto con sustitutos sueltos (PyUnicode_AsUTF8AndSize): el escritorio
   * responde 500 y no guarda nada. sqlite-wasm los cambiaría en silencio por U+FFFD (TextEncoder).
   */
  function errorSustitutos(t) {
    const que = t.hasta === t.desde + 1
      ? `character '\\u${t.unidad.toString(16).padStart(4, '0')}' in position ${t.desde}`
      : `characters in position ${t.desde}-${t.hasta - 1}`;
    return new ErrorPy('UnicodeEncodeError', `'utf-8' codec can't encode ${que}: surrogates not allowed`);
  }

  /** Convierte un parámetro como el módulo sqlite3 de Python (índice N desde 1 en el mensaje). */
  function enlazar(valores) {
    return valores.map((v, i) => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'string') {
        const t = sustitutosSueltos(v);
        if (t) throw errorSustitutos(t);
        return v;
      }
      if (typeof v === 'bigint') {
        if (v > INT64_MAX || v < INT64_MIN) throw new ErrorPy('OverflowError', 'Python int too large to convert to SQLite INTEGER');
        return v;
      }
      if (typeof v === 'number') {
        if (Number.isInteger(v) && !Number.isSafeInteger(v)) {
          const b = BigInt(v);
          if (b > INT64_MAX || b < INT64_MIN) throw new ErrorPy('OverflowError', 'Python int too large to convert to SQLite INTEGER');
          return b;
        }
        return v;
      }
      if (C.esFloatEnvuelto(v)) return C.num(v);
      throw new ErrorPy('ProgrammingError', `Error binding parameter ${i + 1}: type '${tipoPy(v)}' is not supported`);
    });
  }

  const aNumero = (v) => (typeof v === 'bigint' && v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v);

  /** Python: bool(v) sobre valores JSON. */
  function verdad(v) {
    if (v === null || v === undefined || v === false || v === 0 || v === 0n || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof Map) return v.size > 0;
    if (typeof v === 'object') return C.esFloatEnvuelto(v) ? C.num(v) !== 0 : Object.keys(v).length > 0;
    return true;
  }

  /** str[:n] de Python (por puntos de código). */
  function cortar(s, n) {
    if (s.length <= n) return s;
    let i = 0, k = 0;
    while (i < s.length && k < n) {
      const c = s.charCodeAt(i);
      i += c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00 ? 2 : 1;
      k++;
    }
    return s.slice(0, i);
  }

  /** json.loads de un texto guardado por esta misma clase (json.dumps): objetos planos. */
  function cargarJson(texto) {
    return JSON.parse(texto);
  }

  const dumps = (v) => J.dumps(v, { ensure_ascii: false });

  /**
   * Filas como objetos con las columnas en orden (sqlite3.Row de Python). TEXT exacto, sin quitar un U+FEFF inicial;
   * enteros fuera de ±2^53 en BigInt. Sirve para la base de bibliotecas y para la del corpus.
   */
  function consultar(sqlite3, db, sql, bind) {
    const { capi, wasm } = sqlite3;
    const st = db.prepare(sql);
    const out = [];
    try {
      if (bind && bind.length) st.bind(enlazar(bind));
      const n = st.columnCount;
      const nombres = [];
      for (let i = 0; i < n; i++) nombres.push(st.getColumnName(i));
      while (st.step()) {
        const fila = {};
        for (let i = 0; i < n; i++) {
          const t = capi.sqlite3_column_type(st.pointer, i);
          let v;
          if (t === capi.SQLITE_NULL) v = null;
          else if (t === capi.SQLITE_TEXT || t === capi.SQLITE_BLOB) {
            const p = capi.sqlite3_column_blob(st.pointer, i);
            const len = capi.sqlite3_column_bytes(st.pointer, i);
            v = len ? DEC.decode(wasm.heap8u().slice(p, p + len)) : '';
          } else v = aNumero(st.get(i));
          fila[nombres[i]] = v;
        }
        out.push(fila);
      }
    } finally {
      st.finalize();
    }
    return out;
  }

  class Biblioteca {
    constructor(sqlite3, db) {
      this.sqlite3 = sqlite3;
      this.db = db;
      this.version = 0;
      this._oyentes = [];
    }

    // ------------------------------------------------------------------------------------------------ SQL
    _filas(sql, bind) {
      return consultar(this.sqlite3, this.db, sql, bind);
    }

    /** Ejecuta una sentencia y devuelve sqlite3_changes (rowcount de Python para INSERT/UPDATE/DELETE). */
    _ejecutar(sql, bind) {
      const st = this.db.prepare(sql);
      try {
        if (bind && bind.length) st.bind(enlazar(bind));
        st.step();
      } finally {
        st.finalize();
      }
      return this.sqlite3.capi.sqlite3_changes(this.db.pointer);
    }

    _valor(sql, bind) {
      const f = this._filas(sql, bind);
      if (!f.length) return undefined;
      const k = Object.keys(f[0])[0];
      return f[0][k];
    }

    /** Transacción de un método de Library: BEGIN … COMMIT (commit de Python), ROLLBACK si lanza. */
    _tx(fn) {
      this.db.exec('BEGIN');
      let r;
      try {
        r = fn();
      } catch (e) {
        if (e && e.confirmarParcial) {
          this.db.exec('COMMIT');
          this._cambio();
        } else {
          try { this.db.exec('ROLLBACK'); } catch (e2) { /* sin transacción */ }
        }
        throw e;
      }
      this.db.exec('COMMIT');
      this._cambio();
      return r;
    }

    _cambio() {
      this.version++;
      for (const f of this._oyentes) {
        try { f(this.version); } catch (e) { /* un oyente no rompe la operación */ }
      }
    }

    alCambiar(fn) {
      this._oyentes.push(fn);
      return () => { this._oyentes = this._oyentes.filter((x) => x !== fn); };
    }

    // ------------------------------------------------------------------------------------------------ colección
    /**
     * Bibliotecas visibles. Con `corpus`, solo las que tienen intervenciones de ese corpus (país) o están vacías, y
     * n_items cuenta solo las de ese corpus: las bibliotecas de otros países no se mezclan.
     */
    list_collections(corpus = null) {
      if (corpus === null || corpus === undefined) {
        const rows = this._filas(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM items i WHERE i.collection_id = c.id) AS n_items
            FROM collections c ORDER BY c.updated_at DESC
        `);
        return rows.map(conFuente);
      }
      const rows = this._filas(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM items i WHERE i.collection_id = c.id AND i.corpus = ?) AS n_items,
                   (SELECT COUNT(*) FROM items i WHERE i.collection_id = c.id) AS n_total
            FROM collections c ORDER BY c.updated_at DESC
        `, [corpus]);
      return rows.filter((r) => Number(r.n_items) > 0 || Number(r.n_total) === 0).map((r) => { delete r.n_total; return conFuente(r); });
    }

    create_collection(name, description = '', color = 'indigo') {
      const nombre = C.strip(verdad(name) ? name : '') || 'Biblioteca sin titulo';
      const id = this._tx(() => {
        this._ejecutar('INSERT INTO collections (name, description, color, created_at, updated_at) VALUES (?,?,?,?,?)',
          [nombre, description, color, now(), now()]);
        return aNumero(this.sqlite3.capi.sqlite3_last_insert_rowid(this.db.pointer));
      });
      return this.get_collection(id);
    }

    get_collection(cid) {
      const r = this._filas('SELECT * FROM collections WHERE id = ?', [cid]);
      if (!r.length) return null;
      const d = conFuente(r[0]);
      d.n_items = this._valor('SELECT COUNT(*) FROM items WHERE collection_id = ?', [cid]);
      return d;
    }

    set_collection_fuente(cid, metadatos) {
      this._tx(() => {
        this._ejecutar('UPDATE collections SET fuente = ? WHERE id = ?', [verdad(metadatos) ? dumps(metadatos) : null, cid]);
      });
    }

    /** update_collection(cid, **fields): `campos` es un objeto con las claves en el orden de llegada. */
    update_collection(cid, campos) {
      const permitidos = Object.keys(campos || {}).filter((k) => k === 'name' || k === 'description' || k === 'color');
      if (permitidos.length) {
        const sets = permitidos.map((k) => `${k} = ?`).join(', ');
        this._tx(() => {
          this._ejecutar(`UPDATE collections SET ${sets}, updated_at = ? WHERE id = ?`, permitidos.map((k) => campos[k]).concat([now(), cid]));
        });
      }
      return this.get_collection(cid);
    }

    /** Borra la biblioteca y sus intervenciones en UNA transacción. {id, name, n_items} o null si no existía. */
    delete_collection(cid) {
      const col = this.get_collection(cid);
      if (col === null) return null;
      this._tx(() => {
        this._ejecutar('DELETE FROM items WHERE collection_id = ?', [cid]);
        this._ejecutar('DELETE FROM collections WHERE id = ?', [cid]);
      });
      return { id: col.id, name: col.name, n_items: col.n_items };
    }

    /** ¿Se creó alguna vez una biblioteca con ese id? (sqlite_sequence no baja al borrar). null si no se puede saber. */
    collection_existio(cid) {
      let seq;
      try {
        seq = this._filas("SELECT seq FROM sqlite_sequence WHERE name = 'collections'");
      } catch (e) {
        return null;
      }
      if (!seq.length || seq[0].seq === null) return null;
      const n = BigInt(cid), s = BigInt(seq[0].seq);
      return n > 0n && n <= s;
    }

    // ------------------------------------------------------------------------------------------------ items
    add_items(cid, corpus, speechIds, note = '', tags = null, span = null) {
      if (!this.get_collection(cid)) throw new ErrorPy('KeyError', `No existe la biblioteca ${C.pyStr(cid)}`);
      let added = 0;
      this._tx(() => {
        const base = this._valor('SELECT COALESCE(MAX(position), 0) FROM items WHERE collection_id = ?', [cid]);
        const tagsJson = dumps(verdad(tags) ? tags : []);
        const [a, b] = span || [null, null];
        speechIds.forEach((sid, i) => {
          added += this._ejecutar(`
                INSERT OR IGNORE INTO items
                    (collection_id, corpus, speech_id, note, tags, char_start, char_end,
                     added_at, position)
                VALUES (?,?,?,?,?,?,?,?,?)
            `, [cid, corpus, sid, note, tagsJson, a, b, now(), sumar(base, i + 1)]);
        });
        this._ejecutar('UPDATE collections SET updated_at = ? WHERE id = ?', [now(), cid]);
      });
      return { added, skipped: speechIds.length - added, collection: this.get_collection(cid) };
    }

    /**
     * Alta en bloque de [speech_id, note, tags] con su nota y etiquetas, en una transacción (importación). Devuelve cuántas
     * se añadieron. Un id que no cabe en 64 bits deja confirmadas las anteriores (como el executemany del escritorio, cuyas
     * filas previas confirma el siguiente commit) y lanza OverflowError.
     */
    add_items_bulk(cid, corpus, items) {
      if (!this.get_collection(cid)) throw new ErrorPy('KeyError', `No existe la biblioteca ${C.pyStr(cid)}`);
      let added = 0;
      this._tx(() => {
        const base = this._valor('SELECT COALESCE(MAX(position), 0) FROM items WHERE collection_id = ?', [cid]);
        const ts = now();
        const st = this.db.prepare(`
            INSERT OR IGNORE INTO items
                (collection_id, corpus, speech_id, note, tags, char_start, char_end,
                 added_at, position)
            VALUES (?,?,?,?,?,NULL,NULL,?,?)
        `);
        try {
          items.forEach(([sid, nota, etiquetas], i) => {
            let valores;
            try {
              valores = enlazar([cid, corpus, sid, nota, dumps(verdad(etiquetas) ? etiquetas : []), ts, sumar(base, i + 1)]);
            } catch (e) {
              e.confirmarParcial = true;
              throw e;
            }
            st.bind(valores);
            st.step();
            added += this.sqlite3.capi.sqlite3_changes(this.db.pointer);
            st.reset(true);
          });
        } finally {
          st.finalize();
        }
        this._ejecutar('UPDATE collections SET updated_at = ? WHERE id = ?', [now(), cid]);
      });
      return added;
    }

    /** [nota, etiquetas, cuántas] de las `limit` primeras intervenciones (todas con null), agrupadas. */
    notas_resumen(cid, corpus, limit = null) {
      return this._filas(`
            SELECT note, tags, COUNT(*) AS n FROM (
                SELECT note, tags FROM items WHERE collection_id = ? AND corpus = ?
                ORDER BY position LIMIT ?)
            GROUP BY note, tags
        `, [cid, corpus, limit === null || limit === undefined ? -1 : limit])
        .map((r) => [r.note || '', cargarJson(r.tags || '[]'), r.n]);
    }

    remove_items(cid, speechIds, corpus) {
      const q = speechIds.map(() => '?').join(',');
      let removed = 0;
      this._tx(() => {
        removed = this._ejecutar(`DELETE FROM items WHERE collection_id = ? AND corpus = ? AND speech_id IN (${q})`,
          [cid, corpus].concat(speechIds));
        this._ejecutar('UPDATE collections SET updated_at = ? WHERE id = ?', [now(), cid]);
      });
      return { removed, collection: this.get_collection(cid) };
    }

    update_item(cid, corpus, speechId, note = null, tags = null) {
      const sets = [], params = [];
      if (note !== null && note !== undefined) { sets.push('note = ?'); params.push(note); }
      if (tags !== null && tags !== undefined) { sets.push('tags = ?'); params.push(dumps(tags)); }
      if (!sets.length) return false;
      let n = 0;
      this._tx(() => {
        n = this._ejecutar(`UPDATE items SET ${sets.join(', ')} WHERE collection_id = ? AND corpus = ? AND speech_id = ?`,
          params.concat([cid, corpus, speechId]));
        this._ejecutar('UPDATE collections SET updated_at = ? WHERE id = ?', [now(), cid]);
      });
      return n > 0;
    }

    item_ids(cid, corpus) {
      return this._filas('SELECT speech_id FROM items WHERE collection_id = ? AND corpus = ? ORDER BY position', [cid, corpus])
        .map((r) => r.speech_id);
    }

    /** Map speech_id → {note, tags, added_at, position, char_start, char_end}. */
    items_meta(cid, corpus) {
      const out = new Map();
      for (const r of this._filas('SELECT * FROM items WHERE collection_id = ? AND corpus = ?', [cid, corpus])) out.set(r.speech_id, meta(r));
      return out;
    }

    item_meta(cid, corpus, speechId) {
      const r = this._filas('SELECT * FROM items WHERE collection_id = ? AND corpus = ? AND speech_id = ?', [cid, corpus, speechId]);
      return r.length ? meta(r[0]) : null;
    }

    /** Map speech_id → [ids de bibliotecas que la contienen], en el orden de lectura de SQLite. */
    membership(corpus, speechIds) {
      const out = new Map();
      if (!speechIds.length) return out;
      const q = speechIds.map(() => '?').join(',');
      for (const r of this._filas(`SELECT speech_id, collection_id FROM items WHERE corpus = ? AND speech_id IN (${q})`, [corpus].concat(speechIds))) {
        if (!out.has(r.speech_id)) out.set(r.speech_id, []);
        out.get(r.speech_id).push(r.collection_id);
      }
      return out;
    }

    // ------------------------------------------------------------------------------------------------ búsquedas guardadas
    list_searches(corpus = null) {
      const rows = this._filas('SELECT * FROM saved_searches WHERE (? IS NULL OR corpus = ?) ORDER BY created_at DESC', [corpus, corpus]);
      const vivas = new Set(this._filas('SELECT id FROM collections').map((r) => String(r.id)));
      return rows.map((r) => {
        const d = Object.assign({}, r, { filters: cargarJson(r.filters || '{}') });
        const f = d.filters;
        const cid = f !== null && typeof f === 'object' && !Array.isArray(f) ? (Object.prototype.hasOwnProperty.call(f, 'collection_id') ? f.collection_id : null) : null;
        let valida = false;
        if ((typeof cid === 'number' && Number.isInteger(cid)) || typeof cid === 'string') {
          const s = C.strip(C.pyStr(cid));
          if (s !== '' && C.isdigit(s)) valida = vivas.has(String(pyIntExacto(typeof cid === 'string' ? cid : C.pyStr(cid))));
        }
        const vacio = cid === null || cid === undefined || cid === '' || cid === 0 || cid === false;
        d.biblioteca_borrada = !vacio && !valida;
        return d;
      });
    }

    save_search(name, corpus, mode, query, filters, variants = false) {
      const id = this._tx(() => {
        this._ejecutar('INSERT INTO saved_searches (name, corpus, mode, query, filters, variants, created_at) VALUES (?,?,?,?,?,?,?)',
          [C.strip(name || '') || cortar(query, 40) || 'Busqueda', corpus, mode, query,
            dumps(verdad(filters) ? filters : {}), verdad(variants) ? 1 : 0, now()]);
        return aNumero(this.sqlite3.capi.sqlite3_last_insert_rowid(this.db.pointer));
      });
      const r = this._filas('SELECT * FROM saved_searches WHERE id = ?', [id])[0];
      return Object.assign({}, r, { filters: cargarJson(r.filters || '{}') });
    }

    delete_search(sid) {
      let n = 0;
      this._tx(() => { n = this._ejecutar('DELETE FROM saved_searches WHERE id = ?', [sid]); });
      return n > 0;
    }

    // ------------------------------------------------------------------------------------------------ bytes
    /** La base entera serializada (formato de archivo SQLite). */
    exportarBytes() {
      return this.sqlite3.capi.sqlite3_js_db_export(this.db.pointer);
    }

    /** Resumen para la persistencia y las pruebas. */
    resumen() {
      return {
        version: this.version,
        colecciones: this._valor('SELECT COUNT(*) FROM collections'),
        items: this._valor('SELECT COUNT(*) FROM items'),
        busquedas: this._valor('SELECT COUNT(*) FROM saved_searches'),
      };
    }

    cerrar() {
      try { this.db.close(); } catch (e) { /* ya cerrada */ }
    }
  }

  const sumar = (a, b) => (typeof a === 'bigint' ? a + BigInt(b) : a + b);

  function meta(r) {
    return { note: r.note, tags: cargarJson(r.tags || '[]'), added_at: r.added_at, position: r.position,
      char_start: r.char_start, char_end: r.char_end };
  }

  /** _con_fuente: la columna fuente (JSON) como objeto, o null. */
  function conFuente(d) {
    let v = null;
    if (verdad(d.fuente)) {
      try { v = JSON.parse(d.fuente); } catch (e) { v = null; }
    }
    d.fuente = v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null;
    return d;
  }

  /** int(s) de Python sobre un texto ya comprobado con isdigit: ValueError con el mensaje de Python si no convierte. */
  function pyIntExacto(s) {
    try {
      return R2.transformar.pyInt(s);
    } catch (e) {
      throw errorInt(s, e);
    }
  }

  function errorInt(s, e) {
    if (e && e.motivo === 'limite') {
      const n = [...s].filter((ch) => /[0-9]/.test(ch)).length;
      return new ErrorPy('ValueError', `Exceeds the limit (4300 digits) for integer string conversion: value has ${n} digits; use sys.set_int_max_str_digits() to increase the limit`);
    }
    return new ErrorPy('ValueError', `invalid literal for int() with base 10: ${C.pyRepr(s)}`);
  }

  // ------------------------------------------------------------------------------------------------ apertura
  const TABLAS = ['collections', 'items', 'saved_searches'];

  /**
   * Abre la biblioteca. Con `bytes`, los deserializa (base escribible) y comprueba que es una base de bibliotecas; si no
   * lo es, lanza ErrorPy('DatabaseError') sin tocar nada. Sin bytes, base nueva con el SCHEMA.
   */
  function abrir(sqlite3, opciones = {}) {
    const { capi, wasm, oo1 } = sqlite3;
    const db = new oo1.DB(':memory:', 'c');
    try {
      const bytes = opciones.bytes;
      if (bytes && bytes.length) {
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const p = wasm.allocFromTypedArray(u8);
        const rc = capi.sqlite3_deserialize(db.pointer, 'main', p, u8.length, u8.length,
          capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE);
        if (rc !== 0) throw new ErrorPy('DatabaseError', `sqlite3_deserialize: ${capi.sqlite3_js_rc_str(rc)}`);
        let ok;
        try {
          ok = db.selectValue('PRAGMA quick_check') === 'ok';
        } catch (e) {
          throw new ErrorPy('DatabaseError', `la copia guardada no es una base SQLite válida (${e.message})`);
        }
        if (!ok) throw new ErrorPy('DatabaseError', 'la copia guardada está dañada (quick_check)');
        const hay = new Set(db.selectValues("SELECT name FROM sqlite_master WHERE type = 'table'"));
        const faltan = TABLAS.filter((t) => !hay.has(t));
        if (faltan.length) throw new ErrorPy('DatabaseError', `la copia guardada no es una base de bibliotecas (faltan ${faltan.join(', ')})`);
      }
      db.exec('PRAGMA foreign_keys = ON');
      db.exec(SCHEMA);
      const cols = new Set(db.selectArrays('PRAGMA table_info(collections)').map((r) => r[1]));
      if (!cols.has('fuente')) db.exec('ALTER TABLE collections ADD COLUMN fuente TEXT');
    } catch (e) {
      try { db.close(); } catch (e2) { /* nada */ }
      throw e;
    }
    return new Biblioteca(sqlite3, db);
  }

  // ------------------------------------------------------------------------------------------------ vigente
  let vigente = null;

  R2.library = {
    SCHEMA, INT64_MAX, INT64_MIN, ErrorPy, Biblioteca, abrir, now, verdad, cortar, enlazar, consultar, errorInt, pyIntExacto,
    sustitutosSueltos,
    /** except ValueError de Python: ValueError y sus subclases que puede lanzar este motor. */
    esValueError: (e) => !!e && ['ValueError', 'UnicodeError', 'UnicodeEncodeError', 'UnicodeDecodeError', 'JSONDecodeError'].includes(e.name),
    set reloj(f) { reloj.ahora = typeof f === 'function' ? f : () => new Date(); },
    get reloj() { return reloj.ahora; },
    establecer(lib) { vigente = lib || null; },
    actual() { return vigente; },
    /** {speech_id: [cids]} para /api/search (vacío si aún no hay biblioteca). */
    membershipObjeto(corpus, ids) {
      const out = {};
      if (!vigente || !ids || !ids.length) return out;
      for (const [k, v] of vigente.membership(corpus, ids)) out[String(k)] = v;
      return out;
    },
  };
})(globalThis.R2 = globalThis.R2 || {});

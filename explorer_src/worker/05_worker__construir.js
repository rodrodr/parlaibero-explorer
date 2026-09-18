/* ===== src/worker/construir.js ===== */
/* Diarios Explorer · worker/construir.js
 *
 * Construcción de la base del corpus en memoria (sqlite-wasm) a partir del CSV de intervenciones de un país
 * (16 columnas: id_session, id_int, legislature, legislative_session, session_number, date, session_type,
 * intervention_order, speaker_raw, id_dep, speaker_name, sex, party, district, dm_speech, text).
 *
 * Esquema:
 * - speeches_datos: una fila por intervención, con id entero denso (1…n, el orden del archivo), num_session (índice de la
 *   sesión por orden de aparición de id_session), rep_id (índice del diputado por orden de aparición de id_dep) y la
 *   posición del texto en su bloque comprimido (bloque, desde, largo). El texto no se guarda en claro.
 * - texto_bloques: bloques gzip de ~128 KiB con los textos concatenados (worker/texto.js).
 * - speeches: VISTA que añade la columna speech = r2_texto(bloque, desde, largo). Todo el motor consulta la vista.
 * - speeches_fts: FTS5 (unicode61, remove_diacritics 2) con contenido externo en la vista; se alimenta al insertar.
 * - meta: facets (JSON), n_speeches, n_sessions, pais, formato_texto.
 *
 * Convenciones heredadas del motor: rep_name y party/district/legislature vacíos → «Sin identificar»; una fila sin orador
 * (dm_speech = 0) lleva speaker «SUMARIO» si es la fila 0 de la sesión (encabezado/sumario) y «COMENTARIOS» en otro caso.
 */
(function (R2) {
  'use strict';

  const E = R2.errores, T = R2.transformar, TX = R2.texto;
  if (!E || !T || !TX) throw new Error('worker/construir.js necesita R2.errores, R2.transformar y R2.texto');

  const SQLITE_OK = 0, SQLITE_NOMEM = 7, SQLITE_DONE = 101;
  const SIN_IDENTIFICAR = T.SIN_IDENTIFICAR;
  const FORMATO_TEXTO = 'bloques-gzip-1';
  /** Bytes de texto por bloque comprimido (un texto mayor ocupa un bloque él solo). */
  const BLOQUE_BYTES = 128 * 1024;

  const COLUMNAS_VISTA = ['id', 'id_int', 'id_session', 'num_session', 'session_number', 'ord', 'date', 'year', 'legislature',
    'legislative_session', 'session_type', 'speaker', 'rep_id', 'id_dep', 'rep_name', 'sex', 'district', 'party', 'dm_speech',
    'nwords', 'largo AS nbytes', `${TX.NOMBRE_FUNCION}(bloque, desde, largo) AS speech`];

  const SQL_ESQUEMA = `
PRAGMA journal_mode = OFF;
PRAGMA synchronous  = OFF;
PRAGMA temp_store = MEMORY;

CREATE TABLE speeches_datos (
    id                  INTEGER PRIMARY KEY,
    id_int              TEXT,
    id_session          TEXT,
    num_session         INTEGER,
    session_number      TEXT,       -- tal cual viene (puede ser «1A»)
    ord                 INTEGER,
    date                TEXT,
    year                INTEGER,
    legislature         TEXT,
    legislative_session TEXT,
    session_type        TEXT,
    speaker             TEXT,
    rep_id              INTEGER,
    id_dep              TEXT,
    rep_name            TEXT,
    sex                 TEXT,
    district            TEXT,
    party               TEXT,
    dm_speech           INTEGER,
    nwords              INTEGER,
    bloque              INTEGER,
    desde               INTEGER,
    largo               INTEGER
);

CREATE TABLE texto_bloques (id INTEGER PRIMARY KEY, formato TEXT, datos BLOB);

CREATE VIEW speeches AS SELECT ${COLUMNAS_VISTA.join(', ')} FROM speeches_datos;

CREATE VIRTUAL TABLE speeches_fts USING fts5(
    speech,
    content='speeches',
    content_rowid='id',
    tokenize="unicode61 remove_diacritics 2"
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
`;

  const INDICES = Object.freeze([
    'CREATE INDEX idx_session ON speeches_datos(date, num_session, ord)',
    'CREATE INDEX idx_nwords  ON speeches_datos(nwords)',
    'CREATE INDEX idx_rep     ON speeches_datos(rep_id)',
  ]);

  /** Filas por transacción al insertar. */
  const FILAS_POR_LOTE = 5000;
  /** Instrucciones de la máquina virtual de SQLite entre dos llamadas del progress handler. */
  const OPS_POR_LATIDO = 1000;
  const INT64_MAX = 9223372036854775807n, INT64_MIN = -9223372036854775808n;

  /** Base :memory: con el esquema creado y r2_texto instalada. pageSize: potencia de 2 entre 512 y 65536. */
  function abrirBase(sqlite3, { pageSize }) {
    if (!(pageSize >= 512 && pageSize <= 65536 && (pageSize & (pageSize - 1)) === 0)) {
      throw new RangeError(`page_size no válido: ${pageSize}`);
    }
    const db = new sqlite3.oo1.DB(':memory:');
    try {
      db.exec(`PRAGMA page_size = ${pageSize}`); // antes de crear la primera tabla
      db.r2Texto = TX.instalar(sqlite3, db);
      db.exec(SQL_ESQUEMA);
      return db;
    } catch (e) {
      db.close();
      throw e;
    }
  }

  /**
   * Memoria de una columna: bytes del campo → valor derivado. Evita decodificar y transformar otra vez los
   * valores que se repiten (fechas, oradores, partidos…).
   */
  class Memo {
    constructor(fabrica) {
      this.fabrica = fabrica; // (cadena) → valor
      this.mapa = new Map(); // hash FNV-1a → [bytes, valor, bytes, valor, …]
      this.td = new TextDecoder('utf-8', { ignoreBOM: true }); // los bytes ya son UTF-8 válido
      this.distintos = 0;
    }

    obtener(b, a, z) {
      const n = z - a;
      let h = 0x811c9dc5 ^ n;
      for (let k = a; k < z; k++) h = Math.imul(h ^ b[k], 0x01000193);
      let lista = this.mapa.get(h);
      if (lista === undefined) {
        lista = [];
        this.mapa.set(h, lista);
      } else {
        siguiente: for (let i = 0; i < lista.length; i += 2) {
          const clave = lista[i];
          if (clave.length !== n) continue;
          for (let j = 0; j < n; j++) if (clave[j] !== b[a + j]) continue siguiente;
          return lista[i + 1];
        }
      }
      const clave = b.slice(a, z);
      const valor = this.fabrica(this.td.decode(clave));
      lista.push(clave, valor);
      this.distintos++;
      return valor;
    }
  }

  /**
   * Inserta las filas del CSV en speeches_datos y speeches_fts con sentencias preparadas y llamadas directas a las
   * exportaciones del wasm (sqlite3_bind_*, sqlite3_step). Los valores cortos se memorizan ya convertidos en cadenas C
   * del heap wasm; el texto se copia de los bytes del CSV al heap para el FTS y a los bloques comprimidos.
   */
  class Insertador {
    constructor(sqlite3, db) {
      this.sqlite3 = sqlite3;
      this.db = db;
      this.X = sqlite3.wasm.exports;
      this.cadenas = []; // punteros de las cadenas C memorizadas (se liberan al cerrar)
      this.textoP = 0; // búfer del texto en el heap wasm (FTS)
      this.textoCapacidad = 0;
      this.idP = 0; // búfer de id_int en el heap wasm
      this.idCapacidad = 0;
      this.td = new TextDecoder('utf-8', { ignoreBOM: true });

      this.insertadas = 0;
      this.bytesTexto = 0;
      this.bytesComprimidos = 0;
      this.filasDoc = 0;
      this.enLote = 0;
      this.pais = null;
      this.sesiones = new Map(); // id_session → num_session (por orden de aparición)
      this.diputados = new Map(); // id_dep → rep_id (por orden de aparición)

      // Bloques de texto
      this.bloqueId = 1;
      this.bloqueBuf = new Uint8Array(BLOQUE_BYTES * 2);
      this.bloquePos = 0;
      this.pendientes = []; // { id, raw } cerrados y aún sin comprimir
      this.nBloques = 0;
      this.sinCompresion = !TX.hayCompresion;

      const c = (s) => this._cadena(s);
      this.cSumario = c('SUMARIO');
      this.cComentarios = c('COMENTARIOS');
      this.cSinIdentificar = c(SIN_IDENTIFICAR);
      this.memos = {
        sesion: new Memo((s) => {
          const texto = T.pyStrip(s);
          let num = this.sesiones.get(texto);
          if (num === undefined) { num = this.sesiones.size + 1; this.sesiones.set(texto, num); }
          if (this.pais === null && /^[A-Za-z]{2}/.test(texto)) this.pais = texto.slice(0, 2).toUpperCase();
          return { s: c(texto), num };
        }),
        legislatura: new Memo((s) => c(T.derivar.sinIdentificar(s))),
        periodo: new Memo((s) => c(T.derivar.sinIdentificar(s))),
        numeroSesion: new Memo((s) => { const v = T.pyStrip(s); return v ? c(v) : null; }),
        fecha: new Memo((s) => {
          let year = null;
          try { year = T.anio(s); } catch (e) { year = null; }
          return { date: s ? c(s) : null, year };
        }),
        tipo: new Memo((s) => c(T.derivar.sinIdentificar(s))),
        orador: new Memo((s) => { const v = T.pyStrip(s); return v ? c(v) : null; }),
        diputadoId: new Memo((s) => {
          const texto = T.pyStrip(s);
          if (!texto) return { s: null, rep_id: null };
          let rep = this.diputados.get(texto);
          if (rep === undefined) { rep = this.diputados.size + 1; this.diputados.set(texto, rep); }
          return { s: c(texto), rep_id: rep };
        }),
        diputado: new Memo((s) => c(T.pyStrip(s) || SIN_IDENTIFICAR)),
        sexo: new Memo((s) => c(T.pyStrip(s).toUpperCase() || SIN_IDENTIFICAR)),
        partido: new Memo((s) => c(T.derivar.sinIdentificar(s))),
        distrito: new Memo((s) => c(T.derivar.sinIdentificar(s))),
      };

      this.stmt = db.prepare(`INSERT INTO speeches_datos VALUES (${new Array(T.COLUMNAS_BD.length).fill('?').join(',')})`);
      this.P = this.stmt.pointer;
      this.stmtFts = db.prepare('INSERT INTO speeches_fts(rowid, speech) VALUES (?, ?)');
      this.PF = this.stmtFts.pointer;
      this.stmtBloque = db.prepare('INSERT INTO texto_bloques VALUES (?, ?, ?)');
      db.exec('BEGIN');
    }

    /** Cadena JS → [puntero, bytes] en el heap wasm, viva hasta cerrar(). */
    _cadena(s) {
      const par = this.sqlite3.wasm.allocCString(s, true);
      this.cadenas.push(par[0]);
      return par;
    }

    _texto(P, i, par) {
      return par === null ? this.X.sqlite3_bind_null(P, i) : this.X.sqlite3_bind_text(P, i, par[0], par[1], 0);
    }

    _entero(P, i, v) {
      if (v === null) return this.X.sqlite3_bind_null(P, i);
      if (typeof v === 'number' && (v | 0) === v) return this.X.sqlite3_bind_int(P, i, v);
      return this.X.sqlite3_bind_int64(P, i, BigInt(v));
    }

    /** int() de un campo; `opcional`: vacío → null. Lanza ENTERO_NO_VALIDO. */
    _leerEntero(b, a, z, opcional, columna, fila, byte) {
      const n = z - a;
      if (n === 0 && opcional) return null;
      if (n > 0 && n <= 15) { // camino rápido: solo cifras ASCII
        let v = 0, k = a;
        for (; k < z; k++) {
          const d = b[k] - 0x30;
          if (d < 0 || d > 9) break;
          v = v * 10 + d;
        }
        if (k === z) return v;
      }
      const texto = this.td.decode(b.subarray(a, z));
      try {
        const v = T.pyInt(texto);
        if (typeof v === 'bigint' && (v > INT64_MAX || v < INT64_MIN)) {
          throw E.fallo('ENTERO_NO_VALIDO', { fila, byte, columna, valor: texto, detalle: { motivo: 'rango' } });
        }
        return v;
      } catch (e) {
        if (e instanceof T.ErrorValor) throw E.fallo('ENTERO_NO_VALIDO', { fila, byte, columna, valor: texto, detalle: { motivo: e.motivo } });
        throw e;
      }
    }

    _errorSqlite(rc, fila) {
      const causa = `SQLite rc=${rc}: ${this.sqlite3.capi.sqlite3_errmsg(this.db.pointer)} (fila ${fila})`;
      return E.fallo(rc === SQLITE_NOMEM ? 'MEMORIA' : 'ERROR_INTERNO', { fila, causa });
    }

    /** Copia bytes del CSV a un búfer propio del heap wasm (crece si hace falta) y devuelve el puntero. */
    _alHeap(campo, b, a, z) {
      const wasm = this.sqlite3.wasm;
      const largo = z - a;
      const cap = campo === 'texto' ? this.textoCapacidad : this.idCapacidad;
      let p = campo === 'texto' ? this.textoP : this.idP;
      if (largo + 1 > cap) {
        if (p) wasm.dealloc(p);
        const capacidad = Math.max(largo + 1, 2 * cap, campo === 'texto' ? 1 << 20 : 256);
        p = wasm.alloc(capacidad);
        if (campo === 'texto') { this.textoP = p; this.textoCapacidad = capacidad; } else { this.idP = p; this.idCapacidad = capacidad; }
      }
      if (largo) wasm.heap8u().set(b.subarray(a, z), p); // heap8u(): la vista cambia si crece la memoria
      return p;
    }

    _cerrarBloque() {
      if (this.bloquePos === 0) return;
      this.pendientes.push({ id: this.bloqueId, raw: this.bloqueBuf.slice(0, this.bloquePos) });
      this.bloqueId++;
      this.bloquePos = 0;
    }

    /** Añade el texto al bloque en curso; devuelve [bloque, desde, largo]. */
    _anadirABloque(b, a, z) {
      const n = z - a;
      if (this.bloquePos > 0 && this.bloquePos + n > BLOQUE_BYTES) this._cerrarBloque();
      if (n > this.bloqueBuf.length) {
        const nuevo = new Uint8Array(Math.max(n, this.bloqueBuf.length * 2));
        nuevo.set(this.bloqueBuf.subarray(0, this.bloquePos));
        this.bloqueBuf = nuevo;
      }
      const desde = this.bloquePos;
      if (n) this.bloqueBuf.set(b.subarray(a, z), desde);
      this.bloquePos += n;
      const r = [this.bloqueId, desde, n];
      if (this.bloquePos >= BLOQUE_BYTES) this._cerrarBloque();
      return r;
    }

    /** Comprime e inserta los bloques cerrados (llamar tras cada trozo del archivo y al terminar). */
    async volcarBloques() {
      const lista = this.pendientes;
      if (!lista.length) return;
      this.pendientes = [];
      const comprimidos = this.sinCompresion ? lista.map(() => null) : await Promise.all(lista.map((p) => TX.comprimir(p.raw)));
      const st = this.stmtBloque;
      for (let i = 0; i < lista.length; i++) {
        const gz = comprimidos[i];
        const datos = gz || lista[i].raw;
        st.bind([lista[i].id, gz ? 'gzip' : 'raw', datos]).stepReset();
        this.bytesComprimidos += datos.length;
        this.nBloques++;
      }
    }

    /**
     * Inserta un registro de 16 campos (bytes/fines del lector CSV). Campo k = bytes[k ? f[k-1] : 0 … f[k]).
     * Orden de las columnas del CSV: 0 id_session, 1 id_int, 2 legislature, 3 legislative_session, 4 session_number,
     * 5 date, 6 session_type, 7 intervention_order, 8 speaker_raw, 9 id_dep, 10 speaker_name, 11 sex, 12 party,
     * 13 district, 14 dm_speech, 15 text.
     */
    insertar(b, f, fila, byte) {
      const m = this.memos;
      const a = (k) => (k ? f[k - 1] : 0);
      const id = this.insertadas + 1;
      const sesion = m.sesion.obtener(b, a(0), f[0]);
      const idIntP = this._alHeap('id', b, a(1), f[1]);
      const idIntLargo = f[1] - a(1);
      const legislatura = m.legislatura.obtener(b, a(2), f[2]);
      const periodo = m.periodo.obtener(b, a(3), f[3]);
      const numeroSesion = m.numeroSesion.obtener(b, a(4), f[4]);
      const fecha = m.fecha.obtener(b, a(5), f[5]);
      const tipo = m.tipo.obtener(b, a(6), f[6]);
      const ord = this._leerEntero(b, a(7), f[7], true, 'intervention_order', fila, byte);
      let orador = m.orador.obtener(b, a(8), f[8]);
      const dip = m.diputadoId.obtener(b, a(9), f[9]);
      const nombre = m.diputado.obtener(b, a(10), f[10]);
      const sexo = m.sexo.obtener(b, a(11), f[11]);
      const partido = m.partido.obtener(b, a(12), f[12]);
      const distrito = m.distrito.obtener(b, a(13), f[13]);
      let dmSpeech = this._leerEntero(b, a(14), f[14], true, 'dm_speech', fila, byte);
      const aTexto = a(15), zTexto = f[15], largo = zTexto - aTexto;
      if (dmSpeech === null) dmSpeech = orador === null ? 0 : 1;
      if (orador === null) {
        orador = ord === 0 || ord === null ? this.cSumario : this.cComentarios;
        this.filasDoc++;
      }
      const nwords = T.contarPalabrasUtf8(b, aTexto, zTexto);
      const [bloque, desde, largoBloque] = this._anadirABloque(b, aTexto, zTexto);

      const X = this.X, P = this.P;
      const rc = this._entero(P, 1, id)
        | X.sqlite3_bind_text(P, 2, idIntP, idIntLargo, 0)
        | this._texto(P, 3, sesion.s) | this._entero(P, 4, sesion.num) | this._texto(P, 5, numeroSesion)
        | this._entero(P, 6, ord) | this._texto(P, 7, fecha.date) | this._entero(P, 8, fecha.year)
        | this._texto(P, 9, legislatura) | this._texto(P, 10, periodo) | this._texto(P, 11, tipo)
        | this._texto(P, 12, orador) | this._entero(P, 13, dip.rep_id) | this._texto(P, 14, dip.s)
        | this._texto(P, 15, nombre) | this._texto(P, 16, sexo) | this._texto(P, 17, distrito) | this._texto(P, 18, partido)
        | this._entero(P, 19, dmSpeech) | this._entero(P, 20, nwords)
        | this._entero(P, 21, bloque) | this._entero(P, 22, desde) | this._entero(P, 23, largoBloque);
      if (rc !== SQLITE_OK) throw this._errorSqlite(rc, fila);
      let paso = X.sqlite3_step(P);
      if (paso !== SQLITE_DONE) {
        const err = this._errorSqlite(paso, fila);
        X.sqlite3_reset(P);
        throw err;
      }
      X.sqlite3_reset(P);

      const textoP = this._alHeap('texto', b, aTexto, zTexto);
      const PF = this.PF;
      const rcF = this._entero(PF, 1, id) | X.sqlite3_bind_text(PF, 2, textoP, largo, 0);
      if (rcF !== SQLITE_OK) throw this._errorSqlite(rcF, fila);
      paso = X.sqlite3_step(PF);
      if (paso !== SQLITE_DONE) {
        const err = this._errorSqlite(paso, fila);
        X.sqlite3_reset(PF);
        throw err;
      }
      X.sqlite3_reset(PF);

      this.insertadas++;
      this.bytesTexto += largo;
      if (++this.enLote >= FILAS_POR_LOTE) {
        this.db.exec('COMMIT; BEGIN');
        this.enLote = 0;
      }
      return true;
    }

    /** Valores distintos por columna memorizada (para el informe). */
    distintos() {
      const r = {};
      if (this.memos) for (const [k, memo] of Object.entries(this.memos)) r[k] = memo.distintos;
      r.sesiones = this.sesiones.size;
      r.diputados = this.diputados.size;
      return r;
    }

    /** Cierra el último bloque, lo vuelca, confirma la transacción y libera. */
    async terminar() {
      this._cerrarBloque();
      await this.volcarBloques();
      this.db.exec('COMMIT');
      this.cerrar();
    }

    /** Libera las sentencias y la memoria wasm propia. Se puede llamar más de una vez. */
    cerrar() {
      const wasm = this.sqlite3.wasm;
      for (const k of ['stmt', 'stmtFts', 'stmtBloque']) {
        if (this[k]) {
          try { this[k].finalize(); } catch (e) { /* la base puede estar ya cerrada */ }
          this[k] = null;
        }
      }
      this.P = 0; this.PF = 0;
      if (this.textoP) { wasm.dealloc(this.textoP); this.textoP = 0; this.textoCapacidad = 0; }
      if (this.idP) { wasm.dealloc(this.idP); this.idP = 0; this.idCapacidad = 0; }
      for (const p of this.cadenas) wasm.dealloc(p);
      this.cadenas = [];
      this.memos = null;
      this.pendientes = [];
      this.bloqueBuf = null;
    }
  }

  function crearIndices(db, alIndice) {
    INDICES.forEach((sql, k) => {
      db.exec(sql);
      if (alIndice) alIndice(k + 1, INDICES.length);
    });
  }

  const optimizar = (db) => db.exec("INSERT INTO speeches_fts(speeches_fts) VALUES('optimize')");
  const analizar = (db) => db.exec('ANALYZE main');

  function escribirMeta(db, facetasJson, nFilas, extra = {}) {
    const poner = (k, v) => db.exec({ sql: 'INSERT OR REPLACE INTO meta VALUES(?, ?)', bind: [k, v === null || v === undefined ? null : String(v)] });
    poner('facets', facetasJson);
    poner('n_speeches', nFilas);
    poner('n_chunks', '0');
    poner('formato_texto', FORMATO_TEXTO);
    for (const [k, v] of Object.entries(extra)) poner(k, v);
  }

  /** Progress handler cada OPS_POR_LATIDO instrucciones (también dentro de una sentencia larga). Devuelve { parar() }. */
  function vigilar(sqlite3, db, alLatido) {
    const { capi } = sqlite3;
    capi.sqlite3_progress_handler(db.pointer, OPS_POR_LATIDO, () => { alLatido(); return 0; }, 0);
    let activo = true;
    return {
      parar() {
        if (!activo) return;
        activo = false;
        capi.sqlite3_progress_handler(db.pointer, 0, 0, 0);
      },
    };
  }

  /** Memoria: tamaño del heap wasm y uso/pico de SQLite (sqlite3_status64 MEMORY_USED). */
  function memoria(sqlite3, reiniciar = false) {
    const { wasm, capi } = sqlite3;
    const r = { wasm_bytes: wasm.heap8u().byteLength, sqlite_usada: null, sqlite_highwater: null };
    const pila = wasm.pstack.pointer;
    try {
      const pActual = wasm.pstack.alloc(8), pPico = wasm.pstack.alloc(8);
      if (capi.sqlite3_status64(0 /* SQLITE_STATUS_MEMORY_USED */, pActual, pPico, reiniciar ? 1 : 0) === SQLITE_OK) {
        r.sqlite_usada = Number(wasm.peek(pActual, 'i64'));
        r.sqlite_highwater = Number(wasm.peek(pPico, 'i64'));
      }
    } finally {
      wasm.pstack.restore(pila);
    }
    return r;
  }

  R2.construir = {
    SQL_ESQUEMA, INDICES, FILAS_POR_LOTE, OPS_POR_LATIDO, BLOQUE_BYTES, FORMATO_TEXTO, COLUMNAS_VISTA,
    abrirBase, Insertador, crearIndices, optimizar, analizar, escribirMeta, vigilar, memoria,
  };
})(globalThis.R2 = globalThis.R2 || {});

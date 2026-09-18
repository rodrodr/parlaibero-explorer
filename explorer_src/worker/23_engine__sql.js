/* ===== src/engine/sql.js ===== */
/* 2REP_Standalone · engine/sql.js
 *
 * Lectura exacta de resultados de SQLite para el motor (M4). La API oo1 de sqlite-wasm decodifica TEXT con un TextDecoder
 * que QUITA un U+FEFF inicial (ARQUITECTURA.md §4.2); el escritorio lo conserva. Aquí los TEXT se leen como bytes
 * (sqlite3_column_blob) y se decodifican con ignoreBOM, y los INTEGER con sqlite3_column_int64 (Number si cabe en 2^53;
 * si no, BigInt).
 *
 * API (R2.sql); `bd` = { db: oo1.DB, sqlite3 }
 *   filas(bd, sql, bind) → [{columna: valor}]      en el orden de las columnas de la sentencia
 *   tuplas(bd, sql, bind) → [[valor, …]]
 *   columna(bd, sql, bind) → [valor]               primera columna
 *   valor(bd, sql, bind) → valor | undefined        primera columna de la primera fila
 *   ejecutar(bd, sql, bind)                          sentencia sin resultado
 *   errorSqlite(bd, e) → texto                       mensaje de SQLite (sqlite3_errmsg) o el de la excepción
 */
(function (R2) {
  'use strict';

  const decodificador = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false });
  const MAX_SEGURO = 9007199254740991n;

  function lector(bd) {
    if (!bd || !bd.db || !bd.sqlite3) throw new TypeError('R2.sql: hace falta { db, sqlite3 }');
    const { capi } = bd.sqlite3;
    return (stmt, i) => {
      switch (capi.sqlite3_column_type(stmt.pointer, i)) {
        case capi.SQLITE_NULL: return null;
        case capi.SQLITE_INTEGER: {
          const v = capi.sqlite3_column_int64(stmt.pointer, i);
          if (typeof v !== 'bigint') return v;
          return v >= -MAX_SEGURO && v <= MAX_SEGURO ? Number(v) : v;
        }
        case capi.SQLITE_FLOAT: return capi.sqlite3_column_double(stmt.pointer, i);
        case capi.SQLITE_TEXT: return decodificador.decode(stmt.get(i, capi.SQLITE_BLOB) || new Uint8Array(0));
        default: {
          const u8 = stmt.get(i, capi.SQLITE_BLOB);
          return u8 ? new Uint8Array(u8) : new Uint8Array(0);
        }
      }
    };
  }

  function recorrer(bd, sql, bind, alFila) {
    const leer = lector(bd);
    const stmt = bd.db.prepare(sql);
    try {
      if (bind !== undefined && bind !== null && (!Array.isArray(bind) || bind.length)) stmt.bind(bind);
      const n = stmt.columnCount;
      const nombres = n ? stmt.getColumnNames([]) : [];
      while (stmt.step()) alFila(stmt, leer, n, nombres);
    } finally {
      stmt.finalize();
    }
  }

  function filas(bd, sql, bind) {
    const out = [];
    recorrer(bd, sql, bind, (stmt, leer, n, nombres) => {
      const o = {};
      for (let i = 0; i < n; i++) o[nombres[i]] = leer(stmt, i);
      out.push(o);
    });
    return out;
  }

  function tuplas(bd, sql, bind) {
    const out = [];
    recorrer(bd, sql, bind, (stmt, leer, n) => {
      const f = new Array(n);
      for (let i = 0; i < n; i++) f[i] = leer(stmt, i);
      out.push(f);
    });
    return out;
  }

  function columna(bd, sql, bind) {
    const out = [];
    recorrer(bd, sql, bind, (stmt, leer) => { out.push(leer(stmt, 0)); });
    return out;
  }

  function valor(bd, sql, bind) {
    let v;
    let hay = false;
    recorrer(bd, sql, bind, (stmt, leer) => { if (!hay) { v = leer(stmt, 0); hay = true; } });
    return v;
  }

  function ejecutar(bd, sql, bind) {
    const stmt = bd.db.prepare(sql);
    try {
      if (bind !== undefined && bind !== null && (!Array.isArray(bind) || bind.length)) stmt.bind(bind);
      while (stmt.step()) { /* sin resultado */ }
    } finally {
      stmt.finalize();
    }
  }

  function errorSqlite(bd, e) {
    try {
      const m = bd.sqlite3.capi.sqlite3_errmsg(bd.db.pointer);
      if (m && m !== 'not an error') return m;
    } catch (e2) { /* sin base */ }
    return String(e && e.message ? e.message : e);
  }

  R2.sql = Object.freeze({ filas, tuplas, columna, valor, ejecutar, errorSqlite });
})(globalThis.R2 = globalThis.R2 || {});

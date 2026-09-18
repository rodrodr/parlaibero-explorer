/* ===== src/web/trozos.js ===== */
/* 2REP_Standalone · web/trozos.js
 *
 * Worker: la base construida, en trozos de 16 MiB, para guardarla fuera del worker y volver a abrirla sin el CSV cuando no
 * hay OPFS (HTML local por file:// en Chrome, Edge y Firefox: la guarda el hilo principal en IndexedDB,
 * persistencia/base_local.js). ARQUITECTURA.md §15.
 *   - Exportar: páginas de sqlite_dbpage copiadas a un ArrayBuffer NUEVO por trozo (se transfiere al hilo principal sin copia;
 *     nunca hay dos copias de la base entera), con la huella de cada trozo (R2.sha256.huellaTrozo) y la de todas las páginas
 *     (la misma de R2.opfs.HuellaPaginas: sha256 de «bytes:huellas» recortado a 16 caracteres).
 *   - Importar: un bloque de sqlite3_malloc64 del tamaño de la base; cada trozo se comprueba (orden, tamaño y huella) antes de
 *     copiarlo; al final, número de trozos, bytes y huella total, y sqlite3_deserialize (FREEONCLOSE | RESIZEABLE). Un trozo
 *     que falta, corto o distinto → RECORDADO_DANADO y se libera el bloque.
 *
 * API
 *   R2.trozos.TROZO_BYTES (16 MiB) · R2.trozos.huellaTotal(bytes, huellas) → hex16
 *   const e = R2.trozos.crearExportacion(sqlite3, db)
 *     e.info → { bytes, page_size, paginas, n_trozos, trozo_bytes }
 *     e.siguiente() → { i, buf: ArrayBuffer, bytes, huella } | null     e.fin() → { bytes, huellas, huella }    e.cerrar()
 *   const im = R2.trozos.crearImportacion(sqlite3, { bytes, page_size, trozo_bytes, huellas, huella })
 *     im.poner(i, u8) · im.terminar() → db (oo1.DB en memoria) · im.descartar() · im.recibidos
 *   Errores: R2.opfs.ErrorAlmacen (RECORDADO_DANADO, MEMORIA, ALMACEN).
 */
(function (R2) {
  'use strict';

  const MIB = 1048576;
  const TROZO_BYTES = 16 * MIB; // = bloque de R2.opfs.HuellaPaginas: la huella de cada trozo es la de su bloque

  const Error_ = (codigo, mensaje) => new R2.opfs.ErrorAlmacen(codigo, mensaje);
  const DANADA = 'La base recordada está dañada o incompleta (una parte no coincide con lo que se guardó) y se ha borrado. Elija el CSV para volver a construirla.';

  /** Huella de todas las páginas a partir de la de cada trozo de 16 MiB (igual que R2.opfs.HuellaPaginas.hex()). */
  function huellaTotal(bytes, huellas) {
    return new R2.sha256.Sha256().update(new TextEncoder().encode(`${bytes}:${huellas.join('')}`)).hex().slice(0, 16);
  }

  function crearExportacion(sqlite3, db) {
    const { capi, wasm } = sqlite3;
    const pageSize = db.selectValue('PRAGMA page_size');
    const paginas = db.selectValue('PRAGMA page_count');
    if (TROZO_BYTES % pageSize) throw Error_('ALMACEN', `El tamaño de página de la base (${pageSize}) no divide los trozos de 16 MiB.`);
    const porTrozo = TROZO_BYTES / pageSize;
    const bytes = pageSize * paginas;
    const info = { bytes, page_size: pageSize, paginas, n_trozos: Math.ceil(paginas / porTrozo), trozo_bytes: TROZO_BYTES };
    const stmt = db.prepare("SELECT pgno, data FROM sqlite_dbpage('main')");
    const P = stmt.pointer;
    const huellas = [];
    let pagina = 0, terminado = false, i = 0;
    const cerrar = () => { if (!terminado) { terminado = true; stmt.finalize(); } };

    function siguiente() {
      if (terminado) return null;
      const quedan = paginas - pagina;
      if (quedan <= 0) { cerrar(); return null; }
      const n = Math.min(porTrozo, quedan) * pageSize;
      const u8 = new Uint8Array(n);
      let k = 0;
      try {
        while (k < n) {
          const rc = capi.sqlite3_step(P);
          if (rc !== capi.SQLITE_ROW) throw new Error(`sqlite_dbpage: rc=${rc}: ${capi.sqlite3_errmsg(db.pointer)}`);
          const pgno = capi.sqlite3_column_int(P, 0);
          const len = capi.sqlite3_column_bytes(P, 1);
          if (pgno !== pagina + 1 || len !== pageSize) throw new Error(`sqlite_dbpage: página ${pgno} (${len} B) inesperada`);
          const ptr = Number(capi.sqlite3_column_blob(P, 1));
          u8.set(wasm.heap8u().subarray(ptr, ptr + len), k);
          k += len;
          pagina++;
        }
      } catch (e) {
        cerrar();
        throw Error_('ALMACEN', `No se pudo leer la base para guardarla. Detalle técnico: ${e && e.message ? e.message : e}`);
      }
      const huella = R2.sha256.huellaTrozo(u8);
      huellas.push(huella);
      if (pagina >= paginas) cerrar();
      return { i: i++, buf: u8.buffer, bytes: n, huella };
    }

    function fin() {
      if (pagina !== paginas) throw Error_('ALMACEN', `Se leyeron ${pagina} de ${paginas} páginas de la base.`);
      cerrar();
      return { bytes, huellas: huellas.slice(), huella: huellaTotal(bytes, huellas) };
    }

    return { info, siguiente, fin, cerrar };
  }

  function crearImportacion(sqlite3, m) {
    const { capi, wasm } = sqlite3;
    const bytes = Number(m && m.bytes);
    const pageSize = Number(m && m.page_size);
    const trozoBytes = Number(m && m.trozo_bytes) || TROZO_BYTES;
    const huellas = m && Array.isArray(m.huellas) ? m.huellas.map(String) : null;
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || !pageSize || bytes % pageSize || trozoBytes !== TROZO_BYTES || !huellas
      || huellas.length !== Math.ceil(bytes / trozoBytes) || !/^[0-9a-f]{16}$/.test(String(m.huella))
      || huellaTotal(bytes, huellas) !== m.huella) {
      throw Error_('RECORDADO_DANADO', DANADA);
    }
    const p = Number(capi.sqlite3_malloc64(bytes));
    if (!p) throw Error_('MEMORIA', 'No hay memoria suficiente para abrir la base recordada. Cierre otras pestañas y vuelva a intentarlo.');
    let vivo = true;
    let recibidos = 0;

    function descartar() {
      if (vivo) { vivo = false; capi.sqlite3_free(p); }
    }

    function poner(i, u8) {
      if (!vivo) throw Error_('ALMACEN', 'La apertura de la base recordada ya terminó.');
      const esperado = Math.min(trozoBytes, bytes - recibidos * trozoBytes);
      if (i !== recibidos || !u8 || u8.length !== esperado || R2.sha256.huellaTrozo(u8) !== huellas[i]) {
        descartar();
        throw Error_('RECORDADO_DANADO', DANADA);
      }
      wasm.heap8u().set(u8, p + i * trozoBytes);
      recibidos++;
    }

    function terminar() {
      if (!vivo) throw Error_('ALMACEN', 'La apertura de la base recordada ya terminó.');
      if (recibidos !== huellas.length) { descartar(); throw Error_('RECORDADO_DANADO', DANADA); }
      vivo = false; // desde aquí el bloque es de SQLite (FREEONCLOSE; si deserialize falla, también lo libera SQLite)
      const db = new sqlite3.oo1.DB(':memory:');
      if (R2.texto) db.r2Texto = R2.texto.instalar(sqlite3, db);
      const rc = capi.sqlite3_deserialize(db.pointer, 'main', p, bytes, bytes,
        capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE);
      if (rc) { db.close(); throw Error_('RECORDADO_DANADO', DANADA); }
      try {
        db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA temp_store = MEMORY;');
        if (db.selectValue('PRAGMA page_count') * db.selectValue('PRAGMA page_size') !== bytes) throw new Error('tamaño');
        db.selectValue("SELECT count(*) FROM meta");
      } catch (e) {
        db.close();
        throw Error_('RECORDADO_DANADO', DANADA);
      }
      return db;
    }

    return { poner, terminar, descartar, get recibidos() { return recibidos; } };
  }

  R2.trozos = { TROZO_BYTES, huellaTotal, crearExportacion, crearImportacion };
})(globalThis.R2 = globalThis.R2 || {});

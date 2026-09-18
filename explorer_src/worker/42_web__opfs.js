/* ===== src/web/opfs.js ===== */
/* 2REP_Standalone · web/opfs.js
 *
 * Worker: recordar la base ya construida en el almacenamiento privado del navegador (OPFS, VFS «opfs-sahpool» de
 * sqlite-wasm), abrirla sin el CSV y olvidarla. Solo la versión web (https o localhost): por file:// el hilo principal no
 * lo ofrece. Código probado en el prototipo M0b (spike/src/almacen.js y spike/src/worker.js, RESULTADOS_M0b.md §11.7):
 *   - Guardar: meta cache_* → huella de TODAS las páginas → nombre con la huella → importDb por trozos de 16 MiB leídos de
 *     sqlite_dbpage (sin copia en el heap; el archivo solo recibe su nombre al terminar) → relectura desde OPFS con otra
 *     conexión y comparación de la huella → se borran los demás corpus. Comprobación previa de cuota con margen
 *     max(32, min(128, tamaño/2)) MiB (Firefox no avisa al pasarse).
 *   - Abrir: siempre en memoria. sqlite_dbpage de la conexión OPFS → bloque de sqlite3_malloc64 → huella antes de «listo»
 *     → sqlite3_deserialize. Si la huella no coincide, se borra el archivo (RECORDADO_DANADO).
 *   - Olvidar: borra todo archivo con el prefijo (también de otras versiones) y el directorio del pool si queda vacío.
 * Tras cada operación se sueltan los access handles (pauseVfs) para que otra pestaña o una recarga puedan usarlos.
 *
 * Nombre: /2rep-corpus-<sha256 del CSV>-<build_id>-<huella de páginas>.sqlite3. build_id (R2.datos.edicion.build_id) ya
 * cambia si cambia FORMATO_CACHE (build/build.mjs lo lee de este archivo).
 *
 * Desde §15 (recordar por defecto): estado({ limpiar }) borra las bases de otra versión, dañadas o sobrantes y lo cuenta en
 * `liberados`; abrir({ alProgreso }) avisa cada 16 MiB copiados; `recordado.version` = versión reconocida del CSV.
 * Los cerrojos entre pestañas los pone el hilo principal (navigator.locks, arranque/web.js).
 *
 * API
 *   const o = R2.opfs.crear({ sqlite3, buildId })
 *   await o.estado({ limpiar })               → { disponible, recordado: {…} | null, otros, obsoletos, danados, liberados, error }
 *   await o.recordar({ db, informe, construidoEn }) → { recordado: {…}, ya_recordado, borrados, ms }
 *   await o.abrir({ alProgreso(hecho, total) }) → { db, informe, construidoEn, recordado: {…}, ms }
 *   await o.olvidar()                         → { borrados, bytes_borrados, ms }
 *   Errores: R2.opfs.ErrorAlmacen { codigo, message } (CUOTA, OPFS_BLOQUEADO, OPFS_NO_DISPONIBLE, NO_RECORDADO,
 *   RECORDADO_DANADO, VERIFICACION, SIN_HUELLA, MEMORIA, ALMACEN).
 */
(function (R2) {
  'use strict';

  const MIB = 1048576;
  const FORMATO_CACHE = 1;
  const VFS = 'diarios-opfs';
  const DIR = 'diarios-corpus';
  const PREFIJO = '/diarios-corpus-';
  const RE_NOMBRE = /^\/diarios-corpus-([0-9a-f]{64})-([0-9a-f]{8,64})-([0-9a-f]{16})\.sqlite3$/;
  const BLOQUE_HUELLA = 16 * MIB;
  const ESPERA_BLOQUEO_MS = 4000;

  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const nf = (n) => new Intl.NumberFormat('es-ES').format(Math.round(n));

  class ErrorAlmacen extends Error {
    constructor(codigo, mensaje, extra) {
      super(mensaje);
      this.name = 'ErrorAlmacen';
      this.codigo = codigo;
      Object.assign(this, extra || {});
    }
  }

  // ------------------------------------------------------------------------------------------------ nombres
  function nombreArchivo(csvSha256, buildId, huella) {
    if (!/^[0-9a-f]{64}$/.test(String(csvSha256))) throw new ErrorAlmacen('SIN_HUELLA', 'La huella SHA-256 del CSV no es válida: no se puede recordar esta base.');
    if (!/^[0-9a-f]{8,64}$/.test(String(buildId))) throw new ErrorAlmacen('ALMACEN', 'El identificador de esta versión de la página no es válido.');
    if (!/^[0-9a-f]{16}$/.test(String(huella))) throw new ErrorAlmacen('ALMACEN', 'La huella de las páginas no es válida.');
    return `${PREFIJO}${csvSha256}-${buildId}-${huella}.sqlite3`;
  }

  function analizarNombre(nombre) {
    const m = RE_NOMBRE.exec(String(nombre || ''));
    return m ? { csv_sha256: m[1], build_id: m[2], huella: m[3], clave: `${m[1]}-${m[2]}` } : null;
  }

  // ------------------------------------------------------------------------------------------------ huella de páginas
  /** Huella rápida (no criptográfica) de todos los bytes: huellaTrozo sobre bloques fijos de 16 MiB y SHA-256 de la lista. */
  class HuellaPaginas {
    constructor() { this.partes = []; this.bytes = 0; this.pend = null; this.nPend = 0; }
    update(u8) {
      const H = R2.sha256.huellaTrozo;
      let off = 0;
      if (this.nPend) {
        const k = Math.min(BLOQUE_HUELLA - this.nPend, u8.length);
        this.pend.set(u8.subarray(0, k), this.nPend);
        this.nPend += k;
        off = k;
        if (this.nPend === BLOQUE_HUELLA) { this.partes.push(H(this.pend)); this.nPend = 0; }
      }
      while (u8.length - off >= BLOQUE_HUELLA) { this.partes.push(H(u8.subarray(off, off + BLOQUE_HUELLA))); off += BLOQUE_HUELLA; }
      if (off < u8.length) {
        if (!this.pend) this.pend = new Uint8Array(BLOQUE_HUELLA);
        this.pend.set(u8.subarray(off), this.nPend);
        this.nPend += u8.length - off;
      }
      this.bytes += u8.length;
      return this;
    }
    hex() {
      const partes = this.nPend ? this.partes.concat(R2.sha256.huellaTrozo(this.pend.subarray(0, this.nPend))) : this.partes;
      return new R2.sha256.Sha256().update(new TextEncoder().encode(`${this.bytes}:${partes.join('')}`)).hex().slice(0, 16);
    }
  }

  /** Función para importDb(nombre, fn): cada llamada devuelve el siguiente trozo de páginas (búfer JS reutilizado) o undefined. */
  function lectorPaginas(sqlite3, db, o = {}) {
    const { capi, wasm } = sqlite3;
    const pageSize = db.selectValue('PRAGMA page_size');
    const porTrozo = Math.max(1, Math.floor((o.trozoBytes || 16 * MIB) / pageSize));
    const buf = new Uint8Array(porTrozo * pageSize);
    const stmt = db.prepare("SELECT pgno, data FROM sqlite_dbpage('main')");
    const P = stmt.pointer;
    let pagina = 0, terminado = false, bytes = 0;
    const cerrar = () => { if (!terminado) { terminado = true; stmt.finalize(); } };
    const siguiente = async () => {
      if (terminado) return undefined;
      let n = 0;
      try {
        while (n < buf.length) {
          const rc = capi.sqlite3_step(P);
          if (rc === capi.SQLITE_DONE) { cerrar(); break; }
          if (rc !== capi.SQLITE_ROW) throw new Error(`sqlite_dbpage: rc=${rc}: ${capi.sqlite3_errmsg(db.pointer)}`);
          const pgno = capi.sqlite3_column_int(P, 0);
          if (pgno !== pagina + 1) throw new Error(`sqlite_dbpage: se esperaba la página ${pagina + 1} y llegó la ${pgno}`);
          const len = capi.sqlite3_column_bytes(P, 1);
          if (len !== pageSize) throw new Error(`sqlite_dbpage: la página ${pgno} tiene ${len} bytes (page_size ${pageSize})`);
          const ptr = Number(capi.sqlite3_column_blob(P, 1));
          buf.set(wasm.heap8u().subarray(ptr, ptr + len), n);
          n += len;
          pagina++;
        }
      } catch (e) {
        cerrar();
        throw e;
      }
      if (n === 0) return undefined;
      bytes += n;
      const trozo = n === buf.length ? buf : buf.subarray(0, n);
      if (o.huella) o.huella.update(trozo);
      return trozo;
    };
    siguiente.cerrar = cerrar;
    siguiente.info = () => ({ page_size: pageSize, paginas: pagina, bytes });
    return siguiente;
  }

  async function huellaPaginasDe(sqlite3, db) {
    const h = new HuellaPaginas();
    const lector = lectorPaginas(sqlite3, db, { huella: h });
    try { while ((await lector()) !== undefined); } finally { lector.cerrar(); }
    return { huella: h.hex(), bytes: h.bytes };
  }

  const leerMeta = (db) => Object.fromEntries(db.selectArrays("SELECT key, value FROM meta WHERE key LIKE 'cache\\_%' ESCAPE '\\'"));
  const metaValida = (meta, a) => !!(meta && a && meta.cache_clave === a.clave && meta.cache_estado === 'completo');

  // ------------------------------------------------------------------------------------------------ cuota y errores
  const margenCuota = (necesarios) => Math.max(32 * MIB, Math.min(128 * MIB, Math.ceil(necesarios / 2)));

  async function estimar() {
    const st = typeof navigator !== 'undefined' && navigator.storage;
    if (!st || typeof st.estimate !== 'function') return null;
    try { const e = await st.estimate(); return { quota: e.quota, usage: e.usage }; } catch (e) { return null; }
  }

  function clasificarError(e, ctx = {}) {
    if (e instanceof ErrorAlmacen) return e;
    const nombre = String((e && e.name) || '');
    const msg = String((e && e.message) || e);
    const causa = `${nombre}: ${msg}`;
    if (nombre === 'QuotaExceededError' || /quota|SQLITE_FULL|disk is full/i.test(msg) || ctx.sinEspacio) {
      return new ErrorAlmacen('CUOTA',
        'El navegador se ha quedado sin espacio mientras guardaba la base. No se ha guardado nada y se ha liberado lo escrito; '
        + 'la base sigue abierta en esta pestaña. Libere espacio (por ejemplo, datos de otros sitios) o siga sin recordarla.', { causa });
    }
    if (nombre === 'NoModificationAllowedError' || /Access Handles? cannot be created|another open Access Handle|is locked|locked by/i.test(msg)) {
      return new ErrorAlmacen('OPFS_BLOQUEADO', 'La base recordada está en uso en otra pestaña o ventana de 2REP. Ciérrela o espere unos segundos y vuelva a intentarlo.', { causa });
    }
    if (nombre === 'SecurityError' || nombre === 'NotAllowedError' || nombre === 'UnknownError' || /Missing required OPFS APIs|OPFS API is too old/i.test(msg)) {
      return new ErrorAlmacen('OPFS_NO_DISPONIBLE',
        'Este navegador no permite guardar la base en su almacenamiento privado (OPFS). Tendrá que elegir el CSV en cada visita.', { causa });
    }
    return new ErrorAlmacen(ctx.codigo || 'ALMACEN',
      `${ctx.prefijo || 'No se pudo completar la operación con el almacenamiento del navegador'}. Detalle técnico: ${causa}`, { causa });
  }

  // ------------------------------------------------------------------------------------------------ pool
  function crear(opciones) {
    const sqlite3 = opciones.sqlite3;
    const buildId = String(opciones.buildId || '');
    let pool = null;

    /** Espera a que otro worker (la página anterior tras recargar) suelte los access handles antes de instalar el VFS. */
    async function sondearBloqueos() {
      let dir = await navigator.storage.getDirectory();
      try { dir = await dir.getDirectoryHandle(DIR); } catch (e) { if (e.name === 'NotFoundError') return; throw e; }
      let opaco;
      try { opaco = await dir.getDirectoryHandle('.opaque'); } catch (e) { if (e.name === 'NotFoundError') return; throw e; }
      for await (const [, h] of opaco.entries()) {
        if (h.kind !== 'file') continue;
        const ah = await h.createSyncAccessHandle();
        ah.close();
      }
    }

    async function obtenerPool() {
      if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function'
        || typeof sqlite3.installOpfsSAHPoolVfs !== 'function') {
        throw new ErrorAlmacen('OPFS_NO_DISPONIBLE', 'Este navegador no permite guardar la base en su almacenamiento privado (OPFS). Tendrá que elegir el CSV en cada visita.');
      }
      if (pool) {
        if (pool.isPaused()) await pool.unpauseVfs();
        return pool;
      }
      const t0 = ahora();
      let intentos = 0;
      for (;;) {
        intentos++;
        try {
          await sondearBloqueos();
          pool = await sqlite3.installOpfsSAHPoolVfs({ name: VFS, directory: DIR, initialCapacity: 4, clearOnInit: false,
            forceReinitIfPreviouslyFailed: true, verbosity: 1 });
          return pool;
        } catch (e) {
          const err = clasificarError(e);
          if (err.codigo === 'OPFS_BLOQUEADO' && ahora() - t0 < ESPERA_BLOQUEO_MS) { await dormir(Math.min(400, 50 * intentos)); continue; }
          throw err;
        }
      }
    }

    function soltarPool() {
      if (!pool || pool.isPaused()) return;
      try { pool.pauseVfs(); } catch (e) { /* sigue retenido: se reintenta en la próxima operación */ }
    }

    function describir(p, nombre) {
      const a = analizarNombre(nombre);
      const item = { nombre, analizado: a, de_esta_version: !!a && a.build_id === buildId, valido: false, meta: null, bytes: 0 };
      try {
        const db = new p.OpfsSAHPoolDb(nombre, 'r');
        try {
          item.meta = leerMeta(db);
          item.bytes = db.selectValue('PRAGMA page_count') * db.selectValue('PRAGMA page_size');
        } finally { db.close(); }
        item.valido = metaValida(item.meta, a);
      } catch (e) {
        item.error = `${e.name}: ${e.message}`;
      }
      return item;
    }

    /** Versión reconocida del CSV (informe.version_csv) guardada con la base: { id, corto, etiqueta } o null. */
    function versionDe(meta) {
      try {
        const v = JSON.parse(meta.cache_informe).version_csv;
        return v ? { id: v.id || null, corto: v.corto || null, etiqueta: v.etiqueta || null } : null;
      } catch (e) { return null; }
    }

    const publico = (it) => ({
      nombre: it.nombre, csv_sha256: it.analizado.csv_sha256, build_id: it.analizado.build_id, bytes: it.bytes,
      nombre_csv: it.meta.cache_nombre_csv || null, bytes_csv: Number(it.meta.cache_bytes_csv) || null,
      guardado: it.meta.cache_guardado || null, filas: Number(it.meta.cache_filas) || null, version: versionDe(it.meta),
      almacen: 'opfs',
    });

    const esCorpus = (n) => n.startsWith(PREFIJO) && !/-(journal|wal)$/.test(n);

    /**
     * { disponible, recordado, otros, obsoletos, danados, liberados, error }. Con `limpiar` (el hilo principal lo pide con el
     * cerrojo exclusivo de la base), borra lo que ya no sirve: bases de otra versión de la página (build_id distinto),
     * dañadas o incompletas de esta versión, sobrantes (se conserva la más reciente) y restos sin nombre válido.
     */
    async function estado(opciones = {}) {
      const r = { disponible: false, recordado: null, otros: 0, obsoletos: 0, danados: 0, liberados: null, error: null };
      try {
        const p = await obtenerPool();
        r.disponible = true;
        const nombres = p.getFileNames().filter((n) => n.startsWith(PREFIJO));
        const lista = nombres.filter(esCorpus).map((n) => describir(p, n));
        const validos = lista.filter((c) => c.de_esta_version && c.valido)
          .sort((x, y) => String(y.meta.cache_guardado).localeCompare(String(x.meta.cache_guardado)));
        r.recordado = validos.length ? publico(validos[0]) : null;
        r.otros = lista.length - (validos.length ? 1 : 0);
        const obsoletos = lista.filter((c) => !c.de_esta_version);
        const danados = lista.filter((c) => c.de_esta_version && !c.valido);
        r.obsoletos = obsoletos.length;
        r.danados = danados.length;
        if (opciones.limpiar) {
          const quedan = new Set(validos.length ? [validos[0].nombre] : []);
          const lib = { obsoletos: 0, danados: 0, sobrantes: 0, bytes: 0, nombres: [] };
          for (const n of nombres) {
            const base = n.replace(/-(journal|wal)$/, '');
            if (quedan.has(base)) continue;
            const it = lista.find((c) => c.nombre === base);
            if (it && esCorpus(n)) {
              lib.bytes += it.bytes || 0;
              if (!it.de_esta_version) lib.obsoletos++;
              else if (!it.valido) lib.danados++;
              else lib.sobrantes++;
            }
            try { p.unlink(n); lib.nombres.push(n); } catch (e) { /* se reintenta en la próxima consulta */ }
          }
          if (lib.nombres.length) r.liberados = lib;
          r.otros = 0;
        }
      } catch (e) {
        const err = clasificarError(e);
        r.error = { codigo: err.codigo, mensaje: err.message };
      } finally {
        soltarPool();
      }
      return r;
    }

    async function recordar(base) {
      const t0 = ahora();
      const { db, informe } = base;
      const csvSha = informe && informe.huella && informe.huella.sha256;
      if (!csvSha) throw new ErrorAlmacen('SIN_HUELLA', 'Todavía no se conoce la huella SHA-256 del CSV: vuelva a intentarlo en unos segundos.');
      nombreArchivo(csvSha, buildId, '0000000000000000'); // valida la clave
      const clave = `${csvSha}-${buildId}`;
      const p = await obtenerPool();
      try {
        const borrados = [];
        let liberables = 0;
        for (const n of p.getFileNames()) {
          if (!n.startsWith(PREFIJO)) continue;
          const a = analizarNombre(n.replace(/-(journal|wal)$/, ''));
          if (a && a.clave === clave && esCorpus(n)) {
            const previo = describir(p, n);
            if (previo.valido) return { recordado: publico(previo), ya_recordado: true, borrados, ms: ahora() - t0 };
          }
          // Incompletos, restos y corpus de otras versiones (no se pueden abrir con esta): se liberan antes de medir la cuota.
          if (!a || a.clave === clave || a.build_id !== buildId) {
            if (esCorpus(n)) liberables += describir(p, n).bytes || 0;
            p.unlink(n);
            borrados.push(n);
          }
        }
        const tamano = db.selectValue('PRAGMA page_count') * db.selectValue('PRAGMA page_size');
        const est = await estimar();
        if (est && typeof est.quota === 'number') {
          const libres = est.quota - (est.usage || 0);
          const margen = margenCuota(tamano);
          if (libres < tamano + margen) {
            throw new ErrorAlmacen('CUOTA',
              `No hay espacio suficiente en este navegador para recordar la base: hacen falta unos ${nf((tamano + margen) / MIB)} MiB `
              + `y quedan ${nf(Math.max(0, libres) / MIB)} MiB. La base sigue abierta en esta pestaña; puede liberar espacio y volver a intentarlo, o seguir sin recordarla.`,
              { liberables });
          }
        }
        await p.reserveMinimumCapacity(p.getFileCount() + 3);

        db.transaction((d) => {
          const datos = {
            cache_clave: clave, cache_csv_sha256: csvSha, cache_build_id: buildId, cache_formato: FORMATO_CACHE,
            cache_guardado: new Date().toISOString(), cache_nombre_csv: informe.huella.nombre, cache_bytes_csv: informe.huella.bytes,
            cache_filas: informe.n_filas, cache_informe: JSON.stringify(informe), cache_construido_en: base.construidoEn || null,
            cache_estado: 'completo', // importDb: el archivo no recibe su nombre hasta que está entero
          };
          for (const [k, v] of Object.entries(datos)) d.exec({ sql: 'INSERT OR REPLACE INTO meta VALUES(?, ?)', bind: [k, v == null ? null : String(v)] });
        });
        const hBase = await huellaPaginasDe(sqlite3, db);
        const nombre = nombreArchivo(csvSha, buildId, hBase.huella);
        const analizado = analizarNombre(nombre);

        try {
          const h2 = new HuellaPaginas();
          const lector = lectorPaginas(sqlite3, db, { huella: h2 });
          try { await p.importDb(nombre, lector); } finally { lector.cerrar(); }
          if (h2.hex() !== hBase.huella) throw new ErrorAlmacen('VERIFICACION', 'La base cambió mientras se guardaba. Vuelva a intentarlo.');
        } catch (e) {
          try { for (const n of p.getFileNames()) if (n.startsWith(nombre)) p.unlink(n); } catch (e2) { /* nada */ }
          const sinEspacio = !!(est && est.quota && est.quota - est.usage < tamano + margenCuota(tamano));
          throw clasificarError(e, { sinEspacio: sinEspacio && /SQLITE_(IOERR|FULL)|Quota/i.test(String(e && e.message)), prefijo: 'No se pudo guardar la base en este navegador' });
        }

        // Relectura desde OPFS con otra conexión: la huella de TODAS las páginas debe coincidir.
        let ok = false;
        try {
          const v = new p.OpfsSAHPoolDb(nombre, 'r');
          try {
            const hv = await huellaPaginasDe(sqlite3, v);
            ok = hv.huella === hBase.huella && hv.bytes === tamano && metaValida(leerMeta(v), analizado);
          } finally { v.close(); }
        } catch (e) { ok = false; }
        if (!ok) {
          try { p.unlink(nombre); } catch (e) { /* nada */ }
          if (est && typeof est.quota === 'number' && est.quota - (est.usage || 0) < tamano + margenCuota(tamano)) {
            throw clasificarError(new Error('la relectura no coincide y no había espacio para la base entera'), { sinEspacio: true });
          }
          throw new ErrorAlmacen('VERIFICACION', 'La base guardada no coincide con la construida y se ha borrado. Vuelva a intentarlo.');
        }
        // Un solo corpus recordado: los de otras claves se borran ahora.
        for (const n of p.getFileNames()) {
          if (n.startsWith(PREFIJO) && !n.startsWith(nombre)) { p.unlink(n); borrados.push(n); }
        }
        const it = describir(p, nombre);
        return { recordado: publico(it), ya_recordado: false, borrados, ms: ahora() - t0 };
      } finally {
        soltarPool();
      }
    }

    async function abrir(opciones = {}) {
      const alProgreso = typeof opciones.alProgreso === 'function' ? opciones.alProgreso : null;
      const t0 = ahora();
      const { capi, wasm } = sqlite3;
      const p = await obtenerPool();
      let odb = null;
      let elegido = null;
      try {
        const candidatos = p.getFileNames().filter((n) => { const a = analizarNombre(n); return a && a.build_id === buildId; });
        const otros = p.getFileNames().filter((n) => esCorpus(n) && !candidatos.includes(n));
        if (!candidatos.length) {
          throw new ErrorAlmacen('NO_RECORDADO', otros.length
            ? 'La base recordada es de otra versión de 2REP Standalone y no sirve para esta. Elija el CSV para volver a construirla.'
            : 'No hay ninguna base recordada en este navegador. Elija el CSV.');
        }
        let meta = null;
        const invalidos = [];
        for (const n of candidatos) {
          let d = null;
          try {
            d = new p.OpfsSAHPoolDb(n, 'r');
            const mt = leerMeta(d);
            if (metaValida(mt, analizarNombre(n)) && (!meta || String(mt.cache_guardado) > String(meta.cache_guardado))) {
              if (odb) odb.close();
              odb = d; meta = mt; elegido = n; d = null;
            } else invalidos.push(n);
          } catch (e) {
            invalidos.push(n);
          } finally {
            if (d) d.close();
          }
        }
        for (const n of invalidos) { if (n !== elegido) { try { p.unlink(n); } catch (e) { /* nada */ } } }
        if (!odb) throw new ErrorAlmacen('RECORDADO_DANADO', 'La base recordada estaba incompleta o dañada y se ha borrado. Elija el CSV para volver a construirla.');

        const huellaEsperada = analizarNombre(elegido).huella;
        const pageSize = odb.selectValue('PRAGMA page_size');
        const pageCount = odb.selectValue('PRAGMA page_count');
        const n = pageSize * pageCount;
        const pOut = Number(capi.sqlite3_malloc64(n));
        if (!pOut) throw new ErrorAlmacen('MEMORIA', 'No hay memoria suficiente para abrir la base recordada. Cierre otras pestañas y vuelva a intentarlo.');
        try {
          const st = odb.prepare("SELECT pgno, data FROM sqlite_dbpage('main')");
          let copiadas = 0;
          try {
            const P = st.pointer;
            for (;;) {
              const rc = capi.sqlite3_step(P);
              if (rc === capi.SQLITE_DONE) break;
              if (rc !== capi.SQLITE_ROW) throw new Error(`sqlite_dbpage: rc=${rc}: ${capi.sqlite3_errmsg(odb.pointer)}`);
              const pgno = capi.sqlite3_column_int(P, 0);
              const len = capi.sqlite3_column_bytes(P, 1);
              if (pgno !== copiadas + 1 || len !== pageSize) throw new Error(`sqlite_dbpage: página ${pgno} (${len} B) inesperada`);
              const ptr = Number(capi.sqlite3_column_blob(P, 1));
              wasm.heap8u().copyWithin(pOut + copiadas * pageSize, ptr, ptr + len);
              copiadas++;
              if (alProgreso && copiadas % 4096 === 0) alProgreso(copiadas * pageSize, n);
            }
          } finally { st.finalize(); }
          if (copiadas !== pageCount) throw new Error(`se copiaron ${copiadas} de ${pageCount} páginas`);
          const huella = new HuellaPaginas().update(wasm.heap8u().subarray(pOut, pOut + n)).hex();
          if (huella !== huellaEsperada) {
            throw new ErrorAlmacen('RECORDADO_DANADO', 'La base recordada está dañada o incompleta (lo leído no coincide con lo que se guardó) y se ha borrado. Elija el CSV para volver a construirla.');
          }
        } catch (e) {
          capi.sqlite3_free(pOut);
          throw e;
        }
        const recordado = publico(describir(p, elegido));
        odb.close();
        odb = null;
        const db = new sqlite3.oo1.DB(':memory:');
        if (R2.texto) db.r2Texto = R2.texto.instalar(sqlite3, db);
        const rc = capi.sqlite3_deserialize(db.pointer, 'main', pOut, n, n,
          capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE); // si falla, SQLite libera pOut
        if (rc) { db.close(); throw new Error(`sqlite3_deserialize rc=${rc}`); }
        db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA temp_store = MEMORY;');
        let informe = null;
        try { informe = JSON.parse(meta.cache_informe); } catch (e) { informe = null; }
        if (!informe || !informe.huella) {
          db.close();
          throw new ErrorAlmacen('RECORDADO_DANADO', 'La base recordada no tiene el informe de construcción y se ha borrado. Elija el CSV para volver a construirla.');
        }
        return { db, informe, construidoEn: meta.cache_construido_en || null, recordado, ms: ahora() - t0 };
      } catch (e) {
        if (odb) { try { odb.close(); } catch (e2) { /* nada */ } }
        if (e && e.codigo === 'RECORDADO_DANADO' && elegido) { try { p.unlink(elegido); } catch (e3) { /* nada */ } }
        throw clasificarError(e, { prefijo: 'No se pudo abrir la base recordada' });
      } finally {
        soltarPool();
      }
    }

    async function olvidar() {
      const t0 = ahora();
      const p = await obtenerPool();
      const r = { borrados: [], bytes_borrados: 0 };
      try {
        for (const n of p.getFileNames()) {
          if (!n.startsWith(PREFIJO)) continue;
          if (esCorpus(n)) r.bytes_borrados += describir(p, n).bytes || 0;
          p.unlink(n);
          r.borrados.push(n);
        }
        if (p.getFileCount() === 0) {
          await p.removeVfs(); // borra el directorio del pool
          pool = null;
        }
      } finally {
        soltarPool();
      }
      r.ms = ahora() - t0;
      return r;
    }

    return { estado, recordar, abrir, olvidar };
  }

  R2.opfs = { FORMATO_CACHE, PREFIJO, MIB, ErrorAlmacen, HuellaPaginas, nombreArchivo, analizarNombre, margenCuota, clasificarError,
    lectorPaginas, crear };
})(globalThis.R2 = globalThis.R2 || {});

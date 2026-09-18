































(function (R2) {
  'use strict';

  const BD = 'diarios-explorer-base';
  const VERSION_BD = 1;
  const FORMATO = 1;
  const MANIFIESTOS = 'manifiestos';
  const TROZOS = 'trozos';
  const CERROJO = 'diarios-explorer:v1:base';
  const MIB = 1048576;
  const TIEMPO_ABRIR_MS = 8000;

  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const nf = (n) => new Intl.NumberFormat('es-ES').format(Math.round(n));
  const clave = (id, i) => `${id}#${String(i).padStart(5, '0')}`;
  const idDeClave = (k) => { const s = String(k); const j = s.lastIndexOf('#'); return j > 0 ? s.slice(0, j) : null; };
  const textoTecnico = (e) => (e && e.name && e.message ? `${e.name}: ${e.message}` : String(e && e.message ? e.message : e));

  class ErrorBase extends Error {
    constructor(codigo, mensaje, extra) {
      super(mensaje);
      this.name = 'ErrorBase';
      this.codigo = codigo;
      Object.assign(this, extra || {});
    }
  }

  const MENSAJES = {
    NO_DISPONIBLE: 'Este navegador no permite guardar la base en su almacenamiento.',
    NO_RECORDADO: 'No hay ninguna base recordada en este navegador. Elija el CSV.',
    RECORDADO_DANADO: 'La base recordada estaba dañada o incompleta y se ha borrado. Elija el CSV para volver a construirla.',
    EN_USO: 'La base recordada se está usando en otra pestaña de Diarios Explorer. Espere unos segundos y vuelva a intentarlo.',
    CANCELADO: 'Se canceló la operación con la base recordada.',
  };

  function motivo(e) {
    if (R2.almacen && typeof R2.almacen.motivo === 'function') return R2.almacen.motivo(e);
    return textoTecnico(e);
  }

  function clasificar(e, prefijo) {
    if (e instanceof ErrorBase) return e;
    if (e && e.codigo && typeof e.message === 'string' && !(e instanceof DOMException)) return new ErrorBase(e.codigo, e.message, { causa: e.causa });
    const nombre = String((e && e.name) || '');
    if (nombre === 'QuotaExceededError' || (e && e.code === 22)) {
      return new ErrorBase('CUOTA', 'El navegador se ha quedado sin espacio mientras guardaba la base. No se ha guardado nada y se ha '
        + 'liberado lo escrito; la base sigue abierta en esta pestaña. Libere espacio o siga sin recordarla.', { causa: textoTecnico(e) });
    }
    if (nombre === 'AbortError' && e && e.r2Cancelado) return new ErrorBase('CANCELADO', MENSAJES.CANCELADO);
    if (nombre === 'SecurityError' || nombre === 'NotAllowedError') return new ErrorBase('NO_DISPONIBLE', MENSAJES.NO_DISPONIBLE, { causa: textoTecnico(e) });
    return new ErrorBase('ALMACEN', `${prefijo || 'No se pudo completar la operación con la base guardada en este navegador'} (${motivo(e)}).`,
      { causa: textoTecnico(e) });
  }


  function abrirBd(g) {
    return new Promise((resolver, rechazar) => {
      let idb;
      try { idb = g.indexedDB; } catch (e) { rechazar(e); return; }
      if (!idb) { rechazar(new ErrorBase('NO_DISPONIBLE', MENSAJES.NO_DISPONIBLE)); return; }
      let rq;
      try { rq = idb.open(BD, VERSION_BD); } catch (e) { rechazar(e); return; }
      const t = setTimeout(() => rechazar(Object.assign(new Error(`sin respuesta en ${TIEMPO_ABRIR_MS} ms`), { name: 'TimeoutError' })), TIEMPO_ABRIR_MS);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains(MANIFIESTOS)) db.createObjectStore(MANIFIESTOS);
        if (!db.objectStoreNames.contains(TROZOS)) db.createObjectStore(TROZOS);
      };
      rq.onblocked = () => {   };
      rq.onerror = () => { clearTimeout(t); rechazar(rq.error); };
      rq.onsuccess = () => {
        clearTimeout(t);
        const db = rq.result;
        db.onversionchange = () => { try { db.close(); } catch (e) {   } };
        resolver(db);
      };
    });
  }


  function transaccion(db, nombres, modo, fn) {
    return new Promise((resolver, rechazar) => {
      let tx, valor;
      try {
        tx = db.transaction(nombres, modo);
        const almacenes = {};
        for (const n of [].concat(nombres)) almacenes[n] = tx.objectStore(n);
        const r = fn(almacenes, tx);
        if (r && typeof r === 'object' && 'onsuccess' in r) r.onsuccess = () => { valor = r.result; };
        else valor = r;
      } catch (e) {
        try { if (tx) tx.abort(); } catch (e2) {   }
        rechazar(e);
        return;
      }
      tx.oncomplete = () => resolver(valor);
      tx.onerror = () => rechazar(tx.error || new Error('error en la transacción'));
      tx.onabort = () => rechazar(tx.error || Object.assign(new Error('transacción abortada'), { name: 'AbortError' }));
    });
  }

  const rango = (g, id) => (g.IDBKeyRange || IDBKeyRange).bound(`${id}#`, `${id}#\uffff`);







  async function conCerrojo(g, modo, fn, opciones = {}) {
    const locks = g && g.navigator && g.navigator.locks;
    if (!locks || typeof locks.request !== 'function') return fn();
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    let porTiempo = false;
    const t = opciones.esperaMs && ctrl ? setTimeout(() => { porTiempo = true; ctrl.abort(); }, opciones.esperaMs) : null;
    const externa = opciones.signal;
    const alAbortar = () => { if (ctrl) ctrl.abort(); };
    if (externa) {
      if (externa.aborted) throw new ErrorBase('CANCELADO', MENSAJES.CANCELADO);
      externa.addEventListener('abort', alAbortar, { once: true });
    }
    let dentro = false;
    try {
      return await locks.request(CERROJO, ctrl ? { mode: modo, signal: ctrl.signal } : { mode: modo }, async () => {
        dentro = true;
        if (t) clearTimeout(t);
        return fn();
      });
    } catch (e) {
      if (!dentro && e && e.name === 'AbortError') {
        throw porTiempo ? new ErrorBase('EN_USO', MENSAJES.EN_USO) : new ErrorBase('CANCELADO', MENSAJES.CANCELADO);
      }
      throw e;
    } finally {
      if (t) clearTimeout(t);
      if (externa) externa.removeEventListener('abort', alAbortar);
    }
  }


  function crear(opciones = {}) {
    const g = opciones.ventana || globalThis;
    const buildId = String(opciones.buildId || '');

    async function conBd(fn, prefijo) {
      let db = null;
      try {
        db = await abrirBd(g);
        return await fn(db);
      } catch (e) {
        throw clasificar(e, prefijo);
      } finally {
        if (db) { try { db.close(); } catch (e) {   } }
      }
    }

    async function pedir(cliente, op, args, o = {}) {
      if (!cliente || typeof cliente.pedir !== 'function') throw new ErrorBase('ALMACEN', 'El motor de la página todavía no está listo.');
      const r = await cliente.pedir(op, args || {}, o);
      if (r.status >= 400) {
        const c = r.cuerpo || {};
        throw new ErrorBase(c.codigo || (r.status === 409 ? 'ESTADO' : 'ALMACEN'), c.error || `Error ${r.status}`, { status: r.status });
      }
      return r.cuerpo;
    }

    async function probar() {
      try {
        await conBd((db) => transaccion(db, TROZOS, 'readwrite', (a) => {
          a[TROZOS].put(new ArrayBuffer(8), '~sondeo');
          a[TROZOS].delete('~sondeo');
        }));
        return { ok: true, detalle: null };
      } catch (e) {
        return { ok: false, detalle: e.causa || e.message };
      }
    }

    const publico = (m) => ({
      nombre: m.id, csv_sha256: m.csv_sha256, build_id: m.build_id, bytes: m.bytes, nombre_csv: m.nombre_csv || null,
      bytes_csv: m.bytes_csv || null, guardado: m.guardado || null, filas: m.filas || null, version: m.version || null, almacen: 'idb',
    });

    function estructuraValida(m) {
      return !!m && m.formato === FORMATO && m.estado === 'completo' && typeof m.id === 'string' && Array.isArray(m.huellas)
        && Number.isSafeInteger(m.bytes) && m.bytes > 0 && m.n_trozos === m.huellas.length && !!m.informe
        && /^[0-9a-f]{64}$/.test(String(m.csv_sha256));
    }


    async function inventario(db) {
      const [manifiestos, claves] = await Promise.all([
        transaccion(db, MANIFIESTOS, 'readonly', (a) => a[MANIFIESTOS].getAll()),
        transaccion(db, TROZOS, 'readonly', (a) => a[TROZOS].getAllKeys()),
      ]);
      const porId = new Map();
      for (const k of claves) {
        const id = idDeClave(k);
        if (id === null) continue;
        porId.set(id, (porId.get(id) || 0) + 1);
      }
      const lista = (manifiestos || []).map((m) => {
        const valida = estructuraValida(m) && porId.get(m.id) === m.n_trozos;
        return { m, valida, deEsta: !!m && m.build_id === buildId };
      });
      const validos = lista.filter((x) => x.valida && x.deEsta).sort((a, b) => String(b.m.guardado).localeCompare(String(a.m.guardado)));
      const conManifiesto = new Set(lista.map((x) => x.m && x.m.id));
      const huerfanos = [...porId.keys()].filter((id) => !conManifiesto.has(id));
      return { lista, validos, huerfanos, porId };
    }

    async function borrarIds(db, ids) {
      if (!ids.length) return;
      await transaccion(db, [MANIFIESTOS, TROZOS], 'readwrite', (a) => {
        for (const id of ids) {
          a[MANIFIESTOS].delete(id);
          a[TROZOS].delete(rango(g, id));
        }
      });
    }

    async function estado(o = {}) {
      const r = { disponible: false, recordado: null, otros: 0, obsoletos: 0, danados: 0, huerfanos: 0, liberados: null, error: null };
      try {
        await conBd(async (db) => {
          r.disponible = true;
          const inv = await inventario(db);
          const elegido = inv.validos[0] || null;
          r.recordado = elegido ? publico(elegido.m) : null;
          r.obsoletos = inv.lista.filter((x) => !x.deEsta).length;
          r.danados = inv.lista.filter((x) => x.deEsta && !x.valida).length;
          r.huerfanos = inv.huerfanos.length;
          r.otros = inv.lista.length - (elegido ? 1 : 0);
          if (o.limpiar) {
            const quitar = inv.lista.filter((x) => x !== elegido);
            const lib = { obsoletos: 0, danados: 0, sobrantes: 0, huerfanos: inv.huerfanos.length, bytes: 0, nombres: [] };
            for (const x of quitar) {
              lib.bytes += (x.m && x.m.bytes) || 0;
              if (!x.deEsta) lib.obsoletos++;
              else if (!x.valida) lib.danados++;
              else lib.sobrantes++;
              lib.nombres.push(x.m && x.m.id);
            }
            for (const id of inv.huerfanos) lib.bytes += (inv.porId.get(id) || 0) * 16 * MIB;
            const ids = quitar.map((x) => x.m && x.m.id).filter((id) => typeof id === 'string').concat(inv.huerfanos);

            if (quitar.some((x) => !x.m || typeof x.m.id !== 'string')) {
              const clavesM = await transaccion(db, MANIFIESTOS, 'readonly', (a) => a[MANIFIESTOS].getAllKeys());
              const buenas = new Set(inv.lista.filter((x) => x.m && typeof x.m.id === 'string').map((x) => x.m.id));
              for (const k of clavesM) if (!buenas.has(k)) ids.push(k);
            }
            if (ids.length) {
              await borrarIds(db, ids);
              r.liberados = lib;
            }
            r.otros = 0;
          }
        }, 'No se pudo comprobar si hay una base recordada');
      } catch (e) {
        r.disponible = e.codigo !== 'NO_DISPONIBLE';
        r.error = { codigo: e.codigo, mensaje: e.message };
      }
      return r;
    }

    async function estimar() {
      const st = g.navigator && g.navigator.storage;
      if (!st || typeof st.estimate !== 'function') return null;
      try { const e = await st.estimate(); return { quota: e.quota, usage: e.usage }; } catch (e) { return null; }
    }

    async function guardar(o = {}) {
      const t0 = ahora();
      const cliente = o.cliente;
      const alProgreso = typeof o.alProgreso === 'function' ? o.alProgreso : () => {};
      const ini = await pedir(cliente, 'base_exportar_inicio', {}, { prioridad: 'fondo' });
      const cancelarExportacion = () => pedir(cliente, 'base_exportar_cancelar', {}).catch(() => {});
      const informe = ini.informe;
      const csvSha = informe && informe.huella && informe.huella.sha256;
      if (!/^[0-9a-f]{64}$/.test(String(csvSha))) {
        await cancelarExportacion();
        throw new ErrorBase('SIN_HUELLA', 'Todavía no se conoce la huella SHA-256 del CSV: vuelva a intentarlo en unos segundos.');
      }
      const info = ini.info;
      return conBd(async (db) => {
        const inv = await inventario(db);
        const mismo = inv.validos.find((x) => x.m.csv_sha256 === csvSha);
        if (mismo) {
          await cancelarExportacion();
          return { recordado: publico(mismo.m), ya_recordado: true, borrados: [], bytes_borrados: 0, ms: ahora() - t0 };
        }

        const est = await estimar();
        if (est && typeof est.quota === 'number' && est.quota > 0) {
          const libres = est.quota - (est.usage || 0);
          const margen = Math.max(32 * MIB, Math.min(128 * MIB, Math.ceil(info.bytes / 2)));
          if (libres < info.bytes + margen) {
            await cancelarExportacion();
            throw new ErrorBase('CUOTA', `No hay espacio suficiente en este navegador para recordar la base: hacen falta unos ${nf((info.bytes + margen) / MIB)} MiB `
              + `y quedan ${nf(Math.max(0, libres) / MIB)} MiB. La base sigue abierta en esta pestaña; puede liberar espacio y volver a intentarlo, o seguir sin recordarla.`,
            { hacen_falta: info.bytes + margen, libres });
          }
        }
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        let hecho = 0;
        let fin;
        try {
          for (;;) {
            if (o.signal && o.signal.aborted) throw Object.assign(new Error('cancelado'), { name: 'AbortError', r2Cancelado: true });
            const t = await pedir(cliente, 'base_exportar_trozo', {}, { prioridad: 'fondo' });
            if (t.fin) break;
            const buf = t.buf;
            await transaccion(db, TROZOS, 'readwrite', (a) => a[TROZOS].put(buf, clave(id, t.i)));
            hecho += t.bytes;
            alProgreso(hecho, info.bytes);
          }
          fin = await pedir(cliente, 'base_exportar_fin', {}, { prioridad: 'fondo' });
          if (fin.bytes !== info.bytes || fin.huellas.length !== info.n_trozos) throw new ErrorBase('ALMACEN', 'La base cambió mientras se guardaba. Vuelva a intentarlo.');
          const v = informe.version_csv;
          const manifiesto = {
            id, formato: FORMATO, build_id: buildId, csv_sha256: csvSha, estado: 'completo', bytes: fin.bytes, page_size: info.page_size,
            trozo_bytes: info.trozo_bytes, n_trozos: fin.huellas.length, huellas: fin.huellas, huella: fin.huella,
            guardado: new Date().toISOString(), nombre_csv: informe.huella.nombre || null, bytes_csv: informe.huella.bytes || null,
            filas: informe.n_filas || null, version: v ? { id: v.id || null, corto: v.corto || null, etiqueta: v.etiqueta || null } : null,
            informe, construido_en: ini.construido_en || null,
          };

          const n = await transaccion(db, TROZOS, 'readonly', (a) => a[TROZOS].count(rango(g, id)));
          if (n !== manifiesto.n_trozos) throw new ErrorBase('ALMACEN', 'La base guardada está incompleta y se ha borrado. Vuelva a intentarlo.');
          await transaccion(db, MANIFIESTOS, 'readwrite', (a) => a[MANIFIESTOS].put(manifiesto, id));

          const despues = await inventario(db);
          const otros = despues.lista.filter((x) => !x.m || x.m.id !== id);
          const borrados = otros.map((x) => x.m && x.m.id).filter(Boolean).concat(despues.huerfanos.filter((h) => h !== id));
          const bytesBorrados = otros.reduce((s, x) => s + ((x.m && x.m.bytes) || 0), 0);
          await borrarIds(db, borrados);
          return { recordado: publico(manifiesto), ya_recordado: false, borrados, bytes_borrados: bytesBorrados, ms: ahora() - t0 };
        } catch (e) {
          if (!fin) await cancelarExportacion();
          try { await borrarIds(db, [id]); } catch (e2) {   }
          throw clasificar(e, 'No se pudo guardar la base en este navegador');
        }
      }, 'No se pudo guardar la base en este navegador');
    }

    async function abrir(o = {}) {
      const t0 = ahora();
      const cliente = o.cliente;
      const alProgreso = typeof o.alProgreso === 'function' ? o.alProgreso : () => {};
      return conBd(async (db) => {
        const inv = await inventario(db);
        const elegido = inv.validos[0];
        if (!elegido) {
          const danados = inv.lista.filter((x) => x.deEsta && !x.valida);
          if (danados.length) {
            await borrarIds(db, danados.map((x) => x.m && x.m.id).filter(Boolean));
            throw new ErrorBase('RECORDADO_DANADO', MENSAJES.RECORDADO_DANADO);
          }
          throw new ErrorBase('NO_RECORDADO', inv.lista.length
            ? 'La base recordada es de otra versión de Diarios Explorer y no sirve para esta. Elija el CSV para volver a construirla.'
            : MENSAJES.NO_RECORDADO);
        }
        const m = elegido.m;
        let empezado = false;
        try {
          await pedir(cliente, 'base_importar_inicio', { bytes: m.bytes, page_size: m.page_size, trozo_bytes: m.trozo_bytes, huellas: m.huellas, huella: m.huella });
          empezado = true;
          let hecho = 0;
          for (let i = 0; i < m.n_trozos; i++) {
            if (o.signal && o.signal.aborted) throw Object.assign(new Error('cancelado'), { name: 'AbortError', r2Cancelado: true });
            const buf = await transaccion(db, TROZOS, 'readonly', (a) => a[TROZOS].get(clave(m.id, i)));
            if (!buf || typeof buf.byteLength !== 'number') throw new ErrorBase('RECORDADO_DANADO', MENSAJES.RECORDADO_DANADO);
            const n = buf.byteLength;
            await pedir(cliente, 'base_importar_trozo', { i, buf }, { transferir: [buf] });
            hecho += n;
            alProgreso(hecho, m.bytes);
          }
          const r = await pedir(cliente, 'base_importar_fin', { informe: m.informe, construido_en: m.construido_en || null });
          return { informe: r.informe, construido_en: r.construido_en, recordado: publico(m), ms: ahora() - t0 };
        } catch (e) {
          if (empezado) await pedir(cliente, 'base_importar_descartar', {}).catch(() => {});
          const err = clasificar(e, 'No se pudo abrir la base recordada');
          if (err.codigo === 'RECORDADO_DANADO') {
            err.message = MENSAJES.RECORDADO_DANADO;
            try { await borrarIds(db, [m.id]); } catch (e2) {   }
          }
          throw err;
        }
      }, 'No se pudo abrir la base recordada');
    }

    async function olvidar() {
      const t0 = ahora();
      return conBd(async (db) => {
        const inv = await inventario(db);
        const bytes = inv.lista.reduce((s, x) => s + ((x.m && x.m.bytes) || 0), 0)
          + inv.huerfanos.reduce((s, id) => s + (inv.porId.get(id) || 0) * 16 * MIB, 0);
        const borrados = inv.lista.map((x) => x.m && x.m.id).filter(Boolean).concat(inv.huerfanos);
        await transaccion(db, [MANIFIESTOS, TROZOS], 'readwrite', (a) => { a[MANIFIESTOS].clear(); a[TROZOS].clear(); });
        return { borrados, bytes_borrados: bytes, ms: ahora() - t0 };
      }, 'No se pudo olvidar la base');
    }

    return { tipo: 'idb', probar, estado, guardar, abrir, olvidar };
  }

  R2.baseLocal = { BD, VERSION_BD, FORMATO, CERROJO, MENSAJES, ErrorBase, clave, conCerrojo, crear };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/persistencia/base_local.js

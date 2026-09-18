/* ===== src/worker/principal.js ===== */
/* 2REP_Standalone · worker/principal.js
 *
 * Código principal del worker de la aplicación: bucle de mensajes que envuelve R2.ingesta y atiende `pedir`.
 * Se concatena DETRÁS de vendor/sqlite-wasm/sqlite3.js, los grupos `worker` y `engine` de src/orden.json y
 * `R2.datos = { normalizacion, csv_publicado, fuente, edicion, sesiones }` (grupo `principal` de orden.json; ARQUITECTURA.md §8).
 *
 * Protocolo (versión 1)
 *   hilo → worker: iniciar{v, wasm} · construir{archivo, lectura: 'auto' | 'principal'} · trozo{id, buf | error}
 *                  pedir{id, op, args, canal, prioridad, presupuestoMs} · cancelar{id} · recordar{id} · olvidar{id}
 *   worker → hilo: hola{v, sqlite, ua, referencia, capacidades} · progreso{ev} · progreso_op{id, ev} · modo_lectura{modo, espera_ms, error}
 *                  leer{id, off, len} · listo{informe, ms, modo_lectura} · huella{informe, ms, max_paso_ms}
 *                  fallo_huella{error} · fallo_construccion{error, ms, modo_lectura}
 *                  resp{id, status, cuerpo, tipoCuerpo, cabeceras, ms} | resp{id, cancelada, motivo} · fatal{codigo, mensaje, causa}
 *
 * Operaciones (`pedir.op`)
 *   api      {metodo, ruta, query, queryLista, cuerpoTexto}: cualquier ruta de /api, despachada por R2.router (M4). La
 *            prioridad sale de la ruta (R2.router.prioridad) salvo que la petición la fije.
 *   info, facetas, estado   las de M3 (info y facetas devuelven lo mismo que GET /api/info y /api/facets).
 *   corpus_recordado{limpiar} · recordar · abrir_recordado · olvidar   base recordada en OPFS (web/opfs.js, §15)
 *   abrir_servido           la base que viaja con la pagina (web/servido.js, §15 bis): se descarga, se comprueba y se abre
 *   base_exportar_{inicio,trozo,fin,cancelar} · base_importar_{inicio,trozo,fin,descartar}   base en trozos de 16 MiB para
 *            IndexedDB (web/trozos.js, persistencia/base_local.js); los trozos viajan transferidos (respuesta con `transferir`).
 *   worker → hilo, además: progreso_base{hecho, total} al abrir la base recordada desde OPFS.
 *   Cualquier otra responde 501 con el aviso de próxima versión.
 * Planificador: dos colas (interactiva antes que fondo); una petición con el mismo `canal` sustituye a la que espera y
 * marca como cancelada la que está en marcha; una operación troceada llama a ctx.ceder(), que deja pasar lo
 * interactivo y lanza si la cancelaron. Nunca se cede a mitad de una sentencia SQL.
 *
 * Contexto de las rutas (ctx del enrutador): { db, sqlite3, corpusListo, corpus: {nombre, n_speeches}, nucleo, cache,
 * servicios, ceder(), cancelada, presupuestoMs }; nucleo = { informe, construidoEn, errorHuella, huellaPendiente,
 * modoLectura, facetasTexto(), sesiones() } (el índice de sesiones se construye la primera vez que se pide).
 *
 * Un worker construye UN solo corpus: la memoria de WebAssembly no se libera, así que otro archivo = otro worker.
 */
(function (R2) {
  'use strict';

  const VERSION_PROTOCOLO = 1;
  const MSG_PROXIMA = 'Esta función no está disponible en esta versión del explorador.';
  const MSG_NO_LISTO = 'El corpus todavía no está listo.';

  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const textoError = (e) => (e && e.name && e.message ? `${e.name}: ${e.message}` : String(e && e.message ? e.message : e));

  class ErrorHttp extends Error {
    constructor(status, mensaje) {
      super(mensaje);
      this.name = 'ErrorHttp';
      this.status = status;
    }
  }
  const esErrorHttp = (e) => !!e && e.name === 'ErrorHttp' && Number.isInteger(e.status);

  const CANCELADA = Object.freeze({ cancelada: true });

  /** Cede el hilo del worker: MessageChannel (sin el retraso mínimo de setTimeout) o setTimeout(0). */
  function crearCedente() {
    if (typeof MessageChannel !== 'function') return () => new Promise((r) => setTimeout(r, 0));
    const canal = new MessageChannel();
    const cola = [];
    canal.port1.onmessage = () => { const f = cola.shift(); if (f) f(); };
    return () => new Promise((resolver) => { cola.push(resolver); canal.port2.postMessage(0); });
  }

  /** Valores del modelo Python de R2.fuente (Map, BigInt, float envuelto) → JSON plano (R2.info.plano). */
  function plano(v) {
    if (R2.info) return R2.info.plano(v);
    return JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? Number(x) : x instanceof Map ? Object.fromEntries(x) : x)));
  }

  /** «2026-09-14T18:03:12», hora local sin milisegundos (como manifest.built_at). */
  function isoLocal(fecha) {
    const d = fecha || new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  /**
   * @param {object} entorno
   *   post(mensaje, transferibles)   envía al hilo principal
   *   iniciarSqlite(wasm) → Promise<sqlite3>
   *   ceder() → Promise              cede el hilo (por defecto MessageChannel)
   *   ua                             navigator.userAgent
   */
  function crearNucleo(entorno) {
    const post = entorno.post;
    const iniciarSqlite = entorno.iniciarSqlite;
    const ceder = entorno.ceder || crearCedente();
    if (typeof post !== 'function' || typeof iniciarSqlite !== 'function') throw new TypeError('principal: faltan post o iniciarSqlite');

    const n = {
      estado: 'nuevo', // nuevo | iniciando | preparado | construyendo | listo | fallido
      sqlite3: null, db: null, informe: null, modoLectura: 'worker', construidoEn: null, errorHuella: null,
      huellaPendiente: false, lecturasEnWorker: 0,
    };
    let preparado = null;
    let nLectura = 0;
    const lecturas = new Map();
    const cola = { interactiva: [], fondo: [] };
    const enCurso = new Set();
    let cacheFacetas = null;
    let cachePais = null;
    let indiceSesiones = null;
    /** Estado del motor que comparten las rutas (tabla TEMP sel_ids, etc.). */
    const cacheMotor = {};

    const enviar = (m, t) => {
      try { post(m, t); } catch (e) {
        try { post({ tipo: 'fatal', codigo: 'PROTOCOLO', causa: `no se pudo enviar «${m.tipo}»: ${textoError(e)}` }); } catch (e2) { /* sin canal */ }
      }
    };
    const errorClonable = (e, t0) => (e && typeof e.aObjeto === 'function'
      ? e.aObjeto()
      : { codigo: 'ERROR_INTERNO', mensaje: `Error interno al construir el corpus: ${textoError(e)}`, causa: textoError(e), ms: t0 != null ? ahora() - t0 : null });

    // ------------------------------------------------------------------------------------------------ iniciar
    function iniciar(m) {
      if (preparado) {
        enviar({ tipo: 'fatal', codigo: 'PROTOCOLO', causa: 'iniciar recibido dos veces' });
        return;
      }
      n.estado = 'iniciando';
      if (m.v !== VERSION_PROTOCOLO) {
        enviar({ tipo: 'fatal', codigo: 'PROTOCOLO', causa: `versión del protocolo ${m.v}; este worker habla la ${VERSION_PROTOCOLO}` });
        preparado = Promise.reject(new Error('protocolo'));
        preparado.catch(() => {});
        return;
      }
      preparado = Promise.resolve().then(() => iniciarSqlite(m.wasm)).then((s) => {
        n.sqlite3 = s;
        if (n.estado === 'iniciando') n.estado = 'preparado';
        enviar({ tipo: 'hola', v: VERSION_PROTOCOLO, sqlite: s.version.libVersion, ua: entorno.ua || '', referencia: referencia(),
          capacidades: { FileReaderSync: typeof FileReaderSync === 'function', crossOriginIsolated: !!globalThis.crossOriginIsolated,
            fuente: !!R2.fuente, motor_listo: !!R2.ingesta } });
        return s;
      }, (e) => {
        n.estado = 'fallido';
        enviar({ tipo: 'fatal', codigo: 'WASM_NO_ARRANCA', causa: textoError(e) });
        throw e;
      });
      preparado.catch(() => {});
    }

    /** Referencia que ve la pantalla de apertura: la colección ParlaIbero (la cita del país llega con /api/info). */
    function referencia() {
      const c = R2.datos && R2.datos.parlaibero;
      const fuente = c ? { cita: c.cita || c.nombre, cita_corta: c.nombre, url: c.url, licencia: c.licencia || null, licencia_nombre: c.licencia || null }
        : null;
      const fuentes = (R2.datos && R2.datos.fuentes) || {};
      return { publicado: null, fuente, paises: Object.keys(fuentes) };
    }

    // ------------------------------------------------------------------------------------------------ construir
    function pedirAlPrincipal(off, len) {
      return new Promise((resolver, rechazar) => {
        const id = ++nLectura;
        lecturas.set(id, { resolver, rechazar });
        enviar({ tipo: 'leer', id, off, len });
      });
    }

    function fuenteDe(archivo) {
      return {
        tamano: archivo.size,
        nombre: archivo.name != null ? archivo.name : null,
        async leerTrozo(off, len) {
          if (n.modoLectura === 'worker') {
            const t = ahora();
            try {
              const u8 = new Uint8Array(await archivo.slice(off, off + len).arrayBuffer());
              n.lecturasEnWorker++;
              return u8;
            } catch (e) {
              if (n.lecturasEnWorker > 0) throw e; // ya se leía bien aquí: el archivo cambió o desapareció
              n.modoLectura = 'principal';
              enviar({ tipo: 'modo_lectura', modo: 'principal', espera_ms: ahora() - t, error: textoError(e) });
            }
          }
          return pedirAlPrincipal(off, len);
        },
      };
    }

    async function construir(m) {
      if (!preparado) {
        enviar({ tipo: 'fallo_construccion', error: { codigo: 'ESTADO', mensaje: 'Error interno de la página: se pidió construir antes de iniciar el motor.' } });
        return;
      }
      if (n.estado === 'construyendo' || n.estado === 'listo' || n.estado === 'abriendo' || n.db) {
        enviar({ tipo: 'fallo_construccion', error: { codigo: 'ESTADO', mensaje: 'Error interno de la página: este motor ya construyó un corpus; hace falta uno nuevo.' } });
        return;
      }
      const archivo = m.archivo;
      if (!archivo || typeof archivo.slice !== 'function' || typeof archivo.size !== 'number') {
        enviar({ tipo: 'fallo_construccion', error: { codigo: 'ESTADO', mensaje: 'Error interno de la página: no llegó ningún archivo.' } });
        return;
      }
      n.estado = 'construyendo';
      if (m.lectura === 'principal') {
        // El hilo principal sabe que aquí no se podrá leer (WebKit por file://): se evita el intento y su error de consola.
        n.modoLectura = 'principal';
        enviar({ tipo: 'modo_lectura', modo: 'principal', espera_ms: 0, error: null, motivo: 'preferencia' });
      }
      try { await preparado; } catch (e) { return; } // ya se envió fatal
      const t0 = ahora();
      let r;
      try {
        r = await R2.ingesta.construir(fuenteDe(archivo), n.sqlite3, {
          progreso: (ev) => enviar({ tipo: 'progreso', ev }),
          verificarCambios: true,
        });
      } catch (e) {
        n.estado = 'fallido';
        enviar({ tipo: 'fallo_construccion', error: errorClonable(e), ms: ahora() - t0, modo_lectura: n.modoLectura });
        return;
      }
      n.db = r.db;
      n.informe = r.informe;
      n.construidoEn = isoLocal();
      n.estado = 'listo';
      n.huellaPendiente = r.informe.huella.sha256 === null;
      enviar({ tipo: 'listo', informe: r.informe, ms: ahora() - t0, modo_lectura: n.modoLectura });
      if (!n.huellaPendiente) return;

      // SHA-256 diferida: relee el archivo cediendo el hilo; mientras tanto se atienden peticiones.
      const t1 = ahora();
      let maxPaso = 0, ultimo = ahora();
      try {
        await r.completarHuella({
          ceder: async () => {
            maxPaso = Math.max(maxPaso, ahora() - ultimo);
            await ceder();
            ultimo = ahora();
          },
        });
        n.huellaPendiente = false;
        enviar({ tipo: 'huella', informe: r.informe, ms: ahora() - t1, max_paso_ms: maxPaso });
      } catch (e) {
        n.huellaPendiente = false;
        n.errorHuella = errorClonable(e);
        enviar({ tipo: 'fallo_huella', error: n.errorHuella });
      }
    }

    function trozo(m) {
      const p = lecturas.get(m.id);
      if (!p) return;
      lecturas.delete(m.id);
      if (m.error) p.rechazar(Object.assign(new Error(m.error.message), { name: m.error.name }));
      else p.resolver(new Uint8Array(m.buf));
    }

    // ------------------------------------------------------------------------------------------------ operaciones
    function facetasTexto() {
      if (cacheFacetas === null) cacheFacetas = n.db.selectValue("SELECT value FROM meta WHERE key='facets'") || '{}';
      return cacheFacetas;
    }

    function sesiones() {
      if (!indiceSesiones && R2.sessions && n.db) {
        indiceSesiones = R2.sessions.cargar({ db: n.db, sqlite3: n.sqlite3 }, undefined, null);
      }
      return indiceSesiones;
    }

    /** País del corpus (meta.pais, dos letras), o '' si la base no lo tiene. */
    function pais() {
      if (cachePais === null) {
        let p = '';
        try { p = n.db ? String(n.db.selectValue("SELECT value FROM meta WHERE key='pais'") || '') : ''; } catch (e) { p = ''; }
        if (!p && n.informe && n.informe.pais) p = String(n.informe.pais);
        cachePais = p.toUpperCase();
      }
      return cachePais;
    }

    /** Vista del núcleo para las rutas (info, facetas, sesiones). */
    const vista = Object.freeze({
      get informe() { return n.informe; },
      get construidoEn() { return n.construidoEn; },
      get errorHuella() { return n.errorHuella; },
      get huellaPendiente() { return n.huellaPendiente; },
      get modoLectura() { return n.modoLectura; },
      get estado() { return n.estado; },
      get pais() { return pais(); },
      facetasTexto,
      sesiones,
    });

    function contextoApi(ctxOp) {
      return {
        db: n.db,
        sqlite3: n.sqlite3,
        corpusListo: n.estado === 'listo',
        // Corpus de las bibliotecas: «Diarios_<país>» (R2.info.corpusBibliotecas), no el nombre del archivo.
        corpus: n.informe ? { nombre: R2.info ? R2.info.corpusBibliotecas(vista) : 'Diarios_XX', n_speeches: n.informe.n_filas } : null,
        nucleo: vista,
        cache: cacheMotor,
        servicios: R2.router ? R2.router.servicios : {},
        ceder: ctxOp.ceder,
        get cancelada() { return ctxOp.cancelada; },
        presupuestoMs: ctxOp.presupuestoMs,
        // progreso(ev): avisos de avance de una operación larga (léxico) → progreso_op{id, ev} → alProgreso de la petición.
        progreso: ctxOp.progreso,
      };
    }

    const OPS = {
      api: { prioridad: 'interactiva', listo: false,
        prioridadDe: (args) => (R2.router && args ? R2.router.prioridad(args.metodo, args.ruta) : 'interactiva'),
        fn: async (args, ctx) => {
          if (!R2.router) throw new ErrorHttp(501, MSG_PROXIMA);
          const r = await R2.router.despachar(args || {}, contextoApi(ctx));
          return { status: r.status, cuerpo: r.cuerpo, tipo: r.tipo, cabeceras: r.cabeceras };
        } },
      info: { prioridad: 'interactiva', listo: true,
        fn: () => {
          if (!R2.info) throw new ErrorHttp(501, MSG_PROXIMA);
          return { cuerpo: R2.info.cuerpoInfo(vista) };
        } },
      facetas: { prioridad: 'interactiva', listo: true, fn: () => ({ cuerpo: facetasTexto(), tipo: 'json-texto' }) },
      estado: { prioridad: 'interactiva', listo: false,
        fn: () => ({ cuerpo: { estado: n.estado, avisos_sqlite: R2.principal ? R2.principal.AVISOS_SQLITE.slice() : [], informe: n.informe, modo_lectura: n.modoLectura, huella_pendiente: n.huellaPendiente,
          en_cola: cola.interactiva.length + cola.fondo.length, en_curso: enCurso.size } }) },
      // Versión web: base recordada en OPFS (web/opfs.js). El hilo principal solo las pide por https o localhost y con el
      // cerrojo de la base (navigator.locks). args.limpiar: borra bases de otra versión, dañadas o sobrantes.
      corpus_recordado: { prioridad: 'interactiva', listo: false,
        fn: (args) => conOpfs(async (o) => ({ cuerpo: await o.estado({ limpiar: !!(args && args.limpiar) }) })) },
      recordar: { prioridad: 'fondo', listo: true,
        fn: () => conOpfs(async (o) => {
          if (n.huellaPendiente || !n.informe || !n.informe.huella || !n.informe.huella.sha256) {
            throw new ErrorHttp(409, 'Todavía se está comprobando la huella del CSV: el corpus se podrá recordar en unos segundos.');
          }
          return { cuerpo: await o.recordar({ db: n.db, informe: n.informe, construidoEn: n.construidoEn }) };
        }) },
      abrir_recordado: { prioridad: 'interactiva', listo: false,
        fn: () => conOpfs(async (o) => {
          if (n.db || n.estado !== 'preparado') throw new ErrorHttp(409, 'Este motor ya tiene un corpus abierto o está construyendo uno.');
          const r = await o.abrir({ alProgreso: (hecho, total) => enviar({ tipo: 'progreso_base', hecho, total }) });
          n.db = r.db;
          n.informe = r.informe;
          n.construidoEn = r.construidoEn;
          n.modoLectura = 'worker';
          n.huellaPendiente = false;
          n.errorHuella = null;
          n.estado = 'listo';
          cacheFacetas = null;
          cachePais = null;
          indiceSesiones = null;
          return { cuerpo: { informe: r.informe, construido_en: r.construidoEn, recordado: r.recordado, ms: r.ms } };
        }) },
      olvidar: { prioridad: 'interactiva', listo: false, fn: () => conOpfs(async (o) => ({ cuerpo: await o.olvidar() })) },
      // Versión web: la base que viaja con la página (web/servido.js). No hay CSV que elegir ni huella que comprobar
      // después: la base ya está construida y su sha256 se comprueba al descargarla.
      abrir_servido: { prioridad: 'interactiva', listo: false,
        fn: (args) => conServido(async (s) => {
          if (n.db || n.estado !== 'preparado') throw new ErrorHttp(409, 'Este motor ya tiene un corpus abierto o está construyendo uno.');
          n.estado = 'abriendo';
          let r;
          try {
            r = await s.abrir({ base: (args && args.base) || '', alProgreso: (hecho, total) => enviar({ tipo: 'progreso_base', hecho, total }) });
          } catch (e) {
            n.estado = 'preparado';
            throw e;
          }
          Object.assign(n, { db: r.db, informe: r.informe, construidoEn: r.construidoEn, modoLectura: 'worker',
            huellaPendiente: false, errorHuella: null, estado: 'listo' });
          cacheFacetas = null;
          cachePais = null;
          indiceSesiones = null;
          return { cuerpo: { informe: r.informe, construido_en: r.construidoEn, servido: r.servido, ms: r.ms } };
        }) },

      // HTML local (file://): la base en trozos de 16 MiB para que el hilo principal la guarde en IndexedDB y la devuelva
      // (web/trozos.js, persistencia/base_local.js). Los trozos viajan transferidos, sin copia.
      base_exportar_inicio: { prioridad: 'fondo', listo: true,
        fn: () => conTrozos(() => {
          if (n.huellaPendiente || !n.informe || !n.informe.huella || !n.informe.huella.sha256) {
            throw new ErrorHttp(409, 'Todavía se está comprobando la huella del CSV: la base se podrá recordar en unos segundos.');
          }
          if (exportacion) exportacion.cerrar();
          exportacion = R2.trozos.crearExportacion(n.sqlite3, n.db);
          return { cuerpo: { info: exportacion.info, informe: n.informe, construido_en: n.construidoEn } };
        }) },
      base_exportar_trozo: { prioridad: 'fondo', listo: true,
        fn: () => conTrozos(() => {
          if (!exportacion) throw new ErrorHttp(409, 'No hay ninguna exportación de la base en curso.');
          const t = exportacion.siguiente();
          if (!t) return { cuerpo: { fin: true } };
          return { cuerpo: { fin: false, i: t.i, bytes: t.bytes, huella: t.huella, buf: t.buf }, transferir: [t.buf] };
        }) },
      base_exportar_fin: { prioridad: 'fondo', listo: true,
        fn: () => conTrozos(() => {
          if (!exportacion) throw new ErrorHttp(409, 'No hay ninguna exportación de la base en curso.');
          try { return { cuerpo: exportacion.fin() }; } finally { exportacion = null; }
        }) },
      base_exportar_cancelar: { prioridad: 'interactiva', listo: false,
        fn: () => { if (exportacion) { exportacion.cerrar(); exportacion = null; } return { cuerpo: { ok: true } }; } },
      base_importar_inicio: { prioridad: 'interactiva', listo: false,
        fn: (args) => conTrozos(() => {
          if (n.db || n.estado !== 'preparado' || importacion) throw new ErrorHttp(409, 'Este motor ya tiene un corpus abierto o está construyendo uno.');
          importacion = R2.trozos.crearImportacion(n.sqlite3, args || {});
          n.estado = 'abriendo';
          return { cuerpo: { ok: true } };
        }) },
      base_importar_trozo: { prioridad: 'interactiva', listo: false,
        fn: (args) => conTrozos(() => {
          if (!importacion) throw new ErrorHttp(409, 'No hay ninguna apertura de la base en curso.');
          try {
            importacion.poner(Number(args.i), args.buf ? new Uint8Array(args.buf) : null);
          } catch (e) {
            importacion = null;
            if (n.estado === 'abriendo') n.estado = 'preparado';
            throw e;
          }
          return { cuerpo: { recibidos: importacion.recibidos } };
        }) },
      base_importar_fin: { prioridad: 'interactiva', listo: false,
        fn: (args) => conTrozos(() => {
          if (!importacion) throw new ErrorHttp(409, 'No hay ninguna apertura de la base en curso.');
          const im = importacion;
          importacion = null;
          let db;
          try { db = im.terminar(); } catch (e) { n.estado = 'preparado'; throw e; }
          const informe = args && args.informe;
          if (!informe || !informe.huella) {
            db.close();
            n.estado = 'preparado';
            throw new R2.opfs.ErrorAlmacen('RECORDADO_DANADO', 'La base recordada no tiene el informe de construcción y se ha borrado. Elija el CSV para volver a construirla.');
          }
          Object.assign(n, { db, informe, construidoEn: args.construido_en || null, modoLectura: 'worker', huellaPendiente: false,
            errorHuella: null, estado: 'listo' });
          cacheFacetas = null;
          cachePais = null;
          indiceSesiones = null;
          return { cuerpo: { informe, construido_en: n.construidoEn } };
        }) },
      base_importar_descartar: { prioridad: 'interactiva', listo: false,
        fn: () => {
          if (importacion) { importacion.descartar(); importacion = null; }
          if (n.estado === 'abriendo') n.estado = 'preparado';
          return { cuerpo: { ok: true } };
        } },
    };

    let exportacion = null;
    let importacion = null;
    /** Operaciones de R2.trozos: sus ErrorAlmacen salen como respuesta con `codigo` y mensaje en español. */
    async function conTrozos(fn) {
      if (!R2.trozos || !R2.opfs) throw new ErrorHttp(501, MSG_PROXIMA);
      try { await preparado; } catch (e) { throw new ErrorHttp(503, MSG_NO_LISTO); }
      try {
        return await fn();
      } catch (e) {
        if (esErrorHttp(e) || !(e instanceof R2.opfs.ErrorAlmacen)) throw e;
        const status = { RECORDADO_DANADO: 409, MEMORIA: 507 }[e.codigo] || 500;
        return { status, cuerpo: { error: e.message, codigo: e.codigo } };
      }
    }

    let opfs = null;
    /** Ejecuta fn con R2.opfs (creado la primera vez); sus errores salen como respuesta con `codigo` y mensaje en español. */
    async function conOpfs(fn) {
      if (!R2.opfs) throw new ErrorHttp(501, MSG_PROXIMA);
      try { await preparado; } catch (e) { throw new ErrorHttp(503, MSG_NO_LISTO); }
      if (!opfs) opfs = R2.opfs.crear({ sqlite3: n.sqlite3, buildId: R2.datos && R2.datos.edicion ? R2.datos.edicion.build_id : '' });
      try {
        return await fn(opfs);
      } catch (e) {
        if (esErrorHttp(e) || !(e instanceof R2.opfs.ErrorAlmacen)) throw e;
        const status = { NO_RECORDADO: 404, CUOTA: 507, OPFS_BLOQUEADO: 409, SIN_HUELLA: 409, RECORDADO_DANADO: 409 }[e.codigo] || 500;
        return { status, cuerpo: { error: e.message, codigo: e.codigo } };
      }
    }

    let servido = null;
    /** Ejecuta fn con R2.servido; sus errores (los mismos ErrorAlmacen) salen como respuesta con `codigo` y mensaje. */
    async function conServido(fn) {
      if (!R2.servido || !R2.opfs) throw new ErrorHttp(501, MSG_PROXIMA);
      if (!R2.servido.ficha()) throw new ErrorHttp(404, 'Esta edición de la página no lleva datos dentro.');
      try { await preparado; } catch (e) { throw new ErrorHttp(503, MSG_NO_LISTO); }
      if (!servido) servido = R2.servido.crear({ sqlite3: n.sqlite3 });
      try {
        return await fn(servido);
      } catch (e) {
        if (esErrorHttp(e) || !(e instanceof R2.opfs.ErrorAlmacen)) throw e;
        const status = { NO_SERVIDO: 404, NO_SOPORTADO: 501, MEMORIA: 507, DESCARGA: 502, DESCOMPRESION: 502, SERVIDO_DANADO: 502 }[e.codigo] || 500;
        return { status, cuerpo: { error: e.message, codigo: e.codigo } };
      }
    }

    function responderCancelada(t) {
      enviar({ tipo: 'resp', id: t.id, cancelada: true, motivo: t.motivo || 'cancelada' });
    }

    function encolar(m) {
      const def = OPS[m.op];
      let prioridad = m.prioridad === 'fondo' || m.prioridad === 'interactiva' ? m.prioridad : null;
      if (!prioridad) {
        try {
          prioridad = def ? (def.prioridadDe ? def.prioridadDe(m.args) : def.prioridad) : 'interactiva';
        } catch (e) {
          prioridad = 'interactiva';
        }
      }
      if (prioridad !== 'fondo') prioridad = 'interactiva';
      const t = { id: m.id, op: m.op, args: m.args, canal: m.canal || null, prioridad, presupuestoMs: m.presupuestoMs || null,
        cancelada: false, motivo: null, cediendo: false };
      if (t.canal) {
        for (const q of [cola.interactiva, cola.fondo]) {
          for (let i = q.length - 1; i >= 0; i--) {
            if (q[i].canal === t.canal) {
              const [vieja] = q.splice(i, 1);
              vieja.motivo = 'sustituida';
              responderCancelada(vieja);
            }
          }
        }
        for (const e of enCurso) if (e.canal === t.canal) { e.cancelada = true; e.motivo = 'sustituida'; }
      }
      cola[prioridad].push(t);
      bombear();
    }

    function cancelar(m) {
      for (const q of [cola.interactiva, cola.fondo]) {
        const i = q.findIndex((t) => t.id === m.id);
        if (i >= 0) {
          const [t] = q.splice(i, 1);
          t.motivo = 'cancelada';
          responderCancelada(t);
          return;
        }
      }
      for (const t of enCurso) if (t.id === m.id) { t.cancelada = true; t.motivo = 'cancelada'; }
    }

    function bombear() {
      for (;;) {
        const q = cola.interactiva.length ? cola.interactiva : cola.fondo.length ? cola.fondo : null;
        if (!q) return;
        const libre = enCurso.size === 0
          || (q === cola.interactiva && [...enCurso].every((t) => t.prioridad === 'fondo' && t.cediendo));
        if (!libre) return;
        ejecutar(q.shift());
      }
    }

    async function ejecutar(t) {
      enCurso.add(t);
      const t0 = ahora();
      let resp;
      let transferir = null; // ArrayBuffer de la respuesta que se transfieren (trozos de la base)
      try {
        const def = OPS[t.op];
        if (!def) throw new ErrorHttp(501, MSG_PROXIMA);
        if (def.listo && n.estado !== 'listo') throw new ErrorHttp(503, MSG_NO_LISTO);
        const ctx = {
          get cancelada() { return t.cancelada; },
          presupuestoMs: t.presupuestoMs,
          progreso(ev) { if (!t.cancelada) enviar({ tipo: 'progreso_op', id: t.id, ev }); },
          async ceder() {
            t.cediendo = true;
            bombear();
            await ceder();
            t.cediendo = false;
            if (t.cancelada) throw CANCELADA;
          },
        };
        const r = await def.fn(t.args || {}, ctx);
        resp = { tipo: 'resp', id: t.id, status: r.status || 200, cuerpo: r.cuerpo, tipoCuerpo: r.tipo || 'json', cabeceras: r.cabeceras || {} };
        if (r.transferir) transferir = r.transferir;
      } catch (e) {
        if (e === CANCELADA) resp = null;
        else if (esErrorHttp(e)) resp = { tipo: 'resp', id: t.id, status: e.status, cuerpo: { error: e.message }, tipoCuerpo: 'json', cabeceras: {} };
        else if (e && e.motorAgotado) {
          resp = { tipo: 'resp', id: t.id, status: 500, tipoCuerpo: 'json', cabeceras: {},
            cuerpo: { error: `El navegador se quedó sin recursos al evaluar una expresión regular con este texto (${textoError(e)}). Pruebe en otro navegador.` } };
        } else resp = { tipo: 'resp', id: t.id, status: 500, cuerpo: { error: `Error interno: ${textoError(e)}` }, tipoCuerpo: 'json', cabeceras: {} };
      } finally {
        enCurso.delete(t);
      }
      if (t.cancelada || resp === null) responderCancelada(t);
      else {
        resp.ms = Math.round((ahora() - t0) * 10) / 10;
        enviar(resp, transferir || undefined);
      }
      bombear();
    }

    // ------------------------------------------------------------------------------------------------ mensajes
    n.recibir = (m) => {
      if (!m || typeof m !== 'object') {
        enviar({ tipo: 'fatal', codigo: 'PROTOCOLO', causa: 'mensaje vacío' });
        return;
      }
      switch (m.tipo) {
        case 'iniciar': iniciar(m); break;
        case 'construir': construir(m); break;
        case 'trozo': trozo(m); break;
        case 'pedir': encolar(m); break;
        case 'cancelar': cancelar(m); break;
        case 'recordar':
        case 'olvidar':
          // Caché del corpus: M8.
          enviar({ tipo: 'resp', id: m.id, status: 501, cuerpo: { error: MSG_PROXIMA }, tipoCuerpo: 'json', cabeceras: {}, ms: 0 });
          break;
        default:
          enviar({ tipo: 'fatal', codigo: 'PROTOCOLO', causa: `mensaje desconocido: ${String(m.tipo)}` });
      }
    };

    n.OPS = OPS;
    n.vista = vista;
    n.contextoApi = contextoApi;
    return n;
  }

  /** Instala el núcleo en el ámbito global de un worker (self). */
  function instalar(ambito) {
    const nucleo = crearNucleo({
      post: (m, t) => ambito.postMessage(m, t || []),
      ua: ambito.navigator ? ambito.navigator.userAgent : '',
      iniciarSqlite: (wasm) => new Promise((resolver, rechazar) => {
        if (typeof ambito.sqlite3InitModule !== 'function') throw new Error('falta sqlite3InitModule (vendor/sqlite-wasm/sqlite3.js)');
        // oo1 avisa de cada sqlite3_step() fallido con sqlite3.config.warn (por defecto console.warn), con el SQL: se
        // guarda con los demás avisos de SQLite en lugar de ensuciar la consola (el fallo llega redactado por el protocolo).
        ambito.sqlite3ApiConfig = Object.assign({}, ambito.sqlite3ApiConfig, { warn: (...a) => avisoSqlite(a) });
        ambito.sqlite3InitModule({
          print: () => {},
          // sqlite3.js manda aquí las sentencias que fallan («sqlite3_step() rc= 1 SQLITE_ERROR SQL = …»). El fallo ya
          // llega redactado al hilo principal por el protocolo: no se ensucia la consola con SQL interno; se guardan los
          // últimos mensajes para la op «estado».
          printErr: (...a) => avisoSqlite(a),
          // sqlite3.js de sqlite-wasm 3.53.4 ignora wasmBinary: se instancia a mano (M0).
          instantiateWasm(imports, listo) {
            WebAssembly.instantiate(wasm, imports).then((r) => listo(r.instance, r.module), rechazar);
            return {};
          },
        }).then(resolver, rechazar);
      }),
    });
    ambito.onmessage = (ev) => nucleo.recibir(ev.data);
    ambito.addEventListener('error', (ev) => {
      nucleo.estado = 'fallido';
      ambito.postMessage({ tipo: 'fatal', codigo: 'WORKER_DETENIDO', causa: ev && ev.message ? ev.message : 'error sin detalle' });
    });
    ambito.addEventListener('unhandledrejection', (ev) => {
      console.error('2REP_Standalone: promesa rechazada sin atender en el worker', ev && ev.reason);
    });
    return nucleo;
  }

  /** Últimos mensajes de printErr de sqlite3.js (diagnóstico; op «estado» → avisos_sqlite). */
  const AVISOS_SQLITE = [];
  function avisoSqlite(partes) {
    AVISOS_SQLITE.push(partes.map((x) => String(x)).join(' ').slice(0, 500));
    if (AVISOS_SQLITE.length > 20) AVISOS_SQLITE.shift();
  }

  R2.principal = { AVISOS_SQLITE, VERSION_PROTOCOLO, MSG_PROXIMA, MSG_NO_LISTO, ErrorHttp, crearNucleo, instalar, plano, isoLocal };

  if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope && !globalThis.R2_PRINCIPAL_MANUAL) {
    R2.principal.nucleo = instalar(self);
  }
})(globalThis.R2 = globalThis.R2 || {});

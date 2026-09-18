






















































(function (R2) {
  'use strict';

  const BD = 'diarios-explorer';
  const ALMACEN = 'bibliotecas';
  const VERSION_BD = 1;
  const CLAVE = 'v1:biblioteca';
  const CLAVE_SONDEO = 'v1:sondeo';
  const PREFIJO_LS = 'diarios-explorer:v1:';
  const CLAVE_REVISION = 'diarios-explorer:v1:revision';
  const SONDEO_MS = 2000;
  const EVENTO = 'r2:almacen';

  const TEXTOS = {
    navegador: 'Sus bibliotecas se guardan en este navegador. Expórtelas como .2replib para compartirlas o tener una copia aparte.',
    firefox: ' En Firefox dependen de dónde esté este archivo: si lo mueve o le cambia el nombre, no las encontrará.',
    memoria: 'Este navegador no permite guardar datos en una página abierta como archivo: sus bibliotecas solo durarán mientras la tenga abierta. Expórtelas con «Exportar todas» antes de cerrarla.',
    sinExportar: ' Hay cambios sin exportar.',
    soloLectura: 'Sus bibliotecas están abiertas en otra pestaña de Diarios Explorer. Aquí puede consultarlas, pero no cambiarlas. Pulse «Usar aquí» para editarlas en esta pestaña.',
    comprobando: 'Comprobando si este navegador puede guardar sus bibliotecas…',
    relevo: 'Otra pestaña de Diarios Explorer ha pulsado «Usar aquí»: esta termina de guardar lo pendiente y le cede sus bibliotecas.',
    danada: 'La copia de sus bibliotecas guardada en este navegador está dañada y no se puede abrir. No se ha borrado nada: puede descargarla para intentar recuperarla o descartarla y empezar con bibliotecas vacías. Hasta que decida, no se pueden cambiar.',
    danadaOtra: ' Para descartarla, pulse antes «Usar aquí».',
    conflicto: 'Otra pestaña de Diarios Explorer guardó sus bibliotecas a la vez que esta: se ha cargado la copia de esa pestaña y el último cambio hecho aquí no se ha guardado. Repítalo si hace falta.',
    cuota: 'Este navegador no tiene espacio para guardar sus bibliotecas. Expórtelas con «Exportar todas» para no perder los cambios.',
  };


  const MOTIVOS = Object.freeze({
    AbortError: 'el navegador interrumpió la operación',
    QuotaExceededError: 'no queda espacio',
    SecurityError: 'el navegador no lo permite',
    NotAllowedError: 'el navegador no lo permite',
    InvalidStateError: 'el almacén del navegador no está disponible en este momento',
    NotFoundError: 'no se encontró el almacén del navegador',
    UnknownError: 'error interno del navegador',
    VersionError: 'otra versión de esta página tiene el almacén abierto',
    DataError: 'los datos no se pudieron preparar para guardarlos',
    DataCloneError: 'los datos no se pudieron preparar para guardarlos',
    TimeoutError: 'el navegador no respondió a tiempo',
    ReadOnlyError: 'el almacén está en solo lectura',
    TransactionInactiveError: 'la operación llegó tarde',
    DatabaseError: 'la copia no es una base de bibliotecas válida',
  });

  const ahoraIso = () => new Date().toISOString();

  const textoTecnico = (e) => (e && e.name && e.message ? `${e.name}: ${e.message}` : String(e && e.message ? e.message : e));
  const errorPropio = (mensaje, nombre) => Object.assign(new Error(mensaje), { propio: true, name: nombre || 'Error' });


  function motivo(e) {
    if (e && e.name && MOTIVOS[e.name]) return MOTIVOS[e.name];
    if (e && e.code === 22) return MOTIVOS.QuotaExceededError;
    if (e && (e.propio || typeof e.status === 'number') && e.message) return e.message;
    return 'error interno del navegador';
  }

  function conTiempo(promesa, ms, que) {
    let t;
    return Promise.race([
      promesa,
      new Promise((_, rechazar) => { t = setTimeout(() => rechazar(errorPropio(`${que}: sin respuesta en ${ms} ms`, 'TimeoutError')), ms); }),
    ]).finally(() => clearTimeout(t));
  }

  const peticion = (req) => new Promise((resolver, rechazar) => {
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rechazar(req.error || errorPropio('la petición al almacén falló'));
  });

  const transaccion = (tx) => new Promise((resolver, rechazar) => {
    tx.oncomplete = () => resolver();
    tx.onerror = () => rechazar(tx.error || errorPropio('la transacción del almacén falló'));
    tx.onabort = () => rechazar(tx.error || errorPropio('la transacción del almacén se interrumpió', 'AbortError'));
  });

  function iguales(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  const aU8 = (b) => (b instanceof Uint8Array ? b : b instanceof ArrayBuffer ? new Uint8Array(b) : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : null);

  function base64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function desdeBase64(t) {
    const bin = atob(t);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }


  function registroValido(r) {
    if (!r || typeof r !== 'object') return null;
    const bytes = aU8(r.bytes);
    if (!bytes || !bytes.length) return null;
    return { formato: 'sqlite', bytes, revision: Number(r.revision) || 0, exportada: Number(r.exportada) || 0, guardado_en: typeof r.guardado_en === 'string' ? r.guardado_en : null };
  }

  const revisionDe = (r) => (r ? r.revision : 0);
  const plano = (r) => ({ formato: 'sqlite', bytes: r.bytes, revision: r.revision, exportada: r.exportada, guardado_en: r.guardado_en });


  function almacenIndexedDB(g, tiempoMs) {
    let db = null;
    const idb = () => {
      const f = g.indexedDB;
      if (!f || typeof f.open !== 'function') throw errorPropio('IndexedDB no está disponible', 'NotFoundError');
      return f;
    };
    async function abrir() {
      if (db) return db;
      const req = idb().open(BD, VERSION_BD);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(ALMACEN)) d.createObjectStore(ALMACEN);
      };
      db = await conTiempo(peticion(req), tiempoMs, 'IndexedDB');
      db.onversionchange = () => { try { db.close(); } catch (e) {   } db = null; };
      return db;
    }




    async function operar(modo, fn) {
      const d = await abrir();
      const tx = d.transaction(ALMACEN, modo);
      const fin = transaccion(tx);
      fin.catch(() => {   });
      const valor = await fn(tx.objectStore(ALMACEN));
      await conTiempo(fin, tiempoMs, 'IndexedDB');
      return valor;
    }
    return {
      tipo: 'indexeddb', persistente: true,
      async probar() {
        const muestra = { n: Math.random(), bytes: new Uint8Array([2, 0, 2, 6]) };
        await operar('readwrite', (s) => peticion(s.put(muestra, CLAVE_SONDEO)));
        const leido = await operar('readonly', (s) => peticion(s.get(CLAVE_SONDEO)));
        await operar('readwrite', (s) => peticion(s.delete(CLAVE_SONDEO)));
        if (!leido || leido.n !== muestra.n || !iguales(aU8(leido.bytes), muestra.bytes)) throw errorPropio('IndexedDB no devuelve lo que se escribió');
        return true;
      },
      async leer() { return registroValido(await operar('readonly', (s) => peticion(s.get(CLAVE)))); },
      async guardar(r) { await operar('readwrite', (s) => peticion(s.put(plano(r), CLAVE))); },

      async guardarSi(r, esperada) {
        return operar('readwrite', async (s) => {
          const actual = registroValido(await peticion(s.get(CLAVE)));
          if (revisionDe(actual) !== esperada) return false;
          await peticion(s.put(plano(r), CLAVE));
          return true;
        });
      },
      cerrar() { if (db) { try { db.close(); } catch (e) {   } db = null; } },
    };
  }

  function almacenLocalStorage(g) {
    const s = () => {
      const x = g.localStorage;
      if (!x) throw errorPropio('localStorage no está disponible', 'NotFoundError');
      return x;
    };
    const api = {
      tipo: 'localstorage', persistente: true,
      async probar() {
        const k = PREFIJO_LS + 'sondeo', v = String(Math.random());
        s().setItem(k, v);
        const leido = s().getItem(k);
        s().removeItem(k);
        if (leido !== v) throw errorPropio('localStorage no devuelve lo que se escribió');
        return true;
      },
      async leer() {
        const t = s().getItem(PREFIJO_LS + 'biblioteca');
        if (!t) return null;
        try {
          const r = JSON.parse(t);
          return registroValido(Object.assign({}, r, { bytes: typeof r.bytes === 'string' ? desdeBase64(r.bytes) : null }));
        } catch (e) {
          return null;
        }
      },
      async guardar(r) {
        s().setItem(PREFIJO_LS + 'biblioteca', JSON.stringify({ formato: 'sqlite', bytes: base64(r.bytes), revision: r.revision, exportada: r.exportada, guardado_en: r.guardado_en }));
      },

      async guardarSi(r, esperada) {
        if (revisionDe(await api.leer()) !== esperada) return false;
        await api.guardar(r);
        return true;
      },
      cerrar() {},
    };
    return api;
  }

  function almacenMemoria() {
    let r = null;
    return {
      tipo: 'memoria', persistente: false,
      async probar() { return true; },
      async leer() { return r; },
      async guardar(x) { r = x; },
      async guardarSi(x, esperada) {
        if (revisionDe(r) !== esperada) return false;
        r = x;
        return true;
      },
      cerrar() {},
    };
  }

  function crearAlmacen(tipo, opciones = {}) {
    const g = opciones.ventana || globalThis;
    const tiempoMs = opciones.tiempoMs || 2500;
    if (tipo === 'indexeddb') return almacenIndexedDB(g, tiempoMs);
    if (tipo === 'localstorage') return almacenLocalStorage(g);
    return almacenMemoria();
  }


  async function detectar(opciones = {}) {
    const intentos = [];
    for (const tipo of ['indexeddb', 'localstorage']) {
      const a = crearAlmacen(tipo, opciones);
      try {
        await a.probar();
        a.intentos = intentos;
        return a;
      } catch (e) {
        intentos.push({ tipo, error: textoTecnico(e) });
        try { a.cerrar(); } catch (e2) {   }
      }
    }
    const m = almacenMemoria();
    m.intentos = intentos;
    return m;
  }


  function crearPersistencia(opciones = {}) {
    const g = opciones.ventana || globalThis;
    const doc = g.document || null;
    const S = {
      almacen: opciones.almacen || null, pestanas: opciones.pestanas || null, motor: null,
      copia: null, revGuardada: 0, soloLectura: false, cediendo: false, danada: null, error: null, detalle: null,
      guardando: null, pendiente: false, iniciada: false, restaurando: 0, recargando: false,
      recargas: 0, guardados: 0, ultimoGuardado: null, detectado: false, cambios: 0, esperasCambios: [], sondeo: null,
    };

    const esFirefoxLocal = () => {
      const ua = g.navigator && g.navigator.userAgent ? g.navigator.userAgent : '';
      return /Firefox\/\d/.test(ua) && g.location && g.location.protocol === 'file:';
    };
    const cambiosSinExportar = () => !!S.copia && S.copia.revision > S.copia.exportada;

    function estado() {
      const tipo = S.detectado && S.almacen ? S.almacen.tipo : 'comprobando';
      return {
        tipo,
        persistente: !!(S.almacen && S.almacen.persistente && S.detectado),
        solo_lectura: S.soloLectura || S.cediendo || !!S.danada,
        otra_pestana: S.soloLectura,
        cediendo: S.cediendo,
        copia_danada: !!S.danada,
        modo_pestanas: S.pestanas ? S.pestanas.modo : null,
        cambios_sin_exportar: cambiosSinExportar(),
        revision: S.copia ? S.copia.revision : 0,
        guardado_en: S.ultimoGuardado || (S.copia ? S.copia.guardado_en : null),
        guardando: !!S.guardando || S.pendiente,
        cambios_en_curso: S.cambios,
        error: S.error || (S.danada ? TEXTOS.danada : null),
        detalle: S.detalle,
        recargas: S.recargas,
        intentos: S.almacen && S.almacen.intentos ? S.almacen.intentos : [],
        aviso: aviso(),
      };
    }

    function aviso() {
      if (!S.detectado || !S.almacen) return { tipo: 'comprobando', texto: TEXTOS.comprobando, acciones: [] };
      if (S.danada) {
        return { tipo: 'copia_danada', texto: TEXTOS.danada + (S.soloLectura ? TEXTOS.danadaOtra : ''),
          acciones: S.soloLectura ? ['descargar_danada', 'usar_aqui'] : ['descargar_danada', 'descartar_danada'] };
      }
      if (S.error) return { tipo: 'error', texto: S.error, acciones: ['exportar_todas'] };
      if (S.cediendo) return { tipo: 'relevo', texto: TEXTOS.relevo, acciones: [] };
      if (S.soloLectura) return { tipo: 'solo_lectura', texto: TEXTOS.soloLectura, acciones: ['usar_aqui'] };
      if (!S.almacen.persistente) {
        return { tipo: 'memoria', texto: TEXTOS.memoria + (cambiosSinExportar() ? TEXTOS.sinExportar : ''), acciones: ['exportar_todas'] };
      }
      return { tipo: 'navegador', texto: TEXTOS.navegador + (esFirefoxLocal() ? TEXTOS.firefox : ''), acciones: [] };
    }

    function emitir(extra) {
      const e = Object.assign(estado(), extra || {});
      if (typeof opciones.alEstado === 'function') {
        try { opciones.alEstado(e); } catch (err) {   }
      }
      if (doc && typeof doc.dispatchEvent === 'function' && typeof g.CustomEvent === 'function') {
        try { doc.dispatchEvent(new g.CustomEvent(EVENTO, { detail: e })); } catch (err) {   }
      }
    }

    function fallo(texto, e) {
      S.error = texto;
      S.detalle = e === undefined ? null : textoTecnico(e);
    }

    async function iniciar() {
      if (S.iniciada) return estado();
      S.iniciada = true;
      if (!S.almacen) S.almacen = await detectar({ ventana: g, tiempoMs: opciones.tiempoMs });
      S.detectado = true;
      try {
        S.copia = await S.almacen.leer();
        S.revGuardada = revisionDe(S.copia);
      } catch (e) {
        fallo(`No se pudo leer la copia de sus bibliotecas guardada en este navegador (${motivo(e)}).`, e);
      }
      if (S.almacen.persistente) {
        if (!S.pestanas && R2.pestanas) S.pestanas = R2.pestanas.crear(Object.assign({ ventana: g }, opciones.opcionesPestanas || {}));
        if (S.pestanas) {
          const prop = await S.pestanas.iniciar();
          S.soloLectura = !prop;

          S.pestanas.alCambiar((p) => { alCambiarPropiedad(p); });
          S.pestanas.alMensaje((m) => { alMensaje(m); });
          if (typeof S.pestanas.alPedirRelevo === 'function') S.pestanas.alPedirRelevo(prepararRelevo);
          if (typeof S.pestanas.alRelevoCancelado === 'function') S.pestanas.alRelevoCancelado(relevoCancelado);
          if (S.pestanas.esPropietaria !== prop) alCambiarPropiedad(S.pestanas.esPropietaria);
        }
      }
      if (typeof g.addEventListener === 'function') {
        g.addEventListener('beforeunload', alDescargar);
        g.addEventListener('pagehide', () => { if (S.pestanas) S.pestanas.soltar(); });
      }
      if (S.almacen.persistente && S.pestanas) S.sondeo = setInterval(sondearRevision, opciones.sondeoMs || SONDEO_MS);
      emitir();
      return estado();
    }






    function sondearRevision() {
      if (!S.soloLectura || !S.motor || S.restaurando) return;
      const r = leerRevision();
      if (r !== null && r > (S.copia ? S.copia.revision : 0)) alMensaje({ tipo: 'guardado', revision: r });
    }

    function leerRevision() {
      try {
        const v = g.localStorage ? Number(g.localStorage.getItem(CLAVE_REVISION)) : NaN;
        return Number.isFinite(v) && v > 0 ? v : null;
      } catch (e) {
        return null;
      }
    }

    function anotarRevision(n) {
      try { if (g.localStorage) g.localStorage.setItem(CLAVE_REVISION, String(n)); } catch (e) {   }
    }


    function aplicarModo() {
      if (!S.motor) return Promise.resolve();
      const m = S.danada ? 'copia_danada' : S.soloLectura ? 'otra_pestana' : S.cediendo ? 'relevo' : null;
      return Promise.resolve(S.motor.modo(!!m, m));
    }






    async function restaurarEnMotor() {
      const motor = S.motor;
      if (!motor) return;
      S.restaurando++;
      try {
        try {
          await motor.restaurar(S.copia ? S.copia.bytes : null);
          S.danada = null;
        } catch (e) {
          S.danada = { bytes: S.copia ? S.copia.bytes : null, revision: revisionDe(S.copia) };
          S.detalle = textoTecnico(e);
          await motor.restaurar(null);
        }
        await aplicarModo();
      } finally {
        S.restaurando--;
      }
    }

    async function conectar(motor) {
      if (!S.iniciada) await iniciar();
      S.motor = motor;
      await restaurarEnMotor();
      emitir();
    }

    async function alCambiarPropiedad(prop) {
      if (prop === !S.soloLectura) return;
      if (prop) {
        try {
          const r = await S.almacen.leer();
          if (r) S.copia = r;
          S.revGuardada = revisionDe(r);
        } catch (e) {   }
        S.soloLectura = false;
        S.cediendo = false;
        S.error = null;
        await restaurarEnMotor().catch(() => {});
        emitir({ recargada: true });
      } else {
        const pendiente = !!(S.guardando || S.pendiente || S.cambios > 0);
        S.soloLectura = true;
        S.cediendo = false;
        if (S.motor) await aplicarModo().catch(() => {});
        emitir();

        if (pendiente) await guardarTardio();
      }
    }


    async function prepararRelevo(sigue) {
      if (S.soloLectura) return;
      S.cediendo = true;
      emitir();
      await aplicarModo().catch(() => {});
      if (sigue) sigue();
      await esperarCambios();
      if (sigue) sigue();
      await esperar();
    }

    function relevoCancelado() {
      if (!S.cediendo || S.soloLectura) return;
      S.cediendo = false;
      aplicarModo().catch(() => {});
      emitir();
    }

    async function alMensaje(m) {
      if (!m || m.tipo !== 'guardado' || S.recargando) return;

      if (!S.soloLectura && (S.guardando || S.pendiente || S.cambios > 0 || S.cediendo)) return;
      S.recargando = true;
      try {
        const r = await S.almacen.leer();
        if (!r || (S.copia && r.revision <= S.copia.revision && iguales(r.bytes, S.copia.bytes))) return;
        if (!S.soloLectura && r.revision <= S.revGuardada) return;
        S.copia = r;
        S.revGuardada = r.revision;
        await restaurarEnMotor();
        S.recargas++;
        if (S.error === TEXTOS.conflicto) S.error = null;
        emitir({ recargada: true });
      } catch (e) {
        fallo(`No se pudo leer el cambio hecho en otra pestaña (${motivo(e)}).`, e);
        emitir();
      } finally {
        S.recargando = false;
      }
    }

    function empiezaCambio() {
      S.cambios++;
      let hecho = false;
      return () => {
        if (hecho) return;
        hecho = true;
        S.cambios--;
        if (S.cambios === 0) for (const f of S.esperasCambios.splice(0)) f();
      };
    }

    function esperarCambios() {
      return S.cambios === 0 ? Promise.resolve() : new Promise((r) => S.esperasCambios.push(r));
    }

    function notificar() {
      if (S.soloLectura || S.danada || S.restaurando || !S.motor) return;
      S.pendiente = true;
      if (!S.guardando) S.guardando = volcar();
    }

    const nuevoRegistro = (bytes) => ({
      formato: 'sqlite', bytes, revision: Math.max(S.revGuardada, revisionDe(S.copia)) + 1,
      exportada: S.copia ? S.copia.exportada : 0, guardado_en: ahoraIso(),
    });

    function confirmarGuardado(reg) {
      S.copia = reg;
      S.revGuardada = reg.revision;
      S.error = null;
      S.detalle = null;
      S.guardados++;
      S.ultimoGuardado = reg.guardado_en;
      if (S.pestanas) {
        anotarRevision(reg.revision);
        S.pestanas.avisar({ tipo: 'guardado', revision: reg.revision });
      }
    }


    async function recargarPorConflicto() {
      try {
        const r = await S.almacen.leer();
        S.copia = r;
        S.revGuardada = revisionDe(r);
      } catch (e) {
        fallo(`No se pudo leer la copia de sus bibliotecas guardada por otra pestaña (${motivo(e)}).`, e);
        emitir();
        return;
      }
      await restaurarEnMotor().catch(() => {});
      S.error = TEXTOS.conflicto;
      S.detalle = null;
      S.recargas++;
      emitir({ recargada: true });
    }


    async function guardarUna(tardio) {
      let r;
      try {
        r = await S.motor.volcar();
      } catch (e) {
        fallo(`No se pudieron leer sus bibliotecas para guardarlas (${motivo(e)}). Expórtelas para no perder los cambios.`, e);
        emitir();
        return 'fallo';
      }
      const bytes = aU8(r && r.bytes);
      if (!bytes || (S.copia && iguales(S.copia.bytes, bytes))) return 'igual';
      const reg = nuevoRegistro(bytes);
      if (!S.almacen.persistente) {
        if (tardio) return 'igual';
        S.copia = reg;
        emitir();
        return 'ok';
      }
      let ok;
      try {
        ok = await S.almacen.guardarSi(reg, S.revGuardada);
      } catch (e) {
        if (!tardio) S.copia = reg;
        const cuota = e && (e.name === 'QuotaExceededError' || e.code === 22);
        fallo(cuota ? TEXTOS.cuota : `No se pudo guardar el último cambio en este navegador (${motivo(e)}). Exporte sus bibliotecas para no perderlo.`, e);
        emitir();
        return 'fallo';
      }
      if (ok) {
        confirmarGuardado(reg);
        emitir();
        return 'ok';
      }
      await recargarPorConflicto();
      return 'conflicto';
    }

    async function volcar() {
      try {
        while (S.pendiente) {
          S.pendiente = false;
          const r = await guardarUna(false);
          if (r === 'fallo' && S.error && S.detalle === null) break;
          if (r === 'conflicto') { S.pendiente = false; break; }
        }
      } finally {
        S.guardando = null;
      }
    }

    async function guardarTardio() {
      await esperarCambios();
      await esperar();
      if (!S.motor || S.danada) return;
      await guardarUna(true);
    }

    async function esperar() {
      while (S.guardando) await S.guardando;
    }

    async function marcarExportado() {
      await esperar();
      if (!S.copia) return;
      S.copia = Object.assign({}, S.copia, { exportada: S.copia.revision });
      if (S.almacen.persistente && !S.soloLectura && !S.danada) {
        try {
          if (await S.almacen.guardarSi(S.copia, S.revGuardada)) S.revGuardada = S.copia.revision;
        } catch (e) {   }
      }
      emitir();
    }

    async function usarAqui() {
      if (!S.pestanas) return true;
      await S.pestanas.tomar();
      return true;
    }

    function copiaDanada() {
      return S.danada && S.danada.bytes ? S.danada.bytes : null;
    }





    async function descartarCopiaDanada() {
      if (!S.danada) return true;
      if (S.soloLectura) return false;
      S.danada = null;
      S.detalle = null;
      if (S.motor) {
        await S.motor.restaurar(null);
        await aplicarModo();
      }
      S.pendiente = true;
      if (!S.guardando) S.guardando = volcar();
      await esperar();
      S.recargas++;
      emitir({ recargada: true });
      return true;
    }

    function alDescargar(ev) {
      const sinPersistir = !S.almacen || !S.almacen.persistente || !!S.error;
      if (!(S.guardando || S.pendiente || S.cambios > 0 || (sinPersistir && cambiosSinExportar()))) return undefined;
      ev.preventDefault();
      ev.returnValue = '';
      return '';
    }

    function soltar() {
      if (S.sondeo) { clearInterval(S.sondeo); S.sondeo = null; }
      if (S.pestanas) S.pestanas.soltar();
      if (typeof g.removeEventListener === 'function') g.removeEventListener('beforeunload', alDescargar);
      if (S.almacen) S.almacen.cerrar();
    }

    return { iniciar, conectar, notificar, marcarExportado, usarAqui, esperar, esperarCambios, empiezaCambio, copiaDanada,
      descartarCopiaDanada, estado, aviso, soltar, alDescargar, get copia() { return S.copia; } };
  }

  R2.almacen = { BD, ALMACEN, CLAVE, PREFIJO_LS, EVENTO, TEXTOS, MOTIVOS, motivo, detectar, crearAlmacen, crearPersistencia, base64, desdeBase64 };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/persistencia/almacen.js

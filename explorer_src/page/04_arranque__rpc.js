


























(function (R2) {
  'use strict';

  const VERSION_PROTOCOLO = 1;
  const NAVEGADORES = 'Chrome, Edge, Firefox o Safari en una versión reciente';

  const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cita = (s, max = 200) => { const t = String(s); return t.length > max ? `${t.slice(0, max)}…` : t; };


  const MENSAJES = {
    NAVEGADOR: (d) => `Este navegador no puede abrir el explorador: le falta ${(d.faltan || []).join(', ') || 'una función necesaria'}. Use ${NAVEGADORES}.`,
    RECURSO_DANADO: (d) => `Esta página está incompleta o dañada${d.causa ? ` (${cita(d.causa)})` : ''}. Descargue de nuevo el archivo HTML del explorador.`,
    WORKER_NO_ARRANCA: (d) => `No se pudo poner en marcha el motor de la página${d.causa ? ` (${cita(d.causa)})` : ''}. Recargue la página; si vuelve a pasar, use ${NAVEGADORES}.`,
    WASM_NO_ARRANCA: (d) => `No se pudo iniciar SQLite en este navegador${d.causa ? ` (${cita(d.causa)})` : ''}. Recargue la página; si vuelve a pasar, use ${NAVEGADORES}.`,
    WORKER_DETENIDO: (d) => `El motor se detuvo de forma inesperada${d.causa ? ` (${cita(d.causa)})` : ''}. Suele deberse a falta de memoria: cierre otras pestañas o aplicaciones y vuelva a intentarlo.`,
    CANCELADO: () => 'Se canceló la construcción del corpus.',
    PETICION_CANCELADA: () => 'Se canceló la petición.',
    ESTADO: (d) => `Error interno de la página: ${cita(d.causa || 'orden fuera de lugar')}.`,
    PROTOCOLO: (d) => `Error interno de la página: ${cita(d.causa || 'mensaje desconocido')}.`,
  };





  const REINTENTABLES = new Set(['MEMORIA', 'ERROR_INTERNO', 'WORKER_DETENIDO', 'WORKER_NO_ARRANCA',
    'WASM_NO_ARRANCA', 'CANCELADO', 'ESTADO', 'PROTOCOLO']);

  const CAMPOS = ['fila', 'linea', 'byte', 'columna', 'valor', 'detalle', 'causa'];

  class ErrorRpc extends Error {




    constructor(codigo, datos) {
      const d = Object.assign({}, datos);
      const plantilla = MENSAJES[codigo];
      super(d.mensaje != null ? String(d.mensaje) : plantilla ? plantilla(d) : `Error ${codigo}`);
      this.name = codigo === 'PETICION_CANCELADA' ? 'AbortError' : 'ErrorRpc';
      this.codigo = codigo;
      for (const k of CAMPOS) this[k] = d[k] != null ? d[k] : null;
      if (d.faltan) this.faltan = d.faltan.slice();
    }

    get reintentable() { return REINTENTABLES.has(this.codigo); }

    aObjeto() {
      const o = { codigo: this.codigo, mensaje: this.message };
      for (const k of CAMPOS) o[k] = this[k];
      return o;
    }
  }


  function errorDe(obj) {
    if (obj instanceof ErrorRpc) return obj;
    if (!obj || typeof obj !== 'object') return new ErrorRpc('PROTOCOLO', { causa: `fallo sin datos: ${String(obj)}` });
    return new ErrorRpc(obj.codigo || 'ERROR_INTERNO', obj);
  }


  function ubicacion(error) {
    if (!error) return '';
    const partes = [];
    if (error.fila != null) partes.push(`fila ${miles(error.fila)}`);
    if (error.linea != null) partes.push(`línea ${miles(error.linea)}`);
    if (error.byte != null) partes.push(`byte ${miles(error.byte)}`);
    if (error.columna != null) partes.push(`columna «${error.columna}»`);
    return partes.join(' · ');
  }

  function errorAbortado(signal) {
    if (signal && signal.reason !== undefined) return signal.reason;
    if (typeof DOMException === 'function') return new DOMException(MENSAJES.PETICION_CANCELADA(), 'AbortError');
    return new ErrorRpc('PETICION_CANCELADA');
  }

  const textoDe = (e) => (e && e.name && e.message ? `${e.name}: ${e.message}` : String(e && e.message ? e.message : e));

  function crearCliente(opciones) {
    const op = Object.assign({ tiempoArranqueMs: 30000, alEvento: () => {} }, opciones);
    if (typeof op.crearWorker !== 'function') throw new TypeError('rpc: falta crearWorker()');

    const c = {
      estado: 'nuevo', hola: null, informe: null, archivo: null, modoLectura: 'worker', error: null, lecturasPrincipal: 0,
    };
    const pendientes = new Map();
    let nId = 0;
    let espHola = null, espListo = null, temporizador = null;
    let worker = null, errorCreacion = null;

    const emitir = (tipo, datos) => { try { op.alEvento(tipo, datos, c); } catch (e) { setTimeout(() => { throw e; }, 0); } };

    function espera() {
      let resolver, rechazar;
      const promesa = new Promise((a, b) => { resolver = a; rechazar = b; });
      promesa.catch(() => {});
      return { promesa, resolver, rechazar };
    }

    try {
      worker = op.crearWorker();
      worker.onmessage = (ev) => recibir(ev.data);
      worker.onerror = (ev) => {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        const causa = ev && ev.message ? ev.message : 'sin detalle';
        caer(new ErrorRpc(c.estado === 'iniciando' || c.estado === 'nuevo' ? 'WORKER_NO_ARRANCA' : 'WORKER_DETENIDO', { causa }));
      };
      worker.onmessageerror = () => caer(new ErrorRpc('PROTOCOLO', { causa: 'mensaje del worker que no se pudo leer' }));
    } catch (e) {
      errorCreacion = new ErrorRpc('WORKER_NO_ARRANCA', { causa: textoDe(e) });
      c.estado = 'fallido';
      c.error = errorCreacion;
    }

    function enviar(m, transferibles) {
      if (!worker || c.estado === 'terminado') return false;
      try {
        worker.postMessage(m, transferibles || []);
        return true;
      } catch (e) {
        caer(new ErrorRpc('PROTOCOLO', { causa: `no se pudo enviar «${m.tipo}»: ${textoDe(e)}` }));
        return false;
      }
    }


    function rechazarTodo(err) {
      if (temporizador) { clearTimeout(temporizador); temporizador = null; }
      if (espHola) { espHola.rechazar(err); espHola = null; }
      if (espListo) { espListo.rechazar(err); espListo = null; }
      for (const [id, p] of pendientes) {
        pendientes.delete(id);
        p.limpiar();
        p.rechazar(err);
      }
    }


    function caer(err) {
      if (c.estado === 'terminado' || c.estado === 'fallido') return;
      c.estado = 'fallido';
      c.error = err;
      try { worker.terminate(); } catch (e) {   }
      rechazarTodo(err);
      emitir('fatal', err);
    }

    async function leerParaWorker(m) {
      c.lecturasPrincipal++;
      if (!c.archivo) {
        enviar({ tipo: 'trozo', id: m.id, error: { name: 'NotFoundError', message: 'no hay archivo en el hilo principal' } });
        return;
      }
      try {
        const buf = await c.archivo.slice(m.off, m.off + m.len).arrayBuffer();
        enviar({ tipo: 'trozo', id: m.id, buf }, [buf]);
      } catch (e) {
        enviar({ tipo: 'trozo', id: m.id, error: { name: (e && e.name) || 'Error', message: (e && e.message) || String(e) } });
      }
    }

    function recibir(m) {
      if (c.estado === 'terminado' || !m || typeof m !== 'object') return;
      switch (m.tipo) {
        case 'hola':
          if (temporizador) { clearTimeout(temporizador); temporizador = null; }
          if (m.v !== VERSION_PROTOCOLO) {
            caer(new ErrorRpc('PROTOCOLO', { causa: `versión del protocolo ${m.v}; se esperaba ${VERSION_PROTOCOLO}` }));
            return;
          }
          c.hola = m;
          if (c.estado === 'iniciando') c.estado = 'preparado';
          if (espHola) { espHola.resolver(m); espHola = null; }
          emitir('hola', m);
          break;
        case 'progreso':
          emitir('progreso', m.ev);
          break;
        case 'progreso_base':
          emitir('progreso_base', { hecho: m.hecho, total: m.total });
          break;
        case 'progreso_op': {
          // Avance de una petición larga (léxico): va a la función alProgreso de esa petición, si la dio.
          const p = pendientes.get(m.id);
          if (p && typeof p.alProgreso === 'function') { try { p.alProgreso(m.ev); } catch (e) { /* nunca rompe la petición */ } }
          break;
        }
        case 'modo_lectura':
          c.modoLectura = m.modo;
          emitir('modo_lectura', m);
          break;
        case 'leer':
          leerParaWorker(m);
          break;
        case 'listo':
          c.estado = 'listo';
          c.informe = m.informe;
          if (m.modo_lectura) c.modoLectura = m.modo_lectura;
          if (espListo) { espListo.resolver({ informe: m.informe, ms: m.ms, modo_lectura: c.modoLectura }); espListo = null; }
          emitir('listo', m);
          break;
        case 'huella':
          c.informe = m.informe;
          emitir('huella', m);
          break;
        case 'fallo_huella':
          emitir('fallo_huella', errorDe(m.error));
          break;
        case 'fallo_construccion': {
          const err = errorDe(m.error);
          c.estado = 'fallido';
          c.error = err;
          if (espListo) { espListo.rechazar(err); espListo = null; }
          emitir('fallo_construccion', err);
          break;
        }
        case 'resp': {
          const p = pendientes.get(m.id);
          if (!p) break;
          pendientes.delete(m.id);
          p.limpiar();
          if (m.cancelada) p.rechazar(new ErrorRpc('PETICION_CANCELADA', { detalle: { motivo: m.motivo || null } }));
          else p.resolver({ status: m.status, cuerpo: m.cuerpo, tipo: m.tipoCuerpo || 'json', cabeceras: m.cabeceras || {}, ms: m.ms });
          break;
        }
        case 'fatal':
          caer(new ErrorRpc(m.codigo || 'WORKER_DETENIDO', m.mensaje != null ? { mensaje: m.mensaje, causa: m.causa } : { causa: m.causa }));
          break;
        default:
          caer(new ErrorRpc('PROTOCOLO', { causa: `mensaje desconocido del worker: ${String(m.tipo)}` }));
      }
    }

    c.iniciar = (wasm) => {
      if (errorCreacion) return Promise.reject(errorCreacion);
      if (c.estado !== 'nuevo') return c.hola ? Promise.resolve(c.hola) : (espHola ? espHola.promesa : Promise.reject(c.error || new ErrorRpc('ESTADO', { causa: `iniciar en estado ${c.estado}` })));
      c.estado = 'iniciando';
      espHola = espera();
      const p = espHola.promesa;
      if (op.tiempoArranqueMs > 0) {
        temporizador = setTimeout(() => {
          temporizador = null;
          if (c.estado === 'iniciando') caer(new ErrorRpc('WORKER_NO_ARRANCA', { causa: `sin respuesta en ${Math.round(op.tiempoArranqueMs / 1000)} s` }));
        }, op.tiempoArranqueMs);
      }
      enviar({ tipo: 'iniciar', v: VERSION_PROTOCOLO, wasm });
      return p;
    };






    c.construir = (archivo, opcionesConstruir) => {
      if (errorCreacion) return Promise.reject(errorCreacion);
      if (c.estado === 'terminado' || c.estado === 'fallido') return Promise.reject(c.error || new ErrorRpc('ESTADO', { causa: `construir en estado ${c.estado}` }));
      if (c.estado !== 'iniciando' && c.estado !== 'preparado') {
        return Promise.reject(new ErrorRpc('ESTADO', { causa: `este motor ya construyó o está construyendo un corpus (${c.estado})` }));
      }
      c.estado = 'construyendo';
      c.archivo = archivo;
      espListo = espera();
      const p = espListo.promesa;
      const lectura = opcionesConstruir && opcionesConstruir.lectura === 'principal' ? 'principal' : 'auto';
      enviar({ tipo: 'construir', archivo, lectura });
      return p;
    };

    c.pedir = (opNombre, args, opcionesPeticion) => {
      const o = opcionesPeticion || {};
      if (o.signal && o.signal.aborted) return Promise.reject(errorAbortado(o.signal));
      if (errorCreacion) return Promise.reject(errorCreacion);
      if (c.estado === 'terminado' || c.estado === 'fallido') return Promise.reject(c.error || new ErrorRpc('WORKER_DETENIDO'));
      const id = ++nId;
      return new Promise((resolver, rechazar) => {
        let alAbortar = null;
        const limpiar = () => { if (alAbortar) o.signal.removeEventListener('abort', alAbortar); };
        if (o.signal) {
          alAbortar = () => {
            if (!pendientes.has(id)) return;
            pendientes.delete(id);
            limpiar();
            enviar({ tipo: 'cancelar', id });
            rechazar(errorAbortado(o.signal));
          };
          o.signal.addEventListener('abort', alAbortar, { once: true });
        }
        pendientes.set(id, { resolver, rechazar, limpiar, op: opNombre, alProgreso: typeof o.alProgreso === 'function' ? o.alProgreso : null });
        enviar({ tipo: 'pedir', id, op: opNombre, args: args === undefined ? null : args, canal: o.canal || null,
          prioridad: o.prioridad || null, presupuestoMs: o.presupuestoMs || null }, o.transferir || undefined);
      });
    };

    c.cancelar = (id) => {
      const p = pendientes.get(id);
      if (!p) return false;
      pendientes.delete(id);
      p.limpiar();
      enviar({ tipo: 'cancelar', id });
      p.rechazar(new ErrorRpc('PETICION_CANCELADA'));
      return true;
    };

    c.terminar = (codigo = 'CANCELADO') => {
      if (c.estado === 'terminado') return;
      const err = new ErrorRpc(codigo);
      c.estado = 'terminado';
      c.error = err;
      try { if (worker) worker.terminate(); } catch (e) {   }
      rechazarTodo(err);
    };

    Object.defineProperty(c, 'pendientes', { get: () => pendientes.size });
    return c;
  }

  R2.rpc = { VERSION_PROTOCOLO, MENSAJES, REINTENTABLES, ErrorRpc, errorDe, ubicacion, errorAbortado, crearCliente };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/rpc.js

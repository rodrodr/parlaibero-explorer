























(function (R2) {
  'use strict';

  const MSG_PROXIMA = 'Esta función llega en una próxima versión de Diarios Explorer.';
  const MSG_MOTOR = 'El motor de la página no está disponible.';
  const OP_API = 'api';

  const TEXTO_ESTADO = { 200: 'OK', 400: 'Bad Request', 404: 'Not Found', 405: 'Method Not Allowed', 422: 'Unprocessable Entity',
    500: 'Internal Server Error', 501: 'Not Implemented', 503: 'Service Unavailable' };

  function errorAbortado(signal) {
    if (signal && signal.reason !== undefined) return signal.reason;
    if (typeof DOMException === 'function') return new DOMException('Se canceló la petición.', 'AbortError');
    const e = new Error('Se canceló la petición.');
    e.name = 'AbortError';
    return e;
  }


  class CabecerasShim {
    constructor(obj) {
      this._m = new Map();
      if (obj) for (const k of Object.keys(obj)) this.set(k, obj[k]);
    }
    get(n) { const v = this._m.get(String(n).toLowerCase()); return v === undefined ? null : v; }
    has(n) { return this._m.has(String(n).toLowerCase()); }
    set(n, v) { this._m.set(String(n).toLowerCase(), String(v)); }
    forEach(cb, esto) { for (const [k, v] of this._m) cb.call(esto, v, k, this); }
    entries() { return this._m.entries(); }
    keys() { return this._m.keys(); }
    values() { return this._m.values(); }
    [Symbol.iterator]() { return this._m.entries(); }
  }

  const aBytes = (b) => {
    if (typeof b === 'string') return new TextEncoder().encode(b);
    if (b instanceof ArrayBuffer) return new Uint8Array(b);
    if (ArrayBuffer.isView(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return new Uint8Array(0);
  };


  class RespuestaShim {
    constructor(cuerpo, status, cabeceras) {
      this.status = status;
      this.statusText = TEXTO_ESTADO[status] || '';
      this.ok = status >= 200 && status < 300;
      this.headers = new CabecerasShim(cabeceras);
      this.url = '';
      this.redirected = false;
      this.type = 'basic';
      this.bodyUsed = false;
      this._cuerpo = cuerpo == null ? '' : cuerpo;
    }
    _consumir() {
      if (this.bodyUsed) return Promise.reject(new TypeError('El cuerpo de la respuesta ya se leyó.'));
      this.bodyUsed = true;
      return Promise.resolve(this._cuerpo);
    }
    async text() {
      const b = await this._consumir();
      if (typeof b === 'string') return b;
      if (typeof Blob === 'function' && b instanceof Blob) return b.text();
      return new TextDecoder().decode(aBytes(b));
    }
    async json() { return JSON.parse(await this.text()); }
    async arrayBuffer() {
      const b = await this._consumir();
      if (typeof Blob === 'function' && b instanceof Blob) return b.arrayBuffer();
      return aBytes(b).slice().buffer;
    }
    async blob() {
      const b = await this._consumir();

      const type = (this.headers.get('content-type') || '').split(';').map((p) => p.trim()).filter(Boolean)
        .map((p, i) => (i === 0 ? p.toLowerCase() : p.replace(/^([^=]+)=/, (_, k) => `${k.trim().toLowerCase()}=`))).join(';');
      return new Blob([typeof Blob === 'function' && b instanceof Blob ? b : typeof b === 'string' ? b : aBytes(b)], { type });
    }
    clone() {
      if (this.bodyUsed) throw new TypeError('No se puede clonar una respuesta cuyo cuerpo ya se leyó.');
      const cab = {};
      this.headers.forEach((v, k) => { cab[k] = v; });
      return new RespuestaShim(this._cuerpo, this.status, cab);
    }
  }


  function crearRespuesta(status, cuerpo, tipo, cabeceras, usarNativa) {
    const cab = {};
    let tieneTipo = false;
    for (const k of Object.keys(cabeceras || {})) {
      cab[k] = String(cabeceras[k]);
      if (k.toLowerCase() === 'content-type') tieneTipo = true;
    }
    let cuerpoFinal, tipoContenido;
    switch (tipo) {
      case 'json-texto': cuerpoFinal = String(cuerpo); tipoContenido = 'application/json'; break;
      case 'texto': cuerpoFinal = String(cuerpo); tipoContenido = 'text/plain; charset=utf-8'; break;
      case 'bytes': cuerpoFinal = cuerpo; tipoContenido = 'application/octet-stream'; break;
      default: cuerpoFinal = JSON.stringify(cuerpo === undefined ? null : cuerpo); tipoContenido = 'application/json';
    }
    if (!tieneTipo) cab['content-type'] = tipoContenido;
    if (usarNativa && typeof Response === 'function') {
      return new Response(cuerpoFinal, { status, statusText: TEXTO_ESTADO[status] || '', headers: cab });
    }
    return new RespuestaShim(cuerpoFinal, status, cab);
  }



  function rutaApi(urlTexto, base) {
    let ruta, busqueda = '';
    if (urlTexto.startsWith('/api/')) {
      const sinFragmento = urlTexto.split('#')[0];
      const i = sinFragmento.indexOf('?');
      ruta = i >= 0 ? sinFragmento.slice(0, i) : sinFragmento;
      busqueda = i >= 0 ? sinFragmento.slice(i) : '';
    } else {
      let u, b;
      try {
        b = new URL(base);
        u = new URL(urlTexto, b);
      } catch (e) {
        return null;
      }
      if (u.protocol !== b.protocol || u.host !== b.host || !u.pathname.startsWith('/api/')) return null;
      ruta = u.pathname;
      busqueda = u.search;
    }
    return { ruta: ruta.slice(4), busqueda };
  }

  function consulta(busqueda) {
    const q = {}, lista = [];
    const p = new URLSearchParams(busqueda);
    for (const [k, v] of p) {
      lista.push([k, v]);
      q[k] = v;
    }
    return { query: q, queryLista: lista };
  }


  function crear(opciones) {
    const op = Object.assign({ fetchNativo: null, base: 'http://localhost/', respuestaNativa: true }, opciones);
    const baseActual = () => (typeof op.base === 'function' ? op.base() : op.base) || 'http://localhost/';

    let motor = null;
    let caida = null;
    const retenidas = [];
    const est = { retenidas: 0, atendidas: 0, abortadas: 0, por_ruta: {} };

    const responder = (status, cuerpo, tipo, cabeceras) => crearRespuesta(status, cuerpo, tipo || 'json', cabeceras, op.respuestaNativa);


    async function atender(p) {
      if (p.signal && p.signal.aborted) throw errorAbortado(p.signal);
      if (caida) return responder(503, { error: caida.message || MSG_MOTOR });
      est.por_ruta[`${p.metodo} ${p.ruta}`] = (est.por_ruta[`${p.metodo} ${p.ruta}`] || 0) + 1;
      const args = { metodo: p.metodo, ruta: p.ruta, query: p.query, queryLista: p.queryLista, cuerpoTexto: p.cuerpoTexto };
      let alAbortar = null;
      const abortada = p.signal ? new Promise((_, rechazar) => {
        alAbortar = () => rechazar(errorAbortado(p.signal));
        p.signal.addEventListener('abort', alAbortar, { once: true });
      }) : null;
      try {
        const peticion = motor.pedir(OP_API, args, { signal: p.signal || undefined, canal: null, alProgreso: p.alProgreso || undefined });
        const r = await (abortada ? Promise.race([peticion, abortada]) : peticion);
        est.atendidas++;
        return responder(r.status || 200, r.cuerpo, r.tipo, r.cabeceras);
      } catch (e) {
        if (e && e.name === 'AbortError') { est.abortadas++; throw e; }
        if (p.signal && p.signal.aborted) { est.abortadas++; throw errorAbortado(p.signal); }
        return responder(503, { error: (e && e.message) || MSG_MOTOR });
      } finally {
        if (alAbortar) p.signal.removeEventListener('abort', alAbortar);
      }
    }

    function retener(p) {
      est.retenidas++;
      return new Promise((resolver, rechazar) => {
        const entrada = { p, resolver, rechazar, alAbortar: null };
        if (p.signal) {
          entrada.alAbortar = () => {
            const i = retenidas.indexOf(entrada);
            if (i >= 0) retenidas.splice(i, 1);
            est.abortadas++;
            rechazar(errorAbortado(p.signal));
          };
          p.signal.addEventListener('abort', entrada.alAbortar, { once: true });
        }
        retenidas.push(entrada);
      });
    }

    function soltar() {
      while (retenidas.length && (motor || caida)) {
        const e = retenidas.shift();
        if (e.alAbortar) e.p.signal.removeEventListener('abort', e.alAbortar);
        atender(e.p).then(e.resolver, e.rechazar);
      }
    }

    async function analizar(input, init) {
      const i = init || {};
      let urlTexto, metodo = 'GET', signal = null, cuerpoTexto = null, peticion = null;
      if (typeof input === 'string') urlTexto = input;
      else if (typeof URL === 'function' && input instanceof URL) urlTexto = input.href;
      else if (input && typeof input === 'object' && typeof input.url === 'string') {
        peticion = input;
        urlTexto = input.url;
        metodo = input.method || 'GET';
        signal = input.signal || null;
      } else return null;
      const r = rutaApi(urlTexto, baseActual());
      if (!r) return null;
      if (i.method) metodo = String(i.method);
      if (i.signal) signal = i.signal;
      metodo = metodo.toUpperCase();
      if (i.body != null) cuerpoTexto = typeof i.body === 'string' ? i.body : await new RespuestaShim(i.body, 200, {}).text();
      else if (peticion && metodo !== 'GET' && metodo !== 'HEAD' && typeof peticion.text === 'function') {
        cuerpoTexto = await peticion.clone().text();
      }
      // init.alProgreso (extensión de esta página): recibe los avisos de avance de una petición larga (progreso_op).
      const alProgreso = typeof i.alProgreso === 'function' ? i.alProgreso : null;
      return Object.assign({ metodo, signal, cuerpoTexto, alProgreso }, r, consulta(r.busqueda));
    }

    function fetchShim(input, init) {
      return (async () => {
        const esTexto = typeof input === 'string';

        if (esTexto && !input.startsWith('/api/') && (input.startsWith('/') || !input.includes('/api/'))) return nativo(input, init);
        const p = await analizar(input, init);
        if (!p) return nativo(input, init);
        if (p.signal && p.signal.aborted) { est.abortadas++; throw errorAbortado(p.signal); }
        if (!motor && !caida) return retener(p);
        return atender(p);
      })();
    }

    function nativo(input, init) {
      if (typeof op.fetchNativo !== 'function') return Promise.reject(new TypeError('fetch no está disponible.'));
      return op.fetchNativo(input, init);
    }

    return {
      fetch: fetchShim,
      liberar(m) {
        if (!m || typeof m.pedir !== 'function') throw new TypeError('apiShim.liberar: el motor necesita pedir()');
        motor = m;
        caida = null;
        soltar();
      },
      retener() { motor = null; caida = null; },
      fallar(error) {
        caida = error instanceof Error ? error : new Error(String(error || MSG_MOTOR));
        motor = null;
        soltar();
      },
      get retenidasAhora() { return retenidas.length; },
      get liberado() { return !!motor; },
      estadisticas() { return JSON.parse(JSON.stringify(est)); },
    };
  }

  function instalar(ventana) {
    if (ventana.__r2Shim) return ventana.__r2Shim;
    const fetchNativo = typeof ventana.fetch === 'function' ? ventana.fetch.bind(ventana) : null;
    const shim = crear({ fetchNativo, base: () => (ventana.location ? ventana.location.href : 'http://localhost/') });
    ventana.fetch = shim.fetch;
    Object.defineProperty(ventana, '__r2Shim', { value: shim, configurable: true });
    return shim;
  }

  R2.apiShim = { MSG_PROXIMA, OP_API, TEXTO_ESTADO, RespuestaShim, CabecerasShim, crearRespuesta, rutaApi, crear, instalar };

  if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof window.fetch === 'function' && !globalThis.R2_SHIM_MANUAL) {
    R2.apiShim.instalado = instalar(window);
  }
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/shim/api-shim.js

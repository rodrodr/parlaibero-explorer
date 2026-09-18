




































(function (R2) {
  'use strict';

  const NOMBRE = 'diarios-explorer:v1:propietario';
  const CANAL = 'diarios-explorer:v1';
  const CLAVE_AVISO = 'diarios-explorer:v1:aviso';
  const RELEVO_CADUCA_MS = 15000;

  function nuevoId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function crear(opciones = {}) {
    const g = opciones.ventana || globalThis;
    const nombre = opciones.nombre || NOMBRE;
    const latidoMs = opciones.latidoMs || 2000;
    const caducidadMs = opciones.caducidadMs || 6500;
    const sondeoMs = opciones.sondeoMs || 500;
    const relevoSinRespuestaMs = opciones.relevoSinRespuestaMs || 4000;
    const relevoMaximoMs = opciones.relevoMaximoMs || 60000;
    const relevoCancelarMs = opciones.relevoCancelarMs || 15000;
    const id = opciones.id || nuevoId();
    const oyentes = new Set();
    const oyentesMensaje = new Set();
    const esperasRelevo = new Map();
    const relevosAtendidos = new Set();
    let oyenteRelevo = null;
    let oyenteCancelado = null;
    let esPropietaria = false;
    let modo = null;
    let cerrada = false;
    let soltarCerrojo = null;
    let abortarEspera = null;
    let temporizador = null;
    let sondeo = null;
    let canal = null;
    let tomando = null;
    let ultimoAvisoLeido = null;

    const emitir = () => {
      for (const f of [...oyentes]) {
        try { f(esPropietaria); } catch (e) {   }
      }
    };
    const poner = (v) => {
      if (esPropietaria === v) return;
      esPropietaria = v;
      emitir();
    };

    const locks = () => (g.navigator && g.navigator.locks && typeof g.navigator.locks.request === 'function' ? g.navigator.locks : null);
    const ls = () => {
      try {
        const s = g.localStorage;
        if (!s) return null;
        const k = `${nombre}:prueba`;
        s.setItem(k, '1');
        s.removeItem(k);
        return s;
      } catch (e) {
        return null;
      }
    };

    const lsLectura = () => {
      try { return g.localStorage || null; } catch (e) { return null; }
    };






    function pedirCerrojo(tipo) {
      return new Promise((resolver) => {
        let concedido = false;
        const opcionesLock = { mode: 'exclusive' };
        let ctrl = null;
        if (tipo === 'si_libre') opcionesLock.ifAvailable = true;
        else if (tipo === 'robar') opcionesLock.steal = true;
        else if (typeof g.AbortController === 'function' || typeof AbortController === 'function') {
          ctrl = new (g.AbortController || AbortController)();
          opcionesLock.signal = ctrl.signal;
          abortarEspera = () => { try { ctrl.abort(); } catch (e) {   } };
        }
        let p;
        try {
          p = locks().request(nombre, opcionesLock, (lock) => {
            if (!lock) { resolver(false); return null; }
            concedido = true;
            if (tipo === 'esperar') abortarEspera = null;
            return new Promise((soltar) => {
              soltarCerrojo = soltar;
              poner(true);
              resolver(true);
            });
          });
        } catch (e) {
          resolver(false);
          return;
        }
        p.then(() => alPerder(concedido), () => { if (concedido) alPerder(true); else resolver(false); });
      });
    }


    function alPerder(concedido) {
      if (!concedido) return;
      soltarCerrojo = null;
      poner(false);
      if (!cerrada) pedirCerrojo('esperar');
    }


    function leerLatido(s) {
      try {
        const v = JSON.parse(s.getItem(nombre) || 'null');
        return v && typeof v.id === 'string' && typeof v.t === 'number' ? v : null;
      } catch (e) {
        return null;
      }
    }

    function escribirLatido(s) {
      try { s.setItem(nombre, JSON.stringify({ id, t: Date.now() })); } catch (e) {   }
    }

    function latir() {
      const s = ls();
      if (!s || cerrada) return;
      const v = leerLatido(s);
      const viva = v && Date.now() - v.t < caducidadMs;
      if (esPropietaria) {
        if (v && v.id !== id && viva) poner(false);
        else escribirLatido(s);
      } else if (!viva || (v && v.id === id)) {
        escribirLatido(s);
        poner(true);
      }
    }







    function abrirCanal() {
      if (typeof g.BroadcastChannel === 'function') {
        try {
          canal = new g.BroadcastChannel(CANAL);
          canal.onmessage = (ev) => recibirSobre(ev.data);
        } catch (e) {
          canal = null;
        }
      }
      if (typeof g.addEventListener === 'function') {
        g.addEventListener('storage', (ev) => {
          if (!ev) return;
          if (ev.key === CLAVE_AVISO && ev.newValue) {
            try { recibirSobre(JSON.parse(ev.newValue)); } catch (e) {   }
          } else if (ev.key === nombre && modo === 'latido') {
            latir();
          }
        });
      }
    }

    function leerAvisoSondeo() {
      const s = lsLectura();
      if (!s || cerrada) return;
      let t = null;
      try { t = s.getItem(CLAVE_AVISO); } catch (e) { return; }
      if (!t || t === ultimoAvisoLeido) return;
      ultimoAvisoLeido = t;
      try { recibirSobre(JSON.parse(t)); } catch (e) {   }
    }

    const vistos = [];
    function recibirSobre(s) {
      if (cerrada || !s || typeof s !== 'object' || s.de === id) return;
      const clave = `${s.de}:${s.n}`;
      if (vistos.includes(clave)) return;
      vistos.push(clave);
      if (vistos.length > 50) vistos.shift();
      const m = s.mensaje;
      if (m && typeof m === 'object' && typeof m.tipo === 'string' && m.tipo.startsWith('relevo_')) {
        alMensajeRelevo(m, s);
        return;
      }
      for (const f of [...oyentesMensaje]) {
        try { f(m); } catch (e) {   }
      }
    }


    function alMensajeRelevo(m, sobre) {
      if (m.tipo === 'relevo_pide') {
        atenderRelevo(m, sobre);
        return;
      }
      const f = esperasRelevo.get(m.id);
      if (f) f(m);
    }


    function atenderRelevo(m, sobre) {
      if (!esPropietaria || !m.id || relevosAtendidos.has(m.id)) return;
      if (typeof sobre.t === 'number' && Date.now() - sobre.t > RELEVO_CADUCA_MS) return;
      relevosAtendidos.add(m.id);
      const responder = (tipo) => avisar({ tipo, id: m.id });
      responder('relevo_espera');
      const latido = setInterval(() => responder('relevo_espera'), 1000);
      Promise.resolve()
        .then(() => (oyenteRelevo ? oyenteRelevo(() => responder('relevo_espera')) : null))
        .catch(() => {   })
        .then(() => {
          clearInterval(latido);
          if (!esPropietaria || cerrada) return;
          responder('relevo_listo');
          setTimeout(() => {
            if (esPropietaria && !cerrada && oyenteCancelado) {
              try { oyenteCancelado(); } catch (e) {   }
            }
          }, relevoCancelarMs);
        });
    }


    function pedirRelevo() {
      return new Promise((resolver) => {
        const rid = nuevoId();
        const t0 = Date.now();
        let ultimo = t0;
        let hecho = false;
        const fin = () => {
          if (hecho) return;
          hecho = true;
          clearInterval(reloj);
          esperasRelevo.delete(rid);
          resolver();
        };
        esperasRelevo.set(rid, (m) => {
          if (m.tipo === 'relevo_espera') ultimo = Date.now();
          else if (m.tipo === 'relevo_listo') fin();
        });
        const reloj = setInterval(() => {
          leerAvisoSondeo();
          const ahora = Date.now();
          if (esPropietaria || cerrada || ahora - ultimo > relevoSinRespuestaMs || ahora - t0 > relevoMaximoMs) fin();
        }, 100);
        avisar({ tipo: 'relevo_pide', id: rid });
      });
    }


    async function iniciar() {
      if (modo) return esPropietaria;
      abrirCanal();
      const s = lsLectura();
      try { ultimoAvisoLeido = s ? s.getItem(CLAVE_AVISO) : null; } catch (e) { ultimoAvisoLeido = null; }
      if (locks()) {
        modo = 'locks';
        const libre = await pedirCerrojo('si_libre');
        if (!libre) pedirCerrojo('esperar');
      } else if (ls()) {
        modo = 'latido';
        latir();
        temporizador = setInterval(latir, latidoMs);
      } else {
        modo = 'unica';
        poner(true);
      }
      if (modo !== 'unica') sondeo = setInterval(leerAvisoSondeo, sondeoMs);
      return esPropietaria;
    }

    async function tomar() {
      if (!modo) await iniciar();
      if (esPropietaria) return true;
      if (modo === 'unica') {
        poner(true);
        return true;
      }
      if (!tomando) {
        tomando = (async () => {
          await pedirRelevo();
          if (esPropietaria) return true;
          if (modo === 'locks') {
            if (abortarEspera) { abortarEspera(); abortarEspera = null; }
            return pedirCerrojo('robar');
          }
          const st = ls();
          if (st) escribirLatido(st);
          poner(true);
          return true;
        })().finally(() => { tomando = null; });
      }
      return tomando;
    }

    let nAviso = 0;
    function avisar(mensaje) {
      const sobre = { de: id, n: `${Date.now()}-${++nAviso}`, t: Date.now(), mensaje };
      if (canal) {
        try { canal.postMessage(sobre); } catch (e) {   }
      }
      const s = ls();
      if (s) {
        try {
          const texto = JSON.stringify(sobre);
          s.setItem(CLAVE_AVISO, texto);
          ultimoAvisoLeido = texto;
        } catch (e) {   }
      }
    }

    function soltar() {
      cerrada = true;
      if (abortarEspera) { abortarEspera(); abortarEspera = null; }
      if (soltarCerrojo) { const f = soltarCerrojo; soltarCerrojo = null; f(); }
      if (temporizador) { clearInterval(temporizador); temporizador = null; }
      if (sondeo) { clearInterval(sondeo); sondeo = null; }
      if (modo === 'latido' && esPropietaria) {
        const s = ls();
        const v = s && leerLatido(s);
        if (v && v.id === id) { try { s.removeItem(nombre); } catch (e) {   } }
      }
      if (canal) { try { canal.close(); } catch (e) {   } canal = null; }
      esPropietaria = false;
    }

    return {
      id,
      iniciar, tomar, avisar, soltar,
      get esPropietaria() { return esPropietaria; },
      get modo() { return modo; },
      alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },
      alMensaje(fn) { oyentesMensaje.add(fn); return () => oyentesMensaje.delete(fn); },
      alPedirRelevo(fn) { oyenteRelevo = typeof fn === 'function' ? fn : null; },
      alRelevoCancelado(fn) { oyenteCancelado = typeof fn === 'function' ? fn : null; },
    };
  }

  R2.pestanas = { NOMBRE, CANAL, CLAVE_AVISO, crear };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/persistencia/pestanas.js

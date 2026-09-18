













(function (R2) {
  'use strict';

  const CLAVE_SONDEO = 'diarios-explorer:v1:sondeo';
  const BD_SONDEO = 'diarios-explorer-sondeo';


  const ESENCIALES = [
    ['procesos en segundo plano (Worker)', (g) => typeof g.Worker === 'function'],
    ['Blob y URL.createObjectURL', (g) => typeof g.Blob === 'function' && !!g.URL && typeof g.URL.createObjectURL === 'function'],
    ['WebAssembly', (g) => typeof g.WebAssembly === 'object' && g.WebAssembly !== null && typeof g.WebAssembly.instantiate === 'function'],
    ['enteros de 64 bits (BigInt64Array)', (g) => typeof g.BigInt64Array === 'function'],
    ['TextEncoder y TextDecoder', (g) => typeof g.TextEncoder === 'function' && typeof g.TextDecoder === 'function'],
    ['lectura de archivos (Blob.arrayBuffer)', (g) => typeof g.Blob === 'function' && typeof g.Blob.prototype.arrayBuffer === 'function'],
    ['MessageChannel', (g) => typeof g.MessageChannel === 'function'],
    ['AbortController', (g) => typeof g.AbortController === 'function'],
    ['expresiones regulares con el indicador «v»', (g) => {
      try { return new (g.RegExp || RegExp)('[\\p{L}--[a-z]]', 'v').test('ñ'); } catch (e) { return false; }
    }],
    ['diálogos (<dialog>)', (g) => typeof g.HTMLDialogElement === 'function' && typeof g.HTMLDialogElement.prototype.showModal === 'function'],
  ];

  function motorDe(userAgent, marcas) {
    const ua = String(userAgent || '');
    const lista = Array.isArray(marcas) ? marcas.map((m) => String(m && m.brand)) : [];
    if (lista.some((b) => /Chromium|Google Chrome|Microsoft Edge|Opera/.test(b))) return 'chromium';
    if (/Firefox\/\d/.test(ua) && !/Seamonkey/i.test(ua)) return 'gecko';
    if (/(Chrome|Chromium|CriOS|Edg|EdgiOS|OPR)\/\d/.test(ua)) return 'chromium';
    if (/AppleWebKit\/\d/.test(ua)) return 'webkit';
    return 'desconocido';
  }

  function sondearSincrono(g) {
    const w = g || globalThis;
    const nav = w.navigator || {};
    const loc = w.location || {};
    const faltan = [];
    for (const [texto, prueba] of ESENCIALES) {
      let ok = false;
      try { ok = !!prueba(w); } catch (e) { ok = false; }
      if (!ok) faltan.push(texto);
    }
    const protocolo = loc.protocol || '';
    return {
      protocolo,
      archivoLocal: protocolo === 'file:',
      seguro: !!w.isSecureContext,
      aislado: !!w.crossOriginIsolated,
      motor: motorDe(nav.userAgent, nav.userAgentData && nav.userAgentData.brands),
      faltan,
      opcionales: {
        DecompressionStream: typeof w.DecompressionStream === 'function',
        fromBase64: typeof (w.Uint8Array || Uint8Array).fromBase64 === 'function',
        memoriaEquipoGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
        limiteHeapMb: w.performance && w.performance.memory ? Math.round(w.performance.memory.jsHeapSizeLimit / 1048576) : null,
      },
    };
  }

  function conTiempo(promesa, ms) {
    let t = null;
    return Promise.race([
      promesa,
      new Promise((_, rechazar) => { t = setTimeout(() => rechazar(new Error(`sin respuesta en ${ms} ms`)), ms); }),
    ]).finally(() => clearTimeout(t));
  }

  function probarLocalStorage(w) {
    try {
      const s = w.localStorage;
      if (!s) return { ok: false, detalle: 'sin localStorage' };
      s.setItem(CLAVE_SONDEO, '1');
      const ok = s.getItem(CLAVE_SONDEO) === '1';
      s.removeItem(CLAVE_SONDEO);
      return { ok, detalle: ok ? null : 'no conserva lo escrito' };
    } catch (e) {
      return { ok: false, detalle: `${e.name}: ${e.message}` };
    }
  }

  function probarIndexedDB(w) {
    return new Promise((resolver) => {
      let idb;
      try { idb = w.indexedDB; } catch (e) { resolver({ ok: false, detalle: `${e.name}: ${e.message}` }); return; }
      if (!idb) { resolver({ ok: false, detalle: 'sin indexedDB' }); return; }
      let rq;
      try { rq = idb.open(BD_SONDEO, 1); } catch (e) { resolver({ ok: false, detalle: `${e.name}: ${e.message}` }); return; }
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore('s'); } catch (e) {   } };
      rq.onblocked = () => resolver({ ok: false, detalle: 'bloqueada' });
      rq.onerror = () => resolver({ ok: false, detalle: rq.error ? `${rq.error.name}: ${rq.error.message}` : 'error al abrir' });
      rq.onsuccess = () => {
        const bd = rq.result;
        try {
          const tx = bd.transaction('s', 'readwrite');
          tx.objectStore('s').put(1, 'k');
          tx.oncomplete = () => {
            bd.close();
            try { idb.deleteDatabase(BD_SONDEO); } catch (e) {   }
            resolver({ ok: true, detalle: null });
          };
          tx.onerror = tx.onabort = () => { bd.close(); resolver({ ok: false, detalle: tx.error ? `${tx.error.name}: ${tx.error.message}` : 'error al escribir' }); };
        } catch (e) {
          bd.close();
          resolver({ ok: false, detalle: `${e.name}: ${e.message}` });
        }
      };
    });
  }

  async function sondearAlmacen(g, opciones) {
    const w = g || globalThis;
    const tiempoMs = (opciones && opciones.tiempoMs) || 2500;
    const ls = probarLocalStorage(w);
    let idb;
    try { idb = await conTiempo(probarIndexedDB(w), tiempoMs); } catch (e) { idb = { ok: false, detalle: e.message }; }
    return { localStorage: ls.ok, indexedDB: idb.ok, persistente: ls.ok || idb.ok, detalle: { localStorage: ls.detalle, indexedDB: idb.detalle } };
  }

  function avisos(sondeo, almacen) {
    const s = sondeo || {};
    let a;
    if (!almacen) {
      a = { tipo: 'comprobando', texto: 'Comprobando si este navegador puede guardar sus bibliotecas…' };
    } else if (almacen.persistente) {
      a = { tipo: 'navegador', texto: 'Sus bibliotecas se guardan en este navegador y se pueden exportar como .2replib.' };
      if (s.motor === 'gecko' && s.archivoLocal) {
        a.texto += ' En Firefox dependen de dónde esté este archivo: si lo mueve o le cambia el nombre, no las encontrará.';
      }
    } else {
      a = { tipo: 'memoria', texto: 'Este navegador no permite guardar datos en una página abierta como archivo: sus bibliotecas solo durarán mientras la tenga abierta. Expórtelas como .2replib antes de cerrarla.' };
    }
    const gb = s.opcionales && s.opcionales.memoriaEquipoGb;
    const memoria = typeof gb === 'number' && gb <= 4
      ? `Este equipo tiene unos ${String(gb).replace('.', ',')} GB de memoria y la construcción de un CSV grande puede necesitar más de 1 GB: cierre otras pestañas antes de empezar.`
      : null;
    return { almacen: a, memoria };
  }

  R2.capacidades = { ESENCIALES, motorDe, sondearSincrono, sondearAlmacen, avisos };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/capacidades.js

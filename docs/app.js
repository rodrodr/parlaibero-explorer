







(function (R2) {
  'use strict';

  const K = new Int32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  class Sha256 {
    constructor() {
      this.h = new Int32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
      ]);
      this.w = new Int32Array(64);
      this.pendiente = new Uint8Array(64);
      this.nPendiente = 0;
      this.longitud = 0;
      this.terminado = false;
    }


    update(datos) {
      if (this.terminado) throw new Error('Sha256: ya se calculó el resumen');
      const n = datos.length;
      let i = 0;
      this.longitud += n;
      if (this.nPendiente > 0) {
        const toma = Math.min(64 - this.nPendiente, n);
        this.pendiente.set(datos.subarray(0, toma), this.nPendiente);
        this.nPendiente += toma;
        i = toma;
        if (this.nPendiente === 64) {
          this._bloque(this.pendiente, 0);
          this.nPendiente = 0;
        }
      }
      for (; i + 64 <= n; i += 64) this._bloque(datos, i);
      if (i < n) {
        this.pendiente.set(datos.subarray(i), 0);
        this.nPendiente = n - i;
      }
      return this;
    }

    _bloque(d, o) {
      const w = this.w, h = this.h;
      for (let j = 0; j < 16; j++, o += 4) w[j] = (d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3];
      for (let j = 16; j < 64; j++) {
        const x = w[j - 15], y = w[j - 2];
        const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        w[j] = (s1 + w[j - 7] + s0 + w[j - 16]) | 0;
      }
      let a = h[0], b = h[1], c = h[2], dd = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let j = 0; j < 64; j++) {
        const t1 = (hh + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) +
          ((e & f) ^ (~e & g)) + K[j] + w[j]) | 0;
        const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) +
          ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (dd + t1) | 0; dd = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + dd) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }


    hex() {
      const bits = this.longitud * 8;
      const relleno = new Uint8Array(((this.nPendiente + 9 + 63) & ~63) - this.nPendiente);
      relleno[0] = 0x80;
      const alto = Math.floor(bits / 4294967296), bajo = bits >>> 0, L = relleno.length;
      relleno[L - 8] = alto >>> 24; relleno[L - 7] = alto >>> 16; relleno[L - 6] = alto >>> 8; relleno[L - 5] = alto;
      relleno[L - 4] = bajo >>> 24; relleno[L - 3] = bajo >>> 16; relleno[L - 2] = bajo >>> 8; relleno[L - 1] = bajo;
      this.update(relleno);
      this.terminado = true;
      let s = '';
      for (let j = 0; j < 8; j++) s += (this.h[j] >>> 0).toString(16).padStart(8, '0');
      return s;
    }
  }


  function hex(bytes) {
    return new Sha256().update(bytes).hex();
  }







  function huellaTrozo(u8) {
    const n = u8.length, n8 = (n >>> 3) << 3, n4 = n8 >>> 2;
    let w;
    if ((u8.byteOffset & 3) === 0) {
      w = new Uint32Array(u8.buffer, u8.byteOffset, n4);
    } else {
      const copia = new Uint8Array(n8);
      copia.set(u8.subarray(0, n8));
      w = new Uint32Array(copia.buffer);
    }
    let h1 = 0x9e3779b9 ^ n, h2 = 0x85ebca6b ^ n;
    for (let i = 0; i < n4; i += 2) {
      h1 = Math.imul(h1 ^ w[i], 0x01000193);
      h2 = Math.imul(h2 ^ w[i + 1], 0xcc9e2d51);
    }
    for (let i = n8; i < n; i++) h1 = Math.imul(h1 ^ u8[i], 0x01000193);
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }

  R2.sha256 = { Sha256, hex, huellaTrozo };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/worker/sha256.js














(function (R2) {
  'use strict';

  const LBASE = new Uint16Array([3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]);
  const LEXT = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]);
  const DBASE = new Uint16Array([1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]);
  const DEXT = new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]);
  const ORDEN = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  const RAPIDO = 9;

  function danado(mensaje) {
    const e = new Error(`gzip: ${mensaje}`);
    e.codigo = 'RECURSO_DANADO';
    return e;
  }





  function tabla(lens, n) {
    const counts = new Uint16Array(16), offs = new Uint16Array(16), syms = new Uint16Array(n);
    for (let i = 0; i < n; i++) counts[lens[i]]++;
    counts[0] = 0;
    let quedan = 1;
    for (let len = 1; len < 16; len++) {
      quedan <<= 1;
      quedan -= counts[len];
      if (quedan < 0) throw danado('código Huffman sobresuscrito');
    }
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
    for (let i = 0; i < n; i++) if (lens[i]) syms[offs[lens[i]]++] = i;

    const rapida = new Uint32Array(1 << RAPIDO);
    let code = 0, k = 0;
    for (let len = 1; len <= RAPIDO; len++) {
      for (let c = 0; c < counts[len]; c++, k++, code++) {
        let inv = 0;
        for (let b = 0; b < len; b++) inv |= ((code >>> b) & 1) << (len - 1 - b);
        const paso = 1 << len;
        for (let r = inv; r < (1 << RAPIDO); r += paso) rapida[r] = (len << 16) | syms[k];
      }
      code <<= 1;
    }
    return { counts, syms, rapida };
  }

  function inflateRaw(src, pos, tamanoEsperado) {
    let out = new Uint8Array(tamanoEsperado > 0 ? tamanoEsperado : src.length * 4 + 1024), op = 0;
    let bitbuf = 0, bitcnt = 0;
    const n = src.length;

    const necesitar = (k) => {
      while (bitcnt < k) {
        if (pos >= n) throw danado('datos truncados');
        bitbuf |= src[pos++] << bitcnt;
        bitcnt += 8;
      }
    };
    const bits = (k) => {
      if (k === 0) return 0;
      necesitar(k);
      const v = bitbuf & ((1 << k) - 1);
      bitbuf >>>= k;
      bitcnt -= k;
      return v;
    };
    const asegurar = (k) => {
      if (op + k <= out.length) return;
      let m = out.length * 2;
      while (m < op + k) m *= 2;
      const o = new Uint8Array(m);
      o.set(out.subarray(0, op));
      out = o;
    };
    const decodificar = (h) => {

      while (bitcnt < RAPIDO && pos < n) { bitbuf |= src[pos++] << bitcnt; bitcnt += 8; }
      const e = h.rapida[bitbuf & ((1 << RAPIDO) - 1)];
      if (e !== 0 && (e >>> 16) <= bitcnt) {
        const len = e >>> 16;
        bitbuf >>>= len;
        bitcnt -= len;
        return e & 0xffff;
      }

      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= bits(1);
        const count = h.counts[len];
        if (code - count < first) return h.syms[index + (code - first)];
        index += count;
        first += count;
        first <<= 1;
        code <<= 1;
      }
      throw danado('código Huffman inválido');
    };

    let fijaL = null, fijaD = null, final = 0;
    do {
      final = bits(1);
      const tipo = bits(2);
      if (tipo === 0) {


        const sobra = bitcnt & 7;
        bitbuf >>>= sobra; bitcnt -= sobra;
        pos -= bitcnt >>> 3;
        bitbuf = 0; bitcnt = 0;
        if (pos + 4 > n) throw danado('bloque almacenado truncado');
        const len = src[pos] | (src[pos + 1] << 8);
        const nlen = src[pos + 2] | (src[pos + 3] << 8);
        if ((len ^ 0xffff) !== nlen) throw danado('longitud de bloque almacenado inválida');
        pos += 4;
        if (pos + len > n) throw danado('bloque almacenado truncado');
        asegurar(len);
        out.set(src.subarray(pos, pos + len), op);
        op += len; pos += len;
        continue;
      }
      let hl, hd;
      if (tipo === 1) {
        if (!fijaL) {
          const l = new Uint8Array(288);
          for (let i = 0; i < 144; i++) l[i] = 8;
          for (let i = 144; i < 256; i++) l[i] = 9;
          for (let i = 256; i < 280; i++) l[i] = 7;
          for (let i = 280; i < 288; i++) l[i] = 8;
          fijaL = tabla(l, 288);
          fijaD = tabla(new Uint8Array(30).fill(5), 30);
        }
        hl = fijaL; hd = fijaD;
      } else if (tipo === 2) {
        const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
        if (nlen > 286 || ndist > 30) throw danado('cabecera de bloque dinámico inválida');
        const cl = new Uint8Array(19);
        for (let i = 0; i < ncode; i++) cl[ORDEN[i]] = bits(3);
        const hc = tabla(cl, 19);
        const lens = new Uint8Array(nlen + ndist);
        let i = 0;
        while (i < nlen + ndist) {
          const sym = decodificar(hc);
          if (sym < 16) lens[i++] = sym;
          else {
            let rep, val = 0;
            if (sym === 16) { if (i === 0) throw danado('repetición sin longitud previa'); val = lens[i - 1]; rep = 3 + bits(2); }
            else if (sym === 17) rep = 3 + bits(3);
            else rep = 11 + bits(7);
            if (i + rep > nlen + ndist) throw danado('demasiadas longitudes');
            while (rep--) lens[i++] = val;
          }
        }
        hl = tabla(lens.subarray(0, nlen), nlen);
        hd = tabla(lens.subarray(nlen), ndist);
      } else throw danado('tipo de bloque inválido');
      for (;;) {
        let sym = decodificar(hl);
        if (sym < 256) {
          if (op >= out.length) asegurar(1);
          out[op++] = sym;
        } else if (sym === 256) break;
        else {
          sym -= 257;
          if (sym >= 29) throw danado('símbolo de longitud inválido');
          const len = LBASE[sym] + bits(LEXT[sym]);
          const ds = decodificar(hd);
          if (ds >= 30) throw danado('símbolo de distancia inválido');
          const dist = DBASE[ds] + bits(DEXT[ds]);
          if (dist > op) throw danado('distancia fuera de rango');
          asegurar(len);
          if (dist >= len) out.copyWithin(op, op - dist, op - dist + len);
          else for (let k = 0; k < len; k++) out[op + k] = out[op + k - dist];
          op += len;
        }
      }
    } while (!final);


    pos -= bitcnt >>> 3;
    return { salida: out.length === op ? out : out.subarray(0, op), fin: pos };
  }

  let TABLA_CRC = null;
  function crc32(u8) {
    if (!TABLA_CRC) {
      TABLA_CRC = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        TABLA_CRC[i] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < u8.length; i++) crc = TABLA_CRC[(crc ^ u8[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function gunzip(src) {
    if (!(src instanceof Uint8Array)) throw new TypeError('gunzip: se esperaba un Uint8Array');
    if (src.length < 18 || src[0] !== 0x1f || src[1] !== 0x8b || src[2] !== 8) throw danado('cabecera inválida');
    const flg = src[3];
    if (flg & 0xe0) throw danado('indicadores reservados');
    let pos = 10;
    if (flg & 4) pos += 2 + (src[pos] | (src[pos + 1] << 8));
    if (flg & 8) { while (pos < src.length && src[pos++]); }
    if (flg & 16) { while (pos < src.length && src[pos++]); }
    if (flg & 2) pos += 2;
    const n = src.length;
    const crc = (src[n - 8] | (src[n - 7] << 8) | (src[n - 6] << 16) | (src[n - 5] << 24)) >>> 0;
    const isize = (src[n - 4] | (src[n - 3] << 8) | (src[n - 2] << 16) | (src[n - 1] << 24)) >>> 0;
    const { salida, fin } = inflateRaw(src.subarray(0, n - 8), pos, isize);
    if (fin !== n - 8) throw danado(`sobran ${n - 8 - fin} bytes tras los datos comprimidos`);
    if ((salida.length >>> 0) !== isize) throw danado(`tamaño ${salida.length} en lugar de ${isize}`);
    if (crc32(salida) !== crc) throw danado('CRC-32 incorrecto');
    return salida;
  }

  R2.inflate = { gunzip, inflateRaw, crc32 };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/cargas/inflate.js

(function (R2) {
  'use strict';
  // Edición web (GitHub Pages): los recursos no viajan embebidos en el HTML; se descargan del mismo sitio.
  // Misma API que src/cargas/cargas.js (preparar, info, nombres, bytes, texto, wasm, urlWorker, archivoCorpus, errorDatos).
  const hayDom = typeof document !== 'undefined';
  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const tiempos = {};
  let datosLeidos = null;

  function danado(causa) {
    const e = new Error(`Recurso dañado: ${causa}`);
    e.codigo = 'RECURSO_DANADO';
    e.causa = causa;
    return e;
  }

  function leerDatos() {
    const el = hayDom ? document.getElementById('r2-datos') : null;
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { throw danado(`datos estáticos: ${e.message}`); }
  }

  const recursos = () => (R2.datos && R2.datos.recursos) || {};
  // version_web: huella de todas las fuentes (también los datos); build_id solo cambia con el worker.
  const version = () => (R2.datos && R2.datos.edicion && (R2.datos.edicion.version_web || R2.datos.edicion.build_id)) || '';
  const url = (nombre) => `${(recursos()[nombre] && recursos()[nombre].archivo) || nombre}?v=${encodeURIComponent(version())}`;

  async function descargar(nombre) {
    const t0 = ahora();
    const meta = recursos()[nombre] || {};
    let u8;
    try {
      const r = await fetch(url(nombre), { credentials: 'same-origin' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      u8 = new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      throw danado(`${nombre}: no se pudo descargar (${e && e.message ? e.message : e})`);
    }
    if (meta.bytes != null && u8.length !== Number(meta.bytes)) throw danado(`${nombre}: ${u8.length} bytes en lugar de ${meta.bytes}`);
    if (meta.sha256 && R2.sha256 && typeof R2.sha256.hex === 'function') {
      const h = R2.sha256.hex(u8);
      if (h !== meta.sha256) throw danado(`${nombre}: SHA-256 ${h} en lugar de ${meta.sha256}`);
    }
    tiempos[nombre] = { total_ms: ahora() - t0, bytes: u8.length };
    return u8;
  }

  const cache = new Map();
  function bytes(nombre) {
    if (!cache.has(nombre)) {
      const p = descargar(nombre);
      p.catch(() => cache.delete(nombre));
      cache.set(nombre, p);
    }
    return cache.get(nombre).then((u8) => u8.slice());
  }
  const texto = (nombre) => bytes(nombre).then((u8) => new TextDecoder('utf-8', { fatal: true }).decode(u8));
  const wasm = () => bytes('wasm').then((u8) => u8.buffer);
  const urlWorker = () => Promise.resolve(url('worker'));
  const preparar = () => Promise.all([wasm(), urlWorker()]).then(([w, u]) => ({ wasm: w, urlWorker: u, tiempos }));
  /** Nombres de los recursos que hay en el sitio (los descargables), no los embebidos. */
  const nombres = () => Object.keys(recursos());
  /** info(nombre): null para «corpus» y «capitales» (no viajan con la página); el resto, su ficha. */
  const info = (nombre) => (nombre === 'corpus' || nombre === 'capitales' ? null : (recursos()[nombre] || null));
  const archivoCorpus = () => Promise.resolve(null);

  R2.cargas = { nombres, info, bytes, texto, wasm, urlWorker, archivoCorpus, preparar, tiempos, errorDatos: null, web: true };

  try {
    datosLeidos = leerDatos();
    if (datosLeidos) R2.datos = Object.assign({}, datosLeidos, R2.datos || {});
  } catch (e) {
    R2.cargas.errorDatos = e;
  }

  if (hayDom) {
    document.addEventListener('click', (ev) => {
      const t = ev.target && typeof ev.target.closest === 'function' ? ev.target : null;
      if (!t) return;
      const abrir = t.closest('[data-abrir-creditos]');
      if (abrir) {
        const dlg = document.getElementById('dlgCreditos');
        if (dlg && !dlg.open && typeof dlg.showModal === 'function') { ev.preventDefault(); dlg.showModal(); }
        return;
      }
      const cerrar = t.closest('#dlgCreditos [data-close]');
      if (cerrar) cerrar.closest('dialog').close();
    });
  }
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=diarios-explorer/web/cargas_web.js




























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
      const base = opcionesConstruir && typeof opcionesConstruir.base === 'string' ? opcionesConstruir.base : undefined;
      enviar({ tipo: 'construir', archivo, lectura, base });
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



























(function (R2) {
  'use strict';

  const FASES = Object.freeze([
    Object.freeze({ id: 'leer', etiqueta: 'Leyendo y comprobando el archivo', peso: 0.44 }),
    Object.freeze({ id: 'guardar', etiqueta: 'Guardando e indexando intervenciones', peso: 0.02 }),
    Object.freeze({ id: 'indices', etiqueta: 'Creando índices', peso: 0.01 }),
    Object.freeze({ id: 'optimizar', etiqueta: 'Compactando el índice de palabras', peso: 0.06 }),
    Object.freeze({ id: 'estadisticas', etiqueta: 'Estadísticas y filtros', peso: 0.05 }),
    Object.freeze({ id: 'expresiones', etiqueta: 'Detectando expresiones de varias palabras', peso: 0.42 }),
  ]);

  const CONCURRENTES = new Set(['guardar']);

  /** Duración de las fases finales respecto a la lectura completa (medido con un corpus de 100 MB). */
  // expresiones: medido en Brasil (lectura 84 s, expresiones 120 s) y El Salvador (4 s y 10 s).
  const RESPECTO_A_LEER = Object.freeze({ indices: 0.02, optimizar: 0.12, estadisticas: 0.08, expresiones: 1.4 });
  // Con las expresiones ya calculadas (edición web, CSV idéntico al publicado) la fase solo relee el archivo para
  // comprobar su SHA-256 y carga la tabla: unas 0,1 veces la lectura. El worker lo avisa con ev.plan al empezar.
  const PRECALCULADAS = Object.freeze({ etiqueta: 'Cargando las expresiones ya calculadas', respecto_a_leer: 0.1,
    pesos: Object.freeze({ leer: 0.72, guardar: 0.03, indices: 0.02, optimizar: 0.09, estadisticas: 0.07, expresiones: 0.07 }) });

  const UMBRAL_FASE_LARGA_MS = 5000;

  const ETA_MIN_FRACCION = 0.05;
  const ETA_MIN_MS = 700;
  const ETA_SUAVIZADO = 0.4;


  function miles(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
    const t = String(Math.round(Math.abs(n)));
    return (n < 0 ? '-' : '') + t.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }


  function decimal(x, d = 1) {
    const f = Math.pow(10, d);
    const r = Math.round(x * f) / f;
    const ent = Math.trunc(Math.abs(r));
    const frac = d > 0 ? String(Math.round((Math.abs(r) - ent) * f)).padStart(d, '0') : '';
    return (r < 0 ? '-' : '') + miles(ent) + (d > 0 ? `,${frac}` : '');
  }


  function tamano(bytes) {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—';
    if (bytes < 1000) return `${miles(bytes)} ${bytes === 1 ? 'byte' : 'bytes'}`;
    if (bytes < 1e6) return `${decimal(bytes / 1e3, bytes < 1e4 ? 1 : 0)} kB`;
    if (bytes < 1e9) return `${decimal(bytes / 1e6, 1)} MB`;
    return `${decimal(bytes / 1e9, 2)} GB`;
  }


  function duracion(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—';
    const s = ms / 1000;
    if (s < 10) return `${decimal(s, 1)} s`;
    if (s < 60) return `${Math.round(s)} s`;
    const total = Math.round(s);
    const min = Math.floor(total / 60), seg = total % 60;
    return seg ? `${min} min ${seg} s` : `${min} min`;
  }


  function porcentaje(f) {
    const p = Math.max(0, Math.min(100, Math.floor((Number(f) || 0) * 100)));
    return `${p} %`;
  }


  function textoEta(ms) {
    if (ms == null || !Number.isFinite(ms)) return 'Calculando el tiempo restante…';
    if (ms < 1000) return 'Casi listo';
    const s = ms / 1000;
    if (s < 10) return `Quedan unos ${Math.ceil(s)} s`;
    if (s < 60) return `Quedan unos ${Math.max(10, Math.round(s / 5) * 5)} s`;
    const total = Math.round(s / 10) * 10;
    const min = Math.floor(total / 60), seg = total % 60;
    return seg ? `Quedan unos ${min} min ${seg} s` : `Quedan unos ${min} min`;
  }


  /** Memoria del motor (MB) según el tamaño del CSV: el texto se guarda comprimido (≈0,3×) y el índice ocupa ≈0,36× (medido). */
  function memoriaEstimada(bytes) {
    const mb = Math.max(0, Number(bytes) || 0) / 1e6;
    const r50 = (x) => Math.max(50, Math.round(x / 50) * 50);
    return { min: r50(60 + 0.7 * mb), max: r50(100 + 0.95 * mb) };
  }


  function crearSeguimiento(opciones) {
    const ahora = (opciones && opciones.ahora) || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const fases = FASES.map((f, i) => ({ id: f.id, etiqueta: f.etiqueta, indice: i + 1, peso: f.peso, estado: 'espera',
      hecho: 0, total: null, inicio: null, fin: null }));
    const porId = new Map(fases.map((f) => [f.id, f]));
    const factores = Object.assign({}, RESPECTO_A_LEER);
    let t0 = null, eta = null, tEta = null, activaId = null;

    /** plan.expresiones: 'precalculadas' (etiqueta, peso y estimación de la fase ligera) o 'detectar' (los de siempre). */
    function aplicarPlan(plan) {
      if (!plan || !plan.expresiones) return;
      const pre = plan.expresiones === 'precalculadas';
      for (const f of fases) {
        const def = FASES[f.indice - 1];
        f.peso = pre ? PRECALCULADAS.pesos[f.id] : def.peso;
        if (f.id === 'expresiones') f.etiqueta = pre ? PRECALCULADAS.etiqueta : def.etiqueta;
      }
      factores.expresiones = pre ? PRECALCULADAS.respecto_a_leer : RESPECTO_A_LEER.expresiones;
    }

    const fraccionDe = (f) => {
      if (f.estado === 'hecha') return 1;
      if (f.estado === 'espera' || !f.total) return 0;
      return Math.max(0, Math.min(1, f.hecho / f.total));
    };
    const terminado = () => fases.every((f) => f.estado === 'hecha');

    const fraccionTotal = () => (terminado() ? 1 : Math.min(1, fases.reduce((s, f) => s + f.peso * fraccionDe(f), 0)));
    const msDe = (f, t) => (f.inicio === null ? 0 : (f.fin !== null ? f.fin : t) - f.inicio);

    function cerrar(f, t) {
      if (f.estado === 'hecha') return;
      if (f.inicio === null) f.inicio = t;
      f.estado = 'hecha';
      f.fin = t;
      if (f.total != null) f.hecho = f.total;
    }


    function porRitmo(f, t) {
      const x = fraccionDe(f), ms = msDe(f, t);
      return f.estado === 'activa' && x >= ETA_MIN_FRACCION && ms >= ETA_MIN_MS ? ms / x : null;
    }


    function restanteDe(f, ref, t) {
      if (f.estado === 'hecha') return 0;
      if (f.estado === 'espera') return ref;
      const d = porRitmo(f, t);
      return d !== null ? d * (1 - fraccionDe(f)) : Math.max(ref * 0.25, ref - msDe(f, t));
    }

    function etaBruta(t) {
      if (terminado()) return 0;
      const leer = porId.get('leer');
      const D = leer.estado === 'hecha' ? msDe(leer, t) : porRitmo(leer, t);
      if (D === null || !(D > 0)) return null;
      return restanteDe(leer, D, t)
        + restanteDe(porId.get('indices'), D * factores.indices, t)
        + restanteDe(porId.get('optimizar'), D * factores.optimizar, t)
        + restanteDe(porId.get('estadisticas'), D * factores.estadisticas, t)
        + restanteDe(porId.get('expresiones'), D * factores.expresiones, t);
    }

    function actualizarEta(t) {
      const bruta = etaBruta(t);
      if (bruta === null) return;
      if (bruta === 0) { eta = 0; tEta = t; return; }
      eta = eta === null ? bruta : (1 - ETA_SUAVIZADO) * Math.max(0, eta - (t - tEta)) + ETA_SUAVIZADO * bruta;
      tEta = t;
    }

    function masAvanzadaActiva() {
      let r = null;
      for (const f of fases) if (f.estado === 'activa') r = f;
      return r;
    }

    function evento(ev) {
      if (ev && ev.plan) aplicarPlan(ev.plan);
      if (ev && ev.fase === 'expresiones' && ev.precalculadas) aplicarPlan({ expresiones: 'precalculadas' });
      const f = ev && porId.get(ev.fase);
      if (!f) return false;
      const t = ahora();
      if (t0 === null) t0 = t;
      if (!CONCURRENTES.has(f.id)) {
        for (const g of fases) if (g.indice < f.indice) cerrar(g, t);
      }
      if (f.inicio === null) f.inicio = t;
      if (f.estado !== 'hecha') {
        f.hecho = typeof ev.hecho === 'number' ? ev.hecho : f.hecho;
        f.total = ev.total != null ? ev.total : null;
        f.estado = 'activa';
        if (f.total != null && f.total > 0 && f.hecho >= f.total) cerrar(f, t);
      }
      actualizarEta(t);
      const activa = masAvanzadaActiva();
      const nueva = activa ? activa.id : null;
      const cambio = nueva !== activaId;
      activaId = nueva;
      return cambio;
    }

    function estado() {
      const t = ahora();
      const activa = masAvanzadaActiva();
      const fin = terminado();
      return {
        fases: fases.map((f) => ({ id: f.id, etiqueta: f.etiqueta, indice: f.indice, estado: f.estado, hecho: f.hecho, total: f.total,
          fraccion: fraccionDe(f), duracionMs: f.inicio === null ? null : msDe(f, t) })),
        fraccion: fraccionTotal(),
        etaMs: fin ? 0 : eta === null ? null : Math.max(0, eta - (t - tEta)),
        transcurridoMs: t0 === null ? 0 : t - t0,
        activa: activa ? { id: activa.id, etiqueta: activa.etiqueta, indice: activa.indice, msEnFase: t - activa.inicio } : null,
        faseLarga: !!activa && t - activa.inicio > UMBRAL_FASE_LARGA_MS,
        terminado: fin,
      };
    }

    return { evento, estado };
  }

  R2.progreso = { FASES, RESPECTO_A_LEER, PRECALCULADAS, UMBRAL_FASE_LARGA_MS, crearSeguimiento, miles, decimal, tamano, duracion, porcentaje, textoEta, memoriaEstimada };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/progreso.js












(function (R2) {
  'use strict';

  const g = globalThis;
  const doc = g.document;
  const ESTILOS = ['editorial', 'iluminado', 'clasico'];
  const COLOR_TEMA = { editorial: '#6a1a24', iluminado: '#6a1a24', clasico: '#4a4fa8' };
  let dlg = null;

  function leer(clave) { try { return g.localStorage.getItem(clave); } catch (e) { return null; } }
  function guardar(clave, valor) { try { g.localStorage.setItem(clave, valor); } catch (e) {   } }

  const estilo = () => (ESTILOS.includes(doc.documentElement.dataset.estilo) ? doc.documentElement.dataset.estilo : 'editorial');
  const tema = () => (doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');


  function aplicar() {
    const e = leer('estilo');
    doc.documentElement.dataset.estilo = ESTILOS.includes(e) ? e : 'editorial';
    colorTema();
  }

  function colorTema() {
    const m = doc.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', COLOR_TEMA[estilo()]);
  }

  function poner(o = {}) {
    if (o.tema === 'dark' || o.tema === 'light') { doc.documentElement.dataset.theme = o.tema; guardar('tema', o.tema); }
    if (ESTILOS.includes(o.estilo)) { doc.documentElement.dataset.estilo = o.estilo; guardar('estilo', o.estilo); }
    colorTema();
    if (dlg) pintar();
    try { doc.dispatchEvent(new g.CustomEvent('r2:ajustes', { detail: { tema: tema(), estilo: estilo() } })); } catch (e) {   }
  }

  const opcion = (grupo, valor, titulo, nota) =>
    `<label class="chk"><input type="radio" name="${grupo}" value="${valor}"><span class="lbl">${titulo}<small>${nota}</small></span></label>`;

  function crear() {
    dlg = doc.createElement('dialog');
    dlg.id = 'dlgAjustes';
    dlg.setAttribute('aria-labelledby', 'ajustesTitulo');
    dlg.innerHTML = `<div class="dhead"><h3 id="ajustesTitulo">Ajustes</h3>
    <p class="dsub">Se recuerdan en este navegador.</p></div>
  <div class="dbody">
    <fieldset><legend>Estilo</legend><div class="opciones">
      ${opcion('estilo', 'editorial', 'Editorial', 'Granate y pliego de lectura: nombre del orador en grande, texto mayor y capital inicial.')}
      ${opcion('estilo', 'iluminado', 'Iluminado', 'Como el editorial, con iniciales de manuscrito iluminado en las intervenciones largas.')}
      ${opcion('estilo', 'clasico', 'Clásico', 'El aspecto original de la aplicación.')}
    </div></fieldset>
    <fieldset><legend>Tema</legend><div class="opciones">
      ${opcion('tema', 'light', 'Claro', 'Papel claro.')}
      ${opcion('tema', 'dark', 'Oscuro', 'Fondo oscuro; la misma paleta, adaptada.')}
    </div></fieldset>
  </div>
  <div class="dfoot"><button type="button" class="btn primary" data-close>Cerrar</button></div>`;
    dlg.addEventListener('change', (ev) => {
      const t = ev.target;
      if (!t || t.type !== 'radio' || !t.checked) return;
      poner(t.name === 'tema' ? { tema: t.value } : { estilo: t.value });
    });
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    doc.body.appendChild(dlg);
  }

  function pintar() {
    for (const r of dlg.querySelectorAll('input[type="radio"]')) r.checked = r.value === (r.name === 'tema' ? tema() : estilo());
  }

  function abrir() {
    if (!dlg) crear();
    pintar();
    if (!dlg.open) dlg.showModal();
  }

  R2.ajustes = { aplicar, estilo, tema, poner, abrir, COLOR_TEMA };
}(globalThis.R2 = globalThis.R2 || {}));
//# sourceURL=2rep-standalone/src/arranque/ajustes.js













(function (R2) {
  'use strict';

  const g = globalThis;
  const cache = new Map();
  let embebidas = null;
  const BASE = { Á: 'A', À: 'A', Â: 'A', Ä: 'A', É: 'E', È: 'E', Ê: 'E', Ë: 'E', Í: 'I', Ì: 'I', Ï: 'I', Ó: 'O', Ò: 'O', Ô: 'O', Ö: 'O', Ú: 'U', Ù: 'U', Û: 'U', Ü: 'U' };
  const MARGEN = 0.033;

  function datos() { return (R2.datos && R2.datos.capitales) || null; }
  function disponible() { const d = datos(); return !!(d && d.letras && d.letras.length); }
  function letraDe(c) {
    const L = String(c || '').slice(0, 1).toUpperCase();
    return BASE[L] || L;
  }


  function preparar(svg) {
    if (typeof svg !== 'string' || !/^<svg\b/.test(svg)) return null;
    return svg.replace(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/, (m, w, h) => {
      const W = +w, H = +h, mx = W * MARGEN, my = H * MARGEN;
      return `viewBox="${mx.toFixed(1)} ${my.toFixed(1)} ${(W - 2 * mx).toFixed(1)} ${(H - 2 * my).toFixed(1)}"`;
    });
  }

  function desdeEmbebidas(L) {
    if (!embebidas) {
      embebidas = R2.cargas.texto('capitales').then((t) => JSON.parse(t));
      embebidas.catch(() => { embebidas = null; });
    }
    return embebidas.then((mapa) => preparar(mapa[L]));
  }

  function desdeServidas(L, d) {
    const url = `${d.dir || 'capitales'}/${encodeURIComponent(L)}.svg`;
    return g.fetch(url, { credentials: 'same-origin' }).then((r) => (r.ok ? r.text() : null)).then(preparar);
  }

  function svg(letra) {
    const d = datos();
    const L = letraDe(letra);
    if (!d || !d.letras.includes(L)) return Promise.resolve(null);
    if (!cache.has(L)) {
      const p = (d.modo === 'embebidas' && R2.cargas && R2.cargas.info && R2.cargas.info('capitales') ? desdeEmbebidas(L) : desdeServidas(L, d))
        .catch(() => null);
      cache.set(L, p);
      p.then((v) => { if (v === null) cache.delete(L); });
    }
    return cache.get(L);
  }

  R2.capitales = { svg, disponible, letraDe };
}(globalThis.R2 = globalThis.R2 || {}));
//# sourceURL=2rep-standalone/src/arranque/capitales.js





































(function (R2) {
  'use strict';

  const P = () => R2.progreso;
  const ENTRADA_CONSTRUIR = 'La base se construye en este navegador a partir del CSV y, si lo permite, se guarda para abrirla sola la próxima vez. No cierre ni recargue la pestaña hasta que termine.';
  const URL_PARLAIBERO = 'https://dataverse.harvard.edu/dataverse/parlaibero';
  const ENTRADA_ABRIR = 'Elija el archivo de intervenciones de un país de ParlaIbero (por ejemplo ES_interventions.csv, descargado de Harvard Dataverse). La base de datos se construye en su navegador; nada sale de su equipo.';

  const PLANTILLA = `
<header class="r2c-cab">
  <div class="r2c-marca"><h1 class="r2c-titulo">ParlaIbero</h1><span class="r2c-insignia">Explorador de diarios de sesiones</span><span class="r2c-sub" data-r2="sub"></span></div>
  <span class="r2c-crece"></span>
  <button type="button" class="btn ghost sm" data-r2="creditos" data-abrir-creditos hidden>Créditos y licencias</button>
  <button type="button" class="btn ghost icon" data-r2="ajustes" title="Ajustes: estilo y tema" aria-label="Ajustes: estilo y tema">⚙</button>
  <button type="button" class="btn ghost icon" data-r2="tema" title="Claro / oscuro" aria-label="Cambiar entre tema claro y oscuro">◐</button>
</header>
<main class="r2c-cuerpo">
  <p class="r2c-nota r2c-aviso" data-r2="aviso" role="status" hidden></p>
  <input type="file" accept=".csv,text/csv" data-r2="archivo" class="r2c-oculto" tabindex="-1" aria-hidden="true">
  <section class="r2c-tarjeta" data-r2="abrir" aria-labelledby="r2c-abrir-t">
    <p class="r2c-antetitulo">Parliamentary Speeches from Latin America, Portugal and Spain · Instituto de Iberoamérica, Universidad de Salamanca</p>
    <h2 class="r2c-h" id="r2c-abrir-t" tabindex="-1">Abra el CSV de un país</h2>
    <p class="r2c-entrada" data-r2="abrir-entrada">${ENTRADA_ABRIR}</p>
    <p class="r2c-nota" data-r2="nota" role="status" hidden></p>
    <div class="r2c-soltar" data-r2="soltar">
      <p class="r2c-soltar-t"><b>Arrastre aquí el CSV de intervenciones</b> (p. ej. <span class="r2c-mono">ES_interventions.csv</span>)</p>
      <p class="r2c-soltar-f" data-r2="ficha">o elija el archivo · separador «,» · codificación UTF-8</p>
      <div class="r2c-botones">
        <button type="button" class="btn primary" data-r2="elegir">Elegir archivo…</button>
        <button type="button" class="btn" data-r2="reintentar" hidden>Reintentar</button>
        <a class="btn" data-r2="dataverse" href="${URL_PARLAIBERO}" target="_blank" rel="noopener noreferrer">Conjuntos de datos en Dataverse <span aria-hidden="true">↗</span><span class="r2c-oculto"> (se abre en otra pestaña)</span></a>
      </div>
    </div>
    <p class="r2c-motor" data-r2="motor" aria-live="polite"></p>
    <div class="r2c-cita" data-r2="cita" hidden><b>Fuente (cite siempre):</b> <span data-r2="cita-texto"></span></div>
    <ul class="r2c-privacidad">
      <li><span aria-hidden="true">🔒</span><span>El CSV se lee localmente; no se sube a ningún servidor.</span></li>
      <li data-r2="almacen"><span aria-hidden="true">📚</span><span data-r2="almacen-t">Comprobando si este navegador puede guardar sus bibliotecas…</span></li>
      <li data-r2="memoria-aviso" hidden><span aria-hidden="true">⚠</span><span data-r2="memoria-aviso-t"></span></li>
    </ul>
  </section>

  <section class="r2c-tarjeta" data-r2="construir" aria-labelledby="r2c-constr-t" hidden>
    <p class="r2c-antetitulo" data-r2="constr-ficha"></p>
    <h2 class="r2c-h" id="r2c-constr-t" tabindex="-1">Preparando el corpus…</h2>
    <p class="r2c-entrada" data-r2="constr-entrada"></p>
    <ol class="r2c-fases" data-r2="fases" aria-label="Fases de la construcción"></ol>
    <div class="r2c-total">
      <div class="r2c-barra" data-r2="total" role="progressbar" aria-label="Progreso total" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <div class="r2c-total-t"><span data-r2="pct">0&nbsp;%</span><span data-r2="eta">Calculando el tiempo restante…</span></div>
    </div>
    <p class="r2c-oculto" data-r2="anuncio" aria-live="polite"></p>
    <div class="r2c-pie"><span data-r2="memoria"></span><span data-r2="motor-v">Motor: SQLite (WebAssembly) · FTS5</span></div>
    <div class="r2c-cancelar">
      <p class="r2c-nota-cancelar" id="r2c-nota-cancelar" data-r2="nota-cancelar" hidden></p>
      <button type="button" class="btn" data-r2="cancelar">Cancelar</button>
    </div>
  </section>

  <section class="r2c-espera" data-r2="espera" aria-labelledby="r2c-esp-t" hidden>
    <h2 class="r2c-esp-h" id="r2c-esp-t" tabindex="-1" data-r2="esp-titulo">Preparando el corpus…</h2>
    <div class="r2c-barra indet" data-r2="esp-barra" role="progressbar" aria-label="Preparando el corpus" aria-valuemin="0" aria-valuemax="100"><i></i></div>
    <p class="r2c-esp-nota" data-r2="esp-nota"></p>
    <p class="r2c-oculto" data-r2="esp-anuncio" aria-live="polite"></p>
  </section>

  <section class="r2c-tarjeta" data-r2="recordado" aria-labelledby="r2c-rec-t" hidden>
    <p class="r2c-antetitulo" data-r2="rec-ficha"></p>
    <h2 class="r2c-h" id="r2c-rec-t" tabindex="-1" data-r2="rec-titulo">Abriendo la base recordada…</h2>
    <p class="r2c-entrada" data-r2="rec-entrada">Esta base se guardó en este navegador: se abre sin volver a elegir el CSV.</p>
    <div class="r2c-total">
      <div class="r2c-barra" data-r2="rec-barra" role="progressbar" aria-label="Progreso de la apertura de la base recordada" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <div class="r2c-total-t"><span data-r2="rec-pct">0&nbsp;%</span><span data-r2="rec-estado">Leyendo la base guardada…</span></div>
    </div>
    <p class="r2c-oculto" data-r2="rec-anuncio" aria-live="polite"></p>
    <div class="r2c-cancelar">
      <button type="button" class="btn" data-r2="rec-cancelar">Cancelar y elegir otro CSV</button>
    </div>
  </section>

  <section class="r2c-tarjeta" data-r2="fallo" aria-labelledby="r2c-fallo-t" hidden>
    <p class="r2c-antetitulo" data-r2="fallo-ficha"></p>
    <h2 class="r2c-h" id="r2c-fallo-t" tabindex="-1" data-r2="fallo-titulo">No se pudo construir el corpus</h2>
    <div class="r2c-error" role="alert" data-r2="fallo-caja">
      <p data-r2="fallo-mensaje"></p>
      <dl><dt>Código</dt><dd><code data-r2="fallo-codigo"></code></dd><dt data-r2="fallo-donde-t">Ubicación</dt><dd data-r2="fallo-donde"></dd></dl>
    </div>
    <div class="r2c-ayuda" data-r2="fallo-ayuda" hidden>
      <p>Abra este mismo archivo en Chrome, Edge, Firefox o Safari (en una versión reciente): arrástrelo a una de sus ventanas o pegue esta dirección en su barra.</p>
      <code data-r2="fallo-direccion"></code>
    </div>
    <div class="r2c-botones">
      <button type="button" class="btn primary" data-r2="otro">Elegir otro archivo</button>
      <button type="button" class="btn" data-r2="fallo-reintentar">Reintentar</button>
      <button type="button" class="btn" data-r2="recargar">Recargar la página</button>
      <button type="button" class="btn" data-r2="copiar" hidden>Copiar la dirección</button>
      <a class="btn" data-r2="fallo-dataverse" href="${URL_PARLAIBERO}" target="_blank" rel="noopener noreferrer">Conjuntos de datos en Dataverse <span aria-hidden="true">↗</span><span class="r2c-oculto"> (se abre en otra pestaña)</span></a>
    </div>
  </section>

  <section class="r2c-tarjeta" data-r2="confirmar" aria-labelledby="r2c-conf-t" hidden>
    <p class="r2c-antetitulo" data-r2="conf-ficha"></p>
    <h2 class="r2c-h" id="r2c-conf-t" tabindex="-1">Este archivo tiene avisos</h2>
    <ul class="r2c-avisos" data-r2="conf-avisos" role="alert"></ul>
    <p class="r2c-entrada">Puede explorarlo igualmente, pero los resultados no coincidirán con los del conjunto de datos citado.</p>
    <div class="r2c-botones">
      <button type="button" class="btn primary" data-r2="continuar">Continuar con este archivo</button>
      <button type="button" class="btn" data-r2="conf-otro">Elegir otro archivo</button>
    </div>
  </section>
</main>`;

  const SECCIONES = ['espera', 'abrir', 'construir', 'recordado', 'fallo', 'confirmar'];
  const TITULOS_FALLO = {
    NAVEGADOR: 'Este navegador no es compatible',
    RECURSO_DANADO: 'No se pudo preparar la página',
    WORKER_NO_ARRANCA: 'No se pudo preparar la página',
    WASM_NO_ARRANCA: 'No se pudo preparar la página',
    WORKER_DETENIDO: 'El motor se ha detenido',
  };
  const ICONOS = { hecha: '✓', activa: '●', espera: '○' };
  const ESTADO_SR = { hecha: 'terminada', activa: 'en curso', espera: 'pendiente' };

  function crear(opciones) {
    const doc = opciones.documento;
    const h = opciones.manejadores || {};
    const llamar = (nombre, ...a) => { if (typeof h[nombre] === 'function') h[nombre](...a); };

    const raiz = doc.createElement('div');
    raiz.id = 'r2-carga';
    raiz.className = 'r2c';
    raiz.innerHTML = PLANTILLA;
    doc.body.appendChild(raiz);
    const $ = (k) => raiz.querySelector(`[data-r2="${k}"]`);



    const conDatos = !!(R2.arranque && typeof R2.arranque.datosPropios === 'function' && R2.arranque.datosPropios());
    const entradaPorDefecto = conDatos
      ? 'El corpus viaja con esta aplicación y se abre solo; nada sale de su equipo. Si quiere explorar otro CSV, puede elegirlo aquí.'
      : ENTRADA_ABRIR;
    if (conDatos) {
      raiz.querySelector('#r2c-abrir-t').textContent = 'Abrir otro conjunto de datos';
      $('abrir-entrada').textContent = entradaPorDefecto;
      raiz.querySelector('.r2c-soltar-t').innerHTML = 'Arrastre aquí otro CSV de intervenciones';
      raiz.querySelector('.r2c-privacidad li:first-child span:last-child').textContent = 'Todo se procesa en su navegador; nada se sube a ningún servidor.';
    }

    const v = { seccion: null, raiz };


    let indiceAnunciado = 0;
    let pctAnunciado = -1;
    const escuchas = [];
    const escuchar = (el, tipo, fn, op) => { el.addEventListener(tipo, fn, op); escuchas.push([el, tipo, fn, op]); };


    function mostrar(seccion) {
      for (const s of SECCIONES) $(s).hidden = s !== seccion;
      $('aviso').hidden = true;
      v.seccion = seccion;
      raiz.dataset.seccion = seccion;
    }

    function enfocar(el) {
      if (!el || el.hidden) return;
      try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); }
    }

    function ficha(archivo) {
      return archivo ? `${archivo.name || 'archivo sin nombre'} · ${P().tamano(archivo.size)}` : '';
    }


    function textoConCodigo(el, texto) {
      el.textContent = '';
      const partes = String(texto).split(/(https?:\/\/\S+?)(?=[,;)\s]|$)/);
      for (const p of partes) {
        if (!p) continue;
        if (/^https?:\/\//.test(p)) {
          const c = doc.createElement('code');
          c.textContent = p;
          el.appendChild(c);
        } else el.appendChild(doc.createTextNode(p));
      }
    }


    const entrada = $('archivo');
    escuchar($('elegir'), 'click', () => v.abrirSelector());
    escuchar(entrada, 'change', () => {
      const f = entrada.files && entrada.files[0];
      entrada.value = '';
      if (f) llamar('alElegir', f);
    });
    escuchar($('ajustes'), 'click', () => { if (R2.ajustes) R2.ajustes.abrir(); });
    escuchar($('reintentar'), 'click', () => llamar('alReintentar'));
    escuchar($('fallo-reintentar'), 'click', () => llamar('alReintentar'));
    escuchar($('cancelar'), 'click', () => llamar('alCancelar'));
    escuchar($('rec-cancelar'), 'click', () => llamar('alCancelarRecordado'));
    escuchar($('otro'), 'click', () => llamar('alOtro'));
    escuchar($('conf-otro'), 'click', () => llamar('alOtro'));
    escuchar($('continuar'), 'click', () => llamar('alContinuar'));
    escuchar($('recargar'), 'click', () => llamar('alRecargar'));
    escuchar($('tema'), 'click', () => llamar('alTema'));
    escuchar($('copiar'), 'click', () => {
      const w = doc.defaultView || {};
      const b = $('copiar');
      const texto = $('fallo-direccion').textContent;
      Promise.resolve().then(() => w.navigator.clipboard.writeText(texto))
        .then(() => { b.textContent = 'Dirección copiada'; }, () => { b.textContent = 'No se pudo copiar: selecciónela y cópiela'; });
    });

    const creditos = doc.getElementById('dlgCreditos');
    if (creditos && typeof creditos.showModal === 'function') {
      $('creditos').hidden = false;
      if (!(R2.cargas)) escuchar($('creditos'), 'click', () => { if (!creditos.open) creditos.showModal(); });
    }

    escuchar($('soltar'), 'click', (e) => { if (!e.target.closest('button, a, input')) v.abrirSelector(); });



    const conArchivos = (e) => !!e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0;
    const aceptaSoltar = () => v.seccion === 'abrir' || v.seccion === 'fallo' || v.seccion === 'confirmar';
    let profundidad = 0;
    escuchar(doc, 'dragenter', (e) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      profundidad++;
      if (aceptaSoltar()) raiz.classList.add('r2c-arrastrando');
    });
    escuchar(doc, 'dragover', (e) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = aceptaSoltar() ? 'copy' : 'none';
    });
    escuchar(doc, 'dragleave', (e) => {
      if (!conArchivos(e)) return;
      profundidad = Math.max(0, profundidad - 1);
      if (profundidad === 0) raiz.classList.remove('r2c-arrastrando');
    });
    escuchar(doc, 'drop', (e) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      profundidad = 0;
      raiz.classList.remove('r2c-arrastrando');
      if (!aceptaSoltar()) return;
      const dt = e.dataTransfer;
      const archivos = dt.files ? Array.prototype.slice.call(dt.files) : [];
      const elementos = dt.items ? Array.prototype.filter.call(dt.items, (it) => it.kind === 'file') : [];
      const n = Math.max(archivos.length, elementos.length);

      if (n > 1) {
        v.avisoSoltar(`Ha soltado ${n} archivos. Suelte solo un CSV de intervenciones o elíjalo con «Elegir archivo…».`);
        return;
      }

      const carpeta = elementos.some((it) => {
        try {
          const entrada = typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null;
          return !!entrada && entrada.isDirectory === true;
        } catch (err) { return false; }
      });
      if (carpeta) {
        v.avisoSoltar('Ha soltado una carpeta. Suelte el archivo CSV de intervenciones que contiene o elíjalo con «Elegir archivo…».');
        return;
      }
      if (archivos[0]) llamar('alElegir', archivos[0]);
    });




    v.abrirSelector = () => { entrada.click(); };

    v.mostrarAbrir = (o = {}) => {
      mostrar('abrir');
      $('sub').textContent = 'Sin corpus cargado';
      if (o.entrada !== undefined) $('abrir-entrada').textContent = o.entrada || entradaPorDefecto;
      const nota = $('nota');
      nota.textContent = o.nota || '';
      nota.hidden = !o.nota;
      const re = $('reintentar');
      re.hidden = !o.reintentar;
      re.textContent = o.reintentar ? `Reintentar con ${o.reintentar.name || 'el mismo archivo'}` : 'Reintentar';
      if (o.enfocar === 'reintentar' && o.reintentar) enfocar(re);
      else if (o.enfocar !== null) enfocar($('elegir'));
    };

    v.avisoSoltar = (texto) => {
      const a = $('aviso');
      a.textContent = '';
      a.textContent = texto || '';
      a.hidden = !texto;
    };

    v.estadoMotor = (texto) => {
      const el = $('motor');
      if (el.textContent !== (texto || '')) el.textContent = texto || '';
    };

    v.ponerMotor = (version) => {
      $('motor-v').textContent = `Motor: SQLite${version ? ` ${version}` : ''} (WebAssembly) · FTS5`;
    };

    v.mostrarConstruir = (o = {}) => {
      mostrar('construir');
      indiceAnunciado = 0;
      pctAnunciado = -1;
      const f = ficha(o.archivo);
      $('constr-ficha').textContent = f;
      $('sub').textContent = f;
      const mem = P().memoriaEstimada(o.archivo ? o.archivo.size : 0);
      $('memoria').textContent = `Memoria necesaria: unos ${P().miles(mem.min)}–${P().miles(mem.max)} MB`;
      if (o.sqlite) v.ponerMotor(o.sqlite);
      const ol = $('fases');
      ol.textContent = '';
      P().FASES.forEach((fase, i) => {
        const li = doc.createElement('li');
        li.className = 'r2c-fase';
        li.dataset.fase = fase.id;
        li.dataset.estado = 'espera';
        li.innerHTML = '<span class="r2c-icono" aria-hidden="true">○</span><span class="r2c-et"><span class="r2c-et-t"></span><span class="r2c-oculto r2c-et-sr"></span><span class="r2c-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></span></span><span class="r2c-n">—</span>';
        li.querySelector('.r2c-et-t').textContent = fase.etiqueta;
        li.querySelector('.r2c-et-sr').textContent = ` (${ESTADO_SR.espera})`;
        li.querySelector('.r2c-barra').setAttribute('aria-label', `${fase.etiqueta}, fase ${i + 1} de ${P().FASES.length}`);
        ol.appendChild(li);
      });
      const total = $('total');
      total.querySelector('i').style.width = '0%';
      total.setAttribute('aria-valuenow', '0');
      $('pct').textContent = P().porcentaje(0);
      $('eta').textContent = P().textoEta(null);
      $('nota-cancelar').hidden = true;
      $('cancelar').removeAttribute('aria-describedby');
      $('cancelar').textContent = o.textoCancelar || 'Cancelar';
      $('constr-entrada').textContent = o.entrada || ENTRADA_CONSTRUIR;
      $('anuncio').textContent = '';
      enfocar(raiz.querySelector('#r2c-constr-t'));
    };


    v.notaConstruir = (texto) => {
      if (v.seccion !== 'construir') return;
      $('eta').textContent = texto || '';
      $('anuncio').textContent = texto || '';
    };





    v.mostrarRecordado = (o = {}) => {
      mostrar('recordado');
      $('sub').textContent = o.ficha || 'Base recordada';
      $('rec-ficha').textContent = o.ficha || '';
      $('rec-titulo').textContent = o.titulo || 'Abriendo la base recordada…';
      $('rec-entrada').textContent = o.entrada || (conDatos
        ? 'Esta base se guardó en este navegador: se abre sin descargarla ni prepararla de nuevo.'
        : 'Esta base se guardó en este navegador: se abre sin volver a elegir el CSV.');
      $('rec-cancelar').textContent = o.textoCancelar || 'Cancelar y elegir otro CSV';
      $('rec-cancelar').hidden = o.cancelar === false;
      const barra = $('rec-barra');
      barra.querySelector('i').style.width = '0%';
      barra.setAttribute('aria-valuenow', '0');
      barra.removeAttribute('aria-valuetext');
      $('rec-pct').textContent = P().porcentaje(0);
      $('rec-estado').textContent = 'Leyendo la base guardada…';
      $('rec-anuncio').textContent = '';
      recAnunciado = -1;
      enfocar(raiz.querySelector('#r2c-rec-t'));
    };

    let recAnunciado = -1;
    v.progresoRecordado = (hecho, total, texto) => {
      if (v.seccion !== 'recordado') return;
      const f = total > 0 ? Math.max(0, Math.min(1, hecho / total)) : 0;
      const barra = $('rec-barra');
      barra.querySelector('i').style.width = `${(f * 100).toFixed(1)}%`;
      barra.setAttribute('aria-valuenow', String(Math.floor(f * 100)));
      const t = texto || (total > 0 ? `${P().tamano(hecho)} de ${P().tamano(total)}` : 'Leyendo la base guardada…');
      barra.setAttribute('aria-valuetext', `${P().porcentaje(f)} · ${t}`);
      $('rec-pct').textContent = P().porcentaje(f);
      $('rec-estado').textContent = t;

      if (Math.floor(f * 2) > recAnunciado && f < 1) {
        recAnunciado = Math.floor(f * 2);
        $('rec-anuncio').textContent = `${P().porcentaje(f)} de la base recordada leído.`;
      }
    };






    v.mostrarEspera = (o = {}) => {
      mostrar('espera');
      $('sub').textContent = o.ficha || '';
      $('esp-titulo').textContent = o.titulo || 'Preparando el corpus…';
      $('esp-nota').textContent = o.nota || '';
      const barra = $('esp-barra');
      barra.classList.add('indet');
      barra.querySelector('i').style.width = '';
      barra.removeAttribute('aria-valuenow');
      barra.removeAttribute('aria-valuetext');
      $('esp-anuncio').textContent = '';
      espAnunciado = -1;
      enfocar(raiz.querySelector('#r2c-esp-t'));
    };

    let espAnunciado = -1;

    v.progresoEspera = (fraccion, nota) => {
      if (v.seccion !== 'espera') return;
      const barra = $('esp-barra');
      if (fraccion == null) {
        barra.classList.add('indet');
        barra.querySelector('i').style.width = '';
        barra.removeAttribute('aria-valuenow');
      } else {
        const f = Math.max(0, Math.min(1, fraccion));
        barra.classList.remove('indet');
        barra.querySelector('i').style.width = `${(f * 100).toFixed(1)}%`;
        barra.setAttribute('aria-valuenow', String(Math.floor(f * 100)));
        barra.setAttribute('aria-valuetext', `${P().porcentaje(f)}${nota ? ` · ${nota}` : ''}`);

        if (Math.floor(f * 4) > espAnunciado && f < 1) {
          espAnunciado = Math.floor(f * 4);
          $('esp-anuncio').textContent = `${P().porcentaje(f)} del corpus preparado.`;
        }
      }
      if (nota !== undefined) $('esp-nota').textContent = nota || '';
    };

    v.pintarProgreso = (est) => {
      if (v.seccion === 'espera' && est) {
        v.progresoEspera(est.fraccion, P().textoEta(est.etaMs));
        return;
      }
      if (v.seccion !== 'construir' || !est) return;
      for (const f of est.fases) {
        const li = raiz.querySelector(`.r2c-fase[data-fase="${f.id}"]`);
        if (!li) continue;
        // La etiqueta puede cambiar durante la construcción («Cargando las expresiones ya calculadas»).
        const et = li.querySelector('.r2c-et-t');
        if (f.etiqueta && et.textContent !== f.etiqueta) {
          et.textContent = f.etiqueta;
          li.querySelector('.r2c-barra').setAttribute('aria-label', `${f.etiqueta}, fase ${f.indice} de ${est.fases.length}`);
        }
        if (li.dataset.estado !== f.estado) {
          li.dataset.estado = f.estado;
          li.querySelector('.r2c-icono').textContent = ICONOS[f.estado];
          li.querySelector('.r2c-et-sr').textContent = ` (${ESTADO_SR[f.estado]})`;
        }
        const barra = li.querySelector('.r2c-barra');
        const n = li.querySelector('.r2c-n');
        if (f.estado === 'activa') {
          const conTotal = f.total != null && f.total > 0;
          barra.classList.toggle('indet', !conTotal);
          if (conTotal) {
            const pct = Math.floor(f.fraccion * 100);
            barra.querySelector('i').style.width = `${Math.min(100, f.fraccion * 100).toFixed(1)}%`;
            barra.setAttribute('aria-valuenow', String(pct));
            n.textContent = P().porcentaje(f.fraccion);
          } else {
            barra.querySelector('i').style.width = '';
            barra.removeAttribute('aria-valuenow');
            n.textContent = f.hecho ? P().miles(f.hecho) : '…';
          }
        } else if (f.estado === 'hecha') {
          n.textContent = P().duracion(f.duracionMs);
        } else {
          n.textContent = '—';
        }
      }
      const pct = Math.floor(est.fraccion * 100);
      const total = $('total');
      total.querySelector('i').style.width = `${Math.min(100, est.fraccion * 100).toFixed(1)}%`;
      total.setAttribute('aria-valuenow', String(pct));
      const eta = P().textoEta(est.etaMs);
      total.setAttribute('aria-valuetext', `${P().porcentaje(est.fraccion)} · ${eta}`);
      $('pct').textContent = P().porcentaje(est.fraccion);
      $('eta').textContent = eta;


      const activa = est.activa;
      const anuncio = $('anuncio');
      if (activa && activa.indice > indiceAnunciado) {
        indiceAnunciado = activa.indice;
        anuncio.textContent = `Fase ${activa.indice} de ${est.fases.length}: ${activa.etiqueta}.`;
      } else if (Math.floor(pct / 25) > Math.floor(pctAnunciado / 25) && pct < 100) {
        anuncio.textContent = `${P().porcentaje(est.fraccion)} completado. ${eta}.`;
      }
      if (Math.floor(pct / 25) !== Math.floor(pctAnunciado / 25)) pctAnunciado = pct;

      const nota = $('nota-cancelar');
      if (est.faseLarga && activa) {
        const totalEstimado = est.etaMs != null ? est.transcurridoMs + est.etaMs : null;
        const texto = `«${activa.etiqueta}» está tardando. Si cancela, se descarta lo construido y habrá que volver a construir el corpus desde el principio${totalEstimado ? ` (unos ${P().duracion(totalEstimado)})` : ''}.`;
        if (nota.textContent !== texto) nota.textContent = texto;
        if (nota.hidden) {
          nota.hidden = false;
          $('cancelar').setAttribute('aria-describedby', 'r2c-nota-cancelar');
        }
      } else if (!nota.hidden) {
        nota.hidden = true;
        $('cancelar').removeAttribute('aria-describedby');
      }
    };

    v.mostrarFallo = (error, o = {}) => {
      const err = error || {};
      mostrar('fallo');
      const f = ficha(o.archivo);
      $('fallo-ficha').textContent = f;
      $('fallo-ficha').hidden = !f;
      $('fallo-titulo').textContent = o.titulo || TITULOS_FALLO[err.codigo] || 'No se pudo construir el corpus';
      $('sub').textContent = f || 'Sin corpus cargado';
      const donde = R2.rpc ? R2.rpc.ubicacion(err) : '';
      $('fallo-donde').textContent = donde;
      $('fallo-donde').hidden = !donde;
      $('fallo-donde-t').hidden = !donde;
      $('fallo-codigo').textContent = err.codigo || 'ERROR_INTERNO';
      $('fallo-codigo').dataset.codigo = err.codigo || 'ERROR_INTERNO';

      $('fallo-mensaje').textContent = '';
      $('fallo-mensaje').textContent = err.message || err.mensaje || 'Error desconocido.';
      $('otro').hidden = !o.otro;
      $('otro').textContent = o.textoOtro || 'Elegir otro archivo';
      $('fallo-reintentar').hidden = !o.reintentar;
      $('fallo-reintentar').textContent = o.reintentar && o.archivo ? `Reintentar con ${o.archivo.name || 'el mismo archivo'}` : 'Reintentar';
      $('recargar').hidden = !o.recargar;
      $('fallo-dataverse').hidden = !o.otro;

      const w = doc.defaultView || {};
      let direccion = '';
      if (o.ayudaNavegador && w.location) {
        try { direccion = decodeURI(String(w.location.href)); } catch (e) { direccion = String(w.location.href); }
      }
      $('fallo-ayuda').hidden = !o.ayudaNavegador;
      $('fallo-direccion').textContent = direccion;
      $('fallo-direccion').hidden = !direccion;
      const puedeCopiar = !!direccion && !!w.navigator && !!w.navigator.clipboard && typeof w.navigator.clipboard.writeText === 'function';
      $('copiar').hidden = !puedeCopiar;
      $('copiar').textContent = 'Copiar la dirección';
      enfocar([$('otro'), $('fallo-reintentar'), $('recargar'), $('copiar')].find((b) => !b.hidden) || raiz.querySelector('#r2c-fallo-t'));
    };

    v.mostrarConfirmar = (informe, archivo, o = {}) => {
      mostrar('confirmar');
      $('conf-otro').textContent = o.textoOtro || 'Elegir otro archivo';
      const f = ficha(archivo);
      $('conf-ficha').textContent = f;
      $('sub').textContent = f;
      const ul = $('conf-avisos');
      ul.textContent = '';
      for (const a of (informe && informe.avisos) || []) {
        const li = doc.createElement('li');
        li.dataset.codigo = a.codigo;
        li.textContent = a.mensaje;
        ul.appendChild(li);
      }
      enfocar($('continuar'));
    };

    v.ponerReferencia = (ref) => {
      const r = ref || {};
      const pub = r.publicado;
      if (pub && pub.bytes) {
        $('ficha').textContent = `o elija el archivo · ${P().tamano(pub.bytes)}${pub.filas ? ` · ${P().miles(pub.filas)} filas` : ''} · separador «,»`;
      }
      if (Array.isArray(r.paises) && r.paises.length) {
        $('ficha').textContent = `o elija el archivo · separador «,» · UTF-8 · países disponibles: ${r.paises.join(', ')}`;
      }
      const url = r.fuente && r.fuente.url;
      if (url && /^https:\/\//.test(url)) {
        $('dataverse').href = url;
        $('fallo-dataverse').href = url;
      }
      if (r.fuente && r.fuente.cita) {
        const lic = r.fuente.licencia_nombre || r.fuente.licencia;
        textoConCodigo($('cita-texto'), `${r.fuente.cita}${lic && !String(r.fuente.cita).includes(lic) ? ` · ${lic}` : ''}`);
        $('cita').hidden = false;
      }
    };

    v.ponerAvisos = (a) => {
      if (!a) return;
      if (a.almacen) {
        $('almacen-t').textContent = a.almacen.texto;
        $('almacen').dataset.tipo = a.almacen.tipo;
      }
      $('memoria-aviso').hidden = !a.memoria;
      $('memoria-aviso-t').textContent = a.memoria || '';
    };

    v.destruir = () => {
      for (const [el, tipo, fn, op] of escuchas) el.removeEventListener(tipo, fn, op);
      escuchas.length = 0;
      raiz.remove();
      v.seccion = null;
    };

    return v;
  }

  R2.carga = { crear, URL_PARLAIBERO };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/carga.js






















(function (R2) {
  'use strict';

  const ID = 'r2-sobre';
  const EVENTO = 'r2:sobre-corpus';

  const NOTA = () => 'El corpus existe solo en esta pestaña: si la cierra o la recarga, habrá que volver a elegir el CSV (salvo que la base se haya recordado en este navegador).';
  const P = () => R2.progreso;
  let montado = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function modelo(e) {
    const inf = e && e.informe;
    if (!inf) return null;
    const version = null;
    const corr = null;
    const pais = inf.pais_nombre || (inf.pais ? `país ${inf.pais}` : null);
    let estado, textoEstado;
    if (e.huella === 'fallida') {
      estado = 'fallida';
      const causa = e.errorHuella && (e.errorHuella.mensaje || e.errorHuella.message);
      textoEstado = `No se pudo comprobar la huella: ${causa || 'error desconocido'}`;
    } else if (e.huella === 'pendiente') {
      estado = 'pendiente';
      textoEstado = `CSV de ${pais || 'un país'} elegido en este equipo. Comprobando la huella…`;
    } else if (inf.dataset && inf.dataset.titulo) {
      estado = 'publicado';
      textoEstado = `${inf.dataset.titulo}${inf.dataset.version ? ` (${inf.dataset.version})` : ''}, Harvard Dataverse: CSV elegido en este equipo (${P().miles(inf.n_sesiones || 0)} sesiones).`;
    } else {
      estado = 'sin_referencia';
      textoEstado = `CSV de ${pais || 'un país'} elegido en este equipo (${P().miles(inf.n_sesiones || 0)} sesiones).`;
    }
    const h = inf.huella || {};
    const t = inf.tiempos || {};
    return {
      estado,
      textoEstado,
      archivo: `${h.nombre || 'archivo sin nombre'} · ${P().tamano(h.bytes)} (${P().miles(h.bytes)} bytes)`,
      version: version && version.etiqueta ? version.etiqueta : null,

      correcciones: corr && corr.filas_corregidas > 0 && corr.mensaje ? corr.mensaje : null,
      sha256: h.sha256 || null,
      textoSha256: h.sha256 || (e.huella === 'fallida' ? '—' : 'Comprobando la huella…'),
      filas: P().miles(inf.n_filas),
      construccion: `${P().duracion(t.hasta_listo)} en este navegador${inf.detalles && inf.detalles.sqlite ? ` (SQLite ${inf.detalles.sqlite})` : ''}`,
      lectura: e.modoLectura === 'principal'
        ? 'Desde la página: este navegador no deja leer el archivo al proceso de fondo cuando la página se abre como archivo.'
        : null,
      avisos: (inf.avisos || []).map((a) => ({ codigo: a.codigo, mensaje: a.mensaje })),
    };
  }


  function modeloDeInfo(info) {
    const s = info && info.standalone;
    if (!s) return null;
    return modelo({
      informe: { n_filas: s.n_filas, n_sesiones: s.n_sesiones, pais: s.pais, pais_nombre: s.pais_nombre, dataset: s.dataset || null, publicado: s.publicado,
        version_csv: s.version_csv, correcciones_fechas: s.correcciones_fechas,
        avisos: s.avisos, huella: s.archivo, tiempos: s.tiempos, detalles: { sqlite: s.sqlite } },
      huella: s.huella, errorHuella: s.fallo_huella, modoLectura: s.modo_lectura, referencia: s.referencia,
    });
  }

  function datosHtml(m) {
    const fila = (dt, dd, codigo) => `<dt>${esc(dt)}</dt><dd>${codigo ? `<code>${esc(dd)}</code>` : esc(dd)}</dd>`;
    return fila('Archivo', m.archivo) + (m.version ? fila('Versión', m.version) : '')
      + fila('Huella SHA-256', m.textoSha256, !!m.sha256) + fila('Intervenciones', m.filas)
      + (m.correcciones ? fila('Correcciones', m.correcciones) : '')
      + fila('Construido', m.construccion) + (m.lectura ? fila('Lectura', m.lectura) : '');
  }
  const avisosHtml = (m) => m.avisos.map((a) => `<li data-codigo="${esc(a.codigo)}">${esc(a.mensaje)}</li>`).join('');

  function bloqueHtml(m) {
    const web = R2.web && typeof R2.web.htmlSobre === 'function' ? R2.web.htmlSobre() : '';
    return `<div id="${ID}" class="r2s"><div class="fuente-k">Este archivo</div>`
      + `<p class="r2s-estado" data-estado="${esc(m.estado)}" aria-live="polite">${esc(m.textoEstado)}</p>`
      + `<dl class="r2s-datos">${datosHtml(m)}</dl>`
      + `<ul class="r2s-avisos" aria-label="Avisos sobre el archivo"${m.avisos.length ? '' : ' hidden'}>${avisosHtml(m)}</ul>`
      + (web ? web : '')
      + `<p class="dsub r2s-nota"${web ? ' hidden' : ''}>${esc(NOTA())}</p></div>`;
  }

  function html(info) {
    const i = info || {};
    const cuentas = `<p class="dsub r2s-cuentas">${esc(P().miles(i.n_speeches || 0))} intervenciones · ${esc(P().miles(i.n_sessions || 0))} sesiones</p>`;
    const vivo = montado ? modelo(montado.obtener()) : null;
    const m = vivo || modeloDeInfo(i);
    return m ? cuentas + bloqueHtml(m) : cuentas;
  }


  function pintar(nodo, m) {
    const estado = nodo.querySelector('.r2s-estado');
    if (estado.textContent !== m.textoEstado) estado.textContent = m.textoEstado;
    estado.dataset.estado = m.estado;
    nodo.querySelector('.r2s-datos').innerHTML = datosHtml(m);
    const ul = nodo.querySelector('.r2s-avisos');
    ul.innerHTML = avisosHtml(m);
    ul.hidden = m.avisos.length === 0;
  }

  function montar(opciones) {
    const doc = opciones.documento;
    const obtener = opciones.obtenerEstado;
    const w = doc.defaultView || {};
    let observador = null;

    function actualizar() {
      const m = modelo(obtener());
      if (!m) return false;
      let nodo = doc.getElementById(ID);
      if (!nodo) {
        const fb = doc.querySelector('#fg-fuente .fbody');
        if (!fb) return false;
        const t = doc.createElement('template');
        t.innerHTML = bloqueHtml(m);
        nodo = t.content.firstElementChild;
        fb.appendChild(nodo);
        return true;
      }
      pintar(nodo, m);
      return true;
    }

    function abrir() {
      try { if (typeof w.toExplore === 'function') w.toExplore(); } catch (e) {   }
      const app = doc.getElementById('app');
      try {
        if (app && app.classList.contains('side-collapsed') && typeof w.setSideCollapsed === 'function') w.setSideCollapsed(false);
      } catch (e) {   }
      const d = doc.getElementById('fg-fuente');
      if (!d) return false;
      d.open = true;
      actualizar();
      try { d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { d.scrollIntoView(); }
      const s = d.querySelector('summary');
      if (s) { try { s.focus({ preventScroll: true }); } catch (e) { s.focus(); } }
      return true;
    }

    const alEvento = () => abrir();
    doc.addEventListener(EVENTO, alEvento);

    const destino = doc.getElementById('filters');
    if (typeof w.MutationObserver === 'function') {
      observador = new w.MutationObserver(() => {
        if (doc.querySelector('#fg-fuente .fbody') && !doc.getElementById(ID)) actualizar();
      });
      observador.observe(destino || doc.body, destino ? { childList: true } : { childList: true, subtree: true });
    }
    const control = {
      obtener,
      actualizar,
      abrir,
      desmontar() {
        if (observador) observador.disconnect();
        doc.removeEventListener(EVENTO, alEvento);
        if (montado === control) montado = null;
      },
    };
    montado = control;
    actualizar();
    return control;
  }

  R2.sobreCorpus = { ID, EVENTO, modelo, html, montar };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/sobre_corpus.js






































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






































(function (R2) {
  'use strict';

  const CLAVE_AUTO = 'diarios-explorer:v1:recordar-corpus';
  const MIB = 1048576;
  const ESPERA_CERROJO_MS = 20000;
  const TEXTO_FIREFOX = 'En Firefox, la base recordada depende de dónde esté este archivo: si lo mueve o le cambia el nombre, no la encontrará.';
  const S = {
    g: null, doc: null, api: null, web: false, modo: null, detalle: {}, detectando: null, local: null,
    auto: true, consulta: null, consultando: null, operacion: null, mensaje: '', error: false, progreso: null,
    pendienteRecordar: null, origen: null, raizCarga: null, autoIntentado: false, espacio: null, persistente: null,
    reemplazo: null, bitacora: [], metricas: {}, gecko: false, archivoLocal: false, dlg: null, entrada: null,
    sw: { estado: 'sin_service_worker', version: null, copia: null, nueva: false, pedida: false, error: null, registro: null },
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mib = (b) => `${new Intl.NumberFormat('es-ES').format(Math.round((b || 0) / MIB))} MiB`;
  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const textoDe = (e) => (e && e.name && e.message ? `${e.name}: ${e.message}` : String(e && e.message ? e.message : e));
  function fecha(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} a las ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function conTiempo(promesa, ms) {
    let t = null;
    return Promise.race([promesa, new Promise((_, rechazar) => { t = setTimeout(() => rechazar(new Error(`sin respuesta en ${ms} ms`)), ms); })])
      .finally(() => clearTimeout(t));
  }


  const CSS = `
.r2w{margin:14px 0 0;padding:11px 13px;border:1px solid var(--border-soft);border-radius:8px;background:var(--bg-sunken);font-size:12.5px;line-height:1.5}
.r2w-t{margin:0 0 4px;font-weight:600}
.r2w-ficha{margin:0 0 6px}
.r2w .r2c-botones{margin:6px 0 2px}
.r2w-auto{display:flex;gap:7px;align-items:flex-start;margin:6px 0 0;cursor:pointer}
.r2w-auto input{margin-top:3px}
.r2w-nota{margin:6px 0 0;color:var(--text-soft)}
.r2w-msg{margin:6px 0 0}
.r2w-msg[data-error="1"]{color:var(--danger)}
.r2w-sobre{margin:8px 0 0}
.r2w-sobre p{margin:0 0 6px;font-size:11px;line-height:1.5}
.r2w-sobre .r2w-auto{font-size:11px;margin:0 0 6px}
.r2w-sobre .btn{margin:0 6px 6px 0}
#r2-web-dlg .ddel-txt:last-child{margin-bottom:0}
#r2-web-version{position:fixed;left:16px;bottom:16px;z-index:60;display:flex;gap:10px;align-items:center;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-elev,var(--bg));color:var(--text);box-shadow:0 4px 18px rgba(0,0,0,.18);font-size:13px}
`;


  function disponible(g) {
    const w = g || globalThis;
    const loc = w.location || {};
    const nav = w.navigator || {};
    return (loc.protocol === 'https:' || loc.protocol === 'http:') && !!w.isSecureContext
      && !!(nav.storage && typeof nav.storage.getDirectory === 'function');
  }

  const modoOk = () => S.modo === 'opfs' || S.modo === 'idb';
  const recordado = () => (S.consulta && S.consulta.recordado) || null;
  const buildId = () => (R2.datos && R2.datos.edicion && R2.datos.edicion.build_id) || '';
  const fase = () => (S.api && S.api.fase ? S.api.fase() : null);
  function cliente() { return S.api && S.api.cliente ? S.api.cliente() : null; }


  function corpusRecordado() {
    const r = recordado();
    const inf = S.api && S.api.informe ? S.api.informe() : null;
    return !!(r && inf && inf.huella && inf.huella.sha256 && inf.huella.sha256 === r.csv_sha256);
  }

  function bitacora(evento, datos) {
    S.bitacora.push({ t: Math.round(ahora()), evento, datos: datos === undefined ? null : datos });
    if (S.bitacora.length > 100) S.bitacora.shift();
  }


  function describir(r, conBytes = true) {
    if (!r) return '';
    const v = r.version && r.version.corto ? ` (${r.version.corto})` : '';
    return `«${r.nombre_csv || 'CSV'}»${v}${conBytes ? ` · ${mib(r.bytes)}` : ''}`;
  }



  const conDatos = () => !!(R2.arranque && typeof R2.arranque.datosPropios === 'function' && R2.arranque.datosPropios());

  function sinBaseTexto(prefijo) {
    const p = conDatos() ? (R2.arranque.datosPropios().tipo === 'servido'
      ? 'el corpus se descargará de nuevo en cada visita' : 'el corpus se volverá a preparar desde los datos incluidos en cada visita')
      : 'tendrá que elegir el CSV en cada visita';
    return prefijo ? `${prefijo}: ${p}.` : p;
  }
  const sinElegirCsv = () => (conDatos() ? 'sin descargarla ni prepararla de nuevo' : 'sin elegir el CSV');

  function textoSinAlmacen() {
    return sinBaseTexto(S.archivoLocal
      ? 'Este navegador no permite guardar la base con la página abierta como archivo'
      : 'Este navegador no permite guardar la base');
  }

  function cerrojo(modo, fn, esperaMs, signal) {
    if (R2.baseLocal && typeof R2.baseLocal.conCerrojo === 'function') return R2.baseLocal.conCerrojo(S.g, modo, fn, { esperaMs, signal });
    return fn();
  }

  async function pedirOp(op, args, o = {}) {
    const c = o.cliente || cliente();
    if (!c) throw Object.assign(new Error('El motor de la página todavía no está listo.'), { codigo: 'ESTADO' });
    const r = await c.pedir(op, args || {}, { prioridad: o.prioridad || 'interactiva', signal: o.signal });
    if (r.status >= 400) {
      throw Object.assign(new Error((r.cuerpo && r.cuerpo.error) || `Error ${r.status}`), { codigo: r.cuerpo && r.cuerpo.codigo, status: r.status });
    }
    return r.cuerpo;
  }

  function avisar(texto, error) {
    S.mensaje = texto || '';
    S.error = !!error;
    pintar();
    if (texto && R2.anuncios) R2.anuncios.anunciar(texto, !!error);
  }


  async function probarLocal() {
    if (!R2.baseLocal || globalThis.R2_SIN_BASE_LOCAL) return false;
    if (!S.local) S.local = R2.baseLocal.crear({ ventana: S.g, buildId: buildId() });
    const p = await conTiempo(S.local.probar(), 4000).catch((e) => ({ ok: false, detalle: textoDe(e) }));
    if (!p.ok) S.detalle.idb = p.detalle;
    return !!p.ok;
  }

  async function detectar() {
    const nav = S.g.navigator || {};
    if (disponible(S.g)) {
      try {
        await conTiempo(Promise.resolve().then(() => nav.storage.getDirectory()), 3000);
        S.modo = 'opfs';
        return S.modo;
      } catch (e) {
        S.detalle.opfs = textoDe(e);
      }
    }
    S.modo = (await probarLocal()) ? 'idb' : 'ninguno';
    return S.modo;
  }

  function actualizarEspacio() {
    const st = S.g && S.g.navigator && S.g.navigator.storage;
    if (!st) return;
    try {
      if (typeof st.estimate === 'function') {
        Promise.resolve(st.estimate()).then((e) => { S.espacio = { usage: e.usage, quota: e.quota }; pintar(); }, () => {});
      }
      if (typeof st.persisted === 'function') Promise.resolve(st.persisted()).then((v) => { if (v) S.persistente = true; pintar(); }, () => {});
    } catch (e) {   }
  }


  function pedirPersistencia() {
    const st = S.g && S.g.navigator && S.g.navigator.storage;
    if (!st || typeof st.persist !== 'function' || S.persistente === true || S.persistenciaPedida) return;
    S.persistenciaPedida = true;
    try {
      Promise.resolve(st.persist()).then((v) => { S.persistente = !!v; bitacora('persist', !!v); pintar(); }, () => { S.persistente = false; });
    } catch (e) { S.persistente = false; }
  }


  function explicarLiberados(lib) {
    if (!lib) return;
    bitacora('liberados', { obsoletos: lib.obsoletos, danados: lib.danados, sobrantes: lib.sobrantes, bytes: lib.bytes });
    if (lib.obsoletos) {
      avisar(`La base recordada era de una versión anterior de Diarios Explorer y ya no sirve con esta: se ha borrado para liberar espacio (${mib(lib.bytes)}). Elija el CSV para volver a construirla.`);
    } else if (lib.danados) {
      avisar(`La base recordada estaba dañada o incompleta y se ha borrado (${mib(lib.bytes)}). Elija el CSV para volver a construirla.`, true);
    }
  }

  async function consultarAhora() {
    let r = await cerrojo('exclusive', () => (S.modo === 'opfs' ? pedirOp('corpus_recordado', { limpiar: true }) : S.local.estado({ limpiar: true })),
      ESPERA_CERROJO_MS);

    if (S.modo === 'opfs' && r && r.error && r.error.codigo === 'OPFS_NO_DISPONIBLE') {
      S.detalle.opfs = r.error.mensaje;
      if (await probarLocal()) {
        S.modo = 'idb';
        r = await cerrojo('exclusive', () => S.local.estado({ limpiar: true }), ESPERA_CERROJO_MS);
      } else {
        S.modo = 'ninguno';
        r = { disponible: false, recordado: null, otros: 0 };
      }
    }
    return r;
  }

  async function consultar() {
    if (S.detectando) await S.detectando;
    if (!modoOk()) {
      S.consulta = { disponible: false, recordado: null, otros: 0, error: null };
      pintar();
      return S.consulta;
    }
    if (S.modo === 'opfs' && !cliente()) return S.consulta;
    if (S.consultando) return S.consultando;
    S.consultando = (async () => {
      try {
        const r = await consultarAhora();
        S.consulta = r;
        explicarLiberados(r && r.liberados);
      } catch (e) {
        S.consulta = { disponible: true, recordado: null, otros: 0, error: { codigo: e.codigo || 'ALMACEN', mensaje: e.message } };
      }
      return S.consulta;
    })().finally(() => { S.consultando = null; pintar(); });
    return S.consultando;
  }

  async function recordar(o = {}) {
    if (!modoOk() || S.operacion === 'recordar') return;
    if (S.operacion) { S.pendienteRecordar = o; return; }
    if (!S.api || S.api.huella() !== 'comprobada') {
      S.pendienteRecordar = o;
      avisar('La base se guardará en cuanto termine la comprobación de la huella del CSV…');
      return;
    }
    S.pendienteRecordar = null;
    const anterior = recordado();
    S.operacion = 'recordar';
    S.progreso = null;
    pedirPersistencia();
    avisar('Guardando la base en este navegador…');
    bitacora('guardar_inicio', { anterior: anterior && anterior.nombre, reemplazo: !!o.reemplazo });
    const t0 = ahora();
    try {
      const r = await cerrojo('exclusive', () => (S.modo === 'opfs'
        ? pedirOp('recordar', null, { prioridad: 'fondo' })
        : S.local.guardar({ cliente: cliente(), alProgreso: (h, t) => progreso(h, t) })), 120000);
      S.consulta = Object.assign({}, S.consulta, { disponible: true, recordado: r.recordado, otros: 0, error: null });
      S.metricas.guardar = { ms: Math.round(ahora() - t0), bytes: r.recordado && r.recordado.bytes, almacen: S.modo, ya_recordado: !!r.ya_recordado };
      bitacora('guardada', { nombre: r.recordado && r.recordado.nombre, ya_recordado: !!r.ya_recordado });
      if (r.borrados && r.borrados.length) bitacora('borradas', { nombres: r.borrados, bytes: r.bytes_borrados || null });
      S.operacion = null;
      S.progreso = null;
      actualizarEspacio();
      const cambio = anterior && !r.ya_recordado && anterior.csv_sha256 !== (r.recordado && r.recordado.csv_sha256);
      let texto;
      if (o.reemplazo) {
        texto = r.ya_recordado
          ? 'El archivo elegido es la misma versión que ya estaba recordada: no ha cambiado nada.'
          : `Base reemplazada: ahora se recuerda ${describir(r.recordado)} y se ha borrado la anterior${anterior ? ` (${describir(anterior, false)})` : ''}. Sus bibliotecas siguen igual.`;
      } else if (r.ya_recordado) {
        texto = 'Esta base ya estaba recordada en este navegador.';
      } else {
        texto = `Base recordada en este navegador (${mib(r.recordado && r.recordado.bytes)}): la próxima vez se abrirá sola, ${sinElegirCsv()}.`
          + (cambio ? ` Sustituye a la que había (${describir(anterior, false)}).` : '');
      }
      avisar(texto);
    } catch (e) {
      S.operacion = null;
      S.progreso = null;
      bitacora('guardar_fallo', { codigo: e.codigo || null, mensaje: e.message });
      avisar(o.reemplazo
        ? `No se pudo guardar la base nueva: ${e.message} Se conserva la base recordada anterior; esta pestaña usa la nueva hasta que la cierre.`
        : `No se pudo recordar la base: ${e.message}`, true);
    }
    if (S.pendienteRecordar && !S.operacion) { const p = S.pendienteRecordar; S.pendienteRecordar = null; if (!corpusRecordado()) recordar(p); }
  }

  function progreso(hecho, total) {
    S.progreso = total > 0 ? Math.min(1, hecho / total) : null;
    const t = S.progreso == null ? '' : ` ${Math.floor(S.progreso * 100)} %`;
    if (!S.doc) return;
    for (const el of S.doc.querySelectorAll('[data-r2w="progreso"]')) el.textContent = t;
  }


  async function abrirEn(c, o = {}) {
    if (!modoOk()) throw Object.assign(new Error(textoSinAlmacen()), { codigo: 'NO_DISPONIBLE' });
    const t0 = ahora();
    S.operacion = 'abrir';
    pintar();
    bitacora('abrir_inicio', null);
    try {
      const r = await cerrojo(S.modo === 'opfs' ? 'exclusive' : 'shared', () => (S.modo === 'opfs'
        ? pedirOp('abrir_recordado', {}, { cliente: c, signal: o.signal })
        : S.local.abrir({ cliente: c, alProgreso: o.alProgreso, signal: o.signal })), 60000, o.signal);
      S.metricas.abrir = { ms: Math.round(ahora() - t0), bytes: r.recordado ? r.recordado.bytes : null, almacen: S.modo };
      if (r.recordado) S.consulta = Object.assign({}, S.consulta, { disponible: true, recordado: r.recordado, error: null });
      bitacora('abierta', { nombre: r.recordado && r.recordado.nombre, ms: S.metricas.abrir.ms });
      return r;
    } finally {
      S.operacion = null;
    }
  }





  async function abrirServidoEn(c, o = {}) {
    const t0 = ahora();
    S.operacion = 'servido';
    pintar();
    bitacora('servido_inicio', null);
    try {
      const base = new URL('./', (S.g.location || {}).href || '').href;
      const r = await pedirOp('abrir_servido', { base }, { cliente: c, signal: o.signal });
      S.metricas.servido = { ms: Math.round(ahora() - t0), bytes: r.servido ? r.servido.bytes : null };
      bitacora('servido_abierto', { ms: S.metricas.servido.ms });
      return r;
    } finally {
      S.operacion = null;
    }
  }

  function alFalloApertura(e) {
    bitacora('abrir_fallo', { codigo: e && e.codigo, mensaje: e && e.message });
    if (e && (e.codigo === 'RECORDADO_DANADO' || e.codigo === 'NO_RECORDADO')) {
      S.consulta = Object.assign({}, S.consulta, { recordado: null });
      consultar();
    }
    pintar();
  }

  function alCancelarApertura() {
    bitacora('abrir_cancelada', null);
    pintar();
  }

  async function abrir() {
    if (!modoOk() || S.operacion || !recordado() || !S.api || !S.api.abrirRecordado) return;
    S.autoIntentado = true;
    S.mensaje = '';
    S.error = false;
    try { await S.api.abrirRecordado({ recordado: recordado() }); } catch (e) {   }
  }

  async function olvidar(o = {}) {
    if (!modoOk() || S.operacion) return false;
    const r = recordado();
    const enApp = fase() === 'app';
    if (!o.sinConfirmar) {
      const parrafos = [
        r ? `Se borrará de este navegador la base guardada ${describir(r, false)} y se liberarán unos ${mib(r.bytes)}.`
          : 'Se borrará de este navegador lo que quede guardado de la base.',
        'Sus bibliotecas no se borran: siguen guardadas en este navegador.',
      ];
      if (enApp) parrafos.push(`Esta pestaña sigue funcionando con la base abierta hasta que la cierre o la recargue; después ${conDatos() ? sinBaseTexto('').replace(' en cada visita', ' al abrir la página') : 'habrá que volver a elegir el CSV'}.`);
      if (S.auto) parrafos.push(`${conDatos() ? 'La próxima vez que se abra el corpus' : 'La próxima vez que elija el CSV'} se volverá a recordar, salvo que desmarque «Recordar la base en este navegador».`);
      if (!(await confirmar({ titulo: '¿Olvidar la base recordada?', parrafos, si: 'Olvidar la base', peligro: true }))) return false;
    }
    S.operacion = 'olvidar';
    avisar('Olvidando la base…');
    try {
      const x = await cerrojo('exclusive', () => (S.modo === 'opfs' ? pedirOp('olvidar') : S.local.olvidar()), 60000);
      S.consulta = Object.assign({}, S.consulta, { recordado: null, otros: 0 });
      bitacora('olvidada', { bytes: x.bytes_borrados || 0 });
      S.operacion = null;
      actualizarEspacio();
      avisar(x.bytes_borrados
        ? `Base olvidada: se han liberado ${mib(x.bytes_borrados)} de este navegador. Sus bibliotecas siguen guardadas.${enApp ? ' Esta pestaña sigue usando la base hasta que la cierre o la recargue.' : ''}`
        : 'No había ninguna base recordada en este navegador.');
      return true;
    } catch (e) {
      S.operacion = null;
      avisar(`No se pudo olvidar la base: ${e.message}`, true);
      return false;
    }
  }


  function entradaArchivo() {
    if (S.entrada && S.entrada.isConnected) return S.entrada;
    const i = S.doc.createElement('input');
    i.type = 'file';
    i.accept = '.csv,text/csv';
    i.className = 'r2c-oculto';
    i.tabIndex = -1;
    i.setAttribute('aria-hidden', 'true');
    i.setAttribute('data-r2-web-archivo', '');
    i.addEventListener('change', () => {
      const f = i.files && i.files[0];
      i.value = '';
      if (f) reemplazarCon(f);
    });
    S.doc.body.appendChild(i);
    S.entrada = i;
    return i;
  }

  async function reemplazarCon(archivo) {
    if (!modoOk() || S.operacion || fase() !== 'app' || !S.api || !S.api.reemplazar) return;
    const ant = recordado();
    const P = R2.progreso;
    const tam = P && P.tamano ? P.tamano(archivo.size) : mib(archivo.size);
    const ok = await confirmar({
      titulo: '¿Reemplazar la base recordada?',
      parrafos: [
        ant ? `Ahora se recuerda: ${describir(ant)}.` : 'Ahora no hay ninguna base recordada.',
        `Nueva: «${archivo.name}» (${tam}).`,
        'Se construirá la base con el archivo nuevo. La anterior solo se borra cuando la nueva esté construida, comprobada y guardada; si algo falla, se vuelve a la anterior.',
        'Sus bibliotecas no se tocan. Mientras se construye, la interfaz queda en pausa.',
      ],
      si: 'Reemplazar',
    });
    if (!ok) return;
    let anteriorBorrada = false;
    const st = S.g.navigator && S.g.navigator.storage;
    let est = null;
    try { est = st && typeof st.estimate === 'function' ? await st.estimate() : null; } catch (e) { est = null; }
    if (ant && est && typeof est.quota === 'number' && est.quota > 0) {
      const libres = est.quota - (est.usage || 0);
      const hacen = ant.bytes + Math.max(32 * MIB, Math.min(128 * MIB, Math.ceil(ant.bytes / 2)));
      if (libres < hacen) {
        bitacora('reemplazo_sin_espacio', { libres, hacen });
        const borrar = await confirmar({
          titulo: 'No hay espacio para las dos bases',
          parrafos: [
            `Para reemplazarla sin riesgo, el navegador guarda la base nueva antes de borrar la anterior, y no hay espacio para las dos: hacen falta unos ${mib(hacen)} y quedan ${mib(Math.max(0, libres))}.`,
            'Puede borrar antes la base recordada y continuar. Si la nueva no llegara a construirse, tendría que volver a elegir un CSV.',
            'Sus bibliotecas no se tocan.',
          ],
          si: 'Borrar la anterior y continuar',
          peligro: true,
        });
        if (!borrar) { avisar('Reemplazo cancelado: la base recordada sigue igual.'); return; }
        if (!(await olvidar({ sinConfirmar: true }))) return;
        anteriorBorrada = true;
      }
    }
    S.reemplazo = { anterior: ant, anteriorBorrada, archivo: { nombre: archivo.name, bytes: archivo.size } };
    S.mensaje = '';
    S.error = false;
    bitacora('reemplazo_inicio', { anterior: ant && ant.nombre, anteriorBorrada, archivo: archivo.name });
    const empezado = await S.api.reemplazar(archivo, { anteriorBorrada });
    if (!empezado) S.reemplazo = null;
  }

  function alFinReemplazo(o = {}) {
    S.reemplazo = null;
    bitacora('reemplazo_fallido', { mensaje: o.mensaje || null });
    if (o.mensaje) { S.mensaje = o.mensaje; S.error = true; }
  }


  function dialogo() {
    if (S.dlg && S.dlg.isConnected) return S.dlg;
    const d = S.doc.createElement('dialog');
    d.id = 'r2-web-dlg';
    d.setAttribute('aria-labelledby', 'r2-web-dlg-t');
    d.setAttribute('aria-describedby', 'r2-web-dlg-c');
    d.innerHTML = '<div class="dhead"><h3 id="r2-web-dlg-t"></h3></div><div class="dbody" id="r2-web-dlg-c"></div>'
      + '<div class="dfoot"><button type="button" class="btn ghost" data-r2-dlg="no">Cancelar</button><button type="button" class="btn" data-r2-dlg="si"></button></div>';
    S.doc.body.appendChild(d);
    S.dlg = d;
    return d;
  }


  function confirmar(o) {
    const d = dialogo();
    if (d.open) return Promise.resolve(false);
    d.querySelector('#r2-web-dlg-t').textContent = o.titulo;
    const c = d.querySelector('#r2-web-dlg-c');
    c.textContent = '';
    for (const t of o.parrafos || []) {
      const p = S.doc.createElement('p');
      p.className = 'ddel-txt';
      p.textContent = t;
      c.appendChild(p);
    }
    const si = d.querySelector('[data-r2-dlg="si"]');
    const no = d.querySelector('[data-r2-dlg="no"]');
    si.textContent = o.si || 'Aceptar';
    si.className = o.peligro ? 'btn danger fill' : 'btn primary';
    const antes = S.doc.activeElement;
    d.dataset.tipo = o.si || '';
    return new Promise((resolver) => {
      const fin = (v) => {
        si.removeEventListener('click', alSi);
        no.removeEventListener('click', alNo);
        d.removeEventListener('cancel', alEsc);
        if (d.open) d.close();
        if (antes && antes.isConnected && typeof antes.focus === 'function') { try { antes.focus(); } catch (e) {   } }
        resolver(v);
      };
      const alSi = () => fin(true);
      const alNo = () => fin(false);
      const alEsc = (ev) => { ev.preventDefault(); fin(false); };
      si.addEventListener('click', alSi);
      no.addEventListener('click', alNo);
      d.addEventListener('cancel', alEsc);
      try { d.showModal(); } catch (e) { resolver(false); return; }
      no.focus();
    });
  }


  const btn = (que, texto, o = {}) => `<button type="button" class="btn${o.clase ? ` ${o.clase}` : ''}" data-r2-web="${que}"${o.off ? ' disabled' : ''}>${esc(texto)}</button>`;
  const casilla = () => `<label class="r2w-auto"><input type="checkbox" data-r2-web="auto"${S.auto ? ' checked' : ''}><span>Recordar la base en este navegador: al volver, se abrirá sola ${sinElegirCsv()}.</span></label>`;
  const mensajeHtml = () => `<p class="r2w-msg" role="status" data-error="${S.error ? 1 : 0}"${S.mensaje ? '' : ' hidden'}>${esc(S.mensaje)}</p>`;

  function htmlCarga() {
    const c = S.consulta;
    const r = recordado();
    const ocupado = !!S.operacion || (S.modo === 'opfs' && !cliente());
    let h = '<p class="r2w-t">Base recordada en este navegador</p>';
    if (!S.modo) h += '<p class="r2w-ficha">Comprobando si este navegador puede guardar la base…</p>';
    else if (S.modo === 'ninguno') h += `<p class="r2w-ficha">${esc(textoSinAlmacen())}</p>`;
    else if (!c) h += '<p class="r2w-ficha">Comprobando si hay una base recordada…</p>';
    else if (c.error) {
      h += `<p class="r2w-ficha">${esc(c.error.mensaje)}</p><div class="r2c-botones">${btn('consultar', 'Volver a comprobar', { off: ocupado })}</div>`;
    } else if (r) {
      h += `<p class="r2w-ficha">${esc(describir(r))}${r.guardado ? ` · guardada el ${esc(fecha(r.guardado))}` : ''}</p>`
        + `<div class="r2c-botones">${btn('abrir', 'Abrir la base recordada', { clase: 'primary', off: ocupado })}${btn('olvidar', 'Olvidar la base', { off: ocupado })}</div>`
        + '<p class="r2w-nota">Si elige otro CSV, su base sustituirá a esta cuando esté construida y guardada; si algo falla, esta se conserva.</p>';
    } else {
      h += `<p class="r2w-ficha">${S.auto ? `Ninguna todavía: ${conDatos() ? 'en cuanto se abra el corpus' : 'cuando elija el CSV'}, la base se guardará aquí y la próxima vez se abrirá sola.` : 'Ninguna.'}</p>`;
    }
    if (modoOk() && !(c && c.error)) h += casilla();
    if (modoOk() && S.gecko && S.archivoLocal) h += `<p class="r2w-nota">${esc(TEXTO_FIREFOX)}</p>`;
    return h + mensajeHtml();
  }

  function htmlSobre() {
    const c = S.consulta;
    const r = recordado();
    const ocupado = !!S.operacion;
    let h = '<div id="r2-web-sobre" class="r2w-sobre"><div class="fuente-k">En este navegador</div>';
    if (!S.modo) h += '<p>Comprobando si este navegador puede guardar la base…</p>';
    else if (S.modo === 'ninguno') h += `<p>${esc(textoSinAlmacen())}</p>`;
    else if (c && c.error) h += `<p>${esc(c.error.mensaje)}</p>${btn('consultar', 'Volver a comprobar', { clase: 'sm', off: ocupado })}`;
    else if (corpusRecordado()) {
      h += `<p>Esta base está recordada en este navegador (${esc(describir(r))}): al volver, se abrirá sola ${sinElegirCsv()}.</p>`
        + btn('reemplazar', 'Reemplazar por otra versión…', { clase: 'sm', off: ocupado }) + btn('olvidar', 'Olvidar la base', { clase: 'sm', off: ocupado });
    } else {
      if (S.operacion === 'recordar') h += '<p>Guardando la base en este navegador…<span data-r2w="progreso"></span></p>';
      else if (S.pendienteRecordar) h += '<p>La base se guardará en cuanto termine la comprobación de la huella del CSV…</p>';
      else {
        const huella = S.api && S.api.huella ? S.api.huella() : null;
        h += `<p>Esta base no está recordada: si cierra o recarga la pestaña, ${conDatos() ? sinBaseTexto('').replace(' en cada visita', '') : 'habrá que volver a elegir el CSV'}.</p>`
          + btn('recordar', 'Recordar la base en este navegador', { clase: 'sm', off: ocupado || huella === 'fallida' });
      }
      if (r) h += `<p>Hay otra base recordada: ${esc(describir(r))}.</p>${btn('olvidar', 'Olvidar la base recordada', { clase: 'sm', off: ocupado })}`;
    }
    if (modoOk()) {
      if (S.espacio && typeof S.espacio.usage === 'number') {
        const donde = S.modo === 'opfs' ? 'almacenamiento privado del navegador, OPFS' : 'IndexedDB';
        h += `<p>Espacio que ocupa en este navegador: ${esc(mib(S.espacio.usage))} (${donde}; incluye sus bibliotecas).`
          + (S.persistente === true ? ' El navegador no lo borrará aunque le falte espacio.' : '') + '</p>';
      }
      h += casilla();
      if (S.gecko && S.archivoLocal) h += `<p>${esc(TEXTO_FIREFOX)}</p>`;
    }
    return `${h}${mensajeHtml()}</div>`;
  }


  function conFoco(contenedor, fn) {
    const a = S.doc.activeElement;
    const k = a && contenedor.contains(a) && a.getAttribute ? a.getAttribute('data-r2-web') : null;
    fn();
    if (k) {
      const n = S.doc.querySelector(`[data-r2-web="${k}"]`);
      if (n && !n.disabled) { try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
    }
  }

  function pintar() {
    if (!S.doc) return;
    const caja = S.raizCarga && S.raizCarga.isConnected ? S.raizCarga.querySelector('[data-r2w="carga"]') : null;
    if (caja) conFoco(caja, () => { caja.innerHTML = htmlCarga(); });
    const sobre = S.doc.getElementById('r2-web-sobre');
    if (sobre) {
      const t = S.doc.createElement('template');
      t.innerHTML = htmlSobre();
      conFoco(sobre, () => sobre.replaceWith(t.content.firstElementChild));
      if (S.progreso != null) progreso(S.progreso, 1);
    }
    const nota = S.doc.querySelector('#r2-sobre .r2s-nota');
    if (nota) nota.hidden = true;
  }

  function montarCarga(raiz) {
    S.raizCarga = raiz;
    if (!raiz) return;
    const soltar = raiz.querySelector('[data-r2="soltar"]');
    if (!soltar || raiz.querySelector('[data-r2w="carga"]')) return;
    const caja = S.doc.createElement('div');
    caja.className = 'r2w';
    caja.setAttribute('data-r2w', 'carga');
    soltar.insertAdjacentElement('afterend', caja);
    pintar();
  }


  function textoConstruir(reemplazo) {
    if (reemplazo) return 'Se construye la base con el archivo nuevo. La base recordada se conserva hasta que esta esté comprobada y guardada. No cierre ni recargue la pestaña hasta que termine.';
    if (modoOk() && S.auto) return 'Se construye en este navegador a partir del CSV y después se guarda aquí, para que la próxima vez se abra sola. No cierre ni recargue la pestaña hasta que termine.';
    return 'Se construye en este navegador cada vez que abre la página. No cierre ni recargue la pestaña hasta que termine.';
  }


  // Lo que delata que la página está a media faena: un diálogo abierto (puede llevar una nota a medio escribir), un
  // botón en mitad de su operación, la barra de progreso del léxico y las coocurrencias, o un giro de espera. El giro
  // del centinela del desplazamiento infinito no cuenta: está siempre puesto al final de la lista de resultados.
  function ocupada() {
    const d = S.doc;
    if (!d || !d.querySelector) return false;
    if (d.querySelector('dialog[open], [aria-busy="true"], .lex-prog')) return true;
    return Array.prototype.some.call(d.querySelectorAll('.spin'), (e) => !(e.closest && e.closest('#sentinel')));
  }

  /** ¿Se puede recargar ahora sin tirar nada? Ni construyendo la base —la propia página pide no recargar— ni con algo
   *  en marcha. Lo que se pierde al recargar en reposo es la vista: la búsqueda que hay en pantalla y por dónde se iba
   *  leyendo. Lo escrito no, porque las bibliotecas, las notas y las etiquetas se guardan en la base al momento. */
  function recargaSegura() {
    if (S.operacion) return false;
    const f = fase();
    if (f !== 'abrir' && f !== 'fallo' && f !== 'app') return false;
    return !ocupada();
  }

  function nuevaVersion() {
    if (S.sw.nueva) return;
    S.sw.nueva = true;
    // Se activa siempre, aunque no se recargue: así la siguiente carga ya es la nueva sin que nadie pulse nada. No
    // afecta a la página en marcha, porque este service worker solo sirve el index.html y el manifiesto.
    const reg = S.sw.registro;
    if (reg && reg.waiting) {
      S.sw.pedida = recargaSegura();          // con esto, controllerchange recarga (o no)
      reg.waiting.postMessage({ tipo: 'saltar_espera' });
      if (S.sw.pedida) return;                // recarga sola: no hace falta avisar de nada
    }
    if (!S.doc || !S.doc.body) return;
    const d = S.doc.createElement('div');
    d.id = 'r2-web-version';
    d.setAttribute('role', 'status');
    d.innerHTML = '<span>Nueva versión disponible.</span><button type="button" class="btn primary sm" data-r2-web="actualizar">Recargar ahora</button>';
    S.doc.body.appendChild(d);
  }

  async function registrarSW() {
    const g = S.g;
    const nav = g.navigator;
    if (!S.web || !nav || !nav.serviceWorker || !/^https?:$/.test(g.location.protocol) || !g.isSecureContext) return;
    const sw = nav.serviceWorker;
    try {
      S.sw.estado = 'registrando';
      sw.addEventListener('message', (ev) => {
        const d = ev.data || {};
        if (d.tipo === 'version_sw') Object.assign(S.sw, { version: d.version, copia: d.almacen || null });
      });
      sw.addEventListener('controllerchange', () => { if (S.sw.pedida) g.location.reload(); });
      const reg = await sw.register('sw.js', { scope: './' });
      S.sw.registro = reg;
      const vigilar = (w) => {
        if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && sw.controller) nuevaVersion(); });
      };
      if (reg.waiting && sw.controller) nuevaVersion();
      vigilar(reg.installing);
      reg.addEventListener('updatefound', () => vigilar(reg.installing));
      await sw.ready;
      S.sw.estado = 'activo';
      const pedirVersion = () => { if (sw.controller) sw.controller.postMessage({ tipo: 'version' }); };
      if (sw.controller) pedirVersion();
      else sw.addEventListener('controllerchange', pedirVersion, { once: true });
    } catch (e) {
      S.sw.estado = 'error';
      S.sw.error = e && e.message ? e.message : String(e);
    }
  }

  /** El botón del aviso: la versión nueva ya está activa (nuevaVersion la activó), así que basta recargar. */
  function actualizar() {
    const reg = S.sw.registro;
    if (reg && reg.waiting) { S.sw.pedida = true; reg.waiting.postMessage({ tipo: 'saltar_espera' }); return; }
    S.g.location.reload();
  }


  function iniciar(o) {
    S.g = o.ventana || globalThis;
    S.doc = S.g.document;
    S.api = o;
    S.web = !!(R2.datos && R2.datos.edicion && R2.datos.edicion.web);
    const loc = S.g.location || {};
    const nav = S.g.navigator || {};
    S.archivoLocal = loc.protocol === 'file:';
    S.gecko = !!(R2.capacidades && R2.capacidades.motorDe(nav.userAgent, nav.userAgentData && nav.userAgentData.brands) === 'gecko');

    try { S.auto = S.g.localStorage.getItem(CLAVE_AUTO) !== '0'; } catch (e) { S.auto = true; }
    if (S.doc && S.doc.head) {
      const st = S.doc.createElement('style');
      st.textContent = CSS;
      S.doc.head.appendChild(st);
    }
    if (S.doc) {
      S.doc.addEventListener('click', (ev) => {
        const b = ev.target && ev.target.closest ? ev.target.closest('button[data-r2-web]') : null;
        if (!b || b.disabled) return;
        const que = b.getAttribute('data-r2-web');
        if (que === 'abrir') abrir();
        else if (que === 'olvidar') olvidar();
        else if (que === 'recordar') recordar();
        else if (que === 'reemplazar') { if (!S.operacion && fase() === 'app') entradaArchivo().click(); }
        else if (que === 'consultar') { S.consulta = null; pintar(); consultar(); }
        else if (que === 'actualizar') actualizar();
      });
      S.doc.addEventListener('change', (ev) => {
        const c = ev.target;
        if (!c || !c.getAttribute || c.getAttribute('data-r2-web') !== 'auto') return;
        S.auto = !!c.checked;
        try { S.g.localStorage.setItem(CLAVE_AUTO, S.auto ? '1' : '0'); } catch (e) {   }
        bitacora('auto', S.auto);
        for (const x of S.doc.querySelectorAll('input[data-r2-web="auto"]')) x.checked = S.auto;
        if (S.auto && fase() === 'app' && !corpusRecordado() && S.origen === 'csv') recordar();
        else pintar();
      });
      if (S.doc.body) entradaArchivo();
    }
    S.detectando = detectar().then(() => { bitacora('modo', S.modo); pintar(); }, () => { S.modo = 'ninguno'; pintar(); });
    registrarSW();
  }

  function debeAutoAbrir() {
    return !S.autoIntentado && !globalThis.R2_SIN_AUTOABRIR && fase() === 'abrir' && !!recordado() && !S.operacion
      && !(S.consulta && S.consulta.error) && !!S.api && typeof S.api.abrirRecordado === 'function';
  }


  function debeAbrirPropios() {
    return !S.autoIntentado && !globalThis.R2_SIN_AUTOABRIR && fase() === 'abrir' && !S.operacion
      && !!S.api && typeof S.api.abrirConDatosPropios === 'function' && S.api.hayDatosPropios();
  }

  function alHola() {
    const f = fase();
    if (!S.consulta || f === 'abrir' || f === 'fallo') {
      consultar().then(() => {


        if (debeAutoAbrir()) { S.autoIntentado = true; bitacora('autoabrir', null); abrir(); }
        else if (debeAbrirPropios()) { S.autoIntentado = true; bitacora('autodatos', null); S.api.abrirConDatosPropios(); }
      });
    } else pintar();
  }

  function alHuella() {
    if (S.pendienteRecordar && S.api.huella() === 'comprobada') recordar(S.pendienteRecordar);
    else pintar();
  }

  function alRevelar(origen) {
    S.origen = origen;
    S.autoIntentado = true;
    actualizarEspacio();
    if (!modoOk()) { pintar(); return; }

    if (origen !== 'csv' && origen !== 'servido') { S.reemplazo = null; pintar(); return; }
    const seguir = () => {
      const rem = S.reemplazo;
      S.reemplazo = null;
      if (rem) recordar({ reemplazo: rem });
      else if (S.auto && !corpusRecordado()) recordar();
      else pintar();
    };
    if (S.detectando || S.consultando) Promise.resolve(S.detectando).then(() => S.consultando).then(seguir, seguir);
    else seguir();
  }

  function estado() {
    return {
      disponible: modoOk(), modo: S.modo, detalle: S.detalle, web: S.web, auto: S.auto, consulta: S.consulta, operacion: S.operacion,
      mensaje: S.mensaje, error: S.error, progreso: S.progreso, corpus_recordado: corpusRecordado(), origen: S.origen,
      auto_intentado: S.autoIntentado, reemplazo: S.reemplazo ? { anterior: S.reemplazo.anterior, anteriorBorrada: S.reemplazo.anteriorBorrada, archivo: S.reemplazo.archivo } : null,
      espacio: S.espacio, persistente: S.persistente, bitacora: S.bitacora.slice(), metricas: Object.assign({}, S.metricas),
      sw: { estado: S.sw.estado, version: S.sw.version, copia: S.sw.copia, nueva: S.sw.nueva, error: S.sw.error },
    };
  }

  R2.web = { disponible, iniciar, montarCarga, alHola, alHuella, alRevelar, htmlSobre, corpusRecordado, estado, consultar, recordar, abrir,
    olvidar, abrirEn, abrirServidoEn, alFalloApertura, alCancelarApertura, alFinReemplazo, recordado, puedeRecordar: modoOk,
    textoConstruir, confirmar };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/web.js

































(function (R2) {
  'use strict';

  const ESPERA_MOTOR_MS = 30000;
  const REFRESCO_MS = 500;

  const S = {
    fase: 'nuevo',
    apertura: null, reemplazo: null, esperandoHuella: false,
    archivo: null, cliente: null, hola: null, informe: null, huella: 'pendiente', errorHuella: null, modoLectura: 'worker',
    seguimiento: null, recursos: null, sondeo: null, almacen: null, pendiente: false, avisoNoPublicado: false,
    marcas: {}, persistencia: null,


    silencioso: false,
  };
  const ESPERA_BIBLIOTECAS_MS = 10000;

  const RUTA_BIBLIOTECA = /^\/(?:collections|searches|import)(?:\/|$)/;
  let g = null, doc = null, vista = null, shim = null, sobre = null, intervalo = null, pintadoPendiente = false;

  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const marcar = (k) => { S.marcas[k] = Math.round(ahora()); };
  const textoDe = (e) => (e && e.name && e.message ? `${e.name}: ${e.message}` : String(e && e.message ? e.message : e));
  const ErrorRpc = () => R2.rpc.ErrorRpc;


  function base64(texto, w) {
    const limpio = String(texto).replace(/\s+/g, '');
    const U8 = w.Uint8Array || Uint8Array;
    if (typeof U8.fromBase64 === 'function') return U8.fromBase64(limpio);
    const bin = w.atob(limpio);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  async function gunzip(u8, w) {
    if (R2.inflate && typeof R2.inflate.gunzip === 'function') return R2.inflate.gunzip(u8);
    if (typeof w.DecompressionStream !== 'function') throw new Error('no hay descompresor gzip (R2.inflate o DecompressionStream)');
    const flujo = new w.Blob([u8]).stream().pipeThrough(new w.DecompressionStream('gzip'));
    return new Uint8Array(await new w.Response(flujo).arrayBuffer());
  }

  async function sha256Hex(u8, w) {
    if (R2.sha256 && typeof R2.sha256.hex === 'function') return R2.sha256.hex(u8);
    if (R2.sha256 && typeof R2.sha256.Sha256 === 'function') return new R2.sha256.Sha256().update(u8).hex();
    if (w.crypto && w.crypto.subtle && typeof w.crypto.subtle.digest === 'function') {
      const d = new Uint8Array(await w.crypto.subtle.digest('SHA-256', u8));
      return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return null;
  }

  async function decodificarRecurso(nombre, ventana) {
    const w = ventana || g || globalThis;
    const d = w.document;
    const el = d.getElementById(`r2-carga-${nombre}`) || d.querySelector(`script[type="application/octet-stream"][data-recurso="${nombre}"]`);
    if (!el) throw new (ErrorRpc())('RECURSO_DANADO', { causa: `falta el recurso «${nombre}»` });
    const enc = el.getAttribute('data-enc') || 'base64';
    let u8;
    try {
      u8 = base64(el.textContent, w);
      if (enc === 'gzip+base64') u8 = await gunzip(u8, w);
      else if (enc !== 'base64') throw new Error(`codificación desconocida «${enc}»`);
    } catch (e) {
      throw new (ErrorRpc())('RECURSO_DANADO', { causa: `${nombre}: ${textoDe(e)}` });
    }
    const bytes = el.getAttribute('data-bytes');
    if (bytes != null && Number(bytes) !== u8.length) {
      throw new (ErrorRpc())('RECURSO_DANADO', { causa: `${nombre}: ${u8.length} bytes en lugar de ${bytes}` });
    }
    const esperado = el.getAttribute('data-sha256');
    if (esperado) {
      const real = await sha256Hex(u8, w);
      if (real !== null && real !== esperado.toLowerCase()) throw new (ErrorRpc())('RECURSO_DANADO', { causa: `${nombre}: la huella SHA-256 no coincide` });
    }
    el.textContent = '';
    el.remove();
    return u8;
  }


  function errorDeCarga(e) {
    if (e instanceof R2.rpc.ErrorRpc) return e;
    return new (ErrorRpc())(e && e.codigo ? e.codigo : 'RECURSO_DANADO', { causa: e && e.causa ? e.causa : textoDe(e) });
  }

  async function obtenerRecursos() {
    if (R2.cargas && typeof R2.cargas.preparar === 'function') {
      if (R2.cargas.errorDatos) throw errorDeCarga(R2.cargas.errorDatos);
      let r;
      try { r = await R2.cargas.preparar(); } catch (e) { throw errorDeCarga(e); }
      return { wasm: r.wasm, urlWorker: r.urlWorker, tiempos: r.tiempos || null };
    }
    const wasm = await decodificarRecurso('wasm');
    const codigo = await decodificarRecurso('worker');
    let urlWorker;
    try {
      urlWorker = g.URL.createObjectURL(new g.Blob([codigo], { type: 'text/javascript' }));
    } catch (e) {
      throw new (ErrorRpc())('WORKER_NO_ARRANCA', { causa: textoDe(e) });
    }
    return { wasm, urlWorker, bytesWorker: codigo.length };
  }


  function aplicarTema() {
    let t = null;
    try { t = g.localStorage.getItem('tema'); } catch (e) { t = null; }
    if (t !== 'dark') t = 'light';
    doc.documentElement.dataset.theme = t;
  }

  function alternarTema() {
    const t = doc.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    doc.documentElement.dataset.theme = t;
    try { g.localStorage.setItem('tema', t); } catch (e) {   }
  }


  function referenciaLocal() {
    const d = R2.datos || {};
    const pub = d.csv_publicado || null;
    const bruta = d.fuente && typeof d.fuente === 'object' ? (d.fuente.fuente || d.fuente) : null;
    let fuente = null;
    if (bruta && bruta.cita) {
      fuente = { cita: bruta.cita, url: bruta.url || (bruta.doi ? `https://doi.org/${bruta.doi}` : null), licencia_nombre: bruta.licencia || null };
    }
    return { publicado: pub ? { bytes: pub.bytes, filas: pub.filas, url: pub.url, doi: pub.doi, version: pub.version } : null, fuente };
  }


  function crearVista() {
    const v = R2.carga.crear({
      documento: doc,
      manejadores: {
        alElegir: elegir, alCancelar: cancelar, alReintentar: reintentar, alOtro: otroArchivo, alContinuar: revelar,
        alRecargar: () => g.location.reload(), alTema: alternarTema, alCancelarRecordado: cancelarApertura,
      },
    });
    if (R2.web) R2.web.montarCarga(v.raiz);
    v.ponerReferencia(referenciaLocal());
    if (S.hola) {
      v.ponerReferencia(S.hola.referencia);
      v.ponerMotor(S.hola.sqlite);
    }
    if (S.sondeo) v.ponerAvisos(R2.capacidades.avisos(S.sondeo, S.almacen));
    return v;
  }

  function programarPintado() {
    if (pintadoPendiente) return;
    pintadoPendiente = true;
    const f = () => {
      pintadoPendiente = false;
      if (vista && S.seguimiento && S.fase === 'construyendo') vista.pintarProgreso(S.seguimiento.estado());
    };
    if (typeof g.requestAnimationFrame === 'function' && !doc.hidden) g.requestAnimationFrame(f);
    else setTimeout(f, 50);
  }

  function pararRefresco() {
    if (intervalo) { clearInterval(intervalo); intervalo = null; }
  }


  function nuevoCliente() {
    if (S.cliente) S.cliente.terminar('CANCELADO');
    const cliente = R2.rpc.crearCliente({
      crearWorker: () => new g.Worker(S.recursos.urlWorker, { name: 'diarios-explorer' }),
      tiempoArranqueMs: ESPERA_MOTOR_MS,
      alEvento: (tipo, datos) => { if (S.cliente === cliente) alEvento(cliente, tipo, datos); },
    });
    S.cliente = cliente;
    S.hola = S.hola || null;
    cliente.iniciar(S.recursos.wasm).then((hola) => {
      if (S.cliente !== cliente) return;
      if (!S.marcas.hola) marcar('hola');
    }, (err) => manejarError(cliente, err));
    return cliente;
  }

  function alEvento(cliente, tipo, datos) {
    switch (tipo) {
      case 'hola':
        S.hola = datos;
        if (vista) {
          vista.ponerReferencia(datos.referencia);
          vista.ponerMotor(datos.sqlite);
          vista.estadoMotor('');
        }
        if (R2.web) R2.web.alHola();
        break;
      case 'progreso':
        if (S.seguimiento) {
          S.seguimiento.evento(datos);
          programarPintado();
        }
        break;
      case 'modo_lectura':
        S.modoLectura = datos.modo;
        break;
      case 'huella':
        S.informe = datos.informe;
        S.huella = 'comprobada';
        marcar('huella');
        if (sobre) sobre.actualizar();
        avisarNoPublicado();
        if (S.esperandoHuella && S.fase === 'construyendo') {
          S.esperandoHuella = false;
          continuarTrasListo();
        }
        if (R2.web) R2.web.alHuella();
        break;
      case 'fallo_huella':
        S.huella = 'fallida';

        S.errorHuella = datos && typeof datos.aObjeto === 'function' ? datos.aObjeto() : datos;
        if (sobre) sobre.actualizar();
        if (S.reemplazo && S.fase === 'construyendo') {
          const nombre = S.archivo && S.archivo.name ? `«${S.archivo.name}»` : 'el archivo nuevo';
          volverAnterior(`No se pudo comprobar la huella de ${nombre} (${datos && (datos.message || datos.mensaje)}): no se ha reemplazado la base recordada.`);
        }
        break;
      case 'progreso_base':
        if (S.fase === 'recordado' && vista && datos) {
          if (S.silencioso) vista.progresoEspera(datos.total > 0 ? datos.hecho / datos.total : null);
          else vista.progresoRecordado(datos.hecho, datos.total);
        }
        break;
      case 'fatal':
        manejarError(cliente, datos);
        break;
      default:
    }
  }

  function manejarError(cliente, err) {
    if (cliente !== S.cliente || cliente.__r2Manejado) return;
    const e = err instanceof R2.rpc.ErrorRpc ? err : R2.rpc.errorDe(err && err.codigo ? err : { codigo: 'ERROR_INTERNO', mensaje: textoDe(err) });
    if (e.codigo === 'CANCELADO') return;
    if (S.fase === 'recordado') return;
    cliente.__r2Manejado = true;
    if (S.fase === 'app' || S.fase === 'caido') {
      caidaTrasListo(e);
      return;
    }
    if (S.reemplazo && (S.fase === 'construyendo' || S.fase === 'confirmar')) {
      const nombre = S.archivo && S.archivo.name ? `«${S.archivo.name}»` : 'el archivo nuevo';
      volverAnterior(`No se pudo construir la base con ${nombre}: ${e.message}`);
      return;
    }
    mostrarFallo(e, { precalentar: S.fase === 'construyendo' });
  }


  function elegir(archivo, opciones = {}) {
    if (!archivo || !(S.fase === 'abrir' || S.fase === 'fallo' || S.fase === 'confirmar')) return;
    if (S.fase === 'fallo' && !S.recursos) return;
    S.silencioso = !!opciones.silencioso;
    S.archivo = archivo;
    S.informe = null;
    S.huella = 'pendiente';
    S.errorHuella = null;
    S.modoLectura = 'worker';
    S.avisoNoPublicado = false;
    S.origen = 'csv';
    S.fase = 'construyendo';
    S.seguimiento = R2.progreso.crearSeguimiento();
    marcar('elegido');

    if (S.silencioso) vista.mostrarEspera({ titulo: 'Preparando el corpus…' });
    else {
      vista.mostrarConstruir({ archivo, sqlite: S.hola && S.hola.sqlite,
        entrada: R2.web ? R2.web.textoConstruir(!!S.reemplazo) : null,
        textoCancelar: S.reemplazo ? 'Cancelar y volver a la base recordada' : null });
    }
    pararRefresco();

    intervalo = setInterval(programarPintado, REFRESCO_MS);
    if (!S.recursos) {
      S.pendiente = true;
      return;
    }
    lanzar();
  }

  function lanzar() {
    let cliente = S.cliente;

    if (!cliente || cliente.__r2ConBase || !(cliente.estado === 'iniciando' || cliente.estado === 'preparado')) cliente = nuevoCliente();

    const lectura = S.sondeo && S.sondeo.motor === 'webkit' && S.sondeo.archivoLocal ? 'principal' : 'auto';
    // Edición web: la carpeta de la página, donde se sirven las expresiones ya calculadas de los CSV publicados.
    let base;
    const web = R2.datos && R2.datos.edicion && R2.datos.edicion.web;
    if (web) { try { base = new URL('./', globalThis.location.href).href; } catch (e) { base = undefined; } }
    cliente.construir(S.archivo, { lectura, base }).then((r) => alListo(cliente, r), (err) => manejarError(cliente, err));
  }

  function alListo(cliente, r) {
    if (cliente !== S.cliente || S.fase !== 'construyendo') return;
    marcar('listo');
    S.informe = r.informe;
    S.modoLectura = r.modo_lectura || S.modoLectura;
    S.huella = r.informe.huella.sha256 === null ? 'pendiente' : 'comprobada';
    pararRefresco();
    if (vista && S.seguimiento) vista.pintarProgreso(S.seguimiento.estado());

    if (S.reemplazo && S.huella !== 'comprobada') {
      S.esperandoHuella = true;
      if (vista) vista.notaConstruir('Comprobando la huella del archivo antes de sustituir la base recordada…');
      return;
    }
    continuarTrasListo();
  }

  function continuarTrasListo() {
    if (S.fase !== 'construyendo') return;
    if ((S.informe.avisos || []).some((a) => a.codigo === 'FILAS_DISTINTAS')) {
      S.fase = 'confirmar';
      vista.mostrarConfirmar(S.informe, S.archivo, { textoOtro: S.reemplazo ? 'Volver a la base recordada' : null });
      return;
    }
    revelar();
  }

  function revelar() {
    if (!(S.fase === 'construyendo' || S.fase === 'confirmar')) return;
    S.confirmado = S.fase === 'confirmar';
    S.fase = 'app';
    S.esperandoHuella = false;
    const trasReemplazo = !!S.reemplazo && S.origen !== 'recordado';
    S.reemplazo = null;
    pararRefresco();
    if (vista) { vista.destruir(); vista = null; }
    doc.documentElement.classList.add('r2-app');
    marcar('revelado');
    const cliente = S.cliente;
    if (R2.sobreCorpus) {
      if (sobre) sobre.desmontar();
      sobre = R2.sobreCorpus.montar({ documento: doc, obtenerEstado: estadoSobre });
    }
    if (R2.web) R2.web.alRevelar(S.origen || 'csv');
    if (shim) {


      const motor = {
        pedir: (op, args, o) => {
          const p = S.persistencia;
          const fin = cambiaBibliotecas(op, args) && p && typeof p.empiezaCambio === 'function' ? p.empiezaCambio() : null;
          return cliente.pedir(op, args, o).then((r) => { observarRespuesta(op, args, r); return r; })
            .finally(() => { if (fin) fin(); });
        },
      };

      conectarBibliotecas(cliente).then(() => {
        if (S.cliente === cliente && S.fase === 'app') {
          shim.liberar(motor);

          if (trasReemplazo) doc.dispatchEvent(new g.CustomEvent('r2:corpus-reemplazado'));
        }
      });
    }
    const q = doc.getElementById('q');
    if (q) { try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); } }
    avisarNoPublicado();
  }



  function motorBibliotecas(cliente) {
    const api = (metodo, ruta, cuerpo) => cliente.pedir('api', { metodo, ruta, query: {}, queryLista: [], cuerpo }).then((r) => {
      if (r.status >= 400) {
        const e = new Error(r.cuerpo && r.cuerpo.error ? r.cuerpo.error : `Error ${r.status}`);
        e.status = r.status;
        throw e;
      }
      return r;
    });
    return {
      volcar: () => api('GET', '/_biblioteca/volcado').then((r) => ({ bytes: r.cuerpo, version: Number((r.cabeceras || {})['x-r2-biblioteca']) || 0 })),
      restaurar: (bytes) => api('POST', '/_biblioteca/restaurar', { bytes: bytes || null }).then((r) => r.cuerpo),
      modo: (soloLectura, motivo) => api('POST', '/_biblioteca/modo', { solo_lectura: !!soloLectura, motivo: motivo || null }).then((r) => r.cuerpo),
    };
  }


  function cambiaBibliotecas(op, args) {
    return op === 'api' && !!args && String(args.metodo || 'GET').toUpperCase() !== 'GET' && RUTA_BIBLIOTECA.test(String(args.ruta || ''));
  }










  function montarAnuncios() {
    if (!doc || !doc.body || doc.getElementById('r2-anuncio')) return;
    const crear = (id, rol, vivo) => {
      const el = doc.createElement('div');
      el.id = id;
      el.className = 'r2c-oculto';
      el.setAttribute('role', rol);
      el.setAttribute('aria-live', vivo);
      el.setAttribute('aria-atomic', 'true');
      doc.body.appendChild(el);
      return el;
    };
    const normal = crear('r2-anuncio', 'status', 'polite');
    const alerta = crear('r2-alerta', 'alert', 'assertive');
    const anunciar = (texto, urgente) => {
      if (!texto) return;
      const el = urgente ? alerta : normal;
      el.textContent = '';
      setTimeout(() => { el.textContent = String(texto); }, 60);
    };
    R2.anuncios = { anunciar };
    const cajas = doc.getElementById('toasts');
    if (cajas && typeof g.MutationObserver === 'function') {
      new g.MutationObserver((cambios) => {
        for (const c of cambios) {
          for (const n of c.addedNodes) {
            if (n.nodeType === 1 && n.classList && n.classList.contains('toast')) anunciar(n.textContent, n.classList.contains('err'));
          }
        }
      }).observe(cajas, { childList: true });
    }
  }


  async function conectarBibliotecas(cliente) {
    const p = S.persistencia;
    if (!p) return;
    let t = null;
    try {
      await Promise.race([
        p.conectar(motorBibliotecas(cliente)),
        new Promise((_, rechazar) => { t = setTimeout(() => rechazar(new Error(`sin respuesta en ${ESPERA_BIBLIOTECAS_MS / 1000} s`)), ESPERA_BIBLIOTECAS_MS); }),
      ]);
    } catch (e) {
      console.error('Diarios Explorer: no se pudieron recuperar las bibliotecas guardadas', e);
    } finally {
      if (t) clearTimeout(t);
    }
  }


  function observarRespuesta(op, args, r, persistencia) {
    const p = persistencia || S.persistencia;
    if (!p || op !== 'api' || !args || !r) return;
    try {
      const cab = r.cabeceras || {};
      const metodo = String(args.metodo || 'GET').toUpperCase();
      if (cab['x-r2-biblioteca'] || (metodo !== 'GET' && RUTA_BIBLIOTECA.test(String(args.ruta || '')))) p.notificar();
      if (cab['x-r2-exportadas'] && r.status < 400) p.marcarExportado();
    } catch (e) {   }
  }

  function estadoSobre() {
    return { informe: S.informe, huella: S.huella, errorHuella: S.errorHuella, modoLectura: S.modoLectura,
      referencia: S.hola && S.hola.referencia ? S.hola.referencia.publicado : null };
  }






  function avisarNoPublicado() {
    if (S.fase !== 'app' || S.avisoNoPublicado || S.confirmado || !S.informe || S.informe.publicado !== false) return;
    S.avisoNoPublicado = true;
    const a = (S.informe.avisos || []).find((x) => x.codigo === 'NO_PUBLICADO');
    if (a && typeof g.toast === 'function') {
      try { g.toast(a.mensaje, true); } catch (e) {   }
    }
  }

  function cancelar() {
    if (S.fase !== 'construyendo') return;
    if (S.reemplazo) {
      marcar('cancelado');
      volverAnterior('Se canceló el reemplazo: la base recordada sigue igual.');
      return;
    }
    marcar('cancelado');
    pararRefresco();
    S.pendiente = false;
    S.fase = 'abrir';
    const archivo = S.archivo;
    if (S.recursos) nuevoCliente();
    vista.mostrarAbrir({
      nota: `Se canceló la construcción${archivo && archivo.name ? ` de ${archivo.name}` : ''}. Puede reintentarlo o elegir otro archivo.`,
      reintentar: archivo, enfocar: 'reintentar',
    });
  }

  function reintentar() {
    if (S.archivo) {
      if (S.fase === 'fallo' || S.fase === 'abrir') elegir(S.archivo);
      return;
    }

    S.fase = 'abrir';
    vista.mostrarAbrir({ enfocar: 'elegir' });
    if (S.recursos) {
      vista.estadoMotor('Preparando el motor de la página…');
      nuevoCliente();
    }
  }






  function otroArchivo() {
    if (S.fase === 'confirmar' && S.reemplazo) {
      volverAnterior('Se canceló el reemplazo: la base recordada sigue igual.');
      return;
    }
    if (S.fase === 'confirmar' || S.fase === 'fallo') {
      vista.abrirSelector();
      return;
    }
    S.fase = 'abrir';
    vista.mostrarAbrir({ enfocar: 'elegir' });
    vista.abrirSelector();
  }


  function alDescargar(ev) {
    if (!(S.fase === 'construyendo' || S.fase === 'confirmar' || S.fase === 'app')) return undefined;
    if (S.fase === 'app' && R2.web && R2.web.corpusRecordado()) return undefined;
    ev.preventDefault();
    ev.returnValue = '';
    return '';
  }

  function mostrarFallo(err, o = {}) {
    pararRefresco();
    S.pendiente = false;
    S.fase = 'fallo';
    S.silencioso = false;
    const navegador = err.codigo === 'NAVEGADOR';
    const sinMotor = !S.recursos || navegador || err.codigo === 'RECURSO_DANADO';
    const arranque = err.codigo === 'WORKER_NO_ARRANCA' || err.codigo === 'WASM_NO_ARRANCA';


    const ilegible = err.codigo === 'ARCHIVO_ILEGIBLE';
    vista.mostrarFallo(err, {
      archivo: S.archivo,
      otro: !sinMotor,
      textoOtro: ilegible ? 'Volver a elegir el archivo' : null,
      reintentar: !sinMotor && !ilegible && (arranque || (!!S.archivo && R2.rpc.REINTENTABLES.has(err.codigo))),

      recargar: (sinMotor && !navegador) || arranque,
      ayudaNavegador: navegador,
    });

    if (o.precalentar && !sinMotor && !arranque) nuevoCliente();
  }


  function fichaRecordado(r) {
    if (!r) return 'Base recordada';
    const partes = [r.nombre_csv || 'CSV'];
    if (r.version && r.version.corto) partes.push(r.version.corto);
    if (r.bytes) partes.push(R2.progreso.tamano(r.bytes));
    return partes.join(' · ');
  }

  const ENTRADA_CON_DATOS = 'El corpus viaja con esta aplicación y se abre solo; nada sale de su equipo. Si quiere explorar otro CSV, puede elegirlo aquí.';


  function fichaServido(s) {
    const partes = [`«${(s.csv_origen && s.csv_origen.nombre) || 'corpus'}»`];
    if (s.bytes_gz) partes.push(`${R2.progreso.tamano(s.bytes_gz)} de descarga`);
    return partes.join(' · ');
  }


  function datosPropios() {
    const s = R2.datos && R2.datos.corpus_servido;
    if (s && Array.isArray(s.partes) && s.partes.length) return { tipo: 'servido', datos: s };
    const c = R2.cargas && typeof R2.cargas.info === 'function' ? R2.cargas.info('corpus') : null;
    if (c) return { tipo: 'embebido', datos: c };
    return null;
  }






  function abrirConDatosPropios() {
    const p = datosPropios();
    if (!p || !(S.fase === 'abrir' || S.fase === 'fallo') || !S.recursos) return false;
    if (p.tipo === 'servido') { abrirServido(p.datos).catch(() => {}); return true; }
    marcar('corpus_embebido');
    vista.mostrarEspera({ titulo: 'Preparando el corpus…' });
    R2.cargas.archivoCorpus().then((archivo) => {
      if (!archivo || S.fase !== 'abrir') return;
      elegir(archivo, { silencioso: true });
    }, (e) => {
      if (S.fase !== 'abrir') return;
      S.silencioso = false;
      vista.mostrarAbrir({ nota: `No se pudo leer el corpus que acompaña a esta aplicación (${textoDe(e)}). Elija el CSV.`,
        entrada: ENTRADA_CON_DATOS, enfocar: 'elegir' });
    });
    return true;
  }





  function abrirServido(s) {
    return abrirSinCsv({
      marca: 'abrir_servido',
      origen: 'servido',
      silencioso: true,
      tituloEspera: 'Abriendo el corpus…',
      ficha: fichaServido(s || (R2.datos && R2.datos.corpus_servido) || {}),
      titulo: 'Abriendo el corpus que acompaña a la página…',
      entrada: 'Este corpus se publica junto a la página: se descarga una vez, se comprueba y se guarda en este navegador para abrirlo solo la próxima vez.',
      textoCancelar: 'Cancelar y elegir el CSV',
      abrir: (cliente, o) => R2.web.abrirServidoEn(cliente, o),
    });
  }







  function abrirRecordado(o = {}) {
    const rec = o.recordado || (R2.web ? R2.web.recordado() : null);
    return abrirSinCsv({
      marca: 'abrir_recordado',
      origen: 'recordado',

      silencioso: !!datosPropios(),
      tituloEspera: 'Abriendo el corpus…',
      ficha: fichaRecordado(rec),
      titulo: o.titulo,
      entrada: o.entrada,
      textoCancelar: o.textoCancelar,
      mensajeTrasAbrir: o.mensajeTrasAbrir,
      abrir: (cliente, x) => R2.web.abrirEn(cliente, x),
    });
  }


  async function abrirSinCsv(o) {
    if (!(S.fase === 'abrir' || S.fase === 'fallo') || !S.recursos || !R2.web) {
      throw Object.assign(new Error('El motor de la página todavía no está listo.'), { codigo: 'ESTADO' });
    }
    pararRefresco();
    S.fase = 'recordado';
    S.silencioso = !!o.silencioso;
    marcar(o.marca);
    const apertura = { ctrl: new g.AbortController(), mensaje: o.mensajeTrasAbrir || null };
    S.apertura = apertura;
    if (!vista) vista = crearVista();
    if (S.silencioso) vista.mostrarEspera({ titulo: o.tituloEspera || 'Abriendo el corpus…', nota: o.entrada || '' });
    else vista.mostrarRecordado({ ficha: o.ficha, titulo: o.titulo, entrada: o.entrada, textoCancelar: o.textoCancelar });
    let cliente = S.cliente;
    if (!cliente || cliente.__r2ConBase || !(cliente.estado === 'iniciando' || cliente.estado === 'preparado')) cliente = nuevoCliente();
    try {
      await cliente.iniciar(S.recursos.wasm);
      cliente.__r2ConBase = true;
      const r = await o.abrir(cliente, {
        signal: apertura.ctrl.signal,
        alProgreso: (hecho, total) => {
          if (S.apertura !== apertura || !vista) return;
          if (S.silencioso) vista.progresoEspera(total > 0 ? hecho / total : null);
          else vista.progresoRecordado(hecho, total);
        },
      });
      if (S.cliente !== cliente || S.apertura !== apertura || S.fase !== 'recordado') return r;
      S.apertura = null;
      marcar('listo');
      Object.assign(S, { archivo: null, informe: r.informe, huella: 'comprobada', errorHuella: null, modoLectura: 'worker',
        avisoNoPublicado: false, origen: o.origen, fase: 'construyendo', seguimiento: null });
      revelar();
      if (apertura.mensaje && typeof g.toast === 'function') {
        try { g.toast(apertura.mensaje, true); } catch (e) {   }
      }
      return r;
    } catch (err) {
      if (S.apertura !== apertura) throw err;
      S.apertura = null;
      marcar(`${o.marca}_fallo`);
      S.fase = 'abrir';
      S.silencioso = false;
      if (S.recursos) nuevoCliente();
      R2.web.alFalloApertura(err);
      if (vista) {
        const antes = apertura.mensaje ? `${apertura.mensaje} ` : '';
        vista.mostrarAbrir({ nota: `${antes}${err && err.message ? err.message : String(err)}`, enfocar: 'elegir' });
      }
      throw err;
    }
  }


  function cancelarApertura() {
    if (S.fase !== 'recordado' || !S.apertura) return;
    const apertura = S.apertura;
    S.apertura = null;
    try { apertura.ctrl.abort(); } catch (e) {   }
    marcar('abrir_recordado_cancelado');
    S.fase = 'abrir';
    S.silencioso = false;
    if (S.recursos) nuevoCliente();
    if (R2.web) R2.web.alCancelarApertura();
    vista.mostrarAbrir({ nota: S.marcas.abrir_servido && !S.marcas.abrir_recordado
      ? 'Se canceló la descarga del corpus que acompaña a la página. Elija el CSV o recargue para volver a intentarlo.'
      : 'Se canceló la apertura de la base recordada: sigue guardada en este navegador. Elija otro CSV o vuelva a abrirla.', enfocar: 'elegir' });
    vista.abrirSelector();
  }






  async function reemplazar(archivo, o = {}) {
    if (S.fase !== 'app' || !archivo || !S.recursos) return false;
    marcar('reemplazo');
    const p = S.persistencia;
    if (p && typeof p.esperar === 'function') {
      let t = null;
      try { await Promise.race([p.esperar(), new Promise((r) => { t = setTimeout(r, ESPERA_BIBLIOTECAS_MS); })]); } catch (e) {   } finally { if (t) clearTimeout(t); }
    }
    if (S.fase !== 'app') return false;
    S.reemplazo = { anteriorBorrada: !!o.anteriorBorrada };
    if (shim) shim.retener();
    if (sobre) { sobre.desmontar(); sobre = null; }
    doc.documentElement.classList.remove('r2-app');
    if (!vista) vista = crearVista();
    S.fase = 'abrir';
    elegir(archivo);
    return true;
  }


  function volverAnterior(mensaje) {
    const rem = S.reemplazo;
    S.reemplazo = null;
    S.esperandoHuella = false;
    pararRefresco();
    S.pendiente = false;
    S.fase = 'abrir';
    S.silencioso = false;
    marcar('reemplazo_fallido');
    if (S.recursos) nuevoCliente();
    const hay = R2.web ? R2.web.recordado() : null;
    if (R2.web) R2.web.alFinReemplazo({ mensaje });
    if (!vista) vista = crearVista();
    if (rem && !rem.anteriorBorrada && hay) {
      abrirRecordado({ recordado: hay, titulo: 'Volviendo a la base recordada…', entrada: mensaje, mensajeTrasAbrir: mensaje }).catch(() => {});
    } else {
      vista.mostrarAbrir({ nota: `${mensaje} Elija un CSV para continuar.`, enfocar: 'elegir' });
    }
  }

  function caidaTrasListo(err) {
    S.fase = 'caido';
    if (shim) shim.fallar(err);
    doc.documentElement.classList.remove('r2-app');
    if (!vista) vista = crearVista();
    vista.mostrarFallo(err, { archivo: S.archivo, recargar: true, titulo: 'El motor se ha detenido' });
  }


  async function iniciar(opciones = {}) {
    if (S.fase !== 'nuevo') return;
    g = opciones.ventana || globalThis;
    doc = g.document;
    shim = opciones.shim || (R2.apiShim && R2.apiShim.instalado) || null;
    S.fase = 'abrir';
    marcar('inicio');
    if (typeof g.addEventListener === 'function') g.addEventListener('beforeunload', alDescargar);
    aplicarTema();
    if (R2.ajustes) R2.ajustes.aplicar();
    try { montarAnuncios(); } catch (e) {   }
    S.sondeo = R2.capacidades.sondearSincrono(g);
    if (R2.web) {
      R2.web.iniciar({ ventana: g, cliente: () => S.cliente, informe: () => S.informe, huella: () => S.huella, fase: () => S.fase,
        abrirRecordado, reemplazar, hayDatosPropios: () => !!datosPropios(), abrirConDatosPropios });
    }
    vista = crearVista();
    if (S.sondeo.faltan.length) {
      const err = new (ErrorRpc())('NAVEGADOR', { faltan: S.sondeo.faltan });
      mostrarFallo(err);
      if (shim) shim.fallar(err);
      return;
    }


    if (datosPropios()) vista.mostrarEspera({ titulo: 'Preparando el corpus…' });
    else vista.mostrarAbrir({ enfocar: 'elegir' });
    vista.estadoMotor('Preparando el motor de la página…');
    R2.capacidades.sondearAlmacen(g).then((alm) => {
      S.almacen = alm;
      if (vista) vista.ponerAvisos(R2.capacidades.avisos(S.sondeo, alm));
    }, () => {});

    if (R2.almacen && typeof R2.almacen.crearPersistencia === 'function') {
      try {
        S.persistencia = R2.almacen.crearPersistencia({ ventana: g });
        R2.persistencia = S.persistencia;
        S.persistencia.iniciar().catch((e) => console.error('Diarios Explorer: no se pudo preparar el guardado de las bibliotecas', e));
      } catch (e) {
        S.persistencia = null;
      }
    }

    try {
      S.recursos = await obtenerRecursos();
      marcar('recursos');
    } catch (e) {
      const err = e instanceof R2.rpc.ErrorRpc ? e : new (ErrorRpc())('RECURSO_DANADO', { causa: textoDe(e) });
      mostrarFallo(err);
      if (shim) shim.fallar(err);
      return;
    }
    nuevoCliente();
    if (S.pendiente && S.fase === 'construyendo') {
      S.pendiente = false;
      lanzar();
    }
  }

  function estado() {
    const c = S.cliente;
    return {
      fase: S.fase,
      archivo: S.archivo ? { nombre: S.archivo.name, bytes: S.archivo.size } : null,
      cliente: c ? { estado: c.estado, lecturas_principal: c.lecturasPrincipal } : null,
      sqlite: S.hola ? S.hola.sqlite : null,
      informe: S.informe,
      huella: S.huella,
      error_huella: S.errorHuella,
      modo_lectura: S.modoLectura,
      progreso: S.seguimiento ? S.seguimiento.estado() : null,
      seccion: vista ? vista.seccion : null,
      shim: shim ? shim.estadisticas() : null,
      sondeo: S.sondeo,
      almacen: S.almacen,
      bibliotecas: S.persistencia ? S.persistencia.estado() : null,
      web: R2.web ? R2.web.estado() : null,
      reemplazo: S.reemplazo ? Object.assign({}, S.reemplazo) : null,
      esperando_huella: !!S.esperandoHuella,
      silencioso: !!S.silencioso,
      marcas: Object.assign({}, S.marcas),
    };
  }

  R2.arranque = { iniciar, estado, decodificarRecurso, persistencia: () => S.persistencia, motorBibliotecas, observarRespuesta,
    cambiaBibliotecas, datosPropios, RUTA_BIBLIOTECA };

  const noApto = typeof window !== 'undefined' && window.R2_NAVEGADOR && window.R2_NAVEGADOR.apto === false;
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && !globalThis.R2_ARRANQUE_MANUAL && !noApto) {
    const empezar = () => iniciar({ ventana: window }).catch((e) => {
      console.error('Diarios Explorer: el arranque falló', e);
      try {
        const p = document.createElement('p');
        p.setAttribute('role', 'alert');
        p.style.cssText = 'position:fixed;inset:auto 16px 16px 16px;padding:12px 14px;background:#fff;color:#1d1b18;border:1px solid #c21d1d;border-radius:7px;font:14px/1.5 system-ui,sans-serif;z-index:100';
        p.textContent = `No se pudo iniciar Diarios Explorer: ${textoDe(e)}. Recargue la página o use Chrome, Edge, Firefox o Safari en una versión reciente.`;
        document.body.appendChild(p);
      } catch (e2) {   }
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', empezar, { once: true });
    else empezar();
  }
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/arranque.js





(function (R2) {
  'use strict';
  const congelar = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(congelar); Object.freeze(o); } return o; };
  const gen = R2.gen = R2.gen || {};
  gen.vacias = congelar({
 "VACIAS": [
  "a",
  "al",
  "algo",
  "alguna",
  "algunas",
  "alguno",
  "algunos",
  "ante",
  "antes",
  "aquel",
  "aquella",
  "aquellas",
  "aquello",
  "aquellos",
  "aqui",
  "asi",
  "aun",
  "aunque",
  "cada",
  "como",
  "con",
  "contra",
  "cual",
  "cuales",
  "cuando",
  "cuanto",
  "de",
  "del",
  "desde",
  "donde",
  "dos",
  "e",
  "el",
  "ella",
  "ellas",
  "ello",
  "ellos",
  "en",
  "entre",
  "era",
  "eran",
  "es",
  "esa",
  "esas",
  "ese",
  "eso",
  "esos",
  "esta",
  "estaba",
  "estan",
  "estar",
  "estas",
  "este",
  "esto",
  "estos",
  "fue",
  "fuera",
  "fueron",
  "ha",
  "habia",
  "han",
  "hasta",
  "hay",
  "la",
  "las",
  "le",
  "les",
  "lo",
  "los",
  "mas",
  "me",
  "mi",
  "mis",
  "mucho",
  "muchos",
  "muy",
  "nada",
  "ni",
  "no",
  "nos",
  "nuestra",
  "nuestro",
  "o",
  "otra",
  "otras",
  "otro",
  "otros",
  "para",
  "pero",
  "poco",
  "por",
  "porque",
  "pues",
  "que",
  "quien",
  "quienes",
  "se",
  "ser",
  "si",
  "sin",
  "sobre",
  "solo",
  "son",
  "su",
  "sus",
  "tal",
  "tambien",
  "tan",
  "tanto",
  "te",
  "tiene",
  "tienen",
  "toda",
  "todas",
  "todo",
  "todos",
  "tras",
  "un",
  "una",
  "unas",
  "uno",
  "unos",
  "y",
  "ya",
  "yo"
 ],
 "STOPWORDS_KEYNESS": [
  "a",
  "aca",
  "acaso",
  "ademas",
  "adonde",
  "ahi",
  "ahora",
  "al",
  "algo",
  "alguien",
  "algun",
  "alguna",
  "algunas",
  "alguno",
  "algunos",
  "alla",
  "alli",
  "ambas",
  "ambos",
  "ante",
  "antes",
  "aquel",
  "aquella",
  "aquellas",
  "aquello",
  "aquellos",
  "aqui",
  "asi",
  "aun",
  "aunque",
  "bajo",
  "bien",
  "cabe",
  "cada",
  "casi",
  "como",
  "con",
  "conmigo",
  "conque",
  "consigo",
  "contigo",
  "contra",
  "cual",
  "cuales",
  "cualquier",
  "cualquiera",
  "cuando",
  "cuanta",
  "cuantas",
  "cuanto",
  "cuantos",
  "cuya",
  "cuyas",
  "cuyo",
  "cuyos",
  "de",
  "del",
  "demas",
  "desde",
  "despues",
  "donde",
  "dos",
  "durante",
  "e",
  "el",
  "ella",
  "ellas",
  "ello",
  "ellos",
  "en",
  "entonces",
  "entre",
  "era",
  "eran",
  "eres",
  "es",
  "esa",
  "esas",
  "ese",
  "eso",
  "esos",
  "esta",
  "estaba",
  "estaban",
  "estamos",
  "estan",
  "estar",
  "estaria",
  "estarian",
  "estas",
  "este",
  "esten",
  "esto",
  "estos",
  "estoy",
  "estuvieron",
  "estuvo",
  "fue",
  "fuera",
  "fueran",
  "fueron",
  "fuese",
  "fuesen",
  "fui",
  "fuimos",
  "ha",
  "habeis",
  "haber",
  "habia",
  "habian",
  "habido",
  "habiendo",
  "habra",
  "habran",
  "habria",
  "habrian",
  "hacia",
  "han",
  "has",
  "hasta",
  "hay",
  "haya",
  "hayan",
  "he",
  "hemos",
  "hubiera",
  "hubieran",
  "hubiese",
  "hubiesen",
  "hubo",
  "incluso",
  "jamas",
  "la",
  "las",
  "le",
  "les",
  "lo",
  "los",
  "luego",
  "mas",
  "me",
  "mediante",
  "menos",
  "mi",
  "mia",
  "mias",
  "mientras",
  "mio",
  "mios",
  "mis",
  "misma",
  "mismas",
  "mismo",
  "mismos",
  "mucha",
  "muchas",
  "mucho",
  "muchos",
  "muy",
  "nada",
  "nadie",
  "ni",
  "ningun",
  "ninguna",
  "ninguno",
  "no",
  "nos",
  "nosotras",
  "nosotros",
  "nuestra",
  "nuestras",
  "nuestro",
  "nuestros",
  "nunca",
  "o",
  "os",
  "otra",
  "otras",
  "otro",
  "otros",
  "para",
  "pero",
  "poca",
  "pocas",
  "poco",
  "pocos",
  "por",
  "porque",
  "pues",
  "que",
  "quien",
  "quienes",
  "quiza",
  "quizas",
  "se",
  "sea",
  "sean",
  "segun",
  "ser",
  "sera",
  "seran",
  "sere",
  "seremos",
  "seria",
  "serian",
  "si",
  "sido",
  "siempre",
  "siendo",
  "sin",
  "sino",
  "so",
  "sobre",
  "sois",
  "solamente",
  "solo",
  "somos",
  "son",
  "soy",
  "su",
  "sus",
  "suya",
  "suyas",
  "suyo",
  "suyos",
  "tal",
  "tales",
  "tambien",
  "tampoco",
  "tan",
  "tanta",
  "tantas",
  "tanto",
  "tantos",
  "te",
  "ti",
  "tiene",
  "tienen",
  "toda",
  "todas",
  "todavia",
  "todo",
  "todos",
  "tras",
  "tu",
  "tus",
  "tuya",
  "tuyas",
  "tuyo",
  "tuyos",
  "u",
  "un",
  "una",
  "unas",
  "uno",
  "unos",
  "usted",
  "ustedes",
  "varias",
  "varios",
  "via",
  "vosotras",
  "vosotros",
  "vuestra",
  "vuestras",
  "vuestro",
  "vuestros",
  "y",
  "ya",
  "yo"
 ],
 "VACIAS_SALA": [
  "aqui",
  "articulo",
  "camara",
  "creo",
  "decir",
  "dicho",
  "diputado",
  "diputados",
  "esto",
  "gobierno",
  "haber",
  "hace",
  "hacer",
  "hemos",
  "ministro",
  "minoria",
  "palabra",
  "porque",
  "presidente",
  "puede",
  "pueden",
  "senor",
  "senora",
  "senores",
  "senoria",
  "senorias",
  "senorita",
  "sido",
  "sino",
  "sres",
  "usted",
  "ustedes"
 ]
});
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/engine/generated/vacias.js









(function (R2) {
  'use strict';
  R2.unicode61 = Object.freeze({
    SQLITE: "3.53.4",
    N_TOKEN: 1104067,
    TOKEN: Object.freeze([
    48,57,65,90,97,122,170,170,178,179,181,181,185,186,188,190,
    192,214,216,246,248,705,710,721,736,740,748,748,750,750,768,772,
    774,780,783,783,785,785,795,795,803,808,813,814,816,817,880,884,
    886,893,895,899,902,902,904,1013,1015,1153,1162,1369,1376,1416,1419,1422,
    1424,1424,1480,1522,1525,1535,1541,1541,1564,1565,1568,1610,1632,1641,1646,1647,
    1649,1747,1749,1749,1765,1766,1774,1788,1791,1791,1806,1806,1808,1808,1810,1839,
    1867,1957,1969,2026,2036,2037,2042,2069,2074,2074,2084,2084,2088,2088,2094,2095,
    2111,2136,2140,2141,2143,2275,2303,2303,2308,2361,2365,2365,2384,2384,2392,2401,
    2406,2415,2417,2432,2436,2491,2493,2493,2501,2502,2505,2506,2510,2518,2520,2529,
    2532,2545,2548,2553,2556,2560,2564,2619,2621,2621,2627,2630,2633,2634,2638,2640,
    2642,2671,2674,2676,2678,2688,2692,2747,2749,2749,2758,2758,2762,2762,2766,2785,
    2788,2799,2802,2816,2820,2875,2877,2877,2885,2886,2889,2890,2894,2901,2904,2913,
    2916,2927,2929,2945,2947,3005,3011,3013,3017,3017,3022,3030,3032,3058,3067,3072,
    3076,3133,3141,3141,3145,3145,3150,3156,3159,3169,3172,3198,3200,3201,3204,3259,
    3261,3261,3269,3269,3273,3273,3278,3284,3287,3297,3300,3329,3332,3389,3397,3397,
    3401,3401,3406,3414,3416,3425,3428,3448,3450,3457,3460,3529,3531,3534,3541,3541,
    3543,3543,3552,3569,3573,3632,3634,3635,3643,3646,3648,3654,3664,3673,3676,3760,
    3762,3763,3770,3770,3773,3783,3790,3840,3872,3891,3904,3952,3976,3980,3992,3992,
    4029,4029,4045,4045,4059,4138,4159,4169,4176,4181,4186,4189,4193,4193,4197,4198,
    4206,4208,4213,4225,4238,4238,4240,4249,4256,4346,4348,4956,4969,5007,5018,5119,
    5121,5740,5743,5759,5761,5786,5789,5866,5870,5905,5909,5937,5943,5969,5972,6001,
    6004,6067,6103,6103,6108,6108,6110,6143,6159,6312,6314,6431,6444,6447,6460,6463,
    6465,6467,6470,6575,6593,6599,6602,6621,6656,6678,6684,6685,6688,6740,6751,6751,
    6781,6782,6784,6815,6823,6823,6830,6911,6917,6963,6981,7001,7037,7039,7043,7072,
    7086,7141,7156,7163,7168,7203,7224,7226,7232,7293,7296,7359,7368,7375,7401,7404,
    7406,7409,7413,7615,7655,7675,7680,8124,8126,8126,8130,8140,8144,8156,8160,8172,
    8176,8188,8191,8191,8293,8297,8304,8313,8319,8329,8335,8351,8378,8399,8433,8447,
    8450,8450,8455,8455,8458,8467,8469,8469,8473,8477,8484,8484,8486,8486,8488,8488,
    8490,8493,8495,8505,8508,8511,8517,8521,8526,8526,8528,8591,9204,9215,9255,9279,
    9291,9371,9450,9471,9984,9984,10102,10131,11085,11087,11098,11492,11499,11502,11506,11512,
    11517,11517,11520,11631,11633,11646,11648,11743,11823,11823,11836,11903,11930,11930,12020,12031,
    12246,12271,12284,12287,12293,12295,12321,12329,12337,12341,12344,12348,12352,12440,12445,12447,
    12449,12538,12540,12687,12690,12693,12704,12735,12772,12799,12831,12841,12872,12879,12881,12895,
    12928,12937,12977,12991,13055,13055,13312,19903,19968,42127,42183,42237,42240,42508,42512,42606,
    42623,42654,42656,42735,42744,42751,42775,42783,42786,42888,42891,43009,43011,43013,43015,43018,
    43020,43042,43052,43061,43066,43123,43128,43135,43138,43187,43205,43213,43216,43231,43250,43255,
    43259,43301,43312,43334,43348,43358,43360,43391,43396,43442,43470,43485,43488,43560,43575,43586,
    43588,43595,43598,43611,43616,43638,43642,43642,43644,43695,43697,43697,43701,43702,43705,43709,
    43712,43712,43714,43741,43744,43754,43762,43764,43767,44002,44014,55295,57344,64285,64287,64296,
    64298,64433,64450,64829,64832,65019,65022,65023,65050,65055,65063,65071,65107,65107,65127,65127,
    65132,65278,65280,65280,65296,65305,65313,65338,65345,65370,65382,65503,65511,65511,65519,65528,
    65536,65791,65795,65846,65856,65912,65930,65935,65948,65999,66046,66462,66464,66511,66513,67670,
    67672,67870,67872,67902,67904,68096,68100,68100,68103,68107,68112,68151,68155,68158,68160,68175,
    68185,68222,68224,68408,68416,69631,69635,69687,69710,69759,69763,69807,69826,69887,69891,69926,
    69941,69951,69956,70015,70019,70066,70081,70084,70089,71338,71352,74863,74868,94032,94079,94094,
    94099,118783,119030,119039,119079,119080,119262,119295,119366,119551,119639,120512,120514,120538,120540,120570,
    120572,120596,120598,120628,120630,120654,120656,120686,120688,120712,120714,120744,120746,120770,120772,126703,
    126706,126975,127020,127023,127124,127135,127151,127152,127167,127168,127184,127184,127200,127247,127279,127279,
    127340,127343,127387,127461,127491,127503,127547,127551,127561,127567,127570,127743,127777,127791,127798,127798,
    127869,127871,127892,127903,127941,127941,127947,127967,127985,127999,128063,128063,128065,128065,128248,128248,
    128253,128255,128318,128319,128324,128335,128360,128506,128577,128580,128592,128639,128710,128767,128884,917504,
    917506,917535,917632,917759,918000,1114111,
    ]),
    PLIEGUE: Object.freeze([
    65,90,1,32,181,181,1,775,192,192,1,-95,193,193,1,-96,
    194,194,1,-97,195,195,1,-98,196,196,1,-99,197,197,1,-100,
    198,198,1,32,199,199,1,-100,200,200,1,-99,201,201,1,-100,
    202,202,1,-101,203,203,1,-102,204,204,1,-99,205,205,1,-100,
    206,206,1,-101,207,207,1,-102,208,208,1,32,209,210,1,-99,
    211,211,1,-100,212,212,1,-101,213,213,1,-102,214,214,1,-103,
    216,216,1,32,217,217,1,-100,218,218,1,-101,219,219,1,-102,
    220,220,1,-103,221,221,1,-100,222,222,1,32,224,224,1,-127,
    225,225,1,-128,226,226,1,-129,227,227,1,-130,228,228,1,-131,
    229,231,2,-132,232,232,1,-131,233,233,1,-132,234,234,1,-133,
    235,235,1,-134,236,236,1,-131,237,237,1,-132,238,238,1,-133,
    239,239,1,-134,241,242,1,-131,243,243,1,-132,244,244,1,-133,
    245,245,1,-134,246,246,1,-135,249,249,1,-132,250,250,1,-133,
    251,251,1,-134,252,252,1,-135,253,253,1,-132,255,255,1,-134,
    256,256,1,-159,257,257,1,-160,258,258,1,-161,259,259,1,-162,
    260,260,1,-163,261,261,1,-164,262,262,1,-163,263,263,1,-164,
    264,264,1,-165,265,265,1,-166,266,266,1,-167,267,267,1,-168,
    268,268,1,-169,269,270,1,-170,271,271,1,-171,272,272,1,1,
    274,274,1,-173,275,275,1,-174,276,276,1,-175,277,277,1,-176,
    278,278,1,-177,279,279,1,-178,280,280,1,-179,281,281,1,-180,
    282,282,1,-181,283,283,1,-182,284,284,1,-181,285,285,1,-182,
    286,286,1,-183,287,287,1,-184,288,288,1,-185,289,289,1,-186,
    290,290,1,-187,291,292,1,-188,293,293,1,-189,294,294,1,1,
    296,296,1,-191,297,297,1,-192,298,298,1,-193,299,299,1,-194,
    300,300,1,-195,301,301,1,-196,302,302,1,-197,303,303,1,-198,
    304,304,1,-199,306,306,1,1,308,308,1,-202,309,310,1,-203,
    311,311,1,-204,313,313,1,-205,314,314,1,-206,315,315,1,-207,
    316,316,1,-208,317,317,1,-209,318,318,1,-210,319,321,2,1,
    323,323,1,-213,324,324,1,-214,325,325,1,-215,326,326,1,-216,
    327,327,1,-217,328,328,1,-218,330,330,1,1,332,332,1,-221,
    333,333,1,-222,334,334,1,-223,335,335,1,-224,336,336,1,-225,
    337,337,1,-226,338,338,1,1,340,340,1,-226,341,341,1,-227,
    342,342,1,-228,343,343,1,-229,344,344,1,-230,345,346,1,-231,
    347,347,1,-232,348,348,1,-233,349,349,1,-234,350,350,1,-235,
    351,351,1,-236,352,352,1,-237,353,354,1,-238,355,355,1,-239,
    356,356,1,-240,357,357,1,-241,358,358,1,1,360,360,1,-243,
    361,361,1,-244,362,362,1,-245,363,363,1,-246,364,364,1,-247,
    365,365,1,-248,366,366,1,-249,367,367,1,-250,368,368,1,-251,
    369,369,1,-252,370,370,1,-253,371,371,1,-254,372,372,1,-253,
    373,373,1,-254,374,374,1,-253,375,375,1,-254,376,377,1,-255,
    378,378,1,-256,379,379,1,-257,380,380,1,-258,381,381,1,-259,
    382,382,1,-260,383,383,1,-268,385,385,1,210,386,388,2,1,
    390,390,1,206,391,391,1,1,393,394,1,205,395,395,1,1,
    398,398,1,79,399,399,1,202,400,400,1,203,401,401,1,1,
    403,403,1,205,404,404,1,207,406,406,1,211,407,407,1,209,
    408,408,1,1,412,412,1,211,413,413,1,213,415,415,1,214,
    416,416,1,-305,417,417,1,-306,418,420,2,1,422,422,1,218,
    423,423,1,1,425,425,1,218,428,428,1,1,430,430,1,218,
    431,431,1,-314,432,432,1,-315,433,434,1,217,435,437,2,1,
    439,439,1,219,440,440,1,1,444,444,1,1,452,452,1,2,
    453,453,1,1,455,455,1,2,456,456,1,1,458,458,1,2,
    459,459,1,1,461,461,1,-364,462,462,1,-365,463,463,1,-358,
    464,464,1,-359,465,465,1,-354,466,466,1,-355,467,467,1,-350,
    468,468,1,-351,469,469,1,-352,470,470,1,-353,471,471,1,-354,
    472,472,1,-355,473,473,1,-356,474,474,1,-357,475,475,1,-358,
    476,476,1,-359,478,478,1,-381,479,479,1,-382,480,484,2,1,
    486,486,1,-383,487,487,1,-384,488,488,1,-381,489,489,1,-382,
    490,490,1,-379,491,491,1,-380,492,492,1,-381,493,493,1,-382,
    494,494,1,1,496,496,1,-390,497,497,1,2,498,498,1,1,
    500,500,1,-397,501,501,1,-398,502,502,1,-97,503,503,1,-56,
    504,504,1,-394,505,505,1,-395,506,506,1,-409,507,507,1,-410,
    508,510,2,1,512,512,1,-415,513,513,1,-416,514,514,1,-417,
    515,515,1,-418,516,516,1,-415,517,517,1,-416,518,518,1,-417,
    519,519,1,-418,520,520,1,-415,521,521,1,-416,522,522,1,-417,
    523,523,1,-418,524,524,1,-413,525,525,1,-414,526,526,1,-415,
    527,527,1,-416,528,528,1,-414,529,529,1,-415,530,530,1,-416,
    531,531,1,-417,532,532,1,-415,533,533,1,-416,534,534,1,-417,
    535,535,1,-418,536,536,1,-421,537,538,1,-422,539,539,1,-423,
    540,540,1,1,542,542,1,-438,543,543,1,-439,544,544,1,-130,
    546,548,2,1,550,550,1,-453,551,551,1,-454,552,552,1,-451,
    553,553,1,-452,554,554,1,-443,555,555,1,-444,556,556,1,-445,
    557,557,1,-446,558,558,1,-447,559,559,1,-448,560,560,1,-449,
    561,561,1,-450,562,562,1,-441,563,563,1,-442,570,570,1,10795,
    571,571,1,1,573,573,1,-163,574,574,1,10792,577,577,1,1,
    579,579,1,-195,580,580,1,69,581,581,1,71,582,590,2,1,
    880,882,2,1,886,886,1,1,902,902,1,38,904,906,1,37,
    908,908,1,64,910,911,1,63,913,929,1,32,931,939,1,32,
    962,962,1,1,975,975,1,8,976,976,1,-30,977,977,1,-25,
    981,981,1,-15,982,982,1,-22,984,1006,2,1,1008,1008,1,-54,
    1009,1009,1,-48,1012,1012,1,-60,1013,1013,1,-64,1015,1015,1,1,
    1017,1017,1,-7,1018,1018,1,1,1021,1023,1,-130,1024,1039,1,80,
    1040,1071,1,32,1120,1152,2,1,1162,1214,2,1,1216,1216,1,15,
    1217,1229,2,1,1232,1318,2,1,1329,1366,1,48,4256,4293,1,7264,
    4295,4295,1,7264,4301,4301,1,7264,7680,7680,1,-7583,7681,7682,1,-7584,
    7683,7683,1,-7585,7684,7684,1,-7586,7685,7685,1,-7587,7686,7686,1,-7588,
    7687,7688,1,-7589,7689,7690,1,-7590,7691,7691,1,-7591,7692,7692,1,-7592,
    7693,7693,1,-7593,7694,7694,1,-7594,7695,7695,1,-7595,7696,7696,1,-7596,
    7697,7697,1,-7597,7698,7698,1,-7598,7699,7700,1,-7599,7701,7701,1,-7600,
    7702,7702,1,-7601,7703,7703,1,-7602,7704,7704,1,-7603,7705,7705,1,-7604,
    7706,7706,1,-7605,7707,7707,1,-7606,7708,7708,1,-7607,7709,7710,1,-7608,
    7711,7712,1,-7609,7713,7714,1,-7610,7715,7715,1,-7611,7716,7716,1,-7612,
    7717,7717,1,-7613,7718,7718,1,-7614,7719,7719,1,-7615,7720,7720,1,-7616,
    7721,7721,1,-7617,7722,7722,1,-7618,7723,7724,1,-7619,7725,7725,1,-7620,
    7726,7726,1,-7621,7727,7727,1,-7622,7728,7728,1,-7621,7729,7729,1,-7622,
    7730,7730,1,-7623,7731,7731,1,-7624,7732,7732,1,-7625,7733,7734,1,-7626,
    7735,7735,1,-7627,7736,7736,1,-7628,7737,7737,1,-7629,7738,7738,1,-7630,
    7739,7739,1,-7631,7740,7740,1,-7632,7741,7742,1,-7633,7743,7743,1,-7634,
    7744,7744,1,-7635,7745,7745,1,-7636,7746,7746,1,-7637,7747,7748,1,-7638,
    7749,7749,1,-7639,7750,7750,1,-7640,7751,7751,1,-7641,7752,7752,1,-7642,
    7753,7753,1,-7643,7754,7754,1,-7644,7755,7756,1,-7645,7757,7757,1,-7646,
    7758,7758,1,-7647,7759,7759,1,-7648,7760,7760,1,-7649,7761,7761,1,-7650,
    7762,7762,1,-7651,7763,7764,1,-7652,7765,7765,1,-7653,7766,7766,1,-7654,
    7767,7767,1,-7655,7768,7768,1,-7654,7769,7769,1,-7655,7770,7770,1,-7656,
    7771,7771,1,-7657,7772,7772,1,-7658,7773,7773,1,-7659,7774,7774,1,-7660,
    7775,7776,1,-7661,7777,7777,1,-7662,7778,7778,1,-7663,7779,7779,1,-7664,
    7780,7780,1,-7665,7781,7781,1,-7666,7782,7782,1,-7667,7783,7783,1,-7668,
    7784,7784,1,-7669,7785,7786,1,-7670,7787,7787,1,-7671,7788,7788,1,-7672,
    7789,7789,1,-7673,7790,7790,1,-7674,7791,7791,1,-7675,7792,7792,1,-7676,
    7793,7794,1,-7677,7795,7795,1,-7678,7796,7796,1,-7679,7797,7797,1,-7680,
    7798,7798,1,-7681,7799,7799,1,-7682,7800,7800,1,-7683,7801,7801,1,-7684,
    7802,7802,1,-7685,7803,7804,1,-7686,7805,7805,1,-7687,7806,7806,1,-7688,
    7807,7808,1,-7689,7809,7809,1,-7690,7810,7810,1,-7691,7811,7811,1,-7692,
    7812,7812,1,-7693,7813,7813,1,-7694,7814,7814,1,-7695,7815,7815,1,-7696,
    7816,7816,1,-7697,7817,7818,1,-7698,7819,7819,1,-7699,7820,7820,1,-7700,
    7821,7822,1,-7701,7823,7824,1,-7702,7825,7825,1,-7703,7826,7826,1,-7704,
    7827,7827,1,-7705,7828,7828,1,-7706,7829,7829,1,-7707,7830,7830,1,-7726,
    7831,7831,1,-7715,7832,7832,1,-7713,7833,7833,1,-7712,7835,7835,1,-7720,
    7838,7838,1,-7615,7840,7840,1,-7743,7841,7841,1,-7744,7842,7842,1,-7745,
    7843,7843,1,-7746,7844,7844,1,-7747,7845,7845,1,-7748,7846,7846,1,-7749,
    7847,7847,1,-7750,7848,7848,1,-7751,7849,7849,1,-7752,7850,7850,1,-7753,
    7851,7851,1,-7754,7852,7852,1,-7755,7853,7853,1,-7756,7854,7854,1,-7757,
    7855,7855,1,-7758,7856,7856,1,-7759,7857,7857,1,-7760,7858,7858,1,-7761,
    7859,7859,1,-7762,7860,7860,1,-7763,7861,7861,1,-7764,7862,7862,1,-7765,
    7863,7863,1,-7766,7864,7864,1,-7763,7865,7865,1,-7764,7866,7866,1,-7765,
    7867,7867,1,-7766,7868,7868,1,-7767,7869,7869,1,-7768,7870,7870,1,-7769,
    7871,7871,1,-7770,7872,7872,1,-7771,7873,7873,1,-7772,7874,7874,1,-7773,
    7875,7875,1,-7774,7876,7876,1,-7775,7877,7877,1,-7776,7878,7878,1,-7777,
    7879,7879,1,-7778,7880,7880,1,-7775,7881,7881,1,-7776,7882,7882,1,-7777,
    7883,7883,1,-7778,7884,7884,1,-7773,7885,7885,1,-7774,7886,7886,1,-7775,
    7887,7887,1,-7776,7888,7888,1,-7777,7889,7889,1,-7778,7890,7890,1,-7779,
    7891,7891,1,-7780,7892,7892,1,-7781,7893,7893,1,-7782,7894,7894,1,-7783,
    7895,7895,1,-7784,7896,7896,1,-7785,7897,7897,1,-7786,7898,7898,1,-7787,
    7899,7899,1,-7788,7900,7900,1,-7789,7901,7901,1,-7790,7902,7902,1,-7791,
    7903,7903,1,-7792,7904,7904,1,-7793,7905,7905,1,-7794,7906,7906,1,-7795,
    7907,7907,1,-7796,7908,7908,1,-7791,7909,7909,1,-7792,7910,7910,1,-7793,
    7911,7911,1,-7794,7912,7912,1,-7795,7913,7913,1,-7796,7914,7914,1,-7797,
    7915,7915,1,-7798,7916,7916,1,-7799,7917,7917,1,-7800,7918,7918,1,-7801,
    7919,7919,1,-7802,7920,7920,1,-7803,7921,7921,1,-7804,7922,7922,1,-7801,
    7923,7923,1,-7802,7924,7924,1,-7803,7925,7925,1,-7804,7926,7926,1,-7805,
    7927,7927,1,-7806,7928,7928,1,-7807,7929,7929,1,-7808,7930,7934,2,1,
    7944,7951,1,-8,7960,7965,1,-8,7976,7983,1,-8,7992,7999,1,-8,
    8008,8013,1,-8,8025,8031,2,-8,8040,8047,1,-8,8072,8079,1,-8,
    8088,8095,1,-8,8104,8111,1,-8,8120,8121,1,-8,8122,8123,1,-74,
    8124,8124,1,-9,8126,8126,1,-7173,8136,8139,1,-86,8140,8140,1,-9,
    8152,8153,1,-8,8154,8155,1,-100,8168,8169,1,-8,8170,8171,1,-112,
    8172,8172,1,-7,8184,8185,1,-128,8186,8187,1,-126,8188,8188,1,-9,
    8486,8486,1,-7517,8490,8490,1,-8383,8491,8491,1,-8394,8498,8498,1,28,
    8544,8559,1,16,8579,8579,1,1,11264,11310,1,48,11360,11360,1,1,
    11362,11362,1,-10743,11363,11363,1,-3814,11364,11364,1,-10727,11367,11371,2,1,
    11373,11373,1,-10780,11374,11374,1,-10749,11375,11375,1,-10783,11376,11376,1,-10782,
    11378,11378,1,1,11381,11381,1,1,11390,11391,1,-10815,11392,11490,2,1,
    11499,11501,2,1,11506,11506,1,1,42560,42604,2,1,42624,42646,2,1,
    42786,42798,2,1,42802,42862,2,1,42873,42875,2,1,42877,42877,1,-35332,
    42878,42886,2,1,42891,42891,1,1,42893,42893,1,-42280,42896,42898,2,1,
    42912,42920,2,1,42922,42922,1,-42308,65313,65338,1,32,66560,66599,1,40,
    ]),
    CERO: Object.freeze([768,769,770,771,772,774,775,776,777,778,779,780,783,785,795,803,804,805,806,807,808,813,814,816,817]),
  });
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/shared/unicode61.js


























(function (R2) {
  'use strict';

  const U = R2.unicode61;
  if (!U || !Array.isArray(U.TOKEN)) {
    throw new Error('shared/tokenize.js necesita R2.unicode61 (shared/unicode61.js), que debe cargarse antes en src/orden.json');
  }
  const MAX_BYTES = 32768;


  const tokenBmp = new Uint8Array(0x10000);
  const pliegueBmp = new Int32Array(0x10000);
  const tokSupIni = [], tokSupFin = [];
  for (let i = 0; i < U.TOKEN.length; i += 2) {
    const a = U.TOKEN[i], b = U.TOKEN[i + 1];
    for (let c = a; c <= Math.min(b, 0xFFFF); c++) { tokenBmp[c] = 1; pliegueBmp[c] = c; }
    if (b > 0xFFFF) { tokSupIni.push(Math.max(a, 0x10000)); tokSupFin.push(b); }
  }
  const plSup = [];
  for (let i = 0; i < U.PLIEGUE.length; i += 4) {
    const a = U.PLIEGUE[i], b = U.PLIEGUE[i + 1], p = U.PLIEGUE[i + 2], d = U.PLIEGUE[i + 3];
    if (b <= 0xFFFF) { for (let c = a; c <= b; c += p) pliegueBmp[c] = c + d; }
    else plSup.push([a, b, p, d]);
  }
  const ceroSup = new Set();
  for (const c of U.CERO) { if (c <= 0xFFFF) pliegueBmp[c] = 0; else ceroSup.add(c); }

  function buscarTramo(inicios, fines, cp) {
    let lo = 0, hi = inicios.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (cp < inicios[m]) hi = m - 1;
      else if (cp > fines[m]) lo = m + 1;
      else return true;
    }
    return false;
  }

  function esToken(cp) {
    if (cp < 0x10000) return cp >= 0 && tokenBmp[cp] === 1;
    return cp <= 0x10FFFF && buscarTramo(tokSupIni, tokSupFin, cp);
  }

  function plegar(cp) {
    if (cp < 0x10000) return tokenBmp[cp] === 1 ? pliegueBmp[cp] : cp;
    if (ceroSup.has(cp)) return 0;
    let lo = 0, hi = plSup.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      const t = plSup[m];
      if (cp < t[0]) hi = m - 1;
      else if (cp > t[1]) lo = m + 1;
      else return (cp - t[0]) % t[2] === 0 ? cp + t[3] : cp;
    }
    return cp;
  }

  const bytesUtf8 = (cp) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);


  function cortar(t) {
    if (t.length * 3 <= MAX_BYTES) return t;
    let bytes = 0;
    for (let i = 0; i < t.length;) {
      const cp = t.codePointAt(i);
      const n = bytesUtf8(cp);
      if (bytes + n > MAX_BYTES) return t.slice(0, i) + (bytes < MAX_BYTES ? '�' : '');
      bytes += n;
      i += cp > 0xFFFF ? 2 : 1;
    }
    return t;
  }


  function tokens(texto) {
    const s = texto == null ? '' : String(texto);
    const n = s.length;
    const out = [];
    let i = 0;
    while (i < n) {
      let c = s.charCodeAt(i), w = 1;
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < n) {
        const d = s.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { c = ((c - 0xD800) << 10) + (d - 0xDC00) + 0x10000; w = 2; }
      }
      if (!(c < 0x10000 ? tokenBmp[c] === 1 : buscarTramo(tokSupIni, tokSupFin, c))) { i += w; continue; }
      const a = i;
      let t = '';
      for (;;) {
        const f = c < 0x10000 ? pliegueBmp[c] : plegar(c);
        if (f !== 0) t += f < 0x10000 ? String.fromCharCode(f) : String.fromCodePoint(f);
        i += w;
        if (i >= n) break;
        c = s.charCodeAt(i); w = 1;
        if (c >= 0xD800 && c <= 0xDBFF && i + 1 < n) {
          const d = s.charCodeAt(i + 1);
          if (d >= 0xDC00 && d <= 0xDFFF) { c = ((c - 0xD800) << 10) + (d - 0xDC00) + 0x10000; w = 2; }
        }
        if (!(c < 0x10000 ? tokenBmp[c] === 1 : buscarTramo(tokSupIni, tokSupFin, c))) break;
      }
      if (t) out.push({ t: cortar(t), a, b: i });
    }
    return out;
  }


  function plegarLibre(texto) {
    let out = '';
    for (const ch of String(texto == null ? '' : texto)) {
      const cp = ch.codePointAt(0);
      if (esToken(cp)) {
        const f = plegar(cp);
        if (f) out += String.fromCodePoint(f);
      } else out += ch;
    }
    return out;
  }

  R2.tokenize = Object.freeze({ MAX_BYTES, esToken, plegar, tokens, plegarLibre });
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/shared/tokenize.js








































(function (R2) {
  'use strict';

  const T = R2.tokenize;
  const V = R2.gen && R2.gen.vacias;
  if (!T || !V || !Array.isArray(V.VACIAS)) {
    throw new Error('shared/query.js necesita R2.tokenize (shared/tokenize.js) y R2.gen.vacias (engine/generated/vacias.js), cargados antes en src/orden.json');
  }
  const VACIAS = new Set(V.VACIAS);


  const ESPACIOS = new Set([0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x1C, 0x1D, 0x1E, 0x1F, 0x20, 0x85, 0xA0, 0x1680,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F,
    0x3000]);
  const esEspacio = (u) => ESPACIOS.has(u);
  const COMILLAS = /[«»“”„]/g;

  const MENSAJES = Object.freeze({
    ASTERISCO: 'El asterisco (*) no se admite en esta búsqueda: escriba la palabra completa o varias formas unidas con | (p. ej. agrario | agraria).',
    OPERADOR_TEXTO: (w) => `«${w}» no es un operador en esta búsqueda. Use + para exigir varias palabras y | para admitir cualquiera de ellas; NOT no está disponible. Si quiere buscar la palabra, escríbala en minúsculas.`,
    COMILLAS_VACIAS: 'Hay unas comillas vacías: escriba la frase entre ellas o quítelas.',
    COMILLAS_ABIERTAS: 'Faltan unas comillas de cierre: cada frase exacta va entre dos comillas (p. ej. "voto femenino").',
    PARENTESIS_VACIOS: 'Hay unos paréntesis vacíos: escriba algo dentro o quítelos.',
    FALTA_CIERRE: 'Falta cerrar un paréntesis: añada «)».',
    SOBRA_CIERRE: 'Sobra un paréntesis de cierre «)» (o falta el de apertura).',
    OP_INICIO: (op) => `Falta una palabra o frase antes de «${op}».`,
    OP_FINAL: (op) => `Falta una palabra o frase después de «${op}».`,
    OP_SEGUIDOS: (a, b) => `Hay dos operadores seguidos («${a} ${b}»): escriba una palabra o frase entre ellos.`,
    NADA: 'La consulta no contiene nada que buscar: escriba al menos una palabra con letras o cifras.',
    AVISO_OMITIDAS: (lista) => `Se han omitido palabras muy frecuentes (${lista}): casi todas las intervenciones las contienen. Si las necesita, póngalas entre comillas.`,
    AVISO_IGNORADAS: (lista, n) => `Se ${n === 1 ? 'ha ignorado un término' : 'han ignorado términos'} sin letras ni cifras (${lista}).`,
  });

  class ErrorConsulta extends Error {
    constructor(codigo, mensaje, posicion) {
      super(mensaje);
      this.name = 'ErrorConsulta';
      this.codigo = codigo;
      this.posicion = posicion;
    }
  }
  const fallo = (codigo, posicion, ...args) => {
    const m = MENSAJES[codigo];
    return new ErrorConsulta(codigo, typeof m === 'function' ? m(...args) : m, posicion);
  };

  function normalizar(texto) {
    let s = texto == null ? '' : String(texto);
    try { s = s.normalize('NFC'); } catch (e) {   }
    return s.replace(COMILLAS, '"');
  }


  const ESPECIALES = '"+|()*';



  function lexemas(s) {
    const out = [];
    const n = s.length;
    let i = 0;
    while (i < n) {
      const u = s.charCodeAt(i);
      if (esEspacio(u)) { i++; continue; }
      const ch = s[i];
      if (ch === '"') {
        const j = s.indexOf('"', i + 1);
        if (j < 0) { out.push({ tipo: 'error', a: i, b: n, error: fallo('COMILLAS_ABIERTAS', i) }); break; }
        const dentro = s.slice(i + 1, j);
        const ast = dentro.indexOf('*');
        if (ast >= 0) out.push({ tipo: 'error', a: i, b: j + 1, error: fallo('ASTERISCO', i + 1 + ast) });
        else if (![...dentro].some((c) => !esEspacio(c.charCodeAt(0)))) out.push({ tipo: 'error', a: i, b: j + 1, error: fallo('COMILLAS_VACIAS', i) });
        else out.push({ tipo: 'frase', texto: dentro, a: i, b: j + 1, desde: i + 1 });
        i = j + 1;
        continue;
      }
      if (ch === '*') { out.push({ tipo: 'error', a: i, b: i + 1, error: fallo('ASTERISCO', i) }); i++; continue; }
      if (ch === '+' || ch === '|' || ch === '(' || ch === ')') { out.push({ tipo: ch, a: i, b: i + 1 }); i++; continue; }
      let j = i;
      while (j < n && !esEspacio(s.charCodeAt(j)) && ESPECIALES.indexOf(s[j]) < 0) j++;
      const w = s.slice(i, j);
      if (w === 'AND' || w === 'OR' || w === 'NOT') out.push({ tipo: 'error', a: i, b: j, error: fallo('OPERADOR_TEXTO', i, w) });
      else out.push({ tipo: 'palabra', texto: w, a: i, b: j, desde: i });
      i = j;
    }
    return out;
  }


  function analizarSintaxis(s, L) {
    let k = 0;
    const fin = { tipo: 'fin', a: s.length, b: s.length };
    const ver = () => (k < L.length ? L[k] : fin);
    const esOp = (t) => t && (t.tipo === '+' || t.tipo === '|');

    function sinPrimario() {
      const t = ver();
      const p = k > 0 ? L[k - 1] : null;
      if (t.tipo === 'error') throw t.error;
      if (esOp(t)) {
        if (esOp(p)) throw fallo('OP_SEGUIDOS', t.a, p.tipo, t.tipo);
        throw fallo('OP_INICIO', t.a, t.tipo);
      }
      if (t.tipo === ')') {
        if (p && p.tipo === '(') throw fallo('PARENTESIS_VACIOS', p.a);
        if (esOp(p)) throw fallo('OP_FINAL', p.a, p.tipo);
        throw fallo('SOBRA_CIERRE', t.a);
      }
      if (esOp(p)) throw fallo('OP_FINAL', p.a, p.tipo);
      if (p && p.tipo === '(') throw fallo('FALTA_CIERRE', p.a);
      throw fallo('NADA', 0);
    }

    function hoja(t) {
      const toks = T.tokens(t.texto).map((x) => ({ t: x.t, a: x.a + t.desde, b: x.b + t.desde }));
      return { tipo: t.tipo, texto: t.texto, a: t.a, b: t.b, tokens: toks };
    }

    function primario() {
      const t = ver();
      if (t.tipo === 'palabra' || t.tipo === 'frase') { k++; return hoja(t); }
      if (t.tipo === '(') {
        k++;
        const dentro = orExpr();
        const c = ver();
        if (c.tipo !== ')') {
          if (c.tipo === 'error') throw c.error;
          throw fallo('FALTA_CIERRE', t.a);
        }
        k++;
        return { tipo: 'grupo', hijo: dentro, a: t.a, b: c.b };
      }
      return sinPrimario();
    }

    function andExpr() {
      const hijos = [primario()];
      for (;;) {
        const t = ver();
        if (t.tipo === '+') { k++; hijos.push(primario()); continue; }
        if (t.tipo === 'palabra' || t.tipo === 'frase' || t.tipo === '(' || t.tipo === 'error') { hijos.push(primario()); continue; }
        return { tipo: 'y', hijos };
      }
    }

    function orExpr() {
      const hijos = [andExpr()];
      while (ver().tipo === '|') { k++; hijos.push(andExpr()); }
      return { tipo: 'o', hijos };
    }

    const arbol = orExpr();
    const resto = ver();
    if (resto.tipo === ')') throw fallo('SOBRA_CIERRE', resto.a);
    if (resto.tipo === 'error') throw resto.error;
    return arbol;
  }


  const textoHoja = (h) => (h.tipo === 'frase' ? `"${h.texto}"` : h.texto);

  function simplificar(nodo, info) {
    switch (nodo.tipo) {
      case 'palabra':
      case 'frase':
        if (!nodo.tokens.length) { info.ignoradas.push(textoHoja(nodo)); return null; }
        return nodo;
      case 'grupo': {
        const h = simplificar(nodo.hijo, info);
        if (h) h.protegido = true;
        return h;
      }
      case 'y': {
        let hijos = nodo.hijos.map((h) => simplificar(h, info)).filter(Boolean);
        const esVacia = (h) => h.tipo === 'palabra' && !h.protegido && h.tokens.length === 1 && VACIAS.has(h.tokens[0].t);
        if (hijos.some((h) => !esVacia(h))) {
          for (const h of hijos) if (esVacia(h)) info.omitidas.push(h.texto);
          hijos = hijos.filter((h) => !esVacia(h));
        }
        return combinar('y', hijos);
      }
      case 'o':
        return combinar('o', nodo.hijos.map((h) => simplificar(h, info)).filter(Boolean));
      default:
        throw new Error(`query: nodo desconocido ${nodo.tipo}`);
    }
  }

  function combinar(tipo, hijos) {
    const planos = [];
    for (const h of hijos) {
      if (h.tipo === tipo) planos.push(...h.hijos);
      else planos.push(h);
    }
    if (!planos.length) return null;
    if (planos.length === 1) return planos[0];
    return { tipo, hijos: planos };
  }


  const originales = (s, h) => h.tokens.map((x) => s.slice(x.a, x.b)).join(' ');

  function fts(s, nodo) {
    if (nodo.tipo === 'palabra' || nodo.tipo === 'frase') return `"${originales(s, nodo)}"`;
    return nodo.hijos.map((h) => (h.tipo === 'y' || h.tipo === 'o' ? `(${fts(s, h)})` : fts(s, h))).join(nodo.tipo === 'y' ? ' AND ' : ' OR ');
  }

  function interpretacion(s, nodo) {
    if (nodo.tipo === 'palabra' || nodo.tipo === 'frase') {
      return nodo.tipo === 'palabra' && nodo.tokens.length === 1 ? originales(s, nodo) : `«${originales(s, nodo)}»`;
    }
    return nodo.hijos.map((h) => (h.tipo === 'y' || h.tipo === 'o' ? `(${interpretacion(s, h)})` : interpretacion(s, h))).join(nodo.tipo === 'y' ? ' Y ' : ' O ');
  }

  function hojas(nodo, out = []) {
    if (nodo.tipo === 'palabra' || nodo.tipo === 'frase') out.push(nodo);
    else for (const h of nodo.hijos) hojas(h, out);
    return out;
  }

  const unicos = (lista) => [...new Set(lista)];

  function analizarSinMemo(texto) {
    const normalizado = normalizar(texto);
    const res = { ok: true, vacia: false, error: null, fts: '', interpretacion: '', avisos: [], omitidas: [], ignoradas: [],
      terminos: [], normalizado };
    const L = lexemas(normalizado);
    if (!L.length) { res.vacia = true; return res; }
    try {
      const info = { omitidas: [], ignoradas: [] };
      const arbol = simplificar(analizarSintaxis(normalizado, L), info);
      res.omitidas = unicos(info.omitidas);
      res.ignoradas = unicos(info.ignoradas);
      if (!arbol) throw fallo('NADA', 0);
      res.fts = fts(normalizado, arbol);
      res.interpretacion = interpretacion(normalizado, arbol);
      res.terminos = unicos(hojas(arbol).map((h) => h.tokens.map((x) => x.t).join(' ')));
      if (res.omitidas.length) res.avisos.push(MENSAJES.AVISO_OMITIDAS(res.omitidas.join(', ')));
      if (res.ignoradas.length) res.avisos.push(MENSAJES.AVISO_IGNORADAS(res.ignoradas.join(' '), res.ignoradas.length));
      res.arbol = arbol;
    } catch (e) {
      if (!(e instanceof ErrorConsulta)) throw e;
      res.ok = false;
      res.error = { codigo: e.codigo, mensaje: e.message, posicion: e.posicion };
      res.fts = '';
      res.interpretacion = '';
      res.terminos = [];
      res.avisos = [];
    }
    return res;
  }


  const MEMO_MAX = 16;
  const memo = new Map();
  function analizar(texto) {
    const clave = texto == null ? '' : String(texto);
    let r = memo.get(clave);
    if (r) { memo.delete(clave); memo.set(clave, r); return r; }
    r = analizarSinMemo(clave);
    memo.set(clave, r);
    if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value);
    return r;
  }

  function queryTerms(texto) {
    const r = analizar(texto);
    return r.ok ? r.terminos.slice() : [];
  }


  function termRanges(raw, terms) {
    if (!raw || !terms || !terms.length) return [];
    const porPrimero = new Map();
    for (const term of terms) {


      const seq = (Array.isArray(term) ? term : [term]).flatMap((x) => T.tokens(String(x)).map((tk) => tk.t));
      if (!seq.length) continue;
      let l = porPrimero.get(seq[0]);
      if (!l) porPrimero.set(seq[0], (l = []));
      l.push(seq);
    }
    if (!porPrimero.size) return [];
    const toks = T.tokens(raw);
    const marcas = [];
    for (let i = 0; i < toks.length; i++) {
      const cands = porPrimero.get(toks[i].t);
      if (!cands) continue;
      for (const seq of cands) {
        if (i + seq.length > toks.length) continue;
        let ok = true;
        for (let j = 1; j < seq.length; j++) if (toks[i + j].t !== seq[j]) { ok = false; break; }
        if (ok) marcas.push([toks[i].a, toks[i + seq.length - 1].b]);
      }
    }
    marcas.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const fusion = [];
    for (const m of marcas) {
      const u = fusion[fusion.length - 1];
      if (u && m[0] <= u[1]) u[1] = Math.max(u[1], m[1]);
      else fusion.push([m[0], m[1]]);
    }
    return fusion;
  }


  function stripPy(s) {
    let a = 0, b = s.length;
    while (a < b && esEspacio(s.charCodeAt(a))) a++;
    while (b > a && esEspacio(s.charCodeAt(b - 1))) b--;
    return s.slice(a, b);
  }


  function parseTerms(texto) {
    if (texto == null) return [];
    const s = String(texto).replace(COMILLAS, '"');
    const nComillas = (s.match(/"/g) || []).length;
    const sinCerrar = nComillas % 2 ? s.lastIndexOf('"') : -1;
    const trozos = [];
    let actual = '', dentro = false;
    for (let k = 0; k < s.length; k++) {
      const ch = s[k];
      if (ch === '"' && k !== sinCerrar) dentro = !dentro;
      if (ch === ',' && !dentro) { trozos.push(actual); actual = ''; }
      else actual += ch;
    }
    trozos.push(actual);
    return trozos.map(stripPy).filter(Boolean);
  }










  function seedTerms(texto, max = 8) {
    const q = stripPy(normalizar(texto));
    if (!q) return [];
    let brutos = [];
    if (q.replace(/"[^"]*"/g, '').includes(',')) {
      brutos = parseTerms(q);
    } else {
      let saltar = false;
      const n = q.length;
      let i = 0;
      while (i < n) {
        const u = q.charCodeAt(i);
        if (esEspacio(u) || '+|()'.indexOf(q[i]) >= 0) { i++; continue; }
        if (q[i] === '"') {
          let j = q.indexOf('"', i + 1);
          if (j < 0) j = n;
          const toks = T.tokens(q.slice(i + 1, j));
          if (saltar) saltar = false;
          else if (toks.length) brutos.push(`"${toks.map((x) => q.slice(i + 1 + x.a, i + 1 + x.b)).join(' ')}"`);
          i = j + 1;
          continue;
        }
        let j = i;
        while (j < n && !esEspacio(q.charCodeAt(j)) && '"+|()'.indexOf(q[j]) < 0) j++;
        const w = q.slice(i, j);
        i = j;
        if (w === 'AND' || w === 'OR' || w === 'NOT') { saltar = w === 'NOT'; continue; }
        if (saltar) { saltar = false; continue; }
        const toks = T.tokens(w);
        if (!toks.length) continue;
        if (toks.length === 1) {
          if (VACIAS.has(toks[0].t)) continue;
          brutos.push(w.slice(toks[0].a, toks[0].b) + (w.endsWith('*') ? '*' : ''));
        } else {
          brutos.push(`"${toks.map((x) => w.slice(x.a, x.b)).join(' ')}"`);
        }
      }
    }
    const out = [], vistos = new Set();
    for (const t of brutos) {
      const clave = T.plegarLibre(t);
      if (!vistos.has(clave)) { vistos.add(clave); out.push(t); }
    }
    return out.slice(0, Math.max(0, max));
  }

  R2.query = Object.freeze({
    MENSAJES, ErrorConsulta, normalizar, lexemas, analizar, interpretar: analizar, queryTerms, termRanges, seedTerms,
    parseTerms, hojas,
  });
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/shared/query.js

























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




'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PAGE = 50;

const S = {
  info: null, facets: null, collections: [], corpora: [],
  mode:   'keyword' , query: '', variants: false, order: 'relevance',




  filters: {}, results: [], total: 0, offset: 0, ms: 0,
  membership: {}, selected: null, view: 'search',
  loading: false, exhausted: false, lastMeta: null,
  libSel: null, similarOf: null, seq: 0,


  searchStale: false,


  cursor: null, current: null, readMode: 'speech', readSeq: 0,
  speechScroll: null, session: null,

  libTab: 'items', libSeq: 0, libInfo: null,

  lex: { cache: new Map(), data: null, cid: null, seq: 0, ctrl: null, showAll: false, solo: lexSoloGuardado() },
  coo: { cache: new Map(), data: null, cid: null, seq: 0, ctrl: null, unidad: 'intervencion', vocabulario: 250, vecinos: 10,
         resolucion: 1, expresiones: true, excl: { cid: null, aplicados: new Set(), marcados: new Set() }, lectModo: 'variada', lectN: 10 },
  careo: null,
};


const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));


const agrupa = s => String(s).replace(/^(-?\d)(\d{3})(?=,|$)/, '$1.$2');
const nf = n => agrupa((n ?? 0).toLocaleString('es-ES'));


const listScroller = () => $('#listScroll') || $('#hits');

function fechaLarga(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

function toast(msg, err = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  const box = $('#toasts');


  if (box.showPopover) {
    try { if (box.matches(':popover-open')) box.hidePopover(); box.showPopover(); } catch {   }
  }
  box.append(el);
  setTimeout(() => el.remove(), err ? 5200 : 2700);
}

async function api(path, opts = {}) {
  const r = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) {
    let d = {};
    try { d = await r.json(); } catch {   }
    const err = new Error(d.error || `Error ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}



function foldMap(raw) {
  let folded = ''; const map = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (let k = 0; k < c.length; k++) { folded += c[k]; map.push(i); }
  }
  return { folded, map };
}



const VACIAS = new Set(`a al algo alguna algunas alguno algunos ante antes aquel
aquella aquellas aquello aquellos aqui asi aun aunque cada como con contra cual
cuales cuando cuanto de del desde donde dos e el ella ellas ello ellos en entre
era eran es esa esas ese eso esos esta estaba estan estar estas este esto estos
fue fuera fueron ha habia han hasta hay la las le les lo los mas me mi mis mucho
muchos muy nada ni no nos nuestra nuestro o otra otras otro otros para pero poco
por porque pues que quien quienes se ser si sin sobre solo son su sus tal tambien
tan tanto te tiene tienen toda todas todo todos tras un una unas uno unos y ya yo`
  .split(/\s+/).filter(Boolean));





function queryTerms(q, variants = false) {




  const Q = globalThis.R2 && globalThis.R2.query;
  return Q && typeof Q.queryTerms === 'function' ? Q.queryTerms(q) : [];


















}


function termRanges(raw, terms) {
  if (!raw || !terms || !terms.length) return [];



  const Q = globalThis.R2 && globalThis.R2.query;
  return Q && typeof Q.termRanges === 'function' ? Q.termRanges(raw, terms) : [];




























}






function proyecta(a, b, fixes, ra, rb) {
  const lo = Math.max(a, ra), hi = Math.min(b, rb);
  if (lo >= hi) return null;
  let off = 0, ia = null, ib = null;
  for (const [fa, fb, rep] of fixes) {
    if (fa < a || fa >= b) continue;
    if (ia === null && lo < fb) ia = lo <= fa ? lo - a + off : fa - a + off;
    if (ib === null && hi <= fb) ib = hi <= fa ? hi - a + off : fa - a + off + rep.length;
    off += rep.length - (fb - fa);
  }
  if (ia === null) ia = lo - a + off;
  if (ib === null) ib = hi - a + off;
  return ia < ib ? [ia, ib] : null;
}




function paint(t, ranges, from = 0, to = t.length) {
  const ev = new Map();
  const bump = (p, k, d) => {
    const e = ev.get(p) || { c: 0, m: 0 };
    e[k] += d; ev.set(p, e);
  };
  for (const [a, b, k] of ranges || []) {
    const lo = Math.max(a, from), hi = Math.min(b, to);
    if (lo < hi) { bump(lo, k, 1); bump(hi, k, -1); }
  }
  if (!ev.size) return esc(t.slice(from, to));
  const pts = [...new Set([from, to, ...ev.keys()])].sort((x, y) => x - y);
  let html = '', c = 0, m = 0, inC = false, inM = false;
  for (let i = 0; i < pts.length - 1; i++) {
    const e = ev.get(pts[i]);
    if (e) { c += e.c; m += e.m; }
    const wantC = c > 0, wantM = m > 0;
    if (wantC !== inC) {
      if (inM) { html += '</mark>'; inM = false; }
      html += wantC ?   '<span>'  : '</span>';
      inC = wantC;
    }
    if (wantM !== inM) { html += wantM ? '<mark>' : '</mark>'; inM = wantM; }
    html += esc(t.slice(pts[i], pts[i + 1]));
  }
  if (inM) html += '</mark>';
  if (inC) html += '</span>';
  return html;
}


const ACOT_CLASES = new Set(['applause', 'conflict', 'order', 'neutral']);
const acotClase = c => (ACOT_CLASES.has(c) ? c : 'neutral');
const CHAIR_ROLES = new Set(['chair', 'vicechair', 'chair_age']);



const DOC_ROLES = new Set(['summary', 'remark']);
const DOC_NOMBRE = { summary: 'Encabezado y sumario de la sesión', remark: 'Texto sin orador' };


const DOC_POR_SPEAKER = { SUMARIO: 'summary', COMENTARIOS: 'remark' };
const docRole = x => (!x ? null
  : DOC_ROLES.has(x.role) ? x.role
  : DOC_POR_SPEAKER[(x.speaker || '').trim().toUpperCase()] || null);
const docNombre = x => DOC_NOMBRE[docRole(x)] || (x && (x.speaker_label || x.speaker)) || '';
const ident = v => !!v && v !== 'Sin identificar';







function hlContext(doc, { terms = [], raw = null, span = null } = {}) {
  const fix = (doc.fix || []).slice().sort((x, y) => x[0] - y[0]);
  if (raw != null) {
    const H = termRanges(raw, terms).map(([a, b]) => [a, b, 'm']);
    if (span && span[1] > span[0]) H.push([span[0], span[1], 'c']);
    H.sort((x, y) => x[0] - y[0]);
    return {
      fix,
      rangesFor(t, a, b) {
        if (a == null || b == null || !H.length) return [];
        const out = [];
        for (const [ra, rb, k] of H) {
          if (ra >= b) break;
          if (rb <= a) continue;
          const p = proyecta(a, b, fix, ra, rb);
          if (p) out.push([p[0], p[1], k]);
        }
        return out;
      },
    };
  }
  return {
    fix,
    rangesFor: t => (terms.length ? termRanges(t, terms).map(([x, y]) => [x, y, 'm']) : []),
  };
}



function leafHTML(t, a, b, ctx, units) {
  t = t || '';
  const rs = ctx.rangesFor(t, a, b);
  if (!units || !units.length || a == null) return paint(t, rs);
  let html = '', pos = 0;
  for (const u of units) {
    if (u.a == null || u.b == null) continue;
    const p = proyecta(a, b, ctx.fix, u.a, u.b);
    if (!p || p[0] < pos) continue;
    const [ua, ub] = p;
    html += paint(t, rs, pos, ua);
    let inner = '', s = ua;
    if (u.who && t.startsWith(u.who, ua) && ua + u.who.length <= ub) {
      inner += `<span class="acot-who">${paint(t, rs, ua, ua + u.who.length)}</span>`;
      s = ua + u.who.length;
    }
    inner += paint(t, rs, s, ub);
    html += `<span class="acot-u ${acotClase(u.c)}">${inner}</span>`;
    pos = ub;
  }
  return html + paint(t, rs, pos, t.length);
}

function segsHTML(segs, ctx) {
  return (segs || []).map(g => {
    if (g.k === 'acot') {
      return `<span class="acot-inline ${acotClase(g.c)}">${leafHTML(g.t, g.a, g.b, ctx, g.u)}</span>`;
    }
    if (g.k === 'note') return `<span class="acta-note-inline">${leafHTML(g.t, g.a, g.b, ctx)}</span>`;
    return leafHTML(g.t, g.a, g.b, ctx);
  }).join('');
}



function tableRowHTML(r, ctx) {
  const t = r.t || '';
  const m = t.match(/^([\s\S]*?\S)\s*\.{3,}[\s.]*(\d[\d.,]*)\s*$/);
  if (!m) return `<div class="acta-row">${leafHTML(t, r.a, r.b, ctx)}</div>`;
  const rs = ctx.rangesFor(t, r.a, r.b);
  const numAt = t.lastIndexOf(m[2]);
  return `<div class="acta-row"><span class="lead-t">${paint(t, rs, 0, m[1].length)}</span>`
    + `<span class="lead-f" aria-hidden="true"></span>`
    + `<span class="lead-n">${paint(t, rs, numAt, numAt + m[2].length)}</span></div>`;
}



function plainDoc(raw) {
  raw = raw || '';
  const blocks = []; let n = 0;
  const re = /\n\s*\n/g; let pos = 0, m;
  const push = (a, b) => {
    const t = raw.slice(a, b);
    const lead = t.length - t.trimStart().length, tail = t.length - t.trimEnd().length;
    if (a + lead >= b - tail) return;
    n++;
    blocks.push({ t: 'par', a: a + lead, b: b - tail, cont: false, n,
      s: [{ k: 'txt', a: a + lead, b: b - tail, t: raw.slice(a + lead, b - tail).replace(/\n/g, ' ') }] });
  };
  while ((m = re.exec(raw))) { push(pos, m.index); pos = m.index + m[0].length; }
  push(pos, raw.length);
  return { blocks, fix: [], n };
}



function renderDoc(doc, sid, hl = {}) {
  doc = doc || plainDoc('');
  const ctx = hlContext(doc, hl);
  const id = Number(sid) || 0;
  const out = [];
  let first = true;
  for (const b of doc.blocks || []) {
    switch (b.t) {
      case 'par': {
        const ancla = !b.cont && b.n != null;
        const tit = b.split === 'sentences'
          ? ' title="El original no separa párrafos: este § se ha cortado por frases"' : '';
        const cls = 'fp' + (b.cont ? ' cont' : '') + (first ? ' first' : '');
        out.push(`<p class="${cls}"${ancla ? ` id="p-${id}-${b.n}"` : ''}>`
          + (ancla ? `<span class="fp-anchor"${tit}>§ ${b.n}</span>` : '')
          + `${segsHTML(b.s, ctx)}</p>`);
        first = false;
        break;
      }
      case 'stage':
        out.push(`<div class="acot ${acotClase(b.c)}">${leafHTML(b.tx, b.src === 'speaker' ? null : b.a, b.b, ctx, b.u)}</div>`);
        break;
      case 'turn':
        out.push(`<p class="acta-turn"><span class="acta-who">${leafHTML(b.who?.t, b.who?.a, b.who?.b, ctx)}</span> `
          + `${segsHTML(b.s, ctx)}</p>`);
        first = false;
        break;
      case 'chron':
        out.push(`<p class="acta-chronicle">${segsHTML(b.s, ctx)}</p>`);
        break;
      case 'note':
        out.push(`<p class="acta-note">${segsHTML(b.s, ctx)}</p>`);
        break;
      case 'list':
        out.push(`<div class="acta-list${b.kind ? ` ${esc(b.kind)}` : ''}">`
          + (b.head ? `<div class="acta-list-head">${leafHTML(b.head.t, b.head.a, b.head.b, ctx)}</div>` : '')
          + `<ul class="acta-list-items">${(b.items || []).map(it =>
              `<li>${leafHTML(it.t, it.a, it.b, ctx)}</li>`).join('')}</ul>`
          + (b.total ? `<div class="acta-list-total">${leafHTML(b.total.t, b.total.a, b.total.b, ctx)}</div>` : '')
          + `</div>`);
        break;
      case 'table':
        out.push(`<div class="acta-table"${b.n != null ? ` id="p-${id}-${b.n}"` : ''}>`
          + (b.n != null ? `<span class="fp-anchor">§ ${b.n}</span>` : '')
          + (b.rows || []).map(r => tableRowHTML(r, ctx)).join('') + `</div>`);
        first = false;
        break;
      case 'art':
        break;
      default:
        if (b.s) out.push(`<p class="fp">${segsHTML(b.s, ctx)}</p>`);
        else if (b.tx) out.push(`<p class="fp">${leafHTML(b.tx, b.a, b.b, ctx)}</p>`);
    }
  }
  return out.join('') || '<p class="fp first"><em>Sin texto.</em></p>';
}



function renderText(raw, terms, span) {
  raw = raw || '';
  const rs = termRanges(raw, terms).map(([a, b]) => [a, b, 'm']);
  if (span && span[1] > span[0]) rs.push([span[0], span[1], 'c']);
  return paint(raw, rs);
}

function snippetHTML(s) {
  return esc(s || '').replace(/&lt;&lt;&lt;/g, '<mark>').replace(/&gt;&gt;&gt;/g, '</mark>');
}


async function boot() {




  let temaGuardado = null;
  try { temaGuardado = localStorage.getItem('tema'); } catch { temaGuardado = null; }
  document.documentElement.dataset.theme = temaGuardado === 'dark' ? 'dark' : 'light';







  try {
    for (const f of ['16px "2REP Garamond"', 'italic 16px "2REP Garamond"', '16px "2REP Didot"', '16px "2REP Mono"'])
      document.fonts?.load(f).catch(() => {});
  } catch {   }
  try {
    const info = await api('/info');
    S.info = info.corpus; S.corpora = info.available || [];
    if (!S.info) { noCorpus(info); return; }
    S.facets = await api('/facets');
    trendRangesDesdeFacetas(S.facets);
    S.collections = (await api('/collections')).collections;
    exprRestaurar();
    renderHeader(); renderFilters(); wire();
    setSideCollapsed(sideCollapsedSaved(), { guardar: false });
    setListCollapsed(listCollapsedSaved(), { guardar: false });
    search(true);
  } catch (e) { fatal(e.message); }
}

function noCorpus(info) {
  S.corpora = info.available || [];




  $('#hits').innerHTML = `<div class="empty"><div class="big">⌸</div>
    <h3>No hay ningún corpus abierto</h3>
    <p>Recargue la página y elija el CSV de intervenciones de un país.</p></div>`;
  $('#corpusStat').textContent = 'sin corpus';
}

function fatal(msg) {
  $('#hits').innerHTML = `<div class="empty"><div class="big">⚠</div>
    <h3>No se pudo iniciar</h3><p>${esc(msg)}</p></div>`;
}

function renderHeader() {
  const i = S.info;
  $('#corpusStat').textContent =


    `${i.title || 'Diarios de sesiones'} · ` +

    `${nf(i.n_speeches)} intervenciones · ${nf(i.n_sessions || 0)} sesiones · ${i.date_min?.slice(0, 4)}–${i.date_max?.slice(0, 4)}`
      ;
  $('#q').placeholder = placeholderBusqueda(i);
  if (!i.has_semantic) {
    for (const b of $$('.modes button')) if (b.dataset.mode !== 'keyword') b.disabled = true;
    setMode('keyword');
  }
}



function placeholderBusqueda(i) {



  return `Buscar en ${nf(i.n_speeches)} intervenciones… p. ej. presupuesto + educación | "derechos humanos"`;

}







const GRUPOS = {};

function itemsHTML(id, aguja = '') {
  const g = GRUPOS[id];
  if (!g) return '';
  const sel = new Set((S.filters[g.key] || []).map(String));
  const necesita = aguja ? foldMap(aguja).folded : '';

  // Los partidos se buscan también por su nombre completo y por las etiquetas del CSV que reúnen
  const casa = v => {
    if (!necesita) return true;
    const etq = [g.etiquetas[v.value] || v.value || '', v.nombre || '', ...(v.etiquetas || []).map(e => e[0])].join(' ');
    return foldMap(String(etq)).folded.includes(necesita);
  };
  const titulo = (v, lbl) => {
    if (!v.nombre && !v.etiquetas) return lbl;
    const e = v.etiquetas || [];
    return [v.nombre || lbl, e.length ? `Reúne en el CSV: ${e.slice(0, 8).map(x => x[0]).join(' · ')}${e.length > 8 ? ` y ${nf(e.length - 8)} más` : ''}` : '']
      .filter(Boolean).join('\n');
  };

  const valor = v => (g.key === 'rep_ids' ? v.rep_id : v.value);


  const elegidos = g.valores.filter(v => sel.has(String(valor(v))));
  const resto = g.valores.filter(v => !sel.has(String(valor(v))) && casa(v));
  const visibles = [...elegidos, ...resto.slice(0, g.max)];

  const fila = v => {
    const val = valor(v);
    const lbl = g.etiquetas[v.value] || v.value;
    const on = sel.has(String(val)) ? ' checked' : '';
    const extra = v.party && v.party !== 'Sin identificar'
      ? `<span class="n" style="opacity:.7">${esc(v.party)}</span>` : '';
    return `<label class="chk"><input type="checkbox" data-fkey="${g.key}" value="${esc(val)}"${on}>
      <span class="lbl" title="${esc(titulo(v, lbl))}">${esc(lbl)}</span>
      ${extra}<span class="n">${nf(v.n)}</span></label>`;
  };

  const pie = resto.length > g.max
    ? `<p class="dsub" style="margin:7px 0 0;font-size:11px">Mostrando
       ${nf(visibles.length)} de ${nf(elegidos.length + resto.length)}.
       Escriba arriba para encontrar el resto.</p>`
    : (necesita && !resto.length && !elegidos.length
        ? `<p class="dsub" style="margin:7px 0 0;font-size:11px">Sin coincidencias.</p>`
        : '');

  return visibles.map(fila).join('') + pie;
}

function grupo(id, titulo, valores, key, { max = 400, buscador = false, etiquetas = {} } = {}) {
  GRUPOS[id] = { valores: valores || [], key, max, etiquetas };
  const sel = new Set((S.filters[key] || []).map(String));
  const n = sel.size ? `<span class="count">${sel.size}</span>` : '';
  return `<details class="fgroup" id="fg-${id}"${sel.size ? ' open' : ''}>
    <summary>${titulo}${n}</summary>
    <div class="fbody${(valores || []).length > 9 ? ' tall' : ''}">
      ${buscador ? `<div class="field"><input type="search" class="fsearch" data-grupo="${id}"
         placeholder="Buscar entre ${nf((valores || []).length)}…" autocomplete="off"></div>` : ''}
      <div class="fitems" data-grupo="${id}">${itemsHTML(id)}</div>
    </div></details>`;
}

function renderFilters() {
  const f = S.facets, L = f.labels || {};
  $('#filters').innerHTML = `
    <details class="fgroup" open><summary>Qué se busca</summary><div class="fbody">
      <label class="fdoc"><input type="checkbox" id="fSinDocs"${S.filters.exclude_docs ? ' checked' : ''}>
        <span><b>Solo lo que se habla</b>
        <small>Deja fuera las filas sin orador: el encabezado y sumario de cada sesión y
        otros textos del Diario (anexos, listas de votación) que no son palabras de un
        diputado.</small></span></label>
    </div></details>

    <details class="fgroup" open><summary>Fecha y sesión</summary><div class="fbody">
      <div class="row2">
        <div class="field"><label>Desde</label><input type="date" id="fDesde"
          min="${f.date_min}" max="${f.date_max}" value="${S.filters.date_from || ''}"></div>
        <div class="field"><label>Hasta</label><input type="date" id="fHasta"
          min="${f.date_min}" max="${f.date_max}" value="${S.filters.date_to || ''}"></div>
      </div>
      <div class="field"><label>Sesión (n.º de orden en el corpus, 1–${nf(f.sessions_total || 0)})</label>
        <input type="number" id="fSesion" min="1" placeholder="cualquiera" value="${S.filters.num_session ?? ''}"></div>
    </div></details>

    <details class="fgroup" open><summary>Longitud de la intervención</summary><div class="fbody">
      <div class="row2">
        <div class="field"><label>Mín. palabras</label>
          <input type="number" id="fMin" min="0" placeholder="0" value="${S.filters.min_words ?? ''}"></div>
        <div class="field"><label>Máx. palabras</label>
          <input type="number" id="fMax" min="0" placeholder="∞" value="${S.filters.max_words ?? ''}"></div>
      </div>
      <p class="dsub" style="margin:0;font-size:11px;line-height:1.45">Muchas intervenciones
      breves son de trámite. Ponga un mínimo de 50 o 100 palabras para quedarse con los
      discursos.</p>
      <div style="display:flex;gap:5px;margin-top:7px">
        <button class="btn sm" data-minw="50">≥50</button>
        <button class="btn sm" data-minw="100">≥100</button>
        <button class="btn sm" data-minw="300">≥300</button>
        <button class="btn sm ghost" data-minw="">quitar</button>
      </div>
    </div></details>

    ${grupo('leg', 'Legislatura', f.legislatures, 'legislatures')}
    ${grupo('per', 'Periodo de sesiones', f.legislative_sessions, 'legislative_sessions', { buscador: (f.legislative_sessions || []).length > 12 })}
    ${grupo('tipo', 'Tipo de sesión', f.session_types, 'session_types')}
    ${grupo('sexo', 'Sexo', f.sexes, 'sexes', { etiquetas: L.sex || {} })}
    ${grupo('par', 'Partido', f.parties, 'parties', { buscador: true })}
    ${grupo('dip', 'Diputado/a', f.speakers, 'rep_ids', { max: 200, buscador: true })}
    ${grupo('dis', 'Distrito', f.districts, 'districts', { buscador: true })}

    <details class="fgroup"><summary>Restringir a una biblioteca</summary><div class="fbody">
      <div class="field"><select id="fLib">
        <option value="">— todo el corpus —</option>
        ${S.collections.map(c => `<option value="${c.id}"${S.filters.collection_id == c.id ? ' selected' : ''}>${esc(c.name)} (${nf(c.n_items)})</option>`).join('')}
      </select></div>
      <p class="dsub" style="margin:0;font-size:11px">Busca solo dentro del material que
      ya ha curado: útil para refinar un capítulo.</p>
    </div></details>

    <details class="fgroup"><summary>Búsquedas guardadas</summary>
      <div class="fbody" id="savedBox"><p class="dsub" style="font-size:11px;margin:0">—</p></div></details>

    <div style="padding:13px">
      <button class="btn" id="saveSearchBtn" style="width:100%">Guardar esta búsqueda</button>
    </div>

    <details class="fgroup" id="fg-fuente"><summary>Sobre este corpus</summary><div class="fbody">
      <div class="fuente-k">Cómo citar este material</div>
      ${fuenteHTML()}
      ${sobreCorpusDatosHTML()}
      <p class="dsub" style="font-size:11px;line-height:1.55;margin:0">
        Partido, distrito, sexo y tipo de sesión se muestran tal como vienen en el CSV,
        sin normalizar: las variantes de un mismo nombre aparecen como valores distintos.
      </p>
    </div></details>`;
  loadSaved();
  renderPills();
}



function sobreCorpusDatosHTML() {








  const R2 = globalThis.R2;
  if (R2 && R2.sobreCorpus && typeof R2.sobreCorpus.html === 'function') return R2.sobreCorpus.html(S.info);
  return `<p class="dsub" style="font-size:11px;line-height:1.55;margin:0 0 7px">
        ${nf(S.info.n_speeches)} intervenciones · ${nf(S.info.n_sessions || 0)} sesiones</p>`;

}

function renderPills() {
  const box = $('#activePills'); const out = [];
  const F = S.filters;
  const add = (txt, fn) => out.push({ txt, fn });







  const etq = { legislatures: 'Legislatura', legislative_sessions: 'Periodo', session_types: 'Tipo de sesión', sexes: 'Sexo',
                parties: 'Partido', districts: 'Distrito', rep_ids: 'Diputado/a' };
  for (const [k, label] of Object.entries(etq)) {
    for (const v of F[k] || []) {
      let show = v;
      if (k === 'sexes') show = S.facets?.labels?.sex?.[v] || v;
      if (k === 'rep_ids') {
        const s = (S.facets.speakers || []).find(x => String(x.rep_id) === String(v));
        show = s ? s.value : v;
      }
      add(`${label}: ${show}`, () => { F[k] = F[k].filter(x => String(x) !== String(v)); });
    }
  }


  const per = F.period && typeof F.period === 'object' ? F.period : null;
  if (per) {
    add(`Periodo: ${per.label || per.key}`, () => {
      delete F.period; delete F.speech_ids;
      if (per.kind === 'dates') { delete F.date_from; delete F.date_to; }
    });
  }
  if (F.date_from && per?.kind !== 'dates') add(`Desde ${F.date_from}`, () => delete F.date_from);
  if (F.date_to && per?.kind !== 'dates') add(`Hasta ${F.date_to}`, () => delete F.date_to);
  if (F.min_words) add(`≥${F.min_words} palabras`, () => delete F.min_words);
  if (F.max_words) add(`≤${F.max_words} palabras`, () => delete F.max_words);
  if (F.num_session) add(`Sesión ${F.num_session}`, () => delete F.num_session);
  if (F.exclude_docs) add('Solo lo que se habla', () => delete F.exclude_docs);
  if (F.collection_id) {
    const c = S.collections.find(x => x.id == F.collection_id);
    add(`En: ${c ? c.name : F.collection_id}`, () => delete F.collection_id);
  }

  box.hidden = !out.length;
  box.innerHTML = out.map((p, i) =>
    `<span class="pill">${esc(p.txt)}<button data-pill="${i}" title="Quitar">×</button></span>`).join('');
  box._fns = out.map(p => p.fn);
  updateSideRail();
}


let ctrl = null;
let climaCtrl = null;



const CLIMA_BUDGET_MS = 60;






let listaEspera = null;
async function esperaLista() { while (listaEspera) await listaEspera.promise; }

async function search(reset = false) {



  if (!reset && S.loading) return;
  const mine = ++S.seq;
  if (reset) {
    ctrl?.abort();
    ctrl = new AbortController();
    climaCtrl?.abort();
    climaCtrl = new AbortController();
    S.offset = 0; S.results = []; S.exhausted = false; S.similarOf = null;
    if (!listaEspera) {
      let fin; listaEspera = { promise: new Promise(res => { fin = res; }) }; listaEspera.fin = fin;
    }
    $('#hits').innerHTML = `<div class="empty"><span class="spin"></span></div>`;
    $('#spectrum')?.classList.add('stale');

    if (S.view === 'search') renderPills();

    qexpPintar();


    if (S.readMode === 'session' && S.session?.active && S.session.outline) sessRefreshTerms(S.session);
  }
  S.loading = true;

  try {
    const r = await api('/search', {
      method: 'POST',
      signal: reset ? ctrl.signal : undefined,
      body: { query: S.query, mode: S.mode, variants: S.variants, order: S.order,

              filters: S.filters, limit: PAGE, offset: S.offset, climate_budget_ms: CLIMA_BUDGET_MS },
    });
    if (mine !== S.seq) return;
    if (r.error) {
      toast(r.error, true);
      $('#hits').innerHTML = `<div class="empty"><div class="big">⚠</div>
        <h3>No se pudo interpretar la consulta</h3><p>${esc(r.error)}</p></div>`;
      S.results = []; S.total = 0; S.exhausted = true; S.lastMeta = null;
      $('#resultMeta').innerHTML = '<strong>0</strong>';
      $('#spectrum').hidden = true;

      return;
    }

    S.results = reset ? r.results : S.results.concat(r.results);
    S.total = r.total; S.ms = r.ms; S.lastMeta = r;
    Object.assign(S.membership, r.membership || {});


    S.exhausted = r.results.length < PAGE || (r.total != null && S.results.length >= r.total);
    renderMeta(); renderHits(reset, r.results);
    if (r.climate_pending?.length) loadClimate(r.climate_pending);
    if (reset) { trendAfterSearch(); loadSpectrum(); }
  } catch (e) {

    if (e.name !== 'AbortError' && mine === S.seq) {
      toast(e.message, true);


      if (reset) {
        $('#hits').innerHTML = `<div class="empty"><div class="big">⚠</div>
          <h3>No se pudo buscar</h3><p>${esc(e.message)}</p></div>`;
        S.results = []; S.total = 0; S.exhausted = true; S.lastMeta = null;
        $('#resultMeta').innerHTML = '<strong>0</strong>';
        $('#spectrum').hidden = true;

      }
    }
  } finally {
    if (mine === S.seq) {
      S.loading = false;

      if (listaEspera) { const w = listaEspera; listaEspera = null; w.fin(); }
    }
  }
}

























































































































function renderMeta() {

  const r = S.lastMeta || {};
  const interv = S.total === 1 ? 'intervención' : 'intervenciones';
  let lab, extra = '';



  let ayuda = '';

























 if (r.mode === 'browse') {
    lab = interv;
    extra = ` · ${S.ms} ms · sin texto de búsqueda`;
    ayuda = 'Está navegando el corpus con los filtros activos, sin buscar texto.';
  } else if (r.mode === 'library' || r.mode === 'similar') {
    return;
  } else {
    lab = interv;
  }




  const el = $('#resultMeta');
  const resto = `${lab}${extra || ` · ${S.ms} ms`}`;
  el.innerHTML = `<strong>${nf(S.total)}</strong><span>${resto}</span>`;
  el.title = `${nf(S.total)} ${resto}` + (ayuda ? `\n${ayuda}` : '');
  $('#order').value = S.order;
  $('#order').disabled = S.mode === 'semantic';







  $('#order').title = 'Ordenar';

}

function hitHTML(r) {
  const cols = S.membership[r.id] || [];
  const fam = r.session_type && r.session_type !== 'Sin identificar' && r.session_type !== 'ordinaria'
    ? `<span class="tag fam" title="Tipo de sesión">${esc(r.session_type)}</span>` : '';
  const par = r.party && r.party !== 'Sin identificar'
    ? `<span class="tag">${esc(r.party)}</span>` : '';











  const prov = '', pasaje = false;
  const snip = snippetHTML(r.snippet);

  const sc = r.score != null
    ? `<span class="score"><span class="bar"><i style="width:${Math.round(r.score * 100)}%"></i></span></span>` : '';
  const docr = docRole(r);
  return `<article class="hit${S.selected === r.id ? ' sel' : ''}${docr ? ` doc doc-${docr}` : ''}" data-id="${r.id}">
    <div class="hit-top">
      <span class="hit-name">${esc(docr ? DOC_NOMBRE[docr]
        : (r.rep_name && r.rep_name !== 'Sin identificar' ? r.rep_name : r.speaker))}</span>
      <span class="hit-date">${esc(r.date)}${r.session_number ? ` · ses. ${esc(r.session_number)}` : (r.num_session ? ` · ses. ${r.num_session}` : '')}</span>
      ${cols.length ? `<span class="inlib" title="Está en ${cols.length} biblioteca(s)">◆</span>` : ''}
    </div>
    <div class="hit-snip${pasaje ? ' sem' : ''}">${snip}</div>
    <div class="hit-foot">${prov}${fam}${par}
      <span class="tag words">${nf(r.nwords)} pal.</span><span class="clima-slot">${climaHTML(r.climate, r.climate_units)}</span>${sc}</div>
  </article>`;
}




async function loadClimate(ids) {
  const ctl = climaCtrl;
  for (let k = 0; k < ids.length; k += 8) {
    if (!ctl || ctl.signal.aborted) return;
    let r;
    try {
      r = await api('/climate', { method: 'POST', signal: ctl.signal, body: { ids: ids.slice(k, k + 8) } });
    } catch { return; }
    if (ctl.signal.aborted) return;
    for (const [id, v] of Object.entries(r.climate || {})) {
      const hit = S.results.find(x => x.id === +id);
      if (hit) { hit.climate = v.climate; hit.climate_units = v.climate_units; }
      const slot = $(`#hits .hit[data-id="${+id}"] .clima-slot`);
      if (slot) slot.innerHTML = climaHTML(v.climate, v.climate_units);
    }
  }
}

function renderHits(reset, nuevas = []) {
  const box = $('#hits');
  if (!S.results.length) {
    const m = S.lastMeta;













    box.innerHTML = `<div class="empty"><div class="big">⌕</div>
      <h3>Sin resultados</h3><p>Pruebe con otras palabras o quite algún filtro.</p></div>`;

    return;
  }
  const tail = S.exhausted
    ? `<div class="empty" style="padding:22px"><p>Fin de los resultados.</p></div>`
    : `<div id="sentinel" class="empty" style="padding:18px"><span class="spin"></span></div>`;

  if (reset) {
    box.innerHTML = S.results.map(hitHTML).join('') + tail;
    listScroller().scrollTop = 0;
  } else {




    $('#sentinel')?.remove();
    box.insertAdjacentHTML('beforeend', (nuevas || []).map(hitHTML).join('') + tail);
  }
  observeSentinel();
}


function refreshHitMarkers() {
  for (const el of $$('.hit')) {
    const id = +el.dataset.id;
    el.classList.toggle('sel', S.selected === id);
    const top = el.querySelector('.hit-top');
    const has = (S.membership[id] || []).length > 0;
    const mark = top.querySelector('.inlib');
    if (has && !mark) {
      top.insertAdjacentHTML('beforeend',
        '<span class="inlib" title="Esta en una biblioteca">\u25c6</span>');
    } else if (!has && mark) mark.remove();
  }
}

let io;
function observeSentinel() {
  io?.disconnect();
  const s = $('#sentinel');
  if (!s) return;
  io = new IntersectionObserver(es => {
    if (es[0].isIntersecting && !S.loading && !S.exhausted) {
      S.offset += PAGE; search(false);
    }
  }, { root: listScroller(), rootMargin: '320px' });
  io.observe(s);
}





async function openSpeech(id, { mode } = {}) {
  S.selected = id;
  if (S.results.some(r => r.id === id)) S.cursor = id;
  $$('.hit').forEach(h => h.classList.toggle('sel', +h.dataset.id === id));
  $('#app').classList.remove('no-reader');

  if (S.readMode === 'careo' && mode && mode !== 'careo') leaveCareo();
  if (mode === 'careo' || (!mode && S.readMode === 'careo')) { enterCareo(id); return; }
  if (mode === 'speech' && S.readMode === 'session') leaveSession();
  if (mode === 'session' || (!mode && S.readMode === 'session')) { enterSession(id); return; }

  S.readMode = 'speech';
  updateReadHead();
  const seq = ++S.readSeq;
  $('#reader').innerHTML = `<div class="empty"><span class="spin"></span></div>`;
  try {
    const d = await api(`/speech/${id}`);
    if (seq !== S.readSeq || S.readMode !== 'speech') return;
    renderReader(d);
  } catch (e) {
    if (seq === S.readSeq && S.readMode === 'speech')
      $('#reader').innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
  }
}


function setReadMode(m) {
  if (!S.selected) { toast('Abra primero una intervención.'); return; }
  $('#app').classList.remove('no-reader');
  if (m === 'careo') { enterCareo(S.selected); return; }
  if (S.readMode === 'careo') {
    leaveCareo();
    if (m === 'session') { enterSession(S.selected); return; }
    updateReadHead();

    if (S.current?.id === S.selected) renderReader(S.current, { restore: true });
    else openSpeech(S.selected, { mode: 'speech' });
    return;
  }
  if (m === 'session') {
    if (S.readMode === 'session' && S.session?.active && S.session.refId === S.selected) return;
    enterSession(S.selected);
    return;
  }
  if (S.readMode !== 'session') return;
  leaveSession();
  updateReadHead();

  if (S.current?.id === S.selected) renderReader(S.current, { restore: true });
  else openSpeech(S.selected, { mode: 'speech' });
}

function kickerText(m, d) {
  if (m && m.has_meta) {
    let k = [m.cortes, m.sigla && m.diario_num != null ? `${m.sigla} núm. ${m.diario_num}` : '']
      .filter(Boolean).join(' · ');

    if (m.page_start != null && m.page_end != null) k += ` (págs. ${m.page_start}–${m.page_end})`;
    if (k) return k;
  }
  return ['Diario de sesiones', d.legislature ? `Legislatura ${d.legislature}` : '', d.legislative_session ? d.legislative_session : '']
    .filter(Boolean).join(' · ');
}

function presidenciaText(m) {
  const p = m && m.presidente;
  const nombre = p && (p.nombre || p.corto);
  return nombre ? `Presidencia de D. ${nombre}` : '';
}



function warningsHTML(warnings, sw, cls = 'folio-warn') {
  const out = [];
  const tapados = new Set();
  if (sw) {
    if (sw.tipo === 'double_sitting') tapados.add('double_sitting');
    if (sw.tipo === 'date_error') tapados.add('date_corrected');
    const dudosa = sw.dudosa ?? true;
    const extra = (!sw.tipo || sw.tipo === 'unverified') && (sw.otros || []).length
      ? ` En esta fecha el corpus también registra ${sw.otros.length === 1 ? 'la sesión' : 'las sesiones'} `
        + sw.otros.map(n => `<b>${esc(n)}</b>`).join(', ') + '.'
      : '';
    out.push(`<div class="${cls} ${dudosa ? 'warn' : 'info'}"><b>${dudosa ? '⚠ ' : ''}`
      + `${esc(sw.titulo || 'Número de sesión dudoso')}.</b> ${esc(sw.mensaje)}${extra}</div>`);
  }
  for (const w of warnings || []) {
    if (tapados.has(w.code)) continue;



    if (w.code === 'truncated_end' && w.affects_speech === false) {
      const tramo = w.official_order_from != null
        ? ` (órdenes ${nf(w.official_order_from)}–${nf(w.official_order_to)})` : '';
      out.push(`<div class="${cls} note" title="${esc(w.message)}">ℹ︎ El acta digitalizada de esta sesión termina incompleta${esc(tramo)}. Esta intervención no está afectada.</div>`);
      continue;
    }
    const grave = w.severity === 'warning';
    const afecta = w.affects_speech ? ' <b>Esta intervención está en el tramo afectado.</b>' : '';
    out.push(`<div class="${cls} ${grave ? 'warn' : 'info'}">${grave ? '⚠ ' : 'ℹ︎ '}${esc(w.message)}${afecta}</div>`);
  }
  return out.join('');
}


function threadHTML(d) {
  const ctx = d.context || [];
  if (!ctx.length) return '';
  const total = d.position?.of ?? d.session?.n_speeches ?? 0;
  const fecha = fechaLarga(d.session_meta?.date_real || d.date);
  const recorta = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s);
  const filas = ctx.map(c => {
    const chair = CHAIR_ROLES.has(c.role);
    const nombre = docRole(c) ? DOC_NOMBRE[docRole(c)]
      : chair ? (c.speaker_label || c.speaker)
      : (ident(c.rep_name) ? c.rep_name : (c.speaker_label || c.speaker));
    let aparte;
    if (c.is_current) aparte = '<em>Intervención abierta</em>';
    else if ((c.nwords ?? 0) <= 15 && c.preview) aparte = `«${esc(recorta(c.preview.trim(), 70))}»`;
    else aparte = esc([ident(c.party) && !chair ? c.party : '', `${nf(c.nwords)} pal.`].filter(Boolean).join(' · '));
    const attrs = c.is_current ? '' : ` data-goto="${c.id}" role="button" tabindex="0"`;
    return `<div class="thread-row${c.is_current ? ' cur' : ''}"${attrs}>`
      + `<span class="thread-ord">Orden ${esc(c.official_order ?? '—')}</span>`
      + `<span class="thread-name" title="${esc(c.speaker)}">${esc(nombre)}</span>`
      + `<span class="thread-aside">${aparte}</span></div>`;
  }).join('');
  return `<div class="thread"><h4>Hilo continuo de la sesión${fecha ? ` (${esc(fecha)})` : ''}</h4>${filas}
    <div class="thread-row thread-more" data-session="${d.id}" role="button" tabindex="0">Leer la sesión corrida completa · ${nf(total)} intervenciones →</div></div>`;
}


function renderReader(d, { restore = false } = {}) {
  if (S.readMode !== 'speech') return;
  S.current = d;




  const span = null;

  const terms = S.mode === 'semantic' ? [] : queryTerms(S.query, S.variants);
  const cols = (d.collections || []).map(cid => S.collections.find(c => c.id === cid)).filter(Boolean);
  const m = d.session_meta || null;
  const doc = d.doc || plainDoc(d.speech);
  const sp = doc.speaker || {};
  const chair = CHAIR_ROLES.has(d.role) || sp.is_chair;

  const rawDiff = '';
  const orden = d.official_order != null
    ? `<span class="tag">Orden ${nf(d.official_order)}${d.position?.of ? ` de ${nf(d.position.of)}` : ''}</span>` : '';
  const gobierno = m?.gobierno?.nombre
    ? `<span${typeof m.gobierno.legitimidad_discutida === 'string' ? ` title="${esc(m.gobierno.legitimidad_discutida)}"` : ''}>${esc(m.gobierno.nombre)}</span>` : '';
  const gov = [presidenciaText(m) ? esc(presidenciaText(m)) : '', gobierno,
    d.session_number != null && d.session_number !== '' ? `Sesión ${esc(d.session_type && d.session_type !== 'Sin identificar' ? d.session_type + ' ' : '')}núm. ${esc(d.session_number)}`
      : (d.num_session != null ? `Sesión ${esc(d.session_type && d.session_type !== 'Sin identificar' ? d.session_type + ' ' : '')}(${esc(d.num_session)} del corpus)` : ''),
    esc(fechaLarga(m?.date_real || d.date))].filter(Boolean).join(' · ');
  const docr = docRole(d) || (DOC_ROLES.has(sp.role) ? sp.role : null);
  const titulo = docr ? DOC_NOMBRE[docr] : (d.speaker_label || sp.label || d.speaker);

  $('#reader').innerHTML = `<article class="folio${docr ? ` folio-doc doc-${docr}` : ''}" data-id="${d.id}">
    <div class="folio-kicker">${esc(kickerText(m, d))}</div>
    <h3 class="folio-title">${esc(titulo)}</h3>
    ${ident(d.rep_name) && !chair ? `<div class="folio-rep">${esc(d.rep_name)}</div>` : ''}
    ${sp.note ? `<div class="folio-rep"><em>${esc(sp.note)}</em></div>` : ''}
    <div class="folio-gov">${gov}</div>
    <div class="folio-rule"></div>
    <div class="folio-tags">
      ${chair ? `<span class="tag or">Presidencia · ${esc(sp.name || m?.presidente?.corto || '')}</span>` : ''}
      ${ident(d.party) ? `<span class="tag" title="Partido">${esc(d.party)}</span>` : ''}${rawDiff}
      ${sexoTag(d.sex)}
      ${ident(d.district) ? `<span class="tag" title="Distrito">${esc(d.district)}</span>` : ''}
      <span class="tag words">${nf(d.nwords)} palabras</span>
      ${orden}
      ${d.legislature ? `<span class="tag">Legislatura ${esc(d.legislature)}</span>` : ''}
      ${cols.map(c => `<span class="tag sem">◆ ${esc(c.name)}</span>`).join('')}
    </div>
    ${docr ? `<div class="consta doc"><b>${docr === 'summary'
      ? 'Encabezado y sumario de la sesión: texto sin orador que el Diario imprime antes de la primera intervención.'
      : 'Texto sin orador: material que el Diario imprime dentro del acta (anexos, listas de votación, resultados).'}</b></div>`
      : `<div class="consta"><b>Consta en el diario como:</b> ${esc(d.speaker)}</div>`}
    ${warningsHTML(d.warnings, d.session_warning)}
    ${
 '' }
    <div class="folio-body">${renderDoc(doc, d.id, { terms, raw: d.speech, span })}</div>
    ${threadHTML(d)}
  </article>`;

  marcarCapital($('#reader .folio-body'));
  cabeceraSinCortes($('#reader'));


  const sc = $('#reader');
  if (restore && S.speechScroll?.id === d.id) { sc.scrollTop = S.speechScroll.top; return; }
  sc.scrollTop = 0;



}















const frames = (n = 1) => new Promise(res => {
  const step = k => (k <= 0 ? res() : requestAnimationFrame(() => step(k - 1)));
  step(n);
});

function sessionTerms() {
  return S.mode === 'semantic' ? [] : queryTerms(S.query, S.variants);
}

function sessShortName(h) {
  if (docRole(h)) return DOC_NOMBRE[docRole(h)];
  if (CHAIR_ROLES.has(h.role)) return h.speaker_label || h.speaker || '';
  return (h.speaker_title || h.speaker_label || h.speaker || '')
    .replace(/^(El|La|Los|Las|Un|Una|Unos|Varios|Otros|Algunos)\s+(señor(?:a|ita|es|as)?|Sr\.|Sra\.|Srta\.|Sres\.)\s+/i, '');
}


function sessTramos(o, desde, hasta) {
  const L = o.limits || { max_speeches: 60, max_chars: 250000 };
  const out = []; let cur = [], ch = 0;
  for (let i = desde; i <= hasta; i++) {
    const h = o.speeches[i];
    if (cur.length && (cur.length >= L.max_speeches || ch + h.nchars > L.max_chars)) {
      out.push([cur[0], cur.at(-1)]); cur = []; ch = 0;
    }
    cur.push(i); ch += h.nchars || 0;
  }
  if (cur.length) out.push([cur[0], cur.at(-1)]);
  return out;
}

function sessBannerHTML(o) {
  const m = o.session_meta || {};
  const t = o.totals || {};
  const tipo = o.session_type && o.session_type !== 'Sin identificar' ? `${o.session_type} ` : '';
  const diario = m.has_meta && m.diario_num != null ? `Diario de Sesiones núm. ${m.diario_num}`
    : (o.session_number ? `Sesión ${tipo}núm. ${o.session_number}` : (o.num_session != null ? `Sesión ${tipo}${o.num_session} del corpus` : 'Sesión'));
  const pags = m.page_start != null && m.page_end != null ? `págs. ${m.page_start}–${m.page_end}` : '';
  const pres = m.presidente && (m.presidente.nombre || m.presidente.corto)
    ? `Presidencia: D. ${m.presidente.nombre || m.presidente.corto}` : '';
  const linea = [m.cortes, fechaLarga(m.date_real || o.date), pags, pres, m.gobierno?.nombre,
    o.legislature ? `Legislatura ${o.legislature}` : '', o.legislative_session || '']
    .filter(Boolean).map(esc).join(' · ');
  return `<div class="sess-banner">
    <div class="sess-banner-t">Sesión corrida íntegra · ${esc(diario)}</div>
    <div class="sess-banner-n"><b>${nf(t.n_speeches)} intervenciones íntegras · ${nf(t.n_words)} palabras</b>
      · Discurso activo: <b data-sess-active>—</b></div>
    <div>${linea}</div>
    ${warningsHTML(o.warnings, o.session_warning, 'sess-warn')}
  </div>`;
}

function sessBlockHTML(h, i, o) {
  const m = o.session_meta || {};
  const chair = CHAIR_ROLES.has(h.role);
  const docr = docRole(h);


  const chip = docr
    ? `<span class="tag doc">${esc(DOC_NOMBRE[docr])}</span>`
    : chair
    ? `<span class="tag or">Presidencia · ${esc(h.chair_name || m.presidente?.corto || '')}</span>`
    : [ident(h.party) ? `<span class="tag" title="Partido">${esc(h.party)}</span>` : '',
       sexoTag(h.sex),
       ident(h.district) ? `<span class="tag" title="Distrito">${esc(h.district)}</span>` : ''].join('');
  const num = m.diario_num ?? o.session_number ?? o.num_session;
  const sig = `${m.sigla || 'Sesión'}${num != null ? ` núm. ${num}` : ''}`;
  const quien = ident(h.rep_name) ? ` title="${esc(h.rep_name)}"` : '';
  const lineas = Math.min(3, Math.max(1, Math.ceil((h.nwords || 1) / 45)));
  const ghosts = Array.from({ length: lineas }, (_, k) =>
    `<div class="sess-ghost${k === lineas - 1 && lineas > 1 ? ' short' : ''}"></div>`).join('');
  return `<section class="sess-block${docr ? ` doc doc-${docr}` : ''}" id="sb-${h.id}" data-idx="${i}" data-sid="${h.id}">
    <div class="sess-head"><span class="sess-name"${quien}>${esc(docr ? DOC_NOMBRE[docr] : (h.speaker_title || h.speaker_label || h.speaker))}
      <em>(Orden ${esc(h.official_order ?? '—')})</em></span><span class="sess-sig">${esc(sig)}</span>
      <button class="btn sm" data-solo="${h.id}" title="Abrir esta intervención sola">Ver solo este</button>
      ${chip ? `<div class="sess-tags">${chip}</div>` : ''}</div>
    <div class="sess-body ph">${ghosts}</div></section>`;
}


function sessEstimate(s, h) {
  const n = h.nchars || 0;
  const lineas = Math.max(1, Math.ceil(n / s.cpl));
  const parrafos = Math.max(1, Math.round(n / 900));



  if (s.metrica) return (lineas * s.metrica.lh + parrafos * s.metrica.mb) * (s.corr || 1);

  return lineas * 30.1 + parrafos * 19.25;
}











const SESS_MUESTRA = 'Señores Diputados, la Comisión ha examinado con detenimiento el proyecto de ley y propone a la Cámara '
  + 'que se apruebe con las modificaciones que constan en el dictamen, porque así lo exige el interés de la República. ';
const SESS_LLENADO = 1.07;
function sessMetrica(body) {
  if (!body) return null;
  const p = document.createElement('p');
  p.className = 'fp';
  p.setAttribute('aria-hidden', 'true');
  p.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;text-indent:0;width:auto';
  p.textContent = SESS_MUESTRA;
  body.appendChild(p);
  const cs = getComputedStyle(p);
  const fs = parseFloat(cs.fontSize);
  const lh = cs.lineHeight.endsWith('px') ? parseFloat(cs.lineHeight) : fs * (parseFloat(cs.lineHeight) || 1.78);
  const mb = parseFloat(cs.marginBottom) || 0;
  const cw = p.getBoundingClientRect().width / SESS_MUESTRA.length;
  p.remove();
  return fs > 0 && lh > 0 && cw > 0 ? { lh, mb, cw: cw * SESS_LLENADO } : null;
}











const CAPITAL_SIGNOS = '«"“\'‘¿¡';


const CAPITAL_MIN_INTERVENCION = 100, CAPITAL_MIN_PARRAFO = 50;


const PALABRA_RE = new RegExp(String.raw`\p{L}[\p{L}\p{N}\u0027\u2019.-]*`, 'gu');
const contarPalabras = el => (el.textContent.match(PALABRA_RE) || []).length;
function marcarCapital(raiz) {
  if (!raiz || contarPalabras(raiz) <= CAPITAL_MIN_INTERVENCION) return;
  for (const p of raiz.querySelectorAll('.fp.first')) {
    if (p.querySelector(':scope > .r2-capital') || contarPalabras(p) <= CAPITAL_MIN_PARRAFO) continue;
    const w = document.createTreeWalker(p, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.nodeType === 1 && n.classList.contains('fp-anchor') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const tramos = [];
    let cap = '', letra = null, empezado = false, vale = true;
    busca: for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 1) {
        if (!empezado && n.matches('.acot-inline, .acta-note-inline')) { vale = false; break; }
        continue;
      }
      const t = n.nodeValue;
      let desde = -1;
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (!empezado && /\s/.test(c)) continue;
        empezado = true;
        if (CAPITAL_SIGNOS.includes(c) && cap.length < 3) { if (desde < 0) desde = i; cap += c; continue; }
        if (/\p{L}/u.test(c)) { if (desde < 0) desde = i; cap += c; tramos.push([n, desde, i + 1]); letra = n; break busca; }
        vale = false; break busca;
      }
      if (desde >= 0) tramos.push([n, desde, t.length]);
    }
    if (!vale || !letra) continue;
    const enMark = !!letra.parentElement?.closest('mark');
    for (const [n, a, b] of tramos) {
      const medio = n.splitText(a);
      medio.splitText(b - a);
      const s = document.createElement('span');
      s.className = 'r2-cap-texto';
      medio.replaceWith(s);
      s.appendChild(medio);
    }
    const c = document.createElement('span');
    c.className = 'r2-capital' + (enMark ? ' en-mark' : '');
    c.setAttribute('aria-hidden', 'true');
    c.dataset.signo = cap.slice(0, -1);
    c.dataset.letra = cap.slice(-1);
    const ancla = p.querySelector(':scope > .fp-anchor');
    p.insertBefore(c, ancla ? ancla.nextSibling : p.firstChild);
    p.classList.add('r2-cap');
    capitalIluminada(c);
  }
}





function capitalIluminada(c) {
  const R2 = globalThis.R2;
  const quiere = document.documentElement.dataset.estilo === 'iluminado' && !!(R2 && R2.capitales && R2.capitales.disponible());
  if (!quiere) {
    if (c.classList.contains('iluminada')) { c.classList.remove('iluminada'); c.textContent = ''; }
    return;
  }
  if (c.classList.contains('iluminada') && c.firstChild) return;
  c.classList.add('iluminada');
  R2.capitales.svg(c.dataset.letra).then(svg => {
    if (!c.isConnected || document.documentElement.dataset.estilo !== 'iluminado') return;
    if (svg) c.innerHTML = svg; else c.classList.remove('iluminada');
  });
}



function cabeceraSinCortes(raiz) {
  for (const k of raiz?.querySelectorAll('.folio-kicker') || []) {
    for (const n of [...k.childNodes]) {
      if (n.nodeType !== 3) continue;
      const m = /págs\.\s\d+–\d+/.exec(n.nodeValue);
      if (!m) continue;
      const medio = n.splitText(m.index);
      medio.splitText(m[0].length);
      const s = document.createElement('span');
      s.className = 'r2-nowrap';
      medio.replaceWith(s);
      s.appendChild(medio);
    }
  }
}








function sessLecturaTop(L) {
  if (L.nodo) {
    if (!L.nodo.isConnected) return null;
    const len = L.nodo.nodeValue.length;
    if (!len) return null;
    const a = Math.max(0, Math.min(L.off, len - 1));
    const r = document.createRange();
    r.setStart(L.nodo, a); r.setEnd(L.nodo, a + 1);
    const q = r.getClientRects()[0];
    return q && q.height > 0 ? q.top : null;
  }
  return L.el?.isConnected ? L.el.getBoundingClientRect().top : null;
}
function sessLecturaGuardar(s) {
  const sc = $('#reader');
  if (!s?.active || !s.root?.isConnected || sc.clientWidth !== s.width) return;
  const box = sc.getBoundingClientRect(), f = s.root.getBoundingClientRect();
  const x = Math.min(Math.max(f.left + f.width / 2, box.left + 1), box.right - 1), y = box.top + 60;
  let L = null;
  const cp = document.caretPositionFromPoint?.(x, y);
  const cr = cp ? null : document.caretRangeFromPoint?.(x, y);
  const nodo = cp ? cp.offsetNode : cr?.startContainer, off = cp ? cp.offset : cr?.startOffset;
  if (nodo?.nodeType === 3 && s.root.contains(nodo)) {
    const t = sessLecturaTop(L = { nodo, off });
    if (t == null) L = null; else L.top = t - box.top;
  }
  if (!L) {
    const h = document.elementFromPoint(x, y);
    const el = h && s.root.contains(h)
      ? h.closest('.fp, .acot, .acta-turn, .acta-chronicle, .acta-note, .acta-list, .acta-table, .sess-head, .sess-body, .sess-block') : null;
    if (el) L = { el, top: el.getBoundingClientRect().top - box.top };
  }
  s.lectura = L;
}
function sessLecturaRestaurar(s, fn) {
  const L = s.lectura, sc = $('#reader');
  if (!L || !s.active || !s.root?.isConnected || !(L.nodo || L.el)?.isConnected) return false;
  fn();
  const t = sessLecturaTop(L);
  if (t != null) {
    const d = t - sc.getBoundingClientRect().top - L.top;
    if (Math.abs(d) >= 0.5) sc.scrollTop += d;
  }
  sessLecturaGuardar(s);
  return true;
}









function sessAprender(s, els) {
  if (!s.metrica || s.corrHecha) return;
  const base = s.corr || 1;
  for (const b of els) {
    if (b.classList.contains('sess-ref')) continue;
    const est = sessEstimate(s, s.outline.speeches[+b.dataset.idx]) / base;
    const med = b.querySelector('.sess-body').getBoundingClientRect().height;
    if (est > 0 && med > 0) { s.aprEst = (s.aprEst || 0) + est; s.aprMed = (s.aprMed || 0) + med; }
  }
  if ((s.aprEst || 0) < 2500) return;
  s.corrHecha = true;
  const c = Math.min(1.25, Math.max(0.8, s.aprMed / s.aprEst));
  if (Math.abs(c / base - 1) <= 0.02) return;
  s.corr = c;
  for (const b of s.blocks) {
    if (s.loaded.has(+b.dataset.sid)) continue;
    b.querySelector('.sess-body').style.height = `${sessEstimate(s, s.outline.speeches[+b.dataset.idx]).toFixed(1)}px`;
  }
}




function sessSizes(s) {
  const body = s.blocks.find(b => !b.classList.contains('sess-ref'))?.querySelector('.sess-body');
  const w = body?.getBoundingClientRect().width || 560;
  s.cpl = Math.max(28, w / 7.9);

  s.metrica = sessMetrica(body);
  if (s.metrica) s.cpl = Math.max(28, w / s.metrica.cw);
  s.aprEst = s.aprMed = 0;
  s.corrHecha = false;

  s.width = $('#reader').clientWidth;
  for (const b of s.blocks) {
    if (b.classList.contains('loaded')) continue;
    b.querySelector('.sess-body').style.height = `${sessEstimate(s, s.outline.speeches[+b.dataset.idx]).toFixed(1)}px`;
  }
}




function sessMeasure(els) {
  if (!els.length) return;
  for (const el of els) el.style.contentVisibility = 'visible';
  const hs = els.map(el => {
    const cs = getComputedStyle(el);
    return el.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
  });
  els.forEach((el, k) => {
    el.style.containIntrinsicSize = `auto ${Math.max(1, hs[k]).toFixed(2)}px`;
    el.style.contentVisibility = '';
  });
}

function teardownSession(s) {
  if (!s) return;
  s.ctrl.abort();
  s.io?.disconnect(); s.ro?.disconnect(); s.roOn = false;
  s.active = false;
  if (S.session === s) S.session = null;
}

function leaveSession() {
  const s = S.session;
  const app = $('#app');
  S.readMode = 'speech';
  app.classList.remove('session-mode');
  if (!s) return;
  if (s.active) {
    s.scroll = $('#reader').scrollTop;
    s.active = false;
    s.io?.disconnect(); s.ro?.disconnect(); s.roOn = false;
    if (!s.prevWide) app.classList.remove('wide-reader');
  }
  if (!s.root) teardownSession(s);
}

async function enterSession(refId) {
  const app = $('#app'), sc = $('#reader');
  const eraDiscurso = S.readMode !== 'session';
  if (eraDiscurso && S.current && sc.querySelector('.folio[data-id]'))
    S.speechScroll = { id: S.current.id, top: sc.scrollTop };
  S.readMode = 'session';
  ++S.readSeq;
  let s = S.session;


  if (s && s.root && s.byId.has(refId)) {
    if (!s.active) s.prevWide = app.classList.contains('wide-reader');
    app.classList.add('wide-reader', 'session-mode');
    const mismaRef = s.refId === refId;
    if (sc.firstElementChild !== s.root) sc.replaceChildren(s.root);
    s.active = true;
    if (s.needRemeasure) {

      s.needRemeasure = false;
      sessMeasure(s.blocks.filter(b => b.classList.contains('loaded')));
    }
    sessSetRef(s, refId);
    sessRefreshTerms(s);
    updateReadHead();
    if (mismaRef && s.scroll != null) sc.scrollTop = s.scroll;
    sessObserve(s);
    if (!mismaRef || s.scroll == null) await sessGoTo(s, s.byId.get(refId));
    return;
  }

  const prevWide = s?.active ? s.prevWide : app.classList.contains('wide-reader');
  teardownSession(s);
  s = S.session = {
    refId, ctrl: new AbortController(), outline: null, root: null, blocks: [],
    byId: new Map(), docs: new Map(), loaded: new Set(), pendingP: new Map(),
    io: null, ro: null, roOn: false, active: true, prevWide, scroll: null, cpl: 70, width: 0,
    terms: sessionTerms(), termsKey: '',
  };
  s.termsKey = JSON.stringify(s.terms);
  app.classList.add('wide-reader', 'session-mode');
  updateReadHead();
  sc.innerHTML = `<div class="empty"><span class="spin"></span></div>`;

  let o;
  try {
    o = await api(`/session/outline/${refId}`, { signal: s.ctrl.signal });
  } catch (e) {
    if (e.name !== 'AbortError' && S.session === s && S.readMode === 'session')
      sc.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
    if (S.session === s) teardownSession(s);
    return;
  }
  if (S.session !== s || !s.active) return;

  s.outline = o;
  o.speeches.forEach((h, i) => s.byId.set(h.id, i));
  const root = document.createElement('article');
  root.className = 'folio sess';
  root.innerHTML = sessBannerHTML(o)
    + `<div class="sess-outline">${o.speeches.map((h, i) => sessBlockHTML(h, i, o)).join('')}</div>`;
  s.root = root;
  sc.replaceChildren(root);
  s.blocks = [...root.querySelectorAll('.sess-block')];
  sessSizes(s);
  const ref = s.byId.get(refId) ?? 0;
  sessSetRef(s, o.speeches[ref].id);
  updateReadHead();
  sessObserve(s, { io: false });
  sessScrollTo(s, ref);
  await sessGoTo(s, ref);
  if (S.session === s && s.active) sessObserve(s);
}


function sessObserve(s, { io = true } = {}) {
  const sc = $('#reader');
  if (!s.ro) {
    let raf = 0;
    s.ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!s.active || S.session !== s || sc.clientWidth === s.width) return;



        if (sessLecturaRestaurar(s, () => {
          sessSizes(s);
          sessMeasure(s.blocks.filter(b => b.classList.contains('loaded')));
        })) return;

        withScrollAnchor(s, () => {
          sessSizes(s);
          sessMeasure(s.blocks.filter(b => b.classList.contains('loaded')));
        });
      });
    });
  }
  if (!s.roOn) { s.ro.observe(sc); s.roOn = true; }

  if (!io) return;
  s.io?.disconnect();
  const cola = new Set(); let raf = 0;
  s.io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) cola.add(+e.target.dataset.idx);
    if (raf || !cola.size) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (S.session !== s || !s.active) { cola.clear(); return; }
      const idx = [...cola].sort((a, b) => a - b); cola.clear();


      const pide = (a, b) => sessEnsure(s, a - 8, b + 16);
      let a = idx[0], b = idx[0];
      for (const i of idx.slice(1)) {
        if (i <= b + 1) b = i; else { pide(a, b); a = b = i; }
      }
      pide(a, b);
    });
  }, { root: sc, rootMargin: '2000px 0px' });
  for (const b of s.blocks) if (!s.loaded.has(+b.dataset.sid)) s.io.observe(b);
}


function sessEnsure(s, from, to) {
  const sp = s.outline.speeches;
  from = Math.max(0, from); to = Math.min(sp.length - 1, to);
  const esperas = new Set();
  let run = null;
  const runs = [];
  for (let i = from; i <= to; i++) {
    const id = sp[i].id;
    if (s.loaded.has(id)) { run = null; continue; }
    if (s.pendingP.has(id)) { esperas.add(s.pendingP.get(id)); run = null; continue; }
    if (run && run[1] === i - 1) run[1] = i; else runs.push(run = [i, i]);
  }
  for (const [a, b] of runs)
    for (const [ta, tb] of sessTramos(s.outline, a, b)) esperas.add(sessFetch(s, ta, tb));
  return Promise.all(esperas);
}

function sessFetch(s, ia, ib) {
  const ids = s.outline.speeches.slice(ia, ib + 1).map(h => h.id);
  const p = api(`/session/texts?from_id=${ids[0]}&to_id=${ids.at(-1)}`, { signal: s.ctrl.signal })
    .then(r => {
      if (S.session !== s) return;
      for (const t of r.texts || []) s.docs.set(t.id, t.doc);
      sessFill(s, ids);
    })
    .catch(e => {
      if (e.name === 'AbortError' || S.session !== s) return;
      for (const id of ids) {
        const body = s.blocks[s.byId.get(id)]?.querySelector('.sess-body');
        if (body) body.innerHTML = `<p class="sess-err">No se pudo cargar: ${esc(e.message)}
          <button class="linkbtn" data-sess-retry="${s.byId.get(id)}">Reintentar</button></p>`;
      }
    })
    .finally(() => { for (const id of ids) if (s.pendingP.get(id) === p) s.pendingP.delete(id); });
  for (const id of ids) s.pendingP.set(id, p);
  return p;
}



function sessAnchor(s, top) {
  let lo = 0, hi = s.blocks.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (s.blocks[mid].getBoundingClientRect().bottom > top) { ans = mid; hi = mid - 1; } else lo = mid + 1;
  }
  return ans >= 0 ? s.blocks[ans] : null;
}



function withScrollAnchor(s, fn) {
  const sc = $('#reader');
  if (!s.active || !s.root?.isConnected) return fn();
  const top = sc.getBoundingClientRect().top;
  const anchor = sessAnchor(s, top);
  const antes = anchor ? anchor.getBoundingClientRect().top : 0;
  const r = fn();
  if (anchor) {
    const d = anchor.getBoundingClientRect().top - antes;
    if (Math.abs(d) >= 0.5) sc.scrollTop += d;
  }
  return r;
}

function sessFill(s, ids) {
  withScrollAnchor(s, () => {
    const els = [];
    for (const id of ids) {
      const doc = s.docs.get(id);
      const blk = s.blocks[s.byId.get(id)];
      if (!doc || !blk) continue;
      const body = blk.querySelector('.sess-body');
      body.innerHTML = renderDoc(doc, id, { terms: s.terms });

      marcarCapital(body);

      body.classList.remove('ph');
      body.style.height = '';
      s.loaded.add(id);
      s.io?.unobserve(blk);
      els.push(blk);
    }
    sessMeasure(els);

    sessAprender(s, els);

    for (const el of els) el.classList.add('loaded');
    return els;
  });
  sessFontsRemeasure(s);
}






function sessFontsRemeasure(s) {
  const fs = document.fonts;
  if (!fs || fs.status !== 'loading' || s.fontsWait) return;
  s.fontsWait = true;
  fs.ready.then(() => frames(1)).then(() => {
    s.fontsWait = false;
    if (S.session !== s) return;
    if (!s.active || !s.root?.isConnected) { s.needRemeasure = true; return; }
    withScrollAnchor(s, () => sessMeasure(s.blocks.filter(b => b.classList.contains('loaded'))));
    sessFontsRemeasure(s);
  });
}



function sessRefreshTerms(s) {
  const terms = sessionTerms();
  const key = JSON.stringify(terms);
  if (key === s.termsKey) return;
  s.terms = terms; s.termsKey = key;
  const ids = [...s.loaded];
  if (ids.length) sessFill(s, ids);
}

function sessSetRef(s, refId) {
  const i = s.byId.get(refId);
  if (i == null) return;
  const blk = s.blocks[i];
  withScrollAnchor(s, () => {
    const tocados = [];
    for (const old of s.root.querySelectorAll('.sess-ref')) {
      old.classList.remove('sess-ref');
      old.querySelector('.sess-star')?.remove();
      tocados.push(old);
    }
    blk.classList.add('sess-ref');
    blk.querySelector('.sess-sig').insertAdjacentHTML('beforebegin',
      '<span class="tag star sess-star">★ Intervención de referencia</span>');
    tocados.push(blk);

    sessMeasure(tocados.filter(b => b.classList.contains('loaded')));
  });
  s.refId = refId;
  const h = s.outline.speeches[i];
  const act = s.root.querySelector('[data-sess-active]');
  if (act) act.textContent = `#${h.official_order ?? h.index} de ${nf(s.outline.totals?.n_speeches ?? s.outline.speeches.length)}`;
}

function sessScrollTo(s, idx) {
  const el = s.blocks[idx];
  if (!el || !s.active) return;
  const sc = $('#reader');
  sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 10;
}



async function sessGoTo(s, idx) {
  if (idx == null) return;
  sessScrollTo(s, idx);
  await sessEnsure(s, idx - 8, idx + 12);
  if (S.session !== s || !s.active) return;
  try { await document.fonts.ready; } catch {   }
  await frames(2);
  if (S.session !== s || !s.active) return;
  sessScrollTo(s, idx);
  const sel = $('#sessJump');
  if (sel) sel.value = String(idx);
}


function updateReadHead() {
  careoHead();
  const enSesion = S.readMode === 'session';
  $$('#readModes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rmode === S.readMode)));
  const s = S.session;
  const ok = enSesion && s && s.outline;
  $('#sessTools').hidden = !ok;
  if (!ok) return;
  const i = s.byId.get(s.refId);
  const h = s.outline.speeches[i];
  $('#sessRef').textContent = `🎯 Ir a la referencia (#${h?.official_order ?? '—'})`;
  const sel = $('#sessJump');
  if (sel._for !== s) {
    sel.innerHTML = s.outline.speeches.map((x, k) =>
      `<option value="${k}">Orden ${esc(x.official_order ?? x.index)} · ${esc(sessShortName(x))}</option>`).join('');
    sel._for = s;
  }
  if (i != null) sel.value = String(i);
}








function careoState() {
  return { refId: null, mode: 'synchronic', res: {}, err: {}, pick: {}, swapped: false,
           speeches: new Map(), ctrl: null, seq: 0, prevWide: false, centered: null };
}
S.careo = careoState();

function careoGet(id) {
  if (id == null) return null;
  if (S.current?.id === id && S.current.doc) return S.current;
  return S.careo.speeches.get(id) || null;
}

async function careoSpeech(id, signal) {
  const hay = careoGet(id);
  if (hay) return hay;
  const d = await api(`/speech/${id}?context=0`, { signal });
  const C = S.careo;
  C.speeches.set(id, d);
  if (C.speeches.size > 24) C.speeches.delete(C.speeches.keys().next().value);
  return d;
}

function careoPickId() {
  const C = S.careo, xs = C.res[C.mode]?.results || [];
  if (!xs.length) return null;
  return xs.some(x => x.id === C.pick[C.mode]) ? C.pick[C.mode] : xs[0].id;
}

function careoCand() {
  const C = S.careo, id = careoPickId();
  return id == null ? null : C.res[C.mode].results.find(x => x.id === id);
}

function enterCareo(refId) {
  const app = $('#app'), sc = $('#reader'), C = S.careo;
  if (S.readMode === 'session') leaveSession();
  else if (S.readMode === 'speech' && S.current && sc.querySelector('.folio[data-id]'))
    S.speechScroll = { id: S.current.id, top: sc.scrollTop };
  if (S.readMode !== 'careo') C.prevWide = app.classList.contains('wide-reader');
  S.readMode = 'careo';
  ++S.readSeq;
  if (C.refId !== refId) {
    C.ctrl?.abort();
    Object.assign(C, { refId, res: {}, err: {}, pick: {}, swapped: false, centered: null });
  }
  app.classList.remove('no-reader');
  app.classList.add('wide-reader', 'careo-mode');
  careoLoad();
}

function leaveCareo() {
  const C = S.careo, app = $('#app');
  if (S.readMode !== 'careo') return;
  C.ctrl?.abort(); C.seq++;
  S.readMode = 'speech';
  app.classList.remove('careo-mode');
  if (!C.prevWide) app.classList.remove('wide-reader');
}


function toggleCareo() {
  if (S.readMode === 'careo') { setReadMode('speech'); return; }
  if (!S.selected) { toast('Abra primero una intervención.'); return; }
  enterCareo(S.selected);
}

async function careoLoad() {
  const C = S.careo, ref = C.refId, mode = C.mode, mine = ++C.seq;
  C.ctrl?.abort();
  const ctrl = C.ctrl = new AbortController();
  const vivo = () => mine === C.seq && S.readMode === 'careo' && C.refId === ref;
  const pide = id => (careoGet(id) ? null : careoSpeech(id, ctrl.signal).then(
    () => { delete C.err[id]; },
    e => { if (e.name !== 'AbortError') C.err[id] = e.message; }));
  careoRender();
  const deRef = pide(ref);
  const esperas = [deRef];
  if (!C.res[mode]) {
    esperas.push(api(`/careo/${ref}?mode=${mode}&top=5`, { signal: ctrl.signal })
      .then(r => { C.res[mode] = r; delete C.err[mode]; },
            e => { if (e.name !== 'AbortError') C.err[mode] = e.message; })
      .then(() => {
        if (!vivo()) return null;
        careoRender();
        const p = careoPickId();
        return p != null ? pide(p) : null;
      }));
  } else {
    const p = careoPickId();
    if (p != null) esperas.push(pide(p));
  }

  deRef?.then(() => { if (vivo()) careoRender(); });
  await Promise.all(esperas);
  if (vivo()) careoRender();
}

function careoWho(x) { return sessShortName(x) || x.label || x.speaker || ''; }

function careoCandTitle(x) {
  return [ident(x.rep_name) ? x.rep_name : (x.speaker_label || x.speaker),
    `${fechaLarga(x.date)} · sesión ${x.num_session ?? '—'} · orden ${x.official_order ?? '—'} · ${nf(x.nwords)} palabras`,
    ...(x.reasons || []).map(r => `· ${r}`)].filter(Boolean).join('\n');
}

function careoOptLabel(x) {
  const cab = S.careo.mode === 'diachronic'
    ? `${fechaCorta(x.date)} · Orden ${x.official_order ?? '—'}`
    : `Réplica: ${careoWho(x)} · Orden ${x.official_order ?? '—'}`;
  const m = (x.reasons || [])[0];
  const t = m ? `${cab} — ${m}` : cab;
  return t.length > 78 ? `${t.slice(0, 77)}…` : t;
}

function careoCandInner(x) {
  const cab = S.careo.mode === 'diachronic'
    ? `<b>${esc(fechaCorta(x.date))}</b> · ses. ${esc(x.num_session ?? '—')} · Orden ${esc(x.official_order ?? '—')}`
    : `<b>${esc(careoWho(x))}</b> · Orden ${esc(x.official_order ?? '—')}`;
  const motivos = (x.reasons || []).slice(0, 2).map(esc).join(' · ');
  return cab + (motivos ? ` <span class="careo-why">· ${motivos}</span>` : '');
}


function careoHead() {
  const en = S.readMode === 'careo', C = S.careo;
  const tit = $('#readTitle');
  if (tit) tit.textContent = en ? 'Careo' : 'Intervención';
  $('#careoModes').hidden = !en;
  $('#careoTools').hidden = !en;
  $('#careoBtn').setAttribute('aria-pressed', String(en));
  if (!en) return;
  $$('#careoModes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cmode === C.mode)));
  const res = C.res[C.mode], sel = $('#careoPick');
  const xs = res?.results || [];
  if (!xs.length) {
    sel.innerHTML = `<option>${C.err[C.mode] ? 'Sin datos' : !res ? 'Buscando réplicas…' : 'Sin réplicas propuestas'}</option>`;
    sel._key = null; sel.disabled = true; sel.title = 'Réplica propuesta (heurística)';
  } else {
    const key = `${C.refId}|${C.mode}`;
    if (sel._key !== key) {
      sel.innerHTML = xs.map(x => `<option value="${x.id}">${esc(careoOptLabel(x))}</option>`).join('');
      sel._key = key;
    }
    const pick = careoPickId();
    sel.disabled = false; sel.value = String(pick);
    const cand = xs.find(x => x.id === pick);
    sel.title = cand ? `Réplica propuesta (heurística)\n${careoCandTitle(cand)}` : '';
  }
  $('#careoSwap').disabled = !xs.length;
}

function careoBarHTML(res) {
  const C = S.careo;
  const heur = `<span class="tag careo-heur" title="${esc(res?.note
    || 'Las réplicas se proponen con una heurística: no prueban que exista un diálogo.')}">heurística</span>`;
  let body;
  if (C.err[C.mode]) {
    body = `<span class="careo-msg err">⚠ ${esc(C.err[C.mode])}</span> <button class="linkbtn" data-careo-retry>Reintentar</button>`;
  } else if (!res) {
    body = `<span class="careo-msg"><span class="spin"></span> Buscando réplicas…</span>`;
  } else if (!res.results?.length) {
    body = `<span class="careo-msg">Sin réplicas propuestas.</span>`;
  } else {
    const pick = careoPickId();
    body = res.results.map(x => `<button type="button" class="careo-cand" data-careo-pick="${x.id}"`
      + ` aria-pressed="${x.id === pick}" title="${esc(careoCandTitle(x))}">${careoCandInner(x)}</button>`).join('');
  }
  const nota = res?.note && res.results?.length ? `<div class="careo-note">${esc(res.note)}</div>` : '';
  const avisos = (res?.warnings || []).map(w => `<div class="careo-note warn">⚠ ${esc(w.message || w.code)}</div>`).join('');
  const titulo = C.mode === 'diachronic' ? 'Otras intervenciones del mismo diputado' : 'Réplicas propuestas';
  return `<div class="careo-bar"><span class="careo-bar-t">${titulo}</span>${heur}${body}${nota}${avisos}</div>`;
}


function careoFolioHTML(d, rol, cand) {
  const m = d.session_meta || null;
  const doc = d.doc || plainDoc(d.speech);
  const sp = doc.speaker || {};
  const chair = CHAIR_ROLES.has(d.role) || sp.is_chair;
  const diario = m?.has_meta && m.diario_num != null ? `${m.sigla || 'DS'} núm. ${m.diario_num}`
    : (d.session_number ? `Sesión núm. ${d.session_number}` : (d.num_session != null ? `Sesión ${d.num_session} del corpus` : ''));
  const kicker = [diario, fechaCorta(m?.date_real || d.date),
    d.official_order != null ? `Orden ${d.official_order}` : ''].filter(Boolean).join(' · ');
  const datos = [chair ? `Presidencia · ${sp.name || m?.presidente?.corto || ''}` : '',
    !chair && ident(d.party) ? d.party : '', !chair && ident(d.sex) ? (S.facets?.labels?.sex?.[d.sex] || d.sex) : '',
    !chair && ident(d.district) ? d.district : '', `${nf(d.nwords)} palabras`].filter(Boolean).join(' · ');
  let span = null;








  const terms = S.mode === 'semantic' ? [] : queryTerms(S.query, S.variants);
  const sw = d.session_warning && d.session_warning.dudosa ? d.session_warning : null;
  const avisos = warningsHTML((d.warnings || []).filter(w => w.affects_speech), sw);





  return `<article class="folio careo-folio" data-careo-id="${d.id}">
    <div class="folio-kicker">${esc(kicker)}</div>
    <h3 class="folio-title">${esc(d.speaker_label || sp.label || d.speaker)}</h3>
    ${ident(d.rep_name) && !chair ? `<div class="folio-rep">${esc(d.rep_name)}</div>` : ''}
    <div class="folio-gov">${esc(datos)}</div>
    <div class="folio-rule"></div>
    ${avisos}
    ${  '' }
    <div class="folio-body">${renderDoc(doc, d.id, { terms, raw: d.speech, span })}</div>
  </article>`;
}

function careoColHTML(rol, id, d, cand = null, res = null) {
  const C = S.careo;
  const wrap = inner => `<section class="careo-col" data-col-id="${rol}-${id ?? 'x'}"`
    + ` aria-label="${rol === 'ref' ? 'Intervención de referencia' : 'Réplica propuesta'}">${inner}</section>`;
  if (rol === 'rep') {
    if (C.err[C.mode]) return wrap(`<div class="empty"><div class="big">⚠</div><p>${esc(C.err[C.mode])}</p></div>`);
    if (!res) return wrap(`<div class="empty"><span class="spin"></span></div>`);
    if (id == null) {
      const otro = C.mode === 'synchronic' ? 'diachronic' : 'synchronic';
      const porque = C.mode === 'synchronic'
        ? 'No hay en esta sesión otras intervenciones que puedan ser réplica (de 45 palabras o más y fuera de la Presidencia).'
        : (res.note || 'No hay otras intervenciones de este diputado que comparar.');
      return wrap(`<div class="empty careo-empty"><div class="big">⚔</div><h3>Sin réplicas propuestas</h3>
        <p>${esc(porque)}</p>
        <p style="margin-top:12px"><button class="btn sm" data-careo-mode="${otro}">Probar «${
          otro === 'diachronic' ? 'Mismo diputado' : 'Misma sesión'}»</button></p></div>`);
    }
  }
  const head = `<div class="careo-colhead">${rol === 'ref'
      ? '<span class="tag star">★ Referencia</span>'
      : `<span class="tag careo-rep" title="${esc(cand ? careoCandTitle(cand) : '')}">Réplica propuesta</span>`}
    <span class="grow"></span>
    <button class="btn sm" data-careo-open="${id}" title="Abrir esta intervención sola en el lector">Abrir en el lector</button>
    <button class="btn sm" data-careo-session="${id}" title="Leer toda su sesión seguida, con esta intervención marcada">📖 Sesión corrida</button></div>`;
  if (C.err[id]) {
    return wrap(head + `<div class="empty"><div class="big">⚠</div><p>${esc(C.err[id])}</p>
      <p><button class="linkbtn" data-careo-retry>Reintentar</button></p></div>`);
  }
  if (!d) return wrap(head + `<div class="empty"><span class="spin"></span></div>`);
  return wrap(head + careoFolioHTML(d, rol, cand));
}

function careoRender() {
  const C = S.careo, sc = $('#reader');
  if (S.readMode !== 'careo') return;
  updateReadHead();

  const antes = new Map($$('.careo-col', sc).map(c => [c.dataset.colId, c.scrollTop]));
  const top = sc.scrollTop;
  const res = C.res[C.mode], cand = careoCand();
  const cols = [careoColHTML('ref', C.refId, careoGet(C.refId)),
                careoColHTML('rep', cand?.id ?? null, cand ? careoGet(cand.id) : null, cand, res)];
  if (C.swapped) cols.reverse();
  sc.innerHTML = `<div class="careo">${careoBarHTML(res)}<div class="careo-duo">${cols.join('')}</div></div>`;
  for (const c of $$('.careo-col', sc)) {
    const t = antes.get(c.dataset.colId);
    if (t) c.scrollTop = t;
  }
  sc.scrollTop = top;







}
















function careoSetMode(m) {
  if (S.readMode !== 'careo' || !['synchronic', 'diachronic'].includes(m) || S.careo.mode === m) return;
  S.careo.mode = m;
  careoLoad();
}

function careoSetPick(id) {
  if (S.readMode !== 'careo' || !Number.isFinite(id)) return;
  S.careo.pick[S.careo.mode] = id;
  careoLoad();
}

function careoSwap() {
  if (S.readMode !== 'careo') return;
  S.careo.swapped = !S.careo.swapped;
  careoRender();
}


function careoClick(e) {
  if (S.readMode !== 'careo') return false;
  const t = e.target;
  const pk = t.closest('[data-careo-pick]');
  if (pk) { careoSetPick(+pk.dataset.careoPick); return true; }
  const op = t.closest('[data-careo-open]');
  if (op) { openSpeech(+op.dataset.careoOpen, { mode: 'speech' }); return true; }
  const se = t.closest('[data-careo-session]');
  if (se) { openSpeech(+se.dataset.careoSession, { mode: 'session' }); return true; }
  const md = t.closest('[data-careo-mode]');
  if (md) { careoSetMode(md.dataset.careoMode); return true; }
  if (t.closest('[data-careo-retry]')) { S.careo.err = {}; careoLoad(); return true; }
  return false;
}















































































async function refreshCollections() {
  S.collections = (await api('/collections')).collections;
}





function setView(v, { refresh = true } = {}) {


  const conBiblioteca = S.lastMeta?.mode === 'library' || (v === 'search' && S.searchStale);
  if (v === 'search') S.searchStale = false;
  S.view = v;
  $$('.tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));


  $('#clearFilters').hidden = v !== 'search';

  qexpPintar();

  listHead();
  if (v === 'search') {
    $('#sideTitle').textContent = 'Filtros'; renderFilters();
    S.lex.ctrl?.abort(); ++S.lex.seq;
    S.coo.ctrl?.abort(); ++S.coo.seq;
    if (conBiblioteca) {

      S.lastMeta = null; S.results = []; S.total = 0; S.exhausted = true;
      $('#resultMeta').innerHTML = '<strong>—</strong>';
      $('#hits').innerHTML = `<div class="empty"><span class="spin"></span></div>`;
      if (refresh) search(true);
    } else { renderMeta(); renderHits(true); }
  }
  else { $('#spectrum').hidden = true;   renderLibraryView(); }
  trendRender();
  updateSideRail();
}




function setSideCollapsed(plegado, { guardar = true } = {}) {
  $('#app').classList.toggle('side-collapsed', plegado);
  $('#sideFold').setAttribute('aria-expanded', String(!plegado));
  $('#sideRail').setAttribute('aria-expanded', String(!plegado));
  if (guardar) { try { localStorage.setItem('panelPlegado', plegado ? '1' : '0'); } catch {   } }
  updateSideRail();
}

function sideCollapsedSaved() {
  try { return localStorage.getItem('panelPlegado') === '1'; } catch { return false; }
}

function updateSideRail() {
  const rail = $('#sideRail');
  if (!rail) return;
  const lbl = ($('#sideTitle')?.textContent || 'Filtros').trim();
  const n = S.view === 'library' ? 0 : ($('#activePills')?._fns?.length || 0);
  $('#sideRailLbl').textContent = lbl;
  const badge = $('#sideRailN');
  badge.hidden = !n; badge.textContent = n ? String(n) : '';
  const txt = `Desplegar ${lbl.toLowerCase()}${n ? ` (${n} ${n === 1 ? 'filtro activo' : 'filtros activos'})` : ''} · tecla f`;
  rail.title = txt; rail.setAttribute('aria-label', txt);
}




function setListCollapsed(plegado, { guardar = true } = {}) {
  $('#app').classList.toggle('list-collapsed', plegado);
  $('#listFold').setAttribute('aria-expanded', String(!plegado));
  $('#listRail').setAttribute('aria-expanded', String(!plegado));
  if (guardar) { try { localStorage.setItem('listaPlegada', plegado ? '1' : '0'); } catch {   } }
  updateListRail();
}

function listCollapsedSaved() {
  try { return localStorage.getItem('listaPlegada') === '1'; } catch { return false; }
}

function updateListRail() {
  const rail = $('#listRail');
  if (!rail) return;
  const n = Number(S.total) || 0;
  const badge = $('#listRailN');
  badge.hidden = !n; badge.textContent = n ? nf(n) : '';
  const txt = `Desplegar la lista${n ? ` (${nf(n)} ${n === 1 ? 'intervención' : 'intervenciones'})` : ''} · tecla l`;
  rail.title = txt; rail.setAttribute('aria-label', txt);
}



function toExplore() {
  if (S.view === 'search') return false;
  setView('search', { refresh: false });
  return true;
}



function listHead() {
  const lib = S.view === 'library';
  for (const id of ['#order', '#statsBtn', '#saveAllBtn']) $(id).hidden = lib;
  const enLib = lib && S.libSel != null;
  $('#exportBtn').textContent = enLib ? 'Exportar biblioteca' : 'Exportar';
  $('#delLibBtn').hidden = !enLib;
  $('#lexExportBtn').hidden = !(enLib && S.libTab === 'lexico' && S.lex.cid === S.libSel
    && S.lex.data && !S.lex.data.error && (S.lex.data.terms?.length || S.lex.data.negative?.length));
}

async function renderLibraryView() {
  await refreshCollections();
  $('#sideTitle').textContent = 'Bibliotecas';
  $('#activePills').hidden = true;
  listHead();
  renderLibList();

  if (S.libSel) loadLibraryItems(S.libSel);
  else {
    $('#resultMeta').innerHTML = '<strong>Bibliotecas</strong>';
    $('#hits').innerHTML = `<div class="empty"><div class="big">◆</div>
      <h3>Sus grupos de intervenciones</h3>
      <p>Una biblioteca es un conjunto curado: puede añadirle intervenciones desde
      cualquier búsqueda, anotarlas, etiquetarlas, y exportarlas a CSV, Markdown o
      referencias citables. También puede compartirla con un colega en un archivo
      <code>.2replib</code>.</p></div>`;
  }
}



function renderLibList() {


  $('#filters').innerHTML = `
    <div style="padding:13px"><button class="btn primary" id="newLibBtn" style="width:100%">+ Nueva biblioteca</button><button class="btn" id="importLibBtn" style="width:100%;margin-top:7px" title="Crear una biblioteca a partir de un archivo .2replib, con sus notas y etiquetas">Importar .2replib…</button></div>
    ${S.collections.length ? S.collections.map(c => `
      <div class="lib-card${S.libSel === c.id ? ' sel' : ''}" data-lib="${c.id}">
        <span class="lib-dot"></span>
        <div style="min-width:0;flex:1">
          <h4>${esc(c.name)}</h4>
          <p>${nf(c.n_items)} ${c.n_items === 1 ? 'intervención' : 'intervenciones'} ·
             ${esc((c.updated_at || '').slice(0, 10))}</p>
          ${c.description ? `<p style="margin-top:3px">${esc(c.description)}</p>` : ''}
        </div>
        <button type="button" class="btn ghost icon lib-ren" data-renlib="${c.id}"
          aria-label="Editar el nombre y la nota de la biblioteca «${esc(c.name)}»" title="Editar el nombre y la nota de la biblioteca «${esc(c.name)}»">✎</button>
        <button type="button" class="btn ghost icon lib-del" data-dellib="${c.id}"
          aria-label="Borrar la biblioteca «${esc(c.name)}»" title="Borrar la biblioteca «${esc(c.name)}» (pide confirmación)">🗑</button>
      </div>`).join('')
      : `<div class="empty" style="padding:26px 16px"><p>Aún no tiene bibliotecas.
          Cree una y vaya guardando en ella las intervenciones que le interesen.</p></div>`}`;

  libStorePintar();

}

async function loadLibraryItems(cid) {
  const mine = ++S.libSeq;
  S.libSel = cid;
  S.lex.ctrl?.abort(); ++S.lex.seq;
  menAbortar();
  $$('.lib-card').forEach(e => e.classList.toggle('sel', +e.dataset.lib === cid));
  listHead();
  $('#hits').innerHTML = `<div class="empty"><span class="spin"></span></div>`;
  try {
    const r = await api(`/collections/${cid}/items?limit=${LIB_PAGE}`);
    if (mine !== S.libSeq || S.view !== 'library') return;
    S.results = r.items; S.total = r.total; S.exhausted = true;
    S.lastMeta = { mode: 'library' };
    S.libInfo = { id: cid, name: r.collection?.name || '', total: r.total,
                  updated: r.collection?.updated_at || '', hash: r.ids_hash || '' };
    renderLibHead();
    if (S.libTab === 'lexico') lexLoad();
    else if (S.libTab === 'coocurrencias') cooLoad();
    else if (S.libTab === 'menciones') menLoad();
    else renderLibItems();
  } catch (e) {
    if (mine !== S.libSeq) return;
    toast(e.message, true);
    $('#hits').innerHTML = `<div class="empty"><div class="big">⚠</div><p>${esc(e.message)}</p></div>`;
  }
}


function renderLibHead() {
  const L = S.libInfo;
  if (!L || S.view !== 'library') return;
  const el = $('#resultMeta');
  el.innerHTML = `<strong class="libname" title="${esc(L.name)}">${esc(L.name)}</strong>`
    + `<div class="tseg libtabs" role="tablist" aria-label="Contenido de la biblioteca">`
    + `<button type="button" role="tab" data-libtab="items" aria-selected="${S.libTab === 'items'}"`
    + ` title="Las intervenciones guardadas, con sus notas y etiquetas">Intervenciones (${nf(L.total)})</button>`
    + `<button type="button" role="tab" data-libtab="lexico" aria-selected="${S.libTab === 'lexico'}"`
    + ` title="Términos característicos de la biblioteca frente al resto del corpus (keyness)">Léxico</button>`
    + `<button type="button" role="tab" data-libtab="coocurrencias" aria-selected="${S.libTab === 'coocurrencias'}"`
    + ` title="Red de coocurrencias de los términos del léxico y temas detectados en ella con el algoritmo de Leiden">Coocurrencias</button>`
    + `<button type="button" role="tab" data-libtab="menciones" aria-selected="${S.libTab === 'menciones'}"`
    + ` title="Personas mencionadas en las intervenciones y red de quién menciona a quién">Menciones</button></div>`
    + (S.libTab === 'lexico' || S.libTab === 'coocurrencias'
      ? `<label class="chk lex-solo" title="Excluye listas de votación, crónica del acta, acotaciones, tablas y notas">`
        + `<input type="checkbox" id="lexSolo"${S.lex.solo ? ' checked' : ''}><span class="lbl">Solo discurso</span></label>`
      : '');
  el.title = '';
  listHead();
}



function lexSoloGuardado() {
  try { return localStorage.getItem('lexSoloDiscurso') !== '0'; } catch { return true; }
}

function lexSoloChange(e) {
  if (e.target?.id !== 'lexSolo') return;
  S.lex.solo = e.target.checked;
  try { localStorage.setItem('lexSoloDiscurso', S.lex.solo ? '1' : '0'); } catch {   }
  if (S.view === 'library' && S.libSel != null && S.libTab === 'lexico') lexLoad();
  if (S.view === 'library' && S.libSel != null && S.libTab === 'coocurrencias') cooLoad();
  if (S.view === 'library' && S.libSel != null && S.libTab === 'coocurrencias') cooLoad();
}

function libTabClick(e) {
  const b = e.target.closest('[data-libtab]');
  if (!b || S.view !== 'library' || S.libSel == null || !S.libInfo) return;
  const tab = b.dataset.libtab;
  if (tab === S.libTab) return;
  S.libTab = tab;
  renderLibHead();
  if (tab !== 'lexico') { S.lex.ctrl?.abort(); ++S.lex.seq; }
  if (tab !== 'coocurrencias') { S.coo.ctrl?.abort(); ++S.coo.seq; }
  if (tab !== 'menciones') menAbortar();
  if (tab === 'lexico') lexLoad();
  else if (tab === 'coocurrencias') cooLoad();
  else if (tab === 'menciones') menLoad();
  else renderLibItems();
}



const LIB_PAGE = 1000;

async function loadMoreLibItems() {
  const L = S.libInfo, cid = S.libSel, mine = S.libSeq;
  if (!L || cid == null || S.view !== 'library' || S.libTab !== 'items') return;
  const btn = $('#hits [data-libmore]');
  if (btn) { btn.disabled = true; btn.textContent = 'Cargando…'; }
  try {
    const r = await api(`/collections/${cid}/items?limit=${LIB_PAGE}&offset=${S.results.length}`);
    if (mine !== S.libSeq || S.view !== 'library' || S.libSel !== cid) return;
    const vistos = new Set(S.results.map(x => x.id));
    S.results = S.results.concat(r.items.filter(x => !vistos.has(x.id)));
    S.total = r.total;
    renderLibItems({ keepScroll: true });
  } catch (e) {
    toast(e.message, true);
    if (btn) { btn.disabled = false; btn.textContent = 'Reintentar'; }
  }
}

function renderLibItems({ keepScroll = false } = {}) {
  const r = { items: S.results || [] };
  const sc = listScroller(), top = sc.scrollTop;
  {
    if (!r.items.length) {
      $('#hits').innerHTML = `<div class="empty"><div class="big">◇</div>
        <h3>Biblioteca vacía</h3><p>Vaya a <b>Explorar</b>, abra una intervención y
        pulse <b>+ Biblioteca</b>. También puede guardar de golpe todos los
        resultados de una búsqueda con <b>Guardar todo</b>.</p></div>`;
      return;
    }
    $('#hits').innerHTML = r.items.map(it => `
      <article class="hit${S.selected === it.id ? ' sel' : ''}" data-id="${it.id}">
        <div class="hit-top">
          <span class="hit-name">${esc(it.rep_name && it.rep_name !== 'Sin identificar' ? it.rep_name : it.speaker)}</span>
          <span class="hit-date">${esc(it.date)}</span>
        </div>
        <div class="hit-snip">${esc(it.snippet)}</div>
        ${it.note ? `<p class="dsub" style="margin:6px 0 0;font-size:12px;
           border-left:2px solid var(--sem);padding-left:8px">${esc(it.note)}</p>` : ''}
        <div class="hit-foot">
          ${(it.tags || []).map(t => `<span class="tag sem">${esc(t)}</span>`).join('')}
          ${it.party && it.party !== 'Sin identificar' ? `<span class="tag">${esc(it.party)}</span>` : ''}
          <span class="tag words">${nf(it.nwords)} pal.</span>
          <button class="btn ghost sm" data-note="${it.id}" style="margin-left:auto"
            title="${it.note ? 'Editar o borrar la nota de esta intervención' : 'Escribir una nota para esta intervención'}">${it.note ? 'Editar nota' : 'Añadir nota'}</button>
          <button class="btn danger sm" data-rm="${it.id}">Quitar</button>
        </div>
      </article>`).join('')
      + (r.items.length < S.total
        ? `<div class="empty lib-more"><p>Se muestran ${nf(r.items.length)} de ${nf(S.total)} intervenciones.</p>
            <p style="margin-top:8px"><button class="btn sm" data-libmore>Mostrar ${nf(Math.min(LIB_PAGE, S.total - r.items.length))} más</button></p></div>`
        : '');
    sc.scrollTop = keepScroll ? top : 0;
  }
}







async function openDelLib(cid) {
  const dlg = $('#dlgDelLib');
  if (cid == null || dlg.open || dlg._busy || dlg._abriendo) return;
  dlg._abriendo = true;
  try {

    try { await refreshCollections(); } catch {   }
    const c = S.collections.find(x => x.id === cid);
    if (!c) {
      toast('Esa biblioteca ya no existe.', true);
      await libDeleted(cid);
      return;
    }
    const n = +c.n_items || 0;
    dlg._cid = cid; dlg._name = c.name;
    $('#delLibTxt').innerHTML = n
      ? `Se borrará la biblioteca <b>«${esc(c.name)}»</b> con sus <b>${nf(n)} ${n === 1 ? 'intervención guardada' : 'intervenciones guardadas'}</b>, y sus notas y etiquetas.`
      : `Se borrará la biblioteca <b>«${esc(c.name)}»</b>, que está vacía.`;
    const extra = [];
    if (S.filters.collection_id != null && +S.filters.collection_id === cid)
      extra.push('La búsqueda de Explorar está restringida a esta biblioteca: se quitará esa restricción.');
    const usan = [...(S.saved?.values() || [])].filter(s => +s.filters?.collection_id === cid).length;
    if (usan)
      extra.push(`${nf(usan)} ${usan === 1 ? 'búsqueda guardada la usa: se conserva, pero al lanzarla buscará'
        : 'búsquedas guardadas la usan: se conservan, pero al lanzarlas buscarán'} en todo el corpus.`);
    $('#delLibExtra').textContent = extra.join(' ');
    $('#delLibExp').hidden = !n;
    $('#delLibConfirm').disabled = false;
    dlg._opener = document.activeElement;
    dlg.showModal();
    dlg.querySelector('[data-close]').focus();
  } finally { dlg._abriendo = false; }
}

async function doDelLib() {
  const dlg = $('#dlgDelLib'), btn = $('#delLibConfirm');
  const cid = dlg._cid, name = dlg._name;
  if (dlg._busy || btn.disabled || cid == null) return;
  const busy = busyStart(dlg, btn, 'Borrando…');
  $('#delLibExport').disabled = true;
  let hecho = false, yaNo = false;
  try {
    await api(`/collections/${cid}`, { method: 'DELETE' });
    hecho = true;
  } catch (e) {

    if (e.status === 404) hecho = yaNo = true;
    else toast(e.message, true);
  } finally {
    busy.end(); btn.disabled = false; $('#delLibExport').disabled = false;
  }
  if (!hecho) return;
  dlg._cid = null;
  dlg.close();
  toast(yaNo ? `La biblioteca «${name}» ya no existía` : `Biblioteca «${name}» borrada`);
  await libDeleted(cid);
  delLibFoco(dlg._opener);
}







function delLibFoco(opener) {
  const visible = el => !!el && el.isConnected && !el.disabled && el.getClientRects().length > 0;
  const a = document.activeElement;
  if (a && a !== document.body && visible(a)) return;
  const destino = [opener, S.view === 'library' ? $('#newLibBtn') : $('#fLib'),
    $(`.tabs button[data-view=${S.view}]`)].find(visible);
  destino?.focus();
}



function delLibExport() {
  const dlg = $('#dlgDelLib'), cid = dlg._cid;
  if (dlg._busy || cid == null) return;
  dlg.close();
  openExport({ lib: cid, format: 'bundle', alCerrar: () => openDelLib(cid) });
}





async function libDeleted(cid) {
  S.collections = S.collections.filter(c => c.id !== cid);
  S.statsCache = null;

  for (const k of [...S.lex.cache.keys()]) if (k.split('|')[1] === String(cid)) S.lex.cache.delete(k);
  if (S.lex.cid === cid || S.libInfo?.id === cid) {
    S.lex.ctrl?.abort(); ++S.lex.seq; S.lex.data = null; S.lex.cid = null;
  }

  for (const [id, m] of Object.entries(S.membership))
    if (m.includes(cid)) S.membership[id] = m.filter(x => x !== cid);
  if (S.current?.collections?.includes(cid)) S.current.collections = S.current.collections.filter(x => x !== cid);

  if (S.libSel === cid) {
    S.libSel = null; S.libInfo = null; S.libTab = 'items'; ++S.libSeq;
    if (S.view === 'library') { S.results = []; S.total = 0; S.exhausted = true; }
  }


  const filtro = S.filters.collection_id != null && +S.filters.collection_id === cid;
  if (filtro) delete S.filters.collection_id;
  if (S.view === 'library') {
    if (filtro) S.searchStale = true;
    if (S.libSel != null) {




      try { await refreshCollections(); } catch {   }
      if (S.view === 'library') { renderLibList(); listHead(); }
    } else {
      try { await renderLibraryView(); } catch (e) { toast(e.message, true); }
    }
  } else {
    try { await refreshCollections(); } catch {   }
    renderFilters();
    if (filtro) search(true); else refreshHitMarkers();
  }

  if (S.readMode === 'speech' && S.current && S.current.id === S.selected) renderReader(S.current, { restore: true });
}





const LEX_FIRST = 300;
const LEX_BADGE = { Exclusivo: 'ex', 'Muy distintivo': 'md', Significativo: 'sg' };

const LEX_EXCL = [['listas', 'listas de votación'], ['cronica', 'crónica del acta'], ['acotaciones', 'acotaciones'],
  ['tablas', 'tablas'], ['notas', 'notas'], ['cabeceras', 'cabeceras de página'], ['etiquetas', 'etiquetas de orador'],
  ['otros', 'otros']];
const lexDesglose = (tx, fmt = nf) => LEX_EXCL.filter(([k]) => +tx?.excluidos?.[k] > 0)
  .map(([k, lab]) => `${lab} ${fmt(tx.excluidos[k])}`).join(', ');

function lexNum(v, dec) {
  if (v == null || !isFinite(v)) return '—';
  return agrupa(Math.abs(+v).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
}
const lexSigned = (v, dec) => (v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${lexNum(v, dec)}`);
const lexPm = v => lexNum(v, v != null && Math.abs(v) < 0.1 ? 3 : 2);

async function lexLoad() {
  const L = S.libInfo, X = S.lex, box = $('#hits');
  if (!L || S.view !== 'library' || S.libTab !== 'lexico') return;


  const key = `${S.info?.name || ''}|${L.id}|${L.total}|${L.hash || L.updated}|${X.solo ? 'discurso' : 'completo'}`;
  X.ctrl?.abort();
  const mine = ++X.seq;
  if (X.cid !== L.id) X.showAll = false;
  if (!L.total) {
    X.data = null; X.cid = L.id; listHead();
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Biblioteca vacía</h3>
      <p>El léxico compara el vocabulario de la biblioteca con el resto del corpus. Añada
      intervenciones desde <b>Explorar</b> con <b>+ Biblioteca</b> o <b>Guardar todo</b>.</p></div>`;
    return;
  }
  if (X.cache.has(key)) { X.data = X.cache.get(key); X.cid = L.id; lexRender(); return; }
  X.data = null; X.cid = null; listHead();
  const t0 = performance.now();
  box.innerHTML = `<div class="empty lex-prog" role="status" aria-live="polite">
    <p>Calculando el léxico ${X.solo ? '(solo discurso)' : '(texto completo)'} de ${nf(L.total)} ${L.total === 1 ? 'intervención' : 'intervenciones'}
    frente al resto del corpus…</p>
    <div class="bar" role="progressbar" aria-label="Progreso del léxico" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
    <p class="lex-prog-fase">Preparando…</p>
    <p class="lex-prog-t dsub">0 % · 0 s</p>
    <p style="margin-top:10px"><button class="btn sm" data-lexcancel>Cancelar</button></p>
    ${X.solo && L.total > 1500
      ? `<p class="dsub" style="margin-top:8px;font-size:11.5px">Se separa el discurso de listas, crónica y acotaciones antes de contar; en bibliotecas grandes tarda unos segundos.</p>` : ''}</div>`;
  let ultimoEv = null;
  const pintaProgreso = (ev) => {
    if (mine !== X.seq) return;
    const bar = box.querySelector('.lex-prog');
    if (!bar) return;
    if (ev) ultimoEv = ev;
    const e = ultimoEv;
    const s = (performance.now() - t0) / 1000;
    const pct = e ? Math.round(Math.max(0, Math.min(1, e.fraccion || 0)) * 100) : 0;
    bar.querySelector('.bar i').style.width = `${pct}%`;
    bar.querySelector('.bar').setAttribute('aria-valuenow', String(pct));
    if (e) {
      const cuenta = e.total > 1 ? ` · ${nf(e.hecho)} de ${nf(e.total)}` : '';
      bar.querySelector('.lex-prog-fase').textContent = `${e.indice}/${e.n_fases} · ${e.etiqueta}${cuenta}`;
    }
    const eta = e && e.fraccion > 0.08 && e.fraccion < 1 ? s / e.fraccion - s : null;
    bar.querySelector('.lex-prog-t').textContent = `${pct} % · ${Math.round(s)} s${eta != null ? ` · quedan unos ${Math.max(1, Math.round(eta))} s` : ''}`;
  };
  const reloj = setInterval(() => pintaProgreso(null), 500);
  const ctrl = X.ctrl = new AbortController();
  try {
    const r = await api(`/collections/${L.id}/keyness?limit=2000&limit_negative=200&solo_discurso=${X.solo}`,
      { signal: ctrl.signal, alProgreso: pintaProgreso });
    clearInterval(reloj);
    if (mine !== X.seq || S.view !== 'library' || S.libSel !== L.id || S.libTab !== 'lexico') return;
    if (!r.error) {
      X.cache.set(key, r);
      if (X.cache.size > 8) X.cache.delete(X.cache.keys().next().value);
    }
    X.data = r; X.cid = L.id;
    lexRender();
  } catch (e) {
    clearInterval(reloj);
    if (mine !== X.seq) return;
    if (e.name === 'AbortError') {
      if (S.view === 'library' && S.libTab === 'lexico' && box.querySelector('.lex-prog')) {
        box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Cálculo cancelado</h3>
          <p>Puede volver a lanzarlo cuando quiera.</p><p style="margin-top:10px"><button class="btn sm" data-lexretry>Calcular el léxico</button></p></div>`;
      }
      return;
    }
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>No se pudo calcular el léxico</h3>
      <p>${esc(e.message)}</p><p style="margin-top:10px"><button class="btn sm" data-lexretry>Reintentar</button></p></div>`;
  }
}

function lexRowHTML(t, gmax, r, neg = false) {
  const w = gmax > 0 ? Math.max(1, Math.min(100, Math.abs(t.g2) / gmax * 100)) : 0;
  const badge = t.badge
    ? `<span class="lex-badge ${LEX_BADGE[t.badge] || 'sg'}" title="${esc(r.badges?.[t.badge] || '')}">${esc(t.badge)}</span>`
    : (neg ? '<span class="lex-badge neg" title="Menos frecuente en la biblioteca que en el resto del corpus">Infrauso</span>' : '');


  const forma = t.display || t.term;
  const expr = t.expresion ? ` <span class="lex-expr" title="Expresión de varias palabras detectada en el corpus: se cuentan todas sus apariciones">expr.</span>` : '';
  return `<tr class="lex-row${t.expresion ? ' es-expr' : ''}" data-lexterm="${esc(forma)}" tabindex="0"
      title="Buscar «${esc(forma)}» en modo Palabras dentro de esta biblioteca${forma !== t.term ? ` (índice: ${esc(t.term)})` : ''}">
    <td class="lex-term">${esc(forma)}${expr}</td>
    <td class="num">${nf(t.freq)}</td>
    <td class="num">${lexPm(t.pm)}</td>
    <td class="num c-ref">${lexPm(t.pm_ref)}</td>
    <td class="lex-g2"><span class="kbar${neg ? ' neg' : ''}"><i style="width:${w.toFixed(1)}%"></i></span><span class="num">${lexSigned(t.g2, 1)}</span></td>
    <td class="num c-lr">${lexSigned(t.log_ratio, 2)}</td>
    <td>${badge}</td></tr>`;
}

function lexTableHTML(rows, gmax, r, neg = false) {
  const n = r.notes || {};
  return `<div class="lex-wrap"><table class="lex-table">
    <thead><tr><th>Término</th>
      <th class="num" title="Apariciones en la biblioteca">Frec.</th>
      <th class="num" title="Apariciones por cada 1.000 palabras de la biblioteca">‰ biblioteca</th>
      <th class="num c-ref" title="Apariciones por cada 1.000 palabras del resto del corpus">‰ resto corpus</th>
      <th title="${esc(n.g2 || '')}">Keyness G²</th>
      <th class="num c-lr" title="${esc(n.log_ratio || '')}">Log-ratio</th>
      <th>Distintividad</th></tr></thead>
    <tbody>${rows.map(t => lexRowHTML(t, gmax, r, neg)).join('')}</tbody></table></div>`;
}

function lexRender({ keepScroll = false } = {}) {
  const r = S.lex.data, L = S.libInfo, box = $('#hits'), sc = listScroller();
  if (!r || !L || S.view !== 'library' || S.libTab !== 'lexico') return;
  listHead();
  const top = sc.scrollTop;
  if (r.error) {
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>No se pudo calcular el léxico</h3><p>${esc(r.error)}</p></div>`;
    return;
  }
  if (!r.n_texts) {
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Sin texto que analizar</h3>
      <p>Ninguna intervención de esta biblioteca está en el corpus abierto.</p></div>`;
    return;
  }
  const m = r.metrics || {}, n = r.notes || {};
  const terms = r.terms || [], neg = r.negative || [];
  const metric = (k, v, extra = '', tit = '') => `<div class="lex-metric"${tit ? ` title="${esc(tit)}"` : ''}>`
    + `<div class="k">${k}</div><div class="v">${v}</div>${extra ? `<div class="s">${extra}</div>` : ''}</div>`;
  const millones = (+r.reference_tokens / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  const gmax = Math.max(+m.g2_max || 0, ...terms.map(t => +t.g2 || 0));
  const vistos = S.lex.showAll ? terms : terms.slice(0, LEX_FIRST);
  const faltan = r.n_found != null && r.n_requested != null && r.n_found < r.n_requested
    ? `<p class="lex-note warn">⚠ ${nf(r.n_requested - r.n_found)} de las ${nf(r.n_requested)} intervenciones guardadas no se encontraron en este corpus y no cuentan.</p>` : '';
  const recorte = r.n_positive > terms.length
    ? ` Se listan los ${nf(terms.length)} de mayor G² de ${nf(r.n_positive)}.` : '';
  const tabla = terms.length
    ? lexTableHTML(vistos, gmax, r)
      + (vistos.length < terms.length
        ? `<p class="lex-more"><button class="btn sm" data-lexmore>Mostrar los ${nf(terms.length - vistos.length)} términos restantes</button></p>` : '')
    : `<div class="empty" style="padding:26px 16px"><h3>Ningún término distintivo</h3>
        <p>Ningún término alcanza p &lt; 0,001 con al menos ${nf(r.min_freq)} apariciones.
        Con más intervenciones la comparación gana potencia.</p></div>`;
  const gneg = Math.max(0, ...neg.map(t => Math.abs(+t.g2 || 0)));
  const negativos = neg.length
    ? `<details class="lex-neg"><summary>Términos infrausados (${nf(neg.length)}${r.n_negative > neg.length ? ` de ${nf(r.n_negative)}` : ''}):
        menos frecuentes en la biblioteca que en el resto del corpus</summary>${lexTableHTML(neg, gneg, r, true)}</details>` : '';

  const tx = r.texto || null, discurso = (r.modo_texto === 'discurso' || r.modo_texto === 'discurso_rapido') && !!tx;
  const rapida = discurso && (r.modo_texto === 'discurso_rapido' || tx.segmentacion === 'rapida');
  const nInterv = `${nf(r.n_texts)} ${r.n_texts === 1 ? 'intervención' : 'intervenciones'}`;
  const desglose = discurso ? lexDesglose(tx) : '';
  const titPalabras = [n.tokens, discurso
    ? `Solo discurso${rapida ? ' (segmentación rápida)' : ''}: ${nf(tx.tokens_analizados)} de ${nf(tx.tokens_brutos)} palabras de ${nInterv}. Excluidas: ${desglose || 'ninguna'}.`
    : `Texto completo de ${nInterv}.`].filter(Boolean).join(' ');
  const modoNota = discurso
    ? `<b>Solo discurso${rapida ? ' (segmentación rápida)' : ''}</b>: se analizan ${nf(tx.tokens_analizados)} de las ${nf(tx.tokens_brutos)} palabras de ${nInterv};
       se excluyen ${nf(tx.tokens_excluidos)}${desglose ? ` (${esc(desglose)})` : ''}.${rapida
         ? ' En bibliotecas de más de 25 millones de caracteres se excluyen solo las acotaciones entre paréntesis y las líneas en mayúsculas (listas, cabeceras), sin el análisis completo del Diario.'
         : ''} `
    : `<b>Texto completo</b>: ${nInterv} enteras, incluidas listas de votación, crónica del acta, acotaciones y tablas. `;
  box.innerHTML = `<div class="lex">
    <div class="lex-metrics">
      ${metric('Palabras', nf(m.tokens), discurso ? `analizadas de ${nf(tx.tokens_brutos)}` : nInterv, titPalabras)}
      ${metric('Términos distintos', nf(m.types))}
      ${metric('TTR', lexNum(m.ttr, 3), 'depende del tamaño', n.ttr)}
      ${metric('G² máximo', `<span class="gold">${lexSigned(m.g2_max, 1)}</span>`, terms[0] ? `«${esc(terms[0].display || terms[0].term)}»` : '', n.g2)}
    </div>
    ${faltan}
    <p class="lex-note">${modoNota}Keyness G² (log-likelihood de Dunning) de cada término frente al resto del corpus
      (${esc(millones)} millones de palabras sin ${discurso ? 'el discurso analizado' : 'esta biblioteca'}). Solo términos con p &lt; 0,001
      (G² ≥ ${lexNum(r.threshold ?? 10.83, 2)}) y al menos ${nf(r.min_freq)} apariciones, sin palabras vacías:
      ${nf(r.significant)} significativos de ${nf(r.candidates)} candidatos.${recorte}
      El log-ratio mide el tamaño del efecto (cada punto duplica la frecuencia relativa). El TTR baja al
      crecer la biblioteca: compare solo bibliotecas de tamaño parecido. Las palabras son las del índice
      de búsqueda («S. S.» cuenta dos).${r.expresiones ? ` Incluye <b>expresiones de varias palabras</b>, marcadas
      <span class="lex-expr">expr.</span>: ${nf(r.expresiones.inventario)} detectadas en todo el corpus al cargarlo
      (<button type="button" class="linkbtn" data-exprrev>revisarlas</button>), de las que
      ${nf(r.expresiones.de_sobreuso)} son características de esta biblioteca. Se cuentan todas sus apariciones, igual que las
      palabras, que siguen contando también dentro de ellas: «seguridad» incluye los usos de «seguridad pública».` : ''}</p>
    ${tabla}
    ${negativos}
    <p class="lex-foot">Clic en un término (o Intro): búsqueda en modo Palabras dentro de esta biblioteca, en Explorar.${
      r.ms != null ? ` · ${nf(Math.round(r.ms))} ms` : ''}</p>
    ${fuentePieHTML('panel-fuente')}
  </div>`;
  sc.scrollTop = keepScroll ? top : 0;
}

function lexClick(e) {
  if (S.view !== 'library') return false;
  const row = e.target.closest('[data-lexterm]');
  if (row) { lexSearch(row.dataset.lexterm); return true; }
  if (e.target.closest('[data-lexmore]')) { S.lex.showAll = true; lexRender({ keepScroll: true }); return true; }
  if (e.target.closest('[data-lexretry]')) { lexLoad(); return true; }
  if (e.target.closest('[data-lexcancel]')) { S.lex.ctrl?.abort(); return true; }
  if (e.target.closest('[data-exprrev]')) { exprAbrir(); return true; }
  return false;
}

function lexKey(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest?.('[data-lexterm]');
  if (!row) return;
  e.preventDefault(); e.stopPropagation();
  lexSearch(row.dataset.lexterm);
}




// ================================================================================================ expresiones
// Revisión de las expresiones de varias palabras del corpus (worker/34a_engine__expresiones.js, rutas /expressions): lista
// con búsqueda y orden, exportación en CSV y elección de las que no deben unirse (sus palabras vuelven a contar sueltas en
// el léxico y en las coocurrencias).
const EXPR_LOTE = 200;
const EXPR_ORDENES = [['frecuencia', 'Más frecuentes'], ['g2', 'Más asociadas (G²)'], ['longitud', 'Más largas'], ['alfabetico', 'Alfabético']];
const EX_ST = { q: '', orden: 'frecuencia', solo: false, filas: [], total: 0, inventario: 0, meta: null, rech: new Set(),
  rechServidor: new Set(), seq: 0, tq: null, ocupado: false };

// Las que no se unen se guardan en este navegador por corpus y se vuelven a enviar al motor al abrirlo: la base no
// cambia después de construirla.
const exprClave = () => `diarios-explorer:expresiones-rechazadas:${S.info?.corpus_bibliotecas || S.info?.name || ''}`;
function exprGuardarLocal(lista) {
  try { if (lista.length) localStorage.setItem(exprClave(), JSON.stringify(lista)); else localStorage.removeItem(exprClave()); } catch {   }
}
async function exprRestaurar() {
  let lista = null;
  try { lista = JSON.parse(localStorage.getItem(exprClave()) || 'null'); } catch { lista = null; }
  if (!Array.isArray(lista) || !lista.length) return;
  try {
    await api('/expressions/rejected', { method: 'POST', body: { rechazadas: lista } });
    S.lex.cache.clear(); S.coo.cache.clear();
  } catch {   }
}

async function exprAbrir() {
  let dlg = $('#dlgExpr');
  if (!dlg) {
    document.body.insertAdjacentHTML('beforeend', `<dialog id="dlgExpr" aria-labelledby="exprTitulo">
  <div class="dhead"><h3 id="exprTitulo">Expresiones de varias palabras del corpus</h3><p class="dsub" id="exprSub"></p></div>
  <div class="expr-barra">
    <input type="search" id="exprQ" placeholder="Buscar: seguridad, reforma…" aria-label="Buscar expresiones" autocomplete="off">
    <select id="exprOrden" aria-label="Orden">${EXPR_ORDENES.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select>
    <label class="chk"><input type="checkbox" id="exprSolo"><span class="lbl">Solo las que no se unen</span></label>
  </div>
  <div class="dbody" id="exprLista"></div>
  <div class="dfoot"><button type="button" class="btn ghost" id="exprCSV">Exportar CSV</button><span class="expr-cambios dsub" id="exprCambios"></span>
    <button type="button" class="btn" data-close>Cerrar</button><button type="button" class="btn primary" id="exprAplicar" disabled>Aplicar</button></div>
</dialog>`);
    dlg = $('#dlgExpr');
    dlg.addEventListener('click', ev => {
      if (ev.target.closest('[data-close]')) { if (!EX_ST.ocupado) dlg.close(); return; }
      if (ev.target.closest('#exprAplicar')) { exprAplicar(); return; }
      if (ev.target.closest('#exprCSV')) { exprExportar(); return; }
      if (ev.target.closest('[data-exprmas]')) { exprCargar(true); }
    });
    dlg.addEventListener('change', ev => {
      const t = ev.target;
      if (t.matches('[data-exprforma]')) {
        const f = t.dataset.exprforma;
        if (t.checked) EX_ST.rech.delete(f); else EX_ST.rech.add(f);
        t.closest('tr')?.classList.toggle('expr-no', !t.checked);
        exprCambios();
      } else if (t.id === 'exprOrden') { EX_ST.orden = t.value; exprCargar(); }
      else if (t.id === 'exprSolo') { EX_ST.solo = t.checked; exprCargar(); }
    });
    $('#exprQ').addEventListener('input', ev => {
      clearTimeout(EX_ST.tq);
      EX_ST.tq = setTimeout(() => { EX_ST.q = ev.target.value; exprCargar(); }, 250);
    });
    dlg.addEventListener('cancel', ev => { if (EX_ST.ocupado) ev.preventDefault(); });
  }
  $('#exprQ').value = EX_ST.q; $('#exprOrden').value = EX_ST.orden; $('#exprSolo').checked = EX_ST.solo;
  $('#exprLista').innerHTML = '<p class="dsub">Cargando…</p>';
  dlg.showModal();
  try {
    const r = await api('/expressions?' + new URLSearchParams({ solo: 'rechazadas', limite: '0' }));
    EX_ST.rechServidor = new Set((r.filas || []).map(x => x.forma));
    EX_ST.rech = new Set(EX_ST.rechServidor);
  } catch (e) {
    $('#exprLista').innerHTML = `<p class="dsub">No se pudo leer la lista: ${esc(e.message)}</p>`;
    return;
  }
  exprCargar();
}

async function exprCargar(mas = false) {
  const mine = ++EX_ST.seq;
  const desde = mas ? EX_ST.filas.length : 0;
  const q = new URLSearchParams({ q: EX_ST.q, orden: EX_ST.orden, limite: String(EXPR_LOTE), desde: String(desde),
    solo: EX_ST.solo ? 'rechazadas' : 'todas' });
  let r;
  try { r = await api('/expressions?' + q); } catch (e) {
    if (mine === EX_ST.seq) $('#exprLista').innerHTML = `<p class="dsub">No se pudo leer la lista: ${esc(e.message)}</p>`;
    return;
  }
  if (mine !== EX_ST.seq) return;
  if (!r.disponible) {
    EX_ST.filas = []; EX_ST.total = 0;
    $('#exprSub').textContent = '';
    $('#exprLista').innerHTML = `<p class="dsub">Esta base no tiene expresiones detectadas: se construyó sin esa fase. Vuelva a
      elegir el CSV para construirla de nuevo.</p>`;
    return;
  }
  EX_ST.filas = mas ? EX_ST.filas.concat(r.filas) : r.filas;
  EX_ST.total = r.total; EX_ST.meta = r.meta;
  if (!EX_ST.q && !EX_ST.solo) EX_ST.inventario = r.total;
  exprPintar();
}

function exprPintar() {
  const m = EX_ST.meta || {};
  $('#exprSub').innerHTML = `${nf(m.seleccionadas ?? EX_ST.inventario)} detectadas al construir la base, en ${nf(m.intervenciones)}
    intervenciones y ${nf(m.tokens_corpus)} palabras: de 2 a ${nf(m.max_tokens || 7)} palabras, al menos ${nf(m.frecuencia_minima)} apariciones
    en ${nf(m.intervenciones_minimas)} intervenciones y asociación significativa.${m.precalculada ? ` Se cargaron ya calculadas
    porque el CSV es idéntico al publicado en Dataverse${m.precalculada.origen?.dataverse?.version ? ` (versión ${esc(String(m.precalculada.origen.dataverse.version))})` : ''}:
    son las mismas que se detectarían.` : ''} Desmarque las que no deban unirse: sus palabras volverán a contar sueltas en el
    léxico y en las coocurrencias.`;
  const filas = EX_ST.filas;
  if (!filas.length) {
    $('#exprLista').innerHTML = `<p class="dsub">${EX_ST.solo ? 'Todas las expresiones se unen.' : 'Ninguna expresión contiene ese texto.'}</p>`;
    exprCambios();
    return;
  }
  const cuerpo = filas.map(x => {
    const no = EX_ST.rech.has(x.forma);
    return `<tr${no ? ' class="expr-no"' : ''}><td><input type="checkbox" data-exprforma="${esc(x.forma)}"${no ? '' : ' checked'}
      aria-label="Unir «${esc(x.mostrar)}»"></td><td class="expr-f">${esc(x.mostrar)}</td><td class="num">${nf(x.frecuencia)}</td>
      <td class="num">${nf(x.intervenciones)}</td><td class="num">${x.g2 == null ? '—' : nf(Math.round(x.g2))}</td></tr>`;
  }).join('');
  const mas = filas.length < EX_ST.total
    ? `<p class="expr-mas"><button type="button" class="btn sm" data-exprmas>Mostrar ${nf(Math.min(EXPR_LOTE, EX_ST.total - filas.length))} más</button>
       <span class="dsub">${nf(filas.length)} de ${nf(EX_ST.total)}</span></p>` : '';
  $('#exprLista').innerHTML = `<table class="expr-tabla"><thead><tr><th title="Se une en una sola unidad">unir</th><th>expresión</th>
    <th class="num">apariciones</th><th class="num">intervenciones</th><th class="num">G²</th></tr></thead><tbody>${cuerpo}</tbody></table>${mas}`;
  exprCambios();
}

function exprCambios() {
  const a = EX_ST.rech, b = EX_ST.rechServidor;
  let n = 0;
  for (const f of a) if (!b.has(f)) n++;
  for (const f of b) if (!a.has(f)) n++;
  const btn = $('#exprAplicar');
  if (btn && !EX_ST.ocupado) btn.disabled = !n;
  const t = $('#exprCambios');
  if (t) t.textContent = n ? `${nf(n)} ${n === 1 ? 'cambio' : 'cambios'} sin aplicar` : (a.size ? `${nf(a.size)} no se ${a.size === 1 ? 'une' : 'unen'}` : '');
}

async function exprAplicar() {
  const btn = $('#exprAplicar');
  if (!btn || EX_ST.ocupado) return;
  EX_ST.ocupado = true; btn.disabled = true; btn.textContent = 'Aplicando…';
  try {
    const r = await api('/expressions/rejected', { method: 'POST', body: { rechazadas: [...EX_ST.rech] } });
    EX_ST.rech = new Set(r.formas || []);
    EX_ST.rechServidor = new Set(EX_ST.rech);
    exprGuardarLocal(r.formas || []);
    S.lex.cache.clear(); S.coo.cache.clear();
    toast(r.rechazadas ? `${nf(r.rechazadas)} ${r.rechazadas === 1 ? 'expresión no se une' : 'expresiones no se unen'}: el léxico y las coocurrencias se recalculan.`
      : 'Todas las expresiones se unen de nuevo.');
    $('#dlgExpr').close();
    if (S.view === 'library' && S.libTab === 'lexico') lexLoad();
    else if (S.view === 'library' && S.libTab === 'coocurrencias') cooLoad();
  } catch (e) {
    toast(`No se pudo guardar: ${e.message}`, true);
  } finally {
    EX_ST.ocupado = false; btn.textContent = 'Aplicar'; exprCambios();
  }
}

async function exprExportar() {
  const btn = $('#exprCSV');
  if (btn._busy) return;
  btn._busy = true; btn.disabled = true;
  try {
    const q = new URLSearchParams({ q: EX_ST.q, orden: EX_ST.orden, limite: '0', solo: EX_ST.solo ? 'rechazadas' : 'todas' });
    const r = await api('/expressions?' + q);
    const m = r.meta || {};
    const meta = [
      'Explorador de Diarios de Sesiones · expresiones de varias palabras del corpus',
      `corpus: ${S.info?.title || S.info?.name || ''}`,
      `generado: ${new Date().toISOString().slice(0, 19)}`,
      `detección: ${nf(m.intervenciones)} intervenciones, ${nf(m.tokens_corpus)} palabras · de 2 a ${m.max_tokens} palabras · frecuencia mínima ${m.frecuencia_minima} en ${m.intervenciones_minimas} intervenciones · G² ≥ ${m.umbral_g2} con la última palabra · ${m.muestra_1_de > 1 ? `descubrimiento en una muestra de 1 de cada ${m.muestra_1_de} intervenciones y recuento exacto en todas` : 'recuento en todas las intervenciones'}`,
      `filtro: ${EX_ST.q ? `contienen «${EX_ST.q}»` : 'todas'}${EX_ST.solo ? ' · solo las que no se unen' : ''} · ${nf(r.total)} expresiones`,
    ];
    const cols = ['expresion', 'forma_indice', 'tokens', 'palabras_contenido', 'apariciones', 'apariciones_independientes', 'intervenciones', 'g2', 'c_value', 'se_une'];
    const filas = r.filas.map(x => [x.mostrar, x.forma, x.n_tokens, x.n_palabras, x.frecuencia, x.independiente, x.intervenciones, x.g2 ?? '', x.cvalue ?? '',
      EX_ST.rechServidor.has(x.forma) ? 'no' : 'sí']);
    const slug = foldMap(S.info?.name || 'corpus').folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'corpus';
    downloadText(csvConFuente(meta, cols, filas), `expresiones_${slug}.csv`, 'text/csv;charset=utf-8');
  } catch (e) {
    toast(`No se pudo exportar: ${e.message}`, true);
  } finally { btn._busy = false; btn.disabled = false; }
}

function lexSearch(term) {
  const cid = S.libSel;
  if (cid == null || !term) return;
  const q = /^[\p{L}\p{N}]+$/u.test(term) ? term : `"${term.replace(/"/g, '')}"`;
  S.lex.ctrl?.abort();
  resetFiltersState();
  S.filters.collection_id = cid;
  S.query = q; $('#q').value = q;
  S.variants = false; $('#variants').checked = false;
  setMode('keyword');
  setView('search', { refresh: false });
  search(true);
}




// ================================================================================================ coocurrencias
// Red de coocurrencias de los términos del léxico de la biblioteca y temas detectados con Leiden
// (worker/35b_engine__coocurrencia.js). Cada tema es un candidato: se revisa en la lista y se afinan sus términos.
const COO_UNIDADES = [
  ['intervencion', 'Intervención', 'Dos términos coocurren si aparecen en la misma intervención'],
  ['fragmento', 'Fragmentos de 20 palabras', 'Cada intervención se corta en fragmentos consecutivos de 20 palabras: dos términos coocurren si aparecen en el mismo fragmento, una relación más estrecha'],
];
const COO_RESOLUCION = [[0.6, 'menos', 'Menos temas y más amplios (resolución 0,6)'], [1, 'normal', 'Resolución 1: la modularidad clásica'],
  [1.6, 'más', 'Más temas y más finos (resolución 1,6)']];
const COO_VOCAB = [100, 250, 500], COO_VECINOS = [5, 10, 20];

function cooExcl() {
  const X = S.coo, L = S.libInfo;
  if (L && X.excl.cid !== L.id) X.excl = { cid: L.id, aplicados: new Set(), marcados: new Set() };
  return X.excl;
}

function cooClave() {
  const X = S.coo, L = S.libInfo, E = cooExcl();
  return [S.info?.name || '', L.id, L.total, L.hash || L.updated, S.lex.solo ? 'discurso' : 'completo', X.unidad,
    X.vocabulario, X.vecinos, X.resolucion, X.expresiones ? 'expr' : 'pal', [...E.aplicados].sort().join(',')].join('|');
}

async function cooLoad() {
  const L = S.libInfo, X = S.coo, box = $('#hits');
  if (!L || S.view !== 'library' || S.libTab !== 'coocurrencias') return;
  const E = cooExcl();
  const key = cooClave();
  X.ctrl?.abort();
  const mine = ++X.seq;
  if (!L.total) {
    X.data = null; X.cid = L.id; listHead();
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Biblioteca vacía</h3>
      <p>Las coocurrencias parten del léxico de la biblioteca. Añada intervenciones desde <b>Explorar</b>.</p></div>`;
    return;
  }
  if (X.cache.has(key)) { X.data = X.cache.get(key); X.cid = L.id; cooRender(); return; }
  X.data = null; X.cid = null; listHead();
  const t0 = performance.now();
  box.innerHTML = `<div class="empty lex-prog" role="status" aria-live="polite">
    <p>Construyendo la red de coocurrencias de ${nf(L.total)} ${L.total === 1 ? 'intervención' : 'intervenciones'}…</p>
    <div class="bar" role="progressbar" aria-label="Progreso de las coocurrencias" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
    <p class="lex-prog-fase">Preparando…</p>
    <p class="lex-prog-t dsub">0 % · 0 s</p>
    <p style="margin-top:10px"><button class="btn sm" data-coocancel>Cancelar</button></p>
    <p class="dsub" style="margin-top:8px;font-size:11.5px">Si ya calculó el léxico de esta biblioteca con el mismo ajuste de «Solo discurso», se reutiliza.</p></div>`;
  let ultimoEv = null;
  const pinta = (ev) => {
    if (mine !== X.seq) return;
    const bar = box.querySelector('.lex-prog');
    if (!bar) return;
    if (ev) ultimoEv = ev;
    const e = ultimoEv, sg = (performance.now() - t0) / 1000;
    const pct = e ? Math.round(Math.max(0, Math.min(1, e.fraccion || 0)) * 100) : 0;
    bar.querySelector('.bar i').style.width = `${pct}%`;
    bar.querySelector('.bar').setAttribute('aria-valuenow', String(pct));
    if (e) bar.querySelector('.lex-prog-fase').textContent = `${e.indice}/${e.n_fases} · ${e.etiqueta}${e.total > 1 ? ` · ${nf(e.hecho)} de ${nf(e.total)}` : ''}`;
    const eta = e && e.fraccion > 0.08 && e.fraccion < 1 ? sg / e.fraccion - sg : null;
    bar.querySelector('.lex-prog-t').textContent = `${pct} % · ${Math.round(sg)} s${eta != null ? ` · quedan unos ${Math.max(1, Math.round(eta))} s` : ''}`;
  };
  const reloj = setInterval(() => pinta(null), 500);
  const ctrl = X.ctrl = new AbortController();
  const qs = new URLSearchParams({ solo_discurso: String(S.lex.solo), unidad: X.unidad, vocabulario: String(X.vocabulario),
    vecinos: String(X.vecinos), resolucion: String(X.resolucion), expresiones: String(X.expresiones) });
  if (E.aplicados.size) qs.set('excluir', [...E.aplicados].join(','));
  try {
    const r = await api(`/collections/${L.id}/cooccurrence?${qs}`, { signal: ctrl.signal, alProgreso: pinta });
    clearInterval(reloj);
    if (mine !== X.seq || S.view !== 'library' || S.libSel !== L.id || S.libTab !== 'coocurrencias') return;
    if (!r.error) {
      X.cache.set(key, r);
      if (X.cache.size > 8) X.cache.delete(X.cache.keys().next().value);
    }
    X.data = r; X.cid = L.id;
    cooRender();
  } catch (e) {
    clearInterval(reloj);
    if (mine !== X.seq) return;
    if (e.name === 'AbortError') {
      if (S.view === 'library' && S.libTab === 'coocurrencias' && box.querySelector('.lex-prog')) {
        box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Cálculo cancelado</h3>
          <p>Puede volver a lanzarlo cuando quiera.</p><p style="margin-top:10px"><button class="btn sm" data-cooretry>Calcular las coocurrencias</button></p></div>`;
      }
      return;
    }
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>No se pudo construir la red</h3>
      <p>${esc(e.message)}</p><p style="margin-top:10px"><button class="btn sm" data-cooretry>Reintentar</button></p></div>`;
  }
}

/** Vecinos más fuertes de cada término (para el título de su etiqueta). */
function cooVecinos(r) {
  if (r._vecinos) return r._vecinos;
  const v = r.nodos.map(() => []);
  for (const a of r.aristas || []) { v[a.a].push([a.fuerza, a.b]); v[a.b].push([a.fuerza, a.a]); }
  r._vecinos = v.map(l => l.sort((x, y) => y[0] - x[0]).slice(0, 6).map(([, i]) => r.nodos[i].display));
  return r._vecinos;
}

/** Cómo se leen las barras de partido de los temas; vacío si la biblioteca no trae partidos. */
function cooNotaPartidos(r) {
  const lib = r.partidos;
  if (!lib?.palabras || !(r.comunidades || []).some(c => c.partidos?.palabras)) return '';
  const falta = (lib.palabras_totales || 0) - lib.palabras;
  return `<p class="lex-note">En cada tema, el eje sitúa a los partidos por la frecuencia con la que usan su vocabulario:
    palabras del tema por cada mil suyas, en veces la media de la biblioteca, que es el centro del eje. Como es una tasa,
    no depende de cuánto hable el partido. Están todos los que dicen al menos el 1 % de las palabras de la biblioteca y
    de los que cabría esperar cinco palabras del tema o más —por debajo de eso ni el exceso ni la falta dicen nada—, y
    llevan nombre los que más se apartan de la media <b>en cualquiera de los dos sentidos</b>: un tema del que un partido
    no habla dice tanto como uno del que habla el doble. Los demás puntos guardan sus cifras en el título. La escala es
    logarítmica, así que la mitad y el doble quedan a la misma distancia del centro.
    ${falta > 0 ? `Cuentan las ${nf(lib.palabras)} palabras con partido; ${nf(falta)} no lo traen.` : ''}</p>`;
}

/** Peso de cada partido en el tema como frecuencia relativa: palabras del vocabulario del tema por cada mil palabras
 *  suyas, en veces la media de la biblioteca. Un punto por partido sobre un eje logarítmico centrado en la media, con
 *  todos los que se pueden comparar; el nombre va a los que más se apartan, por arriba o por abajo, porque la ausencia
 *  marcada informa tanto como el exceso. */
function cooPartidosHTML(r, c) {
  const lib = r.partidos, rep = c.partidos;
  if (!lib?.palabras || !rep?.palabras) return '';
  const tasaLib = 1000 * rep.palabras / lib.palabras;              // media de la biblioteca para este tema
  const enTema = new Map(rep.lista.map(x => [x.p, x]));
  const minPal = 0.01 * lib.palabras;                              // menos del 1 % de las palabras: la tasa no dice nada
  const conPeso = lib.lista.filter(x => x.pal >= minPal);
  const cand = conPeso.map(x => {
    const t = enTema.get(x.p), tok = t ? t.pal : 0, esperado = tasaLib * x.pal / 1000;
    // el cero no tiene logaritmo: se sitúa con media palabra, que es lo más que se puede afirmar de una ausencia
    return { p: x.p, n: t ? t.n : 0, tok, pal: x.pal, esperado, tasa: 1000 * tok / x.pal,
      veces: esperado > 0 ? (tok || 0.5) / esperado : 1 };
  }).filter(x => x.esperado >= 5);                                 // con menos no se distingue el exceso de la falta
  if (!cand.length) return '';
  const lejos = (f) => Math.abs(Math.log(f.veces));
  const orden = new Map(cand.slice().sort((a, b) => lejos(b) - lejos(a)).map((f, k) => [f.p, k]));   // a quién etiquetar antes
  const dec = (x, d = 1) => x.toFixed(d).replace('.', ',');
  const K = Math.max(2, Math.ceil(Math.max(...cand.map(f => Math.max(f.veces, 1 / f.veces)))));
  const x = (v) => `${Math.max(0, Math.min(100, 50 + 50 * Math.log(v) / Math.log(K))).toFixed(2)}%`;
  const ticks = [];
  for (let k = 2; k <= K; k++) ticks.push(`<span class="coo-eje-t" style="left:${x(k)}"></span>`, `<span class="coo-eje-t" style="left:${x(1 / k)}"></span>`);
  const puntos = cand.slice().sort((a, b) => a.veces - b.veces).map(f => {
    const ficha = `<div><b>${esc(f.p)}</b> <em>${f.tok ? `${dec(f.veces, 2)}×` : 'ninguna palabra del tema'}</em>`
      + `${f.tok ? ` la media (${dec(f.tasa)} por mil frente a ${dec(tasaLib)})` : ''} · ${nf(f.tok)} de las ${nf(rep.palabras)}`
      + ` palabras del tema, cabría esperar ${nf(Math.round(f.esperado))} · ${nf(f.n)} ${f.n === 1 ? 'intervención' : 'intervenciones'}`
      + ` · ${nf(f.pal)} palabras en la biblioteca</div>`;
    return `<span class="coo-eje-p" data-prio="${orden.get(f.p)}" style="left:${x(f.veces)}" data-tip="${esc(ficha)}">`
      + `<b class="coo-eje-n">${esc(f.p)} <em>${f.tok ? `${dec(f.veces)}×` : '0'}</em></b><i class="coo-eje-d"></i></span>`;
  }).join('');
  const fuera = conPeso.length - cand.length;
  const leyenda = cand.slice().sort((a, b) => lejos(b) - lejos(a)).slice(0, 4)
    .map(f => `${f.p} ${f.tok ? `${dec(f.veces)} veces la media` : 'ninguna palabra del tema'}`).join('; ');
  return `<div class="coo-eje" role="img" aria-label="${esc(`${cand.length} partidos por su uso del vocabulario del tema; los que más se apartan de la media: ${leyenda}`)}">
      <span class="coo-eje-linea"></span>${ticks.join('')}
      <span class="coo-eje-media" style="left:50%"><b>media</b></span>
      ${puntos}
    </div>${fuera > 0 ? `<div class="coo-pmas">fuera del eje, ${nf(fuera)} ${fuera === 1 ? 'partido' : 'partidos'} de los que cabría esperar menos de cinco palabras del tema</div>` : ''}`;
}

/** Coloca las etiquetas del eje sin que se pisen (hay que medirlas ya pintadas), empezando por los partidos que más se
 *  apartan de la media: la que choca sube a una segunda altura y, si ahí tampoco cabe, el punto se queda sin etiqueta y
 *  sus cifras siguen en su título. */
function cooEjesAjustar(box) {
  for (const eje of box.querySelectorAll('.coo-eje')) {
    const ps = [...eje.querySelectorAll('.coo-eje-p')];
    const puestos = [[], []];
    const libre = (nivel, a, b) => puestos[nivel].every(([c, d]) => b <= c || a >= d);
    let doble = false;
    for (const p of ps.slice().sort((a, b) => (+a.dataset.prio || 0) - (+b.dataset.prio || 0))) {
      p.classList.remove('alto', 'muda');
      const w = p.offsetWidth, cx = p.offsetLeft, a = cx - w / 2, b = cx + w / 2;
      const nivel = libre(0, a, b) ? 0 : (libre(1, a, b) ? 1 : -1);
      if (nivel < 0) { p.classList.add('muda'); continue; }
      if (nivel === 1) { p.classList.add('alto'); doble = true; }
      puestos[nivel].push([a, b]);
    }
    eje.classList.toggle('doble', doble);
    eje.classList.toggle('muchos', ps.length > 8);
    cooEjeFicha(eje, ps);
  }
}

/** Ficha del eje: el `title` del navegador tarda casi un segundo y solo alcanza al punto de encima cuando se solapan.
 *  Esta sigue al cursor sin espera y describe el punto más cercano y los que estén pegados a él, así que ninguno queda
 *  inalcanzable por muy juntos que caigan. */
function cooEjeFicha(eje, ps) {
  const tip = document.createElement('div');
  tip.className = 'coo-tip';
  tip.hidden = true;
  eje.append(tip);
  const puntos = ps.map(p => ({ p, x: p.offsetLeft, tip: p.dataset.tip || '' }));
  let caja = null, ultima = null;
  const esconder = () => {
    tip.hidden = true;
    ultima = null;
    for (const q of puntos) q.p.classList.remove('bajo');
  };
  const mover = (e) => {
    if (!caja) caja = eje.getBoundingClientRect();
    const px = e.clientX - caja.left;
    let cerca = Infinity;
    for (const q of puntos) cerca = Math.min(cerca, Math.abs(q.x - px));
    if (cerca > 24) { esconder(); return; }                        // lejos de todos: sin ficha
    const juntos = puntos.filter(q => Math.abs(q.x - px) <= cerca + 6);
    const clave = juntos.map(q => q.x).join(' ');
    if (clave !== ultima) {                                        // solo se rehace cuando cambia a quién describe
      ultima = clave;
      tip.innerHTML = juntos.map(q => q.tip).join('');
      for (const q of puntos) q.p.classList.toggle('bajo', juntos.includes(q));
    }
    tip.hidden = false;
    const w = tip.offsetWidth;
    tip.style.left = `${Math.round(Math.max(0, Math.min(caja.width - w, px - w / 2)))}px`;
  };
  eje.addEventListener('pointerenter', () => { caja = eje.getBoundingClientRect(); });
  eje.addEventListener('pointermove', mover);
  eje.addEventListener('pointerdown', mover);                      // en pantalla táctil, al tocar
  eje.addEventListener('pointerleave', esconder);
}

/** Una intervención jerarquizada: orador, fecha, partido, longitud, barra de puntuación y términos que la sostienen. */
function cooLectFila(r, x, k, maxP, col = null) {
  const m = (r.lectura && r.lectura.metadatos && r.lectura.metadatos[x.id]) || {};
  const quien = ident(m.rep_name) ? m.rep_name : (m.speaker || 'Sin orador');
  const pct = maxP > 0 ? Math.max(3, Math.round(100 * x.puntuacion / maxP)) : 0;
  const terms = (x.terminos || []).slice(0, 5).map(t => `${esc(t.display)}<sup>${nf(t.tf)}</sup>`).join(' ');
  return `<li class="coo-lf" data-cooopen="${x.id}" role="button" tabindex="0" title="Abrir en el lector">
    <span class="coo-lf-n">${k + 1}</span>${col ? `<i class="coo-dot" style="--c:${col}"></i>` : ''}
    <span class="coo-lf-q">${esc(quien)}</span>
    <span class="coo-lf-m">${esc(m.date ? fechaCorta(m.date) : '')}${ident(m.party) ? ` · ${esc(m.party)}` : ''} · ${nf(x.palabras)} palabras</span>
    <span class="coo-lf-b" title="Puntuación ${String(x.puntuacion).replace('.', ',')}"><i style="width:${pct}%"></i></span>
    <span class="coo-lf-t">${terms}</span></li>`;
}

function cooLecturaHTML(r) {
  const X = S.coo, lec = r.lectura || {};
  const pal = trendPal().series;
  const variada = X.lectModo === 'variada';
  const lista = (variada ? lec.variada : lec.global) || [];
  if (!lista.length) return '';
  const vistos = lista.slice(0, X.lectN);
  const maxP = Math.max(...lista.map(x => x.puntuacion));
  const modos = [['variada', 'Variada por tema', 'La mejor de cada tema, por turnos: cubre todos los temas de la biblioteca'],
                 ['global', 'Más informativas', 'Las que más vocabulario característico de la biblioteca concentran, sin mirar el tema']]
    .map(([v, l, t]) => `<button type="button" data-coolect="${v}" aria-pressed="${X.lectModo === v}" title="${esc(t)}">${l}</button>`).join('');
  return `<section class="coo-leer">
    <div class="coo-cab"><h4>Leer primero</h4><div class="tseg" role="group" aria-label="Criterio de lectura">${modos}</div></div>
    <p class="lex-note">Intervenciones de la biblioteca ordenadas por lo que concentran de su vocabulario característico
      (BM25 con cada término pesado por su G² en el léxico, con saturación por repetición y corrección por longitud).
      ${variada ? 'El punto de color indica el tema del que sale cada una.' : ''}</p>
    <ol class="coo-lista">${vistos.map((x, k) => cooLectFila(r, x, k, maxP, variada ? pal[x.tema % pal.length] : null)).join('')}</ol>
    ${lista.length > vistos.length ? `<p class="lex-more"><button class="btn sm" data-coomas>Mostrar ${nf(Math.min(lista.length - vistos.length, 20))} más de ${nf(lista.length)}</button></p>` : ''}
  </section>`;
}

function cooRender() {
  const r = S.coo.data, L = S.libInfo, box = $('#hits'), sc = listScroller();
  if (!r || !L || S.view !== 'library' || S.libTab !== 'coocurrencias') return;
  listHead();
  const top = sc.scrollTop;
  if (r.error) {
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>No se pudo construir la red</h3><p>${esc(r.message || r.error)}</p>
      <p style="margin-top:10px"><button class="btn sm" data-cooretry>Reintentar</button></p></div>`;
    return;
  }
  const X = S.coo, E = cooExcl(), p = r.parametros || {}, st = r.estadisticas || {}, voc = r.vocabulario || {};
  const seg = (attr, cur, opts) => opts.map(([v, lab, tit]) =>
    `<button type="button" data-${attr}="${esc(String(v))}" aria-pressed="${String(v) === String(cur)}"${tit ? ` title="${esc(tit)}"` : ''}>${esc(lab)}</button>`).join('');
  const sel = (attr, cur, opts, fmt = x => nf(x)) => `<select data-coo="${attr}">${opts.map(v =>
    `<option value="${v}"${Number(v) === Number(cur) ? ' selected' : ''}>${fmt(v)}</option>`).join('')}</select>`;
  const controles = `<div class="coo-ctl">
      <div class="tseg" role="group" aria-label="Unidad de contexto">${seg('coounidad', X.unidad, COO_UNIDADES)}</div>
      <label class="tsel" title="Cuántos términos del léxico, de más a menos característicos, entran en la red">Términos ${sel('vocabulario', X.vocabulario, COO_VOCAB)}</label>
      <label class="tsel" title="Conexiones que conserva cada término: las de mayor G² entre las significativas">Vecinos ${sel('vecinos', X.vecinos, COO_VECINOS)}</label>
      <span class="tsel">Temas</span><div class="tseg" role="group" aria-label="Número de temas">${seg('cooresol', X.resolucion, COO_RESOLUCION)}</div>
      <label class="chk tchk" title="Une las expresiones de varias palabras detectadas en el corpus («seguridad pública», «régimen de excepción») en un solo nodo: sus palabras dejan de contar sueltas"><input type="checkbox" data-cooexpr${X.expresiones ? ' checked' : ''}><span>expresiones</span></label>
    </div>`;
  if (r.aviso || !(r.comunidades || []).length) {
    box.innerHTML = `<div class="lex coo">${controles}<div class="empty" style="padding:26px 16px"><h3>Sin red de coocurrencias</h3>
      <p>${esc(r.aviso || 'Ninguna pareja de términos alcanza la significación exigida en esta biblioteca.')}</p></div></div>`;
    return;
  }
  const metric = (k, v, extra = '', tit = '') => `<div class="lex-metric"${tit ? ` title="${esc(tit)}"` : ''}>`
    + `<div class="k">${k}</div><div class="v">${v}</div>${extra ? `<div class="s">${extra}</div>` : ''}</div>`;
  const unidades = p.unidad === 'fragmento' ? `${nf(st.n_unidades)} fragmentos` : `${nf(st.n_unidades)} intervenciones`;
  const metricas = `<div class="lex-metrics">
      ${metric('Temas', nf(st.n_comunidades), 'comunidades de Leiden')}
      ${metric('Términos', nf(voc.usados), `de ${nf(voc.disponibles)} del léxico`, 'Términos de sobreuso del léxico, de más a menos característicos, sin palabras vacías ni cifras')}
      ${metric('Conexiones', nf(st.aristas_conservadas), `de ${nf(st.aristas_significativas)} significativas`, `Pares con asociación positiva y G² ≥ ${String(p.g2_min).replace('.', ',')} (p < 0,001); se conservan los ${nf(p.vecinos)} vecinos de mayor G² de cada término`)}
      ${metric('Modularidad', String(st.modularidad).replace('.', ','), unidades, 'Modularidad de la partición final (resolución 1). Por encima de 0,3 suele indicar una estructura de comunidades clara')}
    </div>`;
  const vac = p.vacias || {};
  const descart = [voc.descartados?.vacias ? `${nf(voc.descartados.vacias)} palabras vacías (${esc(vac.fuente || '')}, ${vac.lengua === 'pt' ? 'portugués' : 'español'})` : '',
    voc.descartados?.cifras ? `${nf(voc.descartados.cifras)} cifras` : '',
    voc.descartados?.excluidos ? `${nf(voc.descartados.excluidos)} términos excluidos por usted` : ''].filter(Boolean).join(', ');
  const nota = `<p class="lex-note">Cada tema es una comunidad de la red: los términos más característicos del léxico, unidos cuando
      aparecen juntos en ${p.unidad === 'fragmento' ? `el mismo fragmento de ${nf(p.fragmento)} palabras` : 'la misma intervención'} más de lo esperable por azar,
      y agrupados con el algoritmo de Leiden, que garantiza que cada tema esté conectado. Son <b>candidatos</b>: revíselos en la lista y
      pulse los términos que no pertenezcan para excluirlos.${p.expresiones?.unidas ? ` Las <b>expresiones</b> de varias palabras detectadas en el corpus
      (${nf(p.expresiones.inventario)}, <button type="button" class="linkbtn" data-exprrev>revisarlas</button>) cuentan como una sola unidad: «seguridad pública» es un nodo propio y sus palabras sueltas solo cuentan fuera de ella.` : ''}
      Al excluir términos la red cambia y dos temas pueden fundirse o uno partirse:
      si ve fundidos dos temas distintos, pida <b>más</b> temas; si ve uno partido, <b>menos</b>.${descart ? ` Se descartaron ${descart}.` : ''}${voc.desde_cache ? ' El léxico se reutilizó del cálculo anterior.' : ''}</p>`;
  const metodo = `<details class="lex-neg coo-metodo"><summary>Método y parámetros</summary><div class="lex-note" style="margin:8px 2px 0">
      <b>Vocabulario:</b> los ${nf(voc.usados)} términos de sobreuso del léxico de mayor G², sin las palabras vacías publicadas de la lengua del corpus
      (${esc(vac.fuente || '—')}, ${nf(vac.n || 0)} palabras, licencia ${esc(vac.licencia || '—')}${(vac.excepciones || []).length ? `; se conservan ${vac.excepciones.map(w => `«${esc(w)}»`).join(' y ')}` : ''}) ni cifras, con dígitos o con letras («treinta», «mil»). Texto: ${p.modo_texto === 'completo' ? 'completo' : 'solo discurso'}.<br>
      <b>Expresiones:</b> ${p.expresiones?.unidas ? `${nf(p.expresiones.inventario)} detectadas en todo el corpus al cargarlo (de 2 a 7 palabras, frecuentes, con asociación significativa, sin cruzar la puntuación ni las cifras y sin los trozos de secuencias más largas, como las fórmulas leídas una y otra vez); cada frase se parte en el menor número de unidades y cada expresión cuenta como una` : 'no se unen: cada palabra cuenta por separado'}.<br>
      <b>Unidad de contexto:</b> ${p.unidad === 'fragmento' ? `fragmentos consecutivos de ${nf(p.fragmento)} palabras` : 'la intervención'} (${unidades}).
      Densidad de la red antes de podar: ${String(Math.round(1000 * st.densidad) / 10).replace('.', ',')} % de los pares posibles.<br>
      <b>Asociación:</b> G² de Dunning con signo sobre la tabla 2×2 de unidades; se conservan los pares con asociación positiva y G² ≥ ${String(p.g2_min).replace('.', ',')}
      que están entre los ${nf(p.vecinos)} vecinos de mayor G² de alguno de sus términos. Peso de cada conexión: fuerza de asociación, observado/esperado (van Eck y Waltman, 2009).<br>
      <b>Comunidades:</b> Leiden (Traag, Waltman y van Eck, 2019), modularidad con resolución ${String(p.resolucion).replace('.', ',')}, semilla ${nf(p.semilla)},
      refinado voraz. Mismos parámetros, mismo resultado.<br>
      <b>Orden de los temas:</b> por el G² medio de sus términos en el léxico, es decir, de más a menos característico de la biblioteca.
      ${p.modo_texto === 'completo' ? '' : '<br><b>Revisión en la lista:</b> busca en el texto completo de las intervenciones, así que puede encontrar algunas más que la cobertura del tema, que se calcula solo sobre el discurso de los oradores.'}</div></details>`;
  const pal = trendPal().series;
  const vecinos = cooVecinos(r);
  const marcadosN = E.marcados.size;
  const barraExcl = marcadosN || E.aplicados.size
    ? `<div class="coo-excl" role="status">${marcadosN ? `<b>${nf(marcadosN)} ${marcadosN === 1 ? 'término marcado' : 'términos marcados'}</b> para excluir.
        <button class="btn sm primary" data-cooaplicar>Recalcular sin ${marcadosN === 1 ? 'él' : 'ellos'}</button>
        <button class="btn sm ghost" data-coodesmarcar>Desmarcar</button>` : ''}
        ${E.aplicados.size ? `<span class="dsub">${nf(E.aplicados.size)} ${E.aplicados.size === 1 ? 'término excluido' : 'términos excluidos'} en este cálculo.</span>
        <button class="btn sm ghost" data-cooreponer>Reponerlos</button>` : ''}</div>` : '';
  const temas = r.comunidades.map((c, k) => {
    const col = pal[k % pal.length];
    const chips = c.terminos.map((t, q) => {
      const peso = q < Math.ceil(c.terminos.length / 3) ? ' w1' : q < Math.ceil(2 * c.terminos.length / 3) ? ' w2' : ' w3';
      const marc = E.marcados.has(t.term) ? ' marcado' : '';
      const tit = `Clic: marcar para excluir. Vecinos más fuertes: ${(vecinos[t.i] || []).join(', ')}`;
      return `<button type="button" class="coo-t${peso}${marc}" data-cooterm="${esc(t.term)}" title="${esc(tit)}" aria-pressed="${!!marc}">${esc(t.display)}</button>`;
    }).join('');
    const lec = c.lectura || [];
    const maxP = lec.length ? lec[0].puntuacion : 0;
    const leer = lec.length ? `<details class="coo-tl"><summary>Leer primero: ${lec.slice(0, 2).map(x => {
        const m = (r.lectura?.metadatos || {})[x.id] || {};
        return esc(ident(m.rep_name) ? m.rep_name : (m.speaker || 'Sin orador'));
      }).join(' · ')}${lec.length > 2 ? ` y ${nf(lec.length - 2)} más` : ''}</summary>
      <ol class="coo-lista">${lec.map((x, q) => cooLectFila(r, x, q, maxP)).join('')}</ol></details>` : '';
    return `<section class="coo-tema" style="--c:${col}">
      <div class="coo-cab"><span class="coo-n">${k + 1}</span><h4>${esc(c.etiqueta)}</h4>
        <span class="coo-st">${nf(c.n_terminos)} términos · ${nf(c.intervenciones)} intervenciones (${String(c.porcentaje).replace('.', ',')} %) · G² medio ${nf(Math.round(c.g2_medio))}</span></div>
      <div class="coo-terms">${chips}</div>
      ${cooPartidosHTML(r, c)}
      <div class="coo-acc"><button type="button" class="btn sm" data-coobuscar="${k}" title="Busca en la biblioteca las intervenciones con cualquiera de sus términos, resaltados, para revisar el tema">Revisar en la lista</button>
        <button type="button" class="btn sm ghost" data-coomarcartema="${k}" title="Marca todos los términos del tema para excluirlos">Marcar el tema</button>
        </div>${leer}
    </section>`;
  }).join('');
  const sueltos = (r.sueltos || []).length
    ? `<details class="lex-neg coo-sueltos"><summary>Términos poco conectados (${nf(r.sueltos.length)}): forman comunidades de uno o dos términos, que no se tratan como temas</summary>
        <div class="coo-terms" style="--c:var(--text-faint);margin-top:8px">${r.sueltos.map(t => `<button type="button" class="coo-t w3${E.marcados.has(t.term) ? ' marcado' : ''}" data-cooterm="${esc(t.term)}" title="Clic: marcar para excluir">${esc(t.display)}</button>`).join('')}</div></details>` : '';
  box.innerHTML = `<div class="lex coo">
    ${controles}${metricas}${nota}${barraExcl}
    ${cooLecturaHTML(r)}
    <h4 class="coo-h">Temas</h4>
    ${cooNotaPartidos(r)}
    <div class="coo-temas">${temas}</div>
    ${sueltos}
    ${metodo}
    <p class="coo-exp"><button class="btn sm" data-cooexp="csv" title="Una fila por término, con su tema y sus medidas">Exportar temas (CSV)</button>
      <button class="btn sm" data-cooexp="gexf" title="La red podada, con los temas como atributo, para abrirla en Gephi">Exportar red (GEXF)</button>
      <button class="btn sm" data-cooexp="lectura" title="Las intervenciones jerarquizadas, global, variada y por tema, con su puntuación y los términos que la sostienen">Exportar jerarquía de lectura (CSV)</button>
      ${r.partidos?.con_partido ? '<button class="btn sm" data-cooexp="partidos" title="Una fila por tema y partido, con sus intervenciones, su parte del tema, su peso en la biblioteca y cuánto lo pasa">Exportar partidos por tema (CSV)</button>' : ''}</p>
    ${fuentePieHTML('panel-fuente')}
  </div>`;
  cooEjesAjustar(box);
  sc.scrollTop = top;
}

function cooKey(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest?.('[data-cooopen]');
  if (!row || S.view !== 'library' || S.libTab !== 'coocurrencias') return;
  e.preventDefault(); e.stopPropagation();
  openSpeech(+row.dataset.cooopen, { mode: 'speech' });
}

function cooChange(e) {
  const t = e.target;
  if (S.view !== 'library' || S.libTab !== 'coocurrencias') return;
  if (t.matches?.('[data-cooexpr]')) { S.coo.expresiones = t.checked; cooLoad(); return; }
  if (!t.matches?.('[data-coo]')) return;
  S.coo[t.dataset.coo] = Number(t.value);
  cooLoad();
}

function cooBuscar(k) {
  const r = S.coo.data, cid = S.libSel;
  const c = r && r.comunidades && r.comunidades[k];
  if (!c || cid == null) return;
  const E = cooExcl();
  const q = c.terminos.filter(t => !E.marcados.has(t.term))
    .map(t => (/^[\p{L}\p{N}]+$/u.test(t.display) ? t.display : `"${t.display.replace(/"/g, '')}"`)).join(' | ');
  if (!q) return toast('Todos los términos del tema están marcados para excluir.', true);
  S.coo.ctrl?.abort();
  resetFiltersState();
  S.filters.collection_id = cid;
  S.query = q; $('#q').value = q;
  S.variants = false; $('#variants').checked = false;
  setMode('keyword');
  setView('search', { refresh: false });
  search(true);
}

function cooClick(e) {
  if (S.view !== 'library' || S.libTab !== 'coocurrencias') return false;
  const X = S.coo, E = cooExcl();
  const b = (sel) => e.target.closest(sel);
  let el;
  if (b('[data-exprrev]')) { exprAbrir(); return true; }
  if ((el = b('[data-cooterm]'))) {
    const w = el.dataset.cooterm;
    if (E.marcados.has(w)) E.marcados.delete(w); else E.marcados.add(w);
    cooRender(); return true;
  }
  if ((el = b('[data-coomarcartema]'))) {
    const c = X.data?.comunidades?.[+el.dataset.coomarcartema];
    if (c) { const todos = c.terminos.every(t => E.marcados.has(t.term)); for (const t of c.terminos) todos ? E.marcados.delete(t.term) : E.marcados.add(t.term); }
    cooRender(); return true;
  }
  if (b('[data-cooaplicar]')) { for (const w of E.marcados) E.aplicados.add(w); E.marcados.clear(); cooLoad(); return true; }
  if (b('[data-coodesmarcar]')) { E.marcados.clear(); cooRender(); return true; }
  if (b('[data-cooreponer]')) { E.aplicados.clear(); E.marcados.clear(); cooLoad(); return true; }
  if ((el = b('[data-coounidad]'))) { if (X.unidad !== el.dataset.coounidad) { X.unidad = el.dataset.coounidad; cooLoad(); } return true; }
  if ((el = b('[data-cooresol]'))) { const v = Number(el.dataset.cooresol); if (X.resolucion !== v) { X.resolucion = v; cooLoad(); } return true; }
  if ((el = b('[data-coobuscar]'))) { cooBuscar(+el.dataset.coobuscar); return true; }
  if ((el = b('[data-cooopen]'))) { openSpeech(+el.dataset.cooopen, { mode: 'speech' }); return true; }
  if ((el = b('[data-cooexp]'))) {
    const tipo = el.dataset.cooexp;
    if (tipo === 'gexf') cooExportGEXF();
    else if (tipo === 'lectura') cooExportLectura();
    else if (tipo === 'partidos') cooExportPartidos();
    else cooExportCSV();
    return true;
  }
  if ((el = b('[data-coolect]'))) { X.lectModo = el.dataset.coolect; X.lectN = 10; cooRender(); return true; }
  if (b('[data-coomas]')) { X.lectN += 20; cooRender(); return true; }
  if (b('[data-cooretry]')) { cooLoad(); return true; }
  if (b('[data-coocancel]')) { X.ctrl?.abort(); return true; }
  return false;
}

function cooMeta(r) {
  const p = r.parametros || {}, st = r.estadisticas || {}, L = S.libInfo, vac = p.vacias || {};
  return [
    'Explorador de Diarios de Sesiones · red de coocurrencias y temas de una biblioteca',
    `biblioteca: ${L?.name || ''} (${nf(st.n_intervenciones)} intervenciones)`,
    `corpus: ${S.info?.title || S.info?.name || ''}`,
    `generado: ${new Date().toISOString().slice(0, 19)}`,
    `texto: ${p.modo_texto === 'completo' ? 'completo' : 'solo discurso'} · unidad: ${p.unidad === 'fragmento' ? `fragmentos de ${p.fragmento} palabras` : 'intervención'} (${st.n_unidades} unidades)`,
    `vocabulario: ${r.vocabulario?.usados} términos de sobreuso del léxico · palabras vacías: ${vac.fuente || '—'} (${vac.lengua || '—'}, ${vac.n || 0}, licencia ${vac.licencia || '—'})`
      + (r.vocabulario?.descartados?.excluidos ? ` · excluidos a mano: ${[...cooExcl().aplicados].sort().join(', ')}` : ''),
    `asociación: G² de Dunning con signo, umbral ${p.g2_min}, ${p.vecinos} vecinos por término · peso: fuerza de asociación (observado/esperado)`,
    `comunidades: Leiden, modularidad con resolución ${p.resolucion}, semilla ${p.semilla}, refinado voraz · modularidad ${st.modularidad} · ${st.n_comunidades} temas`,
  ];
}

function cooSlug() {
  return foldMap(S.libInfo?.name || '').folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'biblioteca';
}

function cooExportCSV() {
  const r = S.coo.data;
  if (!r || r.error || !(r.comunidades || []).length) return toast('Aún no hay temas que exportar.', true);
  const nodos = r.nodos || [];
  const cols = ['tema', 'etiqueta_tema', 'tema_intervenciones', 'tema_porcentaje', 'termino', 'termino_indice', 'fuerza_interna',
                'fuerza_total', 'grado', 'g2_lexico', 'frecuencia', 'intervenciones_con_termino'];
  const filas = [];
  r.comunidades.forEach((c, k) => {
    for (const t of c.terminos) {
      const n = nodos[t.i] || {};
      filas.push([k + 1, c.etiqueta, c.intervenciones, c.porcentaje, t.display, t.term, t.fuerza_interna, n.fuerza, n.grado,
                  n.g2_lexico, n.freq, n.df_intervencion]);
    }
  });
  downloadText(csvConFuente(cooMeta(r), cols, filas), `temas_${cooSlug()}.csv`, 'text/csv;charset=utf-8');
}

/** Una fila por tema y partido, también los que no dicen ninguna palabra del tema: sus palabras, su tasa por mil
 *  palabras propias, las que cabría esperar y cuánto pasa (o no llega a) la media. */
function cooExportPartidos() {
  const r = S.coo.data;
  if (!r || r.error || !r.partidos?.palabras) return toast('Esta biblioteca no trae partidos que exportar.', true);
  const lib = r.partidos;
  const cols = ['tema', 'etiqueta_tema', 'tema_intervenciones', 'tema_palabras', 'partido', 'intervenciones',
                'palabras_del_tema', 'palabras_del_partido', 'esperadas', 'tasa_por_mil', 'tasa_biblioteca_por_mil',
                'veces_la_media', 'parte_de_las_palabras_del_tema'];
  const dec = (x, d) => (Number.isFinite(x) ? x.toFixed(d) : '');
  const filas = [];
  for (const [k, c] of (r.comunidades || []).entries()) {
    const rep = c.partidos;
    if (!rep?.palabras) continue;
    const tasaLib = 1000 * rep.palabras / lib.palabras;
    const enTema = new Map(rep.lista.map(x => [x.p, x]));
    const fila = (p, pal, tok, n) => {
      const esperado = tasaLib * pal / 1000, tasa = pal > 0 ? 1000 * tok / pal : null;
      filas.push([k + 1, c.etiqueta, c.intervenciones, rep.palabras, p, n, tok, pal, dec(esperado, 1),
        tasa == null ? '' : dec(tasa, 4), dec(tasaLib, 4), tasa == null ? '' : dec(tasa / tasaLib, 3),
        dec(100 * tok / rep.palabras, 2)]);
    };
    for (const x of rep.lista) fila(x.p, lib.lista.find(y => y.p === x.p)?.pal ?? 0, x.pal, x.n);
    for (const y of lib.lista) if (!enTema.has(y.p)) fila(y.p, y.pal, 0, 0);       // ninguna palabra del tema
    if (rep.otros) {
      filas.push([k + 1, c.etiqueta, c.intervenciones, rep.palabras, `(otros ${rep.otros.partidos} partidos)`,
        rep.otros.n, rep.otros.pal, '', '', '', dec(tasaLib, 4), '', dec(100 * rep.otros.pal / rep.palabras, 2)]);
    }
  }
  if (!filas.length) return toast('Ningún tema tiene palabras con partido.', true);
  const meta = cooMeta(r).concat([
    `partidos: ${nf(lib.con_partido)} de ${nf(lib.intervenciones)} intervenciones y ${nf(lib.palabras)} de ${nf(lib.palabras_totales)}`
      + ' palabras traen partido (el canónico de la ingesta)',
    'palabras_del_tema = veces que el partido usa el vocabulario del tema; palabras_del_partido = todas las suyas en la biblioteca;'
      + ' hay fila también para los partidos que no dicen ninguna palabra del tema',
    'tasa_por_mil = 1000 × palabras_del_tema / palabras_del_partido, una frecuencia relativa que no depende de cuánto hable'
      + ' el partido; tasa_biblioteca_por_mil es la misma tasa para el conjunto de la biblioteca y veces_la_media, su cociente',
    'esperadas = tasa_biblioteca_por_mil × palabras_del_partido / 1000: con menos de cinco esperadas, el exceso o la falta no dicen nada',
    'una intervención cuenta en todos los temas que toca, así que las filas no suman las intervenciones de la biblioteca',
  ]);
  downloadText(csvConFuente(meta, cols, filas), `partidos_por_tema_${cooSlug()}.csv`, 'text/csv;charset=utf-8');
}

function cooExportLectura() {
  const r = S.coo.data;
  if (!r || r.error || !r.lectura) return toast('Aún no hay jerarquía de lectura que exportar.', true);
  const M = r.lectura.metadatos || {};
  const cols = ['lista', 'posicion', 'tema', 'etiqueta_tema', 'id', 'fecha', 'orador', 'partido', 'palabras', 'puntuacion', 'terminos'];
  const filas = [];
  const fila = (lista, k, x, tema) => {
    const m = M[x.id] || {};
    filas.push([lista, k + 1, tema == null ? '' : tema + 1, tema == null ? '' : r.comunidades[tema].etiqueta, x.id, m.date || '',
      ident(m.rep_name) ? m.rep_name : (m.speaker || ''), ident(m.party) ? m.party : '', x.palabras, x.puntuacion,
      (x.terminos || []).map(t => `${t.display}×${t.tf}`).join(' ')]);
  };
  r.lectura.variada.forEach((x, k) => fila('variada', k, x, x.tema));
  r.lectura.global.forEach((x, k) => fila('global', k, x, null));
  r.comunidades.forEach((c, t) => (c.lectura || []).forEach((x, k) => fila('tema', k, x, t)));
  const met = r.lectura.metodo || {};
  const meta = cooMeta(r).concat([`jerarquía: ${met.formula} (k1 ${met.k1}, b ${met.b}), peso de cada término ${met.peso_termino}; `
    + 'variada = la mejor de cada tema por turnos; global = sin mirar el tema; tema = solo los términos del tema']);
  downloadText(csvConFuente(meta, cols, filas), `lectura_${cooSlug()}.csv`, 'text/csv;charset=utf-8');
}

function cooExportGEXF() {
  const r = S.coo.data;
  if (!r || r.error || !(r.nodos || []).length) return toast('Aún no hay red que exportar.', true);
  const x = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const etiqueta = new Map(r.comunidades.map((c, k) => [k, c.etiqueta]));
  const F = fuenteDe();
  const desc = cooMeta(r).concat([`Fuente: ${F.cita || F.cita_corta || ''}${F.url ? ` · ${F.url}` : ''}`]).join('\n');
  const nodos = r.nodos.map(n => `      <node id="${n.i}" label="${x(n.display)}"><attvalues>`
    + `<attvalue for="0" value="${n.comunidad + 1}"/><attvalue for="1" value="${x(n.comunidad >= 0 ? etiqueta.get(n.comunidad) : 'sin tema')}"/>`
    + `<attvalue for="2" value="${n.g2_lexico}"/><attvalue for="3" value="${n.freq}"/><attvalue for="4" value="${n.df_intervencion}"/>`
    + `<attvalue for="5" value="${n.fuerza}"/></attvalues></node>`).join('\n');
  const aristas = (r.aristas || []).map((a, k) => `      <edge id="${k}" source="${a.a}" target="${a.b}" weight="${a.fuerza}"><attvalues>`
    + `<attvalue for="0" value="${a.co}"/><attvalue for="1" value="${a.esperado}"/><attvalue for="2" value="${a.g2}"/></attvalues></edge>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://gexf.net/1.3" version="1.3">
  <meta lastmodifieddate="${new Date().toISOString().slice(0, 10)}">
    <creator>ParlaIbero · Explorador de Diarios de Sesiones</creator>
    <description>${x(desc)}</description>
  </meta>
  <graph defaultedgetype="undirected" mode="static">
    <attributes class="node">
      <attribute id="0" title="tema" type="integer"/>
      <attribute id="1" title="etiqueta_tema" type="string"/>
      <attribute id="2" title="g2_lexico" type="double"/>
      <attribute id="3" title="frecuencia" type="integer"/>
      <attribute id="4" title="intervenciones" type="integer"/>
      <attribute id="5" title="fuerza" type="double"/>
    </attributes>
    <attributes class="edge">
      <attribute id="0" title="coocurrencias" type="integer"/>
      <attribute id="1" title="esperado" type="double"/>
      <attribute id="2" title="g2" type="double"/>
    </attributes>
    <nodes>
${nodos}
    </nodes>
    <edges>
${aristas}
    </edges>
  </graph>
</gexf>
`;
  downloadText(xml, `red_${cooSlug()}.gexf`, 'application/xml;charset=utf-8');
}

function lexExportCSV() {
  const r = S.lex.data, L = S.libInfo;
  if (!r || r.error || !L || S.lex.cid !== L.id) return toast('Aún no hay tabla de léxico.', true);
  const m = r.metrics || {};
  const num = v => (v == null || !isFinite(v) ? '' : String(+v));
  const tx = r.texto || null, discurso = (r.modo_texto === 'discurso' || r.modo_texto === 'discurso_rapido') && !!tx;
  const meta = [
    'Explorador de Diarios de Sesiones · léxico (keyness) de una biblioteca',
    `biblioteca: ${L.name} (${r.n_texts} intervenciones)`,
    `corpus: ${S.info?.title || S.info?.name || ''}`,
    `generado: ${new Date().toISOString().slice(0, 19)}`,
    discurso
      ? `texto analizado: solo discurso de los oradores${r.modo_texto === 'discurso_rapido' ? ', segmentación rápida' : ''} (${tx.tokens_analizados} de ${tx.tokens_brutos} tokens; `
        + `excluidos ${tx.tokens_excluidos}: ${lexDesglose(tx, String) || 'ninguno'})`
      : 'texto analizado: intervenciones completas (con listas de votación, crónica del acta, acotaciones y tablas)',
    `palabras (tokens del índice): ${m.tokens}; términos distintos: ${m.types}; TTR: ${m.ttr}`,
    `referencia: resto del corpus, corpus − texto analizado (${r.reference_tokens} tokens)`,
    `prueba: G² de Dunning con signo; umbral ${r.threshold} (p < ${r.p}); frecuencia mínima ${r.min_freq}; sin palabras vacías`,
    `significativos: ${r.significant} de ${r.candidates} candidatos (${r.n_positive} sobreuso, ${r.n_negative} infrauso)${
      r.n_positive > (r.terms || []).length || r.n_negative > (r.negative || []).length ? '; tabla recortada a los de mayor |G²|' : ''}`,
    'por_mil = apariciones / tokens × 1000; log_ratio = log2 del cociente de frecuencias relativas (una frecuencia cero cuenta como 0,5)',
    'separador ; · decimales con punto · UTF-8',
  ];

  const cols = ['termino', 'uso', 'frecuencia', 'frecuencia_resto', 'por_mil_biblioteca', 'por_mil_resto',
                'g2', 'log_ratio', 'distintividad', 'termino_indice'];
  const fila = (t, uso) => [t.display || t.term, uso, t.freq, t.freq_ref, num(t.pm), num(t.pm_ref), num(t.g2),
                            num(t.log_ratio), t.badge || '', t.term];
  const filas = [...(r.terms || []).map(t => fila(t, 'sobreuso')), ...(r.negative || []).map(t => fila(t, 'infrauso'))];
  const slug = foldMap(L.name).folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'biblioteca';

  const texto = csvConFuente(meta, cols, filas);
  downloadText(texto, `lexico_${slug}_${discurso ? 'discurso' : 'completo'}.csv`, 'text/csv;charset=utf-8');
}




function statsKey() { return JSON.stringify([S.query, S.mode, S.variants, S.filters  ]); }

function getStats() {
  const key = statsKey();
  if (S.statsCache?.key === key) return S.statsCache.p;

  const p = api('/stats', { method: 'POST',
    body: { query: S.query, mode: S.mode, variants: S.variants, filters: S.filters   } });
  S.statsCache = { key, p };
  p.catch(() => { if (S.statsCache?.p === p) S.statsCache = null; });
  return p;
}


function distHTML(r) {
  if (r.error) return `<div class="empty" style="padding:14px"><p>${esc(r.error)}</p></div>`;
  const years = (r.years || []).filter(y => y.year);
  const max = Math.max(1, ...years.map(y => y.n));


  const rotulo = r.modo === 'semantic'
    ? `Distribución de las ${nf(r.n || 0)} más parecidas, por año`
    : `Resultados por año${r.n ? ` · ${nf(r.n)} intervenciones` : ''}${
        '' }`;
  return `
    <div style="background:var(--bg-sunken);border-radius:6px">
      <div style="padding:9px 13px 0;font-size:11px;color:var(--text-faint);font-weight:600;
           text-transform:uppercase;letter-spacing:.05em">${esc(rotulo)}</div>
      <div class="chart">${years.map(y =>
        `<span class="b" style="height:${Math.max(2, y.n / max * 100)}%"
          title="${esc(y.year)}: ${nf(y.n)}"></span>`).join('')}</div>
      <div class="chart-x"><span>${esc(years[0]?.year ?? '')}</span><span>${esc(years.at(-1)?.year ?? '')}</span></div>
      <div style="padding:0 13px 11px;display:flex;flex-wrap:wrap;gap:5px">
        ${(r.sexes || []).map(f =>
          `<span class="tag fam" title="Sexo">${esc(S.facets?.labels?.sex?.[f.value] || f.value)} ${nf(f.n)}</span>`).join('')}
        ${(r.session_types || []).slice(0, 6).map(f =>
          `<span class="tag" title="Tipo de sesión">${esc(f.value)} ${nf(f.n)}</span>`).join('')}
        ${(r.parties || []).slice(0, 8).map(f =>
          `<span class="tag" title="Partido">${esc(f.value)} ${nf(f.n)}</span>`).join('')}
      </div>
      <div style="padding:0 13px 12px;display:flex;flex-wrap:wrap;gap:5px">
        ${(r.speakers || []).slice(0, 10).map(s =>
          `<span class="tag" style="cursor:pointer" data-spk="${esc(s.rep_id)}"
            title="Filtrar por este diputado">${esc(s.value)} ${nf(s.n)}</span>`).join('')}
      </div>
    </div>`;
}

async function distLoad() {
  const box = $('#trendDist');
  if (!box) return;
  const key = statsKey();
  box.innerHTML = `<div class="empty" style="padding:16px"><span class="spin"></span></div>`;
  try {
    const r = await getStats();
    if (key !== statsKey() || !box.isConnected) return;
    box.innerHTML = distHTML(r);
  } catch (e) {
    if (box.isConnected) box.innerHTML = `<div class="empty" style="padding:14px"><p>${esc(e.message)}</p></div>`;
  }
}





const CLIMA_CLASE = {
  Aplausos: 'applause', 'Aprobación': 'applause',
  Rumores: 'conflict', Protestas: 'conflict', Interrupciones: 'conflict', Voces: 'conflict',
  Presidencia: 'order',
};
const CLIMA_PRIO = { conflict: 0, applause: 1, order: 2, neutral: 3 };

function climaHTML(cl, units = null) {



  let items;
  if (Array.isArray(units)) {
    items = units.filter(u => +u.n > 0).map(u => ({ lab: u.lab, n: +u.n, c: ACOT_CLASES.has(u.c) ? u.c : 'neutral' }));
  } else {
    if (!cl || !cl.labels) return '';
    items = Object.entries(cl.labels)
      .filter(([, n]) => +n > 0)
      .map(([lab, n]) => ({ lab, n: +n, c: CLIMA_CLASE[lab] || 'neutral' }));
  }
  items.sort((a, b) => (a.c === 'neutral') - (b.c === 'neutral') || b.n - a.n || CLIMA_PRIO[a.c] - CLIMA_PRIO[b.c]);
  return items.slice(0, 2).map(x =>
    `<span class="tag clima ${x.c}" title="recuento en la intervención completa">${esc(x.lab)} ×${nf(x.n)}</span>`).join('');
}




const IDEO_CLAVES = new Set(['EI', 'I', 'CI', 'C', 'CD', 'D', 'ED']);
let specSeq = 0;



function ideoTag() { return ''; }

function sexoTag(v) {
  if (!ident(v)) return '';
  const nombre = S.facets?.labels?.sex?.[v] || v;
  return `<span class="tag" title="Sexo">${esc(nombre)}</span>`;
}

async function loadSpectrum() {
  const box = $('#spectrum');
  if (!box) return;
  box.hidden = true; // este corpus no trae ideología: no hay espectro
  if (box) return;
  if (S.view !== 'search' || S.similarOf || !S.total || !S.facets) { box.hidden = true; return; }
  const mine = ++specSeq, key = statsKey();
  box.classList.add('stale');
  let r;
  try { r = await getStats(); } catch { if (mine === specSeq) box.hidden = true; return; }
  if (mine !== specSeq || key !== statsKey()) return;
  box.classList.remove('stale');
  const ideos = (r.ideologies || []).filter(x => +x.n > 0);
  const n = +r.n || ideos.reduce((s, x) => s + x.n, 0);
  if (r.error || !ideos.length || !n || S.view !== 'search' || S.similarOf) { box.hidden = true; return; }
  const L = S.facets.labels?.ideology || {};
  const activas = new Set(S.filters.ideologies || []);
  const pct = x => { const p = x.n / n * 100; return p > 0 && p < 1 ? '<1 %' : `${Math.round(p)} %`; };
  const cls = v => `i-${IDEO_CLAVES.has(v) ? v : 'x'}`;
  const tit = x => `${L[x.value] || x.value}: ${nf(x.n)} de ${nf(n)} (${pct(x)}) · clic para ${
    activas.size === 1 && activas.has(x.value) ? 'quitar el filtro' : 'filtrar por esta ideología'}`;
  const sobre = r.modo === 'semantic' ? `las ${nf(n)} más parecidas`
    : `los ${nf(n)} resultados${  '' }`;
  box.classList.toggle('has-on', ideos.some(x => activas.has(x.value)));
  box.innerHTML = `<div class="spec-title">Espectro ideológico de ${sobre}</div>
    <div class="spec-bar" role="group" aria-label="Espectro ideológico: clic en un tramo para filtrar">${ideos.map(x =>
      `<button type="button" class="spec-seg ${cls(x.value)}${activas.has(x.value) ? ' on' : ''}" style="flex:${+x.n} 1 0"
        data-ideo="${esc(x.value)}" title="${esc(tit(x))}" aria-label="${esc(tit(x))}"></button>`).join('')}</div>
    <div class="spec-legend">${ideos.map(x =>
      `<button type="button" class="spec-key${activas.has(x.value) ? ' on' : ''}" data-ideo="${esc(x.value)}" title="${esc(tit(x))}">`
      + `<i class="${cls(x.value)}"></i>${esc(L[x.value] || x.value)} ${pct(x)}</button>`).join('')}</div>
    ${fuentePieHTML('panel-fuente spec-fuente')}`;
  box.hidden = false;
}







const TREND_MAX = 8;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
let TREND_RANGES = [
  { id: 'all', label: 'Todo', title: 'Todo el calendario del corpus' },
];

/** Los tramos de la tendencia son las legislaturas del corpus abierto (facetas). */
function trendRangesDesdeFacetas(f) {
  const legs = (f && f.legislatures) || [];
  const out = [{ id: 'all', label: 'Todo', title: 'Todo el calendario del corpus' }];
  legs.forEach((l, i) => {
    if (!l.date_min || !l.date_max) return;
    out.push({ id: `leg${i}`, label: String(l.value), from: l.date_min.slice(0, 7), to: l.date_max.slice(0, 7),
      title: `Legislatura ${l.value}: ${fechaLarga(l.date_min)} a ${fechaLarga(l.date_max)} · ${nf(l.sessions || 0)} sesiones` });
  });
  TREND_RANGES = out;
  return out;
}
const TREND_KINDS = { electoral: 'Elecciones', politico: 'Política', parlamentario: 'Parlamento',
                      conflicto: 'Conflicto', economico: 'Economía', social: 'Sociedad' };
const TREND_MS_LEVELS = [['auto', 'los que quepan', 'Dibuja los hitos por orden de importancia mientras quepan sin solaparse: primero los principales, luego los relevantes y por último los de contexto'],
                         ['1', 'principales', 'Solo los hitos principales (elecciones, tomas de posesión, constituciones, golpes, crisis mayores)'],
                         ['2', 'relevantes', 'Hitos principales y relevantes'],
                         ['3', 'todos', 'Todos los hitos del periodo que quepan en el gráfico']];
const TREND_METRICS = {
  density: { label: '/10.000 palabras', unit: 'por 10.000 palabras',
             title: 'Menciones por cada 10.000 palabras pronunciadas en el periodo' },
  abs: { label: 'Absoluta', unit: 'menciones', title: 'Número de apariciones del término' },
  pct: { label: '％ interv.', unit: '% de intervenciones',
         title: 'Porcentaje de intervenciones del periodo que contienen el término al menos una vez' },
};
const TREND_REL = {
  normal: 'fiabilidad normal',
  baja: 'fiabilidad baja (menos de 100.000 palabras en el periodo)',
  muy_baja: 'fiabilidad muy baja (menos de 20.000 palabras; no fija la escala)',
  vacio: 'sin datos',
};

const TREND_PAL = {
  light: { bg: '#ffffff', ink: '#1d1b18', soft: '#5f5a52', faint: '#8b857b', grid: '#eeebe5', axis: '#c9c3b7',
           band: '#f3f0ea', recess: '#f8f6f1', hatch: '#dcd6ca', ms: '#9b958b', pick: '#e3e6f4',
           series: ['#4a4fa8', '#b5562c', '#0d7d6b', '#a4781f', '#8a3f8f', '#3f7fae', '#6d8a3c', '#a33a4a'] },
  dark:  { bg: '#1e1e22', ink: '#e9e7e3', soft: '#a5a19a', faint: '#7f7b74', grid: '#2a2a30', axis: '#4a4a52',
           band: '#25252b', recess: '#222227', hatch: '#3b3b43', ms: '#8d8980', pick: '#2d3044',
           series: ['#9ca0f0', '#e38b5d', '#4cc4ac', '#d8ad55', '#c98ad0', '#7fb3dd', '#a6c56d', '#e27d8c'] },
};





const TREND_PAL_EDITORIAL = {
  light: { ...TREND_PAL.light, pick: '#f1e3e4', series: [...TREND_PAL.light.series.slice(0, 7), '#5b6770'] },
  dark:  { ...TREND_PAL.dark,  pick: '#3b262a', series: [...TREND_PAL.dark.series.slice(0, 7), '#b3bcc6'] },
};
const trendPal = () => (document.documentElement.dataset.estilo !== 'clasico' ? TREND_PAL_EDITORIAL : TREND_PAL)[
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];




const TREND_ICON = {
  baja: '<svg class="ticon" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  muy: '<svg class="ticon" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="1.6 1.3"/></svg>',
  receso: '<svg class="ticon" viewBox="0 0 12 10" aria-hidden="true"><path d="M-1 7l4-4M3 11l8-8M9 11l4-4M-1 1l2-2" stroke="currentColor" stroke-width="1"/></svg>',
  corte: '<svg class="ticon" viewBox="0 0 12 10" aria-hidden="true"><path d="M2 9l3-8M7 9l3-8" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>',
};

function trendState() {
  return { open: false, tab: 'trend', terms: [], seedQuery: null, variants: false, applyFilters: false,
           milestones: true, msLevel: 'auto', msLegend: null, metric: 'density', gran: 'month', smooth: 0, range: 'all',
           data: null, key: '', cache: new Map(), ctrl: null, seq: 0, loading: false, error: null,
           editing: null, hover: null, hoverTerm: null, geom: null, ro: null, width: 0 };
}
S.trend = trendState();
S.statsCache = null;

const mesLargo = key => {
  const [y, m] = String(key).split('-').map(Number);
  return m ? `${MESES[m - 1]} de ${y}` : String(key);
};
const fechaCorta = iso => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return m ? `${d ? `${d} ` : ''}${MESES_C[m - 1]} ${y}` : String(iso || '');
};



function splitTerms(text) {
  const s = String(text || '').replace(/[«»“”]/g, '"');
  const sinCerrar = (s.match(/"/g) || []).length % 2 ? s.lastIndexOf('"') : -1;
  const out = []; let cur = '', dentro = false;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (ch === '"' && k !== sinCerrar) dentro = !dentro;
    if (ch === ',' && !dentro) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
}





function seedTerms(q, max = TREND_MAX) {



  const Q = globalThis.R2 && globalThis.R2.query;
  return Q && typeof Q.seedTerms === 'function' ? Q.seedTerms(q, max) : [];





























}


function niceTicks(lo, hi, target = 4, { integer = false } = {}) {
  lo = Number(lo) || 0; hi = Number(hi) || 0;
  if (!(hi > lo)) hi = lo + (integer ? 1 : 1);
  const raw = (hi - lo) / Math.max(1, target);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  if (integer) step = Math.max(1, Math.round(step));
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let k = 0; min + k * step <= max + step * 1e-6; k++) ticks.push(+(min + k * step).toFixed(10));
  return { step, min, max, ticks };
}


const gapUnits = n => Math.min(3.4, 1.5 + 0.45 * Math.log2(n));





function buildAxis(keys, empty, { from = null, to = null, minRun = 3 } = {}) {
  const idx = [];
  keys.forEach((k, i) => { if ((!from || k >= from) && (!to || k <= to)) idx.push(i); });
  const items = [];
  let u = 0, k = 0;
  while (k < idx.length) {
    if (empty[idx[k]]) {
      let j = k;
      while (j + 1 < idx.length && empty[idx[j + 1]] && idx[j + 1] === idx[j] + 1) j++;
      const n = j - k + 1;
      if (n >= minRun) {
        const w = gapUnits(n);
        items.push({ kind: 'gap', i0: idx[k], i1: idx[j], n, u0: u, u1: u + w });
        u += w;
      } else {
        for (let q = k; q <= j; q++) { items.push({ kind: 'slot', i: idx[q], empty: true, u0: u, u1: u + 1 }); u += 1; }
      }
      k = j + 1;
      continue;
    }
    items.push({ kind: 'slot', i: idx[k], empty: false, u0: u, u1: u + 1 });
    u += 1; k++;
  }
  const pos = new Map();
  for (const it of items) {
    if (it.kind === 'slot') pos.set(it.i, it);
    else for (let q = it.i0; q <= it.i1; q++) pos.set(q, it);
  }
  return { items, units: u, pos, first: idx.length ? idx[0] : null, last: idx.length ? idx.at(-1) : null };
}



function segmentsOf(empty, minRun = 3) {
  const seg = new Array(empty.length).fill(0);
  let s = 0, k = 0;
  while (k < empty.length) {
    if (!empty[k]) { seg[k] = s; k++; continue; }
    let j = k;
    while (j + 1 < empty.length && empty[j + 1]) j++;
    const largo = j - k + 1 >= minRun;
    for (let q = k; q <= j; q++) seg[q] = largo ? -1 : s;
    if (largo) s++;
    k = j + 1;
  }
  return seg;
}

function relOf(tokens, th) {
  return tokens >= th.normal ? 'normal' : tokens >= th.baja ? 'baja' : tokens > 0 ? 'muy_baja' : 'vacio';
}


function trendBase(d, gran = 'month') {
  const months = d?.months || [];
  const den = d?.denominators || {}, cm = d?.corpus_months || {};
  const th = { normal: 100000, baja: 20000, ...(d?.thresholds || {}) };
  const sessions = months.map((_, i) => (Array.isArray(cm.sessions)
    ? +cm.sessions[i] || 0 : ((+cm.tokens?.[i] || +den.tokens?.[i]) ? 1 : 0)));
  const terms = [];
  (d?.terms || []).forEach((t, k) => {
    if (t && t.ok && Array.isArray(t.counts))
      terms.push({ k, label: t.label || t.input, input: t.input, query: t.query, total: t.total,
                   counts: t.counts, docs: t.docs || [] });
  });
  if (gran !== 'year') {
    return { gran: 'month', keys: months, members: months.map((_, i) => [i]),
             tokens: den.tokens || [], speeches: den.speeches || [], sessions,
             empty: sessions.map(x => x === 0),
             rel: months.map((_, i) => den.reliability?.[i] || relOf(+den.tokens?.[i] || 0, th)), terms, th };
  }
  const years = [...new Set(months.map(m => m.slice(0, 4)))];
  const members = years.map(y => months.reduce((a, m, i) => { if (m.startsWith(y)) a.push(i); return a; }, []));
  const sum = (arr, ids) => ids.reduce((s, i) => s + (+(arr || [])[i] || 0), 0);
  const tokens = members.map(ids => sum(den.tokens, ids));
  const ses = members.map(ids => sum(sessions, ids));
  return { gran: 'year', keys: years, members, tokens, speeches: members.map(ids => sum(den.speeches, ids)),
           sessions: ses, empty: ses.map(x => x === 0), rel: tokens.map(tk => relOf(tk, th)), th,
           terms: terms.map(t => ({ ...t, counts: members.map(ids => sum(t.counts, ids)),
                                    docs: members.map(ids => sum(t.docs, ids)) })) };
}

function trendValue(metric, c, d, tokens, speeches) {
  if (metric === 'pct') return speeches > 0 ? d / speeches * 100 : null;
  if (!(tokens > 0)) return null;
  return metric === 'abs' ? c : c / tokens * 1e4;
}





function deriveSeries(base, { metric = 'density', smooth = 0, seg = null } = {}) {
  const n = base.keys.length;
  const half = smooth > 1 ? Math.floor(smooth / 2) : 0;
  return base.terms.map(t => {
    const pts = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const tk = +base.tokens[i] || 0, sp = +base.speeches[i] || 0;
      if (!(tk > 0)) continue;
      const c = +t.counts[i] || 0, d = +t.docs[i] || 0;
      const raw = trendValue(metric, c, d, tk, sp);
      let v = raw;
      if (half) {
        let C = 0, D = 0, TT = 0, SS = 0, m = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
          if (seg && seg[j] !== seg[i]) continue;
          const tj = +base.tokens[j] || 0;
          if (!(tj > 0)) continue;
          C += +t.counts[j] || 0; D += +t.docs[j] || 0; TT += tj; SS += +base.speeches[j] || 0; m++;
        }
        v = metric === 'abs' ? (m ? C / m : null) : trendValue(metric, C, D, TT, SS);
      }
      pts[i] = { v, raw, c, d, tokens: tk, speeches: sp, rel: base.rel[i] || relOf(tk, base.th) };
    }
    return { ...t, pts };
  });
}




function layoutMilestones(xs, { gap = 15, rows = 2, xMin = -Infinity, xMax = Infinity } = {}) {
  const orden = xs.map((x, k) => [x, k]).sort((a, b) => a[0] - b[0]);
  const ultimo = new Array(rows).fill(-Infinity);
  const out = new Array(xs.length);
  for (const [x, k] of orden) {
    let fila = 0, cx = Infinity;
    for (let r = 0; r < rows; r++) {
      const c = Math.max(x, xMin, ultimo[r] + gap);
      if (c < cx - 1e-9) { fila = r; cx = c; }
    }
    out[k] = { row: fila, cx, x };
    ultimo[fila] = cx;
  }
  for (let r = 0; r < rows; r++) {
    const fila = out.filter(o => o && o.row === r).sort((a, b) => a.cx - b.cx);
    let limite = xMax;
    for (let q = fila.length - 1; q >= 0; q--) {
      if (fila[q].cx > limite) fila[q].cx = limite;
      limite = fila[q].cx - gap;
    }
  }
  return out;
}




const msRank = m => (m.h.rank === 1 || m.h.rank === 3 ? m.h.rank : 2);

/** Qué hitos del periodo se dibujan: los de importancia `maxRank` o mayor, y como mucho `capacity`. Si sobran, se
 *  reparten por importancia y, dentro de cada rango, repartidos por fecha para no dejar tramos sin ninguno. */
function selectMilestones(items, { maxRank = 3, capacity = 60 } = {}) {
  const rankOf = msRank;
  let pool = items.filter(m => rankOf(m) <= maxRank);
  if (pool.length > capacity) {
    const keep = new Set();
    for (let r = 1; r <= 3 && keep.size < capacity; r++) {
      const grupo = pool.filter(m => rankOf(m) === r), sitio = capacity - keep.size;
      if (grupo.length <= sitio) grupo.forEach(m => keep.add(m));
      else { const paso = grupo.length / sitio; for (let i = 0; i < sitio; i++) keep.add(grupo[Math.floor(i * paso)]); }
    }
    pool = pool.filter(m => keep.has(m));
  }
  const drawn = new Set(pool);
  return { drawn: items.filter(m => drawn.has(m)), hidden: items.filter(m => !drawn.has(m)) };
}

function yearMarks(axis, keys, gran) {
  const marks = [];
  if (gran === 'year') {
    for (const it of axis.items) {
      if (it.kind === 'slot') marks.push({ text: keys[it.i], short: `’${keys[it.i].slice(2)}`, u: (it.u0 + it.u1) / 2, mid: true });
      else {
        const a = keys[it.i0], b = keys[it.i1];
        marks.push({ text: `${a}–${b.slice(2)}`, short: `’${a.slice(2)}–${b.slice(2)}`, u: (it.u0 + it.u1) / 2, mid: true });
      }
    }
    return marks;
  }
  const vistos = new Set();
  for (const it of axis.items) {
    if (it.kind === 'slot') {
      const y = keys[it.i].slice(0, 4);
      if (!vistos.has(y)) { vistos.add(y); marks.push({ text: y, short: `’${y.slice(2)}`, u: it.u0, tick: true }); }
      continue;
    }
    const ys = [];
    for (let q = it.i0; q <= it.i1; q++) {
      const y = keys[q].slice(0, 4);
      if (!vistos.has(y)) { vistos.add(y); ys.push({ y, q }); }
    }
    if (!ys.length) continue;
    const w = it.u1 - it.u0;
    if (ys.length === 1) {
      marks.push({ text: ys[0].y, short: `’${ys[0].y.slice(2)}`, u: it.u0 + (ys[0].q - it.i0) / it.n * w, tick: true });
    } else {
      const a = ys[0].y, b = ys.at(-1).y;
      marks.push({ text: `${a}–${b.slice(2)}`, short: `’${a.slice(2)}–${b.slice(2)}`, u: it.u0 + w / 2, mid: true,
                   years: ys.map(x => x.y) });
    }
  }
  return marks;
}





function layoutLabels(marks, xOf, { charW = 6, pad = 5, rows = 2, xMin = 0, xMax = Infinity } = {}) {
  const derecha = new Array(rows).fill(-Infinity);
  const out = marks.map(m => {
    const x = xOf(m.u);
    const caja = t => {
      const w = t.length * charW;
      let a = m.mid ? x - w / 2 : x + 2;
      a = Math.max(xMin, Math.min(a, xMax - w));
      return [a, a + w];
    };
    for (const text of [m.text, m.short]) {
      if (!text) continue;
      const [a, b] = caja(text);
      for (let r = 0; r < rows; r++) {
        if (a >= derecha[r] + pad) { derecha[r] = b; return { ...m, x, text, row: r, x0: a, x1: b }; }
      }
    }
    const text = m.short || m.text, w = text.length * charW;
    let r = 0;
    for (let q = 1; q < rows; q++) if (derecha[q] < derecha[r]) r = q;
    const a = Math.max(caja(text)[0], derecha[r] + pad);
    derecha[r] = a + w;
    return { ...m, x, text, row: r, x0: a, x1: a + w, crowded: true };
  });
  for (let r = 0; r < rows; r++) {
    const fila = out.filter(o => o.row === r).sort((p, q) => p.x0 - q.x0);
    let limite = xMax;
    for (let k = fila.length - 1; k >= 0; k--) {
      const w = fila[k].x1 - fila[k].x0;
      if (fila[k].x1 > limite) { fila[k].x1 = limite; fila[k].x0 = limite - w; }
      limite = fila[k].x0 - pad;
    }
  }
  return out;
}

function fmtTrend(v, metric) {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v);
  const dec = metric === 'abs' ? (Number.isInteger(v) ? 0 : 1) : a >= 100 ? 0 : a >= 10 ? 1 : 2;
  const s = agrupa(v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
  return metric === 'pct' ? `${s} %` : s;
}



function trendDraw(W, pal, { forExport = false } = {}) {
  const T = S.trend, d = T.data || {};
  const base = trendBase(d, T.gran);
  const rng = TREND_RANGES.find(r => r.id === T.range) || TREND_RANGES[0];
  const cut = s => (s && base.gran === 'year' ? s.slice(0, 4) : s);
  const axis = buildAxis(base.keys, base.empty, { from: cut(rng.from), to: cut(rng.to) });
  if (!axis.items.length) return { svg: '', geom: null };
  const series = deriveSeries(base, { metric: T.metric, smooth: base.gran === 'month' ? T.smooth : 0,
                                      seg: segmentsOf(base.empty) });
  const r1 = x => Math.round(x * 10) / 10;
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  const mono = "Menlo, 'DejaVu Sans Mono', Consolas, monospace";
  const firstKey = base.keys[axis.first], lastKey = base.keys[axis.last];
  const keyIdx = new Map(base.keys.map((k, i) => [k, i]));


  const uOfDate = iso => {
    const y = +iso.slice(0, 4), m = +iso.slice(5, 7) || 1, dd = +iso.slice(8, 10) || 1;
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const key = base.gran === 'year' ? iso.slice(0, 4) : iso.slice(0, 7);
    const frac = base.gran === 'year' ? (m - 1 + (dd - 0.5) / dim) / 12 : (dd - 0.5) / dim;
    if (key < firstKey) return { where: 'antes', u: 0 };
    if (key > lastKey) return { where: 'despues', u: axis.units };
    const i = keyIdx.get(key);
    const it = i == null ? null : axis.pos.get(i);
    if (!it) return { where: 'fuera', u: null };
    if (it.kind === 'slot') return { where: 'dentro', u: it.u0 + frac };
    return { where: 'dentro', u: it.u0 + (i - it.i0 + frac) / it.n * (it.u1 - it.u0) };
  };

  const plotL = 44, plotR = W - 10, plotW = Math.max(40, plotR - plotL);
  const xOfU = u => plotL + (axis.units ? u / axis.units : 0) * plotW;

  // Hitos: los del periodo mostrado se dibujan numerados en una banda sobre el gráfico (una fila si caben sin
  // desplazarse, dos si no); cuántos, según el nivel elegido y el espacio (selectMilestones). El gráfico conserva
  // siempre su altura: lo que no cabe se cuenta en la leyenda, no se apila.
  const msIn = [], msOut = [], msHidden = [];
  let msRows = 0, msTotal = 0;
  if (T.milestones) {
    const hs = (d.milestones || []).filter(h => h && /^\d{4}-\d{2}/.test(h.date || ''))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.rank || 2) - (b.rank || 2));
    const dentro = [];
    for (const h of hs) {
      const p = uOfDate(h.date);
      (p.where === 'dentro' ? dentro : msOut).push({ h, u: p.u, where: p.where });
    }
    msTotal = dentro.length;
    // Una marca solo es legible si su número queda cerca de su fecha: se coloca en una fila si casi no hay que
    // desplazarla, si no en dos, y en modo automático se baja de nivel de importancia mientras el desplazamiento
    // delate la posición (MS_DESV). El gráfico no pierde altura por ello: lo que no cabe se cuenta en la leyenda.
    const MS_GAP = 15, MS_DESV = 22, MS_AIRE = 26;
    const capacidad = Math.max(2, (Math.floor(Math.max(0, plotW - 14) / MS_GAP) + 1) * 2);
    // Cuántas marcas caben con aire suficiente para leerlas: una por cada MS_AIRE píxeles de ancho, en dos filas.
    const holgadas = Math.max(2, Math.floor(plotW / MS_AIRE) * 2);
    const colocar = (items) => {
      const xs = items.map(m => xOfU(m.u));
      const desvDe = (lay) => lay.reduce((a, l, k) => Math.max(a, Math.abs(l.cx - xs[k])), 0);
      const opciones = { gap: MS_GAP, xMin: plotL + 7, xMax: plotR - 7 };
      let lay = layoutMilestones(xs, { ...opciones, rows: 1 }), filas = 1, desv = desvDe(lay);
      if (desv > 6) { lay = layoutMilestones(xs, { ...opciones, rows: 2 }); filas = 2; desv = desvDe(lay); }
      return { xs, lay, filas, desv };
    };
    const auto = T.msLevel === 'auto';
    const tope = auto ? Math.min(capacidad, holgadas) : capacidad;
    let nivel = auto ? 3 : Math.max(1, Math.min(3, +T.msLevel || 3));
    let sel = selectMilestones(dentro, { maxRank: nivel, capacity: tope });
    let col = colocar(sel.drawn);
    if (auto) {
      // Baja de nivel de importancia mientras las marcas no quepan con aire o sus números queden lejos de su fecha.
      while (nivel > 1 && (dentro.filter(m => msRank(m) <= nivel).length > holgadas || col.desv > MS_DESV)) {
        nivel -= 1;
        sel = selectMilestones(dentro, { maxRank: nivel, capacity: tope });
        col = colocar(sel.drawn);
      }
    }
    msIn.push(...sel.drawn);
    msHidden.push(...sel.hidden);
    if (msIn.length) {
      msRows = col.filas;
      msIn.forEach((m, k) => { m.n = k + 1; m.x = col.xs[k]; m.cx = col.lay[k].cx; m.row = col.lay[k].row; m.cy = 10 + col.lay[k].row * 16; });
    }
  }

  const plotT = msIn.length ? (msRows > 1 ? 44 : 30) : 14;
  const plotH = forExport ? 210 : 120;
  const plotB = plotT + plotH;
  const H = plotB + 36;


  const slotItems = axis.items.filter(it => it.kind === 'slot');
  let ymax = 0, ymaxAll = 0;
  for (const s of series) {
    for (const it of slotItems) {
      const p = s.pts[it.i];
      if (!p || p.v == null || !isFinite(p.v)) continue;
      ymaxAll = Math.max(ymaxAll, p.v);
      if (p.rel !== 'muy_baja') ymax = Math.max(ymax, p.v);
    }
  }
  if (!(ymax > 0)) ymax = ymaxAll > 0 ? ymaxAll : 1;
  const ticks = niceTicks(0, ymax, 4, { integer: T.metric === 'abs' && !(base.gran === 'month' && T.smooth > 1) });
  const top = ticks.max || 1;
  const yOf = v => plotB - Math.min(Math.max(v, 0), top) / top * plotH;
  const decTick = ticks.step < 1 ? Math.min(4, Math.ceil(-Math.log10(ticks.step) - 1e-9)) : 0;

  const o = [];
  o.push(`<defs><pattern id="thatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<rect width="5" height="5" fill="${pal.recess}"/><line x1="0" y1="0" x2="0" y2="5" stroke="${pal.hatch}" stroke-width="1.6"/></pattern></defs>`);
  if (forExport) o.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${pal.bg}"/>`);



  const rotulosBanda = [];
  const banda = (a, b, texto) => {
    const A = uOfDate(a), B = uOfDate(b);
    if (A.where === 'despues' || B.where === 'antes' || A.u == null || B.u == null) return;
    const x0 = xOfU(A.u), x1 = xOfU(B.u);
    if (x1 - x0 < 2) return;
    o.push(`<rect x="${r1(x0)}" y="${plotT}" width="${r1(x1 - x0)}" height="${plotH}" fill="${pal.band}"/>`);
    const w = texto.length * 5.4 + 6;
    if (x1 - x0 > w + 2)
      rotulosBanda.push(`<rect x="${r1(x0 + 1)}" y="${plotT + 1}" width="${r1(w)}" height="12" fill="${pal.bg}" fill-opacity="0.9"/>`
        + `<text x="${r1(x0 + 4)}" y="${plotT + 10}" font-size="9" fill="${pal.soft}" font-family="${sans}">${esc(texto)}</text>`);
  };


  const per = S.filters.period;
  if (!forExport && per && per.gran === base.gran && keyIdx.has(per.key)) {
    const it = axis.pos.get(keyIdx.get(per.key));
    if (it && it.kind === 'slot') o.push(`<rect x="${r1(xOfU(it.u0))}" y="${plotT}" width="${r1(xOfU(it.u1) - xOfU(it.u0))}" height="${plotH}" fill="${pal.pick}"/>`);
  }


  const gaps = [];
  for (const it of axis.items) {
    if (it.kind === 'slot' && !it.empty) continue;
    const x0 = xOfU(it.u0), x1 = xOfU(it.u1);
    o.push(`<rect x="${r1(x0)}" y="${plotT}" width="${r1(Math.max(1, x1 - x0))}" height="${plotH}" fill="url(#thatch)"/>`);
    if (it.kind === 'gap') gaps.push({ it, x0, x1 });
  }


  o.push(`<g font-family="${mono}" font-size="9.5" fill="${pal.faint}">`);
  for (const v of ticks.ticks) {
    const y = r1(yOf(v));
    o.push(`<line x1="${plotL}" x2="${plotR}" y1="${y}" y2="${y}" stroke="${v === 0 ? pal.axis : pal.grid}" stroke-width="1"/>`);
    o.push(`<text x="${plotL - 6}" y="${r1(y + 3)}" text-anchor="end">${esc(agrupa(v.toLocaleString('es-ES', { minimumFractionDigits: decTick, maximumFractionDigits: decTick })))}</text>`);
  }
  o.push('</g>');

  for (const g of gaps) {
    const cx = r1((g.x0 + g.x1) / 2);
    o.push(`<rect x="${r1(cx - 4)}" y="${plotB - 5}" width="8" height="10" fill="${pal.bg}"/>`
      + `<path d="M${r1(cx - 5)} ${plotB + 5}l4 -10M${r1(cx + 1)} ${plotB + 5}l4 -10" stroke="${pal.faint}" stroke-width="1.1" fill="none"/>`);
  }
  o.push(...rotulosBanda);


  const marks = layoutLabels(yearMarks(axis, base.keys, base.gran), xOfU, { charW: 5.9, xMin: 2, xMax: W - 2 });
  o.push(`<g font-family="${mono}" font-size="9.5" fill="${pal.soft}">`);
  for (const m of marks) {
    if (m.tick) o.push(`<line x1="${r1(m.x)}" x2="${r1(m.x)}" y1="${plotB}" y2="${plotB + 4}" stroke="${pal.axis}"/>`);
    o.push(`<text class="tyear" x="${r1(m.x0)}" y="${plotB + 15 + m.row * 12}"${m.years ? ` data-years="${esc(m.years.join(' '))}"` : ''}>${esc(m.text)}</text>`);
  }
  o.push('</g>');


  for (const m of msIn) {
    o.push(`<line x1="${r1(m.x)}" x2="${r1(m.x)}" y1="${plotT}" y2="${plotB}" stroke="${pal.ms}" stroke-width="0.8" stroke-dasharray="2 3"/>`
      + `<line x1="${r1(m.cx)}" y1="${m.cy + 7}" x2="${r1(m.x)}" y2="${plotT}" stroke="${pal.ms}" stroke-width="0.8"/>`);
  }


  const geomSeries = [];
  for (const s of series) {
    const col = pal.series[s.k % pal.series.length];
    const pts = [];
    axis.items.forEach((it, n) => {
      if (it.kind !== 'slot') return;
      const p = s.pts[it.i];
      if (!p || p.v == null || !isFinite(p.v)) return;
      pts.push({ i: it.i, n, x: xOfU((it.u0 + it.u1) / 2), y: yOf(p.v), p, clip: p.v > top + 1e-9,
                 low: p.rel === 'baja' || p.rel === 'muy_baja' });
    });
    let solid = '', dashed = '', dots = '';
    pts.forEach((a, q) => {
      const prev = pts[q - 1], next = pts[q + 1];
      const unidoI = prev && prev.n === a.n - 1, unidoD = next && next.n === a.n + 1;
      if (unidoI) {
        const tramo = `M${r1(prev.x)} ${r1(prev.y)}L${r1(a.x)} ${r1(a.y)}`;
        if (a.low || prev.low) dashed += tramo; else solid += tramo;
      }
      if (a.p.rel === 'muy_baja') dots += `<circle cx="${r1(a.x)}" cy="${r1(a.y)}" r="2.9" fill="${pal.bg}" stroke="${col}" stroke-width="1.3" stroke-dasharray="1.6 1.3"/>`;
      else if (a.p.rel === 'baja') dots += `<circle cx="${r1(a.x)}" cy="${r1(a.y)}" r="2.9" fill="${pal.bg}" stroke="${col}" stroke-width="1.4"/>`;
      else if (!unidoI && !unidoD) dots += `<circle cx="${r1(a.x)}" cy="${r1(a.y)}" r="2.3" fill="${col}"/>`;
      if (a.clip) dots += `<path d="M${r1(a.x - 3.5)} ${plotT + 1}L${r1(a.x + 3.5)} ${plotT + 1}L${r1(a.x)} ${plotT - 5}Z" fill="${col}"/>`;
    });
    o.push(`<g class="tseries" data-term="${s.k}">`
      + (solid ? `<path d="${solid}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` : '')
      + (dashed ? `<path d="${dashed}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 3"/>` : '')
      + dots + '</g>');

    geomSeries.push({ ...s, col, vals: s.pts, pts });
  }


  o.push(`<g font-family="${sans}" font-size="8.5" fill="${pal.soft}" text-anchor="middle">`);
  for (const m of msIn) {
    const grosor = m.h.rank === 1 ? 1.5 : m.h.rank === 3 ? 0.7 : 1;
    o.push(`<g class="tms" data-ms="${m.n}"><circle cx="${r1(m.cx)}" cy="${m.cy}" r="7" fill="${pal.bg}" stroke="${pal.ms}" stroke-width="${grosor}"/>`
      + `<text x="${r1(m.cx)}" y="${m.cy + 3}">${m.n}</text></g>`);
  }
  o.push('</g>');


  const hov = axis.items.map(it => ({ it, kind: it.kind, i: it.kind === 'slot' ? it.i : it.i0,
    x0: xOfU(it.u0), x1: xOfU(it.u1), x: xOfU((it.u0 + it.u1) / 2) }));
  const geom = { W, H, plotL, plotR, plotT, plotB, top, yOf, base, axis, series: geomSeries, hov, msIn, msOut, msHidden,
                 msTotal, msRows, marks, firstKey, lastKey };
  return { svg: o.join(''), geom };
}


function trendFilters() {
  const f = { ...S.filters };
  if (f.period) {
    delete f.speech_ids;
    if (f.period.kind === 'dates') { delete f.date_from; delete f.date_to; }
  }
  delete f.period;
  return f;
}

function trendRequest() {
  const T = S.trend;
  const body = { terms: T.terms.slice(0, TREND_MAX), variants: !!T.variants, apply_filters: !!T.applyFilters };
  if (T.applyFilters) body.filters = trendFilters();
  return body;
}


function trendSyncTerms() {
  const T = S.trend;
  if (T.seedQuery === S.query) return false;
  T.seedQuery = S.query;
  const sembrados = seedTerms(S.query);
  if (!sembrados.length) return false;
  const cambia = sembrados.join('\u0001') !== T.terms.join('\u0001') || T.variants !== S.variants;
  T.terms = sembrados; T.variants = S.variants; T.editing = null;
  return cambia;
}

async function trendLoad() {
  const T = S.trend;
  if (!T.open || T.tab !== 'trend' || S.view !== 'search') return;
  if (!T.terms.length) { T.ctrl?.abort(); T.data = null; T.key = ''; T.loading = false; trendRenderChart(); return; }
  const body = trendRequest();
  const key = JSON.stringify(body);
  if (key === T.key && T.data && !T.data.incomplete && !T.loading) return;
  const enCache = T.cache.get(key);
  if (enCache) { T.ctrl?.abort(); ++T.seq; T.data = enCache; T.key = key; T.loading = false; T.error = null; trendRender(); return; }
  T.ctrl?.abort();
  const ctrl = T.ctrl = new AbortController();
  const seq = ++T.seq;
  T.loading = true; T.error = null;
  trendRender();
  try {
    let r, intentos = 0;
    for (;;) {
      r = await api('/ngram', { method: 'POST', body, signal: ctrl.signal });
      if (seq !== T.seq) return;
      const pendiente = r.incomplete || (r.terms || []).some(t => t && t.retry);
      if (!pendiente || intentos >= 6) break;


      intentos++;
      T.data = r; T.key = key;
      trendRender();
      await new Promise(res => setTimeout(res, 80 * intentos));
      if (seq !== T.seq) return;
    }
    T.data = r; T.key = key;
    if (!r.incomplete) {
      T.cache.set(key, r);
      if (T.cache.size > 12) T.cache.delete(T.cache.keys().next().value);
    }
  } catch (e) {
    if (e.name === 'AbortError' || seq !== T.seq) return;
    T.error = e.message;
  } finally {
    if (seq === T.seq) { T.loading = false; trendRender(); }
  }
}

function trendTermTitle(t) {
  if (!t) return 'Pendiente de contar';
  if (!t.ok) return `${t.message || 'Término no válido.'}${t.suggestion ? ` ${t.suggestion}` : ''}`;
  const tipo = { palabra: 'Palabra', prefijo: 'Prefijo', frase: 'Frase' }[t.type] || 'Término';
  const partes = [`${tipo} · ${nf(t.total)} menciones en ${nf(t.total_docs)} intervenciones`];
  if (t.total_corpus != null && t.total_corpus !== t.total) partes.push(`${nf(t.total_corpus)} en todo el corpus`);
  if (t.type === 'prefijo' && t.forms?.length)
    partes.push(`${nf(t.n_forms)} formas: ${t.forms.slice(0, 6).map(f => `${f.form} (${nf(f.n)})`).join(', ')}${t.n_forms > 6 ? '…' : ''}`);
  for (const w of t.warnings || []) if (w?.message) partes.push(w.message);
  partes.push(`Consulta: ${t.query}`);
  return partes.join('\n');
}

function trendChipsHTML() {
  const T = S.trend, pal = trendPal();
  const info = new Map((T.data?.terms || []).map((t, k) => [t.input, { t, k }]));
  const chips = T.terms.map((term, k) => {
    if (T.editing === k)
      return `<input class="tchip-edit" data-tedit-input="${k}" value="${esc(term)}" size="${Math.max(6, term.length + 2)}" aria-label="Editar el término ${k + 1}">`;
    const x = info.get(term), t = x?.t;
    const col = pal.series[(x ? x.k : k) % pal.series.length];
    const err = t && !t.ok;
    const cifra = t?.ok ? ` · ${nf(t.total)}` : (!t && T.loading ? ' · …' : '');
    return `<span class="tchip${err ? ' err' : ''}" style="--c:${col}">`
      + `<i class="tdot" aria-hidden="true"></i>`
      + `<button type="button" class="tchip-lab" data-tedit="${k}" title="${esc(trendTermTitle(t))}\n(clic para editar)">${err ? '⚠ ' : ''}${esc(term)}${cifra}</button>`
      + `<button type="button" class="tchip-x" data-tdel="${k}" aria-label="Quitar ${esc(term)}" title="Quitar">✕</button></span>`;
  }).join('');
  const add = T.terms.length < TREND_MAX
    ? `<input id="trendAdd" class="tadd" placeholder="+ término" aria-label="Añadir términos (separe varios con comas)" title="Palabra, prefijo* o “frase entre comillas”. Varios, separados por comas. Intro para añadir.">`
    : `<span class="tstatus">máx. ${TREND_MAX}</span>`;
  return chips + add;
}

function trendStatusHTML() {
  const T = S.trend, d = T.data;
  const out = [];
  if (T.error) out.push(`<span class="terr">⚠ ${esc(T.error)}</span>`);
  if (d) {
    const den = d.denominators || {};
    out.push(d.filtered
      ? `Con los filtros: ${nf(d.n_allowed)} intervenciones · ${nf(den.tokens_total)} palabras`
      : `Corpus completo · ${nf(den.tokens_total)} palabras`);
    if (T.applyFilters && !Object.keys(trendFilters()).length) out.push('sin filtros activos');
    out.push(esc(TREND_METRICS[T.metric].unit));
    if (d.incomplete) out.push('<span class="terr">contando… (resultado parcial)</span>');
    if (d.errors) out.push(`<span class="terr">${nf(d.errors)} ${d.errors === 1 ? 'término no válido' : 'términos no válidos'}</span>`);
  } else if (T.loading) out.push('Contando…');
  return out.join(' · ');
}

function trendRender() {
  const T = S.trend, box = $('#trendPanel');
  const btn = $('#statsBtn');
  if (btn) { btn.classList.toggle('on', T.open); btn.setAttribute('aria-expanded', String(T.open)); }
  if (!box) return;
  if (!T.open || S.view !== 'search') { box.hidden = true; return; }
  box.hidden = false;

  const act = document.activeElement;
  const escribiendo = act && box.contains(act) && act.matches('#trendAdd, .tchip-edit')
    ? { sel: act.id === 'trendAdd' ? '#trendAdd' : `[data-tedit-input="${act.dataset.teditInput}"]`, value: act.value } : null;

  const seg = (attr, cur, opts) => opts.map(([v, lab, tit]) =>
    `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(v) === String(cur)}"${tit ? ` title="${esc(tit)}"` : ''}>${esc(lab)}</button>`).join('');
  const tabs = [['trend', 'Tendencia'], ['dist', 'Distribución']].map(([v, lab]) =>
    `<button type="button" role="tab" data-ttab="${v}" aria-selected="${T.tab === v}">${lab}</button>`).join('');
  const head = `<div class="trow">
      <div class="tseg" role="tablist" aria-label="Contenido del panel">${tabs}</div>
      <span class="grow"></span>
      ${T.tab === 'trend' ? `<div class="tseg" role="group" aria-label="Métrica">${seg('tmetric', T.metric,
          Object.entries(TREND_METRICS).map(([k, m]) => [k, m.label, m.title]))}</div>
        <div class="tseg" role="group" aria-label="Resolución">${seg('tgran', T.gran,
          [['month', 'Mes', 'Serie mensual'], ['year', 'Año', 'Serie anual']])}</div>` : ''}
      <button type="button" class="btn ghost sm" data-tclose title="Plegar el panel (t)" aria-label="Plegar el panel">▴</button>
    </div>`;
  if (T.tab === 'dist') {
    box.innerHTML = head + '<div id="trendDist"></div>' + fuentePieHTML('panel-fuente');
    distLoad();
    return;
  }
  box.innerHTML = head + `
    <div class="trow" id="trendChips">${trendChipsHTML()}<span class="grow"></span>
      <label class="chk tchk" title="Trata «agrario» como «agrario*»: cuenta también agraria, agrarios…"><input type="checkbox" data-topt="variants"${T.variants ? ' checked' : ''}><span>variantes</span></label>
      <label class="chk tchk" title="Calcula la serie solo con las intervenciones que cumplen los filtros de la izquierda, incluida la biblioteca: menciones y palabras salen del mismo subconjunto"><input type="checkbox" data-topt="applyFilters"${T.applyFilters ? ' checked' : ''}><span>aplicar filtros</span></label>
      <label class="chk tchk" title="Hitos históricos del país, numerados sobre el gráfico (cada uno con su fuente)"><input type="checkbox" data-topt="milestones"${T.milestones ? ' checked' : ''}><span>hitos</span></label>
      ${T.milestones ? `<label class="tsel" title="Cuántos hitos se dibujan"><select data-tmslevel aria-label="Cuántos hitos se dibujan">${TREND_MS_LEVELS.map(([v, l, tit]) =>
        `<option value="${v}" title="${esc(tit)}"${String(T.msLevel) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
    </div>
    <div class="trow">
      <div class="tseg" role="group" aria-label="Periodo">${seg('trange', T.range, TREND_RANGES.map(r => [r.id, r.label, r.title]))}</div>
      <label class="tsel" title="Media móvil centrada: Σ menciones / Σ palabras de la ventana, sin cruzar los cortes de 3 o más meses sin sesiones">Suavizado
        <select data-tsmooth${T.gran === 'year' ? ' disabled' : ''}>${[[0, 'no'], [3, '3 meses'], [5, '5 meses']].map(([v, l]) =>
          `<option value="${v}"${T.smooth === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <span class="tstatus grow" id="trendStatus">${trendStatusHTML()}</span>
      <button type="button" class="btn sm" data-texport="csv" title="Tabla larga: un renglón por término y periodo, con metadatos">CSV</button>
      <button type="button" class="btn sm" data-texport="svg" title="Gráfico en SVG autónomo">SVG</button>
    </div>
    <div class="trend-chart" id="trendChart" tabindex="0" role="group" aria-roledescription="gráfico"></div>
    <div class="tfoot">${TREND_ICON.baja} fiabilidad baja · ${TREND_ICON.muy} muy baja (no fija la escala; ▲ si se sale) · ${TREND_ICON.receso} sin sesiones · ${TREND_ICON.corte} meses sin sesiones comprimidos · ← → recorren los meses · clic en un mes: sus intervenciones</div>
    <div id="trendMs"></div>
    ${fuentePieHTML('panel-fuente')}
    <div class="sr-only" aria-live="polite" id="trendLive"></div>`;
  trendRenderChart();
  if (escribiendo) {
    const el = box.querySelector(escribiendo.sel);
    if (el) { el.value = escribiendo.value; el.focus(); }
  }
}

function trendRenderChart() {
  const T = S.trend, box = $('#trendChart'), ms = $('#trendMs');
  if (!box) return;
  T.geom = null;
  if (ms) ms.innerHTML = '';
  if (!T.terms.length) {
    box.innerHTML = `<div class="tempty">Escriba uno o varios términos separados por comas (palabra, prefijo* o
      "frase"), o busque arriba: la tendencia toma las palabras de la búsqueda.</div>`;
    return;
  }
  if (!T.data) {
    box.innerHTML = `<div class="tempty">${T.error ? `⚠ ${esc(T.error)}` : '<span class="spin"></span> Contando menciones por mes…'}</div>`;
    return;
  }
  if (!(T.data.terms || []).some(t => t && t.ok)) {
    box.innerHTML = `<div class="tempty">Ningún término válido: pase el ratón por encima de los términos marcados con ⚠.</div>`;
    return;
  }
  const W = Math.max(320, Math.floor(box.clientWidth || 600));
  T.width = W;
  const { svg, geom } = trendDraw(W, trendPal());
  if (!geom) { box.innerHTML = `<div class="tempty">No hay periodos en este tramo.</div>`; return; }
  T.geom = geom;
  const b = geom.base, gran = b.gran === 'year' ? 'anual' : 'mensual';
  const nombres = geom.series.map(s => s.label).join(', ');
  box.setAttribute('aria-label', `Tendencia ${gran} de ${nombres}, ${TREND_METRICS[T.metric].unit}, de ${
    b.gran === 'year' ? geom.firstKey : mesLargo(geom.firstKey)} a ${b.gran === 'year' ? geom.lastKey : mesLargo(geom.lastKey)}. `
    + 'Use las flechas izquierda y derecha para recorrer los periodos e Intro para ver sus intervenciones.');
  box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${geom.H}" viewBox="0 0 ${W} ${geom.H}" aria-hidden="true">`
    + `${svg}<g class="tcross"></g></svg><div class="trend-tip" hidden></div>${T.loading ? '<span class="tload spin"></span>' : ''}`;
  if (ms && T.milestones) {
    const titulo = h => `${h.desc || h.label}${h.verificar ? ' (fecha pendiente de verificar)' : ''}`;
    const nIn = geom.msIn.length, nHid = geom.msHidden.length, nOut = geom.msOut.length;
    if (!(T.data.milestones || []).length) {
      ms.innerHTML = '<div class="tms-out">No hay hitos históricos registrados para este país.</div>';
    } else {
      // Leyenda plegable con altura acotada: el gráfico no cede espacio por muchos que sean los hitos.
      const abierta = T.msLegend == null ? nIn <= 12 : !!T.msLegend;
      const lista = geom.msIn.map(m => {
        const et = `${esc(m.h.label)} <span class="tms-d">${esc(fechaCorta(m.h.date))}</span>`;
        const enlace = /^https?:\/\//.test(m.h.fuente || '')
          ? `<a href="${esc(m.h.fuente)}" target="_blank" rel="noopener noreferrer">${et}</a>` : et;
        return `<li title="${esc(titulo(m.h))}" data-msn="${m.n}"><span class="tms-n${m.h.rank === 1 ? ' tms-p' : ''}">${m.n}</span>${enlace}</li>`;
      }).join('');
      const resumen = `${nf(nIn)} ${nIn === 1 ? 'hito numerado' : 'hitos numerados'} en el gráfico${geom.msTotal > nIn ? ` de ${nf(geom.msTotal)} del periodo` : ''}`
        + ' · pase el ratón por un número para ver el detalle, o abra su fuente desde esta lista';
      const ocultos = nHid ? `<div class="tms-out">${nf(nHid)} ${nHid === 1 ? 'hito más del periodo no se dibuja' : 'hitos más del periodo no se dibujan'}${
        T.msLevel === 'auto' ? ', porque sus números quedarían lejos de su fecha: elija «todos» si prefiere verlos apretados, o acote el periodo a una legislatura'
        : String(T.msLevel) === '3' ? ' porque no caben en el ancho disponible: acote el periodo a una legislatura o amplíe la ventana'
        : ' por el nivel elegido: elija «todos» o acote el periodo'}.</div>` : '';
      ms.innerHTML = (nIn ? `<details class="tms-wrap" data-tmslegend${abierta ? ' open' : ''}><summary>${resumen}</summary><ol class="tms-list">${lista}</ol></details>` : '')
        + ocultos
        + (nOut ? `<details class="tms-out"><summary>${nf(nOut)} ${nOut === 1 ? 'hito' : 'hitos'} fuera del periodo mostrado</summary>${
          geom.msOut.map(m => `<span title="${esc(titulo(m.h))}">${esc(m.h.label)} (${esc(fechaCorta(m.h.date))})</span>`).join(' · ')}</details>` : '');
    }
  }
  if (T.hover != null) trendHover(T.hover, T.hoverTerm);
}


function trendTipHTML(g, h, termK) {
  const T = S.trend, b = g.base, e = g.hov[h];
  const titulo = k => (b.gran === 'year' ? `Año ${k}` : mesLargo(k));
  if (e.kind === 'gap') {
    const n = e.it.n, u = b.gran === 'year' ? (n === 1 ? 'año' : 'años') : (n === 1 ? 'mes' : 'meses');
    return `<div class="tt-h">${esc(titulo(b.keys[e.it.i0]))} – ${esc(titulo(b.keys[e.it.i1]))}</div>`
      + `<div class="tt-dim">Sin sesiones (${nf(n)} ${u}, comprimidos en el eje)</div>`;
  }
  const i = e.i;
  if (b.empty[i]) return `<div class="tt-h">${esc(titulo(b.keys[i]))}</div><div class="tt-dim">Sin sesiones</div>`;
  const suav = b.gran === 'month' && T.smooth > 1;
  const filas = g.series.map(s => {
    const p = s.vals[i];
    const nombre = `<b>${esc(s.label)}</b>`;
    if (!p) return `<div class="tt-r" style="--c:${s.col}"><i></i><span>${nombre}: sin datos con estos filtros</span></div>`;
    const valor = suav
      ? `${fmtTrend(p.v, T.metric)} <span class="tt-dim">(suav. ${T.smooth} m; bruto ${fmtTrend(p.raw, T.metric)})</span>`
      : fmtTrend(p.raw, T.metric);
    return `<div class="tt-r" style="--c:${s.col}"><i></i><span>${nombre} ${valor}${s.k === termK ? ' ◂' : ''}`
      + `<br><span class="tt-dim">${nf(p.c)} menciones · ${nf(p.d)} interv.</span></span></div>`;
  }).join('');
  const rel = b.rel[i];
  const quien = termK != null ? `«${esc(g.series.find(s => s.k === termK)?.label || '')}»`
    : (g.series.length === 1 ? `«${esc(g.series[0].label)}»` : 'cualquiera de los términos');
  return `<div class="tt-h">${esc(titulo(b.keys[i]))} · <span class="${rel === 'normal' ? '' : 'tt-dim'}">${esc(TREND_REL[rel] || rel)}</span></div>`
    + filas
    + `<div class="tt-dim">${nf(b.tokens[i])} palabras · ${nf(b.speeches[i])} intervenciones · ${nf(b.sessions[i])} sesiones</div>`
    + (+b.tokens[i] > 0 ? `<div class="tt-go">Clic o Intro: intervenciones con ${quien} en ese ${b.gran === 'year' ? 'año' : 'mes'}</div>` : '');
}

function trendHover(h, termK = null, { announce = false } = {}) {
  const T = S.trend, g = T.geom, box = $('#trendChart');
  if (!g || !box) return;
  const cross = box.querySelector('.tcross'), tip = box.querySelector('.trend-tip');
  if (!cross || !tip) return;
  if (h == null || !g.hov[h]) { T.hover = null; T.hoverTerm = null; cross.innerHTML = ''; tip.hidden = true; return; }
  T.hover = h; T.hoverTerm = termK;
  const e = g.hov[h], pal = trendPal();
  let marca = '';
  if (e.kind === 'gap') {
    marca = `<rect x="${e.x0}" y="${g.plotT}" width="${Math.max(1, e.x1 - e.x0)}" height="${g.plotB - g.plotT}" fill="none" stroke="${pal.ink}" stroke-width="0.8" stroke-dasharray="2 2"/>`;
  } else {
    marca = `<line x1="${e.x}" x2="${e.x}" y1="${g.plotT}" y2="${g.plotB}" stroke="${pal.ink}" stroke-width="0.8"/>`;
    for (const s of g.series) {
      const pt = s.pts.find(p => p.i === e.i);
      if (pt) marca += `<circle cx="${pt.x}" cy="${pt.y}" r="${s.k === termK ? 4.6 : 3.4}" fill="${s.col}" stroke="${pal.bg}" stroke-width="1.5"/>`;
    }
  }
  cross.innerHTML = marca;
  tip.innerHTML = trendTipHTML(g, h, termK);
  tip.hidden = false;
  const svg = box.querySelector('svg');
  const escala = svg ? svg.getBoundingClientRect().width / g.W : 1;
  const ancho = tip.offsetWidth, cajaW = box.clientWidth;
  let left = e.x * escala + 14;
  if (left + ancho > cajaW) left = e.x * escala - ancho - 14;
  tip.style.left = `${Math.max(0, left)}px`;
  tip.style.top = `${Math.max(0, g.plotT * escala)}px`;
  if (announce) { const live = $('#trendLive'); if (live) live.textContent = tip.innerText.replace(/\s+/g, ' '); }
}

function trendPointer(e) {
  const T = S.trend, g = T.geom, box = $('#trendChart');
  const svg = box?.querySelector('svg');
  if (!g || !svg) return;
  const r = svg.getBoundingClientRect();
  const x = (e.clientX - r.left) * g.W / r.width, y = (e.clientY - r.top) * g.H / r.height;

  if (y < g.plotT - 2) {
    const m = g.msIn.find(mm => (mm.cx - x) ** 2 + (mm.cy - y) ** 2 <= 81);
    if (m) {
      trendHover(null);
      const tip = box.querySelector('.trend-tip');
      const fuente = (() => { try { return m.h.fuente ? new URL(m.h.fuente).hostname.replace(/^www\./, '') : ''; } catch (e) { return ''; } })();
      tip.innerHTML = `<div class="tt-h">${m.n}. ${esc(m.h.label)}</div><div class="tt-dim">${esc(fechaLarga(m.h.date))}${
          m.h.date_end ? ` – ${esc(fechaLarga(m.h.date_end))}` : ''}${m.h.kind ? ` · ${esc(TREND_KINDS[m.h.kind] || m.h.kind)}` : ''}</div>`
        + (m.h.desc ? `<div>${esc(m.h.desc)}</div>` : '')
        + (fuente ? `<div class="tt-dim">Fuente: ${esc(fuente)}</div>` : '')
        + (m.h.verificar ? '<div class="tt-dim">Fecha pendiente de verificar</div>' : '');
      tip.hidden = false;
      const esc2 = r.width / g.W;
      tip.style.left = `${Math.max(0, Math.min(m.cx * esc2 + 12, box.clientWidth - tip.offsetWidth))}px`;
      tip.style.top = `${(m.cy + 10) * esc2}px`;
      return;
    }
  }
  if (x < g.plotL - 6 || x > g.plotR + 6) { trendHover(null); return; }
  let h = g.hov.findIndex(it => x >= it.x0 && x < it.x1);
  if (h === -1) {
    let mejor = Infinity;
    g.hov.forEach((it, k) => { const dd = Math.abs(it.x - x); if (dd < mejor) { mejor = dd; h = k; } });
  }
  let termK = null;
  const it = g.hov[h];
  if (it && it.kind === 'slot') {




    const ds = [];
    for (const s of g.series) {
      const pt = s.pts.find(p => p.i === it.i);
      if (pt) ds.push([Math.abs(pt.y - y), s.k]);
    }
    ds.sort((a, b) => a[0] - b[0]);
    if (ds.length && ds[0][0] < 8 && y < g.plotB - 8 && !(ds[1] && ds[1][0] - ds[0][0] < 4)) termK = ds[0][1];
  }
  if (h !== T.hover || termK !== T.hoverTerm) trendHover(h, termK);
}




function periodFilter(d, members, meta) {
  const cm = d.corpus_months || {};
  const con = members.filter(i => (+cm.sessions?.[i] || 0) > 0 || (cm.speech_id_ranges?.[i] || []).length);
  if (!con.length) return null;
  if (con.every(i => cm.date_range_exact?.[i] && cm.corpus_date_min?.[i] && cm.corpus_date_max?.[i])) {
    return { date_from: con.map(i => cm.corpus_date_min[i]).sort()[0],
             date_to: con.map(i => cm.corpus_date_max[i]).sort().at(-1),
             period: { ...meta, kind: 'dates' } };
  }
  const ids = [];
  for (const i of con) for (const [a, b] of cm.speech_id_ranges?.[i] || []) for (let x = a; x <= b; x++) ids.push(x);
  return ids.length ? { speech_ids: ids, period: { ...meta, kind: 'ids' } } : null;
}



function trendPick(i, termK = null) {
  const T = S.trend, d = T.data, g = T.geom;
  if (!d || !g) return;
  const b = g.base;
  if (!(+b.tokens[i] > 0)) { toast(b.empty[i] ? 'En ese periodo no hubo sesiones.' : 'Sin intervenciones con estos filtros en ese periodo.'); return; }
  const validos = b.terms;
  const elegidos = termK != null ? validos.filter(t => t.k === termK) : validos;
  if (!elegidos.length) return;
  const consulta = [...new Set(elegidos.map(t => t.query || t.label))].join(' OR ');
  const key = b.keys[i];
  const meta = { key, gran: b.gran, label: b.gran === 'year' ? `año ${key}` : mesLargo(key) };
  const pf = periodFilter(d, b.members[i], meta);
  if (!pf) { toast('No se pudo delimitar ese periodo.', true); return; }



  const conservar = trendFilters();
  const otros = Object.keys(conservar).filter(k => !['date_from', 'date_to', 'speech_ids'].includes(k));
  if (S.view !== 'search') setView('search', { refresh: false });
  resetFiltersState();
  Object.assign(S.filters, conservar);
  delete S.filters.date_from; delete S.filters.date_to; delete S.filters.speech_ids;
  Object.assign(S.filters, pf);
  S.query = consulta; $('#q').value = consulta;
  S.variants = false; $('#variants').checked = false;
  setMode('keyword');
  T.seedQuery = consulta;
  renderFilters();
  search(true);
  if (!T.applyFilters && otros.length)
    toast('Se mantienen sus filtros: la lista puede tener menos intervenciones que la tendencia, que está calculada sobre todo el corpus («aplicar filtros» apagado).');
}

function trendActivate(h, termK) {
  const g = S.trend.geom;
  const e = g?.hov[h];
  if (!e) return;
  if (e.kind === 'gap') { toast('En ese tramo no hubo sesiones.'); return; }
  trendPick(e.i, termK);
}

function trendKey(e) {
  const T = S.trend, g = T.geom;
  if (!g || !g.hov.length) return;
  const ult = g.hov.length - 1;
  let h = T.hover;
  switch (e.key) {
    case 'ArrowRight': h = h == null ? 0 : Math.min(ult, h + 1); break;
    case 'ArrowLeft': h = h == null ? ult : Math.max(0, h - 1); break;
    case 'Home': h = 0; break;
    case 'End': h = ult; break;
    case 'Enter': case ' ':
      if (h != null) { e.preventDefault(); e.stopPropagation(); trendActivate(h, T.hoverTerm); }
      return;
    case 'Escape':
      if (h != null) { e.preventDefault(); e.stopPropagation(); trendHover(null); }
      return;
    default: return;
  }
  e.preventDefault(); e.stopPropagation();
  trendHover(h, null, { announce: true });
}

function trendSetTerms(terms) {
  const T = S.trend;
  const vistos = new Set(), out = [];
  for (const t of terms) {
    const k = foldMap(t).folded;
    if (t && !vistos.has(k)) { vistos.add(k); out.push(t); }
  }
  if (out.length > TREND_MAX) toast(`Como mucho ${TREND_MAX} términos: se quedan los ${TREND_MAX} primeros.`);
  T.terms = out.slice(0, TREND_MAX);
  T.editing = null;
  trendRender();
  trendLoad();
}

function trendCommitEdit(input, cancel = false) {
  const T = S.trend, k = +input.dataset.teditInput;
  if (T.editing !== k) return;
  if (cancel) { T.editing = null; trendRender(); return; }
  const nuevos = splitTerms(input.value);
  const terms = T.terms.slice();
  terms.splice(k, 1, ...nuevos);
  trendSetTerms(terms);
}


function toggleTrend(open) {
  const T = S.trend;
  const cambiaVista = S.view !== 'search';

  if (open === undefined) open = cambiaVista ? true : !T.open;
  if (cambiaVista) setView('search', { refresh: false });
  T.open = open;
  if (!open) {
    T.ctrl?.abort(); T.loading = false; ++T.seq;
    trendRender();
    return;
  }
  trendSyncTerms();
  trendRender();
  if (T.tab === 'trend') trendLoad();
  if (cambiaVista) search(true);
  else setTimeout(() => $('#trendAdd')?.matches(':placeholder-shown') && !T.terms.length && $('#trendAdd').focus(), 0);
}


function trendAfterSearch() {
  const T = S.trend;
  if (!T.open || S.view !== 'search') return;
  trendSyncTerms();
  trendRender();
  if (T.tab === 'trend') trendLoad();
}

function trendSlug() {
  const s = S.trend.terms.map(t => foldMap(t).folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean).join('_');
  return (s || 'terminos').slice(0, 48);
}









function fuenteDe() {
  const f = S.info?.fuente;
  if (f && f.cita && f.declarada) return f;


  const i = S.info || {};
  const st = i.standalone || {};
  const cita = `Diarios de sesiones · ${i.pais_nombre || 'país sin identificar'} · archivo ${st.archivo?.nombre || 'CSV'}`
    + `${i.n_speeches ? ` · ${nf(i.n_speeches)} intervenciones` : ''}${i.date_min ? ` (${i.date_min.slice(0, 4)}–${(i.date_max || '').slice(0, 4)})` : ''}`
    + '. Corpus de diarios de sesiones parlamentarios construido en este navegador a partir del CSV; cite la fuente original del conjunto de datos.';
  const corta = `Diarios de sesiones · ${i.pais_nombre || 'país sin identificar'} (${st.archivo?.nombre || 'CSV'})`;
  return { declarada: false, cita, cita_corta: corta,
           lineas: [`Fuente: ${corta}`, `Archivo: ${st.archivo?.nombre || ''}${st.archivo?.sha256 ? ` · SHA-256 ${st.archivo.sha256}` : ''}`, 'DOI: no declarado', 'Licencia de los datos: no declarada'],
           columnas: { fuente_cita: corta, fuente_doi: '' }, bibtex: `% ${corta}\n`, ris: `TY  - DATA\nN1  - ${corta}\nER  - \n` };
}





function wireCopiaConFuente() {
  document.addEventListener('copy', e => {
    const sel = window.getSelection?.();
    if (!e.clipboardData || !sel || sel.isCollapsed || !sel.rangeCount) return;
    const campo = el => el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
    const nodo = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
    if (campo(e.target) || campo(document.activeElement) || campo(nodo)) return;
    const texto = sel.toString();
    if (!texto.trim()) return;
    const F = fuenteDe();
    if (texto.includes(F.cita_corta) || texto.includes(F.cita) || (F.doi && texto.includes(F.doi))) return;
    const pie = `Fuente: ${F.cita_corta}`;
    const div = document.createElement('div');
    for (let i = 0; i < sel.rangeCount; i++) div.append(sel.getRangeAt(i).cloneContents());
    e.clipboardData.setData('text/plain', `${texto.replace(/\s+$/, '')}\n\n${pie}`);
    e.clipboardData.setData('text/html', `${div.innerHTML}<p>${esc(pie)}</p>`);
    e.preventDefault();
  });
}

const csvCampo = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };




function csvConFuente(meta, cols, filas) {
  const F = fuenteDe(), extra = Object.keys(F.columnas), vals = Object.values(F.columnas);
  return '\uFEFF' + [...F.lineas, ...meta].map(l => `# ${l}`).join('\r\n') + '\r\n'
    + [[...cols, ...extra], ...filas.map(r => [...r, ...vals])].map(x => x.map(csvCampo).join(';')).join('\r\n') + '\r\n';
}




async function copyText(text, hecho) {
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true; }
  } catch {   }
  if (!ok) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.readOnly = true;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    ($('dialog[open]') || document.body).append(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  toast(ok ? hecho : 'No se pudo copiar: seleccione el texto y cópielo con ⌘C / Ctrl+C.', !ok);
}

function copiarFuente(tipo) {
  const F = fuenteDe();
  const que = {
    cita: [F.cita, 'Cita copiada'],
    bibtex: [F.bibtex, 'Cita BibTeX copiada'],
    ris: [F.ris, 'Cita RIS copiada'],
    doi: [F.url || (F.doi ? `doi:${F.doi}` : F.cita), 'DOI copiado'],
  }[tipo];
  if (que) copyText(que[0], que[1]);
}




function fuenteHTML() {
  const F = fuenteDe();
  if (!F.declarada) return `<div class="fuente-box sin"><p class="fuente-aviso" role="note">${esc(F.cita)}</p></div>`;
  const rel = F.publicacion_relacionada || {};
  const relDoi = rel.doi ? `doi:${rel.doi}` : (rel.url || '');
  return `<div class="fuente-box">
    <p class="fuente-cita">${esc(F.cita)}</p>
    ${F.doi || F.url ? `<div class="fuente-dato"><span>DOI</span> <code class="fuente-sel">${esc(F.doi || F.url)}</code>${F.url ? ` · <code class="fuente-sel">${esc(F.url)}</code>` : ''}</div>` : ''}
    ${F.licencia ? `<div class="fuente-dato"><span>Licencia de los datos</span> ${esc(F.licencia)}${F.licencia_url ? ` · <code class="fuente-sel">${esc(F.licencia_url)}</code>` : ''}</div>` : ''}
    ${rel.titulo ? `<div class="fuente-dato"><span>Publicación relacionada</span> ${esc(rel.titulo)}${relDoi ? ` · <code class="fuente-sel">${esc(relDoi)}</code>` : ''}</div>` : ''}
    <div class="fuente-btns" role="group" aria-label="Copiar la cita">
      <button type="button" class="btn sm" data-copiar="cita" title="Copiar la cita completa en texto">Copiar cita</button>
      <button type="button" class="btn sm" data-copiar="bibtex" title="Copiar la cita en BibTeX">BibTeX</button>
      <button type="button" class="btn sm" data-copiar="ris" title="Copiar la cita en RIS (Zotero, EndNote, Mendeley)">RIS</button>
      <button type="button" class="btn sm" data-copiar="doi" title="Copiar el enlace del DOI">DOI</button>
    </div></div>`;
}




function fuentePieHTML(cls = 'panel-fuente') {
  return `<div class="${cls}">Fuente: ${esc(fuenteDe().cita_corta)}</div>`;
}

function downloadText(text, name, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();


  setTimeout(() => URL.revokeObjectURL(a.href), 120000);

  toast(`Elija dónde guardar ${name}`);
}

function trendMetaLines() {
  const T = S.trend, d = T.data, cal = d.calendar || {};
  const suav = T.gran === 'month' && T.smooth > 1;
  return [
    'Explorador de Diarios de Sesiones · tendencia de términos',
    `corpus: ${S.info?.title || S.info?.name || ''}`,
    `generado: ${new Date().toISOString().slice(0, 19)}`,
    `terminos: ${(d.terms || []).map(t => `${t.input}${t.ok ? ` [${t.type}; consulta ${t.query}]` : ` [error: ${t.message || t.error}]`}`).join(' | ')}`,
    `variantes: ${T.variants ? 'sí' : 'no'}`,
    `filtros: ${d.filtered ? JSON.stringify(trendFilters()) : 'ninguno (corpus completo)'}`,
    `resolucion: ${T.gran === 'year' ? 'anual' : 'mensual'}`,
    `suavizado: ${suav ? `${T.smooth} meses (ventana centrada; Σ menciones / Σ palabras; no cruza cortes de 3 o más meses sin sesiones)` : 'no'}`,
    `calendario: ${cal.from || ''} a ${cal.to || ''} · fuente de fechas: ${cal.date_source || 'corpus'}`,
    `fiabilidad: normal >= ${nf(d.thresholds?.normal ?? 100000)} palabras; baja >= ${nf(d.thresholds?.baja ?? 20000)}; muy_baja < ${nf(d.thresholds?.baja ?? 20000)}; sin_sesiones = periodo sin sesiones`,
    'por_10000_palabras = menciones / palabras * 10000; pct_intervenciones = intervenciones_con_termino / intervenciones * 100',
    'separador ; · decimales con punto · UTF-8',
  ];
}

function trendExportCSV() {
  const T = S.trend, d = T.data;
  if (!d) return toast('Aún no hay datos de tendencia.', true);
  const base = trendBase(d, T.gran);
  const seg = segmentsOf(base.empty);
  const sm = base.gran === 'month' && T.smooth > 1 ? T.smooth : 0;
  const dens = deriveSeries(base, { metric: 'density', smooth: sm, seg });
  const pct = deriveSeries(base, { metric: 'pct', smooth: sm, seg });
  const num = v => (v == null || !isFinite(v) ? '' : String(+v.toFixed(4)));
  const cols = ['periodo', 'termino', 'consulta', 'menciones', 'intervenciones_con_termino', 'palabras',
                'intervenciones', 'sesiones', 'por_10000_palabras', 'pct_intervenciones', 'fiabilidad'];
  if (sm) cols.push(`por_10000_palabras_suavizado_${sm}m`, `pct_intervenciones_suavizado_${sm}m`);
  const filas = [];
  base.terms.forEach((t, j) => {
    base.keys.forEach((key, i) => {
      const p = dens[j].pts[i], pp = pct[j].pts[i];
      const fila = [key, t.label, t.query, +t.counts[i] || 0, +t.docs[i] || 0, +base.tokens[i] || 0,
                    +base.speeches[i] || 0, +base.sessions[i] || 0, num(p?.raw), num(pp?.raw),
                    base.empty[i] ? 'sin_sesiones' : base.rel[i]];
      if (sm) fila.push(num(p?.v), num(pp?.v));
      filas.push(fila);
    });
  });

  const texto = csvConFuente(trendMetaLines(), cols, filas);
  downloadText(texto, `tendencia_${trendSlug()}_${base.gran === 'year' ? 'anual' : 'mensual'}.csv`, 'text/csv;charset=utf-8');
}

function trendExportSVG() {
  const T = S.trend, d = T.data;
  if (!d) return toast('Aún no hay datos de tendencia.', true);
  const pal = TREND_PAL.light, W = 1000;
  const { svg, geom } = trendDraw(W, pal, { forExport: true });
  if (!geom) return toast('No hay periodos que exportar.', true);
  const sans = 'Helvetica, Arial, sans-serif';
  const suav = geom.base.gran === 'month' && T.smooth > 1 ? `, suavizado ${T.smooth} meses` : '';
  const titulo = `Tendencia ${geom.base.gran === 'year' ? 'anual' : 'mensual'} · ${TREND_METRICS[T.metric].unit}${suav}`;
  const sub = `${d.filtered ? `Con filtros: ${nf(d.n_allowed)} intervenciones` : 'Corpus completo'} · ${nf(d.denominators?.tokens_total)} palabras · ${S.info?.title || S.info?.name || ''}`;
  const cab = 46;
  const o = [`<rect x="0" y="0" width="${W}" height="HALTO" fill="${pal.bg}"/>`,
    `<text x="14" y="20" font-size="14" font-weight="bold" fill="${pal.ink}">${esc(titulo)}</text>`,
    `<text x="14" y="37" font-size="11" fill="${pal.soft}">${esc(sub)}</text>`,
    `<g transform="translate(0 ${cab})">${svg}</g>`];
  let y = cab + geom.H + 18, x = 14;
  for (const s of geom.series) {
    const t = `${s.label} · ${nf(s.total)}`;
    const w = 22 + t.length * 6.4;
    if (x + w > W - 14) { x = 14; y += 17; }
    o.push(`<circle cx="${x + 5}" cy="${y - 4}" r="4.5" fill="${s.col}"/><text x="${x + 14}" y="${y}" font-size="11" fill="${pal.ink}">${esc(t)}</text>`);
    x += w + 10;
  }
  y += 8;
  if (geom.msIn.length) {
    const col = 3, ancho = (W - 28) / col;
    geom.msIn.forEach((m, k) => {
      const cx = 14 + (k % col) * ancho, cy = y + 16 + Math.floor(k / col) * 15;
      o.push(`<text x="${cx}" y="${cy}" font-size="10" fill="${pal.soft}">${m.n}. ${esc(m.h.label)} (${esc(fechaCorta(m.h.date))})</text>`);
    });
    y += 16 + Math.ceil(geom.msIn.length / col) * 15;
  }
  y += 12;
  const generado = new Date().toISOString().slice(0, 10);
  o.push(`<text x="14" y="${y}" font-size="9.5" fill="${pal.faint}">Círculo hueco: fiabilidad baja · punteado: muy baja (no fija la escala; ▲ si se sale) · rayado: sin sesiones · marcas de corte: meses sin sesiones comprimidos · generado ${esc(generado)}</text>`);

  const F = fuenteDe();
  const pie = `Fuente: ${F.cita_corta}` + (F.declarada && F.url ? ` · ${F.url}` : '')
    + (F.declarada && F.licencia ? ` · Licencia de los datos: ${F.licencia}` : '');
  const cabe = Math.floor((W - 28) / 5.6), renglones = [];
  for (const pal0 of pie.split(' ')) {
    const ult = renglones.length - 1;
    if (ult >= 0 && (renglones[ult] + ' ' + pal0).length <= cabe) renglones[ult] += ' ' + pal0;
    else renglones.push(pal0);
  }
  for (const r of renglones) {
    y += 15;
    o.push(`<text class="fuente" x="14" y="${y}" font-size="10.5" fill="${pal.soft}">${esc(r)}</text>`);
  }
  const alto = Math.ceil(y + 14);


  const dc = (tag, v) => (v ? `<dc:${tag}>${esc(v)}</dc:${tag}>` : '');
  const metadata = '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><rdf:Description rdf:about="">'
    + dc('title', titulo) + dc('description', sub) + dc('source', F.cita)
    + (F.autores || []).map(a => dc('creator', a.nombre)).join('')
    + dc('identifier', F.url || (F.doi ? `doi:${F.doi}` : ''))
    + dc('rights', F.licencia_texto || F.licencia || '') + dc('publisher', F.editor)
    + dc('date', generado) + dc('format', 'image/svg+xml') + dc('language', 'es')
    + '</rdf:Description></rdf:RDF></metadata>';
  const texto = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${alto}" viewBox="0 0 ${W} ${alto}" font-family="${sans}">`
    + `<title>${esc(titulo)}</title><desc>${esc([...F.lineas, ...trendMetaLines()].join('\n'))}</desc>` + metadata
    + o.join('').replace('HALTO', String(alto)) + '</svg>\n';
  downloadText(texto, `tendencia_${trendSlug()}_${geom.base.gran === 'year' ? 'anual' : 'mensual'}.svg`, 'image/svg+xml');
}

function wireTrend() {
  const P = $('#trendPanel');
  P.addEventListener('click', e => {
    const T = S.trend, t = e.target;
    const tab = t.closest('[data-ttab]');
    if (tab) { T.tab = tab.dataset.ttab; trendRender(); if (T.tab === 'trend') trendLoad(); return; }
    if (t.closest('[data-tclose]')) { toggleTrend(false); return; }
    const met = t.closest('[data-tmetric]');
    if (met) { T.metric = met.dataset.tmetric; trendRender(); return; }
    const gr = t.closest('[data-tgran]');
    if (gr) { T.gran = gr.dataset.tgran; T.hover = null; trendRender(); return; }
    const rg = t.closest('[data-trange]');
    if (rg) { T.range = rg.dataset.trange; T.hover = null; trendRender(); return; }
    const ex = t.closest('[data-texport]');
    if (ex) { if (ex.dataset.texport === 'csv') trendExportCSV(); else trendExportSVG(); return; }
    const del = t.closest('[data-tdel]');
    if (del) { const terms = S.trend.terms.slice(); terms.splice(+del.dataset.tdel, 1); trendSetTerms(terms); return; }
    const ed = t.closest('[data-tedit]');
    if (ed) {
      T.editing = +ed.dataset.tedit; trendRender();
      const inp = P.querySelector(`[data-tedit-input="${T.editing}"]`);
      if (inp) { inp.focus(); inp.select(); }
      return;
    }
    const spk = t.closest('[data-spk]');
    if (spk) { S.filters.rep_ids = [+spk.dataset.spk]; renderFilters(); search(true); return; }
    if (t.closest('#trendChart') && T.hover != null) trendActivate(T.hover, T.hoverTerm);
  });
  P.addEventListener('change', e => {
    const T = S.trend, t = e.target;
    if (t.dataset.topt) {
      T[t.dataset.topt] = t.checked;
      if (t.dataset.topt === 'milestones') { trendRender(); return; }
      trendRender(); trendLoad(); return;
    }
    if (t.matches('[data-tsmooth]')) { T.smooth = +t.value || 0; trendRender(); }
    if (t.matches('[data-tmslevel]')) { T.msLevel = t.value; trendRender(); }
  });
  P.addEventListener('toggle', e => {
    const t = e.target;
    if (t && t.matches && t.matches('[data-tmslegend]')) S.trend.msLegend = t.open;
  }, true);
  P.addEventListener('keydown', e => {
    const t = e.target;
    if (t.id === 'trendAdd') {
      const comillasAbiertas = (t.value.match(/"/g) || []).length % 2 === 1;
      if (e.key === 'Enter' || (e.key === ',' && !comillasAbiertas)) {
        e.preventDefault();
        const nuevos = splitTerms(t.value);
        if (!nuevos.length) return;
        t.value = '';
        trendSetTerms([...S.trend.terms, ...nuevos]);
        $('#trendAdd')?.focus();
      } else if (e.key === 'Backspace' && !t.value && S.trend.terms.length) {
        e.preventDefault();
        trendSetTerms(S.trend.terms.slice(0, -1));
        $('#trendAdd')?.focus();
      } else if (e.key === 'Escape') { e.stopPropagation(); t.blur(); }
      return;
    }
    if (t.matches('.tchip-edit')) {
      if (e.key === 'Enter') { e.preventDefault(); trendCommitEdit(t); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); trendCommitEdit(t, true); }
      return;
    }
    if (t.id === 'trendChart') trendKey(e);
  });
  P.addEventListener('focusout', e => {
    if (e.target.matches?.('.tchip-edit') && e.target.isConnected) trendCommitEdit(e.target);
    if (e.target.id === 'trendChart') trendHover(null);
  });
  P.addEventListener('pointermove', e => { if (e.target.closest('#trendChart')) trendPointer(e); });
  P.addEventListener('pointerleave', () => trendHover(null));
  $('#trendPanel').addEventListener('pointerout', e => {
    const c = $('#trendChart');
    if (c && e.target.closest?.('#trendChart') && !c.contains(e.relatedTarget)) trendHover(null);
  });

  let raf = 0;
  S.trend.ro = new ResizeObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const T = S.trend, c = $('#trendChart');
      if (!T.open || T.tab !== 'trend' || !c || !T.data) return;
      if (Math.abs(Math.max(320, Math.floor(c.clientWidth)) - T.width) >= 2) trendRenderChart();
    });
  });
  S.trend.ro.observe(P);

  $('#spectrum').addEventListener('click', e => {
    const b = e.target.closest('[data-ideo]');
    if (!b) return;
    const v = b.dataset.ideo, cur = S.filters.ideologies || [];
    if (cur.length === 1 && cur[0] === v) delete S.filters.ideologies;
    else S.filters.ideologies = [v];
    renderFilters(); search(true);
  });
}





const CONFIRMAR_DESDE = 20000;


function listaInfo() {
  const r = S.lastMeta || {};
  const n = +S.total || 0, sem = r.mode === 'semantic' && !!r.total_is_depth, universo = +r.universo || 0;


  return { n, sem, tope: sem && universo > n, universo, frag: +r.profundidad_fragmentos || 20000,
           proc:   ''  };
}
















function listaActual() {
  return { query: S.query, mode: S.mode, variants: S.variants,
           filters: JSON.parse(JSON.stringify(S.filters || {})), order: S.order   };
}

function fmtBytes(b) {
  b = +b || 0;
  if (b < 1e6) return `${nf(Math.max(1, Math.round(b / 1e3)))} KB`;
  if (b < 1e9) { const mb = b / 1e6; return `${(mb < 10 ? Math.round(mb * 10) / 10 : Math.round(mb)).toLocaleString('es-ES')} MB`; }
  return `${(Math.round(b / 1e8) / 10).toLocaleString('es-ES')} GB`;
}


function syncConfirm(pre) {
  const dlg = $(pre === 'add' ? '#dlgAdd' : '#dlgExport');
  if (dlg._busy) return;


  $(`#${pre}Confirm`).disabled = !!dlg._pending || (pre === 'add' && !(dlg._n > 0))
    || (!$(`#${pre}Big`).hidden && !$(`#${pre}BigOk`).checked);
}



function busyStart(dlg, btn, label) {
  dlg._busy = true;
  const t0 = performance.now(), orig = btn.textContent, st = { label };
  btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  dlg.querySelectorAll('[data-close]').forEach(b => { b.disabled = true; });
  const pinta = () => {
    const s = Math.floor((performance.now() - t0) / 1000);
    btn.textContent = s >= 2 ? `${st.label} ${s} s` : st.label;
  };
  pinta();
  const iv = setInterval(pinta, 500);
  return {
    set(l) { st.label = l; pinta(); },
    end() {
      clearInterval(iv); dlg._busy = false;
      btn.removeAttribute('aria-busy'); btn.textContent = orig;
      dlg.querySelectorAll('[data-close]').forEach(b => { b.disabled = false; });
    },
  };
}

function openAdd(ids, span) {
  const dlg = $('#dlgAdd');
  if (dlg._busy) return;
  dlg._ids = ids; dlg._span = span || null; dlg._lista = null;
  const seq = dlg._seq = (dlg._seq || 0) + 1;
  $('#addBigOk').checked = false;
  if (ids === 'ALL' && listaEspera) {

    dlg._pending = true; dlg._n = 0;
    $('#addSub').textContent = 'Calculando la lista de la búsqueda actual…';
    $('#addBig').hidden = true;
    esperaLista().then(() => {
      if (dlg._seq !== seq || !dlg.open || dlg._busy) return;
      dlg._pending = false; addCifra(dlg);
    });
  } else {
    dlg._pending = false; addCifra(dlg);
  }
  syncConfirm('add');

  const pre = S.collections.some(c => c.id === S.ultimaBiblioteca) ? S.ultimaBiblioteca
    : S.collections.length === 1 ? S.collections[0].id : null;
  $('#addList').innerHTML = S.collections.length
    ? S.collections.map(c => `<label class="chk"><input type="radio" name="colpick" value="${c.id}"${c.id === pre ? ' checked' : ''}>
        <span class="lbl">${esc(c.name)}</span><span class="n">${nf(c.n_items)}</span></label>`).join('')
    : `<p class="dsub">No tiene bibliotecas todavía: escriba un nombre abajo y se creará.</p>`;
  $('#newColName').value = ''; $('#addNote').value = ''; $('#addTags').value = '';
  dlg.showModal();
}


function addCifra(dlg) {
  const ids = dlg._ids;
  let n = Array.isArray(ids) ? ids.length : 0;
  if (ids === 'ALL') {
    const L = listaInfo();
    n = L.n;
    dlg._lista = listaActual();
    $('#addSub').textContent = !n ? 'La búsqueda actual no lista ninguna intervención.'





      : n === 1 ? `Se guardará la única intervención de la lista${L.proc ? ` (${L.proc})` : ''}.`
      : `Se guardarán las ${nf(n)} intervenciones de la lista${L.proc ? ` (${L.proc})` : ''}, en su mismo orden.`;
  } else {
    $('#addSub').textContent = `${nf(n)} ${n === 1 ? 'intervención' : 'intervenciones'}.`;
  }
  dlg._n = n;
  $('#addBigOk').checked = false;
  $('#addBig').hidden = n <= CONFIRMAR_DESDE;
  if (n > CONFIRMAR_DESDE) {
    $('#addBigTxt').textContent = `Son ${nf(n)} intervenciones. Guardarlas lleva unos segundos, pero el `
      + 'Léxico de una biblioteca tan grande puede tardar minutos la primera vez que lo abra.';
    $('#addBigLbl').textContent = `Sí, guardar las ${nf(n)}`;
  }
  syncConfirm('add');
}

async function doAdd() {
  const dlg = $('#dlgAdd'), btn = $('#addConfirm');
  if (dlg._busy || btn.disabled) return;
  const nuevo = $('#newColName').value.trim();
  let cid = $('input[name=colpick]:checked')?.value;
  if (!nuevo && !cid) return toast('Elija una biblioteca o escriba un nombre nuevo.', true);
  const n = dlg._n || 0;
  const busy = busyStart(dlg, btn, n > 1 ? `Guardando ${nf(n)}…` : 'Guardando…');
  try {
    if (nuevo) { cid = (await api('/collections', { method: 'POST', body: { name: nuevo } })).id; }

    const tags = $('#addTags').value.split(',').map(s => s.trim()).filter(Boolean);
    const body = { note: $('#addNote').value.trim(), tags };
    if (dlg._ids === 'ALL') Object.assign(body, {


      add_all_results: true, ...(dlg._lista || listaActual()) });
    else {
      body.speech_ids = dlg._ids;
      if (dlg._span) { body.char_start = dlg._span[0]; body.char_end = dlg._span[1]; }
    }
    const r = await api(`/collections/${cid}/items`, { method: 'POST', body });
    S.ultimaBiblioteca = +cid;
    S.statsCache = null;
    await refreshCollections();


    const visibles = new Set(S.results.map(x => x.id));
    const marcados = dlg._ids === 'ALL' ? (r.speech_ids || []).filter(id => visibles.has(id)) : dlg._ids;
    for (const id of marcados) {
      if ((S.membership[id] || []).includes(+cid)) continue;
      S.membership[id] = [...(S.membership[id] || []), +cid];

      if (S.current?.id === id && !(S.current.collections || []).includes(+cid))
        S.current.collections = [...(S.current.collections || []), +cid];
    }
    dlg.close();
    const g = r.guardadas ?? r.added, ya = r.ya_estaban ?? r.skipped, rc = r.recorte;
    toast(`${nf(g)} ${g === 1 ? 'guardada' : 'guardadas'} en «${r.collection.name}»`
      + (ya ? ` · ${nf(ya)} ${ya === 1 ? 'ya estaba' : 'ya estaban'}` : '')
      + (!rc ? '' : rc.motivo === 'significado'
        ? ` · las ${nf(rc.tomadas)} más parecidas de ${nf(rc.de)}`
        : ` · las ${nf(rc.tomadas)} primeras de ${nf(rc.de)}`));
    if (S.view === 'library') renderLibraryView(); else refreshHitMarkers();
  } catch (e) { toast(e.message, true); }
  finally { busy.end(); syncConfirm('add'); }
}


function expBody(dlg) {
  const body = { format: $('#expFormat').value, include_text: $('#expText').checked };
  if (dlg._lib) body.collection_id = dlg._lib;
  else Object.assign(body, dlg._lista || listaActual());
  return body;
}

function expSubTxt(dlg) {
  const n = dlg._n || 0, e = dlg._est && !dlg._est.error ? dlg._est : null;
  const interv = n === 1 ? 'intervención' : 'intervenciones';
  if (dlg._lib) return `Biblioteca «${S.collections.find(c => c.id === dlg._lib)?.name || ''}» · ${nf(n)} ${interv}.`;
  const L = listaInfo();

  if (!e && dlg._pending) return `Resultados de la búsqueda actual${L.proc ? `, ${L.proc}` : ''} · calculando…`;









  return `Resultados de la búsqueda actual${L.proc ? `, ${L.proc}` : ''} · ${nf(n)} ${interv} en el orden de la lista.`;
}



function openExport({ lib = null, format = null, alCerrar = null } = {}) {
  const dlg = $('#dlgExport');
  if (dlg._busy) return;
  const cidLib = lib ?? (S.view === 'library' && S.libSel != null ? S.libSel : null);
  const enLib = cidLib != null;

  if (!enLib && S.similarOf) return toast('Exportar trabaja sobre la búsqueda o una biblioteca: pulse Buscar para volver a la lista.', true);
  dlg._lib = enLib ? cidLib : null;



  dlg._lista = enLib ? null : listaActual();
  const col = enLib ? S.collections.find(c => c.id === dlg._lib) : null;
  dlg._n = col ? +col.n_items || 0 : (listaEspera ? 0 : +S.total || 0);
  dlg._est = null; dlg._pending = true;
  $('#expBigOk').checked = false;
  const fmtAntes = $('#expFormat').value;
  $('#expFormat').querySelector('option[value=bundle]').disabled = !enLib;
  if (!enLib && $('#expFormat').value === 'bundle') $('#expFormat').value = 'csv';
  if (format && format !== fmtAntes && !$(`#expFormat option[value="${format}"]`)?.disabled) {
    $('#expFormat').value = format;



    dlg.addEventListener('close', () => { $('#expFormat').value = fmtAntes; }, { once: true });
  }
  $('#expSub').textContent = expSubTxt(dlg);
  updateExpNote();
  if (alCerrar) dlg.addEventListener('close', () => setTimeout(alCerrar, 0), { once: true });
  dlg.showModal();

  const seq = dlg._seq = (dlg._seq || 0) + 1;
  api('/export/estimate', { method: 'POST', body: expBody(dlg) }).then(e => {
    if (dlg._seq !== seq || !dlg.open) return;
    dlg._est = e; dlg._n = +e.filas || 0; dlg._pending = false;
    $('#expSub').textContent = expSubTxt(dlg);
    updateExpNote();
  }).catch(async () => {
    if (dlg._seq !== seq) return;

    await esperaLista();
    if (dlg._seq !== seq || !dlg.open) return;
    dlg._est = { error: true }; dlg._pending = false;
    if (!dlg._lib) dlg._n = +S.total || 0;
    $('#expSub').textContent = expSubTxt(dlg);
    updateExpNote();
  });
}

function updateExpNote() {
  const notas = {
    csv: 'Separador «;» y codificación UTF-8 con BOM: Excel y Numbers en español lo abren con un doble clic. Las 4 primeras líneas (empiezan por #) son la cita; en R, read.csv2(skip = 4); en pandas, comment="#" o skiprows=4.',
    markdown: 'Un documento con el texto completo, las notas y las etiquetas, listo para leer o convertir a Word o PDF.',
    json: 'Estructura completa con metadatos, para reutilizar en Python o R.',
    citations: 'Una línea por intervención con diputado, sesión, fecha y legislatura.',
    bundle: 'Archivo intercambiable: un colega puede importarlo y obtener su misma biblioteca con notas y etiquetas.',
  };
  const fmt = $('#expFormat').value;
  $('#expNote').textContent = notas[fmt] || '';

  const donde = {
    csv: 'en las 4 líneas # del principio (cita completa, DOI, licencia y publicación relacionada) y en las columnas fuente_cita y fuente_doi de cada fila',
    markdown: 'en el encabezado YAML, en la sección «Fuente» del principio, en cada intervención y al pie',
    json: 'en meta.fuente (con BibTeX, RIS y CSL-JSON) y en fuente_cita y fuente_doi de cada registro',
    citations: 'en la cabecera, al final de cada referencia y, al pie, en BibTeX y RIS',
    bundle: 'en los metadatos del paquete y en fuente_cita y fuente_doi de cada item; se conserva al importarlo y al volver a exportarlo',
  };
  const F = fuenteDe();
  $('#expFuente').textContent = F.declarada
    ? `El archivo incluye la cita de la fuente (${F.cita_corta}) ${donde[fmt] || ''}.`
    : `${F.cita} El archivo incluye este aviso ${donde[fmt] || ''}.`;
  $('#expText').disabled = ['citations', 'bundle'].includes(fmt);


  const dlg = $('#dlgExport'), e = dlg._est;
  const sinTexto = ['citations', 'bundle'].includes(fmt) || !$('#expText').checked;
  const bytes = e && !e.error ? e.bytes_estimados?.[fmt]?.[sinTexto ? 'sin_texto' : 'con_texto'] : null;
  const tam = bytes != null ? `≈ ${fmtBytes(bytes)}` : '';
  $('#expSize').textContent = !e ? 'Calculando el tamaño del archivo…'
    : !tam ? ''
    : `Tamaño estimado: ${tam} (aproximado; ${['citations', 'bundle'].includes(fmt) ? 'este formato no lleva el texto'
      : sinTexto ? 'sin el texto completo' : 'con el texto completo'}).`;


  const n = dlg._n || 0, big = n > CONFIRMAR_DESDE;
  $('#expBig').hidden = !big;
  if (big) {
    $('#expBigTxt').textContent = `Son ${nf(n)} intervenciones: el archivo pesará `
      + (tam ? `${tam} (aproximado)` : 'bastante') + ' y prepararlo puede llevar unos segundos.';
    $('#expBigLbl').textContent = `Sí, exportar las ${nf(n)}`;
  }
  syncConfirm('exp');
}

async function doExport() {
  const dlg = $('#dlgExport'), btn = $('#expConfirm');
  if (dlg._busy || btn.disabled) return;
  const body = expBody(dlg), n = dlg._n || 0;
  const busy = busyStart(dlg, btn, n > 1 ? `Preparando ${nf(n)}…` : 'Preparando…');
  try {
    const r = await fetch('/api/export', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Falló la exportación');
    busy.set('Descargando…');
    const blob = await r.blob();
    const name = (r.headers.get('Content-Disposition') || '').match(/filename="(.+?)"/)?.[1] || 'export';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
    const filas = r.headers.get('X-Export-Filas'), motivo = r.headers.get('X-Export-Recorte-Motivo');
    const de = +r.headers.get('X-Export-Recorte-De') || 0;
    dlg.close();
    toast(`Elija dónde guardar ${name}` + (filas != null ? ` · ${nf(+filas)} ${+filas === 1 ? 'fila' : 'filas'}` : '')
      + (motivo && de ? (motivo === 'significado' ? ` · las más parecidas de ${nf(de)}` : ` · las primeras de ${nf(de)}`) : ''));
  } catch (e) { toast(e.message, true); }
  finally { busy.end(); syncConfirm('exp'); }
}

async function loadSaved() {
  try {
    const { searches } = await api('/searches');


    S.saved = new Map(searches.map(s => [s.id, s]));
    const box = $('#savedBox');
    if (!box) return;


    box.innerHTML = searches.length ? searches.map(s => `
      <div class="chk" style="justify-content:space-between">
        <span class="lbl" style="cursor:pointer;color:var(--accent-text)"
          data-runsearch="${esc(s.id)}" title="${esc(s.query
            + (s.biblioteca_borrada ? ' · su biblioteca se ha borrado: buscará en todo el corpus' : ''))}">${esc(s.name)}${
            s.biblioteca_borrada ? ' <span class="saved-gone">(biblioteca borrada)</span>' : ''}</span>
        <button class="btn ghost sm" data-delsearch="${s.id}">×</button>
      </div>`).join('')
      : `<p class="dsub" style="font-size:11px;margin:0">Ninguna todavía.</p>`;
  } catch {   }
}



function helpSearchModesHTML() {
































  return `<h4 style="margin:16px 0 6px;font-size:13px">Cómo buscar</h4>
  <p class="dsub" style="line-height:1.6">La búsqueda encuentra las palabras que escriba en los ${nf(S.info?.n_words || 0)} palabras
    del corpus abierto. Encima de la lista, «Se busca» muestra cómo se ha entendido la consulta.</p>
  <table class="help-sintaxis">
    <thead><tr><th scope="col">Escriba</th><th scope="col">Encuentra</th></tr></thead>
    <tbody>
      <tr><td><code>reforma</code></td><td>esa palabra (no «reformas» ni «reformar»)</td></tr>
      <tr><td><code>"voto femenino"</code></td><td>la frase exacta: esas palabras seguidas y en ese orden (valen también « » y “ ”)</td></tr>
      <tr><td><code>reforma + agraria</code></td><td>las dos palabras, en cualquier parte de la intervención; <code>reforma agraria</code>, sin signo, es lo mismo</td></tr>
      <tr><td><code>divorcio | matrimonio</code></td><td>cualquiera de las dos</td></tr>
      <tr><td><code>(reforma | ley) + agraria</code></td><td>paréntesis para agrupar; sin ellos, <code>+</code> se aplica antes que <code>|</code></td></tr>
    </tbody>
  </table>
  <p class="dsub" style="line-height:1.6">
    <b>Sin acentos ni mayúsculas:</b> <code>constitucion</code> encuentra «Constitución». Los signos de puntuación separan
    palabras: <code>art.26</code> busca la frase «art 26».<br>
    <b>Palabras muy frecuentes</b> (de, la, que, por…): se omiten cuando van unidas a otras con <code>+</code> o sin
    signo, y «Se busca» lo avisa. Entre comillas sí cuentan (<code>"de la guerra"</code>) y solas también se buscan.<br>
    <b>No se admiten</b> el asterisco (<code>agrar*</code>) ni la exclusión (<code>NOT</code>); <code>AND</code> y
    <code>OR</code> se escriben <code>+</code> y <code>|</code>. Para las variantes de una palabra, únalas:
    <code>agraria | agrario | agrarios</code>.
  </p>`;

}

function helpConjuntoTxt() {



  return '';

}

function helpTopeProfundidadHTML() {










  return '';

}

function helpAtajoModosHTML() {



  return '';

}

function helpOtrosCorpusHTML() {









  return '';

}

function helpErratasTxt() {





  return ` Si una búsqueda no da lo que espera, pruebe otras formas de la palabra unidas con
    <code>|</code>.`;

}

function helpHTML() {
  return `
  <h4 style="margin:0 0 6px;font-size:13px">Qué es este explorador</h4>
  <p class="dsub" style="line-height:1.6">
    El explorador de <b>ParlaIbero</b>, la colección de discursos parlamentarios de las cámaras bajas de
    América Latina, Portugal y España (Instituto de Iberoamérica, Universidad de Salamanca; proyecto
    PID2022-141706NB-C22). Se abre el CSV de intervenciones de un país, descargado de Harvard Dataverse
    (todos comparten el mismo formato), y se construye en el navegador una base de datos con búsqueda de
    texto completo. Nada sale de su equipo. Las bibliotecas que cree se guardan por país.</p>
  <h4 style="margin:16px 0 6px;font-size:13px">Cómo citar</h4>
  <p class="dsub" style="line-height:1.6">
    Cada país es un conjunto de datos con su propio DOI: cítelo siempre que use el corpus, una cifra, una
    tabla o un pasaje. La cita del país cargado, con sus botones para copiarla en texto, BibTeX o RIS:</p>
  ${fuenteHTML()}
  <p class="dsub" style="line-height:1.6">
    Todo lo que descarga la app lleva la referencia del corpus, en los datos y en los metadatos:
    <b>CSV</b>, cuatro líneas <code>#</code> al principio (cita completa, DOI, licencia y
    publicación relacionada) y columnas <code>fuente_cita</code> y <code>fuente_doi</code> en cada fila;
    <b>JSON</b>, <code>meta.fuente</code> (con BibTeX, RIS y CSL-JSON) y <code>fuente_cita</code> y
    <code>fuente_doi</code> en cada registro; <b>Markdown</b>, encabezado YAML, sección «Fuente», una
    línea en cada intervención y pie; <b>Referencias</b>, cabecera, final de cada línea y la cita en
    BibTeX y RIS; <b>.2replib</b>, en los metadatos del paquete y en cada item, que se conservan al
    importarlo y al reexportarlo. Los CSV de Tendencia y Léxico la llevan en sus líneas
    <code>#</code> (siempre cuatro de fuente) y en cada fila, y el SVG, en el pie visible y en sus
    metadatos. Los paneles de Tendencia, Distribución y Léxico muestran la fuente (el
    lector no la repite en cada discurso), y al copiar un pasaje con
    ⌘C / Ctrl+C se añade la cita breve. El DOI se puede seleccionar y copiar como texto.
  </p>
  ${helpSearchModesHTML()}
  <h4 style="margin:16px 0 6px;font-size:13px">Bibliotecas</h4>
  <p class="dsub" style="line-height:1.6">
    Un grupo curado de intervenciones, con nota y etiquetas propias. Se guardan en
    su ordenador, aparte del corpus, así que actualizar la base no borra su trabajo.
    Puede restringir una búsqueda a una biblioteca, exportarla a CSV o Markdown, y
    compartirla en un archivo <code>.2replib</code>.<br><br>
    <b>Borrar una biblioteca.</b> En <b>Mis bibliotecas</b>, ábrala y pulse <b>Borrar biblioteca</b>
    (junto a «Exportar biblioteca»), o pulse 🗑 en su fila de la lista. La app pide confirmación con el
    nombre y el número de intervenciones, y ofrece <b>exportarla antes a <code>.2replib</code></b> para
    conservar una copia con notas y etiquetas: el borrado <b>no se puede deshacer</b>. Las
    intervenciones siguen en el corpus; solo se pierde la selección. Si la búsqueda de Explorar estaba
    restringida a ella, se quita esa restricción y se vuelve a buscar. Las búsquedas guardadas que la
    usaban se conservan, marcadas «(biblioteca borrada)», y al lanzarlas buscan en todo el corpus.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">«Guardar todo» y Exportar</h4>
  <p class="dsub" style="line-height:1.6">
    Los dos toman la <b>lista completa</b> que está viendo, no solo lo cargado ni un tope fijo:
    el mismo conjunto${helpConjuntoTxt()} y el mismo orden. Una búsqueda
    por palabras con 12.756 resultados guarda o exporta las 12.756; la navegación sin texto de
    una legislatura entera, sus decenas de miles. El diálogo da la cifra exacta y, al exportar,
    un tamaño <i>aproximado</i> del archivo según el formato y si incluye el texto completo.<br><br>
    ${helpTopeProfundidadHTML()}Si pulsa «Guardar todo» o Exportar mientras una búsqueda nueva todavía se está calculando,
    el diálogo espera a que termine antes de dar la cifra y de dejarle confirmar.<br><br>
    Por encima de <b>20.000</b> intervenciones el diálogo avisa con la cifra y pide marcar
    «Sí, guardar las N» o «Sí, exportar las N» antes de continuar: guardar tarda segundos, pero
    el Léxico de una biblioteca tan grande puede tardar minutos la primera vez, y un CSV con el
    texto completo del corpus pesa cientos de MB.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">Tendencia y clima de sala</h4>
  <p class="dsub" style="line-height:1.6">
    <b>📈 Tendencia</b> (tecla <kbd>t</kbd>) abre encima de la lista la serie mensual de hasta
    8 términos: se siembran con las palabras de la búsqueda y se editan como etiquetas
    (separe varios con comas; frases entre comillas; <code>prefijo*</code>). Por defecto
    cuenta en todo el corpus; con <b>aplicar filtros</b> usa solo lo que dejan pasar los
    filtros, incluida la biblioteca. Métrica por 10.000 palabras, absoluta o % de
    intervenciones; vista por mes o por año y suavizado, sin volver a calcular.
    Los recesos van rayados y las rachas largas sin sesiones, comprimidas.
    Un clic en un mes (o <kbd>←</kbd> <kbd>→</kbd> e Intro) busca sus intervenciones con
    ese término. La pestaña <b>Distribución</b> muestra años, sexo, tipo de sesión, partidos y oradores.<br><br>
    <b>Qué es una palabra.</b> Menciones y denominadores salen del índice de búsqueda: una
    palabra es un <i>token</i> (letras o cifras seguidas, sin acentos ni mayúsculas; «S. S.»
    cuenta dos), así que los totales difieren algo del recuento de palabras de cada
    intervención. <b>Fiabilidad</b> de cada mes según las palabras pronunciadas: normal con
    100.000 o más; baja (punto hueco ○) entre 20.000 y 100.000; muy baja (◌) por debajo de
    20.000, que no fija la escala del eje y marca ▲ si se sale. Los meses débiles se marcan,
    no se ocultan: un pico en un mes con pocas sesiones puede deberse a una sola intervención.<br><br>
    Las insignias de cada resultado cuentan las acotaciones de la intervención completa:
    <span class="tag clima conflict">Rumores</span> tumulto,
    <span class="tag clima applause">Aplausos</span> ovación,
    <span class="tag clima order">Presidencia</span> llamadas al orden y
    <span class="tag clima">Risas</span> lo demás.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">El lector: pliego del Diario, § y acotaciones</h4>
  <p class="dsub" style="line-height:1.6">
    Cada intervención se lee como un pliego del Diario. <b>§ n</b>, en el margen, numera sus
    párrafos de prosa y sus tablas; la numeración depende solo del texto, así que sirve para
    citar. Cuando el original no separa párrafos, una intervención larga se reparte por
    frases (lo indica el § al pasar el ratón). Las <b>acotaciones</b> del acta van en bloque
    entre párrafos o en línea dentro de la frase, con un color por clase:<br>
    <span class="acot-inline applause">(Aplausos.)</span> verde: ovación, aplausos y aprobación ·
    <span class="acot-inline conflict">(Rumores.)</span> lacre: tumulto, rumores, protestas e
    interrupciones · <span class="acot-inline order">(El Sr. Presidente agita la campanilla.)</span>
    ámbar: la Presidencia (campanilla, llamadas al orden; nunca el Presidente del Consejo) ·
    <span class="acot-inline neutral">(Risas.)</span> gris: risas, interjecciones sueltas,
    asentimiento, pausas y gestos.<br>
    La crónica del acta va en cursiva y las votaciones, en columnas. La clasificación es
    automática: algún paréntesis puede quedar mal clasificado.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">Sesión corrida y careo</h4>
  <p class="dsub" style="line-height:1.6">
    <b>📖 Sesión corrida</b> (tecla <kbd>s</kbd>) muestra la sesión entera, con la intervención
    abierta enmarcada en oro. <b>🎯</b> vuelve a ella y el selector salta a cualquier orden;
    «Ver solo este» abre una intervención en el lector. La cabecera da la sesión, la fecha, la
    legislatura y el periodo de sesiones.<br><br>
    <b>⚔ Carear</b> (tecla <kbd>c</kbd>) pone la intervención junto a una réplica, en dos pliegos
    que se desplazan por separado. <b>Misma sesión</b> propone réplicas por alusión al apellido
    o al cargo, interrupciones transcritas, cercanía en el orden del debate y otro partido;
    <b>Mismo diputado</b>, intervenciones del mismo orador parecidas por vocabulario
    y alejadas en el tiempo, con el pasaje parecido en verde. Es una <b>heurística</b>: cada
    propuesta muestra sus motivos, pero no prueba que hubiera diálogo. <b>⇄</b> intercambia los
    pliegos, cada pliego se abre en el lector o en su sesión corrida, y «Volver al lector» (o
    <kbd>c</kbd>) sale del careo.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">Léxico de una biblioteca (keyness)</h4>
  <p class="dsub" style="line-height:1.6">
    En <b>Mis bibliotecas</b>, la pestaña <b>Léxico</b> compara el vocabulario de la biblioteca
    con el resto del corpus. Con <b>Solo discurso</b> (marcado por defecto) analiza únicamente la
    prosa de los oradores: excluye listas de votación, crónica del acta, acotaciones, tablas, notas
    y cabeceras de página, y la tabla indica cuántas palabras quedan fuera; desmárquelo para
    analizar las intervenciones completas. <b>TTR</b> es la proporción de términos distintos sobre palabras:
    baja al crecer la biblioteca, así que compare solo bibliotecas de tamaño parecido.
    <b>Keyness G²</b> (log-likelihood de Dunning) mide si un término aparece en la biblioteca
    más de lo esperable: solo se listan los de G² ≥ 10,83 (p &lt; 0,001) con al menos 5
    apariciones, sin palabras vacías. El <b>log-ratio</b> es el tamaño del efecto (cada punto
    duplica la frecuencia relativa): <i>Exclusivo</i> ≥ 6 o ausente del resto del corpus,
    <i>Muy distintivo</i> entre 3 y 6, <i>Significativo</i> por debajo de 3. Con miles de
    términos evaluados a la vez, fíjese más en el log-ratio que en el G². Un clic en un
    término lo busca en modo Palabras dentro de la biblioteca; <b>Exportar tabla</b> descarga
    el CSV.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">Atajos</h4>
  <p class="dsub" style="line-height:1.9">
    <kbd>/</kbd> ir al buscador · <kbd>↵</kbd> buscar · <kbd>Esc</kbd> cerrar el lector<br>
    <kbd>j</kbd> / <kbd>k</kbd> siguiente / anterior resultado · <kbd>↵</kbd> abrir el resultado<br>
    <kbd>a</kbd> guardar en una biblioteca${helpAtajoModosHTML()}<br>
    <kbd>t</kbd> abrir o plegar el panel de <b>Tendencia</b><br>
    <kbd>s</kbd> alternar el lector entre <b>Discurso</b> y <b>Sesión corrida</b> (toda la sesión seguida;
    🎯 vuelve a la intervención de referencia)<br>
    <kbd>c</kbd> abrir o cerrar el <b>Careo</b> de la intervención abierta<br>
    <kbd>f</kbd> plegar o desplegar el panel lateral (también con « en su cabecera y con la franja que queda al plegarlo)<br>
    <kbd>l</kbd> plegar o desplegar la lista de intervenciones mientras lee (también con « en su cabecera y » en la franja)<br>
    <kbd>r</kbd> volver al estado inicial (o el botón ↺ de la cabecera)
  </p>
  ${helpOtrosCorpusHTML()}
  <h4 style="margin:16px 0 6px;font-size:13px">Una advertencia sobre el texto</h4>
  <p class="dsub" style="line-height:1.6">
    El texto procede de la extracción automática de los diarios originales (PDF u OCR), así que
    puede contener errores de reconocimiento y de segmentación de oradores.${helpErratasTxt()} Muchas
    intervenciones son de trámite; filtre por longitud mínima para centrarse en los discursos. El
    <b>encabezado y sumario</b> de cada sesión (fila sin orador) se puede excluir con «Solo lo que se habla».
  </p>
  <p class="dsub" style="line-height:1.6">
    Cuando una fecha tiene varias sesiones (ordinaria, extraordinaria, solemne…), la ficha lo indica;
    el «n.º de orden en el corpus» de una sesión es correlativo dentro del archivo y no coincide con
    el número oficial de la sesión, que se muestra aparte cuando el CSV lo trae.
  </p>`;
}


{
  const helpHTMLEscritorio = helpHTML;
  helpHTML = () => {
    const h = helpHTMLEscritorio();
    return document.documentElement.dataset.estilo !== 'clasico' ? h.replace('(Rumores.)</span> lacre:', '(Rumores.)</span> teja:') : h;
  };
}










function resetFiltersState() {
  S.filters = {};
}

function resetAll() {
  const porDefecto = S.info && S.info.has_semantic ? 'hybrid' : 'keyword';
  S.query = ''; S.variants = false; S.order = 'relevance';
  resetFiltersState(); S.offset = 0; S.results = []; S.exhausted = false;
  S.selected = null; S.similarOf = null; S.libSel = null; S.membership = {};
  teardownSession(S.session);
  S.session = null; S.current = null; S.cursor = null; S.speechScroll = null;
  S.readMode = 'speech'; ++S.readSeq;
  S.careo.ctrl?.abort(); S.careo = careoState();
  S.libTab = 'items'; S.libInfo = null; S.lex.ctrl?.abort(); ++S.lex.seq;
  menAbortar(); MEN.cache.clear();

  $('#q').value = '';
  $('#variants').checked = false;
  $('#order').value = 'relevance';
  S.trend.ctrl?.abort();
  S.trend = Object.assign(trendState(), { ro: S.trend.ro, cache: S.trend.cache });
  S.statsCache = null;
  trendRender();
  $('#spectrum').hidden = true;
  $('#app').classList.add('no-reader');
  $('#app').classList.remove('wide-reader', 'session-mode', 'careo-mode');
  $('#reader').innerHTML = '';
  updateReadHead();

  setMode(porDefecto);
  if (S.view !== 'search') { setView('search', { refresh: false }); } else { renderFilters(); }
  search(true);
  $('#q').focus();
  toast('Vuelta al estado inicial');
}

function setMode(m) {
  S.mode = m;





  $$('.modes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
}

function wire() {
  $$('.modes button').forEach(b => b.onclick = () => {
    toExplore();
    setMode(b.dataset.mode);
    if (S.mode === 'semantic') S.order = 'relevance';
    search(true);
  });
  $('#go').onclick = () => {
    const q = $('#q').value.trim();






    S.query = q; toExplore(); search(true);
  };
  $('#q').onkeydown = e => { if (e.key === 'Enter') $('#go').click(); };
  $('#variants').onchange = e => { toExplore(); S.variants = e.target.checked; search(true); };
  $('#order').onchange = e => { toExplore(); S.order = e.target.value; search(true); };
  $('#statsBtn').onclick = () => toggleTrend();
  wireTrend();
  $('#exportBtn').onclick = () => openExport();


  $('#saveAllBtn').onclick = () => {


    if (!listaEspera && !S.total) return toast('No hay resultados que guardar.');
    openAdd(S.similarOf && !listaEspera ? S.results.map(r => r.id) : 'ALL');
  };
  $('#themeBtn').onclick = () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';


    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('tema', t); } catch (e) { void e; }




    if (S.trend.open && S.trend.tab === 'trend') trendRender();
  };
  $('#helpBtn').onclick = () => { $('#helpBody').innerHTML = helpHTML(); $('#dlgHelp').showModal(); };



  $('#settingsBtn').onclick = () => { const A = globalThis.R2 && globalThis.R2.ajustes; if (A) A.abrir(); };
  document.addEventListener('r2:ajustes', () => {
    if (S.trend.open && S.trend.tab === 'trend') trendRender();
    for (const c of $$('.r2-capital')) capitalIluminada(c);
  });

  $('#importLibFile').onchange = e => importLibraryFile(e.target.files?.[0]);


  $('#filters').addEventListener('click', e => {
    if (e.target.closest('#exportAllBtn')) { exportarTodas(); return; }
    if (e.target.closest('#usarAquiBtn')) {
      const P = globalThis.R2 && globalThis.R2.persistencia;
      if (P && typeof P.usarAqui === 'function') Promise.resolve(P.usarAqui()).catch(err => toast(err.message, true));
      return;
    }
    if (e.target.closest('#projLibBtn')) { proyectoDialogo(); return; }
    if (e.target.closest('#descargarDanadaBtn')) { almacenDescargarDanada(); return; }
    if (e.target.closest('#descartarDanadaBtn')) { almacenDescartarDanada(); return; }
  });


  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copiar]');
    if (b) copiarFuente(b.dataset.copiar);
  });
  wireCopiaConFuente();




  $('#corpusBtn').onclick = () => document.dispatchEvent(new CustomEvent('r2:sobre-corpus'));

  $('#closeRead').onclick = () => {
    if (S.readMode === 'session') leaveSession();
    if (S.readMode === 'careo') leaveCareo();
    S.readMode = 'speech'; ++S.readSeq;
    $('#app').classList.add('no-reader'); $('#app').classList.remove('wide-reader', 'session-mode', 'careo-mode');
    S.selected = null; S.current = null; updateReadHead(); refreshHitMarkers();
  };


  $('#wideBtn').onclick = () => $('#app').classList.toggle('wide-reader');


  $('#sideFold').onclick = () => { setSideCollapsed(true); $('#sideRail').focus({ preventScroll: true }); };
  $('#sideRail').onclick = () => { setSideCollapsed(false); $('#sideFold').focus({ preventScroll: true }); };
  $('#listFold').onclick = () => { setListCollapsed(true); $('#listRail').focus({ preventScroll: true }); };
  $('#listRail').onclick = () => { setListCollapsed(false); $('#listFold').focus({ preventScroll: true }); };

  new MutationObserver(updateListRail).observe($('#resultMeta'), { childList: true, subtree: true, characterData: true });
  $('#readModes').addEventListener('click', e => {
    const b = e.target.closest('[data-rmode]');
    if (b) setReadMode(b.dataset.rmode);
  });
  $('#sessRef').onclick = () => {
    const s = S.session;
    if (s?.outline && s.active) sessGoTo(s, s.byId.get(s.refId));
  };
  $('#sessJump').onchange = e => {
    const s = S.session;
    if (s?.outline && s.active) sessGoTo(s, +e.target.value);
  };

  let rafSel = 0;
  $('#reader').addEventListener('scroll', () => {
    if (rafSel || S.readMode !== 'session' || !S.session?.active) return;
    rafSel = requestAnimationFrame(() => {
      rafSel = 0;
      const sc = $('#reader'), box = sc.getBoundingClientRect();
      const el = document.elementFromPoint(box.left + box.width / 2, box.top + 48);
      const blk = el && sc.contains(el) ? el.closest('.sess-block') : null;
      const sel = $('#sessJump');
      if (blk && document.activeElement !== sel) sel.value = blk.dataset.idx;
    });
  }, { passive: true });


  let rafLectura = 0;
  $('#reader').addEventListener('scroll', () => {
    if (rafLectura || S.readMode !== 'session' || !S.session?.active) return;
    rafLectura = requestAnimationFrame(() => { rafLectura = 0; sessLecturaGuardar(S.session); });
  }, { passive: true });



  $('#careoBtn').onclick = toggleCareo;
  $('#careoBack').onclick = () => setReadMode('speech');
  $('#careoSwap').onclick = careoSwap;
  $('#careoPick').onchange = e => careoSetPick(+e.target.value);
  $('#careoModes').addEventListener('click', e => {
    const b = e.target.closest('[data-cmode]');
    if (b) careoSetMode(b.dataset.cmode);
  });

  $('#resultMeta').addEventListener('click', libTabClick);
  $('#resultMeta').addEventListener('change', lexSoloChange);
  $('#lexExportBtn').onclick = lexExportCSV;
  $('#hits').addEventListener('keydown', lexKey);
  $('#hits').addEventListener('change', cooChange);
  $('#hits').addEventListener('keydown', cooKey);
  $('#addBtn').onclick = () => {
    if (!S.selected) return toast('Abra primero una intervención.');
    const hit = S.results.find(r => r.id === S.selected);
    openAdd([S.selected], hit?.char_start != null ? [hit.char_start, hit.char_end] : null);
  };
  $('#addConfirm').onclick = doAdd;
  $('#expConfirm').onclick = doExport;

  $('#delLibBtn').onclick = () => { if (S.view === 'library' && S.libSel != null) openDelLib(S.libSel); };
  $('#delLibConfirm').onclick = doDelLib;
  $('#delLibExport').onclick = delLibExport;
  $('#expFormat').onchange = updateExpNote;
  $('#expText').onchange = updateExpNote;
  $('#addBigOk').onchange = () => syncConfirm('add');
  $('#expBigOk').onchange = () => syncConfirm('exp');

  for (const id of ['#dlgAdd', '#dlgExport', '#dlgDelLib'])
    $(id).addEventListener('cancel', e => { if (e.currentTarget._busy) e.preventDefault(); });
  $$('dialog [data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('#clearFilters').onclick = () => { toExplore(); resetFiltersState();   renderFilters(); search(true); };






  $('#resetBtn').onclick = resetAll;




  $('#q').addEventListener('search', () => {
    if ($('#q').value.trim() === '' && S.query !== '') {
      S.query = '';   toExplore(); search(true);
    }
  });
  $$('.tabs button').forEach(b => b.onclick = () => setView(b.dataset.view));

  $('#hits').addEventListener('click', async e => {
    if (lexClick(e)) return;
    if (cooClick(e)) return;
    if (e.target.closest('[data-libmore]')) { loadMoreLibItems(); return; }




    const rm = e.target.closest('[data-rm]');
    if (rm) {
      e.stopPropagation();
      try {
        await api(`/collections/${S.libSel}/items/remove`,
          { method: 'POST', body: { speech_ids: [+rm.dataset.rm] } });
        toast('Quitada de la biblioteca');
        await refreshCollections(); renderLibraryView();
      } catch (err) { toast(err.message, true); }
      return;
    }
    const nt = e.target.closest('[data-note]');
    if (nt) { e.stopPropagation(); editNote(+nt.dataset.note); return; }
    const spk = e.target.closest('[data-spk]');
    if (spk) {
      S.filters.rep_ids = [+spk.dataset.spk];
      renderFilters(); search(true); return;
    }
    const hit = e.target.closest('.hit');
    if (hit) openSpeech(+hit.dataset.id);
  });

  $('#reader').addEventListener('click', e => {
    if (careoClick(e)) return;
    const g = e.target.closest('[data-goto]');
    if (g) { openSpeech(+g.dataset.goto, { mode: 'speech' }); return; }
    if (e.target.closest('[data-session]')) { setReadMode('session'); return; }
    const solo = e.target.closest('[data-solo]');
    if (solo) { openSpeech(+solo.dataset.solo, { mode: 'speech' }); return; }

    const retry = e.target.closest('[data-sess-retry]');
    if (retry && S.session?.outline) { const i = +retry.dataset.sessRetry; sessEnsure(S.session, i, i); }
  });
  $('#reader').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.thread-row[role=button]');
    if (row) { e.preventDefault(); e.stopPropagation(); row.click(); }
  });

  $('#filters').addEventListener('click', e => {

    const dl = e.target.closest('[data-dellib]');
    if (dl) { openDelLib(+dl.dataset.dellib); return; }
    const rn = e.target.closest('[data-renlib]');
    if (rn) { renameLibrary(+rn.dataset.renlib); return; }
    const lib = e.target.closest('[data-lib]');
    if (lib) { loadLibraryItems(+lib.dataset.lib); return; }
    if (e.target.id === 'newLibBtn') { newLibrary(); return; }
    if (e.target.id === 'importLibBtn') { importLibrary(); return; }
    if (e.target.id === 'saveSearchBtn') { saveSearch(); return; }
    const mw = e.target.closest('[data-minw]');
    if (mw) {
      const v = mw.dataset.minw;
      if (v) S.filters.min_words = +v; else delete S.filters.min_words;
      renderFilters(); search(true); return;
    }
    const del = e.target.closest('[data-delsearch]');
    if (del) { api(`/searches/${del.dataset.delsearch}`, { method: 'DELETE' }).then(loadSaved); return; }
    const run = e.target.closest('[data-runsearch]');
    if (run) {
      const s = S.saved?.get(+run.dataset.runsearch);
      if (!s) return;
      const F = expandFilters(s.filters);


      const borrada = F.collection_id != null && F.collection_id !== ''
        && (s.biblioteca_borrada || !S.collections.some(c => c.id === +F.collection_id));
      if (borrada) delete F.collection_id;
      S.query = s.query; S.mode = s.mode; S.variants = !!s.variants; S.filters = F;
      $('#q').value = s.query; $('#variants').checked = S.variants; setMode(s.mode);

      renderFilters(); search(true);
      if (borrada) toast(`«${s.name}» estaba restringida a una biblioteca que ya no existe: se busca en todo el corpus, sin esa restricción.`, true);
    }
  });

  $('#filters').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.fkey) {
      const k = t.dataset.fkey;
      const val = k === 'rep_ids' ? +t.value : t.value;
      const cur = new Set((S.filters[k] || []).map(String));
      if (t.checked) cur.add(String(val)); else cur.delete(String(val));
      S.filters[k] = [...cur].map(v => (k === 'rep_ids' ? +v : v));
      if (!S.filters[k].length) delete S.filters[k];
      renderPills(); search(true); return;
    }
    if (t.id === 'fSinDocs') {
      if (t.checked) S.filters.exclude_docs = true; else delete S.filters.exclude_docs;
      renderPills(); search(true); return;
    }
    const map = { fDesde: 'date_from', fHasta: 'date_to', fMin: 'min_words',
                  fMax: 'max_words', fSesion: 'num_session', fLib: 'collection_id' };
    if (map[t.id]) {
      const k = map[t.id];
      const v = t.value.trim();

      if ((k === 'date_from' || k === 'date_to') && S.filters.period) {
        if (S.filters.period.kind === 'ids') delete S.filters.speech_ids;
        delete S.filters.period;
      }
      if (v === '') delete S.filters[k];
      else S.filters[k] = ['min_words', 'max_words', 'num_session', 'collection_id'].includes(k) ? +v : v;
      renderPills(); search(true);
    }
  });

  $('#filters').addEventListener('input', e => {
    if (!e.target.classList.contains('fsearch')) return;
    const id = e.target.dataset.grupo;
    const caja = $(`.fitems[data-grupo="${id}"]`);
    if (caja) caja.innerHTML = itemsHTML(id, e.target.value);
  });

  $('#activePills').addEventListener('click', e => {
    const b = e.target.closest('[data-pill]');
    if (!b) return;
    $('#activePills')._fns[+b.dataset.pill]();
    renderFilters(); search(true);
  });

  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); $('#q').focus(); $('#q').select(); return; }
    if (e.key === 'Escape' && !$('dialog[open]')) { $('#closeRead').click(); return; }
    if (typing || $('dialog[open]')) return;
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();


      let i = S.results.findIndex(r => r.id === S.selected);
      if (i === -1 && S.cursor != null) i = S.results.findIndex(r => r.id === S.cursor);
      const n = e.key === 'j' ? Math.min(i + 1, S.results.length - 1) : Math.max(i - 1, 0);
      const t = S.results[i === -1 ? 0 : n];
      if (t) { openSpeech(t.id); $(`.hit[data-id="${t.id}"]`)?.scrollIntoView({ block: 'nearest' }); }
    }






    if (e.key === 'Enter' && !S.selected && S.results.length && S.view !== 'library'
        && !e.target.closest?.('button, a[href], summary, [role="button"], [contenteditable="true"]')) {
      e.preventDefault();
      const t = S.results.find(r => r.id === S.cursor) || S.results[0];
      openSpeech(t.id); $(`.hit[data-id="${t.id}"]`)?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 's' && !e.metaKey && !e.ctrlKey && !e.altKey && S.selected) {
      e.preventDefault();
      setReadMode(S.readMode === 'session' ? 'speech' : 'session');
    }
    if (e.key === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleTrend(); }
    if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault(); setSideCollapsed(!$('#app').classList.contains('side-collapsed'));
    }
    if (e.key === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if ($('#app').classList.contains('no-reader')) toast('Abra una intervención para plegar la lista mientras lee');
      else setListCollapsed(!$('#app').classList.contains('list-collapsed'));
    }
    if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleCareo(); }


    const sinMod = !e.metaKey && !e.ctrlKey && !e.altKey;
    if (e.key === 'a' && sinMod && S.selected) $('#addBtn').click();
    if (sinMod && ['1', '2', '3'].includes(e.key)) $$('.modes button')[+e.key - 1]?.click();


    if (e.key === 'r' && sinMod) { e.preventDefault(); resetAll(); }
  });
}

/* Editor de los textos de la biblioteca (#dlgEdit): un nombre, una nota o las dos cosas.
   Sustituye a window.prompt, que da una sola línea —inservible para la nota de una biblioteca, que
   puede ser larga— y que, como window.confirm, puede no mostrarse en la ventana de pywebview: es el
   mismo motivo por el que borrar una biblioteca ya tiene su propio <dialog> (#dlgDelLib).
   Devuelve una promesa con {nombre, texto} o null si se cancela. Ctrl/Cmd+Intro guarda; Esc cancela.
   `nombre` y `texto` valen null cuando ese campo no se pide, y así se distingue «no se tocó» de «se
   dejó vacío»: vaciar la nota de una intervención es borrarla, y tiene que poder hacerse. */
function abrirEditor({ titulo, sub = '', nombre = null, nombreEtiqueta = 'Nombre', texto = null,
                       textoEtiqueta = 'Nota', guardar = 'Guardar', exigeNombre = false }) {
  const dlg = $('#dlgEdit');
  if (dlg.open) return Promise.resolve(null);
  const inNombre = $('#editNombre'), inTexto = $('#editTexto'), btn = $('#editGuardar');
  $('#editTitle').textContent = titulo;
  $('#editSub').textContent = sub;
  $('#editSub').hidden = !sub;
  $('#editNombreCampo').hidden = nombre === null;
  $('#editTextoCampo').hidden = texto === null;
  $('#editNombreLbl').textContent = nombreEtiqueta;
  $('#editTextoLbl').textContent = textoEtiqueta;
  inNombre.value = nombre || '';
  inTexto.value = texto || '';
  btn.textContent = guardar;
  $('#editPista').textContent = texto === null ? '' : 'Ctrl+Intro guarda';
  const valido = () => !exigeNombre || !!inNombre.value.trim();
  const revisar = () => { btn.disabled = !valido(); };
  revisar();
  const opener = document.activeElement;
  return new Promise((resolve) => {
    let hecho = false;
    const cerrar = (valor) => {
      if (hecho) return;
      hecho = true;
      inNombre.removeEventListener('input', revisar);
      dlg.removeEventListener('close', alCerrar);
      btn.removeEventListener('click', alGuardar);
      dlg.removeEventListener('keydown', alTeclado);
      if (dlg.open) dlg.close();
      if (opener && opener.isConnected) { try { opener.focus(); } catch { /* el botón ya no está */ } }
      resolve(valor);
    };
    const alGuardar = () => {
      if (!valido()) return;
      cerrar({ nombre: nombre === null ? null : inNombre.value.trim(),
               texto: texto === null ? null : inTexto.value });
    };
    const alCerrar = () => cerrar(null);            // Esc y el botón Cancelar
    const alTeclado = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); alGuardar(); }
      // en el campo de una sola línea, Intro guarda; en el área de texto hace falta el modificador
      else if (e.key === 'Enter' && e.target === inNombre) { e.preventDefault(); alGuardar(); }
    };
    inNombre.addEventListener('input', revisar);
    dlg.addEventListener('close', alCerrar);
    btn.addEventListener('click', alGuardar);
    dlg.addEventListener('keydown', alTeclado);
    dlg.showModal();
    (nombre !== null ? inNombre : inTexto).focus();
    if (nombre !== null) inNombre.select();
  });
}

async function newLibrary() {
  const r = await abrirEditor({ titulo: 'Nueva biblioteca', nombre: '', texto: '',
    textoEtiqueta: 'Nota (opcional)', guardar: 'Crear', exigeNombre: true,
    sub: 'La nota describe para qué es la biblioteca; se guarda con ella al exportarla.' });
  if (!r) return;
  try {
    const c = await api('/collections', { method: 'POST', body: { name: r.nombre, description: r.texto } });
    await refreshCollections(); S.libSel = c.id; renderLibraryView();
    toast(`Biblioteca «${c.name}» creada`);
  } catch (e) { toast(e.message, true); }
}





/* Editar el nombre y la nota de una biblioteca (PATCH /api/collections/{cid}), con los valores actuales puestos.
   El nombre sale en la ficha, en la cabecera de la biblioteca abierta, en el selector «Restringir a una biblioteca»
   y en sus píldoras, así que después se repinta lo que toque. Las búsquedas guardadas guardan el id, no el nombre:
   siguen valiendo. */
async function renameLibrary(cid) {
  const c = S.collections.find(x => x.id === cid);
  if (!c) return;
  const ed = await abrirEditor({ titulo: 'Editar la biblioteca', nombre: c.name, texto: c.description || '',
    textoEtiqueta: 'Nota', exigeNombre: true,
    sub: 'La nota se ve en la ficha de la biblioteca y viaja con ella al exportarla.' });
  if (!ed) return;
  const limpio = ed.nombre;
  if (limpio === c.name && ed.texto === (c.description || '')) return;   // nada que guardar
  try {
    const r = await api(`/collections/${cid}`, { method: 'PATCH', body: { name: limpio, description: ed.texto } });
    await refreshCollections();
    if (S.view === 'library') { renderLibList(); listHead(); if (S.libSel === cid) loadLibraryItems(cid); }
    else renderFilters();
    toast(limpio === c.name ? 'Nota de la biblioteca guardada' : `La biblioteca se llama ahora «${r.name}»`);
  } catch (e) { toast(e.message, true); }
}





function importLibrary() {
  const inp = $('#importLibFile');
  if (!inp || inp._busy) return;
  inp.value = '';
  inp.click();
}

async function importLibraryFile(file) {
  const inp = $('#importLibFile');
  if (!file || inp._busy) return;
  inp._busy = true;
  try {
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      toast('El archivo no es un .2replib válido (JSON)', true);
      return;
    }


    let hondo = 0;
    for (const pila = [[payload, 1]]; pila.length && hondo <= 64;) {
      const [v, n] = pila.pop();
      if (v && typeof v === 'object') { hondo = Math.max(hondo, n); for (const x of Object.values(v)) pila.push([x, n + 1]); }
    }
    if (hondo > 64) {
      toast('El archivo no es un .2replib válido: tiene demasiados niveles anidados.', true);
      return;
    }
    const r = await api('/import', { method: 'POST', body: { payload } });

    S.searchStale = true;
    const cols = (r.collections || [r.collection]).filter(Boolean);
    const n = +r.n_items || 0, interv = `${nf(n)} ${n === 1 ? 'intervención' : 'intervenciones'}`;
    await refreshCollections();

    if (cols.length) S.libSel = cols[0].id;
    if (S.view === 'library') await renderLibraryView(); else setView('library');
    toast(cols.length === 1 ? `Importada «${cols[0].name}» (${interv})` : `Importadas ${nf(cols.length)} bibliotecas (${interv})`);
    $('#importLibBtn')?.focus();
  } catch (e) {

    const pila = !e.status && (e instanceof RangeError || e.name === 'InternalError');
    toast(pila ? 'El archivo no es un .2replib válido: tiene demasiados niveles anidados.' : e.message, true);
  } finally {
    inp._busy = false;
    inp.value = '';
  }
}






function qexpPintar() {
  const box = $('#qexp');
  if (!box) return;
  const q = (S.query || '').trim();
  const Q = globalThis.R2 && globalThis.R2.query;
  let r = null;
  if (S.view === 'search' && q && Q && typeof Q.interpretar === 'function') {
    try { r = Q.interpretar(q); } catch (e) { r = { ok: false, error: { mensaje: e && e.message } }; }
  }
  if (!r || r.vacia) {
    box.hidden = true; box.textContent = ''; box.classList.remove('err');
    return;
  }
  const txt = x => (x == null ? '' : typeof x === 'string' ? x : x.mensaje || x.message || '');
  box.classList.toggle('err', !r.ok);
  if (!r.ok) {
    box.innerHTML = `No se puede buscar <code>${esc(q)}</code>: ${esc(txt(r.error) || 'la consulta no es válida.')}`;
  } else {
    box.innerHTML = `Se busca: <code>${esc(r.interpretacion || q)}</code> · sin acentos ni mayúsculas · las comillas buscan la frase exacta`
      + (r.avisos || []).map(txt).filter(Boolean).map(a => `<span class="qexp-aviso">⚠ ${esc(a)}</span>`).join('');
  }
  box.hidden = false;
}






let almacenUltimo = null, almacenErrorAvisado = null, almacenAvisoAnunciado = null;
document.addEventListener('r2:almacen', ev => {
  almacenUltimo = ev.detail || null;
  if (S.view === 'library') libStorePintar();
  almacenSenalar(almacenUltimo);


  if (almacenUltimo && almacenUltimo.recargada && S.info) almacenRecargar();
});





document.addEventListener('r2:corpus-reemplazado', () => { corpusRefrescar(); });
async function corpusRefrescar() {
  try {
    const info = await api('/info');
    if (!info.corpus) return;
    S.info = info.corpus;
    S.facets = await api('/facets');
    S.collections = (await api('/collections')).collections;
    exprRestaurar();
  } catch (e) {
    toast(e.message, true);
    return;
  }
  renderHeader();
  renderFilters();
  if (S.view === 'library') renderLibraryView();
  else search(true);
}






function almacenSenalar(e) {
  if (!e || !document.documentElement.classList.contains('r2-app')) return;
  const err = e.error || null;
  const tab = $('.tabs button[data-view="library"]');
  if (tab) {
    if (tab.dataset.tituloOriginal === undefined) tab.dataset.tituloOriginal = tab.title || '';
    const marca = tab.querySelector('.r2-marca');
    if (err && !marca) tab.insertAdjacentHTML('beforeend', '<span class="r2-marca" aria-hidden="true">⚠</span>');
    if (!err && marca) marca.remove();
    if (err) {
      tab.setAttribute('aria-label', 'Mis bibliotecas: hay un problema con el guardado de sus bibliotecas');
      tab.title = err;
    } else {
      tab.removeAttribute('aria-label');
      tab.title = tab.dataset.tituloOriginal;
    }
  }
  if (err && err !== almacenErrorAvisado) toast(err, true);
  almacenErrorAvisado = err;
  const av = e.aviso || {};
  const clave = `${av.tipo}|${av.texto}`;
  if (almacenAvisoAnunciado === null) { almacenAvisoAnunciado = clave; return; }
  if (clave === almacenAvisoAnunciado) return;
  almacenAvisoAnunciado = clave;
  const A = globalThis.R2 && globalThis.R2.anuncios;
  if (!err && av.tipo !== 'comprobando' && A && typeof A.anunciar === 'function') A.anunciar(av.texto, false);
}


function almacenDescargarDanada() {
  const P = globalThis.R2 && globalThis.R2.persistencia;
  const bytes = P && typeof P.copiaDanada === 'function' ? P.copiaDanada() : null;
  if (!bytes) { toast('No hay ninguna copia dañada que descargar', true); return; }
  const name = `diarios_bibliotecas_danadas_${new Date().toISOString().slice(0, 10)}.sqlite`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.sqlite3' })); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 120000);
  toast(`Elija dónde guardar ${name}`);
}

async function almacenDescartarDanada() {
  const P = globalThis.R2 && globalThis.R2.persistencia;
  if (!P || typeof P.descartarCopiaDanada !== 'function') return;
  if (!confirm('¿Descartar la copia dañada de sus bibliotecas? Se borrará de este navegador y empezará con bibliotecas vacías. Si quiere intentar recuperarla, descárguela antes.')) return;
  try {
    if (!(await P.descartarCopiaDanada())) {
      toast('Solo la pestaña que edita las bibliotecas puede descartar la copia dañada: pulse antes «Usar aquí».', true);
      return;
    }
    toast('Copia dañada descartada: sus bibliotecas empiezan vacías');
    await refreshCollections();
    if (S.view === 'library') renderLibraryView();
  } catch (err) {
    toast(err.message, true);
  }
}

async function almacenRecargar() {
  try {
    await refreshCollections();
  } catch (e) {
    return;
  }
  if (S.libSel != null && !S.collections.some(c => c.id === S.libSel)) { S.libSel = null; S.libInfo = null; }
  if (S.view === 'library') { renderLibraryView(); return; }
  loadSaved();
  const sel = $('#fLib');
  if (sel) {
    sel.innerHTML = '<option value="">— todo el corpus —</option>' + S.collections.map(c =>
      `<option value="${c.id}"${S.filters.collection_id == c.id ? ' selected' : ''}>${esc(c.name)} (${nf(c.n_items)})</option>`).join('');
  }
}

function almacenEstado() {
  const P = globalThis.R2 && globalThis.R2.persistencia;

  try { if (P && typeof P.estado === 'function') return P.estado() || almacenUltimo; } catch { return almacenUltimo; }
  return almacenUltimo;
}



function libStoreHTML(e) {
  const av = (e && e.aviso) || { tipo: 'comprobando', texto: 'Comprobando si este navegador puede guardar las bibliotecas…', acciones: [] };
  const alerta = ['memoria', 'solo_lectura', 'error', 'copia_danada', 'relevo'].includes(av.tipo);
  const acc = av.acciones || [];
  const hay = S.collections.length > 0;
  return `<div class="lib-store${alerta ? ' aviso' : ''}" id="libStore" data-tipo="${esc(av.tipo)}" role="group" aria-label="Dónde se guardan sus bibliotecas">`
    + `<span class="lib-store-t">${esc(av.texto)}</span><div class="lib-store-acc">`
    + `<button type="button" class="btn sm" id="exportAllBtn"${hay ? '' : ' disabled'}`
    + ` title="Descargar todas las bibliotecas y las búsquedas guardadas en un solo archivo .2replib">⤓ Exportar todas</button>`
    + (acc.includes('usar_aqui')
      ? '<button type="button" class="btn sm" id="usarAquiBtn" title="Editar las bibliotecas en esta pestaña">Usar aquí</button>' : '')
    + (acc.includes('descargar_danada')
      ? '<button type="button" class="btn sm" id="descargarDanadaBtn" title="Guardar en un archivo la copia dañada, por si se puede recuperar">⤓ Descargar la copia dañada</button>' : '')
    + (acc.includes('descartar_danada')
      ? '<button type="button" class="btn sm" id="descartarDanadaBtn" title="Borrar la copia dañada de este navegador y empezar con bibliotecas vacías (pide confirmación)">Descartar la copia dañada</button>' : '')
    + '</div></div>';
}



function libStorePintar() {
  if (S.view !== 'library') return;
  const cab = $('#newLibBtn')?.parentElement;
  if (!cab) return;
  const e = almacenEstado();
  $('#libStore')?.remove();
  cab.insertAdjacentHTML('afterend', libStoreHTML(e));
  for (const id of ['#newLibBtn', '#importLibBtn']) { const b = $(id); if (b) b.disabled = !!(e && e.solo_lectura); }
  proyectoPintar(cab, e);
}






function proyectoIndice() {
  const P = globalThis.R2 && R2.datos && R2.datos.bibliotecas_proyecto;
  if (!P || !Array.isArray(P.bibliotecas) || !P.bibliotecas.length || !S.info) return null;
  const sha = S.info.standalone && S.info.standalone.archivo && S.info.standalone.archivo.sha256;
  return (sha ? sha === P.csv_sha256 : S.info.name === P.corpus) ? P : null;
}

function proyectoPintar(cab, e) {
  $('#projLibBtn')?.remove();
  if (!proyectoIndice()) return;
  cab.insertAdjacentHTML('beforeend', `<button type="button" class="btn" id="projLibBtn" style="width:100%;margin-top:7px"${e && e.solo_lectura ? ' disabled' : ''}`
    + ' title="Elegir entre las bibliotecas preparadas con el proyecto: discursos principales, debates, sesiones y anécdotas">Añadir bibliotecas del proyecto…</button>');
}

const PROYECTO_GRUPOS = [['L1', 'Discursos'], ['L2', 'Debates'], ['L3', 'Sesiones'], ['L4', 'Anécdotas y amenazas']];

function proyectoDialogo() {
  const P = proyectoIndice();
  if (!P) return;
  let dlg = $('#dlgProyecto');
  if (!dlg) {
    document.body.insertAdjacentHTML('beforeend', `<dialog id="dlgProyecto" aria-labelledby="proyTitulo">
  <div class="dhead"><h3 id="proyTitulo">Bibliotecas del proyecto</h3>
    <p class="dsub">Preparadas con el corpus ${esc(P.corpus)}. Se añaden a sus bibliotecas con sus notas y etiquetas; después puede cambiarlas o borrarlas como cualquier otra.</p></div>
  <div class="dbody" id="proyLista"></div>
  <div class="dfoot"><button type="button" class="btn ghost" id="proyTodas">Marcar todas</button><span style="flex:1"></span>
    <button type="button" class="btn" data-close>Cancelar</button><button type="button" class="btn primary" id="proyAnadir">Añadir</button></div>
</dialog>`);
    dlg = $('#dlgProyecto');
    dlg.addEventListener('click', ev => {
      if (ev.target.closest('[data-close]')) { if (!$('#proyAnadir')._busy) dlg.close(); return; }
      if (ev.target.closest('#proyAnadir')) { proyectoAnadir(); return; }
      if (ev.target.closest('#proyTodas')) {
        const libres = [...dlg.querySelectorAll('input[data-clave]:not(:disabled)')];
        const todas = libres.every(i => i.checked);
        libres.forEach(i => { i.checked = !todas; });
        proyectoContar();
      }
    });
    dlg.addEventListener('change', proyectoContar);
    dlg.addEventListener('cancel', ev => { if ($('#proyAnadir')._busy) ev.preventDefault(); });
  }
  const ya = new Set(S.collections.map(c => c.name));
  $('#proyLista').innerHTML = PROYECTO_GRUPOS.map(([pref, titulo]) => {
    const libs = P.bibliotecas.filter(b => b.clave === pref || b.clave.startsWith(pref + '-'));
    if (!libs.length) return '';
    return `<p class="dsub" style="margin:10px 0 4px;font-weight:600">${esc(titulo)}</p>` + libs.map(b => {
      const esta = ya.has(b.nombre);
      return `<label class="fdoc" style="margin:0 0 7px"><input type="checkbox" data-clave="${esc(b.clave)}"${esta ? ' disabled' : ''}>`
        + `<span><b>${esc(b.nombre)}</b><small>${nf(b.n)} ${b.n === 1 ? 'intervención' : 'intervenciones'}`
        + `${esta ? ' · ya está en sus bibliotecas' : ''}</small></span></label>`;
    }).join('');
  }).join('');
  proyectoContar();
  dlg.showModal();
}

function proyectoContar() {
  const dlg = $('#dlgProyecto'), btn = $('#proyAnadir');
  if (!dlg || !btn || btn._busy) return;
  const n = dlg.querySelectorAll('input[data-clave]:checked').length;
  btn.disabled = !n;
  btn.textContent = n ? `Añadir ${nf(n)}` : 'Añadir';
  const libres = [...dlg.querySelectorAll('input[data-clave]:not(:disabled)')];
  const t = $('#proyTodas');
  t.disabled = !libres.length;
  t.textContent = libres.length && libres.every(i => i.checked) ? 'Desmarcar todas' : 'Marcar todas';
}

async function proyectoAnadir() {
  const dlg = $('#dlgProyecto'), btn = $('#proyAnadir');
  if (!dlg || !btn || btn._busy) return;
  const claves = [...dlg.querySelectorAll('input[data-clave]:checked')].map(i => i.dataset.clave);
  if (!claves.length) return;
  btn._busy = true;
  dlg.querySelectorAll('button, input').forEach(b => { b.disabled = true; });
  let hechas = 0, n = 0, fallo = null;
  try {

    const todo = JSON.parse(await R2.cargas.texto('bibliotecas'));
    const porClave = new Map((todo.paquetes || []).map(p => [p.generado && p.generado.biblioteca, p]));
    for (const clave of claves) {
      const payload = porClave.get(clave);
      if (!payload) throw new Error(`Falta la biblioteca ${clave} en este archivo`);
      btn.textContent = `Añadiendo ${nf(hechas + 1)} de ${nf(claves.length)}…`;
      const r = await api('/import', { method: 'POST', body: { payload } });

      const col = r.collection;
      if (col && col.name !== payload.collection.name) {
        await api(`/collections/${col.id}`, { method: 'PATCH', body: { name: payload.collection.name } });
      }
      hechas++; n += +r.n_items || 0;
    }
  } catch (e) {
    fallo = e;
  } finally {
    btn._busy = false;
    dlg.querySelectorAll('button, input').forEach(b => { b.disabled = false; });
    dlg.close();
  }
  S.searchStale = true;
  await refreshCollections();
  if (S.view === 'library') await renderLibraryView(); else setView('library');
  if (fallo) toast(`${hechas ? `Se añadieron ${nf(hechas)}; ` : ''}${fallo.message}`, true);
  else toast(`${hechas === 1 ? 'Añadida 1 biblioteca' : `Añadidas ${nf(hechas)} bibliotecas`} (${nf(n)} ${n === 1 ? 'intervención' : 'intervenciones'})`);
}




async function exportarTodas() {
  const btn = $('#exportAllBtn');
  if (!btn || btn._busy) return;
  btn._busy = true; btn.disabled = true;
  const rotulo = btn.textContent;
  btn.textContent = 'Preparando…';
  try {
    const r = await fetch('/api/collections/export-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudieron exportar las bibliotecas');
    const blob = await r.blob();
    const name = (r.headers.get('Content-Disposition') || '').match(/filename="(.+?)"/)?.[1] || 'bibliotecas.2replib';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
    toast(`Elija dónde guardar ${name}`);
    const P = globalThis.R2 && globalThis.R2.persistencia;
    if (P && typeof P.marcarExportado === 'function') Promise.resolve(P.marcarExportado()).catch(() => {});
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn._busy = false;
    if (btn.isConnected) { btn.textContent = rotulo; btn.disabled = false; }
  }
}





function compactFilters(F) {
  const f = JSON.parse(JSON.stringify(F || {}));
  if (f.period && typeof f.period === 'object' && Array.isArray(f.speech_ids)) {
    const ids = [...new Set(f.speech_ids.map(Number))].sort((a, b) => a - b);
    const rangos = [];
    for (const x of ids) {
      const u = rangos[rangos.length - 1];
      if (u && x === u[1] + 1) u[1] = x; else rangos.push([x, x]);
    }
    f.period.ranges = rangos;
    delete f.speech_ids;
  }
  return f;
}

function expandFilters(F) {
  const f = JSON.parse(JSON.stringify(F || {}));
  if (f.period && Array.isArray(f.period.ranges) && !Array.isArray(f.speech_ids)) {
    const ids = [];
    for (const [a, b] of f.period.ranges) for (let x = +a; x <= +b; x++) ids.push(x);
    if (ids.length) f.speech_ids = ids;
  }
  return f;
}

async function saveSearch() {
  const r = await abrirEditor({ titulo: 'Guardar la búsqueda', nombre: S.query || 'Búsqueda',
    exigeNombre: true, guardar: 'Guardar' });
  if (!r) return;
  try {
    await api('/searches', { method: 'POST',
      body: { name: r.nombre, mode: S.mode, query: S.query,
              filters: compactFilters(S.filters), variants: S.variants,
                } });
    loadSaved(); toast('Búsqueda guardada');
  } catch (e) { toast(e.message, true); }
}

async function editNote(sid) {
  const it = S.results.find(r => r.id === sid);
  const previa = it?.note || '';
  const quien = it ? `${it.rep_name || it.speaker || ''} · ${it.date || ''}`.trim() : '';
  const r = await abrirEditor({ titulo: previa ? 'Editar la nota' : 'Nota de la intervención',
    sub: quien, texto: previa, textoEtiqueta: 'Nota' });
  if (!r || r.texto === previa) return;
  try {
    await api(`/collections/${S.libSel}/items/${sid}`, { method: 'PATCH', body: { note: r.texto } });
    loadLibraryItems(S.libSel); toast(r.texto.trim() ? 'Nota guardada' : 'Nota borrada');
  } catch (e) { toast(e.message, true); }
}

boot();
//# sourceURL=2rep-standalone/app/static/js/app.js

'use strict';

/* Pestaña «Menciones» de una biblioteca: quién menciona a quién en sus intervenciones.
 *
 * Pide GET /collections/{cid}/mentions (worker/45_engine__menciones.js) y pinta el resumen, la red de menciones en
 * anillos, los más mencionados con sus citas, quién menciona, los diálogos, las co-menciones, las matrices entre
 * partidos y los focos de conversación (comunidades de Leiden).
 *
 * El dibujo de la red se rehace entero con cada render (el panel de la lista se repinta con innerHTML): menRender()
 * llama antes a MEN.limpiarRed() para soltar los oyentes de la ventana del dibujo anterior.
 */

const MEN = {
  cache: new Map(), data: null, cid: null, seq: 0, ctrl: null, limpiarRed: null,
  filtro: 'todas', elegida: null, agrupar: 'partido', sentido: 'todas', minimo: 1, resolucion: 1,
};
const MEN_RESOL = [[0.6, 'menos', 'Menos focos y más amplios (resolución 0,6)'], [1, 'normal', 'Resolución 1: la modularidad clásica'],
  [1.6, 'más', 'Más focos y más finos (resolución 1,6)']];
const MEN_PERSONAS = 25;   // filas de la tabla de más mencionados

const menEl = (id) => document.getElementById(id);
const menDec = (x, d = 3) => Number(x || 0).toFixed(d).replace('.', ',');
const menPct = (n, d) => (d > 0 ? Math.round(100 * n / d) : 0);
const menChip = (p) => (p ? `<span class="men-chip">${esc(p)}</span>` : '<span class="men-chip ext">externa</span>');

function menAbortar() {
  MEN.ctrl?.abort(); ++MEN.seq;
  if (MEN.limpiarRed) { MEN.limpiarRed(); MEN.limpiarRed = null; }
}

function menClave() {
  const L = S.libInfo;
  return [S.info?.name || '', L.id, L.total, L.hash || L.updated, MEN.resolucion].join('|');
}

function menSlug() {
  return foldMap(S.libInfo?.name || '').folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'biblioteca';
}

async function menLoad() {
  const L = S.libInfo, box = $('#hits');
  if (!L || S.view !== 'library' || S.libTab !== 'menciones') return;
  const key = menClave();
  menAbortar();
  const mine = ++MEN.seq;
  if (!L.total) {
    MEN.data = null; MEN.cid = L.id;
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Biblioteca vacía</h3>
      <p>Las menciones salen de las intervenciones guardadas. Añada algunas desde <b>Explorar</b>.</p></div>`;
    return;
  }
  if (MEN.cache.has(key)) { MEN.data = MEN.cache.get(key); MEN.cid = L.id; menRender(); return; }
  MEN.data = null; MEN.cid = null;
  const t0 = performance.now();
  box.innerHTML = `<div class="empty lex-prog" role="status" aria-live="polite">
    <p>Buscando menciones a personas en ${nf(L.total)} ${L.total === 1 ? 'intervención' : 'intervenciones'}…</p>
    <div class="bar" role="progressbar" aria-label="Progreso de las menciones" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
    <p class="lex-prog-fase">Preparando…</p>
    <p class="lex-prog-t dsub">0 % · 0 s</p>
    <p style="margin-top:10px"><button class="btn sm" data-mencancel>Cancelar</button></p>
    <p class="dsub" style="margin-top:8px;font-size:11.5px">Se leen también las demás intervenciones de esas sesiones: hacen falta para
      saber quién presidía y cómo llama la biblioteca a cada persona.</p></div>`;
  box.querySelector('[data-mencancel]').addEventListener('click', () => MEN.ctrl?.abort());
  let ultimoEv = null;
  const pinta = (ev) => {
    if (mine !== MEN.seq) return;
    const bar = box.querySelector('.lex-prog');
    if (!bar) return;
    if (ev) ultimoEv = ev;
    const e = ultimoEv, sg = (performance.now() - t0) / 1000;
    const pct = e ? Math.round(Math.max(0, Math.min(1, e.fraccion || 0)) * 100) : 0;
    bar.querySelector('.bar i').style.width = `${pct}%`;
    bar.querySelector('.bar').setAttribute('aria-valuenow', String(pct));
    if (e) bar.querySelector('.lex-prog-fase').textContent = `${e.indice}/${e.n_fases} · ${e.etiqueta}${e.total > 1 ? ` · ${nf(e.hecho)} de ${nf(e.total)}` : ''}`;
    const eta = e && e.fraccion > 0.08 && e.fraccion < 1 ? sg / e.fraccion - sg : null;
    bar.querySelector('.lex-prog-t').textContent = `${pct} % · ${Math.round(sg)} s${eta != null ? ` · quedan unos ${Math.max(1, Math.round(eta))} s` : ''}`;
  };
  const reloj = setInterval(() => pinta(null), 500);
  const ctrl = MEN.ctrl = new AbortController();
  const qs = new URLSearchParams({ resolucion: String(MEN.resolucion) });
  try {
    const r = await api(`/collections/${L.id}/mentions?${qs}`, { signal: ctrl.signal, alProgreso: pinta });
    clearInterval(reloj);
    if (mine !== MEN.seq || S.view !== 'library' || S.libSel !== L.id || S.libTab !== 'menciones') return;
    MEN.cache.set(key, r);
    if (MEN.cache.size > 5) MEN.cache.delete(MEN.cache.keys().next().value);
    MEN.data = r; MEN.cid = L.id;
    menRender();
  } catch (e) {
    clearInterval(reloj);
    if (mine !== MEN.seq) return;
    if (e.name === 'AbortError') {
      if (S.view === 'library' && S.libTab === 'menciones' && box.querySelector('.lex-prog')) {
        box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Cálculo cancelado</h3>
          <p>Puede volver a lanzarlo cuando quiera.</p><p style="margin-top:10px"><button class="btn sm" data-menretry>Buscar las menciones</button></p></div>`;
        box.querySelector('[data-menretry]').addEventListener('click', menLoad);
      }
      return;
    }
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>No se pudieron buscar las menciones</h3>
      <p>${esc(e.message)}</p><p style="margin-top:10px"><button class="btn sm" data-menretry>Reintentar</button></p></div>`;
    box.querySelector('[data-menretry]').addEventListener('click', menLoad);
  }
}

/* ---------------------------------------------------------------- textos */

function menNota(D) {
  const ext = D.resumen.externas;
  return `Personas nombradas en las intervenciones de la biblioteca: <b>miembros de la Cámara</b>, con su tratamiento o su cargo
    («señor diputado Pérez», «Presidenta Gómez») o, si la biblioteca ya los llama así, por su apellido solo, identificados con los
    nombres del corpus; y <b>personas externas</b>${ext ? ` (${nf(ext)} aquí)` : ''}, con su cargo («ministro Ruiz», «senador Díaz») o,
    ya identificadas, por su nombre («el Gobierno de Fulano»). Cada mención va de quien habla a quien nombra; entre miembros se
    distingue cuándo <b>se dirige</b> a él y cuándo <b>habla de</b> él. No mide el tono: dos oradores que mencionan a la misma
    persona pueden estar elogiándola o atacándola.`;
}

function menMetodo(D) {
  const R = D.resumen, T = R.deteccion || {}, intentos = (T.resueltas || 0) + (T.ambiguas || 0) + (T.sin_resolver || 0);
  const cargos = (T.cargos_sin_atribuir || []).map(([c, n]) => `${c} ${nf(n)}`).join(', ');
  const li = [
    `Menciones a miembros identificadas: ${nf(T.resueltas)} de ${nf(intentos)} (${menPct(T.resueltas, intentos)} %); quedan fuera
      ${nf(T.ambiguas)} ambiguas (casi siempre solo el nombre de pila) y ${nf(T.sin_resolver)} sin resolver. En la red,
      ${nf(T.se_dirige)} en las que se dirige a la persona y ${nf(T.habla_de)} en las que habla de ella.`,
    `Personas externas: ${nf(T.externas_cargo)} menciones con cargo y ${nf(T.externas_nombre)} por su nombre solo. Los jefes de Estado
      y de Gobierno salen del registro de hitos, desde el inicio de su mandato; antes, si tuvieron escaño, cuentan como miembros. Un
      cargo que no ocupa un miembro (senador, gobernador, alcalde, ministro) no se atribuye a un diputado salvo con el nombre completo.`,
    `Cuando un apellido lo comparten varios miembros se desempata por el sexo del tratamiento, por quien preside la sesión, por el
      cargo en el Gobierno de esa legislatura, por la actividad en el corpus y, al final, por cómo llama la biblioteca a cada uno. El
      apellido suelto solo cuenta si la biblioteca lo usa con tratamiento al menos tres veces.`,
    `Se excluyen los turnos de la Mesa (${nf(T.mesa)} menciones), el protocolo dirigido a la Presidencia (${nf(T.protocolo)}), las
      fórmulas de dar la palabra y el procedimiento (${nf(T.procedimiento)}), las automenciones (${nf(T.propias)}), las acotaciones
      entre paréntesis (${nf(T.acotaciones)})${T.subnacionales ? ` y los cargos subnacionales (${nf(T.subnacionales)})` : ''}.`,
    cargos ? `Cargos citados sin nombre, aún sin atribuir: ${esc(cargos)}. Harían falta tablas de quién ocupaba cada cargo en cada fecha.` : '',
    `Focos: algoritmo de Leiden sobre la red sin dirección (cada par suma las menciones en los dos sentidos), resolución
      ${menDec(D.opciones?.resolucion ?? MEN.resolucion, 1)}, semilla ${nf(D.opciones?.semilla ?? 1)}, modularidad ${menDec(R.modularidad)}.
      Coinciden poco con los partidos (información mutua normalizada ${menDec(R.nmi)}).`,
    `Precisión: revisada a mano en muestras de los dieciséis parlamentos, alrededor de nueve de cada diez menciones señalan a la
      persona correcta. El recuerdo no está medido: faltan las referencias indirectas («su señoría», «el relator», «el orador que
      me precedió»). Se leyeron ${nf(R.contexto)} intervenciones de las sesiones de la biblioteca como contexto y
      ${nf(R.oradores_corpus)} fichas de oradores del corpus.`,
  ];
  return li.filter(Boolean).map((t) => `<li>${t}</li>`).join('');
}

/* ---------------------------------------------------------------- render */

function menRender() {
  const D = MEN.data, L = S.libInfo, box = $('#hits');
  if (!D || !L || S.view !== 'library' || S.libTab !== 'menciones') return;
  if (MEN.limpiarRed) { MEN.limpiarRed(); MEN.limpiarRed = null; }
  listHead();
  const resol = `<span class="tsel">Focos</span><div class="tseg" role="group" aria-label="Número de focos">`
    + MEN_RESOL.map(([v, lab, tit]) => `<button type="button" data-menresol="${v}" aria-pressed="${v === MEN.resolucion}" title="${esc(tit)}">${lab}</button>`).join('')
    + `</div>`;
  if (D.disponible === false) {
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Sin menciones en este corpus</h3>
      <p>${esc(D.motivo || 'Este corpus no está en el registro de menciones.')}</p>
      <p class="dsub">Las formas de tratamiento («señor diputado», «congresista», «Sr. Deputado»…) están registradas para los
      dieciséis parlamentos de ParlaIbero; un CSV propio de otro país todavía no las tiene.</p></div>`;
    return;
  }
  const R = D.resumen;
  if (!D.personas.length) {
    box.innerHTML = `<div class="lex men"><div class="men-ctl">${resol}</div>
      <div class="empty" style="padding:26px 16px"><h3>Ninguna mención</h3>
      <p>No se ha reconocido ninguna mención a personas en las ${nf(R.intervenciones)} intervenciones de la biblioteca.</p></div></div>`;
    menCtlEventos(box.querySelector('.men'));
    return;
  }
  if (!D.personas.some((p) => p.k === MEN.elegida)) MEN.elegida = D.personas[0].k;

  const metrica = (k, v, s, tit) => `<div class="lex-metric"${tit ? ` title="${esc(tit)}"` : ''}>`
    + `<div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const saltadas = (R.intervenciones_biblioteca || R.intervenciones) - R.intervenciones;
  const metricas = `<div class="lex-metrics">
    ${metrica('Con menciones', nf(R.con_menciones), `${menPct(R.con_menciones, R.intervenciones)} % de ${nf(R.intervenciones)}${saltadas > 0 ? ' con discurso' : ''}`,
      `Intervenciones de la biblioteca en las que se menciona a alguien.${saltadas > 0
        ? ` Quedan fuera ${nf(saltadas)} de las ${nf(R.intervenciones_biblioteca)} guardadas: no son discurso (listas de votación, crónica del acta, tablas).` : ''}`)}
    ${metrica('Personas mencionadas', nf(R.mencionadas), `${nf(R.externas)} externas a la Cámara`)}
    ${metrica('Menciones', nf(R.menciones), `de ${nf(R.oradores)} oradores`)}
    ${metrica('Focos', nf(R.focos), `modularidad ${menDec(R.modularidad)}`, 'Comunidades de Leiden en la red de menciones')}</div>`;

  box.innerHTML = `<div class="lex men">
    <div class="men-ctl">
      <span class="tsel">Mostrar</span>
      <div class="tseg" id="menFiltro" role="group" aria-label="Qué personas mostrar">
        <button type="button" data-menf="todas" aria-pressed="${MEN.filtro === 'todas'}">Todas</button>
        <button type="button" data-menf="dip" aria-pressed="${MEN.filtro === 'dip'}">Miembros</button>
        <button type="button" data-menf="ext" aria-pressed="${MEN.filtro === 'ext'}">Externas</button>
      </div>
      ${resol}
      <span class="men-hueco"></span>
      <button type="button" class="btn sm" data-menexp="csv" title="Una fila por mención: quién habla, a quién menciona, cómo, la fecha y las palabras con las que la nombra">Menciones (CSV)</button>
      <button type="button" class="btn sm" data-menexp="gexf" title="La red dirigida para Gephi, con el partido y el foco de cada persona">Red (GEXF)</button>
    </div>
    ${metricas}
    <p class="lex-note">${menNota(D)}</p>
    <details class="men-metodo"><summary>Método y límites</summary><ul>${menMetodo(D)}</ul></details>

    <section aria-label="Red de menciones">
      <div class="men-cab">
        <div>
          <h3>Red de menciones</h3>
          <p class="men-sub" id="menExplica"></p>
        </div>
        <div class="men-ctl" style="margin:0">
          <span class="tsel">Agrupar</span>
          <div class="tseg" id="menAgrupar" role="group" aria-label="Sectores y colores de la red">
            <button type="button" data-meng="partido" aria-pressed="${MEN.agrupar === 'partido'}">Partido</button>
            <button type="button" data-meng="foco" aria-pressed="${MEN.agrupar === 'foco'}">Foco</button>
          </div>
          <span class="tsel">Menciones</span>
          <div class="tseg" id="menSentido" role="group" aria-label="Qué menciones muestra la red">
            <button type="button" data-mens="todas" aria-pressed="${MEN.sentido === 'todas'}">Todas</button>
            <button type="button" data-mens="hechas" aria-pressed="${MEN.sentido === 'hechas'}">Hechas</button>
            <button type="button" data-mens="recibidas" aria-pressed="${MEN.sentido === 'recibidas'}">Recibidas</button>
          </div>
          <button type="button" class="btn sm" id="menEgo" aria-pressed="false" disabled>Modo ego</button>
          <label class="tsel men-min" for="menMinimo" title="Deja solo las conexiones con al menos tantas menciones; con 1 se ve la red entera">Mínimo de menciones
            <input type="number" id="menMinimo" min="1" step="1" value="${MEN.minimo}" inputmode="numeric" autocomplete="off"></label>
          <div class="tseg" role="group" aria-label="Zoom">
            <button type="button" id="menZmas" aria-label="Acercar">+</button>
            <button type="button" id="menZmenos" aria-label="Alejar">−</button>
            <button type="button" id="menEncuadre">Encuadrar</button>
          </div>
        </div>
      </div>
      <div class="men-marco">
        <svg id="menRed" viewBox="0 0 1000 720" role="img" aria-label="Red de menciones: personas unidas por las menciones entre ellas, agrupadas por partido o por foco"></svg>
        <div class="men-tip" id="menTip" hidden></div>
        <div class="men-info" id="menInfo" aria-live="polite"></div>
      </div>
      <div class="men-leyenda" id="menLeyenda"></div>
    </section>

    <section aria-label="Más mencionados">
      <div class="men-dos">
        <div>
          <h3>Más mencionados</h3>
          <p class="men-sub">Por el número de oradores distintos que los mencionan. Pulse una persona para leer sus menciones.</p>
          <div class="men-envoltura"><table class="men-tabla" id="menPersonas"></table></div>
        </div>
        <aside class="men-panel" id="menPanel" aria-live="polite"></aside>
      </div>
    </section>

    <section class="men-dos" aria-label="Quién menciona y diálogos">
      <div>
        <h3>Quién menciona</h3>
        <p class="men-sub">Oradores ordenados por el número de personas distintas que mencionan.</p>
        <div class="men-envoltura"><table class="men-tabla" id="menMencionan"></table></div>
      </div>
      <div style="display:grid;gap:18px">
        <div>
          <h3>Diálogos</h3>
          <p class="men-sub">Pares de miembros que se mencionan en los dos sentidos (de A a B · de B a A).</p>
          <ul class="men-lista" id="menDialogos"></ul>
        </div>
        <div>
          <h3>Co-menciones</h3>
          <p class="men-sub">Personas mencionadas en la misma intervención.</p>
          <ul class="men-lista" id="menComenciones"></ul>
        </div>
      </div>
    </section>

    <section aria-label="Menciones entre partidos">
      <h3>Entre partidos</h3>
      <p class="men-sub">Menciones a miembros de la Cámara <b>por cada 10.000 palabras</b> del partido que habla, sin contar sus
        turnos de Mesa: así un partido que ocupa más tiempo no encabeza todas las filas. Filas: partido de quien habla; columnas:
        partido del mencionado. El tono es la parte de las menciones de la fila y el recuadro marca el propio partido; pase por
        encima de una casilla para ver las menciones, la tasa y las veces que pasa la media del cuadro.</p>
      <div class="men-envoltura"><table class="men-tabla men-matriz" id="menMatriz"></table></div>
    </section>

    <section aria-label="Personas externas por partido">
      <h3>Personas externas según el partido de quien habla</h3>
      <p class="men-sub">Menciones a las seis personas externas más citadas, también por cada 10.000 palabras del partido que habla.
        Muestra quién habla de quién, no si lo hace a favor o en contra.</p>
      <div class="men-envoltura"><table class="men-tabla men-matriz" id="menExternas"></table></div>
    </section>

    <section aria-label="Focos de conversación">
      <h3>Focos de conversación</h3>
      <p class="men-sub">Comunidades de Leiden en la red de menciones. Reúnen a quienes hablan de las mismas personas y a esas
        personas; <b>no son coaliciones</b>: un foco puede juntar a quienes defienden y a quienes atacan a alguien.</p>
      <div class="men-focos" id="menFocos"></div>
    </section>
  </div>`;

  menCtlEventos(box.querySelector('.men'));
  menPintarPersonas();
  menPintarTablas(D);
  menRedIniciar(D);
}

/** Controles de la cabecera: filtro, resolución y exportaciones (en el envoltorio, que se rehace con cada render). */
function menCtlEventos(caja) {
  caja.addEventListener('click', (e) => {
    const f = e.target.closest('[data-menf]');
    if (f) {
      MEN.filtro = f.dataset.menf;
      for (const x of menEl('menFiltro').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === f));
      menPintarPersonas();
      return;
    }
    const r = e.target.closest('[data-menresol]');
    if (r) { const v = Number(r.dataset.menresol); if (v !== MEN.resolucion) { MEN.resolucion = v; menLoad(); } return; }
    const x = e.target.closest('[data-menexp]');
    if (x) { if (x.dataset.menexp === 'csv') menExportCSV(); else menExportGEXF(); }
  });
}

/* ------------------------------------------------- más mencionados y panel */

function menPintarPersonas() {
  const D = MEN.data, t = menEl('menPersonas');
  if (!D || !t) return;
  const maxOr = Math.max(1, ...D.personas.map((p) => p.oradores));
  const filas = D.personas.filter((p) => MEN.filtro === 'todas' || (MEN.filtro === 'ext' ? p.ext : !p.ext)).slice(0, MEN_PERSONAS);
  if (!filas.some((p) => p.k === MEN.elegida) && filas.length) MEN.elegida = filas[0].k;
  t.innerHTML = `<thead><tr><th>Persona</th><th class="num">Oradores</th><th class="num">Menciones</th><th>Cómo</th>
      <th>Quién le menciona</th><th>Foco</th></tr></thead><tbody>`
    + filas.map((p) => {
      const como = p.ext ? '<span class="men-pp">—</span>' : `<span class="men-pp">se dirige ${menPct(p.voc, p.voc + p.ref)} %</span>`;
      return `<tr class="men-fila" tabindex="0" data-menk="${esc(p.k)}" aria-selected="${p.k === MEN.elegida}">
        <td><span class="men-quien">${esc(p.n)}</span>${menChip(p.p)}</td>
        <td class="num"><span class="men-barrita" style="width:${Math.max(3, Math.round(60 * p.oradores / maxOr))}px"></span>${nf(p.oradores)}</td>
        <td class="num">${nf(p.menciones)}</td>
        <td>${como}</td>
        <td><span class="men-pp">${p.porPartido.slice(0, 2).map(([q, n]) => `${esc(q)} ${n} %`).join(' · ')}</span></td>
        <td>${p.foco ? `<span class="men-foco-tag">F${p.foco}</span>` : ''}</td></tr>`;
    }).join('') + '</tbody>';
  if (!t.dataset.listo) {
    t.dataset.listo = '1';
    t.addEventListener('click', (e) => {
      const tr = e.target.closest('tr.men-fila');
      if (!tr) return;
      MEN.elegida = tr.dataset.menk; menPintarPersonas();
    });
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tr = e.target.closest('tr.men-fila');
      if (!tr) return;
      e.preventDefault(); e.stopPropagation();
      MEN.elegida = tr.dataset.menk; menPintarPersonas();
      menEl('menPersonas').querySelector(`tr.men-fila[data-menk="${CSS.escape(MEN.elegida)}"]`)?.focus();
    });
  }
  menPintarPanel();
}

function menPintarPanel() {
  const D = MEN.data, caja = menEl('menPanel');
  if (!D || !caja) return;
  const p = D.personas.find((x) => x.k === MEN.elegida);
  if (!p) { caja.innerHTML = ''; return; }
  caja.innerHTML = `<h3>Menciones de ${esc(p.n)}</h3>
    <p class="men-meta">${p.p ? esc(p.p) + ' · ' : 'Persona externa · '}${nf(p.oradores)} oradores · ${nf(p.menciones)} menciones${p.foco ? ` · foco F${p.foco}` : ''}</p>
    <ul class="men-citas">${p.contextos.map((c) => `<li>
      <div class="men-de"><b>${esc(c.o)}</b><span>${esc(c.op || '')}</span><span>${esc(c.f ? fechaCorta(c.f) : '')}</span><span class="men-tipo">${esc(c.t)}</span></div>
      <p data-menopen="${c.id}" role="button" tabindex="0" title="Abrir la intervención en el lector">…${esc(c.x[0])}<mark>${esc(c.x[1])}</mark>${esc(c.x[2])}…</p></li>`).join('')}</ul>`;
  if (caja.dataset.listo) return;
  caja.dataset.listo = '1';
  const abrir = (e) => {
    const el = e.target.closest('[data-menopen]');
    if (!el) return;
    if (e.type === 'keydown') { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); e.stopPropagation(); }
    openSpeech(+el.dataset.menopen, { mode: 'speech' });
  };
  caja.addEventListener('click', abrir);
  caja.addEventListener('keydown', abrir);
}

/* --------------------------------- quién menciona, diálogos, matrices, focos */

/** Ficha de las casillas de una matriz: el `title` del navegador tarda casi un segundo en salir, así que se pinta una
 *  propia, pegada al cursor y dentro del panel. La casilla bajo el cursor se marca con un recuadro. */
function menFichaTabla(tabla) {
  if (!tabla) return;
  const raiz = tabla.closest('.men');
  if (!raiz) return;
  let tip = raiz.querySelector('.men-tip-tabla');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'men-tip men-tip-tabla';
    tip.hidden = true;
    raiz.append(tip);
  }
  let bajo = null;
  const esconder = () => { tip.hidden = true; bajo?.classList.remove('men-bajo'); bajo = null; };
  tabla.addEventListener('pointermove', (e) => {
    const celda = e.target.closest?.('[data-tip]');
    if (!celda || !tabla.contains(celda)) { esconder(); return; }
    if (celda !== bajo) {
      bajo?.classList.remove('men-bajo');
      bajo = celda; bajo.classList.add('men-bajo');
      tip.innerHTML = celda.dataset.tip;
    }
    tip.hidden = false;
    const caja = raiz.getBoundingClientRect();
    const x = e.clientX - caja.left + 14, y = e.clientY - caja.top + 16;
    tip.style.left = `${Math.round(Math.max(4, Math.min(caja.width - tip.offsetWidth - 4, x)))}px`;
    tip.style.top = `${Math.round(y)}px`;
  });
  tabla.addEventListener('pointerleave', esconder);
}


function menPintarTablas(D) {
  const maxP = Math.max(1, ...D.mencionan.map((m) => m.personas));
  menEl('menMencionan').innerHTML = '<thead><tr><th>Orador</th><th class="num">Personas</th><th class="num">Menciones</th></tr></thead><tbody>'
    + D.mencionan.map((m) => `<tr><td><span class="men-quien">${esc(m.n)}</span>${menChip(m.p)}</td>
      <td class="num"><span class="men-barrita" style="width:${Math.max(3, Math.round(60 * m.personas / maxP))}px"></span>${nf(m.personas)}</td>
      <td class="num">${nf(m.menciones)}</td></tr>`).join('') + '</tbody>';

  menEl('menDialogos').innerHTML = D.dialogos.length
    ? D.dialogos.map((d) => `<li><span>${esc(d.a)} <span class="men-pp">${esc(d.ap || '')}</span> ⇄ ${esc(d.b)} <span class="men-pp">${esc(d.bp || '')}</span></span>
        <span class="num">${nf(d.ab)} · ${nf(d.ba)}</span></li>`).join('')
    : '<li><span class="men-pp">Ningún par se menciona en los dos sentidos.</span></li>';
  menEl('menComenciones').innerHTML = D.comenciones.length
    ? D.comenciones.map((c) => `<li><span>${esc(c.a)} + ${esc(c.b)}</span><span class="num">${nf(c.n)} intervenciones</span></li>`).join('')
    : '<li><span class="men-pp">Ninguna intervención menciona a dos personas.</span></li>';

  // Matrices en frecuencia relativa: menciones por cada diez mil palabras del partido que habla (sin sus turnos de
  // Mesa), para que el partido que más tiempo ocupa no encabece todas las filas. El tono sigue siendo la parte de la
  // fila y el detalle de cada casilla, con la cifra bruta y la media del cuadro, va en su título.
  const tono = (x) => `background:rgba(var(--men-heat),${(0.05 + 0.55 * (x || 0)).toFixed(3)})`;
  const POR = 10000;
  const tasa = (n, pal) => (pal > 0 ? POR * n / pal : null);
  const numTasa = (t) => (t == null ? '·' : t === 0 ? '0' : t.toFixed(t < 10 ? 1 : 0).replace('.', ','));
  const veces = (t, media) => (t == null || !media ? '' : ` · ${(t / media).toFixed(1).replace('.', ',')} veces la media del cuadro`);

  const M = D.matriz;
  const colM = M.partidos.map((_, j) => M.filas.reduce((s, f) => s + (f.celdas[j] || 0), 0));
  const palM = M.filas.reduce((s, f) => s + (f.palabras || 0), 0);
  menEl('menMatriz').innerHTML = `<thead><tr><th>De \\ a</th>${M.partidos.map((p) => `<th class="num">${esc(p)}</th>`).join('')}
      <th class="num">Propio</th><th class="num">Todas</th></tr></thead><tbody>`
    + M.filas.map((f, i) => `<tr><th class="men-fil" scope="row" data-tip="${esc(`<b>${esc(f.p)}</b>: ${nf(f.total)} menciones a miembros en ${nf(f.palabras)} palabras`)}">${esc(f.p)}</th>`
      + f.celdas.map((n, j) => {
        const t = tasa(n, f.palabras), media = tasa(colM[j], palM);
        const tit = `<b>${esc(f.p)} → ${esc(M.partidos[j])}</b>: ${nf(n)} ${n === 1 ? 'mención' : 'menciones'}`
          + (t == null ? '' : ` · ${numTasa(t)} por cada ${nf(POR)} palabras de ${esc(f.p)}${media ? ` (media del cuadro ${numTasa(media)})` : ''}${veces(t, media)}`);
        return `<td class="men-celda${i === j ? ' men-diag' : ''}" style="${tono(n / Math.max(1, f.total))}" data-tip="${esc(tit)}">${numTasa(t)}</td>`;
      }).join('')
      + `<td class="num" data-tip="${esc(`<b>${esc(f.p)}</b>: ${nf(f.celdas[i] || 0)} de sus ${nf(f.total)} menciones van a su propio partido`)}">${menPct(f.celdas[i] || 0, f.total)} %</td>`
      + `<td class="num" data-tip="${esc(`<b>${esc(f.p)}</b>: ${nf(f.total)} menciones a miembros en ${nf(f.palabras)} palabras`)}">${numTasa(tasa(f.total, f.palabras))}</td></tr>`).join('') + '</tbody>';

  const X = D.externas;
  const colX = X.personas.map((_, j) => X.filas.reduce((s, f) => s + (f.celdas[j] || 0), 0));
  const palX = X.filas.reduce((s, f) => s + (f.palabras || 0), 0);
  menEl('menExternas').innerHTML = `<thead><tr><th>Partido</th>${X.personas.map((p) => `<th class="num">${esc(p)}</th>`).join('')}</tr></thead><tbody>`
    + X.filas.map((f) => {
      const suma = f.celdas.reduce((a, b) => a + b, 0);
      return `<tr><th class="men-fil" scope="row" data-tip="${esc(`<b>${esc(f.p)}</b>: ${nf(f.palabras)} palabras en la biblioteca`)}">${esc(f.p)}</th>`
        + f.celdas.map((n, j) => {
          const t = tasa(n, f.palabras), media = tasa(colX[j], palX);
          const tit = `<b>${esc(f.p)} → ${esc(X.personas[j])}</b>: ${nf(n)} ${n === 1 ? 'mención' : 'menciones'}`
            + (t == null ? '' : ` · ${numTasa(t)} por cada ${nf(POR)} palabras de ${esc(f.p)}${media ? ` (media del cuadro ${numTasa(media)})` : ''}${veces(t, media)}`);
          return `<td class="men-celda" style="${tono(n / Math.max(1, suma))}" data-tip="${esc(tit)}">${numTasa(t)}</td>`;
        }).join('') + '</tr>';
    }).join('') + '</tbody>';

  menFichaTabla(menEl('menMatriz'));
  menFichaTabla(menEl('menExternas'));

  menEl('menFocos').innerHTML = D.focos.map((f) => `<article class="men-foco" style="--c:${f.id <= 8 ? `var(--men-f${f.id})` : 'var(--text-faint)'}">
      <h4>F${f.id} · ${f.centrales.slice(0, 3).map((c) => esc(c.n)).join(' · ')}</h4>
      <div class="men-meta">${nf(f.personas)} personas · ${nf(f.diputados)} miembros · ${nf(f.externas)} externas</div>
      <div class="men-comp">${f.partidos.map(([p, n]) => `${esc(p)} ${n} %`).join(' · ')}</div>
      <div class="men-nombres">${f.centrales.map((c) => `<span class="${c.p ? '' : 'ext'}" title="${c.p ? esc(c.p) : 'persona externa'}">${esc(c.n)}</span>`).join('')}</div>
    </article>`).join('');
}

/* ---------------------------------------------------------------- exportar */

function menMeta(D) {
  const L = S.libInfo, R = D.resumen, T = R.deteccion || {};
  return [
    'Explorador de Diarios de Sesiones · menciones a personas en las intervenciones de una biblioteca',
    `biblioteca: ${L?.name || ''} (${nf(R.intervenciones)} intervenciones; ${nf(R.contexto)} más leídas como contexto)`,
    `corpus: ${S.info?.title || S.info?.name || ''}`,
    `generado: ${new Date().toISOString().slice(0, 19)}`,
    `menciones: ${R.menciones} en ${R.con_menciones} intervenciones · ${R.mencionadas} personas mencionadas (${R.externas} externas) · ${R.oradores} oradores`,
    `identificación: ${T.resueltas} menciones a miembros resueltas, ${T.ambiguas} ambiguas y ${T.sin_resolver} sin resolver;`
      + ` excluidas las de la Mesa (${T.mesa}), el protocolo a la Presidencia (${T.protocolo}), el procedimiento (${T.procedimiento}) y las automenciones (${T.propias})`,
    `focos: Leiden sobre la red sin dirección, resolución ${D.opciones?.resolucion}, semilla ${D.opciones?.semilla}`
      + ` · modularidad ${R.modularidad} · ${R.focos} focos · información mutua normalizada con los partidos ${R.nmi}`,
  ];
}

function menExportCSV() {
  const D = MEN.data;
  if (!D || !(D.detalle || []).length) return toast('Aún no hay menciones que exportar.', true);
  const cols = ['id', 'fecha', 'orador', 'partido_orador', 'mencionado', 'partido_mencionado', 'externa', 'como', 'texto'];
  const filas = D.detalle.map((m) => [m.id, m.f, m.o, m.op, m.n, m.p, m.e, m.t, m.x]);
  downloadText(csvConFuente(menMeta(D), cols, filas), `menciones_${menSlug()}.csv`, 'text/csv;charset=utf-8');
}

function menExportGEXF() {
  const D = MEN.data;
  if (!D || !(D.red?.nodos || []).length) return toast('Aún no hay red que exportar.', true);
  const x = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const F = fuenteDe();
  const desc = menMeta(D).concat([`Fuente: ${F.cita || F.cita_corta || ''}${F.url ? ` · ${F.url}` : ''}`]).join('\n');
  const nodos = D.red.nodos.map((n, i) => `      <node id="${i}" label="${x(n.n)}"><attvalues>`
    + `<attvalue for="0" value="${x(n.p || 'externa')}"/><attvalue for="1" value="${n.ext ? 'sí' : 'no'}"/>`
    + `<attvalue for="2" value="${n.f || 0}"/><attvalue for="3" value="${n.or}"/><attvalue for="4" value="${n.men}"/>`
    + `<attvalue for="5" value="${n.emite}"/></attvalues></node>`).join('\n');
  let k = 0;
  const aristas = [];
  for (const [a, b, ab, ba] of D.red.aristas) {
    if (ab) aristas.push(`      <edge id="${k++}" source="${a}" target="${b}" weight="${ab}"/>`);
    if (ba) aristas.push(`      <edge id="${k++}" source="${b}" target="${a}" weight="${ba}"/>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://gexf.net/1.3" version="1.3">
  <meta lastmodifieddate="${new Date().toISOString().slice(0, 10)}">
    <creator>ParlaIbero · Explorador de Diarios de Sesiones</creator>
    <description>${x(desc)}</description>
  </meta>
  <graph defaultedgetype="directed" mode="static">
    <attributes class="node">
      <attribute id="0" title="partido" type="string"/>
      <attribute id="1" title="externa" type="string"/>
      <attribute id="2" title="foco" type="integer"/>
      <attribute id="3" title="oradores_que_la_mencionan" type="integer"/>
      <attribute id="4" title="menciones_recibidas" type="integer"/>
      <attribute id="5" title="personas_que_menciona" type="integer"/>
    </attributes>
    <nodes>
${nodos}
    </nodes>
    <edges>
${aristas.join('\n')}
    </edges>
  </graph>
</gexf>
`;
  downloadText(xml, `menciones_${menSlug()}.gexf`, 'application/gexf+xml');
}

'use strict';

/* Red de menciones en anillos (pestaña «Menciones» de la biblioteca; el marcado lo pone page/22_menciones.js).
 *
 * Una vista combina una agrupación (sectores por partido o por foco), un sentido y, en el modo ego, una persona en el centro:
 *   todas      todas las personas; anillo, con cuántas personas distintas está conectada en los dos sentidos;
 *   hechas     solo quienes mencionan a alguien; anillo y tamaño, a cuántas personas distintas menciona;
 *   recibidas  solo quienes son mencionadas; anillo y tamaño, cuántos oradores distintos la mencionan.
 * En el modo ego quedan la persona elegida y sus conexiones en ese sentido, y el anillo mide las menciones entre cada una
 * y ella. Las aristas se dibujan entre personas de la vista (en el modo ego, también las que hay entre sus conexiones);
 * los tamaños son los de la red entera. Los sectores van de más a menos peso desde las 12 en el sentido de las agujas del
 * reloj y, dentro de cada uno, de la persona más a la menos central.
 * El mínimo de menciones (1 por defecto) deja fuera las conexiones que no llegan a él y cada vista se calcula solo con las
 * que quedan: en «Todas», los pares que suman ese mínimo entre los dos sentidos; en «Hechas» y «Recibidas», las menciones
 * repetidas en un solo sentido. Quien se queda sin ninguna sale de la vista y los anillos cuentan solo esas conexiones.
 */

function menRedIniciar(D) {
  const RED = D.red, NS = 'http://www.w3.org/2000/svg', svg = menEl('menRed');
  if (!svg || !RED || !RED.nodos.length) return;
  const NN = RED.nodos.length, CX = 500, CY = 360;
  const radioDe = (valor) => 2 + 1.55 * Math.sqrt(valor);
  const mk = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
  const ady = RED.nodos.map(() => []);
  const vecinos = RED.nodos.map(() => new Set());
  RED.aristas.forEach(([a, b], q) => { ady[a].push(q); ady[b].push(q); vecinos[a].add(b); vecinos[b].add(a); });
  const centralidad = vecinos.map((s) => s.size);
  const hechas = new Float64Array(NN);                              // menciones que hace cada persona
  RED.aristas.forEach(([a, b, ab, ba]) => { hechas[a] += ab; hechas[b] += ba; });
  // Con un mínimo m: con cuántas personas suma m o más menciones, a cuántas menciona m o más veces y cuántas la
  // mencionan así. Se calcula la primera vez que se usa cada mínimo y se guarda.
  const CUENTAS = new Map();
  function cuentasDe(m) {
    if (CUENTAS.has(m)) return CUENTAS.get(m);
    const vec = new Int32Array(NN), sal = new Int32Array(NN), ent = new Int32Array(NN);
    RED.aristas.forEach(([a, b, ab, ba]) => {
      if (ab + ba >= m) { vec[a]++; vec[b]++; }
      if (ab >= m) { sal[a]++; ent[b]++; }
      if (ba >= m) { sal[b]++; ent[a]++; }
    });
    const c = { vec, sal, ent };
    CUENTAS.set(m, c);
    return c;
  }
  const MAX_MINIMO = Math.max(1, ...RED.aristas.map(([, , ab, ba]) => ab + ba));   // más allá no queda ninguna conexión
  /** Si la arista q llega al mínimo m de menciones en el sentido `sen`. */
  const llega = (sen, q, m) => { const [, , ab, ba] = RED.aristas[q]; return sen === 'todas' ? ab + ba >= m : Math.max(ab, ba) >= m; };
  const SENTIDOS = {
    todas: { entra: () => true, medida: (i) => centralidad[i], tam: (i) => RED.nodos[i].or, peso: (i) => RED.nodos[i].men, titulo: 'conexiones distintas',
      filtro: (m) => ({ medida: (i) => cuentasDe(m).vec[i], titulo: `conexiones distintas de ${m} o más menciones` }) },
    hechas: { entra: (i) => RED.nodos[i].emite > 0, medida: (i) => RED.nodos[i].emite, tam: (i) => RED.nodos[i].emite, peso: (i) => hechas[i], titulo: 'personas distintas a las que menciona',
      filtro: (m) => ({ medida: (i) => cuentasDe(m).sal[i], titulo: `personas distintas a las que menciona ${m} o más veces` }) },
    recibidas: { entra: (i) => RED.nodos[i].or > 0, medida: (i) => RED.nodos[i].or, tam: (i) => RED.nodos[i].or, peso: (i) => RED.nodos[i].men, titulo: 'oradores distintos que la mencionan',
      filtro: (m) => ({ medida: (i) => cuentasDe(m).ent[i], titulo: `oradores distintos que la mencionan ${m} o más veces` }) },
  };

  // Agrupaciones: sectores, nombres y colores (los colores de partido, fijos: los ocho partidos más mencionados)
  const pesoPartido = new Map();
  RED.nodos.forEach((nd) => { if (!nd.ext) pesoPartido.set(nd.p, (pesoPartido.get(nd.p) || 0) + nd.men); });
  const PARTIDOS = [...pesoPartido.entries()].filter(([g]) => g && g !== '?' && g !== 'Sin identificar')
    .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);
  const ORDEN = { todas: 'de más a menos mencionados', hechas: 'de más a menos menciones hechas', recibidas: 'de más a menos mencionados' };
  const ordenTexto = (sen, e) => `${e ? `de más a menos menciones con ${e}` : ORDEN[sen]} desde arriba en el sentido de las agujas del reloj; dentro de cada sector, ${e ? `de la persona más a la menos conectada con ${e}` : 'de la persona más a la menos central'}`;
  const AGRUPA = {
    partido: {
      grupoDe: (nd) => (nd.ext ? 'Externas' : PARTIDOS.includes(nd.p) ? nd.p : 'Otros'),
      ultimo: 'Otros',
      nombre: (g) => (g === 'Externas' ? 'Personas externas' : g === 'Otros' ? 'Otros partidos' : g),
      color: (nd) => { if (nd.ext) return 'var(--men-ext)'; const q = PARTIDOS.indexOf(nd.p); return q >= 0 ? `var(--men-f${q + 1})` : 'var(--text-faint)'; },
      leyenda: () => PARTIDOS.map((p, q) => [`var(--men-f${q + 1})`, p]).concat([['var(--text-faint)', 'otros partidos'], ['var(--men-ext)', 'personas externas', 'cuadro']]),
      explica: (sen, e) => `Sectores: ${sen === 'hechas' && !e ? 'partidos' : 'personas externas y partidos'}, ${ordenTexto(sen, e)}.`,
    },
    foco: {
      grupoDe: (nd) => (nd.f && nd.f <= 8 ? `F${nd.f}` : 'Fuera'),   // la paleta tiene ocho colores: los focos 9 y siguientes, con «otros»
      ultimo: 'Fuera',
      nombre: (g) => (g === 'Fuera' ? (D.focos.length > 8 ? 'Otros focos' : 'Fuera de los focos') : `${g} · ${D.focos[Number(g.slice(1)) - 1].centrales[0].n}`),
      color: (nd) => (nd.f && nd.f <= 8 ? `var(--men-f${nd.f})` : 'var(--text-faint)'),
      leyenda: () => D.focos.slice(0, 8).map((f) => [`var(--men-f${f.id})`, `F${f.id} · ${f.centrales[0].n}`])
        .concat([['var(--text-faint)', D.focos.length > 8 ? `otros ${D.focos.length - 8} focos y fuera de ellos` : 'fuera de los focos'], ['', 'persona externa', 'cuadro vacio']]),
      explica: (sen, e) => `Sectores: focos de conversación (comunidades de Leiden), ${ordenTexto(sen, e)}.${sen === 'hechas' && !e ? '' : ' Las personas externas (cuadrados) quedan en el sector de su foco, con su color.'}`,
    },
  };

  // Anillos por cuantiles de la medida (el 3 % más central, el 7 % siguiente, el 15 %, el 30 % y el resto), sin partir
  // empates: cada frontera se lleva al cambio de valor más cercano, así que dos personas con la misma cifra comparten anillo.
  const CORTES = [0.03, 0.10, 0.25, 0.55, 1], RADIOS = [70, 138, 202, 262, 318], HUECO = 0.2;
  function fronterasDe(valores) {
    const n = valores.length, fronteras = [];
    let previo = 0;
    for (let k = 0; k < CORTES.length - 1; k++) {
      const c = Math.max(previo, Math.min(n, Math.round(CORTES[k] * n)));
      let arriba = c, abajo = c;
      while (arriba > previo && arriba < n && valores[arriba - 1] === valores[arriba]) arriba--;
      while (abajo > 0 && abajo < n && valores[abajo - 1] === valores[abajo]) abajo++;
      const f = arriba > previo && (c - arriba <= abajo - c || abajo >= n) ? arriba : abajo;
      fronteras.push(f); previo = f;
    }
    fronteras.push(n);
    return fronteras;
  }
  /** Menciones entre la persona e y cada una de sus conexiones en el sentido `sen` (persona → menciones); solo las que
   *  llegan al mínimo m. */
  function lazos(e, sen, m0) {
    const m = new Map();
    for (const q of ady[e]) {
      const [a, b, ab, ba] = RED.aristas[q];
      const hace = a === e ? ab : ba, recibe = a === e ? ba : ab;
      const f = sen === 'hechas' ? hace : sen === 'recibidas' ? recibe : hace + recibe;
      if (f >= m0) m.set(a === e ? b : a, f);
    }
    return m;
  }
  const VISTAS = new Map();
  function disponer(agr, sen, ego = -1, minimo = 1) {
    const clave = `${agr}|${sen}|${ego}|${minimo}`;
    if (VISTAS.has(clave)) return VISTAS.get(clave);
    const A = AGRUPA[agr], S0 = SENTIDOS[sen], fuerza = ego >= 0 ? lazos(ego, sen, minimo) : null;
    const F = minimo > 1 ? S0.filtro(minimo) : null;
    const SS = F ? { ...S0, entra: (i) => F.medida(i) > 0, medida: F.medida, titulo: F.titulo } : S0;
    const medida = fuerza ? (i) => fuerza.get(i) : SS.medida, peso = fuerza ? medida : SS.peso;
    const orden = (fuerza ? [...fuerza.keys()] : [...Array(NN).keys()].filter(SS.entra)).sort((a, b) => medida(b) - medida(a) || SS.tam(b) - SS.tam(a) || a - b);
    const n = orden.length, fronteras = fronterasDe(orden.map(medida));
    const anillo = new Int8Array(NN).fill(-1), minimoAnillo = RADIOS.map(() => null);
    orden.forEach((i, r) => { const k = fronteras.findIndex((f) => r < f); anillo[i] = k; minimoAnillo[k] = medida(i); });
    // Radios: los cinco de siempre; en el modo ego, solo los de los anillos con alguien, repartidos entre 110 y 318
    let radios = RADIOS.slice();
    if (fuerza) {
      const usados = RADIOS.map((_, k) => k).filter((k) => minimoAnillo[k] !== null);
      radios = RADIOS.map(() => null);
      usados.forEach((k, u) => { radios[k] = usados.length === 1 ? 200 : 110 + (318 - 110) * u / (usados.length - 1); });
    }
    const cuenta = new Map(), pesos = new Map();
    for (const i of orden) { const g = A.grupoDe(RED.nodos[i]); cuenta.set(g, (cuenta.get(g) || 0) + 1); pesos.set(g, (pesos.get(g) || 0) + peso(i)); }
    const grupos = [...cuenta.keys()].filter((g) => g !== A.ultimo).sort((a, b) => pesos.get(b) - pesos.get(a)).concat(cuenta.has(A.ultimo) ? [A.ultimo] : []);
    let angulo = -Math.PI / 2 + HUECO / 2;
    const sectores = grupos.map((g) => { const w = (2 * Math.PI - HUECO) * cuenta.get(g) / n; const s = { g, a0: angulo, a1: angulo + w }; angulo += w; return s; });
    const pos = new Array(NN).fill(null), visibles = new Uint8Array(NN);
    for (const s of sectores) for (let k = 0; k < RADIOS.length; k++) {
      if (radios[k] === null) continue;
      const miembros = orden.filter((i) => anillo[i] === k && A.grupoDe(RED.nodos[i]) === s.g);   // en orden de centralidad
      const margen = Math.min(0.015, (s.a1 - s.a0) * 0.1);
      miembros.forEach((i, q) => {
        const a = s.a0 + margen + (s.a1 - s.a0 - 2 * margen) * (q + 0.5) / miembros.length;
        pos[i] = { x: CX + radios[k] * Math.cos(a), y: CY + radios[k] * Math.sin(a) };
      });
    }
    orden.forEach((i) => { visibles[i] = 1; });
    if (ego >= 0) { visibles[ego] = 1; pos[ego] = { x: CX, y: CY }; }
    for (let i = 0; i < NN; i++) if (!pos[i]) pos[i] = { x: CX, y: CY };
    const e = ego >= 0 ? RED.nodos[ego].n : '', usados = radios.filter((r) => r !== null);
    const v = {
      ego, sen, minimo, n, pos, sectores, corte: minimoAnillo, radios, curva: fuerza ? 0.3 : 0.75, firma: `${sen}|${ego}|${minimo}`,
      rInterior: usados.length ? Math.min(...usados) : RADIOS[0], rExterior: usados.length ? Math.max(...usados) : RADIOS[RADIOS.length - 1],
      titulo: !fuerza ? SS.titulo : sen === 'hechas' ? `veces que ${e} la menciona` : sen === 'recibidas' ? `veces que menciona a ${e}` : `menciones entre cada persona y ${e}`,
      visible: (i) => visibles[i] === 1, tam: SS.tam,
      prioridad: fuerza ? (i) => (i === ego ? Infinity : fuerza.get(i) || 0) : SS.tam,   // orden para poner nombres
    };
    VISTAS.set(clave, v);
    return v;
  }
  let agrupar = MEN.agrupar, sentido = MEN.sentido;
  MEN.minimo = Math.max(1, Math.min(MAX_MINIMO, Math.round(MEN.minimo) || 1));   // la red nueva puede no llegar al mínimo anterior
  let V = disponer(agrupar, sentido, -1, MEN.minimo);
  let anima = null, acabar = null, moviendo = false, curvaActual = V.curva;
  const pos = V.pos.map((p) => ({ x: p.x, y: p.y }));
  const radioActual = RED.nodos.map((_, i) => radioDe(V.tam(i)));
  const aristaEn = (vista, q) => vista.visible(RED.aristas[q][0]) && vista.visible(RED.aristas[q][1]) && (vista.minimo <= 1 || llega(vista.sen, q, vista.minimo));

  // Tamaño: la red cabe en la parte visible del panel de la lista junto con sus controles, la ficha y la leyenda. El dibujo
  // (viewBox 1000 × 720) se escala dentro y los textos crecen hasta 1,4 veces para seguir legibles cuando la red se encoge;
  // `lim` es la parte del viewBox que se ve (más ancha si sobra sitio a los lados).
  let escala = 1, fTexto = 1, lim = { x0: 0, x1: 1000, y0: 0, y1: 720 };

  // Capas: anillos y sus rótulos, sectores, aristas, nodos y nombres
  const gZoom = mk('g', {}), gRT = mk('g', {}), gS = mk('g', {}), gA = mk('g', {}), gN = mk('g', {}), gT = mk('g', {});
  gZoom.append(gRT, gS, gA, gN, gT); svg.append(gZoom);
  function pintarAnillos() {
    gRT.textContent = '';
    V.radios.forEach((r, k) => {
      if (r === null) return;
      gRT.append(mk('circle', { class: 'men-anillo', cx: CX, cy: CY, r: r.toFixed(1) }));
      if (V.corte[k] === null) return;
      const t = mk('text', { class: 'men-guia', x: CX, y: (CY - r + 3.5 * fTexto).toFixed(1), 'text-anchor': 'middle', 'font-size': (10 * fTexto).toFixed(1) });
      t.textContent = `${k === 0 && V.ego < 0 ? 'núcleo · ' : ''}≥ ${nf(V.corte[k])}`;
      gRT.append(t);
    });
    if (V.ego >= 0 && !V.n) return;                                 // modo ego sin nadie alrededor
    const t = mk('text', { class: 'men-guia', x: CX, y: CY - RADIOS[RADIOS.length - 1] - 26, 'text-anchor': 'middle', 'font-size': (10 * fTexto).toFixed(1) });
    t.textContent = V.titulo;
    gRT.append(t);
  }
  function pintarSectores() {
    gS.textContent = '';
    const A = AGRUPA[agrupar], rOut = V.rExterior, f = fTexto, wt = V.titulo.length * 5.4 * f + 8, yt = CY - RADIOS[RADIOS.length - 1] - 26;
    const puestos = [{ x0: CX - wt / 2, x1: CX + wt / 2, y0: yt - 11 * f, y1: yt + 6 }];   // el título de los anillos
    for (const s of V.sectores) {
      const c0 = Math.cos(s.a0), s0 = Math.sin(s.a0);
      gS.append(mk('line', { class: 'men-sector', x1: CX + (V.rInterior - 28) * c0, y1: CY + (V.rInterior - 28) * s0, x2: CX + (rOut + 12) * c0, y2: CY + (rOut + 12) * s0 }));
      const am = (s.a0 + s.a1) / 2, ca = Math.cos(am), sa = Math.sin(am), rr = rOut + 14 + 4 * f;
      const nombre = A.nombre(s.g), ancla = ca > 0.25 ? 'start' : ca < -0.25 ? 'end' : 'middle';
      const x = CX + rr * ca, y = CY + rr * sa + 4 * f, w = nombre.length * 6.6 * f + 4;
      const x0 = ancla === 'start' ? x : ancla === 'end' ? x - w : x - w / 2, caja = { x0, x1: x0 + w, y0: y - 12 * f, y1: y + 3 };
      if (puestos.some((b) => caja.x0 < b.x1 && caja.x1 > b.x0 && caja.y0 < b.y1 && caja.y1 > b.y0)) continue;   // sector sin sitio para su rótulo (la leyenda lo nombra)
      puestos.push(caja);
      const t = mk('text', { class: 'men-partido', x: x.toFixed(1), y: y.toFixed(1), 'font-size': (12 * f).toFixed(1), 'text-anchor': ancla });
      t.textContent = nombre;
      gS.append(t);
    }
  }
  const lineas = RED.aristas.map(([, , ab, ba], q) => {
    const l = mk('path', { class: 'men-arista', 'stroke-width': (0.5 + 0.55 * Math.log2(1 + ab + ba)).toFixed(2) });
    l.style.strokeDashoffset = ((q * 2.7) % 7).toFixed(1);          // discontinuas desfasadas: que no dibujen anillos al converger
    if (!aristaEn(V, q)) l.classList.add('fuera');
    gA.append(l); return l;
  });
  // Cada persona es un círculo si tiene escaño y un cuadrado de la misma área si es una persona externa
  const LADO = Math.sqrt(Math.PI) / 2;                              // medio lado del cuadrado con el área del círculo de radio 1
  const circulos = RED.nodos.map((nd, i) => {
    const c = mk(nd.ext ? 'rect' : 'circle', { class: 'men-nodo', 'data-i': i });
    if (!V.visible(i)) c.classList.add('fuera');
    return c;
  });
  function ponerNodo(i) {
    const el = circulos[i], x = pos[i].x, y = pos[i].y, r = radioActual[i];
    if (RED.nodos[i].ext) {
      const h = r * LADO;
      el.setAttribute('x', (x - h).toFixed(1)); el.setAttribute('y', (y - h).toFixed(1));
      el.setAttribute('width', (2 * h).toFixed(2)); el.setAttribute('height', (2 * h).toFixed(2));
    } else { el.setAttribute('cx', x.toFixed(1)); el.setAttribute('cy', y.toFixed(1)); el.setAttribute('r', r.toFixed(2)); }
  }
  function apilar() { [...Array(NN).keys()].sort((i, j) => radioActual[i] - radioActual[j] || i - j).forEach((i) => gN.append(circulos[i])); }   // los grandes, encima
  function colocar() {
    for (let i = 0; i < NN; i++) ponerNodo(i);
    const eg = V.ego, rEgo = eg >= 0 ? radioActual[eg] : 0, cuadro = eg >= 0 && RED.nodos[eg].ext;
    RED.aristas.forEach(([a, b], q) => {
      let pa = pos[a], pb = pos[b];
      if (eg >= 0 && (a === eg || b === eg)) {                     // en el modo ego, las aristas del centro nacen en el borde de su figura
        const [p0, p1] = a === eg ? [pa, pb] : [pb, pa], d = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
        const ux = (p1.x - p0.x) / d, uy = (p1.y - p0.y) / d, t = (cuadro ? rEgo * LADO / Math.max(Math.abs(ux), Math.abs(uy), 1e-6) : rEgo) + 1.5;
        const borde = { x: p0.x + ux * t, y: p0.y + uy * t };
        if (a === eg) pa = borde; else pb = borde;
      }
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      const qx = mx + (CX - mx) * curvaActual, qy = my + (CY - my) * curvaActual;   // control hacia el centro
      lineas[q].setAttribute('d', `M${pa.x.toFixed(1)},${pa.y.toFixed(1)}Q${qx.toFixed(1)},${qy.toFixed(1)} ${pb.x.toFixed(1)},${pb.y.toFixed(1)}`);
    });
  }
  function pintarColores() {
    const A = AGRUPA[agrupar];
    RED.nodos.forEach((nd, i) => { circulos[i].style.fill = A.color(nd); });
    menEl('menLeyenda').innerHTML = A.leyenda().map(([c, t, forma]) =>
      `<span><i${forma ? ` class="${forma}"` : ''}${c ? ` style="background:${c}"` : ''}></i>${esc(t)}</span>`).join('');
  }
  let fijado = -1;
  const vista = { x: 0, y: 0, k: 1 };
  /** Nombres sin solaparse (en coordenadas de pantalla); más al acercar. `solo`: limitarse a esas personas. */
  function pintarEtiquetas(solo) {
    if (moviendo) return;                                          // durante la transición, los nombres siguen a su persona
    gT.textContent = '';
    const puestos = [], limite = solo ? 30 : Math.round(20 * Math.sqrt(vista.k));
    const cand = (solo ? [...solo] : [...Array(NN).keys()].filter((i) => V.visible(i) && V.prioridad(i) > 0)).sort((i, j) => V.prioridad(j) - V.prioridad(i));
    let n = 0;
    const f = fTexto;
    for (const i of cand) {
      if (n >= limite) break;
      const nd = RED.nodos[i], rr = radioActual[i] * vista.k;
      const sx = pos[i].x * vista.k + vista.x, sy = pos[i].y * vista.k + vista.y;
      if (sx < lim.x0 || sx > lim.x1 || sy < lim.y0 || sy > lim.y1) continue;
      const caja = { x: sx + rr + 3 * f, y: sy - 7 * f, w: (nd.n.length * 6.4 + 4) * f, h: 14 * f };
      if (puestos.some((b) => caja.x < b.x + b.w && caja.x + caja.w > b.x && caja.y < b.y + b.h && caja.y + caja.h > b.y)) continue;
      puestos.push(caja);
      const t = mk('text', { 'data-i': i, x: (pos[i].x + (rr + 3 * f) / vista.k).toFixed(1), y: (pos[i].y + 4 * f / vista.k).toFixed(1), 'font-size': (11 * f / vista.k).toFixed(2) });
      t.style.strokeWidth = `${(3 * f / vista.k).toFixed(2)}px`;
      t.textContent = nd.n; gT.append(t); n++;
    }
  }
  function seguirEtiquetas() {
    for (const t of gT.children) {
      const i = Number(t.dataset.i);
      t.setAttribute('x', (pos[i].x + radioActual[i] + 3 * fTexto / vista.k).toFixed(1));
      t.setAttribute('y', (pos[i].y + 4 * fTexto / vista.k).toFixed(1));
    }
  }
  function aplicarVista() {
    gZoom.setAttribute('transform', `translate(${vista.x.toFixed(1)},${vista.y.toFixed(1)}) scale(${vista.k.toFixed(3)})`);
    if (fijado >= 0) resaltar(fijado); else pintarEtiquetas();
  }
  function zoom(f, cx = CX, cy = CY) {
    const k = Math.min(8, Math.max(1, vista.k * f)), r = k / vista.k;
    vista.x = cx - (cx - vista.x) * r; vista.y = cy - (cy - vista.y) * r; vista.k = k;
    if (k === 1) { vista.x = 0; vista.y = 0; }
    aplicarVista();
  }
  const puntoSvg = (e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  /** Clase de la arista q vista desde la persona i: a quién menciona (continua), quién la menciona (discontinua) o ambas.
   *  Con el filtro, en «Hechas» y «Recibidas» solo cuentan las menciones repetidas. */
  function claseDesde(i, q) {
    const [a, , ab, ba] = RED.aristas[q], umbral = sentido !== 'todas' ? V.minimo : 1;
    const hace = (a === i ? ab : ba) >= umbral, recibe = (a === i ? ba : ab) >= umbral;
    return sentido === 'hechas' ? (hace ? 'sale' : '') : sentido === 'recibidas' ? (recibe ? 'entra' : '')
      : hace && recibe ? 'ambos' : hace ? 'sale' : 'entra';
  }
  /** Resalta a la persona i y sus conexiones en la vista: en «Todas», a quién menciona (continuas) y quién la menciona
   *  (discontinuas); en «Hechas», solo lo primero; en «Recibidas», solo lo segundo. */
  function resaltar(i) {
    const vec = new Set([i]), clases = new Map();
    for (const q of ady[i]) {
      const [a, b] = RED.aristas[q];
      if (!aristaEn(V, q)) continue;
      const clase = claseDesde(i, q);
      if (!clase) continue;
      clases.set(q, clase); vec.add(a === i ? b : a);
    }
    circulos.forEach((c, j) => { c.classList.toggle('apagado', !vec.has(j)); c.classList.toggle('sel', j === fijado); c.classList.toggle('ego', j === V.ego); });
    lineas.forEach((l, q) => {
      const clase = clases.get(q);
      l.classList.remove('sale', 'entra', 'ambos', 'radio');
      l.classList.toggle('apagado', !clase);
      if (clase) l.classList.add(clase);
    });
    pintarEtiquetas(vec);
  }
  /** Sin nadie resaltado: en el modo ego, las aristas de la persona del centro con su sentido, más suaves. */
  function limpiar() {
    circulos.forEach((c, j) => { c.classList.remove('apagado', 'sel'); c.classList.toggle('ego', j === V.ego); });
    lineas.forEach((l) => l.classList.remove('apagado', 'sale', 'entra', 'ambos', 'radio'));
    if (V.ego >= 0) for (const q of ady[V.ego]) if (aristaEn(V, q)) lineas[q].classList.add('radio', claseDesde(V.ego, q) || 'sale');
    pintarEtiquetas();
  }
  const veces = (n) => (n === 1 ? 'una vez' : `${nf(n)} veces`);
  /** En el modo ego, las menciones entre la persona i y la del centro. */
  function conEgo(i) {
    if (V.ego < 0 || i === V.ego) return '';
    const e = esc(RED.nodos[V.ego].n), partes = [];
    for (const q of ady[i]) {
      const [a, b, ab, ba] = RED.aristas[q];
      if (a !== V.ego && b !== V.ego) continue;
      const hace = a === i ? ab : ba, recibe = a === i ? ba : ab;
      if (hace) partes.push(`menciona a ${e} ${veces(hace)}`);
      if (recibe) partes.push(`${e} la menciona ${veces(recibe)}`);
    }
    return partes.length ? ` · ${partes.join(' · ')}` : '';
  }
  /** Ficha de la persona en toda la biblioteca; con un mínimo (fuera del modo ego), también la cifra que le da el anillo. */
  const describir = (nd, i) => {
    const m = V.minimo, f = m > 1 && V.ego < 0 ? sentido : '', C = f ? cuentasDe(m) : null;
    return `${nd.ext ? 'persona externa' : esc(nd.p)}${nd.f ? ` · foco F${nd.f}` : ''} · la mencionan ${nf(nd.or)} oradores (${nf(nd.men)} menciones${f === 'recibidas' ? `; ${nf(C.ent[i])} de ellos, ${m} o más veces` : ''})`
      + `${nd.emite ? ` · menciona a ${nf(nd.emite)} personas${f === 'hechas' ? ` (a ${nf(C.sal[i])}, ${m} o más veces)` : ''}` : ''}`
      + ` · conectada con ${nf(centralidad[i])}${f === 'todas' ? ` (con ${nf(C.vec[i])} por ${m} o más menciones)` : ''}${conEgo(i)}`;
  };
  const CUANTAS = {
    todas: (n) => `sus ${nf(n)} conexiones`,
    hechas: (n) => `las ${nf(n)} personas a las que menciona`,
    recibidas: (n) => `los ${nf(n)} oradores que la mencionan`,
  };
  /** En «Hechas» o «Recibidas» (fuera del modo ego), cuántas de sus conexiones en ese sentido se ven en la vista (con un
   *  mínimo, de las que llegan a él). En el modo ego con un mínimo, cuántas conexiones de la persona del centro faltan. */
  function nota(i) {
    const m = V.minimo;
    if (V.ego >= 0) {
      if (i !== V.ego || m <= 1 || !V.n) return '';
      const faltan = lazos(i, sentido, 1).size - V.n;
      return faltan > 0 ? `Se ven ${nf(V.n)} de ${CUANTAS[sentido](V.n + faltan)}; ${faltan === 1 ? 'falta 1' : `faltan ${nf(faltan)}`} con menos de ${m} menciones.` : '';
    }
    if (sentido === 'todas') return '';
    let n = 0, total = 0;
    for (const q of ady[i]) {
      const [a, b, ab, ba] = RED.aristas[q];
      const cuenta = sentido === 'hechas' ? (a === i ? ab : ba) : (a === i ? ba : ab);
      if (cuenta < m) continue;
      total++;
      if (V.visible(a === i ? b : a)) n++;
    }
    if (n >= total) return '';
    const vv = m > 1 ? ` ${m} o más veces` : '', mas = m > 1 ? ` ${m} o más veces` : ' más de una vez', una = total - n === 1;
    return sentido === 'hechas' ? `En esta vista se ven ${nf(n)} de las ${nf(total)} personas a las que menciona${vv}; ${una ? 'la otra no menciona' : 'las demás no mencionan'} a nadie${mas}.`
      : `En esta vista se ven ${nf(n)} de los ${nf(total)} oradores que la mencionan${vv}; ${una ? 'al otro no lo' : 'a los demás no los'} menciona nadie${mas}.`;
  }
  function resumenEgo() {
    const e = esc(RED.nodos[V.ego].n);
    if (V.n) return 'en el centro';
    const m = V.minimo;
    const mas = m > 1 && lazos(V.ego, sentido, 1).size ? ` ${m} o más veces` : ' en esta biblioteca';
    return `en el centro · ${sentido === 'hechas' ? `${e} no menciona a nadie${mas}` : sentido === 'recibidas' ? `nadie menciona a ${e}${mas}` : `ninguna de sus conexiones llega a ${m} menciones`}`;
  }
  function pintarInfo() {
    const boton = menEl('menEgo');
    boton.setAttribute('aria-pressed', String(V.ego >= 0));
    boton.disabled = V.ego < 0 && fijado < 0;
    boton.title = V.ego >= 0 ? 'Volver a toda la red' : fijado >= 0 ? `Rehacer la red solo con ${RED.nodos[fijado].n} y sus conexiones` : 'Fije antes una persona pulsándola';
    const quien = fijado >= 0 ? fijado : V.ego, info = menEl('menInfo');
    if (quien < 0) {
      info.innerHTML = V.n ? 'Pulse una persona para fijarla y ver sus conexiones; pulse el fondo para soltarla.'
        : `Con un mínimo de ${V.minimo} menciones no queda ninguna conexión: baje el mínimo.`;
      return;
    }
    const nd = RED.nodos[quien], n = nota(quien);
    info.innerHTML = `<b>${esc(nd.n)}</b>${quien === V.ego ? `<span>${resumenEgo()}</span>` : ''}<span>${describir(nd, quien)}</span>`
      + (nd.lista >= 0 ? '<button type="button" class="btn sm" id="menLeer">Leer sus menciones</button>'
        : `<span>(no está entre las ${nf(D.personas.length)} personas con citas guardadas)</span>`)
      + (quien !== V.ego ? '<button type="button" class="btn sm" id="menVerEgo">Ver su red ego</button>' : '')
      + (n ? `<span class="men-aviso">${n}</span>` : '');
    const b = menEl('menLeer');
    if (b) b.addEventListener('click', () => {
      MEN.elegida = D.personas[nd.lista].k;
      if (MEN.filtro !== 'todas') {
        MEN.filtro = 'todas';
        for (const x of menEl('menFiltro').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.menf === 'todas'));
      }
      menPintarPersonas();
      const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      menEl('menPersonas').closest('section').scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    });
    const be = menEl('menVerEgo');
    if (be) be.addEventListener('click', () => irA(agrupar, sentido, quien));
  }
  const tip = menEl('menTip');
  function mostrarTip(e, i) {
    const caja = svg.parentElement.getBoundingClientRect();
    tip.innerHTML = `<b>${esc(RED.nodos[i].n)}</b><br>${describir(RED.nodos[i], i)}`;
    tip.hidden = false;
    const x = Math.min(e.clientX - caja.left + 14, caja.width - tip.offsetWidth - 8), y = Math.min(e.clientY - caja.top + 14, caja.height - tip.offsetHeight - 8);
    tip.style.left = `${Math.max(8, x)}px`; tip.style.top = `${Math.max(8, y)}px`;
  }
  const TEXTO = {
    todas: 'Cada figura es una persona (círculo, con escaño; cuadrado, persona externa); su tamaño, cuántos oradores distintos la mencionan. Anillos: cuanto más al centro, con más personas distintas está conectada, en cualquiera de los dos sentidos (el número de cada anillo es el mínimo). ',
    hechas: 'Solo las personas que mencionan a alguien y las menciones entre ellas: quien no menciona a nadie, como las personas externas, no aparece. Tamaño y anillo: a cuántas personas distintas menciona (el número de cada anillo es el mínimo). ',
    recibidas: 'Solo las personas mencionadas y las menciones entre ellas: quien habla sin que nadie la mencione no aparece. Tamaño y anillo: cuántos oradores distintos la mencionan (el número de cada anillo es el mínimo). ',
  };
  const TEXTO_EGO = {
    todas: (e) => `Modo ego: ${e}, en el centro, y las personas conectadas con ${e} por menciones en cualquiera de los dos sentidos, con las menciones entre ellas. Anillos: cuanto más cerca del centro, más menciones entre esa persona y ${e} (el número de cada anillo es el mínimo); tamaño, cuántos oradores distintos la mencionan en toda la biblioteca. `,
    hechas: (e) => `Modo ego: ${e}, en el centro, y las personas a las que ${e} menciona, con las menciones entre ellas. Anillos: cuanto más cerca del centro, más veces las menciona ${e} (el número de cada anillo es el mínimo); tamaño, a cuántas personas distintas menciona cada una en toda la biblioteca. `,
    recibidas: (e) => `Modo ego: ${e}, en el centro, y las personas que mencionan a ${e}, con las menciones entre ellas. Anillos: cuanto más cerca del centro, más veces menciona esa persona a ${e} (el número de cada anillo es el mínimo); tamaño, cuántos oradores distintos la mencionan en toda la biblioteca. `,
  };
  const PASAR = {
    todas: ' Pase por encima o pulse una persona para ver a quién menciona (línea continua) y quién la menciona (discontinua).',
    hechas: ' Pase por encima o pulse una persona para ver a quién menciona.',
    recibidas: ' Pase por encima o pulse una persona para ver quién la menciona.',
  };
  const FILTRO = {
    todas: (m) => `Con el mínimo en ${m}, solo cuentan las conexiones de ${m} o más menciones, sumando los dos sentidos: quien no tiene ninguna sale de la red y los anillos cuentan solo esas conexiones; el tamaño sigue siendo el de toda la biblioteca. `,
    hechas: (m) => `Con el mínimo en ${m}, queda quien menciona a alguien ${m} o más veces y el anillo cuenta a cuántas personas menciona así; el tamaño sigue siendo el de toda la biblioteca. `,
    recibidas: (m) => `Con el mínimo en ${m}, queda quien es mencionada ${m} o más veces por un mismo orador y el anillo cuenta cuántos oradores la mencionan así; el tamaño sigue siendo el de toda la biblioteca. `,
  };
  const FILTRO_EGO = {
    todas: (e, m) => `Con el mínimo en ${m}, solo las personas con ${m} o más menciones con ${e}, sumando los dos sentidos, y entre ellas, las conexiones de ${m} o más menciones. `,
    hechas: (e, m) => `Con el mínimo en ${m}, solo las personas a las que ${e} menciona ${m} o más veces, y entre ellas, las conexiones de ${m} o más menciones. `,
    recibidas: (e, m) => `Con el mínimo en ${m}, solo las personas que mencionan a ${e} ${m} o más veces, y entre ellas, las conexiones de ${m} o más menciones. `,
  };
  const explicar = () => {
    const e = V.ego >= 0 ? RED.nodos[V.ego].n : '';
    const m = V.minimo;
    menEl('menExplica').textContent = (e ? TEXTO_EGO[sentido](e) : TEXTO[sentido]) + (m > 1 ? (e ? FILTRO_EGO[sentido](e, m) : FILTRO[sentido](m)) : '') + AGRUPA[agrupar].explica(sentido, e)
      + (e ? ' Pase por encima o pulse una persona para ver sus conexiones dentro de esta red; «Ver su red ego» la pone en el centro y «Modo ego» vuelve a toda la red.'
        : `${PASAR[sentido]} Con una persona fijada, «Modo ego» rehace la red solo con ella y sus conexiones.`)
      + ' Para acercar: los botones, o Ctrl y la rueda (en el trackpad, pellizcar); arrastre para moverse.';
  };

  // Cambiar de vista con una transición al estilo de d3 (d3.easeCubicInOut, 750 ms por persona, con un retraso escalonado
  // según su ángulo de destino: un barrido en el sentido de las agujas del reloj desde las 12). Quien sigue en la vista se
  // desliza por los anillos hasta su nuevo sitio, con el tamaño y el color interpolados; quien sale se desvanece al
  // principio y quien entra aparece al final, ya en su sitio. Las aristas y los nombres acompañan a sus personas; los
  // rótulos de sectores y anillos salen y entran con un fundido. Sin transición si el sistema pide reducir el movimiento.
  const DUR = 750, ESCALON = 350, SALIDA = 250, ENTRADA = 300;
  const suaveT = (t) => ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;   // d3.easeCubicInOut
  const rgb = (c) => (c.match(/[\d.]+/g) || [128, 128, 128]).slice(0, 3).map(Number);
  const colorear = (i, col) => { circulos[i].style.fill = col; };
  const fundir = (g, de, a, ms, fill) => g.animate([{ opacity: de }, { opacity: a }], { duration: ms, easing: 'ease-out', fill });
  function irA(agr, sen, ego, minimo = V.minimo) {
    if (agr === agrupar && sen === sentido && ego === V.ego && minimo === V.minimo) return;
    if (acabar) acabar();                                          // una transición a medias salta a su final
    const antes = V, cambiaGrupo = agr !== agrupar;
    const colorDesde = circulos.map((c) => rgb(getComputedStyle(c).fill));
    const salen = [], entran = [], aSalen = [], aEntran = [];
    const opacidad = (el) => (el.classList.contains('apagado') ? 0.1 : 1);
    agrupar = agr; sentido = sen; V = disponer(agr, sen, ego, minimo); moviendo = true;
    MEN.agrupar = agrupar; MEN.sentido = sentido; MEN.minimo = V.minimo;
    menEl('menMinimo').value = String(V.minimo);
    const cambiaAnillos = antes.firma !== V.firma;
    if (V.ego !== antes.ego) fijado = V.ego >= 0 ? -1 : antes.ego;   // al entrar en el modo ego se suelta; al salir, queda fijada quien estaba en el centro
    if (fijado >= 0 && !V.visible(fijado)) fijado = -1;
    const quedan = [];
    for (let i = 0; i < NN; i++) {
      const a = antes.visible(i), d = V.visible(i);
      if (a && d) quedan.push(i); else if (a) salen.push({ i, o: opacidad(circulos[i]) }); else if (d) entran.push({ i });
    }
    for (let q = 0; q < RED.aristas.length; q++) {
      const a = aristaEn(antes, q), d = aristaEn(V, q);
      if (a && !d) aSalen.push({ q, o: opacidad(lineas[q]) }); else if (!a && d) aEntran.push({ q });
    }
    for (const x of menEl('menAgrupar').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.meng === agrupar));
    for (const x of menEl('menSentido').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.mens === sentido));
    explicar(); pintarColores();                                   // leyenda y colores de destino
    const colorHasta = circulos.map((c) => rgb(getComputedStyle(c).fill));
    colorDesde.forEach((c, i) => colorear(i, `rgb(${(V.visible(i) && !antes.visible(i) ? colorHasta[i] : c).join(',')})`));
    pintarInfo();
    if (fijado >= 0) resaltar(fijado); else limpiar();             // (los nombres esperan al final)
    for (const t of [...gT.children]) if (!V.visible(Number(t.dataset.i))) t.remove();
    for (const s of salen) circulos[s.i].classList.add('saliendo');
    for (const s of entran) {
      const i = s.i;
      s.o = opacidad(circulos[i]);
      pos[i].x = V.pos[i].x; pos[i].y = V.pos[i].y; radioActual[i] = radioDe(V.tam(i));
      circulos[i].style.opacity = '0'; circulos[i].classList.remove('fuera');
    }
    for (const s of aEntran) { s.o = opacidad(lineas[s.q]); lineas[s.q].style.opacity = '0'; lineas[s.q].classList.remove('fuera'); }
    const tramo = quedan.map((i) => {
      const p = V.pos[i], a0 = Math.atan2(pos[i].y - CY, pos[i].x - CX), destino = Math.atan2(p.y - CY, p.x - CX);
      let a1 = destino;
      if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; else if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;   // por el lado corto
      const barrido = (destino + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
      return { i, a0, a1, r0: Math.hypot(pos[i].x - CX, pos[i].y - CY), r1: Math.hypot(p.x - CX, p.y - CY), retraso: ESCALON * barrido / (2 * Math.PI),
        t0: radioActual[i], t1: radioDe(V.tam(i)), c0: colorDesde[i], c1: colorHasta[i], cambia: cambiaGrupo && colorDesde[i].some((v, k) => v !== colorHasta[i][k]) };
    });
    const curva0 = curvaActual;
    const guias = [fundir(gS, 1, 0, 200, 'forwards')].concat(cambiaAnillos ? [fundir(gRT, 1, 0, 200, 'forwards')] : []);
    const fin = () => {
      if (anima) cancelAnimationFrame(anima);
      anima = null; acabar = null; moviendo = false; curvaActual = V.curva;
      for (const s of tramo) { pos[s.i].x = V.pos[s.i].x; pos[s.i].y = V.pos[s.i].y; radioActual[s.i] = s.t1; }
      for (const s of salen) { circulos[s.i].classList.remove('saliendo'); circulos[s.i].classList.add('fuera'); circulos[s.i].style.opacity = ''; }
      for (const s of entran) circulos[s.i].style.opacity = '';
      for (const s of aSalen) { lineas[s.q].classList.add('fuera'); lineas[s.q].style.opacity = ''; }
      for (const s of aEntran) lineas[s.q].style.opacity = '';
      apilar(); pintarColores(); colocar();
      guias.forEach((g) => g.cancel());
      pintarSectores(); fundir(gS, 0, 1, 300);
      pintarAnillos();
      if (cambiaAnillos) fundir(gRT, 0, 1, 300);
      if (fijado >= 0) resaltar(fijado); else { sobre = -1; limpiar(); }
    };
    acabar = fin;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { fin(); return; }
    const t0 = performance.now(), TOTAL = DUR + ESCALON;
    const paso = (ahora) => {
      const t = ahora - t0;
      for (const s of tramo) {
        const e = suaveT(Math.min(1, Math.max(0, (t - s.retraso) / DUR)));
        const a = s.a0 + (s.a1 - s.a0) * e, r = s.r0 + (s.r1 - s.r0) * e;
        pos[s.i].x = CX + r * Math.cos(a); pos[s.i].y = CY + r * Math.sin(a);
        if (s.t0 !== s.t1) radioActual[s.i] = s.t0 + (s.t1 - s.t0) * e;
        if (s.cambia) colorear(s.i, `rgb(${Math.round(s.c0[0] + (s.c1[0] - s.c0[0]) * e)},${Math.round(s.c0[1] + (s.c1[1] - s.c0[1]) * e)},${Math.round(s.c0[2] + (s.c1[2] - s.c0[2]) * e)})`);
      }
      const fs = 1 - suaveT(Math.min(1, t / SALIDA)), fe = suaveT(Math.min(1, Math.max(0, (t - (TOTAL - ENTRADA)) / ENTRADA)));
      for (const s of salen) circulos[s.i].style.opacity = (s.o * fs).toFixed(3);
      for (const s of aSalen) lineas[s.q].style.opacity = (s.o * fs).toFixed(3);
      for (const s of entran) circulos[s.i].style.opacity = (s.o * fe).toFixed(3);
      for (const s of aEntran) lineas[s.q].style.opacity = (s.o * fe).toFixed(3);
      curvaActual = curva0 + (V.curva - curva0) * suaveT(Math.min(1, t / TOTAL));
      colocar(); seguirEtiquetas();
      if (t < TOTAL) anima = requestAnimationFrame(paso); else fin();
    };
    anima = requestAnimationFrame(paso);
  }

  let arrastre = null, sobre = -1;
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const c = e.target.closest('.men-nodo');
    arrastre = { p: puntoSvg(e), x: vista.x, y: vista.y, nodo: c ? Number(c.dataset.i) : -1, movido: false };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (arrastre) {
      const p = puntoSvg(e), dx = p.x - arrastre.p.x, dy = p.y - arrastre.p.y;
      if (!arrastre.movido && Math.hypot(dx, dy) < 4) return;
      arrastre.movido = true; svg.classList.add('men-arrastrando'); tip.hidden = true;
      vista.x = arrastre.x + dx; vista.y = arrastre.y + dy;
      gZoom.setAttribute('transform', `translate(${vista.x.toFixed(1)},${vista.y.toFixed(1)}) scale(${vista.k.toFixed(3)})`);
      return;
    }
    if (moviendo) return;
    const c = e.target.closest('.men-nodo');
    const i = c ? Number(c.dataset.i) : -1;
    if (i >= 0) mostrarTip(e, i); else tip.hidden = true;
    if (i === sobre) return;
    sobre = i;
    if (fijado >= 0) return;                                       // con una persona fijada, el resaltado no cambia al pasar
    if (i >= 0) resaltar(i); else limpiar();
  });
  svg.addEventListener('pointerup', (e) => {
    if (!arrastre) return;
    const a = arrastre; arrastre = null; svg.classList.remove('men-arrastrando');
    try { svg.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ }
    if (a.movido) { aplicarVista(); return; }
    if (moviendo) return;
    fijado = a.nodo;                                                // pulsar una persona la fija; pulsar el fondo la suelta
    if (fijado >= 0) resaltar(fijado); else limpiar();
    pintarInfo();
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; sobre = -1; if (fijado < 0 && !arrastre && !moviendo) limpiar(); });
  svg.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;                          // sin Ctrl, la rueda desplaza la lista
    e.preventDefault();
    const p = puntoSvg(e);
    zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  }, { passive: false });
  menEl('menZmas').addEventListener('click', () => zoom(1.4));
  menEl('menZmenos').addEventListener('click', () => zoom(1 / 1.4));
  menEl('menEncuadre').addEventListener('click', () => { vista.x = 0; vista.y = 0; vista.k = 1; aplicarVista(); });
  menEl('menAgrupar').addEventListener('click', (e) => { const b = e.target.closest('[data-meng]'); if (b) irA(b.dataset.meng, sentido, V.ego); });
  menEl('menSentido').addEventListener('click', (e) => { const b = e.target.closest('[data-mens]'); if (b) irA(agrupar, b.dataset.mens, V.ego); });
  menEl('menEgo').addEventListener('click', () => { if (V.ego >= 0) irA(agrupar, sentido, -1); else if (fijado >= 0) irA(agrupar, sentido, fijado); });
  const entrada = menEl('menMinimo');
  entrada.max = String(MAX_MINIMO);
  entrada.title = `Deja solo las conexiones con al menos tantas menciones; con 1 se ve la red entera y con ${MAX_MINIMO} solo la más repetida.`;
  const aplicarMinimo = () => {
    const m = Math.max(1, Math.min(MAX_MINIMO, Math.round(Number(entrada.value) || 1)));
    entrada.value = String(m);                                     // fuera de rango, se ajusta a la vista
    irA(agrupar, sentido, V.ego, m);
  };
  entrada.addEventListener('change', aplicarMinimo);
  entrada.addEventListener('blur', aplicarMinimo);                 // por si el navegador no da «change» al salir
  entrada.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); e.stopPropagation();
    aplicarMinimo();
  });

  function contenedorDesplazable(el) {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.clientHeight > 0) return p;
    }
    return null;
  }
  function medir() {
    const cont = contenedorDesplazable(svg), visible = cont ? cont.clientHeight : window.innerHeight;
    // El dibujo se lleva casi toda la altura visible del panel: solo se guarda sitio para la ficha de la persona y la
    // leyenda, que van pegadas debajo. Los controles quedan justo encima, a un golpe de rueda.
    const reservado = Math.max(menEl('menInfo').offsetHeight, 42) + (menEl('menLeyenda').offsetHeight || 0) + 14;
    svg.style.maxHeight = `${Math.max(360, Math.round(visible - reservado))}px`;
    const r = svg.getBoundingClientRect();
    escala = Math.min(r.width / 1000, r.height / 720) || 1;
    const w = r.width / escala, h = r.height / escala;
    lim = { x0: (1000 - w) / 2, x1: (1000 + w) / 2, y0: (720 - h) / 2, y1: (720 + h) / 2 };
    fTexto = Math.min(1.4, Math.max(1, 1 / escala));
  }
  function reajustar() {
    if (!svg.isConnected) return;
    medir();
    if (moviendo) return;                                          // el final de la transición ya repinta
    pintarAnillos(); pintarSectores();
    if (fijado >= 0) resaltar(fijado); else limpiar();
  }
  let esperaAjuste = 0;
  const alCambiarTamano = () => { cancelAnimationFrame(esperaAjuste); esperaAjuste = requestAnimationFrame(reajustar); };
  window.addEventListener('resize', alCambiarTamano);
  const ro = window.ResizeObserver ? new ResizeObserver(alCambiarTamano) : null;
  if (ro) ro.observe(svg.parentElement);
  MEN.limpiarRed = () => {
    window.removeEventListener('resize', alCambiarTamano);
    cancelAnimationFrame(esperaAjuste);
    if (anima) cancelAnimationFrame(anima);
    ro?.disconnect();
  };

  apilar(); explicar(); pintarColores(); pintarInfo(); medir(); colocar(); pintarAnillos(); pintarSectores(); aplicarVista();
}

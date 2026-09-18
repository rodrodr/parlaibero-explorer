/* ===== src/engine/py/sha1.js ===== */
/* 2REP_Standalone · engine/py/sha1.js
 *
 * R2.py.sha1: SHA-1 síncrono en JavaScript puro (FIPS 180-4), para las huellas del backend:
 *   hashlib.sha1(texto.encode("utf-8")).hexdigest()          → R2.py.sha1.hex(texto)
 *   hashlib.sha1(np.array(ids, int64).tobytes()).hexdigest() → R2.py.sha1.hex(R2.py.sha1.bytesInt64(ids))
 * crypto.subtle no sirve: es asíncrono y no está en todos los contextos de file://.
 * Una cadena con sustitutos sueltos lanza UnicodeEncodeError, como str.encode("utf-8") en Python.
 */
(function (R2) {
  'use strict';

  const { PyError } = R2.py.core;
  const UTF8 = new TextEncoder();
  const SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

  /** str.encode("utf-8") de Python: Uint8Array; lanza con sustitutos sueltos. */
  function utf8(s) {
    const bien = typeof s.isWellFormed === 'function' ? s.isWellFormed() : !SUELTO.test(s);
    if (!bien) throw new PyError('UnicodeEncodeError', "'utf-8' codec can't encode characters: surrogates not allowed");
    return UTF8.encode(s);
  }

  function aBytes(datos) {
    if (typeof datos === 'string') return utf8(datos);
    if (datos instanceof Uint8Array) return datos;
    if (datos instanceof ArrayBuffer) return new Uint8Array(datos);
    if (ArrayBuffer.isView(datos)) return new Uint8Array(datos.buffer, datos.byteOffset, datos.byteLength);
    throw new PyError('TypeError', 'sha1: se esperaban bytes o str');
  }

  class Sha1 {
    constructor() {
      this.h = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476, 0xc3d2e1f0 | 0]);
      this.w = new Int32Array(80);
      this.pendiente = new Uint8Array(64);
      this.nPendiente = 0;
      this.longitud = 0;
      this.terminado = false;
    }

    /** Añade bytes (Uint8Array, ArrayBuffer, vista) o una cadena (UTF-8). Devuelve this. */
    update(datos) {
      if (this.terminado) throw new Error('Sha1: ya se calculó el resumen');
      const b = aBytes(datos);
      const n = b.length;
      let i = 0;
      this.longitud += n;
      if (this.nPendiente > 0) {
        const k = Math.min(64 - this.nPendiente, n);
        this.pendiente.set(b.subarray(0, k), this.nPendiente);
        this.nPendiente += k;
        i = k;
        if (this.nPendiente < 64) return this;
        this._bloque(this.pendiente, 0);
        this.nPendiente = 0;
      }
      for (; i + 64 <= n; i += 64) this._bloque(b, i);
      if (i < n) { this.pendiente.set(b.subarray(i), 0); this.nPendiente = n - i; }
      return this;
    }

    _bloque(b, o) {
      const w = this.w, h = this.h;
      for (let t = 0; t < 16; t++) {
        const j = o + 4 * t;
        w[t] = (b[j] << 24) | (b[j + 1] << 16) | (b[j + 2] << 8) | b[j + 3];
      }
      for (let t = 16; t < 80; t++) {
        const x = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16];
        w[t] = (x << 1) | (x >>> 31);
      }
      let a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4];
      for (let t = 0; t < 80; t++) {
        let f, k;
        if (t < 20) { f = (bb & c) | (~bb & d); k = 0x5a827999; }
        else if (t < 40) { f = bb ^ c ^ d; k = 0x6ed9eba1; }
        else if (t < 60) { f = (bb & c) | (bb & d) | (c & d); k = 0x8f1bbcdc | 0; }
        else { f = bb ^ c ^ d; k = 0xca62c1d6 | 0; }
        const tmp = (((a << 5) | (a >>> 27)) + f + e + k + w[t]) | 0;
        e = d; d = c; c = (bb << 30) | (bb >>> 2); bb = a; a = tmp;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + bb) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0;
    }

    /** Resumen de 20 bytes (Uint8Array). */
    digest() {
      if (!this.terminado) {
        const bits = this.longitud * 8;
        const cola = new Uint8Array(((this.nPendiente + 9 + 63) >> 6) * 64 - this.nPendiente);
        cola[0] = 0x80;
        const alto = Math.floor(bits / 0x100000000), bajo = bits >>> 0;
        const z = cola.length;
        cola[z - 8] = alto >>> 24; cola[z - 7] = alto >>> 16; cola[z - 6] = alto >>> 8; cola[z - 5] = alto;
        cola[z - 4] = bajo >>> 24; cola[z - 3] = bajo >>> 16; cola[z - 2] = bajo >>> 8; cola[z - 1] = bajo;
        const longitud = this.longitud;
        this.update(cola);
        this.longitud = longitud;
        this.terminado = true;
        this.resumen = new Uint8Array(20);
        for (let i = 0; i < 5; i++) {
          const v = this.h[i];
          this.resumen[4 * i] = v >>> 24; this.resumen[4 * i + 1] = v >>> 16;
          this.resumen[4 * i + 2] = v >>> 8; this.resumen[4 * i + 3] = v;
        }
      }
      return this.resumen.slice();
    }

    hexdigest() {
      let s = '';
      for (const b of this.digest()) s += (b < 16 ? '0' : '') + b.toString(16);
      return s;
    }
  }

  /** hashlib.sha1(datos).hexdigest(). */
  const hex = (datos) => new Sha1().update(datos).hexdigest();

  /** np.array(valores, dtype=np.int64).tobytes() (little-endian): números enteros o BigInt. */
  function bytesInt64(valores) {
    const a = new BigInt64Array(valores.length);
    for (let i = 0; i < valores.length; i++) a[i] = BigInt(valores[i]);
    const u = new Uint8Array(a.buffer);
    if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) { // máquina big-endian: se invierte cada entero
      for (let i = 0; i < u.length; i += 8) u.subarray(i, i + 8).reverse();
    }
    return u;
  }

  R2.py = R2.py || {};
  R2.py.sha1 = { Sha1, hex, utf8, bytesInt64 };
})(globalThis.R2 = globalThis.R2 || {});

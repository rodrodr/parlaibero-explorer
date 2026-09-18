







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

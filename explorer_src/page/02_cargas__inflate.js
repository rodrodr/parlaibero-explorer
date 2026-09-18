












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

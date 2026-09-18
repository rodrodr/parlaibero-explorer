
























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

/* ===== src/worker/transformar.js ===== */
/* Diarios Explorer · worker/transformar.js
 *
 * Transformaciones de tools/build_corpus.py (stage_db, fold, norm_value, split_words) con la semántica de
 * Python 3.12: str.strip/str.isspace, int(), str.isdigit. Funciones puras, sin SQLite.
 *
 * Tablas Unicode de Python 3.12.7 (unicodedata 15.0.0), generadas con:
 *   [cp for cp in range(0x110000) if chr(cp).isspace()]             → esEspacio
 *   bloques de chr(cp).isdecimal() (todos de 10, dígitos 0–9)       → INICIOS_DECIMALES
 *   chr(cp).isdigit() and not chr(cp).isdecimal()                    → RANGOS_DIGITOS_NO_DECIMALES
 *   category(chr(cp)) != 'Cn' y == 'Mn' (tools/make_casos_transformar.py) → TRAMOS_FOLD
 * fold() no depende de la versión Unicode del motor en los caracteres que Unicode 15.0 no tenía: los deja tal
 * cual, como Python, y quita las marcas Mn según la tabla de la 15.0 (no según \p{Mn} del motor). Del motor solo
 * usa normalize('NFD') y toLowerCase() sobre caracteres ya asignados en la 15.0, cuyas descomposiciones y clases
 * combinantes son estables por la política de estabilidad de Unicode. Comprobado en los 1.112.064 puntos de
 * código y en cadenas mezcladas (test/node/transformar.test.mjs). Requiere un motor con Unicode ≥ 15.0.
 */
(function (R2) {
  'use strict';

  const SIN_IDENTIFICAR = 'Sin identificar';

  /** Columnas del CSV, en orden (cabecera exacta). */
  const COLUMNAS_CSV = Object.freeze(['id_session', 'id_int', 'legislature', 'legislative_session', 'session_number', 'date',
    'session_type', 'intervention_order', 'speaker_raw', 'id_dep', 'speaker_name', 'sex', 'party', 'district', 'dm_speech', 'text']);

  /** Columnas de la tabla speeches_datos, en orden (las 23 de SCHEMA). */
  const COLUMNAS_BD = Object.freeze(['id', 'id_int', 'id_session', 'num_session', 'session_number', 'ord', 'date', 'year',
    'legislature', 'legislative_session', 'session_type', 'speaker', 'rep_id', 'id_dep', 'rep_name', 'sex', 'district', 'party',
    'dm_speech', 'nwords', 'bloque', 'desde', 'largo']);

  /** str.isspace() de Python para un punto de código (todos los espacios están en el BMP). */
  function esEspacio(cp) {
    return (cp >= 0x09 && cp <= 0x0d) || (cp >= 0x1c && cp <= 0x20) || cp === 0x85 || cp === 0xa0 ||
      cp === 0x1680 || (cp >= 0x2000 && cp <= 0x200a) || cp === 0x2028 || cp === 0x2029 ||
      cp === 0x202f || cp === 0x205f || cp === 0x3000;
  }

  /** str.strip() de Python (no String.prototype.trim, que usa otro conjunto de espacios). */
  function pyStrip(s) {
    let a = 0, z = s.length;
    while (a < z && esEspacio(s.charCodeAt(a))) a++;
    while (z > a && esEspacio(s.charCodeAt(z - 1))) z--;
    return a === 0 && z === s.length ? s : s.slice(a, z);
  }

  // Tramos de Unicode 15.0 (Python 3.12.7) en formato compacto: diferencias sucesivas en base 36
  // (a0, b0-a0, a1-b0, b1-a1, …). Los genera tools/make_casos_transformar.py (casos.json → tramos_fold) y el test
  // exige que sean idénticos. `asignados`: categoría distinta de Cn (incluye sustitutos y uso privado).
  const TRAMOS_FOLD = Object.freeze({
    asignados: '0,on,3,5,5,6,2,0,2,j,2,b0,2,11,3,1d,3,2,2,1i,9,q,5,5,c,7h,2,1n,3,2s,f,1m,3,1c,3,e,2,r,3,0,2,a,6,u,2,1,7,6j,2,7,3,1,3,l,2,6,2,0,4,3,3,8,3,1,3,3,9,0,5,1,2,4,3,o,3,2,2,5,5,1,3,l,2,6,2,1,2,1,2,1,3,0,2,4,5,1,3,2,4,0,8,3,2,0,8,g,b,2,2,8,2,2,2,l,2,6,2,1,2,4,3,9,2,2,2,2,3,0,g,3,3,b,8,6,2,2,2,7,3,1,3,l,2,6,2,1,2,4,3,8,3,1,3,2,8,2,5,1,2,4,3,h,b,1,2,5,4,2,2,3,4,1,2,0,2,1,4,1,4,2,4,b,5,4,4,2,2,3,3,0,7,0,f,k,6,c,2,2,2,m,2,f,3,8,2,2,2,3,8,1,2,2,3,0,3,3,3,9,8,l,2,2,2,m,2,9,2,4,3,8,2,2,2,3,8,1,7,1,2,3,3,9,2,2,d,c,2,2,2,1e,2,2,2,5,5,f,3,p,2,2,2,h,4,n,2,8,2,0,3,6,4,0,5,5,2,0,2,7,7,9,3,2,d,1l,5,s,12,1,2,0,2,4,2,n,2,0,2,m,3,4,2,0,2,6,2,9,3,3,x,1z,2,z,5,12,2,z,2,e,2,c,12,5h,2,0,6,0,3,ag,2,3,3,6,2,0,2,3,3,14,2,3,3,w,2,3,3,6,2,0,2,3,3,e,2,1k,2,3,3,1u,3,v,4,p,7,2d,3,5,3,ik,4,2g,8,l,a,n,a,j,d,c,2,2,2,1,d,2l,3,9,7,9,7,p,7,2g,8,16,6,1x,b,u,2,b,5,b,5,0,4,15,3,4,c,17,5,p,7,a,4,1p,3,1s,2,s,3,a,7,9,7,d,3,u,1e,24,4,1a,2,37,9,1n,4,e,4,1n,8,16,3,a,9,16,6,et,3,5,3,11,3,5,3,7,2,0,2,0,2,0,2,u,3,1g,2,e,2,d,3,5,2,i,3,2,2,8,2,2s,2,b,3,q,2,c,4,w,g,w,g,3v,5,ie,q,a,m,1eb,3,v,2,9o,6,18,2,0,6,0,3,1j,8,1,f,n,a,6,2,6,2,6,2,6,2,6,2,6,2,6,2,6,2,3h,z,p,2,2g,d,5x,r,b,5,1r,2,2d,3,2u,6,16,2,2l,2,2b,d,1a,2,mlo,4,1i,a,9n,l,53,9,5m,6,1,2,0,2,4,p,1m,4,9,7,1j,9,1x,9,b,7,37,c,t,4,25,2,a,5,w,2,1i,a,d,3,9,3,2u,p,r,b,5,3,5,3,5,a,6,2,6,2,1n,5,3h,3,9,7,8mb,d,m,5,1c,5,6st,3,2x,13,6,d,4,6,p,2,4,2,0,2,1,2,1,2,3g,h,cc,3,1h,8,0,x,15,7,1e,2,i,2,3,5,4,2,3q,3,0,2,59,4,5,3,5,3,5,3,2,4,6,2,6,b,4,3,b,2,p,2,i,2,1,2,e,3,d,z,3e,6,2,5,18,4,2f,2,c,4,0,1c,19,3n,s,4,1c,g,r,5,z,a,t,6,16,6,t,2,10,5,d,17,4d,3,9,7,z,5,z,5,13,9,1f,c,b,2,e,2,6,2,1,2,a,2,e,2,6,2,1,1w,8m,a,l,b,7,p,5,2,15,2,8,1y,5,3,0,2,17,2,1,4,0,3,m,2,1z,9,8,1d,i,2,1,6,w,4,q,6,0,1t,1j,5,j,3,1d,2,1,6,7,2,2,2,s,3,2,5,9,8,8,8,1r,x,12,5,b,a,1h,4,s,3,q,6,p,8,3,d,6,29,20,1k,1e,e,1e,8,19,9,9,87,u,2,15,2,2,3,1,24,16,9,15,n,p,13,r,l,m,a,25,5,z,a,1v,b,0,3,o,8,9,7,1g,2,h,9,12,a,2n,2,j,c,h,2,1a,1r,6,2,0,2,3,2,e,2,a,7,1m,6,9,7,3,2,7,3,1,3,l,2,6,2,1,2,4,2,9,3,1,3,2,3,0,7,0,6,6,3,6,4,4,3w,2j,2,4,v,1z,9,9,4n,1h,3,11,z,1w,c,9,7,c,k,1l,7,9,1j,q,3,e,5,m,56,1n,2t,2a,d,7,3,0,3,7,2,1,2,t,2,1,3,b,a,9,1z,7,3,19,3,a,s,1z,9,2a,e,20,8,9,6v,8,2,18,2,d,b,s,4,v,3,l,2,d,22,6,2,1,2,17,4,0,2,1,2,8,9,9,7,5,2,1,2,10,2,1,2,5,8,9,8n,o,8,g,2,14,4,r,2f,0,g,1d,e,pm,2v,32,2,4,c,5f,219,2q,e,ut,33f,g6,6nu,fs,8,u,2,9,5,28,2,9,7,t,3,5,b,1x,b,9,2,6,2,k,6,i,j5,2i,2u,22,5,1k,8,g,1t,4,c,1,f,4qf,9,yd,17,8,6w8,3,2,6,2,1,2,82,g,0,u,2,3,0,f,3,9,az,1s5,2y,6,c,4,8,8,9,3,7,3ml,19,3,m,a,37,1p,6t,b,12,3,5d,m,1x,3f,j,d,j,d,2e,a,o,3s,2c,2,1y,2,1,3,0,3,1,3,3,2,b,2,0,2,6,2,1s,2,3,3,7,2,6,2,r,2,3,2,4,2,0,4,6,2,9f,3,83,3,jh,g,4,2,e,up,u,7,5,5y,6,2,g,3,6,2,1,2,4,6,1p,y,0,35,18,4,d,3,9,5,1,8x,u,i,1l,6,0,cx,15,kn,6,2,3,2,1,2,e,2,5g,3,f,16,23,5,9,5,1,lu,1v,25,1o,5f,3,2,q,2,1,2,0,3,0,2,9,2,3,2,0,2,0,7,0,5,0,2,0,2,0,2,2,2,1,2,0,3,0,2,0,2,0,2,0,2,0,2,1,2,0,3,3,2,6,2,3,2,3,2,0,2,9,2,g,6,2,2,4,2,g,1h,1,7j,17,5,2r,d,e,3,e,2,e,2,10,b,4t,1l,s,e,17,5,8,8,1,f,5,4b,rb,5,g,4,c,4,3a,5,2m,7,b,5,0,g,b,5,1j,9,9,7,13,9,t,3,1,27,9f,d,d,3,c,4,8,8,19,2,6,9,d,5,8,8,8,8,42,2,1i,12,9,sn,wyn,x,37d,7,65,3,4g1,f,5rk,2e8,f1,15v,3t6,6,38f,f976,0,v,2n,3l,6n,1e6p,1ekd,3,1ekd',
    mn: 'lc,33,7o,4,7e,18,2,0,2,1,2,1,2,0,21,a,1d,k,h,0,2u,6,3,5,3,1,2,3,10,0,v,q,2k,a,1n,8,a,0,p,3,2,8,2,2,2,4,18,2,1p,7,17,n,2,v,1k,0,2,0,5,7,5,0,4,6,b,1,u,0,1n,0,5,3,9,0,l,1,r,0,3,1,1m,0,5,1,5,1,3,2,4,0,v,1,4,0,c,1,1m,0,5,4,2,1,5,0,l,1,n,5,2,0,1n,0,3,0,2,3,9,0,8,1,c,1,v,0,1q,0,d,0,1f,0,4,0,1k,0,2,2,6,2,2,3,8,1,c,1,u,0,1n,0,3,0,7,0,6,1,l,1,t,1,1m,1,5,3,9,0,l,1,u,0,21,0,8,2,2,0,2j,0,3,6,d,7,2r,0,3,8,c,6,22,1,s,0,2,0,2,0,1k,d,2,4,2,1,6,a,2,z,a,0,2v,3,2,5,2,1,3,1,q,1,5,2,h,3,e,0,3,1,7,0,g,0,jk,2,qb,2,u,1,v,1,v,1,1t,1,2,6,9,0,3,a,a,0,1a,2,2,0,3a,1,z,0,3b,2,5,1,a,0,7,2,64,1,3,0,1n,0,2,6,2,0,2,0,3,7,7,9,3,0,1d,d,2,f,1e,3,1d,0,2,4,2,0,6,0,15,8,d,1,x,3,3,1,2,2,1l,0,2,1,4,0,2,2,1n,7,3,1,49,2,2,c,2,6,5,0,7,0,4,1,5j,1r,k1,c,5,0,4,b,2db,2,3y,0,2p,v,ff,3,30,1,n9x,0,5,9,x,1,29,1,7l,0,4,0,5,0,q,1,6,0,48,1,r,h,e,0,13,7,q,a,1b,2,1d,0,3,3,3,1,14,0,1w,5,3,1,3,1,d,0,9,0,1c,0,1g,0,2,2,3,1,6,1,2,0,17,1,9,0,6n,0,3,0,5,0,fn5,0,ki,f,h,f,r2,0,6b,0,46,4,1af,2,2,1,6,3,15,2,5,0,4m,1,fy,3,as,1,29,2,1z,a,1e,3,3g,0,1j,e,16,0,3,1,b,2,1e,3,3,1,8,0,1q,2,11,4,2,7,1r,0,d,1,1h,8,b,3,3,0,2o,2,3,0,2,1,7,0,3,0,4e,0,4,7,m,1,1m,1,4,0,12,6,4,4,5g,7,3,2,2,0,o,0,2d,5,2,0,5,1,2,1,6n,3,7,1,2,1,s,1,2e,7,3,0,2,1,2z,0,2,0,3,5,2,0,2u,2,3,3,2,4,78,8,2,1,75,1,2,0,5,0,41,3,3,1,5,0,x,9,15,5,3,3,9,0,a,5,3,2,1b,c,2,1,bb,6,2,5,2,0,2b,l,3,6,2,1,2,1,3f,5,4,0,2,1,2,6,2,0,21,1,4,0,2,0,9o,1,c,1,1h,4,6,0,2,0,45a,0,7,e,asb,4,1o,6,t5,0,1s,3,2a,0,f5l,1,3mq,19,3,m,f5,2,i,7,3,6,v,3,45,2,1j0,1i,5,1d,9,0,f,0,n,4,2,e,11t,6,2,g,3,6,2,1,2,4,2t,0,4h,6,ag,0,1q,3,e5,3,rl,6,32,6,gzhy,6n',
  });

  function decodificarTramos(texto) {
    const n = texto.split(',').map((x) => parseInt(x, 36));
    const t = new Int32Array(n.length);
    let v = 0;
    for (let i = 0; i < n.length; i++) { v += n[i]; t[i] = v; }
    return t;
  }
  const ASIGNADOS_15 = decodificarTramos(TRAMOS_FOLD.asignados);
  const MN_15 = decodificarTramos(TRAMOS_FOLD.mn);

  /** ¿Está cp en alguno de los tramos [t[2k], t[2k+1]]? */
  function enTramos(t, cp) {
    let lo = 0, hi = t.length / 2 - 1;
    if (cp < t[0] || cp > t[t.length - 1]) return false;
    while (lo < hi) { // último tramo que empieza en cp o antes
      const m = (lo + hi + 1) >> 1;
      if (t[2 * m] <= cp) lo = m; else hi = m - 1;
    }
    return cp <= t[2 * lo + 1];
  }

  /** NFD, sin marcas Mn de Unicode 15.0 y minúsculas, para un tramo sin caracteres sin asignar en la 15.0. */
  function plegarTramo(x) {
    if (x === '') return x;
    const d = x.normalize('NFD');
    let r = '', desde = 0;
    for (let i = 0; i < d.length;) {
      const cp = d.codePointAt(i), n = cp > 0xffff ? 2 : 1;
      if (cp >= 0x300 && enTramos(MN_15, cp)) { r += d.slice(desde, i); desde = i + n; }
      i += n;
    }
    return (desde === 0 ? d : r + d.slice(desde)).toLowerCase();
  }

  /**
   * fold() de build_corpus.py: NFD, sin marcas Mn, minúsculas y strip, en ese orden. Los caracteres sin asignar en
   * Unicode 15.0 se copian tal cual y parten la cadena en tramos. Es equivalente a hacerlo todo junto: para Python
   * son de clase combinante 0 (la reordenación NFD no los cruza), no son Mn, no tienen minúscula y no son «cased»
   * ni «case-ignorable» (la sigma final mira igual a través de ellos que a través de un fin de tramo).
   */
  function fold(s) {
    const t = s || '';
    let r = '', desde = 0;
    for (let i = 0; i < t.length;) {
      const cp = t.codePointAt(i), n = cp > 0xffff ? 2 : 1;
      if (cp >= 0x378 && !enTramos(ASIGNADOS_15, cp)) { // U+0378 es el primer punto sin asignar
        r += plegarTramo(t.slice(desde, i)) + t.slice(i, i + n);
        desde = i + n;
      }
      i += n;
    }
    return pyStrip(desde === 0 ? plegarTramo(t) : r + plegarTramo(t.slice(desde)));
  }

  // Pares [desde, hasta] de los tramos de dígitos decimales (Nd) de Python 3.12.7. Todos son series de 0–9
  // seguidas (U+1D7CE–1D7FF son cinco), así que el valor es (cp - desde) % 10.
  const RANGOS_DECIMALES = [0x30, 0x39, 0x660, 0x669, 0x6F0, 0x6F9, 0x7C0, 0x7C9, 0x966, 0x96F, 0x9E6, 0x9EF,
    0xA66, 0xA6F, 0xAE6, 0xAEF, 0xB66, 0xB6F, 0xBE6, 0xBEF, 0xC66, 0xC6F, 0xCE6, 0xCEF, 0xD66, 0xD6F, 0xDE6, 0xDEF,
    0xE50, 0xE59, 0xED0, 0xED9, 0xF20, 0xF29, 0x1040, 0x1049, 0x1090, 0x1099, 0x17E0, 0x17E9, 0x1810, 0x1819,
    0x1946, 0x194F, 0x19D0, 0x19D9, 0x1A80, 0x1A89, 0x1A90, 0x1A99, 0x1B50, 0x1B59, 0x1BB0, 0x1BB9, 0x1C40, 0x1C49,
    0x1C50, 0x1C59, 0xA620, 0xA629, 0xA8D0, 0xA8D9, 0xA900, 0xA909, 0xA9D0, 0xA9D9, 0xA9F0, 0xA9F9, 0xAA50, 0xAA59,
    0xABF0, 0xABF9, 0xFF10, 0xFF19, 0x104A0, 0x104A9, 0x10D30, 0x10D39, 0x11066, 0x1106F, 0x110F0, 0x110F9,
    0x11136, 0x1113F, 0x111D0, 0x111D9, 0x112F0, 0x112F9, 0x11450, 0x11459, 0x114D0, 0x114D9, 0x11650, 0x11659,
    0x116C0, 0x116C9, 0x11730, 0x11739, 0x118E0, 0x118E9, 0x11950, 0x11959, 0x11C50, 0x11C59, 0x11D50, 0x11D59,
    0x11DA0, 0x11DA9, 0x11F50, 0x11F59, 0x16A60, 0x16A69, 0x16AC0, 0x16AC9, 0x16B50, 0x16B59, 0x1D7CE, 0x1D7FF,
    0x1E140, 0x1E149, 0x1E2F0, 0x1E2F9, 0x1E4F0, 0x1E4F9, 0x1E950, 0x1E959, 0x1FBF0, 0x1FBF9];

  // Pares [desde, hasta] de caracteres con isdigit() y sin isdecimal() (superíndices, dígitos rodeados…).
  const RANGOS_DIGITOS_NO_DECIMALES = [0xB2, 0xB3, 0xB9, 0xB9, 0x1369, 0x1371, 0x19DA, 0x19DA, 0x2070, 0x2070,
    0x2074, 0x2079, 0x2080, 0x2089, 0x2460, 0x2468, 0x2474, 0x247C, 0x2488, 0x2490, 0x24EA, 0x24EA, 0x24F5,
    0x24FD, 0x24FF, 0x24FF, 0x2776, 0x277E, 0x2780, 0x2788, 0x278A, 0x2792, 0x10A40, 0x10A43, 0x10E60, 0x10E68,
    0x11052, 0x1105A, 0x1F100, 0x1F10A];

  /** Valor 0–9 si el punto de código es un dígito decimal (str.isdecimal), o -1. */
  function valorDecimal(cp) {
    if (cp >= 0x30 && cp <= 0x39) return cp - 0x30;
    if (cp < 0x660) return -1;
    const R = RANGOS_DECIMALES;
    let lo = 0, hi = R.length / 2 - 1; // búsqueda binaria del último tramo que empieza en cp o antes
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (R[2 * m] <= cp) lo = m; else hi = m - 1;
    }
    return cp <= R[2 * lo + 1] ? (cp - R[2 * lo]) % 10 : -1;
  }

  /** str.isdigit() de Python para un punto de código. */
  function esDigito(cp) {
    if (valorDecimal(cp) >= 0) return true;
    const R = RANGOS_DIGITOS_NO_DECIMALES;
    for (let i = 0; i < R.length; i += 2) if (cp >= R[i] && cp <= R[i + 1]) return true;
    return false;
  }

  /** Error de conversión de un valor; la ingesta lo convierte en ENTERO_NO_VALIDO con su fila. */
  class ErrorValor extends Error {
    constructor(motivo, valor) {
      super(`valor no válido (${motivo}): ${String(valor).slice(0, 60)}`);
      this.name = 'ErrorValor';
      this.motivo = motivo; // 'literal' | 'limite'
      this.valor = valor;
    }
  }

  const LIMITE_CIFRAS = 4300; // sys.int_info.default_max_str_digits
  const esEspacioAscii = (c) => c === 0x20 || (c >= 0x09 && c <= 0x0d); // Py_ISSPACE

  /**
   * int(s) de Python 3.12 en base 10. Devuelve number si cabe con exactitud y BigInt si no; lanza ErrorValor.
   * Réplica de PyLong_FromUnicodeObject: primero _PyUnicode_TransformDecimalAndSpaceToASCII (espacios
   * Unicode → ' ', dígitos decimales Unicode → ASCII) y luego PyLong_FromString (espacios ASCII alrededor,
   * signo, guiones bajos solo entre cifras y límite de 4.300 cifras).
   */
  function pyInt(s) {
    let t = '';
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (cp < 127) t += ch;
      else if (esEspacio(cp)) t += ' ';
      else {
        const d = valorDecimal(cp);
        if (d < 0) throw new ErrorValor('literal', s);
        t += String.fromCharCode(0x30 + d);
      }
    }
    const n = t.length;
    let i = 0;
    while (i < n && esEspacioAscii(t.charCodeAt(i))) i++;
    let negativo = false;
    if (t[i] === '+') i++;
    else if (t[i] === '-') { negativo = true; i++; }
    let cifras = '', anterior = '';
    if (t[i] === '_') throw new ErrorValor('literal', s);
    for (; i < n; i++) {
      const c = t.charCodeAt(i);
      if (c >= 0x30 && c <= 0x39) cifras += t[i];
      else if (c === 0x5f) { if (anterior === '_') throw new ErrorValor('literal', s); }
      else break;
      anterior = t[i];
    }
    if (anterior === '_' || cifras.length === 0) throw new ErrorValor('literal', s);
    while (i < n && esEspacioAscii(t.charCodeAt(i))) i++;
    if (i !== n) throw new ErrorValor('literal', s);
    if (cifras.length > LIMITE_CIFRAS) throw new ErrorValor('limite', s);
    if (cifras.length <= 15) {
      const v = Number(cifras);
      return negativo && v !== 0 ? -v : v;
    }
    const b = negativo ? -BigInt(cifras) : BigInt(cifras);
    return b >= BigInt(Number.MIN_SAFE_INTEGER) && b <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(b) : b;
  }

  /** year = int(date[:4]) if date[:4].isdigit() else None */
  function anio(fecha) {
    const pref = [];
    for (const ch of fecha) {
      if (pref.length === 4) break;
      pref.push(ch);
    }
    if (pref.length === 0) return null;
    for (const ch of pref) if (!esDigito(ch.codePointAt(0))) return null;
    return pyInt(pref.join('')); // lanza con dígitos no decimales («²»), igual que int() en Python
  }

  /** len(split_words(texto)): tramos máximos de caracteres que no son isspace. */
  function contarPalabras(texto) {
    let n = 0, dentro = false;
    for (let i = 0; i < texto.length; i++) {
      const espacio = esEspacio(texto.charCodeAt(i));
      if (!espacio && !dentro) n++;
      dentro = !espacio;
    }
    return n;
  }

  /**
   * contarPalabras sobre bytes UTF-8 válidos, sin crear la cadena. Los espacios multibyte de Python son
   * U+0085, U+00A0 (C2 xx), U+1680 (E1 9A 80), U+2000–200A, U+2028/2029, U+202F (E2 80 xx),
   * U+205F (E2 81 9F) y U+3000 (E3 80 80). Un byte de continuación nunca empieza uno de ellos.
   */
  function contarPalabrasUtf8(b, a, z) {
    let n = 0, dentro = false, i = a;
    while (i < z) {
      const c = b[i];
      let largo = 0; // bytes del espacio que empieza en i (0 = no es espacio)
      if (c < 0x80) {
        if ((c >= 0x09 && c <= 0x0d) || (c >= 0x1c && c <= 0x20)) largo = 1;
      } else if (c === 0xc2) {
        if (b[i + 1] === 0x85 || b[i + 1] === 0xa0) largo = 2;
      } else if (c === 0xe1) {
        if (b[i + 1] === 0x9a && b[i + 2] === 0x80) largo = 3;
      } else if (c === 0xe2) {
        const c1 = b[i + 1], c2 = b[i + 2];
        if (c1 === 0x80 && ((c2 >= 0x80 && c2 <= 0x8a) || c2 === 0xa8 || c2 === 0xa9 || c2 === 0xaf)) largo = 3;
        else if (c1 === 0x81 && c2 === 0x9f) largo = 3;
      } else if (c === 0xe3) {
        if (b[i + 1] === 0x80 && b[i + 2] === 0x80) largo = 3;
      }
      if (largo) { dentro = false; i += largo; }
      else { if (!dentro) { n++; dentro = true; } i++; }
    }
    return n;
  }

  /** norm_value(raw, table): recorta y busca en la tabla; si no está, el valor recortado o «Sin identificar». */
  function normValue(crudo, tabla) {
    const v = pyStrip(crudo || '');
    if (Object.prototype.hasOwnProperty.call(tabla, v)) return tabla[v];
    return v || SIN_IDENTIFICAR;
  }

  // ------------------------------------------------------------------ derivaciones por columna
  // Cada una reproduce una parte de la tupla de stage_db. La ingesta las memoriza por valor distinto.

  /** Valor entero opcional (`int(x) if x else None`). */
  const enteroOpcional = (s) => (s === '' ? null : pyInt(s));

  const derivar = {
    fecha: (date) => ({ date: date || null, year: anio(date) }),
    orador: (speaker) => ({ speaker: pyStrip(speaker), speaker_fold: fold(speaker) }),
    diputado: (repName) => {
      const rep_name = pyStrip(repName) || SIN_IDENTIFICAR;
      return { rep_name, rep_name_fold: fold(rep_name) };
    },
    sinIdentificar: (s) => pyStrip(s) || SIN_IDENTIFICAR, // district, legislature
  };

  R2.transformar = {
    SIN_IDENTIFICAR, COLUMNAS_CSV, COLUMNAS_BD, TRAMOS_FOLD,
    esEspacio, pyStrip, fold, valorDecimal, esDigito, pyInt, anio, contarPalabras, contarPalabrasUtf8, normValue,
    enteroOpcional, derivar, ErrorValor,
  };
})(globalThis.R2 = globalThis.R2 || {});

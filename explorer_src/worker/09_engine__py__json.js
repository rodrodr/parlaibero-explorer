/* ===== src/engine/py/json.js ===== */
/* 2REP_Standalone · engine/py/json.js
 *
 * R2.py.json: json.dumps de Python 3.12 byte a byte (mismos bytes que el codificador en C sin indent y que el de
 * Python con indent): skipkeys, ensure_ascii, check_circular, allow_nan, indent (número o cadena), separators,
 * default y sort_keys.
 *
 * Tipos (convención de R2.py.core): null → null · boolean → true/false · number entero o BigInt → int ·
 * number no entero, NaN, ±Infinity o PyFloat → float (repr de Python: 1e+16, 1e-05, NaN, Infinity) · string →
 * str · Array → list/tuple · Map → dict (orden de inserción; claves str, int, float, bool o None) · objeto
 * plano → dict con claves str.
 * Límites: un float con valor entero debe ir como PyFloat (F(3) → «3.0»); en un objeto plano JS las claves que
 * parecen enteros se recorren antes que las demás, así que para conservar el orden de inserción hace falta Map.
 * Cualquier otro valor (undefined, Date, clases) pasa por `default` o da TypeError, como en Python.
 */
(function (R2) {
  'use strict';

  const C = R2.py.core;
  const { PyError, esFloatEnvuelto } = C;

  const ESC = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' };
  const hex4 = (c) => '\\u' + c.toString(16).padStart(4, '0');
  const reemplazo = (ch) => ESC[ch] || hex4(ch.charCodeAt(0));

  const RE_UNICODE = /[\x00-\x1f"\\]/;
  const RE_UNICODE_G = /[\x00-\x1f"\\]/g;
  const RE_ASCII = /[^\x20-\x7e]|["\\]/;
  const RE_ASCII_G = /[^\x20-\x7e]|["\\]/g; // sin flag u: cada sustituto se escapa por separado, como Python

  /** encode_basestring (ensure_ascii=False): escapa «"», «\» y los controles U+0000–U+001F. */
  function encodeBasestring(s) {
    return '"' + (RE_UNICODE.test(s) ? s.replace(RE_UNICODE_G, reemplazo) : s) + '"';
  }

  /** encode_basestring_ascii (ensure_ascii=True): además, todo lo que no es ASCII imprimible (\u007f incluido). */
  function encodeBasestringAscii(s) {
    return '"' + (RE_ASCII.test(s) ? s.replace(RE_ASCII_G, reemplazo) : s) + '"';
  }

  function floatstr(x, allowNan) {
    let t;
    if (x !== x) t = 'NaN';
    else if (x === Infinity) t = 'Infinity';
    else if (x === -Infinity) t = '-Infinity';
    else return C.reprFloat(x);
    if (!allowNan) throw new PyError('ValueError', 'Out of range float values are not JSON compliant: ' + C.reprFloat(x));
    return t;
  }

  const nombreClase = (o) => {
    if (o === undefined) return 'undefined';
    if (typeof o === 'function') return 'function';
    return (o && o.constructor && o.constructor.name) || typeof o;
  };

  function esObjetoPlano(o) {
    const p = Object.getPrototypeOf(o);
    return p === Object.prototype || p === null;
  }

  /**
   * json.dumps(obj, opciones). Opciones con los nombres de Python: skipkeys, ensure_ascii (true), check_circular
   * (true), allow_nan (true), indent (null), separators ([item, clave] o null), default (función), sort_keys.
   */
  function dumps(obj, opciones = {}) {
    const {
      skipkeys = false, ensure_ascii = true, check_circular = true, allow_nan = true, indent = null,
      separators = null, sort_keys = false,
    } = opciones;
    const porDefecto = opciones.default || null;
    const sangria = indent === null || indent === undefined ? null
      : (typeof indent === 'string' ? indent : ' '.repeat(Math.max(0, indent)));
    let sepItem, sepClave;
    if (separators) [sepItem, sepClave] = separators;
    else { sepItem = sangria !== null ? ',' : ', '; sepClave = ': '; }
    const codificar = ensure_ascii ? encodeBasestringAscii : encodeBasestring;
    const marcas = check_circular ? new Set() : null;
    const partes = [];

    const marcar = (o) => {
      if (!marcas) return;
      if (marcas.has(o)) throw new PyError('ValueError', 'Circular reference detected');
      marcas.add(o);
    };

    function clave(k) {
      switch (typeof k) {
        case 'string': return k;
        case 'boolean': return k ? 'true' : 'false';
        case 'bigint': return k.toString();
        case 'number': return Number.isInteger(k) ? C.intStr(k) : floatstr(k, allow_nan);
        default:
          if (k === null) return 'null';
          if (esFloatEnvuelto(k)) return floatstr(C.num(k), allow_nan);
          return undefined;
      }
    }

    function valor(o, nivel) {
      switch (typeof o) {
        case 'string': partes.push(codificar(o)); return;
        case 'boolean': partes.push(o ? 'true' : 'false'); return;
        case 'bigint': partes.push(o.toString()); return;
        case 'number': partes.push(Number.isInteger(o) ? C.intStr(o) : floatstr(o, allow_nan)); return;
        case 'object':
          if (o === null) { partes.push('null'); return; }
          if (esFloatEnvuelto(o)) { partes.push(floatstr(C.num(o), allow_nan)); return; }
          if (Array.isArray(o)) { lista(o, nivel); return; }
          if (o instanceof Map) { dict([...o], nivel, o); return; }
          if (esObjetoPlano(o)) { dict(Object.keys(o).map((k) => [k, o[k]]), nivel, o); return; }
          break;
        default:
      }
      if (!porDefecto) throw new PyError('TypeError', `Object of type ${nombreClase(o)} is not JSON serializable`);
      const esObj = o !== null && (typeof o === 'object' || typeof o === 'function');
      if (esObj) marcar(o);
      valor(porDefecto(o), nivel);
      if (esObj && marcas) marcas.delete(o);
    }

    function lista(l, nivel) {
      if (l.length === 0) { partes.push('[]'); return; }
      marcar(l);
      partes.push('[');
      let sep = sepItem, nueva = null;
      if (sangria !== null) {
        nivel++;
        nueva = '\n' + sangria.repeat(nivel);
        sep = sepItem + nueva;
        partes.push(nueva);
      }
      for (let i = 0; i < l.length; i++) {
        if (i) partes.push(sep);
        valor(l[i], nivel);
      }
      if (nueva !== null) partes.push('\n' + sangria.repeat(nivel - 1));
      partes.push(']');
      if (marcas) marcas.delete(l);
    }

    function dict(items, nivel, o) {
      if (items.length === 0) { partes.push('{}'); return; }
      marcar(o);
      partes.push('{');
      let sep = sepItem, nueva = null;
      if (sangria !== null) {
        nivel++;
        nueva = '\n' + sangria.repeat(nivel);
        sep = sepItem + nueva;
        partes.push(nueva);
      }
      // sorted(dct.items()): se comparan las tuplas (clave, valor); las claves son distintas.
      if (sort_keys) items = C.sorted(items, { key: (kv) => kv[0] });
      let primero = true;
      for (const [k, v] of items) {
        const ks = clave(k);
        if (ks === undefined) {
          if (skipkeys) continue;
          throw new PyError('TypeError', `keys must be str, int, float, bool or None, not ${Array.isArray(k) ? 'tuple' : nombreClase(k)}`);
        }
        if (primero) primero = false; else partes.push(sep);
        partes.push(codificar(ks), sepClave);
        valor(v, nivel);
      }
      if (nueva !== null) partes.push('\n' + sangria.repeat(nivel - 1));
      partes.push('}');
      if (marcas) marcas.delete(o);
    }

    valor(obj, 0);
    return partes.join('');
  }

  R2.py = R2.py || {};
  R2.py.json = { dumps, encodeBasestring, encodeBasestringAscii };
})(globalThis.R2 = globalThis.R2 || {});

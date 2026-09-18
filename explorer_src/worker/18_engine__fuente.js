/* ===== src/engine/fuente.js ===== */
// 2REP_Standalone · src/engine/fuente.js
//
// Port exacto de app/backend/fuente.py: la cita del conjunto de datos que acompaña a toda salida.
// Registra R2.fuente. Dependencias (cargadas antes, ver src/orden.json):
//   - R2.py.core (engine/py/core.js): str(), strip/lstrip, PyError y el modelo de valores Python;
//   - R2.py.json (engine/py/json.js): json.dumps(ensure_ascii=False);
//   - R2.py.re (engine/py/re.js): las seis expresiones regulares de fuente.py, traducidas con la semántica de sre
//     (\s y \w de Python 3.12 / Unicode 15.0), las mismas que verifica la suite 0;
//   - R2.gen.constantes.fuente (engine/generated/constantes.js): SIN_FUENTE, N_LINEAS, ORIGEN_IMPORTADA, _FORMULA;
//   - R2.transformar (grupo worker): TRAMOS_FOLD.asignados, la tabla de puntos de código asignados en Unicode 15.0
//     con la que _ascii() hace el NFKD de Python 3.12 (R2.py.core no ofrece unicodedata.normalize).
//
// Modelo de valores Python en JS (el de R2.py.core y parity/lib/normalize.mjs → pyLoads):
//   None → null (o undefined) · bool → boolean · int → número entero o BigInt ·
//   float → número no entero, o PyFloat / { [Symbol.for('R2.py.float')]: true, valor } para los floats enteros (1931.0)
//   str → string · list → Array · dict → Map (conserva el orden exacto de Python) u objeto plano (JSON.parse: ojo, las
//   claves numéricas se reordenan).
// Los dicts que copian claves arbitrarias (autores y publicación relacionada en desde_metadatos) salen del mismo tipo
// que la entrada. Las operaciones que en Python lanzan con tipos erróneos lanzan aquí R2.py.core.PyError con `pyTipo`
// igual a la clase de la excepción de Python (AttributeError, TypeError).
(function (R2) {
  'use strict';

  const falta = [
    ['R2.py.core', R2.py && R2.py.core], ['R2.py.json', R2.py && R2.py.json], ['R2.py.re', R2.py && R2.py.re],
    ['R2.gen.constantes.fuente', R2.gen && R2.gen.constantes && R2.gen.constantes.fuente],
    ['R2.transformar', R2.transformar],
  ].filter(([, m]) => !m).map(([n]) => n);
  if (falta.length) throw new Error(`engine/fuente.js necesita cargados antes: ${falta.join(', ')} (src/orden.json)`);

  const C = R2.py.core;
  const RE = R2.py.re;
  const K = R2.gen.constantes.fuente;
  const { PyError, esFloatEnvuelto } = C;

  // ------------------------------------------------------------------ expresiones regulares de fuente.py --
  const _CONTROL = RE.compile('[\\x00-\\x1f\\x7f-\\x9f\\u2028\\u2029]+');
  const _YAML_NO_IMPRIMIBLE = RE.compile('[\\x7f-\\x9f\\u2028\\u2029\\ud800-\\udfff\\ufeff\\ufffe\\uffff]');
  const RX_ESPACIOS = RE.compile('\\s{2,}');
  const RX_NO_AZ09 = RE.compile('[^a-z0-9]');
  const RX_NO_CLAVE = RE.compile('[^\\w:-]');
  const RX_PALABRAS = RE.compile('\\w+');

  // ---------------------------------------------------------------- Unicode 15.0 (unicodedata de Python 3.12.7) --
  const ASIGNADOS_15 = (() => {
    const n = R2.transformar.TRAMOS_FOLD.asignados.split(',').map((x) => parseInt(x, 36));
    const t = new Int32Array(n.length);
    let v = 0;
    for (let i = 0; i < n.length; i++) { v += n[i]; t[i] = v; }
    return t;
  })();

  /** ¿Punto de código asignado (categoría ≠ Cn) en Unicode 15.0? */
  function asignado15(cp) {
    const t = ASIGNADOS_15;
    if (cp < t[0] || cp > t[t.length - 1]) return false;
    let lo = 0, hi = t.length / 2 - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (t[2 * m] <= cp) lo = m; else hi = m - 1;
    }
    return cp <= t[2 * lo + 1];
  }

  // ------------------------------------------------------------------------------------------ valores Python --
  const esNone = (v) => v === null || v === undefined;
  const esFloat = (v) => (typeof v === 'number' && !Number.isInteger(v)) || esFloatEnvuelto(v);
  const esInt = (v) => typeof v === 'bigint' || (typeof v === 'number' && Number.isInteger(v));
  const esDict = (v) => v instanceof Map || (v !== null && typeof v === 'object' && !Array.isArray(v) && !esFloatEnvuelto(v));

  function tipoPy(v) {
    if (esNone(v)) return 'NoneType';
    if (typeof v === 'boolean') return 'bool';
    if (esFloat(v)) return 'float';
    if (esInt(v)) return 'int';
    if (typeof v === 'string') return 'str';
    if (Array.isArray(v)) return 'list';
    if (esDict(v)) return 'dict';
    return typeof v;
  }

  /** Veracidad de Python. */
  function verdad(v) {
    if (esNone(v) || v === false) return false;
    if (v === true) return true;
    if (typeof v === 'bigint') return v !== 0n;
    if (typeof v === 'number') return v !== 0; // NaN es verdadero; -0 es falso
    if (typeof v === 'string' || Array.isArray(v)) return v.length > 0;
    if (v instanceof Map) return v.size > 0;
    if (esFloatEnvuelto(v)) return v.valor !== 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }

  /** `a or b` */
  const o = (a, b) => (verdad(a) ? a : b);

  /** d.get(k, defecto): AttributeError si d no es un dict. */
  function dget(d, k, defecto = null) {
    if (d instanceof Map) return d.has(k) ? d.get(k) : defecto;
    if (esDict(d)) return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : defecto;
    throw new PyError('AttributeError', `'${tipoPy(d)}' object has no attribute 'get'`);
  }

  function items(d) {
    return d instanceof Map ? Array.from(d.entries()) : Object.keys(d).map((k) => [k, d[k]]);
  }

  /** Dict vacío del mismo tipo que `modelo` (Map u objeto plano). */
  const dictComo = (modelo) => (modelo instanceof Map ? new Map() : {});

  /** d[k] = v sin tocar prototipos (una clave «__proto__» es una clave más). */
  function poner(d, k, v) {
    if (d instanceof Map) d.set(k, v);
    else Object.defineProperty(d, k, { value: v, writable: true, enumerable: true, configurable: true });
  }

  /** `for x in v` */
  function iterar(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return Array.from(v);
    if (v instanceof Map) return Array.from(v.keys());
    if (esDict(v)) return Object.keys(v);
    throw new PyError('TypeError', `'${tipoPy(v)}' object is not iterable`);
  }

  /** v.<metodo>() de str: AttributeError si v no es str. */
  function comoStr(v, metodo) {
    if (typeof v !== 'string') throw new PyError('AttributeError', `'${tipoPy(v)}' object has no attribute '${metodo}'`);
    return v;
  }

  /** re.<función>(patrón, v): TypeError si v no es str. */
  function reStr(v) {
    if (typeof v !== 'string') throw new PyError('TypeError', `expected string or bytes-like object, got '${tipoPy(v)}'`);
    return v;
  }

  /** sep.join(partes) */
  function unir(sep, partes) {
    partes.forEach((p, i) => {
      if (typeof p !== 'string') throw new PyError('TypeError', `sequence item ${i}: expected str instance, ${tipoPy(p)} found`);
    });
    return partes.join(sep);
  }

  const hex = (n, ancho) => n.toString(16).padStart(ancho, '0');

  /** str(v) y f"{v}" de Python. */
  const pyStr = (v) => (typeof v === 'string' ? v : C.pyStr(v));

  /** json.dumps(v, ensure_ascii=False) con los separadores por defecto (', ' y ': '). */
  const dumps = (v) => R2.py.json.dumps(v, { ensure_ascii: false });

  // ------------------------------------------------------------------------------------------ fuente.py --
  /** Texto en una sola línea: sin saltos ni caracteres de control. */
  function _una_linea(s) {
    return C.strip(RX_ESPACIOS.sub(' ', _CONTROL.sub(' ', pyStr(s))));
  }

  function _autores(f) {
    const out = [];
    for (const a of iterar(o(dget(f, 'autores'), []))) {
      if (verdad(dget(a, 'nombre'))) out.push(C.strip(comoStr(dget(a, 'nombre', ''), 'strip')));
    }
    return out;
  }

  function url(f) {
    if (!verdad(f)) return '';
    if (verdad(dget(f, 'url'))) return dget(f, 'url');
    return verdad(dget(f, 'doi')) ? `https://doi.org/${pyStr(dget(f, 'doi'))}` : '';
  }

  /** Cita completa. Usa la cadena oficial del repositorio si está en el manifest. */
  function cita(f) {
    if (!verdad(f)) return K.SIN_FUENTE;
    if (verdad(dget(f, 'cita'))) return dget(f, 'cita');
    const partes = [unir('; ', _autores(f)), pyStr(o(dget(f, 'anio'), '')), `"${pyStr(dget(f, 'titulo', ''))}"`,
      url(f), dget(f, 'editor', ''), dget(f, 'version_cita', '')];
    return unir(', ', partes.filter(verdad));
  }

  /** Forma breve para columnas y pies: «<primer autor> et al. (<año>), <título>, doi:…». */
  function cita_corta(f) {
    if (!verdad(f)) return K.SIN_FUENTE;
    const aut = _autores(f);
    const primero = aut.length ? aut[0].split(',')[0] : o(dget(f, 'editor'), '');
    let quien;
    if (aut.length > 2) quien = `${pyStr(primero)} et al.`;
    else quien = o(unir(' y ', aut.map((a) => a.split(',')[0])), primero);
    const titulo = comoStr(o(dget(f, 'titulo'), ''), 'split').split(':')[0];
    const doi = verdad(dget(f, 'doi')) ? `doi:${pyStr(dget(f, 'doi'))}` : url(f);
    return unir(', ', [`${pyStr(quien)} (${pyStr(dget(f, 'anio', 's. f.'))})`, titulo, doi].filter(verdad));
  }

  function licencia(f) {
    if (!verdad(f) || !verdad(dget(f, 'licencia'))) return '';
    return verdad(dget(f, 'licencia_url'))
      ? `${pyStr(dget(f, 'licencia'))} (${pyStr(dget(f, 'licencia_url'))})`
      : dget(f, 'licencia');
  }

  const vacioMetadatos = (v) => esNone(v) || v === '' || (Array.isArray(v) && v.length === 0);

  /** Bloque de metadatos de la fuente para JSON, .2replib y manifiestos de exportación. */
  function metadatos(f) {
    if (!verdad(f)) return { declarada: false, cita: K.SIN_FUENTE };
    const pares = [
      ['declarada', true],
      ['cita', cita(f)],
      ['cita_corta', cita_corta(f)],
      ['titulo', dget(f, 'titulo')],
      ['autores', o(dget(f, 'autores'), [])],
      ['anio', dget(f, 'anio')],
      ['editor', dget(f, 'editor')],
      ['doi', dget(f, 'doi')],
      ['url', url(f)],
      ['version', dget(f, 'version_cita')],
      ['version_metadatos', dget(f, 'version_metadatos')],
      ['licencia', dget(f, 'licencia')],
      ['licencia_url', dget(f, 'licencia_url')],
    ];
    if (verdad(dget(f, 'publicacion_relacionada'))) pares.push(['publicacion_relacionada', dget(f, 'publicacion_relacionada')]);
    if (verdad(dget(f, 'origen'))) pares.push(['origen', dget(f, 'origen')]);
    const out = {};
    for (const [k, v] of pares) if (!vacioMetadatos(v)) out[k] = v;
    return out;
  }

  /** Líneas de cabecera para CSV/TXT (con prefijo de comentario) o pies de documento: siempre N_LINEAS. */
  function lineas(f, prefijo = '# ') {
    let ls;
    if (!verdad(f)) {
      ls = [`Fuente: ${K.SIN_FUENTE}`, 'DOI: no declarado', 'Licencia de los datos: no declarada',
        'Publicación relacionada: no declarada'];
    } else {
      const rel = o(dget(f, 'publicacion_relacionada'), {});
      const l1 = `Fuente (cite siempre): ${pyStr(cita(f))}`;
      let l2;
      if (verdad(dget(f, 'doi'))) l2 = `DOI: ${pyStr(dget(f, 'doi'))} · ${pyStr(url(f))}`;
      else l2 = verdad(url(f)) ? `DOI: no declarado · ${pyStr(url(f))}` : 'DOI: no declarado';
      const l3 = `Licencia de los datos: ${pyStr(o(licencia(f), 'no declarada'))}`;
      let l4;
      if (verdad(dget(rel, 'titulo'))) {
        l4 = `Publicación relacionada: ${pyStr(dget(rel, 'titulo'))}` +
          (verdad(dget(rel, 'doi')) ? ` (doi:${pyStr(dget(rel, 'doi'))})` : '');
      } else {
        l4 = 'Publicación relacionada: ninguna declarada';
      }
      ls = [l1, l2, l3, l4];
    }
    return ls.map((x) => prefijo + _una_linea(x));
  }

  /** Valor de celda que una hoja de cálculo no interpreta como fórmula. */
  function _celda(v) {
    return v.slice(0, 1) !== '' && K._FORMULA.includes(v[0]) ? "'" + v : v;
  }

  /** Columnas que acompañan a CADA fila de datos exportada. */
  function columnas(f) {
    return {
      fuente_cita: _celda(_una_linea(cita_corta(f))),
      fuente_doi: _celda(_una_linea(o(url(f), K.SIN_FUENTE))),
    };
  }

  /** Sección «Fuente» para documentos Markdown. */
  function markdown(f) {
    if (!verdad(f)) return `**Fuente:** ${K.SIN_FUENTE}\n`;
    const ls = [`**Fuente (cite siempre):** ${pyStr(cita(f))}`];
    if (verdad(licencia(f))) ls.push(`**Licencia de los datos:** ${pyStr(licencia(f))}`);
    const rel = o(dget(f, 'publicacion_relacionada'), {});
    if (verdad(dget(rel, 'titulo'))) {
      const cabeza = `**Publicación relacionada:** ${pyStr(dget(rel, 'titulo'))}`;
      let cola = '';
      if (verdad(dget(rel, 'doi')) || verdad(dget(rel, 'url'))) {
        let enlace = dget(rel, 'url');
        if (!verdad(enlace)) {
          const doi = dget(rel, 'doi');
          if (typeof doi !== 'string') throw new PyError('TypeError', `can only concatenate str (not "${tipoPy(doi)}") to str`);
          enlace = 'doi:' + doi;
        }
        cola = ` (${pyStr(enlace)})`;
      }
      ls.push(cabeza + cola);
    }
    return ls.join('\n\n') + '\n';
  }

  /** Escalar YAML 1.2 entre comillas dobles (JSON es YAML) con los no imprimibles escapados \uXXXX. */
  function yaml_escalar(v) {
    return _YAML_NO_IMPRIMIBLE.sub((m) => '\\u' + hex(m.group().codePointAt(0), 4), dumps(v));
  }

  /** Front matter YAML (metadatos del documento) con la fuente. */
  function yaml_front_matter(f, extra = null) {
    const base = o(extra, {});
    if (!esDict(base)) throw new PyError('TypeError', `'${tipoPy(base)}' object is not iterable`);
    const campos = dictComo(base);
    for (const [k, v] of items(base)) poner(campos, k, v);
    const m = metadatos(f);
    poner(campos, 'fuente', dget(m, 'cita'));
    poner(campos, 'fuente_doi', dget(m, 'doi'));
    poner(campos, 'fuente_url', dget(m, 'url'));
    poner(campos, 'fuente_licencia', dget(m, 'licencia'));
    const cuerpo = items(campos)
      .filter(([, v]) => !(esNone(v) || v === ''))
      .map(([k, v]) => `${pyStr(k)}: ${yaml_escalar(v)}`)
      .join('\n');
    return `---\n${cuerpo}\n---\n`;
  }

  /**
   * re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower())
   * El NFKD es el del motor sobre los caracteres asignados en Unicode 15.0 (estable por la política de estabilidad de
   * Unicode); los no asignados en la 15.0 no se descomponen en Python y no son ASCII, así que se quitan antes.
   */
  function _ascii(s) {
    if (typeof s !== 'string') throw new PyError('TypeError', `normalize() argument 2 must be str, not ${tipoPy(s)}`);
    let asignados = '';
    for (const ch of s) if (asignado15(ch.codePointAt(0))) asignados += ch;
    return RX_NO_AZ09.sub('', asignados.normalize('NFKD').replace(/[^\x00-\x7f]+/g, '').toLowerCase());
  }

  /** Clave BibTeX: «clave_bibtex» si la declara; si no, apellido del primer autor + año + primera palabra del título. */
  function clave_bibtex(f) {
    const declarada = dget(f, 'clave_bibtex');
    if (typeof declarada === 'string' && RX_NO_CLAVE.sub('', declarada) !== '') return RX_NO_CLAVE.sub('', declarada);
    const aut = _autores(f);
    const apellido = aut.length ? _ascii(aut[0].split(',')[0]) : _ascii(o(dget(f, 'editor'), ''));
    let palabra = '';
    for (const w of RX_PALABRAS.findall(reStr(o(dget(f, 'titulo'), '')))) {
      const a = _ascii(w);
      if (a) { palabra = a; break; }
    }
    return `${apellido}${_ascii(pyStr(o(dget(f, 'anio'), '')))}${palabra}` || 'fuente';
  }

  function bibtex(f, clave = null) {
    if (!verdad(f)) return `% ${K.SIN_FUENTE}\n`;
    const campos = [
      ['author', unir(' and ', _autores(f))],
      ['title', dget(f, 'titulo')],
      ['year', dget(f, 'anio')],
      ['publisher', dget(f, 'editor')],
      ['version', o(C.lstrip(comoStr(o(dget(f, 'version_cita'), ''), 'lstrip'), 'V'), null)],
      ['doi', dget(f, 'doi')],
      ['url', url(f)],
      ['note', verdad(dget(f, 'licencia')) ? `Licencia ${pyStr(dget(f, 'licencia'))}` : null],
    ];
    const cuerpo = campos.filter(([, v]) => verdad(v)).map(([k, v]) => `  ${k} = {${pyStr(v)}}`).join(',\n');
    return `@dataset{${pyStr(verdad(clave) ? clave : clave_bibtex(f))},\n${cuerpo}\n}\n`;
  }

  function ris(f) {
    if (!verdad(f)) return `TY  - DATA\nN1  - ${K.SIN_FUENTE}\nER  - \n`;
    const ls = ['TY  - DATA', ..._autores(f).map((a) => `AU  - ${a}`)];
    const pares = [
      ['TI', dget(f, 'titulo')], ['PY', dget(f, 'anio')], ['PB', dget(f, 'editor')], ['DO', dget(f, 'doi')],
      ['UR', url(f)], ['ET', dget(f, 'version_cita')],
      ['N1', verdad(dget(f, 'licencia')) ? `Licencia ${pyStr(dget(f, 'licencia'))}` : null],
    ];
    for (const [tag, v] of pares) if (verdad(v)) ls.push(`${tag}  - ${pyStr(v)}`);
    return ls.concat(['ER  - ']).join('\n') + '\n';
  }

  /** Metadatos + cita breve + CSL-JSON, BibTeX y RIS: el bloque «fuente» de JSON, .2replib y /api/info. */
  function completa(f) {
    const out = metadatos(f);
    const cc = cita_corta(f), csl = csl_json(f), bib = bibtex(f), r = ris(f);
    out.cita_corta = cc;
    out.csl_json = csl;
    out.bibtex = bib;
    out.ris = r;
    return out;
  }

  /** Cadena de un archivo de fuera: una línea, sin controles y sin los signos con que empieza una fórmula. */
  function _texto_externo(v) {
    if (typeof v !== 'string') return null;
    return o(C.lstrip(_una_linea(v), K._FORMULA + ' '), null);
  }

  /** Reconstruye la fuente (forma del manifest) a partir de un bloque metadatos() de un .2replib. */
  function desde_metadatos(m) {
    if (!esDict(m) || dget(m, 'declarada') !== true) return null;
    const f = {};
    for (const k of ['cita', 'titulo', 'editor', 'doi', 'url', 'version_metadatos', 'licencia', 'licencia_url']) {
      if (verdad(_texto_externo(dget(m, k)))) f[k] = _texto_externo(dget(m, k));
    }
    if (verdad(_texto_externo(dget(m, 'version')))) f.version_cita = _texto_externo(dget(m, 'version'));
    const anio = dget(m, 'anio');
    if (esInt(anio)) f.anio = anio;
    else if (verdad(_texto_externo(anio))) f.anio = _texto_externo(anio);
    const autores = [];
    const lista = Array.isArray(dget(m, 'autores')) ? dget(m, 'autores') : [];
    for (const a of lista) {
      if (esDict(a) && verdad(_texto_externo(dget(a, 'nombre')))) {
        const d = dictComo(a);
        for (const [k, v] of items(a)) if (verdad(_texto_externo(v))) poner(d, k, _texto_externo(v));
        autores.push(d);
      }
    }
    if (autores.length) f.autores = autores;
    const rel = dget(m, 'publicacion_relacionada');
    if (esDict(rel)) {
      const d = dictComo(rel);
      for (const [k, v] of items(rel)) if (verdad(_texto_externo(v))) poner(d, k, _texto_externo(v));
      if (verdad(d)) f.publicacion_relacionada = d;
    }
    if (!(verdad(dget(f, 'cita')) || verdad(dget(f, 'titulo')))) return null;
    f.origen = K.ORIGEN_IMPORTADA;
    return f;
  }

  function csl_json(f) {
    if (!verdad(f)) return { type: 'dataset', note: K.SIN_FUENTE };
    const persona = (n) => {
      const i = n.indexOf(',');
      return { family: C.strip(i < 0 ? n : n.slice(0, i)), given: C.strip(i < 0 ? '' : n.slice(i + 1)) };
    };
    const pares = [
      ['type', 'dataset'],
      ['title', dget(f, 'titulo')],
      ['author', _autores(f).map(persona)],
      ['issued', verdad(dget(f, 'anio')) ? { 'date-parts': [[dget(f, 'anio')]] } : null],
      ['publisher', dget(f, 'editor')],
      ['DOI', dget(f, 'doi')],
      ['URL', url(f)],
      ['version', dget(f, 'version_cita')],
      ['license', o(dget(f, 'licencia_url'), dget(f, 'licencia'))],
    ];
    const out = {};
    for (const [k, v] of pares) if (verdad(v)) out[k] = v;
    return out;
  }

  /**
   * fuente.cargar() sobre un manifest ya leído: la clave «fuente» si es un dict con «cita» o «titulo», o null.
   * (La lectura del archivo es del llamador; un manifest que no es un dict lanza AttributeError, como en Python.)
   */
  function desde_manifest(manifest) {
    const f = dget(manifest, 'fuente');
    return esDict(f) && (verdad(dget(f, 'cita')) || verdad(dget(f, 'titulo'))) ? f : null;
  }

  R2.fuente = {
    SIN_FUENTE: K.SIN_FUENTE,
    N_LINEAS: K.N_LINEAS,
    ORIGEN_IMPORTADA: K.ORIGEN_IMPORTADA,
    // API de fuente.py (mismos nombres)
    url, cita, cita_corta, licencia, metadatos, lineas, columnas, markdown, yaml_escalar, yaml_front_matter,
    clave_bibtex, bibtex, ris, completa, desde_metadatos, csl_json, desde_manifest,
    // privadas de fuente.py (para las pruebas de paridad)
    _una_linea, _autores, _celda, _ascii, _texto_externo,
    // ayudas del modelo de valores (pruebas)
    _interno: { verdad, tipoPy, asignado15 },
  };
})(globalThis.R2 = globalThis.R2 || {});

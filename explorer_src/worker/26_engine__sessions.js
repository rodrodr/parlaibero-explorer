/* ===== src/engine/sessions.js ===== */
/* 2REP_Standalone · engine/sessions.js
 *
 * Índice de sesiones y avisos de sesión (M4): port exacto de app/backend/sessions.py (SessionIndex, load_groups,
 * row_matches, enrich_session…) y de search.session_warnings (con _fecha_larga y _lista_y). Una sesión es el grupo
 * (date, num_session) de speeches; el sidecar es la copia versionada data/sessions.json (R2.datos.sesiones en el worker),
 * que se aplica por rangos de ids igual que en el escritorio, así que vale igual con la base construida desde el CSV.
 *
 * API (R2.sessions)
 *   cargar(bd, sidecar, ruta = null) → SessionIndex   (bd = {db, sqlite3}; sidecar = objeto JSON o undefined)
 *   new SessionIndex(grupos, sidecar, ruta, error)
 *     .length · .has_sidecar · .contiguous · for_speech(sid, bd) · session_id_for(sid, bd) · get(session_id)
 *     by_key(date, num_session) · sessions() · info()
 *   groupsSql(bd, pista) · loadGroups(bd) · leerSidecar(datos) · rowMatches · baseSession · enrichSession
 *   sessionWarnings(meta, ord) · fechaLarga(iso) · listaY(partes) · fechaIso(v)
 * Las copias que devuelve el índice son profundas (copy.deepcopy).
 */
(function (R2) {
  'use strict';

  const C = R2.py && R2.py.core;
  const TR = R2.transformar;
  if (!C || !TR || !R2.sql) throw new Error('engine/sessions.js necesita R2.py.core, R2.transformar y R2.sql');

  const SIDECAR_NAME = 'sessions.json';
  const SIDECAR_VERSION = 1;
  const PAGE_VERIFIED = Object.freeze(['contiguous', 'verso_blank', 'corrected']);
  const CAMPOS_META = Object.freeze([
    ['archivo', 'str'], ['serie', 'str'], ['diario_num', 'int'], ['diario_nota', 'str'], ['legislature', 'str'],
    ['legislature_corpus', 'str'], ['date_note', 'dict'], ['cortes', 'str'], ['sigla', 'str'], ['diario', 'str'],
    ['page_status', 'str'], ['pdf_pages', 'int'], ['cover', 'bool'], ['presidente', 'dict'], ['gobierno', 'dict'],
    ['double_sitting', 'dict'], ['incidents', 'list'], ['ocr', 'dict'],
  ]);
  const CON_NOMBRE = Object.freeze(['presidente', 'gobierno']);

  const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const esDict = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const get = (o, k) => (esDict(o) && tiene(o, k) ? o[k] : null);
  const esEntero = (v) => (typeof v === 'number' && Number.isInteger(v)) || typeof v === 'bigint';
  const copia = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  /** Verdad de Python: vacíos ([], {}, "", 0, None, False) son falsos. */
  const verdad = (v) => {
    if (v === null || v === undefined || v === false || v === 0 || v === '' || v === 0n || Number.isNaN(v)) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (esDict(v)) return Object.keys(v).length > 0;
    return true;
  };
  /** == de Python entre escalares JSON (1 == 1.0 == True). */
  const pyIgual = (a, b) => {
    if (a === b) return true;
    const na = typeof a === 'number' || typeof a === 'boolean' || typeof a === 'bigint';
    const nb = typeof b === 'number' || typeof b === 'boolean' || typeof b === 'bigint';
    return na && nb ? Number(a) === Number(b) : false;
  };
  const pyError = (tipo, mensaje) => new C.PyError(tipo, mensaje);
  const nombreTipo = (v) => (Array.isArray(v) ? 'list' : esDict(v) ? 'dict' : typeof v === 'string' ? 'str' : typeof v === 'boolean' ? 'bool' : v === null || v === undefined ? 'NoneType' : 'int');
  /** Pertenencia a un frozenset de textos: un valor no hashable (lista, dict) lanza TypeError, como Python. */
  const enConjunto = (v, conjunto) => {
    if (Array.isArray(v) || esDict(v)) throw pyError('TypeError', `unhashable type: '${nombreTipo(v)}'`);
    return typeof v === 'string' && conjunto.includes(v);
  };

  function tipoValido(v, tipo) {
    if (v === null || v === undefined) return true;
    switch (tipo) {
      case 'int': return esEntero(v);
      case 'str': return typeof v === 'string';
      case 'dict': return esDict(v);
      case 'list': return Array.isArray(v);
      case 'bool': return typeof v === 'boolean';
      default: return false;
    }
  }

  // ------------------------------------------------------------------------------------------------ fechas ISO
  const esBisiesto = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const DIAS_ANTES_MES = [0, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const diasMes = (y, m) => (m === 2 && esBisiesto(y) ? 29 : [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]);
  const diasAntesAnio = (y) => { const z = y - 1; return z >= 0 ? z * 365 + Math.floor(z / 4) - Math.floor(z / 100) + Math.floor(z / 400) : -366; };
  const ymdAOrd = (y, m, d) => diasAntesAnio(y) + DIAS_ANTES_MES[m] + (m > 2 && esBisiesto(y) ? 1 : 0) + d;
  function ordAYmd(ord) {
    // _datetimemodule.c ord_to_ymd, con la división entera y el resto de C (truncan hacia cero).
    const div = (a, b) => Math.trunc(a / b);
    let n = ord - 1;
    const n400 = div(n, 146097); n %= 146097;
    let year = n400 * 400 + 1;
    const n100 = div(n, 36524); n %= 36524;
    const n4 = div(n, 1461); n %= 1461;
    const n1 = div(n, 365); n %= 365;
    year += n100 * 100 + n4 * 4 + n1;
    if (n1 === 4 || n100 === 4) return [year - 1, 12, 31];
    const bis = n1 === 3 && (n4 !== 24 || n100 !== 3);
    let month = (n + 50) >> 5;
    if (month < 1 || month > 12) return [year, 0, 0];
    let antes = DIAS_ANTES_MES[month] + (month > 2 && bis ? 1 : 0);
    if (antes > n) { month -= 1; if (month < 1) return [year, 0, 0]; antes = DIAS_ANTES_MES[month] + (month > 2 && bis ? 1 : 0); }
    return [year, month, n - antes + 1];
  }
  function lunesSemana1(y) {
    const primer = ymdAOrd(y, 1, 1);
    const dia = (primer + 6) % 7;
    let lunes = primer - dia;
    if (dia > 3) lunes += 7;
    return lunes;
  }
  const esCifra = (c) => c >= '0' && c <= '9';
  function cifras(s, p, n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const c = s[p + i];
      if (c === undefined || !esCifra(c)) return null;
      v = v * 10 + (c.charCodeAt(0) - 48);
    }
    return v;
  }

  /** sessions._fecha_iso: datetime.date.fromisoformat(v) de Python 3.12 sin error. */
  function fechaIso(v) {
    if (typeof v !== 'string') return false;
    // _datetimemodule.c comprueba la longitud en bytes UTF-8 (PyUnicode_AsUTF8AndSize): «19310714é» (10 bytes) vale.
    const len = new TextEncoder().encode(v).length;
    if (len !== 7 && len !== 8 && len !== 10) return false;
    let p = 0;
    const year = cifras(v, p, 4);
    if (year === null) return false;
    p += 4;
    const sep = v[p] === '-';
    if (sep) p++;
    let y = year, m, d;
    if (v[p] === 'W') {
      p++;
      const semana = cifras(v, p, 2);
      if (semana === null) return false;
      p += 2;
      let dia;
      if (p < v.length) {
        if (sep && v[p++] !== '-') return false;
        dia = cifras(v, p, 1);
        if (dia === null) return false;
      } else dia = 1;
      if (semana <= 0 || semana >= 53) {
        let fuera = true;
        if (semana === 53) {
          const primerDia = (ymdAOrd(year, 1, 1) + 6) % 7;
          if (primerDia === 3 || (primerDia === 2 && esBisiesto(year))) fuera = false;
        }
        if (fuera) return false;
      }
      if (dia <= 0 || dia >= 8) return false;
      [y, m, d] = ordAYmd(lunesSemana1(year) + (semana - 1) * 7 + dia - 1);
    } else {
      m = cifras(v, p, 2);
      if (m === null) return false;
      p += 2;
      if (sep && v[p++] !== '-') return false;
      d = cifras(v, p, 2);
      if (d === null) return false;
    }
    if (y < 1 || y > 9999 || m < 1 || m > 12) return false;
    return d >= 1 && d <= diasMes(y, m);
  }

  // ------------------------------------------------------------------------------------------------ grupos y sidecar
  function groupsSql(bd, pista = true) {
    const cols = new Set(R2.sql.tuplas(bd, 'PRAGMA table_info(speeches)').map((f) => f[1]));
    const ords = cols.has('ord') ? 'MIN(ord), MAX(ord)' : 'NULL, NULL';
    const hayIndice = R2.sql.valor(bd, "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_session' AND tbl_name = 'speeches_datos'") !== undefined;
    const indexed = pista && hayIndice ? 'INDEXED BY idx_session ' : '';
    const tabla = hayIndice ? 'speeches_datos' : 'speeches';
    return `SELECT date, num_session, MIN(id), MAX(id), COUNT(*), ${ords} FROM ${tabla} ${indexed}GROUP BY date, num_session`;
  }

  function loadGroups(bd) {
    let filas;
    try {
      filas = R2.sql.tuplas(bd, groupsSql(bd));
    } catch (e) {
      filas = R2.sql.tuplas(bd, groupsSql(bd, false));
    }
    const grupos = filas.map((f) => ({ session_id: f[2], id_min: f[2], id_max: f[3], n: f[4], date: f[0], num_session: f[1], ord_min: f[5], ord_max: f[6] }));
    grupos.sort((a, b) => (a.id_min < b.id_min ? -1 : a.id_min > b.id_min ? 1 : 0));
    return grupos;
  }

  /** read_sidecar sobre los datos ya cargados: [datos, null] · [null, null] sin sidecar · [null, motivo]. */
  function leerSidecar(datos) {
    if (datos === undefined) return [null, null];
    const version = get(datos, 'version');
    if (!esDict(datos) || !pyIgual(version, SIDECAR_VERSION) || !Array.isArray(get(datos, 'sessions'))) {
      return [null, 'sidecar con version o estructura no reconocida'];
    }
    return [datos, null];
  }

  function rowMatches(row, grupo) {
    if (!esDict(row)) return false;
    for (const k of ['id_min', 'id_max', 'n']) {
      const val = get(row, k);
      if (!esEntero(val) || Number(val) !== grupo[k]) return false;
    }
    for (const k of ['date', 'num_session']) {
      if (tiene(row, k) && !pyIgual(row[k], grupo[k])) return false;
    }
    return true;
  }

  function baseSession(grupo) {
    return Object.assign({}, grupo, { has_meta: false, date_real: grupo.date, date_corrected: false, warnings: [] });
  }

  function enrichSession(grupo, row) {
    const s = baseSession(grupo);
    for (const [k, tipo] of CAMPOS_META) {
      if (!tiene(row, k) || !tipoValido(row[k], tipo)) continue;
      let v = row[k];
      if (CON_NOMBRE.includes(k) && v !== null && typeof get(v, 'nombre') !== 'string') continue;
      if (k === 'incidents') v = v.filter(esDict);
      s[k] = copia(v);
    }
    s.has_meta = true;
    if (fechaIso(get(row, 'date_real'))) s.date_real = row.date_real;
    s.date_corrected = get(row, 'date_corrected') === true && s.date_real !== grupo.date;
    const avisos = get(row, 'warnings');
    s.warnings = Array.isArray(avisos) ? avisos.filter((w) => typeof w === 'string') : [];
    const ini = get(row, 'page_start'), fin = get(row, 'page_end');
    if (enConjunto(get(row, 'page_status'), PAGE_VERIFIED) && esEntero(ini) && esEntero(fin) && ini > 0 && ini <= fin) {
      s.page_start = ini;
      s.page_end = fin;
    }
    return s;
  }

  const clave = (date, num) => JSON.stringify([date, num === undefined ? null : num]);

  class SessionIndex {
    constructor(groups, sidecar = null, sidecarPath = null, sidecarError = null) {
      const filas = new Map();
      let duplicadas = 0;
      if (verdad(sidecar)) {
        const lista = tiene(sidecar, 'sessions') ? sidecar.sessions : [];
        if (!Array.isArray(lista)) throw pyError('TypeError', `'${nombreTipo(lista)}' object is not iterable`);
        for (const row of lista) {
          const k = esDict(row) ? get(row, 'id_min') : null;
          if (esEntero(k)) {
            if (filas.has(Number(k))) duplicadas++;
            else filas.set(Number(k), row);
          } else {
            duplicadas++;
          }
        }
      }
      this._sessions = [];
      let applied = 0, ignored = 0;
      const usadas = new Set();
      const ordenados = groups.slice().sort((a, b) => (a.id_min < b.id_min ? -1 : a.id_min > b.id_min ? 1 : 0));
      for (const g of ordenados) {
        const row = filas.get(g.id_min);
        if (row !== undefined && rowMatches(row, g)) {
          this._sessions.push(enrichSession(g, row));
          applied++;
          usadas.add(g.id_min);
        } else {
          if (row !== undefined) { ignored++; usadas.add(g.id_min); }
          this._sessions.push(baseSession(g));
        }
      }
      for (const k of filas.keys()) if (!usadas.has(k)) ignored++;
      ignored += duplicadas;
      this._starts = this._sessions.map((s) => s.id_min);
      this._byId = new Map(this._sessions.map((s) => [s.session_id, s]));
      this._byKey = new Map(this._sessions.map((s) => [clave(s.date, s.num_session), s]));
      this.contiguous = this._sessions.every((s) => s.id_max - s.id_min + 1 === s.n);
      this.sidecar_path = sidecarPath;
      this.sidecar_error = sidecarError;
      this.sidecar_loaded = sidecar !== null && sidecar !== undefined;
      this.sidecar_generated_at = verdad(sidecar) ? copia(get(sidecar, 'generated_at')) : null;
      this.n_applied = applied;
      this.n_ignored = ignored;
    }

    get length() { return this._sessions.length; }
    get has_sidecar() { return this.sidecar_loaded && this.n_applied > 0; }

    _sesionDe(sid, bd) {
      if (this.contiguous) {
        const i = C.bisectRight(this._starts, sid) - 1;
        if (i >= 0 && sid <= this._sessions[i].id_max) return this._sessions[i];
        return null;
      }
      if (!bd) return null;
      const r = R2.sql.tuplas(bd, 'SELECT date, num_session FROM speeches WHERE id = ?', [sid]);
      if (!r.length) return null;
      return this._byKey.get(clave(r[0][0], r[0][1])) || null;
    }

    for_speech(sid, bd = null) { const s = this._sesionDe(sid, bd); return s ? copia(s) : null; }
    session_id_for(sid, bd = null) { const s = this._sesionDe(sid, bd); return s ? s.session_id : null; }
    get(sessionId) { const s = this._byId.get(sessionId); return s ? copia(s) : null; }
    by_key(date, numSession) { const s = this._byKey.get(clave(date, numSession)); return s ? copia(s) : null; }
    sessions() { return copia(this._sessions); }
    info() {
      return { n_sessions: this._sessions.length, contiguous: this.contiguous,
        sidecar: { loaded: this.sidecar_loaded, path: this.sidecar_path, generated_at: this.sidecar_generated_at,
          applied: this.n_applied, ignored: this.n_ignored, error: this.sidecar_error } };
    }
  }

  /** SessionIndex.load con el sidecar ya cargado; si falla, un índice vacío con el error (como search.Corpus). */
  function cargar(bd, sidecar, ruta = null) {
    try {
      const grupos = loadGroups(bd);
      const [datos, error] = leerSidecar(sidecar);
      return new SessionIndex(grupos, datos, datos !== null ? ruta : null, error);
    } catch (e) {
      return new SessionIndex([], null, null, `no se pudo indexar las sesiones: ${e && e.message ? e.message : e}`);
    }
  }

  // ------------------------------------------------------------------------------------------------ avisos
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /** search._fecha_larga. */
  function fechaLarga(iso) {
    const partes = [...C.pyStr(iso)].slice(0, 10).join('').split('-');
    try {
      if (partes.length !== 3) throw new Error('ValueError');
      const [a, m, d] = partes.map((x) => TR.pyInt(x));
      const i = Number(m) - 1;
      const idx = i < 0 ? MESES.length + i : i;
      if (idx < 0 || idx >= MESES.length) throw new Error('IndexError');
      return `${d} de ${MESES[idx]} de ${a}`;
    } catch (e) {
      return verdad(iso) ? C.pyStr(iso) : '';
    }
  }

  /** search._lista_y. */
  function listaY(partes) {
    const p = partes.filter((x) => verdad(x));
    if (p.length <= 1) return p.join('');
    return `${p.slice(0, -1).join(', ')} y ${p[p.length - 1]}`;
  }

  const AVISO_ORDEN = Object.freeze(['date_corrected', 'legislature_corrected', 'double_sitting', 'truncated_end', 'ocr_loop', 'government_change_day']);
  const GENERICOS = Object.freeze({
    government_change_day: ['info', 'La sesión cae en un día de cambio de Gobierno: el Diario puede reflejar todavía al Gobierno saliente.'],
    date_corrected: ['warning', 'La fecha de esta sesión se ha corregido.'],
    double_sitting: ['info', 'Doble sesión real: ese día hubo más de una sesión.'],
    truncated_end: ['warning', 'El acta digitalizada termina incompleta.'],
    ocr_loop: ['warning', 'Una página salió de un bucle del OCR y repite texto.'],
    legislature_corrected: ['warning', 'La legislatura de esta sesión se ha corregido.'],
  });

  /** Iteración de `x or []` en Python: listas, textos (caracteres) y dicts (claves); un escalar verdadero es TypeError. */
  function iterable(x) {
    if (!verdad(x)) return [];
    if (Array.isArray(x)) return x;
    if (typeof x === 'string') return [...x];
    if (esDict(x)) return Object.keys(x);
    throw pyError('TypeError', `'${nombreTipo(x)}' object is not iterable`);
  }

  /** search.session_warnings. `meta` es una sesión del índice; `ord` (0-based) o null. */
  function sessionWarnings(meta, ord = null) {
    if (!verdad(meta)) return [];
    if (!esDict(meta)) throw pyError('AttributeError', `'${nombreTipo(meta)}' object has no attribute 'get'`);
    if (!verdad(get(meta, 'has_meta'))) return [];
    const out = new Map();
    const s = C.pyStr;
    if (verdad(get(meta, 'date_corrected'))) {
      const nota = esDict(get(meta, 'date_note')) ? meta.date_note : {};
      out.set('date_corrected', {
        code: 'date_corrected', severity: 'warning', date_corpus: get(meta, 'date'), date_real: get(meta, 'date_real'),
        evidence: get(nota, 'evidencia'),
        message: `El corpus de origen fecha esta sesión el ${fechaLarga(get(meta, 'date'))}, pero se celebró el ${fechaLarga(get(meta, 'date_real'))}. `
          + 'Las cabeceras usan la fecha real; los filtros de fecha siguen usando la del corpus.',
      });
    }
    const legC = get(meta, 'legislature_corpus'), leg = get(meta, 'legislature');
    if (verdad(legC) && verdad(leg) && !pyIgual(legC, leg)) {
      out.set('legislature_corrected', {
        code: 'legislature_corrected', severity: 'warning', legislature_corpus: legC, legislature: leg,
        message: `El corpus de origen asigna esta sesión a la legislatura ${s(legC)}; corresponde a la ${s(leg)}.`,
      });
    }
    const ds = get(meta, 'double_sitting');
    if (esDict(ds)) {
      const otras = iterable(get(ds, 'otras')).filter(esDict);
      const franja = get(ds, 'franja');
      const resto = listaY(otras.map((o) => (verdad(get(o, 'franja'))
        ? `la de la ${s(get(o, 'franja'))} (Diario núm. ${s(get(o, 'diario_num'))})`
        : `el Diario núm. ${s(get(o, 'diario_num'))}`)));
      out.set('double_sitting', {
        code: 'double_sitting', severity: 'info', franja, others: copia(otras), evidence: get(ds, 'evidencia'),
        message: `Doble sesión real: ese día hubo más de una sesión. Esta es la de la ${s(franja)}` + (resto ? `; la otra es ${resto}` : '') + '.',
      });
    }
    for (const inc of iterable(get(meta, 'incidents'))) {
      if (!esDict(inc)) throw pyError('AttributeError', `'${nombreTipo(inc)}' object has no attribute 'get'`);
      const tipo = get(inc, 'tipo');
      if (tipo === 'truncated_end') {
        const cola = esDict(get(inc, 'cola_repetida')) ? inc.cola_repetida : {};
        const w = { code: 'truncated_end', severity: 'warning',
          message: verdad(get(inc, 'descripcion')) ? inc.descripcion : 'El acta digitalizada termina incompleta.',
          pdf_page: get(inc, 'pagina_pdf') };
        if (verdad(cola)) {
          w.official_order_from = get(cola, 'orden_oficial_desde');
          w.official_order_to = get(cola, 'orden_oficial_hasta');
          const desde = get(cola, 'ord_desde'), hasta = get(cola, 'ord_hasta');
          const esInt = (x) => esEntero(x) || typeof x === 'boolean';
          if (ord !== null && ord !== undefined && esInt(desde) && esInt(hasta)) {
            w.affects_speech = Number(desde) <= ord && ord <= Number(hasta);
          }
        }
        if (!out.has('truncated_end')) out.set('truncated_end', w);
      } else if (tipo === 'ocr_loop') {
        if (!out.has('ocr_loop')) {
          out.set('ocr_loop', { code: 'ocr_loop', severity: 'warning', pdf_page: get(inc, 'pagina_pdf'),
            message: verdad(get(inc, 'descripcion')) ? inc.descripcion : 'Una página salió de un bucle del OCR y repite texto.' });
        }
      }
    }
    for (const code of iterable(get(meta, 'warnings'))) {
      if (Array.isArray(code) || esDict(code)) throw pyError('TypeError', `unhashable type: '${nombreTipo(code)}'`);
      const k = typeof code === 'string' ? code : s(code);
      if (!out.has(k)) {
        const [sev, msg] = tiene(GENERICOS, k) && typeof code === 'string' ? GENERICOS[k] : ['info', `Aviso de sesión: ${s(code)}`];
        out.set(k, { code, severity: sev, message: msg });
      }
    }
    const rango = new Map(AVISO_ORDEN.map((c, i) => [c, i]));
    const clave = (w) => [rango.has(w.code) ? rango.get(w.code) : AVISO_ORDEN.length, w.code];
    return C.sorted([...out.values()], { key: clave });
  }

  R2.sessions = Object.freeze({
    SIDECAR_NAME, SIDECAR_VERSION, PAGE_VERIFIED, CAMPOS_META, SessionIndex, cargar, groupsSql, loadGroups, leerSidecar,
    rowMatches, baseSession, enrichSession, sessionWarnings, fechaLarga, listaY, fechaIso, AVISO_ORDEN,
  });
})(globalThis.R2 = globalThis.R2 || {});

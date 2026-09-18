/* ===== src/engine/careo.js ===== */
/* 2REP_Standalone · engine/careo.js
 *
 * Careo (M5): réplicas de una intervención, en la misma sesión o del mismo diputado. Port de app/backend/careo.py con el
 * mismo SQL, los mismos pesos (R2.gen.constantes.careo), las mismas expresiones regulares (R2.py.re), SequenceMatcher de
 * R2.py.difflib y los mismos textos en español.
 *
 * - synchronic: completo (analizar_orador, alusiones por apellido y por cargo, interrupciones, cercanía en turnos, familia
 *   e ideología, aviso de otras sesiones con la misma fecha).
 * - diachronic: esta edición no tiene vectores, así que siempre va por la vía léxica (method «fts»): _terminos_frecuentes +
 *   _bm25_vocab sobre fts5vocab (con la vía MATCH de reserva si fts5vocab falla), igual que careo.diachronic con
 *   vectors=None.
 *
 * Índices de cadena: unidades UTF-16, iguales a los de Python porque el corpus no tiene caracteres fuera del BMP
 * (ARQUITECTURA.md §7.1). Los TEXT se leen con R2.sql (conserva un U+FEFF inicial, como el escritorio).
 *
 * API (R2.careo); bd = { db, sqlite3 }
 *   synchronic(bd, sid, top = 5) → objeto | null        careo.synchronic
 *   diachronic(bd, sid, top = 5) → objeto | null        careo.diachronic(vectors=None)
 *   analizar_orador(speaker) → { role, apellidos, cargo, etiqueta, patrones }
 *   es_presidencia_camara(speaker) · plegar(s) · terminos_frecuentes(texto, n)
 * Ruta: GET /careo/{sid}?mode=synchronic|diachronic&top=1..20 (Corpus._locked_careo + server.api_careo): 404 «No existe esa
 * intervencion.»; speaker_label con R2.diario.parse_speaker si diario.js está cargado.
 */
(function (R2) {
  'use strict';

  const RT = R2.router, S = R2.sql;
  const C = R2.py && R2.py.core, RE = R2.py && R2.py.re, DL = R2.py && R2.py.difflib;
  const G = R2.gen || {};
  if (!RT || !S || !C || !RE || !DL || !G.constantes || !G.vacias) {
    throw new Error('engine/careo.js necesita R2.router, R2.sql, R2.py.core, R2.py.re, R2.py.difflib y R2.gen.{constantes, vacias}');
  }
  const K = G.constantes.careo;
  const V = RT.validar;

  const MIN_WORDS_SYNC = K.MIN_WORDS_SYNC;
  const MIN_WORDS_DIAC = K.MIN_WORDS_DIAC;
  const MAX_SQL_PARAMS = K.MAX_SQL_PARAMS;
  const PESO_ALUSION_NOMBRE = K.PESO_ALUSION_NOMBRE;
  const PESO_ALUSION_CARGO = K.PESO_ALUSION_CARGO;
  const PESO_INTERRUPCION = K.PESO_INTERRUPCION;
  const PESO_MENCION_EXTRA = K.PESO_MENCION_EXTRA;
  const TOPE_MENCION_EXTRA = K.TOPE_MENCION_EXTRA;
  const PESO_TURNO = K.PESO_TURNO;
  const DECAIMIENTO_TURNO = K.DECAIMIENTO_TURNO;
  const PESO_OTRA_FAMILIA = K.PESO_OTRA_FAMILIA;
  const PESO_PASO_IDEOLOGICO = K.PESO_PASO_IDEOLOGICO;
  const RANGO_DIAC = K.RANGO_DIAC;
  const MAX_PARENTESIS = K.MAX_PARENTESIS;
  const K1_BM25 = 1.2, B_BM25 = 0.75;
  const IDEOLOGY_SCALE = new Map(Object.entries(K.IDEOLOGY_SCALE));
  const PRESIDENCIA_CAMARA = new Set(K.PRESIDENCIA_CAMARA);
  const sinDato = (v) => v === null || v === undefined || v === '' || v === 'Sin identificar';

  const NOTA_SYNC = K.NOTA_SYNC;
  const NOTA_DIAC_FTS = K.NOTA_DIAC_FTS;
  const COLS = K._COLS;
  const SQL_COLS = K._SQL_COLS;

  const VACIAS = new Set(G.vacias.VACIAS);
  const VACIAS_SALA = new Set(G.vacias.VACIAS_SALA);

  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const ms = (t0) => C.pyRound(ahora() - t0, 1);

  // ------------------------------------------------------------------------------------------ plegado (misma longitud)
  const TABLA_PLEGADO = new Map(K._PLEGADO.map(([cp, s]) => [cp, s]));
  if (!TABLA_PLEGADO.has(0x0130)) TABLA_PLEGADO.set(0x0130, 'I');
  const RX_PLEGABLE = /[À-ɏ]/g;

  /** Minúsculas sin diacríticos, con la misma longitud que el original. */
  function plegar(s) {
    s = s || '';
    return C.lower(s.replace(RX_PLEGABLE, (ch) => TABLA_PLEGADO.get(ch.charCodeAt(0)) || ch));
  }

  /** Texto en NFC. */
  function nfc(s) {
    s = s || '';
    return s.normalize('NFC');
  }

  const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'i', 'e', 'san']);
  const HON_PLURAL = new Set(['sres', 'senores', 'senoras', 'sras', 'srtas', 'senoritas']);

  /** 'Ministro de INSTRUCCIÓN PÚBLICA' → 'Ministro de Instrucción Pública'. */
  function titulo(s) {
    return C.split(s).map((w, i) => {
      const lw = C.lower(w);
      return i && PARTICULAS.has(lw) ? lw : C.upper(lw.slice(0, 1)) + lw.slice(1);
    }).join(' ');
  }

  // ------------------------------------------------------------------------------------------ expresiones regulares
  const R = String.raw;
  const PREFIJO = RE.compile(
    R`^\W*(?:(?P<art>el|la|los|las|ei|fl|en|er)\.?\s*)?`
    + R`(?P<hon>senoritas|senorita|senores|senoras|senora|senor|srtas|srta|sres|sras|sra|sr)`
    + R`(?![a-z])\s*[.,]?\s*`);
  const CORTE_ETIQUETA = RE.compile(
    R`[.;!?][\"”»']?\s+(?=(?:El|La|Los|Las)\s+[Ss])`
    + R`|(?<=[a-záéíóúñ]{5}[.;])\s+(?=[A-ZÁÉÍÓÚÑ])`);
  const COLA_ACOTACION = RE.compile(
    R`\s*,\s*(?=de\s+la\s+[Cc]omisi|(?!(?:de|del|la|las|los|y|e)\b)[a-záéíóúñ])`);
  const HONOR = R`(?:senoritas?|senoras?|senores|senor|srtas?|sras?|sres|sr|dona|don|d)`
    + R`\.?\s+(?:[a-z]+\.?\s+){0,2}`;
  const PAREN = RE.compile(R`\(([^()]*)(?:\)|$)`);
  const TRAS_ORADOR = RE.compile(R`(?:\s*\([^()]{0,60}\))?[^:().;!?¡¿—–\n]{0,45}:`);

  const RX_DON = RE.compile(R`(?i)^(d\.|d\.ª|don|doña|dona)(\s|$)`);
  const RX_ESP_GUION = RE.compile(R`[\s\-]+`);
  const RX_AZ = RE.compile(R`[a-z]+`);
  const RX_AZ09 = RE.compile(R`[a-z0-9]+`);
  const RX_ESPACIOS = RE.compile(R`\s+`);
  const RX_CONSEJO = RE.compile(R`conse[jio]o|gobierno|minis`);
  const RX_EDAD = RE.compile(R`(?<![a-z])edad(?![a-z])`);
  const RX_PRESID = RE.compile(R`([a-z\-]*)p+r?esid`);
  const RX_MINIS = RE.compile(R`(?<![a-z])minis`);
  const RX_CARTERA = RE.compile(R`ministr?o\s+de\s+(?:la\s+|el\s+|los\s+)?([a-z]+)`);
  const RX_Y_PLURAL = RE.compile(R`\s+y\s+`);
  const RX_Y_TROZOS = RE.compile(R`\s+[yY]\s+`);
  const RX_AL = RE.compile(R`(Presidente|Ministro|Secretario|Vicepresidencia|Presidencia)\b`);
  const RX_POR = RE.compile(R`(Presidente|Ministro|Secretario)\b`);
  const RX_PAREN_600 = RE.compile(R`\([^()]{0,600}\)`);
  const RX_CARGO_PRESIDENTE = R`(?<![a-z])(?:presidente\s+del\s+(?:consejo|gobierno)|jefe\s+del\s+gobierno)(?![a-z])`;
  const STRIP_BASE = ' .,:;-–—“”"\'';

  // ------------------------------------------------------------------------------------------ orador
  /** ¿El paréntesis de la etiqueta es un nombre ('Azaña') y no una acotación? */
  function esNombre(contenido) {
    const c = C.strip(contenido, ' .:;,');
    if (!c) return false;
    if (RX_DON.match(c)) return false;
    const palabras = RX_ESP_GUION.split(c).map((w) => C.strip(w, '.,')).filter((w) => w);
    if (!palabras.length || palabras.length > 5) return false;
    return palabras.every((w) => PARTICULAS.has(plegar(w)) || C.isupper(w.slice(0, 1)));
  }

  const CACHE_OCR = new Map();
  /** 'prfsidente', 'pesidente' (OCR) → 'chair'; null si no parece el cargo. */
  function presidenciaOcr(fb) {
    if (CACHE_OCR.has(fb)) return CACHE_OCR.get(fb);
    let r = null;
    const toks = RX_AZ.findall(fb);
    if (toks.length === 1) {
      const t = toks[0];
      for (const [objetivo, rol] of [['vicepresidente', 'vicechair'], ['presidente', 'chair']]) {
        if (Math.abs(t.length - objetivo.length) <= 3 && new DL.SequenceMatcher(null, t, objetivo).ratio() >= 0.8) { r = rol; break; }
      }
    }
    if (CACHE_OCR.size >= 4096) CACHE_OCR.clear();
    CACHE_OCR.set(fb, r);
    return r;
  }

  function patronNombre(apellido) {
    const toks = RX_AZ09.findall(plegar(apellido));
    const signif = toks.filter((t) => !PARTICULAS.has(t));
    if (!signif.length || Math.max(...signif.map((t) => t.length)) < 3) return null;
    const cuerpo = toks.map((t) => RE.escape(t)).join(R`[\s\-·.'’]+`);
    const rx = RE.compile(R`(?<![a-z0-9])(?P<hon>` + HONOR + R`)?(?P<ap>` + cuerpo + R`)(?![a-z0-9])`);
    return [rx, 'nombre', signif.length];
  }

  const CACHE_ORADOR = new Map();

  /**
   * Rol, apellido(s), cargo y patrones de alusión a partir del campo `speaker`.
   *   "El Sr. BARRIOBERO:" → deputy, ["BARRIOBERO"] · "El Sr. VICEPRESIDENTE (Barnés):" → vicechair, ["Barnés"]
   */
  function analizarOrador(speaker) {
    const clave = speaker === null || speaker === undefined ? '' : String(speaker);
    let r = CACHE_ORADOR.get(clave);
    if (!r) {
      r = analizar(clave);
      if (CACHE_ORADOR.size >= 8192) CACHE_ORADOR.clear();
      CACHE_ORADOR.set(clave, r);
    }
    return r;
  }

  function analizar(speaker) {
    const orig = C.strip(speaker || '');
    let ultimoCorte = -1;
    for (const m of CORTE_ETIQUETA.finditer(orig)) ultimoCorte = m.end();
    if (ultimoCorte >= 0) {
      const resto = C.strip(orig.slice(ultimoCorte));
      if (resto) return analizarOrador(resto);
    }

    const fo = plegar(orig);
    const m = PREFIJO.match(fo);
    const ini = m ? m.end() : 0;
    const plural = !!(m && (HON_PLURAL.has(m.group('hon')) || m.group('art') === 'los' || m.group('art') === 'las'));
    const cuerpo = orig.slice(ini);

    const nombres = [];
    for (const pm of PAREN.finditer(cuerpo)) {
      if (esNombre(pm.group(1))) nombres.push(C.strip(pm.group(1), ' .:;,'));
    }
    let base = PAREN.sub(' ', cuerpo);
    base = C.strip(RX_ESPACIOS.sub(' ', base), STRIP_BASE);
    base = C.strip(COLA_ACOTACION.split(base, 1)[0], STRIP_BASE);
    const fb = plegar(base);

    const patrones = [];
    let cargo = null;
    let role;

    if (fb.includes('presid')) {
      if (RX_CONSEJO.search(fb)) {
        role = 'head_of_government';
        cargo = fb.includes('gobierno') ? 'Presidente del Gobierno' : 'Presidente del Consejo';
        patrones.push([RE.compile(RX_CARGO_PRESIDENTE), 'cargo', 0]);
      } else if (fb.includes('republica')) {
        role = 'head_of_state'; cargo = 'Presidente de la República';
      } else if (RX_EDAD.search(fb)) {
        role = 'chair_age'; cargo = 'Presidencia de edad';
      } else {
        const pm = RX_PRESID.search(fb);
        const prefijo = C.rstrip(C.strip(pm ? (pm.group(1) || '') : '', '-'), 'p');
        role = prefijo ? 'vicechair' : 'chair';
        cargo = prefijo ? 'Vicepresidencia' : 'Presidencia';
      }
    } else if (RX_MINIS.search(fb)) {
      role = 'minister';
    } else if (fb.includes('secretar')) {
      role = 'secretary'; cargo = 'Secretario';
    } else if (presidenciaOcr(fb)) {
      role = presidenciaOcr(fb);
      cargo = role === 'vicechair' ? 'Vicepresidencia' : 'Presidencia';
    } else {
      role = 'deputy';
    }

    // Cartera ministerial (también en "Presidente del Consejo y Ministro de la Guerra")
    const mm = RX_CARTERA.search(fb);
    if (mm && (role === 'minister' || role === 'head_of_government')) {
      patrones.push([RE.compile(R`(?<![a-z])ministro\s+de\s+(?:la\s+|el\s+|los\s+)?` + RE.escape(mm.group(1)) + R`(?![a-z])`),
        'cargo', 0]);
      if (role === 'minister') cargo = titulo(base.slice(mm.start()));
    }

    let apellidos;
    if (role === 'deputy') {
      const partes = plural ? RX_Y_PLURAL.split(base) : [base];
      apellidos = partes.map((p) => C.strip(p, ' .,')).filter((p) => p);
    } else {
      apellidos = nombres.slice();
    }

    for (const ap of apellidos) {
      const p = patronNombre(ap);
      if (p) patrones.push(p);
      if (role === 'deputy') {
        // Apellidos unidos por "y": solo se admite la parte compuesta (dos palabras significativas o más).
        const trozos = RX_Y_TROZOS.split(ap);
        if (trozos.length > 1) {
          for (const trozo of trozos) {
            const q = patronNombre(trozo);
            if (q && q[2] >= 2) patrones.push(q);
          }
        }
      }
    }

    let etiqueta;
    if (role === 'deputy') {
      etiqueta = apellidos.join(' y ') || orig;
    } else {
      etiqueta = cargo || orig;
      if (nombres.length) etiqueta += ` (${nombres.join(', ')})`;
    }
    return Object.freeze({ role, apellidos: Object.freeze(apellidos), cargo, etiqueta, patrones: Object.freeze(patrones) });
  }

  /** Presidencia o Vicepresidencia de la Cámara (nunca la del Consejo/Gobierno). */
  const esPresidenciaCamara = (speaker) => PRESIDENCIA_CAMARA.has(analizarOrador(speaker).role);

  // ------------------------------------------------------------------------------------------ alusiones
  function bisectLeft(a, x) {
    let lo = 0, hi = a.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (a[m] < x) lo = m + 1; else hi = m; }
    return lo;
  }
  function bisectRight(a, x) {
    let lo = 0, hi = a.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (x < a[m]) hi = m; else lo = m + 1; }
    return lo;
  }

  /** [inicios, finales] de los paréntesis de primer nivel de un texto. */
  function spansParentesis(texto) {
    const pila = [];
    const pares = [];
    for (let p = 0; p < texto.length; p++) {
      const ch = texto.charCodeAt(p);
      if (ch === 40) {
        pila.push(p);
      } else if (ch === 41) {
        if (pila.length) {
          const a = pila.pop();
          if (p + 1 - a <= MAX_PARENTESIS) pares.push([a, p + 1]);
        }
      } else if (ch === 10) {
        pila.length = 0;
      }
    }
    pares.sort((x, y) => (x[0] - y[0]) || (x[1] - y[1]));
    const inicios = [], finales = [];
    for (const [a, b] of pares) {
      if (finales.length && a < finales[finales.length - 1]) continue; // anidado dentro del anterior
      inicios.push(a);
      finales.push(b);
    }
    return [inicios, finales];
  }

  /** Menciones de un orador dentro de un texto: { nombre, cargo, interrupciones, acotaciones }. */
  function contarAlusiones(texto, plegado, patrones, spans = null) {
    if (!spans) spans = spansParentesis(texto);
    const [inicios, finales] = spans;
    const vistos = new Set();
    let nom = 0, car = 0, inter = 0, acot = 0;
    for (const [rx, tipo, nsig] of patrones) {
      for (const m of rx.finditer(plegado)) {
        let pos, fin;
        if (tipo === 'cargo') {
          pos = m.start(); fin = m.end();
        } else {
          if (!m.group('hon')) {
            if (!(nsig >= 2)) continue;
            const ch = texto[m.start('ap')];
            if (ch === undefined || !C.isupper(ch)) continue;
          }
          pos = m.start('ap'); fin = m.end('ap');
        }
        const clave = `${tipo}:${fin}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        const i = bisectRight(inicios, pos) - 1;
        if (i >= 0 && pos < finales[i]) {
          if (TRAS_ORADOR.match(plegado, fin)) inter += 1;
          else acot += 1;
        } else if (tipo === 'cargo') {
          car += 1;
        } else {
          nom += 1;
        }
      }
    }
    return { nombre: nom, cargo: car, interrupciones: inter, acotaciones: acot };
  }

  const al = (etiqueta) => (RX_AL.match(etiqueta) ? 'al ' : 'a ') + etiqueta;
  const por = (etiqueta) => (RX_POR.match(etiqueta) ? 'el ' : '') + etiqueta;
  const veces = (n) => (n > 1 ? ` (×${n})` : '');
  const extra = (n) => Math.min(TOPE_MENCION_EXTRA, PESO_MENCION_EXTRA * (n - 1));
  const numEs = (x, nd = 1) => C.pyFormat(x, `.${nd}f`).replace('.', ',');

  // ------------------------------------------------------------------------------------------ filas
  function filaRef(bd, sid, conTexto = false) {
    const extraCol = conTexto ? ', speech' : '';
    const r = S.tuplas(bd, `SELECT ${SQL_COLS}${extraCol} FROM speeches WHERE id = ?`, [sid])[0];
    if (!r) return null;
    const d = {};
    COLS.forEach((c, i) => { d[c] = r[i]; });
    if (conTexto) d.speech = r[COLS.length] || '';
    return d;
  }

  function publica(d, info) {
    return {
      id: d.id, date: d.date, num_session: d.num_session,
      ord: d.ord, official_order: d.ord !== null && d.ord !== undefined ? d.ord + 1 : null,
      year: d.year, legislature: d.legislature,
      speaker: d.speaker, label: info.etiqueta, role: info.role,
      rep_id: d.rep_id, rep_name: d.rep_name, party: d.party,
      sex: d.sex, district: d.district, session_type: d.session_type, nwords: d.nwords,
    };
  }

  function mismoOrador(a, b) {
    if (a.rep_id !== null && a.rep_id !== undefined && b.rep_id !== null && b.rep_id !== undefined) return a.rep_id === b.rep_id;
    return C.strip(plegar(a.speaker)) === C.strip(plegar(b.speaker));
  }

  function avisosMismaFecha(bd, ref) {
    const otras = S.columna(bd,
      'SELECT DISTINCT num_session FROM speeches '
      + 'WHERE date = ? AND COALESCE(num_session, -1) <> COALESCE(?, -1) ORDER BY num_session',
      [ref.date, ref.num_session]);
    if (!otras.length) return [];
    const lista = otras.map((x) => (x === null ? 's/n' : `n.º ${x}`)).join(', ');
    const propia = ref.num_session === null ? 's/n' : `n.º ${ref.num_session}`;
    return [{
      code: 'same_date_sessions',
      other_sessions: otras,
      message: `El ${ref.date} consta también la sesión ${lista}. El careo solo compara `
        + `dentro de la sesión ${propia}: si es una doble sesión real, la otra no se `
        + 'mira; si es la misma sesión catalogada dos veces, falta la otra mitad.',
    }];
  }

  // ------------------------------------------------------------------------------------------ misma sesión
  function synchronic(bd, speechId, top = 5) {
    const t0 = ahora();
    const ref = filaRef(bd, speechId, true);
    if (ref === null) return null;
    const refInfo = analizarOrador(ref.speaker);
    const refTxt = nfc(ref.speech);
    const refPleg = plegar(refTxt);
    const refSpans = spansParentesis(refTxt);

    const filas = S.tuplas(bd, `
        SELECT ${SQL_COLS}, CASE WHEN nwords >= ? THEN speech END
        FROM speeches
        WHERE date = ? AND COALESCE(num_session, -1) = COALESCE(?, -1)
        ORDER BY ord
    `, [MIN_WORDS_SYNC, ref.date, ref.num_session]);

    const cands = [];
    let excluidasPresidencia = 0;
    for (const row of filas) {
      const d = {};
      COLS.forEach((c, i) => { d[c] = row[i]; });
      if (d.id === ref.id || (d.nwords || 0) < MIN_WORDS_SYNC) continue;
      const info = analizarOrador(d.speaker);
      if (PRESIDENCIA_CAMARA.has(info.role)) { excluidasPresidencia += 1; continue; }
      if (mismoOrador(ref, d)) continue; // continuaciones del mismo orador: no son réplica
      d._info = info;
      d._texto = nfc(row[COLS.length]);
      cands.push(d);
    }

    // Turnos sustantivos de otros oradores, para medir la cercanía en turnos de debate y no en filas.
    const ords = cands.map((c) => c.ord).filter((o) => o !== null && o !== undefined).sort((a, b) => a - b);

    const desdeRef = new Map();
    const resultados = [];
    for (const c of cands) {
      const info = c._info;
      let score = 0.0;
      const motivos = [];

      // --- alusiones e interrupciones, en ambas direcciones ---
      const clave = c.speaker || '';
      if (!desdeRef.has(clave)) desdeRef.set(clave, contarAlusiones(refTxt, refPleg, info.patrones, refSpans));
      const deRef = desdeRef.get(clave); // el candidato, dentro del texto de la referencia
      const aRef = contarAlusiones(c._texto, plegar(c._texto), refInfo.patrones);

      for (const [a, txtAlusion, txtInterrupcion] of [
        [aRef, `Alude ${al(refInfo.etiqueta)}`, `Interrumpido por ${por(refInfo.etiqueta)}`],
        [deRef, `${refInfo.etiqueta} alude ${al(info.etiqueta)}`, `Interrumpe ${al(refInfo.etiqueta)}`],
      ]) {
        const n = a.nombre + a.cargo;
        if (n) {
          score += (a.nombre ? PESO_ALUSION_NOMBRE : PESO_ALUSION_CARGO) + extra(n);
          motivos.push(txtAlusion + veces(n));
        }
        if (a.interrupciones) {
          score += PESO_INTERRUPCION + extra(a.interrupciones);
          motivos.push(txtInterrupcion + veces(a.interrupciones));
        }
      }

      // --- cercanía en el orden del debate ---
      let k = null;
      if (c.ord !== null && c.ord !== undefined && ref.ord !== null && ref.ord !== undefined) {
        const lo = Math.min(c.ord, ref.ord), hi = Math.max(c.ord, ref.ord);
        k = Math.max(0, bisectLeft(ords, hi) - bisectRight(ords, lo));
        score += PESO_TURNO * (DECAIMIENTO_TURNO ** k);
        if (k === 0) motivos.push(`Turno contiguo (orden ${c.ord + 1})`);
        else if (k <= 3) motivos.push(`Turno cercano (orden ${c.ord + 1}, ${k} ${k === 1 ? 'turno' : 'turnos'} en medio)`);
      }

      // --- afinidad política: otro partido (este corpus no trae familia ni ideología) ---
      const otroPartido = !sinDato(ref.party) && !sinDato(c.party) && c.party !== ref.party;
      if (otroPartido) {
        score += PESO_OTRA_FAMILIA;
        motivos.push(`Otro partido (${c.party})`);
      }

      const item = publica(c, info);
      Object.assign(item, {
        score: C.pyRound(score, 1),
        reasons: motivos,
        signals: {
          menciones_a_referencia: aRef.nombre + aRef.cargo,
          menciones_desde_referencia: deRef.nombre + deRef.cargo,
          interrumpe_a_referencia: deRef.interrupciones,
          interrumpido_por_referencia: aRef.interrupciones,
          acotaciones: aRef.acotaciones + deRef.acotaciones,
          turnos_en_medio: k,
          otro_partido: otroPartido,
        },
      });
      resultados.push(item);
    }

    const refOrd = ref.ord || 0;
    const claveOrden = (x) => [-x.score, Math.abs((x.ord !== null && x.ord !== undefined ? x.ord : 10 ** 6) - refOrd), -(x.nwords || 0)];
    const ordenados = resultados.map((x, i) => [claveOrden(x), i, x]).sort((p, q) => {
      for (let j = 0; j < 3; j++) if (p[0][j] !== q[0][j]) return p[0][j] < q[0][j] ? -1 : 1;
      return p[1] - q[1];
    }).map((p) => p[2]);

    return {
      mode: 'synchronic',
      heuristic: true,
      note: NOTA_SYNC,
      target: publica(ref, refInfo),
      results: ordenados.slice(0, Math.max(1, Math.trunc(top))),
      n_candidates: cands.length,
      excluded_chair: excluidasPresidencia,
      warnings: avisosMismaFecha(bd, ref),
      ms: ms(t0),
    };
  }

  // ------------------------------------------------------------------------------------------ mismo diputado
  function terminosFrecuentes(texto, n = 12) {
    // Fuera lo que va entre paréntesis: acotaciones e interrupciones no dicen de qué trata el discurso.
    texto = RX_PAREN_600.sub(' ', nfc(texto));
    const toks = RX_AZ09.findall(plegar(texto));
    const cnt = new Map();
    for (const t of toks) {
      if (t.length >= 4 && !/^[0-9]+$/.test(t) && !VACIAS.has(t) && !VACIAS_SALA.has(t)) cnt.set(t, (cnt.get(t) || 0) + 1);
    }
    // Counter.most_common(n): recuento descendente; a igual recuento, orden de primera aparición (orden estable).
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]);
  }

  function diaOrdinal(s) {
    if (typeof s !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (y < 1 || mo < 1 || mo > 12 || d < 1) return null;
    const f = new Date(0);
    f.setUTCFullYear(y, mo - 1, d);
    if (f.getUTCFullYear() !== y || f.getUTCMonth() !== mo - 1 || f.getUTCDate() !== d) return null;
    return Math.round(f.getTime() / 86400000);
  }

  function añosEntre(a, b) {
    const da = diaOrdinal(a.date), db = diaOrdinal(b.date);
    if (da !== null && db !== null) return Math.abs(da - db) / 365.25;
    return Math.abs((a.year || 0) - (b.year || 0));
  }

  /** Todos los varint (formato SQLite, big-endian) de un blob de FTS5. */
  function varints(b) {
    const out = [];
    let v = 0;
    for (const x of b) {
      v = v * 128 + (x & 0x7F);
      if (x < 0x80) { out.push(v); v = 0; }
    }
    return out;
  }

  /** bm25 de FTS5 para `terminos` (OR) calculado solo sobre los candidatos (fts5vocab). Map id → relevancia. */
  function bm25Vocab(bd, terminos, candIds) {
    S.ejecutar(bd, 'CREATE VIRTUAL TABLE IF NOT EXISTS temp.careo_vi USING fts5vocab(main, speeches_fts, instance)');
    S.ejecutar(bd, 'CREATE VIRTUAL TABLE IF NOT EXISTS temp.careo_vr USING fts5vocab(main, speeches_fts, row)');
    const prom = S.tuplas(bd, 'SELECT block FROM speeches_fts_data WHERE id = 1')[0];
    const tot = prom && prom[0] && prom[0].length ? varints(prom[0]) : [];
    if (tot.length < 2 || !tot[0]) throw new Error('speeches_fts sin registro de promedios');
    const nFilas = tot[0], nTokens = tot[1];
    const media = nTokens / nFilas;

    const cand = Array.from(candIds).sort((a, b) => a - b);
    if (!cand.length) return new Map();
    const lo = cand[0], hi = cand[cand.length - 1];
    const acum = new Float64Array(cand.length);
    const tfs = [];
    for (const t of new Set(terminos)) {
      const fila = S.tuplas(bd, 'SELECT doc FROM temp.careo_vr WHERE term = ?', [t])[0];
      if (!fila || !fila[0]) continue;
      const s = S.valor(bd, 'SELECT group_concat(doc) FROM temp.careo_vi WHERE term = ? AND doc BETWEEN ? AND ?', [t, lo, hi]);
      if (!s) continue;
      const tf = new Float64Array(cand.length);
      for (const x of String(s).split(',')) {
        const doc = Number(x);
        const pos = Math.min(bisectLeft(cand, doc), cand.length - 1);
        if (cand[pos] === doc) tf[pos] += 1;
      }
      const nHit = Number(fila[0]);
      const idf = Math.log((nFilas - nHit + 0.5) / (nHit + 0.5));
      tfs.push([idf > 0 ? idf : 1e-6, tf]);
    }
    if (!tfs.length) return new Map();
    const presentes = [];
    for (let i = 0; i < cand.length; i++) {
      let suma = 0;
      for (const [, tf] of tfs) suma += tf[i];
      if (suma > 0) presentes.push(i);
    }
    const longDoc = new Float64Array(cand.length);
    const ids = presentes.map((i) => cand[i]);
    for (let i = 0; i < ids.length; i += MAX_SQL_PARAMS) {
      const lote = ids.slice(i, i + MAX_SQL_PARAMS);
      for (const [rid, sz] of S.tuplas(bd, `SELECT id, sz FROM speeches_fts_docsize WHERE id IN (${lote.map(() => '?').join(',')})`, lote)) {
        const v = sz instanceof Uint8Array ? varints(sz) : [];
        longDoc[bisectLeft(cand, rid)] = v.length ? v[0] : 0;
      }
    }
    for (const [idf, tf] of tfs) {
      for (let i = 0; i < cand.length; i++) {
        const denom = K1_BM25 * (1 - B_BM25 + B_BM25 * longDoc[i] / media);
        acum[i] += idf * (tf[i] * (K1_BM25 + 1)) / (tf[i] + denom);
      }
    }
    return new Map(presentes.map((i) => [cand[i], acum[i]]));
  }

  /** [Map id → relevancia bm25 (mayor es mejor), vía] dentro del mismo diputado. */
  function relevanciasFts(bd, terminos, candIds, repId, sid, vocab = true) {
    if (!terminos.length || !candIds.size) return [new Map(), 'none'];
    if (vocab) {
      try {
        return [bm25Vocab(bd, terminos, candIds), 'fts5vocab'];
      } catch (e) { /* vía MATCH */ }
    }
    const consulta = terminos.map((t) => `"${t}"`).join(' OR ');
    const filas = S.tuplas(bd, `
        SELECT rowid, bm25(speeches_fts) FROM speeches_fts
        WHERE speeches_fts MATCH ?
          AND rowid IN (SELECT id FROM speeches WHERE rep_id = ? AND nwords >= ? AND id <> ?)
    `, [consulta, repId, MIN_WORDS_DIAC, sid]);
    const out = new Map();
    for (const [rid, sc] of filas) if (candIds.has(Number(rid))) out.set(Number(rid), -Number(sc));
    return [out, 'match'];
  }

  function diachronic(bd, speechId, top = 5) {
    const t0 = ahora();
    const ref = filaRef(bd, speechId, true);
    if (ref === null) return null;
    const refInfo = analizarOrador(ref.speaker);
    const out = {
      mode: 'diachronic', heuristic: true, method: null, note: '',
      target: publica(ref, refInfo), results: [], n_candidates: 0,
      top_similar: RANGO_DIAC,
    };
    if (ref.rep_id === null || ref.rep_id === undefined) {
      out.note = 'La intervención no tiene diputado identificado: no hay con quién compararla.';
      out.ms = ms(t0);
      return out;
    }

    const filas = S.tuplas(bd, `
        SELECT ${SQL_COLS} FROM speeches
        WHERE rep_id = ? AND id <> ? AND nwords >= ?
          AND NOT (date = ? AND COALESCE(num_session, -1) = COALESCE(?, -1))
    `, [ref.rep_id, ref.id, MIN_WORDS_DIAC, ref.date, ref.num_session]);
    const refEsPresidencia = PRESIDENCIA_CAMARA.has(refInfo.role);
    const cands = new Map();
    for (const row of filas) {
      const d = {};
      COLS.forEach((c, i) => { d[c] = row[i]; });
      const info = analizarOrador(d.speaker);
      // Quien preside comparte rep_id con su escaño: solo se comparan filas de Presidencia si la referencia también lo es.
      if (PRESIDENCIA_CAMARA.has(info.role) && !refEsPresidencia) continue;
      d._info = info;
      cands.set(d.id, d);
    }
    out.n_candidates = cands.size;
    if (!cands.size) {
      out.note = 'No hay otras intervenciones de este diputado con 150 palabras o más.';
      out.ms = ms(t0);
      return out;
    }

    // Sin vectores en esta edición: coincidencia léxica.
    const terminos = terminosFrecuentes(ref.speech);
    out.method = 'fts';
    out.note = NOTA_DIAC_FTS;
    out.terms = terminos;
    const [relevancia, via] = relevanciasFts(bd, terminos, new Set(cands.keys()), ref.rep_id, ref.id);
    out.fts_scoring = via;

    if (!relevancia.size) {
      out.ms = ms(t0);
      return out;
    }

    let lo = Infinity, hi = -Infinity;
    for (const v of relevancia.values()) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const ordenSim = [...relevancia.keys()].sort((a, b) => {
      const va = relevancia.get(a), vb = relevancia.get(b);
      if (va !== vb) return va > vb ? -1 : 1;
      return a - b;
    });
    const puesto = new Map(ordenSim.map((s, i) => [s, i]));
    const nRel = ordenSim.length;
    const resultados = [];
    for (const [sid, val] of relevancia) {
      const c = cands.get(sid);
      const rel = hi > lo ? (val - lo) / (hi - lo) : 1.0;
      const años = añosEntre(ref, c);
      const score = rel * Math.log1p(años);
      const enRango = puesto.get(sid) < RANGO_DIAC;
      const motivos = [];
      motivos.push(`Coincidencia léxica ${numEs(rel, 2)} (relativa)`);
      if (enRango) motivos.push(`Entre las ${RANGO_DIAC} más parecidas (puesto ${puesto.get(sid) + 1} de ${nRel})`);
      else motivos.push(`Puesto ${puesto.get(sid) + 1} de ${nRel} por parecido`);
      motivos.push(`A ${numEs(años)} años (${c.date})`);
      if (c.legislature && c.legislature !== ref.legislature) motivos.push(`Otra legislatura (${c.legislature})`);
      const item = publica(c, c._info);
      Object.assign(item, {
        score: C.pyRound(score, 4),
        similarity: null,
        relevance: C.pyRound(rel, 3),
        similarity_rank: puesto.get(sid) + 1,
        in_top_similar: enRango,
        years_apart: C.pyRound(años, 2),
        reasons: motivos,
      });
      resultados.push([[enRango ? 0 : 1, -score, -rel, sid], item]);
    }
    resultados.sort((p, q) => {
      for (let j = 0; j < 4; j++) if (p[0][j] !== q[0][j]) return p[0][j] < q[0][j] ? -1 : 1;
      return 0;
    });
    out.results = resultados.slice(0, Math.max(1, Math.trunc(top))).map((p) => p[1]);
    out.ms = ms(t0);
    return out;
  }

  // ------------------------------------------------------------------------------------------ ruta
  /** Corpus._locked_careo: speaker_label de diario.parse_speaker en la referencia y en cada resultado. */
  function etiquetar(res) {
    const D = R2.diario;
    if (!D || typeof D.parse_speaker !== 'function') return res;
    for (const item of [res.target].concat(res.results || [])) {
      if (!item) continue;
      const p = D.parse_speaker(item.speaker, item.rep_name);
      item.speaker_label = p instanceof Map ? p.get('label') : (p ? p.label : null);
    }
    return res;
  }

  function careo(bd, sid, mode = 'synchronic', top = 5) {
    let res;
    if (mode === 'synchronic') res = synchronic(bd, sid, top);
    else if (mode === 'diachronic') res = diachronic(bd, sid, top);
    else throw RT.solicitud('Modo de careo no válido: use synchronic o diachronic.');
    return res === null ? null : etiquetar(res);
  }

  function valorQuery(q, clave) {
    const v = q && Object.prototype.hasOwnProperty.call(q, clave) ? q[clave] : undefined;
    return Array.isArray(v) ? v[v.length - 1] : v;
  }

  RT.registrar('GET', '/careo/{sid}', (pet, ctx) => {
    const sid = V.entero(pet.params.sid, 'sid');
    const modo = valorQuery(pet.query, 'mode');
    const mode = modo === undefined || modo === null ? 'synchronic' : String(modo);
    if (mode !== 'synchronic' && mode !== 'diachronic') {
      throw RT.noValido(`mode debe ser synchronic o diachronic (recibido: ${C.pyRepr(mode)}).`);
    }
    const t = valorQuery(pet.query, 'top');
    const top = t === undefined || t === null ? 5 : V.entero(t, 'top', 1, 20);
    const res = careo({ db: ctx.db, sqlite3: ctx.sqlite3 }, sid, mode, top);
    if (res === null) throw new RT.ErrorHttp(404, 'No existe esa intervencion.');
    return res;
  }, { prioridad: 'interactiva' });

  R2.careo = Object.freeze({
    synchronic, diachronic, careo, etiquetar,
    analizar_orador: analizarOrador, es_presidencia_camara: esPresidenciaCamara,
    plegar, terminos_frecuentes: terminosFrecuentes, contar_alusiones: contarAlusiones, spans_parentesis: spansParentesis,
  });
})(globalThis.R2 = globalThis.R2 || {});

/* ===== src/engine/lectura.js ===== */
/* 2REP_Standalone · engine/lectura.js
 *
 * Lector y sesión corrida (M5). Port de app/backend/search.py (Corpus._locked_speech_data, _otras_sesiones, speech,
 * _locked_session_outline_data, session_outline, _locked_session_texts_data y session_texts, con el mismo SQL y los
 * mismos textos) y de server.py (api_speech, api_session_outline, api_session_texts).
 *
 * Rutas (interactivas):
 *   GET /speech/{sid}?context=3        context 0..50; 404 «No existe esa intervencion.»; collections e item_meta de la
 *                                      biblioteca vigente
 *   GET /session/outline/{sid}         cabeceras de todas las intervenciones de la sesión, sin texto
 *   GET /session/texts?from_id&to_id   documentos de un tramo de UNA sesión (tope 60 intervenciones o 250.000 caracteres;
 *                                      una sola siempre cabe); 400 si el tramo no vale, 404 si un extremo no existe
 * Parámetros de ruta y de consulta como FastAPI/pydantic (R2.rutasBiblioteca.enteroPydantic): «Parametros no validos. …».
 *
 * Dependencias: R2.diario (parse_speaker, parse_speech; se busca al llamar), R2.climate (caché de documentos),
 * R2.sessions (session_warnings), R2.rutasBiblioteca (enteroPydantic, avisoSesion = Corpus._session_warning),
 * R2.search (fila, membership), R2.library.actual() (item_meta) y ctx.nucleo.sesiones() (SessionIndex).
 *
 * API (R2.lectura): speechData(ctx, sid, context) · speech(ctx, sid, context, full) · sessionOutline(ctx, sid) ·
 *   async sessionTexts(ctx, fromId, toId) · otrasSesiones(bd, date, num) · parametros(pet, defs) · rutas rutaSpeech,
 *   rutaOutline, rutaTexts.
 */
(function (R2) {
  'use strict';

  const RT = R2.router, S = R2.sql, C = R2.py && R2.py.core;
  const CL = R2.climate, RB = R2.rutasBiblioteca;
  if (!RT || !S || !C || !CL || !RB || !R2.sessions || !R2.search) {
    throw new Error('engine/lectura.js necesita R2.router, R2.sql, R2.py.core, R2.climate, R2.rutasBiblioteca, R2.sessions y R2.search (src/orden.json)');
  }
  const K = R2.gen.constantes.search;
  const ErrorHttp = RT.ErrorHttp;
  const MAX_SPEECHES = K.SESSION_TEXTS_MAX_SPEECHES;
  const MAX_CHARS = K.SESSION_TEXTS_MAX_CHARS;
  const MSG_NO_EXISTE = 'No existe esa intervencion.';
  const INT64_MIN = -9223372036854775808n, INT64_MAX = 9223372036854775807n;

  const tiene = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const bdDe = (ctx) => ({ db: ctx.db, sqlite3: ctx.sqlite3 });
  const s = (v) => C.pyStr(v);

  function diario() {
    const D = R2.diario;
    if (!D || typeof D.parse_speaker !== 'function') throw new Error('engine/lectura.js necesita R2.diario (engine/diario.js)');
    return D;
  }

  function indice(ctx) {
    const n = ctx && ctx.nucleo;
    const idx = n && typeof n.sesiones === 'function' ? n.sesiones() : null;
    if (!idx) throw new Error('engine/lectura.js: falta el índice de sesiones (ctx.nucleo.sesiones())');
    return idx;
  }

  // ------------------------------------------------------------------------------------------------ parámetros
  /**
   * Parámetros enteros de la ruta y de la consulta como RequestValidationError. defs = [[origen 'ruta' | 'consulta',
   * nombre, {defecto, requerido, ge, le}]]. Un entero que no cabe en 64 bits da el 422 de server.numero_fuera_de_rango.
   */
  function parametros(pet, defs) {
    const out = {}, errores = [];
    for (const [origen, nombre, reglas = {}] of defs) {
      const src = origen === 'ruta' ? pet.params : pet.query;
      const bruto = tiene(src, nombre) ? src[nombre] : undefined;
      if (bruto === undefined || bruto === null) {
        if (reglas.requerido) errores.push(`${nombre}: Field required`);
        else out[nombre] = reglas.defecto;
        continue;
      }
      const r = RB.enteroPydantic(bruto);
      if (r.error) { errores.push(`${nombre}: ${r.error}`); continue; }
      if (reglas.ge !== undefined && r.valor < reglas.ge) { errores.push(`${nombre}: Input should be greater than or equal to ${reglas.ge}`); continue; }
      if (reglas.le !== undefined && r.valor > reglas.le) { errores.push(`${nombre}: Input should be less than or equal to ${reglas.le}`); continue; }
      out[nombre] = r.valor;
    }
    if (errores.length) throw new ErrorHttp(422, `Parametros no validos. ${errores.join('; ')}`);
    for (const v of Object.values(out)) {
      if (typeof v === 'bigint' && (v < INT64_MIN || v > INT64_MAX)) throw new ErrorHttp(422, RB.MSG_OVERFLOW);
    }
    return out;
  }

  const oficial = (ord) => (ord !== null && ord !== undefined ? ord + 1 : null);

  // ------------------------------------------------------------------------------------------------ intervención
  /** Corpus._otras_sesiones */
  function otrasSesiones(bd, date, numSession) {
    return S.columna(bd, 'SELECT DISTINCT num_session FROM speeches '
      + 'WHERE date = ? AND num_session IS NOT NULL AND num_session <> ? ORDER BY num_session',
    [date, numSession !== null && numSession !== undefined ? numSession : -1]);
  }

  /** Corpus._locked_speech_data: {…fila, speech, party_family_raw, ideology_raw, context, session} y aparte otras, index, meta. */
  function speechData(ctx, sid, context = 3) {
    const bd = bdDe(ctx);
    const r = S.filas(bd, 'SELECT * FROM speeches WHERE id = ?', [sid])[0];
    if (!r) return null;
    const d = R2.search.fila(r);
    d.speech = r.speech;

    const o = r.ord || 0;
    const vecinas = S.filas(bd, `
            SELECT id, ord, speaker, rep_name, party, sex, dm_speech, nwords,
                   substr(speech, 1, 180) AS frag
            FROM speeches
            WHERE date = ? AND COALESCE(num_session, -1) = COALESCE(?, -1)
              AND ord BETWEEN ? AND ?
            ORDER BY ord
        `, [r.date, r.num_session, o - context, o + context]);
    d.context = vecinas.map((n) => ({
      id: n.id, ord: n.ord, speaker: n.speaker, rep_name: n.rep_name, party: n.party, sex: n.sex, dm_speech: n.dm_speech,
      nwords: n.nwords, preview: (n.frag || '').replace(/\n/g, ' '), is_current: String(n.id) === String(sid),
    }));

    const ses = S.filas(bd, `
            SELECT COUNT(*) AS n, SUM(nwords) AS w, MIN(ord) AS a, MAX(ord) AS b
            FROM speeches WHERE date = ? AND COALESCE(num_session,-1) = COALESCE(?,-1)
        `, [r.date, r.num_session])[0];
    d.session = { n_speeches: ses.n, n_words: ses.w, ord_min: ses.a, ord_max: ses.b };

    const otras = otrasSesiones(bd, r.date, r.num_session);
    const index = S.valor(bd, `
            SELECT COUNT(*) FROM speeches
            WHERE date = ? AND COALESCE(num_session,-1) = COALESCE(?,-1) AND id <= ?
        `, [r.date, r.num_session, sid]);
    const meta = indice(ctx).for_speech(sid, bd);
    return { d, otras, index, meta };
  }

  /** Corpus.speech */
  function speech(ctx, sid, context = 3, full = true) {
    const base = speechData(ctx, sid, context);
    if (base === null) return null;
    const { d, otras, index, meta } = base;
    const sw = RB.avisoSesion(indice(ctx), d.date, d.num_session, meta, otras);
    if (sw) d.session_warning = sw;
    if (!full) return d;
    const D = diario();
    const doc = CL.doc(ctx, d.id, d.speech, d.speaker, d.rep_name);
    d.doc = doc;
    d.official_order = oficial(d.ord);
    d.speaker_label = doc.speaker.label;
    d.role = doc.speaker.role;
    for (const c of d.context) {
      const p = D.parse_speaker(c.speaker, c.rep_name);
      c.official_order = oficial(c.ord);
      c.speaker_label = p.label;
      c.role = p.role;
    }
    d.session_meta = meta;
    d.position = { index, of: d.session.n_speeches };
    d.warnings = R2.sessions.sessionWarnings(meta, d.ord);
    return d;
  }

  // ------------------------------------------------------------------------------------------------ sesión corrida
  /** Corpus.session_outline */
  function sessionOutline(ctx, sid) {
    const bd = bdDe(ctx);
    const r = S.filas(bd, 'SELECT date, num_session, session_number, session_type, legislature, legislative_session FROM speeches WHERE id = ?', [sid])[0];
    if (!r) return null;
    const filas = S.filas(bd, `
            SELECT id, ord, speaker, rep_name, party, sex, district, session_type, dm_speech, nwords,
                   nbytes AS nchars
            FROM speeches WHERE date = ? AND COALESCE(num_session,-1) = COALESCE(?,-1)
            ORDER BY id
        `, [r.date, r.num_session]);
    const otras = otrasSesiones(bd, r.date, r.num_session);
    const sesiones = indice(ctx);
    const meta = sesiones.for_speech(sid, bd);
    const D = diario();
    const cabeceras = [];
    let ref = null;
    filas.forEach((f, k) => {
      const i = k + 1;
      const p = D.parse_speaker(f.speaker, f.rep_name);
      const h = {
        id: f.id, index: i, ord: f.ord, official_order: oficial(f.ord),
        speaker: f.speaker, speaker_label: p.label, speaker_title: p.title,
        role: p.role, chair_name: p.is_chair ? (p.name === undefined ? null : p.name) : null,
        rep_name: f.rep_name, party: f.party, sex: f.sex, session_type: f.session_type,
        dm_speech: f.dm_speech, district: f.district,
        nwords: f.nwords, nchars: f.nchars || 0,
      };
      if (String(f.id) === String(sid)) ref = { id: sid, index: i, official_order: h.official_order };
      cabeceras.push(h);
    });
    return {
      session_id: meta ? meta.session_id : filas[0].id,
      date: r.date, num_session: r.num_session, session_number: r.session_number, session_type: r.session_type,
      legislature: r.legislature, legislative_session: r.legislative_session,
      session_meta: meta,
      totals: {
        n_speeches: filas.length,
        n_words: filas.reduce((a, f) => a + (f.nwords || 0), 0),
        n_chars: filas.reduce((a, f) => a + (f.nchars || 0), 0),
      },
      reference: ref,
      warnings: R2.sessions.sessionWarnings(meta),
      session_warning: RB.avisoSesion(sesiones, r.date, r.num_session, meta, otras),
      limits: { max_speeches: MAX_SPEECHES, max_chars: MAX_CHARS },
      speeches: cabeceras,
    };
  }

  /** {chars:,} de Python con «.» de miles (el texto entero pasa por .replace(",", ".")). */
  const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const mayor = (a, b) => BigInt(a) > BigInt(b);

  /** Corpus._locked_session_texts_data + session_texts */
  async function sessionTexts(ctx, fromId, toId) {
    const bd = bdDe(ctx);
    if (mayor(fromId, toId)) throw RT.solicitud(`from_id (${fromId}) no puede ser mayor que to_id (${toId}).`);
    const ext = {};
    for (const [nombre, i] of [['from_id', fromId], ['to_id', toId]]) {
      const r = S.filas(bd, 'SELECT date, num_session FROM speeches WHERE id = ?', [i])[0];
      if (!r) throw new ErrorHttp(404, `No existe la intervención ${nombre}=${i}.`);
      ext[nombre] = [r.date, r.num_session];
    }
    if (ext.from_id[0] !== ext.to_id[0] || ext.from_id[1] !== ext.to_id[1]) {
      throw RT.solicitud(`El tramo ${fromId}–${toId} cruza sesiones: ${fromId} es de la sesión del `
        + `${s(ext.from_id[0])} (núm. ${s(ext.from_id[1])}) y ${toId} de la del `
        + `${s(ext.to_id[0])} (núm. ${s(ext.to_id[1])}). Pida cada sesión por separado.`);
    }
    const [date, num] = ext.from_id;
    const where = 'id BETWEEN ? AND ? AND date = ? AND COALESCE(num_session,-1) = COALESCE(?,-1)';
    const args = [fromId, toId, date, num];
    const [n, chars] = S.tuplas(bd, `SELECT COUNT(*), COALESCE(SUM(nbytes), 0) FROM speeches WHERE ${where}`, args)[0];
    if (n > MAX_SPEECHES) {
      throw RT.solicitud(`El tramo ${fromId}–${toId} tiene ${n} intervenciones y el tope es `
        + `${MAX_SPEECHES}. Pídalo en tramos más cortos (use nchars de `
        + '/api/session/outline para planificarlos).');
    }
    if (n > 1 && chars > MAX_CHARS) {
      throw RT.solicitud(`El tramo ${fromId}–${toId} suma ${miles(chars)} caracteres y el tope es `
        + `${miles(MAX_CHARS)}. Pídalo en tramos más cortos (una intervención `
        + 'sola siempre cabe).');
    }
    const filas = S.tuplas(bd, `SELECT id, speaker, rep_name, speech FROM speeches WHERE ${where} ORDER BY id`, args);
    const sesion = indice(ctx).session_id_for(fromId, bd);
    const texts = [];
    for (const f of filas) {
      texts.push({ id: f[0], doc: CL.doc(ctx, f[0], f[3] || '', f[1], f[2]) });
      if (ctx && typeof ctx.ceder === 'function') await ctx.ceder();
    }
    return { session_id: sesion, date, num_session: num, n, chars, from_id: fromId, to_id: toId, texts };
  }

  // ------------------------------------------------------------------------------------------------ rutas
  /** server.api_speech */
  async function rutaSpeech(pet, ctx) {
    const p = parametros(pet, [['ruta', 'sid'], ['consulta', 'context', { defecto: 3, ge: 0, le: 50 }]]);
    const d = speech(ctx, p.sid, p.context);
    if (d === null) throw new ErrorHttp(404, MSG_NO_EXISTE);
    const nombre = ctx.corpus && ctx.corpus.nombre;
    const memb = await R2.search.membership(ctx, [p.sid]);
    d.collections = tiene(memb, String(p.sid)) ? memb[String(p.sid)] : [];
    const metas = {};
    const lib = R2.library && typeof R2.library.actual === 'function' ? R2.library.actual() : null;
    for (const cid of d.collections) {
      const m = lib && typeof lib.item_meta === 'function' ? lib.item_meta(cid, nombre, p.sid) : null;
      if (m) metas[String(cid)] = m;
    }
    d.item_meta = metas;
    return d;
  }

  /** server.api_session_outline */
  async function rutaOutline(pet, ctx) {
    const p = parametros(pet, [['ruta', 'sid']]);
    const d = sessionOutline(ctx, p.sid);
    if (d === null) throw new ErrorHttp(404, MSG_NO_EXISTE);
    return d;
  }

  /** server.api_session_texts */
  async function rutaTexts(pet, ctx) {
    const p = parametros(pet, [['consulta', 'from_id', { requerido: true }], ['consulta', 'to_id', { requerido: true }]]);
    return sessionTexts(ctx, p.from_id, p.to_id);
  }

  RT.registrar('GET', '/speech/{sid}', rutaSpeech, { prioridad: 'interactiva' });
  RT.registrar('GET', '/session/outline/{sid}', rutaOutline, { prioridad: 'interactiva' });
  RT.registrar('GET', '/session/texts', rutaTexts, { prioridad: 'interactiva' });

  R2.lectura = Object.freeze({
    MAX_SPEECHES, MAX_CHARS, MSG_NO_EXISTE, parametros, otrasSesiones, speechData, speech, sessionOutline, sessionTexts,
    rutaSpeech, rutaOutline, rutaTexts,
  });
})(globalThis.R2 = globalThis.R2 || {});

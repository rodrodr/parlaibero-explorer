/* ===== src/engine/rutas_biblioteca.js ===== */
/* 2REP_Standalone · engine/rutas_biblioteca.js
 *
 * Rutas /api de las bibliotecas en el worker (M4), registradas en R2.router con la semántica, los códigos y los mensajes de
 * app/backend/server.py (bibliotecas 573-749, exportar 952-991 solo .2replib, importar 1018-1032) sobre R2.library y
 * R2.paquetes:
 *
 *   GET    /collections                        {collections}
 *   POST   /collections                        create_collection
 *   PATCH  /collections/{cid}                  update_collection · 404
 *   DELETE /collections/{cid}                  borrado atómico · 404 «(quizá ya se borró)»
 *   GET    /collections/{cid}/items            limit 1..5000 (500), offset ≥ 0; filas ligeras de speech(full=False) con
 *                                              session y session_warning, note, tags, added_at, snippet; ids_hash
 *   POST   /collections/{cid}/items            speech_ids o add_all_results («Guardar todo», con la lista de la búsqueda)
 *   POST   /collections/{cid}/items/remove
 *   PATCH  /collections/{cid}/items/{sid}      note / tags
 *   GET    /searches · POST /searches · DELETE /searches/{sid}
 *   POST   /import                             2replib/1 (import_library_bundle) y 2replib-copia/1 («Exportar todas»)
 *   POST   /export                             solo format=bundle (.2replib); los demás formatos, 501 hasta M6
 *   POST   /collections/export-all                       «Exportar todas» (solo Standalone): 2replib-copia/1
 * Internas (las usa la persistencia del hilo principal, ARQUITECTURA.md §9.5; no las llama la interfaz):
 *   GET    /_biblioteca/volcado                la base serializada (tipo «bytes»)
 *   POST   /_biblioteca/restaurar              {bytes | bytes_base64 | null}: sustituye la base (una copia dañada → 422)
 *   POST   /_biblioteca/modo                   {solo_lectura}: en solo lectura toda ruta que cambia algo responde 409
 *   GET    /_biblioteca/estado                 {version, solo_lectura, resumen}
 *
 * Cada respuesta de una ruta que cambió la base lleva la cabecera «x-r2-biblioteca: <versión>»; la de «Exportar todas»,
 * «x-r2-exportadas: 1». Validación de parámetros de ruta y consulta como FastAPI/pydantic («Parametros no validos. cid:
 * Input should be a valid integer, unable to parse string as an integer»); un entero que no cabe en 64 bits al llegar a
 * SQLite da el 422 de server.numero_fuera_de_rango.
 *
 * Servicios: R2.router.servicios.biblioteca = { get_collection, collection_existio, item_ids, membership } para la
 * búsqueda (filters.collection_id y las marcas ◆).
 * Dependencias de la búsqueda (M4, agente de búsqueda): «Guardar todo» usa la lista completa de server._lista_busqueda
 * (R2.search.listaBusqueda) y session_warning usa el índice de sesiones (R2.sessions).
 */
(function (R2) {
  'use strict';

  const RT = R2.router;
  const L = R2.library;
  const P = R2.paquetes;
  const C = R2.py && R2.py.core;
  if (!RT || !L || !P || !C || !R2.sessions) {
    throw new Error('engine/rutas_biblioteca.js necesita R2.router, R2.sessions, R2.library, R2.paquetes y R2.py.core (src/orden.json)');
  }
  const V = RT.validar;
  const ErrorHttp = RT.ErrorHttp;

  const MSG_OVERFLOW = 'Parametros no validos. Número fuera de rango: los ids y demás enteros deben caber en 64 bits.';
  const MSG_SOLO_LECTURA = 'Sus bibliotecas están abiertas en otra pestaña de 2REP_Standalone: en esta solo se pueden consultar. Pulse «Usar aquí» para editarlas en esta pestaña.';
  /** 409 según el motivo del modo de solo lectura (POST /_biblioteca/modo {solo_lectura, motivo}). */
  const MSG_MOTIVO = Object.freeze({
    otra_pestana: MSG_SOLO_LECTURA,
    relevo: 'Sus bibliotecas están pasando a otra pestaña de 2REP_Standalone, que ha pulsado «Usar aquí»: en esta ya no se pueden cambiar.',
    copia_danada: 'La copia de sus bibliotecas guardada en este navegador está dañada. Hasta que decida en «Mis bibliotecas» si la descarga o la descarta, no se pueden cambiar.',
  });
  const CAB_VERSION = 'x-r2-biblioteca';
  const CAB_EXPORTADAS = 'x-r2-exportadas';
  const FORMATOS_EXPORT = ['csv', 'json', 'markdown', 'citations', 'bundle'];

  const E = { sqlite3: null, lib: null, soloLectura: false, motivo: null };

  const tiene = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const get = (o, k) => (tiene(o, k) ? o[k] : undefined);
  const nada = (v) => v === undefined || v === null;
  const verdad = L.verdad;
  /** Python: `v or defecto`. */
  const o = (v, defecto) => (verdad(v) ? v : defecto);
  /** `v in (None, "", 0)` de Python (False == 0). */
  const vacio = (v) => nada(v) || v === '' || v === 0 || v === false || v === 0n;

  function biblioteca(ctx) {
    if (ctx && ctx.sqlite3) E.sqlite3 = ctx.sqlite3;
    if (!E.lib) {
      if (!E.sqlite3) throw new Error('rutas_biblioteca: falta sqlite3 en el contexto');
      E.lib = L.abrir(E.sqlite3);
      L.establecer(E.lib);
    }
    return E.lib;
  }

  // ------------------------------------------------------------------------------------------------ parámetros (pydantic)
  const MSG_INT = 'Input should be a valid integer, unable to parse string as an integer';
  const MSG_TAMANO = 'Unable to parse input string as an integer, exceeded maximum size';
  const LIMITE_DIGITOS = 4300;
  // White_Space de Unicode (str::trim de Rust, el que usa pydantic-core): sin U+FEFF, U+180E, U+200B ni U+001C–U+001F, que
  // \s de JavaScript o str.isspace de Python sí incluyen en parte. Con \s, «﻿1» valía 1 y un DELETE fabricado borraba.
  const ESPACIO = '\\t\\n\\v\\f\\r \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
  const RE_BORDES = new RegExp(`^[${ESPACIO}]+|[${ESPACIO}]+$`, 'g');
  const NUMERO = '[1-9][0-9]*(?:_[0-9]+)*';
  const RE_SIN_CERO = new RegExp(`^(${NUMERO})(?:\\.0+)?$`);
  const RE_TRAS_MENOS = new RegExp(`^_?(0|${NUMERO})(?:\\.0+)?$`);

  /**
   * int de pydantic 2.11 (pydantic-core 2.33, modo laxo) desde el texto de la ruta o de la consulta: {valor} o {error}.
   * Reglas medidas contra TypeAdapter(int).validate_python (parity/oracle/dump_units_pydantic.py, suite 3: todos los textos de
   * hasta 5 caracteres sobre «01-+_. », fijos, largos y aleatorios):
   *   1. si el texto EMPIEZA por un signo menos opcional y una racha de cifras sin cero inicial de más de 4300 caracteres:
   *      «exceeded maximum size» (se decide antes de recortar espacios: «+», un cero o un espacio delante van al caso general);
   *   2. sin White_Space en los bordes y con un signo opcional;
   *   3. sin cero inicial: cifras ASCII con «_» sueltos entre cifras y, como mucho, «.» y uno o más ceros («1_0.00» sí; «1.»,
   *      «1.5», «1_.0» y «1.0_0» no);
   *   4. con cero inicial, pydantic quita el bloque de ceros y «_» del principio y mira lo que queda: nada (0, si el bloque no
   *      acaba en «_»), un número como en 3 («0_1», «01_0»), «.» y ceros («00.0») o, si el signo no era «-», un «-» seguido
   *      de un «_» opcional y 0 o un número sin cero inicial («0-1», «+0-1», «0_-_1» valen -1; «-0-1» y «0-01» no);
   *   5. el «-» y las cifras (sin ceros a la izquierda ni «_») no pueden pasar de 4300 caracteres: si pasan, error genérico.
   * Nunca «got a number with a fractional part»: ese mensaje es de los números JSON, no de los textos.
   */
  function enteroPydantic(s) {
    const t = String(s);
    const racha = /^-?[1-9][0-9]*/.exec(t);
    if (racha && racha[0].length > LIMITE_DIGITOS) return { error: MSG_TAMANO };
    let x = t.replace(RE_BORDES, '');
    let signo = '';
    if (x[0] === '+' || x[0] === '-') { signo = x[0]; x = x.slice(1); }
    let cifras = null;
    if (x[0] === '0') {
      const bloque = /^0[0_]*/.exec(x)[0];
      const resto = x.slice(bloque.length);
      const acabaEnGuion = bloque.endsWith('_');
      if (resto === '') {
        if (!acabaEnGuion) cifras = '0';
      } else if (resto[0] === '-') {
        const m = signo === '-' ? null : RE_TRAS_MENOS.exec(resto.slice(1));
        if (m) { signo = '-'; cifras = m[1]; }
      } else if (resto[0] === '.') {
        if (!acabaEnGuion && /^\.0+$/.test(resto)) cifras = '0';
      } else {
        const m = RE_SIN_CERO.exec(resto);
        if (m) cifras = m[1];
      }
    } else {
      const m = RE_SIN_CERO.exec(x);
      if (m) cifras = m[1];
    }
    if (cifras === null) return { error: MSG_INT };
    cifras = cifras.replace(/_/g, '');
    if ((signo === '-' ? 1 : 0) + cifras.length > LIMITE_DIGITOS) return { error: MSG_INT };
    let n = BigInt(cifras);
    if (signo === '-') n = -n;
    return { valor: n >= BigInt(Number.MIN_SAFE_INTEGER) && n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n };
  }

  /**
   * Parámetros tipados de la ruta y de la consulta, como RequestValidationError: se juntan todos los errores en orden
   * («Parametros no validos. cid: …; limit: …»). defs = [[origen 'ruta' | 'consulta', nombre, {defecto, ge, le}]].
   */
  function parametros(pet, defs) {
    const out = {}, errores = [];
    for (const [origen, nombre, reglas = {}] of defs) {
      const bruto = origen === 'ruta' ? get(pet.params, nombre) : get(pet.query, nombre);
      if (nada(bruto)) { out[nombre] = reglas.defecto; continue; }
      const r = enteroPydantic(bruto);
      if (r.error) { errores.push(`${nombre}: ${r.error}`); continue; }
      if (reglas.ge !== undefined && r.valor < reglas.ge) { errores.push(`${nombre}: Input should be greater than or equal to ${reglas.ge}`); continue; }
      if (reglas.le !== undefined && r.valor > reglas.le) { errores.push(`${nombre}: Input should be less than or equal to ${reglas.le}`); continue; }
      out[nombre] = r.valor;
    }
    if (errores.length) throw new ErrorHttp(422, `Parametros no validos. ${errores.join('; ')}`);
    return out;
  }

  /** server._tags. */
  function tagsDe(v) {
    if (nada(v)) return null;
    if (!Array.isArray(v) || !v.every((t) => typeof t === 'string')) throw RT.noValido('tags debe ser una lista de textos.');
    return v;
  }

  function sinBiblioteca(lib, cid) {
    const existio = lib.collection_existio(cid);
    return `No existe la biblioteca ${C.pyStr(cid)}` + (existio ? ' (se ha borrado).' : existio === false ? '.' : ' (quizá se ha borrado).');
  }

  function nombreCorpus(ctx) {
    const n = ctx && ctx.corpus && ctx.corpus.nombre;
    if (typeof n !== 'string') throw new Error('rutas_biblioteca: falta el nombre del corpus en el contexto');
    return n;
  }

  /** fuente.cargar(corpus): la fuente declarada del corpus del contexto (el país del corpus, R2.info.fuenteDeclarada). */
  function fuenteCorpus(ctx) {
    if (!R2.fuente) return null;
    const nombre = ctx && ctx.corpus && ctx.corpus.nombre;
    if (R2.info && typeof R2.info.fuenteDeclarada === 'function') return R2.info.fuenteDeclarada(nombre);
    const d = R2.datos && R2.datos.fuente;
    if (!d || typeof d !== 'object') return null;
    return R2.fuente.desde_manifest(Object.prototype.hasOwnProperty.call(d, 'fuente') ? d : { fuente: d });
  }

  // ------------------------------------------------------------------------------------------------ búsqueda y sesiones
  async function listaBusqueda(b, ctx) {
    const S = R2.search;
    const fn = S && (S.listaBusqueda || S.lista_busqueda);
    if (typeof fn !== 'function') throw new ErrorHttp(501, RT.MSG_PROXIMA);
    return fn(b, ctx);
  }

  /** El SessionIndex del corpus (principal.js lo expone en ctx.nucleo.sesiones()). */
  function indiceSesiones(ctx) {
    const n = ctx && ctx.nucleo;
    return n && typeof n.sesiones === 'function' ? n.sesiones() : null;
  }

  /** search._fecha_larga y search._lista_y (engine/sessions.js). */
  const fechaLarga = (iso) => R2.sessions.fechaLarga(iso);
  const listaY = (partes) => R2.sessions.listaY(partes);

  /** Corpus._session_warning. */
  function avisoSesion(sesiones, fecha, numSession, meta, otras) {
    if (!otras.length) return null;
    const own = meta || {};
    const detalle = otras.map((n) => {
      const x = (sesiones && sesiones.by_key(fecha, n)) || {};
      const doble = o(get(x, 'double_sitting'), {});
      return { num_session: n, session_id: nada(get(x, 'session_id')) ? null : x.session_id,
        date_real: nada(get(x, 'date_real')) ? null : x.date_real, date_corrected: verdad(get(x, 'date_corrected')),
        franja: nada(get(doble, 'franja')) ? null : doble.franja };
    });
    const lista = listaY(detalle.map((x) => `núm. ${C.pyStr(x.num_session)}`));
    const la = detalle.length === 1 ? 'la sesión' : 'las sesiones';
    const ns = C.pyStr(numSession);
    let tipo, dudosa, titulo, mensaje;
    if (verdad(get(own, 'has_meta')) && verdad(get(own, 'date_corrected'))) {
      [tipo, dudosa, titulo] = ['date_error', false, 'Fecha errónea en el corpus de origen'];
      mensaje = `El corpus de origen fecha esta sesión (núm. ${ns}) el ${fechaLarga(fecha)}, pero se celebró el ${fechaLarga(get(own, 'date_real'))}. `
        + `Por ese error comparte fecha con ${la} ${lista}. El número de sesión es correcto.`;
    } else if (verdad(get(own, 'has_meta')) && verdad(get(own, 'double_sitting')) && detalle.every((x) => verdad(x.franja))) {
      [tipo, dudosa, titulo] = ['double_sitting', false, 'Doble sesión real'];
      const franja = get(own.double_sitting, 'franja');
      const otrasTxt = listaY(detalle.map((x) => `la núm. ${C.pyStr(x.num_session)} fue la de la ${C.pyStr(x.franja)}`));
      mensaje = `El ${fechaLarga(fecha)} hubo más de una sesión: esta (núm. ${ns}) fue la de la ${C.pyStr(nada(franja) ? null : franja)} y ${otrasTxt}. El número de sesión es correcto.`;
    } else if (verdad(get(own, 'has_meta')) && detalle.every((x) => x.date_corrected)) {
      [tipo, dudosa, titulo] = ['other_date_error', false, 'Otra sesión mal fechada en esta fecha'];
      const fechas = listaY(detalle.map((x) => `la núm. ${C.pyStr(x.num_session)} se celebró el ${fechaLarga(x.date_real)}`));
      mensaje = `En el corpus de origen esta fecha aparece también con ${la} ${lista}, mal fechada: ${fechas}. El número y la fecha de esta sesión son correctos.`;
    } else {
      [tipo, dudosa, titulo] = ['unverified', true, 'Número de sesión dudoso'];
      mensaje = 'En el corpus de origen esta fecha aparece con más de un número de sesión. Verifique el número antes de citarlo.';
    }
    return { num_session: numSession, otros: otras, tipo, dudosa, titulo, mensaje, detalle };
  }

  /**
   * speech(sid, context=0, full=False) sin context ni speech, como lo deja /collections/{cid}/items, con note, tags,
   * added_at y snippet. `memo` guarda por sesión el resumen y las otras sesiones de la fecha (mismos resultados, menos SQL).
   */
  function filaLigera(ctx, sid, meta, memo) {
    const bd = { db: ctx.db, sqlite3: ctx.sqlite3 };
    const r = L.consultar(ctx.sqlite3, ctx.db, 'SELECT * FROM speeches WHERE id = ?', [sid])[0];
    if (!r) return null;
    const d = { id: r.id, id_int: r.id_int, date: r.date, num_session: r.num_session, session_number: r.session_number, ord: r.ord,
      legislature: r.legislature, legislative_session: r.legislative_session, session_type: r.session_type, speaker: r.speaker,
      rep_id: r.rep_id, id_dep: r.id_dep, rep_name: r.rep_name, sex: r.sex, district: r.district, party: r.party,
      dm_speech: r.dm_speech, nwords: r.nwords };
    const clave = `${C.pyStr(r.date)} ${C.pyStr(r.num_session)}`;
    let m = memo.get(clave);
    if (!m) {
      const s = L.consultar(bd.sqlite3, bd.db, `
            SELECT COUNT(*) AS n, SUM(nwords) AS w, MIN(ord) AS a, MAX(ord) AS b
            FROM speeches WHERE date = ? AND COALESCE(num_session,-1) = COALESCE(?,-1)`, [r.date, r.num_session])[0];
      const otras = L.consultar(bd.sqlite3, bd.db, 'SELECT DISTINCT num_session FROM speeches '
        + 'WHERE date = ? AND num_session IS NOT NULL AND num_session <> ? ORDER BY num_session',
      [r.date, nada(r.num_session) ? -1 : r.num_session]).map((x) => x.num_session);
      m = { session: { n_speeches: s.n, n_words: s.w, ord_min: s.a, ord_max: s.b }, otras };
      memo.set(clave, m);
    }
    d.session = Object.assign({}, m.session);
    if (m.otras.length) {
      const sesiones = indiceSesiones(ctx);
      if (!sesiones) throw new Error('rutas_biblioteca: falta el índice de sesiones (R2.sessions) para session_warning');
      const sw = avisoSesion(sesiones, r.date, r.num_session, sesiones.for_speech(r.id, bd), m.otras);
      if (sw) d.session_warning = sw;
    }
    const mt = meta || {};
    d.note = tiene(mt, 'note') ? mt.note : '';
    d.tags = tiene(mt, 'tags') ? mt.tags : [];
    d.added_at = tiene(mt, 'added_at') ? mt.added_at : null;
    d.snippet = L.cortar(r.speech || '', 340).replace(/\n/g, ' ');
    return d;
  }

  function compararIds(a, b) {
    const x = BigInt(a), y = BigInt(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }

  // ------------------------------------------------------------------------------------------------ manejadores
  /** Envoltorio: biblioteca, solo lectura, cabecera de versión y OverflowError → 422. */
  function ruta(fn, opciones = {}) {
    return async (pet, ctx) => {
      const lib = biblioteca(ctx);
      if (opciones.muta && E.soloLectura) throw new ErrorHttp(409, MSG_MOTIVO[E.motivo] || MSG_SOLO_LECTURA);
      const v0 = lib.version;
      try {
        let r = await fn(pet, ctx, lib);
        if (E.lib === lib && lib.version !== v0) {
          if (!(r instanceof RT.Respuesta)) r = new RT.Respuesta(r);
          r.cabeceras = Object.assign({}, r.cabeceras, { [CAB_VERSION]: String(lib.version) });
        }
        return r;
      } catch (e) {
        if (e && e.name === 'OverflowError') throw new ErrorHttp(422, MSG_OVERFLOW);
        throw e;
      }
    };
  }

  const CID = [['ruta', 'cid']];

  const RUTAS = [
    ['GET', '/collections', ruta((pet, ctx, lib) => ({ collections: lib.list_collections(ctx.corpus ? ctx.corpus.nombre : null) }))],

    ['POST', '/collections', ruta((pet, ctx, lib) => {
      const b = V.cuerpo(pet.cuerpo);
      return lib.create_collection(V.texto(b, 'name'), V.texto(b, 'description'), V.texto(b, 'color', 'indigo') || 'indigo');
    }, { muta: true })],

    ['PATCH', '/collections/{cid}', ruta((pet, ctx, lib) => {
      const { cid } = parametros(pet, CID);
      const b = V.cuerpo(pet.cuerpo);
      const campos = {};
      for (const k of ['name', 'description', 'color']) if (tiene(b, k)) campos[k] = V.texto(b, k);
      const out = lib.update_collection(cid, campos);
      if (out === null) throw new ErrorHttp(404, 'No existe esa biblioteca.');
      return out;
    }, { muta: true })],

    ['DELETE', '/collections/{cid}', ruta((pet, ctx, lib) => {
      const { cid } = parametros(pet, CID);
      const out = lib.delete_collection(cid);
      if (out === null) throw new ErrorHttp(404, 'No existe esa biblioteca (quizá ya se borró).');
      return Object.assign({ ok: true }, out);
    }, { muta: true })],

    ['GET', '/collections/{cid}/items', ruta((pet, ctx, lib) => {
      const { cid, limit, offset } = parametros(pet, [['ruta', 'cid'], ['consulta', 'limit', { defecto: 500, ge: 1, le: 5000 }],
        ['consulta', 'offset', { defecto: 0, ge: 0 }]]);
      const nombre = nombreCorpus(ctx);
      if (lib.get_collection(cid) === null) throw new ErrorHttp(404, 'No existe esa biblioteca.');
      const ids = lib.item_ids(cid, nombre);
      const huella = R2.py.sha1.hex(ids.slice().sort(compararIds).map((x) => C.pyStr(x)).join(',')).slice(0, 16);
      const metas = lib.items_meta(cid, nombre);
      const desde = Number(offset);
      const pagina = desde >= ids.length ? [] : ids.slice(desde, desde + Number(limit));
      const memo = new Map();
      const filas = [];
      for (const sid of pagina) {
        const d = filaLigera(ctx, sid, metas.get(sid), memo);
        if (d) filas.push(d);
      }
      return { collection: lib.get_collection(cid), total: ids.length, items: filas, offset, limit, ids_hash: huella };
    })],

    ['POST', '/collections/{cid}/items', ruta(async (pet, ctx, lib) => {
      const { cid } = parametros(pet, CID);
      const b = V.cuerpo(pet.cuerpo);
      const nombre = nombreCorpus(ctx);
      if (lib.get_collection(cid) === null) throw new ErrorHttp(404, sinBiblioteca(lib, cid));
      const todos = verdad(get(b, 'add_all_results'));
      let lista = null, ids;
      if (todos) {
        lista = await listaBusqueda(b, ctx);
        ids = lista.ids;
        if (!ids.length) throw new ErrorHttp(400, 'La búsqueda actual no lista ninguna intervención.');
        // La búsqueda cedió el hilo: la biblioteca de destino tiene que seguir existiendo.
        if (lib.get_collection(cid) === null) throw new ErrorHttp(404, sinBiblioteca(lib, cid));
      } else {
        ids = V.ids(o(get(b, 'speech_ids'), []), 'speech_ids');
      }
      if (!ids.length) throw new ErrorHttp(400, 'No se indicaron intervenciones.');
      let span = null;
      if (!nada(get(b, 'char_start')) && !nada(get(b, 'char_end'))) {
        span = [V.entero(b.char_start, 'char_start', 0), V.entero(b.char_end, 'char_end', 0)];
      }
      let out;
      try {
        out = lib.add_items(cid, nombre, ids, V.texto(b, 'note'), tagsDe(get(b, 'tags')), span);
      } catch (e) {
        if (e && e.name === 'KeyError') throw new ErrorHttp(404, sinBiblioteca(lib, cid));
        throw e;
      }
      out.guardadas = out.added;
      out.ya_estaban = out.skipped;
      if (todos) {
        out.speech_ids = ids.slice();
        out.tomadas = ids.length;
        out.total_lista = lista.total_lista;
        out.recorte = nada(lista.recorte) ? null : lista.recorte;
        out.tope_modo = nada(lista.tope_modo) ? null : lista.tope_modo;
      }
      return out;
    }, { muta: true })],

    ['POST', '/collections/{cid}/items/remove', ruta((pet, ctx, lib) => {
      const { cid } = parametros(pet, CID);
      const b = V.cuerpo(pet.cuerpo);
      const ids = V.ids(o(get(b, 'speech_ids'), []), 'speech_ids');
      if (!ids.length) throw new ErrorHttp(400, 'No se indicaron intervenciones.');
      if (lib.get_collection(cid) === null) throw new ErrorHttp(404, 'No existe esa biblioteca.');
      return lib.remove_items(cid, ids, nombreCorpus(ctx));
    }, { muta: true })],

    ['PATCH', '/collections/{cid}/items/{sid}', ruta((pet, ctx, lib) => {
      const { cid, sid } = parametros(pet, [['ruta', 'cid'], ['ruta', 'sid']]);
      const b = V.cuerpo(pet.cuerpo);
      const nota = !nada(get(b, 'note')) ? V.texto(b, 'note') : null;
      const ok = lib.update_item(cid, nombreCorpus(ctx), sid, nota, tagsDe(get(b, 'tags')));
      if (!ok) throw new ErrorHttp(404, 'La intervencion no esta en esa biblioteca.');
      return { ok: true };
    }, { muta: true })],

    ['GET', '/searches', ruta((pet, ctx, lib) => ({ searches: lib.list_searches() }))],

    ['POST', '/searches', ruta((pet, ctx, lib) => {
      const b = V.cuerpo(pet.cuerpo);
      const filtros = o(get(b, 'filters'), {});
      if (!RT.esDict(filtros)) throw RT.noValido('filters debe ser un objeto JSON.');
      return lib.save_search(V.texto(b, 'name'), nombreCorpus(ctx), V.texto(b, 'mode') || 'hybrid', V.texto(b, 'query'),
        filtros, verdad(get(b, 'variants')));
    }, { muta: true })],

    ['DELETE', '/searches/{sid}', ruta((pet, ctx, lib) => {
      const { sid } = parametros(pet, [['ruta', 'sid']]);
      if (!lib.delete_search(sid)) throw new ErrorHttp(404, 'No existe esa busqueda guardada.');
      return { ok: true };
    }, { muta: true })],

    ['POST', '/import', ruta((pet, ctx, lib) => {
      const b = V.cuerpo(pet.cuerpo);
      const payload = o(get(b, 'payload'), {});
      if (!RT.esDict(payload)) throw RT.noValido('payload debe ser el objeto JSON de un archivo .2replib.');
      try {
        if (get(payload, 'format') === P.FORMATO_COPIA) return P.importarCopia(lib, payload, nombreCorpus(ctx));
        return P.importarBiblioteca(lib, payload, nombreCorpus(ctx));
      } catch (e) {
        // UnicodeEncodeError (un sustituto suelto al guardar una nota) es subclase de ValueError en Python: el escritorio
        // también responde 400 con su texto.
        if (e && L.esValueError(e)) throw new ErrorHttp(400, e.message);
        if (e && e.name === 'KeyError') {
          throw new ErrorHttp(409, 'La biblioteca que se estaba importando se borró antes de terminar. Vuelva a importar el archivo.');
        }
        throw e;
      }
    }, { muta: true })],

    ['POST', '/export', ruta(async (pet, ctx, lib) => {
      const b = V.cuerpo(pet.cuerpo);
      const fmt = C.lower(V.texto(b, 'format') || 'csv');
      if (!FORMATOS_EXPORT.includes(fmt)) throw new ErrorHttp(400, `Formato no soportado: ${fmt}`);
      if (fmt !== 'bundle') throw new ErrorHttp(501, RT.MSG_PROXIMA); // CSV, JSON, Markdown y Referencias: M6
      const nombre = nombreCorpus(ctx);
      const cid0 = get(b, 'collection_id');
      const cid = vacio(cid0) ? null : V.entero(cid0, 'collection_id', 1);
      if (!cid) {
        await listaBusqueda(b, ctx); // _seleccion_export valida la búsqueda antes del 400
        throw new ErrorHttp(400, 'El formato .2replib requiere una biblioteca.');
      }
      const col = lib.get_collection(cid);
      if (col === null) throw new ErrorHttp(404, 'No existe esa biblioteca.');
      const cap = V.cap(b, ctx.corpus && ctx.corpus.n_speeches);
      const todos = lib.item_ids(cid, nombre);
      const ids = cap === null ? todos : todos.slice(0, Number(cap));
      const recorte = ids.length < todos.length ? { motivo: 'cap', tomadas: ids.length, de: todos.length } : null;
      const metas = lib.items_meta(cid, nombre);
      const stem = P.slug(nada(col.name) ? 'Biblioteca' : C.pyStr(col.name)) || 'seleccion';
      let f = fuenteCorpus(ctx);
      if (f === null) f = R2.fuente.desde_metadatos(col.fuente);
      const filas = P.leerFilas(ctx.sqlite3, ctx.db, ids).map((d) => {
        const m = metas.get(d.id) || {};
        d.note = tiene(m, 'note') ? m.note : '';
        d.tags = tiene(m, 'tags') ? m.tags : [];
        return d;
      });
      const datos = P.exportarBiblioteca(lib, cid, nombre, filas, f);
      const cab = {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="${stem}.2replib"`,
        'x-export-filas': String(filas.length),
        'x-export-total-lista': String(todos.length),
      };
      if (recorte) Object.assign(cab, { 'x-export-recorte-motivo': recorte.motivo, 'x-export-recorte-de': String(recorte.de) });
      return new RT.Respuesta(datos, { tipo: 'bytes', cabeceras: cab });
    }), { prioridad: 'fondo' }],

    ['POST', '/collections/export-all', ruta((pet, ctx, lib) => {
      V.cuerpo(pet.cuerpo);
      const datos = P.exportarTodas(lib, nombreCorpus(ctx), fuenteCorpus(ctx));
      const r = lib.resumen();
      return new RT.Respuesta(datos, { tipo: 'bytes', cabeceras: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="${P.nombreCopia()}"`,
        'x-export-bibliotecas': String(r.colecciones),
        'x-export-filas': String(r.items),
        [CAB_EXPORTADAS]: '1',
      } });
    }), { prioridad: 'fondo' }],

    // -------------------------------------------------------------------------------------------- internas
    ['GET', '/_biblioteca/volcado', ruta((pet, ctx, lib) => new RT.Respuesta(lib.exportarBytes(), {
      tipo: 'bytes', cabeceras: { 'content-type': 'application/vnd.sqlite3', [CAB_VERSION]: String(lib.version) } })), { corpus: false }],

    ['POST', '/_biblioteca/restaurar', async (pet, ctx) => {
      if (ctx && ctx.sqlite3) E.sqlite3 = ctx.sqlite3;
      if (!E.sqlite3) throw new Error('rutas_biblioteca: falta sqlite3 en el contexto');
      const b = pet.cuerpo === null || pet.cuerpo === undefined ? {} : V.cuerpo(pet.cuerpo);
      let bytes = get(b, 'bytes');
      if (nada(bytes) && typeof get(b, 'bytes_base64') === 'string') {
        const bin = atob(b.bytes_base64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
      if (!nada(bytes) && !(bytes instanceof Uint8Array)) {
        if (bytes instanceof ArrayBuffer || ArrayBuffer.isView(bytes)) bytes = new Uint8Array(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength);
        else throw RT.noValido('bytes debe ser la base serializada (Uint8Array) o null.');
      }
      let nueva;
      try {
        nueva = L.abrir(E.sqlite3, { bytes: nada(bytes) ? null : bytes });
      } catch (e) {
        throw new ErrorHttp(422, `No se pudo abrir la copia de las bibliotecas: ${e && e.message ? e.message : e}`);
      }
      if (E.lib) E.lib.cerrar();
      E.lib = nueva;
      L.establecer(nueva);
      return { ok: true, solo_lectura: E.soloLectura, resumen: nueva.resumen() };
    }, { corpus: false }],

    ['POST', '/_biblioteca/modo', async (pet) => {
      const b = V.cuerpo(pet.cuerpo);
      E.soloLectura = verdad(get(b, 'solo_lectura'));
      const motivo = get(b, 'motivo');
      E.motivo = E.soloLectura ? (Object.prototype.hasOwnProperty.call(MSG_MOTIVO, motivo) ? motivo : 'otra_pestana') : null;
      return { ok: true, solo_lectura: E.soloLectura, motivo: E.motivo };
    }, { corpus: false }],

    ['GET', '/_biblioteca/estado', ruta((pet, ctx, lib) => ({ version: lib.version, solo_lectura: E.soloLectura, motivo: E.motivo, resumen: lib.resumen() })), { corpus: false }],
  ];

  for (const [metodo, patron, manejador, opciones] of RUTAS) RT.registrar(metodo, patron, manejador, opciones || {});

  RT.servicios.biblioteca = {
    get_collection: (cid) => (E.lib ? E.lib.get_collection(cid) : null),
    collection_existio: (cid) => (E.lib ? E.lib.collection_existio(cid) : null),
    item_ids: (cid, corpus) => (E.lib ? E.lib.item_ids(cid, corpus) : []),
    membership: (corpus, ids) => L.membershipObjeto(corpus, ids),
  };

  R2.rutasBiblioteca = {
    RUTAS: RUTAS.map(([m, p]) => [m, p]), MSG_OVERFLOW, MSG_SOLO_LECTURA, MSG_MOTIVO, MSG_INT, MSG_TAMANO, CAB_VERSION, CAB_EXPORTADAS,
    enteroPydantic, avisoSesion, fechaLarga, listaY, filaLigera,
    /** Estado del worker (pruebas): { lib, soloLectura, motivo }. */
    estado: () => ({ lib: E.lib, soloLectura: E.soloLectura, motivo: E.motivo }),
    /** Vuelve al estado inicial (pruebas): sin biblioteca y con escritura. */
    reiniciar() { if (E.lib) E.lib.cerrar(); E.lib = null; E.soloLectura = false; E.motivo = null; L.establecer(null); },
  };
})(globalThis.R2 = globalThis.R2 || {});

/* ===== src/engine/exports.js ===== */
/* 2REP_Standalone · engine/exports.js
 *
 * Exportaciones de búsquedas y bibliotecas (M6): port de app/backend/library.py (export_csv, export_json, export_markdown,
 * export_citations, bytes_fuente_por_fila, fuente_importada, _linea_importada, _cit_sufijo, _json_fuente_fila) y de las
 * piezas de lectura de search.py (filas_export, medida_export, _sesiones_de_fecha) y de estimación de server.py
 * (_bytes_notas). Mismos bytes que el escritorio: CSV con BOM, «;», QUOTE_ALL, CRLF y 4 líneas «# » de la fuente; JSON
 * indent 2 con meta.fuente; Markdown con front matter y sección «Fuente»; Referencias con BibTeX y RIS. El .2replib sigue en
 * engine/paquetes.js. Las rutas están en engine/rutas_export.js.
 *
 * API (R2.exports); ctx = contexto del enrutador ({db, sqlite3, nucleo.sesiones(), ceder})
 *   async filasExport(ctx, ids, incluirTexto) → [fila]        Corpus.filas_export (orden de ids, repetidos, session_warning)
 *   medidaExport(ctx, ids) → {filas, palabras, bytes_texto, filas_aviso}
 *   exportCsv(filas, incluirTexto, f, fImp) → Blob             exportJson(filas, meta, f, fImp) → Blob
 *   exportMarkdown(filas, meta, f, fImp) → Blob                exportCitations(filas, meta, f, fImp) → Blob
 *   bytesFuentePorFila(fmt, f) · bytesNotas(grupos) · fuenteImportada(col, f)
 */
(function (R2) {
  'use strict';

  const C = R2.py && R2.py.core;
  const J = R2.py && R2.py.json;
  const F = R2.fuente;
  const S = R2.sql;
  const L = R2.library;
  if (!C || !J || !F || !S || !L) throw new Error('engine/exports.js necesita R2.py.core, R2.py.json, R2.fuente, R2.sql y R2.library (src/orden.json)');

  const KS = R2.gen.constantes.server;
  const KL = R2.gen.constantes.library;
  const FORMATOS_EXPORT = KS.FORMATOS_EXPORT.slice();
  const EXPORT_COLUMNS = KL.EXPORT_COLUMNS.slice();
  const MD_LINEA_FUENTE = KL.MD_LINEA_FUENTE || '*Fuente: {}*';
  const CIT_TITULO_BIBTEX = KL.CIT_TITULO_BIBTEX || '# Cita del conjunto de datos (BibTeX)';
  const CIT_TITULO_RIS = KL.CIT_TITULO_RIS || '# Cita del conjunto de datos (RIS)';
  const INLINE_ID_LIMIT = 900;

  const ENC = new TextEncoder();
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
  const verdad = L.verdad;
  const tiene = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const get = (o, k, defecto) => (o instanceof Map ? (o.has(k) ? o.get(k) : defecto) : tiene(o, k) ? o[k] : defecto);
  const pares = (d) => (d instanceof Map ? [...d] : Object.entries(d || {}));
  const o = (a, b) => (verdad(a) ? a : b);
  const s = (v) => C.pyStr(v === undefined ? null : v);
  const u = (t) => ENC.encode(t).length;
  const rstripNL = (t) => t.replace(/\n+$/, '');
  /** str.split(": ", 1) de Python → [antes, después]. */
  const partir = (t) => { const i = t.indexOf(': '); return i < 0 ? [t] : [t.slice(0, i), t.slice(i + 2)]; };
  const ceder = async (ctx) => { if (ctx && typeof ctx.ceder === 'function') await ctx.ceder(); };

  // ------------------------------------------------------------------------------------------------ lectura (search.py)
  const FECHAS = new WeakMap();

  /** Corpus._sesiones_de_fecha: {fecha: [num_session no nulos, ascendentes]}. */
  function sesionesDeFecha(bd) {
    let d = FECHAS.get(bd.db);
    if (!d) {
      d = new Map();
      for (const [fecha, num] of S.tuplas(bd, 'SELECT DISTINCT date, num_session FROM speeches '
        + 'WHERE date IS NOT NULL AND num_session IS NOT NULL ORDER BY date, num_session')) {
        if (!d.has(fecha)) d.set(fecha, []);
        d.get(fecha).push(num);
      }
      FECHAS.set(bd.db, d);
    }
    return d;
  }

  const marcas = (n) => new Array(n).fill('?').join(',');

  /** Corpus.filas_export: filas en el orden de `ids`; los que no existen se omiten; un id repetido da otra fila. */
  async function filasExport(ctx, ids, incluirTexto) {
    const bd = { db: ctx.db, sqlite3: ctx.sqlite3 };
    const pedidos = ids.map((i) => Number(i));
    const unicos = [...new Set(pedidos)];
    const fechas = sesionesDeFecha(bd);
    const RB = R2.rutasBiblioteca;
    const cols = 'id, id_int, id_session, date, num_session, session_number, ord, legislature, legislative_session, session_type, '
      + 'speaker, rep_id, id_dep, rep_name, sex, district, party, dm_speech, nwords' + (incluirTexto ? ', speech' : '');
    const filas = new Map();
    const memo = new Map();
    let sesiones = null;
    for (let k = 0; k < unicos.length; k += INLINE_ID_LIMIT) {
      const lote = unicos.slice(k, k + INLINE_ID_LIMIT);
      for (const r of S.filas(bd, `SELECT ${cols} FROM speeches WHERE id IN (${marcas(lote.length)})`, lote)) {
        const d = { id: r.id, id_int: r.id_int, id_session: r.id_session, date: r.date, num_session: r.num_session,
          session_number: r.session_number, ord: r.ord, legislature: r.legislature, legislative_session: r.legislative_session,
          session_type: r.session_type, speaker: r.speaker, rep_id: r.rep_id, id_dep: r.id_dep, rep_name: r.rep_name, sex: r.sex,
          district: r.district, party: r.party, dm_speech: r.dm_speech, nwords: r.nwords };
        if (incluirTexto) d.speech = r.speech;
        const nums = r.date === null ? undefined : fechas.get(r.date);
        if (nums && nums.length) {
          const ns = r.num_session;
          const propio = ns !== null ? ns : -1;
          const otras = nums.filter((n) => n !== propio);
          if (otras.length) {
            if (!sesiones) {
              sesiones = ctx.nucleo && typeof ctx.nucleo.sesiones === 'function' ? ctx.nucleo.sesiones() : null;
              if (!sesiones) throw new Error('exports: falta el índice de sesiones (ctx.nucleo.sesiones) para session_warning');
            }
            const clave = JSON.stringify([r.date, ns, sesiones.session_id_for(r.id, bd)]);
            if (!memo.has(clave)) memo.set(clave, RB.avisoSesion(sesiones, r.date, ns, sesiones.for_speech(r.id, bd), otras));
            if (memo.get(clave)) d.session_warning = memo.get(clave);
          }
        }
        filas.set(r.id, d);
      }
      await ceder(ctx);
    }
    const out = [];
    const vistos = new Set();
    for (const i of pedidos) {
      const d = filas.get(i);
      if (d === undefined) continue;
      out.push(vistos.has(i) ? Object.assign({}, d) : d);
      vistos.add(i);
    }
    return out;
  }

  /** Corpus.medida_export: filas, palabras, bytes UTF-8 del texto y filas con aviso de sesión. */
  function medidaExport(ctx, ids) {
    const bd = { db: ctx.db, sqlite3: ctx.sqlite3 };
    const unicos = [...new Set(ids.map((i) => Number(i)))];
    const fechas = sesionesDeFecha(bd);
    let n = 0, w = 0, b = 0, av = 0;
    for (let k = 0; k < unicos.length; k += INLINE_ID_LIMIT) {
      const lote = unicos.slice(k, k + INLINE_ID_LIMIT);
      const m = marcas(lote.length);
      const [c, p, t] = S.tuplas(bd, `SELECT COUNT(*), COALESCE(SUM(nwords), 0), COALESCE(SUM(nbytes), 0) `
        + `FROM speeches WHERE id IN (${m})`, lote)[0];
      for (const [d, ns, kk] of S.tuplas(bd, `SELECT date, num_session, COUNT(*) FROM speeches WHERE id IN (${m}) `
        + 'GROUP BY date, num_session', lote)) {
        const propio = ns !== null ? ns : -1;
        if ((fechas.get(d) || []).some((x) => x !== propio)) av += Number(kk);
      }
      n += Number(c); w += Number(p); b += Number(t);
    }
    return { filas: n, palabras: w, bytes_texto: b, filas_aviso: av };
  }

  // ------------------------------------------------------------------------------------------------ fuente (library.py)
  function jsonFuenteFila(f, sangria) {
    return pares(F.columnas(f)).map(([k, v]) => `,\n${sangria}${J.dumps(k)}: ${J.dumps(v, { ensure_ascii: false })}`).join('');
  }

  /** library.fuente_importada: la fuente de una biblioteca importada si es DISTINTA de la que cita la exportación. */
  function fuenteImportada(col, f) {
    const previa = F.desde_metadatos(get(col || {}, 'fuente', null));
    return verdad(previa) && F.cita(previa) !== F.cita(f) ? previa : null;
  }

  function lineaImportada(fImp) {
    if (!verdad(fImp)) return [];
    return ['Biblioteca importada de un paquete .2replib que citaba otra fuente: ' + partir(F.lineas(fImp, '')[0])[1]];
  }

  function citSufijo(f) {
    const cc = F.cita_corta(f);
    return ` Fuente: ${cc}` + (cc.endsWith('.') ? '' : '.');
  }

  const lineaFuenteMd = (f) => MD_LINEA_FUENTE.split('{}').join(F.cita_corta(f));

  /** library.bytes_fuente_por_fila. */
  function bytesFuentePorFila(fmt, f) {
    if (fmt === 'csv') return pares(F.columnas(f)).reduce((t, [, v]) => t + 3 + u(String(v).replace(/"/g, '""')), 0);
    if (fmt === 'json' || fmt === 'bundle') return u(jsonFuenteFila(f, ' '.repeat(6)));
    if (fmt === 'markdown') return u(lineaFuenteMd(f)) + 2;
    if (fmt === 'citations') return u(citSufijo(f));
    return 0;
  }

  /** server._bytes_notas: grupos = [[nota, etiquetas, n]] de Library.notas_resumen. */
  function bytesNotas(grupos) {
    const out = {};
    for (const fmt of FORMATOS_EXPORT) out[fmt] = 0;
    if (!grupos || !grupos.length) return out;
    out.csv = ';"note";"tags"'.length;
    for (const [note, tags, n] of grupos) {
      const jt = tags.join(', ');
      const dn = J.dumps(note, { ensure_ascii: false });
      const dt = J.dumps(tags, { ensure_ascii: false, indent: 2 });
      const saltos = dt.split('\n').length - 1;
      out.csv += n * (6 + u(note.replace(/"/g, '""')) + u(jt.replace(/"/g, '""')));
      out.json += n * (32 + u(dn) + u(dt) + 6 * saltos);
      out.markdown += n * ((note ? 14 + u(note) : 0) + (jt ? 4 + u(jt) : 0));
      out.bundle += n * (u(dn) - 2 + u(dt) - 2 + 6 * saltos);
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------------ formatos
  const TROZO = 2048;

  /** Acumula cadenas y las pasa a un Blob por trozos (sin una cadena del tamaño del archivo). */
  function acumulador(inicio) {
    const partes = inicio ? [inicio] : [];
    let trozo = [];
    return {
      push(t) { trozo.push(t); if (trozo.length >= TROZO) { partes.push(trozo.join('')); trozo = []; } },
      blob(tipo) { if (trozo.length) partes.push(trozo.join('')); return new Blob(partes, { type: tipo }); },
    };
  }

  const celdaCsv = (v) => '"' + (v === null || v === undefined ? '' : typeof v === 'string' ? v : s(v)).replace(/"/g, '""') + '"';

  /** library.export_csv (delimiter «;»). */
  function exportCsv(rows, incluirTexto = true, f = null, fImp = null) {
    const fin = '\r\n';
    const acc = acumulador(BOM);
    for (const ln of F.lineas(f, '# ').concat(lineaImportada(fImp).map((x) => `# ${x}`))) acc.push(ln + fin);
    const cols = EXPORT_COLUMNS.slice();
    if (rows.some((r) => tiene(r, 'note'))) cols.push('note', 'tags');
    if (incluirTexto) cols.push('speech');
    const fc = pares(F.columnas(f));
    acc.push(cols.concat(fc.map(([k]) => k)).map(celdaCsv).join(';') + fin);
    const cola = fc.map(([, v]) => ';' + celdaCsv(v)).join('') + fin;
    const conTags = cols.includes('tags');
    for (const r of rows) {
      let linea = '';
      for (let i = 0; i < cols.length; i++) {
        const k = cols[i];
        let v = tiene(r, k) ? r[k] : '';
        if (conTags && k === 'tags' && Array.isArray(v)) v = v.join(', ');
        linea += (i ? ';' : '') + celdaCsv(v);
      }
      acc.push(linea + cola);
    }
    return acc.blob('text/csv');
  }

  /** library.export_json. */
  function exportJson(rows, meta, f = null, fImp = null) {
    const opc = { ensure_ascii: false, indent: 2 };
    const m = new Map([['fuente', F.completa(f)]]);
    if (verdad(fImp)) m.set('fuente_importada', F.completa(fImp));
    for (const [k, v] of pares(meta)) if (!m.has(k)) m.set(k, v);
    if (!rows.length) {
      return new Blob([J.dumps(new Map([['meta', m], ['n', 0], ['intervenciones', []]]), opc)], { type: 'application/json' });
    }
    const esqueleto = J.dumps(new Map([['meta', m], ['n', rows.length], ['intervenciones', [0]]]), opc);
    const i0 = esqueleto.lastIndexOf('0');
    const cola = jsonFuenteFila(f, ' '.repeat(6)) + '\n    }';
    const acc = acumulador();
    acc.push(esqueleto.slice(0, i0));
    rows.forEach((r, i) => {
      if (i) acc.push(',\n    ');
      const t = J.dumps(r, opc);
      if (t === '{}') {
        acc.push(J.dumps(F.columnas(f), opc).replace(/\n/g, '\n    '));
        return;
      }
      acc.push(t.slice(0, -2).replace(/\n/g, '\n    ') + cola);
    });
    acc.push(esqueleto.slice(i0 + 1));
    return acc.blob('application/json');
  }

  /** library.export_markdown. */
  function exportMarkdown(rows, meta, f = null, fImp = null) {
    const acc = acumulador();
    let primero = true;
    const bloque = (lineas) => { acc.push((primero ? '' : '\n') + lineas.join('\n')); primero = false; };
    const exportado = C.strftime('%Y-%m-%d %H:%M', L.reloj());
    const titulo = get(meta, 'title', 'Seleccion de intervenciones');
    const corpus = get(meta, 'corpus', '');
    const extra = new Map([['title', titulo], ['corpus', corpus], ['intervenciones', rows.length], ['exportado', exportado]]);
    if (verdad(fImp)) extra.set('fuente_importada', F.cita(fImp));
    const front = F.yaml_front_matter(f, extra);
    let out = rstripNL(front).split('\n').concat(['', `# ${s(titulo)}`, '']);
    if (verdad(get(meta, 'description'))) out.push(s(meta.description), '');
    out.push(`*${rows.length} intervenciones · corpus: ${s(corpus)} · exportado ${exportado}*`, '',
      '## Fuente', '', rstripNL(F.markdown(f)), '');
    for (const x of lineaImportada(fImp)) { const [a, b] = partir(x); out.push(`**${a}:** ${b}`); }
    if (verdad(fImp)) out.push('');
    out.push('---', '');
    bloque(out);
    const lineaFuente = lineaFuenteMd(f);
    rows.forEach((r, k) => {
      const i = k + 1;
      out = [`## ${i}. ${s(o(get(r, 'rep_name', null), get(r, 'speaker', null)))} — ${s(get(r, 'date', null))}`];
      const metaLinea = [get(r, 'party', null), get(r, 'district', null), get(r, 'session_type', null),
        `sesión ${s(o(get(r, 'session_number', null), get(r, 'num_session', null)))}`, get(r, 'legislature', null), `${s(get(r, 'nwords', null))} palabras`]
        .filter(verdad).map(s).join(' · ');
      out.push(`*${metaLinea}*`, '', `**Consta como:** ${s(get(r, 'speaker', ''))}`, '');
      if (verdad(get(r, 'note', null))) out.push(`> **Nota:** ${s(r.note)}`, '');
      if (verdad(get(r, 'tags', null))) {
        const tags = typeof r.tags === 'string' ? r.tags : r.tags.join(', ');
        if (tags) out.push(`\`${tags}\``, '');
      }
      if (verdad(get(r, 'speech', null))) out.push(C.strip(r.speech), '');
      out.push(lineaFuente, '');
      out.push(`<!-- id=${s(get(r, 'id', null))} -->`, '', '---', '');
      bloque(out);
    });
    const pie = ['## Cómo citar', ''];
    for (const ln of F.lineas(f, '')) pie.push(ln, '');
    bloque(pie);
    return acc.blob('text/markdown');
  }

  /** library.export_citations. */
  function exportCitations(rows, meta, f = null, fImp = null) {
    const out = [`# Referencias · ${F._una_linea(get(meta, 'title', ''))}`];
    out.push(...F.lineas(f, '# '), ...lineaImportada(fImp).map((x) => `# ${x}`));
    out.push('# Cada referencia termina con la cita breve del conjunto de datos de origen.', '');
    const sufijo = citSufijo(f);
    const corpus = s(get(meta, 'corpus', null));
    for (const r of rows) {
      out.push(`${s(o(get(r, 'rep_name', null), get(r, 'speaker', null)))}. Intervención en la sesión `
        + `núm. ${s(o(get(r, 'session_number', null), get(r, 'num_session', null)))} de ${s(get(r, 'date', null))}`
        + `${verdad(get(r, 'session_type', null)) ? ` (${s(r.session_type)})` : ''}. `
        + `Diario de sesiones, legislatura ${s(get(r, 'legislature', null))}. `
        + `[${s(o(get(r, 'party', null), 's/p'))}]. Ref. interna: ${corpus}#${s(o(get(r, 'id_int', null), get(r, 'id', null)))}.`
        + sufijo);
    }
    out.push('', CIT_TITULO_BIBTEX, rstripNL(F.bibtex(f)), '', CIT_TITULO_RIS, rstripNL(F.ris(f)));
    return new Blob([out.join('\n') + '\n'], { type: 'text/plain' });
  }

  R2.exports = Object.freeze({
    FORMATOS_EXPORT, EXPORT_COLUMNS, INLINE_ID_LIMIT,
    sesionesDeFecha, filasExport, medidaExport,
    jsonFuenteFila, fuenteImportada, lineaImportada, citSufijo, bytesFuentePorFila, bytesNotas,
    exportCsv, exportJson, exportMarkdown, exportCitations,
  });
})(globalThis.R2 = globalThis.R2 || {});

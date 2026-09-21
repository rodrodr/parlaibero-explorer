


'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PAGE = 50;

const S = {
  info: null, facets: null, collections: [], corpora: [],
  mode:   'keyword' , query: '', variants: false, order: 'relevance',




  filters: {}, results: [], total: 0, offset: 0, ms: 0,
  membership: {}, selected: null, view: 'search',
  loading: false, exhausted: false, lastMeta: null,
  libSel: null, similarOf: null, seq: 0,


  searchStale: false,


  cursor: null, current: null, readMode: 'speech', readSeq: 0,
  speechScroll: null, session: null,
  // Teñido por tema en el lector: encendido y forma de la marca. Solo se usa en
  // standalone (los temas son de Coocurrencias) y se recuerda en este navegador.
  readTema: readTemaGuardado(), readTemaMarca: readTemaMarcaGuardada(),


  libTab: 'items', libSeq: 0, libInfo: null,

  lex: { cache: new Map(), data: null, cid: null, seq: 0, ctrl: null, showAll: false, solo: lexSoloGuardado() },
  coo: { cache: new Map(), data: null, cid: null, seq: 0, ctrl: null, unidad: 'intervencion', vocabulario: 250, vecinos: 10,
         resolucion: 1, expresiones: true, excl: { cid: null, aplicados: new Set(), marcados: new Set() }, lectModo: 'variada', lectN: 10, orden: 'g2' },
  careo: null,
};


const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));


const agrupa = s => String(s).replace(/^(-?\d)(\d{3})(?=,|$)/, '$1.$2');
const nf = n => agrupa((n ?? 0).toLocaleString('es-ES'));


const listScroller = () => $('#listScroll') || $('#hits');

function fechaLarga(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

function toast(msg, err = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  const box = $('#toasts');


  if (box.showPopover) {
    try { if (box.matches(':popover-open')) box.hidePopover(); box.showPopover(); } catch {   }
  }
  box.append(el);
  setTimeout(() => el.remove(), err ? 5200 : 2700);
}

async function api(path, opts = {}) {
  const r = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) {
    let d = {};
    try { d = await r.json(); } catch {   }
    const err = new Error(d.error || `Error ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}



function foldMap(raw) {
  let folded = ''; const map = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (let k = 0; k < c.length; k++) { folded += c[k]; map.push(i); }
  }
  return { folded, map };
}



const VACIAS = new Set(`a al algo alguna algunas alguno algunos ante antes aquel
aquella aquellas aquello aquellos aqui asi aun aunque cada como con contra cual
cuales cuando cuanto de del desde donde dos e el ella ellas ello ellos en entre
era eran es esa esas ese eso esos esta estaba estan estar estas este esto estos
fue fuera fueron ha habia han hasta hay la las le les lo los mas me mi mis mucho
muchos muy nada ni no nos nuestra nuestro o otra otras otro otros para pero poco
por porque pues que quien quienes se ser si sin sobre solo son su sus tal tambien
tan tanto te tiene tienen toda todas todo todos tras un una unas uno unos y ya yo`
  .split(/\s+/).filter(Boolean));





function queryTerms(q, variants = false) {




  const Q = globalThis.R2 && globalThis.R2.query;
  return Q && typeof Q.queryTerms === 'function' ? Q.queryTerms(q) : [];


















}


function termRanges(raw, terms) {
  if (!raw || !terms || !terms.length) return [];



  const Q = globalThis.R2 && globalThis.R2.query;
  return Q && typeof Q.termRanges === 'function' ? Q.termRanges(raw, terms) : [];




























}






function proyecta(a, b, fixes, ra, rb) {
  const lo = Math.max(a, ra), hi = Math.min(b, rb);
  if (lo >= hi) return null;
  let off = 0, ia = null, ib = null;
  for (const [fa, fb, rep] of fixes) {
    if (fa < a || fa >= b) continue;
    if (ia === null && lo < fb) ia = lo <= fa ? lo - a + off : fa - a + off;
    if (ib === null && hi <= fb) ib = hi <= fa ? hi - a + off : fa - a + off + rep.length;
    off += rep.length - (fb - fa);
  }
  if (ia === null) ia = lo - a + off;
  if (ib === null) ib = hi - a + off;
  return ia < ib ? [ia, ib] : null;
}




function paint(t, ranges, from = 0, to = t.length) {
  const ev = new Map();
  const en = (p) => { const e = ev.get(p) || { c: 0, m: 0, t: null, te: 0 }; ev.set(p, e); return e; };
  const bump = (p, k, d) => { en(p)[k] += d; };
  for (const r of ranges || []) {
    const [a, b, k] = r;
    const lo = Math.max(a, from), hi = Math.min(b, to);
    if (lo >= hi) continue;
    if (k === 't') { en(lo).t = r; en(hi).te++; } else { bump(lo, k, 1); bump(hi, k, -1); }
  }
  if (!ev.size) return esc(t.slice(from, to));
  const pts = [...new Set([from, to, ...ev.keys()])].sort((x, y) => x - y);
  let html = '', c = 0, m = 0, cur = null, inC = false, inM = false, inT = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const e = ev.get(pts[i]);
    // El cierre antes que la apertura: un tema puede empezar donde acaba el anterior.
    if (e) { c += e.c; m += e.m; if (e.te) cur = null; if (e.t) cur = e.t; }
    const wantC = c > 0, wantM = m > 0;
    if (wantC !== inC) {
      if (inM) { html += '</mark>'; inM = false; }
      if (inT) { html += '</span>'; inT = null; }
      html += wantC ? '<span>' : '</span>';
      inC = wantC;
    }
    if (cur !== inT) {
      if (inM) { html += '</mark>'; inM = false; }
      if (inT) html += '</span>';
      if (cur) html += `<span class="th" data-th="${cur[3]}" style="--c:${esc(cur[4])}">`;
      inT = cur;
    }
    if (wantM !== inM) { html += wantM ? '<mark>' : '</mark>'; inM = wantM; }
    html += esc(t.slice(pts[i], pts[i + 1]));
  }
  if (inM) html += '</mark>';
  if (inT) html += '</span>';
  if (inC) html += '</span>';
  return html;
}


const ACOT_CLASES = new Set(['applause', 'conflict', 'order', 'neutral']);
const acotClase = c => (ACOT_CLASES.has(c) ? c : 'neutral');
const CHAIR_ROLES = new Set(['chair', 'vicechair', 'chair_age']);



const DOC_ROLES = new Set(['summary', 'remark']);
const DOC_NOMBRE = { summary: 'Encabezado y sumario de la sesión', remark: 'Texto sin orador' };


const DOC_POR_SPEAKER = { SUMARIO: 'summary', COMENTARIOS: 'remark' };
const docRole = x => (!x ? null
  : DOC_ROLES.has(x.role) ? x.role
  : DOC_POR_SPEAKER[(x.speaker || '').trim().toUpperCase()] || null);
const docNombre = x => DOC_NOMBRE[docRole(x)] || (x && (x.speaker_label || x.speaker)) || '';
const ident = v => !!v && v !== 'Sin identificar';







function hlContext(doc, { terms = [], raw = null, span = null } = {}) {
  const fix = (doc.fix || []).slice().sort((x, y) => x[0] - y[0]);
  // Los temas solo existen en la compilacion standalone y solo cuando la
  // biblioteca abierta tiene su red calculada: fuera de ahi no hay rangos y
  // todo lo demas sigue igual que antes.
  const temas = (t) => (typeof cooTemaRangos === 'function' ? cooTemaRangos(t) : []);
  if (raw != null) {
    const H = termRanges(raw, terms).map(([a, b]) => [a, b, 'm']);
    if (span && span[1] > span[0]) H.push([span[0], span[1], 'c']);
    for (const r of temas(raw)) H.push(r);
    H.sort((x, y) => x[0] - y[0]);
    return {
      fix,
      rangesFor(t, a, b) {
        if (a == null || b == null || !H.length) return [];
        const out = [];
        for (const r of H) {
          const [ra, rb, k] = r;
          if (ra >= b) break;
          if (rb <= a) continue;
          const p = proyecta(a, b, fix, ra, rb);
          // Un rango de tema arrastra ademas su indice y su color: se conservan.
          if (p) out.push(k === 't' ? [p[0], p[1], k, r[3], r[4]] : [p[0], p[1], k]);
        }
        return out;
      },
    };
  }
  return {
    fix,
    // Sesion corrida: sin texto original, se busca en el mostrado de cada hoja.
    rangesFor: t => (terms.length ? termRanges(t, terms).map(([x, y]) => [x, y, 'm']) : [])
      .concat(temas(t)).sort((x, y) => x[0] - y[0]),
  };
}



function leafHTML(t, a, b, ctx, units) {
  t = t || '';
  const rs = ctx.rangesFor(t, a, b);
  if (!units || !units.length || a == null) return paint(t, rs);
  let html = '', pos = 0;
  for (const u of units) {
    if (u.a == null || u.b == null) continue;
    const p = proyecta(a, b, ctx.fix, u.a, u.b);
    if (!p || p[0] < pos) continue;
    const [ua, ub] = p;
    html += paint(t, rs, pos, ua);
    let inner = '', s = ua;
    if (u.who && t.startsWith(u.who, ua) && ua + u.who.length <= ub) {
      inner += `<span class="acot-who">${paint(t, rs, ua, ua + u.who.length)}</span>`;
      s = ua + u.who.length;
    }
    inner += paint(t, rs, s, ub);
    html += `<span class="acot-u ${acotClase(u.c)}">${inner}</span>`;
    pos = ub;
  }
  return html + paint(t, rs, pos, t.length);
}

function segsHTML(segs, ctx) {
  return (segs || []).map(g => {
    if (g.k === 'acot') {
      return `<span class="acot-inline ${acotClase(g.c)}">${leafHTML(g.t, g.a, g.b, ctx, g.u)}</span>`;
    }
    if (g.k === 'note') return `<span class="acta-note-inline">${leafHTML(g.t, g.a, g.b, ctx)}</span>`;
    return leafHTML(g.t, g.a, g.b, ctx);
  }).join('');
}



function tableRowHTML(r, ctx) {
  const t = r.t || '';
  const m = t.match(/^([\s\S]*?\S)\s*\.{3,}[\s.]*(\d[\d.,]*)\s*$/);
  if (!m) return `<div class="acta-row">${leafHTML(t, r.a, r.b, ctx)}</div>`;
  const rs = ctx.rangesFor(t, r.a, r.b);
  const numAt = t.lastIndexOf(m[2]);
  return `<div class="acta-row"><span class="lead-t">${paint(t, rs, 0, m[1].length)}</span>`
    + `<span class="lead-f" aria-hidden="true"></span>`
    + `<span class="lead-n">${paint(t, rs, numAt, numAt + m[2].length)}</span></div>`;
}



function plainDoc(raw) {
  raw = raw || '';
  const blocks = []; let n = 0;
  const re = /\n\s*\n/g; let pos = 0, m;
  const push = (a, b) => {
    const t = raw.slice(a, b);
    const lead = t.length - t.trimStart().length, tail = t.length - t.trimEnd().length;
    if (a + lead >= b - tail) return;
    n++;
    blocks.push({ t: 'par', a: a + lead, b: b - tail, cont: false, n,
      s: [{ k: 'txt', a: a + lead, b: b - tail, t: raw.slice(a + lead, b - tail).replace(/\n/g, ' ') }] });
  };
  while ((m = re.exec(raw))) { push(pos, m.index); pos = m.index + m[0].length; }
  push(pos, raw.length);
  return { blocks, fix: [], n };
}



function renderDoc(doc, sid, hl = {}) {
  doc = doc || plainDoc('');
  const ctx = hlContext(doc, hl);
  const id = Number(sid) || 0;
  const out = [];
  let first = true;
  for (const b of doc.blocks || []) {
    switch (b.t) {
      case 'par': {
        const ancla = !b.cont && b.n != null;
        const tit = b.split === 'sentences'
          ? ' title="El original no separa párrafos: este § se ha cortado por frases"' : '';
        const cls = 'fp' + (b.cont ? ' cont' : '') + (first ? ' first' : '');
        out.push(`<p class="${cls}"${ancla ? ` id="p-${id}-${b.n}"` : ''}>`
          + (ancla ? `<span class="fp-anchor"${tit}>§ ${b.n}</span>` : '')
          + `${segsHTML(b.s, ctx)}</p>`);
        first = false;
        break;
      }
      case 'stage':
        out.push(`<div class="acot ${acotClase(b.c)}">${leafHTML(b.tx, b.src === 'speaker' ? null : b.a, b.b, ctx, b.u)}</div>`);
        break;
      case 'turn':
        out.push(`<p class="acta-turn"><span class="acta-who">${leafHTML(b.who?.t, b.who?.a, b.who?.b, ctx)}</span> `
          + `${segsHTML(b.s, ctx)}</p>`);
        first = false;
        break;
      case 'chron':
        out.push(`<p class="acta-chronicle">${segsHTML(b.s, ctx)}</p>`);
        break;
      case 'note':
        out.push(`<p class="acta-note">${segsHTML(b.s, ctx)}</p>`);
        break;
      case 'list':
        out.push(`<div class="acta-list${b.kind ? ` ${esc(b.kind)}` : ''}">`
          + (b.head ? `<div class="acta-list-head">${leafHTML(b.head.t, b.head.a, b.head.b, ctx)}</div>` : '')
          + `<ul class="acta-list-items">${(b.items || []).map(it =>
              `<li>${leafHTML(it.t, it.a, it.b, ctx)}</li>`).join('')}</ul>`
          + (b.total ? `<div class="acta-list-total">${leafHTML(b.total.t, b.total.a, b.total.b, ctx)}</div>` : '')
          + `</div>`);
        break;
      case 'table':
        out.push(`<div class="acta-table"${b.n != null ? ` id="p-${id}-${b.n}"` : ''}>`
          + (b.n != null ? `<span class="fp-anchor">§ ${b.n}</span>` : '')
          + (b.rows || []).map(r => tableRowHTML(r, ctx)).join('') + `</div>`);
        first = false;
        break;
      case 'art':
        break;
      default:
        if (b.s) out.push(`<p class="fp">${segsHTML(b.s, ctx)}</p>`);
        else if (b.tx) out.push(`<p class="fp">${leafHTML(b.tx, b.a, b.b, ctx)}</p>`);
    }
  }
  return out.join('') || '<p class="fp first"><em>Sin texto.</em></p>';
}



function renderText(raw, terms, span) {
  raw = raw || '';
  const rs = termRanges(raw, terms).map(([a, b]) => [a, b, 'm']);
  if (span && span[1] > span[0]) rs.push([span[0], span[1], 'c']);
  return paint(raw, rs);
}

function snippetHTML(s) {
  return esc(s || '').replace(/&lt;&lt;&lt;/g, '<mark>').replace(/&gt;&gt;&gt;/g, '</mark>');
}


async function boot() {




  let temaGuardado = null;
  try { temaGuardado = localStorage.getItem('tema'); } catch { temaGuardado = null; }
  document.documentElement.dataset.theme = temaGuardado === 'dark' ? 'dark' : 'light';







  try {
    for (const f of ['16px "2REP Garamond"', 'italic 16px "2REP Garamond"', '16px "2REP Didot"', '16px "2REP Mono"'])
      document.fonts?.load(f).catch(() => {});
  } catch {   }
  try {
    const info = await api('/info');
    S.info = info.corpus; S.corpora = info.available || [];
    if (!S.info) { noCorpus(info); return; }
    S.facets = await api('/facets');
    trendRangesDesdeFacetas(S.facets);
    S.collections = (await api('/collections')).collections;
    exprRestaurar();
    renderHeader(); renderFilters(); wire();
    setSideCollapsed(sideCollapsedSaved(), { guardar: false });
    setListCollapsed(listCollapsedSaved(), { guardar: false });
    search(true);
  } catch (e) { fatal(e.message); }
}

function noCorpus(info) {
  S.corpora = info.available || [];




  $('#hits').innerHTML = `<div class="empty"><div class="big">⌸</div>
    <h3>No hay ningún corpus abierto</h3>
    <p>Recargue la página y elija el CSV de intervenciones de un país.</p></div>`;
  $('#corpusStat').textContent = 'sin corpus';
}

function fatal(msg) {
  $('#hits').innerHTML = `<div class="empty"><div class="big">⚠</div>
    <h3>No se pudo iniciar</h3><p>${esc(msg)}</p></div>`;
}

function renderHeader() {
  const i = S.info;
  $('#corpusStat').textContent =


    `${i.title || 'Diarios de sesiones'} · ` +

    `${nf(i.n_speeches)} intervenciones · ${nf(i.n_sessions || 0)} sesiones · ${i.date_min?.slice(0, 4)}–${i.date_max?.slice(0, 4)}`
      ;
  $('#q').placeholder = placeholderBusqueda(i);
  if (!i.has_semantic) {
    for (const b of $$('.modes button')) if (b.dataset.mode !== 'keyword') b.disabled = true;
    setMode('keyword');
  }
}



function placeholderBusqueda(i) {



  return `Buscar en ${nf(i.n_speeches)} intervenciones… p. ej. presupuesto + educación | "derechos humanos"`;

}







const GRUPOS = {};

function itemsHTML(id, aguja = '') {
  const g = GRUPOS[id];
  if (!g) return '';
  const sel = new Set((S.filters[g.key] || []).map(String));
  const necesita = aguja ? foldMap(aguja).folded : '';

  // Los partidos se buscan también por su nombre completo y por las etiquetas del CSV que reúnen
  const casa = v => {
    if (!necesita) return true;
    const etq = [g.etiquetas[v.value] || v.value || '', v.nombre || '', ...(v.etiquetas || []).map(e => e[0])].join(' ');
    return foldMap(String(etq)).folded.includes(necesita);
  };
  const titulo = (v, lbl) => {
    if (!v.nombre && !v.etiquetas) return lbl;
    const e = v.etiquetas || [];
    return [v.nombre || lbl, e.length ? `Reúne en el CSV: ${e.slice(0, 8).map(x => x[0]).join(' · ')}${e.length > 8 ? ` y ${nf(e.length - 8)} más` : ''}` : '']
      .filter(Boolean).join('\n');
  };

  const valor = v => (g.key === 'rep_ids' ? v.rep_id : v.value);


  const elegidos = g.valores.filter(v => sel.has(String(valor(v))));
  const resto = g.valores.filter(v => !sel.has(String(valor(v))) && casa(v));
  const visibles = [...elegidos, ...resto.slice(0, g.max)];

  const fila = v => {
    const val = valor(v);
    const lbl = g.etiquetas[v.value] || v.value;
    const on = sel.has(String(val)) ? ' checked' : '';
    const extra = v.party && v.party !== 'Sin identificar'
      ? `<span class="n" style="opacity:.7">${esc(v.party)}</span>` : '';
    return `<label class="chk"><input type="checkbox" data-fkey="${g.key}" value="${esc(val)}"${on}>
      <span class="lbl" title="${esc(titulo(v, lbl))}">${esc(lbl)}</span>
      ${extra}<span class="n">${nf(v.n)}</span></label>`;
  };

  const pie = resto.length > g.max
    ? `<p class="dsub" style="margin:7px 0 0;font-size:11px">Mostrando
       ${nf(visibles.length)} de ${nf(elegidos.length + resto.length)}.
       Escriba arriba para encontrar el resto.</p>`
    : (necesita && !resto.length && !elegidos.length
        ? `<p class="dsub" style="margin:7px 0 0;font-size:11px">Sin coincidencias.</p>`
        : '');

  return visibles.map(fila).join('') + pie;
}

function grupo(id, titulo, valores, key, { max = 400, buscador = false, etiquetas = {} } = {}) {
  GRUPOS[id] = { valores: valores || [], key, max, etiquetas };
  const sel = new Set((S.filters[key] || []).map(String));
  const n = sel.size ? `<span class="count">${sel.size}</span>` : '';
  return `<details class="fgroup" id="fg-${id}"${sel.size ? ' open' : ''}>
    <summary>${titulo}${n}</summary>
    <div class="fbody${(valores || []).length > 9 ? ' tall' : ''}">
      ${buscador ? `<div class="field"><input type="search" class="fsearch" data-grupo="${id}"
         placeholder="Buscar entre ${nf((valores || []).length)}…" autocomplete="off"></div>` : ''}
      <div class="fitems" data-grupo="${id}">${itemsHTML(id)}</div>
    </div></details>`;
}

function renderFilters() {
  const f = S.facets, L = f.labels || {};
  $('#filters').innerHTML = `
    <details class="fgroup" open><summary>Qué se busca</summary><div class="fbody">
      <label class="fdoc"><input type="checkbox" id="fSinDocs"${S.filters.exclude_docs ? ' checked' : ''}>
        <span><b>Solo lo que se habla</b>
        <small>Deja fuera las filas sin orador: el encabezado y sumario de cada sesión y
        otros textos del Diario (anexos, listas de votación) que no son palabras de un
        diputado.</small></span></label>
    </div></details>

    <details class="fgroup" open><summary>Fecha y sesión</summary><div class="fbody">
      <div class="row2">
        <div class="field"><label>Desde</label><input type="date" id="fDesde"
          min="${f.date_min}" max="${f.date_max}" value="${S.filters.date_from || ''}"></div>
        <div class="field"><label>Hasta</label><input type="date" id="fHasta"
          min="${f.date_min}" max="${f.date_max}" value="${S.filters.date_to || ''}"></div>
      </div>
      <div class="field"><label>Sesión (n.º de orden en el corpus, 1–${nf(f.sessions_total || 0)})</label>
        <input type="number" id="fSesion" min="1" placeholder="cualquiera" value="${S.filters.num_session ?? ''}"></div>
    </div></details>

    <details class="fgroup" open><summary>Longitud de la intervención</summary><div class="fbody">
      <div class="row2">
        <div class="field"><label>Mín. palabras</label>
          <input type="number" id="fMin" min="0" placeholder="0" value="${S.filters.min_words ?? ''}"></div>
        <div class="field"><label>Máx. palabras</label>
          <input type="number" id="fMax" min="0" placeholder="∞" value="${S.filters.max_words ?? ''}"></div>
      </div>
      <p class="dsub" style="margin:0;font-size:11px;line-height:1.45">Muchas intervenciones
      breves son de trámite. Ponga un mínimo de 50 o 100 palabras para quedarse con los
      discursos.</p>
      <div style="display:flex;gap:5px;margin-top:7px">
        <button class="btn sm" data-minw="50">≥50</button>
        <button class="btn sm" data-minw="100">≥100</button>
        <button class="btn sm" data-minw="300">≥300</button>
        <button class="btn sm ghost" data-minw="">quitar</button>
      </div>
    </div></details>

    ${grupo('leg', 'Legislatura', f.legislatures, 'legislatures')}
    ${grupo('per', 'Periodo de sesiones', f.legislative_sessions, 'legislative_sessions', { buscador: (f.legislative_sessions || []).length > 12 })}
    ${grupo('tipo', 'Tipo de sesión', f.session_types, 'session_types')}
    ${grupo('sexo', 'Sexo', f.sexes, 'sexes', { etiquetas: L.sex || {} })}
    ${grupo('par', 'Partido', f.parties, 'parties', { buscador: true })}
    ${grupo('dip', 'Diputado/a', f.speakers, 'rep_ids', { max: 200, buscador: true })}
    ${grupo('dis', 'Distrito', f.districts, 'districts', { buscador: true })}

    <details class="fgroup"><summary>Restringir a una biblioteca</summary><div class="fbody">
      <div class="field"><select id="fLib">
        <option value="">— todo el corpus —</option>
        ${S.collections.map(c => `<option value="${c.id}"${S.filters.collection_id == c.id ? ' selected' : ''}>${esc(c.name)} (${nf(c.n_items)})</option>`).join('')}
      </select></div>
      <p class="dsub" style="margin:0;font-size:11px">Busca solo dentro del material que
      ya ha curado: útil para refinar un capítulo.</p>
    </div></details>

    <details class="fgroup"><summary>Búsquedas guardadas</summary>
      <div class="fbody" id="savedBox"><p class="dsub" style="font-size:11px;margin:0">—</p></div></details>

    <div style="padding:13px">
      <button class="btn" id="saveSearchBtn" style="width:100%">Guardar esta búsqueda</button>
    </div>

    <details class="fgroup" id="fg-fuente"><summary>Sobre este corpus</summary><div class="fbody">
      <div class="fuente-k">Cómo citar este material</div>
      ${fuenteHTML()}
      ${sobreCorpusDatosHTML()}
      <p class="dsub" style="font-size:11px;line-height:1.55;margin:0">
        Partido, distrito, sexo y tipo de sesión se muestran tal como vienen en el CSV,
        sin normalizar: las variantes de un mismo nombre aparecen como valores distintos.
      </p>
    </div></details>`;
  loadSaved();
  renderPills();
}



function sobreCorpusDatosHTML() {








  const R2 = globalThis.R2;
  if (R2 && R2.sobreCorpus && typeof R2.sobreCorpus.html === 'function') return R2.sobreCorpus.html(S.info);
  return `<p class="dsub" style="font-size:11px;line-height:1.55;margin:0 0 7px">
        ${nf(S.info.n_speeches)} intervenciones · ${nf(S.info.n_sessions || 0)} sesiones</p>`;

}

function renderPills() {
  const box = $('#activePills'); const out = [];
  const F = S.filters;
  const add = (txt, fn) => out.push({ txt, fn });







  const etq = { legislatures: 'Legislatura', legislative_sessions: 'Periodo', session_types: 'Tipo de sesión', sexes: 'Sexo',
                parties: 'Partido', districts: 'Distrito', rep_ids: 'Diputado/a' };
  for (const [k, label] of Object.entries(etq)) {
    for (const v of F[k] || []) {
      let show = v;
      if (k === 'sexes') show = S.facets?.labels?.sex?.[v] || v;
      if (k === 'rep_ids') {
        const s = (S.facets.speakers || []).find(x => String(x.rep_id) === String(v));
        show = s ? s.value : v;
      }
      add(`${label}: ${show}`, () => { F[k] = F[k].filter(x => String(x) !== String(v)); });
    }
  }


  const per = F.period && typeof F.period === 'object' ? F.period : null;
  if (per) {
    add(`Periodo: ${per.label || per.key}`, () => {
      delete F.period; delete F.speech_ids;
      if (per.kind === 'dates') { delete F.date_from; delete F.date_to; }
    });
  }
  if (F.date_from && per?.kind !== 'dates') add(`Desde ${F.date_from}`, () => delete F.date_from);
  if (F.date_to && per?.kind !== 'dates') add(`Hasta ${F.date_to}`, () => delete F.date_to);
  if (F.min_words) add(`≥${F.min_words} palabras`, () => delete F.min_words);
  if (F.max_words) add(`≤${F.max_words} palabras`, () => delete F.max_words);
  if (F.num_session) add(`Sesión ${F.num_session}`, () => delete F.num_session);
  if (F.exclude_docs) add('Solo lo que se habla', () => delete F.exclude_docs);
  if (F.collection_id) {
    const c = S.collections.find(x => x.id == F.collection_id);
    add(`En: ${c ? c.name : F.collection_id}`, () => delete F.collection_id);
  }

  box.hidden = !out.length;
  box.innerHTML = out.map((p, i) =>
    `<span class="pill">${esc(p.txt)}<button data-pill="${i}" title="Quitar">×</button></span>`).join('');
  box._fns = out.map(p => p.fn);
  updateSideRail();
}


let ctrl = null;
let climaCtrl = null;



const CLIMA_BUDGET_MS = 60;






let listaEspera = null;
async function esperaLista() { while (listaEspera) await listaEspera.promise; }

async function search(reset = false) {



  if (!reset && S.loading) return;
  const mine = ++S.seq;
  if (reset) {
    ctrl?.abort();
    ctrl = new AbortController();
    climaCtrl?.abort();
    climaCtrl = new AbortController();
    S.offset = 0; S.results = []; S.exhausted = false; S.similarOf = null;
    if (!listaEspera) {
      let fin; listaEspera = { promise: new Promise(res => { fin = res; }) }; listaEspera.fin = fin;
    }
    $('#hits').innerHTML = `<div class="empty"><span class="spin"></span></div>`;
    $('#spectrum')?.classList.add('stale');

    if (S.view === 'search') renderPills();

    qexpPintar();


    if (S.readMode === 'session' && S.session?.active && S.session.outline) sessRefreshTerms(S.session);
  }
  S.loading = true;

  try {
    const r = await api('/search', {
      method: 'POST',
      signal: reset ? ctrl.signal : undefined,
      body: { query: S.query, mode: S.mode, variants: S.variants, order: S.order,

              filters: S.filters, limit: PAGE, offset: S.offset, climate_budget_ms: CLIMA_BUDGET_MS },
    });
    if (mine !== S.seq) return;
    if (r.error) {
      toast(r.error, true);
      $('#hits').innerHTML = `<div class="empty"><div class="big">⚠</div>
        <h3>No se pudo interpretar la consulta</h3><p>${esc(r.error)}</p></div>`;
      S.results = []; S.total = 0; S.exhausted = true; S.lastMeta = null;
      $('#resultMeta').innerHTML = '<strong>0</strong>';
      $('#spectrum').hidden = true;

      return;
    }

    S.results = reset ? r.results : S.results.concat(r.results);
    S.total = r.total; S.ms = r.ms; S.lastMeta = r;
    Object.assign(S.membership, r.membership || {});


    S.exhausted = r.results.length < PAGE || (r.total != null && S.results.length >= r.total);
    renderMeta(); renderHits(reset, r.results);
    if (r.climate_pending?.length) loadClimate(r.climate_pending);
    if (reset) { trendAfterSearch(); loadSpectrum(); }
  } catch (e) {

    if (e.name !== 'AbortError' && mine === S.seq) {
      toast(e.message, true);


      if (reset) {
        $('#hits').innerHTML = `<div class="empty"><div class="big">⚠</div>
          <h3>No se pudo buscar</h3><p>${esc(e.message)}</p></div>`;
        S.results = []; S.total = 0; S.exhausted = true; S.lastMeta = null;
        $('#resultMeta').innerHTML = '<strong>0</strong>';
        $('#spectrum').hidden = true;

      }
    }
  } finally {
    if (mine === S.seq) {
      S.loading = false;

      if (listaEspera) { const w = listaEspera; listaEspera = null; w.fin(); }
    }
  }
}

























































































































function renderMeta() {

  const r = S.lastMeta || {};
  const interv = S.total === 1 ? 'intervención' : 'intervenciones';
  let lab, extra = '';



  let ayuda = '';

























 if (r.mode === 'browse') {
    lab = interv;
    extra = ` · ${S.ms} ms · sin texto de búsqueda`;
    ayuda = 'Está navegando el corpus con los filtros activos, sin buscar texto.';
  } else if (r.mode === 'library' || r.mode === 'similar') {
    return;
  } else {
    lab = interv;
  }




  const el = $('#resultMeta');
  const resto = `${lab}${extra || ` · ${S.ms} ms`}`;
  el.innerHTML = `<strong>${nf(S.total)}</strong><span>${resto}</span>`;
  el.title = `${nf(S.total)} ${resto}` + (ayuda ? `\n${ayuda}` : '');
  $('#order').value = S.order;
  $('#order').disabled = S.mode === 'semantic';







  $('#order').title = 'Ordenar';

}

function hitHTML(r) {
  const cols = S.membership[r.id] || [];
  const fam = r.session_type && r.session_type !== 'Sin identificar' && r.session_type !== 'ordinaria'
    ? `<span class="tag fam" title="Tipo de sesión">${esc(r.session_type)}</span>` : '';
  const par = r.party && r.party !== 'Sin identificar'
    ? `<span class="tag">${esc(r.party)}</span>` : '';











  const prov = '', pasaje = false;
  const snip = snippetHTML(r.snippet);

  const sc = r.score != null
    ? `<span class="score"><span class="bar"><i style="width:${Math.round(r.score * 100)}%"></i></span></span>` : '';
  const docr = docRole(r);
  return `<article class="hit${S.selected === r.id ? ' sel' : ''}${docr ? ` doc doc-${docr}` : ''}" data-id="${r.id}">
    <div class="hit-top">
      <span class="hit-name">${esc(docr ? DOC_NOMBRE[docr]
        : (r.rep_name && r.rep_name !== 'Sin identificar' ? r.rep_name : r.speaker))}</span>
      <span class="hit-date">${esc(r.date)}${r.session_number ? ` · ses. ${esc(r.session_number)}` : (r.num_session ? ` · ses. ${r.num_session}` : '')}</span>
      ${cols.length ? `<span class="inlib" title="Está en ${cols.length} biblioteca(s)">◆</span>` : ''}
    </div>
    <div class="hit-snip${pasaje ? ' sem' : ''}">${snip}</div>
    <div class="hit-foot">${prov}${fam}${par}
      <span class="tag words">${nf(r.nwords)} pal.</span><span class="clima-slot">${climaHTML(r.climate, r.climate_units)}</span>${sc}</div>
  </article>`;
}




async function loadClimate(ids) {
  const ctl = climaCtrl;
  for (let k = 0; k < ids.length; k += 8) {
    if (!ctl || ctl.signal.aborted) return;
    let r;
    try {
      r = await api('/climate', { method: 'POST', signal: ctl.signal, body: { ids: ids.slice(k, k + 8) } });
    } catch { return; }
    if (ctl.signal.aborted) return;
    for (const [id, v] of Object.entries(r.climate || {})) {
      const hit = S.results.find(x => x.id === +id);
      if (hit) { hit.climate = v.climate; hit.climate_units = v.climate_units; }
      const slot = $(`#hits .hit[data-id="${+id}"] .clima-slot`);
      if (slot) slot.innerHTML = climaHTML(v.climate, v.climate_units);
    }
  }
}

function renderHits(reset, nuevas = []) {
  const box = $('#hits');
  if (!S.results.length) {
    const m = S.lastMeta;













    box.innerHTML = `<div class="empty"><div class="big">⌕</div>
      <h3>Sin resultados</h3><p>Pruebe con otras palabras o quite algún filtro.</p></div>`;

    return;
  }
  const tail = S.exhausted
    ? `<div class="empty" style="padding:22px"><p>Fin de los resultados.</p></div>`
    : `<div id="sentinel" class="empty" style="padding:18px"><span class="spin"></span></div>`;

  if (reset) {
    box.innerHTML = S.results.map(hitHTML).join('') + tail;
    listScroller().scrollTop = 0;
  } else {




    $('#sentinel')?.remove();
    box.insertAdjacentHTML('beforeend', (nuevas || []).map(hitHTML).join('') + tail);
  }
  observeSentinel();
}


function refreshHitMarkers() {
  for (const el of $$('.hit')) {
    const id = +el.dataset.id;
    el.classList.toggle('sel', S.selected === id);
    const top = el.querySelector('.hit-top');
    const has = (S.membership[id] || []).length > 0;
    const mark = top.querySelector('.inlib');
    if (has && !mark) {
      top.insertAdjacentHTML('beforeend',
        '<span class="inlib" title="Esta en una biblioteca">\u25c6</span>');
    } else if (!has && mark) mark.remove();
  }
}

let io;
function observeSentinel() {
  io?.disconnect();
  const s = $('#sentinel');
  if (!s) return;
  io = new IntersectionObserver(es => {
    if (es[0].isIntersecting && !S.loading && !S.exhausted) {
      S.offset += PAGE; search(false);
    }
  }, { root: listScroller(), rootMargin: '320px' });
  io.observe(s);
}





async function openSpeech(id, { mode } = {}) {
  S.selected = id;
  if (S.results.some(r => r.id === id)) S.cursor = id;
  $$('.hit').forEach(h => h.classList.toggle('sel', +h.dataset.id === id));
  $('#app').classList.remove('no-reader');

  if (S.readMode === 'careo' && mode && mode !== 'careo') leaveCareo();
  if (mode === 'careo' || (!mode && S.readMode === 'careo')) { enterCareo(id); return; }
  if (mode === 'speech' && S.readMode === 'session') leaveSession();
  if (mode === 'session' || (!mode && S.readMode === 'session')) { enterSession(id); return; }

  S.readMode = 'speech';
  updateReadHead();
  const seq = ++S.readSeq;
  $('#reader').innerHTML = `<div class="empty"><span class="spin"></span></div>`;
  try {
    const d = await api(`/speech/${id}`);
    if (seq !== S.readSeq || S.readMode !== 'speech') return;
    renderReader(d);
  } catch (e) {
    if (seq === S.readSeq && S.readMode === 'speech')
      $('#reader').innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
  }
}


function setReadMode(m) {
  if (!S.selected) { toast('Abra primero una intervención.'); return; }
  $('#app').classList.remove('no-reader');
  if (m === 'careo') { enterCareo(S.selected); return; }
  if (S.readMode === 'careo') {
    leaveCareo();
    if (m === 'session') { enterSession(S.selected); return; }
    updateReadHead();

    if (S.current?.id === S.selected) renderReader(S.current, { restore: true });
    else openSpeech(S.selected, { mode: 'speech' });
    return;
  }
  if (m === 'session') {
    if (S.readMode === 'session' && S.session?.active && S.session.refId === S.selected) return;
    enterSession(S.selected);
    return;
  }
  if (S.readMode !== 'session') return;
  leaveSession();
  updateReadHead();

  if (S.current?.id === S.selected) renderReader(S.current, { restore: true });
  else openSpeech(S.selected, { mode: 'speech' });
}

function kickerText(m, d) {
  if (m && m.has_meta) {
    let k = [m.cortes, m.sigla && m.diario_num != null ? `${m.sigla} núm. ${m.diario_num}` : '']
      .filter(Boolean).join(' · ');

    if (m.page_start != null && m.page_end != null) k += ` (págs. ${m.page_start}–${m.page_end})`;
    if (k) return k;
  }
  return ['Diario de sesiones', d.legislature ? `Legislatura ${d.legislature}` : '', d.legislative_session ? d.legislative_session : '']
    .filter(Boolean).join(' · ');
}

function presidenciaText(m) {
  const p = m && m.presidente;
  const nombre = p && (p.nombre || p.corto);
  return nombre ? `Presidencia de D. ${nombre}` : '';
}



function warningsHTML(warnings, sw, cls = 'folio-warn') {
  const out = [];
  const tapados = new Set();
  if (sw) {
    if (sw.tipo === 'double_sitting') tapados.add('double_sitting');
    if (sw.tipo === 'date_error') tapados.add('date_corrected');
    const dudosa = sw.dudosa ?? true;
    const extra = (!sw.tipo || sw.tipo === 'unverified') && (sw.otros || []).length
      ? ` En esta fecha el corpus también registra ${sw.otros.length === 1 ? 'la sesión' : 'las sesiones'} `
        + sw.otros.map(n => `<b>${esc(n)}</b>`).join(', ') + '.'
      : '';
    out.push(`<div class="${cls} ${dudosa ? 'warn' : 'info'}"><b>${dudosa ? '⚠ ' : ''}`
      + `${esc(sw.titulo || 'Número de sesión dudoso')}.</b> ${esc(sw.mensaje)}${extra}</div>`);
  }
  for (const w of warnings || []) {
    if (tapados.has(w.code)) continue;



    if (w.code === 'truncated_end' && w.affects_speech === false) {
      const tramo = w.official_order_from != null
        ? ` (órdenes ${nf(w.official_order_from)}–${nf(w.official_order_to)})` : '';
      out.push(`<div class="${cls} note" title="${esc(w.message)}">ℹ︎ El acta digitalizada de esta sesión termina incompleta${esc(tramo)}. Esta intervención no está afectada.</div>`);
      continue;
    }
    const grave = w.severity === 'warning';
    const afecta = w.affects_speech ? ' <b>Esta intervención está en el tramo afectado.</b>' : '';
    out.push(`<div class="${cls} ${grave ? 'warn' : 'info'}">${grave ? '⚠ ' : 'ℹ︎ '}${esc(w.message)}${afecta}</div>`);
  }
  return out.join('');
}


function threadHTML(d) {
  const ctx = d.context || [];
  if (!ctx.length) return '';
  const total = d.position?.of ?? d.session?.n_speeches ?? 0;
  const fecha = fechaLarga(d.session_meta?.date_real || d.date);
  const recorta = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s);
  const filas = ctx.map(c => {
    const chair = CHAIR_ROLES.has(c.role);
    const nombre = docRole(c) ? DOC_NOMBRE[docRole(c)]
      : chair ? (c.speaker_label || c.speaker)
      : (ident(c.rep_name) ? c.rep_name : (c.speaker_label || c.speaker));
    let aparte;
    if (c.is_current) aparte = '<em>Intervención abierta</em>';
    else if ((c.nwords ?? 0) <= 15 && c.preview) aparte = `«${esc(recorta(c.preview.trim(), 70))}»`;
    else aparte = esc([ident(c.party) && !chair ? c.party : '', `${nf(c.nwords)} pal.`].filter(Boolean).join(' · '));
    const attrs = c.is_current ? '' : ` data-goto="${c.id}" role="button" tabindex="0"`;
    return `<div class="thread-row${c.is_current ? ' cur' : ''}"${attrs}>`
      + `<span class="thread-ord">Orden ${esc(c.official_order ?? '—')}</span>`
      + `<span class="thread-name" title="${esc(c.speaker)}">${esc(nombre)}</span>`
      + `<span class="thread-aside">${aparte}</span></div>`;
  }).join('');
  return `<div class="thread"><h4>Hilo continuo de la sesión${fecha ? ` (${esc(fecha)})` : ''}</h4>${filas}
    <div class="thread-row thread-more" data-session="${d.id}" role="button" tabindex="0">Leer la sesión corrida completa · ${nf(total)} intervenciones →</div></div>`;
}


function renderReader(d, { restore = false } = {}) {
  if (S.readMode !== 'speech') return;
  S.current = d;




  const span = null;

  const terms = S.mode === 'semantic' ? [] : queryTerms(S.query, S.variants);
  const cols = (d.collections || []).map(cid => S.collections.find(c => c.id === cid)).filter(Boolean);
  const m = d.session_meta || null;
  const doc = d.doc || plainDoc(d.speech);
  const sp = doc.speaker || {};
  const chair = CHAIR_ROLES.has(d.role) || sp.is_chair;

  const rawDiff = '';
  const orden = d.official_order != null
    ? `<span class="tag">Orden ${nf(d.official_order)}${d.position?.of ? ` de ${nf(d.position.of)}` : ''}</span>` : '';
  const gobierno = m?.gobierno?.nombre
    ? `<span${typeof m.gobierno.legitimidad_discutida === 'string' ? ` title="${esc(m.gobierno.legitimidad_discutida)}"` : ''}>${esc(m.gobierno.nombre)}</span>` : '';
  const gov = [presidenciaText(m) ? esc(presidenciaText(m)) : '', gobierno,
    d.session_number != null && d.session_number !== '' ? `Sesión ${esc(d.session_type && d.session_type !== 'Sin identificar' ? d.session_type + ' ' : '')}núm. ${esc(d.session_number)}`
      : (d.num_session != null ? `Sesión ${esc(d.session_type && d.session_type !== 'Sin identificar' ? d.session_type + ' ' : '')}(${esc(d.num_session)} del corpus)` : ''),
    esc(fechaLarga(m?.date_real || d.date))].filter(Boolean).join(' · ');
  const docr = docRole(d) || (DOC_ROLES.has(sp.role) ? sp.role : null);
  const titulo = docr ? DOC_NOMBRE[docr] : (d.speaker_label || sp.label || d.speaker);

  $('#reader').innerHTML = `<article class="folio${docr ? ` folio-doc doc-${docr}` : ''}" data-id="${d.id}">
    <div class="folio-kicker">${esc(kickerText(m, d))}</div>
    <h3 class="folio-title">${esc(titulo)}</h3>
    ${ident(d.rep_name) && !chair ? `<div class="folio-rep">${esc(d.rep_name)}</div>` : ''}
    ${sp.note ? `<div class="folio-rep"><em>${esc(sp.note)}</em></div>` : ''}
    <div class="folio-gov">${gov}</div>
    <div class="folio-rule"></div>
    <div class="folio-tags">
      ${chair ? `<span class="tag or">Presidencia · ${esc(sp.name || m?.presidente?.corto || '')}</span>` : ''}
      ${ident(d.party) ? `<span class="tag" title="Partido">${esc(d.party)}</span>` : ''}${rawDiff}
      ${sexoTag(d.sex)}
      ${ident(d.district) ? `<span class="tag" title="Distrito">${esc(d.district)}</span>` : ''}
      <span class="tag words">${nf(d.nwords)} palabras</span>
      ${orden}
      ${d.legislature ? `<span class="tag">Legislatura ${esc(d.legislature)}</span>` : ''}
      ${cols.map(c => `<span class="tag sem">◆ ${esc(c.name)}</span>`).join('')}
    </div>
    ${docr ? `<div class="consta doc"><b>${docr === 'summary'
      ? 'Encabezado y sumario de la sesión: texto sin orador que el Diario imprime antes de la primera intervención.'
      : 'Texto sin orador: material que el Diario imprime dentro del acta (anexos, listas de votación, resultados).'}</b></div>`
      : `<div class="consta"><b>Consta en el diario como:</b> ${esc(d.speaker)}</div>`}
    ${warningsHTML(d.warnings, d.session_warning)}
    ${
 '' }
    <div class="folio-body">${renderDoc(doc, d.id, { terms, raw: d.speech, span })}</div>
    ${threadHTML(d)}
  </article>`;

  marcarCapital($('#reader .folio-body'));
  cabeceraSinCortes($('#reader'));


  const sc = $('#reader');
  if (restore && S.speechScroll?.id === d.id) { sc.scrollTop = S.speechScroll.top; return; }
  sc.scrollTop = 0;



}















const frames = (n = 1) => new Promise(res => {
  const step = k => (k <= 0 ? res() : requestAnimationFrame(() => step(k - 1)));
  step(n);
});

function sessionTerms() {
  return S.mode === 'semantic' ? [] : queryTerms(S.query, S.variants);
}

function sessShortName(h) {
  if (docRole(h)) return DOC_NOMBRE[docRole(h)];
  if (CHAIR_ROLES.has(h.role)) return h.speaker_label || h.speaker || '';
  return (h.speaker_title || h.speaker_label || h.speaker || '')
    .replace(/^(El|La|Los|Las|Un|Una|Unos|Varios|Otros|Algunos)\s+(señor(?:a|ita|es|as)?|Sr\.|Sra\.|Srta\.|Sres\.)\s+/i, '');
}


function sessTramos(o, desde, hasta) {
  const L = o.limits || { max_speeches: 60, max_chars: 250000 };
  const out = []; let cur = [], ch = 0;
  for (let i = desde; i <= hasta; i++) {
    const h = o.speeches[i];
    if (cur.length && (cur.length >= L.max_speeches || ch + h.nchars > L.max_chars)) {
      out.push([cur[0], cur.at(-1)]); cur = []; ch = 0;
    }
    cur.push(i); ch += h.nchars || 0;
  }
  if (cur.length) out.push([cur[0], cur.at(-1)]);
  return out;
}

function sessBannerHTML(o) {
  const m = o.session_meta || {};
  const t = o.totals || {};
  const tipo = o.session_type && o.session_type !== 'Sin identificar' ? `${o.session_type} ` : '';
  const diario = m.has_meta && m.diario_num != null ? `Diario de Sesiones núm. ${m.diario_num}`
    : (o.session_number ? `Sesión ${tipo}núm. ${o.session_number}` : (o.num_session != null ? `Sesión ${tipo}${o.num_session} del corpus` : 'Sesión'));
  const pags = m.page_start != null && m.page_end != null ? `págs. ${m.page_start}–${m.page_end}` : '';
  const pres = m.presidente && (m.presidente.nombre || m.presidente.corto)
    ? `Presidencia: D. ${m.presidente.nombre || m.presidente.corto}` : '';
  const linea = [m.cortes, fechaLarga(m.date_real || o.date), pags, pres, m.gobierno?.nombre,
    o.legislature ? `Legislatura ${o.legislature}` : '', o.legislative_session || '']
    .filter(Boolean).map(esc).join(' · ');
  return `<div class="sess-banner">
    <div class="sess-banner-t">Sesión corrida íntegra · ${esc(diario)}</div>
    <div class="sess-banner-n"><b>${nf(t.n_speeches)} intervenciones íntegras · ${nf(t.n_words)} palabras</b>
      · Discurso activo: <b data-sess-active>—</b></div>
    <div>${linea}</div>
    ${warningsHTML(o.warnings, o.session_warning, 'sess-warn')}
  </div>`;
}

function sessBlockHTML(h, i, o) {
  const m = o.session_meta || {};
  const chair = CHAIR_ROLES.has(h.role);
  const docr = docRole(h);


  const chip = docr
    ? `<span class="tag doc">${esc(DOC_NOMBRE[docr])}</span>`
    : chair
    ? `<span class="tag or">Presidencia · ${esc(h.chair_name || m.presidente?.corto || '')}</span>`
    : [ident(h.party) ? `<span class="tag" title="Partido">${esc(h.party)}</span>` : '',
       sexoTag(h.sex),
       ident(h.district) ? `<span class="tag" title="Distrito">${esc(h.district)}</span>` : ''].join('');
  const num = m.diario_num ?? o.session_number ?? o.num_session;
  const sig = `${m.sigla || 'Sesión'}${num != null ? ` núm. ${num}` : ''}`;
  const quien = ident(h.rep_name) ? ` title="${esc(h.rep_name)}"` : '';
  const lineas = Math.min(3, Math.max(1, Math.ceil((h.nwords || 1) / 45)));
  const ghosts = Array.from({ length: lineas }, (_, k) =>
    `<div class="sess-ghost${k === lineas - 1 && lineas > 1 ? ' short' : ''}"></div>`).join('');
  return `<section class="sess-block${docr ? ` doc doc-${docr}` : ''}" id="sb-${h.id}" data-idx="${i}" data-sid="${h.id}">
    <div class="sess-head"><span class="sess-name"${quien}>${esc(docr ? DOC_NOMBRE[docr] : (h.speaker_title || h.speaker_label || h.speaker))}
      <em>(Orden ${esc(h.official_order ?? '—')})</em></span><span class="sess-sig">${esc(sig)}</span>
      <button class="btn sm" data-solo="${h.id}" title="Abrir esta intervención sola">Ver solo este</button>
      ${chip ? `<div class="sess-tags">${chip}</div>` : ''}</div>
    <div class="sess-body ph">${ghosts}</div></section>`;
}


function sessEstimate(s, h) {
  const n = h.nchars || 0;
  const lineas = Math.max(1, Math.ceil(n / s.cpl));
  const parrafos = Math.max(1, Math.round(n / 900));



  if (s.metrica) return (lineas * s.metrica.lh + parrafos * s.metrica.mb) * (s.corr || 1);

  return lineas * 30.1 + parrafos * 19.25;
}











const SESS_MUESTRA = 'Señores Diputados, la Comisión ha examinado con detenimiento el proyecto de ley y propone a la Cámara '
  + 'que se apruebe con las modificaciones que constan en el dictamen, porque así lo exige el interés de la República. ';
const SESS_LLENADO = 1.07;
function sessMetrica(body) {
  if (!body) return null;
  const p = document.createElement('p');
  p.className = 'fp';
  p.setAttribute('aria-hidden', 'true');
  p.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;text-indent:0;width:auto';
  p.textContent = SESS_MUESTRA;
  body.appendChild(p);
  const cs = getComputedStyle(p);
  const fs = parseFloat(cs.fontSize);
  const lh = cs.lineHeight.endsWith('px') ? parseFloat(cs.lineHeight) : fs * (parseFloat(cs.lineHeight) || 1.78);
  const mb = parseFloat(cs.marginBottom) || 0;
  const cw = p.getBoundingClientRect().width / SESS_MUESTRA.length;
  p.remove();
  return fs > 0 && lh > 0 && cw > 0 ? { lh, mb, cw: cw * SESS_LLENADO } : null;
}











const CAPITAL_SIGNOS = '«"“\'‘¿¡';


const CAPITAL_MIN_INTERVENCION = 100, CAPITAL_MIN_PARRAFO = 50;


const PALABRA_RE = new RegExp(String.raw`\p{L}[\p{L}\p{N}\u0027\u2019.-]*`, 'gu');
const contarPalabras = el => (el.textContent.match(PALABRA_RE) || []).length;
function marcarCapital(raiz) {
  if (!raiz || contarPalabras(raiz) <= CAPITAL_MIN_INTERVENCION) return;
  for (const p of raiz.querySelectorAll('.fp.first')) {
    if (p.querySelector(':scope > .r2-capital') || contarPalabras(p) <= CAPITAL_MIN_PARRAFO) continue;
    const w = document.createTreeWalker(p, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.nodeType === 1 && n.classList.contains('fp-anchor') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const tramos = [];
    let cap = '', letra = null, empezado = false, vale = true;
    busca: for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 1) {
        if (!empezado && n.matches('.acot-inline, .acta-note-inline')) { vale = false; break; }
        continue;
      }
      const t = n.nodeValue;
      let desde = -1;
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (!empezado && /\s/.test(c)) continue;
        empezado = true;
        if (CAPITAL_SIGNOS.includes(c) && cap.length < 3) { if (desde < 0) desde = i; cap += c; continue; }
        if (/\p{L}/u.test(c)) { if (desde < 0) desde = i; cap += c; tramos.push([n, desde, i + 1]); letra = n; break busca; }
        vale = false; break busca;
      }
      if (desde >= 0) tramos.push([n, desde, t.length]);
    }
    if (!vale || !letra) continue;
    const enMark = !!letra.parentElement?.closest('mark');
    for (const [n, a, b] of tramos) {
      const medio = n.splitText(a);
      medio.splitText(b - a);
      const s = document.createElement('span');
      s.className = 'r2-cap-texto';
      medio.replaceWith(s);
      s.appendChild(medio);
    }
    const c = document.createElement('span');
    c.className = 'r2-capital' + (enMark ? ' en-mark' : '');
    c.setAttribute('aria-hidden', 'true');
    c.dataset.signo = cap.slice(0, -1);
    c.dataset.letra = cap.slice(-1);
    const ancla = p.querySelector(':scope > .fp-anchor');
    p.insertBefore(c, ancla ? ancla.nextSibling : p.firstChild);
    p.classList.add('r2-cap');
    capitalIluminada(c);
  }
}





function capitalIluminada(c) {
  const R2 = globalThis.R2;
  const quiere = document.documentElement.dataset.estilo === 'iluminado' && !!(R2 && R2.capitales && R2.capitales.disponible());
  if (!quiere) {
    if (c.classList.contains('iluminada')) { c.classList.remove('iluminada'); c.textContent = ''; }
    return;
  }
  if (c.classList.contains('iluminada') && c.firstChild) return;
  c.classList.add('iluminada');
  R2.capitales.svg(c.dataset.letra).then(svg => {
    if (!c.isConnected || document.documentElement.dataset.estilo !== 'iluminado') return;
    if (svg) c.innerHTML = svg; else c.classList.remove('iluminada');
  });
}



function cabeceraSinCortes(raiz) {
  for (const k of raiz?.querySelectorAll('.folio-kicker') || []) {
    for (const n of [...k.childNodes]) {
      if (n.nodeType !== 3) continue;
      const m = /págs\.\s\d+–\d+/.exec(n.nodeValue);
      if (!m) continue;
      const medio = n.splitText(m.index);
      medio.splitText(m[0].length);
      const s = document.createElement('span');
      s.className = 'r2-nowrap';
      medio.replaceWith(s);
      s.appendChild(medio);
    }
  }
}








function sessLecturaTop(L) {
  if (L.nodo) {
    if (!L.nodo.isConnected) return null;
    const len = L.nodo.nodeValue.length;
    if (!len) return null;
    const a = Math.max(0, Math.min(L.off, len - 1));
    const r = document.createRange();
    r.setStart(L.nodo, a); r.setEnd(L.nodo, a + 1);
    const q = r.getClientRects()[0];
    return q && q.height > 0 ? q.top : null;
  }
  return L.el?.isConnected ? L.el.getBoundingClientRect().top : null;
}
function sessLecturaGuardar(s) {
  const sc = $('#reader');
  if (!s?.active || !s.root?.isConnected || sc.clientWidth !== s.width) return;
  const box = sc.getBoundingClientRect(), f = s.root.getBoundingClientRect();
  const x = Math.min(Math.max(f.left + f.width / 2, box.left + 1), box.right - 1), y = box.top + 60;
  let L = null;
  const cp = document.caretPositionFromPoint?.(x, y);
  const cr = cp ? null : document.caretRangeFromPoint?.(x, y);
  const nodo = cp ? cp.offsetNode : cr?.startContainer, off = cp ? cp.offset : cr?.startOffset;
  if (nodo?.nodeType === 3 && s.root.contains(nodo)) {
    const t = sessLecturaTop(L = { nodo, off });
    if (t == null) L = null; else L.top = t - box.top;
  }
  if (!L) {
    const h = document.elementFromPoint(x, y);
    const el = h && s.root.contains(h)
      ? h.closest('.fp, .acot, .acta-turn, .acta-chronicle, .acta-note, .acta-list, .acta-table, .sess-head, .sess-body, .sess-block') : null;
    if (el) L = { el, top: el.getBoundingClientRect().top - box.top };
  }
  s.lectura = L;
}
function sessLecturaRestaurar(s, fn) {
  const L = s.lectura, sc = $('#reader');
  if (!L || !s.active || !s.root?.isConnected || !(L.nodo || L.el)?.isConnected) return false;
  fn();
  const t = sessLecturaTop(L);
  if (t != null) {
    const d = t - sc.getBoundingClientRect().top - L.top;
    if (Math.abs(d) >= 0.5) sc.scrollTop += d;
  }
  sessLecturaGuardar(s);
  return true;
}









function sessAprender(s, els) {
  if (!s.metrica || s.corrHecha) return;
  const base = s.corr || 1;
  for (const b of els) {
    if (b.classList.contains('sess-ref')) continue;
    const est = sessEstimate(s, s.outline.speeches[+b.dataset.idx]) / base;
    const med = b.querySelector('.sess-body').getBoundingClientRect().height;
    if (est > 0 && med > 0) { s.aprEst = (s.aprEst || 0) + est; s.aprMed = (s.aprMed || 0) + med; }
  }
  if ((s.aprEst || 0) < 2500) return;
  s.corrHecha = true;
  const c = Math.min(1.25, Math.max(0.8, s.aprMed / s.aprEst));
  if (Math.abs(c / base - 1) <= 0.02) return;
  s.corr = c;
  for (const b of s.blocks) {
    if (s.loaded.has(+b.dataset.sid)) continue;
    b.querySelector('.sess-body').style.height = `${sessEstimate(s, s.outline.speeches[+b.dataset.idx]).toFixed(1)}px`;
  }
}




function sessSizes(s) {
  const body = s.blocks.find(b => !b.classList.contains('sess-ref'))?.querySelector('.sess-body');
  const w = body?.getBoundingClientRect().width || 560;
  s.cpl = Math.max(28, w / 7.9);

  s.metrica = sessMetrica(body);
  if (s.metrica) s.cpl = Math.max(28, w / s.metrica.cw);
  s.aprEst = s.aprMed = 0;
  s.corrHecha = false;

  s.width = $('#reader').clientWidth;
  for (const b of s.blocks) {
    if (b.classList.contains('loaded')) continue;
    b.querySelector('.sess-body').style.height = `${sessEstimate(s, s.outline.speeches[+b.dataset.idx]).toFixed(1)}px`;
  }
}




function sessMeasure(els) {
  if (!els.length) return;
  for (const el of els) el.style.contentVisibility = 'visible';
  const hs = els.map(el => {
    const cs = getComputedStyle(el);
    return el.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
  });
  els.forEach((el, k) => {
    el.style.containIntrinsicSize = `auto ${Math.max(1, hs[k]).toFixed(2)}px`;
    el.style.contentVisibility = '';
  });
}

function teardownSession(s) {
  if (!s) return;
  s.ctrl.abort();
  s.io?.disconnect(); s.ro?.disconnect(); s.roOn = false;
  s.active = false;
  if (S.session === s) S.session = null;
}

function leaveSession() {
  const s = S.session;
  const app = $('#app');
  S.readMode = 'speech';
  app.classList.remove('session-mode');
  if (!s) return;
  if (s.active) {
    s.scroll = $('#reader').scrollTop;
    s.active = false;
    s.io?.disconnect(); s.ro?.disconnect(); s.roOn = false;
    if (!s.prevWide) app.classList.remove('wide-reader');
  }
  if (!s.root) teardownSession(s);
}

async function enterSession(refId) {
  const app = $('#app'), sc = $('#reader');
  const eraDiscurso = S.readMode !== 'session';
  if (eraDiscurso && S.current && sc.querySelector('.folio[data-id]'))
    S.speechScroll = { id: S.current.id, top: sc.scrollTop };
  S.readMode = 'session';
  ++S.readSeq;
  let s = S.session;


  if (s && s.root && s.byId.has(refId)) {
    if (!s.active) s.prevWide = app.classList.contains('wide-reader');
    app.classList.add('wide-reader', 'session-mode');
    const mismaRef = s.refId === refId;
    if (sc.firstElementChild !== s.root) sc.replaceChildren(s.root);
    s.active = true;
    if (s.needRemeasure) {

      s.needRemeasure = false;
      sessMeasure(s.blocks.filter(b => b.classList.contains('loaded')));
    }
    sessSetRef(s, refId);
    sessRefreshTerms(s);
    updateReadHead();
    if (mismaRef && s.scroll != null) sc.scrollTop = s.scroll;
    sessObserve(s);
    if (!mismaRef || s.scroll == null) await sessGoTo(s, s.byId.get(refId));
    return;
  }

  const prevWide = s?.active ? s.prevWide : app.classList.contains('wide-reader');
  teardownSession(s);
  s = S.session = {
    refId, ctrl: new AbortController(), outline: null, root: null, blocks: [],
    byId: new Map(), docs: new Map(), loaded: new Set(), pendingP: new Map(),
    io: null, ro: null, roOn: false, active: true, prevWide, scroll: null, cpl: 70, width: 0,
    terms: sessionTerms(), termsKey: '',
  };
  s.termsKey = JSON.stringify(s.terms);
  app.classList.add('wide-reader', 'session-mode');
  updateReadHead();
  sc.innerHTML = `<div class="empty"><span class="spin"></span></div>`;

  let o;
  try {
    o = await api(`/session/outline/${refId}`, { signal: s.ctrl.signal });
  } catch (e) {
    if (e.name !== 'AbortError' && S.session === s && S.readMode === 'session')
      sc.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
    if (S.session === s) teardownSession(s);
    return;
  }
  if (S.session !== s || !s.active) return;

  s.outline = o;
  o.speeches.forEach((h, i) => s.byId.set(h.id, i));
  const root = document.createElement('article');
  root.className = 'folio sess';
  root.innerHTML = sessBannerHTML(o)
    + `<div class="sess-outline">${o.speeches.map((h, i) => sessBlockHTML(h, i, o)).join('')}</div>`;
  s.root = root;
  sc.replaceChildren(root);
  s.blocks = [...root.querySelectorAll('.sess-block')];
  sessSizes(s);
  const ref = s.byId.get(refId) ?? 0;
  sessSetRef(s, o.speeches[ref].id);
  updateReadHead();
  sessObserve(s, { io: false });
  sessScrollTo(s, ref);
  await sessGoTo(s, ref);
  if (S.session === s && s.active) sessObserve(s);
}


function sessObserve(s, { io = true } = {}) {
  const sc = $('#reader');
  if (!s.ro) {
    let raf = 0;
    s.ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!s.active || S.session !== s || sc.clientWidth === s.width) return;



        if (sessLecturaRestaurar(s, () => {
          sessSizes(s);
          sessMeasure(s.blocks.filter(b => b.classList.contains('loaded')));
        })) return;

        withScrollAnchor(s, () => {
          sessSizes(s);
          sessMeasure(s.blocks.filter(b => b.classList.contains('loaded')));
        });
      });
    });
  }
  if (!s.roOn) { s.ro.observe(sc); s.roOn = true; }

  if (!io) return;
  s.io?.disconnect();
  const cola = new Set(); let raf = 0;
  s.io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) cola.add(+e.target.dataset.idx);
    if (raf || !cola.size) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (S.session !== s || !s.active) { cola.clear(); return; }
      const idx = [...cola].sort((a, b) => a - b); cola.clear();


      const pide = (a, b) => sessEnsure(s, a - 8, b + 16);
      let a = idx[0], b = idx[0];
      for (const i of idx.slice(1)) {
        if (i <= b + 1) b = i; else { pide(a, b); a = b = i; }
      }
      pide(a, b);
    });
  }, { root: sc, rootMargin: '2000px 0px' });
  for (const b of s.blocks) if (!s.loaded.has(+b.dataset.sid)) s.io.observe(b);
}


function sessEnsure(s, from, to) {
  const sp = s.outline.speeches;
  from = Math.max(0, from); to = Math.min(sp.length - 1, to);
  const esperas = new Set();
  let run = null;
  const runs = [];
  for (let i = from; i <= to; i++) {
    const id = sp[i].id;
    if (s.loaded.has(id)) { run = null; continue; }
    if (s.pendingP.has(id)) { esperas.add(s.pendingP.get(id)); run = null; continue; }
    if (run && run[1] === i - 1) run[1] = i; else runs.push(run = [i, i]);
  }
  for (const [a, b] of runs)
    for (const [ta, tb] of sessTramos(s.outline, a, b)) esperas.add(sessFetch(s, ta, tb));
  return Promise.all(esperas);
}

function sessFetch(s, ia, ib) {
  const ids = s.outline.speeches.slice(ia, ib + 1).map(h => h.id);
  const p = api(`/session/texts?from_id=${ids[0]}&to_id=${ids.at(-1)}`, { signal: s.ctrl.signal })
    .then(r => {
      if (S.session !== s) return;
      for (const t of r.texts || []) s.docs.set(t.id, t.doc);
      sessFill(s, ids);
    })
    .catch(e => {
      if (e.name === 'AbortError' || S.session !== s) return;
      for (const id of ids) {
        const body = s.blocks[s.byId.get(id)]?.querySelector('.sess-body');
        if (body) body.innerHTML = `<p class="sess-err">No se pudo cargar: ${esc(e.message)}
          <button class="linkbtn" data-sess-retry="${s.byId.get(id)}">Reintentar</button></p>`;
      }
    })
    .finally(() => { for (const id of ids) if (s.pendingP.get(id) === p) s.pendingP.delete(id); });
  for (const id of ids) s.pendingP.set(id, p);
  return p;
}



function sessAnchor(s, top) {
  let lo = 0, hi = s.blocks.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (s.blocks[mid].getBoundingClientRect().bottom > top) { ans = mid; hi = mid - 1; } else lo = mid + 1;
  }
  return ans >= 0 ? s.blocks[ans] : null;
}



function withScrollAnchor(s, fn) {
  const sc = $('#reader');
  if (!s.active || !s.root?.isConnected) return fn();
  const top = sc.getBoundingClientRect().top;
  const anchor = sessAnchor(s, top);
  const antes = anchor ? anchor.getBoundingClientRect().top : 0;
  const r = fn();
  if (anchor) {
    const d = anchor.getBoundingClientRect().top - antes;
    if (Math.abs(d) >= 0.5) sc.scrollTop += d;
  }
  return r;
}

function sessFill(s, ids) {
  withScrollAnchor(s, () => {
    const els = [];
    for (const id of ids) {
      const doc = s.docs.get(id);
      const blk = s.blocks[s.byId.get(id)];
      if (!doc || !blk) continue;
      const body = blk.querySelector('.sess-body');
      body.innerHTML = renderDoc(doc, id, { terms: s.terms });

      marcarCapital(body);

      body.classList.remove('ph');
      body.style.height = '';
      s.loaded.add(id);
      s.io?.unobserve(blk);
      els.push(blk);
    }
    sessMeasure(els);

    sessAprender(s, els);

    for (const el of els) el.classList.add('loaded');
    return els;
  });
  sessFontsRemeasure(s);
}






function sessFontsRemeasure(s) {
  const fs = document.fonts;
  if (!fs || fs.status !== 'loading' || s.fontsWait) return;
  s.fontsWait = true;
  fs.ready.then(() => frames(1)).then(() => {
    s.fontsWait = false;
    if (S.session !== s) return;
    if (!s.active || !s.root?.isConnected) { s.needRemeasure = true; return; }
    withScrollAnchor(s, () => sessMeasure(s.blocks.filter(b => b.classList.contains('loaded'))));
    sessFontsRemeasure(s);
  });
}



function sessRefreshTerms(s) {
  const terms = sessionTerms();
  const key = JSON.stringify(terms);
  if (key === s.termsKey) return;
  s.terms = terms; s.termsKey = key;
  const ids = [...s.loaded];
  if (ids.length) sessFill(s, ids);
}

function sessSetRef(s, refId) {
  const i = s.byId.get(refId);
  if (i == null) return;
  const blk = s.blocks[i];
  withScrollAnchor(s, () => {
    const tocados = [];
    for (const old of s.root.querySelectorAll('.sess-ref')) {
      old.classList.remove('sess-ref');
      old.querySelector('.sess-star')?.remove();
      tocados.push(old);
    }
    blk.classList.add('sess-ref');
    blk.querySelector('.sess-sig').insertAdjacentHTML('beforebegin',
      '<span class="tag star sess-star">★ Intervención de referencia</span>');
    tocados.push(blk);

    sessMeasure(tocados.filter(b => b.classList.contains('loaded')));
  });
  s.refId = refId;
  const h = s.outline.speeches[i];
  const act = s.root.querySelector('[data-sess-active]');
  if (act) act.textContent = `#${h.official_order ?? h.index} de ${nf(s.outline.totals?.n_speeches ?? s.outline.speeches.length)}`;
}

function sessScrollTo(s, idx) {
  const el = s.blocks[idx];
  if (!el || !s.active) return;
  const sc = $('#reader');
  sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 10;
}



async function sessGoTo(s, idx) {
  if (idx == null) return;
  sessScrollTo(s, idx);
  await sessEnsure(s, idx - 8, idx + 12);
  if (S.session !== s || !s.active) return;
  try { await document.fonts.ready; } catch {   }
  await frames(2);
  if (S.session !== s || !s.active) return;
  sessScrollTo(s, idx);
  const sel = $('#sessJump');
  if (sel) sel.value = String(idx);
}


/* Los controles de tema solo salen cuando pueden hacer algo: compilacion
   standalone, una biblioteca seleccionada y su red de coocurrencias calculada.
   Un control que no puede hacer nada estorba mas de lo que ayuda. */

function temaDisponible() {
  // Solo dentro de la biblioteca cuyos temas se han calculado. En Explorar no:
  // un mismo termino cae en temas distintos segun la biblioteca, asi que pintar
  // una intervencion cualquiera con la particion de la ultima abierta seria falso.
  return S.view === 'library' && S.libSel != null
    && typeof cooIndice === 'function' && !!cooIndice();
}


function temaHead() {
  const caja = $('#temaTools');
  if (!caja) return;
  const hay = temaDisponible();
  caja.hidden = !hay || S.readMode === 'careo';
  if (caja.hidden) return;
  $$('#temaTools [data-tema]').forEach(b =>
    b.setAttribute('aria-pressed', String((b.dataset.tema === '1') === !!S.readTema)));
  $$('#temaTools [data-tmarca]').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.tmarca === S.readTemaMarca)));
  $$('#temaTools [data-tmarca]').forEach(b => { b.disabled = !S.readTema; });
}

/* Repinta lo que haya abierto. Se llama al tocar los controles y tambien cuando
   cambian los temas en Coocurrencias: las marcas son contextuales a la
   biblioteca y tienen que seguir a lo que alli se vea. */

function temaRepinta() {
  document.documentElement.dataset.temaMarca = S.readTemaMarca;
  temaHead();
  if (S.readMode === 'session' && S.session?.active && S.session.outline) {
    sessRefreshTerms(S.session);
  } else if (S.readMode === 'speech' && S.current) {
    // `restore: true` conserva la posicion de lectura: repintar no debe mover el pliego.
    renderReader(S.current, { restore: true });
  }
}

// Lo que ensena la etiqueta de una marca: lo mismo que la cabecera del tema en
// Coocurrencias —peso, alcance, intervenciones, terminos y G2 medio— mas sus tres
// terminos principales, para no obligar a cambiar de pestana con la marca delante.
// Se devuelven las piezas sueltas y las maqueta temaTip: el `title` nativo tarda
// casi un segundo en salir y lo dibuja el sistema, que aqui desentona.
function temaRotulo(k) {
  const r = S.coo && S.coo.data, c = r && (r.comunidades || [])[k];
  if (!c) return null;
  const dec = v => (v == null ? null : String(v).replace('.', ','));
  const m = [];
  if (c.peso != null) m.push(`peso ${dec(c.peso)} %`);
  if (c.porcentaje != null) m.push(`alcance ${dec(c.porcentaje)} %`);
  if (c.intervenciones != null) m.push(`${nf(c.intervenciones)} intervenciones`);
  if (c.n_terminos != null) m.push(`${nf(c.n_terminos)} términos`);
  if (c.g2_medio != null) m.push(`G² medio ${nf(Math.round(c.g2_medio))}`);
  return { n: k + 1, etq: c.etiqueta, med: m.join(' · '),
           cabeza: (c.terminos || []).slice(0, 3).map(t => t.display).join(', ') };
}

// Etiqueta propia, con la misma hoja que la de Tendencia (.trend-tip) para que no
// parezca de otra aplicacion. Sale al momento y sigue al raton.
let TEMA_TIP = null;
function temaTip(e) {
  const m = e.target.closest && e.target.closest('.th[data-th]');
  if (!m) { if (TEMA_TIP) TEMA_TIP.hidden = true; return; }
  const I = typeof cooIndice === 'function' ? cooIndice() : null;
  const d = I && I.rot && I.rot[+m.dataset.th];
  if (!d) { if (TEMA_TIP) TEMA_TIP.hidden = true; return; }
  if (!TEMA_TIP) {
    TEMA_TIP = document.createElement('div');
    TEMA_TIP.className = 'trend-tip tema-tip';
    TEMA_TIP.hidden = true;
    document.body.appendChild(TEMA_TIP);
  }
  TEMA_TIP.style.setProperty('--c', m.style.getPropertyValue('--c'));
  TEMA_TIP.innerHTML = `<div class="tt-r tt-h"><i></i>${esc(d.etq)}</div>`
    + (d.med ? `<div class="tt-dim">${esc(d.med)}</div>` : '')
    + (d.cabeza ? `<div class="tt-go">${esc(d.cabeza)}</div>` : '');
  TEMA_TIP.hidden = false;
  const r = m.getBoundingClientRect(), t = TEMA_TIP.getBoundingClientRect();
  const x = Math.max(8, Math.min(r.left, innerWidth - t.width - 8));
  const y = r.top > t.height + 10 ? r.top - t.height - 6 : r.bottom + 6;
  TEMA_TIP.style.left = `${Math.round(x)}px`;
  TEMA_TIP.style.top = `${Math.round(y)}px`;
}

function temaClick(e) {
  const t = e.target.closest('#temaTools [data-tema]');
  if (t) {
    S.readTema = t.dataset.tema === '1';
    try { localStorage.setItem('readTema', S.readTema ? '1' : '0'); } catch { /* sin almacenamiento */ }
    temaRepinta();
    return true;
  }
  const m = e.target.closest('#temaTools [data-tmarca]');
  if (m && !m.disabled) {
    S.readTemaMarca = m.dataset.tmarca;
    try { localStorage.setItem('readTemaMarca', S.readTemaMarca); } catch { /* sin almacenamiento */ }
    temaRepinta();
    return true;
  }
  return false;
}

function updateReadHead() {
  careoHead();
  const enSesion = S.readMode === 'session';
  $$('#readModes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rmode === S.readMode)));
  temaHead();
  const s = S.session;
  const ok = enSesion && s && s.outline;
  $('#sessTools').hidden = !ok;
  if (!ok) return;
  const i = s.byId.get(s.refId);
  const h = s.outline.speeches[i];
  $('#sessRef').textContent = `🎯 Ir a la referencia (#${h?.official_order ?? '—'})`;
  const sel = $('#sessJump');
  if (sel._for !== s) {
    sel.innerHTML = s.outline.speeches.map((x, k) =>
      `<option value="${k}">Orden ${esc(x.official_order ?? x.index)} · ${esc(sessShortName(x))}</option>`).join('');
    sel._for = s;
  }
  if (i != null) sel.value = String(i);
}








function careoState() {
  return { refId: null, mode: 'synchronic', res: {}, err: {}, pick: {}, swapped: false,
           speeches: new Map(), ctrl: null, seq: 0, prevWide: false, centered: null };
}
S.careo = careoState();

function careoGet(id) {
  if (id == null) return null;
  if (S.current?.id === id && S.current.doc) return S.current;
  return S.careo.speeches.get(id) || null;
}

async function careoSpeech(id, signal) {
  const hay = careoGet(id);
  if (hay) return hay;
  const d = await api(`/speech/${id}?context=0`, { signal });
  const C = S.careo;
  C.speeches.set(id, d);
  if (C.speeches.size > 24) C.speeches.delete(C.speeches.keys().next().value);
  return d;
}

function careoPickId() {
  const C = S.careo, xs = C.res[C.mode]?.results || [];
  if (!xs.length) return null;
  return xs.some(x => x.id === C.pick[C.mode]) ? C.pick[C.mode] : xs[0].id;
}

function careoCand() {
  const C = S.careo, id = careoPickId();
  return id == null ? null : C.res[C.mode].results.find(x => x.id === id);
}

function enterCareo(refId) {
  const app = $('#app'), sc = $('#reader'), C = S.careo;
  if (S.readMode === 'session') leaveSession();
  else if (S.readMode === 'speech' && S.current && sc.querySelector('.folio[data-id]'))
    S.speechScroll = { id: S.current.id, top: sc.scrollTop };
  if (S.readMode !== 'careo') C.prevWide = app.classList.contains('wide-reader');
  S.readMode = 'careo';
  ++S.readSeq;
  if (C.refId !== refId) {
    C.ctrl?.abort();
    Object.assign(C, { refId, res: {}, err: {}, pick: {}, swapped: false, centered: null });
  }
  app.classList.remove('no-reader');
  app.classList.add('wide-reader', 'careo-mode');
  careoLoad();
}

function leaveCareo() {
  const C = S.careo, app = $('#app');
  if (S.readMode !== 'careo') return;
  C.ctrl?.abort(); C.seq++;
  S.readMode = 'speech';
  app.classList.remove('careo-mode');
  if (!C.prevWide) app.classList.remove('wide-reader');
}


function toggleCareo() {
  if (S.readMode === 'careo') { setReadMode('speech'); return; }
  if (!S.selected) { toast('Abra primero una intervención.'); return; }
  enterCareo(S.selected);
}

async function careoLoad() {
  const C = S.careo, ref = C.refId, mode = C.mode, mine = ++C.seq;
  C.ctrl?.abort();
  const ctrl = C.ctrl = new AbortController();
  const vivo = () => mine === C.seq && S.readMode === 'careo' && C.refId === ref;
  const pide = id => (careoGet(id) ? null : careoSpeech(id, ctrl.signal).then(
    () => { delete C.err[id]; },
    e => { if (e.name !== 'AbortError') C.err[id] = e.message; }));
  careoRender();
  const deRef = pide(ref);
  const esperas = [deRef];
  if (!C.res[mode]) {
    esperas.push(api(`/careo/${ref}?mode=${mode}&top=5`, { signal: ctrl.signal })
      .then(r => { C.res[mode] = r; delete C.err[mode]; },
            e => { if (e.name !== 'AbortError') C.err[mode] = e.message; })
      .then(() => {
        if (!vivo()) return null;
        careoRender();
        const p = careoPickId();
        return p != null ? pide(p) : null;
      }));
  } else {
    const p = careoPickId();
    if (p != null) esperas.push(pide(p));
  }

  deRef?.then(() => { if (vivo()) careoRender(); });
  await Promise.all(esperas);
  if (vivo()) careoRender();
}

function careoWho(x) { return sessShortName(x) || x.label || x.speaker || ''; }

function careoCandTitle(x) {
  return [ident(x.rep_name) ? x.rep_name : (x.speaker_label || x.speaker),
    `${fechaLarga(x.date)} · sesión ${x.num_session ?? '—'} · orden ${x.official_order ?? '—'} · ${nf(x.nwords)} palabras`,
    ...(x.reasons || []).map(r => `· ${r}`)].filter(Boolean).join('\n');
}

function careoOptLabel(x) {
  const cab = S.careo.mode === 'diachronic'
    ? `${fechaCorta(x.date)} · Orden ${x.official_order ?? '—'}`
    : `Réplica: ${careoWho(x)} · Orden ${x.official_order ?? '—'}`;
  const m = (x.reasons || [])[0];
  const t = m ? `${cab} — ${m}` : cab;
  return t.length > 78 ? `${t.slice(0, 77)}…` : t;
}

function careoCandInner(x) {
  const cab = S.careo.mode === 'diachronic'
    ? `<b>${esc(fechaCorta(x.date))}</b> · ses. ${esc(x.num_session ?? '—')} · Orden ${esc(x.official_order ?? '—')}`
    : `<b>${esc(careoWho(x))}</b> · Orden ${esc(x.official_order ?? '—')}`;
  const motivos = (x.reasons || []).slice(0, 2).map(esc).join(' · ');
  return cab + (motivos ? ` <span class="careo-why">· ${motivos}</span>` : '');
}


function careoHead() {
  const en = S.readMode === 'careo', C = S.careo;
  const tit = $('#readTitle');
  if (tit) tit.textContent = en ? 'Careo' : 'Intervención';
  $('#careoModes').hidden = !en;
  $('#careoTools').hidden = !en;
  $('#careoBtn').setAttribute('aria-pressed', String(en));
  if (!en) return;
  $$('#careoModes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cmode === C.mode)));
  const res = C.res[C.mode], sel = $('#careoPick');
  const xs = res?.results || [];
  if (!xs.length) {
    sel.innerHTML = `<option>${C.err[C.mode] ? 'Sin datos' : !res ? 'Buscando réplicas…' : 'Sin réplicas propuestas'}</option>`;
    sel._key = null; sel.disabled = true; sel.title = 'Réplica propuesta (heurística)';
  } else {
    const key = `${C.refId}|${C.mode}`;
    if (sel._key !== key) {
      sel.innerHTML = xs.map(x => `<option value="${x.id}">${esc(careoOptLabel(x))}</option>`).join('');
      sel._key = key;
    }
    const pick = careoPickId();
    sel.disabled = false; sel.value = String(pick);
    const cand = xs.find(x => x.id === pick);
    sel.title = cand ? `Réplica propuesta (heurística)\n${careoCandTitle(cand)}` : '';
  }
  $('#careoSwap').disabled = !xs.length;
}

function careoBarHTML(res) {
  const C = S.careo;
  const heur = `<span class="tag careo-heur" title="${esc(res?.note
    || 'Las réplicas se proponen con una heurística: no prueban que exista un diálogo.')}">heurística</span>`;
  let body;
  if (C.err[C.mode]) {
    body = `<span class="careo-msg err">⚠ ${esc(C.err[C.mode])}</span> <button class="linkbtn" data-careo-retry>Reintentar</button>`;
  } else if (!res) {
    body = `<span class="careo-msg"><span class="spin"></span> Buscando réplicas…</span>`;
  } else if (!res.results?.length) {
    body = `<span class="careo-msg">Sin réplicas propuestas.</span>`;
  } else {
    const pick = careoPickId();
    body = res.results.map(x => `<button type="button" class="careo-cand" data-careo-pick="${x.id}"`
      + ` aria-pressed="${x.id === pick}" title="${esc(careoCandTitle(x))}">${careoCandInner(x)}</button>`).join('');
  }
  const nota = res?.note && res.results?.length ? `<div class="careo-note">${esc(res.note)}</div>` : '';
  const avisos = (res?.warnings || []).map(w => `<div class="careo-note warn">⚠ ${esc(w.message || w.code)}</div>`).join('');
  const titulo = C.mode === 'diachronic' ? 'Otras intervenciones del mismo diputado' : 'Réplicas propuestas';
  return `<div class="careo-bar"><span class="careo-bar-t">${titulo}</span>${heur}${body}${nota}${avisos}</div>`;
}


function careoFolioHTML(d, rol, cand) {
  const m = d.session_meta || null;
  const doc = d.doc || plainDoc(d.speech);
  const sp = doc.speaker || {};
  const chair = CHAIR_ROLES.has(d.role) || sp.is_chair;
  const diario = m?.has_meta && m.diario_num != null ? `${m.sigla || 'DS'} núm. ${m.diario_num}`
    : (d.session_number ? `Sesión núm. ${d.session_number}` : (d.num_session != null ? `Sesión ${d.num_session} del corpus` : ''));
  const kicker = [diario, fechaCorta(m?.date_real || d.date),
    d.official_order != null ? `Orden ${d.official_order}` : ''].filter(Boolean).join(' · ');
  const datos = [chair ? `Presidencia · ${sp.name || m?.presidente?.corto || ''}` : '',
    !chair && ident(d.party) ? d.party : '', !chair && ident(d.sex) ? (S.facets?.labels?.sex?.[d.sex] || d.sex) : '',
    !chair && ident(d.district) ? d.district : '', `${nf(d.nwords)} palabras`].filter(Boolean).join(' · ');
  let span = null;








  const terms = S.mode === 'semantic' ? [] : queryTerms(S.query, S.variants);
  const sw = d.session_warning && d.session_warning.dudosa ? d.session_warning : null;
  const avisos = warningsHTML((d.warnings || []).filter(w => w.affects_speech), sw);





  return `<article class="folio careo-folio" data-careo-id="${d.id}">
    <div class="folio-kicker">${esc(kicker)}</div>
    <h3 class="folio-title">${esc(d.speaker_label || sp.label || d.speaker)}</h3>
    ${ident(d.rep_name) && !chair ? `<div class="folio-rep">${esc(d.rep_name)}</div>` : ''}
    <div class="folio-gov">${esc(datos)}</div>
    <div class="folio-rule"></div>
    ${avisos}
    ${  '' }
    <div class="folio-body">${renderDoc(doc, d.id, { terms, raw: d.speech, span })}</div>
  </article>`;
}

function careoColHTML(rol, id, d, cand = null, res = null) {
  const C = S.careo;
  const wrap = inner => `<section class="careo-col" data-col-id="${rol}-${id ?? 'x'}"`
    + ` aria-label="${rol === 'ref' ? 'Intervención de referencia' : 'Réplica propuesta'}">${inner}</section>`;
  if (rol === 'rep') {
    if (C.err[C.mode]) return wrap(`<div class="empty"><div class="big">⚠</div><p>${esc(C.err[C.mode])}</p></div>`);
    if (!res) return wrap(`<div class="empty"><span class="spin"></span></div>`);
    if (id == null) {
      const otro = C.mode === 'synchronic' ? 'diachronic' : 'synchronic';
      const porque = C.mode === 'synchronic'
        ? 'No hay en esta sesión otras intervenciones que puedan ser réplica (de 45 palabras o más y fuera de la Presidencia).'
        : (res.note || 'No hay otras intervenciones de este diputado que comparar.');
      return wrap(`<div class="empty careo-empty"><div class="big">⚔</div><h3>Sin réplicas propuestas</h3>
        <p>${esc(porque)}</p>
        <p style="margin-top:12px"><button class="btn sm" data-careo-mode="${otro}">Probar «${
          otro === 'diachronic' ? 'Mismo diputado' : 'Misma sesión'}»</button></p></div>`);
    }
  }
  const head = `<div class="careo-colhead">${rol === 'ref'
      ? '<span class="tag star">★ Referencia</span>'
      : `<span class="tag careo-rep" title="${esc(cand ? careoCandTitle(cand) : '')}">Réplica propuesta</span>`}
    <span class="grow"></span>
    <button class="btn sm" data-careo-open="${id}" title="Abrir esta intervención sola en el lector">Abrir en el lector</button>
    <button class="btn sm" data-careo-session="${id}" title="Leer toda su sesión seguida, con esta intervención marcada">📖 Sesión corrida</button></div>`;
  if (C.err[id]) {
    return wrap(head + `<div class="empty"><div class="big">⚠</div><p>${esc(C.err[id])}</p>
      <p><button class="linkbtn" data-careo-retry>Reintentar</button></p></div>`);
  }
  if (!d) return wrap(head + `<div class="empty"><span class="spin"></span></div>`);
  return wrap(head + careoFolioHTML(d, rol, cand));
}

function careoRender() {
  const C = S.careo, sc = $('#reader');
  if (S.readMode !== 'careo') return;
  updateReadHead();

  const antes = new Map($$('.careo-col', sc).map(c => [c.dataset.colId, c.scrollTop]));
  const top = sc.scrollTop;
  const res = C.res[C.mode], cand = careoCand();
  const cols = [careoColHTML('ref', C.refId, careoGet(C.refId)),
                careoColHTML('rep', cand?.id ?? null, cand ? careoGet(cand.id) : null, cand, res)];
  if (C.swapped) cols.reverse();
  sc.innerHTML = `<div class="careo">${careoBarHTML(res)}<div class="careo-duo">${cols.join('')}</div></div>`;
  for (const c of $$('.careo-col', sc)) {
    const t = antes.get(c.dataset.colId);
    if (t) c.scrollTop = t;
  }
  sc.scrollTop = top;







}
















function careoSetMode(m) {
  if (S.readMode !== 'careo' || !['synchronic', 'diachronic'].includes(m) || S.careo.mode === m) return;
  S.careo.mode = m;
  careoLoad();
}

function careoSetPick(id) {
  if (S.readMode !== 'careo' || !Number.isFinite(id)) return;
  S.careo.pick[S.careo.mode] = id;
  careoLoad();
}

function careoSwap() {
  if (S.readMode !== 'careo') return;
  S.careo.swapped = !S.careo.swapped;
  careoRender();
}


function careoClick(e) {
  if (S.readMode !== 'careo') return false;
  const t = e.target;
  const pk = t.closest('[data-careo-pick]');
  if (pk) { careoSetPick(+pk.dataset.careoPick); return true; }
  const op = t.closest('[data-careo-open]');
  if (op) { openSpeech(+op.dataset.careoOpen, { mode: 'speech' }); return true; }
  const se = t.closest('[data-careo-session]');
  if (se) { openSpeech(+se.dataset.careoSession, { mode: 'session' }); return true; }
  const md = t.closest('[data-careo-mode]');
  if (md) { careoSetMode(md.dataset.careoMode); return true; }
  if (t.closest('[data-careo-retry]')) { S.careo.err = {}; careoLoad(); return true; }
  return false;
}















































































async function refreshCollections() {
  S.collections = (await api('/collections')).collections;
}





function setView(v, { refresh = true } = {}) {


  const conBiblioteca = S.lastMeta?.mode === 'library' || (v === 'search' && S.searchStale);
  if (v === 'search') S.searchStale = false;
  const vAntes = S.view;
  S.view = v;
  $$('.tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  // El tenido vive dentro de la biblioteca: al entrar o salir hay que repintar.
  if (vAntes !== v && S.readTema) temaRepinta(); else temaHead();


  $('#clearFilters').hidden = v !== 'search';

  qexpPintar();

  listHead();
  if (v === 'search') {
    $('#sideTitle').textContent = 'Filtros'; renderFilters();
    S.lex.ctrl?.abort(); ++S.lex.seq;
    S.coo.ctrl?.abort(); ++S.coo.seq;
    if (conBiblioteca) {

      S.lastMeta = null; S.results = []; S.total = 0; S.exhausted = true;
      $('#resultMeta').innerHTML = '<strong>—</strong>';
      $('#hits').innerHTML = `<div class="empty"><span class="spin"></span></div>`;
      if (refresh) search(true);
    } else { renderMeta(); renderHits(true); }
  }
  else { $('#spectrum').hidden = true;   renderLibraryView(); }
  trendRender();
  updateSideRail();
}




function setSideCollapsed(plegado, { guardar = true } = {}) {
  $('#app').classList.toggle('side-collapsed', plegado);
  $('#sideFold').setAttribute('aria-expanded', String(!plegado));
  $('#sideRail').setAttribute('aria-expanded', String(!plegado));
  if (guardar) { try { localStorage.setItem('panelPlegado', plegado ? '1' : '0'); } catch {   } }
  updateSideRail();
}

function sideCollapsedSaved() {
  try { return localStorage.getItem('panelPlegado') === '1'; } catch { return false; }
}

function updateSideRail() {
  const rail = $('#sideRail');
  if (!rail) return;
  const lbl = ($('#sideTitle')?.textContent || 'Filtros').trim();
  const n = S.view === 'library' ? 0 : ($('#activePills')?._fns?.length || 0);
  $('#sideRailLbl').textContent = lbl;
  const badge = $('#sideRailN');
  badge.hidden = !n; badge.textContent = n ? String(n) : '';
  const txt = `Desplegar ${lbl.toLowerCase()}${n ? ` (${n} ${n === 1 ? 'filtro activo' : 'filtros activos'})` : ''} · tecla f`;
  rail.title = txt; rail.setAttribute('aria-label', txt);
}




function setListCollapsed(plegado, { guardar = true } = {}) {
  $('#app').classList.toggle('list-collapsed', plegado);
  $('#listFold').setAttribute('aria-expanded', String(!plegado));
  $('#listRail').setAttribute('aria-expanded', String(!plegado));
  if (guardar) { try { localStorage.setItem('listaPlegada', plegado ? '1' : '0'); } catch {   } }
  updateListRail();
}

function listCollapsedSaved() {
  try { return localStorage.getItem('listaPlegada') === '1'; } catch { return false; }
}

function updateListRail() {
  const rail = $('#listRail');
  if (!rail) return;
  const n = Number(S.total) || 0;
  const badge = $('#listRailN');
  badge.hidden = !n; badge.textContent = n ? nf(n) : '';
  const txt = `Desplegar la lista${n ? ` (${nf(n)} ${n === 1 ? 'intervención' : 'intervenciones'})` : ''} · tecla l`;
  rail.title = txt; rail.setAttribute('aria-label', txt);
}



function toExplore() {
  if (S.view === 'search') return false;
  setView('search', { refresh: false });
  return true;
}



function listHead() {
  const lib = S.view === 'library';
  for (const id of ['#order', '#statsBtn', '#saveAllBtn']) $(id).hidden = lib;
  const enLib = lib && S.libSel != null;
  $('#exportBtn').textContent = enLib ? 'Exportar biblioteca' : 'Exportar';
  $('#delLibBtn').hidden = !enLib;
  $('#lexExportBtn').hidden = !(enLib && S.libTab === 'lexico' && S.lex.cid === S.libSel
    && S.lex.data && !S.lex.data.error && (S.lex.data.terms?.length || S.lex.data.negative?.length));
}

async function renderLibraryView() {
  await refreshCollections();
  $('#sideTitle').textContent = 'Bibliotecas';
  $('#activePills').hidden = true;
  listHead();
  renderLibList();

  if (S.libSel) loadLibraryItems(S.libSel);
  else {
    $('#resultMeta').innerHTML = '<strong>Bibliotecas</strong>';
    $('#hits').innerHTML = `<div class="empty"><div class="big">◆</div>
      <h3>Sus grupos de intervenciones</h3>
      <p>Una biblioteca es un conjunto curado: puede añadirle intervenciones desde
      cualquier búsqueda, anotarlas, etiquetarlas, y exportarlas a CSV, Markdown o
      referencias citables. También puede compartirla con un colega en un archivo
      <code>.2replib</code>.</p></div>`;
  }
}



function renderLibList() {


  $('#filters').innerHTML = `
    <div style="padding:13px"><button class="btn primary" id="newLibBtn" style="width:100%">+ Nueva biblioteca</button><button class="btn" id="importLibBtn" style="width:100%;margin-top:7px" title="Crear una biblioteca a partir de un archivo .2replib, con sus notas y etiquetas">Importar .2replib…</button></div>
    ${S.collections.length ? S.collections.map(c => `
      <div class="lib-card${S.libSel === c.id ? ' sel' : ''}" data-lib="${c.id}">
        <span class="lib-dot"></span>
        <div style="min-width:0;flex:1">
          <h4>${esc(c.name)}</h4>
          <p>${nf(c.n_items)} ${c.n_items === 1 ? 'intervención' : 'intervenciones'} ·
             ${esc((c.updated_at || '').slice(0, 10))}</p>
          ${notaHTML(c.description, 'lib-nota')}
        </div>
        <button type="button" class="btn ghost icon lib-ren" data-renlib="${c.id}"
          aria-label="Editar el nombre y la nota de la biblioteca «${esc(c.name)}»" title="Editar el nombre y la nota de la biblioteca «${esc(c.name)}»">✎</button>
        <button type="button" class="btn ghost icon lib-del" data-dellib="${c.id}"
          aria-label="Borrar la biblioteca «${esc(c.name)}»" title="Borrar la biblioteca «${esc(c.name)}» (pide confirmación)">🗑</button>
      </div>`).join('')
      : `<div class="empty" style="padding:26px 16px"><p>Aún no tiene bibliotecas.
          Cree una y vaya guardando en ella las intervenciones que le interesen.</p></div>`}`;

  libStorePintar();

}

async function loadLibraryItems(cid) {
  const mine = ++S.libSeq;
  S.libSel = cid;
  S.lex.ctrl?.abort(); ++S.lex.seq;
  menAbortar();
  $$('.lib-card').forEach(e => e.classList.toggle('sel', +e.dataset.lib === cid));
  listHead();
  $('#hits').innerHTML = `<div class="empty"><span class="spin"></span></div>`;
  try {
    const r = await api(`/collections/${cid}/items?limit=${LIB_PAGE}`);
    if (mine !== S.libSeq || S.view !== 'library') return;
    S.results = r.items; S.total = r.total; S.exhausted = true;
    S.lastMeta = { mode: 'library' };
    S.libInfo = { id: cid, name: r.collection?.name || '', total: r.total,
                  updated: r.collection?.updated_at || '', hash: r.ids_hash || '' };
    renderLibHead();
    if (S.libTab === 'lexico') lexLoad();
    else if (S.libTab === 'coocurrencias') cooLoad();
    else if (S.libTab === 'menciones') menLoad();
    else renderLibItems();
  } catch (e) {
    if (mine !== S.libSeq) return;
    toast(e.message, true);
    $('#hits').innerHTML = `<div class="empty"><div class="big">⚠</div><p>${esc(e.message)}</p></div>`;
  }
}


function renderLibHead() {
  const L = S.libInfo;
  if (!L || S.view !== 'library') return;
  const el = $('#resultMeta');
  el.innerHTML = `<strong class="libname" title="${esc(L.name)}">${esc(L.name)}</strong>`
    + `<div class="tseg libtabs" role="tablist" aria-label="Contenido de la biblioteca">`
    + `<button type="button" role="tab" data-libtab="items" aria-selected="${S.libTab === 'items'}"`
    + ` title="Las intervenciones guardadas, con sus notas y etiquetas">Intervenciones (${nf(L.total)})</button>`
    + `<button type="button" role="tab" data-libtab="lexico" aria-selected="${S.libTab === 'lexico'}"`
    + ` title="Términos característicos de la biblioteca frente al resto del corpus (keyness)">Léxico</button>`
    + `<button type="button" role="tab" data-libtab="coocurrencias" aria-selected="${S.libTab === 'coocurrencias'}"`
    + ` title="Red de coocurrencias de los términos del léxico y temas detectados en ella con el algoritmo de Leiden">Coocurrencias</button>`
    + `<button type="button" role="tab" data-libtab="menciones" aria-selected="${S.libTab === 'menciones'}"`
    + ` title="Personas mencionadas en las intervenciones y red de quién menciona a quién">Menciones</button></div>`
    + (S.libTab === 'lexico' || S.libTab === 'coocurrencias'
      ? `<label class="chk lex-solo" title="Excluye listas de votación, crónica del acta, acotaciones, tablas y notas">`
        + `<input type="checkbox" id="lexSolo"${S.lex.solo ? ' checked' : ''}><span class="lbl">Solo discurso</span></label>`
      : '');
  el.title = '';
  listHead();
}



function lexSoloGuardado() {
  try { return localStorage.getItem('lexSoloDiscurso') !== '0'; } catch { return true; }
}

function readTemaGuardado() {
  try { return localStorage.getItem('readTema') === '1'; } catch { return false; }
}

function readTemaMarcaGuardada() {
  try { return localStorage.getItem('readTemaMarca') === 'subrayado' ? 'subrayado' : 'fondo'; }
  catch { return 'fondo'; }
}

function lexSoloChange(e) {
  if (e.target?.id !== 'lexSolo') return;
  S.lex.solo = e.target.checked;
  try { localStorage.setItem('lexSoloDiscurso', S.lex.solo ? '1' : '0'); } catch {   }
  if (S.view === 'library' && S.libSel != null && S.libTab === 'lexico') lexLoad();
  if (S.view === 'library' && S.libSel != null && S.libTab === 'coocurrencias') cooLoad();
  if (S.view === 'library' && S.libSel != null && S.libTab === 'coocurrencias') cooLoad();
}

function libTabClick(e) {
  const b = e.target.closest('[data-libtab]');
  if (!b || S.view !== 'library' || S.libSel == null || !S.libInfo) return;
  const tab = b.dataset.libtab;
  if (tab === S.libTab) return;
  S.libTab = tab;
  renderLibHead();
  if (tab !== 'lexico') { S.lex.ctrl?.abort(); ++S.lex.seq; }
  if (tab !== 'coocurrencias') { S.coo.ctrl?.abort(); ++S.coo.seq; }
  if (tab !== 'menciones') menAbortar();
  if (tab === 'lexico') lexLoad();
  else if (tab === 'coocurrencias') cooLoad();
  else if (tab === 'menciones') menLoad();
  else renderLibItems();
}



const LIB_PAGE = 1000;

async function loadMoreLibItems() {
  const L = S.libInfo, cid = S.libSel, mine = S.libSeq;
  if (!L || cid == null || S.view !== 'library' || S.libTab !== 'items') return;
  const btn = $('#hits [data-libmore]');
  if (btn) { btn.disabled = true; btn.textContent = 'Cargando…'; }
  try {
    const r = await api(`/collections/${cid}/items?limit=${LIB_PAGE}&offset=${S.results.length}`);
    if (mine !== S.libSeq || S.view !== 'library' || S.libSel !== cid) return;
    const vistos = new Set(S.results.map(x => x.id));
    S.results = S.results.concat(r.items.filter(x => !vistos.has(x.id)));
    S.total = r.total;
    renderLibItems({ keepScroll: true });
  } catch (e) {
    toast(e.message, true);
    if (btn) { btn.disabled = false; btn.textContent = 'Reintentar'; }
  }
}

/* Una nota puede ser larga y empujar hacia abajo todo lo demás, así que a partir de cierto tamaño se pliega en un
   <details> y solo se despliega si se pide: el resumen enseña el principio en una línea y, al abrirlo, se esconde para
   no repetirlo. Una nota corta se muestra entera; plegarla molestaría más de lo que ayuda. */
const NOTA_PLIEGUE = 110;   // caracteres a partir de los cuales se pliega

function notaHTML(txt, clase) {
  const nota = String(txt == null ? '' : txt);
  if (!nota.trim()) return '';
  const unaLinea = nota.replace(/\s+/g, ' ').trim();
  if (unaLinea.length <= NOTA_PLIEGUE && !nota.includes('\n')) return `<p class="${clase}">${esc(nota)}</p>`;
  return `<details class="${clase} nota-pliega"><summary><span class="nota-ojo">${esc(unaLinea.slice(0, NOTA_PLIEGUE))}…</span>`
    + `<span class="nota-ver"></span></summary><p class="nota-todo">${esc(nota)}</p></details>`;
}

function renderLibItems({ keepScroll = false } = {}) {
  const r = { items: S.results || [] };
  const sc = listScroller(), top = sc.scrollTop;
  {
    if (!r.items.length) {
      $('#hits').innerHTML = `<div class="empty"><div class="big">◇</div>
        <h3>Biblioteca vacía</h3><p>Vaya a <b>Explorar</b>, abra una intervención y
        pulse <b>+ Biblioteca</b>. También puede guardar de golpe todos los
        resultados de una búsqueda con <b>Guardar todo</b>.</p></div>`;
      return;
    }
    $('#hits').innerHTML = r.items.map(it => `
      <article class="hit${S.selected === it.id ? ' sel' : ''}" data-id="${it.id}">
        <div class="hit-top">
          <span class="hit-name">${esc(it.rep_name && it.rep_name !== 'Sin identificar' ? it.rep_name : it.speaker)}</span>
          <span class="hit-date">${esc(it.date)}</span>
        </div>
        <div class="hit-snip">${esc(it.snippet)}</div>
        ${notaHTML(it.note, 'dsub hit-nota')}
        <div class="hit-foot">
          ${(it.tags || []).map(t => `<span class="tag sem">${esc(t)}</span>`).join('')}
          ${it.party && it.party !== 'Sin identificar' ? `<span class="tag">${esc(it.party)}</span>` : ''}
          <span class="tag words">${nf(it.nwords)} pal.</span>
          <button class="btn ghost sm" data-note="${it.id}" style="margin-left:auto"
            title="${it.note ? 'Editar o borrar la nota de esta intervención' : 'Escribir una nota para esta intervención'}">${it.note ? 'Editar nota' : 'Añadir nota'}</button>
          <button class="btn danger sm" data-rm="${it.id}">Quitar</button>
        </div>
      </article>`).join('')
      + (r.items.length < S.total
        ? `<div class="empty lib-more"><p>Se muestran ${nf(r.items.length)} de ${nf(S.total)} intervenciones.</p>
            <p style="margin-top:8px"><button class="btn sm" data-libmore>Mostrar ${nf(Math.min(LIB_PAGE, S.total - r.items.length))} más</button></p></div>`
        : '');
    sc.scrollTop = keepScroll ? top : 0;
  }
}







async function openDelLib(cid) {
  const dlg = $('#dlgDelLib');
  if (cid == null || dlg.open || dlg._busy || dlg._abriendo) return;
  dlg._abriendo = true;
  try {

    try { await refreshCollections(); } catch {   }
    const c = S.collections.find(x => x.id === cid);
    if (!c) {
      toast('Esa biblioteca ya no existe.', true);
      await libDeleted(cid);
      return;
    }
    const n = +c.n_items || 0;
    dlg._cid = cid; dlg._name = c.name;
    $('#delLibTxt').innerHTML = n
      ? `Se borrará la biblioteca <b>«${esc(c.name)}»</b> con sus <b>${nf(n)} ${n === 1 ? 'intervención guardada' : 'intervenciones guardadas'}</b>, y sus notas y etiquetas.`
      : `Se borrará la biblioteca <b>«${esc(c.name)}»</b>, que está vacía.`;
    const extra = [];
    if (S.filters.collection_id != null && +S.filters.collection_id === cid)
      extra.push('La búsqueda de Explorar está restringida a esta biblioteca: se quitará esa restricción.');
    const usan = [...(S.saved?.values() || [])].filter(s => +s.filters?.collection_id === cid).length;
    if (usan)
      extra.push(`${nf(usan)} ${usan === 1 ? 'búsqueda guardada la usa: se conserva, pero al lanzarla buscará'
        : 'búsquedas guardadas la usan: se conservan, pero al lanzarlas buscarán'} en todo el corpus.`);
    $('#delLibExtra').textContent = extra.join(' ');
    $('#delLibExp').hidden = !n;
    $('#delLibConfirm').disabled = false;
    dlg._opener = document.activeElement;
    dlg.showModal();
    dlg.querySelector('[data-close]').focus();
  } finally { dlg._abriendo = false; }
}

async function doDelLib() {
  const dlg = $('#dlgDelLib'), btn = $('#delLibConfirm');
  const cid = dlg._cid, name = dlg._name;
  if (dlg._busy || btn.disabled || cid == null) return;
  const busy = busyStart(dlg, btn, 'Borrando…');
  $('#delLibExport').disabled = true;
  let hecho = false, yaNo = false;
  try {
    await api(`/collections/${cid}`, { method: 'DELETE' });
    hecho = true;
  } catch (e) {

    if (e.status === 404) hecho = yaNo = true;
    else toast(e.message, true);
  } finally {
    busy.end(); btn.disabled = false; $('#delLibExport').disabled = false;
  }
  if (!hecho) return;
  dlg._cid = null;
  dlg.close();
  toast(yaNo ? `La biblioteca «${name}» ya no existía` : `Biblioteca «${name}» borrada`);
  await libDeleted(cid);
  delLibFoco(dlg._opener);
}







function delLibFoco(opener) {
  const visible = el => !!el && el.isConnected && !el.disabled && el.getClientRects().length > 0;
  const a = document.activeElement;
  if (a && a !== document.body && visible(a)) return;
  const destino = [opener, S.view === 'library' ? $('#newLibBtn') : $('#fLib'),
    $(`.tabs button[data-view=${S.view}]`)].find(visible);
  destino?.focus();
}



function delLibExport() {
  const dlg = $('#dlgDelLib'), cid = dlg._cid;
  if (dlg._busy || cid == null) return;
  dlg.close();
  openExport({ lib: cid, format: 'bundle', alCerrar: () => openDelLib(cid) });
}





async function libDeleted(cid) {
  S.collections = S.collections.filter(c => c.id !== cid);
  S.statsCache = null;

  for (const k of [...S.lex.cache.keys()]) if (k.split('|')[1] === String(cid)) S.lex.cache.delete(k);
  if (S.lex.cid === cid || S.libInfo?.id === cid) {
    S.lex.ctrl?.abort(); ++S.lex.seq; S.lex.data = null; S.lex.cid = null;
  }

  for (const [id, m] of Object.entries(S.membership))
    if (m.includes(cid)) S.membership[id] = m.filter(x => x !== cid);
  if (S.current?.collections?.includes(cid)) S.current.collections = S.current.collections.filter(x => x !== cid);

  if (S.libSel === cid) {
    S.libSel = null; S.libInfo = null; S.libTab = 'items'; ++S.libSeq;
    if (S.view === 'library') { S.results = []; S.total = 0; S.exhausted = true; }
  }


  const filtro = S.filters.collection_id != null && +S.filters.collection_id === cid;
  if (filtro) delete S.filters.collection_id;
  if (S.view === 'library') {
    if (filtro) S.searchStale = true;
    if (S.libSel != null) {




      try { await refreshCollections(); } catch {   }
      if (S.view === 'library') { renderLibList(); listHead(); }
    } else {
      try { await renderLibraryView(); } catch (e) { toast(e.message, true); }
    }
  } else {
    try { await refreshCollections(); } catch {   }
    renderFilters();
    if (filtro) search(true); else refreshHitMarkers();
  }

  if (S.readMode === 'speech' && S.current && S.current.id === S.selected) renderReader(S.current, { restore: true });
}





const LEX_FIRST = 300;
const LEX_BADGE = { Exclusivo: 'ex', 'Muy distintivo': 'md', Significativo: 'sg' };

const LEX_EXCL = [['listas', 'listas de votación'], ['cronica', 'crónica del acta'], ['acotaciones', 'acotaciones'],
  ['tablas', 'tablas'], ['notas', 'notas'], ['cabeceras', 'cabeceras de página'], ['etiquetas', 'etiquetas de orador'],
  ['otros', 'otros']];
const lexDesglose = (tx, fmt = nf) => LEX_EXCL.filter(([k]) => +tx?.excluidos?.[k] > 0)
  .map(([k, lab]) => `${lab} ${fmt(tx.excluidos[k])}`).join(', ');

function lexNum(v, dec) {
  if (v == null || !isFinite(v)) return '—';
  return agrupa(Math.abs(+v).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
}
const lexSigned = (v, dec) => (v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${lexNum(v, dec)}`);
const lexPm = v => lexNum(v, v != null && Math.abs(v) < 0.1 ? 3 : 2);

async function lexLoad() {
  const L = S.libInfo, X = S.lex, box = $('#hits');
  if (!L || S.view !== 'library' || S.libTab !== 'lexico') return;


  const key = `${S.info?.name || ''}|${L.id}|${L.total}|${L.hash || L.updated}|${X.solo ? 'discurso' : 'completo'}`;
  X.ctrl?.abort();
  const mine = ++X.seq;
  if (X.cid !== L.id) X.showAll = false;
  if (!L.total) {
    X.data = null; X.cid = L.id; listHead();
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Biblioteca vacía</h3>
      <p>El léxico compara el vocabulario de la biblioteca con el resto del corpus. Añada
      intervenciones desde <b>Explorar</b> con <b>+ Biblioteca</b> o <b>Guardar todo</b>.</p></div>`;
    return;
  }
  if (X.cache.has(key)) { X.data = X.cache.get(key); X.cid = L.id; lexRender(); return; }
  X.data = null; X.cid = null; listHead();
  const t0 = performance.now();
  box.innerHTML = `<div class="empty lex-prog" role="status" aria-live="polite">
    <p>Calculando el léxico ${X.solo ? '(solo discurso)' : '(texto completo)'} de ${nf(L.total)} ${L.total === 1 ? 'intervención' : 'intervenciones'}
    frente al resto del corpus…</p>
    <div class="bar" role="progressbar" aria-label="Progreso del léxico" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
    <p class="lex-prog-fase">Preparando…</p>
    <p class="lex-prog-t dsub">0 % · 0 s</p>
    <p style="margin-top:10px"><button class="btn sm" data-lexcancel>Cancelar</button></p>
    ${X.solo && L.total > 1500
      ? `<p class="dsub" style="margin-top:8px;font-size:11.5px">Se separa el discurso de listas, crónica y acotaciones antes de contar; en bibliotecas grandes tarda unos segundos.</p>` : ''}</div>`;
  let ultimoEv = null;
  const pintaProgreso = (ev) => {
    if (mine !== X.seq) return;
    const bar = box.querySelector('.lex-prog');
    if (!bar) return;
    if (ev) ultimoEv = ev;
    const e = ultimoEv;
    const s = (performance.now() - t0) / 1000;
    const pct = e ? Math.round(Math.max(0, Math.min(1, e.fraccion || 0)) * 100) : 0;
    bar.querySelector('.bar i').style.width = `${pct}%`;
    bar.querySelector('.bar').setAttribute('aria-valuenow', String(pct));
    if (e) {
      const cuenta = e.total > 1 ? ` · ${nf(e.hecho)} de ${nf(e.total)}` : '';
      bar.querySelector('.lex-prog-fase').textContent = `${e.indice}/${e.n_fases} · ${e.etiqueta}${cuenta}`;
    }
    const eta = e && e.fraccion > 0.08 && e.fraccion < 1 ? s / e.fraccion - s : null;
    bar.querySelector('.lex-prog-t').textContent = `${pct} % · ${Math.round(s)} s${eta != null ? ` · quedan unos ${Math.max(1, Math.round(eta))} s` : ''}`;
  };
  const reloj = setInterval(() => pintaProgreso(null), 500);
  const ctrl = X.ctrl = new AbortController();
  try {
    const r = await api(`/collections/${L.id}/keyness?limit=2000&limit_negative=200&solo_discurso=${X.solo}`,
      { signal: ctrl.signal, alProgreso: pintaProgreso });
    clearInterval(reloj);
    if (mine !== X.seq || S.view !== 'library' || S.libSel !== L.id || S.libTab !== 'lexico') return;
    if (!r.error) {
      X.cache.set(key, r);
      if (X.cache.size > 8) X.cache.delete(X.cache.keys().next().value);
    }
    X.data = r; X.cid = L.id;
    lexRender();
  } catch (e) {
    clearInterval(reloj);
    if (mine !== X.seq) return;
    if (e.name === 'AbortError') {
      if (S.view === 'library' && S.libTab === 'lexico' && box.querySelector('.lex-prog')) {
        box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Cálculo cancelado</h3>
          <p>Puede volver a lanzarlo cuando quiera.</p><p style="margin-top:10px"><button class="btn sm" data-lexretry>Calcular el léxico</button></p></div>`;
      }
      return;
    }
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>No se pudo calcular el léxico</h3>
      <p>${esc(e.message)}</p><p style="margin-top:10px"><button class="btn sm" data-lexretry>Reintentar</button></p></div>`;
  }
}

function lexRowHTML(t, gmax, r, neg = false) {
  const w = gmax > 0 ? Math.max(1, Math.min(100, Math.abs(t.g2) / gmax * 100)) : 0;
  const badge = t.badge
    ? `<span class="lex-badge ${LEX_BADGE[t.badge] || 'sg'}" title="${esc(r.badges?.[t.badge] || '')}">${esc(t.badge)}</span>`
    : (neg ? '<span class="lex-badge neg" title="Menos frecuente en la biblioteca que en el resto del corpus">Infrauso</span>' : '');


  const forma = t.display || t.term;
  const expr = t.expresion ? ` <span class="lex-expr" title="Expresión de varias palabras detectada en el corpus: se cuentan todas sus apariciones">expr.</span>` : '';
  return `<tr class="lex-row${t.expresion ? ' es-expr' : ''}" data-lexterm="${esc(forma)}" tabindex="0"
      title="Buscar «${esc(forma)}» en modo Palabras dentro de esta biblioteca${forma !== t.term ? ` (índice: ${esc(t.term)})` : ''}">
    <td class="lex-term">${esc(forma)}${expr}</td>
    <td class="num">${nf(t.freq)}</td>
    <td class="num">${lexPm(t.pm)}</td>
    <td class="num c-ref">${lexPm(t.pm_ref)}</td>
    <td class="lex-g2"><span class="kbar${neg ? ' neg' : ''}"><i style="width:${w.toFixed(1)}%"></i></span><span class="num">${lexSigned(t.g2, 1)}</span></td>
    <td class="num c-lr">${lexSigned(t.log_ratio, 2)}</td>
    <td>${badge}</td></tr>`;
}

function lexTableHTML(rows, gmax, r, neg = false) {
  const n = r.notes || {};
  return `<div class="lex-wrap"><table class="lex-table">
    <thead><tr><th>Término</th>
      <th class="num" title="Apariciones en la biblioteca">Frec.</th>
      <th class="num" title="Apariciones por cada 1.000 palabras de la biblioteca">‰ biblioteca</th>
      <th class="num c-ref" title="Apariciones por cada 1.000 palabras del resto del corpus">‰ resto corpus</th>
      <th title="${esc(n.g2 || '')}">Keyness G²</th>
      <th class="num c-lr" title="${esc(n.log_ratio || '')}">Log-ratio</th>
      <th>Distintividad</th></tr></thead>
    <tbody>${rows.map(t => lexRowHTML(t, gmax, r, neg)).join('')}</tbody></table></div>`;
}

function lexRender({ keepScroll = false } = {}) {
  const r = S.lex.data, L = S.libInfo, box = $('#hits'), sc = listScroller();
  if (!r || !L || S.view !== 'library' || S.libTab !== 'lexico') return;
  listHead();
  const top = sc.scrollTop;
  if (r.error) {
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>No se pudo calcular el léxico</h3><p>${esc(r.error)}</p></div>`;
    return;
  }
  if (!r.n_texts) {
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Sin texto que analizar</h3>
      <p>Ninguna intervención de esta biblioteca está en el corpus abierto.</p></div>`;
    return;
  }
  const m = r.metrics || {}, n = r.notes || {};
  const terms = r.terms || [], neg = r.negative || [];
  const metric = (k, v, extra = '', tit = '') => `<div class="lex-metric"${tit ? ` title="${esc(tit)}"` : ''}>`
    + `<div class="k">${k}</div><div class="v">${v}</div>${extra ? `<div class="s">${extra}</div>` : ''}</div>`;
  const millones = (+r.reference_tokens / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  const gmax = Math.max(+m.g2_max || 0, ...terms.map(t => +t.g2 || 0));
  const vistos = S.lex.showAll ? terms : terms.slice(0, LEX_FIRST);
  const faltan = r.n_found != null && r.n_requested != null && r.n_found < r.n_requested
    ? `<p class="lex-note warn">⚠ ${nf(r.n_requested - r.n_found)} de las ${nf(r.n_requested)} intervenciones guardadas no se encontraron en este corpus y no cuentan.</p>` : '';
  const recorte = r.n_positive > terms.length
    ? ` Se listan los ${nf(terms.length)} de mayor G² de ${nf(r.n_positive)}.` : '';
  const tabla = terms.length
    ? lexTableHTML(vistos, gmax, r)
      + (vistos.length < terms.length
        ? `<p class="lex-more"><button class="btn sm" data-lexmore>Mostrar los ${nf(terms.length - vistos.length)} términos restantes</button></p>` : '')
    : `<div class="empty" style="padding:26px 16px"><h3>Ningún término distintivo</h3>
        <p>Ningún término alcanza p &lt; 0,001 con al menos ${nf(r.min_freq)} apariciones.
        Con más intervenciones la comparación gana potencia.</p></div>`;
  const gneg = Math.max(0, ...neg.map(t => Math.abs(+t.g2 || 0)));
  const negativos = neg.length
    ? `<details class="lex-neg"><summary>Términos infrausados (${nf(neg.length)}${r.n_negative > neg.length ? ` de ${nf(r.n_negative)}` : ''}):
        menos frecuentes en la biblioteca que en el resto del corpus</summary>${lexTableHTML(neg, gneg, r, true)}</details>` : '';

  const tx = r.texto || null, discurso = (r.modo_texto === 'discurso' || r.modo_texto === 'discurso_rapido') && !!tx;
  const rapida = discurso && (r.modo_texto === 'discurso_rapido' || tx.segmentacion === 'rapida');
  const nInterv = `${nf(r.n_texts)} ${r.n_texts === 1 ? 'intervención' : 'intervenciones'}`;
  const desglose = discurso ? lexDesglose(tx) : '';
  const titPalabras = [n.tokens, discurso
    ? `Solo discurso${rapida ? ' (segmentación rápida)' : ''}: ${nf(tx.tokens_analizados)} de ${nf(tx.tokens_brutos)} palabras de ${nInterv}. Excluidas: ${desglose || 'ninguna'}.`
    : `Texto completo de ${nInterv}.`].filter(Boolean).join(' ');
  const modoNota = discurso
    ? `<b>Solo discurso${rapida ? ' (segmentación rápida)' : ''}</b>: se analizan ${nf(tx.tokens_analizados)} de las ${nf(tx.tokens_brutos)} palabras de ${nInterv};
       se excluyen ${nf(tx.tokens_excluidos)}${desglose ? ` (${esc(desglose)})` : ''}.${rapida
         ? ' En bibliotecas de más de 25 millones de caracteres se excluyen solo las acotaciones entre paréntesis y las líneas en mayúsculas (listas, cabeceras), sin el análisis completo del Diario.'
         : ''} `
    : `<b>Texto completo</b>: ${nInterv} enteras, incluidas listas de votación, crónica del acta, acotaciones y tablas. `;
  box.innerHTML = `<div class="lex">
    <div class="lex-metrics">
      ${metric('Palabras', nf(m.tokens), discurso ? `analizadas de ${nf(tx.tokens_brutos)}` : nInterv, titPalabras)}
      ${metric('Términos distintos', nf(m.types))}
      ${metric('TTR', lexNum(m.ttr, 3), 'depende del tamaño', n.ttr)}
      ${metric('G² máximo', `<span class="gold">${lexSigned(m.g2_max, 1)}</span>`, terms[0] ? `«${esc(terms[0].display || terms[0].term)}»` : '', n.g2)}
    </div>
    ${faltan}
    <p class="lex-note">${modoNota}Keyness G² (log-likelihood de Dunning) de cada término frente al resto del corpus
      (${esc(millones)} millones de palabras sin ${discurso ? 'el discurso analizado' : 'esta biblioteca'}). Solo términos con p &lt; 0,001
      (G² ≥ ${lexNum(r.threshold ?? 10.83, 2)}) y al menos ${nf(r.min_freq)} apariciones, sin palabras vacías:
      ${nf(r.significant)} significativos de ${nf(r.candidates)} candidatos.${recorte}
      El log-ratio mide el tamaño del efecto (cada punto duplica la frecuencia relativa). El TTR baja al
      crecer la biblioteca: compare solo bibliotecas de tamaño parecido. Las palabras son las del índice
      de búsqueda («S. S.» cuenta dos).${r.expresiones ? ` Incluye <b>expresiones de varias palabras</b>, marcadas
      <span class="lex-expr">expr.</span>: ${nf(r.expresiones.inventario)} detectadas en todo el corpus al cargarlo
      (<button type="button" class="linkbtn" data-exprrev>revisarlas</button>), de las que
      ${nf(r.expresiones.de_sobreuso)} son características de esta biblioteca. Se cuentan todas sus apariciones, igual que las
      palabras, que siguen contando también dentro de ellas: «seguridad» incluye los usos de «seguridad pública».` : ''}</p>
    ${tabla}
    ${negativos}
    <p class="lex-foot">Clic en un término (o Intro): búsqueda en modo Palabras dentro de esta biblioteca, en Explorar.${
      r.ms != null ? ` · ${nf(Math.round(r.ms))} ms` : ''}</p>
    ${fuentePieHTML('panel-fuente')}
  </div>`;
  sc.scrollTop = keepScroll ? top : 0;
}

function lexClick(e) {
  if (S.view !== 'library') return false;
  const row = e.target.closest('[data-lexterm]');
  if (row) { lexSearch(row.dataset.lexterm); return true; }
  if (e.target.closest('[data-lexmore]')) { S.lex.showAll = true; lexRender({ keepScroll: true }); return true; }
  if (e.target.closest('[data-lexretry]')) { lexLoad(); return true; }
  if (e.target.closest('[data-lexcancel]')) { S.lex.ctrl?.abort(); return true; }
  if (e.target.closest('[data-exprrev]')) { exprAbrir(); return true; }
  return false;
}

function lexKey(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest?.('[data-lexterm]');
  if (!row) return;
  e.preventDefault(); e.stopPropagation();
  lexSearch(row.dataset.lexterm);
}




// ================================================================================================ expresiones
// Revisión de las expresiones de varias palabras del corpus (worker/34a_engine__expresiones.js, rutas /expressions): lista
// con búsqueda y orden, exportación en CSV y elección de las que no deben unirse (sus palabras vuelven a contar sueltas en
// el léxico y en las coocurrencias).
const EXPR_LOTE = 200;
const EXPR_ORDENES = [['frecuencia', 'Más frecuentes'], ['g2', 'Más asociadas (G²)'], ['longitud', 'Más largas'], ['alfabetico', 'Alfabético']];
const EX_ST = { q: '', orden: 'frecuencia', solo: false, filas: [], total: 0, inventario: 0, meta: null, rech: new Set(),
  rechServidor: new Set(), seq: 0, tq: null, ocupado: false };

// Las que no se unen se guardan en este navegador por corpus y se vuelven a enviar al motor al abrirlo: la base no
// cambia después de construirla.
const exprClave = () => `diarios-explorer:expresiones-rechazadas:${S.info?.corpus_bibliotecas || S.info?.name || ''}`;
function exprGuardarLocal(lista) {
  try { if (lista.length) localStorage.setItem(exprClave(), JSON.stringify(lista)); else localStorage.removeItem(exprClave()); } catch {   }
}
async function exprRestaurar() {
  let lista = null;
  try { lista = JSON.parse(localStorage.getItem(exprClave()) || 'null'); } catch { lista = null; }
  if (!Array.isArray(lista) || !lista.length) return;
  try {
    await api('/expressions/rejected', { method: 'POST', body: { rechazadas: lista } });
    S.lex.cache.clear(); S.coo.cache.clear();
  } catch {   }
}

async function exprAbrir() {
  let dlg = $('#dlgExpr');
  if (!dlg) {
    document.body.insertAdjacentHTML('beforeend', `<dialog id="dlgExpr" aria-labelledby="exprTitulo">
  <div class="dhead"><h3 id="exprTitulo">Expresiones de varias palabras del corpus</h3><p class="dsub" id="exprSub"></p></div>
  <div class="expr-barra">
    <input type="search" id="exprQ" placeholder="Buscar: seguridad, reforma…" aria-label="Buscar expresiones" autocomplete="off">
    <select id="exprOrden" aria-label="Orden">${EXPR_ORDENES.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select>
    <label class="chk"><input type="checkbox" id="exprSolo"><span class="lbl">Solo las que no se unen</span></label>
  </div>
  <div class="dbody" id="exprLista"></div>
  <div class="dfoot"><button type="button" class="btn ghost" id="exprCSV">Exportar CSV</button><span class="expr-cambios dsub" id="exprCambios"></span>
    <button type="button" class="btn" data-close>Cerrar</button><button type="button" class="btn primary" id="exprAplicar" disabled>Aplicar</button></div>
</dialog>`);
    dlg = $('#dlgExpr');
    dlg.addEventListener('click', ev => {
      if (ev.target.closest('[data-close]')) { if (!EX_ST.ocupado) dlg.close(); return; }
      if (ev.target.closest('#exprAplicar')) { exprAplicar(); return; }
      if (ev.target.closest('#exprCSV')) { exprExportar(); return; }
      if (ev.target.closest('[data-exprmas]')) { exprCargar(true); }
    });
    dlg.addEventListener('change', ev => {
      const t = ev.target;
      if (t.matches('[data-exprforma]')) {
        const f = t.dataset.exprforma;
        if (t.checked) EX_ST.rech.delete(f); else EX_ST.rech.add(f);
        t.closest('tr')?.classList.toggle('expr-no', !t.checked);
        exprCambios();
      } else if (t.id === 'exprOrden') { EX_ST.orden = t.value; exprCargar(); }
      else if (t.id === 'exprSolo') { EX_ST.solo = t.checked; exprCargar(); }
    });
    $('#exprQ').addEventListener('input', ev => {
      clearTimeout(EX_ST.tq);
      EX_ST.tq = setTimeout(() => { EX_ST.q = ev.target.value; exprCargar(); }, 250);
    });
    dlg.addEventListener('cancel', ev => { if (EX_ST.ocupado) ev.preventDefault(); });
  }
  $('#exprQ').value = EX_ST.q; $('#exprOrden').value = EX_ST.orden; $('#exprSolo').checked = EX_ST.solo;
  $('#exprLista').innerHTML = '<p class="dsub">Cargando…</p>';
  dlg.showModal();
  try {
    const r = await api('/expressions?' + new URLSearchParams({ solo: 'rechazadas', limite: '0' }));
    EX_ST.rechServidor = new Set((r.filas || []).map(x => x.forma));
    EX_ST.rech = new Set(EX_ST.rechServidor);
  } catch (e) {
    $('#exprLista').innerHTML = `<p class="dsub">No se pudo leer la lista: ${esc(e.message)}</p>`;
    return;
  }
  exprCargar();
}

async function exprCargar(mas = false) {
  const mine = ++EX_ST.seq;
  const desde = mas ? EX_ST.filas.length : 0;
  const q = new URLSearchParams({ q: EX_ST.q, orden: EX_ST.orden, limite: String(EXPR_LOTE), desde: String(desde),
    solo: EX_ST.solo ? 'rechazadas' : 'todas' });
  let r;
  try { r = await api('/expressions?' + q); } catch (e) {
    if (mine === EX_ST.seq) $('#exprLista').innerHTML = `<p class="dsub">No se pudo leer la lista: ${esc(e.message)}</p>`;
    return;
  }
  if (mine !== EX_ST.seq) return;
  if (!r.disponible) {
    EX_ST.filas = []; EX_ST.total = 0;
    $('#exprSub').textContent = '';
    $('#exprLista').innerHTML = `<p class="dsub">Esta base no tiene expresiones detectadas: se construyó sin esa fase. Vuelva a
      elegir el CSV para construirla de nuevo.</p>`;
    return;
  }
  EX_ST.filas = mas ? EX_ST.filas.concat(r.filas) : r.filas;
  EX_ST.total = r.total; EX_ST.meta = r.meta;
  if (!EX_ST.q && !EX_ST.solo) EX_ST.inventario = r.total;
  exprPintar();
}

function exprPintar() {
  const m = EX_ST.meta || {};
  $('#exprSub').innerHTML = `${nf(m.seleccionadas ?? EX_ST.inventario)} detectadas al construir la base, en ${nf(m.intervenciones)}
    intervenciones y ${nf(m.tokens_corpus)} palabras: de 2 a ${nf(m.max_tokens || 7)} palabras, al menos ${nf(m.frecuencia_minima)} apariciones
    en ${nf(m.intervenciones_minimas)} intervenciones y asociación significativa.${m.precalculada ? ` Se cargaron ya calculadas
    porque el CSV es idéntico al publicado en Dataverse${m.precalculada.origen?.dataverse?.version ? ` (versión ${esc(String(m.precalculada.origen.dataverse.version))})` : ''}:
    son las mismas que se detectarían.` : ''} Desmarque las que no deban unirse: sus palabras volverán a contar sueltas en el
    léxico y en las coocurrencias.`;
  const filas = EX_ST.filas;
  if (!filas.length) {
    $('#exprLista').innerHTML = `<p class="dsub">${EX_ST.solo ? 'Todas las expresiones se unen.' : 'Ninguna expresión contiene ese texto.'}</p>`;
    exprCambios();
    return;
  }
  const cuerpo = filas.map(x => {
    const no = EX_ST.rech.has(x.forma);
    return `<tr${no ? ' class="expr-no"' : ''}><td><input type="checkbox" data-exprforma="${esc(x.forma)}"${no ? '' : ' checked'}
      aria-label="Unir «${esc(x.mostrar)}»"></td><td class="expr-f">${esc(x.mostrar)}</td><td class="num">${nf(x.frecuencia)}</td>
      <td class="num">${nf(x.intervenciones)}</td><td class="num">${x.g2 == null ? '—' : nf(Math.round(x.g2))}</td></tr>`;
  }).join('');
  const mas = filas.length < EX_ST.total
    ? `<p class="expr-mas"><button type="button" class="btn sm" data-exprmas>Mostrar ${nf(Math.min(EXPR_LOTE, EX_ST.total - filas.length))} más</button>
       <span class="dsub">${nf(filas.length)} de ${nf(EX_ST.total)}</span></p>` : '';
  $('#exprLista').innerHTML = `<table class="expr-tabla"><thead><tr><th title="Se une en una sola unidad">unir</th><th>expresión</th>
    <th class="num">apariciones</th><th class="num">intervenciones</th><th class="num">G²</th></tr></thead><tbody>${cuerpo}</tbody></table>${mas}`;
  exprCambios();
}

function exprCambios() {
  const a = EX_ST.rech, b = EX_ST.rechServidor;
  let n = 0;
  for (const f of a) if (!b.has(f)) n++;
  for (const f of b) if (!a.has(f)) n++;
  const btn = $('#exprAplicar');
  if (btn && !EX_ST.ocupado) btn.disabled = !n;
  const t = $('#exprCambios');
  if (t) t.textContent = n ? `${nf(n)} ${n === 1 ? 'cambio' : 'cambios'} sin aplicar` : (a.size ? `${nf(a.size)} no se ${a.size === 1 ? 'une' : 'unen'}` : '');
}

async function exprAplicar() {
  const btn = $('#exprAplicar');
  if (!btn || EX_ST.ocupado) return;
  EX_ST.ocupado = true; btn.disabled = true; btn.textContent = 'Aplicando…';
  try {
    const r = await api('/expressions/rejected', { method: 'POST', body: { rechazadas: [...EX_ST.rech] } });
    EX_ST.rech = new Set(r.formas || []);
    EX_ST.rechServidor = new Set(EX_ST.rech);
    exprGuardarLocal(r.formas || []);
    S.lex.cache.clear(); S.coo.cache.clear();
    toast(r.rechazadas ? `${nf(r.rechazadas)} ${r.rechazadas === 1 ? 'expresión no se une' : 'expresiones no se unen'}: el léxico y las coocurrencias se recalculan.`
      : 'Todas las expresiones se unen de nuevo.');
    $('#dlgExpr').close();
    if (S.view === 'library' && S.libTab === 'lexico') lexLoad();
    else if (S.view === 'library' && S.libTab === 'coocurrencias') cooLoad();
  } catch (e) {
    toast(`No se pudo guardar: ${e.message}`, true);
  } finally {
    EX_ST.ocupado = false; btn.textContent = 'Aplicar'; exprCambios();
  }
}

async function exprExportar() {
  const btn = $('#exprCSV');
  if (btn._busy) return;
  btn._busy = true; btn.disabled = true;
  try {
    const q = new URLSearchParams({ q: EX_ST.q, orden: EX_ST.orden, limite: '0', solo: EX_ST.solo ? 'rechazadas' : 'todas' });
    const r = await api('/expressions?' + q);
    const m = r.meta || {};
    const meta = [
      'Explorador de Diarios de Sesiones · expresiones de varias palabras del corpus',
      `corpus: ${S.info?.title || S.info?.name || ''}`,
      `generado: ${new Date().toISOString().slice(0, 19)}`,
      `detección: ${nf(m.intervenciones)} intervenciones, ${nf(m.tokens_corpus)} palabras · de 2 a ${m.max_tokens} palabras · frecuencia mínima ${m.frecuencia_minima} en ${m.intervenciones_minimas} intervenciones · G² ≥ ${m.umbral_g2} con la última palabra · ${m.muestra_1_de > 1 ? `descubrimiento en una muestra de 1 de cada ${m.muestra_1_de} intervenciones y recuento exacto en todas` : 'recuento en todas las intervenciones'}`,
      `filtro: ${EX_ST.q ? `contienen «${EX_ST.q}»` : 'todas'}${EX_ST.solo ? ' · solo las que no se unen' : ''} · ${nf(r.total)} expresiones`,
    ];
    const cols = ['expresion', 'forma_indice', 'tokens', 'palabras_contenido', 'apariciones', 'apariciones_independientes', 'intervenciones', 'g2', 'c_value', 'se_une'];
    const filas = r.filas.map(x => [x.mostrar, x.forma, x.n_tokens, x.n_palabras, x.frecuencia, x.independiente, x.intervenciones, x.g2 ?? '', x.cvalue ?? '',
      EX_ST.rechServidor.has(x.forma) ? 'no' : 'sí']);
    const slug = foldMap(S.info?.name || 'corpus').folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'corpus';
    downloadText(csvConFuente(meta, cols, filas), `expresiones_${slug}.csv`, 'text/csv;charset=utf-8');
  } catch (e) {
    toast(`No se pudo exportar: ${e.message}`, true);
  } finally { btn._busy = false; btn.disabled = false; }
}

function lexSearch(term) {
  const cid = S.libSel;
  if (cid == null || !term) return;
  const q = /^[\p{L}\p{N}]+$/u.test(term) ? term : `"${term.replace(/"/g, '')}"`;
  S.lex.ctrl?.abort();
  resetFiltersState();
  S.filters.collection_id = cid;
  S.query = q; $('#q').value = q;
  S.variants = false; $('#variants').checked = false;
  setMode('keyword');
  setView('search', { refresh: false });
  search(true);
}




// ================================================================================================ coocurrencias
// Red de coocurrencias de los términos del léxico de la biblioteca y temas detectados con Leiden
// (worker/35b_engine__coocurrencia.js). Cada tema es un candidato: se revisa en la lista y se afinan sus términos.
const COO_UNIDADES = [
  ['intervencion', 'Intervención', 'Dos términos coocurren si aparecen en la misma intervención'],
  ['fragmento', 'Fragmentos de 20 palabras', 'Cada intervención se corta en fragmentos consecutivos de 20 palabras: dos términos coocurren si aparecen en el mismo fragmento, una relación más estrecha'],
];
const COO_RESOLUCION = [[0.6, 'menos', 'Menos temas y más amplios (resolución 0,6)'], [1, 'normal', 'Resolución 1: la modularidad clásica'],
  [1.6, 'más', 'Más temas y más finos (resolución 1,6)']];
const COO_VOCAB = [100, 250, 500], COO_VECINOS = [5, 10, 20];
const COO_ORDEN = [['g2', 'más característico'], ['peso', 'mayor peso'], ['alcance', 'mayor alcance']];

// ------------------------------------------------ colores de los temas --
// CARTOColors, de cartografia tematica, donde el problema es el mismo que aqui:
// muchas categorias cualitativas a la vez y ninguna es «mas» que otra. «Bold» en
// claro, por tener los tonos mas separados; «Safe» —derivada de los esquemas de
// Paul Tol— en oscuro, porque resiste el daltonismo y no se apaga sobre fondo
// oscuro. El claro/oscuro lo gobierna la app, como en trendPal().
// Antes se usaba TREND_PAL.series con `pal[k % 8]`, que repetia color a partir
// del noveno tema: la rejilla de parametros llega a 21, asi que se repetia a
// menudo y en silencio.
const COO_PAL = {
  light: ['#7F3C8D', '#11A579', '#3969AC', '#F2B701', '#E73F74', '#80BA5A',
          '#E68310', '#008695', '#CF1C90', '#F97B72', '#4B4B8F', '#A5AA99'],
  dark:  ['#88CCEE', '#CC6677', '#DDCC77', '#117733', '#332288', '#AA4499',
          '#44AA99', '#999933', '#882255', '#661100', '#6699CC', '#888888'],
};

// Tono OKLCH de un hex: hace falta para saber que parte de la rueda ocupan ya
// los doce de la paleta antes de anadir el decimotercero.

function cooTono(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return ((Math.atan2(B, A) * 180 / Math.PI) + 360) % 360;
}

// n colores para n temas. Los doce primeros son los de la paleta; del trece en
// adelante se anade cada tono en el hueco mas ancho que quede, asi ninguno cae
// cerca de otro ya usado. Sin repeticiones, sea cual sea el numero de temas.

function cooPaleta(n) {
  const oscuro = document.documentElement.dataset.theme === 'dark';
  const base = COO_PAL[oscuro ? 'dark' : 'light'];
  const out = base.slice(0, Math.min(n, base.length));
  const tonos = out.map(cooTono);
  const sep = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  while (out.length < n) {
    let mejor = 0, mejorD = -1;
    for (let h = 0; h < 360; h += 2) {
      const d = Math.min(...tonos.map(x => sep(h, x)));
      if (d > mejorD) { mejorD = d; mejor = h; }
    }
    tonos.push(mejor);
    out.push(`oklch(${oscuro ? '0.72 0.13' : '0.48 0.16'} ${mejor})`);
  }
  return out;
}

// --------------------------------------- terminos de los temas en el texto --
// Indice termino -> tema de la biblioteca abierta. Se rehace en cuanto cambian
// los temas —resolucion, vocabulario, vecinos o terminos excluidos— porque la
// clave es la misma que usa la cache de la pestana: las marcas del lector son
// contextuales a la biblioteca y siguen a lo que se vea en Coocurrencias.

let COO_IDX = { clave: null, ts: null, tema: null, col: null, n: 0 };


function cooIndice() {
  const X = S.coo, r = X.data;
  if (!r || !(r.comunidades || []).length) return null;
  const clave = X.cid + '|' + cooClave();
  if (COO_IDX.clave === clave) return COO_IDX;
  const tema = new Map();
  for (const nd of (r.nodos || [])) if (nd.comunidad >= 0) tema.set(nd.term, nd.comunidad);
  if (!tema.size) return null;
  COO_IDX = { clave, ts: [...tema.keys()], tema, col: cooPaleta(r.comunidades.length),
              rot: r.comunidades.map((c, k) => temaRotulo(k)), n: r.comunidades.length };
  return COO_IDX;
}

// Rangos [a, b, 't', tema, color] sobre el texto ORIGINAL: se busca en el texto
// plegado y se devuelven los indices del original, igual que termRanges.
// Los terminos se solapan y caen en temas distintos —«casas viejas» en uno y
// «casas» suelto en otro— asi que despues de recogerlos todos se resuelve por
// GANA EL MAS LARGO QUE EMPIECE ANTES. Sin esa regla «Guardia civil» se pinta
// con el color de «civil», que vive en el tema del concordato porque aparece en
// «matrimonio civil» y «registro civil»: una marca que dice algo falso.

function cooTemaRangos(raw) {
  if (!S.readTema || !raw || !temaDisponible()) return [];
  const I = cooIndice();
  if (!I) return [];
  const { folded, map } = foldMap(raw);
  const letra = (c) => /[\p{L}\p{N}]/u.test(c || '');
  const cand = [];
  for (const t of I.ts) {
    if (!t) continue;
    let i = 0;
    while ((i = folded.indexOf(t, i)) !== -1) {
      const fin = i + t.length;
      if (!letra(folded[i - 1]) && !letra(folded[fin])) cand.push([i, fin, t]);
      i += t.length;
    }
  }
  if (!cand.length) return [];
  cand.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const out = [];
  let hasta = -1;
  for (const [a, b, t] of cand) {
    if (a < hasta) continue;
    const k = I.tema.get(t);
    if (k == null) continue;
    out.push([map[a], (map[b - 1] ?? map[a]) + 1, 't', k, I.col[k] || 'currentColor']);
    hasta = b;
  }
  return out;
}

function cooExcl() {
  const X = S.coo, L = S.libInfo;
  if (L && X.excl.cid !== L.id) X.excl = { cid: L.id, aplicados: new Set(), marcados: new Set() };
  return X.excl;
}

function cooClave() {
  const X = S.coo, L = S.libInfo, E = cooExcl();
  return [S.info?.name || '', L.id, L.total, L.hash || L.updated, S.lex.solo ? 'discurso' : 'completo', X.unidad,
    X.vocabulario, X.vecinos, X.resolucion, X.expresiones ? 'expr' : 'pal', [...E.aplicados].sort().join(',')].join('|');
}

async function cooLoad() {
  const L = S.libInfo, X = S.coo, box = $('#hits');
  if (!L || S.view !== 'library' || S.libTab !== 'coocurrencias') return;
  const E = cooExcl();
  const key = cooClave();
  X.ctrl?.abort();
  const mine = ++X.seq;
  if (!L.total) {
    X.data = null; X.cid = L.id; listHead();
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Biblioteca vacía</h3>
      <p>Las coocurrencias parten del léxico de la biblioteca. Añada intervenciones desde <b>Explorar</b>.</p></div>`;
    return;
  }
  if (X.cache.has(key)) { X.data = X.cache.get(key); X.cid = L.id; cooRender(); return; }
  X.data = null; X.cid = null; listHead();
  const t0 = performance.now();
  box.innerHTML = `<div class="empty lex-prog" role="status" aria-live="polite">
    <p>Construyendo la red de coocurrencias de ${nf(L.total)} ${L.total === 1 ? 'intervención' : 'intervenciones'}…</p>
    <div class="bar" role="progressbar" aria-label="Progreso de las coocurrencias" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
    <p class="lex-prog-fase">Preparando…</p>
    <p class="lex-prog-t dsub">0 % · 0 s</p>
    <p style="margin-top:10px"><button class="btn sm" data-coocancel>Cancelar</button></p>
    <p class="dsub" style="margin-top:8px;font-size:11.5px">Si ya calculó el léxico de esta biblioteca con el mismo ajuste de «Solo discurso», se reutiliza.</p></div>`;
  let ultimoEv = null;
  const pinta = (ev) => {
    if (mine !== X.seq) return;
    const bar = box.querySelector('.lex-prog');
    if (!bar) return;
    if (ev) ultimoEv = ev;
    const e = ultimoEv, sg = (performance.now() - t0) / 1000;
    const pct = e ? Math.round(Math.max(0, Math.min(1, e.fraccion || 0)) * 100) : 0;
    bar.querySelector('.bar i').style.width = `${pct}%`;
    bar.querySelector('.bar').setAttribute('aria-valuenow', String(pct));
    if (e) bar.querySelector('.lex-prog-fase').textContent = `${e.indice}/${e.n_fases} · ${e.etiqueta}${e.total > 1 ? ` · ${nf(e.hecho)} de ${nf(e.total)}` : ''}`;
    const eta = e && e.fraccion > 0.08 && e.fraccion < 1 ? sg / e.fraccion - sg : null;
    bar.querySelector('.lex-prog-t').textContent = `${pct} % · ${Math.round(sg)} s${eta != null ? ` · quedan unos ${Math.max(1, Math.round(eta))} s` : ''}`;
  };
  const reloj = setInterval(() => pinta(null), 500);
  const ctrl = X.ctrl = new AbortController();
  const qs = new URLSearchParams({ solo_discurso: String(S.lex.solo), unidad: X.unidad, vocabulario: String(X.vocabulario),
    vecinos: String(X.vecinos), resolucion: String(X.resolucion), expresiones: String(X.expresiones) });
  if (E.aplicados.size) qs.set('excluir', [...E.aplicados].join(','));
  try {
    const r = await api(`/collections/${L.id}/cooccurrence?${qs}`, { signal: ctrl.signal, alProgreso: pinta });
    clearInterval(reloj);
    if (mine !== X.seq || S.view !== 'library' || S.libSel !== L.id || S.libTab !== 'coocurrencias') return;
    if (!r.error) {
      X.cache.set(key, r);
      if (X.cache.size > 8) X.cache.delete(X.cache.keys().next().value);
    }
    X.data = r; X.cid = L.id;
    cooRender();
  } catch (e) {
    clearInterval(reloj);
    if (mine !== X.seq) return;
    if (e.name === 'AbortError') {
      if (S.view === 'library' && S.libTab === 'coocurrencias' && box.querySelector('.lex-prog')) {
        box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Cálculo cancelado</h3>
          <p>Puede volver a lanzarlo cuando quiera.</p><p style="margin-top:10px"><button class="btn sm" data-cooretry>Calcular las coocurrencias</button></p></div>`;
      }
      return;
    }
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>No se pudo construir la red</h3>
      <p>${esc(e.message)}</p><p style="margin-top:10px"><button class="btn sm" data-cooretry>Reintentar</button></p></div>`;
  }
}

/** Vecinos más fuertes de cada término (para el título de su etiqueta). */
function cooVecinos(r) {
  if (r._vecinos) return r._vecinos;
  const v = r.nodos.map(() => []);
  for (const a of r.aristas || []) { v[a.a].push([a.fuerza, a.b]); v[a.b].push([a.fuerza, a.a]); }
  r._vecinos = v.map(l => l.sort((x, y) => y[0] - x[0]).slice(0, 6).map(([, i]) => r.nodos[i].display));
  return r._vecinos;
}

/** Cómo se leen las barras de partido de los temas; vacío si la biblioteca no trae partidos. */
function cooNotaPartidos(r) {
  const lib = r.partidos;
  if (!lib?.palabras || !(r.comunidades || []).some(c => c.partidos?.palabras)) return '';
  const falta = (lib.palabras_totales || 0) - lib.palabras;
  return `<p class="lex-note">En cada tema, el eje sitúa a los partidos por la frecuencia con la que usan su vocabulario:
    palabras del tema por cada mil suyas, en veces la media de la biblioteca, que es el centro del eje. Como es una tasa,
    no depende de cuánto hable el partido. Están todos los que dicen al menos el 1 % de las palabras de la biblioteca y
    de los que cabría esperar cinco palabras del tema o más —por debajo de eso ni el exceso ni la falta dicen nada—, y
    llevan nombre los que más se apartan de la media <b>en cualquiera de los dos sentidos</b>: un tema del que un partido
    no habla dice tanto como uno del que habla el doble. Los demás puntos guardan sus cifras en el título. La escala es
    logarítmica, así que la mitad y el doble quedan a la misma distancia del centro.
    ${falta > 0 ? `Cuentan las ${nf(lib.palabras)} palabras con partido; ${nf(falta)} no lo traen.` : ''}</p>`;
}

/** Peso de cada partido en el tema como frecuencia relativa: palabras del vocabulario del tema por cada mil palabras
 *  suyas, en veces la media de la biblioteca. Un punto por partido sobre un eje logarítmico centrado en la media, con
 *  todos los que se pueden comparar; el nombre va a los que más se apartan, por arriba o por abajo, porque la ausencia
 *  marcada informa tanto como el exceso. */
function cooPartidosHTML(r, c) {
  const lib = r.partidos, rep = c.partidos;
  if (!lib?.palabras || !rep?.palabras) return '';
  const tasaLib = 1000 * rep.palabras / lib.palabras;              // media de la biblioteca para este tema
  const enTema = new Map(rep.lista.map(x => [x.p, x]));
  const minPal = 0.01 * lib.palabras;                              // menos del 1 % de las palabras: la tasa no dice nada
  const conPeso = lib.lista.filter(x => x.pal >= minPal);
  const cand = conPeso.map(x => {
    const t = enTema.get(x.p), tok = t ? t.pal : 0, esperado = tasaLib * x.pal / 1000;
    // el cero no tiene logaritmo: se sitúa con media palabra, que es lo más que se puede afirmar de una ausencia
    return { p: x.p, n: t ? t.n : 0, tok, pal: x.pal, esperado, tasa: 1000 * tok / x.pal,
      veces: esperado > 0 ? (tok || 0.5) / esperado : 1 };
  }).filter(x => x.esperado >= 5);                                 // con menos no se distingue el exceso de la falta
  if (!cand.length) return '';
  const lejos = (f) => Math.abs(Math.log(f.veces));
  const orden = new Map(cand.slice().sort((a, b) => lejos(b) - lejos(a)).map((f, k) => [f.p, k]));   // a quién etiquetar antes
  const dec = (x, d = 1) => x.toFixed(d).replace('.', ',');
  const K = Math.max(2, Math.ceil(Math.max(...cand.map(f => Math.max(f.veces, 1 / f.veces)))));
  const x = (v) => `${Math.max(0, Math.min(100, 50 + 50 * Math.log(v) / Math.log(K))).toFixed(2)}%`;
  const ticks = [];
  for (let k = 2; k <= K; k++) ticks.push(`<span class="coo-eje-t" style="left:${x(k)}"></span>`, `<span class="coo-eje-t" style="left:${x(1 / k)}"></span>`);
  const puntos = cand.slice().sort((a, b) => a.veces - b.veces).map(f => {
    const ficha = `<div><b>${esc(f.p)}</b> <em>${f.tok ? `${dec(f.veces, 2)}×` : 'ninguna palabra del tema'}</em>`
      + `${f.tok ? ` la media (${dec(f.tasa)} por mil frente a ${dec(tasaLib)})` : ''} · ${nf(f.tok)} de las ${nf(rep.palabras)}`
      + ` palabras del tema, cabría esperar ${nf(Math.round(f.esperado))} · ${nf(f.n)} ${f.n === 1 ? 'intervención' : 'intervenciones'}`
      + ` · ${nf(f.pal)} palabras en la biblioteca</div>`;
    return `<span class="coo-eje-p" data-prio="${orden.get(f.p)}" style="left:${x(f.veces)}" data-tip="${esc(ficha)}">`
      + `<b class="coo-eje-n">${esc(f.p)} <em>${f.tok ? `${dec(f.veces)}×` : '0'}</em></b><i class="coo-eje-d"></i></span>`;
  }).join('');
  const fuera = conPeso.length - cand.length;
  const leyenda = cand.slice().sort((a, b) => lejos(b) - lejos(a)).slice(0, 4)
    .map(f => `${f.p} ${f.tok ? `${dec(f.veces)} veces la media` : 'ninguna palabra del tema'}`).join('; ');
  return `<div class="coo-eje" role="img" aria-label="${esc(`${cand.length} partidos por su uso del vocabulario del tema; los que más se apartan de la media: ${leyenda}`)}">
      <span class="coo-eje-linea"></span>${ticks.join('')}
      <span class="coo-eje-media" style="left:50%"><b>media</b></span>
      ${puntos}
    </div>${fuera > 0 ? `<div class="coo-pmas">fuera del eje, ${nf(fuera)} ${fuera === 1 ? 'partido' : 'partidos'} de los que cabría esperar menos de cinco palabras del tema</div>` : ''}`;
}

/** Coloca las etiquetas del eje sin que se pisen (hay que medirlas ya pintadas), empezando por los partidos que más se
 *  apartan de la media: la que choca sube a una segunda altura y, si ahí tampoco cabe, el punto se queda sin etiqueta y
 *  sus cifras siguen en su título. */
function cooEjesAjustar(box) {
  for (const eje of box.querySelectorAll('.coo-eje')) {
    const ps = [...eje.querySelectorAll('.coo-eje-p')];
    const puestos = [[], []];
    const libre = (nivel, a, b) => puestos[nivel].every(([c, d]) => b <= c || a >= d);
    let doble = false;
    const W = eje.clientWidth;
    for (const p of ps.slice().sort((a, b) => (+a.dataset.prio || 0) - (+b.dataset.prio || 0))) {
      p.classList.remove('alto', 'muda');
      const n = p.querySelector('.coo-eje-n');
      // Se mide el rotulo, no el punto: en la rejilla el ancho del grupo es el del
      // mayor de los dos. Las transformaciones no entran en offsetLeft/offsetWidth,
      // asi que medir despues de haber desplazado sigue dando la posicion real.
      const w = (n ? n.offsetWidth : p.offsetWidth), cx = p.offsetLeft;
      // Los de los extremos se salian de la caja del eje: en vez de ocultarlos, el
      // rotulo se corre hacia dentro lo justo. El punto se queda donde le toca, que
      // es lo que codifica el dato; el rotulo solo lo nombra.
      let dx = 0;
      if (cx - w / 2 < 0) dx = w / 2 - cx;
      else if (cx + w / 2 > W) dx = W - cx - w / 2;
      if (n) n.style.transform = dx ? `translateX(${Math.round(dx)}px)` : '';
      const a = cx - w / 2 + dx, b = cx + w / 2 + dx;
      const nivel = libre(0, a, b) ? 0 : (libre(1, a, b) ? 1 : -1);
      if (nivel < 0) { p.classList.add('muda'); continue; }
      if (nivel === 1) { p.classList.add('alto'); doble = true; }
      puestos[nivel].push([a, b]);
    }
    eje.classList.toggle('doble', doble);
    eje.classList.toggle('muchos', ps.length > 8);
    cooEjeFicha(eje, ps);
  }
}

/** Ficha del eje: el `title` del navegador tarda casi un segundo y solo alcanza al punto de encima cuando se solapan.
 *  Esta sigue al cursor sin espera y describe el punto más cercano y los que estén pegados a él, así que ninguno queda
 *  inalcanzable por muy juntos que caigan. */
// La colocacion mide las etiquetas ya pintadas, asi que depende del ancho: al
// plegar un panel o cambiar la ventana hay que rehacerla, o el eje se queda con
// las etiquetas que cabian en el ancho anterior —ocultando algunas que ya caben—.
// Mismo patron que la red de menciones: ResizeObserver con un cuadro de espera.
let COO_RO = null;
function cooEjesVigilar(box) {
  if (COO_RO) { COO_RO.disconnect(); COO_RO = null; }
  if (!window.ResizeObserver || !box.querySelector('.coo-eje')) return;
  let ancho = box.clientWidth;
  // Sin requestAnimationFrame: el navegador lo congela con la pestana oculta y el
  // reajuste no llegaba nunca. ResizeObserver ya agrupa por fotograma, y el guardia
  // del ancho impide que los cambios de clase se realimenten.
  COO_RO = new ResizeObserver(() => {
    if (!box.isConnected || box.clientWidth === ancho) return;
    ancho = box.clientWidth;
    cooEjesAjustar(box);
  });
  COO_RO.observe(box);
}

function cooEjeFicha(eje, ps) {
  // La colocacion se rehace en cada cambio de ancho, pero el cableado no: sin este
  // guardia cada reajuste dejaba otra ficha y otros cuatro escuchadores en el eje.
  if (eje.querySelector('.coo-tip')) return;
  const tip = document.createElement('div');
  tip.className = 'coo-tip';
  tip.hidden = true;
  eje.append(tip);
  // Las posiciones se miden al entrar, no una sola vez: los puntos van en %, asi
  // que al plegar un panel o cambiar el ancho el eje se reajusta y un offsetLeft
  // guardado al construirlo deja de corresponder con lo que se ve. El sintoma es
  // que la ficha describe a otro partido, o no sale.
  const puntos = ps.map(p => ({ p, x: 0, tip: p.dataset.tip || '' }));
  let caja = null, ultima = null;
  const medir = () => {
    caja = eje.getBoundingClientRect();
    for (const q of puntos) q.x = q.p.offsetLeft;
    ultima = null;
  };
  const esconder = () => {
    tip.hidden = true;
    ultima = null;
    for (const q of puntos) q.p.classList.remove('bajo');
  };
  const mover = (e) => {
    if (!caja) medir();
    const px = e.clientX - caja.left;
    let cerca = Infinity;
    for (const q of puntos) cerca = Math.min(cerca, Math.abs(q.x - px));
    if (cerca > 24) { esconder(); return; }                        // lejos de todos: sin ficha
    const juntos = puntos.filter(q => Math.abs(q.x - px) <= cerca + 6);
    const clave = juntos.map(q => q.x).join(' ');
    if (clave !== ultima) {                                        // solo se rehace cuando cambia a quién describe
      ultima = clave;
      tip.innerHTML = juntos.map(q => q.tip).join('');
      for (const q of puntos) q.p.classList.toggle('bajo', juntos.includes(q));
    }
    tip.hidden = false;
    const w = tip.offsetWidth;
    tip.style.left = `${Math.round(Math.max(0, Math.min(caja.width - w, px - w / 2)))}px`;
  };
  eje.addEventListener('pointerenter', medir);
  eje.addEventListener('pointermove', mover);
  eje.addEventListener('pointerdown', mover);                      // en pantalla táctil, al tocar
  eje.addEventListener('pointerleave', esconder);
}

/** Una intervención jerarquizada: orador, fecha, partido, longitud, barra de puntuación y términos que la sostienen. */
function cooLectFila(r, x, k, maxP, col = null) {
  const m = (r.lectura && r.lectura.metadatos && r.lectura.metadatos[x.id]) || {};
  const quien = ident(m.rep_name) ? m.rep_name : (m.speaker || 'Sin orador');
  const pct = maxP > 0 ? Math.max(3, Math.round(100 * x.puntuacion / maxP)) : 0;
  const terms = (x.terminos || []).slice(0, 5).map(t => `${esc(t.display)}<sup>${nf(t.tf)}</sup>`).join(' ');
  return `<li class="coo-lf" data-cooopen="${x.id}" role="button" tabindex="0" title="Abrir en el lector">
    <span class="coo-lf-n">${k + 1}</span>${col ? `<i class="coo-dot" style="--c:${col}"></i>` : ''}
    <span class="coo-lf-q">${esc(quien)}</span>
    <span class="coo-lf-m">${esc(m.date ? fechaCorta(m.date) : '')}${ident(m.party) ? ` · ${esc(m.party)}` : ''} · ${nf(x.palabras)} palabras</span>
    <span class="coo-lf-b" title="Puntuación ${String(x.puntuacion).replace('.', ',')}"><i style="width:${pct}%"></i></span>
    <span class="coo-lf-t">${terms}</span></li>`;
}

function cooLecturaHTML(r) {
  const X = S.coo, lec = r.lectura || {};
  const pal = trendPal().series;
  const paleta = cooPaleta((r.comunidades || []).length);
  const variada = X.lectModo === 'variada';
  const lista = (variada ? lec.variada : lec.global) || [];
  if (!lista.length) return '';
  const vistos = lista.slice(0, X.lectN);
  const maxP = Math.max(...lista.map(x => x.puntuacion));
  const modos = [['variada', 'Variada por tema', 'La mejor de cada tema, por turnos: cubre todos los temas de la biblioteca'],
                 ['global', 'Más informativas', 'Las que más vocabulario característico de la biblioteca concentran, sin mirar el tema']]
    .map(([v, l, t]) => `<button type="button" data-coolect="${v}" aria-pressed="${X.lectModo === v}" title="${esc(t)}">${l}</button>`).join('');
  return `<section class="coo-leer">
    <div class="coo-cab"><h4>Leer primero</h4><div class="tseg" role="group" aria-label="Criterio de lectura">${modos}</div></div>
    <p class="lex-note">Intervenciones de la biblioteca ordenadas por lo que concentran de su vocabulario característico
      (BM25 con cada término pesado por su G² en el léxico, con saturación por repetición y corrección por longitud).
      ${variada ? 'El punto de color indica el tema del que sale cada una.' : ''}</p>
    <ol class="coo-lista">${vistos.map((x, k) => cooLectFila(r, x, k, maxP, variada ? (paleta[x.tema] || pal[x.tema % pal.length]) : null)).join('')}</ol>
    ${lista.length > vistos.length ? `<p class="lex-more"><button class="btn sm" data-coomas>Mostrar ${nf(Math.min(lista.length - vistos.length, 20))} más de ${nf(lista.length)}</button></p>` : ''}
  </section>`;
}

function cooRender() {
  const r = S.coo.data, L = S.libInfo, box = $('#hits'), sc = listScroller();
  if (!r || !L || S.view !== 'library' || S.libTab !== 'coocurrencias') return;
  listHead();
  // Las marcas del lector son contextuales a la biblioteca: si aqui cambian los
  // temas —resolucion, vocabulario, vecinos o terminos excluidos— el texto
  // pintado tiene que cambiar con ellos, no quedarse con la particion anterior.
  if (S.readTema) temaRepinta(); else temaHead();
  const top = sc.scrollTop;
  if (r.error) {
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>No se pudo construir la red</h3><p>${esc(r.message || r.error)}</p>
      <p style="margin-top:10px"><button class="btn sm" data-cooretry>Reintentar</button></p></div>`;
    return;
  }
  const X = S.coo, E = cooExcl(), p = r.parametros || {}, st = r.estadisticas || {}, voc = r.vocabulario || {};
  const seg = (attr, cur, opts) => opts.map(([v, lab, tit]) =>
    `<button type="button" data-${attr}="${esc(String(v))}" aria-pressed="${String(v) === String(cur)}"${tit ? ` title="${esc(tit)}"` : ''}>${esc(lab)}</button>`).join('');
  const sel = (attr, cur, opts, fmt = x => nf(x)) => `<select data-coo="${attr}">${opts.map(v =>
    `<option value="${v}"${Number(v) === Number(cur) ? ' selected' : ''}>${fmt(v)}</option>`).join('')}</select>`;
  const controles = `<div class="coo-ctl">
      <div class="tseg" role="group" aria-label="Unidad de contexto">${seg('coounidad', X.unidad, COO_UNIDADES)}</div>
      <label class="tsel" title="Cuántos términos del léxico, de más a menos característicos, entran en la red">Términos ${sel('vocabulario', X.vocabulario, COO_VOCAB)}</label>
      <label class="tsel" title="Conexiones que conserva cada término: las de mayor G² entre las significativas">Vecinos ${sel('vecinos', X.vecinos, COO_VECINOS)}</label>
      <span class="tsel">Temas</span><div class="tseg" role="group" aria-label="Número de temas">${seg('cooresol', X.resolucion, COO_RESOLUCION)}</div>
      <label class="chk tchk" title="Une las expresiones de varias palabras detectadas en el corpus («seguridad pública», «régimen de excepción») en un solo nodo: sus palabras dejan de contar sueltas"><input type="checkbox" data-cooexpr${X.expresiones ? ' checked' : ''}><span>expresiones</span></label>
    </div>`;
  if (r.aviso || !(r.comunidades || []).length) {
    box.innerHTML = `<div class="lex coo">${controles}<div class="empty" style="padding:26px 16px"><h3>Sin red de coocurrencias</h3>
      <p>${esc(r.aviso || 'Ninguna pareja de términos alcanza la significación exigida en esta biblioteca.')}</p></div></div>`;
    return;
  }
  const metric = (k, v, extra = '', tit = '') => `<div class="lex-metric"${tit ? ` title="${esc(tit)}"` : ''}>`
    + `<div class="k">${k}</div><div class="v">${v}</div>${extra ? `<div class="s">${extra}</div>` : ''}</div>`;
  const unidades = p.unidad === 'fragmento' ? `${nf(st.n_unidades)} fragmentos` : `${nf(st.n_unidades)} intervenciones`;
  const metricas = `<div class="lex-metrics">
      ${metric('Temas', nf(st.n_comunidades), 'comunidades de Leiden')}
      ${metric('Términos', nf(voc.usados), `de ${nf(voc.disponibles)} del léxico`, 'Términos de sobreuso del léxico, de más a menos característicos, sin palabras vacías ni cifras')}
      ${metric('Conexiones', nf(st.aristas_conservadas), `de ${nf(st.aristas_significativas)} significativas`, `Pares con asociación positiva y G² ≥ ${String(p.g2_min).replace('.', ',')} (p < 0,001); se conservan los ${nf(p.vecinos)} vecinos de mayor G² de cada término`)}
      ${metric('Modularidad', String(st.modularidad).replace('.', ','), unidades, 'Modularidad de la partición final (resolución 1). Por encima de 0,3 suele indicar una estructura de comunidades clara')}
      ${st.pct_sin_tema == null ? '' : metric('Sin tema', `${String(st.pct_sin_tema).replace('.', ',')} %`, 'del texto', 'Palabras de las intervenciones que ningún tema domina: las que no alcanzan dos términos de un mismo tema o empatan entre varios. Los pesos de los temas suman el resto.')}
    </div>`;
  const vac = p.vacias || {};
  const descart = [voc.descartados?.vacias ? `${nf(voc.descartados.vacias)} palabras vacías (${esc(vac.fuente || '')}, ${vac.lengua === 'pt' ? 'portugués' : 'español'})` : '',
    voc.descartados?.cifras ? `${nf(voc.descartados.cifras)} cifras` : '',
    voc.descartados?.excluidos ? `${nf(voc.descartados.excluidos)} términos excluidos por usted` : ''].filter(Boolean).join(', ');
  const nota = `<p class="lex-note">Cada tema es una comunidad de la red: los términos más característicos del léxico, unidos cuando
      aparecen juntos en ${p.unidad === 'fragmento' ? `el mismo fragmento de ${nf(p.fragmento)} palabras` : 'la misma intervención'} más de lo esperable por azar,
      y agrupados con el algoritmo de Leiden, que garantiza que cada tema esté conectado. Son <b>candidatos</b>: revíselos en la lista y
      pulse los términos que no pertenezcan para excluirlos.${p.expresiones?.unidas ? ` Las <b>expresiones</b> de varias palabras detectadas en el corpus
      (${nf(p.expresiones.inventario)}, <button type="button" class="linkbtn" data-exprrev>revisarlas</button>) cuentan como una sola unidad: «seguridad pública» es un nodo propio y sus palabras sueltas solo cuentan fuera de ella.` : ''}
      Al excluir términos la red cambia y dos temas pueden fundirse o uno partirse:
      si ve fundidos dos temas distintos, pida <b>más</b> temas; si ve uno partido, <b>menos</b>.${descart ? ` Se descartaron ${descart}.` : ''}${voc.desde_cache ? ' El léxico se reutilizó del cálculo anterior.' : ''}</p>`;
  const metodo = `<details class="lex-neg coo-metodo"><summary>Método y parámetros</summary><div class="lex-note" style="margin:8px 2px 0">
      <b>Vocabulario:</b> los ${nf(voc.usados)} términos de sobreuso del léxico de mayor G², sin las palabras vacías publicadas de la lengua del corpus
      (${esc(vac.fuente || '—')}, ${nf(vac.n || 0)} palabras, licencia ${esc(vac.licencia || '—')}${(vac.excepciones || []).length ? `; se conservan ${vac.excepciones.map(w => `«${esc(w)}»`).join(' y ')}` : ''}) ni cifras, con dígitos o con letras («treinta», «mil»). Texto: ${p.modo_texto === 'completo' ? 'completo' : 'solo discurso'}.<br>
      <b>Expresiones:</b> ${p.expresiones?.unidas ? `${nf(p.expresiones.inventario)} detectadas en todo el corpus al cargarlo (de 2 a 7 palabras, frecuentes, con asociación significativa, sin cruzar la puntuación ni las cifras y sin los trozos de secuencias más largas, como las fórmulas leídas una y otra vez); cada frase se parte en el menor número de unidades y cada expresión cuenta como una` : 'no se unen: cada palabra cuenta por separado'}.<br>
      <b>Unidad de contexto:</b> ${p.unidad === 'fragmento' ? `fragmentos consecutivos de ${nf(p.fragmento)} palabras` : 'la intervención'} (${unidades}).
      Densidad de la red antes de podar: ${String(Math.round(1000 * st.densidad) / 10).replace('.', ',')} % de los pares posibles.<br>
      <b>Asociación:</b> G² de Dunning con signo sobre la tabla 2×2 de unidades; se conservan los pares con asociación positiva y G² ≥ ${String(p.g2_min).replace('.', ',')}
      que están entre los ${nf(p.vecinos)} vecinos de mayor G² de alguno de sus términos. Peso de cada conexión: fuerza de asociación, observado/esperado (van Eck y Waltman, 2009).<br>
      <b>Comunidades:</b> Leiden (Traag, Waltman y van Eck, 2019), modularidad con resolución ${String(p.resolucion).replace('.', ',')}, semilla ${nf(p.semilla)},
      refinado voraz. Mismos parámetros, mismo resultado.<br>
      <b>Orden de los temas:</b> por el G² medio de sus términos en el léxico, es decir, de más a menos característico de la biblioteca.
      ${p.modo_texto === 'completo' ? '' : '<br><b>Revisión en la lista:</b> busca en el texto completo de las intervenciones, así que puede encontrar algunas más que la cobertura del tema, que se calcula solo sobre el discurso de los oradores.'}</div></details>`;
  const pal = trendPal().series;
  const paleta = cooPaleta((r.comunidades || []).length);
  const vecinos = cooVecinos(r);
  const marcadosN = E.marcados.size;
  const barraExcl = marcadosN || E.aplicados.size
    ? `<div class="coo-excl" role="status">${marcadosN ? `<b>${nf(marcadosN)} ${marcadosN === 1 ? 'término marcado' : 'términos marcados'}</b> para excluir.
        <button class="btn sm primary" data-cooaplicar>Recalcular sin ${marcadosN === 1 ? 'él' : 'ellos'}</button>
        <button class="btn sm ghost" data-coodesmarcar>Desmarcar</button>` : ''}
        ${E.aplicados.size ? `<span class="dsub">${nf(E.aplicados.size)} ${E.aplicados.size === 1 ? 'término excluido' : 'términos excluidos'} en este cálculo.</span>
        <button class="btn sm ghost" data-cooreponer>Reponerlos</button>` : ''}</div>` : '';
  // La negrita sigue al criterio elegido: se destaca la medida por la que está ordenada la lista.
  const dest = (k, html) => (X.orden === k ? `<b>${html}</b>` : html);
  const ordenados = r.comunidades.map((c, k) => [c, k]);
  if (X.orden === 'peso') ordenados.sort((x, y) => (y[0].peso || 0) - (x[0].peso || 0) || x[1] - y[1]);
  else if (X.orden === 'alcance') ordenados.sort((x, y) => (y[0].porcentaje || 0) - (x[0].porcentaje || 0) || x[1] - y[1]);
  const temas = ordenados.map(([c, k]) => {
    // La misma paleta que tine el texto en el lector: el tema 3 de aqui y el
    // tema 3 de alli son el mismo color, y ya no se repite a partir del noveno.
    const col = paleta[k] || pal[k % pal.length];
    const chips = c.terminos.map((t, q) => {
      const peso = q < Math.ceil(c.terminos.length / 3) ? ' w1' : q < Math.ceil(2 * c.terminos.length / 3) ? ' w2' : ' w3';
      const marc = E.marcados.has(t.term) ? ' marcado' : '';
      const tit = `Clic: marcar para excluir. Vecinos más fuertes: ${(vecinos[t.i] || []).join(', ')}`;
      return `<button type="button" class="coo-t${peso}${marc}" data-cooterm="${esc(t.term)}" title="${esc(tit)}" aria-pressed="${!!marc}">${esc(t.display)}</button>`;
    }).join('');
    const lec = c.lectura || [];
    const maxP = lec.length ? lec[0].puntuacion : 0;
    const leer = lec.length ? `<details class="coo-tl"><summary>Leer primero: ${lec.slice(0, 2).map(x => {
        const m = (r.lectura?.metadatos || {})[x.id] || {};
        return esc(ident(m.rep_name) ? m.rep_name : (m.speaker || 'Sin orador'));
      }).join(' · ')}${lec.length > 2 ? ` y ${nf(lec.length - 2)} más` : ''}</summary>
      <ol class="coo-lista">${lec.map((x, q) => cooLectFila(r, x, q, maxP)).join('')}</ol></details>` : '';
    return `<section class="coo-tema" style="--c:${col}">
      <div class="coo-cab"><span class="coo-n">${k + 1}</span><h4>${esc(c.etiqueta)}</h4>
        <span class="coo-st">${nf(c.n_terminos)} términos · ${dest('alcance', `<span title="Intervenciones donde asoma alguno de sus términos, aunque sea de paso">${nf(c.intervenciones)} intervenciones (${String(c.porcentaje).replace('.', ',')} %)</span>`)}${c.peso == null ? '' : ` · ${dest('peso', `<span title="Palabras de las intervenciones que este tema domina: aquellas en las que está presente la mayor parte de su propio vocabulario. Un tema puede asomar en muchas intervenciones y dominar pocas.">${String(c.peso).replace('.', ',')} % del texto</span>`)}`} · ${dest('g2', `<span title="Media del G² de sus términos en el léxico: cuán característico es el tema de esta biblioteca frente al resto del corpus">G² medio ${nf(Math.round(c.g2_medio))}</span>`)}</span></div>
      <div class="coo-terms">${chips}</div>
      ${cooPartidosHTML(r, c)}
      <div class="coo-acc"><button type="button" class="btn sm" data-coobuscar="${k}" title="Busca en la biblioteca las intervenciones con cualquiera de sus términos, resaltados, para revisar el tema">Revisar en la lista</button>
        <button type="button" class="btn sm ghost" data-coomarcartema="${k}" title="Marca todos los términos del tema para excluirlos">Marcar el tema</button>
        <button type="button" class="btn sm ghost" data-coonueva="${k}" title="Busca estos términos en TODO el corpus, no solo en esta biblioteca, y guarda el resultado en una biblioteca nueva">Buscar en todo el corpus…</button>
        </div>${leer}
    </section>`;
  }).join('');
  const sueltos = (r.sueltos || []).length
    ? `<details class="lex-neg coo-sueltos"><summary>Términos poco conectados (${nf(r.sueltos.length)}): forman comunidades de uno o dos términos, que no se tratan como temas</summary>
        <div class="coo-terms" style="--c:var(--text-faint);margin-top:8px">${r.sueltos.map(t => `<button type="button" class="coo-t w3${E.marcados.has(t.term) ? ' marcado' : ''}" data-cooterm="${esc(t.term)}" title="Clic: marcar para excluir">${esc(t.display)}</button>`).join('')}</div></details>` : '';
  box.innerHTML = `<div class="lex coo">
    ${controles}${metricas}${nota}${barraExcl}
    ${cooLecturaHTML(r)}
    <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap"><h4 class="coo-h">Temas</h4>
      <label class="tsel" title="Solo cambia el orden en que se presentan los temas; no recalcula la red y la numeración de cada tema no cambia">Orden
        <select data-cooorden>${COO_ORDEN.map(([v, lab]) =>
          `<option value="${v}"${v === X.orden ? ' selected' : ''}>${lab}</option>`).join('')}</select></label></div>
    ${cooNotaPartidos(r)}
    <div class="coo-temas">${temas}</div>
    ${sueltos}
    ${metodo}
    <p class="coo-exp"><button class="btn sm" data-cooexp="csv" title="Una fila por término, con su tema y sus medidas">Exportar temas (CSV)</button>
      <button class="btn sm" data-cooexp="gexf" title="La red podada, con los temas como atributo, para abrirla en Gephi">Exportar red (GEXF)</button>
      <button class="btn sm" data-cooexp="lectura" title="Las intervenciones jerarquizadas, global, variada y por tema, con su puntuación y los términos que la sostienen">Exportar jerarquía de lectura (CSV)</button>
      ${r.partidos?.con_partido ? '<button class="btn sm" data-cooexp="partidos" title="Una fila por tema y partido, con sus intervenciones, su parte del tema, su peso en la biblioteca y cuánto lo pasa">Exportar partidos por tema (CSV)</button>' : ''}</p>
    ${fuentePieHTML('panel-fuente')}
  </div>`;
  cooEjesAjustar(box);
  cooEjesVigilar(box);
  sc.scrollTop = top;
}

function cooKey(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest?.('[data-cooopen]');
  if (!row || S.view !== 'library' || S.libTab !== 'coocurrencias') return;
  e.preventDefault(); e.stopPropagation();
  openSpeech(+row.dataset.cooopen, { mode: 'speech' });
}

function cooChange(e) {
  const t = e.target;
  if (S.view !== 'library' || S.libTab !== 'coocurrencias') return;
  if (t.matches?.('[data-cooexpr]')) { S.coo.expresiones = t.checked; cooLoad(); return; }
  if (t.matches?.('[data-cooorden]')) { S.coo.orden = t.value; cooRender(); return; }
  if (!t.matches?.('[data-coo]')) return;
  S.coo[t.dataset.coo] = Number(t.value);
  cooLoad();
}

// ---------------------- una biblioteca nueva a partir de un tema ----------------
// El tema se persigue por TODO el corpus, no solo por la biblioteca de la que
// salio. Cuantos termine trayendo depende del tema: los de vocabulario propio
// («concordato», «Santa Sede») devuelven poco; los de palabras corrientes
// («gobierno», «orden») lo arrastran casi todo. Por eso no se decide aqui que
// terminos valen: se ensena lo que trae cada uno y se quitan los que sobren.
const TEMA_DLG = { terminos: [], base: '', n: 0, total: 0, seq: 0, contando: 0 };
const TEMA_DLG_POOL = 8;   // recuentos a la vez: el motor los resuelve en milisegundos

const temaTermQ = (t) => (/^[\p{L}\p{N}]+$/u.test(t) ? t : `"${t.replace(/"/g, '')}"`);
const temaConsulta = (ts) => ts.map(temaTermQ).join(' | ');

async function temaCuenta(q, signal) {
  if (!q) return 0;
  const r = await api('/search', { method: 'POST', signal,
    body: { query: q, mode: 'keyword', variants: false, order: 'relevance', filters: {}, limit: 1, offset: 0 } });
  return r && !r.error ? (r.total || 0) : 0;
}

function temaDlgPinta() {
  const caja = $('#temaDlgTerms');
  if (!caja) return;
  caja.innerHTML = TEMA_DLG.terminos.map((t, i) =>
    `<button type="button" class="tema-t${t.on ? '' : ' fuera'}" data-temat="${i}"
       aria-pressed="${t.on}" title="${t.on ? 'Quitar de la búsqueda' : 'Volver a incluir'}">${esc(t.display)}`
    + `<i>${t.n == null ? '…' : nf(t.n)}</i></button>`).join('');
  const dentro = TEMA_DLG.terminos.filter(t => t.on).length;
  $('#temaDlgN').textContent = `· ${nf(dentro)} de ${nf(TEMA_DLG.terminos.length)}`
    + (TEMA_DLG.contando ? ' · contando…' : '');
  const tot = TEMA_DLG.total;
  const sub = $('#temaDlgSub');
  if (sub) sub.innerHTML = `${esc(TEMA_DLG.base)} · <b>${tot == null ? '…' : nf(tot)}</b> `
    + `${tot === 1 ? 'intervención' : 'intervenciones'} en todo el corpus`;
  const grande = (tot || 0) > CONFIRMAR_DESDE;
  $('#temaDlgBig').hidden = !grande;
  if (grande) {
    $('#temaDlgBigTxt').textContent = `Son ${nf(tot)} intervenciones. Guardarlas lleva unos segundos, y el `
      + 'Léxico y las Coocurrencias de una biblioteca tan grande pueden tardar minutos la primera vez.';
    $('#temaDlgBigLbl').textContent = `Sí, crearla con ${nf(tot)}`;
  } else { $('#temaDlgBigOk').checked = false; }
  const ok = $('#temaDlgOk');
  ok.disabled = !dentro || !(tot > 0) || (grande && !$('#temaDlgBigOk').checked);
}

async function temaDlgTotal() {
  const mio = ++TEMA_DLG.seq;
  const q = temaConsulta(TEMA_DLG.terminos.filter(t => t.on).map(t => t.term));
  TEMA_DLG.total = null; temaDlgPinta();
  try {
    const n = await temaCuenta(q);
    if (mio !== TEMA_DLG.seq) return;
    TEMA_DLG.total = n;
  } catch (e) { if (mio === TEMA_DLG.seq) TEMA_DLG.total = 0; }
  temaDlgPinta();
}

// Los recuentos por termino van en paralelo y se pintan segun llegan: con 108
// terminos, en serie se notaria la espera.
async function temaDlgCuentas(mio) {
  const cola = TEMA_DLG.terminos.map((t, i) => [t, i]);
  TEMA_DLG.contando = cola.length;
  let sig = 0;
  const obrero = async () => {
    for (;;) {
      const j = sig++;
      if (j >= cola.length || mio !== TEMA_DLG.seqCuentas) return;
      const [t] = cola[j];
      try { t.n = await temaCuenta(temaTermQ(t.term)); } catch (e) { t.n = 0; }
      TEMA_DLG.contando--;
      if (mio === TEMA_DLG.seqCuentas && (TEMA_DLG.contando % 6 === 0 || !TEMA_DLG.contando)) temaDlgPinta();
    }
  };
  await Promise.all(Array.from({ length: Math.min(TEMA_DLG_POOL, cola.length) }, obrero));
  if (mio !== TEMA_DLG.seqCuentas) return;
  // De mas a menos: el que arrastra el bulto se ve el primero, que es de lo que se trata.
  TEMA_DLG.terminos.sort((a, b) => (b.n || 0) - (a.n || 0));
  TEMA_DLG.contando = 0;
  temaDlgPinta();
}

function temaDlgNota() {
  const L = S.libInfo, puestos = TEMA_DLG.terminos.filter(t => t.on);
  const todos = puestos.length === TEMA_DLG.terminos.length;
  return `Nuevo tema ${TEMA_DLG.n} a partir de la biblioteca «${L ? L.name : ''}», buscado en todo el corpus.\n`
    + `Términos (${nf(puestos.length)}${todos ? '' : ` de ${nf(TEMA_DLG.terminos.length)}`}): `
    + `${puestos.map(t => t.display).join(', ')}.`;
}

function cooNuevaBiblioteca(k) {
  const r = S.coo.data, L = S.libInfo, c = r && r.comunidades && r.comunidades[k];
  const dlg = $('#dlgTema');
  if (!c || !dlg) return;
  const E = cooExcl();
  const ts = c.terminos.filter(t => !E.marcados.has(t.term));
  if (!ts.length) return toast('Todos los términos del tema están marcados para excluir.', true);
  TEMA_DLG.terminos = ts.map(t => ({ term: t.term, display: t.display, on: true, n: null }));
  TEMA_DLG.n = k + 1;
  TEMA_DLG.base = `Tema ${k + 1} de «${L ? L.name : ''}»`;
  TEMA_DLG.total = null;
  // La etiqueta que ya lleva el tema en su ficha, para reconocerlo de un vistazo.
  $('#temaDlgName').value = (c.etiqueta || ts.slice(0, 3).map(t => t.display).join(' · ')).replace(/ · /g, ', ');
  // La nota deja constancia de con que se busco. Se rehace al crear con los
  // terminos que queden puestos, salvo que el usuario la haya escrito el.
  TEMA_DLG.nota = temaDlgNota();
  $('#temaDlgNota').value = TEMA_DLG.nota;
  $('#temaDlgBigOk').checked = false;
  temaDlgPinta();
  dlg.showModal();
  TEMA_DLG.seqCuentas = (TEMA_DLG.seqCuentas || 0) + 1;
  temaDlgCuentas(TEMA_DLG.seqCuentas);
  temaDlgTotal();
}

async function temaDlgCrear() {
  const dlg = $('#dlgTema'), btn = $('#temaDlgOk');
  if (dlg._busy || btn.disabled) return;
  const nombre = $('#temaDlgName').value.trim();
  if (!nombre) return toast('Escriba un nombre para la biblioteca.', true);
  const dentro = TEMA_DLG.terminos.filter(t => t.on);
  const q = temaConsulta(dentro.map(t => t.term));
  const n = TEMA_DLG.total || 0;
  const busy = busyStart(dlg, btn, `Creando con ${nf(n)}…`);
  try {
    const cid = (await api('/collections', { method: 'POST', body: { name: nombre } })).id;
    // Si la nota sigue siendo la que se puso al abrir, se rehace con los terminos
    // que han quedado; si el usuario la ha cambiado, manda la suya.
    const escrita = $('#temaDlgNota').value;
    const nota = escrita.trim() === (TEMA_DLG.nota || '').trim() ? temaDlgNota() : escrita;
    await api(`/collections/${cid}/items`, { method: 'POST', body: {
      note: nota.trim(), tags: [],
      add_all_results: true,
      query: q, mode: 'keyword', variants: false, order: 'relevance', filters: {} } });
    S.ultimaBiblioteca = +cid;
    S.statsCache = null;
    await refreshCollections();
    dlg.close();
    toast(`Biblioteca «${nombre}» creada con ${nf(n)} ${n === 1 ? 'intervención' : 'intervenciones'}`);
    if (S.view === 'library') renderLibraryView();
  } catch (e) { toast(e.message, true); }
  finally { busy.end(); temaDlgPinta(); }
}

function cooBuscar(k) {
  const r = S.coo.data, cid = S.libSel;
  const c = r && r.comunidades && r.comunidades[k];
  if (!c || cid == null) return;
  const E = cooExcl();
  const q = c.terminos.filter(t => !E.marcados.has(t.term))
    .map(t => (/^[\p{L}\p{N}]+$/u.test(t.display) ? t.display : `"${t.display.replace(/"/g, '')}"`)).join(' | ');
  if (!q) return toast('Todos los términos del tema están marcados para excluir.', true);
  S.coo.ctrl?.abort();
  resetFiltersState();
  S.filters.collection_id = cid;
  S.query = q; $('#q').value = q;
  S.variants = false; $('#variants').checked = false;
  setMode('keyword');
  setView('search', { refresh: false });
  search(true);
}

function cooClick(e) {
  if (S.view !== 'library' || S.libTab !== 'coocurrencias') return false;
  const X = S.coo, E = cooExcl();
  const b = (sel) => e.target.closest(sel);
  let el;
  if (b('[data-exprrev]')) { exprAbrir(); return true; }
  if ((el = b('[data-cooterm]'))) {
    const w = el.dataset.cooterm;
    if (E.marcados.has(w)) E.marcados.delete(w); else E.marcados.add(w);
    cooRender(); return true;
  }
  if ((el = b('[data-coomarcartema]'))) {
    const c = X.data?.comunidades?.[+el.dataset.coomarcartema];
    if (c) { const todos = c.terminos.every(t => E.marcados.has(t.term)); for (const t of c.terminos) todos ? E.marcados.delete(t.term) : E.marcados.add(t.term); }
    cooRender(); return true;
  }
  if (b('[data-cooaplicar]')) { for (const w of E.marcados) E.aplicados.add(w); E.marcados.clear(); cooLoad(); return true; }
  if (b('[data-coodesmarcar]')) { E.marcados.clear(); cooRender(); return true; }
  if (b('[data-cooreponer]')) { E.aplicados.clear(); E.marcados.clear(); cooLoad(); return true; }
  if ((el = b('[data-coounidad]'))) { if (X.unidad !== el.dataset.coounidad) { X.unidad = el.dataset.coounidad; cooLoad(); } return true; }
  if ((el = b('[data-cooresol]'))) { const v = Number(el.dataset.cooresol); if (X.resolucion !== v) { X.resolucion = v; cooLoad(); } return true; }
  if ((el = b('[data-coobuscar]'))) { cooBuscar(+el.dataset.coobuscar); return true; }
  if ((el = b('[data-coonueva]'))) { cooNuevaBiblioteca(+el.dataset.coonueva); return true; }
  if ((el = b('[data-cooopen]'))) { openSpeech(+el.dataset.cooopen, { mode: 'speech' }); return true; }
  if ((el = b('[data-cooexp]'))) {
    const tipo = el.dataset.cooexp;
    if (tipo === 'gexf') cooExportGEXF();
    else if (tipo === 'lectura') cooExportLectura();
    else if (tipo === 'partidos') cooExportPartidos();
    else cooExportCSV();
    return true;
  }
  if ((el = b('[data-coolect]'))) { X.lectModo = el.dataset.coolect; X.lectN = 10; cooRender(); return true; }
  if (b('[data-coomas]')) { X.lectN += 20; cooRender(); return true; }
  if (b('[data-cooretry]')) { cooLoad(); return true; }
  if (b('[data-coocancel]')) { X.ctrl?.abort(); return true; }
  return false;
}

function cooMeta(r) {
  const p = r.parametros || {}, st = r.estadisticas || {}, L = S.libInfo, vac = p.vacias || {};
  return [
    'Explorador de Diarios de Sesiones · red de coocurrencias y temas de una biblioteca',
    `biblioteca: ${L?.name || ''} (${nf(st.n_intervenciones)} intervenciones)`,
    `corpus: ${S.info?.title || S.info?.name || ''}`,
    `generado: ${new Date().toISOString().slice(0, 19)}`,
    `texto: ${p.modo_texto === 'completo' ? 'completo' : 'solo discurso'} · unidad: ${p.unidad === 'fragmento' ? `fragmentos de ${p.fragmento} palabras` : 'intervención'} (${st.n_unidades} unidades)`,
    `vocabulario: ${r.vocabulario?.usados} términos de sobreuso del léxico · palabras vacías: ${vac.fuente || '—'} (${vac.lengua || '—'}, ${vac.n || 0}, licencia ${vac.licencia || '—'})`
      + (r.vocabulario?.descartados?.excluidos ? ` · excluidos a mano: ${[...cooExcl().aplicados].sort().join(', ')}` : ''),
    `asociación: G² de Dunning con signo, umbral ${p.g2_min}, ${p.vecinos} vecinos por término · peso: fuerza de asociación (observado/esperado)`,
    `comunidades: Leiden, modularidad con resolución ${p.resolucion}, semilla ${p.semilla}, refinado voraz · modularidad ${st.modularidad} · ${st.n_comunidades} temas`,
  ];
}

function cooSlug() {
  return foldMap(S.libInfo?.name || '').folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'biblioteca';
}

function cooExportCSV() {
  const r = S.coo.data;
  if (!r || r.error || !(r.comunidades || []).length) return toast('Aún no hay temas que exportar.', true);
  const nodos = r.nodos || [];
  const cols = ['tema', 'etiqueta_tema', 'tema_intervenciones', 'tema_porcentaje', 'termino', 'termino_indice', 'fuerza_interna',
                'fuerza_total', 'grado', 'g2_lexico', 'frecuencia', 'intervenciones_con_termino'];
  const filas = [];
  r.comunidades.forEach((c, k) => {
    for (const t of c.terminos) {
      const n = nodos[t.i] || {};
      filas.push([k + 1, c.etiqueta, c.intervenciones, c.porcentaje, t.display, t.term, t.fuerza_interna, n.fuerza, n.grado,
                  n.g2_lexico, n.freq, n.df_intervencion]);
    }
  });
  downloadText(csvConFuente(cooMeta(r), cols, filas), `temas_${cooSlug()}.csv`, 'text/csv;charset=utf-8');
}

/** Una fila por tema y partido, también los que no dicen ninguna palabra del tema: sus palabras, su tasa por mil
 *  palabras propias, las que cabría esperar y cuánto pasa (o no llega a) la media. */
function cooExportPartidos() {
  const r = S.coo.data;
  if (!r || r.error || !r.partidos?.palabras) return toast('Esta biblioteca no trae partidos que exportar.', true);
  const lib = r.partidos;
  const cols = ['tema', 'etiqueta_tema', 'tema_intervenciones', 'tema_palabras', 'partido', 'intervenciones',
                'palabras_del_tema', 'palabras_del_partido', 'esperadas', 'tasa_por_mil', 'tasa_biblioteca_por_mil',
                'veces_la_media', 'parte_de_las_palabras_del_tema'];
  const dec = (x, d) => (Number.isFinite(x) ? x.toFixed(d) : '');
  const filas = [];
  for (const [k, c] of (r.comunidades || []).entries()) {
    const rep = c.partidos;
    if (!rep?.palabras) continue;
    const tasaLib = 1000 * rep.palabras / lib.palabras;
    const enTema = new Map(rep.lista.map(x => [x.p, x]));
    const fila = (p, pal, tok, n) => {
      const esperado = tasaLib * pal / 1000, tasa = pal > 0 ? 1000 * tok / pal : null;
      filas.push([k + 1, c.etiqueta, c.intervenciones, rep.palabras, p, n, tok, pal, dec(esperado, 1),
        tasa == null ? '' : dec(tasa, 4), dec(tasaLib, 4), tasa == null ? '' : dec(tasa / tasaLib, 3),
        dec(100 * tok / rep.palabras, 2)]);
    };
    for (const x of rep.lista) fila(x.p, lib.lista.find(y => y.p === x.p)?.pal ?? 0, x.pal, x.n);
    for (const y of lib.lista) if (!enTema.has(y.p)) fila(y.p, y.pal, 0, 0);       // ninguna palabra del tema
    if (rep.otros) {
      filas.push([k + 1, c.etiqueta, c.intervenciones, rep.palabras, `(otros ${rep.otros.partidos} partidos)`,
        rep.otros.n, rep.otros.pal, '', '', '', dec(tasaLib, 4), '', dec(100 * rep.otros.pal / rep.palabras, 2)]);
    }
  }
  if (!filas.length) return toast('Ningún tema tiene palabras con partido.', true);
  const meta = cooMeta(r).concat([
    `partidos: ${nf(lib.con_partido)} de ${nf(lib.intervenciones)} intervenciones y ${nf(lib.palabras)} de ${nf(lib.palabras_totales)}`
      + ' palabras traen partido (el canónico de la ingesta)',
    'palabras_del_tema = veces que el partido usa el vocabulario del tema; palabras_del_partido = todas las suyas en la biblioteca;'
      + ' hay fila también para los partidos que no dicen ninguna palabra del tema',
    'tasa_por_mil = 1000 × palabras_del_tema / palabras_del_partido, una frecuencia relativa que no depende de cuánto hable'
      + ' el partido; tasa_biblioteca_por_mil es la misma tasa para el conjunto de la biblioteca y veces_la_media, su cociente',
    'esperadas = tasa_biblioteca_por_mil × palabras_del_partido / 1000: con menos de cinco esperadas, el exceso o la falta no dicen nada',
    'una intervención cuenta en todos los temas que toca, así que las filas no suman las intervenciones de la biblioteca',
  ]);
  downloadText(csvConFuente(meta, cols, filas), `partidos_por_tema_${cooSlug()}.csv`, 'text/csv;charset=utf-8');
}

function cooExportLectura() {
  const r = S.coo.data;
  if (!r || r.error || !r.lectura) return toast('Aún no hay jerarquía de lectura que exportar.', true);
  const M = r.lectura.metadatos || {};
  const cols = ['lista', 'posicion', 'tema', 'etiqueta_tema', 'id', 'fecha', 'orador', 'partido', 'palabras', 'puntuacion', 'terminos'];
  const filas = [];
  const fila = (lista, k, x, tema) => {
    const m = M[x.id] || {};
    filas.push([lista, k + 1, tema == null ? '' : tema + 1, tema == null ? '' : r.comunidades[tema].etiqueta, x.id, m.date || '',
      ident(m.rep_name) ? m.rep_name : (m.speaker || ''), ident(m.party) ? m.party : '', x.palabras, x.puntuacion,
      (x.terminos || []).map(t => `${t.display}×${t.tf}`).join(' ')]);
  };
  r.lectura.variada.forEach((x, k) => fila('variada', k, x, x.tema));
  r.lectura.global.forEach((x, k) => fila('global', k, x, null));
  r.comunidades.forEach((c, t) => (c.lectura || []).forEach((x, k) => fila('tema', k, x, t)));
  const met = r.lectura.metodo || {};
  const meta = cooMeta(r).concat([`jerarquía: ${met.formula} (k1 ${met.k1}, b ${met.b}), peso de cada término ${met.peso_termino}; `
    + 'variada = la mejor de cada tema por turnos; global = sin mirar el tema; tema = solo los términos del tema']);
  downloadText(csvConFuente(meta, cols, filas), `lectura_${cooSlug()}.csv`, 'text/csv;charset=utf-8');
}

function cooExportGEXF() {
  const r = S.coo.data;
  if (!r || r.error || !(r.nodos || []).length) return toast('Aún no hay red que exportar.', true);
  const x = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const etiqueta = new Map(r.comunidades.map((c, k) => [k, c.etiqueta]));
  const F = fuenteDe();
  const desc = cooMeta(r).concat([`Fuente: ${F.cita || F.cita_corta || ''}${F.url ? ` · ${F.url}` : ''}`]).join('\n');
  const nodos = r.nodos.map(n => `      <node id="${n.i}" label="${x(n.display)}"><attvalues>`
    + `<attvalue for="0" value="${n.comunidad + 1}"/><attvalue for="1" value="${x(n.comunidad >= 0 ? etiqueta.get(n.comunidad) : 'sin tema')}"/>`
    + `<attvalue for="2" value="${n.g2_lexico}"/><attvalue for="3" value="${n.freq}"/><attvalue for="4" value="${n.df_intervencion}"/>`
    + `<attvalue for="5" value="${n.fuerza}"/></attvalues></node>`).join('\n');
  const aristas = (r.aristas || []).map((a, k) => `      <edge id="${k}" source="${a.a}" target="${a.b}" weight="${a.fuerza}"><attvalues>`
    + `<attvalue for="0" value="${a.co}"/><attvalue for="1" value="${a.esperado}"/><attvalue for="2" value="${a.g2}"/></attvalues></edge>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://gexf.net/1.3" version="1.3">
  <meta lastmodifieddate="${new Date().toISOString().slice(0, 10)}">
    <creator>ParlaIbero · Explorador de Diarios de Sesiones</creator>
    <description>${x(desc)}</description>
  </meta>
  <graph defaultedgetype="undirected" mode="static">
    <attributes class="node">
      <attribute id="0" title="tema" type="integer"/>
      <attribute id="1" title="etiqueta_tema" type="string"/>
      <attribute id="2" title="g2_lexico" type="double"/>
      <attribute id="3" title="frecuencia" type="integer"/>
      <attribute id="4" title="intervenciones" type="integer"/>
      <attribute id="5" title="fuerza" type="double"/>
    </attributes>
    <attributes class="edge">
      <attribute id="0" title="coocurrencias" type="integer"/>
      <attribute id="1" title="esperado" type="double"/>
      <attribute id="2" title="g2" type="double"/>
    </attributes>
    <nodes>
${nodos}
    </nodes>
    <edges>
${aristas}
    </edges>
  </graph>
</gexf>
`;
  downloadText(xml, `red_${cooSlug()}.gexf`, 'application/xml;charset=utf-8');
}

function lexExportCSV() {
  const r = S.lex.data, L = S.libInfo;
  if (!r || r.error || !L || S.lex.cid !== L.id) return toast('Aún no hay tabla de léxico.', true);
  const m = r.metrics || {};
  const num = v => (v == null || !isFinite(v) ? '' : String(+v));
  const tx = r.texto || null, discurso = (r.modo_texto === 'discurso' || r.modo_texto === 'discurso_rapido') && !!tx;
  const meta = [
    'Explorador de Diarios de Sesiones · léxico (keyness) de una biblioteca',
    `biblioteca: ${L.name} (${r.n_texts} intervenciones)`,
    `corpus: ${S.info?.title || S.info?.name || ''}`,
    `generado: ${new Date().toISOString().slice(0, 19)}`,
    discurso
      ? `texto analizado: solo discurso de los oradores${r.modo_texto === 'discurso_rapido' ? ', segmentación rápida' : ''} (${tx.tokens_analizados} de ${tx.tokens_brutos} tokens; `
        + `excluidos ${tx.tokens_excluidos}: ${lexDesglose(tx, String) || 'ninguno'})`
      : 'texto analizado: intervenciones completas (con listas de votación, crónica del acta, acotaciones y tablas)',
    `palabras (tokens del índice): ${m.tokens}; términos distintos: ${m.types}; TTR: ${m.ttr}`,
    `referencia: resto del corpus, corpus − texto analizado (${r.reference_tokens} tokens)`,
    `prueba: G² de Dunning con signo; umbral ${r.threshold} (p < ${r.p}); frecuencia mínima ${r.min_freq}; sin palabras vacías`,
    `significativos: ${r.significant} de ${r.candidates} candidatos (${r.n_positive} sobreuso, ${r.n_negative} infrauso)${
      r.n_positive > (r.terms || []).length || r.n_negative > (r.negative || []).length ? '; tabla recortada a los de mayor |G²|' : ''}`,
    'por_mil = apariciones / tokens × 1000; log_ratio = log2 del cociente de frecuencias relativas (una frecuencia cero cuenta como 0,5)',
    'separador ; · decimales con punto · UTF-8',
  ];

  const cols = ['termino', 'uso', 'frecuencia', 'frecuencia_resto', 'por_mil_biblioteca', 'por_mil_resto',
                'g2', 'log_ratio', 'distintividad', 'termino_indice'];
  const fila = (t, uso) => [t.display || t.term, uso, t.freq, t.freq_ref, num(t.pm), num(t.pm_ref), num(t.g2),
                            num(t.log_ratio), t.badge || '', t.term];
  const filas = [...(r.terms || []).map(t => fila(t, 'sobreuso')), ...(r.negative || []).map(t => fila(t, 'infrauso'))];
  const slug = foldMap(L.name).folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'biblioteca';

  const texto = csvConFuente(meta, cols, filas);
  downloadText(texto, `lexico_${slug}_${discurso ? 'discurso' : 'completo'}.csv`, 'text/csv;charset=utf-8');
}




function statsKey() { return JSON.stringify([S.query, S.mode, S.variants, S.filters  ]); }

function getStats() {
  const key = statsKey();
  if (S.statsCache?.key === key) return S.statsCache.p;

  const p = api('/stats', { method: 'POST',
    body: { query: S.query, mode: S.mode, variants: S.variants, filters: S.filters   } });
  S.statsCache = { key, p };
  p.catch(() => { if (S.statsCache?.p === p) S.statsCache = null; });
  return p;
}


function distHTML(r) {
  if (r.error) return `<div class="empty" style="padding:14px"><p>${esc(r.error)}</p></div>`;
  const years = (r.years || []).filter(y => y.year);
  const max = Math.max(1, ...years.map(y => y.n));


  const rotulo = r.modo === 'semantic'
    ? `Distribución de las ${nf(r.n || 0)} más parecidas, por año`
    : `Resultados por año${r.n ? ` · ${nf(r.n)} intervenciones` : ''}${
        '' }`;
  return `
    <div style="background:var(--bg-sunken);border-radius:6px">
      <div style="padding:9px 13px 0;font-size:11px;color:var(--text-faint);font-weight:600;
           text-transform:uppercase;letter-spacing:.05em">${esc(rotulo)}</div>
      <div class="chart">${years.map(y =>
        `<span class="b" style="height:${Math.max(2, y.n / max * 100)}%"
          title="${esc(y.year)}: ${nf(y.n)}"></span>`).join('')}</div>
      <div class="chart-x"><span>${esc(years[0]?.year ?? '')}</span><span>${esc(years.at(-1)?.year ?? '')}</span></div>
      <div style="padding:0 13px 11px;display:flex;flex-wrap:wrap;gap:5px">
        ${(r.sexes || []).map(f =>
          `<span class="tag fam" title="Sexo">${esc(S.facets?.labels?.sex?.[f.value] || f.value)} ${nf(f.n)}</span>`).join('')}
        ${(r.session_types || []).slice(0, 6).map(f =>
          `<span class="tag" title="Tipo de sesión">${esc(f.value)} ${nf(f.n)}</span>`).join('')}
        ${(r.parties || []).slice(0, 8).map(f =>
          `<span class="tag" title="Partido">${esc(f.value)} ${nf(f.n)}</span>`).join('')}
      </div>
      <div style="padding:0 13px 12px;display:flex;flex-wrap:wrap;gap:5px">
        ${(r.speakers || []).slice(0, 10).map(s =>
          `<span class="tag" style="cursor:pointer" data-spk="${esc(s.rep_id)}"
            title="Filtrar por este diputado">${esc(s.value)} ${nf(s.n)}</span>`).join('')}
      </div>
    </div>`;
}

async function distLoad() {
  const box = $('#trendDist');
  if (!box) return;
  const key = statsKey();
  box.innerHTML = `<div class="empty" style="padding:16px"><span class="spin"></span></div>`;
  try {
    const r = await getStats();
    if (key !== statsKey() || !box.isConnected) return;
    box.innerHTML = distHTML(r);
  } catch (e) {
    if (box.isConnected) box.innerHTML = `<div class="empty" style="padding:14px"><p>${esc(e.message)}</p></div>`;
  }
}





const CLIMA_CLASE = {
  Aplausos: 'applause', 'Aprobación': 'applause',
  Rumores: 'conflict', Protestas: 'conflict', Interrupciones: 'conflict', Voces: 'conflict',
  Presidencia: 'order',
};
const CLIMA_PRIO = { conflict: 0, applause: 1, order: 2, neutral: 3 };

function climaHTML(cl, units = null) {



  let items;
  if (Array.isArray(units)) {
    items = units.filter(u => +u.n > 0).map(u => ({ lab: u.lab, n: +u.n, c: ACOT_CLASES.has(u.c) ? u.c : 'neutral' }));
  } else {
    if (!cl || !cl.labels) return '';
    items = Object.entries(cl.labels)
      .filter(([, n]) => +n > 0)
      .map(([lab, n]) => ({ lab, n: +n, c: CLIMA_CLASE[lab] || 'neutral' }));
  }
  items.sort((a, b) => (a.c === 'neutral') - (b.c === 'neutral') || b.n - a.n || CLIMA_PRIO[a.c] - CLIMA_PRIO[b.c]);
  return items.slice(0, 2).map(x =>
    `<span class="tag clima ${x.c}" title="recuento en la intervención completa">${esc(x.lab)} ×${nf(x.n)}</span>`).join('');
}




const IDEO_CLAVES = new Set(['EI', 'I', 'CI', 'C', 'CD', 'D', 'ED']);
let specSeq = 0;



function ideoTag() { return ''; }

function sexoTag(v) {
  if (!ident(v)) return '';
  const nombre = S.facets?.labels?.sex?.[v] || v;
  return `<span class="tag" title="Sexo">${esc(nombre)}</span>`;
}

async function loadSpectrum() {
  const box = $('#spectrum');
  if (!box) return;
  box.hidden = true; // este corpus no trae ideología: no hay espectro
  if (box) return;
  if (S.view !== 'search' || S.similarOf || !S.total || !S.facets) { box.hidden = true; return; }
  const mine = ++specSeq, key = statsKey();
  box.classList.add('stale');
  let r;
  try { r = await getStats(); } catch { if (mine === specSeq) box.hidden = true; return; }
  if (mine !== specSeq || key !== statsKey()) return;
  box.classList.remove('stale');
  const ideos = (r.ideologies || []).filter(x => +x.n > 0);
  const n = +r.n || ideos.reduce((s, x) => s + x.n, 0);
  if (r.error || !ideos.length || !n || S.view !== 'search' || S.similarOf) { box.hidden = true; return; }
  const L = S.facets.labels?.ideology || {};
  const activas = new Set(S.filters.ideologies || []);
  const pct = x => { const p = x.n / n * 100; return p > 0 && p < 1 ? '<1 %' : `${Math.round(p)} %`; };
  const cls = v => `i-${IDEO_CLAVES.has(v) ? v : 'x'}`;
  const tit = x => `${L[x.value] || x.value}: ${nf(x.n)} de ${nf(n)} (${pct(x)}) · clic para ${
    activas.size === 1 && activas.has(x.value) ? 'quitar el filtro' : 'filtrar por esta ideología'}`;
  const sobre = r.modo === 'semantic' ? `las ${nf(n)} más parecidas`
    : `los ${nf(n)} resultados${  '' }`;
  box.classList.toggle('has-on', ideos.some(x => activas.has(x.value)));
  box.innerHTML = `<div class="spec-title">Espectro ideológico de ${sobre}</div>
    <div class="spec-bar" role="group" aria-label="Espectro ideológico: clic en un tramo para filtrar">${ideos.map(x =>
      `<button type="button" class="spec-seg ${cls(x.value)}${activas.has(x.value) ? ' on' : ''}" style="flex:${+x.n} 1 0"
        data-ideo="${esc(x.value)}" title="${esc(tit(x))}" aria-label="${esc(tit(x))}"></button>`).join('')}</div>
    <div class="spec-legend">${ideos.map(x =>
      `<button type="button" class="spec-key${activas.has(x.value) ? ' on' : ''}" data-ideo="${esc(x.value)}" title="${esc(tit(x))}">`
      + `<i class="${cls(x.value)}"></i>${esc(L[x.value] || x.value)} ${pct(x)}</button>`).join('')}</div>
    ${fuentePieHTML('panel-fuente spec-fuente')}`;
  box.hidden = false;
}







const TREND_MAX = 8;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
let TREND_RANGES = [
  { id: 'all', label: 'Todo', title: 'Todo el calendario del corpus' },
];

/** Los tramos de la tendencia son las legislaturas del corpus abierto (facetas). */
function trendRangesDesdeFacetas(f) {
  const legs = (f && f.legislatures) || [];
  const out = [{ id: 'all', label: 'Todo', title: 'Todo el calendario del corpus' }];
  legs.forEach((l, i) => {
    if (!l.date_min || !l.date_max) return;
    out.push({ id: `leg${i}`, label: String(l.value), from: l.date_min.slice(0, 7), to: l.date_max.slice(0, 7),
      title: `Legislatura ${l.value}: ${fechaLarga(l.date_min)} a ${fechaLarga(l.date_max)} · ${nf(l.sessions || 0)} sesiones` });
  });
  TREND_RANGES = out;
  return out;
}
const TREND_KINDS = { electoral: 'Elecciones', politico: 'Política', parlamentario: 'Parlamento',
                      conflicto: 'Conflicto', economico: 'Economía', social: 'Sociedad' };
const TREND_MS_LEVELS = [['auto', 'los que quepan', 'Dibuja los hitos por orden de importancia mientras quepan sin solaparse: primero los principales, luego los relevantes y por último los de contexto'],
                         ['1', 'principales', 'Solo los hitos principales (elecciones, tomas de posesión, constituciones, golpes, crisis mayores)'],
                         ['2', 'relevantes', 'Hitos principales y relevantes'],
                         ['3', 'todos', 'Todos los hitos del periodo que quepan en el gráfico']];
const TREND_METRICS = {
  density: { label: '/10.000 palabras', unit: 'por 10.000 palabras',
             title: 'Menciones por cada 10.000 palabras pronunciadas en el periodo' },
  abs: { label: 'Absoluta', unit: 'menciones', title: 'Número de apariciones del término' },
  pct: { label: '％ interv.', unit: '% de intervenciones',
         title: 'Porcentaje de intervenciones del periodo que contienen el término al menos una vez' },
};
const TREND_REL = {
  normal: 'fiabilidad normal',
  baja: 'fiabilidad baja (menos de 100.000 palabras en el periodo)',
  muy_baja: 'fiabilidad muy baja (menos de 20.000 palabras; no fija la escala)',
  vacio: 'sin datos',
};

const TREND_PAL = {
  light: { bg: '#ffffff', ink: '#1d1b18', soft: '#5f5a52', faint: '#8b857b', grid: '#eeebe5', axis: '#c9c3b7',
           band: '#f3f0ea', recess: '#f8f6f1', hatch: '#dcd6ca', ms: '#9b958b', pick: '#e3e6f4',
           series: ['#4a4fa8', '#b5562c', '#0d7d6b', '#a4781f', '#8a3f8f', '#3f7fae', '#6d8a3c', '#a33a4a'] },
  dark:  { bg: '#1e1e22', ink: '#e9e7e3', soft: '#a5a19a', faint: '#7f7b74', grid: '#2a2a30', axis: '#4a4a52',
           band: '#25252b', recess: '#222227', hatch: '#3b3b43', ms: '#8d8980', pick: '#2d3044',
           series: ['#9ca0f0', '#e38b5d', '#4cc4ac', '#d8ad55', '#c98ad0', '#7fb3dd', '#a6c56d', '#e27d8c'] },
};





const TREND_PAL_EDITORIAL = {
  light: { ...TREND_PAL.light, pick: '#f1e3e4', series: [...TREND_PAL.light.series.slice(0, 7), '#5b6770'] },
  dark:  { ...TREND_PAL.dark,  pick: '#3b262a', series: [...TREND_PAL.dark.series.slice(0, 7), '#b3bcc6'] },
};
const trendPal = () => (document.documentElement.dataset.estilo !== 'clasico' ? TREND_PAL_EDITORIAL : TREND_PAL)[
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];




const TREND_ICON = {
  baja: '<svg class="ticon" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  muy: '<svg class="ticon" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="1.6 1.3"/></svg>',
  receso: '<svg class="ticon" viewBox="0 0 12 10" aria-hidden="true"><path d="M-1 7l4-4M3 11l8-8M9 11l4-4M-1 1l2-2" stroke="currentColor" stroke-width="1"/></svg>',
  corte: '<svg class="ticon" viewBox="0 0 12 10" aria-hidden="true"><path d="M2 9l3-8M7 9l3-8" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>',
};

function trendState() {
  return { open: false, tab: 'trend', terms: [], seedQuery: null, variants: false, applyFilters: false,
           milestones: true, msLevel: 'auto', msLegend: null, metric: 'density', gran: 'month', smooth: 0, range: 'all',
           data: null, key: '', cache: new Map(), ctrl: null, seq: 0, loading: false, error: null,
           editing: null, hover: null, hoverTerm: null, geom: null, ro: null, width: 0 };
}
S.trend = trendState();
S.statsCache = null;

const mesLargo = key => {
  const [y, m] = String(key).split('-').map(Number);
  return m ? `${MESES[m - 1]} de ${y}` : String(key);
};
const fechaCorta = iso => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return m ? `${d ? `${d} ` : ''}${MESES_C[m - 1]} ${y}` : String(iso || '');
};



function splitTerms(text) {
  const s = String(text || '').replace(/[«»“”]/g, '"');
  const sinCerrar = (s.match(/"/g) || []).length % 2 ? s.lastIndexOf('"') : -1;
  const out = []; let cur = '', dentro = false;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (ch === '"' && k !== sinCerrar) dentro = !dentro;
    if (ch === ',' && !dentro) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
}





function seedTerms(q, max = TREND_MAX) {



  const Q = globalThis.R2 && globalThis.R2.query;
  return Q && typeof Q.seedTerms === 'function' ? Q.seedTerms(q, max) : [];





























}


function niceTicks(lo, hi, target = 4, { integer = false } = {}) {
  lo = Number(lo) || 0; hi = Number(hi) || 0;
  if (!(hi > lo)) hi = lo + (integer ? 1 : 1);
  const raw = (hi - lo) / Math.max(1, target);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  if (integer) step = Math.max(1, Math.round(step));
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let k = 0; min + k * step <= max + step * 1e-6; k++) ticks.push(+(min + k * step).toFixed(10));
  return { step, min, max, ticks };
}


const gapUnits = n => Math.min(3.4, 1.5 + 0.45 * Math.log2(n));





function buildAxis(keys, empty, { from = null, to = null, minRun = 3 } = {}) {
  const idx = [];
  keys.forEach((k, i) => { if ((!from || k >= from) && (!to || k <= to)) idx.push(i); });
  const items = [];
  let u = 0, k = 0;
  while (k < idx.length) {
    if (empty[idx[k]]) {
      let j = k;
      while (j + 1 < idx.length && empty[idx[j + 1]] && idx[j + 1] === idx[j] + 1) j++;
      const n = j - k + 1;
      if (n >= minRun) {
        const w = gapUnits(n);
        items.push({ kind: 'gap', i0: idx[k], i1: idx[j], n, u0: u, u1: u + w });
        u += w;
      } else {
        for (let q = k; q <= j; q++) { items.push({ kind: 'slot', i: idx[q], empty: true, u0: u, u1: u + 1 }); u += 1; }
      }
      k = j + 1;
      continue;
    }
    items.push({ kind: 'slot', i: idx[k], empty: false, u0: u, u1: u + 1 });
    u += 1; k++;
  }
  const pos = new Map();
  for (const it of items) {
    if (it.kind === 'slot') pos.set(it.i, it);
    else for (let q = it.i0; q <= it.i1; q++) pos.set(q, it);
  }
  return { items, units: u, pos, first: idx.length ? idx[0] : null, last: idx.length ? idx.at(-1) : null };
}



function segmentsOf(empty, minRun = 3) {
  const seg = new Array(empty.length).fill(0);
  let s = 0, k = 0;
  while (k < empty.length) {
    if (!empty[k]) { seg[k] = s; k++; continue; }
    let j = k;
    while (j + 1 < empty.length && empty[j + 1]) j++;
    const largo = j - k + 1 >= minRun;
    for (let q = k; q <= j; q++) seg[q] = largo ? -1 : s;
    if (largo) s++;
    k = j + 1;
  }
  return seg;
}

function relOf(tokens, th) {
  return tokens >= th.normal ? 'normal' : tokens >= th.baja ? 'baja' : tokens > 0 ? 'muy_baja' : 'vacio';
}


function trendBase(d, gran = 'month') {
  const months = d?.months || [];
  const den = d?.denominators || {}, cm = d?.corpus_months || {};
  const th = { normal: 100000, baja: 20000, ...(d?.thresholds || {}) };
  const sessions = months.map((_, i) => (Array.isArray(cm.sessions)
    ? +cm.sessions[i] || 0 : ((+cm.tokens?.[i] || +den.tokens?.[i]) ? 1 : 0)));
  const terms = [];
  (d?.terms || []).forEach((t, k) => {
    if (t && t.ok && Array.isArray(t.counts))
      terms.push({ k, label: t.label || t.input, input: t.input, query: t.query, total: t.total,
                   counts: t.counts, docs: t.docs || [] });
  });
  if (gran !== 'year') {
    return { gran: 'month', keys: months, members: months.map((_, i) => [i]),
             tokens: den.tokens || [], speeches: den.speeches || [], sessions,
             empty: sessions.map(x => x === 0),
             rel: months.map((_, i) => den.reliability?.[i] || relOf(+den.tokens?.[i] || 0, th)), terms, th };
  }
  const years = [...new Set(months.map(m => m.slice(0, 4)))];
  const members = years.map(y => months.reduce((a, m, i) => { if (m.startsWith(y)) a.push(i); return a; }, []));
  const sum = (arr, ids) => ids.reduce((s, i) => s + (+(arr || [])[i] || 0), 0);
  const tokens = members.map(ids => sum(den.tokens, ids));
  const ses = members.map(ids => sum(sessions, ids));
  return { gran: 'year', keys: years, members, tokens, speeches: members.map(ids => sum(den.speeches, ids)),
           sessions: ses, empty: ses.map(x => x === 0), rel: tokens.map(tk => relOf(tk, th)), th,
           terms: terms.map(t => ({ ...t, counts: members.map(ids => sum(t.counts, ids)),
                                    docs: members.map(ids => sum(t.docs, ids)) })) };
}

function trendValue(metric, c, d, tokens, speeches) {
  if (metric === 'pct') return speeches > 0 ? d / speeches * 100 : null;
  if (!(tokens > 0)) return null;
  return metric === 'abs' ? c : c / tokens * 1e4;
}





function deriveSeries(base, { metric = 'density', smooth = 0, seg = null } = {}) {
  const n = base.keys.length;
  const half = smooth > 1 ? Math.floor(smooth / 2) : 0;
  return base.terms.map(t => {
    const pts = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const tk = +base.tokens[i] || 0, sp = +base.speeches[i] || 0;
      if (!(tk > 0)) continue;
      const c = +t.counts[i] || 0, d = +t.docs[i] || 0;
      const raw = trendValue(metric, c, d, tk, sp);
      let v = raw;
      if (half) {
        let C = 0, D = 0, TT = 0, SS = 0, m = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
          if (seg && seg[j] !== seg[i]) continue;
          const tj = +base.tokens[j] || 0;
          if (!(tj > 0)) continue;
          C += +t.counts[j] || 0; D += +t.docs[j] || 0; TT += tj; SS += +base.speeches[j] || 0; m++;
        }
        v = metric === 'abs' ? (m ? C / m : null) : trendValue(metric, C, D, TT, SS);
      }
      pts[i] = { v, raw, c, d, tokens: tk, speeches: sp, rel: base.rel[i] || relOf(tk, base.th) };
    }
    return { ...t, pts };
  });
}




function layoutMilestones(xs, { gap = 15, rows = 2, xMin = -Infinity, xMax = Infinity } = {}) {
  const orden = xs.map((x, k) => [x, k]).sort((a, b) => a[0] - b[0]);
  const ultimo = new Array(rows).fill(-Infinity);
  const out = new Array(xs.length);
  for (const [x, k] of orden) {
    let fila = 0, cx = Infinity;
    for (let r = 0; r < rows; r++) {
      const c = Math.max(x, xMin, ultimo[r] + gap);
      if (c < cx - 1e-9) { fila = r; cx = c; }
    }
    out[k] = { row: fila, cx, x };
    ultimo[fila] = cx;
  }
  for (let r = 0; r < rows; r++) {
    const fila = out.filter(o => o && o.row === r).sort((a, b) => a.cx - b.cx);
    let limite = xMax;
    for (let q = fila.length - 1; q >= 0; q--) {
      if (fila[q].cx > limite) fila[q].cx = limite;
      limite = fila[q].cx - gap;
    }
  }
  return out;
}




const msRank = m => (m.h.rank === 1 || m.h.rank === 3 ? m.h.rank : 2);

/** Qué hitos del periodo se dibujan: los de importancia `maxRank` o mayor, y como mucho `capacity`. Si sobran, se
 *  reparten por importancia y, dentro de cada rango, repartidos por fecha para no dejar tramos sin ninguno. */
function selectMilestones(items, { maxRank = 3, capacity = 60 } = {}) {
  const rankOf = msRank;
  let pool = items.filter(m => rankOf(m) <= maxRank);
  if (pool.length > capacity) {
    const keep = new Set();
    for (let r = 1; r <= 3 && keep.size < capacity; r++) {
      const grupo = pool.filter(m => rankOf(m) === r), sitio = capacity - keep.size;
      if (grupo.length <= sitio) grupo.forEach(m => keep.add(m));
      else { const paso = grupo.length / sitio; for (let i = 0; i < sitio; i++) keep.add(grupo[Math.floor(i * paso)]); }
    }
    pool = pool.filter(m => keep.has(m));
  }
  const drawn = new Set(pool);
  return { drawn: items.filter(m => drawn.has(m)), hidden: items.filter(m => !drawn.has(m)) };
}

function yearMarks(axis, keys, gran) {
  const marks = [];
  if (gran === 'year') {
    for (const it of axis.items) {
      if (it.kind === 'slot') marks.push({ text: keys[it.i], short: `’${keys[it.i].slice(2)}`, u: (it.u0 + it.u1) / 2, mid: true });
      else {
        const a = keys[it.i0], b = keys[it.i1];
        marks.push({ text: `${a}–${b.slice(2)}`, short: `’${a.slice(2)}–${b.slice(2)}`, u: (it.u0 + it.u1) / 2, mid: true });
      }
    }
    return marks;
  }
  const vistos = new Set();
  for (const it of axis.items) {
    if (it.kind === 'slot') {
      const y = keys[it.i].slice(0, 4);
      if (!vistos.has(y)) { vistos.add(y); marks.push({ text: y, short: `’${y.slice(2)}`, u: it.u0, tick: true }); }
      continue;
    }
    const ys = [];
    for (let q = it.i0; q <= it.i1; q++) {
      const y = keys[q].slice(0, 4);
      if (!vistos.has(y)) { vistos.add(y); ys.push({ y, q }); }
    }
    if (!ys.length) continue;
    const w = it.u1 - it.u0;
    if (ys.length === 1) {
      marks.push({ text: ys[0].y, short: `’${ys[0].y.slice(2)}`, u: it.u0 + (ys[0].q - it.i0) / it.n * w, tick: true });
    } else {
      const a = ys[0].y, b = ys.at(-1).y;
      marks.push({ text: `${a}–${b.slice(2)}`, short: `’${a.slice(2)}–${b.slice(2)}`, u: it.u0 + w / 2, mid: true,
                   years: ys.map(x => x.y) });
    }
  }
  return marks;
}





function layoutLabels(marks, xOf, { charW = 6, pad = 5, rows = 2, xMin = 0, xMax = Infinity } = {}) {
  const derecha = new Array(rows).fill(-Infinity);
  const out = marks.map(m => {
    const x = xOf(m.u);
    const caja = t => {
      const w = t.length * charW;
      let a = m.mid ? x - w / 2 : x + 2;
      a = Math.max(xMin, Math.min(a, xMax - w));
      return [a, a + w];
    };
    for (const text of [m.text, m.short]) {
      if (!text) continue;
      const [a, b] = caja(text);
      for (let r = 0; r < rows; r++) {
        if (a >= derecha[r] + pad) { derecha[r] = b; return { ...m, x, text, row: r, x0: a, x1: b }; }
      }
    }
    const text = m.short || m.text, w = text.length * charW;
    let r = 0;
    for (let q = 1; q < rows; q++) if (derecha[q] < derecha[r]) r = q;
    const a = Math.max(caja(text)[0], derecha[r] + pad);
    derecha[r] = a + w;
    return { ...m, x, text, row: r, x0: a, x1: a + w, crowded: true };
  });
  for (let r = 0; r < rows; r++) {
    const fila = out.filter(o => o.row === r).sort((p, q) => p.x0 - q.x0);
    let limite = xMax;
    for (let k = fila.length - 1; k >= 0; k--) {
      const w = fila[k].x1 - fila[k].x0;
      if (fila[k].x1 > limite) { fila[k].x1 = limite; fila[k].x0 = limite - w; }
      limite = fila[k].x0 - pad;
    }
  }
  return out;
}

function fmtTrend(v, metric) {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v);
  const dec = metric === 'abs' ? (Number.isInteger(v) ? 0 : 1) : a >= 100 ? 0 : a >= 10 ? 1 : 2;
  const s = agrupa(v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
  return metric === 'pct' ? `${s} %` : s;
}



function trendDraw(W, pal, { forExport = false } = {}) {
  const T = S.trend, d = T.data || {};
  const base = trendBase(d, T.gran);
  const rng = TREND_RANGES.find(r => r.id === T.range) || TREND_RANGES[0];
  const cut = s => (s && base.gran === 'year' ? s.slice(0, 4) : s);
  const axis = buildAxis(base.keys, base.empty, { from: cut(rng.from), to: cut(rng.to) });
  if (!axis.items.length) return { svg: '', geom: null };
  const series = deriveSeries(base, { metric: T.metric, smooth: base.gran === 'month' ? T.smooth : 0,
                                      seg: segmentsOf(base.empty) });
  const r1 = x => Math.round(x * 10) / 10;
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  const mono = "Menlo, 'DejaVu Sans Mono', Consolas, monospace";
  const firstKey = base.keys[axis.first], lastKey = base.keys[axis.last];
  const keyIdx = new Map(base.keys.map((k, i) => [k, i]));


  const uOfDate = iso => {
    const y = +iso.slice(0, 4), m = +iso.slice(5, 7) || 1, dd = +iso.slice(8, 10) || 1;
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const key = base.gran === 'year' ? iso.slice(0, 4) : iso.slice(0, 7);
    const frac = base.gran === 'year' ? (m - 1 + (dd - 0.5) / dim) / 12 : (dd - 0.5) / dim;
    if (key < firstKey) return { where: 'antes', u: 0 };
    if (key > lastKey) return { where: 'despues', u: axis.units };
    const i = keyIdx.get(key);
    const it = i == null ? null : axis.pos.get(i);
    if (!it) return { where: 'fuera', u: null };
    if (it.kind === 'slot') return { where: 'dentro', u: it.u0 + frac };
    return { where: 'dentro', u: it.u0 + (i - it.i0 + frac) / it.n * (it.u1 - it.u0) };
  };

  const plotL = 44, plotR = W - 10, plotW = Math.max(40, plotR - plotL);
  const xOfU = u => plotL + (axis.units ? u / axis.units : 0) * plotW;

  // Hitos: los del periodo mostrado se dibujan numerados en una banda sobre el gráfico (una fila si caben sin
  // desplazarse, dos si no); cuántos, según el nivel elegido y el espacio (selectMilestones). El gráfico conserva
  // siempre su altura: lo que no cabe se cuenta en la leyenda, no se apila.
  const msIn = [], msOut = [], msHidden = [];
  let msRows = 0, msTotal = 0;
  if (T.milestones) {
    const hs = (d.milestones || []).filter(h => h && /^\d{4}-\d{2}/.test(h.date || ''))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.rank || 2) - (b.rank || 2));
    const dentro = [];
    for (const h of hs) {
      const p = uOfDate(h.date);
      (p.where === 'dentro' ? dentro : msOut).push({ h, u: p.u, where: p.where });
    }
    msTotal = dentro.length;
    // Una marca solo es legible si su número queda cerca de su fecha: se coloca en una fila si casi no hay que
    // desplazarla, si no en dos, y en modo automático se baja de nivel de importancia mientras el desplazamiento
    // delate la posición (MS_DESV). El gráfico no pierde altura por ello: lo que no cabe se cuenta en la leyenda.
    const MS_GAP = 15, MS_DESV = 22, MS_AIRE = 26;
    const capacidad = Math.max(2, (Math.floor(Math.max(0, plotW - 14) / MS_GAP) + 1) * 2);
    // Cuántas marcas caben con aire suficiente para leerlas: una por cada MS_AIRE píxeles de ancho, en dos filas.
    const holgadas = Math.max(2, Math.floor(plotW / MS_AIRE) * 2);
    const colocar = (items) => {
      const xs = items.map(m => xOfU(m.u));
      const desvDe = (lay) => lay.reduce((a, l, k) => Math.max(a, Math.abs(l.cx - xs[k])), 0);
      const opciones = { gap: MS_GAP, xMin: plotL + 7, xMax: plotR - 7 };
      let lay = layoutMilestones(xs, { ...opciones, rows: 1 }), filas = 1, desv = desvDe(lay);
      if (desv > 6) { lay = layoutMilestones(xs, { ...opciones, rows: 2 }); filas = 2; desv = desvDe(lay); }
      return { xs, lay, filas, desv };
    };
    const auto = T.msLevel === 'auto';
    const tope = auto ? Math.min(capacidad, holgadas) : capacidad;
    let nivel = auto ? 3 : Math.max(1, Math.min(3, +T.msLevel || 3));
    let sel = selectMilestones(dentro, { maxRank: nivel, capacity: tope });
    let col = colocar(sel.drawn);
    if (auto) {
      // Baja de nivel de importancia mientras las marcas no quepan con aire o sus números queden lejos de su fecha.
      while (nivel > 1 && (dentro.filter(m => msRank(m) <= nivel).length > holgadas || col.desv > MS_DESV)) {
        nivel -= 1;
        sel = selectMilestones(dentro, { maxRank: nivel, capacity: tope });
        col = colocar(sel.drawn);
      }
    }
    msIn.push(...sel.drawn);
    msHidden.push(...sel.hidden);
    if (msIn.length) {
      msRows = col.filas;
      msIn.forEach((m, k) => { m.n = k + 1; m.x = col.xs[k]; m.cx = col.lay[k].cx; m.row = col.lay[k].row; m.cy = 10 + col.lay[k].row * 16; });
    }
  }

  const plotT = msIn.length ? (msRows > 1 ? 44 : 30) : 14;
  const plotH = forExport ? 210 : 120;
  const plotB = plotT + plotH;
  const H = plotB + 36;


  const slotItems = axis.items.filter(it => it.kind === 'slot');
  let ymax = 0, ymaxAll = 0;
  for (const s of series) {
    for (const it of slotItems) {
      const p = s.pts[it.i];
      if (!p || p.v == null || !isFinite(p.v)) continue;
      ymaxAll = Math.max(ymaxAll, p.v);
      if (p.rel !== 'muy_baja') ymax = Math.max(ymax, p.v);
    }
  }
  if (!(ymax > 0)) ymax = ymaxAll > 0 ? ymaxAll : 1;
  const ticks = niceTicks(0, ymax, 4, { integer: T.metric === 'abs' && !(base.gran === 'month' && T.smooth > 1) });
  const top = ticks.max || 1;
  const yOf = v => plotB - Math.min(Math.max(v, 0), top) / top * plotH;
  const decTick = ticks.step < 1 ? Math.min(4, Math.ceil(-Math.log10(ticks.step) - 1e-9)) : 0;

  const o = [];
  o.push(`<defs><pattern id="thatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<rect width="5" height="5" fill="${pal.recess}"/><line x1="0" y1="0" x2="0" y2="5" stroke="${pal.hatch}" stroke-width="1.6"/></pattern></defs>`);
  if (forExport) o.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${pal.bg}"/>`);



  const rotulosBanda = [];
  const banda = (a, b, texto) => {
    const A = uOfDate(a), B = uOfDate(b);
    if (A.where === 'despues' || B.where === 'antes' || A.u == null || B.u == null) return;
    const x0 = xOfU(A.u), x1 = xOfU(B.u);
    if (x1 - x0 < 2) return;
    o.push(`<rect x="${r1(x0)}" y="${plotT}" width="${r1(x1 - x0)}" height="${plotH}" fill="${pal.band}"/>`);
    const w = texto.length * 5.4 + 6;
    if (x1 - x0 > w + 2)
      rotulosBanda.push(`<rect x="${r1(x0 + 1)}" y="${plotT + 1}" width="${r1(w)}" height="12" fill="${pal.bg}" fill-opacity="0.9"/>`
        + `<text x="${r1(x0 + 4)}" y="${plotT + 10}" font-size="9" fill="${pal.soft}" font-family="${sans}">${esc(texto)}</text>`);
  };


  const per = S.filters.period;
  if (!forExport && per && per.gran === base.gran && keyIdx.has(per.key)) {
    const it = axis.pos.get(keyIdx.get(per.key));
    if (it && it.kind === 'slot') o.push(`<rect x="${r1(xOfU(it.u0))}" y="${plotT}" width="${r1(xOfU(it.u1) - xOfU(it.u0))}" height="${plotH}" fill="${pal.pick}"/>`);
  }


  const gaps = [];
  for (const it of axis.items) {
    if (it.kind === 'slot' && !it.empty) continue;
    const x0 = xOfU(it.u0), x1 = xOfU(it.u1);
    o.push(`<rect x="${r1(x0)}" y="${plotT}" width="${r1(Math.max(1, x1 - x0))}" height="${plotH}" fill="url(#thatch)"/>`);
    if (it.kind === 'gap') gaps.push({ it, x0, x1 });
  }


  o.push(`<g font-family="${mono}" font-size="9.5" fill="${pal.faint}">`);
  for (const v of ticks.ticks) {
    const y = r1(yOf(v));
    o.push(`<line x1="${plotL}" x2="${plotR}" y1="${y}" y2="${y}" stroke="${v === 0 ? pal.axis : pal.grid}" stroke-width="1"/>`);
    o.push(`<text x="${plotL - 6}" y="${r1(y + 3)}" text-anchor="end">${esc(agrupa(v.toLocaleString('es-ES', { minimumFractionDigits: decTick, maximumFractionDigits: decTick })))}</text>`);
  }
  o.push('</g>');

  for (const g of gaps) {
    const cx = r1((g.x0 + g.x1) / 2);
    o.push(`<rect x="${r1(cx - 4)}" y="${plotB - 5}" width="8" height="10" fill="${pal.bg}"/>`
      + `<path d="M${r1(cx - 5)} ${plotB + 5}l4 -10M${r1(cx + 1)} ${plotB + 5}l4 -10" stroke="${pal.faint}" stroke-width="1.1" fill="none"/>`);
  }
  o.push(...rotulosBanda);


  const marks = layoutLabels(yearMarks(axis, base.keys, base.gran), xOfU, { charW: 5.9, xMin: 2, xMax: W - 2 });
  o.push(`<g font-family="${mono}" font-size="9.5" fill="${pal.soft}">`);
  for (const m of marks) {
    if (m.tick) o.push(`<line x1="${r1(m.x)}" x2="${r1(m.x)}" y1="${plotB}" y2="${plotB + 4}" stroke="${pal.axis}"/>`);
    o.push(`<text class="tyear" x="${r1(m.x0)}" y="${plotB + 15 + m.row * 12}"${m.years ? ` data-years="${esc(m.years.join(' '))}"` : ''}>${esc(m.text)}</text>`);
  }
  o.push('</g>');


  for (const m of msIn) {
    o.push(`<line x1="${r1(m.x)}" x2="${r1(m.x)}" y1="${plotT}" y2="${plotB}" stroke="${pal.ms}" stroke-width="0.8" stroke-dasharray="2 3"/>`
      + `<line x1="${r1(m.cx)}" y1="${m.cy + 7}" x2="${r1(m.x)}" y2="${plotT}" stroke="${pal.ms}" stroke-width="0.8"/>`);
  }


  const geomSeries = [];
  for (const s of series) {
    const col = pal.series[s.k % pal.series.length];
    const pts = [];
    axis.items.forEach((it, n) => {
      if (it.kind !== 'slot') return;
      const p = s.pts[it.i];
      if (!p || p.v == null || !isFinite(p.v)) return;
      pts.push({ i: it.i, n, x: xOfU((it.u0 + it.u1) / 2), y: yOf(p.v), p, clip: p.v > top + 1e-9,
                 low: p.rel === 'baja' || p.rel === 'muy_baja' });
    });
    let solid = '', dashed = '', dots = '';
    pts.forEach((a, q) => {
      const prev = pts[q - 1], next = pts[q + 1];
      const unidoI = prev && prev.n === a.n - 1, unidoD = next && next.n === a.n + 1;
      if (unidoI) {
        const tramo = `M${r1(prev.x)} ${r1(prev.y)}L${r1(a.x)} ${r1(a.y)}`;
        if (a.low || prev.low) dashed += tramo; else solid += tramo;
      }
      if (a.p.rel === 'muy_baja') dots += `<circle cx="${r1(a.x)}" cy="${r1(a.y)}" r="2.9" fill="${pal.bg}" stroke="${col}" stroke-width="1.3" stroke-dasharray="1.6 1.3"/>`;
      else if (a.p.rel === 'baja') dots += `<circle cx="${r1(a.x)}" cy="${r1(a.y)}" r="2.9" fill="${pal.bg}" stroke="${col}" stroke-width="1.4"/>`;
      else if (!unidoI && !unidoD) dots += `<circle cx="${r1(a.x)}" cy="${r1(a.y)}" r="2.3" fill="${col}"/>`;
      if (a.clip) dots += `<path d="M${r1(a.x - 3.5)} ${plotT + 1}L${r1(a.x + 3.5)} ${plotT + 1}L${r1(a.x)} ${plotT - 5}Z" fill="${col}"/>`;
    });
    o.push(`<g class="tseries" data-term="${s.k}">`
      + (solid ? `<path d="${solid}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` : '')
      + (dashed ? `<path d="${dashed}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 3"/>` : '')
      + dots + '</g>');

    geomSeries.push({ ...s, col, vals: s.pts, pts });
  }


  o.push(`<g font-family="${sans}" font-size="8.5" fill="${pal.soft}" text-anchor="middle">`);
  for (const m of msIn) {
    const grosor = m.h.rank === 1 ? 1.5 : m.h.rank === 3 ? 0.7 : 1;
    o.push(`<g class="tms" data-ms="${m.n}"><circle cx="${r1(m.cx)}" cy="${m.cy}" r="7" fill="${pal.bg}" stroke="${pal.ms}" stroke-width="${grosor}"/>`
      + `<text x="${r1(m.cx)}" y="${m.cy + 3}">${m.n}</text></g>`);
  }
  o.push('</g>');


  const hov = axis.items.map(it => ({ it, kind: it.kind, i: it.kind === 'slot' ? it.i : it.i0,
    x0: xOfU(it.u0), x1: xOfU(it.u1), x: xOfU((it.u0 + it.u1) / 2) }));
  const geom = { W, H, plotL, plotR, plotT, plotB, top, yOf, base, axis, series: geomSeries, hov, msIn, msOut, msHidden,
                 msTotal, msRows, marks, firstKey, lastKey };
  return { svg: o.join(''), geom };
}


function trendFilters() {
  const f = { ...S.filters };
  if (f.period) {
    delete f.speech_ids;
    if (f.period.kind === 'dates') { delete f.date_from; delete f.date_to; }
  }
  delete f.period;
  return f;
}

function trendRequest() {
  const T = S.trend;
  const body = { terms: T.terms.slice(0, TREND_MAX), variants: !!T.variants, apply_filters: !!T.applyFilters };
  if (T.applyFilters) body.filters = trendFilters();
  return body;
}


function trendSyncTerms() {
  const T = S.trend;
  if (T.seedQuery === S.query) return false;
  T.seedQuery = S.query;
  const sembrados = seedTerms(S.query);
  if (!sembrados.length) return false;
  const cambia = sembrados.join('\u0001') !== T.terms.join('\u0001') || T.variants !== S.variants;
  T.terms = sembrados; T.variants = S.variants; T.editing = null;
  return cambia;
}

async function trendLoad() {
  const T = S.trend;
  if (!T.open || T.tab !== 'trend' || S.view !== 'search') return;
  if (!T.terms.length) { T.ctrl?.abort(); T.data = null; T.key = ''; T.loading = false; trendRenderChart(); return; }
  const body = trendRequest();
  const key = JSON.stringify(body);
  if (key === T.key && T.data && !T.data.incomplete && !T.loading) return;
  const enCache = T.cache.get(key);
  if (enCache) { T.ctrl?.abort(); ++T.seq; T.data = enCache; T.key = key; T.loading = false; T.error = null; trendRender(); return; }
  T.ctrl?.abort();
  const ctrl = T.ctrl = new AbortController();
  const seq = ++T.seq;
  T.loading = true; T.error = null;
  trendRender();
  try {
    let r, intentos = 0;
    for (;;) {
      r = await api('/ngram', { method: 'POST', body, signal: ctrl.signal });
      if (seq !== T.seq) return;
      const pendiente = r.incomplete || (r.terms || []).some(t => t && t.retry);
      if (!pendiente || intentos >= 6) break;


      intentos++;
      T.data = r; T.key = key;
      trendRender();
      await new Promise(res => setTimeout(res, 80 * intentos));
      if (seq !== T.seq) return;
    }
    T.data = r; T.key = key;
    if (!r.incomplete) {
      T.cache.set(key, r);
      if (T.cache.size > 12) T.cache.delete(T.cache.keys().next().value);
    }
  } catch (e) {
    if (e.name === 'AbortError' || seq !== T.seq) return;
    T.error = e.message;
  } finally {
    if (seq === T.seq) { T.loading = false; trendRender(); }
  }
}

function trendTermTitle(t) {
  if (!t) return 'Pendiente de contar';
  if (!t.ok) return `${t.message || 'Término no válido.'}${t.suggestion ? ` ${t.suggestion}` : ''}`;
  const tipo = { palabra: 'Palabra', prefijo: 'Prefijo', frase: 'Frase' }[t.type] || 'Término';
  const partes = [`${tipo} · ${nf(t.total)} menciones en ${nf(t.total_docs)} intervenciones`];
  if (t.total_corpus != null && t.total_corpus !== t.total) partes.push(`${nf(t.total_corpus)} en todo el corpus`);
  if (t.type === 'prefijo' && t.forms?.length)
    partes.push(`${nf(t.n_forms)} formas: ${t.forms.slice(0, 6).map(f => `${f.form} (${nf(f.n)})`).join(', ')}${t.n_forms > 6 ? '…' : ''}`);
  for (const w of t.warnings || []) if (w?.message) partes.push(w.message);
  partes.push(`Consulta: ${t.query}`);
  return partes.join('\n');
}

function trendChipsHTML() {
  const T = S.trend, pal = trendPal();
  const info = new Map((T.data?.terms || []).map((t, k) => [t.input, { t, k }]));
  const chips = T.terms.map((term, k) => {
    if (T.editing === k)
      return `<input class="tchip-edit" data-tedit-input="${k}" value="${esc(term)}" size="${Math.max(6, term.length + 2)}" aria-label="Editar el término ${k + 1}">`;
    const x = info.get(term), t = x?.t;
    const col = pal.series[(x ? x.k : k) % pal.series.length];
    const err = t && !t.ok;
    const cifra = t?.ok ? ` · ${nf(t.total)}` : (!t && T.loading ? ' · …' : '');
    return `<span class="tchip${err ? ' err' : ''}" style="--c:${col}">`
      + `<i class="tdot" aria-hidden="true"></i>`
      + `<button type="button" class="tchip-lab" data-tedit="${k}" title="${esc(trendTermTitle(t))}\n(clic para editar)">${err ? '⚠ ' : ''}${esc(term)}${cifra}</button>`
      + `<button type="button" class="tchip-x" data-tdel="${k}" aria-label="Quitar ${esc(term)}" title="Quitar">✕</button></span>`;
  }).join('');
  const add = T.terms.length < TREND_MAX
    ? `<input id="trendAdd" class="tadd" placeholder="+ término" aria-label="Añadir términos (separe varios con comas)" title="Palabra, prefijo* o “frase entre comillas”. Varios, separados por comas. Intro para añadir.">`
    : `<span class="tstatus">máx. ${TREND_MAX}</span>`;
  return chips + add;
}

function trendStatusHTML() {
  const T = S.trend, d = T.data;
  const out = [];
  if (T.error) out.push(`<span class="terr">⚠ ${esc(T.error)}</span>`);
  if (d) {
    const den = d.denominators || {};
    out.push(d.filtered
      ? `Con los filtros: ${nf(d.n_allowed)} intervenciones · ${nf(den.tokens_total)} palabras`
      : `Corpus completo · ${nf(den.tokens_total)} palabras`);
    if (T.applyFilters && !Object.keys(trendFilters()).length) out.push('sin filtros activos');
    out.push(esc(TREND_METRICS[T.metric].unit));
    if (d.incomplete) out.push('<span class="terr">contando… (resultado parcial)</span>');
    if (d.errors) out.push(`<span class="terr">${nf(d.errors)} ${d.errors === 1 ? 'término no válido' : 'términos no válidos'}</span>`);
  } else if (T.loading) out.push('Contando…');
  return out.join(' · ');
}

function trendRender() {
  const T = S.trend, box = $('#trendPanel');
  const btn = $('#statsBtn');
  if (btn) { btn.classList.toggle('on', T.open); btn.setAttribute('aria-expanded', String(T.open)); }
  if (!box) return;
  if (!T.open || S.view !== 'search') { box.hidden = true; return; }
  box.hidden = false;

  const act = document.activeElement;
  const escribiendo = act && box.contains(act) && act.matches('#trendAdd, .tchip-edit')
    ? { sel: act.id === 'trendAdd' ? '#trendAdd' : `[data-tedit-input="${act.dataset.teditInput}"]`, value: act.value } : null;

  const seg = (attr, cur, opts) => opts.map(([v, lab, tit]) =>
    `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${String(v) === String(cur)}"${tit ? ` title="${esc(tit)}"` : ''}>${esc(lab)}</button>`).join('');
  const tabs = [['trend', 'Tendencia'], ['dist', 'Distribución']].map(([v, lab]) =>
    `<button type="button" role="tab" data-ttab="${v}" aria-selected="${T.tab === v}">${lab}</button>`).join('');
  const head = `<div class="trow">
      <div class="tseg" role="tablist" aria-label="Contenido del panel">${tabs}</div>
      <span class="grow"></span>
      ${T.tab === 'trend' ? `<div class="tseg" role="group" aria-label="Métrica">${seg('tmetric', T.metric,
          Object.entries(TREND_METRICS).map(([k, m]) => [k, m.label, m.title]))}</div>
        <div class="tseg" role="group" aria-label="Resolución">${seg('tgran', T.gran,
          [['month', 'Mes', 'Serie mensual'], ['year', 'Año', 'Serie anual']])}</div>` : ''}
      <button type="button" class="btn ghost sm" data-tclose title="Plegar el panel (t)" aria-label="Plegar el panel">▴</button>
    </div>`;
  if (T.tab === 'dist') {
    box.innerHTML = head + '<div id="trendDist"></div>' + fuentePieHTML('panel-fuente');
    distLoad();
    return;
  }
  box.innerHTML = head + `
    <div class="trow" id="trendChips">${trendChipsHTML()}<span class="grow"></span>
      <label class="chk tchk" title="Trata «agrario» como «agrario*»: cuenta también agraria, agrarios…"><input type="checkbox" data-topt="variants"${T.variants ? ' checked' : ''}><span>variantes</span></label>
      <label class="chk tchk" title="Calcula la serie solo con las intervenciones que cumplen los filtros de la izquierda, incluida la biblioteca: menciones y palabras salen del mismo subconjunto"><input type="checkbox" data-topt="applyFilters"${T.applyFilters ? ' checked' : ''}><span>aplicar filtros</span></label>
      <label class="chk tchk" title="Hitos históricos del país, numerados sobre el gráfico (cada uno con su fuente)"><input type="checkbox" data-topt="milestones"${T.milestones ? ' checked' : ''}><span>hitos</span></label>
      ${T.milestones ? `<label class="tsel" title="Cuántos hitos se dibujan"><select data-tmslevel aria-label="Cuántos hitos se dibujan">${TREND_MS_LEVELS.map(([v, l, tit]) =>
        `<option value="${v}" title="${esc(tit)}"${String(T.msLevel) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
    </div>
    <div class="trow">
      <div class="tseg" role="group" aria-label="Periodo">${seg('trange', T.range, TREND_RANGES.map(r => [r.id, r.label, r.title]))}</div>
      <label class="tsel" title="Media móvil centrada: Σ menciones / Σ palabras de la ventana, sin cruzar los cortes de 3 o más meses sin sesiones">Suavizado
        <select data-tsmooth${T.gran === 'year' ? ' disabled' : ''}>${[[0, 'no'], [3, '3 meses'], [5, '5 meses']].map(([v, l]) =>
          `<option value="${v}"${T.smooth === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <span class="tstatus grow" id="trendStatus">${trendStatusHTML()}</span>
      <button type="button" class="btn sm" data-texport="csv" title="Tabla larga: un renglón por término y periodo, con metadatos">CSV</button>
      <button type="button" class="btn sm" data-texport="svg" title="Gráfico en SVG autónomo">SVG</button>
    </div>
    <div class="trend-chart" id="trendChart" tabindex="0" role="group" aria-roledescription="gráfico"></div>
    <div class="tfoot">${TREND_ICON.baja} fiabilidad baja · ${TREND_ICON.muy} muy baja (no fija la escala; ▲ si se sale) · ${TREND_ICON.receso} sin sesiones · ${TREND_ICON.corte} meses sin sesiones comprimidos · ← → recorren los meses · clic en un mes: sus intervenciones</div>
    <div id="trendMs"></div>
    ${fuentePieHTML('panel-fuente')}
    <div class="sr-only" aria-live="polite" id="trendLive"></div>`;
  trendRenderChart();
  if (escribiendo) {
    const el = box.querySelector(escribiendo.sel);
    if (el) { el.value = escribiendo.value; el.focus(); }
  }
}

function trendRenderChart() {
  const T = S.trend, box = $('#trendChart'), ms = $('#trendMs');
  if (!box) return;
  T.geom = null;
  if (ms) ms.innerHTML = '';
  if (!T.terms.length) {
    box.innerHTML = `<div class="tempty">Escriba uno o varios términos separados por comas (palabra, prefijo* o
      "frase"), o busque arriba: la tendencia toma las palabras de la búsqueda.</div>`;
    return;
  }
  if (!T.data) {
    box.innerHTML = `<div class="tempty">${T.error ? `⚠ ${esc(T.error)}` : '<span class="spin"></span> Contando menciones por mes…'}</div>`;
    return;
  }
  if (!(T.data.terms || []).some(t => t && t.ok)) {
    box.innerHTML = `<div class="tempty">Ningún término válido: pase el ratón por encima de los términos marcados con ⚠.</div>`;
    return;
  }
  const W = Math.max(320, Math.floor(box.clientWidth || 600));
  T.width = W;
  const { svg, geom } = trendDraw(W, trendPal());
  if (!geom) { box.innerHTML = `<div class="tempty">No hay periodos en este tramo.</div>`; return; }
  T.geom = geom;
  const b = geom.base, gran = b.gran === 'year' ? 'anual' : 'mensual';
  const nombres = geom.series.map(s => s.label).join(', ');
  box.setAttribute('aria-label', `Tendencia ${gran} de ${nombres}, ${TREND_METRICS[T.metric].unit}, de ${
    b.gran === 'year' ? geom.firstKey : mesLargo(geom.firstKey)} a ${b.gran === 'year' ? geom.lastKey : mesLargo(geom.lastKey)}. `
    + 'Use las flechas izquierda y derecha para recorrer los periodos e Intro para ver sus intervenciones.');
  box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${geom.H}" viewBox="0 0 ${W} ${geom.H}" aria-hidden="true">`
    + `${svg}<g class="tcross"></g></svg><div class="trend-tip" hidden></div>${T.loading ? '<span class="tload spin"></span>' : ''}`;
  if (ms && T.milestones) {
    const titulo = h => `${h.desc || h.label}${h.verificar ? ' (fecha pendiente de verificar)' : ''}`;
    const nIn = geom.msIn.length, nHid = geom.msHidden.length, nOut = geom.msOut.length;
    if (!(T.data.milestones || []).length) {
      ms.innerHTML = '<div class="tms-out">No hay hitos históricos registrados para este país.</div>';
    } else {
      // Leyenda plegable con altura acotada: el gráfico no cede espacio por muchos que sean los hitos.
      const abierta = T.msLegend == null ? nIn <= 12 : !!T.msLegend;
      const lista = geom.msIn.map(m => {
        const et = `${esc(m.h.label)} <span class="tms-d">${esc(fechaCorta(m.h.date))}</span>`;
        const enlace = /^https?:\/\//.test(m.h.fuente || '')
          ? `<a href="${esc(m.h.fuente)}" target="_blank" rel="noopener noreferrer">${et}</a>` : et;
        return `<li title="${esc(titulo(m.h))}" data-msn="${m.n}"><span class="tms-n${m.h.rank === 1 ? ' tms-p' : ''}">${m.n}</span>${enlace}</li>`;
      }).join('');
      const resumen = `${nf(nIn)} ${nIn === 1 ? 'hito numerado' : 'hitos numerados'} en el gráfico${geom.msTotal > nIn ? ` de ${nf(geom.msTotal)} del periodo` : ''}`
        + ' · pase el ratón por un número para ver el detalle, o abra su fuente desde esta lista';
      const ocultos = nHid ? `<div class="tms-out">${nf(nHid)} ${nHid === 1 ? 'hito más del periodo no se dibuja' : 'hitos más del periodo no se dibujan'}${
        T.msLevel === 'auto' ? ', porque sus números quedarían lejos de su fecha: elija «todos» si prefiere verlos apretados, o acote el periodo a una legislatura'
        : String(T.msLevel) === '3' ? ' porque no caben en el ancho disponible: acote el periodo a una legislatura o amplíe la ventana'
        : ' por el nivel elegido: elija «todos» o acote el periodo'}.</div>` : '';
      ms.innerHTML = (nIn ? `<details class="tms-wrap" data-tmslegend${abierta ? ' open' : ''}><summary>${resumen}</summary><ol class="tms-list">${lista}</ol></details>` : '')
        + ocultos
        + (nOut ? `<details class="tms-out"><summary>${nf(nOut)} ${nOut === 1 ? 'hito' : 'hitos'} fuera del periodo mostrado</summary>${
          geom.msOut.map(m => `<span title="${esc(titulo(m.h))}">${esc(m.h.label)} (${esc(fechaCorta(m.h.date))})</span>`).join(' · ')}</details>` : '');
    }
  }
  if (T.hover != null) trendHover(T.hover, T.hoverTerm);
}


function trendTipHTML(g, h, termK) {
  const T = S.trend, b = g.base, e = g.hov[h];
  const titulo = k => (b.gran === 'year' ? `Año ${k}` : mesLargo(k));
  if (e.kind === 'gap') {
    const n = e.it.n, u = b.gran === 'year' ? (n === 1 ? 'año' : 'años') : (n === 1 ? 'mes' : 'meses');
    return `<div class="tt-h">${esc(titulo(b.keys[e.it.i0]))} – ${esc(titulo(b.keys[e.it.i1]))}</div>`
      + `<div class="tt-dim">Sin sesiones (${nf(n)} ${u}, comprimidos en el eje)</div>`;
  }
  const i = e.i;
  if (b.empty[i]) return `<div class="tt-h">${esc(titulo(b.keys[i]))}</div><div class="tt-dim">Sin sesiones</div>`;
  const suav = b.gran === 'month' && T.smooth > 1;
  const filas = g.series.map(s => {
    const p = s.vals[i];
    const nombre = `<b>${esc(s.label)}</b>`;
    if (!p) return `<div class="tt-r" style="--c:${s.col}"><i></i><span>${nombre}: sin datos con estos filtros</span></div>`;
    const valor = suav
      ? `${fmtTrend(p.v, T.metric)} <span class="tt-dim">(suav. ${T.smooth} m; bruto ${fmtTrend(p.raw, T.metric)})</span>`
      : fmtTrend(p.raw, T.metric);
    return `<div class="tt-r" style="--c:${s.col}"><i></i><span>${nombre} ${valor}${s.k === termK ? ' ◂' : ''}`
      + `<br><span class="tt-dim">${nf(p.c)} menciones · ${nf(p.d)} interv.</span></span></div>`;
  }).join('');
  const rel = b.rel[i];
  const quien = termK != null ? `«${esc(g.series.find(s => s.k === termK)?.label || '')}»`
    : (g.series.length === 1 ? `«${esc(g.series[0].label)}»` : 'cualquiera de los términos');
  return `<div class="tt-h">${esc(titulo(b.keys[i]))} · <span class="${rel === 'normal' ? '' : 'tt-dim'}">${esc(TREND_REL[rel] || rel)}</span></div>`
    + filas
    + `<div class="tt-dim">${nf(b.tokens[i])} palabras · ${nf(b.speeches[i])} intervenciones · ${nf(b.sessions[i])} sesiones</div>`
    + (+b.tokens[i] > 0 ? `<div class="tt-go">Clic o Intro: intervenciones con ${quien} en ese ${b.gran === 'year' ? 'año' : 'mes'}</div>` : '');
}

function trendHover(h, termK = null, { announce = false } = {}) {
  const T = S.trend, g = T.geom, box = $('#trendChart');
  if (!g || !box) return;
  const cross = box.querySelector('.tcross'), tip = box.querySelector('.trend-tip');
  if (!cross || !tip) return;
  if (h == null || !g.hov[h]) { T.hover = null; T.hoverTerm = null; cross.innerHTML = ''; tip.hidden = true; return; }
  T.hover = h; T.hoverTerm = termK;
  const e = g.hov[h], pal = trendPal();
  let marca = '';
  if (e.kind === 'gap') {
    marca = `<rect x="${e.x0}" y="${g.plotT}" width="${Math.max(1, e.x1 - e.x0)}" height="${g.plotB - g.plotT}" fill="none" stroke="${pal.ink}" stroke-width="0.8" stroke-dasharray="2 2"/>`;
  } else {
    marca = `<line x1="${e.x}" x2="${e.x}" y1="${g.plotT}" y2="${g.plotB}" stroke="${pal.ink}" stroke-width="0.8"/>`;
    for (const s of g.series) {
      const pt = s.pts.find(p => p.i === e.i);
      if (pt) marca += `<circle cx="${pt.x}" cy="${pt.y}" r="${s.k === termK ? 4.6 : 3.4}" fill="${s.col}" stroke="${pal.bg}" stroke-width="1.5"/>`;
    }
  }
  cross.innerHTML = marca;
  tip.innerHTML = trendTipHTML(g, h, termK);
  tip.hidden = false;
  const svg = box.querySelector('svg');
  const escala = svg ? svg.getBoundingClientRect().width / g.W : 1;
  const ancho = tip.offsetWidth, cajaW = box.clientWidth;
  let left = e.x * escala + 14;
  if (left + ancho > cajaW) left = e.x * escala - ancho - 14;
  tip.style.left = `${Math.max(0, left)}px`;
  tip.style.top = `${Math.max(0, g.plotT * escala)}px`;
  if (announce) { const live = $('#trendLive'); if (live) live.textContent = tip.innerText.replace(/\s+/g, ' '); }
}

function trendPointer(e) {
  const T = S.trend, g = T.geom, box = $('#trendChart');
  const svg = box?.querySelector('svg');
  if (!g || !svg) return;
  const r = svg.getBoundingClientRect();
  const x = (e.clientX - r.left) * g.W / r.width, y = (e.clientY - r.top) * g.H / r.height;

  if (y < g.plotT - 2) {
    const m = g.msIn.find(mm => (mm.cx - x) ** 2 + (mm.cy - y) ** 2 <= 81);
    if (m) {
      trendHover(null);
      const tip = box.querySelector('.trend-tip');
      const fuente = (() => { try { return m.h.fuente ? new URL(m.h.fuente).hostname.replace(/^www\./, '') : ''; } catch (e) { return ''; } })();
      tip.innerHTML = `<div class="tt-h">${m.n}. ${esc(m.h.label)}</div><div class="tt-dim">${esc(fechaLarga(m.h.date))}${
          m.h.date_end ? ` – ${esc(fechaLarga(m.h.date_end))}` : ''}${m.h.kind ? ` · ${esc(TREND_KINDS[m.h.kind] || m.h.kind)}` : ''}</div>`
        + (m.h.desc ? `<div>${esc(m.h.desc)}</div>` : '')
        + (fuente ? `<div class="tt-dim">Fuente: ${esc(fuente)}</div>` : '')
        + (m.h.verificar ? '<div class="tt-dim">Fecha pendiente de verificar</div>' : '');
      tip.hidden = false;
      const esc2 = r.width / g.W;
      tip.style.left = `${Math.max(0, Math.min(m.cx * esc2 + 12, box.clientWidth - tip.offsetWidth))}px`;
      tip.style.top = `${(m.cy + 10) * esc2}px`;
      return;
    }
  }
  if (x < g.plotL - 6 || x > g.plotR + 6) { trendHover(null); return; }
  let h = g.hov.findIndex(it => x >= it.x0 && x < it.x1);
  if (h === -1) {
    let mejor = Infinity;
    g.hov.forEach((it, k) => { const dd = Math.abs(it.x - x); if (dd < mejor) { mejor = dd; h = k; } });
  }
  let termK = null;
  const it = g.hov[h];
  if (it && it.kind === 'slot') {




    const ds = [];
    for (const s of g.series) {
      const pt = s.pts.find(p => p.i === it.i);
      if (pt) ds.push([Math.abs(pt.y - y), s.k]);
    }
    ds.sort((a, b) => a[0] - b[0]);
    if (ds.length && ds[0][0] < 8 && y < g.plotB - 8 && !(ds[1] && ds[1][0] - ds[0][0] < 4)) termK = ds[0][1];
  }
  if (h !== T.hover || termK !== T.hoverTerm) trendHover(h, termK);
}




function periodFilter(d, members, meta) {
  const cm = d.corpus_months || {};
  const con = members.filter(i => (+cm.sessions?.[i] || 0) > 0 || (cm.speech_id_ranges?.[i] || []).length);
  if (!con.length) return null;
  if (con.every(i => cm.date_range_exact?.[i] && cm.corpus_date_min?.[i] && cm.corpus_date_max?.[i])) {
    return { date_from: con.map(i => cm.corpus_date_min[i]).sort()[0],
             date_to: con.map(i => cm.corpus_date_max[i]).sort().at(-1),
             period: { ...meta, kind: 'dates' } };
  }
  const ids = [];
  for (const i of con) for (const [a, b] of cm.speech_id_ranges?.[i] || []) for (let x = a; x <= b; x++) ids.push(x);
  return ids.length ? { speech_ids: ids, period: { ...meta, kind: 'ids' } } : null;
}



function trendPick(i, termK = null) {
  const T = S.trend, d = T.data, g = T.geom;
  if (!d || !g) return;
  const b = g.base;
  if (!(+b.tokens[i] > 0)) { toast(b.empty[i] ? 'En ese periodo no hubo sesiones.' : 'Sin intervenciones con estos filtros en ese periodo.'); return; }
  const validos = b.terms;
  const elegidos = termK != null ? validos.filter(t => t.k === termK) : validos;
  if (!elegidos.length) return;
  const consulta = [...new Set(elegidos.map(t => t.query || t.label))].join(' OR ');
  const key = b.keys[i];
  const meta = { key, gran: b.gran, label: b.gran === 'year' ? `año ${key}` : mesLargo(key) };
  const pf = periodFilter(d, b.members[i], meta);
  if (!pf) { toast('No se pudo delimitar ese periodo.', true); return; }



  const conservar = trendFilters();
  const otros = Object.keys(conservar).filter(k => !['date_from', 'date_to', 'speech_ids'].includes(k));
  if (S.view !== 'search') setView('search', { refresh: false });
  resetFiltersState();
  Object.assign(S.filters, conservar);
  delete S.filters.date_from; delete S.filters.date_to; delete S.filters.speech_ids;
  Object.assign(S.filters, pf);
  S.query = consulta; $('#q').value = consulta;
  S.variants = false; $('#variants').checked = false;
  setMode('keyword');
  T.seedQuery = consulta;
  renderFilters();
  search(true);
  if (!T.applyFilters && otros.length)
    toast('Se mantienen sus filtros: la lista puede tener menos intervenciones que la tendencia, que está calculada sobre todo el corpus («aplicar filtros» apagado).');
}

function trendActivate(h, termK) {
  const g = S.trend.geom;
  const e = g?.hov[h];
  if (!e) return;
  if (e.kind === 'gap') { toast('En ese tramo no hubo sesiones.'); return; }
  trendPick(e.i, termK);
}

function trendKey(e) {
  const T = S.trend, g = T.geom;
  if (!g || !g.hov.length) return;
  const ult = g.hov.length - 1;
  let h = T.hover;
  switch (e.key) {
    case 'ArrowRight': h = h == null ? 0 : Math.min(ult, h + 1); break;
    case 'ArrowLeft': h = h == null ? ult : Math.max(0, h - 1); break;
    case 'Home': h = 0; break;
    case 'End': h = ult; break;
    case 'Enter': case ' ':
      if (h != null) { e.preventDefault(); e.stopPropagation(); trendActivate(h, T.hoverTerm); }
      return;
    case 'Escape':
      if (h != null) { e.preventDefault(); e.stopPropagation(); trendHover(null); }
      return;
    default: return;
  }
  e.preventDefault(); e.stopPropagation();
  trendHover(h, null, { announce: true });
}

function trendSetTerms(terms) {
  const T = S.trend;
  const vistos = new Set(), out = [];
  for (const t of terms) {
    const k = foldMap(t).folded;
    if (t && !vistos.has(k)) { vistos.add(k); out.push(t); }
  }
  if (out.length > TREND_MAX) toast(`Como mucho ${TREND_MAX} términos: se quedan los ${TREND_MAX} primeros.`);
  T.terms = out.slice(0, TREND_MAX);
  T.editing = null;
  trendRender();
  trendLoad();
}

function trendCommitEdit(input, cancel = false) {
  const T = S.trend, k = +input.dataset.teditInput;
  if (T.editing !== k) return;
  if (cancel) { T.editing = null; trendRender(); return; }
  const nuevos = splitTerms(input.value);
  const terms = T.terms.slice();
  terms.splice(k, 1, ...nuevos);
  trendSetTerms(terms);
}


function toggleTrend(open) {
  const T = S.trend;
  const cambiaVista = S.view !== 'search';

  if (open === undefined) open = cambiaVista ? true : !T.open;
  if (cambiaVista) setView('search', { refresh: false });
  T.open = open;
  if (!open) {
    T.ctrl?.abort(); T.loading = false; ++T.seq;
    trendRender();
    return;
  }
  trendSyncTerms();
  trendRender();
  if (T.tab === 'trend') trendLoad();
  if (cambiaVista) search(true);
  else setTimeout(() => $('#trendAdd')?.matches(':placeholder-shown') && !T.terms.length && $('#trendAdd').focus(), 0);
}


function trendAfterSearch() {
  const T = S.trend;
  if (!T.open || S.view !== 'search') return;
  trendSyncTerms();
  trendRender();
  if (T.tab === 'trend') trendLoad();
}

function trendSlug() {
  const s = S.trend.terms.map(t => foldMap(t).folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean).join('_');
  return (s || 'terminos').slice(0, 48);
}









function fuenteDe() {
  const f = S.info?.fuente;
  if (f && f.cita && f.declarada) return f;


  const i = S.info || {};
  const st = i.standalone || {};
  const cita = `Diarios de sesiones · ${i.pais_nombre || 'país sin identificar'} · archivo ${st.archivo?.nombre || 'CSV'}`
    + `${i.n_speeches ? ` · ${nf(i.n_speeches)} intervenciones` : ''}${i.date_min ? ` (${i.date_min.slice(0, 4)}–${(i.date_max || '').slice(0, 4)})` : ''}`
    + '. Corpus de diarios de sesiones parlamentarios construido en este navegador a partir del CSV; cite la fuente original del conjunto de datos.';
  const corta = `Diarios de sesiones · ${i.pais_nombre || 'país sin identificar'} (${st.archivo?.nombre || 'CSV'})`;
  return { declarada: false, cita, cita_corta: corta,
           lineas: [`Fuente: ${corta}`, `Archivo: ${st.archivo?.nombre || ''}${st.archivo?.sha256 ? ` · SHA-256 ${st.archivo.sha256}` : ''}`, 'DOI: no declarado', 'Licencia de los datos: no declarada'],
           columnas: { fuente_cita: corta, fuente_doi: '' }, bibtex: `% ${corta}\n`, ris: `TY  - DATA\nN1  - ${corta}\nER  - \n` };
}





function wireCopiaConFuente() {
  document.addEventListener('copy', e => {
    const sel = window.getSelection?.();
    if (!e.clipboardData || !sel || sel.isCollapsed || !sel.rangeCount) return;
    const campo = el => el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
    const nodo = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
    if (campo(e.target) || campo(document.activeElement) || campo(nodo)) return;
    const texto = sel.toString();
    if (!texto.trim()) return;
    const F = fuenteDe();
    if (texto.includes(F.cita_corta) || texto.includes(F.cita) || (F.doi && texto.includes(F.doi))) return;
    const pie = `Fuente: ${F.cita_corta}`;
    const div = document.createElement('div');
    for (let i = 0; i < sel.rangeCount; i++) div.append(sel.getRangeAt(i).cloneContents());
    e.clipboardData.setData('text/plain', `${texto.replace(/\s+$/, '')}\n\n${pie}`);
    e.clipboardData.setData('text/html', `${div.innerHTML}<p>${esc(pie)}</p>`);
    e.preventDefault();
  });
}

const csvCampo = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };




function csvConFuente(meta, cols, filas) {
  const F = fuenteDe(), extra = Object.keys(F.columnas), vals = Object.values(F.columnas);
  return '\uFEFF' + [...F.lineas, ...meta].map(l => `# ${l}`).join('\r\n') + '\r\n'
    + [[...cols, ...extra], ...filas.map(r => [...r, ...vals])].map(x => x.map(csvCampo).join(';')).join('\r\n') + '\r\n';
}




async function copyText(text, hecho) {
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true; }
  } catch {   }
  if (!ok) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.readOnly = true;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    ($('dialog[open]') || document.body).append(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  toast(ok ? hecho : 'No se pudo copiar: seleccione el texto y cópielo con ⌘C / Ctrl+C.', !ok);
}

function copiarFuente(tipo) {
  const F = fuenteDe();
  const que = {
    cita: [F.cita, 'Cita copiada'],
    bibtex: [F.bibtex, 'Cita BibTeX copiada'],
    ris: [F.ris, 'Cita RIS copiada'],
    doi: [F.url || (F.doi ? `doi:${F.doi}` : F.cita), 'DOI copiado'],
  }[tipo];
  if (que) copyText(que[0], que[1]);
}




function fuenteHTML() {
  const F = fuenteDe();
  if (!F.declarada) return `<div class="fuente-box sin"><p class="fuente-aviso" role="note">${esc(F.cita)}</p></div>`;
  const rel = F.publicacion_relacionada || {};
  const relDoi = rel.doi ? `doi:${rel.doi}` : (rel.url || '');
  return `<div class="fuente-box">
    <p class="fuente-cita">${esc(F.cita)}</p>
    ${F.doi || F.url ? `<div class="fuente-dato"><span>DOI</span> <code class="fuente-sel">${esc(F.doi || F.url)}</code>${F.url ? ` · <code class="fuente-sel">${esc(F.url)}</code>` : ''}</div>` : ''}
    ${F.licencia ? `<div class="fuente-dato"><span>Licencia de los datos</span> ${esc(F.licencia)}${F.licencia_url ? ` · <code class="fuente-sel">${esc(F.licencia_url)}</code>` : ''}</div>` : ''}
    ${rel.titulo ? `<div class="fuente-dato"><span>Publicación relacionada</span> ${esc(rel.titulo)}${relDoi ? ` · <code class="fuente-sel">${esc(relDoi)}</code>` : ''}</div>` : ''}
    <div class="fuente-btns" role="group" aria-label="Copiar la cita">
      <button type="button" class="btn sm" data-copiar="cita" title="Copiar la cita completa en texto">Copiar cita</button>
      <button type="button" class="btn sm" data-copiar="bibtex" title="Copiar la cita en BibTeX">BibTeX</button>
      <button type="button" class="btn sm" data-copiar="ris" title="Copiar la cita en RIS (Zotero, EndNote, Mendeley)">RIS</button>
      <button type="button" class="btn sm" data-copiar="doi" title="Copiar el enlace del DOI">DOI</button>
    </div></div>`;
}




function fuentePieHTML(cls = 'panel-fuente') {
  return `<div class="${cls}">Fuente: ${esc(fuenteDe().cita_corta)}</div>`;
}

function downloadText(text, name, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();


  setTimeout(() => URL.revokeObjectURL(a.href), 120000);

  toast(`Elija dónde guardar ${name}`);
}

function trendMetaLines() {
  const T = S.trend, d = T.data, cal = d.calendar || {};
  const suav = T.gran === 'month' && T.smooth > 1;
  return [
    'Explorador de Diarios de Sesiones · tendencia de términos',
    `corpus: ${S.info?.title || S.info?.name || ''}`,
    `generado: ${new Date().toISOString().slice(0, 19)}`,
    `terminos: ${(d.terms || []).map(t => `${t.input}${t.ok ? ` [${t.type}; consulta ${t.query}]` : ` [error: ${t.message || t.error}]`}`).join(' | ')}`,
    `variantes: ${T.variants ? 'sí' : 'no'}`,
    `filtros: ${d.filtered ? JSON.stringify(trendFilters()) : 'ninguno (corpus completo)'}`,
    `resolucion: ${T.gran === 'year' ? 'anual' : 'mensual'}`,
    `suavizado: ${suav ? `${T.smooth} meses (ventana centrada; Σ menciones / Σ palabras; no cruza cortes de 3 o más meses sin sesiones)` : 'no'}`,
    `calendario: ${cal.from || ''} a ${cal.to || ''} · fuente de fechas: ${cal.date_source || 'corpus'}`,
    `fiabilidad: normal >= ${nf(d.thresholds?.normal ?? 100000)} palabras; baja >= ${nf(d.thresholds?.baja ?? 20000)}; muy_baja < ${nf(d.thresholds?.baja ?? 20000)}; sin_sesiones = periodo sin sesiones`,
    'por_10000_palabras = menciones / palabras * 10000; pct_intervenciones = intervenciones_con_termino / intervenciones * 100',
    'separador ; · decimales con punto · UTF-8',
  ];
}

function trendExportCSV() {
  const T = S.trend, d = T.data;
  if (!d) return toast('Aún no hay datos de tendencia.', true);
  const base = trendBase(d, T.gran);
  const seg = segmentsOf(base.empty);
  const sm = base.gran === 'month' && T.smooth > 1 ? T.smooth : 0;
  const dens = deriveSeries(base, { metric: 'density', smooth: sm, seg });
  const pct = deriveSeries(base, { metric: 'pct', smooth: sm, seg });
  const num = v => (v == null || !isFinite(v) ? '' : String(+v.toFixed(4)));
  const cols = ['periodo', 'termino', 'consulta', 'menciones', 'intervenciones_con_termino', 'palabras',
                'intervenciones', 'sesiones', 'por_10000_palabras', 'pct_intervenciones', 'fiabilidad'];
  if (sm) cols.push(`por_10000_palabras_suavizado_${sm}m`, `pct_intervenciones_suavizado_${sm}m`);
  const filas = [];
  base.terms.forEach((t, j) => {
    base.keys.forEach((key, i) => {
      const p = dens[j].pts[i], pp = pct[j].pts[i];
      const fila = [key, t.label, t.query, +t.counts[i] || 0, +t.docs[i] || 0, +base.tokens[i] || 0,
                    +base.speeches[i] || 0, +base.sessions[i] || 0, num(p?.raw), num(pp?.raw),
                    base.empty[i] ? 'sin_sesiones' : base.rel[i]];
      if (sm) fila.push(num(p?.v), num(pp?.v));
      filas.push(fila);
    });
  });

  const texto = csvConFuente(trendMetaLines(), cols, filas);
  downloadText(texto, `tendencia_${trendSlug()}_${base.gran === 'year' ? 'anual' : 'mensual'}.csv`, 'text/csv;charset=utf-8');
}

function trendExportSVG() {
  const T = S.trend, d = T.data;
  if (!d) return toast('Aún no hay datos de tendencia.', true);
  const pal = TREND_PAL.light, W = 1000;
  const { svg, geom } = trendDraw(W, pal, { forExport: true });
  if (!geom) return toast('No hay periodos que exportar.', true);
  const sans = 'Helvetica, Arial, sans-serif';
  const suav = geom.base.gran === 'month' && T.smooth > 1 ? `, suavizado ${T.smooth} meses` : '';
  const titulo = `Tendencia ${geom.base.gran === 'year' ? 'anual' : 'mensual'} · ${TREND_METRICS[T.metric].unit}${suav}`;
  const sub = `${d.filtered ? `Con filtros: ${nf(d.n_allowed)} intervenciones` : 'Corpus completo'} · ${nf(d.denominators?.tokens_total)} palabras · ${S.info?.title || S.info?.name || ''}`;
  const cab = 46;
  const o = [`<rect x="0" y="0" width="${W}" height="HALTO" fill="${pal.bg}"/>`,
    `<text x="14" y="20" font-size="14" font-weight="bold" fill="${pal.ink}">${esc(titulo)}</text>`,
    `<text x="14" y="37" font-size="11" fill="${pal.soft}">${esc(sub)}</text>`,
    `<g transform="translate(0 ${cab})">${svg}</g>`];
  let y = cab + geom.H + 18, x = 14;
  for (const s of geom.series) {
    const t = `${s.label} · ${nf(s.total)}`;
    const w = 22 + t.length * 6.4;
    if (x + w > W - 14) { x = 14; y += 17; }
    o.push(`<circle cx="${x + 5}" cy="${y - 4}" r="4.5" fill="${s.col}"/><text x="${x + 14}" y="${y}" font-size="11" fill="${pal.ink}">${esc(t)}</text>`);
    x += w + 10;
  }
  y += 8;
  if (geom.msIn.length) {
    const col = 3, ancho = (W - 28) / col;
    geom.msIn.forEach((m, k) => {
      const cx = 14 + (k % col) * ancho, cy = y + 16 + Math.floor(k / col) * 15;
      o.push(`<text x="${cx}" y="${cy}" font-size="10" fill="${pal.soft}">${m.n}. ${esc(m.h.label)} (${esc(fechaCorta(m.h.date))})</text>`);
    });
    y += 16 + Math.ceil(geom.msIn.length / col) * 15;
  }
  y += 12;
  const generado = new Date().toISOString().slice(0, 10);
  o.push(`<text x="14" y="${y}" font-size="9.5" fill="${pal.faint}">Círculo hueco: fiabilidad baja · punteado: muy baja (no fija la escala; ▲ si se sale) · rayado: sin sesiones · marcas de corte: meses sin sesiones comprimidos · generado ${esc(generado)}</text>`);

  const F = fuenteDe();
  const pie = `Fuente: ${F.cita_corta}` + (F.declarada && F.url ? ` · ${F.url}` : '')
    + (F.declarada && F.licencia ? ` · Licencia de los datos: ${F.licencia}` : '');
  const cabe = Math.floor((W - 28) / 5.6), renglones = [];
  for (const pal0 of pie.split(' ')) {
    const ult = renglones.length - 1;
    if (ult >= 0 && (renglones[ult] + ' ' + pal0).length <= cabe) renglones[ult] += ' ' + pal0;
    else renglones.push(pal0);
  }
  for (const r of renglones) {
    y += 15;
    o.push(`<text class="fuente" x="14" y="${y}" font-size="10.5" fill="${pal.soft}">${esc(r)}</text>`);
  }
  const alto = Math.ceil(y + 14);


  const dc = (tag, v) => (v ? `<dc:${tag}>${esc(v)}</dc:${tag}>` : '');
  const metadata = '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><rdf:Description rdf:about="">'
    + dc('title', titulo) + dc('description', sub) + dc('source', F.cita)
    + (F.autores || []).map(a => dc('creator', a.nombre)).join('')
    + dc('identifier', F.url || (F.doi ? `doi:${F.doi}` : ''))
    + dc('rights', F.licencia_texto || F.licencia || '') + dc('publisher', F.editor)
    + dc('date', generado) + dc('format', 'image/svg+xml') + dc('language', 'es')
    + '</rdf:Description></rdf:RDF></metadata>';
  const texto = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${alto}" viewBox="0 0 ${W} ${alto}" font-family="${sans}">`
    + `<title>${esc(titulo)}</title><desc>${esc([...F.lineas, ...trendMetaLines()].join('\n'))}</desc>` + metadata
    + o.join('').replace('HALTO', String(alto)) + '</svg>\n';
  downloadText(texto, `tendencia_${trendSlug()}_${geom.base.gran === 'year' ? 'anual' : 'mensual'}.svg`, 'image/svg+xml');
}

function wireTrend() {
  const P = $('#trendPanel');
  P.addEventListener('click', e => {
    const T = S.trend, t = e.target;
    const tab = t.closest('[data-ttab]');
    if (tab) { T.tab = tab.dataset.ttab; trendRender(); if (T.tab === 'trend') trendLoad(); return; }
    if (t.closest('[data-tclose]')) { toggleTrend(false); return; }
    const met = t.closest('[data-tmetric]');
    if (met) { T.metric = met.dataset.tmetric; trendRender(); return; }
    const gr = t.closest('[data-tgran]');
    if (gr) { T.gran = gr.dataset.tgran; T.hover = null; trendRender(); return; }
    const rg = t.closest('[data-trange]');
    if (rg) { T.range = rg.dataset.trange; T.hover = null; trendRender(); return; }
    const ex = t.closest('[data-texport]');
    if (ex) { if (ex.dataset.texport === 'csv') trendExportCSV(); else trendExportSVG(); return; }
    const del = t.closest('[data-tdel]');
    if (del) { const terms = S.trend.terms.slice(); terms.splice(+del.dataset.tdel, 1); trendSetTerms(terms); return; }
    const ed = t.closest('[data-tedit]');
    if (ed) {
      T.editing = +ed.dataset.tedit; trendRender();
      const inp = P.querySelector(`[data-tedit-input="${T.editing}"]`);
      if (inp) { inp.focus(); inp.select(); }
      return;
    }
    const spk = t.closest('[data-spk]');
    if (spk) { S.filters.rep_ids = [+spk.dataset.spk]; renderFilters(); search(true); return; }
    if (t.closest('#trendChart') && T.hover != null) trendActivate(T.hover, T.hoverTerm);
  });
  P.addEventListener('change', e => {
    const T = S.trend, t = e.target;
    if (t.dataset.topt) {
      T[t.dataset.topt] = t.checked;
      if (t.dataset.topt === 'milestones') { trendRender(); return; }
      trendRender(); trendLoad(); return;
    }
    if (t.matches('[data-tsmooth]')) { T.smooth = +t.value || 0; trendRender(); }
    if (t.matches('[data-tmslevel]')) { T.msLevel = t.value; trendRender(); }
  });
  P.addEventListener('toggle', e => {
    const t = e.target;
    if (t && t.matches && t.matches('[data-tmslegend]')) S.trend.msLegend = t.open;
  }, true);
  P.addEventListener('keydown', e => {
    const t = e.target;
    if (t.id === 'trendAdd') {
      const comillasAbiertas = (t.value.match(/"/g) || []).length % 2 === 1;
      if (e.key === 'Enter' || (e.key === ',' && !comillasAbiertas)) {
        e.preventDefault();
        const nuevos = splitTerms(t.value);
        if (!nuevos.length) return;
        t.value = '';
        trendSetTerms([...S.trend.terms, ...nuevos]);
        $('#trendAdd')?.focus();
      } else if (e.key === 'Backspace' && !t.value && S.trend.terms.length) {
        e.preventDefault();
        trendSetTerms(S.trend.terms.slice(0, -1));
        $('#trendAdd')?.focus();
      } else if (e.key === 'Escape') { e.stopPropagation(); t.blur(); }
      return;
    }
    if (t.matches('.tchip-edit')) {
      if (e.key === 'Enter') { e.preventDefault(); trendCommitEdit(t); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); trendCommitEdit(t, true); }
      return;
    }
    if (t.id === 'trendChart') trendKey(e);
  });
  P.addEventListener('focusout', e => {
    if (e.target.matches?.('.tchip-edit') && e.target.isConnected) trendCommitEdit(e.target);
    if (e.target.id === 'trendChart') trendHover(null);
  });
  P.addEventListener('pointermove', e => { if (e.target.closest('#trendChart')) trendPointer(e); });
  P.addEventListener('pointerleave', () => trendHover(null));
  $('#trendPanel').addEventListener('pointerout', e => {
    const c = $('#trendChart');
    if (c && e.target.closest?.('#trendChart') && !c.contains(e.relatedTarget)) trendHover(null);
  });

  let raf = 0;
  S.trend.ro = new ResizeObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const T = S.trend, c = $('#trendChart');
      if (!T.open || T.tab !== 'trend' || !c || !T.data) return;
      if (Math.abs(Math.max(320, Math.floor(c.clientWidth)) - T.width) >= 2) trendRenderChart();
    });
  });
  S.trend.ro.observe(P);

  $('#spectrum').addEventListener('click', e => {
    const b = e.target.closest('[data-ideo]');
    if (!b) return;
    const v = b.dataset.ideo, cur = S.filters.ideologies || [];
    if (cur.length === 1 && cur[0] === v) delete S.filters.ideologies;
    else S.filters.ideologies = [v];
    renderFilters(); search(true);
  });
}





const CONFIRMAR_DESDE = 20000;


function listaInfo() {
  const r = S.lastMeta || {};
  const n = +S.total || 0, sem = r.mode === 'semantic' && !!r.total_is_depth, universo = +r.universo || 0;


  return { n, sem, tope: sem && universo > n, universo, frag: +r.profundidad_fragmentos || 20000,
           proc:   ''  };
}
















function listaActual() {
  return { query: S.query, mode: S.mode, variants: S.variants,
           filters: JSON.parse(JSON.stringify(S.filters || {})), order: S.order   };
}

function fmtBytes(b) {
  b = +b || 0;
  if (b < 1e6) return `${nf(Math.max(1, Math.round(b / 1e3)))} KB`;
  if (b < 1e9) { const mb = b / 1e6; return `${(mb < 10 ? Math.round(mb * 10) / 10 : Math.round(mb)).toLocaleString('es-ES')} MB`; }
  return `${(Math.round(b / 1e8) / 10).toLocaleString('es-ES')} GB`;
}


function syncConfirm(pre) {
  const dlg = $(pre === 'add' ? '#dlgAdd' : '#dlgExport');
  if (dlg._busy) return;


  $(`#${pre}Confirm`).disabled = !!dlg._pending || (pre === 'add' && !(dlg._n > 0))
    || (!$(`#${pre}Big`).hidden && !$(`#${pre}BigOk`).checked);
}



function busyStart(dlg, btn, label) {
  dlg._busy = true;
  const t0 = performance.now(), orig = btn.textContent, st = { label };
  btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  dlg.querySelectorAll('[data-close]').forEach(b => { b.disabled = true; });
  const pinta = () => {
    const s = Math.floor((performance.now() - t0) / 1000);
    btn.textContent = s >= 2 ? `${st.label} ${s} s` : st.label;
  };
  pinta();
  const iv = setInterval(pinta, 500);
  return {
    set(l) { st.label = l; pinta(); },
    end() {
      clearInterval(iv); dlg._busy = false;
      btn.removeAttribute('aria-busy'); btn.textContent = orig;
      dlg.querySelectorAll('[data-close]').forEach(b => { b.disabled = false; });
    },
  };
}

function openAdd(ids, span) {
  const dlg = $('#dlgAdd');
  if (dlg._busy) return;
  dlg._ids = ids; dlg._span = span || null; dlg._lista = null;
  const seq = dlg._seq = (dlg._seq || 0) + 1;
  $('#addBigOk').checked = false;
  if (ids === 'ALL' && listaEspera) {

    dlg._pending = true; dlg._n = 0;
    $('#addSub').textContent = 'Calculando la lista de la búsqueda actual…';
    $('#addBig').hidden = true;
    esperaLista().then(() => {
      if (dlg._seq !== seq || !dlg.open || dlg._busy) return;
      dlg._pending = false; addCifra(dlg);
    });
  } else {
    dlg._pending = false; addCifra(dlg);
  }
  syncConfirm('add');

  const pre = S.collections.some(c => c.id === S.ultimaBiblioteca) ? S.ultimaBiblioteca
    : S.collections.length === 1 ? S.collections[0].id : null;
  $('#addList').innerHTML = S.collections.length
    ? S.collections.map(c => `<label class="chk"><input type="radio" name="colpick" value="${c.id}"${c.id === pre ? ' checked' : ''}>
        <span class="lbl">${esc(c.name)}</span><span class="n">${nf(c.n_items)}</span></label>`).join('')
    : `<p class="dsub">No tiene bibliotecas todavía: escriba un nombre abajo y se creará.</p>`;
  $('#newColName').value = ''; $('#addNote').value = ''; $('#addTags').value = '';
  dlg.showModal();
}


function addCifra(dlg) {
  const ids = dlg._ids;
  let n = Array.isArray(ids) ? ids.length : 0;
  if (ids === 'ALL') {
    const L = listaInfo();
    n = L.n;
    dlg._lista = listaActual();
    $('#addSub').textContent = !n ? 'La búsqueda actual no lista ninguna intervención.'





      : n === 1 ? `Se guardará la única intervención de la lista${L.proc ? ` (${L.proc})` : ''}.`
      : `Se guardarán las ${nf(n)} intervenciones de la lista${L.proc ? ` (${L.proc})` : ''}, en su mismo orden.`;
  } else {
    $('#addSub').textContent = `${nf(n)} ${n === 1 ? 'intervención' : 'intervenciones'}.`;
  }
  dlg._n = n;
  $('#addBigOk').checked = false;
  $('#addBig').hidden = n <= CONFIRMAR_DESDE;
  if (n > CONFIRMAR_DESDE) {
    $('#addBigTxt').textContent = `Son ${nf(n)} intervenciones. Guardarlas lleva unos segundos, pero el `
      + 'Léxico de una biblioteca tan grande puede tardar minutos la primera vez que lo abra.';
    $('#addBigLbl').textContent = `Sí, guardar las ${nf(n)}`;
  }
  syncConfirm('add');
}

async function doAdd() {
  const dlg = $('#dlgAdd'), btn = $('#addConfirm');
  if (dlg._busy || btn.disabled) return;
  const nuevo = $('#newColName').value.trim();
  let cid = $('input[name=colpick]:checked')?.value;
  if (!nuevo && !cid) return toast('Elija una biblioteca o escriba un nombre nuevo.', true);
  const n = dlg._n || 0;
  const busy = busyStart(dlg, btn, n > 1 ? `Guardando ${nf(n)}…` : 'Guardando…');
  try {
    if (nuevo) { cid = (await api('/collections', { method: 'POST', body: { name: nuevo } })).id; }

    const tags = $('#addTags').value.split(',').map(s => s.trim()).filter(Boolean);
    const body = { note: $('#addNote').value.trim(), tags };
    if (dlg._ids === 'ALL') Object.assign(body, {


      add_all_results: true, ...(dlg._lista || listaActual()) });
    else {
      body.speech_ids = dlg._ids;
      if (dlg._span) { body.char_start = dlg._span[0]; body.char_end = dlg._span[1]; }
    }
    const r = await api(`/collections/${cid}/items`, { method: 'POST', body });
    S.ultimaBiblioteca = +cid;
    S.statsCache = null;
    await refreshCollections();


    const visibles = new Set(S.results.map(x => x.id));
    const marcados = dlg._ids === 'ALL' ? (r.speech_ids || []).filter(id => visibles.has(id)) : dlg._ids;
    for (const id of marcados) {
      if ((S.membership[id] || []).includes(+cid)) continue;
      S.membership[id] = [...(S.membership[id] || []), +cid];

      if (S.current?.id === id && !(S.current.collections || []).includes(+cid))
        S.current.collections = [...(S.current.collections || []), +cid];
    }
    dlg.close();
    const g = r.guardadas ?? r.added, ya = r.ya_estaban ?? r.skipped, rc = r.recorte;
    toast(`${nf(g)} ${g === 1 ? 'guardada' : 'guardadas'} en «${r.collection.name}»`
      + (ya ? ` · ${nf(ya)} ${ya === 1 ? 'ya estaba' : 'ya estaban'}` : '')
      + (!rc ? '' : rc.motivo === 'significado'
        ? ` · las ${nf(rc.tomadas)} más parecidas de ${nf(rc.de)}`
        : ` · las ${nf(rc.tomadas)} primeras de ${nf(rc.de)}`));
    if (S.view === 'library') renderLibraryView(); else refreshHitMarkers();
  } catch (e) { toast(e.message, true); }
  finally { busy.end(); syncConfirm('add'); }
}


function expBody(dlg) {
  const body = { format: $('#expFormat').value, include_text: $('#expText').checked };
  if (dlg._lib) body.collection_id = dlg._lib;
  else Object.assign(body, dlg._lista || listaActual());
  return body;
}

function expSubTxt(dlg) {
  const n = dlg._n || 0, e = dlg._est && !dlg._est.error ? dlg._est : null;
  const interv = n === 1 ? 'intervención' : 'intervenciones';
  if (dlg._lib) return `Biblioteca «${S.collections.find(c => c.id === dlg._lib)?.name || ''}» · ${nf(n)} ${interv}.`;
  const L = listaInfo();

  if (!e && dlg._pending) return `Resultados de la búsqueda actual${L.proc ? `, ${L.proc}` : ''} · calculando…`;









  return `Resultados de la búsqueda actual${L.proc ? `, ${L.proc}` : ''} · ${nf(n)} ${interv} en el orden de la lista.`;
}



function openExport({ lib = null, format = null, alCerrar = null } = {}) {
  const dlg = $('#dlgExport');
  if (dlg._busy) return;
  const cidLib = lib ?? (S.view === 'library' && S.libSel != null ? S.libSel : null);
  const enLib = cidLib != null;

  if (!enLib && S.similarOf) return toast('Exportar trabaja sobre la búsqueda o una biblioteca: pulse Buscar para volver a la lista.', true);
  dlg._lib = enLib ? cidLib : null;



  dlg._lista = enLib ? null : listaActual();
  const col = enLib ? S.collections.find(c => c.id === dlg._lib) : null;
  dlg._n = col ? +col.n_items || 0 : (listaEspera ? 0 : +S.total || 0);
  dlg._est = null; dlg._pending = true;
  $('#expBigOk').checked = false;
  const fmtAntes = $('#expFormat').value;
  $('#expFormat').querySelector('option[value=bundle]').disabled = !enLib;
  if (!enLib && $('#expFormat').value === 'bundle') $('#expFormat').value = 'csv';
  if (format && format !== fmtAntes && !$(`#expFormat option[value="${format}"]`)?.disabled) {
    $('#expFormat').value = format;



    dlg.addEventListener('close', () => { $('#expFormat').value = fmtAntes; }, { once: true });
  }
  $('#expSub').textContent = expSubTxt(dlg);
  updateExpNote();
  if (alCerrar) dlg.addEventListener('close', () => setTimeout(alCerrar, 0), { once: true });
  dlg.showModal();

  const seq = dlg._seq = (dlg._seq || 0) + 1;
  api('/export/estimate', { method: 'POST', body: expBody(dlg) }).then(e => {
    if (dlg._seq !== seq || !dlg.open) return;
    dlg._est = e; dlg._n = +e.filas || 0; dlg._pending = false;
    $('#expSub').textContent = expSubTxt(dlg);
    updateExpNote();
  }).catch(async () => {
    if (dlg._seq !== seq) return;

    await esperaLista();
    if (dlg._seq !== seq || !dlg.open) return;
    dlg._est = { error: true }; dlg._pending = false;
    if (!dlg._lib) dlg._n = +S.total || 0;
    $('#expSub').textContent = expSubTxt(dlg);
    updateExpNote();
  });
}

function updateExpNote() {
  const notas = {
    csv: 'Separador «;» y codificación UTF-8 con BOM: Excel y Numbers en español lo abren con un doble clic. Las 4 primeras líneas (empiezan por #) son la cita; en R, read.csv2(skip = 4); en pandas, comment="#" o skiprows=4.',
    markdown: 'Un documento con el texto completo, las notas y las etiquetas, listo para leer o convertir a Word o PDF.',
    json: 'Estructura completa con metadatos, para reutilizar en Python o R.',
    citations: 'Una línea por intervención con diputado, sesión, fecha y legislatura.',
    bundle: 'Archivo intercambiable: un colega puede importarlo y obtener su misma biblioteca con notas y etiquetas.',
  };
  const fmt = $('#expFormat').value;
  $('#expNote').textContent = notas[fmt] || '';

  const donde = {
    csv: 'en las 4 líneas # del principio (cita completa, DOI, licencia y publicación relacionada) y en las columnas fuente_cita y fuente_doi de cada fila',
    markdown: 'en el encabezado YAML, en la sección «Fuente» del principio, en cada intervención y al pie',
    json: 'en meta.fuente (con BibTeX, RIS y CSL-JSON) y en fuente_cita y fuente_doi de cada registro',
    citations: 'en la cabecera, al final de cada referencia y, al pie, en BibTeX y RIS',
    bundle: 'en los metadatos del paquete y en fuente_cita y fuente_doi de cada item; se conserva al importarlo y al volver a exportarlo',
  };
  const F = fuenteDe();
  $('#expFuente').textContent = F.declarada
    ? `El archivo incluye la cita de la fuente (${F.cita_corta}) ${donde[fmt] || ''}.`
    : `${F.cita} El archivo incluye este aviso ${donde[fmt] || ''}.`;
  $('#expText').disabled = ['citations', 'bundle'].includes(fmt);


  const dlg = $('#dlgExport'), e = dlg._est;
  const sinTexto = ['citations', 'bundle'].includes(fmt) || !$('#expText').checked;
  const bytes = e && !e.error ? e.bytes_estimados?.[fmt]?.[sinTexto ? 'sin_texto' : 'con_texto'] : null;
  const tam = bytes != null ? `≈ ${fmtBytes(bytes)}` : '';
  $('#expSize').textContent = !e ? 'Calculando el tamaño del archivo…'
    : !tam ? ''
    : `Tamaño estimado: ${tam} (aproximado; ${['citations', 'bundle'].includes(fmt) ? 'este formato no lleva el texto'
      : sinTexto ? 'sin el texto completo' : 'con el texto completo'}).`;


  const n = dlg._n || 0, big = n > CONFIRMAR_DESDE;
  $('#expBig').hidden = !big;
  if (big) {
    $('#expBigTxt').textContent = `Son ${nf(n)} intervenciones: el archivo pesará `
      + (tam ? `${tam} (aproximado)` : 'bastante') + ' y prepararlo puede llevar unos segundos.';
    $('#expBigLbl').textContent = `Sí, exportar las ${nf(n)}`;
  }
  syncConfirm('exp');
}

async function doExport() {
  const dlg = $('#dlgExport'), btn = $('#expConfirm');
  if (dlg._busy || btn.disabled) return;
  const body = expBody(dlg), n = dlg._n || 0;
  const busy = busyStart(dlg, btn, n > 1 ? `Preparando ${nf(n)}…` : 'Preparando…');
  try {
    const r = await fetch('/api/export', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Falló la exportación');
    busy.set('Descargando…');
    const blob = await r.blob();
    const name = (r.headers.get('Content-Disposition') || '').match(/filename="(.+?)"/)?.[1] || 'export';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
    const filas = r.headers.get('X-Export-Filas'), motivo = r.headers.get('X-Export-Recorte-Motivo');
    const de = +r.headers.get('X-Export-Recorte-De') || 0;
    dlg.close();
    toast(`Elija dónde guardar ${name}` + (filas != null ? ` · ${nf(+filas)} ${+filas === 1 ? 'fila' : 'filas'}` : '')
      + (motivo && de ? (motivo === 'significado' ? ` · las más parecidas de ${nf(de)}` : ` · las primeras de ${nf(de)}`) : ''));
  } catch (e) { toast(e.message, true); }
  finally { busy.end(); syncConfirm('exp'); }
}

async function loadSaved() {
  try {
    const { searches } = await api('/searches');


    S.saved = new Map(searches.map(s => [s.id, s]));
    const box = $('#savedBox');
    if (!box) return;


    box.innerHTML = searches.length ? searches.map(s => `
      <div class="chk" style="justify-content:space-between">
        <span class="lbl" style="cursor:pointer;color:var(--accent-text)"
          data-runsearch="${esc(s.id)}" title="${esc(s.query
            + (s.biblioteca_borrada ? ' · su biblioteca se ha borrado: buscará en todo el corpus' : ''))}">${esc(s.name)}${
            s.biblioteca_borrada ? ' <span class="saved-gone">(biblioteca borrada)</span>' : ''}</span>
        <button class="btn ghost sm" data-delsearch="${s.id}">×</button>
      </div>`).join('')
      : `<p class="dsub" style="font-size:11px;margin:0">Ninguna todavía.</p>`;
  } catch {   }
}



function helpSearchModesHTML() {
































  return `<h4 style="margin:16px 0 6px;font-size:13px">Cómo buscar</h4>
  <p class="dsub" style="line-height:1.6">La búsqueda encuentra las palabras que escriba en los ${nf(S.info?.n_words || 0)} palabras
    del corpus abierto. Encima de la lista, «Se busca» muestra cómo se ha entendido la consulta.</p>
  <table class="help-sintaxis">
    <thead><tr><th scope="col">Escriba</th><th scope="col">Encuentra</th></tr></thead>
    <tbody>
      <tr><td><code>reforma</code></td><td>esa palabra (no «reformas» ni «reformar»)</td></tr>
      <tr><td><code>"voto femenino"</code></td><td>la frase exacta: esas palabras seguidas y en ese orden (valen también « » y “ ”)</td></tr>
      <tr><td><code>reforma + agraria</code></td><td>las dos palabras, en cualquier parte de la intervención; <code>reforma agraria</code>, sin signo, es lo mismo</td></tr>
      <tr><td><code>divorcio | matrimonio</code></td><td>cualquiera de las dos</td></tr>
      <tr><td><code>(reforma | ley) + agraria</code></td><td>paréntesis para agrupar; sin ellos, <code>+</code> se aplica antes que <code>|</code></td></tr>
    </tbody>
  </table>
  <p class="dsub" style="line-height:1.6">
    <b>Sin acentos ni mayúsculas:</b> <code>constitucion</code> encuentra «Constitución». Los signos de puntuación separan
    palabras: <code>art.26</code> busca la frase «art 26».<br>
    <b>Palabras muy frecuentes</b> (de, la, que, por…): se omiten cuando van unidas a otras con <code>+</code> o sin
    signo, y «Se busca» lo avisa. Entre comillas sí cuentan (<code>"de la guerra"</code>) y solas también se buscan.<br>
    <b>No se admiten</b> el asterisco (<code>agrar*</code>) ni la exclusión (<code>NOT</code>); <code>AND</code> y
    <code>OR</code> se escriben <code>+</code> y <code>|</code>. Para las variantes de una palabra, únalas:
    <code>agraria | agrario | agrarios</code>.
  </p>`;

}

function helpConjuntoTxt() {



  return '';

}

function helpTopeProfundidadHTML() {










  return '';

}

function helpAtajoModosHTML() {



  return '';

}

function helpOtrosCorpusHTML() {









  return '';

}

function helpErratasTxt() {





  return ` Si una búsqueda no da lo que espera, pruebe otras formas de la palabra unidas con
    <code>|</code>.`;

}

function helpHTML() {
  return `
  <h4 style="margin:0 0 6px;font-size:13px">Qué es este explorador</h4>
  <p class="dsub" style="line-height:1.6">
    El explorador de <b>ParlaIbero</b>, la colección de discursos parlamentarios de las cámaras bajas de
    América Latina, Portugal y España (Instituto de Iberoamérica, Universidad de Salamanca; proyecto
    PID2022-141706NB-C22). Se abre el CSV de intervenciones de un país, descargado de Harvard Dataverse
    (todos comparten el mismo formato), y se construye en el navegador una base de datos con búsqueda de
    texto completo. Nada sale de su equipo. Las bibliotecas que cree se guardan por país.</p>
  <h4 style="margin:16px 0 6px;font-size:13px">Cómo citar</h4>
  <p class="dsub" style="line-height:1.6">
    Cada país es un conjunto de datos con su propio DOI: cítelo siempre que use el corpus, una cifra, una
    tabla o un pasaje. La cita del país cargado, con sus botones para copiarla en texto, BibTeX o RIS:</p>
  ${fuenteHTML()}
  <p class="dsub" style="line-height:1.6">
    Todo lo que descarga la app lleva la referencia del corpus, en los datos y en los metadatos:
    <b>CSV</b>, cuatro líneas <code>#</code> al principio (cita completa, DOI, licencia y
    publicación relacionada) y columnas <code>fuente_cita</code> y <code>fuente_doi</code> en cada fila;
    <b>JSON</b>, <code>meta.fuente</code> (con BibTeX, RIS y CSL-JSON) y <code>fuente_cita</code> y
    <code>fuente_doi</code> en cada registro; <b>Markdown</b>, encabezado YAML, sección «Fuente», una
    línea en cada intervención y pie; <b>Referencias</b>, cabecera, final de cada línea y la cita en
    BibTeX y RIS; <b>.2replib</b>, en los metadatos del paquete y en cada item, que se conservan al
    importarlo y al reexportarlo. Los CSV de Tendencia y Léxico la llevan en sus líneas
    <code>#</code> (siempre cuatro de fuente) y en cada fila, y el SVG, en el pie visible y en sus
    metadatos. Los paneles de Tendencia, Distribución y Léxico muestran la fuente (el
    lector no la repite en cada discurso), y al copiar un pasaje con
    ⌘C / Ctrl+C se añade la cita breve. El DOI se puede seleccionar y copiar como texto.
  </p>
  ${helpSearchModesHTML()}
  <h4 style="margin:16px 0 6px;font-size:13px">Bibliotecas</h4>
  <p class="dsub" style="line-height:1.6">
    Un grupo curado de intervenciones, con nota y etiquetas propias. Se guardan en
    su ordenador, aparte del corpus, así que actualizar la base no borra su trabajo.
    Puede restringir una búsqueda a una biblioteca, exportarla a CSV o Markdown, y
    compartirla en un archivo <code>.2replib</code>.<br><br>
    <b>Borrar una biblioteca.</b> En <b>Mis bibliotecas</b>, ábrala y pulse <b>Borrar biblioteca</b>
    (junto a «Exportar biblioteca»), o pulse 🗑 en su fila de la lista. La app pide confirmación con el
    nombre y el número de intervenciones, y ofrece <b>exportarla antes a <code>.2replib</code></b> para
    conservar una copia con notas y etiquetas: el borrado <b>no se puede deshacer</b>. Las
    intervenciones siguen en el corpus; solo se pierde la selección. Si la búsqueda de Explorar estaba
    restringida a ella, se quita esa restricción y se vuelve a buscar. Las búsquedas guardadas que la
    usaban se conservan, marcadas «(biblioteca borrada)», y al lanzarlas buscan en todo el corpus.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">«Guardar todo» y Exportar</h4>
  <p class="dsub" style="line-height:1.6">
    Los dos toman la <b>lista completa</b> que está viendo, no solo lo cargado ni un tope fijo:
    el mismo conjunto${helpConjuntoTxt()} y el mismo orden. Una búsqueda
    por palabras con 12.756 resultados guarda o exporta las 12.756; la navegación sin texto de
    una legislatura entera, sus decenas de miles. El diálogo da la cifra exacta y, al exportar,
    un tamaño <i>aproximado</i> del archivo según el formato y si incluye el texto completo.<br><br>
    ${helpTopeProfundidadHTML()}Si pulsa «Guardar todo» o Exportar mientras una búsqueda nueva todavía se está calculando,
    el diálogo espera a que termine antes de dar la cifra y de dejarle confirmar.<br><br>
    Por encima de <b>20.000</b> intervenciones el diálogo avisa con la cifra y pide marcar
    «Sí, guardar las N» o «Sí, exportar las N» antes de continuar: guardar tarda segundos, pero
    el Léxico de una biblioteca tan grande puede tardar minutos la primera vez, y un CSV con el
    texto completo del corpus pesa cientos de MB.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">Tendencia y clima de sala</h4>
  <p class="dsub" style="line-height:1.6">
    <b>📈 Tendencia</b> (tecla <kbd>t</kbd>) abre encima de la lista la serie mensual de hasta
    8 términos: se siembran con las palabras de la búsqueda y se editan como etiquetas
    (separe varios con comas; frases entre comillas; <code>prefijo*</code>). Por defecto
    cuenta en todo el corpus; con <b>aplicar filtros</b> usa solo lo que dejan pasar los
    filtros, incluida la biblioteca. Métrica por 10.000 palabras, absoluta o % de
    intervenciones; vista por mes o por año y suavizado, sin volver a calcular.
    Los recesos van rayados y las rachas largas sin sesiones, comprimidas.
    Un clic en un mes (o <kbd>←</kbd> <kbd>→</kbd> e Intro) busca sus intervenciones con
    ese término. La pestaña <b>Distribución</b> muestra años, sexo, tipo de sesión, partidos y oradores.<br><br>
    <b>Qué es una palabra.</b> Menciones y denominadores salen del índice de búsqueda: una
    palabra es un <i>token</i> (letras o cifras seguidas, sin acentos ni mayúsculas; «S. S.»
    cuenta dos), así que los totales difieren algo del recuento de palabras de cada
    intervención. <b>Fiabilidad</b> de cada mes según las palabras pronunciadas: normal con
    100.000 o más; baja (punto hueco ○) entre 20.000 y 100.000; muy baja (◌) por debajo de
    20.000, que no fija la escala del eje y marca ▲ si se sale. Los meses débiles se marcan,
    no se ocultan: un pico en un mes con pocas sesiones puede deberse a una sola intervención.<br><br>
    Las insignias de cada resultado cuentan las acotaciones de la intervención completa:
    <span class="tag clima conflict">Rumores</span> tumulto,
    <span class="tag clima applause">Aplausos</span> ovación,
    <span class="tag clima order">Presidencia</span> llamadas al orden y
    <span class="tag clima">Risas</span> lo demás.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">El lector: pliego del Diario, § y acotaciones</h4>
  <p class="dsub" style="line-height:1.6">
    Cada intervención se lee como un pliego del Diario. <b>§ n</b>, en el margen, numera sus
    párrafos de prosa y sus tablas; la numeración depende solo del texto, así que sirve para
    citar. Cuando el original no separa párrafos, una intervención larga se reparte por
    frases (lo indica el § al pasar el ratón). Las <b>acotaciones</b> del acta van en bloque
    entre párrafos o en línea dentro de la frase, con un color por clase:<br>
    <span class="acot-inline applause">(Aplausos.)</span> verde: ovación, aplausos y aprobación ·
    <span class="acot-inline conflict">(Rumores.)</span> lacre: tumulto, rumores, protestas e
    interrupciones · <span class="acot-inline order">(El Sr. Presidente agita la campanilla.)</span>
    ámbar: la Presidencia (campanilla, llamadas al orden; nunca el Presidente del Consejo) ·
    <span class="acot-inline neutral">(Risas.)</span> gris: risas, interjecciones sueltas,
    asentimiento, pausas y gestos.<br>
    La crónica del acta va en cursiva y las votaciones, en columnas. La clasificación es
    automática: algún paréntesis puede quedar mal clasificado.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">Sesión corrida y careo</h4>
  <p class="dsub" style="line-height:1.6">
    <b>📖 Sesión corrida</b> (tecla <kbd>s</kbd>) muestra la sesión entera, con la intervención
    abierta enmarcada en oro. <b>🎯</b> vuelve a ella y el selector salta a cualquier orden;
    «Ver solo este» abre una intervención en el lector. La cabecera da la sesión, la fecha, la
    legislatura y el periodo de sesiones.<br><br>
    <b>⚔ Carear</b> (tecla <kbd>c</kbd>) pone la intervención junto a una réplica, en dos pliegos
    que se desplazan por separado. <b>Misma sesión</b> propone réplicas por alusión al apellido
    o al cargo, interrupciones transcritas, cercanía en el orden del debate y otro partido;
    <b>Mismo diputado</b>, intervenciones del mismo orador parecidas por vocabulario
    y alejadas en el tiempo, con el pasaje parecido en verde. Es una <b>heurística</b>: cada
    propuesta muestra sus motivos, pero no prueba que hubiera diálogo. <b>⇄</b> intercambia los
    pliegos, cada pliego se abre en el lector o en su sesión corrida, y «Volver al lector» (o
    <kbd>c</kbd>) sale del careo.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">Léxico de una biblioteca (keyness)</h4>
  <p class="dsub" style="line-height:1.6">
    En <b>Mis bibliotecas</b>, la pestaña <b>Léxico</b> compara el vocabulario de la biblioteca
    con el resto del corpus. Con <b>Solo discurso</b> (marcado por defecto) analiza únicamente la
    prosa de los oradores: excluye listas de votación, crónica del acta, acotaciones, tablas, notas
    y cabeceras de página, y la tabla indica cuántas palabras quedan fuera; desmárquelo para
    analizar las intervenciones completas. <b>TTR</b> es la proporción de términos distintos sobre palabras:
    baja al crecer la biblioteca, así que compare solo bibliotecas de tamaño parecido.
    <b>Keyness G²</b> (log-likelihood de Dunning) mide si un término aparece en la biblioteca
    más de lo esperable: solo se listan los de G² ≥ 10,83 (p &lt; 0,001) con al menos 5
    apariciones, sin palabras vacías. El <b>log-ratio</b> es el tamaño del efecto (cada punto
    duplica la frecuencia relativa): <i>Exclusivo</i> ≥ 6 o ausente del resto del corpus,
    <i>Muy distintivo</i> entre 3 y 6, <i>Significativo</i> por debajo de 3. Con miles de
    términos evaluados a la vez, fíjese más en el log-ratio que en el G². Un clic en un
    término lo busca en modo Palabras dentro de la biblioteca; <b>Exportar tabla</b> descarga
    el CSV.
  </p>
  <h4 style="margin:16px 0 6px;font-size:13px">Atajos</h4>
  <p class="dsub" style="line-height:1.9">
    <kbd>/</kbd> ir al buscador · <kbd>↵</kbd> buscar · <kbd>Esc</kbd> cerrar el lector<br>
    <kbd>j</kbd> / <kbd>k</kbd> siguiente / anterior resultado · <kbd>↵</kbd> abrir el resultado<br>
    <kbd>a</kbd> guardar en una biblioteca${helpAtajoModosHTML()}<br>
    <kbd>t</kbd> abrir o plegar el panel de <b>Tendencia</b><br>
    <kbd>s</kbd> alternar el lector entre <b>Discurso</b> y <b>Sesión corrida</b> (toda la sesión seguida;
    🎯 vuelve a la intervención de referencia)<br>
    <kbd>c</kbd> abrir o cerrar el <b>Careo</b> de la intervención abierta<br>
    <kbd>f</kbd> plegar o desplegar el panel lateral (también con « en su cabecera y con la franja que queda al plegarlo)<br>
    <kbd>l</kbd> plegar o desplegar la lista de intervenciones mientras lee (también con « en su cabecera y » en la franja)<br>
    <kbd>r</kbd> volver al estado inicial (o el botón ↺ de la cabecera)
  </p>
  ${helpOtrosCorpusHTML()}
  <h4 style="margin:16px 0 6px;font-size:13px">Una advertencia sobre el texto</h4>
  <p class="dsub" style="line-height:1.6">
    El texto procede de la extracción automática de los diarios originales (PDF u OCR), así que
    puede contener errores de reconocimiento y de segmentación de oradores.${helpErratasTxt()} Muchas
    intervenciones son de trámite; filtre por longitud mínima para centrarse en los discursos. El
    <b>encabezado y sumario</b> de cada sesión (fila sin orador) se puede excluir con «Solo lo que se habla».
  </p>
  <p class="dsub" style="line-height:1.6">
    Cuando una fecha tiene varias sesiones (ordinaria, extraordinaria, solemne…), la ficha lo indica;
    el «n.º de orden en el corpus» de una sesión es correlativo dentro del archivo y no coincide con
    el número oficial de la sesión, que se muestra aparte cuando el CSV lo trae.
  </p>`;
}


{
  const helpHTMLEscritorio = helpHTML;
  helpHTML = () => {
    const h = helpHTMLEscritorio();
    return document.documentElement.dataset.estilo !== 'clasico' ? h.replace('(Rumores.)</span> lacre:', '(Rumores.)</span> teja:') : h;
  };
}










function resetFiltersState() {
  S.filters = {};
}

function resetAll() {
  const porDefecto = S.info && S.info.has_semantic ? 'hybrid' : 'keyword';
  S.query = ''; S.variants = false; S.order = 'relevance';
  resetFiltersState(); S.offset = 0; S.results = []; S.exhausted = false;
  S.selected = null; S.similarOf = null; S.libSel = null; S.membership = {};
  teardownSession(S.session);
  S.session = null; S.current = null; S.cursor = null; S.speechScroll = null;
  S.readMode = 'speech'; ++S.readSeq;
  S.careo.ctrl?.abort(); S.careo = careoState();
  S.libTab = 'items'; S.libInfo = null; S.lex.ctrl?.abort(); ++S.lex.seq;
  menAbortar(); MEN.cache.clear();

  $('#q').value = '';
  $('#variants').checked = false;
  $('#order').value = 'relevance';
  S.trend.ctrl?.abort();
  S.trend = Object.assign(trendState(), { ro: S.trend.ro, cache: S.trend.cache });
  S.statsCache = null;
  trendRender();
  $('#spectrum').hidden = true;
  $('#app').classList.add('no-reader');
  $('#app').classList.remove('wide-reader', 'session-mode', 'careo-mode');
  $('#reader').innerHTML = '';
  updateReadHead();

  setMode(porDefecto);
  if (S.view !== 'search') { setView('search', { refresh: false }); } else { renderFilters(); }
  search(true);
  $('#q').focus();
  toast('Vuelta al estado inicial');
}

function setMode(m) {
  S.mode = m;





  $$('.modes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
}

function wire() {
  $$('.modes button').forEach(b => b.onclick = () => {
    toExplore();
    setMode(b.dataset.mode);
    if (S.mode === 'semantic') S.order = 'relevance';
    search(true);
  });
  $('#go').onclick = () => {
    const q = $('#q').value.trim();






    S.query = q; toExplore(); search(true);
  };
  $('#q').onkeydown = e => { if (e.key === 'Enter') $('#go').click(); };
  $('#variants').onchange = e => { toExplore(); S.variants = e.target.checked; search(true); };
  $('#order').onchange = e => { toExplore(); S.order = e.target.value; search(true); };
  $('#statsBtn').onclick = () => toggleTrend();
  wireTrend();
  $('#exportBtn').onclick = () => openExport();


  $('#saveAllBtn').onclick = () => {


    if (!listaEspera && !S.total) return toast('No hay resultados que guardar.');
    openAdd(S.similarOf && !listaEspera ? S.results.map(r => r.id) : 'ALL');
  };
  $('#themeBtn').onclick = () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';


    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('tema', t); } catch (e) { void e; }




    if (S.trend.open && S.trend.tab === 'trend') trendRender();
  };
  $('#helpBtn').onclick = () => { $('#helpBody').innerHTML = helpHTML(); $('#dlgHelp').showModal(); };



  $('#settingsBtn').onclick = () => { const A = globalThis.R2 && globalThis.R2.ajustes; if (A) A.abrir(); };
  document.addEventListener('r2:ajustes', () => {
    if (S.trend.open && S.trend.tab === 'trend') trendRender();
    for (const c of $$('.r2-capital')) capitalIluminada(c);
  });

  $('#importLibFile').onchange = e => importLibraryFile(e.target.files?.[0]);


  $('#filters').addEventListener('click', e => {
    if (e.target.closest('#exportAllBtn')) { exportarTodas(); return; }
    if (e.target.closest('#usarAquiBtn')) {
      const P = globalThis.R2 && globalThis.R2.persistencia;
      if (P && typeof P.usarAqui === 'function') Promise.resolve(P.usarAqui()).catch(err => toast(err.message, true));
      return;
    }
    if (e.target.closest('#projLibBtn')) { proyectoDialogo(); return; }
    if (e.target.closest('#descargarDanadaBtn')) { almacenDescargarDanada(); return; }
    if (e.target.closest('#descartarDanadaBtn')) { almacenDescartarDanada(); return; }
  });


  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copiar]');
    if (b) copiarFuente(b.dataset.copiar);
  });
  wireCopiaConFuente();




  $('#corpusBtn').onclick = () => document.dispatchEvent(new CustomEvent('r2:sobre-corpus'));

  $('#closeRead').onclick = () => {
    if (S.readMode === 'session') leaveSession();
    if (S.readMode === 'careo') leaveCareo();
    S.readMode = 'speech'; ++S.readSeq;
    $('#app').classList.add('no-reader'); $('#app').classList.remove('wide-reader', 'session-mode', 'careo-mode');
    S.selected = null; S.current = null; updateReadHead(); refreshHitMarkers();
  };


  $('#wideBtn').onclick = () => $('#app').classList.toggle('wide-reader');


  $('#sideFold').onclick = () => { setSideCollapsed(true); $('#sideRail').focus({ preventScroll: true }); };
  $('#sideRail').onclick = () => { setSideCollapsed(false); $('#sideFold').focus({ preventScroll: true }); };
  $('#listFold').onclick = () => { setListCollapsed(true); $('#listRail').focus({ preventScroll: true }); };
  $('#listRail').onclick = () => { setListCollapsed(false); $('#listFold').focus({ preventScroll: true }); };

  new MutationObserver(updateListRail).observe($('#resultMeta'), { childList: true, subtree: true, characterData: true });
  $('#readModes').addEventListener('click', e => {
    const b = e.target.closest('[data-rmode]');
    if (b) setReadMode(b.dataset.rmode);
  });
  // #temaTools es hermano de #readModes, no hijo: necesita su propio escuchador.
  $('#temaTools')?.addEventListener('click', temaClick);
  // La etiqueta se dibuja aparte, no con `title`: sale al momento y se ve como el resto.
  $('#read')?.addEventListener('mouseover', temaTip);
  $('#read')?.addEventListener('mouseleave', () => { if (TEMA_TIP) TEMA_TIP.hidden = true; });
  document.addEventListener('scroll', () => { if (TEMA_TIP) TEMA_TIP.hidden = true; }, true);
  $('#sessRef').onclick = () => {
    const s = S.session;
    if (s?.outline && s.active) sessGoTo(s, s.byId.get(s.refId));
  };
  $('#sessJump').onchange = e => {
    const s = S.session;
    if (s?.outline && s.active) sessGoTo(s, +e.target.value);
  };

  let rafSel = 0;
  $('#reader').addEventListener('scroll', () => {
    if (rafSel || S.readMode !== 'session' || !S.session?.active) return;
    rafSel = requestAnimationFrame(() => {
      rafSel = 0;
      const sc = $('#reader'), box = sc.getBoundingClientRect();
      const el = document.elementFromPoint(box.left + box.width / 2, box.top + 48);
      const blk = el && sc.contains(el) ? el.closest('.sess-block') : null;
      const sel = $('#sessJump');
      if (blk && document.activeElement !== sel) sel.value = blk.dataset.idx;
    });
  }, { passive: true });


  let rafLectura = 0;
  $('#reader').addEventListener('scroll', () => {
    if (rafLectura || S.readMode !== 'session' || !S.session?.active) return;
    rafLectura = requestAnimationFrame(() => { rafLectura = 0; sessLecturaGuardar(S.session); });
  }, { passive: true });



  $('#careoBtn').onclick = toggleCareo;
  $('#careoBack').onclick = () => setReadMode('speech');
  $('#careoSwap').onclick = careoSwap;
  $('#careoPick').onchange = e => careoSetPick(+e.target.value);
  $('#careoModes').addEventListener('click', e => {
    const b = e.target.closest('[data-cmode]');
    if (b) careoSetMode(b.dataset.cmode);
  });

  $('#resultMeta').addEventListener('click', libTabClick);
  $('#resultMeta').addEventListener('change', lexSoloChange);
  $('#lexExportBtn').onclick = lexExportCSV;
  $('#hits').addEventListener('keydown', lexKey);
  $('#hits').addEventListener('change', cooChange);
  $('#hits').addEventListener('keydown', cooKey);
  $('#addBtn').onclick = () => {
    if (!S.selected) return toast('Abra primero una intervención.');
    const hit = S.results.find(r => r.id === S.selected);
    openAdd([S.selected], hit?.char_start != null ? [hit.char_start, hit.char_end] : null);
  };
  $('#addConfirm').onclick = doAdd;
  $('#temaDlgOk').onclick = temaDlgCrear;
  $('#temaDlgBigOk').onchange = temaDlgPinta;
  $('#temaDlgNada').onclick = () => { for (const t of TEMA_DLG.terminos) t.on = false; temaDlgPinta(); temaDlgTotal(); };
  $('#temaDlgTodo').onclick = () => { for (const t of TEMA_DLG.terminos) t.on = true; temaDlgPinta(); temaDlgTotal(); };
  $('#temaDlgTerms').addEventListener('click', (e) => {
    const b = e.target.closest('[data-temat]');
    if (!b) return;
    const t = TEMA_DLG.terminos[+b.dataset.temat];
    if (!t) return;
    t.on = !t.on;
    temaDlgPinta();
    temaDlgTotal();
  });

  $('#expConfirm').onclick = doExport;

  $('#delLibBtn').onclick = () => { if (S.view === 'library' && S.libSel != null) openDelLib(S.libSel); };
  $('#delLibConfirm').onclick = doDelLib;
  $('#delLibExport').onclick = delLibExport;
  $('#expFormat').onchange = updateExpNote;
  $('#expText').onchange = updateExpNote;
  $('#addBigOk').onchange = () => syncConfirm('add');
  $('#expBigOk').onchange = () => syncConfirm('exp');

  for (const id of ['#dlgAdd', '#dlgExport', '#dlgDelLib'])
    $(id).addEventListener('cancel', e => { if (e.currentTarget._busy) e.preventDefault(); });
  $$('dialog [data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('#clearFilters').onclick = () => { toExplore(); resetFiltersState();   renderFilters(); search(true); };






  $('#resetBtn').onclick = resetAll;




  $('#q').addEventListener('search', () => {
    if ($('#q').value.trim() === '' && S.query !== '') {
      S.query = '';   toExplore(); search(true);
    }
  });
  $$('.tabs button').forEach(b => b.onclick = () => setView(b.dataset.view));

  $('#hits').addEventListener('click', async e => {
    if (lexClick(e)) return;
    if (cooClick(e)) return;
    if (e.target.closest('[data-libmore]')) { loadMoreLibItems(); return; }




    const rm = e.target.closest('[data-rm]');
    if (rm) {
      e.stopPropagation();
      try {
        await api(`/collections/${S.libSel}/items/remove`,
          { method: 'POST', body: { speech_ids: [+rm.dataset.rm] } });
        toast('Quitada de la biblioteca');
        await refreshCollections(); renderLibraryView();
      } catch (err) { toast(err.message, true); }
      return;
    }
    const nt = e.target.closest('[data-note]');
    if (nt) { e.stopPropagation(); editNote(+nt.dataset.note); return; }
    const spk = e.target.closest('[data-spk]');
    if (spk) {
      S.filters.rep_ids = [+spk.dataset.spk];
      renderFilters(); search(true); return;
    }
    const hit = e.target.closest('.hit');
    if (hit) openSpeech(+hit.dataset.id);
  });

  $('#reader').addEventListener('click', e => {
    if (careoClick(e)) return;
    const g = e.target.closest('[data-goto]');
    if (g) { openSpeech(+g.dataset.goto, { mode: 'speech' }); return; }
    if (e.target.closest('[data-session]')) { setReadMode('session'); return; }
    const solo = e.target.closest('[data-solo]');
    if (solo) { openSpeech(+solo.dataset.solo, { mode: 'speech' }); return; }

    const retry = e.target.closest('[data-sess-retry]');
    if (retry && S.session?.outline) { const i = +retry.dataset.sessRetry; sessEnsure(S.session, i, i); }
  });
  $('#reader').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.thread-row[role=button]');
    if (row) { e.preventDefault(); e.stopPropagation(); row.click(); }
  });

  $('#filters').addEventListener('click', e => {

    const dl = e.target.closest('[data-dellib]');
    if (dl) { openDelLib(+dl.dataset.dellib); return; }
    const rn = e.target.closest('[data-renlib]');
    if (rn) { renameLibrary(+rn.dataset.renlib); return; }
    const lib = e.target.closest('[data-lib]');
    if (lib) { loadLibraryItems(+lib.dataset.lib); return; }
    if (e.target.id === 'newLibBtn') { newLibrary(); return; }
    if (e.target.id === 'importLibBtn') { importLibrary(); return; }
    if (e.target.id === 'saveSearchBtn') { saveSearch(); return; }
    const mw = e.target.closest('[data-minw]');
    if (mw) {
      const v = mw.dataset.minw;
      if (v) S.filters.min_words = +v; else delete S.filters.min_words;
      renderFilters(); search(true); return;
    }
    const del = e.target.closest('[data-delsearch]');
    if (del) { api(`/searches/${del.dataset.delsearch}`, { method: 'DELETE' }).then(loadSaved); return; }
    const run = e.target.closest('[data-runsearch]');
    if (run) {
      const s = S.saved?.get(+run.dataset.runsearch);
      if (!s) return;
      const F = expandFilters(s.filters);


      const borrada = F.collection_id != null && F.collection_id !== ''
        && (s.biblioteca_borrada || !S.collections.some(c => c.id === +F.collection_id));
      if (borrada) delete F.collection_id;
      S.query = s.query; S.mode = s.mode; S.variants = !!s.variants; S.filters = F;
      $('#q').value = s.query; $('#variants').checked = S.variants; setMode(s.mode);

      renderFilters(); search(true);
      if (borrada) toast(`«${s.name}» estaba restringida a una biblioteca que ya no existe: se busca en todo el corpus, sin esa restricción.`, true);
    }
  });

  $('#filters').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.fkey) {
      const k = t.dataset.fkey;
      const val = k === 'rep_ids' ? +t.value : t.value;
      const cur = new Set((S.filters[k] || []).map(String));
      if (t.checked) cur.add(String(val)); else cur.delete(String(val));
      S.filters[k] = [...cur].map(v => (k === 'rep_ids' ? +v : v));
      if (!S.filters[k].length) delete S.filters[k];
      renderPills(); search(true); return;
    }
    if (t.id === 'fSinDocs') {
      if (t.checked) S.filters.exclude_docs = true; else delete S.filters.exclude_docs;
      renderPills(); search(true); return;
    }
    const map = { fDesde: 'date_from', fHasta: 'date_to', fMin: 'min_words',
                  fMax: 'max_words', fSesion: 'num_session', fLib: 'collection_id' };
    if (map[t.id]) {
      const k = map[t.id];
      const v = t.value.trim();

      if ((k === 'date_from' || k === 'date_to') && S.filters.period) {
        if (S.filters.period.kind === 'ids') delete S.filters.speech_ids;
        delete S.filters.period;
      }
      if (v === '') delete S.filters[k];
      else S.filters[k] = ['min_words', 'max_words', 'num_session', 'collection_id'].includes(k) ? +v : v;
      renderPills(); search(true);
    }
  });

  $('#filters').addEventListener('input', e => {
    if (!e.target.classList.contains('fsearch')) return;
    const id = e.target.dataset.grupo;
    const caja = $(`.fitems[data-grupo="${id}"]`);
    if (caja) caja.innerHTML = itemsHTML(id, e.target.value);
  });

  $('#activePills').addEventListener('click', e => {
    const b = e.target.closest('[data-pill]');
    if (!b) return;
    $('#activePills')._fns[+b.dataset.pill]();
    renderFilters(); search(true);
  });

  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); $('#q').focus(); $('#q').select(); return; }
    if (e.key === 'Escape' && !$('dialog[open]')) { $('#closeRead').click(); return; }
    if (typing || $('dialog[open]')) return;
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();


      let i = S.results.findIndex(r => r.id === S.selected);
      if (i === -1 && S.cursor != null) i = S.results.findIndex(r => r.id === S.cursor);
      const n = e.key === 'j' ? Math.min(i + 1, S.results.length - 1) : Math.max(i - 1, 0);
      const t = S.results[i === -1 ? 0 : n];
      if (t) { openSpeech(t.id); $(`.hit[data-id="${t.id}"]`)?.scrollIntoView({ block: 'nearest' }); }
    }






    if (e.key === 'Enter' && !S.selected && S.results.length && S.view !== 'library'
        && !e.target.closest?.('button, a[href], summary, [role="button"], [contenteditable="true"]')) {
      e.preventDefault();
      const t = S.results.find(r => r.id === S.cursor) || S.results[0];
      openSpeech(t.id); $(`.hit[data-id="${t.id}"]`)?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 's' && !e.metaKey && !e.ctrlKey && !e.altKey && S.selected) {
      e.preventDefault();
      setReadMode(S.readMode === 'session' ? 'speech' : 'session');
    }
    if (e.key === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleTrend(); }
    if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault(); setSideCollapsed(!$('#app').classList.contains('side-collapsed'));
    }
    if (e.key === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if ($('#app').classList.contains('no-reader')) toast('Abra una intervención para plegar la lista mientras lee');
      else setListCollapsed(!$('#app').classList.contains('list-collapsed'));
    }
    if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleCareo(); }


    const sinMod = !e.metaKey && !e.ctrlKey && !e.altKey;
    if (e.key === 'a' && sinMod && S.selected) $('#addBtn').click();
    if (sinMod && ['1', '2', '3'].includes(e.key)) $$('.modes button')[+e.key - 1]?.click();


    if (e.key === 'r' && sinMod) { e.preventDefault(); resetAll(); }
  });
}

/* Editor de los textos de la biblioteca (#dlgEdit): un nombre, una nota o las dos cosas.
   Sustituye a window.prompt, que da una sola línea —inservible para la nota de una biblioteca, que
   puede ser larga— y que, como window.confirm, puede no mostrarse en la ventana de pywebview: es el
   mismo motivo por el que borrar una biblioteca ya tiene su propio <dialog> (#dlgDelLib).
   Devuelve una promesa con {nombre, texto} o null si se cancela. Ctrl/Cmd+Intro guarda; Esc cancela.
   `nombre` y `texto` valen null cuando ese campo no se pide, y así se distingue «no se tocó» de «se
   dejó vacío»: vaciar la nota de una intervención es borrarla, y tiene que poder hacerse. */
function abrirEditor({ titulo, sub = '', nombre = null, nombreEtiqueta = 'Nombre', texto = null,
                       textoEtiqueta = 'Nota', guardar = 'Guardar', exigeNombre = false }) {
  const dlg = $('#dlgEdit');
  if (dlg.open) return Promise.resolve(null);
  const inNombre = $('#editNombre'), inTexto = $('#editTexto'), btn = $('#editGuardar');
  $('#editTitle').textContent = titulo;
  $('#editSub').textContent = sub;
  $('#editSub').hidden = !sub;
  $('#editNombreCampo').hidden = nombre === null;
  $('#editTextoCampo').hidden = texto === null;
  $('#editNombreLbl').textContent = nombreEtiqueta;
  $('#editTextoLbl').textContent = textoEtiqueta;
  inNombre.value = nombre || '';
  inTexto.value = texto || '';
  btn.textContent = guardar;
  $('#editPista').textContent = texto === null ? '' : 'Ctrl+Intro guarda';
  const valido = () => !exigeNombre || !!inNombre.value.trim();
  const revisar = () => { btn.disabled = !valido(); };
  revisar();
  const opener = document.activeElement;
  return new Promise((resolve) => {
    let hecho = false;
    const cerrar = (valor) => {
      if (hecho) return;
      hecho = true;
      inNombre.removeEventListener('input', revisar);
      dlg.removeEventListener('close', alCerrar);
      btn.removeEventListener('click', alGuardar);
      dlg.removeEventListener('keydown', alTeclado);
      if (dlg.open) dlg.close();
      if (opener && opener.isConnected) { try { opener.focus(); } catch { /* el botón ya no está */ } }
      resolve(valor);
    };
    const alGuardar = () => {
      if (!valido()) return;
      cerrar({ nombre: nombre === null ? null : inNombre.value.trim(),
               texto: texto === null ? null : inTexto.value });
    };
    const alCerrar = () => cerrar(null);            // Esc y el botón Cancelar
    const alTeclado = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); alGuardar(); }
      // en el campo de una sola línea, Intro guarda; en el área de texto hace falta el modificador
      else if (e.key === 'Enter' && e.target === inNombre) { e.preventDefault(); alGuardar(); }
    };
    inNombre.addEventListener('input', revisar);
    dlg.addEventListener('close', alCerrar);
    btn.addEventListener('click', alGuardar);
    dlg.addEventListener('keydown', alTeclado);
    dlg.showModal();
    (nombre !== null ? inNombre : inTexto).focus();
    if (nombre !== null) inNombre.select();
  });
}

async function newLibrary() {
  const r = await abrirEditor({ titulo: 'Nueva biblioteca', nombre: '', texto: '',
    textoEtiqueta: 'Nota (opcional)', guardar: 'Crear', exigeNombre: true,
    sub: 'La nota describe para qué es la biblioteca; se guarda con ella al exportarla.' });
  if (!r) return;
  try {
    const c = await api('/collections', { method: 'POST', body: { name: r.nombre, description: r.texto } });
    await refreshCollections(); S.libSel = c.id; renderLibraryView();
    toast(`Biblioteca «${c.name}» creada`);
  } catch (e) { toast(e.message, true); }
}





/* Editar el nombre y la nota de una biblioteca (PATCH /api/collections/{cid}), con los valores actuales puestos.
   El nombre sale en la ficha, en la cabecera de la biblioteca abierta, en el selector «Restringir a una biblioteca»
   y en sus píldoras, así que después se repinta lo que toque. Las búsquedas guardadas guardan el id, no el nombre:
   siguen valiendo. */
async function renameLibrary(cid) {
  const c = S.collections.find(x => x.id === cid);
  if (!c) return;
  const ed = await abrirEditor({ titulo: 'Editar la biblioteca', nombre: c.name, texto: c.description || '',
    textoEtiqueta: 'Nota', exigeNombre: true,
    sub: 'La nota se ve en la ficha de la biblioteca y viaja con ella al exportarla.' });
  if (!ed) return;
  const limpio = ed.nombre;
  if (limpio === c.name && ed.texto === (c.description || '')) return;   // nada que guardar
  try {
    const r = await api(`/collections/${cid}`, { method: 'PATCH', body: { name: limpio, description: ed.texto } });
    await refreshCollections();
    if (S.view === 'library') { renderLibList(); listHead(); if (S.libSel === cid) loadLibraryItems(cid); }
    else renderFilters();
    toast(limpio === c.name ? 'Nota de la biblioteca guardada' : `La biblioteca se llama ahora «${r.name}»`);
  } catch (e) { toast(e.message, true); }
}





function importLibrary() {
  const inp = $('#importLibFile');
  if (!inp || inp._busy) return;
  inp.value = '';
  inp.click();
}

async function importLibraryFile(file) {
  const inp = $('#importLibFile');
  if (!file || inp._busy) return;
  inp._busy = true;
  try {
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      toast('El archivo no es un .2replib válido (JSON)', true);
      return;
    }


    let hondo = 0;
    for (const pila = [[payload, 1]]; pila.length && hondo <= 64;) {
      const [v, n] = pila.pop();
      if (v && typeof v === 'object') { hondo = Math.max(hondo, n); for (const x of Object.values(v)) pila.push([x, n + 1]); }
    }
    if (hondo > 64) {
      toast('El archivo no es un .2replib válido: tiene demasiados niveles anidados.', true);
      return;
    }
    const r = await api('/import', { method: 'POST', body: { payload } });

    S.searchStale = true;
    const cols = (r.collections || [r.collection]).filter(Boolean);
    const n = +r.n_items || 0, interv = `${nf(n)} ${n === 1 ? 'intervención' : 'intervenciones'}`;
    await refreshCollections();

    if (cols.length) S.libSel = cols[0].id;
    if (S.view === 'library') await renderLibraryView(); else setView('library');
    toast(cols.length === 1 ? `Importada «${cols[0].name}» (${interv})` : `Importadas ${nf(cols.length)} bibliotecas (${interv})`);
    $('#importLibBtn')?.focus();
  } catch (e) {

    const pila = !e.status && (e instanceof RangeError || e.name === 'InternalError');
    toast(pila ? 'El archivo no es un .2replib válido: tiene demasiados niveles anidados.' : e.message, true);
  } finally {
    inp._busy = false;
    inp.value = '';
  }
}






function qexpPintar() {
  const box = $('#qexp');
  if (!box) return;
  const q = (S.query || '').trim();
  const Q = globalThis.R2 && globalThis.R2.query;
  let r = null;
  if (S.view === 'search' && q && Q && typeof Q.interpretar === 'function') {
    try { r = Q.interpretar(q); } catch (e) { r = { ok: false, error: { mensaje: e && e.message } }; }
  }
  if (!r || r.vacia) {
    box.hidden = true; box.textContent = ''; box.classList.remove('err');
    return;
  }
  const txt = x => (x == null ? '' : typeof x === 'string' ? x : x.mensaje || x.message || '');
  box.classList.toggle('err', !r.ok);
  if (!r.ok) {
    box.innerHTML = `No se puede buscar <code>${esc(q)}</code>: ${esc(txt(r.error) || 'la consulta no es válida.')}`;
  } else {
    box.innerHTML = `Se busca: <code>${esc(r.interpretacion || q)}</code> · sin acentos ni mayúsculas · las comillas buscan la frase exacta`
      + (r.avisos || []).map(txt).filter(Boolean).map(a => `<span class="qexp-aviso">⚠ ${esc(a)}</span>`).join('');
  }
  box.hidden = false;
}






let almacenUltimo = null, almacenErrorAvisado = null, almacenAvisoAnunciado = null;
document.addEventListener('r2:almacen', ev => {
  almacenUltimo = ev.detail || null;
  if (S.view === 'library') libStorePintar();
  almacenSenalar(almacenUltimo);


  if (almacenUltimo && almacenUltimo.recargada && S.info) almacenRecargar();
});





document.addEventListener('r2:corpus-reemplazado', () => { corpusRefrescar(); });
async function corpusRefrescar() {
  try {
    const info = await api('/info');
    if (!info.corpus) return;
    S.info = info.corpus;
    S.facets = await api('/facets');
    S.collections = (await api('/collections')).collections;
    exprRestaurar();
  } catch (e) {
    toast(e.message, true);
    return;
  }
  renderHeader();
  renderFilters();
  if (S.view === 'library') renderLibraryView();
  else search(true);
}






function almacenSenalar(e) {
  if (!e || !document.documentElement.classList.contains('r2-app')) return;
  const err = e.error || null;
  const tab = $('.tabs button[data-view="library"]');
  if (tab) {
    if (tab.dataset.tituloOriginal === undefined) tab.dataset.tituloOriginal = tab.title || '';
    const marca = tab.querySelector('.r2-marca');
    if (err && !marca) tab.insertAdjacentHTML('beforeend', '<span class="r2-marca" aria-hidden="true">⚠</span>');
    if (!err && marca) marca.remove();
    if (err) {
      tab.setAttribute('aria-label', 'Mis bibliotecas: hay un problema con el guardado de sus bibliotecas');
      tab.title = err;
    } else {
      tab.removeAttribute('aria-label');
      tab.title = tab.dataset.tituloOriginal;
    }
  }
  if (err && err !== almacenErrorAvisado) toast(err, true);
  almacenErrorAvisado = err;
  const av = e.aviso || {};
  const clave = `${av.tipo}|${av.texto}`;
  if (almacenAvisoAnunciado === null) { almacenAvisoAnunciado = clave; return; }
  if (clave === almacenAvisoAnunciado) return;
  almacenAvisoAnunciado = clave;
  const A = globalThis.R2 && globalThis.R2.anuncios;
  if (!err && av.tipo !== 'comprobando' && A && typeof A.anunciar === 'function') A.anunciar(av.texto, false);
}


function almacenDescargarDanada() {
  const P = globalThis.R2 && globalThis.R2.persistencia;
  const bytes = P && typeof P.copiaDanada === 'function' ? P.copiaDanada() : null;
  if (!bytes) { toast('No hay ninguna copia dañada que descargar', true); return; }
  const name = `diarios_bibliotecas_danadas_${new Date().toISOString().slice(0, 10)}.sqlite`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.sqlite3' })); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 120000);
  toast(`Elija dónde guardar ${name}`);
}

async function almacenDescartarDanada() {
  const P = globalThis.R2 && globalThis.R2.persistencia;
  if (!P || typeof P.descartarCopiaDanada !== 'function') return;
  if (!confirm('¿Descartar la copia dañada de sus bibliotecas? Se borrará de este navegador y empezará con bibliotecas vacías. Si quiere intentar recuperarla, descárguela antes.')) return;
  try {
    if (!(await P.descartarCopiaDanada())) {
      toast('Solo la pestaña que edita las bibliotecas puede descartar la copia dañada: pulse antes «Usar aquí».', true);
      return;
    }
    toast('Copia dañada descartada: sus bibliotecas empiezan vacías');
    await refreshCollections();
    if (S.view === 'library') renderLibraryView();
  } catch (err) {
    toast(err.message, true);
  }
}

async function almacenRecargar() {
  try {
    await refreshCollections();
  } catch (e) {
    return;
  }
  if (S.libSel != null && !S.collections.some(c => c.id === S.libSel)) { S.libSel = null; S.libInfo = null; }
  if (S.view === 'library') { renderLibraryView(); return; }
  loadSaved();
  const sel = $('#fLib');
  if (sel) {
    sel.innerHTML = '<option value="">— todo el corpus —</option>' + S.collections.map(c =>
      `<option value="${c.id}"${S.filters.collection_id == c.id ? ' selected' : ''}>${esc(c.name)} (${nf(c.n_items)})</option>`).join('');
  }
}

function almacenEstado() {
  const P = globalThis.R2 && globalThis.R2.persistencia;

  try { if (P && typeof P.estado === 'function') return P.estado() || almacenUltimo; } catch { return almacenUltimo; }
  return almacenUltimo;
}



function libStoreHTML(e) {
  const av = (e && e.aviso) || { tipo: 'comprobando', texto: 'Comprobando si este navegador puede guardar las bibliotecas…', acciones: [] };
  const alerta = ['memoria', 'solo_lectura', 'error', 'copia_danada', 'relevo'].includes(av.tipo);
  const acc = av.acciones || [];
  const hay = S.collections.length > 0;
  return `<div class="lib-store${alerta ? ' aviso' : ''}" id="libStore" data-tipo="${esc(av.tipo)}" role="group" aria-label="Dónde se guardan sus bibliotecas">`
    + `<span class="lib-store-t">${esc(av.texto)}</span><div class="lib-store-acc">`
    + `<button type="button" class="btn sm" id="exportAllBtn"${hay ? '' : ' disabled'}`
    + ` title="Descargar todas las bibliotecas y las búsquedas guardadas en un solo archivo .2replib">⤓ Exportar todas</button>`
    + (acc.includes('usar_aqui')
      ? '<button type="button" class="btn sm" id="usarAquiBtn" title="Editar las bibliotecas en esta pestaña">Usar aquí</button>' : '')
    + (acc.includes('descargar_danada')
      ? '<button type="button" class="btn sm" id="descargarDanadaBtn" title="Guardar en un archivo la copia dañada, por si se puede recuperar">⤓ Descargar la copia dañada</button>' : '')
    + (acc.includes('descartar_danada')
      ? '<button type="button" class="btn sm" id="descartarDanadaBtn" title="Borrar la copia dañada de este navegador y empezar con bibliotecas vacías (pide confirmación)">Descartar la copia dañada</button>' : '')
    + '</div></div>';
}



function libStorePintar() {
  if (S.view !== 'library') return;
  const cab = $('#newLibBtn')?.parentElement;
  if (!cab) return;
  const e = almacenEstado();
  $('#libStore')?.remove();
  cab.insertAdjacentHTML('afterend', libStoreHTML(e));
  for (const id of ['#newLibBtn', '#importLibBtn']) { const b = $(id); if (b) b.disabled = !!(e && e.solo_lectura); }
  proyectoPintar(cab, e);
}






function proyectoIndice() {
  const P = globalThis.R2 && R2.datos && R2.datos.bibliotecas_proyecto;
  if (!P || !Array.isArray(P.bibliotecas) || !P.bibliotecas.length || !S.info) return null;
  const sha = S.info.standalone && S.info.standalone.archivo && S.info.standalone.archivo.sha256;
  return (sha ? sha === P.csv_sha256 : S.info.name === P.corpus) ? P : null;
}

function proyectoPintar(cab, e) {
  $('#projLibBtn')?.remove();
  if (!proyectoIndice()) return;
  cab.insertAdjacentHTML('beforeend', `<button type="button" class="btn" id="projLibBtn" style="width:100%;margin-top:7px"${e && e.solo_lectura ? ' disabled' : ''}`
    + ' title="Elegir entre las bibliotecas preparadas con el proyecto: discursos principales, debates, sesiones y anécdotas">Añadir bibliotecas del proyecto…</button>');
}

const PROYECTO_GRUPOS = [['L1', 'Discursos'], ['L2', 'Debates'], ['L3', 'Sesiones'], ['L4', 'Anécdotas y amenazas']];

function proyectoDialogo() {
  const P = proyectoIndice();
  if (!P) return;
  let dlg = $('#dlgProyecto');
  if (!dlg) {
    document.body.insertAdjacentHTML('beforeend', `<dialog id="dlgProyecto" aria-labelledby="proyTitulo">
  <div class="dhead"><h3 id="proyTitulo">Bibliotecas del proyecto</h3>
    <p class="dsub">Preparadas con el corpus ${esc(P.corpus)}. Se añaden a sus bibliotecas con sus notas y etiquetas; después puede cambiarlas o borrarlas como cualquier otra.</p></div>
  <div class="dbody" id="proyLista"></div>
  <div class="dfoot"><button type="button" class="btn ghost" id="proyTodas">Marcar todas</button><span style="flex:1"></span>
    <button type="button" class="btn" data-close>Cancelar</button><button type="button" class="btn primary" id="proyAnadir">Añadir</button></div>
</dialog>`);
    dlg = $('#dlgProyecto');
    dlg.addEventListener('click', ev => {
      if (ev.target.closest('[data-close]')) { if (!$('#proyAnadir')._busy) dlg.close(); return; }
      if (ev.target.closest('#proyAnadir')) { proyectoAnadir(); return; }
      if (ev.target.closest('#proyTodas')) {
        const libres = [...dlg.querySelectorAll('input[data-clave]:not(:disabled)')];
        const todas = libres.every(i => i.checked);
        libres.forEach(i => { i.checked = !todas; });
        proyectoContar();
      }
    });
    dlg.addEventListener('change', proyectoContar);
    dlg.addEventListener('cancel', ev => { if ($('#proyAnadir')._busy) ev.preventDefault(); });
  }
  const ya = new Set(S.collections.map(c => c.name));
  $('#proyLista').innerHTML = PROYECTO_GRUPOS.map(([pref, titulo]) => {
    const libs = P.bibliotecas.filter(b => b.clave === pref || b.clave.startsWith(pref + '-'));
    if (!libs.length) return '';
    return `<p class="dsub" style="margin:10px 0 4px;font-weight:600">${esc(titulo)}</p>` + libs.map(b => {
      const esta = ya.has(b.nombre);
      return `<label class="fdoc" style="margin:0 0 7px"><input type="checkbox" data-clave="${esc(b.clave)}"${esta ? ' disabled' : ''}>`
        + `<span><b>${esc(b.nombre)}</b><small>${nf(b.n)} ${b.n === 1 ? 'intervención' : 'intervenciones'}`
        + `${esta ? ' · ya está en sus bibliotecas' : ''}</small></span></label>`;
    }).join('');
  }).join('');
  proyectoContar();
  dlg.showModal();
}

function proyectoContar() {
  const dlg = $('#dlgProyecto'), btn = $('#proyAnadir');
  if (!dlg || !btn || btn._busy) return;
  const n = dlg.querySelectorAll('input[data-clave]:checked').length;
  btn.disabled = !n;
  btn.textContent = n ? `Añadir ${nf(n)}` : 'Añadir';
  const libres = [...dlg.querySelectorAll('input[data-clave]:not(:disabled)')];
  const t = $('#proyTodas');
  t.disabled = !libres.length;
  t.textContent = libres.length && libres.every(i => i.checked) ? 'Desmarcar todas' : 'Marcar todas';
}

async function proyectoAnadir() {
  const dlg = $('#dlgProyecto'), btn = $('#proyAnadir');
  if (!dlg || !btn || btn._busy) return;
  const claves = [...dlg.querySelectorAll('input[data-clave]:checked')].map(i => i.dataset.clave);
  if (!claves.length) return;
  btn._busy = true;
  dlg.querySelectorAll('button, input').forEach(b => { b.disabled = true; });
  let hechas = 0, n = 0, fallo = null;
  try {

    const todo = JSON.parse(await R2.cargas.texto('bibliotecas'));
    const porClave = new Map((todo.paquetes || []).map(p => [p.generado && p.generado.biblioteca, p]));
    for (const clave of claves) {
      const payload = porClave.get(clave);
      if (!payload) throw new Error(`Falta la biblioteca ${clave} en este archivo`);
      btn.textContent = `Añadiendo ${nf(hechas + 1)} de ${nf(claves.length)}…`;
      const r = await api('/import', { method: 'POST', body: { payload } });

      const col = r.collection;
      if (col && col.name !== payload.collection.name) {
        await api(`/collections/${col.id}`, { method: 'PATCH', body: { name: payload.collection.name } });
      }
      hechas++; n += +r.n_items || 0;
    }
  } catch (e) {
    fallo = e;
  } finally {
    btn._busy = false;
    dlg.querySelectorAll('button, input').forEach(b => { b.disabled = false; });
    dlg.close();
  }
  S.searchStale = true;
  await refreshCollections();
  if (S.view === 'library') await renderLibraryView(); else setView('library');
  if (fallo) toast(`${hechas ? `Se añadieron ${nf(hechas)}; ` : ''}${fallo.message}`, true);
  else toast(`${hechas === 1 ? 'Añadida 1 biblioteca' : `Añadidas ${nf(hechas)} bibliotecas`} (${nf(n)} ${n === 1 ? 'intervención' : 'intervenciones'})`);
}




async function exportarTodas() {
  const btn = $('#exportAllBtn');
  if (!btn || btn._busy) return;
  btn._busy = true; btn.disabled = true;
  const rotulo = btn.textContent;
  btn.textContent = 'Preparando…';
  try {
    const r = await fetch('/api/collections/export-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudieron exportar las bibliotecas');
    const blob = await r.blob();
    const name = (r.headers.get('Content-Disposition') || '').match(/filename="(.+?)"/)?.[1] || 'bibliotecas.2replib';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
    toast(`Elija dónde guardar ${name}`);
    const P = globalThis.R2 && globalThis.R2.persistencia;
    if (P && typeof P.marcarExportado === 'function') Promise.resolve(P.marcarExportado()).catch(() => {});
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn._busy = false;
    if (btn.isConnected) { btn.textContent = rotulo; btn.disabled = false; }
  }
}





function compactFilters(F) {
  const f = JSON.parse(JSON.stringify(F || {}));
  if (f.period && typeof f.period === 'object' && Array.isArray(f.speech_ids)) {
    const ids = [...new Set(f.speech_ids.map(Number))].sort((a, b) => a - b);
    const rangos = [];
    for (const x of ids) {
      const u = rangos[rangos.length - 1];
      if (u && x === u[1] + 1) u[1] = x; else rangos.push([x, x]);
    }
    f.period.ranges = rangos;
    delete f.speech_ids;
  }
  return f;
}

function expandFilters(F) {
  const f = JSON.parse(JSON.stringify(F || {}));
  if (f.period && Array.isArray(f.period.ranges) && !Array.isArray(f.speech_ids)) {
    const ids = [];
    for (const [a, b] of f.period.ranges) for (let x = +a; x <= +b; x++) ids.push(x);
    if (ids.length) f.speech_ids = ids;
  }
  return f;
}

async function saveSearch() {
  const r = await abrirEditor({ titulo: 'Guardar la búsqueda', nombre: S.query || 'Búsqueda',
    exigeNombre: true, guardar: 'Guardar' });
  if (!r) return;
  try {
    await api('/searches', { method: 'POST',
      body: { name: r.nombre, mode: S.mode, query: S.query,
              filters: compactFilters(S.filters), variants: S.variants,
                } });
    loadSaved(); toast('Búsqueda guardada');
  } catch (e) { toast(e.message, true); }
}

async function editNote(sid) {
  const it = S.results.find(r => r.id === sid);
  const previa = it?.note || '';
  const quien = it ? `${it.rep_name || it.speaker || ''} · ${it.date || ''}`.trim() : '';
  const r = await abrirEditor({ titulo: previa ? 'Editar la nota' : 'Nota de la intervención',
    sub: quien, texto: previa, textoEtiqueta: 'Nota' });
  if (!r || r.texto === previa) return;
  try {
    await api(`/collections/${S.libSel}/items/${sid}`, { method: 'PATCH', body: { note: r.texto } });
    loadLibraryItems(S.libSel); toast(r.texto.trim() ? 'Nota guardada' : 'Nota borrada');
  } catch (e) { toast(e.message, true); }
}

boot();
//# sourceURL=2rep-standalone/app/static/js/app.js

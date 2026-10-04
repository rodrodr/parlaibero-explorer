/* ===== i18n.js ===== */
/* Diarios Explorer · i18n.js — lengua de la interfaz: español (por defecto), inglés y portugués.
 *
 * El mismo archivo va en la página (antes de los demás módulos) y en el worker (build.py lo inserta en los dos).
 *
 * - El texto fuente es el español y hace de clave: __('Buscar') devuelve 'Search' en inglés. Los diccionarios son
 *   i18n/en.json e i18n/pt.json ({español: traducción}); lo que no esté traducido sale en español.
 * - Huecos numerados: __('{0} intervenciones', nf(n)). La clave se compara con los espacios plegados, así que una
 *   plantilla de varias líneas vale igual que la misma frase en una.
 * - N_('texto') no traduce: marca una cadena para el extractor (tools/i18n.py) cuando se guarda en una constante y se
 *   traduce más tarde con __(constante). En el worker la lengua llega con el mensaje iniciar, así que allí __() solo
 *   sirve dentro de funciones, nunca al cargar el módulo.
 * - En la página, la lengua sale de ?lang= en la URL, luego de localStorage y, si no hay nada, es español.
 */
(function (g) {
  'use strict';

  const LENGUAS = [
    { codigo: 'es', nombre: 'Español', locale: 'es-ES' },
    { codigo: 'en', nombre: 'English', locale: 'en-GB' },
    { codigo: 'pt', nombre: 'Português', locale: 'pt-BR' },
  ];
  const CODIGOS = LENGUAS.map((l) => l.codigo);
  const CLAVE = 'diarios-explorer:v1:lengua';

  let lengua = 'es';
  let dicc = null;
  const plegada = new Map();

  const plegar = (s) => {
    let k = plegada.get(s);
    if (k === undefined) {
      k = String(s).replace(/\s+/g, ' ').trim();
      if (plegada.size < 20000) plegada.set(s, k);
    }
    return k;
  };

  const rellenar = (s, args) => (args.length
    ? s.replace(/\{(\d)\}/g, (m, i) => (args[i] === undefined || args[i] === null ? '' : String(args[i])))
    : s);

  /** Traduce `s` (español) a la lengua de la interfaz y rellena {0}, {1}… con `args`. */
  function __(s, ...args) {
    if (s === undefined || s === null) return '';
    s = String(s);
    let r = s;
    if (dicc) {
      const t = dicc[plegar(s)];
      if (t) {
        // la traducción conserva los espacios de los bordes de la plantilla original (« Tendencia» → « Trend»)
        const ini = /^\s*/.exec(s)[0], fin = /\s*$/.exec(s)[0];
        r = ini + t + (fin.length < s.length - ini.length ? fin : '');
      }
    }
    return rellenar(r, args);
  }

  /** Marca para el extractor: devuelve la cadena tal cual. */
  const N_ = (s) => s;

  const datosLengua = () => LENGUAS.find((l) => l.codigo === lengua) || LENGUAS[0];

  function fijar(codigo, diccionario) {
    lengua = CODIGOS.includes(codigo) ? codigo : 'es';
    dicc = lengua === 'es' ? null : (diccionario || null);
    plegada.clear();
  }

  // ------------------------------------------------------------------------------------------------ formatos
  // Cifras: en español y portugués, punto de miles también con cuatro cifras («1.234»; es-ES no lo pone) y coma
  // decimal; en inglés, coma de miles y punto decimal.
  const agrupa = (s) => String(s).replace(/^(-?\d)(\d{3})(?=[,.]|$)/, (m, a, b) => a + (lengua === 'en' ? ',' : '.') + b);

  function num(n, opciones) {
    const v = Number(n ?? 0);
    return agrupa(v.toLocaleString(datosLengua().locale, opciones));
  }

  /** Decimal ya redondeado (número o cadena con punto) con el separador de la lengua: 2.5 → «2,5» / «2.5». */
  const dec = (v) => (v === undefined || v === null ? '' : (lengua === 'en' ? String(v) : String(v).replace('.', ',')));

  let fmtMes = null, fmtMesCorto = null;
  /** Nombre del mes (1-12), en minúscula salvo en inglés. */
  function mes(m, corto = false) {
    const loc = datosLengua().locale;
    if (!fmtMes || fmtMes.loc !== loc) {
      fmtMes = { loc, f: new Intl.DateTimeFormat(loc, { month: 'long', timeZone: 'UTC' }) };
      fmtMesCorto = new Intl.DateTimeFormat(loc, { month: 'short', timeZone: 'UTC' });
    }
    const d = new Date(Date.UTC(2000, (Number(m) || 1) - 1, 1));
    return (corto ? fmtMesCorto : fmtMes.f).format(d).replace(/\.$/, '');
  }

  /** Fecha ISO (AAAA-MM-DD) en largo: «4 de octubre de 2026» / «4 October 2026» / «4 de outubro de 2026». */
  function fecha(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!y) return String(iso);
    if (!m) return String(y);
    if (!d) return lengua === 'en' ? `${mes(m)} ${y}` : `${mes(m)} de ${y}`;
    return lengua === 'en' ? `${d} ${mes(m)} ${y}` : `${d} de ${mes(m)} de ${y}`;
  }

  // ------------------------------------------------------------------------------------------------ página
  const hayDom = typeof document !== 'undefined' && typeof window !== 'undefined';

  function leerPreferida() {
    try {
      const u = new URL(g.location.href).searchParams.get('lang');
      if (u && CODIGOS.includes(u.toLowerCase())) {
        try { g.localStorage.setItem(CLAVE, u.toLowerCase()); } catch (e) { /* sin almacenamiento */ }
        return u.toLowerCase();
      }
    } catch (e) { /* URL rara */ }
    try {
      const s = g.localStorage.getItem(CLAVE);
      if (s && CODIGOS.includes(s)) return s;
    } catch (e) { /* sin almacenamiento */ }
    return 'es';
  }

  const SALTAR = new Set(['SCRIPT', 'STYLE', 'PRE', 'CODE', 'KBD', 'TEXTAREA']);
  const ATRIBUTOS = ['title', 'placeholder', 'aria-label', 'alt'];

  /** Traduce el marcado estático ya presente bajo `raiz`: nodos de texto, atributos y, en los elementos con
   *  data-i18n, el innerHTML entero como una sola frase (cuando lleva <b>, <i>… dentro). */
  function dom(raiz) {
    if (!dicc || !raiz) return;
    for (const el of raiz.querySelectorAll('[data-i18n]')) {
      const k = plegar(el.innerHTML);
      if (dicc[k]) el.innerHTML = dicc[k];
    }
    const pendientes = [];
    const recorrer = (nodo) => {
      for (let n = nodo.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { if (/\S/.test(n.nodeValue)) pendientes.push(n); }
        else if (n.nodeType === 1 && !SALTAR.has(n.tagName) && n.getAttribute('translate') !== 'no' && !n.hasAttribute('data-i18n')) recorrer(n);
      }
    };
    recorrer(raiz);
    for (const n of pendientes) n.nodeValue = __(n.nodeValue);
    for (const at of ATRIBUTOS) {
      for (const el of raiz.querySelectorAll(`[${at}]`)) {
        const v = el.getAttribute(at);
        if (v && /\S/.test(v)) el.setAttribute(at, __(v));
      }
    }
  }

  /** Cambia la lengua y recarga la página (la base recordada se vuelve a abrir sola). */
  function cambiar(codigo) {
    if (!CODIGOS.includes(codigo)) return;
    try { g.localStorage.setItem(CLAVE, codigo); } catch (e) { /* sin almacenamiento: solo dura esta visita */ }
    try {
      const u = new URL(g.location.href);
      if (u.searchParams.has('lang')) { u.searchParams.set('lang', codigo); g.location.replace(u.href); return; }
    } catch (e) { /* URL rara */ }
    g.location.reload();
  }

  /** Diccionario de la lengua activa, para pasárselo al worker en el mensaje iniciar. */
  const diccionario = () => dicc;

  if (hayDom) {
    const preferida = leerPreferida();
    let todos = null;
    if (preferida !== 'es') {
      const el = document.getElementById('r2-i18n');
      try { todos = el ? JSON.parse(el.textContent) : null; } catch (e) { todos = null; }
    }
    fijar(preferida, todos && todos[preferida]);
    document.documentElement.lang = lengua === 'pt' ? 'pt-BR' : lengua;
    document.title = __(document.title);
    if (document.body) dom(document.body);
  }

  Object.assign(__, { LENGUAS, fijar, dom, cambiar, diccionario, num, dec, mes, fecha });
  // getters vivos (Object.assign los copiaría como valores fijos): en el worker la lengua cambia después de cargar
  Object.defineProperties(__, {
    lengua: { get: () => lengua, enumerable: true },
    locale: { get: () => datosLengua().locale, enumerable: true },
  });
  g.__ = __;
  g.N_ = N_;
  g.R2 = g.R2 || {};
  g.R2.i18n = __;
}(globalThis));

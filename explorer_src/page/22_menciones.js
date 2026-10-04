'use strict';

/* Pestaña «Menciones» de una biblioteca: quién menciona a quién en sus intervenciones.
 *
 * Pide GET /collections/{cid}/mentions (worker/45_engine__menciones.js) y pinta el resumen, la red de menciones en
 * anillos, los más mencionados con sus citas, quién menciona, los diálogos, las co-menciones, las matrices entre
 * partidos y los focos de conversación (comunidades de Leiden).
 *
 * El dibujo de la red se rehace entero con cada render (el panel de la lista se repinta con innerHTML): menRender()
 * llama antes a MEN.limpiarRed() para soltar los oyentes de la ventana del dibujo anterior.
 */

const MEN = {
  cache: new Map(), data: null, cid: null, seq: 0, ctrl: null, limpiarRed: null,
  filtro: 'todas', elegida: null, agrupar: 'partido', sentido: 'todas', minimo: 1, resolucion: 1,
};
const MEN_RESOL = [[0.6, __('menos'), __('Menos focos y más amplios (resolución 0,6)')], [1, __('normal'), __('Resolución 1: la modularidad clásica')],
  [1.6, __('más'), __('Más focos y más finos (resolución 1,6)')]];
const MEN_PERSONAS = 25;   // filas de la tabla de más mencionados

const menEl = (id) => document.getElementById(id);
const menDec = (x, d = 3) => __.dec(Number(x || 0).toFixed(d));
const menPct = (n, d) => (d > 0 ? Math.round(100 * n / d) : 0);
const menChip = (p) => (p ? `<span class="men-chip">${esc(p)}</span>` : `<span class="men-chip ext">${__('externa')}</span>`);

function menAbortar() {
  MEN.ctrl?.abort(); ++MEN.seq;
  if (MEN.limpiarRed) { MEN.limpiarRed(); MEN.limpiarRed = null; }
}

function menClave() {
  const L = S.libInfo;
  return [S.info?.name || '', L.id, L.total, L.hash || L.updated, MEN.resolucion].join('|');
}

function menSlug() {
  return foldMap(S.libInfo?.name || '').folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'biblioteca';
}

async function menLoad() {
  const L = S.libInfo, box = $('#hits');
  if (!L || S.view !== 'library' || S.libTab !== 'menciones') return;
  const key = menClave();
  menAbortar();
  const mine = ++MEN.seq;
  if (!L.total) {
    MEN.data = null; MEN.cid = L.id;
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>${__('Biblioteca vacía')}</h3>
      <p>${__('Las menciones salen de las intervenciones guardadas. Añada algunas desde <b>Explorar</b>.')}</p></div>`;
    return;
  }
  if (MEN.cache.has(key)) { MEN.data = MEN.cache.get(key); MEN.cid = L.id; menRender(); return; }
  MEN.data = null; MEN.cid = null;
  const t0 = performance.now();
  box.innerHTML = `<div class="empty lex-prog" role="status" aria-live="polite">
    <p>${L.total === 1 ? __('Buscando menciones a personas en {0} intervención…', nf(L.total)) : __('Buscando menciones a personas en {0} intervenciones…', nf(L.total))}</p>
    <div class="bar" role="progressbar" aria-label="${esc(__('Progreso de las menciones'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
    <p class="lex-prog-fase">${__('Preparando…')}</p>
    <p class="lex-prog-t dsub">0 % · 0 s</p>
    <p style="margin-top:10px"><button class="btn sm" data-mencancel>${__('Cancelar')}</button></p>
    <p class="dsub" style="margin-top:8px;font-size:11.5px">${__(`Se leen también las demás intervenciones de esas sesiones: hacen falta para
      saber quién presidía y cómo llama la biblioteca a cada persona.`)}</p></div>`;
  box.querySelector('[data-mencancel]').addEventListener('click', () => MEN.ctrl?.abort());
  let ultimoEv = null;
  const pinta = (ev) => {
    if (mine !== MEN.seq) return;
    const bar = box.querySelector('.lex-prog');
    if (!bar) return;
    if (ev) ultimoEv = ev;
    const e = ultimoEv, sg = (performance.now() - t0) / 1000;
    const pct = e ? Math.round(Math.max(0, Math.min(1, e.fraccion || 0)) * 100) : 0;
    bar.querySelector('.bar i').style.width = `${pct}%`;
    bar.querySelector('.bar').setAttribute('aria-valuenow', String(pct));
    if (e) bar.querySelector('.lex-prog-fase').textContent = `${e.indice}/${e.n_fases} · ${__(e.etiqueta)}${e.total > 1 ? ` · ${__('{0} de {1}', nf(e.hecho), nf(e.total))}` : ''}`;
    const eta = e && e.fraccion > 0.08 && e.fraccion < 1 ? sg / e.fraccion - sg : null;
    bar.querySelector('.lex-prog-t').textContent = `${pct} % · ${Math.round(sg)} s${eta != null ? ` · ${__('quedan unos {0} s', Math.max(1, Math.round(eta)))}` : ''}`;
  };
  const reloj = setInterval(() => pinta(null), 500);
  const ctrl = MEN.ctrl = new AbortController();
  const qs = new URLSearchParams({ resolucion: String(MEN.resolucion) });
  try {
    const r = await api(`/collections/${L.id}/mentions?${qs}`, { signal: ctrl.signal, alProgreso: pinta });
    clearInterval(reloj);
    if (mine !== MEN.seq || S.view !== 'library' || S.libSel !== L.id || S.libTab !== 'menciones') return;
    MEN.cache.set(key, r);
    if (MEN.cache.size > 5) MEN.cache.delete(MEN.cache.keys().next().value);
    MEN.data = r; MEN.cid = L.id;
    menRender();
  } catch (e) {
    clearInterval(reloj);
    if (mine !== MEN.seq) return;
    if (e.name === 'AbortError') {
      if (S.view === 'library' && S.libTab === 'menciones' && box.querySelector('.lex-prog')) {
        box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>${__('Cálculo cancelado')}</h3>
          <p>${__('Puede volver a lanzarlo cuando quiera.')}</p><p style="margin-top:10px"><button class="btn sm" data-menretry>${__('Buscar las menciones')}</button></p></div>`;
        box.querySelector('[data-menretry]').addEventListener('click', menLoad);
      }
      return;
    }
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>${__('No se pudieron buscar las menciones')}</h3>
      <p>${esc(e.message)}</p><p style="margin-top:10px"><button class="btn sm" data-menretry>${__('Reintentar')}</button></p></div>`;
    box.querySelector('[data-menretry]').addEventListener('click', menLoad);
  }
}

/* ---------------------------------------------------------------- textos */

function menNota(D) {
  const ext = D.resumen.externas;
  return __(`Personas nombradas en las intervenciones de la biblioteca: <b>miembros de la Cámara</b>, con su tratamiento o su cargo
    («señor diputado Pérez», «Presidenta Gómez») o, si la biblioteca ya los llama así, por su apellido solo, identificados con los
    nombres del corpus; y <b>personas externas</b>{0}, con su cargo («ministro Ruiz», «senador Díaz») o,
    ya identificadas, por su nombre («el Gobierno de Fulano»). Cada mención va de quien habla a quien nombra; entre miembros se
    distingue cuándo <b>se dirige</b> a él y cuándo <b>habla de</b> él. No mide el tono: dos oradores que mencionan a la misma
    persona pueden estar elogiándola o atacándola.`, ext ? __(' ({0} aquí)', nf(ext)) : '');
}

function menMetodo(D) {
  const R = D.resumen, T = R.deteccion || {}, intentos = (T.resueltas || 0) + (T.ambiguas || 0) + (T.sin_resolver || 0);
  const cargos = (T.cargos_sin_atribuir || []).map(([c, n]) => `${c} ${nf(n)}`).join(', ');   // cargos: palabras del corpus, sin traducir
  const li = [
    __(`Menciones a miembros identificadas: {0} de {1} ({2} %); quedan fuera
      {3} ambiguas (casi siempre solo el nombre de pila) y {4} sin resolver. En la red,
      {5} en las que se dirige a la persona y {6} en las que habla de ella.`,
    nf(T.resueltas), nf(intentos), menPct(T.resueltas, intentos), nf(T.ambiguas), nf(T.sin_resolver), nf(T.se_dirige), nf(T.habla_de)),
    __(`Personas externas: {0} menciones con cargo y {1} por su nombre solo. Los jefes de Estado
      y de Gobierno salen del registro de hitos, desde el inicio de su mandato; antes, si tuvieron escaño, cuentan como miembros. Un
      cargo que no ocupa un miembro (senador, gobernador, alcalde, ministro) no se atribuye a un diputado salvo con el nombre completo.`,
    nf(T.externas_cargo), nf(T.externas_nombre)),
    __(`Cuando un apellido lo comparten varios miembros se desempata por el sexo del tratamiento, por quien preside la sesión, por el
      cargo en el Gobierno de esa legislatura, por la actividad en el corpus y, al final, por cómo llama la biblioteca a cada uno. El
      apellido suelto solo cuenta si la biblioteca lo usa con tratamiento al menos tres veces.`),
    __(`Se excluyen los turnos de la Mesa ({0} menciones), el protocolo dirigido a la Presidencia ({1}), las
      fórmulas de dar la palabra y el procedimiento ({2}), las automenciones ({3}), las acotaciones
      entre paréntesis ({4}){5}.`, nf(T.mesa), nf(T.protocolo), nf(T.procedimiento), nf(T.propias), nf(T.acotaciones),
    T.subnacionales ? __(' y los cargos subnacionales ({0})', nf(T.subnacionales)) : ''),
    cargos ? __('Cargos citados sin nombre, aún sin atribuir: {0}. Harían falta tablas de quién ocupaba cada cargo en cada fecha.', esc(cargos)) : '',
    __(`Focos: algoritmo de Leiden sobre la red sin dirección (cada par suma las menciones en los dos sentidos), resolución
      {0}, semilla {1}, modularidad {2}.
      Coinciden poco con los partidos (información mutua normalizada {3}).`,
    menDec(D.opciones?.resolucion ?? MEN.resolucion, 1), nf(D.opciones?.semilla ?? 1), menDec(R.modularidad), menDec(R.nmi)),
    __(`Precisión: revisada a mano en muestras de los dieciséis parlamentos, alrededor de nueve de cada diez menciones señalan a la
      persona correcta. El recuerdo no está medido: faltan las referencias indirectas («su señoría», «el relator», «el orador que
      me precedió»). Se leyeron {0} intervenciones de las sesiones de la biblioteca como contexto y
      {1} fichas de oradores del corpus.`, nf(R.contexto), nf(R.oradores_corpus)),
  ];
  return li.filter(Boolean).map((t) => `<li>${t}</li>`).join('');
}

/* ---------------------------------------------------------------- render */

function menRender() {
  const D = MEN.data, L = S.libInfo, box = $('#hits');
  if (!D || !L || S.view !== 'library' || S.libTab !== 'menciones') return;
  if (MEN.limpiarRed) { MEN.limpiarRed(); MEN.limpiarRed = null; }
  listHead();
  const resol = `<span class="tsel">${__('Focos')}</span><div class="tseg" role="group" aria-label="${esc(__('Número de focos'))}">`
    + MEN_RESOL.map(([v, lab, tit]) => `<button type="button" data-menresol="${v}" aria-pressed="${v === MEN.resolucion}" title="${esc(tit)}">${lab}</button>`).join('')
    + `</div>`;
  if (D.disponible === false) {
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>${__('Sin menciones en este corpus')}</h3>
      <p>${esc(D.motivo ? __(D.motivo) : __('Este corpus no está en el registro de menciones.'))}</p>
      <p class="dsub">${__(`Las formas de tratamiento («señor diputado», «congresista», «Sr. Deputado»…) están registradas para los
      dieciséis parlamentos de ParlaIbero; un CSV propio de otro país todavía no las tiene.`)}</p></div>`;
    return;
  }
  const R = D.resumen;
  if (!D.personas.length) {
    box.innerHTML = `<div class="lex men"><div class="men-ctl">${resol}</div>
      <div class="empty" style="padding:26px 16px"><h3>${__('Ninguna mención')}</h3>
      <p>${__('No se ha reconocido ninguna mención a personas en las {0} intervenciones de la biblioteca.', nf(R.intervenciones))}</p></div></div>`;
    menCtlEventos(box.querySelector('.men'));
    return;
  }
  if (!D.personas.some((p) => p.k === MEN.elegida)) MEN.elegida = D.personas[0].k;

  const metrica = (k, v, s, tit) => `<div class="lex-metric"${tit ? ` title="${esc(tit)}"` : ''}>`
    + `<div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const saltadas = (R.intervenciones_biblioteca || R.intervenciones) - R.intervenciones;
  const metricas = `<div class="lex-metrics">
    ${metrica(__('Con menciones'), nf(R.con_menciones), saltadas > 0
      ? __('{0} % de {1} con discurso', menPct(R.con_menciones, R.intervenciones), nf(R.intervenciones))
      : __('{0} % de {1}', menPct(R.con_menciones, R.intervenciones), nf(R.intervenciones)),
      __('Intervenciones de la biblioteca en las que se menciona a alguien.') + (saltadas > 0
        ? __(' Quedan fuera {0} de las {1} guardadas: no son discurso (listas de votación, crónica del acta, tablas).', nf(saltadas), nf(R.intervenciones_biblioteca)) : ''))}
    ${metrica(__('Personas mencionadas'), nf(R.mencionadas), __('{0} externas a la Cámara', nf(R.externas)))}
    ${metrica(__('Menciones'), nf(R.menciones), __('de {0} oradores', nf(R.oradores)))}
    ${metrica(__('Focos'), nf(R.focos), __('modularidad {0}', menDec(R.modularidad)), __('Comunidades de Leiden en la red de menciones'))}</div>`;

  box.innerHTML = `<div class="lex men">
    <div class="men-ctl">
      <span class="tsel">${__('Mostrar')}</span>
      <div class="tseg" id="menFiltro" role="group" aria-label="${esc(__('Qué personas mostrar'))}">
        <button type="button" data-menf="todas" aria-pressed="${MEN.filtro === 'todas'}">${__('Todas')}</button>
        <button type="button" data-menf="dip" aria-pressed="${MEN.filtro === 'dip'}">${__('Miembros')}</button>
        <button type="button" data-menf="ext" aria-pressed="${MEN.filtro === 'ext'}">${__('Externas')}</button>
      </div>
      ${resol}
      <span class="men-hueco"></span>
      <button type="button" class="btn sm" data-menexp="csv" title="${esc(__('Una fila por mención: quién habla, a quién menciona, cómo, la fecha y las palabras con las que la nombra'))}">${__('Menciones (CSV)')}</button>
      <button type="button" class="btn sm" data-menexp="gexf" title="${esc(__('La red dirigida para Gephi, con el partido y el foco de cada persona'))}">${__('Red (GEXF)')}</button>
    </div>
    ${metricas}
    <p class="lex-note">${menNota(D)}</p>
    <details class="men-metodo"><summary>${__('Método y límites')}</summary><ul>${menMetodo(D)}</ul></details>

    <section aria-label="${esc(__('Red de menciones'))}">
      <div class="men-cab">
        <div>
          <h3>${__('Red de menciones')}</h3>
          <p class="men-sub" id="menExplica"></p>
        </div>
        <div class="men-ctl" style="margin:0">
          <span class="tsel">${__('Agrupar')}</span>
          <div class="tseg" id="menAgrupar" role="group" aria-label="${esc(__('Sectores y colores de la red'))}">
            <button type="button" data-meng="partido" aria-pressed="${MEN.agrupar === 'partido'}">${__('Partido')}</button>
            <button type="button" data-meng="foco" aria-pressed="${MEN.agrupar === 'foco'}">${__('Foco')}</button>
          </div>
          <span class="tsel">${__('Menciones')}</span>
          <div class="tseg" id="menSentido" role="group" aria-label="${esc(__('Qué menciones muestra la red'))}">
            <button type="button" data-mens="todas" aria-pressed="${MEN.sentido === 'todas'}">${__('Todas')}</button>
            <button type="button" data-mens="hechas" aria-pressed="${MEN.sentido === 'hechas'}">${__('Hechas')}</button>
            <button type="button" data-mens="recibidas" aria-pressed="${MEN.sentido === 'recibidas'}">${__('Recibidas')}</button>
          </div>
          <button type="button" class="btn sm" id="menEgo" aria-pressed="false" disabled>${__('Modo ego')}</button>
          <label class="tsel men-min" for="menMinimo" title="${esc(__('Deja solo las conexiones con al menos tantas menciones; con 1 se ve la red entera'))}">${__('Mínimo de menciones')}
            <input type="number" id="menMinimo" min="1" step="1" value="${MEN.minimo}" inputmode="numeric" autocomplete="off"></label>
          <div class="tseg" role="group" aria-label="${esc(__('Zoom'))}">
            <button type="button" id="menZmas" aria-label="${esc(__('Acercar'))}">+</button>
            <button type="button" id="menZmenos" aria-label="${esc(__('Alejar'))}">−</button>
            <button type="button" id="menEncuadre">${__('Encuadrar')}</button>
          </div>
        </div>
      </div>
      <div class="men-marco">
        <svg id="menRed" viewBox="0 0 1000 720" role="img" aria-label="${esc(__('Red de menciones: personas unidas por las menciones entre ellas, agrupadas por partido o por foco'))}"></svg>
        <div class="men-tip" id="menTip" hidden></div>
        <div class="men-info" id="menInfo" aria-live="polite"></div>
      </div>
      <div class="men-leyenda" id="menLeyenda"></div>
    </section>

    <section aria-label="${esc(__('Más mencionados'))}">
      <div class="men-dos">
        <div>
          <h3>${__('Más mencionados')}</h3>
          <p class="men-sub">${__('Por el número de oradores distintos que los mencionan. Pulse una persona para leer sus menciones.')}</p>
          <div class="men-envoltura"><table class="men-tabla" id="menPersonas"></table></div>
        </div>
        <aside class="men-panel" id="menPanel" aria-live="polite"></aside>
      </div>
    </section>

    <section class="men-dos" aria-label="${esc(__('Quién menciona y diálogos'))}">
      <div>
        <h3>${__('Quién menciona')}</h3>
        <p class="men-sub">${__('Oradores ordenados por el número de personas distintas que mencionan.')}</p>
        <div class="men-envoltura"><table class="men-tabla" id="menMencionan"></table></div>
      </div>
      <div style="display:grid;gap:18px">
        <div>
          <h3>${__('Diálogos')}</h3>
          <p class="men-sub">${__('Pares de miembros que se mencionan en los dos sentidos (de A a B · de B a A).')}</p>
          <ul class="men-lista" id="menDialogos"></ul>
        </div>
        <div>
          <h3>${__('Co-menciones')}</h3>
          <p class="men-sub">${__('Personas mencionadas en la misma intervención.')}</p>
          <ul class="men-lista" id="menComenciones"></ul>
        </div>
      </div>
    </section>

    <section aria-label="${esc(__('Menciones entre partidos'))}">
      <h3>${__('Entre partidos')}</h3>
      <p class="men-sub">${__(`Menciones a miembros de la Cámara <b>por cada 10.000 palabras</b> del partido que habla, sin contar sus
        turnos de Mesa: así un partido que ocupa más tiempo no encabeza todas las filas. Filas: partido de quien habla; columnas:
        partido del mencionado. El tono es la parte de las menciones de la fila y el recuadro marca el propio partido; pase por
        encima de una casilla para ver las menciones, la tasa y las veces que pasa la media del cuadro.`)}</p>
      <div class="men-envoltura"><table class="men-tabla men-matriz" id="menMatriz"></table></div>
    </section>

    <section aria-label="${esc(__('Personas externas por partido'))}">
      <h3>${__('Personas externas según el partido de quien habla')}</h3>
      <p class="men-sub">${__(`Menciones a las seis personas externas más citadas, también por cada 10.000 palabras del partido que habla.
        Muestra quién habla de quién, no si lo hace a favor o en contra.`)}</p>
      <div class="men-envoltura"><table class="men-tabla men-matriz" id="menExternas"></table></div>
    </section>

    <section aria-label="${esc(__('Focos de conversación'))}">
      <h3>${__('Focos de conversación')}</h3>
      <p class="men-sub">${__(`Comunidades de Leiden en la red de menciones. Reúnen a quienes hablan de las mismas personas y a esas
        personas; <b>no son coaliciones</b>: un foco puede juntar a quienes defienden y a quienes atacan a alguien.`)}</p>
      <div class="men-focos" id="menFocos"></div>
    </section>
  </div>`;

  menCtlEventos(box.querySelector('.men'));
  menPintarPersonas();
  menPintarTablas(D);
  menRedIniciar(D);
}

/** Controles de la cabecera: filtro, resolución y exportaciones (en el envoltorio, que se rehace con cada render). */
function menCtlEventos(caja) {
  caja.addEventListener('click', (e) => {
    const f = e.target.closest('[data-menf]');
    if (f) {
      MEN.filtro = f.dataset.menf;
      for (const x of menEl('menFiltro').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === f));
      menPintarPersonas();
      return;
    }
    const r = e.target.closest('[data-menresol]');
    if (r) { const v = Number(r.dataset.menresol); if (v !== MEN.resolucion) { MEN.resolucion = v; menLoad(); } return; }
    const x = e.target.closest('[data-menexp]');
    if (x) { if (x.dataset.menexp === 'csv') menExportCSV(); else menExportGEXF(); }
  });
}

/* ------------------------------------------------- más mencionados y panel */

function menPintarPersonas() {
  const D = MEN.data, t = menEl('menPersonas');
  if (!D || !t) return;
  const maxOr = Math.max(1, ...D.personas.map((p) => p.oradores));
  const filas = D.personas.filter((p) => MEN.filtro === 'todas' || (MEN.filtro === 'ext' ? p.ext : !p.ext)).slice(0, MEN_PERSONAS);
  if (!filas.some((p) => p.k === MEN.elegida) && filas.length) MEN.elegida = filas[0].k;
  t.innerHTML = `<thead><tr><th>${__('Persona')}</th><th class="num">${__('Oradores')}</th><th class="num">${__('Menciones')}</th><th>${__('Cómo')}</th>
      <th>${__('Quién le menciona')}</th><th>${__('Foco')}</th></tr></thead><tbody>`
    + filas.map((p) => {
      const como = p.ext ? '<span class="men-pp">—</span>' : `<span class="men-pp">${__('se dirige {0} %', menPct(p.voc, p.voc + p.ref))}</span>`;
      return `<tr class="men-fila" tabindex="0" data-menk="${esc(p.k)}" aria-selected="${p.k === MEN.elegida}">
        <td><span class="men-quien">${esc(p.n)}</span>${menChip(p.p)}</td>
        <td class="num"><span class="men-barrita" style="width:${Math.max(3, Math.round(60 * p.oradores / maxOr))}px"></span>${nf(p.oradores)}</td>
        <td class="num">${nf(p.menciones)}</td>
        <td>${como}</td>
        <td><span class="men-pp">${p.porPartido.slice(0, 2).map(([q, n]) => `${esc(q)} ${n} %`).join(' · ')}</span></td>
        <td>${p.foco ? `<span class="men-foco-tag">F${p.foco}</span>` : ''}</td></tr>`;
    }).join('') + '</tbody>';
  if (!t.dataset.listo) {
    t.dataset.listo = '1';
    t.addEventListener('click', (e) => {
      const tr = e.target.closest('tr.men-fila');
      if (!tr) return;
      MEN.elegida = tr.dataset.menk; menPintarPersonas();
    });
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tr = e.target.closest('tr.men-fila');
      if (!tr) return;
      e.preventDefault(); e.stopPropagation();
      MEN.elegida = tr.dataset.menk; menPintarPersonas();
      menEl('menPersonas').querySelector(`tr.men-fila[data-menk="${CSS.escape(MEN.elegida)}"]`)?.focus();
    });
  }
  menPintarPanel();
}

function menPintarPanel() {
  const D = MEN.data, caja = menEl('menPanel');
  if (!D || !caja) return;
  const p = D.personas.find((x) => x.k === MEN.elegida);
  if (!p) { caja.innerHTML = ''; return; }
  caja.innerHTML = `<h3>${__('Menciones de {0}', esc(p.n))}</h3>
    <p class="men-meta">${p.p ? esc(p.p) + ' · ' : __('Persona externa') + ' · '}${__('{0} oradores · {1} menciones', nf(p.oradores), nf(p.menciones))}${p.foco ? __(' · foco F{0}', p.foco) : ''}</p>
    <ul class="men-citas">${p.contextos.map((c) => `<li>
      <div class="men-de"><b>${esc(c.o)}</b><span>${esc(c.op || '')}</span><span>${esc(c.f ? fechaCorta(c.f) : '')}</span><span class="men-tipo">${esc(__(c.t))}</span></div>
      <p data-menopen="${c.id}" role="button" tabindex="0" title="${esc(__('Abrir la intervención en el lector'))}">…${esc(c.x[0])}<mark>${esc(c.x[1])}</mark>${esc(c.x[2])}…</p></li>`).join('')}</ul>`;
  if (caja.dataset.listo) return;
  caja.dataset.listo = '1';
  const abrir = (e) => {
    const el = e.target.closest('[data-menopen]');
    if (!el) return;
    if (e.type === 'keydown') { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); e.stopPropagation(); }
    openSpeech(+el.dataset.menopen, { mode: 'speech' });
  };
  caja.addEventListener('click', abrir);
  caja.addEventListener('keydown', abrir);
}

/* --------------------------------- quién menciona, diálogos, matrices, focos */

/** Ficha de las casillas de una matriz: el `title` del navegador tarda casi un segundo en salir, así que se pinta una
 *  propia, pegada al cursor y dentro del panel. La casilla bajo el cursor se marca con un recuadro. */
function menFichaTabla(tabla) {
  if (!tabla) return;
  const raiz = tabla.closest('.men');
  if (!raiz) return;
  let tip = raiz.querySelector('.men-tip-tabla');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'men-tip men-tip-tabla';
    tip.hidden = true;
    raiz.append(tip);
  }
  let bajo = null;
  const esconder = () => { tip.hidden = true; bajo?.classList.remove('men-bajo'); bajo = null; };
  tabla.addEventListener('pointermove', (e) => {
    const celda = e.target.closest?.('[data-tip]');
    if (!celda || !tabla.contains(celda)) { esconder(); return; }
    if (celda !== bajo) {
      bajo?.classList.remove('men-bajo');
      bajo = celda; bajo.classList.add('men-bajo');
      tip.innerHTML = celda.dataset.tip;
    }
    tip.hidden = false;
    const caja = raiz.getBoundingClientRect();
    const x = e.clientX - caja.left + 14, y = e.clientY - caja.top + 16;
    tip.style.left = `${Math.round(Math.max(4, Math.min(caja.width - tip.offsetWidth - 4, x)))}px`;
    tip.style.top = `${Math.round(y)}px`;
  });
  tabla.addEventListener('pointerleave', esconder);
}


function menPintarTablas(D) {
  const maxP = Math.max(1, ...D.mencionan.map((m) => m.personas));
  menEl('menMencionan').innerHTML = `<thead><tr><th>${__('Orador')}</th><th class="num">${__('Personas')}</th><th class="num">${__('Menciones')}</th></tr></thead><tbody>`
    + D.mencionan.map((m) => `<tr><td><span class="men-quien">${esc(m.n)}</span>${menChip(m.p)}</td>
      <td class="num"><span class="men-barrita" style="width:${Math.max(3, Math.round(60 * m.personas / maxP))}px"></span>${nf(m.personas)}</td>
      <td class="num">${nf(m.menciones)}</td></tr>`).join('') + '</tbody>';

  menEl('menDialogos').innerHTML = D.dialogos.length
    ? D.dialogos.map((d) => `<li><span>${esc(d.a)} <span class="men-pp">${esc(d.ap || '')}</span> ⇄ ${esc(d.b)} <span class="men-pp">${esc(d.bp || '')}</span></span>
        <span class="num">${nf(d.ab)} · ${nf(d.ba)}</span></li>`).join('')
    : `<li><span class="men-pp">${__('Ningún par se menciona en los dos sentidos.')}</span></li>`;
  menEl('menComenciones').innerHTML = D.comenciones.length
    ? D.comenciones.map((c) => `<li><span>${esc(c.a)} + ${esc(c.b)}</span><span class="num">${__('{0} intervenciones', nf(c.n))}</span></li>`).join('')
    : `<li><span class="men-pp">${__('Ninguna intervención menciona a dos personas.')}</span></li>`;

  // Matrices en frecuencia relativa: menciones por cada diez mil palabras del partido que habla (sin sus turnos de
  // Mesa), para que el partido que más tiempo ocupa no encabece todas las filas. El tono sigue siendo la parte de la
  // fila y el detalle de cada casilla, con la cifra bruta y la media del cuadro, va en su título.
  const tono = (x) => `background:rgba(var(--men-heat),${(0.05 + 0.55 * (x || 0)).toFixed(3)})`;
  const POR = 10000;
  const tasa = (n, pal) => (pal > 0 ? POR * n / pal : null);
  const numTasa = (t) => (t == null ? '·' : t === 0 ? '0' : __.dec(t.toFixed(t < 10 ? 1 : 0)));
  const veces = (t, media) => (t == null || !media ? '' : __(' · {0} veces la media del cuadro', __.dec((t / media).toFixed(1))));

  const M = D.matriz;
  const colM = M.partidos.map((_, j) => M.filas.reduce((s, f) => s + (f.celdas[j] || 0), 0));
  const palM = M.filas.reduce((s, f) => s + (f.palabras || 0), 0);
  menEl('menMatriz').innerHTML = `<thead><tr><th>${__('De \\ a')}</th>${M.partidos.map((p) => `<th class="num">${esc(p)}</th>`).join('')}
      <th class="num">${__('Propio')}</th><th class="num">${__('Todas')}</th></tr></thead><tbody>`
    + M.filas.map((f, i) => `<tr><th class="men-fil" scope="row" data-tip="${esc(__('<b>{0}</b>: {1} menciones a miembros en {2} palabras', esc(f.p), nf(f.total), nf(f.palabras)))}">${esc(f.p)}</th>`
      + f.celdas.map((n, j) => {
        const t = tasa(n, f.palabras), media = tasa(colM[j], palM);
        const tit = `<b>${esc(f.p)} → ${esc(M.partidos[j])}</b>: ${n === 1 ? __('{0} mención', nf(n)) : __('{0} menciones', nf(n))}`
          + (t == null ? '' : __(' · {0} por cada {1} palabras de {2}', numTasa(t), nf(POR), esc(f.p)) + (media ? __(' (media del cuadro {0})', numTasa(media)) : '') + veces(t, media));
        return `<td class="men-celda${i === j ? ' men-diag' : ''}" style="${tono(n / Math.max(1, f.total))}" data-tip="${esc(tit)}">${numTasa(t)}</td>`;
      }).join('')
      + `<td class="num" data-tip="${esc(__('<b>{0}</b>: {1} de sus {2} menciones van a su propio partido', esc(f.p), nf(f.celdas[i] || 0), nf(f.total)))}">${menPct(f.celdas[i] || 0, f.total)} %</td>`
      + `<td class="num" data-tip="${esc(__('<b>{0}</b>: {1} menciones a miembros en {2} palabras', esc(f.p), nf(f.total), nf(f.palabras)))}">${numTasa(tasa(f.total, f.palabras))}</td></tr>`).join('') + '</tbody>';

  const X = D.externas;
  const colX = X.personas.map((_, j) => X.filas.reduce((s, f) => s + (f.celdas[j] || 0), 0));
  const palX = X.filas.reduce((s, f) => s + (f.palabras || 0), 0);
  menEl('menExternas').innerHTML = `<thead><tr><th>${__('Partido')}</th>${X.personas.map((p) => `<th class="num">${esc(p)}</th>`).join('')}</tr></thead><tbody>`
    + X.filas.map((f) => {
      const suma = f.celdas.reduce((a, b) => a + b, 0);
      return `<tr><th class="men-fil" scope="row" data-tip="${esc(__('<b>{0}</b>: {1} palabras en la biblioteca', esc(f.p), nf(f.palabras)))}">${esc(f.p)}</th>`
        + f.celdas.map((n, j) => {
          const t = tasa(n, f.palabras), media = tasa(colX[j], palX);
          const tit = `<b>${esc(f.p)} → ${esc(X.personas[j])}</b>: ${n === 1 ? __('{0} mención', nf(n)) : __('{0} menciones', nf(n))}`
            + (t == null ? '' : __(' · {0} por cada {1} palabras de {2}', numTasa(t), nf(POR), esc(f.p)) + (media ? __(' (media del cuadro {0})', numTasa(media)) : '') + veces(t, media));
          return `<td class="men-celda" style="${tono(n / Math.max(1, suma))}" data-tip="${esc(tit)}">${numTasa(t)}</td>`;
        }).join('') + '</tr>';
    }).join('') + '</tbody>';

  menFichaTabla(menEl('menMatriz'));
  menFichaTabla(menEl('menExternas'));

  menEl('menFocos').innerHTML = D.focos.map((f) => `<article class="men-foco" style="--c:${f.id <= 8 ? `var(--men-f${f.id})` : 'var(--text-faint)'}">
      <h4>F${f.id} · ${f.centrales.slice(0, 3).map((c) => esc(c.n)).join(' · ')}</h4>
      <div class="men-meta">${__('{0} personas · {1} miembros · {2} externas', nf(f.personas), nf(f.diputados), nf(f.externas))}</div>
      <div class="men-comp">${f.partidos.map(([p, n]) => `${esc(p)} ${n} %`).join(' · ')}</div>
      <div class="men-nombres">${f.centrales.map((c) => `<span class="${c.p ? '' : 'ext'}" title="${c.p ? esc(c.p) : esc(__('persona externa'))}">${esc(c.n)}</span>`).join('')}</div>
    </article>`).join('');
}

/* ---------------------------------------------------------------- exportar */

function menMeta(D) {
  const L = S.libInfo, R = D.resumen, T = R.deteccion || {};
  return [
    __('Explorador de Diarios de Sesiones · menciones a personas en las intervenciones de una biblioteca'),
    __('biblioteca: {0} ({1} intervenciones; {2} más leídas como contexto)', L?.name || '', nf(R.intervenciones), nf(R.contexto)),
    __('corpus: {0}', S.info?.title || S.info?.name || ''),
    __('generado: {0}', new Date().toISOString().slice(0, 19)),
    __('menciones: {0} en {1} intervenciones · {2} personas mencionadas ({3} externas) · {4} oradores', R.menciones, R.con_menciones, R.mencionadas, R.externas, R.oradores),
    __('identificación: {0} menciones a miembros resueltas, {1} ambiguas y {2} sin resolver; excluidas las de la Mesa ({3}), el protocolo a la Presidencia ({4}), el procedimiento ({5}) y las automenciones ({6})',
    T.resueltas, T.ambiguas, T.sin_resolver, T.mesa, T.protocolo, T.procedimiento, T.propias),
    __('focos: Leiden sobre la red sin dirección, resolución {0}, semilla {1} · modularidad {2} · {3} focos · información mutua normalizada con los partidos {4}',
    D.opciones?.resolucion, D.opciones?.semilla, R.modularidad, R.focos, R.nmi),
  ];
}

function menExportCSV() {
  const D = MEN.data;
  if (!D || !(D.detalle || []).length) return toast(__('Aún no hay menciones que exportar.'), true);
  const cols = ['id', 'fecha', 'orador', 'partido_orador', 'mencionado', 'partido_mencionado', 'externa', 'como', 'texto'];
  const filas = D.detalle.map((m) => [m.id, m.f, m.o, m.op, m.n, m.p, m.e, m.t, m.x]);
  downloadText(csvConFuente(menMeta(D), cols, filas), `menciones_${menSlug()}.csv`, 'text/csv;charset=utf-8');
}

function menExportGEXF() {
  const D = MEN.data;
  if (!D || !(D.red?.nodos || []).length) return toast(__('Aún no hay red que exportar.'), true);
  const x = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const F = fuenteDe();
  const desc = menMeta(D).concat([__('Fuente: {0}', `${F.cita || F.cita_corta || ''}${F.url ? ` · ${F.url}` : ''}`)]).join('\n');
  const nodos = D.red.nodos.map((n, i) => `      <node id="${i}" label="${x(n.n)}"><attvalues>`
    + `<attvalue for="0" value="${x(n.p || 'externa')}"/><attvalue for="1" value="${n.ext ? 'sí' : 'no'}"/>`
    + `<attvalue for="2" value="${n.f || 0}"/><attvalue for="3" value="${n.or}"/><attvalue for="4" value="${n.men}"/>`
    + `<attvalue for="5" value="${n.emite}"/></attvalues></node>`).join('\n');
  let k = 0;
  const aristas = [];
  for (const [a, b, ab, ba] of D.red.aristas) {
    if (ab) aristas.push(`      <edge id="${k++}" source="${a}" target="${b}" weight="${ab}"/>`);
    if (ba) aristas.push(`      <edge id="${k++}" source="${b}" target="${a}" weight="${ba}"/>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://gexf.net/1.3" version="1.3">
  <meta lastmodifieddate="${new Date().toISOString().slice(0, 10)}">
    <creator>ParlaIbero · Explorador de Diarios de Sesiones</creator>
    <description>${x(desc)}</description>
  </meta>
  <graph defaultedgetype="directed" mode="static">
    <attributes class="node">
      <attribute id="0" title="partido" type="string"/>
      <attribute id="1" title="externa" type="string"/>
      <attribute id="2" title="foco" type="integer"/>
      <attribute id="3" title="oradores_que_la_mencionan" type="integer"/>
      <attribute id="4" title="menciones_recibidas" type="integer"/>
      <attribute id="5" title="personas_que_menciona" type="integer"/>
    </attributes>
    <nodes>
${nodos}
    </nodes>
    <edges>
${aristas.join('\n')}
    </edges>
  </graph>
</gexf>
`;
  downloadText(xml, `menciones_${menSlug()}.gexf`, 'application/gexf+xml');
}

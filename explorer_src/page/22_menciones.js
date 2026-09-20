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
const MEN_RESOL = [[0.6, 'menos', 'Menos focos y más amplios (resolución 0,6)'], [1, 'normal', 'Resolución 1: la modularidad clásica'],
  [1.6, 'más', 'Más focos y más finos (resolución 1,6)']];
const MEN_PERSONAS = 25;   // filas de la tabla de más mencionados

const menEl = (id) => document.getElementById(id);
const menDec = (x, d = 3) => Number(x || 0).toFixed(d).replace('.', ',');
const menPct = (n, d) => (d > 0 ? Math.round(100 * n / d) : 0);
const menChip = (p) => (p ? `<span class="men-chip">${esc(p)}</span>` : '<span class="men-chip ext">externa</span>');

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
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Biblioteca vacía</h3>
      <p>Las menciones salen de las intervenciones guardadas. Añada algunas desde <b>Explorar</b>.</p></div>`;
    return;
  }
  if (MEN.cache.has(key)) { MEN.data = MEN.cache.get(key); MEN.cid = L.id; menRender(); return; }
  MEN.data = null; MEN.cid = null;
  const t0 = performance.now();
  box.innerHTML = `<div class="empty lex-prog" role="status" aria-live="polite">
    <p>Buscando menciones a personas en ${nf(L.total)} ${L.total === 1 ? 'intervención' : 'intervenciones'}…</p>
    <div class="bar" role="progressbar" aria-label="Progreso de las menciones" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
    <p class="lex-prog-fase">Preparando…</p>
    <p class="lex-prog-t dsub">0 % · 0 s</p>
    <p style="margin-top:10px"><button class="btn sm" data-mencancel>Cancelar</button></p>
    <p class="dsub" style="margin-top:8px;font-size:11.5px">Se leen también las demás intervenciones de esas sesiones: hacen falta para
      saber quién presidía y cómo llama la biblioteca a cada persona.</p></div>`;
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
    if (e) bar.querySelector('.lex-prog-fase').textContent = `${e.indice}/${e.n_fases} · ${e.etiqueta}${e.total > 1 ? ` · ${nf(e.hecho)} de ${nf(e.total)}` : ''}`;
    const eta = e && e.fraccion > 0.08 && e.fraccion < 1 ? sg / e.fraccion - sg : null;
    bar.querySelector('.lex-prog-t').textContent = `${pct} % · ${Math.round(sg)} s${eta != null ? ` · quedan unos ${Math.max(1, Math.round(eta))} s` : ''}`;
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
        box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Cálculo cancelado</h3>
          <p>Puede volver a lanzarlo cuando quiera.</p><p style="margin-top:10px"><button class="btn sm" data-menretry>Buscar las menciones</button></p></div>`;
        box.querySelector('[data-menretry]').addEventListener('click', menLoad);
      }
      return;
    }
    box.innerHTML = `<div class="empty"><div class="big">⚠</div><h3>No se pudieron buscar las menciones</h3>
      <p>${esc(e.message)}</p><p style="margin-top:10px"><button class="btn sm" data-menretry>Reintentar</button></p></div>`;
    box.querySelector('[data-menretry]').addEventListener('click', menLoad);
  }
}

/* ---------------------------------------------------------------- textos */

function menNota(D) {
  const ext = D.resumen.externas;
  return `Personas nombradas en las intervenciones de la biblioteca: <b>miembros de la Cámara</b>, con su tratamiento o su cargo
    («señor diputado Pérez», «Presidenta Gómez») o, si la biblioteca ya los llama así, por su apellido solo, identificados con los
    nombres del corpus; y <b>personas externas</b>${ext ? ` (${nf(ext)} aquí)` : ''}, con su cargo («ministro Ruiz», «senador Díaz») o,
    ya identificadas, por su nombre («el Gobierno de Fulano»). Cada mención va de quien habla a quien nombra; entre miembros se
    distingue cuándo <b>se dirige</b> a él y cuándo <b>habla de</b> él. No mide el tono: dos oradores que mencionan a la misma
    persona pueden estar elogiándola o atacándola.`;
}

function menMetodo(D) {
  const R = D.resumen, T = R.deteccion || {}, intentos = (T.resueltas || 0) + (T.ambiguas || 0) + (T.sin_resolver || 0);
  const cargos = (T.cargos_sin_atribuir || []).map(([c, n]) => `${c} ${nf(n)}`).join(', ');
  const li = [
    `Menciones a miembros identificadas: ${nf(T.resueltas)} de ${nf(intentos)} (${menPct(T.resueltas, intentos)} %); quedan fuera
      ${nf(T.ambiguas)} ambiguas (casi siempre solo el nombre de pila) y ${nf(T.sin_resolver)} sin resolver. En la red,
      ${nf(T.se_dirige)} en las que se dirige a la persona y ${nf(T.habla_de)} en las que habla de ella.`,
    `Personas externas: ${nf(T.externas_cargo)} menciones con cargo y ${nf(T.externas_nombre)} por su nombre solo. Los jefes de Estado
      y de Gobierno salen del registro de hitos, desde el inicio de su mandato; antes, si tuvieron escaño, cuentan como miembros. Un
      cargo que no ocupa un miembro (senador, gobernador, alcalde, ministro) no se atribuye a un diputado salvo con el nombre completo.`,
    `Cuando un apellido lo comparten varios miembros se desempata por el sexo del tratamiento, por quien preside la sesión, por el
      cargo en el Gobierno de esa legislatura, por la actividad en el corpus y, al final, por cómo llama la biblioteca a cada uno. El
      apellido suelto solo cuenta si la biblioteca lo usa con tratamiento al menos tres veces.`,
    `Se excluyen los turnos de la Mesa (${nf(T.mesa)} menciones), el protocolo dirigido a la Presidencia (${nf(T.protocolo)}), las
      fórmulas de dar la palabra y el procedimiento (${nf(T.procedimiento)}), las automenciones (${nf(T.propias)}), las acotaciones
      entre paréntesis (${nf(T.acotaciones)})${T.subnacionales ? ` y los cargos subnacionales (${nf(T.subnacionales)})` : ''}.`,
    cargos ? `Cargos citados sin nombre, aún sin atribuir: ${esc(cargos)}. Harían falta tablas de quién ocupaba cada cargo en cada fecha.` : '',
    `Focos: algoritmo de Leiden sobre la red sin dirección (cada par suma las menciones en los dos sentidos), resolución
      ${menDec(D.opciones?.resolucion ?? MEN.resolucion, 1)}, semilla ${nf(D.opciones?.semilla ?? 1)}, modularidad ${menDec(R.modularidad)}.
      Coinciden poco con los partidos (información mutua normalizada ${menDec(R.nmi)}).`,
    `Precisión: revisada a mano en muestras de los dieciséis parlamentos, alrededor de nueve de cada diez menciones señalan a la
      persona correcta. El recuerdo no está medido: faltan las referencias indirectas («su señoría», «el relator», «el orador que
      me precedió»). Se leyeron ${nf(R.contexto)} intervenciones de las sesiones de la biblioteca como contexto y
      ${nf(R.oradores_corpus)} fichas de oradores del corpus.`,
  ];
  return li.filter(Boolean).map((t) => `<li>${t}</li>`).join('');
}

/* ---------------------------------------------------------------- render */

function menRender() {
  const D = MEN.data, L = S.libInfo, box = $('#hits');
  if (!D || !L || S.view !== 'library' || S.libTab !== 'menciones') return;
  if (MEN.limpiarRed) { MEN.limpiarRed(); MEN.limpiarRed = null; }
  listHead();
  const resol = `<span class="tsel">Focos</span><div class="tseg" role="group" aria-label="Número de focos">`
    + MEN_RESOL.map(([v, lab, tit]) => `<button type="button" data-menresol="${v}" aria-pressed="${v === MEN.resolucion}" title="${esc(tit)}">${lab}</button>`).join('')
    + `</div>`;
  if (D.disponible === false) {
    box.innerHTML = `<div class="empty"><div class="big">◇</div><h3>Sin menciones en este corpus</h3>
      <p>${esc(D.motivo || 'Este corpus no está en el registro de menciones.')}</p>
      <p class="dsub">Las formas de tratamiento («señor diputado», «congresista», «Sr. Deputado»…) están registradas para los
      dieciséis parlamentos de ParlaIbero; un CSV propio de otro país todavía no las tiene.</p></div>`;
    return;
  }
  const R = D.resumen;
  if (!D.personas.length) {
    box.innerHTML = `<div class="lex men"><div class="men-ctl">${resol}</div>
      <div class="empty" style="padding:26px 16px"><h3>Ninguna mención</h3>
      <p>No se ha reconocido ninguna mención a personas en las ${nf(R.intervenciones)} intervenciones de la biblioteca.</p></div></div>`;
    menCtlEventos(box.querySelector('.men'));
    return;
  }
  if (!D.personas.some((p) => p.k === MEN.elegida)) MEN.elegida = D.personas[0].k;

  const metrica = (k, v, s, tit) => `<div class="lex-metric"${tit ? ` title="${esc(tit)}"` : ''}>`
    + `<div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const saltadas = (R.intervenciones_biblioteca || R.intervenciones) - R.intervenciones;
  const metricas = `<div class="lex-metrics">
    ${metrica('Con menciones', nf(R.con_menciones), `${menPct(R.con_menciones, R.intervenciones)} % de ${nf(R.intervenciones)}${saltadas > 0 ? ' con discurso' : ''}`,
      `Intervenciones de la biblioteca en las que se menciona a alguien.${saltadas > 0
        ? ` Quedan fuera ${nf(saltadas)} de las ${nf(R.intervenciones_biblioteca)} guardadas: no son discurso (listas de votación, crónica del acta, tablas).` : ''}`)}
    ${metrica('Personas mencionadas', nf(R.mencionadas), `${nf(R.externas)} externas a la Cámara`)}
    ${metrica('Menciones', nf(R.menciones), `de ${nf(R.oradores)} oradores`)}
    ${metrica('Focos', nf(R.focos), `modularidad ${menDec(R.modularidad)}`, 'Comunidades de Leiden en la red de menciones')}</div>`;

  box.innerHTML = `<div class="lex men">
    <div class="men-ctl">
      <span class="tsel">Mostrar</span>
      <div class="tseg" id="menFiltro" role="group" aria-label="Qué personas mostrar">
        <button type="button" data-menf="todas" aria-pressed="${MEN.filtro === 'todas'}">Todas</button>
        <button type="button" data-menf="dip" aria-pressed="${MEN.filtro === 'dip'}">Miembros</button>
        <button type="button" data-menf="ext" aria-pressed="${MEN.filtro === 'ext'}">Externas</button>
      </div>
      ${resol}
      <span class="men-hueco"></span>
      <button type="button" class="btn sm" data-menexp="csv" title="Una fila por mención: quién habla, a quién menciona, cómo, la fecha y las palabras con las que la nombra">Menciones (CSV)</button>
      <button type="button" class="btn sm" data-menexp="gexf" title="La red dirigida para Gephi, con el partido y el foco de cada persona">Red (GEXF)</button>
    </div>
    ${metricas}
    <p class="lex-note">${menNota(D)}</p>
    <details class="men-metodo"><summary>Método y límites</summary><ul>${menMetodo(D)}</ul></details>

    <section aria-label="Red de menciones">
      <div class="men-cab">
        <div>
          <h3>Red de menciones</h3>
          <p class="men-sub" id="menExplica"></p>
        </div>
        <div class="men-ctl" style="margin:0">
          <span class="tsel">Agrupar</span>
          <div class="tseg" id="menAgrupar" role="group" aria-label="Sectores y colores de la red">
            <button type="button" data-meng="partido" aria-pressed="${MEN.agrupar === 'partido'}">Partido</button>
            <button type="button" data-meng="foco" aria-pressed="${MEN.agrupar === 'foco'}">Foco</button>
          </div>
          <span class="tsel">Menciones</span>
          <div class="tseg" id="menSentido" role="group" aria-label="Qué menciones muestra la red">
            <button type="button" data-mens="todas" aria-pressed="${MEN.sentido === 'todas'}">Todas</button>
            <button type="button" data-mens="hechas" aria-pressed="${MEN.sentido === 'hechas'}">Hechas</button>
            <button type="button" data-mens="recibidas" aria-pressed="${MEN.sentido === 'recibidas'}">Recibidas</button>
          </div>
          <button type="button" class="btn sm" id="menEgo" aria-pressed="false" disabled>Modo ego</button>
          <label class="tsel men-min" for="menMinimo" title="Deja solo las conexiones con al menos tantas menciones; con 1 se ve la red entera">Mínimo de menciones
            <input type="number" id="menMinimo" min="1" step="1" value="${MEN.minimo}" inputmode="numeric" autocomplete="off"></label>
          <div class="tseg" role="group" aria-label="Zoom">
            <button type="button" id="menZmas" aria-label="Acercar">+</button>
            <button type="button" id="menZmenos" aria-label="Alejar">−</button>
            <button type="button" id="menEncuadre">Encuadrar</button>
          </div>
        </div>
      </div>
      <div class="men-marco">
        <svg id="menRed" viewBox="0 0 1000 720" role="img" aria-label="Red de menciones: personas unidas por las menciones entre ellas, agrupadas por partido o por foco"></svg>
        <div class="men-tip" id="menTip" hidden></div>
        <div class="men-info" id="menInfo" aria-live="polite"></div>
      </div>
      <div class="men-leyenda" id="menLeyenda"></div>
    </section>

    <section aria-label="Más mencionados">
      <div class="men-dos">
        <div>
          <h3>Más mencionados</h3>
          <p class="men-sub">Por el número de oradores distintos que los mencionan. Pulse una persona para leer sus menciones.</p>
          <div class="men-envoltura"><table class="men-tabla" id="menPersonas"></table></div>
        </div>
        <aside class="men-panel" id="menPanel" aria-live="polite"></aside>
      </div>
    </section>

    <section class="men-dos" aria-label="Quién menciona y diálogos">
      <div>
        <h3>Quién menciona</h3>
        <p class="men-sub">Oradores ordenados por el número de personas distintas que mencionan.</p>
        <div class="men-envoltura"><table class="men-tabla" id="menMencionan"></table></div>
      </div>
      <div style="display:grid;gap:18px">
        <div>
          <h3>Diálogos</h3>
          <p class="men-sub">Pares de miembros que se mencionan en los dos sentidos (de A a B · de B a A).</p>
          <ul class="men-lista" id="menDialogos"></ul>
        </div>
        <div>
          <h3>Co-menciones</h3>
          <p class="men-sub">Personas mencionadas en la misma intervención.</p>
          <ul class="men-lista" id="menComenciones"></ul>
        </div>
      </div>
    </section>

    <section aria-label="Menciones entre partidos">
      <h3>Entre partidos</h3>
      <p class="men-sub">Menciones a miembros de la Cámara <b>por cada 10.000 palabras</b> del partido que habla, sin contar sus
        turnos de Mesa: así un partido que ocupa más tiempo no encabeza todas las filas. Filas: partido de quien habla; columnas:
        partido del mencionado. El tono es la parte de las menciones de la fila y el recuadro marca el propio partido; pase por
        encima de una casilla para ver las menciones, la tasa y las veces que pasa la media del cuadro.</p>
      <div class="men-envoltura"><table class="men-tabla men-matriz" id="menMatriz"></table></div>
    </section>

    <section aria-label="Personas externas por partido">
      <h3>Personas externas según el partido de quien habla</h3>
      <p class="men-sub">Menciones a las seis personas externas más citadas, también por cada 10.000 palabras del partido que habla.
        Muestra quién habla de quién, no si lo hace a favor o en contra.</p>
      <div class="men-envoltura"><table class="men-tabla men-matriz" id="menExternas"></table></div>
    </section>

    <section aria-label="Focos de conversación">
      <h3>Focos de conversación</h3>
      <p class="men-sub">Comunidades de Leiden en la red de menciones. Reúnen a quienes hablan de las mismas personas y a esas
        personas; <b>no son coaliciones</b>: un foco puede juntar a quienes defienden y a quienes atacan a alguien.</p>
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
  t.innerHTML = `<thead><tr><th>Persona</th><th class="num">Oradores</th><th class="num">Menciones</th><th>Cómo</th>
      <th>Quién le menciona</th><th>Foco</th></tr></thead><tbody>`
    + filas.map((p) => {
      const como = p.ext ? '<span class="men-pp">—</span>' : `<span class="men-pp">se dirige ${menPct(p.voc, p.voc + p.ref)} %</span>`;
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
  caja.innerHTML = `<h3>Menciones de ${esc(p.n)}</h3>
    <p class="men-meta">${p.p ? esc(p.p) + ' · ' : 'Persona externa · '}${nf(p.oradores)} oradores · ${nf(p.menciones)} menciones${p.foco ? ` · foco F${p.foco}` : ''}</p>
    <ul class="men-citas">${p.contextos.map((c) => `<li>
      <div class="men-de"><b>${esc(c.o)}</b><span>${esc(c.op || '')}</span><span>${esc(c.f ? fechaCorta(c.f) : '')}</span><span class="men-tipo">${esc(c.t)}</span></div>
      <p data-menopen="${c.id}" role="button" tabindex="0" title="Abrir la intervención en el lector">…${esc(c.x[0])}<mark>${esc(c.x[1])}</mark>${esc(c.x[2])}…</p></li>`).join('')}</ul>`;
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
  menEl('menMencionan').innerHTML = '<thead><tr><th>Orador</th><th class="num">Personas</th><th class="num">Menciones</th></tr></thead><tbody>'
    + D.mencionan.map((m) => `<tr><td><span class="men-quien">${esc(m.n)}</span>${menChip(m.p)}</td>
      <td class="num"><span class="men-barrita" style="width:${Math.max(3, Math.round(60 * m.personas / maxP))}px"></span>${nf(m.personas)}</td>
      <td class="num">${nf(m.menciones)}</td></tr>`).join('') + '</tbody>';

  menEl('menDialogos').innerHTML = D.dialogos.length
    ? D.dialogos.map((d) => `<li><span>${esc(d.a)} <span class="men-pp">${esc(d.ap || '')}</span> ⇄ ${esc(d.b)} <span class="men-pp">${esc(d.bp || '')}</span></span>
        <span class="num">${nf(d.ab)} · ${nf(d.ba)}</span></li>`).join('')
    : '<li><span class="men-pp">Ningún par se menciona en los dos sentidos.</span></li>';
  menEl('menComenciones').innerHTML = D.comenciones.length
    ? D.comenciones.map((c) => `<li><span>${esc(c.a)} + ${esc(c.b)}</span><span class="num">${nf(c.n)} intervenciones</span></li>`).join('')
    : '<li><span class="men-pp">Ninguna intervención menciona a dos personas.</span></li>';

  // Matrices en frecuencia relativa: menciones por cada diez mil palabras del partido que habla (sin sus turnos de
  // Mesa), para que el partido que más tiempo ocupa no encabece todas las filas. El tono sigue siendo la parte de la
  // fila y el detalle de cada casilla, con la cifra bruta y la media del cuadro, va en su título.
  const tono = (x) => `background:rgba(var(--men-heat),${(0.05 + 0.55 * (x || 0)).toFixed(3)})`;
  const POR = 10000;
  const tasa = (n, pal) => (pal > 0 ? POR * n / pal : null);
  const numTasa = (t) => (t == null ? '·' : t === 0 ? '0' : t.toFixed(t < 10 ? 1 : 0).replace('.', ','));
  const veces = (t, media) => (t == null || !media ? '' : ` · ${(t / media).toFixed(1).replace('.', ',')} veces la media del cuadro`);

  const M = D.matriz;
  const colM = M.partidos.map((_, j) => M.filas.reduce((s, f) => s + (f.celdas[j] || 0), 0));
  const palM = M.filas.reduce((s, f) => s + (f.palabras || 0), 0);
  menEl('menMatriz').innerHTML = `<thead><tr><th>De \\ a</th>${M.partidos.map((p) => `<th class="num">${esc(p)}</th>`).join('')}
      <th class="num">Propio</th><th class="num">Todas</th></tr></thead><tbody>`
    + M.filas.map((f, i) => `<tr><th class="men-fil" scope="row" data-tip="${esc(`<b>${esc(f.p)}</b>: ${nf(f.total)} menciones a miembros en ${nf(f.palabras)} palabras`)}">${esc(f.p)}</th>`
      + f.celdas.map((n, j) => {
        const t = tasa(n, f.palabras), media = tasa(colM[j], palM);
        const tit = `<b>${esc(f.p)} → ${esc(M.partidos[j])}</b>: ${nf(n)} ${n === 1 ? 'mención' : 'menciones'}`
          + (t == null ? '' : ` · ${numTasa(t)} por cada ${nf(POR)} palabras de ${esc(f.p)}${media ? ` (media del cuadro ${numTasa(media)})` : ''}${veces(t, media)}`);
        return `<td class="men-celda${i === j ? ' men-diag' : ''}" style="${tono(n / Math.max(1, f.total))}" data-tip="${esc(tit)}">${numTasa(t)}</td>`;
      }).join('')
      + `<td class="num" data-tip="${esc(`<b>${esc(f.p)}</b>: ${nf(f.celdas[i] || 0)} de sus ${nf(f.total)} menciones van a su propio partido`)}">${menPct(f.celdas[i] || 0, f.total)} %</td>`
      + `<td class="num" data-tip="${esc(`<b>${esc(f.p)}</b>: ${nf(f.total)} menciones a miembros en ${nf(f.palabras)} palabras`)}">${numTasa(tasa(f.total, f.palabras))}</td></tr>`).join('') + '</tbody>';

  const X = D.externas;
  const colX = X.personas.map((_, j) => X.filas.reduce((s, f) => s + (f.celdas[j] || 0), 0));
  const palX = X.filas.reduce((s, f) => s + (f.palabras || 0), 0);
  menEl('menExternas').innerHTML = `<thead><tr><th>Partido</th>${X.personas.map((p) => `<th class="num">${esc(p)}</th>`).join('')}</tr></thead><tbody>`
    + X.filas.map((f) => {
      const suma = f.celdas.reduce((a, b) => a + b, 0);
      return `<tr><th class="men-fil" scope="row" data-tip="${esc(`<b>${esc(f.p)}</b>: ${nf(f.palabras)} palabras en la biblioteca`)}">${esc(f.p)}</th>`
        + f.celdas.map((n, j) => {
          const t = tasa(n, f.palabras), media = tasa(colX[j], palX);
          const tit = `<b>${esc(f.p)} → ${esc(X.personas[j])}</b>: ${nf(n)} ${n === 1 ? 'mención' : 'menciones'}`
            + (t == null ? '' : ` · ${numTasa(t)} por cada ${nf(POR)} palabras de ${esc(f.p)}${media ? ` (media del cuadro ${numTasa(media)})` : ''}${veces(t, media)}`);
          return `<td class="men-celda" style="${tono(n / Math.max(1, suma))}" data-tip="${esc(tit)}">${numTasa(t)}</td>`;
        }).join('') + '</tr>';
    }).join('') + '</tbody>';

  menFichaTabla(menEl('menMatriz'));
  menFichaTabla(menEl('menExternas'));

  menEl('menFocos').innerHTML = D.focos.map((f) => `<article class="men-foco" style="--c:${f.id <= 8 ? `var(--men-f${f.id})` : 'var(--text-faint)'}">
      <h4>F${f.id} · ${f.centrales.slice(0, 3).map((c) => esc(c.n)).join(' · ')}</h4>
      <div class="men-meta">${nf(f.personas)} personas · ${nf(f.diputados)} miembros · ${nf(f.externas)} externas</div>
      <div class="men-comp">${f.partidos.map(([p, n]) => `${esc(p)} ${n} %`).join(' · ')}</div>
      <div class="men-nombres">${f.centrales.map((c) => `<span class="${c.p ? '' : 'ext'}" title="${c.p ? esc(c.p) : 'persona externa'}">${esc(c.n)}</span>`).join('')}</div>
    </article>`).join('');
}

/* ---------------------------------------------------------------- exportar */

function menMeta(D) {
  const L = S.libInfo, R = D.resumen, T = R.deteccion || {};
  return [
    'Explorador de Diarios de Sesiones · menciones a personas en las intervenciones de una biblioteca',
    `biblioteca: ${L?.name || ''} (${nf(R.intervenciones)} intervenciones; ${nf(R.contexto)} más leídas como contexto)`,
    `corpus: ${S.info?.title || S.info?.name || ''}`,
    `generado: ${new Date().toISOString().slice(0, 19)}`,
    `menciones: ${R.menciones} en ${R.con_menciones} intervenciones · ${R.mencionadas} personas mencionadas (${R.externas} externas) · ${R.oradores} oradores`,
    `identificación: ${T.resueltas} menciones a miembros resueltas, ${T.ambiguas} ambiguas y ${T.sin_resolver} sin resolver;`
      + ` excluidas las de la Mesa (${T.mesa}), el protocolo a la Presidencia (${T.protocolo}), el procedimiento (${T.procedimiento}) y las automenciones (${T.propias})`,
    `focos: Leiden sobre la red sin dirección, resolución ${D.opciones?.resolucion}, semilla ${D.opciones?.semilla}`
      + ` · modularidad ${R.modularidad} · ${R.focos} focos · información mutua normalizada con los partidos ${R.nmi}`,
  ];
}

function menExportCSV() {
  const D = MEN.data;
  if (!D || !(D.detalle || []).length) return toast('Aún no hay menciones que exportar.', true);
  const cols = ['id', 'fecha', 'orador', 'partido_orador', 'mencionado', 'partido_mencionado', 'externa', 'como', 'texto'];
  const filas = D.detalle.map((m) => [m.id, m.f, m.o, m.op, m.n, m.p, m.e, m.t, m.x]);
  downloadText(csvConFuente(menMeta(D), cols, filas), `menciones_${menSlug()}.csv`, 'text/csv;charset=utf-8');
}

function menExportGEXF() {
  const D = MEN.data;
  if (!D || !(D.red?.nodos || []).length) return toast('Aún no hay red que exportar.', true);
  const x = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const F = fuenteDe();
  const desc = menMeta(D).concat([`Fuente: ${F.cita || F.cita_corta || ''}${F.url ? ` · ${F.url}` : ''}`]).join('\n');
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

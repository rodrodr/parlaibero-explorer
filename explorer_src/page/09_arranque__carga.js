



































(function (R2) {
  'use strict';

  const P = () => R2.progreso;
  const ENTRADA_CONSTRUIR = __('La base se construye en este navegador a partir del CSV y, si lo permite, se guarda para abrirla sola la próxima vez. No cierre ni recargue la pestaña hasta que termine.');
  const URL_PARLAIBERO = 'https://dataverse.harvard.edu/dataverse/parlaibero';
  const ENTRADA_ABRIR = __('Elija el archivo de intervenciones de un país de ParlaIbero (por ejemplo ES_interventions.csv, descargado de Harvard Dataverse). La base de datos se construye en su navegador; nada sale de su equipo.');

  const PLANTILLA = `
<header class="r2c-cab">
  <div class="r2c-marca"><h1 class="r2c-titulo">ParlaIbero</h1><span class="r2c-insignia">${__('Explorador de diarios de sesiones')}</span><span class="r2c-sub" data-r2="sub"></span></div>
  <span class="r2c-crece"></span>
  <span class="r2c-lenguas" role="group" aria-label="Lengua · Language" data-r2="lenguas">${__.LENGUAS.map((l) =>
    `<button type="button" class="btn ghost sm" data-lengua="${l.codigo}" lang="${l.codigo}" title="${l.nombre}" aria-pressed="${l.codigo === __.lengua}">${l.codigo.toUpperCase()}</button>`).join('')}</span>
  <button type="button" class="btn ghost sm" data-r2="creditos" data-abrir-creditos hidden>${__('Créditos y licencias')}</button>
  <button type="button" class="btn ghost icon" data-r2="ajustes" title="${__('Ajustes: estilo y tema')}" aria-label="${__('Ajustes: estilo y tema')}">⚙</button>
  <button type="button" class="btn ghost icon" data-r2="tema" title="${__('Claro / oscuro')}" aria-label="${__('Cambiar entre tema claro y oscuro')}">◐</button>
</header>
<main class="r2c-cuerpo">
  <p class="r2c-nota r2c-aviso" data-r2="aviso" role="status" hidden></p>
  <input type="file" accept=".csv,text/csv" data-r2="archivo" class="r2c-oculto" tabindex="-1" aria-hidden="true">
  <section class="r2c-tarjeta" data-r2="abrir" aria-labelledby="r2c-abrir-t">
    <p class="r2c-antetitulo">Parliamentary Speeches from Latin America, Portugal and Spain · Instituto de Iberoamérica, Universidad de Salamanca</p>
    <h2 class="r2c-h" id="r2c-abrir-t" tabindex="-1">${__('Abra el CSV de un país')}</h2>
    <p class="r2c-entrada" data-r2="abrir-entrada">${ENTRADA_ABRIR}</p>
    <p class="r2c-nota" data-r2="nota" role="status" hidden></p>
    <div class="r2c-soltar" data-r2="soltar">
      <p class="r2c-soltar-t">${__('<b>Arrastre aquí el CSV de intervenciones</b> (p. ej. {0})', '<span class="r2c-mono">ES_interventions.csv</span>')}</p>
      <p class="r2c-soltar-f" data-r2="ficha">${__('o elija el archivo · separador «,» · codificación UTF-8')}</p>
      <div class="r2c-botones">
        <button type="button" class="btn primary" data-r2="elegir">${__('Elegir archivo…')}</button>
        <button type="button" class="btn" data-r2="reintentar" hidden>${__('Reintentar')}</button>
        <a class="btn" data-r2="dataverse" href="${URL_PARLAIBERO}" target="_blank" rel="noopener noreferrer">${__('Conjuntos de datos en Dataverse')} <span aria-hidden="true">↗</span><span class="r2c-oculto"> ${__('(se abre en otra pestaña)')}</span></a>
      </div>
    </div>
    <p class="r2c-motor" data-r2="motor" aria-live="polite"></p>
    <div class="r2c-cita" data-r2="cita" hidden>${__('<b>Fuente (cite siempre):</b>')} <span data-r2="cita-texto"></span></div>
    <ul class="r2c-privacidad">
      <li><span aria-hidden="true">🔒</span><span>${__('El CSV se lee localmente; no se sube a ningún servidor.')}</span></li>
      <li data-r2="almacen"><span aria-hidden="true">📚</span><span data-r2="almacen-t">${__('Comprobando si este navegador puede guardar sus bibliotecas…')}</span></li>
      <li data-r2="memoria-aviso" hidden><span aria-hidden="true">⚠</span><span data-r2="memoria-aviso-t"></span></li>
    </ul>
  </section>

  <section class="r2c-tarjeta" data-r2="construir" aria-labelledby="r2c-constr-t" hidden>
    <p class="r2c-antetitulo" data-r2="constr-ficha"></p>
    <h2 class="r2c-h" id="r2c-constr-t" tabindex="-1">${__('Preparando el corpus…')}</h2>
    <p class="r2c-entrada" data-r2="constr-entrada"></p>
    <ol class="r2c-fases" data-r2="fases" aria-label="${__('Fases de la construcción')}"></ol>
    <div class="r2c-total">
      <div class="r2c-barra" data-r2="total" role="progressbar" aria-label="${__('Progreso total')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <div class="r2c-total-t"><span data-r2="pct">0&nbsp;%</span><span data-r2="eta">${__('Calculando el tiempo restante…')}</span></div>
    </div>
    <p class="r2c-oculto" data-r2="anuncio" aria-live="polite"></p>
    <div class="r2c-pie"><span data-r2="memoria"></span><span data-r2="motor-v">${__('Motor: {0}', 'SQLite (WebAssembly) · FTS5')}</span></div>
    <div class="r2c-cancelar">
      <p class="r2c-nota-cancelar" id="r2c-nota-cancelar" data-r2="nota-cancelar" hidden></p>
      <button type="button" class="btn" data-r2="cancelar">${__('Cancelar')}</button>
    </div>
  </section>

  <section class="r2c-espera" data-r2="espera" aria-labelledby="r2c-esp-t" hidden>
    <h2 class="r2c-esp-h" id="r2c-esp-t" tabindex="-1" data-r2="esp-titulo">${__('Preparando el corpus…')}</h2>
    <div class="r2c-barra indet" data-r2="esp-barra" role="progressbar" aria-label="${__('Preparando el corpus')}" aria-valuemin="0" aria-valuemax="100"><i></i></div>
    <p class="r2c-esp-nota" data-r2="esp-nota"></p>
    <p class="r2c-oculto" data-r2="esp-anuncio" aria-live="polite"></p>
  </section>

  <section class="r2c-tarjeta" data-r2="recordado" aria-labelledby="r2c-rec-t" hidden>
    <p class="r2c-antetitulo" data-r2="rec-ficha"></p>
    <h2 class="r2c-h" id="r2c-rec-t" tabindex="-1" data-r2="rec-titulo">${__('Abriendo la base recordada…')}</h2>
    <p class="r2c-entrada" data-r2="rec-entrada">${__('Esta base se guardó en este navegador: se abre sin volver a elegir el CSV.')}</p>
    <div class="r2c-total">
      <div class="r2c-barra" data-r2="rec-barra" role="progressbar" aria-label="${__('Progreso de la apertura de la base recordada')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <div class="r2c-total-t"><span data-r2="rec-pct">0&nbsp;%</span><span data-r2="rec-estado">${__('Leyendo la base guardada…')}</span></div>
    </div>
    <p class="r2c-oculto" data-r2="rec-anuncio" aria-live="polite"></p>
    <div class="r2c-cancelar">
      <button type="button" class="btn" data-r2="rec-cancelar">${__('Cancelar y elegir otro CSV')}</button>
    </div>
  </section>

  <section class="r2c-tarjeta" data-r2="fallo" aria-labelledby="r2c-fallo-t" hidden>
    <p class="r2c-antetitulo" data-r2="fallo-ficha"></p>
    <h2 class="r2c-h" id="r2c-fallo-t" tabindex="-1" data-r2="fallo-titulo">${__('No se pudo construir el corpus')}</h2>
    <div class="r2c-error" role="alert" data-r2="fallo-caja">
      <p data-r2="fallo-mensaje"></p>
      <dl><dt>${__('Código')}</dt><dd><code data-r2="fallo-codigo"></code></dd><dt data-r2="fallo-donde-t">${__('Ubicación')}</dt><dd data-r2="fallo-donde"></dd></dl>
    </div>
    <div class="r2c-ayuda" data-r2="fallo-ayuda" hidden>
      <p>${__('Abra este mismo archivo en Chrome, Edge, Firefox o Safari (en una versión reciente): arrástrelo a una de sus ventanas o pegue esta dirección en su barra.')}</p>
      <code data-r2="fallo-direccion"></code>
    </div>
    <div class="r2c-botones">
      <button type="button" class="btn primary" data-r2="otro">${__('Elegir otro archivo')}</button>
      <button type="button" class="btn" data-r2="fallo-reintentar">${__('Reintentar')}</button>
      <button type="button" class="btn" data-r2="recargar">${__('Recargar la página')}</button>
      <button type="button" class="btn" data-r2="copiar" hidden>${__('Copiar la dirección')}</button>
      <a class="btn" data-r2="fallo-dataverse" href="${URL_PARLAIBERO}" target="_blank" rel="noopener noreferrer">${__('Conjuntos de datos en Dataverse')} <span aria-hidden="true">↗</span><span class="r2c-oculto"> ${__('(se abre en otra pestaña)')}</span></a>
    </div>
  </section>

  <section class="r2c-tarjeta" data-r2="confirmar" aria-labelledby="r2c-conf-t" hidden>
    <p class="r2c-antetitulo" data-r2="conf-ficha"></p>
    <h2 class="r2c-h" id="r2c-conf-t" tabindex="-1">${__('Este archivo tiene avisos')}</h2>
    <ul class="r2c-avisos" data-r2="conf-avisos" role="alert"></ul>
    <p class="r2c-entrada">${__('Puede explorarlo igualmente, pero los resultados no coincidirán con los del conjunto de datos citado.')}</p>
    <div class="r2c-botones">
      <button type="button" class="btn primary" data-r2="continuar">${__('Continuar con este archivo')}</button>
      <button type="button" class="btn" data-r2="conf-otro">${__('Elegir otro archivo')}</button>
    </div>
  </section>
</main>`;

  const SECCIONES = ['espera', 'abrir', 'construir', 'recordado', 'fallo', 'confirmar'];
  const TITULOS_FALLO = {
    NAVEGADOR: __('Este navegador no es compatible'),
    RECURSO_DANADO: __('No se pudo preparar la página'),
    WORKER_NO_ARRANCA: __('No se pudo preparar la página'),
    WASM_NO_ARRANCA: __('No se pudo preparar la página'),
    WORKER_DETENIDO: __('El motor se ha detenido'),
  };
  const ICONOS = { hecha: '✓', activa: '●', espera: '○' };
  const ESTADO_SR = { hecha: __('terminada'), activa: __('en curso'), espera: __('pendiente') };

  function crear(opciones) {
    const doc = opciones.documento;
    const h = opciones.manejadores || {};
    const llamar = (nombre, ...a) => { if (typeof h[nombre] === 'function') h[nombre](...a); };

    const raiz = doc.createElement('div');
    raiz.id = 'r2-carga';
    raiz.className = 'r2c';
    raiz.innerHTML = PLANTILLA;
    doc.body.appendChild(raiz);
    const $ = (k) => raiz.querySelector(`[data-r2="${k}"]`);



    const conDatos = !!(R2.arranque && typeof R2.arranque.datosPropios === 'function' && R2.arranque.datosPropios());
    const entradaPorDefecto = conDatos
      ? __('El corpus viaja con esta aplicación y se abre solo; nada sale de su equipo. Si quiere explorar otro CSV, puede elegirlo aquí.')
      : ENTRADA_ABRIR;
    if (conDatos) {
      raiz.querySelector('#r2c-abrir-t').textContent = __('Abrir otro conjunto de datos');
      $('abrir-entrada').textContent = entradaPorDefecto;
      raiz.querySelector('.r2c-soltar-t').innerHTML = __('Arrastre aquí otro CSV de intervenciones');
      raiz.querySelector('.r2c-privacidad li:first-child span:last-child').textContent = __('Todo se procesa en su navegador; nada se sube a ningún servidor.');
    }

    const v = { seccion: null, raiz };


    let indiceAnunciado = 0;
    let pctAnunciado = -1;
    const escuchas = [];
    const escuchar = (el, tipo, fn, op) => { el.addEventListener(tipo, fn, op); escuchas.push([el, tipo, fn, op]); };


    function mostrar(seccion) {
      for (const s of SECCIONES) $(s).hidden = s !== seccion;
      $('aviso').hidden = true;
      v.seccion = seccion;
      raiz.dataset.seccion = seccion;
    }

    function enfocar(el) {
      if (!el || el.hidden) return;
      try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); }
    }

    function ficha(archivo) {
      return archivo ? `${archivo.name || __('archivo sin nombre')} · ${P().tamano(archivo.size)}` : '';
    }


    function textoConCodigo(el, texto) {
      el.textContent = '';
      const partes = String(texto).split(/(https?:\/\/\S+?)(?=[,;)\s]|$)/);
      for (const p of partes) {
        if (!p) continue;
        if (/^https?:\/\//.test(p)) {
          const c = doc.createElement('code');
          c.textContent = p;
          el.appendChild(c);
        } else el.appendChild(doc.createTextNode(p));
      }
    }


    const entrada = $('archivo');
    escuchar($('elegir'), 'click', () => v.abrirSelector());
    escuchar(entrada, 'change', () => {
      const f = entrada.files && entrada.files[0];
      entrada.value = '';
      if (f) llamar('alElegir', f);
    });
    escuchar($('ajustes'), 'click', () => { if (R2.ajustes) R2.ajustes.abrir(); });
    escuchar($('lenguas'), 'click', (ev) => {
      const b = ev.target && ev.target.closest ? ev.target.closest('[data-lengua]') : null;
      if (b && R2.ajustes) R2.ajustes.cambiarLengua(b.dataset.lengua);
    });
    escuchar($('reintentar'), 'click', () => llamar('alReintentar'));
    escuchar($('fallo-reintentar'), 'click', () => llamar('alReintentar'));
    escuchar($('cancelar'), 'click', () => llamar('alCancelar'));
    escuchar($('rec-cancelar'), 'click', () => llamar('alCancelarRecordado'));
    escuchar($('otro'), 'click', () => llamar('alOtro'));
    escuchar($('conf-otro'), 'click', () => llamar('alOtro'));
    escuchar($('continuar'), 'click', () => llamar('alContinuar'));
    escuchar($('recargar'), 'click', () => llamar('alRecargar'));
    escuchar($('tema'), 'click', () => llamar('alTema'));
    escuchar($('copiar'), 'click', () => {
      const w = doc.defaultView || {};
      const b = $('copiar');
      const texto = $('fallo-direccion').textContent;
      Promise.resolve().then(() => w.navigator.clipboard.writeText(texto))
        .then(() => { b.textContent = __('Dirección copiada'); }, () => { b.textContent = __('No se pudo copiar: selecciónela y cópiela'); });
    });

    const creditos = doc.getElementById('dlgCreditos');
    if (creditos && typeof creditos.showModal === 'function') {
      $('creditos').hidden = false;
      if (!(R2.cargas)) escuchar($('creditos'), 'click', () => { if (!creditos.open) creditos.showModal(); });
    }

    escuchar($('soltar'), 'click', (e) => { if (!e.target.closest('button, a, input')) v.abrirSelector(); });



    const conArchivos = (e) => !!e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0;
    const aceptaSoltar = () => v.seccion === 'abrir' || v.seccion === 'fallo' || v.seccion === 'confirmar';
    let profundidad = 0;
    escuchar(doc, 'dragenter', (e) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      profundidad++;
      if (aceptaSoltar()) raiz.classList.add('r2c-arrastrando');
    });
    escuchar(doc, 'dragover', (e) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = aceptaSoltar() ? 'copy' : 'none';
    });
    escuchar(doc, 'dragleave', (e) => {
      if (!conArchivos(e)) return;
      profundidad = Math.max(0, profundidad - 1);
      if (profundidad === 0) raiz.classList.remove('r2c-arrastrando');
    });
    escuchar(doc, 'drop', (e) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      profundidad = 0;
      raiz.classList.remove('r2c-arrastrando');
      if (!aceptaSoltar()) return;
      const dt = e.dataTransfer;
      const archivos = dt.files ? Array.prototype.slice.call(dt.files) : [];
      const elementos = dt.items ? Array.prototype.filter.call(dt.items, (it) => it.kind === 'file') : [];
      const n = Math.max(archivos.length, elementos.length);

      if (n > 1) {
        v.avisoSoltar(__('Ha soltado {0} archivos. Suelte solo un CSV de intervenciones o elíjalo con «Elegir archivo…».', n));
        return;
      }

      const carpeta = elementos.some((it) => {
        try {
          const entrada = typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null;
          return !!entrada && entrada.isDirectory === true;
        } catch (err) { return false; }
      });
      if (carpeta) {
        v.avisoSoltar(__('Ha soltado una carpeta. Suelte el archivo CSV de intervenciones que contiene o elíjalo con «Elegir archivo…».'));
        return;
      }
      if (archivos[0]) llamar('alElegir', archivos[0]);
    });




    v.abrirSelector = () => { entrada.click(); };

    v.mostrarAbrir = (o = {}) => {
      mostrar('abrir');
      $('sub').textContent = __('Sin corpus cargado');
      if (o.entrada !== undefined) $('abrir-entrada').textContent = o.entrada || entradaPorDefecto;
      const nota = $('nota');
      nota.textContent = o.nota || '';
      nota.hidden = !o.nota;
      const re = $('reintentar');
      re.hidden = !o.reintentar;
      re.textContent = o.reintentar ? (o.reintentar.name ? __('Reintentar con {0}', o.reintentar.name) : __('Reintentar con el mismo archivo')) : __('Reintentar');
      if (o.enfocar === 'reintentar' && o.reintentar) enfocar(re);
      else if (o.enfocar !== null) enfocar($('elegir'));
    };

    v.avisoSoltar = (texto) => {
      const a = $('aviso');
      a.textContent = '';
      a.textContent = texto || '';
      a.hidden = !texto;
    };

    v.estadoMotor = (texto) => {
      const el = $('motor');
      if (el.textContent !== (texto || '')) el.textContent = texto || '';
    };

    v.ponerMotor = (version) => {
      $('motor-v').textContent = __('Motor: {0}', `SQLite${version ? ` ${version}` : ''} (WebAssembly) · FTS5`);
    };

    v.mostrarConstruir = (o = {}) => {
      mostrar('construir');
      indiceAnunciado = 0;
      pctAnunciado = -1;
      const f = ficha(o.archivo);
      $('constr-ficha').textContent = f;
      $('sub').textContent = f;
      const mem = P().memoriaEstimada(o.archivo ? o.archivo.size : 0);
      $('memoria').textContent = __('Memoria necesaria: unos {0}–{1} MB', P().miles(mem.min), P().miles(mem.max));
      if (o.sqlite) v.ponerMotor(o.sqlite);
      const ol = $('fases');
      ol.textContent = '';
      P().FASES.forEach((fase, i) => {
        const li = doc.createElement('li');
        li.className = 'r2c-fase';
        li.dataset.fase = fase.id;
        li.dataset.estado = 'espera';
        li.innerHTML = '<span class="r2c-icono" aria-hidden="true">○</span><span class="r2c-et"><span class="r2c-et-t"></span><span class="r2c-oculto r2c-et-sr"></span><span class="r2c-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></span></span><span class="r2c-n">—</span>';
        li.querySelector('.r2c-et-t').textContent = __(fase.etiqueta);
        li.querySelector('.r2c-et-sr').textContent = ` (${ESTADO_SR.espera})`;
        li.querySelector('.r2c-barra').setAttribute('aria-label', __('{0}, fase {1} de {2}', __(fase.etiqueta), i + 1, P().FASES.length));
        ol.appendChild(li);
      });
      const total = $('total');
      total.querySelector('i').style.width = '0%';
      total.setAttribute('aria-valuenow', '0');
      $('pct').textContent = P().porcentaje(0);
      $('eta').textContent = P().textoEta(null);
      $('nota-cancelar').hidden = true;
      $('cancelar').removeAttribute('aria-describedby');
      $('cancelar').textContent = o.textoCancelar || __('Cancelar');
      $('constr-entrada').textContent = o.entrada || ENTRADA_CONSTRUIR;
      $('anuncio').textContent = '';
      enfocar(raiz.querySelector('#r2c-constr-t'));
    };


    v.notaConstruir = (texto) => {
      if (v.seccion !== 'construir') return;
      $('eta').textContent = texto || '';
      $('anuncio').textContent = texto || '';
    };





    v.mostrarRecordado = (o = {}) => {
      mostrar('recordado');
      $('sub').textContent = o.ficha || __('Base recordada');
      $('rec-ficha').textContent = o.ficha || '';
      $('rec-titulo').textContent = o.titulo || __('Abriendo la base recordada…');
      $('rec-entrada').textContent = o.entrada || (conDatos
        ? __('Esta base se guardó en este navegador: se abre sin descargarla ni prepararla de nuevo.')
        : __('Esta base se guardó en este navegador: se abre sin volver a elegir el CSV.'));
      $('rec-cancelar').textContent = o.textoCancelar || __('Cancelar y elegir otro CSV');
      $('rec-cancelar').hidden = o.cancelar === false;
      const barra = $('rec-barra');
      barra.querySelector('i').style.width = '0%';
      barra.setAttribute('aria-valuenow', '0');
      barra.removeAttribute('aria-valuetext');
      $('rec-pct').textContent = P().porcentaje(0);
      $('rec-estado').textContent = __('Leyendo la base guardada…');
      $('rec-anuncio').textContent = '';
      recAnunciado = -1;
      enfocar(raiz.querySelector('#r2c-rec-t'));
    };

    let recAnunciado = -1;
    v.progresoRecordado = (hecho, total, texto) => {
      if (v.seccion !== 'recordado') return;
      const f = total > 0 ? Math.max(0, Math.min(1, hecho / total)) : 0;
      const barra = $('rec-barra');
      barra.querySelector('i').style.width = `${(f * 100).toFixed(1)}%`;
      barra.setAttribute('aria-valuenow', String(Math.floor(f * 100)));
      const t = texto || (total > 0 ? __('{0} de {1}', P().tamano(hecho), P().tamano(total)) : __('Leyendo la base guardada…'));
      barra.setAttribute('aria-valuetext', `${P().porcentaje(f)} · ${t}`);
      $('rec-pct').textContent = P().porcentaje(f);
      $('rec-estado').textContent = t;

      if (Math.floor(f * 2) > recAnunciado && f < 1) {
        recAnunciado = Math.floor(f * 2);
        $('rec-anuncio').textContent = __('{0} de la base recordada leído.', P().porcentaje(f));
      }
    };






    v.mostrarEspera = (o = {}) => {
      mostrar('espera');
      $('sub').textContent = o.ficha || '';
      $('esp-titulo').textContent = o.titulo || __('Preparando el corpus…');
      $('esp-nota').textContent = o.nota || '';
      const barra = $('esp-barra');
      barra.classList.add('indet');
      barra.querySelector('i').style.width = '';
      barra.removeAttribute('aria-valuenow');
      barra.removeAttribute('aria-valuetext');
      $('esp-anuncio').textContent = '';
      espAnunciado = -1;
      enfocar(raiz.querySelector('#r2c-esp-t'));
    };

    let espAnunciado = -1;

    v.progresoEspera = (fraccion, nota) => {
      if (v.seccion !== 'espera') return;
      const barra = $('esp-barra');
      if (fraccion == null) {
        barra.classList.add('indet');
        barra.querySelector('i').style.width = '';
        barra.removeAttribute('aria-valuenow');
      } else {
        const f = Math.max(0, Math.min(1, fraccion));
        barra.classList.remove('indet');
        barra.querySelector('i').style.width = `${(f * 100).toFixed(1)}%`;
        barra.setAttribute('aria-valuenow', String(Math.floor(f * 100)));
        barra.setAttribute('aria-valuetext', `${P().porcentaje(f)}${nota ? ` · ${nota}` : ''}`);

        if (Math.floor(f * 4) > espAnunciado && f < 1) {
          espAnunciado = Math.floor(f * 4);
          $('esp-anuncio').textContent = __('{0} del corpus preparado.', P().porcentaje(f));
        }
      }
      if (nota !== undefined) $('esp-nota').textContent = nota || '';
    };

    v.pintarProgreso = (est) => {
      if (v.seccion === 'espera' && est) {
        v.progresoEspera(est.fraccion, P().textoEta(est.etaMs));
        return;
      }
      if (v.seccion !== 'construir' || !est) return;
      for (const f of est.fases) {
        const li = raiz.querySelector(`.r2c-fase[data-fase="${f.id}"]`);
        if (!li) continue;
        // La etiqueta puede cambiar durante la construcción («Cargando las expresiones ya calculadas»).
        const et = li.querySelector('.r2c-et-t');
        const etq = __(f.etiqueta);
        if (f.etiqueta && et.textContent !== etq) {
          et.textContent = etq;
          li.querySelector('.r2c-barra').setAttribute('aria-label', __('{0}, fase {1} de {2}', etq, f.indice, est.fases.length));
        }
        if (li.dataset.estado !== f.estado) {
          li.dataset.estado = f.estado;
          li.querySelector('.r2c-icono').textContent = ICONOS[f.estado];
          li.querySelector('.r2c-et-sr').textContent = ` (${ESTADO_SR[f.estado]})`;
        }
        const barra = li.querySelector('.r2c-barra');
        const n = li.querySelector('.r2c-n');
        if (f.estado === 'activa') {
          const conTotal = f.total != null && f.total > 0;
          barra.classList.toggle('indet', !conTotal);
          if (conTotal) {
            const pct = Math.floor(f.fraccion * 100);
            barra.querySelector('i').style.width = `${Math.min(100, f.fraccion * 100).toFixed(1)}%`;
            barra.setAttribute('aria-valuenow', String(pct));
            n.textContent = P().porcentaje(f.fraccion);
          } else {
            barra.querySelector('i').style.width = '';
            barra.removeAttribute('aria-valuenow');
            n.textContent = f.hecho ? P().miles(f.hecho) : '…';
          }
        } else if (f.estado === 'hecha') {
          n.textContent = P().duracion(f.duracionMs);
        } else {
          n.textContent = '—';
        }
      }
      const pct = Math.floor(est.fraccion * 100);
      const total = $('total');
      total.querySelector('i').style.width = `${Math.min(100, est.fraccion * 100).toFixed(1)}%`;
      total.setAttribute('aria-valuenow', String(pct));
      const eta = P().textoEta(est.etaMs);
      total.setAttribute('aria-valuetext', `${P().porcentaje(est.fraccion)} · ${eta}`);
      $('pct').textContent = P().porcentaje(est.fraccion);
      $('eta').textContent = eta;


      const activa = est.activa;
      const anuncio = $('anuncio');
      if (activa && activa.indice > indiceAnunciado) {
        indiceAnunciado = activa.indice;
        anuncio.textContent = __('Fase {0} de {1}: {2}.', activa.indice, est.fases.length, __(activa.etiqueta));
      } else if (Math.floor(pct / 25) > Math.floor(pctAnunciado / 25) && pct < 100) {
        anuncio.textContent = __('{0} completado. {1}.', P().porcentaje(est.fraccion), eta);
      }
      if (Math.floor(pct / 25) !== Math.floor(pctAnunciado / 25)) pctAnunciado = pct;

      const nota = $('nota-cancelar');
      if (est.faseLarga && activa) {
        const totalEstimado = est.etaMs != null ? est.transcurridoMs + est.etaMs : null;
        const texto = totalEstimado
          ? __('«{0}» está tardando. Si cancela, se descarta lo construido y habrá que volver a construir el corpus desde el principio (unos {1}).', __(activa.etiqueta), P().duracion(totalEstimado))
          : __('«{0}» está tardando. Si cancela, se descarta lo construido y habrá que volver a construir el corpus desde el principio.', __(activa.etiqueta));
        if (nota.textContent !== texto) nota.textContent = texto;
        if (nota.hidden) {
          nota.hidden = false;
          $('cancelar').setAttribute('aria-describedby', 'r2c-nota-cancelar');
        }
      } else if (!nota.hidden) {
        nota.hidden = true;
        $('cancelar').removeAttribute('aria-describedby');
      }
    };

    v.mostrarFallo = (error, o = {}) => {
      const err = error || {};
      mostrar('fallo');
      const f = ficha(o.archivo);
      $('fallo-ficha').textContent = f;
      $('fallo-ficha').hidden = !f;
      $('fallo-titulo').textContent = o.titulo || TITULOS_FALLO[err.codigo] || __('No se pudo construir el corpus');
      $('sub').textContent = f || __('Sin corpus cargado');
      const donde = R2.rpc ? R2.rpc.ubicacion(err) : '';
      $('fallo-donde').textContent = donde;
      $('fallo-donde').hidden = !donde;
      $('fallo-donde-t').hidden = !donde;
      $('fallo-codigo').textContent = err.codigo || 'ERROR_INTERNO';
      $('fallo-codigo').dataset.codigo = err.codigo || 'ERROR_INTERNO';

      $('fallo-mensaje').textContent = '';
      $('fallo-mensaje').textContent = err.message || err.mensaje || __('Error desconocido.');
      $('otro').hidden = !o.otro;
      $('otro').textContent = o.textoOtro || __('Elegir otro archivo');
      $('fallo-reintentar').hidden = !o.reintentar;
      $('fallo-reintentar').textContent = o.reintentar && o.archivo ? (o.archivo.name ? __('Reintentar con {0}', o.archivo.name) : __('Reintentar con el mismo archivo')) : __('Reintentar');
      $('recargar').hidden = !o.recargar;
      $('fallo-dataverse').hidden = !o.otro;

      const w = doc.defaultView || {};
      let direccion = '';
      if (o.ayudaNavegador && w.location) {
        try { direccion = decodeURI(String(w.location.href)); } catch (e) { direccion = String(w.location.href); }
      }
      $('fallo-ayuda').hidden = !o.ayudaNavegador;
      $('fallo-direccion').textContent = direccion;
      $('fallo-direccion').hidden = !direccion;
      const puedeCopiar = !!direccion && !!w.navigator && !!w.navigator.clipboard && typeof w.navigator.clipboard.writeText === 'function';
      $('copiar').hidden = !puedeCopiar;
      $('copiar').textContent = __('Copiar la dirección');
      enfocar([$('otro'), $('fallo-reintentar'), $('recargar'), $('copiar')].find((b) => !b.hidden) || raiz.querySelector('#r2c-fallo-t'));
    };

    v.mostrarConfirmar = (informe, archivo, o = {}) => {
      mostrar('confirmar');
      $('conf-otro').textContent = o.textoOtro || __('Elegir otro archivo');
      const f = ficha(archivo);
      $('conf-ficha').textContent = f;
      $('sub').textContent = f;
      const ul = $('conf-avisos');
      ul.textContent = '';
      for (const a of (informe && informe.avisos) || []) {
        const li = doc.createElement('li');
        li.dataset.codigo = a.codigo;
        li.textContent = a.mensaje;
        ul.appendChild(li);
      }
      enfocar($('continuar'));
    };

    v.ponerReferencia = (ref) => {
      const r = ref || {};
      const pub = r.publicado;
      if (pub && pub.bytes) {
        $('ficha').textContent = pub.filas
          ? __('o elija el archivo · {0} · {1} filas · separador «,»', P().tamano(pub.bytes), P().miles(pub.filas))
          : __('o elija el archivo · {0} · separador «,»', P().tamano(pub.bytes));
      }
      if (Array.isArray(r.paises) && r.paises.length) {
        $('ficha').textContent = __('o elija el archivo · separador «,» · UTF-8 · países disponibles: {0}', r.paises.join(', '));
      }
      const url = r.fuente && r.fuente.url;
      if (url && /^https:\/\//.test(url)) {
        $('dataverse').href = url;
        $('fallo-dataverse').href = url;
      }
      if (r.fuente && r.fuente.cita) {
        const lic = r.fuente.licencia_nombre || r.fuente.licencia;
        textoConCodigo($('cita-texto'), `${r.fuente.cita}${lic && !String(r.fuente.cita).includes(lic) ? ` · ${lic}` : ''}`);
        $('cita').hidden = false;
      }
    };

    v.ponerAvisos = (a) => {
      if (!a) return;
      if (a.almacen) {
        $('almacen-t').textContent = a.almacen.texto;
        $('almacen').dataset.tipo = a.almacen.tipo;
      }
      $('memoria-aviso').hidden = !a.memoria;
      $('memoria-aviso-t').textContent = a.memoria || '';
    };

    v.destruir = () => {
      for (const [el, tipo, fn, op] of escuchas) el.removeEventListener(tipo, fn, op);
      escuchas.length = 0;
      raiz.remove();
      v.seccion = null;
    };

    return v;
  }

  R2.carga = { crear, URL_PARLAIBERO };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/carga.js

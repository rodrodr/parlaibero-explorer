




















(function (R2) {
  'use strict';

  const ID = 'r2-sobre';
  const EVENTO = 'r2:sobre-corpus';

  const NOTA = () => 'El corpus existe solo en esta pestaña: si la cierra o la recarga, habrá que volver a elegir el CSV (salvo que la base se haya recordado en este navegador).';
  const P = () => R2.progreso;
  let montado = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function modelo(e) {
    const inf = e && e.informe;
    if (!inf) return null;
    const version = null;
    const corr = null;
    const pais = inf.pais_nombre || (inf.pais ? `país ${inf.pais}` : null);
    let estado, textoEstado;
    if (e.huella === 'fallida') {
      estado = 'fallida';
      const causa = e.errorHuella && (e.errorHuella.mensaje || e.errorHuella.message);
      textoEstado = `No se pudo comprobar la huella: ${causa || 'error desconocido'}`;
    } else if (e.huella === 'pendiente') {
      estado = 'pendiente';
      textoEstado = `CSV de ${pais || 'un país'} elegido en este equipo. Comprobando la huella…`;
    } else if (inf.dataset && inf.dataset.titulo) {
      estado = 'publicado';
      textoEstado = `${inf.dataset.titulo}${inf.dataset.version ? ` (${inf.dataset.version})` : ''}, Harvard Dataverse: CSV elegido en este equipo (${P().miles(inf.n_sesiones || 0)} sesiones).`;
    } else {
      estado = 'sin_referencia';
      textoEstado = `CSV de ${pais || 'un país'} elegido en este equipo (${P().miles(inf.n_sesiones || 0)} sesiones).`;
    }
    const h = inf.huella || {};
    const t = inf.tiempos || {};
    return {
      estado,
      textoEstado,
      archivo: `${h.nombre || 'archivo sin nombre'} · ${P().tamano(h.bytes)} (${P().miles(h.bytes)} bytes)`,
      version: version && version.etiqueta ? version.etiqueta : null,

      correcciones: corr && corr.filas_corregidas > 0 && corr.mensaje ? corr.mensaje : null,
      sha256: h.sha256 || null,
      textoSha256: h.sha256 || (e.huella === 'fallida' ? '—' : 'Comprobando la huella…'),
      filas: P().miles(inf.n_filas),
      construccion: `${P().duracion(t.hasta_listo)} en este navegador${inf.detalles && inf.detalles.sqlite ? ` (SQLite ${inf.detalles.sqlite})` : ''}`,
      lectura: e.modoLectura === 'principal'
        ? 'Desde la página: este navegador no deja leer el archivo al proceso de fondo cuando la página se abre como archivo.'
        : null,
      avisos: (inf.avisos || []).map((a) => ({ codigo: a.codigo, mensaje: a.mensaje })),
    };
  }


  function modeloDeInfo(info) {
    const s = info && info.standalone;
    if (!s) return null;
    return modelo({
      informe: { n_filas: s.n_filas, n_sesiones: s.n_sesiones, pais: s.pais, pais_nombre: s.pais_nombre, dataset: s.dataset || null, publicado: s.publicado,
        version_csv: s.version_csv, correcciones_fechas: s.correcciones_fechas,
        avisos: s.avisos, huella: s.archivo, tiempos: s.tiempos, detalles: { sqlite: s.sqlite } },
      huella: s.huella, errorHuella: s.fallo_huella, modoLectura: s.modo_lectura, referencia: s.referencia,
    });
  }

  function datosHtml(m) {
    const fila = (dt, dd, codigo) => `<dt>${esc(dt)}</dt><dd>${codigo ? `<code>${esc(dd)}</code>` : esc(dd)}</dd>`;
    return fila('Archivo', m.archivo) + (m.version ? fila('Versión', m.version) : '')
      + fila('Huella SHA-256', m.textoSha256, !!m.sha256) + fila('Intervenciones', m.filas)
      + (m.correcciones ? fila('Correcciones', m.correcciones) : '')
      + fila('Construido', m.construccion) + (m.lectura ? fila('Lectura', m.lectura) : '');
  }
  const avisosHtml = (m) => m.avisos.map((a) => `<li data-codigo="${esc(a.codigo)}">${esc(a.mensaje)}</li>`).join('');

  function bloqueHtml(m) {
    const web = R2.web && typeof R2.web.htmlSobre === 'function' ? R2.web.htmlSobre() : '';
    return `<div id="${ID}" class="r2s"><div class="fuente-k">Este archivo</div>`
      + `<p class="r2s-estado" data-estado="${esc(m.estado)}" aria-live="polite">${esc(m.textoEstado)}</p>`
      + `<dl class="r2s-datos">${datosHtml(m)}</dl>`
      + `<ul class="r2s-avisos" aria-label="Avisos sobre el archivo"${m.avisos.length ? '' : ' hidden'}>${avisosHtml(m)}</ul>`
      + (web ? web : '')
      + `<p class="dsub r2s-nota"${web ? ' hidden' : ''}>${esc(NOTA())}</p></div>`;
  }

  function html(info) {
    const i = info || {};
    const cuentas = `<p class="dsub r2s-cuentas">${esc(P().miles(i.n_speeches || 0))} intervenciones · ${esc(P().miles(i.n_sessions || 0))} sesiones</p>`;
    const vivo = montado ? modelo(montado.obtener()) : null;
    const m = vivo || modeloDeInfo(i);
    return m ? cuentas + bloqueHtml(m) : cuentas;
  }


  function pintar(nodo, m) {
    const estado = nodo.querySelector('.r2s-estado');
    if (estado.textContent !== m.textoEstado) estado.textContent = m.textoEstado;
    estado.dataset.estado = m.estado;
    nodo.querySelector('.r2s-datos').innerHTML = datosHtml(m);
    const ul = nodo.querySelector('.r2s-avisos');
    ul.innerHTML = avisosHtml(m);
    ul.hidden = m.avisos.length === 0;
  }

  function montar(opciones) {
    const doc = opciones.documento;
    const obtener = opciones.obtenerEstado;
    const w = doc.defaultView || {};
    let observador = null;

    function actualizar() {
      const m = modelo(obtener());
      if (!m) return false;
      let nodo = doc.getElementById(ID);
      if (!nodo) {
        const fb = doc.querySelector('#fg-fuente .fbody');
        if (!fb) return false;
        const t = doc.createElement('template');
        t.innerHTML = bloqueHtml(m);
        nodo = t.content.firstElementChild;
        fb.appendChild(nodo);
        return true;
      }
      pintar(nodo, m);
      return true;
    }

    function abrir() {
      try { if (typeof w.toExplore === 'function') w.toExplore(); } catch (e) {   }
      const app = doc.getElementById('app');
      try {
        if (app && app.classList.contains('side-collapsed') && typeof w.setSideCollapsed === 'function') w.setSideCollapsed(false);
      } catch (e) {   }
      const d = doc.getElementById('fg-fuente');
      if (!d) return false;
      d.open = true;
      actualizar();
      try { d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { d.scrollIntoView(); }
      const s = d.querySelector('summary');
      if (s) { try { s.focus({ preventScroll: true }); } catch (e) { s.focus(); } }
      return true;
    }

    const alEvento = () => abrir();
    doc.addEventListener(EVENTO, alEvento);

    const destino = doc.getElementById('filters');
    if (typeof w.MutationObserver === 'function') {
      observador = new w.MutationObserver(() => {
        if (doc.querySelector('#fg-fuente .fbody') && !doc.getElementById(ID)) actualizar();
      });
      observador.observe(destino || doc.body, destino ? { childList: true } : { childList: true, subtree: true });
    }
    const control = {
      obtener,
      actualizar,
      abrir,
      desmontar() {
        if (observador) observador.disconnect();
        doc.removeEventListener(EVENTO, alEvento);
        if (montado === control) montado = null;
      },
    };
    montado = control;
    actualizar();
    return control;
  }

  R2.sobreCorpus = { ID, EVENTO, modelo, html, montar };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/sobre_corpus.js

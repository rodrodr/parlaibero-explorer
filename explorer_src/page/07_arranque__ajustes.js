










(function (R2) {
  'use strict';

  const g = globalThis;
  const doc = g.document;
  const ESTILOS = ['editorial', 'iluminado', 'clasico'];
  const COLOR_TEMA = { editorial: '#6a1a24', iluminado: '#6a1a24', clasico: '#4a4fa8' };
  let dlg = null;

  function leer(clave) { try { return g.localStorage.getItem(clave); } catch (e) { return null; } }
  function guardar(clave, valor) { try { g.localStorage.setItem(clave, valor); } catch (e) {   } }

  const estilo = () => (ESTILOS.includes(doc.documentElement.dataset.estilo) ? doc.documentElement.dataset.estilo : 'editorial');
  const tema = () => (doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');


  function aplicar() {
    const e = leer('estilo');
    doc.documentElement.dataset.estilo = ESTILOS.includes(e) ? e : 'editorial';
    colorTema();
  }

  function colorTema() {
    const m = doc.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', COLOR_TEMA[estilo()]);
  }

  function poner(o = {}) {
    if (o.tema === 'dark' || o.tema === 'light') { doc.documentElement.dataset.theme = o.tema; guardar('tema', o.tema); }
    if (ESTILOS.includes(o.estilo)) { doc.documentElement.dataset.estilo = o.estilo; guardar('estilo', o.estilo); }
    colorTema();
    if (dlg) pintar();
    try { doc.dispatchEvent(new g.CustomEvent('r2:ajustes', { detail: { tema: tema(), estilo: estilo() } })); } catch (e) {   }
  }

  const opcion = (grupo, valor, titulo, nota) =>
    `<label class="chk"><input type="radio" name="${grupo}" value="${valor}"><span class="lbl">${titulo}<small>${nota}</small></span></label>`;

  function crear() {
    dlg = doc.createElement('dialog');
    dlg.id = 'dlgAjustes';
    dlg.setAttribute('aria-labelledby', 'ajustesTitulo');
    dlg.innerHTML = `<div class="dhead"><h3 id="ajustesTitulo">Ajustes</h3>
    <p class="dsub">Se recuerdan en este navegador.</p></div>
  <div class="dbody">
    <fieldset><legend>Estilo</legend><div class="opciones">
      ${opcion('estilo', 'editorial', 'Editorial', 'Granate y pliego de lectura: nombre del orador en grande, texto mayor y capital inicial.')}
      ${opcion('estilo', 'iluminado', 'Iluminado', 'Como el editorial, con iniciales de manuscrito iluminado en las intervenciones largas.')}
      ${opcion('estilo', 'clasico', 'Clásico', 'El aspecto original de la aplicación.')}
    </div></fieldset>
    <fieldset><legend>Tema</legend><div class="opciones">
      ${opcion('tema', 'light', 'Claro', 'Papel claro.')}
      ${opcion('tema', 'dark', 'Oscuro', 'Fondo oscuro; la misma paleta, adaptada.')}
    </div></fieldset>
  </div>
  <div class="dfoot"><button type="button" class="btn primary" data-close>Cerrar</button></div>`;
    dlg.addEventListener('change', (ev) => {
      const t = ev.target;
      if (!t || t.type !== 'radio' || !t.checked) return;
      poner(t.name === 'tema' ? { tema: t.value } : { estilo: t.value });
    });
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    doc.body.appendChild(dlg);
  }

  function pintar() {
    for (const r of dlg.querySelectorAll('input[type="radio"]')) r.checked = r.value === (r.name === 'tema' ? tema() : estilo());
  }

  function abrir() {
    if (!dlg) crear();
    pintar();
    if (!dlg.open) dlg.showModal();
  }

  R2.ajustes = { aplicar, estilo, tema, poner, abrir, COLOR_TEMA };
}(globalThis.R2 = globalThis.R2 || {}));
//# sourceURL=2rep-standalone/src/arranque/ajustes.js

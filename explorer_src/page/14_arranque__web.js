




































(function (R2) {
  'use strict';

  const CLAVE_AUTO = 'diarios-explorer:v1:recordar-corpus';
  const MIB = 1048576;
  const ESPERA_CERROJO_MS = 20000;
  const TEXTO_FIREFOX = 'En Firefox, la base recordada depende de dónde esté este archivo: si lo mueve o le cambia el nombre, no la encontrará.';
  const S = {
    g: null, doc: null, api: null, web: false, modo: null, detalle: {}, detectando: null, local: null,
    auto: true, consulta: null, consultando: null, operacion: null, mensaje: '', error: false, progreso: null,
    pendienteRecordar: null, origen: null, raizCarga: null, autoIntentado: false, espacio: null, persistente: null,
    reemplazo: null, bitacora: [], metricas: {}, gecko: false, archivoLocal: false, dlg: null, entrada: null,
    sw: { estado: 'sin_service_worker', version: null, copia: null, nueva: false, pedida: false, error: null, registro: null },
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mib = (b) => `${new Intl.NumberFormat('es-ES').format(Math.round((b || 0) / MIB))} MiB`;
  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const textoDe = (e) => (e && e.name && e.message ? `${e.name}: ${e.message}` : String(e && e.message ? e.message : e));
  function fecha(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} a las ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function conTiempo(promesa, ms) {
    let t = null;
    return Promise.race([promesa, new Promise((_, rechazar) => { t = setTimeout(() => rechazar(new Error(`sin respuesta en ${ms} ms`)), ms); })])
      .finally(() => clearTimeout(t));
  }


  const CSS = `
.r2w{margin:14px 0 0;padding:11px 13px;border:1px solid var(--border-soft);border-radius:8px;background:var(--bg-sunken);font-size:12.5px;line-height:1.5}
.r2w-t{margin:0 0 4px;font-weight:600}
.r2w-ficha{margin:0 0 6px}
.r2w .r2c-botones{margin:6px 0 2px}
.r2w-auto{display:flex;gap:7px;align-items:flex-start;margin:6px 0 0;cursor:pointer}
.r2w-auto input{margin-top:3px}
.r2w-nota{margin:6px 0 0;color:var(--text-soft)}
.r2w-msg{margin:6px 0 0}
.r2w-msg[data-error="1"]{color:var(--danger)}
.r2w-sobre{margin:8px 0 0}
.r2w-sobre p{margin:0 0 6px;font-size:11px;line-height:1.5}
.r2w-sobre .r2w-auto{font-size:11px;margin:0 0 6px}
.r2w-sobre .btn{margin:0 6px 6px 0}
#r2-web-dlg .ddel-txt:last-child{margin-bottom:0}
#r2-web-version{position:fixed;left:16px;bottom:16px;z-index:60;display:flex;gap:10px;align-items:center;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-elev,var(--bg));color:var(--text);box-shadow:0 4px 18px rgba(0,0,0,.18);font-size:13px}
`;


  function disponible(g) {
    const w = g || globalThis;
    const loc = w.location || {};
    const nav = w.navigator || {};
    return (loc.protocol === 'https:' || loc.protocol === 'http:') && !!w.isSecureContext
      && !!(nav.storage && typeof nav.storage.getDirectory === 'function');
  }

  const modoOk = () => S.modo === 'opfs' || S.modo === 'idb';
  const recordado = () => (S.consulta && S.consulta.recordado) || null;
  const buildId = () => (R2.datos && R2.datos.edicion && R2.datos.edicion.build_id) || '';
  const fase = () => (S.api && S.api.fase ? S.api.fase() : null);
  function cliente() { return S.api && S.api.cliente ? S.api.cliente() : null; }


  function corpusRecordado() {
    const r = recordado();
    const inf = S.api && S.api.informe ? S.api.informe() : null;
    return !!(r && inf && inf.huella && inf.huella.sha256 && inf.huella.sha256 === r.csv_sha256);
  }

  function bitacora(evento, datos) {
    S.bitacora.push({ t: Math.round(ahora()), evento, datos: datos === undefined ? null : datos });
    if (S.bitacora.length > 100) S.bitacora.shift();
  }


  function describir(r, conBytes = true) {
    if (!r) return '';
    const v = r.version && r.version.corto ? ` (${r.version.corto})` : '';
    return `«${r.nombre_csv || 'CSV'}»${v}${conBytes ? ` · ${mib(r.bytes)}` : ''}`;
  }



  const conDatos = () => !!(R2.arranque && typeof R2.arranque.datosPropios === 'function' && R2.arranque.datosPropios());

  function sinBaseTexto(prefijo) {
    const p = conDatos() ? (R2.arranque.datosPropios().tipo === 'servido'
      ? 'el corpus se descargará de nuevo en cada visita' : 'el corpus se volverá a preparar desde los datos incluidos en cada visita')
      : 'tendrá que elegir el CSV en cada visita';
    return prefijo ? `${prefijo}: ${p}.` : p;
  }
  const sinElegirCsv = () => (conDatos() ? 'sin descargarla ni prepararla de nuevo' : 'sin elegir el CSV');

  function textoSinAlmacen() {
    return sinBaseTexto(S.archivoLocal
      ? 'Este navegador no permite guardar la base con la página abierta como archivo'
      : 'Este navegador no permite guardar la base');
  }

  function cerrojo(modo, fn, esperaMs, signal) {
    if (R2.baseLocal && typeof R2.baseLocal.conCerrojo === 'function') return R2.baseLocal.conCerrojo(S.g, modo, fn, { esperaMs, signal });
    return fn();
  }

  async function pedirOp(op, args, o = {}) {
    const c = o.cliente || cliente();
    if (!c) throw Object.assign(new Error('El motor de la página todavía no está listo.'), { codigo: 'ESTADO' });
    const r = await c.pedir(op, args || {}, { prioridad: o.prioridad || 'interactiva', signal: o.signal });
    if (r.status >= 400) {
      throw Object.assign(new Error((r.cuerpo && r.cuerpo.error) || `Error ${r.status}`), { codigo: r.cuerpo && r.cuerpo.codigo, status: r.status });
    }
    return r.cuerpo;
  }

  function avisar(texto, error) {
    S.mensaje = texto || '';
    S.error = !!error;
    pintar();
    if (texto && R2.anuncios) R2.anuncios.anunciar(texto, !!error);
  }


  async function probarLocal() {
    if (!R2.baseLocal || globalThis.R2_SIN_BASE_LOCAL) return false;
    if (!S.local) S.local = R2.baseLocal.crear({ ventana: S.g, buildId: buildId() });
    const p = await conTiempo(S.local.probar(), 4000).catch((e) => ({ ok: false, detalle: textoDe(e) }));
    if (!p.ok) S.detalle.idb = p.detalle;
    return !!p.ok;
  }

  async function detectar() {
    const nav = S.g.navigator || {};
    if (disponible(S.g)) {
      try {
        await conTiempo(Promise.resolve().then(() => nav.storage.getDirectory()), 3000);
        S.modo = 'opfs';
        return S.modo;
      } catch (e) {
        S.detalle.opfs = textoDe(e);
      }
    }
    S.modo = (await probarLocal()) ? 'idb' : 'ninguno';
    return S.modo;
  }

  function actualizarEspacio() {
    const st = S.g && S.g.navigator && S.g.navigator.storage;
    if (!st) return;
    try {
      if (typeof st.estimate === 'function') {
        Promise.resolve(st.estimate()).then((e) => { S.espacio = { usage: e.usage, quota: e.quota }; pintar(); }, () => {});
      }
      if (typeof st.persisted === 'function') Promise.resolve(st.persisted()).then((v) => { if (v) S.persistente = true; pintar(); }, () => {});
    } catch (e) {   }
  }


  function pedirPersistencia() {
    const st = S.g && S.g.navigator && S.g.navigator.storage;
    if (!st || typeof st.persist !== 'function' || S.persistente === true || S.persistenciaPedida) return;
    S.persistenciaPedida = true;
    try {
      Promise.resolve(st.persist()).then((v) => { S.persistente = !!v; bitacora('persist', !!v); pintar(); }, () => { S.persistente = false; });
    } catch (e) { S.persistente = false; }
  }


  function explicarLiberados(lib) {
    if (!lib) return;
    bitacora('liberados', { obsoletos: lib.obsoletos, danados: lib.danados, sobrantes: lib.sobrantes, bytes: lib.bytes });
    if (lib.obsoletos) {
      avisar(`La base recordada era de una versión anterior de Diarios Explorer y ya no sirve con esta: se ha borrado para liberar espacio (${mib(lib.bytes)}). Elija el CSV para volver a construirla.`);
    } else if (lib.danados) {
      avisar(`La base recordada estaba dañada o incompleta y se ha borrado (${mib(lib.bytes)}). Elija el CSV para volver a construirla.`, true);
    }
  }

  async function consultarAhora() {
    let r = await cerrojo('exclusive', () => (S.modo === 'opfs' ? pedirOp('corpus_recordado', { limpiar: true }) : S.local.estado({ limpiar: true })),
      ESPERA_CERROJO_MS);

    if (S.modo === 'opfs' && r && r.error && r.error.codigo === 'OPFS_NO_DISPONIBLE') {
      S.detalle.opfs = r.error.mensaje;
      if (await probarLocal()) {
        S.modo = 'idb';
        r = await cerrojo('exclusive', () => S.local.estado({ limpiar: true }), ESPERA_CERROJO_MS);
      } else {
        S.modo = 'ninguno';
        r = { disponible: false, recordado: null, otros: 0 };
      }
    }
    return r;
  }

  async function consultar() {
    if (S.detectando) await S.detectando;
    if (!modoOk()) {
      S.consulta = { disponible: false, recordado: null, otros: 0, error: null };
      pintar();
      return S.consulta;
    }
    if (S.modo === 'opfs' && !cliente()) return S.consulta;
    if (S.consultando) return S.consultando;
    S.consultando = (async () => {
      try {
        const r = await consultarAhora();
        S.consulta = r;
        explicarLiberados(r && r.liberados);
      } catch (e) {
        S.consulta = { disponible: true, recordado: null, otros: 0, error: { codigo: e.codigo || 'ALMACEN', mensaje: e.message } };
      }
      return S.consulta;
    })().finally(() => { S.consultando = null; pintar(); });
    return S.consultando;
  }

  async function recordar(o = {}) {
    if (!modoOk() || S.operacion === 'recordar') return;
    if (S.operacion) { S.pendienteRecordar = o; return; }
    if (!S.api || S.api.huella() !== 'comprobada') {
      S.pendienteRecordar = o;
      avisar('La base se guardará en cuanto termine la comprobación de la huella del CSV…');
      return;
    }
    S.pendienteRecordar = null;
    const anterior = recordado();
    S.operacion = 'recordar';
    S.progreso = null;
    pedirPersistencia();
    avisar('Guardando la base en este navegador…');
    bitacora('guardar_inicio', { anterior: anterior && anterior.nombre, reemplazo: !!o.reemplazo });
    const t0 = ahora();
    try {
      const r = await cerrojo('exclusive', () => (S.modo === 'opfs'
        ? pedirOp('recordar', null, { prioridad: 'fondo' })
        : S.local.guardar({ cliente: cliente(), alProgreso: (h, t) => progreso(h, t) })), 120000);
      S.consulta = Object.assign({}, S.consulta, { disponible: true, recordado: r.recordado, otros: 0, error: null });
      S.metricas.guardar = { ms: Math.round(ahora() - t0), bytes: r.recordado && r.recordado.bytes, almacen: S.modo, ya_recordado: !!r.ya_recordado };
      bitacora('guardada', { nombre: r.recordado && r.recordado.nombre, ya_recordado: !!r.ya_recordado });
      if (r.borrados && r.borrados.length) bitacora('borradas', { nombres: r.borrados, bytes: r.bytes_borrados || null });
      S.operacion = null;
      S.progreso = null;
      actualizarEspacio();
      const cambio = anterior && !r.ya_recordado && anterior.csv_sha256 !== (r.recordado && r.recordado.csv_sha256);
      let texto;
      if (o.reemplazo) {
        texto = r.ya_recordado
          ? 'El archivo elegido es la misma versión que ya estaba recordada: no ha cambiado nada.'
          : `Base reemplazada: ahora se recuerda ${describir(r.recordado)} y se ha borrado la anterior${anterior ? ` (${describir(anterior, false)})` : ''}. Sus bibliotecas siguen igual.`;
      } else if (r.ya_recordado) {
        texto = 'Esta base ya estaba recordada en este navegador.';
      } else {
        texto = `Base recordada en este navegador (${mib(r.recordado && r.recordado.bytes)}): la próxima vez se abrirá sola, ${sinElegirCsv()}.`
          + (cambio ? ` Sustituye a la que había (${describir(anterior, false)}).` : '');
      }
      avisar(texto);
    } catch (e) {
      S.operacion = null;
      S.progreso = null;
      bitacora('guardar_fallo', { codigo: e.codigo || null, mensaje: e.message });
      avisar(o.reemplazo
        ? `No se pudo guardar la base nueva: ${e.message} Se conserva la base recordada anterior; esta pestaña usa la nueva hasta que la cierre.`
        : `No se pudo recordar la base: ${e.message}`, true);
    }
    if (S.pendienteRecordar && !S.operacion) { const p = S.pendienteRecordar; S.pendienteRecordar = null; if (!corpusRecordado()) recordar(p); }
  }

  function progreso(hecho, total) {
    S.progreso = total > 0 ? Math.min(1, hecho / total) : null;
    const t = S.progreso == null ? '' : ` ${Math.floor(S.progreso * 100)} %`;
    if (!S.doc) return;
    for (const el of S.doc.querySelectorAll('[data-r2w="progreso"]')) el.textContent = t;
  }


  async function abrirEn(c, o = {}) {
    if (!modoOk()) throw Object.assign(new Error(textoSinAlmacen()), { codigo: 'NO_DISPONIBLE' });
    const t0 = ahora();
    S.operacion = 'abrir';
    pintar();
    bitacora('abrir_inicio', null);
    try {
      const r = await cerrojo(S.modo === 'opfs' ? 'exclusive' : 'shared', () => (S.modo === 'opfs'
        ? pedirOp('abrir_recordado', {}, { cliente: c, signal: o.signal })
        : S.local.abrir({ cliente: c, alProgreso: o.alProgreso, signal: o.signal })), 60000, o.signal);
      S.metricas.abrir = { ms: Math.round(ahora() - t0), bytes: r.recordado ? r.recordado.bytes : null, almacen: S.modo };
      if (r.recordado) S.consulta = Object.assign({}, S.consulta, { disponible: true, recordado: r.recordado, error: null });
      bitacora('abierta', { nombre: r.recordado && r.recordado.nombre, ms: S.metricas.abrir.ms });
      return r;
    } finally {
      S.operacion = null;
    }
  }





  async function abrirServidoEn(c, o = {}) {
    const t0 = ahora();
    S.operacion = 'servido';
    pintar();
    bitacora('servido_inicio', null);
    try {
      const base = new URL('./', (S.g.location || {}).href || '').href;
      const r = await pedirOp('abrir_servido', { base }, { cliente: c, signal: o.signal });
      S.metricas.servido = { ms: Math.round(ahora() - t0), bytes: r.servido ? r.servido.bytes : null };
      bitacora('servido_abierto', { ms: S.metricas.servido.ms });
      return r;
    } finally {
      S.operacion = null;
    }
  }

  function alFalloApertura(e) {
    bitacora('abrir_fallo', { codigo: e && e.codigo, mensaje: e && e.message });
    if (e && (e.codigo === 'RECORDADO_DANADO' || e.codigo === 'NO_RECORDADO')) {
      S.consulta = Object.assign({}, S.consulta, { recordado: null });
      consultar();
    }
    pintar();
  }

  function alCancelarApertura() {
    bitacora('abrir_cancelada', null);
    pintar();
  }

  async function abrir() {
    if (!modoOk() || S.operacion || !recordado() || !S.api || !S.api.abrirRecordado) return;
    S.autoIntentado = true;
    S.mensaje = '';
    S.error = false;
    try { await S.api.abrirRecordado({ recordado: recordado() }); } catch (e) {   }
  }

  async function olvidar(o = {}) {
    if (!modoOk() || S.operacion) return false;
    const r = recordado();
    const enApp = fase() === 'app';
    if (!o.sinConfirmar) {
      const parrafos = [
        r ? `Se borrará de este navegador la base guardada ${describir(r, false)} y se liberarán unos ${mib(r.bytes)}.`
          : 'Se borrará de este navegador lo que quede guardado de la base.',
        'Sus bibliotecas no se borran: siguen guardadas en este navegador.',
      ];
      if (enApp) parrafos.push(`Esta pestaña sigue funcionando con la base abierta hasta que la cierre o la recargue; después ${conDatos() ? sinBaseTexto('').replace(' en cada visita', ' al abrir la página') : 'habrá que volver a elegir el CSV'}.`);
      if (S.auto) parrafos.push(`${conDatos() ? 'La próxima vez que se abra el corpus' : 'La próxima vez que elija el CSV'} se volverá a recordar, salvo que desmarque «Recordar la base en este navegador».`);
      if (!(await confirmar({ titulo: '¿Olvidar la base recordada?', parrafos, si: 'Olvidar la base', peligro: true }))) return false;
    }
    S.operacion = 'olvidar';
    avisar('Olvidando la base…');
    try {
      const x = await cerrojo('exclusive', () => (S.modo === 'opfs' ? pedirOp('olvidar') : S.local.olvidar()), 60000);
      S.consulta = Object.assign({}, S.consulta, { recordado: null, otros: 0 });
      bitacora('olvidada', { bytes: x.bytes_borrados || 0 });
      S.operacion = null;
      actualizarEspacio();
      avisar(x.bytes_borrados
        ? `Base olvidada: se han liberado ${mib(x.bytes_borrados)} de este navegador. Sus bibliotecas siguen guardadas.${enApp ? ' Esta pestaña sigue usando la base hasta que la cierre o la recargue.' : ''}`
        : 'No había ninguna base recordada en este navegador.');
      return true;
    } catch (e) {
      S.operacion = null;
      avisar(`No se pudo olvidar la base: ${e.message}`, true);
      return false;
    }
  }


  function entradaArchivo() {
    if (S.entrada && S.entrada.isConnected) return S.entrada;
    const i = S.doc.createElement('input');
    i.type = 'file';
    i.accept = '.csv,text/csv';
    i.className = 'r2c-oculto';
    i.tabIndex = -1;
    i.setAttribute('aria-hidden', 'true');
    i.setAttribute('data-r2-web-archivo', '');
    i.addEventListener('change', () => {
      const f = i.files && i.files[0];
      i.value = '';
      if (f) reemplazarCon(f);
    });
    S.doc.body.appendChild(i);
    S.entrada = i;
    return i;
  }

  async function reemplazarCon(archivo) {
    if (!modoOk() || S.operacion || fase() !== 'app' || !S.api || !S.api.reemplazar) return;
    const ant = recordado();
    const P = R2.progreso;
    const tam = P && P.tamano ? P.tamano(archivo.size) : mib(archivo.size);
    const ok = await confirmar({
      titulo: '¿Reemplazar la base recordada?',
      parrafos: [
        ant ? `Ahora se recuerda: ${describir(ant)}.` : 'Ahora no hay ninguna base recordada.',
        `Nueva: «${archivo.name}» (${tam}).`,
        'Se construirá la base con el archivo nuevo. La anterior solo se borra cuando la nueva esté construida, comprobada y guardada; si algo falla, se vuelve a la anterior.',
        'Sus bibliotecas no se tocan. Mientras se construye, la interfaz queda en pausa.',
      ],
      si: 'Reemplazar',
    });
    if (!ok) return;
    let anteriorBorrada = false;
    const st = S.g.navigator && S.g.navigator.storage;
    let est = null;
    try { est = st && typeof st.estimate === 'function' ? await st.estimate() : null; } catch (e) { est = null; }
    if (ant && est && typeof est.quota === 'number' && est.quota > 0) {
      const libres = est.quota - (est.usage || 0);
      const hacen = ant.bytes + Math.max(32 * MIB, Math.min(128 * MIB, Math.ceil(ant.bytes / 2)));
      if (libres < hacen) {
        bitacora('reemplazo_sin_espacio', { libres, hacen });
        const borrar = await confirmar({
          titulo: 'No hay espacio para las dos bases',
          parrafos: [
            `Para reemplazarla sin riesgo, el navegador guarda la base nueva antes de borrar la anterior, y no hay espacio para las dos: hacen falta unos ${mib(hacen)} y quedan ${mib(Math.max(0, libres))}.`,
            'Puede borrar antes la base recordada y continuar. Si la nueva no llegara a construirse, tendría que volver a elegir un CSV.',
            'Sus bibliotecas no se tocan.',
          ],
          si: 'Borrar la anterior y continuar',
          peligro: true,
        });
        if (!borrar) { avisar('Reemplazo cancelado: la base recordada sigue igual.'); return; }
        if (!(await olvidar({ sinConfirmar: true }))) return;
        anteriorBorrada = true;
      }
    }
    S.reemplazo = { anterior: ant, anteriorBorrada, archivo: { nombre: archivo.name, bytes: archivo.size } };
    S.mensaje = '';
    S.error = false;
    bitacora('reemplazo_inicio', { anterior: ant && ant.nombre, anteriorBorrada, archivo: archivo.name });
    const empezado = await S.api.reemplazar(archivo, { anteriorBorrada });
    if (!empezado) S.reemplazo = null;
  }

  function alFinReemplazo(o = {}) {
    S.reemplazo = null;
    bitacora('reemplazo_fallido', { mensaje: o.mensaje || null });
    if (o.mensaje) { S.mensaje = o.mensaje; S.error = true; }
  }


  function dialogo() {
    if (S.dlg && S.dlg.isConnected) return S.dlg;
    const d = S.doc.createElement('dialog');
    d.id = 'r2-web-dlg';
    d.setAttribute('aria-labelledby', 'r2-web-dlg-t');
    d.setAttribute('aria-describedby', 'r2-web-dlg-c');
    d.innerHTML = '<div class="dhead"><h3 id="r2-web-dlg-t"></h3></div><div class="dbody" id="r2-web-dlg-c"></div>'
      + '<div class="dfoot"><button type="button" class="btn ghost" data-r2-dlg="no">Cancelar</button><button type="button" class="btn" data-r2-dlg="si"></button></div>';
    S.doc.body.appendChild(d);
    S.dlg = d;
    return d;
  }


  function confirmar(o) {
    const d = dialogo();
    if (d.open) return Promise.resolve(false);
    d.querySelector('#r2-web-dlg-t').textContent = o.titulo;
    const c = d.querySelector('#r2-web-dlg-c');
    c.textContent = '';
    for (const t of o.parrafos || []) {
      const p = S.doc.createElement('p');
      p.className = 'ddel-txt';
      p.textContent = t;
      c.appendChild(p);
    }
    const si = d.querySelector('[data-r2-dlg="si"]');
    const no = d.querySelector('[data-r2-dlg="no"]');
    si.textContent = o.si || 'Aceptar';
    si.className = o.peligro ? 'btn danger fill' : 'btn primary';
    const antes = S.doc.activeElement;
    d.dataset.tipo = o.si || '';
    return new Promise((resolver) => {
      const fin = (v) => {
        si.removeEventListener('click', alSi);
        no.removeEventListener('click', alNo);
        d.removeEventListener('cancel', alEsc);
        if (d.open) d.close();
        if (antes && antes.isConnected && typeof antes.focus === 'function') { try { antes.focus(); } catch (e) {   } }
        resolver(v);
      };
      const alSi = () => fin(true);
      const alNo = () => fin(false);
      const alEsc = (ev) => { ev.preventDefault(); fin(false); };
      si.addEventListener('click', alSi);
      no.addEventListener('click', alNo);
      d.addEventListener('cancel', alEsc);
      try { d.showModal(); } catch (e) { resolver(false); return; }
      no.focus();
    });
  }


  const btn = (que, texto, o = {}) => `<button type="button" class="btn${o.clase ? ` ${o.clase}` : ''}" data-r2-web="${que}"${o.off ? ' disabled' : ''}>${esc(texto)}</button>`;
  const casilla = () => `<label class="r2w-auto"><input type="checkbox" data-r2-web="auto"${S.auto ? ' checked' : ''}><span>Recordar la base en este navegador: al volver, se abrirá sola ${sinElegirCsv()}.</span></label>`;
  const mensajeHtml = () => `<p class="r2w-msg" role="status" data-error="${S.error ? 1 : 0}"${S.mensaje ? '' : ' hidden'}>${esc(S.mensaje)}</p>`;

  function htmlCarga() {
    const c = S.consulta;
    const r = recordado();
    const ocupado = !!S.operacion || (S.modo === 'opfs' && !cliente());
    let h = '<p class="r2w-t">Base recordada en este navegador</p>';
    if (!S.modo) h += '<p class="r2w-ficha">Comprobando si este navegador puede guardar la base…</p>';
    else if (S.modo === 'ninguno') h += `<p class="r2w-ficha">${esc(textoSinAlmacen())}</p>`;
    else if (!c) h += '<p class="r2w-ficha">Comprobando si hay una base recordada…</p>';
    else if (c.error) {
      h += `<p class="r2w-ficha">${esc(c.error.mensaje)}</p><div class="r2c-botones">${btn('consultar', 'Volver a comprobar', { off: ocupado })}</div>`;
    } else if (r) {
      h += `<p class="r2w-ficha">${esc(describir(r))}${r.guardado ? ` · guardada el ${esc(fecha(r.guardado))}` : ''}</p>`
        + `<div class="r2c-botones">${btn('abrir', 'Abrir la base recordada', { clase: 'primary', off: ocupado })}${btn('olvidar', 'Olvidar la base', { off: ocupado })}</div>`
        + '<p class="r2w-nota">Si elige otro CSV, su base sustituirá a esta cuando esté construida y guardada; si algo falla, esta se conserva.</p>';
    } else {
      h += `<p class="r2w-ficha">${S.auto ? `Ninguna todavía: ${conDatos() ? 'en cuanto se abra el corpus' : 'cuando elija el CSV'}, la base se guardará aquí y la próxima vez se abrirá sola.` : 'Ninguna.'}</p>`;
    }
    if (modoOk() && !(c && c.error)) h += casilla();
    if (modoOk() && S.gecko && S.archivoLocal) h += `<p class="r2w-nota">${esc(TEXTO_FIREFOX)}</p>`;
    return h + mensajeHtml();
  }

  function htmlSobre() {
    const c = S.consulta;
    const r = recordado();
    const ocupado = !!S.operacion;
    let h = '<div id="r2-web-sobre" class="r2w-sobre"><div class="fuente-k">En este navegador</div>';
    if (!S.modo) h += '<p>Comprobando si este navegador puede guardar la base…</p>';
    else if (S.modo === 'ninguno') h += `<p>${esc(textoSinAlmacen())}</p>`;
    else if (c && c.error) h += `<p>${esc(c.error.mensaje)}</p>${btn('consultar', 'Volver a comprobar', { clase: 'sm', off: ocupado })}`;
    else if (corpusRecordado()) {
      h += `<p>Esta base está recordada en este navegador (${esc(describir(r))}): al volver, se abrirá sola ${sinElegirCsv()}.</p>`
        + btn('reemplazar', 'Reemplazar por otra versión…', { clase: 'sm', off: ocupado }) + btn('olvidar', 'Olvidar la base', { clase: 'sm', off: ocupado });
    } else {
      if (S.operacion === 'recordar') h += '<p>Guardando la base en este navegador…<span data-r2w="progreso"></span></p>';
      else if (S.pendienteRecordar) h += '<p>La base se guardará en cuanto termine la comprobación de la huella del CSV…</p>';
      else {
        const huella = S.api && S.api.huella ? S.api.huella() : null;
        h += `<p>Esta base no está recordada: si cierra o recarga la pestaña, ${conDatos() ? sinBaseTexto('').replace(' en cada visita', '') : 'habrá que volver a elegir el CSV'}.</p>`
          + btn('recordar', 'Recordar la base en este navegador', { clase: 'sm', off: ocupado || huella === 'fallida' });
      }
      if (r) h += `<p>Hay otra base recordada: ${esc(describir(r))}.</p>${btn('olvidar', 'Olvidar la base recordada', { clase: 'sm', off: ocupado })}`;
    }
    if (modoOk()) {
      if (S.espacio && typeof S.espacio.usage === 'number') {
        const donde = S.modo === 'opfs' ? 'almacenamiento privado del navegador, OPFS' : 'IndexedDB';
        h += `<p>Espacio que ocupa en este navegador: ${esc(mib(S.espacio.usage))} (${donde}; incluye sus bibliotecas).`
          + (S.persistente === true ? ' El navegador no lo borrará aunque le falte espacio.' : '') + '</p>';
      }
      h += casilla();
      if (S.gecko && S.archivoLocal) h += `<p>${esc(TEXTO_FIREFOX)}</p>`;
    }
    return `${h}${mensajeHtml()}</div>`;
  }


  function conFoco(contenedor, fn) {
    const a = S.doc.activeElement;
    const k = a && contenedor.contains(a) && a.getAttribute ? a.getAttribute('data-r2-web') : null;
    fn();
    if (k) {
      const n = S.doc.querySelector(`[data-r2-web="${k}"]`);
      if (n && !n.disabled) { try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
    }
  }

  function pintar() {
    if (!S.doc) return;
    const caja = S.raizCarga && S.raizCarga.isConnected ? S.raizCarga.querySelector('[data-r2w="carga"]') : null;
    if (caja) conFoco(caja, () => { caja.innerHTML = htmlCarga(); });
    const sobre = S.doc.getElementById('r2-web-sobre');
    if (sobre) {
      const t = S.doc.createElement('template');
      t.innerHTML = htmlSobre();
      conFoco(sobre, () => sobre.replaceWith(t.content.firstElementChild));
      if (S.progreso != null) progreso(S.progreso, 1);
    }
    const nota = S.doc.querySelector('#r2-sobre .r2s-nota');
    if (nota) nota.hidden = true;
  }

  function montarCarga(raiz) {
    S.raizCarga = raiz;
    if (!raiz) return;
    const soltar = raiz.querySelector('[data-r2="soltar"]');
    if (!soltar || raiz.querySelector('[data-r2w="carga"]')) return;
    const caja = S.doc.createElement('div');
    caja.className = 'r2w';
    caja.setAttribute('data-r2w', 'carga');
    soltar.insertAdjacentElement('afterend', caja);
    pintar();
  }


  function textoConstruir(reemplazo) {
    if (reemplazo) return 'Se construye la base con el archivo nuevo. La base recordada se conserva hasta que esta esté comprobada y guardada. No cierre ni recargue la pestaña hasta que termine.';
    if (modoOk() && S.auto) return 'Se construye en este navegador a partir del CSV y después se guarda aquí, para que la próxima vez se abra sola. No cierre ni recargue la pestaña hasta que termine.';
    return 'Se construye en este navegador cada vez que abre la página. No cierre ni recargue la pestaña hasta que termine.';
  }


  function nuevaVersion() {
    if (S.sw.nueva || !S.doc || !S.doc.body) return;
    S.sw.nueva = true;
    const d = S.doc.createElement('div');
    d.id = 'r2-web-version';
    d.setAttribute('role', 'status');
    d.innerHTML = '<span>Nueva versión disponible.</span><button type="button" class="btn primary sm" data-r2-web="actualizar">Recargar con la nueva versión</button>';
    S.doc.body.appendChild(d);
  }

  async function registrarSW() {
    const g = S.g;
    const nav = g.navigator;
    if (!S.web || !nav || !nav.serviceWorker || !/^https?:$/.test(g.location.protocol) || !g.isSecureContext) return;
    const sw = nav.serviceWorker;
    try {
      S.sw.estado = 'registrando';
      sw.addEventListener('message', (ev) => {
        const d = ev.data || {};
        if (d.tipo === 'version_sw') Object.assign(S.sw, { version: d.version, copia: d.almacen || null });
      });
      sw.addEventListener('controllerchange', () => { if (S.sw.pedida) g.location.reload(); });
      const reg = await sw.register('sw.js', { scope: './' });
      S.sw.registro = reg;
      const vigilar = (w) => {
        if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && sw.controller) nuevaVersion(); });
      };
      if (reg.waiting && sw.controller) nuevaVersion();
      vigilar(reg.installing);
      reg.addEventListener('updatefound', () => vigilar(reg.installing));
      await sw.ready;
      S.sw.estado = 'activo';
      const pedirVersion = () => { if (sw.controller) sw.controller.postMessage({ tipo: 'version' }); };
      if (sw.controller) pedirVersion();
      else sw.addEventListener('controllerchange', pedirVersion, { once: true });
    } catch (e) {
      S.sw.estado = 'error';
      S.sw.error = e && e.message ? e.message : String(e);
    }
  }

  function actualizar() {
    const reg = S.sw.registro;
    if (!reg || !reg.waiting) { S.g.location.reload(); return; }
    S.sw.pedida = true;
    reg.waiting.postMessage({ tipo: 'saltar_espera' });
  }


  function iniciar(o) {
    S.g = o.ventana || globalThis;
    S.doc = S.g.document;
    S.api = o;
    S.web = !!(R2.datos && R2.datos.edicion && R2.datos.edicion.web);
    const loc = S.g.location || {};
    const nav = S.g.navigator || {};
    S.archivoLocal = loc.protocol === 'file:';
    S.gecko = !!(R2.capacidades && R2.capacidades.motorDe(nav.userAgent, nav.userAgentData && nav.userAgentData.brands) === 'gecko');

    try { S.auto = S.g.localStorage.getItem(CLAVE_AUTO) !== '0'; } catch (e) { S.auto = true; }
    if (S.doc && S.doc.head) {
      const st = S.doc.createElement('style');
      st.textContent = CSS;
      S.doc.head.appendChild(st);
    }
    if (S.doc) {
      S.doc.addEventListener('click', (ev) => {
        const b = ev.target && ev.target.closest ? ev.target.closest('button[data-r2-web]') : null;
        if (!b || b.disabled) return;
        const que = b.getAttribute('data-r2-web');
        if (que === 'abrir') abrir();
        else if (que === 'olvidar') olvidar();
        else if (que === 'recordar') recordar();
        else if (que === 'reemplazar') { if (!S.operacion && fase() === 'app') entradaArchivo().click(); }
        else if (que === 'consultar') { S.consulta = null; pintar(); consultar(); }
        else if (que === 'actualizar') actualizar();
      });
      S.doc.addEventListener('change', (ev) => {
        const c = ev.target;
        if (!c || !c.getAttribute || c.getAttribute('data-r2-web') !== 'auto') return;
        S.auto = !!c.checked;
        try { S.g.localStorage.setItem(CLAVE_AUTO, S.auto ? '1' : '0'); } catch (e) {   }
        bitacora('auto', S.auto);
        for (const x of S.doc.querySelectorAll('input[data-r2-web="auto"]')) x.checked = S.auto;
        if (S.auto && fase() === 'app' && !corpusRecordado() && S.origen === 'csv') recordar();
        else pintar();
      });
      if (S.doc.body) entradaArchivo();
    }
    S.detectando = detectar().then(() => { bitacora('modo', S.modo); pintar(); }, () => { S.modo = 'ninguno'; pintar(); });
    registrarSW();
  }

  function debeAutoAbrir() {
    return !S.autoIntentado && !globalThis.R2_SIN_AUTOABRIR && fase() === 'abrir' && !!recordado() && !S.operacion
      && !(S.consulta && S.consulta.error) && !!S.api && typeof S.api.abrirRecordado === 'function';
  }


  function debeAbrirPropios() {
    return !S.autoIntentado && !globalThis.R2_SIN_AUTOABRIR && fase() === 'abrir' && !S.operacion
      && !!S.api && typeof S.api.abrirConDatosPropios === 'function' && S.api.hayDatosPropios();
  }

  function alHola() {
    const f = fase();
    if (!S.consulta || f === 'abrir' || f === 'fallo') {
      consultar().then(() => {


        if (debeAutoAbrir()) { S.autoIntentado = true; bitacora('autoabrir', null); abrir(); }
        else if (debeAbrirPropios()) { S.autoIntentado = true; bitacora('autodatos', null); S.api.abrirConDatosPropios(); }
      });
    } else pintar();
  }

  function alHuella() {
    if (S.pendienteRecordar && S.api.huella() === 'comprobada') recordar(S.pendienteRecordar);
    else pintar();
  }

  function alRevelar(origen) {
    S.origen = origen;
    S.autoIntentado = true;
    actualizarEspacio();
    if (!modoOk()) { pintar(); return; }

    if (origen !== 'csv' && origen !== 'servido') { S.reemplazo = null; pintar(); return; }
    const seguir = () => {
      const rem = S.reemplazo;
      S.reemplazo = null;
      if (rem) recordar({ reemplazo: rem });
      else if (S.auto && !corpusRecordado()) recordar();
      else pintar();
    };
    if (S.detectando || S.consultando) Promise.resolve(S.detectando).then(() => S.consultando).then(seguir, seguir);
    else seguir();
  }

  function estado() {
    return {
      disponible: modoOk(), modo: S.modo, detalle: S.detalle, web: S.web, auto: S.auto, consulta: S.consulta, operacion: S.operacion,
      mensaje: S.mensaje, error: S.error, progreso: S.progreso, corpus_recordado: corpusRecordado(), origen: S.origen,
      auto_intentado: S.autoIntentado, reemplazo: S.reemplazo ? { anterior: S.reemplazo.anterior, anteriorBorrada: S.reemplazo.anteriorBorrada, archivo: S.reemplazo.archivo } : null,
      espacio: S.espacio, persistente: S.persistente, bitacora: S.bitacora.slice(), metricas: Object.assign({}, S.metricas),
      sw: { estado: S.sw.estado, version: S.sw.version, copia: S.sw.copia, nueva: S.sw.nueva, error: S.sw.error },
    };
  }

  R2.web = { disponible, iniciar, montarCarga, alHola, alHuella, alRevelar, htmlSobre, corpusRecordado, estado, consultar, recordar, abrir,
    olvidar, abrirEn, abrirServidoEn, alFalloApertura, alCancelarApertura, alFinReemplazo, recordado, puedeRecordar: modoOk,
    textoConstruir, confirmar };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/web.js

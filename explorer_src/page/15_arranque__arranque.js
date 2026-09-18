































(function (R2) {
  'use strict';

  const ESPERA_MOTOR_MS = 30000;
  const REFRESCO_MS = 500;

  const S = {
    fase: 'nuevo',
    apertura: null, reemplazo: null, esperandoHuella: false,
    archivo: null, cliente: null, hola: null, informe: null, huella: 'pendiente', errorHuella: null, modoLectura: 'worker',
    seguimiento: null, recursos: null, sondeo: null, almacen: null, pendiente: false, avisoNoPublicado: false,
    marcas: {}, persistencia: null,


    silencioso: false,
  };
  const ESPERA_BIBLIOTECAS_MS = 10000;

  const RUTA_BIBLIOTECA = /^\/(?:collections|searches|import)(?:\/|$)/;
  let g = null, doc = null, vista = null, shim = null, sobre = null, intervalo = null, pintadoPendiente = false;

  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const marcar = (k) => { S.marcas[k] = Math.round(ahora()); };
  const textoDe = (e) => (e && e.name && e.message ? `${e.name}: ${e.message}` : String(e && e.message ? e.message : e));
  const ErrorRpc = () => R2.rpc.ErrorRpc;


  function base64(texto, w) {
    const limpio = String(texto).replace(/\s+/g, '');
    const U8 = w.Uint8Array || Uint8Array;
    if (typeof U8.fromBase64 === 'function') return U8.fromBase64(limpio);
    const bin = w.atob(limpio);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  async function gunzip(u8, w) {
    if (R2.inflate && typeof R2.inflate.gunzip === 'function') return R2.inflate.gunzip(u8);
    if (typeof w.DecompressionStream !== 'function') throw new Error('no hay descompresor gzip (R2.inflate o DecompressionStream)');
    const flujo = new w.Blob([u8]).stream().pipeThrough(new w.DecompressionStream('gzip'));
    return new Uint8Array(await new w.Response(flujo).arrayBuffer());
  }

  async function sha256Hex(u8, w) {
    if (R2.sha256 && typeof R2.sha256.hex === 'function') return R2.sha256.hex(u8);
    if (R2.sha256 && typeof R2.sha256.Sha256 === 'function') return new R2.sha256.Sha256().update(u8).hex();
    if (w.crypto && w.crypto.subtle && typeof w.crypto.subtle.digest === 'function') {
      const d = new Uint8Array(await w.crypto.subtle.digest('SHA-256', u8));
      return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return null;
  }

  async function decodificarRecurso(nombre, ventana) {
    const w = ventana || g || globalThis;
    const d = w.document;
    const el = d.getElementById(`r2-carga-${nombre}`) || d.querySelector(`script[type="application/octet-stream"][data-recurso="${nombre}"]`);
    if (!el) throw new (ErrorRpc())('RECURSO_DANADO', { causa: `falta el recurso «${nombre}»` });
    const enc = el.getAttribute('data-enc') || 'base64';
    let u8;
    try {
      u8 = base64(el.textContent, w);
      if (enc === 'gzip+base64') u8 = await gunzip(u8, w);
      else if (enc !== 'base64') throw new Error(`codificación desconocida «${enc}»`);
    } catch (e) {
      throw new (ErrorRpc())('RECURSO_DANADO', { causa: `${nombre}: ${textoDe(e)}` });
    }
    const bytes = el.getAttribute('data-bytes');
    if (bytes != null && Number(bytes) !== u8.length) {
      throw new (ErrorRpc())('RECURSO_DANADO', { causa: `${nombre}: ${u8.length} bytes en lugar de ${bytes}` });
    }
    const esperado = el.getAttribute('data-sha256');
    if (esperado) {
      const real = await sha256Hex(u8, w);
      if (real !== null && real !== esperado.toLowerCase()) throw new (ErrorRpc())('RECURSO_DANADO', { causa: `${nombre}: la huella SHA-256 no coincide` });
    }
    el.textContent = '';
    el.remove();
    return u8;
  }


  function errorDeCarga(e) {
    if (e instanceof R2.rpc.ErrorRpc) return e;
    return new (ErrorRpc())(e && e.codigo ? e.codigo : 'RECURSO_DANADO', { causa: e && e.causa ? e.causa : textoDe(e) });
  }

  async function obtenerRecursos() {
    if (R2.cargas && typeof R2.cargas.preparar === 'function') {
      if (R2.cargas.errorDatos) throw errorDeCarga(R2.cargas.errorDatos);
      let r;
      try { r = await R2.cargas.preparar(); } catch (e) { throw errorDeCarga(e); }
      return { wasm: r.wasm, urlWorker: r.urlWorker, tiempos: r.tiempos || null };
    }
    const wasm = await decodificarRecurso('wasm');
    const codigo = await decodificarRecurso('worker');
    let urlWorker;
    try {
      urlWorker = g.URL.createObjectURL(new g.Blob([codigo], { type: 'text/javascript' }));
    } catch (e) {
      throw new (ErrorRpc())('WORKER_NO_ARRANCA', { causa: textoDe(e) });
    }
    return { wasm, urlWorker, bytesWorker: codigo.length };
  }


  function aplicarTema() {
    let t = null;
    try { t = g.localStorage.getItem('tema'); } catch (e) { t = null; }
    if (t !== 'dark') t = 'light';
    doc.documentElement.dataset.theme = t;
  }

  function alternarTema() {
    const t = doc.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    doc.documentElement.dataset.theme = t;
    try { g.localStorage.setItem('tema', t); } catch (e) {   }
  }


  function referenciaLocal() {
    const d = R2.datos || {};
    const pub = d.csv_publicado || null;
    const bruta = d.fuente && typeof d.fuente === 'object' ? (d.fuente.fuente || d.fuente) : null;
    let fuente = null;
    if (bruta && bruta.cita) {
      fuente = { cita: bruta.cita, url: bruta.url || (bruta.doi ? `https://doi.org/${bruta.doi}` : null), licencia_nombre: bruta.licencia || null };
    }
    return { publicado: pub ? { bytes: pub.bytes, filas: pub.filas, url: pub.url, doi: pub.doi, version: pub.version } : null, fuente };
  }


  function crearVista() {
    const v = R2.carga.crear({
      documento: doc,
      manejadores: {
        alElegir: elegir, alCancelar: cancelar, alReintentar: reintentar, alOtro: otroArchivo, alContinuar: revelar,
        alRecargar: () => g.location.reload(), alTema: alternarTema, alCancelarRecordado: cancelarApertura,
      },
    });
    if (R2.web) R2.web.montarCarga(v.raiz);
    v.ponerReferencia(referenciaLocal());
    if (S.hola) {
      v.ponerReferencia(S.hola.referencia);
      v.ponerMotor(S.hola.sqlite);
    }
    if (S.sondeo) v.ponerAvisos(R2.capacidades.avisos(S.sondeo, S.almacen));
    return v;
  }

  function programarPintado() {
    if (pintadoPendiente) return;
    pintadoPendiente = true;
    const f = () => {
      pintadoPendiente = false;
      if (vista && S.seguimiento && S.fase === 'construyendo') vista.pintarProgreso(S.seguimiento.estado());
    };
    if (typeof g.requestAnimationFrame === 'function' && !doc.hidden) g.requestAnimationFrame(f);
    else setTimeout(f, 50);
  }

  function pararRefresco() {
    if (intervalo) { clearInterval(intervalo); intervalo = null; }
  }


  function nuevoCliente() {
    if (S.cliente) S.cliente.terminar('CANCELADO');
    const cliente = R2.rpc.crearCliente({
      crearWorker: () => new g.Worker(S.recursos.urlWorker, { name: 'diarios-explorer' }),
      tiempoArranqueMs: ESPERA_MOTOR_MS,
      alEvento: (tipo, datos) => { if (S.cliente === cliente) alEvento(cliente, tipo, datos); },
    });
    S.cliente = cliente;
    S.hola = S.hola || null;
    cliente.iniciar(S.recursos.wasm).then((hola) => {
      if (S.cliente !== cliente) return;
      if (!S.marcas.hola) marcar('hola');
    }, (err) => manejarError(cliente, err));
    return cliente;
  }

  function alEvento(cliente, tipo, datos) {
    switch (tipo) {
      case 'hola':
        S.hola = datos;
        if (vista) {
          vista.ponerReferencia(datos.referencia);
          vista.ponerMotor(datos.sqlite);
          vista.estadoMotor('');
        }
        if (R2.web) R2.web.alHola();
        break;
      case 'progreso':
        if (S.seguimiento) {
          S.seguimiento.evento(datos);
          programarPintado();
        }
        break;
      case 'modo_lectura':
        S.modoLectura = datos.modo;
        break;
      case 'huella':
        S.informe = datos.informe;
        S.huella = 'comprobada';
        marcar('huella');
        if (sobre) sobre.actualizar();
        avisarNoPublicado();
        if (S.esperandoHuella && S.fase === 'construyendo') {
          S.esperandoHuella = false;
          continuarTrasListo();
        }
        if (R2.web) R2.web.alHuella();
        break;
      case 'fallo_huella':
        S.huella = 'fallida';

        S.errorHuella = datos && typeof datos.aObjeto === 'function' ? datos.aObjeto() : datos;
        if (sobre) sobre.actualizar();
        if (S.reemplazo && S.fase === 'construyendo') {
          const nombre = S.archivo && S.archivo.name ? `«${S.archivo.name}»` : 'el archivo nuevo';
          volverAnterior(`No se pudo comprobar la huella de ${nombre} (${datos && (datos.message || datos.mensaje)}): no se ha reemplazado la base recordada.`);
        }
        break;
      case 'progreso_base':
        if (S.fase === 'recordado' && vista && datos) {
          if (S.silencioso) vista.progresoEspera(datos.total > 0 ? datos.hecho / datos.total : null);
          else vista.progresoRecordado(datos.hecho, datos.total);
        }
        break;
      case 'fatal':
        manejarError(cliente, datos);
        break;
      default:
    }
  }

  function manejarError(cliente, err) {
    if (cliente !== S.cliente || cliente.__r2Manejado) return;
    const e = err instanceof R2.rpc.ErrorRpc ? err : R2.rpc.errorDe(err && err.codigo ? err : { codigo: 'ERROR_INTERNO', mensaje: textoDe(err) });
    if (e.codigo === 'CANCELADO') return;
    if (S.fase === 'recordado') return;
    cliente.__r2Manejado = true;
    if (S.fase === 'app' || S.fase === 'caido') {
      caidaTrasListo(e);
      return;
    }
    if (S.reemplazo && (S.fase === 'construyendo' || S.fase === 'confirmar')) {
      const nombre = S.archivo && S.archivo.name ? `«${S.archivo.name}»` : 'el archivo nuevo';
      volverAnterior(`No se pudo construir la base con ${nombre}: ${e.message}`);
      return;
    }
    mostrarFallo(e, { precalentar: S.fase === 'construyendo' });
  }


  function elegir(archivo, opciones = {}) {
    if (!archivo || !(S.fase === 'abrir' || S.fase === 'fallo' || S.fase === 'confirmar')) return;
    if (S.fase === 'fallo' && !S.recursos) return;
    S.silencioso = !!opciones.silencioso;
    S.archivo = archivo;
    S.informe = null;
    S.huella = 'pendiente';
    S.errorHuella = null;
    S.modoLectura = 'worker';
    S.avisoNoPublicado = false;
    S.origen = 'csv';
    S.fase = 'construyendo';
    S.seguimiento = R2.progreso.crearSeguimiento();
    marcar('elegido');

    if (S.silencioso) vista.mostrarEspera({ titulo: 'Preparando el corpus…' });
    else {
      vista.mostrarConstruir({ archivo, sqlite: S.hola && S.hola.sqlite,
        entrada: R2.web ? R2.web.textoConstruir(!!S.reemplazo) : null,
        textoCancelar: S.reemplazo ? 'Cancelar y volver a la base recordada' : null });
    }
    pararRefresco();

    intervalo = setInterval(programarPintado, REFRESCO_MS);
    if (!S.recursos) {
      S.pendiente = true;
      return;
    }
    lanzar();
  }

  function lanzar() {
    let cliente = S.cliente;

    if (!cliente || cliente.__r2ConBase || !(cliente.estado === 'iniciando' || cliente.estado === 'preparado')) cliente = nuevoCliente();

    const lectura = S.sondeo && S.sondeo.motor === 'webkit' && S.sondeo.archivoLocal ? 'principal' : 'auto';
    cliente.construir(S.archivo, { lectura }).then((r) => alListo(cliente, r), (err) => manejarError(cliente, err));
  }

  function alListo(cliente, r) {
    if (cliente !== S.cliente || S.fase !== 'construyendo') return;
    marcar('listo');
    S.informe = r.informe;
    S.modoLectura = r.modo_lectura || S.modoLectura;
    S.huella = r.informe.huella.sha256 === null ? 'pendiente' : 'comprobada';
    pararRefresco();
    if (vista && S.seguimiento) vista.pintarProgreso(S.seguimiento.estado());

    if (S.reemplazo && S.huella !== 'comprobada') {
      S.esperandoHuella = true;
      if (vista) vista.notaConstruir('Comprobando la huella del archivo antes de sustituir la base recordada…');
      return;
    }
    continuarTrasListo();
  }

  function continuarTrasListo() {
    if (S.fase !== 'construyendo') return;
    if ((S.informe.avisos || []).some((a) => a.codigo === 'FILAS_DISTINTAS')) {
      S.fase = 'confirmar';
      vista.mostrarConfirmar(S.informe, S.archivo, { textoOtro: S.reemplazo ? 'Volver a la base recordada' : null });
      return;
    }
    revelar();
  }

  function revelar() {
    if (!(S.fase === 'construyendo' || S.fase === 'confirmar')) return;
    S.confirmado = S.fase === 'confirmar';
    S.fase = 'app';
    S.esperandoHuella = false;
    const trasReemplazo = !!S.reemplazo && S.origen !== 'recordado';
    S.reemplazo = null;
    pararRefresco();
    if (vista) { vista.destruir(); vista = null; }
    doc.documentElement.classList.add('r2-app');
    marcar('revelado');
    const cliente = S.cliente;
    if (R2.sobreCorpus) {
      if (sobre) sobre.desmontar();
      sobre = R2.sobreCorpus.montar({ documento: doc, obtenerEstado: estadoSobre });
    }
    if (R2.web) R2.web.alRevelar(S.origen || 'csv');
    if (shim) {


      const motor = {
        pedir: (op, args, o) => {
          const p = S.persistencia;
          const fin = cambiaBibliotecas(op, args) && p && typeof p.empiezaCambio === 'function' ? p.empiezaCambio() : null;
          return cliente.pedir(op, args, o).then((r) => { observarRespuesta(op, args, r); return r; })
            .finally(() => { if (fin) fin(); });
        },
      };

      conectarBibliotecas(cliente).then(() => {
        if (S.cliente === cliente && S.fase === 'app') {
          shim.liberar(motor);

          if (trasReemplazo) doc.dispatchEvent(new g.CustomEvent('r2:corpus-reemplazado'));
        }
      });
    }
    const q = doc.getElementById('q');
    if (q) { try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); } }
    avisarNoPublicado();
  }



  function motorBibliotecas(cliente) {
    const api = (metodo, ruta, cuerpo) => cliente.pedir('api', { metodo, ruta, query: {}, queryLista: [], cuerpo }).then((r) => {
      if (r.status >= 400) {
        const e = new Error(r.cuerpo && r.cuerpo.error ? r.cuerpo.error : `Error ${r.status}`);
        e.status = r.status;
        throw e;
      }
      return r;
    });
    return {
      volcar: () => api('GET', '/_biblioteca/volcado').then((r) => ({ bytes: r.cuerpo, version: Number((r.cabeceras || {})['x-r2-biblioteca']) || 0 })),
      restaurar: (bytes) => api('POST', '/_biblioteca/restaurar', { bytes: bytes || null }).then((r) => r.cuerpo),
      modo: (soloLectura, motivo) => api('POST', '/_biblioteca/modo', { solo_lectura: !!soloLectura, motivo: motivo || null }).then((r) => r.cuerpo),
    };
  }


  function cambiaBibliotecas(op, args) {
    return op === 'api' && !!args && String(args.metodo || 'GET').toUpperCase() !== 'GET' && RUTA_BIBLIOTECA.test(String(args.ruta || ''));
  }










  function montarAnuncios() {
    if (!doc || !doc.body || doc.getElementById('r2-anuncio')) return;
    const crear = (id, rol, vivo) => {
      const el = doc.createElement('div');
      el.id = id;
      el.className = 'r2c-oculto';
      el.setAttribute('role', rol);
      el.setAttribute('aria-live', vivo);
      el.setAttribute('aria-atomic', 'true');
      doc.body.appendChild(el);
      return el;
    };
    const normal = crear('r2-anuncio', 'status', 'polite');
    const alerta = crear('r2-alerta', 'alert', 'assertive');
    const anunciar = (texto, urgente) => {
      if (!texto) return;
      const el = urgente ? alerta : normal;
      el.textContent = '';
      setTimeout(() => { el.textContent = String(texto); }, 60);
    };
    R2.anuncios = { anunciar };
    const cajas = doc.getElementById('toasts');
    if (cajas && typeof g.MutationObserver === 'function') {
      new g.MutationObserver((cambios) => {
        for (const c of cambios) {
          for (const n of c.addedNodes) {
            if (n.nodeType === 1 && n.classList && n.classList.contains('toast')) anunciar(n.textContent, n.classList.contains('err'));
          }
        }
      }).observe(cajas, { childList: true });
    }
  }


  async function conectarBibliotecas(cliente) {
    const p = S.persistencia;
    if (!p) return;
    let t = null;
    try {
      await Promise.race([
        p.conectar(motorBibliotecas(cliente)),
        new Promise((_, rechazar) => { t = setTimeout(() => rechazar(new Error(`sin respuesta en ${ESPERA_BIBLIOTECAS_MS / 1000} s`)), ESPERA_BIBLIOTECAS_MS); }),
      ]);
    } catch (e) {
      console.error('Diarios Explorer: no se pudieron recuperar las bibliotecas guardadas', e);
    } finally {
      if (t) clearTimeout(t);
    }
  }


  function observarRespuesta(op, args, r, persistencia) {
    const p = persistencia || S.persistencia;
    if (!p || op !== 'api' || !args || !r) return;
    try {
      const cab = r.cabeceras || {};
      const metodo = String(args.metodo || 'GET').toUpperCase();
      if (cab['x-r2-biblioteca'] || (metodo !== 'GET' && RUTA_BIBLIOTECA.test(String(args.ruta || '')))) p.notificar();
      if (cab['x-r2-exportadas'] && r.status < 400) p.marcarExportado();
    } catch (e) {   }
  }

  function estadoSobre() {
    return { informe: S.informe, huella: S.huella, errorHuella: S.errorHuella, modoLectura: S.modoLectura,
      referencia: S.hola && S.hola.referencia ? S.hola.referencia.publicado : null };
  }






  function avisarNoPublicado() {
    if (S.fase !== 'app' || S.avisoNoPublicado || S.confirmado || !S.informe || S.informe.publicado !== false) return;
    S.avisoNoPublicado = true;
    const a = (S.informe.avisos || []).find((x) => x.codigo === 'NO_PUBLICADO');
    if (a && typeof g.toast === 'function') {
      try { g.toast(a.mensaje, true); } catch (e) {   }
    }
  }

  function cancelar() {
    if (S.fase !== 'construyendo') return;
    if (S.reemplazo) {
      marcar('cancelado');
      volverAnterior('Se canceló el reemplazo: la base recordada sigue igual.');
      return;
    }
    marcar('cancelado');
    pararRefresco();
    S.pendiente = false;
    S.fase = 'abrir';
    const archivo = S.archivo;
    if (S.recursos) nuevoCliente();
    vista.mostrarAbrir({
      nota: `Se canceló la construcción${archivo && archivo.name ? ` de ${archivo.name}` : ''}. Puede reintentarlo o elegir otro archivo.`,
      reintentar: archivo, enfocar: 'reintentar',
    });
  }

  function reintentar() {
    if (S.archivo) {
      if (S.fase === 'fallo' || S.fase === 'abrir') elegir(S.archivo);
      return;
    }

    S.fase = 'abrir';
    vista.mostrarAbrir({ enfocar: 'elegir' });
    if (S.recursos) {
      vista.estadoMotor('Preparando el motor de la página…');
      nuevoCliente();
    }
  }






  function otroArchivo() {
    if (S.fase === 'confirmar' && S.reemplazo) {
      volverAnterior('Se canceló el reemplazo: la base recordada sigue igual.');
      return;
    }
    if (S.fase === 'confirmar' || S.fase === 'fallo') {
      vista.abrirSelector();
      return;
    }
    S.fase = 'abrir';
    vista.mostrarAbrir({ enfocar: 'elegir' });
    vista.abrirSelector();
  }


  function alDescargar(ev) {
    if (!(S.fase === 'construyendo' || S.fase === 'confirmar' || S.fase === 'app')) return undefined;
    if (S.fase === 'app' && R2.web && R2.web.corpusRecordado()) return undefined;
    ev.preventDefault();
    ev.returnValue = '';
    return '';
  }

  function mostrarFallo(err, o = {}) {
    pararRefresco();
    S.pendiente = false;
    S.fase = 'fallo';
    S.silencioso = false;
    const navegador = err.codigo === 'NAVEGADOR';
    const sinMotor = !S.recursos || navegador || err.codigo === 'RECURSO_DANADO';
    const arranque = err.codigo === 'WORKER_NO_ARRANCA' || err.codigo === 'WASM_NO_ARRANCA';


    const ilegible = err.codigo === 'ARCHIVO_ILEGIBLE';
    vista.mostrarFallo(err, {
      archivo: S.archivo,
      otro: !sinMotor,
      textoOtro: ilegible ? 'Volver a elegir el archivo' : null,
      reintentar: !sinMotor && !ilegible && (arranque || (!!S.archivo && R2.rpc.REINTENTABLES.has(err.codigo))),

      recargar: (sinMotor && !navegador) || arranque,
      ayudaNavegador: navegador,
    });

    if (o.precalentar && !sinMotor && !arranque) nuevoCliente();
  }


  function fichaRecordado(r) {
    if (!r) return 'Base recordada';
    const partes = [r.nombre_csv || 'CSV'];
    if (r.version && r.version.corto) partes.push(r.version.corto);
    if (r.bytes) partes.push(R2.progreso.tamano(r.bytes));
    return partes.join(' · ');
  }

  const ENTRADA_CON_DATOS = 'El corpus viaja con esta aplicación y se abre solo; nada sale de su equipo. Si quiere explorar otro CSV, puede elegirlo aquí.';


  function fichaServido(s) {
    const partes = [`«${(s.csv_origen && s.csv_origen.nombre) || 'corpus'}»`];
    if (s.bytes_gz) partes.push(`${R2.progreso.tamano(s.bytes_gz)} de descarga`);
    return partes.join(' · ');
  }


  function datosPropios() {
    const s = R2.datos && R2.datos.corpus_servido;
    if (s && Array.isArray(s.partes) && s.partes.length) return { tipo: 'servido', datos: s };
    const c = R2.cargas && typeof R2.cargas.info === 'function' ? R2.cargas.info('corpus') : null;
    if (c) return { tipo: 'embebido', datos: c };
    return null;
  }






  function abrirConDatosPropios() {
    const p = datosPropios();
    if (!p || !(S.fase === 'abrir' || S.fase === 'fallo') || !S.recursos) return false;
    if (p.tipo === 'servido') { abrirServido(p.datos).catch(() => {}); return true; }
    marcar('corpus_embebido');
    vista.mostrarEspera({ titulo: 'Preparando el corpus…' });
    R2.cargas.archivoCorpus().then((archivo) => {
      if (!archivo || S.fase !== 'abrir') return;
      elegir(archivo, { silencioso: true });
    }, (e) => {
      if (S.fase !== 'abrir') return;
      S.silencioso = false;
      vista.mostrarAbrir({ nota: `No se pudo leer el corpus que acompaña a esta aplicación (${textoDe(e)}). Elija el CSV.`,
        entrada: ENTRADA_CON_DATOS, enfocar: 'elegir' });
    });
    return true;
  }





  function abrirServido(s) {
    return abrirSinCsv({
      marca: 'abrir_servido',
      origen: 'servido',
      silencioso: true,
      tituloEspera: 'Abriendo el corpus…',
      ficha: fichaServido(s || (R2.datos && R2.datos.corpus_servido) || {}),
      titulo: 'Abriendo el corpus que acompaña a la página…',
      entrada: 'Este corpus se publica junto a la página: se descarga una vez, se comprueba y se guarda en este navegador para abrirlo solo la próxima vez.',
      textoCancelar: 'Cancelar y elegir el CSV',
      abrir: (cliente, o) => R2.web.abrirServidoEn(cliente, o),
    });
  }







  function abrirRecordado(o = {}) {
    const rec = o.recordado || (R2.web ? R2.web.recordado() : null);
    return abrirSinCsv({
      marca: 'abrir_recordado',
      origen: 'recordado',

      silencioso: !!datosPropios(),
      tituloEspera: 'Abriendo el corpus…',
      ficha: fichaRecordado(rec),
      titulo: o.titulo,
      entrada: o.entrada,
      textoCancelar: o.textoCancelar,
      mensajeTrasAbrir: o.mensajeTrasAbrir,
      abrir: (cliente, x) => R2.web.abrirEn(cliente, x),
    });
  }


  async function abrirSinCsv(o) {
    if (!(S.fase === 'abrir' || S.fase === 'fallo') || !S.recursos || !R2.web) {
      throw Object.assign(new Error('El motor de la página todavía no está listo.'), { codigo: 'ESTADO' });
    }
    pararRefresco();
    S.fase = 'recordado';
    S.silencioso = !!o.silencioso;
    marcar(o.marca);
    const apertura = { ctrl: new g.AbortController(), mensaje: o.mensajeTrasAbrir || null };
    S.apertura = apertura;
    if (!vista) vista = crearVista();
    if (S.silencioso) vista.mostrarEspera({ titulo: o.tituloEspera || 'Abriendo el corpus…', nota: o.entrada || '' });
    else vista.mostrarRecordado({ ficha: o.ficha, titulo: o.titulo, entrada: o.entrada, textoCancelar: o.textoCancelar });
    let cliente = S.cliente;
    if (!cliente || cliente.__r2ConBase || !(cliente.estado === 'iniciando' || cliente.estado === 'preparado')) cliente = nuevoCliente();
    try {
      await cliente.iniciar(S.recursos.wasm);
      cliente.__r2ConBase = true;
      const r = await o.abrir(cliente, {
        signal: apertura.ctrl.signal,
        alProgreso: (hecho, total) => {
          if (S.apertura !== apertura || !vista) return;
          if (S.silencioso) vista.progresoEspera(total > 0 ? hecho / total : null);
          else vista.progresoRecordado(hecho, total);
        },
      });
      if (S.cliente !== cliente || S.apertura !== apertura || S.fase !== 'recordado') return r;
      S.apertura = null;
      marcar('listo');
      Object.assign(S, { archivo: null, informe: r.informe, huella: 'comprobada', errorHuella: null, modoLectura: 'worker',
        avisoNoPublicado: false, origen: o.origen, fase: 'construyendo', seguimiento: null });
      revelar();
      if (apertura.mensaje && typeof g.toast === 'function') {
        try { g.toast(apertura.mensaje, true); } catch (e) {   }
      }
      return r;
    } catch (err) {
      if (S.apertura !== apertura) throw err;
      S.apertura = null;
      marcar(`${o.marca}_fallo`);
      S.fase = 'abrir';
      S.silencioso = false;
      if (S.recursos) nuevoCliente();
      R2.web.alFalloApertura(err);
      if (vista) {
        const antes = apertura.mensaje ? `${apertura.mensaje} ` : '';
        vista.mostrarAbrir({ nota: `${antes}${err && err.message ? err.message : String(err)}`, enfocar: 'elegir' });
      }
      throw err;
    }
  }


  function cancelarApertura() {
    if (S.fase !== 'recordado' || !S.apertura) return;
    const apertura = S.apertura;
    S.apertura = null;
    try { apertura.ctrl.abort(); } catch (e) {   }
    marcar('abrir_recordado_cancelado');
    S.fase = 'abrir';
    S.silencioso = false;
    if (S.recursos) nuevoCliente();
    if (R2.web) R2.web.alCancelarApertura();
    vista.mostrarAbrir({ nota: S.marcas.abrir_servido && !S.marcas.abrir_recordado
      ? 'Se canceló la descarga del corpus que acompaña a la página. Elija el CSV o recargue para volver a intentarlo.'
      : 'Se canceló la apertura de la base recordada: sigue guardada en este navegador. Elija otro CSV o vuelva a abrirla.', enfocar: 'elegir' });
    vista.abrirSelector();
  }






  async function reemplazar(archivo, o = {}) {
    if (S.fase !== 'app' || !archivo || !S.recursos) return false;
    marcar('reemplazo');
    const p = S.persistencia;
    if (p && typeof p.esperar === 'function') {
      let t = null;
      try { await Promise.race([p.esperar(), new Promise((r) => { t = setTimeout(r, ESPERA_BIBLIOTECAS_MS); })]); } catch (e) {   } finally { if (t) clearTimeout(t); }
    }
    if (S.fase !== 'app') return false;
    S.reemplazo = { anteriorBorrada: !!o.anteriorBorrada };
    if (shim) shim.retener();
    if (sobre) { sobre.desmontar(); sobre = null; }
    doc.documentElement.classList.remove('r2-app');
    if (!vista) vista = crearVista();
    S.fase = 'abrir';
    elegir(archivo);
    return true;
  }


  function volverAnterior(mensaje) {
    const rem = S.reemplazo;
    S.reemplazo = null;
    S.esperandoHuella = false;
    pararRefresco();
    S.pendiente = false;
    S.fase = 'abrir';
    S.silencioso = false;
    marcar('reemplazo_fallido');
    if (S.recursos) nuevoCliente();
    const hay = R2.web ? R2.web.recordado() : null;
    if (R2.web) R2.web.alFinReemplazo({ mensaje });
    if (!vista) vista = crearVista();
    if (rem && !rem.anteriorBorrada && hay) {
      abrirRecordado({ recordado: hay, titulo: 'Volviendo a la base recordada…', entrada: mensaje, mensajeTrasAbrir: mensaje }).catch(() => {});
    } else {
      vista.mostrarAbrir({ nota: `${mensaje} Elija un CSV para continuar.`, enfocar: 'elegir' });
    }
  }

  function caidaTrasListo(err) {
    S.fase = 'caido';
    if (shim) shim.fallar(err);
    doc.documentElement.classList.remove('r2-app');
    if (!vista) vista = crearVista();
    vista.mostrarFallo(err, { archivo: S.archivo, recargar: true, titulo: 'El motor se ha detenido' });
  }


  async function iniciar(opciones = {}) {
    if (S.fase !== 'nuevo') return;
    g = opciones.ventana || globalThis;
    doc = g.document;
    shim = opciones.shim || (R2.apiShim && R2.apiShim.instalado) || null;
    S.fase = 'abrir';
    marcar('inicio');
    if (typeof g.addEventListener === 'function') g.addEventListener('beforeunload', alDescargar);
    aplicarTema();
    if (R2.ajustes) R2.ajustes.aplicar();
    try { montarAnuncios(); } catch (e) {   }
    S.sondeo = R2.capacidades.sondearSincrono(g);
    if (R2.web) {
      R2.web.iniciar({ ventana: g, cliente: () => S.cliente, informe: () => S.informe, huella: () => S.huella, fase: () => S.fase,
        abrirRecordado, reemplazar, hayDatosPropios: () => !!datosPropios(), abrirConDatosPropios });
    }
    vista = crearVista();
    if (S.sondeo.faltan.length) {
      const err = new (ErrorRpc())('NAVEGADOR', { faltan: S.sondeo.faltan });
      mostrarFallo(err);
      if (shim) shim.fallar(err);
      return;
    }


    if (datosPropios()) vista.mostrarEspera({ titulo: 'Preparando el corpus…' });
    else vista.mostrarAbrir({ enfocar: 'elegir' });
    vista.estadoMotor('Preparando el motor de la página…');
    R2.capacidades.sondearAlmacen(g).then((alm) => {
      S.almacen = alm;
      if (vista) vista.ponerAvisos(R2.capacidades.avisos(S.sondeo, alm));
    }, () => {});

    if (R2.almacen && typeof R2.almacen.crearPersistencia === 'function') {
      try {
        S.persistencia = R2.almacen.crearPersistencia({ ventana: g });
        R2.persistencia = S.persistencia;
        S.persistencia.iniciar().catch((e) => console.error('Diarios Explorer: no se pudo preparar el guardado de las bibliotecas', e));
      } catch (e) {
        S.persistencia = null;
      }
    }

    try {
      S.recursos = await obtenerRecursos();
      marcar('recursos');
    } catch (e) {
      const err = e instanceof R2.rpc.ErrorRpc ? e : new (ErrorRpc())('RECURSO_DANADO', { causa: textoDe(e) });
      mostrarFallo(err);
      if (shim) shim.fallar(err);
      return;
    }
    nuevoCliente();
    if (S.pendiente && S.fase === 'construyendo') {
      S.pendiente = false;
      lanzar();
    }
  }

  function estado() {
    const c = S.cliente;
    return {
      fase: S.fase,
      archivo: S.archivo ? { nombre: S.archivo.name, bytes: S.archivo.size } : null,
      cliente: c ? { estado: c.estado, lecturas_principal: c.lecturasPrincipal } : null,
      sqlite: S.hola ? S.hola.sqlite : null,
      informe: S.informe,
      huella: S.huella,
      error_huella: S.errorHuella,
      modo_lectura: S.modoLectura,
      progreso: S.seguimiento ? S.seguimiento.estado() : null,
      seccion: vista ? vista.seccion : null,
      shim: shim ? shim.estadisticas() : null,
      sondeo: S.sondeo,
      almacen: S.almacen,
      bibliotecas: S.persistencia ? S.persistencia.estado() : null,
      web: R2.web ? R2.web.estado() : null,
      reemplazo: S.reemplazo ? Object.assign({}, S.reemplazo) : null,
      esperando_huella: !!S.esperandoHuella,
      silencioso: !!S.silencioso,
      marcas: Object.assign({}, S.marcas),
    };
  }

  R2.arranque = { iniciar, estado, decodificarRecurso, persistencia: () => S.persistencia, motorBibliotecas, observarRespuesta,
    cambiaBibliotecas, datosPropios, RUTA_BIBLIOTECA };

  const noApto = typeof window !== 'undefined' && window.R2_NAVEGADOR && window.R2_NAVEGADOR.apto === false;
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && !globalThis.R2_ARRANQUE_MANUAL && !noApto) {
    const empezar = () => iniciar({ ventana: window }).catch((e) => {
      console.error('Diarios Explorer: el arranque falló', e);
      try {
        const p = document.createElement('p');
        p.setAttribute('role', 'alert');
        p.style.cssText = 'position:fixed;inset:auto 16px 16px 16px;padding:12px 14px;background:#fff;color:#1d1b18;border:1px solid #c21d1d;border-radius:7px;font:14px/1.5 system-ui,sans-serif;z-index:100';
        p.textContent = `No se pudo iniciar Diarios Explorer: ${textoDe(e)}. Recargue la página o use Chrome, Edge, Firefox o Safari en una versión reciente.`;
        document.body.appendChild(p);
      } catch (e2) {   }
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', empezar, { once: true });
    else empezar();
  }
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/arranque.js

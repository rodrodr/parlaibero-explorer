/* ===== src/worker/ingesta.js ===== */
/* Diarios Explorer · worker/ingesta.js
 *
 * Orquesta la construcción de la base a partir del CSV: lectura por trozos, comprobación de bytes y de estructura,
 * huellas por trozo, inserción (filas, FTS5 y bloques de texto comprimidos), índices, optimización y facetas, con
 * progreso por fases.
 *
 * API
 *   R2.ingesta.construir(fuente, sqlite3, opciones) → Promise<{ db, informe, completarHuella }>
 *     fuente: { tamano, nombre, leerTrozo(offset, largo) → Uint8Array | ArrayBuffer | Promise de ellos }
 *     opciones:
 *       progreso(ev)       ev = { fase, etiqueta, indice (1–5), hecho, total }  (total null si no se sabe)
 *       verificarCambios   relee el archivo antes de seguir y compara las huellas por trozo (Firefox)
 *       sha256             'auto' (por defecto) | 'durante' | 'diferido'
 *       optimizar          'auto' (por defecto: solo si el texto no pasa de OPTIMIZAR_HASTA_BYTES) | true | false
 *       tamanoTrozo        bytes por lectura (16 MiB)
 *       pageSize           PRAGMA page_size (PAGE_SIZE)
 *   Si falla, rechaza con R2.errores.ErrorIngesta (codigo, mensaje, fila, linea, byte, columna, valor, detalle).
 *   completarHuella({ ceder }) → Promise<informe>: con la SHA-256 diferida, relee el archivo, comprueba las huellas por
 *     trozo (si no coinciden: ARCHIVO_ILEGIBLE) y rellena huella.sha256.
 *
 * Orden de comprobación: ARCHIVO_VACIO; en los primeros 64 KiB, ZIP, SQLite y NUL (NO_TEXTO); un BOM inicial se omite;
 * el primer defecto de byte (NO_UTF8 o NUL) de TODO el archivo; registro a registro, cabecera de más de 64 KiB
 * (COLUMNAS), TRUNCADO, cabecera (SEPARADOR, COLUMNAS), CAMPOS y ENTERO_NO_VALIDO. Las líneas vacías se omiten (aviso).
 */
(function (R2) {
  'use strict';

  const E = R2.errores, T = R2.transformar, C = R2.construir, F = R2.facetas, H = R2.sha256, TX = R2.texto;

  const MIB = 1024 * 1024;
  const TAMANO_TROZO = 16 * MIB;
  const VENTANA_SONDEO = 64 * 1024;
  const BYTES_POR_CESION = 2 * MIB;
  const PAGE_SIZE = 8192;
  const MS_ENTRE_LATIDOS = 100;
  /** Por encima de este tamaño de texto no se compacta el índice FTS (la compactación puede doblar su memoria un momento). */
  const OPTIMIZAR_HASTA_BYTES = 600 * MIB;

  const FASES = Object.freeze([
    { id: 'leer', etiqueta: 'Leyendo y comprobando el archivo' },
    { id: 'guardar', etiqueta: 'Guardando e indexando intervenciones' },
    { id: 'indices', etiqueta: 'Creando índices' },
    { id: 'optimizar', etiqueta: 'Compactando el índice de palabras' },
    { id: 'estadisticas', etiqueta: 'Estadísticas y filtros' },
    { id: 'expresiones', etiqueta: 'Detectando expresiones de varias palabras' },
  ]);
  const FASE = Object.fromEntries(FASES.map((f, i) => [f.id, { etiqueta: f.etiqueta, indice: i + 1 }]));

  // Latidos del progress handler medidos con un corpus de referencia (solo para estimar el total de la barra).
  const REFERENCIA = Object.freeze({ bytes_texto: 94000000, filas: 49077, optimizar: 320, estadisticas: 9600 });

  const FIRMAS_ZIP = [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]];
  const FIRMA_SQLITE = Array.from('SQLite format 3\0', (c) => c.charCodeAt(0));
  const FIRMA_BOM = [0xef, 0xbb, 0xbf];
  const SEPARADOR = 0x2c; // ','
  const SEPARADORES_ALTERNATIVOS = [';', '\t', '|'];
  const CABECERA = T.COLUMNAS_CSV.map((c) => new TextEncoder().encode(c));
  const CODIGOS_CON_LINEA = new Set(['NO_TEXTO', 'NO_UTF8', 'SEPARADOR', 'COLUMNAS', 'CAMPOS', 'TRUNCADO', 'ENTERO_NO_VALIDO']);
  const CODIGOS_DE_REGISTRO = new Set(['SEPARADOR', 'COLUMNAS', 'CAMPOS', 'TRUNCADO', 'ENTERO_NO_VALIDO']);

  const LIMITE_CABECERA = 64 * 1024;
  const MAX_CAMPOS_CITADOS = 20;
  const MAX_BYTES_POR_CAMPO_CITADO = 1024;
  /** Máximo del heap wasm de vendor/sqlite3.js (32.768 páginas de 64 KiB). */
  const LIMITE_HEAP_WASM = 2 ** 31;
  const UMBRAL_LIMITE_WASM = LIMITE_HEAP_WASM / 8 * 7;

  const ahora = () => performance.now();
  const empiezaPor = (u8, firma) => u8.length >= firma.length && firma.every((b, i) => u8[i] === b);
  const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

  /** leer(offset, largo) exacto: los fallos de lectura y los trozos cortos son ARCHIVO_ILEGIBLE. */
  function lectorExacto(fuente) {
    return async (offset, largo) => {
      let r;
      try {
        r = await fuente.leerTrozo(offset, largo);
      } catch (e) {
        if (e instanceof E.ErrorIngesta) throw e;
        if (E.esFaltaDeMemoria(e)) throw E.fallo('MEMORIA', { causa: E.textoDe(e) });
        throw E.fallo('ARCHIVO_ILEGIBLE', { byte: offset, causa: E.textoDe(e), detalle: { motivo: 'lectura' } });
      }
      const u8 = r instanceof Uint8Array ? r : new Uint8Array(r);
      if (u8.length !== largo) {
        throw E.fallo('ARCHIVO_ILEGIBLE', { byte: offset, causa: `se leyeron ${u8.length} de ${largo} bytes`, detalle: { motivo: 'corto' } });
      }
      return u8;
    };
  }

  /** Línea física (desde 1) en la que está el byte pos. Solo en errores. */
  async function lineaDeByte(leer, pos, trozo) {
    let saltos = 0, previoCR = false;
    for (let off = 0; off < pos; off += trozo) {
      const u8 = await leer(off, Math.min(trozo, pos - off));
      for (let i = 0; i < u8.length; i++) {
        const c = u8[i];
        if (c === 0x0d) saltos++;
        else if (c === 0x0a && !(i > 0 ? u8[i - 1] === 0x0d : previoCR)) saltos++;
      }
      previoCR = u8[u8.length - 1] === 0x0d;
    }
    return saltos + 1;
  }

  /** Sondeo del principio del archivo (hasta 64 KiB): ZIP, SQLite y NUL. Devuelve los bytes de BOM que hay que saltar. */
  function comprobarSondeo(sondeo) {
    if (FIRMAS_ZIP.some((f) => empiezaPor(sondeo, f))) throw E.fallo('NO_ES_CSV_ZIP', { byte: 0, linea: 1 });
    if (empiezaPor(sondeo, FIRMA_SQLITE)) throw E.fallo('NO_ES_CSV_SQLITE', { byte: 0, linea: 1 });
    const nul = sondeo.indexOf(0);
    if (nul >= 0) throw E.fallo('NO_TEXTO', { byte: nul });
    return empiezaPor(sondeo, FIRMA_BOM) ? 3 : 0;
  }

  /** Primer defecto de byte del trozo (UTF-8 no válido o NUL, el que aparezca antes). */
  function comprobarBytes(u8, offset, utf8, esUltimo) {
    const nul = u8.indexOf(0);
    const posNul = nul >= 0 ? offset + nul : -1;
    const malo = utf8.push(u8);
    if (malo >= 0 && (posNul < 0 || malo < posNul)) {
      const muestra = malo >= offset ? hex(u8.subarray(malo - offset, malo - offset + 4)) : null;
      throw E.fallo('NO_UTF8', { byte: malo, detalle: { bytes: muestra } });
    }
    if (posNul >= 0) throw E.fallo('NO_TEXTO', { byte: posNul });
    if (esUltimo) {
      const abierta = utf8.fin();
      if (abierta >= 0) throw E.fallo('NO_UTF8', { byte: abierta, detalle: { incompleto: true } });
    }
  }

  function primerRegistro(u8, separador) {
    let r = null;
    const l = new R2.csv.Lector((b, f, n) => { if (r === null) r = R2.csv.campos(b, f, n); }, separador);
    l.push(u8);
    if (r === null) l.fin();
    return r;
  }

  /** Los primeros campos de un registro como cadenas recortadas, para citarlos en un fallo. */
  function camposCitados(bytes, fines, n) {
    const td = new TextDecoder('utf-8', { ignoreBOM: true });
    const r = [];
    for (let k = 0; k < Math.min(n, MAX_CAMPOS_CITADOS); k++) {
      const a = k ? fines[k - 1] : 0;
      r.push(td.decode(bytes.subarray(a, Math.min(fines[k], a + MAX_BYTES_POR_CAMPO_CITADO))));
    }
    return r;
  }

  const cabeceraLarga = (byte) => E.fallo('COLUMNAS', {
    fila: 0, byte, detalle: { motivo: 'larga', limite: LIMITE_CABECERA, esperado: T.COLUMNAS_CSV.slice() },
  });

  /** Relee los trozos con huella; devuelve ARCHIVO_ILEGIBLE si alguno cambió o ya no se puede leer, o null. */
  async function trozoCambiado(leer, huellas, tamano, trozo) {
    for (let k = 0; k < huellas.length; k++) {
      const off = k * trozo;
      let u8;
      try {
        u8 = await leer(off, Math.min(trozo, tamano - off));
      } catch (e) {
        const err = E.normalizar(e);
        return err.codigo === 'ARCHIVO_ILEGIBLE' ? err : null;
      }
      if (H.huellaTrozo(u8) !== huellas[k]) return E.fallo('ARCHIVO_ILEGIBLE', { byte: off, detalle: { motivo: 'cambiado' } });
    }
    return null;
  }

  /** MEMORIA: ¿se llegó al máximo del heap wasm (el archivo no cabe) o falta memoria en el sistema? */
  function clasificarMemoria(err, sqlite3) {
    let heap = null;
    try { heap = sqlite3.wasm.heap8u().byteLength; } catch (e) { /* sin heap que medir */ }
    const motivo = heap !== null && heap >= UMBRAL_LIMITE_WASM ? 'limite_wasm' : 'sistema';
    err.detalle = Object.assign({}, err.detalle, { motivo, heap_wasm: heap, limite: LIMITE_HEAP_WASM });
    err.redactar();
  }

  /** La cabecera puede llevar los nombres entre comillas y espacios alrededor; el orden y los nombres son fijos. */
  function comprobarCabecera(bytes, fines, n, sondeo, byte) {
    const td = new TextDecoder('utf-8', { ignoreBOM: true });
    const recibidos = [];
    for (let k = 0; k < n; k++) recibidos.push(td.decode(bytes.subarray(k ? fines[k - 1] : 0, fines[k])).trim());
    const igual = n === CABECERA.length && recibidos.every((c, k) => c === T.COLUMNAS_CSV[k]);
    if (igual) return;
    if (n === 1) {
      for (const sep of SEPARADORES_ALTERNATIVOS) {
        const cabecera = primerRegistro(sondeo, sep.charCodeAt(0));
        if (cabecera && cabecera.length === CABECERA.length) {
          throw E.fallo('SEPARADOR', { fila: 0, byte, detalle: { separador: sep, cabecera } });
        }
      }
    }
    throw E.fallo('COLUMNAS', {
      fila: 0, byte, detalle: { esperado: T.COLUMNAS_CSV.slice(), recibido: camposCitados(bytes, fines, n), campos: n },
    });
  }

  const estimar = (referencia, base, valor) =>
    (referencia && base ? Math.max(1, Math.round(referencia * valor / base)) : null);

  const redondear = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 10) / 10]));

  async function construir(fuente, sqlite3, opciones = {}) {
    const progreso = typeof opciones.progreso === 'function' ? opciones.progreso : () => {};
    const trozo = opciones.tamanoTrozo || TAMANO_TROZO;
    const pageSize = opciones.pageSize || PAGE_SIZE;
    const verificar = !!opciones.verificarCambios;
    const tamano = fuente.tamano;
    const modoSha = opciones.sha256 || 'auto';
    if (!['auto', 'durante', 'diferido'].includes(modoSha)) throw new TypeError(`ingesta: sha256 no válido: ${modoSha}`);
    const diferirSha = modoSha === 'diferido' || (modoSha === 'auto' && tamano > trozo);
    const leer = lectorExacto(fuente);

    const emitir = (fase, hecho, total) =>
      progreso({ fase, etiqueta: FASE[fase].etiqueta, indice: FASE[fase].indice, hecho, total });
    const tInicio = ahora();
    const tiempos = { lectura: 0, huellas_y_sha256: 0, bytes: 0, csv_e_insercion: 0, compresion: 0 };

    if (!(tamano > 0)) throw E.fallo('ARCHIVO_VACIO');

    let db = null, ins = null, vigia = null, huellas = null;
    try {
      C.memoria(sqlite3, true); // el pico de SQLite cuenta desde aquí

      // ---------------------------------------------------------------- 1-2. leer, comprobar y guardar
      const totalLeer = verificar ? 2 * tamano : tamano;
      emitir('leer', 0, totalLeer);
      const sondeo = await leer(0, Math.min(VENTANA_SONDEO, tamano));
      const saltarBom = comprobarSondeo(sondeo);

      db = C.abrirBase(sqlite3, { pageSize });
      ins = new C.Insertador(sqlite3, db);
      emitir('guardar', 0, null);
      const utf8 = new R2.csv.ValidadorUtf8();
      const sha = diferirSha ? null : new H.Sha256();
      huellas = verificar || diferirSha ? [] : null;
      let lineasVacias = 0, primeraVacia = null;
      const lector = new R2.csv.Lector((bytes, fines, n, fila, byte) => {
        if (fila === 0 && n > 0 && fines[n - 1] > LIMITE_CABECERA) throw cabeceraLarga(byte);
        if (lector.truncado) throw E.fallo('TRUNCADO', { fila, byte });
        if (n === 0) { lineasVacias++; if (primeraVacia === null) primeraVacia = fila; return; }
        if (fila === 0) comprobarCabecera(bytes, fines, n, sondeo, byte);
        else if (n !== CABECERA.length) throw E.fallo('CAMPOS', { fila, byte, detalle: { campos: n, esperados: CABECERA.length } });
        else ins.insertar(bytes, fines, fila, byte);
      }, SEPARADOR);

      /** Tras un fallo de registro: comprueba los bytes del resto del archivo (lanza NO_UTF8 o NO_TEXTO si hay). */
      const comprobarBytesDelResto = async (desde) => {
        for (let off = desde; off < tamano; off += trozo) {
          const largo = Math.min(trozo, tamano - off);
          const u8 = await leer(off, largo);
          if (huellas) huellas.push(H.huellaTrozo(u8));
          comprobarBytes(u8, off, utf8, off + largo === tamano);
          emitir('leer', off + largo, totalLeer);
        }
      };

      const tLeerGuardar = ahora();
      for (let off = 0; off < tamano; off += trozo) {
        const largo = Math.min(trozo, tamano - off), fin = off + largo, esUltimo = fin === tamano;
        let t = ahora();
        const u8 = await leer(off, largo);
        tiempos.lectura += ahora() - t;
        t = ahora();
        if (huellas) huellas.push(H.huellaTrozo(u8));
        if (sha) sha.update(u8);
        tiempos.huellas_y_sha256 += ahora() - t;
        t = ahora();
        comprobarBytes(u8, off, utf8, esUltimo);
        tiempos.bytes += ahora() - t;
        t = ahora();
        try {
          lector.push(off === 0 && saltarBom ? u8.subarray(saltarBom) : u8);
          if (lector.registros === 0 && lector.pos > LIMITE_CABECERA) throw cabeceraLarga(lector.byteInicio);
          if (esUltimo) lector.fin();
        } catch (e) {
          if (e instanceof E.ErrorIngesta && CODIGOS_DE_REGISTRO.has(e.codigo) && !esUltimo) await comprobarBytesDelResto(fin);
          throw e;
        }
        tiempos.csv_e_insercion += ahora() - t;
        t = ahora();
        await ins.volcarBloques();
        tiempos.compresion += ahora() - t;
        emitir('leer', fin, totalLeer);
        emitir('guardar', ins.insertadas, esUltimo ? ins.insertadas : Math.round(ins.insertadas * tamano / fin));
      }

      if (verificar) {
        const t = ahora();
        for (let k = 0, off = 0; off < tamano; k++, off += trozo) {
          const largo = Math.min(trozo, tamano - off);
          const u8 = await leer(off, largo);
          if (H.huellaTrozo(u8) !== huellas[k]) {
            throw E.fallo('ARCHIVO_ILEGIBLE', { byte: off, detalle: { motivo: 'cambiado' } });
          }
          emitir('leer', tamano + off + largo, totalLeer);
        }
        tiempos.verificacion = ahora() - t;
      }

      const t2 = ahora();
      await ins.terminar();
      tiempos.compresion += ahora() - t2;
      const distintos = ins.distintos();
      const n = ins.insertadas, bytesTexto = ins.bytesTexto, bytesComprimidos = ins.bytesComprimidos, nBloques = ins.nBloques;
      const nSesiones = ins.sesiones.size, pais = ins.pais, filasDoc = ins.filasDoc, sinCompresion = ins.sinCompresion;
      tiempos.leer_y_guardar = ahora() - tLeerGuardar;
      emitir('guardar', n, n);

      const sha256 = sha ? sha.hex() : null;
      const avisos = [];
      if (lineasVacias) avisos.push(E.aviso('LINEAS_VACIAS', { n: lineasVacias, primera_fila: primeraVacia }));
      if (sinCompresion) avisos.push(E.aviso('SIN_COMPRESION', {}));

      // ---------------------------------------------------------------- 3. índices
      let t = ahora();
      emitir('indices', 0, C.INDICES.length);
      C.crearIndices(db, (k, total) => emitir('indices', k, total));
      tiempos.indices = ahora() - t;

      // ---------------------------------------------------------------- 4-5. optimizar y estadísticas, con latidos
      const latidos = {};
      let fase = null, cuenta = 0, total = null, ultimoLatido = 0;
      vigia = C.vigilar(sqlite3, db, () => {
        cuenta++;
        const ya = ahora();
        if (ya - ultimoLatido >= MS_ENTRE_LATIDOS) {
          ultimoLatido = ya;
          emitir(fase, total ? Math.min(cuenta, total - 1) : cuenta, total);
        }
      });
      const paso = (id, estimado, fn) => {
        fase = id; cuenta = 0; total = estimado; ultimoLatido = ahora();
        emitir(id, 0, total);
        const t0 = ahora();
        fn();
        tiempos[id] = ahora() - t0;
        latidos[id] = cuenta;
        emitir(id, total || cuenta, total || cuenta);
      };
      const optimizar = opciones.optimizar === undefined || opciones.optimizar === 'auto'
        ? bytesTexto <= OPTIMIZAR_HASTA_BYTES : !!opciones.optimizar;
      if (optimizar) paso('optimizar', estimar(REFERENCIA.optimizar, REFERENCIA.bytes_texto, bytesTexto), () => C.optimizar(db));
      else { emitir('optimizar', 1, 1); avisos.push(E.aviso('SIN_OPTIMIZAR', { bytes: bytesTexto })); }
      let facetas = null;
      paso('estadisticas', estimar(REFERENCIA.estadisticas, REFERENCIA.filas, n), () => {
        let t1 = ahora();
        C.analizar(db);
        tiempos.analizar = ahora() - t1;
        t1 = ahora();
        facetas = F.calcular(db);
        C.escribirMeta(db, F.aJson(facetas), n, { n_sessions: nSesiones, pais: pais || '' });
        tiempos.facetas = ahora() - t1;
      });
      vigia.parar();
      vigia = null;

      // ---------------------------------------------------------------- 6. expresiones de varias palabras
      // Se detectan una vez, con la estadística de todo el corpus (R2.expresiones), y se guardan en la base. Un fallo
      // aquí no impide abrir el corpus: queda un aviso y el léxico y las coocurrencias trabajan con palabras sueltas.
      let expresiones = null;
      if (opciones.expresiones !== false && R2.expresiones) {
        const tE = ahora();
        emitir('expresiones', 0, 1);
        try {
          expresiones = await R2.expresiones.detectar({ db, sqlite3, pais: pais || '', alProgreso: (h, t) => emitir('expresiones', h, t) });
        } catch (e) {
          avisos.push(E.aviso('SIN_EXPRESIONES', { error: e && e.message ? e.message : String(e) }));
        }
        tiempos.expresiones = ahora() - tE;
        emitir('expresiones', 1, 1);
      } else emitir('expresiones', 1, 1);
      tiempos.hasta_listo = ahora() - tInicio;

      const memoria = C.memoria(sqlite3);
      const informe = {
        n_filas: n,
        n_sesiones: nSesiones,
        n_doc: filasDoc,
        pais: pais || null,
        duplicadas: 0,
        huella: { bytes: tamano, sha256, nombre: fuente.nombre != null ? fuente.nombre : null },
        publicado: null,
        version_csv: null,
        correcciones_fechas: null,
        avisos,
        tiempos: redondear(tiempos),
        memoria: { wasm_bytes: memoria.wasm_bytes, sqlite_highwater: memoria.sqlite_highwater },
        detalles: {
          sqlite: sqlite3.version.libVersion,
          page_size: pageSize,
          tamano_trozo: trozo,
          sha256: diferirSha ? 'diferido' : 'durante',
          verificar_cambios: verificar,
          bytes_texto: bytesTexto,
          bytes_texto_comprimido: bytesComprimidos,
          bloques: nBloques,
          formato_texto: C.FORMATO_TEXTO,
          optimizado: optimizar,
          expresiones,
          valores_distintos: distintos,
          latidos,
        },
      };

      let completando = null;
      const completarHuella = ({ ceder } = {}) => {
        if (informe.huella.sha256 !== null) return Promise.resolve(informe);
        if (!completando) {
          completando = (async () => {
            const t0 = ahora();
            const h = new H.Sha256();
            for (let k = 0, off = 0; off < tamano; k++, off += trozo) {
              const largo = Math.min(trozo, tamano - off);
              const u8 = await leer(off, largo);
              if (H.huellaTrozo(u8) !== huellas[k]) {
                throw E.fallo('ARCHIVO_ILEGIBLE', { byte: off, detalle: { motivo: 'cambiado' } });
              }
              for (let p = 0; p < largo; p += BYTES_POR_CESION) {
                h.update(u8.subarray(p, Math.min(largo, p + BYTES_POR_CESION)));
                if (ceder) await ceder();
              }
            }
            informe.huella.sha256 = h.hex();
            informe.tiempos.sha256_diferida = Math.round((ahora() - t0) * 10) / 10;
            return informe;
          })();
          completando.catch(() => { completando = null; });
        }
        return completando;
      };

      return { db, informe, completarHuella };
    } catch (e) {
      if (vigia) { try { vigia.parar(); } catch (e2) { /* la base puede estar ya cerrada */ } }
      if (ins) ins.cerrar();
      if (db) { try { db.close(); } catch (e2) { /* ya cerrada */ } }
      let err = E.normalizar(e);
      if (huellas && huellas.length && CODIGOS_CON_LINEA.has(err.codigo)) {
        const cambio = await trozoCambiado(leer, huellas, tamano, trozo);
        if (cambio) err = cambio;
      }
      if (err.codigo === 'MEMORIA') clasificarMemoria(err, sqlite3);
      if (err.linea === null && err.byte !== null && CODIGOS_CON_LINEA.has(err.codigo)) {
        try {
          err.linea = await lineaDeByte(leer, err.byte, trozo);
          err.redactar();
        } catch (e2) { /* sin línea si el archivo ya no se puede leer */ }
      }
      throw err;
    }
  }

  R2.ingesta = { FASES, TAMANO_TROZO, VENTANA_SONDEO, PAGE_SIZE, REFERENCIA, LIMITE_CABECERA, LIMITE_HEAP_WASM, OPTIMIZAR_HASTA_BYTES, construir };
})(globalThis.R2 = globalThis.R2 || {});

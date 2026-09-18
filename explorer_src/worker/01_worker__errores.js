/* ===== src/worker/errores.js ===== */
/* Diarios Explorer · worker/errores.js
 *
 * Códigos de fallo y de aviso de la ingesta del CSV, con su mensaje en español.
 *
 * - Un FALLO detiene la construcción: se lanza como ErrorIngesta con
 *   {codigo, mensaje, fila, linea, byte, columna, valor, detalle, causa}.
 * - Un AVISO no la detiene: es un objeto {codigo, mensaje, ...datos} que va en informe.avisos.
 *
 * Ubicación:
 * - fila: número de registro (0 = cabecera, 1 = primer registro de datos; una línea vacía cuenta).
 * - linea: línea física donde empieza el registro, desde 1 (cuentan \r\n, \r y \n, también entre comillas).
 * - byte: desplazamiento desde 0 del inicio del registro o, en NUL y UTF-8, del byte culpable.
 */
(function (R2) {
  'use strict';

  const CSV = 'el CSV de intervenciones de un país (por ejemplo ES_interventions.csv)';

  /** Número con punto de miles: 165785782 → «165.785.782». */
  function miles(n) {
    if (typeof n !== 'number' && typeof n !== 'bigint') return String(n);
    const t = String(n);
    const signo = t[0] === '-' ? '-' : '';
    return signo + t.slice(signo.length).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /** Recorta un valor para citarlo en un mensaje. */
  function cita(valor, max = 60) {
    const s = String(valor);
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  const donde = (d) => {
    const partes = [];
    if (d.fila != null) partes.push(`fila ${miles(d.fila)}`);
    if (d.linea != null) partes.push(`línea ${miles(d.linea)}`);
    return partes.length ? ` (${partes.join(', ')})` : '';
  };

  const NOMBRE_SEPARADOR = { ';': 'puntos y coma (;)', '\t': 'tabuladores', '|': 'barras verticales (|)' };

  const FALLOS = {
    ARCHIVO_VACIO: () =>
      `El archivo está vacío (0 bytes). Elija ${CSV}.`,
    NO_ES_CSV_ZIP: () =>
      'El archivo es un ZIP comprimido, no el CSV. Descomprímalo y elija el archivo CSV que contiene.',
    NO_ES_CSV_SQLITE: () =>
      `El archivo es una base de datos SQLite, no el CSV. Esta aplicación se construye a partir de ${CSV}.`,
    NO_TEXTO: (d) =>
      `El archivo no es un CSV de texto: contiene datos binarios (byte nulo en la posición ${miles(d.byte)}${d.linea != null ? `, línea ${miles(d.linea)}` : ''}). Elija ${CSV}.`,
    NO_UTF8: (d) => ((d.detalle && d.detalle.incompleto)
      ? 'El archivo termina en mitad de un carácter UTF-8: está incompleto. Vuelva a copiarlo o a generarlo.'
      : `El archivo no está codificado en UTF-8 (byte ${miles(d.byte)}${d.linea != null ? `, línea ${miles(d.linea)}` : ''}). Guárdelo como «UTF-8» y vuelva a elegirlo.`),
    SEPARADOR: (d) =>
      `Las columnas del archivo están separadas por ${NOMBRE_SEPARADOR[d.detalle.separador] || `«${d.detalle.separador}»`} y deben estarlo por comas (,). Suele pasar al guardarlo con una hoja de cálculo: exporte el CSV de nuevo con comas.`,
    COLUMNAS: (d) => ((d.detalle && d.detalle.motivo === 'larga')
      ? `La cabecera no tiene las columnas esperadas: la primera línea del archivo ocupa más de ${miles(d.detalle.limite)} bytes y la de un CSV de intervenciones, menos de 300, así que no es un CSV del corpus. Elija ${CSV}.`
      : `La cabecera no tiene las columnas esperadas. Esperadas (${d.detalle.esperado.length}): ${d.detalle.esperado.join(', ')}. Recibidas (${miles(d.detalle.campos != null ? d.detalle.campos : d.detalle.recibido.length)}): ${cita(d.detalle.recibido.join(', '), 300)}.`),
    CAMPOS: (d) =>
      `Un registro tiene ${d.detalle.campos} ${d.detalle.campos === 1 ? 'campo' : 'campos'} y debe tener ${d.detalle.esperados}${donde(d)}.`,
    TRUNCADO: (d) =>
      `El archivo termina dentro de un texto entre comillas${donde(d)}: está incompleto, quizá porque la copia se interrumpió. Vuelva a copiarlo.`,
    ENTERO_NO_VALIDO: (d) => {
      const lugar = `Columna «${d.columna}»${donde(d)}`;
      const motivo = d.detalle && d.detalle.motivo;
      if (motivo === 'rango') return `${lugar}: el número «${cita(d.valor)}» es demasiado grande para guardarlo.`;
      if (motivo === 'limite') return `${lugar}: el número tiene más de 4.300 cifras.`;
      if (motivo === 'suma') return `${lugar}: la suma de palabras es demasiado grande para guardarla (no cabe en un entero de 64 bits).`;
      return `${lugar}: «${cita(d.valor)}» no es un número entero válido.`;
    },
    ARCHIVO_ILEGIBLE: (d) => ((d.detalle && d.detalle.motivo === 'cambiado')
      ? `El archivo ha cambiado en disco mientras se leía (el tramo que empieza en el byte ${miles(d.byte)} ya no coincide). Vuelva a elegirlo.`
      : `No se pudo leer el archivo (byte ${miles(d.byte)}): ha cambiado en disco, se ha movido o ya no hay permiso para leerlo. Vuelva a elegirlo.`),
    MEMORIA: (d) => ((d.detalle && d.detalle.motivo === 'limite_wasm')
      ? `No hay memoria suficiente para construir el corpus: se ha llegado al máximo de ${miles(Math.round(d.detalle.limite / 1048576))} MiB que el navegador permite a WebAssembly${donde(d)}. Cerrar otras pestañas no lo resuelve: el archivo es demasiado grande para este motor. Pruebe con un CSV más pequeño (por ejemplo, con menos legislaturas).`
      : 'No hay memoria suficiente para construir el corpus. Cierre otras pestañas o aplicaciones y vuelva a intentarlo.'),
    ERROR_INTERNO: (d) =>
      `Error interno al construir el corpus: ${cita(d.causa, 300)}`,
  };

  const AVISOS = {
    LINEAS_VACIAS: (d) =>
      `Se han omitido ${miles(d.n)} ${d.n === 1 ? 'línea vacía' : 'líneas vacías'} del archivo (la primera, en la fila ${miles(d.primera_fila)}).`,
    SIN_COMPRESION: () =>
      'Este navegador no puede comprimir el texto al construir la base (falta CompressionStream): el corpus ocupa más memoria de la habitual.',
    SIN_OPTIMIZAR: (d) =>
      `El índice de palabras no se ha compactado para ahorrar memoria (el texto ocupa ${miles(Math.round(d.bytes / 1048576))} MiB): las búsquedas funcionan igual, algo más lentas.`,
  };

  const CAMPOS_UBICACION = ['fila', 'linea', 'byte', 'columna', 'valor', 'detalle', 'causa'];

  class ErrorIngesta extends Error {
    constructor(codigo, datos) {
      const plantilla = FALLOS[codigo];
      if (!plantilla) throw new TypeError(`Código de fallo desconocido: ${codigo}`);
      const d = Object.assign({}, datos);
      super(plantilla(d));
      this.name = 'ErrorIngesta';
      this.codigo = codigo;
      for (const k of CAMPOS_UBICACION) this[k] = d[k] != null ? d[k] : null;
      if (this.causa !== null) this.causa = String(this.causa);
    }

    /** Vuelve a redactar el mensaje (tras completar la línea, por ejemplo). */
    redactar() {
      this.message = FALLOS[this.codigo](this);
      return this;
    }

    /** Objeto clonable para postMessage (fallo_construccion). */
    aObjeto() {
      const o = { codigo: this.codigo, mensaje: this.message };
      for (const k of CAMPOS_UBICACION) o[k] = this[k];
      return o;
    }
  }

  function fallo(codigo, datos) {
    return new ErrorIngesta(codigo, datos);
  }

  /** Aviso {codigo, mensaje, ...datos}. */
  function aviso(codigo, datos, ctx) {
    const plantilla = AVISOS[codigo];
    if (!plantilla) throw new TypeError(`Código de aviso desconocido: ${codigo}`);
    return Object.assign({ codigo, mensaje: plantilla(datos || {}, ctx || {}) }, datos);
  }

  const textoDe = (e) => (e && e.name && e.message ? `${e.name}: ${e.message}` : String(e));

  function esFaltaDeMemoria(e) {
    if (!e) return false;
    if (e.name === 'WasmAllocError' || e.resultCode === 7 /* SQLITE_NOMEM */) return true;
    const m = String(e.message || e);
    if (e instanceof RangeError && /alloc|memory|typed array length/i.test(m)) return true;
    return /out of memory|SQLITE_NOMEM/i.test(m);
  }

  /** Convierte cualquier excepción en ErrorIngesta (MEMORIA o ERROR_INTERNO si no lo era ya). */
  function normalizar(e) {
    if (e instanceof ErrorIngesta) return e;
    if (esFaltaDeMemoria(e)) return new ErrorIngesta('MEMORIA', { causa: textoDe(e) });
    return new ErrorIngesta('ERROR_INTERNO', { causa: textoDe(e) });
  }

  R2.errores = {
    CODIGOS_FALLO: Object.freeze(Object.keys(FALLOS)),
    CODIGOS_AVISO: Object.freeze(Object.keys(AVISOS)),
    ErrorIngesta,
    fallo,
    aviso,
    normalizar,
    esFaltaDeMemoria,
    textoDe,
    miles,
  };
})(globalThis.R2 = globalThis.R2 || {});

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

  const CSV = N_('el CSV de intervenciones de un país (por ejemplo ES_interventions.csv)');

  /** Número con punto de miles: 165785782 → «165.785.782». */
  function miles(n) {
    if (typeof n !== 'number' && typeof n !== 'bigint') return String(n);
    if (typeof n === 'number' ? Number.isSafeInteger(n) : (n <= Number.MAX_SAFE_INTEGER && n >= -Number.MAX_SAFE_INTEGER)) return __.num(n);
    const t = String(n);
    const signo = t[0] === '-' ? '-' : '';
    return signo + t.slice(signo.length).replace(/\B(?=(\d{3})+(?!\d))/g, __.num(1000).replace(/\d/g, ''));
  }

  /** Recorta un valor para citarlo en un mensaje. */
  function cita(valor, max = 60) {
    const s = String(valor);
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  const donde = (d) => {
    const partes = [];
    if (d.fila != null) partes.push(__('fila {0}', miles(d.fila)));
    if (d.linea != null) partes.push(__('línea {0}', miles(d.linea)));
    return partes.length ? ` (${partes.join(', ')})` : '';
  };

  const NOMBRE_SEPARADOR = { ';': N_('puntos y coma (;)'), '\t': N_('tabuladores'), '|': N_('barras verticales (|)') };

  const FALLOS = {
    ARCHIVO_VACIO: () =>
      __('El archivo está vacío (0 bytes). Elija {0}.', __(CSV)),
    NO_ES_CSV_ZIP: () =>
      __('El archivo es un ZIP comprimido, no el CSV. Descomprímalo y elija el archivo CSV que contiene.'),
    NO_ES_CSV_SQLITE: () =>
      __('El archivo es una base de datos SQLite, no el CSV. Esta aplicación se construye a partir de {0}.', __(CSV)),
    NO_TEXTO: (d) =>
      (d.linea != null
        ? __('El archivo no es un CSV de texto: contiene datos binarios (byte nulo en la posición {0}, línea {1}). Elija {2}.', miles(d.byte), miles(d.linea), __(CSV))
        : __('El archivo no es un CSV de texto: contiene datos binarios (byte nulo en la posición {0}). Elija {1}.', miles(d.byte), __(CSV))),
    NO_UTF8: (d) => ((d.detalle && d.detalle.incompleto)
      ? __('El archivo termina en mitad de un carácter UTF-8: está incompleto. Vuelva a copiarlo o a generarlo.')
      : (d.linea != null
        ? __('El archivo no está codificado en UTF-8 (byte {0}, línea {1}). Guárdelo como «UTF-8» y vuelva a elegirlo.', miles(d.byte), miles(d.linea))
        : __('El archivo no está codificado en UTF-8 (byte {0}). Guárdelo como «UTF-8» y vuelva a elegirlo.', miles(d.byte)))),
    SEPARADOR: (d) =>
      __('Las columnas del archivo están separadas por {0} y deben estarlo por comas (,). Suele pasar al guardarlo con una hoja de cálculo: exporte el CSV de nuevo con comas.',
        NOMBRE_SEPARADOR[d.detalle.separador] ? __(NOMBRE_SEPARADOR[d.detalle.separador]) : `«${d.detalle.separador}»`),
    COLUMNAS: (d) => ((d.detalle && d.detalle.motivo === 'larga')
      ? __('La cabecera no tiene las columnas esperadas: la primera línea del archivo ocupa más de {0} bytes y la de un CSV de intervenciones, menos de 300, así que no es un CSV del corpus. Elija {1}.', miles(d.detalle.limite), __(CSV))
      : __('La cabecera no tiene las columnas esperadas. Esperadas ({0}): {1}. Recibidas ({2}): {3}.', d.detalle.esperado.length, d.detalle.esperado.join(', '), miles(d.detalle.campos != null ? d.detalle.campos : d.detalle.recibido.length), cita(d.detalle.recibido.join(', '), 300))),
    CAMPOS: (d) =>
      (d.detalle.campos === 1
        ? __('Un registro tiene {0} campo y debe tener {1}{2}.', d.detalle.campos, d.detalle.esperados, donde(d))
        : __('Un registro tiene {0} campos y debe tener {1}{2}.', d.detalle.campos, d.detalle.esperados, donde(d))),
    TRUNCADO: (d) =>
      __('El archivo termina dentro de un texto entre comillas{0}: está incompleto, quizá porque la copia se interrumpió. Vuelva a copiarlo.', donde(d)),
    ENTERO_NO_VALIDO: (d) => {
      const lugar = __('Columna «{0}»{1}', d.columna, donde(d));
      const motivo = d.detalle && d.detalle.motivo;
      if (motivo === 'rango') return __('{0}: el número «{1}» es demasiado grande para guardarlo.', lugar, cita(d.valor));
      if (motivo === 'limite') return __('{0}: el número tiene más de {1} cifras.', lugar, miles(4300));
      if (motivo === 'suma') return __('{0}: la suma de palabras es demasiado grande para guardarla (no cabe en un entero de 64 bits).', lugar);
      return __('{0}: «{1}» no es un número entero válido.', lugar, cita(d.valor));
    },
    ARCHIVO_ILEGIBLE: (d) => ((d.detalle && d.detalle.motivo === 'cambiado')
      ? __('El archivo ha cambiado en disco mientras se leía (el tramo que empieza en el byte {0} ya no coincide). Vuelva a elegirlo.', miles(d.byte))
      : __('No se pudo leer el archivo (byte {0}): ha cambiado en disco, se ha movido o ya no hay permiso para leerlo. Vuelva a elegirlo.', miles(d.byte))),
    MEMORIA: (d) => ((d.detalle && d.detalle.motivo === 'limite_wasm')
      ? __('No hay memoria suficiente para construir el corpus: se ha llegado al máximo de {0} MiB que el navegador permite a WebAssembly{1}. Cerrar otras pestañas no lo resuelve: el archivo es demasiado grande para este motor. Pruebe con un CSV más pequeño (por ejemplo, con menos legislaturas).', miles(Math.round(d.detalle.limite / 1048576)), donde(d))
      : __('No hay memoria suficiente para construir el corpus. Cierre otras pestañas o aplicaciones y vuelva a intentarlo.')),
    ERROR_INTERNO: (d) =>
      __('Error interno al construir el corpus: {0}', cita(d.causa, 300)),
  };

  const AVISOS = {
    LINEAS_VACIAS: (d) =>
      (d.n === 1
        ? __('Se han omitido {0} línea vacía del archivo (la primera, en la fila {1}).', miles(d.n), miles(d.primera_fila))
        : __('Se han omitido {0} líneas vacías del archivo (la primera, en la fila {1}).', miles(d.n), miles(d.primera_fila))),
    SIN_COMPRESION: () =>
      __('Este navegador no puede comprimir el texto al construir la base (falta CompressionStream): el corpus ocupa más memoria de la habitual.'),
    SIN_OPTIMIZAR: (d) =>
      __('El índice de palabras no se ha compactado para ahorrar memoria (el texto ocupa {0} MiB): las búsquedas funcionan igual, algo más lentas.', miles(Math.round(d.bytes / 1048576))),
    SIN_EXPRESIONES: (d) =>
      __('No se pudieron detectar las expresiones de varias palabras ({0}): el léxico y las coocurrencias funcionan solo con palabras sueltas.', d.error || __('error desconocido')),
    PARTIDOS_FUERA_DE_REGISTRO: (d) => {
      const filas = d.filas === 1 ? __('{0} fila', miles(d.filas)) : __('{0} filas', miles(d.filas));
      const ejemplos = (d.ejemplos || []).map((x) => `«${cita(x, 60)}»`).join(', ');
      return d.n === 1
        ? __('Una etiqueta de partido del archivo no está en la tabla de partidos homogéneos de este país ({0}; {1}): se muestran tal como vienen. Puede ser una versión del CSV posterior a la tabla.', filas, ejemplos)
        : __('{0} etiquetas de partido del archivo no están en la tabla de partidos homogéneos de este país ({1}; {2}): se muestran tal como vienen. Puede ser una versión del CSV posterior a la tabla.', miles(d.n), filas, ejemplos);
    },
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

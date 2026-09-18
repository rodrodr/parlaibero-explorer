/* ===== src/worker/csv.js ===== */
/* 2REP_Standalone · worker/csv.js
 *
 * Lectura del CSV a nivel de byte, sin construir cadenas del archivo.
 *
 * Lector: máquina de estados con la semántica del módulo csv de Python 3.12 tal como lo usa
 * tools/build_corpus.py: csv.reader(f, delimiter=';', quotechar='"') sobre open(..., newline='')
 * (doublequote=True, strict=False; fin de registro CR, LF o CRLF). Referencia: Modules/_csv.c
 * (parse_process_char y Reader_iternext).
 * - Una línea en blanco produce un registro sin campos (Python devuelve []).
 * - Dentro de comillas, CR y LF son datos; "" es una comilla.
 * - No estricto: '"ab"cd' da 'abcd' y una comilla dentro de un campo sin comillas es literal.
 * - Fin de archivo dentro de comillas: Python guarda el campo y devuelve el registro; aquí se hace lo
 *   mismo, pero antes se marca `truncado`, porque la ingesta lo trata como fallo (TRUNCADO).
 * - El separador y la comilla son ASCII y nunca aparecen dentro de una secuencia UTF-8 multibyte:
 *   trabajar con bytes equivale a trabajar con caracteres.
 * El estado se conserva entre trozos, así que no hay que arrastrar la cola del registro incompleto.
 * alRegistro(bytes, fines, nCampos, indice, byteInicio): el campo k son los bytes
 * bytes[k ? fines[k-1] : 0 .. fines[k]). Los búferes se reutilizan: copie lo que necesite conservar.
 * Si alRegistro lanza, la excepción sale de push()/fin() y el lector queda inservible.
 *
 * ValidadorUtf8: validación incremental equivalente al códec UTF-8 estricto de Python (y a TextDecoder
 * con fatal): rechaza sobrelargas, sustitutos, > U+10FFFF, continuaciones sueltas y secuencias
 * truncadas. Devuelve el byte donde empieza la secuencia no válida (UnicodeDecodeError.start). Medido en
 * Chromium, Firefox y WebKit, es tan rápido como TextDecoder o más, y no crea cadenas.
 */
(function (R2) {
  'use strict';

  const INICIO_REGISTRO = 0, INICIO_CAMPO = 1, SIN_COMILLAS = 2, CON_COMILLAS = 3, COMILLA_EN_COMILLAS = 4, TRAS_CR = 5;
  const COMILLA = 0x22, LF = 0x0a, CR = 0x0d;

  class Lector {
    /**
     * @param {Function} alRegistro
     * @param {number} [separador=0x3b] byte del separador (';')
     */
    constructor(alRegistro, separador = 0x3b) {
      this.alRegistro = alRegistro;
      this.separador = separador;
      this.bytes = new Uint8Array(1 << 20); // contenido de los campos del registro en curso
      this.pos = 0;
      this.fines = new Int32Array(32);
      this.nCampos = 0;
      this.estado = INICIO_REGISTRO;
      this.registros = 0; // registros emitidos (incluida la cabecera)
      this.leidos = 0; // bytes recibidos
      this.byteInicio = 0; // desplazamiento del registro en curso
      this.truncado = false;
    }

    _crecer(necesario) {
      let n = this.bytes.length;
      while (n < necesario) n *= 2;
      const nuevo = new Uint8Array(n);
      nuevo.set(this.bytes.subarray(0, this.pos));
      this.bytes = nuevo;
    }

    _anadir(b, a, z) {
      const n = z - a;
      if (n <= 0) return;
      if (this.pos + n > this.bytes.length) this._crecer(this.pos + n);
      if (n < 24) {
        const dest = this.bytes;
        let p = this.pos;
        for (let k = a; k < z; k++) dest[p++] = b[k];
        this.pos = p;
      } else {
        this.bytes.set(b.subarray(a, z), this.pos);
        this.pos += n;
      }
    }

    _guardarCampo() {
      if (this.nCampos >= this.fines.length) {
        const f = new Int32Array(this.fines.length * 2);
        f.set(this.fines);
        this.fines = f;
      }
      this.fines[this.nCampos++] = this.pos;
    }

    _emitir() {
      const indice = this.registros++;
      const n = this.nCampos;
      this.nCampos = 0;
      this.pos = 0;
      this.alRegistro(this.bytes, this.fines, n, indice, this.byteInicio);
    }

    /** Procesa un trozo (Uint8Array). */
    push(buf) {
      const SEP = this.separador;
      const n = buf.length, base = this.leidos;
      let i = 0, st = this.estado;
      this.leidos += n;
      while (i < n) {
        switch (st) {
          case TRAS_CR:
            // El registro ya se emitió al ver CR; un LF inmediato es parte del mismo fin de línea.
            if (buf[i] === LF) i++;
            st = INICIO_REGISTRO;
            break;
          case INICIO_REGISTRO: {
            const c = buf[i];
            this.byteInicio = base + i;
            if (c === LF) { i++; this.estado = st; this._emitir(); }
            else if (c === CR) { i++; st = TRAS_CR; this.estado = st; this._emitir(); }
            else st = INICIO_CAMPO;
            break;
          }
          case INICIO_CAMPO: {
            const c = buf[i];
            if (c === COMILLA) { st = CON_COMILLAS; i++; }
            else if (c === SEP) { this._guardarCampo(); i++; }
            else if (c === LF || c === CR) {
              this._guardarCampo(); i++;
              st = c === CR ? TRAS_CR : INICIO_REGISTRO;
              this.estado = st; this._emitir();
            } else st = SIN_COMILLAS;
            break;
          }
          case SIN_COMILLAS: {
            let j = i;
            while (j < n) {
              const c = buf[j];
              if (c === SEP || c === LF || c === CR) break;
              j++;
            }
            this._anadir(buf, i, j);
            i = j;
            if (j < n) {
              const c = buf[j];
              this._guardarCampo(); i++;
              if (c === SEP) st = INICIO_CAMPO;
              else { st = c === CR ? TRAS_CR : INICIO_REGISTRO; this.estado = st; this._emitir(); }
            }
            break;
          }
          case CON_COMILLAS: {
            const j = buf.indexOf(COMILLA, i);
            if (j < 0) { this._anadir(buf, i, n); i = n; }
            else { this._anadir(buf, i, j); i = j + 1; st = COMILLA_EN_COMILLAS; }
            break;
          }
          case COMILLA_EN_COMILLAS: {
            const c = buf[i];
            if (c === COMILLA) {
              if (this.pos + 1 > this.bytes.length) this._crecer(this.pos + 1);
              this.bytes[this.pos++] = COMILLA;
              i++; st = CON_COMILLAS;
            } else if (c === SEP) { this._guardarCampo(); i++; st = INICIO_CAMPO; }
            else if (c === LF || c === CR) {
              this._guardarCampo(); i++;
              st = c === CR ? TRAS_CR : INICIO_REGISTRO;
              this.estado = st; this._emitir();
            } else st = SIN_COMILLAS; // no estricto: el carácter se añade como dato sin comillas
            break;
          }
        }
      }
      this.estado = st;
    }

    /** Fin del archivo: emite el último registro si quedó abierto. */
    fin() {
      const st = this.estado;
      this.estado = INICIO_REGISTRO;
      if (st === CON_COMILLAS) this.truncado = true;
      if (st === INICIO_CAMPO || st === SIN_COMILLAS || st === COMILLA_EN_COMILLAS || st === CON_COMILLAS) {
        this._guardarCampo();
        this._emitir();
      }
    }
  }

  /** Campos de un registro como cadenas (para mensajes y pruebas; no se usa al insertar). */
  function campos(bytes, fines, nCampos) {
    const td = new TextDecoder('utf-8', { ignoreBOM: true });
    const r = [];
    for (let k = 0; k < nCampos; k++) r.push(td.decode(bytes.subarray(k ? fines[k - 1] : 0, fines[k])));
    return r;
  }

  class ValidadorUtf8 {
    constructor() {
      this.faltan = 0; // bytes de continuación que faltan en la secuencia abierta
      this.min = 0x80; // rango admitido para el siguiente byte de continuación
      this.max = 0xbf;
      this.leidos = 0;
      this.inicio = 0; // byte donde empezó la secuencia abierta
    }

    /** Valida un trozo. Devuelve -1 si es válido (puede quedar una secuencia abierta) o el byte del fallo. */
    push(b) {
      const n = b.length, base = this.leidos;
      let i = 0, faltan = this.faltan, min = this.min, max = this.max;
      while (i < n) {
        if (faltan === 0) {
          while (i < n && b[i] < 0x80) i++; // camino rápido ASCII
          if (i === n) break;
          const c = b[i];
          this.inicio = base + i;
          if (c >= 0xc2 && c <= 0xdf) { faltan = 1; min = 0x80; max = 0xbf; }
          else if (c >= 0xe0 && c <= 0xef) { faltan = 2; min = c === 0xe0 ? 0xa0 : 0x80; max = c === 0xed ? 0x9f : 0xbf; }
          else if (c >= 0xf0 && c <= 0xf4) { faltan = 3; min = c === 0xf0 ? 0x90 : 0x80; max = c === 0xf4 ? 0x8f : 0xbf; }
          else return this.inicio; // 80–C1 y F5–FF no pueden empezar una secuencia
          i++;
        } else {
          const c = b[i];
          if (c < min || c > max) return this.inicio;
          min = 0x80; max = 0xbf; faltan--; i++;
        }
      }
      this.faltan = faltan; this.min = min; this.max = max;
      this.leidos += n;
      return -1;
    }

    /** Fin del archivo: -1 si no quedó ninguna secuencia abierta; si no, el byte donde empezó. */
    fin() {
      return this.faltan === 0 ? -1 : this.inicio;
    }
  }

  R2.csv = { Lector, campos, ValidadorUtf8 };
})(globalThis.R2 = globalThis.R2 || {});

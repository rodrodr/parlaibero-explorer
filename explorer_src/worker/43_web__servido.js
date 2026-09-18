/* ===== src/web/servido.js ===== */
/* 2REP_Standalone · web/servido.js
 *
 * Worker: abrir el corpus que VIAJA CON LA PÁGINA, sin pedirle nada al usuario (ARQUITECTURA.md §15 bis).
 *
 * La versión web se publica junto a `datos/corpus.sqlite.gz.NNN` —la base ya construida, sin la tabla `chunks`,
 * comprimida y partida en trozos porque GitHub no admite archivos de más de 100 MB— y su ficha va dentro de la página,
 * en R2.datos.corpus_servido (build/datos.mjs → data/corpus_servido.json). Aquí se descargan las partes en orden, se
 * encadenan en un solo flujo, se descomprime con DecompressionStream('gzip') —la única descompresión que el navegador
 * trae de serie; por eso los datos van en gzip y no en brotli—, se comprueba el sha256 y se abre en memoria con
 * sqlite3_deserialize, igual que hace web/opfs.js con la base recordada.
 *
 * No sustituye a la ingesta: si no hay datos servidos, o fallan, la página sigue ofreciendo el CSV.
 *
 * API
 *   const s = R2.servido.crear({ sqlite3 })
 *   s.ficha()                                       → la ficha declarada, o null
 *   await s.abrir({ base, alProgreso(hecho, total), signal })   base = la URL de la página (el worker es blob:)
 *       → { db, informe, construidoEn, servido, ms }   (la forma que espera principal.js, como R2.opfs.abrir)
 * Errores: R2.opfs.ErrorAlmacen con codigo DESCARGA, DESCOMPRESION, SERVIDO_DANADO, MEMORIA o NO_SOPORTADO, para que
 * salgan por el mismo camino que los de la base recordada (mensaje en español y `codigo` clonable).
 */
(function (R2) {
  'use strict';

  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const ErrorAlmacen = () => (R2.opfs ? R2.opfs.ErrorAlmacen : Error);
  const fallo = (codigo, mensaje) => {
    const E = ErrorAlmacen();
    return E === Error ? Object.assign(new Error(mensaje), { codigo }) : new E(codigo, mensaje);
  };

  /** La ficha de los datos que acompañan a la página, si esta edición los lleva. */
  function ficha() {
    const d = R2.datos && R2.datos.corpus_servido;
    return d && Array.isArray(d.partes) && d.partes.length ? d : null;
  }

  async function sha256Hex(u8) {
    const d = await crypto.subtle.digest('SHA-256', u8);
    return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** Un solo flujo de bytes con las partes en orden: el gzip está partido, no son gzips independientes. */
  function flujoDePartes(urls, señal, alBajar) {
    let i = 0;
    let lector = null;
    return new ReadableStream({
      async pull(ctrl) {
        for (;;) {
          if (!lector) {
            if (i >= urls.length) { ctrl.close(); return; }
            let resp;
            try {
              resp = await fetch(urls[i], { cache: 'force-cache', signal: señal });
            } catch (e) {
              if (e && e.name === 'AbortError') throw e;
              throw fallo('DESCARGA', `No se pudieron descargar los datos de la página: ${e.message}`);
            }
            if (!resp.ok || !resp.body) throw fallo('DESCARGA', `No se pudieron descargar los datos de la página (HTTP ${resp.status}).`);
            lector = resp.body.getReader();
            i++;
          }
          const { done, value } = await lector.read();
          if (done) { lector = null; continue; }
          alBajar(value.byteLength);
          ctrl.enqueue(value);
          return;
        }
      },
      cancel(motivo) { if (lector) lector.cancel(motivo); },
    });
  }

  function crear({ sqlite3 }) {
    const { capi, wasm } = sqlite3;

    /** Descarga las partes, las descomprime y comprueba tamaño y sha256. */
    async function descargar(info, opciones = {}) {
      const alProgreso = typeof opciones.alProgreso === 'function' ? opciones.alProgreso : null;
      const señal = opciones.signal || null;
      if (typeof DecompressionStream !== 'function') {
        throw fallo('NO_SOPORTADO', 'Este navegador no sabe descomprimir los datos que acompañan a la página. '
          + 'Actualícelo o abra el corpus eligiendo el CSV.');
      }
      // El worker se crea desde una blob: URL, así que una ruta relativa no resuelve: la raíz (la de la página) llega
      // en las opciones.
      const raiz = opciones.base || '';
      const dir = (info.dir ? `${String(info.dir).replace(/\/+$/, '')}/` : '');
      const urls = info.partes.map((p) => `${raiz}${dir}${p.archivo}`);
      if (!raiz && !/^https?:/i.test(urls[0])) {
        throw fallo('DESCARGA', 'Error interno de la página: no se sabe desde dónde descargar los datos.');
      }
      // El avance se mide sobre lo COMPRIMIDO: es lo que tarda, y su total se conoce antes de empezar.
      let bajados = 0;
      const total = info.bytes_gz || info.partes.reduce((s, p) => s + (p.bytes_gz || 0), 0);
      const flujo = flujoDePartes(urls, señal, (n) => {
        bajados += n;
        if (alProgreso) alProgreso(bajados, total);
      });

      const partes = [];
      let bytes = 0;
      try {
        const lector = flujo.pipeThrough(new DecompressionStream('gzip')).getReader();
        for (;;) {
          const { done, value } = await lector.read();
          if (done) break;
          partes.push(value);
          bytes += value.byteLength;
        }
      } catch (e) {
        if (e && (e.name === 'AbortError' || e.codigo)) throw e;
        throw fallo('DESCOMPRESION', `Los datos que acompañan a la página están dañados: ${e.message}`);
      }
      const u8 = new Uint8Array(bytes);
      for (let i = 0, off = 0; i < partes.length; i++) { u8.set(partes[i], off); off += partes[i].byteLength; partes[i] = null; }
      if (info.bytes && bytes !== info.bytes) {
        throw fallo('SERVIDO_DANADO', `Los datos descargados miden ${bytes} bytes y deberían medir ${info.bytes}. Elija el CSV para construir el corpus.`);
      }
      if (info.sha256 && (await sha256Hex(u8)) !== info.sha256) {
        throw fallo('SERVIDO_DANADO', 'Los datos descargados no coinciden con su huella. Elija el CSV para construir el corpus.');
      }
      return u8;
    }

    /** Copia los bytes al montón de SQLite y los abre como base en memoria (como web/opfs.js al abrir la recordada). */
    function abrirBytes(u8) {
      const n = u8.byteLength;
      const pOut = Number(capi.sqlite3_malloc64(n));
      if (!pOut) throw fallo('MEMORIA', 'No hay memoria suficiente para abrir el corpus. Cierre otras pestañas y vuelva a intentarlo.');
      try {
        wasm.heap8u().set(u8, pOut);
      } catch (e) {
        capi.sqlite3_free(pOut);
        throw fallo('MEMORIA', `No se pudo copiar el corpus a la memoria del motor: ${e.message}`);
      }
      const db = new sqlite3.oo1.DB(':memory:');
      if (R2.texto) db.r2Texto = R2.texto.instalar(sqlite3, db);
      const rc = capi.sqlite3_deserialize(db.pointer, 'main', pOut, n, n,
        capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE); // si falla, SQLite libera pOut
      if (rc) {
        db.close();
        throw fallo('SERVIDO_DANADO', `No se pudo abrir el corpus que acompaña a la página (sqlite3_deserialize rc=${rc}).`);
      }
      db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA temp_store = MEMORY;');
      return db;
    }

    /**
     * Informe equivalente al de la ingesta: la base servida se construyó del CSV publicado, así que se declara su
     * huella y se busca esa versión en data/csv_publicado.json. «Sobre este corpus» cuenta entonces lo mismo que si el
     * usuario hubiera elegido el CSV, y la base se puede recordar con el mismo nombre.
     */
    function informeDe(info, db, ms) {
      const pub = (R2.datos && R2.datos.csv_publicado) || null;
      const versiones = pub ? (Array.isArray(pub.versiones) && pub.versiones.length ? pub.versiones : [pub]) : [];
      const origen = info.csv_origen || {};
      const v = versiones.find((x) => x.sha256 === origen.sha256) || null;
      return {
        n_filas: db.selectValue('SELECT COUNT(*) FROM speeches'),
        duplicadas: 0,
        huella: { bytes: v ? v.bytes : (origen.bytes || null), sha256: origen.sha256 || null, nombre: origen.nombre || null },
        publicado: pub ? !!v : null,
        version_csv: v ? { id: v.id || null, corto: v.corto || null, estado: v.estado || 'publicada',
          version_dataverse: v.version_dataverse != null ? v.version_dataverse : null,
          correcciones_fechas: v.correcciones_fechas || null, etiqueta: v.etiqueta || null, texto: v.texto || null } : null,
        correcciones_fechas: null,
        avisos: [],
        origen: 'servido',
        servido: { corpus: info.corpus || null, titulo: info.titulo || null, bytes: info.bytes || null,
          bytes_gz: info.bytes_gz || null, partes: info.partes.length, construido_en: info.construido_en || null },
        tiempos: { hasta_listo: Math.round(ms) },
        memoria: null,
        // Las mismas claves que el informe de la ingesta: «Sobre este corpus» y /api/info las leen sin distinguir de
        // dónde salió la base (info.js: estadoStandalone lee detalles.sqlite).
        detalles: {
          sqlite: sqlite3.version.libVersion,
          page_size: db.selectValue('PRAGMA page_size'),
          tamano_trozo: null,
          sha256: 'servida',
          verificar_cambios: false,
          bytes_texto: null,
          valores_distintos: null,
          latidos: null,
        },
      };
    }

    /** Descarga, abre y devuelve la base con su informe. */
    async function abrir(opciones = {}) {
      const info = ficha();
      if (!info) throw fallo('NO_SERVIDO', 'Esta edición de la página no lleva datos dentro. Elija el CSV.');
      const t0 = ahora();
      const u8 = await descargar(info, opciones);
      const db = abrirBytes(u8);
      const ms = ahora() - t0;
      return { db, informe: informeDe(info, db, ms), construidoEn: info.construido_en || null, servido: info, ms };
    }

    return { ficha, descargar, abrirBytes, abrir };
  }

  R2.servido = { crear, ficha };
}(globalThis.R2 = globalThis.R2 || {}));

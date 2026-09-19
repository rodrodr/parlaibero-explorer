/* ===== src/web/expresiones_servidas.js ===== */
/* Diarios Explorer · web/expresiones_servidas.js
 *
 * Worker, edición web: expresiones de varias palabras ya calculadas para los CSV publicados en Dataverse, servidas junto
 * a la página en expresiones/ (tools/expresiones_precalculadas.py las genera; build.py las copia a docs/). Ahorran la
 * fase más lenta de la construcción (unos 90 s en Brasil o México) sin cambiar el resultado: se usan solo si el CSV
 * elegido es idéntico al de la tabla (misma SHA-256) y la tabla es de la versión de la detección de este motor.
 *
 *   expresiones/indice.json  { formato: 1, version_expresiones, generado, paises: { CC: { csv: { nombre, bytes,
 *                            sha256, md5 }, dataverse: { doi, version, id_archivo }, archivo, bytes, sha256,
 *                            expresiones } } }
 *   expresiones/CC.json.gz   paquete de R2.expresiones.paquete(): { version, meta, columnas, filas, csv_sha256 }
 *
 * API
 *   const s = R2.expresionesServidas.crear({ base })      base = la URL de la carpeta de la página (el worker es blob:)
 *   await s.candidato(bytes)  → true si hay una tabla de esta versión para un CSV de ese tamaño (para avisar a la página)
 *   await s.obtener({ pais, bytes, sha256() })  → { paquete, origen } o { paquete: null, motivo }; nunca lanza: cualquier
 *     fallo (sin conexión, tabla dañada, CSV distinto) devuelve el motivo y la construcción detecta como siempre.
 */
(function (R2) {
  'use strict';

  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  const texto = (e) => (e && e.message ? e.message : String(e));

  async function descomprimirGzip(u8) {
    if (typeof DecompressionStream !== 'function') throw new Error('este navegador no descomprime gzip');
    const flujo = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(flujo).arrayBuffer());
  }

  function crear({ base } = {}) {
    const raiz = String(base || '');
    let indice = null;
    /** El índice, una vez por construcción (revalidado con el servidor: cambia con cada versión de los datos). */
    const leerIndice = () => {
      if (!indice) {
        indice = (async () => {
          if (!raiz) return null;
          const r = await fetch(new URL('expresiones/indice.json', raiz).href, { cache: 'no-cache' });
          if (!r.ok) return null;
          const j = await r.json();
          return j && j.formato === 1 && j.paises && typeof j.paises === 'object' ? j : null;
        })().catch(() => null);
      }
      return indice;
    };
    const version = () => (R2.expresiones ? R2.expresiones.VERSION : null);

    async function candidato(bytes) {
      const j = await leerIndice();
      if (!j || j.version_expresiones !== version()) return false;
      return Object.values(j.paises).some((e) => e && e.csv && e.csv.bytes === bytes);
    }

    async function obtener({ pais, bytes, sha256 }) {
      try {
        const j = await leerIndice();
        if (!j) return { paquete: null, motivo: null };                   // esta página no sirve expresiones
        const e = j.paises[String(pais || '').toUpperCase()];
        if (!e || !e.csv || e.csv.bytes !== bytes) return { paquete: null, motivo: null };   // otro CSV: nada que decir
        if (j.version_expresiones !== version()) {
          return { paquete: null, motivo: `las expresiones servidas son de la versión ${j.version_expresiones} de la detección y este motor usa la ${version()}` };
        }
        const suya = await sha256();
        if (suya !== e.csv.sha256) return { paquete: null, motivo: 'el CSV no es idéntico al publicado en Dataverse (SHA-256 distinta)' };
        // La URL lleva la huella de la tabla: si cambia, es otra dirección y ninguna caché devuelve la vieja.
        const url = new URL(`expresiones/${e.archivo}?h=${String(e.sha256).slice(0, 16)}`, raiz).href;
        const r = await fetch(url);
        if (!r.ok) return { paquete: null, motivo: `no se pudo descargar ${e.archivo} (HTTP ${r.status})` };
        const u8 = new Uint8Array(await r.arrayBuffer());
        if (u8.length !== e.bytes || hex(await crypto.subtle.digest('SHA-256', u8)) !== e.sha256) {
          return { paquete: null, motivo: `${e.archivo} no coincide con el índice (descarga incompleta o dañada)` };
        }
        const paquete = JSON.parse(new TextDecoder().decode(await descomprimirGzip(u8)));
        if (!paquete || paquete.csv_sha256 !== suya) return { paquete: null, motivo: `${e.archivo} es de otro CSV` };
        return { paquete, origen: { archivo: e.archivo, generado: j.generado || null, dataverse: e.dataverse || null } };
      } catch (err) {
        return { paquete: null, motivo: `no se pudieron usar las expresiones servidas: ${texto(err)}` };
      }
    }

    return { candidato, obtener };
  }

  R2.expresionesServidas = Object.freeze({ crear });
})(globalThis.R2 = globalThis.R2 || {});

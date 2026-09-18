/* ===== src/worker/texto.js ===== */
/* Diarios Explorer · worker/texto.js
 *
 * El texto de las intervenciones no se guarda en claro en la tabla: se concatena en bloques de ~128 KiB que se comprimen
 * con gzip (CompressionStream) y se guardan en texto_bloques(id, formato, datos). Cada fila de speeches_datos guarda
 * (bloque, desde, largo) y la vista `speeches` reconstruye la columna speech con la función SQL r2_texto(bloque, desde, largo),
 * que descomprime el bloque (R2.inflate, síncrono) y lo conserva en una caché LRU. Así una base de 1,3 GB de texto cabe en el
 * tope de 2 GiB del heap de WebAssembly (medido: el texto comprimido queda en ~0,30× y el índice FTS5 en ~0,36×).
 *
 * API (R2.texto)
 *   instalar(sqlite3, db) → { vaciar(), cerrar() }   registra r2_texto en la conexión (hay que hacerlo en cada conexión que
 *                                                    abra la base: construcción, base recordada, base servida)
 *   async comprimir(u8) → Uint8Array (gzip)          null si no hay CompressionStream
 *   hayCompresion                                    typeof CompressionStream === 'function'
 */
(function (R2) {
  'use strict';

  const NOMBRE_FUNCION = 'r2_texto';
  const MAX_BLOQUES_CACHE = 48;
  const hayCompresion = typeof CompressionStream === 'function' && typeof Response === 'function';

  function instalar(sqlite3, db) {
    const cache = new Map(); // id → Uint8Array descomprimido; el orden de inserción hace de LRU
    const td = new TextDecoder('utf-8', { ignoreBOM: true });
    let stmt = null;

    function leerBloque(id) {
      let raw = cache.get(id);
      if (raw !== undefined) {
        cache.delete(id);
        cache.set(id, raw);
        return raw;
      }
      if (!stmt) stmt = db.prepare('SELECT formato, datos FROM texto_bloques WHERE id = ?');
      let formato = null, datos = null;
      try {
        stmt.bind([id]);
        if (stmt.step()) { formato = stmt.get(0); datos = stmt.get(1); }
      } finally {
        stmt.reset();
      }
      if (datos === null || datos === undefined) raw = new Uint8Array(0);
      else if (formato === 'gzip') raw = R2.inflate.gunzip(datos);
      else raw = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
      cache.set(id, raw);
      if (cache.size > MAX_BLOQUES_CACHE) cache.delete(cache.keys().next().value);
      return raw;
    }

    db.createFunction({
      name: NOMBRE_FUNCION,
      arity: 3,
      deterministic: true,
      xFunc: (pCx, bloque, desde, largo) => {
        const n = Number(largo) || 0;
        if (bloque === null || bloque === undefined || n <= 0) return '';
        const raw = leerBloque(Number(bloque));
        const a = Number(desde) || 0;
        return td.decode(raw.subarray(a, a + n));
      },
    });

    return {
      vaciar() { cache.clear(); },
      cerrar() {
        if (stmt) { try { stmt.finalize(); } catch (e) { /* la base puede estar cerrada */ } stmt = null; }
        cache.clear();
      },
    };
  }

  const hayDescompresion = typeof DecompressionStream === 'function' && typeof Response === 'function';

  async function descomprimir(u8) {
    const ds = new DecompressionStream('gzip');
    const escritor = ds.writable.getWriter();
    const escritura = escritor.write(u8).then(() => escritor.close());
    escritura.catch(() => {});
    const buf = await new Response(ds.readable).arrayBuffer();
    await escritura;
    return new Uint8Array(buf);
  }

  const LOTE_IDS = 900;
  const LOTE_BLOQUES = 48;

  /**
   * Lectura masiva de textos: para muchos ids a la vez (léxico, exportaciones) es mucho más rápido leer los bloques
   * comprimidos directamente y descomprimirlos en paralelo con DecompressionStream (nativo) que pasar por r2_texto fila a
   * fila. `ids`: enteros, en cualquier orden (se agrupan por bloque). Devuelve un Map id → { id, speaker, rep_name, speech }
   * con solo los ids que existen. `ceder` (opcional, async) se llama entre lotes de bloques.
   */
  async function leerTextos(db, ids, { ceder, alProgreso } = {}) {
    const td = new TextDecoder('utf-8', { ignoreBOM: true });
    const orden = Array.from(new Set(Array.from(ids, (x) => Number(x)))).sort((a, b) => a - b);
    const metas = [];
    for (let k = 0; k < orden.length; k += LOTE_IDS) {
      const lote = orden.slice(k, k + LOTE_IDS);
      const st = db.prepare(`SELECT id, speaker, rep_name, bloque, desde, largo FROM speeches_datos WHERE id IN (${lote.map(() => '?').join(',')})`);
      try {
        st.bind(lote);
        while (st.step()) metas.push({ id: st.get(0), speaker: st.get(1), rep_name: st.get(2), bloque: st.get(3), desde: st.get(4), largo: st.get(5) });
      } finally { st.finalize(); }
      if (ceder) await ceder();
    }
    metas.sort((a, b) => (a.bloque - b.bloque) || (a.id - b.id));
    if (alProgreso) alProgreso(0, metas.length);
    const out = new Map();
    const stBloque = db.prepare('SELECT id, formato, datos FROM texto_bloques WHERE id = ?');
    try {
      let i = 0;
      while (i < metas.length) {
        // Un lote de bloques distintos consecutivos en `metas`.
        const bloques = [];
        let j = i;
        for (; j < metas.length; j++) {
          const b = metas[j].bloque;
          if (bloques.length && bloques[bloques.length - 1] === b) continue;
          if (bloques.length === LOTE_BLOQUES) break;
          bloques.push(b);
        }
        const crudos = await Promise.all(bloques.map(async (b) => {
          if (b === null || b === undefined) return new Uint8Array(0);
          let formato = null, datos = null;
          try {
            stBloque.bind([b]);
            if (stBloque.step()) { formato = stBloque.get(1); datos = stBloque.get(2); }
          } finally { stBloque.reset(); }
          if (datos === null || datos === undefined) return new Uint8Array(0);
          if (formato !== 'gzip') return datos instanceof Uint8Array ? datos : new Uint8Array(datos);
          return hayDescompresion ? descomprimir(datos) : R2.inflate.gunzip(datos);
        }));
        const porBloque = new Map(bloques.map((b, k) => [b, crudos[k]]));
        for (; i < j; i++) {
          const m = metas[i];
          const raw = porBloque.get(m.bloque) || new Uint8Array(0);
          const a = Number(m.desde) || 0, n = Number(m.largo) || 0;
          out.set(m.id, { id: m.id, speaker: m.speaker, rep_name: m.rep_name, speech: n > 0 ? td.decode(raw.subarray(a, a + n)) : '' });
        }
        if (alProgreso) alProgreso(i, metas.length);
        if (ceder) await ceder();
      }
    } finally {
      stBloque.finalize();
    }
    return out;
  }

  async function comprimir(u8) {
    if (!hayCompresion) return null;
    const cs = new CompressionStream('gzip');
    const escritor = cs.writable.getWriter();
    const escritura = escritor.write(u8).then(() => escritor.close());
    const buf = await new Response(cs.readable).arrayBuffer();
    await escritura;
    return new Uint8Array(buf);
  }

  R2.texto = Object.freeze({ NOMBRE_FUNCION, MAX_BLOQUES_CACHE, hayCompresion, hayDescompresion, instalar, comprimir, descomprimir, leerTextos });
})(globalThis.R2 = globalThis.R2 || {});

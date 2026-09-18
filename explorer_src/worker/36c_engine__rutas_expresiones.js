/* ===== src/engine/rutas_expresiones.js ===== */
/* Diarios Explorer · engine/rutas_expresiones.js
 *
 * Revisión de las expresiones de varias palabras del corpus (R2.expresiones, detectadas al construir la base).
 *   GET /expressions?q=&orden=&limite=&desde=&solo= → { disponible, total, filas, rechazadas, meta }
 *     q: texto que contienen (sin tildes ni mayúsculas) · orden frecuencia|alfabetico|g2|longitud (frecuencia)
 *     limite 0..1000 (200; 0 = todas, para exportar) · desde ≥ 0 · solo todas|rechazadas (todas)
 *   POST /expressions/rejected { rechazadas: [forma plegada, …] } → { rechazadas: n, formas }
 *     Fija la lista entera de las que no se unen, en la memoria del motor (la página la guarda en el navegador y la
 *     vuelve a enviar al abrir el corpus), y deja sin efecto las cachés del léxico que dependen de ellas. 422 si el
 *     cuerpo no trae una lista de textos.
 */
(function (R2) {
  'use strict';

  const RT = R2.router, EX = R2.expresiones;
  if (!RT || !EX) throw new Error('engine/rutas_expresiones.js necesita R2.router y R2.expresiones');
  const ErrorHttp = RT.ErrorHttp;
  const bdDe = (ctx) => ({ db: ctx.db, sqlite3: ctx.sqlite3 });
  const get = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
  const MAX_RECHAZADAS = 50000;

  function parametros(pet) {
    const errores = [];
    const orden = String(get(pet.query, 'orden') || 'frecuencia');
    if (!['frecuencia', 'alfabetico', 'g2', 'longitud'].includes(orden)) errores.push('orden: debe ser frecuencia, alfabetico, g2 o longitud');
    const solo = String(get(pet.query, 'solo') || 'todas');
    if (!['todas', 'rechazadas'].includes(solo)) errores.push('solo: debe ser todas o rechazadas');
    const entero = (nombre, defecto, le) => {
      const v = get(pet.query, nombre);
      if (v === undefined || v === null || v === '') return defecto;
      if (!/^\d+$/.test(String(v).trim())) { errores.push(`${nombre}: debe ser un número entero`); return defecto; }
      const n = Number(v);
      if (le !== undefined && n > le) { errores.push(`${nombre}: debe estar entre 0 y ${le}`); return defecto; }
      return n;
    };
    const limite = entero('limite', 200, 1000), desde = entero('desde', 0);
    const q = String(get(pet.query, 'q') || '').slice(0, 200);
    if (errores.length) throw new ErrorHttp(422, `Parametros no validos. ${errores.join('; ')}`);
    return { q, orden, limite, desde, solo };
  }

  RT.registrar('GET', '/expressions', (pet, ctx) => EX.listar(bdDe(ctx), parametros(pet)), { prioridad: 'interactiva' });

  RT.registrar('POST', '/expressions/rejected', (pet, ctx) => {
    const lista = pet.cuerpo && pet.cuerpo.rechazadas;
    if (!Array.isArray(lista) || lista.some((x) => typeof x !== 'string') || lista.length > MAX_RECHAZADAS) {
      throw new ErrorHttp(422, `Parametros no validos. rechazadas: debe ser una lista de textos (como mucho ${MAX_RECHAZADAS})`);
    }
    return EX.fijarRechazadas(bdDe(ctx), lista);
  }, { prioridad: 'interactiva' });

  R2.rutasExpresiones = Object.freeze({ parametros });
})(globalThis.R2 = globalThis.R2 || {});

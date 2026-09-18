/* ===== src/worker/facetas.js ===== */
/* Diarios Explorer · worker/facetas.js
 *
 * meta.facets: recuentos por legislatura, periodo de sesiones, tipo de sesión, sexo, partido, distrito y diputado, años,
 * fechas extremas, sesiones y filas de discurso frente a filas sin orador. Se calcula una vez al construir la base y
 * GET /api/facets lo devuelve tal cual (JSON).
 */
(function (R2) {
  'use strict';

  const E = R2.errores;
  const ETIQUETAS_SEXO = Object.freeze({ M: 'Hombre', F: 'Mujer', 'Sin identificar': 'Sin identificar' });

  function calcularSinComprobar(db) {
    const sel = (sql, bind) => db.selectArrays(sql, bind || []);
    const grupo = (col, orden = '2 DESC, 1 ASC') =>
      sel(`SELECT ${col} AS v, COUNT(*) AS n, COALESCE(SUM(nwords), 0) AS w FROM speeches_datos GROUP BY 1 ORDER BY ${orden}`)
        .map((r) => ({ value: r[0], n: r[1], words: r[2] }));
    const conFechas = (col) =>
      sel(`SELECT ${col} AS v, COUNT(*) AS n, COALESCE(SUM(nwords), 0) AS w, MIN(date), MAX(date), COUNT(DISTINCT num_session)
           FROM speeches_datos GROUP BY 1 ORDER BY MIN(date), 1`)
        .map((r) => ({ value: r[0], n: r[1], words: r[2], date_min: r[3], date_max: r[4], sessions: r[5] }));

    const legislatures = conFechas('legislature');
    const legislative_sessions = sel(`SELECT legislative_session AS v, MIN(legislature), COUNT(*), COALESCE(SUM(nwords), 0), MIN(date), MAX(date),
           COUNT(DISTINCT num_session) FROM speeches_datos GROUP BY 1 ORDER BY MIN(date), 1`)
      .map((r) => ({ value: r[0], legislature: r[1], n: r[2], words: r[3], date_min: r[4], date_max: r[5], sessions: r[6] }));
    const session_types = grupo('session_type');
    const sexes = grupo('sex').map((x) => Object.assign(x, { label: ETIQUETAS_SEXO[x.value] || x.value }));
    const parties = grupo('party');
    const districts = grupo('district');
    const speakers = sel(`
WITH g AS (
  SELECT rep_name, MIN(rep_id) AS rep_id, COUNT(*) AS n, COALESCE(SUM(nwords), 0) AS w
  FROM speeches_datos WHERE rep_id IS NOT NULL GROUP BY rep_name
),
p AS (
  SELECT rep_name, party AS v, row_number() OVER (PARTITION BY rep_name ORDER BY COUNT(*) DESC, party) AS rn
  FROM speeches_datos WHERE rep_id IS NOT NULL GROUP BY rep_name, party
),
x AS (
  SELECT rep_name, sex AS v, row_number() OVER (PARTITION BY rep_name ORDER BY COUNT(*) DESC, sex) AS rn
  FROM speeches_datos WHERE rep_id IS NOT NULL GROUP BY rep_name, sex
)
SELECT g.rep_id, g.rep_name, g.n, g.w, p.v, x.v
FROM g LEFT JOIN p ON p.rep_name = g.rep_name AND p.rn = 1 LEFT JOIN x ON x.rep_name = g.rep_name AND x.rn = 1
ORDER BY g.n DESC, g.rep_name`)
      .map((r) => ({ rep_id: r[0], value: r[1], n: r[2], words: r[3], party: r[4], sex: r[5] }));
    const years = sel('SELECT year, COUNT(*) FROM speeches_datos WHERE year IS NOT NULL GROUP BY 1 ORDER BY 1')
      .map((r) => ({ value: r[0], n: r[1] }));
    const fechas = sel('SELECT MIN(date), MAX(date) FROM speeches_datos WHERE date IS NOT NULL')[0] || [null, null];
    const filas = sel('SELECT COUNT(*), COALESCE(SUM(dm_speech = 1), 0), COALESCE(SUM(dm_speech = 0), 0), COALESCE(SUM(nwords), 0), COUNT(DISTINCT num_session), COUNT(DISTINCT rep_id) FROM speeches_datos')[0];
    const sinDiputado = sel("SELECT COUNT(*) FROM speeches_datos WHERE rep_id IS NULL AND dm_speech = 1")[0][0];

    return {
      legislatures,
      legislative_sessions,
      session_types,
      sexes,
      parties,
      districts,
      speakers,
      years,
      date_min: fechas[0],
      date_max: fechas[1],
      labels: { sex: ETIQUETAS_SEXO },
      sessions_total: filas[4],
      rows: { total: filas[0], speech: filas[1], doc: filas[2], speech_unidentified: sinDiputado },
      words_total: filas[3],
      deputies_total: filas[5],
    };
  }

  const esDesbordamiento = (e) => /integer overflow/i.test(String(e && e.message));

  /** calcularSinComprobar, con el desbordamiento de SUM(nwords) convertido en ENTERO_NO_VALIDO. */
  function calcular(db) {
    try {
      return calcularSinComprobar(db);
    } catch (e) {
      if (!esDesbordamiento(e)) throw e;
      throw E.fallo('ENTERO_NO_VALIDO', { columna: 'nwords', causa: E.textoDe(e), detalle: { motivo: 'suma' } });
    }
  }

  /** JSON con separadores ', ' y ': ' (el mismo formato que escribía el escritorio). */
  function aJson(v) {
    if (v === null || v === undefined) return 'null';
    switch (typeof v) {
      case 'string': return JSON.stringify(v);
      case 'boolean': return v ? 'true' : 'false';
      case 'bigint': return v.toString();
      case 'number': return Number.isFinite(v) ? String(v) : 'null';
      case 'object':
        if (Array.isArray(v)) return '[' + v.map(aJson).join(', ') + ']';
        return '{' + Object.keys(v).map((k) => JSON.stringify(k) + ': ' + aJson(v[k])).join(', ') + '}';
      default:
        throw new TypeError(`aJson: tipo no admitido (${typeof v})`);
    }
  }

  R2.facetas = { ETIQUETAS_SEXO, calcular, aJson };
})(globalThis.R2 = globalThis.R2 || {});

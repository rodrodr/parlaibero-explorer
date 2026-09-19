/* ===== src/worker/partidos.js ===== */
/* Diarios Explorer · worker/partidos.js
 *
 * Partidos homogéneos. La columna `party` de los CSV de ParlaIbero trae etiquetas distintas para un mismo partido:
 * variantes de escritura, siglas y nombre completo, federaciones y listas electorales, nombres anteriores del partido…
 * El registro datos/partidos_parlaibero.json (tools/partidos_parlaibero.py, con la fuente de cada cambio de nombre), que
 * build.py incorpora al worker como R2.datos.partidos, da el partido canónico de cada etiqueta de cada país, y la ingesta
 * guarda ese partido en speeches_datos.party: filtros, léxico, coocurrencias, menciones y exportaciones usan así un único
 * nombre por partido. Una etiqueta que no está en el registro (de una versión nueva del CSV, por ejemplo) se queda como viene.
 *
 * Formato por país: { tipo, partidos: { <sigla>: { nombre, inicio? } }, etiquetas: { <etiqueta del CSV>: sigla | [opciones] } }.
 * Una lista es una trayectoria (en Argentina la columna trae todos los bloques del diputado en su carrera): cada opción es
 * [sigla, fecha de ingreso en ese bloque] (de los registros de la Cámara) o una sigla sola (vale entonces el inicio del
 * bloque); cada intervención va a la última opción cuya fecha no es posterior a la suya, o a la primera si ninguna lo cumple.
 *
 * API (R2.partidos)
 *   para(pais) → null | { resolver(etiqueta) → null | { sigla } | { opciones: [[inicio, sigla], …] }, nombre(sigla), tipo }
 *   enFecha(opciones, fecha) → índice de la opción que corresponde a esa fecha (AAAA-MM-DD)
 */
(function (R2) {
  'use strict';

  const registro = () => (R2.datos && R2.datos.partidos && typeof R2.datos.partidos === 'object' ? R2.datos.partidos : null);
  const propia = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function para(pais) {
    const reg = registro();
    const e = reg && reg[String(pais || '').toUpperCase()];
    if (!e || !e.etiquetas || typeof e.etiquetas !== 'object') return null;
    const partidos = e.partidos || {};
    const inicio = (s) => (propia(partidos, s) && partidos[s].inicio) || '';
    return {
      tipo: e.tipo || 'por intervencion',
      resolver(etiqueta) {
        if (!propia(e.etiquetas, etiqueta)) return null;
        const v = e.etiquetas[etiqueta];
        if (!Array.isArray(v)) return typeof v === 'string' && v ? { sigla: v } : null;
        const ops = v.map((x) => (Array.isArray(x) ? [String(x[1] || ''), String(x[0])] : [inicio(x), String(x)])).filter((o) => o[1]);
        if (!ops.length) return null;
        return ops.length === 1 ? { sigla: ops[0][1] } : { opciones: ops };
      },
      nombre: (s) => (propia(partidos, s) && partidos[s].nombre) || '',
    };
  }

  /** Índice de la última opción cuyo inicio no es posterior a la fecha; 0 si ninguna lo cumple o no hay fecha. */
  function enFecha(opciones, fecha) {
    if (fecha) for (let k = opciones.length - 1; k > 0; k--) if (opciones[k][0] && opciones[k][0] <= fecha) return k;
    return 0;
  }

  R2.partidos = Object.freeze({ para, enFecha });
})(globalThis.R2 = globalThis.R2 || {});

// Escribe el registro de menciones del corpus de las Cortes de la Segunda República (el de 2REP_Explorer / luz_explorer):
// las formas de tratamiento del español, las tablas de jefes de Estado y de Gobierno de la República, los presidentes de las
// Cortes, las figuras históricas y el léxico de nombres de pila que usa el detector de menciones del worker
// (worker/45_engine__menciones.js, que 2REP comparte con este explorador).
//
//   node tools/menciones_2rep.cjs [destino.json]
//
// Mismo formato que datos/menciones_parlaibero.json —las expresiones regulares se serializan como {re, fl}—, pero con un
// solo corpus, bajo la clave «2REP». Sin destino escribe en el data/ del Standalone de 2REP, que está al lado de este
// repositorio; si ese directorio no existe, hay que pasar la ruta.
//
// Fuentes: tools/menciones_formas.cjs (la entrada '2REP', con la procedencia de cada fecha) y tools/menciones_nombres_pila.json.
const fs = require('fs'), path = require('path');
const F = require('./menciones_formas.cjs');
const POR_DEFECTO = path.join(__dirname, '..', '..', '..', '2REP', '2REP_Base', '2REP_Explorer', 'standalone', 'data', 'menciones_2rep.json');
const SALIDA = process.argv[2] ? path.resolve(process.argv[2]) : POR_DEFECTO;
if (!fs.existsSync(path.dirname(SALIDA))) {
  console.error(`No existe ${path.dirname(SALIDA)}. Pasa la ruta de salida: node tools/menciones_2rep.cjs <destino.json>`);
  process.exit(1);
}
const ser = (v) => (v instanceof RegExp ? { re: v.source, fl: v.flags } : v);
const mapa = (v) => (Array.isArray(v) ? v.map((x) => (Array.isArray(x) ? x.map(mapa) : ser(x))) : ser(v));
const c = F('2REP'), corpus = {};
for (const k of Object.keys(c).sort()) {
  if (k === 'base' || k === 'pais') continue;
  corpus[k] = mapa(c[k]);
}
const salida = {
  generado: new Date().toISOString().slice(0, 10),
  version: '1.0',
  nota: 'Formas de tratamiento, tablas de jefes de Estado y de Gobierno, presidentes de las Cortes, figuras históricas y '
    + 'léxico de nombres de pila del detector de menciones para las Cortes de la Segunda República española (1931-1945). '
    + 'Las expresiones regulares van como {re, fl}. Lo escribe tools/menciones_2rep.cjs de diaries_explorer.',
  nombres_pila: JSON.parse(fs.readFileSync(path.join(__dirname, 'menciones_nombres_pila.json'), 'utf8')),
  paises: { '2REP': corpus },
};
fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 1) + '\n');
console.log(SALIDA, (fs.statSync(SALIDA).size / 1024).toFixed(0), 'KiB ·',
  Object.keys(salida.nombres_pila).length, 'nombres de pila ·',
  corpus.jefes.length, 'jefes de Estado ·', corpus.jefesGobierno.length, 'de Gobierno ·',
  corpus.presidentesCamara.length, 'de las Cortes ·', corpus.historicos.length, 'figuras históricas');

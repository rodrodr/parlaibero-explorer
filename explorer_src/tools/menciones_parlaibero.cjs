// Escribe datos/menciones_parlaibero.json: las formas de tratamiento de los 16 países, sus tablas de jefes de Estado y de
// Gobierno, las figuras históricas y el léxico de nombres de pila que usa el detector de menciones del worker
// (worker/45_engine__menciones.js). Las expresiones regulares se serializan como {re, fl}.
//
//   node tools/menciones_parlaibero.cjs
//
// Fuentes: tools/menciones_formas.cjs (el sondeo de los corpus y las tablas de jefes) y tools/menciones_nombres_pila.json.
// Al cambiar el registro cambia el build_id, así que build.py rehace la base local del navegador.
const fs = require('fs'), path = require('path');
const F = require('./menciones_formas.cjs');
const SALIDA = path.join(__dirname, '..', 'datos', 'menciones_parlaibero.json');
const PAISES = 'AR BR CL CO CR DO EC ES GT MX PA PE PT PY SV UY'.split(' ');
const ser = (v) => (v instanceof RegExp ? { re: v.source, fl: v.flags } : v);
const mapa = (v) => (Array.isArray(v) ? v.map((x) => (Array.isArray(x) ? x.map(mapa) : ser(x))) : ser(v));
const paises = {};
for (const p of PAISES) {
  const c = F(p), o = {};
  for (const k of Object.keys(c).sort()) {
    if (k === 'base' || k === 'pais') continue;
    o[k] = mapa(c[k]);
  }
  paises[p] = o;
}
const salida = {
  generado: new Date().toISOString().slice(0, 10),
  version: '6.5',
  nota: 'Formas de tratamiento, tablas de jefes de Estado y de Gobierno, figuras históricas y léxico de nombres de pila del '
    + 'detector de menciones (worker/45_engine__menciones.js). Las expresiones regulares van como {re, fl}.',
  nombres_pila: JSON.parse(fs.readFileSync(path.join(__dirname, 'menciones_nombres_pila.json'), 'utf8')),
  paises,
};
fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 1) + '\n');
console.log(SALIDA, (fs.statSync(SALIDA).size / 1024).toFixed(0), 'KiB ·', PAISES.length, 'países ·',
  Object.keys(salida.nombres_pila).length, 'nombres de pila ·',
  PAISES.reduce((s, p) => s + (paises[p].jefes || []).length + (paises[p].jefesGobierno || []).length, 0), 'mandatos');

// Precisión por país a partir de las revisiones a mano: bruta (correctas / juzgadas) y ponderada por el tamaño de cada
// categoría en la salida del detector; y la «útil»: correcta y que además debe contar (sin «no_deberia_contar»).
// Uso: node precision.cjs <revision|revision6|revision7>
const fs = require('fs');
const DIR = process.argv[2] || 'revision';
const v6 = DIR !== 'revision';
const SALIDA = { revision: 'menciones.json', revision6: 'menciones6_0.json', revision7: 'menciones6_2.json' }[DIR] || 'menciones6.json';
const CATS = v6 ? [
  ['miembro (con tratamiento o cargo)', (m) => m.tipo === 'diputado' && m.estado === 'resuelta' && !m.suelta && !m.sinNombre && !m.alaPresidencia],
  ['miembro (apellido suelto)', (m) => m.tipo === 'diputado' && m.estado === 'resuelta' && m.suelta],
  ['miembro (cargo sin nombre, por fecha)', (m) => m.tipo === 'diputado' && m.estado === 'resuelta' && m.sinNombre],
  ['externa (con cargo o título)', (m) => m.tipo === 'externa' && !m.suelta && !m.antiguo && !m.sinNombre],
  ['externa (antiguo orador sin escaño en la biblioteca)', (m) => m.tipo === 'externa' && m.antiguo],
  ['externa (apellido suelto)', (m) => m.tipo === 'externa' && m.suelta],
  ['externa (cargo sin nombre, por fecha)', (m) => m.tipo === 'externa' && m.sinNombre],
] : [
  ['miembro (con tratamiento o cargo)', (m) => m.tipo === 'diputado' && m.estado === 'resuelta' && !m.suelta && !m.sinNombre && !m.alaPresidencia],
  ['miembro (apellido suelto)', (m) => m.tipo === 'diputado' && m.estado === 'resuelta' && m.suelta],
  ['miembro (cargo sin nombre, por fecha)', (m) => m.tipo === 'diputado' && m.sinNombre],
  ['externa (con cargo o título)', (m) => m.tipo === 'externa' && !m.suelta && !m.antiguo && !m.sinNombre],
  ['externa (antiguo miembro)', (m) => m.tipo === 'externa' && m.antiguo],
  ['externa (apellido suelto)', (m) => m.tipo === 'externa' && m.suelta],
];
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').replace(/[^a-z]/g, '');
const filas = [];
let T = { c: 0, i: 0, d: 0, pond: 0, peso: 0, u: 0, pu: 0 };
for (const p of 'AR BR CL CO CR DO EC ES GT MX PA PE PT PY SV UY'.split(' ')) {
  const f = `${DIR}/${p}.json`;
  if (!fs.existsSync(f)) { filas.push(`${p}: (sin revisión)`); continue; }
  const rev = JSON.parse(fs.readFileSync(f, 'utf8'));
  const ms = JSON.parse(fs.readFileSync(`paises/${p}/${SALIDA}`, 'utf8')).menciones;
  let c = 0, i = 0, d = 0, pond = 0, peso = 0, u = 0, pu = 0; const det = [];
  for (const [nombre, filtro] of CATS) {
    const tam = ms.filter(filtro).length;
    const rs = rev.filter((r) => norm(r.categoria).startsWith(norm(nombre).slice(0, 18)) && norm(r.categoria).includes(norm(nombre).slice(-8)));
    const cc = rs.filter((r) => r.veredicto === 'correcta').length, ii = rs.filter((r) => r.veredicto === 'incorrecta').length, dd = rs.filter((r) => r.veredicto === 'dudosa').length;
    const uu = rs.filter((r) => r.veredicto === 'correcta' && !r.no_deberia_contar).length;
    c += cc; i += ii; d += dd; u += uu;
    if (cc + ii > 0) { pond += tam * cc / (cc + ii); peso += tam; pu += tam * uu / (cc + ii); }
    if (rs.length) det.push(`${nombre.replace(/ \(.*\)/, '')} ${nombre.match(/\((.*)\)/)[1].slice(0, 14)} ${cc}/${cc + ii}`);
  }
  T.c += c; T.i += i; T.d += d; T.pond += pond; T.peso += peso; T.u += u; T.pu += pu;
  filas.push(`${p}: ${c}/${c + i} (${(100 * c / Math.max(1, c + i)).toFixed(0)} %) · ponderada ${(100 * pond / Math.max(1, peso)).toFixed(0)} % · útil ponderada ${(100 * pu / Math.max(1, peso)).toFixed(0)} %${d ? ` · dudosas ${d}` : ''} · ${det.join('; ')}`);
}
console.log(filas.join('\n'));
console.log(`TOTAL: ${T.c}/${T.c + T.i} (${(100 * T.c / (T.c + T.i)).toFixed(1)} %) · ponderada por menciones ${(100 * T.pond / T.peso).toFixed(1)} % · útil ${T.u}/${T.c + T.i} (${(100 * T.u / (T.c + T.i)).toFixed(1)} %), ponderada ${(100 * T.pu / T.peso).toFixed(1)} %`);

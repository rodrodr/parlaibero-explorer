// Muestra aleatoria (semilla fija) de menciones por categoría, con su contexto y cómo se resolvieron, para revisarlas a mano.
// Uso: node muestra_precision.cjs <carpeta> [n por categoría] [semilla]
const fs = require('fs'), path = require('path');
const [DIR, N = '15', SEMILLA = '11'] = process.argv.slice(2);
const { menciones } = JSON.parse(fs.readFileSync(path.join(DIR, 'menciones.json'), 'utf8'));
let s = Number(SEMILLA); const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const muestra = (xs, n) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
const cats = {
  'miembro (con tratamiento o cargo)': menciones.filter((m) => m.tipo === 'diputado' && m.estado === 'resuelta' && !m.suelta && !m.sinNombre && !m.alaPresidencia),
  'miembro (apellido suelto)': menciones.filter((m) => m.tipo === 'diputado' && m.estado === 'resuelta' && m.suelta),
  'miembro (cargo sin nombre, por fecha)': menciones.filter((m) => m.tipo === 'diputado' && m.sinNombre),
  'externa (con cargo o título)': menciones.filter((m) => m.tipo === 'externa' && !m.suelta && !m.antiguo && !m.sinNombre),
  'externa (antiguo miembro)': menciones.filter((m) => m.tipo === 'externa' && m.antiguo),
  'externa (apellido suelto)': menciones.filter((m) => m.tipo === 'externa' && m.suelta),
};
let k = 0;
for (const [c, xs] of Object.entries(cats)) {
  console.log(`\n== ${c}: ${xs.length}`);
  for (const m of muestra(xs, Number(N))) {
    const quien = m.tipo === 'diputado' ? `${m.d.nombre} [${m.por}${m.vocativo ? ', se dirige' : ''}]` : `EXT ${m.persona}`;
    console.log(`${String(++k).padStart(3)} ${String(m.date).slice(0, 4)} ${(m.fuenteNombre || '').slice(0, 18).padEnd(18)} → ${quien}\n      «${m.ctx}»`);
  }
}

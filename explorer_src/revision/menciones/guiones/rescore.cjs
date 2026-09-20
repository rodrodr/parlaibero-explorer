// Vuelve a puntuar la muestra revisada a mano (revision/XX.json, sobre la salida v5) con la salida v6: para cada mención de la
// muestra, ¿sigue igual, cambia de persona o desaparece?
const fs = require('fs');
const PAISES = (process.argv[2] || 'AR BR CL CO CR DO EC ES GT MX PA PE PT PY SV UY').split(' ');
const N = 10, SEMILLA = 7;
const quien = (m) => (m ? (m.tipo === 'diputado' ? (m.estado === 'resuelta' ? `M:${m.d.id}` : `M?${m.estado}`) : `E:${m.persona}`) : '—');
let tot = { correcta: { igual: 0, cambia: 0, desaparece: 0 }, incorrecta: { igual: 0, cambia: 0, desaparece: 0 } };
const filas = [];
for (const p of PAISES) {
  const v5 = JSON.parse(fs.readFileSync(`paises/${p}/menciones.json`, 'utf8')).menciones;
  const v6 = JSON.parse(fs.readFileSync(`paises/${p}/menciones6.json`, 'utf8')).menciones;
  const rev = JSON.parse(fs.readFileSync(`revision/${p}.json`, 'utf8'));
  // la misma muestra que muestra_precision.cjs
  let s = SEMILLA; const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const muestra = (xs, n) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  const cats = [
    v5.filter((m) => m.tipo === 'diputado' && m.estado === 'resuelta' && !m.suelta && !m.sinNombre && !m.alaPresidencia),
    v5.filter((m) => m.tipo === 'diputado' && m.estado === 'resuelta' && m.suelta),
    v5.filter((m) => m.tipo === 'diputado' && m.sinNombre),
    v5.filter((m) => m.tipo === 'externa' && !m.suelta && !m.antiguo && !m.sinNombre),
    v5.filter((m) => m.tipo === 'externa' && m.antiguo),
    v5.filter((m) => m.tipo === 'externa' && m.suelta),
  ];
  const sample = []; for (const xs of cats) sample.push(...muestra(xs, N));
  const porFila = new Map(); for (const m of v6) { if (!porFila.has(m.id)) porFila.set(m.id, []); porFila.get(m.id).push(m); }
  const res = { correcta: { igual: 0, cambia: 0, desaparece: 0 }, incorrecta: { igual: 0, cambia: 0, desaparece: 0 } };
  sample.forEach((m, k) => {
    const r = rev.find((x) => x.n === k + 1); if (!r || !res[r.veredicto]) return;
    const cand = (porFila.get(m.id) || []).filter((x) => x.texto === m.texto || (x.texto && (x.texto.includes(m.texto) || m.texto.includes(x.texto))) );
    const mismoCtx = cand.filter((x) => x.ctx === m.ctx);
    const n6 = (mismoCtx.length ? mismoCtx : cand)[0];
    const estado = !n6 ? 'desaparece' : quien(n6) === quien(m) ? 'igual' : 'cambia';
    res[r.veredicto][estado]++; tot[r.veredicto][estado]++;
    if (estado !== 'igual') filas.push(`${p} #${k + 1} ${r.veredicto.padEnd(10)} ${estado.padEnd(10)} ${m.texto} : ${quien(m)} → ${quien(n6)}${n6 && n6.tipo === 'externa' && n6.persona !== m.persona ? '' : ''}`);
  });
  const c = res.correcta, i = res.incorrecta;
  const antes = (c.igual + c.cambia + c.desaparece) / Math.max(1, c.igual + c.cambia + c.desaparece + i.igual + i.cambia + i.desaparece);
  console.log(`${p}: correctas ${c.igual + c.cambia + c.desaparece} (se mantienen ${c.igual}, cambian ${c.cambia}, desaparecen ${c.desaparece}) · incorrectas ${i.igual + i.cambia + i.desaparece} (siguen ${i.igual}, cambian ${i.cambia}, desaparecen ${i.desaparece}) · precisión v5 ${(100 * antes).toFixed(0)} %`);
}
console.log('TOTAL', JSON.stringify(tot));
fs.writeFileSync('rescore_detalle.txt', filas.join('\n'));

// Segunda ronda: la muestra se sacó de menciones6_0.json (v6.0, semilla 23, 8 por categoría); se compara con menciones6.json.
const fs = require('fs');
const quien = (m) => (m ? (m.tipo === 'diputado' ? (m.estado === 'resuelta' ? `M:${m.d.id}` : `M?${m.estado}`) : `E:${m.persona}`) : '—');
const tot = { correcta: { igual: 0, cambia: 0, desaparece: 0 }, incorrecta: { igual: 0, cambia: 0, desaparece: 0 } };
const det = [];
for (const p of 'AR BR CL CO CR DO EC ES GT MX PA PE PT PY SV UY'.split(' ')) {
  const a = JSON.parse(fs.readFileSync(`paises/${p}/menciones6_0.json`, 'utf8')).menciones;
  const b = JSON.parse(fs.readFileSync(`paises/${p}/menciones6.json`, 'utf8')).menciones;
  const rev = JSON.parse(fs.readFileSync(`revision6/${p}.json`, 'utf8'));
  let s = 23; const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const muestra = (xs, n) => { const q = xs.slice(); for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; } return q.slice(0, n); };
  const cats = [
    a.filter((m) => m.tipo === 'diputado' && m.estado === 'resuelta' && !m.suelta && !m.sinNombre && !m.alaPresidencia),
    a.filter((m) => m.tipo === 'diputado' && m.estado === 'resuelta' && m.suelta),
    a.filter((m) => m.tipo === 'diputado' && m.estado === 'resuelta' && m.sinNombre),
    a.filter((m) => m.tipo === 'externa' && !m.suelta && !m.antiguo && !m.sinNombre),
    a.filter((m) => m.tipo === 'externa' && m.antiguo),
    a.filter((m) => m.tipo === 'externa' && m.suelta),
    a.filter((m) => m.tipo === 'externa' && m.sinNombre),
  ];
  const sample = []; for (const xs of cats) sample.push(...muestra(xs, 8));
  const porFila = new Map(); for (const m of b) { if (!porFila.has(m.id)) porFila.set(m.id, []); porFila.get(m.id).push(m); }
  const res = { correcta: { igual: 0, cambia: 0, desaparece: 0 }, incorrecta: { igual: 0, cambia: 0, desaparece: 0 } };
  sample.forEach((m, k) => {
    const r = rev.find((x) => x.n === k + 1); if (!r || !res[r.veredicto]) return;
    const cand = (porFila.get(m.id) || []).filter((x) => x.i === m.i || (x.i != null && m.i != null && x.i < m.i + m.largo && m.i < x.i + x.largo));
    const n6 = cand[0];
    const estado = !n6 ? 'desaparece' : quien(n6) === quien(m) ? 'igual' : 'cambia';
    res[r.veredicto][estado]++; tot[r.veredicto][estado]++;
    if (estado !== 'igual') det.push(`${p} #${k + 1} ${r.veredicto.padEnd(10)} ${estado.padEnd(10)} ${m.texto} : ${quien(m)} → ${quien(n6)}`);
  });
  const c = res.correcta, i = res.incorrecta, C = c.igual + c.cambia + c.desaparece, I = i.igual + i.cambia + i.desaparece;
  console.log(`${p}: correctas ${C} (se mantienen ${c.igual}, cambian ${c.cambia}, desaparecen ${c.desaparece}) · incorrectas ${I} (siguen ${i.igual}, cambian ${i.cambia}, desaparecen ${i.desaparece})`);
}
console.log('TOTAL', JSON.stringify(tot));
fs.writeFileSync('rescore2_detalle.txt', det.join('\n'));

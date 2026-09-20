// Precisión de la versión en curso sobre la muestra de la 3.ª ronda (revisada sobre la v6.2): las menciones que siguen igual
// conservan su veredicto; las que desaparecen salen de la cuenta; las que cambian se juzgan a mano (ARREGLADAS: pasan a correctas).
const fs = require('fs');
const quien = (m) => (m ? (m.tipo === 'diputado' ? (m.estado === 'resuelta' ? `M:${m.d.id}` : `M?${m.estado}`) : `E:${m.persona}`) : '—');
const ARREGLADAS = new Set(['CL#18', 'CR#19', 'PA#5', 'PA#23', 'PY#18', 'UY#4', 'BR#10']);   // revisadas a mano: la persona o el nodo son ahora los correctos
const filas = []; const T = { v62: [0, 0, 0], ahora: [0, 0, 0] };   // [correctas, incorrectas, correctas que deben contar]
for (const p of 'AR BR CL CO CR DO EC ES GT MX PA PE PT PY SV UY'.split(' ')) {
  const a = JSON.parse(fs.readFileSync(`paises/${p}/menciones6_2.json`, 'utf8')).menciones;
  const b = JSON.parse(fs.readFileSync(`paises/${p}/menciones6.json`, 'utf8')).menciones;
  const rev = JSON.parse(fs.readFileSync(`revision7/${p}.json`, 'utf8'));
  let s = 31; const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
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
  const v = [0, 0, 0], h = [0, 0, 0];
  sample.forEach((m, k) => {
    const r = rev.find((x) => x.n === k + 1); if (!r || (r.veredicto !== 'correcta' && r.veredicto !== 'incorrecta')) return;
    const ok = r.veredicto === 'correcta', cuenta = ok && !r.no_deberia_contar;
    v[ok ? 0 : 1]++; if (cuenta) v[2]++;
    const cand = (porFila.get(m.id) || []).filter((x) => x.i === m.i || (x.i != null && m.i != null && x.i < m.i + m.largo && m.i < x.i + x.largo));
    const n6 = cand.find((x) => quien(x) === quien(m)) || cand[0];
    if (!n6) return;
    const ahoraOk = quien(n6) === quien(m) ? ok : (ok || ARREGLADAS.has(`${p}#${k + 1}`));
    h[ahoraOk ? 0 : 1]++; if (ahoraOk && !r.no_deberia_contar) h[2]++;
  });
  for (let q = 0; q < 3; q++) { T.v62[q] += v[q]; T.ahora[q] += h[q]; }
  const pc = (x, y) => `${(100 * x / Math.max(1, y)).toFixed(0)} %`;
  filas.push(`| ${p} | ${v[0]}/${v[0] + v[1]} (${pc(v[0], v[0] + v[1])}) | ${pc(v[2], v[0] + v[1])} | ${h[0]}/${h[0] + h[1]} (${pc(h[0], h[0] + h[1])}) | ${pc(h[2], h[0] + h[1])} |`);
}
const pc = (x, y) => `${(100 * x / Math.max(1, y)).toFixed(1)} %`;
console.log('| País | v6.2: correctas | v6.2: útiles | actual: correctas | actual: útiles |\n|---|---|---|---|---|\n' + filas.join('\n'));
console.log(`| Total | ${T.v62[0]}/${T.v62[0] + T.v62[1]} (${pc(T.v62[0], T.v62[0] + T.v62[1])}) | ${pc(T.v62[2], T.v62[0] + T.v62[1])} | ${T.ahora[0]}/${T.ahora[0] + T.ahora[1]} (${pc(T.ahora[0], T.ahora[0] + T.ahora[1])}) | ${pc(T.ahora[2], T.ahora[0] + T.ahora[1])} |`);

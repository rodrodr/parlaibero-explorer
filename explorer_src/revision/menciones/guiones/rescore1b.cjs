// 1.ª ronda (muestra de v5, revision/XX.json) contra la salida actual, casando por posición en el texto (la v5 no la guardaba: se
// recupera con el contexto) y no por el texto de la mención («Carlos» de v5 y «Carlos Smith» o «Smith» ahora son la misma mención).
const fs = require('fs');
const quien = (m) => (m ? (m.tipo === 'diputado' ? (m.estado === 'resuelta' ? `M:${m.d.id}` : `M?${m.estado}`) : `E:${m.persona}`) : '—');
const tot = { correcta: { igual: 0, cambia: 0, desaparece: 0 }, incorrecta: { igual: 0, cambia: 0, desaparece: 0 } };
const det = [], porPais = {};
const mesaDe = (p) => { try { return new Set(JSON.parse(fs.readFileSync(`mesa/${p}.json`, 'utf8'))); } catch (e) { return new Set(); } };
for (const p of (process.argv[2] || 'AR BR CL CO CR DO EC ES GT MX PA PE PT PY SV UY').split(' ')) {
  const v5 = JSON.parse(fs.readFileSync(`paises/${p}/menciones.json`, 'utf8')).menciones;
  const v6 = JSON.parse(fs.readFileSync(`paises/${p}/menciones6.json`, 'utf8')).menciones;
  const rev = JSON.parse(fs.readFileSync(`revision/${p}.json`, 'utf8'));
  const bib = new Map(JSON.parse(fs.readFileSync(`paises/${p}/biblioteca.json`, 'utf8')).map((f) => [f.id, f]));
  const mesa = mesaDe(p);
  let s = 7; const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const muestra = (xs, n) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  const cats = [
    v5.filter((m) => m.tipo === 'diputado' && m.estado === 'resuelta' && !m.suelta && !m.sinNombre && !m.alaPresidencia),
    v5.filter((m) => m.tipo === 'diputado' && m.estado === 'resuelta' && m.suelta),
    v5.filter((m) => m.tipo === 'diputado' && m.sinNombre),
    v5.filter((m) => m.tipo === 'externa' && !m.suelta && !m.antiguo && !m.sinNombre),
    v5.filter((m) => m.tipo === 'externa' && m.antiguo),
    v5.filter((m) => m.tipo === 'externa' && m.suelta),
  ];
  const sample = []; for (const xs of cats) sample.push(...muestra(xs, 10));
  const porFila = new Map(); for (const m of v6) { if (!porFila.has(m.id)) porFila.set(m.id, []); porFila.get(m.id).push(m); }
  const res = { correcta: { igual: 0, cambia: 0, desaparece: 0 }, incorrecta: { igual: 0, cambia: 0, desaparece: 0 } };
  sample.forEach((m, k) => {
    const r = rev.find((x) => x.n === k + 1); if (!r || !res[r.veredicto]) return;
    // posición de la mención de v5 en el texto de la fila, por su contexto
    const texto = String((bib.get(m.id) || {}).text || ''); let norm = '', mapa = [];
    for (let q = 0; q < texto.length; q++) { if (/\s/.test(texto[q])) { if (norm.endsWith(' ')) continue; norm += ' '; } else norm += texto[q]; mapa.push(q); }
    const ctx = String(m.ctx || ''), tx = String(m.texto || '').replace(/\s+/g, ' ');
    let i5 = -1; const pc = norm.indexOf(ctx);
    if (pc >= 0) { let best = -1, d = 1e9; for (let q = ctx.indexOf(tx); q >= 0; q = ctx.indexOf(tx, q + 1)) if (Math.abs(q - 70) < d) { d = Math.abs(q - 70); best = q; } if (best >= 0) i5 = mapa[pc + best]; }
    // las posiciones de ahora son del texto ya arreglado (guiones de fin de línea…): se admite un desfase
    const pl = (t) => String(t || '').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const t5 = new Set(pl(m.texto));
    const cand = (porFila.get(m.id) || []).filter((x) => (i5 >= 0 && x.i != null)
      ? ((Math.abs(x.i - i5) <= 300 && pl(x.texto).some((w) => t5.has(w))) || (Math.abs(x.i - i5) <= 40 && quien(x) === quien(m)))
      : (x.texto === m.texto || (x.texto && (x.texto.includes(m.texto) || m.texto.includes(x.texto)))));
    const n6 = cand.find((x) => quien(x) === quien(m)) || cand[0];
    const estado = !n6 ? 'desaparece' : quien(n6) === quien(m) ? 'igual' : 'cambia';
    res[r.veredicto][estado]++; tot[r.veredicto][estado]++;
    if (estado !== 'igual') det.push(`${p} #${k + 1} ${r.veredicto.padEnd(10)} ${estado.padEnd(10)} ${mesa.has(m.id) ? '[Mesa] ' : ''}${m.texto} : ${quien(m)} → ${quien(n6)}`);
  });
  porPais[p] = res;
  const c = res.correcta, i = res.incorrecta;
  console.log(`${p}: correctas ${c.igual + c.cambia + c.desaparece} (se mantienen ${c.igual}, cambian ${c.cambia}, desaparecen ${c.desaparece}) · incorrectas ${i.igual + i.cambia + i.desaparece} (siguen ${i.igual}, cambian ${i.cambia}, desaparecen ${i.desaparece})`);
}
console.log('TOTAL', JSON.stringify(tot));
fs.writeFileSync('rescore1b_detalle.txt', det.join('\n'));
fs.writeFileSync('rescore1b.json', JSON.stringify(porPais));

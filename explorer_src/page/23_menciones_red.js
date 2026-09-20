'use strict';

/* Red de menciones en anillos (pestaña «Menciones» de la biblioteca; el marcado lo pone page/22_menciones.js).
 *
 * Una vista combina una agrupación (sectores por partido o por foco), un sentido y, en el modo ego, una persona en el centro:
 *   todas      todas las personas; anillo, con cuántas personas distintas está conectada en los dos sentidos;
 *   hechas     solo quienes mencionan a alguien; anillo y tamaño, a cuántas personas distintas menciona;
 *   recibidas  solo quienes son mencionadas; anillo y tamaño, cuántos oradores distintos la mencionan.
 * En el modo ego quedan la persona elegida y sus conexiones en ese sentido, y el anillo mide las menciones entre cada una
 * y ella. Las aristas se dibujan entre personas de la vista (en el modo ego, también las que hay entre sus conexiones);
 * los tamaños son los de la red entera. Los sectores van de más a menos peso desde las 12 en el sentido de las agujas del
 * reloj y, dentro de cada uno, de la persona más a la menos central.
 * Con el filtro de conexiones de 2 o más menciones, cada vista se calcula solo con ellas: en «Todas», los pares con 2 o más
 * menciones sumando los dos sentidos; en «Hechas» y «Recibidas», las menciones repetidas (una persona menciona a otra dos
 * o más veces). Quien se queda sin ninguna sale de la vista y los anillos cuentan solo esas conexiones.
 */

function menRedIniciar(D) {
  const RED = D.red, NS = 'http://www.w3.org/2000/svg', svg = menEl('menRed');
  if (!svg || !RED || !RED.nodos.length) return;
  const NN = RED.nodos.length, CX = 500, CY = 360;
  const radioDe = (valor) => 2 + 1.55 * Math.sqrt(valor);
  const mk = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
  const ady = RED.nodos.map(() => []);
  const vecinos = RED.nodos.map(() => new Set());
  RED.aristas.forEach(([a, b], q) => { ady[a].push(q); ady[b].push(q); vecinos[a].add(b); vecinos[b].add(a); });
  const centralidad = vecinos.map((s) => s.size);
  const hechas = new Float64Array(NN);                              // menciones que hace cada persona
  RED.aristas.forEach(([a, b, ab, ba]) => { hechas[a] += ab; hechas[b] += ba; });
  // Con el filtro: con cuántas personas suma 2 o más menciones, a cuántas menciona dos o más veces y cuántas la mencionan así
  const vecF = new Int32Array(NN), salF = new Int32Array(NN), entF = new Int32Array(NN);
  RED.aristas.forEach(([a, b, ab, ba]) => {
    if (ab + ba >= 2) { vecF[a]++; vecF[b]++; }
    if (ab >= 2) { salF[a]++; entF[b]++; }
    if (ba >= 2) { salF[b]++; entF[a]++; }
  });
  /** Si la arista q es una conexión de 2 o más menciones en el sentido `sen`. */
  const fuerte = (sen, q) => { const [, , ab, ba] = RED.aristas[q]; return sen === 'todas' ? ab + ba >= 2 : Math.max(ab, ba) >= 2; };
  const SENTIDOS = {
    todas: { entra: () => true, medida: (i) => centralidad[i], tam: (i) => RED.nodos[i].or, peso: (i) => RED.nodos[i].men, titulo: 'conexiones distintas',
      fuertes: { medida: (i) => vecF[i], titulo: 'conexiones distintas de 2 o más menciones' } },
    hechas: { entra: (i) => RED.nodos[i].emite > 0, medida: (i) => RED.nodos[i].emite, tam: (i) => RED.nodos[i].emite, peso: (i) => hechas[i], titulo: 'personas distintas a las que menciona',
      fuertes: { medida: (i) => salF[i], titulo: 'personas distintas a las que menciona dos o más veces' } },
    recibidas: { entra: (i) => RED.nodos[i].or > 0, medida: (i) => RED.nodos[i].or, tam: (i) => RED.nodos[i].or, peso: (i) => RED.nodos[i].men, titulo: 'oradores distintos que la mencionan',
      fuertes: { medida: (i) => entF[i], titulo: 'oradores distintos que la mencionan dos o más veces' } },
  };

  // Agrupaciones: sectores, nombres y colores (los colores de partido, fijos: los ocho partidos más mencionados)
  const pesoPartido = new Map();
  RED.nodos.forEach((nd) => { if (!nd.ext) pesoPartido.set(nd.p, (pesoPartido.get(nd.p) || 0) + nd.men); });
  const PARTIDOS = [...pesoPartido.entries()].filter(([g]) => g && g !== '?' && g !== 'Sin identificar')
    .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);
  const ORDEN = { todas: 'de más a menos mencionados', hechas: 'de más a menos menciones hechas', recibidas: 'de más a menos mencionados' };
  const ordenTexto = (sen, e) => `${e ? `de más a menos menciones con ${e}` : ORDEN[sen]} desde arriba en el sentido de las agujas del reloj; dentro de cada sector, ${e ? `de la persona más a la menos conectada con ${e}` : 'de la persona más a la menos central'}`;
  const AGRUPA = {
    partido: {
      grupoDe: (nd) => (nd.ext ? 'Externas' : PARTIDOS.includes(nd.p) ? nd.p : 'Otros'),
      ultimo: 'Otros',
      nombre: (g) => (g === 'Externas' ? 'Personas externas' : g === 'Otros' ? 'Otros partidos' : g),
      color: (nd) => { if (nd.ext) return 'var(--men-ext)'; const q = PARTIDOS.indexOf(nd.p); return q >= 0 ? `var(--men-f${q + 1})` : 'var(--text-faint)'; },
      leyenda: () => PARTIDOS.map((p, q) => [`var(--men-f${q + 1})`, p]).concat([['var(--text-faint)', 'otros partidos'], ['var(--men-ext)', 'personas externas', 'cuadro']]),
      explica: (sen, e) => `Sectores: ${sen === 'hechas' && !e ? 'partidos' : 'personas externas y partidos'}, ${ordenTexto(sen, e)}.`,
    },
    foco: {
      grupoDe: (nd) => (nd.f && nd.f <= 8 ? `F${nd.f}` : 'Fuera'),   // la paleta tiene ocho colores: los focos 9 y siguientes, con «otros»
      ultimo: 'Fuera',
      nombre: (g) => (g === 'Fuera' ? (D.focos.length > 8 ? 'Otros focos' : 'Fuera de los focos') : `${g} · ${D.focos[Number(g.slice(1)) - 1].centrales[0].n}`),
      color: (nd) => (nd.f && nd.f <= 8 ? `var(--men-f${nd.f})` : 'var(--text-faint)'),
      leyenda: () => D.focos.slice(0, 8).map((f) => [`var(--men-f${f.id})`, `F${f.id} · ${f.centrales[0].n}`])
        .concat([['var(--text-faint)', D.focos.length > 8 ? `otros ${D.focos.length - 8} focos y fuera de ellos` : 'fuera de los focos'], ['', 'persona externa', 'cuadro vacio']]),
      explica: (sen, e) => `Sectores: focos de conversación (comunidades de Leiden), ${ordenTexto(sen, e)}.${sen === 'hechas' && !e ? '' : ' Las personas externas (cuadrados) quedan en el sector de su foco, con su color.'}`,
    },
  };

  // Anillos por cuantiles de la medida (el 3 % más central, el 7 % siguiente, el 15 %, el 30 % y el resto), sin partir
  // empates: cada frontera se lleva al cambio de valor más cercano, así que dos personas con la misma cifra comparten anillo.
  const CORTES = [0.03, 0.10, 0.25, 0.55, 1], RADIOS = [70, 138, 202, 262, 318], HUECO = 0.2;
  function fronterasDe(valores) {
    const n = valores.length, fronteras = [];
    let previo = 0;
    for (let k = 0; k < CORTES.length - 1; k++) {
      const c = Math.max(previo, Math.min(n, Math.round(CORTES[k] * n)));
      let arriba = c, abajo = c;
      while (arriba > previo && arriba < n && valores[arriba - 1] === valores[arriba]) arriba--;
      while (abajo > 0 && abajo < n && valores[abajo - 1] === valores[abajo]) abajo++;
      const f = arriba > previo && (c - arriba <= abajo - c || abajo >= n) ? arriba : abajo;
      fronteras.push(f); previo = f;
    }
    fronteras.push(n);
    return fronteras;
  }
  /** Menciones entre la persona e y cada una de sus conexiones en el sentido `sen` (persona → menciones); con `fuertes`,
   *  solo las de 2 o más. */
  function lazos(e, sen, fuertes) {
    const m = new Map();
    for (const q of ady[e]) {
      const [a, b, ab, ba] = RED.aristas[q];
      const hace = a === e ? ab : ba, recibe = a === e ? ba : ab;
      const f = sen === 'hechas' ? hace : sen === 'recibidas' ? recibe : hace + recibe;
      if (f >= (fuertes ? 2 : 1)) m.set(a === e ? b : a, f);
    }
    return m;
  }
  const VISTAS = new Map();
  function disponer(agr, sen, ego = -1, fuertes = false) {
    const clave = `${agr}|${sen}|${ego}|${fuertes}`;
    if (VISTAS.has(clave)) return VISTAS.get(clave);
    const A = AGRUPA[agr], S0 = SENTIDOS[sen], fuerza = ego >= 0 ? lazos(ego, sen, fuertes) : null;
    const SS = fuertes ? { ...S0, entra: (i) => S0.fuertes.medida(i) > 0, medida: S0.fuertes.medida, titulo: S0.fuertes.titulo } : S0;
    const medida = fuerza ? (i) => fuerza.get(i) : SS.medida, peso = fuerza ? medida : SS.peso;
    const orden = (fuerza ? [...fuerza.keys()] : [...Array(NN).keys()].filter(SS.entra)).sort((a, b) => medida(b) - medida(a) || SS.tam(b) - SS.tam(a) || a - b);
    const n = orden.length, fronteras = fronterasDe(orden.map(medida));
    const anillo = new Int8Array(NN).fill(-1), minimo = RADIOS.map(() => null);
    orden.forEach((i, r) => { const k = fronteras.findIndex((f) => r < f); anillo[i] = k; minimo[k] = medida(i); });
    // Radios: los cinco de siempre; en el modo ego, solo los de los anillos con alguien, repartidos entre 110 y 318
    let radios = RADIOS.slice();
    if (fuerza) {
      const usados = RADIOS.map((_, k) => k).filter((k) => minimo[k] !== null);
      radios = RADIOS.map(() => null);
      usados.forEach((k, u) => { radios[k] = usados.length === 1 ? 200 : 110 + (318 - 110) * u / (usados.length - 1); });
    }
    const cuenta = new Map(), pesos = new Map();
    for (const i of orden) { const g = A.grupoDe(RED.nodos[i]); cuenta.set(g, (cuenta.get(g) || 0) + 1); pesos.set(g, (pesos.get(g) || 0) + peso(i)); }
    const grupos = [...cuenta.keys()].filter((g) => g !== A.ultimo).sort((a, b) => pesos.get(b) - pesos.get(a)).concat(cuenta.has(A.ultimo) ? [A.ultimo] : []);
    let angulo = -Math.PI / 2 + HUECO / 2;
    const sectores = grupos.map((g) => { const w = (2 * Math.PI - HUECO) * cuenta.get(g) / n; const s = { g, a0: angulo, a1: angulo + w }; angulo += w; return s; });
    const pos = new Array(NN).fill(null), visibles = new Uint8Array(NN);
    for (const s of sectores) for (let k = 0; k < RADIOS.length; k++) {
      if (radios[k] === null) continue;
      const miembros = orden.filter((i) => anillo[i] === k && A.grupoDe(RED.nodos[i]) === s.g);   // en orden de centralidad
      const margen = Math.min(0.015, (s.a1 - s.a0) * 0.1);
      miembros.forEach((i, q) => {
        const a = s.a0 + margen + (s.a1 - s.a0 - 2 * margen) * (q + 0.5) / miembros.length;
        pos[i] = { x: CX + radios[k] * Math.cos(a), y: CY + radios[k] * Math.sin(a) };
      });
    }
    orden.forEach((i) => { visibles[i] = 1; });
    if (ego >= 0) { visibles[ego] = 1; pos[ego] = { x: CX, y: CY }; }
    for (let i = 0; i < NN; i++) if (!pos[i]) pos[i] = { x: CX, y: CY };
    const e = ego >= 0 ? RED.nodos[ego].n : '', usados = radios.filter((r) => r !== null);
    const v = {
      ego, sen, fuertes, n, pos, sectores, minimo, radios, curva: fuerza ? 0.3 : 0.75, firma: `${sen}|${ego}|${fuertes}`,
      rInterior: usados.length ? Math.min(...usados) : RADIOS[0], rExterior: usados.length ? Math.max(...usados) : RADIOS[RADIOS.length - 1],
      titulo: !fuerza ? SS.titulo : sen === 'hechas' ? `veces que ${e} la menciona` : sen === 'recibidas' ? `veces que menciona a ${e}` : `menciones entre cada persona y ${e}`,
      visible: (i) => visibles[i] === 1, tam: SS.tam,
      prioridad: fuerza ? (i) => (i === ego ? Infinity : fuerza.get(i) || 0) : SS.tam,   // orden para poner nombres
    };
    VISTAS.set(clave, v);
    return v;
  }
  let agrupar = MEN.agrupar, sentido = MEN.sentido;
  let V = disponer(agrupar, sentido, -1, MEN.fuertes);
  let anima = null, acabar = null, moviendo = false, curvaActual = V.curva;
  const pos = V.pos.map((p) => ({ x: p.x, y: p.y }));
  const radioActual = RED.nodos.map((_, i) => radioDe(V.tam(i)));
  const aristaEn = (vista, q) => vista.visible(RED.aristas[q][0]) && vista.visible(RED.aristas[q][1]) && (!vista.fuertes || fuerte(vista.sen, q));

  // Tamaño: la red cabe en la parte visible del panel de la lista junto con sus controles, la ficha y la leyenda. El dibujo
  // (viewBox 1000 × 720) se escala dentro y los textos crecen hasta 1,4 veces para seguir legibles cuando la red se encoge;
  // `lim` es la parte del viewBox que se ve (más ancha si sobra sitio a los lados).
  let escala = 1, fTexto = 1, lim = { x0: 0, x1: 1000, y0: 0, y1: 720 };

  // Capas: anillos y sus rótulos, sectores, aristas, nodos y nombres
  const gZoom = mk('g', {}), gRT = mk('g', {}), gS = mk('g', {}), gA = mk('g', {}), gN = mk('g', {}), gT = mk('g', {});
  gZoom.append(gRT, gS, gA, gN, gT); svg.append(gZoom);
  function pintarAnillos() {
    gRT.textContent = '';
    V.radios.forEach((r, k) => {
      if (r === null) return;
      gRT.append(mk('circle', { class: 'men-anillo', cx: CX, cy: CY, r: r.toFixed(1) }));
      if (V.minimo[k] === null) return;
      const t = mk('text', { class: 'men-guia', x: CX, y: (CY - r + 3.5 * fTexto).toFixed(1), 'text-anchor': 'middle', 'font-size': (10 * fTexto).toFixed(1) });
      t.textContent = `${k === 0 && V.ego < 0 ? 'núcleo · ' : ''}≥ ${nf(V.minimo[k])}`;
      gRT.append(t);
    });
    if (V.ego >= 0 && !V.n) return;                                 // modo ego sin nadie alrededor
    const t = mk('text', { class: 'men-guia', x: CX, y: CY - RADIOS[RADIOS.length - 1] - 26, 'text-anchor': 'middle', 'font-size': (10 * fTexto).toFixed(1) });
    t.textContent = V.titulo;
    gRT.append(t);
  }
  function pintarSectores() {
    gS.textContent = '';
    const A = AGRUPA[agrupar], rOut = V.rExterior, f = fTexto, wt = V.titulo.length * 5.4 * f + 8, yt = CY - RADIOS[RADIOS.length - 1] - 26;
    const puestos = [{ x0: CX - wt / 2, x1: CX + wt / 2, y0: yt - 11 * f, y1: yt + 6 }];   // el título de los anillos
    for (const s of V.sectores) {
      const c0 = Math.cos(s.a0), s0 = Math.sin(s.a0);
      gS.append(mk('line', { class: 'men-sector', x1: CX + (V.rInterior - 28) * c0, y1: CY + (V.rInterior - 28) * s0, x2: CX + (rOut + 12) * c0, y2: CY + (rOut + 12) * s0 }));
      const am = (s.a0 + s.a1) / 2, ca = Math.cos(am), sa = Math.sin(am), rr = rOut + 14 + 4 * f;
      const nombre = A.nombre(s.g), ancla = ca > 0.25 ? 'start' : ca < -0.25 ? 'end' : 'middle';
      const x = CX + rr * ca, y = CY + rr * sa + 4 * f, w = nombre.length * 6.6 * f + 4;
      const x0 = ancla === 'start' ? x : ancla === 'end' ? x - w : x - w / 2, caja = { x0, x1: x0 + w, y0: y - 12 * f, y1: y + 3 };
      if (puestos.some((b) => caja.x0 < b.x1 && caja.x1 > b.x0 && caja.y0 < b.y1 && caja.y1 > b.y0)) continue;   // sector sin sitio para su rótulo (la leyenda lo nombra)
      puestos.push(caja);
      const t = mk('text', { class: 'men-partido', x: x.toFixed(1), y: y.toFixed(1), 'font-size': (12 * f).toFixed(1), 'text-anchor': ancla });
      t.textContent = nombre;
      gS.append(t);
    }
  }
  const lineas = RED.aristas.map(([, , ab, ba], q) => {
    const l = mk('path', { class: 'men-arista', 'stroke-width': (0.5 + 0.55 * Math.log2(1 + ab + ba)).toFixed(2) });
    l.style.strokeDashoffset = ((q * 2.7) % 7).toFixed(1);          // discontinuas desfasadas: que no dibujen anillos al converger
    if (!aristaEn(V, q)) l.classList.add('fuera');
    gA.append(l); return l;
  });
  // Cada persona es un círculo si tiene escaño y un cuadrado de la misma área si es una persona externa
  const LADO = Math.sqrt(Math.PI) / 2;                              // medio lado del cuadrado con el área del círculo de radio 1
  const circulos = RED.nodos.map((nd, i) => {
    const c = mk(nd.ext ? 'rect' : 'circle', { class: 'men-nodo', 'data-i': i });
    if (!V.visible(i)) c.classList.add('fuera');
    return c;
  });
  function ponerNodo(i) {
    const el = circulos[i], x = pos[i].x, y = pos[i].y, r = radioActual[i];
    if (RED.nodos[i].ext) {
      const h = r * LADO;
      el.setAttribute('x', (x - h).toFixed(1)); el.setAttribute('y', (y - h).toFixed(1));
      el.setAttribute('width', (2 * h).toFixed(2)); el.setAttribute('height', (2 * h).toFixed(2));
    } else { el.setAttribute('cx', x.toFixed(1)); el.setAttribute('cy', y.toFixed(1)); el.setAttribute('r', r.toFixed(2)); }
  }
  function apilar() { [...Array(NN).keys()].sort((i, j) => radioActual[i] - radioActual[j] || i - j).forEach((i) => gN.append(circulos[i])); }   // los grandes, encima
  function colocar() {
    for (let i = 0; i < NN; i++) ponerNodo(i);
    const eg = V.ego, rEgo = eg >= 0 ? radioActual[eg] : 0, cuadro = eg >= 0 && RED.nodos[eg].ext;
    RED.aristas.forEach(([a, b], q) => {
      let pa = pos[a], pb = pos[b];
      if (eg >= 0 && (a === eg || b === eg)) {                     // en el modo ego, las aristas del centro nacen en el borde de su figura
        const [p0, p1] = a === eg ? [pa, pb] : [pb, pa], d = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
        const ux = (p1.x - p0.x) / d, uy = (p1.y - p0.y) / d, t = (cuadro ? rEgo * LADO / Math.max(Math.abs(ux), Math.abs(uy), 1e-6) : rEgo) + 1.5;
        const borde = { x: p0.x + ux * t, y: p0.y + uy * t };
        if (a === eg) pa = borde; else pb = borde;
      }
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      const qx = mx + (CX - mx) * curvaActual, qy = my + (CY - my) * curvaActual;   // control hacia el centro
      lineas[q].setAttribute('d', `M${pa.x.toFixed(1)},${pa.y.toFixed(1)}Q${qx.toFixed(1)},${qy.toFixed(1)} ${pb.x.toFixed(1)},${pb.y.toFixed(1)}`);
    });
  }
  function pintarColores() {
    const A = AGRUPA[agrupar];
    RED.nodos.forEach((nd, i) => { circulos[i].style.fill = A.color(nd); });
    menEl('menLeyenda').innerHTML = A.leyenda().map(([c, t, forma]) =>
      `<span><i${forma ? ` class="${forma}"` : ''}${c ? ` style="background:${c}"` : ''}></i>${esc(t)}</span>`).join('');
  }
  let fijado = -1;
  const vista = { x: 0, y: 0, k: 1 };
  /** Nombres sin solaparse (en coordenadas de pantalla); más al acercar. `solo`: limitarse a esas personas. */
  function pintarEtiquetas(solo) {
    if (moviendo) return;                                          // durante la transición, los nombres siguen a su persona
    gT.textContent = '';
    const puestos = [], limite = solo ? 30 : Math.round(20 * Math.sqrt(vista.k));
    const cand = (solo ? [...solo] : [...Array(NN).keys()].filter((i) => V.visible(i) && V.prioridad(i) > 0)).sort((i, j) => V.prioridad(j) - V.prioridad(i));
    let n = 0;
    const f = fTexto;
    for (const i of cand) {
      if (n >= limite) break;
      const nd = RED.nodos[i], rr = radioActual[i] * vista.k;
      const sx = pos[i].x * vista.k + vista.x, sy = pos[i].y * vista.k + vista.y;
      if (sx < lim.x0 || sx > lim.x1 || sy < lim.y0 || sy > lim.y1) continue;
      const caja = { x: sx + rr + 3 * f, y: sy - 7 * f, w: (nd.n.length * 6.4 + 4) * f, h: 14 * f };
      if (puestos.some((b) => caja.x < b.x + b.w && caja.x + caja.w > b.x && caja.y < b.y + b.h && caja.y + caja.h > b.y)) continue;
      puestos.push(caja);
      const t = mk('text', { 'data-i': i, x: (pos[i].x + (rr + 3 * f) / vista.k).toFixed(1), y: (pos[i].y + 4 * f / vista.k).toFixed(1), 'font-size': (11 * f / vista.k).toFixed(2) });
      t.style.strokeWidth = `${(3 * f / vista.k).toFixed(2)}px`;
      t.textContent = nd.n; gT.append(t); n++;
    }
  }
  function seguirEtiquetas() {
    for (const t of gT.children) {
      const i = Number(t.dataset.i);
      t.setAttribute('x', (pos[i].x + radioActual[i] + 3 * fTexto / vista.k).toFixed(1));
      t.setAttribute('y', (pos[i].y + 4 * fTexto / vista.k).toFixed(1));
    }
  }
  function aplicarVista() {
    gZoom.setAttribute('transform', `translate(${vista.x.toFixed(1)},${vista.y.toFixed(1)}) scale(${vista.k.toFixed(3)})`);
    if (fijado >= 0) resaltar(fijado); else pintarEtiquetas();
  }
  function zoom(f, cx = CX, cy = CY) {
    const k = Math.min(8, Math.max(1, vista.k * f)), r = k / vista.k;
    vista.x = cx - (cx - vista.x) * r; vista.y = cy - (cy - vista.y) * r; vista.k = k;
    if (k === 1) { vista.x = 0; vista.y = 0; }
    aplicarVista();
  }
  const puntoSvg = (e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  /** Clase de la arista q vista desde la persona i: a quién menciona (continua), quién la menciona (discontinua) o ambas.
   *  Con el filtro, en «Hechas» y «Recibidas» solo cuentan las menciones repetidas. */
  function claseDesde(i, q) {
    const [a, , ab, ba] = RED.aristas[q], umbral = V.fuertes && sentido !== 'todas' ? 2 : 1;
    const hace = (a === i ? ab : ba) >= umbral, recibe = (a === i ? ba : ab) >= umbral;
    return sentido === 'hechas' ? (hace ? 'sale' : '') : sentido === 'recibidas' ? (recibe ? 'entra' : '')
      : hace && recibe ? 'ambos' : hace ? 'sale' : 'entra';
  }
  /** Resalta a la persona i y sus conexiones en la vista: en «Todas», a quién menciona (continuas) y quién la menciona
   *  (discontinuas); en «Hechas», solo lo primero; en «Recibidas», solo lo segundo. */
  function resaltar(i) {
    const vec = new Set([i]), clases = new Map();
    for (const q of ady[i]) {
      const [a, b] = RED.aristas[q];
      if (!aristaEn(V, q)) continue;
      const clase = claseDesde(i, q);
      if (!clase) continue;
      clases.set(q, clase); vec.add(a === i ? b : a);
    }
    circulos.forEach((c, j) => { c.classList.toggle('apagado', !vec.has(j)); c.classList.toggle('sel', j === fijado); c.classList.toggle('ego', j === V.ego); });
    lineas.forEach((l, q) => {
      const clase = clases.get(q);
      l.classList.remove('sale', 'entra', 'ambos', 'radio');
      l.classList.toggle('apagado', !clase);
      if (clase) l.classList.add(clase);
    });
    pintarEtiquetas(vec);
  }
  /** Sin nadie resaltado: en el modo ego, las aristas de la persona del centro con su sentido, más suaves. */
  function limpiar() {
    circulos.forEach((c, j) => { c.classList.remove('apagado', 'sel'); c.classList.toggle('ego', j === V.ego); });
    lineas.forEach((l) => l.classList.remove('apagado', 'sale', 'entra', 'ambos', 'radio'));
    if (V.ego >= 0) for (const q of ady[V.ego]) if (aristaEn(V, q)) lineas[q].classList.add('radio', claseDesde(V.ego, q) || 'sale');
    pintarEtiquetas();
  }
  const veces = (n) => (n === 1 ? 'una vez' : `${nf(n)} veces`);
  /** En el modo ego, las menciones entre la persona i y la del centro. */
  function conEgo(i) {
    if (V.ego < 0 || i === V.ego) return '';
    const e = esc(RED.nodos[V.ego].n), partes = [];
    for (const q of ady[i]) {
      const [a, b, ab, ba] = RED.aristas[q];
      if (a !== V.ego && b !== V.ego) continue;
      const hace = a === i ? ab : ba, recibe = a === i ? ba : ab;
      if (hace) partes.push(`menciona a ${e} ${veces(hace)}`);
      if (recibe) partes.push(`${e} la menciona ${veces(recibe)}`);
    }
    return partes.length ? ` · ${partes.join(' · ')}` : '';
  }
  /** Ficha de la persona en toda la biblioteca; con el filtro (fuera del modo ego), también la cifra que le da el anillo. */
  const describir = (nd, i) => {
    const f = V.fuertes && V.ego < 0 ? sentido : '';
    return `${nd.ext ? 'persona externa' : esc(nd.p)}${nd.f ? ` · foco F${nd.f}` : ''} · la mencionan ${nf(nd.or)} oradores (${nf(nd.men)} menciones${f === 'recibidas' ? `; ${nf(entF[i])} de ellos, dos o más veces` : ''})`
      + `${nd.emite ? ` · menciona a ${nf(nd.emite)} personas${f === 'hechas' ? ` (a ${nf(salF[i])} dos o más veces)` : ''}` : ''}`
      + ` · conectada con ${nf(centralidad[i])}${f === 'todas' ? ` (con ${nf(vecF[i])} por 2 o más menciones)` : ''}${conEgo(i)}`;
  };
  const CUANTAS = {
    todas: (n) => `sus ${nf(n)} conexiones`,
    hechas: (n) => `las ${nf(n)} personas a las que menciona`,
    recibidas: (n) => `los ${nf(n)} oradores que la mencionan`,
  };
  /** En «Hechas» o «Recibidas» (fuera del modo ego), cuántas de sus conexiones en ese sentido se ven en la vista (con el
   *  filtro, de las de dos o más menciones). En el modo ego con el filtro, cuántas conexiones de la persona del centro faltan. */
  function nota(i) {
    if (V.ego >= 0) {
      if (i !== V.ego || !V.fuertes || !V.n) return '';
      const faltan = lazos(i, sentido, false).size - V.n;
      return faltan > 0 ? `Se ven ${nf(V.n)} de ${CUANTAS[sentido](V.n + faltan)}; ${faltan === 1 ? 'falta 1' : `faltan ${nf(faltan)}`} con una sola mención.` : '';
    }
    if (sentido === 'todas') return '';
    let n = 0, total = 0;
    for (const q of ady[i]) {
      const [a, b, ab, ba] = RED.aristas[q];
      const cuenta = sentido === 'hechas' ? (a === i ? ab : ba) : (a === i ? ba : ab);
      if (cuenta < (V.fuertes ? 2 : 1)) continue;
      total++;
      if (V.visible(a === i ? b : a)) n++;
    }
    if (n >= total) return '';
    const vv = V.fuertes ? ' dos o más veces' : '', mas = V.fuertes ? ' más de una vez' : '', una = total - n === 1;
    return sentido === 'hechas' ? `En esta vista se ven ${nf(n)} de las ${nf(total)} personas a las que menciona${vv}; ${una ? 'la otra no menciona' : 'las demás no mencionan'} a nadie${mas}.`
      : `En esta vista se ven ${nf(n)} de los ${nf(total)} oradores que la mencionan${vv}; ${una ? 'al otro no lo' : 'a los demás no los'} menciona nadie${mas}.`;
  }
  function resumenEgo() {
    const e = esc(RED.nodos[V.ego].n);
    if (V.n) return 'en el centro';
    const mas = V.fuertes && lazos(V.ego, sentido, false).size ? ' más de una vez' : ' en esta biblioteca';
    return `en el centro · ${sentido === 'hechas' ? `${e} no menciona a nadie${mas}` : sentido === 'recibidas' ? `nadie menciona a ${e}${mas}` : 'ninguna de sus conexiones tiene 2 o más menciones'}`;
  }
  function pintarInfo() {
    const boton = menEl('menEgo');
    boton.setAttribute('aria-pressed', String(V.ego >= 0));
    boton.disabled = V.ego < 0 && fijado < 0;
    boton.title = V.ego >= 0 ? 'Volver a toda la red' : fijado >= 0 ? `Rehacer la red solo con ${RED.nodos[fijado].n} y sus conexiones` : 'Fije antes una persona pulsándola';
    const quien = fijado >= 0 ? fijado : V.ego, info = menEl('menInfo');
    if (quien < 0) { info.innerHTML = 'Pulse una persona para fijarla y ver sus conexiones; pulse el fondo para soltarla.'; return; }
    const nd = RED.nodos[quien], n = nota(quien);
    info.innerHTML = `<b>${esc(nd.n)}</b>${quien === V.ego ? `<span>${resumenEgo()}</span>` : ''}<span>${describir(nd, quien)}</span>`
      + (nd.lista >= 0 ? '<button type="button" class="btn sm" id="menLeer">Leer sus menciones</button>'
        : `<span>(no está entre las ${nf(D.personas.length)} personas con citas guardadas)</span>`)
      + (quien !== V.ego ? '<button type="button" class="btn sm" id="menVerEgo">Ver su red ego</button>' : '')
      + (n ? `<span class="men-aviso">${n}</span>` : '');
    const b = menEl('menLeer');
    if (b) b.addEventListener('click', () => {
      MEN.elegida = D.personas[nd.lista].k;
      if (MEN.filtro !== 'todas') {
        MEN.filtro = 'todas';
        for (const x of menEl('menFiltro').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.menf === 'todas'));
      }
      menPintarPersonas();
      const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      menEl('menPersonas').closest('section').scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    });
    const be = menEl('menVerEgo');
    if (be) be.addEventListener('click', () => irA(agrupar, sentido, quien));
  }
  const tip = menEl('menTip');
  function mostrarTip(e, i) {
    const caja = svg.parentElement.getBoundingClientRect();
    tip.innerHTML = `<b>${esc(RED.nodos[i].n)}</b><br>${describir(RED.nodos[i], i)}`;
    tip.hidden = false;
    const x = Math.min(e.clientX - caja.left + 14, caja.width - tip.offsetWidth - 8), y = Math.min(e.clientY - caja.top + 14, caja.height - tip.offsetHeight - 8);
    tip.style.left = `${Math.max(8, x)}px`; tip.style.top = `${Math.max(8, y)}px`;
  }
  const TEXTO = {
    todas: 'Cada figura es una persona (círculo, con escaño; cuadrado, persona externa); su tamaño, cuántos oradores distintos la mencionan. Anillos: cuanto más al centro, con más personas distintas está conectada, en cualquiera de los dos sentidos (el número de cada anillo es el mínimo). ',
    hechas: 'Solo las personas que mencionan a alguien y las menciones entre ellas: quien no menciona a nadie, como las personas externas, no aparece. Tamaño y anillo: a cuántas personas distintas menciona (el número de cada anillo es el mínimo). ',
    recibidas: 'Solo las personas mencionadas y las menciones entre ellas: quien habla sin que nadie la mencione no aparece. Tamaño y anillo: cuántos oradores distintos la mencionan (el número de cada anillo es el mínimo). ',
  };
  const TEXTO_EGO = {
    todas: (e) => `Modo ego: ${e}, en el centro, y las personas conectadas con ${e} por menciones en cualquiera de los dos sentidos, con las menciones entre ellas. Anillos: cuanto más cerca del centro, más menciones entre esa persona y ${e} (el número de cada anillo es el mínimo); tamaño, cuántos oradores distintos la mencionan en toda la biblioteca. `,
    hechas: (e) => `Modo ego: ${e}, en el centro, y las personas a las que ${e} menciona, con las menciones entre ellas. Anillos: cuanto más cerca del centro, más veces las menciona ${e} (el número de cada anillo es el mínimo); tamaño, a cuántas personas distintas menciona cada una en toda la biblioteca. `,
    recibidas: (e) => `Modo ego: ${e}, en el centro, y las personas que mencionan a ${e}, con las menciones entre ellas. Anillos: cuanto más cerca del centro, más veces menciona esa persona a ${e} (el número de cada anillo es el mínimo); tamaño, cuántos oradores distintos la mencionan en toda la biblioteca. `,
  };
  const PASAR = {
    todas: ' Pase por encima o pulse una persona para ver a quién menciona (línea continua) y quién la menciona (discontinua).',
    hechas: ' Pase por encima o pulse una persona para ver a quién menciona.',
    recibidas: ' Pase por encima o pulse una persona para ver quién la menciona.',
  };
  const FILTRO = {
    todas: 'Con el filtro, solo cuentan las conexiones de 2 o más menciones, sumando los dos sentidos: quien no tiene ninguna sale de la red y los anillos cuentan solo esas conexiones; el tamaño sigue siendo el de toda la biblioteca. ',
    hechas: 'Con el filtro, solo cuentan las menciones repetidas: queda quien menciona a alguien dos o más veces y el anillo cuenta a cuántas personas menciona así; el tamaño sigue siendo el de toda la biblioteca. ',
    recibidas: 'Con el filtro, solo cuentan las menciones repetidas: queda quien es mencionada dos o más veces por un mismo orador y el anillo cuenta cuántos oradores la mencionan así; el tamaño sigue siendo el de toda la biblioteca. ',
  };
  const FILTRO_EGO = {
    todas: (e) => `Con el filtro, solo las personas con 2 o más menciones con ${e}, sumando los dos sentidos, y entre ellas, las conexiones de 2 o más menciones. `,
    hechas: (e) => `Con el filtro, solo las personas a las que ${e} menciona dos o más veces, y entre ellas, las menciones repetidas. `,
    recibidas: (e) => `Con el filtro, solo las personas que mencionan a ${e} dos o más veces, y entre ellas, las menciones repetidas. `,
  };
  const explicar = () => {
    const e = V.ego >= 0 ? RED.nodos[V.ego].n : '';
    menEl('menExplica').textContent = (e ? TEXTO_EGO[sentido](e) : TEXTO[sentido]) + (V.fuertes ? (e ? FILTRO_EGO[sentido](e) : FILTRO[sentido]) : '') + AGRUPA[agrupar].explica(sentido, e)
      + (e ? ' Pase por encima o pulse una persona para ver sus conexiones dentro de esta red; «Ver su red ego» la pone en el centro y «Modo ego» vuelve a toda la red.'
        : `${PASAR[sentido]} Con una persona fijada, «Modo ego» rehace la red solo con ella y sus conexiones.`)
      + ' Para acercar: los botones, o Ctrl y la rueda (en el trackpad, pellizcar); arrastre para moverse.';
  };

  // Cambiar de vista con una transición al estilo de d3 (d3.easeCubicInOut, 750 ms por persona, con un retraso escalonado
  // según su ángulo de destino: un barrido en el sentido de las agujas del reloj desde las 12). Quien sigue en la vista se
  // desliza por los anillos hasta su nuevo sitio, con el tamaño y el color interpolados; quien sale se desvanece al
  // principio y quien entra aparece al final, ya en su sitio. Las aristas y los nombres acompañan a sus personas; los
  // rótulos de sectores y anillos salen y entran con un fundido. Sin transición si el sistema pide reducir el movimiento.
  const DUR = 750, ESCALON = 350, SALIDA = 250, ENTRADA = 300;
  const suaveT = (t) => ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;   // d3.easeCubicInOut
  const rgb = (c) => (c.match(/[\d.]+/g) || [128, 128, 128]).slice(0, 3).map(Number);
  const colorear = (i, col) => { circulos[i].style.fill = col; };
  const fundir = (g, de, a, ms, fill) => g.animate([{ opacity: de }, { opacity: a }], { duration: ms, easing: 'ease-out', fill });
  function irA(agr, sen, ego, fuertes = V.fuertes) {
    if (agr === agrupar && sen === sentido && ego === V.ego && fuertes === V.fuertes) return;
    if (acabar) acabar();                                          // una transición a medias salta a su final
    const antes = V, cambiaGrupo = agr !== agrupar;
    const colorDesde = circulos.map((c) => rgb(getComputedStyle(c).fill));
    const salen = [], entran = [], aSalen = [], aEntran = [];
    const opacidad = (el) => (el.classList.contains('apagado') ? 0.1 : 1);
    agrupar = agr; sentido = sen; V = disponer(agr, sen, ego, fuertes); moviendo = true;
    MEN.agrupar = agrupar; MEN.sentido = sentido; MEN.fuertes = V.fuertes;
    menEl('menFuertes').checked = V.fuertes;
    const cambiaAnillos = antes.firma !== V.firma;
    if (V.ego !== antes.ego) fijado = V.ego >= 0 ? -1 : antes.ego;   // al entrar en el modo ego se suelta; al salir, queda fijada quien estaba en el centro
    if (fijado >= 0 && !V.visible(fijado)) fijado = -1;
    const quedan = [];
    for (let i = 0; i < NN; i++) {
      const a = antes.visible(i), d = V.visible(i);
      if (a && d) quedan.push(i); else if (a) salen.push({ i, o: opacidad(circulos[i]) }); else if (d) entran.push({ i });
    }
    for (let q = 0; q < RED.aristas.length; q++) {
      const a = aristaEn(antes, q), d = aristaEn(V, q);
      if (a && !d) aSalen.push({ q, o: opacidad(lineas[q]) }); else if (!a && d) aEntran.push({ q });
    }
    for (const x of menEl('menAgrupar').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.meng === agrupar));
    for (const x of menEl('menSentido').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.mens === sentido));
    explicar(); pintarColores();                                   // leyenda y colores de destino
    const colorHasta = circulos.map((c) => rgb(getComputedStyle(c).fill));
    colorDesde.forEach((c, i) => colorear(i, `rgb(${(V.visible(i) && !antes.visible(i) ? colorHasta[i] : c).join(',')})`));
    pintarInfo();
    if (fijado >= 0) resaltar(fijado); else limpiar();             // (los nombres esperan al final)
    for (const t of [...gT.children]) if (!V.visible(Number(t.dataset.i))) t.remove();
    for (const s of salen) circulos[s.i].classList.add('saliendo');
    for (const s of entran) {
      const i = s.i;
      s.o = opacidad(circulos[i]);
      pos[i].x = V.pos[i].x; pos[i].y = V.pos[i].y; radioActual[i] = radioDe(V.tam(i));
      circulos[i].style.opacity = '0'; circulos[i].classList.remove('fuera');
    }
    for (const s of aEntran) { s.o = opacidad(lineas[s.q]); lineas[s.q].style.opacity = '0'; lineas[s.q].classList.remove('fuera'); }
    const tramo = quedan.map((i) => {
      const p = V.pos[i], a0 = Math.atan2(pos[i].y - CY, pos[i].x - CX), destino = Math.atan2(p.y - CY, p.x - CX);
      let a1 = destino;
      if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; else if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;   // por el lado corto
      const barrido = (destino + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
      return { i, a0, a1, r0: Math.hypot(pos[i].x - CX, pos[i].y - CY), r1: Math.hypot(p.x - CX, p.y - CY), retraso: ESCALON * barrido / (2 * Math.PI),
        t0: radioActual[i], t1: radioDe(V.tam(i)), c0: colorDesde[i], c1: colorHasta[i], cambia: cambiaGrupo && colorDesde[i].some((v, k) => v !== colorHasta[i][k]) };
    });
    const curva0 = curvaActual;
    const guias = [fundir(gS, 1, 0, 200, 'forwards')].concat(cambiaAnillos ? [fundir(gRT, 1, 0, 200, 'forwards')] : []);
    const fin = () => {
      if (anima) cancelAnimationFrame(anima);
      anima = null; acabar = null; moviendo = false; curvaActual = V.curva;
      for (const s of tramo) { pos[s.i].x = V.pos[s.i].x; pos[s.i].y = V.pos[s.i].y; radioActual[s.i] = s.t1; }
      for (const s of salen) { circulos[s.i].classList.remove('saliendo'); circulos[s.i].classList.add('fuera'); circulos[s.i].style.opacity = ''; }
      for (const s of entran) circulos[s.i].style.opacity = '';
      for (const s of aSalen) { lineas[s.q].classList.add('fuera'); lineas[s.q].style.opacity = ''; }
      for (const s of aEntran) lineas[s.q].style.opacity = '';
      apilar(); pintarColores(); colocar();
      guias.forEach((g) => g.cancel());
      pintarSectores(); fundir(gS, 0, 1, 300);
      pintarAnillos();
      if (cambiaAnillos) fundir(gRT, 0, 1, 300);
      if (fijado >= 0) resaltar(fijado); else { sobre = -1; limpiar(); }
    };
    acabar = fin;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { fin(); return; }
    const t0 = performance.now(), TOTAL = DUR + ESCALON;
    const paso = (ahora) => {
      const t = ahora - t0;
      for (const s of tramo) {
        const e = suaveT(Math.min(1, Math.max(0, (t - s.retraso) / DUR)));
        const a = s.a0 + (s.a1 - s.a0) * e, r = s.r0 + (s.r1 - s.r0) * e;
        pos[s.i].x = CX + r * Math.cos(a); pos[s.i].y = CY + r * Math.sin(a);
        if (s.t0 !== s.t1) radioActual[s.i] = s.t0 + (s.t1 - s.t0) * e;
        if (s.cambia) colorear(s.i, `rgb(${Math.round(s.c0[0] + (s.c1[0] - s.c0[0]) * e)},${Math.round(s.c0[1] + (s.c1[1] - s.c0[1]) * e)},${Math.round(s.c0[2] + (s.c1[2] - s.c0[2]) * e)})`);
      }
      const fs = 1 - suaveT(Math.min(1, t / SALIDA)), fe = suaveT(Math.min(1, Math.max(0, (t - (TOTAL - ENTRADA)) / ENTRADA)));
      for (const s of salen) circulos[s.i].style.opacity = (s.o * fs).toFixed(3);
      for (const s of aSalen) lineas[s.q].style.opacity = (s.o * fs).toFixed(3);
      for (const s of entran) circulos[s.i].style.opacity = (s.o * fe).toFixed(3);
      for (const s of aEntran) lineas[s.q].style.opacity = (s.o * fe).toFixed(3);
      curvaActual = curva0 + (V.curva - curva0) * suaveT(Math.min(1, t / TOTAL));
      colocar(); seguirEtiquetas();
      if (t < TOTAL) anima = requestAnimationFrame(paso); else fin();
    };
    anima = requestAnimationFrame(paso);
  }

  let arrastre = null, sobre = -1;
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const c = e.target.closest('.men-nodo');
    arrastre = { p: puntoSvg(e), x: vista.x, y: vista.y, nodo: c ? Number(c.dataset.i) : -1, movido: false };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (arrastre) {
      const p = puntoSvg(e), dx = p.x - arrastre.p.x, dy = p.y - arrastre.p.y;
      if (!arrastre.movido && Math.hypot(dx, dy) < 4) return;
      arrastre.movido = true; svg.classList.add('men-arrastrando'); tip.hidden = true;
      vista.x = arrastre.x + dx; vista.y = arrastre.y + dy;
      gZoom.setAttribute('transform', `translate(${vista.x.toFixed(1)},${vista.y.toFixed(1)}) scale(${vista.k.toFixed(3)})`);
      return;
    }
    if (moviendo) return;
    const c = e.target.closest('.men-nodo');
    const i = c ? Number(c.dataset.i) : -1;
    if (i >= 0) mostrarTip(e, i); else tip.hidden = true;
    if (i === sobre) return;
    sobre = i;
    if (fijado >= 0) return;                                       // con una persona fijada, el resaltado no cambia al pasar
    if (i >= 0) resaltar(i); else limpiar();
  });
  svg.addEventListener('pointerup', (e) => {
    if (!arrastre) return;
    const a = arrastre; arrastre = null; svg.classList.remove('men-arrastrando');
    try { svg.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ }
    if (a.movido) { aplicarVista(); return; }
    if (moviendo) return;
    fijado = a.nodo;                                                // pulsar una persona la fija; pulsar el fondo la suelta
    if (fijado >= 0) resaltar(fijado); else limpiar();
    pintarInfo();
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; sobre = -1; if (fijado < 0 && !arrastre && !moviendo) limpiar(); });
  svg.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;                          // sin Ctrl, la rueda desplaza la lista
    e.preventDefault();
    const p = puntoSvg(e);
    zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  }, { passive: false });
  menEl('menZmas').addEventListener('click', () => zoom(1.4));
  menEl('menZmenos').addEventListener('click', () => zoom(1 / 1.4));
  menEl('menEncuadre').addEventListener('click', () => { vista.x = 0; vista.y = 0; vista.k = 1; aplicarVista(); });
  menEl('menAgrupar').addEventListener('click', (e) => { const b = e.target.closest('[data-meng]'); if (b) irA(b.dataset.meng, sentido, V.ego); });
  menEl('menSentido').addEventListener('click', (e) => { const b = e.target.closest('[data-mens]'); if (b) irA(agrupar, b.dataset.mens, V.ego); });
  menEl('menEgo').addEventListener('click', () => { if (V.ego >= 0) irA(agrupar, sentido, -1); else if (fijado >= 0) irA(agrupar, sentido, fijado); });
  menEl('menFuertes').addEventListener('change', (e) => irA(agrupar, sentido, V.ego, e.target.checked));

  function contenedorDesplazable(el) {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.clientHeight > 0) return p;
    }
    return null;
  }
  function medir() {
    const cont = contenedorDesplazable(svg), visible = cont ? cont.clientHeight : window.innerHeight;
    // El dibujo se lleva casi toda la altura visible del panel: solo se guarda sitio para la ficha de la persona y la
    // leyenda, que van pegadas debajo. Los controles quedan justo encima, a un golpe de rueda.
    const reservado = Math.max(menEl('menInfo').offsetHeight, 42) + (menEl('menLeyenda').offsetHeight || 0) + 14;
    svg.style.maxHeight = `${Math.max(360, Math.round(visible - reservado))}px`;
    const r = svg.getBoundingClientRect();
    escala = Math.min(r.width / 1000, r.height / 720) || 1;
    const w = r.width / escala, h = r.height / escala;
    lim = { x0: (1000 - w) / 2, x1: (1000 + w) / 2, y0: (720 - h) / 2, y1: (720 + h) / 2 };
    fTexto = Math.min(1.4, Math.max(1, 1 / escala));
  }
  function reajustar() {
    if (!svg.isConnected) return;
    medir();
    if (moviendo) return;                                          // el final de la transición ya repinta
    pintarAnillos(); pintarSectores();
    if (fijado >= 0) resaltar(fijado); else limpiar();
  }
  let esperaAjuste = 0;
  const alCambiarTamano = () => { cancelAnimationFrame(esperaAjuste); esperaAjuste = requestAnimationFrame(reajustar); };
  window.addEventListener('resize', alCambiarTamano);
  const ro = window.ResizeObserver ? new ResizeObserver(alCambiarTamano) : null;
  if (ro) ro.observe(svg.parentElement);
  MEN.limpiarRed = () => {
    window.removeEventListener('resize', alCambiarTamano);
    cancelAnimationFrame(esperaAjuste);
    if (anima) cancelAnimationFrame(anima);
    ro?.disconnect();
  };

  apilar(); explicar(); pintarColores(); pintarInfo(); medir(); colocar(); pintarAnillos(); pintarSectores(); aplicarVista();
}

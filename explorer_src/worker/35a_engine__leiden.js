/* ===== src/engine/leiden.js ===== */
/* Diarios Explorer · engine/leiden.js
 *
 * Detección de comunidades con el algoritmo de Leiden (Traag, Waltman y van Eck, «From Louvain to Leiden: guaranteeing
 * well-connected communities», Scientific Reports 9, 5233, 2019) sobre un grafo no dirigido y ponderado. Maximiza la
 * modularidad con resolución γ (modelo de configuración de Reichardt y Bornholdt): γ > 1 da más comunidades y más
 * pequeñas, γ < 1 menos y más grandes.
 *
 * Frente a Louvain, Leiden añade una fase de refinado entre el movimiento de nodos y la agregación: dentro de cada
 * comunidad solo se fusionan nodos bien conectados con subconjuntos bien conectados, y la red agregada se construye
 * sobre esa partición refinada. Así ninguna comunidad queda partida en trozos sin conexión entre sí, que con Louvain
 * sí puede ocurrir y que, aplicado a temas, uniría grupos de palabras que no tienen nada que ver.
 *
 * Decisiones de esta implementación (se registran con el resultado para que sea reproducible):
 *   - Orden de visita de los nodos barajado con una semilla fija (mulberry32): misma semilla, mismo resultado.
 *   - Refinado voraz (θ → 0 en la notación del artículo): se fusiona con el subconjunto de mayor ganancia en lugar de
 *     sortearlo. Conserva la garantía de conexión y evita que el resultado dependa de la escala de los pesos.
 *   - Se itera el algoritmo completo, partiendo de la partición anterior, hasta que la calidad deja de mejorar.
 *   - Red de seguridad final: cada comunidad se separa en sus componentes conexas (nunca empeora la modularidad).
 *
 * API (R2.leiden)
 *   comunidades({ n, aristas: [[u, v, peso], …] }, { resolucion = 1, semilla = 1, max_iteraciones = 10 })
 *     → { comunidad: Int32Array(n), n_comunidades, calidad, modularidad, iteraciones, parametros }
 *   modularidad(grafo, comunidad, resolucion = 1)   ·   conexas(grafo, comunidad) → true si todas son conexas
 */
(function (R2) {
  'use strict';

  const EPS = 1e-12;

  // ------------------------------------------------------------------------------------------------ grafo CSR
  /** Grafo CSR a partir de aristas [u, v, w] (u ≠ v; las repetidas se suman; pesos ≤ 0 se ignoran). */
  function desdeAristas(n, aristas) {
    const grado = new Int32Array(n);
    for (const [u, v, w] of aristas) if (u !== v && w > 0) { grado[u]++; grado[v]++; }
    const off = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) off[i + 1] = off[i] + grado[i];
    const adj = new Int32Array(off[n]), wt = new Float64Array(off[n]);
    const pos = off.slice(0, n);
    for (const [u, v, w] of aristas) {
      if (u === v || !(w > 0)) continue;
      adj[pos[u]] = v; wt[pos[u]++] = w;
      adj[pos[v]] = u; wt[pos[v]++] = w;
    }
    return compactar({ n, off, adj, wt, auto: new Float64Array(n) });
  }

  /** Suma vecinos repetidos y calcula los grados (grado = Σ pesos a otros + 2 · lazo propio). */
  function compactar(g) {
    const { n, off, adj, wt, auto } = g;
    const off2 = new Int32Array(n + 1), adj2 = [], wt2 = [];
    const marca = new Int32Array(n).fill(-1), sitio = new Int32Array(n);
    for (let v = 0; v < n; v++) {
      const ini = adj2.length;
      for (let e = off[v]; e < off[v + 1]; e++) {
        const u = adj[e];
        if (marca[u] === v) { wt2[sitio[u]] += wt[e]; continue; }
        marca[u] = v; sitio[u] = adj2.length; adj2.push(u); wt2.push(wt[e]);
      }
      off2[v + 1] = off2[v] + (adj2.length - ini);
    }
    const grado = new Float64Array(n);
    let m2 = 0;
    for (let v = 0; v < n; v++) {
      let s = 2 * auto[v];
      for (let e = off2[v]; e < off2[v + 1]; e++) s += wt2[e];
      grado[v] = s; m2 += s;
    }
    return { n, off: off2, adj: Int32Array.from(adj2), wt: Float64Array.from(wt2), auto, grado, m2 };
  }

  // ------------------------------------------------------------------------------------------------ azar con semilla
  function mulberry32(semilla) {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function barajado(n, azar) {
    const o = new Int32Array(n);
    for (let i = 0; i < n; i++) o[i] = i;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); const t = o[i]; o[i] = o[j]; o[j] = t; }
    return o;
  }

  // ------------------------------------------------------------------------------------------------ calidad
  /** Modularidad con resolución γ: Σ_c [ L_c/m − γ (K_c/2m)² ]. */
  function calidadCSR(g, comunidad, gamma) {
    const { n, off, adj, wt, auto, grado, m2 } = g;
    if (!(m2 > 0)) return 0;
    const m = m2 / 2;
    const L = new Map(), K = new Map();
    for (let v = 0; v < n; v++) {
      const c = comunidad[v];
      K.set(c, (K.get(c) || 0) + grado[v]);
      let interno = auto[v];
      for (let e = off[v]; e < off[v + 1]; e++) if (comunidad[adj[e]] === c && adj[e] > v) interno += wt[e];
      L.set(c, (L.get(c) || 0) + interno);
    }
    let q = 0;
    for (const [c, k] of K) q += (L.get(c) || 0) / m - gamma * (k / m2) * (k / m2);
    return q;
  }

  // ------------------------------------------------------------------------------------------------ fases de Leiden
  /** Movimiento rápido de nodos (cola): cada nodo va a la comunidad vecina de mayor ganancia, o a una vacía. */
  function moverNodos(g, P, gamma, orden) {
    const { n, off, adj, wt, grado, m2 } = g;
    const Ktot = new Float64Array(n), tam = new Int32Array(n);
    for (let v = 0; v < n; v++) { Ktot[P[v]] += grado[v]; tam[P[v]]++; }
    const vacias = [];
    for (let c = n - 1; c >= 0; c--) if (tam[c] === 0) vacias.push(c);
    const cola = new Int32Array(n), enCola = new Uint8Array(n);
    let cab = 0, largo = n;
    for (let i = 0; i < n; i++) { cola[i] = orden[i]; enCola[orden[i]] = 1; }
    const peso = new Float64Array(n), tocadas = [];
    while (largo > 0) {
      const v = cola[cab]; cab = (cab + 1) % n; largo--; enCola[v] = 0;
      const cv = P[v], kv = grado[v];
      for (let e = off[v]; e < off[v + 1]; e++) {
        const c = P[adj[e]];
        if (peso[c] === 0) tocadas.push(c);
        peso[c] += wt[e];
      }
      Ktot[cv] -= kv; tam[cv]--;
      let mejor = cv, mejorG = peso[cv] - gamma * Ktot[cv] * kv / m2;
      for (const c of tocadas) {
        if (c === cv) continue;
        const gan = peso[c] - gamma * Ktot[c] * kv / m2;
        if (gan > mejorG + EPS) { mejor = c; mejorG = gan; }
      }
      // Comunidad vacía: ganancia 0. Si v estaba solo, quedarse ya equivale a eso.
      if (tam[cv] > 0 && 0 > mejorG + EPS && vacias.length) mejor = vacias.pop();
      for (const c of tocadas) peso[c] = 0;
      tocadas.length = 0;
      P[v] = mejor; Ktot[mejor] += kv; tam[mejor]++;
      if (tam[cv] === 0 && cv !== mejor) vacias.push(cv);
      if (mejor !== cv) {
        for (let e = off[v]; e < off[v + 1]; e++) {
          const u = adj[e];
          if (P[u] !== mejor && !enCola[u]) { cola[(cab + largo) % n] = u; largo++; enCola[u] = 1; }
        }
      }
    }
    return P;
  }

  /**
   * Refinado: dentro de cada comunidad S de P, se parte de nodos sueltos y solo se fusiona un nodo bien conectado con
   * S con un subconjunto también bien conectado con S, eligiendo el de mayor ganancia positiva.
   * Bien conectado (para modularidad con resolución γ): E(X, S − X) ≥ γ · K_X · (K_S − K_X) / 2m.
   */
  function refinar(g, P, gamma, orden) {
    const { n, off, adj, wt, grado, m2 } = g;
    const R = new Int32Array(n), Kr = new Float64Array(n), tamR = new Int32Array(n), ext = new Float64Array(n);
    const KS = new Float64Array(n);
    for (let v = 0; v < n; v++) { R[v] = v; Kr[v] = grado[v]; tamR[v] = 1; KS[P[v]] += grado[v]; }
    for (let v = 0; v < n; v++) {
      let s = 0;
      for (let e = off[v]; e < off[v + 1]; e++) if (P[adj[e]] === P[v]) s += wt[e];
      ext[v] = s;
    }
    const peso = new Float64Array(n), tocadas = [];
    for (let i = 0; i < n; i++) {
      const v = orden[i];
      if (tamR[R[v]] !== 1) continue;                        // v ya no está solo en la partición refinada
      const S = P[v];
      if (ext[v] < gamma * grado[v] * (KS[S] - grado[v]) / m2 - EPS) continue;   // v mal conectado con S
      for (let e = off[v]; e < off[v + 1]; e++) {
        const u = adj[e];
        if (P[u] !== S) continue;
        const c = R[u];
        if (c === R[v]) continue;
        if (peso[c] === 0) tocadas.push(c);
        peso[c] += wt[e];
      }
      let mejor = -1, mejorG = 0;
      for (const c of tocadas) {
        if (ext[c] < gamma * Kr[c] * (KS[S] - Kr[c]) / m2 - EPS) continue;       // subconjunto mal conectado
        const gan = peso[c] - gamma * Kr[c] * grado[v] / m2;
        if (gan > mejorG + EPS) { mejor = c; mejorG = gan; }      // voraz: solo fusiones con ganancia positiva
      }
      if (mejor >= 0) {
        const r0 = R[v];
        ext[mejor] = ext[mejor] + ext[r0] - 2 * peso[mejor];
        Kr[mejor] += grado[v]; tamR[mejor]++;
        Kr[r0] = 0; tamR[r0] = 0; ext[r0] = 0;
        R[v] = mejor;
      }
      for (const c of tocadas) peso[c] = 0;
      tocadas.length = 0;
    }
    return R;
  }

  /** Red agregada a partir de la partición refinada R (ids compactados): nodos = subconjuntos de R. */
  function agregar(g, R) {
    const { n, off, adj, wt, auto } = g;
    const id = new Int32Array(n).fill(-1);
    let k = 0;
    const nuevo = new Int32Array(n);
    for (let v = 0; v < n; v++) { if (id[R[v]] < 0) id[R[v]] = k++; nuevo[v] = id[R[v]]; }
    const autoN = new Float64Array(k);
    const aristas = [];
    for (let v = 0; v < n; v++) {
      const a = nuevo[v];
      autoN[a] += auto[v];
      for (let e = off[v]; e < off[v + 1]; e++) {
        const u = adj[e];
        if (u < v) continue;                                     // cada arista una vez
        const b = nuevo[u];
        if (a === b) autoN[a] += wt[e];
        else aristas.push([a, b, wt[e]]);
      }
    }
    const gr = desdeAristas(k, aristas);
    for (let i = 0; i < k; i++) { gr.auto[i] = autoN[i]; }
    const g2 = compactar({ n: k, off: gr.off, adj: gr.adj, wt: gr.wt, auto: gr.auto });
    return { g: g2, nuevo };
  }

  /** Separa cada comunidad en sus componentes conexas (en el grafo original). */
  function separarComponentes(g, com) {
    const { n, off, adj } = g;
    const out = new Int32Array(n).fill(-1);
    let k = 0;
    const pila = [];
    for (let s = 0; s < n; s++) {
      if (out[s] >= 0) continue;
      out[s] = k; pila.push(s);
      while (pila.length) {
        const v = pila.pop();
        for (let e = off[v]; e < off[v + 1]; e++) {
          const u = adj[e];
          if (out[u] < 0 && com[u] === com[s]) { out[u] = k; pila.push(u); }
        }
      }
      k++;
    }
    return out;
  }

  const compactarIds = (com) => {
    const mapa = new Map();
    const out = new Int32Array(com.length);
    for (let i = 0; i < com.length; i++) { if (!mapa.has(com[i])) mapa.set(com[i], mapa.size); out[i] = mapa.get(com[i]); }
    return [out, mapa.size];
  };

  /** Una pasada completa de Leiden partiendo de la partición `inicial` (ids 0..n-1) del grafo original. */
  function pasada(g0, inicial, gamma, azar) {
    let g = g0;
    let P = Int32Array.from(inicial);
    let nodoDe = new Int32Array(g0.n);
    for (let i = 0; i < g0.n; i++) nodoDe[i] = i;
    for (let nivel = 0; nivel < 64; nivel++) {
      P = moverNodos(g, P, gamma, barajado(g.n, azar));
      const [Pc, nc] = compactarIds(P);
      P = Pc;
      if (nc === g.n) break;                                     // cada nodo es su comunidad: nada que agregar
      const R = refinar(g, P, gamma, barajado(g.n, azar));
      const { g: gA, nuevo } = agregar(g, R);
      if (gA.n === g.n) break;                                   // el refinado no fusionó nada: parada segura
      const PA = new Int32Array(gA.n);
      for (let v = 0; v < g.n; v++) PA[nuevo[v]] = P[v];         // la agregada empieza con la partición NO refinada
      for (let i = 0; i < g0.n; i++) nodoDe[i] = nuevo[nodoDe[i]];
      g = gA; P = PA;
    }
    const com = new Int32Array(g0.n);
    for (let i = 0; i < g0.n; i++) com[i] = P[nodoDe[i]];
    return com;
  }

  // ------------------------------------------------------------------------------------------------ API
  function comunidades(grafo, opciones = {}) {
    const gamma = opciones.resolucion === undefined ? 1 : Number(opciones.resolucion);
    const semilla = opciones.semilla === undefined ? 1 : Number(opciones.semilla) >>> 0;
    const maxIt = opciones.max_iteraciones === undefined ? 10 : Number(opciones.max_iteraciones);
    const g = desdeAristas(grafo.n, grafo.aristas || []);
    const azar = mulberry32(semilla || 1);
    let com = new Int32Array(g.n);
    for (let i = 0; i < g.n; i++) com[i] = i;
    let q = calidadCSR(g, com, gamma), it = 0;
    for (; it < maxIt; it++) {
      const nuevo = compactarIds(pasada(g, com, gamma, azar))[0];
      const qn = calidadCSR(g, nuevo, gamma);
      if (qn <= q + 1e-10 && it > 0) break;
      com = nuevo; q = qn;
    }
    const [final, nComunidades] = compactarIds(separarComponentes(g, com));
    return {
      comunidad: final, n_comunidades: nComunidades,
      calidad: calidadCSR(g, final, gamma), modularidad: calidadCSR(g, final, 1),
      iteraciones: it, parametros: { algoritmo: 'Leiden', funcion_calidad: 'modularidad (RB)', resolucion: gamma,
        semilla, refinado: 'voraz (θ → 0)', max_iteraciones: maxIt },
    };
  }

  function modularidad(grafo, comunidad, resolucion = 1) {
    return calidadCSR(desdeAristas(grafo.n, grafo.aristas || []), comunidad, resolucion);
  }

  function conexas(grafo, comunidad) {
    const g = desdeAristas(grafo.n, grafo.aristas || []);
    const [a, na] = compactarIds(comunidad);
    const [, nb] = compactarIds(separarComponentes(g, a));
    return na === nb;
  }

  R2.leiden = Object.freeze({ comunidades, modularidad, conexas, _interno: { desdeAristas, moverNodos, refinar, agregar, mulberry32 } });
})(globalThis.R2 = globalThis.R2 || {});

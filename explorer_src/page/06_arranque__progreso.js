

























(function (R2) {
  'use strict';

  const FASES = Object.freeze([
    Object.freeze({ id: 'leer', etiqueta: 'Leyendo y comprobando el archivo', peso: 0.44 }),
    Object.freeze({ id: 'guardar', etiqueta: 'Guardando e indexando intervenciones', peso: 0.02 }),
    Object.freeze({ id: 'indices', etiqueta: 'Creando índices', peso: 0.01 }),
    Object.freeze({ id: 'optimizar', etiqueta: 'Compactando el índice de palabras', peso: 0.06 }),
    Object.freeze({ id: 'estadisticas', etiqueta: 'Estadísticas y filtros', peso: 0.05 }),
    Object.freeze({ id: 'expresiones', etiqueta: 'Detectando expresiones de varias palabras', peso: 0.42 }),
  ]);

  const CONCURRENTES = new Set(['guardar']);

  /** Duración de las fases finales respecto a la lectura completa (medido con un corpus de 100 MB). */
  // expresiones: medido en Brasil (lectura 84 s, expresiones 120 s) y El Salvador (4 s y 10 s).
  const RESPECTO_A_LEER = Object.freeze({ indices: 0.02, optimizar: 0.12, estadisticas: 0.08, expresiones: 1.4 });

  const UMBRAL_FASE_LARGA_MS = 5000;

  const ETA_MIN_FRACCION = 0.05;
  const ETA_MIN_MS = 700;
  const ETA_SUAVIZADO = 0.4;


  function miles(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
    const t = String(Math.round(Math.abs(n)));
    return (n < 0 ? '-' : '') + t.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }


  function decimal(x, d = 1) {
    const f = Math.pow(10, d);
    const r = Math.round(x * f) / f;
    const ent = Math.trunc(Math.abs(r));
    const frac = d > 0 ? String(Math.round((Math.abs(r) - ent) * f)).padStart(d, '0') : '';
    return (r < 0 ? '-' : '') + miles(ent) + (d > 0 ? `,${frac}` : '');
  }


  function tamano(bytes) {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—';
    if (bytes < 1000) return `${miles(bytes)} ${bytes === 1 ? 'byte' : 'bytes'}`;
    if (bytes < 1e6) return `${decimal(bytes / 1e3, bytes < 1e4 ? 1 : 0)} kB`;
    if (bytes < 1e9) return `${decimal(bytes / 1e6, 1)} MB`;
    return `${decimal(bytes / 1e9, 2)} GB`;
  }


  function duracion(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—';
    const s = ms / 1000;
    if (s < 10) return `${decimal(s, 1)} s`;
    if (s < 60) return `${Math.round(s)} s`;
    const total = Math.round(s);
    const min = Math.floor(total / 60), seg = total % 60;
    return seg ? `${min} min ${seg} s` : `${min} min`;
  }


  function porcentaje(f) {
    const p = Math.max(0, Math.min(100, Math.floor((Number(f) || 0) * 100)));
    return `${p} %`;
  }


  function textoEta(ms) {
    if (ms == null || !Number.isFinite(ms)) return 'Calculando el tiempo restante…';
    if (ms < 1000) return 'Casi listo';
    const s = ms / 1000;
    if (s < 10) return `Quedan unos ${Math.ceil(s)} s`;
    if (s < 60) return `Quedan unos ${Math.max(10, Math.round(s / 5) * 5)} s`;
    const total = Math.round(s / 10) * 10;
    const min = Math.floor(total / 60), seg = total % 60;
    return seg ? `Quedan unos ${min} min ${seg} s` : `Quedan unos ${min} min`;
  }


  /** Memoria del motor (MB) según el tamaño del CSV: el texto se guarda comprimido (≈0,3×) y el índice ocupa ≈0,36× (medido). */
  function memoriaEstimada(bytes) {
    const mb = Math.max(0, Number(bytes) || 0) / 1e6;
    const r50 = (x) => Math.max(50, Math.round(x / 50) * 50);
    return { min: r50(60 + 0.7 * mb), max: r50(100 + 0.95 * mb) };
  }


  function crearSeguimiento(opciones) {
    const ahora = (opciones && opciones.ahora) || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    const fases = FASES.map((f, i) => ({ id: f.id, etiqueta: f.etiqueta, indice: i + 1, peso: f.peso, estado: 'espera',
      hecho: 0, total: null, inicio: null, fin: null }));
    const porId = new Map(fases.map((f) => [f.id, f]));
    let t0 = null, eta = null, tEta = null, activaId = null;

    const fraccionDe = (f) => {
      if (f.estado === 'hecha') return 1;
      if (f.estado === 'espera' || !f.total) return 0;
      return Math.max(0, Math.min(1, f.hecho / f.total));
    };
    const terminado = () => fases.every((f) => f.estado === 'hecha');

    const fraccionTotal = () => (terminado() ? 1 : Math.min(1, fases.reduce((s, f) => s + f.peso * fraccionDe(f), 0)));
    const msDe = (f, t) => (f.inicio === null ? 0 : (f.fin !== null ? f.fin : t) - f.inicio);

    function cerrar(f, t) {
      if (f.estado === 'hecha') return;
      if (f.inicio === null) f.inicio = t;
      f.estado = 'hecha';
      f.fin = t;
      if (f.total != null) f.hecho = f.total;
    }


    function porRitmo(f, t) {
      const x = fraccionDe(f), ms = msDe(f, t);
      return f.estado === 'activa' && x >= ETA_MIN_FRACCION && ms >= ETA_MIN_MS ? ms / x : null;
    }


    function restanteDe(f, ref, t) {
      if (f.estado === 'hecha') return 0;
      if (f.estado === 'espera') return ref;
      const d = porRitmo(f, t);
      return d !== null ? d * (1 - fraccionDe(f)) : Math.max(ref * 0.25, ref - msDe(f, t));
    }

    function etaBruta(t) {
      if (terminado()) return 0;
      const leer = porId.get('leer');
      const D = leer.estado === 'hecha' ? msDe(leer, t) : porRitmo(leer, t);
      if (D === null || !(D > 0)) return null;
      return restanteDe(leer, D, t)
        + restanteDe(porId.get('indices'), D * RESPECTO_A_LEER.indices, t)
        + restanteDe(porId.get('optimizar'), D * RESPECTO_A_LEER.optimizar, t)
        + restanteDe(porId.get('estadisticas'), D * RESPECTO_A_LEER.estadisticas, t)
        + restanteDe(porId.get('expresiones'), D * RESPECTO_A_LEER.expresiones, t);
    }

    function actualizarEta(t) {
      const bruta = etaBruta(t);
      if (bruta === null) return;
      if (bruta === 0) { eta = 0; tEta = t; return; }
      eta = eta === null ? bruta : (1 - ETA_SUAVIZADO) * Math.max(0, eta - (t - tEta)) + ETA_SUAVIZADO * bruta;
      tEta = t;
    }

    function masAvanzadaActiva() {
      let r = null;
      for (const f of fases) if (f.estado === 'activa') r = f;
      return r;
    }

    function evento(ev) {
      const f = ev && porId.get(ev.fase);
      if (!f) return false;
      const t = ahora();
      if (t0 === null) t0 = t;
      if (!CONCURRENTES.has(f.id)) {
        for (const g of fases) if (g.indice < f.indice) cerrar(g, t);
      }
      if (f.inicio === null) f.inicio = t;
      if (f.estado !== 'hecha') {
        f.hecho = typeof ev.hecho === 'number' ? ev.hecho : f.hecho;
        f.total = ev.total != null ? ev.total : null;
        f.estado = 'activa';
        if (f.total != null && f.total > 0 && f.hecho >= f.total) cerrar(f, t);
      }
      actualizarEta(t);
      const activa = masAvanzadaActiva();
      const nueva = activa ? activa.id : null;
      const cambio = nueva !== activaId;
      activaId = nueva;
      return cambio;
    }

    function estado() {
      const t = ahora();
      const activa = masAvanzadaActiva();
      const fin = terminado();
      return {
        fases: fases.map((f) => ({ id: f.id, etiqueta: f.etiqueta, indice: f.indice, estado: f.estado, hecho: f.hecho, total: f.total,
          fraccion: fraccionDe(f), duracionMs: f.inicio === null ? null : msDe(f, t) })),
        fraccion: fraccionTotal(),
        etaMs: fin ? 0 : eta === null ? null : Math.max(0, eta - (t - tEta)),
        transcurridoMs: t0 === null ? 0 : t - t0,
        activa: activa ? { id: activa.id, etiqueta: activa.etiqueta, indice: activa.indice, msEnFase: t - activa.inicio } : null,
        faseLarga: !!activa && t - activa.inicio > UMBRAL_FASE_LARGA_MS,
        terminado: fin,
      };
    }

    return { evento, estado };
  }

  R2.progreso = { FASES, RESPECTO_A_LEER, UMBRAL_FASE_LARGA_MS, crearSeguimiento, miles, decimal, tamano, duracion, porcentaje, textoEta, memoriaEstimada };
})(globalThis.R2 = globalThis.R2 || {});
//# sourceURL=2rep-standalone/src/arranque/progreso.js

/* ===== src/engine/py/difflib.js ===== */
/* 2REP_Standalone · engine/py/difflib.js
 *
 * R2.py.difflib: SequenceMatcher y get_close_matches de difflib (Python 3.12), traducción directa: b2j, basura
 * (isjunk), elementos populares (autojunk con len(b) ≥ 200), find_longest_match, get_matching_blocks con fusión
 * de bloques adyacentes, get_opcodes, ratio, quick_ratio y real_quick_ratio. Los cocientes se calculan con la
 * misma operación (2.0 * M / T), así que son idénticos en bits.
 *
 * Secuencias: una cadena se recorre por puntos de código (como str en Python) y un Array por elementos
 * (comparados con ===). Solo depende de R2.py.core.
 */
(function (R2) {
  'use strict';

  const C = R2.py.core;
  const SUSTITUTO = /[\uD800-\uDFFF]/;

  /** Secuencia indexable con la longitud de Python. */
  const indexable = (s) => (typeof s === 'string' && SUSTITUTO.test(s) ? Array.from(s) : s);
  const ratioDe = (m, t) => (t ? (2.0 * m) / t : 1.0);

  class SequenceMatcher {
    constructor(isjunk = null, a = '', b = '', autojunk = true) {
      this.isjunk = isjunk;
      this.autojunk = autojunk;
      this.a = this.b = undefined;
      this.set_seqs(a, b);
    }

    set_seqs(a, b) { this.set_seq1(a); this.set_seq2(b); }

    set_seq1(a) {
      if (a === this.a) return;
      this.a = a;
      this._a = indexable(a);
      this.matching_blocks = this.opcodes = null;
    }

    set_seq2(b) {
      if (b === this.b) return;
      this.b = b;
      this._b = indexable(b);
      this.matching_blocks = this.opcodes = null;
      this.fullbcount = null;
      this._chain_b();
    }

    _chain_b() {
      const b = this._b;
      const b2j = this.b2j = new Map();
      for (let i = 0; i < b.length; i++) {
        const elt = b[i];
        let idx = b2j.get(elt);
        if (!idx) { idx = []; b2j.set(elt, idx); }
        idx.push(i);
      }
      const junk = this.bjunk = new Set();
      if (this.isjunk) {
        for (const elt of b2j.keys()) if (this.isjunk(elt)) junk.add(elt);
        for (const elt of junk) b2j.delete(elt);
      }
      const popular = this.bpopular = new Set();
      const n = b.length;
      if (this.autojunk && n >= 200) {
        const ntest = Math.floor(n / 100) + 1;
        for (const [elt, idx] of b2j) if (idx.length > ntest) popular.add(elt);
        for (const elt of popular) b2j.delete(elt);
      }
    }

    /** Match [i, j, k]: el bloque común más largo de a[alo:ahi] y b[blo:bhi]. */
    find_longest_match(alo = 0, ahi = null, blo = 0, bhi = null) {
      const a = this._a, b = this._b, b2j = this.b2j, junk = this.bjunk;
      if (ahi === null || ahi === undefined) ahi = a.length;
      if (bhi === null || bhi === undefined) bhi = b.length;
      let besti = alo, bestj = blo, bestsize = 0;
      let j2len = new Map();
      const nada = [];
      for (let i = alo; i < ahi; i++) {
        const nuevo = new Map();
        for (const j of b2j.get(a[i]) || nada) {
          if (j < blo) continue;
          if (j >= bhi) break;
          const k = (j2len.get(j - 1) || 0) + 1;
          nuevo.set(j, k);
          if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
        }
        j2len = nuevo;
      }
      while (besti > alo && bestj > blo && !junk.has(b[bestj - 1]) && a[besti - 1] === b[bestj - 1]) {
        besti--; bestj--; bestsize++;
      }
      while (besti + bestsize < ahi && bestj + bestsize < bhi && !junk.has(b[bestj + bestsize]) &&
             a[besti + bestsize] === b[bestj + bestsize]) bestsize++;
      while (besti > alo && bestj > blo && junk.has(b[bestj - 1]) && a[besti - 1] === b[bestj - 1]) {
        besti--; bestj--; bestsize++;
      }
      while (besti + bestsize < ahi && bestj + bestsize < bhi && junk.has(b[bestj + bestsize]) &&
             a[besti + bestsize] === b[bestj + bestsize]) bestsize++;
      return [besti, bestj, bestsize];
    }

    get_matching_blocks() {
      if (this.matching_blocks) return this.matching_blocks;
      const la = this._a.length, lb = this._b.length;
      const cola = [[0, la, 0, lb]];
      const bloques = [];
      while (cola.length) {
        const [alo, ahi, blo, bhi] = cola.pop();
        const x = this.find_longest_match(alo, ahi, blo, bhi);
        const [i, j, k] = x;
        if (k) {
          bloques.push(x);
          if (alo < i && blo < j) cola.push([alo, i, blo, j]);
          if (i + k < ahi && j + k < bhi) cola.push([i + k, ahi, j + k, bhi]);
        }
      }
      bloques.sort((x, y) => (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]));
      let i1 = 0, j1 = 0, k1 = 0;
      const noAdyacentes = [];
      for (const [i2, j2, k2] of bloques) {
        if (i1 + k1 === i2 && j1 + k1 === j2) k1 += k2;
        else {
          if (k1) noAdyacentes.push([i1, j1, k1]);
          i1 = i2; j1 = j2; k1 = k2;
        }
      }
      if (k1) noAdyacentes.push([i1, j1, k1]);
      noAdyacentes.push([la, lb, 0]);
      this.matching_blocks = noAdyacentes;
      return noAdyacentes;
    }

    get_opcodes() {
      if (this.opcodes) return this.opcodes;
      let i = 0, j = 0;
      const r = this.opcodes = [];
      for (const [ai, bj, size] of this.get_matching_blocks()) {
        let tag = '';
        if (i < ai && j < bj) tag = 'replace';
        else if (i < ai) tag = 'delete';
        else if (j < bj) tag = 'insert';
        if (tag) r.push([tag, i, ai, j, bj]);
        i = ai + size; j = bj + size;
        if (size) r.push(['equal', ai, i, bj, j]);
      }
      return r;
    }

    ratio() {
      let m = 0;
      for (const t of this.get_matching_blocks()) m += t[2];
      return ratioDe(m, this._a.length + this._b.length);
    }

    quick_ratio() {
      if (!this.fullbcount) {
        const f = this.fullbcount = new Map();
        for (let i = 0; i < this._b.length; i++) f.set(this._b[i], (f.get(this._b[i]) || 0) + 1);
      }
      const full = this.fullbcount, avail = new Map();
      let m = 0;
      for (let i = 0; i < this._a.length; i++) {
        const elt = this._a[i];
        const numb = avail.has(elt) ? avail.get(elt) : (full.get(elt) || 0);
        avail.set(elt, numb - 1);
        if (numb > 0) m++;
      }
      return ratioDe(m, this._a.length + this._b.length);
    }

    real_quick_ratio() {
      const la = this._a.length, lb = this._b.length;
      return ratioDe(Math.min(la, lb), la + lb);
    }
  }

  /** difflib.get_close_matches(word, possibilities, n=3, cutoff=0.6). */
  function get_close_matches(word, possibilities, n = 3, cutoff = 0.6) {
    if (!(n > 0)) throw new C.PyError('ValueError', `n must be > 0: ${n}`);
    if (!(cutoff >= 0.0 && cutoff <= 1.0)) throw new C.PyError('ValueError', `cutoff must be in [0.0, 1.0]: ${cutoff}`);
    const res = [];
    const s = new SequenceMatcher();
    s.set_seq2(word);
    for (const x of possibilities) {
      s.set_seq1(x);
      if (s.real_quick_ratio() >= cutoff && s.quick_ratio() >= cutoff && s.ratio() >= cutoff) res.push([s.ratio(), x]);
    }
    // _nlargest(n, result): tuplas (puntuación, palabra) de mayor a menor; la palabra desempata por punto de código.
    return C.sorted(res, { reverse: true }).slice(0, n).map((t) => t[1]);
  }

  R2.py = R2.py || {};
  R2.py.difflib = { SequenceMatcher, get_close_matches };
})(globalThis.R2 = globalThis.R2 || {});

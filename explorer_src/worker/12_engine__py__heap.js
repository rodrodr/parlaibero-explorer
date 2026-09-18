/* ===== src/engine/py/heap.js ===== */
/* 2REP_Standalone · engine/py/heap.js
 *
 * R2.py.heap: heapq de Python 3.12 con el mismo algoritmo (_siftdown/_siftup), así que el montículo queda
 * idéntico elemento a elemento y los empates salen en el mismo orden. Compara con `<` de Python
 * (R2.py.core.lt): números, cadenas por punto de código y tuplas (Array) elemento a elemento.
 * nlargest/nsmallest equivalen a sorted(iterable, key=key, reverse=True)[:n] / sorted(...)[:n], como documenta
 * Python (estables: a igual clave, el primero en aparecer).
 */
(function (R2) {
  'use strict';

  const C = R2.py.core;
  const menor = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a < b : C.lt(a, b));

  function siftdown(heap, inicio, pos) {
    const nuevo = heap[pos];
    while (pos > inicio) {
      const padre = (pos - 1) >> 1;
      const p = heap[padre];
      if (menor(nuevo, p)) { heap[pos] = p; pos = padre; continue; }
      break;
    }
    heap[pos] = nuevo;
  }

  function siftup(heap, pos) {
    const fin = heap.length, inicio = pos, nuevo = heap[pos];
    let hijo = 2 * pos + 1;
    while (hijo < fin) {
      const der = hijo + 1;
      if (der < fin && !menor(heap[hijo], heap[der])) hijo = der;
      heap[pos] = heap[hijo];
      pos = hijo;
      hijo = 2 * pos + 1;
    }
    heap[pos] = nuevo;
    siftdown(heap, inicio, pos);
  }

  const vacio = () => new C.PyError('IndexError', 'index out of range');

  function heappush(heap, item) {
    heap.push(item);
    siftdown(heap, 0, heap.length - 1);
  }

  function heappop(heap) {
    if (heap.length === 0) throw vacio();
    const ultimo = heap.pop();
    if (heap.length) {
      const r = heap[0];
      heap[0] = ultimo;
      siftup(heap, 0);
      return r;
    }
    return ultimo;
  }

  function heapreplace(heap, item) {
    if (heap.length === 0) throw vacio();
    const r = heap[0];
    heap[0] = item;
    siftup(heap, 0);
    return r;
  }

  function heappushpop(heap, item) {
    if (heap.length && menor(heap[0], item)) {
      const r = heap[0];
      heap[0] = item;
      siftup(heap, 0);
      return r;
    }
    return item;
  }

  function heapify(x) {
    for (let i = (x.length >> 1) - 1; i >= 0; i--) siftup(x, i);
  }

  function nlargest(n, iterable, key = null) {
    const items = Array.from(iterable);
    if (n === 1) return items.length ? [C.pyMax(items, key)] : [];
    if (n <= 0) return [];
    return C.sorted(items, { key, reverse: true }).slice(0, n);
  }

  function nsmallest(n, iterable, key = null) {
    const items = Array.from(iterable);
    if (n === 1) return items.length ? [C.pyMin(items, key)] : [];
    if (n <= 0) return [];
    return C.sorted(items, { key }).slice(0, n);
  }

  R2.py = R2.py || {};
  R2.py.heap = { heappush, heappop, heapreplace, heappushpop, heapify, nlargest, nsmallest };
})(globalThis.R2 = globalThis.R2 || {});

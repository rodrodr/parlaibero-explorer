#!/usr/bin/env node
/* Diarios Explorer · tools/expresiones_precalculadas.cjs
 *
 * Construye con el motor del explorador (los mismos módulos del worker, en Node) la base de un CSV y guarda su tabla de
 * expresiones de varias palabras como paquete comprimido (R2.expresiones.paquete). Lo llama
 * tools/expresiones_precalculadas.py, que decide qué CSV procesar, le pasa los datos del worker tal como los arma
 * build.py y escribe el índice.
 *
 * Uso: node tools/expresiones_precalculadas.cjs PAIS CSV SALIDA.json.gz DATOS_WORKER.json SHA256_DEL_CSV
 * Escribe en la salida estándar una línea JSON: { pais, version, expresiones, bytes, segundos, resumen }.
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');

const SRC = path.join(__dirname, '..');
const [PAIS, CSV, SALIDA, DATOS, SHA] = process.argv.slice(2);
if (!SHA) {
  console.error('uso: node expresiones_precalculadas.cjs PAIS CSV SALIDA.json.gz DATOS_WORKER.json SHA256_DEL_CSV');
  process.exit(2);
}

globalThis.self = globalThis;
const sqlite3InitModule = require(path.join(SRC, 'vendor', 'sqlite3.js'));
const wasm = fs.readFileSync(path.join(SRC, 'vendor', 'sqlite3.wasm'));
const datos = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
for (const f of fs.readdirSync(path.join(SRC, 'worker')).filter((x) => x.endsWith('.js')).sort()) {
  if (f.includes('principal')) { globalThis.R2 = globalThis.R2 || {}; globalThis.R2.datos = datos; }   // como en build.py
  vm.runInThisContext(fs.readFileSync(path.join(SRC, 'worker', f), 'utf8'), { filename: f });
}

(async () => {
  const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {},
    instantiateWasm(imports, ok) { WebAssembly.instantiate(wasm, imports).then((r) => ok(r.instance, r.module)); return {}; } });
  const fd = fs.openSync(CSV, 'r');
  const tamano = fs.fstatSync(fd).size;
  const leerTrozo = (o, l) => { const b = Buffer.alloc(l); fs.readSync(fd, b, 0, l, o); return b.buffer.slice(b.byteOffset, b.byteOffset + l); };
  const t0 = Date.now();
  const r = await R2.ingesta.construir({ tamano, nombre: path.basename(CSV), leerTrozo }, sqlite3, { sha256: 'diferido' });
  if (r.informe.pais && r.informe.pais !== PAIS) throw new Error(`el CSV es de ${r.informe.pais}, no de ${PAIS}`);
  const pq = R2.expresiones.paquete({ db: r.db, sqlite3 });
  if (!pq.filas.length) throw new Error(`la base no tiene expresiones: ${JSON.stringify(r.informe.avisos)}`);
  Object.assign(pq, { pais: PAIS, csv_sha256: SHA, csv_bytes: tamano });
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(pq)), { level: 9 });
  fs.writeFileSync(SALIDA, gz);
  const m = pq.meta || {};
  process.stdout.write(JSON.stringify({ pais: PAIS, version: pq.version, expresiones: pq.filas.length, bytes: gz.length,
    segundos: Math.round((Date.now() - t0) / 100) / 10,
    resumen: { tokens: m.tokens_corpus, intervenciones: m.intervenciones, muestra_1_de: m.muestra_1_de, frecuencia_minima: m.frecuencia_minima } }) + '\n');
  process.exit(0);
})().catch((e) => { console.error(e && e.stack ? e.stack : String(e)); process.exit(1); });

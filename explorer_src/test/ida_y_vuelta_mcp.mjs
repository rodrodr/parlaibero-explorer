// Diarios Explorer · test/ida_y_vuelta_mcp.mjs — ida y vuelta de una biblioteca escrita por parlaibero-mcp.
//
// Juzga la compatibilidad con el MOTOR REAL del explorador, no con una copia: el worker.js lo ensambla build.py
// (vendor/sqlite3.js + worker/*.js + R2.datos), se ejecuta en Node, construye la base con un CSV publicado de
// ParlaIbero, importa el .2replib que escribió el MCP por la ruta POST /import y lo vuelve a exportar por
// POST /export (format «bundle»). Comprueba:
//   1. que la importación no falla y trae todos los items;
//   2. que el explorador reconoce la fuente como la suya (al reexportar no aparece «fuente_importada»);
//   3. que la reexportación devuelve los mismos speech_id, notas y etiquetas;
//   4. que fecha, nombre y orador de cada item coinciden con lo que el explorador guarda de esa fila.
//
// Uso:  node explorer_src/test/ida_y_vuelta_mcp.mjs <PAÍS>_interventions.csv <biblioteca>_<PAÍS>.2replib [salida.2replib]
// Sale con código 0 si todo cuadra y 1 si no; imprime un informe JSON. Con un tercer argumento guarda el .2replib tal
// como lo reexporta el explorador, para cerrar el círculo importándolo en el MCP (library_import).
//
// Caso de rechazo:  node explorer_src/test/ida_y_vuelta_mcp.mjs ES_interventions.csv <biblioteca>_SV.2replib --rechazo
// El archivo es de OTRO país que el CSV. Sus speech_id son filas de otro CSV, así que la importación debe negarse (400)
// sin crear nada, tanto si lo dice el «corpus» del archivo como si solo lo dice el DOI de su fuente, y también en una
// copia 2replib-copia/1 con items sin corpus propio. Comprueba además que lo que NO es una mezcla sigue entrando: el
// archivo sin corpus ni fuente (no dice su país) y la copia cuyos items llevan su corpus (se guardan en el suyo).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const rechazo = args.includes('--rechazo');
const [csv, replib, salida] = args.filter((a) => a !== '--rechazo');
if (!csv || !replib) {
  console.error('uso: node test/ida_y_vuelta_mcp.mjs <PAÍS>_interventions.csv <archivo>.2replib [salida.2replib | --rechazo]');
  process.exit(2);
}

// ---------------------------------------------------------------- el worker, tal como lo ensambla build.py
const fuenteWorker = execFileSync('python3', ['-c', 'import sys, build; sys.stdout.buffer.write(build.worker())'],
  { cwd: RAIZ, maxBuffer: 1 << 30 });
globalThis.R2_PRINCIPAL_MANUAL = true;          // no instalarse en «self»: lo maneja esta prueba
globalThis.sqlite3ApiConfig = { warn: () => {} };
vm.runInThisContext(fuenteWorker.toString('utf8'), { filename: 'worker.js' });
const R2 = globalThis.R2;
const wasm = fs.readFileSync(path.join(RAIZ, 'vendor', 'sqlite3.wasm'));

// ---------------------------------------------------------------- un núcleo del motor
const mensajes = [];
let alListo = null;
const nucleo = R2.principal.crearNucleo({
  post: (m) => {
    mensajes.push(m.tipo);
    if (m.tipo === 'listo' && alListo) alListo.resolver(m);
    if ((m.tipo === 'fallo_construccion' || m.tipo === 'fatal') && alListo) alListo.rechazar(new Error(JSON.stringify(m)));
  },
  iniciarSqlite: (bin) => globalThis.sqlite3InitModule({
    print: () => {}, printErr: () => {},
    instantiateWasm(imports, listo) { WebAssembly.instantiate(bin, imports).then((r) => listo(r.instance, r.module)); return {}; },
  }),
});
const listo = new Promise((resolver, rechazar) => { alListo = { resolver, rechazar }; });
nucleo.recibir({ tipo: 'iniciar', v: R2.principal.VERSION_PROTOCOLO, wasm });
const archivo = await fs.openAsBlob(csv);
nucleo.recibir({ tipo: 'construir', archivo });
const fin = await listo;

const llamar = async (metodo, ruta, cuerpo) => {
  const ctx = nucleo.contextoApi({ ceder: async () => {}, cancelada: false, presupuestoMs: 1e9, progreso: () => {} });
  return R2.router.despachar({ metodo, ruta, query: {}, cuerpoTexto: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }, ctx);
};
const api = async (metodo, ruta, cuerpo) => {
  const r = await llamar(metodo, ruta, cuerpo);
  if (r.status !== 200) throw new Error(`${metodo} ${ruta}: ${r.status} ${JSON.stringify(r.cuerpo)}`);
  return r;
};

// ---------------------------------------------------------------- ida: importar el archivo del MCP
await api('POST', '/_biblioteca/restaurar', { bytes: null });
const paquete = JSON.parse(fs.readFileSync(replib, 'utf8'));
if (rechazo) process.exit(await casoRechazo(paquete));
const imp = await api('POST', '/import', { payload: paquete });
const cid = imp.cuerpo.collection.id;

// ---------------------------------------------------------------- vuelta: exportarla otra vez
const exp = await api('POST', '/export', { format: 'bundle', collection_id: cid });
const datos = exp.cuerpo instanceof Uint8Array ? exp.cuerpo : new Uint8Array(await exp.cuerpo.arrayBuffer());
const vuelta = JSON.parse(new TextDecoder().decode(datos));
if (salida) fs.writeFileSync(salida, datos);

// ---------------------------------------------------------------- comprobaciones
const ida = paquete.items;
const clave = (it) => String(it.speech_id);
const porId = new Map(vuelta.items.map((it) => [clave(it), it]));
const distintos = [];
for (const it of ida) {
  const v = porId.get(clave(it));
  if (!v) { distintos.push({ speech_id: it.speech_id, falta: true }); continue; }
  const dif = {};
  for (const k of ['note', 'tags', 'date', 'rep_name', 'speaker']) {
    if (JSON.stringify(it[k] ?? null) !== JSON.stringify(v[k] ?? null)) dif[k] = { mcp: it[k] ?? null, explorador: v[k] ?? null };
  }
  if (Object.keys(dif).length) distintos.push({ speech_id: it.speech_id, ...dif });
}
const informe = {
  csv: path.basename(csv), archivo: path.basename(replib), filas_corpus: fin.informe.n_filas,
  corpus_explorador: vuelta.corpus, corpus_archivo: paquete.corpus,
  importados: imp.cuerpo.n_items, items_archivo: ida.length, items_vuelta: vuelta.items.length,
  fuente_reconocida: !('fuente_importada' in vuelta), cita_vuelta: vuelta.fuente && vuelta.fuente.cita,
  mismos_ids: ida.map(clave).sort().join() === vuelta.items.map(clave).sort().join(),
  items_con_diferencias: distintos.length, ejemplos: distintos.slice(0, 10),
};
informe.ok = informe.importados === ida.length && informe.items_vuelta === ida.length && informe.fuente_reconocida
  && informe.mismos_ids && distintos.length === 0 && informe.corpus_explorador === informe.corpus_archivo;
console.log(JSON.stringify(informe, null, 2));
process.exit(informe.ok ? 0 : 1);

// ---------------------------------------------------------------- caso de rechazo (--rechazo)
async function casoRechazo(paquete) {
  const nBibliotecas = async () => (await api('GET', '/collections')).cuerpo.collections.length;
  const sin = (o, ...claves) => Object.fromEntries(Object.entries(o).filter(([k]) => !claves.includes(k)));
  const copia = (items) => ({
    format: '2replib-copia/1', exported_at: paquete.exported_at, edicion: 'standalone', corpus: paquete.corpus, fuente: paquete.fuente,
    collections: [{ id: 1, name: 'copia de prueba', description: '', color: 'indigo', fuente: paquete.fuente, items }], searches: [],
  });
  const itemsSinCorpus = paquete.items.map((it) => sin(it, 'corpus'));
  const casos = [
    // [nombre, payload, ¿debe rechazarse?]
    ['por_corpus', paquete, true],
    ['por_doi', sin(paquete, 'corpus'), true],
    ['por_doi_url', Object.assign(sin(paquete, 'corpus'), { fuente: Object.assign({}, paquete.fuente, { doi: `https://doi.org/${String(paquete.fuente.doi).toLowerCase()}` }) }), true],
    ['copia_items_sin_corpus', copia(itemsSinCorpus), true],
    // la copia entra entera, pero sus items van a SU corpus: en la lista del corpus abierto no aparece ninguna biblioteca
    ['copia_items_con_corpus', copia(itemsSinCorpus.map((it) => Object.assign({ corpus: paquete.corpus }, it))), false, 0],
    // el archivo que no dice su país entra como antes (no hay con qué compararlo)
    ['sin_pais_declarado', sin(paquete, 'corpus', 'fuente', 'fuente_importada'), false, 1],
  ];
  const resultados = [];
  for (const [nombre, payload, debeRechazar, visibles] of casos) {
    const antes = await nBibliotecas();
    const r = await llamar('POST', '/import', { payload });
    const despues = await nBibliotecas();
    const detalle = r.status === 200 ? null : (r.cuerpo && r.cuerpo.error) || JSON.stringify(r.cuerpo);
    const importados = r.status === 200 ? r.cuerpo.n_items : 0;
    const ok = debeRechazar
      ? r.status === 400 && despues === antes && /Abra el CSV de/.test(String(detalle))
      : r.status === 200 && importados === paquete.items.length && despues - antes === visibles;
    resultados.push({ caso: nombre, espera: debeRechazar ? 'rechazo' : 'importa', status: r.status, items_importados: importados,
      bibliotecas_visibles_en_corpus_abierto: despues - antes, ok, mensaje: detalle });
  }
  const informe = { csv: path.basename(csv), archivo: path.basename(replib), corpus_archivo: paquete.corpus, casos: resultados };
  informe.ok = resultados.every((x) => x.ok);
  console.log(JSON.stringify(informe, null, 2));
  return informe.ok ? 0 : 1;
}

# Diarios Explorer · fuentes y ensamblado

`Diarios_Explorer.html` (en la carpeta superior) es un HTML autónomo: se abre con doble clic en un
navegador reciente (Chrome/Edge 112+, Firefox 116+, Safari 17+) y el usuario elige el CSV de
intervenciones de un país. La base de datos (SQLite + FTS5 en WebAssembly) se construye en el
navegador; nada sale del equipo.

## Ensamblar el HTML

```bash
python3 explorer_src/build.py            # escribe ../Diarios_Explorer.html
python3 explorer_src/build.py salida.html
```

`build.py` concatena, en este orden: `html/head_top.html`, el script de comprobación del navegador
(`page/00_*`), las hojas `css/*.css`, `html/body.html`, `datos/page_datos.json` (`<script id="r2-datos">`),
los blobs gzip+base64 (`vendor/sqlite3.wasm`, el worker = `vendor/sqlite3.js` + `worker/*.js` +
`datos/worker_datos.json`, y `assets/capitales.json` con las letras capitulares) y el resto de
`page/*.js`. El `build_id` de ambos JSON se calcula a partir del contenido del worker: si cambia el
esquema, las bases recordadas en el navegador se invalidan solas.

## Formato del CSV

Cabecera exacta (separador `,`, UTF-8, texto entre comillas con saltos de línea):

```
id_session,id_int,legislature,legislative_session,session_number,date,session_type,
intervention_order,speaker_raw,id_dep,speaker_name,sex,party,district,dm_speech,text
```

El país se deduce de las dos letras iniciales de `id_session` (`ES`, `BR`, `SV`…); los nombres están en
`worker/28_engine__info.js` (`PAISES`). Las bibliotecas del investigador se guardan con la clave
`Diarios_<país>`, así que las de cada país solo se ven con el CSV de ese país cargado.

## Cómo cabe un CSV de 1,5 GB en el navegador

El heap de WebAssembly tiene un tope de 2 GiB. Para que quepan los corpus grandes:

- el texto no se guarda en claro: se concatena en bloques de 128 KiB comprimidos con gzip
  (`worker/04b_worker__texto.js`, tabla `texto_bloques`) y la vista `speeches` lo reconstruye con la
  función SQL `r2_texto(bloque, desde, largo)` (descompresión síncrona con caché LRU);
- el índice FTS5 se alimenta al insertar (contenido externo sobre la vista) y no se compacta por
  encima de 600 MiB de texto (`OPTIMIZAR_HASTA_BYTES` en `worker/07_worker__ingesta.js`);
- solo hay tres índices B-tree (`idx_session`, `idx_nwords`, `idx_rep`).

Medido en Node con la misma build de SQLite (heap de wasm al terminar):

| país | CSV | filas | construcción | heap |
|------|-----|-------|--------------|------|
| SV | 103 MB | 49.077 | 3,7 s | 87 MiB |
| ES | 1,06 GB | 562.514 | 44 s | 923 MiB |
| BR | 1,53 GB | 1.657.113 | 82 s | 1.499 MiB |

## Esquema interno

`speeches_datos(id, id_int, id_session, num_session, session_number, ord, date, year, legislature,
legislative_session, session_type, speaker, rep_id, id_dep, rep_name, sex, district, party, dm_speech,
nwords, bloque, desde, largo)`; `id` es correlativo (orden del archivo), `num_session` numera las sesiones
por orden de aparición de `id_session` y `rep_id` los diputados por orden de aparición de `id_dep`.
Las filas sin orador (`dm_speech = 0`) llevan `speaker` = `SUMARIO` (fila 0 de la sesión) o
`COMENTARIOS`, que la interfaz muestra como «Encabezado y sumario de la sesión» y «Texto sin orador».

## Pruebas

`build.py` reproduce byte a byte la plantilla original cuando se le pasan los blobs originales
(`--blob=corpus=… --blob=bibliotecas=…`). El motor entero se puede ejecutar en Node sin navegador con
un arnés que carga `vendor/sqlite3.js` y `worker/*.js` y llama a `R2.principal.crearNucleo` (véase el
historial de desarrollo); las rutas `/api/*` responden igual que en la página.

## Léxico (keyness) de bibliotecas grandes

Medido con la biblioteca «Reforma tributaria» de Brasil (85.318 intervenciones, 361 millones de caracteres) en Chromium:
de más de 5 minutos a unos 24 s. Cambios: los textos se leen en orden de bloque con descompresión nativa en paralelo
(`R2.texto.leerTextos`), por encima de 25 millones de caracteres se usa una segmentación rápida en lugar del análisis
completo del Diario (`particionRapida` en `worker/35_engine__partition.js`; la interfaz lo indica como «segmentación
rápida»), el recuento de términos se hace por trozos cediendo el hilo, y al vocabulario FTS5 solo se consultan los
términos candidatos, con caché por conexión.

## Almacenamiento del navegador

Todos los nombres de almacenamiento (IndexedDB `diarios-explorer` y `diarios-explorer-base`, claves `diarios-explorer:v1:*`
de localStorage, canal y cerrojos `diarios-explorer:v1`, directorio OPFS `diarios-corpus`) son propios de esta página:
no comparte bibliotecas ni bases recordadas con la plantilla original, aunque ambas se abran como `file://` en el mismo
navegador (Chrome comparte ese almacenamiento entre todos los archivos locales). La lista de bibliotecas muestra solo
las que tienen intervenciones del país cargado o están vacías.

## ParlaIbero

El explorador está hecho para los conjuntos de datos de ParlaIbero (Harvard Dataverse,
https://dataverse.harvard.edu/dataverse/parlaibero): un conjunto por país, cada uno con su DOI. El registro
`datos/fuentes_parlaibero.json` (título, autores, versión, fecha, licencia, cita y archivo de intervenciones de los
16 países, más la ficha de la colección) lo genera `tools/fuentes_parlaibero.py` consultando la API de Dataverse;
`build.py` lo incorpora a los datos de la página y del worker. Con él, la cabecera dice «ParlaIbero · País», la caja
«Cómo citar» muestra la cita del país cargado (con BibTeX, RIS y DOI), y las exportaciones (CSV, JSON, Markdown,
referencias, .2replib) llevan esa cita en sus metadatos y en las columnas `fuente_cita` y `fuente_doi`. Cuando se
publique una versión nueva de un conjunto, basta con volver a ejecutar el script y reensamblar:

```bash
python3 explorer_src/tools/fuentes_parlaibero.py
python3 explorer_src/build.py
```

Un país que no esté en el registro se muestra con su código y una cita genérica.

## Progreso de las operaciones largas

El worker puede informar del avance de una petición `/api` mientras la atiende: `ctx.progreso(ev)` en el motor envía
`progreso_op{id, ev}` al hilo principal, `rpc.js` lo entrega a la función `alProgreso` de esa petición y el shim de
`fetch` la acepta como opción no estándar (`fetch(url, { alProgreso })`). El léxico de una biblioteca lo usa con seis
fases ponderadas (lectura, segmentación, recuento, vocabulario, estadísticos, formas con tilde), y la interfaz pinta una
barra con la fase, el recuento, el porcentaje, el tiempo transcurrido, una estimación del restante y un botón para
cancelar. La ruta del léxico tiene prioridad de fondo: cede el hilo por trozos y las búsquedas siguen respondiendo
mientras calcula.

## Edición web (GitHub Pages)

`build.py` produce a la vez el HTML autónomo (`../Diarios_Explorer.html`) y la edición web en `../docs/`: `index.html`,
`app.css`, `app.js` (los mismos módulos de `page/`, con `web/cargas_web.js` en lugar de `page/03_cargas__cargas.js`
para descargar `sqlite3.wasm` y `worker.js` en vez de leerlos embebidos), `worker.js`, `sqlite3.wasm`, `capitales/*.svg`
y el service worker `web/sw.js` (caché de la aplicación para abrirla sin conexión y aviso de versión nueva). Las dos
salidas nacen de las mismas fuentes y comparten `build_id`; la edición web además activa `edicion.web`, que en el
navegador (https) permite recordar la base en el almacenamiento privado (OPFS) y volver a abrirla sin elegir el CSV.
Los CSV siguen sin subirse a ningún sitio: el usuario los elige en su equipo, como en la versión autónoma.

Publicación en GitHub Pages, la primera vez:

```bash
cd /Users/rodrodr/Dropbox/Apps/diaries_explorer
python3 explorer_src/build.py          # regenera Diarios_Explorer.html y docs/
git init && git add . && git commit -m "ParlaIbero explorer"
git remote add origin https://github.com/<usuario>/<repositorio>.git
git push -u origin main
```

En GitHub: Settings → Pages → Source «Deploy from a branch», rama `main`, carpeta `/docs`. La página queda en
`https://<usuario>.github.io/<repositorio>/`. El `.gitignore` deja fuera `data/` (los CSV) y `template/`.

Cada cambio posterior: editar `explorer_src/`, ejecutar `python3 explorer_src/build.py`, hacer commit y push; el HTML
autónomo y la web salen del mismo ensamblado. (Alternativa: un flujo de GitHub Actions que ejecute `build.py` en cada
push y despliegue `docs/`; no hace falta ninguna dependencia, solo Python 3.)

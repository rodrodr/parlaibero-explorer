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

## Hitos históricos de la tendencia

La tendencia pinta, numerados sobre el gráfico, los hitos históricos del país cargado (elecciones, tomas de posesión,
constituciones, golpes, crisis, leyes emblemáticas…). Viven en `datos/hitos_parlaibero.json`, un registro por país
(`paises.<CC>.hitos`) que `build.py` incorpora a los datos del worker; el motor los sirve en la respuesta de `/ngram`
con `R2.gen.hitos.de(país)` (`worker/16_engine__generated__hitos.js`). Cada hito lleva `id`, `date` (y `date_end` si
dura varios días), `label` (corto), `desc` (una frase), `kind` (`electoral`, `politico`, `parlamentario`, `conflicto`,
`economico`, `social`), `rank` (1 principal, 2 relevante, 3 contexto), `fuente` (URL) y `verificar`.

El registro lo ensambla y contrasta `tools/hitos_parlaibero.py`: lee un `hitos_<CC>.json` por país (`--desde DIR`),
valida el formato, descarga cada fuente (con la URL codificada en porcentaje y reintentos si el servidor limita el
ritmo) y comprueba que la fecha del hito aparece en su texto, en ISO, español, portugués o inglés. Entran en el
registro los hitos con la fecha completa confirmada y los que solo confirman mes y año, que se guardan con
`verificar=true` y la interfaz señala como fecha pendiente de verificar. Lo que no se confirma de ninguna manera se
descarta y queda en el informe (`.informe.md`) y en `.pendientes.json` para revisarlo con otra fuente. Para corregir
o añadir hitos: editar el JSON del país, volver a ejecutar el script y reensamblar.

El informe avisa además cuando dos hitos del mismo país caen en la misma fecha, que casi siempre delata el mismo
acontecimiento entrado dos veces al fundir listas de distinto origen; el contraste de fechas no puede detectarlo,
porque ambas entradas son ciertas por separado.

Estado del registro (17 de septiembre de 2026): 751 hitos en los 16 países, 728 con la fecha exacta confirmada en su
fuente y 23 con solo el mes confirmado. Las fuentes son artículos concretos de Wikipedia en español, portugués o
inglés. Ocho candidatos se descartaron por no poder contrastarse y quedan anotados en el informe.

```bash
python3 explorer_src/tools/hitos_parlaibero.py --desde /carpeta/con/hitos_XX.json
python3 explorer_src/build.py
```

Legibilidad: la interfaz elige cuántos hitos dibuja según el espacio (`selectMilestones` en `page/21_app.js`): con
«los que quepan» (por defecto) baja de nivel de importancia hasta que las marcas caben sin solaparse en una o dos
filas; el selector permite forzar «principales», «relevantes» o «todos». El gráfico no cede altura: la leyenda es
plegable y de altura acotada (se pliega sola con más de 12 hitos), y los hitos que no caben se cuentan aparte.

## Coocurrencias y temas

La pestaña «Coocurrencias» de una biblioteca construye la red de coocurrencias de sus términos característicos y
detecta en ella temas con el algoritmo de Leiden. Motor en `worker/35b_engine__coocurrencia.js`, ruta
`GET /collections/{cid}/cooccurrence` en `worker/36b_engine__rutas_coocurrencia.js`, Leiden en `worker/35a_engine__leiden.js`.

1. **Vocabulario**: los términos de sobreuso del léxico de la biblioteca (100, 250 o 500, de mayor a menor G²), sin cifras
   ni las palabras vacías publicadas de la lengua del corpus: Snowball (BSD), la lista conservadora que quanteda usa por
   defecto, en portugués para Brasil y Portugal y en español para el resto (`datos/palabras_vacias.json`, generado por
   `tools/palabras_vacias.py`). Se conservan «estado» y «estados», que Snowball incluye como formas de «estar». Se probó
   antes stopwords-iso y se descartó: trata como vacías palabras centrales del vocabulario político («estado», «poder»,
   «trabajo», «sistema», «general», «medio», «país») y en la biblioteca de El Salvador eliminaba quince de la red. El léxico se guarda en
   memoria por biblioteca y opciones, así que abrir las coocurrencias después del léxico no lo recalcula.
2. **Texto**: el mismo que analiza el léxico, con la misma segmentación del discurso y el mismo plegado.
3. **Unidad de contexto**: la intervención, o fragmentos consecutivos de 20 palabras.
4. **Recuento** en matriz triangular densa: con el vocabulario del léxico la red es casi completa (99,8 % de los pares en
   la biblioteca de reforma tributaria de Brasil), así que la matriz densa ocupa la mitad que una lista de adyacencia.
5. **Asociación**: G² de Dunning con signo sobre la tabla 2×2 de unidades; se conservan los pares con asociación positiva
   y G² ≥ 10,83 (p < 0,001) que están entre los k vecinos de mayor G² de alguno de sus términos. Peso de cada arista: la
   fuerza de asociación, observado/esperado (van Eck y Waltman, 2009).
6. **Comunidades**: Leiden (Traag, Waltman y van Eck, 2019) con modularidad y resolución γ (0,6, 1 o 1,6), semilla fija
   y refinado voraz. Garantiza comunidades conexas, que con Louvain no está asegurado. Probado contra grafos de estructura
   conocida: encuentra el óptimo del club de kárate de Zachary (0,4198 con cuatro comunidades) y reproduce el límite de
   resolución en un anillo de cliques.
7. **Temas**: ordenados por el G² medio de sus términos en el léxico, con su cobertura en intervenciones. Son candidatos:
   se revisan en la lista (búsqueda de sus términos dentro de la biblioteca, por relevancia, con las coincidencias
   resaltadas) y se pueden marcar términos para excluirlos y recalcular.
8. **Jerarquía de lectura**: cada intervención se puntúa con BM25 (k1 = 1,2, b = 0,75, los de FTS5), con el peso de cada
   término dado por ln(1 + G² en el léxico) en lugar del IDF. Hay una puntuación por tema y otra global, y una selección
   variada que toma por turnos la mejor de cada tema. Sirve para priorizar la lectura y, más adelante, para elegir las
   intervenciones más informativas que enviar a un modelo de lenguaje.

Exportaciones: los temas en CSV, la red en GEXF para Gephi y la jerarquía de lectura en CSV, todas con los parámetros y
la cita del conjunto de datos. Mismos parámetros, mismo resultado: el cálculo en el navegador coincide exactamente con el
de Node.

| biblioteca | intervenciones | primera vez | con el léxico ya calculado |
|---|---|---|---|
| El Salvador, siete términos de agenda | 14.498 | 5,8 s | 2,6 s |
| Brasil, reforma tributaria | 85.318 | 54 s | 23 s |

## Edición web (GitHub Pages)

`build.py` produce a la vez el HTML autónomo (`../Diarios_Explorer.html`) y la edición web en `../docs/`: `index.html`,
`app.css`, `app.js` (los mismos módulos de `page/`, con `web/cargas_web.js` en lugar de `page/03_cargas__cargas.js`
para descargar `sqlite3.wasm` y `worker.js` en vez de leerlos embebidos), `worker.js`, `sqlite3.wasm`, `capitales/*.svg`
y el service worker `web/sw.js` (caché de la aplicación para abrirla sin conexión y aviso de versión nueva). Las dos
salidas nacen de las mismas fuentes y comparten `build_id` (huella del worker: invalida las bases recordadas cuando cambia
el esquema); la caché de la edición web se versiona con `version_web`, huella de todas las fuentes (también los datos, como
los hitos), para que cualquier cambio llegue a los navegadores que ya la tenían. La edición web además activa `edicion.web`, que en el
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

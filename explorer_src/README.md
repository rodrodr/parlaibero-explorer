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

## Partidos homogéneos

La columna `party` de los CSV trae etiquetas distintas para un mismo partido: variantes de escritura («CIU» y «CiU»),
siglas y nombre completo («PSC» y «Partido Social Cristiano»), federaciones y listas («PSC-PSOE», «PSOE-A»), sectores
de un lema (en Uruguay) o nombres anteriores del mismo partido (AP → PP, PFL → DEM, Convergencia → MC). Al construir la
base, la ingesta guarda en `speeches_datos.party` el partido canónico de cada etiqueta (`worker/04c_worker__partidos.js`,
`R2.partidos`), de modo que filtros, distribución, léxico, coocurrencias, menciones y exportaciones usan un único nombre
por partido. Las facetas de partido llevan además el nombre completo y las etiquetas del CSV que reúnen, con sus filas:
la interfaz los muestra al pasar sobre el partido en el filtro, y el buscador del filtro los encuentra («PSC» → PSOE).
Si un CSV trae etiquetas que no están en la tabla (una versión posterior), se muestran como vienen y el informe de la
carga lo avisa (`PARTIDOS_FUERA_DE_REGISTRO`).

Argentina es un caso aparte: su columna no es el bloque de cada intervención sino la lista de todos los bloques del
diputado en su carrera, igual en todas sus filas. Su tabla es de trayectorias: cada etiqueta lleva la lista de bloques
con la fecha de ingreso del diputado en cada uno (de los registros de la Cámara, informe especial 103 y datos abiertos
«Diputados»), y cada intervención va al último bloque en que había entrado en su fecha (acierta en el 99 % de las
intervenciones con bloque oficial conocido). La misma asignación con fecha sirve en otro país cuando una etiqueta cambia de
partido en una fecha conocida: en Perú, «UPP» es la bancada Nacionalista Gana Perú en 2011-2016.

Las tablas por país están en `datos/partidos/<CC>.json`: cada partido con su sigla, nombre completo, etiquetas y, si
cambió de nombre, el cambio con su fecha y su fuente; `revisar` recoge las decisiones discutibles con la alternativa
(fundir o no una coalición, un sucesor sin continuidad legal…). Criterio: se funden las variantes, las federaciones y
listas del propio partido y los cambios de nombre con continuidad legal; no se funden las fusiones que crean un partido
nuevo, las absorciones, las escisiones ni las coaliciones de varios partidos cuyos diputados no se pueden separar. Las
124 decisiones discutibles se resolvieron el 19 de septiembre de 2026 con un criterio de eficacia para el análisis (cada
una lleva su `estado`): se aplicó la alternativa en 34 (la alianza va al partido que aporta casi todos sus diputados, como
UNES → Revolución Ciudadana; las coaliciones que formaron el mismo grupo, como CD y CP → PP o las confluencias → Unidas
Podemos; sucesores de la misma fuerza, como Amaiur → EH Bildu; y el nombre con que el partido aparece en el corpus, como
PTC en lugar de Agir), se mantuvo la decisión en 70 y 19 dependen de los datos de origen (partido por diputado y fecha) y
no se resuelven en la tabla.
`tools/partidos_parlaibero.py` valida las tablas, comprueba con `--csv` que cubren todas las etiquetas de los CSV,
descarga la fuente de cada cambio de nombre para confirmar su fecha (como con los hitos) y escribe el registro compacto
`datos/partidos_parlaibero.json`, que `build.py` incorpora a los datos del worker, y su informe
(`datos/partidos_parlaibero.informe.md`). Para corregir una decisión: editar la tabla del país, volver a ejecutar el
script y reensamblar; la base recordada se reconstruye sola porque el registro forma parte del `build_id`.

Estado del registro (19 de septiembre de 2026): 1.407 etiquetas de los 16 CSV, agrupadas en 743 partidos (Uruguay, de
73 a 12; España, de 133 a 53; Argentina, de 419 a 204 bloques). De las 294 fechas de cambios de nombre e inicios de
bloque, 251 aparecen completas en su fuente (el script lee también los PDF de la Cámara argentina) y 27 solo con el año;
15 inicios de bloques argentinos de 2017-2023 salen del conjunto de datos abiertos «Diputados» de la HCDN, cuya página no
muestra las fechas, y un cambio de Colombia no tiene fecha.

```bash
python3 explorer_src/tools/partidos_parlaibero.py --csv data
python3 explorer_src/build.py
```

## Expresiones de varias palabras

Al construir la base, una fase más («Detectando expresiones de varias palabras») busca en todo el corpus las secuencias
que funcionan como una unidad: «seguridad pública», «régimen de excepción», «Fuerzas y Cuerpos de Seguridad del Estado»,
«reforma tributaria». Se detectan con la estadística del corpus entero porque decidir que una secuencia es una unidad
exige muchas apariciones, que una biblioteca pequeña no tiene; luego cada biblioteca las reconoce en su texto. Motor en
`worker/34a_engine__expresiones.js`; quedan en la tabla `expresiones` de la base (forma plegada, forma con tildes,
apariciones, intervenciones, G², C-value) y el resumen en `meta.expresiones`.

1. **Candidatas**: de 2 a 7 tokens, con palabra de contenido en los extremos (≥ 3 letras, no vacía en Snowball, no cifra)
   y dentro solo palabras de contenido o conectores de una lista cerrada («de», «la», «y», «para»…). No cruzan la
   puntuación, los saltos de línea ni los huecos de 6 o más espacios (`keyness.crudos_tramos`: «Gracias, señor
   presidente. Buenas tardes» no es una expresión, y en las listas de asistencia y de votación, que son tablas, no se une
   el nombre con «presente» ni se encadenan las filas) ni las cifras, con dígitos o con letras: en las
   transcripciones las fechas, los artículos y los recuentos de votos se leen en voz alta («dos mil veintidós», «romano
   seis»), y en El Salvador eran el 7,5 % de las expresiones sin ser ninguna un concepto.
2. **Recuento**: sobre las intervenciones marcadas como discurso. Las filas sin orador (crónica, votaciones, actas en
   tercera persona) llenan el inventario de fórmulas y de filas de tablas: probado, en Argentina aparecían «aca aca aca» o
   «buenos aires afirmativo» entre las más frecuentes. La muestra y el umbral se calculan con el tamaño de ese texto, no
   con el del corpus entero; con el del corpus, la República Dominicana, que tiene el 81 % del texto en filas sin orador,
   muestreaba 1 de cada 4 intervenciones de un discurso de menos de 15 millones de palabras y perdía muchas expresiones.
   En textos de más de 30 millones de tokens, una muestra fija de 1 de cada M intervenciones (M ≈ tokens /
   20 millones) descubre las candidatas que se repiten, con un filtro de Bloom para las vistas una sola vez, y una
   segunda pasada las cuenta exactamente en todo el corpus; en los menores basta una pasada. Memoria acotada: tablas hash
   con los campos de cada hueco juntos y etiquetas de un byte, Bloom por bloques de una línea de caché.
3. **Selección**: frecuencia ≥ máx(20, 0,25 por millón de tokens) y al menos 3 intervenciones; no ser un trozo de una
   secuencia más larga (si casi siempre la precede o la sigue la misma palabra, la unidad es la secuencia larga: así caen
   las ventanas de las fórmulas leídas una y otra vez y «corte suprema» sin «de justicia»; la palabra mayoritaria de cada
   lado se estima en la misma pasada con el voto de Boyer y Moore); asociación positiva y significativa (G² ≥ 10,83) entre
   la parte izquierda y la última palabra; y frecuencia independiente ≥ F (la frecuencia menos la de su contenedor más
   frecuente: «unidos de américa» no se guarda aparte de «estados unidos de américa»).
4. **Léxico**: cada expresión presente en la biblioteca entra en el léxico con el mismo G², log-ratio e insignias que las
   palabras, marcada «expr.», frente a su frecuencia en el resto del corpus. Se cuentan todas sus apariciones, también
   dentro de otras más largas, y las palabras siguen contando dentro de ellas («seguridad» incluye «seguridad pública»).
   Así una expresión rara en el corpus se puede distinguir aunque la biblioteca sea pequeña: la decisión de que es una
   unidad ya está tomada con todo el corpus.
5. **Coocurrencias**: con la casilla «expresiones» (activa por defecto), cada frase se parte en el menor número de
   unidades, a igualdad las más largas, y cada expresión es un nodo: «seguridad pública» entra en la red como un término
   que se relaciona con otros, en lugar de como «seguridad» y «pública», que siempre van juntas y solo se unirían entre sí.

| corpus | tokens | expresiones | detección | construcción sin → con | medido en |
|---|---|---|---|---|---|
| El Salvador | 14,1 M | 19.410 | 4,6 s | 4,4 → 8,9 s | Chrome |
| España | 152,6 M | 92.430 | ≈ 60 s | 45 → ≈ 106 s | Node |
| Brasil | 207,5 M | 119.809 | 91 s | 83 → 174 s | Node |

La fase se paga al construir la base, no en cada sesión: la base se recuerda en el navegador (OPFS o IndexedDB, también
en el HTML autónomo) y se reabre con sus expresiones; solo vuelve a pagarse si cambia la versión de la aplicación o si el
navegador no deja guardarla. Límites conocidos: se pierden las pocas expresiones que llevan un número («Fome Zero»,
«três poderes», «dos tercios»); quedan fórmulas del género («publicado en el diario oficial número»), que el léxico no
marca como características salvo que una biblioteca abuse de ellas; y las entidades de más de 7 tokens solo entran por sus
partes. Lo que no deba unirse se desmarca en la revisión (abajo).

**Expresiones ya calculadas (edición web)**: la fase más lenta de la construcción no hace falta repetirla con los CSV
publicados. `tools/expresiones_precalculadas.py` construye en Node, con el motor de la aplicación, la base de cada CSV de
`data/` que sea idéntico al publicado en Dataverse (comprueba el MD5 con la API, solo metadatos) y guarda su tabla como
paquete comprimido en `datos/expresiones/<PAÍS>.json.gz`, con un índice (`indice.json`) que lleva la SHA-256 y el MD5 de
cada CSV, su DOI y versión, y la huella de cada tabla; `build.py` los copia a `docs/expresiones/`. Al construir la base
en la edición web, el worker (`web/expresiones_servidas.js`) consulta el índice: si hay una tabla de la misma versión de
la detección para un CSV de ese país y tamaño, adelanta la SHA-256 del archivo (que de todos modos se calcula después
de «listo») y, si coincide, carga la tabla en lugar de detectar; la barra de progreso lo anuncia desde el principio
(«Cargando las expresiones ya calculadas»). Con cualquier diferencia (otro CSV, otra versión, fallo de red) detecta como
siempre y el informe de construcción guarda el motivo. Probado en El Salvador y Paraguay (una pasada y muestra con
recuento exacto): la tabla cargada es idéntica a la detectada y la fase pasa de 5,2 a 0,6 s y de 18,4 a 1,5 s; en Brasil
o México, de unos 90 s a unos 8 (estimado: casi todo es releer el archivo para la SHA-256). El HTML autónomo no las lleva
y detecta siempre. Estado (19 de septiembre de 2026): los 16 países, 25,8 MB, de las versiones publicadas en Dataverse
(V2, salvo Perú, V1). La comprobación del MD5 evita generar tablas de archivos intermedios: la salida de estandarización
de Ecuador, por ejemplo, lleva dos sesiones de enero de 2026 que el paquete publicado excluye.

```bash
python3 explorer_src/tools/expresiones_precalculadas.py          # 4 construcciones a la vez; --paises BR,MX para algunos
python3 explorer_src/build.py
```

Hay que volver a generarlas cuando Dataverse publique una versión nueva de un conjunto o cuando cambie la detección
(`R2.expresiones.VERSION`): las tablas de otra versión no se usan.

**Revisión**: el enlace «revisarlas» de las notas del léxico y de las coocurrencias abre la lista completa, con búsqueda
(sin tildes ni mayúsculas), orden por frecuencia, asociación, longitud o alfabético, y exportación en CSV con la cita y los
parámetros de la detección. Las expresiones desmarcadas dejan de unirse: sus palabras vuelven a contar sueltas en el léxico
y en las coocurrencias, que se recalculan. La lista de desmarcadas se guarda en el navegador por corpus y se envía al motor
al abrirlo (rutas `GET /expressions` y `POST /expressions/rejected`, `worker/36c_engine__rutas_expresiones.js`); la base no
cambia, porque la base recordada se comprueba con la huella de sus páginas.

## Coocurrencias y temas

La pestaña «Coocurrencias» de una biblioteca construye la red de coocurrencias de sus términos característicos y
detecta en ella temas con el algoritmo de Leiden. Motor en `worker/35b_engine__coocurrencia.js`, ruta
`GET /collections/{cid}/cooccurrence` en `worker/36b_engine__rutas_coocurrencia.js`, Leiden en `worker/35a_engine__leiden.js`.

1. **Vocabulario**: los términos de sobreuso del léxico de la biblioteca (100, 250 o 500, de mayor a menor G²), también las
   expresiones de varias palabras, sin cifras (con dígitos o con letras) ni las palabras vacías publicadas de la lengua del corpus: Snowball (BSD), la lista conservadora que quanteda usa por
   defecto, en portugués para Brasil y Portugal y en español para el resto (`datos/palabras_vacias.json`, generado por
   `tools/palabras_vacias.py`). Se conservan «estado» y «estados», que Snowball incluye como formas de «estar». Se probó
   antes stopwords-iso y se descartó: trata como vacías palabras centrales del vocabulario político («estado», «poder»,
   «trabajo», «sistema», «general», «medio», «país») y en la biblioteca de El Salvador eliminaba quince de la red. El léxico se guarda en
   memoria por biblioteca y opciones, así que abrir las coocurrencias después del léxico no lo recalcula.
2. **Texto**: el mismo que analiza el léxico, con la misma segmentación del discurso y el mismo plegado.
3. **Unidad de contexto**: la intervención, o fragmentos consecutivos de 20 palabras; con las expresiones unidas, cada
   expresión cuenta como una palabra.
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

## Menciones a personas

La pestaña «Menciones» de una biblioteca reconoce a las personas nombradas en sus intervenciones y construye la red de
quién menciona a quién. Motor en `worker/45_engine__menciones.js`, ruta `GET /collections/{cid}/mentions` en
`worker/45b_engine__rutas_menciones.js` (prioridad de fondo: cede el hilo por trozos, así que las búsquedas y el lector
siguen respondiendo), interfaz en `page/22_menciones.js` y `page/23_menciones_red.js`, estilos en `css/style_06.css`.

Qué lee: las intervenciones de discurso de la biblioteca (`dm_speech = 1`) y, sin texto, **todas las de sus sesiones**,
que sitúan los turnos de la Mesa aunque la biblioteca guarde solo una parte; si pasan de 250.000 filas se usan solo las de
la biblioteca. También la lista de oradores del corpus (nombre, partido, sexo, legislatura y turnos de Gobierno), que sirve
para identificar y desempatar.

1. **Formas de tratamiento**, en `datos/menciones_parlaibero.json` (16 países, 282 KiB; lo genera
   `tools/menciones_parlaibero.cjs` a partir de `tools/menciones_formas.cjs` y `tools/menciones_nombres_pila.json`).
   Salen del sondeo de los propios corpus —qué palabras preceden a los apellidos de los miembros—: «señor diputado» en
   Argentina, «diputado señor» en Chile, «doctor» en Colombia, «don» en Costa Rica, «asambleísta» en Ecuador, «congresista»
   en Perú, «Sr. Deputado» en Portugal, «señor representante» en Uruguay. Cada forma es de miembro, de tratamiento, de
   gobierno, descriptiva o externa (un cargo que no ocupa quien tiene escaño: senador, gobernador, alcalde, juez).
2. **Identificación**: el nombre que sigue a la forma se casa con los oradores del corpus, con o sin tildes. En castellano
   se nombra por el primer apellido y, si es de los diez más comunes, por los dos; en portugués, también por el nombre de
   pila. Los apellidos compartidos se desempatan por el sexo del tratamiento, por quien preside la sesión, por el cargo en
   el Gobierno de esa legislatura, por la actividad en el corpus y, al final, por cómo llama la biblioteca a cada uno. El
   apellido suelto solo cuenta si la biblioteca lo usa con tratamiento al menos tres veces.
3. **Personas externas**: con su cargo («ministro X», «senador Y») o, ya identificadas por el cargo, por su nombre solo.
   Los jefes de Estado y de Gobierno salen de las tablas del registro (178 mandatos, fechas contrastadas con Wikidata):
   el nodo externo vale **desde el inicio de su mandato**; antes, si tuvieron escaño, es su nodo de miembro.
4. **Qué no cuenta**: los turnos de quien preside y de la Mesa (secretarios, relatores; en Guatemala y El Salvador la
   presidencia se infiere de quién tiene al menos la cuarta parte de los turnos, y cortos), el protocolo dirigido a la
   Presidencia, las fórmulas de dar la palabra, las lecturas de dictámenes, las automenciones, las acotaciones entre
   paréntesis, las listas de asistencia y de votación, los usos genéricos del cargo y los cargos subnacionales. Las
   menciones de la Mesa sí sirven como prueba de cómo se llama a cada persona.
5. **Red y focos**: aristas dirigidas de quien habla a quien nombra; los focos son comunidades de Leiden sobre la red sin
   dirección (resolución 0,6, 1 o 1,6, semilla fija), con la modularidad y la información mutua normalizada con los
   partidos. No son coaliciones: un foco reúne a quienes hablan de las mismas personas, a favor o en contra.

La vista de la red combina una agrupación (sectores por partido o por foco), un sentido (todas las menciones, las hechas
o las recibidas), un filtro de conexiones de dos o más menciones y un modo ego que la rehace alrededor de una persona.
Los anillos son cuantiles de la medida del sentido elegido, sin partir empates.

Precisión medida a mano en tres rondas sobre muestras de los 16 países (siete categorías por país): alrededor de nueve de
cada diez menciones señalan a la persona correcta. El recuerdo no está medido: faltan las referencias indirectas («su
señoría», «el relator», «el orador que me ha precedido»). El error que más queda es el cargo usado en abstracto («el
presidente de la República» en una norma) y las lecturas de la Secretaría atribuidas a un diputado, sobre todo en Guatemala.

Exportaciones: una fila por mención en CSV (quién habla, a quién menciona, cómo, la fecha y las palabras con las que la
nombra) y la red dirigida en GEXF para Gephi, las dos con los parámetros y la cita del conjunto de datos.

| biblioteca | intervenciones | menciones | tiempo |
|---|---|---|---|
| España, «constitución» 1977-1979 | 2.083 (2.006 con discurso) | 3.431 | 16 s |
| España, 1.500 intervenciones seguidas | 1.500 | 335 | 0,7 s |

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

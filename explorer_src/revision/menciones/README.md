# Revisión a mano del detector de menciones

Estas son las pruebas de la cifra de precisión que cita el `README.md` del explorador para la pestaña «Menciones»
(motor en `worker/45_engine__menciones.js`). Se revisaron a mano tres muestras de los dieciséis parlamentos, una por
versión del detector, mientras se afinaban las reglas; cada carpeta guarda, por país, el informe (`XX.md`) y el detalle
de cada mención juzgada (`XX.json`).

No son datos de la aplicación: `build.py` no mira esta carpeta.

## Las tres rondas

| carpeta | versión juzgada | muestra | semilla | juzgadas |
|---|---|---|---|---|
| `ronda1_v5/` | v5 | hasta 10 menciones por categoría y país | 7 | 720 |
| `ronda2_v6/` | v6.0 | hasta 8 por categoría y país | 23 | 752 |
| `ronda3_v6_2/` | v6.2 | hasta 8 por categoría y país | 31 | 673 |

Las categorías de la muestra son las vías por las que el detector llega a cada mención: miembro con tratamiento o cargo,
miembro por apellido suelto, miembro por cargo sin nombre, persona externa con cargo o título, persona externa que fue
orador sin escaño, persona externa por apellido suelto y persona externa por cargo sin nombre (la primera ronda, con la
v5, tenía siete categorías equivalentes). Se toman al azar con semilla fija, así que la muestra se reproduce.

Cada mención se revisó con la intervención entera, los turnos vecinos de la sesión y la lista de oradores del corpus:
escaño en la legislatura de esa fecha, homónimos, sexo del tratamiento y quién interviene en el debate. Los cargos y
escaños que no se deducían del corpus se comprobaron en fuentes externas, citadas en el motivo de cada caso. El
veredicto es sobre la **identidad**: si la mención señala a la persona correcta. A partir de la segunda ronda cada caso
lleva además `no_deberia_contar`, para las menciones bien identificadas que el criterio deja fuera de la red (las de la
Mesa, el protocolo dirigido a la Presidencia, las lecturas de dictamen).

## Resultados

Correctas sobre juzgadas, sin contar las dudosas:

| país | ronda 1 (v5) | ronda 2 (v6.0) | ronda 3 (v6.2) |
|---|---|---|---|
| AR | 27/50 (54 %) | 39/53 (74 %) | 29/41 (71 %) |
| BR | 33/34 (97 %) | 37/41 (90 %) | 31/33 (94 %) |
| CL | 34/40 (85 %) | 40/43 (93 %) | 35/40 (88 %) |
| CO | 31/50 (62 %) | 43/48 (90 %) | 33/39 (85 %) |
| CR | 24/50 (48 %) | 42/51 (82 %) | 41/43 (95 %) |
| DO | 19/42 (45 %) | 31/42 (74 %) | 31/35 (89 %) |
| EC | 26/50 (52 %) | 42/53 (79 %) | 42/46 (91 %) |
| ES | 50/56 (89 %) | 47/53 (89 %) | 44/52 (85 %) |
| GT | 28/30 (93 %) | 34/36 (94 %) | 36/40 (90 %) |
| MX | 32/50 (64 %) | 43/55 (78 %) | 38/48 (79 %) |
| PA | 31/40 (78 %) | 45/48 (94 %) | 34/40 (85 %) |
| PE | 34/47 (72 %) | 43/44 (98 %) | 43/48 (90 %) |
| PT | 29/41 (71 %) | 44/47 (94 %) | 41/46 (89 %) |
| PY | 31/45 (69 %) | 43/48 (90 %) | 32/40 (80 %) |
| SV | 35/44 (80 %) | 38/40 (95 %) | 39/40 (98 %) |
| UY | 36/50 (72 %) | 42/48 (88 %) | 38/40 (95 %) |
| **total** | **500/719 (69,5 %)** | **653/750 (87,1 %)** | **587/671 (87,5 %)** |

Y, de esas correctas, las que además deben contar en la red: 491 de 750 en la segunda ronda (65,5 %) y 447 de 671 en la
tercera (66,6 %). La diferencia son, sobre todo, menciones de la Mesa que entonces contaban y que el criterio actual
excluye.

Con ocho casos por categoría cada error mueve doce puntos y medio, así que las cifras por categoría de los informes son
orientativas; cada informe da también el intervalo de Wilson y una estimación ponderada por el tamaño de cada categoría
en la salida del detector. Los informes explican además, caso por caso, la causa de cada error y la regla que lo
corregiría: de ahí salieron las versiones 6.1 a 6.5.

## Reevaluación (`reevaluacion/`)

Las muestras se juzgaron contra versiones anteriores, así que para saber qué queda en pie con la versión en curso hay
que casar cada mención juzgada con la salida nueva **por su posición en el texto**, no por las palabras de la mención
(«Carlos» y «Carlos Smith» en el mismo sitio son la misma mención). Cada mención juzgada queda entonces igual, cambia
de persona o desaparece.

- `rescore_detalle.txt` y `rescore1b_detalle.txt`: la primera ronda contra la salida en curso (la segunda pasada añade
  la marca de los turnos de la Mesa).
- `rescore1b.json`: el recuento de esa comparación por país, cruzando el veredicto con lo que pasó.
- `rescore2_detalle.txt` y `rescore3_detalle.txt`: lo mismo para la segunda y la tercera ronda.

La estimación de la versión final sale de `guiones/estimar3.cjs` sobre la muestra de la tercera ronda: las menciones que
siguen igual conservan su veredicto, las que desaparecen salen de la cuenta y las que cambian se juzgaron a mano. Da
alrededor de nueve de cada diez en identidad. **Es optimista**: las reglas de las versiones 6.3 a 6.5 se afinaron
mirando los errores de esa misma muestra, así que la cifra no es independiente. Una medida limpia pediría una muestra
nueva.

## Guiones (`guiones/`)

- `muestra_precision.cjs`, `muestra_precision6.cjs`, `muestra_precision7.cjs`: sacan la muestra de cada ronda.
- `precision.cjs`: precisión por país a partir de las revisiones, bruta y ponderada por el tamaño de cada categoría, y
  la «útil» (correcta y que además debe contar).
- `rescore*.cjs` y `estimar3.cjs`: las reevaluaciones descritas arriba.

Van tal como se ejecutaron, así que nombran las carpetas de las rondas como estaban entonces: `revision` es `ronda1_v5`,
`revision6` es `ronda2_v6` y `revision7` es `ronda3_v6_2`.

Los guiones esperan la salida del detector por país y los volcados de trabajo del prototipo (`paises/XX/menciones*.json`,
`biblioteca.json`, `oradores.json`, `mesa/XX.json`), que no están en el repositorio porque ocupan cientos de megabytes.
Se regeneran con el motor sobre los CSV de ParlaIbero en Dataverse. Lo que sí queda aquí, y es lo que importa, son los
veredictos: `XX.json` guarda de cada mención juzgada la fecha, quién habla, a quién se atribuyó, el texto de la mención,
el veredicto y el motivo, con las fuentes consultadas.

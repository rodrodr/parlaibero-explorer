# Precisión de las menciones, versión 6: Argentina (Cámara de Diputados de la Nación)

Muestra: `node muestra_precision6.cjs paises/AR 8 23` sobre `paises/AR/menciones6.json`, hasta 8 menciones por categoría. La categoría de antiguos oradores sin escaño en la biblioteca solo tiene 5 menciones en toda la salida, así que se juzgaron 53. Cada mención se leyó con su intervención completa en `biblioteca.json` y las filas de alrededor, y se comprobaron en `oradores.json` el escaño en la legislatura y los homónimos. Las fuentes consultadas están en el motivo de cada caso. El detalle está en `revision6/AR.json`. Los números entre paréntesis remiten a ese archivo, y las líneas, a `detectar6.cjs`.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | No deberían contar |
|---|---:|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 984 | 8 | 7 | 1 | 0 | 88 % | 0 |
| Miembro, apellido suelto | 79 | 8 | 8 | 0 | 0 | 100 % | 8 |
| Miembro, cargo sin nombre (por fecha) | 10 | 8 | 8 | 0 | 0 | 100 % | 0 |
| Externa, con cargo o título | 4.355 | 8 | 7 | 1 | 0 | 88 % | 4 |
| Externa, antiguo orador sin escaño | 5 | 5 | 1 | 4 | 0 | 20 % | 0 |
| Externa, apellido suelto | 1.499 | 8 | 6 | 2 | 0 | 75 % | 0 |
| Externa, cargo sin nombre (por fecha) | 83 | 8 | 2 | 6 | 0 | 25 % | 2 |
| **Total** | 7.015 | 53 | **39** | 14 | 0 | **74 %** | 14 |

No hay dudosas. La precisión es correctas / (correctas + incorrectas). La columna «No deberían contar» no cambia el veredicto: son menciones bien o mal identificadas que no deberían estar en la salida (se explican más abajo).

- El n.º 40 (Macri) cuenta como incorrecto porque va a un nodo distinto del que pide la regla de antiguo miembro de la versión 6. Juzgado solo por la identidad, la categoría daría 7 de 8 y el total, 40 de 53 (75 %).
- El total no está ponderado por el tamaño de cada categoría, y con 8 casos por categoría el margen es amplio. Cuatro recuentos sobre la salida completa cambian la lectura de la muestra:
  - 5.996 de las 7.167 menciones (84 %) salen de la sesión especial del 25 de septiembre de 1985: el informe, las audiencias y los documentos de la comisión investigadora de la compra de la Italo.
  - De las 984 menciones de miembro con tratamiento, 341 (35 %) son «Martínez de Hoz» atribuido a un diputado: 339 a Martínez Márquez y 2 a Martínez Llano (patrón 3). La precisión de esa categoría no puede pasar del 65 %, aunque la muestra dé 88 %.
  - De las 83 menciones externas por cargo sin nombre, las 57 de la sesión de 1985 van a Alfonsín y ninguna es él: hablan de Videla, de Isabel Perón o del cargo en abstracto. Con la del articulado de 1989 son al menos 58 de 83, así que la categoría queda en torno al 30 %.
  - De las 79 menciones de miembro por apellido suelto, 52 son listas o firmas (asistencia, votaciones nominales, juramentos, nóminas de comisiones, firmas de proyectos y de escritos judiciales). Otras 3 están mal: «Aramburu» es Pedro Eugenio Aramburu, presidente de facto entre 1955 y 1958 (https://es.wikipedia.org/wiki/Pedro_Eugenio_Aramburu), y se atribuye al diputado José Aramburu (patrón 7).

## Errores que quedan, por causa

### 1. Cargos sin nombre fechados por la sesión cuando el texto habla de otra época (6 errores: 46 a 50 y 53)

La sesión de 1985 trata de la compra de la Italo en 1978 y 1979. «El presidente de la República» y «el presidente de la Nación» se atribuyen por la fecha de la sesión, es decir, a Alfonsín. Pero en 46, 47, 48 y 50 son Videla (presidente de facto del 29-3-1976 al 29-3-1981, https://es.wikipedia.org/wiki/Jorge_Rafael_Videla), y en 53, Isabel Perón. A veces el propio texto lo dice: «el presidente de la Nación, general Videla», «el presidente de la República, la señora de Perón». La 49 es el artículo 34 del proyecto de presupuesto de 1989 («remuneraciones del presidente de la Nación, vicepresidente de la Nación y ministros»): el cargo en abstracto, no Menem.

La comprobación de la l. 554 solo salta el cargo si detrás viene una mayúscula o «señor», «señora», «don» o «doña», así que no ve «, la señora de Perón» ni «, general Videla». Y solo mira las palabras de delante («ex», «entonces», «era»…), no el año del que se habla.

Reglas que lo evitarían:
- En la l. 554, saltar el cargo cuando detrás viene una aposición con cualquier forma: `^\s*,?\s*(?:(?:el|la|al)\s+)?(?:FORMA\s+){0,2}\p{Lu}`. Evita también el duplicado del n.º 52 («del presidente de la República, doctor Alfonsín»), que se repite 3 veces en la salida.
- Fechar por el texto: si el párrafo, o en las filas cortas de preguntas y respuestas las tres filas anteriores, nombra un año anterior al comienzo del mandato del jefe de ese día, atribuir el cargo al jefe de ese año o no atribuirlo. Para eso la tabla de AR tiene que empezar antes de 1982, porque el anexo habla de 1956 a 1979 (Isabel Perón, Videla, Viola, Galtieri).
- No atribuir tras «de la época», «de entonces» o «en ese momento», ni dentro de un articulado (párrafo que empieza por «Art. N»).

### 2. Orador homónimo posterior tomado como persona externa (4 errores: 33 a 36)

El síndico de la Italo es Alfredo Manuel Pablo Galland (así lo nombra el informe), y en el n.º 35 el testigo habla de su padre. Los cuatro van a la clave «gustavo carlos galland», la de un diputado del FREPASO que solo interviene en la leg. 119 (2001). La rama de la l. 440 (`esc === null && r.s >= 2`) da a cualquier orador sin escaño en la biblioteca su nombre completo, aunque su actividad sea dieciséis años posterior. La versión 6 solo exige la fecha a quien tiene escaño después (l. 439). Son 4 de las 5 menciones de la categoría.

Además, en el corpus las filas del testigo «Sr. Galland» llevan el id AR00899 del diputado de 2001, de modo que sus propias palabras cuentan como de él.

Regla que lo evitaría: en la l. 440, exigir que el orador tenga actividad (`desde` en `oradores.json`) anterior a la fecha de la mención o que el nombre sea completo (`r.s === 3`). Si no, persona externa con la clave del apellido. Fuera del detector, quitar el id AR00899 a las filas del testigo.

### 3. Apellido compuesto tomado por apellido de casada (1 error en la muestra, 341 en la salida)

N.º 7: «el señor Martínez de Hoz». «martinez hoz» no es de ningún orador, así que la regla del apellido de casada (l. 409-413) quita «de Hoz» y prueba con «Martínez». Hay varios Martínez con escaño en la leg. 103, y `desempatar` (l. 256) elige a Martínez Márquez porque preside sesiones de 1987, aunque no habla ni preside en esta. Así, las 339 menciones de «doctor» o «señor Martínez de Hoz» del anexo van a un diputado radical. La misma persona queda repartida en tres nodos: el diputado, «jose alfredo martinez hoz» (cuando lleva el nombre de pila) y «martinez hoz zubaran» (cuando lleva «ministro», 32 menciones), que sigue fundiéndolo con Zubarán.

Reglas que lo evitarían:
- Aplicar la regla del apellido de casada solo con una forma femenina («señora», «doña», «diputada», «doctora») o si el candidato es una mujer.
- Con un tratamiento genérico («señor», «doctor») y un apellido de `comunes` o `TOP10`, no desempatar por «preside» ni por «actividad». Y limitar el desempate por «preside» (l. 256) a quien preside esa sesión o sesiones de esa legislatura.
- Añadir a José Alfredo Martínez de Hoz a los `historicos` de AR.

### 4. Diputado que falta en oradores.json y cuyo apellido empieza por un cargo (1 error: 29)

Juez Pérez vota en esa votación nominal y habla en la misma sesión («Sr. Juez Pérez», con `id_dep` vacío), pero no está en `oradores.json`. «Juez» se toma por la forma externa «juez» (l. 391), y la clave de una palabra «perez» se une a la única clave larga que termina así (l. 618): «eduardo perez», el vendedor de un inmueble en una escritura de 1928. De las 8 menciones de ese nodo, 7 son el diputado.

Reglas que lo evitarían: no tomar «Juez» como forma cuando va con mayúscula en medio de una lista de apellidos, o cuando la sesión tiene la etiqueta «Sr. Juez Pérez»; y no unir a una clave más larga las claves de una palabra que están en `comunes` o `TOP10` (l. 618). Fuera del detector, dar de alta a Juez Pérez en `oradores.json` (habla el 27-5-1987 y el 29-3-1989).

### 5. Un antiguo miembro partido en dos nodos (1 error: 40)

«Macri», en diciembre de 2018, va al nodo externo «mauricio macri», mientras que «el presidente de la Nación» de la misma sesión va al nodo de miembro MAURICIO MACRI, como antiguo miembro (leg. 123). Las ramas de jefe de Estado con nombre (l. 368) y de apellido suelto de un jefe (l. 721 y 756) siempre crean la persona externa; solo la de cargos sin nombre (l. 559) mira si tuvo escaño. En la salida, Macri tiene 9 menciones como miembro y 59 como persona externa.

Regla que lo evitaría: en las tres ramas, si el jefe se resuelve con su nombre completo a un miembro con `escanoEnBiblioteca(d, leg) === 'antes'`, usar el nodo de miembro con la marca de antiguo miembro.

### 6. Apellido que nombra un grupo empresario (1 error: 43)

«¿Me Kee es empresa del grupo Soldati?»: se habla del grupo, no de una persona. Las palabras que delante de un nombre lo convierten en institución (`INST_PEGADO`, l. 467) solo cuentan con mayúscula, y «grupo» no está.

Regla que lo evitaría: añadir «grupo» y «firma», también en minúscula, a las palabras que anulan un apellido suelto (`INST_SUELTO`, l. 683).

### 7. Homónimo histórico de un miembro por apellido suelto (fuera de la muestra: 3 casos)

«el presidente provisional Aramburu» (1957), «la época de Aramburu» y «el gobierno de Aramburu» van al diputado José Aramburu. `TITULO_ANTES` (l. 679) solo acepta palabras con mayúscula entre la forma y el apellido, así que «presidente provisional» no lo frena.

Reglas que lo evitarían: aceptar en `TITULO_ANTES` palabras en minúscula entre la forma y el apellido, y añadir a Pedro Eugenio Aramburu a los `historicos` de AR.

## Menciones que no deberían contar (14 de 53)

- Listas en la búsqueda de apellidos sueltos (9 a 16: las ocho de la categoría). Son asistencia («Fellner, presente»), votaciones nominales («Votan por la negativa los señores diputados: …»), un juramento, nóminas que lee la Secretaría y la firma de una resolución («Eduardo A. Fellner.»). El filtro de «presente», «ausente» y votos de la l. 503 está en `procesar`, pero no en `probar` (l. 707), que es donde se buscan los apellidos sueltos. En la salida son 52 de las 79 menciones de esta categoría. Reglas: aplicar en `probar` el mismo filtro de la l. 503; saltar el bloque que va de «Votan por la afirmativa» o «por la negativa los señores diputados:» al final del párrafo; tratar como firma el nombre seguido o precedido de «. —» o «. –», y el que cierra una resolución tras «Comuníquese»; añadir «puestos de pie» y «juran» a las acotaciones (l. 171).
- Votación nominal con un nombre tras cargo (29): la misma regla del bloque de votación.
- Turno de la Presidencia no reconocido (49). La etiqueta «Sr. P r e s i d e n t e ( P i c r r i )» tiene las letras separadas por el OCR, y `esPresidenciaEtiqueta` (l. 112) no la reconoce. Regla: normalizar la etiqueta quitando los espacios entre letras sueltas antes de aplicar `RX_MESA`.
- Duplicado por aposición (52): se evita con la regla de la l. 554 del patrón 1.
- Documentos insertos (26, 27, 31): dos escrituras de inmuebles (1928 y 1962) metidas en la intervención de Tello Rosas y el título de una carta en la relación documental del informe. No hay una regla sencilla. Al menos podrían marcarse aparte las menciones de párrafos con forma de escritura («LE CORRESPONDE por compra a…», líneas que empiezan con comillas) y las de filas de la Secretaría sin orador, para poder filtrarlas en la pestaña.

## Otras observaciones que no se cuentan como error

- Siete de las ocho menciones de miembro por apellido suelto salen marcadas «se dirige», porque el nombre va entre comas en una lista (`vocativoDe`, l. 344).
- Claves con un lugar pegado: «fritz funk buenos aires» (27) y «rodriguez varela buenos aires» (33 menciones), que salen de cabeceras de cartas. El corte por lugar de la l. 527 solo actúa tras una partícula.
- Nodos duplicados de una misma persona externa: «javier milei» y «javier gerardo milei» (37); «alejandro caride» (424 menciones) y «alejandro roberto caride» (170); «kurlat» e «italo arturo kurlat»; «beccar varela» y «horacio beccar varela»; «conrado sadi massue» y «sadi conrado massue». En cambio, «francisco soldati» junta a Soldati padre y a F. P. Soldati (h.).
- Fuera del detector: Juez Pérez no tiene id ni entrada en `oradores.json`, y las filas del testigo Galland llevan el id de otra persona (patrones 2 y 4).

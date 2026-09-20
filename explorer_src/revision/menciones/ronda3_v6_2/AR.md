# Precisión de las menciones, versión 6.2: Argentina (Cámara de Diputados de la Nación)

Muestra: `node muestra_precision7.cjs paises/AR 8 31` sobre `paises/AR/menciones6_2.json`, hasta 8 menciones por categoría. La salida no tiene miembros por cargo sin nombre y tiene una sola mención de antiguo orador sin escaño en la biblioteca, así que se juzgaron 41. Cada mención se leyó con su intervención completa en `biblioteca.json` y las filas de alrededor, y se comprobaron en `oradores.json` el escaño en la legislatura y los homónimos. Las fuentes consultadas están en el motivo de cada caso. El detalle está en `revision7/AR.json`. Los números entre paréntesis remiten a ese archivo, y las líneas, a `detectar6_2.cjs`.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | No deberían contar |
|---|---:|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 664 | 8 | 7 | 1 | 0 | 88 % | 0 |
| Miembro, apellido suelto | 80 | 8 | 6 | 2 | 0 | 75 % | 2 |
| Miembro, cargo sin nombre (por fecha) | 0 | 0 | – | – | – | – | – |
| Externa, con cargo o título | 4.167 | 8 | 7 | 1 | 0 | 88 % | 1 |
| Externa, antiguo orador sin escaño | 1 | 1 | 1 | 0 | 0 | 100 % | 0 |
| Externa, apellido suelto | 1.261 | 8 | 4 | 4 | 0 | 50 % | 0 |
| Externa, cargo sin nombre (por fecha) | 82 | 8 | 4 | 4 | 0 | 50 % | 0 |
| **Total** | 6.255 | 41 | **29** | 12 | 0 | **71 %** | 3 |

No hay dudosas. La precisión es correctas / (correctas + incorrectas). La columna «No deberían contar» no cambia el veredicto: son menciones que no deberían estar en la salida aunque la persona sea la correcta (se explican más abajo).

- Los n.º 28 y 33 («el contrato Caride», «la operación Caride») cuentan como incorrectos porque nombran un contrato y una operación, igual que el nombre de una ley. Si se aceptaran como menciones de Caride, la categoría daría 6 de 8 y el total, 31 de 41 (76 %).
- El total no está ponderado por el tamaño de cada categoría, y con 8 casos por categoría el margen es amplio. La sesión del 25 de septiembre de 1985 (investigación de la compra de la Italo: audiencias, informe y anexo documental) da 5.159 de las 6.265 menciones resueltas o externas (82 %) y 22 de las 41 de la muestra. Cuatro recuentos sobre la salida completa matizan la muestra:
  - Externa por cargo sin nombre: 47 de las 82 son de la sesión de 1985 y ninguna es Alfonsín. Hablan del presidente de facto de 1976-1981, a veces con su nombre («le pedí al presidente de la Nación, general Videla, que me excusara»), o del cargo en abstracto. Si se resta además el cargo en abstracto del n.º 41, quedan 34 correctas de 82 (41 %), y tres de ellas son duplicados por aposición («el señor presidente de la Nación, doctor Alfonsín»).
  - Miembro con tratamiento: al menos 46 de las 664 (7 %) son de otra persona, casi todas de 1985. Son 26 con grado militar o «escribano» (6 «general Aramburu»; 7 «brigadier Gómez», el ministro de Justicia del gobierno militar, que van a la diputada María Florentina Gómez Miranda; 4 «coronel Ibáñez»; 4 «capitán Suárez», que el informe llama «capitán de navío Jorge H. Suárez (Director de CIAE)»; «general Camps»; «comodoro Martínez»; 3 «escribano Vicente» de escrituras de 1917 a 1928), 13 «doctor Guido» o «presidente Guido» (José María Guido, presidente del 29-3-1962 al 12-10-1963, https://es.wikipedia.org/wiki/José_María_Guido) que van a Leopoldo Raúl Guido Moreau, 4 «ministro Caputo» de 2025 (Luis Caputo, ministro de Economía desde el 10-12-2023, https://es.wikipedia.org/wiki/Luis_Caputo) que van a Dante Caputo como antiguo miembro, «don Federico Pinedo», el ministro de Hacienda de los años treinta (https://es.wikipedia.org/wiki/Federico_Pinedo_(1895-1971)), que va como «aún sin escaño» al diputado del mismo nombre, «Don Manuel Aguirre», de una escritura, y el n.º 5.
  - Miembro por apellido suelto: 35 de las 80 son firmas o listas (dictámenes, escritos judiciales de la comisión, nóminas de firmantes) y otra es la etiqueta de un orador dentro de una fila de la Presidencia. Las de identidad equivocada son 4: los n.º 10 y 15, otro «gobierno de Aramburu» y «Parroquia de Monserrat», que va a Miguel Pedro Monserrat.
  - Externa por apellido suelto: los epónimos y grupos son 56 de 1.261 (4 %): «informe Bronstein» 19, «operación Caride» 7, «grupo Soldati» 7, «estudio Klein» 6, «negociación Caride» 4, «informe Santángelo» 3, «estudio Beccar Varela» 3, «contrato Caride» 2, «informe Folcini» 2, «grupo Caride», «acuerdo Caride» y «de los Soldati». La muestra, con 4 de 8, exagera esta causa.

## Errores que quedan, por causa

### 1. Cargo sin nombre fechado por la sesión cuando se habla de otra época o del cargo en abstracto (4 errores: 34, 37, 40 y 41)

En la sesión de 1985 declaran Martínez de Hoz, Caride y otros funcionarios y asesores del gobierno militar sobre hechos de 1976 a 1981. «El presidente de la República» se atribuye por la fecha de la sesión a Alfonsín, pero en 34, 37 y 40 es Videla (29-3-1976 a 29-3-1981, https://es.wikipedia.org/wiki/Jorge_Rafael_Videla): el nombramiento de Bronstein en 1976, las instrucciones al negociador en 1977-1978 y un memorándum de 1979. La comprobación de años de la versión 6.2 (l. 747-750) solo mira la oración de la mención, y en las audiencias el año está en otra fila (40: «Para la segunda mitad del 79», en la respuesta siguiente) o no está (34 y 37: lo dan quién habla y de qué época). El 41 usa el cargo en abstracto: la Capital «es gobernada por el presidente de la República y este Congreso, sus autoridades naturales según la Constitución».

Reglas que lo evitarían:
- No atribuir cargos sin nombre por fecha en las sesiones de comparecencias. En la de 1985, 6.987 de las 13.309 filas son de oradores sin id que no son de la Mesa (testigos y asesores de la comisión); en las demás sesiones de AR y UY no pasan del 30 %. Con un umbral de la mitad se descartan las 47 de 1985 sin tocar ninguna otra.
- Ampliar la ventana de años de la l. 750 al párrafo y, en filas cortas de preguntas y respuestas, a las tres filas anteriores y siguientes de la sesión. Para atribuir al jefe de ese año, y no solo descartar, la tabla `jefes` de AR tiene que empezar antes de 1982: Videla, Viola y Galtieri solo están en `historicos`.
- En la l. 739, aceptar tras la coma cualquier forma («, general Videla», «, el general Videla», «, doctor Alfonsín»). Evita dos atribuciones a Alfonsín de frases que nombran a Videla y los tres duplicados.
- Tratar como abstracto el cargo coordinado con otra institución («y este Congreso», «y el Poder Judicial») o seguido de «según la Constitución» (l. 743-744).

### 2. Apellido de un miembro que en el texto es otra persona (3 errores: 5, 10 y 15; fuera de la muestra, al menos 46 más)

- 5: «con la presencia del señor Martínez» es Martínez de Hoz, el testigo al que Tello Rosas está interrogando («Sr. Martínez de Hoz» en las filas de alrededor). Hay tres Martínez con escaño en la leg. 103, y `desempatar` elige a Martínez Márquez por «preside» (l. 373), aunque solo preside sesiones de 1987 y no habla ni preside en esta.
- 10: «Buenos Aires fue fundada primero por Mendoza y vuelta a fundar luego por Garay» es Juan de Garay (1580, https://es.wikipedia.org/wiki/Juan_de_Garay). El diputado Nicolás Alfredo Garay tiene escaño en la leg. 105, su apellido es de miembro y nada lo frena.
- 15: «la época de Aramburu», con las intervenciones de 1956 y 1957, es Pedro Eugenio Aramburu (https://es.wikipedia.org/wiki/Pedro_Eugenio_Aramburu). La revisión de la versión 6 ya lo señalaba y la 6.2 no lo añadió a los `historicos`.

Fuera de la muestra, la misma causa entra por otras ramas (recuento en la sección de precisión): los grados militares (l. 551 manda al miembro si tiene escaño y la fuerza es 2, sin mirar el sexo: «brigadier Gómez» va a una diputada), «doctor Guido» (el reparto por defecto de la l. 107 toma «Guido Moreau» como apellidos, aunque «Guido» es nombre de pila y el diputado aparece como «diputado Moreau») y «ministro Caputo» (la rama del exdiputado que ahora es ministro, l. 531-534, acepta a Dante Caputo, que solo tiene intervenciones en la leg. 107).

Reglas que lo evitarían:
- En `desempatar` (l. 373), contar «preside» solo si el candidato preside esa sesión o sesiones de esa legislatura. Y si en la sesión habla alguien sin escaño cuya etiqueta termina en ese apellido («Sr. Martínez de Hoz»), preferir esa persona externa.
- Para el apellido suelto de un miembro (l. 985-1001), exigir que el miembro hable, presida o se le nombre con tratamiento en esa sesión. En AR, de las 22 menciones sueltas cuyo miembro no interviene en la sesión, 11 son firmas y 3 son los errores de Aramburu y Garay; se perderían 7 correctas (cuatro de Cafiero, ministro de Economía en 1975-1976 y diputado de 1985 a 1987, https://es.wikipedia.org/wiki/Antonio_Cafiero; «los señores diputados Di Caprio y Córtese»; dos «dipu tado Laspina», en los que el OCR parte la forma) y queda una que no se ha comprobado (Lescano). Además, añadir a Pedro Eugenio Aramburu y a Juan de Garay a los `historicos` de AR.
- Con un grado militar y un apellido solo (l. 551), no mandar al miembro salvo que hable o presida en la sesión, y nunca a una miembro.
- En el reparto por defecto de nombre y apellidos (l. 107), no empezar el apellido por una palabra que es nombre de pila (`esPila`) si la última palabra sola aparece tras una forma («diputado Moreau»).
- En la rama del exdiputado ministro (l. 531-534), con el apellido solo, exigir que el candidato haya tenido cargo en el Gobierno (`gob` > 0) o actividad cercana a la fecha.

### 3. Apellido que nombra una cosa o un grupo: epónimos, estudios, familias (4 errores: 26, 28, 30 y 33)

- 26: «una empresa de los Soldati» es la familia. El filtro de «los» + apellido (l. 939-940) tiene una excepción para «Pérez de los Cobos» que deja pasar cualquier «de los Soldati».
- 28 y 33: «el contrato Caride» y «la operación Caride» nombran el contrato y la compra que negoció Caride.
- 30: «el estudio Klein & Mairal» es el estudio jurídico.

`INST_SUELTO` (l. 899) y las palabras de institución (l. 606-615) no tienen «informe», «operación», «negociación», «contrato», «acuerdo», «estudio» ni «grupo», y las que se usan también con personas solo cuentan con mayúscula.

Reglas que lo evitarían: anular el apellido suelto cuando lo precede, en minúscula, uno de esos sustantivos (más «empresa», «firma» y «plan»), y limitar la excepción de la l. 940 a «de los» precedido de una palabra con mayúscula («Pérez de los Cobos»). En la salida completa recogería las 56 menciones del recuento.

### 4. Clave que no identifica a la persona (1 error: 21)

«LE CORRESPONDE por compra a Don José Agustín "Pacheco y Anchorena» es una escritura de 1913 copiada con comillas al comienzo de cada línea. La comilla corta el nombre y la clave queda en «jose agustin», el nombre de pila solo. El apellido suelto «Anchorena» de la misma línea va, además, a otra persona («joaquin anchorena»).

Reglas que lo evitarían: admitir una comilla sin cerrar entre las palabras de un nombre (`NOMBRE`, l. 226) en los párrafos con forma de escritura («LE CORRESPONDE», «según escritura»), y no crear una persona externa cuya clave sea solo de nombres de pila.

## Menciones que no deberían contar (3 de 41)

- Firma de un dictamen de comisión (12). Está en una fila con la etiqueta «Sr. P r e s i d e n t e (Vanossi)»: el OCR separa las letras y `esPresidenciaEtiqueta` (l. 152) no la reconoce como turno de la Presidencia. La revisión de la versión 6 ya lo señalaba. Regla: normalizar la etiqueta uniendo las letras sueltas antes de aplicar `RX_MESA`.
- Nómina de firmantes de un escrito judicial de la comisión (14), dentro de la fila AR003002811893 (451.306 caracteres, etiqueta «Sr. Alejandro», sin orador), que contiene el anexo documental de la comisión.
- Escritura de 1913 inserta en la intervención de Tello Rosas (21), que se le cuenta como mención suya.

En la salida completa, 35 de las 80 menciones de miembro por apellido suelto son firmas o listas, y una más es una etiqueta de orador. Regla: tratar como firma el nombre seguido o precedido de «. —» o «. –», y saltar las listas de nombres que siguen a «Sala de la comisión, <fecha>.» o que preceden a «, en nuestro carácter de» o «, diputados nacionales».

## Otras observaciones que no se cuentan como error

- Martínez de Hoz ya no va a diputados salvo en el n.º 5, pero 296 menciones suyas («doctor», «señor» o «ministro Martínez de Hoz») van a la clave «martinez hoz zubaran», que se muestra como «Martínez de Hoz y Zubarán» porque una sola mención dice «doctor Martínez de Hoz y Zubarán». Zubarán tiene además su propio nodo («guillermo zubaran», 115), y José Alfredo Martínez de Hoz está repartido en otras seis claves («jose alfredo martinez hoz», 18; «martinez iloz», del OCR; «jose martinez hoz» y otras tres con iniciales o el segundo nombre). Regla: partir en dos menciones «X y Y» cuando Y es por sí sola una persona conocida.
- Nodos partidos: Caride («alejandro caride», 379; «alejandro roberto caride», 159; «alejandro cande», 9; «alejandro r caride», 8), Padilla («miguel padilla», 66, y «miguel tobias padilla», 5: n.º 20 y 29) y Kurlat («kurlat», 88; «italo arturo kurlat», 39, que además funde a Italo Domingo Arturo, director de la CIAE, con Kurlat; «alberto kurlat», 4). A la inversa, «francisco soldati» (216) junta al padre y al hijo.
- Cinco menciones de la muestra (14, 17, 21, 22 y 30) salen del anexo documental de 1985: escritos judiciales, cartas y escrituras. Las de la fila AR003002811893 (14, 17, 22 y 30) no tienen orador y no dan aristas, pero cuentan como menciones recibidas.
- El n.º 12 sale marcado «se dirige», pero es una lista de firmas (`vocativoDe` toma por vocativo un nombre entre comas). El n.º 13 sale como apellido suelto porque el OCR separa las letras de «d i p u t a d o».
- Lo que la versión 6.2 corrige respecto de la revisión anterior: Macri y Milei van siempre a su nodo externo (19, 25 y 32), y las menciones de Galland van ahora al síndico («alfredo galland») y no al diputado de 2001.

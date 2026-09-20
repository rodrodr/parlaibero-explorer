# Precisión del detector de menciones, versión 6: México (Cámara de Diputados)

Muestra de `node muestra_precision6.cjs paises/MX 8 23` sobre `paises/MX/menciones6.json`: 8 menciones por categoría, 56 en total. Cada mención se revisó con la intervención completa en `biblioteca.json`, los turnos vecinos de la sesión y `oradores.json`: escaño en la legislatura de la fecha, homónimos, quién interviene y quién preside. Los escaños y cargos que no se deducían del corpus se comprobaron en las fuentes citadas en el motivo de cada caso y al final. El detalle está en `revision6/MX.json`, y los números entre paréntesis remiten a él. Las líneas citadas son de `detectar6.cjs`.

Criterios:
- Cargo sin nombre: la mención es correcta si el texto habla de quien ocupaba el cargo ese día. Cuentan como incorrectos los usos del cargo en un texto normativo («los magistrados, que los nombrará el Presidente de la República») o en un enunciado general. La revisión anterior dio por buenos los genéricos que apuntaban al titular, así que se da también la cifra con ese criterio.
- «No debería contar» se anota en las correctas que son turnos de la Presidencia, fórmulas de la Secretaría, votaciones nominales, duplicados o documentos leídos o insertados por la Secretaría. En estos últimos, la fuente de la mención es quien lee, no el autor.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Correctas que no deberían contar |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Miembro, con tratamiento o cargo | 3.275 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 7 |
| Miembro, apellido suelto | 81 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 8 |
| Miembro, cargo sin nombre (por fecha) | 18 | 8 | 5 | 2 | 1 | 71 % | 36–92 % | 3 |
| Externa, con cargo o título | 1.838 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 5 |
| Externa, antiguo orador sin escaño | 26 | 8 | 6 | 2 | 0 | 75 % | 41–93 % | 4 |
| Externa, apellido suelto | 162 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 2 |
| Externa, cargo sin nombre (por fecha) | 227 | 8 | 2 | 6 | 0 | 25 % | 7–59 % | 1 |
| **Total** | 5.627 | 56 | **43** | 12 | 1 | **78,2 %** | 66–87 % | 30 |

- Una dudosa (nº 19). Si se pondera cada categoría por su tamaño en la salida, la estimación es del 92 %, porque las dos categorías grandes no tienen errores. Con ocho casos por categoría, cada error mueve la precisión 12,5 puntos.
- Con el criterio de la revisión anterior para los genéricos, los 8 usos genéricos o normativos de «el presidente de la República» serían correctos: 51 de 55 (92,7 %). La revisión de la versión 5 dio un 64,0 % en 50 menciones, con otras categorías.
- La identidad casi siempre es correcta, pero 30 de las 43 correctas no son alusiones de un orador a una persona. Solo 13 de las 56 menciones son alusiones limpias en un discurso. Para la red, esto pesa más que los errores de identidad (apartado «Lo que no debería contar»).
- Los errores de la revisión anterior no reaparecen. Los apellidos sueltos de miembros ya se buscan por el apellido: los 8 de la muestra son correctos. «Ausente» ya no es una persona; antes lo eran 312 menciones. Las menciones externas de personas con escaño en esa legislatura bajan de 67 a 9: Chaurand 5, Fraile 2, Rocha Medina 1 y Núñez Monreal 1.

## Errores que quedan, por causa

### 1. «El presidente de la República» genérico o normativo (8 casos: nº 18, 22 y 49 a 54)

La versión 6 atribuye por fecha «el presidente de la República». En México las sesiones llevan textos legales largos (dictámenes, iniciativas, artículos constitucionales), y en ellos el cargo aparece en abstracto:

- Normativo: «Se prevé que los magistrados, que los nombrará el Presidente de la República, con la aprobación del Senado…» (1995, nº 49); «o directamente al Presidente de la República cuando se trate de éste» (2021, nº 50); «requiriéndose para ello acuerdo suscrito por el Presidente de la República» (2008, nº 18); «No ser cónyuge o tener parentesco… con el Presidente de la República o el Gobernador del Estado» (2005, nº 53); «el presidente de la República sería imputable» (2018, nº 52).
- Genérico: «la presencia en los medios… corresponde al Presidente de la República, a los gobernadores, a los presidentes municipales» (2007, nº 22); la autonomía de los órganos anticorrupción «respecto al presidente de la República» (2018, nº 51); «el sistema de impunidad que privilegiaba al Presidente de la República» (2021, nº 54).

Son 8 de los 16 cargos sin nombre de la muestra, más la dudosa. En una segunda muestra de 40 (semilla 77) hay 15 de este tipo, así que en la salida rondan 4 de cada 10.

Reglas (bucle de `cargosSinNombre`, l. 552–561). No atribuir:
- en texto legal: «Artículo N», «fracción», «inciso» o una numeración romana («II. Cuando…») en los 300 caracteres anteriores;
- con un verbo normativo junto al cargo: «nombrará», «podrá», «deberá», «instruirá», «designará», «expedirá», «sería»;
- con «cuando se trate» o «si se tratara» detrás;
- en enumeraciones de cargos: «…, a los gobernadores», «o el Gobernador»;
- tras «corresponde al», «a propuesta del», «facultades del».

Probadas sobre las dos muestras, estas pistas quitan 6 de los 8 genéricos de la primera y 7 de los 15 de la segunda, y ninguna mención correcta. En toda la salida quitarían 57 de 245. Los que quedan son enunciados generales sin marca formal («responsabilidad penal del presidente de la República», «el control político del presidente de la República»). Para esos, lo prudente es no atribuir el cargo sin nombre dentro de documentos de la Secretaría, o marcar esas aristas como de menor confianza.

### 2. Miembros con escaño tratados como personas externas (3 casos: nº 33, 35 y 47)

Tres mecanismos en la muestra y un cuarto fuera de ella:

**a) Dos id para la misma persona (nº 35).** «mi compañero y amigo César Augusto Santiago» (29-12-2001) es César Augusto Santiago Ramírez (PRI), diputado en la LVIII, que acababa de hablar sobre ese artículo (MX005011701074). El corpus tiene dos id: MX00868, «César Augusto Santiago» (LV), y MX00869, «César Augusto Santiago Ramírez» (LVIII y LXI). Con el primero el nombre coincide entero (fuerza 3); con el segundo, fuerza 2. `resolver` (l. 317) devuelve MX00868 como «otra legislatura» en el nivel 3 y no baja al nivel 2, donde está el que tiene escaño. Como MX00868 no tiene escaño en la biblioteca, sale persona externa. La revisión anterior señaló el mismo caso y la misma regla, y sigue igual.

Regla: si en el nivel más alto nadie tiene escaño, buscar antes de devolver «otra legislatura» un candidato con escaño en los niveles inferiores cuyo nombre empiece por la mención. Y unificar los id duplicados.

**b) Diputados que no intervinieron en esa legislatura (nº 33).** «Sigue abierto el sistema, compañeras y compañeros. Diputado Erubiel Lorenzo Alonso Que y diputada Modesta Yolanda Pacheco Olivares» (6-2-2018): la Secretaría llama a votar a dos diputados. Alonso Que era diputado en la LXIII, pero en el corpus no habló en ella, y `oradores.json` solo lo tiene en la LXVI. `senta` (l. 225–236) solo da escaño a quien intervino en esa legislatura; en México, sin reelección consecutiva, tampoco lo supone entre dos legislaturas. Como la LXVI no está en la biblioteca, sale «antiguo orador sin escaño». Pacheco Olivares queda como miembro sin resolver.

En la salida, 21 menciones externas llevan forma de miembro («diputado X»). Por su propio texto, 9 son de diputados en ejercicio. Siete tienen la causa de la nº 33:
- Alonso Que, 3 veces (2018);
- «la propuesta realizada por la diputada Cota» (2001);
- «a cargo del diputado Rafael Mendoza Flores, del grupo parlamentario del PRD», 2 veces (2005);
- «a cargo de la diputada María Bertha Espinoza Segura, del Grupo Parlamentario de Morena» (2022).

Las otras dos tienen la causa d. Las 12 restantes son exdiputados o diputados locales, y están bien.

Regla: con forma de miembro en presente («el diputado X presentó», «a cargo del diputado X, del Grupo Parlamentario…», un llamamiento a votar) y un nombre completo que es de un orador, hacerlo miembro aunque no conste el escaño. Mejor aún, tomar los escaños de las listas de la Cámara y no de la actividad.

**c) El apellido suelto de una persona externa que ese día tenía escaño (nº 47).** «Carlos Chaurand Arzate (rúbrica)» (14-10-2008) firma el dictamen como diputado de la LX, donde tiene 66 intervenciones entre 2006 y 2008. La persona externa «carlos chaurand arzate» existe porque firmó como «Sen.» en 2005.

En el pase de apellidos sueltos de externas (l. 750–761) hay un miembro con escaño ese día. Pero `usoApellido` (las veces que se le llama «diputado Chaurand») es 0 y la persona externa tiene muchas menciones, así que se queda externa. En la salida pasa en 7 menciones: Chaurand 5 y Francisco Antonio Fraile 2 («El suscrito, Francisco Antonio Fraile García, diputado federal…», 2007).

Regla: en ese pase, si la persona externa es un orador con escaño ese día, la mención es del miembro, o se salta.

**d) Otra variante del nombre (fuera de la muestra).** «la Secretaria diputada María Sara Rocha Medina» (2005) y «secretaria diputada Magdalena del Socorro Núñez Monreal» (2013) salen como personas externas aunque tienen escaño e intervienen en esas legislaturas. Sus tokens salen de la primera variante del nombre en `oradores.json` («SARA ROCHA MEDINA», «MAGDALENA NÚÑEZ MONREAL»), y «María» o «del Socorro» no encajan. Sin candidato, y con «secretaria» tomada por cargo de Gobierno, quedan externas. Es la misma causa que parte en dos a Calderón (apartado 6 de la sección siguiente).

### 3. Un grado militar tomado por persona (1 caso: nº 30)

«…a favor del Coronel Médico Cirujano Francisco Javier Andrade Ramiro como General Brigadier Médico Cirujano» (25-1-2006). «General» es forma descriptiva, «Brigadier Médico Cirujano» queda como nombre, y la clave «brigadier medico cirujano» se une a otro oficial («brigadier medico cirujano david huerta hernandez») porque es el principio de su clave. El mismo mecanismo hace que la clave de la nº 28 arrastre «médico cirujano». Los dictámenes de ascensos de la Comisión Permanente de ese día están llenos de grados así: «General de Brigada Diplomado de Estado Mayor», «General de Grupo Piloto Aviador…».

Regla:
- Añadir a las formas y a `noPersona` los grados y especialidades militares: «brigadier», «médico cirujano», «diplomado de Estado Mayor», «piloto aviador», «ingeniero constructor», «de brigada», «de división», «de grupo», «de ala».
- Descartar el nombre si solo tiene esas palabras.
- No unir claves cuya parte común son solo palabras de grado.

### Dudosa (nº 19)

«…para que a la brevedad ratifique los convenios 81, 85, 174 y 176 de la Organización Internacional del Trabajo ya suscritos por el Presidente de la República» (12-4-2007). La misma intervención dice «previamente suscritos por el Ejecutivo federal», sin fecha. No se puede saber si fue Calderón, presidente desde el 1-12-2006, o un predecesor.

## Lo que no debería contar (no cambia el veredicto)

Son 30 de las 43 correctas.

### 1. Documentos leídos o insertados por la Secretaría (25 casos)

- Orden del día («a cargo del diputado…»): nº 1, 4, 5, 6 y 8.
- Actas de la sesión anterior: nº 10, 11 y 46.
- Comunicaciones y oficios: nº 2, 25, 26, 39 y 56.
- Dictámenes, con sus antecedentes y firmas: nº 9, 12, 13, 14, 15, 27, 28, 36 y 37.
- Puntos de acuerdo del Senado o del Congreso de Chihuahua: nº 23, 34 y 43.

La identidad es buena, pero la fuente de la mención es la diputada o el diputado que lee, no el autor. En la red crean aristas entre quien lee y los autores, firmantes y personas que nombra el documento. En toda la salida:
- 2.424 de las 3.275 menciones de miembros con tratamiento (74 %) y 1.315 de las 1.838 externas con cargo (72 %) están entre «…»;
- 1.014 van precedidas de «a cargo de» y 474 seguidas de «(rúbrica)».

Regla: marcar como documento, o descartar, las menciones entre «…» de los turnos de la Secretaría, y las precedidas de «a cargo del/de la», «suscrita por» o «presentada por» o seguidas de «(rúbrica)». En las sesiones recientes las etiquetas no dicen quién es secretario, pero sus turnos empiezan por «Por instrucciones de la Presidencia…» o por «Escudo…». No vale todo texto entre «…»: los diputados también insertan sus propias iniciativas (nº 38, 40, 45 y 51), y esas son suyas.

### 2. Turnos de la Presidencia que no se descartan (nº 16 y 29)

Desde 2003 las etiquetas mexicanas son solo nombres, y la Presidencia se deduce (l. 122–137): la tiene quien suma al menos una cuarta parte de los turnos, si la mediana de su largo no pasa de 400 caracteres. Falla en tres sesiones:

- 18-10-2005, sesión solemne: Heliodoro Díaz Escárraga tiene 10 de 16 turnos, pero la mediana es de 537 caracteres. En una sesión solemne sus turnos son largos: uno es el discurso de bienvenida y otro arrastra el del homenajeado (nº 29).
- 13-10-2005: Álvaro Elías Loredo, con una mediana de 500.
- 6-2-2018: una fila cuya etiqueta empieza por «El Presidente dirige unas palabras a la Asamblea…» (un resumen, no un turno) cuenta como etiqueta de Presidencia. Eso impide la deducción en toda la sesión, y quedan los 85 turnos de Edgar Romo García (nº 16).

Entre las tres suman 179 menciones en turnos de quien preside. Algunas son discursos de otros diputados pegados a esas filas («El diputado David Hernández Pérez: Gracias, Presidente…»), un problema de segmentación del corpus.

Reglas:
- No tomar por etiqueta de Presidencia una frase (más de unas pocas palabras, o con verbo).
- Deducir la Presidencia aunque haya una o dos filas con etiqueta.
- Cambiar la mediana por la proporción de turnos cortos (por ejemplo, 60 % por debajo de 400 caracteres).

### 3. Fórmulas de la Secretaría (nº 7; también la nº 33, entre las incorrectas)

«se consulta a la Asamblea en votación económica si es de admitirse la propuesta presentada por el diputado Rodolfo Escudero» y «Sigue abierto el sistema… Diputado X».

Regla: añadir a `procedimiento` «si es de admitirse la propuesta presentada por», «sigue abierto el sistema» y «¿falta algún diputado…?», o tratar los turnos de la Secretaría como los de la Presidencia.

### 4. Duplicados (nº 17 y 20)

- La proposición de José Luis Blanco Pajón aparece dos veces en la misma fila: lo que dijo y el texto publicado entre «» («Proposición con punto de acuerdo… a cargo del diputado José Luis Blanco Pajón»). En esa fila hay cinco menciones de Calderón, y dos son repeticiones (la nº 17 repite la nº 24). Regla: si tras el discurso viene «Proposición/Iniciativa… a cargo del diputado [quien habla]», contar las menciones una sola vez.
- «del presidente de la república, licenciado Felipe de Jesús Calderón Hinojosa» (nº 20): se cuentan el cargo sin nombre y, aparte, el nombre, que además va a otro nodo (apartado 6). La excepción de la l. 554 solo admite «señor/don» entre la coma y el nombre, y «licenciado» la rompe. En la salida, 7 de los 245 cargos sin nombre van seguidos de otra mención con el nombre. Regla: admitir en esa excepción cualquier forma de tratamiento (`FORMA`).

### 5. Votaciones nominales por apellido suelto (nº 16, ya contada en el apartado 2)

«35 Cavazos Cavazos, Juana Aurora Favor». El filtro de listas de votación (l. 503) solo actúa en el pase de formas, no en el de apellidos sueltos (`probar`, l. 707).

Regla: en `probar`, saltar las líneas «número Apellidos, Nombre Favor/Contra/Ausente/Abstención».

### 6. Nodos partidos (afectan a la red, no a la identidad)

**Externos por cargo con escaño anterior en la biblioteca.** Hay 294 menciones externas de 29 personas que antes de esa fecha tuvieron escaño, con intervenciones, en alguna legislatura de la biblioteca. Las que más: Chaurand (47), Melgoza (40), Sadot Sánchez Carreño (35), Gloria Lavara (35), Ojeda Zubieta (26), Cantón Zetina (22), Zermeño (20), Lozano Gracia (16) y Jáuregui (8). Casi todas van con «Sen.» o «senador» (268). Por la regla del antiguo miembro de la versión 6 serían el nodo del miembro. Prevalecen la lista de externos por cargo (l. 207–220) y la rama de la forma externa (l. 391). En la muestra: nº 25 y 26 (Jáuregui, LVII) y nº 27 (Melgoza, LIV).

Regla: aplicarles también `escanoEnBiblioteca`. Si tuvieron escaño antes, nodo del miembro con «antiguo»; si no, persona externa.

**Calderón tiene dos nodos.** Uno es el miembro MX01442, por los cargos sin nombre y como antiguo miembro. El otro es la persona externa «felipe jesus calderon hinojosa», con 5 menciones de su nombre completo. Hay dos causas:
- Los tokens del orador salen de la primera variante de su nombre en `oradores.json` («FELIPE CALDERÓN HINOJOSA», LV), y «de Jesús» no encaja (como en la causa 2d).
- La comprobación del nombre completo de un jefe de Estado (l. 374) exige que la mención termine como el nombre de la tabla («Felipe Calderón»).

Regla: construir `toks` con todas las variantes del nombre de un mismo id, y aceptar en esa comprobación los nombres que contienen el primer y el último token de la tabla.

## Otras observaciones

- «H. Cuerpo de Bomberos» sale como persona externa (13-10-2005): «H.» (honorable) delante de una institución. Regla: añadir «cuerpo» y «bomberos» a `noPersona`.
- La nº 28 es correcta, pero su clave («medico cirujano francisco javier andrade ramiro») separaría al oficial de otra mención sin el grado.

## Fuentes consultadas

- Erubiel Lorenzo Alonso Que, diputado federal en la LXIII: https://heraldodemexico.com.mx/edicion-impresa/2024/8/5/quien-es-erubiel-lorenzo-alonso-que-diputado-por-representacion-proporcional-del-pri-626922.html (nº 33)
- Héctor Elías Barraza Chávez, miembro del Congreso de Chihuahua y diputado federal en la LXI: https://en.wikipedia.org/wiki/Héctor_Barraza_Chávez (nº 34)
- Rubén Cayetano García, diputado del 1-9-2018 al 31-8-2021: https://es.wikipedia.org/wiki/Rubén_Cayetano_García (nº 38 y 40)
- Netzahualcóyotl de la Vega García, senador de 1988 a 1994: https://en.wikipedia.org/wiki/Netzahualcóyotl_de_la_Vega (nº 46)

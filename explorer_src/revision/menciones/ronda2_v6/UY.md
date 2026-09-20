# Precisión de las menciones, versión 6: Uruguay (Cámara de Representantes)

Muestra: `node muestra_precision6.cjs paises/UY 8 23` sobre `paises/UY/menciones6.json`, hasta 8 menciones por categoría. La categoría de antiguos oradores sin escaño en la biblioteca está vacía en la salida, así que se juzgaron 48. Cada mención se leyó con su intervención completa en `biblioteca.json` y las filas de alrededor, y se comprobaron en `oradores.json` el escaño en la legislatura y los homónimos. Las fuentes consultadas están en el motivo de cada caso. El detalle está en `revision6/UY.json`. Los números entre paréntesis remiten a ese archivo, y las líneas, a `detectar6.cjs`.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | No deberían contar |
|---|---:|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 1.491 | 8 | 8 | 0 | 0 | 100 % | 2 |
| Miembro, apellido suelto | 181 | 8 | 8 | 0 | 0 | 100 % | 6 |
| Miembro, cargo sin nombre (por fecha) | 11 | 8 | 3 | 5 | 0 | 38 % | 0 |
| Externa, con cargo o título | 1.018 | 8 | 8 | 0 | 0 | 100 % | 0 |
| Externa, antiguo orador sin escaño | 0 | 0 | – | – | – | – | – |
| Externa, apellido suelto | 120 | 8 | 7 | 1 | 0 | 88 % | 0 |
| Externa, cargo sin nombre (por fecha) | 88 | 8 | 8 | 0 | 0 | 100 % | 0 |
| **Total** | 2.909 | 48 | **42** | 6 | 0 | **88 %** | 8 |

No hay dudosas. La precisión es correctas / (correctas + incorrectas). La columna «No deberían contar» no cambia el veredicto: son menciones bien identificadas que no deberían estar en la salida (se explican más abajo).

El total no está ponderado por el tamaño de cada categoría, y con 8 casos por categoría el margen es amplio. Cuatro recuentos sobre la salida completa matizan la muestra:

- Miembro por cargo sin nombre: 8 de las 11 son de 1991 y van a Lacalle Pou; solo las 3 de 2021 están bien (27 %).
- Miembro por apellido suelto: 125 de 181 (69 %) salen de las listas de asistencia de siete filas de cabecera, seis que el corpus atribuye a Bertolini y una sin orador («SEÑOR REPRESEN»). La revisión de la versión 5 contaba 21 de 179: al buscar por el apellido y no por el nombre de pila, la versión 6 encuentra muchas más en esas listas. Las mismas filas dan además 80 menciones de miembros con tratamiento, casi todas entradas del sumario («Exposición del señor Representante Posada……… 158»), y 21 externas.
- Miembro con tratamiento: 347 de 1.491 (23 %) son la fórmula de voto de tres elecciones nominales de la Mesa de la Cámara, en 1992, 1999 y 2011 («Por el señor Diputado Lacalle Pou»).
- Externa con cargo: 34 menciones van a claves que no son personas: «alterno», «ordenamiento territorial medio ambiente», «redactor» y «letrado» (véase «Otras observaciones»).

## Errores que quedan, por causa

### 1. El hijo por el padre: «el Presidente de la República» de 1991 atribuido a Lacalle Pou (5 errores: 18 y 20 a 23)

En agosto de 1991 el presidente era Luis Alberto Lacalle Herrera (1-3-1990 a 1-3-1995), padre de Luis Lacalle Pou (https://es.wikipedia.org/wiki/Luis_Alberto_Lacalle). La tabla de jefes da para esa fecha «Luis Alberto Lacalle». En la l. 558, `resolver(['luis', 'alberto', 'lacalle'])` encuentra a LACALLE POU, LUIS ALBERTO con fuerza 2: las tres palabras están en su nombre y «lacalle» es su apellido de referencia. Nadie tiene fuerza 3 y él no tiene escaño en 1991, así que sale «otra legislatura». La l. 559 lo acepta como miembro porque `tuvoEscano` es cierto (tuvo escaño en las leg. XLV a XLVII) y lo marca como antiguo miembro (`antiguo: !r.sentado`), aunque ese escaño llegó nueve años después.

Fuera de la muestra, la misma confusión aparece por los otros caminos:
- «el presidente Lacalle es más neoliberal que su padre» (2021) va al padre: con un apellido solo, `jefeDe` (l. 193-199) solo encuentra la clave «lacalle», la del padre, que sigue valiendo como expresidente.
- «el doctor Luis Alberto Lacalle Poupueda» (2011, el OCR pegó «Pou pueda») va al padre.
- «El doctor Lacalle impulsó dos proyectos de reforma» (2017, sobre el gobierno de 1990-1995) va al hijo, como antiguo miembro.
- «presidente Lacalle Pou» (2021) va a un tercer nodo, la persona externa «luis lacalle pou», aparte del nodo de miembro que recibe ese mismo día «el presidente de la República». Y «doctor Lacalle Herrera» (2011) forma otro nodo, «lacalle herrera», aparte de «luis alberto lacalle».

Reglas que lo evitarían:
- En la tabla de jefes, llamar al padre «Luis Alberto Lacalle Herrera» y añadir el alias «lacalle herrera», para que sus palabras no encajen en el nombre del hijo.
- En la l. 559, usar el nodo de miembro solo con el nombre completo (`r.s === 3`) y con `escanoEnBiblioteca(r.d, leg) === 'antes'` en lugar de `tuvoEscano`. Si no, persona externa con la clave del jefe (l. 560).
- En `jefeDe` (l. 193), con un apellido solo, preferir al jefe en el cargo ese día: dar también a Lacalle Pou la clave «lacalle», para que en 2021 la última coincidencia sea él.
- En la rama de jefe con nombre (l. 368) y en la de apellido suelto (l. 721 y 756), si el jefe es un antiguo miembro, usar el nodo de miembro, como ya hace la de cargos sin nombre.

### 2. Hipocorístico entre comillas delante del apellido (1 error: 35)

«a "Nacho" Macedo, nuestro compañero en la Junta Departamental» va a Julio Macedo Saravia, el médico fallecido al que se rinde homenaje; «Nacho» es otra persona, a la que se envía el pésame. La expresión de la l. 737 busca una palabra con mayúscula que acabe justo antes del espacio, y la comilla de cierre la oculta, aunque «nacho» está en `HIPOCORISTICOS`.

Fuera de la muestra, «del ingeniero agrimensor Macedo» (2015) también va a Julio Macedo Saravia, que murió en 2011. `TITULO_ANTES` (l. 679) solo acepta palabras con mayúscula entre la forma y el apellido, y el apellido de una persona externa corriente se busca también en la legislatura contigua (l. 725-726).

Reglas que lo evitarían: que la expresión de la l. 737 salte comillas y paréntesis de cierre (`["”»')]?` antes del espacio); aceptar en `TITULO_ANTES` palabras en minúscula («ingeniero agrimensor»); y buscar el apellido suelto de una persona externa corriente solo en la sesión en que se la nombra con cargo.

### 3. Cargo sin nombre que habla de otra época (fuera de la muestra: 2 casos)

De las 88 externas por cargo sin nombre, dos no son el presidente del día: «a plantear al Presidente de la República de la época su preocupación» (2006) y «en el año 2012, elaboró un anteproyecto de ley que envió al presidente de la República» (2017; entonces gobernaba Mujica). Es la misma causa que domina en Argentina. Regla que lo evitaría: no atribuir por fecha cuando siguen «de la época», «de entonces» o «en ese momento», ni cuando la oración nombra un año anterior al mandato del jefe de ese día.

## Menciones que no deberían contar (8 de 48)

- Listas de asistencia de las filas de cabecera (9, 11, 12, 13 y 16) y una firma en la misma fila (10). El corpus atribuye a Bertolini seis filas de cabecera (etiqueta «SEÑOR MARTIN GARCIA NIN Y DOCTOR HORACIO D») que contienen el sumario, la lista de asistentes y algún documento. La revisión de la versión 5 ya lo señalaba; la versión 6 no las salta y ahora encuentra más (125 de las 181 menciones de miembro por apellido suelto). Regla: saltar el bloque que va de «Asisten los señores Representantes» a «Asuntos entrados» o al primer «Está abierto el acto», y las filas de cabecera (las que llevan «SUMARIO» o «Págs.», o cuya etiqueta no es la de un orador). Fuera del detector, esas filas no deberían llevar el id de Bertolini.
- Fórmula de voto en la elección nominal del presidente de la Cámara (3 y 7): 347 menciones en tres sesiones. Lo que sigue a «y voy a fundar el voto» sí cuenta: 1, 5, 8 y 15 son menciones de ese fundamento y están bien. Regla: en `esProcedimiento` (l. 179), que mira el trozo de oración anterior a la mención, reconocer también la fórmula de voto: `/^\s*(?:(?:con (?:mucho )?gusto(?: y placer)?|voto(?: con mucho gusto)?),?\s+)*por\s+(?:el|la)\s*$/i` («Por el», «Con mucho gusto, por el», «Voto con mucho gusto por el»). Probada sobre la salida, recoge 334 de las 347 y ninguna mención de otras sesiones.

## Otras observaciones que no se cuentan como error

- El n.º 14 sale marcado «se dirige», pero es una enumeración («los señores Diputados Paquet, Sturla, Lamas»): `vocativoDe` (l. 344) toma por vocativo un nombre entre comas.
- Un cargo sin nombre seguido de una aposición con el nombre cuenta dos veces: 4 casos en la salida («el señor Presidente de la República, doctor Tabaré Vázquez»). La comprobación de la l. 554 no admite «doctor» ni «compañero» tras la coma.
- Claves que no son personas en las externas con cargo: «alterno» (11, de «Presidente Alterno del Parlamento Latinoamericano»), «ordenamiento territorial medio ambiente» (11, el nombre del ministerio tras «Ministra de Vivienda,»), «redactor» (8, «Secretario Redactor») y «letrado» (4, «Juez Letrado»). Bastaría con añadir esas palabras a `noPersona`.
- Una misma persona en varios nodos: el ministro Delpiazzo está repartido en ocho claves por el OCR (26 y 31 son dos de ellas; 50 menciones en total). A la inversa, «sanguinetti» (7) mezcla a Julio María y a Norberto Sanguinetti, y «jose korzeniak», al padre y al hijo.
- Fuera del detector: la etiqueta «SEÑOR DOS SANTOS» (Carlos Dos Santos) está emparejada con Cigliuti de los Santos (15), y las filas de cabecera, con Bertolini.

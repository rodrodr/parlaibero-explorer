# Precisión de las menciones, versión 6.2: Uruguay (Cámara de Representantes)

Muestra: `node muestra_precision7.cjs paises/UY 8 31` sobre `paises/UY/menciones6_2.json`, hasta 8 menciones por categoría. La salida no tiene miembros por cargo sin nombre ni antiguos oradores sin escaño en la biblioteca, así que se juzgaron 40. Cada mención se leyó con su intervención completa en `biblioteca.json` y las filas de alrededor, y se comprobaron en `oradores.json` el escaño en la legislatura y los homónimos. Las fuentes consultadas están en el motivo de cada caso. El detalle está en `revision7/UY.json`. Los números entre paréntesis remiten a ese archivo, y las líneas, a `detectar6_2.cjs`.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | No deberían contar |
|---|---:|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 1.237 | 8 | 7 | 1 | 0 | 88 % | 0 |
| Miembro, apellido suelto | 125 | 8 | 8 | 0 | 0 | 100 % | 5 |
| Miembro, cargo sin nombre (por fecha) | 0 | 0 | – | – | – | – | – |
| Externa, con cargo o título | 1.032 | 8 | 7 | 1 | 0 | 88 % | 0 |
| Externa, antiguo orador sin escaño | 0 | 0 | – | – | – | – | – |
| Externa, apellido suelto | 183 | 8 | 8 | 0 | 0 | 100 % | 0 |
| Externa, cargo sin nombre (por fecha) | 97 | 8 | 8 | 0 | 0 | 100 % | 0 |
| **Total** | 2.674 | 40 | **38** | 2 | 0 | **95 %** | 5 |

No hay dudosas. La precisión es correctas / (correctas + incorrectas). La columna «No deberían contar» no cambia el veredicto: son menciones bien identificadas que no deberían estar en la salida (se explican más abajo).

El total no está ponderado por el tamaño de cada categoría, y con 8 casos por categoría el margen es amplio. Cuatro recuentos sobre la salida completa matizan la muestra:

- Miembro con tratamiento: de las 49 menciones de antiguos miembros, al menos 6 son de otra persona, el n.º 4 y otras cinco (véase la causa 1). Además, 60 de las 1.237 salen de las filas de cabecera atribuidas a Bertolini (entradas del sumario y de los asuntos entrados, como «pedido de informes del señor Representante Leonardo Nicolini») y 16 son la fórmula de voto de la elección del presidente de la Cámara de 2011 («Con mucho gusto, por el señor Diputado Lacalle Pou»). La revisión de la versión 6 contaba 347 fórmulas de voto en tres elecciones: la 6.2 ha quitado casi todas.
- Miembro por apellido suelto: 78 de las 125 (62 %) salen de las filas de cabecera (sumario, lista de asistencia y asuntos entrados), todas atribuidas a Bertolini. En la muestra son 5 de 8.
- Externa por cargo sin nombre: la muestra da 8 de 8, y en la salida completa no hay atribuciones a otra época. Hay 4 duplicados por aposición («el señor Presidente de la República, doctor Tabaré Vázquez»; «al señor Presidente de la República, al compañero Tabaré Vázquez») y al menos 3 usos del cargo en abstracto («Esto no lo define ningún Ministro, sea cual sea su nombre, ni el Presidente de la República», 1991; «como los ministros de Estado o el presidente de la República», 2021).
- Externa con cargo: quedan claves que no son personas: «redactor» (8), «letrado» (3), «edil departamental» (3), «presi» (3) y «servicios ganaderos» (el n.º 20). «alterno» y «ordenamiento territorial medio ambiente», que señalaba la revisión anterior, ya no están.

## Errores que quedan, por causa

### 1. Antiguo miembro por apellido y tratamiento que en el texto es otra persona (1 error: 4; fuera de la muestra, al menos 5 más)

- 4: «que la versión taquigráfica … sea enviada a los familiares del doctor Macedo y de la señora Cecilia Burgueño» cierra el homenaje al médico Julio Macedo Saravia, al que las filas anteriores de la misma sesión nombran con nombre completo y que tiene su nodo externo («julio macedo saravia»). El detector resuelve «doctor Macedo» solo con la lista de oradores: el único Macedo es su hermano José Ignacio, exdiputado de la XLIV, y como tuvo escaño antes y el apellido es distintivo, la l. 584 lo toma por antiguo miembro. No mira las personas externas nombradas en esa sesión.

Fuera de la muestra, de las 49 menciones de antiguos miembros con tratamiento:
- «Sr. Aguirre» (1997) va a Numa Aguirre Corte, aunque la frase anterior dice «el Sr. Néstor Aguirre».
- «Presidente Cubas» (1999) va a Pedro Cubas Mercapidez, pero es el expresidente de Paraguay («un ex Ministro de Defensa del gobierno de Paraguay del ex Presidente Cubas»).
- «doctor Vázquez» (2006) va a Roberto Vázquez Platero («tuvo escaño»), pero es el presidente Tabaré Vázquez, cuyas declaraciones se discuten en esa sesión.
- «el amigo Luis» (2011) va a José Luis Ovalle, que en `oradores.json` figura como «LUIS OVALLE, JOSE» (con «Luis» de primer apellido), pero se habla de Luis Lacalle Pou, elegido presidente de la Cámara ese día.
- «El doctor Lacalle impulsó dos proyectos de reforma» (2017) habla del gobierno de 1990-1995, es decir, del padre (https://es.wikipedia.org/wiki/Luis_Alberto_Lacalle), y va al hijo como antiguo miembro. La revisión de la versión 6 ya lo señalaba.

Reglas que lo evitarían:
- Antes de las ramas de antiguo miembro (l. 573 y 584), con un apellido solo, preferir la persona externa de esa sesión cuya clave termina en ese apellido y que se ha nombrado con nombre completo («julio macedo saravia», «nestor aguirre»).
- Mirar la tabla de jefes de Estado (l. 490-495) con cualquier forma y no solo con «presidente» o un grado militar, salvo que un miembro con ese apellido hable en la sesión: «doctor Vázquez» en 2006 es el jefe de Estado en ejercicio, y «doctor Lacalle» en 2017, el último jefe con ese apellido (Lacalle Pou no lo es hasta 2020), que es a quien se refiere el párrafo («el gobierno del Partido Nacional», el plebiscito de 1992).
- «Presidente X» con otro país en la misma oración («de Paraguay») es un jefe de Estado extranjero: persona externa.
- No atribuir a un antiguo miembro un nombre de pila solo («el amigo Luis»), aunque coincida con su primer apellido: extender la regla de la l. 420 a los candidatos sin escaño ese día.

### 2. Institución tomada por persona (1 error: 20)

«La primera resolución de la Dirección General de lo expresado, Servicios Ganaderos es del 20 de agosto» es un párrafo desordenado por el OCR («de la Dirección General de Servicios Ganaderos»). La expresión de aposiciones `RX_INST` (l. 258) toma «General de lo expresado» como cargo y «Servicios Ganaderos» como nombre, y la comprobación de la l. 731 lo acepta porque tiene dos palabras y ninguna está en `noPersona` ni en los lugares.

Reglas que lo evitarían: en la l. 731, exigir que el nombre empiece por un nombre de pila o sea de un orador, y no aceptar dos sustantivos comunes con mayúscula; no tomar «General» como forma cuando lo precede «Dirección», «Secretaría», «Inspección» o «Contaduría»; y añadir a `noPersona` «servicios», «redactor» y «letrado», que siguen en la salida.

## Menciones que no deberían contar (5 de 40)

- Firmas de proyectos (9, 14, 15 y 16) y lista de asistencia (10) en las filas de cabecera. El corpus atribuye a Bertolini las filas con la etiqueta «SEÑOR MARTIN GARCIA NIN Y DOCTOR HORACIO D», que contienen el sumario, la lista de asistencia y los asuntos entrados con el texto y las firmas de los proyectos. Las dos revisiones anteriores ya lo señalaban. En la lista de asistencia (10), `enAsistencia` (l. 269) solo mira el comienzo de la línea, y la lista está partida en varias líneas.

Reglas: saltar las filas de cabecera (las que contienen «SUMARIO» o «Asisten los señores Representantes», o cuya etiqueta no es de un orador); en `enAsistencia`, mirar el comienzo del párrafo y no el de la línea; y tratar como firma la lista de nombres con «Representante por <departamento>» tras una fecha («Montevideo, 4 de mayo de 1999.»). Fuera del detector, esas filas no deberían llevar el id de Bertolini.

## Otras observaciones que no se cuentan como error

- Nodos partidos por el OCR: Carlos Delpiazzo en nueve claves (51 menciones: «carlos delpizzo» 17, «delpiazzo» 13, «delpazio» 8, «delipazzo» 4, que es el n.º 18, «delipazio» 4 y otras cuatro), Jaime Rostkier en ocho (43), Norberto Sanguinetti en cuatro (69, más «sanguinetti», 5, que puede ser él o Julio María) y Enrique Erro en dos («enrique ero», el n.º 17, y «enrique erro»).
- La doctora Albertini de 1991 (23) es persona externa y «doctora Laura Albertini», en la misma sesión, va al nodo de miembro de Laura Albertini como «aún sin escaño». Es lo que pide el criterio (con escaño solo posterior, solo con nombre completo), pero deja a la misma persona en dos nodos.
- El n.º 8 sale marcado «se dirige», pero es una aposición («Al amigo, señor Diputado Singer, lo sentimos…»). El n.º 12 sale como apellido suelto porque un salto de párrafo parte «Diputa-do» del apellido.
- Lo que la versión 6.2 corrige respecto de la revisión anterior: «el Presidente de la República» de 1991 va a Luis Alberto Lacalle Herrera y no a su hijo (36), y la fórmula de voto casi ha desaparecido.

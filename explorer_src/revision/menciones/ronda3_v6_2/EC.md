# Ecuador (EC), Congreso Nacional y Asamblea Nacional: precisión de las menciones, versión 6.2

Muestra de `node muestra_precision7.cjs paises/EC 8 31`: hasta ocho menciones por categoría, 47 en total.

- La categoría «externa, antiguo orador sin escaño en la biblioteca» tiene 7 menciones en la salida, y entran todas.
- La de miembros por cargo sin nombre está vacía: los jefes de Estado van siempre a su nodo externo.

Cada mención se revisó con su intervención completa en `biblioteca.json`, las intervenciones vecinas y `oradores.json`. Cuando hizo falta saber quién era alguien o qué cargo tenía, se consultaron fuentes externas, citadas en `EC.json`.

## Precisión

Precisión = correctas / (correctas + incorrectas), con las dudosas aparte.

| Categoría | Menciones en la salida | Correctas | Incorrectas | Dudosas | Precisión | No deberían contar |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 520 | 8 | 0 | 0 | 100 % | 1 |
| Miembro, apellido suelto | 16 | 7 | 1 | 0 | 88 % | 0 |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | — |
| Externa, con cargo o título | 180 | 8 | 0 | 0 | 100 % | 1 |
| Externa, antiguo orador sin escaño | 7 | 4 | 2 | 1 | 67 % | 0 |
| Externa, apellido suelto | 19 | 8 | 0 | 0 | 100 % | 2 |
| Externa, cargo sin nombre (por fecha) | 95 | 7 | 1 | 0 | 88 % | 0 |
| **Total de la muestra** | | **42** | **4** | **1** | **91 %** | **4** |

- Con ocho casos por categoría el margen es amplio (intervalo de Wilson al 95 %): 8/8 es compatible con un 68-100 %, 7/8 con un 53-98 % y 4/6 con un 30-90 %. El total, 42/46, con un 80-97 %.
- La categoría de antiguos oradores se ha revisado entera (7 de 7), así que su resultado no es una estimación.
- Ponderada por el número de menciones de cada categoría, la precisión estimada es del 98 %. Pesan los miembros con tratamiento (520) y las externas con cargo (180), sin errores en la muestra.
- La dudosa (n.º 27) apenas mueve el total: como incorrecta, 42/47 (89 %); como correcta, 43/47 (91 %).
- La revisión de la versión 6, con otra muestra, daba 42/53 (79 %) y un 93 % ponderado.
  - Ya no aparece el cargo sin nombre atribuido a un miembro: las menciones de «el presidente de la República» de 2019 van ahora a la persona externa de Lenín Moreno, y las de Daniel Noboa como presidente, salvo una (causa 2), a su nodo externo.
  - Siguen, idénticas, las tres menciones dudosas o erróneas de la categoría de antiguos oradores (causa 1), porque la categoría es tan pequeña que las dos muestras la cubren casi entera. Siguen también las consignas tras «Otra voz:».
  - La fórmula normativa «la Presidenta o el Presidente de la República» ya se descarta, pero quedan otros usos normativos del cargo (causa 3).
- Solo 4 de las 42 correctas no deberían contar. A diferencia de Colombia, el filtro de la Mesa funciona bien en Ecuador.

## Errores que quedan, por causa

### 1. Enlaces con oradores de otra legislatura por un nombre parcial (2 errores y 1 dudosa: n.º 25, 31 y 27)

- n.º 25: «el ingeniero Juan Aguilar, representante del Fondo de Cesantía de la Escuela Superior Politécnica de Chimborazo» (2025) se atribuye a Juan Pablo Aguilar Andrade, abogado y profesor de Derecho, orador de 2008.
  - Es el representante del fondo de cesantía de los docentes de la ESPOCH que compareció ante la comisión el 18 de septiembre de 2025 (https://www.asambleanacional.gob.ec/es/noticia/109518-representante-del-fondo-complementario-previsional).
- n.º 31: «el Presidente de la Corte Constitucional, Patricio Pazmiño» (2009) se atribuye a Germánico Patricio Pazmiño Corrales, constituyente de Alianza PAIS en 2007-2008.
  - Es Patricio Pazmiño Freire, presidente de la Corte de 2008 a 2012 (https://es.wikipedia.org/wiki/Patricio_Pazmi%C3%B1o_Freire).
- n.º 27, dudosa: «señor Luis Guamán», maestro de Napo al que se suprimió la partida en 1994, se atribuye a José Luis Guamán Guaillas, orador del MPD con una sola intervención (1996-11-20). Ninguna fuente permite confirmarlo ni descartarlo.
- Son las mismas tres menciones de la revisión anterior, y las reglas propuestas entonces no se han aplicado. El cuarto error de entonces en esta categoría, «el honorable José Llerena, alterno» (1994), ya se resuelve bien, a Pedro José Llerena Olvera.
- Causas:
  - en los n.º 31 y 27 basta el segundo nombre de pila y el primer apellido;
  - en el n.º 25 coinciden el primer nombre y un primer apellido corriente, con 17 años entre la actividad del orador y la mención;
  - el cargo que acompaña al nombre («Presidente de la Corte Constitucional», «representante del Fondo de Cesantía») no se contrasta.
- Magnitud: 3 de las 7 menciones de la categoría.
- Reglas que lo evitarían:
  - para enlazar con un orador sin escaño en la biblioteca, exigir el primer nombre de pila, no el segundo;
  - si el primer apellido es corriente o pasan más de diez años entre la actividad del orador y la mención, exigir los dos apellidos;
  - no enlazar cuando la cadena lleva un cargo de otra institución.

### 2. Jefes de Estado resueltos como miembros (1 error: n.º 15)

- «le demos amnistía a Abdalá Bucaram» (María Paula Romo, 2011) se atribuye a Abdalá Bucaram Pulley, asambleísta en 2009-2013.
  - Es su padre, el expresidente Abdalá Bucaram Ortiz. La Asamblea Constituyente rechazó en marzo de 2008 la amnistía que había pedido su familia (https://www.cidob.org/lider-politico/abdala-bucaram-ortiz).
  - Con el criterio de la versión 6.2, debió ir a su nodo externo de jefe de Estado.
- Causa: el apellido suelto «Bucaram» se da al único miembro con escaño que lo lleva ese día, y la palabra anterior, «Abdalá», también es suya. La clave del jefe de Estado coincide entera con el nombre del hijo.
- Fuera de la muestra hay otros tres jefes de Estado en nodos de miembro:
  - «tumbar al presidente Bucaram el 5 de febrero» (2000-01-13) va a Averroes Bucaram por el desempate de quien preside: Averroes preside la sesión de 1986-02-19 de la biblioteca, no la de 2000;
  - «con la presidencia del licenciado Lenín Moreno» (2019-11-05) va al nodo de miembro «LENIN MORENO SOSA»;
  - «el presidente Daniel Noboa Azín» (2025-12-02) va al nodo de miembro de Daniel Noboa, asambleísta en 2021-2023.
- Reglas que lo evitarían:
  - buscar en la lista de jefes de Estado antes que en la de miembros cuando la cadena lleva «presidente», «expresidente» o un tratamiento que no es forma de miembro («licenciado»), o cuando el nombre completo es la clave de un jefe;
  - con un apellido suelto que también es de un jefe de Estado, preferir al miembro solo si lleva forma de miembro o se le habla en segunda persona, y si no, dejar la mención ambigua;
  - aplicar el desempate de quien preside solo a quien preside la misma sesión, como proponía la revisión anterior para «Presidente Gaviria» en Colombia.

### 3. Uso normativo del cargo sin nombre (1 error: n.º 45)

- Abraham Romero (1994-03-17) explica quién puede convocar un Congreso extraordinario: «por usted, señor Presidente del Honorable Congreso Nacional, por cincuenta y dos diputados… o por el señor Presidente de la República. De suerte que, es atribución suya o del Presidente de la República…».
- Se atribuye a Durán-Ballén, pero el orador habla de la competencia del cargo, que vale para cualquier titular.
- Magnitud: al menos cuatro de las 95 menciones de la categoría.
  - En la misma sesión hay otras dos iguales: «o por el señor Presidente de la República» y «una atribución que le corresponde a usted, señor Presidente, al Presidente de la República o a cincuenta y dos diputados».
  - «la primera causal de destitución del Presidente de la República» (2011) es otra.
- Reglas que lo evitarían, las mismas que en Colombia:
  - no atribuir por fecha cuando el cargo va en una enumeración de autoridades unidas por «o»;
  - tampoco cerca de «atribución», «facultad», «le corresponde», «causal» o «de acuerdo con lo establecido en la Ley».

## Menciones que no deberían contar (identidad correcta)

- **Índice de la sesión (n.º 3).**
  - El índice de la sesión solemne de 2005-11-01 («Intervención del ingeniero Diego Monsalve Vintimilla, Diputado por la provincia de…») y el encabezamiento del acta («En la Secretaría actúa el doctor John Argudo Pesántez…») están en una fila atribuida a Wilfrido Lucero. Esa fila da 7 menciones.
  - El filtro del sumario solo reconoce las entradas con puntos suspensivos.
  - Regla: descartar las menciones de las líneas que empiezan por «Intervención del», «Palabras de … a cargo del» o «En la Secretaría actúa», y las que siguen a «ÍNDICE:» o «SUMARIO:».
- **Lecturas del Secretario con la etiqueta mal escrita (n.º 18).**
  - «EL SENOR SECRETARIO», sin eñe, no la reconoce el filtro de la Mesa. Tampoco «EL SEÑOR PRÓSECRETARIO GENERAL TEMPORAL», «EL SEÑOR ' PROSECRETARIO» ni «EL SEÑOR -PROSECRETARIO GENERAL TEMPORAL». Entre todas dan 11 menciones.
  - Regla: aplicar las expresiones de la Mesa a la etiqueta plegada (sin tildes, eñes ni signos sueltos). Es la misma corrección que en Colombia, donde el problema es mucho mayor.
- **Consignas coreadas (n.º 33 y 36).**
  - «Otra voz: fuera Noboa, fuera. Fuera Noboa, fuera. Fuera Noboa, fuera» (2025-09-26): son voces grabadas o del público, no de la oradora. Hay 3 menciones así en la salida.
  - La regla propuesta en la revisión anterior sigue pendiente: tratar lo que sigue a «Otra voz:» como una interrupción sin autor, hasta el siguiente cambio de voz.
- En total, estas tres fuentes dan unas 21 menciones, el 2,4 % de las 875 de la salida.

## Otras observaciones (fuera de la muestra)

- **«John» y «Jhon».** «el doctor John Argudo» (2005-09-20) y «el doctor John Argudo Pesántez» (2005-11-01), entonces secretario del Congreso, van a una persona externa. Es Jhon Milton Argudo Pesántez, diputado de 1998-2003 con intervenciones en la biblioteca (n.º 40), que con el criterio de la versión 6.2 debió ser antiguo miembro. La grafía distinta impide el enlace. Regla: comparar los nombres de pila con sus variantes ortográficas corrientes (Jhon/John, Jhonny/Johnny).
- **Una antigua asambleísta con forma de cargo externo.** «la prefecta Paola Pabón» (2019-12-18) es persona externa aunque fue asambleísta en 2009-2017, legislaturas de la biblioteca. Con el criterio de nodo único debería ser antiguo miembro; la forma «prefecta» la manda a externa por diseño. Conviene decidir qué prevalece.
- **Claves externas de una palabra.** Hay 26 claves (29 menciones de 301 externas) que no son palabra del nombre de ningún orador ni de otra clave. Casi todas son variantes de OCR de «presidente» («presiden», «presi», «presicente», «presiente», «presiderite», «piesidenta», «ptesidente», «posidente», «piebidente») o palabras comunes («rector», «ecuatoriano», «legislativos», «jubilados», «jueces», «temporal», «acta»). Ninguna ha caído en la muestra.
- **Posiciones desplazadas.** Las posiciones (`i`) de 91 de las 875 menciones (10,4 %; eran el 21,2 %) no coinciden con el texto de `biblioteca.json`. En la muestra, los n.º 3, 6, 26, 28, 29, 40 y 45 están corridos entre 2 y 8 caracteres.

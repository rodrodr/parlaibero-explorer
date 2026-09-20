# Ecuador (EC), Congreso Nacional y Asamblea Nacional: precisión de las menciones, versión 6

Muestra de `node muestra_precision6.cjs paises/EC 8 23`: hasta ocho menciones por categoría, 54 en total. La categoría «externa, antiguo orador sin escaño en la biblioteca» solo tiene 6 menciones en la salida, y entran todas.

Cada mención se revisó con su intervención completa en `biblioteca.json`, las intervenciones vecinas y `oradores.json`. Cuando hizo falta saber quién era alguien o si tuvo escaño, se consultaron fuentes externas, citadas en `EC.json`.

## Precisión

Precisión = correctas / (correctas + incorrectas), con las dudosas aparte.

| Categoría | Menciones en la salida | Correctas | Incorrectas | Dudosas | Precisión | No deberían contar |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 863 | 8 | 0 | 0 | 100 % | 0 |
| Miembro, apellido suelto | 45 | 7 | 1 | 0 | 88 % | 2 |
| Miembro, cargo sin nombre (por fecha) | 49 | 5 | 3 | 0 | 63 % | 0 |
| Externa, con cargo o título | 549 | 7 | 1 | 0 | 88 % | 1 |
| Externa, antiguo orador sin escaño | 6 | 2 | 3 | 1 | 40 % | 0 |
| Externa, apellido suelto | 20 | 6 | 2 | 0 | 75 % | 4 |
| Externa, cargo sin nombre (por fecha) | 73 | 7 | 1 | 0 | 88 % | 0 |
| **Total de la muestra** | | **42** | **11** | **1** | **79 %** | **7** |

- Con ocho casos por categoría el margen es amplio: 8/8 es compatible con un 68-100 % y 5/8, con un 31-86 %. El total, 42/53, con un 67-88 % (intervalo de Wilson al 95 %).
- La categoría de antiguos oradores se ha revisado entera (6 de 6), así que su resultado no es una estimación.
- Si se pondera por el número de menciones de cada categoría, la precisión estimada es del 93 %. Pesan los miembros con tratamiento (863), sin errores en la muestra, y las externas con cargo (549).
- La primera revisión, con otra muestra, daba un 52 % (77 % ponderada). Ya no aparecen el apellido suelto que era el nombre de pila, los miembros sin partido tratados como externos ni «Noboa» en 2025 atribuido a Gustavo Noboa. «Presidente Durán Ballén» va ya a la persona externa, aunque queda algún caso con el nombre incompleto (véase «Personas en dos nodos»).
- Criterio aplicado al cargo sin nombre: es correcto si el texto admitiría el nombre del titular sin cambiar de sentido. No lo es en el texto normativo, que vale para cualquier titular (n.º 48). Si se diera por bueno, el total sería 43/53 (81 %).
- Las personas externas se han juzgado con la regla de la tarea: son incorrectas si tenían escaño en esa fecha. Con el criterio de nodo único de la versión 6 (quien tuvo escaño en una legislatura anterior de la biblioteca es siempre el nodo de miembro), serían también incorrectas otras 8:
  - siete menciones de Daniel Noboa, asambleísta en 2021-2023 (n.º 25, 31, 39, 41, 42, 44 y 46);
  - una de Paola Pabón, asambleísta en 2009-2017 (n.º 43).
  - Con ese criterio el total quedaría en 34/53 (64 %). Véase «Personas en dos nodos», al final.

## Errores que quedan, por causa

### 1. Un presidente de la República sin escaño resuelto como miembro (3 errores: n.º 19, 20 y 22)

- «el presidente de la República» en diciembre de 2019 va al nodo de miembro «LENIN MORENO SOSA».
- Lenín Moreno Garcés nunca tuvo escaño, y el nodo ni siquiera lleva su segundo apellido.
- Ese nodo no tiene ningún registro en 2017-2021. El escaño sale de la regla de antes y después, a partir de registros sin partido en 2013-2017 (13 intervenciones del 2017-05-11) y en 2021-2023 (una). En Ecuador `exigePartido` es falso, así que la regla no pide partido.
- Magnitud: 15 menciones van a ese nodo, mientras que «presidente Moreno» da la persona externa «lenin moreno» (16 menciones). La misma persona queda en dos nodos.
- Reglas que lo evitarían:
  - en los cargos sin nombre, aceptar un miembro solo si tiene un registro con partido en alguna legislatura de la biblioteca, nunca por la regla de antes y después;
  - en esa regla, exigir partido en Ecuador; ya lo pedía la primera revisión;
  - guardar en la tabla de jefes el nombre completo («Lenín Moreno Garcés») y rechazar un miembro con otro segundo apellido.

### 2. Enlaces con oradores de otra legislatura por un nombre parcial (2 errores y 1 dudosa: n.º 33, 37 y 34)

- n.º 33: «el Presidente de la Corte Constitucional, Patricio Pazmiño» (2009) se atribuye a Germánico Patricio Pazmiño Corrales, constituyente por Cotopaxi en 2007-2008. Es Patricio Pazmiño Freire.
- n.º 37: «el ingeniero Juan Aguilar, representante del Fondo de Cesantía de la Escuela Superior Politécnica de Chimborazo» (2025) se atribuye a Juan Pablo Aguilar Andrade, abogado y orador de 2008. Es el mismo error que la primera revisión.
- n.º 34, dudosa: «señor Luis Guamán», maestro de Napo en 1994, se atribuye a José Luis Guamán Guaillas, orador del MPD en 1996. Ninguna fuente permite confirmarlo ni descartarlo.
- Causas:
  - en los n.º 33 y 34 basta con el segundo nombre de pila y el primer apellido (fuerza 2);
  - en el n.º 37 coinciden el primer nombre y un primer apellido corriente, con 17 años entre la actividad del orador y la mención;
  - el cargo que acompaña al nombre («presidente de la Corte Constitucional», «representante del Fondo de Cesantía») no se tiene en cuenta.
- Magnitud: la categoría entera tiene 6 menciones, todas en la muestra: tres de esta causa, una de la causa 3 y dos correctas (Roque Sevilla).
- Reglas que lo evitarían:
  - para enlazar con un orador de otra legislatura, exigir el primer nombre de pila (no el segundo) y, si el primer apellido es corriente, los dos apellidos;
  - no enlazar cuando la cadena lleva un cargo de otra institución.

### 3. Un homónimo sin escaño preferido al miembro con escaño (1 error: n.º 38)

- «el honorable José Llerena, alterno» (1994) se atribuye a José Eduardo Llerena, orador de 1996-1998 sin partido.
- Es Pedro José Llerena Olvera, diputado del PRE en 1994-1996. En el mismo turno, «honorable Legislador José Llerena» sí se resuelve a él, y la Presidencia lo lee entre los «Diputados principales» de la comisión.
- Causa: `resolver` recorre los niveles de fuerza de mayor a menor y devuelve «otra legislatura» con el nivel 3 (José Eduardo) antes de mirar el nivel 2, donde está el miembro con escaño (Pedro José). Como «honorable» no es forma de miembro, tampoco entra el atajo `deMiembro`.
- Reglas que lo evitarían:
  - antes de devolver «otra legislatura», comprobar si hay un único candidato con escaño y fuerza de 2 o más;
  - en Ecuador y en Colombia, tratar «honorable» y «H.» como formas de miembro, porque solo se aplican a legisladores.

### 4. El apellido de un jefe de Estado en una llamada a lista (2 errores: n.º 40 y 45)

- n.º 45: «Roldós Aguilera León, presente» (2001) se atribuye a Jaime Roldós; es su hermano León Roldós Aguilera, diputado en 1998-2003.
  - El peso de la persona externa, por sus menciones con cargo, supera al del miembro, al que la biblioteca casi nunca llama solo «Roldós».
  - «Aguilera» cuenta como palabra propia del expresidente, así que la palabra siguiente no frena la atribución.
- n.º 40: una llamada a lista de 2000 con el OCR desordenado («Andrade Guerra / Arteaga / Yolanda») se atribuye a Rosalía Arteaga, presidenta cinco días en 1997.
  - `forzar` aparta al único diputado de 1998-2003 con ese apellido (Raúl Andrade Arteaga).
  - La comprobación de la palabra anterior y de la siguiente no cruza los saltos de línea.
- Reglas que lo evitarían:
  - aplicar al apellido suelto el filtro de votaciones y llamadas a lista;
  - incluir los saltos de línea en la comprobación de las palabras vecinas;
  - si un miembro con escaño lleva ese apellido y las palabras vecinas son suyas («León»), atribuirlo al miembro;
  - no usar `forzar` frente a un miembro con escaño, y no buscar el apellido suelto de jefes de mandato breve.

### 5. Palabras que no son personas (1 error: n.º 26)

- «Alain Bustamante, Presidente Trabajadores, Universidad Central» da la persona externa «Trabajadores».
- Magnitud: 38 claves de una sola palabra (50 menciones) no son palabra de ningún orador ni de otra clave. Además de «trabajadores» están «jurídico», «temporal», «rector», «ecuatoriano», «municipalidad» o «clausura», y variantes de OCR de «presidente» y «presidenta»: «presi», «presiden», «presiente», «presicente», «posidente», «piebidente», «ptesidenta»…
- Reglas que lo evitarían:
  - las mismas que en Colombia: una clave de una palabra solo si es apellido de algún orador o de una persona nombrada completa;
  - descartar además las palabras a distancia de edición 2 o menos de una forma de tratamiento o de cargo.

### 6. Un tratamiento abreviado y un escaño que sale de la junta preparatoria (1 error: n.º 9)

- «Solicita remoción Jefe Personal Dirección Registro Civil Lcda. Santillán» (1982, un telegrama leído por el Secretario) se atribuye al diputado Edgar Santillán.
- «Lcda.» no está entre las formas. Por eso la cadena no se detecta y el apellido suelto no mira el género.
- El diputado solo tiene escaño en 1979-1984 por cinco intervenciones del 9-8-1984, de la junta preparatoria del Congreso siguiente.
- Magnitud: 455 registros de `oradores.json` de las legislaturas hasta 1998 tienen toda su actividad entre el 25 de julio y el 9 de agosto del último año, es decir, en las juntas preparatorias del Congreso entrante. Solo dos menciones dependen únicamente de ellos: esta y «señor Maldonado» (1993).
- Reglas que lo evitarían:
  - añadir «lcdo.», «lcda.» y otras abreviaturas corrientes («abg.», «econ.», «mgs.») a las formas de tratamiento;
  - asignar esos registros de agosto a la legislatura entrante al construir `oradores.json`.

### 7. Uso normativo del cargo sin nombre (1 error: n.º 48)

- El Secretario lee un artículo de ley: «la Presidenta o el Presidente de la República lo promulgará como decreto ley». Se atribuye a Daniel Noboa.
- Regla: no atribuir por fecha dentro de la fórmula «la Presidenta o el Presidente» ni en un artículo citado entre comillas, como en Colombia.

## Menciones que no deberían contar (identidad correcta)

- Listas y votaciones: «Simón Bustamante, ausente» (n.º 14). Los n.º 40 y 45, además de erróneos, están en una llamada a lista. El filtro de votaciones solo se aplica a las menciones con tratamiento o cargo.
- Firmas leídas por el Secretario: los asambleístas que suscriben un informe (n.º 13) y el secretario general al pie de un acuerdo (n.º 32).
- Consignas coreadas (n.º 44 y 46):
  - la transcripción las marca «Otra voz: fuera Noboa, fuera. Fuera Noboa, fuera. Fuera Noboa, fuera»;
  - el detector atribuye las tres menciones a quien tiene la palabra, que no las dice;
  - regla: tratar lo que sigue a «Otra voz:» como una interrupción sin autor, hasta el siguiente cambio de voz.

## Otras observaciones (no cuentan como error)

### Personas en dos nodos

- **Daniel Noboa.**
  - Fue asambleísta en 2021-2023 (EC00234, 26 intervenciones), pero sus 42 menciones como presidente van a la persona externa «daniel noboa»: 17 con cargo, 17 de cargo sin nombre y 8 de apellido suelto.
  - El reparto de nombre y apellidos toma «Gilchrist», de «Roy-Gilchrist», por primer apellido, así que «Daniel Noboa» no alcanza fuerza 2.
- **Paola Pabón.** Tiene el mismo problema: «Verenice» pasa por primer apellido, así que «Paola Pabón» no casa con el nodo EC01073 y sus 7 menciones de 2019 van a una persona externa. Las que llevan la forma «prefecta» serían externas en cualquier caso, por diseño de la versión 6.
- **Presidentes con registros propios.**
  - Durán-Ballén: 27 menciones van al nodo de miembro, casi todas de cargo sin nombre en 1993-1994, y 7 a la persona externa. En la misma sesión de 1994-03-15, cinco «Presidente Sixto Durán Ballén» van a la persona externa y un «Presidente Sixto Durán», diez filas después, al miembro: la regla de jefes no reconoce el apellido incompleto.
  - Mahuad: 7 van al nodo de miembro y 4 a la persona externa.
  - Moreno: 15 al nodo de miembro y 16 a la persona externa.
- Reglas:
  - con cuatro palabras o más en el nombre, sin contar partículas, tomar las dos últimas como apellidos;
  - decidir una sola vez el nodo de cada jefe de Estado que tuvo escaño, para todas sus formas de mención.

### Escaños por el discurso de posesión

- Febres-Cordero, Mahuad y Durán-Ballén salen «sentados» en la legislatura en la que presidían porque `oradores.json` recoge como intervenciones con partido sus discursos de posesión o de informe (1984-08-10, 1998-08-10 y 1992-08-10).
- El nodo es el de la persona correcta, porque los tres fueron diputados en otro momento, pero la marca debería ser «antiguo miembro» o «aún sin escaño».
- Mahuad fue diputado en 1986-1988 y 1990-1992, legislaturas que no están en la biblioteca. Su escaño en ella sale de las juntas preparatorias de 1986 y 1990, asignadas a 1984-1986 y 1988-1990. Si esos registros pasaran a la legislatura entrante, con el criterio de la versión 6 sería persona externa.
- Regla: no dar escaño a quien ocupa la jefatura del Estado en esa fecha.

### Turnos de la Secretaría

- 20 de las 54 menciones de la muestra salen de turnos del Secretario o del Prosecretario: lecturas de informes, tablas de documentos, telegramas, considerandos y listas.
- En toda la salida son el 50,8 % de las 1.725 menciones.

### Posiciones desplazadas

- En Ecuador las posiciones (`i`) de 365 menciones (el 21,2 %) no coinciden con el texto de `biblioteca.json`.
- El detector une los guiones de fin de línea («Presiden- te», «Asam- bleísta») antes de buscar, y guarda las posiciones del texto ya modificado.
- Cualquier resaltado de la mención en la interfaz saldría corrido.
- Regla: guardar la correspondencia de posiciones con el texto original, o calcular las posiciones sobre él.

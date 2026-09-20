# Menciones en Perú (PE): precisión de la versión 6

Muestra: `node muestra_precision6.cjs paises/PE 8 23` sobre `paises/PE/menciones6.json`. Hasta 8 menciones por categoría, con semilla fija: 44 en total, porque las categorías de miembro por cargo sin nombre y de antiguo orador externo solo tienen 2 cada una. Cada mención se ha juzgado con la intervención completa, los turnos de la sesión y `oradores.json`. El veredicto, el motivo y la marca `no_deberia_contar` de cada una están en `revision6/PE.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 1.375 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 53 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, cargo sin nombre (por fecha) | 2 | 2 | 2 | 0 | 0 | 100 % |
| Externa, con cargo o título | 697 | 8 | 8 | 0 | 0 | 100 % |
| Externa, antiguo orador sin escaño en la biblioteca | 2 | 2 | 1 | 1 | 0 | 50 % |
| Externa, apellido suelto | 185 | 8 | 8 | 0 | 0 | 100 % |
| Externa, cargo sin nombre (por fecha) | 155 | 8 | 8 | 0 | 0 | 100 % |
| Total | 2.469 | 44 | 43 | 1 | 0 | 98 % |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- **Margen.** Con tan pocos casos, el margen es amplio (intervalo de Wilson al 95 %):
  - 8 de 8 es compatible con una precisión real desde el 68 %.
  - El total, 43 de 44, entre el 88 % y el 100 %.
- **La ponderación engaña.** Ponderada por el tamaño de cada categoría, la estimación roza el 100 %, porque el único error cae en una categoría de 2 menciones. Pero el mismo mecanismo produce al menos otras 7 menciones erróneas en la primera categoría, fuera de la muestra (patrón 1).
- **Identidad correcta, pero la mención no debería contar.** Afecta a 12 de las 43 correctas:
  - 6 de los 8 apellidos sueltos de miembros: 4 listas leídas por el relator (n.º 9, 10, 12 y 14) y 2 votaciones nominales (n.º 13 y 16).
  - 1 oficio de cambio de comisiones leído por el relator (n.º 3).
  - 5 usos genéricos de «el Presidente de la República» (n.º 17, 18, 37, 38 y 41).

  Si los usos genéricos se contaran como error, los cargos sin nombre quedarían en 0 de 2 (miembro) y 5 de 8 (externa).
- **Los errores de la revisión anterior están corregidos:**
  - Ochoa y Pazo, accesitarios sin partido, ya son miembros.
  - «congresista Bedoya» en 2011 ya es Javier Bedoya de Vivanco.
  - «Salgado Rubianes de Paredes» se resuelve sin el apellido de casada.
  - La categoría de antiguo orador externo ha pasado de 22 menciones a 2.

## Errores que quedan

### 1. Un segundo nombre tomado por primer apellido: gana un homónimo sin escaño (n.º 28; 7 más fuera de la muestra)

El 7-5-2003 se dice: «La señora Alfaro, congresista de Ancash, acaba de decirnos que es falso lo que dice esa carta». La mención se atribuye a María Teresa Vitor Alfaro, persona externa con una sola intervención en PE99.

Es Maruja Hermelinda Alfaro Huerta, congresista de Perú Posible en PE37 y candidata por Áncash en 2006 (https://portal.jne.gob.pe/portal_documentos/files/informacionelectoral/estadisticaelectoral/1_5.pdf). Había hablado en esa misma sesión: «Como congresista de Ancash y del Perú…» (PE004030100144).

Causas:

- **Nombre mal partido.** Al separar nombre y apellidos, solo cuenta como nombre de pila la palabra que abre el nombre de dos oradores o que figura en `nombres_pila.json`. «Hermelinda» no cumple ninguna de las dos condiciones. Así, su apellido de referencia sale «hermelinda», y «Alfaro» solo le da fuerza 1. A María Teresa Vitor Alfaro, en cambio, «Vitor» sí le cuenta como nombre (está en el léxico común), y «Alfaro» le da fuerza 2.
- **Orden del desempate.** `resolver` devuelve el único candidato de fuerza 2, sin escaño («otra legislatura»), antes de mirar la fuerza 1, donde está la congresista sentada. Como tampoco tuvo escaño en la biblioteca, acaba como persona externa con `antiguo`.
- **Aposición ignorada.** «congresista de Ancash», detrás del nombre, no cuenta como forma de miembro: `deMiembro` solo mira la cadena de delante.

El mismo mecanismo actúa fuera de la muestra, en la categoría de miembros con tratamiento o cargo:

- **«congresista Estrada»** (2 veces, 18-7-2011) → Daniel Federico Estrada Pérez, con escaño hasta 2003. En esa sesión habla Aldo Vladimiro Estrada Choque (UPP, 1.930 intervenciones en PE38), cuyo apellido de referencia sale «vladimiro».
- **«doctor Guerra-García» y «señor congresista Guerra-García»** (4-3-1999) → Hernando Guerra García Campos, «aún sin escaño» (congresista desde 2021). En esa sesión habla Roger Antenor Guerra García Cueva (UPP, PE35), con referencia «antenor».
- **«congresista Luna»** (3 veces, 2-10-2025) → José Luis Luna Morales (PE41). En esa sesión habla José León Luna Gálvez (Podemos Perú, PE42), con referencia «leon».

Por la misma causa («Dionicio» tomado por apellido), Víctor Joy Way sigue fuera de su nodo de miembro. Véase «Una persona en varios nodos», más abajo.

La revisión anterior ya pedía este desempate (el caso Bedoya). v6 lo aplica solo en la rama `deMiembro` y con fuerza 2 o más, y aquí los candidatos sentados tienen fuerza 1.

Qué lo evitaría:

- Tomar el apellido de referencia de la etiqueta del orador en la biblioteca («La señora ALFARO HUERTA (PP)», «El señor ESTRADA CHOQUE (UPP)»). Sin etiqueta, en un nombre de cuatro palabras sin partículas, tomar las dos últimas como apellidos.
- En `resolver`, antes de devolver un candidato sin escaño, buscar en cualquier nivel un único miembro sentado que lleve esa palabra entre sus apellidos. Entre varios, preferir a quien habla en la sesión (`hablaEn`). En la rama `deMiembro`, admitir también candidatos sentados de fuerza 1.
- Tratar como forma de miembro una aposición «, congresista (de …)» justo detrás del nombre.

## Sin efecto en el veredicto

- **Votaciones nominales en la pasada de apellidos sueltos** (n.º 13 y 16). En la primera pasada (`procesar`), v6 descarta el nombre seguido de «a favor» o «en contra». La pasada de sueltos (`probar`) no tiene ese filtro. Por eso generan menciones los voceros que votan por su bancada nombre por nombre: «Pérez Ochoa, en contra», «Pérez Ochoa (A favor)». Son 4 de los 53 apellidos sueltos de miembros del país. Regla: aplicar en `probar` la misma comprobación de lo que sigue al nombre.
- **Lecturas del relator** (n.º 3, 9, 10, 12 y 14). 32 de los 53 apellidos sueltos de miembros salen de turnos sin orador. En la muestra hay:
  - 4 listas: autores de pedidos, proyectos y mociones, y una «Relación de congresistas impedidos de votar»;
  - 1 oficio de cambio de comisiones que nombra dos veces a la misma persona.

  Las identidades son correctas, pero no son alusiones de un orador. Regla: descartar o marcar las menciones de los turnos sin `id_dep`, al menos las enumeraciones.
- **Usos genéricos del cargo** (n.º 17, 18, 37, 38 y 41). Son 5 de los 10 cargos sin nombre juzgados. Hablan del cargo en abstracto: la reelección o la revocatoria del presidente, sus facultades o su irresponsabilidad según la Constitución, o la competencia que discute un proyecto. La persona atribuida era la titular ese día. La regla es la misma que en Chile: no atribuir cuando la oración cita una norma o habla del cargo en abstracto, o marcar la mención.
- **Cargo sin nombre «de entonces»** (fuera de la muestra). «el Presidente de la República de entonces comunicó que renunciaba a gobernar en todo el período que le restaba» (9-6-2003) se atribuye a Alejandro Toledo. La frase se refiere al momento de la «notoria presencia» de Montesinos en el Perú, en 2000: es Fujimori. La regla es la del patrón 3 de Chile: no atribuir tras «de la época» o «de entonces».
- **Una persona en varios nodos.**
  - **Paniagua.** Su nodo de miembro recoge los dos cargos sin nombre de la muestra y «don Valentín Paniagua Corazao» (2006). Dos apellidos sueltos, de 2015 y 2021, van al nodo externo «valentin paniagua». La pasada de sueltos envía a los jefes de Estado a una persona externa salvo que tengan escaño ese día.
  - **Joy Way.** Tiene 3 menciones como miembro (1996). En 2003 tiene 12 como persona externa, repartidas en «victor joy way rojas» y «joy way», aunque tuvo escaño en PE35 (patrón 1).
  - **Cuculiza.** El 7-5-2003, «señora Luisa María Cuculiza Torre» y «señora Cuculiza Torre» van a su nodo de miembro «aún sin escaño» (3 menciones). «señora Cuculiza», «ministra Luisa María Cuculiza Torre» y los apellidos sueltos van a una persona externa (12). Siguen las reglas de v6: el escaño posterior solo vale con el nombre completo, y «ministra» va por la rama `deGobierno`. Pero dejan a la misma persona en dos nodos el mismo día.
  - **Montesinos:** «montesinos» (47 menciones) y «vladimiro montesinos» (1).
  - **Boluarte:** «dina boluarte» (12), «dina ercilia boluarte zegarra» (4) y «boluarte» (1).

  Reglas:
  - Para los jefes de Estado y los ministros con escaño anterior, la misma que en Chile: enviarlos al nodo de miembro con `antiguo`.
  - Para el escaño posterior, llevar al mismo nodo, en la misma sesión, las menciones cortas de quien ya se ha resuelto con el nombre completo.
  - Para las claves, unir una corta con una larga cuando la corta es subsecuencia de la larga y comparten nombre de pila y apellido.
- **Falsos vocativos** (n.º 9, 10 y 12). Son elementos de listas separados por comas, marcados «se dirige».
- **Claves de una palabra** (n.º 26, «francisco»; n.º 32, «montesinos»). En esta biblioteca identifican bien a la persona, pero son frágiles: cualquier otro «Francisco» con forma externa iría al mismo nodo que el papa.

## Fuentes consultadas

- Maruja Hermelinda Alfaro Huerta, candidata de Perú Posible por Áncash en las elecciones al Congreso de 2006 (Jurado Nacional de Elecciones): https://portal.jne.gob.pe/portal_documentos/files/informacionelectoral/estadisticaelectoral/1_5.pdf (n.º 28)
- Las fechas de mandato presidencial son las de `formas_paises.cjs` (tabla contrastada). El resto de identificaciones sale del propio texto de la sesión y de `oradores.json`.

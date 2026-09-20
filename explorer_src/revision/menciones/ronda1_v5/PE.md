# Menciones en Perú (PE): revisión de la precisión

Muestra: `node muestra_precision.cjs paises/PE 10 7` sobre `paises/PE/menciones.json` (2.378 menciones). Hasta 10 por categoría con semilla fija: 47 menciones (la categoría «miembro, apellido suelto» solo tiene 7), juzgadas a mano con la intervención completa, los turnos vecinos de la sesión y `oradores.json`. El veredicto y el motivo de cada una están en `revision/PE.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 1.414 | 10 | 10 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 7 | 7 | 6 | 1 | 0 | 86 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | sin casos |
| Externa, con cargo o título | 695 | 10 | 8 | 2 | 0 | 80 % |
| Externa, antiguo miembro | 22 | 10 | 0 | 10 | 0 | 0 % |
| Externa, apellido suelto | 182 | 10 | 10 | 0 | 0 | 100 % |
| Total | 2.320 | 47 | 34 | 13 | 0 | 72 % |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- El total da el mismo peso a cada categoría. Ponderando por su tamaño en el país, la estimación es del 93 %; con 10 casos por categoría, 10 de 10 es compatible con una precisión real desde el 72 % (intervalo de Wilson al 95 %).
- La muestra está concentrada: 7 de las 10 de «antiguo miembro» son la misma persona en la misma sesión (Ochoa, 19-5-2003), y las 10 de «externa, apellido suelto» son de sesiones de 2003 (Fujimori, Montesinos, Duthurburu, Mantilla).
- Perú no tiene cargos sin nombre en `formas_paises.cjs`.
- Los 6 aciertos de «miembro, apellido suelto» son casuales (patrón 4).

## Patrones de error

### 1. Congresistas sin partido en `oradores.json`, tratados como sin escaño (8 errores: n.º 28, 30, 32, 33, 35, 36, 37 y 34)

- Teófilo Mario Ochoa Vargas (7 menciones del 19-5-2003): 282 intervenciones en PE37 con la etiqueta «OCHOA VARGAS (UPD)»; se incorporó en abril de 2003 como accesitario, tras la muerte de Daniel Estrada (https://es.wikipedia.org/wiki/Mario_Ochoa_Vargas). En la misma sesión lo llaman «el congresista Mario Ochoa».
- José Bernardo Pazo Nunura (n.º 34, 2025): 159 intervenciones en PE42 como «PAZO NUNURA (SP)»; juró el 26-1-2023 en reemplazo de Wilmar Elera (https://es.wikipedia.org/wiki/José_Pazo_Nunura).

Los dos son accesitarios y a ninguno le consta partido en `oradores.json`. Causa: `senta()` exige `L.partido` cuando más del 70 % de los oradores del país tiene partido (`conPartidoPais`). Sin él, `resolver()` los da por «otra legislatura» y, como tampoco constan con escaño en ninguna legislatura de la biblioteca (`tuvoEscano`), acaban como persona externa con `antiguo`. En `oradores.json` hay 8 pares orador–legislatura con 20 o más intervenciones y sin partido (Olivera, Hildebrandt, Moyano y Ochoa en PE37; Dammert en PE39; Pazo, Orué y Zegarra en PE42), y la regla los trata a todos como sin escaño. En todo el país, 21 de las 22 menciones de la categoría (las 10 de la muestra incluidas) son de Ochoa (13), Bedoya (7, patrón 2) y Pazo (1); la restante, Yoshiyama en 1996 («como Ministro de la Presidencia»), es correcta.

Qué lo evitaría:

- En `senta()`, dar por sentado a quien tiene en esa legislatura una actividad mínima (por ejemplo, 20 intervenciones) aunque falte el partido, o completar el partido desde la etiqueta del orador en la biblioteca («(UPD)», «(SP)»).
- Dar peso a la forma: «congresista X», sin «ex», afirma un escaño en esa fecha; entre los candidatos, preferir al que interviene en esa sesión o en esa legislatura.

### 2. Nombre mal partido y homónimo sin escaño: «congresista Bedoya» (2 errores: n.º 29 y 31)

En julio de 2011 (PE38) el congresista es Javier Bedoya de Vivanco, con 625 intervenciones en PE38, que habló en esa misma sesión: las dos menciones remiten a sus intervenciones PE005047400108 («aun cuando sea a última hora de este Parlamento») y PE005047400010 (los abogados como jefes de relaciones industriales). El detector elige a Luis Guillermo Bedoya de Vivanco, que solo figura en PE99.

Causas:

- En «JAVIER A. BEDOYA DE VIVANCO» la inicial «A.» se toma como primer apellido (`apRef` = «a»), así que «Bedoya» solo le da fuerza 1; a Luis Guillermo, fuerza 2.
- `resolver()` devuelve el único candidato de fuerza 2, sin escaño, como «otra legislatura» antes de mirar los de fuerza 1 con escaño.

La misma partición errónea (un segundo nombre de pila poco frecuente tomado como primer apellido: «Dionicio», «Milagros») explica que los n.º 19 (Joy Way) y 22 (León Romero), correctos como externas, no se enlacen con su nodo de miembro.

Qué lo evitaría:

- Al separar nombre de pila y apellidos, ignorar las iniciales (palabras de una letra) y tomar el apellido de referencia de la etiqueta del orador en la biblioteca («El señor BEDOYA DE VIVANCO (UN)»), en lugar de deducirlo de la frecuencia de los nombres de pila.
- Desempate: antes de devolver un candidato sin escaño, buscar uno con escaño en un nivel de fuerza menor, y preferir a quien habla en la sesión (`hablaEn`).

### 3. Apellido de casada y acotaciones de la Presidencia (2 errores: n.º 20 y 24)

«—Asume la Presidencia la señora Luz Salgado Rubianes de Paredes» (1996) y «—Asume la Presidencia la señora Mercedes Cabanillas Bustamante de Llanos» (2003): las dos tenían escaño (1.170 intervenciones en PE35 y 1.895 en PE37). `candidatos()` exige que todas las palabras de la mención estén en el nombre del orador (`subsecuencia`), y en `oradores.json` no figura el apellido de casada; sin candidato, la mención pasa a persona externa. En todo el país hay 7 externas de la forma «señora … de X»; 5 (las dos de la muestra incluidas) son congresistas con escaño: Chávez Cossío «de Ocampo» en 1996, Salgado tres veces y Cabanillas.

Qué lo evitaría:

- Si el nombre termina en «de + Apellido» y no empareja, reintentar sin esa terminación (con forma o artículo femenino).
- Tratar como acotación la frase que empieza con raya y sigue con «Asume la Presidencia», «Reasume la Presidencia», «Ingresa», «Se suspende», «Se reanuda»…: `enAcotacion` solo reconoce los paréntesis, y en los diarios peruanos estas acotaciones van con raya.

### 4. Los apellidos sueltos de miembros se buscan por el nombre de pila (1 error: n.º 12)

«Cementerio El Ángel» se atribuye a Ángel Javier Velásquez Quesquén. Es la misma causa que en Chile: el bucle de `apMiembro` toma `partes[0]`, que en «NOMBRE APELLIDOS» es el nombre de pila. Las 7 menciones de la categoría son «Guido» (3), «Daniel» (2), «Yonhy» y «Angel»; las 6 correctas son nombres completos («Guido Bellido», «Daniel Abugattás»).

Qué lo evitaría: buscar el apellido (la palabra del nombre cuyo plegado es `ap`) y nunca el nombre de pila solo; como protección adicional, descartar la aparición precedida de un nombre común de lugar («cementerio», «colegio», «avenida»…).

### 5. Sin efecto en el veredicto: una misma persona repartida en varios nodos

- «dina boluarte» (7), «dina ercilia boluarte zegarra» (4; n.º 18) y «boluarte» (1); «montesinos» (59) y «vladimiro montesinos» (1). La unión de claves solo junta la corta con la larga cuando la corta es su principio, y la de una palabra usa `refDe`, que falla cuando el primer nombre no está en la lista de nombres de pila («vladimiro»).
- Joy Way (n.º 19) y León Romero (n.º 22) quedan fuera de su nodo de miembro (patrón 2).

Qué lo evitaría: unir dos claves cuando la corta es subsecuencia de la larga y comparten nombre de pila y apellido; en las de una palabra, aceptar la clave larga que termina en ella aunque su primera palabra no conste como nombre de pila.

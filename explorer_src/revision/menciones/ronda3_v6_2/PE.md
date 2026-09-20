# Menciones en Perú (PE): precisión de la versión 6.2

Muestra: `node muestra_precision7.cjs paises/PE 8 31` sobre `paises/PE/menciones6_2.json`. Hasta 8 menciones por categoría, con semilla fija: 48 en total, porque la categoría de miembro por cargo sin nombre está vacía. Cada mención se ha juzgado con la intervención completa, los turnos de la sesión y `oradores.json`, y con una fuente externa cuando hacía falta saber quién era alguien o quién ocupaba un cargo. El veredicto, el motivo y la marca `no_deberia_contar` de cada una están en `revision7/PE.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 1.236 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 47 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | sin casos |
| Externa, con cargo o título | 604 | 8 | 8 | 0 | 0 | 100 % |
| Externa, antiguo orador sin escaño en la biblioteca | 10 | 8 | 8 | 0 | 0 | 100 % (*) |
| Externa, apellido suelto | 183 | 8 | 8 | 0 | 0 | 100 % |
| Externa, cargo sin nombre (por fecha) | 114 | 8 | 3 | 5 | 0 | 38 % |
| Total | 2.194 | 48 | 43 | 5 | 0 | 90 % |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

(*) Siete de las ocho son congresistas con escaño ese día que más tarde fueron jefes de Estado: Sagasti, Balcázar y Jerí. Van a su nodo externo solo por la regla de los jefes de Estado («siempre su nodo externo»), y se han juzgado con ella. Si la regla debiera aplicarse solo desde el mandato, serían siete errores: la categoría quedaría en 1 de 8 y el total, en 36 de 48 (75 %). Véase «Cuestión de criterio», más abajo.

- **Margen.** Con 8 casos por categoría, el intervalo de Wilson al 95 % es amplio: 8 de 8 es compatible con una precisión real desde el 68 %; 3 de 8, entre el 14 % y el 69 %. El total, 43 de 48, entre el 78 % y el 95 %. Ponderando cada categoría por su tamaño en el país, la estimación es del 97 %.
- **Por qué baja la categoría de cargos sin nombre.** Con el criterio de v6.2, el uso del cargo en abstracto ya es un error. Los cinco errores de la muestra son de este tipo. En la revisión anterior, los cinco usos genéricos de su muestra contaban como correctos, con la marca de que no debían contar.
- **Identidad correcta, pero la mención no debería contar.** Afecta a 5 de las 43 correctas:
  - 3 votaciones nominales que lee el vocero de cada bancada (n.º 13, 14 y 16);
  - 1 duplicado exacto: el mismo tramo sale dos veces (n.º 20);
  - 1 automención de un orador sin escaño: Camet habla de Camet (n.º 37).
- **Los errores de la revisión anterior están corregidos:**
  - «la señora Alfaro, congresista de Ancash» ya es Maruja Alfaro Huerta.
  - «congresista Estrada» (2011) es Aldo Estrada Choque; «doctor Guerra-García» (1999), Roger Guerra García Cueva; «congresista Luna» (2025), José León Luna Gálvez.
  - «el Presidente de la República de entonces» ya no se atribuye por fecha.
  - Los apellidos sueltos de Paniagua van, como el resto de sus menciones, a su nodo externo.

## Errores que quedan

### 1. Usos del cargo en abstracto atribuidos al presidente del día (n.º 42, 43, 45, 46 y 48)

Las cinco son «el Presidente de la República» en frases sobre las atribuciones del cargo, no sobre quien lo ocupaba:

- n.º 42 (2003): cita el artículo 118, inciso 8, de la Constitución («las leyes no pueden ser… transgredidas por el Presidente de la República»), a propósito de un beneficio que dio el gobierno de Fujimori. Se atribuye a Toledo.
- n.º 43 (2006): se discute si pasar al ministro de Defensa una facultad del cargo («si le aliviamos o no la carga de trabajo al Presidente de la República»). Se atribuye a Alan García.
- n.º 45 (2006): «esa responsabilidad que corresponde al Presidente de la República como Jefe Supremo de las Fuerzas Armadas». Se atribuye a Alan García.
- n.º 46 (1999): el indulto como figura jurídica («para que sea indultado un reo, el Presidente de la República solamente tiene seis meses…»). Se atribuye a Fujimori.
- n.º 48 (2006): «La Constitución… dice que corresponde al Presidente de la República dar cuenta al Congreso de los decretos de urgencia». Se atribuye a Alan García.

Tres de los cinco (n.º 43, 45 y 48) son de la misma sesión, el 18-10-2006. Ese día se debatió quién autoriza el ingreso de tropas extranjeras, de modo que el cargo aparece sobre todo como titular de competencias.

Por qué pasan los filtros de v6.2 (`cargosSinNombre`, líneas 736-755 de `detectar6_2.cjs`):

- Los verbos solo se miran justo después del cargo.
- El filtro de normas exige «artículo» en singular seguido del número: en el n.º 42 el texto dice «artículos 74.° … y 118.°, inciso 8)» y no lo detecta.

Qué lo evitaría: la misma regla propuesta para Chile. Se mira la oración entera y no se atribuye cuando en ella hay:

- vocabulario de norma: Constitución, artículo o artículos con número, inciso, establece, dispone, dice que, corresponde, compete, facultad, atribución, función;
- un verbo deóntico (debe, deberá, puede, podrá);
- una pasiva de nombramiento («designado por»).

Probada sobre la muestra, aparta los cinco errores, aunque el n.º 43 solo por casualidad («en función del acuerdo de nuestras bancadas»). Aparta también un acierto, el n.º 47 («¡Cómo se puede cuestionar… la explicación que… nos da… el Presidente de la República!»). Por eso el verbo deóntico debe estar en la cláusula del cargo. En el país, la expresión marca 44 de los 114 cargos sin nombre: un recuento aproximado, que da el orden de magnitud.

## Cuestión de criterio: jefes de Estado que eran congresistas en ejercicio (n.º 25-30 y 32)

Siete menciones de la categoría «antiguo orador sin escaño» son de congresistas que tenían escaño ese día:

- **Francisco Sagasti.** Congresista del Partido Morado desde marzo de 2020 y presidente de la República desde el 17-11-2020 (https://es.wikipedia.org/wiki/Francisco_Sagasti). Mención de agosto de 2020.
- **José María Balcázar.** Congresista de Perú Libre y presidente de la República desde el 18-2-2026 (https://es.wikipedia.org/wiki/Gobierno_de_Jos%C3%A9_Mar%C3%ADa_Balc%C3%A1zar). Menciones de octubre de 2021, más de cuatro años antes de su mandato.
- **José Jerí.** Presidente del Congreso desde el 26-7-2025 y de la República del 10-10-2025 al 17-2-2026 (https://es.wikipedia.org/wiki/Jos%C3%A9_Jer%C3%AD). Menciones de septiembre y del 2 de octubre de 2025.

Las identidades son correctas, pero la categoría apenas contiene antiguos oradores sin escaño. De sus 10 menciones, 9 son de jefes de Estado: las siete de congresistas con escaño ese día, el n.º 31 («señor Sagasti», agosto de 2021, ya sin escaño) y, fuera de la muestra, «don Valentín Paniagua Corazao» (2006). Solo «ingeniero Yoshiyama» (1996), congresista del CCD, una legislatura que no está en la biblioteca, responde al nombre de la categoría.

El mecanismo está en `senta` (líneas 328-338). Quien fue jefe de Estado en algún momento de una legislatura no tiene escaño en toda ella: `enMandatoLeg`, en la línea 330, pensado para el presidente que habla en el traspaso. Como PE41 y PE42 son las únicas legislaturas de la biblioteca de los tres, `escanoEnBiblioteca` da `null`, y `clasificar` (líneas 586-590) los manda a persona externa como «orador sin escaño».

En el país son 10 menciones con escaño ese día: Sagasti 3, Balcázar 4 y Jerí 3. Pero los tres son oradores muy activos como miembros (Jerí, 1.945 intervenciones en PE42; Balcázar, 852). Así, en la red hablan desde su nodo de miembro y se les menciona en otro nodo.

La regla del código no es «siempre» ni «desde el mandato», sino «en la legislatura del mandato». En cambio, un diputado cuya presidencia cae en otra legislatura, como Boric en Chile, sigue siendo miembro cuando se le menciona en sus años de diputado, porque la condición de la línea 330 no se cumple.

Qué lo evitaría, según lo que se quiera:

- **Si «siempre» es literal:** aplicar el nodo externo a los jefes de Estado (`jefeDeOrador`) en todas las legislaturas.
- **Si vale desde el mandato:** sustituir `enMandatoLeg(d, leg)` por una comprobación con la fecha de la mención. Es jefe de Estado si la fecha es igual o posterior al inicio del mandato; antes, es un miembro más. Así, Balcázar sería miembro en 2021 y persona externa desde febrero de 2026.

## No deberían contar (identidad correcta)

### 1. Votaciones nominales leídas por los voceros (n.º 13, 14 y 16)

En la sesión del 24-8-2020 (devolución de aportes a la ONP), cada vocero traslada el voto de su bancada nombre por nombre:

- «Congresistas: Alarcón Tejada, de Arequipa; Apaza Quispe, Puno…»;
- «A favor: Alonzo Fernández, …, Trujillo Zegarra…»;
- «Alarcón Tejada, Apaza Quispe… Todos a favor».

v6.2 descarta en `probar` (línea 941) el nombre seguido de «a favor» o «en contra». Aquí, en cambio, el voto se dice una sola vez, al principio o al final de la enumeración. En el país son unas 11 menciones de miembros, 9 de ellas apellidos sueltos: casi uno de cada cinco de los 47 apellidos sueltos de miembros.

Qué lo evitaría: tratar como votación toda enumeración de tres o más nombres introducida, en el mismo párrafo o en la línea anterior, por «A favor:», «En contra:», «Abstención:», «vota(mos, n) a favor/en contra» o «Congresistas:» tras un voto, o cerrada por «Todos a favor» o «Todos en contra».

### 2. El mismo tramo, dos veces (n.º 20)

«La participación simultánea del ex Presidente Fujimori y de los ex Ministros Carlos Bergamino, Carlos Boloña y Luis Federico Guevara…» genera dos veces «Carlos Boloña» y dos veces «Luis Federico Guevara»:

- una, por la lista tras el plural «Ministros» (cargo «ministro»);
- otra, por `RX_INST`, que toma «Presidente Fujimori y de los ex Ministros Carlos Bergamino» por «cargo + institución» seguido de «, Carlos Boloña y Luis Federico Guevara» (cargo «presidente»).

El bucle de `RX_INST` (líneas 727-734) solo comprueba `vistos`, que recoge el final de las coincidencias de `RX_CADENA` y `RX_PLURAL`, no el de los elementos de las listas. La segunda persona tras «y» se procesa otra vez porque el tramo de la pareja entera ya figura en `hechos` (la condición de `segunda`, línea 706). En el país son 4 menciones duplicadas (ninguna en Chile).

Qué lo evitaría: en el bucle de `RX_INST`, saltar la coincidencia si el tramo del nombre no está libre (`!libre(i, i + x[2].length)`), y no admitir en el hueco de la «institución» palabras con mayúscula ni «y de los».

### 3. Automención de un orador sin escaño (n.º 37)

Habla el exministro Jorge Camet Dickmann, en su defensa, y cita la pregunta de la comisión: «¿…la participación de Camet en la rebaja del 11%…?». `miembro()` descarta las automenciones por `id_dep`, pero `externa()` no compara la mención con quien habla. En el país hay 23 menciones así, en los turnos de acusados que se defienden: Camet 20, Saucedo 2 y Cuculiza 1.

Qué lo evitaría: en las filas sin `id_dep`, comparar la clave de la persona externa con el nombre de la etiqueta («El señor EX MINISTRO DE ECONOMÍA Y FINANZAS, Jorge Camet Dickmann») y descartarla como propia si coinciden.

## Sin efecto en el veredicto

- **Una persona en varios nodos.**
  - **Salas-Guevara.** Tiene tres nodos: «luis federico guevara» (4 menciones; el diario omite «Salas», n.º 20), «luis federico salas guevara schultz» (2, en la misma intervención) y «federico salas» (1). La regla que pedía la revisión anterior lo arreglaría: unir la clave corta con la larga cuando la corta es subsecuencia de la larga y comparten nombre de pila y apellido.
  - **Montesinos.** Siguen separados «montesinos» (47 menciones, entre ellas los n.º 34 y 38) y «vladimiro montesinos» (1).
  - **Cuculiza.** En mayo y junio de 2003 tiene 4 menciones en su nodo de miembro «aún sin escaño» (nombre y apellido, o los dos apellidos) y 11 en el externo (n.º 19). Dos de estas últimas llevan nombre y apellido, «ministra Luisa María Cuculiza Torre» y «ministra Luisa María Cuculiza». Por el criterio («aún sin escaño» con el nombre completo), y como las mismas formas con «señora», debían ir al nodo de miembro. La rama `deGobierno` (líneas 531-535) solo mira el escaño anterior, no el posterior.
- **Clave de solo un apellido común** (n.º 17, «fernandez»). Hoy identifica a Rosario Fernández porque ninguna otra mención se le une. Cualquier otra «Fernández» con cargo iría al mismo nodo.
- **Grafías del diario.** El n.º 22 dice «Herniando» por Hernando, y el n.º 20, «Luis Federico Guevara» por Salas-Guevara. Las claves reproducen el texto, y las personas son reales.
- **Uniones de claves de una palabra que fallan (fuera de la muestra).**
  - «la juez Sánchez» (19-5-2003) va a César Saucedo Sánchez: la unión por sesión admite su segundo apellido.
  - «la señora Villarán» (7-5-2003) va a Fernando Villarán, un hombre.
  - «el entonces senador Lozada», tío aprista de la presidenta de la comisión dictaminadora (14-7-1999), va a Ana María Romero-Lozada, ministra de la Mujer que interviene en 2003.
  - «General Bello» (19-5-2003) va a la clave «bello horizonte carabayllo enero». Es un lugar leído como persona en una tabla del 15-5-2003: «AA.HH. Bello Horizonte Carabayllo ENERO…», donde «HH.» actúa como plural de «H.».

  Qué lo evitaría, en la unión de claves (líneas 813-832):
  - exigir concordancia de género entre la forma de la mención y la persona de la clave larga;
  - exigir cercanía en el tiempo (misma legislatura o contigua);
  - no unir por sesión con un segundo apellido;
  - no tomar «HH.» por forma de tratamiento.
- **Nombres de partido dentro de las listas (fuera de la muestra, afecta a la exhaustividad).** En «los señores congresistas Nilza Chacón Trujillo de Fuerza Popular, José Bernardo Pazo Nunura, Somos Perú; …», «Nilza Chacón Trujillo de Fuerza Popular» y «Somos Perú» quedan como menciones de miembro sin resolver. La lista tras el plural toma el partido por parte del nombre, o por un nombre más.

## Fuentes consultadas

- Rosario Fernández Figueroa, presidenta del Consejo de Ministros del 19-3 al 28-7-2011: https://es.wikipedia.org/wiki/Rosario_Fern%C3%A1ndez_Figueroa (n.º 17)
- María Antonieta Alva, ministra de Economía y Finanzas del 3-10-2019 al 9-11-2020: https://es.wikipedia.org/wiki/Mar%C3%ADa_Antonieta_Alva (n.º 18)
- Luis Federico Salas-Guevara Schultz, presidente del Consejo de Ministros en 2000, condenado por los 15 millones entregados a Montesinos: https://es.wikipedia.org/wiki/Federico_Salas-Guevara (n.º 20)
- Manuel Catacora Gonzáles, procesalista citado en la doctrina peruana: https://vlex.com.pe/vid/nociones-generales-338232366 (n.º 21)
- José María Hernando, oficial mayor del Congreso muerto en Miraflores el 15-1-1881: https://www3.congreso.gob.pe/oficialia-mayor/ (n.º 22)
- Edwin Oviedo, presidente de la Federación Peruana de Fútbol de 2014 a 2018: https://es.wikipedia.org/wiki/Edwin_Oviedo (n.º 23)
- Francisco Sagasti, congresista desde el 16-3-2020 y presidente de la República del 17-11-2020 al 28-7-2021: https://es.wikipedia.org/wiki/Francisco_Sagasti (n.º 25 y 31)
- José María Balcázar, presidente de la República desde el 18-2-2026: https://es.wikipedia.org/wiki/Gobierno_de_Jos%C3%A9_Mar%C3%ADa_Balc%C3%A1zar (n.º 26, 27 y 29)
- José Jerí, presidente del Congreso desde el 26-7-2025 y de la República del 10-10-2025 al 17-2-2026: https://es.wikipedia.org/wiki/Jos%C3%A9_Jer%C3%AD (n.º 28, 30 y 32)
- Las fechas de mandato presidencial son las de `formas_paises_v6_2.cjs`. El resto de las identificaciones sale del propio texto de la sesión y de `oradores.json`.

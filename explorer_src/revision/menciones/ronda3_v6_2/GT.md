# Precisión del detector de menciones, versión 6.2: Guatemala (Congreso de la República)

Muestra: `node muestra_precision7.cjs paises/GT 8 31` sobre `paises/GT/menciones6_2.json` (hasta 8 menciones por categoría, semilla 31). Se juzgaron 40 menciones. Dos categorías están vacías en la salida: la de cargo sin nombre de miembro y la de antiguo orador sin escaño. Para cada mención se leyó la intervención completa en `biblioteca.json` y las de alrededor, y se comprobaron en `oradores.json` el escaño en la legislatura (IV a IX en la muestra) y los homónimos. En Guatemala las etiquetas no marcan quién preside: el detector lo deduce por sesión (l. 164-180). Por eso se anotó también quién presidía o leía en cada turno. El detalle está en `revision7/GT.json`. Los números entre paréntesis remiten a ese archivo y las líneas citadas son de `detectar6_2.cjs`.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Correctas que no deberían contar |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Miembro, con tratamiento o cargo | 281 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 8 |
| Miembro, apellido suelto | 31 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 8 |
| Miembro, cargo sin nombre (por fecha) | 0 | 0 | – | – | – | – | – | – |
| Externa, con cargo o título | 208 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 5 |
| Externa, antiguo orador sin escaño | 0 | 0 | – | – | – | – | – | – |
| Externa, apellido suelto | 17 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 7 |
| Externa, cargo sin nombre (por fecha) | 64 | 8 | 5 | 3 | 0 | 63 % | 31–86 % | 3 |
| **Total** | 601 | 40 | **36** | 4 | 0 | **90 %** | 77–96 % | 31 |

No hay dudosas.

- Tres categorías se revisaron enteras, además de la muestra:
  - apellidos sueltos de miembro: 31 correctos de 31;
  - apellidos sueltos de externas: 17 de 17;
  - cargos sin nombre de externas: 47 de 64. Entre las correctas se cuentan dos atribuciones a Berger de iniciativas de 2004 que no se comprobaron.

  Con esos recuentos y la muestra para el resto, la precisión de identidad estimada de las 601 menciones ronda el 93 %. Si para las externas con cargo se toman los 7 errores vistos en la salida en lugar de la proporción de la muestra, sube al 96 %.
- La identidad casi siempre es correcta, pero 31 de las 36 correctas no deberían contar. También son lecturas de la Mesa 2 de las 4 incorrectas (39, 40). Solo 7 de las 40 menciones no son de la Mesa ni automenciones, y de ellas 5 son correctas (17, 22, 30, 34, 36). Se les pueden sumar las dos del discurso de toma de posesión del presidente del Congreso (5, 12), anotadas como turno de quien preside. Para el explorador, esto pesa mucho más que los cuatro errores de identidad (apartado 3).

## Errores de identidad que quedan

### 1. El cargo sin nombre usado en abstracto o dentro del nombre de una institución (3 de 8; 17 de 64 en la salida)

- «puede cesar la plena vigencia de algunos derechos, previa declaración (declaratoria) del presidente de la República en Consejo de Ministros» (33, 40) parafrasea el artículo 138 de la Constitución. Aparece tres veces en la salida: en una iniciativa de 2020 y en el considerando de un decreto de 2021, que se lee dos veces (primero la proponente y después la Secretaría).
- «la Secretaría de Obras Sociales de la Esposa del Presidente de la República» (39) es el nombre de una institución. La frase siguiente («presidida por la esposa del presidente de la República») también sale atribuida a Colom.

Fuera de la muestra aparecen otros cuatro tipos:

- **El texto de un artículo.** «Artículo 183. (Reformado) Funciones del Presidente de la República. Son funciones del Presidente de la República.» (2020, 2 menciones). Es un fallo concreto de la l. 744: la expresión admite «artículo», «ARTÍCULO», «ARTICULO» y «Art.», pero no lleva la bandera `i`, así que no reconoce «Artículo» con mayúscula inicial.
- **Normas con el verbo modal antes del cargo.** «será nombrado por el presidente de la República» (2004), «deberá ser suscrita por…» y «debe ser firmado por…» (2004), «debiendo el presidente de la República dar posesión» (2006). La l. 743 solo busca el modal después del cargo.
- **Razonamientos jurídicos de la Corte de Constitucionalidad que se leen en el pleno.** «la disposición constitucional prevé que el presidente de la República haga la declaratoria», «el decreto que hubiere emitido el presidente de la República» (2021, 4 menciones).
- **Afirmaciones genéricas.** «empleados del presidente de la República» y «cuando el presidente de la República elige al señor fiscal general» (2009).

Reglas:

- (a) añadir la bandera `i` a la expresión de la l. 744;
- (b) descartar el cargo precedido de una perífrasis o una pasiva de norma: `(será|serán|deberá|deberán|debe|deben|podrá|podrán|habrá de)\s+(ser\s+)?\p{L}+[oa]s?\s+por\s+(el\s+)?$` y «debiendo»;
- (c) descartar el cargo tras «previa declaratoria del» o «previa declaración del»;
- (d) descartar el cargo tras «esposa del» o «esposo del» (SOSEP y sus paráfrasis);
- (e) tratar como abstracto el cargo si, antes y en la misma oración, aparece «prevé», «establece», «dispone», «determina» o «señala que», o si el verbo del que es sujeto va en futuro de subjuntivo («hubiere»).

### 2. Una profesión con mayúscula tomada por un nombre (1 de 8 externas con cargo)

En «el asesor principal Ingeniero Electrónico» (24), la clave «electronico» es la profesión del asesor. En la misma intervención, «un Viceministro que es Ingeniero Eléctrico» da la clave «electrico». La primera revisión ya las había señalado. La salida tiene otras claves que no son personas: «Finanzas» (2, en una tabla de iniciativas: «y compañeros Finanzas Públicas y Moneda»), «Número» («en Consejo de Ministros Número 6-2021») y «ACUERDA» (un acuerdo gubernativo de 2006). En total son 6 menciones.

Regla: una clave externa de una sola palabra, sin nombre de pila, solo si esa palabra es apellido de algún orador o de una persona externa nombrada con nombre completo. Añadir además «electrico», «electronico», «finanzas», «numero» y «acuerda» a `noPersona`.

## Menciones que no deberían contar (33 de 40)

### 3. Lecturas de la Secretaría y turnos de la Mesa

| Tipo | Casos | Número |
|---|---|---:|
| Listas de «DIPUTADOS PONENTES» y de proponentes en dictámenes | 4, 8, 14, 16 | 4 |
| Firmas de dictámenes y listas de integrantes de comisiones | 9, 10, 11, 13, 15 | 5 |
| Firmas y destinatarios de oficios | 2, 18, 19, 26, 28, 31 | 6 |
| Despacho y orden del día | 7, 20, 21, 23 | 4 |
| Iniciativas, decretos y resoluciones leídos | 35, 37, 38, 39, 40 | 5 |
| Fórmulas de quien conduce una votación o una elección: llamada de atención, «Se pregunta si se aprueba la enmienda…», «Se entrará a votar la propuesta…», anuncio de candidatos | 1, 3, 6, 25, 27, 32 | 6 |
| Automención (Colom, en su informe de 2011) | 29 | 1 |
| Discurso de toma de posesión del presidente del Congreso, que preside la sesión solemne | 5, 12 | 2 |

Los dos últimos casos de la tabla (5, 12) se anotan por el criterio de descartar los turnos de quien preside, pero son alusiones de un discurso político, no fórmulas. Quizá convenga conservarlos.

**Mecanismo.** La Presidencia deducida (l. 164-180) toma a quien más turnos tiene en la sesión, si tiene al menos una cuarta parte y son cortos. Añade como secretarios a quienes tienen al menos el 15 % de los turnos con una mediana de 250 caracteres o menos (l. 178). Quienes leen documentos tienen medianas largas, así que nunca entran:

- Maura Estrada: 4187 y 5204 caracteres (2009);
- Rivero Mérida: 444 y 473 (2021);
- Felipe Alejos: 526 (2020);
- García Silva: 423 (2021);
- Galdámez: entre 379 y 982 en tres sesiones de 2018-2019;
- Cristiani: 403 (2015);
- Zapeta: 383 (2008).

En tres sesiones nadie llega a la cuarta parte de los turnos, y no se deduce Presidencia: 31 de marzo de 2004, 23 de septiembre de 2004 y 14 de agosto de 2012. Solo la de septiembre de 2004 da 108 menciones. El 14 de enero de 2011 pasa lo contrario: se toma por Presidencia al secretario (Boussinot) y no a quien preside (Alejos).

**En la salida completa.** Se hicieron dos recuentos aproximados sobre las 601 menciones de estas cinco categorías:

- por fila, las que están en una fila que empieza con una fórmula de la Mesa o que contiene un documento leído: 316 (53 %);
- por orador, las de quien tiene alguna fórmula de la Mesa en la sesión: 398 (66 %).

En las categorías revisadas enteras la proporción es mayor. De los 31 apellidos sueltos de miembro, 30 están en listas o firmas leídas en el pleno: 28 las lee la Secretaría y 2 un diputado que lee la composición de una comisión. El otro es del discurso de Alejos. De los 17 apellidos sueltos de externas, 11 son firmas de oficios o listas de candidatos, y uno es la automención de Colom.

Reglas (la revisión anterior ya las propuso en esta dirección, y no se han aplicado):

- (a) marcar como de la Mesa, en cada sesión, a todo orador con dos o más turnos que empiezan con una fórmula de trámite, sin la condición de longitud: quien lee es largo precisamente porque lee. Son fórmulas como «A discusión», «No habiendo discusión», «Se pregunta si se aprueba», «Se abre a votación», «Se entrará a votar», «Se enmienda el trámite», «Tiene la palabra», «PUNTO …:» y «En forma resumida se leerá».
- (b) sea quien sea el orador, no contar las menciones dentro de un documento leído:
  - desde «DIPUTADOS PONENTES:» hasta el final de la lista;
  - desde una fórmula de despedida («Atentamente», «consideración y estima», «nos suscribimos», «DADO EN LA SALA…») hasta «Su despacho» o «TRAMITE:»;
  - dentro de los bloques que abren «DICTAMEN», «EXPOSICIÓN DE MOTIVOS», «DECRETO NÚMERO», «CONSIDERANDO» o «se leerá el siguiente despacho».
- (c) en una elección, tratar como de la Mesa el anuncio «los candidatos … son los abogados X y Y».
- (d) automenciones: si la fila no tiene id de orador, comparar la persona con la etiqueta del orador.

## Lo que la versión 6.2 ya resuelve

- «Arzú» en las listas de ponentes ya no va al expresidente: no queda ninguna mención de «Arzú».
- «Ganadería y Alimentación» ya no aparece como persona.
- Tres casos pasan ya al nodo correcto de miembro: «ministro de Desarrollo Social, Raúl Romero Segura» (2021, 4 menciones), como antiguo miembro; «secretario de esta Junta Directiva, José Conrado García» (2004); y «diputado Batres» (2021), que es Edgar Stuardo Batres Vides.
- Otto Pérez Molina como jefe de Estado es siempre la misma persona externa, con nombre (2015) y en el cargo sin nombre (2013).
- «Bernardo Arévalo, Semilla» (2020) va al diputado (16). Los apellidos que comparten varios miembros van a la persona correcta cuando les precede el nombre o el primer apellido: «Pivaral Montenegro» (9) y «Barreda Taracena» (14).

## Fuera de la muestra (no cuenta en la precisión)

- **Un jefe de Estado que falta en la tabla.** «ese primer año de gobierno, encabezado por el presidente Cerezo» (2011, en el discurso de Alejos) va al nodo de miembro de Marco Vinicio Cerezo Arévalo, diputado en 2000-2008, como antiguo miembro. Es el presidente de 1986-1991 y, por el criterio, debería ser su nodo externo. La tabla de Guatemala (formas_paises_v6_2.cjs, l. 240) salta de Árbenz a Ramiro de León Carpio. Regla: añadir a Vinicio Cerezo, del 14 de enero de 1986 al 14 de enero de 1991 (https://es.wikipedia.org/wiki/Vinicio_Cerezo), y a Jorge Serrano Elías, del 14 de enero de 1991 al 1 de junio de 1993 (https://es.wikipedia.org/wiki/Jorge_Serrano_El%C3%ADas).
- **Una antigua diputada con cargo de Gobierno.** En «la señora ministra Flora de Ramos, me parece, lo renovó» (31 de marzo de 2004), la clave externa es «flora ramos». Pero Flora Marina Escobar Gordillo de Ramos tuvo escaño en la IV. El camino de los cargos de Gobierno (l. 527-538) solo usa el nodo de miembro con fuerza 2 o más. «Flora de Ramos» se queda en fuerza 1, porque «Ramos», el apellido de casada, no es su apellido de referencia: el nombre de cinco palabras se parte con los apellidos al final («Gordillo Ramos»). Regla: en ese camino, probar también el nombre de pila seguido del último apellido cuando va tras «de» (apellido de casada), como hace para las mujeres la l. 546-550.
- **La misma persona partida en dos nodos.** «doctor Arévalo Bermejo» (2004) queda aparte de «juan jose arevalo». «Lic. Carlos Estuardo Gálvez Barrios» y «Lic. Estuardo Gálvez» (2009) son dos claves.
- **Marca «se dirige» errónea.** Dos de las menciones de la muestra (4, 8) llevan la marca «se dirige», pero son elementos de una lista de ponentes, no vocativos.
- **Posiciones desplazadas.** En 31 de las 734 menciones, las posiciones `i` y `largo` no coinciden con el texto de `biblioteca.json`: el caso 38, por ejemplo, empieza un carácter antes. El detector une las palabras partidas por guion a final de línea antes de buscar (l. 637), y las posiciones se refieren al texto ya unido. Importa si el explorador subraya las menciones con esas posiciones.

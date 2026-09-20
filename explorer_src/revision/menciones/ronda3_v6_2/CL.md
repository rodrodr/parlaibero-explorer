# Menciones en Chile (CL): precisión de la versión 6.2

Muestra: `node muestra_precision7.cjs paises/CL 8 31` sobre `paises/CL/menciones6_2.json`. Hasta 8 menciones por categoría, con semilla fija: 40 en total, porque dos categorías están vacías (miembro por cargo sin nombre y externa por antiguo orador). Cada mención se ha juzgado con la intervención completa, los turnos de la sesión y `oradores.json`, y con una fuente externa cuando hacía falta saber quién era alguien o quién ocupaba un cargo. El veredicto, el motivo y la marca `no_deberia_contar` de cada una están en `revision7/CL.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 1.283 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 55 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | sin casos |
| Externa, con cargo o título | 693 | 8 | 7 | 1 | 0 | 88 % |
| Externa, antiguo orador sin escaño en la biblioteca | 0 | — | — | — | — | sin casos |
| Externa, apellido suelto | 47 | 8 | 8 | 0 | 0 | 100 % |
| Externa, cargo sin nombre (por fecha) | 78 | 8 | 4 | 4 | 0 | 50 % |
| Total | 2.156 | 40 | 35 | 5 | 0 | 88 % |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- **Margen.** Con 8 casos por categoría, el intervalo de Wilson al 95 % es amplio: 8 de 8 es compatible con una precisión real desde el 68 %; 7 de 8, entre el 53 % y el 98 %; 4 de 8, entre el 22 % y el 78 %. El total, 35 de 40, entre el 74 % y el 95 %. Ponderando cada categoría por su tamaño en el país, la estimación es del 94 %.
- **Por qué baja la categoría de cargos sin nombre.** Con el criterio de v6.2, el uso del cargo en abstracto ya es un error, no una mención que «no debería contar». Los cuatro errores de esa categoría son de este tipo (patrón 1). En la revisión anterior, los usos genéricos contaban como correctos, con la marca de que no debían contar.
- **Identidad correcta, pero la mención no debería contar.** Afecta a 10 de las 35 correctas:
  - 8 salen de turnos del secretario o del prosecretario, que la v6.2 debía descartar y no reconoce (n.º 10, 12, 13, 16, 19, 27, 31 y 39; véase «No deberían contar», 1).
  - 2 están en listas de asistencia a una comisión leídas en el informe (n.º 9 y 15). La n.º 9, además, se duplica con el «don Ignacio» que la sigue.

  En la categoría de apellidos sueltos de miembros, 6 de las 8 menciones no deberían contar.
- **Los errores de la revisión anterior ya no aparecen:**
  - «Vargas, don Alfonso» se resuelve con el apellido de delante: Alfonso Vargas Lyng.
  - «señor Figueroa» (Temucuicui, 2008) ya no se une al alcalde José Figueroa.
  - «el Presidente de la República de la época, Augusto Pinochet» ya no se atribuye a Aylwin: no queda ningún cargo sin nombre seguido de «de la época», «de entonces» o «de turno».
  - Boric tiene un solo nodo, el externo (10 menciones en 2022).
  - «ministro Viera-Gallo» (2008) y «canciller Allamand» (2022) van al nodo de miembro de cada uno, como antiguos miembros.

## Errores que quedan

### 1. Usos del cargo en abstracto atribuidos al presidente del día (n.º 34, 35, 36 y 40)

Los cuatro son «el Presidente de la República» en frases que describen una norma o un trámite, no una alusión a quien ocupaba el cargo:

- n.º 34 (1994): la función que el decreto 363 de 1993 da a la Comisión Interministerial de Desarrollo Rural, «proponer al Presidente de la República un programa…». Se atribuye a Frei.
- n.º 35 (1992): el trámite de la personalidad jurídica, «hoy deben elevar una solicitud al Presidente de la República, por intermedio del Ministro de Justicia». Se atribuye a Aylwin. Es la misma frase que la revisión anterior ya señaló como uso genérico.
- n.º 36 (1999): el nombramiento del fiscal nacional, que «es designado por el Presidente de la República, “a propuesta en quina de la Corte Suprema…”». Se atribuye a Frei.
- n.º 40 (1999): lo que dispone una indicación, que la política contra el lavado de dinero «deberá ser revisada año a año por el fiscal nacional y el Presidente de la República». Se atribuye a Frei.

Los filtros de uso genérico de v6.2 (`cargosSinNombre`, líneas 736-755 de `detectar6_2.cjs`) miran lo que sigue inmediatamente al cargo («el Presidente de la República podrá…»), un «artículo N» en los 300 caracteres anteriores y unas pocas palabras de delante («ser», «elegir», «nombrar»). Los demás filtros son de tiempo: «de la época», «ex», «entonces», años fuera del mandato. Ninguno cubre un verbo deóntico delante del cargo («deben elevar… al», «deberá ser revisada por… el»), la pasiva de nombramiento («designado por el»), ni la descripción de una función («tiene como función… proponer al»).

En el país, 23 de los 78 cargos sin nombre tienen en su oración vocabulario normativo o deóntico. Es la expresión regular de la regla que sigue, así que el recuento es aproximado, pero da el orden de magnitud.

Qué lo evitaría: mirar la oración entera, no solo lo que sigue al cargo, y no atribuir cuando en ella hay:

- un verbo deóntico (debe, deben, deberá, podrá, puede, corresponde a, compete a);
- una pasiva de nombramiento («designado», «nombrado» o «elegido» por el Presidente);
- vocabulario de norma: Constitución, artículo o artículos con número, inciso, establece, dispone, prescribe, señala que, función, facultad, atribución.

Probada sobre la muestra, esta regla aparta los cuatro errores (n.º 34, 35, 36 y 40), siempre que los límites de palabra admitan letras con tilde («deberá»). Pero aparta también el n.º 38, que es correcto: «que no se les presione, y que deben tener plena libertad», dicho de los tribunales. Conviene exigir, por tanto, que el verbo deóntico esté en la misma cláusula que el cargo o lo tenga por sujeto o complemento.

### 2. Antiguos diputados nombrados como senadores: persona externa en vez de su nodo de miembro (n.º 18)

En 2008 se habla del «senador Espina». La mención va a la persona externa «alberto espina otero». Alberto Espina Otero fue diputado de 1990 a 2002 y senador desde 2002 (https://es.wikipedia.org/wiki/Alberto_Espina). En la biblioteca tuvo escaño en las leg. 322-343, habla 40 veces y tiene su nodo de miembro, con dos menciones de 1991 y 1992. Por el criterio de v6.2, una persona con escaño en una legislatura anterior de la muestra es un solo nodo de miembro también cuando se la menciona después. Aquí queda en dos.

La causa está en la rama de las formas externas de `clasificar` (líneas 517-526). «senador» es un cargo que no ocupa un miembro en ejercicio, y la rama crea siempre la persona externa. No comprueba si el nombre es de un orador con escaño anterior, como sí hace la rama `deGobierno` (líneas 531-535), que v6.2 añadió para los ministros. El conjunto `externos` (líneas 299-315) sigue la misma idea: «son personas externas aunque hayan sido miembros».

En el país son 30 menciones de 12 antiguos diputados nombrados como senadores, la n.º 18 entre ellas:

- Espina: 11 (2008 y 2016).
- Ávila (Nelson): 4, una de 2002 y tres de 2004. Bombal: 3. Viera-Gallo: 3. En 2004 los tres aparecen como autores de una moción. Viera-Gallo queda así también en dos nodos: el de miembro y la persona externa «viera gallo».
- Navarro: 2.
- Horvath, Cantero, Allamand, Letelier, Quintana, Chahuán y Girardi: 1 cada uno.

Qué lo evitaría: en la rama de formas externas, antes de crear la persona, resolver el nombre como en la rama `deGobierno`. Si el orador tiene `escanoEnBiblioteca(d, leg) === 'antes'` y no es jefe de Estado (`!jefeDeOrador.has(d.id)`), enviar la mención a su nodo de miembro con `antiguo`.

- Con un apellido solo («los senadores señores Ávila, Bombal…»), exigir que sea el apellido de referencia de un único orador con escaño anterior.
- Restringir `externos` a quienes no tuvieron escaño en ninguna legislatura de la biblioteca.

## No deberían contar (identidad correcta)

### 1. Turnos del secretario y del prosecretario (n.º 10, 12, 13, 16, 19, 27, 31 y 39)

El criterio de v6.2 descarta los turnos de la Mesa (secretarios, prosecretarios, relatores). En los diarios chilenos la etiqueta es «El señor ÁLVAREZ (Prosecretario accidental)», «El señor ZÚÑIGA (Prosecretario)», «El señor LOYOLA (Secretario)». `esPresidenciaEtiqueta` (líneas 152-161) no reconoce esta forma:

- la expresión de las lecturas exige que la etiqueta empiece por el cargo («El Secretario…»);
- la de la coma exige «Nombre, Secretario»;
- la de los paréntesis solo admite «(Presidente)».

Son 41 turnos, y dejan en la salida 256 menciones, el 11,5 % del país:

- 181 de las 1.283 de miembros con tratamiento o cargo;
- 23 de los 55 apellidos sueltos de miembros;
- 24 de las 693 externas con cargo, 10 de los 78 cargos sin nombre y 7 de los 47 apellidos sueltos externos;
- 5 menciones «a la Presidencia» y 6 sin resolver.

221 de las 256 salen de la lectura de proyectos de acuerdo (autores y texto); el resto, de acuerdos de los Comités, pareos e indicaciones. La revisión anterior ya marcaba dos casos (sus n.º 11 y 14) como lecturas de la Mesa.

Qué lo evitaría: añadir a `esPresidenciaEtiqueta` la forma con el cargo entre paréntesis al final de la etiqueta, `/\((?:pro|sub)?secretari[oa][^)]*\)\s*:?\s*$/i`, como la que ya existe para «(Presidente)».

### 2. Listas de asistencia a las comisiones leídas en los informes (n.º 9 y 15)

El diputado informante lee quién asistió a la comisión: «con la asistencia de la diputada señora Cristi, doña María Angélica, y de los diputados señores Bauer, don Eugenio; …; Urrutia, don Ignacio…», o «con la asistencia de los diputados señores José Miguel Ortiz, como presidente; Claudio Alvarado, Rodrigo Álvarez…». Las identidades son correctas, pero son listas de asistencia, que el criterio descarta. `enAsistencia` (línea 269) solo mira si la línea empieza por «Asisten», «Asistieron»…, y aquí la fórmula va dentro de la oración.

En el país, fuera de los turnos de la Mesa, unas 65 menciones de miembros están en oraciones de este tipo, 14 de ellas apellidos sueltos. El recuento es aproximado.

Qué lo evitaría: tratar como lista de asistencia el tramo que va de «con la asistencia de», «contó con la asistencia de» o «Asistieron (, además,)» hasta el final de la oración, al menos para los nombres de miembros. Los invitados que la comisión escuchó (n.º 20 y 24) sí dicen algo del trabajo de la comisión y pueden quedarse.

### 3. «Apellido, don Nombre»: dos menciones en el mismo punto (n.º 9; también n.º 8)

v6.2 ya resuelve el «don Nombre» con el apellido que va delante. Pero no funde las dos menciones, así que el apellido sigue contando por su cuenta. En el país hay 53 pares así:

- **37 duplicados:** las dos menciones van al mismo miembro («Urrutia, don Ignacio», n.º 9; «señora Caraball, doña Eliana»; «Aylwin, don Andrés»).
- **9 con el apellido ambiguo**, que no llega a contar. Es el caso de «El Diputado señor García, don René Manuel» (n.º 8). Aquí la regla de v6.2 ni siquiera se aplica, porque el nombre de pila tiene dos palabras.
- **7 con el apellido resuelto a otro miembro:** por quién habla, preside o tiene más actividad, sin mirar el nombre de pila que sigue. Por ejemplo, «Pérez, don Víctor» → «Pérez» a Lily Pérez San Martín y «don Víctor» a Víctor Pérez Varela (1999 y 2002), o «Palma, don Osvaldo» → «Palma» a Andrés Palma (2001). La mención del apellido es un error de identidad.

Qué lo evitaría: reconocer el tramo «Apellido(s), don|doña Nombre(s)» como una sola mención, resuelta con el apellido y el nombre juntos (también con dos nombres de pila). La mención que ya tuviera el apellido se sustituye. En la pasada de sueltos (`probar`), saltar el apellido seguido de «, don|doña Mayúscula».

## Sin efecto en el veredicto

- **Falsos vocativos.** 5 de las 40 menciones llevan «se dirige» (n.º 8, 9, 10, 13 y 16), y ninguna es un vocativo: son elementos de una lista separados por comas, o una aposición. Sigue pendiente la regla que ya pedía la revisión anterior: `vocativoDe` no debe marcar la mención si detrás siguen una coma y otra palabra con mayúscula, ni si delante hay «Apellido,».
- **Nombre de pila tomado por apellido** (n.º 29 «Joseph Rafael», n.º 30 «Valene»). La persona es la correcta en los dos casos.
- **Clave de solo el apellido** (n.º 23, «etchegaray»). Identifica bien a Alberto Etchegaray porque ninguna otra clave se le une.
- **Fuera de la muestra:**
  - El nodo «antonio samore» (n.º 21) recoge también dos menciones del paso fronterizo que lleva su nombre: «los pasos Pino Hachado o Cardenal Samoré» (2004) y «el paso fronterizo internacional Cardenal Antonio Samoré» (2018). `INST_LUGAR` no incluye «paso».
  - En «señora Clemira Pacheco y Jorge Ulloa» (2009), la segunda persona hereda la forma femenina y, con el género estricto, Jorge Ulloa Aguillón, que tenía escaño, queda como persona externa «jorge ulloa».

## Fuentes consultadas

- Alberto Espina Otero, diputado de 1990 a 2002 y senador de 2002 a 2018: https://es.wikipedia.org/wiki/Alberto_Espina (n.º 18)
- Alberto Etchegaray Aubry, ministro de Vivienda y Urbanismo de 1990 a 1994 con Aylwin: https://es.wikipedia.org/wiki/Alberto_Etchegaray_Aubry (n.º 23)
- Declaración de Ricardo Lagos como presidente electo, 18 de enero de 2000 («the courts will decide»): https://www.globalsecurity.org/military/library/news/2000/01/000118-chile1.htm (n.º 38)
- Las fechas de mandato presidencial son las de `formas_paises_v6_2.cjs`. El resto de las identificaciones sale del propio texto de la sesión y de `oradores.json`.

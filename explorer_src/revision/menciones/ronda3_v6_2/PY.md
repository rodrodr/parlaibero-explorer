# Menciones en Paraguay (PY): precisión de la versión 6.2

Muestra: `node muestra_precision7.cjs paises/PY 8 31` sobre `paises/PY/menciones6_2.json`. Salen hasta 8 menciones por categoría con semilla fija, 40 en total. Dos categorías están vacías:

- «miembro, cargo sin nombre», porque los jefes de Estado son ahora siempre su nodo externo y González Macchi era el único caso;
- «externa, antiguo orador sin escaño».

Cada mención se juzgó con la intervención completa, los turnos vecinos, las demás menciones de la intervención y `oradores.json`. Cuando había que saber quién ocupaba un cargo o quién era alguien, se consultó una fuente, que se cita en el motivo. El veredicto, el motivo y el campo `no_deberia_contar` de cada mención están en `revision7/PY.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 741 | 8 | 7 | 1 | 0 | 88 % |
| Miembro, apellido suelto | 55 | 8 | 6 | 2 | 0 | 75 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | sin casos |
| Externa, con cargo o título | 406 | 8 | 4 | 4 | 0 | 50 % |
| Externa, antiguo orador sin escaño | 0 | — | — | — | — | sin casos |
| Externa, apellido suelto | 166 | 8 | 8 | 0 | 0 | 100 % |
| Externa, cargo sin nombre (por fecha) | 64 | 8 | 7 | 1 | 0 | 88 % |
| **Total** | 1.432 | 40 | 32 | 8 | 0 | **80 %** |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- El margen es amplio. Según el intervalo de Wilson al 95 %, un 8 de 8 es compatible con una precisión real desde el 68 %, un 7 de 8 va del 53 % al 98 %, y el total, 32 de 40, del 65 % al 90 %.
- Ponderada por el tamaño de cada categoría en el país, la precisión estimada es del 78 %. Pesa la categoría más floja: «externa, con cargo o título», con 406 menciones.
- La revisión 6 (semilla 23, `menciones6.json`) dio 43 de 48 (90 %). La diferencia se debe a la muestra, no a un retroceso. Dos errores que la revisión 6 vio fuera de la muestra caen ahora dentro (Hugo Chávez y «Coronel Oviedo»). La categoría «externa, con cargo o título» vuelve a dar 4 de 8.
- Las 3 menciones «a la Presidencia» no entran en el muestreo.

## Qué ha mejorado desde la revisión 6

- **Lecturas de la Secretaría.** De sus 467 menciones en la versión 6 quedan 2, en turnos con la etiqueta mal escrita («SECRETARÍO», «SECRETARTO»).
- **Errores corregidos.** Ya no salen «CLUB “GENERAL GENES”», «Presidente Alternos» ni el nodo «vicente a matiauda antibia matiauda».
- **González Macchi.** Como presidente de la República es siempre la persona externa.

## Menciones que no deberían contar

4 de las 40.

- **Vocativos y fórmulas (n.º 17, 20 y 21).** Son el vocativo a quien preside con errata del OCR («Señor Pre- sidente», «señor Fresidente») y la fórmula «este Honorable Cuerpo Legislativo». Las tres son además incorrectas (apartado 1).
- **Duplicado (n.º 33).** «le estuve acompañando al Presidente de la República, compañero Mario Abdo Benítez» da dos menciones: el cargo sin nombre y el nombre. La exclusión «con nombre» del cargo sin nombre solo admite «señor/señora/don/doña» entre el cargo y el nombre. Es el único caso del país.
  **Regla:** admitir cualquier forma de tratamiento entre el cargo y el nombre: compañero, colega, amigo, doctor, ingeniero, general…

## Errores que quedan, por causa

Hay 8 errores en la muestra. Cada uno se cuenta en un solo apartado. Los casos «fuera de la muestra» se contaron en `menciones6_2.json` para medir el alcance de cada causa, pero no entran en la tabla.

### 1. Palabras que no son nombres tras una forma (3 errores: n.º 17, 20 y 21)

- **n.º 17 y 20.** «Señor Pre- sidente» da la persona «pre», y «señor Fresidente», la persona «fresidente». Son el vocativo a quien preside, partido por el guion de fin de línea o con una errata del OCR.
- **n.º 21.** «este Honorable Cuerpo Legislativo» da la persona «cuerpo»: es la Cámara.
- **Fuera de la muestra.** De las 406 externas con cargo, unas 93 (23 %) no son personas:
  - 18 son erratas de «Presidente», en 13 claves: «pre», «ptesidente», «presideme», «tresidente», «preszdente», «tpresidente»…
  - 56 son sustantivos o fórmulas:
    - «colegas Parlamentarios» (28) y «colega Parlamentario» (3);
    - «Honorable Cuerpo» y «Honorable Cámra / CAMARÁA / Cáómara» (9);
    - «señor Vice-Presidente» (4), que da la persona «vice»;
    - «Secretario Privado de la Presidencia», que da «privado»;
    - «Presidente ESSAP», «Senador Colorado», «Cónsul Paraguayo», «Periodistas», «Municipales»…
  - 19 son lugares:
    - «Coronel Oviedo» con sus formas en guaraní («Coronel Oviedope», «Oviedo-pe», «Oviedoguape»): 8;
    - «Capitán Meza», «Capitán Bado», «Presidente Hayes», «Alto Paraguay», «Carmen del Paraná», «General Resquín», «Dr. Cecilio Báez», «Mariscal Estigarribia» y la calle «Dr. Morra».

**Regla.**
- Una clave de una sola palabra debe ser un nombre o un apellido conocido: de `oradores.json`, de `nombres_pila.json` o apellido de otra clave con nombre de pila. Si no lo es, se descarta. Con esto cae casi todo lo anterior.
- Antes de detectar, unir la palabra partida por un guion de fin de línea («Pre- sidente»). Tomar por forma, y no por nombre, cualquier palabra a distancia de edición 2 o menos de «presidente».
- Añadir a `noPersona` «parlamentario», «parlamentarios», «cuerpo», «legislativo», «vice» y «privado».
- Añadir a `lugares` de PY los distritos que empiezan por un grado o un cargo: Coronel Oviedo, Coronel Martínez, Capitán Meza, Capitán Bado, Presidente Hayes, Mariscal Estigarribia, General Resquín, Dr. Cecilio Báez y Carmen del Paraná. Cortar los sufijos guaraníes (-pe, -gua, -guápe) antes de comparar.

### 2. Hugo Chávez atribuido a José Gregorio López Chávez (2 errores: n.º 14 y 15)

En 2009, «Chávez» es Hugo Chávez: «la plata de Chávez… Chávez es Judas, nunca va a estar a favor del Paraguay» y «el seguro enojo de Chávez, de Correa y de Evo Morales». Las dos menciones van al diputado José Gregorio López Chávez (UNACE, 2008-2013), para quien Chávez es el segundo apellido.

Hay dos causas:
- **El apellido suelto.** «chavez» quedó como apellido de miembro por Wilfrido Chávez Cáceres (1993-1998), al que la biblioteca llama «Diputado Chávez». En 2009 la búsqueda lo atribuye al único miembro con escaño que lleva ese apellido. Pero el filtro (`conEse`, con `y.ap.includes(ap)`) mira todos los apellidos, no solo el primero, y así llega a López Chávez.
- **Con forma.** «Presidente Chávez», «dictador Chávez» y «señor Chávez» caen en lo mismo, porque Hugo Chávez no está en la tabla de jefes de PY.

**Alcance.** 15 menciones de Hugo Chávez van a López Chávez: 11 apellidos sueltos y 4 con forma. Son el 20 % de los 55 apellidos sueltos de miembro del país. Solo «Presidente Hugo Chávez», con el nombre completo, va a la persona externa «hugo chavez».

**Regla.**
- En `conEse`, exigir que el apellido sea el de referencia del miembro (`apRef`, el primero). Exigir también que la biblioteca lo llame así en esa misma legislatura.
- Añadir una tabla común de jefes de Estado extranjeros de la región, con sus fechas: Chávez 1999-2013, Correa, Evo Morales, Lula, Kirchner… «Presidente/dictador X», y el apellido suelto de un jefe en ejercicio, van a su nodo, salvo con forma de miembro («diputado Chávez»).

### 3. Un nodo que junta a dos personas: Alderete (1 error: n.º 18)

El «señor Alderete» de 2009 es Alberto Alderete, presidente del INDERT en 2008-2010 (<https://www.indert.gov.py/indert/index.php/institucion/presidentes>), cuya interpelación se pide en la sesión. Va al nodo «jose alberto alderete», que nace de «Ministro de Obras Públicas, José Alberto Alderete» (2004). Este es otra persona: un dirigente colorado, ministro de Nicanor Duarte en 2003-2006 (<https://es.wikipedia.org/wiki/Jos%C3%A9_Alberto_Alderete>).

La unión de claves junta «alderete» y «alberto alderete» con la única clave larga que termina igual, sin mirar la fecha. El nodo tiene 14 menciones: 1 del ministro y 13 del presidente del INDERT.

**Regla:** unir una clave corta con una larga solo si coinciden en la legislatura (o en la sesión). Si la larga es de otra legislatura y la corta tiene en la suya un nombre completo propio («Doctor Alberto Alderete»), usar ese nombre.

### 4. Un lugar con grado militar atribuido a un miembro (1 error: n.º 5)

«envenenada a Coronel Oviedo, Yataity, Mbocayaty» nombra la ciudad, pero la mención va a César Ariel Oviedo Verdún, que tenía escaño en 2018-2023. Con un grado militar, la regla acepta a un miembro con escaño si el apellido llega a fuerza 2.

**Fuera de la muestra, la misma causa:**
- **Otros lugares:**
  - «Coronel Oviedo», 3 veces más (2020);
  - «Coronel Martínez», 2 veces (1994), a Atilio Martínez Casado;
  - «Mariscal Estigarribia», 1 vez (1994), a Antonio Raúl Estigarribia Ferreira.
- **Personas con grado que no son el miembro:**
  - «Capitán Ruíz Díaz», 3 veces (1994): el militar herido en el atentado contra el general Ramón Rosa Rodríguez;
  - «General Escobar», 2 veces (2009): un general del siglo XIX, en la historia del Partido Colorado;
  - «General Oviedo», 1 vez (2009): Lino Oviedo;
  - «capitán Luis Ramírez», 1 vez (2020): un jefe de bomberos de Ciudad del Este, tomado por el antiguo miembro Luis Delfino Ramírez;
  - «compañero Oviedo», 1 vez (2009): Alcides Oviedo, compañero de Carmen Villalba y cabecilla del EPP (<https://www.lanacion.com.py/semanales/2024/07/15/asi-detuvieron-a-carmen-villalba-en-sanguina-cue-hace-21-anos/>), atribuido a Oviedo Verdún.

**Regla.**
- Incluir los topónimos en `lugares` de PY (apartado 1).
- Con un grado militar, resolver a un miembro solo si habla o preside en esa sesión, o si se le habla.
- Un grado sin artículo delante dentro de una enumeración («a Coronel Oviedo, Yataity», «de que Coronel Martínez, que es el distrito») es un lugar.

### 5. Un cargo sin nombre en la paráfrasis de una norma (1 error: n.º 36)

«De acuerdo al dictamen proveniente de la Cámara de Senadores, el Poder Ejecutivo, el Presidente de la República, nombra al Ministro de la Reforma, nombra al interventor…» describe lo que dispone el dictamen, no un acto de González Macchi.

La exclusión de las normas mira, entre otras cosas, si hay un artículo numerado en los 300 caracteres anteriores o un verbo en futuro o modal justo detrás («podrá», «nombrará»…). Aquí el verbo va en presente («nombra»).

El n.º 34, del mismo turno, se juzgó correcto. En él el orador confía en que el presidente en ejercicio, que sería quien enviara cada privatización al Congreso, «tendrá mucho cuidado».

**Regla:** no atribuir el cargo en estos casos:
- cuando la oración empieza por «de acuerdo al/con (el) dictamen/proyecto/texto/artículo», «según el proyecto» o «el proyecto dice/establece»;
- cuando rige el cargo un verbo en presente que describe la norma («nombra», «designa», «decide»).

### Otros errores vistos fuera de la muestra (no cuentan en la tabla)

- **Miembros tomados por personas externas:**
  - «colega Bachi» y «compañero Bachi» (2019 y 2020) son Basilio «Bachi» Núñez, diputado en 2018-2023, que interviene en las dos sesiones.
  - «señor Conrado Pappalardo Zaldívar» (1999), en el mismo turno del n.º 10. La biblioteca escribe el segundo apellido con Z y `oradores.json`, con S: la misma persona queda en dos nodos.
  - «colega Atilio von Knobioch» (1997) y «compañero Sebastión Acha» (2009) son erratas del OCR de dos miembros con escaño: Ramón Atilio von Knobloch y Carlos Sebastián Acha Mendoza.

  **Regla.**
  - Antes de crear una persona externa tras una forma de miembro o de trato entre colegas («colega», «compañero»), probar el nombre con una letra de diferencia por palabra y con la equivalencia Z/S.
  - Añadir los apodos conocidos (Bachi → Basilio Núñez).
- **Un distrito unido a un senador.** «Mariscal Estigarribia», el distrito, va en 2019 a la clave «silvio ovelar estigarribia», junto a «senador Silvio Ovelar».

## Nodos partidos (no son errores de identidad)

- **Natalicio Chase (n.º 24):** «natalicio chase», «natalicio esteban chase acosta» y «chase».
- **Vicente Matiauda:** «vicente a matiauda» (18) y «vicente matiauda» (5).
- **Dionisio Borda:** «dionicio borda» (5) y «agronomo dionisio borda» (2). En la segunda, «Ingeniero Agrónomo» se queda dentro de la clave.
- **Carlos A. Saldívar:** «carlos a saldfvar» y «carlos a saldivar» (errata del OCR).

## Menores y datos

- **Marca «se dirige».** Sale en una enumeración (n.º 9: «los Diputados Lugo, — Riat y Benítez — Florentín»). En esa lista, «Riat», errata de Riart, no se detecta.
- **«Diputado Paoli» (1996).** Da la persona externa «paoli» porque `oradores.json` tiene invertido el nombre de Bernardo Paoli Núñez («NUÑEZ, BERNARDO PAOLI»).
- **Turnos sin `id_dep`.** Los 29 turnos de «SEÑOR DIPUTADO OSCAR LUIS TUMA GONZALEZ» siguen sin él.

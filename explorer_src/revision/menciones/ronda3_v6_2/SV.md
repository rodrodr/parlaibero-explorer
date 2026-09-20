# Menciones en El Salvador (SV): precisión de la versión 6.2

Muestra: `node muestra_precision7.cjs paises/SV 8 31` sobre `paises/SV/menciones6_2.json`. Salen hasta 8 menciones por categoría con semilla fija, 40 en total. Dos categorías están vacías:
- «miembro, cargo sin nombre», porque ningún jefe de Estado del período tuvo escaño;
- «externa, antiguo orador sin escaño».

Cada mención se juzgó con la intervención completa, los turnos vecinos, las demás menciones de la intervención y `oradores.json`. Cuando había que saber quién ocupaba un cargo o quién era alguien, se consultó una fuente, que se cita en el motivo. El veredicto, el motivo y el campo `no_deberia_contar` de cada mención están en `revision7/SV.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 519 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 24 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | sin casos |
| Externa, con cargo o título | 769 | 8 | 8 | 0 | 0 | 100 % |
| Externa, antiguo orador sin escaño | 0 | — | — | — | — | sin casos |
| Externa, apellido suelto | 64 | 8 | 7 | 1 | 0 | 88 % |
| Externa, cargo sin nombre (por fecha) | 195 | 8 | 8 | 0 | 0 | 100 % |
| **Total** | 1.571 | 40 | 39 | 1 | 0 | **98 %** |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- Por el intervalo de Wilson al 95 %, el total (39 de 40) va del 87 % al 100 %, y un 8 de 8 es compatible con una precisión real desde el 68 %.
- Ponderada por el tamaño de cada categoría, la estimación es del 99 %. Pero con 8 casos por categoría no se ve un error del 5 %, y fuera de la muestra unas 35 de las 769 externas con cargo no son personas o son miembros (apartado «Otros errores»). La precisión real de esa categoría está más cerca del 95 %.
- La revisión 6 (semilla 23) dio 38 de 40 (95 %), con otra muestra.
- Las 24 menciones «a la Presidencia» no entran en el muestreo.

## Qué ha mejorado desde la revisión 6

- **Deducción de la Presidencia.** Ahora basta con tener más de un tercio de los turnos, aunque se lean textos largos. Con eso, los turnos de Ernesto Castro ya no dan menciones (en la versión 6 daban 180), ni los de Norman Quijano o Mario Ponce cuando presiden.
- **«Diputado secretario X».** Como persona externa queda un solo caso de los 7 anteriores: «secretario Orlando Cabrera Candray» (2020).
- **Nayib Bukele.** Tiene un nodo con 366 menciones; antes estaba repartido en 4. Quedan 2 claves de palabras pegadas: «nayib bukelenos» y «nayib bukeleestamos».
- **«Señora Santa Ana».** Ya no es una persona.

## Menciones que no deberían contar

26 de las 40 no deberían contar, y 25 de ellas tienen la identidad bien. Vuelve a ser el principal problema de El Salvador: de las 40, solo 14 son menciones hechas en el debate.

### 1. Lecturas de la Secretaría (7: n.º 2, 3, 4, 7, 11, 14 y 25)

Son llamamientos de suplentes (n.º 2, 3, 4, 11 y 14), una pieza de correspondencia (n.º 7) y el resultado de una votación nominal (n.º 25). Los leen Suecy Callejas, Elisa Rosales, Mario Marroquín y Cristina Cornejo, a petición de la Presidencia («le solicito, diputada Suecy Callejas, dar lectura a los llamamientos»).

La deducción de la Mesa solo toma por secretario a quien tiene al menos el 15 % de los turnos de la sesión, con una mediana de 250 caracteres o menos. Quien lee los llamamientos tiene uno o dos turnos.

### 2. Turnos de quien preside en funciones (3: n.º 8, 15 y 17)

- **Alberto Romero**, vicepresidente, dirige la votación y lee la correspondencia el 24-7-2019 y el 29-7-2020 (n.º 17 y 8).
- **Yanci Urbina**, «presidenta en funciones», preside el 21-6-2018 (n.º 15).

La deducción reconoce un solo presidente por sesión: el que tiene más turnos.

### 3. Lecturas de dictámenes e informes por su relator (11: n.º 9, 10, 12, 16, 18, 19, 23, 28, 30, 34 y 35)

La Presidencia pide a un diputado que lea un dictamen o un informe («le solicito al diputado William Soriano, dar lectura al Dictamen número 46») y el texto trae nombres:
- autores de expedientes (n.º 9 y 10);
- integrantes de una subcomisión (n.º 12 y 16);
- invitados de una comisión (n.º 18 y 19);
- quien pide un indulto (n.º 23);
- el currículo de unos candidatos (n.º 28 y 30);
- fórmulas del decreto (n.º 34 y 35).

El criterio de la versión 6.2 cuenta a los relatores entre los turnos de la Mesa. Si se prefiere contar estas lecturas, estas 11 menciones vuelven a la cuenta.

### 4. Rótulos de piezas de correspondencia (4: n.º 33, 36, 37 y 39)

«Iniciativa del presidente de la República, por medio del ministro de Hacienda, en el sentido se reforme…» es el título del expediente. Un diputado lo lee al pedir que la pieza entre en la agenda, una vez por pieza: en el turno de los n.º 36 y 39 se lee tres veces. Nombra a Bukele (o a Sánchez Cerén) por una iniciativa concreta, pero es un rótulo, no una mención en el debate.

### 5. Protocolo (1: n.º 21)

El maestro de ceremonias anuncia la toma de protesta del presidente de la Corte Suprema.

### Alcance en el país

Es una estimación aproximada, hecha por el tipo de turno. De las 1.595 menciones resueltas o externas:
- unas 540 están en turnos que leen un documento: empiezan por «Comisión de…», «Dictamen número…», «Señores Secretarios… Presente» o «Asunto:»;
- unas 77 están en turnos con fórmulas de Presidencia («SE CIERRA LA VOTACIÓN», «favor votar», «se incorpora») de alguien a quien no se detecta como presidente;
- 40 están en llamamientos;
- 29 están en listas de asistencia. En «DOÑA YANCI GUADALUPE URBINA GONZÁLEZ PRESENTE», el «PRESENTE» queda dentro del nombre capturado;
- 13 están en turnos de maestros de ceremonias.

En la categoría «externa, cargo sin nombre», 107 de las 195 menciones (55 %) son la fórmula «iniciativa del presidente de la República (por medio del ministro…)».

Por orador: William Soriano 153 (lee los dictámenes de Hacienda), Alberto Romero 86, Elisa Rosales 70, Norma Cristina Cornejo 58, Yanci Urbina 58 y Mario Marroquín 40.

### Reglas

- **Lecturas de relatores.** Es turno de la Mesa el que, tras una cortesía («Con mucho gusto, presidente»), empieza por «Comisión de…», «Dictamen número…», «Señores (y Señoras) Secretarios… Presente» o «Asunto: Informe». También lo es el turno del diputado al que la Presidencia acaba de pedir «dar lectura», «darle lectura» o «proceda a su lectura», y su continuación si la lectura se interrumpe.
- **Llamamientos y asistencia.** Son de la Mesa los turnos con dos o más «en sustitución de(l)» o con una lista «X por Y» tras «llamamiento(s)». En las listas de asistencia, cortar el nombre en PRESENTE o AUSENTE y descartar la mención. Descartar también los resultados de votación («resulta electo/a», «Con N votos a favor»).
- **Presidencia por tramos.** Marcar como turno de la Presidencia el que tiene sus fórmulas, sea quien sea el orador: «SE CIERRA LA VOTACIÓN», «favor (de) votar», «someto a consideración», «tiene la palabra», «se incorpora», «Vamos a llamar a X por Y». Marcar también el turno anterior a otro que saluda a la «presidenta» o al «presidente en funciones».
- **Cargo sin nombre.** Saltar «(a) iniciativa del (señor) presidente de la República» cuando sigue «por medio del/de la (vice)ministr…».
- **Maestros de ceremonias.** Las etiquetas «MAESTRO DE CEREMONIA(S)» son turnos de protocolo.

## Errores que quedan, por causa

Hay 1 error en la muestra. Los casos «fuera de la muestra» se contaron en `menciones6_2.json` para ver el alcance, pero no entran en la tabla.

### 1. Una firma con nombre de persona (1 error: n.º 30)

«Bendek & Asociados 1999 a 2019» sale en el currículo del candidato Julio Guillermo Bendek Panameño, que lee el relator del dictamen, y se toma por el apellido suelto de esa persona. La búsqueda del apellido suelto mira si le sigue otra palabra con mayúscula, pero no «&».

**Regla:** descartar el apellido suelto que va seguido de «&», «y Asociados», «Asociados», «Abogados», «S.A.» o «& Cía.».

### Otros errores vistos fuera de la muestra (no cuentan en la tabla)

- **Palabras que no son nombres tras un cargo.** Son unas 32 de las 769 externas con cargo:
  - «Viceministro de Relaciones Exteriores, Integración y Promoción Económica» y el nombre de la comisión de Relaciones Exteriores dan las personas «integracion centroamericana salvadorenos» (7) y «promocion economica» (6);
  - «Gerente Legal» y «jefa Legal» dan «legal» (5);
  - también dan personas «Secretarias» (3), «Suplentes» (2), «Periodista Salvadoreño» (2), «Gerente Territorial», «director Comercial», «Propietarios», «Prevención», «Presidente Tema», «querida Fuerza Armada» y «señor Presiente».

  **Regla:** la misma que en Paraguay (una clave de una sola palabra debe ser un nombre conocido). Además, tras un cargo, una serie de palabras con mayúscula que son sustantivos comunes o adjetivos («Integración y Promoción Económica», «Legal», «Territorial») es parte del nombre del cargo.
- **Instituciones con nombre de persona, que siguen de la revisión 6.** «Hospital … Doctor José Molina Martínez», «… Doctora María Isabel Rodríguez» (2), «Universidad “Doctor José Matías Delgado”» y «maestro Seminario de Brujas» (2).
- **Miembros tomados por personas externas:**
  - «Diputada Suplente Reina Villalta» (2018), ya señalada en la revisión 6: Reina Guadalupe Villalta (FMLN) tiene fila en 2018-2021.
  - «Diputada Vigil» (9-1-2019): Rosa Lourdes Vigil de Altuve (GANA) tiene fila en 2018-2021. Pero `oradores.json` la llama «DE ALTUVE, ROSA LOURDES VIGIL», y «Vigil» queda entre los nombres de pila.
  - «secretario Orlando Cabrera Candray» (2020): el diputado secretario Manuel Orlando Cabrera Candray.

  **Regla:**
  - Tomar «Reina» tras otra forma como nombre de pila.
  - «secretario» tras una forma de miembro, o dicho de alguien con escaño que es secretario de la Junta Directiva, es un puesto de la cámara.
  - En los datos, poner los apellidos de casada en su orden («VIGIL DE ALTUVE, ROSA LOURDES»). Hay 37 nombres de `oradores.json` con la forma «DE X, NOMBRES APELLIDO».

## Nodos partidos (no son errores de identidad)

- **Michelle Sol** está en 3 nodos: «michelle sol», «irma michelle ninette sol castro» e «irma michelle martha ninette sol castro».
- **Yamil Bukele** está en 2: «yamil bukele» y «yamil alejandro bukele perez».
- **Óscar López Jerez** está en 2: «oscar alberto lopez jerez» y «oscar lopez jerez».
- **Nayib Bukele** tiene las 2 claves de palabras pegadas que se citan arriba.

## Menores

- **Marca «se dirige».** Sale en la firma de una pieza leída (n.º 7).

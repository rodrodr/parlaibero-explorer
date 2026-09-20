# Precisión de las menciones, versión 6.2: Panamá (Asamblea Nacional; antes Asamblea Legislativa)

Muestra: `node muestra_precision7.cjs paises/PA 8 31` sobre `paises/PA/menciones6_2.json`, hasta 8 menciones al azar por categoría. Son 40: «miembro, cargo sin nombre» y «externa, antiguo orador sin escaño» están vacías en la salida. Cada mención se ha revisado con la intervención completa en `biblioteca.json`, las filas de alrededor y `oradores.json`. Las fuentes externas consultadas van en el motivo de cada caso, en `revision7/PA.json`. Los números (#) son los de la muestra y las líneas citadas son de `detectar6_2.cjs`.

Criterio: una mención es correcta si va al nodo que prescribe la versión 6.2. Para un miembro, es la persona a la que se refiere el texto, con escaño en esa legislatura según `oradores.json` o, si va como antiguo miembro, con escaño anterior en la muestra; los suplentes cuentan como miembros. Para una externa, es una persona real bien identificada que no debía ser nodo de miembro; los jefes de Estado van siempre a su nodo externo. Si la persona es la correcta pero el nodo no, la mención cuenta como incorrecta. La columna «Persona» da la precisión mirando solo la identidad. «No deberían contar» señala menciones que la salida no debería incluir (Mesa, pasajes duplicados) y no cambia el veredicto.

## Precisión

| Categoría | En la salida | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Persona | No deberían contar |
|---|---:|---:|---:|---:|---:|---|---:|---:|
| Miembro, con tratamiento o cargo | 410 | 7 | 1 | 0 | 7/8 | 53–98 % | 7/8 | 1 |
| Miembro, apellido suelto | 10 | 5 | 3 | 0 | 5/8 | 31–86 % | 5/8 | 3 |
| Miembro, cargo sin nombre (por fecha) | 0 | – | – | – | – | – | – | – |
| Externa, con cargo o título | 340 | 6 | 2 | 0 | 6/8 | 41–93 % | 8/8 | 1 |
| Externa, antiguo orador sin escaño | 0 | – | – | – | – | – | – | – |
| Externa, apellido suelto | 56 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 0 |
| Externa, cargo sin nombre (por fecha) | 37 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 0 |
| **Total** | 853 | **34** | 6 | 0 | **34/40 (85 %)** | 71–93 % | 36/40 | 5 |

- No hay dudosas. #34 («luego que sea sancionado por el Presidente de la República») es un trámite, pero de un proyecto concreto que sancionaría Martín Torrijos.
- «Miembro, apellido suelto» tiene 10 menciones en la salida. Las 2 que faltan en la muestra son otra copia de la fórmula de #14 (PA003001700356: bien identificada, no debería contar) y «este no es un proyecto Abel Beker» (2020: persona correcta, pero va a PA01288, «ABEL BEKER ÁBREGO», y no a PA00005, «ABEL BECKER ABREGO», que es quien habla en la biblioteca). En la categoría entera, 7 de 10 son correctas, y solo 4 son correctas y deberían contar.
- Ponderada por el tamaño de cada categoría, la precisión estimada ronda el 84 %. Es una cifra orientativa: con 8 casos por categoría los intervalos son amplios.
- Frente a la revisión 6 (`revision6/PA.md`, 45/48 con otra semilla), la precisión de esta muestra es menor, aunque los intervalos se solapan. Parte de los errores ya estaban señalados en aquella revisión y siguen en 6.2: el Fanovich que sigue a «de apellido Fanovich» (#13), el sexo de Balbina Herrera (#20), los dos `id_dep` de Abel Beker, los rótulos de la Mesa que no se reconocen (#1, #14) y los pasajes duplicados (#11, #12, #19). Sí están corregidos, en toda la salida, los cargos sin nombre de Cortizo como miembro (la categoría está vacía), la persona «balbina» de «Ministra Balbina», la persona «colegas» y las lecturas con «, SECRETARIO GENERAL»: de 330 menciones de lecturas de la Secretaría y la Relatoría en 6.0 quedan 67.

## Errores que quedan, por causa

### 1. Un homónimo sin forma de miembro se atribuye a un legislador (#12, #15, #13)

- #12 y #15 (30-6-2004, la misma intervención en dos copias): «A aquellos profesionales por las transmisiones de televisión, a Jorge Villanueva, Evidelio Muñoz, José Blandón y al jefe de Televisión, Nivaldo Tejeira, un millón de gracias». Este José Blandón es un técnico de la televisión de la Asamblea, pero la mención va al legislador José Isabel Blandón Figueroa. La rama de apellidos sueltos (l. 963-977) acepta «José» delante porque es el nombre de pila del legislador, y no mira la enumeración: nadie más en ella es miembro.
- #13 (6-10-2004): Ávila separa al «colega Fanovich» de «un ingeniero de apellido Fanovich [que] era el jefe del MOP» en Chiriquí, y sigue: «¿por qué me atreví a ir a donde Fanovich? Porque él es un ingeniero que goza de carrera administrativa en la Contraloría». La regla de 6.2 (l. 939) salta el apellido pegado a «de apellido», pero no las veces siguientes. La revisión 6 ya señalaba este «donde Fanovich».

Reglas:
- Un nombre sin forma que forma parte de una enumeración solo va a un miembro si otro elemento de la enumeración es miembro o si la cláusula lleva una forma de miembro («legisladores», «colega»).
- Tras «de apellido X» o «apellidado X», no atribuir a un miembro las apariciones sueltas de X en el resto de la intervención.

### 2. Resolución débil con un cargo externo en aposición (#5)

«La Cortesía de Sala para su Excelencia el licenciado Ricardo Arias, Ministro de Relaciones Exteriores» (18-9-1997) va al legislador Ricardo Rivera Arias (PA01101). Es el canciller Ricardo Alberto Arias, que habla poco después con el rótulo «RICARDO ALBERTO ARIAS-MINISTRO DE RELACIONES EXTERIORES» y nunca fue legislador. `resolver()` (l. 434-438) acepta a un único miembro con escaño aunque la coincidencia sea de fuerza 1: nombre de pila y segundo apellido, sin el primero.

Reglas:
- No aceptar la fuerza 1 sin una prueba en la sesión: que esa persona hable, presida o se le hable.
- Si al nombre le sigue en aposición un cargo de Gobierno o de otra institución («…, Ministro de Relaciones Exteriores») o le precede «su Excelencia», tratarlo como persona externa.

### 3. Miembros que quedan como persona externa (#20, #23)

- #20 (18-8-2004): «felicitar a la nueva Ministra de Vivienda, que procede de mi circuito, la ingeniera Balbina Herrera». Balbina Herrera era legisladora del PRD en 1999-2004 y fue ministra desde el 1-9-2004. `oradores.json` le da sexo M, y con una forma femenina el filtro de género estricto (l. 416) la descarta. Queda sin candidato y sale como persona externa. Sus 6 menciones de la salida son externas, y «legisladora Balbina Herrera» (2001) queda sin resolver.
- #23 (11-3-2009): «la desaparición de nuestro colega Tomás Gabriel Altamirano-Duque Mantovani», diputado del PRD muerto el 28-2-2009. El nombre tiene una palabra más que los dos registros de `oradores.json`, «TOMÁS GABRIEL ALTAMIRANO M» (PA01208) y «TOMÁS GABRIEL ALTAMIRANO-DUQUE» (PA01209). `fuerza()` (l. 128) da 0 y la mención sale como persona externa. En la misma sesión, otras 7 menciones del homenaje («Honorable Diputado Tomás Gabriel Altamirano-Duque Mantovani») quedan sin resolver. Es la misma causa que CR #19.

Reglas:
- Corregir el sexo de Balbina Herrera en `oradores.json`. Con género estricto, no descartar al único candidato con fuerza 3; marcarlo como de sexo dudoso.
- En `fuerza()`, dar fuerza 3 también cuando el nombre del orador es subsecuencia de la mención, con el mismo primer nombre de pila y sus apellidos al final (una inicial vale por la palabra que empieza por esa letra).
- Unir los dos `id_dep` de Altamirano, como los de Abel Beker (PA00005 y PA01288).

## Menciones que no deberían contar (5 de 40)

Las cinco tienen bien la identidad, salvo #12, que además es incorrecta.

- **Turnos de la Mesa con rótulos que no se reconocen (#1, #14).** En #1, «VICENTA MELANIA HERRERA, RELATORA» lee «Los honorables diputados Fernando Carrillo y Rubén De León proponen…». En #14, «JERRY WILSON NAVARRO, PRESIDENTE DE LA ASAMBLEA LEGISLATIVA» da la palabra («Continúa en el uso de la palabra, el honorable legislador José I. Blandón»). `esPresidenciaEtiqueta` (l. 152-157) reconoce «relator» o «secretario» al principio del rótulo, «secretario» y «asistente del secretario» tras una coma, y «presidente (encargado)» al final. No reconoce «, RELATORA», «, RELATOR DE LA ASAMBLEA», «-ASISTENTE DEL SECRETARIO GENERAL» (la l. 153 solo cambia el guion por un espacio si va entre espacios) ni «, PRESIDENTE (ENCARGADO) DE LA ASAMBLEA LEGISLATIVA». En la salida son 81 de 853 menciones de estas categorías (9 %): 50 de la Relatoría, 17 del asistente del secretario y 14 de la Presidencia. Regla: tras coma o guion, aceptar «relator(a)», «asistente del secretario», «secretario general» y «presidente/a (encargado/a)» aunque sigan «de la Asamblea…».
- **Pasajes duplicados (#11, #12, #19).** Las actas del 30-6-2004, del 18-8-2004 y del 6-10-2004 repiten buena parte de sus intervenciones con otra transcripción («Rubén de Lebn» y «Rubén de León»; «televi&n» y «televisión»). He contado como duplicada la copia posterior. En la salida, unas 104 menciones de estas categorías (12 %) están en filas que repiten al menos la mitad del texto de una fila anterior de la misma sesión: 44, 11 y 47 en esas tres actas y 2 en una de 2022. Regla: deduplicar esas filas antes de detectar, o en `diaries-dedupe`; en el detector, saltar la fila cuyo texto normalizado repite en su mayor parte el de una fila anterior de la sesión.

## Otras observaciones

- **Cortizo en dos nodos, y el criterio para futuros jefes de Estado.** El 21-2-2019, «Nito Cortizo» sin forma va a la persona externa (#28, #29), y «nuestro candidato presidencial, Nito Cortizo», en la misma sesión, al nodo de miembro como antiguo miembro. El 26-1-2022, «Presidente Laurentino Cortizo Cohen», ya en el cargo, también va al nodo de miembro: `jefeDe` (l. 287-296) exige que la mención acabe en la clave de la tabla («cortizo»), y la rama del nombre completo (l. 498-503) exige que el nombre de la tabla acabe en la mención. He dado #28 y #29 por correctas porque 6.2 manda a los jefes de Estado sin escaño ese día a su nodo externo. Si un futuro jefe fuera antiguo miembro hasta su mandato, serían incorrectas y la precisión bajaría a 32/40 (80 %). En Costa Rica, Chinchilla en 2008 va al nodo de miembro por un escaño espurio (CR #9). Regla: poner en la tabla de jefes el nombre completo («Laurentino Cortizo Cohen») y el alias («Nito Cortizo»), y fijar un solo criterio para las menciones anteriores al mandato.
- #19: la misma médica tiene dos claves, «guadalupe maria reyes gonzalez» y «maria guadalupe reyes gonzalez», porque la unión de claves (l. 795-811) solo junta una clave con otra que empieza igual.
- «Se dirige» aparece en #14, que es una fórmula de la Presidencia.
- Siguen, fuera de la muestra, «General Torrijos» atribuido a Martín Torrijos (7 menciones) y la persona externa «egoro» (10), ya señalados en la revisión 6.

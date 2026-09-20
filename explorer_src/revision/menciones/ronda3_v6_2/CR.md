# Precisión de las menciones, versión 6.2: Costa Rica (Asamblea Legislativa)

Muestra: `node muestra_precision7.cjs paises/CR 8 31` sobre `paises/CR/menciones6_2.json`, hasta 8 menciones al azar por categoría. Son 43: «miembro, cargo sin nombre» está vacía en la salida y «externa, antiguo orador sin escaño» tiene 3, todas en la muestra. Cada mención se ha revisado con la intervención completa en `biblioteca.json`, las filas de alrededor y `oradores.json`. Las fuentes externas consultadas van en el motivo de cada caso, en `revision7/CR.json`. Los números (#) son los de la muestra y las líneas citadas son de `detectar6_2.cjs`.

Criterio: una mención es correcta si va al nodo que prescribe la versión 6.2. Para un miembro, es la persona a la que se refiere el texto, con escaño en esa legislatura según `oradores.json` o, si va como antiguo miembro, con escaño anterior en la muestra. Para una externa, es una persona real bien identificada que no debía ser nodo de miembro; los jefes de Estado van siempre a su nodo externo. Si la persona es la correcta pero el nodo no, la mención cuenta como incorrecta. La columna «Persona» da la precisión mirando solo la identidad. «No deberían contar» señala menciones bien atribuidas que la salida no debería incluir (sumario, Mesa, duplicados) y no cambia el veredicto.

## Precisión

| Categoría | En la salida | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Persona | No deberían contar |
|---|---:|---:|---:|---:|---:|---|---:|---:|
| Miembro, con tratamiento o cargo | 1418 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 4 |
| Miembro, apellido suelto | 33 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 2 |
| Miembro, cargo sin nombre (por fecha) | 0 | – | – | – | – | – | – | – |
| Externa, con cargo o título | 500 | 6 | 2 | 0 | 6/8 | 41–93 % | 7/8 | 0 |
| Externa, antiguo orador sin escaño | 3 | 3 | 0 | 0 | 3/3 | 44–100 % | 3/3 | 0 |
| Externa, apellido suelto | 105 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 1 |
| Externa, cargo sin nombre (por fecha) | 108 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 1 |
| **Total** | 2167 | **41** | 2 | 0 | **41/43 (95 %)** | 85–99 % | 42/43 | 8 |

- No hay dudosas.
- Ponderada por el tamaño de cada categoría, la precisión estimada ronda el 94 %. Es una cifra orientativa: con 8 casos por categoría los intervalos son amplios, y pesan mucho las 1418 menciones de miembro con tratamiento.
- La identidad falla en una sola mención (#24). El otro error (#19) es la persona correcta en el nodo equivocado.
- Lo que más pesa ya no es la identidad, sino lo que se cuenta: 8 de las 43 menciones no deberían contar. La causa principal, el sumario del acta, da 307 menciones de la salida (14 %); 304 son de la categoría de miembro con tratamiento, el 21 % de ella.
- Frente a la revisión 6 (`revision6/CR.md`, 42/51 con otra semilla), no aparece ninguno de sus errores, y en la salida completa están corregidos: ya no hay cargos sin nombre de miembro (eran 17), «el presidente de la República» de 2018-2022 va a Carlos Alvarado (3), «el señor Chaves» de 2025 va a Rodrigo Chaves, Miguel Ángel Rodríguez es un solo nodo externo (10 menciones) y Méndez Mata, uno de miembro (6). Siguen el sumario y las lecturas de la Secretaría que aquella revisión ya señalaba.

## Errores que quedan, por causa

### 1. Un nombre con más palabras que el del registro deja fuera al miembro (#19)

En «que esperamos igualmente, que don Juan Guillermo Hermenegildo de Jesús Brenes Castillo también apoye» (2-2-1995), Fajardo nombra en broma, con sus nombres de bautismo, al diputado Juan Guillermo Brenes Castillo (Unión Agrícola Cartaginés, 1994-1998, 540 intervenciones). Justo antes ha hecho lo mismo con «don Francisco Cipriano Saturnino Lizano Gutiérrez». `fuerza()` (l. 128) exige que las palabras de la mención sean una subsecuencia del nombre del orador. Con «Hermenegildo» y «Jesús» de más devuelve 0, no queda candidato y el nombre sale como persona externa con clave propia. Es la misma causa que en Panamá deja fuera a Tomás Gabriel Altamirano-Duque Mantovani (PA #23).

Regla: dar fuerza 3 también a la inclusión inversa: el nombre del orador es subsecuencia de la mención, con el mismo primer nombre de pila y sus apellidos al final (una inicial vale por una palabra que empiece por esa letra). Si hay más de un orador así, desempatar como ahora.

### 2. «Ministro + apellido» unido al jefe de Estado del mismo apellido (#24)

«Allegados al ministro Arias y al Presidente de la República» (6-5-2008) va a Óscar Arias. Es Rodrigo Arias Sánchez, ministro de la Presidencia: Salom sigue con «o tiene razón el ex ministro Berrocal o tiene razón el Ministro de la Presidencia», y en la misma sesión Echandi nombra al «señor ministro de la Presidencia, don Rodrigo Arias». La rama de cargos de Gobierno (l. 527-537) crea la externa con la clave de una palabra «arias». Después, la unión de claves de una palabra (l. 813-819) la pega a la persona más citada con ese apellido, «oscar arias», sin mirar el cargo ni la fecha. Rodrigo Arias solo tiene escaño en 2022-2026 y aquí no se le nombra completo, así que la mención debía ser la persona externa Rodrigo Arias.

Regla: al unir una clave de un solo apellido que llega con un cargo de Gobierno («ministro», «ministra», «viceministro»…), no llevarla al jefe de Estado que está en el cargo ese día, porque el presidente no es ministro. Unirla a la persona que la misma sesión nombra con ese apellido y nombre completo o con ese cargo («don Rodrigo Arias») y, si no la hay, dejarla como apellido solo.

## Menciones que no deberían contar (8 de 43)

Las ocho tienen bien la identidad.

- **Sumario del acta dentro de intervenciones (#1, #3, #4, #7).** Las líneas del índice, con rótulo, dos puntos, tabulador y página («EL PRESIDENTE FRANCISCO ANTONIO PACHECO FERNÁNDEZ: 26»), quedan en filas atribuidas al diputado del rótulo anterior del índice. Son 76 filas de 7 sesiones (2004-2013) con 307 menciones: 304 de miembro con tratamiento y 3 externas. La regla de rótulos en mayúsculas (l. 660) no las quita: hasta 2008 esas filas están casi enteras en mayúsculas y la regla se desactiva en ellas (`mayusculaTodo`, l. 627); desde 2012 el índice va en mayúsculas y minúsculas («Diputado Luis Fernando Mendoza Jiménez: 40»). La regla de entradas del sumario (l. 655) solo reconoce los puntos suspensivos. La revisión 6 ya proponía la regla y no está en 6.2. Regla: descartar la mención si su línea acaba en dos puntos seguidos de tabulador o espacios y un número de 1 a 3 cifras, y saltar las filas en que al menos el 30 % de las líneas son así (88 filas de la biblioteca).
- **Lectura de la Secretaría (#16, #34).** El presidente pide al segundo secretario que lea la nota de la ministra de Justicia a Malavassi (CR004043300049) y después le da las gracias («Gracias, señor Segundo Secretario», CR004043300051). La fila de la lectura va a nombre de Mario Calderón Castillo, diputado y segundo secretario, así que ni el rótulo ni la Presidencia deducida la delatan. Regla: tratar como lectura de la Mesa la fila que sigue a un turno que pide a un secretario «dar lectura» o «hacer lectura», cuando el turno siguiente empieza por «Gracias, señor (primer | segundo) secretario»; como mínimo, la fila que empieza por «Nota de…» u «Oficio…» y sigue con un membrete.
- **Firma del acta (#11).** «Antonio Álvarez Desanti / PRESIDENTE / Álvaro Azofeifa Astúa / Manuel A. Barrantes Rodríguez / PRIMER SECRETARIO / SEGUNDO SECRETARIO», al pie del acta, dentro del turno de cierre de quien preside («Se levanta la sesión»), que no se ha reconocido como de la Presidencia. Es el único caso de firma en la salida. Quedan otros turnos de quien preside sin reconocer: 15 menciones de la salida siguen a una fórmula de dar la palabra, en sesiones de 1995, 1997, 2002 y 2008. Regla: saltar los nombres seguidos, en la línea siguiente o tras tabuladores, de «PRESIDENTE», «PRIMER SECRETARIO» o «SEGUNDO SECRETARIO», y tratar como de la Presidencia la fila que contiene «Se levanta la sesión».
- **Cargo y nombre en aposición contados dos veces (#43, con #18).** En «al señor presidente de la República, doctor Óscar Arias Sánchez» cuentan el cargo sin nombre y el nombre. La comprobación de la l. 739 («con nombre: ya contada») solo admite «señor», «señora», «don» o «doña» entre la coma y el nombre, no «doctor». Son 2 casos en la salida. Regla: admitir en esa comprobación cualquier tratamiento del país («doctor», «licenciado», «ingeniero»…).

## Otras observaciones

- **Futuros jefes de Estado.** #9 y #14 (Chinchilla, junio de 2008) van a su nodo de miembro porque `oradores.json` le da escaño en 2006-2010 por una sola intervención, del 8-5-2006, cuando era vicepresidenta. Con esa fila, 6.2 aplica su excepción para el futuro jefe de Estado con escaño en esa legislatura (la de Mujica en 1999 o Cortizo en 2004). Sin ella, la regla de los jefes la mandaría a la persona externa «laura chinchilla», como hace con Cortizo en Panamá en 2019 (PA #28). Las he dado por correctas con los datos de `oradores.json`. Si el escaño espurio no cuenta, serían incorrectas (39/43). Si en cambio un futuro jefe es antiguo miembro hasta su mandato, lo que falla es el caso de Panamá. Conviene fijar el criterio y no dar escaño con las filas del traspaso de poderes (del 1 al 8 de mayo del primer año), como ya proponía la revisión 6.
- «Se dirige» aparece en #2, que habla de Taitelbaum en tercera persona.
- Fuera de la muestra: en el homenaje del 10-3-2015, 9 menciones de «doctor Rafael Ángel Calderón Guardia» y «doctor Calderón» van a Mario Calderón Castillo (PUSC, 2002-2006) como antiguo miembro. «guardia» está en `noPersona` (`formas_paises_v6_2.cjs`, l. 54) y corta el nombre en «Calderón»; después, la rama de varios candidatos sin escaño (l. 570-577) elige al Calderón con escaño anterior más activo. Regla: no cortar en una palabra de `noPersona` que va pegada a un apellido sin artículo, y añadir a Calderón Guardia a los `historicos` de Costa Rica.

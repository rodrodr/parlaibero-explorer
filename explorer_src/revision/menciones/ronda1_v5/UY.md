# Precisión de las menciones: Uruguay (Cámara de Representantes)

Muestra: `node muestra_precision.cjs paises/UY 10 7`, 10 menciones por categoría. La categoría «miembro por cargo sin nombre» está vacía (UY no tiene cargos sin nombre configurados), así que se revisaron 50 menciones. El detalle está en `UY.json`.

Cada mención se juzgó con su intervención completa en `biblioteca.json`, las filas de alrededor y `oradores.json`. Cuando hizo falta saber quién era alguien, se consultó una fuente, que se cita en el motivo.

## Precisión

| Categoría | Menciones en la salida | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|
| Miembro con tratamiento o cargo | 1.495 | 9 | 1 | 0 | 90 % |
| Miembro por apellido suelto | 179 | 8 | 2 | 0 | 80 % |
| Miembro por cargo sin nombre | 0 | – | – | – | – |
| Externa con cargo o título | 970 | 10 | 0 | 0 | 100 % |
| Externa, antiguo miembro | 49 | 1 | 9 | 0 | 10 % |
| Externa por apellido suelto | 75 | 8 | 2 | 0 | 80 % |
| **Total** | | **36** | **14** | **0** | **72 %** |

No hay menciones dudosas. El total no está ponderado por el tamaño de cada categoría, y con 10 casos por categoría el margen de error es amplio. Las dos categorías más grandes, que son las menciones de miembros con tratamiento y las externas con cargo, dan 19 aciertos de 20.

## Patrones de error

### 1. Representantes en ejercicio tratados como personas externas (6 errores)

- n.º 33 y 39: Federico Bouza, en 1986. Pide la interrupción en la misma sesión.
- n.º 34 y 37: Eduardo Jaurena, en 1988. Habla dos filas antes.
- n.º 36: Jorge Pacheco Klein, en diciembre de 1995. Figura en la lista de asistencia de esa misma sesión.
- n.º 41: José Mujica, en la lista de asistencia de mayo de 1999, cuando era representante.

Los cinco primeros salen como «externa, antiguo miembro» porque en `oradores.json` faltan muchos partidos en varias legislaturas. En la XLII hay 47 entradas sin partido de 205, en la XLIV 71 de 220, en la XLV 79 de 234 y en la XLVIII 75 de 328. Como el país «tiene partidos», `senta()` no da escaño sin partido. En la salida completa, 23 de las 49 «externa, antiguo miembro» son personas cuyas legislaturas abarcan la fecha de la mención.

Mujica es otro caso. Por estar en la lista de jefes de Estado, su apellido suelto se asigna siempre a la persona externa (`hoy.length = 0`), aunque en esa fecha tuviera escaño.

Reglas que lo evitarían:
- En `senta()`, aceptar como escaño una legislatura con intervenciones aunque falte el partido.
- Usar como prueba de escaño la lista de asistencia de la propia sesión.
- Para jefes de Estado e históricos, aplicar «siempre ellos» solo si la persona no tiene escaño en esa legislatura. Mujica Cordano tiene intervenciones en la XLIV.

### 2. Homónimos resueltos contra un miembro de otra época o de otro sexo (4 errores)

- n.º 31, 32 y 38: «la doctora Ruocco», directora de Epidemiología del MSP en 1991, se atribuye a Humberto J. Ruocco Cambón, un hombre que fue representante en 2002.
- n.º 40: «el periodista Preve», en 2021, es Eduardo Preve, despedido de Canal 10 ese año. Se atribuye a Federico Preve Cocco, representante desde 2025.

En la salida completa, 22 de las 49 «externa, antiguo miembro» son personas que solo tuvieron escaño después de la fecha de la mención.

Reglas que lo evitarían:
- No resolver por el apellido solo a quien solo tuvo escaño después de la fecha.
- Respetar el género de la forma. Hoy, en `resolver()`, si ningún candidato es del sexo que marca «la doctora», se conservan todos (`if (g.length) cs = g`). Debería quedar sin resolver.
- Tras una forma de oficio o de tratamiento («el periodista», «la doctora») seguida de un apellido solo, dejar la persona externa con la clave del apellido, salvo que haya un miembro con escaño ese día.

### 3. Apellido suelto de un miembro dentro del nombre de otra persona (2 errores)

- n.º 16: «la señora Poyleaud de Gandini», una maestra citada por su apellido de casada, se atribuye a Jorge Gandini.
- n.º 18: «Píriz Mac Coll», autor de un trabajo de 1953, se atribuye a Jorge Coll.

La regla actual solo descarta la mención cuando la palabra con mayúscula de delante es un nombre de pila o forma el nombre de otro orador.

Reglas que lo evitarían:
- Descartar la mención cuando la precede cualquier palabra con mayúscula que no sea una forma de tratamiento ni del propio miembro («Mac», «Píriz»).
- Descartarla también en el patrón de apellido de casada: «señora X de Apellido».

### 4. Desempate por actividad a favor del homónimo equivocado (1 error)

- n.º 8: «el señor Diputado García», en 1986, se atribuye a Washington García Rijo porque tiene mucha más actividad (1.265 intervenciones frente a 51). Pero es Alem García, que se opone al proyecto. En esa misma sesión, el «SEÑOR GARCÍA» sin identificar sigue interviniendo desde la banca mientras García Rijo preside, y Nión lo llama «Alem García». La actividad de García Rijo incluye sus turnos en la Presidencia.

Reglas que lo evitarían:
- Para desempatar, contar solo las intervenciones desde la banca.
- Si en la sesión hay turnos sin identificar con ese apellido («SEÑOR GARCÍA») mientras uno de los candidatos preside, no elegir al que preside.
- En la duda, dejar la mención como ambigua.

### 5. Hipocorísticos (1 error)

- n.º 45: «don "Pepe Batlle"» es José Batlle y Ordóñez y se atribuye a Jorge Batlle. La regla de la palabra de delante no lo descarta porque «Pepe» no figura como nombre de pila de ningún orador.

Reglas que lo evitarían:
- Un alias en la configuración de UY («pepe batlle», «don pepe» → José Batlle y Ordóñez), y añadir a José Batlle y Ordóñez (y a Luis Batlle Berres) a los `historicos` de UY.
- Una lista de hipocorísticos comunes (Pepe, Paco, Lucho, Toto…) que cuenten como nombres de pila en esa regla.

## Otras observaciones que no se cuentan como error

- Listas de asistencia. Seis filas de apertura de sesión llevan como orador la cabecera («SEÑOR MARTIN GARCIA NIN Y DOCTOR HORACIO D»), que el corpus asigna a Bertolini San Martín. Sus listas «Asisten los señores Representantes: …» se cuentan como menciones de Bertolini. Son 21 de las 179 menciones de miembros por apellido suelto, y 6 de las 10 de esa categoría en la muestra (n.º 11, 12, 15, 17, 19 y 20). La persona está bien identificada, pero la mención no existe. Se evitaría saltando el bloque que va de «Asisten los señores Representantes» a «Asuntos entrados», o las filas cuya etiqueta de orador es una cabecera.
- Nodos duplicados por grafía: «delpiazzo» y «carlos delpizzo» (n.º 22 y 29); «norberto sanguinetti» y «norberto sanginetti» (n.º 28 y 30). Se evitarían uniendo claves a distancia de edición 1 cuando el apellido tiene 7 o más letras y los nombres de pila son compatibles.
- Fuera del detector: en la sesión de 1988 (n.º 28 y 30), el orador «SEÑOR GARCIA» está asignado a García Rijo. Sin embargo, el llamado a sala lo firma «Alex [Alem] García, Representante por Montevideo», y García Rijo era representante por Rocha. Parece la misma confusión entre los dos García, esta vez en el emparejamiento de oradores del corpus.

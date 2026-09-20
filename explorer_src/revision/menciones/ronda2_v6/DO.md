# Precisión del detector de menciones, versión 6: República Dominicana (Cámara de Diputados)

Muestra: `node muestra_precision6.cjs paises/DO 8 23` sobre `paises/DO/menciones6.json` (hasta 8 menciones por categoría, semilla 23). Se juzgaron 42 menciones. La categoría «externa, antiguo orador sin escaño» está vacía en la salida. Para cada mención se leyó la intervención completa en `biblioteca.json` y las de alrededor, y se comprobaron en `oradores.json` el escaño en la legislatura y los homónimos. Las fuentes externas consultadas figuran en el motivo de cada caso. El detalle está en `revision6/DO.json`. Los números entre paréntesis remiten a ese archivo y las líneas citadas son de `detectar6.cjs`.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) |
|---|---:|---:|---:|---:|---:|---:|---|
| Miembro, con tratamiento o cargo | 189 | 8 | 8 | 0 | 0 | 100 % | 68–100 % |
| Miembro, apellido suelto | 2 | 2 | 2 | 0 | 0 | 100 % | 34–100 % |
| Miembro, cargo sin nombre (por fecha) | 38 | 8 | 0 | 8 | 0 | 0 % | 0–32 % |
| Externa, con cargo o título | 199 | 8 | 7 | 1 | 0 | 88 % | 53–98 % |
| Externa, antiguo orador sin escaño | 0 | 0 | – | – | – | – | – |
| Externa, apellido suelto | 12 | 8 | 6 | 2 | 0 | 75 % | 41–93 % |
| Externa, cargo sin nombre (por fecha) | 18 | 8 | 8 | 0 | 0 | 100 % | 68–100 % |
| **Total** | 458 | 42 | **31** | 11 | 0 | **74 %** | 59–85 % |

No hay dudosas.

- El 0 % de los cargos sin nombre de miembro no se debe al azar de la muestra. Las 38 menciones de esa categoría tienen el mismo error (patrón 1), así que en la salida completa son 0 de 38.
- El total mezcla categorías de tamaños muy distintos. Si se pondera cada una por su tamaño en la salida, con los recuentos completos donde se conocen (0 de 38 cargos sin nombre de miembro, 8 de 12 apellidos sueltos de externas), la precisión estimada de las 458 menciones ronda el 85 %.
- Seis menciones no deberían contar aunque se hubieran atribuido bien, y las seis están entre las incorrectas. Cinco nombran el cargo en abstracto: cuatro son la cláusula del artículo 93 de la Constitución que la relatora lee en cada informe de contratos (12, 14, 15, 18) y la otra dice «no importa cómo se llame» (11). La sexta duplica la mención con nombre que la sigue (17). Ninguna de las 31 correctas debe descartarse.

## Errores que quedan

### 1. «El Presidente de la República» de 2004 a 2012 se atribuye a Omar Fernández, hijo de Leonel (8 de 8; 38 de 38 en la salida)

Casos 11 a 18. Entre el 16 de agosto de 2004 y el 16 de agosto de 2012 la tabla de jefes da Leonel Fernández. El camino de los cargos sin nombre (l. 551–561) resuelve después ese nombre contra la lista de oradores:

1. `resolver(['leonel', 'fernandez'])` (l. 558) encuentra a Omar Leonel Fernández Domínguez con fuerza 2: «Leonel» está entre sus nombres de pila y «Fernández» abre sus apellidos (l. 97; el comentario de esa misma línea advierte que «Leonel Fernández» no es Omar Leonel). Ningún orador tiene fuerza 3 y Omar no tiene escaño en esa legislatura, así que sale «otra legislatura» (l. 326).
2. La l. 559 lo acepta como miembro porque `tuvoEscano` (l. 237) es cierto: Omar tuvo escaño en 2020–2024. Además lo marca `antiguo: !r.sentado`, aunque ese escaño llegó entre 9 y 16 años después.

Las menciones con nombre ya no fallan: las 24 de «Leonel Fernández» con cargo o tratamiento van a la persona externa «leonel fernandez» (l. 372–377), y ninguna a Omar. El fallo está solo en este camino, que no aplica las dos comprobaciones que la versión 6 añadió en los demás.

Regla: en la l. 559, aceptar al miembro solo si lleva el nombre completo del jefe (`r.s === 3 && r.d.pila[0] === M[0]`, como en la l. 375). Si no tiene escaño ese día, exigir además `escanoEnBiblioteca(r.d, leg) === 'antes'` (l. 240) en lugar de `tuvoEscano`. En otro caso, persona externa con la clave del jefe (l. 560). Así las 38 irían a «leonel fernandez».

Aun bien atribuidas, cinco de las ocho no nombran a una persona. 12, 14, 15 y 18 son la cláusula del artículo 93 de la Constitución («aprobar o desaprobar los contratos que le someta el Presidente de la República»), que la relatora lee en cada informe de contratos; son 10 de las 38 de la salida. La 11 es explícitamente genérica («no importa cómo se llame. Ocurrió con el doctor Balaguer, con Hipólito Mejía…»). La 17 duplica la mención con nombre que viene detrás («el Presidente de la República, doctor Leonel Fernández Reyna»): la comprobación de la l. 554 solo salta el cargo si tras la coma viene «señor», «señora», «don», «doña» o una mayúscula, y aquí viene «doctor». La 11 sale además como «se dirige», porque `vocativoDe` no mira el artículo con que empieza la propia mención («del»).

Reglas complementarias: ampliar la comprobación de la l. 554 a cualquier forma de tratamiento («doctor», «licenciado», «ingeniero»…); y no atribuir el cargo cuando la oración cita una norma («artículo N … de la Constitución», «establece como facultad») o lo declara genérico.

### 2. Un hipocorístico impide reconocer a un diputado en ejercicio (1 de 8 externas con cargo)

Caso 19. «el amigo Rafa Gamundi» (31 de mayo de 2001) queda como persona externa «rafa gamundi». Es Rafael Gamundi Cordero, del PRD, con escaño en 1998–2002, que acababa de intervenir en ese debate (DO001005400023). `candidatos` (l. 102–105) busca solo por la primera palabra de la mención. «Rafa» no forma parte del nombre de ningún orador ni está en `HIPOCORISTICOS` (l. 52), así que no hay candidatos y la mención pasa a externa.

Regla: si la primera palabra no da candidatos, buscar por la última (el apellido) y aceptar al miembro con escaño ese día cuyo primer nombre empieza por esa palabra, con al menos tres letras («Rafa» → «Rafael»). Otra opción, más estrecha, es una tabla de equivalencias («rafa» → «rafael»).

### 3. El apellido suelto de una figura histórica nombra una provincia o una fundación (2 de 8; 4 de 12 en la salida)

- «la provincia fue hecha segmentando otras provincias, como La Vega y Duarte» (32) es la provincia Duarte. `INST_SUELTO` (l. 683) solo mira el sustantivo de lugar inmediatamente anterior, con hasta tres palabras con mayúscula en medio. En una enumeración de provincias, ese sustantivo queda lejos.
- «¿cuál es el equilibrio entre la Peña Gómez, la Joaquín Balaguer y la Juan Bosch…?, la Juan Bosch tiene nueve millones… para con estas fundaciones» (33) es la Fundación Juan Bosch. La comprobación del artículo de otro género (l. 507–509) se aplica a las menciones con forma, no a los apellidos sueltos. Por eso caen también, fuera de la muestra, «la Joaquín Balaguer» y el otro «la Juan Bosch» del mismo turno.

Reglas: (a) en `probar` (l. 707), aplicar la comprobación del artículo al nombre completo, es decir, al apellido suelto con los nombres de pila de la persona que lo preceden: «la Juan Bosch» es una institución; (b) rechazar el suelto de una figura histórica si en la misma oración aparece antes «provincia(s)» o «municipio(s)», o si va coordinado con un topónimo («La Vega y Duarte»).

## Lo que la versión 6 ya resuelve en esta muestra

- Las menciones con nombre del expresidente Leonel Fernández ya no van a su hijo (patrón 1).
- Los apellidos sueltos de miembro se buscan por el apellido. Los dos «Suazo» (9, 10) son Juan Suazo Marte, el único Suazo con escaño en 2010–2016, que interviene en la sesión.
- El antiguo miembro funciona cuando el escaño es anterior. «Presidente del Senado de la República, Reinaldo Pared Pérez» (7) va al mismo nodo de miembro, porque fue diputado en 1998–2002.
- Los cargos sin nombre fuera del mandato de Leonel Fernández van bien a la persona externa: 8 de 8 en la muestra (Danilo Medina y Luis Abinader), y también los 2 de Hipólito Mejía de la salida, que se leyeron aparte.
- En la muestra no aparecen los restos de formulario de la versión 5 («Preparado», «Antonio Musa»).
- 9 de las 42 menciones salen de filas sin orador: 8 de la relatora que lee informes de contratos y una fila con la etiqueta «Partido Reformista Social Cristiano» (41). Las que llevan nombre están bien identificadas, pero no tienen fuente.

## Fuera de la muestra (revisión de la salida completa; no cuenta en la precisión)

- **Un antiguo miembro con cargo externo es otro nodo.** «exdiputado Manuel Jiménez» (2017) va al miembro Manuel de Jesús Jiménez Ortega, con escaño en 2002–2016. En cambio, «alcalde Manuel Jiménez» (2022, 2 menciones) va a la persona externa «manuel jesus jimenez ortega»: el camino de las formas externas (l. 391–399) no mira `escanoEnBiblioteca`, y el principio del antiguo miembro no se aplica.
- **Segundos nombres y apellidos que también son nombres de pila.** «licenciado Abel Martínez Durán» y «compañero Abel Martínez» (2022, 4 menciones) quedan como persona externa. Sin embargo, Abel Atahualpa Martínez Durán tuvo escaño en 2002–2016 y presidía la Cámara en 2011 (DO004009200081); en la misma sesión de 2022 se le llama «el pasado presidente de esta Cámara». «Atahualpa» no está en `nombres_pila.json` y pasa por primer apellido, así que «Abel Martínez Durán» solo tiene fuerza 1. Al revés, «honorable exdiputado Aníbal Rosario» (2017, 2 menciones) queda como externa aunque Aníbal Rosario Ramírez tuvo escaño en 2002–2016: «Rosario» cuenta como nombre de pila (17 en `nombres_pila.json`), y «Aníbal Rosario» también se queda en fuerza 1. Regla: en castellano, con cuatro palabras sin partículas, suponer dos nombres y dos apellidos; con tres, un nombre y dos apellidos, salvo que la segunda sea nombre de pila y no apellido de ningún otro orador del país. Una palabra precedida de partícula («de la Cruz») es siempre apellido.
- **Una figura extranjera resuelta por actividad.** «las ergástulas… que tenía el General Gómez en las décadas de los cuarenta y cincuenta en Venezuela» (2011) va al diputado Víctor Osvaldo Gómez Casanova, «por actividad». Regla: con una forma militar y un apellido de la lista de comunes, no desempatar por actividad (l. 257–259); si no hay un miembro con esa forma, persona externa.
- **Externas que no son personas.** Son pocas: «Diputado de Monseñor Nouel» (la provincia, clave «nouel»), «señor Administrador del Banco Agrícola» y «Director Legal y Regulatorio de All American» (clave «legal regulatorio all american»). Una clave lleva pegado el «No.» de la cédula: «dionicio jesus padilla hernandez no».

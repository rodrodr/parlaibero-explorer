# Precisión del detector de menciones, versión 6.2: República Dominicana (Cámara de Diputados)

Muestra: `node muestra_precision7.cjs paises/DO 8 31` sobre `paises/DO/menciones6_2.json` (hasta 8 menciones por categoría, semilla 31). Se juzgaron 35 menciones. Dos categorías están vacías en la salida: la de cargo sin nombre de miembro y la de antiguo orador sin escaño. La de apellido suelto de miembro solo tiene 3. Para cada mención se leyó la intervención completa en `biblioteca.json` y las de alrededor, y se comprobaron en `oradores.json` el escaño en la legislatura de la fecha y los homónimos. El detalle está en `revision7/DO.json`. Los números entre paréntesis remiten a ese archivo y las líneas citadas son de `detectar6_2.cjs`.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Correctas que no deberían contar |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Miembro, con tratamiento o cargo | 174 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 3 |
| Miembro, apellido suelto | 3 | 3 | 3 | 0 | 0 | 100 % | 44–100 % | 0 |
| Miembro, cargo sin nombre (por fecha) | 0 | 0 | – | – | – | – | – | – |
| Externa, con cargo o título | 145 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 0 |
| Externa, antiguo orador sin escaño | 0 | 0 | – | – | – | – | – | – |
| Externa, apellido suelto | 11 | 8 | 5 | 3 | 0 | 63 % | 31–86 % | 0 |
| Externa, cargo sin nombre (por fecha) | 44 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 1 |
| **Total** | 377 | 35 | **31** | 4 | 0 | **89 %** | 74–95 % | 4 |

No hay dudosas.

- Dos categorías se revisaron enteras, además de la muestra. Los apellidos sueltos de externas son 7 correctos de 11. Los cargos sin nombre de externas son 37 correctos de 44; 2 de esos 37 duplican la mención con nombre que los sigue.
- Con esos recuentos completos y la muestra para el resto, la precisión estimada de las 377 menciones ronda el 97 %. Si se descuentan los errores vistos fuera de la muestra (último apartado), unos 13 en las externas con cargo y 2 en los miembros con tratamiento, baja al 93 %.
- 4 de las 31 correctas no deberían contar. Tres salen de turnos de quien preside que llevan su nombre como etiqueta (1, 7, 8) y la otra duplica la mención con nombre que la sigue (31). Quedan 27 alusiones bien atribuidas de 35.

## Errores que quedan

### 1. El apellido suelto de una figura histórica nombra una fundación o una provincia (3 de 8; 4 de 11 en la salida)

- «¿cuál es el equilibrio entre la Peña Gómez, la Joaquín Balaguer y la Juan Bosch…?, la Juan Bosch tiene nueve millones … para con estas fundaciones» (22, 23): es la Fundación Juan Bosch. En la salida cae también «la Joaquín Balaguer». La comprobación del artículo de otro género (l. 661-663) solo se aplica a las cadenas con forma, no a los apellidos sueltos de `probar` (l. 930-1009).
- «la provincia fue hecha segmentando otras provincias, como La Vega y Duarte» (26) es la provincia Duarte. `INST_SUELTO` (l. 899) solo mira el sustantivo de lugar inmediatamente anterior, y en una enumeración ese sustantivo queda lejos.

La revisión anterior ya señaló estos mismos casos, y siguen sin corregir.

Reglas: (a) en `probar`, aplicar la comprobación del artículo al nombre completo, es decir, al apellido con los nombres de pila que lo preceden: «la Juan Bosch», «la Joaquín Balaguer» y «la Peña Gómez» son instituciones; (b) descartar el suelto de una figura histórica si va coordinado con un topónimo («La Vega y Duarte») o si en la misma oración aparece antes «provincia(s)» o «municipio(s)».

### 2. El cargo sin nombre usado en abstracto o referido a otra época (1 de 8; 7 de 44 en la salida)

«los ministros consejeros, los consejeros, etcétera, son funcionarios nombrados por el Presidente de la República» (30) dice quién nombra esos cargos. No alude a Leonel Fernández.

En la salida completa hay otras cinco del mismo tipo:

- «hasta el salario del Presidente de la República» (2004);
- «las apropiaciones a disposición del Presidente de la República» (2009, texto del presupuesto);
- «la discrecionalidad del Presidente de la República, no importa cómo se llame» (2009);
- «la distribución administrativa es por un decreto del Presidente de la República» (2009);
- «el director de Compras y Contrataciones lo elige el Presidente de la República» (2025).

La séptima es de otra época. En «se pudo conseguir porque el Presidente de la República en ese entonces, Hipólito Mejía, creía en los ayuntamientos» (21 de diciembre de 2006), la mención va a Leonel Fernández. La l. 742 descarta «de entonces» y «de la época», pero no «en ese entonces». Y la l. 739 solo reconoce el nombre si sigue inmediatamente al cargo.

Reglas: (a) no atribuir el cargo si es el agente de un nombramiento en presente o futuro («nombrados por el», «lo elige el», «lo nombra el»), si va tras «el salario del», «a disposición del» o «un decreto del», o si la oración dice «no importa cómo se llame»; (b) añadir a la l. 742 «en ese entonces», «en aquel entonces» y «en esa época»; y si tras el cargo y un inciso breve viene «, Nombre Apellido» de otro jefe de Estado, atribuir la mención a ese jefe o saltarla.

## Menciones que no deberían contar

### 3. Turnos de quien preside con su nombre como etiqueta (3 de 8 miembros con tratamiento; 26 de las 395 menciones de la salida)

- Alfredo Pacheco preside la sesión del 8 de noviembre de 2022. Suyos son «Además del caso específico mencionado por doña Yuderka de la Rosa…» (1) y «Ahora, otorgo el siguiente turno previo al diputado Rafael Castillo» (7).
- Rubén Darío Maldonado preside la del 5 de junio de 2018. Suyo es «Someto a votación la conformación de la Comisión Bicameral …, que estará compuesta por el diputado Henry Modesto Merán Gil…» (8).

En cada una de esas dos sesiones, quien preside tiene 3 filas con la etiqueta PRESIDENTE, y 24 (Pacheco) o 30 (Maldonado) con su nombre. La regla de las l. 182-200 pasa a la Mesa las filas con nombre si son cortas. El umbral es una mediana de 250 caracteres (l. 196), y aquí la mediana es de 329 (Pacheco) y de 252 (Maldonado), porque entre esas filas hay lecturas de informes. En toda la salida hay 26 menciones en filas así, 24 de ellas de miembro, en tres sesiones: 31 de agosto de 2011, 5 de junio de 2018 y 8 de noviembre de 2022.

El acta dominicana anuncia esos turnos en la fila narrativa anterior: «Indicó el diputado presidente Alfredo Pacheco Osoria:», «Transcurrido el minuto de silencio, el diputado presidente Alfredo Pacheco Osoria añadió:», «Finalizada la lectura del informe…, el diputado presidente Rubén Darío Maldonado Díaz expuso:».

Reglas:

- Marcar como de la Mesa la fila con nombre que sigue a una fila sin orador terminada en «(el|la) diputad[oa] president[ea] (en funciones)? [Nombre] <verbo>:», si el nombre coincide con el orador de la fila.
- Otra opción, más amplia: en una sesión con filas PRESIDENTE, tratar como de la Mesa todas las filas del mismo `id_dep`, sin la condición de longitud, salvo que la narrativa anterior diga que interviene como diputado.
- Además, añadir «otorgo el (siguiente )?turno» y «someto a votación» a `procedimiento` (formas_paises_v6_2.cjs, l. 45).

### 4. El cargo seguido del nombre con un tratamiento distinto de «señor» (1 de 8; 2 de 44 en la salida)

En «las medidas que acaba de anunciar el Presidente de la República, doctor Leonel Fernández Reyna» (31), el cargo y el nombre dan dos menciones. Pasa igual en «ante el señor Presidente de la República, doctor Leonel Fernández Reyna» (2011). Entre la coma y el nombre, la l. 739 solo reconoce «señor», «señora», «don» o «doña». La revisión anterior ya propuso la regla, que sigue sin aplicarse: admitir cualquier forma de tratamiento («doctor», «licenciado», «ingeniero»…).

## Lo que la versión 6.2 ya resuelve

- De 2004 a 2012, el cargo sin nombre va a Leonel Fernández como persona externa. Ninguna mención va ya a su hijo, Omar Leonel Fernández, y ya no aparece la cláusula del artículo 93 que leía la relatora.
- «amigo Rafa Gamundi» (2001) va al diputado Rafael Gamundi Cordero, y «licenciado Abel Martínez Durán» (2022), al antiguo miembro Abel Atahualpa Martínez Durán.
- Los tres apellidos sueltos de miembro son correctos (Suazo y Agramonte).
- Las externas con cargo de la muestra son personas reales bien identificadas, también las que no tienen escaño en el corpus (Amable Aristy Castro, Ángel Lockward). «señor Losada» (12) es el embajador de México, Enrique Loaeza Tovar, con el apellido como lo escribe el acta.

## Fuera de la muestra (no cuenta en la precisión)

- **Antiguos miembros con cargo externo que siguen siendo otro nodo.** Son «senadora Ginnette Altagracia Bournigal» (2022; diputada en 2016-2020), «Senador Luis René Canaán» (2006; diputado en 2002-2006), «alcalde Manuel Jiménez» (2022, 2 menciones) y «exdiputado Aníbal Rosario» (2017, 2 menciones).
  - Las tres primeras pasan por el camino de las formas externas (l. 517-526). Ese camino da al orador su propia clave externa con fuerza 3 y no mira `escanoEnBiblioteca`. Bournigal ni siquiera llega a fuerza 3, porque su nombre de cinco palabras se parte como «Ginnette Altagracia Bournigal | Socías Jiménez».
  - En la cuarta, «Rosario» cuenta como nombre de pila, y «Aníbal Rosario» se queda en fuerza 1.

  Regla: en la l. 522, si el orador tuvo escaño antes en la biblioteca (`escanoEnBiblioteca(d, leg) === 'antes'`), usar su nodo de miembro con `antiguo: true`.
- **Un hipocorístico.** «Honorable Francis Mancebo» (2011) y «hermano Francis Mancebo» (2018) quedan como externas. Probablemente es Francisco Antonio Mancebo Melo (PLD, 2010-2020). «Francis» no está en `HIPO` (l. 136).
- **Apellidos de jefes de Estado o extranjeros resueltos como diputados.** «la visión que inició el doctor Fernández en el 1996» (2011) va al diputado Ramón Antonio Fernández Martínez, pero es Leonel Fernández, nombrado con nombre completo unas líneas antes en la misma intervención. «el General Gómez» de Venezuela (2011) sigue yendo al diputado Víctor Osvaldo Gómez Casanova por actividad. Regla: un apellido común con tratamiento que coincide con el de un jefe de Estado nombrado antes en la misma intervención es ese jefe.
- **Externas que no son personas.** Son «Director Legal y Director Ejecutivo…» y «Director Legal y Regulatorio de All American» (claves «legal» y «regulatorio all american»), «Monseñor Nouel» (la provincia) y «señor Administrador del Banco Agrícola».

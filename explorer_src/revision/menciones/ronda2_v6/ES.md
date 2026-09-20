# Precisión del detector de menciones, versión 6: España (Congreso de los Diputados)

Muestra de `node muestra_precision6.cjs paises/ES 8 23` sobre `paises/ES/menciones6.json`: hasta 8 menciones por categoría, 53 en total. La categoría de antiguos oradores externos solo tiene 5 en la salida. Cada mención se revisó con la intervención completa en `biblioteca.json`, los turnos vecinos de la sesión y `oradores.json`: escaño en la legislatura de la fecha, homónimos, sexo y quién interviene en el debate. Los cargos y escaños que no se deducían del corpus se comprobaron en las fuentes citadas en el motivo de cada caso y al final. El detalle está en `revision6/ES.json`, y los números entre paréntesis remiten a él. Las líneas citadas son de `detectar6.cjs`.

Criterio para los cargos sin nombre: la mención es correcta si el texto habla de quien ocupaba el cargo ese día. Cuentan como incorrectos los usos del cargo como papel («ser presidente del Gobierno»), como norma («la ley impone al presidente del Gobierno en funciones…») o en un enunciado general. La revisión anterior dio por buenos los genéricos que apuntaban al titular, así que se da también la cifra con ese criterio.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Correctas que no deberían contar |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Miembro, con tratamiento o cargo | 1.651 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 0 |
| Miembro, apellido suelto | 71 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 0 |
| Miembro, cargo sin nombre (por fecha) | 158 | 8 | 6 | 2 | 0 | 75 % | 41–93 % | 0 |
| Externa, con cargo o título | 369 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 0 |
| Externa, antiguo orador sin escaño | 5 | 5 | 5 | 0 | 0 | 100 % | 57–100 % | 0 |
| Externa, apellido suelto | 68 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 0 |
| Externa, cargo sin nombre (por fecha) | 17 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 0 |
| **Total** | 2.339 | 53 | **47** | 6 | 0 | **88,7 %** | 77–95 % | 0 |

- No hay dudosas. Si se pondera cada categoría por su tamaño en la salida, la estimación es del 87 %. Con ocho casos por categoría, cada error mueve la precisión 12,5 puntos, así que las cifras por categoría son orientativas.
- Con el criterio de la revisión anterior para los genéricos, la nº 21 sería correcta: 48 de 53 (90,6 %). La revisión de la versión 5 dio un 89,3 % en 56 menciones, con otras categorías.
- Las 53 menciones salen de debates. Ninguna es una fórmula de la Mesa, un rótulo o un duplicado. Los tres vocativos marcados («se dirige»: nº 2, 6 y 8) son reales.
- Los errores de la revisión anterior no reaparecen. En toda la salida quedan 3 rótulos de preguntas en mayúsculas («DIPUTADO DON…»), antes 39; están bien atribuidos, pero la versión 6 debería descartarlos. Ningún «presidente del Gobierno» va seguido de otra comunidad.

## Errores que quedan, por causa

### 1. El cargo como papel, como norma o como enunciado general (3 casos: nº 21, 22 y 53)

- «usted pretendió sustituir al presidente del Gobierno, es decir, ser presidente del Gobierno sin pasar por las urnas» (20-3-2018, nº 22). La primera mención de la frase es de Rajoy. La segunda es el cargo al que aspiraba quien presentó la moción de censura de 2017, y también se atribuye a Rajoy.
- «imponiéndose al presidente del Gobierno en funciones una serie de limitaciones» (13-11-1997, nº 21) resume la Ley del Gobierno. Se atribuye a Aznar, que no estaba en funciones.
- «Ser juzgado y condenado a penas de cárcel por criticar al rey en una canción viola la libertad de expresión» (14-10-2020, nº 53) se atribuye a Felipe VI. Es un enunciado general que alude a condenas como la de Valtònyc, por canciones de 2012 contra Juan Carlos I.

No es un caso raro. En una segunda muestra de 30 cargos sin nombre (semilla 77), 8 son de este tipo. Entre ellos, el orden de protocolo («después de su Majestad el Rey y del presidente del Gobierno»), «las elecciones en este país las convoca el presidente del Gobierno», una ley citada («Corresponde al presidente del Gobierno dirigir la acción exterior») y el papel del vicepresidente («existe para colaborar con el Presidente del Gobierno»). Viene a ser uno de cada cuatro.

Reglas que los evitarían (bucle de `cargosSinNombre`, l. 552–561):
- «presidente del Gobierno en funciones»: atribuir solo en los periodos en que el Gobierno estaba en funciones, con una tabla de fechas como la de mandatos.
- No atribuir tras «ser», «llegar a ser», «aspirar a (ser)» o «pretender ser».
- Tampoco en fórmulas normativas: «corresponde al», «competencias del», «facultades del», «las convoca el».
- «el rey»: no atribuir en fórmulas ni en enunciados generales («en nombre del rey», «¡viva el rey!», «por criticar al rey», «injurias al rey»), ni en el orden de protocolo («después de su Majestad el Rey»).
- Exigir «el/al/del» delante, como en los demás países, quitaría la nº 22, pero también usos correctos: vocativos («Señor presidente del Gobierno»), «usted como presidente del Gobierno», «el único presidente del Gobierno que…».

### 2. Una ciudad leída como apellido suelto (1 caso: nº 16; 12 de 71 en la salida)

«el Jefe Superior de Policía en cuestión, el jefe de Sevilla» (10-4-1991) se atribuye a Luis Mardones Sevilla (CC). El mecanismo:

1. «sevilla» entra en `apMiembro` (l. 669–677) porque la biblioteca llama «señor Sevilla» a Jordi Sevilla en la VII y la VIII.
2. `lugares` no incluye Sevilla (sí Madrid, Barcelona o Valencia). La prueba de mayúsculas la supera porque la ciudad se escribe siempre con mayúscula.
3. El pase de miembros atribuye cada «Sevilla» al único miembro con escaño ese día que lleva ese apellido en cualquier posición (`y.ap.includes(ap)`, l. 765). Así van 9 a Mardones Sevilla (IV y VI) y 3 a Manuel Sevilla Corella (Constituyente). En la VII y la VIII hay dos candidatos y se saltan.

Las 12 son la ciudad: «la Exposición Universal, de Sevilla», «el AVE a Sevilla», «el despacho de Sevilla»… Son el 17 % de las menciones de miembros por apellido suelto.

Reglas:
- Añadir a `lugares` las capitales de provincia y ciudades grandes que faltan: Sevilla, Málaga, Cádiz, Huelva, Jaén, Almería, Granada, Bilbao, Zaragoza, Toledo, Alicante, Castellón, Tarragona, Lleida, Girona, Palma, Santander, Oviedo, Pamplona, Vitoria, Logroño, Valladolid, Salamanca, Burgos, Vigo…
- En el pase de miembros, exigir que el suelto sea el apellido de referencia del miembro (`apRef(y) === ap`), no uno cualquiera: a Mardones Sevilla nunca se le llama «Sevilla».

### 3. Errata del Diario en el apellido de un diputado presente (1 caso: nº 31; 7 en la salida)

Olabarría llama cuatro veces «señor Bañó» a Francisco Vañó Ferre (PP), que habla en el mismo debate (ES011006100063) y al que describe como «la persona que más sabe en el Partido Popular» sobre discapacidad. Ningún orador se llama Bañó, así que sale la persona externa «bano».

En la salida hay otros tres casos con una letra cambiada, todos de diputados que hablan en esa sesión:
- «señor Cullel», por Josep Maria Cullell (1990);
- «señora Nova», por María del Pilar Novoa (1997);
- «señora Motero», por María Jesús Montero (2024).

Regla: antes de crear una persona externa con «señor/señora» y un apellido que no es de ningún orador, buscar entre los miembros que intervienen en la sesión un apellido a una letra de distancia o con b/v, ll/l o s/z cambiadas. Si hay uno solo, es él.

### 4. Escaño supuesto por actividad frente a una homónima que no es oradora (1 caso: nº 3)

«Cuando aquí la señora Aguirre hace un llamamiento similar a éste» (13-11-1997, debate de la ley de telecomunicaciones) se atribuye a María Jesús Aguirre Uribe (PNV). Dejó el escaño el 23 de septiembre de 1997, pero el detector la da por sentada en toda la VI porque tiene intervenciones en ella (`senta`, l. 225).

El llamamiento, «imitando a Clinton», a conectar escuelas y hospitales a las autopistas de la información apunta a Esperanza Aguirre, ministra de Educación y Cultura. Era senadora y no figura entre los oradores, así que el detector no tenía a quién más atribuirlo.

Reglas:
- Tomar el escaño de las fechas de alta y baja del Congreso, no de la actividad por legislatura.
- Dar de alta como personas externas conocidas, con las fechas del cargo, a los ministros sin escaño (senadores o no parlamentarios). Así, «la señora Aguirre» de 1997 tendría candidata.

## Otras observaciones (fuera de la muestra; no cuentan)

- **«Juan Carlos I» y un diputado.** `sinParticulas` (l. 29–31) quita la «i» del ordinal, que toma por la conjunción catalana. El cargo sin nombre «su Majestad el Rey» del 13-11-1997 (ES007011500143) se busca como «Juan Carlos» y se resuelve contra el diputado Juan Carlos Guerra Zunzunegui (PP), por actividad (l. 558). Regla: en `cargosSinNombre` con la tabla `jefes`, no llamar a `resolver`, porque un rey no es diputado; o no quitar la «i» detrás de un nombre de pila.
- **«el president espanyol, Pedro Sánchez»** (28-5-2024, intervención en catalán) sale como persona externa. «president» es forma externa, la del president de la Generalitat. Regla: si el nombre es de un miembro con escaño, «president» no lo hace externo, salvo con «de la Generalitat».
- **«los hospitales de Ribera o de Quirón»** (10-12-2025) se atribuye a Teresa Ribera; es la empresa sanitaria. Regla: plurales en `INST_LUGAR` (l. 459): «hospitales», «clínicas», «colegios»…
- **Hermanos con los mismos apellidos.** Fernando Abril Martorell (nº 27) es externo en 1978, como debe ser. Con la regla de «aún sin escaño» y los dos apellidos debería ser el nodo del miembro que fue en la I. Su hermano Joaquín (III y IV) lo hace ambiguo, y queda la persona externa «abril martorell».

## Fuentes consultadas

- María Jesús Aguirre Uribe, diputada del 10-9-1996 al 23-9-1997: https://es.wikipedia.org/wiki/María_Jesús_Aguirre (nº 3)
- Esperanza Aguirre, ministra de Educación y Cultura de 1996 a 1999, senadora y nunca diputada: https://es.wikipedia.org/wiki/Esperanza_Aguirre (nº 3)
- Fernando Abril Martorell, senador por designación real de 1977 a 1979 y diputado en la I: https://es.wikipedia.org/wiki/Fernando_Abril_Martorell (nº 27)
- Michel Girin, director del Cedre: https://www.elplural.com/politica/espana/cascos-defiende-al-unico-imputado-del-gobierno-por-el-prestige-comparandolo-con-un-bombero-impotente-ante-el-11-s_56537102 (nº 28)
- Teresa Peramato ante la Comisión de Justicia, diciembre de 2025: https://www.infobae.com/espana/agencias/2025/12/04/el-congreso-examina-hoy-la-idoneidad-de-teresa-peramato-para-relevar-a-garcia-ortiz-como-fiscal-general/ (nº 30)
- Antoni Asunción, director general de Instituciones Penitenciarias de 1988 a 1991 y diputado de 1993 a 1996: https://es.wikipedia.org/wiki/Antoni_Asunción (nº 33 y 36)
- José Manuel Franco, diputado del 21-5-2019 al 11-2-2020 y delegado del Gobierno en Madrid: https://es.wikipedia.org/wiki/José_Manuel_Franco (nº 34)
- Valtònyc, detenido el 23-8-2012 por sus canciones: https://en.wikipedia.org/wiki/Valtònyc (nº 53)

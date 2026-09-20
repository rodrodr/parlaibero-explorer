# Precisión del detector de menciones, versión 6.2: España (Congreso de los Diputados)

Muestra de `node muestra_precision7.cjs paises/ES 8 31` sobre `paises/ES/menciones6_2.json`: hasta 8 menciones por categoría, 52 en total (la categoría de antiguos oradores externos solo tiene 4 en la salida). Cada mención se revisó con la intervención completa en `biblioteca.json`, los turnos vecinos de la sesión y `oradores.json`: escaño en la legislatura de la fecha, homónimos, sexo y quién interviene en el debate. Los cargos y escaños que no se deducían del corpus se comprobaron en las fuentes citadas en el motivo de cada caso y al final. El detalle está en `revision7/ES.json`, y los números entre paréntesis remiten a él. Las líneas citadas son de `detectar6_2.cjs`.

Criterio: el de la versión 6.2. Un antiguo diputado es su nodo de miembro; con escaño solo posterior, solo con el nombre completo; el rey es siempre su nodo externo; el cargo sin nombre es correcto si el texto habla de quien lo ocupaba ese día, e incorrecto si lo usa en abstracto (una norma, una fórmula, un enunciado general). «No debería contar» no cambia el veredicto.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Correctas que no deberían contar |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Miembro, con tratamiento o cargo | 1.652 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 0 |
| Miembro, apellido suelto | 76 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 0 |
| Miembro, cargo sin nombre (por fecha) | 146 | 8 | 6 | 2 | 0 | 75 % | 41–93 % | 0 |
| Externa, con cargo o título | 355 | 8 | 5 | 3 | 0 | 63 % | 31–86 % | 0 |
| Externa, antiguo orador sin escaño | 4 | 4 | 4 | 0 | 0 | 100 % | 51–100 % | 0 |
| Externa, apellido suelto | 70 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 1 |
| Externa, cargo sin nombre (por fecha) | 18 | 8 | 6 | 2 | 0 | 75 % | 41–93 % | 0 |
| **Total** | 2.321 | 52 | **44** | 8 | 0 | **84,6 %** | 72–92 % | 1 |

- No hay dudosas. Si se pondera cada categoría por su tamaño en la salida, la estimación es del 84 %. Con ocho casos por categoría, cada error mueve la precisión 12,5 puntos: las cifras por categoría son orientativas.
- La revisión 6 dio un 88,7 % (47 de 53, semilla 23). La diferencia cabe en el azar de la muestra.
- Si la nº 30 (identidad bien, nodo externo en vez de antiguo miembro) contara como correcta, como la revisión 6 contó los nodos partidos, serían 45 de 52 (86,5 %).
- Tres de los ocho errores son las mismas menciones que la revisión 6 dio por incorrectas (nº 20, 25 y 51): la versión 6.2 no las corrige. Siguen también las otras tres erratas de apellido que señaló («Cullel», «Nova», «Motero») y los tres rótulos «DIPUTADO DON…». Sí se ha corregido la ciudad de Sevilla leída como apellido suelto (ninguna en la salida; antes, 12).
- Los dos vocativos marcados («se dirige»: nº 4 y 8) son reales. Solo una mención no debería contar (nº 37, duplicado por la traducción).

## Errores que quedan, por causa

### 1. El cargo sin nombre en abstracto (4 casos: nº 17, 20, 46 y 51)

- «por qué razón en los Presupuestos Generales del Estado de cada año el presidente del Gobierno tiene una retribución que no es comparable con la de ningún presidente ejecutivo» (25-9-2012, nº 17): el sueldo del cargo; se atribuye a Rajoy.
- «imponiéndose al presidente del Gobierno en funciones una serie de limitaciones» (13-11-1997, nº 20): resume la Ley del Gobierno; se atribuye a Aznar, que no estaba en funciones.
- «El Poder Judicial en nombre del rey» (14-10-2020, nº 46): la fórmula del artículo 117 de la Constitución; se atribuye a Felipe VI.
- «Ser juzgado y condenado a penas de cárcel por criticar al rey en una canción» (14-10-2020, nº 51): enunciado general sobre condenas por canciones contra Juan Carlos I.

Los filtros de usos genéricos de la 6.2 (l. 739–744) cubren «de la época», «de turno», «anterior», «saliente», «electo», un verbo normativo detrás, «Artículo N» delante y «ser/llegar a ser/elegir/nombrar» delante. Ninguno de estos cuatro casos. Entre los 18 «el rey» de la salida hay 6 fórmulas o enunciados generales: además de la nº 46 y la nº 51, el orden de protocolo («después de su Majestad el Rey», 1997), la fórmula de la promesa del cargo («con lealtad al rey», dos veces) y «¡viva el rey!».

Reglas (bucle de cargos sin nombre, l. 736–755):
- «presidente del Gobierno en funciones»: atribuir solo en los periodos en que el Gobierno estaba en funciones (tabla de fechas); si no, descartar.
- Delante de «el/del/al rey»: descartar tras «en nombre», «lealtad», «¡viva», «después de su Majestad» y tras «por» + infinitivo de ofensa («por criticar/injuriar/insultar al rey»).
- Descartar «el cargo del presidente del Gobierno», «la retribución/el sueldo del presidente del Gobierno» y el cargo en una frase con «cada año».

Probadas sobre la salida, estas pistas marcan 9 de los 164 cargos sin nombre, y los 9 son usos abstractos.

### 2. Un apellido con tratamiento atribuido a un antiguo diputado homónimo (1 caso: nº 1; unas 30 menciones fuera de la muestra)

«ni por supuesto del jefe del Estado de Cuba, el señor Castro» (19-12-2006) es Fidel Castro. Se atribuye a Francisco Javier Castro Feliciano (PSOE), diputado en la II. El mecanismo: con «señor» (masculino estricto), los candidatos son dos antiguos diputados sin escaño ese día, Castro Hitos (I) y Castro Feliciano (II); la rama «varios sin escaño ese día» (l. 570–574) elige al que tiene cinco veces más actividad, 6 intervenciones frente a 1. La aposición «jefe del Estado de Cuba» no cuenta.

No es un caso aislado. Fuera de la muestra, leyendo el contexto de cada mención:
- De las 23 menciones resueltas por «tuvo escaño» (esa rama), 11 son de otra persona: el ex secretario de Estado de Hacienda Sevilla (1990, 2), «el señor Martín, profesor de la Escuela de Andalucía de Salud Pública» (1997), la dimisión «del señor Manglano» junto a la del vicepresidente y la del ministro de Defensa (1998), el «imperio inmobiliario del señor Fabra» en Castellón (2006, 3), «Señor Arias» en una pregunta sobre cofradías tras el Prestige, que se atribuye a Arias-Salgado (2003), «la señora Gómez» de la cátedra de la Complutense (2024), «el señor Ortiz» de la traducción de «senyor García Ortiz» (2025) y la nº 1.
- La rama del antiguo miembro resuelto (l. 580–584) tiene el mismo problema. De las 57 menciones con tratamiento y un solo apellido, 19 son de otra persona: presidentes autonómicos («el señor Mas» en 2014 y 2018, 3; «el señor Mazón de la dana», 4; «presidente Clavijo, de Canarias», 5; «presidente Vivas, de Ceuta», 2), ministros sin escaño cuyos turnos no están enlazados a un orador (el vocativo «Señor Castells» al ministro de Universidades en 2020, «la ministra Rego» en 2024 y, dos veces, «señora Redondo» a la ministra de Igualdad en 2025) y «su exabogado, el señor Calvente» (2020). Aparte, «el presidente del Consejo Europeo, António Costa» (2025) va a Antonio Costa Costa, diputado en la IV–VI.

En España `C.parlamentario` hace «distintivo» cualquier apellido suelto (l. 583), así que la regla del antiguo miembro se aplica sin más prueba.

Reglas:
- Con un solo apellido, no hacer antiguo miembro a nadie si el apellido lo llevan varios oradores del corpus (Castro, Sevilla, Arias, Fabra) o es común (Martín, Gómez, Ortiz; `TOP10`, `COMUNES`). En la rama «tuvo escaño», exigir además una actividad mínima (con 6 intervenciones frente a 1 no hay prueba).
- Un vocativo no puede ser un antiguo miembro que no está en la sesión: si en ella responde un miembro del Gobierno sin id (etiqueta «MINISTRO DE … (Apellido …)»), es él, como persona externa con el nombre de la etiqueta.
- Una aposición con un cargo que el antiguo diputado no ocupa («jefe del Estado de Cuba», «presidente X, de Canarias», «presidente del Consejo Europeo») hace externa la mención.
- Dar de alta, con sus fechas, a los ministros sin escaño (lo propuso ya la revisión 6) y a los presidentes autonómicos.

### 3. Personas externas que tenían o habían tenido escaño (3 casos: nº 25, 29 y 30)

**a) Errata del Diario (nº 25).** «señor Bañó» es Francisco Vañó Ferre (PP), que interviene en el mismo debate (ES011006100063). Es la misma mención que la revisión 6 señaló (su nº 31), y siguen las otras tres erratas («Cullel», «Nova», «Motero»). La regla que propuso no se ha aplicado: antes de crear una persona externa con «señor/señora» y un apellido que no es de ningún orador, buscar entre quienes intervienen en la sesión un apellido a una letra de distancia o con b/v, ll/l o s/z cambiadas.

**b) El nombre se alarga con «y» y una sigla (nº 29).** «el Partido Popular del señor Núñez Feijóo y VOX han votado» (28-5-2024): Feijóo era diputado en la XV, pero la mención se lee como «Núñez Feijóo y VOX». La regla de «y» (l. 679 y 698) solo corta si detrás viene un nombre de pila o dos palabras, para no partir apellidos como «Álvarez de Miranda y Torres»; «VOX» es una sola palabra y se queda. Sin candidato, sale la persona externa «nunez feijoo vox», que además recoge, al unir claves, los dos «presidente Feijóo» de 2012 (presidente de la Xunta).

Regla: no admitir en un nombre una palabra en mayúsculas que es una sigla (VOX, PP, PSOE, ERC, PNV, BNG, CUP…), y mantener «y X» solo si toda la secuencia es el apellido de un orador; si no, cortar antes de «y».

**c) Un hipocorístico compuesto (nº 30).** «el señor Juanma del Olmo» (14-10-2020) es Juan Manuel del Olmo Ibáñez, diputado de Podemos en la XI y la XII y orador en la XII de la biblioteca: como antiguo miembro debió ser su nodo de miembro. `HIPO` (l. 136) no tiene hipocorísticos de dos nombres.

Regla: añadir a `HIPO` los compuestos, que se expanden a dos tokens: juanma → juan manuel, juanjo → juan josé, josema → josé manuel, josemi → josé miguel, chema → josé maría (hoy solo «josé»), maite → maría teresa, marisa → maría luisa.

## Lo que no debería contar

### Duplicados por la traducción de las intervenciones en lenguas cooficiales (nº 37)

Desde la XV, el Diario publica las intervenciones en catalán, euskera o gallego y, a continuación, su traducción al castellano, en la misma fila. Todas sus menciones se cuentan dos veces. En la muestra, la nº 37 está en la traducción y repite la del original (i = 1845); las nº 26, 38 y 44 están en originales cuya traducción las repite.

Con una detección sencilla (29 filas de la XV con párrafos en lengua cooficial), al menos 34 de las 725 menciones de la XV (5 %) repiten en la traducción una mención de la misma persona en el original. Además, la traducción cambia las formas:
- «senyor García Ortíz» pasa a «señor Ortiz» y se atribuye al antiguo diputado Luis Ortiz González (causa 2).
- En el original catalán, «president Sánchez» y «Pedro Sánchez» van a la persona externa «pedro sanchez» (4 menciones en la salida), y en la traducción, al miembro. Pedro Sánchez queda partido. La revisión 6 ya lo señaló.

Regla: localizar dónde empieza la traducción (tras el último párrafo en lengua cooficial, el párrafo que abre la versión castellana y suele repetir el saludo: «Moltes gràcies.» → «Gracias, señora presidenta.») y procesar una sola versión, mejor la castellana, cuyas formas son las que conoce el detector.

## Otras observaciones (fuera de la muestra; no cuentan)

- **«señor Almeida».** «los cheques del señor Almeida» (2021) y «a señora Ayuso e o señor Almeida» (2024, dos veces con la traducción) se atribuyen a Andrés Alberto Rodríguez Almeida (VOX); por el contexto es José Luis Martínez-Almeida, alcalde de Madrid. `fuerza` (l. 133) da fuerza 2 al segundo apellido tras un primero muy común, pensando en «señor Zapatero» o «señor Rubalcaba». Regla: aplicarlo solo si la biblioteca ya llama así a ese miembro (`usoApellido`) o si interviene en la sesión.
- **Arias Cañete partido.** En la sesión del 12-12-2002, «señor Cañete» va a la persona externa «canete» y «señor Arias Cañete», a su nodo de miembro («aún sin escaño»). Las dos cosas siguen el criterio (con un apellido, externa; con los dos, miembro futuro), pero dejan a la misma persona en dos nodos el mismo día (nº 27).
- **Posiciones desplazadas.** En 148 menciones de España (6,2 %) la posición (`i`, `largo`) no coincide con el texto de `biblioteca.json`, porque el detector normaliza el texto antes de buscar (une palabras partidas por guion y «Rodrí guez»). En la nº 3 el desfase es de 4 caracteres. Si la pestaña resalta la mención por su posición, fallará en esas.
- **Verbo normativo en futuro.** El filtro de la l. 743 usa `\b` detrás de «podrá», «deberá», «será», «nombrará»…, y en JavaScript `\b` no ve la «á» como letra, así que esos futuros nunca se filtran. En la salida de España no afecta a ningún cargo sin nombre; se explica en `revision7/MX.md`.

## Fuentes consultadas

- Fidel Castro, presidente del Consejo de Estado de Cuba hasta el 24-2-2008: https://en.wikipedia.org/wiki/Fidel_Castro (nº 1)
- Marta Mata, diputada en la Legislatura Constituyente: https://es.wikipedia.org/wiki/Marta_Mata (nº 3)
- José Luis Ábalos, suspendido por el Congreso con efectos del 10-12-2025: https://www.infobae.com/espana/2025/12/10/el-congreso-suspende-a-jose-luis-abalos-como-diputado-mientras-permanezca-en-prision/ (nº 9 y 11)
- Santos Cerdán entregó el acta el 16-6-2025: https://www.infobae.com/espana/2025/06/16/santos-cerdan-entrega-su-acta-de-diputado-en-el-congreso-y-pierde-el-aforamiento-a-que-se-enfrenta-ahora-el-exnumero-3-del-psoe/ (nº 12 a 14)
- José Manuel Maza, fiscal general del Estado de 2016 a 2017: https://es.wikipedia.org/wiki/José_Manuel_Maza (nº 26)
- Miguel Arias Cañete, senador por Cádiz de 2000 a 2004 y diputado desde 2004: https://es.wikipedia.org/wiki/Miguel_Arias_Cañete (nº 27)
- Jesús Adolfo Gutiérrez Morlote, director general del INSALUD en 1990-1991: https://es.wikipedia.org/wiki/Instituto_Nacional_de_la_Salud_(España) (nº 28)
- Juanma del Olmo, diputado por Valladolid en la XI y la XII: https://es.wikipedia.org/wiki/Juanma_del_Olmo (nº 30)
- Alfredo Urdaci, director de los Servicios Informativos de TVE de 2000 a 2004: https://es.wikipedia.org/wiki/Alfredo_Urdaci (nº 31)
- Juan Manuel Eguiagaray, ministro desde el 12-3-1991 y diputado desde 1996: https://es.wikipedia.org/wiki/Juan_Manuel_Eguiagaray (nº 32)
- Antoni Asunción, director general de Instituciones Penitenciarias de 1988 a 1991 y diputado de 1993 a 1996: https://es.wikipedia.org/wiki/Antoni_Asunción (nº 33 y 36)
- José Manuel Franco, diputado del 21-5-2019 al 11-2-2020 y delegado del Gobierno en Madrid: https://es.wikipedia.org/wiki/José_Manuel_Franco (nº 34)
- José Ignacio Wert, diputado de 1986 a 1987 y ministro desde 2011: https://es.wikipedia.org/wiki/José_Ignacio_Wert (nº 35)
- Valtònyc, detenido en 2012 por canciones contra Juan Carlos I: https://en.wikipedia.org/wiki/Valtònyc (nº 51)

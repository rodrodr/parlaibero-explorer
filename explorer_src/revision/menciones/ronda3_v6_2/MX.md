# Precisión del detector de menciones, versión 6.2: México (Cámara de Diputados)

Muestra de `node muestra_precision7.cjs paises/MX 8 31` sobre `paises/MX/menciones6_2.json`: 8 menciones por categoría, 48 en total. La categoría de miembros por cargo sin nombre está vacía en la salida: en México el único cargo sin nombre es el presidente de la República, que siempre es persona externa. Cada mención se revisó con la intervención completa en `biblioteca.json`, los turnos vecinos de la sesión y `oradores.json`: escaño en la legislatura de la fecha, homónimos, quién interviene y quién preside. Los escaños y cargos que no se deducían del corpus se comprobaron en las fuentes citadas en el motivo de cada caso y al final. El detalle está en `revision7/MX.json`, y los números entre paréntesis remiten a él. Las líneas citadas son de `detectar6_2.cjs`.

Criterios:
- Los de la versión 6.2. Un antiguo diputado es su nodo de miembro; con escaño solo posterior, solo con el nombre completo; los jefes de Estado, siempre su nodo externo; el cargo sin nombre es incorrecto si el texto lo usa en abstracto (una norma, un enunciado general). Por eso cuentan como incorrectas las personas externas que eran o fueron diputados con escaño en la biblioteca (nº 17 y 23), aunque la identidad sea buena.
- «No debería contar» (no cambia el veredicto): turnos de quien preside y de la Secretaría, con lo que leen o insertan (orden del día, actas, dictámenes, oficios); fórmulas y llamamientos durante la votación; votaciones nominales; rótulos, y listas de firmantes.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Correctas que no deberían contar |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Miembro, con tratamiento o cargo | 3.412 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 8 |
| Miembro, apellido suelto | 139 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 8 |
| Miembro, cargo sin nombre (por fecha) | 0 | 0 | — | — | — | — | — | — |
| Externa, con cargo o título | 1.693 | 8 | 6 | 2 | 0 | 75 % | 41–93 % | 4 |
| Externa, antiguo orador sin escaño | 19 | 8 | 5 | 3 | 0 | 63 % | 31–86 % | 2 |
| Externa, apellido suelto | 140 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 0 |
| Externa, cargo sin nombre (por fecha) | 196 | 8 | 4 | 4 | 0 | 50 % | 22–78 % | 2 |
| **Total** | 5.599 | 48 | **38** | 10 | 0 | **79,2 %** | 66–88 % | 24 |

- No hay dudosas. Si se pondera cada categoría por su tamaño en la salida, la estimación es del 90 %, porque las dos categorías grandes no tienen errores. Con ocho casos por categoría, cada error mueve la precisión 12,5 puntos.
- La identidad casi siempre es buena, pero 30 de las 48 menciones no deberían contar (24 de las 38 correctas). Solo 14 de las 48 son alusiones correctas de un orador en su discurso. Para la red, esto pesa más que los errores de identidad.
- La revisión 6 dio un 78,2 % (43 de 55, semilla 23). Si la nº 17 y la nº 23 contaran como correctas, como la revisión 6 contó los nodos partidos, serían 40 de 48 (83,3 %).
- Casi todos los errores de la revisión 6 siguen: Alonso Que (nº 27 y 28, las mismas menciones que su nº 33), Espinoza Segura (nº 25, que ya citaba), los antiguos diputados como senadores externos, los cargos sin nombre genéricos, los turnos de la Mesa, las votaciones nominales en el pase de apellidos sueltos, el cargo contado dos veces con «licenciado» y los grados militares. Sí se han corregido César Augusto Santiago (ya no sale externo) y «Ausente» como persona (ninguna); y Calderón como presidente va casi siempre a su nodo externo (24 menciones; véanse las observaciones).

## Errores que quedan, por causa

### 1. «El presidente de la República» en abstracto (4 casos: nº 44 a 47)

- «Tres representantes del sector productivo… mismos que serán designados por el presidente de la república a propuesta del secretario de Economía» (6-2-2018, nº 44): la composición del Consejo General de Ciencia y Tecnología.
- «sin que se toque a la médula del poder en México, que como hemos dicho es la del presidente de la República» (6-2-2018, nº 45).
- «la reforma constitucional que elimina el fuero al presidente de la República» (1-9-2021, nº 46).
- «además, garantiza que al presidente de la República se pueda juzgar como cualquier ciudadano» (1-9-2021, nº 47).

No es un caso raro. En una segunda muestra de 24 (semilla 77) hay 11 correctas, 3 dudosas y 10 incorrectas: 8 normas o enunciados generales y 2 de otro país («la condecoración que le confiere el Presidente de la República y Comandante General de la Fuerza Armada de la República de El Salvador»). Entre las dos muestras, 14 de 32 (44 %), cerca de los 4 de cada 10 que estimó la revisión 6.

Los filtros de usos genéricos de la 6.2 (l. 739–744) tienen dos fallos que afectan a todos los países:
- El de verbos normativos detrás del cargo (l. 743) acaba en `\b`, y en JavaScript `\b` no ve la «á» como letra, ni con la marca `u`. «podrá», «deberá», «será», «nombrará», «designará», «remitirá»… nunca se filtran: «el Presidente de la República podrá presentar hasta dos iniciativas» queda. Arreglo: `(?![\p{L}])`.
- El de «Artículo N» en los 300 caracteres anteriores (l. 744) no tiene la marca `i` y no reconoce «Artículo» con mayúscula. Por ejemplo, «Artículo 56. Los tratados deben ser aprobados por el Congreso antes de su ratificación por el Presidente de la República» (la Constitución del Perú, citada en 2005).

Entre los dos dejan pasar 11 menciones.

Reglas, además de esos arreglos (bucle de cargos sin nombre, l. 736–755):
- Delante del cargo: «será(n) designado(s)/nombrado(s)/invitado(s) por», «ratificación por», «a la autorización/consideración del». Si la mención empieza por «al» o «del»: «fuero», «inmunidad», «responsabilidad (penal)», «juicio político», «declaración de procedencia», «privilegios», «juzgar», «procesar», «imputar», «contra».
- Detrás: «pueda(n)», «deba», «esté sujeto», «se pueda», «sería», «podrá», «emitirá», «quien lo presidirá»; y «y Comandante General… de El Salvador» u otro país a pocas palabras.

Probadas sobre la salida, estas pistas marcan 32 de los 196, y en mi lectura todos son normas, usos generales o de otro país. Recogen 3 de los 4 errores de la muestra (nº 44, 46 y 47) y 8 de los 10 de la segunda. Quedan los enunciados generales sin marca («la médula del poder… es la del presidente de la República», «un nuevo formato para el informe del Presidente de la República»).

### 2. Miembros tratados como personas externas (5 casos de 4 personas: nº 17, 23, 25, 27 y 28)

**a) Antiguo o futuro diputado con una forma de cargo externo (nº 17 y 23).** «el senador José Rosas Aispuro Torres» (25-11-2014) fue diputado en la LVI y la LX, las dos en la biblioteca. «los Senadores Luis Alberto Coppola Joffroy, Martha Leticia Sosa Govea y Jaime Rafael Díaz Ochoa» (14-10-2008): Sosa Govea fue diputada en la LXII y aquí va con el nombre completo.

La rama de las formas externas (l. 517–525) une la mención al orador, con su nombre completo como clave, pero crea una persona externa sin consultar `escanoEnBiblioteca`. En la salida hay 252 menciones externas de personas con escaño anterior en la biblioteca: Chaurand 48, Melgoza 40, Gloria Lavara 35, Ojeda Zubieta 26, Cantón Zetina 22, Lozano Gracia 20, Zermeño 20… Hay además 66 de diputados posteriores nombrados con el nombre completo. La revisión 6 lo señaló como «nodos partidos», y sigue igual.

Regla: en esa rama, si el único candidato tuvo escaño antes en la biblioteca, nodo de miembro con «antiguo»; si solo después y el nombre es completo, nodo de miembro con «aún sin escaño».

**b) Escaño sin intervenciones en esa legislatura (nº 25, 27 y 28).**
- «a cargo de la diputada María Bertha Espinoza Segura, del Grupo Parlamentario de Morena» (24-3-2022): vota en la misma sesión («67 Espinoza Segura, María Bertha Favor»), pero solo consta como oradora en la LXIV, fuera de la biblioteca.
- «Diputado Erubiel Lorenzo Alonso Que» (6-2-2018): la Secretaría le pide el voto. Era diputado en la LXIII, pero solo es orador en la LXVI.

`senta` (l. 328–338) da escaño solo por actividad, y con `reeleccionConsecutiva: false` (`formas_paises_v6_2.cjs`, l. 247) no lo supone entre legislaturas, ni siquiera desde 2021, cuando la reelección consecutiva ya está permitida (Espinoza Segura pasa de la LXIV a la LXV).

Reglas:
- Aplicar `reeleccionConsecutiva: false` solo hasta la LXIV.
- Tomar el padrón del día de las votaciones nominales de la sesión: quien vota tiene escaño.
- Con una forma de miembro en presente («a cargo de la diputada X, del Grupo Parlamentario…», «Diputado X» en un llamamiento a votar) y el nombre completo de un orador, hacerlo miembro aunque no conste actividad.

### 3. Un lugar tomado por una persona (1 caso: nº 38)

«Estado de Tabasco: Balancan, Cárdenas, Centro, Cunduacán, Centla, Comalcalco, Emiliano Zapata, Huimanguillo…» (7-9-2005) es el municipio, en el proyecto de Presupuesto; la misma lista vuelve en 2008. Fuera de la muestra, el pase de apellidos sueltos de personas externas tiene más casos:
- «Madrid» la ciudad en 5 de las 9 menciones de «miguel madrid» («Palacio de la Zarzuela, Madrid», «celebrada en Madrid, España», «Madrid, UNED»).
- «la delegación Gustavo A. Madero», 2 veces.
- «le urge a Madero» (2013), que no es Francisco I. Madero.

«madrid» está en `lugares`, pero la comprobación de lugares (l. 851) solo se hace para las personas externas corrientes, no para jefes de Estado ni figuras históricas (l. 862–880).

Reglas:
- Comprobar `LUGARES` también en esos dos bucles.
- Saltar el apellido dentro de una lista de topónimos (tras «Estado de X:» o «municipios de») y tras «, España» o una fecha («Madrid, 22 de enero»).
- Añadir «delegación», «alcaldía» y «colonia» a `INST_LUGAR`.

## Lo que no debería contar (30 de 48; 24 de las 38 correctas)

### 1. Turnos de la Secretaría y de quien preside que no se descartan (28 casos)

- Orden del día: nº 1, 2, 4, 8, 23 y 25.
- Dictámenes y sus firmas: nº 6, 7, 13, 14, 17, 19, 21, 29, 41 y 42.
- Oficios y documentos: nº 18 (Senado), 22 y 38 (Ejecutivo) y 32 (Congreso de Sonora).
- Fórmulas y llamamientos en la votación: nº 5, 27 y 28.
- Rótulo «Presidencia de la diputada…»: nº 3.
- Turnos de quien preside: nº 9 (anexo tras «Se levanta la sesión»), 11 y 12 (votación nominal en ese anexo) y 15 (acta).

La versión 6.2 dice sacar de la salida los turnos de la Mesa. En México, desde 2003 las etiquetas son solo nombres y la Mesa se deduce por el reparto de turnos (l. 164–180), y el cálculo falla:
- Toma por presidente a quien más turnos tiene, y en México la secretaria suele tener más. El 24-3-2022, Karla Yuritzi Almazán Burgos tiene 90 de 226 turnos y el presidente, Sergio Gutiérrez Luna, 29. El 7-3-2013, Patricia Retamoza tiene 68 de 271 y Francisco Arroyo Vieyra, 19.
- Los demás miembros de la Mesa necesitan el 15 % de los turnos y una mediana de 250 caracteres o menos. Los secretarios que leen el orden del día o los dictámenes la superan (Margarita Arenas Guzmán: 37 turnos, mediana 356).
- Las filas sin id (Lucero Saldaña Pérez, secretaria de la Comisión Permanente en 2006) no entran en el cálculo. En toda la salida, 1.064 menciones no tienen fuente.
- En la sesión del 6-2-2018, la fila «El Presidente dirige unas palabras a la Asamblea…» sigue contando como etiqueta de Presidencia e impide la deducción en toda la sesión (ya lo señaló la revisión 6).
- En 1989, las etiquetas «El mismo C. Secretario» y «La misma C. Secretaria» no se reconocen: `esPresidenciaEtiqueta` (l. 156) espera «(el|la) (señor) secretari…» al principio. Suman 188 menciones.

Con una marca aproximada (turnos que empiezan por una fórmula de la Mesa o por «Escudo…», y filas sin orador), unas dos terceras partes de las menciones de México (65 %) están en estos turnos.

Regla: reconocer a la Mesa por lo que dice, no por cuántos turnos tiene.
- Quien tiene en la sesión al menos dos turnos que empiezan por una fórmula de la Mesa es de la Mesa en toda la sesión, salvo en los turnos que abren como un discurso («Con la venia…», «Compañeras y compañeros…»). Fórmulas: «Por instrucciones de la Presidencia», «En votación económica», «Se consulta/pregunta a la Asamblea», «Está(n) a discusión», «Tiene la palabra», «Consulte/Proceda/Continúe la Secretaría», «Esta Presidencia», «Se levanta la sesión», «Háganse los avisos», «Sigue abierto el sistema», «¿Falta algún…».
- Probada así, marca el 63 % de las menciones de México y 19 de las 25 filas de la muestra que no deberían contar, sin tocar ningún discurso de la muestra.
- Para las demás: aceptar «El mismo C. Secretario» y «La misma C. Secretaria»; tratar como documento las filas que abren con «Escudo…», «Dictamen…» o «Acta…» leídas por alguien de la Mesa; y separar el anexo final («RESUMEN DE LOS TRABAJOS», listas de oradores y votaciones) del turno que levanta la sesión.

### 2. Votaciones nominales en el pase de apellidos sueltos (nº 11 y 12; 25 en la salida)

El filtro de `probar` (l. 941) espera «presente», «ausente» o «a favor» justo después del apellido, pero las líneas son «183 Torres Escudero, Mario Alberto Favor»: el nombre de pila va en medio y «Favor» no lleva «a». Regla, como en la revisión 6: saltar las líneas `^\d+\s+[^,\n]+,\s*[^\n]+\s+(Favor|Contra|Ausente|Abstención)\s*$`.

### 3. Listas de firmantes (nº 9, 10, 13, 14, 16 y 19)

Las nº 9, 13, 14 y 19 están también en el apartado anterior. En toda la salida, 1.007 menciones van seguidas de «(rúbrica)». Las nº 10 y 16 son los firmantes del punto de acuerdo que lee el propio orador: el texto es suyo, pero la lista no es una alusión, igual que una lista de asistencia. El criterio no las nombra; si contaran, no deberían contar 28 y no 30.

Regla: marcar como firma los nombres seguidos de «(rúbrica)» y los de la lista tras «Diputados:», «firman los siguientes diputados» o «Sala de Comisiones…».

### 4. Una fila sin orador con una frase por etiqueta (nº 7)

Una línea de un dictamen («Herrera Delgado argumentó en la iniciativa lo siguiente») quedó como etiqueta de orador; la fila es parte del dictamen que lee la Secretaría (apartado 1). Es un problema de segmentación del corpus.

## Otras observaciones (fuera de la muestra; no cuentan)

- **Cargo y nombre contados dos veces.** «el Presidente de la República, licenciado Vicente Fox Quesada» sigue contando el cargo sin nombre y, aparte, el nombre: 6 casos en la salida (7 en la revisión 6). La excepción de la l. 739 solo admite «señor/don» entre la coma y el nombre. Regla: admitir cualquier forma de tratamiento.
- **Grados militares como personas.** La clave «constructor diplomado» reúne 26 menciones del 25-1-2006 con grados, con nombre o sin él («General Brigadier Intendente Diplomado de Estado Mayor»). La regla de la revisión 6 (grados y especialidades en `noPersona`, sin unir claves hechas solo de grados) no se ha aplicado.
- **Calderón, todavía partido.** «el ex presidente Felipe Calderón Hinojosa» (2014 y 2018) va a su nodo de miembro como antiguo miembro, contra la regla de la 6.2 de que un jefe de Estado es siempre su nodo externo. También «el candidato presidencial del PAN, Felipe Calderón Hinojosa» (2006) y «licenciado Felipe Calderón» (1996). La comprobación del nombre completo de un jefe de Estado (l. 500) exige que la mención acabe como el nombre de la tabla («Felipe Calderón»), y con «Hinojosa» detrás no se cumple; ya lo señaló la revisión 6. Regla: aceptar los nombres que contienen el primer y el último token de la tabla.
- **Posiciones desplazadas.** En 131 menciones (2,1 %), la posición (`i`, `largo`) no coincide con el texto de `biblioteca.json`, porque el detector normaliza el texto antes de buscar.

## Fuentes consultadas

- José Rosas Aispuro, diputado en la LVI y la LX y senador de 2012 a 2015: https://en.wikipedia.org/wiki/José_Rosas_Aispuro (nº 17)
- Jesús Casillas Romero, senador en la LXII y la LXIII: https://en.wikipedia.org/wiki/Jesús_Casillas_Romero (nº 18)
- José Antonio Aguilar Bodegas, diputado en la LVII y senador de 2000 a 2006: https://en.wikipedia.org/wiki/José_Antonio_Aguilar_Bodegas (nº 19)
- José María Pino Suárez, vicepresidente asesinado en 1913: https://es.wikipedia.org/wiki/José_María_Pino_Suárez (nº 20)
- Martha Leticia Sosa Govea, senadora de 2006 a 2009 y diputada de 2012 a 2015: https://es.wikipedia.org/wiki/Martha_Sosa_Govea (nº 23)
- Ricardo Trevilla Trejo, jefe del Estado Mayor Conjunto de la Defensa Nacional: https://www.elfinanciero.com.mx/nacional/2024/09/06/quien-es-el-general-ricardo-trevilla-trejo-proximo-titular-de-sedena-con-sheinbaum/ (nº 24)
- Saúl Huerta renunció a la reelección en abril de 2021: https://www.proceso.com.mx/nacional/2021/4/22/diputado-acusado-de-abuso-sexual-contra-un-menor-renuncia-reelegirse-262556.html (nº 26)
- Erubiel Lorenzo Alonso Que, diputado federal en la LXIII: https://heraldodemexico.com.mx/edicion-impresa/2024/8/5/quien-es-erubiel-lorenzo-alonso-que-diputado-por-representacion-proporcional-del-pri-626922.html (nº 27 y 28)
- Rubén Cayetano García, diputado del 1-9-2018 al 31-8-2021: https://es.wikipedia.org/wiki/Rubén_Cayetano_García (nº 30 y 31)
- Onésimo Mariscales, diputado federal de 2009 a 2012: https://en.wikipedia.org/wiki/Onésimo_Mariscales (nº 32)
- Andrés Granier Melo, gobernador de Tabasco de 2007 a 2012: https://en.wikipedia.org/wiki/Andrés_Granier_Melo (nº 39)

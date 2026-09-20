# Precisión del detector de menciones: México (Cámara de Diputados)

Muestra de `node muestra_precision.cjs paises/MX 10 7`: hasta 10 menciones por categoría con semilla fija, 50 en total. La categoría de cargo sin nombre está vacía porque México no tiene `cargosSinNombre` en `formas_paises.cjs`. Cada mención se revisó con la intervención completa y `oradores.json`. Los escaños que no se deducían del corpus se comprobaron en las fuentes citadas al final. El detalle de cada mención está en `MX.json`.

## Precisión

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

| Categoría | En la salida | Revisadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 4.005 | 10 | 10 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 279 | 10 | 6 | 4 | 0 | 60 % |
| Miembro, cargo sin nombre (por fecha) | 0 | 0 | – | – | – | – |
| Externa, con cargo o título | 2.236 | 10 | 8 | 2 | 0 | 80 % |
| Externa, antiguo miembro | 81 | 10 | 6 | 4 | 0 | 60 % |
| Externa, apellido suelto | 664 | 10 | 2 | 8 | 0 | 20 % |
| **Total** | 7.265 | 50 | 32 | 18 | 0 | **64,0 %** |

Con diez casos por categoría, cada error mueve la precisión diez puntos. Si cada categoría se pondera por su tamaño en la salida, la estimación es de un 85 %, porque la categoría grande (miembros con tratamiento) no tuvo errores. Aun así, las seis correctas de «miembro, apellido suelto» lo son por casualidad (patrón 1).

## Patrones de error

### 1. Los apellidos sueltos de miembros se buscan por el nombre de pila (4 errores: nº 14, 17, 18 y 19)

Es un fallo de programación. En México los nombres van como «NOMBRE APELLIDOS», sin coma. Al preparar la palabra que se busca en el texto, el bucle de `apMiembro` toma la primera palabra del nombre (`partes[0]`). En España, con «APELLIDOS, NOMBRE», esa palabra es el primer apellido; aquí es el nombre de pila. La clave interna sí es el apellido («almazan», «monreal», «huerta»), pero lo que se busca es «José», «Ricardo», «Manuel», «Francisco»… Las 279 menciones de la categoría son búsquedas de un nombre de pila.

Aciertan cuando el nombre aparece en una lista «Apellido Apellido, Nombre» o junto al apellido («José Murat»); son las nº 11, 12, 13, 15, 16 y 20. Fallan en cuanto el nombre es de otro:

- «la tormenta Manuel y el huracán Ingrid» se atribuye a Manuel Huerta Ladrón de Guevara (nº 14).
- «Francisco I. Madero» se atribuye a Francisco Alfonso Durazo Montaño (nº 17).
- «Díaz García, José Antonio», en dos votaciones nominales, se atribuye a José Antonio Almazán González (nº 18 y 19).

Una comprobación automática aproximada (si el apellido del miembro está junto al nombre de pila encontrado) da alrededor de 120 aciertos de 279, un 45 %.

**Regla que lo evitaría:** cuando el nombre no lleva coma, buscar la palabra del nombre cuyo plegado coincide con el apellido de referencia (`apRef(d)`: «Almazán», «Monreal», «Huerta»), no `partes[0]`.

### 2. Votaciones nominales y listas de asistencia (5 errores: nº 44, 45, 47, 48 y 50)

Muchas filas llevan los anexos de las votaciones («1 Aguirre Alcaide, Víctor Ausente 2 Alavez Ruiz, Aleida Ausente…»). La fila MX007016000219, por ejemplo, tiene 227.842 caracteres y nueve votaciones nominales. El error se encadena así:

1. En «Alcalde Virgen, Moisés Ausente» (el diputado Moisés Alcalde Virgen), «Alcalde» es una forma de cargo externo.
2. La expresión «cargo + institución + coma + nombre» (`RX_INST`) lee «Virgen» como la institución y «Moisés Ausente» como una persona externa.
3. Con seis menciones con cargo, «Ausente» pasa a ser el apellido suelto de esa persona.

Resultado: 312 de las 664 menciones externas por apellido suelto son la palabra «Ausente».

**Reglas que lo evitarían:**
- Añadir a `noPersona` «ausente», «favor», «contra», «abstención», «asistencia», «inasistencia», «presente» y «quórum».
- Saltar las líneas de las listas nominales: número, «Apellidos, Nombre» y sentido del voto o «ASISTENCIA». Dentro de ellas, «Alcalde» o «General» son apellidos, no formas.
- En la prueba de mayúsculas de los apellidos sueltos, no contar las apariciones dentro de esas listas. Hoy «Ausente» la supera porque en las listas siempre va con mayúscula.

### 3. Los externos por cargo se fijan para todas las legislaturas (4 errores: nº 39, 40, 42 y 46)

Quien aparece en la biblioteca con un cargo externo delante de su nombre completo («Sen.», «senador», «gobernador»…), por lo general al menos dos veces, entra en la lista de externos (32 personas en México), y `senta()` le niega el escaño en cualquier legislatura. Varios de ellos, sin embargo, fueron diputados en otras legislaturas de la biblioteca:

- Héctor Larios Córdova, coordinador del PAN en la LX (nº 39).
- Enrique Burgos García, que firma como «Dip.» en la LIX (nº 40).
- Carlos Chaurand Arzate, en las listas de la LX (nº 42 y 46).

En toda la salida, 67 menciones externas son de personas con escaño en esa legislatura según `oradores.json`: Burgos 23, Chaurand 20, Larios 7, Fraile 6, Ojeda Zubieta 3, Cantón Zetina 3, Sauri 3 y alguna más.

**Regla que lo evitaría:** que la condición de externo valga solo en las legislaturas en que la persona no tiene escaño en `oradores.json`. Es decir, consultar la entrada de esa legislatura antes que la lista de externos.

### 4. Lugares y fenómenos con forma de persona (2 errores: nº 37 y 49; además, la nº 14)

- En la lista de municipios de Nuevo León («Doctor Arroyo, Doctor Coss, Doctor González, Galeana…»), «Doctor Coss» se atribuye a Humberto Coss y León Zúñiga, diputado en la LXVI (nº 37). En la misma lista, fuera de la muestra, «Doctor Arroyo» se atribuye a Francisco Arroyo Vieyra y «General Bravo» a Tonatiuh Bravo Padilla.
- «el municipio denominado Venustiano Carranza del estado de Puebla» se atribuye a la persona Venustiano Carranza (nº 49).

**Reglas que lo evitarían:**
- Una lista de topónimos mexicanos formados con un título o un nombre de persona que no se resuelvan como personas: Doctor Arroyo, Doctor Coss, Doctor González, General Bravo, General Escobedo, General Terán, General Treviño, General Zaragoza, General Zuazua, Venustiano Carranza, Benito Juárez, Miguel Hidalgo, Gustavo A. Madero…
- Ampliar el filtro de contexto previo («centro», «museo», «calle», «plaza»…) con «municipio (denominado)», «delegación», «alcaldía», «colonia», «ejido», «presa», «estero», «tormenta» y «huracán», y aplicarlo también a los apellidos sueltos, que hoy no pasan por él.

### 5. Palabras sueltas detrás de abreviaturas o cargos (2 errores: nº 21 y 24)

- En «Artículo 195-H. Por los servicios…», «H.» se reconoce como «honorable» aunque va detrás de un guion, y sale la persona «Por» (nº 21).
- En «asesora de la Jefa Delegacional» sale la persona «Delegacional» (nº 24).

**Reglas que lo evitarían:**
- No reconocer formas pegadas a un guion: añadir «-» a la condición previa `(?<![\p{L}\p{N}])`.
- Añadir a `noPersona` las palabras gramaticales («por», «para», «en», «con», «que») y «delegacional».

### 6. Un nombre sin escaño gana a un miembro sentado (1 error: nº 35)

En «mi compañero y amigo César Augusto Santiago» (29-12-2001), el aludido es César Augusto Santiago Ramírez, diputado del PRI en la LVIII que intervenía en ese debate. El corpus le da dos id: MX00868 («César Augusto Santiago», LV) y MX00869 («César Augusto Santiago Ramírez», LVIII y LXI). Los dos id puntúan distinto:

- Con MX00868 el nombre coincide entero (fuerza 3), pero en 2001 no tenía escaño.
- Con MX00869 solo tiene fuerza 1, porque al separar nombre y apellidos «Santiago» se toma por nombre de pila: nombre «César Augusto Santiago», apellido «Ramírez».

`resolver` devuelve MX00868 como «otra legislatura» sin llegar al nivel en que está el miembro sentado. Como tampoco tuvo escaño en la biblioteca, sale como persona externa.

**Reglas que lo evitarían:**
- En los nombres sin coma de tres o más palabras, tomar como apellidos las dos últimas (paterno y materno), en lugar de decidirlo solo con la lista de nombres de pila.
- Si en el nivel de fuerza más alto nadie tiene escaño, buscar en los niveles inferiores un candidato con escaño cuyo nombre empiece por la mención antes de devolver «otra legislatura».
- Unificar los id duplicados del corpus.

## Otras observaciones (no cuentan como errores)

- **Documentos leídos.** La mayoría de las menciones de miembros con cargo salen de documentos leídos, no de discursos. En la muestra, 7 de 10 están en órdenes del día («a cargo del diputado…»), comunicaciones o firmas «(rúbrica)». Dos son alusiones en un discurso (nº 3 y 5) y una es una fórmula de la presidencia (nº 2). Están bien atribuidas, pero pesan mucho en la red. Si solo interesan las alusiones, habría que descartar las menciones seguidas de «(rúbrica)» y las precedidas de «a cargo del/de la», «suscrita por» o «presentada por», o bien marcarlas como autoría.
- **Presidencia no reconocida.** Un caso es «Tiene el uso de la tribuna el diputado Iván García Solís para alusiones» (nº 2):
  - «tiene el uso de la tribuna» no está en `C.procedimiento`.
  - En esa sesión la presidencia (Heliodoro Díaz Escárraga, 129 de las 319 filas) aparece solo con su nombre y no se reconoce como tal, así que sus turnos no se descartan. `MESA_POR_ETIQUETA` es verdadero para el país y el respaldo por sesión no llega a aplicarse.

  Reglas: añadir a `C.procedimiento` «tiene el uso de la tribuna», «tiene la tribuna» y «se concede el uso de la palabra», y aplicar el respaldo por sesión a las sesiones sin ninguna fila de presidencia reconocida.
- **Duplicados.** En la nº 41, «Urueta» se cuenta dentro de «Sen. Francisco Fernández de Cevallos y Urueta», que ya estaba detectado con su cargo. `TITULO_ANTES` solo admite palabras con mayúscula entre la forma y el apellido, y «de» o «y» lo rompen. En toda la salida, unas 153 de las 943 menciones por apellido suelto repiten una mención ya detectada en el mismo punto. Regla: saltar las posiciones ya cubiertas por una mención con forma.
- **Nodos partidos.** «Anguiano» (nº 43, el pintor Raúl Anguiano) queda separado de «José Raúl Anguiano Valadez».
- **Cobertura.** Sin `cargosSinNombre` para México, «el presidente de la República» no se atribuye por fecha. Esto afecta a la cobertura, no a la precisión.

## Fuentes consultadas

- Roberto Madrazo Pintado, diputado de 1991 a 1993: https://es.wikipedia.org/wiki/Roberto_Madrazo (nº 32)
- Rubén Cayetano García, diputado solo en la LXIV (2018-2021): https://es.wikipedia.org/wiki/Rubén_Cayetano_García (nº 36)

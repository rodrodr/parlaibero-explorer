# Precisión del detector de menciones: España (Congreso de los Diputados)

Muestra de `node muestra_precision.cjs paises/ES 10 7`: hasta 10 menciones por categoría con semilla fija, 56 en total. Cada mención se revisó con la intervención completa, los turnos vecinos de la sesión y `oradores.json`. Los cargos y los escaños que no se deducían del corpus se comprobaron en las fuentes citadas al final. El detalle de cada mención está en `ES.json`.

## Precisión

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

| Categoría | En la salida | Revisadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 1.699 | 10 | 10 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 64 | 10 | 10 | 0 | 0 | 100 % |
| Miembro, cargo sin nombre (por fecha) | 161 | 10 | 9 | 1 | 0 | 90 % |
| Externa, con cargo o título | 394 | 10 | 6 | 4 | 0 | 60 % |
| Externa, antiguo miembro | 6 | 6 | 5 | 1 | 0 | 83 % |
| Externa, apellido suelto | 95 | 10 | 10 | 0 | 0 | 100 % |
| **Total** | 2.419 | 56 | 50 | 6 | 0 | **89,3 %** |

Con diez casos por categoría, cada error mueve la precisión diez puntos, así que las cifras por categoría son orientativas. Si cada categoría se pondera por su tamaño en la salida, la estimación sube a un 93 %, porque la categoría más grande (miembros con tratamiento) no tuvo errores.

## Patrones de error

### 1. Encabezados de preguntas en mayúsculas leídos como nombres (3 casos: nº 31, 36 y 37)

Los títulos de las preguntas orales («— DE LA DIPUTADA DOÑA …, QUE FORMULA A LA SEÑORA MINISTRA …: ¿…?») quedan pegados al final del turno anterior. El patrón de nombre acepta cualquier palabra que empiece por mayúscula, así que una forma escrita en mayúsculas arrastra el resto de la frase:

- «SEÑORA VICEPRESIDENTA QUE ENTRAN DENTRO DE LA NORMALIDAD» da la persona «que entran dentro normalidad» (nº 31).
- «MINISTRA QUE EL PROGRAMA AGUA HA FRACASADO» se corta en «programa», queda la clave «que» y la agrupación de claves la une a la persona de la nº 31 (nº 36).
- «VICEPRESIDENTA CUARTA Y MINISTRA PARA LA TRANSICIÓN» da la persona «cuarta» (nº 37).

En toda la salida hay 12 menciones externas con el texto casi entero en mayúsculas, y todas salen de estos encabezados: «primera», «tercera», «cuarta», «turismo comercio», «manteniendo calendario obras», «tras avance»… Los mismos encabezados producen además 27 menciones de miembros («DIPUTADO DON MARIANO RAJOY BREY»), de las que 25 quedan resueltas. Están bien atribuidas, pero son rótulos, no alusiones.

**Reglas que lo evitarían:**
- No buscar menciones en los tramos escritos del todo en mayúsculas ni en los párrafos que empiezan por «— DEL DIPUTADO…» o «— DE LA DIPUTADA…».
- En cualquier caso, añadir a `noPersona` las palabras gramaticales («que», «para», «por», «tras») y los ordinales («primera», «segunda», «tercera», «cuarta»). Con el corte en la primera palabra, la mención se descarta.

### 2. Palabras que no son personas detrás de formas ambiguas (2 casos: nº 40 y 45)

- En «Ley General Tributaria» (nº 40), «General» se toma por el rango militar (forma descriptiva) y sale la persona «Tributaria».
- En «de manos del presidente Sánchez, España no debió perder» (nº 45), la expresión «cargo + institución + coma + nombre» (`RX_INST`) toma «Sánchez» por la institución y «España» por el nombre. Como «España» es el primer apellido del exdiputado Julio Francisco de España Moya (V legislatura), la mención se resuelve contra él y sale como antiguo miembro.

**Reglas que lo evitarían:**
- Ampliar el filtro de contexto previo («centro», «museo», «calle», «plaza»…) con los sustantivos institucionales «ley», «dirección», «secretaría», «junta», «consejo», «intervención», «cuenta» y «fiscalía». Así, «Ley General X» o «Dirección General de X» dejan de leerse como forma más nombre. Añadir también «tributaria» a `noPersona`.
- En las coincidencias de `RX_INST` (y en general con formas que no son tratamiento), no aceptar como nombre una sola palabra de la lista `lugares` (hoy esa comprobación solo se hace con los nombres que no son de ningún orador).

### 3. «Presidente del Gobierno» de otro gobierno atribuido por fecha (1 caso: nº 24)

«el presidente del Gobierno de Navarra, el señor Sanz» se atribuye a Rodríguez Zapatero. En toda la salida, 5 de las 178 menciones de cargo sin nombre van seguidas de «de/del…». Dos son de gobiernos autonómicos (Navarra, Canarias), que están mal. Las otras tres están bien: «del que usted forma parte», «de hacer…» y «de España».

**Regla que lo evitaría:** en `cargosSinNombre`, no atribuir cuando detrás viene «de/del» seguido de un nombre con mayúscula distinto de «España» (Navarra, Canarias, Aragón, la Generalitat…) o un gentilicio («Vasco», «Balear», «Foral»).

## Otras observaciones (no cuentan como errores)

- **Duplicados.** El pase de apellidos sueltos vuelve a contar apellidos que ya forman parte de una mención detectada con «cargo, Nombre». Ocurre en la nº 11 («Belarra» dentro de «la ministra de Derechos Sociales, Ione Belarra», que es la nº 2) y en la nº 17 («Rajoy» dentro de «el presidente del Gobierno, Mariano Rajoy»). En toda la salida, unas 18 de las 159 menciones por apellido suelto (miembros y externas) repiten una mención ya detectada en el mismo punto. Regla: guardar las posiciones cubiertas por `RX_CADENA` y `RX_INST` y saltarlas al buscar apellidos sueltos, o admitir en `TITULO_ANTES` el patrón «cargo de Institución, Nombre ».
- **Vocativo falso.** De las 8 menciones marcadas como «se dirige» en la muestra, 4 son aposiciones o enumeraciones, no vocativos:
  - nº 2: «la ministra de Derechos Sociales, Ione Belarra, …»
  - nº 5: «el ministro de Presidencia, Bolaños, …»
  - nº 9: «secretario de Estado, señor Montoro, …»
  - nº 12: «Ábalos, Koldo y Cerdán»

  Regla: no marcar vocativo en las coincidencias de `RX_INST`, ni cuando la coma previa sigue a un cargo o sustantivo, ni dentro de enumeraciones.
- **Escaño supuesto.** Montoro en 1998 (nº 9) era secretario de Estado sin escaño, y Michavila en 2002 (nº 7) era ministro de Justicia y no tenía acta desde mayo de 2000. Aun así, el detector los da por sentados:
  - A Montoro porque tuvo escaño en la legislatura anterior y en la siguiente.
  - A Michavila porque `oradores.json` le asigna partido en la VII, aunque sus 111 intervenciones son como ministro.

  La persona y el nodo son los correctos, pero el indicador de escaño no es fiable para los miembros del Gobierno. Bolaños en 2021 (nº 5) sí sale como no sentado.
- **Discurso bilingüe.** Las nº 48 y 52 son la misma frase: una en catalán y otra en la versión castellana que reproduce el Diario. La mención cuenta dos veces.
- **Lapsus del orador.** En la nº 8, el ministro llama «señor Rebollo» al interpelante, Martínez-Campillo, y luego se disculpa. El detector resuelve bien el nombre escrito.
- **Usos genéricos.** Hay dos casos de «presidente del Gobierno» en sentido genérico: la nº 25 («un presidente del Gobierno no puede…») y la nº 26 («las elecciones las convoca el presidente del Gobierno»). En la muestra apuntan al presidente en ejercicio y se han dado por buenos. Aun así, convendría no atribuir tras «un», «ningún», «cualquier» o «todo» (2 casos en toda la salida).

## Fuentes consultadas

- Félix Bolaños, diputado desde el 17-8-2023: https://es.wikipedia.org/wiki/Félix_Bolaños (nº 5)
- José María Michavila, diputado por Madrid hasta el 19-5-2000 y ministro de Justicia de 2002 a 2004: https://es.wikipedia.org/wiki/José_María_Michavila (nº 7)
- Cristóbal Montoro, secretario de Estado de Economía de 1996 a 2000, sin escaño en la VI: https://es.wikipedia.org/wiki/Cristóbal_Montoro (nº 9)
- Juan Vicente Casas Casas, senador en la V y VI legislaturas: http://www.asociacionescritorescastillalamancha.es/casas-casas-juan-vicente/ (nº 33)
- Antoni Asunción, director general de Instituciones Penitenciarias desde 1988 y diputado por Valencia de 1993 a 1996: https://es.wikipedia.org/wiki/Antoni_Asunción (nº 41 y 42)
- José Manuel Franco, diputado por Madrid de mayo de 2019 a febrero de 2020 y delegado del Gobierno desde el 17-2-2020: https://es.wikipedia.org/wiki/José_Manuel_Franco (nº 43)

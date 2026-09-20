# Colombia (CO), Cámara de Representantes: precisión de las menciones, versión 6

Muestra de `node muestra_precision6.cjs paises/CO 8 23`: hasta ocho menciones por categoría. La categoría «externa, antiguo orador sin escaño en la biblioteca» no tiene menciones en Colombia: las 25 sesiones cubren todas las legislaturas de 1998 a 2026, así que cualquier orador con intervenciones cuenta como miembro con escaño en alguna de ellas, salvo quien habla casi siempre como miembro del Gobierno. Se juzgan, por tanto, 48 menciones.

Cada mención se revisó con su intervención completa en `biblioteca.json`, las intervenciones vecinas, la cabecera de la gaceta y `oradores.json`. Las fuentes externas consultadas se citan en `CO.json`.

## Precisión

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

| Categoría | Menciones en la salida | Correctas | Incorrectas | Dudosas | Precisión | No deberían contar |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 3.239 | 8 | 0 | 0 | 100 % | 6 |
| Miembro, apellido suelto | 1.172 | 8 | 0 | 0 | 100 % | 5 |
| Miembro, cargo sin nombre (por fecha) | 14 | 8 | 0 | 0 | 100 % | 0 |
| Externa, con cargo o título | 974 | 6 | 2 | 0 | 75 % | 2 |
| Externa, antiguo orador sin escaño | 0 | — | — | — | — | — |
| Externa, apellido suelto | 91 | 7 | 1 | 0 | 88 % | 1 |
| Externa, cargo sin nombre (por fecha) | 57 | 6 | 2 | 0 | 75 % | 0 |
| **Total de la muestra** | | **43** | **5** | **0** | **90 %** | **14** |

- Con ocho casos por categoría el margen es amplio: 8/8 es compatible con un 68-100 % y 6/8, con un 41-93 %. El total, 43/48, con un 78-95 % (intervalo de Wilson al 95 %).
- Si se pondera por el número de menciones de cada categoría, la precisión estimada es del 95 %. Pesan las dos categorías de miembros, que no tienen errores en la muestra.
- La primera revisión, con otra muestra, daba un 62 % (79 % ponderada). Ya no aparecen sus errores principales: el apellido suelto de los miembros que era el nombre de pila, los miembros sin partido tratados como externos y la exclusión permanente de los «externos por cargo».
- Que la identidad sea correcta no quiere decir que la mención deba contar. 13 de las 43 correctas son turnos de quien preside, fórmulas de la Mesa, votaciones, llamadas a lista o firmas (última columna). En las dos primeras categorías de miembros son 11 de 16.
- Criterio aplicado al cargo sin nombre: es correcto si el texto admitiría el nombre del titular sin cambiar de sentido. Así, «por donde entra el Presidente de la República» (n.º 21) se da por bueno. No es correcto en el texto normativo, que vale para cualquier titular (n.º 42-43). Si se dieran por buenos también los usos normativos, la categoría quedaría en 8/8 y el total en 45/48 (94 %).
- Las personas externas se han juzgado con la regla de la tarea: son incorrectas si tenían escaño en esa fecha. Con el criterio de nodo único de la versión 6 (quien tuvo escaño en una legislatura anterior de la biblioteca es siempre el nodo de miembro), serían también incorrectas las n.º 35 y 38 (Petro como persona externa): 41/48, un 85 %.

## Errores que quedan, por causa

### 1. Uso normativo del cargo sin nombre (2 errores: n.º 42 y 43)

- Óscar Bravo, ponente del proyecto de ley de inteligencia (2011-05-11), lee el parágrafo acordado: «la Junta de Inteligencia Conjunta será presidida por el Ministro de Defensa o por el miembro civil […] que delegue para ello el Presidente de la República». Se atribuye dos veces a Santos.
- La disposición vale para cualquier presidente; no habla de Santos.
- Reglas que lo evitarían:
  - no atribuir por fecha «el Presidente de la República» cuando va dentro de un texto normativo citado: tras «que decía así», «quedando así», «artículo N» o «parágrafo», o entre comillas de un texto legal;
  - tampoco en la fórmula «la Presidenta o el Presidente de la República»;
  - como señal adicional, el verbo de mandato en subjuntivo o futuro («delegue», «promulgará», «podrá»).
- No hay un marcador seguro. Es una causa pequeña, pero afecta a una categoría con pocas menciones.

### 2. Palabras que no son personas tomadas por nombres (1 error: n.º 27)

- «Y para Director Administrativo vamos con…» produce la persona externa «Administrativo». Suma 18 menciones en la salida.
- Magnitud: 80 personas externas tienen una clave de una sola palabra (150 menciones). De ellas, 53 (80 menciones) no son palabra del nombre de ningún orador ni de otra clave: «parlamentarios», «vicefiscal», «honoraria», «acreditación», «nacionalidad», «palabras», «mediante», «financiero»…
- Reglas que lo evitarían:
  - aceptar una clave externa de una sola palabra solo si esa palabra es apellido de algún orador o de otra persona externa nombrada con nombre completo;
  - añadir a `noPersona` los adjetivos que acompañan a un cargo (administrativo, ejecutivo, financiero, jurídico, técnico) y los plurales de cargo (parlamentarios, consejeros, magistrados, senadoras).

### 3. Bloques de firmas en mayúsculas mezclados con el texto (1 error: n.º 32)

- Al final del acta de 2019-06-04, «El Secretario General El Subsecretario General, ALEJANDRO CARLOS CHACÓN CAMARGO ATILANO ALONSO GIRALDO ARBOLEDA…» da la persona externa «Alejandro Carlos Chacón Camargo Atilano Alonso».
- Une en una sola persona al presidente de la Cámara, que además era representante con escaño y debió ser miembro, y al primer vicepresidente.
- El filtro de rótulos mide las mayúsculas en la línea entera. Aquí la línea tiene 549 caracteres, mezcla las firmas con texto en minúsculas y solo llega al 43 % de mayúsculas.
- Magnitud: 88 menciones externas tienen dos o más palabras en mayúsculas. Son casi todas encabezamientos de cartas («Doctor ANGELINO LIZCANO RIVERA Secretario General») y bloques de firmas.
- Reglas que lo evitarían:
  - medir la proporción de mayúsculas en una ventana del nombre (el nombre y unos 40 caracteres a cada lado) y no en la línea;
  - cortar una secuencia de nombres en mayúsculas donde empieza otro nombre de orador, para que nunca se junten dos personas.

### 4. Nombre de una condecoración (1 error: n.º 33)

- «la condecoración orden de la democracia Simón Bolívar, instituida como un homenaje al libertador» cuenta como mención de Bolívar.
- `INST_SUELTO` solo admite palabras con mayúscula entre la institución y el apellido, y «orden» solo cuenta con mayúscula inicial.
- Regla: tras «condecoración», «orden», «medalla» o «premio», admitir hasta tres palabras en minúscula («de la democracia») antes del nombre.

## Menciones que no deberían contar (identidad correcta)

### Turnos de quien preside etiquetados solo con su nombre (n.º 2, 5, 6, 8 y 16)

- En Colombia el presidente de la sesión aparece unas veces como «Presidencia, Carlos Alberto Zuluaga Díaz» y otras solo como «Carlos Alberto Zuluaga Díaz». El detector descarta las primeras, pero no las segundas.
- La presidencia deducida por los turnos cortos solo actúa en sesiones sin ninguna fila de Presidencia, así que tampoco las recoge.
- Hay turnos así que dan la palabra, ordenan las intervenciones o piden desalojar el recinto: «Termina Representante Nicolás para darle la palabra», «doctor Armando tiene usted el uso de la palabra».
- Magnitud: en 8 de las 25 sesiones, 567 menciones (el 9,5 % de la salida) salen de turnos del presidente de la sesión etiquetados solo con su nombre.
- Reglas:
  - si una persona tiene filas «Presidencia, X» en una sesión, todas sus filas de esa sesión son de la Mesa;
  - si no las tiene, tomar al presidente de la cabecera de la gaceta: «Dirección de la Presidencia, X» o «Presidencia de los honorables Representantes X, …». Así se marcarían también Rodrigo Lara (n.º 6) y Germán Blanco (n.º 5 y 16).

### Votaciones nominales y llamadas a lista (n.º 10, 13 y 14)

- «Juan Fernando Espinal, vota SÍ», «Forero Molina Andrés Eduardo, presente», «Óscar Villamizar vota sí».
- El filtro de votaciones solo se aplica a las menciones con tratamiento o cargo, y su lista no incluye «vota».
- Magnitud: unas 317 menciones van seguidas de «presente», «ausente» o «vota»; 232 son apellidos sueltos.
- Regla: aplicar el filtro también al apellido suelto, añadir «vota sí/no» y mirar hasta el final de la fila («Apellido Apellido Nombre, presente»).

### Fórmulas de la Secretaría, firmas y rótulos (n.º 4, 7, 9, 31 y 37)

- Fórmulas de votación y de proposiciones de la Secretaría: «Se está votando el Orden del Día con la modificación propuesta por…», «¿La deja como constancia…?».
- Firmas de informes y actas: «Atentamente, … Carlos Germán Navas Talero, Representante a la Cámara», «La Subsecretaria General, FLOR MARINA DAZA RAMÍREZ».
- Destinatarios de cartas: «Doctor Jesús Alfonso Rodríguez Camargo. Secretario general Cámara de Representantes ciudad».
- El bloque de firmas del n.º 37 va pegado, por un error de segmentación, al turno del vicepresidente Roosvelt Rodríguez. Así, en la red, él «menciona» a toda la Mesa.
- Reglas:
  - tratar como de la Mesa las fórmulas de la Secretaría;
  - descartar la firma tras «Atentamente» o ante «Representante a la Cámara» al final de un documento leído, y el destinatario al principio de una carta.

### Duplicados (fuera de la muestra)

- 25 posiciones cuentan dos veces a la misma persona. Por ejemplo, «Wills Ospina» y, dentro de ella, «Ospina», ambas de Juan Carlos Wills.
- Causa: el apellido suelto comprueba si la posición está ocupada antes de alargar la mención con la palabra siguiente («Wills» + «Ospina»).
- Regla: comprobar `ocupado` con el tramo ya alargado.

## Otras observaciones (no cuentan como error)

- **Petro en dos nodos.**
  - «el Presidente de la República» de 2023-2025 va al nodo de miembro de Petro (CO00295, con escaño en 1998-2006). En cambio, «presidente Petro» y el apellido suelto van a la persona externa «gustavo petro».
  - Resultado: entre 2022 y 2025, 24 menciones van al nodo de miembro (14 de ellas, de cargo sin nombre) y 39 a la persona externa.
  - Además sale «sentado» en 2022-2026, y no «antiguo miembro», porque `oradores.json` le da 4 intervenciones con partido en esa legislatura (con `gob` = 0).
  - Reglas: decidir una sola vez el nodo de los jefes de Estado que tuvieron escaño (con el criterio de la versión 6, el de miembro, marcado como antiguo), y no dar escaño a quien ocupa la jefatura del Estado en esa fecha.
- **«Se dirige» en aposiciones.** Los n.º 17 y 19 llevan la marca de vocativo en «…básicamente, el Presidente de la República, ha tratado…». El artículo inicial está dentro de la mención y `vocativoDe` no lo ve. Regla: si la mención empieza por artículo (el, del, al), no es vocativo.
- **Lecturas de la Secretaría.** Además de las fórmulas, siete menciones de la muestra son lecturas de la Secretaría: orden del día, impedimentos, actas y listas de acreditados (n.º 3, 11, 12, 15, 29, 34 y 36). La identidad es correcta, pero no son intervenciones. En total, 16 de las 48 menciones de la muestra salen de turnos de la Secretaría, que aportan el 40,5 % de las 5.975 menciones de Colombia.
- **Fuera de la muestra: «Presidente Gaviria».** En 2011-05-31, «el Presidente Gaviria entregó solo 187 títulos, el de Samper 172, el de Pastrana 221» se atribuye al representante Simón Gaviria y no al expresidente César Gaviria. La excepción `presidePropio` se aplica porque Simón Gaviria preside otras sesiones de la biblioteca desde julio de 2011. Regla: aplicar esa excepción solo a quien preside la misma sesión.
- **Posiciones desplazadas.** Las posiciones (`i`) de 62 menciones (el 1 %) no coinciden con el texto de `biblioteca.json`, porque se calculan sobre el texto con los guiones de fin de línea ya unidos.

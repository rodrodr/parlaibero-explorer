# Precisión del detector de menciones, versión 6: Guatemala (Congreso de la República)

Muestra: `node muestra_precision6.cjs paises/GT 8 23` sobre `paises/GT/menciones6.json` (hasta 8 menciones por categoría, semilla 23). Se juzgaron 36 menciones. La categoría «externa, antiguo orador sin escaño» está vacía en la salida, y la de cargo sin nombre de miembro solo tiene 2. Para cada mención se leyó la intervención completa en `biblioteca.json` y las de alrededor, y se comprobaron en `oradores.json` el escaño en la legislatura (IV a IX en la muestra) y los homónimos. En Guatemala las etiquetas no marcan quién preside: el detector lo deduce por sesión (l. 125–137). Por eso se anotó también quién presidía o leía en cada turno. Las fuentes externas consultadas figuran en el motivo de cada caso. El detalle está en `revision6/GT.json`. Los números entre paréntesis remiten a ese archivo y las líneas citadas son de `detectar6.cjs`.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Correctas que no deberían contar |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Miembro, con tratamiento o cargo | 173 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 6 |
| Miembro, apellido suelto | 2 | 2 | 2 | 0 | 0 | 100 % | 34–100 % | 2 |
| Miembro, cargo sin nombre (por fecha) | 2 | 2 | 2 | 0 | 0 | 100 % | 34–100 % | 1 |
| Externa, con cargo o título | 206 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 2 |
| Externa, antiguo orador sin escaño | 0 | 0 | – | – | – | – | – | – |
| Externa, apellido suelto | 20 | 8 | 7 | 1 | 0 | 88 % | 53–98 % | 7 |
| Externa, cargo sin nombre (por fecha) | 74 | 8 | 8 | 0 | 0 | 100 % | 68–100 % | 3 |
| **Total** | 477 | 36 | **34** | 2 | 0 | **94 %** | 82–98 % | 21 |

No hay dudosas. Si se pondera cada categoría por su tamaño en la salida, la precisión estimada de las 477 menciones ronda el 94 %. En la salida completa, 4 de los 20 apellidos sueltos de externas tienen el error del patrón 1 («Arzú»), y otro nombra a una familia, no a la persona («distinguida familia Colom», 2011).

La identidad casi siempre es correcta, pero 21 de las 34 correctas no son alusiones de un orador a una persona. Son turnos de la Mesa (lectura del orden del día y del despacho, «a discusión la moción de…», anuncio y resultado de una elección), firmas de oficios del presidente de la República, listas de diputados ponentes, textos de normas que nombran el cargo en abstracto, una automención y un párrafo repetido. Solo 13 de las 36 menciones de la muestra son alusiones limpias. Para el explorador, esto pesa más que los dos errores de identidad (apartado «Turnos de la Mesa y documentos leídos»).

## Errores de identidad que quedan

### 1. El apellido suelto de un expresidente se le atribuye aunque lo lleve un diputado en ejercicio (1 de 8; 4 de 20 en la salida)

Caso 23. En «DIPUTADOS PONENTES: Allan Rodríguez, Shirley Rivera, Alejandro De León, Arzú, Sofía, Zamora y firmas no legibles» (12 de enero de 2021), «Arzú» se atribuye al expresidente Álvaro Arzú (1996–2000), que murió en 2018. Es su hijo, Álvaro Arzú Escobar, diputado en la VIII y en la IX (`oradores.json`). Las otras tres «Arzú» de la salida están también en listas de ponentes de 2020 y 2021 («Arzú…Alvaro Arzú»), y las cuatro fallan igual.

El mecanismo está en las l. 751–761. Solo un miembro con escaño ese día lleva el apellido (`hoy.length === 1`). El mandato del expresidente acabó hace más de ocho años, así que no se fuerza al jefe. Pero `deMiembro` (las veces que la biblioteca llama «diputado Arzú» a Arzú Escobar) es 0, y `deExterna` también. Con 0 y 0 no se cumple ninguna de las dos condiciones de las l. 759–760, y el suelto cae por defecto en la persona externa.

Regla: si un miembro con escaño ese día lleva el apellido y el jefe no está en el cargo ni se fuerza, el suelto es del miembro, salvo que la persona externa tenga pruebas propias (por ejemplo, `deExterna >= 3 && deExterna >= 3 * deMiembro`). En la duda, saltar la mención; nunca elegir la externa por defecto. Además, en una lista encabezada por «DIPUTADOS PONENTES» o cerrada con «y otras firmas», todos los nombres son de diputados.

### 2. El resto del nombre de un ministerio se toma por una persona (1 de 8 externas con cargo; 3 en la salida)

Caso 13. «…elaborado por el director ejecutivo nacional y aprobado por el ministro de Agricultura, Ganadería y Alimentación» produce la persona externa «ganaderia alimentacion». Es el patrón «cargo … Institución, Nombre» (`RX_INST`, l. 168): lo que sigue a la coma se toma por un nombre. El filtro de la l. 546 lo deja pasar porque son dos palabras con mayúscula que no están en `noPersona` ni en `lugares`. La primera revisión ya señaló este caso, y sigue igual: 3 menciones en la salida, todas de la sesión del 23 de septiembre de 2004.

Regla: en `RX_INST`, exigir que el supuesto nombre contenga un nombre de pila (`esPila`) o el apellido de algún orador o de una persona externa ya conocida. Y rechazar la secuencia «Palabra y Palabra» seguida de punto o coma, que continúa la enumeración del nombre de la institución («Agricultura, Ganadería y Alimentación»; «Comunicaciones, Infraestructura y Vivienda»).

## Turnos de la Mesa y documentos leídos (no cambian el veredicto)

1. **Turnos de la Mesa que no se descartan (6 de 8 menciones de miembro con tratamiento; 3 de las externas).** La presidencia deducida (l. 125–137) marca solo al orador más frecuente de cada sesión, y solo si tiene al menos una cuarta parte de los turnos. Quedan fuera:
   - quien lee el orden del día o el despacho: Galdámez (2, 5), Zury Ríos (4, 8) y Alejos Cámbara (19);
   - quien preside en las dos sesiones en que no se dedujo presidencia, GT0020019 y GT0020063: «A discusión la moción privilegiada presentada por el representante…» (7, Morales Véliz) y «Secretaría ha tomado nota de la incorporación del representante…» (6, Méndez Herbruger);
   - la Mesa que conduce una elección: el anuncio de los candidatos (26) y el resultado de la votación (15).

   En la salida, al menos 38 de las 173 menciones de miembro con tratamiento (22 %) van precedidas, en la misma oración, de una fórmula de trámite: «se le llama la atención», «solicitada por», «a discusión», «informa de la integración», «se abre a votación», «ha tomado nota». Es un recuento aproximado por esas expresiones y deja fuera otras lecturas de la Mesa.

   Regla: marcar como Mesa, en cada sesión, a todos los oradores con muchos turnos cortos de fórmula («PUNTO…», «a discusión», «se abre a votación», «Secretaría…»), no solo al más frecuente. Y descartar las menciones que siguen, en la misma oración, a esas fórmulas de trámite.

2. **Firmas de oficios (5 de 8 apellidos sueltos de externas; 6 de 20 en la salida).** «…las muestras de mi consideración y estima. Oscar Berger Presidente constitucional de la República» (21, 24, 25, 27, 28). Un secretario lee el oficio con que el presidente remite una iniciativa o devuelve un decreto vetado, y el suelto recoge la firma. Regla: descartar el nombre que sigue a una fórmula de despedida («consideración y estima», «me suscribo», «atentamente») y precede a su propio cargo, porque es una firma.

3. **Listas de diputados ponentes (9, 10 y 23).** «DIPUTADOS PONENTES: …, Bernardo Arévalo, Semilla; …» es la lista de quienes firman una iniciativa, como una votación nominal. Regla: tratar las listas encabezadas por «DIPUTADOS PONENTES» o cerradas con «y otras firmas» como las votaciones nominales.

4. **El cargo en abstracto (3 de 8 cargos sin nombre de externas; 1 de 2 de miembros).** «será nombrado por el presidente de la República» (32) y «un gabinete… el cual está presidido por el presidente de la República» (12) son artículos de proyectos de ley. «el presidente de la República hará la declaratoria correspondiente» (30) parafrasea el artículo 138 de la Constitución. La identidad por fecha es la del titular, pero el texto no habla de una persona. Regla: no atribuir el cargo sin nombre en el texto de una norma, es decir, con «ARTICULO N» en el mismo párrafo, con el futuro de mandato («será nombrado», «hará») o tras «establece», «determina», «señalando que».

5. **Automención (22).** En su informe al Congreso del 14 de enero de 2011, Álvaro Colom dice «pero Colom ha respetado la independencia de poderes». La fila no tiene id de orador (etiqueta «ALVARO COLOM CABALLEROS»). La comprobación de automenciones (l. 352) solo se aplica a miembros y compara con `id_dep`. Regla: cuando la fila no tenga id, comparar también la persona con la etiqueta del orador, y hacerlo en los sueltos de personas externas.

6. **Párrafo repetido (29).** En GT005022100028 la transcripción repite un párrafo entero, y con él «el presidente de la República». No es un fallo del detector, pero conviene tenerlo en cuenta al limpiar el corpus.

## Otras observaciones sobre la muestra

- **Escaño por actividad sin partido.** Alejandro Maldonado Aguirre (12) sale como miembro con escaño en la VII por tres intervenciones sin partido de 2015, como vicepresidente y como presidente de la República. Fue diputado en 2004–2006, así que el nodo es el suyo (antiguo miembro) y la mención cuenta como correcta, pero la marca de escaño es falsa. `senta` (l. 225–234) da escaño a cualquiera que intervenga en la legislatura. Regla: no dar escaño por actividad a quien, en esa legislatura, tiene muy pocas intervenciones y todas sin partido, como los jefes de Estado en tomas de posesión e informes.
- **Correcciones de la versión 6 confirmadas.** «Bernardo Arévalo, Semilla» en 2020 ya va al diputado (9, 10) y no al presidente de 2024. La clave suelta de Blanca Stalling ya es «Stalling Dávila» (26). En el cargo sin nombre, Otto Pérez Molina (11), que fue diputado en la V, es el mismo nodo de miembro. Con nombre no lo es (ver «Fuera de la muestra»).

## Fuera de la muestra (revisión de la salida completa; no cuenta en la precisión)

- **Segundos nombres que no están en `nombres_pila.json`.** «el diputado Batres» (23 de agosto de 2021, en una lista de firmas) sigue yendo a Carlos Arturo Batres Rivera (VII), como antiguo miembro. Debería ir a Edgar Stuardo Batres Vides, diputado en la IX que interviene en esa sesión. «Stuardo» no está en el léxico y pasa por primer apellido, así que «Batres» no es su apellido de referencia. Es el mismo caso que señaló la primera revisión. Pasa lo mismo con «Verenca» (Nineth Verenca Montenegro Cottom): su apellido de referencia queda en «verenca». En el caso 3 se resolvió solo porque «diputada» deja una única candidata. Regla: en castellano, con cuatro palabras sin partículas, suponer dos nombres y dos apellidos, salvo prueba en contra.
- **El secretario de la Junta Directiva, tratado como cargo de Gobierno.** «hacerle llegar al secretario de esta Junta Directiva, José Conrado García, la boleta» (2004) queda como persona externa, aunque José Conrado García Hidalgo tenía escaño en la V. La l. 401 trata «secretario» como cargo del Gobierno y exige fuerza 3. Pero los dos nombres de pila más el primer apellido solo dan fuerza 2 (l. 95–98). Reglas: no aplicar ese camino cuando «secretario» o «secretaria» va seguido de «de la Junta Directiva», «del Congreso» o «de la Comisión»; y dar fuerza 3 a todos los nombres de pila seguidos del primer apellido.
- **Un jefe de Estado que fue diputado tiene dos nodos.** Otto Pérez Molina es miembro en «general Otto Pérez Molina» (2006, con escaño) y en el cargo sin nombre de 2013 (caso 11, antiguo miembro). Sin embargo, «el gobierno… dirigido por el presidente Otto Pérez Molina» (29 de septiembre de 2015) va a la persona externa «otto perez molina». El camino de los jefes con nombre (l. 364–370) da siempre la clave externa del jefe y no aplica el principio del antiguo miembro que sí aplica el de los cargos sin nombre (l. 559). Regla: en la l. 369, si un solo orador tiene el nombre completo del jefe y tuvo escaño antes en la biblioteca, usar su nodo de miembro, como en la l. 559.
- **Un antiguo miembro con cargo de Gobierno es otro nodo.** «ministro de Desarrollo Social, Raúl Romero Segura» (2021, 4 menciones) queda como persona externa, aunque fue diputado en la VIII (es el orador del caso 3). El camino de los cargos de Gobierno (l. 401–405) no mira `escanoEnBiblioteca`, a diferencia de la l. 438.
- **Externas que no son personas.** Siguen «Ganadería y Alimentación» (3) e «Ingeniero Eléctrico» e «Ingeniero Electrónico» (2018), que la primera revisión ya había señalado.

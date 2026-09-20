# Precisión del detector de menciones: República Dominicana (Cámara de Diputados)

Muestra: `node muestra_precision.cjs paises/DO 10 7` (hasta 10 menciones por categoría, semilla 7). Se juzgaron 42 menciones. Para cada una se leyó la intervención completa en biblioteca.json y las de alrededor, y se comprobó en oradores.json el escaño en esa legislatura y los homónimos. Las fuentes externas consultadas figuran en el motivo de cada caso. El detalle, caso por caso, está en `revision/DO.json`; los números entre paréntesis remiten a él. Las líneas citadas son de `detectar5.cjs`.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) |
|---|---:|---:|---:|---:|---:|---:|---|
| Miembro, con tratamiento o cargo | 218 | 10 | 8 | 2 | 0 | 80 % | 49–94 % |
| Miembro, apellido suelto | 16 | 10 | 0 | 10 | 0 | 0 % | 0–28 % |
| Miembro, cargo sin nombre (por fecha) | 0 | 0 | – | – | – | – | – |
| Externa, con cargo o título | 243 | 10 | 9 | 1 | 0 | 90 % | 60–98 % |
| Externa, antiguo miembro | 2 | 2 | 1 | 1 | 0 | 50 % | 9–91 % |
| Externa, apellido suelto | 26 | 10 | 1 | 9 | 0 | 10 % | 2–40 % |
| **Total** | 505 | 42 | **19** | 23 | 0 | **45 %** | 31–60 % |

No hay dudosas.

El total mezcla categorías muestreadas en proporciones muy distintas: las 16 menciones de apellido suelto de miembro dan 10 casos, igual que las 243 externas con cargo. Si se pondera cada categoría por su tamaño en la salida, la precisión estimada de estas 505 menciones es de un 79 %. Los errores se concentran en los apellidos sueltos, que son pocas menciones.

## Patrones de error

### 1. En el apellido suelto de un miembro se busca el nombre de pila (10 de 10; 16 de 16 en la salida completa)

Casos 11 a 20. El detector elige bien qué apellidos de miembro son distintivos: `suazo` para Juan Suazo Marte y `fabian` para José Antonio Fabián Bertré. Después, sin embargo, busca en el texto la primera palabra del nombre (l. 569, `partes[0]`). Esa palabra es el primer apellido cuando el nombre va como «APELLIDOS, NOMBRE», pero en la RD los nombres van como «NOMBRE APELLIDOS», así que lo que se busca es «Juan» y «José». Por eso todos los aciertos son imposibles. Lo que aparece son topónimos («la provincia de San Juan», «San Juan de la Maguana», «San José de las Matas»), el prócer José Antonio Salcedo (13, 19) y el síndico Juan de los Santos (15, 20).

Regla: buscar el propio apellido de referencia, `apRef(d)`, con la grafía del nombre («Suazo», «Fabián», «Nova»). Nunca debe buscarse una forma que sea nombre de pila (`esPila`). Además, conviene rechazar la coincidencia si va precedida de «San», «Santo» o «Santa», o seguida de «de la/de los/de las» y una palabra con mayúscula, porque eso es un topónimo.

### 2. El apellido suelto de una persona externa nombra un lugar o una institución (9 de 10)

- **Duarte** (33, 35–37, 40–42). «Duarte» entra como figura histórica aunque figura en la lista de apellidos comunes (las históricas se saltan ese filtro, l. 491). En la RD casi siempre es un epónimo: «la provincia Duarte», «la autopista Duarte», «el club de Villa Duarte», «el muelle Juan Pablo Duarte», «la plazoleta Juan Pablo Duarte».
- **Musa** (34, 39). La persona «Antonio Musa» no se menciona nunca. Las 7 menciones con cargo que la crean son el nombre del Hospital Regional Dr. Antonio Musa, y de ahí sale el apellido suelto «Musa», que también es el hospital.
- Solo el caso 38 («Dijo Duarte: …») es la persona.

En la salida completa, 16 de los 17 sueltos «Duarte» o «Musa» son lugares o instituciones. También lo son «la Juan Bosch» y «la Joaquín Balaguer», que llevan artículo femenino.

Reglas:
- (a) Aplicar a los apellidos sueltos el mismo filtro de sustantivo de lugar o institución que ya usa `procesar` (l. 369: «centro|museo|hospital|…|plaza|puerto|estadio…»). Cuando el apellido remata un nombre completo («el muelle Juan Pablo Duarte»), hay que mirar delante de ese nombre. El filtro debería ampliarse con provincia, autopista, carretera, villa, club, muelle, plazoleta, sector, barrio, ensanche, distrito, municipio, residencial, monumento y puente.
- (b) En ese mismo filtro, admitir una o dos palabras entre el sustantivo y la forma («Hospital Regional Doctor Antonio Musa», «Hospital Provincial doctor Leopoldo Martínez»). Así no llegaría a crearse la persona «Antonio Musa».
- (c) Aplicar también a los sueltos la comprobación del artículo de otro género que ya se hace en `procesar` («la Juan Bosch»).

### 3. Un expresidente nombrado con tratamiento se atribuye a su hijo (2; 9 menciones en la salida completa)

«el gobierno del doctor Leonel Fernández» (2011) se atribuye a Omar Leonel Fernández Domínguez, diputado solo en 2020–2024, «por otra legislatura». Se suman tres fallos:
- (a) `esPila` solo cuenta las primeras palabras de los nombres (l. 42–45). «Leonel» no es la primera palabra de ningún orador, así que el nombre de Omar se divide en nombre de pila [omar] y apellidos [leonel, fernández, domínguez]. Con eso, «Leonel Fernández» parece el comienzo de sus apellidos y recibe fuerza 3 (l. 86).
- (b) La tabla de jefes de Estado solo se consulta si la cadena lleva «presidente», «rey» o una forma descriptiva (l. 296). Con «doctor» no se consulta.
- (c) Cuando sí se consulta («presidente Leonel Fernández», 2021), un miembro con escaño y fuerza 3 tiene preferencia sobre el jefe (l. 300).

En la salida completa hay 9 menciones del expresidente atribuidas a Omar: 7 por otra legislatura y 2 como miembro en ejercicio, en 2021 y 2022.

Reglas: si el nombre coincide entero con el de un jefe de Estado de la lista (nombre de pila y apellido), atribuirlo al jefe con cualquier forma. «Segundo nombre + apellido» no debe dar fuerza 3 cuando falta el primer nombre. Y deben reconocerse como nombres de pila las palabras que lo son en cualquier posición: con una lista de nombres, o contando también las segundas palabras de los nombres.

### 4. Un mes corta el nombre y lo que queda casa con un segundo apellido (5; 3 menciones en la salida completa)

«honorable Juan Julio Campos» se atribuye a Carlos de Pérez Juan (2024–2028). El proceso es este:
1. El corte por fechas (`C.fecha`, l. 393, que compara en minúsculas) toma «Julio» por el mes y deja solo «Juan».
2. La regla del segundo apellido detrás de uno muy común (l. 88, la de «señor Zapatero») da fuerza 2 a «Juan» para Carlos de Pérez **Juan**.
3. Ningún otro orador tiene esa fuerza, así que se resuelve «por otra legislatura».

El aludido, Juan Julio Campos Ventura, tenía escaño y acababa de hablar. Pasa lo mismo con «Diputado Juan Julio Campos» (2011) y con «licenciado Juan [de los Santos]» (2006).

Reglas: tratar como mes solo la palabra en minúscula, o la que va seguida de «de» y un número. En castellano los meses se escriben en minúscula; «Julio» con mayúscula dentro de un nombre es nombre de pila. Y no aplicar la regla del segundo apellido cuando la palabra es nombre de pila o es la única que queda del nombre.

### 5. Un miembro en ejercicio pasa a persona externa por un cargo posterior (31)

«el colega Manuel Jiménez» (2011): fue diputado de 2002 a 2016, presidía la Comisión de Cultura y habla en esa misma sesión. En 2022 aparece dos veces como «alcalde Manuel Jiménez» (fue alcalde de Santo Domingo Este en 2020–2024). Por eso entra en `externos`, y `senta` le niega el escaño en todas las legislaturas (l. 192–198). Queda como externa, «antiguo miembro». El caso 32 («exdiputado Manuel Jiménez», 2017) sí es correcto.

Regla: el cargo externo solo debería excluir en las legislaturas en que se menciona, o en las que la persona no tiene intervenciones con partido. Las intervenciones con partido en una legislatura deben prevalecer.

### 6. Restos de encabezados de formulario tomados por nombres (27; 15 menciones de «Preparado» en la salida completa)

«Vía : Secretaría General Preparado por : Comisión…» produce la persona externa «Preparado». Fallan dos cosas: «General» funciona como forma descriptiva aunque aquí forma parte de «Secretaría General», y una palabra con mayúscula tras una forma se convierte en persona externa aunque no sea de nadie (l. 355).

En la salida completa, 33 de las 243 externas con cargo no son personas: «Preparado» (15), «Antonio Musa» (7, el hospital), «Suprema» (la Corte), «Sala», «Monseñor Nouel» (la provincia), «Técnico», «Titular», «Administrador», entre otras.

Reglas:
- No tomar «general» como forma cuando la precede un sustantivo de institución («Secretaría», «Dirección», «Procuraduría», «Contraloría General»).
- Descartar el nombre seguido de «por :».
- Añadir a `noPersona` participios y palabras de formulario: preparado, presentado, elaborado, remitido, asunto, trámite, titular, técnico, suprema, sala.
- Con una forma descriptiva («general», «coronel»…), aceptar una persona externa de una sola palabra solo si es una figura histórica de la lista.

## Observaciones (no cuentan como error)

- **Presidencia.** En la RD la presidencia se decide por la etiqueta, y se hace para todo el país (l. 111). En las sesiones de 2020–2025 los turnos del presidente de la Cámara llevan su nombre como etiqueta («Alfredo Pacheco Osoria»), así que no se descartan. De esos turnos salen 5 de las 10 menciones de miembro de la muestra (1, 3, 6, 7 y 9); tres de ellas son anuncios de la mesa. Las filas narrativas sí lo identifican («el diputado presidente Alfredo Pacheco Osoria indicó:»).
- **Lecturas sin orador.** Las lecturas de informes sin orador («Taquígrafa Parlamentaria», «RELATORA») aportan menciones de particulares que firman contratos con el Estado (23, 27–29). Están bien identificadas, pero no tienen fuente.
- **Claves duplicadas.** Una misma persona externa aparece con claves distintas: «franklin almeyda» y «almeyda rancier»; «pedro leonardo melo baez» y «leonardo melo baez».
- **Fuera de la muestra.** Hay miembros resueltos por un nombre de pila solo. Por ejemplo, «mi abuelo, don Arturo» (2006) se atribuye a Remberto Arturo Cruz Rodríguez «por sesión».

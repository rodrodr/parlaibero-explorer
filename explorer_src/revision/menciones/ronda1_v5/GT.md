# Precisión del detector de menciones: Guatemala (Congreso de la República)

Muestra: `node muestra_precision.cjs paises/GT 10 7` (hasta 10 menciones por categoría, semilla 7). Se juzgaron 30 menciones. Para cada una se leyó la intervención completa en biblioteca.json y las de alrededor, y se comprobó en oradores.json el escaño en esa legislatura y los homónimos (legislaturas IV a X). Hay tres categorías vacías en la salida: no hay apellidos sueltos de miembro, ni cargos sin nombre, ni antiguos miembros externos. El detalle, caso por caso, está en `revision/GT.json`; los números entre paréntesis remiten a él. Las líneas citadas son de `detectar5.cjs`.

## Precisión

| Categoría | En la salida | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) |
|---|---:|---:|---:|---:|---:|---:|---|
| Miembro, con tratamiento o cargo | 185 | 10 | 10 | 0 | 0 | 100 % | 72–100 % |
| Miembro, apellido suelto | 0 | 0 | – | – | – | – | – |
| Miembro, cargo sin nombre (por fecha) | 0 | 0 | – | – | – | – | – |
| Externa, con cargo o título | 222 | 10 | 10 | 0 | 0 | 100 % | 72–100 % |
| Externa, antiguo miembro | 0 | 0 | – | – | – | – | – |
| Externa, apellido suelto | 25 | 10 | 8 | 2 | 0 | 80 % | 49–94 % |
| **Total** | 432 | 30 | **28** | 2 | 0 | **93 %** | 79–98 % |

No hay dudosas. El caso 24 cuenta como correcto porque designa a la persona, pero repite una mención con cargo en el mismo sitio (patrón 3). Si se contara como error, el total sería 27/30 (90 %) y los apellidos sueltos, 7/10.

Con 10 casos por categoría, un 10/10 es compatible con una precisión real bastante menor. La revisión de la salida completa encuentra errores de miembros y de externas que la muestra no recogió (ver «Fuera de la muestra»).

## Patrones de error

### 1. Un futuro presidente, mencionado cuando era diputado, se trata como persona externa (25; 2 de 2 en la salida completa)

En «DIPUTADOS PONENTES: … Bernardo Arévalo, Semilla; …» (2 de abril de 2020), Bernardo Arévalo era diputado: César Bernardo Arévalo de León, de Semilla, legislatura IX, con 142 intervenciones. El suelto «Arévalo» se asigna, sin embargo, al jefe de Estado Bernardo Arévalo, en el cargo desde el 15 de enero de 2024. La razón es que los jefes de Estado entran en los sueltos como figuras «históricas», y para ellas se anula el miembro con escaño que lleva ese apellido (l. 542: `if (hoy.length === 1 && …historico) hoy.length = 0`).

Regla: para un jefe de Estado con mandato, el suelto debe valer solo desde su toma de posesión. Antes de esa fecha, si el apellido y el nombre de pila que lo precede («Bernardo Arévalo») son de un miembro con escaño ese día, la mención es del miembro.

### 2. La clave del apellido suelto es el segundo apellido (29)

«González Dávila, Jaime Amílcar», en la lista de candidatos a magistrado de 2009, se atribuye a Blanca Aída Stalling Dávila. La clave de apellido suelto de una persona externa es la última palabra de su nombre (l. 457 y 484). En los nombres de cuatro palabras esa palabra es el segundo apellido: «Dávila», «Riva», «Cetina», «Bermejo». A Blanca Stalling nadie la llama «Dávila». La palabra con mayúscula que va delante («González») tampoco descarta la coincidencia, porque solo se rechaza cuando es nombre de pila o nombre de un orador (l. 537). Los sueltos «Riva» y «Cetina» de la muestra aciertan solo porque les precede el resto del nombre de esa misma persona («Mendizábal de la Riva», «Rojas Cetina»).

Reglas: tomar como clave el primer apellido, saltando los nombres de pila como ya hace `refDe` con las claves de una palabra, o exigir los dos apellidos juntos («Stalling Dávila»). Y rechazar el suelto si lo precede una palabra con mayúscula que no forma parte del nombre de esa persona, salvo que sea una forma o una palabra como «Gobierno» o «Presidente».

### 3. Duplicados (no son error de identidad) (24; 5 de los 25 sueltos de la salida)

«Abogado Rafael Fernando Mendizábal de la Riva» se registra como mención con cargo y, además, «Riva» como apellido suelto en el mismo sitio. `TITULO_ANTES` (l. 509) solo admite hasta tres palabras con mayúscula entre la forma y el apellido; no admite partículas como «de la».

Regla: saltar el suelto que cae dentro del tramo de una mención ya registrada, guardando los tramos de cada intervención. Otra opción es admitir partículas en `TITULO_ANTES`.

## Fuera de la muestra (revisión de la salida completa)

- **Segundos nombres tomados por primer apellido.** `esPila` solo cuenta las primeras palabras de los nombres (l. 42–45). Por eso, en «Edgar Leonel Arévalo Barrios», «Oswaldo Iván Arévalo Barrios», «César Bernardo Arévalo de León» o «Edgar Stuardo Batres Vides» el segundo nombre pasa por primer apellido, y esos miembros dejan de ser candidatos por su apellido. Consecuencias:
  - Las 9 menciones de 2004 a «doctor/presidente Arévalo» y «diputado Arévalo» van a José Alejandro Arévalo Albúrez, que solo tuvo escaño en las legislaturas VI y VII. Ocho de ellas son Juan José Arévalo, en el debate del acuerdo por el centenario de su nacimiento. La novena, en un escrutinio, es un diputado de la legislatura V.
  - «el diputado Batres» (2021) va a Carlos Arturo Batres Rivera (VII) en lugar de Edgar Stuardo Batres Vides, diputado en ejercicio que interviene en esa misma sesión.

  Regla: reconocer los segundos nombres de pila, con una lista de nombres o contándolos en cualquier posición. Además, añadir a la configuración de Guatemala las figuras históricas, empezando por Juan José Arévalo (presidente de 1945 a 1951).
- **Externas con cargo que no son personas.** Son 12 de las 222, todas restos de oficios y formularios: «Secretaría General Asunto», «Contador general TRAMITE», «Ejercicio Fiscal Vigente», «Secretario Voto razonado», «Ponente Comisiones», «Ingeniero Eléctrico», «Ingeniero Electrónico», «[ministro de Agricultura,] Ganadería y Alimentación», «[juez…] Narcoactividad y Delitos», «[director de Asuntos Jurídicos,] Tratados Internacionales y Traducciones». Reglas: no tomar «general» como forma tras «Secretaría» (u otro sustantivo de institución); añadir a `noPersona` palabras de formulario (asunto, trámite, vigente, voto) y plurales de institución (comisiones, internacionales, delitos); y exigir en el patrón «cargo de Institución, Nombre» (l. 154) que lo que sigue a la coma no continúe el nombre de la institución.

## Observaciones sobre la presidencia deducida (no cuentan como error)

En Guatemala la presidencia de cada sesión se deduce (l. 112–123): se marca solo al orador más frecuente, y solo si tiene al menos el 25 % de los turnos y estos son cortos.
- En dos de las sesiones de la muestra (GT0020063 y GT0020019) no se dedujo ninguna presidencia.
- En las demás, los otros turnos de mesa (quien preside por turnos, la Secretaría leyendo el despacho o conduciendo votaciones) no se descartan.
- 8 de las 10 menciones de miembro de la muestra salen de esos turnos (2 y 4 a 10): «Se le llama la atención al diputado…», «Se abre a votación la propuesta del diputado…», lecturas del despacho calificado. Las identidades son correctas, pero se trata de fórmulas de procedimiento, no de alusiones en el debate.
- Las dos menciones de la salida que dependen de la presidencia deducida son correctas: un desempate «por preside» («Estimado diputado Morales», 2004) y una «a la Presidencia» (Alejos Cámbara, 2010).

Regla posible: marcar como mesa, en cada sesión, a todos los oradores con muchos turnos cortos de fórmula («se pregunta si se aprueba», «a discusión», «se abre a votación», «PUNTO…»), no solo al más frecuente.

Otra observación: una misma persona externa aparece con claves distintas. Por ejemplo, «blanca aida stalling davila» y «stalling davila»; «juan jose arevalo bermejo» y «arevalo bermejo»; «jose rafael espada» y «rafael espada»; «oscar berger», «oscar berger perdomo» y «oscar jose rafael berger perdomo».

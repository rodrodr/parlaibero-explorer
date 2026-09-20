# Precisión de las menciones, versión 6: Costa Rica (Asamblea Legislativa)

Muestra: `node muestra_precision6.cjs paises/CR 8 23` sobre `paises/CR/menciones6.json`, hasta 8 menciones al azar por categoría. Son 51 menciones: la categoría «externa, antiguo orador sin escaño» solo tiene 3 en la salida. Cada mención se ha revisado con la intervención completa en `biblioteca.json`, las de alrededor en la sesión y `oradores.json`. Las fuentes consultadas van en el motivo de cada caso, en `revision6/CR.json`. Los números (#) son los de la muestra y las líneas citadas son de `detectar6.cjs`.

Criterio: una mención es correcta si va al nodo que prescribe la versión 6. Para un miembro, eso es la persona a la que se refiere el texto, con escaño en esa legislatura o, si va como antiguo miembro, con escaño anterior en la muestra. Para una externa, es una persona real bien identificada que no debía ser nodo de miembro. Si la persona es la correcta pero el nodo no (un miembro que debía ser externa, o al revés), la mención cuenta como incorrecta. La columna «Persona» da la precisión mirando solo la identidad.

## Precisión

| Categoría | En la salida | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Persona | No deberían contar |
|---|---:|---:|---:|---:|---:|---|---:|---:|
| Miembro, con tratamiento o cargo | 1382 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 2 |
| Miembro, apellido suelto | 26 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 1 |
| Miembro, cargo sin nombre (por fecha) | 17 | 3 | 5 | 0 | 3/8 | 14–69 % | 6/8 | 0 |
| Externa, con cargo o título | 505 | 7 | 1 | 0 | 7/8 | 53–98 % | 8/8 | 0 |
| Externa, antiguo orador sin escaño | 3 | 1 | 2 | 0 | 1/3 | 6–79 % | 1/3 | 0 |
| Externa, apellido suelto | 104 | 7 | 1 | 0 | 7/8 | 53–98 % | 7/8 | 1 |
| Externa, cargo sin nombre (por fecha) | 100 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 0 |
| **Total** | 2137 | **42** | 9 | 0 | **42/51 (82 %)** | 70–90 % | 46/51 | 4 |

- No hay dudosas. Una de las correctas es discutible: #47 usa el cargo en abstracto («da igual cómo se llame»), pero dentro de un párrafo sobre Chaves.
- Las dos categorías pequeñas se pueden contar enteras. Los 17 cargos sin nombre de miembro son 7 de Abel Pacheco (correctos), 7 de Miguel Ángel Rodríguez y 3 de Carlos Alvarado (incorrectos): 7 de 17. Las 3 externas de antiguo orador son las de la muestra: 1 de 3.
- Ponderada por el tamaño de cada categoría, con esos recuentos completos, la precisión estimada ronda el 96 %. Pesan mucho las 1382 menciones de miembro con tratamiento, que salen 8 de 8. Es una cifra orientativa.
- En la primera revisión (`revision/CR.md`) la precisión fue de 24/50. En esta muestra no aparece ninguno de estos errores de entonces: los apellidos sueltos de miembros buscados por el nombre de pila, las externas «antiguas» por el partido vacío, «don + nombre de pila» sin comprobar la sesión, «Reforma Fiscal» y «Don Bosco». Siguen los escaños espurios y el sumario.

## Errores que quedan, por causa

### 1. Presidentes de la República con escaño espurio (#17, #20, #23)

En marzo de 2002, «el Presidente de la República» es Miguel Ángel Rodríguez según la tabla de jefes. La rama de cargos sin nombre (l. 559) lo resuelve contra `oradores.json` y le da nodo de miembro si `r.sentado || tuvoEscano(r.d)`. `tuvoEscano` (l. 237) vale con un escaño en cualquier legislatura de la muestra, anterior o posterior. La única fila de Rodríguez es de 2002-2006: 3 intervenciones entre el 1 y el 8 de mayo de 2002, su último informe y el traspaso de poderes como presidente saliente. Fue diputado solo en 1990-1993, fuera de la muestra. Así, sus 7 menciones de 2002 van a un nodo de miembro «antiguo» con un escaño posterior y espurio. Ese nodo recibe también una mención con nombre de 2004, y otras 2 van a la persona externa «miguel angel rodriguez»: son dos nodos para la misma persona.

Las mismas filas de traspaso dan «escaño» a Abel Pacheco en 2002-2006 (2 intervenciones del 8-5-2002: #19, #21, #22) y a Laura Chinchilla en 2006-2010 (1 del 8-5-2006: #9) y en 2010-2014 (3 desde el 8-5-2010). En esos casos el nodo acierta porque ambos fueron diputados antes en la muestra, pero debían ir marcados como antiguos miembros y no como miembros con escaño.

Qué lo evitaría:
- En la rama de cargos sin nombre (l. 559), exigir `escanoEnBiblioteca(r.d, leg) === 'antes'` en vez de `tuvoEscano(r.d)`, como hace la rama de nombres (l. 438).
- No contar como escaño una legislatura cuya única actividad cae entre el 1 y el 8 de mayo del primer año (informe presidencial y traspaso de poderes). En Costa Rica es la huella de presidentes y vicepresidentes de la República.
- No contar como escaño las intervenciones de quien ese día es jefe de Estado según la tabla. Así se descartan también las 3 de Chinchilla en 2010-2014, que llegan hasta noviembre de 2010.

### 2. El jefe de Estado se busca en la lista de oradores con su nombre corto (#18, #24)

La tabla de jefes dice «Carlos Alvarado». `resolver(['carlos', 'alvarado'])` encuentra a Carlos Manuel Fernández Alvarado (PUSC, 1994-1998) con fuerza 2, por la regla del primer apellido muy común (l. 99: «Fernández» está en `TOP10` y «Alvarado» es su segundo apellido). Como tuvo escaño en la muestra, recibe el nodo de miembro. El presidente es Carlos Alvarado Quesada, que nunca fue diputado. Son las 3 menciones de «el presidente de la República» de 2018-2022, y #24 está en una intervención que dice «el señor presidente, Carlos Alvarado».

Qué lo evitaría: resolver a un jefe de Estado contra `oradores.json` solo con fuerza 3 sobre su nombre completo, poniendo en la tabla «Carlos Alvarado Quesada», «Miguel Ángel Rodríguez Echeverría», «Abel Pacheco de la Espriella», «Laura Chinchilla Miranda»… O bien con un `id_dep` explícito en la tabla. Si no, persona externa.

### 3. «Señor + apellido» del presidente en ejercicio va a un orador antiguo (#33, #35)

«El señor Chaves» (16-12-2025, debate sobre la inmunidad de Rodrigo Chaves) va a José Joaquín Chaves Zamora, diputado del PLN en 1990-1994 con 3 intervenciones en `oradores.json`. La atribución por fecha solo se aplica con «presidente» (l. 364-370), así que el apellido va a `resolver()`. Allí aparece un único Chaves varón, sin escaño en la muestra, y la rama del orador sin escaño (l. 440) lo convierte en persona externa con su nombre completo. Son las 2 menciones de este tipo en la salida.

Qué lo evitaría:
- Antes de la rama del orador sin escaño (l. 440), si el nombre es un solo apellido, consultar `jefeDe(M, fecha)` con cualquier forma. Si un jefe con ese apellido está en el cargo ese día (o lo dejó hace poco), atribuírselo.
- No convertir en persona externa un apellido solo que coincide con un orador sin escaño en la muestra, salvo que el apellido sea raro.

### 4. Antiguo miembro con un cargo de Gobierno: nodo externo aparte (#29)

«El señor ministro Méndez Mata» (2004) va a la persona externa «mendez mata». En la misma intervención, «don Rodolfo Méndez Mata» va a su nodo de miembro, porque fue diputado del PUSC en 1994-1998. La rama de cargos de Gobierno (l. 401-402) manda a persona externa a todo ministro sin escaño ese día y no mira si lo tuvo antes. Méndez Mata queda en dos nodos: 3 menciones de miembro y 2 externas. Con los jefes de Estado pasa lo mismo, en la rama de «presidente» (l. 364-370) y en la de apellidos sueltos (l. 718-756). Laura Chinchilla, diputada en 2002-2006, tiene 8 menciones de miembro (2005-2012) y 12 externas como presidenta y expresidenta (2013-2025).

Qué lo evitaría: en la rama de Gobierno y en la de jefes, si un candidato con fuerza 3 (o el `id_dep` de la tabla) tuvo escaño antes en la muestra (`escanoEnBiblioteca === 'antes'`), usar su nodo de miembro como antiguo miembro. La persona externa queda para los homónimos sin escaño anterior.

### 5. Apellido de una familia de presidentes (#42)

En 2015, en «el Estado social de derecho, creado por Figueres, por Calderón, por Manuel Mora, por la Iglesia», Calderón es Calderón Guardia (1940-1944). El apellido suelto va al último jefe con ese apellido, Calderón Fournier (1990-1994), cuyo nodo se llama «rafael angel calderon», un nombre que comparten padre e hijo. En la misma frase, «Figueres» va a José María Figueres y no a José Figueres Ferrer: Figueres Ferrer está en `historicos`, pero pierde ante el jefe más reciente.

Qué lo evitaría:
- Añadir a la tabla a Calderón Guardia (1940-1944) y a Figueres Ferrer, y llamar al nodo de 1990-1994 «Rafael Ángel Calderón Fournier».
- Si un apellido suelto es de un jefe cuyo mandato acabó hace más de 8 años y también de una figura histórica, dejar la mención sin atribuir. Solo se atribuye si el nombre de pila o el segundo apellido deshacen el empate.

## Menciones que no deberían contar (4 de 51)

Las cuatro tienen bien la identidad. En toda la salida la proporción es mayor: unas 457 de 2297 menciones (20 %), sobre todo por las dos primeras causas.

- **Turnos de quien preside que no se descartan (#2).** «Puede proceder, el diputado Constenla Umaña» es de Ovidio Pacheco Salazar, que preside y firma el acta como presidente. Cuando el rótulo es solo el nombre, la Presidencia se deduce solo en las sesiones sin ninguna fila de Presidencia y con una mediana de turnos de 400 caracteres o menos (l. 121-137). En Costa Rica las filas «EL PRESIDENTE» suelen ser del sumario, así que la sesión ya «tiene Mesa» y no se deduce nada. En otras sesiones la mediana pasa de 400, o preside más de una persona y solo se deduce la que más turnos tiene (el 25-6-2013, Annie Saborío sustituye a Mendoza). Son unas 163 menciones en 8 sesiones: Álvarez Desanti (1995), Weisleder (1997), Ovidio Pacheco y Laclé (2002), Francisco Antonio Pacheco (2007 y 2008), Annie Saborío y Mendoza (2013). Regla: tomar a quien preside de la firma al final del acta («Nombre PRESIDENTE») o de la proporción de turnos con «tiene la palabra», «puede proceder», «puede continuar» o «se le ha vencido el tiempo». Hay que hacerlo aunque la sesión tenga filas «EL PRESIDENTE» del sumario.
- **Sumario del acta dentro de intervenciones (#4).** Hay 74 filas con líneas «ROL NOMBRE: página», atribuidas al diputado de la fila anterior, con unas 287 menciones (12 % de la salida). La regla de rótulos en mayúsculas (l. 506) no las quita: esas filas están casi enteras en mayúsculas (`mayusculaTodo`, l. 479) o, desde 2010, en minúsculas. Regla: saltar las líneas que acaban en «: número» o en tabulador y número, y las filas en que al menos el 30 % de las líneas son así.
- **Lista de asistencia (#16).** «DIPUTADOS PRESENTES Acuña Castro, Yolanda; …» aparece pegada a una intervención de Monestel. Regla: saltar desde «DIPUTADOS PRESENTES» o «AUSENTES» hasta el final de la lista.
- **Documento leído por la Secretaría del Directorio (#39).** La nota de la ministra de Justicia la lee el segundo secretario, Mario Calderón. En Costa Rica los secretarios son diputados y el rótulo no lo delata. Habría que tratar como lectura el texto que empieza por «Nota de…» y sigue con el membrete del documento.

## Otras observaciones

- «Se dirige» aparece en una enumeración (#12) y en la lista de asistencia (#16): `vocativoDe` (l. 344) solo mira que haya una coma antes y otra después.
- Con las reglas de los puntos 1 y 4, Miguel Ángel Rodríguez quedaría en un solo nodo externo, y Laura Chinchilla y Rodolfo Méndez Mata en su nodo de miembro.

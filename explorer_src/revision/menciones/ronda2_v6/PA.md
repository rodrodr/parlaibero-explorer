# Precisión de las menciones, versión 6: Panamá (Asamblea Nacional; antes Asamblea Legislativa)

Muestra: `node muestra_precision6.cjs paises/PA 8 23` sobre `paises/PA/menciones6.json`, hasta 8 menciones al azar por categoría. Son 48 menciones: la categoría «externa, antiguo orador sin escaño» está vacía en la salida. Cada mención se ha revisado con la intervención completa en `biblioteca.json`, las de alrededor en la sesión y `oradores.json`. Los suplentes cuentan como miembros. Las fuentes consultadas van en el motivo de cada caso, en `revision6/PA.json`. Los números (#) son los de la muestra y las líneas citadas son de `detectar6.cjs`.

Criterio: una mención es correcta si va al nodo que prescribe la versión 6. Para un miembro, eso es la persona a la que se refiere el texto, con escaño en esa legislatura o, si va como antiguo miembro, con escaño anterior en la muestra. Para una externa, es una persona real bien identificada que no debía ser nodo de miembro. Si la persona es la correcta pero el nodo no, la mención cuenta como incorrecta. La columna «Persona» da la precisión mirando solo la identidad.

## Precisión

| Categoría | En la salida | Correctas | Incorrectas | Dudosas | Precisión | IC 95 % (Wilson) | Persona | No deberían contar |
|---|---:|---:|---:|---:|---:|---|---:|---:|
| Miembro, con tratamiento o cargo | 467 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 4 |
| Miembro, apellido suelto | 49 | 7 | 1 | 0 | 7/8 | 53–98 % | 7/8 | 7 |
| Miembro, cargo sin nombre (por fecha) | 11 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 1 |
| Externa, con cargo o título | 452 | 7 | 1 | 0 | 7/8 | 53–98 % | 8/8 | 4 |
| Externa, antiguo orador sin escaño | 0 | – | – | – | – | – | – | – |
| Externa, apellido suelto | 50 | 7 | 1 | 0 | 7/8 | 53–98 % | 8/8 | 1 |
| Externa, cargo sin nombre (por fecha) | 31 | 8 | 0 | 0 | 8/8 | 68–100 % | 8/8 | 0 |
| **Total** | 1060 | **45** | 3 | 0 | **45/48 (94 %)** | 83–98 % | 47/48 | 17 |

- No hay dudosas.
- Los 11 cargos sin nombre de miembro son de Laurentino Cortizo (2020-2024), con el nodo de miembro que le corresponde: 11 de 11.
- Ponderada por el tamaño de cada categoría, la precisión estimada ronda el 94 %. Es una cifra orientativa: con 8 casos por categoría, cada intervalo es amplio.
- El problema principal ya no es la identidad, sino lo que se cuenta: 17 de las 48 menciones (35 %) no deberían contar. Son lecturas de la Secretaría, un turno de quien preside y un pasaje duplicado. En toda la salida son unas 415 de 1138 menciones (36 %).
- En la primera revisión (`revision/PA.md`) la precisión fue de 31/40. En esta muestra no aparece ninguno de estos errores de entonces: el apellido «Toro» de Bocas del Toro, Cortizo en 2004 como persona externa, el género contradictorio, la suplente con el partido vacío y la cabecera de página.

## Errores que quedan, por causa

### 1. Antiguo miembro con un cargo de Gobierno o en la Presidencia de la República: nodo externo aparte (#30, #33)

- #33: «el señor Presidente de la República, Laurentino “Nito” Cortizo» (2024) va a la persona externa «laurentino cortizo», por la rama de apellidos sueltos de jefes de Estado (l. 718-756). En la misma intervención, «al señor Presidente de la República» (#20) va a su nodo de miembro: fue legislador en 1994-2004. Desde 2019, Cortizo tiene 12 menciones de miembro y 10 externas.
- #30: «la Ministra Balbina» (2008) va a la persona externa «balbina», solo el nombre de pila, por la rama de cargos de Gobierno (l. 401-402), que manda a externa a todo ministro sin escaño ese día. Balbina Herrera fue legisladora en 1994-2004. En la misma intervención, «candidata Balbina Herrera» y «Balbina Herrera» van a otra persona externa, «balbina herrera»: dos nodos externos y ninguno de miembro (véase también el punto 3).

Qué lo evitaría:
- En las ramas de jefes de Estado (l. 364-370 y l. 718-756) y de cargos de Gobierno (l. 401-402), si el nombre se resuelve con fuerza 3, o con un `id_dep` puesto en la tabla de jefes, a alguien con escaño anterior en la muestra, usar su nodo de miembro como antiguo miembro.
- Con «Ministra + nombre de pila», aplicar la regla del nombre de pila: solo se atribuye si esa persona interviene en la sesión. No crear una persona externa cuya clave sea un nombre de pila.

### 2. El apellido suelto de un miembro se usa para un pariente (#13)

En «Al amigo de Chiriquí, al colega Fanovich, uno no tiene la culpa por los pecados que cometan nuestras familias, pero … un ingeniero de apellido Fanovich era el jefe del MOP», el ingeniero es Luis Fanovich, director regional del MOP en Chiriquí. Miguel Fanovich era entonces gobernador. Aun así, la mención se atribuye al diputado Miguel Ángel Fanovich, y lo mismo pasa con el «donde Fanovich» que sigue.

Qué lo evitaría: no aceptar el apellido suelto de un miembro tras «de apellido», «apellidado» o «apellidada». Es la fórmula para presentar a otra persona.

### 3. Datos de `oradores.json` que desvían la atribución

- **Un diputado con dos `id_dep`.** Abel Beker Ábrego figura como PA00005, «ABEL BECKER ABREGO» (243 intervenciones; es quien habla en la biblioteca), y como PA01288, «ABEL BEKER ÁBREGO» (49; no habla en la biblioteca). 31 de sus 32 menciones van a PA01288 (#11, #14, #16). La persona es la correcta, pero la red separa sus intervenciones de las menciones que recibe. Regla: unir los oradores con el mismo nombre salvo tildes y una consonante doble (Becker/Beker) en la misma legislatura y partido.
- **Sexo equivocado.** Balbina Herrera Araúz tiene sexo «M». Con el género estricto (l. 299), las formas femeninas la descartan: «compañera Balbina Herrera» (1997) e «ingeniera Balbina Herrera» (2004) van a persona externa aunque tenía escaño, y «legisladora Balbina Herrera» (2001) queda sin resolver. Regla: corregir el dato y, con género estricto, no descartar al único candidato con el nombre completo (fuerza 3); marcarlo como sexo dudoso.
- **Personal de la Asamblea como orador.** José Ismael Herrera, legislador del PRD en 1999-2004, es subsecretario general en 2004-2009 y aparece en esa legislatura con 153 intervenciones, sin partido. Sus lecturas cuentan como menciones de un miembro con escaño (#12).

## Menciones que no deberían contar (17 de 48)

Las 17 tienen bien la identidad.

- **Lecturas de la Secretaría y de la Relatoría (15: #4, #6, #7, #9, #10, #11, #12, #14, #15, #16, #23, #25, #27, #29, #36).** Son notas que habilitan a los suplentes («Nota del honorable diputado X, en la que informa que actuará … con el honorable diputado suplente Y»), proponentes de mociones («Los honorables diputados X, Y y otros, proponen»), cortesías de sala, correspondencia, resoluciones y títulos del orden del día. «Abel Beker» se lee diez veces en #11. En toda la salida, 330 de 1138 menciones (29 %) salen de filas con rótulo de secretario o secretaria general, subsecretario o subsecretaria, relator o relatora, o asistente del secretario. Regla: tratar esas filas como la Mesa, incluido el personal con `id_dep` cuyo rótulo lo delata (José Ismael Herrera). Como mínimo, descartar las fórmulas «X y otros, proponen», «Nota del honorable diputado X, en la que informa que actuará» y las listas de cortesía de sala.
- **Turno de quien preside (#26).** El rótulo «JUAN MANUEL PERALTA-PRESIDENTE ENCARGADO», con guion sin espacios, no se reconoce como Presidencia. Tampoco «JACOBO L. SALAS D., PRESIDENTE DE LA ASAMBLEA LEGISLATIVA» ni sus variantes: la forma con coma de `esPresidenciaEtiqueta` (l. 117) exige que el rótulo acabe en «presidente» o «presidente encargado». Son 18 menciones en la salida. Regla: aceptar «, PRESIDENTE/A (ENCARGADO/A) DE LA ASAMBLEA…» y «-PRESIDENTE ENCARGADO».
- **Pasaje duplicado (#1).** El periodo de incidencias del 30-6-2004 está dos veces en el acta (filas 049 y 142, con pequeñas diferencias de transcripción). La sesión del 6-10-2004 tiene buena parte del debate repetido (67 filas). En toda la salida hay 128 filas que repiten un pasaje de una fila anterior de la misma sesión, con 81 menciones. #39 y #40 están en la primera copia, así que la que sobra es la otra. Regla: antes de detectar, descartar las filas que repiten al menos 80 letras seguidas de una fila anterior de la sesión (texto normalizado), o corregirlo al deduplicar el corpus.

## Otras observaciones

- «Se dirige» se marca en dos cargos sin nombre que no son vocativos: «Gracias al señor Presidente de la República» (#20) y «… y, por supuesto, al Presidente de la República» (#21). El artículo «al» está dentro de la coincidencia y `vocativoDe` (l. 344) no lo ve. Regla: un cargo sin nombre que empieza por «el», «al» o «del» nunca es vocativo.
- Fuera de la muestra: las 7 menciones de «General Torrijos» (1996, 2004 y 2020) van a Martín Torrijos, pero son del general Omar Torrijos. `historicos` tiene la clave «omar torrijos», que no casa con un apellido solo tras un grado militar (l. 414), y en 2020 la rama de jefes (l. 364) se adelanta. «Honorables Colegas» crea la persona externa «colegas» (6 menciones) y «Papa Egoró» sigue creando «egoro» (10).

# Precisión de las menciones — Panamá (Asamblea Nacional; antes Asamblea Legislativa)

Muestra: `node muestra_precision.cjs paises/PA 10 7`. Son 41 menciones: «externa, antiguo miembro» solo tiene una en el corpus y «cargo sin nombre», ninguna. Cada una se ha revisado con la intervención completa, las de alrededor en la sesión y `oradores.json`. Las personas externas se han contrastado con fuentes, citadas en `PA.json`. Los suplentes cuentan como miembros. Los números (#) son los de la muestra.

## Precisión

| Categoría | En el corpus | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 485 | 7 | 2 | 1 | 7/9 (78 %) |
| Miembro, apellido suelto | 28 | 10 | 0 | 0 | 10/10 (100 %) |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | sin menciones: PA no tiene cargos sin nombre configurados |
| Externa, con cargo o título | 462 | 9 | 1 | 0 | 9/10 (90 %) |
| Externa, antiguo miembro | 1 | 0 | 1 | 0 | 0/1 |
| Externa, apellido suelto | 170 | 5 | 5 | 0 | 5/10 (50 %) |
| **Total** | 1146 | 31 | 9 | 1 | **31/40 (78 %)** |

Dudosa, aparte: #3, «Doctor Justo Medina, Enlace del Ministerio de Salud con la Asamblea» (2020), atribuido al exlegislador Justo Medina Chu (PRD, 1994-1999). No he encontrado fuentes que confirmen o descarten que sea la misma persona.

Si se pondera cada categoría por su tamaño en el corpus, la precisión estimada es del 79 %. Es una cifra orientativa: con 10 casos por categoría, cada porcentaje tiene un margen amplio.

## Patrones de error

### 1. Persona externa espuria con un topónimo en el nombre: «Toro» (#32, #35, #38)

En 1997, «Colega Mario Miller de Bocas del Toro» dio la clave «mario miller bocas toro», que absorbió otras seis menciones de «Mario Miller». Como su última palabra es «toro» y la persona suma siete menciones (el mínimo son cinco), «Toro» pasó a ser su apellido suelto. Son 86 menciones: 84 de «Bocas del Toro» (#35, #38) y 2 del apodo de Ernesto Pérez Balladares, «el Toro» (#32). «Bocas» no bloquea la mención porque forma parte del nombre mostrado de esa persona.

Qué lo evitaría:
- Añadir a `lugares` las provincias y distritos de Panamá: bocas, toro, chiriquí, veraguas, coclé, darién, colón, herrera, los santos, san miguelito, chilibre, arraiján, chorrera… Así el nombre se corta en «de + lugar».
- No admitir como apellido suelto una palabra que forma parte de un topónimo («Bocas del Toro»).
- Declarar en `alias` de PA el apodo «Toro» → Pérez Balladares. El mecanismo existe, pero PA no lo usa.

### 2. Jefe de Estado que tenía escaño en la fecha de la mención (#33, #37)

En 2004, «Laurentino Cortizo» se atribuye a la persona externa, el presidente de 2019-2024. Pero entonces era legislador de 1999-2004: habla su suplente, Raúl Cortizo, que lo llama «mi legislador principal».

Causa: el apellido suelto de un jefe de Estado va siempre a la persona externa (`if (hoy.length === 1 && …historico) hoy.length = 0`), aunque haya un miembro con escaño con ese nombre. En el corpus hay 9 menciones sueltas de «Cortizo» anteriores a septiembre de 2004:
- 6 son de él cuando era legislador.
- Las otras 3 son de su esposa, «Jazmín de Cortizo». Ahí el nombre de pila delante no bloquea la mención porque «Jazmín» no es el nombre de ningún orador.

Qué lo evitaría:
- Fuera del mandato, si el nombre es el de un miembro con escaño en esa fecha, resolver al miembro. Mejor aún: unir al jefe de Estado con su nodo de miembro cuando está en `oradores.json`.
- Bloquear el apellido suelto cuando delante va un nombre de pila ajeno, según una lista general de nombres.
- Añadir a las formas de PA las abreviaturas «H.L.», «HH.LL.» y «H.L.S.». Ahora no se reconocen como tratamiento: «Nota del H.L. Laurentino Cortizo-Cohen» entra como apellido suelto.

### 3. Se ignora un género contradictorio al resolver por otra legislatura (#4, #10)

«El Director Fuentes» se atribuye a la exlegisladora Migdalia Fuentes de Pineda, y «doctor Royo» a la exlegisladora Maritza Royo de Bermúdez. Son Armando Fuentes, administrador de la ASEP, al que otra diputada nombra en la misma sesión, y Aristides Royo, ministro para Asuntos del Canal, presente en la sesión.

Causa: cuando ningún candidato coincide con el género, el filtro se queda con todos. Además, «director» no está en la lista masculina.

Qué lo evitaría:
- Si la forma o el artículo marcan un género y ningún candidato lo tiene, no resolver a un miembro y dejar la mención como persona externa por el apellido.
- Añadir «director» y «directora», y las demás formas de `gobierno`, a las listas de género.
- Cuando «título + apellido» solo se resuelve por otra legislatura, exigir más evidencia: el nombre de pila, o que esa persona aparezca como antiguo miembro en esas fechas.

### 4. Suplente con el partido vacío tomada por persona externa (#31)

«honorable diputada suplente Ana Tilsia Frías» (2016) sale como persona externa y «antigua»: su fila de 2014-2019 tiene `party: ""`, y `senta()` exige partido. En PA hay 38 filas de oradores sin partido, 13 de ellas con 20 o más intervenciones.

Qué lo evitaría: dar el escaño por la actividad, o por la propia forma de miembro («diputada suplente»), aunque falte el partido. Es la misma regla que en Costa Rica.

### 5. Cabecera de página tomada por un nombre (#24)

En «ELIA MENDOZA H. MIÉRCOLES 06 DE OCT. DE 2004», el detector lee «H.» como «honorable» y «Miércoles» como nombre.

Qué lo evitaría:
- Añadir los días de la semana (lunes a domingo) a `fecha`.
- Descartar las cabeceras del diario de debates: «DIARIO DE DEBATE», «TIEMPO No», «HORA DE INICIO», «SIGUE:».

### Notas

- El apellido suelto de miembro acierta en 10 de 10, pero por el mismo fallo que en Costa Rica: la forma buscada es el nombre de pila (`partes[0]` de un nombre sin coma). El texto de la mención es «Carlos», «Abel» o «Alberto», y acierta solo porque la palabra siguiente es el apellido. Un «Carlos» seguido de coma se atribuiría a Carlos Smith. La corrección es la misma: buscar el apellido de la clave.
- En #9, la persona es correcta (Rubén de León), pero el cargo «presidente» y el vocativo vienen de «señor Presidente, los honorables legisladores, Rubén de León…», por la expresión de «cargo + institución + coma + nombre».
- Fuera de la muestra, «Movimiento Papa Egoró», un partido, crea la persona externa «egoro» (10 menciones), porque «papa» es forma externa. Convendría añadir «egoró» a `noPersona` en PA, o tratar «Papa Egoró» como institución.

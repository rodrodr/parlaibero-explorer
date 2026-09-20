# Precisión de las menciones — Costa Rica (Asamblea Legislativa)

Muestra: `node muestra_precision.cjs paises/CR 10 7`, 10 menciones al azar por categoría (50 en total). Cada una se ha revisado con la intervención completa, las de alrededor en la sesión y `oradores.json`. Las personas externas se han contrastado con fuentes, citadas en `CR.json`. Los números (#) son los de la muestra.

## Precisión

| Categoría | En el corpus | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 2029 | 8 | 2 | 0 | 8/10 (80 %) |
| Miembro, apellido suelto | 176 | 0 | 10 | 0 | 0/10 (0 %) |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | sin menciones: CR no tiene cargos sin nombre configurados |
| Externa, con cargo o título | 626 | 8 | 2 | 0 | 8/10 (80 %) |
| Externa, antiguo miembro | 15 | 1 | 9 | 0 | 1/10 (10 %) |
| Externa, apellido suelto | 135 | 7 | 3 | 0 | 7/10 (70 %) |
| **Total** | 2981 | 24 | 26 | 0 | **24/50 (48 %)** |

No hay dudosas. Si se pondera cada categoría por su tamaño en el corpus, la precisión estimada es del 74 %. Es una cifra orientativa: con 10 casos por categoría, cada porcentaje tiene un margen amplio.

## Patrones de error

### 1. El apellido suelto de un miembro se busca por su nombre de pila (10 de 10 en esa categoría)

Ejemplos: los membretes «San José, 15 de marzo de 2007» y otros con «San José, …» se atribuyen a Echandi (#11) o a Merino (#14, #16, #17, #19). «San Carlos» se atribuye a Avendaño (#12, #13, #18) o a Tinoco (#15). «La provincia de San José» se atribuye a Echandi (#20).

Causa: en el bucle de apellidos sueltos de miembros, la forma que se busca es `partes[0]` del nombre. En las listas «APELLIDOS, NOMBRE» eso es el primer apellido, pero en Costa Rica los nombres van como «NOMBRE APELLIDOS», sin coma, y se busca el nombre de pila: «José», «Carlos», «Pilar», «Luis», «Gerardo»… Además, cada «San José» se cuenta una vez por cada miembro con escaño que se llama José: en 2006-2010, Merino y Echandi. Fuera de la muestra solo aciertan los casos «Nombre Apellido» («Pilar Cisneros», «Saúl Weisleder»), gracias a la comprobación de la palabra siguiente.

Qué lo evitaría:
- Buscar como forma el apellido que ya sirve de clave (`apRef(d)`: Merino, Echandi, Avendaño) cuando el nombre no lleva coma.
- Tratar «San/Santa/Santo + palabra» como un lugar.
- Descartar los membretes «Lugar, d de mes de aaaa».

### 2. Diputados con el partido vacío en `oradores.json` se toman por personas sin escaño (8 de 10 en «externa, antiguo miembro»)

Ejemplos: Carlos Manuel Gutiérrez Gómez era diputado en 2006-2010 y tiene 1317 intervenciones; habla en las mismas sesiones en que se le nombra. Aun así sale como persona externa «antigua» (#32, #35, #37-#40, y en el sumario #31 y #33).

Causa: `senta()` exige partido en la legislatura, y su fila de 2006-2010 tiene `party: ""`. En CR hay cuatro filas así (también Juan Luis Jiménez Succar, Juan Bosco Acevedo Hurtado y Xiomara Rodríguez). Las de Gutiérrez Gómez son 12 de las 15 menciones de la categoría; otras 2 son «Don Bosco» (patrón 8).

Qué lo evitaría:
- Dar el escaño por la actividad aunque falte el partido: por ejemplo, 20 o más intervenciones en la legislatura, o intervenir en la misma sesión.
- No marcar como «antiguo» a quien solo tiene filas en la legislatura de la mención.

### 3. Escaños espurios: sesiones de fecha dudosa y la regla «antes y después»

Ejemplos:
- #4: Ofelia Taitelbaum, defensora de los habitantes en 2013, se resuelve como miembro con escaño. Su fila de 2010-2014 son 2 intervenciones del 2010-05-06. Ese día aparecen 20 diputados de 2006-2010, y pasa lo mismo el 1998-05-08 y el 2014-06-05. Por esa misma sesión, Merino y Echandi figuran con escaño en 2010-2014 (#16, #20).
- #13 y #17: Avendaño en 2014-2018 y Merino en 2002-2006 reciben escaño por haberlo tenido antes y después.

Qué lo evitaría:
- No contar como escaño una legislatura con actividad de un solo día al comienzo cuando la persona tiene actividad en la anterior, o corregir la fecha de esas sesiones.
- Desactivar en Costa Rica la regla «antes y después». Allí los diputados no pueden ser reelegidos de forma sucesiva (art. 107 de la Constitución, http://costa-rica.justia.com/nacionales/constitucion-de-costa-rica/titulo-ix/capitulo-i/): tener escaño antes y después es lo normal y no indica escaño en medio.

### 4. «don + nombre de pila» se atribuye al miembro con ese nombre (#3)

«Don Rodolfo, ¿cómo es posible que su Cartera…?» se resuelve como el diputado Rodolfo Delgado Valverde. Es el ministro de Transportes Rodolfo Méndez Mata, nombrado completo al principio de la misma intervención.

Qué lo evitaría:
- Antes de resolver un nombre de pila solo, buscar ese nombre con apellido en la misma intervención o sesión, y usarlo.
- Atribuir un nombre de pila suelto a un miembro solo si es vocativo y ese miembro habla en la sesión.

### 5. Formas de cargo sobre texto que no es una persona (#22, #23)

«Reforma Fiscal Estructural» es el título de una ley, con «fiscal» como adjetivo. «C.G.S.S.R.SR. CONCEPTO MONTO» es una abreviatura dentro de una sigla, en una tabla del presupuesto.

Qué lo evitaría:
- No admitir la forma «Fiscal» con mayúscula detrás de otra palabra con mayúscula («Pacto Fiscal», «Reforma Fiscal»), y añadir «estructural» a `noPersona`.
- No admitir una abreviatura pegada a una sigla con puntos (precedida de punto y letra).
- Descartar los tramos de tabla: separadores «//», importes y palabras en mayúsculas que no son de ningún nombre («CONCEPTO», «MONTO»).

### 6. Apellido suelto de persona externa con otro nombre de pila delante, y segundo apellido como clave (#43, #45)

«Calixto Chaves», un empresario, se atribuye al presidente Rodrigo Chaves. «Marta Esquivel», expresidenta de la CCSS, se atribuye a la procuradora Ana Lorena Brenes Esquivel.

Causa: la palabra con mayúscula de delante solo bloquea si es el nombre de pila de al menos dos oradores (`esPila`), y «Calixto» y «Marta» no lo son. Además, en una clave de varias palabras el apellido suelto es la última, en este caso «esquivel», el segundo apellido. En castellano se cita a la persona por el primero, «Brenes».

Qué lo evitaría:
- Bloquear cuando delante va un nombre de pila que no es de esa persona, según una lista general de nombres y no solo la de oradores.
- En las claves de tres o cuatro palabras, tomar como apellido de referencia el primer apellido, como ya hace `refDe`.

### 7. El sumario del acta dentro de una intervención, y «ad hoc» como nombre (#46; también #31, #33)

«LA PRESIDENTA AD HOC CLARA SILVIA ZOMER REZLER: 39» crea la persona externa «ad hoc clara silvia zomer rezler». Desde ella, «Rezler» suelto (17 menciones en el corpus) va a esa persona, aunque Clara Zomer era diputada en 2006-2010. La #6 es correcta, pero tampoco es discurso: es una línea del sumario.

Qué lo evitaría:
- Saltar los tramos con el patrón del sumario: nombres en mayúsculas seguidos de «: número de página», varias veces seguidas.
- Quitar «ad hoc», «a. i.» o «en ejercicio» detrás del cargo, como ya se hace con «federal» y «nacional».

### 8. Nombre de institución con «Don» (#34)

«Asociación Oratorio Salesiano Don Bosco» se atribuye al exdiputado Juan Bosco Acevedo Hurtado. El detector toma «Bosco» por su primer apellido porque no reconoce el nombre compuesto «Juan Bosco».

Qué lo evitaría:
- Añadir «oratorio», «salesiano», «asociación» y «obra» a las palabras de institución que anulan la mención.
- Reconocer los nombres de pila compuestos (Juan Bosco, Gerardo Fabricio) al separar nombre y apellidos.

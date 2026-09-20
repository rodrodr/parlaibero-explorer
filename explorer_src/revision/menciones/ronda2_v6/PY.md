# Menciones en Paraguay (PY): precisión de la versión 6

Muestra: `node muestra_precision6.cjs paises/PY 8 23` sobre `paises/PY/menciones6.json`. Salen hasta 8 menciones por categoría con semilla fija, 48 en total; la categoría «externa, antiguo orador sin escaño» está vacía. Cada mención se juzgó con la intervención completa, los turnos vecinos de la sesión y `oradores.json`, y con una fuente, citada en el motivo, cuando había que saber quién ocupaba un cargo. El veredicto, el motivo y el campo `no_deberia_contar` de cada mención están en `revision6/PY.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 974 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 57 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, cargo sin nombre (por fecha) | 20 | 8 | 7 | 1 | 0 | 88 % |
| Externa, con cargo o título | 547 | 8 | 4 | 4 | 0 | 50 % |
| Externa, antiguo orador sin escaño | 0 | — | — | — | — | sin casos |
| Externa, apellido suelto | 173 | 8 | 8 | 0 | 0 | 100 % |
| Externa, cargo sin nombre (por fecha) | 51 | 8 | 8 | 0 | 0 | 100 % |
| **Total** | 1.822 | 48 | 43 | 5 | 0 | **90 %** |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- Con 8 casos por categoría el margen es amplio: un 8 de 8 es compatible con una precisión real desde el 68 % (intervalo de Wilson al 95 %), y el total, 43 de 48, va del 78 % al 95 %.
- El total da el mismo peso a cada categoría. Ponderada por su tamaño en el país, la precisión estimada baja al 85 %, porque la categoría más floja («externa, con cargo o título», 50 %) tiene 547 menciones.
- La primera revisión (versión 5, otra muestra y otras categorías) dio un 69 %. Ya no hay «externas, antiguo miembro»: «Capitán Meza» y «Capitán Báez» ya no van a diputados de 2023-2028, aunque siguen siendo personas externas (apartado 1). Siguen en pie el nodo mal unido de Matiauda y los lugares con grado o cargo delante.
- Las 5 menciones «a la Presidencia» no entran en el muestreo.

## Menciones que no deberían contar

14 de las 48 menciones no deberían contar, estén bien o mal resueltas; 12 de ellas tienen la identidad bien:

- **Lecturas de la Secretaría (12: n.º 6, 8, 10, 11, 14, 15, 16, 21, 27, 29, 30 y 31).** El «SECRETARIO (Administrativo)» lee el orden del día (autores de cada proyecto), resoluciones (miembros de una comisión) y proyectos de ley. Son turnos sin orador (`fuente` nula) y no son menciones del debate. En todo el país son 467 de las 1.827 menciones resueltas o externas (26 %).
  **Regla:** tratar como turnos de la Mesa los rotulados «SECRETARIO/SECRETARIA» y, en general, los que no tienen `id_dep`, igual que los de la Presidencia. Si se quieren conservar, marcarlos para que la pestaña no los cuente como menciones de nadie.
- **Texto normativo (3: n.º 20, 21 y 23).** «El interventor será designado por el Presidente de la República […] su remoción podrá hacerla directamente el Presidente de la República» es la redacción de un artículo: nombra el cargo, no a González Macchi.
  **Regla:** no atribuir el cargo sin nombre dentro de un texto citado tras «diría lo siguiente» o «quedará redactado», en la lectura de un proyecto, ni cuando lo rige un participio o un verbo normativo («designado por», «podrá», «deberá»).

## Errores que quedan, por causa

Hay 5 errores en la muestra. Cada uno se cuenta en un solo apartado. Los casos «fuera de la muestra» se leyeron en `menciones6.json` para ver el alcance de cada causa, pero no cuentan en la tabla.

### 1. Lugares e instituciones con un grado o un cargo delante (2 errores: n.º 30 y 31)

- **n.º 30, «CLUB “GENERAL GENES”».** Es un club de fútbol de Villa Morra. La primera revisión lo encontró atribuido al diputado Luis Becker Genes; ahora es la persona externa «genes». `INSTITUCION_ANTES` no reconoce «CLUB» en mayúsculas (la expresión solo alterna la caja de la primera letra) ni admite las comillas entre «club» y el nombre.
- **n.º 31, «DEPARTAMENTO DE / PRESIDENTE HAYES».** Es un departamento. La regla nueva del grado (o «presidente») tras preposición exige espacios o tabuladores (`[ \t]+$`), y aquí hay un salto de línea. Tampoco está «departamento» entre los sustantivos de lugar. El nodo «hayes alto paraguay» reúne 9 menciones: «Presidente Hayes y Alto Paraguay», «PRESIDENTE HAYES» en títulos de proyectos, «Pte. Hayes» y también el «laudo Hayes», que sí es el presidente Rutherford Hayes.
- **Fuera de la muestra, la misma causa:**
  - «Coronel Oviedo», la ciudad, va 4 veces al diputado César Ariel Oviedo Verdún en 2020: tras una coma («Río Tebicuarymí, Coronel Oviedo, Villarrica»), tras «a» y en guaraní («che añe’eta Coronel Oviedo rerape»). Otras 8 veces genera personas externas («oviedo», «oviedope», «oviedo pe», «oviedoguape»).
  - «Coronel Martínez», el distrito, va 2 veces a Atilio Martínez Casado en 1994 («de que Coronel Martínez, que es el distrito…»).
  - «Capitán Meza» y «Capitán Bado», en listas de localidades de 1994, son ahora las personas externas «meza» y «bado».
  - «jurisdicción del Dr. Cecilio Báez, Departamento de Caaguazú» (un distrito) crea el nodo «cecilio baez», y a él se une «el Capitán Báez quién llegó a la cabeza de su batallón», otra persona (1989).

**Regla.**
- En `INSTITUCION_ANTES`, comparar el sustantivo sin distinguir mayúsculas y admitir comillas entre él y la forma. Añadir «departamento», «compañía» y «colonia».
- En la regla del grado ante un lugar, admitir cualquier espacio (`\s+`) y, además de las preposiciones, la coma de una enumeración y «a/al». Mejor aún: un grado con mayúscula que no lleva delante artículo («el/del/al Capitán X») ni tratamiento («señor General X») es un lugar.
- Añadir a PY una lista de topónimos compuestos, tomada de la lista oficial de distritos: Presidente Hayes, Coronel Oviedo, Coronel Martínez, Capitán Meza, Capitán Bado, Dr. Cecilio Báez, Mariscal Estigarribia… Cortar los sufijos guaraníes (-pe, -gua, -guápe) antes de comparar.

### 2. Una palabra que no es un nombre tras un cargo (1 error: n.º 25)

«Presidente Alternos: Don Carlos Dupré (de Chile) y Don Juan A. Singer»: «Alternos» es parte del nombre del cargo en el Parlatino y se convierte en la persona «alternos».

Fuera de la muestra, las erratas de OCR de «Presidente» dan 11 personas externas: «Señor Pre-» (con guion de fin de línea), «señor Pres¡dente» y «señor Preszdente», que dan «pre», «pres» y «preszdente». «pres» llega a ser incluso clave de apellido suelto (`apellidosExternos`).

**Regla.**
- Una clave de una sola palabra debe ser un nombre o un apellido conocido: en `oradores.json`, en `nombres_pila.json` o como apellido de otra clave con nombre de pila. Si no lo es, se descarta.
- Añadir a `noPersona` los plurales y adjetivos de cargo («alterno», «alternos», «adjuntos», «titulares», «suplentes»).
- Tomar por forma una palabra a distancia de edición 2 o menos de «presidente» una vez quitados los signos de OCR (¡, 1, 5, &), y descartar las palabras del nombre que acaban en guion de fin de línea.

### 3. Un nodo que junta dos nombres (1 error: n.º 32)

Es el mismo error que en la primera revisión y sigue sin corregir. «Capitán Vicente A. Matiauda y Antibia Matiauda», de la ley de 1989 que cambia nombres de distritos, da la clave «vicente a matiauda antibia matiauda». Esa clave se vuelve la canónica de «vicente a matiauda» y de «matiauda»: 31 menciones, casi todas del prócer, bajo el nombre de dos personas y mezcladas con los topónimos. «Capitán Vicente Matiauda» queda aparte, con 5 menciones.

Hay dos causas:
- El corte en «y» exige que siga un nombre de pila conocido (`esPila`), y «Antibia» no lo es.
- La unión de claves junta la corta con la larga porque es su principio.

**Regla.**
- Cortar en «y/e» cuando lo que sigue son palabras con mayúscula que terminan en el mismo apellido («… Matiauda y Antibia Matiauda»).
- No elegir como canónica una clave que contiene una «y» cortada.
- Unir «vicente matiauda» con «vicente a matiauda» sin tener en cuenta las iniciales.

### 4. Un cargo sin nombre en una hipótesis (1 error: n.º 18)

Waldemar Zárate Schulz, del PLRA, anuncia una sorpresa para el 13 de agosto de 2000, la elección vicepresidencial que ganó el liberal Julio César Franco. Luego dice «aunque sea mi correligionario el Presidente de la República, no le quiero dar la potestad completa»: habla de un presidente liberal hipotético, no de González Macchi. La exclusión solo mira una lista de adjetivos pegados al cargo («ex», «futuro», «próximo», «entonces»…).

**Regla:** no atribuir el cargo cuando en la misma cláusula, justo antes, hay un subjuntivo o un condicional de «ser» («aunque sea», «si fuera», «cuando sea», «quien sea»), o cuando el cargo va con artículo indefinido o con «cualquier».

### Otros errores vistos fuera de la muestra (no cuentan en la tabla)

- **Grado militar y apellido de un miembro con escaño ese día.** La versión 6 lo acepta a propósito, pero falla con las figuras históricas:
  - «General Escobar», de la revolución de 1873, va 2 veces a Oscar Escobar Pedotti (2009).
  - «el General Oviedo preso», Lino Oviedo, va a César Ariel Oviedo Verdún (2009).
  - «Capitán Ruíz Díaz», el militar herido en el atentado contra el general Ramón Rosa Rodríguez, va 3 veces al diputado César Pelagio Ruiz Díaz (1994).

  **Regla:** con un grado, resolver a un miembro solo si habla o preside en esa sesión, o si se le habla. Si no, que sea persona externa.
- **Antiguo miembro homónimo de una figura histórica.** «Don José Félix Estigarribia, General Presidente» y «el futuro Mariscal de la victoria, José Félix Estigarribia» van 3 veces (2009) al exdiputado José Félix Fernández Estigarribia (1989-1993), como antiguo miembro. El nombre lo alcanza con fuerza 2, por la regla del segundo apellido tras uno muy común (Fernández).
  **Regla:** para marcar a alguien como antiguo miembro, exigir fuerza 3; y añadir a `historicos` de PY a José Félix Estigarribia y a Lino Oviedo.
- **Jefe de Estado extranjero con el apellido de un miembro.** «Presidente Chávez», «dictador Chávez» y «señor Chávez», que son Hugo Chávez, van 4 veces (2009) a José Gregorio López Chávez, por la misma regla del segundo apellido.
  **Regla:** aplicar esa regla solo con una forma de miembro («diputado») o si el miembro está en la sesión. Con «presidente» o «dictador» y un apellido de alguien que no preside, la mención es de una persona externa.
- **Apellido suelto de un miembro en una enumeración ajena.** En «el Monseñor Gogorza, Silvero o Adalberto Martínez», Silvero es un obispo, pero se atribuye a Oscar Silvero Álvarez.
  **Regla:** en una enumeración que abre un título externo («Monseñor»), los apellidos sueltos que siguen lo heredan.
- **Votaciones nominales.** 28 menciones resueltas, y 82 sin resolver, salen de listas de votación o de asistencia. El filtro mira el texto que sigue al nombre, pero el voto, con mayúscula, queda dentro del nombre capturado («DIPUTADO LUIS VERA VELAZQUEZ Ausente», 1994). Tampoco reconoce «Sí» ni «No» en castellano: solo «sim» y «não».
  **Regla:** cortar el nombre en las palabras de voto (ausente, presente, sí, no, votó, abstención) antes de resolverlo, y descartar la mención.

## Nodos partidos (no son errores de identidad)

- **González Macchi.** Tiene el nodo de miembro PY100244: 9 menciones como diputado en 1993-1997 y 20 como «Presidente de la República» en 1999-2003. Tiene además el nodo externo «luis gonzalez macchi»: 1 mención con cargo y 3 apellidos sueltos, entre ellos el n.º 38. Solo la vía del cargo sin nombre mira `tuvoEscano`. La rama de jefes de Estado de `clasificar` y el apellido suelto del jefe crean la persona externa sin mirarlo.
  **Regla:** en esas dos vías, resolver el nombre del jefe y, si tuvo escaño en la biblioteca, usar su nodo de miembro (antiguo).
- **«gregoria vda» y «gregoria mendez vda» (n.º 28 y 29).** Son la misma pensionista. «Vda.» corta el nombre, porque la expresión solo admite un punto tras una inicial.
  **Regla:** admitir «Vda.» y «viuda de» dentro del nombre, como partículas.
- **Matiauda.** «vicente matiauda» queda aparte del nodo mal unido (apartado 3).

## Menores

- **Marca «se dirige» en enumeraciones.** Sale en los n.º 6 y 8 («…, Diputado Gustavo Mussi, Líder de Bancada UNACE…»).
- **«Justo Pastor Cárdenas» (n.º 8) acierta de rebote.** «Pastor» se corta como forma, y el nombre de pila «Justo» se resuelve por la sesión.
  **Regla:** añadir «pastor» a `NOMBRE_O_FORMA`, para no cortar un nombre compuesto.
- **Datos.** El turno de «SEÑOR DIPUTADO OSCAR LUIS TUMA GONZALEZ» (n.º 45) no tiene `id_dep` en la biblioteca.

# Colombia (CO), Cámara de Representantes: precisión de las menciones, versión 6.2

Muestra de `node muestra_precision7.cjs paises/CO 8 31`: ocho menciones por categoría, 40 en total. Dos categorías están vacías en la salida:

- miembro por cargo sin nombre: los jefes de Estado van siempre a su nodo externo y Colombia no tiene otro cargo que se atribuya por fecha a un miembro;
- persona externa que fue orador sin escaño en la biblioteca: las 25 sesiones cubren las siete legislaturas de 1998 a 2026.

Cada mención se revisó con su intervención completa en `biblioteca.json`, las intervenciones vecinas, la cabecera de la gaceta y `oradores.json`. Las fuentes externas consultadas se citan en `CO.json`.

## Precisión

Precisión = correctas / (correctas + incorrectas), con las dudosas aparte.

| Categoría | Menciones en la salida | Correctas | Incorrectas | Dudosas | Precisión | No deberían contar |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 2.585 | 6 | 1 | 1 | 86 % | 3 |
| Miembro, apellido suelto | 636 | 8 | 0 | 0 | 100 % | 8 |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | — |
| Externa, con cargo o título | 810 | 7 | 1 | 0 | 88 % | 2 |
| Externa, antiguo orador sin escaño | 0 | — | — | — | — | — |
| Externa, apellido suelto | 81 | 5 | 3 | 0 | 63 % | 4 |
| Externa, cargo sin nombre (por fecha) | 65 | 7 | 1 | 0 | 88 % | 1 |
| **Total de la muestra** | | **33** | **6** | **1** | **85 %** | **18** |

- Con ocho casos por categoría el margen es amplio (intervalo de Wilson al 95 %): 8/8 es compatible con un 68-100 %, 7/8 con un 53-98 %, 6/7 con un 49-97 % y 5/8 con un 31-86 %. El total, 33/39, con un 70-93 %.
- Ponderada por el número de menciones de cada categoría, la precisión estimada es del 88 %. Pesan los miembros con tratamiento (2.585), con un error en siete.
- La dudosa (n.º 6) apenas mueve el total: como incorrecta, 33/40 (83 %); como correcta, 34/40 (85 %).
- Tres de los seis errores salen de una misma fila: la resolución de la orden de la democracia Simón Bolívar (n.º 26, 27 y 32).
- La revisión de la versión 6, con otra muestra, daba 43/48 (90 %) y un 95 % ponderado; la diferencia cae dentro del margen. «El Presidente de la República» ya no va al nodo de miembro de Petro, aunque quedan casos sueltos con su nombre (véase «Otras observaciones»). Siguen la condecoración de Simón Bolívar (causa 1) y los usos normativos del cargo (causa 3, fuera de esta muestra).
- Que la identidad sea correcta no quiere decir que la mención deba contar. 14 de las 33 correctas, y la dudosa, salen de turnos de la Mesa, votaciones, rótulos o del orden del día; entre ellas, las ocho de miembros por apellido suelto. Es el problema mayor de Colombia en esta versión (véase «Menciones que no deberían contar»).

## Errores que quedan, por causa

### 1. Nombres de condecoraciones tomados por personas (3 errores: n.º 26, 27 y 32)

- En la sesión de 2024-12-03 el jefe de protocolo lee la resolución que confiere la «orden de la democracia Simón Bolívar» a la Fundación Ancla. Cada vez que aparece el nombre de la orden se cuenta una mención de Simón Bolívar:
  - «la condecoración orden de la democracia Simón Bolívar, instituida como un homenaje al libertador» (n.º 26);
  - «Confiérase democracia Simón Bolívar a la fundación Ancla» (n.º 27);
  - «se confiere la orden de la democracia Simón Bolívar en el grado cruz comendador» (n.º 32).
- Magnitud: 8 de las 9 menciones de «Simón Bolívar» por apellido suelto de toda la salida son la condecoración, el 10 % de las 81 de la categoría. La novena («el discurso que pronunciara Simón Bolívar») sí es él.
- Fuera de la muestra, «salió el doctor Bolívar a decir en los medios» (2024-09-18) también va a Simón Bolívar. Es Gustavo Bolívar, director de Prosperidad Social, que ese mes habló en los medios del pago del pilar solidario (https://www.infobae.com/colombia/2024/09/03/gustavo-bolivar-respondio-a-la-alerta-de-norma-hurtado-por-pago-para-adultos-mayores-el-presupuesto-esta-asegurado-para-2025/).
- Causa: «condecoración» y «medalla» están en `INST_LUGAR`, pero `INSTITUCION_ANTES`, `INST_LARGO` e `INST_SUELTO` solo admiten palabras con mayúscula entre la institución y el nombre, y «orden» (`INST_PEGADO`) solo cuenta con mayúscula inicial. Por eso «Consejo de la Orden de la Democracia Simón Bolívar» se descarta, pero «orden de la democracia», en minúscula, no lo detiene ninguna. La revisión anterior ya lo señalaba.
- Reglas que lo evitarían:
  - tras «orden», «condecoración», «medalla», «premio» o «gran maestre/maestro», admitir hasta tres palabras en minúscula antes del nombre, y «orden» también en minúscula;
  - una lista por país de nombres de condecoraciones y obras con nombre de persona («orden de la democracia Simón Bolívar», «democracia Simón Bolívar») que no cuentan como mención;
  - no dar a una figura histórica de la lista del país una mención con tratamiento de persona viva («doctor Bolívar»).

### 2. Nombres mal separados en la transcripción (2 errores: n.º 5 y 21)

- Apellido en minúscula (n.º 5).
  - En el acta de 2006-12-05 muchos apellidos van en minúscula («Borja díaz», «castro Caicedo», «Fernando tamayo tamayo»). «el doctor Alvaro uribe Vélez, ponente» de la Ley 100 se corta en «doctor Alvaro» y el desempate por quien interviene en la sesión elige a Álvaro Morón.
  - Es Álvaro Uribe Vélez, senador ponente de la Ley 100 de 1993 y presidente de la República en 2006, que debió ir a su nodo externo. En la misma sesión, «el Presidente Alvaro uribe» (fuera de la muestra) también va a Álvaro Morón. Son los dos únicos casos de la salida.
- Palabras pegadas (n.º 21).
  - «el doctor Germán CarlosamaLópez» es Germán Bernardo Carlosama López, representante de AICO en 2014-2018 (732 intervenciones), postulado a la Segunda Vicepresidencia por su compañero de bancada. Como «carlosamalopez» no casa con ningún orador, sale una persona externa.
  - En la salida hay seis menciones con palabras pegadas o con mayúsculas mezcladas. Cuatro son de representantes con escaño convertidos en externos: además de Carlosama, «doctor ÓscarOspina» (Óscar Ospina Quintero, 2017), «H. R. JoRGe RoZo» y «H. R. RoY L. BARReRAS» (2006).
- Reglas que lo evitarían:
  - alargar el nombre con las palabras en minúscula que siguen cuando son apellidos de la lista de oradores o claves de jefes de Estado («Alvaro uribe Vélez»);
  - no desempatar por sesión cuando la palabra siguiente es un apellido que el candidato no tiene;
  - partir una palabra en el paso de minúscula a mayúscula cuando las dos partes son palabras de nombres de oradores («CarlosamaLópez» → «Carlosama López»);
  - pasar a minúscula las palabras con mayúsculas mezcladas («JoRGe RoZo») antes de buscarlas.

### 3. Cargo sin nombre referido a otra época o en abstracto (1 error: n.º 36)

- Carlos Andrés Amaya (2011-05-11) cuenta el caso de la clínica de Sogamoso. Empieza con «el señor Presidente de la República de Colombia, en su momento el doctor Álvaro Uribe Vélez en octubre de 2007» y sigue con «a raíz de la intervención del Presidente de la República». Esta segunda mención se atribuye a Santos, presidente el día de la sesión.
- Fuera de la muestra hay al menos cuatro más del mismo tipo, en una categoría de 65 menciones:
  - «porque se excedieron las facultades que se le otorgaron al Presidente de la República», sobre el Decreto 4488 de 2009 (2011-05-11). Va a Santos, pero era Uribe;
  - «que delegue para ello el Presidente de la República», dos veces, en el parágrafo de la ley de inteligencia que lee el ponente (2011-05-11). Van a Santos. Ya estaban en la revisión anterior;
  - «el gobernador o el alcalde o el Presidente de la República, designe a un gerente interinamente», en un parágrafo (2006-12-05). Va a Uribe.
- Reglas que lo evitarían:
  - no atribuir por fecha si en los 300 caracteres anteriores aparece un año anterior al comienzo del mandato del titular («octubre de 2007», «Decreto 4488 de 2009») o un antecesor nombrado con «en su momento», «el entonces» o «el gobierno pasado». En ese caso, atribuir la mención al antecesor nombrado o dejarla sin resolver;
  - no atribuirla en una enumeración de cargos unidos por «o» («el gobernador o el alcalde o el Presidente»), con verbo de norma en subjuntivo («que delegue», «designe») o tras «parágrafo», «artículo» o «quedando así».

### Dudosa: un posible lapsus (n.º 6)

- El Secretario avisa de un impedimento en el proyecto 219 de 2018: «acaba de llegar doctor Aguilera, doctor Aquileo llego otro impedimento del doctor David Enrique Pulido, doctor Enrique, Presidente llego un impedimento de David Ernesto Pulido».
- Aquileo Medina es el ponente del proyecto. «Aguilera» parece un lapsus corregido en el acto, como «Enrique» por «Ernesto» en la misma frase. La mención va a Modesto Aguilera, que no tiene que ver con ese proyecto, pero no se puede descartar que el Secretario se dirija también a él.
- En cualquier caso es un turno de la Secretaría y no debería contar.

## Menciones que no deberían contar (identidad correcta)

La versión 6.2 quiere dejar fuera de la salida los turnos de la Mesa, pero en Colombia no alcanza a la Secretaría General ni a buena parte de los presidentes de sesión. En conjunto, las filas de la Secretaría General, de presidentes con solo su nombre, del orden del día y del jefe de protocolo suman 1.938 menciones, el 43,5 % de las 4.458 de la salida.

### 1. Turnos de la Secretaría General (n.º 6, 9, 10, 11, 13, 14, 15, 16, 18, 28 y 39)

- Son 11 de las 40 menciones de la muestra, entre ellas siete de las ocho de miembros por apellido suelto: votaciones nominales, llamadas a lista, firmas y lecturas de proposiciones, del orden del día o de impedimentos.
- Causa: la etiqueta es «Secretaría General, Nombre», con tilde. `esPresidenciaEtiqueta` busca `secretari[oa]` o `secret[aá]ri[oa]`, y ninguna casa con «Secretaría», con la «í» acentuada. «Subsecretaría General, …» sí casa (`subsecretar[ií]a`), y sus turnos ya están fuera de la salida.
- Magnitud: 1.006 menciones (el 22,6 % de la salida) salen de filas «Secretaría General, …».
- Regla: aplicar las expresiones de la Mesa a la etiqueta plegada (sin tildes y en minúscula), o añadir `secretar[ií]a`. Es el cambio de más efecto de esta revisión.

### 2. Turnos de quien preside con solo su nombre (n.º 12)

- Jaime Raúl Salamanca dirige la sesión de 2024-12-03 (la cabecera dice «Dirección de Presidencia, Jaime Raúl Salamanca Torres»), y sus 343 turnos llevan solo su nombre: «Peñuela tiene la palabra, Peñuela ya no […] desiste intervenir».
- Causa:
  - la regla de la versión 6.2 solo marca como de la Mesa los turnos con el nombre de quien tiene alguna fila «Presidencia, Nombre» en la sesión, y Salamanca no tiene ninguna;
  - la presidencia deducida por turnos cortos tampoco actúa, porque la sesión ya tiene filas de la Mesa (las de la Subsecretaría).
- Magnitud: trece sesiones traen en la cabecera el nombre de quien preside. En siete, sus turnos con solo el nombre siguen en la salida y dan 458 menciones (el 10,3 %); en cinco ya no dan ninguna y en la otra no los hay. Las gacetas anteriores a 2015 no traen esa cabecera y tienen más casos del mismo tipo: Carlos Germán Navas Talero da la palabra en 2011-05-11 y Carlos Alberto Zuluaga en 2011-05-31.
- Regla: tomar a quien preside de la cabecera de la gaceta («Dirección de Presidencia, X», «Presidencia de los honorables Representantes X») y marcar como de la Mesa sus turnos de esa sesión que lleven solo su nombre, salvo los largos.

### 3. El orden del día atribuido a un representante (n.º 23)

- El orden del día impreso en la gaceta de 2019-09-30 (20.861 caracteres con los autores, los ponentes y las gacetas de cada proyecto) está en una fila con la etiqueta «Óscar Hernán Sánchez León. Ponentes», un resto de «Autor: Representante Óscar Hernán Sánchez León. Ponentes: …». El 2022-08-10 pasa lo mismo con «Nicolás Albeiro Echeverry Alvarán. Ponentes».
- Magnitud: esas dos filas dan 444 menciones (el 10,0 %), todas como si las dijera un representante. En la red, Sánchez León y Echeverry «mencionan» a cientos de colegas.
- Regla: tratar como lectura de la Mesa la fila cuya etiqueta acaba en «. Ponentes», o cuyo texto repite «Autores:», «Ponentes:» y «Publicación … Gaceta del Congreso número», y descartar sus menciones.

### 4. Votaciones, rótulos, lecturas, automenciones y duplicados (n.º 1, 8, 9, 16, 26, 27, 28 y 32)

- Votaciones y llamadas a lista.
  - El filtro de votaciones no contempla «vota sí/no»: «Doctor Uscátegui vota sí.» (n.º 8), leída por un funcionario de la Secretaría cuya fila no lleva etiqueta de la Mesa.
  - En la llamada a lista solo mira la palabra que sigue al apellido: «Parrado Durán Gabriel Ernesto, presente» (n.º 16).
  - En toda la salida, 148 menciones van seguidas de «vota», «votó» o «presente» a cuatro palabras o menos.
- Rótulos de turno dentro del texto: «Palabras del honorable Representante Wilson Alfonso Borja díaz.» (n.º 1), por un error de segmentación del acta de 2006-12-05, que tiene tres casos.
- Lectura de una resolución por el jefe de protocolo (n.º 26, 27 y 32). Sus filas dan 30 menciones.
- Automención en un juramento: «Yo Jaime Luis Lacouture Peñaloza, … juro» (n.º 28). La fila no tiene id_dep y el descarte de automenciones no actúa.
- Duplicado: «Wills Ospina» y, dentro, «Ospina», los dos de Juan Carlos Wills (n.º 9). En toda la salida quedan 7 pares solapados; la revisión anterior contaba 25.
- Reglas:
  - añadir «vota sí/no» al filtro de votaciones y mirar hasta el final de la entrada («Apellido Apellido Nombre, presente»), también en el apellido suelto;
  - descartar la mención precedida de «Palabras del» o «Intervención del» cuando abre frase;
  - tratar como de la Mesa las etiquetas del personal de la Cámara («jefe de protocolo», «jefe de Relatoría»);
  - cuando la fila no tiene id_dep, usar el nombre de la etiqueta para descartar automenciones;
  - comprobar si la posición está ocupada con el tramo ya alargado, como proponía la revisión anterior.

## Otras observaciones (fuera de la muestra)

- **El desempate por «preside» sigue actuando fuera de la sesión.** Los 10 «representante López» de 2022-08-10 van a Julián David López Tenorio, que preside una sesión de 2025 de la biblioteca. Son de Luis Miguel López Aristizábal, que en esa sesión propone la subcomisión (CO007000700213). Regla: aplicar ese desempate solo a quien preside la misma sesión.
- **Petro todavía en dos nodos, en casos sueltos.** Desde agosto de 2022 sus menciones van a su nodo externo, salvo «el doctor Petro» de 2025-09-30, que va al de miembro como antiguo miembro: es un error con el criterio de la versión 6.2. Las 9 del 2022-07-21 («Presidente Gustavo Petro», presidente electo) van también al nodo de miembro, porque ese día aún no ocupa el cargo. Conviene decidir si el presidente electo va ya a su nodo externo.
- **«Cristo» como apellido.** El reparto de nombre y apellidos toma «Cristo», de «Franklin del Cristo», por apellido de Franklin del Cristo Lozano de la Ossa (n.º 14). En 2017 no hace daño, pero en 2018-2022 coincide con Jairo Humberto Cristo Correa, que sí se apellida Cristo. Regla: tratar «del Carmen», «del Cristo», «del Socorro» o «de Jesús» tras un nombre de pila como parte del nombre.
- **Claves externas de una palabra.** Hay 45 claves (72 menciones, el 7,5 % de las 956 externas) que no son palabra del nombre de ningún orador ni de otra clave. Muchas no son personas: «parlamentarios» (10), «vicefiscal» (4), «honoraria» (4), «parlamentaria» (3), «recolega», «consejeros», «viceministros», «contraloras», «forestal», «liberal»… Ninguna ha caído en la muestra. La regla de la revisión anterior (clave de una sola palabra solo si es apellido de algún orador o de una persona nombrada completa) sigue pendiente.
- **Menciones sin orador.** 1.280 menciones (el 29 %) salen de filas sin id_dep. No crean aristas en la red, pero cuentan como menciones recibidas.
- **Posiciones.** Las posiciones (`i`) de 49 menciones (el 1,1 %) no coinciden con el texto de `biblioteca.json`.

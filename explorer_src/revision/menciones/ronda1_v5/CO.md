# Colombia (CO), Cámara de Representantes: precisión de las menciones

Muestra de `node muestra_precision.cjs paises/CO 10 7`: diez menciones por categoría. En Colombia la categoría «miembro, cargo sin nombre (por fecha)» no tiene menciones, así que se juzgan 50. Cada mención se revisó con su intervención completa en `biblioteca.json`, las intervenciones vecinas de la sesión y `oradores.json`. El detalle está en `CO.json`.

## Precisión

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

| Categoría | Menciones en la salida | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 3.382 | 9 | 1 | 0 | 90 % |
| Miembro, apellido suelto | 1.831 | 6 | 4 | 0 | 60 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — |
| Externa, con cargo o título | 971 | 8 | 2 | 0 | 80 % |
| Externa, antiguo miembro | 25 | 0 | 10 | 0 | 0 % |
| Externa, apellido suelto | 89 | 8 | 2 | 0 | 80 % |
| **Total de la muestra** | | **31** | **19** | **0** | **62 %** |

- Con diez casos por categoría los márgenes son amplios: 9/10 es compatible con un 60-98 %, y el total, con un 48-74 % (intervalo de Wilson al 95 %).
- La muestra pesa igual todas las categorías. Si se pondera por el número de menciones de cada una, la precisión estimada sube al 79 %, porque las categorías peores son pequeñas. La excepción es el apellido suelto de miembros (1.831 menciones).
- El 60 % del apellido suelto de miembros exagera. El detector no busca el apellido sino el nombre de pila (patrón 1), y los seis aciertos se deben a que ese nombre va junto al apellido de la persona o en su propia fila.

## Patrones de error

### 1. El «apellido suelto» de los miembros es el nombre de pila (4 errores; afecta a toda la categoría)

- Errores:
  - n.º 15: «Juan Carlos Rivera» (Rivera Peña) se atribuye a Juan Carlos Lozada.
  - n.º 19: la fila «Sánchez Franco Juan Carlos» se atribuye a Juan Carlos Reinales.
  - n.º 13: el «Carlos» de «Zuluaga Díaz Carlos Alberto» se atribuye a Carlos Alberto Carreño.
  - n.º 16: el «Carlos» de «Quintero M. Carlos A.» (Carlos Arturo Quintero) se atribuye a Carreño.
- La misma palabra se atribuye a la vez a varios miembros. El «Carlos» de los n.º 13 y 20 va a Zuluaga y a Carreño.
- Magnitud en toda la salida: 1.823 de las 1.831 menciones de la categoría son un nombre de pila. Solo «Juan» suma 173 menciones a Lozada, 151 a Wills y 131 a Reinales, y 249 posiciones del texto se atribuyen a más de un miembro.
- Causa: en `detectar5.cjs` (línea 569) la forma buscada es `partes[0]` del nombre. En los nombres «NOMBRE APELLIDOS» sin coma, como los de Colombia, esa palabra es el nombre de pila, mientras que la clave (`apRef`) sí es el primer apellido.
- Contribuye la regla de «antes y después» (línea 205). Da escaño en 2010-2014 a Carreño y a Reinales, que no tienen registro en esa legislatura, así que el control de escaño no frena el error.
- Reglas que lo evitarían:
  - buscar la palabra del nombre que corresponde a `apRef(d)`, es decir, la que sigue a los nombres de pila;
  - rechazar como forma cualquier nombre de pila (`esPila`) o primera palabra de un miembro (`primeros`);
  - admitir una sola atribución por posición del texto;
  - limitar la regla de «antes y después» a legislaturas contiguas.

### 2. Miembros sin partido en `oradores.json` tratados como personas externas (6 errores)

- Casos:
  - n.º 32-33: Germán Bernardo Carlosama López, 2017.
  - n.º 36-37: Erika Tatiana Sánchez Pinto, 2022.
  - n.º 38: Dilia Estrada de Gómez, 2000. El índice de la gaceta la llama «honorable Representante».
  - n.º 40: Efrén Hernández, 2006. Preside la sesión como presidente provisional y figura en la asistencia.
- Todos tenían escaño en esa legislatura, pero su registro no tiene partido. Como `senta` (línea 200) exige partido en los países que lo tienen, salen como «externa, antiguo miembro».
- Magnitud: 17 de las 25 menciones de esa categoría son de personas con registro sin partido en la misma legislatura.
- Regla: dar por sentado a quien tiene intervenciones en esa legislatura aunque falte el partido, o al menos cuando la etiqueta del orador o el texto lo llaman «Representante». El partido debería descartar solo registros vacíos o de «identificado».

### 3. Exclusión permanente de los «externos por cargo» (4 errores)

- Juan Diego Gómez Jiménez fue representante en 2010-2014. En sesiones de 2022 se le llama «Senador».
- El conjunto `externos` (línea 192) lo excluye en todas las legislaturas (`senta`, línea 198). Por eso sus menciones de 2011 salen como externas (n.º 31, 34, 35, 39), incluida una carta que lo llama «Representante a la Cámara».
- Regla: que la exclusión dependa de la fecha. Debe aplicarse solo en las legislaturas en que se le nombra con el cargo externo, y nunca en una en la que tiene intervenciones con partido.

### 4. Nombre de pila solo, resuelto por un desempate débil (1 error)

- n.º 10: «¿doctor Miguel ya votó?» (2011) se resuelve como Miguel Ángel Pinto por el desempate «preside». Pinto presidió la sesión del 2017-07-20, de otra legislatura.
- En esta sesión Pinto no está en la asistencia ni en las votaciones. Sí votan Miguel Amín Escaf y Miguel Gómez Martínez.
- Reglas que lo evitarían:
  - no resolver un único token que es nombre de pila y no es apellido de ningún candidato; dejarlo ambiguo;
  - limitar «preside» a quien preside en la misma legislatura;
  - con vocativo, exigir que el candidato conste en la sesión (asistencia o votaciones).

### 5. Apellido suelto de personas externas que es el segundo apellido de otra (2 errores)

- Errores:
  - n.º 45: el senador «Luis Alfredo Ramos Botero» se atribuye a Enrique Gil Botero.
  - n.º 44: el representante «Edwin Gilberto Ballesteros Archila» se atribuye a «Presidencial Emilio Archila». La clave arrastra además «Presidencial».
- Causa, primera parte: el apellido suelto de una persona externa es el último token de su clave (línea 457: «botero», «penaloza», «camargo»). En los nombres con dos apellidos ese token es el materno.
- Causa, segunda parte: el control de la palabra anterior (línea 537) solo descarta la coincidencia en dos casos: si esa palabra y el apellido forman el nombre de un orador con fuerza ≥ 2, o si la palabra es un nombre de pila.
  - «Ramos Botero» es un senador que no está en la lista de oradores.
  - En «Ballesteros Archila» la fuerza es 1, porque al partir el nombre del representante «Gilberto» quedó como apellido (línea 56).
- Reglas que lo evitarían:
  - en los apellidos dobles, usar como apellido suelto el primero (Gil, Lacouture, Rodríguez);
  - descartar la coincidencia si la precede cualquier palabra con mayúscula que no sea del nombre de esa persona ni una forma de tratamiento o cargo;
  - añadir «presidencial» (y «consejero») a las palabras que no son personas.

### 6. Variante gráfica del apellido (1 error)

- n.º 25: «la ponente la doctora Olga Lucía Velázquez» es Olga Lucía Velásquez Nieto, representante 2014-2018. Sale como externa porque «Velázquez» no empareja con «Velásquez».
- Regla: comparar los nombres igualando s/z (y c ante e, i). Así casarían Velásquez/Velázquez y Lozada/Losada; el n.º 18 escribe «Losada».

### 7. El nombre absorbe el partido (1 error)

- n.º 30: «el compañero González de Cambio Radical» se convierte en la persona externa «gonzalez cambio radical». Es Hernando González, único González de Cambio Radical en 2022-2026.
- Reglas que lo evitarían:
  - cortar el nombre ante «de» + nombre de partido, añadiendo los partidos, o palabras como «cambio», «radical» o «partido», a las que no son personas;
  - usar el partido citado para desempatar.

## Otras observaciones (no cuentan como error)

- Muchas menciones correctas salen de fuentes que no son intervenciones:
  - tablas de votación y listas de votos manuales;
  - índices de la gaceta y órdenes del día leídos por la Secretaría.
- Algunas de esas listas se atribuyen a un orador por errores de segmentación: el índice de los n.º 4-5 queda a nombre de John Jairo Roldán. Aumentan los recuentos y la red de quién menciona a quién, aunque la persona esté bien identificada.
- La marca «se dirige» aparece en líneas que no son vocativos, como los ponentes del orden del día (n.º 2) o la lectura de protocolo (n.º 8).

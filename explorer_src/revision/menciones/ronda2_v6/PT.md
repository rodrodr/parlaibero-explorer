# Precisión de las menciones, versión 6: Portugal (Assembleia da República)

Muestra: `node muestra_precision6.cjs paises/PT 8 23`, con hasta 8 menciones por categoría y semilla 23. Revisé a mano las 47 menciones con la intervención completa, los turnos vecinos de la sesión (`biblioteca.json`) y la lista de oradores (`oradores.json`). El juicio de cada mención está en `PT.json`.

## Precisión

| Categoría | En la salida | Revisadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| miembro (con tratamiento o cargo) | 1353 | 8 | 7 | 1 | 0 | 88 % |
| miembro (apellido suelto) | 1 | 1 | 1 | 0 | 0 | 100 % |
| miembro (cargo sin nombre, por fecha) | 297 | 8 | 8 | 0 | 0 | 100 % |
| externa (con cargo o título) | 252 | 8 | 7 | 1 | 0 | 88 % |
| externa (antiguo orador sin escaño en la biblioteca) | 6 | 6 | 6 | 0 | 0 | 100 % |
| externa (apellido suelto) | 29 | 8 | 8 | 0 | 0 | 100 % |
| externa (cargo sin nombre, por fecha) | 101 | 8 | 7 | 1 | 0 | 88 % |
| **Total de la muestra** | 2039 | 47 | 44 | 3 | 0 | **94 %** |

- **Cálculo.** La precisión es correctas / (correctas + incorrectas). No hubo dudosas.
- **Estimación ponderada.** Ponderada por el tamaño de cada categoría en la salida, la estimación es del 90 %. Es más baja que el total de la muestra porque el único error entre los miembros con tratamiento pesa sobre 1353 menciones.
- **Margen.** Con 8 casos por categoría, una sola mención mueve la cifra 12,5 puntos.
- **Contraste con las etiquetas.** Hice un recuento automático para los miembros con tratamiento. De las 1356 menciones de miembro con tratamiento o cargo, 1055 llevan un nombre que coincide con la etiqueta de un orador de la misma legislatura («A Sr.ª Paula Santos (PCP)»). Solo 12 (1,1 %) se atribuyen a otra persona que la de la etiqueta. Revisé la lista de las 12 y las comento en la causa 1. En esta categoría, la precisión real parece bastante más alta que el 88 % de la muestra.
- **Criterio.** Juzgo la identidad: la persona y la clave. Tres menciones correctas, los n.º 18, 23 y 46, son de antiguos miembros que quedan como persona externa. Lo explico en «Nodos partidos». Si se contaran como error, el total sería 41/47 (87 %).
- **Menciones que no deberían contar.** Son 3 de las 47: los n.º 19, 31 y 43.
- **Frente a la primera revisión.**
  - La categoría «externa (antiguo miembro)» tenía entonces 9 errores de 10. Ahora las 6 externas de antiguos oradores están bien.
  - Los «Sr. Primeiro-Ministro» sin nombre antes se descartaban. Ahora se atribuyen por fecha: hay 297 como miembro y 101 como persona externa, y en la muestra salen 15 correctas de 16.

## Errores que quedan, por causa

### 1. Nombre parlamentario que no acaba en el último apellido (n.º 5)

- **El caso.** N.º 5 (2-4-2014): «Sr.ª Deputada Paula Santos» se atribuye a Paula Cristina Barros Teixeira Santos, del PS, con escaño en la X y la XI pero no en la XII. Es Paula Santos, del PCP (Paula Alexandra Sobral Guerreiro Santos Barbosa), que preguntó dos turnos antes con la etiqueta «A Sr.ª Paula Santos (PCP)».
- **Cómo se produce.**
  - Con `apellidoUltimo`, «Paula Santos» casa con fuerza 3 con la diputada del PS, cuyo último apellido es Santos. Con la del PCP, cuyo último apellido es Barbosa, solo casa con fuerza 1.
  - El bloque de `resolver()` para las formas de miembro solo mira a los candidatos con escaño y fuerza ≥ 2.
  - El bucle por niveles devuelve «otra legislatura» en el nivel 3 sin bajar al 1.
- **Alcance.** Las 12 discrepancias del contraste con las etiquetas son estas:
  - Paula Santos, 4 veces (2014, 2020 y 2023);
  - «Luís Fazenda» (2) y «Luís Pais de Sousa» (2) se atribuyen a CARLOS MANUEL LUIS, porque «fazenda» y «pais» están en `noPersona` y cortan el nombre en «Luís»;
  - «Jorge Costa» (2020), del BE, va a Jorge Lacão Costa por el desempate «preside»;
  - «João Ramos» (2014), «António Rodrigues» (1996) y «Marques Mendes» (1984) van a homónimos por «actividad», «preside» y «tuvo escaño».
  - La misma causa deja como persona externa a Luís Filipe Menezes (n.º 23; véase «Nodos partidos»).
- **Reglas.**
  - Léxico de nombres parlamentarios: sacar de las etiquetas de `biblioteca.json` (por ejemplo, «A Sr.ª Paula Santos (PCP)» con su `id_dep`) el nombre con que se trata a cada diputado en cada legislatura, y resolver primero con él. Las 12 discrepancias tienen la etiqueta correcta en la misma legislatura.
  - Con una forma de miembro, antes de aceptar a un candidato sin escaño, preferir a un diputado con escaño que casa con cualquier fuerza, también 1, y que interviene en la sesión.
  - No cortar el nombre en una palabra de `noPersona` que va entre palabras del nombre con mayúscula («Luís Fazenda», «Luís Pais de Sousa»).

### 2. Un cargo tomado por nombre (n.º 20)

- **El caso.** N.º 20 (27-9-2007): «Sr.ª Directora do CEJ» (Centro de Estudos Judiciários) da la persona «directora cej». Hay 4 menciones con esa clave, una de ellas escrita «Directora do Centro de Estudos Judiciários».
- **Fuera de la muestra.**
  - Pasa lo mismo con «Sr.ª Provedora de Justiça» («provedora», 2), «Sr. Director-Geral de Transportes Terrestres» («director»), «Sr. Coordenador» («coordenador»), «Sr. Administrador» (2) y «Sr. Vice-Primeiro-Ministro e Ministro da Defesa Nacional» («vice», 2).
  - Siguen los trozos de nombres de ministerio de la primera revisión: «emprego seguranca social» (6) y «tecnologia ensino superior» (3).
- **La fusión de claves lo agrava.** En portugués, una clave de una palabra se une a la única clave larga que empieza por ella. Así, «Sr. Comissário dos Transportes» (Neil Kinnock, 1996) acaba en la persona «comissario almunia».
- **Reglas.**
  - Añadir a las formas de cargo, o a `noPersona`: director, directora, diretor, diretora, coordenador, coordenadora, provedor, provedora, administrador, administradora, comissário, comissária, chefe, vice, bastonário, reitor y reitora.
  - Rechazar las claves externas que empiezan por una palabra de cargo, y no unir con una clave larga una clave de una palabra que es un cargo.
  - Rechazar los nombres formados solo por palabras de institución unidas por «e».

### 3. «Primeiro-Ministro» dentro del título de otro cargo (n.º 43)

- **El caso.** N.º 43 (11-9-1978, SUMÁRIO): «os Srs. Ministros dos Negócios Estrangeiros (Correia Gago) e Adjunto do Primeiro-Ministro (Costa Freitas)» da una mención de Nobre da Costa. Es parte del título del cargo de Costa Freitas.
- **Alcance.** Hay 3 menciones así en la salida, todas de esa sesión. Las otras dos son vocativos a Costa Freitas («Sr. Ministro Adjunto do Primeiro-Ministro, desejava…»).
- **Regla.** No atribuir por fecha cuando delante va «Adjunto», «Gabinete» o «Secretário de Estado …», y excluir las filas del SUMÁRIO (véase más abajo).

### Fuera de la muestra: cargos sin nombre atribuidos a otra persona

La muestra de cargos sin nombre salió casi limpia (15 correctas de 16), pero en la salida hay dos fallos sistemáticos.

- **Homónimo del primer ministro (1-7-2020).**
  - Los 10 «Primeiro-Ministro» de esa sesión van a ANTÓNIO JOSÉ LIMA COSTA, diputado del PSD.
  - António Costa no tiene escaño en la XIV, porque todas sus intervenciones son de Gobierno, y su homónimo sí, con fuerza 3.
  - Es la misma causa que el n.º 11 de Brasil y tiene la misma regla: poner en la tabla de mandatos el `id_dep` del titular.
- **«Então», «na altura» y años.**
  - La expresión de `cargosSinNombre` no lleva la bandera `u`, así que `\b` toma la «o» final de «então» por el artículo: «o então Primeiro-Ministro» casa como «o Primeiro-Ministro».
  - Además, la lista de marcas de pasado tiene «entonces», pero no «então».
  - En 1996, «o então Primeiro-Ministro» y «do então Primeiro-Ministro» van a Guterres, cuando el primer ministro de 1990 era Cavaco Silva. Pasa lo mismo con «a intervenção do Sr. Primeiro-Ministro … na altura» y con una cita del 22-9-1995.
  - En 1978, «do então Presidente da República general Spínola» va a Eanes.
  - En 2007, «Em 1998, recebe das mãos do Presidente da República…» va a Cavaco Silva, cuando en 1998 el presidente era Sampaio.
- **Reglas.**
  - Usar `(?<![\p{L}])` o la bandera `u` en esas expresiones.
  - Añadir «então», «na altura», «à data», «à época» y «antigo» a las marcas de pasado.
  - Si la oración trae un año anterior al de la sesión, atribuir el cargo a quien lo ocupaba ese año (`quienEnFecha`) o no atribuirlo.

## Nodos partidos (no cuentan en la precisión)

- **José Sócrates** (escaño en la V y la VI):
  - 149 menciones de 2006-2008 van a su nodo de miembro;
  - en 2009 y 2023, 5 van a la persona externa «jose socrates» (una es el n.º 18);
  - otras 2, de 1996 y 2008, van a la persona «primeiroministro socrates», que sale de la grafía «PrimeiroMinistro»; la de 1996 es de Guterres;
  - «José Sócrates» casa con él solo con fuerza 1, porque «Sócrates» se toma por nombre de pila. En la X se resuelve porque cuenta con escaño; fuera de ella queda sin resolver y pasa a persona externa.
- **António Costa** (escaño en la VI): en 2023, «Ministro António Costa» va a su nodo de miembro y los 7 «Primeiro-Ministro» de la misma sesión van a la persona externa «antonio costa» (n.º 46). En 2020, los 10 van a otro diputado (véase arriba).
- **Luís Filipe Menezes** (n.º 23): sus 3 menciones son de la persona externa «luis filipe menezes». Su nodo de miembro es LUIS FILIPE MENEZES LOPES, con escaño de la V a la VII.
- **Primeros ministros «con escaño».**
  - Los primeros ministros quedan marcados con escaño en la legislatura en que gobiernan, que en Portugal no ejercen. Sócrates en la X (60 de 80 intervenciones de Gobierno), Guterres en la VII (36 de 104) y Costa en la XIII (67 de 85) no llegan al 80 % que exige `senta()`.
  - El nodo es el mismo, pero la marca contradice la regla del país.
  - Regla: quien es primer ministro ese día según `jefesGobierno` no tiene escaño. Otra opción es contar como de Gobierno las continuaciones («O Orador») de un turno de Gobierno.
- **Regla general.** La misma que en el informe de Brasil: identificar al titular del cargo por su `id_dep` y resolver con el léxico de nombres parlamentarios de la causa 1.

Si se contaran como error los n.º 18, 23 y 46, la precisión total sería 41/47 (87 %).

## Menciones que no deberían contar

- **Lecturas de los secretarios de la Mesa (n.º 19 y 31).**
  - El n.º 19 es un mensaje del Conselho da Revolução y el n.º 31, el informe sobre la retoma y el cese de mandatos.
  - Los turnos etiquetados «O Sr. Secretário (…)», «A Sr.ª Secretária (…)» u «O Sr. Secretário da Mesa (…)» suman 121 menciones en la salida. La mayoría son listas de requerimientos («formulado pelo Sr. Deputado X») y pareceres.
  - Regla: tratar esos turnos como de la Mesa, igual que los de la Presidencia.
- **Resumen de la sesión (n.º 43).**
  - Es una fila del SUMÁRIO, el resumen editorial de la sesión, que figura con `dm_speech = 1`. Hay 2 menciones en filas así.
  - Regla: excluir las filas con la etiqueta «SUMÁRIO».

## Observaciones que no cuentan como error

- **N.º 11.** «Ao Presidente da República» se refiere al cargo en abstracto: los plazos para promulgar. Lo doy por correcto porque el titular era Mário Soares.
- **N.º 36.** No encontré fuentes sobre Eládio Alvarez. El texto lo presenta como el patrón de la Santix.
- **Posiciones.**
  - 86 de las 2.060 menciones con posición (4 %) tienen `i` y `largo` desplazados respecto del texto de `biblioteca.json`. En la muestra son los n.º 11, 25 y 36.
  - La causa es la misma que en Brasil: el texto se repara antes de buscar.

## Fuentes consultadas

- Luís Filipe Menezes (Luís Filipe Menezes Lopes, diputado elegido en 1987 y 1995): https://pt.wikipedia.org/wiki/Luís_Filipe_Menezes
- Miguel Cadilhe, ministro de Finanzas de 1985 a 1990: https://pt.wikipedia.org/wiki/Miguel_Cadilhe
- III Governo Constitucional (Nobre da Costa, Costa Freitas, Correia Gago): https://pt.wikipedia.org/wiki/III_Governo_Constitucional_de_Portugal
- Eládio Alvarez y la Santix en 1977: búsqueda web, sin resultados.
- En los demás casos bastaron el texto de la sesión, `oradores.json` y la tabla de mandatos de `formas_paises.cjs`.

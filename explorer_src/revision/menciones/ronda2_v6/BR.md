# Precisión de las menciones, versión 6: Brasil (Câmara dos Deputados)

Muestra: `node muestra_precision6.cjs paises/BR 8 23`, con hasta 8 menciones por categoría y semilla 23. Revisé a mano las 41 menciones con la intervención completa, los turnos vecinos de la sesión (`biblioteca.json`) y la lista de oradores (`oradores.json`). El juicio de cada mención está en `BR.json`.

## Precisión

| Categoría | En la salida | Revisadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| miembro (con tratamiento o cargo) | 696 | 8 | 8 | 0 | 0 | 100 % |
| miembro (apellido suelto) | 1 | 1 | 1 | 0 | 0 | 100 % |
| miembro (cargo sin nombre, por fecha) | 18 | 8 | 6 | 2 | 0 | 75 % |
| externa (con cargo o título) | 1032 | 8 | 7 | 1 | 0 | 88 % |
| externa (antiguo orador sin escaño en la biblioteca) | 0 | 0 | – | – | – | – |
| externa (apellido suelto) | 293 | 8 | 7 | 1 | 0 | 88 % |
| externa (cargo sin nombre, por fecha) | 8 | 8 | 8 | 0 | 0 | 100 % |
| **Total de la muestra** | 2048 | 41 | 37 | 4 | 0 | **90 %** |

- **Cálculo.** La precisión es correctas / (correctas + incorrectas). No hubo dudosas.
- **Estimación ponderada.** Ponderada por el tamaño de cada categoría en la salida, la estimación es del 92 %.
- **Margen.** Con 8 casos por categoría, una sola mención mueve la cifra 12,5 puntos.
- **Cargo sin nombre, completo.** Como la categoría es pequeña, revisé también las 26 menciones de la salida (18 de miembro y 8 externas). Hay 21 correctas y 5 incorrectas (81 %): las 4 de LULA DA FONTE y el n.º 12.
- **Criterio.** Juzgo la identidad: la persona y la clave. Dos menciones correctas, los n.º 31 y 32, van a un nodo distinto del que reciben otras menciones de la misma persona. Lo explico en «Nodos partidos». Si se contaran como error, el total sería 35/41 (85 %).
- **Menciones que no deberían contar.** Son 4 de las 41: los n.º 8, 18, 20 y 21.

## Errores que quedan, por causa

### 1. El cargo sin nombre se resuelve contra la lista de oradores y cae en un homónimo (n.º 11)

- **El caso.** N.º 11 (21-11-2023, habla General Girão): «nas mãos do Presidente da República — ele é o comandante supremo das Forças Armadas» se atribuye a LULA DA FONTE, diputado del PP-PE en la 57.ª. Es Lula.
- **Alcance.** Las 4 menciones de «Presidente da República» de 2023 van a LULA DA FONTE, y son todas las que tiene ese diputado en la salida. En la misma sesión, «Presidente Lula» (25 menciones) y el apellido suelto «Lula» (41) sí van a la persona externa «lula».
- **Cómo se produce.**
  - En el bucle de `cargosSinNombre`, `resolver()` recibe los tokens del nombre de la tabla de mandatos, que es solo «Lula».
  - El único candidato es Lula da Fonte, que casa con fuerza 1 (su nombre de pila) y tiene escaño ese día. Se acepta sin mirar la fuerza.
  - Con nombre, «Presidente Lula» pasa por `jefeDe()` y nunca llega a la lista de oradores.
- **Reglas.**
  - En los cargos sin nombre, aceptar un miembro solo si es el propio mandatario. Lo más sencillo es dar a cada mandato de la tabla el `id_dep` de su titular cuando es orador del corpus (Temer, BR73552; Bolsonaro, BR74847). Si no lo es, crear siempre la persona externa con la clave canónica, como hace la vía con nombre.
  - Mientras tanto, exigir fuerza ≥ 2 en ese `resolver()`.
  - Poner en la tabla el nombre completo del mandatario («Luiz Inácio Lula da Silva», con «lula» como alias) y no solo el apodo.

### 2. El cargo sin nombre designa a un titular anterior (n.º 12)

- **El caso.** N.º 12 (11-4-2018, habla Paulo Teixeira): «porque estão prendendo sem provas o Presidente da República que tirou 40 milhões de pessoas da fome» se atribuye a Michel Temer, titular ese día. Es Lula, preso el 7-4-2018.
- **Alcance.** Es el único caso entre las 26 menciones de cargo sin nombre de la salida.
- **Regla.** No atribuir por fecha cuando el cargo lleva detrás una relativa en pretérito perfecto sobre su mandato («que tirou…», «que governou…», «que fez…») o delante «ex-», «então» o «antigo». En esos casos, dejar la mención sin atribuir.

### 3. Dos personas unidas por «e» en una sola clave (n.º 23)

- **El caso.** N.º 23 (2015): «o Prefeito e o Vice-Prefeito de Ijuí, Ballin e Ubirajara Teixeira» da la persona «ballin ubirajara teixeira».
- **Fuera de la muestra.** «Raul Gil e Netinho» da la persona «raul gil netinho» (2003). «Ministro da Agricultura, Pecuária e Abastecimento» da la persona «pecuaria abastecimento» (2 menciones, 2004).
- **Cómo se produce.**
  - El nombre solo se corta en «e» si la palabra siguiente es un nombre de pila (`esPila`), y «Ubirajara» o «Netinho» no lo son.
  - El corte de reserva de `procesar()` (`M.indexOf('e')`) no actúa nunca: «e» está en `PARTICULAS` y `sinParticulas()` ya lo ha quitado.
- **Reglas.**
  - Cortar en « e » seguido de mayúscula cuando la cadena de formas nombra dos cargos («o Prefeito e o Vice-Prefeito») o va en plural.
  - Hacer el corte de reserva antes de quitar las partículas.
  - Rechazar como persona un nombre formado solo por palabras de institución («Pecuária», «Abastecimento»).

### 4. Un apellido que designa a una familia (n.º 29)

- **El caso.** N.º 29 (2023): «a relação histórica da família Bolsonaro com grupos mafiosos» se atribuye a Jair Bolsonaro. Designa a la familia. En el párrafo anterior se nombra a Flávio Bolsonaro, y Eduardo Bolsonaro tiene escaño en la 57.ª.
- **Alcance.** Es el único caso entre los apellidos sueltos de la salida.
- **Regla.** Descartar el apellido suelto tras «família», «clã» o un artículo plural («os Bolsonaro»).

## Nodos partidos (no cuentan en la precisión)

La v6 promete un solo nodo de miembro para quien tuvo escaño en una legislatura anterior de la muestra. Con los jefes de Estado que fueron diputados no se cumple, porque cada vía de detección decide el nodo por su cuenta.

- **Jair Bolsonaro** (escaño de la 52.ª a la 55.ª):
  - «o Presidente da República» (10 menciones) va al nodo de miembro JAIR BOLSONARO como antiguo miembro (n.º 10, 13, 14, 16 y 17);
  - «Presidente (Jair) Bolsonaro» (27, con una «Jair Bolsonaro» en aposición) y el apellido suelto «Bolsonaro» (81) van a la persona externa «jair bolsonaro» (n.º 29, 31 y 32);
  - «Presidente Jair Messias Bolsonaro» (4) da una tercera persona, «jair messias bolsonaro», porque la fusión de claves solo une una clave corta con una larga si es su principio.
- **Michel Temer** (escaño en la 52.ª y la 53.ª): van al nodo de miembro «Sr. Temer» (n.º 5), «Vice-Presidente Michel Temer» (4 menciones, en 2015) y el cargo sin nombre (4). «Presidente (Michel) Temer» (6) va a la persona externa «michel temer».
- **Por diseño.** Con una forma de cargo externo («Senador», «Governador», «Ministro»), el código hace externos a antiguos diputados. Según un recuento automático, es el caso de Rodrigo Pacheco (7 menciones), José Eduardo Cardozo (5), Flávio Dino (4) o Rui Costa (4).
- **Regla.** Decidir el nodo una sola vez por persona:
  - si el mandatario o la persona con cargo tuvo escaño en la muestra (`tuvoEscano`), todas sus menciones van a su nodo de miembro, sean con nombre, con el apellido suelto o con el cargo sin nombre;
  - si no, van a la persona externa con la clave canónica;
  - en la fusión de claves, unir también las que comparten el nombre de pila y el apellido final («jair messias bolsonaro» con «jair bolsonaro»).

Qué nodo es el bueno depende del criterio. Con el de la v6 (un solo nodo de miembro), los n.º 31 y 32 serían errores y la precisión total bajaría a 35/41 (85 %).

## Menciones que no deberían contar

- **Locutor de la sesión solemne (n.º 8, 18 y 20).**
  - Son turnos de PAULO OTARAN, locutor de la sesión solemne por los 15 años del CEDES (8-5-2018), que llama a los homenajeados a recoger una placa («Chamamos… (Palmas.) (Procede-se à entrega da placa.)»). Sus turnos suman 55 menciones en la salida.
  - No los descarta la etiqueta, porque no es la Presidencia. Tampoco la presidencia deducida, que solo se aplica a sesiones sin filas de Presidencia y a oradores con `id_dep`.
  - Regla: tratar como de la Mesa los turnos del orador sin `id_dep` que tiene al menos una cuarta parte de los turnos de la sesión, casi todos cortos.
- **Aposición duplicada (n.º 21).**
  - «Comandante Luiz Alves de Lima e Silva, Duque de Caxias» da dos menciones de la misma persona con dos claves, «luiz alves lima silva» y «duque caxias».
  - Regla: una aposición separada solo por una coma de una mención ya contada no crea otra mención; a lo sumo, añade su clave a la misma persona.

## Observaciones que no cuentan como error

- **N.º 6.** Carlos Marun era ministro, pero el diputado nombrado ministro conserva el mandato (art. 56, I, de la Constitución). Es correcto como miembro.
- **N.º 14.** «Vamos fazer com que o Presidente da República assine» habla de una firma futura, dos días después de la elección. El titular seguía siendo Bolsonaro y lo doy por correcto.
- **N.º 25.** No encontré fuentes sobre el «Bispo Ronivaldo». La clave es solo el nombre de pila y juntaría a cualquier otro Ronivaldo que aparezca con un cargo.
- **Posiciones.**
  - 129 de las 2.258 menciones con posición (6 %) tienen `i` y `largo` desplazados respecto del texto de `biblioteca.json`. En la muestra son los n.º 11, 13 y 16.
  - El detector une las palabras partidas por guion antes de buscar y guarda las posiciones del texto ya unido.
  - Regla: guardar las posiciones del texto original, con una tabla de desplazamientos, o guardar el texto reparado.
- **Fuera de la muestra.**
  - «Bispo Rodrigues» (3 menciones, 16-9-2003) se atribuye a PHILEMON RODRIGUES por el desempate «preside». Es Carlos Rodrigues (PL-RJ), que interviene en esa sesión con la etiqueta «BISPO RODRIGUES (Bloco/PL-RJ)» y sin `id_dep`.
  - Sigue «Comandante Paulo, da ASPAR da Marinha» → PEDRO PAULO, ya señalado en la primera revisión.

## Fuentes consultadas

- Prisión de Lula el 7-4-2018: https://pt.wikipedia.org/wiki/Prisão_de_Luiz_Inácio_Lula_da_Silva
- Carlos Marun, ministro de la Secretaria de Governo del 15-12-2017 al 28-12-2018: https://pt.wikipedia.org/wiki/Carlos_Marun
- Constitución de 1988, art. 56: http://alerjln1.alerj.rj.gov.br/constfed.nsf/16adba33b2e5149e032568f60071600f/44d868bf520ed01103256561006ea7b0
- «Bispo Ronivaldo»: dos búsquedas web, sin resultados.
- En los demás casos bastaron el texto de la sesión, `oradores.json` y la tabla de mandatos de `formas_paises.cjs`.

# Precisión de las menciones, versión 6.2: Brasil (Câmara dos Deputados)

Muestra: `node muestra_precision7.cjs paises/BR 8 31`, con hasta 8 menciones por categoría y semilla 31. Salen 33 menciones: la categoría «miembro (cargo sin nombre)» está vacía, porque los jefes de Estado ya van siempre a su nodo externo, y «externa (antiguo orador sin escaño)» también. Revisé cada mención con la intervención completa, los turnos vecinos de la sesión (`biblioteca.json`) y la lista de oradores (`oradores.json`). El juicio de cada una está en `BR.json`.

## Precisión

| Categoría | En la salida | Revisadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| miembro (con tratamiento o cargo) | 749 | 8 | 7 | 1 | 0 | 88 % |
| miembro (apellido suelto) | 1 | 1 | 1 | 0 | 0 | 100 % |
| miembro (cargo sin nombre, por fecha) | 0 | 0 | – | – | – | – |
| externa (con cargo o título) | 1060 | 8 | 7 | 1 | 0 | 88 % |
| externa (antiguo orador sin escaño en la biblioteca) | 0 | 0 | – | – | – | – |
| externa (apellido suelto) | 287 | 8 | 8 | 0 | 0 | 100 % |
| externa (cargo sin nombre, por fecha) | 26 | 8 | 8 | 0 | 0 | 100 % |
| **Total de la muestra** | 2123 | 33 | 31 | 2 | 0 | **94 %** |

- **Cálculo.** Precisión = correctas / (correctas + incorrectas). No hubo dudosas.
- **Criterio del n.º 10.** Juzgo con el criterio 6.2, que pide un solo nodo de miembro para quien tuvo escaño en una legislatura anterior de la muestra. El senador Heinze está bien identificado, pero fue diputado de la 52.ª a la 55.ª e interviene en una sesión de la muestra, y la mención va a una persona externa: la cuento como incorrecta. Si solo se juzgara la identidad, el total sería 32/33 (97 %).
- **Estimación ponderada.** Ponderada por el tamaño de cada categoría, la estimación es del 89 % (96 % si solo se juzga la identidad). Pesa mucho el error de «externa (con cargo)», la categoría más grande.
- **Margen.** Con 8 casos por categoría, una mención mueve la cifra 12,5 puntos. Por eso añado las revisiones de abajo.
- **Revisión completa de «externa (cargo sin nombre)».** Revisé las 26: 24 correctas y 2 incorrectas (92 %). Son las de la causa 4.
- **Revisión por claves de «externa (con cargo o título)».** Leí las 456 claves y, en contexto, las dudosas.
  - Hay 40 menciones mal identificadas (96 % correctas): 30 no son personas, 7 juntan o confunden personas y 3 son diputados con escaño ese día.
  - Otras 56 identifican bien a la persona pero van a un nodo externo aunque el criterio 6.2 pide el de miembro: 38 de antiguos diputados y 18 de futuros diputados nombrados con el nombre completo. Contándolas como error, queda un 91 %.
  - El detalle está en las causas 1, 2 y 5 y en «Otros errores».
- **«externa (apellido suelto)».** Las 31 menciones que no son de Lula, Bolsonaro ni Dilma están bien. En las otras 256 no encontré casos como «família Bolsonaro» ni un «Lula» que sea Lula da Fonte, pero no las revisé una a una.
- **Contraste con las etiquetas.** De las 749 menciones de miembro con tratamiento, 440 llevan un nombre igual al de la etiqueta de un orador de la misma legislatura, y ninguna se atribuye a otra persona. Los errores que conozco en esta categoría son 14: 1 de la causa 1, 4 + 1 de la causa 3, 3 de «Bispo Rodrigues» (al final de las causas) y 5 de Temer (causa 6).
- **Menciones que no deberían contar.** En la muestra solo el n.º 1, que además es incorrecta.
- **Frente a la revisión anterior (v6, semilla 23).**
  - Corregido:
    - los cargos sin nombre de 2023 ya no van al diputado LULA DA FONTE; el n.º 29 es del mismo discurso que el error n.º 11 de entonces;
    - «o Presidente da República» de Bolsonaro va a su nodo externo;
    - «Jair Messias Bolsonaro» se une a «jair bolsonaro»;
    - «Ballin e Ubirajara Teixeira» son dos personas;
    - desapareció «família Bolsonaro».
  - Sigue igual:
    - Lula preso atribuido a Temer (2018);
    - «Raul Gil e Netinho» y «Pecuária e Abastecimento»;
    - el locutor de la sesión solemne;
    - «Bispo Rodrigues» y «Comandante Paulo»;
    - la aposición de «Duque de Caxias»;
    - las posiciones desplazadas.
  - Nuevo en la v6.2: las 18 menciones de la causa 1.

## Errores que quedan, por causa

### 1. Continuación de lista tras un plural que no introduce nombres (n.º 1; nueva en la v6.2)

- **El caso.** N.º 1 (21-11-2023, habla Marco Feliciano): «Sr. Presidente, Sras. e Srs. Deputados, Brasil que nos assiste» se atribuye al diputado MARCO BRASIL. Es el país: el público que sigue la sesión.
- **Alcance.** 18 menciones, ninguna en la v6.1a:
  - «Srs. Deputados, Brasil» → MARCO BRASIL (1);
  - «Srs. Parlamentares, Brasil que nos assiste» → la persona del embajador «francisco mauro brasil holanda» (1, 2013), que se une por la fusión de claves;
  - «Sras. e Srs. Deputados, Maricá» (2021) y «…, Caririaçu» (2006): ciudades como personas externas (2);
  - formas plurales tomadas por nombres:
    - «Srªs e Srs. Congressistas» (4);
    - «Srªs», que da la clave «sr s» (3);
    - «Exmºs Srs» (1);
    - «Srs. Embaixadores» (2);
    - «colegas Líderes» (2);
    - «Srs. Procuradores» (1);
    - «Srs. Prefeitos» (1).
- **Cómo se produce.**
  - `RX_PLURAL` casa «Srs.» + «Deputados» como forma plural + nombre.
  - `procesar()` pasa «Deputados» a la cadena de formas y no crea mención, pero `lista()` sigue desde el final del casamiento. La palabra con mayúscula tras la coma se toma como el siguiente nombre de la lista.
  - En la lista, «Brasil» se resuelve contra la lista de oradores sin pasar por `LUGARES`, aunque «brasil» está en ella.
  - Los plurales de cargo que no están en `PLURALES` («Congressistas», «Embaixadores», «Líderes», «Procuradores», «Prefeitos») y las grafías «Srªs» y «Exmºs» se toman por nombres.
- **Reglas.**
  - Llamar a `lista()` solo si el primer elemento tras la forma plural dio un nombre; no, si el «nombre» era otra forma («Deputados», «Parlamentares», «Congressistas»).
  - En una lista, aplicar a cada elemento los mismos filtros que a un nombre suelto; en particular, descartar `LUGARES` («Brasil», «Portugal»). La primera regla basta para los cuatro casos de país y ciudad; esta los cubre si la lista es legítima.
  - Añadir a `PLURALES` o a `noPersona` los plurales de cargo: congressistas, parlamentares, embaixadores, líderes, procuradores, prefeitos, vereadores, governadores, ministros y secretários. Añadir también las grafías con º y ª («Srªs», «Exmºs», «Exmªs»).
  - Rechazar las claves externas formadas solo por palabras de cargo o de tratamiento.

### 2. La forma de cargo externo decide el nodo sin mirar el escaño (n.º 10)

- **El caso.** N.º 10 (1-11-2022): «no Senado, em que foi Relator o Senador Luis Carlos Heinze» va a la persona externa «luis carlos heinze». Heinze fue diputado de 1999 a 2019, con escaño de la 52.ª a la 55.ª, e interviene dos veces en la sesión del 7-11-2013. Según el criterio 6.2, es un antiguo miembro.
- **Alcance en la salida** (formas «Senador», «Governador», «Prefeito», «ex-Governador», «Ministro»).
  - **Diputados con escaño ese día** (error de identidad de nodo, 3):
    - «Governador Garotinho» (2), en el mismo discurso del n.º 9, donde «Deputado Garotinho» (3) y «Garotinho» van al miembro ANTHONY GAROTINHO: la misma persona en dos nodos dentro de una intervención;
    - «ex-Governador Paulo Afonso, querido Deputado pelo PMDB» (1, 2004).
  - **Persona equivocada** (1): «Senador Antonio Carlos Magalhães» (2004) recibe la clave de su nieto, «antonio carlos magalhaes neto». ACM era senador; ACM Neto, diputado con escaño ese día.
  - **Antiguos diputados** (38): Rodrigo Pacheco (7), Rui Costa (4), Eduardo Paes, Flávio Dino, Renato Casagrande y Ratinho Junior (3 cada uno), Jorginho Mello, Nelson Bornier, ACM Neto («Prefeito ACM Neto», clave «acm») y José Eduardo Cardozo («Eduardo Cardoso») (2 cada uno), Heinze, JHC, Marcondes Gadelha, Sandro Matos, Kátia Abreu, Ciro Gomes y Roberto Pessoa (1 cada uno).
  - **Futuros diputados con el nombre completo** (18): Marcelo Crivella (5), Alexandre Padilha (4), Aécio Neves, Camilo Capiberibe y Antonio Palocci (2 cada uno), Alfredo Nascimento, Washington Reis y Gleisi Hoffmann (1 cada uno).
- **Cómo se produce.**
  - En `clasificar()`, la rama `tipo === 'externo'` crea siempre una persona externa. Si hay un orador con el nombre completo, usa su clave; si no, el nombre tal como se escribe.
  - No llama a `escanoEnBiblioteca()` ni a `senta()`. Con un solo apellido («Governador Garotinho») ni siquiera busca miembros.
  - Además, `vecesExterno` y el conjunto `externos` marcan a esas personas como externas y les quitan el escaño deducido.
  - «Antonio Carlos Magalhães» casa con fuerza 3 con «Antonio Carlos Magalhães Neto», porque «neto» no cuenta para distinguir.
- **Reglas.**
  - En la rama `externo`, resolver como en las demás:
    - si el candidato tiene escaño ese día, es miembro;
    - si lo tuvo antes en la biblioteca, miembro, antiguo;
    - si lo tendrá después y el nombre es completo, miembro, aún sin escaño;
    - solo si no, persona externa.
  - Los jefes de Estado quedan fuera de esta regla.
  - Con un solo apellido, aceptar al miembro con escaño que la misma intervención nombra con forma de miembro («Deputado Garotinho»).
  - «Neto», «Filho», «Júnior» y «Sobrinho» distinguen personas: exigir que coincidan.
- **Parte del problema es de los datos.** Varios senadores (Heinze en la 56.ª, Heráclito Fortes en la 53.ª) figuran en `oradores.json` con partido y actividad, por sus intervenciones en sesiones conjuntas del Congreso. `senta()` les da escaño.

### 3. Grado militar ante el nombre de un diputado (fuera de la muestra)

- **Los casos.**
  - «Brigadeiro Eduardo Gomes, Patrono da Força Aérea Brasileira» (4 menciones, 21-10-2008) va al diputado EDUARDO GOMES (PSDB), con escaño en la 53.ª. Es el brigadeiro histórico.
  - Sigue, de la primera revisión, «Comandante Paulo» → PEDRO PAULO (2023).
- **Cómo se produce.** El filtro militar de `clasificar()` solo actúa con un nombre de una palabra. Con el nombre completo gana el diputado.
- **Regla.** Con un grado de `MILITAR`, no resolver como miembro salvo que la etiqueta o el nombre del diputado lleven ese grado («General Girão», «Coronel Meira») o que se le hable en la sesión. Añadir «Eduardo Gomes» a los `historicos` de BR.

### 4. Cargo sin nombre: titular anterior y fórmula legal (2 de 26, fuera de la muestra)

- **Titular anterior.** 11-4-2018, habla Paulo Teixeira: «estão prendendo sem provas o Presidente da República que tirou 40 milhões de pessoas da fome» sigue yendo a Temer. Es Lula, preso el 7-4-2018. Es el mismo error de la revisión anterior.
- **Fórmula legal.** 21-11-2023, Adriana Ventura lee su parecer: «II.3. Da constitucionalidade … atribuição do Congresso Nacional, com posterior pronunciamento do Presidente da República (...)». Va a Lula; es el cargo en abstracto.
- **Reglas.**
  - No atribuir cuando al cargo le sigue una relativa en pretérito sobre hechos de su mandato («que tirou…», «que governou…», «que fez…»).
  - No atribuir en la lectura de un parecer (encabezados «II.3.», «Voto do Relator») ni en una enumeración de requisitos constitucionales con «(...)».

### 5. Claves que juntan a personas distintas (fuera de la muestra)

- **El caso.** La clave «paulo» (6 menciones) junta a cuatro personas: «Governador Paulo Câmara» (3, 2015) y tres alcaldes distintos de Tocantins, «Prefeito Paulo» de Cachoeirinha, Alvorada y Conceição (2022).
- **Cómo se produce.** «câmara» está en `noPersona` y corta «Paulo Câmara» en el nombre de pila. Una clave de un solo nombre de pila une a todos los que lo llevan.
- **Reglas.**
  - No cortar en una palabra de `noPersona` escrita con mayúscula que sigue a un nombre de pila.
  - No crear claves externas de un solo nombre de pila, o hacerlas locales a la intervención.

### 6. Jefe de Estado en el nodo de miembro (fuera de la muestra)

- **El caso.** Temer tiene 5 menciones en el nodo de miembro MICHEL TEMER: 4 como «Vice-Presidente Michel Temer» (2015) y 1 en «os amigos do Sr. Temer» (11-4-2018), cuando ya era jefe de Estado. Otras 10 van a la persona externa «michel temer». El criterio 6.2 pide siempre el nodo externo.
- **Regla.** Dar a los mandatos de la tabla de jefes el `id_dep` del titular cuando es orador (Temer, BR73552; Bolsonaro, BR74847). Toda mención resuelta a ese `id_dep` pasa a su nodo externo, con cualquier forma y en cualquier fecha.

### Otros errores (fuera de la muestra)

- **Sin cambios desde la revisión anterior.**
  - «Bispo Rodrigues» → PHILEMON RODRIGUES (3 menciones, 2003). Es Carlos Rodrigues, que habla en esa sesión.
  - «Ministro da Agricultura, Pecuária e Abastecimento» da la persona «pecuaria abastecimento» (2).
  - «Raul Gil e Netinho» da la persona «raul gil netinho» (1).
- **Lugares, instituciones y palabras comunes tomados por nombres** (13 de las 30 externas que no son personas; las otras 17 son de la causa 1).
  - Tras una forma afectiva: «querida Guarapari», «querida Minas Gerais», «querida Encruzilhada» y «querida Rede Record» (4).
  - Palabras comunes con mayúscula: «Ministro Supremo», «colega Parlamentar» y «Relatora Durante» (3).
  - Cargos, grados y aposiciones: «Presidente Dutra, Lago da Pedra» (ciudades), «Sr. Secretário-Geral da Mesa Diretora», «Patrono da Força Aérea Brasileira», «Brigadeiro-do-Ar» y las 2 de «Pecuária e Abastecimento» (6).
  - Regla: tras «querido/querida/nossa», exigir un nombre de persona (nombre de pila o apellido de la lista de oradores) y descartar `LUGARES`. Rechazar como clave un nombre de una sola palabra común («supremo», «parlamentar», «durante») y las aposiciones que empiezan por un cargo («Patrono da…»).

## Menciones que no deberían contar

- **En la muestra.** Solo el n.º 1, que es un saludo.
- **Locutor de la sesión solemne.** Los turnos de PAULO OTARAN (8-5-2018) suman 56 menciones, una más que en la v6. Regla: tratar como de la Mesa al orador sin `id_dep` que tiene al menos una cuarta parte de los turnos de la sesión, casi todos cortos.
- **Acotaciones sin paréntesis.** 20 menciones salen de notas como «O Sr. João Paulo Cunha, Presidente, deixa a cadeira da presidência, que é ocupada pela Sra. Edna Macedo, § 2º do art. 18 do Regimento Interno». `enAcotacion()` solo mira paréntesis y rayas. Regla: descartar la oración que contiene «deixa a cadeira da Presidência» u «ocupada pelo/pela».
- **Aposición duplicada.** «Comandante Luiz Alves de Lima e Silva, Duque de Caxias» sigue dando dos personas.

## Observaciones que no cuentan como error

- **N.º 17.** Antonia Magalhães es Tonha Magalhães, diputada en la 53.ª. En 2004 no tenía escaño y el nombre civil no es el de la lista de oradores. Como en la muestra no tiene otro nodo, la doy por correcta.
- **N.º 28.** «Isso poderá ser retirado até por veto do Presidente da República» habla de un veto posible del titular a este proyecto, no del cargo en abstracto. La doy por correcta.
- **N.º 7.** Pepe Vargas era ministro, pero el diputado nombrado ministro conserva el mandato. Es correcto como miembro.
- **Posiciones.** 142 de las 2352 menciones con posición (6,0 %) tienen `i` y `largo` desplazados respecto del texto de `biblioteca.json`, como en la v6. El detector une las palabras partidas por guion antes de buscar.

## Fuentes consultadas

- Presidentes de Brasil y fechas de mandato: https://pt.wikipedia.org/wiki/Lista_de_presidentes_do_Brasil
- Prisión de Lula el 7-4-2018: https://pt.wikipedia.org/wiki/Prisão_de_Luiz_Inácio_Lula_da_Silva
- Luis Carlos Heinze, diputado de 1999 a 2019 y senador desde 2019: https://pt.wikipedia.org/wiki/Luis_Carlos_Heinze
- Pepe Vargas, ministro de Derechos Humanos en 2015: https://pt.wikipedia.org/wiki/Pepe_Vargas
- Anthony Garotinho, diputado de 2011 a 2015: https://pt.wikipedia.org/wiki/Anthony_Garotinho
- Sérgio Cabral, nunca diputado federal: https://pt.wikipedia.org/wiki/Sérgio_Cabral_Filho
- Alexandre de Moraes, ministro del STF desde 2017: https://pt.wikipedia.org/wiki/Alexandre_de_Moraes
- Tonha Magalhães (Antônia Magalhães da Cruz): https://pt.wikipedia.org/wiki/Tonha_Magalh%C3%A3es
- Patrícia Evelin, alcaldesa de Xambioá: https://clebertoledo.com.br/politica/prefeita-patricia-evelin-e-reeleita-em-xambioa-com-432-dos-votos/
- Félix Bonfim en la CAS del Senado: https://www12.senado.leg.br/noticias/materias/2013/11/12/comerciante-conta-em-audiencia-que-foi-ameacado-de-morte-por-denunciar-fraude-em-suplementos-alimentares
- Éber Escobar, concejal de Itaqui: https://www.itaqui.rs.leg.br/noticia/presidente-do-legislativo-participa-de-evento-da-uvergs
- Sistema Único de Segurança Pública (Lei 13.675/2018): https://pt.wikipedia.org/wiki/Sistema_%C3%9Anico_de_Seguran%C3%A7a_P%C3%BAblica
- Fuera de la muestra:
  - Paulo Afonso Vieira, diputado de 2003 a 2007: https://pt.wikipedia.org/wiki/Paulo_Afonso_Vieira
  - ACM, senador de 2003 a 2007, abuelo de ACM Neto: https://pt.wikipedia.org/wiki/Antônio_Carlos_Magalhães
  - Marcondes Gadelha: https://pt.wikipedia.org/wiki/Marcondes_Gadelha

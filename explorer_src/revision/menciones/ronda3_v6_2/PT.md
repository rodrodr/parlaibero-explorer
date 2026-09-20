# Precisión de las menciones, versión 6.2: Portugal (Assembleia da República)

Muestra: `node muestra_precision7.cjs paises/PT 8 31`, con hasta 8 menciones por categoría y semilla 31. Salen 46 menciones; la categoría «externa (antiguo orador)» entra entera, con 5. Revisé cada mención con la intervención completa, los turnos vecinos de la sesión (`biblioteca.json`) y la lista de oradores (`oradores.json`). El juicio de cada una está en `PT.json`.

## Precisión

| Categoría | En la salida | Revisadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| miembro (con tratamiento o cargo) | 1288 | 8 | 8 | 0 | 0 | 100 % |
| miembro (apellido suelto) | 1 | 1 | 1 | 0 | 0 | 100 % |
| miembro (cargo sin nombre, por fecha) | 276 | 8 | 7 | 1 | 0 | 88 % |
| externa (con cargo o título) | 282 | 8 | 7 | 1 | 0 | 88 % |
| externa (antiguo orador sin escaño en la biblioteca) | 5 | 5 | 5 | 0 | 0 | 100 % |
| externa (apellido suelto) | 41 | 8 | 6 | 2 | 0 | 75 % |
| externa (cargo sin nombre, por fecha) | 99 | 8 | 7 | 1 | 0 | 88 % |
| **Total de la muestra** | 1992 | 46 | 41 | 5 | 0 | **89 %** |

- **Cálculo.** Precisión = correctas / (correctas + incorrectas). No hubo dudosas.
- **Estimación ponderada.** Ponderada por el tamaño de cada categoría, la estimación es del 95 %. Pesan mucho las 1288 menciones de miembro con tratamiento, que salieron todas bien.
- **Margen.** Con 8 casos por categoría, una mención mueve la cifra 12,5 puntos. La muestra se queda corta en las categorías externas, y por eso revisé categorías enteras:

| Categoría | En la salida | Cómo la revisé | Correctas | Precisión |
|---|---:|---|---:|---:|
| miembro (con tratamiento o cargo) | 1288 | contraste con las etiquetas (1046 casan) | 1035 de 1046 | 99 % |
| miembro (cargo sin nombre, por fecha) | 276 | una a una | 249 | 90 % |
| externa (con cargo o título) | 282 | por clave (92 claves; las dudosas, en contexto) | 201 | 71 % |
| externa (apellido suelto) | 41 | una a una | 29 | 71 % |
| externa (cargo sin nombre, por fecha) | 99 | una a una | 77 | 78 % |

- **Estimación con las revisiones completas.** Si en esas cinco categorías se usan estas cifras, y las de la muestra en las otras dos, la precisión estimada de la salida baja al 92 %.
- **Menciones que no deberían contar.** En la muestra son 3: los n.º 6, 20 y 33. El n.º 20 es además incorrecta.
- **Frente a la revisión anterior (v6, semilla 23).**
  - Corregido:
    - el homónimo del primer ministro en 2020: ahora es António Costa;
    - «o então Presidente da República general Spínola» (n.º 18) ya no va a Eanes;
    - «Adjunto do Primeiro-Ministro»;
    - Luís Filipe Menezes es su nodo de miembro;
    - desaparecen «directora cej», «provedora» y «comissario almunia»;
    - de las lecturas de los secretarios de la Mesa quedan 12 menciones, de 121.
  - Sin cambios:
    - los nombres parlamentarios (causa 4);
    - Sócrates como persona externa;
    - la fila del SUMÁRIO;
    - «na altura» detrás del cargo;
    - las posiciones desplazadas.
  - Nuevo en la v6.2:
    - 51 menciones de formas plurales de cargo (causa 1); en la v6.1a solo existía una;
    - los nombres de ministerio se parten ahora en más trozos (causa 2).

## Errores que quedan, por causa

### 1. Formas plurales de cargo tomadas por nombres (n.º 20, 35 y 38; nueva en la v6.2)

- **Los casos.**
  - N.º 20 (2-4-2014): en «Sr.ª Presidente, Srs. Secretários de Estado, Sr.as e Srs. Deputados:», el saludo crea la persona «secretarios estados».
  - N.º 35 y 38: «dos próprios Estados», «entre os dois Estados» van a esa misma persona como apellido suelto.
- **Alcance.** 51 menciones. En la v6.1a solo existía una, «A Sr.ª e o Sr. Secretários de Estado», con la clave «secretarios»:
  - «secretarios estados»: 25 con cargo y 12 «Estados» sueltos;
  - «Srs. Jornalistas» (2);
  - «Srs. Governadores Civis de Aveiro e Viseu» (2);
  - «Srs. Presidentes de Câmara…» y «…das Câmaras Municipais da Maia» (2);
  - «Srs. Representantes do Governo», «Srs. Governantes», «Srs. Autarcas», «Srs. Procuradores», «Srs. Agentes da autoridade», «Srs. Reitores» y «Srs. Depurados» (1 cada una);
  - «Sr.as e Srs. Deputados, Portugal», que va al diputado JOÃO RAUL HENRIQUES SOUSA MOURA PORTUGAL (2014).
- **Cómo se produce.**
  - `RX_PLURAL` casa «Srs.» + «Secretários de Estado» como forma + nombre. «Secretários» no está en `PLURALES` ni es forma. «Estado» está en `noPersona` y corta el nombre: queda la clave «secretarios» (24 menciones).
  - La fusión une esa clave de una palabra con la única clave larga que empieza por ella, «secretarios estados». Esa clave sale de una errata de 2020 («Srs. Secretários de Estados»), porque «estados» no está en `noPersona`.
  - Con 25 menciones con cargo, la última palabra de la persona entra en los apellidos sueltos de personas externas («apellidosExternos» incluye «estados»). Desde ahí, cada «Estados» con mayúscula es una mención.
  - «Portugal» es el caso de Brasil: la continuación de lista tras «Srs. Deputados,».
- **Reglas.**
  - Añadir a `PLURALES` o a `noPersona` los plurales de cargo: secretários, presidentes, governadores, jornalistas, representantes, governantes, autarcas, procuradores, agentes, reitores y ministros.
  - Rechazar las claves externas formadas solo por palabras de cargo o de institución, y no fusionar una clave de una palabra que sea un cargo («secretarios», «vice») con una clave larga.
  - Tomar apellidos sueltos solo de claves con nombre de pila o de figuras de la lista, nunca de una palabra común («Estados», «Governo»).
  - No continuar la lista tras un plural cuyo «nombre» es otra forma («Deputados»), y descartar `LUGARES` en la lista.

### 2. Nombres de ministerio partidos en personas (fuera de la muestra)

- **Los casos.**
  - «Sr. Ministro da Solidariedade, Emprego e Segurança Social» (2014) da dos personas: «emprego» (6) y «seguranca social parodia» (6). Esta última se une con «Comissão de Trabalho, Segurança Social e Parodia» (1990, OCR de «Família»).
  - «Ministro da Ciência, Tecnologia e Ensino Superior» (2009, 2019) da «tecnologia ensino» (4) y «ensino superior» (3).
  - «Governador Civil do Distrito do Porto» da «civil distrito» (1).
  - «Sr. Vice-Primeiro-Ministro e Ministro da Defesa Nacional» (1982) da «vice secretarios guilherme santos» (2). La fusión une la clave «vice» a una clave larga que empieza por ella.
- **Alcance.** 23 menciones.
  - En la v6.1a eran 14: «emprego» (6), «tecnologia ensino» (4), «vice» (2), «civil distrito» (1) y «seguranca social parodia» (1).
  - La regla nueva de «X e Nombre Apellido» añade los segundos trozos: «seguranca social» (6) y «ensino superior» (3).
- **Cómo se produce.**
  - `RX_INST` (cargo + «da» + institución + «,» + nombre) toma lo que sigue a la coma como nombre.
  - El filtro de `RX_INST` acepta dos palabras que no están en `noPersona` ni en `LUGARES`.
  - La regla de la segunda persona corta en «e» y crea otra mención.
- **Reglas.**
  - Añadir a `noPersona` las palabras de ministerio: solidariedade, emprego, segurança, social, ciência, tecnologia, ensino, superior, infraestruturas, habitação, coesão, território, civil, distrito…
  - En `RX_INST`, exigir que el nombre empiece por un nombre de pila o por un apellido de la lista de oradores.
  - No partir en «e» cuando los dos lados son palabras de institución.
  - No fusionar claves de una palabra que sean de cargo («vice»).

### 3. Cargo sin nombre en abstracto o de otro titular (n.º 16 y 41)

- **Los casos de la muestra.**
  - N.º 16 (29-2-1996): «O regime proposto no projecto de resolução do PSD concede ao Primeiro-Ministro um tempo de 30 minutos» va a Guterres. Es una norma.
  - N.º 41 (27-1-2006): «como é que eu … cometo um crime, insulto o Presidente da República…» va a Sampaio. Es un supuesto.
- **Alcance, revisando las categorías enteras.**
  - Miembro (primer ministro): 27 de 276.
    - En el debate del 29-2-1996 sobre el formato de las sesiones con el primer ministro hay 21 de 54: 20 en abstracto («este instituto das perguntas ao Primeiro-Ministro», «o Primeiro-Ministro dispõe de 43% do tempo», «a hipótese de o Primeiro-Ministro finalizar o debate») y una de Cavaco («o Primeiro-Ministro que sempre apoiaram e defenderam»).
    - En 2007 hay 2 más: una ley y un supuesto.
    - Otras 4 son de otro titular. «A morte do Primeiro-Ministro» y «o desaparecimento trágico do Primeiro-Ministro» (11-12-1980) van a Freitas do Amaral; es Sá Carneiro, muerto el 4-12-1980 (https://pt.wikipedia.org/wiki/VI_Governo_Constitucional_de_Portugal). «A intervenção do Sr. Primeiro-Ministro … na altura» (16-2-1996, 2) va a Guterres; habla de la época de Cavaco.
  - Externa (presidente y primer ministro): 22 de 99.
    - 16 en abstracto:
      - «nos sistemas presidencialista e semipresidencialista o Presidente da República possui consideráveis poderes»;
      - «os dois pilares … o Presidente da República e a Assembleia»;
      - «o artigo 70.º prevê a segunda deliberação em caso de veto do Presidente da República» (1984);
      - «a carta de ratificação pelo Presidente da República»;
      - «Está consagrado na lei … que o Primeiro-Ministro e o Presidente da República podem dirigir-se … ao País».
    - 5 supuestos: «se o Presidente da República o retivesse» (1988); «imaginemos que … a mensagem ao País do Sr. Presidente da República».
    - 1 de otro titular: Santana Lopes, en 2008, sobre su propio gobierno. «O Sr. Presidente da República, que tinha de promulgar a lei do orçamento» era Sampaio, no Cavaco.
- **Cómo se produce.**
  - El filtro de usos genéricos solo mira verbos detrás del cargo («podrá», «deberá», «poderá») y el artículo en castellano (`art[ií]culo`), no «artigo».
  - Las marcas de pasado solo se buscan delante del cargo; «na altura» va detrás.
  - La fecha se toma de la sesión aunque la frase hable de un cambio de titular reciente.
- **Reglas.**
  - Añadir «artigo N.º», «n.º N do artigo» y «alínea» al filtro de normas.
  - Descartar el cargo precedido de verbos o sustantivos normativos: «concede ao», «confere ao», «atribui ao», «é atribuído … ao», «compete ao», «cabe ao», «por parte do», «instituto/regime/modelo/figura de…», «perguntas ao», «debate mensal com o», «eleição do», «funções/legitimidade/poderes/competência do».
  - Descartar las oraciones con «se», «imaginemos», «suponhamos» o «por exemplo» delante del cargo.
  - Buscar también detrás del cargo «na altura», «nessa altura» y «à data».
  - Con «a morte do», «o desaparecimento do» o «o anterior», no atribuir o atribuir al titular anterior.

### 4. Nombre parlamentario que no acaba en el último apellido (sin cambios; fuera de la muestra)

- **Miembros atribuidos a otro.** Al cruzar las 1046 menciones de miembro cuyo nombre coincide con una etiqueta de la misma legislatura, 11 van a otra persona:
  - «Paula Santos» (PCP), 4 veces, a la diputada del PS;
  - «Luís Fazenda» (2) y «Luís Pais de Sousa» (2), a CARLOS MANUEL LUIS;
  - «Jorge Costa», a Jorge Lacão Costa;
  - «João Ramos», a un homónimo;
  - «colega Marques Mendes» (1984), a JOÃO DANIEL MARQUES MENDES, cuando las otras 31 del mismo día van a António Joaquim Bastos Marques Mendes.
- **Diputados con escaño que acaban como persona externa** (4).
  - «Sr. Deputado Goulart» (22-4-1982, 3) da la persona «goulart». Herberto Goulart (MDP/CDE) interviene en esa sesión con la etiqueta «O Sr. Herberto Goulart (MDP/CDE)». El único candidato con Goulart como último apellido, José António Martins Goulart, solo tiene escaño en la VI: casa con fuerza 2, se resuelve como «otra legislatura» y acaba en persona externa.
  - «Sr. Deputado Amaro dá Costa» (1978, 1), con una tilde de OCR, da la persona «amaro». Es Adelino Amaro da Costa (CDS), que habla en la sesión.
- **Reglas.**
  - La de la revisión anterior: un léxico de nombres parlamentarios sacado de las etiquetas.
  - Con una forma de miembro, preferir al diputado con escaño que interviene en la sesión, aunque case con fuerza 1, antes que a un homónimo de otra legislatura.
  - Normalizar «dá» a «da» dentro de un nombre.

### 5. Otras palabras de cargo y cortes de OCR tomados por personas (fuera de la muestra)

- **Los casos** (10 menciones):
  - cargos: «Sr. Administrador» (2) y «Sr. Coordenador» (1);
  - un plural figurado: «Srs. Eládios» (1);
  - la fórmula de la Mesa dentro del texto con errata, «O Sr. Presidentes - Faça favor» (3);
  - palabras rotas o con errata: «Sr. Pmsidente», «Sr. Depu-(...)» y «Sr. Pré-(...)sidente» (1 cada una).
- **Reglas.**
  - Añadir administrador y coordenador a las formas de cargo.
  - Ignorar los nombres que acaban en guion o que corta «(...)».
  - Tratar como «Presidente» sus variantes a una o dos letras de distancia.

### 6. Nodos partidos

- **Contra el criterio 6.2.**
  - Sócrates tuvo escaño de la V a la IX y aparece como persona externa en «Ministro José Sócrates» (2023) y en «Sr. PrimeiroMinistro Sócrates» (2008 y 1996; la de 1996 es Guterres).
  - Sá Carneiro, con escaño en la I, sale como «sa carneira» por una errata de OCR (1980).
  - «general Soares, Carneiro» (1980, 2) da a Soares Carneiro una segunda clave, «soares», que además podría tomarse por Mário Soares.
  - Los cuento como errores en la revisión por claves.
- **Por diseño.**
  - Cavaco Silva y Mário Soares fueron primer ministro y presidente. Como diputados y jefes de Gobierno van a su nodo de miembro: Cavaco en 21 menciones y Soares en 28 (23 de ellas son «o Primeiro-Ministro» en 1985). Como jefes de Estado van a su nodo externo: Cavaco en 7 (2007-2009) y Soares en 7 (1988-1993).
  - El criterio produce dos nodos para cada uno. Habría que decidir cuál prevalece; por ejemplo, el de miembro, si tuvo escaño.

## Menciones que no deberían contar

- **En la muestra.**
  - N.º 6: acotación sin paréntesis («Aplausos do PSD. Entretanto, assumiu a presidência o Sr. Vice-Presidente Marques Júnior.»).
  - N.º 20: saludo.
  - N.º 33: duplicado, porque «general Ramalho: Eanes» da dos menciones en el mismo punto.
- **Fuera de la muestra.**
  - Acotaciones sin paréntesis: 20 menciones en «Entretanto, assumiu/reassumiu a presidência o Sr. …» (el n.º 6 es una de ellas), 1 en «Entretanto, tomou o lugar na bancada do Governo o Sr. Vice-Primeiro-Ministro…» y 2 en «Protestos do Primeiro-Ministro e do PS.».
  - 3 menciones en la fila del SUMÁRIO del 11-9-1978.
  - 12 en lecturas de la Mesa con la etiqueta «A Sr.ª Secretária (Celeste Correia)» o «(Maria da Luz Rosinha)». Una es además errónea: el historiador «Professor Oliveira Marques», en un voto de pesar, va al diputado JOÃO PAULO DE OLIVEIRA MARQUES.
- **Reglas.**
  - Tratar como acotación, aunque no lleve paréntesis, la oración que empieza por «Entretanto,», «Neste momento,» o «Durante esta intervenção» y contiene «assumiu/reassumiu a presidência», y la oración formada por «Aplausos/Protestos/Risos/Vozes do/da/de …».
  - Excluir las filas con la etiqueta «SUMÁRIO».
  - Tratar como Mesa las etiquetas «A Sr.ª Secretária (Nombre)» y «O Sr. Secretário (Nombre)».

## Observaciones que no cuentan como error

- **N.º 19 y 25.** El turno está etiquetado como de Lino Lima, pero habla Cunha Leal, presidente de la 2.ª Comisión, que sigue tras una interrupción de aquel («o Sr. Deputado Limo Lima nos põe em causa»). Es un error de etiqueta del corpus, no del detector. A Armando de Castro no pude identificarlo: no es orador del corpus y el texto lo presenta como la persona que redactó el texto de la comisión.
- **N.º 22.** No encontré la biografía de Eládio Alvarez; el texto lo presenta como principal accionista y administrador de Mondorel y Santix.
- **N.º 43.** «Os Portugueses escolheram … o actual Parlamento e o Presidente da República» enumera órganos, pero se refiere a la elección de Eanes que el orador acaba de nombrar. La doy por correcta.
- **N.º 28.** Gonçalo Reis tuvo escaño en la IX, que no está en la biblioteca, así que persona externa es lo que pide el criterio.
- **Posiciones.** 86 de las 2012 menciones con posición (4,3 %) tienen `i` y `largo` desplazados respecto del texto de `biblioteca.json`, como en la v6.

## Fuentes consultadas

- Presidentes de Portugal y fechas: https://pt.wikipedia.org/wiki/Lista_de_presidentes_de_Portugal
- Gobiernos y primeros ministros:
  - III (Nobre da Costa): https://pt.wikipedia.org/wiki/III_Governo_Constitucional_de_Portugal
  - VI (Sá Carneiro; Freitas do Amaral tras su muerte): https://pt.wikipedia.org/wiki/VI_Governo_Constitucional_de_Portugal
  - IX (Mário Soares): https://pt.wikipedia.org/wiki/IX_Governo_Constitucional_de_Portugal
  - XI y XII (Cavaco Silva): https://pt.wikipedia.org/wiki/XI_Governo_Constitucional_de_Portugal y https://pt.wikipedia.org/wiki/XII_Governo_Constitucional_de_Portugal
  - XIII (Guterres): https://pt.wikipedia.org/wiki/XIII_Governo_Constitucional_de_Portugal
  - XVII (Sócrates; Manuel Pinho y Teixeira dos Santos): https://pt.wikipedia.org/wiki/XVII_Governo_Constitucional_de_Portugal
- Soares Carneiro, candidato de la AD en 1980: https://pt.wikipedia.org/wiki/Soares_Carneiro
- David Neeleman y la TAP, 1-7-2020: https://observador.pt/2020/07/01/costa-espera-que-haja-ainda-hoje-solucao-para-a-tap-por-acordo-com-privados/
- Gonçalo Reis, diputado del PSD y administrador de la RTP: https://www.esquerda.net/artigo/ex-deputado-do-psd-vai-ganhar-10-mil-euros-como-administrador-da-rtp/36698
- Armando de Castro (el economista, no diputado): https://pt.wikipedia.org/wiki/Armando_de_Castro
- Eládio Alvarez: búsqueda web, sin biografía.
- En los demás casos bastaron el texto de la sesión, `oradores.json` y la tabla de mandatos de `formas_paises_v6_2.cjs`.

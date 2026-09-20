# Precisión de las menciones: Portugal (Assembleia da República)

Muestra: `node muestra_precision.cjs paises/PT 10 7`, con hasta 10 menciones por categoría y semilla 7. Revisé a mano las 41 menciones con la intervención completa, los turnos vecinos de la sesión (`biblioteca.json`) y la lista de oradores (`oradores.json`). El juicio de cada mención está en `PT.json`.

## Precisión

| Categoría | En la salida | Revisadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| miembro (con tratamiento o cargo) | 1306 | 10 | 9 | 1 | 0 | 90 % |
| miembro (apellido suelto) | 1 | 1 | 1 | 0 | 0 | 100 % |
| miembro (cargo sin nombre, por fecha) | 0 | 0 | – | – | – | – |
| externa (con cargo o título) | 242 | 10 | 9 | 1 | 0 | 90 % |
| externa (antiguo miembro) | 21 | 10 | 1 | 9 | 0 | 10 % |
| externa (apellido suelto) | 21 | 10 | 9 | 1 | 0 | 90 % |
| **Total de la muestra** | 1591 | 41 | 29 | 12 | 0 | **71 %** |

La precisión es correctas / (correctas + incorrectas). No hubo dudosas.

- **Por qué el total es bajo.** La muestra pesa igual cada categoría. «Externa (antiguo miembro)» solo tiene 21 menciones en la salida, pero aporta 10 a la muestra, y 9 de ellas están mal.
- **Estimación ponderada.** Ponderada por el tamaño de cada categoría en la salida, la estimación es del 89 %.
- **Margen.** Con 10 casos por categoría, una sola mención mueve la cifra 10 puntos.
- **Categoría vacía.** La de cargo sin nombre no tiene menciones porque Portugal no tiene cargos atribuidos por fecha. Las 232 «Sr. Primeiro-Ministro» sin nombre se descartan.

## Patrones de error

### 1. Un nombre de pila con apellido se atribuye a un orador sin escaño aunque haya un diputado con escaño que encaja (10 de los 12 errores)

| N.º | Mención | Atribuida a | Es |
|---|---|---|---|
| 22, 24, 25, 30, 31 | «Sr. Deputado João Amaral», «camarada João Amaral» (1988-1996) | João Manuel do Amaral Esteves, que solo aparece en 2025 | João António Gonçalves Amaral (PCP), con escaño de la I a la VII |
| 26, 28 | «Sr. Deputado Jorge Almeida» (2008) | Ivo Jorge de Almeida dos Santos Pinho (IV) | Jorge Manuel Monteiro Almeida (PS), X |
| 27 | «Sr. Deputado Jorge Leite» (1977) | Abílio Jorge Leite Almeida Costa (IX) | Jorge do Carmo da Silva Leite (PCP), I |
| 23 | «Sr. Deputado Luís Monteiro» (2019) | José Luís Monteiro Pereira Seixas (IV) | Luís Valentim Pereira Monteiro (BE), XIII |
| 8 | «Sr. Deputado Goulart» (1982) | José António Martins Goulart (VI) | Herberto de Castro Goulart da Silva (MDP/CDE), II; el turno anterior lo llama «Herberto Goulart» |

En 9 de estos 10 casos, el diputado correcto interviene en la misma sesión, y en 5 lo hace a cuatro turnos o menos de la mención.

Cómo se produce en `detectar5.cjs`:
- `fuerza()` da 3 a la combinación de nombre de pila y primer apellido, que es la convención castellana. «João Amaral» casa con fuerza 3 con João Manuel do Amaral Esteves, cuyo primer apellido es Amaral. Con João António Gonçalves Amaral solo casa con fuerza 2, por el apellido final.
- `resolver()` se queda en el primer nivel que tiene candidatos y no mira a los diputados con escaño de los niveles inferiores. Si en ese nivel nadie tiene escaño, pasa esto:
  - con un solo candidato, devuelve «otra legislatura»;
  - con varios, devuelve una ambigüedad «fuera», que `clasificar()` resuelve por «tuvo escaño»;
  - si el elegido no tuvo escaño en ninguna legislatura de la biblioteca, `clasificar()` lo convierte en persona externa «antiguo miembro».
- En «Goulart» pasa lo mismo entre el nivel 2 y el 1: Goulart es el apellido final de uno y un apellido intermedio de Herberto de Castro Goulart da Silva.

Alcance fuera de la muestra, con un recuento automático que no he revisado a mano. Cuento los casos en que la legislatura de la sesión tiene un diputado con escaño cuyo nombre contiene todas las palabras de la mención y termina en el mismo apellido:
- 19 de las 21 externas «antiguo miembro»; 19 de esas 21 llevan, además, la forma «Deputado». Fuera de la muestra, por ejemplo, «Sr. Deputado Telmo Correia» (2009) se atribuye a Telmo Henrique Correia Daniel Faria, que solo aparece en la XVI. Es Telmo Augusto Gomes de Noronha Correia (CDS-PP), con escaño en la XI.
- 48 de los 49 miembros resueltos por «tuvo escaño». «Marques Mendes» se atribuye 39 veces a João Daniel Marques Mendes (CDS, I). En la III es António Joaquim Bastos Marques Mendes y en la VII y la X, Luís Marques Mendes, ambos del PSD y con escaño.
- 63 de los 139 miembros resueltos por «otra legislatura». Por ejemplo, «Lino de Carvalho» se atribuye a Lino Carvalho de Lima y es Lino António Marques Carvalho (PCP); «Gameiro dos Santos» se atribuye a António Ribeiro Gameiro y es José Manuel Oliveira Gameiro dos Santos.

Reglas que lo evitarían:
- **Formas del nombre.** En Portugal (`apellidoUltimo`), no dar fuerza 3 a nombre de pila más primer apellido, salvo que ese apellido sea también el último. El apellido de referencia es el final.
- **Desempate.** En `resolver()`, antes de devolver un candidato sin escaño, buscar en todos los niveles, incluido el 1, un diputado con escaño en esa legislatura. Si hay uno, es él. Si hay varios, desempatar por quien habla o preside en la sesión, y aplicar ese desempate aunque la mención no sea un vocativo.
- **Forma de miembro.** Una cadena con forma de miembro («Sr. Deputado», «Deputada») no debería acabar como persona externa si algún diputado con escaño encaja.

### 2. Nombres de instituciones y lugares (1 error)

- N.º 19 (2014): «Museu Regional Rainha D. Leonor, em Beja» se atribuye a la persona «leonor». Es el nombre de un museo. El filtro de instituciones delante del nombre solo tiene palabras castellanas (museo, centro, hospital…) y no admite un adjetivo en medio.
- Fuera de la muestra: «Praça do General Humberto Delgado» (1982) y «General Humberto Delgado» (2023, el general de 1958) se atribuyen al diputado Humberto Delgado Ubach Chaves Rosa.

Reglas:
- **Instituciones.** Añadir al filtro previo al nombre las palabras portuguesas museu, escola, liceu, colégio, hospital, instituto, fundação, universidade, prémio, rua, avenida, praça, largo, ponte, estádio, teatro, biblioteca, palácio, quartel, aeroporto y centro. Admitir entre ellas y el nombre un adjetivo (Regional, Nacional, Municipal, Distrital, Secundária) y un «D.».
- **Figuras históricas.** Añadir las de Portugal a `historicos`: Humberto Delgado, Salazar, Marcelo Caetano.

### 3. Otro nombre de pila delante de un apellido suelto (1 error)

- N.º 38 (2023): «Quero agradecer […] à Manuela Eanes» se atribuye a António Ramalho Eanes. Es otra persona. El descarte por nombre de pila ajeno usa `esPila()`, que solo cuenta la primera palabra del nombre de cada orador. «Manuela» aparece como segundo nombre («Maria Manuela…») y no se reconoce.

Reglas:
- **Nombres de pila.** Contar como nombre de pila también la segunda palabra de los nombres que empiezan por un nombre de pila («Maria Manuela…», «José Luís…»), o usar un léxico de nombres.
- **Género.** Comprobar la concordancia: un artículo femenino («à», «a», «da») o un nombre de pila femenino delante de una persona masculina descarta la mención.

### 4. Fórmula de la Presidencia sin filtrar (se suma al n.º 27)

- «Tem a palavra para uma intervenção o Sr. Deputado Jorge Leite» (1977) no se descarta por dos motivos:
  - la fila está etiquetada «O Sr.Presidente», sin espacio, y `RX_MESA` exige espacio tras «Sr.»;
  - el filtro de procedimiento (`C.procedimiento`) solo se aplica a las menciones de miembro, no a las externas.
- Solo hay 7 filas con esa etiqueta, todas de la sesión del 13-5-1977.

Reglas: admitir `\s*` tras el tratamiento en `RX_MESA` y aplicar también el filtro de procedimiento en `externa()`.

## Comprobación aparte: ministros y primer ministro (fuera de la muestra)

En la muestra solo había una mención a un ministro, la n.º 13 («Sr. Ministro Cadilhe», persona externa, correcta). Por eso revisé todas las menciones de la salida con «Ministro» o «Primeiro-Ministro» en la forma o en el texto: son 82, 47 resueltas como miembro y 35 como externas. No entran en las cifras de precisión.

Hay que tener presente que en Portugal los diputados nombrados miembros del Gobierno no pueden ejercer el mandato hasta que cesan (art. 154.º, n.º 1, de la Constitución: https://www.parlamento.pt/arquivodocumentacao/documents/crpviirevisao.pdf). Sin embargo, `oradores.json` da partido a quien interviene como ministro o primer ministro; por ejemplo, António Guterres figura en la VII con el PS, 104 intervenciones y 36 marcadas como de Gobierno. Por eso `senta()` los cuenta como diputados con escaño.

**Resueltas como miembro (47):**
- **20 incorrectas por la regla «miembro solo si tenía escaño en esa legislatura».** Son personas que estuvieron en el Gobierno durante toda la legislatura:
  - Guterres, primer ministro en la VII (4 menciones; XIII Governo, del 28-10-1995 al 25-10-1999: https://pt.wikipedia.org/wiki/XIII_Governo_Constitucional_de_Portugal);
  - Jaime Gama (1) y João Cravinho (2; https://pt.wikipedia.org/wiki/João_Cravinho), ministros durante toda la VII;
  - Silva Peneda (3), ministro de Empleo del 17-8-1987 al 31-10-1991, toda la V (https://pt.wikipedia.org/wiki/XI_Governo_Constitucional_de_Portugal);
  - en la X, José Sócrates (1), Manuel Pinho (2) y Vieira da Silva (1) (https://pt.wikipedia.org/wiki/XVII_Governo_Constitucional_de_Portugal);
  - en la XI, Vieira da Silva (2) y Jorge Lacão (2) (https://pt.wikipedia.org/wiki/XVIII_Governo_Constitucional_de_Portugal);
  - en la XII, Pedro Mota Soares (1) (https://pt.wikipedia.org/wiki/XIX_Governo_Constitucional_de_Portugal);
  - en la XV, Fernando Medina (1) (https://pt.wikipedia.org/wiki/XXIII_Governo_Constitucional_de_Portugal).
- **4 atribuidas a otra persona:**
  - «Teixeira dos Santos» (2006, ministro de Finanzas) se atribuye a Abílio André Brandão Almeida Teixeira: «Santos» está en la lista de lugares y corta el nombre tras «dos».
  - «Primeiro-Ministro António Costa» (2023) se atribuye a António Costa Rodrigues, por la fuerza 3 del patrón 1. El primer ministro, António Luís Santos da Costa, también está entre los oradores.
  - «Vice-Primeiro-Ministro Mota Pinto» (1984), que es Carlos Mota Pinto, se atribuye a su hijo Paulo Mota Pinto.
  - «Ministro Luís Nobre Guedes» (2007) se atribuye a Carlos Manuel Luís: «Nobre» es una forma de tratamiento y corta el nombre.
- **18 correctas:**
  - 11 son exministros con escaño en esa fecha: Morais Leitão y Álvaro Barreto en 1982 («deputado … e ex-Ministro»), Leonardo Ribeiro de Almeida en 1988, Ferreira do Amaral en 1995-1996 (6 menciones; «agora Deputado») y Santana Lopes en 2008 (2 menciones).
  - 7 son referencias históricas resueltas como antiguo miembro: Sá Carneiro, Silva Peneda en 1996, Pina Moura, Sousa Franco, Pedro Marques, y Guterres y Sócrates en 2023.
- **3 aceptables por la regla de la legislatura, sin comprobar en fuentes.** Son ministros en la fecha de la mención que, según `oradores.json`, también intervinieron sin cargo de Gobierno en esa legislatura: António Barreto en 1978, y Freitas do Amaral y Ângelo Correia en 1982.
- **2 dudosas:**
  - «Primeiro-Ministro Cavaco Silva» (1995, antiguo miembro): todas sus legislaturas en `oradores.json` tienen intervenciones de Gobierno y no he comprobado si llegó a ejercer el escaño.
  - «Ministro dos Negócios Estrangeiros, Freitas do Amaral» (1985): el escaño en la III se deduce porque tiene intervenciones en legislaturas anteriores y posteriores, no en esa.

**Resueltas como externas (35):**
- **17 correctas.** Son personas sin escaño: Cadilhe (5), Ernâni Lopes, Vaz Portugal, Jaime Silva, Mariano Gago (2), Carlos Tavares, Manuel Heitor, y los ministros españoles Pérez Llorca (3, una escrita «Lorca») y Marcelino Oreja. A ellas se suma «Sr. PrimeiroMinistro Sócrates» (2008), con la clave deformada «primeiroministro socrates».
- **18 que no son una persona o no son la persona:**
  - el cargo sin nombre tomado por un nombre: «Sr. Primeiro Ministro» sin guion y «Sr. Vice-Primeiro-Ministro e Ministro da Defesa Nacional» quedan como la persona «vice primeiro» (7);
  - «Ministro Adjunto» queda como «adjunto» (4) y «Sr. Administrador», como «administrador» (2);
  - «Sr. PrimeiroMinistro» (1996), que es Guterres, queda unido a la clave de Sócrates (1);
  - fragmentos del nombre del ministerio tras la coma: «Tecnologia e Ensino Superior» (2) y «Emprego e Segurança Social» (2).

Reglas que lo evitarían:
- **Jefes de Gobierno de Portugal.** Añadir `jefesGobierno` para Portugal con sus fechas: Soares, Nobre da Costa, Mota Pinto, Pintasilgo, Sá Carneiro, Balsemão, Cavaco Silva, Guterres, Durão Barroso, Santana Lopes, Sócrates, Passos Coelho, Costa y Montenegro.
  - Durante el mandato, el primer ministro no se resuelve como miembro con escaño aunque figure entre los oradores. El código actual para `jefesGobierno`, pensado para España, lo resuelve como miembro cuando tiene escaño; en Portugal debería ser persona externa mientras gobierna.
  - Con esa tabla, «o Primeiro-Ministro» sin nombre también podría atribuirse por fecha.
- **Escaño de quien habla como Gobierno.** En los datos, marcar como de Gobierno también las continuaciones («O Orador») de un turno de ministro. En Portugal, `senta()` solo debería contar las intervenciones que no son de Gobierno.
- **Formas.** `variantes()` solo pone en mayúscula la primera letra y no reconoce «Primeiro-Ministro» ni «Vice-Primeiro-Ministro»: el texto se lee como «Ministro X» y se pierde el cargo. Hay que aceptar mayúscula tras el guion, además de «Primeiro Ministro» sin guion y «PrimeiroMinistro».
- **Palabras que no son personas.** Añadir a `noPersona` de Portugal adjunto, administrador, primeiro, vice y las palabras de nombres de ministerio: ciência, tecnologia, ensino, emprego, solidariedade, segurança, social. Otra opción es que `RX_INST` rechace los nombres unidos por «e» cuyas palabras son de institución.
- **Lugares.** No cortar el nombre tras «dos/da» en lugares que también son apellidos comunes: Santos, Lima, Vitória, Natal, Palmas.
- **Formas que son apellidos.** No cortar el nombre en una forma de tratamiento que va entre dos palabras con mayúscula de un nombre: «Luís Nobre Guedes», «Nobre da Costa». Pasa lo mismo con palabras de `noPersona` que son apellidos: «Luís Fazenda» se atribuye a Carlos Manuel Luís.

## Observaciones que no cuentan como error

- **N.º 2.** «Dr. Ferreira de Amaral» (1978) es Augusto Ferreira do Amaral, del PPM, entonces secretario de Estado. Fue elegido diputado en 1979 (https://pt.wikipedia.org/wiki/Augusto_Ferreira_do_Amaral). La I legislatura del corpus va de 1976 a 1980 e incluye la sesión intercalar de 1980, así que figura con escaño en esa legislatura aunque en 1978 aún no lo tenía. La persona es la correcta.
- **N.º 29.** João Pedro da Silva Correia fue diputado suplente hasta el 11-12-1995, según el propio texto, y en la sesión del 20-12 ya no tenía escaño. Queda bien como antiguo miembro porque lo tuvo en la VIII. Los suplentes que casi no intervienen no son visibles para `senta()`.

## Fuentes consultadas

- Augusto Ferreira do Amaral: https://pt.wikipedia.org/wiki/Augusto_Ferreira_do_Amaral
- Miguel Cadilhe: https://pt.wikipedia.org/wiki/Miguel_Cadilhe
- Armando de Castro: https://pt.wikipedia.org/wiki/Armando_de_Castro
- Constitución, art. 154.º: https://www.parlamento.pt/arquivodocumentacao/documents/crpviirevisao.pdf
- Gobiernos XI, XIII, XVII, XVIII, XIX y XXIII y João Cravinho: las páginas de pt.wikipedia.org citadas arriba.

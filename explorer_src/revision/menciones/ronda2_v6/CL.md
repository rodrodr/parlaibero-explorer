# Menciones en Chile (CL): precisión de la versión 6

Muestra: `node muestra_precision6.cjs paises/CL 8 23` sobre `paises/CL/menciones6.json`. Hasta 8 menciones por categoría, con semilla fija: 43 en total, porque la categoría de miembro por cargo sin nombre solo tiene 3 y la de antiguo orador externo está vacía. Cada mención se ha juzgado con la intervención completa, los turnos de la sesión y `oradores.json`. El veredicto, el motivo y la marca `no_deberia_contar` de cada una están en `revision6/CL.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 725 | 8 | 7 | 1 | 0 | 88 % |
| Miembro, apellido suelto | 97 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, cargo sin nombre (por fecha) | 3 | 3 | 3 | 0 | 0 | 100 % |
| Externa, con cargo o título | 651 | 8 | 7 | 1 | 0 | 88 % |
| Externa, antiguo orador sin escaño en la biblioteca | 0 | — | — | — | — | sin casos |
| Externa, apellido suelto | 50 | 8 | 8 | 0 | 0 | 100 % |
| Externa, cargo sin nombre (por fecha) | 90 | 8 | 7 | 1 | 0 | 88 % |
| Total | 1.616 | 43 | 40 | 3 | 0 | 93 % |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- **Margen.** Con tan pocos casos, el margen es amplio (intervalo de Wilson al 95 %):
  - 7 de 8 es compatible con una precisión real entre el 53 % y el 98 %.
  - 8 de 8, desde el 68 %.
  - El total, 40 de 43, entre el 81 % y el 98 %.
  - Ponderando cada categoría por su tamaño en el país, la estimación es del 89 %.
- **Los errores no son aislados.** Los tres tienen causas distintas. El de la primera categoría (n.º 8) se repite fuera de la muestra en otras 6 menciones (patrón 1).
- **Identidad correcta, pero la mención no debería contar.** Afecta a 7 de las 40 correctas:
  - 5 usos genéricos de «el Presidente de la República» (n.º 17, 37, 38, 39 y 40).
  - 2 listas de autores leídas por la Mesa (n.º 11 y 14).

  Si los usos genéricos se contaran como error, los cargos sin nombre quedarían en 2 de 3 (miembro) y 3 de 8 (externa). La n.º 42, además de errónea, duplica una mención correcta en el mismo punto.
- **Los errores de la revisión anterior ya no aparecen:**
  - Los apellidos sueltos de miembros se buscan por el apellido: 8 de 8 correctos, ninguno precedido de «San».
  - «Viera-Gallo» ya no se duplica como persona externa mientras tiene escaño.
  - «honorable Corporación» ya no sale como persona.

## Errores que quedan

### 1. Listas «Apellido, don Nombre»: el nombre de pila se resuelve por quién habla en la sesión (n.º 8)

Las listas de asistentes y de firmantes de los diarios chilenos escriben «Vargas, don Alfonso». El detector toma «don Alfonso» como un nombre de pila solo y, por la coma de delante, como vocativo. `resolver` elige entonces al único Alfonso con escaño que habla o preside en la sesión, Alfonso de Urresti, sin mirar el apellido que precede a la coma. Es Alfonso Vargas Lyng, que también tenía escaño.

Fuera de la muestra el patrón pesa:

- **Nombre equivocado.** De las 33 menciones de miembros resueltas «por sesión» en el país, 31 son elementos de estas listas. En 7, el miembro elegido no lleva el apellido de delante:
  - «Aylwin, don Andrés» → Andrés Chadwick (1992).
  - «Tuma, don Eugenio» → Eugenio Munizaga (1995).
  - «Galilea, don Pablo» → Pedro Pablo Álvarez-Salamanca (2000).
  - «Pérez, don José» → José Miguel Ortiz (2000 y 2002).
  - «Vargas, don Alfonso» → Alfonso de Urresti (2009).
  - «Encina, don Francisco» → Francisco Chahuán (2009).

  Las otras 24 aciertan porque quien habla en la sesión es, por casualidad, el de ese apellido.
- **Menciones dobles.** Cuando el apellido ya es una mención, la misma persona cuenta dos veces en el mismo punto: «la diputada señora Rozas, doña María», «señora Allende, doña Isabel», «Bosselin, don Hernán». Hay 14 pares así en el país.

Qué lo evitaría:

- Reconocer la forma «Apellido(s), don|doña Nombre(s)» y resolver con el apellido y el nombre juntos. Si el apellido ya es una mención, fundir las dos en una sola.
- No marcar como vocativo un «don Nombre» precedido de «Apellido,».
- En `resolver`, no resolver «por sesión» un nombre de pila solo si delante hay una palabra con mayúscula y una coma.

### 2. Clave de una palabra unida por el apellido a otra persona (n.º 25)

En 2008 se habla de «los predios particulares del señor René Urban, del señor Figueroa» (Temucuicui). La mención va al nodo «jose figueroa», que nace de tres menciones de 2002 del alcalde de San Fernando («El alcalde, don José Figueroa»). Ese alcalde es José Figueroa Jorquera, dirigente comunista y alcalde de 2000 a 2004 (https://es.wikipedia.org/wiki/José_Figueroa_Jorquera): otra persona.

Al unir claves, la de una palabra («figueroa») va con la única clave larga cuyo apellido de referencia coincide (`refDe`). No se mira la fecha, ni la sesión, ni si el apellido es común, y Figueroa está en `comunes`.

Qué lo evitaría: no unir una clave de una palabra con una larga si el apellido está en `comunes` o si no comparten sesión ni legislatura (±1). En ese caso, dejarla como nodo propio o descartarla. v6 ya restringe así los apellidos sueltos de personas corrientes (`legsDePersona`), pero no la unión de claves.

### 3. Cargo sin nombre con una aposición que lo sitúa en otra época (n.º 42)

En 1991 se cita «una carta del señor Herbert Siggelkow Abarca, del 3 de agosto de 1986, dirigida al Presidente de la República de la época, Augusto Pinochet». La mención se atribuye a Aylwin.

- `cargosSinNombre` excluye «de/del + Mayúscula», y la comprobación de lo que sigue excluye un nombre justo detrás. Ninguna de las dos cubre «de la época, Nombre».
- En el mismo punto, `RX_INST` ya produce la mención correcta, «Augusto Pinochet». La errónea es, además, un duplicado.
- En el país es el único cargo sin nombre seguido de «de la época» o «de entonces». En Perú hay otro, fuera de la muestra (`revision6/PE.md`).

Qué lo evitaría: no atribuir por fecha cuando al cargo le siguen «de la época», «de entonces», «de ese entonces» o «de aquel entonces». Si en la misma frase hay un nombre en aposición, dejar la mención a ese nombre.

## Sin efecto en el veredicto

- **Usos genéricos del cargo.** De los 11 cargos sin nombre juzgados, 5 designan el cargo y no a quien lo ocupa:
  - una atribución constitucional (n.º 17);
  - el contenido de un proyecto (n.º 37);
  - un trámite (n.º 38);
  - «de turno» (n.º 39);
  - el artículo 33 de la Constitución, citado (n.º 40).

  La persona atribuida era la titular ese día, pero la mención no es una alusión a ella. Regla: no atribuir cuando sigue «de turno» ni cuando la oración cita una norma («artículo», «inciso», «Constitución», «establece», «facultad», «atribución»). Como mínimo, marcar estas menciones para que la pestaña pueda filtrarlas.
- **Una persona, dos nodos, cuando un antiguo miembro vuelve como jefe de Estado o ministro.** La regla de v6 («antiguo miembro», un solo nodo) solo se aplica cuando la forma pasa por `resolver`:
  - **Boric**, el 18-5-2022 (n.º 23 frente a n.º 17-19). «el Presidente de la República» va a su nodo de miembro, porque la atribución por fecha pasa por `resolver` y `tuvoEscano`. «Presidente Boric», «Presidente Gabriel Boric» y sus apellidos sueltos van al nodo externo «gabriel boric», porque `jefeDe` envía siempre al jefe de Estado a una persona externa. Quedan 3 menciones en un nodo y 7 en el otro.
  - **Allamand**, en la misma sesión. «canciller Allamand» y «ministro Allamand» (5 menciones) van a una persona externa por la rama `deGobierno`. «señor Allamand» y «exministro Allamand» (47) van a su nodo de miembro. El n.º 3 es de estas últimas.
  - **Viera-Gallo.** En 2008, «ministro Viera-Gallo» (10) va a una persona externa, y su nodo de miembro tiene 14 menciones de 1992 y 1995.

  Regla: en las ramas `jefeDe` y `deGobierno`, antes de crear la persona externa, comprobar si es un orador con escaño anterior en la biblioteca (`escanoEnBiblioteca === 'antes'`). Si lo es, enviarla al nodo de miembro con `antiguo`, como ya se hace con el cargo sin nombre.
- **Listas y lecturas de la Mesa.** De los 97 apellidos sueltos de miembros del país, 91 están en enumeraciones (autores, asistentes, votos en comisión) y 30 salen de turnos sin orador (secretario, prosecretario). En la muestra todos están bien resueltos. Pero si la pestaña cuenta las menciones sin orador, las listas que lee la Mesa pesan (n.º 11 y 14). Regla: descartar o marcar las menciones de los turnos sin `id_dep`.
- **Falsos vocativos.** 5 de las 43 menciones llevan «se dirige» (n.º 8, 9, 10, 14 y 16), y ninguna es un vocativo: son elementos de una lista separados por comas. Regla: `vocativoDe` no debe marcar la mención si detrás siguen una coma, o «y», y otra palabra con mayúscula, ni si delante hay «Apellido,».
- **«Joseph» tomado por apellido** (n.º 29). En «Joseph Rafael Ramos Quiñones», «Joseph» no está en el léxico de nombres de pila, y el detector lo busca como apellido suelto. El tramo se queda en «Joseph Rafael», pero la persona es la correcta, y las 10 menciones sueltas de «Joseph» son todas suyas.

## Fuentes consultadas

- José Figueroa Jorquera, alcalde de San Fernando de 2000 a 2004 y dirigente del Partido Comunista: https://es.wikipedia.org/wiki/José_Figueroa_Jorquera (n.º 25)
- Las fechas de mandato presidencial son las de `formas_paises.cjs` (tabla contrastada). El resto de identificaciones sale del propio texto de la sesión y de `oradores.json`.

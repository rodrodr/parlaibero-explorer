# Menciones en Paraguay (PY): revisión de la precisión

Muestra: `node muestra_precision.cjs paises/PY 10 7` sobre `paises/PY/menciones.json`. Salen hasta 10 menciones por categoría con semilla fija, 45 en total. Cada una se juzgó a mano con la intervención completa, los turnos vecinos de la sesión y `oradores.json`, y con una fuente externa, citada en el motivo, cuando había que saber quién era alguien. El veredicto y el motivo de cada mención están en `revision/PY.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 986 | 10 | 8 | 2 | 0 | 80 % |
| Miembro, apellido suelto | 70 | 10 | 10 | 0 | 0 | 100 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | sin casos |
| Externa, con cargo o título | 585 | 10 | 6 | 4 | 0 | 60 % |
| Externa, antiguo miembro | 5 | 5 | 0 | 5 | 0 | 0 % |
| Externa, apellido suelto | 188 | 10 | 7 | 3 | 0 | 70 % |
| **Total** | 1.834 | 45 | 31 | 14 | 0 | **69 %** |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- El total da el mismo peso a cada categoría. Ponderada por el tamaño de cada categoría en el país, la precisión estimada es del 73 %. Con 10 casos por categoría el margen es amplio: el intervalo de Wilson al 95 % del total va del 54 % al 81 %.
- «Externa, antiguo miembro» solo tiene 5 menciones en el país, así que la muestra es la categoría entera, y las 5 fallan.
- «Cargo sin nombre» está vacía porque PY no tiene `cargosSinNombre` en `formas_paises.cjs`.
- De los 10 aciertos de «miembro, apellido suelto», 8 son nombres con nombre de pila dentro de listas de proyectistas o de comisiones («Néstor Cabañas Bazán», «Eduardo Ibarra»). Solo el n.º 11 («el tema Pappalardo») y el n.º 19 son el apellido solo, así que la regla del apellido suelto propiamente dicho apenas se ha probado.

## Patrones de error

Hay 14 errores. Cada uno se cuenta en un solo patrón; el patrón 7 atraviesa varios.

### 1. Lugares que se toman por personas (6 errores: n.º 22, 31, 32, 33, 35 y 44)

En Paraguay muchos distritos llevan un grado militar y un apellido, o el nombre completo de una persona. El detector los lee como «forma + nombre».

- «Capitán Meza», distrito de Itapúa, aparece en una lista de localidades (n.º 31 y 35), en «DEL DISTRITO DE CAPITÁN MEZA, DEPARTAMENTO DE ITAPÚA» (n.º 32) y en «Distrito de Capitán Meza» (n.º 33). Las cuatro veces se atribuye al diputado Hugo Joel Meza. Son 4 de las 5 menciones de la categoría «antiguo miembro».
- La ley de 1989 que cambia los nombres de varios distritos enumera «Vicente Antonio Matiauda, Capitán Vicente A. Matiauda y Antibia Matiauda». La cadena entera se toma por una persona (n.º 22), y «Matiauda» suelto también (n.º 44).
- Fuera de la muestra (en `menciones.json` se leyeron los contextos, pero no se juzgaron uno a uno), el mismo fallo da como diputados:
  - «Coronel Oviedo», la ciudad, atribuida 19 veces a César Ariel Oviedo Verdún;
  - «Coronel Martínez», el distrito, atribuido 3 veces a Atilio Martínez Casado;
  - «Capitán Bado» a Mario Esquivel Bado;
  - el «Club General Genes» a Luis Becker Genes, 4 veces.

**Regla.**

- Añadir a PY una lista de topónimos compuestos y comprobarla antes de clasificar, porque hoy `lugares` solo admite palabras sueltas. Lo mejor es tomar la lista de distritos oficial. Del corpus salen, por ejemplo: Capitán Meza, Capitán Bado, Coronel Oviedo, Coronel Martínez, Presidente Hayes, Mariscal López, Carlos Antonio López, Teniente Irala Fernández, Capitán Carmelo Peralta, y los nombres de distrito anteriores a 1989, como Capitán Vicente A. Matiauda y Antibia Matiauda.
- Ampliar el filtro de prefijos de institución de `procesar` (`centro|museo|hospital|…`) con «distrito de», «departamento de», «ciudad de», «municipio de», «jurisdicción de», «sede de», «compañía» y «club», admitiendo comillas entre el prefijo y el nombre («CLUB “GENERAL GENES”»).
- Descartar las cadenas dentro de una enumeración que sigue a «Departamento de X:».

### 2. Grado militar y apellido de una figura histórica, resuelto a un diputado (2 errores: n.º 3 y 34)

- «el General Escobar, Comandante de las huestes revolucionarias», en el relato de la revolución de 1873, se atribuye a Oscar Escobar Pedotti, diputado en 2008-2013 (n.º 3).
- «el Capitán Báez», caído en Yataity Corá contra las tropas aliadas, se atribuye a Derlis Manuel Rodríguez Báez, diputado desde 2023 (n.º 34).
- Fuera de la muestra: «General Caballero» (Bernardino Caballero) va 3 veces a Juan Caballero Araujo, y «General Oviedo» (Lino Oviedo) va 2 veces a César Ariel Oviedo Verdún.

**Regla.**

- Los grados militares (general, coronel, capitán, teniente, mayor, mariscal) son `descriptivo` y se resuelven como un tratamiento, por lo que basta el apellido. Con un grado, exigir el nombre completo (fuerza 3) para resolver a un miembro; si no, dejar la mención como persona externa.
- Añadir a los `historicos` de PY las figuras que el corpus cita con grado: Bernardino Caballero, Lino César Oviedo (con «general»), el mariscal López, el general Díaz, Francia…

### 3. Cadenas que no son nombres de persona detrás de una forma (3 errores: n.º 21, 24 y 30)

- «señor Preszdente» es un error de OCR de «Presidente» (n.º 21).
- «Técnica y Cultural» sale de «Convenio General Básico de Cooperación Científica, Técnica y Cultural» (n.º 24). La regla de cargo + institución + coma (`RX_INST`) toma «General» por grado y acepta el nombre porque tiene dos palabras que no están en `noPersona`.
- «DELEGADA PARA EL ESTUDIO Y» sale de un título en mayúsculas (n.º 30): en mayúsculas, «PARA» pasa por palabra con mayúscula.

**Regla.**

- Tratar como forma, y no como nombre, una palabra a distancia de edición 1 de una forma larga («Preszdente», «Presidentc»).
- Rechazar los nombres que empiezan por preposición, conjunción o artículo en cualquier caja («para», «por», «con», «sin», «que», «el», «la»).
- En los tramos en mayúsculas (títulos de proyectos y resoluciones), aceptar solo nombres cuyas palabras sean nombres o apellidos de la lista de oradores.
- En `RX_INST`, exigir que el nombre empiece por un nombre de pila conocido o por un apellido de oradores; no basta con dos palabras fuera de `noPersona`.
- No tomar «General» como forma cuando califica al sustantivo anterior («Convenio General», «Secretario General», «Asamblea General», «Director General»).
- Añadir a `noPersona` palabras como «técnica», «científica», «cultural», «cooperación», «estudio» y «consideración».

### 4. Nombre de pila solo, resuelto por desempate (1 error: n.º 6)

En una votación nominal, «DIPUTADO DARIO ]J. URQUHART No.» (Darío J. Urquhart, que no está en `oradores.json`) queda cortado en «DIPUTADO DARIO» por el signo de OCR. Se resuelve por «preside» a Juan Darío Monges, que en la misma votación figura aparte. Fuera de la muestra hay otras cuatro menciones de un nombre de pila solo resueltas por «preside»: «Diputado Benjamín», «Diputado Atilio», «señor José» y «DIPUTADO GUSTAVO». No se revisaron.

**Regla.** Cuando el nombre es una sola palabra que solo coincide con el nombre de pila (fuerza 1), no aplicar los desempates por «preside» ni por «actividad». Solo valdría el vocativo con quien habla en la sesión. Además, quitar los signos de OCR («]», «|») dentro del nombre antes de separarlo en palabras.

### 5. Clave de persona externa que une dos nombres (1 error: n.º 39; origen de los n.º 22 y 44)

El corte en «y» solo se hace si lo que sigue es un nombre de pila de al menos dos oradores (`esPila`). «Antibia» no lo es, así que «Capitán Vicente A. Matiauda y Antibia Matiauda» queda como una sola clave, «vicente a matiauda antibia matiauda».

Esa clave reúne 29 menciones, casi todas del Capitán Vicente A. Matiauda (figura de la época del Dr. Francia), bajo el nombre «Vicente A. Matiauda y Antibia Matiauda». El apellido suelto del n.º 39, que sí se refiere a él, va a ese nodo mal nombrado. Mientras tanto, «Capitán Vicente Matiauda» forma otro nodo distinto (n.º 26).

**Regla.**

- Cortar en «y/e» también cuando sigue una palabra con mayúscula y el apellido se repite a ambos lados («Matiauda y Antibia Matiauda»).
- Más en general, ampliar `esPila` con una lista de nombres de pila que no dependa de los oradores.

### 6. Apellido suelto de una persona externa aplicado a otra persona de otra época (1 error: n.º 38)

El nodo «alderete» se formó con menciones de 2009 a Alberto Alderete, presidente del INDERT. En 2019, a propósito de Itaipú, «Alderete» es José Alberto Alderete, director paraguayo de Itaipú en 2018-2019, que es otra persona. Fuentes: <https://es.wikipedia.org/wiki/José_Alberto_Alderete> y <https://www.lanueva.com/nota/2009-10-23-18-35-0-pese-a-ofensiva-opositora-lugo-prometio-reforma-agraria>.

**Regla.** Para las personas externas que no son jefes de Estado ni figuras históricas, buscar el apellido suelto solo en las legislaturas (o sesiones) donde la persona tiene menciones con cargo.

### 7. «Antiguo miembro» con escaño posterior (transversal: los 5 de la categoría, n.º 31 a 35, ya contados en los patrones 1 y 2)

Hugo Joel Meza y Derlis Manuel Rodríguez Báez solo tienen escaño en 2023-2028, pero se les atribuyen menciones de 1989 a 2000. `resolver` devuelve «otra legislatura» con cualquier legislatura, anterior o posterior a la fecha. Como no tienen escaño en ninguna legislatura de la biblioteca, las menciones acaban como «externa, antiguo miembro».

**Regla.** En «otra legislatura» y en «tuvo escaño», aceptar solo legislaturas anteriores a la fecha de la mención. Una legislatura posterior solo con el nombre completo (fuerza 3), y entonces no marcarla como «antiguo».

## Otras observaciones (no cuentan como error de identidad)

- **n.º 29, «Ministro Durand».** La rama de cargos de gobierno (`deGobierno`) crea la persona externa «durand» sin mirar si es un antiguo miembro. Dany Durand fue diputado en 2013-2018 (DURAND ESPÍNOLA en `oradores.json`), así que queda en dos nodos. **Regla:** en esa rama, si el nombre resuelve con fuerza 2 o más a un único antiguo miembro (`tuvoEscano`), enlazarlo como antiguo.
- **n.º 19.** El turno etiquetado «SEÑOR. — PRESIDENTE» no se reconoce como de la Presidencia, porque `RX_MESA` no admite puntuación entre «señor» y «presidente», y su «Tiene la palabra el Diputado Vasconsellos» cuenta como mención. **Regla:** quitar los signos de la etiqueta antes de aplicar `RX_MESA`.
- **Marca de vocativo.** Sale en finales de enumeración (n.º 14, «y Blas A. Llano.») y en el n.º 19. **Regla:** no marcar vocativo si la mención cierra una enumeración con «y».
- **Nodos duplicados.** El Capitán Vicente Matiauda queda en dos nodos (n.º 26 y 39), igual que Dany Durand.

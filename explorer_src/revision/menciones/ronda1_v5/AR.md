# Precisión de las menciones: Argentina (Cámara de Diputados de la Nación)

Muestra: `node muestra_precision.cjs paises/AR 10 7`, 10 menciones por categoría. La categoría «miembro por cargo sin nombre» está vacía (AR no tiene cargos sin nombre configurados), así que se revisaron 50 menciones. El detalle está en `AR.json`.

Cada mención se juzgó con su intervención completa en `biblioteca.json`, las filas de alrededor y `oradores.json`. Cuando hizo falta saber quién era alguien, se consultó una fuente, que se cita en el motivo.

## Precisión

| Categoría | Menciones en la salida | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|
| Miembro con tratamiento o cargo | 825 | 8 | 2 | 0 | 80 % |
| Miembro por apellido suelto | 240 | 2 | 8 | 0 | 20 % |
| Miembro por cargo sin nombre | 0 | – | – | – | – |
| Externa con cargo o título | 4.591 | 8 | 2 | 0 | 80 % |
| Externa, antiguo miembro | 58 | 0 | 10 | 0 | 0 % |
| Externa por apellido suelto | 2.433 | 9 | 1 | 0 | 90 % |
| **Total** | | **27** | **23** | **0** | **54 %** |

No hay menciones dudosas. El total no está ponderado por el tamaño de cada categoría, y con 10 casos por categoría el margen de error es amplio. Dos recuentos sobre la salida completa matizan la muestra:

- Las 240 menciones de miembros por apellido suelto se buscaron por el nombre de pila (se explica en el patrón 1). Solo en 48 de ellas el nombre de pila va seguido del apellido del propio miembro, y solo esas pueden ser correctas: como mucho, un 20 %.
- De las 2.433 menciones externas por apellido suelto, 763 son «Aires», de «Buenos Aires» (patrón 4). Ninguna de ellas es una persona, así que la precisión real de esa categoría no pasa del 69 %, aunque en la muestra salga un 90 %.

## Menciones que vienen de anexos

31 de las 50 menciones de la muestra vienen de anexos o de documentos insertos, y no de lo que se habló en el recinto:

- 29 son del anexo de la sesión especial del 25 de septiembre de 1985 sobre la compra de la Italo: el informe de la comisión investigadora (que se lee como una sola intervención de 594.000 caracteres), las versiones taquigráficas de sus audiencias con testigos y los escritos judiciales. Son los números 2, 4, 11 a 15, 17, 19 a 23, 25 a 30, 34, 36, 37, 39, 41 a 44, 49 y 50.
- 2 son listas de firmas de dictámenes metidas dentro de una intervención: los números 16 (2018) y 18 (2005).
- A estas se puede sumar la 31, que viene de la lista de preferencias que lee la Secretaría.

De esa misma sesión de 1985 salen 6.665 de las 8.264 menciones de AR (el 81 %). Por eso la precisión de AR mide sobre todo cómo se comporta el detector en ese anexo. En los anexos acierta en 16 de 31 casos, y en el resto de la muestra en 11 de 19.

## Patrones de error

### 1. Miembros por apellido suelto: se busca el nombre de pila (8 errores)

En AR los nombres de los oradores vienen como «NOMBRE APELLIDO», sin coma. Al formar la palabra que va a buscar, el detector toma `partes[0]`, que en ese orden es el primer nombre de pila. La clave es la correcta (cortese, corzo, araoz…), pero la palabra que busca es «Lorenzo», «Julio» o «Miguel». Así, un mismo «Julio» se atribuye a la vez a Julio César Corzo y a Julio César Aráoz, y un mismo «Miguel» a Srur, a Dovena y a Serralta: 50 de las 177 posiciones con mención tienen más de un miembro asignado.

Ejemplos:
- n.º 11: un alias en clave, «señor "Lorenzo"», se atribuye a Lorenzo J. Cortese.
- n.º 13 y 19: «Julio César Aráoz» se atribuye a Corzo.
- n.º 15: la fecha «9 de Julio de 1816» se atribuye a Aráoz.
- n.º 14 y 17: «Miguel A. Srur» se atribuye a Serralta y «Miguel H Medina» a Dovena.
- n.º 18: «Jorge M. A. Argüello» se atribuye a Vanossi.
- n.º 20: «Julio César Noaco» se atribuye a Aráoz.

Los dos aciertos (12 y 16) son casualidades: el nombre de pila va seguido del apellido del propio miembro.

Regla que lo evitaría: en el bucle de `apMiembro`, cuando el nombre no lleva coma, la forma buscada debe ser la palabra del nombre que corresponde a `apRef(d)`, es decir, el apellido, y no `partes[0]`. El fallo afecta a cualquier país con los nombres sin coma. En UY no aparece, porque los nombres vienen como «APELLIDOS, NOMBRE».

### 2. Diputados en ejercicio tratados como personas externas (6 errores)

Los números 32, 33 y 38 (Bornoroni), 35 (Almirón) y 40 (Strada) son de diciembre de 2025. Los tres tenían escaño e incluso intervienen en esa misma sesión. Salen como «externa, antiguo miembro» porque en las legislaturas 141 a 143 faltan muchos partidos en `oradores.json`: hay 71, 93 y 89 entradas sin partido, frente a 0 a 4 en las demás. Además, `senta()` exige partido cuando el país «tiene partidos».

El n.º 31 (Cettour, julio de 2005) tiene otra causa. Solo tiene una intervención en todo el corpus, en la legislatura 119, y la regla de «intervenciones antes y después» no le alcanza. Sin embargo, la cabecera de esa sesión lo incluye en la nómina de diputados, y ese mismo año firma proyectos como diputado.

En la salida completa, 30 de las 58 «externa, antiguo miembro» son personas cuyas legislaturas abarcan la fecha de la mención.

Reglas que lo evitarían:
- En `senta()`, aceptar como escaño una legislatura con intervenciones aunque falte el partido, al menos cuando falta en buena parte de esa legislatura.
- Usar como prueba de escaño la nómina de diputados de la cabecera de la sesión.
- Con una forma de miembro («diputado», «diputada») y un único orador con ese apellido en legislaturas contiguas, resolver como miembro.

### 3. Apellidos comunes o de otra época resueltos contra un miembro (6 errores)

- n.º 2: «doctor Gómez» es el brigadier Julio A. Gómez, ministro de Justicia entre 1976 y 1978. Se atribuye a Gómez Bull, que solo tuvo escaño entre 2013 y 2017.
- n.º 34, 36 y 39: «almirante Castro», un marino de 1976, se atribuye a Castro Molina, diputado en 2015 y 2016.
- n.º 37: «General San Martín» se atribuye a Adrián San Martín, diputado en 2014. En la salida también aparecen así el Libertador («el general San Martín, el padre de la Nación») y la localidad («partido de General San Martín»).
- n.º 4: «señor Santos», un nombre en clave de los documentos de la Italo, se atribuye al diputado Santos Melón.

En la salida completa, 24 de las 58 «externa, antiguo miembro» son personas que solo tuvieron escaño después de la fecha de la mención.

Reglas que lo evitarían:
- No resolver como «tuvo escaño» ni como «antiguo miembro» a quien solo tuvo escaño después de la fecha, cuando la mención es un apellido solo.
- Tras un grado militar («almirante», «brigadier», «comodoro», «capitán», «general», «coronel») seguido de un apellido solo, dejar la persona externa con la clave del apellido, salvo que haya un miembro con escaño ese día.
- Con un tratamiento genérico («señor», «doctor») y un apellido solo de `comunes` o de `TOP10` (Gómez, Castro, Santos), exigir que ese miembro intervenga en la sesión o que se le nombre en ella con su cargo. Si no, dejar la persona externa con la clave del apellido. Ni Santos Melón, ni Gómez Bull, ni Castro Molina hablan en la sesión de 1985.
- Añadir a José de San Martín a los `historicos` de AR.
- Añadir «partido», «localidad», «ciudad», «barrio» y «villa» a las palabras que, delante de un nombre, indican un lugar y anulan la mención.

### 4. Lugares y palabras que no son personas (2 errores, y el mayor volumen)

- n.º 46: la cabecera de una carta, «CARTA DE CIAE AL DOCTOR JUAN ALEMANN Buenos Aires, 7 de junio de 1976», produce el nodo «JUAN ALEMANN Buenos Aires». De ahí sale «Aires» como apellido suelto, con 763 menciones que son la provincia o la ciudad.
- n.º 24: «la "Señora Libre"» es una alusión irónica, no un nombre.

Reglas que lo evitarían:
- Añadir «aires» y «buenos» a `lugares`.
- Cortar el nombre donde se pasa de mayúsculas a minúsculas iniciales (DOCTOR JUAN ALEMANN | Buenos Aires) o donde aparece un lugar, aunque no vaya detrás de una partícula.
- A los nombres externos de una sola palabra, aplicarles la misma prueba de mayúsculas que a los apellidos sueltos. «libre» aparece casi siempre en minúscula.

### 5. Dos personas fundidas en un nodo (1 error)

- n.º 28: «doctor Martínez de Hoz y Zubarán» genera la clave «martinez hoz zubaran». A esa clave se unen las 369 menciones de «martinez hoz» y las 42 de «Zubarán» suelto, de modo que Martínez de Hoz aparece como «Martínez de Hoz y Zubarán».

Reglas que lo evitarían:
- Cortar en «y/e» también cuando lo que sigue es el apellido de otra persona u orador ya conocido, y no solo cuando es un nombre de pila.
- Al canonizar, no colgar una clave de otra más larga que tenga menos menciones. La clave larga tenía una sola mención.

## Otras observaciones que no se cuentan como error

- Hay nodos duplicados de una misma persona: «alejandro caride» y «alejandro r caride» (n.º 21, 42 y 44), y «miguel padilla» y «miguel tobias padilla» (n.º 25). Se evitarían ignorando las iniciales de las claves y uniendo una clave con otra que la contiene cuando empiezan y terminan igual y la unión no es ambigua.
- Las firmas de dictámenes que van dentro de una intervención (n.º 16 y 18) se cuentan como si las mencionara quien habla.

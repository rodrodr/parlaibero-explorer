# Ecuador (EC), Congreso Nacional y Asamblea Nacional: precisión de las menciones

Muestra de `node muestra_precision.cjs paises/EC 10 7`: diez menciones por categoría. En Ecuador la categoría «miembro, cargo sin nombre (por fecha)» no tiene menciones, así que se juzgan 50. Cada mención se revisó con su intervención completa en `biblioteca.json`, las intervenciones vecinas de la sesión y `oradores.json`. Cuando hizo falta saber quién era alguien, se consultaron fuentes externas, citadas en `EC.json`.

## Precisión

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

| Categoría | Menciones en la salida | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 888 | 9 | 1 | 0 | 90 % |
| Miembro, apellido suelto | 85 | 3 | 7 | 0 | 30 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — |
| Externa, con cargo o título | 632 | 7 | 3 | 0 | 70 % |
| Externa, antiguo miembro | 41 | 0 | 10 | 0 | 0 % |
| Externa, apellido suelto | 24 | 7 | 3 | 0 | 70 % |
| **Total de la muestra** | | **26** | **24** | **0** | **52 %** |

- Con diez casos por categoría los márgenes son amplios: el total es compatible con un 39-65 % (intervalo de Wilson al 95 %).
- Si se pondera por el número de menciones de cada categoría, la precisión estimada es del 77 %. Pesan sobre todo las menciones de miembros con tratamiento o cargo (888) y las externas con cargo (632).

## Patrones de error

### 1. El «apellido suelto» de los miembros es el nombre de pila (7 errores; afecta a toda la categoría)

- Casi todos los errores están en listas de asistencia con el formato «Apellido Nombre, presente»:
  - n.º 11: «Palma Ordóñez Juan» se atribuye a Pons.
  - n.º 13: «Tama Márquez Juan» se atribuye a Castelló.
  - n.º 17: «Cantos Hernández Juan» se atribuye a Pons.
  - n.º 20: «Juan Juan Cordero Cueva» se atribuye a Pons.
  - n.º 12: «Dávila Patricio» se atribuye a Donoso.
  - n.º 16: «Carmigniani César» se atribuye a Rohon.
  - n.º 18: «Vivas Javier» se atribuye a Neira.
- Los tres aciertos lo son por coincidencia:
  - la fila o la firma son de esa persona (n.º 14 y 19);
  - el nombre de pila va seguido de su apellido, como en «Jaime Nebot» (n.º 15).
- Magnitud en toda la salida:
  - las 85 menciones de la categoría son un nombre de pila;
  - 16 posiciones se atribuyen a más de un miembro. El «Juan» de «Tama Márquez Juan» va a la vez a Tama, a Castelló y a Pons.
- Causa: la misma que en Colombia. La forma buscada es `partes[0]` del nombre (línea 569), que en los nombres «NOMBRE APELLIDOS» es el nombre de pila.
- La regla de «antes y después» (línea 205) crea además escaños que no existen:
  - Donoso, con un registro de 1979-1984 de una sola intervención y otros desde 2013, pasa por diputado en 2003-2006.
  - Castelló pasa por diputado en 1998-2003.
- Hay 398 registros de `oradores.json` sin fechas, en 2017-2021, 2021-2023 y 2025-2029. Muchos son de diputados de décadas anteriores; Pons Arízaga, por ejemplo, tiene 484 intervenciones en 2017-2021. También alimentan esa regla.
- Reglas que lo evitarían:
  - buscar la palabra que corresponde a `apRef(d)`, es decir, el primer apellido tras los nombres de pila;
  - rechazar formas que sean nombres de pila;
  - una sola atribución por posición del texto;
  - no deducir escaños de registros sin fecha o de una sola intervención, y limitar la regla a legislaturas contiguas.

### 2. Miembros sin partido en `oradores.json` tratados como antiguos miembros externos (7 errores)

- Casos:
  - n.º 32, 35 y 38: Mariana Obando, diputada 1998-2003.
  - n.º 36 y 39: Antonio Aguilar Chamba, diputado 2003-2006.
  - n.º 40: Vicente Estrada Velásquez, diputado 1998-2003.
  - n.º 37: Paúl Jácome, asambleísta alterno en 2009-2013.
- Todos tienen intervenciones en la legislatura de la mención, pero su registro no tiene partido y `senta` (línea 200) lo exige.
- Magnitud:
  - 1.277 de los 5.030 registros de oradores no tienen partido;
  - 24 de las 41 menciones de la categoría son de personas con registro, sin partido, en la misma legislatura.
- Regla: dar por sentado a quien tiene intervenciones en esa legislatura aunque falte el partido. El partido debería descartar solo registros vacíos o de «identificado».

### 3. «Antiguo miembro» por homonimia, o por un nombre tomado como cargo (3 errores)

- Casos:
  - n.º 31: «señor Líder Góngora» se atribuye a Luis Góngora Zambrano. «Líder» se toma por la forma de cargo «líder», pero es el nombre de Líder Góngora Farías, de la coordinadora del manglar.
  - n.º 33: «ingeniero Juan Aguilar», del fondo de cesantía de la ESPOCH (2025), se atribuye a Juan Pablo Aguilar Andrade, un abogado.
  - n.º 34: «coronel Araujo» se atribuye a Milton Araujo Robayo, orador de 1994-1996. Es Fidel Araujo, preso por el 30-S.
- En los tres casos basta con que coincidan un apellido, o nombre y apellido, con alguien de otra legislatura para enlazarlo.
- Reglas que lo evitarían:
  - para dar a alguien por antiguo miembro, exigir que coincidan el nombre de pila y el primer apellido, o los dos apellidos;
  - con un apellido solo, enlazar únicamente si lo acompaña una forma de miembro («diputado», «exdiputado», «honorable»), nunca con «coronel», «ingeniero» o «señor»;
  - tratar «Líder» con mayúscula ante un apellido como nombre de pila; la forma «líder» solo en minúscula.

### 4. Listas nominales en orden «Apellido Nombre» (2 errores)

- n.º 23: «Honorable Moreira Mario Efrén, presente» sale como persona externa. Es Mario Efrén Moreira Reina, diputado 1998-2003.
- n.º 26: «Honorable Moreno Ruth Aurora» sale como persona externa. Es Ruth Aurora Moreno Agui, diputada 1998-2003.
- Causa: `fuerza` (línea 84) exige el orden nombre de pila + apellidos.
- Magnitud estimada en toda la salida: 103 menciones externas con «honorable» tienen todas sus palabras en el nombre de un miembro de esa legislatura, un 16 % de la categoría.
- Regla: probar también el orden invertido (apellidos + nombre), o aceptar el conjunto de palabras cuando incluya el primer apellido y otra palabra del nombre. Sobre todo en secuencias «Honorable X, presente/ausente».

### 5. Jefe de Estado resuelto como miembro (1 error)

- n.º 1: «el Gobierno del Presidente Durán Ballén» (1994) se atribuye al miembro Sixto Durán Ballén. Era el presidente de la República (1992-1996).
- `oradores.json` le da en 1994-1996 un registro con partido: 94 intervenciones en un solo día, el 1995-09-07. La regla de jefes (línea 300) cede cuando hay un miembro con escaño que tiene ese nombre completo.
- Regla: dentro de las fechas del mandato, «presidente» + apellido del jefe es siempre el jefe de Estado. En esas fechas no se debe buscar un miembro con ese nombre.

### 6. Apellido suelto de un jefe de Estado atribuido sin mirar la fecha (2 errores)

- n.º 46-47: «Noboa tiene que escucharnos» y «Fuera Noboa», ambos de 2025, se atribuyen a Gustavo Noboa. Es Daniel Noboa.
- Causa: al montar los apellidos sueltos (línea 490), el primer jefe de la lista con un apellido se queda con él.
- Regla: resolver el apellido suelto de los jefes por fecha, como ya hace `jefeDe` con «presidente X»: el que ocupa el cargo ese día o, si no, el último anterior.

### 7. Apellido de otra persona (1 error)

- n.º 48: «Señora Licenciada Alba Aguirre de Falconí» (1980) se atribuye a Fander Falconí. Es un apellido de casada.
- Regla: descartar la coincidencia si va precedida de «de» + palabra con mayúscula. En general, descartarla si la precede una palabra con mayúscula que no sea del nombre de esa persona ni una forma de tratamiento.

### 8. Una palabra que no es una persona (1 error)

- n.º 28: «Plan Local de Seguridad Ciudadana Amazónica» genera la persona externa «amazonica». «Ciudadana» se toma por tratamiento.
- Reglas que lo evitarían:
  - «Ciudadano/Ciudadana» con mayúscula tras un sustantivo también con mayúscula forma parte de un nombre propio y no es tratamiento;
  - añadir adjetivos regionales (amazónica, andina, costeña, insular…) a los lugares o a las palabras que no son personas.

## Otras observaciones (no cuentan como error)

- La marca «se dirige» aparece donde no hay vocativo: una cita (n.º 5), la lista de firmantes de un informe (n.º 7) y un informe de comisión (n.º 8).
- Las acotaciones en mayúsculas dentro de un turno cuentan como menciones de quien habla, como «REASUME LA DIRECCIÓN DE LA SESIÓN EL ASAMBLEÍSTA…» (n.º 6).
- Fuera de la muestra, el apellido «Reina» (Moreira Reina) se toma por la forma «reina» y genera la persona externa «Mario Efrén».

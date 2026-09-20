# Menciones en El Salvador (SV): precisión de la versión 6

Muestra: `node muestra_precision6.cjs paises/SV 8 23` sobre `paises/SV/menciones6.json`. Salen hasta 8 menciones por categoría con semilla fija, 40 en total; las categorías «miembro, cargo sin nombre» y «externa, antiguo orador sin escaño» están vacías. Cada mención se juzgó con la intervención completa, los turnos vecinos de la sesión y `oradores.json`, y con una fuente, citada en el motivo, cuando había que saber quién ocupaba un cargo. El veredicto, el motivo y el campo `no_deberia_contar` de cada mención están en `revision6/SV.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 574 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 18 | 8 | 8 | 0 | 0 | 100 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | sin casos |
| Externa, con cargo o título | 852 | 8 | 6 | 2 | 0 | 75 % |
| Externa, antiguo orador sin escaño | 0 | — | — | — | — | sin casos |
| Externa, apellido suelto | 63 | 8 | 8 | 0 | 0 | 100 % |
| Externa, cargo sin nombre (por fecha) | 234 | 8 | 8 | 0 | 0 | 100 % |
| **Total** | 1.741 | 40 | 38 | 2 | 0 | **95 %** |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- Con 8 casos por categoría el margen es amplio: un 8 de 8 es compatible con una precisión real desde el 68 % (intervalo de Wilson al 95 %), y el total, 38 de 40, va del 83 % al 99 %.
- Ponderada por el tamaño de cada categoría en el país, la precisión estimada es del 88 %, porque la categoría con errores («externa, con cargo o título») es la mayor, con 852 menciones.
- La primera revisión (versión 5, otra muestra) dio un 80 %. Se han corregido:
  - Milena Mayorga: es miembro en 2018-2020 y persona externa como embajadora en 2022.
  - «Yamil Bukele» ya no se atribuye a Nayib.
  - «Casa Rey Prendes» ya no es una persona.
  - La doble cuenta del apellido suelto dentro de una mención con cargo.

  Sigue en pie «Señora Santa Ana» (apartado 2).
- «Miembro, cargo sin nombre» está vacía porque ningún jefe de Estado del período tuvo escaño. Las 18 menciones «a la Presidencia» no entran en el muestreo.

## Menciones que no deberían contar

De las 40 menciones, 15 no deberían contar aunque la identidad esté bien; entre ellas, 11 de las 16 de miembro. Es el principal problema que queda en El Salvador.

### Turnos de quien preside que no se detectan (6: n.º 3, 5, 6, 7, 8 y 15; también el n.º 38)

- **2024-2027.** En 6 de las 7 sesiones de esa legislatura no se deduce la Presidencia. Ernesto Castro, presidente de la Asamblea (<https://www.elsalvador.com/h-noticias/h-nacional/inicia-nueva-asamblea-legislativa-con-60-diputaciones/1139587/2024/>), tiene la mitad de los turnos. Pero sus turnos tienen una mediana de entre 417 y 716 caracteres, porque lee la correspondencia y los llamamientos, y la regla exige 400 o menos. De sus turnos en esas sesiones salen 180 menciones, el 10 % de las 1.759 resueltas o externas del país (n.º 3, 6 y 38).
- **Un solo presidente por sesión.** No se detectan los tramos que presiden los vicepresidentes:
  - Yanci Urbina, «presidenta en funciones», el 21-6-2018 (n.º 7, 8 y 15);
  - Alberto Romero el 29-7-2020, cuando la Presidencia deducida es Mario Ponce (n.º 5).

### Llamamientos, quórum y votaciones que leen los secretarios (6: n.º 4, 9, 12, 13, 14 y 28; también el n.º 3)

`C.procedimiento` solo mira el texto anterior a la mención y exige «en sustitución (del|de la)». Pero en los llamamientos de El Salvador:
- el suplente va primero, y sin artículo: «diputada Rebeca Rodríguez en sustitución de diputado Reynaldo Cardoza»;
- o se usa «X sustituye al Diputado Y», o «X por Y» en una lista.

Tampoco se reconocen la comprobación del quórum («Se hacen presente los diputados …, Rodolfo Parker…») ni el resultado de una votación nominal («Con 59 votos es electa la funcionaria María del Carmen Martínez Barahona»).

### Fórmulas y texto normativo en «externa, cargo sin nombre» (3: n.º 37, 38 y 39)

- **n.º 38 y 39.** «la designada por el presidente de la República, encargada de Despacho» es el título de Claudia Rodríguez de Guevara durante la licencia de Bukele. La fórmula da 24 de las 234 menciones de la categoría (febrero a mayo de 2024).
- **n.º 37.** Es un artículo de ley («el presidente de la República deberá emitir el respectivo reglamento»).

### Alcance en el país

Una cota superior: 294 de las 610 menciones de miembro resueltas (48 %) y 160 de las 1.149 externas están en turnos con fórmulas de la Mesa (votación, llamamiento, dar la palabra, incorporación, asistencia). Por orador, sumando miembros y externas: Ernesto Castro 158, Alberto Romero 78, Yanci Urbina 41, Elisa Rosales 31, Cristina Cornejo 30 y Mario Marroquín 25.

### Reglas

- **Deducción de la Presidencia.** Quitar la condición de la longitud mediana cuando quien más habla tiene el 40 % de los turnos o más. O, mejor, reconocer los turnos de la Mesa por sus fórmulas, sea quien sea el orador: «SE CIERRA LA VOTACIÓN», «Someto a consideración», «los que estén de acuerdo», «tiene la palabra», «Se incorpora», «Solicitó la palabra». Y admitir varios presidentes por sesión.
- **`C.procedimiento`.** Mirar también el texto que sigue a la mención en la misma cláusula: «tiene la palabra», «en sustitución de», «sustituye a», y «por» + nombre dentro de una lista de llamamientos. Admitir «de diputado/a» sin artículo y las tildes («Solicitó»).
- **Turnos de la Mesa.** Tratar como tales los que empiezan por «Llamamiento», «ASISTENCIA» o «LISTA DE ASISTENCIA», o contienen «votación nominal».
- **Cargo sin nombre.** Saltar «designada por el presidente de la República» y los artículos de ley («Artículo N. … el presidente de la República deberá…»).

## Errores que quedan, por causa

Hay 2 errores en la muestra. Los casos «fuera de la muestra» se leyeron en `menciones6.json` para ver el alcance de cada causa, pero no cuentan en la tabla.

### 1. Instituciones con nombre de persona (1 error: n.º 18)

«Hospital Nacional General y de Psiquiatría Doctor José Molina Martínez» se toma por la persona «jose molina martinez». `INSTITUCION_ANTES` solo admite, entre el sustantivo y la forma, un «de/del» y un adjetivo; aquí hay cinco palabras. Las 3 menciones de ese nodo son hospitales.

Fuera de la muestra, la misma causa:
- «Hospital Nacional de la Mujer Doctora María Isabel Rodríguez»;
- «Universidad "Doctor José Matías Delgado"»;
- «Escuela de Educación Parvularia Profesora Graciela Flores viuda de Grimaldi»;
- «diploma de maestro Seminario de Brujas», que da la persona «seminario brujas».

**Regla:** admitir entre el sustantivo de institución y la forma hasta unas seis palabras con mayúscula, partículas, «y» y comillas, es decir, el nombre propio entero de la institución.

### 2. Advocaciones y topónimos de santos (1 error: n.º 20)

Es el error del n.º 27 de la primera revisión. El nodo «santa ana» reúne 3 menciones de la advocación («la Señora Santa Ana, la madre de la Bienaventurada Virgen María», 2019) y 1 de la ciudad («mi querida Santa Ana», 2021). La corrección de la versión 6 (`SANTO_ANTES`, «Nuestra» pegado a la forma) solo alcanza a los apellidos sueltos y a «Nuestra Señora».

**Regla:**
- En las cadenas de formas, descartar los nombres que empiezan por «San», «Santa», «Santo» o «Virgen».
- «Señora» seguida de un santo es una advocación.
- Añadir a `lugares` Santa Ana, San Salvador, San Miguel, Santa Tecla y San Vicente.

### Otros errores vistos fuera de la muestra (no cuentan en la tabla)

- **«Diputado/a secretario/a X», persona externa (7).** Son diputados con escaño, secretarios de una comisión, a los que quien preside pide que lean un informe o un dictamen. Por ser turnos de la Presidencia tampoco deberían contar.
  - «diputado secretario José Serafín Orantes», «Bladimir Barahona» (2), «Suni Cedillos», «Rodrigo Javier Ayala» y «Ana Magdalena Figueroa», en 2021;
  - «Ricardo Avilés» en 2018, en el mismo punto que el n.º 15, de modo que Ricardo Velásquez Parker cuenta dos veces.

  La rama de cargos de gobierno (`deGobierno`) toma «secretario» por un cargo del Gobierno y, si el nombre no es completo (fuerza 3), crea una persona externa.
  **Regla:** si la cadena lleva una forma de miembro («diputado/a»), saltar esa rama; «secretario» tras «diputado» es un puesto de la cámara.
- **«Diputada Suplente Reina Villalta», persona externa «villalta».** Reina Guadalupe Villalta (FMLN) tiene fila en 2018-2021, pero su nombre de pila «Reina» se toma por la forma externa «reina».
  **Regla:** añadir «reina» a `NOMBRE_O_FORMA` cuando sigue a otra forma y va delante de una palabra con mayúscula.

## Nodos partidos (no son errores de identidad)

- **Nayib Bukele está en cuatro nodos:** «nayib bukele» (390 menciones), «nayib armando bukele ortez» (15, entre ellas el n.º 27), «nayib bukeleestamos» y «nayib bukelenos» (1 cada uno; palabras pegadas en la transcripción). Pasa lo siguiente:
  - «Nayib» no está en el léxico de nombres de pila, así que `refDe` lo toma por el apellido de las claves largas.
  - El apellido suelto «nayib» se prueba antes que «bukele», y se lleva «Nayib Bukele» al nodo largo.
  - La unión de claves solo junta principios y finales.

  **Regla:**
  - Añadir Nayib, Yamil, Edelmira y Michelle a `nombres_pila.json`, o tomar por nombre de pila la primera palabra de las claves de tres palabras o más.
  - Unir al jefe de Estado toda clave que contenga su nombre como subsecuencia (nayib … bukele …).
  - Separar las palabras pegadas con la lista de apellidos.
- **Yamil Bukele está en 2 nodos (n.º 22), Michelle Sol en 3 (n.º 23) y Óscar López Jerez en 2.**
- **«Edelmira» se busca como apellido suelto (n.º 26).** Esta vez acierta.

## Datos

Donato Vaquerano sigue con dos `id_dep` (SV00075 y SV00098).

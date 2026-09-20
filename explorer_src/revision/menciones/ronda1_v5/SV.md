# Menciones en El Salvador (SV): revisión de la precisión

Muestra: `node muestra_precision.cjs paises/SV 10 7` sobre `paises/SV/menciones.json`. Salen hasta 10 menciones por categoría con semilla fija, 44 en total. Cada una se juzgó a mano con la intervención completa, los turnos vecinos de la sesión y `oradores.json`. El veredicto y el motivo de cada mención están en `revision/SV.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 1.086 | 10 | 10 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 19 | 10 | 10 | 0 | 0 | 100 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | sin casos |
| Externa, con cargo o título | 1.144 | 10 | 8 | 2 | 0 | 80 % |
| Externa, antiguo miembro | 4 | 4 | 0 | 4 | 0 | 0 % |
| Externa, apellido suelto | 91 | 10 | 7 | 3 | 0 | 70 % |
| **Total** | 2.344 | 44 | 35 | 9 | 0 | **80 %** |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- El total da el mismo peso a cada categoría. Ponderada por el tamaño de cada categoría en el país, la precisión estimada es del 89 %. El intervalo de Wilson al 95 % del total va del 65 % al 89 %, y un 10 de 10 es compatible con una precisión real desde el 72 %.
- «Externa, antiguo miembro» solo tiene 4 menciones en el país, así que la muestra es la categoría entera. Las 4 son de la misma diputada en ejercicio (patrón 1).
- «Cargo sin nombre» está vacía porque SV no tiene `cargosSinNombre` en `formas_paises.cjs`.
- Los 10 aciertos de «miembro, apellido suelto» son nombres completos dentro de listas de llamamientos o de firmantes. La palabra vecina distingue bien a Rodolfo Parker Soto de Ricardo Velásquez Parker, y a Francisco García Villatoro de Marcela Villatoro. Solo el n.º 12 («la firma del R. Parker») es una referencia abreviada, y es correcta: la pieza la presentó el grupo del PDC.

## Patrones de error

### 1. «Externos por cargo» se aplica a todas las fechas (4 errores: n.º 31 a 34)

Carmen Milena Mayorga Valera fue diputada de ARENA en 2018-2021, con 81 intervenciones hasta octubre de 2020, y en el n.º 34 habla en el turno siguiente. En 2022 se la menciona dos veces como «embajadora», y eso la mete en el conjunto `externos`. Después, `senta()` devuelve falso para ella en cualquier legislatura, y sus menciones como «Diputada Milena Mayorga» o «mi colega Milena Mayorga» en 2018-2020 quedan como «externa, antiguo miembro». Es toda la categoría del país.

**Regla.** En `senta()`, mirar primero si la persona tiene intervenciones en esa legislatura; si las tiene, tenía escaño. El conjunto `externos` debería excluir solo las legislaturas sin intervenciones, o solo a partir de la fecha de la primera mención con cargo externo.

### 2. «Bukele» con otro nombre de pila (3 errores: n.º 36, 37 y 43)

«Yamil Bukele», presidente del INDES, se atribuye a Nayib Bukele. En todo el país son 15 menciones: 8 de los 22 «Bukele» sueltos, más 7 con cargo («presidente Yamil Bukele», «el presidente del Instituto Nacional de Deportes, Yamil Bukele»). Hay dos causas:

- En la búsqueda de apellidos sueltos (`probar`), la palabra con mayúscula anterior solo bloquea si es un nombre de pila de al menos dos oradores (`esPila`), y «Yamil» no lo es.
- `jefeDe` acepta cualquier nombre que termine en la clave del jefe de Estado. Basta que «Yamil Bukele» termine en «bukele» para que, con la forma «presidente», se atribuya a Nayib.

**Regla.**

- En `jefeDe`, si el nombre lleva palabras delante de la clave, exigir que sean del nombre del jefe de Estado («Nayib», «Nayib Armando»). Si no lo son, no es él.
- En `probar`, ampliar `esPila` con una lista general de nombres de pila, no solo los de los oradores.
- Con ambas reglas, «Yamil Bukele» quedaría como persona externa aparte. Hoy ese nodo ya existe con 2 menciones, y hay otro, «Yamil Alejandro Bukele Pérez», con una.

### 3. Cadenas que no son personas (2 errores: n.º 26 y 27)

- «la Casa Rey Prendes» es un inmueble del centro histórico, y «Rey» es parte del apellido, no el título de «rey», que es una forma externa (n.º 26).
- «Nuestra Señora Santa Ana» es la advocación religiosa, patrona de Santa Ana. El mismo nodo «santa ana» recoge además «mi querida Santa Ana», la ciudad (n.º 27).

**Regla.**

- Añadir «casa» (y «club», «colonia», «residencial», «barrio», «cantón») al filtro de prefijos de institución de `procesar`.
- Tomar «Rey» como forma solo en minúscula o detrás de «el/del».
- Descartar los nombres que empiezan por «San», «Santa» o «Santo», y las formas precedidas de «Nuestra».
- Añadir a `lugares` los topónimos compuestos de SV (Santa Ana, San Salvador, San Miguel, Santa Tecla, San Vicente, La Libertad…).

## Otras observaciones (no cuentan como error de identidad)

### 4. Presidencia deducida

En SV las etiquetas no marcan quién preside, y el detector toma como presidente de la sesión al miembro con más turnos (al menos el 25 %, con mediana de 400 caracteres o menos). Solo descarta sus turnos de menos de 1.500 caracteres. Esto tiene dos consecuencias:

- **Turnos largos del presidente.** Sus turnos largos (lectura de llamamientos, de la agenda, peticiones de lectura) cuentan como menciones. En la muestra, 4 de las 10 menciones de miembro con tratamiento salen de turnos de Mario Ponce López presidiendo: n.º 3, 5, 6 y 7. En todo el país son 341 de las 1.127 menciones de miembro resueltas (30 %).
- **Un solo presidente por sesión.** Quien preside un tramo sin ser el deducido no se detecta. Es el caso de Yanci Urbina en la sesión del 21-6-2018, donde el deducido es Norman Quijano (n.º 9 y 18). Además, en 6 de las 25 sesiones no se deduce presidencia.

Las identidades son correctas, pero son menciones de procedimiento de la Presidencia que en los países con etiqueta se descartan, y que inflan las menciones salientes de quien preside.

**Regla.**

- En los turnos del presidente deducido, descartar las fórmulas de procedimiento sea cual sea la longitud: «se llama al Diputado X», «en sustitución de», «le solicito/solicitaría a la Diputada X que dé lectura», «tiene el uso de la palabra», «se incorpora».
- Admitir un segundo presidente por sesión cuando el turno de otro miembro contiene fórmulas de presidencia («SE CIERRA LA VOTACIÓN», «Sometemos a consideración», «los que estén de acuerdo favor votar»).

### 5. Doble cuenta de apellidos sueltos

32 de las 91 menciones «externa, apellido suelto» caen dentro de una mención ya contada con cargo. En la muestra son los n.º 35, 41 y 44, más los tres de Yamil Bukele. «Presidente de la República, Salvador Sánchez Cerén» cuenta tres veces: con cargo, «Sánchez Cerén» y «Cerén». El filtro `TITULO_ANTES` no lo evita cuando entre el cargo y el nombre hay «de la República,».

**Regla.**

- En la búsqueda de apellidos sueltos, saltar las posiciones que ya cubre una mención detectada. Hoy el conjunto `vistos` solo lo usa `RX_INST` frente a `RX_CADENA`.
- Con apellidos compuestos («sanchez ceren» y «ceren»), probar solo el más largo.

### 6. Fórmula de procedimiento y espacios

En el n.º 4, «en  sustitución  del  diputado  Eduardo  Amaya» lleva dobles espacios y no se descarta, mientras que las fórmulas de la misma lista con un solo espacio sí se descartan. **Regla:** normalizar los espacios de la ventana de 45 caracteres antes de aplicar `C.procedimiento`, o escribir la expresión con `\s+`.

### 7. Nodos partidos de una misma persona

- «delgado montes» y «rodolfo antonio delgado montes»;
- «milena mayorga» (la embajadora en 2022) y «carmen milena mayorga valera»;
- «yamil bukele» y «yamil alejandro bukele perez».

**Regla:** unir la clave corta con la larga cuando la corta es el final de la larga (o el nombre de pila más el final) y aparecen en la misma sesión o legislatura.

### 8. Datos

Donato Eugenio Vaquerano Rivas tiene dos `id_dep` en `oradores.json` (SV00075 y SV00098). El desempate por actividad elige el bueno (n.º 2 y 5), pero conviene corregirlo en origen.

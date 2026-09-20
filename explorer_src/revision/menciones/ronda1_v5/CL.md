# Menciones en Chile (CL): revisión de la precisión

Muestra: `node muestra_precision.cjs paises/CL 10 7` sobre `paises/CL/menciones.json` (1.596 menciones). Hasta 10 por categoría con semilla fija: 40 menciones, juzgadas a mano con la intervención completa, los turnos vecinos de la sesión y `oradores.json`. El veredicto y el motivo de cada una están en `revision/CL.json`.

## Precisión

| Categoría | En el país | Juzgadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| Miembro, con tratamiento o cargo | 759 | 10 | 10 | 0 | 0 | 100 % |
| Miembro, apellido suelto | 57 | 10 | 6 | 4 | 0 | 60 % |
| Miembro, cargo sin nombre (por fecha) | 0 | — | — | — | — | sin casos |
| Externa, con cargo o título | 652 | 10 | 10 | 0 | 0 | 100 % |
| Externa, antiguo miembro | 0 | — | — | — | — | sin casos |
| Externa, apellido suelto | 69 | 10 | 8 | 2 | 0 | 80 % |
| Total | 1.537 | 40 | 34 | 6 | 0 | 85 % |

Precisión = correctas / (correctas + incorrectas). No hubo dudosas.

- El total da el mismo peso a cada categoría. Ponderando por su tamaño en el país, la estimación es del 97,6 %; pero con 10 casos por categoría el margen es amplio: 10 de 10 es compatible con una precisión real desde el 72 % (intervalo de Wilson al 95 %).
- Las dos categorías vacías lo son por diseño: Chile no tiene cargos sin nombre en `formas_paises.cjs`, y quien tuvo escaño en alguna legislatura de la biblioteca se resuelve como miembro con `antiguo: true` (79 menciones «otra legislatura»; una en la muestra, el n.º 4, correcta).
- Los 6 aciertos de «miembro, apellido suelto» son casuales (patrón 1): ese 60 % no mide la regla que se pretendía.

## Patrones de error

### 1. Los apellidos sueltos de miembros se buscan por el nombre de pila (4 errores: n.º 12, 14, 16 y 17)

Las 57 menciones de esta categoría en el país son nombres de pila; ninguna es un apellido: «Juan» 22 (Latorre 9, Letelier 9, Bustos 4), «Jorge» 4, «Marina» 3, «Karim» 3, «Carlos» 3… En la muestra:

- Los errores son topónimos con «San Juan»: «San Juan de la Costa» (n.º 12 y 14: la misma palabra, atribuida a la vez a Latorre y a Bustos), «las calles de San Juan» en Puerto Rico (n.º 16) y «San Juan de la Sierra» (n.º 17).
- Los aciertos son nombres completos dentro de enumeraciones («los diputados señores Gabriel Ascencio, Boris Barrera…», n.º 18). Pasan porque la palabra siguiente sí es del nombre del miembro.

Causa: en `detectar5.cjs`, el bucle `for (const [ap, d] of apMiembro)` toma como forma `partes[0]` cuando el nombre no lleva coma. En CL los nombres son «NOMBRE APELLIDOS», así que `partes[0]` es el nombre de pila. La lista `apMiembro` sí se elige por el apellido (`usoApellido`, `mayusculas(ap)`); lo que falla es la forma que se busca en el texto.

Qué lo evitaría:

- Buscar la palabra del nombre cuyo plegado es `ap`, como ya se hace con las personas externas (`k0`), y no buscar nunca un nombre de pila solo.
- No atribuir una misma aparición a más de un miembro.
- Lugares: descartar la aparición precedida de «San», «Santa», «Santo» o de un nombre común de lugar («calle(s) de», «comuna de», «cementerio»), como ya hace `procesar` con «centro», «hospital», «calle»…
- Aviso: corregido esto, se perderían las menciones de las enumeraciones que hoy se captan por casualidad. Para recuperarlas harían falta formas en plural («diputados», «diputadas», «señores», «señoras», «colegas») que abran una cadena de nombres separados por comas y «y».

### 2. Apellido suelto de una persona externa que ese día era diputado: Viera-Gallo (2 errores: n.º 31 y 35)

José Antonio Viera-Gallo fue diputado de 1990 a 1998 (169 intervenciones en la legislatura 332), senador de 1998 a 2006 y ministro secretario general de la Presidencia de 2007 a 2010 (https://es.wikipedia.org/wiki/José_Antonio_Viera-Gallo). Las dos menciones de 1995 ya estaban bien resueltas como miembro («mi colega José Antonio Viera-Gallo», «El Diputado señor Viera-Gallo»); la pasada de apellidos sueltos añade, por «Gallo», un duplicado como persona externa. En todo el país, 14 de las 25 menciones sueltas de «viera gallo» (las dos de la muestra incluidas) son de 1992 y 1995, cuando tenía escaño. En 2008 el suelto duplica «ministro Viera-Gallo» (n.º 39: correcto, pero la mención cuenta dos veces).

Causas:

- La forma buscada es «Gallo». La clave es «viera gallo» y el nombre visible, «Viera-Gallo», es una sola palabra, así que `k0` no la encuentra y se busca `bonito('gallo')`; el `(?<![\p{L}])` admite el guion delante.
- `TITULO_ANTES` exige un espacio tras cada palabra con mayúscula, y «señor Viera-» no cuenta como tratamiento delante.
- Había un miembro con escaño y ese apellido, pero `usoApellido` solo cuenta las menciones de una palabra iguales a `apRef` («viera»). Con `deMiembro` a 0, la persona externa gana por defecto.

Qué lo evitaría:

- No aceptar una coincidencia cuyo carácter anterior o siguiente sea letra o guion, y buscar enteros los apellidos compuestos («Viera-Gallo», «Viera Gallo»).
- Saltar las posiciones ya cubiertas por una mención de la primera pasada.
- Desempate: si en esa legislatura tiene escaño un miembro con ese apellido y la persona externa no es jefe de Estado ni figura histórica, no atribuir el suelto a la externa (o contar en `usoApellido` también las menciones cuyo nombre es el principio de `d.ap`).

### 3. Menores, sin efecto en el veredicto

- N.º 10: en la lista de asistentes «Errázuriz, don Maximiano» la mención se marca como vocativo («se dirige») por la coma de la lista. Regla: no es vocativo si lo precede «Apellido,» dentro de una enumeración del tipo «Diputados señores X, don Y; Z, don W».
- Fuera de la muestra: «honorable Corporación» sale como persona externa («corporacion»). Regla: añadir «corporacion» a `noPersona`.

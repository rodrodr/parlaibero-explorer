# Precisión de las menciones: Brasil (Câmara dos Deputados)

Muestra: `node muestra_precision.cjs paises/BR 10 7`, con hasta 10 menciones por categoría y semilla 7. Revisé a mano las 34 menciones con la intervención completa, los turnos vecinos de la sesión (`biblioteca.json`) y la lista de oradores (`oradores.json`). El juicio de cada mención está en `BR.json`.

## Precisión

| Categoría | En la salida | Revisadas | Correctas | Incorrectas | Dudosas | Precisión |
|---|---:|---:|---:|---:|---:|---:|
| miembro (con tratamiento o cargo) | 704 | 10 | 9 | 1 | 0 | 90 % |
| miembro (apellido suelto) | 1 | 1 | 1 | 0 | 0 | 100 % |
| miembro (cargo sin nombre, por fecha) | 0 | 0 | – | – | – | – |
| externa (con cargo o título) | 1036 | 10 | 10 | 0 | 0 | 100 % |
| externa (antiguo miembro) | 3 | 3 | 3 | 0 | 0 | 100 % |
| externa (apellido suelto) | 370 | 10 | 10 | 0 | 0 | 100 % |
| **Total de la muestra** | 2114 | 34 | 33 | 1 | 0 | **97 %** |

La precisión es correctas / (correctas + incorrectas). No hubo dudosas. Ponderada por el tamaño de cada categoría en la salida, la estimación también es del 97 %. Con 10 casos por categoría, una sola mención mueve la cifra 10 puntos. La categoría de cargo sin nombre está vacía en la salida de Brasil.

La muestra de apellidos sueltos de personas externas solo contiene a Lula, Jair Bolsonaro, Dilma Rousseff y Alexandre de Moraes, que suman 312 de las 370 menciones. Las 58 restantes no entran en la precisión medida; las comento más abajo.

## Patrones de error

### 1. Un título descriptivo con un solo nombre se resuelve como diputado (el único error de la muestra)

- N.º 6 (2015, habla Paes Landim): «General Leônidas» se atribuye a LEÔNIDAS CRISTINO. Es el general Leônidas Pires Gonçalves, ministro del Ejército con Sarney. La misma intervención lo nombra completo dos veces y esas dos menciones sí salen como persona externa. Las dos abreviadas que vienen después se atribuyen al diputado del PDT-CE, que coincide solo en el nombre de pila (fuerza 1) y es el único con escaño que lo lleva.

Revisé también, fuera de la muestra, las 18 menciones de miembro de toda la salida que empiezan por un título descriptivo (general, coronel, comandante, bispo…). Al menos 10 son de otra persona o de un lugar:
- «o Governo do General Figueiredo», que es el presidente João Figueiredo, sale como André Figueiredo;
- «Comandante Rolim», el fundador de TAM, sale como Eliane Rolim (2 menciones);
- «Comandante Paulo, da ASPAR da Marinha» sale como Pedro Paulo;
- «Coronel Freitas», un municipio de Santa Catarina que aparece en una lista con Chapecó y Maravilha, sale como Aelton Freitas (4 menciones);
- las 2 de «General Leônidas».

Reglas que lo evitarían:
- **Formas.** Con una forma descriptiva (general, coronel, comandante, almirante, bispo, pastor), resolver como miembro solo con fuerza ≥ 2 o cuando el nombre parlamentario del diputado lleva ese título («General Peternelli», «Coronel Fraga», «General Girão»). En los demás casos, persona externa.
- **Desempate por la propia intervención.** Una mención corta hereda la resolución de una anterior más larga de la misma intervención con el mismo título y el mismo primer nombre: «General Leônidas» sigue a «General Leônidas Pires Gonçalves», que es externa.
- **Lugares.** Añadir a los lugares de Brasil los municipios cuyo nombre empieza por un título: Coronel Freitas, Presidente Prudente, Governador Valadares, Marechal Deodoro, Presidente Figueiredo. También sirve descartar la cadena cuando va detrás de «cidade de», «Município de» o de una enumeración de municipios.

### 2. Fuera de la muestra: apellidos sueltos de personas externas

Estos casos no cuentan en la precisión, pero salen al leer las 58 menciones de la cola:
- «Fundação Getúlio Vargas» se atribuye a Getúlio Vargas 4 veces. Es una institución. Regla: descartar el apellido suelto cuando lo precede una palabra de institución (fundação, instituto, escola, universidade, avenida, rua, praça, hospital, prêmio), aunque haya un nombre de pila en medio.
- «Wagner Soares Padilha», secretario general de la Mesa, se atribuye a Alexandre Padilha. Regla: si delante va una palabra con mayúscula que no es del nombre de esa persona ni una forma de tratamiento, se trata de otra persona. Hoy solo se descarta si esa palabra es un nombre de pila.
- «Getúlio Vargas» cuenta dos veces, una por «Getúlio» y otra por «Vargas». No es un error de identidad, pero duplica la mención. Regla: una sola mención por tramo de texto cuando dos claves sueltas de la misma persona van seguidas.

## Observaciones que no cuentan como error

- **N.º 13.** «Ministro da Justiça, Eduardo Cardoso» es José Eduardo Cardozo, que no tenía escaño en 2013. Está bien como persona externa, pero la clave conserva la grafía de la fuente y no se enlaza con su nodo de diputado de las legislaturas 52.ª y 53.ª. Comparar los apellidos igualando s/z (Cardoso/Cardozo, Souza/Sousa, Luiz/Luís) permitiría marcarlo como antiguo miembro.
- **N.º 14.** En «Presidente Aristides» (Aristides Veras dos Santos, presidente de la CONTAG) la clave es solo el nombre de pila, «aristides», y juntaría a cualquier otro Aristides citado con cargo. Regla: no crear personas externas con un solo nombre de pila, o añadir a la clave el cargo o la institución que lo acompañan («presidente da CONTAG»).
- **N.º 8.** «ex-Deputado Roberto Jefferson» sale como miembro con la marca de antiguo: tuvo escaño en la 52.ª y no lo tenía en 2022. Es el comportamiento previsto.

## Fuentes consultadas

- Aristides Santos, elegido presidente de la CONTAG para 2017-2021: https://www.fetagrs.org.br/?p=43556
- En los demás casos bastó el propio texto de la sesión, que nombra a la persona y su cargo, junto con `oradores.json`.

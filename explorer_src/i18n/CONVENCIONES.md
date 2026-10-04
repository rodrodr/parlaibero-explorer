# Lengua de la interfaz: convenciones

El explorador habla español (por defecto), inglés y portugués de Brasil. El texto fuente es el español y hace de
clave: `__('Buscar')` devuelve `Search` en inglés. Los diccionarios son `i18n/en.json` e `i18n/pt.json`
(`{"español": "traducción"}`); lo que falte en ellos sale en español. `i18n/i18n.js` define `__()` y `N_()` y va,
igual, en la página (antes que los demás módulos) y en el worker (detrás de SQLite).

```bash
python3 explorer_src/tools/i18n.py                 # claves y lo que falta en cada diccionario
python3 explorer_src/tools/i18n.py --faltan        # i18n/trabajo/faltan_<lengua>.json para traducir
python3 explorer_src/tools/i18n.py --revisar --pendientes page/21_app.js   # un archivo: errores y literales sin envolver
python3 explorer_src/tools/i18n.py --podar         # quita de los diccionarios las claves que ya no existen
```

## Qué se envuelve

Todo lo que una persona lee: texto que entra en el DOM, `title`, `aria-label`, `placeholder`, avisos (`toast`),
confirmaciones, mensajes de error que se muestran, rótulos de gráficos SVG, la ayuda, y la prosa de las
exportaciones (encabezados de Markdown, notas).

## Qué no se envuelve

- Identificadores y valores con los que el código decide: `speaker === 'SUMARIO'`, claves de objetos, clases CSS,
  `data-*`, rutas `/api/...`, claves de `localStorage`, SQL, expresiones regulares, sintaxis de consulta.
- Lo que analiza el corpus (formas de tratamiento, acotaciones, palabras vacías, patrones del Diario): el corpus
  sigue en su lengua aunque la interfaz cambie.
- Los nombres de columna de las exportaciones CSV/JSON (son un esquema; los scripts del investigador dependen de él).
- Los mensajes de `console.*` para quien depura.
- Nombres propios (ParlaIbero, SQLite, Harvard Dataverse) cuando van solos.

## Cómo

- **Huecos, nunca `${}` dentro de la clave**: `__('{0} intervenciones', nf(n))`. La clave es un literal (`'…'`,
  `"…"` o `` `…` `` sin `${}`); el extractor lo comprueba. Hasta diez huecos: `{0}` … `{9}`.
- **Frases enteras**: no se pega `'de ' + x + ' a ' + y`; se escribe `__('de {0} a {1}', x, y)`, porque el orden de
  las palabras cambia de una lengua a otra. Los plurales, con dos claves completas:
  `n === 1 ? __('{0} intervención', nf(n)) : __('{0} intervenciones', nf(n))`.
- **Marcado dentro de la frase**: se admite `<b>`, `<i>`, `<kbd>`, `<br>` sin atributos; lo demás (enlaces, valores
  calculados, `<span class="…">`) va en un hueco.
- **Constantes**: en la página, `__()` se puede llamar al cargar el módulo (la lengua se fija antes). **En el worker,
  nunca al cargar el módulo**: la lengua llega con el mensaje `iniciar`. Allí se marca con `N_('…')` y se traduce al
  usarla: `__(MENSAJE)`.
- **Valores que vienen de datos** (etiquetas que devuelve el worker, `label`/`desc` de los hitos, etiquetas de
  `kinds`, nombres de país): se traducen al mostrarlos, `__(h.label)`. Si el valor nace en un literal JS, se marca
  allí con `N_()` para que el extractor lo encuentre. Si la página compara ese valor, el worker lo deja en español y
  la página lo traduce solo al pintarlo.
- **Cifras y fechas**: `__.num(v, opciones)` en lugar de `toLocaleString('es-ES', opciones)` o
  `Intl.NumberFormat('es-ES')`; `__.dec(v)` en lugar de `.replace('.', ',')`; `__.mes(m)` / `__.mes(m, true)` en
  lugar de listas de meses; `__.fecha(iso)` para «4 de octubre de 2026». `__.lengua` (`es`, `en`, `pt`) y
  `__.locale` para lo demás.
- **HTML estático** (`html/body.html`): no hace falta tocarlo; `__.dom()` traduce al arrancar los nodos de texto y los
  atributos. Un párrafo con `<b>` dentro lleva `data-i18n` y se traduce entero. Lo que no debe traducirse lleva
  `translate="no"` (y `pre`, `code`, `kbd` se saltan siempre).
- **CSS** con `content: '…'`: se repite la regla bajo `:root[lang="en"]` y `:root[lang="pt-BR"]`.

## Cambiar de lengua

Ajustes → Lengua, o los botones ES · EN · PT de la pantalla de inicio. Se guarda en `localStorage`
(`diarios-explorer:v1:lengua`) y la página se recarga; la base recordada se vuelve a abrir sola. `?lang=en` en la
URL fuerza una lengua (y la guarda). Mientras se construye la base no se recarga: se aplica la próxima vez.

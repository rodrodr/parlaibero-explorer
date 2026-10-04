#!/usr/bin/env python3
"""Claves de traducción de la interfaz: las extrae de las fuentes y dice qué falta en cada diccionario.

Uso:  python3 tools/i18n.py            # informe: claves, faltan y sobran por lengua
      python3 tools/i18n.py --faltan   # además escribe i18n/trabajo/faltan_<lengua>.json ({clave: ""}) para traducir
      python3 tools/i18n.py --revisar [--pendientes] archivo.js…   # comprueba archivos sueltos
      python3 tools/i18n.py --podar    # quita de i18n/<lengua>.json las claves que ya no están en las fuentes

Fuentes de claves (el texto en español es la clave, con los espacios plegados):
  - page/*.js, worker/*.js, web/*.js: llamadas __('…') y N_('…') con un literal (comillas simples, dobles o
    plantilla sin ${…}); un __(`…${x}…`) es un error: los valores van en huecos {0}, {1}…
  - html/head_top.html y html/body.html: nodos de texto (salvo pre, script, style, code, kbd, textarea y lo que
    lleve translate="no"), los atributos title, placeholder, aria-label y alt, y el innerHTML entero de los
    elementos con data-i18n;
  - datos/hitos_parlaibero.json: label y desc de cada hito y las etiquetas de kinds;
  - i18n/claves_extra.json: textos de interfaz guardados como datos (R2.gen.constantes) que el código traduce al usarlos.
"""
import html, html.parser, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LENGUAS = ('en', 'pt')

plegar = lambda s: re.sub(r'\s+', ' ', s).strip()
ESCAPES = {'n': '\n', 't': '\t', 'r': '\r', 'b': '\b', 'f': '\f', 'v': '\v', '0': '\0'}


def literal(src, i):
    """Lee el literal JS que empieza en src[i]; devuelve (texto, fin) o (None, motivo)."""
    q = src[i]
    if q not in '\'"`':
        return None, 'dinamica'
    out, j = [], i + 1
    while j < len(src):
        c = src[j]
        if c == '\\':
            n = src[j + 1]
            if n == 'u':
                if src[j + 2] == '{':
                    k = src.index('}', j)
                    out.append(chr(int(src[j + 3:k], 16))); j = k + 1
                else:
                    out.append(chr(int(src[j + 2:j + 6], 16))); j += 6
                continue
            if n == 'x':
                out.append(chr(int(src[j + 2:j + 4], 16))); j += 4
                continue
            if n == '\n':
                j += 2
                continue
            out.append(ESCAPES.get(n, n)); j += 2
            continue
        if q == '`' and c == '$' and src[j + 1] == '{':
            return None, 'interpolada'
        if c == q:
            return ''.join(out), j + 1
        if c == '\n' and q != '`':
            return None, 'sin cerrar'
        out.append(c); j += 1
    return None, 'sin cerrar'


RE_LLAMADA = re.compile(r'(?<![\w$.])(__|N_)\(\s*')


def claves_js(rel, claves, errores):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        src = f.read()
    for m in RE_LLAMADA.finditer(src):
        texto, fin = literal(src, m.end())
        linea = src.count('\n', 0, m.start()) + 1
        if texto is None:
            if fin == 'interpolada':
                errores.append(f'{rel}:{linea}: {m.group(1)}() con ${{…}} dentro: use huecos {{0}}')
            elif fin == 'sin cerrar':
                errores.append(f'{rel}:{linea}: literal sin cerrar')
            elif m.group(1) == 'N_':
                errores.append(f'{rel}:{linea}: N_() sin literal')
            continue
        k = plegar(texto)
        if k:
            claves.setdefault(k, set()).add(f'{rel}:{linea}')


SALTAR = {'pre', 'script', 'style', 'code', 'kbd', 'textarea'}
VACIOS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
ATRIBUTOS = ('title', 'placeholder', 'aria-label', 'alt')


def serializa_texto(s):
    return s.replace('&', '&amp;').replace('\xa0', '&nbsp;').replace('<', '&lt;').replace('>', '&gt;')


def serializa_attr(v):
    return v.replace('&', '&amp;').replace('\xa0', '&nbsp;').replace('"', '&quot;')


class Html(html.parser.HTMLParser):
    """Recoge las claves de un HTML estático como las verá i18n.dom() en el navegador."""

    def __init__(self, rel, claves):
        super().__init__(convert_charrefs=True)
        self.rel, self.claves = rel, claves
        self.pila = []          # (etiqueta, salta, es_i18n)
        self.capturas = []      # innerHTML en curso de los data-i18n abiertos: [profundidad, partes]

    def anota(self, texto):
        k = plegar(texto)
        if k and re.search(r'[^\W\d_]', k):
            self.claves.setdefault(k, set()).add(f'{self.rel}:{self.getpos()[0]}')

    def saltando(self):
        return any(s for _, s, _ in self.pila)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for c in self.capturas:
            ser = ''.join(f' {n}' if v is None else f' {n}="{serializa_attr(v)}"' for n, v in attrs)
            c[1].append(f'<{tag}{ser}>')
        salta = tag in SALTAR or a.get('translate') == 'no'
        if not self.saltando() and not self.capturas:
            for at in ATRIBUTOS:
                if a.get(at):
                    self.anota(a[at])
        if tag in VACIOS:
            return
        es_i18n = 'data-i18n' in a
        self.pila.append((tag, salta, es_i18n))
        if es_i18n:
            self.capturas.append([len(self.pila), []])

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag in VACIOS:
            return
        while self.pila:
            t, _, es_i18n = self.pila.pop()
            if es_i18n:
                prof, partes = self.capturas.pop()
                self.anota(''.join(partes))
            for c in self.capturas:
                c[1].append(f'</{t}>')
            if t == tag:
                break

    def handle_data(self, data):
        for c in self.capturas:
            c[1].append(serializa_texto(data))
        if self.capturas or self.saltando():
            return
        self.anota(data)


def claves_html(rel, claves):
    p = Html(rel, claves)
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        p.feed(f.read())
    p.close()


def claves_hitos(claves):
    ruta = os.path.join(ROOT, 'datos', 'hitos_parlaibero.json')
    if not os.path.exists(ruta):
        return
    with open(ruta, encoding='utf-8') as f:
        h = json.load(f)
    for etq in (h.get('kinds') or {}).values():
        claves.setdefault(plegar(etq), set()).add('datos/hitos_parlaibero.json:kinds')
    for pais, p in (h.get('paises') or {}).items():
        for x in p.get('hitos') or []:
            for campo in ('label', 'desc'):
                if x.get(campo):
                    claves.setdefault(plegar(x[campo]), set()).add(f'datos/hitos_parlaibero.json:{x["id"]}')


def extraer():
    claves, errores = {}, []
    for sub in ('page', 'worker', 'web'):
        d = os.path.join(ROOT, sub)
        for n in sorted(os.listdir(d)):
            if n.endswith('.js'):
                claves_js(f'{sub}/{n}', claves, errores)
    for rel in ('html/head_top.html', 'html/body.html'):
        claves_html(rel, claves)
    claves_hitos(claves)
    # textos de interfaz que viven en datos (worker/14_engine__generated__constantes.js) y se traducen al usarlos
    ruta = os.path.join(ROOT, 'i18n', 'claves_extra.json')
    if os.path.exists(ruta):
        with open(ruta, encoding='utf-8') as f:
            for k in json.load(f):
                claves.setdefault(plegar(k), set()).add('i18n/claves_extra.json')
    return claves, errores


def huecos(s):
    return sorted(set(re.findall(r'\{\d\}', s)))


def diccionario(lengua):
    ruta = os.path.join(ROOT, 'i18n', f'{lengua}.json')
    if not os.path.exists(ruta):
        return {}
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def guardar(ruta, d):
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


RE_LITERAL = re.compile(r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`")
RE_ESPANOL = re.compile(r"[áéíóúñÁÉÍÓÚÑ¿¡«»]|\b(?:el|la|los|las|de|del|en|un|una|que|con|por|para|sin|se|no|sí|y|o|es|al)\b", re.I)


def revisar(rutas):
    """Para trabajar archivo a archivo: errores de las llamadas __()/N_(), claves halladas y literales con pinta de
    español que no van dentro de __() ni de N_() en esa línea (heurístico: revise cada uno a mano)."""
    total = 0
    for ruta in rutas:
        claves, errores = {}, []
        rel = os.path.relpath(os.path.abspath(ruta), ROOT)
        claves_js(rel, claves, errores)
        for e in errores:
            print('ERROR', e)
        print(f'{ruta}: {len(claves)} claves, {len(errores)} errores')
        total += len(errores)
        if '--pendientes' in sys.argv:
            with open(ruta, encoding='utf-8') as f:
                for n, linea in enumerate(f, 1):
                    t = linea.strip()
                    if t.startswith(('//', '*', '/*')) or 'console.' in t:
                        continue
                    for m in RE_LITERAL.finditer(linea):
                        lit = m.group(0)[1:-1]
                        if not re.search(r'[^\W\d_]{3,}', lit) or not RE_ESPANOL.search(lit):
                            continue
                        antes = linea[:m.start()]
                        if re.search(r'(?:__|N_)\(\s*$', antes):
                            continue
                        print(f'   {ruta}:{n}: {lit[:90]}')
    return 1 if total else 0


def main():
    if '--revisar' in sys.argv:
        return revisar([a for a in sys.argv[1:] if not a.startswith('--')])
    claves, errores = extraer()
    for e in errores:
        print('ERROR', e)
    print(f'{len(claves)} claves')
    for lengua in LENGUAS:
        d = diccionario(lengua)
        faltan = sorted(k for k in claves if not d.get(k))
        sobran = sorted(k for k in d if k not in claves)
        malos = sorted(k for k in claves if d.get(k) and huecos(k) != huecos(d[k]))
        print(f'{lengua}: {len(claves) - len(faltan)} traducidas · faltan {len(faltan)} · sobran {len(sobran)} · huecos distintos {len(malos)}')
        for k in malos[:20]:
            print(f'   huecos: {k[:80]!r} → {d[k][:80]!r}')
        if '--faltan' in sys.argv:
            os.makedirs(os.path.join(ROOT, 'i18n', 'trabajo'), exist_ok=True)
            guardar(os.path.join(ROOT, 'i18n', 'trabajo', f'faltan_{lengua}.json'), {k: '' for k in faltan})
        if '--podar' in sys.argv and sobran:
            guardar(os.path.join(ROOT, 'i18n', f'{lengua}.json'), {k: v for k, v in d.items() if k in claves})
    if '--lista' in sys.argv:
        os.makedirs(os.path.join(ROOT, 'i18n', 'trabajo'), exist_ok=True)
        guardar(os.path.join(ROOT, 'i18n', 'trabajo', 'claves.json'), {k: sorted(v) for k, v in sorted(claves.items())})
    return 1 if errores else 0


if __name__ == '__main__':
    sys.exit(main())

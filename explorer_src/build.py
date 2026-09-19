#!/usr/bin/env python3
"""Ensambla el explorador a partir de explorer_src/: el HTML standalone y la edición web (GitHub Pages).

Uso:  python3 build.py [salida.html] [--web DIR | --sin-web]
Por defecto escribe ../Diarios_Explorer.html (standalone) y la carpeta ../docs/ (edición web: index.html, app.css,
app.js, worker.js, sqlite3.wasm, capitales/*.svg, sw.js). Las dos salidas salen de las mismas fuentes y comparten
build_id: cualquier cambio en explorer_src/ afecta a ambas al reensamblar.

Estructura del HTML resultante (misma que la plantilla original 2REP Standalone):
  html/head_top.html + <script>page/00_*</script> + <style>css/*</style> + </head>
  html/body.html (marcado de la aplicación)
  <script type="application/json" id="r2-datos">datos/page_datos.json</script>
  blobs gzip+base64: wasm (vendor/sqlite3.wasm), worker (vendor/sqlite3.js + worker/*.js + datos/worker_datos.json),
                     capitales (assets/capitales.json)
  <script>page/01_* … page/NN_*</script>
"""
import base64, gzip, hashlib, json, os, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SALIDA = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else os.path.join(os.path.dirname(ROOT), 'Diarios_Explorer.html')
EXTRA_BLOBS = [a for a in sys.argv[1:] if a.startswith('--blob=')]  # --blob=corpus=/ruta/archivo.csv[;data-nombre=x.csv] (solo pruebas)
_web = [a for a in sys.argv[1:] if a.startswith('--web')]
SALIDA_WEB = None if '--sin-web' in sys.argv else (_web[0].split('=', 1)[1] if _web and '=' in _web[0] else os.path.join(os.path.dirname(ROOT), 'docs'))


def leer(rel):
    with open(os.path.join(ROOT, rel), 'rb') as f:
        return f.read()


def archivos(subdir, ext):
    d = os.path.join(ROOT, subdir)
    return [os.path.join(subdir, n) for n in sorted(os.listdir(d)) if n.endswith(ext) and not n.startswith('.')]


def blob(nombre, datos, atributos=''):
    gz = gzip.compress(datos, compresslevel=9, mtime=0)
    b64 = base64.b64encode(gz).decode('ascii')
    sha = hashlib.sha256(datos).hexdigest()
    return (f'<script type="application/octet-stream" id="r2-carga-{nombre}" data-enc="gzip+base64" '
            f'data-bytes="{len(datos)}" data-sha256="{sha}"{atributos}>{b64}</script>\n').encode('utf-8')


BUILD_ID = None  # se fija en main() a partir del contenido del worker y del registro de partidos
VERSION_WEB = None  # se fija en main(): huella de todas las fuentes (código, estilos, datos); versiona la caché de la edición web


def hitos_registro():
    """Hitos históricos por país (datos/hitos_parlaibero.json, tools/hitos_parlaibero.py); {} si no existe."""
    ruta = os.path.join(ROOT, 'datos', 'hitos_parlaibero.json')
    if not os.path.exists(ruta):
        return {}
    with open(ruta, encoding='utf-8') as f:
        return json.load(f).get('paises') or {}


def partidos_registro():
    """Partidos homogéneos por país (datos/partidos_parlaibero.json, tools/partidos_parlaibero.py): para cada país, el
    partido canónico de cada etiqueta de la columna party del CSV. {} si no existe."""
    ruta = os.path.join(ROOT, 'datos', 'partidos_parlaibero.json')
    if not os.path.exists(ruta):
        return {}
    with open(ruta, encoding='utf-8') as f:
        return json.load(f).get('paises') or {}


def datos_json(rel, web=None):
    d = json.loads(leer(rel).decode('utf-8'))
    if BUILD_ID and isinstance(d.get('edicion'), dict):
        d['edicion']['build_id'] = BUILD_ID
    if rel in ('datos/page_datos.json', 'datos/worker_datos.json'):
        # Registro de conjuntos de datos de ParlaIbero (tools/fuentes_parlaibero.py): cita por país y colección.
        p = json.loads(leer('datos/fuentes_parlaibero.json').decode('utf-8'))
        d['parlaibero'] = p['coleccion']
        d['fuentes'] = p['fuentes']
        d['fuentes_consultado'] = p.get('consultado')
    if rel == 'datos/worker_datos.json':
        # Hitos históricos por país para la tendencia (R2.gen.hitos.de(país) en el worker).
        d['hitos'] = hitos_registro()
        # Partidos homogéneos por país: la ingesta guarda en party el partido canónico (R2.partidos en el worker).
        d['partidos'] = partidos_registro()
        # Palabras vacías publicadas por lengua (stopwords-iso, tools/palabras_vacias.py): las usan las coocurrencias.
        ruta_vacias = os.path.join(ROOT, 'datos', 'palabras_vacias.json')
        if os.path.exists(ruta_vacias):
            with open(ruta_vacias, encoding='utf-8') as f:
                d['vacias_lengua'] = json.load(f)
    if web is not None:
        # Edición web: recursos descargables (con huella), capitulares servidas por letra y marca de edición web.
        d['edicion']['web'] = True
        d['edicion']['version_web'] = VERSION_WEB
        d['recursos'] = web
        if isinstance(d.get('capitales'), dict):
            d['capitales'] = dict(d['capitales'], modo='servidas', dir='capitales')
    return d


def json_compacto(rel, web=None):
    return json.dumps(datos_json(rel, web), ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def worker():
    partes = [leer('vendor/sqlite3.js')]
    for rel in archivos('worker', '.js'):
        if 'principal' in os.path.basename(rel):
            partes.append(b'/* ===== R2.datos ===== */\nglobalThis.R2 = globalThis.R2 || {};\nglobalThis.R2.datos = ' + json_compacto('datos/worker_datos.json') + b';\n')
        partes.append(leer(rel))
    return b''.join(partes)


def escribir(ruta, datos):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'wb') as f:
        f.write(datos)


def construir_web(destino):
    """Edición web en `destino`: mismos módulos que el standalone, servidos como archivos."""
    pagina = archivos('page', '.js')
    ficha = lambda datos, archivo: {'archivo': archivo, 'bytes': len(datos), 'sha256': hashlib.sha256(datos).hexdigest()}
    w = worker()
    wasm = leer('vendor/sqlite3.wasm')
    recursos = {'wasm': ficha(wasm, 'sqlite3.wasm'), 'worker': ficha(w, 'worker.js')}
    escribir(os.path.join(destino, 'worker.js'), w)
    escribir(os.path.join(destino, 'sqlite3.wasm'), wasm)
    # Página: navegador.js en línea (debe correr antes que nada), CSS y JS en archivos con el build_id en la URL.
    css = b''.join(leer(c) for c in archivos('css', '.css'))
    escribir(os.path.join(destino, 'app.css'), css)
    modulos = []
    for rel in pagina[1:]:
        if os.path.basename(rel).startswith('03_cargas__cargas'):
            modulos.append(leer('web/cargas_web.js'))  # los recursos se descargan en vez de leerse embebidos
        else:
            modulos.append(leer(rel))
    escribir(os.path.join(destino, 'app.js'), b'\n'.join(modulos))
    v = VERSION_WEB  # cambia con cualquier fuente (también los datos), no solo con el worker
    out = [leer('html/head_top.html')]
    out.append(b'<script>' + leer(pagina[0]) + b'</script>\n')
    out.append(f'<link rel="stylesheet" href="app.css?v={v}">\n'.encode())
    out.append(b'</head>\n')
    out.append(leer('html/body.html'))
    out.append(b'<script type="application/json" id="r2-datos">' + json_compacto('datos/page_datos.json', recursos) + b'</script>\n')
    out.append(f'<script src="app.js?v={v}"></script>\n'.encode())
    out.append(b'</body>\n</html>\n')
    escribir(os.path.join(destino, 'index.html'), b''.join(out))
    # Capitulares: un SVG por letra (arranque/capitales.js las pide como capitales/<LETRA>.svg).
    letras = json.loads(leer('assets/capitales.json').decode('utf-8'))
    for letra, svg in letras.items():
        escribir(os.path.join(destino, 'capitales', f'{letra}.svg'), svg.encode('utf-8'))
    # Expresiones ya calculadas para los CSV publicados (tools/expresiones_precalculadas.py): se sirven tal cual en
    # expresiones/ y el worker las usa si el CSV elegido es idéntico (web/expresiones_servidas.js).
    origen_expr = os.path.join(ROOT, 'datos', 'expresiones')
    destino_expr = os.path.join(destino, 'expresiones')
    if os.path.isdir(destino_expr):
        shutil.rmtree(destino_expr)
    n_expr = 0
    if os.path.isfile(os.path.join(origen_expr, 'indice.json')):
        indice_expr = json.loads(leer('datos/expresiones/indice.json').decode('utf-8'))
        for e in indice_expr.get('paises', {}).values():
            escribir(os.path.join(destino_expr, e['archivo']), leer(os.path.join('datos', 'expresiones', e['archivo'])))
            n_expr += 1
        escribir(os.path.join(destino_expr, 'indice.json'), leer('datos/expresiones/indice.json'))
    precarga = ['./', './index.html', f'./app.css?v={v}', f'./app.js?v={v}', f'./worker.js?v={v}', f'./sqlite3.wasm?v={v}']
    sw = leer('web/sw.js').decode('utf-8').replace('__BUILD_ID__', v).replace('__PRECARGA__', json.dumps(precarga))
    escribir(os.path.join(destino, 'sw.js'), sw.encode('utf-8'))
    escribir(os.path.join(destino, '.nojekyll'), b'')
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(destino) for f in fs)
    print(f'{destino}/: index.html, app.css, app.js, worker.js, sqlite3.wasm, sw.js, capitales/ ({len(letras)} letras), '
          f'expresiones/ ({n_expr} países) · {total:,} bytes')


def main():
    global BUILD_ID
    partes_worker = [leer('vendor/sqlite3.js')] + [leer(rel) for rel in archivos('worker', '.js')]
    # el registro de partidos cambia lo que la ingesta guarda: con otro registro, la base se reconstruye
    registro = [leer('datos/partidos_parlaibero.json')] if os.path.isfile(os.path.join(ROOT, 'datos', 'partidos_parlaibero.json')) else []
    BUILD_ID = hashlib.sha256(b''.join(partes_worker + registro)).hexdigest()[:16]
    global VERSION_WEB
    fuentes = [leer(rel) for sub, ext in (('html', '.html'), ('css', '.css'), ('page', '.js'), ('web', '.js'), ('datos', '.json'))
               for rel in archivos(sub, ext)] + [leer('assets/capitales.json')] + partes_worker
    if os.path.isfile(os.path.join(ROOT, 'datos', 'expresiones', 'indice.json')):
        fuentes.append(leer('datos/expresiones/indice.json'))  # lleva la huella de cada tabla de expresiones
    VERSION_WEB = hashlib.sha256(b''.join(fuentes)).hexdigest()[:16]
    pagina = archivos('page', '.js')
    out = [leer('html/head_top.html')]
    out.append(b'<script>' + leer(pagina[0]) + b'</script>\n')
    for css in archivos('css', '.css'):
        out.append(b'<style>' + leer(css) + b'</style>\n')
    out.append(b'</head>\n')
    out.append(leer('html/body.html'))
    out.append(b'<script type="application/json" id="r2-datos">' + json_compacto('datos/page_datos.json') + b'</script>\n')
    out.append(blob('wasm', leer('vendor/sqlite3.wasm')))
    out.append(blob('worker', worker()))
    for e in EXTRA_BLOBS:  # solo para pruebas de paridad con la plantilla original
        spec = e[len('--blob='):]
        nombre, ruta = spec.split('=', 1)
        atributos = ''
        if ';' in ruta:
            ruta, attr = ruta.split(';', 1)
            k, v = attr.split('=', 1)
            atributos = f' {k}="{v}"'
        with open(ruta, 'rb') as f:
            out.append(blob(nombre, f.read(), atributos))
    out.append(blob('capitales', leer('assets/capitales.json')))
    for rel in pagina[1:]:
        out.append(b'<script>' + leer(rel) + b'</script>\n')
    out.append(b'</body>\n</html>\n')
    datos = b''.join(out)
    with open(SALIDA, 'wb') as f:
        f.write(datos)
    print(f'{SALIDA}: {len(datos):,} bytes (build {BUILD_ID})')
    if SALIDA_WEB:
        construir_web(SALIDA_WEB)


if __name__ == '__main__':
    main()

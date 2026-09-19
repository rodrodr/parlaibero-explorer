#!/usr/bin/env python3
"""Genera datos/expresiones/: las expresiones de varias palabras ya calculadas para los CSV de ParlaIbero publicados en
Harvard Dataverse. La edición web las carga en lugar de detectarlas cuando el CSV elegido es idéntico (misma SHA-256), y
se ahorra así la fase más lenta de la construcción de la base (unos 90 s en Brasil o México). Si el CSV no coincide,
la página detecta las expresiones como siempre.

Para cada país de datos/fuentes_parlaibero.json que tenga su CSV en la carpeta de datos:
  1. SHA-256 y MD5 del CSV;
  2. con la API de Dataverse (solo metadatos, sin descargar nada) comprueba que el MD5 es el del archivo publicado; si
     no lo es, lo omite, porque la tabla solo serviría a quien tuviera ese mismo archivo (--sin-dataverse lo desactiva);
  3. construye la base con el motor del explorador en Node (tools/expresiones_precalculadas.cjs, con los datos del
     worker tal como los arma build.py) y guarda el paquete comprimido datos/expresiones/<PAÍS>.json.gz;
  4. escribe datos/expresiones/indice.json con la huella de cada CSV y de cada tabla.
Después, python3 explorer_src/build.py copia datos/expresiones/ a docs/expresiones/.

Hay que volver a ejecutarlo cuando Dataverse publique una versión nueva de algún conjunto o cuando cambie la detección
(R2.expresiones.VERSION): las tablas de otra versión no se usan.

Uso:  python3 explorer_src/tools/expresiones_precalculadas.py [--datos DIR] [--procesos 4] [--paises BR,MX] [--sin-dataverse]
Cada proceso necesita hasta unos 2,5 GB de memoria con los países grandes; con 4 a la vez, los 16 tardan unos 7 minutos.
"""
import argparse, concurrent.futures, datetime, hashlib, importlib.util, json, os, subprocess, sys, tempfile, urllib.parse, urllib.request

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(SRC, 'datos', 'expresiones')
NODE_SCRIPT = os.path.join(SRC, 'tools', 'expresiones_precalculadas.cjs')
API = 'https://dataverse.harvard.edu/api'
CABECERAS = {'User-Agent': 'Mozilla/5.0 (Macintosh) diarios-explorer/1.0', 'Accept': 'application/json'}


def huellas(ruta):
    """SHA-256 y MD5 del archivo, en una sola lectura."""
    s, m = hashlib.sha256(), hashlib.md5()
    with open(ruta, 'rb') as f:
        for b in iter(lambda: f.read(8 << 20), b''):
            s.update(b)
            m.update(b)
    return s.hexdigest(), m.hexdigest()


def publicado(doi, nombre):
    """Ficha del archivo en la última versión publicada del conjunto: id, bytes, MD5 y versión."""
    q = urllib.parse.quote(f'doi:{doi}')
    with urllib.request.urlopen(urllib.request.Request(f'{API}/datasets/:persistentId/?persistentId={q}', headers=CABECERAS), timeout=120) as r:
        v = json.load(r)['data']['latestVersion']
    for f in v.get('files', []):
        df = f.get('dataFile', {})
        if df.get('filename') == nombre:
            ck = df.get('checksum') or {}
            return {'id_archivo': df.get('id'), 'bytes': df.get('filesize'), 'md5': ck.get('value') if ck.get('type') == 'MD5' else df.get('md5'),
                    'version': f"{v.get('versionNumber')}.{v.get('versionMinorNumber')}"}
    return None


def datos_worker():
    """Los datos del worker tal como los arma build.py (palabras vacías, conectores…), en un archivo temporal."""
    spec = importlib.util.spec_from_file_location('build_explorer', os.path.join(SRC, 'build.py'))
    build = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(build)
    d = build.datos_json('datos/worker_datos.json')
    f = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8')
    json.dump(d, f, ensure_ascii=False)
    f.close()
    return f.name


def procesar(pais, csv, sha, datos):
    salida = os.path.join(DESTINO, f'{pais}.json.gz')
    r = subprocess.run(['node', '--max-old-space-size=16000', NODE_SCRIPT, pais, csv, salida, datos, sha],
                       capture_output=True, text=True)
    if r.returncode != 0:
        errores = [l for l in r.stderr.splitlines() if l.strip() and 'Ignoring inability' not in l and not l.startswith('    at ')]
        return pais, None, '\n'.join(errores[-5:]) or f'código {r.returncode}'
    return pais, json.loads(r.stdout.strip().splitlines()[-1]), None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--datos', default=os.path.join(os.path.dirname(SRC), 'data'), help='carpeta con los <PAÍS>_interventions.csv')
    ap.add_argument('--procesos', type=int, default=4, help='construcciones a la vez (4 por defecto)')
    ap.add_argument('--paises', default='', help='solo estos países, separados por comas (los demás se conservan del índice)')
    ap.add_argument('--sin-dataverse', action='store_true', help='no comprobar el MD5 con Dataverse')
    a = ap.parse_args()

    fuentes = json.load(open(os.path.join(SRC, 'datos', 'fuentes_parlaibero.json'), encoding='utf-8'))['fuentes']
    pedidos = {p.strip().upper() for p in a.paises.split(',') if p.strip()}
    candidatos = {}
    for pais, f in sorted(fuentes.items()):
        if pedidos and pais not in pedidos:
            continue
        csv = os.path.join(a.datos, f['archivo']['nombre'])
        if os.path.exists(csv):
            candidatos[pais] = (csv, f)
        else:
            print(f'{pais}: falta {csv}; se omite')
    if not candidatos:
        sys.exit('No hay ningún CSV que procesar.')

    procesos = max(1, a.procesos)
    print(f'Huellas de {len(candidatos)} CSV…')
    with concurrent.futures.ThreadPoolExecutor(max(4, min(16, procesos))) as ex:
        hs = dict(zip(candidatos, ex.map(lambda p: huellas(candidatos[p][0]), candidatos)))

    fichas = {}
    if not a.sin_dataverse:
        print('Comprobando con Dataverse…')
        with concurrent.futures.ThreadPoolExecutor(4) as ex:
            res = ex.map(lambda p: (p, publicado(candidatos[p][1]['doi'], candidatos[p][1]['archivo']['nombre'])), candidatos)
            fichas = dict(res)
    elegidos = []
    for pais in candidatos:
        sha, md5 = hs[pais]
        fi = fichas.get(pais)
        if not a.sin_dataverse and (not fi or fi.get('md5') != md5):
            print(f'{pais}: el CSV local no es el publicado en Dataverse (MD5 {md5} frente a {fi and fi.get("md5")}); se omite')
            continue
        elegidos.append(pais)
    if not elegidos:
        sys.exit('Ningún CSV coincide con el publicado.')

    os.makedirs(DESTINO, exist_ok=True)
    datos = datos_worker()
    hechos, fallos = {}, {}
    print(f'Construyendo {len(elegidos)} bases, {procesos} a la vez…')
    try:
        with concurrent.futures.ThreadPoolExecutor(procesos) as ex:
            orden = sorted(elegidos, key=lambda p: -os.path.getsize(candidatos[p][0]))   # los grandes primero
            for pais, info, error in ex.map(lambda p: procesar(p, candidatos[p][0], hs[p][0], datos), orden):
                if error:
                    fallos[pais] = error
                    print(f'{pais}: FALLO\n{error}')
                else:
                    hechos[pais] = info
                    print(f"{pais}: {info['expresiones']:,} expresiones · {info['bytes'] / 1e6:.2f} MB · {info['segundos']} s")
    finally:
        os.unlink(datos)
    if not hechos:
        sys.exit('No se generó ninguna tabla.')

    versiones = {i['version'] for i in hechos.values()}
    if len(versiones) != 1:
        sys.exit(f'Las tablas salieron con versiones distintas de la detección: {sorted(versiones)}')
    version = versiones.pop()
    ruta_indice = os.path.join(DESTINO, 'indice.json')
    previo = json.load(open(ruta_indice, encoding='utf-8')) if os.path.exists(ruta_indice) else None
    paises = dict(previo['paises']) if previo and previo.get('version_expresiones') == version else {}
    for pais in fallos:
        paises.pop(pais, None)
    for pais, info in hechos.items():
        csv, f = candidatos[pais]
        ruta = os.path.join(DESTINO, f'{pais}.json.gz')
        with open(ruta, 'rb') as g:
            contenido = g.read()
        fi = fichas.get(pais) or {}
        paises[pais] = {
            'csv': {'nombre': os.path.basename(csv), 'bytes': os.path.getsize(csv), 'sha256': hs[pais][0], 'md5': hs[pais][1]},
            'dataverse': {'doi': f['doi'], 'version': fi.get('version'), 'id_archivo': fi.get('id_archivo')} if fi else None,
            'archivo': f'{pais}.json.gz', 'bytes': len(contenido), 'sha256': hashlib.sha256(contenido).hexdigest(),
            'expresiones': info['expresiones'], 'resumen': info['resumen'],
        }
    indice = {'formato': 1, 'version_expresiones': version,
              'generado': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
              'paises': dict(sorted(paises.items()))}
    with open(ruta_indice, 'w', encoding='utf-8') as g:
        json.dump(indice, g, ensure_ascii=False, indent=1)
        g.write('\n')
    # Tablas que ya no están en el índice (otra versión de la detección, países que fallaron)
    for n in os.listdir(DESTINO):
        if n.endswith('.json.gz') and n[:-8] not in paises:
            os.remove(os.path.join(DESTINO, n))
    total = sum(e['bytes'] for e in paises.values())
    print(f'{ruta_indice}: {len(paises)} países, versión {version} de la detección, {total / 1e6:.1f} MB en total.')
    if fallos:
        sys.exit(f'Fallaron: {", ".join(sorted(fallos))}')


if __name__ == '__main__':
    main()

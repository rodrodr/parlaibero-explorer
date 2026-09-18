#!/usr/bin/env python3
"""Genera datos/fuentes_parlaibero.json con la ficha bibliográfica de cada conjunto de datos de ParlaIbero
(Harvard Dataverse, colección «parlaibero»): país (dos letras), DOI, título, autores, versión, fecha, licencia, cita y
archivo de intervenciones. build.py lo incorpora a los datos de la página y del worker.

Uso:  python3 tools/fuentes_parlaibero.py            (consulta la API de Dataverse)
"""
import json, os, re, sys, html, urllib.request, urllib.parse, concurrent.futures

BASE = 'https://dataverse.harvard.edu/api'
COLECCION = 'parlaibero'
SALIDA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'datos', 'fuentes_parlaibero.json')
CABECERAS = {'User-Agent': 'Mozilla/5.0 (Macintosh) diarios-explorer/1.0', 'Accept': 'application/json'}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=CABECERAS), timeout=120) as r:
        return json.load(r)


def campo(fields, name):
    for f in fields:
        if f.get('typeName') == name:
            return f.get('value')
    return None


def ficha(x):
    pid = f"{x['protocol']}:{x['authority']}/{x['identifier']}"
    q = urllib.parse.quote(pid)
    d = get(f'{BASE}/datasets/:persistentId/?persistentId={q}')['data']
    v = d.get('latestVersion') or {}
    fields = (v.get('metadataBlocks') or {}).get('citation', {}).get('fields', [])
    titulo = campo(fields, 'title') or ''
    autores = [{'nombre': a.get('authorName', {}).get('value', ''), 'afiliacion': a.get('authorAffiliation', {}).get('value')}
               for a in (campo(fields, 'author') or [])]
    archivos = [(f.get('dataFile', {}).get('filename', ''), f.get('dataFile', {}).get('filesize')) for f in v.get('files', [])]
    inter = next(((n, b) for n, b in archivos if n.endswith('_interventions.csv')), (None, None))
    m = re.match(r'ParlaIbero-([A-Z]{2})', titulo)
    pais = m.group(1) if m else (inter[0][:2] if inter[0] else None)
    version = f"V{v.get('versionNumber')}" if v.get('versionNumber') is not None else None
    lic = v.get('license') if isinstance(v.get('license'), dict) else {'name': v.get('license')}
    doi = pid.replace('doi:', '')
    url = f'https://doi.org/{doi}'
    anio = str(d.get('publicationDate') or '')[:4]
    nombres = '; '.join(a['nombre'] for a in autores)
    cita = f'{nombres}, {anio}, "{titulo}", {url}, Harvard Dataverse{", " + version if version else ""}'
    return pais, {
        'tipo': 'dataset', 'referencia_fundamental': True, 'coleccion': 'ParlaIbero',
        'titulo': titulo, 'autores': autores, 'anio': int(anio) if anio.isdigit() else None,
        'editor': 'Harvard Dataverse', 'doi': doi, 'url': url,
        'version_cita': version, 'fecha_publicacion': d.get('publicationDate'), 'fecha_version': v.get('releaseTime'),
        'licencia': (lic or {}).get('name'), 'licencia_url': (lic or {}).get('uri'),
        'cita': cita,
        'archivo': {'nombre': inter[0], 'bytes': inter[1]},
        'metadatos_de': 'API de Harvard Dataverse (datasets/:persistentId)',
    }


def main():
    dv = get(f'{BASE}/dataverses/{COLECCION}')['data']
    contenido = [x for x in get(f'{BASE}/dataverses/{COLECCION}/contents')['data'] if x.get('type') == 'dataset']
    with concurrent.futures.ThreadPoolExecutor(4) as ex:
        fichas = list(ex.map(ficha, contenido))
    fuentes = {pais: f for pais, f in sorted(fichas, key=lambda p: p[0] or '') if pais}
    salida = {
        'coleccion': {
            'nombre': dv.get('name'), 'alias': dv.get('alias'), 'afiliacion': dv.get('affiliation'),
            'descripcion': dv.get('description'), 'url': f'https://dataverse.harvard.edu/dataverse/{COLECCION}',
            'cita': f"{dv.get('name')}. Harvard Dataverse, https://dataverse.harvard.edu/dataverse/{COLECCION}",
            'licencia': 'CC BY 4.0', 'licencia_url': 'http://creativecommons.org/licenses/by/4.0',
        },
        'consultado': __import__('datetime').date.today().isoformat(),
        'fuentes': fuentes,
    }
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    print(f'{SALIDA}: {len(fuentes)} países: {", ".join(fuentes)}')


if __name__ == '__main__':
    main()

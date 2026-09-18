#!/usr/bin/env python3
"""Genera datos/palabras_vacias.json con las listas de palabras vacías publicadas por stopwords-iso para las dos lenguas
de ParlaIbero (español y portugués). build.py las incorpora a los datos del worker; las usan las coocurrencias, que
eligen la lista según el país del corpus (Brasil y Portugal en portugués, el resto en español).

stopwords-iso (https://github.com/stopwords-iso) se distribuye con licencia MIT. Las listas se guardan tal como se
publican; el plegado de mayúsculas y diacríticos se hace al usarlas, con el mismo plegado que el índice.

Uso:  python3 tools/palabras_vacias.py
"""
import datetime, json, os, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'datos', 'palabras_vacias.json')
CABECERAS = {'User-Agent': 'Mozilla/5.0 (Macintosh) diarios-explorer/1.0'}
FUENTES = {
    'es': 'https://raw.githubusercontent.com/stopwords-iso/stopwords-es/master/stopwords-es.txt',
    'pt': 'https://raw.githubusercontent.com/stopwords-iso/stopwords-pt/master/stopwords-pt.txt',
}
LICENCIAS = {
    'es': 'https://raw.githubusercontent.com/stopwords-iso/stopwords-es/master/LICENSE',
    'pt': 'https://raw.githubusercontent.com/stopwords-iso/stopwords-pt/master/LICENSE',
}


def leer(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=CABECERAS), timeout=60) as r:
        return r.read().decode('utf-8')


def main():
    out = {'fuente': 'stopwords-iso', 'web': 'https://github.com/stopwords-iso', 'licencia': 'MIT',
           'consultado': datetime.date.today().isoformat(), 'lenguas': {}}
    for lengua, url in FUENTES.items():
        palabras = [l.strip() for l in leer(url).splitlines() if l.strip()]
        aviso = next((l.strip() for l in leer(LICENCIAS[lengua]).splitlines() if l.strip().startswith('Copyright')), '')
        out['lenguas'][lengua] = {'url': url, 'copyright': aviso, 'n': len(palabras), 'palabras': palabras}
        print(f'{lengua}: {len(palabras)} palabras · {aviso}')
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'escrito {os.path.relpath(SALIDA, RAIZ)}')


if __name__ == '__main__':
    main()

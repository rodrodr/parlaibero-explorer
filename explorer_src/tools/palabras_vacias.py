#!/usr/bin/env python3
"""Genera datos/palabras_vacias.json con las listas de palabras vacías publicadas para las dos lenguas de ParlaIbero
(español y portugués). build.py las incorpora a los datos del worker; las usan las coocurrencias, que eligen la lista
según el país del corpus (Brasil y Portugal en portugués, el resto en español).

Lista por defecto: Snowball (https://snowballstem.org, licencia BSD), la que usa quanteda por defecto. Es conservadora:
solo palabras funcionales (artículos, preposiciones, pronombres y formas de ser, estar, haber, tener). Se guarda
también stopwords-iso (MIT) como referencia, pero no se usa: trata como vacías palabras centrales del vocabulario
político que son homógrafas de formas verbales o adverbios («estado», «poder», «trabajo», «sistema», «general»,
«medio», «país»), y en la biblioteca de El Salvador eliminaba de la red «Estado», «país» o «medio ambiente».

Excepciones: palabras de la lista Snowball que en este dominio son sustantivos centrales y se conservan siempre
(en español, «estado» y «estados», que Snowball incluye como formas de «estar»).

Uso:  python3 tools/palabras_vacias.py
"""
import datetime, json, os, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'datos', 'palabras_vacias.json')
CABECERAS = {'User-Agent': 'Mozilla/5.0 (Macintosh) diarios-explorer/1.0'}
SNOWBALL = {
    'es': 'https://snowballstem.org/algorithms/spanish/stop.txt',
    'pt': 'https://snowballstem.org/algorithms/portuguese/stop.txt',
}
ISO = {
    'es': 'https://raw.githubusercontent.com/stopwords-iso/stopwords-es/master/stopwords-es.txt',
    'pt': 'https://raw.githubusercontent.com/stopwords-iso/stopwords-pt/master/stopwords-pt.txt',
}
EXCEPCIONES = {'es': ['estado', 'estados'], 'pt': []}


def leer(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=CABECERAS), timeout=60) as r:
        return r.read().decode('utf-8')


def snowball(texto):
    """Formato Snowball: una palabra por línea, con comentarios tras «|»."""
    out = []
    for linea in texto.splitlines():
        w = linea.split('|')[0].strip()
        if w:
            out.append(w)
    return out


def main():
    out = {'fuente': 'Snowball', 'web': 'https://snowballstem.org', 'licencia': 'BSD-3-Clause',
           'copyright': 'Copyright (c) 2001, Dr Martin Porter; Copyright (c) 2002, Richard Boulton',
           'consultado': datetime.date.today().isoformat(), 'lenguas': {}, 'referencia_no_usada': {}}
    for lengua, url in SNOWBALL.items():
        palabras = snowball(leer(url))
        out['lenguas'][lengua] = {'url': url, 'n': len(palabras), 'palabras': palabras, 'excepciones': EXCEPCIONES[lengua]}
        print(f'Snowball {lengua}: {len(palabras)} palabras · excepciones {EXCEPCIONES[lengua]}')
    for lengua, url in ISO.items():
        palabras = [l.strip() for l in leer(url).splitlines() if l.strip()]
        out['referencia_no_usada'][lengua] = {'fuente': 'stopwords-iso', 'licencia': 'MIT', 'url': url, 'n': len(palabras)}
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'escrito {os.path.relpath(SALIDA, RAIZ)}')


if __name__ == '__main__':
    main()

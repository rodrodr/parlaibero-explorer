#!/usr/bin/env python3
"""Ensambla y contrasta el registro de hitos históricos por país (datos/hitos_parlaibero.json) que la tendencia del
explorador pinta numerados sobre el gráfico (R2.gen.hitos en el worker, inyectado por build.py).

Cada hito trae su fuente (URL). El script descarga cada fuente y comprueba que la fecha del hito aparece en ella
(en formato ISO, español, portugués o inglés). Entran en el registro los hitos cuya fecha completa se confirma y
aquellos cuya fuente confirma al menos el mes y el año, que se guardan con verificar=true (la interfaz los muestra
como fecha pendiente de verificar). Los que no se confirman de ninguna manera se descartan, salvo que se pida
--incluir-no-confirmados, y se listan en el informe y en <informe>.pendientes.json para revisarlos con otra fuente.

Uso:
  python3 tools/hitos_parlaibero.py --desde DIR            # lee DIR/hitos_<PAÍS>.json, contrasta y escribe el registro
  python3 tools/hitos_parlaibero.py                        # vuelve a contrastar el registro existente
  opciones: --sin-red (solo valida el formato) · --salida RUTA · --informe RUTA.md · --incluir-no-confirmados · --hilos N

Formato de cada archivo de entrada: {"pais": "AR", "desde": "1983", "hasta": "2025", "hitos": [ {id, date, date_end,
label, desc, kind, rank, fuente, verificar}, ... ]}.
"""
import argparse, concurrent.futures, datetime, html, json, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'datos', 'hitos_parlaibero.json')
KINDS = {'electoral': 'Elecciones', 'politico': 'Política', 'parlamentario': 'Parlamento',
         'conflicto': 'Conflicto', 'economico': 'Economía', 'social': 'Sociedad'}
CABECERAS = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) '
                           'Chrome/124.0 Safari/537.36 diarios-explorer/1.0',
             'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'es,pt,en;q=0.7'}
MESES = {
    'es': ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    'es2': ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'],
    'pt': ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    'en': ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
    'ca': ['gener', 'febrer', 'marc', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'],
}
RE_FECHA = re.compile(r'^\d{4}-\d{2}-\d{2}$')
RE_ID = re.compile(r'^[a-z]{2}_[a-z0-9_]+$')
MAX_LABEL, MAX_DESC = 36, 220


def plano(s):
    """Minúsculas, sin diacríticos, espacios compactos."""
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s.lower())


def texto_html(raw):
    s = re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>', ' ', raw)
    s = re.sub(r'(?s)<[^>]+>', ' ', s)
    s = html.unescape(s)
    return plano(s)


def patrones_fecha(iso):
    """Formas en que la fecha puede aparecer en una página (texto ya plano)."""
    y, m, d = int(iso[:4]), int(iso[5:7]), int(iso[8:10])
    dias = [str(d), f'{d:02d}']
    if d == 1:
        dias += ['1o', '1.o', '1º', 'primero', 'primeiro', '1st']
    out = {iso, f'{d}/{m}/{y}', f'{d:02d}/{m:02d}/{y}', f'{d}-{m}-{y}', f'{d:02d}-{m:02d}-{y}', f'{d:02d}.{m:02d}.{y}', f'{m}/{d}/{y}'}
    for lengua, meses in MESES.items():
        mes = meses[m - 1]
        for dd in dias:
            out.add(f'{dd} de {mes} de {y}')
            out.add(f'{dd} de {mes} del {y}')
            out.add(f'{dd} de {mes}, {y}')
            out.add(f'{dd} {mes} {y}')
            out.add(f'{dd} {mes}, {y}')
            out.add(f'{mes} {dd}, {y}')
            out.add(f'{mes} {dd} {y}')
            out.add(f'{dd} de {mes} {y}')
        out.add(f'{d}th {mes} {y}'); out.add(f'{mes} {d}th, {y}')
        out.add(f'{d}st {mes} {y}'); out.add(f'{mes} {d}st, {y}')
        out.add(f'{d}nd {mes} {y}'); out.add(f'{mes} {d}nd, {y}')
        out.add(f'{d}rd {mes} {y}'); out.add(f'{mes} {d}rd, {y}')
    return [plano(p) for p in out]


def url_ascii(url):
    """URL con el camino y la consulta codificados en porcentaje (los títulos de Wikipedia llevan eñes y tildes)."""
    p = urllib.parse.urlsplit(url)
    camino = urllib.parse.quote(p.path, safe="/:@!$&'()*+,;=~-._%")
    consulta = urllib.parse.quote(p.query, safe="=&:/?@!$'()*+,;~-._%")
    fragmento = urllib.parse.quote(p.fragment, safe="/:@!$&'()*+,;=~-._%")
    return urllib.parse.urlunsplit((p.scheme, p.netloc.encode('idna').decode('ascii') if any(ord(c) > 127 for c in p.netloc) else p.netloc,
                                    camino, consulta, fragmento))


def descargar(url, timeout=30, intentos=3):
    """Descarga la página. Reintenta con espera creciente si el servidor limita el ritmo (429) o falla (5xx)."""
    req = urllib.request.Request(url_ascii(url), headers=CABECERAS)
    ultimo = None
    for n in range(intentos):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read(6_000_000)
                ct = r.headers.get('Content-Type', '')
            break
        except urllib.error.HTTPError as e:
            ultimo = e
            if e.code in (429, 500, 502, 503, 504) and n + 1 < intentos:
                espera = float(e.headers.get('Retry-After') or 0) or (2 ** n) * 3
                time.sleep(min(espera, 30))
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            ultimo = e
            if n + 1 < intentos:
                time.sleep((2 ** n) * 2)
                continue
            raise
    else:
        raise ultimo
    enc = 'utf-8'
    m = re.search(r'charset=([\w-]+)', ct)
    if m:
        enc = m.group(1)
    try:
        return raw.decode(enc, errors='replace')
    except LookupError:
        return raw.decode('utf-8', errors='replace')


_cache = {}


def texto_fuente(url):
    if url not in _cache:
        try:
            _cache[url] = ('ok', texto_html(descargar(url)))
        except urllib.error.HTTPError as e:
            _cache[url] = ('sin_acceso', f'HTTP {e.code}')
        except Exception as e:  # noqa: BLE001
            _cache[url] = ('sin_acceso', str(e)[:120])
    return _cache[url]


def contrastar(h):
    """Coteja la fecha del hito con el texto de su fuente.

    confirmado      la fecha completa aparece en la página
    mes_confirmado  aparecen el mes y el año (el día queda como aproximado: verificar=true)
    fecha_no_hallada / sin_acceso   se descarta
    """
    estado, cuerpo = texto_fuente(h['fuente'])
    if estado != 'ok':
        return {'estado': 'sin_acceso', 'detalle': cuerpo}
    for p in patrones_fecha(h['date']):
        if p in cuerpo:
            return {'estado': 'confirmado', 'detalle': p}
    y, m = int(h['date'][:4]), int(h['date'][5:7])
    for meses in MESES.values():
        for forma in (f'{meses[m - 1]} de {y}', f'{meses[m - 1]} {y}', f'{y}-{m:02d}'):
            if plano(forma) in cuerpo:
                return {'estado': 'mes_confirmado', 'detalle': forma}
    return {'estado': 'fecha_no_hallada', 'detalle': 'el mes tampoco aparece'}


def validar(pais, e, desde, hasta, avisos, ids):
    """Normaliza un hito de entrada; devuelve (hito, error)."""
    if not isinstance(e, dict):
        return None, 'no es un objeto'
    h = {k: e.get(k) for k in ('id', 'date', 'date_end', 'label', 'desc', 'kind', 'rank', 'fuente', 'verificar')}
    h['id'] = str(h['id'] or '').strip()
    h['date'] = str(h['date'] or '').strip()
    h['date_end'] = str(h['date_end']).strip() if h.get('date_end') else None
    h['label'] = re.sub(r'\s+', ' ', str(h['label'] or '')).strip().rstrip('.')
    h['desc'] = re.sub(r'\s+', ' ', str(h['desc'] or '')).strip()
    h['kind'] = str(h['kind'] or '').strip().lower()
    h['fuente'] = str(h['fuente'] or '').strip()
    h['verificar'] = bool(h.get('verificar'))
    try:
        h['rank'] = int(h['rank'])
    except (TypeError, ValueError):
        h['rank'] = 2
    if not RE_ID.match(h['id']) or not h['id'].startswith(pais.lower() + '_'):
        return None, f'id no válido «{h["id"]}»'
    if h['id'] in ids:
        return None, f'id repetido «{h["id"]}»'
    if not RE_FECHA.match(h['date']):
        return None, f'{h["id"]}: fecha «{h["date"]}» no es AAAA-MM-DD'
    try:
        datetime.date.fromisoformat(h['date'])
        if h['date_end']:
            datetime.date.fromisoformat(h['date_end'])
    except ValueError:
        return None, f'{h["id"]}: fecha imposible «{h["date"]}»'
    if not (f'{desde}-01-01' <= h['date'] <= f'{hasta}-12-31'):
        return None, f'{h["id"]}: {h["date"]} fuera del periodo {desde}-{hasta}'
    if not h['label']:
        return None, f'{h["id"]}: sin label'
    if h['kind'] not in KINDS:
        avisos.append(f'{h["id"]}: kind «{h["kind"]}» desconocido → politico')
        h['kind'] = 'politico'
    if h['rank'] not in (1, 2, 3):
        avisos.append(f'{h["id"]}: rank {h["rank"]} → 2')
        h['rank'] = 2
    if not re.match(r'^https?://', h['fuente']):
        return None, f'{h["id"]}: fuente no es una URL'
    if len(h['label']) > MAX_LABEL:
        avisos.append(f'{h["id"]}: label de {len(h["label"])} caracteres (máximo aconsejado {MAX_LABEL}): «{h["label"]}»')
    if len(h['desc']) > MAX_DESC:
        avisos.append(f'{h["id"]}: desc de {len(h["desc"])} caracteres (máximo aconsejado {MAX_DESC})')
    ids.add(h['id'])
    return h, None


def leer_entradas(desde_dir):
    paises = {}
    if desde_dir:
        for n in sorted(os.listdir(desde_dir)):
            m = re.match(r'^hitos_([A-Z]{2})\.json$', n)
            if not m:
                continue
            with open(os.path.join(desde_dir, n), encoding='utf-8') as f:
                d = json.load(f)
            paises[m.group(1)] = d
    else:
        with open(SALIDA, encoding='utf-8') as f:
            reg = json.load(f)
        for p, d in (reg.get('paises') or {}).items():
            paises[p] = dict(d, pais=p)
    return paises


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--desde', help='directorio con hitos_<PAÍS>.json (si falta, se contrasta el registro existente)')
    ap.add_argument('--salida', default=SALIDA)
    ap.add_argument('--informe', default=None, help='informe en Markdown (por defecto junto a la salida, .informe.md)')
    ap.add_argument('--sin-red', action='store_true', help='solo valida el formato; no descarga las fuentes')
    ap.add_argument('--incluir-no-confirmados', action='store_true', help='mantiene los hitos no confirmados con verificar=true')
    ap.add_argument('--hilos', type=int, default=6, help='descargas simultáneas (Wikipedia limita el ritmo por encima de 8)')
    a = ap.parse_args()
    informe = a.informe or re.sub(r'\.json$', '', a.salida) + '.informe.md'

    entradas = leer_entradas(a.desde)
    if not entradas:
        sys.exit('no hay archivos hitos_<PAÍS>.json')
    errores, avisos, hitos_por_pais, periodos = [], [], {}, {}
    for pais, d in sorted(entradas.items()):
        desde, hasta = str(d.get('desde') or '1900'), str(d.get('hasta') or '2100')
        periodos[pais] = (desde, hasta)
        ids, lista = set(), []
        for e in d.get('hitos') or []:
            h, err = validar(pais, e, desde, hasta, avisos, ids)
            if err:
                errores.append(f'{pais}: {err}')
            else:
                lista.append(h)
        lista.sort(key=lambda h: (h['date'], h['rank']))
        hitos_por_pais[pais] = lista

    todos = [h for lista in hitos_por_pais.values() for h in lista]
    if not a.sin_red:
        print(f'contrastando {len(todos)} hitos en {len({h["fuente"] for h in todos})} fuentes con {a.hilos} hilos…', flush=True)
        # Una descarga por URL (caché); los hitos de la misma fuente se contrastan tras la primera descarga.
        urls = sorted({h['fuente'] for h in todos})
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(2, min(8, a.hilos))) as ex:
            for i, _ in enumerate(ex.map(texto_fuente, urls), 1):
                if i % 25 == 0 or i == len(urls):
                    print(f'  {i}/{len(urls)} fuentes', flush=True)
        for h in todos:
            h['_check'] = contrastar(h)
    else:
        for h in todos:
            h['_check'] = {'estado': 'no_contrastado', 'detalle': '--sin-red'}

    hoy = datetime.date.today().isoformat()
    salida = {'generado': hoy, 'contrastado': None if a.sin_red else hoy, 'kinds': KINDS, 'paises': {}}
    pendientes, lineas, lineas_aprox = [], [], []
    resumen = []
    for pais, lista in sorted(hitos_por_pais.items()):
        desde, hasta = periodos[pais]
        conf, aprox, no_conf = [], [], []
        for h in lista:
            c = h.pop('_check')
            if c['estado'] == 'confirmado':
                h['verificar'] = False
                conf.append(h)
            elif c['estado'] == 'mes_confirmado':
                # El acontecimiento y su mes están contrastados; el día es aproximado y la interfaz lo advierte.
                h['verificar'] = True
                aprox.append(h)
            elif c['estado'] == 'no_contrastado':
                conf.append(h)
            else:
                no_conf.append((h, c))
        finales = conf + aprox
        if a.incluir_no_confirmados:
            for h, c in no_conf:
                finales.append(dict(h, verificar=True))
        finales.sort(key=lambda h: (h['date'], h['rank']))
        salida['paises'][pais] = {'desde': desde, 'hasta': hasta, 'n': len(finales),
                                  'hitos': [{k: h[k] for k in ('id', 'date', 'date_end', 'label', 'desc', 'kind', 'rank', 'fuente', 'verificar')} for h in finales]}
        # Dos hitos del mismo país en la misma fecha suelen ser el mismo acontecimiento entrado dos veces (pasa al
        # fundir listas de distinto origen): se avisa para revisarlos, porque el gráfico los pintaría por separado.
        por_fecha = {}
        for h in finales:
            por_fecha.setdefault(h['date'], []).append(h)
        for fecha, grupo in sorted(por_fecha.items()):
            if len(grupo) > 1:
                avisos.append(f'{pais}: {len(grupo)} hitos el {fecha} ('
                              + ' · '.join(f'{h["id"]} «{h["label"]}»' for h in grupo)
                              + ') — compruebe que no son el mismo acontecimiento repetido')
        por_rango = {r: sum(1 for h in finales if h['rank'] == r) for r in (1, 2, 3)}
        resumen.append(f'| {pais} | {desde}–{hasta} | {len(lista)} | {len(conf)} | {len(aprox)} | {len(no_conf)} | {por_rango[1]}/{por_rango[2]}/{por_rango[3]} |')
        for h in aprox:
            lineas_aprox.append(f'- **{pais}** `{h["id"]}` {h["date"]} «{h["label"]}» — {h["fuente"]}')
        for h, c in no_conf:
            pendientes.append(dict(pais=pais, **{k: h[k] for k in ('id', 'date', 'date_end', 'label', 'desc', 'kind', 'rank', 'fuente', 'verificar')},
                                   motivo=c['estado'], detalle=c['detalle']))
            lineas.append(f'- **{pais}** `{h["id"]}` {h["date"]} «{h["label"]}» — {c["estado"]} ({c["detalle"]}) — {h["fuente"]}')

    os.makedirs(os.path.dirname(os.path.abspath(a.salida)), exist_ok=True)
    with open(a.salida, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
        f.write('\n')
    with open(re.sub(r'\.md$', '', informe) + '.pendientes.json', 'w', encoding='utf-8') as f:
        json.dump(pendientes, f, ensure_ascii=False, indent=1)
    with open(informe, 'w', encoding='utf-8') as f:
        f.write(f'# Hitos históricos · informe de contraste ({hoy})\n\n')
        f.write('| país | periodo | entrada | fecha exacta | solo mes | descartados | rank 1/2/3 |\n|---|---|---|---|---|---|---|\n')
        f.write('\n'.join(resumen) + '\n\n')
        total = sum(len(v['hitos']) for v in salida['paises'].values())
        f.write(f'Registro escrito en `{os.path.relpath(a.salida, RAIZ)}`: {total} hitos en {len(salida["paises"])} países.\n\n')
        if errores:
            f.write('## Entradas rechazadas (formato)\n\n' + '\n'.join(f'- {e}' for e in errores) + '\n\n')
        if lineas_aprox:
            f.write('## Día aproximado (la fuente confirma el mes y el año; se guardan con verificar=true)\n\n')
            f.write('\n'.join(lineas_aprox) + '\n\n')
        if lineas:
            f.write('## No confirmados en su fuente' + (' (incluidos con verificar=true)' if a.incluir_no_confirmados else ' (excluidos del registro)') + '\n\n')
            f.write('\n'.join(lineas) + '\n\n')
        if avisos:
            f.write('## Avisos\n\n' + '\n'.join(f'- {x}' for x in avisos) + '\n')
    print(f'{a.salida}: {sum(len(v["hitos"]) for v in salida["paises"].values())} hitos en {len(salida["paises"])} países · '
          f'{len(pendientes)} no confirmados · {len(errores)} rechazados · informe {informe}')


if __name__ == '__main__':
    main()

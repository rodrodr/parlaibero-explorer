#!/usr/bin/env python3
"""Ensambla y contrasta el registro de partidos homogéneos por país (datos/partidos_parlaibero.json): el partido canónico
de cada etiqueta de la columna party de los CSV de ParlaIbero. La ingesta del explorador guarda ese partido en lugar de la
etiqueta (R2.partidos en el worker, inyectado por build.py), así que filtros, léxico, coocurrencias, menciones y
exportaciones usan un único nombre por partido.

Fuentes: datos/partidos/<PAÍS>.json, una tabla por país revisada a mano:
  {"pais", "tipo": "por intervencion" | "trayectoria", "partidos": [{"sigla", "nombre", "etiquetas" o "bloques",
   "inicio", "fuente_inicio", "cambios": [{"de", "a", "fecha", "fuente"}], "nota"}],
   "asignacion": {"<etiqueta del CSV>": "sigla" | ["sigla", …]}, "revisar": [...]}
En una trayectoria (Argentina: la columna trae los bloques del diputado en toda su carrera, en orden) la ingesta elige,
para cada intervención, la última sigla de la lista cuyo inicio no es posterior a su fecha, o la primera.

El script valida cada tabla (siglas definidas y únicas, inicio de las siglas de las trayectorias), comprueba si se le pide
que cubre todas las etiquetas de los CSV (--csv DIR) y descarga la fuente de cada cambio de nombre para confirmar que su
fecha aparece en ella, como con los hitos (tools/hitos_parlaibero.py); lo que no se confirma se lista en el informe.

Uso:
  python3 tools/partidos_parlaibero.py [--csv ../data] [--sin-red] [--salida RUTA] [--informe RUTA.md] [--hilos N]
"""
import argparse, concurrent.futures, csv, datetime, io, json, os, re, shutil, subprocess, sys, tempfile, threading, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hitos_parlaibero import CABECERAS, patrones_fecha, plano, texto_fuente, url_ascii  # noqa: E402  (el mismo contraste que los hitos)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTES = os.path.join(RAIZ, 'datos', 'partidos')
SALIDA = os.path.join(RAIZ, 'datos', 'partidos_parlaibero.json')
RE_FECHA = re.compile(r'^\d{4}-\d{2}-\d{2}$')
SIN_IDENTIFICAR = 'Sin identificar'   # la convención de la ingesta para la etiqueta vacía


def leer_tablas(directorio):
    tablas = {}
    for n in sorted(os.listdir(directorio)):
        m = re.fullmatch(r'([A-Z]{2})\.json', n)
        if m:
            with open(os.path.join(directorio, n), encoding='utf-8') as f:
                tablas[m.group(1)] = json.load(f)
    return tablas


def validar(pais, t, errores, avisos):
    """Registro compacto del país: {tipo, partidos: {sigla: {nombre, inicio?}}, etiquetas: {etiqueta: sigla | [siglas]}}."""
    tipo = t.get('tipo') or 'por intervencion'
    partidos = {}
    for p in t.get('partidos', []):
        s = p.get('sigla')
        if not s:
            errores.append(f'{pais}: partido sin sigla ({p.get("nombre")})')
            continue
        if s in partidos:
            errores.append(f'{pais}: sigla repetida «{s}»')
        partidos[s] = {'nombre': p.get('nombre') or s}
        if p.get('inicio'):
            if not RE_FECHA.match(p['inicio']):
                errores.append(f'{pais}: inicio de «{s}» no es AAAA-MM-DD ({p["inicio"]})')
            partidos[s]['inicio'] = p['inicio']
    etiquetas = {}
    # «asignacion_fechada» (trayectorias): [[sigla, fecha de ingreso], …] por etiqueta; si no, «asignacion»: sigla | [siglas]
    fechada = t.get('asignacion_fechada') or {}
    for crudo, v in (t.get('asignacion') or {}).items():
        etq = crudo.strip()
        ops = fechada.get(crudo) if crudo in fechada else (v if isinstance(v, list) else [v])
        ops = [(o[0], o[1] if len(o) > 1 else None) if isinstance(o, list) else (o, None) for o in ops]
        ops = [o for k, o in enumerate(ops) if o[0] and (k == 0 or o[0] != ops[k - 1][0])]   # sin repeticiones seguidas
        if not ops:
            errores.append(f'{pais}: la etiqueta «{crudo}» no tiene partido')
            continue
        for s, fecha in ops:
            if s not in partidos and s != SIN_IDENTIFICAR:
                errores.append(f'{pais}: la etiqueta «{crudo}» va a «{s}», que no está en partidos')
            if fecha is not None and not RE_FECHA.match(str(fecha)):
                errores.append(f'{pais}: la fecha de «{s}» en «{crudo}» no es AAAA-MM-DD ({fecha})')
        if len(ops) == 1:
            valor = ops[0][0]
        else:
            valor = [[s, fecha] if fecha else s for s, fecha in ops]
            if tipo != 'trayectoria':
                errores.append(f'{pais}: «{crudo}» tiene varias siglas, pero la tabla no es de trayectorias')
            for s, fecha in ops[1:]:
                if not fecha and not partidos.get(s, {}).get('inicio'):
                    avisos.append(f'{pais}: «{s}» aparece en trayectorias sin fecha (se elige por orden)')
        if etq in etiquetas and etiquetas[etq] != valor:
            errores.append(f'{pais}: «{etq}» aparece con espacios distintos y partidos distintos')
        etiquetas[etq] = valor
    etiquetas.setdefault('', SIN_IDENTIFICAR)                 # la etiqueta vacía es siempre «Sin identificar»
    usados = {(o[0] if isinstance(o, list) else o) for v in etiquetas.values() for o in (v if isinstance(v, list) else [v])}
    for s in partidos:
        if s not in usados:
            avisos.append(f'{pais}: la sigla «{s}» no recibe ninguna etiqueta')
    if SIN_IDENTIFICAR in usados and SIN_IDENTIFICAR not in partidos:
        partidos[SIN_IDENTIFICAR] = {'nombre': 'Sin partido identificado en el CSV'}
    return {'tipo': tipo, 'partidos': {s: partidos[s] for s in sorted(partidos) if s in usados}, 'etiquetas': dict(sorted(etiquetas.items()))}


def etiquetas_csv(args):
    """Etiquetas de party (sin espacios alrededor) de un CSV, con sus filas."""
    pais, ruta = args
    csv.field_size_limit(sys.maxsize)
    cuenta = {}
    with open(ruta, newline='', encoding='utf-8') as f:
        r = csv.reader(f)
        k = next(r).index('party')
        for fila in r:
            e = fila[k].strip()
            cuenta[e] = cuenta.get(e, 0) + 1
    return pais, cuenta


def cambios_de(tablas):
    for pais, t in tablas.items():
        for p in t.get('partidos', []):
            for c in p.get('cambios') or []:
                yield pais, p['sigla'], c
            if p.get('inicio') and p.get('fuente_inicio'):
                yield pais, p['sigla'], {'de': '', 'a': p['sigla'], 'fecha': p['inicio'], 'fuente': p['fuente_inicio'], 'inicio': True}


_pdfs, _cerrojo = {}, threading.Lock()


def texto_pdf(url):
    """Texto plano de un PDF (pypdf o, si no está, pdftotext), o ('sin_acceso', motivo). Se guarda: un mismo informe de la
    Cámara sirve de fuente a muchos cambios."""
    with _cerrojo:
        if url in _pdfs:
            return _pdfs[url]
        try:
            with urllib.request.urlopen(urllib.request.Request(url_ascii(url), headers=CABECERAS), timeout=90) as r:
                datos = r.read(40_000_000)
            try:
                from pypdf import PdfReader
                texto = ' '.join(pg.extract_text() or '' for pg in PdfReader(io.BytesIO(datos)).pages)
            except ImportError:
                if not shutil.which('pdftotext'):
                    raise RuntimeError('ni pypdf ni pdftotext para leer el PDF')
                with tempfile.NamedTemporaryFile(suffix='.pdf') as t:
                    t.write(datos); t.flush()
                    texto = subprocess.run(['pdftotext', '-layout', t.name, '-'], capture_output=True, text=True, check=True).stdout
            _pdfs[url] = ('ok', plano(texto))
        except Exception as e:  # noqa: BLE001 (se informa)
            _pdfs[url] = ('sin_acceso', str(e)[:120])
        return _pdfs[url]


def contrastar(item):
    """(pais, sigla, cambio) → 'fecha' si la fecha completa aparece en alguna de sus fuentes (pueden ir varias URL separadas
    por « ; »), 'año' si solo el año, None si nada."""
    pais, sigla, c = item
    fecha, campo = c.get('fecha') or '', c.get('fuente') or ''
    urls = [u for u in re.split(r'\s*;\s*|\s+', campo) if u.startswith('http')]
    if not urls or not re.match(r'^\d{4}', fecha):
        return item, None, 'sin fuente o sin fecha'
    mejor, motivo = None, 'la fecha no aparece en la fuente'
    for url in urls:
        estado, texto = texto_pdf(url) if re.search(r'\.pdf(?:$|[?#])', url, re.I) else texto_fuente(url)
        if estado != 'ok':
            motivo = f'no se pudo descargar ({texto})'
            continue
        if RE_FECHA.match(fecha) and any(p in texto for p in patrones_fecha(fecha)):
            return item, 'fecha', ''
        if fecha[:4] in texto:
            mejor = 'año'
    return item, mejor, '' if mejor else motivo


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--desde', default=FUENTES, help='directorio con <PAÍS>.json (por defecto datos/partidos)')
    ap.add_argument('--salida', default=SALIDA)
    ap.add_argument('--informe', default=None, help='informe en Markdown (por defecto junto a la salida, .informe.md)')
    ap.add_argument('--csv', default=None, help='directorio con <PAÍS>_interventions.csv para comprobar que no falta ninguna etiqueta')
    ap.add_argument('--sin-red', action='store_true', help='no descarga las fuentes de los cambios de nombre')
    ap.add_argument('--hilos', type=int, default=6)
    a = ap.parse_args()

    tablas = leer_tablas(a.desde)
    errores, avisos, paises = [], [], {}
    for pais, t in tablas.items():
        paises[pais] = validar(pais, t, errores, avisos)

    cobertura = {}
    if a.csv:
        trabajos = [(p, os.path.join(a.csv, f'{p}_interventions.csv')) for p in paises if os.path.exists(os.path.join(a.csv, f'{p}_interventions.csv'))]
        with concurrent.futures.ProcessPoolExecutor(max_workers=max(4, min(16, len(trabajos)))) as ex:
            for pais, cuenta in ex.map(etiquetas_csv, trabajos):
                faltan = {e: n for e, n in cuenta.items() if e not in paises[pais]['etiquetas']}
                sobran = [e for e in paises[pais]['etiquetas'] if e not in cuenta]
                cobertura[pais] = {'etiquetas_csv': len(cuenta), 'faltan': faltan, 'sobran': sobran}
                for e, n in faltan.items():
                    errores.append(f'{pais}: la etiqueta «{e}» del CSV ({n} filas) no está en la tabla')

    contraste = []
    if not a.sin_red:
        with concurrent.futures.ThreadPoolExecutor(max_workers=a.hilos) as ex:
            contraste = list(ex.map(contrastar, list(cambios_de(tablas))))

    hoy = datetime.date.today().isoformat()
    registro = {
        'descripcion': 'Partido canónico de cada etiqueta de la columna party de los CSV de ParlaIbero, por país '
                       '(fuentes en datos/partidos/, tools/partidos_parlaibero.py).',
        'generado': hoy,
        'paises': paises,
        'resumen': {p: {'etiquetas': len(r['etiquetas']), 'partidos': len(r['partidos']), 'tipo': r['tipo']} for p, r in paises.items()},
    }
    if errores:
        print('\n'.join(errores), file=sys.stderr)
        print(f'{len(errores)} errores: no se escribe el registro.', file=sys.stderr)
    else:
        with open(a.salida, 'w', encoding='utf-8') as f:
            json.dump(registro, f, ensure_ascii=False, indent=1)
            f.write('\n')

    lineas = [f'# Partidos homogéneos de ParlaIbero ({hoy})', '', '| País | Tipo | Etiquetas | Partidos | Cambios confirmados |', '|---|---|---|---|---|']
    for p, r in paises.items():
        cs = [x for x in contraste if x[0][0] == p]
        ok = sum(1 for x in cs if x[1] == 'fecha')
        lineas.append(f'| {p} | {r["tipo"]} | {len(r["etiquetas"])} | {len(r["partidos"])} | {ok} de {len(cs)} |' if cs else f'| {p} | {r["tipo"]} | {len(r["etiquetas"])} | {len(r["partidos"])} | — |')
    pend = [x for x in contraste if x[1] != 'fecha']
    if pend:
        lineas += ['', '## Cambios de nombre o inicios sin la fecha completa en su fuente', '']
        for (pais, sigla, c), res, motivo in pend:
            lineas.append(f'- {pais} · {sigla}: {c.get("de") or "inicio"} → {c.get("a")} ({c.get("fecha")}) — '
                          f'{"solo el año" if res == "año" else motivo} · {c.get("fuente")}')
    if cobertura:
        lineas += ['', '## Cobertura de los CSV', '']
        for p, c in cobertura.items():
            lineas.append(f'- {p}: {c["etiquetas_csv"]} etiquetas en el CSV; faltan {len(c["faltan"])}; en la tabla y no en el CSV: {len(c["sobran"])}')
    revisar = [(p, x) for p, t in tablas.items() for x in t.get('revisar') or []]
    if revisar:
        lineas += ['', '## Decisiones para revisar', '']
        for p, x in revisar:
            lineas.append(f'- {p} · {", ".join(x.get("etiquetas") or [])}: {x.get("decision", "")} '
                          f'(alternativa: {x.get("alternativa", "—")}). {x.get("motivo", "")}')
    if avisos:
        lineas += ['', '## Avisos', ''] + [f'- {x}' for x in avisos]
    if errores:
        lineas += ['', '## Errores (registro no escrito)', ''] + [f'- {x}' for x in errores]
    informe = a.informe or os.path.splitext(a.salida)[0] + '.informe.md'
    with open(informe, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lineas) + '\n')
    print(f'{len(paises)} países · {sum(len(r["etiquetas"]) for r in paises.values())} etiquetas → '
          f'{sum(len(r["partidos"]) for r in paises.values())} partidos · {len(errores)} errores · {len(avisos)} avisos · '
          f'{sum(1 for x in contraste if x[1] == "fecha")} de {len(contraste)} fechas confirmadas · informe: {informe}')
    return 1 if errores else 0


if __name__ == '__main__':
    sys.exit(main())

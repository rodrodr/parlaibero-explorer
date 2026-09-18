/* ===== src/engine/generated/constantes.js ===== */
// GENERADO por standalone/tools/gen_static.py a partir de app/backend/*.py. No editar a mano.
// Regenerar: /opt/anaconda3/bin/python3 standalone/tools/gen_static.py   (comprobar: --check)
// R2.gen.constantes[módulo][NOMBRE] y R2.gen.constantes_meta {tipos, omitidas}.
(function (R2) {
  'use strict';
  const congelar = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(congelar); Object.freeze(o); } return o; };
  const gen = R2.gen = R2.gen || {};
  gen.constantes = congelar({
 "fuente": {
  "SIN_FUENTE": "Fuente no declarada: el manifest.json de este corpus no tiene la clave «fuente». Cite el conjunto de datos original del que procede.",
  "N_LINEAS": 4,
  "ORIGEN_IMPORTADA": "importada de un paquete .2replib: la cita la declara el archivo y no se ha comprobado con el manifest de ningún corpus",
  "_FORMULA": "=+-@\t\r"
 },
 "search": {
  "INLINE_ID_LIMIT": 900,
  "SESSION_TEXTS_MAX_SPEECHES": 60,
  "SESSION_TEXTS_MAX_CHARS": 250000,
  "DOC_CACHE_MAX_DOCS": 4000,
  "DOC_CACHE_MAX_CHARS": 40000000,
  "IDEOLOGY_ORDER": [
   "EI",
   "I",
   "CI",
   "C",
   "CD",
   "D",
   "ED"
  ],
  "ORDENES": [
   "relevance",
   "date_asc",
   "date_desc",
   "length_desc",
   "length_asc"
  ],
  "_ORDEN_SQL": {
   "date_asc": "s.date ASC, s.num_session ASC, s.ord ASC, s.id ASC",
   "date_desc": "s.date DESC, s.num_session DESC, s.ord DESC, s.id DESC",
   "length_desc": "s.nwords DESC, s.id ASC",
   "length_asc": "s.nwords ASC, s.id ASC"
  },
  "_ORDEN_SQL_PALABRAS": {
   "relevance": "bm25(speeches_fts), s.id ASC",
   "date_asc": "s.date ASC, s.num_session ASC, s.ord ASC, s.id ASC",
   "date_desc": "s.date DESC, s.num_session DESC, s.ord DESC, s.id DESC",
   "length_desc": "s.nwords DESC, s.id ASC",
   "length_asc": "s.nwords ASC, s.id ASC"
  },
  "_ORDEN_SQL_NAVEGAR": {
   "relevance": "s.date ASC, s.num_session ASC, s.ord ASC, s.id ASC",
   "date_asc": "s.date ASC, s.num_session ASC, s.ord ASC, s.id ASC",
   "date_desc": "s.date DESC, s.num_session DESC, s.ord DESC, s.id DESC",
   "length_desc": "s.nwords DESC, s.id ASC",
   "length_asc": "s.nwords ASC, s.id ASC"
  },
  "PUNTUACIONES_CACHE": 4,
  "ENTERO_MAX": 9223372036854775807,
  "FORMAS_MAX_CHARS": 4000000,
  "CATEGORIAS_EXCLUIDAS": [
   "listas",
   "cronica",
   "acotaciones",
   "tablas",
   "notas",
   "cabeceras",
   "etiquetas",
   "otros"
  ],
  "_CAT_BLOQUE": {
   "par": "discurso",
   "turn": "discurso",
   "stage": "acotaciones",
   "chron": "cronica",
   "list": "listas",
   "table": "tablas",
   "note": "notas",
   "art": "cabeceras"
  },
  "_CAT_SEGMENTO": {
   "acot": "acotaciones",
   "note": "notas"
  },
  "_DIACRITICOS_CP": [
   768,
   769,
   770,
   771,
   772,
   774,
   775,
   776,
   777,
   778,
   779,
   780,
   783,
   785,
   795,
   803,
   804,
   805,
   806,
   807,
   808,
   813,
   814,
   816,
   817
  ],
  "_OPS": [
   "AND",
   "NOT",
   "OR"
  ],
  "_AVISO_ORDEN": [
   "date_corrected",
   "legislature_corrected",
   "double_sitting",
   "truncated_end",
   "ocr_loop",
   "government_change_day"
  ]
 },
 "keyness": {
  "KEYNESS_VERSION": 1,
  "MIN_FREQ": 5,
  "UMBRAL_G2": 10.83,
  "P_UMBRAL": 0.001,
  "LIMITE_NEGATIVOS": 50,
  "LOTE_SQL": 500,
  "CORTE_EXCLUSIVO": 6.0,
  "CORTE_MUY_DISTINTIVO": 3.0,
  "CORRECCION_CERO": 0.5,
  "INSIGNIAS": {
   "Exclusivo": "log-ratio ≥ 6 (≥ 64 veces más frecuente que en el resto del corpus) o ausente del resto del corpus",
   "Muy distintivo": "log-ratio entre 3 y 6 (entre 8 y 64 veces más frecuente)",
   "Significativo": "log-ratio < 3 (menos de 8 veces más frecuente), con G² ≥ 10,83"
  },
  "_DIACRITICOS_CP": [
   768,
   769,
   770,
   771,
   772,
   774,
   775,
   776,
   777,
   778,
   779,
   780,
   783,
   785,
   795,
   803,
   804,
   805,
   806,
   807,
   808,
   813,
   814,
   816,
   817
  ],
  "_DIACRITICOS": "̧̨̛̣̤̥̦̭̮̰̱̀́̂̃̄̆̇̈̉̊̋̌̏̑",
  "_USO_PRIVADO": "-󰀀-󿿽􀀀-􏿽",
  "_PLEGADO_ESPECIAL": {
   "µ": "μ",
   "ſ": "s",
   "ẛ": "s",
   "ς": "σ",
   "ϐ": "β",
   "ϑ": "θ",
   "ϕ": "φ",
   "ϖ": "π",
   "ϰ": "κ",
   "ϱ": "ρ",
   "ϵ": "ε",
   "ι": "ι",
   "ǡ": "ǡ"
  }
 },
 "careo": {
  "MIN_WORDS_SYNC": 45,
  "MIN_WORDS_DIAC": 150,
  "MAX_SQL_PARAMS": 900,
  "PESO_ALUSION_NOMBRE": 40.0,
  "PESO_ALUSION_CARGO": 30.0,
  "PESO_INTERRUPCION": 15.0,
  "PESO_MENCION_EXTRA": 3.0,
  "TOPE_MENCION_EXTRA": 9.0,
  "PESO_TURNO": 30.0,
  "DECAIMIENTO_TURNO": 0.6,
  "PESO_OTRA_FAMILIA": 12.0,
  "PESO_PASO_IDEOLOGICO": 4.0,
  "RANGO_DIAC": 10,
  "MAX_PARENTESIS": 3000,
  "IDEOLOGY_SCALE": {
   "EI": 1,
   "I": 2,
   "CI": 3,
   "C": 4,
   "CD": 5,
   "D": 6,
   "ED": 7
  },
  "SIN_DATO": [
   null,
   "",
   "Sin identificar"
  ],
  "PRESIDENCIA_CAMARA": [
   "chair",
   "chair_age",
   "vicechair"
  ],
  "NOTA_SYNC": "Heurística: sugiere réplicas por alusión al apellido o al cargo, interrupciones transcritas, cercanía en el orden del debate y distancia política. No prueba que exista un diálogo.",
  "NOTA_DIAC_FTS": "Heurística: sin índice semántico se usa la coincidencia léxica (bm25) con los términos más frecuentes del discurso; de las 10 más parecidas se prefieren las más alejadas en el tiempo (relevancia relativa × log(1 + años)).",
  "_COLS": ["id", "date", "num_session", "ord", "year", "legislature", "speaker", "rep_id", "rep_name", "party", "sex", "district", "session_type", "nwords"],
  "_SQL_COLS": "id, date, num_session, ord, year, legislature, speaker, rep_id, rep_name, party, sex, district, session_type, nwords",
  "_PLEGADO": [
   [
    192,
    "A"
   ],
   [
    193,
    "A"
   ],
   [
    194,
    "A"
   ],
   [
    195,
    "A"
   ],
   [
    196,
    "A"
   ],
   [
    197,
    "A"
   ],
   [
    199,
    "C"
   ],
   [
    200,
    "E"
   ],
   [
    201,
    "E"
   ],
   [
    202,
    "E"
   ],
   [
    203,
    "E"
   ],
   [
    204,
    "I"
   ],
   [
    205,
    "I"
   ],
   [
    206,
    "I"
   ],
   [
    207,
    "I"
   ],
   [
    209,
    "N"
   ],
   [
    210,
    "O"
   ],
   [
    211,
    "O"
   ],
   [
    212,
    "O"
   ],
   [
    213,
    "O"
   ],
   [
    214,
    "O"
   ],
   [
    217,
    "U"
   ],
   [
    218,
    "U"
   ],
   [
    219,
    "U"
   ],
   [
    220,
    "U"
   ],
   [
    221,
    "Y"
   ],
   [
    224,
    "a"
   ],
   [
    225,
    "a"
   ],
   [
    226,
    "a"
   ],
   [
    227,
    "a"
   ],
   [
    228,
    "a"
   ],
   [
    229,
    "a"
   ],
   [
    231,
    "c"
   ],
   [
    232,
    "e"
   ],
   [
    233,
    "e"
   ],
   [
    234,
    "e"
   ],
   [
    235,
    "e"
   ],
   [
    236,
    "i"
   ],
   [
    237,
    "i"
   ],
   [
    238,
    "i"
   ],
   [
    239,
    "i"
   ],
   [
    241,
    "n"
   ],
   [
    242,
    "o"
   ],
   [
    243,
    "o"
   ],
   [
    244,
    "o"
   ],
   [
    245,
    "o"
   ],
   [
    246,
    "o"
   ],
   [
    249,
    "u"
   ],
   [
    250,
    "u"
   ],
   [
    251,
    "u"
   ],
   [
    252,
    "u"
   ],
   [
    253,
    "y"
   ],
   [
    255,
    "y"
   ],
   [
    256,
    "A"
   ],
   [
    257,
    "a"
   ],
   [
    258,
    "A"
   ],
   [
    259,
    "a"
   ],
   [
    260,
    "A"
   ],
   [
    261,
    "a"
   ],
   [
    262,
    "C"
   ],
   [
    263,
    "c"
   ],
   [
    264,
    "C"
   ],
   [
    265,
    "c"
   ],
   [
    266,
    "C"
   ],
   [
    267,
    "c"
   ],
   [
    268,
    "C"
   ],
   [
    269,
    "c"
   ],
   [
    270,
    "D"
   ],
   [
    271,
    "d"
   ],
   [
    274,
    "E"
   ],
   [
    275,
    "e"
   ],
   [
    276,
    "E"
   ],
   [
    277,
    "e"
   ],
   [
    278,
    "E"
   ],
   [
    279,
    "e"
   ],
   [
    280,
    "E"
   ],
   [
    281,
    "e"
   ],
   [
    282,
    "E"
   ],
   [
    283,
    "e"
   ],
   [
    284,
    "G"
   ],
   [
    285,
    "g"
   ],
   [
    286,
    "G"
   ],
   [
    287,
    "g"
   ],
   [
    288,
    "G"
   ],
   [
    289,
    "g"
   ],
   [
    290,
    "G"
   ],
   [
    291,
    "g"
   ],
   [
    292,
    "H"
   ],
   [
    293,
    "h"
   ],
   [
    296,
    "I"
   ],
   [
    297,
    "i"
   ],
   [
    298,
    "I"
   ],
   [
    299,
    "i"
   ],
   [
    300,
    "I"
   ],
   [
    301,
    "i"
   ],
   [
    302,
    "I"
   ],
   [
    303,
    "i"
   ],
   [
    304,
    "I"
   ],
   [
    308,
    "J"
   ],
   [
    309,
    "j"
   ],
   [
    310,
    "K"
   ],
   [
    311,
    "k"
   ],
   [
    313,
    "L"
   ],
   [
    314,
    "l"
   ],
   [
    315,
    "L"
   ],
   [
    316,
    "l"
   ],
   [
    317,
    "L"
   ],
   [
    318,
    "l"
   ],
   [
    323,
    "N"
   ],
   [
    324,
    "n"
   ],
   [
    325,
    "N"
   ],
   [
    326,
    "n"
   ],
   [
    327,
    "N"
   ],
   [
    328,
    "n"
   ],
   [
    332,
    "O"
   ],
   [
    333,
    "o"
   ],
   [
    334,
    "O"
   ],
   [
    335,
    "o"
   ],
   [
    336,
    "O"
   ],
   [
    337,
    "o"
   ],
   [
    340,
    "R"
   ],
   [
    341,
    "r"
   ],
   [
    342,
    "R"
   ],
   [
    343,
    "r"
   ],
   [
    344,
    "R"
   ],
   [
    345,
    "r"
   ],
   [
    346,
    "S"
   ],
   [
    347,
    "s"
   ],
   [
    348,
    "S"
   ],
   [
    349,
    "s"
   ],
   [
    350,
    "S"
   ],
   [
    351,
    "s"
   ],
   [
    352,
    "S"
   ],
   [
    353,
    "s"
   ],
   [
    354,
    "T"
   ],
   [
    355,
    "t"
   ],
   [
    356,
    "T"
   ],
   [
    357,
    "t"
   ],
   [
    360,
    "U"
   ],
   [
    361,
    "u"
   ],
   [
    362,
    "U"
   ],
   [
    363,
    "u"
   ],
   [
    364,
    "U"
   ],
   [
    365,
    "u"
   ],
   [
    366,
    "U"
   ],
   [
    367,
    "u"
   ],
   [
    368,
    "U"
   ],
   [
    369,
    "u"
   ],
   [
    370,
    "U"
   ],
   [
    371,
    "u"
   ],
   [
    372,
    "W"
   ],
   [
    373,
    "w"
   ],
   [
    374,
    "Y"
   ],
   [
    375,
    "y"
   ],
   [
    376,
    "Y"
   ],
   [
    377,
    "Z"
   ],
   [
    378,
    "z"
   ],
   [
    379,
    "Z"
   ],
   [
    380,
    "z"
   ],
   [
    381,
    "Z"
   ],
   [
    382,
    "z"
   ],
   [
    416,
    "O"
   ],
   [
    417,
    "o"
   ],
   [
    431,
    "U"
   ],
   [
    432,
    "u"
   ],
   [
    461,
    "A"
   ],
   [
    462,
    "a"
   ],
   [
    463,
    "I"
   ],
   [
    464,
    "i"
   ],
   [
    465,
    "O"
   ],
   [
    466,
    "o"
   ],
   [
    467,
    "U"
   ],
   [
    468,
    "u"
   ],
   [
    469,
    "U"
   ],
   [
    470,
    "u"
   ],
   [
    471,
    "U"
   ],
   [
    472,
    "u"
   ],
   [
    473,
    "U"
   ],
   [
    474,
    "u"
   ],
   [
    475,
    "U"
   ],
   [
    476,
    "u"
   ],
   [
    478,
    "A"
   ],
   [
    479,
    "a"
   ],
   [
    480,
    "A"
   ],
   [
    481,
    "a"
   ],
   [
    486,
    "G"
   ],
   [
    487,
    "g"
   ],
   [
    488,
    "K"
   ],
   [
    489,
    "k"
   ],
   [
    490,
    "O"
   ],
   [
    491,
    "o"
   ],
   [
    492,
    "O"
   ],
   [
    493,
    "o"
   ],
   [
    496,
    "j"
   ],
   [
    500,
    "G"
   ],
   [
    501,
    "g"
   ],
   [
    504,
    "N"
   ],
   [
    505,
    "n"
   ],
   [
    506,
    "A"
   ],
   [
    507,
    "a"
   ],
   [
    512,
    "A"
   ],
   [
    513,
    "a"
   ],
   [
    514,
    "A"
   ],
   [
    515,
    "a"
   ],
   [
    516,
    "E"
   ],
   [
    517,
    "e"
   ],
   [
    518,
    "E"
   ],
   [
    519,
    "e"
   ],
   [
    520,
    "I"
   ],
   [
    521,
    "i"
   ],
   [
    522,
    "I"
   ],
   [
    523,
    "i"
   ],
   [
    524,
    "O"
   ],
   [
    525,
    "o"
   ],
   [
    526,
    "O"
   ],
   [
    527,
    "o"
   ],
   [
    528,
    "R"
   ],
   [
    529,
    "r"
   ],
   [
    530,
    "R"
   ],
   [
    531,
    "r"
   ],
   [
    532,
    "U"
   ],
   [
    533,
    "u"
   ],
   [
    534,
    "U"
   ],
   [
    535,
    "u"
   ],
   [
    536,
    "S"
   ],
   [
    537,
    "s"
   ],
   [
    538,
    "T"
   ],
   [
    539,
    "t"
   ],
   [
    542,
    "H"
   ],
   [
    543,
    "h"
   ],
   [
    550,
    "A"
   ],
   [
    551,
    "a"
   ],
   [
    552,
    "E"
   ],
   [
    553,
    "e"
   ],
   [
    554,
    "O"
   ],
   [
    555,
    "o"
   ],
   [
    556,
    "O"
   ],
   [
    557,
    "o"
   ],
   [
    558,
    "O"
   ],
   [
    559,
    "o"
   ],
   [
    560,
    "O"
   ],
   [
    561,
    "o"
   ],
   [
    562,
    "Y"
   ],
   [
    563,
    "y"
   ]
  ],
  "_PARTICULAS": [
   "de",
   "del",
   "e",
   "i",
   "la",
   "las",
   "los",
   "san",
   "y"
  ],
  "_HON_PLURAL": [
   "senoras",
   "senores",
   "senoritas",
   "sras",
   "sres",
   "srtas"
  ],
  "_HONOR": "(?:senoritas?|senoras?|senores|senor|srtas?|sras?|sres|sr|dona|don|d)\\.?\\s+(?:[a-z]+\\.?\\s+){0,2}"
 },
 "ngram": {
  "ENGINE_VERSION": 2,
  "MAX_TERMS": 12,
  "MIN_PREFIX_CHARS": 3,
  "MAX_PREFIX_INSTANCES": 1000000,
  "MAX_MS_TERMINO": 250,
  "PRESUPUESTO_MS": 400,
  "UMBRAL_NORMAL": 100000,
  "UMBRAL_BAJA": 20000,
  "CACHE_TERMS": 96,
  "FTS_TABLE": "speeches_fts",
  "_MS_APARICION": 7.2e-05,
  "_MS_APARICION_PREFIJO": 0.00014,
  "_MS_DOC_BM25": 0.0012,
  "_MS_DOC_FRASE": 0.0015,
  "_MS_DOC_HIGHLIGHT": 0.03,
  "_OPS": [
   "AND",
   "NEAR",
   "NOT",
   "OR"
  ],
  "_COMILLAS": [
   [
    171,
    "\""
   ],
   [
    187,
    "\""
   ],
   [
    8220,
    "\""
   ],
   [
    8221,
    "\""
   ],
   [
    8222,
    "\""
   ]
  ],
  "_MARCAS": "̀-ͯ᪰-᫿᷀-᷿︠-︯",
  "_ESPECIALES": {
   "ſ": "s"
  },
  "_SEPARA": " "
 },
 "server": {
  "CONFIRMAR_DESDE": 20000,
  "FORMATOS_EXPORT": [
   "csv",
   "json",
   "markdown",
   "citations",
   "bundle"
  ],
  "EXPORT_BYTES_FILA": {
   "csv": 143,
   "json": 446.09,
   "markdown": 191,
   "citations": 178,
   "bundle": 191
  },
  "EXPORT_BYTES_AVISO": {
   "csv": 0,
   "json": 647.6,
   "markdown": 0,
   "citations": 0,
   "bundle": 0
  },
  "EXPORT_FACTOR_TEXTO": {
   "csv": 1.003,
   "json": 1.02,
   "markdown": 1.0015,
   "citations": 0.0,
   "bundle": 0.0
  },
  "LIBERAR_MEMORIA_DESDE": 5000,
  "SIN_CACHE": {
   "Cache-Control": "no-store, must-revalidate",
   "Pragma": "no-cache"
  },
  "_TEXTO_HTTP": [
   [
    404,
    "No existe ese recurso."
   ],
   [
    405,
    "Método no permitido en esta ruta."
   ]
  ],
  "POLITICA_ARGS_WEBVIEW2": "SOFTWARE\\Policies\\Microsoft\\Edge\\WebView2\\AdditionalBrowserArguments"
 },
 "library": {
  "SCHEMA": "\nCREATE TABLE IF NOT EXISTS collections (\n    id          INTEGER PRIMARY KEY AUTOINCREMENT,\n    name        TEXT NOT NULL,\n    description TEXT DEFAULT '',\n    color       TEXT DEFAULT 'indigo',\n    created_at  TEXT NOT NULL,\n    updated_at  TEXT NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS items (\n    id            INTEGER PRIMARY KEY AUTOINCREMENT,\n    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,\n    corpus        TEXT NOT NULL,\n    speech_id     INTEGER NOT NULL,\n    note          TEXT DEFAULT '',\n    tags          TEXT DEFAULT '[]',\n    char_start    INTEGER,\n    char_end      INTEGER,\n    added_at      TEXT NOT NULL,\n    position      INTEGER DEFAULT 0,\n    UNIQUE(collection_id, corpus, speech_id)\n);\nCREATE INDEX IF NOT EXISTS idx_items_col ON items(collection_id, position);\n\nCREATE TABLE IF NOT EXISTS saved_searches (\n    id         INTEGER PRIMARY KEY AUTOINCREMENT,\n    name       TEXT NOT NULL,\n    corpus     TEXT NOT NULL,\n    mode       TEXT NOT NULL,\n    query      TEXT DEFAULT '',\n    filters    TEXT DEFAULT '{}',\n    variants   INTEGER DEFAULT 0,\n    created_at TEXT NOT NULL\n);\n",
  "EXPORT_COLUMNS": ["id", "id_int", "id_session", "date", "legislature", "legislative_session", "session_number", "session_type", "num_session", "ord", "speaker", "rep_name", "id_dep", "rep_id", "sex", "party", "district", "dm_speech", "nwords"],
  "MD_LINEA_FUENTE": "*Fuente: {}*",
  "CIT_TITULO_BIBTEX": "# Cita del conjunto de datos (BibTeX)",
  "CIT_TITULO_RIS": "# Cita del conjunto de datos (RIS)"
 },
 "sessions": {
  "SIDECAR_NAME": "sessions.json",
  "SIDECAR_VERSION": 1,
  "PAGE_VERIFIED": [
   "contiguous",
   "corrected",
   "verso_blank"
  ],
  "_CON_NOMBRE": [
   "presidente",
   "gobierno"
  ]
 },
 "diario": {
  "ENGINE_VERSION": "diario-2",
  "NUMBERING_VERSION": "2",
  "CLASS_RANK": {
   "conflict": 4,
   "order": 3,
   "applause": 2,
   "neutral": 1
  },
  "SPLIT_MIN_WORDS": 300,
  "CHUNK_TAIL": 40,
  "_FOLD": [
   [
    192,
    65
   ],
   [
    193,
    65
   ],
   [
    194,
    65
   ],
   [
    196,
    65
   ],
   [
    199,
    67
   ],
   [
    200,
    69
   ],
   [
    201,
    69
   ],
   [
    202,
    69
   ],
   [
    203,
    69
   ],
   [
    204,
    73
   ],
   [
    205,
    73
   ],
   [
    206,
    73
   ],
   [
    207,
    73
   ],
   [
    209,
    78
   ],
   [
    210,
    79
   ],
   [
    211,
    79
   ],
   [
    212,
    79
   ],
   [
    214,
    79
   ],
   [
    217,
    85
   ],
   [
    218,
    85
   ],
   [
    219,
    85
   ],
   [
    220,
    85
   ],
   [
    224,
    97
   ],
   [
    225,
    97
   ],
   [
    226,
    97
   ],
   [
    228,
    97
   ],
   [
    231,
    99
   ],
   [
    232,
    101
   ],
   [
    233,
    101
   ],
   [
    234,
    101
   ],
   [
    235,
    101
   ],
   [
    236,
    105
   ],
   [
    237,
    105
   ],
   [
    238,
    105
   ],
   [
    239,
    105
   ],
   [
    241,
    110
   ],
   [
    242,
    111
   ],
   [
    243,
    111
   ],
   [
    244,
    111
   ],
   [
    246,
    111
   ],
   [
    249,
    117
   ],
   [
    250,
    117
   ],
   [
    251,
    117
   ],
   [
    252,
    117
   ]
  ],
  "_UPPER": "ABCDEFGHIJKLMNÑOPQRSTUVWXYZÁÉÍÓÚÜ",
  "_CHAIR_NAMES": {},
  "_ROLE_TITLE": {
   "chair": "PRESIDENTE",
   "vicechair": "VICEPRESIDENTE",
   "chair_age": "PRESIDENTE DE EDAD",
   "secretary": "SECRETARIO"
  },
  "_LABELS_TUMULT": [
   [
    "protest",
    "Protestas"
   ],
   [
    "interrup",
    "Interrupciones"
   ],
   [
    "interrump",
    "Interrupciones"
   ],
   [
    "no se",
    "Voces"
   ],
   [
    "increp",
    "Protestas"
   ],
   [
    "rumor",
    "Rumores"
   ],
   [
    "murmull",
    "Rumores"
   ]
  ],
  "_LABELS_GESTURE": [
   [
    "asentimiento",
    "Asentimiento"
   ],
   [
    "firmacion",
    "Asentimiento"
   ],
   [
    "denegacion",
    "Denegaciones"
   ],
   [
    "pausa",
    "Pausa"
   ],
   [
    "palabra",
    "Piden la palabra"
   ]
  ],
  "_MESES": "ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE",
  "_JOIN_STOP": [
   "a",
   "al",
   "con",
   "de",
   "del",
   "el",
   "en",
   "es",
   "esa",
   "ese",
   "eso",
   "ha",
   "hay",
   "he",
   "la",
   "las",
   "le",
   "les",
   "lo",
   "los",
   "mas",
   "me",
   "mi",
   "ni",
   "no",
   "nos",
   "o",
   "os",
   "por",
   "pues",
   "que",
   "se",
   "si",
   "su",
   "sus",
   "tan",
   "te",
   "un",
   "una",
   "y",
   "ya",
   "yo"
  ],
  "_MAX_PAREN": 900,
  "_MAX_OPEN_WORDS": 30,
  "_MAX_CHAIN": 12,
  "_PRET1_STOP": [
   "bebe",
   "bide",
   "bufe",
   "cabriole",
   "cafe",
   "canape",
   "carne",
   "chale",
   "clise",
   "comite",
   "consome",
   "corse",
   "este",
   "fue",
   "parque",
   "porque",
   "pure",
   "que",
   "rape"
  ],
  "_PL1_STOP": [
   "animos",
   "blasfemos",
   "centimos",
   "decimos",
   "diezmos",
   "extremos",
   "gemos",
   "intimos",
   "legitimos",
   "lemos",
   "maximos",
   "memos",
   "minimos",
   "mismos",
   "optimos",
   "postremos",
   "primos",
   "proximos",
   "quimos",
   "racimos",
   "ramos",
   "remos",
   "supremos",
   "temos",
   "ultimos",
   "unanimos"
  ],
  "_TERM_CHARS": ".!?…:»\"”",
  "_ABBR": [
   "a",
   "aprox",
   "art",
   "arts",
   "c",
   "ca",
   "cap",
   "cit",
   "col",
   "cts",
   "cía",
   "d",
   "dn",
   "dr",
   "dña",
   "e",
   "ee",
   "etc",
   "excma",
   "excmo",
   "fr",
   "gen",
   "gral",
   "hnos",
   "ibíd",
   "id",
   "ilma",
   "ilmo",
   "n",
   "num",
   "nums",
   "núm",
   "núms",
   "o",
   "ob",
   "op",
   "p",
   "pag",
   "pags",
   "pp",
   "ptas",
   "pts",
   "pág",
   "págs",
   "r",
   "s",
   "sig",
   "sigs",
   "sr",
   "sra",
   "sres",
   "srta",
   "ss",
   "tit",
   "tít",
   "ud",
   "uds",
   "uu",
   "v",
   "vd",
   "vds",
   "vol"
  ]
 }
});
  gen.constantes_meta = congelar({
 "tipos": {
  "fuente": {
   "SIN_FUENTE": "str",
   "N_LINEAS": "int",
   "ORIGEN_IMPORTADA": "str",
   "_FORMULA": "str"
  },
  "search": {
   "INLINE_ID_LIMIT": "int",
   "SESSION_TEXTS_MAX_SPEECHES": "int",
   "SESSION_TEXTS_MAX_CHARS": "int",
   "DOC_CACHE_MAX_DOCS": "int",
   "DOC_CACHE_MAX_CHARS": "int",
   "IDEOLOGY_ORDER": {
    "tipo": "tuple",
    "elementos": "str"
   },
   "ORDENES": {
    "tipo": "tuple",
    "elementos": "str"
   },
   "_ORDEN_SQL": {
    "tipo": "dict",
    "valores": {
     "date_asc": "str",
     "date_desc": "str",
     "length_desc": "str",
     "length_asc": "str"
    }
   },
   "_ORDEN_SQL_PALABRAS": {
    "tipo": "dict",
    "valores": {
     "relevance": "str",
     "date_asc": "str",
     "date_desc": "str",
     "length_desc": "str",
     "length_asc": "str"
    }
   },
   "_ORDEN_SQL_NAVEGAR": {
    "tipo": "dict",
    "valores": {
     "relevance": "str",
     "date_asc": "str",
     "date_desc": "str",
     "length_desc": "str",
     "length_asc": "str"
    }
   },
   "PUNTUACIONES_CACHE": "int",
   "ENTERO_MAX": "int",
   "FORMAS_MAX_CHARS": "int",
   "CATEGORIAS_EXCLUIDAS": {
    "tipo": "tuple",
    "elementos": "str"
   },
   "_CAT_BLOQUE": {
    "tipo": "dict",
    "valores": {
     "par": "str",
     "turn": "str",
     "stage": "str",
     "chron": "str",
     "list": "str",
     "table": "str",
     "note": "str",
     "art": "str"
    }
   },
   "_CAT_SEGMENTO": {
    "tipo": "dict",
    "valores": {
     "acot": "str",
     "note": "str"
    }
   },
   "_DIACRITICOS_CP": {
    "tipo": "frozenset",
    "elementos": "int"
   },
   "_OPS": {
    "tipo": "set",
    "elementos": "str"
   },
   "_AVISO_ORDEN": {
    "tipo": "tuple",
    "elementos": "str"
   }
  },
  "keyness": {
   "KEYNESS_VERSION": "int",
   "MIN_FREQ": "int",
   "UMBRAL_G2": "float",
   "P_UMBRAL": "float",
   "LIMITE_NEGATIVOS": "int",
   "LOTE_SQL": "int",
   "CORTE_EXCLUSIVO": "float",
   "CORTE_MUY_DISTINTIVO": "float",
   "CORRECCION_CERO": "float",
   "INSIGNIAS": {
    "tipo": "dict",
    "valores": {
     "Exclusivo": "str",
     "Muy distintivo": "str",
     "Significativo": "str"
    }
   },
   "_DIACRITICOS_CP": {
    "tipo": "frozenset",
    "elementos": "int"
   },
   "_DIACRITICOS": "str",
   "_USO_PRIVADO": "str",
   "_PLEGADO_ESPECIAL": {
    "tipo": "dict",
    "valores": {
     "µ": "str",
     "ſ": "str",
     "ẛ": "str",
     "ς": "str",
     "ϐ": "str",
     "ϑ": "str",
     "ϕ": "str",
     "ϖ": "str",
     "ϰ": "str",
     "ϱ": "str",
     "ϵ": "str",
     "ι": "str",
     "ǡ": "str"
    }
   }
  },
  "careo": {
   "MIN_WORDS_SYNC": "int",
   "MIN_WORDS_DIAC": "int",
   "MAX_SQL_PARAMS": "int",
   "PESO_ALUSION_NOMBRE": "float",
   "PESO_ALUSION_CARGO": "float",
   "PESO_INTERRUPCION": "float",
   "PESO_MENCION_EXTRA": "float",
   "TOPE_MENCION_EXTRA": "float",
   "PESO_TURNO": "float",
   "DECAIMIENTO_TURNO": "float",
   "PESO_OTRA_FAMILIA": "float",
   "PESO_PASO_IDEOLOGICO": "float",
   "RANGO_DIAC": "int",
   "MAX_PARENTESIS": "int",
   "IDEOLOGY_SCALE": {
    "tipo": "dict",
    "valores": {
     "EI": "int",
     "I": "int",
     "CI": "int",
     "C": "int",
     "CD": "int",
     "D": "int",
     "ED": "int"
    }
   },
   "SIN_DATO": {
    "tipo": "set",
    "elementos": "str|None"
   },
   "PRESIDENCIA_CAMARA": {
    "tipo": "frozenset",
    "elementos": "str"
   },
   "NOTA_SYNC": "str",
   "NOTA_DIAC_FTS": "str",
   "_COLS": {
    "tipo": "tuple",
    "elementos": "str"
   },
   "_SQL_COLS": "str",
   "_PLEGADO": {
    "tipo": "dict",
    "claves": "int",
    "forma": "lista de pares [clave, valor] ordenada por clave"
   },
   "_PARTICULAS": {
    "tipo": "frozenset",
    "elementos": "str"
   },
   "_HON_PLURAL": {
    "tipo": "frozenset",
    "elementos": "str"
   },
   "_HONOR": "str"
  },
  "ngram": {
   "ENGINE_VERSION": "int",
   "MAX_TERMS": "int",
   "MIN_PREFIX_CHARS": "int",
   "MAX_PREFIX_INSTANCES": "int",
   "MAX_MS_TERMINO": "int",
   "PRESUPUESTO_MS": "int",
   "UMBRAL_NORMAL": "int",
   "UMBRAL_BAJA": "int",
   "CACHE_TERMS": "int",
   "FTS_TABLE": "str",
   "_MS_APARICION": "float",
   "_MS_APARICION_PREFIJO": "float",
   "_MS_DOC_BM25": "float",
   "_MS_DOC_FRASE": "float",
   "_MS_DOC_HIGHLIGHT": "float",
   "_OPS": {
    "tipo": "set",
    "elementos": "str"
   },
   "_COMILLAS": {
    "tipo": "dict",
    "claves": "int",
    "forma": "lista de pares [clave, valor] ordenada por clave"
   },
   "_MARCAS": "str",
   "_ESPECIALES": {
    "tipo": "dict",
    "valores": {
     "ſ": "str"
    }
   },
   "_SEPARA": "str"
  },
  "server": {
   "CONFIRMAR_DESDE": "int",
   "FORMATOS_EXPORT": {
    "tipo": "tuple",
    "elementos": "str"
   },
   "EXPORT_BYTES_FILA": {
    "tipo": "dict",
    "valores": {
     "csv": "int",
     "json": "float",
     "markdown": "int",
     "citations": "int",
     "bundle": "int"
    }
   },
   "EXPORT_BYTES_AVISO": {
    "tipo": "dict",
    "valores": {
     "csv": "int",
     "json": "float",
     "markdown": "int",
     "citations": "int",
     "bundle": "int"
    }
   },
   "EXPORT_FACTOR_TEXTO": {
    "tipo": "dict",
    "valores": {
     "csv": "float",
     "json": "float",
     "markdown": "float",
     "citations": "float",
     "bundle": "float"
    }
   },
   "LIBERAR_MEMORIA_DESDE": "int",
   "SIN_CACHE": {
    "tipo": "dict",
    "valores": {
     "Cache-Control": "str",
     "Pragma": "str"
    }
   },
   "_TEXTO_HTTP": {
    "tipo": "dict",
    "claves": "int",
    "forma": "lista de pares [clave, valor] ordenada por clave"
   },
   "POLITICA_ARGS_WEBVIEW2": "str"
  },
  "library": {
   "SCHEMA": "str",
   "EXPORT_COLUMNS": {
    "tipo": "list",
    "elementos": "str"
   },
   "MD_LINEA_FUENTE": "str",
   "CIT_TITULO_BIBTEX": "str",
   "CIT_TITULO_RIS": "str"
  },
  "sessions": {
   "SIDECAR_NAME": "str",
   "SIDECAR_VERSION": "int",
   "PAGE_VERIFIED": {
    "tipo": "frozenset",
    "elementos": "str"
   },
   "_CON_NOMBRE": {
    "tipo": "tuple",
    "elementos": "str"
   }
  },
  "diario": {
   "ENGINE_VERSION": "str",
   "NUMBERING_VERSION": "str",
   "CLASS_RANK": {
    "tipo": "dict",
    "valores": {
     "conflict": "int",
     "order": "int",
     "applause": "int",
     "neutral": "int"
    }
   },
   "SPLIT_MIN_WORDS": "int",
   "CHUNK_TAIL": "int",
   "_FOLD": {
    "tipo": "dict",
    "claves": "int",
    "forma": "lista de pares [clave, valor] ordenada por clave"
   },
   "_UPPER": "str",
   "_CHAIR_NAMES": {
    "tipo": "dict",
    "valores": {
     "julian besteiro fernandez": "str",
     "santiago alba bonifaz": "str",
     "diego martinez barrio": "str",
     "luis jimenez de asua": "str",
     "manuel jimenez fernandez": "str",
     "francisco barnes salinas": "str",
     "candido casanueva y gorjon": "str",
     "antonio lara zarate": "str",
     "pedro rahola y molinas": "str",
     "manuel marraco ramon": "str",
     "antonio tunon de lara": "str",
     "juan castrillo santos": "str",
     "emilio baeza medina": "str",
     "jose martinez de velasco escolar": "str",
     "luis fernandez clerigo": "str",
     "gregorio arranz olalla": "str",
     "laureano gomez paratcha": "str",
     "fernando suarez de tangil y angulo": "str",
     "claudio sanchez albornoz menduina": "str",
     "alfredo martinez garcia arguelles": "str",
     "jose rosado gil": "str",
     "narciso vazquez lemus": "str"
    }
   },
   "_ROLE_TITLE": {
    "tipo": "dict",
    "valores": {
     "chair": "str",
     "vicechair": "str",
     "chair_age": "str",
     "secretary": "str"
    }
   },
   "_LABELS_TUMULT": {
    "tipo": "tuple",
    "elementos": {
     "tipo": "tuple",
     "elementos": "str"
    }
   },
   "_LABELS_GESTURE": {
    "tipo": "tuple",
    "elementos": {
     "tipo": "tuple",
     "elementos": "str"
    }
   },
   "_MESES": "str",
   "_JOIN_STOP": {
    "tipo": "frozenset",
    "elementos": "str"
   },
   "_MAX_PAREN": "int",
   "_MAX_OPEN_WORDS": "int",
   "_MAX_CHAIN": "int",
   "_PRET1_STOP": {
    "tipo": "frozenset",
    "elementos": "str"
   },
   "_PL1_STOP": {
    "tipo": "frozenset",
    "elementos": "str"
   },
   "_TERM_CHARS": "str",
   "_ABBR": {
    "tipo": "frozenset",
    "elementos": "str"
   }
  }
 },
 "omitidas": {
  "fuente": {
   "_CONTROL": "expresión regular (regex_manifest.json)",
   "_YAML_NO_IMPRIMIBLE": "expresión regular (regex_manifest.json)"
  },
  "search": {
   "DOC_CACHE": "no serializable: _DocCache",
   "CLIMATE_CACHE": "no serializable: _DocCache",
   "_PALABRA_NO_ASCII": "expresión regular (regex_manifest.json)",
   "PROSE_CACHE": "no serializable: _DocCache",
   "_TOKEN": "expresión regular (regex_manifest.json)",
   "_TIENE_TERMINO": "expresión regular (regex_manifest.json)",
   "VACIAS": "en un archivo propio (vacias.js / hitos.js)",
   "_HUELLAS": "caché mutable"
  },
  "keyness": {
   "_VACIAS_TEXTO": "en un archivo propio (vacias.js / hitos.js)",
   "_TOKEN_SIMPLE": "expresión regular (regex_manifest.json)",
   "_TOKEN_COMPLETO": "expresión regular (regex_manifest.json)",
   "_RAROS": "expresión regular (regex_manifest.json)",
   "_IDENT": "expresión regular (regex_manifest.json)",
   "STOPWORDS": "en un archivo propio (vacias.js / hitos.js)"
  },
  "careo": {
   "_PREFIJO": "expresión regular (regex_manifest.json)",
   "_CORTE_ETIQUETA": "expresión regular (regex_manifest.json)",
   "_COLA_ACOTACION": "expresión regular (regex_manifest.json)",
   "_PAREN": "expresión regular (regex_manifest.json)",
   "_TOK_PAREN": "expresión regular (regex_manifest.json)",
   "_TRAS_ORADOR": "expresión regular (regex_manifest.json)",
   "_VACIAS_SALA": "en un archivo propio (vacias.js / hitos.js)"
  },
  "ngram": {
   "_TOKEN_RE": "expresión regular (regex_manifest.json)",
   "_TABLA": "caché mutable (se rellena bajo demanda)",
   "_TABLA_LOCK": "no serializable: lock",
   "_FTS5_MEMORIA": "estado mutable",
   "_REGISTRO": "no serializable: OrderedDict",
   "_REGISTRO_LOCK": "no serializable: lock",
   "HITOS": "en un archivo propio (vacias.js / hitos.js)"
  },
  "server": {
   "HERE": "ruta local",
   "ROOT": "ruta local",
   "STATIC_DIR": "ruta local",
   "CORPUS_DIR": "ruta local",
   "MODEL_DIR": "ruta local",
   "STATE": "estado mutable del servidor",
   "_EXPORT_LOCK": "no serializable: lock"
  },
  "library": {},
  "sessions": {
   "_CAMPOS_META": "no serializable: type"
  },
  "diario": {
   "_WORD": "expresión regular (regex_manifest.json)",
   "_LOWER_START": "expresión regular (regex_manifest.json)",
   "_HONOR": "expresión regular (regex_manifest.json)",
   "_ROLE_HOG": "expresión regular (regex_manifest.json)",
   "_ROLE_STATE": "expresión regular (regex_manifest.json)",
   "_ROLE_AGE": "expresión regular (regex_manifest.json)",
   "_ROLE_CAMARA": "expresión regular (regex_manifest.json)",
   "_EXCL_NOTE": "expresión regular (regex_manifest.json)",
   "_EXCL_TEXT": "expresión regular (regex_manifest.json)",
   "_UNIT_SEP": "expresión regular (regex_manifest.json)",
   "_INTERJ": "expresión regular (regex_manifest.json)",
   "_WHO_CHAIR": "expresión regular (regex_manifest.json)",
   "_SAY_BRAVO": "expresión regular (regex_manifest.json)",
   "_CHAIR_SUBJ": "expresión regular (regex_manifest.json)",
   "_CHAIR_ACT": "expresión regular (regex_manifest.json)",
   "_CAMPANILLA": "expresión regular (regex_manifest.json)",
   "_APPROVAL": "expresión regular (regex_manifest.json)",
   "_TUMULT": "expresión regular (regex_manifest.json)",
   "_LAUGH": "expresión regular (regex_manifest.json)",
   "_OVATION": "expresión regular (regex_manifest.json)",
   "_GESTURE": "expresión regular (regex_manifest.json)",
   "_UNIT_HINT": "expresión regular (regex_manifest.json)",
   "_PP_SEP": "expresión regular (regex_manifest.json)",
   "_HDR_ONLY": "expresión regular (regex_manifest.json)",
   "_HDR_PREFIX": "expresión regular (regex_manifest.json)",
   "_HDR_DATE": "expresión regular (regex_manifest.json)",
   "_LEAD_SPEAKER": "expresión regular (regex_manifest.json)",
   "_HYPH_END": "expresión regular (regex_manifest.json)",
   "_NEXT_TOKEN": "expresión regular (regex_manifest.json)",
   "_SOFT": "expresión regular (regex_manifest.json)",
   "_BRACKET": "expresión regular (regex_manifest.json)",
   "_DASH_AFTER": "expresión regular (regex_manifest.json)",
   "_DASH_UNIT": "expresión regular (regex_manifest.json)",
   "_LOOSE_SEP": "expresión regular (regex_manifest.json)",
   "_CHRON_START": "expresión regular (regex_manifest.json)",
   "_CHRON_END": "expresión regular (regex_manifest.json)",
   "_HEADING": "expresión regular (regex_manifest.json)",
   "_TURN": "expresión regular (regex_manifest.json)",
   "_VOTE_HEAD": "expresión regular (regex_manifest.json)",
   "_TOTAL": "expresión regular (regex_manifest.json)",
   "_NUM_DEP": "expresión regular (regex_manifest.json)",
   "_DEP": "expresión regular (regex_manifest.json)",
   "_NAME_ITEM": "expresión regular (regex_manifest.json)",
   "_NOTE_PARA": "expresión regular (regex_manifest.json)",
   "_SIGNATURE": "expresión regular (regex_manifest.json)",
   "_READ_DOC": "expresión regular (regex_manifest.json)",
   "_ANNEX": "expresión regular (regex_manifest.json)",
   "_FIRST_PERSON_DOC": "expresión regular (regex_manifest.json)",
   "_VOCATIVE": "expresión regular (regex_manifest.json)",
   "_ABS_START": "expresión regular (regex_manifest.json)",
   "_PROC_NOUN": "expresión regular (regex_manifest.json)",
   "_SPEECH_MARK": "expresión regular (regex_manifest.json)",
   "_PRET1": "expresión regular (regex_manifest.json)",
   "_PL1": "expresión regular (regex_manifest.json)",
   "_PAREN_TXT": "expresión regular (regex_manifest.json)",
   "_QUOTED_TXT": "expresión regular (regex_manifest.json)",
   "_ACTA_VERB": "expresión regular (regex_manifest.json)",
   "_LEADERS": "expresión regular (regex_manifest.json)",
   "_NEXT_CAP": "expresión regular (regex_manifest.json)",
   "_OCR_HYPH": "expresión regular (regex_manifest.json)",
   "_PUNCT_ONLY": "expresión regular (regex_manifest.json)",
   "_HAS_WORD": "expresión regular (regex_manifest.json)",
   "_SENT_END": "expresión regular (regex_manifest.json)"
  }
 },
 "excluidas": {
  "motivo": "búsqueda con vectores o exclusiva del escritorio: no existe en Standalone",
  "por_modulo": {
   "careo": 1,
   "search": 8
  }
 }
});
})(globalThis.R2 = globalThis.R2 || {});

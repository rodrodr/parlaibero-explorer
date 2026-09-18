/* ===== src/engine/diario.js ===== */
// 2REP_Standalone · src/engine/diario.js
//
// R2.diario: port de app/backend/diario.py (motor de texto parlamentario: párrafos §, acotaciones, oradores y clima de
// sala). Mismas reglas, mismas expresiones regulares (a través de R2.py.re, con la semántica de sre) y mismos textos.
//
//   doc = R2.diario.parse_speech(texto, speaker_raw, rep_name)
//   R2.diario.parse_speaker(raw, rep_name?)   R2.diario.classify_segment(inner)
//   R2.diario.climate(doc | texto)            R2.diario.paragraphs(doc)            R2.diario.plain_text(doc, texto)
//
// El documento es idéntico al de diario.py: json.dumps(doc, sort_keys=True, ensure_ascii=False) da el mismo sha1.
// Posiciones: índices UTF-16 (iguales a los de Python mientras no haya caracteres fuera del BMP; el corpus no tiene).
//
// Los patrones (PAT) son los de src/engine/generated/regex_manifest.json para app/backend/diario.py con sha256
// d257979420e81a398eb49f7c319735573ea661cf1592a9007fecdb33ebc79d7b (clave = nombre o función:línea del backend).
//
// Firefox (SpiderMonkey) agota la pila de retroceso con _DASH_UNIT sobre rachas de ≥ 3.000 blancos
// (R2.py.re.error con motorAgotado): en ese caso se usa un recorrido manual equivalente (_dashUnitManual).
//
// Funciones puras, sin base de datos. Dependencias (src/orden.json): R2.py.core, R2.py.re, R2.gen.constantes.diario.
(function (R2) {
  'use strict';

  const falta = [
    ['R2.py.core', R2.py && R2.py.core], ['R2.py.re', R2.py && R2.py.re],
    ['R2.gen.constantes.diario', R2.gen && R2.gen.constantes && R2.gen.constantes.diario],
  ].filter(([, m]) => !m).map(([n]) => n);
  if (falta.length) throw new Error(`engine/diario.js necesita cargados antes: ${falta.join(', ')} (src/orden.json)`);

  const C = R2.py.core;
  const RE = R2.py.re;
  const K = R2.gen.constantes.diario;

  const ENGINE_VERSION = 'diario-2';
  const NUMBERING_VERSION = '2';
  if (K.ENGINE_VERSION !== ENGINE_VERSION || K.NUMBERING_VERSION !== NUMBERING_VERSION) {
    throw new Error(`engine/diario.js (${ENGINE_VERSION}/${NUMBERING_VERSION}) no coincide con generated/constantes.js `
      + `(${K.ENGINE_VERSION}/${K.NUMBERING_VERSION}): regenerar o actualizar el port`);
  }

  const CLASS_RANK = Object.freeze({ conflict: 4, order: 3, applause: 2, neutral: 1 });
  const SPLIT_MIN_WORDS = 300;
  const CHUNK_MIN = 120, CHUNK_TARGET = 160, CHUNK_MAX = 200;
  const CHUNK_TAIL = 40;
  const _MAX_PAREN = 900;
  const _MAX_OPEN_WORDS = 30;
  const _MAX_CHAIN = 12;
  const _TERM_CHARS = '.!?…:»"”';

  const PAT = {
    "_WORD": ["\\w+", 0],
    "_LOWER_START": ["[a-záéíóúüñ]", 0],
    "_HONOR": ["^\\s*(?P<art>E[lIi1L]|Fl|En|Er\\.?|La|LA|Los|LOS|Las|Una|Un|Varios|Algunos|Muchos|Otros|Otro)\\s*(?P<tr>Srta|Sres|Sra|SR|Sr|Señorita|señorita|Señores|señores|Señora|señora|Señor|señor|SEÑOR)[.,]?\\s*", 0],
    "_ROLE_HOG": ["PRESIDEN?T\\w*\\W+DE+L?\\W+(?:CONSE[JIL1]O|GOBIERNO)", 0],
    "_ROLE_STATE": ["PRESIDENTE\\W+DE\\W+LA\\W+REPUBLICA", 0],
    "_ROLE_AGE": ["PRESIDENTE\\W+DE\\W+EDAD", 0],
    "_ROLE_CAMARA": ["PRESIDENTE\\W+DE\\W+LA\\W+CAMARA", 0],
    "_surname:L150": ["\\s[Yy]\\s", 0],
    "_surname:L168": ["^(?:(?:[Dd]e|[Dd]el|[Ll]a|[Ll]os|[Ll]as)\\s+)+", 0],
    "_parse_speaker_cached:L211": ["\\s*:\\s*$", 0],
    "_parse_speaker_cached:L220": ["^(?:Sres|Varios|Algunos|Muchos)\\b", 0],
    "_parse_speaker_cached:L227": ["\\(([^()]{1,80})\\)\\s*\\.?\\s*(.*)$", 0],
    "_parse_speaker_cached:L235": ["^([^,]+?),\\s+([a-záéíóúñ].*)$", 0],
    "_parse_speaker_cached:L239": ["^(?:D|Don|don|Doña)\\b", 0],
    "_parse_speaker_cached:L241": ["\\s+", 0],
    "_parse_speaker_cached:L244": ["[^A-Z]", 0],
    "_parse_speaker_cached:L260": ["^S\\.\\s*PRESIDENTE$", 0],
    "parse_speaker:L285": ["\\bPresident\\b", 0],
    "parse_speaker:L285#2": [",\\s+del\\b", 0],
    "parse_speaker:L286": ["\\bPRESIDENT\\b", 0],
    "parse_speaker:L292": ["^[A-ZÁÉÍÓÚÑ]", 0],
    "parse_speaker:L292#2": ["^(?:D|Don)\\b\\.?", 0],
    "_EXCL_NOTE": ["^(?:vease|veanse|vid\\.|nota\\b)|\\bapendice\\b", 0],
    "_EXCL_TEXT": ["^(?:d|don|dona|dna|sr|sra|srta|sres|excmo|ilmo)\\.?(?:\\s|$)|^(?:art|arts|articulos?|ley|leyes|decreto|real orden|r\\.\\s*o|gaceta|capitulo|titulo|seccion|base|pagina|pag|pags|num|numero|folio|tomo|libro|parrafo|apartado|inciso|anexo|estado|cuadro|grafico|provincia|capital|distrito|circunscripcion)\\b|^[\\d\\s.,;:º°ª*/\\-]+$|^[a-z]\\)?$|^(?:bis|idem|sic|id\\.)\\b", 0],
    "_UNIT_SEP": ["(?<=[.!?…»\\\"”)])\\s*[—–]+\\s*|\\s+[—–]+\\s+|(?<=\\w)[—–]{1,2}(?=\\s*(?:El|La|Los|Un|Una|Varios|Algunos|Muchos|Otro|Otros|Grandes|Fuertes|Nuevos|Nuevas|Rumores|Risas|Aplausos|Protestas|Muy)\\b)|\\.-\\s*|(?<=[.!?])\\s+(?=(?:El|La|Los|Un|Una|Varios|Algunos|Muchos|Otro|Otros)\\s+(?:Sr|Sra|Srta|Sres|señor|señora|señores|Diputados?)\\b)", 0],
    "_INTERJ": ["^(?P<who>(?:(?:el|la|los|las|un|una|unos|varios|algunos|muchos|otro|otros|el mismo|la misma|diversos|numerosos)\\s+(?:sr|sra|srta|sres|senor|senora|senorita|senores|diputados?|ministros?|presidente|secretario)\\b\\.?|voces|una voz|varias voces|otra voz|el presidente|la presidencia)[^:()]{0,90}?)\\s*:\\s*(?P<say>\\S.*)$", 16],
    "_WHO_CHAIR": ["\\bpresiden(?:te|cia)\\b(?!\\W+(?:del?\\W+)?(?:consejo|gobierno))", 0],
    "_SAY_BRAVO": ["^[¡!\\s\\\"]*(?:muy bien|bravo)\\b", 0],
    "_CHAIR_SUBJ": ["\\b(?:presidente|presidencia|mesa)\\b(?!\\W+(?:del?\\W+)?(?:consejo|gobierno))", 0],
    "_CHAIR_ACT": ["\\b(?:agita|agitando|reclama|reclamando|llama|llamando|impone|imponiendo|ruega|rogando|pide silencio|restablece|toca|tocando|hace sonar|haciendo sonar|requiere|amonesta|apercibe)\\b|campanill", 0],
    "_CAMPANILLA": ["campanill", 0],
    "_APPROVAL": ["\\b(?:rumores?|voces|murmullos?|muestras|manifestaciones|signos|senales|grandes|generales?)\\s+(?:\\w+\\s+)?de\\s+aprobacion|^aprobacion(?:es)?\\b|\\baprobacion(?:es)? (?:en|de)\\b", 0],
    "_TUMULT": ["rumor|protest|interrump|interrup|no se (?:perciben?|oyen?|entienden?|oia|percibian|entendian)|increp|murmull|tumult|alborot|escandalo|siseo|gritos|\\bvoces\\b|exclamacion|contradictori|encontrados|imprecacion|golpes|patea|confusion|agitacion|denuesto|apostrof|desorden|griteria|abucheo|silbidos|se increpan|vociferan|increpan|dicterios|pugilato|incidente|muy mal\\b", 0],
    "_LAUGH": ["\\brisa|\\bsonrisa|hilaridad|carcajada", 0],
    "_OVATION": ["aplau|apiaus|apluo|ovaci|muy bien|\\bbravo|\\bvivas?\\b|vitore|felicitacion|enhorabuena|palmas", 0],
    "_GESTURE": ["asentimiento|a ?i?firmacion|airmacion|negacion|sensacion|\\bpausa\\b|senalando|senala\\b|dirigiendose|se dirige|piden? la palabra|pidiendo la palabra|signos?\\b|\\bgestos?\\b|ademan|leyendo|\\bleyo\\b|\\blee\\b|ocupa(?:ndo)? la presidencia|ocupo la presidencia|entra(?:ndo)? en el salon|entra en la camara|sale(?:n)? del salon|abandona|se (?:levanta|levantan|sienta|sientan|retira|retiran)|mostrando|golpeando|exhibiendo|volviendose|en voz baja|con energia|conversacion|silencio|expectacion|atencion|suficiente numero|asi se hace|aludiendo|refiriendose|continua (?:leyendo|hablando)|sonriendo|riendo|extendiendo|levantando|agitando|en pie|de pie|niega|negando|asintiendo|afirmando|interrumpe|hace uso de la palabra|con el brazo|con la mano|emocion|apostrofando", 0],
    "_classify_unit:L431": ["[^\\W\\d_]", 0],
    "_classify_unit:L435": ["(?:consejo|gobierno)", 0],
    "_UNIT_HINT": ["[—–]|\\.-|[.!?]\\s+[ELUVAMO]", 0],
    "classify_segment:L502": ["[¡¿\\\"]?[A-ZÁÉÍÓÚÑ]", 0],
    "_PP_SEP": ["[ \\t\\r]*\\n[ \\t\\r]*\\n\\s*", 0],
    "_HDR_ONLY": ["\\\"?(?:N[ÚU]MERO\\s+\\d{1,3}(?:\\s+\\d{2,5})?|(?:\\d{1,5}\\)?\\s+)?\\d{1,2}\\s+DE\\s+(?:ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\\s+DE\\s+19\\d\\d|\\d{3,5}(?:\\s*—)?)\\s*$", 0],
    "_HDR_PREFIX": ["\\\"?(?:N[ÚU]MERO\\s+\\d{1,3}\\s+\\d{2,5}\\s+|(?:\\d{1,5}\\)?\\s+)?\\d{1,2}\\s+DE\\s+(?:ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\\s+DE\\s+19\\d\\d\\s+(?=[a-záéíóúñ]))", 0],
    "_HDR_DATE": ["\\d{1,2}\\s+DE\\s+(?:ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\\s+DE\\s+19\\d\\d", 0],
    "_LEAD_SPEAKER": ["^\\s*\\(([^()\\n]{1,40})\\)\\s*:\\s*", 0],
    "_HYPH_END": ["([^\\W\\d_]+)([\\-\\xad]+)$", 0],
    "_NEXT_TOKEN": ["(?:[¡!:<|]\\s?|\\d\\s)?([^\\W\\d_]+)", 0],
    "_SOFT": ["­+", 0],
    "_BRACKET": ["(?<![\\\\\\w$])([\\[{])(?=[^\\W\\d_])", 0],
    "_join_fix:L612": ["[a-záéíóúñ,;]$", 0],
    "_join_fix:L617": ["\\s\\d{4,5}$", 0],
    "_DASH_AFTER": ["\\s*[—–]+\\s*(?=[A-ZÁÉÍÓÚÑ¡¿])", 0],
    "_DASH_UNIT": ["[^—–()\\n]{1,120}?(?:[.!?…]|(?=\\s*[—–)]))", 0],
    "_match_parens:L770": ["[()]", 0],
    "_match_parens:L778": ["(?:^|[\\s(—])(?:[a-zA-Z]|\\d{1,2})$", 0],
    "_LOOSE_SEP": ["(?:(?<=[.!?…])\\s*[—–]+\\s*|\\s+[—–]+\\s+)", 0],
    "_CHRON_START": ["\\\"?(?:Se (?:ley[óo]|leyeron|di[óo] (?:lectura|cuenta)|aprob[óo]|aprobaron|procedi[óo]|anunci[óo]|acord[óo]|entr[óo]|pas[óo] a|tom[óo]|levant[óo]|suspendi[óo]|reanud[óo]|verific[óo]|dieron|expres[óo])|Verificad[oa]s?\\b|Eran las\\b|Era la una\\b|Le[íi]d[oa]s?\\b|Hecha la (?:pregunta|oportuna|aportuna|correspondiente|propuesta|petici[óo]n|consignaci[óo]n|aclaraci[óo]n|votaci[óo]n|declaraci[óo]n)\\b|Hecho (?:as[íi]|el (?:recuento|traspaso|extracto))\\b|Sin (?:m[áa]s )?(?:discusi[óo]n|debate)|Tambi[ée]n (?:se (?:ley|anunci|di[óo]\\b|dio\\b|acord|aprob|tom[óo]|concedi|comunic|pas[óo]|levant|suspendi|remiti)|fu[ée] |fueron |qued)|Asimismo (?:se (?:ley|anunci|di[óo]\\b|dio\\b|acord|aprob|tom[óo]|concedi|comunic|pas[óo]|remiti)|fu[ée] |fueron |qued)|Previa (?:la |el )?(?:venia|lectura|autorizaci[óo]n|declaraci[óo]n|correspondiente|oportuna|pregunta|votaci[óo]n)|Continuando (?:la|el) (?:discusi[óo]n|debate|interpelaci[óo]n|deliberaci[óo]n|votaci[óo]n|lectura)\\b|Reanudad[ao]|Abierta (?:la )?discusi[óo]n|Acto seguido|Qued(?:[óo]|aron) (?:aprobad|pendiente|sobre la mesa|enterad|acordad|desechad|retirad|redactad|en suspenso|admitid|tomad|nombrad|elegid|proclamad)|Las Cortes (?:quedaron|acordaron|aprobaron)|La C[áa]mara (?:acord[óo]|qued[óo]|aprob[óo])|Fu(?:[ée]|eron) (?:aprobad|tomad|desechad|le[íi]d|retirad|rechazad|admitid|proclamad|elegid)|Puest[oa]s? a votaci[óo]n|Tomad[oa] en consideraci[óo]n|Por el (?:Sr\\.|señor) Secretario|El (?:Sr\\.|señor) (?:SECRETARIO|Secretario)(?: \\([^)]{0,60}\\))?,? (?:di[óo]|ley[óo]|lee|anunci[óo]|hizo|dijo así)|Dada cuenta|Concedida la palabra|Ocup[óo] la Presidencia|Orden del d[íi]a para|ORDEN DEL D[IÍ]A|Palacio de las Cortes|Palacio del Congreso|Terminad[ao] la (?:votaci|lectura)|Efectuad[ao] la|Practicad[ao] la|Retirad[ao] (?:la|el|por)|Desechad[ao] (?:la|el)|Aprobad[oa]s? (?:sin|el|la|los|las|definitivamente)|Hecho el escrutinio)", 0],
    "_CHRON_END": ["(?:,|\\)|\\bdij[oe])\\s*dijo\\s*:?\\s*$|\\bdijo\\s*:\\s*$|,\\s*dijo\\s*$", 0],
    "_HEADING": ["^[^a-záéíóúñ]{3,160}$", 0],
    "_TURN": ["(?P<who>(?:El|La|Los|Un|Una|Varios|Algunos|Muchos|Otro)\\s+(?:Sr|Sra|Srta|Sres|señor|señora|señorita|señores)[.,]?\\s+(?:[A-ZÁÉÍÓÚÑ][\\w'´’\\-]*\\.?)(?:\\s+(?:[A-ZÁÉÍÓÚÑ][\\w'´’\\-]*\\.?|de|del|la|las|los|y|e|i|pública|públicas|sin))*(?:\\s+de\\s+la\\s+(?:minoría|mayoría|Comisión)(?:\\s+[a-záéíóúñ]+)?)?(?:\\s*\\([^()]{1,40}\\))?)\\s*:\\s+(?=\\S)", 0],
    "_VOTE_HEAD": ["^Se(?:ñ|n|fi)ores que (?:dijeron|han dicho|votaron|contestaron)\\b", 0],
    "_TOTAL": ["^Total(?:es)?\\s*[,:.]?\\s*\\d[\\d.]*\\s*\\.?\\s*$", 0],
    "_NUM_DEP": ["^N[úu]mero\\s+\\d+\\s*\\.?\\s*[—–\\-]+\\s*D", 0],
    "_DEP": ["^D(?:\\.|oña|\\.ª)\\s+[A-ZÁÉÍÓÚÑ]", 0],
    "_NAME_ITEM": ["^(?:(?:[A-ZÁÉÍÓÚÑ][\\w'´’\\-]*\\.?|de|del|la|las|los|y|i|e|d'|D')(?:\\s*,\\s*|\\s+|$))+(?:\\((?:D|Don|Doña|Sra|Srta)\\.?[^()]{0,30}\\))?\\s*\\.?\\s*$", 0],
    "_NOTE_PARA": ["^(?:\\(\\s*V[ée]ase\\b[^()]*\\)\\.?|Nota\\s*[.:—–])", 0],
    "_SIGNATURE": ["\\\"?Palacio (?:de las Cortes|del Congreso)", 0],
    "_READ_DOC": ["[\\\"“«]?\\s*(?:Excm[oa]s?\\.?\\s+(?:Sres?\\.|Señor)|Ilm[oa]s?\\.?\\s+Sr\\.|A la Mesa del Congreso|A las Cortes(?: Constituyentes)?\\s*[:.—]|Al Congreso\\s*[:.—]|A la C[áa]mara\\s*[:.—]|Al (?:Excmo\\.?\\s+)?(?:Sr\\.|señor) (?:Ministro|Presidente|Director|Subsecretario|Gobernador)|Sr\\. Presidente\\s*:|Señor (?:D\\.|Don) [^:]{3,60}:|Muy señor|Distinguid[oa]s? señor|El Diputado que (?:sus?cribe|firma)|Los Diputados que (?:sus?criben|firman))", 0],
    "_ANNEX": ["(?i)(?:datos|documentos?|cuadros?|estados?|notas?|relaci[óo]n|textos?|cartas?)\\b[^.:]{0,60}?\\ba que (?:se )?(?:ha|han) (?:hecho )?referi\\w*(?:(?!\\b(?:es|son|no|fue|fué|fueron|era|eran|está|están|parece|parecen|resulta|resultan|dice|dicen)\\b)[^;:?!]){0,90}[.:]?\\s*$", 0],
    "_FIRST_PERSON_DOC": ["(?i)ruegos?\\b|preguntas?\\b|cartas?\\b|comunicaci|telegram|escritos?\\b|exposici|instancias?\\b|moci[óo]n|mensajes?\\b|proposici|enmiendas?\\b|votos? particular|documentos?\\b|oficios?\\b|declaraci|manifiesto|dice as[íi]|lo siguiente|referencia", 0],
    "_VOCATIVE": ["(?:^|[,;:.!?]\\s*)(?:[Ss]eñores|Sres\\.)\\s+Diputados\\s*[,:;.!]", 0],
    "_ABS_START": ["\\\"?(?:No (?:habiendo|hall[áa]ndose)|Habiendo|Previo|Concedid[ao]s?|Terminad[ao]s?|Puest[ao]s?|Abiert[ao]|Anunciad[ao]|Suspendid[ao]|Reanudad[ao]|Tomad[ao]s?|Pedid[ao]|Solicitad[ao]|Admitid[ao]s?|Desechad[ao]s?|Rechazad[ao]s?|Seguidamente|A continuaci[óo]n|Acto continuo|Igualmente (?:se|fu[ée]|fueron|qued))\\b", 0],
    "_PROC_NOUN": ["\\b(?:votaci[óo]n|enmiendas?|dictamen|proposici[óo]n|art[íi]culo|art\\.|sesi[óo]n|acta|C[áa]mara|Congreso|Presidencia|Secretar[ií]o|voto particular|Comisi[óo]n|Diario de Sesiones|la palabra|Mesa)\\b", 0],
    "_SPEECH_MARK": ["\\b(?:yo|me|m[ií]|conmigo|nos|nosotr[oa]s|os|vosotr[oa]s|creo|digo|voy|vamos|quiero|queremos|tengo|tenemos|puedo|podemos|debo|debemos|estoy|estamos|soy|somos|he|hemos|pido|pedimos|entiendo|estimo|insisto|supongo|reconozco|agradezco|permitidme|perdonadme)\\b|\\bSS?\\.\\s?SS?\\.|\\b[Ss]us? [Ss]eñor[ií]as?\\b|[¿¡]|(?:^|[,;:.]\\s*)(?:[Ss]eñores|Sres\\.)\\s+Diputados\\s*[,:;!]|,\\s*señores\\s*[,;.!]|\\b[a-záéíóúñ]{2,}(?:áis|éis)\\b", 0],
    "_PRET1": ["\\b[a-záéíóúñ]{2,}é\\b", 0],
    "_PL1": ["\\b[a-zñ]{2,}(?:amos|emos|imos)\\b", 0],
    "_PAREN_TXT": ["\\([^()]*\\)", 0],
    "_QUOTED_TXT": ["\\\"[^\\\"\\n]{1,400}\\\"|“[^”\\n]{1,400}”|«[^»\\n]{1,400}»", 0],
    "_ACTA_VERB": ["\\b(?:qued[óo]|quedaron|fu[ée]|fueron|acord[óo]|acordaron|aprob[óo]|aprobaron|ley[óo]|leyeron|di[óo]|dieron|pasó|pasaron|resultó|anunció|procedió|levantó|suspendió|tomó|concedió|retiró|desechó|declaró|pidió|verificó|hizo|subió|ocupó|designó|nombró|eligió|contestó|entró|reanudó|abrió|terminó|habló|intervino|rectificó)\\b", 0],
    "_LEADERS": ["(?<!\\.)\\.{4,}\\s*[\\d\\\"”]", 0],
    "_tableish:L1132": ["\\d[\\d.,]*", 0],
    "_tableish:L1134": ["[^\\W\\d_]{3,}", 0],
    "_NEXT_CAP": ["\\s*[A-ZÁÉÍÓÚÑ¿¡\\\"«“—(]", 0],
    "_OCR_HYPH": ["[a-záéíóúñ]-[ ][a-záéíóúñ]{2,}", 0],
    "_PUNCT_ONLY": ["[\\s.,;:\\\"”»]*", 0],
    "_HAS_WORD": ["[^\\W_]", 0],
    "_SENT_END": ["[.!?…][\\\"”»)]?\\s+(?=[¿¡\\\"«“(]?[A-ZÁÉÍÓÚÑ])", 0],
    "_quote_events:L1156": ["[\\\"“”«»]", 0],
    "_is_heading:L1172": ["[A-ZÁÉÍÓÚÑ]{3}", 0],
    "_type_paragraphs:L1279": ["[.!?]\\s*[—–]", 0],
    "_sentence_bounds:L1458": ["(\\w+)$", 0],
    "_sentence_bounds:L1464": ["[º°ª]", 0],
  };
  const _compilados = new Map();
  /** Patrón compilado (una vez) por su clave del manifiesto. */
  function r(id) {
    let p = _compilados.get(id);
    if (!p) {
      const def = PAT[id];
      if (!def) throw new Error(`engine/diario.js: patrón desconocido ${id}`);
      p = RE.compile(def[0], def[1]);
      _compilados.set(id, p);
    }
    return p;
  }

  const _JOIN_STOP = new Set(K._JOIN_STOP);
  const _PRET1_STOP = new Set(K._PRET1_STOP);
  const _PL1_STOP = new Set(K._PL1_STOP);
  const _ABBR = new Set(K._ABBR);
  const _CHAIR_NAMES = K._CHAIR_NAMES;
  const _ROLE_TITLE = { chair: 'PRESIDENTE', vicechair: 'VICEPRESIDENTE', chair_age: 'PRESIDENTE DE EDAD', secretary: 'SECRETARIO' };
  // Filas que no son de nadie: el sumario de la sesion y el material que el Diario
  // imprime dentro del acta (2REP_Diaries_v3). No llevan tratamiento.
  const _FILAS_DOC = { SUMARIO: 'summary', COMENTARIOS: 'remark' };
  const _DOC_LABEL = { summary: 'Sumario de la sesión', remark: 'Comentarios del Diario' };
  const _LABELS_TUMULT = [['protest', 'Protestas'], ['interrup', 'Interrupciones'], ['interrump', 'Interrupciones'],
    ['no se', 'Voces'], ['increp', 'Protestas'], ['rumor', 'Rumores'], ['murmull', 'Rumores']];
  const _LABELS_GESTURE = [['asentimiento', 'Asentimiento'], ['firmacion', 'Asentimiento'],
    ['denegacion', 'Denegaciones'], ['pausa', 'Pausa'], ['palabra', 'Piden la palabra']];

  // --------------------------------------------------------------------------------------------------------------
  // Utilidades
  // --------------------------------------------------------------------------------------------------------------
  const _FOLD_DE = 'áéíóúüàèìòùâêîôûäëïöÁÉÍÓÚÜÀÈÌÒÙÂÊÎÔÛÄËÏÖñÑçÇ';
  const _FOLD_A = 'aeiouuaeiouaeiouaeioAEIOUUAEIOUAEIOUAEIOnNcC';
  const _FOLD_MAPA = new Map();
  for (let i = 0; i < _FOLD_DE.length; i++) _FOLD_MAPA.set(_FOLD_DE[i], _FOLD_A[i]);
  const _FOLD_RX = new RegExp(`[${_FOLD_DE}]`, 'g');

  /** Minúsculas sin tildes, con la misma longitud que el original. */
  function _fold(s) {
    s = s || '';
    return C.lower(s.replace(_FOLD_RX, (c) => _FOLD_MAPA.get(c)));
  }

  const _nwords = (s) => r('_WORD').findall(s).length;
  const _esp = (ch) => ch !== undefined && ch !== '' && C.cp.isspace(ch.charCodeAt(0));

  function _rstrip_end(text, lo, e) {
    while (e > lo && C.cp.isspace(text.charCodeAt(e - 1))) e--;
    return e;
  }

  /** [a + blancos iniciales, a + len(seg.rstrip())] de text[a:b], o null si el tramo es blanco. */
  function _recorte(text, a, b) {
    let x = a, y = b;
    while (x < b && C.cp.isspace(text.charCodeAt(x))) x++;
    while (y > a && C.cp.isspace(text.charCodeAt(y - 1))) y--;
    return y > x ? [x, y] : null;
  }

  function _bisectLeft(arr, x) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; }
    return lo;
  }
  function _bisectRight(arr, x) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (x < arr[m]) hi = m; else lo = m + 1; }
    return lo;
  }

  /** max(clases, key=CLASS_RANK): la primera de rango máximo. */
  function _maxClase(clases) {
    let mejor;
    let rango = -Infinity;
    for (const c of clases) if (CLASS_RANK[c] > rango) { mejor = c; rango = CLASS_RANK[c]; }
    if (mejor === undefined) throw new C.PyError('ValueError', 'max() arg is an empty sequence');
    return mejor;
  }

  /** list.sort() de las correcciones [a, b, reemplazo, tipo]. */
  function _cmpFix(x, y) {
    for (let i = 0; i < 4; i++) {
      const a = x[i], b = y[i];
      if (a === b) continue;
      return a < b ? -1 : 1;
    }
    return 0;
  }
  const _sortFixes = (fixes) => fixes.sort(_cmpFix);

  function _lev_le(a, b, k) {
    if (Math.abs(a.length - b.length) > k) return false;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = new Array(b.length + 1).fill(0);
      cur[0] = i;
      let best = cur[0];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
        best = Math.min(best, cur[j]);
      }
      if (best > k) return false;
      prev = cur;
    }
    return prev[prev.length - 1] <= k;
  }

  // --------------------------------------------------------------------------------------------------------------
  // P6 · Orador
  // --------------------------------------------------------------------------------------------------------------
  function _honor_norm(art, tr) {
    const t = _fold(tr);
    const a = _fold(art);
    if (['un', 'una', 'otro', 'varios', 'algunos', 'muchos', 'otros'].includes(a)) {
      const plural = ['varios', 'algunos', 'muchos', 'otros'].includes(a);
      return [`${C.capitalize(art)} ${plural ? 'señores' : (a === 'una' ? 'señora' : 'señor')}`, plural];
    }
    if (t === 'srta' || t === 'senorita') return ['La señorita', false];
    if (t === 'sra' || t === 'senora') return ['La señora', false];
    if (t === 'sres' || t === 'senores') return ['Los señores', true];
    return ['El señor', false];
  }

  const _PARTICULAS = ['de', 'del', 'la', 'las', 'los'];

  function _surname(rep_name) {
    if (!rep_name || _fold(rep_name).startsWith('sin identificar')) return null;
    const name = C.strip(rep_name);
    const m = r('_surname:L150').search(name);
    let s;
    if (m) {
      const toks = C.split(name.slice(0, m.start()));
      while (toks.length >= 2 && _PARTICULAS.includes(_fold(toks[toks.length - 2]))) {
        const unido = toks[toks.length - 2] + ' ' + toks[toks.length - 1];
        toks.splice(toks.length - 2, 2, unido);
      }
      s = toks.length >= 2 ? toks[toks.length - 1] : null;
    } else {
      const toks = [];
      for (const t of C.split(name)) {
        if (toks.length && _PARTICULAS.includes(_fold(toks[toks.length - 1]))) toks[toks.length - 1] = toks[toks.length - 1] + ' ' + t;
        else toks.push(t);
      }
      s = toks.length >= 3 ? toks[toks.length - 2] : (toks.length === 2 ? toks[toks.length - 1] : null);
    }
    if (!s) return null;
    s = r('_surname:L168').sub('', s);
    return C.upper(s.slice(0, 1)) + s.slice(1);
  }

  function _chair_name(rep_name) {
    const key = C.split(_fold(rep_name || '')).join(' ');
    const v = Object.prototype.hasOwnProperty.call(_CHAIR_NAMES, key) ? _CHAIR_NAMES[key] : null;
    return v || _surname(rep_name);
  }

  const _CACHE_ORADOR = new Map();
  function _parse_speaker_cached(raw) {
    const guardado = _CACHE_ORADOR.get(raw);
    if (guardado) return guardado;
    let s = C.strip(raw || '');
    s = r('_parse_speaker_cached:L211').sub('', s);
    let honor = '', group = false, body; // sin tratamiento explícito en el CSV, la etiqueta es el texto tal cual
    const m = r('_HONOR').match(s);
    if (m) {
      [honor, group] = _honor_norm(m.group('art'), m.group('tr'));
      body = s.slice(m.end());
    } else {
      body = s;
    }
    body = C.strip(body);
    if (r('_parse_speaker_cached:L220').match(s)) group = true;

    let qual = null;
    let note = null;
    const pm = r('_parse_speaker_cached:L227').search(body);
    if (pm) {
      qual = C.rstrip(C.strip(pm.group(1)), '.');
      const rest = C.strip(pm.group(2));
      if (rest) note = rest;
      body = C.strip(body.slice(0, pm.start()));
    }
    const cm = r('_parse_speaker_cached:L235').match(body);
    let acot = null;
    if (cm && !r('_ROLE_HOG').search(C.upper(_fold(body)))) {
      body = C.strip(cm.group(1));
      acot = C.strip(cm.group(2));
    }
    if (qual && classify_segment(qual) !== null && !r('_parse_speaker_cached:L239').match(qual)) {
      acot = qual;
      qual = null;
    }
    body = C.strip(r('_parse_speaker_cached:L241').sub(' ', body));

    const up = C.upper(_fold(body));
    if (Object.prototype.hasOwnProperty.call(_FILAS_DOC, C.upper(s))) {
      const res0 = Object.freeze([s, '', C.upper(s), null, null, null, _FILAS_DOC[C.upper(s)], false]);
      if (_CACHE_ORADOR.size >= 8192) _CACHE_ORADOR.clear();
      _CACHE_ORADOR.set(raw, res0);
      return res0;
    }
    const first = up ? r('_parse_speaker_cached:L244').sub('', up.split(' ')[0]) : '';
    let role;
    if (r('_ROLE_HOG').search(up)) role = 'head_of_government';
    else if (r('_ROLE_STATE').search(up)) role = 'head_of_state';
    else if (r('_ROLE_AGE').search(up)) role = 'chair_age';
    else if (up.includes('MINISTRO')) role = 'minister';
    else if (first.startsWith('SECRETAR') || (first.length >= 7 && first.length <= 12 && _lev_le(first, 'SECRETARIO', 2))) role = 'secretary';
    else if (first.includes('VICE') || (first.length >= 12 && first.endsWith('PRESIDENTE'))
      || (first.length >= 11 && first.length <= 16 && _lev_le(first, 'VICEPRESIDENTE', 2))) role = 'vicechair';
    else if (first === 'PRESIDENTE' || r('_ROLE_CAMARA').search(up)
      || (first.length >= 7 && first.length <= 12 && _lev_le(first, 'PRESIDENTE', 2))
      || r('_parse_speaker_cached:L260').match(up)) role = 'chair';
    else role = 'deputy';
    const res = Object.freeze([s, honor, body, qual, acot, note, role, group]);
    if (_CACHE_ORADOR.size >= 8192) _CACHE_ORADOR.clear();
    _CACHE_ORADOR.set(raw, res);
    return res;
  }

  /**
   * Normaliza la etiqueta de orador del Diario y deduce su papel: chair, vicechair, chair_age (Presidencia), secretary,
   * head_of_government (nunca Presidencia de la Cámara), head_of_state, minister y deputy.
   */
  function parse_speaker(raw, rep_name = null) {
    const [, honor, body0, qual, acot, note, role, group] = _parse_speaker_cached(raw || '');
    if (Object.prototype.hasOwnProperty.call(_DOC_LABEL, role)) {
      const etiqueta = _DOC_LABEL[role];
      return { raw: raw || '', honor: '', body: body0, qual: null, acot: null, note: null,
        role, is_chair: false, group: false, name: null, title: etiqueta, label: etiqueta };
    }
    let body = body0;
    const is_chair = role === 'chair' || role === 'vicechair' || role === 'chair_age';
    if (Object.prototype.hasOwnProperty.call(_ROLE_TITLE, role)) {
      body = _ROLE_TITLE[role];
    } else if (role === 'head_of_government') {
      body = r('parse_speaker:L285').sub('Presidente', r('parse_speaker:L285#2').sub(' del', body));
      body = r('parse_speaker:L286').sub('PRESIDENTE', body);
    }
    let title = body ? C.strip(`${honor} ${body}`) : honor;
    if (qual && !is_chair) title += ` (${qual})`;
    let name = null;
    let label;
    if (is_chair) {
      if (qual && r('parse_speaker:L292').match(qual) && !r('parse_speaker:L292#2').match(qual)) name = qual;
      else name = _chair_name(rep_name);
      label = name ? `Presidencia (${name})` : 'Presidencia';
    } else {
      label = title;
    }
    return {
      raw: raw || '', honor, body, qual, acot, note, role, is_chair,
      group, name, title, label,
    };
  }

  // --------------------------------------------------------------------------------------------------------------
  // P4 · Clasificación de acotaciones
  // --------------------------------------------------------------------------------------------------------------
  function _label_for(kind, f) {
    if (kind === 'interj') return 'Interjecciones';
    if (kind === 'chair') return 'Presidencia';
    if (kind === 'approval') return 'Aprobación';
    if (kind === 'laughter') return 'Risas';
    if (kind === 'ovation') return 'Aplausos';
    if (kind === 'tumult') {
      for (const [stem, lab] of _LABELS_TUMULT) if (f.includes(stem)) return lab;
      return 'Rumores';
    }
    for (const [stem, lab] of _LABELS_GESTURE) if (f.includes(stem)) return lab;
    return 'Gestos';
  }

  /** Clasifica una unidad de acotación. Primera coincidencia gana. */
  function _classify_unit(u) {
    const s = C.strip(C.strip(C.strip(u), '()'));
    if (!s) return null;
    const f = _fold(s);
    const m = r('_INTERJ').match(f);
    if (m) {
      const who = C.strip(s.slice(0, m.group('who').length));
      const say = C.strip(s.slice(m.start('say')));
      let c;
      if (r('_WHO_CHAIR').search(_fold(who))) c = 'order';
      else if (r('_SAY_BRAVO').match(_fold(say))) c = 'applause';
      else c = 'neutral';
      const lab = c === 'order' ? 'Presidencia' : 'Interjecciones';
      return { c, k: 'interj', lab, who };
    }
    const first = r('_classify_unit:L431').search(s);
    if (!first || C.islower(first.group(0)) || _nwords(s) > 40) return null;
    if ((r('_CHAIR_SUBJ').search(f) && r('_CHAIR_ACT').search(f))
      || (r('_CAMPANILLA').search(f) && !r('_classify_unit:L435').search(f))) {
      return { c: 'order', k: 'chair', lab: 'Presidencia' };
    }
    if (r('_APPROVAL').search(f)) return { c: 'applause', k: 'approval', lab: 'Aprobación' };
    if (r('_TUMULT').search(f)) return { c: 'conflict', k: 'tumult', lab: _label_for('tumult', f) };
    if (r('_LAUGH').search(f)) return { c: 'neutral', k: 'laughter', lab: 'Risas' };
    if (r('_OVATION').search(f)) return { c: 'applause', k: 'ovation', lab: 'Aplausos' };
    if (r('_GESTURE').search(f)) return { c: 'neutral', k: 'gesture', lab: _label_for('gesture', f) };
    return null;
  }

  function _unit_spans(inner) {
    if (!r('_UNIT_HINT').search(inner)) {
      const la = inner.length - C.lstrip(inner).length;
      const lb = C.rstrip(inner).length;
      return lb > la ? [[la, lb]] : [];
    }
    const spans = [];
    let pos = 0;
    for (const m of r('_UNIT_SEP').finditer(inner)) {
      const ms = m.start();
      if (ms > pos) spans.push([pos, ms]);
      pos = m.end();
    }
    if (pos < inner.length) spans.push([pos, inner.length]);
    const out = [];
    for (const [a, b] of spans) {
      const rc = _recorte(inner, a, b);
      if (rc) out.push(rc);
    }
    return out;
  }

  /**
   * ¿Es el contenido de un paréntesis una acotación? null si es texto; {c, note, u} con desplazamientos relativos a
   * `inner`; una nota de apéndice da {c: null, note: true, u: []}.
   */
  function classify_segment(inner) {
    const s = inner || '';
    const st = C.strip(s);
    if (!st) return null;
    const f = _fold(st);
    if (r('_EXCL_NOTE').search(f)) return { c: null, note: true, u: [] };
    if (r('_EXCL_TEXT').search(f)) return null;
    const units = [];
    let known = 0;
    const spans = _unit_spans(s);
    for (let i = 0; i < spans.length; i++) {
      const [a, b] = spans[i];
      const res = _classify_unit(s.slice(a, b));
      if (res === null) {
        // Una unidad sin clasificar solo se admite detrás de otra que sí lo está: "(Rumores.—Continúa el orador.)".
        if (i === 0 && (spans.length === 1 || _nwords(s.slice(a, b)) > 4
          || !r('classify_segment:L502').match(s.slice(a, b)))) return null;
        units.push({ a, b, c: null, k: 'other', lab: null });
        continue;
      }
      known += 1;
      res.a = a;
      res.b = b;
      units.push(res);
    }
    if (!known || known * 2 < units.length) return null;
    const c = _maxClase(units.filter((u) => u.c).map((u) => u.c));
    return { c, note: false, u: units };
  }

  // --------------------------------------------------------------------------------------------------------------
  // P0 · Normalización y P1 · unión de párrafos partidos
  // --------------------------------------------------------------------------------------------------------------
  function _raw_spans(text, start) {
    const out = [];
    let pos = start;
    for (const m of r('_PP_SEP').finditer(text, start)) {
      const ms = m.start();
      if (ms > pos) out.push([pos, ms]);
      pos = m.end();
    }
    if (pos < text.length) out.push([pos, text.length]);
    const res = [];
    for (const [a, b] of out) {
      const rc = _recorte(text, a, b);
      if (rc) res.push(rc);
    }
    return res;
  }

  function _last_unclosed(text, a, b) {
    const stack = [];
    for (let i = a; i < b; i++) {
      const ch = text[i];
      if (ch === '(') stack.push(i);
      else if (ch === ')' && stack.length) stack.pop();
    }
    return stack.length ? stack[stack.length - 1] : -1;
  }

  /** ¿Continúa el párrafo `nxt` a `cur` (P0/P1)? Corrección [a, b, reemplazo, tipo] o null. */
  function _join_fix(text, cur, hdrs, nxt, hdr_end) {
    const [pa, pb] = cur;
    const [na, nb] = nxt;
    const ns = hdr_end;
    const prev_tail = text.slice(Math.max(pa, pb - 60), pb);
    const has_hdr = hdrs.length > 0 || hdr_end > na;

    // Guion de fin de línea: "pro-\n\nvincia", "re-\n\nNUMERO 79 2603 sulta".
    const hm = r('_HYPH_END').search(prev_tail);
    if (hm) {
      const hstart = pb - hm.group(2).length;
      const frag = hm.group(1);
      let tm = r('_NEXT_TOKEN').match(text, ns, nb);
      let tk, ts, te;
      if (tm) {
        tk = tm.group(1);
        ts = tm.start(1);
        te = tm.end(1);
        // Solo se admite basura de OCR delante si no hay cabecera.
        if (ts > ns && has_hdr) tm = null;
      }
      if (tm) {
        if (C.islower(tk[0])) return [hstart, ts, '', 'hyphen'];
        if (tk.length > 1 && ((tk[0] === 'I' && 'luoaeó'.includes(tk[1]))
          || (tk[0] === 'J' && 'aeiouó'.includes(tk[1]) && C.islower(frag)))) {
          // I o J por l: "So-\n\nIórzano", "invo-\n\nIuntario", "va-\n\nJor".
          return [hstart, te, 'l' + C.lower(tk.slice(1)), 'hyphen'];
        }
        if (C.isupper(frag[0]) && C.isupper(tk[0]) && tk.length > 4 && !C.isupper(tk)
          && !r('_CHRON_START').match(text, ts)) {
          // Apellido compuesto: "Gil-\n\nRobles" -> "Gil-Robles".
          return [pb, ts, '', 'hyphen'];
        }
        if (C.isupper(frag) && C.isupper(tk)) return [hstart, ts, '', 'hyphen'];
        if (C.isupper(tk[0]) && tk.length <= 4 && !_JOIN_STOP.has(_fold(tk)) && C.islower(frag)) {
          return [hstart, te, C.lower(tk), 'hyphen'];
        }
      }
      return null;
    }

    const nfirst = text.slice(ns, ns + 1);
    const starts_lower = !!r('_LOWER_START').match(nfirst);
    // Párrafo cortado a mitad de frase (o por una cabecera intercalada).
    const mid = r('_join_fix:L612').search(prev_tail);
    if ((starts_lower && (has_hdr || mid)) || (has_hdr && mid && nfirst)) {
      let a = pb;
      if (hdrs.length || hdr_end > na) {
        // Número de página suelto al final del párrafo anterior: "por su 12212".
        const nm = r('_join_fix:L617').search(prev_tail);
        if ((nm && hdrs.some(([x, y]) => r('_HDR_DATE').search(text.slice(x, y))))
          || (nm && r('_HDR_DATE').match(text, na))) {
          a = pb - nm.group(0).length;
        }
      }
      return [a, ns, ' ', 'join'];
    }
    // Acotación partida por la línea en blanco: "(Un Sr. Diputado:\n\nEso...)".
    if (!hdrs.length) {
      const op = _last_unclosed(text, Math.max(pa, pb - _MAX_PAREN), pb);
      if (op >= 0) {
        const lim = Math.min(nb, na + 400);
        const rel = lim > na ? text.slice(na, lim).indexOf(')') : -1;
        const cl = rel >= 0 ? na + rel : -1;
        if (cl > 0 && !text.slice(na, cl).includes('(')) {
          const inner = text.slice(op + 1, pb) + ' ' + text.slice(na, cl);
          const res = classify_segment(inner);
          if (res !== null && !res.note) return [pb, na, ' ', 'join'];
        }
      }
    }
    return null;
  }

  /** P0 + unión de párrafos: [párrafos [[a, b]], cabeceras [[a, b]], correcciones, calificador del orador]. */
  function _normalize(text) {
    const fixes = [];
    let start = 0;
    let lead = null;
    const lm = r('_LEAD_SPEAKER').match(text);
    if (lm && !classify_segment(lm.group(1))) {
      // "(D. Eduardo): Señores Diputados..." -> el paréntesis va al orador.
      lead = C.strip(lm.group(1));
      fixes.push([0, lm.end(), '', 'lead_speaker']);
      start = lm.end();
    }

    const paras = [];
    const arts = [];
    let pending = [];
    let cur = null;
    for (const [a, b] of _raw_spans(text, start)) {
      if (r('_HDR_ONLY').match(text, a, b) && b - a <= 40) {
        pending.push([a, b]);
        continue;
      }
      const hm = r('_HDR_PREFIX').match(text, a, b);
      const hdr_end = hm ? hm.end() : a;
      const fx = cur !== null ? _join_fix(text, cur, pending, [a, b], hdr_end) : null;
      if (fx) {
        fixes.push(fx);
        cur[1] = b;
        pending = [];
        continue;
      }
      if (cur !== null) paras.push(cur);
      for (const p of pending) arts.push(p);
      pending = [];
      if (hm) fixes.push([a, hdr_end, '', 'header']);
      cur = [a, b];
    }
    if (cur !== null) paras.push(cur);
    for (const p of pending) arts.push(p);

    // Guiones blandos y signos de apertura leídos como corchete o llave.
    _sortFixes(fixes);
    const starts = fixes.map((f) => f[0]);
    const free = (a, b) => {
      const i = _bisectRight(starts, a) - 1;
      if (i >= 0 && fixes[i][1] > a) return false;
      const j = _bisectLeft(starts, a);
      return !(j < fixes.length && fixes[j][0] < b);
    };

    const extra = [];
    if (text.includes('\xad')) {
      for (const m of r('_SOFT').finditer(text)) {
        const ms = m.start(), me = m.end();
        if (free(ms, me)) extra.push([ms, me, '', 'soft_hyphen']);
      }
    }
    if (text.includes('[') || text.includes('{')) {
      for (const m of r('_BRACKET').finditer(text)) {
        const p = m.start(1);
        const [close, sign, repl] = m.group(1) === '[' ? [']', '!', '¡'] : ['}', '?', '¿'];
        const ventana = text.slice(p + 1, p + 200);
        const cands = [ventana.indexOf(close), ventana.indexOf('\n')].filter((x) => x >= 0);
        const cut = cands.length ? Math.min(...cands) : ventana.length;
        const antes = ventana.slice(0, cut);
        if (antes.includes(sign) && !antes.includes('$') && free(p, p + 1)) extra.push([p, p + 1, repl, 'bracket']);
      }
    }
    if (extra.length) {
      for (const e of extra) fixes.push(e);
      _sortFixes(fixes);
    }
    return [paras, arts, fixes, lead];
  }

  /**
   * Texto corregido de [a, b) y tabla posición corregida -> posición original (con una entrada final igual a b), o
   * [text[a:b], null] si no hay correcciones. fx = [fixes, starts] o null.
   */
  function _view(text, a, b, fx) {
    if (!fx) return [text.slice(a, b), null];
    const [fixes, starts] = fx;
    let i = _bisectLeft(starts, a);
    if (i >= fixes.length || fixes[i][0] >= b) return [text.slice(a, b), null];
    const parts = [];
    const pmap = [];
    let pos = a;
    while (i < fixes.length && fixes[i][0] < b) {
      const fa = fixes[i][0], fb = fixes[i][1], rp = fixes[i][2];
      if (fb > b) break;
      parts.push(text.slice(pos, fa));
      for (let k = pos; k < fa; k++) pmap.push(k);
      parts.push(rp);
      for (let k = 0; k < rp.length; k++) pmap.push(fa);
      pos = fb;
      i += 1;
    }
    parts.push(text.slice(pos, b));
    for (let k = pos; k < b; k++) pmap.push(k);
    pmap.push(b);
    return [parts.join(''), pmap];
  }

  /** Texto que se muestra del tramo [a, b): el original con sus correcciones. */
  function _apply(text, a, b, fixes, starts) {
    let i = _bisectLeft(starts, a);
    if (i >= fixes.length || fixes[i][0] >= b) return text.slice(a, b);
    const out = [];
    let pos = a;
    while (i < fixes.length && fixes[i][0] < b) {
      const fa = fixes[i][0], fb = fixes[i][1], rep = fixes[i][2];
      out.push(text.slice(pos, fa));
      out.push(rep);
      pos = fb;
      i += 1;
    }
    out.push(text.slice(pos, b));
    return out.join('');
  }

  // --------------------------------------------------------------------------------------------------------------
  // P3 · Escáner de paréntesis y segmentos de un párrafo
  // --------------------------------------------------------------------------------------------------------------
  function _match_parens(text, a, b) {
    const pairs = [], stack = [], loose = [];
    for (const m of r('_match_parens:L770').finditer(text.slice(a, b))) {
      const i = a + m.start();
      if (text[i] === '(') {
        stack.push(i);
      } else if (stack.length) {
        const o = stack.pop();
        pairs.push([o, i, stack.length]);
      } else {
        if (r('_match_parens:L778').search(text.slice(Math.max(a, i - 3), i))) continue;
        loose.push(i);
      }
    }
    return [pairs, stack, loose];
  }

  function _acot_seg(text, a, b, ia, res, extra = null) {
    const units = res.u.map((u) => ({ ...u, a: ia + u.a, b: ia + u.b }));
    const seg = { k: 'acot', a, b, c: res.c, u: units };
    if (extra) Object.assign(seg, extra);
    return seg;
  }

  const _DASH_UNIT_FUERA = '—–()\n';
  /**
   * Equivalente de _DASH_UNIT.match(text, p, limit) — [^—–()\n]{1,120}?(?:[.!?…]|(?=\s*[—–)])) sobre text[:limit] —
   * sin RegExp: [inicio, fin] o null. Lo usa _dashUnit cuando el motor de JS se queda sin pila (Firefox).
   */
  function _dashUnitManual(text, p, limit) {
    let finBlancos = -1;
    for (let k = 1; k <= 120; k++) {
      const q = p + k;
      if (q > limit) return null;
      if (_DASH_UNIT_FUERA.includes(text[q - 1])) return null;
      if (q < limit && '.!?…'.includes(text[q])) return [p, q + 1];
      let e;
      if (finBlancos > q) {
        e = finBlancos;
      } else {
        e = q;
        while (e < limit && C.cp.isspace(text.charCodeAt(e))) e++;
        finBlancos = e;
      }
      if (e < limit && '—–)'.includes(text[e])) return [p, q];
    }
    return null;
  }

  function _dashUnit(text, p, limit) {
    try {
      const um = r('_DASH_UNIT').match(text, p, limit);
      return um ? [um.start(), um.end()] : null;
    } catch (err) {
      if (err instanceof RE.error && err.motorAgotado) return _dashUnitManual(text, p, limit);
      throw err;
    }
  }

  /** ")—Risas.—" detrás de un paréntesis: unidades con raya sin paréntesis. */
  function _extend_dash_chain(text, seg, limit) {
    let pos = seg.b;
    while (pos < limit) {
      const m = r('_DASH_AFTER').match(text, pos, limit);
      if (!m) break;
      const um = _dashUnit(text, m.end(), limit);
      if (!um) break;
      const ut = text.slice(um[0], um[1]);
      const res = _classify_unit(ut);
      if (res === null || (res.k === 'interj' && !ut.endsWith('.'))) break;
      res.a = um[0];
      res.b = um[1];
      seg.u.push(res);
      if (CLASS_RANK[res.c] > CLASS_RANK[seg.c]) seg.c = res.c;
      pos = um[1];
      seg.b = pos;
      seg.dash = true;
    }
    // Cierre sobrante: ".—Grandes aplausos.)"
    if (seg.dash && pos < limit && text[pos] === ')') seg.b = pos + 1;
  }

  /** Tramos ya reconocidos de un párrafo, ordenados y sin solapes (búsquedas por bisección). */
  class _Spans {
    constructor() { this.a = []; this.b = []; this.segs = []; }
    add(seg) {
      const i = _bisectLeft(this.a, seg.a);
      this.a.splice(i, 0, seg.a);
      this.b.splice(i, 0, seg.b);
      this.segs.splice(i, 0, seg);
    }
    covers(p) {
      const i = _bisectRight(this.a, p) - 1;
      return i >= 0 && this.b[i] > p;
    }
    overlaps(a, b) {
      const i = _bisectLeft(this.a, b) - 1;
      return i >= 0 && this.b[i] > a;
    }
    end_before(p, dflt) {
      const j = _bisectRight(this.b, p) - 1;
      return j >= 0 ? Math.max(dflt, this.b[j]) : dflt;
    }
  }

  /** Segmentos de un tramo: acotaciones, notas y texto, en orden y sin solapes. */
  function _scan_segments(text, a, b, fx = null) {
    const tramo = text.slice(a, b);
    if (!tramo.includes('(') && !tramo.includes(')')) return [{ k: 'txt', a, b }];
    const [pairs, unclosed, loose] = _match_parens(text, a, b);
    pairs.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
    const spans = new _Spans();
    let covered_until = -1;
    const cls = new Map();

    const classify_pair = (o, c) => {
      const key = o * 4294967296 + c;
      if (!cls.has(key)) {
        const [inner, pm] = _view(text, o + 1, c, fx);
        const res = classify_segment(inner);
        if (res !== null && pm !== null) {
          for (const u of res.u) {
            const ua = u.a, ub = u.b;
            u.a = pm[ua] - o - 1;
            u.b = pm[ub] - o - 1;
          }
        }
        cls.set(key, res);
      }
      return cls.get(key);
    };

    let rec_opens = null;
    const recognized_pair_after = (pos, lim) => {
      if (rec_opens === null) {
        rec_opens = [];
        for (const [o, c] of pairs) {
          if (c - o <= _MAX_PAREN) {
            const res = classify_pair(o, c);
            if (res !== null && !res.note) rec_opens.push(o);
          }
        }
      }
      const i = _bisectRight(rec_opens, pos);
      if (i < rec_opens.length && rec_opens[i] < lim) return rec_opens[i];
      return null;
    };

    // Pares de fuera hacia dentro: si el de fuera es texto, se miran sus hijos.
    for (const [o, c] of pairs) {
      if (o < covered_until) continue;
      if (c - o > _MAX_PAREN) continue;
      const res = classify_pair(o, c);
      if (res === null) continue;
      let seg;
      if (res.note) {
        seg = { k: 'note', a: o, b: c + 1 };
      } else {
        seg = _acot_seg(text, o, c + 1, o + 1, res);
        _extend_dash_chain(text, seg, b);
      }
      spans.add(seg);
      covered_until = seg.b;
    }

    // Aperturas sin cerrar: solo se cierran si el léxico las reconoce (ventana de _MAX_PAREN caracteres).
    for (const o of unclosed) {
      if (spans.covers(o)) continue;
      const nxt = recognized_pair_after(o, b);
      const lim = nxt !== null ? nxt : b;
      const cap = Math.min(lim, o + 1 + _MAX_PAREN);
      let res = classify_segment(text.slice(o + 1, cap));
      if (res === null || res.note) continue;
      let units = res.u;
      if (cap < lim) units = units.slice(0, -1); // la última unidad quedó cortada por la ventana
      let last = null;
      for (const u of units) {
        if (u.c === null) break;
        last = u;
      }
      if (last === null) continue;
      let end = o + 1 + last.b;
      if (nxt === null && _nwords(text.slice(o + 1, end)) > _MAX_OPEN_WORDS) continue;
      res = { ...res, u: units.filter((u) => u.b <= last.b) };
      res.c = _maxClase(res.u.filter((u) => u.c).map((u) => u.c));
      while (end < lim && '—–- '.includes(text[end])) end += 1;
      end = end > o + 1 ? _rstrip_end(text, o + 1, end) : end;
      if (spans.overlaps(o, end)) continue;
      spans.add(_acot_seg(text, o, end, o + 1, res, { open: 'right' }));
    }

    // Cierres sueltos: cadena de unidades con raya que acaba en ")".
    for (const cpos of loose) {
      if (spans.covers(cpos)) continue;
      const lo = Math.max(spans.end_before(cpos, a), cpos - _MAX_PAREN);
      const ventana = text.slice(lo, cpos);
      let start = null;
      let units = [];
      const seps = Array.from(r('_LOOSE_SEP').finditer(ventana)).reverse().slice(0, _MAX_CHAIN);
      for (const m of seps) {
        const me = m.end();
        const cand = ventana.slice(me);
        const res = classify_segment(cand);
        if (res === null || res.note || res.u.some((u) => u.c === null)) break;
        start = lo + m.start();
        units = res.u.map((u) => ({ ...u, a: lo + me + u.a, b: lo + me + u.b }));
      }
      if (start === null) continue;
      const c = _maxClase(units.map((u) => u.c));
      spans.add({ k: 'acot', a: start, b: cpos + 1, c, u: units, open: 'left' });
    }

    const out = [];
    let pos = a;
    for (const s of spans.segs) {
      if (s.a < pos) continue;
      if (s.a > pos) out.push({ k: 'txt', a: pos, b: s.a });
      out.push(s);
      pos = s.b;
    }
    if (pos < b) out.push({ k: 'txt', a: pos, b });
    // Tramos de texto sin espacios en los bordes; los vacíos desaparecen.
    const res = [];
    for (const s of out) {
      if (s.k === 'txt') {
        const rc = _recorte(text, s.a, s.b);
        if (!rc) continue;
        res.push({ k: 'txt', a: rc[0], b: rc[1] });
      } else {
        res.push(s);
      }
    }
    return res;
  }

  // --------------------------------------------------------------------------------------------------------------
  // P2 · Tipos de párrafo
  // --------------------------------------------------------------------------------------------------------------
  function _is_name_item(s) {
    return s.length <= 60 && _nwords(s) <= 7 && !!r('_NAME_ITEM').match(s) && !!r('_LOWER_START').search(s);
  }

  function _tableish(s) {
    const t = C.lstrip(s);
    if (t.startsWith('|') && t.indexOf('|', 1) > 0) return 'md'; // "|Mamarracho!" no es una tabla
    if (t.includes('<table') || t.includes('<td') || t.includes('<tr')) return 'html';
    if (t.includes('$$') || t.includes('\\frac')) return 'latex';
    if (r('_LEADERS').search(t)) return 'leaders';
    const nums = r('_tableish:L1132').findall(t).length;
    if (nums >= 6) {
      const words = r('_tableish:L1134').findall(t).length;
      if (nums >= 1.5 * words) return 'numbers';
    }
    return null;
  }

  /** Aperturas (+1) y cierres (-1) de comillas de un párrafo, en orden. */
  function _quote_events(s) {
    const out = [];
    for (const m of r('_quote_events:L1156').finditer(s)) {
      const i = m.start(), ch = m.group(0);
      if ('“«'.includes(ch)) {
        out.push([i, 1]);
      } else if ('”»'.includes(ch)) {
        out.push([i, -1]);
      } else {
        const prev = i ? s[i - 1] : ' ';
        const nxt = i + 1 < s.length ? s[i + 1] : ' ';
        if (_esp(prev) || '(:—¡¿«['.includes(prev)) out.push([i, 1]);
        else if (_esp(nxt) || '.,;:)—!?'.includes(nxt)) out.push([i, -1]);
      }
    }
    return out;
  }

  function _is_heading(s) {
    return !!r('_HEADING').match(s) && r('_is_heading:L1172').search(s) !== null;
  }

  function _no_parens(s) {
    return s.includes('(') ? r('_PAREN_TXT').sub(' ', r('_PAREN_TXT').sub(' ', s)) : s;
  }

  /** ¿Habla el párrafo en primera o segunda persona (fuera de paréntesis y comillas)? */
  function _speech_marks(s) {
    s = _no_parens(s);
    if (s.includes('"') || s.includes('“') || s.includes('«')) s = r('_QUOTED_TXT').sub(' ', s);
    if (r('_SPEECH_MARK').search(s)) return true;
    for (const m of r('_PRET1').finditer(s)) if (!_PRET1_STOP.has(_fold(m.group(0)))) return true;
    for (const m of r('_PL1').finditer(s)) if (!_PL1_STOP.has(m.group(0))) return true;
    return false;
  }

  const _ends_colon = (s) => C.rstrip(s, ' "”»').endsWith(':');

  function _reading_kind(s, chair_doc) {
    return chair_doc || r('_FIRST_PERSON_DOC').search(s) ? 'doc' : 'list';
  }

  /** ¿Confirma este párrafo que el anterior cerró las palabras del orador? */
  function _acta_like(s, chair_doc) {
    if (r('_CHRON_END').search(s) || r('_TURN').match(s) || r('_VOTE_HEAD').match(s) || r('_NUM_DEP').match(s)
      || r('_NOTE_PARA').match(s) || _tableish(s) || _is_heading(s) || r('_READ_DOC').match(s)) return true;
    if (_speech_marks(s)) return false;
    if (_nwords(s) <= 25 && r('_ANNEX').match(s)) return true;
    if (chair_doc || r('_CHRON_START').match(s) || r('_ABS_START').match(s) || _nwords(s) <= 12) return true;
    return r('_ACTA_VERB').search(s) !== null && r('_PROC_NOUN').search(s) !== null;
  }

  /** P2: tipo de cada párrafo y máquina de estados habla / acta / lectura (ver diario.py). */
  function _type_paragraphs(text, paras, fixes, chair_doc = false) {
    const starts = fixes.map((f) => f[0]);
    const texts = paras.map(([a, b]) => _apply(text, a, b, fixes, starts));
    const quote_fixes = [];
    const recs = [];
    let speech = true;
    let reading = null;
    let depth = 0;
    for (let idx = 0; idx < paras.length; idx++) {
      const [a, b] = paras[idx];
      const s = texts[idx];
      const rec = { a, b, sub: null };
      const marks = _speech_marks(s);
      const chron_start = !marks && !!r('_CHRON_START').match(s);
      const chron_end = !!r('_CHRON_END').search(s);
      const heading = _is_heading(s);
      const annex = !marks && _nwords(s) <= 25 && !!r('_ANNEX').match(s);
      const doc_start = (!speech && (!!r('_READ_DOC').match(s) || '"“«'.includes(s.slice(0, 1)) || heading)) || annex;
      if (chron_start) depth = 0;
      let stray = null;
      for (const [i, d] of _quote_events(s)) {
        if (d > 0) depth += 1;
        else if (depth > 0) depth -= 1;
        else if (i === s.length - 1 && s[i] === '"') stray = text[b - 1] === '"' ? b - 1 : null;
      }
      const tab = _tableish(s);
      if (tab) {
        rec.kind = 'table';
        rec.fmt = tab;
      } else if (r('_NOTE_PARA').match(s)) {
        rec.kind = 'note';
      } else if (!chron_start && r('_TURN').match(text, a, b)) {
        // Turno incrustado, también en el acta: devuelve el estado de habla.
        rec.kind = 'turn';
      } else if (chron_start || chron_end || heading || annex
        || (!speech && (doc_start || !marks || (reading === 'doc' && !r('_VOCATIVE').search(_no_parens(s)))))) {
        rec.kind = 'chron';
      } else if (!s.includes('(') && r('_type_paragraphs:L1279').search(s)
        && ((res) => res !== null && !res.note && res.u.length > 1 && res.u.every((u) => u.c))(classify_segment(s))) {
        rec.kind = 'stage';
      } else {
        rec.kind = 'par';
      }
      if (r('_VOTE_HEAD').match(s)) rec.sub = 'head';
      else if (r('_TOTAL').match(s)) rec.sub = 'total';
      else if (r('_NUM_DEP').match(s) || (r('_DEP').match(s) && _nwords(s) <= 25)) rec.sub = 'dep';
      else if (_is_name_item(s)) rec.sub = 'name';
      const kind = rec.kind;
      if (kind === 'turn' || chron_end) {
        speech = true;
        reading = null;
      } else if (chron_start && kind === 'chron') {
        speech = false;
        if (_ends_colon(s)) reading = _reading_kind(s, chair_doc);
        else if (!(reading && r('_SIGNATURE').match(s))) reading = null;
      } else if (annex && kind === 'chron') {
        speech = false;
        reading = 'doc';
      } else if (!speech && (kind === 'par' || kind === 'stage')) {
        speech = true; // marcas de habla: vuelve el discurso
        reading = null;
      } else if (!speech && kind === 'chron') {
        if (doc_start) reading = 'doc';
        else if (_ends_colon(s)) reading = _reading_kind(s, chair_doc);
      }
      if (stray !== null && kind !== 'table') {
        if (!speech) {
          quote_fixes.push([stray, stray + 1, '', 'quote']);
        } else if (idx + 1 === texts.length || _acta_like(texts[idx + 1], chair_doc)) {
          quote_fixes.push([stray, stray + 1, '', 'quote']);
          speech = false;
          reading = null;
        }
      }
      recs.push(rec);
    }
    if (quote_fixes.length) {
      for (const q of quote_fixes) fixes.push(q);
      _sortFixes(fixes);
    }
    return recs;
  }

  /** Agrupa listas de votación o de diputados y tablas contiguas. */
  function _group(recs) {
    const out = [];
    let i = 0;
    const n = recs.length;
    while (i < n) {
      const rec = recs[i];
      const sub = rec.sub;
      if (sub === 'head') {
        let j = i + 1;
        while (j < n && (recs[j].sub === 'name' || recs[j].sub === 'dep')) j += 1;
        let total = null;
        if (j < n && recs[j].sub === 'total') {
          total = recs[j];
          j += 1;
        }
        out.push({ kind: 'list', lk: 'vote', head: rec, items: recs.slice(i + 1, j - (total ? 1 : 0)), total });
        i = j;
        continue;
      }
      if (sub === 'dep' || sub === 'name') {
        let j = i;
        while (j < n && recs[j].sub === sub) j += 1;
        if (j - i >= (sub === 'dep' ? 2 : 4)) {
          let total = null;
          if (j < n && recs[j].sub === 'total') {
            total = recs[j];
            j += 1;
          }
          out.push({
            kind: 'list', lk: sub === 'dep' ? 'deputies' : 'names', head: null,
            items: recs.slice(i, j - (total ? 1 : 0)), total,
          });
          i = j;
          continue;
        }
      }
      if (rec.kind === 'table') {
        let j = i;
        while (j < n && recs[j].kind === 'table') j += 1;
        out.push({ kind: 'table', rows: recs.slice(i, j), fmt: rec.fmt });
        i = j;
        continue;
      }
      out.push(rec);
      i += 1;
    }
    return out;
  }

  function _stage_from(seg, inpar) {
    const st = { t: 'stage', a: seg.a, b: seg.b, c: seg.c, u: seg.u };
    if (inpar) st.inpar = true;
    return st;
  }

  /** Párrafo de prosa -> par / stage / par(cont) según la regla en línea/bloque. */
  function _prose_blocks(text, a, b, fx = null) {
    const segs = _scan_segments(text, a, b, fx);
    const out = [];
    let piece = [];
    let piece_prose = false; // ¿hay texto con letras en la pieza en curso?
    let emitted_prose = false;

    const add = (x) => {
      piece.push(x);
      if (x.k === 'txt' && !piece_prose && r('_HAS_WORD').search(text, x.a, x.b)) piece_prose = true;
    };

    const flush = () => {
      if (!piece.length) return;
      if (piece_prose) {
        out.push({ t: 'par', a: piece[0].a, b: piece[piece.length - 1].b, cont: emitted_prose, s: piece });
        emitted_prose = true;
      } else {
        for (const x of piece) {
          if (x.k === 'acot') {
            out.push(_stage_from(x, emitted_prose));
          } else if (x.k === 'note') {
            out.push({ t: 'note', a: x.a, b: x.b, s: [x] });
          } else if (out.length) {
            const ult = out[out.length - 1];
            ult.b = Math.max(ult.b, x.b);
            if (ult.t === 'par' || ult.t === 'note') ult.s.push(x);
          } else {
            out.push({ t: 'note', a: x.a, b: x.b, s: [x] });
          }
        }
      }
      piece = [];
      piece_prose = false;
    };

    let k = 0;
    while (k < segs.length) {
      const s = segs[k];
      if (s.k !== 'acot') {
        add(s);
        k += 1;
        continue;
      }
      const nxt = k + 1 < segs.length ? segs[k + 1] : null;
      const rest_punct = nxt === null || (k + 2 === segs.length && nxt.k === 'txt'
        && r('_PUNCT_ONLY').fullmatch(text, nxt.a, nxt.b) !== null);
      const e = _rstrip_end(text, a, s.a);
      const prev_term = e > a && _TERM_CHARS.includes(text[e - 1]);
      let block;
      if (!piece_prose) block = true;
      else if (rest_punct) block = prev_term;
      else if (prev_term && r('_NEXT_CAP').match(text, s.b)) {
        block = _nwords(text.slice(s.a, s.b)) > 3 || s.u.length > 1 || s.u.some((u) => u.k === 'interj');
      } else block = false;
      if (!block) {
        add(s);
        k += 1;
        continue;
      }
      flush();
      const st = _stage_from(s, emitted_prose);
      if (rest_punct && nxt !== null) {
        st.b = nxt.b;
        k += 1;
      }
      out.push(st);
      k += 1;
    }
    flush();
    return out;
  }

  /** Fronteras de frase de un par: [fin, inicio siguiente, palabras hasta fin]. */
  function _sentence_bounds(text, blk) {
    const res = [];
    let words = 0;
    for (const s of blk.s) {
      if (s.k !== 'txt') {
        words += s.k === 'acot' ? _nwords(text.slice(s.a, s.b)) : 0;
        continue;
      }
      let pos = s.a;
      for (const m of r('_SENT_END').finditer(text, s.a, s.b)) {
        const dot = m.start();
        const wm = r('_sentence_bounds:L1458').search(text.slice(Math.max(s.a, dot - 12), dot));
        const w = wm ? wm.group(1) : '';
        // Abreviatura, inicial o número de uno o dos dígitos ("art. 3. Las"); un año o una cifra larga si cierran frase.
        if (_ABBR.has(_fold(w)) || (w.length === 1 && C.isupper(w)) || (w !== '' && C.isdigit(w) && w.length <= 2)) continue;
        if (r('_sentence_bounds:L1464').match(text.slice(dot + 1, dot + 2))) continue;
        const me = m.end();
        const end = _rstrip_end(text, s.a, me);
        words += _nwords(text.slice(pos, end));
        pos = end;
        res.push([end, me, words]);
      }
      words += _nwords(text.slice(pos, s.b));
    }
    return res;
  }

  /** Reparte un discurso largo de un solo párrafo en trozos de 120-200 palabras. */
  function _split_sentences(text, blocks) {
    const pars = blocks.filter((x) => x.t === 'par');
    const cands = []; // [acumulado, bloque, fin, inicio_siguiente]; fin = null -> frontera entre bloques
    let acc = 0;
    for (const x of pars) {
      const base = acc;
      for (const [end, nstart, w] of _sentence_bounds(text, x)) cands.push([base + w, x, end, nstart]);
      let suma = 0;
      for (const s of x.s) if (s.k === 'txt' || s.k === 'acot') suma += _nwords(text.slice(s.a, s.b));
      acc = base + suma;
      const tail = C.rstrip(text.slice(x.a, x.b));
      if (tail && '.!?…"”»)'.includes(tail[tail.length - 1])) cands.push([acc, x, null, null]);
    }
    const total = acc;
    const cuts = [];
    let last = 0;
    for (let i = 0; i < cands.length; i++) {
      const [cw, bid, end, nstart] = cands[i];
      const run = cw - last;
      if (total - cw < CHUNK_TAIL) continue;
      const nxt_run = i + 1 < cands.length ? cands[i + 1][0] - last : 10 ** 9;
      // Se corta al llegar al tamaño buscado o, si la frase siguiente haría el trozo demasiado largo, antes de ella.
      if ((run >= CHUNK_TARGET && run >= CHUNK_MIN) || (nxt_run > CHUNK_MAX && run >= Math.floor(CHUNK_MIN / 2))) {
        cuts.push([bid, end, nstart]);
        last = cw;
      }
    }
    if (!cuts.length) return blocks;
    const by_block = new Map();
    for (const [bid, end, nstart] of cuts) {
      if (!by_block.has(bid)) by_block.set(bid, []);
      by_block.get(bid).push([end, nstart]);
    }
    const out = [];
    let new_section_next = false;
    for (const x of blocks) {
      if (x.t !== 'par') {
        out.push(x);
        continue;
      }
      x.split = 'sentences';
      if (new_section_next) {
        x.cont = false;
        x.sp = true;
        new_section_next = false;
      }
      const propios = by_block.get(x) || [];
      for (const [end] of propios) if (end === null) new_section_next = true;
      const pts = propios.filter(([e]) => e !== null);
      if (!pts.length) {
        out.push(x);
        continue;
      }
      let cur = x;
      for (const [e, ns] of pts) {
        const left = [], right = [];
        for (const s of cur.s) {
          if (s.b <= e) left.push(s);
          else if (s.a >= ns) right.push(s);
          else { // frase partida dentro de un tramo de texto
            left.push({ k: 'txt', a: s.a, b: e });
            right.push({ k: 'txt', a: ns, b: s.b });
          }
        }
        if (!left.length || !right.length) continue;
        const first = { ...cur, b: left[left.length - 1].b, s: left };
        out.push(first);
        cur = { t: 'par', a: right[0].a, b: cur.b, cont: false, sp: true, split: 'sentences', s: right };
      }
      out.push(cur);
    }
    return out;
  }

  function _finish(text, blocks, fixes) {
    const starts = fixes.map((f) => f[0]);
    const t = (a, b) => _apply(text, a, b, fixes, starts);
    for (const x of blocks) {
      const typ = x.t;
      if (typ === 'par' || typ === 'chron' || typ === 'note' || typ === 'turn') {
        for (const s of x.s) {
          s.t = t(s.a, s.b);
          for (const u of (s.u || [])) u.t = t(u.a, u.b);
        }
        if (typ === 'turn') x.who.t = t(x.who.a, x.who.b);
      } else if (typ === 'stage') {
        if (x.src !== 'speaker') {
          x.tx = t(x.a, x.b);
          for (const u of x.u) u.t = t(u.a, u.b);
        }
      } else if (typ === 'art') {
        x.tx = t(x.a, x.b);
      } else if (typ === 'table') {
        for (const row of x.rows) row.t = t(row.a, row.b);
      } else if (typ === 'list') {
        for (const key of ['head', 'total']) if (x[key]) x[key].t = t(x[key].a, x[key].b);
        for (const row of x.items) row.t = t(row.a, row.b);
      }
    }
  }

  /** Documento estructurado de una intervención (ver cabecera de diario.py). */
  function parse_speech(text, speaker_raw = null, rep_name = null) {
    text = text || '';
    let sp = parse_speaker(speaker_raw, rep_name);
    const [paras, arts, fixes, lead] = _normalize(text);
    if (lead) {
      sp = { ...sp, qual: lead };
      sp.title = `${sp.title} (${lead})`;
      if (!sp.is_chair) sp.label = sp.title;
    }
    const recs = _type_paragraphs(text, paras, fixes,
      ['chair', 'vicechair', 'chair_age', 'secretary'].includes(sp.role));
    const items = _group(recs);
    for (const [a, b] of arts) items.push({ kind: 'art', a, b });
    const clave = (it) => ('a' in it ? it.a
      : (it.kind === 'list' ? (it.head || it.items[0]) : it.rows[0]).a);
    const conClave = items.map((it, i) => [clave(it), i, it]);
    conClave.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const ordenados = conClave.map((x) => x[2]);
    const fx = [fixes, fixes.map((f) => f[0])];

    let blocks = [];
    if (sp.acot) {
      const ac = sp.acot;
      const res = classify_segment(C.upper(ac.slice(0, 1)) + ac.slice(1));
      const units = res && !res.note
        ? res.u.map((u) => ({ ...u, t: ac.slice(u.a, u.b) }))
        : [{ a: 0, b: ac.length, t: ac, c: 'neutral', k: 'other', lab: null }];
      for (const u of units) {
        delete u.a;
        delete u.b;
      }
      const c = res && !res.note ? res.c : 'neutral';
      blocks.push({ t: 'stage', a: 0, b: 0, c, u: units, src: 'speaker', tx: ac });
    }
    for (const it of ordenados) {
      const k = it.kind;
      if (k === 'list') {
        const rows = (it.head ? [it.head] : []).concat(it.items, it.total ? [it.total] : []);
        blocks.push({
          t: 'list', kind: it.lk, a: rows[0].a, b: rows[rows.length - 1].b,
          head: it.head ? { a: it.head.a, b: it.head.b } : null,
          items: it.items.map((x) => ({ a: x.a, b: x.b })),
          total: it.total ? { a: it.total.a, b: it.total.b } : null,
        });
      } else if (k === 'table') {
        const rows = it.rows;
        blocks.push({
          t: 'table', fmt: it.fmt, a: rows[0].a, b: rows[rows.length - 1].b,
          rows: rows.map((x) => ({ a: x.a, b: x.b })),
        });
      } else if (k === 'art') {
        blocks.push({ t: 'art', a: it.a, b: it.b });
      } else if (k === 'turn') {
        const m = r('_TURN').match(text, it.a, it.b);
        const wb = _rstrip_end(text, it.a, m.end());
        const who = parse_speaker(m.group('who'));
        blocks.push({
          t: 'turn', a: it.a, b: it.b, who: { a: it.a, b: wb }, role: who.role, label: who.label,
          s: _scan_segments(text, m.end(), it.b, fx),
        });
      } else if (k === 'chron' || k === 'note') {
        blocks.push({ t: k, a: it.a, b: it.b, s: _scan_segments(text, it.a, it.b, fx) });
      } else if (k === 'stage' && ((v) => ((res) => res !== null && !res.note && res.u.length > 0)(classify_segment(v[0])))(
        _view(text, it.a, it.b, fx))) {
        const [inner, pm] = _view(text, it.a, it.b, fx);
        const res = classify_segment(inner);
        const pos = pm ? (p) => pm[p] : (p) => it.a + p;
        blocks.push({
          t: 'stage', a: it.a, b: it.b, c: res.c, src: 'dash',
          u: res.u.map((u) => ({ ...u, a: pos(u.a), b: pos(u.b) })),
        });
      } else {
        for (const blk of _prose_blocks(text, it.a, it.b, fx)) blocks.push(blk);
      }
    }

    // Numeración §: prosa y tablas, una sola secuencia 1..N.
    let n_sec = 0;
    let hayTabla = false;
    let words = 0;
    for (const x of blocks) {
      if (x.t === 'par' && !x.cont) n_sec += 1;
      if (x.t === 'table') { n_sec += 1; hayTabla = true; }
      if (x.t === 'par') for (const s of x.s) if (s.k === 'txt') words += _nwords(text.slice(s.a, s.b));
    }
    if (n_sec === 1 && words > SPLIT_MIN_WORDS && !hayTabla) blocks = _split_sentences(text, blocks);
    let n = 0;
    for (const x of blocks) {
      if (x.t === 'table' || (x.t === 'par' && (!x.cont || n === 0))) {
        n += 1;
        if (x.t === 'par') x.cont = false;
      }
      if (x.t === 'par' || x.t === 'table') x.n = n;
    }
    _finish(text, blocks, fixes);
    // Guiones internos de OCR que quedan en la prosa ("incompa- tibilidades"): no se tocan, pero se informan.
    const warn = [];
    for (const x of blocks) {
      if (x.t === 'par' || x.t === 'chron' || x.t === 'turn') {
        for (const s of x.s) {
          if (s.k === 'txt' && s.t.includes('- ')) {
            for (const m of r('_OCR_HYPH').finditer(text, s.a, s.b)) warn.push({ k: 'ocr_hyphen', a: m.start() + 1 });
          }
        }
      }
    }
    const doc = {
      v: ENGINE_VERSION, nv: NUMBERING_VERSION, len: text.length, speaker: sp,
      fix: fixes, blocks, n, words,
    };
    if (warn.length) doc.warn = warn;
    return doc;
  }

  function* _iter_units(doc) {
    for (const x of doc.blocks) {
      if (x.t === 'stage') {
        yield* x.u;
      } else if ('s' in x) {
        for (const s of x.s) if (s.k === 'acot') yield* s.u;
      }
    }
  }

  /** Clima de sala: unidades de acotación por clase y etiqueta (documento de parse_speech o texto crudo). */
  function climate(doc_or_text) {
    const doc = doc_or_text !== null && typeof doc_or_text === 'object' ? doc_or_text : parse_speech(doc_or_text);
    const res = { applause: 0, conflict: 0, order: 0, neutral: 0, labels: {}, n: 0 };
    for (const u of _iter_units(doc)) {
      if (!u.c) continue;
      res[u.c] += 1;
      res.n += 1;
      const lab = u.lab;
      if (lab) res.labels[lab] = (Object.prototype.hasOwnProperty.call(res.labels, lab) ? res.labels[lab] : 0) + 1;
    }
    return res;
  }

  /** Párrafos numerados (§): n, tramos sobre el original y texto sin acotaciones. */
  function paragraphs(doc) {
    const out = [];
    for (const x of doc.blocks) {
      if (x.t !== 'par' && x.t !== 'table') continue;
      const txt = x.t === 'table'
        ? x.rows.map((row) => row.t).join('\n')
        : x.s.filter((s) => s.k === 'txt').map((s) => s.t).join(' ');
      if (out.length && out[out.length - 1].n === x.n) {
        const p = out[out.length - 1];
        p.b = x.b;
        p.pieces.push([x.a, x.b]);
        p.t = C.strip(p.t + ' ' + txt);
      } else {
        const p = { n: x.n, a: x.a, b: x.b, pieces: [[x.a, x.b]], t: txt, kind: x.t };
        if (x.split) p.split = x.split;
        out.push(p);
      }
    }
    return out;
  }

  /** Texto reconstruido desde el documento (correcciones aplicadas, sin cabeceras de página). */
  function plain_text(doc, text) {
    const fixes = doc.fix.filter((f) => f[3] !== 'quote' && f[3] !== 'lead_speaker');
    const starts = fixes.map((f) => f[0]);
    const parts = [];
    for (const x of doc.blocks) {
      const typ = x.t;
      if (typ === 'art' || x.src === 'speaker') continue;
      const chunk = _apply(text, x.a, x.b, fixes, starts);
      const joined = (typ === 'par' && (x.cont || x.sp)) || (typ === 'stage' && x.inpar);
      if (parts.length && joined) {
        parts.push(' ' + chunk);
      } else {
        if (parts.length) parts.push('\n\n');
        parts.push(chunk);
      }
    }
    return parts.join('');
  }

  R2.diario = {
    ENGINE_VERSION, NUMBERING_VERSION, CLASS_RANK, SPLIT_MIN_WORDS,
    parse_speech, parse_speaker, classify_segment, climate, paragraphs, plain_text,
    iter_units: (doc) => Array.from(_iter_units(doc)),
    _iter_units,
    /** Para pruebas y diagnóstico. */
    _interno: {
      PAT, patron: r, _fold, _nwords, _lev_le, _surname, _chair_name, _parse_speaker_cached, _classify_unit, _unit_spans,
      _raw_spans, _join_fix, _normalize, _view, _apply, _match_parens, _scan_segments, _tableish, _is_heading,
      _speech_marks, _reading_kind, _acta_like, _type_paragraphs, _group, _prose_blocks, _sentence_bounds,
      _split_sentences, _finish, _extend_dash_chain, _dashUnit, _dashUnitManual,
    },
  };
})(globalThis.R2 = globalThis.R2 || {});

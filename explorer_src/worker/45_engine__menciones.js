/* ===== src/engine/menciones.js ===== */
/* Diarios Explorer · engine/menciones.js
 *
 * Menciones a personas en las intervenciones de una biblioteca y red de quién menciona a quién.
 *
 * Una mención es una cadena de formas de tratamiento o de cargo («el señor», «honorable diputado», «O Sr. Deputado»,
 * «presidente») seguida de un nombre con mayúscula, o un apellido suelto que la biblioteca ya usa con tratamiento. El
 * nombre se resuelve con la lista de oradores del corpus (rep_name, partido y legislatura de cada intervención):
 *  · miembro de la cámara si tiene escaño en la legislatura de esa sesión (desempates: el sexo del tratamiento, quien
 *    habla o preside la sesión, quien es del Gobierno en esa legislatura, la actividad y, al final, la evidencia de la
 *    propia biblioteca); si hay varios y no se desempata, la mención queda ambigua y no entra en la red;
 *  · persona externa si la forma es de un cargo que no ocupa un miembro (senador, gobernador, juez, rey), si el nombre
 *    es de quien no tenía escaño entonces o si no es de ningún orador;
 *  · jefes de Estado y de Gobierno por fecha, con las tablas de mandatos del registro (datos/menciones_parlaibero.json),
 *    también cuando el cargo va sin nombre («el presidente de la República»). El jefe de Estado es su nodo externo desde
 *    el inicio de su mandato; antes, su nodo de diputado.
 * Se descartan los turnos de la Mesa (quien preside, secretarías, relatores, lecturas del orden del día y del despacho),
 * las acotaciones, las listas de asistencia y de votación, las entradas del sumario, las fórmulas de dar la palabra, las
 * automenciones y los miembros de cámaras subnacionales. Las menciones de la Mesa no cuentan, pero sirven de prueba de
 * cómo se nombra a cada persona.
 *
 * La precisión se midió a mano en tres rondas sobre 16 muestras (una por país): la identidad es correcta en el 90 % de
 * las menciones y el 83 % son además útiles (no son lecturas de la Mesa ni fórmulas). Los errores que quedan son sobre
 * todo el cargo usado en abstracto («el presidente de la República» de una norma) y lecturas de la Secretaría que el
 * corpus atribuye a un diputado.
 *
 * La red va de quien habla a quien menciona; entre diputados se distingue si se dirige a él o si habla de él. Los focos
 * salen del algoritmo de Leiden sobre la red sin dirección (R2.leiden).
 *
 * API (R2.menciones)
 *   red(ctx, ids, opciones) → promesa del resultado (resumen, personas, mencionan, matriz, externas, focos, dialogos,
 *     comenciones, red); véase DEFECTOS para las opciones
 *   detectar(datos) → promesa de las menciones de unas filas (el detector, sin la agregación)
 *   formasDe(pais) → configuración del país (formas, jefes, históricos) o null
 *   DEFECTOS
 */
(function (R2) {
  'use strict';

  const S = R2.sql, P = R2.partition, LEI = R2.leiden;
  if (!S || !P || !LEI) throw new Error('engine/menciones.js necesita R2.sql, R2.partition y R2.leiden');

  const DEFECTOS = Object.freeze({ resolucion: 1, semilla: 1, personas: 40, contextos: 6 });
  const MAX_CONTEXTO = 250000;   // filas de las sesiones de la biblioteca que se leen para situar los turnos de la Mesa
  const TROZO = 400;             // intervenciones por lectura de texto

  // ------------------------------------------------------------------------------------------------ registro del país
  const rehacer = (v) => (v && typeof v === 'object' && typeof v.re === 'string' ? new RegExp(v.re, v.fl || '') : v);
  const rehacerHondo = (v) => (Array.isArray(v) ? v.map(rehacerHondo) : rehacer(v));
  const cacheFormas = new Map();

  /** Configuración del país (formas, jefes, históricos, alias) del registro, con las expresiones regulares rehechas. */
  function formasDe(pais) {
    const p = String(pais || '').toUpperCase();
    if (cacheFormas.has(p)) return cacheFormas.get(p);
    const reg = R2.datos && R2.datos.menciones;
    const crudo = reg && reg.paises && Object.prototype.hasOwnProperty.call(reg.paises, p) ? reg.paises[p] : null;
    const C = crudo ? Object.fromEntries(Object.entries(crudo).map(([k, v]) => [k, rehacerHondo(v)])) : null;
    if (C) C.pais = p;
    cacheFormas.set(p, C);
    return C;
  }

  const nombresPila = () => ((R2.datos && R2.datos.menciones && R2.datos.menciones.nombres_pila) || {});
  const hay = (pais) => !!formasDe(pais);

  // ------------------------------------------------------------------------------------------------ detector
  /** Menciones de unas filas: { pais, filas (con text), contexto (filas de sus sesiones, sin texto), oradores, ceder, progreso }. */
  async function detectar(datos) {
    const PAIS = String(datos.pais || '').toUpperCase();
    const C = datos.config || formasDe(PAIS);
    if (!C) throw new Error(`engine/menciones.js: no hay formas de tratamiento para «${PAIS}»`);
    const filas = datos.filas || [];
    const TODAS = datos.contexto && datos.contexto.length ? datos.contexto : filas;
    const oradores = datos.oradores || [];
    const ceder = typeof datos.ceder === 'function' ? datos.ceder : async () => {};
    const progreso = typeof datos.progreso === 'function' ? datos.progreso : () => {};
    const largoDe = (f) => (f.text ? f.text.length : Math.round((f.nwords || 0) * 6.2));


    const plegar = (s) => String(s || '').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
    const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'i', 'e', 'da', 'do', 'dos', 'das', 'van', 'von', 'di', 'd', 'el']);
    const tokens = (s) => plegar(s).replace(/[’']/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
    const sinParticulas = (t) => t.filter((x) => !PARTICULAS.has(x));
    const conjunto = (xs) => new Set(xs.map((x) => plegar(x).replace(/\.$/, '')));
    const MIEMBRO = conjunto(C.miembro), TRATAMIENTO = conjunto(C.tratamiento), GOBIERNO = conjunto(C.gobierno);
    const DESCRIPTIVO = conjunto(C.descriptivo), EXTERNO = conjunto(C.externo), NO_PERSONA = conjunto(C.noPersona);
    const COMUNES = conjunto(C.comunes), LUGARES = conjunto(C.lugares);
    const TOP10 = new Set(['garcia', 'fernandez', 'gonzalez', 'rodriguez', 'lopez', 'martinez', 'sanchez', 'perez', 'gomez', 'martin', 'silva', 'santos', 'oliveira', 'souza', 'sousa']);
    const LEV = (a, b) => { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; let prev = Array.from({ length: n + 1 }, (_, j) => j);
      for (let i2 = 1; i2 <= m; i2++) { const cur = [i2]; for (let j2 = 1; j2 <= n; j2++) cur[j2] = Math.min(prev[j2] + 1, cur[j2 - 1] + 1, prev[j2 - 1] + (a[i2 - 1] === b[j2 - 1] ? 0 : 1)); prev = cur; } return prev[n]; };
    /** Erratas del OCR de «presidente» («ptesidente», «presideme», «pre»): no son nombres */
    const casiForma = (w) => /^pre(?:s|si|sid)?$/.test(w) || (w.length >= 7 && (LEV(w, 'presidente') <= 2 || LEV(w, 'presidenta') <= 2 || LEV(w, 'vicepresidente') <= 2));
    const esForma = (w) => MIEMBRO.has(w) || TRATAMIENTO.has(w) || GOBIERNO.has(w) || DESCRIPTIVO.has(w) || EXTERNO.has(w);

    // ---------------------------------------------------------------------------------------------------------------------------
    // Oradores: nombre de pila y apellidos («APELLIDOS, NOMBRE» o «NOMBRE APELLIDOS», separando los nombres de pila con los que son
    // primera palabra de al menos dos oradores), legislaturas con su actividad y si en ellas consta partido.
    const pilaCuenta = new Map();
    for (const o of oradores) {
      const n = o.rep_name || '';
      if (!n || /identific/i.test(n)) continue;
      const p = n.includes(',') ? tokens(n.split(',').slice(1).join(' ')) : tokens(n).slice(0, 1);
      for (const t of sinParticulas(p)) pilaCuenta.set(t, (pilaCuenta.get(t) || 0) + 1);
    }
    // Léxico común de nombres de pila, sacado de los 16 listados de oradores (nombres_pila.json): «Leonel», «Bernardo» o «Marta»
    // son nombres aunque en el país de la biblioteca no sean primera palabra de dos oradores; más los hipocorísticos habituales
    const PILA_COMUN = datos.pila || {};
    const HIPOCORISTICOS = new Set(['pepe', 'paco', 'pancho', 'lucho', 'toto', 'nacho', 'chema', 'manolo', 'quique', 'kike', 'chucho', 'beto', 'tito', 'lalo', 'meme', 'chepe', 'cacho', 'pocho', 'tete', 'zeca', 'ze']);
    const esPila = (t) => (pilaCuenta.get(t) || 0) >= 2 || (PILA_COMUN[t] || 0) >= 3 || HIPOCORISTICOS.has(t);
    const dep = new Map();
    for (const o of oradores) {
      if (!o.rep_name || /identific/i.test(o.rep_name) || !o.id_dep) continue;
      let d = dep.get(o.id_dep);
      if (!d) {
        let n = o.rep_name;
        if (n.includes(',') && /^\s*de\s/i.test(n.split(',')[0])) n = `${n.split(',').slice(1).join(' ').trim()} ${n.split(',')[0].trim()}`;   // «DE ALTUVE, ROSA LOURDES VIGIL»
        let pila, ap, unidades = null;
        if (n.includes(',')) { ap = sinParticulas(tokens(n.split(',')[0])); pila = sinParticulas(tokens(n.split(',').slice(1).join(' '))); }
        else {
          const t = sinParticulas(tokens(n)), palabras = [];
          for (const w of n.trim().split(/\s+/).filter((x) => !PARTICULAS.has(plegar(x)))) {   // «Gonzalo Ibáñez Santa María»: «Santa María» es un apellido
            if (palabras.length && /^(san|santa|santo|sao)$/.test(plegar(palabras[palabras.length - 1]))) palabras[palabras.length - 1] += ' ' + w; else palabras.push(w);
          }
          if (C.lengua === 'es' && palabras.length >= 4) {   // «Paola Verenice Pabón Camino», «Daniel Roy Gilchrist Noboa Azín»
            ap = sinParticulas(tokens(palabras.slice(-2).join(' '))); pila = sinParticulas(tokens(palabras.slice(0, -2).join(' ')));
            unidades = palabras.map((w) => sinParticulas(tokens(w))).filter((x) => x.length);
          } else {
            let k = 1; while (k < t.length - 1 && (esPila(t[k]) || t[k].length === 1)) k++;   // nombres de pila e iniciales («Javier A. Bedoya»)
            if (C.lengua === 'es' && k >= 2 && t.length - k === 1 && COMUNES.has(t[k - 1])) k--;   // «Juan Martín García»: Martín es apellido
            pila = t.slice(0, k); ap = t.slice(k);
          }
          if (!ap.length) { ap = t.slice(-1); pila = t.slice(0, -1); }
        }
        d = { id: o.id_dep, nombre: n, pila, ap, toks: pila.concat(ap), partidos: {}, legs: new Map(), n: 0, sexos: {}, unidades };
        dep.set(o.id_dep, d);
      }
      const leg = String(o.legislature), conPartido = !!o.party && !/identific|^\?$/i.test(o.party);
      const L = d.legs.get(leg) || { n: 0, partido: false, gob: 0 };
      // gob: intervenciones como miembro del Gobierno («El señor MINISTRO DE…»)
      L.n += o.n || 0; L.gob += o.gob || 0; if (conPartido) { L.partido = true; d.partidos[leg] = o.party; } else if (!d.partidos[leg]) d.partidos[leg] = o.party;
      d.legs.set(leg, L); d.n += o.n || 0;
      if (o.desde && (!d.desde || o.desde < d.desde)) d.desde = o.desde;
      if (o.hasta && (!d.hasta || o.hasta > d.hasta)) d.hasta = o.hasta;
      if (o.sex === 'M' || o.sex === 'F') d.sexos[o.sex] = (d.sexos[o.sex] || 0) + (o.n || 1);
    }
    for (const d of dep.values()) { const s = Object.entries(d.sexos).sort((a, b) => b[1] - a[1]); d.sexo = s.length ? s[0][0] : null; }
    // Nombres sin coma de cuatro o más palabras: los apellidos empiezan, por omisión, en la penúltima («Paola Verenice | Pabón Camino»);
    // si la biblioteca nombra con una forma («diputado», «señor»…) a una palabra anterior, los apellidos empiezan en ella: «diputado
    // Villalta» (José María | Villalta Flórez Estrada), «congresista Lozada» (María del Carmen | Lozada Rendón de Gamboa)
    {
      const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const formas = [...new Set([...C.miembro, ...C.tratamiento])].filter(Boolean).sort((a, b) => b.length - a.length)
        .map((w) => `[${w[0]}${w[0].toUpperCase()}]${esc(w.slice(1))}|${esc(w.toUpperCase())}`).join('|');
      const rx = new RegExp(`(?<![\\p{L}])(?:${formas})[ \\t]+(\\p{Lu}[\\p{L}'’]+)`, 'gu');
      const trasForma = new Map();
      for (const f of filas) for (const x of String(f.text || '').matchAll(rx)) { const t = plegar(x[1]); trasForma.set(t, (trasForma.get(t) || 0) + 1); }
      for (const d of dep.values()) {
        if (!d.unidades || d.unidades.length < 4) continue;
        const u = d.unidades, k0 = u.length - 2, c = (k) => trasForma.get(u[k][0]) || 0;
        let k = k0;
        for (let j = k0 - 1; j >= 1; j--) if (!esPila(u[j][0]) && c(j) >= 3 && c(j) >= 3 * Math.max(1, c(k0))) { k = j; break; }
        if (k !== k0) { d.pila = u.slice(0, k).flat(); d.ap = u.slice(k).flat(); d.toks = d.pila.concat(d.ap); }
      }
    }
    // Orden de las legislaturas por su primera fecha, para saber quién tenía escaño antes y después
    const inicioLeg = new Map();
    for (const o of oradores) { const l = String(o.legislature); if (o.desde && (!inicioLeg.has(l) || o.desde < inicioLeg.get(l))) inicioLeg.set(l, o.desde); }
    const ordenLeg = new Map([...inicioLeg].sort((a, b) => a[1].localeCompare(b[1])).map(([l], i) => [l, i]));
    const deps = [...dep.values()];
    const conPartidoPais = oradores.filter((o) => o.party && !/identific/i.test(o.party)).length > 0.7 * oradores.length;
    const apRef = (d) => (C.nombreParlamentario || C.apellidoUltimo ? d.toks[d.toks.length - 1] : d.ap[0]);
    const porToken = new Map();
    for (const d of deps) for (const t of new Set(d.toks)) { if (!porToken.has(t)) porToken.set(t, []); porToken.get(t).push(d); }
    const subsecuencia = (M, N) => { let j = 0; for (const t of N) if (t === M[j]) j++; return j === M.length; };
    const prefijo = (M, N) => M.length <= N.length && M.every((t, i) => N[i] === t);
    /** Fuerza con la que los tokens M nombran al orador d: 3 nombre completo o sus apellidos (con o sin nombre de pila), 2 termina en
     *  su apellido de referencia, 1 otra parte de su nombre, 0 no lo nombra. */
    const pilaYApellido = (M, d) => { for (let j = 1; j < M.length && j <= d.pila.length; j++) if (prefijo(M.slice(0, j), d.pila) && prefijo(M.slice(j), d.ap)) return true; return false; };
    function fuerza(M, d) {
      if (!M.length) return 0;
      if (!subsecuencia(M, d.toks)) return d.toks.length >= 3 && d.ap.length >= 2 && M[0] === d.toks[0] && M.length <= d.toks.length + 2 && subsecuencia(d.toks, M) ? 3 : 0;
      if (M.length === d.toks.length || (M.length >= 2 && prefijo(M, d.ap)) || (M.length >= 2 && pilaYApellido(M, d))) return 3;   // «José María Aznar»
      if (C.apellidoUltimo && M.length >= 2 && d.pila[0] === M[0] && M[M.length - 1] === d.toks[d.toks.length - 1]) return 3;   // «João Amaral»
      if (M.length >= 2 && d.pila.includes(M[0]) && prefijo(M.slice(1), d.ap)) return 2;   // «Leonel Fernández» no es Omar Leonel
      if (M[M.length - 1] === apRef(d)) return 2;
      if (!C.nombreParlamentario && !C.apellidoUltimo && d.ap.length >= 2 && TOP10.has(d.ap[0]) && !COMUNES.has(d.ap[1]) && M[M.length - 1] === d.ap[1]) return 2;   // «señor Zapatero» (Rodríguez), «señor Rubalcaba» (Pérez)
      return 1;
    }
    const HIPO = { rafa: 'rafael', nacho: 'ignacio', pepe: 'jose', paco: 'francisco', pancho: 'francisco', lucho: 'luis', manolo: 'manuel',
      quique: 'enrique', kike: 'enrique', chucho: 'jesus', beto: 'alberto', lalo: 'eduardo', chepe: 'jose', tono: 'antonio', memo: 'guillermo',
      fito: 'rodolfo', nito: 'laurentino', chema: 'jose', toto: 'jorge', cacho: 'carlos', pocho: 'alfonso', zeca: 'jose', ze: 'jose' };
    function candidatos(M) {
      const base = porToken.get(M[0]) || [];
      const cs = base.map((d) => ({ d, s: fuerza(M, d) })).filter((c) => c.s > 0);
      if (cs.length || !M.some((t) => HIPO[t])) return cs;
      const M2 = M.map((t) => HIPO[t] || t);
      return (porToken.get(M2[0]) || []).map((d) => ({ d, s: fuerza(M2, d) })).filter((c) => c.s > 0);
    }

    // ---------------------------------------------------------------------------------------------------------------------------
    // Presidencia de las sesiones: etiquetas de quien preside en los 16 corpus («PRESIDENTE (Arthur Lira)», «El señor PRESIDENTE»,
    // «O Sr. Presidente», «El señor VIERA-GALLO (Presidente)», «Presidencia, Nombre», «NOMBRE, PRESIDENTE»…)
    const RX_MESA = /^(?:(?:el|la|o|a)\s+)?(?:(?:señor|señora|señorita|sr\.?ª?|sra\.?|senhor|senhora)\s+)?(?:vice[- ]?)?president[ea]\b/i;
    const NO_MESA = /gobierno|rep[uú]blica|consejo de ministros|estados unidos|banco|naci[oó]n|constitucional|ministr|conselho|governo/i;
    function esPresidenciaEtiqueta(f) {
      const s = String(f.speaker || '').replace(/[.:—–]+|\s-\s/g, ' ').replace(/\s+/g, ' ').trim();
      if (RX_MESA.test(s) && !NO_MESA.test(s.replace(/\(.*$/, ''))) return true;
      if (/^(presidencia\b|direcci[oó]n de la sesi[oó]n|ocupa la presidencia)/i.test(s)) return true;
      if (/^(?:(?:el|la|o|a)\s+)?(?:(?:señor|señora|sr|sra|senhor|senhora)\s+)?(?:secretari[oa]|secret[aá]ri[oa]|secretar[ií]a|prosecretari[oa]|subsecretari[oa]|subsecretar[ií]a|relator[a]?|locutor[a]?|taqu[ií]graf[oa]|maestr[oa] de ceremonias?|mestre de cerim[oô]nias|apresentador[a]?)\b/i.test(s)) return true;   // lecturas de la Mesa
      if (/[,\-]\s*(?:(?:sub|pro)?secretari[oa]\b|relator[a]?\b|asistente\s+del?\s+(?:sub)?secretari)/i.test(s)) return true;   // «QUIBIAN T. PANAY G., SECRETARIO GENERAL», «…-ASISTENTE DEL SECRETARIO»
      if (/\((?:vice[- ]?)?(?:president[ea]|(?:pro|sub)?secretari[oa]|relator[a]?)[^)]*\)\s*:?\s*$/i.test(s)) return true;   // «El señor ÁLVAREZ (Prosecretario accidental)»
      if (/[,\-]\s*(?:vice[- ]?)?president[ea](?:\s+encargad[oa]|\s+en funciones|\s+(?:de la asamblea(?: nacional)?|de la c[aá]mara|del congreso)(?:\s+de diputados)?)?\s*$/i.test(s)) return true;
      return false;
    }
    // turnos que empiezan con una fórmula de la Presidencia o de la Secretaría: lectura del orden del día y del despacho, votaciones,
    // apertura y cierre («Por instrucciones de la Presidencia…», «PUNTO SEGUNDO:», «No habiendo discusión, se pregunta si se aprueba»)
    const RX_TURNO_MESA = /^\s*(?:\(?[^)\n]{0,40}\)\s*)?(?:por instrucciones de la presidencia|se levanta la sesi[oó]n|se abre la sesi[oó]n|se va a dar lectura|se da cuenta|punto\s+(?:primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo)\b|orden del d[ií]a\b|no habiendo discusi[oó]n|se abre a votaci[oó]n|\(se realiza|secretar[ií]a ha tomado nota|a\s+discusi[oó]n\b|se somete a (?:votaci[oó]n|consideraci[oó]n)|en votaci[oó]n econ[oó]mica|[a-z]\)\s+(?:iniciativa|dictamen|moci[oó]n|punto)\b|art[ií]culo\s+\d+\s*[.º°]|la corte de constitucionalidad|se leer[aá]\b|en forma resumida|señores representantes,\s+(?:los|el)\s+(?:dos\s+)?candidatos|¿\s*diputad[oa]\b|sigue abierto el sistema|(?:(?:muchas\s+)?gracias[^.\n]{0,50}[.,]\s*)?(?:dictamen\s+(?:n[uú]mero|no\.?|n\.?\s*º)|comisi[oó]n\s+de\s+[^\n.]{3,80}\n))/i;
    const filasMesa = new Set(TODAS.filter((f) => esPresidenciaEtiqueta(f)).map((f) => f.id));
    const conMesaEtiqueta = new Set(TODAS.filter((f) => filasMesa.has(f.id)).map((f) => f.id_session));
    const RX_ENTRADA_SUMARIO = /(?:DIPUTAD[OA]|EL PRESIDENTE|LA PRESIDENTA|[Dd]iputad[oa]|[Ee]l presidente|[Ll]a presidenta)[^:\n]{3,90}:[ \t]*\d{1,3}\b/g;
    const RX_DOCUMENTO = /^\s*(?:\p{Lu}[\p{L}.]*[ \t]?){1,4},[ \t]+\d{1,2}[ \t]+de[ \t]+\p{L}+[ \t]+de(?:l)?[ \t]+\d{4}/u;
    const RX_SECRETARIO_LEE = /^\s*(?:(?:muchas\s+)?gracias,?\s+(?:señor(?:a)?\s+)?president[ea],?\s+)?con\s+(?:mucho\s+)?gusto,?\s+(?:señor(?:a)?\s+)?president[ea]/i;
    {
      const vistosTexto = new Set();
      for (const f of TODAS) {
        const t = String(f.text || ''), ini = t.slice(0, 200);
        if (RX_TURNO_MESA.test(ini) || /^\s*[«"“]\s*(?:escudo|dictamen|acta de la sesi[oó]n|comunicaci[oó]n|oficio)/i.test(ini) || RX_SECRETARIO_LEE.test(ini) || RX_DOCUMENTO.test(ini) || /^\s*NUMERO\s+\d+/.test(ini)
          || /(?:^|\n)[ \t]*SUMARIO[ \t]*(?:\n|$)/.test(t.slice(0, 1500)) || (t.slice(0, 4000).match(RX_ENTRADA_SUMARIO) || []).length >= 3) filasMesa.add(f.id);
        if (t.length >= 200) { const k = `${f.id_session}|${t}`; if (vistosTexto.has(k)) filasMesa.add(f.id); else vistosTexto.add(k); }   // pasaje repetido
      }
    }
    // Presidencia deducida en las sesiones sin ninguna fila de Presidencia en las etiquetas (Guatemala y El Salvador; y las sesiones de
    // otros países en que el presidente figura solo con su nombre): quien tiene al menos una cuarta parte de los turnos, cortos. Todos
    // sus turnos de esa sesión son de la Mesa (llamamientos, lecturas del orden del día).
    {
      const conMesa = conMesaEtiqueta;
      const porSesion = new Map();
      for (const f of TODAS) { if (!f.id_dep || conMesa.has(f.id_session)) continue; if (!porSesion.has(f.id_session)) porSesion.set(f.id_session, []); porSesion.get(f.id_session).push(f); }
      for (const fs_ of porSesion.values()) {
        const cuenta = new Map(); for (const f of fs_) cuenta.set(f.id_dep, (cuenta.get(f.id_dep) || []).concat([f]));
        const [id, suyas] = [...cuenta].sort((a, b) => b[1].length - a[1].length)[0] || [];
        if (!id || suyas.length < 0.25 * fs_.length || suyas.length < 5) continue;
        const mediana = (xs) => { const l = xs.map(largoDe).sort((a, b) => a - b); return l[Math.floor(l.length / 2)]; };
        if (mediana(suyas) > 400 && suyas.length < 0.35 * fs_.length) continue;          // con más de un tercio de los turnos, aunque lea largo
        for (const f of suyas) filasMesa.add(f.id);
        for (const [id2, otras] of cuenta) if (id2 !== id && otras.length >= 5 && otras.length >= 0.15 * fs_.length && mediana(otras) <= 250) for (const f of otras) filasMesa.add(f.id);   // secretarios
      }
      const FORMULA = /tiene (?:usted )?la palabra|se le concede la palabra|a discusi[oó]n|se somete|los que est[eé]n (?:de acuerdo|por la afirmativa)|se incorpora|anuncio la incorporaci[oó]n|queda aprobad|se aprueba|sustituye al?\b|votaci[oó]n|se abre el registro|secretar[ií]a/i;
      for (const fs_ of porSesion.values()) {
        const cuenta = new Map(); for (const f of fs_) cuenta.set(f.id_dep, (cuenta.get(f.id_dep) || []).concat([f]));
        const mediana = (xs) => { const l = xs.map(largoDe).sort((a, b) => a - b); return l[Math.floor(l.length / 2)]; };
        for (const suyas of cuenta.values()) {
          const con = suyas.filter((f) => FORMULA.test(String(f.text || '')));
          if (con.length >= 3 && con.length >= 0.5 * suyas.length && mediana(suyas) <= 400) for (const f of suyas) filasMesa.add(f.id);
        }
      }
    }
    function esPresidencia(f) { return filasMesa.has(f.id); }
    // los turnos con solo su nombre de quien preside una sesión (identificado por su etiqueta de Presidencia) son de la Mesa cuando esa
    // es su etiqueta habitual en la sesión (Colombia: «Presidencia, Nombre» al principio y «Nombre» en el resto): más turnos con su
    // nombre que con la de Presidencia, al menos la quinta parte de los de la sesión, y cortos. Con el partido o «diputado» en la
    // etiqueta («PAULO FEIJÓ (Bloco/PR-RJ)», «SEÑOR DIPUTADO GUSTAVO…») o con pocos turnos, ha bajado a su escaño a intervenir.
    {
      const porSesion = new Map();
      for (const f of TODAS) { if (!porSesion.has(f.id_session)) porSesion.set(f.id_session, []); porSesion.get(f.id_session).push(f); }
      const deEscano = (s) => /\([^)]*\p{Lu}{2,}[^)]*\)/u.test(s) || /diputad|deputad|asamble[ií]sta|representante|congresista|legislador|senador/i.test(s);
      for (const fs_ of porSesion.values()) {
        for (const id of new Set(fs_.filter((f) => filasMesa.has(f.id) && f.id_dep).map((f) => f.id_dep))) {
          const pres = fs_.filter((f) => f.id_dep === id && filasMesa.has(f.id)).length;
          const propias = fs_.filter((f) => f.id_dep === id && !filasMesa.has(f.id) && !deEscano(String(f.speaker || '')));
          if (!propias.length || propias.length < pres || propias.length < 0.2 * fs_.length) continue;
          const l = propias.map(largoDe).sort((a, b) => a - b);
          if (l[Math.floor(l.length / 2)] > 400) continue;
          for (const f of propias) filasMesa.add(f.id);
        }
      }
    }
    const nombreEnEtiqueta = (s) => { const m = /\(([^)]+)\)/.exec(s) || /^presidencia,\s*(.+)$/i.exec(s) || /^(.+?),\s*(?:vice[- ]?)?president/i.exec(s); return m ? m[1] : ''; };
    const presideEn = new Map(), hablaEn = new Map(), presidentes = new Set();
    for (const f of TODAS) {
      const s = f.id_session;
      if (esPresidencia(f)) {
        let quien = f.id_dep && dep.has(f.id_dep) ? dep.get(f.id_dep) : null;
        if (!quien) { const t = sinParticulas(tokens(nombreEnEtiqueta(String(f.speaker || '')))); if (t.length) { const c = candidatos(t).filter((x) => x.s >= 2); if (c.length === 1) quien = c[0].d; } }
        if (quien) { if (!presideEn.has(s)) presideEn.set(s, new Set()); presideEn.get(s).add(quien.id); presidentes.add(quien.id); }
      } else if (f.id_dep) { if (!hablaEn.has(s)) hablaEn.set(s, new Set()); hablaEn.get(s).add(f.id_dep); }
    }

    // ---------------------------------------------------------------------------------------------------------------------------
    // Expresión de las cadenas de formas: cada forma en minúscula, con mayúscula inicial o en mayúsculas; las abreviaturas con punto
    const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ABREV = new Set(['sr', 'sra', 'srta', 'dr', 'dra', 'lic', 'ing', 'arq', 'prof', 'profa', 'dip', 'dep', 'sen', 'h', 'exmo', 'exma', 'eng']);
    const variantes = (w) => {
      const base = w.replace(/\.$/, ''), cap = base.charAt(0).toUpperCase() + base.slice(1), may = base.toUpperCase();
      const punto = ABREV.has(plegar(base)) ? '\\.' : '';
      if (base === 'sr.ª' || base === 'srª') return '[Ss][Rr]\\.?ª';
      return [...new Set([base, cap, may])].map((v) => escapar(v) + punto).join('|');
    };
    const FORMAS = [...new Set([...C.miembro, ...C.tratamiento, ...C.gobierno, ...C.descriptivo, ...C.externo])].sort((a, b) => b.length - a.length);
    const FORMA = `(?:${FORMAS.map(variantes).join('|')})`;
    const PART = "(?:de|del|de la|de los|de las|da|do|dos|das|y|i|e|van|von|di)";
    const PAL = "(?:\\p{Lu}\\.|\\p{Lu}[\\p{L}'’\\-]*)";      // el punto, solo tras una inicial («J. Pérez»): si no, es fin de frase
    const NOMBRE = `(${PAL}(?:[ \\t]+(?:${PART}[ \\t]+)?${PAL}){0,5})`;
    const RX_CADENA = new RegExp(`(?<![\\p{L}\\p{N}])(${FORMA}(?:[ \\t]+${FORMA}){0,3})[ \\t]+${NOMBRE}`, 'gu');
    // nombre en aposición tras un cargo sin nombre («…, la señora de Perón», «…, doctor Óscar Arias Sánchez»)
    const RX_APOSICION = new RegExp(`^\\s*,?\\s*(?:(?:[Ee]l|[Ll]a|[Oo]|[Aa])\\s+)?(?:(?:${[...new Set([...C.tratamiento, ...C.descriptivo])].sort((a, b) => b.length - a.length).map(variantes).join('|')})\\s+)*(?:(?:de|da)\\s+)?\\p{Lu}`, 'u');
    // formas en plural (con su singular, si es forma del país): la lista de nombres que sigue son menciones con esa forma
    const PLURALES = new Map(Object.entries(C.lengua === 'pt'
      ? { deputados: 'deputado', deputadas: 'deputada', senadores: 'senador', senadoras: 'senadora', senhores: 'senhor', senhoras: 'senhora',
          ministros: 'ministro', ministras: 'ministra', colegas: 'colega', companheiros: 'companheiro', companheiras: 'companheira', srs: 'sr', sras: 'sra', deps: 'dep' }
      : { diputados: 'diputado', diputadas: 'diputada', legisladores: 'legislador', legisladoras: 'legisladora', congresistas: 'congresista',
          representantes: 'representante', asambleístas: 'asambleísta', asambleistas: 'asambleísta', senadores: 'senador', senadoras: 'senadora',
          señores: 'señor', señoras: 'señora', honorables: 'honorable', colegas: 'colega', compañeros: 'compañero', compañeras: 'compañera',
          ministros: 'ministro', ministras: 'ministra', doctores: 'doctor', doctoras: 'doctora', magistrados: 'magistrado', magistradas: 'magistrada',
          concejales: 'concejal', srs: 'sr', sres: 'sr', sras: 'sra', hh: 'h', dips: 'dip' }).filter(([, sg]) => esForma(plegar(sg))));
    const variantesPlural = (w) => { const cap = w.charAt(0).toUpperCase() + w.slice(1), may = w.toUpperCase(), punto = w.length <= 4 ? '\\.?' : '';
      return [...new Set([w, cap, may])].map((v) => escapar(v) + punto).join('|'); };
    const PLURAL = `(?:${[...PLURALES.keys()].sort((a, b) => b.length - a.length).map(variantesPlural).join('|')})`;
    const RX_PLURAL = new RegExp(`(?<![\\p{L}\\p{N}])(${PLURAL}(?:[ \\t]+(?:${PLURAL}|${FORMA})){0,3})[ \\t]+${NOMBRE}`, 'gu');
    const esPlural = (w) => { const k = plegar(w).replace(/\.$/, ''); return PLURALES.has(k) || (/s$/.test(k) && k.length > 4 && (esForma(k.slice(0, -1)) || (/es$/.test(k) && esForma(k.slice(0, -2))))); };
    const soloFormas = (t) => t.trim().split(/[ \t]+/).every((w) => { const k = plegar(w).replace(/\.$/, ''); return esForma(k) || esPlural(w) || PARTICULAS.has(k) || NO_PERSONA.has(k); });
    const singular = (cadena) => cadena.trim().split(/[ \t]+/).map((w) => { const k = plegar(w).replace(/\.$/, ''); return PLURALES.has(k) ? PLURALES.get(k) : w; }).join(' ');
    const RX_SEP = /[ \t]*,[ \t]*(?:(?:y|e)[ \t]+)?|[ \t]+(?:y|e)[ \t]+/y;
    const RX_NOM = new RegExp(NOMBRE, 'uy');
    /** Los nombres que siguen en la lista («, B, C y D») desde la posición pos: [[inicio, texto], …] */
    function siguientesDeLista(texto, pos) {
      const out = [];
      for (let k = 0; k < 40; k++) {
        RX_SEP.lastIndex = pos; const s = RX_SEP.exec(texto); if (!s) break;
        RX_NOM.lastIndex = pos + s[0].length; const n = RX_NOM.exec(texto); if (!n) break;
        out.push([pos + s[0].length, n[0]]); pos = RX_NOM.lastIndex;
        if (/(?:^|[ \t,])(?:y|e)[ \t]+$/.test(s[0])) break;
      }
      return out;
    }
    // cargo + «de/del Institución», + coma + nombre («el presidente del Gobierno, Pedro Sánchez»)
    const CARGOS_INST = [...new Set([...C.gobierno, ...C.externo, ...C.descriptivo])].sort((a, b) => b.length - a.length);
    const RX_INST = new RegExp(`(?<![\\p{L}])(${CARGOS_INST.map(variantes).join('|')})[ \\t]+(?:(?:de|del|de la|da|do|dos|das)[ \\t]+)?[\\p{L} \\t]{2,60}?,[ \\t]+${NOMBRE}`, 'gu');   // «fiscal Anticorrupción, Carlos Jiménez Villarejo»

    /** ¿Está la posición i dentro de una acotación entre paréntesis? */
    const RX_ACOTACION_RAYA = /^[ \t]*[—–-][ \t]*(?:(?:el|la|los|las|se|o|a|os|as)[ \t]+)?(?:asume|asumen|reasume|reasumen|ocupa|ocupan|deja|dejan|abandona|ingresa|ingresan|retira|retiran|retira|hablan|habla|aplausos|murmullos|risas|rumores|suena|suenan|pausa|continúa|continua|reanuda|interviene|intervienen|votan|vota|manifestaciones|protestas|assume|reassume|aplausos|risos|vozes|pausa)\b/i;
    const enAcotacion = (texto, i) => {
      const a = texto.lastIndexOf('(', i);
      if (a >= 0 && texto.lastIndexOf(')', i) < a) { const c = texto.indexOf(')', i); if (c > 0 && c - a < 600) return true; }
      const ini = texto.lastIndexOf('\n', i) + 1;
      return RX_ACOTACION_RAYA.test(texto.slice(ini, Math.min(texto.length, ini + 80)));
    };
    /** ¿Está la posición i en una lista de asistencia o de votación nominal («Asisten los señores Representantes: …»)? */
    // años del párrafo del cargo: si hay al menos tres, todos anteriores al mandato de quien ocupa el cargo, se habla de otra época
    // («en las audiencias sobre la Italo», 1985, sobre la negociación de 1978)
    const anosDeOtraEpoca = (texto, i, j) => {
      if (!j) return false;
      const a0 = texto.lastIndexOf('\n\n', i), b0 = texto.indexOf('\n\n', i), par = texto.slice(a0 < 0 ? 0 : a0, b0 < 0 ? texto.length : b0);
      const a = [...par.matchAll(/(?<!\d)(19[3-9]\d|20[0-4]\d)(?!\d)/g)].map((y) => Number(y[1])), desde = Number(j.desde.slice(0, 4));
      return a.length >= 3 && a.every((y) => y < desde - 1);
    };
    /** ¿Está la posición dentro de una cita larga entre comillas angulares (un documento que se lee)? */
    const enDocumento = (texto, i) => { const a = texto.lastIndexOf('«', i), b = texto.lastIndexOf('»', i); if (a < 0 || b > a) return false; const c = texto.indexOf('»', i); return (c < 0 ? texto.length : c) - a > 300; };
    const despuesDelCierre = (texto, i) => { const c = texto.search(/se levanta la sesi[oó]n|se levantó la sesión|encerra(?:da|-se) a sess[aã]o/i); return c >= 0 && i > c && texto.length - c < 3000; };
    const enAsistencia = (texto, i) => { const a = texto.lastIndexOf('\n', i - 1) + 1; return /^\s*(?:asisten|asistieron|asistencia|faltan|faltaron|con licencia|ausentes|presentes|concurren|concurrieron|comparecem|compareceram|faltaram|votaron|votos? (?:a favor|en contra)|votaram)\b/i.test(texto.slice(a, a + 60)); };
    /** La oración que contiene la posición i. */
    const oracionDe = (texto, i) => { const a = Math.max(texto.lastIndexOf('.', i - 1), texto.lastIndexOf('\n', i - 1)); const b = texto.slice(i).search(/[.\n]/); return texto.slice(a + 1, b < 0 ? texto.length : i + b); };
    /** Fórmula de la Mesa («tiene la palabra el diputado…», «en sustitución de…») en la oración, antes de la mención. */
    const esProcedimiento = (texto, i) => { const v = texto.slice(Math.max(0, i - 60), i); return C.procedimiento.test(v.slice(v.search(/[^.;!?\n]*$/)).replace(/\s+/g, ' ')); };
    const ctxDe = (texto, i, largo) => texto.slice(Math.max(0, i - 70), i + largo + 50).replace(/\s+/g, ' ');
    const tipoDeCadena = (ws) => (ws.some((w) => EXTERNO.has(w)) ? 'externo' : ws.some((w) => MIEMBRO.has(w)) ? 'miembro'
      : ws.some((w) => GOBIERNO.has(w)) ? 'gobierno' : ws.some((w) => DESCRIPTIVO.has(w)) ? 'descriptivo' : 'tratamiento');
    const palabrasDe = (cadena) => cadena.trim().split(/[ \t]+/).map((w) => plegar(w).replace(/\.$/, ''));

    // Jefes de Estado (y de Gobierno) con mandato: claves de apellido → persona, por fecha
    const mandatos = (lista, tipo) => lista.map(([claves, nombre, desde, hasta]) => ({ claves: claves.split('|').map((k) => sinParticulas(tokens(k))), nombre, desde, hasta: hasta || '9999', tipo }));
    const JEFES = mandatos(C.jefes || [], 'jefe'), JEFES_GOB = mandatos(C.jefesGobierno || [], 'gobierno');
    const HISTORICOS = (C.historicos || []).map(([k, nombre]) => ({ clave: sinParticulas(tokens(k)), nombre }));
    const terminaEn = (M, k) => k.length <= M.length && k.every((t, i) => M[M.length - k.length + i] === t);
    /** El jefe de Estado o de Gobierno al que se refiere «presidente X» en esa fecha (o, con «ex», uno anterior). */
    const ALIAS = Object.entries(C.alias || {}).map(([k, v]) => [sinParticulas(tokens(k)), v]);
    const tokensJefe = (j) => j.toks || (j.toks = sinParticulas(tokens(j.nombre)).concat(j.claves.flat()));
    function jefeDe(M, fecha, ex, lista) {
      for (const [k, v] of ALIAS) if (subsecuencia(k, M)) M = [v];
      const ok = lista.filter((j) => j.claves.some((k) => (terminaEn(M, k) && M.slice(0, M.length - k.length).every((t) => tokensJefe(j).includes(t)))
        || (k.length === 1 && M.length === 1 && M[0] === k[0])));
      // en los sistemas presidenciales el expresidente sigue siendo «Presidente X» (Bolsonaro en 2023); en España y Portugal, no
      const comun = (j) => j.claves.every((k) => k.length === 1 && (COMUNES.has(k[0]) || TOP10.has(k[0]))) && M.length === 1;   // «presidente García» en 2015
      const vig = ok.filter((j) => (ex ? j.hasta <= fecha : j.desde <= fecha && (fecha < j.hasta || (!C.parlamentario && lista === JEFES && !comun(j)))));
      return vig.length ? vig[vig.length - 1] : null;
    }
    const quienEnFecha = (lista, fecha) => lista.find((j) => j.desde <= fecha && fecha < j.hasta) || null;

    // ---------------------------------------------------------------------------------------------------------------------------
    // Personas con un cargo externo en la biblioteca (el nombre completo de un orador tras «senador», «gobernador»…): son personas
    // externas aunque hayan sido miembros; dos veces si tienen actividad con partido en alguna legislatura de la biblioteca.
    const legsBiblioteca = new Set(filas.map((f) => String(f.legislature)));
    const vecesExterno = new Map();
    for (const f of filas) for (const x of String(f.text || '').matchAll(RX_CADENA)) {
      const ws = palabrasDe(x[1]);
      if (!ws.some((w) => EXTERNO.has(w))) continue;
      let M = sinParticulas(tokens(x[2])); const ie = M.indexOf('e'); if (ie > 0) M = M.slice(0, ie);
      if (M.length < 2) continue;
      const c = candidatos(M).filter((y) => y.s === 3);
      if (c.length === 1) vecesExterno.set(c[0].d.id, (vecesExterno.get(c[0].d.id) || 0) + 1);
    }
    const externos = new Set([...vecesExterno].filter(([id, n]) => {
      const d = dep.get(id), activo = [...legsBiblioteca].some((l) => (d.legs.get(l) || {}).partido);
      const muyActivo = [...legsBiblioteca].some((l) => (d.legs.get(l) || { n: 0 }).n >= 200);
      return !muyActivo && (n >= 2 || !activo);
    }).map(([id]) => id));
    const exigePartido = !!C.escanoConPartido && conPartidoPais;           // Brasil: en las sesiones conjuntas hablan senadores sin partido
    // quien interviene sobre todo como miembro del Gobierno no tiene escaño en esa legislatura: en los sistemas presidenciales y en Portugal
    // (el diputado que entra en el Gobierno suspende el mandato); en España los ministros suelen ser diputados
    const deGobiernoSinEscano = (L) => (!!C.gobiernoSinEscano || !C.parlamentario) && L.gob >= 0.8 * L.n;
    // Legislaturas por fechas (de la primera intervención de cada una a la de la siguiente), para cruzarlas con los mandatos
    const finLeg = new Map([...ordenLeg].map(([l, k]) => [l, ([...ordenLeg].find(([, j]) => j === k + 1) || [])[0]]).map(([l, sig]) => [l, sig ? inicioLeg.get(sig) : '9999']));
    const jefeDeOrador = new Map();   // orador → mandatos de jefe de Estado de esa misma persona (nombre completo de la tabla)
    for (const d of deps) {
      // la misma persona: el nombre de la tabla encaja con el suyo y tiene actividad en la legislatura en que empezó el mandato, en la
      // anterior o en la siguiente (Balcázar, Jerí, Sagasti); no el hijo homónimo de un expresidente (Lacalle Pou y «Luis Alberto Lacalle»)
      const legDeFecha = (fch) => [...inicioLeg].filter(([, ini]) => ini <= fch).sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0];
      const activo = (fch) => { const l = legDeFecha(fch); if (!l) return false; const k = ordenLeg.get(l);
        return [...d.legs].some(([l2, x]) => x.n > 0 && (l2 === l || Math.abs((ordenLeg.get(l2) ?? -9) - k) === 1)); };   // también la siguiente: el traspaso (Rodríguez Echeverría, 2002)
      const js = JEFES.filter((j) => { const t = sinParticulas(tokens(j.nombre)); return t.length >= 2 && t[0] === d.pila[0] && subsecuencia(t, d.toks) && activo(j.desde); });
      if (js.length) jefeDeOrador.set(d.id, js);
    }
    const enMandatoLeg = (d, leg) => (jefeDeOrador.get(d.id) || []).some((j) => j.desde < (finLeg.get(leg) || '9999') && (inicioLeg.get(leg) || '0000') < j.hasta);
    // Decisión del usuario (19-9-2026): el jefe de Estado que fue diputado es su nodo externo desde el inicio de su mandato; antes, su
    // nodo de miembro. Con la fecha de la mención en curso (fechaMencion); sin ella (cálculos previos), por legislatura.
    let fechaMencion = null;
    const desdeMandato = (d, leg) => fechaMencion ? (jefeDeOrador.get(d.id) || []).some((j) => j.desde <= fechaMencion) : enMandatoLeg(d, leg);
    const senta = (d, leg) => {
      const L = d.legs.get(leg);
      if (L && L.n > 0 && jefeDeOrador.has(d.id) && (desdeMandato(d, leg) || !L.partido)) return false;   // jefe de Estado desde su mandato, o sin partido
      if (L && L.n > 0) return (!exigePartido || L.partido) && !deGobiernoSinEscano(L);
      if (externos.has(d.id) || C.reeleccionConsecutiva === false) return false;
      // sin intervenciones en esa legislatura, pero con ellas en la anterior y en la siguiente: miembro que no tomó la palabra
      const k = ordenLeg.get(leg); if (k == null) return false;
      let antes = false, despues = false;
      for (const [l, x] of d.legs) { const j = ordenLeg.get(l); if (j == null || !(x.n > 0) || (exigePartido && !x.partido)) continue; if (j === k - 1) antes = true; if (j === k + 1) despues = true; }
      return antes && despues;
    };

    /** El jefe de Gobierno j como orador (nombre completo de la tabla; entre homónimos, el que interviene como miembro del Gobierno en
     *  esa legislatura: «Primeiro-Ministro António Costa» no es el diputado António José Lima Costa): { d, sentado } si tiene o tuvo
     *  escaño en la biblioteca; si no, null (persona externa). */
    function jefeGobiernoComoMiembro(j, leg) {
      const M = sinParticulas(tokens(j.nombre));
      const todos = candidatos(M).filter((c) => c.d.pila[0] === M[0]);
      const g = todos.filter((c) => ((c.d.legs.get(leg) || {}).gob || 0) > 0).map((c) => c.d);   // «José Sócrates» (Carvalho Pinto de Sousa)
      const cs = todos.filter((c) => c.s === 3).map((c) => c.d);
      const d = g.length === 1 ? g[0] : cs.length === 1 ? cs[0] : null;
      if (!d) return null;
      const sentado = senta(d, leg);
      return sentado || escanoEnBiblioteca(d, leg) === 'antes' ? { d, sentado } : null;
    }
    /** ¿Tuvo escaño en alguna legislatura de la biblioteca? Entonces es un solo nodo de miembro, también cuando se le menciona sin él. */
    const tuvoEscano = (d) => [...legsBiblioteca].some((l) => senta(d, l));
    /** Escaño en la biblioteca respecto de la legislatura de la mención: 'antes' (en ella o en una anterior), 'despues' o null. Solo el
     *  escaño anterior hace de alguien un antiguo miembro: «el periodista Preve» en 2021 no es Federico Preve, diputado desde 2025. */
    function escanoEnBiblioteca(d, leg) {
      const k = ordenLeg.get(leg);
      let antes = false, despues = false;
      for (const l of legsBiblioteca) if (senta(d, l)) { const j = ordenLeg.get(l); if (k == null || j == null || j <= k) antes = true; else despues = true; }
      return antes ? 'antes' : despues ? 'despues' : null;
    }
    /** Entre varios miembros con escaño: si se dirige a él, quien habla en la sesión o la preside; si no, quien preside sesiones de la
     *  biblioteca o el mucho más activo en la legislatura (de quien se habla puede no estar en la sesión). */
    function desempatar(cs, f, voc) {
      const s = f.id_session;
      if (voc) {
        const a = cs.filter((d) => hablaEn.has(s) && hablaEn.get(s).has(d.id)); if (a.length === 1) return { d: a[0], por: 'sesión' };
        const b = cs.filter((d) => presideEn.has(s) && presideEn.get(s).has(d.id)); if (b.length === 1) return { d: b[0], por: 'preside la sesión' };
      }
      const leg = String(f.legislature);
      const g = cs.filter((d) => (d.legs.get(leg) || {}).gob > 0); if (g.length === 1) return { d: g[0], por: 'gobierno' };   // del Gobierno se habla más
      const c = cs.filter((d) => presidentes.has(d.id)); if (c.length === 1) return { d: c[0], por: 'preside' };
      const act = (d) => (d.legs.get(leg) || { n: 0 }).n;
      const o = [...cs].sort((x, y) => act(y) - act(x));
      if (o.length > 1 && act(o[0]) >= 5 * Math.max(1, act(o[1]))) return { d: o[0], por: 'actividad' };
      return null;
    }
    const MILITAR = conjunto(['general', 'coronel', 'comandante', 'capitán', 'capitan', 'teniente', 'almirante', 'sargento', 'brigadier',
      'comodoro', 'mariscal', 'marechal', 'brigadeiro', 'tenente', 'capitão', 'capitao', 'cabo', 'suboficial', 'contraalmirante', 'vicealmirante']);
    const MASC = conjunto(['señor', 'sr', 'don', 'diputado', 'doctor', 'dr', 'licenciado', 'ingeniero', 'arquitecto', 'abogado', 'contador',
      'escribano', 'maestro', 'profesor', 'compañero', 'amigo', 'hermano', 'querido', 'estimado', 'ciudadano', 'presidente', 'ministro',
      'vicepresidente', 'senyor', 'deputado', 'senhor', 'doutor', 'professor', 'engenheiro', 'companheiro', 'caro', 'secretario', 'relator',
      'legislador', 'senador', 'gobernador', 'alcalde', 'exministro', 'expresidente', 'exdiputado', 'ex-ministro', 'ex-deputado', 'ex-presidente',
      'empresario', 'escritor', 'filósofo', 'historiador', 'obispo', 'arzobispo', 'dictador', 'candidato', 'comisionado', 'embajador', 'juez', 'magistrado',
      'fiscal', 'rey', 'príncipe', 'monseñor', 'pastor', 'jornalista', 'empresário', 'juiz', 'rei', 'bispo', 'poeta', 'general', 'coronel', 'comandante']);
    const FEM = conjunto(['señora', 'sra', 'señorita', 'srta', 'doña', 'diputada', 'doctora', 'dra', 'licenciada', 'ingeniera', 'arquitecta',
      'abogada', 'contadora', 'escribana', 'maestra', 'profesora', 'compañera', 'amiga', 'hermana', 'querida', 'estimada', 'ciudadana',
      'presidenta', 'ministra', 'vicepresidenta', 'senyora', 'deputada', 'senhora', 'sr.ª', 'srª', 'dona', 'doutora', 'professora',
      'engenheira', 'companheira', 'cara', 'secretaria', 'relatora', 'legisladora', 'senadora', 'gobernadora', 'alcaldesa', 'exministra',
      'expresidenta', 'exdiputada', 'ex-ministra', 'ex-deputada', 'ex-presidenta', 'empresaria', 'escritora', 'filósofa', 'historiadora',
      'dictadora', 'candidata', 'comisionada', 'embajadora', 'jueza', 'magistrada', 'reina', 'princesa', 'infanta', 'empresária', 'juíza', 'rainha', 'poetisa']);
    const EPICENOS = conjunto(['presidente', 'fiscal', 'juez', 'poeta', 'general', 'coronel', 'comandante', 'jornalista', 'periodista',
      'dirigente', 'representante', 'congresista', 'asambleísta', 'colega', 'líder', 'lider', 'portavoz', 'ponente', 'titular']);
    /** Género que marca la cadena de formas (o el artículo de delante): { g: 'M' | 'F', estricto } o null. Con una forma que tiene
     *  femenino («doctora», «diputada», «Sr.ª») el sexo descarta candidatos; con el artículo o una forma epicena, solo orienta. */
    function generoDe(ws, previo) {
      const m = ws.some((w) => MASC.has(w) && !EPICENOS.has(w)), fm = ws.some((w) => FEM.has(w));
      if (m !== fm) return { g: m ? 'M' : 'F', estricto: true };
      const a = /\b(el|al|del|o|ao|do|pelo)$/i.test(previo) ? 'M' : /\b(la|da|pela|à)$/i.test(previo) ? 'F' : null;
      return a ? { g: a, estricto: false } : null;
    }
    /** ¿Nombra la intervención a otra persona con ese nombre de pila y un apellido que no es del candidato? («Rodolfo Méndez Mata»,
     *  el ministro, frente al diputado Rodolfo Delgado: «don Rodolfo» es el ministro) */
    function otroConEseNombre(t, f, d) {
      const texto = String(f.text || '').normalize('NFD').replace(/\p{Mn}/gu, '');
      const rx = new RegExp(`(?<![\\p{L}])[${t[0]}${t[0].toUpperCase()}]${t.slice(1)}[ \\t]+(\\p{Lu}[\\p{L}'’\\-]+)`, 'gu');
      for (const x of texto.matchAll(rx)) { const w = plegar(x[1]).replace(/[^a-z]/g, ''); if (w && !d.toks.includes(w) && !esForma(w)) return true; }
      return false;
    }
    /** Resolución de un nombre en la legislatura de la fila: miembro con escaño, persona de otra legislatura, ambigua o sin resolver.
     *  `genero`: { g, estricto } (generoDe). `deMiembro`: la cadena lleva una forma de miembro («Sr. Deputado», «diputada»): si un
     *  miembro con escaño encaja en cualquier nivel, es él antes que un homónimo sin escaño con el nombre más completo. */
    function resolver(M, f, genero, voc, deMiembro) {
      let cs = candidatos(M);
      if (genero && genero.g) { const g = cs.filter((c) => !c.d.sexo || c.d.sexo === genero.g); if (g.length || genero.estricto) cs = g; }
      if (!cs.length) return { estado: 'sin resolver' };
      const leg = String(f.legislature), s = f.id_session;
      // un nombre de pila solo («doctor Miguel», «don Rodolfo», «General Leônidas»): solo quien está en esa sesión y si se le habla
      if (M.length <= 3 && M.every((t) => esPila(t)) && cs.every((c) => c.s === 1)) {
        const aqui = cs.map((c) => c.d).filter((d) => senta(d, leg) && ((hablaEn.get(s) || new Set()).has(d.id) || (presideEn.get(s) || new Set()).has(d.id)));
        if (aqui.length === 1 && !otroConEseNombre(M[0], f, aqui[0])) return { estado: 'resuelta', d: aqui[0], sentado: true, por: 'sesión', s: 1 };
        return { estado: 'ambigua', candidatos: cs.slice(0, 4).map((c) => c.d.nombre), ids: cs.map((c) => c.d.id), dePila: true };
      }
      if (deMiembro) {
        const sent = cs.filter((c) => c.s >= 2 && senta(c.d, leg));
        if (sent.length) {
          const top = Math.max(...sent.map((c) => c.s)), mejores = sent.filter((c) => c.s === top).map((c) => c.d);
          if (mejores.length === 1) return { estado: 'resuelta', d: mejores[0], sentado: true, por: 'nombre', s: top };
          const g = desempatar(mejores, f, voc);
          return g ? { estado: 'resuelta', d: g.d, sentado: true, por: g.por, s: top } : { estado: 'ambigua', candidatos: mejores.slice(0, 4).map((d) => d.nombre), ids: mejores.map((d) => d.id) };
        }
      }
      for (const minimo of [3, 2, 1]) {
        if (minimo === 1 && M.length >= 2) break;
        const nivel = cs.filter((c) => c.s >= minimo).map((c) => c.d);
        if (!nivel.length) continue;
        const sentados = nivel.filter((d) => senta(d, leg));
        if (sentados.length === 1) return { estado: 'resuelta', d: sentados[0], sentado: true, por: 'nombre', s: minimo };
        if (sentados.length > 1) {
          const g = desempatar(sentados, f, voc);
          return g ? { estado: 'resuelta', d: g.d, sentado: true, por: g.por, s: minimo } : { estado: 'ambigua', candidatos: sentados.slice(0, 4).map((d) => d.nombre), ids: sentados.map((d) => d.id) };
        }
        if (minimo === 3 && !nivel.some((d) => escanoEnBiblioteca(d, leg) === 'antes')) {   // «Patricio Pazmiño»: el homónimo no fue miembro
          const s2 = cs.filter((c) => c.s === 2 && senta(c.d, leg)).map((c) => c.d);
          if (s2.length === 1) return { estado: 'resuelta', d: s2[0], sentado: true, por: 'nombre', s: 2 };
        }
        if (minimo >= 2 && nivel.length === 1) return { estado: 'resuelta', d: nivel[0], sentado: false, por: 'otra legislatura', s: minimo };
        if (minimo >= 2 && nivel.length > 1) return { estado: 'ambigua', candidatos: nivel.slice(0, 4).map((d) => d.nombre), fuera: true, cands: nivel };
      }
      return { estado: 'sin resolver' };
    }

    // ---------------------------------------------------------------------------------------------------------------------------
    const menciones = [], cont = { presidencia: 0, procedimiento: 0, propia: 0, subnacional: 0, acotacion: 0, cargo_sin_nombre: {}, a_la_presidencia: 0 };
    const ext = new Map(), usoApellido = new Map();
    const nueva = (f, m) => Object.assign(m, { id: f.id, sesion: f.id_session, date: f.date, fuente: f.id_dep, fuenteNombre: f.rep_name, fuentePartido: f.party });
    const bonito = (s) => String(s).toLowerCase().replace(/(^|[\s\-])\p{L}/gu, (x) => x.toUpperCase()).replace(/\b(De|Del|La|Las|Los|Da|Do|Dos|Das|Y|E|Van|Von|Di)\b/g, (x) => x.toLowerCase());
    const enMayusculas = (s) => { const l = String(s).replace(/[^\p{L}]/gu, ''); return l.length > 1 && l === l.toUpperCase(); };
    function externa(f, texto, i, largo, cargo, clave, mostrar, extra) {
      if (enAcotacion(texto, i)) { cont.acotacion++; return; }
      { const h = new Set(sinParticulas(tokens(`${f.speaker || ''} ${f.rep_name || ''}`))), k = String(clave || '').split(' ').filter(Boolean);
        if (k.length && k.every((t) => h.has(t)) && !k.every((t) => esForma(t))) { cont.propia++; return; } }   // habla de sí mismo
      if (esProcedimiento(texto, i)) { cont.procedimiento++; return; }
      { const w = String(mostrar || '').trim().split(/\s+/), k = w.findIndex((x, q) => q > 0 && NO_PERSONA.has(plegar(x).replace(/[^a-z]/g, ''))); if (k > 0) { let e = k; while (e > 1 && PARTICULAS.has(plegar(w[e - 1]))) e--; mostrar = w.slice(0, e).join(' '); } }
      const e = ext.get(clave) || { mostrar, n: 0, cargos: {} }; e.n++;
      if (mostrar && e.mostrar && enMayusculas(e.mostrar) && !enMayusculas(mostrar)) e.mostrar = mostrar;   // «ROBERTO INTROINI» → «Roberto Introini»
      if (!soloEvidencia) e.nf = (e.nf || 0) + 1;
      if (cargo) e.cargos[cargo] = (e.cargos[cargo] || 0) + 1;
      ext.set(clave, e);
      menciones.push(nueva(f, Object.assign({ tipo: 'externa', texto: texto.substr(i, largo), ctx: ctxDe(texto, i, largo), cargo, clave, i, largo }, extra, soloEvidencia ? { mesa: true } : null)));
    }
    function vocativoDe(texto, i, fin) {
      const previo = texto.slice(Math.max(0, i - 30), i).trimEnd();
      const despues = texto.slice(fin, fin + 2);
      return (previo === '' || /[,;:(—–!?.¡¿]$/.test(previo) || /\b(gracias|obrigad[oa]|pues|mire|oiga|escuche|veja|olhe)$/i.test(previo)) && !C.articulo.test(previo) && /^\s*[,.;!?:—–)]|^\s*$/.test(despues);
    }
    function miembro(f, texto, i, largo, r, cargo, extra) {
      if (enAcotacion(texto, i)) { cont.acotacion++; return; }
      if (esProcedimiento(texto, i)) { cont.procedimiento++; return; }
      if (r.estado === 'resuelta' && r.d.id === f.id_dep) { cont.propia++; return; }
      const vocativo = !enAposicion && vocativoDe(texto, i, i + largo);
      const alaPresidencia = vocativo && r.estado === 'resuelta' && presideEn.has(f.id_session) && presideEn.get(f.id_session).has(r.d.id);
      menciones.push(nueva(f, Object.assign({ tipo: 'diputado', texto: texto.substr(i, largo), ctx: ctxDe(texto, i, largo), cargo, vocativo, alaPresidencia, i, largo }, r, extra, soloEvidencia ? { mesa: true } : null)));
    }
    /** Una cadena de formas + nombre ya separada: decide si es miembro, persona externa o nada. */
    function clasificar(f, texto, i, largo, ws, M, crudo) {
      const fecha = String(f.date || '');
      const tipo = tipoDeCadena(ws), cargo = ws.join(' ');
      const ex = ws.some((w) => /^ex-?/.test(w) && w.length > 3);
      const leg = String(f.legislature);
      // jefes de Estado (y de Gobierno donde no suelen tener escaño) por fecha
      if (ws.some((w) => /^(ex-?)?president[ea]$|^rey$|^rei$|^reina$|^dictador[a]?$|^mandatari[oa]$/.test(w) || MILITAR.has(w))) {
        const j = jefeDe(M, fecha, ex, JEFES);
        const enMandato = j && j.desde <= fecha && fecha < j.hasta;
        const presidePropio = !!j && !enMandato && candidatos(M).some((c) => c.s >= 2 && senta(c.d, leg) && presidentes.has(c.d.id));   // «presidente Menem» en 2024: Martín preside la Cámara
        if (j && (enMandato || (!presidePropio && !(M.length > 1 && candidatos(M).some((c) => c.s === 3 && senta(c.d, leg)))))) {
          externa(f, texto, i, largo, cargo, sinParticulas(tokens(j.nombre)).join(' '), j.nombre); return;
        }
      }
      // el nombre completo de un jefe de Estado, con cualquier forma («el gobierno del doctor Leonel Fernández»), desde su primer mandato
      if (M.length >= 2) {
        const jn = JEFES.filter((j) => j.desde <= fecha && terminaEn(sinParticulas(tokens(j.nombre)), M) && sinParticulas(tokens(j.nombre))[0] === M[0]).pop();
        if (jn && !candidatos(M).some((c) => c.s === 3 && c.d.pila[0] === M[0] && senta(c.d, leg))) {
          externa(f, texto, i, largo, cargo, sinParticulas(tokens(jn.nombre)).join(' '), jn.nombre); return;
        }
      }
      if (JEFES_GOB.length && ws.some((w) => /^(ex-?)?president[ea]$|^primeiro-ministro$|^primeira-ministra$/.test(w))) {
        const j = jefeDe(M, fecha, ex, JEFES_GOB);
        if (j) {
          const jm = jefeGobiernoComoMiembro(j, leg);
          if (jm) { miembro(f, texto, i, largo, { estado: 'resuelta', d: jm.d, sentado: jm.sentado, por: 'jefe de Gobierno' }, cargo, jm.sentado ? undefined : { antiguo: true }); return; }
          externa(f, texto, i, largo, cargo, sinParticulas(tokens(j.nombre)).join(' '), j.nombre); return;
        }
      }
      const hist = HISTORICOS.find((x) => terminaEn(M, x.clave) && M.length <= x.clave.length + 1);
      if (hist && (tipo === 'externo' || tipo === 'descriptivo')) {      // «president Companys», «general Franco»: la figura histórica
        externa(f, texto, i, largo, cargo, sinParticulas(tokens(hist.nombre)).join(' '), hist.nombre); return;
      }
      if (tipo === 'externo' && ws.some((w) => /^(senador[a]?|gobernador[a]?|governador[a]?|prefeit[oa]|alcalde(?:sa)?|intendent[ea])$/.test(w))) {   // «senador Espina», «Governador Garotinho»
        const r0 = resolver(M, f, generoDe(ws, ''), false, false);
        if (r0.estado === 'resuelta') {
          const unico = M.length === 1 && M[0] === apRef(r0.d) && !COMUNES.has(M[0]) && !TOP10.has(M[0]) && (porToken.get(M[0]) || []).filter((x) => apRef(x) === M[0]).length === 1;
          const esc = r0.sentado ? 'hoy' : escanoEnBiblioteca(r0.d, leg);
          if (esc === 'hoy' && r0.s === 3) { miembro(f, texto, i, largo, r0, cargo); return; }
          if (esc === 'antes' && (r0.s === 3 || unico)) { miembro(f, texto, i, largo, r0, cargo, { antiguo: true }); return; }
          if (esc === 'despues' && r0.s === 3) { miembro(f, texto, i, largo, r0, cargo, { futuro: true }); return; }
        }
      }
      if (tipo === 'externo') {                                          // cargo que no ocupa un miembro en ejercicio
        // la lista de oradores solo con el nombre completo («Senador Rodrigo Pacheco»); si no, el nombre tal como se escribe
        // («Senador Eduardo Braga» no es el diputado Luiz Eduardo … Braga)
        const c = candidatos(M).filter((x) => x.s === 3 && (M.length === x.d.toks.length || M[0] === x.d.pila[0]));
        const h = HISTORICOS.find((x) => terminaEn(M, x.clave));
        if (c.length === 1) externa(f, texto, i, largo, cargo, c[0].d.toks.join(' '), bonito(c[0].d.nombre.includes(',') ? `${c[0].d.nombre.split(',')[1]} ${c[0].d.nombre.split(',')[0]}` : c[0].d.nombre));
        else if (h) externa(f, texto, i, largo, cargo, sinParticulas(tokens(h.nombre)).join(' '), h.nombre);
        else externa(f, texto, i, largo, cargo, M.join(' '), crudo);
        return;
      }
      const deGobierno = !C.parlamentario && !ws.some((w) => MIEMBRO.has(w)) && ws.some((w) => /^(ministro|ministra|canciller|viceministro|viceministra|secretario|secretaria|secretário|secretária|subsecretario|subsecretaria)$/.test(w));
      if (deGobierno && !candidatos(M).some((c) => c.s === 3 && senta(c.d, leg))) {   // «Ministro Haddad» es Fernando, no el diputado Miguel Haddad
        if (M.length === 1 && esPila(M[0]) && !deps.some((x) => apRef(x) === M[0])) return;          // «Ministra Balbina»: solo el nombre de pila
        const h2 = HISTORICOS.find((x) => terminaEn(M, x.clave));
        if (!h2) {                                                       // exdiputado que ahora es ministro: su nodo de miembro
          const r0 = resolver(M, f, null, false, false);
          if (r0.estado === 'resuelta' && !r0.sentado && r0.s >= 2 && (M.length >= 2 || !COMUNES.has(M[0])) && escanoEnBiblioteca(r0.d, leg) === 'antes') {
            miembro(f, texto, i, largo, r0, cargo, { antiguo: true }); return;
          }
        }
        externa(f, texto, i, largo, cargo, h2 ? sinParticulas(tokens(h2.nombre)).join(' ') : M.join(' '), h2 ? h2.nombre : crudo); return;
      }
      if (M.length === 1 && esPila(M[0]) && /^(don|doña|dona|dom)$/.test(ws[ws.length - 1])) {
        const lista = /(\p{Lu}[\p{L}'’\-]+(?:[ \t]+(?:(?:de|del)[ \t]+(?:la[ \t]+)?)?\p{Lu}[\p{L}'’\-]+)?)[ \t]*,[ \t]*$/u.exec(texto.slice(Math.max(0, i - 40), i));
        if (lista && !esForma(plegar(lista[1].split(/\s+/)[0]))) M = [M[0], ...sinParticulas(tokens(lista[1]))];   // «Vargas, don Alfonso»
      }
      const deMiembro = ws.some((w) => MIEMBRO.has(w)), militar = ws.some((w) => MILITAR.has(w));
      const genero = sinGenero ? null : generoDe(ws, texto.slice(Math.max(0, i - 12), i).trimEnd()), voc = vocativoDe(texto, i, i + largo);
      let r = resolver(M, f, genero, voc, deMiembro);
      // apellido de casada («Salgado de Paredes», «Aguirre de Falconí»): sin él, si así se encuentra a alguien
      if (r.estado === 'sin resolver' && M.length >= 2 && genero && genero.g === 'F') {   // solo mujeres: «Martínez de Hoz» no se parte
        const m = /^(.*\S)[ \t]+de[ \t]+\p{Lu}[\p{L}'’\-]+$/u.exec(String(crudo || '').trim());
        if (m) { const M2 = sinParticulas(tokens(m[1])); if (M2.length) { const r2 = resolver(M2, f, genero, voc, deMiembro); if (r2.estado === 'resuelta' && r2.d.sexo !== 'M') { r = r2; M = M2; } } }
      }
      if (militar && M.length <= 3 && !deMiembro && !(r.estado === 'resuelta' && r.d && ws.some((w) => MILITAR.has(w) && r.d.toks.includes(w)))) {   // «almirante Castro», «brigadier Gómez», «Brigadeiro Eduardo Gomes»
        if (M.length === 1 && (LUGARES.has(M[0]) || (esPila(M[0]) && !deps.some((x) => apRef(x) === M[0])))) return;
        const h0 = HISTORICOS.find((x) => terminaEn(M, x.clave));
        externa(f, texto, i, largo, cargo, h0 ? sinParticulas(tokens(h0.nombre)).join(' ') : M.join(' '), h0 ? h0.nombre : crudo); return;
      }
      if (r.estado === 'resuelta' && r.sentado) {
        if (M.length === 1 && M[0] === apRef(r.d)) usoApellido.set(r.d.id, (usoApellido.get(r.d.id) || 0) + 1);
        miembro(f, texto, i, largo, r, cargo); return;
      }
      if (r.estado === 'ambigua' && !r.fuera) { miembro(f, texto, i, largo, r, cargo); return; }
      if (r.estado === 'ambigua' && r.fuera && ws.some((w) => GOBIERNO.has(w))) {   // «el ministro de Presidencia, Bolaños»: quien está en el Gobierno
        const g = r.cands.filter((d) => ((d.legs.get(leg) || {}).gob || 0) > 0);
        if (g.length === 1) {
          const d = g[0];
          if (escanoEnBiblioteca(d, leg) === 'antes') { miembro(f, texto, i, largo, { estado: 'resuelta', d, sentado: false, por: 'gobierno' }, cargo, { antiguo: true }); return; }
          const visible = d.nombre.includes(',') ? `${d.nombre.split(',')[1]} ${d.nombre.split(',')[0]}` : d.nombre;
          externa(f, texto, i, largo, cargo, d.toks.join(' '), bonito(visible.trim()), { antiguo: true }); return;
        }
      }
      if (r.estado === 'ambigua' && r.fuera) {                          // varios sin escaño ese día: el que lo tuvo antes en la biblioteca
        const t = r.cands.filter((d) => escanoEnBiblioteca(d, leg) === 'antes'), o = [...t].sort((a, b) => b.n - a.n);
        const d = t.length === 1 ? t[0] : o.length > 1 && o[0].n >= 5 * Math.max(1, o[1].n) ? o[0] : null;
        if (d) { miembro(f, texto, i, largo, { estado: 'resuelta', d, sentado: false, por: 'tuvo escaño' }, cargo, { antiguo: true }); return; }
        if (!t.length && !(M.length === 1 && esPila(M[0]))) externa(f, texto, i, largo, cargo, M.join(' '), crudo);   // ninguno lo tenía aún: otra persona
        return;
      }

      if (r.estado === 'resuelta' && hist && M.length === 1) { externa(f, texto, i, largo, cargo, sinParticulas(tokens(hist.nombre)).join(' '), hist.nombre); return; }
      if (r.estado === 'resuelta' && ws.some((w) => /^president[ea]$/.test(w)) && !presidentes.has(r.d.id) && M.length === 1) {
        externa(f, texto, i, largo, cargo, M.join(' '), crudo); return;
      }
      if (r.estado === 'resuelta') {
        const esc = escanoEnBiblioteca(r.d, leg);
        // «el señor Aznar» en 2010: el mismo nodo que cuando tenía escaño. Con un apellido solo, si la forma es de miembro, si el país
        // se trata de «señor» en el pleno (España, Portugal) o si el apellido es de un solo orador y no es común
        const distintivo = M.length >= 2 || deMiembro || C.parlamentario || (!COMUNES.has(M[0]) && !TOP10.has(M[0]) && (porToken.get(M[0]) || []).filter((x) => apRef(x) === M[0]).length === 1);
        const reciente = ((r.d.legs.get(leg) || {}).gob || 0) > 0 || !r.d.hasta || Number(fecha.slice(0, 4)) - Number(String(r.d.hasta).slice(0, 4)) <= 8;
        if (esc === 'antes' && M.length === 1 && ws.some((w) => GOBIERNO.has(w) && !/^president[ea]$/.test(w)) && !reciente) { externa(f, texto, i, largo, cargo, M.join(' '), crudo); return; }
        if (esc === 'antes' && distintivo) { miembro(f, texto, i, largo, r, cargo, { antiguo: true }); return; }
        if (esc === 'despues' && r.s === 3) { miembro(f, texto, i, largo, r, cargo, { futuro: true }); return; }   // el mismo, antes de tener escaño
        const cerca = (x) => x.desde && x.hasta && fecha >= `${Number(x.desde.slice(0, 4)) - 4}` && fecha <= `${Number(x.hasta.slice(0, 4)) + 5}`;
        if (esc === null && (r.s === 3 || (r.s >= 2 && cerca(r.d)))) {    // orador sin escaño en la biblioteca: persona externa con su nombre
          const d = r.d, visible = d.nombre.includes(',') ? `${d.nombre.split(',')[1]} ${d.nombre.split(',')[0]}` : d.nombre;
          externa(f, texto, i, largo, cargo, d.toks.join(' '), bonito(visible.trim()), { antiguo: true }); return;
        }
        if (M.length === 1 && esPila(M[0])) return;                      // nombre de pila solo
        externa(f, texto, i, largo, cargo, M.join(' '), crudo); return;  // otra persona con ese nombre (homónimo de otra época)
      }
      if (tipo === 'miembro') { miembro(f, texto, i, largo, r, cargo); return; }   // «diputado X» sin resolver: queda fuera
      // no es de ningún orador: persona externa si parece un nombre de persona
      if (M.length === 1 && /^(don|dona|dom|doña)$/.test(ws[ws.length - 1])) return;       // «doña Anselma», «don Manuel»: nombre de pila
      if (M.length === 1 && ((pilaCuenta.get(M[0]) || 0) >= 1 && !COMUNES.has(M[0]) && !(porToken.get(M[0]) || []).some((d) => d.ap.includes(M[0])) || LUGARES.has(M[0]))) return;   // nombre de pila solo o lugar
      const h = HISTORICOS.find((x) => terminaEn(M, x.clave));
      if (h) externa(f, texto, i, largo, cargo, sinParticulas(tokens(h.nombre)).join(' '), h.nombre);
      else externa(f, texto, i, largo, cargo, M.join(' '), crudo);
    }

    // Sustantivos de institución o de lugar delante de una forma o de un apellido: la mención es del lugar o de la institución
    // («Hospital Regional Dr. Antonio Musa», «Fundação Getúlio Vargas», «la provincia Duarte»). Los de lugar admiten «de/del» en medio
    // («centro de salud Dr. X»); los que también se usan con personas («casa», «plan») solo pegados a la forma («Casa Rey Prendes»).
    const INST_LUGAR = ['centro', 'museo', 'museu', 'hospital', 'clínica', 'clinica', 'universidad', 'universidade', 'fundación', 'fundacion',
      'fundação', 'fundacao', 'premio', 'premios', 'prêmio', 'prémio', 'colegio', 'colégio', 'instituto', 'aeropuerto', 'aeroporto',
      'parque', 'avenida', 'avda', 'av', 'calle', 'calles', 'rua', 'plaza', 'plazoleta', 'praça', 'praca', 'puerto', 'muelle', 'estadio',
      'estádio', 'teatro', 'biblioteca', 'escuela', 'escola', 'liceo', 'liceu', 'palacio', 'palácio', 'cuartel', 'quartel', 'buque',
      'provincia', 'província', 'autopista', 'carretera', 'rodovia', 'club', 'clube', 'barrio', 'bairro', 'ensanche', 'distrito',
      'municipio', 'município', 'residencial', 'monumento', 'puente', 'ponte', 'cementerio', 'cemitério', 'cantón', 'canton', 'parroquia',
      'oratorio', 'asociación', 'asociacion', 'associação', 'escuadrón', 'batallón', 'regimiento', 'brigada', 'fragata', 'corbeta',
      'refinería', 'refineria', 'represa', 'hidroeléctrica', 'termoeléctrica', 'auditorio', 'medalla', 'condecoración', 'cátedra', 'catedra'];
    const INST_PEGADO = ['casa', 'sala', 'salón', 'edificio', 'hotel', 'complejo', 'orden', 'beca', 'festival', 'copa', 'torneo', 'nuestra',
      'villa', 'vila', 'comuna', 'localidad', 'ciudad', 'cidade', 'sector', 'largo', 'base', 'central', 'obra', 'plan', 'programa', 'ley', 'lei'];
    const alternativa = (xs, soloMayuscula) => xs.map((w) => `[${soloMayuscula ? '' : w[0]}${w[0].toUpperCase()}]${escapar(w.slice(1))}`).join('|');
    const ADJ_INST = '(?:[ \\t]+(?:[Rr]egional|[Nn]acional|[Mm]unicipal|[Pp]rovincial|[Dd]epartamental|[Dd]istrital|[Gg]eneral|[Cc]entral|[Ss]ecund[aá]ria|'
      + '[Ss]uperior|[Ii]nternacional|[Ff]ederal|[Ee]statal|[Pp][uú]blic[oa]|[Ll]ocal|[Cc]omunal|[Mm]etropolitan[oa]|[Mm]ilitar|[Nn]aval|[Dd]ocente|[Uu]niversitari[oa]))?';
    const INSTITUCION_ANTES = new RegExp(`(?:^|[^\\p{L}])(?:(?:${alternativa(INST_LUGAR)})\\.?(?:[ \\t]+(?:del?|da|do|dos|das))?${ADJ_INST}`
      + `|(?:${alternativa(INST_PEGADO, true)})${ADJ_INST})[ \\t]+$`, 'u');
    const INST_LARGO = new RegExp(`(?:^|[^\\p{L}])(?:${alternativa(INST_LUGAR)})(?:[ \\t]+(?:\\p{Lu}[\\p{L}]+|y|e|de|del|da|do|dos|das)){1,7}[ \\t]+$`, 'u');
    // formas que también son adjetivos o nombres: dentro de un nombre propio con mayúscula no introducen a una persona
    const AMBIGUAS = conjunto(['general', 'fiscal', 'ciudadano', 'ciudadana', 'central', 'nacional', 'mayor', 'superior', 'primero', 'maestro', 'maestra']);
    // palabras que son forma o nombre de pila según el caso: «Líder Góngora», «Luís Nobre Guedes»
    const NOMBRE_O_FORMA = conjunto(['lider', 'líder', 'nobre', 'caro', 'cara', 'justo', 'amado', 'santo']);
    // intervenciones escritas casi enteras en mayúsculas (transcripciones antiguas): ahí las mayúsculas no delatan un rótulo
    const mayusculaTodo = new Map(filas.map((f) => { const l = String(f.text || '').replace(/[^\p{L}]/gu, ''); return [f.id, l.length > 0 && l.replace(/[^\p{Lu}]/gu, '').length >= 0.6 * l.length]; }));

    let enAposicion = false;
    let soloEvidencia = false;
    let sinGenero = false;
    let enLista = false;         // la forma está en plural: «Montes y Hales» son dos personas       // lista tras un plural masculino («los diputados María Pérez y Juan García»): el género no descarta   // turno de la Mesa: la mención no cuenta, pero es prueba de cómo se nombra a cada uno   // la mención viene de «cargo de Institución, Nombre» (RX_INST): una aposición, no un vocativo

    // Palabras partidas en los textos escaneados: guion de fin de línea («Rodri- guez») y espacio en medio de un apellido de la lista
    // de oradores («Rodrí guez Zapatero»: se une si junto es un apellido y la primera parte sola no lo es)
    const TOKS_NOMBRE = new Set(deps.flatMap((d) => d.toks));
    for (const f of filas) f.text = String(f.text || '').replace(/(\p{L})-[ \t]*\r?\n[ \t]*(\p{Ll})/gu, '$1$2').replace(/(\p{Ll})- (\p{Ll})/gu, '$1$2')
      .replace(/(\p{Lu}\p{L}+)[ \t]+(\p{Ll}{2,})(?![\p{L}])/gu, (m, a, b) => (TOKS_NOMBRE.has(plegar(a + b)) && !TOKS_NOMBRE.has(plegar(a)) ? a + b : m));
    let nFila = 0;
    for (const f of filas) {
      if ((++nFila & 31) === 0) { await ceder(); progreso('menciones', nFila / filas.length); }
      const texto = f.text || '';
      const pres = esPresidencia(f);
      soloEvidencia = pres; fechaMencion = String(f.date || '').slice(0, 10) || null;
      const vistos = new Set();
      const procesar = (i, largo, cadena, nombreCrudo) => {
        if (pres) cont.presidencia++;
        const antesF = texto.slice(Math.max(0, i - 50), i);
        if (INSTITUCION_ANTES.test(antesF) || INST_LARGO.test(texto.slice(Math.max(0, i - 80), i))) return;   // «centro Reina Sofía», «Hospital Regional Dr. Antonio Musa»
        let ws = palabrasDe(cadena);
        { const w0 = cadena.trim().split(/[ \t]+/)[0], pw = /(?:^|[^\p{L}])(\p{Lu}[\p{L}]+)[ \t]+$/u.exec(antesF);
          // «Ley General Tributaria», «Secretaría General», «Seguridad Ciudadana», «Reforma Fiscal»: la forma es parte de un nombre propio
          if (pw && /^\p{Lu}/u.test(w0) && AMBIGUAS.has(plegar(w0).replace(/\.$/, '')) && !esForma(plegar(pw[1]))) return;
          // «en Coronel Oviedo», «de General San Martín», «em Coronel Freitas»: un grado sin artículo tras preposición es un lugar
          if (/^\p{Lu}/u.test(w0) && (MILITAR.has(ws[0]) || /^president[ea]$/.test(ws[0])) && /(?:^|[^\p{L}])(?:en|de|para|desde|hasta|hacia|em|até|ate)[ \t]+$/iu.test(antesF)) return; }
        { const tras = texto.slice(i + largo, i + largo + 30);
          if (/^[ \t]*(?:(?:[.…·][ \t]*){3,}\d+|(?:[.…·][ \t]*){6,})/.test(tras)) return;   // entrada del sumario («Exposición del señor Representante Testoni……… 160»); no «Coissoró...»
          if (/^\s*(?:(?:voto|votamos|voy a votar|votaré)\s+)?por\s+(?:el|la|los|las)?\s*$/i.test(texto.slice(0, i))) return;   // el voto en una elección («Por el señor Diputado Abelenda»)
          if (/^[ \t]*,?[ \t]*\(r[uú]brica\)/i.test(tras) || /^[ \t]*vota(?:[ \t]+(?:s[ií]|no)\b|[ \t]*[.,])/i.test(tras) || /(?:^|\n)[ \t]*(?:[Pp]alabras|[Ii]ntervenci[oó]n)[ \t]+del?[ \t]+$/.test(texto.slice(Math.max(0, i - 40), i))) return;
          if (/^[ \t]*,?[ \t]*en sustituci[oó]n\b/i.test(tras) || /^[ \t]*(?:&|y[ \t]+[Aa]sociados\b)/.test(tras) || /^[ \t]*:[ \t]*\d{1,3}(?!\d)[ \t]*(?:\n|$|\p{Lu}{2,})/u.test(tras)) return;
          if (despuesDelCierre(texto, i)) return;                         // firmas del acta tras «Se levanta la sesión»
          if (/^[ \t]*[,:;]?[ \t]*\(?(?:presente|ausente|excusad[oa]|con licencia|licencia|a favor|en contra|abstenci[oó]n|sim|n[aã]o|votou|vot[oó])[ \t]*(?:[,.;:)\n]|$)/i.test(tras) || /^[ \t]*por[ \t]*:/i.test(tras)) return; }
        { const ini = texto.lastIndexOf('\n', i) + 1, fin = texto.indexOf('\n', i + largo), linea = texto.slice(ini, fin < 0 ? texto.length : fin);
          const letras = linea.replace(/[^\p{L}]/gu, '');
          if (letras.length >= 20 && letras.replace(/[^\p{Lu}]/gu, '').length >= 0.85 * letras.length && !mayusculaTodo.get(f.id)) return; }   // rótulos en mayúsculas
        // artículo de un género y forma del otro: nombre de una institución («el Reina Sofía» es el museo; «la Rey Juan Carlos», la universidad)
        { const art = texto.slice(Math.max(0, i - 6), i).trim().toLowerCase(), g = sinGenero ? null : (generoDe(ws, '') || {}).g;
          if ((g === 'F' && /\b(el|del|al)$/.test(art)) || (g === 'M' && /\b(la)$/.test(art) && C.lengua === 'es')) return; }
        let nombre = nombreCrudo.trim().split(/[ \t]+/);
        // formas escritas con mayúscula dentro del nombre («señor Presidente del Gobierno», «Deputado Federal X») pasan a la cadena
        while (nombre.length && (esForma(plegar(nombre[0]).replace(/\.$/, '')) || esPlural(nombre[0])) && !(NOMBRE_O_FORMA.has(plegar(nombre[0])) && nombre.length > 1)) ws.push(plegar(nombre.shift()).replace(/\.$/, ''));
        while (nombre.length && /^(federal|nacional|ad|hoc|interin[oa]|encargad[oa])$/.test(plegar(nombre[0]))) nombre.shift();
        { const q = nombre.findIndex((w, j) => j > 0 && enMayusculas(nombre[j - 1]) && nombre[j - 1].replace(/[^\p{L}]/gu, '').length > 1 && !enMayusculas(w) && !PARTICULAS.has(plegar(w)));
          if (q > 0) nombre = nombre.slice(0, q); }
        if (!nombre.length || /^(san|santa|santo|sao|santisima|santisimo)$/.test(plegar(nombre[0]))) return;
        if (enAsistencia(texto, i)) return;
        if (nombre.length && PARTICULAS.has(plegar(nombre[0]))) { const k = ws.join(' '); cont.cargo_sin_nombre[k] = (cont.cargo_sin_nombre[k] || 0) + 1; return; }
        { const q = nombre.findIndex((w, j) => j > 0 && esForma(plegar(w).replace(/\.$/, '')) && !NOMBRE_O_FORMA.has(plegar(w))); if (q > 0) nombre = nombre.slice(0, q); }
        if (nombre.length && C.subnacional.test(plegar(nombre[0]))) { cont.subnacional++; return; }
        // dos personas unidas por «y/e/i» («Companys y Francesc Boix»): se corta si detrás viene un nombre de pila; «Carrasco i
        // Formiguera» o «Álvarez de Miranda y Torres» son un solo apellido compuesto
        const tn = tokens(nombre.join(' '));
        const juntos = enLista && candidatos(sinParticulas(tn)).some((c) => c.s >= 2);
        const iy = tn.findIndex((t, q) => q > 0 && /^(y|e|i)$/.test(t) && q + 1 < tn.length && ((enLista && !juntos) || esPila(tn[q + 1]) || sinParticulas(tn.slice(q + 1)).length >= 2));
        let M = sinParticulas(iy > 0 ? tn.slice(0, iy) : tn);
        if (M.length > 1 && (NO_PERSONA.has(M[0]) || casiForma(M[0]))) {   // «fiscal Anticorrupción Carlos Jiménez Villarejo»: solo si sigue un nombre
          let q = 0; while (q < M.length && (NO_PERSONA.has(M[q]) || casiForma(M[q]) || LUGARES.has(M[q]))) q++;
          if (q < M.length && (esPila(M[q]) || candidatos(M.slice(q)).some((c) => c.s >= 2))) M = M.slice(q); else { const k = ws.join(' '); cont.cargo_sin_nombre[k] = (cont.cargo_sin_nombre[k] || 0) + 1; return; }
        }
        // un lugar corta el nombre solo tras partícula («Juan Carlos I de España»); «Senador Eduardo Braga» o «Lima» son apellidos
        { const crudoT = tokens(nombre.join(' ')); const q = crudoT.findIndex((t, j) => j > 0 && PARTICULAS.has(crudoT[j - 1]) && LUGARES.has(t) && !COMUNES.has(t));
          const deJefe = [...JEFES, ...JEFES_GOB].some((j) => j.claves.some((k) => terminaEn(M, k) && k.length > 0 && LUGARES.has(k[k.length - 1])));
          if (q > 0 && !deJefe) { const antes = sinParticulas(crudoT.slice(0, q)); if (antes.length) M = M.slice(0, antes.length); } }
        if (M.length && C.fecha && C.fecha.test(M[M.length - 1]) && /^[ \t]+de[ \t]+\d/.test(texto.slice(i + largo, i + largo + 12))) M = M.slice(0, -1);
        const corte = M.findIndex((t) => NO_PERSONA.has(t) || casiForma(t));
        if (corte === 0 || !M.length) { const k = ws.join(' '); cont.cargo_sin_nombre[k] = (cont.cargo_sin_nombre[k] || 0) + 1; return; }
        if (corte > 0) M = M.slice(0, corte);
        if (M.length === 1 && M[0].length <= 2) return;
        if (ws.some((w) => MIEMBRO.has(w)) && nombre.length && C.subnacional.test(plegar(nombre[nombre.length - 1]))) { cont.subnacional++; return; }
        // nombres de pila solos que no son de nadie, o dos personas unidas por «y»: la primera aquí; la segunda, con la misma forma
        const ie = M.indexOf('e'); if (ie > 0) M = M.slice(0, ie);
        // la mención de la primera acaba antes de «y»; la segunda empieza tras «y»
        const qy = nombre.findIndex((w, q) => q > 0 && /^(y|e|i)$/.test(plegar(w)) && q + 1 < nombre.length && ((enLista && !juntos) || esPila(plegar(nombre[q + 1]).replace(/[^a-z]/g, '')) || sinParticulas(tokens(nombre.slice(q + 1).join(' '))).length >= 2));
        let segunda = null, largo1 = largo;
        if (qy > 0) {
          const cola = nombre.slice(qy + 1), rx = new RegExp(`[ \\t]+${escapar(nombre[qy])}[ \\t]+(${cola.map(escapar).join('[ \\t]+')})(?![\\p{L}])`, 'u');
          const x = rx.exec(texto.slice(i, i + largo + 5));
          if (x && x.index > 0) { largo1 = x.index; segunda = [i + x.index + x[0].length - x[1].length, x[1]]; }
        }
        clasificar(f, texto, i, largo1, ws, M, nombre.slice(0, qy > 0 ? qy : nombre.length).join(' '));
        if (segunda) { const [a, t] = segunda, b = a + t.length; if (libre(a, b) || hechos.some(([x, y]) => x === i && y === i + largo)) { hechos.push([a, b]); procesar(a, t.length, cadena, t); } }
      };
      const hechos = [], libre = (a, b) => !hechos.some(([x, y]) => a < y && b > x);
      const generico = (cadena) => cadena.trim().split(/[ \t]+/).some((w) => { const k = plegar(w).replace(/\.$/, ''); return PLURALES.has(k) && MASC.has(PLURALES.get(k)); });
      const lista = (cadena, desde) => {                               // «los congresistas A, B, C y D»: B, C y D con la forma en singular
        sinGenero = generico(cadena); enLista = true;
        for (const [a, t] of siguientesDeLista(texto, desde)) { const b = a + t.length; if (!libre(a, b)) break; hechos.push([a, b]); procesar(a, t.length, singular(cadena), t); }
        sinGenero = false; enLista = false;
      };
      for (const x of texto.matchAll(RX_CADENA)) {
        vistos.add(x.index + x[0].length); hechos.push([x.index, x.index + x[0].length]);
        const plural = esPlural(x[1].trim().split(/[ \t]+/).pop());
        enLista = plural; procesar(x.index, x[0].length, x[1], x[2]); enLista = false;
        if (plural && !soloFormas(x[2])) lista(x[1], x.index + x[0].length);
      }
      for (const x of texto.matchAll(RX_PLURAL)) {                       // «los diputados Abel Beker, Kayra Harding y otros»
        const a = x.index + x[0].length - x[2].length, b = x.index + x[0].length;
        if (!libre(a, b) || soloFormas(x[2])) continue;                 // «Sras. e Srs. Deputados, …»: no hay nombre
        hechos.push([a, b]); vistos.add(b); sinGenero = generico(x[1]); enLista = true; procesar(a, x[2].length, singular(x[1]), x[2]); sinGenero = false; enLista = false;
        lista(x[1], b);
      }
      enAposicion = true;
      for (const x of texto.matchAll(RX_INST)) {                         // «el presidente del Gobierno, Pedro Sánchez»
        const i = x.index + x[0].length - x[2].length;
        if (vistos.has(x.index + x[0].length) || !libre(i, i + x[2].length)) continue;
        { const t = sinParticulas(tokens(x[2])); if (!t.length || !(esPila(t[0]) || candidatos(t).some((c) => c.s >= 2) || (t.length >= 2 && !t.some((w) => NO_PERSONA.has(w) || LUGARES.has(w))))) continue; }   // «Comisión de Comunicaciones, Infraestructura y Vivienda»
        hechos.push([i, i + x[2].length]); procesar(i, x[2].length, x[1], x[2]);
      }
      enAposicion = false;

      // cargos sin nombre atribuidos por fecha («el presidente del Gobierno» → quien lo era ese día)
      const j0 = (tabla, f) => quienEnFecha(tabla === 'jefesGobierno' ? JEFES_GOB : JEFES, String(f.date || ''));
      if (!pres) for (const [rx, tabla] of C.cargosSinNombre) for (const x of texto.matchAll(new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g'))) {
        const tras = texto.slice(x.index + x[0].length, x.index + x[0].length + 60), antes = texto.slice(Math.max(0, x.index - 30), x.index);
        if (/(?:Esposa|Secretar[ií]a|Oficina|Despacho|Casa|Residencia|Guardia|Estado Mayor|Gabinete)\s*$/u.test(antes)) continue;   // nombre de una institución: «Secretaría de Obras Sociales de la Esposa del Presidente»; no «un asesor del Presidente»
        if (RX_APOSICION.test(tras)) continue;          // con nombre: ya contada («…, la señora de Perón», «…, doctor Óscar Arias Sánchez»)
        if (/iniciativa\s+$/i.test(antes) && /^\s*,?\s*por\s+medio\s+del?\b/i.test(tras)) continue;   // fórmula del decreto
        if (despuesDelCierre(texto, x.index)) continue;
        if (/(?:^|[^\p{L}])(?:ex|futuro|futura|próximo|nuevo|antiguo|anterior|entonces|então|antigo|novo|primer|era|fue|foi|siendo|sido|fuera|último|primeros?|un|una|um|uma|ningún|cualquier|qualquer|todo|adjunto|adjunta|assessor|assessora|gabinete|vice)\s+(?:(?:también|ya|el|la|o|a|un|una)\s+)?$/iu.test(antes)) continue;
        // uso genérico del cargo: «de la época», «el presidente de la República podrá…» (texto de una ley)
        if (/^\s*,?\s*(?:de\s+(?:la\s+|aquella\s+|esa\s+)?(?:época|entonces|turno)|(?:en|de)\s+(?:ese|aquel)\s+(?:entonces|momento|tiempo)|en\s+(?:esa|aquella)\s+época|de\s+aquel|anterior|saliente|entrante|electo|eleito)\b/iu.test(tras)) continue;
        if (/^\s*,?\s*(?:podrá|deberá|puede|debe|tendrá|tiene\s+la\s+facultad|está\s+facultado|estará|será|es\s+el|es\s+quien|nombrará|designará|dictará|enviará|remitirá|convocará|sancionará|promulgará|podrán|deberán|poderá|deverá|pode|deve|terá|nomeará)(?![\p{L}])/iu.test(tras)) continue;
        if (/(?:art[ií]culos?|arts?\.)\s*\d/i.test(texto.slice(Math.max(0, x.index - 300), x.index)) || /(?:^|[^\p{L}])(?:ser|llegar a ser|elegir|elija|elegido|nombrar)\s+(?:el\s+)?$/iu.test(antes)) continue;   // norma o cargo en abstracto
        const j = quienEnFecha(tabla === 'jefesGobierno' ? JEFES_GOB : JEFES, String(f.date || ''));
        if (!j) continue;
        { const desde = Number(j.desde.slice(0, 4)), hasta = j.hasta === '9999' ? 9999 : Number(j.hasta.slice(0, 4));   // «en 1976 el presidente de la Nación…»
          const a = Math.max(texto.lastIndexOf('.', x.index - 1), texto.lastIndexOf('\n', x.index - 1), x.index - 120) + 1;
          const b0 = texto.slice(x.index).search(/[.\n]/), b = Math.min(b0 < 0 ? texto.length : x.index + b0, x.index + x[0].length + 60);
          if ([...texto.slice(a, b).matchAll(/(?<!\d)(19[3-9]\d|20[0-4]\d)(?!\d)/g)].some((y) => Number(y[1]) < desde - 1 || Number(y[1]) > hasta)) continue; }   // «las elecciones de 2002» sí
        const M = sinParticulas(tokens(j.nombre));
        const jm = tabla === 'jefesGobierno' ? jefeGobiernoComoMiembro(j, String(f.legislature)) : null;   // el jefe de Estado es siempre su nodo externo
        if (jm) miembro(f, texto, x.index, x[0].length, { estado: 'resuelta', d: jm.d, sentado: jm.sentado, por: 'jefe de Gobierno' }, x[0].trim(), { sinNombre: true, antiguo: !jm.sentado });
        else externa(f, texto, x.index, x[0].length, x[0].trim(), M.join(' '), j.nombre, { sinNombre: true });
      }
    }

    soloEvidencia = false; fechaMencion = null;

    // Ambiguas: si un candidato tiene en la legislatura (o, si no, en la biblioteca) al menos 5 menciones resueltas y 5 veces más que
    // cualquier otro, es él. Ojo: la evidencia favorece al menos conocido, al que se nombra con los dos apellidos para distinguirlo;
    // por eso va después del cargo en el Gobierno y de la actividad.
    const evidencia = new Map(), legDe = new Map(filas.map((f) => [f.id, String(f.legislature)]));
    const sumar = (k) => evidencia.set(k, (evidencia.get(k) || 0) + 1);
    for (const m of menciones) if (m.tipo === 'diputado' && m.estado === 'resuelta' && m.por !== 'evidencia') { sumar(m.d.id); sumar(`${m.d.id}|${legDe.get(m.id)}`); }
    let porEvidencia = 0;
    for (const m of menciones) {
      if (m.tipo !== 'diputado' || m.estado !== 'ambigua' || !m.ids || m.dePila) continue;   // un nombre de pila solo no se resuelve por evidencia
      const enLeg = m.ids.map((id) => [id, evidencia.get(`${id}|${legDe.get(m.id)}`) || 0]).sort((a, b) => b[1] - a[1]);
      const o = enLeg[0][1] > 0 ? enLeg : m.ids.map((id) => [id, evidencia.get(id) || 0]).sort((a, b) => b[1] - a[1]);
      if (o[0][1] >= 5 && o[0][1] >= 5 * Math.max(1, o[1] ? o[1][1] : 0)) {
        const d = dep.get(o[0][0]);
        if (d.id === m.fuente) { m.estado = 'descartada'; continue; }
        Object.assign(m, { estado: 'resuelta', d, sentado: true, por: 'evidencia' });
        m.alaPresidencia = m.vocativo && presideEn.has(m.sesion) && presideEn.get(m.sesion).has(d.id);
        porEvidencia++;
      }
    }

    // ---------------------------------------------------------------------------------------------------------------------------
    // Personas externas: dos claves son la misma persona si la corta es el principio de la larga («jose maria aznar» y «jose maria aznar
    // lopez»; nunca «felipe gonzalez marquez» y «felipe vi», ni «francisco franco» y «francisco moreno franco»); una clave de una palabra va con la de varias que la
    // contiene si es solo una o la más citada con tres veces más menciones que las otras
    const subsec = (a, b) => { let j = 0; for (const t of b) if (t === a[j]) j++; return j === a.length; };
    const CANONICAS = new Set([...JEFES, ...JEFES_GOB].map((j) => sinParticulas(tokens(j.nombre)).join(' ')).concat(HISTORICOS.map((h) => sinParticulas(tokens(h.nombre)).join(' '))));
    const canon = new Map(), claves = [...ext.keys()].sort((a, b) => b.split(' ').length - a.split(' ').length || ext.get(b).n - ext.get(a).n);
    const nDe = (g) => g.reduce((s, k) => s + ext.get(k).n, 0);
    // apellido de referencia de una clave: en castellano, el primero tras los nombres de pila («gonzalez davila», no «davila»); en
    // portugués o con nombre parlamentario, el último
    const refDe = (L) => {
      const t = L.split(' '); if (C.lengua === 'pt' || C.nombreParlamentario) return t[t.length - 1];
      let q = 0; while (q < t.length - 1 && esPila(t[q])) q++;
      return q + 1 < t.length && (TOP10.has(t[q]) || COMUNES.has(t[q])) && !COMUNES.has(t[q + 1]) ? t[q + 1] : t[q];   // «Pérez de los Cobos», «López Jerez»
    };
    for (const k of claves) {
      const t = k.split(' ');
      if (t.length === 1) continue;
      for (const [a, v] of ALIAS) if (subsec(a, t) && CANONICAS.has(sinParticulas(tokens((JEFES.find((j) => j.claves.some((c) => c.join(' ') === v)) || { nombre: '' }).nombre)).join(' '))) { canon.set(k, { persona: sinParticulas(tokens(JEFES.find((j) => j.claves.some((c) => c.join(' ') === v)).nombre)).join(' '), apellido: v }); }
      if (canon.has(k)) continue;
      const canonica = [...CANONICAS].find((c) => c !== k && c.split(' ').every((x, q) => t[q] === x) && c.split(' ').length < t.length);   // «juan carlos espana» → «juan carlos»
      let padre = CANONICAS.has(k) ? null : canonica && ext.has(canonica) ? canonica : claves.find((L) => L !== k && !CANONICAS.has(k) && L.split(' ').length > t.length && canon.has(L) && canon.get(L).persona === L && t.every((x, q) => L.split(' ')[q] === x));   // «lluis companys» ⊂ «lluis companys jover»; no «francisco franco» ⊂ «francisco moreno franco»
      if (!padre && !CANONICAS.has(k)) {
        const c = [...CANONICAS].find((x) => { const ct = x.split(' '); return ct.length >= 2 && ct[0] === t[0] && subsec(ct, t); });
        if (c) { if (!ext.has(c)) ext.set(c, { mostrar: ([...JEFES, ...JEFES_GOB].find((j) => sinParticulas(tokens(j.nombre)).join(' ') === c) || HISTORICOS.find((h) => sinParticulas(tokens(h.nombre)).join(' ') === c) || { nombre: c }).nombre, n: 0, cargos: {} }); padre = c; }
      }
      // «arevalo bermejo» es el final de «juan jose arevalo bermejo»: la misma persona si solo una clave larga termina así
      if (!padre && !CANONICAS.has(k) && !esPila(t[0])) {
        const largas = claves.filter((L) => L !== k && L.split(' ').length > t.length && canon.has(L) && canon.get(L).persona === L && L.endsWith(' ' + k));
        if (largas.length === 1) padre = largas[0];
      }
      canon.set(k, { persona: padre || k, apellido: refDe(k) });
    }
    for (const k of claves) {
      if (k.includes(' ')) continue;
      const personasCon = [...new Set(claves.filter((L) => L.includes(' ') && (refDe(L) === k || (C.lengua === 'pt' && L.split(' ')[0] === k))).map((L) => canon.get(L).persona))];
      const peso = (p) => nDe([...canon].filter(([, c]) => c.persona === p).map(([x]) => x));
      const o = personasCon.map((p) => [p, peso(p)]).sort((a, b) => b[1] - a[1]);
      let persona = (COMUNES.has(k) || TOP10.has(k)) ? k : o.length === 1 || (o.length > 1 && o[0][1] >= 3 * o[1][1]) ? o[0][0] : k;   // «Figueroa» solo no es nadie en concreto
      const cargosK = Object.keys(ext.get(k).cargos);
      if (persona !== k && CANONICAS.has(persona) && cargosK.length && cargosK.every((c) => /ministr|canciller|secretari/.test(c))) persona = k;
      canon.set(k, { persona, apellido: k });
    }
    for (const m of menciones) if (m.tipo === 'externa') m.persona = canon.get(m.clave).persona;
    // un apellido común con cargo que no se ha unido a nadie («doctor Paredes») es la persona de la sesión con ese apellido, si en la
    // sesión solo se nombra a una («Óscar Eladio Paredes Zapata»)
    {
      const enSesion = new Map();
      for (const m of menciones) if (m.tipo === 'externa' && m.persona && m.persona.includes(' ')) { if (!enSesion.has(m.sesion)) enSesion.set(m.sesion, new Set()); enSesion.get(m.sesion).add(m.persona); }
      for (const m of menciones) {
        if (m.tipo !== 'externa' || !m.clave || m.clave.includes(' ') || m.persona !== m.clave || esPila(m.clave)) continue;
        const cs = [...(enSesion.get(m.sesion) || [])].filter((p) => p.split(' ').slice(1).includes(m.clave));
        if (cs.length === 1) m.persona = cs[0];
      }
    }

    // Apellidos sueltos
    const esPresidenciaFila = new Map(filas.map((f) => [f.id, esPresidencia(f)]));
    const textoPlegado = filas.filter((f) => !esPresidenciaFila.get(f.id)).map((f) => f.text || '').join('\n').normalize('NFD').replace(/\p{Mn}/gu, '');
    const mayusculas = (ap) => {
      const rx = new RegExp(`(?<![\\p{L}])(${ap.replace(/[a-z]/g, (ch) => `[${ch}${ch.toUpperCase()}]`)})(?![\\p{L}])`, 'gu');
      let may = 0, min = 0; for (const x of textoPlegado.matchAll(rx)) { if (/^\p{Lu}/u.test(x[1])) may++; else min++; }
      return { may, min };
    };
    const personas = new Map();
    for (const [k, c] of canon) { const p = personas.get(c.persona) || { n: 0, nf: 0, apellido: c.apellido }; p.n += ext.get(k).n; p.nf += ext.get(k).nf || 0; personas.set(c.persona, p); }
    // legislaturas en que cada persona externa aparece con cargo: el apellido suelto de una persona corriente solo se busca en ellas
    const legsDePersona = new Map();
    for (const m of menciones) if (m.tipo === 'externa' && m.persona) { if (!legsDePersona.has(m.persona)) legsDePersona.set(m.persona, new Set()); legsDePersona.get(m.persona).add(legDe.get(m.id)); }
    // de personas externas: con ≥ 5 menciones con cargo; figuras históricas de la lista del país; jefes de Estado, por fecha
    const sueltasExt = new Map();   // apellido (tokens) → { persona, clave, historico?, jefes? }
    for (const [p, { n, nf, apellido }] of personas) {
      if (n < 5 || !nf || apellido.length < 4 || COMUNES.has(apellido) || LUGARES.has(apellido) || esPila(apellido)) continue;
      if (!p.split(' ').includes(apellido)) continue;
      const { may, min } = mayusculas(apellido); if (min > Math.max(1, 0.05 * (may + min))) continue;
      if (!sueltasExt.has(apellido)) sueltasExt.set(apellido, { persona: p, clave: [apellido] });
    }
    const alta = (nombre, apellido) => {
      const persona = sinParticulas(tokens(nombre)).join(' ');
      if (!ext.has(persona)) ext.set(persona, { mostrar: nombre, n: 0, cargos: {} });
      if (!canon.has(persona)) canon.set(persona, { persona, apellido, total: 0 });
      return canon.get(persona).persona;
    };
    for (const h of HISTORICOS) {
      const ap = h.clave.join(' ');
      if (sueltasExt.has(ap)) { Object.assign(sueltasExt.get(ap), { historico: true, toks: sinParticulas(tokens(h.nombre)) }); continue; }
      if (h.clave.some((t) => t.length < 4)) continue;
      const { may, min } = mayusculas(h.clave[h.clave.length - 1]); if (may < 2 || min > 0.1 * (may + min)) continue;
      sueltasExt.set(ap, { persona: alta(h.nombre, h.clave[h.clave.length - 1]), clave: h.clave, historico: true, toks: sinParticulas(tokens(h.nombre)), extra: [] });
    }
    for (const j of JEFES) {
      const clave = j.claves[0], ap = clave.join(' ');
      if (clave.some((t) => t.length < 4) || (clave.length === 1 && COMUNES.has(clave[0]))) continue;
      const { may, min } = mayusculas(clave[clave.length - 1]); if (may < 2 || min > 0.1 * (may + min)) continue;
      const e = sueltasExt.get(ap) || { persona: null, clave, extra: [] };
      const persona = alta(j.nombre, clave[clave.length - 1]);
      if (!e.persona) e.persona = persona;
      e.jefes = (e.jefes || []).concat([{ persona, desde: j.desde, hasta: j.hasta, toks: sinParticulas(tokens(j.nombre)) }]);
      e.extra = (e.extra || []).concat(j.claves.flat());
      sueltasExt.set(ap, e);
    }
    // antiguo miembro nombrado solo por el apellido, cuando en esas legislaturas se nombra con nombre y apellido a otra persona con ese
    // apellido, más citada: «Ministro Haddad» o «Sr. Haddad» en 2023-2025 es Fernando Haddad, no el exdiputado Miguel Haddad; «ministro
    // Caputo» en 2025 es Luis Caputo, no Dante Caputo; «señor Lugo» en 2009 es el presidente Fernando Lugo
    let aExterna = 0;
    for (const m of menciones) {
      if (m.tipo !== 'diputado' || !m.antiguo || m.estado !== 'resuelta' || !m.d || !m.d.pila) continue;
      const t = sinParticulas(tokens(m.texto)).filter((w) => !esForma(w));
      if (t.length !== 1 || esPila(t[0])) continue;                    // «doctor Jorge»: un nombre de pila no es un apellido
      const leg = legDe.get(m.id), k = ordenLeg.get(leg);
      const cs = [...personas].filter(([p, x]) => {
        const pt = p.split(' ');
        return pt.length >= 2 && pt.length <= 5 && pt.slice(1).includes(t[0]) && pt[0] !== m.d.pila[0] && !subsecuencia(pt, m.d.toks) && x.n >= 3
          && [...(legsDePersona.get(p) || [])].some((l) => l === leg || (k != null && Math.abs((ordenLeg.get(l) ?? -9) - k) <= 1));
      }).sort((a, b) => b[1].n - a[1].n);
      if (!cs.length || (cs.length > 1 && cs[0][1].n < 3 * cs[1][1].n)) continue;
      Object.assign(m, { tipo: 'externa', persona: cs[0][0], clave: t[0] }); delete m.d; delete m.estado; delete m.por; delete m.sentado; delete m.antiguo;
      aExterna++;
    }
    // de miembros: la biblioteca ya los llama así con tratamiento al menos tres veces, y el apellido es distintivo
    const apMiembro = new Map();
    const primeros = new Set(deps.filter((d) => [...legsBiblioteca].some((l) => senta(d, l))).map((d) => d.toks[0]));
    const apExternos = new Set([...sueltasExt.keys()]);
    for (const [id, n] of usoApellido) {
      if (n < 3) continue;
      const d = dep.get(id), ap = apRef(d);
      if (ap.length < 4 || COMUNES.has(ap) || LUGARES.has(ap) || primeros.has(ap) || apExternos.has(ap) || apMiembro.has(ap) || esPila(ap)) continue;
      const { may, min } = mayusculas(ap); if (may < 2 || min > Math.max(1, 0.05 * (may + min))) continue;
      apMiembro.set(ap, d);
    }
    const TITULO_ANTES = new RegExp(`(?:${FORMA})[ \\t]+(?:\\p{Lu}[\\p{L}.'’\\-]*[ \\t]+){0,3}$`, 'u');
    // una institución o un lugar delante («Fundação Getúlio Vargas», «la provincia Duarte», «el muelle Juan Pablo Duarte»), un santo
    // («San Juan», «Santa Ana») o una palabra que no abre frase y no es del nombre de la persona («Wagner Soares Padilha», «Calixto
    // Chaves», «Poyleaud de Gandini»): no es la persona
    const INST_SUELTO = new RegExp(INSTITUCION_ANTES.source.replace(/\[ \\t\]\+\$$/, '') + `(?:[ \\t]+(?:[Dd]r\\.?|[Dd]ra\\.?|[Dd]octor|[Dd]octora|[Dd]on|[Dd]oña|[Dd]\\.|[Gg]eneral|[Pp]residente|[Mm]onseñor|[Ss]an|[Ss]anta))?(?:[ \\t]+(?:(?:de|del|de la|da|do)[ \\t]+)?\\p{Lu}[\\p{L}'’\\-]*){0,4}[ \\t]+$`, 'u');
    const SANTO_ANTES = /(?:^|[^\p{L}])(?:San|Santa|Santo|São|Sao|SAN|SANTA|SANTO)[ \t]+(?:\p{Lu}[\p{L}'’\-]*[ \t]+){0,2}$/u;
    const PERMITIDAS = conjunto(['gobierno', 'governo', 'gestion', 'gestao', 'administracion', 'era', 'epoca', 'regimen', 'regime', 'caso', 'seu', 'dona', 'don', 'dom']);
    const VARIANTES_LETRA = { a: 'aáàâã', e: 'eéèê', i: 'iíìî', o: 'oóòôõ', u: 'uúùûü', n: 'nñ', c: 'cç' };
    /** Expresión de una palabra que admite la letra con o sin tilde («Abugattas» encuentra «Abugattás») */
    const conTildes = (w) => [...plegar(w)].map((ch, k) => {
      const orig = w[k] || ch, may = orig === orig.toUpperCase() && orig !== orig.toLowerCase();
      const v = VARIANTES_LETRA[ch]; if (!v) return escapar(may ? ch.toUpperCase() : ch);
      return `[${may ? v.toUpperCase() : v}]`;
    }).join('');
    const suyosCache = new Map();
    function suyosDe(ap, persona) {
      const k = `${ap}|${persona}`;
      if (!suyosCache.has(k)) {
        const s = sueltasExt.get(ap) || {};
        suyosCache.set(k, new Set([...String(ext.get(persona)?.mostrar || '').split(/\s+/).map((w) => plegar(w).replace(/[^a-z]/g, '')),
          ...[...canon].filter(([, c]) => c.persona === persona).flatMap(([x]) => x.split(' ')), ...ALIAS.flatMap(([x]) => x), ...(s.extra || []),
          ...(s.toks || []), ...(s.jefes || []).flatMap((j) => j.toks)]));
      }
      return suyosCache.get(k);
    }
    // tramos ya contados en cada intervención: un apellido suelto dentro de una mención con cargo no se vuelve a contar
    const tramos = new Map();
    for (const m of menciones) if (m.i != null) { if (!tramos.has(m.id)) tramos.set(m.id, []); tramos.get(m.id).push([m.i, m.i + m.largo]); }
    const cuentaSueltas = { externas: {}, miembros: {} };
    nFila = 0;
    for (const f of filas) {
      if ((++nFila & 31) === 0) { await ceder(); progreso('sueltos', nFila / filas.length); }
      if (esPresidenciaFila.get(f.id)) continue;
      const texto = f.text || '', fecha = String(f.date || ''), leg = String(f.legislature);
      fechaMencion = fecha.slice(0, 10) || null;
      if (!tramos.has(f.id)) tramos.set(f.id, []);
      const suyosTramos = tramos.get(f.id);
      const ocupado = (a, b) => suyosTramos.some(([x, y]) => a < y && b > x);
      const probar = (ap, forma, miembroFijo) => {
        const rx = new RegExp(`(?<![\\p{L}\\-’'])${conTildes(forma)}(?![\\p{L}]|-\\p{L})`, 'gu');   // «con Milei-, es deuda»: el guion de inciso vale
        for (const x of texto.matchAll(rx)) {
          const ini = x.index;
          let fin = ini + x[0].length;
          if (ocupado(ini, fin)) continue;
          let alMiembro = miembroFijo;
          const antes = texto.slice(Math.max(0, ini - 60), ini);
          if (TITULO_ANTES.test(antes) || enAcotacion(texto, ini) || INST_SUELTO.test(antes) || INST_LARGO.test(antes) || SANTO_ANTES.test(antes) || enAsistencia(texto, ini)) continue;
          if (/(?:^|[^\p{L}])(?:[Ff]amil[ií]a|[Ff]am[ií]lia|[Cc]lan|[Hh]ermanos|[Ii]rm[aã]os|[Aa]pellido|[Ss]obrenome|[Ll]os|[Oo]s)[ \t]+(?:\p{Lu}[\p{L}'’\-]*[ \t]+)?$/u.test(antes)
            && !/(?:^|[^\p{L}])[Dd]e[ \t]+los[ \t]+$/u.test(antes)) continue;   // «familia Bolsonaro», «de apellido Fanovich»; no «Pérez de los Cobos»
          if (/^[ \t]*[,:;]?[ \t]*\(?(?:presente|ausente|excusad[oa]|con licencia|licencia|a favor|en contra|abstenci[oó]n|s[ií]|no|sim|n[aã]o|votou|vot[oó])[ \t]*(?:[,.;:)\n]|$)/i.test(texto.slice(fin, fin + 30))) continue;   // votación nominal
          if (/^[ \t]*(?:&|y[ \t]+[Aa]sociados\b)/.test(texto.slice(fin, fin + 20)) || despuesDelCierre(texto, ini)) continue;   // «Bendek & Asociados»; firmas del acta
          // persona externa: el jefe de Estado de esa fecha (en el cargo o el último anterior); una persona corriente, solo donde se la
          // nombra con cargo
          const s = alMiembro ? null : sueltasExt.get(ap);
          let persona = s ? s.persona : null, forzar = !!(s && s.historico), jHoy = null;
          if (s && s.jefes) {
            jHoy = s.jefes.filter((j) => j.desde <= fecha).pop() || null;
            if (jHoy) { persona = jHoy.persona; if (fecha < jHoy.hasta || Number(fecha.slice(0, 4)) - Number(String(jHoy.hasta).slice(0, 4)) <= 8) forzar = true; }
          }
          if (s && !s.historico && !jHoy) {
            const L = legsDePersona.get(persona) || new Set(), k = ordenLeg.get(leg);
            if (s.jefes ? !L.size : ![...L].some((l) => l === leg || (k != null && Math.abs((ordenLeg.get(l) ?? -9) - k) <= 1))) continue;
          }
          const propios = alMiembro ? new Set(alMiembro.toks) : suyosDe(ap, persona);
          // seguido de otra palabra con mayúscula que no es de su nombre: es el nombre completo de otra persona («Juan Carlos González Rentero»)
          const sig = /^[ \t]+(?:(?:de|del|da|do|dos|das|i|y|e|van|von)[ \t]+)?(\p{Lu}[\p{L}'’\-]+)/u.exec(texto.slice(fin, fin + 40));
          if (sig) {
            const w2 = plegar(sig[1]).replace(/[^a-z]/g, '');
            if (!propios.has(w2) && !/^(Presidente|Presidenta|Gobierno|Governo|Ministro|Ministra)$/.test(sig[1])) continue;
            if (propios.has(w2)) fin += sig[0].length;                    // «Getúlio Vargas»: una sola mención
          }
          let d = alMiembro, porNombre = false;
          const prev = /(\p{Lu}[\p{L}'’\-]+)[”"»)]?(?:[ \t]+(?:de|del|de la|de los|da|do|dos))?(?:[ \t]*[—–-])?[ \t]+$/u.exec(antes);
          if (prev) {
            // palabra con mayúscula delante que no es de esta persona: un nombre de pila («Eduardo Bolsonaro», «Átila Lira»), un apellido
            // de casada («Poyleaud de Gandini») o, si no abre la frase, parte del nombre de otra persona; «Governo Lula» o el propio nombre
            // («Bernard Appy», «Manuel Azaña») valen
            const w = plegar(prev[1]).replace(/[^a-z]/g, ''), t = sinParticulas(tokens(prev[1] + ' ' + forma)), c = candidatos(t).filter((y) => y.s >= 2);
            const conParticula = /[ \t]+(?:de|del|de la|de los|da|do|dos)[ \t]+$/.test(antes);
            const abreFrase = /(?:^|[.!?:;¿¡—–\n])[ \t"«“(]*$/.test(antes.slice(0, antes.length - prev[0].length));
            const propio = propios.has(w) || (HIPO[w] && propios.has(HIPO[w]));
            const ajena = !propio && !NO_PERSONA.has(w) && (esPila(w) || conParticula || (!abreFrase && !esForma(w) && !PERMITIDAS.has(w)));
            if (alMiembro) {
              const sn = c.filter((y) => senta(y.d, leg));
              if (sn.length === 1) { d = sn[0].d; porNombre = true; } else if (c.length || ajena) continue;
            } else if (c.length && !propio || ajena) continue;
          }
          if (!alMiembro) {                                            // ¿el apellido es de alguien con escaño en esa legislatura?
            const ult = ap.split(' ').pop(), hoy = (porToken.get(ult) || []).filter((y) => y.ap.includes(ult) && senta(y, leg));
            if (hoy.length > 1) continue;
            const pt = String(persona || '').split(' ');
            const mismo = hoy.length === 1 && ((s.jefes || []).some((j) => fecha < j.desde && subsecuencia(j.toks, hoy[0].toks))
              || (s.toks && !s.jefes && subsecuencia(s.toks, hoy[0].toks)) || (!s.jefes && !s.historico && pt.length >= 2 && pt[0] === hoy[0].pila[0] && subsecuencia(pt, hoy[0].toks)));
            if (mismo) { d = hoy[0]; alMiembro = d; }                     // el propio jefe o figura cuando tenía escaño (Mujica en 1999, Cortizo en 2004)
            else if (hoy.length === 1 && forzar) hoy.length = 0;          // jefes de Estado recientes e históricos: ellos («Bolsonaro» es Jair)
            if (!alMiembro && hoy.length === 1) {                        // Feijóo en 2023 es diputado; Franco sigue siendo el dictador
              const deMiembro = usoApellido.get(hoy[0].id) || 0, deExterna = (personas.get(persona) || { n: 0 }).n + (forzar ? 10 : 0);
              if (deMiembro >= 3 && deMiembro >= 3 * deExterna) { d = hoy[0]; alMiembro = d; }
              else if (deExterna < 3 * deMiembro || (!forzar && deExterna === 0)) continue;   // no se sabe cuál
            }
          }
          if (alMiembro) {
            if (!porNombre) {                                             // solo el apellido: el único miembro con escaño que lo lleva ese día
              const conEse = (porToken.get(ap) || []).filter((y) => apRef(y) === ap && senta(y, leg));
              if (conEse.length !== 1) continue;
              d = conEse[0];
            } else if (!senta(d, leg)) continue;
            cuentaSueltas.miembros[ap] = (cuentaSueltas.miembros[ap] || 0) + 1;
            if (!apMiembro.has(ap)) cuentaSueltas.externas['→ miembro ' + ap] = (cuentaSueltas.externas['→ miembro ' + ap] || 0) + 1;
            const antesN = menciones.length;
            miembro(f, texto, ini, fin - ini, { estado: 'resuelta', d, sentado: true, por: 'apellido suelto' }, null, { suelta: true });
            if (menciones.length > antesN) suyosTramos.push([ini, fin]);
          } else {
            cuentaSueltas.externas[ap] = (cuentaSueltas.externas[ap] || 0) + 1;
            if (enAcotacion(texto, ini)) continue;
            menciones.push(nueva(f, { tipo: 'externa', suelta: true, persona, texto: texto.slice(ini, fin), ctx: ctxDe(texto, ini, fin - ini), i: ini, largo: fin - ini }));
            suyosTramos.push([ini, fin]);
          }
        }
      };
      for (const [ap, s] of sueltasExt) {
        const palabras = String(ext.get(s.persona)?.mostrar || s.persona).split(/\s+/), k0 = palabras.findIndex((w) => plegar(w).replace(/[^a-z]/g, '') === s.clave[0]);
        let forma = k0 >= 0 && s.clave.every((t, q) => plegar(palabras[k0 + q] || '').replace(/[^a-z]/g, '') === t) ? palabras.slice(k0, k0 + s.clave.length).join(' ') : bonito(s.clave.join(' '));
        if (enMayusculas(forma)) forma = bonito(forma);                  // «INTROINI» (de un rótulo) → «Introini»
        probar(ap, forma, null);
      }
      for (const [ap, d] of apMiembro) {                               // la palabra del nombre que es su apellido de referencia
        const palabra = d.nombre.split(/[\s,]+/).find((w) => plegar(w).replace(/[^a-z]/g, '') === ap);
        if (palabra) probar(ap, bonito(palabra), d);
      }
    }

    // ---------------------------------------------------------------------------------------------------------------------------

    // ------------------------------------------------------------------------------------------ salida del detector
    const nombresExt = {};
    for (const [k, c] of canon) if (k === c.persona || !nombresExt[c.persona]) nombresExt[c.persona] = (ext.get(c.persona) || ext.get(k)).mostrar;
    for (const m of menciones) if (m.d) m.d = { id: m.d.id, nombre: m.d.nombre, partidos: m.d.partidos };
    const deLaMesa = menciones.filter((m) => m.mesa).length;
    const fuera = menciones.filter((m) => !m.mesa);
    const via = {};
    for (const m of fuera) if (m.tipo === 'diputado' && m.estado === 'resuelta') via[m.por] = (via[m.por] || 0) + 1;
    return { pais: PAIS, menciones: fuera, cont, nombresExt, via, de_la_mesa: deLaMesa, a_externa: aExterna,
      oradores: deps.length, con_partido: conPartidoPais,
      externos_por_cargo: [...externos].map((id) => dep.get(id).nombre),
      apellidos_miembros: Object.fromEntries([...apMiembro].map(([ap, d]) => [ap, d.nombre])),
      apellidos_externos: [...sueltasExt.keys()] };
  }

  // ------------------------------------------------------------------------------------------------ datos de la base
  const trozos = (xs, n) => { const out = []; for (let k = 0; k < xs.length; k += n) out.push(xs.slice(k, k + n)); return out; };

  /** Las intervenciones de la biblioteca con su texto (solo las de discurso: dm_speech = 1). */
  async function filasDeBiblioteca(ctx, bd, ids, prog) {
    const out = [];
    let hecho = 0;
    for (const trozo of trozos(ids, TROZO)) {
      const meta = S.filas(bd, `SELECT id, id_session, ord, date, legislature, speaker, id_dep, rep_name, party, dm_speech, nwords
        FROM speeches WHERE id IN (${trozo.join(',')})`);
      const conTexto = await P.leerFilas(ctx, bd, trozo);
      const texto = new Map(conTexto.map((f) => [Number(f.id), String(f.speech || '')]));
      for (const f of meta) if (Number(f.dm_speech) === 1) out.push(Object.assign({}, f, { text: texto.get(Number(f.id)) || '' }));
      hecho += trozo.length;
      prog('lectura', hecho / Math.max(1, ids.length));
      if (ctx && typeof ctx.ceder === 'function') await ctx.ceder();
    }
    return out.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
  }

  /** Todas las filas de las sesiones que toca la biblioteca, sin texto: sitúan los turnos de la Mesa (quién preside, quién
   *  lee) aunque la biblioteca solo guarde parte de la sesión. Si son demasiadas, se usan solo las de la biblioteca. */
  function contextoDeSesiones(bd, ids, filas) {
    const sesiones = new Set(filas.map((f) => f.id_session).filter(Boolean));
    if (!sesiones.size) return filas;
    const lista = [...sesiones];
    let n = 0;
    for (const t of trozos(lista, 400)) {
      n += S.valor(bd, `SELECT COUNT(*) FROM speeches WHERE id_session IN (${t.map(() => '?').join(',')})`, t) || 0;
      if (n > MAX_CONTEXTO) return filas;
    }
    const texto = new Map(filas.map((f) => [Number(f.id), f.text]));
    const out = [];
    for (const t of trozos(lista, 400)) {
      for (const f of S.filas(bd, `SELECT id, id_session, ord, date, legislature, speaker, id_dep, rep_name, party, dm_speech, nwords
        FROM speeches WHERE id_session IN (${t.map(() => '?').join(',')})`, t)) {
        if (texto.has(Number(f.id))) f.text = texto.get(Number(f.id));
        out.push(f);
      }
    }
    return out.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
  }

  /** Oradores del corpus: nombre, partido, sexo, actividad y fechas por legislatura (como la lista del prototipo). */
  function oradoresDelCorpus(bd) {
    return S.filas(bd, `SELECT id_dep, rep_name, party, legislature, sex, MIN(date) desde, MAX(date) hasta, COUNT(*) n,
      SUM(CASE WHEN upper(speaker) LIKE '%MINISTR%' OR upper(speaker) LIKE '%GOBIERNO%' OR upper(speaker) LIKE '%GOVERNO%' THEN 1 ELSE 0 END) gob
      FROM speeches WHERE id_dep IS NOT NULL AND id_dep <> '' GROUP BY id_dep, rep_name, party, legislature, sex`);
  }

  // ------------------------------------------------------------------------------------------------ progreso
  const FASES = Object.freeze([
    { id: 'lectura', etiqueta: 'Leyendo las intervenciones', peso: 0.3 },
    { id: 'menciones', etiqueta: 'Buscando las menciones', peso: 0.45 },
    { id: 'sueltos', etiqueta: 'Apellidos sueltos', peso: 0.15 },
    { id: 'red', etiqueta: 'Red y focos', peso: 0.1 },
  ]);

  function crearProgreso(ctx, nTextos) {
    const fn = ctx && typeof ctx.progreso === 'function' ? ctx.progreso : null;
    const t0 = Date.now();
    let ultimo = 0;
    return (id, fraccionFase, forzar) => {
      if (!fn) return;
      const t = Date.now();
      if (!forzar && t - ultimo < 120) return;
      ultimo = t;
      const i = Math.max(0, FASES.findIndex((f) => f.id === id));
      let acumulado = 0;
      for (let k = 0; k < i; k++) acumulado += FASES[k].peso;
      try {
        fn({ fase: id, etiqueta: FASES[i].etiqueta, indice: i + 1, n_fases: FASES.length,
          fraccion: acumulado + FASES[i].peso * Math.max(0, Math.min(1, fraccionFase || 0)), ms: Date.now() - t0, n_textos: nTextos });
      } catch (e) { /* el progreso nunca interrumpe el cálculo */ }
    };
  }

  // ------------------------------------------------------------------------------------------------ red de menciones
  const titulo = (s) => String(s || '').toLowerCase().replace(/(^|[\s-])\p{L}/gu, (x) => x.toUpperCase())
    .replace(/(?<=\s)(Da|De|Do|Dos|Das|E|Del|La|Las|Los|Y|I)(?=\s)/g, (x) => x.toLowerCase());
  const enMayusculas = (s) => !!s && s === String(s).toUpperCase();
  const validoPartido = (p) => !!p && !/identific|^\?$/i.test(p);

  /** Red y cuadros a partir de las menciones detectadas (el partido ya es el canónico: lo guarda la ingesta). */
  function armar(det, filas, oradores, o) {
    const menciones = det.menciones, nombresExt = det.nombresExt;
    // Partido y nombre de cada persona con escaño: el más frecuente en la biblioteca; si no habla en ella, el de sus menciones
    const partido = new Map(), nombreDe = new Map();
    const cuenta = (m, k, v) => { if (!m.has(k)) m.set(k, new Map()); m.get(k).set(v, (m.get(k).get(v) || 0) + 1); };
    const masFrecuente = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const enBiblioteca = new Map(), enMenciones = new Map();
    for (const f of filas) if (f.id_dep && validoPartido(f.party)) cuenta(enBiblioteca, f.id_dep, f.party);
    const legDeFila = new Map(filas.map((f) => [f.id, String(f.legislature)]));
    for (const m of menciones) if (m.d && m.d.partidos) { const p = m.d.partidos[legDeFila.get(m.id)]; if (validoPartido(p)) cuenta(enMenciones, m.d.id, p); }
    for (const or of oradores) {
      if (validoPartido(or.party)) partido.set(or.id_dep, or.party);
      if (!nombreDe.has(or.id_dep) && or.rep_name && !/identific/i.test(or.rep_name)) nombreDe.set(or.id_dep, or.rep_name);
    }
    for (const [id, m] of enMenciones) partido.set(id, masFrecuente(m));
    for (const [id, m] of enBiblioteca) partido.set(id, masFrecuente(m));
    for (const [id, n] of nombreDe) if (n.includes(',')) nombreDe.set(id, `${n.split(',').slice(1).join(' ').trim()} ${n.split(',')[0].trim()}`);

    const validas = menciones.filter((m) => m.fuente && !m.alaPresidencia && (m.tipo === 'externa' || m.estado === 'resuelta'));
    const clave = (m) => (m.tipo === 'externa' ? `ext:${m.persona}` : m.d.id);
    const esExt = (k) => k.startsWith('ext:');
    const bonito = (s) => (enMayusculas(s) ? titulo(s) : s);
    const nombre = (k) => (esExt(k) ? (bonito(nombresExt[k.slice(4)]) || titulo(k.slice(4))) : titulo(nombreDe.get(k) || k));
    const partidoFuente = (m) => (validoPartido(m.fuentePartido) ? m.fuentePartido : '?');

    // Nodos y aristas dirigidas (de quien habla a quien menciona) y focos con Leiden sobre la red sin dirección
    const idx = new Map(), nodos = [];
    const nodo = (k) => { if (!idx.has(k)) { idx.set(k, nodos.length); nodos.push(k); } return idx.get(k); };
    const pares = new Map();
    for (const m of validas) { const a = nodo(m.fuente), b = nodo(clave(m)); if (a !== b) { const k = a + '>' + b; pares.set(k, (pares.get(k) || 0) + 1); } }
    const aristas = [...pares.entries()].map(([k, w]) => { const [a, b] = k.split('>').map(Number); return [a, b, w]; });
    const lei = nodos.length ? LEI.comunidades({ n: nodos.length, aristas }, { resolucion: o.resolucion, semilla: o.semilla })
      : { comunidad: [], modularidad: 0 };
    const fuerza = new Float64Array(nodos.length);
    for (const [a, b, w] of aristas) if (lei.comunidad[a] === lei.comunidad[b]) { fuerza[a] += w; fuerza[b] += w; }
    const grupos = new Map();
    nodos.forEach((k, i) => { const c = lei.comunidad[i]; if (!grupos.has(c)) grupos.set(c, []); grupos.get(c).push(i); });
    const focosOrden = [...grupos.values()].filter((g) => g.length >= 5).sort((a, b) => b.length - a.length);
    const focoDe = new Map();
    focosOrden.forEach((g, q) => g.forEach((i) => focoDe.set(nodos[i], q)));
    const focos = focosOrden.map((g, q) => {
      const dips = g.filter((i) => !esExt(nodos[i]));
      const c = new Map();
      for (const i of dips) { const p = partido.get(nodos[i]) || '?'; c.set(p, (c.get(p) || 0) + 1); }
      const centrales = [...g].sort((a, b) => fuerza[b] - fuerza[a]).slice(0, 8)
        .map((i) => ({ n: nombre(nodos[i]), p: esExt(nodos[i]) ? null : partido.get(nodos[i]) || '?' }));
      return { id: q + 1, personas: g.length, diputados: dips.length, externas: g.length - dips.length,
        partidos: [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p, n]) => [p, Math.round(100 * n / Math.max(1, dips.length))]), centrales };
    });

    // Más mencionados, con ejemplos de contexto (uno por orador distinto)
    const recib = new Map();
    for (const m of validas) {
      const k = clave(m);
      const r = recib.get(k) || { n: 0, de: new Set(), voc: 0, ref: 0, porPartido: new Map(), ms: [] };
      r.n++; r.de.add(m.fuente);
      if (m.tipo === 'diputado') { if (m.vocativo) r.voc++; else r.ref++; }
      r.porPartido.set(partidoFuente(m), (r.porPartido.get(partidoFuente(m)) || 0) + 1);
      r.ms.push(m); recib.set(k, r);
    }
    const partes = (m) => {
      const ctx = m.ctx || '';
      let buscado = m.texto || '';
      let i = buscado ? ctx.indexOf(buscado) : -1;
      if (i < 0 && m.persona) {
        const ap = String(m.persona).split(' ').pop();
        const rx = new RegExp(`(?<![\\p{L}])${ap}(?![\\p{L}])`, 'iu');
        const x = rx.exec(ctx.normalize('NFD').replace(/\p{Mn}/gu, ''));
        if (x) { i = x.index; buscado = ctx.substr(i, ap.length); }
      }
      if (i < 0) return [ctx, '', ''];
      return [ctx.slice(0, i), ctx.slice(i, i + buscado.length), ctx.slice(i + buscado.length)];
    };
    const fechaDe = new Map(filas.map((f) => [f.id, f.date]));
    const personas = [...recib.entries()].sort((a, b) => b[1].de.size - a[1].de.size || b[1].n - a[1].n).slice(0, o.personas).map(([k, r]) => {
      const vistos = new Set(), ctxs = [];
      for (const m of r.ms.sort((a, b) => String(b.date).localeCompare(String(a.date)))) {
        if (vistos.has(m.fuente)) continue;
        vistos.add(m.fuente); ctxs.push(m);
        if (ctxs.length >= o.contextos) break;
      }
      const tot = [...r.porPartido.values()].reduce((a, b) => a + b, 0);
      return { k, n: nombre(k), ext: esExt(k), p: esExt(k) ? null : partido.get(k) || '?', oradores: r.de.size, menciones: r.n,
        voc: r.voc, ref: r.ref, foco: focoDe.has(k) ? focoDe.get(k) + 1 : null,
        porPartido: [...r.porPartido.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, n]) => [p, Math.round(100 * n / Math.max(1, tot))]),
        contextos: ctxs.map((m) => ({ id: m.id, o: nombre(m.fuente), op: validoPartido(m.fuentePartido) ? m.fuentePartido : '',
          f: fechaDe.get(m.id) || m.date,
          t: m.tipo === 'externa' ? (m.suelta ? 'nombre solo' : 'con cargo') : (m.vocativo ? 'se dirige' : 'habla de'), x: partes(m) })) };
    });

    // Quién menciona, matriz entre partidos, personas externas por partido, diálogos y co-menciones
    const emit = new Map();
    for (const m of validas) { const e = emit.get(m.fuente) || { n: 0, a: new Set() }; e.n++; e.a.add(clave(m)); emit.set(m.fuente, e); }
    const mencionan = [...emit.entries()].sort((a, b) => b[1].a.size - a[1].a.size).slice(0, 15)
      .map(([k, e]) => ({ n: nombre(k), p: partido.get(k) || '?', personas: e.a.size, menciones: e.n }));
    const dm = validas.filter((m) => m.tipo === 'diputado');
    const cuentaP = new Map();
    for (const m of dm) cuentaP.set(partidoFuente(m), (cuentaP.get(partidoFuente(m)) || 0) + 1);
    const P8 = [...cuentaP.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p]) => p);
    const matriz = P8.map((a) => {
      const fila = dm.filter((m) => partidoFuente(m) === a);
      return { p: a, total: fila.length, celdas: P8.map((b) => fila.filter((m) => (partido.get(m.d.id) || '?') === b).length) };
    });
    const extM = validas.filter((m) => m.tipo === 'externa');
    const cuentaE = new Map();
    for (const m of extM) cuentaE.set(m.persona, (cuentaE.get(m.persona) || 0) + 1);
    const E6 = [...cuentaE.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([p]) => p);
    const externas = { personas: E6.map((p) => nombre('ext:' + p)),
      filas: P8.map((a) => ({ p: a, celdas: E6.map((e) => extM.filter((m) => partidoFuente(m) === a && m.persona === e).length) })) };
    const par = new Map();
    for (const m of dm) { const k = `${m.fuente}>${m.d.id}`; par.set(k, (par.get(k) || 0) + 1); }
    const dialogos = [...par.entries()].filter(([k]) => { const [a, b] = k.split('>'); return a < b && par.has(`${b}>${a}`); })
      .map(([k, n]) => { const [a, b] = k.split('>'); return { a: nombre(a), ap: partido.get(a) || '?', b: nombre(b), bp: partido.get(b) || '?', ab: n, ba: par.get(`${b}>${a}`) }; })
      .sort((x, y) => (y.ab + y.ba) - (x.ab + x.ba)).slice(0, 10);
    const porInt = new Map();
    for (const m of validas) { if (!porInt.has(m.id)) porInt.set(m.id, new Set()); porInt.get(m.id).add(clave(m)); }
    const co = new Map();
    for (const s of porInt.values()) {
      const v = [...s].sort();
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) { const k = v[i] + '|' + v[j]; co.set(k, (co.get(k) || 0) + 1); }
    }
    const comenciones = [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([k, n]) => ({ a: nombre(k.split('|')[0]), b: nombre(k.split('|')[1]), n }));

    // Coincidencia entre focos y partidos: información mutua normalizada
    const nmi = (() => {
      const ps = nodos.filter((k) => !esExt(k) && focoDe.has(k)).map((k) => [focoDe.get(k), partido.get(k) || '?']), n = ps.length;
      if (!n) return 0;
      const ca = new Map(), cb = new Map(), cab = new Map();
      for (const [a, b] of ps) { ca.set(a, (ca.get(a) || 0) + 1); cb.set(b, (cb.get(b) || 0) + 1); cab.set(a + '|' + b, (cab.get(a + '|' + b) || 0) + 1); }
      let I = 0;
      for (const [k, v] of cab) { const [a, b] = k.split('|'); I += (v / n) * Math.log((v * n) / (ca.get(Number(a)) * cb.get(b))); }
      const H = (c) => -[...c.values()].reduce((s, v) => s + (v / n) * Math.log(v / n), 0);
      const h = (H(ca) + H(cb)) / 2;
      return h > 0 ? Math.round((1000 * I) / h) / 1000 : 0;
    })();

    const diputadas = menciones.filter((m) => m.tipo === 'diputado');
    const resumen = {
      intervenciones: filas.length, con_menciones: new Set(validas.map((m) => m.id)).size, menciones: validas.length,
      personas: nodos.length, mencionadas: recib.size, externas: [...recib.keys()].filter(esExt).length, oradores: emit.size,
      focos: focos.length, modularidad: Math.round(lei.modularidad * 1000) / 1000, nmi,
      deteccion: {
        resueltas: diputadas.filter((m) => m.estado === 'resuelta' && !m.alaPresidencia).length,
        se_dirige: validas.filter((m) => m.tipo === 'diputado' && m.vocativo).length,
        habla_de: validas.filter((m) => m.tipo === 'diputado' && !m.vocativo).length,
        protocolo: diputadas.filter((m) => m.alaPresidencia).length,
        ambiguas: diputadas.filter((m) => m.estado === 'ambigua').length,
        sin_resolver: diputadas.filter((m) => m.estado === 'sin resolver').length,
        antiguos: menciones.filter((m) => m.antiguo).length,
        externas_cargo: menciones.filter((m) => m.tipo === 'externa' && !m.suelta).length,
        externas_nombre: menciones.filter((m) => m.suelta).length,
        cargo_sin_nombre: menciones.filter((m) => m.sinNombre).length,
        por: det.via, mesa: det.cont.presidencia, de_la_mesa: det.de_la_mesa, acotaciones: det.cont.acotacion,
        procedimiento: det.cont.procedimiento, propias: det.cont.propia, subnacionales: det.cont.subnacional,
        cargos_sin_atribuir: Object.entries(det.cont.cargo_sin_nombre).sort((a, b) => b[1] - a[1]).slice(0, 8),
      },
    };

    // Red para el visualizador: aristas sin dirección con los dos sentidos
    const und = new Map();
    for (const [a, b, w] of aristas) {
      const [i, j] = a < b ? [a, b] : [b, a];
      const e = und.get(i + '-' + j) || { a: i, b: j, ab: 0, ba: 0 };
      if (a === i) e.ab += w; else e.ba += w;
      und.set(i + '-' + j, e);
    }
    const enLista = new Map(personas.map((p, q) => [p.k, q]));
    const recibida = (k) => recib.get(k) || { n: 0, de: new Set() };
    const red = {
      nodos: nodos.map((k) => ({ n: nombre(k), p: esExt(k) ? null : partido.get(k) || '?', ext: esExt(k),
        f: focoDe.has(k) ? focoDe.get(k) + 1 : 0, or: recibida(k).de.size, men: recibida(k).n,
        emite: emit.has(k) ? emit.get(k).a.size : 0, lista: enLista.has(k) ? enLista.get(k) : -1 })),
      aristas: [...und.values()].map((e) => [e.a, e.b, e.ab, e.ba]),
      partidos: P8,
    };
    // Una fila por mención para exportarlas: quién habla, a quién menciona, cómo y con qué palabras
    const detalle = validas.map((m) => {
      const k = clave(m), ext = esExt(k);
      return { id: m.id, f: fechaDe.get(m.id) || m.date || '', o: nombre(m.fuente),
        op: validoPartido(m.fuentePartido) ? m.fuentePartido : '', n: nombre(k), p: ext ? '' : partido.get(k) || '',
        e: ext ? 1 : 0, t: m.tipo === 'externa' ? (m.suelta ? 'nombre solo' : 'con cargo') : (m.vocativo ? 'se dirige' : 'habla de'),
        x: m.texto || '' };
    });
    return { resumen, personas, mencionan, matriz: { partidos: P8, filas: matriz }, externas, focos, dialogos, comenciones, red, detalle };
  }

  /** Menciones de una biblioteca: lee sus intervenciones, detecta y arma la red. */
  async function red(ctx, ids, opciones = {}) {
    const o = Object.assign({}, DEFECTOS, opciones);
    const t0 = Date.now();
    const bd = { db: ctx.db, sqlite3: ctx.sqlite3 };
    const pais = (ctx.nucleo && ctx.nucleo.pais) || '';
    const C = formasDe(pais);
    if (!C) return { disponible: false, pais, motivo: 'Este corpus no tiene formas de tratamiento en el registro de menciones.' };
    const pedidos = Array.from(new Set(Array.from(ids, (i) => Number(i)))).sort((a, b) => a - b);
    const prog = crearProgreso(ctx, pedidos.length);
    prog('lectura', 0, true);
    const filas = await filasDeBiblioteca(ctx, bd, pedidos, prog);
    const contexto = contextoDeSesiones(bd, pedidos, filas);
    const oradores = oradoresDelCorpus(bd);
    const det = await detectar({ pais, config: C, pila: nombresPila(), filas, contexto, oradores,
      ceder: () => (ctx && typeof ctx.ceder === 'function' ? ctx.ceder() : Promise.resolve()),
      progreso: (fase, fraccion) => prog(fase, fraccion) });
    prog('red', 0, true);
    const salida = armar(det, filas, oradores, o);
    salida.disponible = true;
    salida.pais = pais;
    salida.opciones = { resolucion: o.resolucion, semilla: o.semilla };
    salida.resumen.intervenciones_biblioteca = pedidos.length;
    salida.resumen.contexto = contexto.length;
    salida.resumen.oradores_corpus = det.oradores;
    salida.ms = Date.now() - t0;
    prog('red', 1, true);
    return salida;
  }

  R2.menciones = Object.freeze({ red, detectar, formasDe, hay, DEFECTOS, FASES });
})(globalThis.R2 = globalThis.R2 || {});

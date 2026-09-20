// Formas de referirse a las personas en los 16 parlamentos de ParlaIbero, por lengua y por país. Las listas salen del sondeo
// de los propios corpus (formas/formas_tratamiento.py: qué palabras preceden a los nombres de los miembros de cada cámara y a
// los de otras personas) más las que en portugués van con mayúscula («Deputado», «Sr. Deputado») y el sondeo no ve.
//
// Tipos de forma:
//   miembro     cargo de quien tiene escaño en la cámara («diputado», «representante», «congresista», «asambleísta»);
//   tratamiento cualquier persona («señor», «don», «doctor», «licenciado», «colega»);
//   gobierno    cargo que un miembro puede ocupar o no según el país («presidente», «ministro», «portavoz»);
//   descriptivo título u oficio que no impide tener escaño («general», «periodista», «poeta», «monseñor», «expresidente»): se
//               resuelve como un tratamiento (Ríos Montt fue general y presidente del Congreso de Guatemala);
//   externo     cargo que no ocupa un miembro en ejercicio («senador», «gobernador», «alcalde», «juez», «embajador», «rey»).
// Una cadena puede combinar varias («el señor diputado», «honorable representante», «O Sr. Deputado», «diputado suplente»).
//
// Jefes de Estado (y de Gobierno en España y Portugal) con sus fechas: «presidente X» es el jefe de Estado solo durante su
// mandato («presidente Menem» es Carlos en 1995 y Martín, presidente de la Cámara, en 2024) y sirve también para atribuir el
// cargo sin nombre («el presidente de la República»). Fechas de toma de posesión contrastadas el 19 de septiembre de 2026 con
// Wikidata (P39 con sus fechas) y con el texto del artículo de Wikipedia de cada persona o, para los primeros ministros de Portugal,
// la lista de pt.wikipedia (scratchpad jefes/contrastar.py y verificar_extra.py). Convención: «hasta» es la toma de posesión del
// sucesor (fin exclusivo). Incluyen los jefes anteriores al corpus que se siguen nombrando («expresidente Gaviria»).

const ES = {
  lengua: 'es',
  tratamiento: ['señor', 'señora', 'señorita', 'sr', 'sra', 'srta', 'don', 'doña', 'doctor', 'doctora', 'dr', 'dra', 'licenciado',
    'licenciada', 'lic', 'ingeniero', 'ingeniera', 'ing', 'arquitecto', 'arquitecta', 'arq', 'abogado', 'abogada', 'economista',
    'contador', 'contadora', 'escribano', 'escribana', 'magíster', 'magister', 'maestro', 'maestra', 'profesor', 'profesora', 'prof',
    'compañero', 'compañera', 'colega', 'amigo', 'amiga', 'hermano', 'hermana', 'querido', 'querida', 'estimado', 'estimada',
    'ciudadano', 'ciudadana', 'honorable', 'honorables', 'h', 'excelentísimo', 'excelentísima', 'ilustre', 'senyor', 'senyora'],
  gobierno: ['presidente', 'presidenta', 'vicepresidente', 'vicepresidenta', 'ministro', 'ministra', 'canciller', 'secretario',
    'secretaria', 'subsecretario', 'subsecretaria', 'portavoz', 'ponente', 'relator', 'relatora', 'jefe', 'jefa', 'líder',
    'viceministro', 'viceministra', 'director', 'directora', 'gerente', 'superintendente', 'contralor', 'contralora', 'subcontralor',
    'coordinador', 'coordinadora', 'delegado', 'delegada', 'viceprimer', 'vicecanciller', 'registrador', 'defensor'],
  descriptivo: ['general', 'coronel', 'comandante', 'capitán', 'teniente', 'almirante', 'sargento', 'mariscal', 'brigadier', 'comodoro', 'dictador', 'dictadora',
    'monseñor', 'obispo', 'arzobispo', 'pastor', 'periodista', 'escritor', 'escritora', 'poeta', 'poetisa', 'filósofo',
    'filósofa', 'historiador', 'historiadora', 'expresidente', 'expresidenta', 'exministro', 'exministra', 'exdiputado',
    'exdiputada', 'exsenador', 'exsenadora', 'exgobernador', 'excongresista', 'exasambleísta', 'exalcalde', 'candidato',
    'candidata', 'comisionado', 'comisionada', 'empresario', 'empresaria', 'sindicalista', 'dirigente'],
  externo: ['senador', 'senadora', 'sen', 'gobernador', 'gobernadora', 'alcalde', 'alcaldesa', 'intendente', 'intendenta',
    'concejal', 'concejala', 'regidor', 'regidora', 'prefecto', 'prefecta', 'rey', 'reina', 'príncipe', 'princesa', 'infanta',
    'papa', 'cardenal', 'juez', 'jueza', 'magistrado', 'magistrada', 'fiscal', 'procurador', 'procuradora', 'defensor', 'defensora',
    'embajador', 'embajadora', 'cónsul', 'lehendakari', 'lendakari', 'president', 'conseller', 'consellera', 'consejero', 'consejera'],
  // tras la forma de miembro, un ámbito subnacional: no es miembro de esta cámara («diputado provincial», «diputado local»)
  subnacional: /^(provincial|provinciales|local|locales|departamental|departamentales|autonomico|autonomica|regional|estatal|estatales|municipal)$/,
  // artículos y preposiciones que hacen de la mención una referencia («el señor X») y no un vocativo («señor X, …»)
  articulo: /\b(el|la|los|las|al|del|a la|de la|de los|de las|con el|con la|que el|que la|y el|y la|e el|para el|para la|por el|por la|según el|según la|como el|como la|sobre el|sobre la|contra el|contra la|ante el|ante la|entre el|lo que el|lo que la|a los|a las|su|mi|nuestro|nuestra)$/i,
  procedimiento: /tiene la palabra|tiene el uso de la palabra|le concedo la palabra|se le concede la palabra|concede la palabra|en uso de la palabra|con la venia|por alusiones|para una cuestión de orden|pide la palabra|solicit[oa] la palabra|palabra (al|a la|el|la)|vota(r|do)? (sí|no)|se incorpora|en sustitución (del|de la)|solicito (al|a la|el|la)?$|se concede|uso de la tribuna|tiene la tribuna|hará uso de la palabra|haga uso de la palabra|cede el uso|voto por (el|la) (señor|señora)/i,
  noPersona: ['gobierno', 'estado', 'republica', 'nacion', 'comision', 'congreso', 'camara', 'senado', 'asamblea', 'parlamento',
    'mesa', 'grupo', 'partido', 'ministerio', 'consejo', 'tribunal', 'corte', 'juzgado', 'fiscalia', 'ley', 'decreto', 'constitucion',
    'reglamento', 'articulo', 'capitulo', 'titulo', 'disposicion', 'proyecto', 'proposicion', 'mocion', 'enmienda', 'informe',
    'dictamen', 'orden', 'sesion', 'pleno', 'plenario', 'diario', 'boletin', 'presidencia', 'vicepresidencia', 'secretaria', 'junta',
    'direccion', 'departamento', 'provincia', 'region', 'municipio', 'ciudad', 'pais', 'pueblo', 'sociedad', 'institucion',
    'fundacion', 'asociacion', 'federacion', 'confederacion', 'sindicato', 'universidad', 'colegio', 'escuela', 'hospital', 'banco',
    'caja', 'empresa', 'compania', 'senoria', 'senorias', 'excelencia', 'usted', 'ustedes', 'dios', 'presidente', 'presidenta',
    'ministro', 'ministra', 'diputado', 'diputada', 'diputados', 'diputadas', 'vicepresidente', 'vicepresidenta', 'secretario',
    'portavoz', 'fuerzas', 'ejercito', 'armada', 'policia', 'guardia', 'poder', 'administracion', 'hacienda', 'justicia', 'defensa',
    'interior', 'exterior', 'exteriores', 'economia', 'educacion', 'salud', 'sanidad', 'trabajo', 'agricultura', 'fomento', 'cultura',
    'relator', 'relatora', 'prosecretario', 'prosecretaria', 'concejo', 'miembro', 'miembros', 'integrantes', 'ponente', 'comite',
    'electronico', 'electronica', 'agronomo', 'agronoma', 'quimico', 'quimica', 'mecanico', 'industrial', 'electricista', 'forestal', 'ambiental', 'comercial',
    'parlamentarios', 'parlamentario', 'cuerpo', 'vice', 'camra', 'camaraa', 'titularde', 'consideracion', 'municipales', 'periodistas',
    'paraguayo', 'paraguaya', 'salvadoreno', 'salvadorena', 'uruguayo', 'uruguaya', 'legal', 'secretarias', 'suplentes', 'propietarios',
    'prevencion', 'tema', 'fuerza', 'redactor', 'letrado', 'interinstitucional', 'edila', 'edil', 'intendentes', 'presidentes', 'diputa',
    'legislator', 'jueces', 'seguridad', 'finanzas', 'emerito', 'integracion', 'promocion', 'gerente', 'servicios', 'secretarios', 'embajadores', 'agencia', 'oficina', 'servicio', 'sistema', 'programa', 'plan', 'fondo', 'instituto', 'centro',
    'union', 'frente', 'movimiento', 'alianza', 'coalicion', 'bloque', 'bancada', 'fraccion', 'jefatura', 'autoridad', 'organo',
    'poderes', 'senores', 'senoras', 'don', 'dona', 'vuestra', 'su', 'sus', 'majestad', 'alteza', 'santidad', 'eminencia',
    'parlament', 'generalitat', 'govern', 'consell', 'xunta', 'ajuntament', 'diputacio', 'diputacion', 'cabildo', 'cortes', 'corts',
    'eusko', 'legebiltzarra', 'jaurlaritza', 'ayuntamiento', 'concello', 'udala', 'audiencia', 'supremo', 'constitucional',
    'anticorrupcion', 'general', 'superior', 'nacional', 'provincial', 'jefe', 'mayor', 'naciones', 'unidas', 'especial', 'internacional',
    'europea', 'europeo', 'mundial', 'iberoamericana', 'latinoamericana', 'representantes', 'congresistas', 'legisladores',
    'legisladoras', 'asambleistas', 'senadores', 'concejales', 'ministros', 'secretarios', 'honorable', 'honorables', 'hemiciclo',
    'plenaria', 'contraloria', 'procuraduria', 'defensoria', 'fiscalia', 'registraduria', 'superintendencia', 'decreta', 'considerando',
    'presente', 'presentes', 'publica', 'publico', 'social', 'nueva', 'nuevo', 'ejecutivo', 'ejecutiva', 'legislativo', 'legislativa',
    'judicial', 'infraestructura', 'vivienda', 'codigo', 'civil', 'penal', 'ninos', 'adolescentes', 'entidad', 'federativa', 'asistente',
    'transportes', 'comunicaciones', 'residente',
    'que', 'para', 'por', 'tras', 'con', 'sin', 'sobre', 'entre', 'ante', 'cuando', 'como', 'donde', 'primera', 'segunda', 'tercera',
    'cuarta', 'quinta', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'tributaria', 'tributario', 'estructural', 'presidencial',
    'consejero', 'consejera', 'corporacion', 'ausente', 'ausentes', 'favor', 'contra', 'abstencion', 'excusado', 'excusada', 'justificado',
    'preparado', 'presentado', 'elaborado', 'remitido', 'asunto', 'tramite', 'titular', 'tecnico', 'tecnica', 'suprema', 'sala', 'vigente',
    'voto', 'votos', 'comisiones', 'internacionales', 'delitos', 'amazonica', 'andina', 'costena', 'insular', 'ad', 'hoc', 'interino',
    'interina', 'encargado', 'encargada', 'adjunto', 'adjunta', 'regional', 'municipal', 'tribunales', 'fiscales', 'electoral',
    'transitoria', 'transitorias', 'final', 'finales', 'adicional', 'unica', 'unico', 'total', 'parcial', 'mocion', 'resolucion',
    'propietario', 'propietaria', 'asistencia', 'inasistencia', 'quorum', 'votacion', 'administrativo', 'administrativa', 'alternos',
    'alterno', 'alterna', 'ganaderia', 'alimentacion', 'pesca', 'rural', 'energia', 'minas', 'comercio', 'turismo', 'transporte', 'ambiente',
    'recursos', 'naturales', 'hidrocarburos', 'desarrollo', 'financiero', 'financiera', 'juridico', 'juridica', 'operativo', 'operativa',
    'medico', 'medica', 'cirujano', 'cirujana', 'pres', 'sres', 'comisario', 'comisaria', 'industria', 'hacienda', 'planificacion'],
  comunes: ['garcia', 'fernandez', 'gonzalez', 'rodriguez', 'lopez', 'martinez', 'sanchez', 'perez', 'gomez', 'martin', 'jimenez',
    'ruiz', 'hernandez', 'diaz', 'moreno', 'alvarez', 'munoz', 'romero', 'alonso', 'gutierrez', 'navarro', 'torres', 'dominguez',
    'vazquez', 'ramos', 'gil', 'ramirez', 'serrano', 'blanco', 'suarez', 'molina', 'morales', 'ortega', 'delgado', 'castro', 'ortiz',
    'rubio', 'marin', 'sanz', 'iglesias', 'nunez', 'medina', 'garrido', 'cortes', 'castillo', 'santos', 'lozano', 'guerrero', 'cano',
    'prieto', 'mendez', 'cruz', 'calvo', 'gallego', 'vidal', 'leon', 'herrera', 'marquez', 'pena', 'flores', 'cabrera', 'campos',
    'vega', 'fuentes', 'carrasco', 'diez', 'caballero', 'reyes', 'nieto', 'aguilar', 'pascual', 'santana', 'herrero', 'lorenzo',
    'montero', 'hidalgo', 'gimenez', 'ibanez', 'ferrer', 'duran', 'santiago', 'benitez', 'mora', 'vicente', 'vargas', 'arias',
    'carmona', 'crespo', 'roman', 'pastor', 'soto', 'saez', 'velasco', 'moya', 'soler', 'parra', 'esteban', 'bravo', 'gallardo',
    'rojas', 'silva', 'rivera', 'mejia', 'acosta', 'aguirre', 'salazar', 'espinoza', 'espinosa', 'valencia', 'contreras', 'sosa',
    'rios', 'figueroa', 'franco', 'ramon', 'luna', 'pacheco', 'miranda', 'rivas', 'avila', 'camacho', 'ponce', 'orozco', 'mendoza',
    'escobar', 'cardenas', 'guzman', 'estrada', 'zamora', 'villa', 'rincon', 'paredes', 'valdez', 'maldonado', 'bermudez', 'osorio',
    'velez', 'quintero', 'zapata', 'cortez', 'solis', 'arroyo', 'palacios', 'correa', 'londono', 'jaramillo', 'duarte', 'benavides'],
  lugares: ['espana', 'mexico', 'argentina', 'chile', 'colombia', 'peru', 'ecuador', 'bolivia', 'paraguay', 'uruguay', 'venezuela',
    'brasil', 'panama', 'guatemala', 'honduras', 'nicaragua', 'salvador', 'cuba', 'dominicana', 'francia', 'italia', 'alemania',
    'portugal', 'inglaterra', 'europa', 'america', 'africa', 'asia', 'china', 'rusia', 'japon', 'india', 'madrid', 'barcelona',
    'cataluna', 'euskadi', 'galicia', 'andalucia', 'valencia', 'navarra', 'aragon', 'castilla', 'canarias', 'baleares', 'asturias',
    'cantabria', 'murcia', 'extremadura', 'rioja', 'lima', 'bogota', 'quito', 'caracas', 'santiago', 'asuncion', 'montevideo',
    'managua', 'tegucigalpa', 'jose', 'domingo', 'washington', 'londres', 'paris', 'roma', 'bruselas', 'naciones', 'unidas',
    'aguascalientes', 'baja', 'california', 'campeche', 'chiapas', 'chihuahua', 'coahuila', 'colima', 'durango', 'guanajuato',
    'jalisco', 'michoacan', 'morelos', 'nayarit', 'oaxaca', 'puebla', 'queretaro', 'quintana', 'potosi', 'sinaloa', 'sonora',
    'tabasco', 'tamaulipas', 'tlaxcala', 'veracruz', 'yucatan', 'zacatecas', 'cuenca', 'guayaquil', 'guayas', 'pichincha', 'manabi',
    'antioquia', 'cundinamarca', 'medellin', 'cali', 'barranquilla', 'cartagena', 'mendoza', 'cordoba', 'rosario', 'tucuman', 'salta',
    'arequipa', 'cusco', 'cuzco', 'piura', 'trujillo', 'valparaiso', 'concepcion', 'antofagasta', 'maldonado', 'canelones', 'colonia', 'aires', 'catamarca', 'chaco', 'chubut', 'corrientes',
    'formosa', 'jujuy', 'neuquen', 'misiones', 'fuego', 'estero', 'alajuela', 'heredia', 'cartago', 'puntarenas', 'guanacaste', 'bocas',
    'chiriqui', 'veraguas', 'cocle', 'darien', 'maguana', 'macoris', 'altagracia', 'peten', 'quiche', 'huehuetenango', 'quetzaltenango',
    'escuintla', 'izabal', 'jutiapa', 'chiquimula', 'zacapa', 'totonicapan', 'solola', 'sacatepequez', 'chimaltenango', 'suchitepequez',
    'retalhuleu', 'verapaz', 'usulutan', 'sonsonate', 'ahuachapan', 'chalatenango', 'cuscatlan', 'itapua', 'caaguazu',
    'amambay', 'canindeyu', 'caazapa', 'guaira', 'boqueron', 'esmeraldas', 'imbabura', 'carchi', 'tungurahua', 'chimborazo',
    'cotopaxi', 'azuay', 'loja', 'orellana', 'sucumbios', 'chinchipe', 'galapagos', 'caribe', 'pacifico', 'sevilla', 'malaga',
    'cadiz', 'granada', 'almeria', 'huelva', 'jaen', 'zaragoza', 'huesca', 'teruel', 'bilbao', 'vizcaya', 'bizkaia', 'guipuzcoa',
    'gipuzkoa', 'alava', 'araba', 'valladolid', 'palencia', 'albacete', 'alicante', 'castellon', 'tarragona', 'lleida', 'lerida', 'girona',
    'gerona', 'pamplona', 'badajoz', 'caceres', 'ourense', 'orense', 'pontevedra', 'coruna', 'vigo', 'gijon', 'mallorca', 'menorca',
    'ibiza', 'tenerife', 'ceuta', 'melilla', 'logrono'],
  fecha: /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)$/,
};

const PT = {
  lengua: 'pt',
  tratamiento: ['senhor', 'senhora', 'sr', 'sra', 'sr.ª', 'srª', 'dona', 'doutor', 'doutora', 'dr', 'dra', 'professor', 'professora',
    'prof', 'profa', 'engenheiro', 'engenheira', 'eng', 'camarada', 'companheiro', 'companheira', 'colega', 'amigo', 'amiga',
    'querido', 'querida', 'nobre', 'saudoso', 'saudosa', 'excelentíssimo', 'excelentíssima', 'exmo', 'exma', 'ilustre', 'caro', 'cara'],
  gobierno: ['presidente', 'presidenta', 'vice-presidente', 'vice-presidenta', 'ministro', 'ministra', 'primeiro-ministro',
    'primeira-ministra', 'secretário', 'secretária', 'líder', 'relator', 'relatora'],
  descriptivo: ['general', 'coronel', 'comandante', 'almirante', 'marechal', 'brigadeiro', 'bispo', 'arcebispo', 'jornalista', 'empresário', 'empresária',
    'escritor', 'escritora', 'poeta', 'economista', 'candidato', 'candidata', 'ex-presidente', 'ex-presidenta', 'ex-ministro',
    'ex-ministra', 'ex-deputado', 'ex-deputada', 'ex-governador', 'ex-governadora', 'ex-senador', 'ex-senadora', 'ex-prefeito',
    'ex-primeiro-ministro', 'sindicalista', 'dirigente'],
  externo: ['senador', 'senadora', 'governador', 'governadora', 'prefeito', 'prefeita', 'vereador', 'vereadora', 'autarca', 'papa',
    'rei', 'rainha', 'cardeal', 'juiz', 'juíza', 'desembargador', 'desembargadora', 'procurador', 'procuradora', 'embaixador',
    'embaixadora'],
  subnacional: /^(estadual|estaduais|distrital|distritais|municipal|regional)$/,
  articulo: /\b(o|a|os|as|ao|à|aos|às|do|da|dos|das|pelo|pela|pelos|pelas|com o|com a|que o|que a|e o|e a|para o|para a|no|na|sobre o|contra o|segundo o|como o|como a|seu|sua|meu|minha|nosso|nossa)$/i,
  procedimiento: /palavra|pela ordem|como vota|orienta|encaminhar|inscrit|em substituição|substitui|concedo|tem a palavra/i,
  noPersona: ['governo', 'estado', 'republica', 'nacao', 'comissao', 'congresso', 'camara', 'senado', 'assembleia', 'parlamento', 'membro', 'membros', 'estados', 'congressistas', 'embaixadores', 'emprego', 'seguranca', 'social', 'ensino', 'superior', 'solidariedade', 'secretarios', 'secretarias',
    'mesa', 'bancada', 'partido', 'ministerio', 'conselho', 'tribunal', 'lei', 'decreto', 'constituicao', 'regimento', 'artigo',
    'projeto', 'projecto', 'emenda', 'relatorio', 'parecer', 'ordem', 'sessao', 'plenario', 'presidencia', 'secretaria', 'junta',
    'direcao', 'departamento', 'municipio', 'cidade', 'pais', 'povo', 'sociedade', 'instituto', 'fundacao', 'associacao',
    'federacao', 'confederacao', 'sindicato', 'universidade', 'escola', 'hospital', 'banco', 'caixa', 'empresa', 'companhia',
    'excelencia', 'v', 'exa', 'exª', 'casa', 'presidente', 'ministro', 'ministra', 'deputado', 'deputada', 'deputados',
    'deputadas', 'senador', 'lider', 'relator', 'relatora', 'forcas', 'exercito', 'policia', 'poder', 'fazenda', 'justica', 'defesa',
    'saude', 'educacao', 'trabalho', 'agricultura', 'cultura', 'comite', 'agencia', 'servico', 'sistema', 'programa', 'plano',
    'fundo', 'centro', 'uniao', 'frente', 'movimento', 'alianca', 'bloco', 'grupo', 'vossa', 'sua', 'suas', 'senhores', 'senhoras',
    'negocios', 'estrangeiros', 'assuntos', 'fiscais', 'parlamentares', 'deputados', 'senadores', 'ministros', 'aeronautica', 'marinha',
    'transportes', 'comunicacoes', 'residente', 'executivo', 'legislativo', 'judiciario', 'extraordinario', 'reforma', 'tributaria',
    'especial', 'geral', 'nacional', 'federal', 'executiva', 'receita', 'previdencia', 'desenvolvimento', 'industria', 'comercio', 'servicos',
    'adjunto', 'adjunta', 'regional', 'municipal', 'ausente', 'presente', 'favor', 'contra', 'abstencao', 'que', 'para', 'por', 'com',
    'sem', 'sobre', 'primeira', 'segunda', 'terceira', 'primeiro', 'segundo', 'terceiro', 'interino', 'interina', 'secundaria', 'museu',
    'director', 'directora', 'diretor', 'diretora', 'provedor', 'provedora', 'comissario', 'comissaria', 'bastonario', 'bastonaria', 'inspector', 'inspectora'],
  comunes: ['silva', 'santos', 'souza', 'sousa', 'oliveira', 'costa', 'pereira', 'lima', 'ferreira', 'rodrigues', 'alves', 'gomes',
    'martins', 'araujo', 'ribeiro', 'carvalho', 'almeida', 'lopes', 'barbosa', 'rocha', 'dias', 'moreira', 'nunes', 'mendes',
    'freitas', 'neto', 'filho', 'junior', 'jr', 'fernandes', 'goncalves', 'marques', 'cardoso', 'teixeira', 'correia', 'melo',
    'machado', 'soares', 'vieira', 'monteiro', 'batista', 'pinto', 'fonseca', 'reis', 'lourenco', 'antunes', 'matos', 'campos',
    'moura', 'cunha', 'cavalcante', 'castro', 'borges', 'nascimento', 'andrade', 'miranda', 'guimaraes', 'coelho', 'duarte'],
  lugares: ['brasil', 'portugal', 'franca', 'espanha', 'italia', 'alemanha', 'inglaterra', 'europa', 'america', 'africa', 'china',
    'russia', 'japao', 'india', 'argentina', 'chile', 'paraguai', 'uruguai', 'bolivia', 'venezuela', 'lisboa', 'porto', 'braga',
    'coimbra', 'faro', 'madeira', 'acores', 'algarve', 'alentejo', 'minho', 'camara', 'senado', 'parana', 'bahia', 'goias', 'para',
    'amapa', 'acre', 'rondonia', 'roraima', 'tocantins', 'sergipe', 'alagoas', 'paraiba', 'piaui', 'maranhao', 'ceara', 'pernambuco',
    'amazonas', 'minas', 'gerais', 'rio', 'natal', 'recife', 'salvador', 'belem', 'manaus', 'lins', 'bauru', 'campinas', 'santos',
    'vitoria', 'palmas', 'brasilia', 'roma', 'santiago'],
  fecha: /^(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)$/,
};

// Por país: formas de los miembros, la lengua, cómo se cita el apellido (el primero en castellano, el último en portugués; en
// Brasil, el nombre parlamentario) y los jefes de Estado/Gobierno con sus mandatos [clave de apellido, nombre, desde, hasta].
// En España y Portugal el jefe de Gobierno suele tener escaño: se resuelve con la lista de oradores de la legislatura.
const PAISES = {
  AR: { base: ES, camara: 'Cámara de Diputados de la Nación', miembro: ['diputado', 'diputada', 'dip', 'legislador', 'legisladora'],
    jefes: [['bignone', 'Reynaldo Bignone', '1982-07-01', '1983-12-10'], ['alfonsin', 'Raúl Alfonsín', '1983-12-10', '1989-07-08'], ['menem', 'Carlos Menem', '1989-07-08', '1999-12-10'],
      ['de la rua', 'Fernando de la Rúa', '1999-12-10', '2001-12-21'],
      ['rodriguez saa', 'Adolfo Rodríguez Saá', '2001-12-23', '2001-12-30'],
      ['duhalde', 'Eduardo Duhalde', '2002-01-02', '2003-05-25'], ['kirchner|nestor kirchner|nestor', 'Néstor Kirchner', '2003-05-25', '2007-12-10'],
      ['cristina|fernandez de kirchner|cristina kirchner|cristina fernandez|kirchner', 'Cristina Fernández de Kirchner', '2007-12-10', '2015-12-10'], ['macri', 'Mauricio Macri', '2015-12-10', '2019-12-10'],
      ['alberto fernandez', 'Alberto Fernández', '2019-12-10', '2023-12-10'], ['milei', 'Javier Milei', '2023-12-10', null]],
    historicos: [['peron', 'Juan Domingo Perón'], ['videla', 'Jorge Rafael Videla'], ['galtieri', 'Leopoldo Galtieri'],
      ['san martin', 'José de San Martín'], ['belgrano', 'Manuel Belgrano'], ['yrigoyen', 'Hipólito Yrigoyen'], ['evita', 'Eva Perón'],
      ['illia', 'Arturo Illia']],
    cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Nn]ación\b/g, 'jefes'], [/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },
  BR: { base: PT, camara: 'Câmara dos Deputados', miembro: ['deputado', 'deputada', 'dep'], nombreParlamentario: true, escanoConPartido: true,
    cargosSinNombre: [[/(?<![\p{L}])(?:o|ao|do|pelo)\s+(?:Senhor\s+|Sr\.\s*)?Presidente da República(?![\p{L}])/gu, 'jefes']],
    jefes: [['figueiredo', 'João Figueiredo', '1979-03-15', '1985-03-15'], ['sarney', 'José Sarney', '1985-03-15', '1990-03-15'], ['collor', 'Fernando Collor', '1990-03-15', '1992-12-29'],
      ['itamar', 'Itamar Franco', '1992-12-29', '1995-01-01'], ['fhc', 'Fernando Henrique Cardoso', '1995-01-01', '2003-01-01'],
      ['lula', 'Lula', '2003-01-01', '2011-01-01'], ['dilma', 'Dilma Rousseff', '2011-01-01', '2016-08-31'],
      ['temer', 'Michel Temer', '2016-05-12', '2019-01-01'], ['bolsonaro', 'Jair Bolsonaro', '2019-01-01', '2023-01-01'],
      ['lula', 'Lula', '2023-01-01', null]],
    alias: { rousseff: 'dilma', 'fernando henrique': 'fhc', 'henrique cardoso': 'fhc', 'luiz inacio': 'lula', 'lula da silva': 'lula' },
    historicos: [['tarcisio', 'Tarcísio de Freitas'], ['getulio', 'Getúlio Vargas'], ['vargas', 'Getúlio Vargas'], ['juscelino', 'Juscelino Kubitschek']] },
  CL: { base: ES, camara: 'Cámara de Diputadas y Diputados', miembro: ['diputado', 'diputada', 'dip'],
    jefes: [['aylwin', 'Patricio Aylwin', '1990-03-11', '1994-03-11'], ['frei', 'Eduardo Frei Ruiz-Tagle', '1994-03-11', '2000-03-11'],
      ['lagos', 'Ricardo Lagos', '2000-03-11', '2006-03-11'], ['bachelet|michelle bachelet', 'Michelle Bachelet', '2006-03-11', '2010-03-11'],
      ['pinera', 'Sebastián Piñera', '2010-03-11', '2014-03-11'], ['bachelet', 'Michelle Bachelet', '2014-03-11', '2018-03-11'],
      ['pinera', 'Sebastián Piñera', '2018-03-11', '2022-03-11'], ['boric', 'Gabriel Boric', '2022-03-11', '2026-03-11'],
      ['kast', 'José Antonio Kast', '2026-03-11', null]],
    historicos: [['pinochet', 'Augusto Pinochet'], ['allende', 'Salvador Allende']], cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },
  CO: { base: ES, camara: 'Cámara de Representantes', miembro: ['representante', 'representantes', 'congresista'],
    jefes: [['barco', 'Virgilio Barco', '1986-08-07', '1990-08-07'], ['gaviria', 'César Gaviria', '1990-08-07', '1994-08-07'],
      ['samper', 'Ernesto Samper', '1994-08-07', '1998-08-07'], ['pastrana', 'Andrés Pastrana', '1998-08-07', '2002-08-07'],
      ['uribe', 'Álvaro Uribe', '2002-08-07', '2010-08-07'], ['santos', 'Juan Manuel Santos', '2010-08-07', '2018-08-07'],
      ['duque', 'Iván Duque', '2018-08-07', '2022-08-07'], ['petro', 'Gustavo Petro', '2022-08-07', '2026-08-07'],
      ['de la espriella', 'Abelardo de la Espriella', '2026-08-07', null]],
    historicos: [['simon bolivar', 'Simón Bolívar'], ['jorge eliecer gaitan', 'Jorge Eliécer Gaitán']], cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },
  CR: { base: ES, camara: 'Asamblea Legislativa', miembro: ['diputado', 'diputada', 'dip'], reeleccionConsecutiva: false,
    historicos: [['figueres ferrer', 'José Figueres Ferrer'], ['pepe figueres', 'José Figueres Ferrer']], cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']],
    jefes: [['monge', 'Luis Alberto Monge', '1982-05-08', '1986-05-08'], ['arias', 'Óscar Arias', '1986-05-08', '1990-05-08'],
      ['calderon', 'Rafael Ángel Calderón', '1990-05-08', '1994-05-08'], ['figueres', 'José María Figueres', '1994-05-08', '1998-05-08'], ['rodriguez', 'Miguel Ángel Rodríguez', '1998-05-08', '2002-05-08'],
      ['pacheco', 'Abel Pacheco', '2002-05-08', '2006-05-08'], ['arias', 'Óscar Arias', '2006-05-08', '2010-05-08'],
      ['chinchilla', 'Laura Chinchilla', '2010-05-08', '2014-05-08'], ['solis', 'Luis Guillermo Solís', '2014-05-08', '2018-05-08'],
      ['alvarado', 'Carlos Alvarado', '2018-05-08', '2022-05-08'], ['chaves', 'Rodrigo Chaves', '2022-05-08', '2026-05-08'],
      ['laura fernandez', 'Laura Fernández', '2026-05-08', null]] },
  DO: { base: ES, camara: 'Cámara de Diputados', miembro: ['diputado', 'diputada', 'dip'],
    jefes: [['balaguer', 'Joaquín Balaguer', '1986-08-16', '1996-08-16'], ['fernandez', 'Leonel Fernández', '1996-08-16', '2000-08-16'],
      ['mejia', 'Hipólito Mejía', '2000-08-16', '2004-08-16'], ['fernandez', 'Leonel Fernández', '2004-08-16', '2012-08-16'],
      ['medina', 'Danilo Medina', '2012-08-16', '2020-08-16'], ['abinader', 'Luis Abinader', '2020-08-16', null]],
    historicos: [['trujillo', 'Rafael Leónidas Trujillo'], ['balaguer', 'Joaquín Balaguer'], ['bosch', 'Juan Bosch'], ['duarte', 'Juan Pablo Duarte']],
    cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },
  EC: { base: ES, camara: 'Asamblea Nacional', miembro: ['asambleísta', 'asambleista', 'diputado', 'diputada', 'legislador', 'legisladora'],
    jefes: [['roldos', 'Jaime Roldós', '1979-08-10', '1981-05-24'], ['hurtado', 'Osvaldo Hurtado', '1981-05-24', '1984-08-10'],
      ['febres cordero', 'León Febres Cordero', '1984-08-10', '1988-08-10'], ['borja', 'Rodrigo Borja', '1988-08-10', '1992-08-10'],
      ['duran ballen', 'Sixto Durán Ballén', '1992-08-10', '1996-08-10'], ['bucaram', 'Abdalá Bucaram', '1996-08-10', '1997-02-06'],
      ['alarcon', 'Fabián Alarcón', '1997-02-06', '1998-08-10'], ['mahuad', 'Jamil Mahuad', '1998-08-10', '2000-01-21'],
      ['noboa', 'Gustavo Noboa', '2000-01-22', '2003-01-15'], ['gutierrez', 'Lucio Gutiérrez', '2003-01-15', '2005-04-20'],
      ['palacio', 'Alfredo Palacio', '2005-04-20', '2007-01-15'], ['correa', 'Rafael Correa', '2007-01-15', '2017-05-24'],
      ['moreno', 'Lenín Moreno', '2017-05-24', '2021-05-24'], ['lasso', 'Guillermo Lasso', '2021-05-24', '2023-11-23'],
      ['noboa', 'Daniel Noboa', '2023-11-23', null]], cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },
  ES: { base: ES, camara: 'Congreso de los Diputados', miembro: ['diputado', 'diputada'], parlamentario: true,
    // Jefes de Estado; los presidentes del Gobierno suelen tener escaño y se resuelven con la lista de oradores
    jefes: [['franco', 'Francisco Franco', '1936-10-01', '1975-11-20'], ['juan carlos|juan carlos i|juan carlos de borbon', 'Juan Carlos I', '1975-11-22', '2014-06-19'],
      ['felipe vi|felipe de borbon', 'Felipe VI', '2014-06-19', null]],
    jefesGobierno: [['suarez', 'Adolfo Suárez', '1976-07-03', '1981-02-26'], ['calvo sotelo', 'Leopoldo Calvo-Sotelo', '1981-02-26', '1982-12-02'],
      ['gonzalez', 'Felipe González', '1982-12-02', '1996-05-05'], ['aznar', 'José María Aznar', '1996-05-05', '2004-04-17'],
      ['zapatero', 'José Luis Rodríguez Zapatero', '2004-04-17', '2011-12-21'], ['rajoy', 'Mariano Rajoy', '2011-12-21', '2018-06-02'],
      ['sanchez', 'Pedro Sánchez', '2018-06-02', null]],
    historicos: [['franco', 'Francisco Franco'], ['primo de rivera', 'José Antonio Primo de Rivera'], ['azana', 'Manuel Azaña'],
      ['companys', 'Lluís Companys'], ['negrin', 'Juan Negrín'], ['largo caballero', 'Francisco Largo Caballero'],
      ['garcia lorca', 'Federico García Lorca'], ['lorca', 'Federico García Lorca'], ['machado', 'Antonio Machado'],
      ['queipo de llano', 'Gonzalo Queipo de Llano'], ['mola', 'Emilio Mola'], ['millan astray', 'José Millán-Astray'],
      ['calvo sotelo', 'José Calvo Sotelo'], ['carrero blanco', 'Luis Carrero Blanco'], ['ibarruri', 'Dolores Ibárruri'],
      ['pasionaria', 'Dolores Ibárruri'], ['alcala zamora', 'Niceto Alcalá-Zamora'], ['durruti', 'Buenaventura Durruti'],
      ['juan carlos', 'Juan Carlos I'], ['puigdemont', 'Carles Puigdemont'], ['otegi', 'Arnaldo Otegi'], ['torra', 'Quim Torra']],
    cargosSinNombre: [[/\b(el|al|del) (rey|Rey)\b(?! (de|del|emérito))/g, 'jefes'],
      [/\b(?:[Pp]residente|PRESIDENTE) del (?:[Gg]obierno|GOBIERNO)\b(?!\s+(?:de|del)\s+(?!España\b)[A-ZÁÉÍÓÚÑ]|\s+(?:vasco|canario|balear|foral|autonómico|regional|navarro|valenciano|gallego|catalán|andaluz|aragonés|riojano|cántabro|asturiano|murciano|extremeño|madrileño|de la Generalitat|de la Comunidad|de la Xunta|de la Junta))/g, 'jefesGobierno']] },
  GT: { base: ES, camara: 'Congreso de la República', miembro: ['diputado', 'diputada', 'representante', 'representantes'],
    jefes: [['arevalo', 'Juan José Arévalo', '1945-03-15', '1951-03-15'], ['arbenz', 'Jacobo Árbenz', '1951-03-15', '1954-06-27'],
      ['cerezo', 'Vinicio Cerezo', '1986-01-14', '1991-01-14'], ['serrano elias', 'Jorge Serrano Elías', '1991-01-14', '1993-06-01'],
      ['de leon carpio', 'Ramiro de León Carpio', '1993-06-06', '1996-01-14'], ['arzu', 'Álvaro Arzú', '1996-01-14', '2000-01-14'],
      ['portillo', 'Alfonso Portillo', '2000-01-14', '2004-01-14'], ['berger', 'Óscar Berger', '2004-01-14', '2008-01-14'],
      ['colom', 'Álvaro Colom', '2008-01-14', '2012-01-14'], ['perez molina', 'Otto Pérez Molina', '2012-01-14', '2015-09-03'],
      ['maldonado', 'Alejandro Maldonado', '2015-09-03', '2016-01-14'], ['morales', 'Jimmy Morales', '2016-01-14', '2020-01-14'],
      ['giammattei', 'Alejandro Giammattei', '2020-01-14', '2024-01-15'], ['arevalo', 'Bernardo Arévalo', '2024-01-15', null]],
    cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },
  MX: { base: ES, camara: 'Cámara de Diputados', miembro: ['diputado', 'diputada', 'dip', 'legislador', 'legisladora'], reeleccionConsecutiva: false,
    historicos: [['benito juarez', 'Benito Juárez'], ['francisco i madero', 'Francisco I. Madero'], ['lazaro cardenas', 'Lázaro Cárdenas'],
      ['emiliano zapata', 'Emiliano Zapata'], ['pancho villa', 'Francisco Villa']], cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']],
    jefes: [['lopez portillo', 'José López Portillo', '1976-12-01', '1982-12-01'], ['de la madrid', 'Miguel de la Madrid', '1982-12-01', '1988-12-01'],
      ['salinas', 'Carlos Salinas de Gortari', '1988-12-01', '1994-12-01'], ['zedillo', 'Ernesto Zedillo', '1994-12-01', '2000-12-01'],
      ['fox', 'Vicente Fox', '2000-12-01', '2006-12-01'], ['calderon', 'Felipe Calderón', '2006-12-01', '2012-12-01'],
      ['pena nieto', 'Enrique Peña Nieto', '2012-12-01', '2018-12-01'], ['lopez obrador|amlo', 'Andrés Manuel López Obrador', '2018-12-01', '2024-10-01'],
      ['sheinbaum', 'Claudia Sheinbaum', '2024-10-01', null]] },
  PA: { base: ES, camara: 'Asamblea Nacional', miembro: ['diputado', 'diputada', 'legislador', 'legisladora', 'suplente'],
    jefes: [['endara', 'Guillermo Endara', '1989-12-20', '1994-09-01'], ['perez balladares', 'Ernesto Pérez Balladares', '1994-09-01', '1999-09-01'], ['moscoso', 'Mireya Moscoso', '1999-09-01', '2004-09-01'],
      ['torrijos', 'Martín Torrijos', '2004-09-01', '2009-07-01'], ['martinelli', 'Ricardo Martinelli', '2009-07-01', '2014-07-01'],
      ['varela', 'Juan Carlos Varela', '2014-07-01', '2019-07-01'], ['cortizo', 'Laurentino Cortizo', '2019-07-01', '2024-07-01'],
      ['mulino', 'José Raúl Mulino', '2024-07-01', null]],
    historicos: [['omar torrijos', 'Omar Torrijos'], ['noriega', 'Manuel Antonio Noriega']], cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },
  PE: { base: ES, camara: 'Congreso de la República', miembro: ['congresista', 'congresistas', 'representante'],
    jefes: [['garcia', 'Alan García', '1985-07-28', '1990-07-28'], ['fujimori', 'Alberto Fujimori', '1990-07-28', '2000-11-22'], ['paniagua', 'Valentín Paniagua', '2000-11-22', '2001-07-28'],
      ['toledo', 'Alejandro Toledo', '2001-07-28', '2006-07-28'], ['garcia', 'Alan García', '2006-07-28', '2011-07-28'],
      ['humala', 'Ollanta Humala', '2011-07-28', '2016-07-28'], ['kuczynski', 'Pedro Pablo Kuczynski', '2016-07-28', '2018-03-23'],
      ['vizcarra', 'Martín Vizcarra', '2018-03-23', '2020-11-10'], ['merino', 'Manuel Merino', '2020-11-10', '2020-11-15'],
      ['sagasti', 'Francisco Sagasti', '2020-11-17', '2021-07-28'], ['castillo', 'Pedro Castillo', '2021-07-28', '2022-12-07'],
      ['boluarte', 'Dina Boluarte', '2022-12-07', '2025-10-10'], ['jeri', 'José Jerí', '2025-10-10', '2026-02-18'],
      ['balcazar', 'José María Balcázar', '2026-02-18', '2026-07-28'], ['fujimori|keiko fujimori|keiko', 'Keiko Fujimori', '2026-07-28', null]],
    historicos: [['haya de la torre', 'Víctor Raúl Haya de la Torre']], cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },
  PT: { base: PT, camara: 'Assembleia da República', miembro: ['deputado', 'deputada'], parlamentario: true, apellidoUltimo: true, gobiernoSinEscano: true,
    historicos: [['humberto delgado', 'Humberto Delgado'], ['salazar', 'António de Oliveira Salazar'], ['marcelo caetano', 'Marcelo Caetano']],
    cargosSinNombre: [[/(?<![\p{L}])(?:o|ao|do|pelo|Sr\.|Senhor)\s+Primeiro-Ministro(?![\p{L}])/gu, 'jefesGobierno'], [/(?<![\p{L}])(?:o|ao|do|pelo)\s+(?:Senhor\s+|Sr\.\s*)?Presidente da República(?![\p{L}])/gu, 'jefes']],
    jefes: [['costa gomes', 'Francisco da Costa Gomes', '1974-09-30', '1976-07-14'], ['eanes', 'António Ramalho Eanes', '1976-07-14', '1986-03-09'], ['soares', 'Mário Soares', '1986-03-09', '1996-03-09'],
      ['sampaio', 'Jorge Sampaio', '1996-03-09', '2006-03-09'], ['cavaco silva', 'Aníbal Cavaco Silva', '2006-03-09', '2016-03-09'],
      ['marcelo|rebelo de sousa', 'Marcelo Rebelo de Sousa', '2016-03-09', '2026-03-09'], ['seguro', 'António José Seguro', '2026-03-09', null]],
    // Primeiros-ministros: no pueden ser diputados mientras gobiernan (el diputado que entra en el Gobierno suspende el mandato)
    jefesGobierno: [['pinheiro de azevedo', 'José Pinheiro de Azevedo', '1975-09-19', '1976-06-23'], ['soares', 'Mário Soares', '1976-07-23', '1978-08-28'],
      ['nobre da costa', 'Alfredo Nobre da Costa', '1978-08-28', '1978-11-22'], ['mota pinto', 'Carlos Mota Pinto', '1978-11-22', '1979-08-01'],
      ['pintasilgo', 'Maria de Lourdes Pintasilgo', '1979-08-01', '1980-01-03'], ['sa carneiro', 'Francisco Sá Carneiro', '1980-01-03', '1980-12-04'],
      ['freitas do amaral', 'Diogo Freitas do Amaral', '1980-12-04', '1981-01-09'], ['balsemao|pinto balsemao', 'Francisco Pinto Balsemão', '1981-01-09', '1983-06-09'],
      ['soares', 'Mário Soares', '1983-06-09', '1985-11-06'], ['cavaco silva|cavaco', 'Aníbal Cavaco Silva', '1985-11-06', '1995-10-28'],
      ['guterres', 'António Guterres', '1995-10-28', '2002-04-06'], ['durao barroso|barroso', 'José Manuel Durão Barroso', '2002-04-06', '2004-07-17'],
      ['santana lopes', 'Pedro Santana Lopes', '2004-07-17', '2005-03-12'], ['socrates', 'José Sócrates', '2005-03-12', '2011-06-21'],
      ['passos coelho', 'Pedro Passos Coelho', '2011-06-21', '2015-11-26'], ['antonio costa|costa', 'António Costa', '2015-11-26', '2024-04-02'],
      ['montenegro', 'Luís Montenegro', '2024-04-02', null]] },
  PY: { base: ES, camara: 'Cámara de Diputados', miembro: ['diputado', 'diputada', 'dip', 'preopinante'],
    jefes: [['stroessner', 'Alfredo Stroessner', '1954-08-15', '1989-02-03'], ['rodriguez', 'Andrés Rodríguez', '1989-02-03', '1993-08-15'], ['wasmosy', 'Juan Carlos Wasmosy', '1993-08-15', '1998-08-15'],
      ['cubas', 'Raúl Cubas', '1998-08-15', '1999-03-28'], ['gonzalez macchi', 'Luis González Macchi', '1999-03-28', '2003-08-15'],
      ['duarte frutos', 'Nicanor Duarte Frutos', '2003-08-15', '2008-08-15'], ['lugo', 'Fernando Lugo', '2008-08-15', '2012-06-22'],
      ['franco', 'Federico Franco', '2012-06-22', '2013-08-15'], ['cartes', 'Horacio Cartes', '2013-08-15', '2018-08-15'],
      ['abdo', 'Mario Abdo Benítez', '2018-08-15', '2023-08-15'], ['pena', 'Santiago Peña', '2023-08-15', null]],
    historicos: [['stroessner', 'Alfredo Stroessner'], ['jose felix estigarribia', 'José Félix Estigarribia']], cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },
  SV: { base: ES, camara: 'Asamblea Legislativa', miembro: ['diputado', 'diputada', 'suplente', 'sustituto', 'sustituta'],
    jefes: [['calderon sol', 'Armando Calderón Sol', '1994-06-01', '1999-06-01'], ['flores', 'Francisco Flores', '1999-06-01', '2004-06-01'],
      ['saca', 'Antonio Saca', '2004-06-01', '2009-06-01'], ['funes', 'Mauricio Funes', '2009-06-01', '2014-06-01'],
      ['sanchez ceren', 'Salvador Sánchez Cerén', '2014-06-01', '2019-06-01'], ['bukele', 'Nayib Bukele', '2019-06-01', null]],
    historicos: [['romero', 'Óscar Arnulfo Romero']], cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },
  UY: { base: ES, camara: 'Cámara de Representantes', miembro: ['representante', 'representantes', 'diputado', 'diputada'],
    jefes: [['sanguinetti', 'Julio María Sanguinetti', '1985-03-01', '1990-03-01'], ['lacalle', 'Luis Alberto Lacalle', '1990-03-01', '1995-03-01'],
      ['sanguinetti', 'Julio María Sanguinetti', '1995-03-01', '2000-03-01'], ['batlle', 'Jorge Batlle', '2000-03-01', '2005-03-01'],
      ['vazquez', 'Tabaré Vázquez', '2005-03-01', '2010-03-01'], ['mujica', 'José Mujica', '2010-03-01', '2015-03-01'],
      ['vazquez', 'Tabaré Vázquez', '2015-03-01', '2020-03-01'], ['lacalle pou', 'Luis Lacalle Pou', '2020-03-01', '2025-03-01'],
      ['orsi', 'Yamandú Orsi', '2025-03-01', null]],
    historicos: [['batlle y ordonez', 'José Batlle y Ordóñez'], ['pepe batlle', 'José Batlle y Ordóñez'], ['artigas', 'José Gervasio Artigas']],
    cargosSinNombre: [[/\b(?:el|al|del)\s+(?:señor\s+)?[Pp]residente de la [Rr]epública\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ])/g, 'jefes']] },

  // Cortes de la Segunda República española (1931-1939, más las sesiones del exilio hasta noviembre de 1945). No es un
  // parlamento de ParlaIbero: es el corpus de 2REP_Explorer, que comparte el detector de menciones. Su registro lo escribe
  // tools/menciones_2rep.cjs, no el de los dieciséis países, así que esta entrada no toca datos/menciones_parlaibero.json.
  // Fechas contrastadas el 20 de septiembre de 2026 con Wikidata (P39 con sus cualificadores: Q16020745 presidente del
  // Consejo de Ministros, Q33753220 presidente de la Segunda República, Q43118787 presidente de las Cortes) y con el propio
  // Diario: los 630 turnos cuyo orador es «Sr. Presidente del CONSEJO DE MINISTROS» forman trece tramos que coinciden uno a
  // uno con la tabla. Convención de siempre: «hasta» es la toma de posesión del sucesor (fin exclusivo), así que se cierran
  // los huecos entre la dimisión de un gobierno y el nombramiento del siguiente.
  '2REP': { base: ES, camara: 'Cortes de la República', miembro: ['diputado', 'diputada'], parlamentario: true,
    // La presidencia de la República nace con la Constitución (Alcalá-Zamora, elegido el 10-12-1931). Antes, la jefatura del
    // Estado la ejerce el presidente del Gobierno provisional, que ya está en jefesGobierno: dejar vacía la tabla hasta esa
    // fecha es lo que se quiere, porque así «el Jefe del Estado» de los debates constituyentes de 1931, que es genérico, no
    // se atribuye a nadie.
    jefes: [['alcala zamora', 'Niceto Alcalá-Zamora', '1931-12-10', '1936-04-07'],
      ['martinez barrio', 'Diego Martínez Barrio', '1936-04-07', '1936-05-10'],   // interino, como presidente de las Cortes
      ['azana', 'Manuel Azaña', '1936-05-10', '1939-03-03'],
      ['martinez barrio', 'Diego Martínez Barrio', '1945-08-17', null]],          // interino en el exilio; el corpus tiene esa sesión
    jefesGobierno: [['alcala zamora', 'Niceto Alcalá-Zamora', '1931-04-14', '1931-10-14'],
      ['azana', 'Manuel Azaña', '1931-10-14', '1933-09-12'], ['lerroux', 'Alejandro Lerroux', '1933-09-12', '1933-10-08'],
      ['martinez barrio', 'Diego Martínez Barrio', '1933-10-08', '1933-12-16'],
      ['lerroux', 'Alejandro Lerroux', '1933-12-16', '1934-04-28'], ['samper', 'Ricardo Samper', '1934-04-28', '1934-10-04'],
      ['lerroux', 'Alejandro Lerroux', '1934-10-04', '1935-09-25'],
      ['chapaprieta', 'Joaquín Chapaprieta', '1935-09-25', '1935-12-14'],
      ['portela|portela valladares', 'Manuel Portela Valladares', '1935-12-14', '1936-02-19'],
      ['azana', 'Manuel Azaña', '1936-02-19', '1936-05-10'],
      ['casares quiroga|casares', 'Santiago Casares Quiroga', '1936-05-10', '1936-07-18'],
      ['martinez barrio', 'Diego Martínez Barrio', '1936-07-18', '1936-07-19'],   // unas horas, para intentar un gobierno de conciliación
      ['giral', 'José Giral', '1936-07-19', '1936-09-04'],
      ['largo caballero', 'Francisco Largo Caballero', '1936-09-04', '1937-05-17'],
      ['negrin', 'Juan Negrín', '1937-05-17', '1945-08-21'],   // en España hasta el 5-3-1939 y luego en el exilio, hasta dimitir ante las Cortes
      ['giral', 'José Giral', '1945-08-21', null]],            // gobierno de la República en el exilio (las sesiones de noviembre de 1945)
    // Presidencia de las Cortes. El detector solo cruza jefes y jefesGobierno, así que las 2.211 menciones de «el presidente
    // de la Cámara» y «el presidente de las Cortes» quedan de momento sin atribuir: la tabla está hecha para cuando las cruce.
    presidentesCamara: [['besteiro|julian besteiro', 'Julián Besteiro', '1931-07-14', '1933-12-08'],
      ['alba|santiago alba', 'Santiago Alba', '1933-12-08', '1936-03-16'],
      ['martinez barrio', 'Diego Martínez Barrio', '1936-03-16', null]],   // sigue presidiendo las Cortes en el exilio
    // Personas nombradas en el Diario que no tienen escaño: las del padrón (Azaña, Lerroux, Prieto, Gil Robles, Calvo Sotelo,
    // Companys, Macià, Unamuno, Ortega y Gasset, Besteiro, Cambó…) se resuelven solas con la lista de oradores y no entran
    // aquí. Se descartan las formas ambiguas: «Franco» son casi siempre los diputados Ramón y Gabriel; «Primo de Rivera»
    // alterna entre el dictador y José Antonio, diputado en 1933-1935, y solo se recoge la forma larga; «Dato» y «Costa» son
    // palabras comunes y van con el nombre de pila. Entre paréntesis, las apariciones en el corpus.
    historicos: [['antonio maura', 'Antonio Maura'],                 // 288
      ['pi y margall', 'Francisco Pi y Margall'],                    // 243
      ['nombela', 'Antonio Nombela'],                                // 224, el asunto Nombela de 1935
      ['romanones', 'Conde de Romanones'],                           // 215
      ['galan', 'Fermín Galán'], ['fermin galan', 'Fermín Galán'],   // 194 + 26, el capitán de Jaca
      ['marx', 'Karl Marx'],                                         // 150
      ['canalejas', 'José Canalejas'],                               // 141
      ['canovas', 'Antonio Cánovas del Castillo'],                   // 140
      ['mussolini', 'Benito Mussolini'],                             // 139
      ['martinez anido', 'Severiano Martínez Anido'],                // 130
      ['strauss', 'Daniel Strauss'],                                 // 128, el estraperlo
      ['garcia hernandez', 'Ángel García Hernández'],                // 128, el otro capitán de Jaca
      ['joaquin costa', 'Joaquín Costa'],                            // 121
      ['castelar', 'Emilio Castelar'],                               // 119
      ['sagasta', 'Práxedes Mateo Sagasta'],                         // 108
      ['pablo iglesias', 'Pablo Iglesias'],                          // 96
      ['poincare', 'Raymond Poincaré'],                              // 79
      ['batet', 'Domingo Batet'],                                    // 75
      ['lopez ochoa', 'Eduardo López Ochoa'],                        // 71
      ['alfonso xiii', 'Alfonso XIII'],                              // 69
      ['hitler', 'Adolf Hitler'],                                    // 62
      ['lenin', 'Lenin'],                                            // 61
      ['briand', 'Aristide Briand'],                                 // 59
      ['roosevelt', 'Franklin D. Roosevelt'],                        // 38
      ['wilson', 'Woodrow Wilson'],                                  // 21
      ['stalin', 'Stalin'],                                          // 17
      ['goded', 'Manuel Goded'],                                     // 16
      ['mola', 'Emilio Mola'],                                       // 15
      ['blum', 'Léon Blum'],                                         // 15
      ['kerensky', 'Aleksandr Kérenski'],                            // 11
      ['eduardo dato', 'Eduardo Dato'],                              // 8
      ['miguel primo de rivera', 'Miguel Primo de Rivera'],          // 8
      ['queipo de llano', 'Gonzalo Queipo de Llano']],               // 6
    // Cargos sin nombre, probados contra el texto del Diario: el tratamiento va entre el artículo y el cargo («el Sr.
    // Presidente del Consejo de Ministros», 4.588 casos). La guardia del Consejo deja fuera «Presidente del Consejo de
    // Administración» y «de Estado»; la de la República, los presidentes extranjeros.
    cargosSinNombre: [
      [/\b(?:[Ee]l|[Aa]l|[Dd]el)\s+(?:Sr\.?\s*|[Ss]eñor\s+)?[Pp]residente del [Cc]onsejo(?:\s+de\s+[Mm]inistros|(?!\s+de\s+\S))/g, 'jefesGobierno'],
      [/\b(?:[Ee]l|[Aa]l|[Dd]el)\s+(?:Sr\.?\s*|[Ss]eñor\s+)?[Pp]residente del [Gg]obierno(?:\s+provisional)?(?:\s+de la Rep[uú]blica)?\b(?!\s+de\s+(?:la\s+)?[A-ZÁÉÍÓÚÑ])/g, 'jefesGobierno'],
      [/\b(?:[Ee]l|[Aa]l|[Dd]el)\s+(?:Sr\.?\s*|[Ss]eñor\s+)?[Pp]residente de la Rep[uú]blica\b(?!\s+(?:de|del)\s+[A-ZÁÉÍÓÚÑ]|\s+(?:francesa|alemana|argentina|portuguesa|austriaca|checoslovaca|polaca|mexicana|cubana|chilena|italiana|turca|china))/g, 'jefes'],
      [/\b(?:[Ee]l|[Aa]l|[Dd]el)\s+[Jj]efe del Estado\b(?!\s+(?:espa|de\s+[A-ZÁÉÍÓÚÑ]))/g, 'jefes']] },
};

/** Configuración de un país: la de su lengua más la suya. */
module.exports = function configuracion(pais) {
  const p = PAISES[pais];
  if (!p) throw new Error(`País desconocido: ${pais}`);
  return Object.assign({}, p.base, p, { pais, base: undefined, historicos: p.historicos || [], jefesGobierno: p.jefesGobierno || [],
    cargosSinNombre: p.cargosSinNombre || [], alias: p.alias || {} });
};
module.exports.PAISES = Object.keys(PAISES);

/* ===== src/engine/py/re.js ===== */
// 2REP_Standalone · src/engine/py/re.js
//
// R2.py.re: el módulo `re` de Python 3.12 (patrones str) sobre RegExp de JS con el flag 'v'
// (Node 22, Chrome ≥ 112, Safari ≥ 17, Firefox ≥ 116).
//
// Cómo funciona:
// 1. El patrón se analiza con un port de re/_parser.py: el árbol es el mismo que el de Python
//    (mismas optimizaciones de prefijo común y de alternativas de un carácter, mismos errores).
// 2. El árbol se traduce a una RegExp 'v' con la semántica de sre:
//    - \w, \d: \p{L}\p{N}_ y \p{Nd} del motor corregidos, la primera vez que se usan, contra las
//      tablas de Python 3.12 (Unicode 15.0) embebidas abajo: se restan los caracteres que el motor
//      clasifica como letra o cifra y Python no (Unicode posterior) y se suman los que falten.
//      \s es el conjunto explícito de str.isspace(). \W \D \S son sus complementos.
//    - \b y \B con miradas atrás y adelante sobre ese \w (en una cadena vacía nunca casan); junto a
//      un átomo que empieza o acaba siempre en carácter de palabra (o nunca) basta una sola mirada.
//    - '.' sin DOTALL = [^\n]; ^ y \A = ^ de JS sin flag 'm' (equivale a (?<![\s\S]));
//      $ = (?=\n?(?![\s\S])); \Z = (?![\s\S]);
//      con MULTILINE, ^ = (?<![^\n]) y $ = (?![^\n]) (solo \n separa líneas, como en sre).
//    - IGNORECASE sin el flag 'i' de JS: cada literal o clase se convierte en el conjunto exacto de
//      caracteres que sre acepta (minúscula simple de sre, _EXTRA_CASES, rangos fuera del BMP).
//    - (?P<n>…), (?P=n), \1, grupos con flags (?i:…) (?-s:…), (?>…) y cuantificadores posesivos
//      (con un grupo oculto: (?=(X))\k).
// 3. Los envoltorios reproducen _sre: match/search/fullmatch con pos y endpos (se casa sobre
//    string[:endpos]; las miradas atrás ven lo anterior a pos y ^ solo casa al principio real),
//    finditer/findall/sub/subn/split con el avance de sre tras una coincidencia vacía (la siguiente
//    búsqueda empieza en el mismo sitio pero no puede volver a dar una coincidencia vacía allí).
//
// No soportado (lanza PyReError con noSoportado = true): grupos condicionales (?(1)…), \N{nombre},
// referencias a grupos que pueden no participar o con IGNORECASE, capturas dentro de una
// repetición que pueden no participar en su última vuelta (sre conserva el valor anterior; JS lo
// borra) o cuyo cuerpo puede casar vacío, y repeticiones voraces cuyo cuerpo prefiere casar vacío
// antes que consumir ((?:|x)+, (?:x*?)+: sre acepta esa vuelta vacía y RegExp no). Ningún patrón del
// backend usa esas construcciones (tools/gen_regex_manifest.py).
// Una repetición posesiva compuesta casa cada vuelta de forma atómica, como sre.
// Si el motor agota la pila o la memoria (Firefox: InternalError «too much recursion»), se lanza
// PyReError con motorAgotado = true y tipo 'RecursionError'.
//
// Posiciones: índices de la cadena JS (unidades UTF-16). Coinciden con los de Python mientras no
// haya caracteres fuera del BMP; el corpus no tiene ninguno. pos no debe caer dentro de un par
// sustituto. Con endpos < pos, search/fullmatch/finditer/findall no casan y match solo casa vacía en pos, como _sre.
// Match.lastindex es el último grupo que sre cerró (el de cierre más tardío en el patrón), no el que acaba más tarde.
(function (R2) {
  'use strict';
  R2.py = R2.py || {};

  // <tablas> Generado por standalone/parity/oracle/dump_units_re.py --tablas-js --actualizar
  // (Python 3.12.7, Unicode 15.0.0). No editar a mano.
  const TABLAS = {
    python: '3.12.7',
    unicode: '15.0.0',
    W: '1c,9,7,p,4,0,1,p,1b,0,7,1,1,0,3,1,1,2,1,m,1,u,1,cp,4,b,e,4,7,0,1,0,3l,4,1,1,2,3,1,0,6,0,1,2,1,0,1,j,1,2a,1,3u,8,4l,1,11,2,0,6,14,1z,q,4,3,19,16,l,9,4,1,1,2q,1,0,f,1,7,e,2,0,g,0,1,t,t,2g,b,0,e,16,9,1,4,0,5,l,4,0,9,0,3,0,n,o,7,a,5,n,1,5,h,15,1m,1h,3,0,i,0,7,9,4,9,1,f,4,7,2,1,2,l,1,6,1,0,3,3,3,0,g,0,d,1,1,2,4,b,2,5,2,0,8,5,4,1,2,l,1,6,1,1,1,1,1,1,v,3,1,0,7,9,2,2,g,8,1,2,1,l,1,6,1,1,1,4,3,0,i,0,f,1,4,9,9,0,b,7,2,1,2,l,1,6,1,1,1,4,3,0,u,1,1,2,4,9,1,6,b,0,1,5,3,2,1,3,3,1,1,0,1,1,3,1,3,2,3,b,m,0,l,c,i,7,1,2,1,m,1,f,3,0,q,2,2,0,2,1,4,9,8,6,1,0,4,7,1,2,1,m,1,9,1,4,3,0,v,1,1,1,4,9,1,1,h,8,1,2,1,14,2,0,g,0,5,2,1,9,4,i,1,5,5,h,3,n,1,8,1,0,2,6,v,9,h,1b,1,1,c,6,9,9,13,1,1,0,1,4,1,n,1,0,1,9,1,1,9,0,2,4,1,0,9,9,2,3,w,0,v,j,c,7,1,z,r,4,37,16,k,a,6,5,4,3,3,0,3,1,7,2,4,c,c,0,1,9,6,11,1,0,5,0,2,16,1,98,1,3,2,6,1,0,1,3,2,14,1,3,2,w,1,3,2,6,1,0,1,3,2,e,1,1k,1,3,2,1u,e,j,3,f,g,2d,2,5,3,h7,2,g,1,p,5,22,3,a,7,h,d,i,e,h,e,c,1,2,f,1f,z,0,4,0,3,9,6,9,m,9,6,2g,7,4,2,x,1,0,5,1x,a,u,13,13,2,4,b,17,4,p,6,a,11,m,9,1g,17,9,6,9,d,0,2l,1a,h,7,3,9,15,t,d,1j,q,z,s,9,3,1c,2,8,7,16,2,2,15,3,1,5,1,1,3,0,5,5b,1s,7p,2,5,2,11,2,5,2,7,1,0,1,0,1,0,1,u,2,1g,1,6,1,0,3,2,1,6,3,3,2,5,4,c,5,2,1,6,37,1,2,5,5,a,6,c,2t,0,4,0,2,9,1,0,3,4,6,0,1,0,1,0,1,3,1,a,2,3,5,4,4,0,1,1l,k6,1n,26,l,hi,t,vg,6c,6,3,3,1,9,0,2,11,1,0,5,0,2,1j,7,0,g,m,9,6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,28,0,d1,2,p,8,7,4,2,4,4,2d,6,2,1,2h,1,3,5,16,1,2l,3,3,a,v,1c,f,w,9,u,7,1,e,w,9,13,e,8w,533,1s,h3g,1v,19,2,7g,3,r,k,1a,g,u,2,27,13,8,2,2u,2,1r,5,1,1,0,1,4,o,f,1,2,1,3,1,m,d,5,a,1f,e,1d,s,9,o,5,3,0,1,1,1,11,a,m,p,s,7,1a,s,a,6,4,1,o,1,14,n,2,1,7,4,9,6,m,3,0,3,1d,1,0,3,1,2,4,2,0,1,0,o,2,2,a,7,2,c,5,2,5,2,5,9,6,1,6,1,16,1,d,6,36,d,9,6,8mb,c,m,4,1c,6is,a5,2,2x,12,6,c,4,5,0,1,9,1,c,1,4,1,0,1,1,1,1,1,2z,x,a2,i,1r,2,1h,14,b,38,4,1,3q,j,9,7,p,6,p,b,2g,3,5,2,5,2,5,2,2,z,b,1,p,1,i,1,1,1,e,2,d,y,3e,c,18,c,1k,h,1,6s,s,3,1c,g,q,4,z,9,t,5,11,a,t,2,z,4,7,1,4,16,4d,2,9,6,z,4,z,4,13,8,1f,c,a,1,e,1,6,1,1,1,a,1,e,1,6,1,1,1v,8m,9,l,a,7,o,5,1,15,1,8,1x,5,2,0,1,17,1,1,3,0,2,m,2,u,2,11,8,8,1c,i,1,1,5,w,4,p,1y,1j,4,j,2,1a,f,3,1,2,1,s,a,8,n,u,1,v,w,7,1,r,6,4,g,1h,a,l,2,q,5,p,n,6,28,20,1j,1e,d,1e,7,15,c,9,86,u,1,15,6,1,26,13,8,l,b,3,r,h,1a,r,k,m,c,1g,q,t,1,1,2,0,d,18,w,o,7,9,9,z,f,9,4,0,2,0,8,y,3,0,c,1b,e,3,b,a,1,0,4,j,b,h,1,o,j,1,1r,6,1,0,1,3,1,e,1,9,7,1a,h,9,b,7,2,1,2,l,1,6,1,1,1,4,3,0,i,0,c,4,4e,1g,i,3,5,9,5,2,u,1b,k,1,1,0,8,9,4m,1a,15,3,10,1b,k,0,b,9,12,16,d,0,7,9,1i,q,l,b,4,6,55,17,38,2a,c,7,2,0,2,7,1,1,1,n,f,0,1,0,e,9,1y,7,2,12,g,0,1,0,s,0,a,13,7,0,l,0,b,19,j,0,i,20,7b,8,1,10,h,0,f,s,5,t,34,6,1,1,1,11,l,0,9,9,6,5,1,1,1,v,e,0,7,9,8m,i,f,0,1,c,1,x,s,9,2e,0,f,k,17,pl,2u,32,h,5f,218,2o,f,tr,h,5,33t,g6,6nt,fs,7,u,1,9,6,26,1,9,6,t,i,1b,g,3,c,9,1,6,1,k,5,i,j4,2e,2x,22,5,0,1u,c,1s,1,1,0,s,4qf,8,yd,16,8,6w7,3,1,6,1,1,1,82,f,0,t,2,2,0,e,3,8,az,1s4,2y,5,c,3,8,7,9,4di,j,c,j,30,o,3r,2c,1,1y,1,1,2,0,2,1,2,3,1,b,1,0,1,6,1,1s,1,3,2,7,1,6,1,r,1,3,1,4,1,0,3,6,1,9f,2,o,1,o,1,u,1,o,1,u,1,o,1,u,1,o,1,u,1,o,1,7,2,1d,1ds,u,6,5,79,1p,42,18,a,6,2,9,4,0,8x,t,i,17,4,9,d2,r,4,9,km,6,1,3,1,1,1,e,1,5g,2,8,1c,1v,7,0,4,9,lz,1m,1,2,1,3,24,18,1,e,5e,3,1,q,1,1,1,0,2,0,1,9,1,3,1,0,1,0,6,0,4,0,1,0,1,0,1,2,1,1,1,0,2,0,1,0,1,0,1,0,1,0,1,1,1,0,2,3,1,6,1,3,1,3,1,0,1,9,1,g,5,2,1,4,1,g,g4,c,25f,9,sm,wyn,w,37d,6,65,2,4g1,e,5rk,2e7,f1,15u,3t6,5,38f',
    D: '1c,9,17q,9,3q,9,5i,9,bg,9,3a,9,3a,9,3a,9,3a,9,3a,9,3a,9,3a,9,3a,9,3a,9,2o,9,3a,9,1y,9,7q,9,1y,9,1fq,9,12,9,8c,9,3k,9,4m,9,6,9,52,9,2e,9,3q,9,6,9,r7q,9,iu,9,12,9,5i,9,m,9,2e,9,ba,9,geu,9,13a,9,1om,9,mk,9,3k,9,1o,9,40,9,7q,9,9i,9,3a,9,ae,9,2u,9,2u,9,bq,9,2u,9,l2,9,6u,9,1y,9,bq,9,eti,9,2e,9,3q,9,lf8,1d,1ts,9,bq,9,dy,9,uu,9,3o6,9',
    S: '9,4,e,4,2s,0,q,0,4bj,0,1vj,a,t,1,5,0,1b,0,334,0',
    LOWER: '1t,q,w,1;3j,n,w,1;o,7,w,1;14,o,1,2;1c,1,-5j,1;2,3,1,2;7,8,1,2;h,n,1,2;1a,1,-3d,1;1,3,1,2;8,1,5u,1;1,2,1,2;4,1,5q,1;1,1,1,1;2,2,5p,1;2,1,1,1;3,1,27,1;1,1,5m,1;1,1,5n,1;1,1,1,1;2,1,5p,1;1,1,5r,1;2,1,5v,1;1,1,5t,1;1,1,1,1;4,1,5v,1;1,1,5x,1;2,1,5y,1;1,3,1,2;6,1,62,1;1,1,1,1;2,1,62,1;3,1,1,1;2,1,62,1;1,1,1,1;2,2,61,1;2,2,1,2;4,1,63,1;1,1,1,1;4,1,1,1;8,1,2,1;1,1,1,1;2,1,2,1;1,1,1,1;2,1,2,1;1,9,1,2;j,9,1,2;j,1,2,1;1,2,1,2;4,1,-2p,1;1,1,-1k,1;1,k,1,2;14,1,-3m,1;2,9,1,2;o,1,8bv,1;1,1,1,1;2,1,-4j,1;1,1,8bs,1;3,1,1,1;2,1,-5f,1;1,1,1x,1;1,1,1z,1;1,5,1,2;8a,2,1,2;6,1,1,1;9,1,38,1;7,1,12,1;2,3,11,1;4,1,1s,1;2,2,1r,1;3,h,w,1;i,9,w,1;18,1,8,1;9,c,1,2;s,1,-1o,1;3,1,1,1;2,1,-7,1;1,1,1,1;3,3,-3m,1;3,g,28,1;g,w,w,1;28,h,1,2;16,r,1,2;1i,1,f,1;1,7,1,2;f,1c,1,2;2p,12,1c,1;29b,12,5ls,1;13,1,5ls,1;6,1,5ls,1;k3,28,tzk,1;28,6,8,1;1pc,17,-2bk,1;19,3,-2bk,1;8z,23,1,2;4e,1,-5vj,1;2,1c,1,2;2w,8,-8,1;g,6,-8,1;g,8,-8,1;g,8,-8,1;g,6,-8,1;h,4,-8,2;f,8,-8,1;w,8,-8,1;g,8,-8,1;g,8,-8,1;g,2,-8,1;2,2,-22,1;2,1,-9,1;c,4,-2e,1;4,1,-9,1;c,2,-8,1;2,2,-2s,1;e,2,-8,1;2,2,-34,1;2,1,-7,1;c,2,-3k,1;2,2,-3i,1;2,1,-9,1;8a,1,-5st,1;4,1,-6gv,1;1,1,-6di,1;7,1,s,1;1a,g,g,1;z,1,1,1;mr,q,q,1;1fu,1c,1c,1;2o,1,1,1;2,1,-8af,1;1,1,-2xy,1;1,1,-89z,1;3,3,1,2;6,1,-8bg,1;1,1,-8al,1;1,1,-8bj,1;1,1,-8bi,1;2,1,1,1;3,1,1,1;9,2,-8cf,1;2,1e,1,2;2z,2,1,2;7,1,1,1;nym,n,1,2;1s,e,1,2;4i,7,1,2;g,v,1,2;1z,2,1,2;4,1,-r9g,1;1,5,1,2;d,1,1,1;2,1,-wmg,1;3,2,1,2;6,a,1,2;k,1,-wn8,1;1,1,-wnj,1;1,1,-wnf,1;1,1,-wn5,1;1,1,-wn8,1;2,1,-wlu,1;1,1,-wmi,1;1,1,-wlx,1;1,1,ps,1;1,8,1,2;g,1,-1c,1;1,1,-wn7,1;1,1,-raw,1;1,2,1,2;9,1,1,1;6,2,1,2;v,1,1,1;h7w,q,w,1;yn,14,14,1;4w,10,14,1;5c,b,13,1;c,f,13,1;g,7,13,1;8,2,13,1;1d8,1f,1s,1;2e8,w,w,1;gww,w,w,1;o8w,y,y,1',
    UPPER: '2p,q,-w,1;2c,1,kn,1;16,1,-3w,1;1,n,-w,1;o,7,-w,1;7,1,3d,1;2,o,-1,2;1c,1,-6g,1;2,3,-1,2;7,8,-1,2;f,1,ab,1;2,n,-1,2;1b,3,-1,2;5,1,-8c,1;1,1,5f,1;3,2,-1,2;5,1,-1,1;4,1,-1,1;6,1,-1,1;3,1,2p,1;4,1,-1,1;1,1,4j,1;4,1,3m,1;3,3,-1,2;7,1,-1,1;5,1,-1,1;3,1,-1,1;4,2,-1,2;5,1,-1,1;4,1,-1,1;2,1,1k,1;6,1,-1,1;1,1,-2,1;2,1,-1,1;1,1,-2,1;2,1,-1,1;1,1,-2,1;2,8,-1,2;f,1,-27,1;2,9,-1,2;h,1,-bq,1;2,1,-1,1;1,1,-2,1;2,1,-1,1;4,k,-1,2;16,9,-1,2;p,1,-1,1;3,2,8cf,1;3,1,-1,1;5,5,-1,2;9,1,8bj,1;1,1,8bg,1;1,1,8bi,1;1,1,-5u,1;1,1,-5q,1;2,2,-5p,1;3,1,-5m,1;2,1,-5n,1;1,1,wnj,1;4,1,-5p,1;1,1,wnf,1;2,1,-5r,1;2,1,wmg,1;1,1,wn8,1;2,1,-5t,1;1,1,-5v,1;1,1,wn8,1;1,1,8af,1;1,1,wn5,1;3,1,-5v,1;2,1,8al,1;1,1,-5x,1;3,1,-5y,1;8,1,89z,1;3,1,-62,1;2,1,wn7,1;1,1,-62,1;4,1,wmi,1;1,1,-62,1;1,1,-1x,1;1,2,-61,1;2,1,-1z,1;6,1,-63,1;b,1,wlx,1;1,1,wlu,1;4n,1,2c,1;18,2,-1,2;6,1,-1,1;4,3,3m,1;l,1,9,1;s,1,-12,1;1,3,-11,1;3,1,-b,1;1,h,-w,1;h,1,-v,1;1,9,-w,1;9,1,-1s,1;1,2,-1r,1;3,1,-1q,1;1,1,-1l,1;4,1,-1b,1;1,1,-1i,1;1,1,-8,1;2,c,-1,2;n,1,-2e,1;1,1,-28,1;1,1,7,1;1,1,-38,1;2,1,-2o,1;3,1,-1,1;3,1,-1,1;1h,w,-w,1;w,g,-28,1;h,h,-1,2;16,r,-1,2;1j,7,-1,2;d,1,-f,1;2,1c,-1,2;40,12,-1c,1;12,1,-2a,1;289,17,2bk,1;19,3,2bk,1;l7,6,-8,1;1oo,1,-4tq,1;1,1,-4tp,1;1,1,-4tg,1;1,2,-4te,1;2,1,-4tf,1;1,1,-4t8,1;1,1,-4rp,1;1,1,r7m,1;6p,1,r9g,1;4,1,2xy,1;h,1,raw,1;37,23,-1,2;45,1,-5zi,1;1,1,-5z7,1;1,1,-5z5,1;1,1,-5z4,1;1,1,-5zt,1;1,1,-1n,1;6,1c,-1,2;2n,8,8,1;g,6,8,1;g,8,8,1;g,8,8,1;g,6,8,1;g,1,-5gr,1;1,1,8,1;1,1,-5gt,1;1,1,8,1;1,1,-5gv,1;1,1,8,1;1,1,-5gx,1;1,1,8,1;9,8,8,1;g,2,22,1;2,4,2e,1;4,2,2s,1;2,2,3k,1;2,2,34,1;2,2,3i,1;4,8,-3c,1;8,8,-3k,1;8,8,-2w,1;8,8,-34,1;8,8,-1k,1;8,8,-1s,1;8,3,8,1;3,1,-5k2,1;1,1,-5ke,1;2,1,-5k5,1;1,1,-5k6,1;5,1,-5kb,1;2,1,-5k5,1;4,1,8,1;1,1,-5kc,1;1,1,-5kr,1;2,1,-5kf,1;1,1,-5kg,1;5,1,-5kl,1;4,2,8,1;2,1,-5kp,1;1,1,-5kq,1;3,1,-5kt,1;1,1,-5ku,1;9,2,8,1;2,1,-5kt,1;1,1,-5ku,1;1,1,-5kz,1;1,1,7,1;1,1,-5kx,1;1,1,-5ky,1;b,1,8,1;1,1,-5l6,1;1,1,-5lx,1;2,1,-5l9,1;1,1,-5la,1;5,1,-5lf,1;9e,1,-s,1;y,g,-g,1;k,1,-1,1;ng,q,-q,1;1gg,1c,-1c,1;1d,1,-1,1;4,1,-8bv,1;1,1,-8bs,1;2,3,-1,2;b,1,-1,1;3,1,-1,1;b,1e,-1,2;2z,2,-1,2;7,1,-1,1;d,12,-5ls,1;13,1,-5ls,1;6,1,-5ls,1;nx0,n,-1,2;1s,e,-1,2;4i,7,-1,2;g,v,-1,2;1z,2,-1,2;5,5,-1,2;d,1,-1,1;5,2,-1,2;3,1,1c,1;3,a,-1,2;u,8,-1,2;j,2,-1,2;9,1,-1,1;6,2,-1,2;v,1,-1,1;nx,1,-ps,1;t,28,-tzk,1;fps,1,-1diy,1;1,1,-1diz,1;1,1,-1dj0,1;1,1,-1dj1,1;1,1,-1dj2,1;1,1,-1diq,1;1,1,-1dir,1;d,1,-1cjz,1;1,1,-1ck0,1;1,1,-1ck1,1;1,1,-1cjs,1;1,1,-1ck3,1;tm,q,-w,1;yv,14,-14,1;4w,10,-14,1;5b,b,-13,1;c,f,-13,1;g,7,-13,1;8,2,-13,1;1dx,1f,-1s,1;2dc,w,-w,1;gww,w,-w,1;o8y,y,-y,1',
    FIXES: '2x:8h;37:an;51:qk;8h:2x;an:37;n9:qh.69q;pc:6ab;q8:6ar;qa:r4;qd:s5;qg:r5;qh:n9.69q;qi:s0;qk:51;qo:ra;qp:s1;qq:qr;qr:qq;qu:r9;r4:qa;r5:qg;r9:qu;ra:qo;s0:qi;s1:qp;s5:qd;tu:5mo;tw:5mp;u6:5mq;u9:5mr;ua:5ms.5mt;ui:5mu;v7:5mv;5mo:tu;5mp:tw;5mq:u6;5mr:u9;5ms:ua.5mt;5mt:ua.5ms;5mu:ui;5mv:v7;5mw:wuj;601:61n;61n:601;69q:n9.qh;6ab:pc;6ar:q8;wuj:5mw;1dl1:1dl2;1dl2:1dl1',
  };
  // </tablas>

  const MAX_CP = 0x10FFFF;
  const MAXREPEAT = 4294967295;
  const MAXGROUPS = 1073741823;
  const MAXCODE = 4294967295;
  const MAXWIDTH = 2 ** 64;

  const F = Object.freeze({
    TEMPLATE: 1, IGNORECASE: 2, LOCALE: 4, MULTILINE: 8, DOTALL: 16, UNICODE: 32, VERBOSE: 64, DEBUG: 128, ASCII: 256,
  });
  const TYPE_FLAGS = F.ASCII | F.LOCALE | F.UNICODE;
  const GLOBAL_FLAGS = F.DEBUG | F.TEMPLATE;

  // --------------------------------------------------------------------------------------------
  // Errores
  // --------------------------------------------------------------------------------------------
  class PyReError extends Error {
    constructor(msg, pattern = null, pos = null, opciones = {}) {
      let detalle = msg;
      if (pattern !== null && pos !== null) {
        detalle = `${msg} at position ${pos}`;
        if (pattern.includes('\n')) {
          const antes = Array.from(pattern).slice(0, pos).join('');
          const linea = antes.split('\n').length;
          const col = pos - (antes.lastIndexOf('\n') === -1 ? -1 : Array.from(antes.slice(0, antes.lastIndexOf('\n'))).length);
          detalle = `${detalle} (line ${linea}, column ${col})`;
        }
      }
      super(opciones.noSoportado ? `Expresión regular no soportada en JS: ${msg}`
        : opciones.motorAgotado ? `Expresión regular demasiado costosa para el motor de JS: ${msg}`
          : `Expresión regular no válida: ${detalle}`);
      this.name = 'PyReError';
      this.msg = msg;
      this.pattern = pattern;
      this.pos = pos;
      this.noSoportado = !!opciones.noSoportado;
      this.motorAgotado = !!opciones.motorAgotado;
      this.tipo = opciones.tipo || 'error';
    }
  }
  const noSoportado = (msg, patron) => new PyReError(msg, patron, null, { noSoportado: true });

  // --------------------------------------------------------------------------------------------
  // Conjuntos de caracteres: arrays planos [lo0, hi0, lo1, hi1, …] ordenados y sin solapes
  // --------------------------------------------------------------------------------------------
  const RS = {
    deLista(cps) {
      const v = Array.from(cps).sort((a, b) => a - b);
      const out = [];
      for (const c of v) {
        const n = out.length;
        if (n && c <= out[n - 1] + 1) { if (c > out[n - 1]) out[n - 1] = c; } else out.push(c, c);
      }
      return out;
    },
    normalizar(plano) {
      const pares = [];
      for (let i = 0; i < plano.length; i += 2) pares.push([plano[i], plano[i + 1]]);
      pares.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const out = [];
      for (const [a, b] of pares) {
        const n = out.length;
        if (n && a <= out[n - 1] + 1) { if (b > out[n - 1]) out[n - 1] = b; } else out.push(a, b);
      }
      return out;
    },
    union(a, b) { return a.length === 0 ? b : b.length === 0 ? a : RS.normalizar(a.concat(b)); },
    complemento(a) {
      const out = [];
      let prev = 0;
      for (let i = 0; i < a.length; i += 2) {
        if (a[i] > prev) out.push(prev, a[i] - 1);
        prev = a[i + 1] + 1;
      }
      if (prev <= MAX_CP) out.push(prev, MAX_CP);
      return out;
    },
    interseccion(a, b) {
      const out = [];
      let i = 0, j = 0;
      while (i < a.length && j < b.length) {
        const lo = Math.max(a[i], b[j]), hi = Math.min(a[i + 1], b[j + 1]);
        if (lo <= hi) out.push(lo, hi);
        if (a[i + 1] < b[j + 1]) i += 2; else j += 2;
      }
      return out;
    },
    resta(a, b) { return RS.interseccion(a, RS.complemento(b)); },
    contiene(a, c) {
      let lo = 0, hi = (a.length >> 1) - 1;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (c < a[2 * m]) hi = m - 1; else if (c > a[2 * m + 1]) lo = m + 1; else return true;
      }
      return false;
    },
    subconjunto(a, b) { return RS.resta(a, b).length === 0; },
    tamano(a) { let n = 0; for (let i = 0; i < a.length; i += 2) n += a[i + 1] - a[i] + 1; return n; },
  };

  // --------------------------------------------------------------------------------------------
  // Tablas de Python (decodificadas bajo demanda)
  // --------------------------------------------------------------------------------------------
  const b36 = (s) => parseInt(s, 36);
  function decRangos(s) {
    const out = [];
    if (!s) return out;
    const p = s.split(',');
    let prev = -1;
    for (let i = 0; i < p.length; i += 2) {
      const a = prev + 1 + b36(p[i]);
      const b = a + b36(p[i + 1]);
      out.push(a, b);
      prev = b;
    }
    return out;
  }
  function decMapa(s) {
    const m = new Map();
    if (!s) return m;
    let prev = 0;
    for (const run of s.split(';')) {
      const [ds, n, d, st] = run.split(',').map(b36);
      const s0 = prev + ds;
      for (let k = 0; k < n; k++) { const c = s0 + k * st; m.set(c, c + d); }
      prev = s0;
    }
    return m;
  }
  function decFixes(s) {
    const m = new Map();
    if (!s) return m;
    for (const par of s.split(';')) {
      const [k, vs] = par.split(':');
      m.set(b36(k), vs.split('.').map(b36));
    }
    return m;
  }

  let TB = null;
  function tb() {
    if (TB) return TB;
    if (!TABLAS.W) throw new Error('re.js: faltan las tablas Unicode (ejecute dump_units_re.py --tablas-js --actualizar)');
    const LOWER = decMapa(TABLAS.LOWER), UPPER = decMapa(TABLAS.UPPER);
    TB = {
      W: decRangos(TABLAS.W), D: decRangos(TABLAS.D), S: decRangos(TABLAS.S),
      LOWER, UPPER, FIXES: decFixes(TABLAS.FIXES),
      dominioLower: RS.deLista(LOWER.keys()), dominioUpper: RS.deLista(UPPER.keys()),
    };
    TB.NW = RS.complemento(TB.W);
    TB.ND = RS.complemento(TB.D);
    TB.NS = RS.complemento(TB.S);
    return TB;
  }

  const ASCII_W = [0x30, 0x39, 0x41, 0x5a, 0x5f, 0x5f, 0x61, 0x7a];
  const ASCII_D = [0x30, 0x39];
  const ASCII_S = [0x09, 0x0d, 0x20, 0x20];

  function conjuntoCategoria(nombre, ascii) {
    const t = ascii ? null : tb();
    switch (nombre) {
      case 'CATEGORY_WORD': return ascii ? ASCII_W : t.W;
      case 'CATEGORY_NOT_WORD': return ascii ? RS.complemento(ASCII_W) : t.NW;
      case 'CATEGORY_DIGIT': return ascii ? ASCII_D : t.D;
      case 'CATEGORY_NOT_DIGIT': return ascii ? RS.complemento(ASCII_D) : t.ND;
      case 'CATEGORY_SPACE': return ascii ? ASCII_S : t.S;
      case 'CATEGORY_NOT_SPACE': return ascii ? RS.complemento(ASCII_S) : t.NS;
      default: throw new PyReError(`categoría no admitida ${nombre}`);
    }
  }

  // --------------------------------------------------------------------------------------------
  // Emisión de caracteres y clases
  // --------------------------------------------------------------------------------------------
  function esc(c) {
    if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) return String.fromCharCode(c);
    if (c < 0x80) return '\\x' + (c < 16 ? '0' : '') + c.toString(16);
    return '\\u{' + c.toString(16) + '}';
  }
  function cuerpo(rs) {
    let s = '';
    for (let i = 0; i < rs.length; i += 2) {
      const a = rs[i], b = rs[i + 1];
      s += a === b ? esc(a) : b === a + 1 ? esc(a) + esc(b) : esc(a) + '-' + esc(b);
    }
    return s;
  }
  function claseDeConjunto(rs) {
    if (rs.length === 2 && rs[0] === rs[1]) return esc(rs[0]);
    if (rs.length === 0) return '[]';
    const comp = RS.complemento(rs);
    if (comp.length === 0) return '[\\s\\S]';
    return comp.length < rs.length ? `[^${cuerpo(comp)}]` : `[${cuerpo(rs)}]`;
  }
  const negarClase = (c) => `[^${c.slice(1, -1)}]`;

  // \w y \d del motor, corregidos contra las tablas de Python (una vez por proceso)
  let MOTOR = null;
  function escanear(rangos, rx) {
    const hallados = [];
    let buf = [];
    const vaciar = () => {
      if (!buf.length) return;
      // Cada candidato va seguido de U+0000 y solo cuentan las coincidencias que empiezan en un candidato.
      // JavaScriptCore (WebKit 26.4) reconoce los pares sustitutos con la máscara 0xDC00: una unidad de
      // U+F800–U+FBFF seguida de otra de U+FC00–U+FFFF se lee como un solo carácter en una RegExp 'u'/'v',
      // así que dos candidatos contiguos (U+FBFF U+FC00) se fundían y la corrección salía mal.
      const intercalado = new Array(buf.length * 2);
      const inicio = new Uint8Array(buf.length * 3);
      let n = 0;
      for (let i = 0; i < buf.length; i++) {
        intercalado[2 * i] = buf[i];
        intercalado[2 * i + 1] = 0;
        inicio[n] = 1;
        n += (buf[i] > 0xFFFF ? 2 : 1) + 1;
      }
      let s = '';
      for (let i = 0; i < intercalado.length; i += 8192) s += String.fromCodePoint.apply(null, intercalado.slice(i, i + 8192));
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(s)) !== null) if (inicio[m.index]) hallados.push(m[0].codePointAt(0));
      buf = [];
    };
    for (let i = 0; i < rangos.length; i += 2) {
      for (let c = rangos[i]; c <= rangos[i + 1]; c++) {
        buf.push(c);
        if (buf.length >= 65536) vaciar();
      }
    }
    vaciar();
    return RS.deLista(hallados);
  }
  function motor() {
    if (MOTOR) return MOTOR;
    const t = tb();
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    // Sustitutos y planos de uso privado (Co estable) no pueden ser letras ni cifras.
    const fuera = [0xD800, 0xDFFF, 0xF0000, MAX_CP];
    const siW = RS.resta(t.W, fuera);
    const extraW = escanear(RS.resta(t.NW, fuera), /[\p{L}\p{N}_]/gv);
    const faltaW = escanear(siW, /[^\p{L}\p{N}_]/gv);
    const extraD = escanear(RS.resta(RS.union(siW, extraW), t.D), /\p{Nd}/gv);
    const faltaD = escanear(t.D, /\P{Nd}/gv);
    const corregida = (base, extra, falta) => {
      let c = `[${base}]`;
      if (extra.length) c = `[${c}--[${cuerpo(extra)}]]`;
      if (falta.length) c = `[${c}[${cuerpo(falta)}]]`;
      return c;
    };
    const W = corregida('\\p{L}\\p{N}_', extraW, faltaW);
    const D = corregida('\\p{Nd}', extraD, faltaD);
    MOTOR = {
      W, NW: negarClase(W), D, ND: negarClase(D),
      S: `[${cuerpo(t.S)}]`, NS: `[^${cuerpo(t.S)}]`,
      diagnostico: {
        extraW: RS.tamano(extraW), faltaW: RS.tamano(faltaW), extraD: RS.tamano(extraD), faltaD: RS.tamano(faltaD),
        rangosExtraW: extraW.length / 2, ms: (typeof performance !== 'undefined' ? performance : Date).now() - t0,
      },
    };
    return MOTOR;
  }
  const A_W = `[${cuerpo(ASCII_W)}]`, A_D = `[${cuerpo(ASCII_D)}]`, A_S = `[${cuerpo(ASCII_S)}]`;
  function emisionCategoria(nombre, ascii) {
    if (ascii) {
      switch (nombre) {
        case 'CATEGORY_WORD': return A_W;
        case 'CATEGORY_NOT_WORD': return negarClase(A_W);
        case 'CATEGORY_DIGIT': return A_D;
        case 'CATEGORY_NOT_DIGIT': return negarClase(A_D);
        case 'CATEGORY_SPACE': return A_S;
        case 'CATEGORY_NOT_SPACE': return negarClase(A_S);
      }
    }
    const m = motor();
    switch (nombre) {
      case 'CATEGORY_WORD': return m.W;
      case 'CATEGORY_NOT_WORD': return m.NW;
      case 'CATEGORY_DIGIT': return m.D;
      case 'CATEGORY_NOT_DIGIT': return m.ND;
      case 'CATEGORY_SPACE': return m.S;
      case 'CATEGORY_NOT_SPACE': return m.NS;
    }
    throw new PyReError(`categoría no admitida ${nombre}`);
  }

  // --------------------------------------------------------------------------------------------
  // Mayúsculas y minúsculas de sre
  // --------------------------------------------------------------------------------------------
  const lowerU = (c) => { const v = tb().LOWER.get(c); return v === undefined ? c : v; };
  const upperU = (c) => { const v = tb().UPPER.get(c); return v === undefined ? c : v; };
  const iscasedU = (c) => lowerU(c) !== c || upperU(c) !== c;
  const lowerA = (c) => (c >= 0x41 && c <= 0x5a ? c + 32 : c);
  const iscasedA = (c) => (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);

  /** {X : lower(X) ∈ C} */
  function preimagen(C, ascii) {
    const extra = [];
    if (ascii) {
      for (let c = 0x41; c <= 0x5a; c++) if (RS.contiene(C, c + 32)) extra.push(c);
      return RS.union(RS.resta(C, [0x41, 0x5a]), RS.deLista(extra));
    }
    const t = tb();
    for (const [x, l] of t.LOWER) if (RS.contiene(C, l)) extra.push(x);
    return RS.union(RS.resta(C, t.dominioLower), RS.deLista(extra));
  }
  /** {Y : upper(Y) ∈ R} */
  function preimagenUpper(R) {
    const t = tb();
    const extra = [];
    for (const [y, u] of t.UPPER) if (RS.contiene(R, u)) extra.push(y);
    return RS.union(RS.resta(R, t.dominioUpper), RS.deLista(extra));
  }

  const cacheLiteralI = new Map();
  /** Conjunto de un literal con IGNORECASE, o null si sre lo compara tal cual. */
  function conjuntoLiteralI(c, ascii) {
    const k = (ascii ? 'a' : 'u') + c;
    if (cacheLiteralI.has(k)) return cacheLiteralI.get(k);
    let r = null;
    if (ascii) {
      if (iscasedA(c)) r = preimagen([lowerA(c), lowerA(c)], true);
    } else if (iscasedU(c)) {
      const lo = lowerU(c);
      r = preimagen(RS.deLista([lo, ...(tb().FIXES.get(lo) || [])]), false);
    }
    cacheLiteralI.set(k, r);
    return r;
  }

  /** Clase de sre → { explicito, cats, negar, ascii } con la semántica de _optimize_charset. */
  function infoClase(items, flags) {
    const ignore = !!(flags & F.IGNORECASE) && !(flags & F.LOCALE);
    const ascii = !(flags & F.UNICODE);
    let negar = false;
    const cats = [];
    const crudos = [];
    for (const [op, av] of items) {
      if (op === 'NEGATE') negar = true;
      else if (op === 'CATEGORY') { if (!cats.includes(av)) cats.push(av); }
      else if (op === 'LITERAL') crudos.push(av, av);
      else if (op === 'RANGE') crudos.push(av[0], av[1]);
      else throw new PyReError(`elemento de clase inesperado ${op}`);
    }
    if (!ignore) return { explicito: RS.normalizar(crudos), cats, negar, ascii };
    const lower = ascii ? lowerA : lowerU;
    const iscased = ascii ? iscasedA : iscasedU;
    const fixes = ascii ? null : tb().FIXES;
    const charmap = new Uint8Array(0x10000);
    let hascased = false;
    const colaLit = [], colaRango = [];
    const marcar = (lo) => {
      charmap[lo] = 1;
      const fx = fixes && fixes.get(lo);
      if (fx) for (const k of fx) charmap[k] = 1;
    };
    for (const [op, av] of items) {
      if (op === 'LITERAL') {
        const lo = lower(av);
        if (lo > 0xFFFF) { colaLit.push(av); hascased = true; } else { marcar(lo); if (iscased(av)) hascased = true; }
      } else if (op === 'RANGE') {
        const [a, b] = av;
        for (let c = a; c <= Math.min(b, 0xFFFF); c++) marcar(lower(c));
        if (b > 0xFFFF) { colaRango.push([a, b]); hascased = true; } else if (!hascased) {
          for (let c = a; c <= b; c++) if (iscased(c)) { hascased = true; break; }
        }
      }
    }
    if (!hascased) return { explicito: RS.normalizar(crudos), cats, negar, ascii };
    const lista = [];
    for (let c = 0; c < 0x10000; c++) if (charmap[c]) lista.push(c);
    let F1 = preimagen(RS.union(RS.deLista(lista), RS.deLista(colaLit)), ascii);
    for (const [a, b] of colaRango) {
      const R = [a, b];
      F1 = RS.union(F1, RS.union(preimagen(R, ascii), preimagen(preimagenUpper(R), ascii)));
    }
    return { explicito: F1, cats, negar, ascii };
  }
  const CATEGORIA_OPUESTA = {
    CATEGORY_WORD: 'CATEGORY_NOT_WORD', CATEGORY_NOT_WORD: 'CATEGORY_WORD',
    CATEGORY_DIGIT: 'CATEGORY_NOT_DIGIT', CATEGORY_NOT_DIGIT: 'CATEGORY_DIGIT',
    CATEGORY_SPACE: 'CATEGORY_NOT_SPACE', CATEGORY_NOT_SPACE: 'CATEGORY_SPACE',
  };
  function emitirClase(info) {
    if (!info.cats.length) return claseDeConjunto(info.negar ? RS.complemento(info.explicito) : info.explicito);
    // Con ASCII todas las categorías son conjuntos pequeños: la clase se emite plana, con el conjunto ya calculado.
    // JavaScriptCore (WebKit 26.4) calcula mal una clase negada anidada de rangos ASCII en modo 'v': [[^0-9A-Z_a-z][0-9]]
    // casa «a» y [^[^0-9][\x09-\x0d\x20]] no casa «0».
    if (info.ascii) return claseDeConjunto(conjuntoClase(info));
    if (info.cats.length === 1 && info.explicito.length === 0) {
      // [^\S] = \s, [^\W] = \w, [^\D] = \d: la categoría opuesta. Negar la emisión con negarClase daría [^^…] cuando la
      // categoría ya se emite negada, y en modo 'v' ese segundo ^ es un literal.
      return emisionCategoria(info.negar ? CATEGORIA_OPUESTA[info.cats[0]] : info.cats[0], info.ascii);
    }
    const partes = cuerpo(info.explicito) + info.cats.map((c) => emisionCategoria(c, info.ascii)).join('');
    return `[${info.negar ? '^' : ''}${partes}]`;
  }
  function conjuntoClase(info) {
    let s = info.explicito;
    for (const c of info.cats) s = RS.union(s, conjuntoCategoria(c, info.ascii));
    return info.negar ? RS.complemento(s) : s;
  }

  // --------------------------------------------------------------------------------------------
  // Analizador: port de re/_parser.py (Python 3.12)
  // --------------------------------------------------------------------------------------------
  const SPECIAL_CHARS = new Set('.\\[{()*+?^$|');
  const REPEAT_CHARS = new Set('*+?{');
  const DIGITS = new Set('0123456789');
  const OCTDIGITS = new Set('01234567');
  const HEXDIGITS = new Set('0123456789abcdefABCDEF');
  const ASCIILETTERS = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const WHITESPACE = new Set(' \t\n\r\v\f');
  const REPEATCODES = new Set(['MIN_REPEAT', 'MAX_REPEAT', 'POSSESSIVE_REPEAT']);
  const UNITCODES = new Set(['ANY', 'RANGE', 'IN', 'LITERAL', 'NOT_LITERAL', 'CATEGORY']);
  const ESCAPES = new Map([['\\a', 7], ['\\b', 8], ['\\f', 12], ['\\n', 10], ['\\r', 13], ['\\t', 9], ['\\v', 11], ['\\\\', 92]]);
  const CATEGORIES = new Map([
    ['\\A', ['AT', 'AT_BEGINNING_STRING']], ['\\b', ['AT', 'AT_BOUNDARY']], ['\\B', ['AT', 'AT_NON_BOUNDARY']],
    ['\\d', ['IN', [['CATEGORY', 'CATEGORY_DIGIT']]]], ['\\D', ['IN', [['CATEGORY', 'CATEGORY_NOT_DIGIT']]]],
    ['\\s', ['IN', [['CATEGORY', 'CATEGORY_SPACE']]]], ['\\S', ['IN', [['CATEGORY', 'CATEGORY_NOT_SPACE']]]],
    ['\\w', ['IN', [['CATEGORY', 'CATEGORY_WORD']]]], ['\\W', ['IN', [['CATEGORY', 'CATEGORY_NOT_WORD']]]],
    ['\\Z', ['AT', 'AT_END_STRING']],
  ]);
  const FLAGS = new Map([['i', F.IGNORECASE], ['L', F.LOCALE], ['m', F.MULTILINE], ['s', F.DOTALL], ['x', F.VERBOSE],
    ['a', F.ASCII], ['t', F.TEMPLATE], ['u', F.UNICODE]]);

  const lenCp = (s) => { let n = 0; for (const _ of s) n++; return n; };
  const esIdentificador = (s) => /^[\p{XID_Start}_]\p{XID_Continue}*$/u.test(s);
  const esAlfa = (s) => /^\p{L}+$/u.test(s);
  const decimalAscii = (s) => /^[0-9]+$/.test(s);
  const cp = (tok) => tok.codePointAt(tok[0] === '\\' ? 1 : 0);
  const repr = (s) => `'${s}'`;

  class Tokenizador {
    constructor(cadena) {
      this.cadena = cadena;
      this.cps = Array.from(cadena);
      this.index = 0;
      this.next = null;
      this.nextLen = 0;
      this._sig();
    }
    _sig() {
      let i = this.index;
      if (i >= this.cps.length) { this.next = null; this.nextLen = 0; return; }
      let ch = this.cps[i];
      let n = 1;
      if (ch === '\\') {
        i++;
        if (i >= this.cps.length) throw new PyReError('bad escape (end of pattern)', this.cadena, this.cps.length - 1);
        ch += this.cps[i];
        n = 2;
      }
      this.index = i + 1;
      this.next = ch;
      this.nextLen = n;
    }
    match(c) { if (c === this.next) { this._sig(); return true; } return false; }
    get() { const t = this.next; this._sig(); return t; }
    getwhile(n, conjunto) {
      let r = '';
      for (let k = 0; k < n; k++) {
        const c = this.next;
        if (c === null || !conjunto.has(c)) break;
        r += c;
        this._sig();
      }
      return r;
    }
    getuntil(terminador, nombre) {
      let r = '';
      while (true) {
        const c = this.next;
        this._sig();
        if (c === null) {
          if (!r) throw this.error('missing ' + nombre);
          throw this.error(`missing ${terminador}, unterminated name`, lenCp(r));
        }
        if (c === terminador) {
          if (!r) throw this.error('missing ' + nombre, 1);
          break;
        }
        r += c;
      }
      return r;
    }
    tell() { return this.index - this.nextLen; }
    seek(index) { this.index = index; this._sig(); }
    error(msg, offset = 0) { return new PyReError(msg, this.cadena, this.tell() - offset); }
    checkgroupname(nombre, offset) {
      if (!esIdentificador(nombre)) throw this.error(`bad character in group name ${repr(nombre)}`, lenCp(nombre) + offset);
    }
  }

  class Estado {
    constructor() {
      this.flags = 0;
      this.groupdict = new Map();
      this.groupwidths = [null];
      this.lookbehindgroups = null;
      this.grouprefpos = new Map();
    }
    get groups() { return this.groupwidths.length; }
    opengroup(nombre = null) {
      const gid = this.groups;
      this.groupwidths.push(null);
      if (this.groups > MAXGROUPS) throw new PyReError('too many groups');
      if (nombre !== null) {
        const ogid = this.groupdict.get(nombre);
        if (ogid !== undefined) throw new PyReError(`redefinition of group name ${repr(nombre)} as group ${gid}; was group ${ogid}`);
        this.groupdict.set(nombre, gid);
      }
      return gid;
    }
    closegroup(gid, p) { this.groupwidths[gid] = anchura(p, this); }
    checkgroup(gid) { return gid < this.groups && this.groupwidths[gid] !== null; }
    checklookbehindgroup(gid, source) {
      if (this.lookbehindgroups !== null) {
        if (!this.checkgroup(gid)) throw source.error('cannot refer to an open group');
        if (gid >= this.lookbehindgroups) throw source.error('cannot refer to group defined in the same lookbehind subpattern');
      }
    }
  }

  function anchura(nodos, estado) {
    let lo = 0, hi = 0;
    for (const [op, av] of nodos) {
      if (op === 'BRANCH') {
        let i = MAXWIDTH, j = 0;
        for (const alt of av) { const [l, h] = anchura(alt, estado); i = Math.min(i, l); j = Math.max(j, h); }
        lo += i; hi += j;
      } else if (op === 'ATOMIC_GROUP') {
        const [i, j] = anchura(av, estado); lo += i; hi += j;
      } else if (op === 'SUBPATTERN') {
        const [i, j] = anchura(av[3], estado); lo += i; hi += j;
      } else if (REPEATCODES.has(op)) {
        const [i, j] = anchura(av[2], estado);
        lo += i * av[0];
        if (av[1] === MAXREPEAT && j) hi = MAXWIDTH; else hi += j * av[1];
      } else if (UNITCODES.has(op)) {
        lo += 1; hi += 1;
      } else if (op === 'GROUPREF') {
        const [i, j] = estado.groupwidths[av]; lo += i; hi += j;
      } else if (op === 'GROUPREF_EXISTS') {
        let [i, j] = anchura(av[1], estado);
        if (av[2] !== null) { const [l, h] = anchura(av[2], estado); i = Math.min(i, l); j = Math.max(j, h); } else i = 0;
        lo += i; hi += j;
      }
    }
    return [Math.min(lo, MAXWIDTH), Math.min(hi, MAXWIDTH)];
  }

  function claveNodo(n) { return JSON.stringify(n); }
  function uniq(items) {
    const vistos = new Set(), out = [];
    for (const it of items) { const k = claveNodo(it); if (!vistos.has(k)) { vistos.add(k); out.push(it); } }
    return out;
  }
  /** Igualdad de tuplas de Python: los SubPattern se comparan por identidad. */
  function igualNodo(a, b) {
    if (a[0] !== b[0]) return false;
    const [op, x] = a, y = b[1];
    switch (op) {
      case 'LITERAL': case 'NOT_LITERAL': case 'GROUPREF': case 'AT': case 'CATEGORY': case 'ANY': case 'NEGATE':
        return x === y;
      case 'RANGE': return x[0] === y[0] && x[1] === y[1];
      case 'IN': return x.length === y.length && x.every((it, i) => igualNodo(it, y[i]));
      case 'SUBPATTERN': return x[0] === y[0] && x[1] === y[1] && x[2] === y[2] && x[3] === y[3];
      case 'MAX_REPEAT': case 'MIN_REPEAT': case 'POSSESSIVE_REPEAT': return x[0] === y[0] && x[1] === y[1] && x[2] === y[2];
      case 'ASSERT': case 'ASSERT_NOT': return x[0] === y[0] && x[1] === y[1];
      case 'ATOMIC_GROUP': return x === y;
      case 'BRANCH': return x.length === y.length && x.every((it, i) => it === y[i]);
      case 'GROUPREF_EXISTS': return x[0] === y[0] && x[1] === y[1] && x[2] === y[2];
      default: return false;
    }
  }

  function escapeClase(source, esc_) {
    const code = ESCAPES.get(esc_);
    if (code !== undefined) return ['LITERAL', code];
    const cat = CATEGORIES.get(esc_);
    if (cat && cat[0] === 'IN') return cat;
    let escape = esc_;
    const c = Array.from(escape)[1];
    if (c === 'x') {
      escape += source.getwhile(2, HEXDIGITS);
      if (escape.length !== 4) throw source.error(`incomplete escape ${escape}`, escape.length);
      return ['LITERAL', parseInt(escape.slice(2), 16)];
    } else if (c === 'u') {
      escape += source.getwhile(4, HEXDIGITS);
      if (escape.length !== 6) throw source.error(`incomplete escape ${escape}`, escape.length);
      return ['LITERAL', parseInt(escape.slice(2), 16)];
    } else if (c === 'U') {
      escape += source.getwhile(8, HEXDIGITS);
      if (escape.length !== 10) throw source.error(`incomplete escape ${escape}`, escape.length);
      const v = parseInt(escape.slice(2), 16);
      if (v > MAX_CP) throw source.error(`bad escape ${escape}`, escape.length);
      return ['LITERAL', v];
    } else if (c === 'N') {
      throw noSoportado('\\N{…} (nombres de caracteres Unicode)', source.cadena);
    } else if (OCTDIGITS.has(c)) {
      escape += source.getwhile(2, OCTDIGITS);
      const v = parseInt(escape.slice(1), 8);
      if (v > 0o377) throw source.error(`octal escape value ${escape} outside of range 0-0o377`, escape.length);
      return ['LITERAL', v];
    } else if (DIGITS.has(c)) {
      throw source.error(`bad escape ${escape}`, escape.length);
    }
    if (lenCp(escape) === 2) {
      if (ASCIILETTERS.has(c)) throw source.error(`bad escape ${escape}`, 2);
      return ['LITERAL', c.codePointAt(0)];
    }
    throw source.error(`bad escape ${escape}`, lenCp(escape));
  }

  function escape_(source, esc_, state) {
    const cat = CATEGORIES.get(esc_);
    if (cat) return cat;
    const code = ESCAPES.get(esc_);
    if (code !== undefined) return ['LITERAL', code];
    let escape = esc_;
    const c = Array.from(escape)[1];
    if (c === 'x') {
      escape += source.getwhile(2, HEXDIGITS);
      if (escape.length !== 4) throw source.error(`incomplete escape ${escape}`, escape.length);
      return ['LITERAL', parseInt(escape.slice(2), 16)];
    } else if (c === 'u') {
      escape += source.getwhile(4, HEXDIGITS);
      if (escape.length !== 6) throw source.error(`incomplete escape ${escape}`, escape.length);
      return ['LITERAL', parseInt(escape.slice(2), 16)];
    } else if (c === 'U') {
      escape += source.getwhile(8, HEXDIGITS);
      if (escape.length !== 10) throw source.error(`incomplete escape ${escape}`, escape.length);
      const v = parseInt(escape.slice(2), 16);
      if (v > MAX_CP) throw source.error(`bad escape ${escape}`, escape.length);
      return ['LITERAL', v];
    } else if (c === 'N') {
      throw noSoportado('\\N{…} (nombres de caracteres Unicode)', source.cadena);
    } else if (c === '0') {
      escape += source.getwhile(2, OCTDIGITS);
      return ['LITERAL', parseInt(escape.slice(1), 8)];
    } else if (DIGITS.has(c)) {
      if (source.next !== null && DIGITS.has(source.next)) {
        escape += source.get();
        if (OCTDIGITS.has(escape[1]) && OCTDIGITS.has(escape[2]) && source.next !== null && OCTDIGITS.has(source.next)) {
          escape += source.get();
          const v = parseInt(escape.slice(1), 8);
          if (v > 0o377) throw source.error(`octal escape value ${escape} outside of range 0-0o377`, escape.length);
          return ['LITERAL', v];
        }
      }
      const group = parseInt(escape.slice(1), 10);
      if (group < state.groups) {
        if (!state.checkgroup(group)) throw source.error('cannot refer to an open group', escape.length);
        state.checklookbehindgroup(group, source);
        return ['GROUPREF', group];
      }
      throw source.error(`invalid group reference ${group}`, escape.length - 1);
    }
    if (lenCp(escape) === 2) {
      if (ASCIILETTERS.has(c)) throw source.error(`bad escape ${escape}`, 2);
      return ['LITERAL', c.codePointAt(0)];
    }
    throw source.error(`bad escape ${escape}`, lenCp(escape));
  }

  function parseSub(source, state, verbose, nested) {
    const items = [];
    while (true) {
      items.push(parse_(source, state, verbose, nested + 1, !nested && items.length === 0));
      if (!source.match('|')) break;
      if (!nested) verbose = state.flags & F.VERBOSE;
    }
    if (items.length === 1) return items[0];
    const sub = [];
    while (true) {
      let prefijo = null, comun = true;
      for (const item of items) {
        if (!item.length) { comun = false; break; }
        if (prefijo === null) prefijo = item[0];
        else if (!igualNodo(item[0], prefijo)) { comun = false; break; }
      }
      if (!comun) break;
      for (const item of items) item.shift();
      sub.push(prefijo);
    }
    const set = [];
    let todos = true;
    for (const item of items) {
      if (item.length !== 1) { todos = false; break; }
      const [op, av] = item[0];
      if (op === 'LITERAL') set.push(item[0]);
      else if (op === 'IN' && av[0][0] !== 'NEGATE') set.push(...av);
      else { todos = false; break; }
    }
    if (todos) { sub.push(['IN', uniq(set)]); return sub; }
    sub.push(['BRANCH', items]);
    return sub;
  }

  function parseFlags(source, state, char) {
    let addFlags = 0, delFlags = 0;
    if (char !== '-') {
      while (true) {
        const flag = FLAGS.get(char);
        if (char === 'L') throw source.error("bad inline flags: cannot use 'L' flag with a str pattern");
        addFlags |= flag;
        if ((flag & TYPE_FLAGS) && (addFlags & TYPE_FLAGS) !== flag) {
          throw source.error("bad inline flags: flags 'a', 'u' and 'L' are incompatible");
        }
        char = source.get();
        if (char === null) throw source.error('missing -, : or )');
        if (char === ')' || char === '-' || char === ':') break;
        if (!FLAGS.has(char)) throw source.error(esAlfa(char) ? 'unknown flag' : 'missing -, : or )', lenCp(char));
      }
    }
    if (char === ')') { state.flags |= addFlags; return null; }
    if (addFlags & GLOBAL_FLAGS) throw source.error('bad inline flags: cannot turn on global flag', 1);
    if (char === '-') {
      char = source.get();
      if (char === null) throw source.error('missing flag');
      if (!FLAGS.has(char)) throw source.error(esAlfa(char) ? 'unknown flag' : 'missing flag', lenCp(char));
      while (true) {
        const flag = FLAGS.get(char);
        if (flag & TYPE_FLAGS) throw source.error("bad inline flags: cannot turn off flags 'a', 'u' and 'L'");
        delFlags |= flag;
        char = source.get();
        if (char === null) throw source.error('missing :');
        if (char === ':') break;
        if (!FLAGS.has(char)) throw source.error(esAlfa(char) ? 'unknown flag' : 'missing :', lenCp(char));
      }
    }
    if (delFlags & GLOBAL_FLAGS) throw source.error('bad inline flags: cannot turn off global flag', 1);
    if (addFlags & delFlags) throw source.error('bad inline flags: flag turned on and off', 1);
    return [addFlags, delFlags];
  }

  function parse_(source, state, verbose, nested, first = false) {
    const sub = [];
    while (true) {
      let esto = source.next;
      if (esto === null) break;
      if (esto === '|' || esto === ')') break;
      source.get();
      if (verbose) {
        if (WHITESPACE.has(esto)) continue;
        if (esto === '#') {
          while (true) { esto = source.get(); if (esto === null || esto === '\n') break; }
          continue;
        }
      }
      if (esto[0] === '\\') {
        sub.push(escape_(source, esto, state));
      } else if (!SPECIAL_CHARS.has(esto)) {
        sub.push(['LITERAL', cp(esto)]);
      } else if (esto === '[') {
        const here = source.tell() - 1;
        const set = [];
        const negate = source.match('^');
        while (true) {
          esto = source.get();
          if (esto === null) throw source.error('unterminated character set', source.tell() - here);
          let code1;
          if (esto === ']' && set.length) break;
          else if (esto[0] === '\\') code1 = escapeClase(source, esto);
          else code1 = ['LITERAL', cp(esto)];
          if (source.match('-')) {
            const that = source.get();
            if (that === null) throw source.error('unterminated character set', source.tell() - here);
            if (that === ']') {
              if (code1[0] === 'IN') code1 = code1[1][0];
              set.push(code1, ['LITERAL', 0x2d]);
              break;
            }
            const code2 = that[0] === '\\' ? escapeClase(source, that) : ['LITERAL', cp(that)];
            if (code1[0] !== 'LITERAL' || code2[0] !== 'LITERAL') {
              throw source.error(`bad character range ${esto}-${that}`, lenCp(esto) + 1 + lenCp(that));
            }
            if (code2[1] < code1[1]) throw source.error(`bad character range ${esto}-${that}`, lenCp(esto) + 1 + lenCp(that));
            set.push(['RANGE', [code1[1], code2[1]]]);
          } else {
            if (code1[0] === 'IN') code1 = code1[1][0];
            set.push(code1);
          }
        }
        const u = uniq(set);
        if (u.length === 1 && u[0][0] === 'LITERAL') sub.push(negate ? ['NOT_LITERAL', u[0][1]] : u[0]);
        else { if (negate) u.unshift(['NEGATE', null]); sub.push(['IN', u]); }
      } else if (REPEAT_CHARS.has(esto)) {
        const here = source.tell();
        let min, max;
        if (esto === '?') { min = 0; max = 1; }
        else if (esto === '*') { min = 0; max = MAXREPEAT; }
        else if (esto === '+') { min = 1; max = MAXREPEAT; }
        else {
          if (source.next === '}') { sub.push(['LITERAL', 0x7b]); continue; }
          min = 0; max = MAXREPEAT;
          let lo = '', hi = '';
          while (source.next !== null && DIGITS.has(source.next)) lo += source.get();
          if (source.match(',')) { while (source.next !== null && DIGITS.has(source.next)) hi += source.get(); } else hi = lo;
          if (!source.match('}')) { sub.push(['LITERAL', 0x7b]); source.seek(here); continue; }
          if (lo) { min = Number(lo); if (min >= MAXREPEAT) throw new PyReError('the repetition number is too large', null, null, { tipo: 'OverflowError' }); }
          if (hi) {
            max = Number(hi);
            if (max >= MAXREPEAT) throw new PyReError('the repetition number is too large', null, null, { tipo: 'OverflowError' });
            if (max < min) throw source.error('min repeat greater than max repeat', source.tell() - here);
          }
        }
        let item = sub.length ? [sub[sub.length - 1]] : null;
        if (!item || item[0][0] === 'AT') throw source.error('nothing to repeat', source.tell() - here + lenCp(esto));
        if (REPEATCODES.has(item[0][0])) throw source.error('multiple repeat', source.tell() - here + lenCp(esto));
        if (item[0][0] === 'SUBPATTERN') {
          const [g, add, del, p] = item[0][1];
          if (g === null && !add && !del) item = p;
        }
        let op = 'MAX_REPEAT';
        if (source.match('?')) op = 'MIN_REPEAT';
        else if (source.match('+')) op = 'POSSESSIVE_REPEAT';
        sub[sub.length - 1] = [op, [min, max, item]];
      } else if (esto === '.') {
        sub.push(['ANY', null]);
      } else if (esto === '(') {
        const start = source.tell() - 1;
        let capture = true, atomic = false, name = null, addFlags = 0, delFlags = 0;
        if (source.match('?')) {
          let char = source.get();
          if (char === null) throw source.error('unexpected end of pattern');
          if (char === 'P') {
            if (source.match('<')) {
              name = source.getuntil('>', 'group name');
              source.checkgroupname(name, 1);
            } else if (source.match('=')) {
              name = source.getuntil(')', 'group name');
              source.checkgroupname(name, 1);
              const gid = state.groupdict.get(name);
              if (gid === undefined) throw source.error(`unknown group name ${repr(name)}`, lenCp(name) + 1);
              if (!state.checkgroup(gid)) throw source.error('cannot refer to an open group', lenCp(name) + 1);
              state.checklookbehindgroup(gid, source);
              sub.push(['GROUPREF', gid]);
              continue;
            } else {
              char = source.get();
              if (char === null) throw source.error('unexpected end of pattern');
              throw source.error('unknown extension ?P' + char, lenCp(char) + 2);
            }
          } else if (char === ':') {
            capture = false;
          } else if (char === '#') {
            while (true) {
              if (source.next === null) throw source.error('missing ), unterminated comment', source.tell() - start);
              if (source.get() === ')') break;
            }
            continue;
          } else if (char === '=' || char === '!' || char === '<') {
            let dir = 1, lookbehindgroups;
            if (char === '<') {
              char = source.get();
              if (char === null) throw source.error('unexpected end of pattern');
              if (char !== '=' && char !== '!') throw source.error('unknown extension ?<' + char, lenCp(char) + 2);
              dir = -1;
              lookbehindgroups = state.lookbehindgroups;
              if (lookbehindgroups === null) state.lookbehindgroups = state.groups;
            }
            const p = parseSub(source, state, verbose, nested + 1);
            if (dir < 0 && lookbehindgroups === null) state.lookbehindgroups = null;
            if (!source.match(')')) throw source.error('missing ), unterminated subpattern', source.tell() - start);
            sub.push([char === '=' ? 'ASSERT' : 'ASSERT_NOT', [dir, p]]);
            continue;
          } else if (char === '(') {
            const condname = source.getuntil(')', 'group name');
            let condgroup;
            if (!decimalAscii(condname)) {
              source.checkgroupname(condname, 1);
              condgroup = state.groupdict.get(condname);
              if (condgroup === undefined) throw source.error(`unknown group name ${repr(condname)}`, lenCp(condname) + 1);
            } else {
              condgroup = Number(condname);
              if (!condgroup) throw source.error('bad group number', lenCp(condname) + 1);
              if (condgroup >= MAXGROUPS) throw source.error(`invalid group reference ${condgroup}`, lenCp(condname) + 1);
              if (!state.grouprefpos.has(condgroup)) state.grouprefpos.set(condgroup, source.tell() - lenCp(condname) - 1);
            }
            state.checklookbehindgroup(condgroup, source);
            const itemYes = parse_(source, state, verbose, nested + 1);
            let itemNo = null;
            if (source.match('|')) {
              itemNo = parse_(source, state, verbose, nested + 1);
              if (source.next === '|') throw source.error('conditional backref with more than two branches');
            }
            if (!source.match(')')) throw source.error('missing ), unterminated subpattern', source.tell() - start);
            sub.push(['GROUPREF_EXISTS', [condgroup, itemYes, itemNo]]);
            continue;
          } else if (char === '>') {
            capture = false;
            atomic = true;
          } else if (FLAGS.has(char) || char === '-') {
            const fl = parseFlags(source, state, char);
            if (fl === null) {
              if (!first || sub.length) throw source.error('global flags not at the start of the expression', source.tell() - start);
              verbose = state.flags & F.VERBOSE;
              continue;
            }
            [addFlags, delFlags] = fl;
            capture = false;
          } else {
            throw source.error('unknown extension ?' + char, lenCp(char) + 1);
          }
        }
        let group = null;
        if (capture) {
          try {
            group = state.opengroup(name);
          } catch (err) {
            if (err instanceof PyReError && !err.noSoportado) throw source.error(err.msg, (name ? lenCp(name) : 0) + 1);
            throw err;
          }
        }
        const subVerbose = (verbose || (addFlags & F.VERBOSE)) && !(delFlags & F.VERBOSE);
        const p = parseSub(source, state, subVerbose, nested + 1);
        if (!source.match(')')) throw source.error('missing ), unterminated subpattern', source.tell() - start);
        if (group !== null) state.closegroup(group, p);
        if (atomic) sub.push(['ATOMIC_GROUP', p]);
        else sub.push(['SUBPATTERN', [group, addFlags, delFlags, p]]);
      } else if (esto === '^') {
        sub.push(['AT', 'AT_BEGINNING']);
      } else if (esto === '$') {
        sub.push(['AT', 'AT_END']);
      } else {
        throw new PyReError(`unsupported special character ${repr(esto)}`);
      }
    }
    for (let i = sub.length - 1; i >= 0; i--) {
      const [op, av] = sub[i];
      if (op === 'SUBPATTERN') {
        const [g, add, del, p] = av;
        if (g === null && !add && !del) sub.splice(i, 1, ...p);
      }
    }
    return sub;
  }

  function fixFlags(flags) {
    if (flags & F.LOCALE) throw new PyReError('cannot use LOCALE flag with a str pattern', null, null, { tipo: 'ValueError' });
    if (!(flags & F.ASCII)) flags |= F.UNICODE;
    else if (flags & F.UNICODE) throw new PyReError('ASCII and UNICODE flags are incompatible', null, null, { tipo: 'ValueError' });
    return flags;
  }

  function parsear(cadena, flags = 0) {
    const source = new Tokenizador(cadena);
    const state = new Estado();
    state.flags = flags;
    const p = parseSub(source, state, flags & F.VERBOSE, 0);
    state.flags = fixFlags(state.flags);
    if (source.next !== null) throw source.error('unbalanced parenthesis');
    for (const [g, pos] of state.grouprefpos) {
      if (g >= state.groups) throw new PyReError(`invalid group reference ${g}`, cadena, pos);
    }
    return { p, state };
  }

  // --------------------------------------------------------------------------------------------
  // Traducción del árbol a RegExp 'v'
  // --------------------------------------------------------------------------------------------
  const combinarFlags = (flags, add, del) => (((add & TYPE_FLAGS) ? flags & ~TYPE_FLAGS : flags) | add) & ~del;

  function tieneCaptura(nodos) {
    for (const [op, av] of nodos) {
      if (op === 'SUBPATTERN' && (av[0] !== null || tieneCaptura(av[3]))) return true;
      if (op === 'BRANCH' && av.some(tieneCaptura)) return true;
      if (REPEATCODES.has(op) && tieneCaptura(av[2])) return true;
      if ((op === 'ASSERT' || op === 'ASSERT_NOT') && tieneCaptura(av[1])) return true;
      if (op === 'ATOMIC_GROUP' && tieneCaptura(av)) return true;
    }
    return false;
  }

  function cuantificador(mn, mx) {
    if (mx === MAXREPEAT) return mn === 0 ? '*' : mn === 1 ? '+' : `{${mn},}`;
    if (mn === 0 && mx === 1) return '?';
    return mn === mx ? `{${mn}}` : `{${mn},${mx}}`;
  }

  class Emisor {
    constructor(patron, state, desplazamiento = 0) {
      this.patron = patron;
      this.state = state;
      this.nJs = desplazamiento;
      this.mapa = [0];
      this.cierres = [0];
      this.nCierre = 0;
      this.pila = [];
      this.idAmbito = 0;
      this.ambitoGrupo = [];
    }
    conAmbito(tipo, fn) {
      this.pila.push({ tipo, id: ++this.idAmbito });
      try { return fn(); } finally { this.pila.pop(); }
    }
    secuencia(nodos, flags) {
      let s = '';
      for (let i = 0; i < nodos.length; i++) s += this.nodo(nodos, i, flags);
      return s;
    }
    atomo(p, flags) {
      if (p.length === 1 && ['LITERAL', 'NOT_LITERAL', 'IN', 'ANY'].includes(p[0][0])) return this.nodo(p, 0, flags);
      return '(?:' + this.secuencia(p, flags) + ')';
    }
    /**
     * true si, en el orden de preferencia del motor, los caminos vacíos de la secuencia van detrás de todos los que
     * consumen. Entonces una repetición voraz de ella casa igual en sre (que acepta una vuelta vacía y para) y en RegExp
     * (que descarta la vuelta vacía y para): las dos siguen con la cola en la misma posición.
     */
    vacioAlFinal(nodos) { return nodos.every((n) => this.vacioAlFinalNodo(n)); }
    vacioAlFinalNodo([op, av]) {
      switch (op) {
        case 'SUBPATTERN': return this.vacioAlFinal(av[3]);
        case 'BRANCH': {
          if (!av.every((alt) => this.vacioAlFinal(alt))) return false;
          for (let i = 0; i < av.length; i++) {
            if (anchura(av[i], this.state)[0] > 0) continue;
            for (let j = i + 1; j < av.length; j++) if (anchura(av[j], this.state)[1] > 0) return false;
          }
          return true;
        }
        case 'MAX_REPEAT': return this.vacioAlFinal(av[2]);
        case 'MIN_REPEAT': {
          const [mn, mx, p] = av;
          const [lo, hi] = anchura(p, this.state);
          if (hi === 0 || mx === 0) return true;
          if (mn === mx) return this.vacioAlFinal(p);
          return mn > 0 && lo > 0;
        }
        // Unidades (nunca vacías), anclas, miradas y referencias (un solo camino), grupos atómicos y repeticiones
        // posesivas (un solo camino: el primer éxito).
        default: return true;
      }
    }
    literal(c, flags, negado) {
      if ((flags & F.IGNORECASE) && !(flags & F.LOCALE)) {
        const s = conjuntoLiteralI(c, !(flags & F.UNICODE));
        if (s) return claseDeConjunto(negado ? RS.complemento(s) : s);
      }
      return negado ? claseDeConjunto(RS.complemento([c, c])) : esc(c);
    }
    nodo(nodos, i, flags) {
      const [op, av] = nodos[i];
      switch (op) {
        case 'LITERAL': return this.literal(av, flags, false);
        case 'NOT_LITERAL': return this.literal(av, flags, true);
        case 'ANY': return (flags & F.DOTALL) ? '[\\s\\S]' : '[^\\n]';
        case 'IN': return emitirClase(infoClase(av, flags));
        case 'AT': return this.ancla(av, flags, nodos, i);
        case 'BRANCH':
          return '(?:' + av.map((alt) => this.conAmbito('opcional', () => this.secuencia(alt, flags))).join('|') + ')';
        case 'SUBPATTERN': {
          const [g, add, del, p] = av;
          const f2 = combinarFlags(flags, add, del);
          if (g === null) return '(?:' + this.secuencia(p, f2) + ')';
          let r = -1;
          for (let k = this.pila.length - 1; k >= 0; k--) if (this.pila[k].tipo === 'repeticion') { r = k; break; }
          if (r >= 0 && this.pila.slice(r + 1).some((a) => a.tipo === 'opcional')) {
            throw noSoportado(`el grupo ${g} está dentro de una repetición y puede no participar en su última vuelta`, this.patron);
          }
          this.ambitoGrupo[g] = this.pila.map((a) => a.id);
          this.mapa[g] = ++this.nJs;
          const cuerpo_ = this.secuencia(p, f2);
          this.cierres[g] = ++this.nCierre;
          return '(' + cuerpo_ + ')';
        }
        case 'MAX_REPEAT': case 'MIN_REPEAT': case 'POSSESSIVE_REPEAT': {
          const [mn, mx, p] = av;
          const puedeVacio = mx >= 1 && anchura(p, this.state)[0] === 0;
          if (puedeVacio && tieneCaptura(p)) {
            // sre admite una vuelta vacía más (también con «?») y actualiza la captura; RegExp prohíbe esa vuelta:
            // (|a)?b sobre «b» da group(1) = '' en Python y None en JS.
            throw noSoportado('grupo de captura dentro de una repetición cuyo cuerpo puede casar vacío', this.patron);
          }
          if (puedeVacio && op === 'MAX_REPEAT' && !this.vacioAlFinal(p)) {
            // sre toma la primera vuelta vacía que encuentra y deja de repetir; RegExp la descarta y prueba el siguiente
            // camino del cuerpo, que puede consumir: (?:|x)+ sobre «x» da (0, 0) en Python y (0, 1) en JS.
            throw noSoportado('repetición voraz cuyo cuerpo prefiere casar vacío antes que consumir', this.patron);
          }
          const q = cuantificador(mn, mx);
          const hidden = op === 'POSSESSIVE_REPEAT' ? ++this.nJs : 0;
          // sre casa cada vuelta de una repetición posesiva compuesta como un grupo atómico (primer éxito del cuerpo, sin
          // volver a vueltas anteriores): (?:a|ab){2}+ no casa en «abab». Un átomo de un carácter no lo necesita.
          const vuelta = op === 'POSSESSIVE_REPEAT' && !esSimple(p) ? ++this.nJs : 0;
          const conRep = () => (mx > 1 ? this.conAmbito('repeticion', () => this.atomo(p, flags)) : this.atomo(p, flags));
          let cuerpo_ = mn === 0 ? this.conAmbito('opcional', conRep) : conRep();
          if (vuelta) cuerpo_ = `(?:(?=(${cuerpo_}))\\${vuelta})`;
          if (op === 'POSSESSIVE_REPEAT') return `(?=(${cuerpo_}${q}))(?:\\${hidden})`;
          return cuerpo_ + q + (op === 'MIN_REPEAT' ? '?' : '');
        }
        case 'ASSERT': case 'ASSERT_NOT': {
          const [dir, p] = av;
          if (dir < 0) {
            const [lo, hi] = anchura(p, this.state);
            if (lo > MAXCODE) throw new PyReError('looks too much behind');
            if (lo !== hi) throw new PyReError('look-behind requires fixed-width pattern');
          }
          const pre = dir > 0 ? (op === 'ASSERT' ? '(?=' : '(?!') : (op === 'ASSERT' ? '(?<=' : '(?<!');
          const cuerpo_ = op === 'ASSERT_NOT'
            ? this.conAmbito('opcional', () => this.secuencia(p, flags)) : this.secuencia(p, flags);
          return pre + cuerpo_ + ')';
        }
        case 'ATOMIC_GROUP': {
          const hidden = ++this.nJs;
          return `(?=(${this.secuencia(av, flags)}))(?:\\${hidden})`;
        }
        case 'GROUPREF': {
          if (flags & F.IGNORECASE) throw noSoportado('referencia a un grupo con IGNORECASE', this.patron);
          const amb = this.ambitoGrupo[av], actual = this.pila.map((a) => a.id);
          if (!amb || amb.length > actual.length || amb.some((id, k) => actual[k] !== id)) {
            throw noSoportado(`referencia al grupo ${av}, que puede no participar`, this.patron);
          }
          return `(?:\\${this.mapa[av]})`;
        }
        case 'GROUPREF_EXISTS':
          throw noSoportado('grupo condicional (?(…)…|…)', this.patron);
        default:
          throw new PyReError(`internal: unsupported operand type ${op}`);
      }
    }
    conjuntoNodo(nodo, flags) {
      const [op, av] = nodo;
      const ascii = !(flags & F.UNICODE);
      const ignore = (flags & F.IGNORECASE) && !(flags & F.LOCALE);
      if (op === 'LITERAL' || op === 'NOT_LITERAL') {
        const s = (ignore && conjuntoLiteralI(av, ascii)) || [av, av];
        return op === 'LITERAL' ? s : RS.complemento(s);
      }
      if (op === 'ANY') return (flags & F.DOTALL) ? [0, MAX_CP] : RS.complemento([10, 10]);
      if (op === 'IN') return conjuntoClase(infoClase(av, flags));
      return null;
    }
    /** [conjunto de primeros caracteres consumidos, puede no consumir nada] de una secuencia. */
    primeros(nodos, flags) {
      let acc = [];
      for (const n of nodos) {
        const [s, nul] = this.primerosNodo(n, flags);
        acc = RS.union(acc, s);
        if (!nul) return [acc, false];
      }
      return [acc, true];
    }
    primerosNodo(nodo, flags) {
      const [op, av] = nodo;
      switch (op) {
        case 'LITERAL': case 'NOT_LITERAL': case 'IN': case 'ANY': return [this.conjuntoNodo(nodo, flags), false];
        case 'AT': case 'ASSERT': case 'ASSERT_NOT': return [[], true];
        case 'SUBPATTERN': return this.primeros(av[3], combinarFlags(flags, av[1], av[2]));
        case 'ATOMIC_GROUP': return this.primeros(av, flags);
        case 'BRANCH': {
          let acc = [], nul = false;
          for (const alt of av) { const [s, n] = this.primeros(alt, flags); acc = RS.union(acc, s); nul = nul || n; }
          return [acc, nul];
        }
        case 'MAX_REPEAT': case 'MIN_REPEAT': case 'POSSESSIVE_REPEAT': {
          if (av[1] === 0) return [[], true];
          const [s, n] = this.primeros(av[2], flags);
          return [s, n || av[0] === 0];
        }
        default: return [[0, MAX_CP], true];
      }
    }
    /** Conjunto del primer (o último) carácter de un nodo que siempre consume, o null. */
    extremo(nodo, flags, final) {
      const [op, av] = nodo;
      switch (op) {
        case 'LITERAL': case 'NOT_LITERAL': case 'IN': case 'ANY': return this.conjuntoNodo(nodo, flags);
        case 'SUBPATTERN': {
          const p = av[3];
          return p.length ? this.extremo(p[final ? p.length - 1 : 0], combinarFlags(flags, av[1], av[2]), final) : null;
        }
        case 'BRANCH': {
          let u = [];
          for (const alt of av) {
            if (!alt.length) return null;
            const s = this.extremo(alt[final ? alt.length - 1 : 0], flags, final);
            if (!s) return null;
            u = RS.union(u, s);
          }
          return u;
        }
        case 'MAX_REPEAT': case 'MIN_REPEAT': case 'POSSESSIVE_REPEAT': {
          const p = av[2];
          return av[0] >= 1 && p.length ? this.extremo(p[final ? p.length - 1 : 0], flags, final) : null;
        }
        case 'ATOMIC_GROUP':
          return av.length ? this.extremo(av[final ? av.length - 1 : 0], flags, final) : null;
        default:
          return null;
      }
    }
    ancla(av, flags, nodos, i) {
      const ml = flags & F.MULTILINE;
      switch (av) {
        // Sin el flag 'm' (las RegExp de este módulo nunca lo llevan), ^ de JS solo casa en el índice 0, también
        // con lastIndex > 0: es exactamente (?<![\s\S]) y no depende de una mirada atrás, que JavaScriptCore
        // (WebKit 26.4) evalúa mal justo detrás de un carácter fuera del BMP.
        case 'AT_BEGINNING': return ml ? '(?<![^\\n])' : '^';
        case 'AT_BEGINNING_STRING': return '^';
        case 'AT_END': return ml ? '(?![^\\n])' : '(?=\\n?(?![\\s\\S]))';
        case 'AT_END_STRING': return '(?![\\s\\S])';
        case 'AT_BOUNDARY': case 'AT_NON_BOUNDARY': {
          const esB = av === 'AT_BOUNDARY';
          const ascii = !(flags & F.UNICODE);
          const W = emisionCategoria('CATEGORY_WORD', ascii);
          const Wset = conjuntoCategoria('CATEGORY_WORD', ascii);
          const sig = i + 1 < nodos.length ? this.extremo(nodos[i + 1], flags, false) : null;
          if (sig) {
            if (RS.subconjunto(sig, Wset)) return esB ? `(?<!${W})` : `(?<=${W})`;
            if (RS.interseccion(sig, Wset).length === 0) return esB ? `(?<=${W})` : `(?<!${W})`;
          }
          const ant = i > 0 ? this.extremo(nodos[i - 1], flags, true) : null;
          if (ant) {
            if (RS.subconjunto(ant, Wset)) return esB ? `(?!${W})` : `(?=${W})`;
            if (RS.interseccion(ant, Wset).length === 0) return esB ? `(?=${W})` : `(?!${W})`;
          }
          return esB
            ? `(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))`
            : `(?:(?<=${W})(?=${W})|(?<!${W})(?!${W})(?:(?<=[\\s\\S])|(?=[\\s\\S])))`;
        }
        default:
          throw new PyReError(`internal: unsupported AT ${av}`);
      }
    }
  }

  // --------------------------------------------------------------------------------------------
  // Plantillas de reemplazo (re/_parser.py parse_template)
  // --------------------------------------------------------------------------------------------
  function parsePlantilla(fuente, patron) {
    const s = new Tokenizador(fuente);
    const partes = [];
    let literal = '';
    const addGroup = (index, pos) => {
      if (index > patron.groups) throw s.error(`invalid group reference ${index}`, pos);
      if (literal) partes.push(literal);
      literal = '';
      partes.push(index);
    };
    while (true) {
      let esto = s.get();
      if (esto === null) break;
      if (esto[0] === '\\') {
        const c = Array.from(esto)[1];
        if (c === 'g') {
          if (!s.match('<')) throw s.error('missing <');
          const name = s.getuntil('>', 'group name');
          let index;
          if (!decimalAscii(name)) {
            s.checkgroupname(name, 1);
            index = patron._nombres.get(name);
            if (index === undefined) throw new PyReError(`unknown group name ${repr(name)}`, null, null, { tipo: 'IndexError' });
          } else {
            index = Number(name);
            if (index >= MAXGROUPS) throw s.error(`invalid group reference ${index}`, lenCp(name) + 1);
          }
          addGroup(index, lenCp(name) + 1);
        } else if (c === '0') {
          if (s.next !== null && OCTDIGITS.has(s.next)) {
            esto += s.get();
            if (s.next !== null && OCTDIGITS.has(s.next)) esto += s.get();
          }
          literal += String.fromCodePoint(parseInt(esto.slice(1), 8) & 0xff);
        } else if (DIGITS.has(c)) {
          let octal = false;
          if (s.next !== null && DIGITS.has(s.next)) {
            esto += s.get();
            if (OCTDIGITS.has(c) && OCTDIGITS.has(esto[2]) && s.next !== null && OCTDIGITS.has(s.next)) {
              esto += s.get();
              octal = true;
              const v = parseInt(esto.slice(1), 8);
              if (v > 0o377) throw s.error(`octal escape value ${esto} outside of range 0-0o377`, esto.length);
              literal += String.fromCodePoint(v);
            }
          }
          if (!octal) addGroup(Number(esto.slice(1)), esto.length - 1);
        } else {
          const e = ESCAPES.get(esto);
          if (e !== undefined) literal += String.fromCodePoint(e);
          else if (ASCIILETTERS.has(c)) throw s.error(`bad escape ${esto}`, lenCp(esto));
          else literal += esto;
        }
      } else {
        literal += esto;
      }
    }
    if (literal) partes.push(literal);
    return partes;
  }

  // --------------------------------------------------------------------------------------------
  // Pattern y Match
  // --------------------------------------------------------------------------------------------
  const SIN_FIN = '(?![\\s\\S])';

  /**
   * rx.exec(t) con los errores de recursos del motor convertidos en R2.py.re.error (motorAgotado, tipo RecursionError).
   * SpiderMonkey (Firefox 148) lanza InternalError «too much recursion» cuando la pila de retroceso de una RegExp se
   * agota (diario._DASH_UNIT sobre 3.000 espacios); Python sí termina. Así el llamante recibe un error tipado.
   */
  function ejecutar(rx, t, patron) {
    try {
      return rx.exec(t);
    } catch (err) {
      if (err instanceof PyReError || err instanceof TypeError || err instanceof SyntaxError) throw err;
      const msg = String((err && err.message) || err);
      if (err instanceof RangeError || (err && err.name === 'InternalError')
        || /recursion|call stack|stack overflow|out of memory|too (?:big|large)/i.test(msg)) {
        throw new PyReError(`el motor se quedó sin pila o sin memoria (${err && err.name}: ${msg.slice(0, 120)})`, patron,
          null, { tipo: 'RecursionError', motorAgotado: true });
      }
      throw err;
    }
  }

  class Match {
    constructor(re, string, pos, endpos, m, variante) {
      this.re = re;
      this.string = string;
      this.pos = pos;
      this.endpos = endpos;
      this._m = m;
      this._v = variante;
      this._ind = null;
    }
    _js(i) { return i === 0 ? 0 : this.re._mapa[i] + (this._v === 'ne' ? 1 : 0); }
    _valor(i) { const v = this._m[this._js(i)]; return v === undefined ? null : v; }
    group(...args) {
      if (args.length === 0) return this._m[0];
      if (args.length === 1) return this._valor(this.re._indice(args[0]));
      return args.map((a) => this._valor(this.re._indice(a)));
    }
    groups(defecto = null) {
      const out = [];
      for (let g = 1; g <= this.re.groups; g++) { const v = this._valor(g); out.push(v === null ? defecto : v); }
      return out;
    }
    groupdict(defecto = null) {
      const out = {};
      for (const [n, g] of this.re._nombres) { const v = this._valor(g); out[n] = v === null ? defecto : v; }
      return out;
    }
    span(g = 0) {
      const i = this.re._indice(g);
      if (i === 0) return [this._m.index, this._m.index + this._m[0].length];
      const j = this._js(i);
      if (this._m[j] === undefined) return [-1, -1];
      if (!this._ind) {
        const rx = this.re._re(this._v + 'd');
        rx.lastIndex = this._m.index;
        const t = this.endpos < this.string.length ? this.string.slice(0, this.endpos) : this.string;
        this._ind = ejecutar(rx, t, this.re.pattern).indices;
      }
      const par = this._ind[j];
      return par ? [par[0], par[1]] : [-1, -1];
    }
    start(g = 0) { return this.span(g)[0]; }
    end(g = 0) { return this.span(g)[1]; }
    /**
     * Último grupo que sre cerró al ejecutar (no el que acaba más tarde): con las construcciones soportadas es el grupo
     * participante cuyo paréntesis de cierre va más tarde en el patrón. Así (?=(abc))(a) da 2 y (ab)(?<=(a)b) da 2.
     */
    get lastindex() {
      let mejor = null, orden = -1;
      for (let g = 1; g <= this.re.groups; g++) {
        if (this._valor(g) === null) continue;
        if (this.re._cierres[g] > orden) { mejor = g; orden = this.re._cierres[g]; }
      }
      return mejor;
    }
    get lastgroup() {
      const li = this.lastindex;
      if (li === null) return null;
      for (const [n, g] of this.re._nombres) if (g === li) return n;
      return null;
    }
    expand(plantilla) { return expandir(this.re._plantilla(plantilla), this); }
  }

  function expandir(partes, m) {
    let s = '';
    for (const p of partes) {
      if (typeof p === 'string') s += p;
      else { const v = m._valor(p); if (v !== null) s += v; }
    }
    return s;
  }

  /** pos y endpos recortados a [0, len] como en _sre (sin intercambiarlos: endpos puede quedar < pos). */
  function normalizarPos(s, pos, endpos) {
    if (typeof s !== 'string') throw new TypeError('se esperaba una cadena');
    const n = s.length;
    let p = pos == null ? 0 : Math.trunc(pos);
    let e = endpos == null ? n : Math.trunc(endpos);
    p = p < 0 ? 0 : p > n ? n : p;
    e = e < 0 ? 0 : e > n ? n : e;
    return [p, e];
  }

  // --------------------------------------------------------------------------------------------
  // match() con endpos < pos
  // --------------------------------------------------------------------------------------------
  // _sre ejecuta el patrón con el puntero en pos y el final en endpos < pos. Toda operación que consume (literal, clase,
  // '.', referencia no vacía, repetición de un átomo: REPEAT_ONE exige min <= end - ptr) falla, y también una mirada
  // atrás de anchura k ≥ 1 (su último carácter queda en ≥ endpos). Solo casan, en pos, anclas, miradas de anchura cero,
  // grupos vacíos, alternativas y repeticiones de cuerpos compuestos, con la protección de vuelta vacía de MAX_UNTIL,
  // MIN_UNTIL y POSSESSIVE_REPEAT. search, fullmatch, finditer y findall no casan nunca (sre_search sale si ptr > end;
  // fullmatch exige ptr == end).
  function esSimple(p) {
    if (p.length !== 1) return false;
    const [op, av] = p[0];
    if (op === 'SUBPATTERN') return av[0] === null && esSimple(av[3]);
    return UNITCODES.has(op);
  }
  function cpAnterior(s, p) {
    const c = s.charCodeAt(p - 1);
    if (c >= 0xDC00 && c <= 0xDFFF && p >= 2) {
      const h = s.charCodeAt(p - 2);
      if (h >= 0xD800 && h <= 0xDBFF) return (h - 0xD800) * 0x400 + (c - 0xDC00) + 0x10000;
    }
    return c;
  }
  const primero = (it) => { const r = it.next(); return r.done ? null : r.value; };
  /** Estados de captura (lista de grupos cerrados, en orden) con los que la secuencia casa vacía en ctx.p. */
  function* zSec(ctx, nodos, i, flags, caps) {
    if (i === nodos.length) { yield caps; return; }
    for (const c of zNodo(ctx, nodos[i], flags, caps)) yield* zSec(ctx, nodos, i + 1, flags, c);
  }
  function* zRep(ctx, op, mn, mx, p, flags, count, protegido, caps) {
    const cuerpo = (c) => zSec(ctx, p, 0, flags, c);
    if (count < mn) {
      for (const c of cuerpo(caps)) yield* zRep(ctx, op, mn, mx, p, flags, count + 1, protegido, c);
      return;
    }
    const otra = (count < mx || mx === MAXREPEAT) && !protegido;
    if (op === 'MAX_REPEAT') {
      if (otra) for (const c of cuerpo(caps)) yield* zRep(ctx, op, mn, mx, p, flags, count + 1, true, c);
      yield caps;
    } else {
      yield caps;
      if (otra) for (const c of cuerpo(caps)) yield* zRep(ctx, op, mn, mx, p, flags, count + 1, true, c);
    }
  }
  function* zNodo(ctx, nodo, flags, caps) {
    const [op, av] = nodo;
    switch (op) {
      case 'AT': {
        const { s, p, e } = ctx;
        const ascii = !(flags & F.UNICODE);
        const palabra = () => RS.contiene(ascii ? ASCII_W : tb().W, cpAnterior(s, p));
        let ok;
        switch (av) {
          case 'AT_BEGINNING': ok = (flags & F.MULTILINE) ? s.charCodeAt(p - 1) === 10 : false; break;
          case 'AT_BEGINNING_STRING': case 'AT_END_STRING': ok = false; break;
          case 'AT_END': ok = (flags & F.MULTILINE) ? p < s.length && s.charCodeAt(p) === 10 : false; break;
          case 'AT_BOUNDARY': ok = e !== 0 && palabra(); break;
          case 'AT_NON_BOUNDARY': ok = e !== 0 && !palabra(); break;
          default: throw new PyReError(`internal: unsupported AT ${av}`);
        }
        if (ok) yield caps;
        return;
      }
      case 'SUBPATTERN': {
        const [g, add, del, p] = av;
        for (const c of zSec(ctx, p, 0, combinarFlags(flags, add, del), caps)) yield g === null ? c : [...c, g];
        return;
      }
      case 'BRANCH':
        for (const alt of av) yield* zSec(ctx, alt, 0, flags, caps);
        return;
      case 'ATOMIC_GROUP': {
        const c = primero(zSec(ctx, av, 0, flags, caps));
        if (c) yield c;
        return;
      }
      case 'ASSERT': case 'ASSERT_NOT': {
        const [dir, p] = av;
        const c = dir < 0 && anchura(p, ctx.state)[0] >= 1 ? null : primero(zSec(ctx, p, 0, flags, caps));
        if (op === 'ASSERT' && c) yield c;
        else if (op === 'ASSERT_NOT' && !c) yield caps;
        return;
      }
      case 'MAX_REPEAT': case 'MIN_REPEAT': case 'POSSESSIVE_REPEAT': {
        const [mn, mx, p] = av;
        if (esSimple(p)) return;
        if (op !== 'POSSESSIVE_REPEAT') { yield* zRep(ctx, op, mn, mx, p, flags, 0, false, caps); return; }
        let actual = caps, count = 0;
        for (; count < mn; count++) {
          actual = primero(zSec(ctx, p, 0, flags, actual));
          if (!actual) return;
        }
        if (count < mx || mx === MAXREPEAT) {
          const c = primero(zSec(ctx, p, 0, flags, actual));
          if (c) actual = c;
        }
        yield actual;
        return;
      }
      case 'GROUPREF':
        if (caps.includes(av)) yield caps;
        return;
      default:
        return; // LITERAL, NOT_LITERAL, IN, ANY: consumen
    }
  }
  const avance = (t, i) => {
    const c = t.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < t.length) {
      const d = t.charCodeAt(i + 1);
      if (d >= 0xDC00 && d <= 0xDFFF) return 2;
    }
    return 1;
  };

  class Pattern {
    constructor(pattern, flags) {
      const { p, state } = parsear(pattern, flags);
      this.pattern = pattern;
      this.flags = flags | state.flags;
      this.groups = state.groups - 1;
      this._nombres = new Map(state.groupdict);
      this.groupindex = Object.freeze(Object.fromEntries(state.groupdict));
      this._arbol = p;
      this._state = state;
      const em = new Emisor(pattern, state, 0);
      this._fuente = em.secuencia(p, this.flags);
      this._mapa = em.mapa;
      this._cierres = em.cierres;
      this._anchura = anchura(p, state);
      this._rx = Object.create(null);
      this._plantillas = new Map();
      this._re('g');
    }
    _fuenteNe() {
      if (this._fuenteNeCache === undefined) this._fuenteNeCache = new Emisor(this.pattern, this._state, 1).secuencia(this._arbol, this.flags);
      return this._fuenteNeCache;
    }
    _re(tipo) {
      let r = this._rx[tipo];
      if (r) return r;
      const f = this._fuente;
      try {
        switch (tipo) {
          case 'g': r = new RegExp(f, 'gv'); break;
          case 'n': r = new RegExp(f, 'yv'); break;
          case 'nd': r = new RegExp(f, 'dyv'); break;
          case 'f': r = new RegExp(`(?:${f})${SIN_FIN}`, 'yv'); break;
          case 'fd': r = new RegExp(`(?:${f})${SIN_FIN}`, 'dyv'); break;
          case 'ne': r = new RegExp(`(?=([\\s\\S]*))(?:${this._fuenteNe()})(?!\\1)`, 'yv'); break;
          case 'ned': r = new RegExp(`(?=([\\s\\S]*))(?:${this._fuenteNe()})(?!\\1)`, 'dyv'); break;
          default: throw new Error(tipo);
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new PyReError(`la traducción a RegExp falla (${err.message.slice(0, 200)})`, this.pattern, null, { noSoportado: true });
        }
        throw err;
      }
      this._rx[tipo] = r;
      return r;
    }
    _indice(g) {
      if (typeof g === 'number' && Number.isInteger(g) && g >= 0 && g <= this.groups) return g;
      if (typeof g === 'string' && this._nombres.has(g)) return this._nombres.get(g);
      throw new PyReError('no such group', null, null, { tipo: 'IndexError' });
    }
    _plantilla(repl) {
      let p = this._plantillas.get(repl);
      if (!p) { p = parsePlantilla(repl, this); this._plantillas.set(repl, p); }
      return p;
    }
    /** Primeros caracteres posibles de una coincidencia no vacía (rangos planos). */
    _primeros() {
      if (!this._primerosCache) this._primerosCache = new Emisor(this.pattern, this._state).primeros(this._arbol, this.flags)[0];
      return this._primerosCache;
    }
    /**
     * Búsqueda cruda en t (= string[:endpos]) desde `desde`, como sre_search. Con mustAdvance (la
     * coincidencia anterior fue vacía y acabó en `desde`) no puede volver a casar vacío en `desde`:
     * se prueba allí la variante que exige avanzar (solo si el patrón puede casar vacío y el carácter
     * de `desde` puede empezar una coincidencia no vacía) y, si no, se busca desde el carácter siguiente.
     * Devuelve [exec, variante] o null.
     */
    _buscar(t, desde, mustAdvance) {
      if (desde > t.length) return null;
      if (mustAdvance && this._anchura[0] === 0) {
        if (desde < t.length && RS.contiene(this._primeros(), t.codePointAt(desde))) {
          const ne = this._re('ne');
          ne.lastIndex = desde;
          const m = ejecutar(ne, t, this.pattern);
          if (m) return [m, 'ne'];
        }
        if (desde >= t.length) return null;
        desde += avance(t, desde);
      }
      const g = this._re('g');
      let i = desde;
      while (true) {
        g.lastIndex = i;
        const m = ejecutar(g, t, this.pattern);
        if (!m) return null;
        // V8 prueba también posiciones entre las dos mitades de un par sustituto, donde una mirada
        // atrás o adelante ve un «principio» o un «final» falso. Python no tiene esas posiciones.
        const k = m.index;
        if (k > 0 && k < t.length && (t.charCodeAt(k) & 0xFC00) === 0xDC00 && (t.charCodeAt(k - 1) & 0xFC00) === 0xD800) {
          i = k + 1;
          continue;
        }
        if (mustAdvance && k < desde) throw new Error('re.js: la búsqueda no avanza (error interno)');
        return [m, 'n'];
      }
    }
    _valorCrudo(m, v, g) { const x = m[this._mapa[g] + (v === 'ne' ? 1 : 0)]; return x === undefined ? null : x; }

    /** match() con endpos < pos (ver zSec): solo casa vacía en pos. */
    _matchInvertido(string, p, e) {
      const caps = primero(zSec({ s: string, p, e, state: this._state }, this._arbol, 0, this.flags, []));
      if (!caps) return null;
      const m = [''];
      m.index = p;
      const ind = [[p, p]];
      for (let g = 1; g <= this.groups; g++) {
        if (caps.includes(g)) { m[this._mapa[g]] = ''; ind[this._mapa[g]] = [p, p]; }
      }
      const r = new Match(this, string, p, e, m, 'n');
      r._ind = ind;
      return r;
    }

    search(string, pos, endpos) {
      const [p, e] = normalizarPos(string, pos, endpos);
      if (e < p) return null;
      const t = e < string.length ? string.slice(0, e) : string;
      const r = this._buscar(t, p, false);
      return r ? new Match(this, string, p, e, r[0], r[1]) : null;
    }
    match(string, pos, endpos) {
      const [p, e] = normalizarPos(string, pos, endpos);
      if (e < p) return this._matchInvertido(string, p, e);
      const t = e < string.length ? string.slice(0, e) : string;
      const rx = this._re('n');
      rx.lastIndex = p;
      const m = ejecutar(rx, t, this.pattern);
      return m ? new Match(this, string, p, e, m, 'n') : null;
    }
    fullmatch(string, pos, endpos) {
      const [p, e] = normalizarPos(string, pos, endpos);
      if (e < p) return null;
      const t = e < string.length ? string.slice(0, e) : string;
      const rx = this._re('f');
      rx.lastIndex = p;
      const m = ejecutar(rx, t, this.pattern);
      return m ? new Match(this, string, p, e, m, 'f') : null;
    }
    *finditer(string, pos, endpos) {
      const [p, e] = normalizarPos(string, pos, endpos);
      if (e < p) return;
      const t = e < string.length ? string.slice(0, e) : string;
      let desde = p, must = false;
      while (true) {
        const r = this._buscar(t, desde, must);
        if (!r) return;
        const [m, v] = r;
        const ini = m.index, fin = ini + m[0].length;
        yield new Match(this, string, p, e, m, v);
        must = fin === ini;
        desde = fin;
      }
    }
    findall(string, pos, endpos) {
      const [p, e] = normalizarPos(string, pos, endpos);
      if (e < p) return [];
      const t = e < string.length ? string.slice(0, e) : string;
      const out = [];
      const ng = this.groups;
      let desde = p, must = false;
      while (true) {
        const r = this._buscar(t, desde, must);
        if (!r) break;
        const [m, v] = r;
        if (ng === 0) out.push(m[0]);
        else if (ng === 1) out.push(this._valorCrudo(m, v, 1) ?? '');
        else {
          const tupla = [];
          for (let g = 1; g <= ng; g++) tupla.push(this._valorCrudo(m, v, g) ?? '');
          out.push(tupla);
        }
        const fin = m.index + m[0].length;
        must = fin === m.index;
        desde = fin;
      }
      return out;
    }
    subn(repl, string, count = 0) {
      if (typeof string !== 'string') throw new TypeError('se esperaba una cadena');
      let fn = null, literal = null;
      if (typeof repl === 'function') fn = repl;
      else if (typeof repl !== 'string') throw new TypeError('repl debe ser una cadena o una función');
      else if (!repl.includes('\\')) literal = repl;
      else {
        const partes = this._plantilla(repl);
        if (partes.every((x) => typeof x === 'string')) literal = partes.join('');
        else fn = (m) => expandir(partes, m);
      }
      let out = '', i = 0, n = 0, desde = 0, must = false;
      while (!count || n < count) {
        const r = this._buscar(string, desde, must);
        if (!r) break;
        const [m, v] = r;
        const b = m.index, e = b + m[0].length;
        if (i < b) out += string.slice(i, b);
        if (literal !== null) out += literal;
        else {
          const item = fn(new Match(this, string, 0, string.length, m, v));
          if (item !== null && item !== undefined) {
            if (typeof item !== 'string') throw new TypeError('la función de reemplazo debe devolver una cadena');
            out += item;
          }
        }
        i = e;
        n++;
        must = e === b;
        desde = e;
      }
      if (i < string.length) out += string.slice(i);
      return [out, n];
    }
    sub(repl, string, count = 0) { return this.subn(repl, string, count)[0]; }
    split(string, maxsplit = 0) {
      if (typeof string !== 'string') throw new TypeError('se esperaba una cadena');
      const out = [];
      let last = 0, n = 0, desde = 0, must = false;
      while (!maxsplit || n < maxsplit) {
        const r = this._buscar(string, desde, must);
        if (!r) break;
        const [m, v] = r;
        const b = m.index, e = b + m[0].length;
        out.push(string.slice(last, b));
        for (let g = 1; g <= this.groups; g++) out.push(this._valorCrudo(m, v, g));
        n++;
        must = e === b;
        last = desde = e;
      }
      out.push(string.slice(last));
      return out;
    }
  }

  // --------------------------------------------------------------------------------------------
  // API del módulo
  // --------------------------------------------------------------------------------------------
  const CACHE = new Map();
  const MAX_CACHE = 4096;
  function compile(pattern, flags = 0) {
    if (pattern instanceof Pattern) {
      if (flags) throw new PyReError('cannot process flags argument with a compiled pattern', null, null, { tipo: 'ValueError' });
      return pattern;
    }
    if (typeof pattern !== 'string') throw new TypeError('first argument must be string or compiled pattern');
    const k = flags + ' ' + pattern;
    let p = CACHE.get(k);
    if (p) return p;
    p = new Pattern(pattern, flags);
    if (CACHE.size >= MAX_CACHE) CACHE.delete(CACHE.keys().next().value);
    CACHE.set(k, p);
    return p;
  }

  const ESPECIALES = new Set('()[]{}?*+-|^$\\.&~# \t\n\r\v\f');
  function escape(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) out += ESPECIALES.has(s[i]) ? '\\' + s[i] : s[i];
    return out;
  }

  R2.py.re = {
    ...F,
    I: F.IGNORECASE, L: F.LOCALE, M: F.MULTILINE, S: F.DOTALL, U: F.UNICODE, X: F.VERBOSE, A: F.ASCII,
    error: PyReError,
    Pattern,
    Match,
    compile,
    search: (p, s, flags = 0) => compile(p, flags).search(s),
    match: (p, s, flags = 0) => compile(p, flags).match(s),
    fullmatch: (p, s, flags = 0) => compile(p, flags).fullmatch(s),
    finditer: (p, s, flags = 0) => compile(p, flags).finditer(s),
    findall: (p, s, flags = 0) => compile(p, flags).findall(s),
    sub: (p, repl, s, count = 0, flags = 0) => compile(p, flags).sub(repl, s, count),
    subn: (p, repl, s, count = 0, flags = 0) => compile(p, flags).subn(repl, s, count),
    split: (p, s, maxsplit = 0, flags = 0) => compile(p, flags).split(s, maxsplit),
    escape,
    purge: () => CACHE.clear(),
    /** Para pruebas y diagnóstico. */
    _interno: {
      TABLAS, RS, tablas: tb, motor, parsear, ejecutar,
      arbol: (patron, flags = 0) => parsear(patron, flags).p,
      anchura: (patron, flags = 0) => { const { p, state } = parsear(patron, flags); return anchura(p, state); },
      fuente: (patron, flags = 0) => compile(patron, flags)._fuente,
      /** Conjunto (rangos planos) de un patrón de un solo carácter: literal, clase o '.'. */
      conjuntoAtomo(patron, flags = 0) {
        const { p, state } = parsear(patron, flags);
        if (p.length !== 1) throw new Error(`no es un átomo: ${patron}`);
        const s = new Emisor(patron, state).conjuntoNodo(p[0], flags | state.flags);
        if (!s) throw new Error(`no es un átomo: ${patron}`);
        return s;
      },
    },
  };
})(globalThis.R2 = globalThis.R2 || {});

/* ===== src/engine/py/core.js ===== */
/* 2REP_Standalone · engine/py/core.js
 *
 * R2.py.core: semántica de Python 3.12 (unicodedata 15.0.0) que el backend usa y JavaScript no tiene igual.
 *
 * - Números: round() con mitad a par y ndigits (también negativos), repr() de float, str(None), format() con el
 *   minilenguaje de especificaciones (tipos d x X o b f F % y sin tipo; relleno, alineación, signo, z, #, 0, ancho,
 *   «,» y «_», precisión), fmtFixed y miles.
 * - Orden: comparación de Python (números, cadenas por punto de código, tuplas elemento a elemento), sorted()
 *   estable con key y reverse, la clave _clave_sql (NULL primero), bisect_left/bisect_right, max/min con key.
 * - Counter con most_common y desempate por orden de inserción.
 * - Cadenas: strip/lstrip/rstrip, split/rsplit, splitlines, partition/rpartition, startswith/endswith (índices en
 *   puntos de código), translate/maketrans, repr(), len() en puntos de código; predicados isupper, islower,
 *   istitle, isdigit, isdecimal, isnumeric, isalpha, isalnum, isspace, isprintable, isascii; lower, upper, title,
 *   capitalize y casefold con los mapeos completos (ß → SS) y la sigma final.
 * - strftime() con la hora local (locale C).
 *
 * Tablas Unicode: el bloque <tablas-unicode> lo escribe parity/oracle/dump_units_py.py --tablas a partir de los
 * métodos de str de Python 3.12.7, en el formato compacto de M1 (worker/transformar.js). No dependen del Unicode
 * del motor. lower/upper/casefold usan toLowerCase/toUpperCase del motor solo si todos los caracteres de la cadena
 * dan en el motor el mismo mapeo que en Python (comprobado carácter a carácter en el primer uso) y no hay sigma.
 *
 * Convención de tipos (Python → JS):
 *   None → null · bool → boolean · int → number entero (o BigInt) · float → number no entero o PyFloat (F(x))
 *   str → string · list/tuple → Array · dict → Map (orden de inserción y claves no str) u objeto.
 * Un float con valor entero (3.0) debe ir envuelto en PyFloat para que se escriba «3.0».
 */
(function (R2) {
  'use strict';

  // <tablas-unicode>
  // Generado por parity/oracle/dump_units_py.py --tablas con Python 3.12.7 (unicodedata 15.0.0). No editar a mano.
  const TABLAS = Object.freeze({
    upper: '1t,p,2u,m,2,6,y,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,3,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,3,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,1,2,0,2,0,4,1,2,0,2,1,2,2,3,3,2,1,2,2,4,1,2,1,2,0,2,0,2,1,2,0,3,0,2,1,2,2,2,0,2,1,4,0,8,0,3,0,3,0,3,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,3,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,3,0,3,0,2,2,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,8,1,2,1,3,0,2,3,2,0,2,0,2,0,2,0,82,0,2,0,4,0,9,0,7,0,2,2,2,0,2,1,2,g,2,8,10,0,3,2,4,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,6,0,3,0,2,1,3,1e,1d,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,a,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,1,2,0,2,0,2,0,2,0,2,0,2,0,3,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,3,11,28a,11,2,0,6,0,k3,2d,1p7,16,3,2,8x,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,a,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,a,7,9,5,b,7,9,7,9,5,c,0,2,0,2,0,2,0,9,7,21,3,d,3,d,3,d,4,c,3,7b,0,5,0,4,2,3,2,3,0,4,4,7,0,2,0,2,0,2,3,3,3,b,1,6,0,r,f,k,0,mr,p,1f5,1b,1d,0,2,2,3,0,2,0,2,0,2,3,2,0,3,0,9,2,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,9,0,2,0,5,0,nym,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,k,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,3s,0,2,0,2,0,2,0,2,0,2,0,2,0,4,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,b,0,2,0,2,1,2,0,2,0,2,0,2,0,5,0,2,0,3,0,2,0,4,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,4,2,4,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,3,2,0,7,0,6,0,2,0,t,0,h7w,p,xy,13,3t,z,4d,a,2,e,2,6,2,1,1d7,1e,2cu,v,gw1,v,k2p,p,r,p,r,p,r,0,2,1,3,0,3,1,3,3,2,7,r,p,r,1,2,3,3,7,2,6,s,1,2,3,2,4,2,0,4,6,s,p,r,p,r,p,r,p,r,p,r,p,v,o,y,o,y,o,y,o,y,o,y,0,3ee,x,1lb,p,7,p,7,p',
    lower: '2p,p,1c,0,b,0,5,0,11,n,2,7,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,1,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,1,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,3,0,2,0,2,2,3,0,2,0,3,0,4,1,5,0,3,0,4,2,3,0,3,0,2,0,2,0,3,0,2,1,2,0,3,0,4,0,2,0,3,1,3,2,7,0,3,0,3,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,1,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,1,3,0,2,0,4,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,6,3,0,3,1,2,0,5,0,2,0,2,0,2,0,2,1w,2,z,8,1,v,4,2p,0,18,0,2,0,4,0,3,3,j,0,s,y,2,1,4,2,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,4,2,0,3,0,3,1,1g,1b,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,a,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,3,0,2,0,2,0,2,0,2,0,2,0,2,1,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,1d,14,288,16,2,3,l5,5,1oj,8,3c,5b,1u,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,8,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,8,9,5,b,7,9,7,9,5,b,7,9,7,9,d,3,7,9,7,9,7,9,4,2,1,7,0,4,2,2,1,9,3,3,1,9,7,b,2,2,1,3e,0,e,0,h,c,32,0,4,1,4,0,s,0,5,0,5,0,3,1,9,3,5,0,y,f,5,0,ng,p,1fr,1b,2,0,4,1,2,0,2,0,2,0,5,0,2,1,2,7,4,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,1,8,0,2,0,5,0,d,11,2,0,6,0,nx0,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,k,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,2,3q,0,2,0,2,0,2,0,2,0,2,0,2,2,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,9,2,0,2,0,3,0,2,0,2,0,2,0,2,0,5,0,2,0,3,0,2,2,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,6,0,6,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0,5,0,2,0,7,0,2,0,2,0,2,0,2,0,p,2,2,0,2,2,mu,16,2,d,7,27,fnl,6,d,4,tm,p,y6,13,3t,z,4c,a,2,e,2,6,2,1,ck,0,3,2,2,15,2,8,zq,1e,2by,v,gw1,v,k2j,p,r,6,2,h,r,p,r,3,2,0,2,6,2,a,r,p,r,p,r,p,r,p,r,p,r,p,r,p,r,p,r,r,t,o,2,5,r,o,2,5,r,o,2,5,r,o,2,5,r,o,2,5,2,0,1f9,9,2,j,7,5,7a,1p,1px,x',
    title: 'cl,0,3,0,3,0,13,0,5ue,7,9,7,9,7,d,0,g,0,1c,0',
    cased: '1t,p,7,p,1c,0,b,0,5,0,6,m,2,u,2,5e,2,3,5,5r,2,z,8,1,v,4,2p,0,17,3,3,1,3,3,2,0,7,0,2,2,2,0,2,j,2,2a,2,3u,9,4l,2,11,a,14,26w,11,2,0,6,0,3,16,2,3,ip,2d,3,5,1oj,8,8,16,3,2,1t,5b,1t,7p,3,5,3,11,3,5,3,7,2,0,2,0,2,0,2,u,3,1g,2,6,2,0,4,2,2,6,4,3,3,5,5,c,6,2,2,6,39,0,e,0,h,c,2u,0,5,0,3,9,2,0,4,4,7,0,2,0,2,0,2,3,2,5,5,0,3,3,6,4,5,0,i,v,4,1,mq,1f,1ef,6c,7,3,4,1,d,11,2,0,6,0,nwz,19,j,t,3p,2t,4,3,2,1m,6,1,2,0,2,4,p,4,2,2,mu,16,2,d,7,27,fnl,6,d,4,sq,p,7,p,x2,27,2p,z,5,z,39,a,2,e,2,6,2,1,2,a,2,e,2,6,2,1,ck,0,3,2,2,15,2,8,xy,1e,e,1e,2b2,1r,gv5,1r,k1t,2c,2,1y,2,1,3,0,3,1,3,3,2,b,2,0,2,6,2,1s,2,3,3,7,2,6,2,r,2,3,2,4,2,0,4,6,2,9f,3,o,2,o,2,u,2,o,2,u,2,o,2,u,2,o,2,u,2,o,2,7,1f9,9,2,j,7,5,7a,1p,1oz,1v,1kd,p,7,p,7,p',
    case_ignorable: '13,0,7,0,c,0,10,0,2,0,20,0,5,0,2,0,5,0,3,1,e0,5b,5,1,5,0,a,1,2,0,70,6,5s,0,6,0,1e,18,2,0,2,1,2,1,2,0,19,0,c,5,b,a,2,0,10,0,b,k,h,0,2u,7,2,9,2,3,y,0,2,0,v,q,2k,a,1n,a,5,0,3,0,p,n,18,2,19,0,8,1,7,7,16,1l,1k,0,2,0,5,7,5,0,4,6,b,1,e,0,g,0,1n,0,5,3,9,0,l,1,r,0,3,1,1m,0,5,1,5,1,3,2,4,0,v,1,4,0,c,1,1m,0,5,4,2,1,5,0,l,1,n,5,2,0,1n,0,3,0,2,3,9,0,8,1,c,1,v,0,1q,0,d,0,1f,0,4,0,1k,0,2,2,6,2,2,3,8,1,c,1,u,0,1n,0,3,0,7,0,6,1,l,1,t,1,1m,1,5,3,9,0,l,1,u,0,21,0,8,2,2,0,2j,0,3,6,c,8,2r,0,3,8,a,0,2,6,22,1,s,0,2,0,2,0,1k,d,2,4,2,1,6,a,2,z,a,0,2v,3,2,5,2,1,3,1,q,1,5,2,h,3,e,0,3,1,7,0,g,0,2n,0,gx,2,qb,2,u,1,v,1,v,1,1t,1,2,6,9,0,3,a,4,0,6,0,1a,4,1g,0,1u,1,z,0,3b,2,5,1,a,0,7,2,64,1,3,0,1n,0,2,6,2,0,2,0,3,7,7,9,3,0,14,0,9,u,1e,3,1d,0,2,4,2,0,6,0,15,8,d,1,x,3,3,1,2,2,1l,0,2,1,4,0,2,2,1n,7,3,1,1t,5,2b,2,2,c,2,6,5,0,7,0,4,1,1f,1q,e,0,z,2s,ce,0,2,2,c,2,e,2,e,2,e,1,d,4,9,1,b,0,3,0,3,4,1e,4,2,9,2,0,e,0,h,c,1g,w,2a4,1,36,2,3i,0,g,0,2p,v,1c,0,d2,0,11,3,4,4,6,0,2m,5,2m,2,lxz,0,yr,5,7j,0,2r,3,2,9,2,0,t,3,29,1,f,x,27,0,o,2,2w,2,4,1,9,0,4,0,5,0,q,1,6,0,48,1,r,h,e,0,13,7,q,a,1b,2,1d,0,3,3,3,1,i,0,m,1,1v,5,3,1,3,1,d,0,9,0,10,0,c,0,1g,0,2,2,3,1,6,1,2,0,s,0,f,1,6,1,2,0,2t,4,a,2,3e,0,3,0,5,0,fn5,0,44,g,fy,f,4,0,d,f,z,0,3,0,4q,0,8,0,7,0,c,0,10,0,2,0,1c,0,1a,1,1w,0,m,2,ea,0,6b,0,46,4,sm,5,2,15,2,8,g7,2,2,1,6,3,15,2,5,0,4m,1,fy,3,as,1,29,2,1z,a,1e,3,3g,0,1j,e,16,0,3,1,b,2,1e,3,3,1,3,0,5,0,b,0,1f,2,11,4,2,7,1r,0,d,1,1h,8,b,3,3,0,2o,2,3,0,2,1,7,0,3,0,4e,0,4,7,m,1,1m,1,4,0,12,6,4,4,5g,7,3,2,2,0,o,0,2d,5,2,0,5,1,2,1,6n,3,7,1,2,1,s,1,2e,7,3,0,2,1,2z,0,2,0,3,5,2,0,2u,2,3,3,2,4,78,8,2,1,75,1,2,0,5,0,41,3,3,1,5,0,x,9,15,5,3,3,9,0,a,5,3,2,1b,c,2,1,bb,6,2,5,2,0,2b,l,3,6,2,1,2,1,3f,5,4,0,2,1,2,6,2,0,21,1,4,0,2,0,9o,1,c,1,1h,4,6,0,2,0,44u,g,7,e,asb,4,1o,6,a,3,ss,0,1s,g,1t,1,2,1,cng,3,2,6,2,1,2hr,1,2,3,3ml,19,3,m,f5,2,a,f,3,6,v,3,45,2,1j0,1i,5,1d,9,0,f,0,n,4,2,e,11t,6,2,g,3,6,2,1,2,4,6,1p,y,0,4h,d,a9,0,1q,3,e4,4,rl,6,32,7,240,4,gx6q,0,v,2n,3l,6n',
    alpha: '1t,p,7,p,1c,0,b,0,5,0,6,m,2,u,2,cp,5,b,f,4,8,0,2,0,3m,4,2,1,3,3,2,0,7,0,2,2,2,0,2,j,2,2a,2,3u,9,4l,2,11,3,0,7,14,20,q,5,3,1a,16,10,1,2,2q,2,0,g,1,8,1,b,2,3,0,h,0,2,t,u,2g,c,0,p,w,a,1,5,0,6,l,5,0,a,0,4,0,o,o,8,a,6,n,2,5,i,15,1n,1h,4,0,j,0,8,9,g,f,5,7,3,1,3,l,2,6,2,0,4,3,4,0,h,0,e,1,2,2,f,1,b,0,9,5,5,1,3,l,2,6,2,1,2,1,2,1,w,3,2,0,k,2,h,8,2,2,2,l,2,6,2,1,2,4,4,0,j,0,g,1,o,0,c,7,3,1,3,l,2,6,2,1,2,4,4,0,v,1,2,2,g,0,i,0,2,5,4,2,2,3,4,1,2,0,2,1,4,1,4,2,4,b,n,0,1h,7,2,2,2,m,2,f,4,0,r,2,3,0,3,1,v,0,5,7,2,2,2,m,2,9,2,4,4,0,w,1,2,1,g,1,i,8,2,2,2,14,3,0,h,0,6,2,9,2,p,5,6,h,4,n,2,8,2,0,3,6,1n,1b,2,1,d,6,1n,1,2,0,2,4,2,n,2,0,2,9,2,1,a,0,3,4,2,0,m,3,x,0,1s,7,2,z,s,4,38,16,l,0,h,5,5,3,4,0,4,1,8,2,5,c,d,0,i,11,2,0,6,0,3,16,2,98,2,3,3,6,2,0,2,3,3,14,2,3,3,w,2,3,3,6,2,0,2,3,3,e,2,1k,2,3,3,1u,12,f,h,2d,3,5,4,h7,3,g,2,p,6,22,7,7,8,h,e,i,f,h,f,c,2,2,g,1f,10,0,5,0,1w,2g,8,4,3,x,2,0,6,1x,b,u,1e,t,3,4,c,17,5,p,1j,m,a,1g,2b,0,2m,1a,i,7,1j,t,e,1,b,17,r,z,16,2,b,z,3,8,8,16,3,2,16,3,2,5,2,1,4,0,6,5b,1t,7p,3,5,3,11,3,5,3,7,2,0,2,0,2,0,2,u,3,1g,2,6,2,0,4,2,2,6,4,3,3,5,5,c,6,2,2,6,39,0,e,0,h,c,2u,0,5,0,3,9,2,0,4,4,7,0,2,0,2,0,2,3,2,a,3,3,6,4,5,0,1h,1,22k,6c,7,3,4,1,d,11,2,0,6,0,3,1j,8,0,h,m,a,6,2,6,2,6,2,6,2,6,2,6,2,6,2,6,29,0,d2,1,17,4,6,1,5,2d,7,2,2,2h,2,3,6,16,2,2l,i,v,1d,f,e9,533,1t,h3g,1w,19,3,7g,4,f,b,1,l,1a,h,u,3,1x,1e,8,3,2u,3,1r,6,1,2,0,2,4,p,f,2,2,2,3,2,m,u,1f,f,1d,1r,5,4,0,2,1,c,r,b,m,q,s,8,1a,t,0,h,4,2,9,b,4,2,14,o,2,2,7,l,m,4,0,4,1d,2,0,4,1,3,4,3,0,2,0,p,2,3,a,8,2,d,5,3,5,3,5,a,6,2,6,2,16,2,d,7,36,u,8mb,d,m,5,1c,6it,a5,3,2x,13,6,d,4,6,0,2,9,2,c,2,4,2,0,2,1,2,1,2,2z,y,a2,j,1r,3,1h,15,b,39,4,2,3q,11,p,7,p,c,2g,4,5,3,5,3,5,3,2,10,b,2,p,2,i,2,1,2,e,3,d,z,3e,au,s,4,1c,1c,v,e,j,2,7,7,11,b,t,3,z,5,7,1d,4d,j,z,5,z,5,13,9,1f,d,a,2,e,2,6,2,1,2,a,2,e,2,6,2,1,1w,8m,a,l,b,7,p,5,2,15,2,8,1y,5,3,0,2,17,2,1,4,0,3,m,b,m,a,u,1u,i,2,1,b,l,b,p,1z,1j,7,1,1t,0,g,3,2,2,2,s,17,s,4,s,10,7,2,r,s,1h,b,l,b,i,e,h,33,20,1k,1e,e,1e,e,z,9p,15,7,1,27,s,b,0,9,l,17,h,1b,k,s,m,d,1g,1m,1,3,0,e,18,x,o,r,z,u,0,3,0,9,y,4,0,d,1b,f,3,m,0,2,0,10,h,2,o,k,1,1s,6,2,0,2,3,2,e,2,9,8,1a,13,7,3,1,3,l,2,6,2,1,2,4,4,0,j,0,d,4,4f,1g,j,3,l,2,v,1b,l,1,2,0,55,1a,16,3,11,1b,l,0,1o,16,e,0,20,q,12,6,56,17,39,1r,w,7,3,0,3,7,2,1,2,n,g,0,2,0,2n,7,3,12,h,0,2,0,t,0,b,13,8,0,m,0,c,19,k,0,j,20,7c,8,2,10,i,0,1e,t,35,6,2,1,2,11,m,0,q,5,2,1,2,v,f,0,94,i,g,0,2,c,2,x,3h,0,28,pl,6f,5f,219,2o,g,tr,i,5,33u,g6,6nu,fs,8,u,i,26,i,t,j,1b,h,3,w,k,6,i,j5,1r,3l,22,6,0,1v,c,1t,1,2,0,t,4qf,9,yd,17,8,6w8,3,2,6,2,1,2,82,g,0,u,2,3,0,f,3,9,az,1s5,2y,6,c,4,8,8,9,4mf,2c,2,1y,2,1,3,0,3,1,3,3,2,b,2,0,2,6,2,1s,2,3,3,7,2,6,2,r,2,3,2,4,2,0,4,6,2,9f,3,o,2,o,2,u,2,o,2,u,2,o,2,u,2,o,2,u,2,o,2,7,1f9,u,7,5,7a,1p,43,18,b,6,h,0,8y,t,j,17,dh,r,l1,6,2,3,2,1,2,e,2,5g,1o,1v,8,0,xh,3,2,q,2,1,2,0,3,0,2,9,2,3,2,0,2,0,7,0,5,0,2,0,2,0,2,2,2,1,2,0,3,0,2,0,2,0,2,0,2,0,2,1,2,0,3,3,2,6,2,3,2,3,2,0,2,9,2,g,6,2,2,4,2,g,3et,wyn,x,37d,7,65,3,4g1,f,5rk,2e8,f1,15v,3t6,6,38f',
    decimal: '1c,9,17r,9,3r,9,5j,9,bh,9,3b,9,3b,9,3b,9,3b,9,3b,9,3b,9,3b,9,3b,9,3b,9,2p,9,3b,9,1z,9,7r,9,1z,9,1fr,9,13,9,8d,9,3l,9,4n,9,7,9,53,9,2f,9,3r,9,7,9,r7r,9,iv,9,13,9,5j,9,n,9,2f,9,bb,9,gev,9,13b,9,1on,9,ml,9,3l,9,1p,9,41,9,7r,9,9j,9,3b,9,af,9,2v,9,2v,9,br,9,2v,9,l3,9,6v,9,1z,9,br,9,etj,9,2f,9,3r,9,lf9,1d,1tt,9,br,9,dz,9,uv,9,3o7,9',
    digit: '1c,9,3d,1,6,0,147,9,3r,9,5j,9,bh,9,3b,9,3b,9,3b,9,3b,9,3b,9,3b,9,3b,9,3b,9,3b,9,2p,9,3b,9,1z,9,7r,9,1z,9,k0,8,vj,9,13,9,8d,9,3l,a,4m,9,7,9,53,9,2f,9,3r,9,7,9,t3,0,4,5,7,9,rb,8,c,8,c,8,2i,0,b,8,2,0,hj,8,2,8,2,8,ozy,9,iv,9,13,9,5j,9,n,9,2f,9,bb,9,gev,9,13b,9,13r,3,kt,9,87,8,dm,8,c,9,3l,9,1p,9,41,9,7r,9,9j,9,3b,9,af,9,2v,9,2v,9,br,9,2v,9,l3,9,6v,9,1z,9,br,9,etj,9,2f,9,3r,9,lf9,1d,1tt,9,br,9,dz,9,uv,9,1if,a,25i,9',
    numeric: '1c,9,3d,1,6,0,3,2,142,9,3r,9,5j,9,bh,9,3b,9,5,5,31,9,3b,9,3b,9,3,5,33,c,38,9,9,6,2w,9,2x,6,8,i,32,9,2p,9,3b,9,1z,j,7h,9,1z,9,k0,j,oi,2,6o,9,7,9,n,9,8d,9,3l,a,4m,9,7,9,53,9,2f,9,3r,9,7,9,t3,0,4,5,7,9,5j,1e,3,4,k7,1n,27,l,hj,t,12i,0,lm,0,q,8,f,2,9k,3,3v,9,v,7,2,e,x,9,14,e,92,0,3i,0,pz,0,mb,0,3oz,0,3,0,4,0,2,0,2c,0,1b,0,8,0,2,0,15,1,v,0,9,0,11,0,2r,0,b8,0,1u,0,z,0,2,0,2,0,d0,0,2,2,7,0,39,3,lz,0,eu,0,8,0,135,0,3o,1,d,2,2,0,ry,0,26,0,w6,0,1f8,0,wg,0,ko,0,1zc,0,py,0,1oi,0,5,0,3h,0,1rl,0,11,0,6,0,18,0,3i,0,2zu,9,59,9,8x,5,4b,9,13,9,5j,9,n,9,2f,9,bb,9,faq,0,8,0,5,0,1m,0,v,0,2,0,16,0,103,9,dq,18,d,1k,i,1,9i,q,11,3,u,0,9,0,3r,4,5n,9,q7,7,q,6,14,8,24,4,n,5,4h,1,3,f,3,19,1t,8,1h,1,v,2,24,4,2x,7,p,7,16,6,97,5,1d,9,87,u,4f,9,17,3,35,6,3r,t,3l,9,1p,9,41,9,8,j,70,9,9j,9,3b,9,af,9,2v,9,2v,b,bp,i,2m,9,l3,s,6c,9,1z,9,br,9,2v,k,to,32,dte,9,2f,9,3r,9,2,6,m7,m,jsa,j,d,j,31,o,uu,1d,1tt,9,br,9,dz,9,r2,8,3l,9,m0,1m,2,2,2,3,25,18,2,e,qr,c,25g,9,so,0,2r,0,3i,0,1r,0,1l5,0,2h,0,9,0,g,0,9a,0,j,0,s,0,4tz,0,16w,0,3gj,0,7rm,0,tnn,0',
    space: '9,4,f,4,2t,0,r,0,4bk,0,1vk,a,u,1,6,0,1c,0,335,0',
    printable: 'w,2m,z,b,2,jt,3,5,5,6,2,0,2,j,2,b0,2,11,3,1d,3,2,2,1i,9,q,5,5,i,l,2,5b,2,1b,3,1m,3,2s,f,1m,3,1c,3,e,2,r,3,0,2,a,6,u,a,21,2,4g,2,7,3,1,3,l,2,6,2,0,4,3,3,8,3,1,3,3,9,0,5,1,2,4,3,o,3,2,2,5,5,1,3,l,2,6,2,1,2,1,2,1,3,0,2,4,5,1,3,2,4,0,8,3,2,0,8,g,b,2,2,8,2,2,2,l,2,6,2,1,2,4,3,9,2,2,2,2,3,0,g,3,3,b,8,6,2,2,2,7,3,1,3,l,2,6,2,1,2,4,3,8,3,1,3,2,8,2,5,1,2,4,3,h,b,1,2,5,4,2,2,3,4,1,2,0,2,1,4,1,4,2,4,b,5,4,4,2,2,3,3,0,7,0,f,k,6,c,2,2,2,m,2,f,3,8,2,2,2,3,8,1,2,2,3,0,3,3,3,9,8,l,2,2,2,m,2,9,2,4,3,8,2,2,2,3,8,1,7,1,2,3,3,9,2,2,d,c,2,2,2,1e,2,2,2,5,5,f,3,p,2,2,2,h,4,n,2,8,2,0,3,6,4,0,5,5,2,0,2,7,7,9,3,2,d,1l,5,s,12,1,2,0,2,4,2,n,2,0,2,m,3,4,2,0,2,6,2,9,3,3,x,1z,2,z,5,12,2,z,2,e,2,c,12,5h,2,0,6,0,3,ag,2,3,3,6,2,0,2,3,3,14,2,3,3,w,2,3,3,6,2,0,2,3,3,e,2,1k,2,3,3,1u,3,v,4,p,7,2d,3,5,3,hr,2,r,4,2g,8,l,a,n,a,j,d,c,2,2,2,1,d,2l,3,9,7,9,7,d,2,a,7,2g,8,16,6,1x,b,u,2,b,5,b,5,0,4,15,3,4,c,17,5,p,7,a,4,1p,3,1s,2,s,3,a,7,9,7,d,3,u,1e,24,4,1a,2,37,9,1n,4,e,4,1n,8,16,3,a,9,16,6,et,3,5,3,11,3,5,3,7,2,0,2,0,2,0,2,u,3,1g,2,e,2,d,3,5,2,i,3,2,2,8,i,n,9,1a,i,1,3,q,2,c,4,w,g,w,g,3v,5,ie,q,a,m,1eb,3,v,2,9o,6,18,2,0,6,0,3,1j,8,1,f,n,a,6,2,6,2,6,2,6,2,6,2,6,2,6,2,6,2,3h,z,p,2,2g,d,5x,r,b,6,1q,2,2d,3,2u,6,16,2,2l,2,2b,d,1a,2,mlo,4,1i,a,9n,l,53,9,5m,6,1,2,0,2,4,p,1m,4,9,7,1j,9,1x,9,b,7,37,c,t,4,25,2,a,5,w,2,1i,a,d,3,9,3,2u,p,r,b,5,3,5,3,5,a,6,2,6,2,1n,5,3h,3,9,7,8mb,d,m,5,1c,6it,a5,3,2x,13,6,d,4,6,p,2,4,2,0,2,1,2,1,2,3g,h,cc,3,1h,8,0,x,15,7,1e,2,i,2,3,5,4,2,3q,5,59,4,5,3,5,3,5,3,2,4,6,2,6,e,1,3,b,2,p,2,i,2,1,2,e,3,d,z,3e,6,2,5,18,4,2f,2,c,4,0,1c,19,3n,s,4,1c,g,r,5,z,a,t,6,16,6,t,2,10,5,d,17,4d,3,9,7,z,5,z,5,13,9,1f,c,b,2,e,2,6,2,1,2,a,2,e,2,6,2,1,1w,8m,a,l,b,7,p,5,2,15,2,8,1y,5,3,0,2,17,2,1,4,0,3,m,2,1z,9,8,1d,i,2,1,6,w,4,q,6,0,1t,1j,5,j,3,1d,2,1,6,7,2,2,2,s,3,2,5,9,8,8,8,1r,x,12,5,b,a,1h,4,s,3,q,6,p,8,3,d,6,29,20,1k,1e,e,1e,8,19,9,9,87,u,2,15,2,2,3,1,24,16,9,15,n,p,13,r,l,m,a,25,5,z,a,1p,2,4,e,o,8,9,7,1g,2,h,9,12,a,2n,2,j,c,h,2,1a,1r,6,2,0,2,3,2,e,2,a,7,1m,6,9,7,3,2,7,3,1,3,l,2,6,2,1,2,4,2,9,3,1,3,2,3,0,7,0,6,6,3,6,4,4,3w,2j,2,4,v,1z,9,9,4n,1h,3,11,z,1w,c,9,7,c,k,1l,7,9,1j,q,3,e,5,m,56,1n,2t,2a,d,7,3,0,3,7,2,1,2,t,2,1,3,b,a,9,1z,7,3,19,3,a,s,1z,9,2a,e,20,8,9,6v,8,2,18,2,d,b,s,4,v,3,l,2,d,22,6,2,1,2,17,4,0,2,1,2,8,9,9,7,5,2,1,2,10,2,1,2,5,8,9,8n,o,8,g,2,14,4,r,2f,0,g,1d,e,pm,2v,32,2,4,c,5f,219,2q,e,tr,h,l,33f,g6,6nu,fs,8,u,2,9,5,28,2,9,7,t,3,5,b,1x,b,9,2,6,2,k,6,i,j5,2i,2u,22,5,1k,8,g,1t,4,c,1,f,4qf,9,yd,17,8,6w8,3,2,6,2,1,2,82,g,0,u,2,3,0,f,3,9,az,1s5,2y,6,c,4,8,8,9,3,3,3mp,19,3,m,a,37,1p,6t,b,12,3,21,9,33,m,1x,3f,j,d,j,d,2e,a,o,3s,2c,2,1y,2,1,3,0,3,1,3,3,2,b,2,0,2,6,2,1s,2,3,3,7,2,6,2,r,2,3,2,4,2,0,4,6,2,9f,3,83,3,jh,g,4,2,e,up,u,7,5,5y,6,2,g,3,6,2,1,2,4,6,1p,y,0,35,18,4,d,3,9,5,1,8x,u,i,1l,6,0,cx,15,kn,6,2,3,2,1,2,e,2,5g,3,f,16,23,5,9,5,1,lu,1v,25,1o,5f,3,2,q,2,1,2,0,3,0,2,9,2,3,2,0,2,0,7,0,5,0,2,0,2,0,2,2,2,1,2,0,3,0,2,0,2,0,2,0,2,0,2,1,2,0,3,3,2,6,2,3,2,3,2,0,2,9,2,g,6,2,2,4,2,g,1h,1,7j,17,5,2r,d,e,3,e,2,e,2,10,b,4t,1l,s,e,17,5,8,8,1,f,5,4b,rb,5,g,4,c,4,3a,5,2m,7,b,5,0,g,b,5,1j,9,9,7,13,9,t,3,1,27,9f,d,d,3,c,4,8,8,19,2,6,9,d,5,8,8,8,8,42,2,1i,12,9,sn,wyn,x,37d,7,65,3,4g1,f,5rk,2e8,f1,15v,3t6,6,38f,f9e9,6n',
    map_lower: '1t,q,1,w,2u,n,1,w,2,7,1,w,y,o,2,1,4,3,2,1,3,8,2,1,3,n,2,1,2,1,1,-3d,1,3,2,1,4,1,1,5u,1,2,2,1,2,1,1,5q,1,1,1,1,2,2,1,5p,1,1,1,1,3,1,1,27,1,1,1,5m,1,1,1,5n,1,1,1,1,2,1,1,5p,1,1,1,5r,2,1,1,5v,1,1,1,5t,1,1,1,1,4,1,1,5v,1,1,1,5x,2,1,1,5y,1,3,2,1,2,1,1,62,1,1,1,1,2,1,1,62,3,1,1,1,2,1,1,62,1,1,1,1,2,2,1,61,1,2,2,1,2,1,1,63,1,1,1,1,4,1,1,1,8,1,1,2,1,1,1,1,2,1,1,2,1,1,1,1,2,1,1,2,1,9,2,1,3,9,2,1,3,1,1,2,1,2,2,1,2,1,1,-2p,1,1,1,-1k,1,k,2,1,2,1,1,-3m,2,9,2,1,8,1,1,8bv,1,1,1,1,2,1,1,-4j,1,1,1,8bs,3,1,1,1,2,1,1,-5f,1,1,1,1x,1,1,1,1z,1,5,2,1,82,2,2,1,4,1,1,1,9,1,1,38,7,1,1,12,2,3,1,11,2,1,1,1s,2,2,1,1r,2,h,1,w,2,9,1,w,10,1,1,8,9,c,2,1,6,1,1,-1o,3,1,1,1,2,1,1,-7,1,1,1,1,3,3,1,-3m,1,g,1,28,1,w,1,w,1d,h,2,1,a,r,2,1,2,1,1,f,1,7,2,1,3,1c,2,1,3,12,1,1c,28a,12,1,5ls,2,1,1,5ls,6,1,1,5ls,k3,28,1,tzk,1,6,1,8,1p7,17,1,-2bk,3,3,1,-2bk,8x,23,2,1,a,1,1,-5vj,2,1c,2,1,a,8,1,-8,9,6,1,-8,b,8,1,-8,9,8,1,-8,9,6,1,-8,c,4,2,-8,9,8,1,-8,p,8,1,-8,9,8,1,-8,9,8,1,-8,9,2,1,-8,1,2,1,-22,1,1,1,-9,c,4,1,-2e,1,1,1,-9,c,2,1,-8,1,2,1,-2s,d,2,1,-8,1,2,1,-34,1,1,1,-7,c,2,1,-3k,1,2,1,-3i,1,1,1,-9,8a,1,1,-5st,4,1,1,-6gv,1,1,1,-6di,7,1,1,s,1a,g,1,g,k,1,1,1,mr,q,1,q,1f5,1c,1,1c,1d,1,1,1,2,1,1,-8af,1,1,1,-2xy,1,1,1,-89z,3,3,2,1,2,1,1,-8bg,1,1,1,-8al,1,1,1,-8bj,1,1,1,-8bi,2,1,1,1,3,1,1,1,9,2,1,-8cf,1,1e,2,1,9,2,2,1,5,1,1,1,nym,n,2,1,k,e,2,1,3s,7,2,1,4,v,2,1,b,2,2,1,2,1,1,-r9g,1,5,2,1,5,1,1,1,2,1,1,-wmg,3,2,2,1,4,a,2,1,2,1,1,-wn8,1,1,1,-wnj,1,1,1,-wnf,1,1,1,-wn5,1,1,1,-wn8,2,1,1,-wlu,1,1,1,-wmi,1,1,1,-wlx,1,1,1,ps,1,8,2,1,2,1,1,-1c,1,1,1,-wn7,1,1,1,-raw,1,2,2,1,7,1,1,1,6,2,2,1,t,1,1,1,h7w,q,1,w,xy,14,1,14,3t,10,1,14,4d,b,1,13,2,f,1,13,2,7,1,13,2,2,1,13,1d7,1f,1,1s,2cu,w,1,w,gw1,w,1,w,o81,y,1,y',
    multi_lower: '8g=2x.lj',
    map_upper: '2p,q,1,-w,1n,1,1,kn,17,n,1,-w,2,7,1,-w,1,1,1,3d,2,o,2,-1,2,1,1,-6g,2,3,2,-1,3,8,2,-1,3,n,2,-1,3,3,2,-1,1,1,1,-8c,1,1,1,5f,3,2,2,-1,3,1,1,-1,4,1,1,-1,6,1,1,-1,3,1,1,2p,4,1,1,-1,1,1,1,4j,4,1,1,3m,3,3,2,-1,3,1,1,-1,5,1,1,-1,3,1,1,-1,4,2,2,-1,3,1,1,-1,4,1,1,-1,2,1,1,1k,6,1,1,-1,1,1,1,-2,2,1,1,-1,1,1,1,-2,2,1,1,-1,1,1,1,-2,2,8,2,-1,1,1,1,-27,2,9,2,-1,3,1,1,-1,1,1,1,-2,2,1,1,-1,4,k,2,-1,4,9,2,-1,9,1,1,-1,3,2,1,8cf,2,1,1,-1,5,5,2,-1,1,1,1,8bj,1,1,1,8bg,1,1,1,8bi,1,1,1,-5u,1,1,1,-5q,2,2,1,-5p,2,1,1,-5m,2,1,1,-5n,1,1,1,wnj,4,1,1,-5p,1,1,1,wnf,2,1,1,-5r,2,1,1,wmg,1,1,1,wn8,2,1,1,-5t,1,1,1,-5v,1,1,1,wn8,1,1,1,8af,1,1,1,wn5,3,1,1,-5v,2,1,1,8al,1,1,1,-5x,3,1,1,-5y,8,1,1,89z,3,1,1,-62,2,1,1,wn7,1,1,1,-62,4,1,1,wmi,1,1,1,-62,1,1,1,-1x,1,2,1,-61,1,1,1,-1z,6,1,1,-63,b,1,1,wlx,1,1,1,wlu,4n,1,1,2c,18,2,2,-1,4,1,1,-1,4,3,1,3m,1b,1,1,-12,1,3,1,-11,2,h,1,-w,1,1,1,-v,1,9,1,-w,1,1,1,-1s,1,2,1,-1r,2,1,1,-1q,1,1,1,-1l,4,1,1,-1b,1,1,1,-1i,1,1,1,-8,2,c,2,-1,1,1,1,-2e,1,1,1,-28,1,1,1,7,1,1,1,-38,2,1,1,-2o,3,1,1,-1,3,1,1,-1,1h,w,1,-w,1,g,1,-28,2,h,2,-1,a,r,2,-1,3,7,2,-1,1,1,1,-f,2,1c,2,-1,1e,12,1,-1c,28a,17,1,2bk,3,3,1,2bk,l5,6,1,-8,1oj,1,1,-4tq,1,1,1,-4tp,1,1,1,-4tg,1,2,1,-4te,1,1,1,-4tf,1,1,1,-4t8,1,1,1,-4rp,1,1,1,r7m,6p,1,1,r9g,4,1,1,2xy,h,1,1,raw,37,23,2,-1,6,1,1,-1n,6,1c,2,-1,1,8,1,8,9,6,1,8,b,8,1,8,9,8,1,8,9,6,1,8,c,4,2,8,9,8,1,8,9,2,1,22,1,4,1,2e,1,2,1,2s,1,2,1,3k,1,2,1,34,1,2,1,3i,1f,2,1,8,d,1,1,-5k5,i,2,1,8,f,2,1,8,4,1,1,7,a1,1,1,-s,y,g,1,-g,5,1,1,-1,ng,q,1,-q,1fr,1c,1,-1c,2,1,1,-1,4,1,1,-8bv,1,1,1,-8bs,2,3,2,-1,7,1,1,-1,3,1,1,-1,b,1e,2,-1,9,2,2,-1,5,1,1,-1,d,12,1,-5ls,2,1,1,-5ls,6,1,1,-5ls,nx0,n,2,-1,k,e,2,-1,3s,7,2,-1,4,v,2,-1,b,2,2,-1,3,5,2,-1,5,1,1,-1,5,2,2,-1,1,1,1,1c,3,a,2,-1,c,8,2,-1,5,2,2,-1,7,1,1,-1,6,2,2,-1,t,1,1,-1,nx,1,1,-ps,t,28,1,-tzk,ghu,q,1,-w,y6,14,1,-14,3t,10,1,-14,4c,b,1,-13,2,f,1,-13,2,7,1,-13,2,2,1,-13,1dw,1f,1,-1s,2by,w,1,-w,gw1,w,1,-w,o83,y,1,-y',
    multi_upper: '67=2b.2b,95=jg.26,ds=22.lo,pc=pl.lk.ld,q8=px.lk.ld,13b=111.11u,61i=20.mp,61j=2c.lk,61k=2f.lm,61l=2h.lm,61m=1t.ji,66o=px.lv,66q=px.lv.lc,66s=px.lv.ld,66u=px.lv.n6,680=64o.pl,681=64p.pl,682=64q.pl,683=64r.pl,684=64s.pl,685=64t.pl,686=64u.pl,687=64v.pl,688=64o.pl,689=64p.pl,68a=64q.pl,68b=64r.pl,68c=64s.pl,68d=64t.pl,68e=64u.pl,68f=64v.pl,68g=65k.pl,68h=65l.pl,68i=65m.pl,68j=65n.pl,68k=65o.pl,68l=65p.pl,68m=65q.pl,68n=65r.pl,68o=65k.pl,68p=65l.pl,68q=65m.pl,68r=65n.pl,68s=65o.pl,68t=65p.pl,68u=65q.pl,68v=65r.pl,68w=67c.pl,68x=67d.pl,68y=67e.pl,68z=67f.pl,690=67g.pl,691=67h.pl,692=67i.pl,693=67j.pl,694=67c.pl,695=67d.pl,696=67e.pl,697=67f.pl,698=67g.pl,699=67h.pl,69a=67i.pl,69b=67j.pl,69e=69m.pl,69f=pd.pl,69g=p2.pl,69i=pd.n6,69j=pd.n6.pl,69o=pd.pl,69u=6a2.pl,69v=pj.pl,69w=p5.pl,69y=pj.n6,69z=pj.n6.pl,6a4=pj.pl,6aa=pl.lk.lc,6ab=pl.lk.ld,6ae=pl.n6,6af=pl.lk.n6,6aq=px.lk.lc,6ar=px.lk.ld,6as=pt.lv,6au=px.n6,6av=px.lk.n6,6b6=6be.pl,6b7=q1.pl,6b8=pb.pl,6ba=q1.n6,6bb=q1.n6.pl,6bg=q1.pl,1dkw=1y.1y,1dkx=1y.21,1dky=1y.24,1dkz=1y.1y.21,1dl0=1y.1y.24,1dl1=2b.2c,1dl2=2b.2c,1dlf=11g.11i,1dlg=11g.111,1dlh=11g.117,1dli=11q.11i,1dlj=11g.119',
    map_title: '2p,q,1,-w,1n,1,1,kn,17,n,1,-w,2,7,1,-w,1,1,1,3d,2,o,2,-1,2,1,1,-6g,2,3,2,-1,3,8,2,-1,3,n,2,-1,3,3,2,-1,1,1,1,-8c,1,1,1,5f,3,2,2,-1,3,1,1,-1,4,1,1,-1,6,1,1,-1,3,1,1,2p,4,1,1,-1,1,1,1,4j,4,1,1,3m,3,3,2,-1,3,1,1,-1,5,1,1,-1,3,1,1,-1,4,2,2,-1,3,1,1,-1,4,1,1,-1,2,1,1,1k,5,1,1,1,2,1,1,-1,1,1,1,1,2,1,1,-1,1,1,1,1,2,9,2,-1,1,1,1,-27,2,9,2,-1,2,1,1,1,2,2,2,-1,4,k,2,-1,4,9,2,-1,9,1,1,-1,3,2,1,8cf,2,1,1,-1,5,5,2,-1,1,1,1,8bj,1,1,1,8bg,1,1,1,8bi,1,1,1,-5u,1,1,1,-5q,2,2,1,-5p,2,1,1,-5m,2,1,1,-5n,1,1,1,wnj,4,1,1,-5p,1,1,1,wnf,2,1,1,-5r,2,1,1,wmg,1,1,1,wn8,2,1,1,-5t,1,1,1,-5v,1,1,1,wn8,1,1,1,8af,1,1,1,wn5,3,1,1,-5v,2,1,1,8al,1,1,1,-5x,3,1,1,-5y,8,1,1,89z,3,1,1,-62,2,1,1,wn7,1,1,1,-62,4,1,1,wmi,1,1,1,-62,1,1,1,-1x,1,2,1,-61,1,1,1,-1z,6,1,1,-63,b,1,1,wlx,1,1,1,wlu,4n,1,1,2c,18,2,2,-1,4,1,1,-1,4,3,1,3m,1b,1,1,-12,1,3,1,-11,2,h,1,-w,1,1,1,-v,1,9,1,-w,1,1,1,-1s,1,2,1,-1r,2,1,1,-1q,1,1,1,-1l,4,1,1,-1b,1,1,1,-1i,1,1,1,-8,2,c,2,-1,1,1,1,-2e,1,1,1,-28,1,1,1,7,1,1,1,-38,2,1,1,-2o,3,1,1,-1,3,1,1,-1,1h,w,1,-w,1,g,1,-28,2,h,2,-1,a,r,2,-1,3,7,2,-1,1,1,1,-f,2,1c,2,-1,1e,12,1,-1c,2uq,6,1,-8,1oj,1,1,-4tq,1,1,1,-4tp,1,1,1,-4tg,1,2,1,-4te,1,1,1,-4tf,1,1,1,-4t8,1,1,1,-4rp,1,1,1,r7m,6p,1,1,r9g,4,1,1,2xy,h,1,1,raw,37,23,2,-1,6,1,1,-1n,6,1c,2,-1,1,8,1,8,9,6,1,8,b,8,1,8,9,8,1,8,9,6,1,8,c,4,2,8,9,8,1,8,9,2,1,22,1,4,1,2e,1,2,1,2s,1,2,1,3k,1,2,1,34,1,2,1,3i,3,8,1,8,9,8,1,8,9,8,1,8,9,2,1,8,2,1,1,9,b,1,1,-5k5,5,1,1,9,d,2,1,8,f,2,1,8,4,1,1,7,e,1,1,9,9n,1,1,-s,y,g,1,-g,5,1,1,-1,ng,q,1,-q,1fr,1c,1,-1c,2,1,1,-1,4,1,1,-8bv,1,1,1,-8bs,2,3,2,-1,7,1,1,-1,3,1,1,-1,b,1e,2,-1,9,2,2,-1,5,1,1,-1,d,12,1,-5ls,2,1,1,-5ls,6,1,1,-5ls,nx0,n,2,-1,k,e,2,-1,3s,7,2,-1,4,v,2,-1,b,2,2,-1,3,5,2,-1,5,1,1,-1,5,2,2,-1,1,1,1,1c,3,a,2,-1,c,8,2,-1,5,2,2,-1,7,1,1,-1,6,2,2,-1,t,1,1,-1,nx,1,1,-ps,t,28,1,-tzk,ghu,q,1,-w,y6,14,1,-14,3t,10,1,-14,4c,b,1,-13,2,f,1,-13,2,7,1,-13,2,2,1,-13,1dw,1f,1,-1s,2by,w,1,-w,gw1,w,1,-w,o83,y,1,-y',
    multi_title: '67=2b.37,95=jg.26,ds=22.lo,pc=pl.lk.ld,q8=px.lk.ld,13b=111.136,61i=20.mp,61j=2c.lk,61k=2f.lm,61l=2h.lm,61m=1t.ji,66o=px.lv,66q=px.lv.lc,66s=px.lv.ld,66u=px.lv.n6,69e=69m.n9,69g=p2.n9,69i=pd.n6,69j=pd.n6.n9,69u=6a2.n9,69w=p5.n9,69y=pj.n6,69z=pj.n6.n9,6aa=pl.lk.lc,6ab=pl.lk.ld,6ae=pl.n6,6af=pl.lk.n6,6aq=px.lk.lc,6ar=px.lk.ld,6as=pt.lv,6au=px.n6,6av=px.lk.n6,6b6=6be.n9,6b8=pb.n9,6ba=q1.n6,6bb=q1.n6.n9,1dkw=1y.2u,1dkx=1y.2x,1dky=1y.30,1dkz=1y.2u.2x,1dl0=1y.2u.30,1dl1=2b.38,1dl2=2b.38,1dlf=11g.12u,1dlg=11g.12d,1dlh=11g.12j,1dli=11q.12u,1dlj=11g.12l',
    map_casefold: '1t,q,1,w,2j,1,1,lj,b,n,1,w,2,7,1,w,y,o,2,1,4,3,2,1,3,8,2,1,3,n,2,1,2,1,1,-3d,1,3,2,1,2,1,1,-7g,2,1,1,5u,1,2,2,1,2,1,1,5q,1,1,1,1,2,2,1,5p,1,1,1,1,3,1,1,27,1,1,1,5m,1,1,1,5n,1,1,1,1,2,1,1,5p,1,1,1,5r,2,1,1,5v,1,1,1,5t,1,1,1,1,4,1,1,5v,1,1,1,5x,2,1,1,5y,1,3,2,1,2,1,1,62,1,1,1,1,2,1,1,62,3,1,1,1,2,1,1,62,1,1,1,1,2,2,1,61,1,2,2,1,2,1,1,63,1,1,1,1,4,1,1,1,8,1,1,2,1,1,1,1,2,1,1,2,1,1,1,1,2,1,1,2,1,9,2,1,3,9,2,1,3,1,1,2,1,2,2,1,2,1,1,-2p,1,1,1,-1k,1,k,2,1,2,1,1,-3m,2,9,2,1,8,1,1,8bv,1,1,1,1,2,1,1,-4j,1,1,1,8bs,3,1,1,1,2,1,1,-5f,1,1,1,1x,1,1,1,1z,1,5,2,1,6v,1,1,38,17,2,2,1,4,1,1,1,9,1,1,38,7,1,1,12,2,3,1,11,2,1,1,1s,2,2,1,1r,2,h,1,w,2,9,1,w,n,1,1,1,d,1,1,8,1,1,1,-u,1,1,1,-p,4,1,1,-f,1,1,1,-m,2,c,2,1,2,1,1,-1i,1,1,1,-1c,3,1,1,-1o,1,1,1,-1s,2,1,1,1,2,1,1,-7,1,1,1,1,3,3,1,-3m,1,g,1,28,1,w,1,w,1d,h,2,1,a,r,2,1,2,1,1,f,1,7,2,1,3,1c,2,1,3,12,1,1c,28a,12,1,5ls,2,1,1,5ls,6,1,1,5ls,mj,6,1,-8,1oj,1,1,-4su,1,1,1,-4st,1,1,1,-4sk,1,2,1,-4si,1,1,1,-4sj,1,1,1,-4sc,1,1,1,-4ro,1,1,1,r7n,8,17,1,-2bk,3,3,1,-2bk,8x,23,2,1,7,1,1,-1m,5,1c,2,1,a,8,1,-8,9,6,1,-8,b,8,1,-8,9,8,1,-8,9,6,1,-8,c,4,2,-8,9,8,1,-8,21,2,1,-8,1,2,1,-22,3,1,1,-5j9,a,4,1,-2e,d,2,1,-8,1,2,1,-2s,d,2,1,-8,1,2,1,-34,1,1,1,-7,c,2,1,-3k,1,2,1,-3i,8b,1,1,-5st,4,1,1,-6gv,1,1,1,-6di,7,1,1,s,1a,g,1,g,k,1,1,1,mr,q,1,q,1f5,1c,1,1c,1d,1,1,1,2,1,1,-8af,1,1,1,-2xy,1,1,1,-89z,3,3,2,1,2,1,1,-8bg,1,1,1,-8al,1,1,1,-8bj,1,1,1,-8bi,2,1,1,1,3,1,1,1,9,2,1,-8cf,1,1e,2,1,9,2,2,1,5,1,1,1,nym,n,2,1,k,e,2,1,3s,7,2,1,4,v,2,1,b,2,2,1,2,1,1,-r9g,1,5,2,1,5,1,1,1,2,1,1,-wmg,3,2,2,1,4,a,2,1,2,1,1,-wn8,1,1,1,-wnj,1,1,1,-wnf,1,1,1,-wn5,1,1,1,-wn8,2,1,1,-wlu,1,1,1,-wmi,1,1,1,-wlx,1,1,1,ps,1,8,2,1,2,1,1,-1c,1,1,1,-wn7,1,1,1,-raw,1,2,2,1,7,1,1,1,6,2,2,1,t,1,1,1,or,28,1,-tzk,ggy,q,1,w,xy,14,1,14,3t,10,1,14,4d,b,1,13,2,f,1,13,2,7,1,13,2,2,1,13,1d7,1f,1,1s,2cu,w,1,w,gw1,w,1,w,o81,y,1,y',
    multi_casefold: '67=37.37,8g=2x.lj,95=jg.32,ds=2y.lo,pc=qh.lk.ld,q8=qt.lk.ld,13b=12d.136,61i=2w.mp,61j=38.lk,61k=3b.lm,61l=3d.lm,61m=2p.ji,61q=37.37,66o=qt.lv,66q=qt.lv.lc,66s=qt.lv.ld,66u=qt.lv.n6,680=64g.qh,681=64h.qh,682=64i.qh,683=64j.qh,684=64k.qh,685=64l.qh,686=64m.qh,687=64n.qh,688=64g.qh,689=64h.qh,68a=64i.qh,68b=64j.qh,68c=64k.qh,68d=64l.qh,68e=64m.qh,68f=64n.qh,68g=65c.qh,68h=65d.qh,68i=65e.qh,68j=65f.qh,68k=65g.qh,68l=65h.qh,68m=65i.qh,68n=65j.qh,68o=65c.qh,68p=65d.qh,68q=65e.qh,68r=65f.qh,68s=65g.qh,68t=65h.qh,68u=65i.qh,68v=65j.qh,68w=674.qh,68x=675.qh,68y=676.qh,68z=677.qh,690=678.qh,691=679.qh,692=67a.qh,693=67b.qh,694=674.qh,695=675.qh,696=676.qh,697=677.qh,698=678.qh,699=679.qh,69a=67a.qh,69b=67b.qh,69e=67k.qh,69f=q9.qh,69g=q4.qh,69i=q9.n6,69j=q9.n6.qh,69o=q9.qh,69u=67o.qh,69v=qf.qh,69w=q6.qh,69y=qf.n6,69z=qf.n6.qh,6a4=qf.qh,6aa=qh.lk.lc,6ab=qh.lk.ld,6ae=qh.n6,6af=qh.lk.n6,6aq=qt.lk.lc,6ar=qt.lk.ld,6as=qp.lv,6au=qt.n6,6av=qt.lk.n6,6b6=67w.qh,6b7=qx.qh,6b8=r2.qh,6ba=qx.n6,6bb=qx.n6.qh,6bg=qx.qh,1dkw=2u.2u,1dkx=2u.2x,1dky=2u.30,1dkz=2u.2u.2x,1dl0=2u.2u.30,1dl1=37.38,1dl2=37.38,1dlf=12s.12u,1dlg=12s.12d,1dlh=12s.12j,1dli=132.12u,1dlj=12s.12l',
  });
  // </tablas-unicode>

  // ------------------------------------------------------------------ errores con el tipo de Python

  /** Error con el nombre de la excepción de Python en `pyTipo` (ValueError, TypeError, OverflowError…). */
  class PyError extends Error {
    constructor(pyTipo, mensaje) {
      super(mensaje);
      this.name = 'PyError';
      this.pyTipo = pyTipo;
    }
  }
  const error = (tipo, msg) => new PyError(tipo, msg);

  // ------------------------------------------------------------------ float

  /**
   * Marca de float de Python para valores que en JS serían enteros (3.0). Compatible con el envoltorio de
   * engine/fuente.js y parity/lib/normalize.mjs ({ [Symbol.for('R2.py.float')]: true, valor }): tiene esa marca y
   * `valor`, y todas las funciones de R2.py aceptan también ese envoltorio.
   */
  const MARCA_FLOAT = Symbol.for('R2.py.float');
  class PyFloat {
    constructor(v) { this.v = +v; }
    get valor() { return this.v; }
    get [MARCA_FLOAT]() { return true; }
    valueOf() { return this.v; }
    toString() { return reprFloat(this.v); }
    toJSON() { return this.v; }
  }
  /** ¿Envoltorio de float (PyFloat o { [MARCA_FLOAT]: true, valor })? */
  const esFloatEnvuelto = (v) => v instanceof PyFloat || (v !== null && typeof v === 'object' && v[MARCA_FLOAT] === true);
  const F = (x) => (x instanceof PyFloat ? x : new PyFloat(esFloatEnvuelto(x) ? x.valor : x));
  const esFloat = (v) => (typeof v === 'number' && !Number.isInteger(v)) || esFloatEnvuelto(v);
  const num = (v) => (v instanceof PyFloat ? v.v : (esFloatEnvuelto(v) ? +v.valor : v));

  /** Descompone un número finito distinto de 0 en |x| = m · 2^e (m BigInt). */
  const DV = new DataView(new ArrayBuffer(8));
  function descomponer(x) {
    DV.setFloat64(0, x);
    const hi = DV.getUint32(0), lo = DV.getUint32(4);
    const exp = (hi >>> 20) & 0x7ff;
    const m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    if (exp === 0) return [m, -1074];
    return [m | (1n << 52n), exp - 1075];
  }
  const signoNegativo = (x) => x < 0 || (x === 0 && 1 / x < 0);

  const POT10 = new Map();
  function pot10(n) {
    let p = POT10.get(n);
    if (p === undefined) { p = 10n ** BigInt(n); POT10.set(n, p); }
    return p;
  }

  /** |x| · 10^nd redondeado a entero con mitad a par, sobre el valor binario exacto (BigInt). */
  function escaladoExacto(x, nd) {
    if (x === 0) return 0n;
    const [m, e] = descomponer(x);
    let n = m, d = 1n;
    if (e >= 0) n <<= BigInt(e); else d <<= BigInt(-e);
    if (nd >= 0) n *= pot10(nd); else d *= pot10(-nd);
    let q = n / d;
    const dos = (n - q * d) << 1n;
    if (dos > d || (dos === d && (q & 1n) === 1n)) q += 1n;
    return q;
  }

  /**
   * Cifras de |x| redondeado a nd decimales (nd ≥ 0) con mitad a par: cadena «123.45» sin signo. Es lo que dan
   * _Py_dg_dtoa(modo 3) y format(x, '.Nf'). Camino rápido: toFixed es exacto salvo en los empates (redondea
   * hacia arriba), que solo pueden darse si x · 2^(nd+1) es entero.
   */
  function cifrasFijas(x, nd, forzarExacto = false) {
    const a = Math.abs(x);
    if (!forzarExacto && nd <= 100 && a < 1e21 && !Number.isInteger(a * 2 ** (nd + 1))) return a.toFixed(nd);
    const q = escaladoExacto(a, nd).toString();
    if (nd === 0) return q;
    const s = q.length <= nd ? '0'.repeat(nd - q.length + 1) + q : q;
    return s.slice(0, s.length - nd) + '.' + s.slice(s.length - nd);
  }

  const NDIGITS_MAX = 323, NDIGITS_MIN = -308;

  /**
   * round(x) y round(x, ndigits) de Python para float. Sin ndigits (null/undefined) devuelve un entero (number, o
   * BigInt si no cabe exacto) y lanza ValueError/OverflowError con NaN/inf. Con ndigits devuelve number (float):
   * inf/nan se devuelven igual y lanza OverflowError si el resultado se sale de float.
   */
  function pyRound(x, ndigits = null, forzarExacto = false) {
    x = num(x);
    if (ndigits === null || ndigits === undefined) {
      if (x !== x) throw error('ValueError', 'cannot convert float NaN to integer');
      if (!Number.isFinite(x)) throw error('OverflowError', 'cannot convert float infinity to integer');
      let r = Math.trunc(x);
      const d = Math.abs(x - r); // exacto: x y su parte entera comparten exponente
      if (d > 0.5 || (d === 0.5 && r % 2 !== 0)) r += x < 0 ? -1 : 1;
      if (r === 0) return 0;
      return Number.isSafeInteger(r) ? r : BigInt(r);
    }
    if (typeof ndigits !== 'number' || !Number.isInteger(ndigits)) throw error('TypeError', 'ndigits debe ser entero');
    if (!Number.isFinite(x) || x === 0) return x;
    if (ndigits > NDIGITS_MAX) return x;
    if (ndigits < NDIGITS_MIN) return signoNegativo(x) ? -0 : 0;
    let r;
    if (!forzarExacto && ndigits >= 0 && ndigits <= 100 && Math.abs(x) < 1e21 &&
        !Number.isInteger(x * 2 ** (ndigits + 1))) {
      r = Number(x.toFixed(ndigits));
    } else {
      const q = escaladoExacto(Math.abs(x), ndigits);
      r = Number(`${x < 0 ? '-' : ''}${q}e${-ndigits}`);
    }
    if (r === 0) return x < 0 ? -0 : 0;
    if (!Number.isFinite(r)) throw error('OverflowError', 'rounded value too large to represent');
    return r;
  }

  /** round(n, ndigits) de Python para int (number entero o BigInt): mitad a par con ndigits negativos. */
  function pyRoundInt(n, ndigits = null) {
    if (ndigits === null || ndigits === undefined || ndigits >= 0) return n;
    const b = BigInt(n), p = pot10(-ndigits);
    const neg = b < 0n, a = neg ? -b : b;
    let q = a / p;
    const dos = (a - q * p) * 2n;
    if (dos > p || (dos === p && (q & 1n) === 1n)) q += 1n;
    const r = (neg ? -q : q) * p;
    return typeof n === 'bigint' ? r : (r >= BigInt(Number.MIN_SAFE_INTEGER) && r <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(r) : r);
  }

  /** repr(float) de Python: el más corto que vuelve al mismo valor; exponente si decpt ≤ -4 o > 16. */
  function reprFloat(x) {
    x = num(x);
    if (x !== x) return 'nan';
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    if (x === 0) return 1 / x < 0 ? '-0.0' : '0.0';
    let s = String(x), signo = '';
    if (s[0] === '-') { signo = '-'; s = s.slice(1); }
    let exp = 0;
    const ie = s.indexOf('e');
    if (ie >= 0) { exp = +s.slice(ie + 1); s = s.slice(0, ie); }
    const ip = s.indexOf('.');
    let dig = ip >= 0 ? s.slice(0, ip) + s.slice(ip + 1) : s;
    let decpt = (ip >= 0 ? ip : s.length) + exp;
    let k = 0;
    while (k < dig.length - 1 && dig.charCodeAt(k) === 0x30) k++;
    dig = dig.slice(k);
    decpt -= k;
    let z = dig.length;
    while (z > 1 && dig.charCodeAt(z - 1) === 0x30) z--;
    dig = dig.slice(0, z);
    if (decpt > -4 && decpt <= 16) {
      if (decpt <= 0) return `${signo}0.${'0'.repeat(-decpt)}${dig}`;
      if (decpt >= dig.length) return `${signo}${dig}${'0'.repeat(decpt - dig.length)}.0`;
      return `${signo}${dig.slice(0, decpt)}.${dig.slice(decpt)}`;
    }
    const e = decpt - 1;
    const mant = dig.length > 1 ? `${dig[0]}.${dig.slice(1)}` : dig;
    return `${signo}${mant}e${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
  }

  /** str(int) para number entero o BigInt. */
  function intStr(n) {
    if (typeof n === 'bigint') return n.toString();
    if (Math.abs(n) < 1e21) return String(n === 0 ? 0 : n);
    return BigInt(n).toString();
  }

  // ------------------------------------------------------------------ tablas Unicode

  const B = { upper: 1, lower: 2, title: 4, cased: 8, case_ignorable: 16, alpha: 32, decimal: 64, digit: 128,
    numeric: 256, space: 512, printable: 1024 };
  const ALNUM = B.alpha | B.decimal | B.digit | B.numeric;

  function decodificarTramos(texto) {
    if (!texto) return new Int32Array(0);
    const n = texto.split(',');
    const t = new Int32Array(n.length);
    let v = 0;
    for (let i = 0; i < n.length; i++) { v += parseInt(n[i], 36); t[i] = v; }
    return t;
  }

  let U = null; // tablas decodificadas (perezosas)

  function unicode() {
    if (U) return U;
    const tramos = {};
    const bmp = new Uint16Array(0x10000);
    const puntos = new Set([0x10000, 0x110000]);
    for (const k of Object.keys(B)) {
      const t = tramos[k] = decodificarTramos(TABLAS[k]);
      for (let i = 0; i < t.length; i += 2) {
        const a = t[i], b = t[i + 1];
        for (let cp = a; cp <= Math.min(b, 0xffff); cp++) bmp[cp] |= B[k];
        if (b >= 0x10000) { puntos.add(Math.max(a, 0x10000)); puntos.add(b + 1); }
      }
    }
    const ini = Int32Array.from([...puntos].sort((x, y) => x - y));
    const astral = new Uint16Array(ini.length);
    const pos = new Map();
    ini.forEach((p, i) => pos.set(p, i));
    for (const k of Object.keys(B)) {
      const t = tramos[k];
      for (let i = 0; i < t.length; i += 2) {
        if (t[i + 1] < 0x10000) continue;
        for (let j = pos.get(Math.max(t[i], 0x10000)); ini[j] <= t[i + 1]; j++) astral[j] |= B[k];
      }
    }
    const mapas = {};
    for (const k of ['lower', 'upper', 'title', 'casefold']) mapas[k] = decodificarMapa(TABLAS['map_' + k], TABLAS['multi_' + k]);
    U = { tramos, bmp, ini, astral, mapas, nativo: {} };
    return U;
  }

  /** Banderas de un punto de código. */
  function banderas(cp) {
    const u = U || unicode();
    if (cp < 0x10000) return u.bmp[cp];
    const t = u.ini;
    let lo = 0, hi = t.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (t[m] <= cp) lo = m; else hi = m - 1;
    }
    return u.astral[lo];
  }

  const MULTI = 0x7fffffff;

  function decodificarMapa(corridas, multiples) {
    const bmp = new Int32Array(0x10000);
    const aIni = [], aN = [], aPaso = [], aDelta = [];
    const toks = corridas ? corridas.split(',') : [];
    let prev = 0;
    for (let i = 0; i < toks.length; i += 4) {
      const c = prev + parseInt(toks[i], 36), n = parseInt(toks[i + 1], 36);
      const paso = parseInt(toks[i + 2], 36), d = parseInt(toks[i + 3], 36);
      for (let j = 0; j < n; j++) {
        const cp = c + j * paso;
        if (cp < 0x10000) bmp[cp] = d;
      }
      if (c + (n - 1) * paso >= 0x10000) { aIni.push(c); aN.push(n); aPaso.push(paso); aDelta.push(d); }
      prev = c + (n - 1) * paso;
    }
    const multi = new Map();
    if (multiples) {
      for (const e of multiples.split(',')) {
        const [cp, s] = e.split('=');
        const c = parseInt(cp, 36);
        multi.set(c, s ? String.fromCodePoint(...s.split('.').map((x) => parseInt(x, 36))) : '');
        if (c < 0x10000) bmp[c] = MULTI;
      }
    }
    return { bmp, aIni, aN, aPaso, aDelta, multi };
  }

  /** Mapeo de un punto de código (cadena) o null si no cambia. */
  function mapearCp(mapa, cp) {
    if (cp < 0x10000) {
      const d = mapa.bmp[cp];
      if (d === 0) return null;
      if (d === MULTI) return mapa.multi.get(cp);
      return String.fromCodePoint(cp + d);
    }
    const m = mapa.multi.get(cp);
    if (m !== undefined) return m;
    const t = mapa.aIni;
    for (let i = 0; i < t.length; i++) { // pocas corridas astrales
      const c = t[i];
      if (cp < c) break;
      const off = cp - c;
      if (off % mapa.aPaso[i] === 0 && off / mapa.aPaso[i] < mapa.aN[i]) return String.fromCodePoint(cp + mapa.aDelta[i]);
    }
    return null;
  }

  /** Rangos [a0, b0, a1, b1, …] (inclusivos) de una propiedad: upper, lower, title, cased, case_ignorable, alpha,
   * decimal, digit, numeric, space, printable. Para construir clases de expresiones regulares iguales a Python. */
  function rangosUnicode(nombre) {
    const t = unicode().tramos[nombre];
    if (!t) throw new Error(`rangosUnicode: propiedad desconocida «${nombre}»`);
    return t.slice();
  }

  // ------------------------------------------------------------------ puntos de código

  const esAlto = (u) => u >= 0xd800 && u <= 0xdbff;
  const esBajo = (u) => u >= 0xdc00 && u <= 0xdfff;
  const SUSTITUTO = /[\uD800-\uDFFF]/;

  /** Puntos de código de una cadena (los sustitutos sueltos cuentan como uno, como en Python). */
  function cps(s) {
    const r = [];
    for (let i = 0; i < s.length;) {
      const cp = s.codePointAt(i);
      r.push(cp);
      i += cp > 0xffff ? 2 : 1;
    }
    return r;
  }

  /** len() de Python. */
  function pyLen(s) {
    if (!SUSTITUTO.test(s)) return s.length;
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      n++;
      if (esAlto(s.charCodeAt(i)) && i + 1 < s.length && esBajo(s.charCodeAt(i + 1))) i++;
    }
    return n;
  }

  /** Punto de código que termina en la posición i (exclusiva) y su longitud en unidades. */
  function cpAntes(s, i) {
    const u = s.charCodeAt(i - 1);
    if (esBajo(u) && i >= 2 && esAlto(s.charCodeAt(i - 2))) return [s.codePointAt(i - 2), 2];
    return [u, 1];
  }

  // ------------------------------------------------------------------ predicados de str

  function predicadoTodos(s, bit) {
    if (s.length === 0) return false;
    for (let i = 0; i < s.length;) {
      const cp = s.codePointAt(i);
      if (!(banderas(cp) & bit)) return false;
      i += cp > 0xffff ? 2 : 1;
    }
    return true;
  }

  /** ¿Es un solo punto de código? Devuelve el cp o -1. */
  function unico(s) {
    if (s.length === 1) return s.charCodeAt(0);
    if (s.length === 2) { const cp = s.codePointAt(0); if (cp > 0xffff) return cp; }
    return -1;
  }

  function isupper(s) {
    const c1 = unico(s);
    if (c1 >= 0) return (banderas(c1) & B.upper) !== 0;
    let cased = false;
    for (let i = 0; i < s.length;) {
      const cp = s.codePointAt(i), f = banderas(cp);
      if (f & (B.lower | B.title)) return false;
      if (!cased && (f & B.upper)) cased = true;
      i += cp > 0xffff ? 2 : 1;
    }
    return cased;
  }

  function islower(s) {
    const c1 = unico(s);
    if (c1 >= 0) return (banderas(c1) & B.lower) !== 0;
    let cased = false;
    for (let i = 0; i < s.length;) {
      const cp = s.codePointAt(i), f = banderas(cp);
      if (f & (B.upper | B.title)) return false;
      if (!cased && (f & B.lower)) cased = true;
      i += cp > 0xffff ? 2 : 1;
    }
    return cased;
  }

  function istitle(s) {
    const c1 = unico(s);
    if (c1 >= 0) return (banderas(c1) & (B.title | B.upper)) !== 0;
    let cased = false, prev = false;
    for (let i = 0; i < s.length;) {
      const cp = s.codePointAt(i), f = banderas(cp);
      if (f & (B.upper | B.title)) {
        if (prev) return false;
        prev = true; cased = true;
      } else if (f & B.lower) {
        if (!prev) return false;
        prev = true; cased = true;
      } else prev = false;
      i += cp > 0xffff ? 2 : 1;
    }
    return cased;
  }

  const isspace = (s) => predicadoTodos(s, B.space);
  const isalpha = (s) => predicadoTodos(s, B.alpha);
  const isdecimal = (s) => predicadoTodos(s, B.decimal);
  const isdigit = (s) => predicadoTodos(s, B.digit | B.decimal);
  const isnumeric = (s) => predicadoTodos(s, B.numeric | B.digit | B.decimal);
  const isalnum = (s) => predicadoTodos(s, ALNUM);
  const isprintable = (s) => s.length === 0 || predicadoTodos(s, B.printable);
  const isascii = (s) => /^[\x00-\x7f]*$/.test(s);

  /** Predicados por punto de código (banderas de Python). */
  const cp = {
    isupper: (c) => (banderas(c) & B.upper) !== 0,
    islower: (c) => (banderas(c) & B.lower) !== 0,
    istitle: (c) => (banderas(c) & (B.title | B.upper)) !== 0,
    iscased: (c) => (banderas(c) & B.cased) !== 0,
    iscaseignorable: (c) => (banderas(c) & B.case_ignorable) !== 0,
    isalpha: (c) => (banderas(c) & B.alpha) !== 0,
    isdecimal: (c) => (banderas(c) & B.decimal) !== 0,
    isdigit: (c) => (banderas(c) & (B.digit | B.decimal)) !== 0,
    isnumeric: (c) => (banderas(c) & (B.numeric | B.digit | B.decimal)) !== 0,
    isalnum: (c) => (banderas(c) & ALNUM) !== 0,
    isspace: (c) => (banderas(c) & B.space) !== 0,
    isprintable: (c) => (banderas(c) & B.printable) !== 0,
  };

  // ------------------------------------------------------------------ mayúsculas y minúsculas

  /** handle_capital_sigma: ¿la Σ en la posición i es final? */
  function sigmaFinal(s, i) {
    let j = i, antes = -1;
    while (j > 0) {
      const [c, n] = cpAntes(s, j);
      j -= n;
      if (!(banderas(c) & B.case_ignorable)) { antes = c; break; }
    }
    if (antes < 0 || !(banderas(antes) & B.cased)) return false;
    for (let k = i + 1; k < s.length;) {
      const c = s.codePointAt(k);
      if (!(banderas(c) & B.case_ignorable)) return !(banderas(c) & B.cased);
      k += c > 0xffff ? 2 : 1;
    }
    return true;
  }

  function mapearCadena(s, mapa, conSigma) {
    let out = '', desde = 0;
    for (let i = 0; i < s.length;) {
      const c = s.codePointAt(i), n = c > 0xffff ? 2 : 1;
      const m = conSigma && c === 0x3a3 ? (sigmaFinal(s, i) ? 'ς' : 'σ') : mapearCp(mapa, c);
      if (m !== null) { out += s.slice(desde, i) + m; desde = i + n; }
      i += n;
    }
    return desde === 0 ? s : out + s.slice(desde);
  }

  /** Tabla por unidad BMP: 1 si el motor da el mismo mapeo que Python y no depende del contexto. */
  function tablaNativa(nombre) {
    const u = unicode();
    if (u.nativo[nombre]) return u.nativo[nombre];
    const mapa = u.mapas[nombre];
    const ok = new Uint8Array(0x10000);
    for (let c = 0; c < 0x10000; c++) {
      if ((c >= 0xd800 && c <= 0xdfff) || c === 0x3a3) continue;
      const ch = String.fromCharCode(c);
      const py = mapearCp(mapa, c) ?? ch;
      const js = nombre === 'upper' ? ch.toUpperCase() : ch.toLowerCase();
      ok[c] = js === py ? 1 : 0;
    }
    return (u.nativo[nombre] = ok);
  }

  function todasNativas(s, ok) {
    for (let i = 0; i < s.length; i++) if (!ok[s.charCodeAt(i)]) return false;
    return true;
  }

  const ASCII = /^[\x00-\x7f]*$/;

  function lower(s) {
    if (ASCII.test(s) || todasNativas(s, tablaNativa('lower'))) return s.toLowerCase();
    return mapearCadena(s, unicode().mapas.lower, true);
  }

  function upper(s) {
    if (ASCII.test(s) || todasNativas(s, tablaNativa('upper'))) return s.toUpperCase();
    return mapearCadena(s, unicode().mapas.upper, false);
  }

  function casefold(s) {
    if (ASCII.test(s) || todasNativas(s, tablaNativa('casefold'))) return s.toLowerCase();
    return mapearCadena(s, unicode().mapas.casefold, false);
  }

  function title(s) {
    const u = unicode();
    let out = '', prev = false;
    for (let i = 0; i < s.length;) {
      const c = s.codePointAt(i), n = c > 0xffff ? 2 : 1;
      let m;
      if (prev) m = c === 0x3a3 ? (sigmaFinal(s, i) ? 'ς' : 'σ') : mapearCp(u.mapas.lower, c);
      else m = mapearCp(u.mapas.title, c);
      out += m === null ? s.slice(i, i + n) : m;
      prev = (banderas(c) & B.cased) !== 0;
      i += n;
    }
    return out;
  }

  function capitalize(s) {
    if (s.length === 0) return s;
    const u = unicode();
    const c = s.codePointAt(0), n = c > 0xffff ? 2 : 1;
    const m = mapearCp(u.mapas.title, c);
    const resto = s.slice(n);
    let r = '';
    let desde = 0;
    for (let i = 0; i < resto.length;) {
      const d = resto.codePointAt(i), k = d > 0xffff ? 2 : 1;
      const x = d === 0x3a3 ? (sigmaFinal(s, i + n) ? 'ς' : 'σ') : mapearCp(u.mapas.lower, d);
      if (x !== null) { r += resto.slice(desde, i) + x; desde = i + k; }
      i += k;
    }
    return (m === null ? s.slice(0, n) : m) + (desde === 0 ? resto : r + resto.slice(desde));
  }

  // ------------------------------------------------------------------ strip, split, partition…

  /** indexOf que no corta un par sustituto (Python compara puntos de código). */
  function buscar(s, sub, desde) {
    const bordeIni = sub.length > 0 && esBajo(sub.charCodeAt(0));
    const bordeFin = sub.length > 0 && esAlto(sub.charCodeAt(sub.length - 1));
    let i = s.indexOf(sub, desde);
    if (!bordeIni && !bordeFin) return i;
    while (i >= 0 && !limpio(s, sub, i, bordeIni, bordeFin)) i = s.indexOf(sub, i + 1);
    return i;
  }

  function buscarAtras(s, sub, hasta) {
    const bordeIni = sub.length > 0 && esBajo(sub.charCodeAt(0));
    const bordeFin = sub.length > 0 && esAlto(sub.charCodeAt(sub.length - 1));
    let i = s.lastIndexOf(sub, hasta);
    if (!bordeIni && !bordeFin) return i;
    while (i >= 0 && !limpio(s, sub, i, bordeIni, bordeFin)) i = i === 0 ? -1 : s.lastIndexOf(sub, i - 1);
    return i;
  }

  function limpio(s, sub, i, bordeIni, bordeFin) {
    if (bordeIni && i > 0 && esAlto(s.charCodeAt(i - 1))) return false;
    if (bordeFin && i + sub.length < s.length && esBajo(s.charCodeAt(i + sub.length))) return false;
    return true;
  }

  function conjuntoCps(chars) {
    return new Set(cps(chars));
  }

  function lstrip(s, chars = null) {
    let i = 0;
    if (chars === null || chars === undefined) {
      while (i < s.length && (banderas(s.charCodeAt(i)) & B.space)) i++;
    } else {
      const set = conjuntoCps(chars);
      while (i < s.length) {
        const c = s.codePointAt(i);
        if (!set.has(c)) break;
        i += c > 0xffff ? 2 : 1;
      }
    }
    return i === 0 ? s : s.slice(i);
  }

  function rstrip(s, chars = null) {
    let z = s.length;
    if (chars === null || chars === undefined) {
      while (z > 0 && (banderas(s.charCodeAt(z - 1)) & B.space)) z--;
    } else {
      const set = conjuntoCps(chars);
      while (z > 0) {
        const [c, n] = cpAntes(s, z);
        if (!set.has(c)) break;
        z -= n;
      }
    }
    return z === s.length ? s : s.slice(0, z);
  }

  const strip = (s, chars = null) => rstrip(lstrip(s, chars), chars);

  const esp = (s, i) => (banderas(s.charCodeAt(i)) & B.space) !== 0;
  const maxCuenta = (maxsplit) => (maxsplit === null || maxsplit === undefined || maxsplit < 0 ? Infinity : maxsplit);

  /** str.split(sep=None, maxsplit=-1). */
  function split(s, sep = null, maxsplit = -1) {
    let cuenta = maxCuenta(maxsplit);
    const r = [];
    if (sep === null || sep === undefined) {
      const n = s.length;
      let i = 0;
      while (cuenta-- > 0) {
        while (i < n && esp(s, i)) i++;
        if (i === n) break;
        const j = i;
        i++;
        while (i < n && !esp(s, i)) i++;
        r.push(s.slice(j, i));
      }
      if (i < n) {
        while (i < n && esp(s, i)) i++;
        if (i !== n) r.push(s.slice(i));
      }
      return r;
    }
    if (sep.length === 0) throw error('ValueError', 'empty separator');
    let desde = 0;
    while (cuenta-- > 0) {
      const k = buscar(s, sep, desde);
      if (k < 0) break;
      r.push(s.slice(desde, k));
      desde = k + sep.length;
    }
    r.push(s.slice(desde));
    return r;
  }

  /** str.rsplit(sep=None, maxsplit=-1). */
  function rsplit(s, sep = null, maxsplit = -1) {
    let cuenta = maxCuenta(maxsplit);
    const r = [];
    if (sep === null || sep === undefined) {
      let i = s.length - 1;
      while (cuenta-- > 0) {
        while (i >= 0 && esp(s, i)) i--;
        if (i < 0) break;
        const j = i;
        i--;
        while (i >= 0 && !esp(s, i)) i--;
        r.push(s.slice(i + 1, j + 1));
      }
      if (i >= 0) {
        while (i >= 0 && esp(s, i)) i--;
        if (i >= 0) r.push(s.slice(0, i + 1));
      }
      return r.reverse();
    }
    if (sep.length === 0) throw error('ValueError', 'empty separator');
    let hasta = s.length;
    while (cuenta-- > 0) {
      if (hasta < sep.length) break;
      const k = buscarAtras(s, sep, hasta - sep.length);
      if (k < 0) break;
      r.push(s.slice(k + sep.length, hasta));
      hasta = k;
    }
    r.push(s.slice(0, hasta));
    return r.reverse();
  }

  const SALTO = (u) => (u >= 0x0a && u <= 0x0d) || (u >= 0x1c && u <= 0x1e) || u === 0x85 || u === 0x2028 || u === 0x2029;

  /** str.splitlines(keepends=False). */
  function splitlines(s, keepends = false) {
    const r = [], n = s.length;
    let i = 0, j = 0;
    while (i < n) {
      while (i < n && !SALTO(s.charCodeAt(i))) i++;
      let eol = i;
      if (i < n) {
        if (s.charCodeAt(i) === 0x0d && i + 1 < n && s.charCodeAt(i + 1) === 0x0a) i += 2; else i++;
        if (keepends) eol = i;
      }
      r.push(s.slice(j, eol));
      j = i;
    }
    return r;
  }

  function partition(s, sep) {
    if (sep.length === 0) throw error('ValueError', 'empty separator');
    const k = buscar(s, sep, 0);
    return k < 0 ? [s, '', ''] : [s.slice(0, k), sep, s.slice(k + sep.length)];
  }

  function rpartition(s, sep) {
    if (sep.length === 0) throw error('ValueError', 'empty separator');
    const k = s.length >= sep.length ? buscarAtras(s, sep, s.length - sep.length) : -1;
    return k < 0 ? ['', '', s] : [s.slice(0, k), sep, s.slice(k + sep.length)];
  }

  /** Vista en puntos de código: [longitud, slice(a, b)]. */
  function vista(s) {
    if (!SUSTITUTO.test(s)) return [s.length, (a, b) => s.slice(a, b)];
    const c = Array.from(s);
    return [c.length, (a, b) => c.slice(a, b).join('')];
  }

  function coincideCola(s, sub, start, end, alFinal) {
    const [n, corte] = vista(s);
    const nsub = pyLen(sub);
    let a = start === null || start === undefined ? 0 : start;
    let z = end === null || end === undefined ? n : end;
    if (z > n) z = n; else if (z < 0) { z += n; if (z < 0) z = 0; }
    if (a < 0) { a += n; if (a < 0) a = 0; }
    if (z - nsub < a) return false;
    if (nsub === 0) return true;
    return alFinal ? corte(z - nsub, z) === sub : corte(a, a + nsub) === sub;
  }

  /** str.startswith(prefijo | [prefijos], start, end): índices en puntos de código. */
  function startswith(s, prefijo, start = null, end = null) {
    if (Array.isArray(prefijo)) return prefijo.some((p) => coincideCola(s, p, start, end, false));
    return coincideCola(s, prefijo, start, end, false);
  }

  function endswith(s, sufijo, start = null, end = null) {
    if (Array.isArray(sufijo)) return sufijo.some((p) => coincideCola(s, p, start, end, true));
    return coincideCola(s, sufijo, start, end, true);
  }

  /**
   * str.maketrans(x[, y[, z]]) → Map de punto de código a cadena, punto de código o null.
   * Con un argumento: Map u objeto con claves de un carácter o números.
   */
  function maketrans(x, y = undefined, z = undefined) {
    const t = new Map();
    if (y === undefined) {
      const pares = x instanceof Map ? [...x.entries()] : Object.entries(x);
      for (const [k, v] of pares) {
        if (typeof k === 'number') { t.set(k, v); continue; }
        const c = cps(k);
        if (c.length !== 1) throw error('ValueError', 'string keys in translate table must be of length 1');
        t.set(c[0], v);
      }
      return t;
    }
    const a = cps(x), b = cps(y);
    if (a.length !== b.length) throw error('ValueError', 'the first two maketrans arguments must have equal length');
    a.forEach((c, i) => t.set(c, b[i]));
    if (z !== undefined) for (const c of cps(z)) t.set(c, null);
    return t;
  }

  /** str.translate(tabla): tabla Map (u objeto) de punto de código → cadena | punto de código | null. */
  function translate(s, tabla) {
    const get = tabla instanceof Map ? (c) => tabla.get(c) : (c) => tabla[c];
    let out = '', desde = 0;
    for (let i = 0; i < s.length;) {
      const c = s.codePointAt(i), n = c > 0xffff ? 2 : 1;
      const v = get(c);
      if (v !== undefined) {
        out += s.slice(desde, i);
        if (v === null) { /* se borra */ } else if (typeof v === 'number') out += String.fromCodePoint(v);
        else out += v;
        desde = i + n;
      }
      i += n;
    }
    return desde === 0 ? s : out + s.slice(desde);
  }

  // ------------------------------------------------------------------ repr y str

  const hex = (n, w) => n.toString(16).padStart(w, '0');

  /** repr(str) de Python. */
  function reprStr(s) {
    const comilla = s.includes("'") && !s.includes('"') ? '"' : "'";
    let r = comilla;
    for (let i = 0; i < s.length;) {
      const c = s.codePointAt(i), n = c > 0xffff ? 2 : 1;
      if (c === 0x27 && comilla === "'") r += "\\'";
      else if (c === 0x5c) r += '\\\\';
      else if (c === 0x09) r += '\\t';
      else if (c === 0x0a) r += '\\n';
      else if (c === 0x0d) r += '\\r';
      else if (c < 0x20 || c === 0x7f) r += '\\x' + hex(c, 2);
      else if (c < 0x7f) r += s[i];
      else if (banderas(c) & B.printable) r += s.slice(i, i + n);
      else if (c <= 0xff) r += '\\x' + hex(c, 2);
      else if (c <= 0xffff) r += '\\u' + hex(c, 4);
      else r += '\\U' + hex(c, 8);
      i += n;
    }
    return r + comilla;
  }

  /** repr() de Python para los tipos de la convención (listas como list; usar {tupla: true} para tuplas). */
  function pyRepr(v, opciones = {}) {
    if (typeof v === 'string') return reprStr(v);
    if (Array.isArray(v)) {
      const items = v.map((x) => pyRepr(x));
      if (opciones.tupla) return items.length === 1 ? `(${items[0]},)` : `(${items.join(', ')})`;
      return `[${items.join(', ')}]`;
    }
    if (v instanceof Map) return `{${[...v].map(([k, x]) => `${pyRepr(k)}: ${pyRepr(x)}`).join(', ')}}`;
    if (v !== null && typeof v === 'object' && !esFloatEnvuelto(v)) {
      return `{${Object.keys(v).map((k) => `${reprStr(k)}: ${pyRepr(v[k])}`).join(', ')}}`;
    }
    return pyStr(v);
  }

  /** str() de Python: None, True/False, int, float (repr), str. */
  function pyStr(v) {
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (esFloatEnvuelto(v)) return reprFloat(num(v));
    if (typeof v === 'number') return Number.isInteger(v) ? intStr(v) : reprFloat(v);
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'string') return v;
    return pyRepr(v);
  }

  // ------------------------------------------------------------------ format()

  const ALINEACION = new Set(['<', '>', '=', '^']);

  function leerEntero(c, pos) {
    let v = 0, n = 0;
    while (pos + n < c.length && c[pos + n] >= '0' && c[pos + n] <= '9') { v = v * 10 + (c[pos + n].charCodeAt(0) - 48); n++; }
    return [n ? v : -1, n];
  }

  /** parse_internal_render_format_spec */
  function leerEspecificacion(spec, tipoDefecto, alineacionDefecto) {
    const c = Array.from(spec);
    const f = { relleno: ' ', alineacion: alineacionDefecto, signo: '', z: false, alterno: false, ancho: -1,
      miles: '', precision: -1, tipo: tipoDefecto };
    let pos = 0, rellenoDado = false, alineacionDada = false;
    if (c.length >= 2 && ALINEACION.has(c[1])) {
      f.alineacion = c[1]; f.relleno = c[0]; rellenoDado = alineacionDada = true; pos = 2;
    } else if (c.length >= 1 && ALINEACION.has(c[0])) {
      f.alineacion = c[0]; alineacionDada = true; pos = 1;
    }
    if (pos < c.length && (c[pos] === '+' || c[pos] === '-' || c[pos] === ' ')) f.signo = c[pos++];
    if (pos < c.length && c[pos] === 'z') { f.z = true; pos++; }
    if (pos < c.length && c[pos] === '#') { f.alterno = true; pos++; }
    if (!rellenoDado && pos < c.length && c[pos] === '0') {
      f.relleno = '0';
      if (!alineacionDada && alineacionDefecto === '>') f.alineacion = '=';
      pos++;
    }
    let [w, n] = leerEntero(c, pos);
    f.ancho = w; pos += n;
    if (pos < c.length && c[pos] === ',') { f.miles = ','; pos++; }
    if (pos < c.length && c[pos] === '_') {
      if (f.miles) throw error('ValueError', "Cannot specify both ',' and '_'.");
      f.miles = '_'; pos++;
    }
    if (pos < c.length && c[pos] === ',' && f.miles === '_') throw error('ValueError', "Cannot specify both ',' and '_'.");
    if (pos < c.length && c[pos] === '.') {
      pos++;
      [w, n] = leerEntero(c, pos);
      if (n === 0) throw error('ValueError', 'Format specifier missing precision');
      f.precision = w; pos += n;
    }
    if (c.length - pos > 1) throw error('ValueError', `Invalid format specifier '${spec}'`);
    if (c.length - pos === 1) f.tipo = c[pos];
    if (f.miles) {
      if ('defgEGF%'.includes(f.tipo) || f.tipo === '') f.agrupar = 3;
      else if ('boxX'.includes(f.tipo) && f.miles === '_') f.agrupar = 4;
      else throw error('ValueError', `Cannot specify '${f.miles}' with '${f.tipo}'.`);
    }
    return f;
  }

  /** _PyUnicode_InsertThousandsGrouping con min_width (relleno de ceros agrupado). */
  function agruparCifras(dig, minAncho, grupo, sep) {
    const partes = [];
    let restantes = dig.length, pos = dig.length, usarSep = false, roto = false;
    let largo;
    const trozo = (len) => { // de derecha a izquierda: separador (salvo el primero), cifras y ceros de relleno
      const ceros = Math.max(0, len - restantes);
      const nChars = Math.max(0, Math.min(restantes, len));
      if (usarSep) partes.push(sep);
      partes.push('0'.repeat(ceros) + dig.slice(pos - nChars, pos));
      pos -= nChars;
      restantes -= nChars;
    };
    if (grupo > 0) {
      for (;;) {
        largo = Math.min(grupo, Math.max(restantes, minAncho, 1));
        trozo(largo);
        usarSep = true;
        minAncho -= largo;
        if (restantes <= 0 && minAncho <= 0) { roto = true; break; }
        minAncho -= sep.length;
      }
    }
    if (!roto) {
      largo = Math.max(restantes, minAncho, 1);
      trozo(largo);
    }
    return partes.reverse().join('');
  }

  /** fill_number: [lpad][signo][prefijo][spad][cifras agrupadas][decimal][resto][rpad]. */
  function componerNumero(f, signoNeg, prefijo, cifras, conDecimal, resto, mayus) {
    let signo = '';
    if (f.signo === '+') signo = signoNeg ? '-' : '+';
    else if (f.signo === ' ') signo = signoNeg ? '-' : ' ';
    else if (signoNeg) signo = '-';
    const nNoCifras = signo.length + prefijo.length + (conDecimal ? 1 : 0) + resto.length;
    const minAncho = f.relleno === '0' && f.alineacion === '=' ? f.ancho - nNoCifras : 0;
    let agrupadas = '';
    if (cifras.length > 0) agrupadas = agruparCifras(cifras, minAncho, f.agrupar || 0, f.miles);
    const cuerpo = agrupadas + (conDecimal ? '.' : '') + resto;
    const relleno = f.ancho - (nNoCifras + agrupadas.length);
    let izq = '', medio = '', der = '';
    if (relleno > 0) {
      const r = (k) => f.relleno.repeat(k);
      if (f.alineacion === '<') der = r(relleno);
      else if (f.alineacion === '^') { izq = r(relleno >> 1); der = r(relleno - (relleno >> 1)); }
      else if (f.alineacion === '=') medio = r(relleno);
      else izq = r(relleno);
    }
    const txt = signo + (mayus ? prefijo.toUpperCase() : prefijo) + medio + (mayus ? cuerpo.toUpperCase() : cuerpo);
    return izq + txt + der;
  }

  function formatoCadena(s, f) {
    if (f.signo) throw error('ValueError', f.signo === ' ' ? 'Space not allowed in string format specifier' : 'Sign not allowed in string format specifier');
    if (f.z) throw error('ValueError', 'Negative zero coercion (z) not allowed in format specifier');
    if (f.alterno) throw error('ValueError', 'Alternate form (#) not allowed in string format specifier');
    if (f.alineacion === '=') throw error('ValueError', "'=' alignment not allowed in string format specifier");
    if (f.tipo !== 's') throw error('ValueError', `Unknown format code '${f.tipo}' for object of type 'str'`);
    const c = Array.from(s);
    let txt = f.precision >= 0 && c.length > f.precision ? c.slice(0, f.precision).join('') : s;
    const largo = Math.min(c.length, f.precision >= 0 ? f.precision : c.length);
    const relleno = f.ancho - largo;
    if (relleno <= 0) return txt;
    if (f.alineacion === '>') return f.relleno.repeat(relleno) + txt;
    if (f.alineacion === '^') return f.relleno.repeat(relleno >> 1) + txt + f.relleno.repeat(relleno - (relleno >> 1));
    return txt + f.relleno.repeat(relleno);
  }

  function formatoFloat(x, f) {
    let tipo = f.tipo, precision = f.precision, porcentaje = false;
    if (tipo === '') {
      if (precision >= 0) throw error('NoSoportado', 'format sin tipo y con precisión (estilo g) no está implementado');
      tipo = 'r';
    }
    if (!'rfF%'.includes(tipo)) {
      if ('eEgGn'.includes(tipo)) throw error('NoSoportado', `format con tipo '${tipo}' no está implementado`);
      throw error('ValueError', `Unknown format code '${tipo}' for object of type 'float'`);
    }
    if (tipo === '%') { tipo = 'f'; x *= 100; porcentaje = true; }
    if (precision < 0) precision = 6;
    let neg = signoNegativo(x), txt;
    if (x !== x) { txt = 'nan'; neg = false; }
    else if (!Number.isFinite(x)) txt = 'inf';
    else if (tipo === 'r') txt = reprFloat(Math.abs(x));
    else {
      txt = cifrasFijas(x, precision);
      if (f.alterno && precision === 0) txt += '.';
    }
    if (neg && f.z && /^[0.]*$/.test(txt)) neg = false;
    if (porcentaje) txt += '%';
    let i = 0;
    while (i < txt.length && txt.charCodeAt(i) >= 48 && txt.charCodeAt(i) <= 57) i++;
    const conDecimal = txt[i] === '.';
    return componerNumero(f, neg, '', txt.slice(0, i), conDecimal, txt.slice(i + (conDecimal ? 1 : 0)), tipo === 'F');
  }

  function formatoEntero(n, f) {
    if ('eEfFgG%'.includes(f.tipo) && f.tipo !== '') return formatoFloat(Number(n), f);
    if (f.precision >= 0) throw error('ValueError', 'Precision not allowed in integer format specifier');
    if (f.z) throw error('ValueError', 'Negative zero coercion (z) not allowed in integer format specifier');
    const base = { b: 2, o: 8, x: 16, X: 16, d: 10, '': 10 }[f.tipo];
    if (base === undefined) {
      if (f.tipo === 'c' || f.tipo === 'n') throw error('NoSoportado', `format con tipo '${f.tipo}' no está implementado`);
      throw error('ValueError', `Unknown format code '${f.tipo}' for object of type 'int'`);
    }
    const b = BigInt(n), neg = b < 0n;
    const cifras = (neg ? -b : b).toString(base);
    const prefijo = f.alterno && base !== 10 ? '0' + f.tipo.toLowerCase() : '';
    return componerNumero(f, neg, prefijo, cifras, false, '', f.tipo === 'X');
  }

  /**
   * format(valor, especificación) de Python. Tipos: int (number entero o BigInt; boolean como int salvo con
   * especificación vacía), float (number no entero o PyFloat) y str. No implementados (lanzan PyError
   * 'NoSoportado'): tipos e E g G n c y float sin tipo con precisión.
   */
  function pyFormat(v, spec = '') {
    if (typeof v === 'string') return formatoCadena(v, leerEspecificacion(spec, 's', '<'));
    if (typeof v === 'boolean') {
      if (spec === '') return v ? 'True' : 'False';
      v = v ? 1 : 0;
    }
    if (v === null || v === undefined) {
      if (spec === '') return 'None';
      throw error('TypeError', 'unsupported format string passed to NoneType.__format__');
    }
    if (esFloat(v)) return formatoFloat(num(v), leerEspecificacion(spec, '', '>'));
    if (typeof v === 'number' && !Number.isFinite(v)) return formatoFloat(v, leerEspecificacion(spec, '', '>'));
    if (typeof v === 'number' || typeof v === 'bigint') return formatoEntero(v, leerEspecificacion(spec, 'd', '>'));
    throw error('TypeError', `format: tipo no admitido (${typeof v})`);
  }

  /** f"{x:.Nf}" y f"{x:,.Nf}". */
  const fmtFixed = (x, n, miles = false) => pyFormat(F(num(x)), `${miles ? ',' : ''}.${n}f`);
  /** f"{n:,}" (entero) con separador de miles opcional distinto de «,» (ngram usa .replace(",", ".")). */
  const fmtMiles = (n, sep = ',') => (sep === ',' ? pyFormat(n, ',') : pyFormat(n, ',').split(',').join(sep));

  // ------------------------------------------------------------------ comparación y orden

  function claseOrden(v) {
    switch (typeof v) {
      case 'number': case 'bigint': case 'boolean': return 1;
      case 'string': return 2;
      case 'object':
        if (v === null) return 0;
        if (esFloatEnvuelto(v)) return 1;
        if (Array.isArray(v)) return 3;
        return 4;
      default: return 5;
    }
  }

  const nombreTipo = (v) => ['NoneType', 'int', 'str', 'tuple', 'object', typeof v][claseOrden(v)];

  /** Comparación de cadenas por punto de código (Python), no por unidad UTF-16. */
  function cmpStr(a, b) {
    if (a === b) return 0;
    const n = Math.min(a.length, b.length);
    let i = 0;
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    if (i === n) return a.length < b.length ? -1 : (a.length > b.length ? 1 : 0);
    const x = a.charCodeAt(i), y = b.charCodeAt(i);
    if (x < 0xd800 && y < 0xd800) return x < y ? -1 : 1;
    // Puntos de código completos en la primera diferencia (con el alto compartido si i cae en un bajo).
    let ca, cb;
    if (i > 0 && esAlto(a.charCodeAt(i - 1))) {
      const bajoA = esBajo(x), bajoB = esBajo(y);
      if (bajoA && bajoB) return x < y ? -1 : 1;
      if (bajoA !== bajoB) return bajoA ? 1 : -1; // par (≥ U+10000) frente a alto suelto (< U+DC00)
    }
    ca = a.codePointAt(i); cb = b.codePointAt(i);
    if (ca !== cb) return ca < cb ? -1 : 1;
    return x < y ? -1 : 1;
  }

  /** a == b de Python (números con bool, cadenas, tuplas, None). */
  function eq(a, b) {
    const ka = claseOrden(a), kb = claseOrden(b);
    if (ka !== kb) return false;
    switch (ka) {
      case 0: return true;
      case 1: return num(a) == num(b); // eslint-disable-line eqeqeq
      case 2: return a === b;
      case 3:
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false;
        return true;
      default: return a === b;
    }
  }

  /** a < b de Python; TypeError si los tipos no se pueden ordenar (None con otro, str con int…). */
  function lt(a, b) {
    const ka = claseOrden(a), kb = claseOrden(b);
    if (ka === 1 && kb === 1) return num(a) < num(b);
    if (ka === 2 && kb === 2) return cmpStr(a, b) < 0;
    if (ka === 3 && kb === 3) {
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) if (!eq(a[i], b[i])) return lt(a[i], b[i]);
      return a.length < b.length;
    }
    throw error('TypeError', `'<' not supported between instances of '${nombreTipo(a)}' and '${nombreTipo(b)}'`);
  }

  /** -1, 0 o 1 con la semántica de < de Python. */
  function cmp(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : (b < a ? 1 : 0);
    if (typeof a === 'string' && typeof b === 'string') return cmpStr(a, b);
    return lt(a, b) ? -1 : (lt(b, a) ? 1 : 0);
  }

  /** sorted(iterable, key=None, reverse=False): estable, la clave se calcula una vez por elemento. */
  function sorted(iterable, opciones = {}) {
    const { key = null, reverse = false } = opciones;
    const d = [];
    let i = 0;
    for (const v of iterable) { d.push([key ? key(v) : v, i++, v]); }
    d.sort(reverse ? (x, y) => cmp(y[0], x[0]) : (x, y) => cmp(x[0], y[0]));
    return d.map((x) => x[2]);
  }

  /** _clave_sql de search.py: (v is not None, v if v is not None else 0) → NULL antes que cualquier valor. */
  const claveSql = (v) => (v === null || v === undefined ? [false, 0] : [true, v]);

  function bisectLeft(a, x, lo = 0, hi = null, key = null) {
    if (lo < 0) throw error('ValueError', 'lo must be non-negative');
    if (hi === null || hi === undefined) hi = a.length;
    if (key === null && typeof x === 'number') {
      while (lo < hi) { const m = (lo + hi) >>> 1; if (cmp(a[m], x) < 0) lo = m + 1; else hi = m; }
      return lo;
    }
    while (lo < hi) { const m = (lo + hi) >>> 1; if (lt(key ? key(a[m]) : a[m], x)) lo = m + 1; else hi = m; }
    return lo;
  }

  function bisectRight(a, x, lo = 0, hi = null, key = null) {
    if (lo < 0) throw error('ValueError', 'lo must be non-negative');
    if (hi === null || hi === undefined) hi = a.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (lt(x, key ? key(a[m]) : a[m])) hi = m; else lo = m + 1; }
    return lo;
  }

  /** max(iterable, key=None): el primero de los máximos. */
  function pyMax(iterable, key = null) {
    let mejor, kMejor, hay = false;
    for (const v of iterable) {
      const k = key ? key(v) : v;
      if (!hay || lt(kMejor, k)) { mejor = v; kMejor = k; hay = true; }
    }
    if (!hay) throw error('ValueError', 'max() arg is an empty sequence');
    return mejor;
  }

  function pyMin(iterable, key = null) {
    let mejor, kMejor, hay = false;
    for (const v of iterable) {
      const k = key ? key(v) : v;
      if (!hay || lt(k, kMejor)) { mejor = v; kMejor = k; hay = true; }
    }
    if (!hay) throw error('ValueError', 'min() arg is an empty sequence');
    return mejor;
  }

  // ------------------------------------------------------------------ Counter

  /**
   * collections.Counter sobre un Map (orden de inserción). Claves str o number; para tuplas u otras claves
   * compuestas, pasar `clave` (p. ej. JSON.stringify): se guarda la clave original la primera vez.
   * Diferencia con Python: 1, 1.0 y True son la misma clave en Python y aquí true ≠ 1.
   */
  class Counter {
    constructor(iterable = null, opciones = {}) {
      this.clave = opciones.clave || null;
      this.m = new Map();
      this.orig = this.clave ? new Map() : null;
      if (iterable) this.update(iterable);
    }
    _k(k) {
      if (!this.clave) return k;
      const c = this.clave(k);
      if (!this.orig.has(c)) this.orig.set(c, k);
      return c;
    }
    add(k, n = 1) {
      const c = this._k(k);
      this.m.set(c, (this.m.get(c) || 0) + n);
      return this;
    }
    update(iterable) {
      if (iterable instanceof Counter) { for (const [k, n] of iterable.items()) this.add(k, n); return this; }
      if (iterable instanceof Map) { for (const [k, n] of iterable) this.add(k, n); return this; }
      for (const k of iterable) this.add(k, 1);
      return this;
    }
    get(k) { return this.m.get(this.clave ? this.clave(k) : k) || 0; }
    set(k, n) { this.m.set(this._k(k), n); return this; }
    has(k) { return this.m.has(this.clave ? this.clave(k) : k); }
    delete(k) {
      const c = this.clave ? this.clave(k) : k;
      if (this.orig) this.orig.delete(c);
      return this.m.delete(c);
    }
    get size() { return this.m.size; }
    total() { let t = 0; for (const n of this.m.values()) t += n; return t; }
    keys() { return this.clave ? [...this.m.keys()].map((c) => this.orig.get(c)) : [...this.m.keys()]; }
    values() { return [...this.m.values()]; }
    items() { return this.clave ? [...this.m].map(([c, n]) => [this.orig.get(c), n]) : [...this.m]; }
    /** most_common(n=None): recuento descendente; a igual recuento, orden de inserción. */
    most_common(n = null) {
      if (n !== null && n !== undefined && n <= 0) return [];
      const it = this.items();
      const orden = it.map((x, i) => i).sort((i, j) => (it[j][1] - it[i][1]) || (i - j));
      const r = orden.map((i) => it[i]);
      return n === null || n === undefined ? r : r.slice(0, n);
    }
  }

  // ------------------------------------------------------------------ strftime

  const DIAS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MESES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'];
  const d2 = (n) => String(n).padStart(2, '0');

  /** time.strftime(formato, time.localtime(t)) con locale C. `fecha`: Date o milisegundos; por defecto, ahora. */
  function strftime(formato, fecha = new Date()) {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    const Y = d.getFullYear(), mo = d.getMonth(), D = d.getDate(), H = d.getHours(), M = d.getMinutes(),
      S = d.getSeconds(), w = d.getDay();
    const yday = Math.round((Date.UTC(Y, mo, D) - Date.UTC(Y, 0, 1)) / 86400000);
    let r = '';
    for (let i = 0; i < formato.length; i++) {
      const c = formato[i];
      if (c !== '%') { r += c; continue; }
      const k = formato[++i];
      switch (k) {
        case 'Y': r += String(Y); break;
        case 'y': r += d2(((Y % 100) + 100) % 100); break;
        case 'm': r += d2(mo + 1); break;
        case 'd': r += d2(D); break;
        case 'H': r += d2(H); break;
        case 'I': r += d2(H % 12 === 0 ? 12 : H % 12); break;
        case 'M': r += d2(M); break;
        case 'S': r += d2(S); break;
        case 'p': r += H < 12 ? 'AM' : 'PM'; break;
        case 'j': r += String(yday + 1).padStart(3, '0'); break;
        case 'a': r += DIAS[w].slice(0, 3); break;
        case 'A': r += DIAS[w]; break;
        case 'b': r += MESES[mo].slice(0, 3); break;
        case 'B': r += MESES[mo]; break;
        case 'w': r += String(w); break;
        case 'U': r += d2(Math.floor((yday + 7 - w) / 7)); break;
        case 'W': r += d2(Math.floor((yday + 7 - ((w + 6) % 7)) / 7)); break;
        case 'z': {
          const off = -d.getTimezoneOffset();
          r += (off < 0 ? '-' : '+') + d2(Math.floor(Math.abs(off) / 60)) + d2(Math.abs(off) % 60);
          break;
        }
        case '%': r += '%'; break;
        default: throw error('NoSoportado', `strftime: directiva %${k ?? ''} no implementada`);
      }
    }
    return r;
  }

  // ------------------------------------------------------------------ salida

  R2.py = R2.py || {};
  /** Solo para tests: mapeo por la tabla, sin el camino rápido del motor. */
  const mapearConTabla = (s, nombre) => (nombre === 'title' ? title(s)
    : mapearCadena(s, unicode().mapas[nombre], nombre === 'lower'));

  R2.py.core = {
    PyError, PyFloat, MARCA_FLOAT, F, esFloat, esFloatEnvuelto, num,
    pyRound, pyRoundInt, reprFloat, intStr, cifrasFijas, pyStr, pyRepr, reprStr, pyFormat, fmtFixed, fmtMiles,
    cmp, cmpStr, lt, eq, sorted, claveSql, bisectLeft, bisectRight, bisect_left: bisectLeft,
    bisect_right: bisectRight, pyMax, pyMin, Counter,
    strip, lstrip, rstrip, split, rsplit, splitlines, partition, rpartition, startswith, endswith, maketrans,
    translate, pyLen, cps,
    isupper, islower, istitle, isspace, isalpha, isdecimal, isdigit, isnumeric, isalnum, isprintable, isascii,
    lower, upper, title, capitalize, casefold, cp, rangosUnicode, banderas, BANDERAS: Object.freeze({ ...B }),
    mapearConTabla,
    strftime,
    TABLAS,
  };
})(globalThis.R2 = globalThis.R2 || {});

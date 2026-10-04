












(function () {
  'use strict';
  var faltan = [];
  function prueba(nombre, fn) {
    var ok = false;
    try { ok = !!fn(); } catch (e) { ok = false; }
    if (!ok) faltan.push(nombre);
  }
  prueba('WebAssembly', function () { return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function'; });
  prueba('Web Workers', function () { return typeof Worker === 'function'; });
  prueba('Blob y URL.createObjectURL', function () { return typeof Blob === 'function' && typeof URL === 'function' && typeof URL.createObjectURL === 'function'; });
  prueba('TextDecoder', function () { return typeof TextDecoder === 'function'; });
  prueba('BigInt64Array', function () { return typeof BigInt64Array === 'function'; });
  prueba('expresiones regulares con la marca v', function () { return new RegExp('[\\p{L}--[a-z]]', 'v').test('é'); });
  prueba('miradas atrás en expresiones regulares', function () { return new RegExp('(?<=a)b').test('ab'); });
  prueba('<dialog>', function () { return typeof HTMLDialogElement === 'function'; });
  prueba('sintaxis de JavaScript moderna', function () {

    return new Function('class A { #x = 1; static s = 2; get x() { return this.#x; } }\n'
      + 'const o = { a: { b: 1 } }; let z = null; z ??= 3;\n'
      + 'return new A().x + (o?.a?.b ?? 0) + A.s + z === 7 && [1, 2].at(-1) === 2 && Object.hasOwn(o, "a");')();
  });
  if (/(^|[#&])r2-navegador-no-apto(&|$)/.test(location.hash)) faltan.push('prueba forzada (#r2-navegador-no-apto)');

  window.R2_NAVEGADOR = { apto: faltan.length === 0, faltan: faltan };
  if (!faltan.length) return;

  try { window.stop(); } catch (e) {   }
  var escapar = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  // Corre antes que i18n.js: lleva sus propias tres versiones y lee la lengua igual que él (?lang=, localStorage).
  var lengua = 'es';
  try {
    var m = /[?&]lang=(es|en|pt)(?:&|$)/i.exec(location.search);
    lengua = m ? m[1].toLowerCase() : (localStorage.getItem('diarios-explorer:v1:lengua') || 'es');
  } catch (e) {   }
  var TEXTOS = {
    es: ['es', 'Diarios Explorer · navegador no compatible', 'Este navegador no puede abrir Diarios Explorer',
      'La página necesita un navegador reciente: <b>Chrome o Edge 112</b> o posterior, <b>Firefox 116</b> o posterior, '
      + 'o <b>Safari 17</b> o posterior. Actualice el navegador o abra este mismo archivo con otro.',
      'A este navegador le falta:', 'Los datos se eligen al abrir la página: un CSV de intervenciones por país.'],
    en: ['en', 'Diarios Explorer · unsupported browser', 'This browser cannot open Diarios Explorer',
      'The page needs a recent browser: <b>Chrome or Edge 112</b> or later, <b>Firefox 116</b> or later, '
      + 'or <b>Safari 17</b> or later. Update the browser or open this same file with another one.',
      'This browser lacks:', 'The data are chosen when the page opens: one CSV of speeches per country.'],
    pt: ['pt-BR', 'Diarios Explorer · navegador incompatível', 'Este navegador não consegue abrir o Diarios Explorer',
      'A página precisa de um navegador recente: <b>Chrome ou Edge 112</b> ou posterior, <b>Firefox 116</b> ou posterior, '
      + 'ou <b>Safari 17</b> ou posterior. Atualize o navegador ou abra este mesmo arquivo em outro.',
      'Faltam a este navegador:', 'Os dados são escolhidos ao abrir a página: um CSV de intervenções por país.']
  };
  var T = TEXTOS[lengua] || TEXTOS.es;
  var lista = '';
  for (var i = 0; i < faltan.length; i++) lista += '<li>' + escapar(faltan[i]) + '</li>';
  document.documentElement.innerHTML = '<head><meta charset="utf-8"><title>' + T[1] + '</title></head>'
    + '<body style="margin:0;background:#f7f6f3;color:#1d1b18;font:15px/1.55 -apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif">'
    + '<main role="alert" id="r2-navegador-no-apto" style="max-width:40em;margin:12vh auto;padding:0 20px">'
    + '<h1 style="font-size:22px;font-weight:650;margin:0 0 10px">' + T[2] + '</h1>'
    + '<p>' + T[3] + '</p>'
    + '<p style="color:#5f5a52;font-size:13px">' + T[4] + '</p><ul style="color:#5f5a52;font-size:13px">' + lista + '</ul>'
    + '<p style="color:#5f5a52;font-size:13px">' + T[5] + '</p>'
    + '</main></body>';
  document.documentElement.lang = T[0];
})();
//# sourceURL=2rep-standalone/src/cargas/navegador.js

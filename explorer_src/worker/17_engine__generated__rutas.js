/* ===== src/engine/generated/rutas.js ===== */
// GENERADO por standalone/tools/gen_static.py a partir de app/backend/*.py. No editar a mano.
// Regenerar: /opt/anaconda3/bin/python3 standalone/tools/gen_static.py   (comprobar: --check)
// R2.gen.rutas: rutas de server.py con sus parámetros y límites.
(function (R2) {
  'use strict';
  const congelar = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(congelar); Object.freeze(o); } return o; };
  const gen = R2.gen = R2.gen || {};
  gen.rutas = congelar([
 {
  "metodo": "GET",
  "ruta": "/api/info",
  "funcion": "api_info",
  "parametros": [],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/api/facets",
  "funcion": "api_facets",
  "parametros": [],
  "num_cuerpo": []
 },
 {
  "metodo": "POST",
  "ruta": "/api/search",
  "funcion": "api_search",
  "parametros": [
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": [
   {
    "clave": "limit",
    "defecto": 50,
    "min": 1,
    "max": 200
   },
   {
    "clave": "offset",
    "defecto": 0,
    "min": 0,
    "max": 10000000
   },
   {
    "clave": "climate_budget_ms",
    "defecto": 60,
    "min": 0,
    "max": 10000
   }
  ]
 },
 {
  "metodo": "POST",
  "ruta": "/api/climate",
  "funcion": "api_climate",
  "parametros": [
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "POST",
  "ruta": "/api/stats",
  "funcion": "api_stats",
  "parametros": [
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/api/speech/{sid}",
  "funcion": "api_speech",
  "parametros": [
   {
    "nombre": "sid",
    "anotacion": "int",
    "en": "ruta"
   },
   {
    "nombre": "context",
    "anotacion": "int",
    "en": "query",
    "defecto": 3,
    "ge": 0,
    "le": 50
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/api/session/outline/{sid}",
  "funcion": "api_session_outline",
  "parametros": [
   {
    "nombre": "sid",
    "anotacion": "int",
    "en": "ruta"
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/api/session/texts",
  "funcion": "api_session_texts",
  "parametros": [
   {
    "nombre": "from_id",
    "anotacion": "int",
    "en": "query"
   },
   {
    "nombre": "to_id",
    "anotacion": "int",
    "en": "query"
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "POST",
  "ruta": "/api/ngram",
  "funcion": "api_ngram",
  "parametros": [
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/api/collections/{cid}/keyness",
  "funcion": "api_collection_keyness",
  "parametros": [
   {
    "nombre": "cid",
    "anotacion": "int",
    "en": "ruta"
   },
   {
    "nombre": "min_freq",
    "anotacion": "int",
    "en": "query",
    "defecto": 5,
    "ge": 1,
    "le": 1000
   },
   {
    "nombre": "limit",
    "anotacion": "int",
    "en": "query",
    "defecto": 500,
    "ge": 1,
    "le": 20000
   },
   {
    "nombre": "limit_negative",
    "anotacion": "int",
    "en": "query",
    "defecto": 50,
    "ge": 0,
    "le": 1000
   },
   {
    "nombre": "solo_discurso",
    "anotacion": "bool",
    "en": "query",
    "defecto": true
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/api/careo/{sid}",
  "funcion": "api_careo",
  "parametros": [
   {
    "nombre": "sid",
    "anotacion": "int",
    "en": "ruta"
   },
   {
    "nombre": "mode",
    "anotacion": "str",
    "en": "query",
    "defecto": "synchronic",
    "pattern": "^(synchronic|diachronic)$"
   },
   {
    "nombre": "top",
    "anotacion": "int",
    "en": "query",
    "defecto": 5,
    "ge": 1,
    "le": 20
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/api/session",
  "funcion": "api_session",
  "parametros": [
   {
    "nombre": "date",
    "anotacion": "str",
    "en": "query"
   },
   {
    "nombre": "num_session",
    "anotacion": "int | None",
    "en": "query",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/api/collections",
  "funcion": "api_collections",
  "parametros": [],
  "num_cuerpo": []
 },
 {
  "metodo": "POST",
  "ruta": "/api/collections",
  "funcion": "api_collection_create",
  "parametros": [
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "PATCH",
  "ruta": "/api/collections/{cid}",
  "funcion": "api_collection_update",
  "parametros": [
   {
    "nombre": "cid",
    "anotacion": "int",
    "en": "ruta"
   },
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "DELETE",
  "ruta": "/api/collections/{cid}",
  "funcion": "api_collection_delete",
  "parametros": [
   {
    "nombre": "cid",
    "anotacion": "int",
    "en": "ruta"
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/api/collections/{cid}/items",
  "funcion": "api_collection_items",
  "parametros": [
   {
    "nombre": "cid",
    "anotacion": "int",
    "en": "ruta"
   },
   {
    "nombre": "limit",
    "anotacion": "int",
    "en": "query",
    "defecto": 500,
    "ge": 1,
    "le": 5000
   },
   {
    "nombre": "offset",
    "anotacion": "int",
    "en": "query",
    "defecto": 0,
    "ge": 0
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "POST",
  "ruta": "/api/collections/{cid}/items",
  "funcion": "api_collection_add",
  "parametros": [
   {
    "nombre": "cid",
    "anotacion": "int",
    "en": "ruta"
   },
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "POST",
  "ruta": "/api/collections/{cid}/items/remove",
  "funcion": "api_collection_remove",
  "parametros": [
   {
    "nombre": "cid",
    "anotacion": "int",
    "en": "ruta"
   },
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "PATCH",
  "ruta": "/api/collections/{cid}/items/{sid}",
  "funcion": "api_item_update",
  "parametros": [
   {
    "nombre": "cid",
    "anotacion": "int",
    "en": "ruta"
   },
   {
    "nombre": "sid",
    "anotacion": "int",
    "en": "ruta"
   },
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/api/searches",
  "funcion": "api_searches",
  "parametros": [],
  "num_cuerpo": []
 },
 {
  "metodo": "POST",
  "ruta": "/api/searches",
  "funcion": "api_search_save",
  "parametros": [
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "DELETE",
  "ruta": "/api/searches/{sid}",
  "funcion": "api_search_delete",
  "parametros": [
   {
    "nombre": "sid",
    "anotacion": "int",
    "en": "ruta"
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "POST",
  "ruta": "/api/export",
  "funcion": "api_export",
  "parametros": [
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "POST",
  "ruta": "/api/export/estimate",
  "funcion": "api_export_estimate",
  "parametros": [
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "POST",
  "ruta": "/api/import",
  "funcion": "api_import",
  "parametros": [
   {
    "nombre": "body",
    "anotacion": "Any",
    "en": "cuerpo",
    "defecto": null
   }
  ],
  "num_cuerpo": []
 },
 {
  "metodo": "GET",
  "ruta": "/",
  "funcion": "index",
  "parametros": [],
  "num_cuerpo": []
 }
]);
})(globalThis.R2 = globalThis.R2 || {});

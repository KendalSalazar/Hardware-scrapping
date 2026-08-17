Actúa como un arquitecto de software senior. Vas a generar un archivo 
PLAN-FASE-2.md que sirva como especificación técnica detallada para que 
modelos de IA más pequeños ejecuten sin ambigüedad. No escribas código 
todavía — solo el plan. Cubre ÚNICAMENTE Fase 2 (API con filtros 
dinámicos). No adelantes frontend (Fase 3) ni auth funcional (Fase 4).

## CONTEXTO DEL PROYECTO (verificalo vos mismo, no asumas)

Antes de generar el plan, inspeccioná el estado real del código en el 
monorepo — no asumas nada de lo que sigue como descripción definitiva, 
es solo orientación de dónde mirar. Fase 0 y Fase 1 ya están 
implementadas y funcionando con datos reales.

Revisá específicamente:
1. packages/shared-types/src/ — confirmá la forma exacta de 
   CATEGORY_REGISTRY, RAM_SCHEMA, FilterDefinition, CategorySlug, y 
   RamSpecs tal como están definidos hoy.
2. packages/database/prisma/schema.prisma — confirmá los modelos, 
   relaciones, uniques e índices reales (no asumas que coincide 
   exactamente con una versión anterior del diseño).
3. packages/api/src/ — confirmá qué existe hoy (probablemente solo 
   scaffold: /health, logger, load-env, sin rutas de negocio).
4. packages/scraper/src/ — revisá cómo quedó implementado el scraping 
   real (qué tienda, qué mecanismo de fetch, cómo se llama el store en 
   la base de datos) para entender qué datos existen realmente en 
   Postgres. Prestá atención a decisiones técnicas que hayan cambiado 
   sobre la marcha durante la implementación (por ejemplo, mecanismo de 
   fetch, tienda piloto usada) — el código real y el PLAN.md actualizado 
   son la fuente de verdad, no supuestos previos.
5. Si existe PLAN.md o PLAN-FASE-0-1.md en la raíz, leelo también como 
   referencia de las decisiones documentadas, pero priorizá siempre lo 
   que el código realmente hace por encima de lo que el plan haya dicho 
   en su momento, en caso de discrepancia.
6. Si es posible, corré una query rápida (o pedime que te confirme) 
   sobre algunos productos reales ya guardados en la base de datos, 
   para basar los ejemplos de respuesta JSON del plan en datos reales 
   en vez de inventados — especialmente para confirmar si el campo 
   brand tiene valores nulos o no en la práctica.

Con ese contexto verificado, generá el plan de Fase 2 sobre la base 
real del proyecto, no sobre una descripción de segunda mano.

## OBJETIVO DE FASE 2

Exponer una API REST con Express que permita:
1. Consultar qué filtros existen para una categoría (leyendo 
   CATEGORY_REGISTRY de shared-types)
2. Buscar/filtrar productos por categoría + combinación de specs, 
   devolviendo el precio más reciente y más bajo disponible por producto
3. Ver el detalle de un producto individual con su historial de precios

Todavía NO incluye: autenticación/JWT funcional, rutas de admin, 
matching entre tiendas (solo hay una tienda por ahora, así que "comparar 
tiendas" no aplica todavía), paginación avanzada tipo cursor (con el 
volumen actual, offset/limit simple alcanza).

## STACK Y CONVENCIONES YA ESTABLECIDAS (respetar, no cambiar)

- TypeScript estricto, sin console.log (usar Winston, ya configurado 
  en packages/api/src/logger.ts)
- Express, paquete @hardware-scrapping/api
- Prisma client importado desde @hardware-scrapping/database 
  (import { prisma } from '@hardware-scrapping/database')
- Tipos compartidos desde @hardware-scrapping/shared-types
- Sin JWT/auth todavía — todos los endpoints de esta fase son públicos
- Precios en la base de datos son enteros en colones costarricenses (CRC), 
  sin decimales (Decimal en Prisma, pero los valores reales no tienen 
  fracción)
- Documenta el codigo (comentar el codigo para mejor entendimiento)

## ENDPOINTS A ESPECIFICAR EN DETALLE

### 1. GET /api/categories

Lista las categorías disponibles con su nombre para mostrar.

Respuesta esperada (ejemplo con datos reales):
```json
{
  "categories": [
    { "slug": "ram", "displayName": "Memoria RAM" }
  ]
}
```
Fuente de datos: iterar CATEGORY_REGISTRY de shared-types, no hardcodear 
en el endpoint.

### 2. GET /api/categories/:slug/filters

Devuelve la definición de filtros disponibles para una categoría, 
pensado para que el frontend (Fase 3) genere checkboxes/dropdowns 
dinámicamente.

Respuesta esperada para /api/categories/ram/filters:
```json
{
  "slug": "ram",
  "displayName": "Memoria RAM",
  "filters": [
    { "key": "capacity_gb", "label": "Capacidad", "type": "enum", "options": ["8","16","32","64"] },
    { "key": "ram_type", "label": "Tipo", "type": "enum", "options": ["DDR4","DDR5"] },
    { "key": "speed_mhz", "label": "Velocidad (MHz)", "type": "range" },
    { "key": "is_kit", "label": "Kit (2x)", "type": "enum", "options": ["true","false"] }
  ]
}
```
Si el slug no existe en CATEGORY_REGISTRY: 404 con mensaje claro.

### 3. GET /api/products

El endpoint principal de búsqueda/filtrado. Especificar en detalle:

Query params esperados:
- `category` (string, obligatorio) — ej. "ram". Si falta o no existe 
  en CATEGORY_REGISTRY → 400.
- Filtros dinámicos según la categoría, como query params sueltos, ej: 
  `?category=ram&capacity_gb=16&ram_type=DDR4`
  Para type 'range' (ej. speed_mhz): aceptar `speed_mhz_min` y/o 
  `speed_mhz_max` como params separados.
  Para type 'enum': aceptar un solo valor o múltiples separados por 
  coma (ej. `ram_type=DDR4,DDR5` = cualquiera de los dos).
- `sort` (opcional): valores permitidos `price_asc` (default), 
  `price_desc`, `newest`. Documentar cómo se traduce cada uno a un 
  order by real considerando que el precio vive en PriceHistory, no 
  directamente en Product.
- `page` (opcional, default 1) y `pageSize` (opcional, default 20, 
  máximo 100) para paginación simple offset/limit.

Especificar el algoritmo para responder esta pregunta clave: como el 
precio vive en PriceHistory (histórico, múltiples filas por producto) 
y no en Product, ¿cómo se obtiene "el precio actual" de cada producto 
para poder filtrar/ordenar por precio? Detallar la query Prisma o SQL 
crudo necesario para traer, por cada Product+StoreListing, solo la fila 
de PriceHistory más reciente (MAX(scrapedAt) por listingId). Si Prisma 
no resuelve esto limpiamente con su query builder estándar, especificar 
si hace falta $queryRaw y dar el SQL exacto, comentando cada parte para 
alguien que no domina SQL avanzado.

Estructura de validación de query params dinámicos: como los filtros 
vienen de CATEGORY_REGISTRY (que es data, no código fijo), especificar 
cómo el endpoint valida que un query param recibido (ej. capacity_gb) 
efectivamente corresponda a un filtro definido para esa categoría antes 
de usarlo en la query — para evitar que alguien mande un query param 
arbitrario que rompa algo o intente inyectar algo raro en el JSON path 
de Postgres.

Respuesta esperada (ejemplo):
```json
{
  "category": "ram",
  "page": 1,
  "pageSize": 20,
  "totalCount": 4,
  "products": [
    {
      "id": 12,
      "canonicalName": "MEMORIA RAM PC 16GB HIKSEMI HSC416U32E2 DDR4 3200MHZ CL22 UDIMM BLANCO",
      "brand": null,
      "specs": { "capacity_gb": 16, "ram_type": "DDR4", "speed_mhz": 3200, "is_kit": false },
      "lowestPrice": {
        "price": 71100,
        "storeName": "Faith Technology",
        "scrapedAt": "2026-08-10T02:15:00.000Z",
        "url": "https://faithtechnologycr.com/producto/..."
      }
    }
  ]
}
```
Nota: con una sola tienda, "lowestPrice" es simplemente el precio más 
reciente de esa tienda. Diseñar la query de forma que ya esté preparada 
conceptualmente para cuando haya más de una tienda por producto (Fase 
7), pero sin sobre-ingenierizar Fase 2 — dejar un comentario en el 
código señalando ese punto de extensión futuro.

### 4. GET /api/products/:id

Detalle de un producto individual, incluyendo su historial completo de 
precios (para que el frontend en Fase 6 pueda graficarlo).

Respuesta esperada:
```json
{
  "id": 12,
  "canonicalName": "...",
  "category": "ram",
  "brand": null,
  "specs": { ... },
  "listings": [
    {
      "storeId": 1,
      "storeName": "Faith Technology",
      "url": "https://...",
      "priceHistory": [
        { "price": 71100, "inStock": true, "scrapedAt": "2026-08-10T02:15:00.000Z" }
      ]
    }
  ]
}
```
Si el id no existe: 404 con mensaje claro.
Ordenar priceHistory por scrapedAt descendente (más reciente primero).

## MANEJO DE ERRORES (especificar matriz completa)

Para cada endpoint, especificar códigos HTTP y forma del body de error 
para: parámetros faltantes/inválidos, categoría inexistente, producto 
inexistente, error inesperado de base de datos. Formato de error 
consistente en todos los endpoints, ej:
```json
{ "error": { "message": "...", "code": "CATEGORY_NOT_FOUND" } }
```
Especificar códigos de error como constantes (no strings mágicos 
repetidos en cada handler).

Todo error de servidor (5xx) debe loguearse con Winston nivel 'error' 
incluyendo el stack trace; errores de cliente (4xx) pueden loguearse 
en nivel 'warn' o no loguearse, a criterio, pero documentarlo 
explícitamente en el plan.

## ESTRUCTURA DE CARPETAS ESPERADA EN packages/api/src

Especificar una estructura ordenada, por ejemplo (ajustar si tiene 
sentido algo distinto, pero debe quedar explícito en el plan):
src/
├── index.ts
├── app.ts
├── logger.ts
├── load-env.ts
├── routes/
│ ├── categories.routes.ts
│ └── products.routes.ts
├── services/
│ ├── category.service.ts
│ └── product.service.ts ← acá vive la lógica de query compleja
├── validators/
│ └── product-query.validator.ts ← validación de filtros dinámicos
└── errors/
└── api-error.ts

Especificar responsabilidad de cada capa: routes solo mapean HTTP a 
llamadas de servicio, services contienen la lógica de negocio/Prisma, 
validators validan y normalizan query params antes de llegar al 
service. No mezclar lógica de Prisma directamente en los route handlers.

## TESTING MANUAL (no es necesario un framework de test todavía)

Especificar una tabla de comandos curl (o equivalente) para probar 
manualmente cada endpoint con casos reales basados en los datos que ya 
existen en la base de datos (ej. probar con capacity_gb=16, con 
ram_type=DDR4, con un id de producto real, con un id inexistente para 
confirmar el 404, con una categoría inexistente para confirmar el 404 
de filtros).

## CRITERIO DE ACEPTACIÓN

Definir la secuencia de comandos verificables (levantar la API con 
pnpm --filter @hardware-scrapping/api dev, y una serie de curls) que 
confirmen que los 4 endpoints funcionan contra los datos reales ya 
scrapeados, incluyendo al menos un caso de filtro combinado 
(category=ram&capacity_gb=16&ram_type=DDR4) que devuelva resultados 
coherentes con lo que hay en la base de datos.

## FORMATO DE SALIDA

Mismo nivel de detalle exigido en el plan de Fase 0/1: sin resúmenes, 
sin "...", contenido completo de código cuando aplique, checkboxes por 
tarea, criterio de aceptación verificable al final. Asumí que quien 
ejecuta esto ya completó Fase 0/1 con éxito pero es el mismo perfil: 
experiencia en C#/.NET, nuevo en el ecosistema Node/TypeScript/Prisma — 
en particular, no asumas que domina query raw de Prisma o SQL avanzado 
de window functions sin explicarlo paso a paso si hace falta usarlo 
para el problema del "precio más reciente por producto".

Generá el PLAN-FASE-2.md completo ahora. Si antes de generar identificás 
algo del diseño que valga la pena ajustar o simplificar, decímelo primero 
y esperá mi confirmación, igual que hicimos en la revisión de Fase 0/1.

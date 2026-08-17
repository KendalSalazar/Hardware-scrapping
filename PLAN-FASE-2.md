# PLAN-FASE-2.md — API REST con filtros dinámicos

Especificación técnica ejecutable para **Fase 2** del monorepo **hardware-scrapping**.
Cubre **únicamente** la API Express con filtros dinámicos sobre datos ya scrapeados.
No incluye frontend Next.js (Fase 3), auth/JWT funcional (Fase 4), matching multi-tienda (Fase 7), ni cron.

**Audiencia:** quien ejecuta este plan completó Fase 0 y Fase 1 con éxito. Tiene experiencia en C#/.NET y es nuevo en Node/TypeScript/Prisma. Cada archivo se describe completo; no hay `...` ni resúmenes ambiguos. Cuando haga falta SQL o JSON path de Postgres, se explica paso a paso.

**Fuente de verdad:** el código real del monorepo y los datos en Postgres prevalecen sobre cualquier supuesto del prompt original.

---

## Contexto verificado (estado real al escribir este plan)

| Item | Valor real |
|------|------------|
| Productos en DB | 65 (`category = 'ram'`) |
| Listings | 65 (1:1 con productos hoy) |
| Tienda con datos útiles | `Faith Technology` (`https://faithtechnologycr.com`) |
| `Product.brand` | **siempre `null`** en los 65 productos (Faith Technology no expone marca) |
| Capacidades presentes | `8`, `16`, `32`, `48` GB |
| Tipos presentes | `DDR4` (36), `DDR5` (29) |
| Precios | `Decimal(12,2)` en Prisma; valores reales enteros en CRC (ej. `67200.00`) |
| API hoy | solo scaffold: `GET /health`, logger Winston, `load-env` |
| Shared types | `CategorySlug = 'ram'`, `RAM_SCHEMA`, `CATEGORY_REGISTRY`, `RamSpecs`, `FilterDefinition` |
| Prisma client | `import { prisma } from '@hardware-scrapping/database'` |

**Ejemplos reales de productos (para curls y respuestas de ejemplo):**

| id | canonicalName (recortado) | specs | latest price (CRC) |
|----|---------------------------|-------|--------------------|
| 13 | MEMORIA RAM PC 16GB HIKSEMI HSC416U32Z1 DDR4 3200MHZ... | capacity 16, DDR4, 3200, kit false | 67200 |
| 14 | MEMORIA RAM PC 16GB PATRIOT PVS416G320C6... DDR4 3200... | capacity 16, DDR4, 3200, kit false | 69800 |
| 15 | MEMORIA RAM PC 16GB PATRIOT PSP416G320081H1... DDR4 3200... | capacity 16, DDR4, 3200, kit false | 69800 |

ID alto existente para pruebas de 404: usar un id que no exista, p. ej. `999999`.

---

## Ajustes de diseño respecto al prompt original (ya incorporados)

| # | Ajuste | Decisión | Por qué |
|---|--------|----------|---------|
| 1 | Query de precio actual | **Prisma + agregación en TypeScript** como camino principal; SQL raw solo como nota futura | Con ~65 productos es claro para el perfil C#/.NET y evita window functions |
| 2 | Significado de `lowestPrice` | Por listing: precio **más reciente**; entre listings: el **más bajo** de esos recientes | No es el mínimo histórico de todos los tiempos |
| 3 | Options de filtros enum | Unión de `options` del schema + valores distintos reales en `Product.specs` | `RAM_SCHEMA` no tenía `48`, pero la DB sí |
| 4 | Productos sin precio | **Excluir** de `GET /api/products` si no tienen ningún `PriceHistory` | Evita `lowestPrice: null` en el listado del comparador |
| 5 | Serialización Decimal | Convertir siempre a `number` entero en la respuesta JSON | Prisma `Decimal` no se serializa limpio solo |
| 6 | `sort=newest` | `Product.createdAt DESC` | No confundir con fecha del último scrape |
| 7 | Params desconocidos | **400** si el query param no está en la whitelist del schema | Evita inyección / ruido en JSON path |
| 8 | Estructura | routes / services / validators / errors + middleware de error | Routes delgadas; sin Prisma en handlers |
| 9 | CORS | Habilitado en dev (`origin: true`) | Prepara Fase 3 sin bloquear el browser |
| 10 | `RAM_SCHEMA` | Sumar `'48'` a options de `capacity_gb` | El catálogo base no debe quedar desactualizado |

---

## Objetivo de Fase 2

Exponer una API REST pública (sin auth) que permita:

1. Listar categorías disponibles (`CATEGORY_REGISTRY`).
2. Obtener la definición de filtros de una categoría (para que el frontend genere UI dinámica).
3. Buscar/filtrar productos por categoría + specs, con precio actual más bajo y paginación simple.
4. Ver detalle de un producto con historial completo de precios por listing/tienda.

**Fuera de alcance:** JWT, rutas admin, matching entre tiendas, cursor pagination, frontend, cron.

---

## Stack y convenciones (no cambiar)

- TypeScript estricto (`tsconfig.base.json` ya existente).
- Sin `console.log` → solo Winston (`packages/api/src/logger.ts`).
- Express en `@hardware-scrapping/api`.
- Prisma: `import { prisma } from '@hardware-scrapping/database'`.
- Tipos/constantes: `@hardware-scrapping/shared-types`.
- Precios en respuesta JSON: **números enteros** en colones (CRC), sin decimales visibles.
- Comentar el código en puntos no triviales (query de precio, validator dinámico, serialización Decimal). No comentar línea por línea obvia.
- ESM: imports con extensión `.js` en rutas relativas (igual que el resto del monorepo).

---

## Estructura de carpetas objetivo en `packages/api/src`

```
packages/api/src/
├── index.ts                          ← ya existe; arranca el server
├── app.ts                            ← ya existe; se extiende (middleware + routes + error handler)
├── logger.ts                         ← ya existe; no tocar salvo necesidad
├── load-env.ts                       ← ya existe; no tocar
├── routes/
│   ├── categories.routes.ts          ← GET /api/categories, GET /api/categories/:slug/filters
│   └── products.routes.ts            ← GET /api/products, GET /api/products/:id
├── services/
│   ├── category.service.ts           ← lee CATEGORY_REGISTRY + enriquece options desde DB
│   └── product.service.ts            ← queries Prisma + cálculo lowestPrice + detalle
├── validators/
│   └── product-query.validator.ts    ← valida/normaliza query params dinámicos
├── errors/
│   ├── api-error.ts                  ← clase ApiError + códigos constantes
│   └── error-handler.ts              ← middleware Express de errores
└── utils/
    └── money.ts                      ← Decimal/unknown → number entero CRC
```

**Responsabilidades por capa:**

| Capa | Hace | No hace |
|------|------|---------|
| `routes/*` | Parsear `req`, llamar service, `res.json` / `next(err)` | Prisma, reglas de negocio |
| `services/*` | Lógica de negocio + Prisma | Escribir `res.status` |
| `validators/*` | Validar y normalizar input → objeto tipado o throw `ApiError` | Acceder a DB (salvo que se decida lo contrario; en este plan el validator **no** toca DB) |
| `errors/*` | Forma uniforme de error HTTP | Lógica de filtros |
| `utils/money.ts` | Conversión segura de precio | Queries |

---

# Tareas de implementación

---

### Tarea 2.0 — Actualizar `RAM_SCHEMA` con capacidad 48

**Archivo:** `packages/shared-types/src/category.ts`

En el filtro `capacity_gb`, cambiar:

```typescript
options: ['8', '16', '32', '64'],
```

por:

```typescript
options: ['8', '16', '32', '48', '64'],
```

Recompilar shared-types:

```bash
pnpm --filter @hardware-scrapping/shared-types build
```

- [ ] `'48'` agregado a options de `capacity_gb`
- [ ] Build de shared-types OK

---

### Tarea 2.1 — Dependencia CORS

En `packages/api`:

```bash
pnpm --filter @hardware-scrapping/api add cors
pnpm --filter @hardware-scrapping/api add -D @types/cors
```

- [ ] `cors` y `@types/cors` instalados en el package api

---

### Tarea 2.2 — Utilidad de dinero (`utils/money.ts`)

**Archivo nuevo:** `packages/api/src/utils/money.ts`

Contenido completo:

```typescript
import { Prisma } from '@hardware-scrapping/database';

/**
 * Convierte un precio de Prisma (Decimal | number | string) a entero CRC.
 * Los valores reales no tienen fracción; se redondea al entero más cercano
 * por seguridad si algún día aparece un decimal.
 */
export function toCrcNumber(value: Prisma.Decimal | number | string): number {
  if (value instanceof Prisma.Decimal) {
    return Math.round(value.toNumber());
  }
  if (typeof value === 'number') {
    return Math.round(value);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Precio no numérico: ${String(value)}`);
  }
  return Math.round(parsed);
}
```

> Nota: si `Prisma` no re-exporta `Decimal` desde `@hardware-scrapping/database`, importar así:
> `import { Prisma } from '@prisma/client';`
> o usar `import { Decimal } from '@prisma/client/runtime/library'` según lo que exponga la versión instalada de Prisma 6.
> Verificar en build. Alternativa sin depender del tipo Decimal:

```typescript
/** Acepta Decimal-like (tiene toNumber), number o string. */
export function toCrcNumber(value: { toNumber: () => number } | number | string): number {
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return Math.round(value.toNumber());
  }
  if (typeof value === 'number') {
    return Math.round(value);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Precio no numérico: ${String(value)}`);
  }
  return Math.round(parsed);
}
```

Preferir la variante Decimal-like si el import de `Prisma.Decimal` complica el build.

- [ ] `toCrcNumber` implementado y usable desde services

---

### Tarea 2.3 — Errores de API

#### 2.3.1 — `packages/api/src/errors/api-error.ts`

Contenido completo:

```typescript
/**
 * Códigos de error estables para el cliente.
 * No usar strings mágicos sueltos en los handlers.
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
```

#### 2.3.2 — `packages/api/src/errors/error-handler.ts`

Contenido completo:

```typescript
import type { ErrorRequestHandler } from 'express';
import { logger } from '../logger.js';
import { ApiError, ErrorCodes, isApiError } from './api-error.js';

/**
 * Middleware de error de Express (firma de 4 argumentos obligatoria).
 *
 * Política de logging:
 * - 4xx (errores de cliente): nivel warn, sin stack
 * - 5xx (errores de servidor): nivel error, con stack
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isApiError(err)) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, stack: err.stack });
    } else {
      logger.warn(err.message, { code: err.code, statusCode: err.statusCode });
    }

    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected server error';
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(message, { code: ErrorCodes.INTERNAL_ERROR, stack, err });

  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: ErrorCodes.INTERNAL_ERROR,
    },
  });
};
```

**Formato de error uniforme (todos los endpoints):**

```json
{
  "error": {
    "message": "Category 'gpu' not found",
    "code": "CATEGORY_NOT_FOUND"
  }
}
```

- [ ] `ApiError` + `ErrorCodes` creados
- [ ] `errorHandler` creado con política 4xx=warn / 5xx=error

---

### Tarea 2.4 — Validator de query de productos

**Archivo nuevo:** `packages/api/src/validators/product-query.validator.ts`

#### 2.4.1 — Tipos de salida del validator

```typescript
import type { CategorySlug, FilterDefinition } from '@hardware-scrapping/shared-types';

export type ProductSort = 'price_asc' | 'price_desc' | 'newest';

/** Un filtro enum ya normalizado (valores tipados según la key). */
export interface NormalizedEnumFilter {
  kind: 'enum';
  key: string;
  /** Valores permitidos ya casteados (number | boolean | string). */
  values: Array<string | number | boolean>;
}

/** Un filtro range ya normalizado. */
export interface NormalizedRangeFilter {
  kind: 'range';
  key: string;
  min?: number;
  max?: number;
}

export type NormalizedSpecFilter = NormalizedEnumFilter | NormalizedRangeFilter;

export interface ValidatedProductQuery {
  category: CategorySlug;
  filters: NormalizedSpecFilter[];
  sort: ProductSort;
  page: number;
  pageSize: number;
}
```

#### 2.4.2 — Algoritmo de validación (paso a paso)

Función exportada:

```typescript
export function validateProductQuery(
  query: Record<string, unknown>,
): ValidatedProductQuery;
```

Pasos:

1. **Leer `category`**
   - Debe ser string no vacío.
   - Debe existir como key en `CATEGORY_REGISTRY`.
   - Si falta o no existe → `throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, '...')`.
   - Tipar el resultado como `CategorySlug`.

2. **Obtener schema**
   - `const schema = CATEGORY_REGISTRY[category]`.
   - Construir un `Map<string, FilterDefinition>` por `filter.key`.

3. **Whitelist de query params permitidos**
   - Siempre permitidos: `category`, `sort`, `page`, `pageSize`.
   - Por cada filtro del schema:
     - si `type === 'enum'` o `type === 'number'`: permitir el param con nombre exacto `filter.key`.
     - si `type === 'range'`: permitir `filter.key + '_min'` y `filter.key + '_max'`.
   - Cualquier otra key presente en `query` → `400 VALIDATION_ERROR` con mensaje que liste el param desconocido.
   - Nota: Express puede traer valores `string | string[]`. Normalizar arrays tomando el primer elemento o uniéndolos; documentar: si llega repetido `?ram_type=DDR4&ram_type=DDR5`, tratarlo como lista (ver paso 5).

4. **Paginación**
   - `page`: default `1`. Entero ≥ 1. Si no es entero válido → 400.
   - `pageSize`: default `20`. Entero entre 1 y 100 inclusive. Si > 100 → 400 (no silenciar recortando sin avisar; fallar claro).

5. **Sort**
   - Default: `price_asc`.
   - Permitidos: `price_asc` | `price_desc` | `newest`.
   - Otro valor → 400.

6. **Filtros enum / number**
   - Si el param está ausente → no agregar filtro.
   - Si está presente: parsear string.
     - Soportar **múltiples valores separados por coma**: `ram_type=DDR4,DDR5`.
     - También soportar array si Express entregó `string[]`.
   - Por cada valor:
     - trim.
     - Casteo según la key conocida de RAM (y genérico para futuras categorías):
       - Si la key termina en patrones numéricos obvios del schema actual (`capacity_gb`, o el filter type del schema fuera `number`): parsear como number con `Number(v)`; debe ser finito.
       - Si la key es `is_kit` o los options son solo `'true'|'false'`: castear a boolean (`'true'` → true, `'false'` → false; otro → 400).
       - Si no: dejar como string.
     - Si el schema define `options` y el valor casteado (como string comparable) **no** está en options:
       - **Decisión Fase 2:** aceptar igual el valor si es casteable (porque el enrichment de filters puede mostrar valores DB fuera del schema estático, y el usuario puede filtrar por ellos). No rechazar solo por no estar en `options` del schema estático.
       - Sí rechazar si el casteo falla (NaN, boolean inválido, string vacío).

7. **Filtros range**
   - Leer `key_min` y/o `key_max` (ej. `speed_mhz_min`, `speed_mhz_max`).
   - Cada uno, si presente, debe ser number finito.
   - Si ambos presentes y `min > max` → 400.
   - Agregar un solo `NormalizedRangeFilter` con los bounds definidos.

8. **type `number` del schema** (si aparece en el futuro)
   - Tratarlo como enum de un solo valor numérico o como igualdad exacta: un valor number. En RAM hoy no hay filters `type: 'number'`; el código debe manejar el case sin romper (igualdad exacta en JSON path).

9. Retornar `ValidatedProductQuery`.

#### 2.4.3 — Helper para leer query string de Express

```typescript
function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function asStringList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => asStringList(item));
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
  return [];
}
```

- [ ] Validator implementado con whitelist estricta
- [ ] Params desconocidos → 400
- [ ] Defaults: sort=price_asc, page=1, pageSize=20
- [ ] pageSize máximo 100

---

### Tarea 2.5 — Service de categorías

**Archivo nuevo:** `packages/api/src/services/category.service.ts`

#### 2.5.1 — Listar categorías

```typescript
import { CATEGORY_REGISTRY } from '@hardware-scrapping/shared-types';

export function listCategories() {
  return {
    categories: Object.values(CATEGORY_REGISTRY).map((schema) => ({
      slug: schema.slug,
      displayName: schema.displayName,
    })),
  };
}
```

No hardcodear slugs en el route.

#### 2.5.2 — Filtros de una categoría (con enrichment)

```typescript
import { CATEGORY_REGISTRY, type CategorySlug, type FilterDefinition } from '@hardware-scrapping/shared-types';
import { prisma } from '@hardware-scrapping/database';
import { ApiError, ErrorCodes } from '../errors/api-error.js';

function isCategorySlug(value: string): value is CategorySlug {
  return Object.prototype.hasOwnProperty.call(CATEGORY_REGISTRY, value);
}

export async function getCategoryFilters(slug: string) {
  if (!isCategorySlug(slug)) {
    throw new ApiError(
      404,
      ErrorCodes.CATEGORY_NOT_FOUND,
      `Category '${slug}' not found`,
    );
  }

  const schema = CATEGORY_REGISTRY[slug];

  // Enrichment: para cada filtro enum, unir options del schema con valores
  // distintos realmente presentes en Product.specs de esa categoría.
  const filters: FilterDefinition[] = await Promise.all(
    schema.filters.map(async (filter) => {
      if (filter.type !== 'enum') {
        return { ...filter };
      }

      const distinct = await loadDistinctSpecValues(schema.slug, filter.key);
      const merged = mergeOptions(filter.options ?? [], distinct, filter.key);

      return {
        ...filter,
        options: merged,
      };
    }),
  );

  return {
    slug: schema.slug,
    displayName: schema.displayName,
    filters,
  };
}
```

#### 2.5.3 — Distinct de specs (Prisma + JSON)

Implementar `loadDistinctSpecValues(category, key)`:

**Opción A (preferida, simple, suficiente para el volumen actual):**

1. `prisma.product.findMany({ where: { category }, select: { specs: true } })`
2. En JS, recorrer cada `specs` (cast a `Record<string, unknown>`), leer `specs[key]`.
3. Si el valor es `null` o `undefined`, ignorar.
4. Convertir a string de option:
   - boolean → `'true'` / `'false'`
   - number → `String(number)` (sin decimales innecesarios)
   - string → tal cual
5. Devolver array único ordenado de forma estable:
   - numéricos (si todos parsean como number): orden numérico asc
   - si no: orden lexicográfico

**Opción B (SQL, opcional, no obligatoria en Fase 2):**

```sql
SELECT DISTINCT specs->>'capacity_gb' AS value
FROM "Product"
WHERE category = $1
  AND specs ? 'capacity_gb'
  AND specs->>'capacity_gb' IS NOT NULL
ORDER BY value;
```

No hace falta Opción B si A es clara y pasa el criterio de aceptación.

#### 2.5.4 — mergeOptions

```typescript
function mergeOptions(
  schemaOptions: string[],
  dbValues: string[],
  key: string,
): string[] {
  const set = new Set<string>([...schemaOptions, ...dbValues]);
  const all = [...set];

  // Orden: si parecen números (capacity_gb, etc.), orden numérico.
  const allNumeric = all.every((v) => v !== '' && Number.isFinite(Number(v)));
  if (allNumeric) {
    return all.sort((a, b) => Number(a) - Number(b));
  }

  // Boolean-like
  if (all.every((v) => v === 'true' || v === 'false')) {
    return ['true', 'false'].filter((v) => set.has(v));
  }

  return all.sort((a, b) => a.localeCompare(b));
}
```

**Resultado esperado para RAM hoy:** `capacity_gb` options incluyen al menos `8,16,32,48` (y `64` del schema aunque no haya productos).

- [ ] `listCategories` desde registry
- [ ] `getCategoryFilters` con 404 si slug inválido
- [ ] Enrichment de options enum desde DB

---

### Tarea 2.6 — Service de productos (núcleo)

**Archivo nuevo:** `packages/api/src/services/product.service.ts`

Este es el archivo más importante de Fase 2.

#### 2.6.1 — Tipos de respuesta

```typescript
export interface LowestPriceDto {
  price: number;
  storeName: string;
  scrapedAt: string; // ISO-8601
  url: string;
}

export interface ProductListItemDto {
  id: number;
  canonicalName: string;
  brand: string | null;
  specs: Record<string, unknown>;
  lowestPrice: LowestPriceDto;
}

export interface ProductListResponseDto {
  category: string;
  page: number;
  pageSize: number;
  totalCount: number;
  products: ProductListItemDto[];
}

export interface PriceHistoryPointDto {
  price: number;
  inStock: boolean;
  scrapedAt: string;
}

export interface ProductListingDto {
  storeId: number;
  storeName: string;
  url: string;
  priceHistory: PriceHistoryPointDto[];
}

export interface ProductDetailDto {
  id: number;
  canonicalName: string;
  category: string;
  brand: string | null;
  specs: Record<string, unknown>;
  listings: ProductListingDto[];
}
```

#### 2.6.2 — Algoritmo de `lowestPrice` (definir con precisión)

Para un producto con N listings (N tiendas):

```
para cada listing L del producto:
  tomar la fila de PriceHistory de L con scrapedAt máximo
  (si empate de timestamp, desempate por id DESC)
  eso es "precio actual de la tienda L"

si el producto no tiene ningún precio actual → no entra al listado

lowestPrice = el precio actual de tienda con price mínimo
  (si empate de price, cualquiera estable: p.ej. menor storeName o menor listingId)
```

Con **una sola tienda** (estado actual), `lowestPrice` = precio más reciente de esa tienda.

**Punto de extensión futuro (comentar en el código):**

```typescript
// FASE 7: cuando exista matching multi-tienda, este mismo cálculo
// ya compara N precios "actuales" (uno por listing) y elige el mínimo.
// No hace falta cambiar el contrato del DTO lowestPrice.
```

#### 2.6.3 — Camino principal: Prisma + JS (obligatorio en Fase 2)

**No usar window functions ni `$queryRaw` como implementación principal.**

Pasos de `listProducts(validated: ValidatedProductQuery)`:

1. **Construir `where` de Product**
   - Siempre: `category: validated.category`
   - Por cada filtro normalizado, agregar condición sobre `specs` usando el filtro JSON de Prisma:

   **Enum (uno o varios valores) — OR de igualdades:**

   Prisma soporta path en JSON. Ejemplo para `capacity_gb IN (16, 32)`:

   ```typescript
   {
     OR: [
       { specs: { path: ['capacity_gb'], equals: 16 } },
       { specs: { path: ['capacity_gb'], equals: 32 } },
     ],
   }
   ```

   Para un solo valor, se puede usar directamente sin OR:

   ```typescript
   { specs: { path: ['capacity_gb'], equals: 16 } }
   ```

   Para strings (`ram_type`):

   ```typescript
   { specs: { path: ['ram_type'], equals: 'DDR4' } }
   ```

   Para boolean (`is_kit`):

   ```typescript
   { specs: { path: ['is_kit'], equals: true } }
   ```

   **Range (`speed_mhz_min` / `speed_mhz_max`):**

   Prisma JSON filters tienen `gte` / `lte` en versiones recientes sobre path. Verificar contra Prisma 6:

   ```typescript
   // Si funciona en la versión instalada:
   { specs: { path: ['speed_mhz'], gte: 3200 } }
   { specs: { path: ['speed_mhz'], lte: 6000 } }
   ```

   **Si `gte`/`lte` sobre JSON path no está disponible o falla en runtime**, plan B aceptable:
   - Filtrar en SQL con `$queryRaw` solo el range, **o**
   - Traer candidatos con el resto de filtros y filtrar range en memoria sobre `specs.speed_mhz`.
   - Documentar en un comentario cuál se usó.
   - Preferir probar primero el filter Prisma; si el build/types no lo exponen, usar filtrado en memoria **después** de cargar productos de la categoría (aceptable con 65 filas; con miles habría que pasar a SQL).

   Combinar todos los filtros con `AND`.

2. **Cargar productos candidatos con listings y precio más reciente**

   ```typescript
   const products = await prisma.product.findMany({
     where: productWhere,
     include: {
       listings: {
         include: {
           store: true,
           priceHistory: {
             orderBy: [{ scrapedAt: 'desc' }, { id: 'desc' }],
             take: 1,
           },
         },
       },
     },
   });
   ```

   Explicación para quien viene de EF Core:
   - `include.listings` = join a `StoreListing`
   - `include.store` = join a `Store` (nombre de tienda)
   - `priceHistory: { orderBy scrapedAt desc, take: 1 }` = “dame solo la fila de precio más nueva de ese listing”, equivalente conceptual a un `OUTER APPLY (SELECT TOP 1 ... ORDER BY scrapedAt DESC)` en SQL Server.

3. **Mapear a DTO con lowestPrice; descartar sin precio**

   ```typescript
   const items: ProductListItemDto[] = [];

   for (const product of products) {
     const currentPrices: LowestPriceDto[] = [];

     for (const listing of product.listings) {
       const latest = listing.priceHistory[0];
       if (!latest) continue;

       currentPrices.push({
         price: toCrcNumber(latest.price),
         storeName: listing.store.name,
         scrapedAt: latest.scrapedAt.toISOString(),
         url: listing.url,
       });
     }

     if (currentPrices.length === 0) {
       // Producto sin ningún PriceHistory → fuera del listado del comparador
       continue;
     }

     // Mínimo entre precios actuales de cada tienda
     currentPrices.sort((a, b) => a.price - b.price);
     const lowest = currentPrices[0]!;

     items.push({
       id: product.id,
       canonicalName: product.canonicalName,
       brand: product.brand,
       specs: product.specs as Record<string, unknown>,
       lowestPrice: lowest,
     });
   }
   ```

4. **Ordenar en memoria según `validated.sort`**

   | sort | Criterio |
   |------|----------|
   | `price_asc` (default) | `lowestPrice.price ASC`, empate por `id ASC` |
   | `price_desc` | `lowestPrice.price DESC`, empate por `id ASC` |
   | `newest` | necesita `createdAt` del product → incluirlo en el select/map interno; orden `createdAt DESC`, empate `id DESC` |

   Para `newest`, el `findMany` debe seleccionar/incluir `createdAt` aunque no se exponga en el DTO de listado (o sí exponerlo; **decisión Fase 2: no exponerlo en listado**, solo usarlo para sort). Guardar `createdAt` en una estructura interna temporal antes del map final, o mapear a un tipo interno ampliado y strip al final.

5. **Paginación en memoria**

   ```typescript
   const totalCount = items.length;
   const start = (validated.page - 1) * validated.pageSize;
   const pageItems = items.slice(start, start + validated.pageSize);
   ```

   Si `page` está más allá del final → `products: []` con `totalCount` real (no 404).

6. **Retornar** `ProductListResponseDto`.

**Límite de escala (comentar en código):**

```typescript
// Nota de escala: con el volumen actual (~decenas/cientos de productos)
// ordenar y paginar en memoria es correcto y legible.
// Si el catálogo crece a decenas de miles, mover lowestPrice + sort + page a SQL
// (ver Apéndice SQL futuro).
```

#### 2.6.4 — Apéndice SQL futuro (NO implementar en Fase 2, solo documentar)

Cuando haga falta, un approach Postgres idiomático es `DISTINCT ON`:

```sql
-- Precio más reciente por listing
SELECT DISTINCT ON (ph."listingId")
  ph."listingId",
  ph.price,
  ph."scrapedAt",
  ph."inStock"
FROM "PriceHistory" ph
ORDER BY ph."listingId", ph."scrapedAt" DESC, ph.id DESC;
```

Luego join a `StoreListing` + `Product` + `Store`, agregar por `productId` con `MIN(price)`, filtrar JSON con `specs->>'ram_type' = 'DDR4'`, etc. **No implementar esto ahora.**

#### 2.6.5 — Detalle de producto `getProductById(id: number)`

```typescript
export async function getProductById(id: number): Promise<ProductDetailDto> {
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid product id');
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      listings: {
        include: {
          store: true,
          priceHistory: {
            orderBy: [{ scrapedAt: 'desc' }, { id: 'desc' }],
            // historial completo: sin take
          },
        },
      },
    },
  });

  if (!product) {
    throw new ApiError(
      404,
      ErrorCodes.PRODUCT_NOT_FOUND,
      `Product with id ${id} not found`,
    );
  }

  return {
    id: product.id,
    canonicalName: product.canonicalName,
    category: product.category,
    brand: product.brand,
    specs: product.specs as Record<string, unknown>,
    listings: product.listings.map((listing) => ({
      storeId: listing.storeId,
      storeName: listing.store.name,
      url: listing.url,
      priceHistory: listing.priceHistory.map((ph) => ({
        price: toCrcNumber(ph.price),
        inStock: ph.inStock,
        scrapedAt: ph.scrapedAt.toISOString(),
      })),
    })),
  };
}
```

- Historial ordenado **más reciente primero** (`scrapedAt DESC`).
- Precios como number entero.
- Si el producto existe pero no tiene listings, devolver `listings: []` (no 404).

- [ ] `listProducts` con filtros dinámicos + lowestPrice + sort + page
- [ ] Productos sin PriceHistory excluidos del listado
- [ ] `getProductById` con historial completo
- [ ] Comentario de extensión multi-tienda (Fase 7)
- [ ] Comentario de escala / SQL futuro

---

### Tarea 2.7 — Routes

#### 2.7.1 — `packages/api/src/routes/categories.routes.ts`

```typescript
import { Router } from 'express';
import { getCategoryFilters, listCategories } from '../services/category.service.js';

export const categoriesRouter = Router();

// GET /api/categories
categoriesRouter.get('/', (_req, res, next) => {
  try {
    res.status(200).json(listCategories());
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:slug/filters
categoriesRouter.get('/:slug/filters', async (req, res, next) => {
  try {
    const slug = String(req.params.slug);
    const result = await getCategoryFilters(slug);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
```

#### 2.7.2 — `packages/api/src/routes/products.routes.ts`

```typescript
import { Router } from 'express';
import { getProductById, listProducts } from '../services/product.service.js';
import { validateProductQuery } from '../validators/product-query.validator.js';

export const productsRouter = Router();

// GET /api/products
productsRouter.get('/', async (req, res, next) => {
  try {
    // req.query es ParsedQs; normalizar a Record<string, unknown>
    const validated = validateProductQuery(req.query as Record<string, unknown>);
    const result = await listProducts(validated);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
productsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await getProductById(id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
```

**Nota de orden de montaje:** montar routers bajo `/api/categories` y `/api/products`. No poner un `GET /:id` genérico que capture otras rutas.

- [ ] Routes creadas, delgadas, con `next(err)`

---

### Tarea 2.8 — Integrar en `app.ts`

Reemplazar/extender `packages/api/src/app.ts` para que quede conceptualmente así:

```typescript
import express, { type Application } from 'express';
import cors from 'cors';
import { prisma } from '@hardware-scrapping/database';
import { logger } from './logger.js';
import { categoriesRouter } from './routes/categories.routes.js';
import { productsRouter } from './routes/products.routes.js';
import { errorHandler } from './errors/error-handler.js';

export function createApp(): Application {
  const app = express();

  // CORS permisivo en desarrollo para preparar el frontend (Fase 3).
  // origin: true refleja el Origin de la request.
  app.use(
    cors({
      origin: true,
    }),
  );

  app.use(express.json());

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ok', db: 'up' });
    } catch (err) {
      logger.error('Health check DB failed', { err });
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  app.use('/api/categories', categoriesRouter);
  app.use('/api/products', productsRouter);

  // 404 para rutas no definidas bajo la API (opcional pero recomendado)
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: {
        message: 'API route not found',
        code: 'VALIDATION_ERROR',
      },
    });
  });

  // Debe ir al final
  app.use(errorHandler);

  return app;
}
```

> Si se prefiere un código de error dedicado `NOT_FOUND` para rutas, se puede agregar a `ErrorCodes`. No es obligatorio; `VALIDATION_ERROR` o un nuevo `NOT_FOUND` son aceptables si se documenta. **Decisión de este plan:** agregar `NOT_FOUND: 'NOT_FOUND'` a `ErrorCodes` y usarlo en el 404 de ruta y, si se desea consistencia, mantener `PRODUCT_NOT_FOUND` / `CATEGORY_NOT_FOUND` para recursos de negocio.

Actualizar `ErrorCodes`:

```typescript
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

`index.ts` no necesita cambios de lógica (ya escucha `API_PORT` default 3001).

- [ ] CORS habilitado
- [ ] Routers montados
- [ ] `errorHandler` al final
- [ ] `/health` sigue funcionando

---

## Matriz de errores por endpoint

| Endpoint | Situación | HTTP | code |
|----------|-----------|------|------|
| `GET /api/categories` | OK | 200 | — |
| `GET /api/categories` | DB no aplica (no usa DB) | 200 | — |
| `GET /api/categories/:slug/filters` | slug no en registry | 404 | `CATEGORY_NOT_FOUND` |
| `GET /api/categories/:slug/filters` | error Prisma inesperado | 500 | `INTERNAL_ERROR` |
| `GET /api/products` | falta `category` | 400 | `VALIDATION_ERROR` |
| `GET /api/products` | `category` inexistente | 400 | `VALIDATION_ERROR` |
| `GET /api/products` | param desconocido (ej. `foo=1`) | 400 | `VALIDATION_ERROR` |
| `GET /api/products` | `page`/`pageSize`/`sort` inválidos | 400 | `VALIDATION_ERROR` |
| `GET /api/products` | `pageSize > 100` | 400 | `VALIDATION_ERROR` |
| `GET /api/products` | filtro range min > max | 400 | `VALIDATION_ERROR` |
| `GET /api/products` | OK (aunque 0 resultados) | 200 | — (`products: []`) |
| `GET /api/products` | error Prisma inesperado | 500 | `INTERNAL_ERROR` |
| `GET /api/products/:id` | id no numérico / < 1 | 400 | `VALIDATION_ERROR` |
| `GET /api/products/:id` | id inexistente | 404 | `PRODUCT_NOT_FOUND` |
| `GET /api/products/:id` | OK | 200 | — |
| `GET /api/products/:id` | error Prisma inesperado | 500 | `INTERNAL_ERROR` |
| cualquier ruta `/api/*` no definida | — | 404 | `NOT_FOUND` |

**Logging:**

| Clase | Nivel Winston |
|-------|----------------|
| `ApiError` con status 4xx | `warn` (mensaje + code, sin stack) |
| `ApiError` con status 5xx | `error` (mensaje + code + stack) |
| Error no `ApiError` | `error` (mensaje + stack) → respuesta 500 genérica sin filtrar detalles internos al cliente |

---

## Contratos JSON de respuesta (ejemplos basados en datos reales)

### `GET /api/categories`

```json
{
  "categories": [
    { "slug": "ram", "displayName": "Memoria RAM" }
  ]
}
```

### `GET /api/categories/ram/filters`

```json
{
  "slug": "ram",
  "displayName": "Memoria RAM",
  "filters": [
    {
      "key": "capacity_gb",
      "label": "Capacidad",
      "type": "enum",
      "options": ["8", "16", "32", "48", "64"]
    },
    {
      "key": "ram_type",
      "label": "Tipo",
      "type": "enum",
      "options": ["DDR4", "DDR5"]
    },
    {
      "key": "speed_mhz",
      "label": "Velocidad (MHz)",
      "type": "range"
    },
    {
      "key": "is_kit",
      "label": "Kit (2x)",
      "type": "enum",
      "options": ["true", "false"]
    }
  ]
}
```

> `48` debe aparecer por enrichment (y también por el schema actualizado). `64` puede aparecer solo por schema aunque no haya productos.

### `GET /api/products?category=ram&capacity_gb=16&ram_type=DDR4&sort=price_asc&page=1&pageSize=20`

Forma (valores ilustrativos reales de la DB al momento del plan):

```json
{
  "category": "ram",
  "page": 1,
  "pageSize": 20,
  "totalCount": 20,
  "products": [
    {
      "id": 13,
      "canonicalName": "MEMORIA RAM PC 16GB HIKSEMI HSC416U32Z1 DDR4 3200MHZ CL22 UDIMM NEGRO",
      "brand": null,
      "specs": {
        "capacity_gb": 16,
        "ram_type": "DDR4",
        "speed_mhz": 3200,
        "is_kit": false
      },
      "lowestPrice": {
        "price": 67200,
        "storeName": "Faith Technology",
        "scrapedAt": "2026-08-17T00:18:00.000Z",
        "url": "https://faithtechnologycr.com/producto/memoria-ram-pc-16gb-hiksemi-hsc416u32z1-ddr4-3200mhz-cl22-udimm-negro/"
      }
    }
  ]
}
```

Notas:

- `brand` es `null` en todos los productos actuales; el campo **se incluye igual**.
- `price` es number, no string y no Decimal.
- `totalCount` es el total **después** de filtros y de excluir productos sin precio, **antes** de paginar.
- Los precios/fechas exactos dependen de la última corrida del scraper; los curls de aceptación deben comprobar forma y coherencia, no un timestamp fijo.

### `GET /api/products/13`

```json
{
  "id": 13,
  "canonicalName": "MEMORIA RAM PC 16GB HIKSEMI HSC416U32Z1 DDR4 3200MHZ CL22 UDIMM NEGRO",
  "category": "ram",
  "brand": null,
  "specs": {
    "capacity_gb": 16,
    "ram_type": "DDR4",
    "speed_mhz": 3200,
    "is_kit": false
  },
  "listings": [
    {
      "storeId": 2,
      "storeName": "Faith Technology",
      "url": "https://faithtechnologycr.com/producto/memoria-ram-pc-16gb-hiksemi-hsc416u32z1-ddr4-3200mhz-cl22-udimm-negro/",
      "priceHistory": [
        {
          "price": 67200,
          "inStock": true,
          "scrapedAt": "2026-08-17T00:18:00.000Z"
        }
      ]
    }
  ]
}
```

> `storeId` real puede ser 1 o 2 según el orden de creación de stores (existe también `ExtremeTech` sin listings útiles). No hardcodear storeId en tests; validar `storeName === "Faith Technology"`.

---

## Testing manual (tabla de curls)

Asumir API en `http://localhost:3001` y Postgres con datos de Fase 1.

| # | Caso | Comando | Esperado |
|---|------|---------|----------|
| 1 | Health | `curl -s http://localhost:3001/health` | `{"status":"ok","db":"up"}` |
| 2 | Categorías | `curl -s http://localhost:3001/api/categories` | lista con `ram` / `Memoria RAM` |
| 3 | Filtros RAM | `curl -s http://localhost:3001/api/categories/ram/filters` | 200; options de capacity incluyen `"48"` |
| 4 | Filtros cat. inexistente | `curl -s -o - -w "%{http_code}" http://localhost:3001/api/categories/gpu/filters` | 404 + `CATEGORY_NOT_FOUND` |
| 5 | Products sin category | `curl -s -w "\n%{http_code}" http://localhost:3001/api/products` | 400 + `VALIDATION_ERROR` |
| 6 | Products category mala | `curl -s -w "\n%{http_code}" "http://localhost:3001/api/products?category=gpu"` | 400 + `VALIDATION_ERROR` |
| 7 | Param desconocido | `curl -s -w "\n%{http_code}" "http://localhost:3001/api/products?category=ram&foo=1"` | 400 + `VALIDATION_ERROR` |
| 8 | Listado base | `curl -s "http://localhost:3001/api/products?category=ram&pageSize=5"` | 200; ≤5 products; cada uno con `lowestPrice.price` number > 0 |
| 9 | Filtro combinado | `curl -s "http://localhost:3001/api/products?category=ram&capacity_gb=16&ram_type=DDR4"` | 200; todos los items con specs.capacity_gb=16 y ram_type=DDR4 |
| 10 | Multi enum | `curl -s "http://localhost:3001/api/products?category=ram&ram_type=DDR4,DDR5&pageSize=100"` | 200; solo DDR4 o DDR5 |
| 11 | Range velocidad | `curl -s "http://localhost:3001/api/products?category=ram&speed_mhz_min=5000&speed_mhz_max=6000"` | 200; speed_mhz entre 5000 y 6000 inclusive |
| 12 | Sort price_desc | `curl -s "http://localhost:3001/api/products?category=ram&sort=price_desc&pageSize=3"` | prices no crecientes |
| 13 | Sort newest | `curl -s "http://localhost:3001/api/products?category=ram&sort=newest&pageSize=3"` | 200 |
| 14 | Paginación | `curl -s "http://localhost:3001/api/products?category=ram&page=2&pageSize=10"` | page=2; ids distintos a page=1 |
| 15 | pageSize inválido | `curl -s -w "\n%{http_code}" "http://localhost:3001/api/products?category=ram&pageSize=999"` | 400 |
| 16 | Detalle real | `curl -s http://localhost:3001/api/products/13` | 200; listings[0].priceHistory array ordenado desc |
| 17 | Detalle inexistente | `curl -s -w "\n%{http_code}" http://localhost:3001/api/products/999999` | 404 + `PRODUCT_NOT_FOUND` |
| 18 | is_kit | `curl -s "http://localhost:3001/api/products?category=ram&is_kit=true"` | 200; specs.is_kit === true en todos |
| 19 | Ruta API inexistente | `curl -s -w "\n%{http_code}" http://localhost:3001/api/nope` | 404 + `NOT_FOUND` |

En PowerShell, preferir:

```powershell
curl.exe -s "http://localhost:3001/api/products?category=ram&capacity_gb=16&ram_type=DDR4"
```

(`curl` sin `.exe` puede ser alias de `Invoke-WebRequest`.)

---

## Criterio de aceptación — Fase 2

Secuencia verificable:

```bash
# Precondiciones: Docker Postgres up, migrate applied, datos de scrape RAM presentes

pnpm --filter @hardware-scrapping/shared-types build
pnpm --filter @hardware-scrapping/database build
pnpm --filter @hardware-scrapping/api build
pnpm lint

pnpm --filter @hardware-scrapping/api dev
```

En otra terminal, ejecutar al menos:

```bash
curl.exe -s http://localhost:3001/health
curl.exe -s http://localhost:3001/api/categories
curl.exe -s http://localhost:3001/api/categories/ram/filters
curl.exe -s "http://localhost:3001/api/products?category=ram&capacity_gb=16&ram_type=DDR4"
curl.exe -s http://localhost:3001/api/products/13
curl.exe -s -w "\n%{http_code}" http://localhost:3001/api/products/999999
curl.exe -s -w "\n%{http_code}" http://localhost:3001/api/categories/gpu/filters
```

**Resultado exitoso observable:**

1. Build y lint sin errores.
2. `/health` → db up.
3. `/api/categories` lee del registry (no hardcode en route).
4. `/api/categories/ram/filters` incluye `48` en capacity.
5. Filtro combinado `capacity_gb=16&ram_type=DDR4` devuelve solo productos coherentes; cada uno con `lowestPrice.price > 0` y `storeName` de una tienda real.
6. Detalle de producto 13 (o el id que exista) trae `priceHistory` ordenado desc.
7. 404 de producto y de categoría de filtros con body `{ error: { message, code } }`.
8. Ningún `console.log` nuevo; errores 5xx van a Winston error.
9. `brand: null` se serializa como `null`, no se omite el campo.

**Checklist final Fase 2:**

- [ ] Tarea 2.0 RAM_SCHEMA con 48
- [ ] Tarea 2.1 cors instalado
- [ ] Tarea 2.2 toCrcNumber
- [ ] Tarea 2.3 ApiError + errorHandler
- [ ] Tarea 2.4 validateProductQuery (whitelist + enums + range + page)
- [ ] Tarea 2.5 category.service + enrichment options
- [ ] Tarea 2.6 product.service list + detail + lowestPrice
- [ ] Tarea 2.7 routes
- [ ] Tarea 2.8 app.ts integrado
- [ ] Criterio de aceptación (curls) pasado
- [ ] `pnpm --filter @hardware-scrapping/api build` OK
- [ ] `pnpm lint` OK

---

## Orden de implementación recomendado

1. 2.0 shared-types (`48`) + build  
2. 2.1 cors  
3. 2.2 money utils  
4. 2.3 errors  
5. 2.4 validator (se puede unit-probar mentalmente con objetos query)  
6. 2.5 category.service  
7. 2.6 product.service  
8. 2.7 routes  
9. 2.8 app.ts  
10. build + lint + curls de aceptación  

---

## Qué NO hacer en Fase 2

- No crear paquete `web` / Next.js  
- No implementar JWT, login, ni middleware de auth  
- No crear rutas de admin ni CRUD de User  
- No scrapear ni tocar el package scraper salvo leer datos  
- No implementar matching multi-tienda  
- No usar `console.log`  
- No poner lógica Prisma dentro de los route handlers  
- No devolver `Prisma.Decimal` crudo en JSON  
- No silenciar query params desconocidos  
- No usar el mínimo histórico de todos los tiempos como “precio actual”  
- No sobre-ingenierizar con Redis, cache, cursor pagination o GraphQL  

---

## Apéndice A — Mapa de capas de un request

```
HTTP GET /api/products?category=ram&capacity_gb=16
        │
        ▼
products.routes.ts
        │ validateProductQuery(req.query)
        ▼
product-query.validator.ts  → ValidatedProductQuery | throw ApiError
        │
        ▼
product.service.ts
        │ prisma.product.findMany(... include listings/store/latest price)
        │ filter sin precio / sort / slice page
        ▼
JSON ProductListResponseDto
        │
        ▼ (si throw)
error-handler.ts → { error: { message, code } }
```

---

## Apéndice B — Equivalencia mental C# / EF Core → Prisma

| C# / EF Core | Prisma en este plan |
|--------------|---------------------|
| `DbContext` inyectado | `prisma` singleton de `@hardware-scrapping/database` |
| `Include(p => p.Listings).ThenInclude(...)` | `include: { listings: { include: { store: true, priceHistory: ... } } }` |
| `OrderByDescending(x => x.ScrapedAt).FirstOrDefault()` | `orderBy: { scrapedAt: 'desc' }, take: 1` |
| `Where(p => p.Category == "ram")` | `where: { category: 'ram' }` |
| Filtro sobre JSON column | `specs: { path: ['ram_type'], equals: 'DDR4' }` |
| `Skip((page-1)*size).Take(size)` | en Fase 2: `array.slice` en memoria después del sort por precio |
| Exception filter middleware | `errorHandler` de Express (4 args) |
| `IActionResult` BadRequest | `throw new ApiError(400, ...)` |

---

## Apéndice C — Dependencias npm tocadas en Fase 2

| Paquete | Cambio |
|---------|--------|
| `@hardware-scrapping/shared-types` | options `capacity_gb` + `'48'` |
| `@hardware-scrapping/api` | + `cors`, + `@types/cors`; nuevos archivos src |
| `@hardware-scrapping/database` | sin cambio de schema |
| `@hardware-scrapping/scraper` | sin cambios |

No se requiere migración de Prisma en Fase 2.

---

*Fin del plan Fase 2.*

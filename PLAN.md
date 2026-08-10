# PLAN.md — Fase 0 y Fase 1

Especificación técnica ejecutable para el monorepo **hardware-scrapping**.
Cubre **únicamente** Fase 0 (scaffolding) y Fase 1 (scraper de RAM en ExtremeTech CR).
No incluye frontend Next.js, cron, ni auth funcional (eso es fases futuras).

**Audiencia:** quien ejecuta este plan tiene experiencia en C#/.NET y es nuevo en Node/TypeScript. Cada archivo de configuración se muestra completo; no hay `...` ni resúmenes.

**Ajustes de diseño respecto al prompt original (ya incorporados):**

| Ajuste | Decisión |
|--------|----------|
| Prisma compartido | Paquete `packages/database` (api y scraper lo consumen; el scraper no depende de api) |
| Unicidad | `Product @@unique([canonicalName, category])`, `Store.name @unique`, `StoreListing @@unique([storeId, url])`, `ScrapeRun` con relación formal a `Store` |
| Kits de RAM | `capacity_gb` = capacidad **total** del producto (`2x8GB` → `16`) |
| `shared-types` | Compila a JS: exporta tipos **y** constantes runtime (`RAM_SCHEMA`, `CATEGORY_REGISTRY`), sin dependencias npm externas |
| Logs | Rutas resueltas respecto al paquete; se crea el directorio `logs/` al iniciar |
| Extras | `Decimal(12,2)`, índices, `postgres:16-alpine` + healthcheck, `.nvmrc` = `24`, revisar `robots.txt`, api solo scaffold |

---

## Contexto rápido

| Item | Valor |
|------|--------|
| Nombre del monorepo / `package.json` root `name` | `hardware-scrapping` |
| Objetivo Fase 0–1 | Scrapear RAM de https://extremetechcr.com, guardar en Postgres, dejar base lista para API |
| Package manager | pnpm workspaces |
| Node | LTS 24 (`.nvmrc` → `24`; verificada en entorno: 24.16.0) |
| ORM | Prisma en `packages/database` |
| Logging | Winston en `api` y `scraper` (nunca `console.log` en backend) |

---

## Estructura objetivo del monorepo

```
hardware-scrapping/
├── packages/
│   ├── shared-types/     ← tipos + registries (compila a JS, sin deps runtime npm)
│   ├── database/         ← Prisma schema + client generado
│   ├── api/              ← Express + TS + Winston + client de database (scaffold)
│   └── scraper/          ← worker scraping + Winston + client de database
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .nvmrc
├── .gitignore
├── .env.example
├── .prettierrc
├── .prettierignore
├── eslint.config.mjs
├── README.md
└── PLAN.md
```

> El paquete `web` (Next.js) **no** se crea en estas fases.

---

# Fase 0 — Monorepo, tooling y base de datos

**Objetivo:** monorepo instalable, TypeScript configurado, Postgres en Docker, Prisma migrado, lint/format listos. Sin lógica de negocio de scraping todavía.

---

### Tarea 0.1 — Verificar prerrequisitos

**Descripción:** Confirmar que el entorno tiene las herramientas necesarias antes de tocar archivos.

**Comandos (PowerShell o bash):**

```bash
node -v
# Esperado: v24.x.x (idealmente v24.16.0 o compatible 24)

pnpm -v
# Si falla: npm install -g pnpm

docker -v
docker compose version
```

Si usás nvm-windows / fnm / nvs, instalá o activá Node 24 antes de continuar.

- [x] Node 24.x disponible
- [x] pnpm disponible
- [x] Docker + Docker Compose disponibles

---

### Tarea 0.2 — Archivos raíz del monorepo

**Descripción:** Crear la configuración base en la raíz del repo (el directorio actual del git ya se llama `hardware-scrapping`; no renombrar la carpeta).

#### 0.2.1 — `.nvmrc`

Contenido completo:

```
24
```

- [x] `.nvmrc` creado

#### 0.2.2 — `pnpm-workspace.yaml`

Contenido completo:

```yaml
packages:
  - "packages/*"
```

- [x] `pnpm-workspace.yaml` creado

#### 0.2.3 — `package.json` (raíz)

Contenido completo:

```json
{
  "name": "hardware-scrapping",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@10.33.4",
  "scripts": {
    "build": "pnpm -r run build",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:generate": "pnpm --filter @hardware-scrapping/database generate",
    "db:migrate": "pnpm --filter @hardware-scrapping/database migrate:dev",
    "db:studio": "pnpm --filter @hardware-scrapping/database studio"
  },
  "devDependencies": {
    "@eslint/js": "^9.22.0",
    "eslint": "^9.22.0",
    "prettier": "^3.5.3",
    "typescript": "^5.8.2",
    "typescript-eslint": "^8.26.1"
  }
}
```

> Nota: la versión exacta de `packageManager` puede ajustarse a la salida de `pnpm -v` del entorno. Los números de deps son orientativos de líneas actuales; `pnpm install` resolverá lockfile.

- [x] `package.json` raíz creado

#### 0.2.4 — `tsconfig.base.json` (raíz)

Contenido completo. Todos los paquetes extienden este archivo.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

**Cómo lo extiende cada paquete:** cada `packages/<nombre>/tsconfig.json` tendrá:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

Excepción: `packages/database` puede incluir también el folder `prisma` solo si hiciera falta tipos auxiliares; el schema de Prisma **no** se compila con `tsc`, lo consume el CLI de Prisma. El client generado vive en `node_modules` / output de Prisma.

- [x] `tsconfig.base.json` creado

#### 0.2.5 — `.gitignore`

Contenido completo:

```
# Dependencies
node_modules/

# Build
dist/
build/
*.tsbuildinfo

# Env
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*

# Prisma
packages/database/prisma/*.db
packages/database/prisma/*.db-journal

# OS / IDE
.DS_Store
Thumbs.db
.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json

# Test / coverage
coverage/
.nyc_output/

# Misc
tmp/
temp/
.turbo/
```

- [x] `.gitignore` creado

#### 0.2.6 — `.env.example`

Contenido completo (copiar a `.env` en la raíz para desarrollo):

```env
# Node
NODE_ENV=development

# PostgreSQL (debe coincidir con docker-compose.yml)
POSTGRES_USER=hardware
POSTGRES_PASSWORD=hardware_dev_password
POSTGRES_DB=hardware_scrapping
POSTGRES_PORT=5432

# Prisma / apps
DATABASE_URL=postgresql://hardware:hardware_dev_password@localhost:5432/hardware_scrapping?schema=public

# Auth (Fase 0/1: solo placeholder; no implementar JWT todavía)
JWT_SECRET=change-me-to-a-long-random-string

# Scraper
SCRAPER_CONTACT_EMAIL=tu-email@ejemplo.com
SCRAPER_USER_AGENT=ComparadorHW-Bot/1.0 (contacto: tu-email@ejemplo.com)
SCRAPER_DELAY_MS=4000
```

**Regla:** el archivo real `.env` **nunca** se commitea. Cada paquete que necesite env lo lee desde la raíz del monorepo o desde su propio cwd documentado (ver Tarea 0.8 y 1.x: cargar dotenv desde raíz).

- [x] `.env.example` creado
- [x] `.env` creado localmente copiando `.env.example` (no commitear)

#### 0.2.7 — Prettier

**`.prettierrc`** (completo):

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

**`.prettierignore`** (completo):

```
node_modules
dist
coverage
pnpm-lock.yaml
logs
.next
```

- [x] `.prettierrc` y `.prettierignore` creados

#### 0.2.8 — ESLint (flat config, ESLint 9)

**`eslint.config.mjs`** (completo, raíz):

```js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/logs/**',
      'pnpm-lock.yaml',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
```

> `no-console: error` fuerza el uso de Winston en api/scraper. En scripts one-off de Prisma no debería haber `console.log` de aplicación.

- [x] `eslint.config.mjs` creado

#### 0.2.9 — `README.md` mínimo

Contenido completo:

```markdown
# hardware-scrapping

Comparador de precios de hardware (piloto: RAM en ExtremeTech CR).

## Requisitos

- Node.js 24 (ver `.nvmrc`)
- pnpm
- Docker Desktop (o Docker Engine + Compose)

## Setup rápido

```bash
cp .env.example .env
# Editar SCRAPER_CONTACT_EMAIL y SCRAPER_USER_AGENT en .env

pnpm install
docker compose up -d
pnpm db:migrate
```

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `pnpm build` | Compila todos los paquetes |
| `pnpm lint` | ESLint |
| `pnpm db:studio` | Prisma Studio |
| `pnpm --filter @hardware-scrapping/scraper scrape:ram` | Scraper RAM (Fase 1) |

## Estructura

Ver `PLAN.md` para la especificación de Fase 0 y Fase 1.
```

- [x] `README.md` creado

---

### Tarea 0.3 — Docker Compose (PostgreSQL)

**Descripción:** Solo Postgres en desarrollo, imagen pinneada, volumen persistente, healthcheck.

**`docker-compose.yml`** (completo):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: hardware-scrapping-db
    restart: unless-stopped
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-hardware}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-hardware_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-hardware_scrapping}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-hardware} -d ${POSTGRES_DB:-hardware_scrapping}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

volumes:
  postgres_data:
```

**Comandos:**

```bash
docker compose up -d
docker compose ps
# postgres debe estar healthy / running
```

- [x] `docker-compose.yml` creado
- [x] `docker compose up -d` levanta Postgres sin error

---

### Tarea 0.4 — Paquete `packages/shared-types`

**Descripción:** Tipos compartidos + sistema de registro de categorías extensible. **Compila a JavaScript** (no es solo `.d.ts`). Sin dependencias npm de runtime.

#### 0.4.1 — `packages/shared-types/package.json`

```json
{
  "name": "@hardware-scrapping/shared-types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "clean": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\""
  },
  "devDependencies": {
    "typescript": "^5.8.2"
  }
}
```

#### 0.4.2 — `packages/shared-types/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src/**/*"]
}
```

#### 0.4.3 — `packages/shared-types/src/category.ts`

Contenido completo conceptual a implementar (el ejecutor debe crear este archivo con este diseño exacto):

```typescript
/**
 * CategorySlug: unión de string literales.
 * Para agregar una categoría nueva (ej. 'gpu'):
 * 1. Sumar | 'gpu' a este tipo
 * 2. Crear GPU_SCHEMA
 * 3. Registrar en CATEGORY_REGISTRY
 * No hace falta tocar código de consumidores que iteran el registry.
 */
export type CategorySlug = 'ram';

export type FilterType = 'number' | 'enum' | 'range';

export interface FilterDefinition {
  key: string;
  label: string;
  type: FilterType;
  /** Obligatorio/útil cuando type === 'enum' */
  options?: string[];
  /** Opcional cuando type === 'range' */
  min?: number;
  max?: number;
}

export interface CategorySchema {
  slug: CategorySlug;
  displayName: string;
  filters: FilterDefinition[];
}

export const RAM_SCHEMA: CategorySchema = {
  slug: 'ram',
  displayName: 'Memoria RAM',
  filters: [
    {
      key: 'capacity_gb',
      label: 'Capacidad',
      type: 'enum',
      options: ['8', '16', '32', '64'],
    },
    {
      key: 'ram_type',
      label: 'Tipo',
      type: 'enum',
      options: ['DDR4', 'DDR5'],
    },
    {
      key: 'speed_mhz',
      label: 'Velocidad (MHz)',
      type: 'range',
    },
    {
      key: 'is_kit',
      label: 'Kit (2x)',
      type: 'enum',
      options: ['true', 'false'],
    },
  ],
};

export const CATEGORY_REGISTRY: Record<CategorySlug, CategorySchema> = {
  ram: RAM_SCHEMA,
};

export function getCategorySchema(slug: CategorySlug): CategorySchema {
  return CATEGORY_REGISTRY[slug];
}
```

#### 0.4.4 — Specs de RAM (tipo del resultado del extractor)

`packages/shared-types/src/ram-specs.ts`:

```typescript
/**
 * Forma del JSON guardado en Product.specs para category === 'ram'.
 * capacity_gb: capacidad TOTAL del producto en GB.
 *   - "16GB DDR4" → 16
 *   - "2x8GB DDR4" → 16 (NO 8)
 * is_kit: true si el nombre indica kit multi-módulo (2x, 4x, etc.)
 */
export interface RamSpecs {
  capacity_gb: number | null;
  ram_type: 'DDR4' | 'DDR5' | string | null;
  speed_mhz: number | null;
  is_kit: boolean;
}
```

#### 0.4.5 — `packages/shared-types/src/index.ts`

```typescript
export type {
  CategorySlug,
  FilterType,
  FilterDefinition,
  CategorySchema,
} from './category.js';
export { RAM_SCHEMA, CATEGORY_REGISTRY, getCategorySchema } from './category.js';
export type { RamSpecs } from './ram-specs.js';
```

> Con `"module": "Node16"` y `"type": "module"`, los imports relativos en el fuente **deben** usar extensión `.js` (apuntan al emit, no al `.ts`). Esto es el equivalente a referencias de ensamblado explícitas; no es un error tipográfico.

- [x] Paquete `shared-types` creado con los archivos anteriores
- [ ] `pnpm --filter @hardware-scrapping/shared-types build` compila a `dist/`

---

### Tarea 0.5 — Paquete `packages/database` (Prisma)

**Descripción:** Única fuente de verdad del schema Prisma y del client. `api` y `scraper` dependen de este paquete; **nunca** al revés.

#### 0.5.1 — `packages/database/package.json`

```json
{
  "name": "@hardware-scrapping/database",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "generate": "prisma generate",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "studio": "prisma studio",
    "build": "pnpm run generate && tsc -p tsconfig.json"
  },
  "dependencies": {
    "@prisma/client": "^6.5.0"
  },
  "devDependencies": {
    "prisma": "^6.5.0",
    "typescript": "^5.8.2",
    "dotenv": "^16.4.7"
  }
}
```

#### 0.5.2 — `packages/database/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src/**/*"]
}
```

#### 0.5.3 — `packages/database/prisma/schema.prisma`

Contenido **completo** (incluye uniques, FK ScrapeRun→Store, Decimal, índices):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Product {
  id            Int            @id @default(autoincrement())
  canonicalName String
  category      String
  brand         String?
  /// JSON con specs de la categoría (ej. RamSpecs para category = "ram")
  specs         Json
  createdAt     DateTime       @default(now())
  listings      StoreListing[]

  @@unique([canonicalName, category])
  @@index([category])
}

model Store {
  id         Int            @id @default(autoincrement())
  name       String         @unique
  baseUrl    String
  listings   StoreListing[]
  scrapeRuns ScrapeRun[]
}

model StoreListing {
  id               Int            @id @default(autoincrement())
  productId        Int
  product          Product        @relation(fields: [productId], references: [id], onDelete: Restrict)
  storeId          Int
  store            Store          @relation(fields: [storeId], references: [id], onDelete: Restrict)
  storeProductName String
  url              String
  priceHistory     PriceHistory[]

  @@unique([storeId, url])
  @@index([productId])
  @@index([storeId])
}

model PriceHistory {
  id        Int          @id @default(autoincrement())
  listingId Int
  listing   StoreListing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  /// Precio en colones costarricenses (CRC). Sin campo currency en Fase 0/1.
  price     Decimal      @db.Decimal(12, 2)
  inStock   Boolean
  scrapedAt DateTime     @default(now())

  @@index([listingId])
  @@index([scrapedAt])
}

/// Existe desde el inicio para evitar migración destructiva después.
/// Fase 1 NO implementa auth ni usa este modelo en runtime.
model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  passwordHash String
  role         String   @default("user")
  createdAt    DateTime @default(now())
}

model ScrapeRun {
  id            Int       @id @default(autoincrement())
  storeId       Int
  store         Store     @relation(fields: [storeId], references: [id], onDelete: Restrict)
  category      String
  /// 'running' | 'success' | 'partial' | 'failed'
  status        String
  productsFound Int       @default(0)
  errorsCount   Int       @default(0)
  startedAt     DateTime
  finishedAt    DateTime?
  errorSummary  String?

  @@index([storeId])
  @@index([startedAt])
}
```

#### 0.5.4 — Cliente Prisma reutilizable

`packages/database/src/index.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export type * from '@prisma/client';
```

#### 0.5.5 — Carga de `DATABASE_URL` al correr migraciones

Prisma CLI busca `.env` en el directorio del schema (`packages/database`) y en la raíz del proyecto. **Opción recomendada para monorepo:**

1. Mantener un único `.env` en la **raíz** del monorepo.
2. Crear `packages/database/.env` **solo si hace falta**, o usar en scripts:

En `packages/database/package.json`, se puede dejar los scripts como están y **copiar/symlink** no es ideal en Windows. Mejor: documentar que el desarrollador debe tener `DATABASE_URL` en la raíz y agregar archivo:

`packages/database/prisma.config` — **no usar** si la versión de Prisma lee automáticamente el env del cwd al invocar vía pnpm filter.

**Procedimiento confiable en Windows (PowerShell):**

```powershell
# Desde la raíz del monorepo, con .env ya creado en la raíz:
pnpm --filter @hardware-scrapping/database exec prisma migrate dev --name init
```

Si Prisma no encuentra `DATABASE_URL`, crear `packages/database/.env` con una sola línea (mismo valor que la raíz; este archivo está cubierto por `.gitignore` vía `.env`):

```env
DATABASE_URL=postgresql://hardware:hardware_dev_password@localhost:5432/hardware_scrapping?schema=public
```

Opcional y recomendado: en `packages/database/package.json` scripts, prefijar con dotenv-cli más adelante; en Fase 0 basta con `.env` en `packages/database` duplicando `DATABASE_URL` o exportar la variable en la sesión.

#### 0.5.6 — Comandos de inicialización Prisma

Desde la raíz del monorepo:

```bash
pnpm install
docker compose up -d
# Esperar healthcheck OK

# Asegurar DATABASE_URL visible para Prisma (ver 0.5.5)
pnpm --filter @hardware-scrapping/database generate
pnpm --filter @hardware-scrapping/database migrate:dev
# Cuando pida nombre de migración: init
```

Resultado esperado: carpeta `packages/database/prisma/migrations/..._init/` creada y tablas en Postgres.

- [x] Paquete `database` creado
- [x] `schema.prisma` con uniques, relaciones e índices como arriba
- [x] `prisma generate` OK
- [x] `prisma migrate dev` OK (migración `init`)

---

### Tarea 0.6 — Paquete `packages/api` (scaffold)

**Descripción:** API Express mínima. **Fase 0/1:** solo healthcheck + Winston + import del client de Prisma. **NO** implementar JWT, login, ni endpoints de productos todavía. `JWT_SECRET` existe en `.env` para no reestructurar después.

#### 0.6.1 — `packages/api/package.json`

```json
{
  "name": "@hardware-scrapping/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@hardware-scrapping/database": "workspace:*",
    "@hardware-scrapping/shared-types": "workspace:*",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "winston": "^3.17.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.13.10",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2"
  }
}
```

#### 0.6.2 — `packages/api/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../database" },
    { "path": "../shared-types" }
  ]
}
```

#### 0.6.3 — Estructura de carpetas api

```
packages/api/
├── package.json
├── tsconfig.json
├── logs/                 ← generada en runtime (gitignored)
└── src/
    ├── index.ts
    ├── app.ts
    ├── logger.ts
    └── load-env.ts
```

#### 0.6.4 — `packages/api/src/load-env.ts`

Carga `.env` desde la raíz del monorepo (dos niveles arriba de `packages/api`):

```typescript
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// packages/api/src -> monorepo root
const rootEnv = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: rootEnv });
```

#### 0.6.5 — `packages/api/src/logger.ts`

Winston con rutas **absolutas** respecto al paquete `api` (no dependen del cwd):

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// packages/api/src -> packages/api/logs
const logsDir = path.resolve(__dirname, '../logs');
fs.mkdirSync(logsDir, { recursive: true });

const isDev = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }),
  ],
});

if (isDev) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          const base = `${timestamp as string} [${level}]: ${message as string}`;
          return stack ? `${base}\n${stack as string}` : base;
        }),
      ),
    }),
  );
}
```

#### 0.6.6 — `packages/api/src/app.ts`

```typescript
import express from 'express';
import { prisma } from '@hardware-scrapping/database';
import { logger } from './logger.js';

export function createApp() {
  const app = express();
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

  return app;
}
```

#### 0.6.7 — `packages/api/src/index.ts`

```typescript
import './load-env.js';
import { createApp } from './app.js';
import { logger } from './logger.js';

const port = Number(process.env.API_PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  logger.info(`API listening on http://localhost:${port}`);
});
```

- [x] Scaffold `api` creado
- [x] `pnpm --filter @hardware-scrapping/api dev` responde `GET /health` con DB up
- [x] No hay `console.log` en el paquete
- [x] Archivos en `packages/api/logs/` se crean al arrancar

---

### Tarea 0.7 — Paquete `packages/scraper` (esqueleto sin scrape real)

**Descripción:** En Fase 0 solo estructura, logger, load-env y un `index.ts` placeholder. La lógica de ExtremeTech es Fase 1.

#### 0.7.1 — `packages/scraper/package.json`

```json
{
  "name": "@hardware-scrapping/scraper",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "scrape:ram": "tsx src/index.ts ram"
  },
  "dependencies": {
    "@hardware-scrapping/database": "workspace:*",
    "@hardware-scrapping/shared-types": "workspace:*",
    "cheerio": "^1.0.0",
    "dotenv": "^16.4.7",
    "winston": "^3.17.0"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2"
  }
}
```

#### 0.7.2 — `packages/scraper/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../database" },
    { "path": "../shared-types" }
  ]
}
```

#### 0.7.3 — Estructura de carpetas scraper (Fase 0 crea archivos vacíos/placeholder; Fase 1 los completa)

```
packages/scraper/
├── package.json
├── tsconfig.json
├── logs/                          ← runtime
└── src/
    ├── index.ts                   ← CLI entry
    ├── load-env.ts
    ├── logger.ts
    ├── lib/
    │   └── delay.ts
    ├── extractors/
    │   ├── types.ts
    │   ├── ram.ts
    │   └── index.ts               ← EXTRACTORS registry
    ├── scrapers/
    │   └── extremetech/
    │       ├── constants.ts
    │       ├── discover.ts
    │       ├── parse-product.ts
    │       └── run-ram.ts
    └── persistence/
        └── upsert-product.ts
```

#### 0.7.4 — `load-env.ts` y `logger.ts`

Igual patrón que api:

- `load-env.ts`: `dotenv.config` sobre `path.resolve(__dirname, '../../../.env')`
- `logger.ts`: `logsDir = path.resolve(__dirname, '../logs')` + `fs.mkdirSync` + mismos transports Winston (debug en dev, info en prod; `error.log` + `combined.log`; consola solo en dev)

Duplicar la config de Winston en api y scraper es **intencional** en Fase 0/1 (simplicidad). No crear un paquete `logger` compartido todavía.

#### 0.7.5 — Placeholder `src/index.ts` (Fase 0)

```typescript
import './load-env.js';
import { logger } from './logger.js';

const category = process.argv[2] ?? 'ram';
logger.info('Scraper scaffold OK (Fase 0). Implementación real en Fase 1.', {
  category,
});
```

- [x] Esqueleto `scraper` creado
- [x] `pnpm --filter @hardware-scrapping/scraper scrape:ram` imprime log Winston (no console)

---

### Tarea 0.8 — Install y build de verificación

**Comandos desde la raíz:**

```bash
pnpm install
pnpm --filter @hardware-scrapping/shared-types build
pnpm --filter @hardware-scrapping/database build
pnpm --filter @hardware-scrapping/api build
pnpm --filter @hardware-scrapping/scraper build
pnpm lint
```

- [x] `pnpm install` sin errores
- [x] Build de los 4 paquetes sin errores de TypeScript
- [x] Lint sin errores (o solo warnings aceptados y documentados)

---

## Criterio de aceptación — Fase 0

El usuario (o el agente ejecutor) debe poder correr esta secuencia y obtener éxito:

```bash
# 1. Dependencias
pnpm install

# 2. Infra
docker compose up -d
docker compose ps
# postgres healthy

# 3. DB
pnpm db:generate
pnpm db:migrate
# tablas creadas

# 4. Build
pnpm build

# 5. API health (terminal 1)
pnpm --filter @hardware-scrapping/api dev
# terminal 2:
curl http://localhost:3001/health
# {"status":"ok","db":"up"}

# 6. Scraper scaffold
pnpm --filter @hardware-scrapping/scraper scrape:ram
# log Winston en consola + archivo packages/scraper/logs/combined.log
```

**Checklist final Fase 0:**

- [x] Monorepo pnpm con 4 paquetes: `shared-types`, `database`, `api`, `scraper`
- [x] Postgres 16 vía Docker con volumen y healthcheck
- [x] Migración Prisma inicial aplicada con todos los modelos y uniques
- [x] Winston operativo en api y scraper (sin `console.log`)
- [x] ESLint + Prettier en raíz
- [x] `.env.example` documenta `DATABASE_URL`, `JWT_SECRET`, vars del scraper

---

# Fase 1 — Scraper funcional de RAM (ExtremeTech CR)

**Objetivo:** correr manualmente un scrape de productos RAM de ExtremeTech, persistir Product / Store / StoreListing / PriceHistory / ScrapeRun con datos reales.

**No incluye:** cron, frontend, endpoints de catálogo, auth.

---

### Tarea 1.1 — Inspección manual del sitio (OBLIGATORIA antes de codear selectores)

**Descripción:** ExtremeTech CR es WooCommerce SSR; el HTML de producto viene en el server response (cheerio es adecuado). Antes de escribir selectores CSS, inspeccionar manualmente.

**Pasos a ejecutar por el desarrollador/agente:**

1. Abrir en el navegador: `https://extremetechcr.com/robots.txt`  
   - Anotar si hay `Disallow` que afecte categorías o productos.  
   - Si el scrape de categoría/productos está disallowed, **detenerse** y documentar en README; no violar robots.txt.

2. Abrir: `https://extremetechcr.com/sitemap.xml` (y sitemaps hijos si los hay).  
   - Buscar URLs de productos y/o de la categoría RAM.  
   - Anotar patrones de URL (ej. `/producto/...`, `/product/...`, categoría `/categoria-producto/memoria-ram/` o similar).

3. Abrir la página de categoría de RAM en el sitio (buscar “RAM” / “Memoria” en el menú).  
   - Ver si el listado es una sola página o paginada (`?paged=2`, `/page/2/`, etc.).  
   - Ver en “View Source” o DevTools → Elements los selectores de:  
     - link a producto  
     - título  
     - precio  
     - badge de stock / “Agotado”

4. Abrir **2–3** páginas de producto individuales y anotar selectores estables para:  
   - nombre del producto  
   - precio (monto numérico; quitar `₡`, espacios, puntos de miles)  
   - disponibilidad  

5. Documentar hallazgos en un archivo corto interno opcional `packages/scraper/NOTES-extremetech.md` (no es entregable de producción; ayuda a no adivinar selectores). Si los selectores del plan de abajo no coinciden con el HTML real, **prevalece el HTML real** y se actualizan los selectores en código.

**User-Agent obligatorio** (desde `.env`):

```
ComparadorHW-Bot/1.0 (contacto: [SCRAPER_CONTACT_EMAIL])
```

Ejemplo: `ComparadorHW-Bot/1.0 (contacto: yo@mail.com)`

**Rate limit obligatorio:** mínimo 3000–5000 ms entre requests a páginas de producto. Default en `.env`: `SCRAPER_DELAY_MS=4000`. Usar siempre la función `delay()`; no omitir “por apuro”.

- [ ] `robots.txt` revisado
- [ ] sitemap / categoría RAM inspeccionados
- [ ] Selectores de listado y ficha de producto anotados
- [ ] Email real puesto en `.env` (`SCRAPER_CONTACT_EMAIL` y `SCRAPER_USER_AGENT`)

---

### Tarea 1.2 — Utilidad `delay` y constantes ExtremeTech

#### 1.2.1 — `packages/scraper/src/lib/delay.ts`

```typescript
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

#### 1.2.2 — `packages/scraper/src/scrapers/extremetech/constants.ts`

```typescript
export const STORE_NAME = 'ExtremeTech';
export const STORE_BASE_URL = 'https://extremetechcr.com';

/**
 * URL de categoría RAM — CONFIRMAR en Tarea 1.1 y ajustar si el sitio usa otro slug.
 * Ejemplos posibles a verificar manualmente:
 * - https://extremetechcr.com/categoria-producto/memoria-ram/
 * - https://extremetechcr.com/product-category/memoria-ram/
 */
export const RAM_CATEGORY_URL = `${STORE_BASE_URL}/categoria-producto/memoria-ram/`;

export function getScraperHeaders(): HeadersInit {
  const ua =
    process.env.SCRAPER_USER_AGENT ??
    'ComparadorHW-Bot/1.0 (contacto: missing-email@example.com)';
  return {
    'User-Agent': ua,
    'Accept-Language': 'es-CR,es;q=0.9,en;q=0.8',
    Accept: 'text/html,application/xhtml+xml',
  };
}

export function getDelayMs(): number {
  const n = Number(process.env.SCRAPER_DELAY_MS ?? 4000);
  return Number.isFinite(n) && n >= 3000 ? n : 4000;
}
```

- [ ] `delay.ts` y `constants.ts` creados

---

### Tarea 1.3 — Extractor de specs RAM + registry

#### 1.3.1 — Regla de negocio: capacidad en kits

| Nombre ejemplo | capacity_gb | ram_type | speed_mhz | is_kit |
|----------------|-------------|----------|-----------|--------|
| `Kingston Fury Beast 16GB DDR4 3200MHz` | `16` | `DDR4` | `3200` | `false` |
| `Corsair Vengeance 2x8GB DDR4 3600MHz` | `16` | `DDR4` | `3600` | `true` |
| `G.Skill Trident Z5 RGB 32GB (2x16GB) DDR5 6000MHz` | `32` | `DDR5` | `6000` | `true` |

**Reglas del parser:**

1. **Kit:** si aparece `NxMGB` (ej. `2x8GB`, `2x16GB`) o `(2x16GB)` → `is_kit = true`.  
   - `capacity_gb` = `N * M` (total), **no** M solo.  
2. **Capacidad simple:** si hay `\d+\s*GB` y no hay patrón kit → ese número es `capacity_gb`, `is_kit = false`.  
3. Si hay **ambos** (total explícito + desglose), preferir el total explícito si existe (`32GB (2x16GB)` → 32) y `is_kit = true`.  
4. **Tipo:** match case-insensitive `DDR4` / `DDR5` → normalizar a `DDR4` / `DDR5`.  
5. **Velocidad:** `(\d{3,5})\s*MHz` o a veces solo `3200` junto a DDR; preferir número seguido de `MHz` / `MHZ`.  
6. Si un campo no se puede extraer → `null` (excepto `is_kit`, que default `false` si no hay señal de kit).

#### 1.3.2 — `packages/scraper/src/extractors/types.ts`

```typescript
import type { CategorySlug, RamSpecs } from '@hardware-scrapping/shared-types';

export type SpecsExtractor = (productName: string) => Record<string, unknown>;

export type ExtractorRegistry = Partial<Record<CategorySlug, SpecsExtractor>>;

export type { RamSpecs };
```

#### 1.3.3 — `packages/scraper/src/extractors/ram.ts`

Implementar `extractRamSpecs(productName: string): RamSpecs` con regex documentadas:

```typescript
import type { RamSpecs } from '@hardware-scrapping/shared-types';

/**
 * Extrae specs de RAM desde el nombre comercial del producto.
 *
 * Patrones (orden importa en la implementación):
 * 1. Kit con total: /(\d+)\s*GB\s*\(\s*(\d+)\s*x\s*(\d+)\s*GB\s*\)/i
 * 2. Kit NxM: /(\d+)\s*x\s*(\d+)\s*GB/i  → capacity = N*M, is_kit=true
 * 3. Capacidad simple: /(\d+)\s*GB/i
 * 4. Tipo: /DDR\s*([45])/i → `DDR$1`
 * 5. Speed: /(\d{3,5})\s*MHz/i
 *
 * Ejemplos: ver tabla en PLAN.md Tarea 1.3.1
 */
export function extractRamSpecs(productName: string): RamSpecs {
  // implementación completa según reglas 1.3.1
  // ...
}
```

El ejecutor debe escribir la implementación completa (sin `...`), cubriendo los 3 ejemplos de la tabla como casos mentales de prueba. Opcional recomendado: archivo `packages/scraper/src/extractors/ram.selfcheck.ts` o asserts temporales en dev que validen los 3 ejemplos y se borren después; no es obligatorio un framework de test en Fase 1.

#### 1.3.4 — `packages/scraper/src/extractors/index.ts`

```typescript
import type { CategorySlug } from '@hardware-scrapping/shared-types';
import { extractRamSpecs } from './ram.js';
import type { SpecsExtractor } from './types.js';

export const EXTRACTORS: Record<CategorySlug, SpecsExtractor> = {
  ram: (name) => extractRamSpecs(name) as unknown as Record<string, unknown>,
};

export function getExtractor(slug: CategorySlug): SpecsExtractor {
  return EXTRACTORS[slug];
}

export { extractRamSpecs } from './ram.js';
```

**Extensibilidad futura:** agregar GPU = nuevo archivo `gpu.ts` + entrada en `EXTRACTORS` + valor en `CategorySlug`. No modificar extractores existentes.

- [ ] `extractRamSpecs` implementado con las reglas de kit=total
- [ ] Los 3 ejemplos de la tabla producen el resultado esperado
- [ ] `EXTRACTORS` registry solo con `ram`

---

### Tarea 1.4 — Fetch HTML y descubrimiento de URLs

#### 1.4.1 — Helper de fetch

Crear `packages/scraper/src/lib/fetch-html.ts`:

```typescript
import { logger } from '../logger.js';
import { getScraperHeaders } from '../scrapers/extremetech/constants.js';

export async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: getScraperHeaders() });
    if (!res.ok) {
      logger.warn('HTTP no OK al fetchear', { url, status: res.status });
      return null;
    }
    return await res.text();
  } catch (err) {
    logger.error('Fallo de red al fetchear', { url, err });
    return null;
  }
}
```

> Node 24 incluye `fetch` global. No hace falta `node-fetch`.

#### 1.4.2 — `packages/scraper/src/scrapers/extremetech/discover.ts`

Responsabilidad: devolver `string[]` de URLs absolutas de producto RAM.

**Algoritmo sugerido (ajustar tras Tarea 1.1):**

1. Empezar en `RAM_CATEGORY_URL`.
2. Parsear con cheerio.
3. Seleccionar links de producto (ej. típico WooCommerce: `a.woocommerce-LoopProduct-link`, o `ul.products li.product a`). **Confirmar en HTML real.**
4. Normalizar a URL absoluta con `new URL(href, STORE_BASE_URL).href`.
5. Deduplicar con `Set`.
6. Si hay paginación, seguir “next” hasta que no haya más, aplicando `delay(getDelayMs())` entre páginas de listado también.
7. Si el listado falla, intentar fallback: filtrar URLs del sitemap que parezcan productos RAM (solo si 1.1 confirmó que el sitemap es usable).

Loggear: cantidad de URLs encontradas (`logger.info`).

- [ ] `discoverRamProductUrls(): Promise<string[]>` implementado
- [ ] Deduplica URLs
- [ ] Respeta delay entre páginas de listado

---

### Tarea 1.5 — Parseo de página de producto

#### 1.5.1 — Tipo interno

```typescript
export interface ParsedProductPage {
  url: string;
  name: string;
  price: number | null; // CRC
  inStock: boolean;
  brand: string | null;
}
```

#### 1.5.2 — `packages/scraper/src/scrapers/extremetech/parse-product.ts`

Usar cheerio. Selectores **provisionales** (WooCommerce típico) — reemplazar por los de Tarea 1.1:

| Campo | Selectores candidatos a probar |
|-------|--------------------------------|
| nombre | `h1.product_title`, `h1.entry-title` |
| precio | `p.price ins .amount`, `p.price .amount`, `span.woocommerce-Price-amount` |
| stock | `.stock.in-stock` / `.stock.out-of-stock`, o botón `button.single_add_to_cart_button` disabled |
| marca | fila de atributos, `.posted_in`, o primer token del nombre |

**Parseo de precio (CRC):**

1. Tomar texto del nodo de precio (ej. `₡45,000.00` o `₡45.000`).
2. Eliminar símbolo de moneda, espacios, letras.
3. En CR a veces usan `.` como miles y `,` como decimal (o al revés). Estrategia robusta simple para Fase 1:
   - Si hay coma y punto, asumir formato en-US miles con coma decimal o el que se observe en 1.1.
   - Documentar en código el formato **real observado** en ExtremeTech y parsear ese.
4. Si no se puede parsear → `price = null`, `logger.warn`.

**Errores:**

- Si no hay nombre → considerar página inválida, `logger.warn`, retornar `null`.
- Nunca lanzar excepción no capturada hacia el loop principal.

Firma:

```typescript
export function parseExtremeTechProductPage(
  url: string,
  html: string,
): ParsedProductPage | null;
```

- [ ] Parser implementado con selectores validados en HTML real
- [ ] Precio numérico en colones
- [ ] `inStock` booleano

---

### Tarea 1.6 — Persistencia con Prisma (upsert)

#### 1.6.1 — Reglas de identidad

| Entidad | Clave de upsert |
|---------|------------------|
| `Store` | `name = 'ExtremeTech'` |
| `Product` | `canonicalName` + `category` (`canonicalName` = nombre limpio del store; `category = 'ram'`) |
| `StoreListing` | `storeId` + `url` |
| `PriceHistory` | **siempre insert** (nueva fila por corrida/scrape del listing) |
| `ScrapeRun` | **siempre insert** al inicio; **update** al final |

#### 1.6.2 — `packages/scraper/src/persistence/upsert-product.ts`

Flujo por producto parseado + specs:

```typescript
import { prisma } from '@hardware-scrapping/database';
import type { RamSpecs } from '@hardware-scrapping/shared-types';
import type { ParsedProductPage } from '../scrapers/extremetech/parse-product.js';

export async function ensureStore(name: string, baseUrl: string) {
  return prisma.store.upsert({
    where: { name },
    create: { name, baseUrl },
    update: { baseUrl },
  });
}

export async function persistRamProduct(params: {
  storeId: number;
  parsed: ParsedProductPage;
  specs: RamSpecs;
}): Promise<'ok' | 'skipped_no_price'> {
  const { storeId, parsed, specs } = params;

  if (parsed.price === null) {
    // Aún se puede guardar producto/listing sin price history, o skipear.
    // Decisión Fase 1: crear/actualizar product+listing, NO crear PriceHistory,
    // y contar como warning en el run (caller incrementa errorsCount o warnings).
  }

  const product = await prisma.product.upsert({
    where: {
      canonicalName_category: {
        canonicalName: parsed.name.trim(),
        category: 'ram',
      },
    },
    create: {
      canonicalName: parsed.name.trim(),
      category: 'ram',
      brand: parsed.brand,
      specs,
    },
    update: {
      brand: parsed.brand ?? undefined,
      specs,
    },
  });

  const listing = await prisma.storeListing.upsert({
    where: {
      storeId_url: {
        storeId,
        url: parsed.url,
      },
    },
    create: {
      productId: product.id,
      storeId,
      storeProductName: parsed.name.trim(),
      url: parsed.url,
    },
    update: {
      productId: product.id,
      storeProductName: parsed.name.trim(),
    },
  });

  if (parsed.price !== null) {
    await prisma.priceHistory.create({
      data: {
        listingId: listing.id,
        price: parsed.price,
        inStock: parsed.inStock,
      },
    });
  }

  return parsed.price === null ? 'skipped_no_price' : 'ok';
}
```

El ejecutor debe completar tipos Prisma (`Decimal` acepta number en create) y el manejo de `skipped_no_price` de forma consistente con ScrapeRun.

- [ ] Upserts no duplican Product ni StoreListing en el segundo run
- [ ] Cada run agrega filas nuevas de PriceHistory cuando hay precio
- [ ] `specs` JSON contiene el resultado de `extractRamSpecs`

---

### Tarea 1.7 — Orquestación del scrape RAM

#### 1.7.1 — `packages/scraper/src/scrapers/extremetech/run-ram.ts`

Algoritmo paso a paso:

1. `startedAt = new Date()`
2. `store = await ensureStore(STORE_NAME, STORE_BASE_URL)`
3. Crear `ScrapeRun` con `status: 'running'`, `category: 'ram'`, `storeId`, `startedAt`
4. `urls = await discoverRamProductUrls()`
5. Si `urls.length === 0`: marcar run `failed`, `errorSummary: 'No product URLs discovered'`, return
6. Contadores: `productsFound = 0`, `errorsCount = 0`, `errorSamples: string[] = []`
7. Para cada `url` en `urls`:
   1. `html = await fetchHtml(url)`
   2. Si `html === null` → `errorsCount++`, log `warn`/`error`, **continue**
   3. `parsed = parseExtremeTechProductPage(url, html)`
   4. Si `parsed === null` → `errorsCount++`, log `warn`, **continue**
   5. `specs = extractRamSpecs(parsed.name)`
   6. Log `debug` o `info` con nombre + specs resumidas
   7. try `persistRamProduct(...)` catch → `errorsCount++`, log `error` con stack, **continue**
   8. Si ok → `productsFound++`
   9. **Siempre** `await delay(getDelayMs())` antes del siguiente request de producto (también después del último se puede omitir)
8. Determinar status final:
   - `success` si `errorsCount === 0` y `productsFound > 0`
   - `partial` si `productsFound > 0` y `errorsCount > 0`
   - `failed` si `productsFound === 0`
9. Update `ScrapeRun`: `status`, `productsFound`, `errorsCount`, `finishedAt`, `errorSummary` (primeros N mensajes unidos, max ~500–1000 chars)

**Regla de logging vs BD (obligatoria):**

- Detalle línea a línea, stacks, cada request → **solo Winston** (archivo/consola).
- Postgres `ScrapeRun` → **solo resumen** de la corrida.
- Nunca guardar logs verbose en otras tablas.

#### 1.7.2 — `packages/scraper/src/index.ts` (Fase 1 completo)

```typescript
import './load-env.js';
import { logger } from './logger.js';
import { runExtremeTechRamScrape } from './scrapers/extremetech/run-ram.js';
import { prisma } from '@hardware-scrapping/database';

async function main() {
  const category = process.argv[2] ?? 'ram';
  if (category !== 'ram') {
    logger.error('Categoría no soportada en Fase 1', { category });
    process.exitCode = 1;
    return;
  }

  try {
    await runExtremeTechRamScrape();
  } catch (err) {
    logger.error('Scrape abortado por error no controlado', { err });
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
```

Script ya definido: `pnpm --filter @hardware-scrapping/scraper scrape:ram`

- [ ] Orquestación completa con ScrapeRun running → terminal
- [ ] Errores por producto no detienen el lote
- [ ] Delay entre productos respetado
- [ ] `prisma.$disconnect()` en finally

---

### Tarea 1.8 — Manejo de errores (matriz)

| Situación | Nivel Winston | ¿Sigue el loop? | Contador |
|-----------|---------------|-----------------|----------|
| Red / timeout / fetch throw | `error` | sí | `errorsCount++` |
| HTTP 404/500 | `warn` | sí | `errorsCount++` |
| HTML sin nombre de producto | `warn` | sí | `errorsCount++` |
| Precio no parseable | `warn` | sí (persiste sin PriceHistory o según 1.6) | preferible `errorsCount++` o warning separado; Fase 1: contar en `errorsCount` |
| Selectores rotos (0 URLs en categoría) | `error` | no hay loop | run `failed` |
| Error Prisma inesperado | `error` + stack | sí | `errorsCount++` |
| Crash no capturado en main | `error` | proceso exit 1 | intentar marcar run failed si se tiene id |

- [ ] Matriz respetada en el código

---

### Tarea 1.9 — Verificación manual de datos

Tras un scrape exitoso o partial:

```bash
pnpm db:studio
```

O SQL vía Docker:

```bash
docker compose exec postgres psql -U hardware -d hardware_scrapping -c "SELECT id, \"canonicalName\", specs FROM \"Product\" LIMIT 10;"
docker compose exec postgres psql -U hardware -d hardware_scrapping -c "SELECT * FROM \"ScrapeRun\" ORDER BY id DESC LIMIT 3;"
docker compose exec postgres psql -U hardware -d hardware_scrapping -c "SELECT COUNT(*) FROM \"PriceHistory\";"
```

**Qué validar:**

1. Existe `Store` name = `ExtremeTech`.
2. Hay varios `Product` con `category = 'ram'` y `specs` JSON con keys `capacity_gb`, `ram_type`, `speed_mhz`, `is_kit`.
3. Al menos algunos `capacity_gb` / `ram_type` no nulos (depende de nombres del sitio).
4. `StoreListing` con URLs de ExtremeTech.
5. `PriceHistory` con precios > 0.
6. Último `ScrapeRun` con `status` `success` o `partial`, `finishedAt` no null.
7. **Segundo run:** no duplica products/listings; sí agrega más `PriceHistory`.

- [ ] Datos reales visibles en Prisma Studio o SQL
- [ ] Segundo run idempotente en Product/Listing

---

## Criterio de aceptación — Fase 1

Secuencia verificable:

```bash
# Precondiciones: Fase 0 completa, .env con email real del bot, docker up, migrate applied

pnpm --filter @hardware-scrapping/scraper scrape:ram
```

**Resultado exitoso observable:**

1. Logs Winston en consola (nivel debug/info en development) mostrando:
   - inicio de corrida
   - cantidad de URLs descubiertas
   - progreso por producto (nombre / specs o warnings)
   - cierre con status final
2. Archivos `packages/scraper/logs/combined.log` y, si hubo errores, entradas en `error.log`
3. En DB:
   - productos RAM reales de ExtremeTech
   - specs extraídas de forma razonable en la mayoría de nombres “estándar”
   - `ScrapeRun` final `success` o `partial`
4. Re-ejecutar el mismo comando no duplica `Product` ni `StoreListing`

**Checklist final Fase 1:**

- [ ] Inspección manual robots/sitemap/HTML hecha
- [ ] `extractRamSpecs` con kit = capacidad total
- [ ] Scrape manual vía `pnpm --filter @hardware-scrapping/scraper scrape:ram`
- [ ] Persistencia completa Store → Product → Listing → PriceHistory → ScrapeRun
- [ ] Rate limit ≥ 3s entre productos
- [ ] User-Agent con contacto real
- [ ] Sin `console.log`; solo Winston
- [ ] Detalle de logs fuera de Postgres; ScrapeRun solo resumen

---

## Apéndice A — Mapa de dependencias entre paquetes

```
@hardware-scrapping/shared-types    (sin deps workspace)
         ↑
         |───────────────┐
@hardware-scrapping/database       |
         ↑               ↑
@hardware-scrapping/api   @hardware-scrapping/scraper
```

- `scraper` **no** depende de `api`
- `api` **no** depende de `scraper`
- Solo `database` habla con Prisma schema

---

## Apéndice B — Convención de nombres npm scope

Todos los paquetes usan scope:

`@hardware-scrapping/<paquete>`

Root package name: `hardware-scrapping` (sin scope, `"private": true`).

---

## Apéndice C — Qué NO hacer en Fase 0–1

- No crear paquete `web` / Next.js
- No implementar JWT ni CRUD de User
- No programar cron ni colas (Bull, etc.)
- No scrapear otras tiendas ni categorías distintas de RAM
- No usar `console.log` en api/scraper
- No poner el schema Prisma dentro de `api`
- No omitir uniques al “simplificar” el schema
- No reducir el delay por debajo de 3000 ms

---

## Apéndice D — Orden de implementación recomendado (checklist maestro)

### Fase 0

- [ ] 0.1 Prerrequisitos
- [ ] 0.2 Archivos raíz (nvmrc, workspace, package.json, tsconfig.base, gitignore, env, prettier, eslint, README)
- [ ] 0.3 docker-compose.yml y Postgres up
- [ ] 0.4 packages/shared-types
- [ ] 0.5 packages/database + migrate
- [ ] 0.6 packages/api scaffold + /health
- [ ] 0.7 packages/scraper esqueleto
- [ ] 0.8 install + build + lint
- [ ] Criterio de aceptación Fase 0

### Fase 1

- [ ] 1.1 Inspección manual sitio + robots.txt
- [ ] 1.2 delay + constants
- [ ] 1.3 extractRamSpecs + EXTRACTORS
- [ ] 1.4 fetch + discover URLs
- [ ] 1.5 parse product page
- [ ] 1.6 persistencia upsert
- [ ] 1.7 orquestación run-ram + CLI
- [ ] 1.8 matriz de errores
- [ ] 1.9 verificación DB + segundo run
- [ ] Criterio de aceptación Fase 1

---

*Fin del plan Fase 0 y Fase 1.*
`)

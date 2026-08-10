Actúa como un arquitecto de software senior. Tu tarea es generar un archivo 
Markdown llamado PLAN.md que sirva como especificación técnica detallada para 
que modelos de IA más pequeños (con menos capacidad de razonamiento) puedan 
ejecutar tareas de desarrollo sin ambigüedad. No escribas código todavía — 
solo el plan. El plan debe cubrir ÚNICAMENTE Fase 0 y Fase 1 del proyecto 
(descritas abajo). No adelantes fases futuras.

## CONTEXTO DEL PROYECTO

Nombre: Comparador de precios de hardware (piloto: RAM en ExtremeTech CR)

Objetivo: Sistema que scrapea productos de RAM del sitio https://extremetechcr.com,
extrae sus especificaciones técnicas (capacidad, tipo, velocidad, si es kit),
las guarda en base de datos, y expone una API con filtros dinámicos para
que un frontend en Next.js muestre los resultados ordenables por precio.

Es un proyecto de aprendizaje personal, sin fines comerciales por ahora.
Se desarrolla por fases incrementales — este documento cubre SOLO Fase 0 y Fase 1.

## STACK TÉCNICO OBLIGATORIO

- Package manager: pnpm (con pnpm workspaces, monorepo)
- Lenguaje: TypeScript en TODOS los paquetes, sin excepción
- Backend API: Node.js + Express
- Scraper: Node.js + TypeScript, usando cheerio (el sitio es SSR/WooCommerce,
  confirmado que el HTML de producto viene renderizado en el servidor)
- Base de datos: PostgreSQL, corriendo vía Docker Compose en desarrollo
- ORM: Prisma
- Logging: Winston (NO usar console.log en ningún paquete backend)
- Frontend: Next.js con App Router (Fase 1 NO incluye frontend, solo backend
  y scraper — el frontend arranca en la Fase 3, no lo incluyas en este plan)
- Node version: usar la LTS activa más reciente, definir en .nvmrc

## ESTRUCTURA DE MONOREPO REQUERIDA

comparador-hardware/
├── packages/
│   ├── shared-types/    ← interfaces TS compartidas, sin dependencias de runtime
│   ├── api/              ← Express + TS + JWT + Winston + Prisma client
│   └── scraper/           ← worker de scraping + Winston + Prisma client
├── docker-compose.yml     ← solo Postgres por ahora
├── pnpm-workspace.yaml
├── .nvmrc
├── .gitignore
├── .env.example
└── README.md

(el paquete "web" con Next.js se crea en fase futura, NO lo incluyas ahora)

## DISEÑO DE ARQUITECTURA EXTENSIBLE POR CATEGORÍAS (obligatorio, no simplificar)

En shared-types debe existir un sistema de registro de categorías de producto,
pensado para que agregar una categoría nueva en el futuro (ej. GPU, PSU) NO
requiera modificar código existente, solo agregar archivos nuevos.

Debe incluir:
1. Un tipo CategorySlug (por ahora solo 'ram', pero el tipo debe declararse
   de forma que sea trivial extender con más valores después)
2. Una interfaz CategorySchema con: slug, displayName, y un arreglo de
   FilterDefinition (cada filtro tiene key, label, type: 'number'|'enum'|'range',
   y options opcional para type 'enum')
3. Un RAM_SCHEMA concreto con estos filtros exactos:
   - capacity_gb: enum, opciones ['8','16','32','64'], label "Capacidad"
   - ram_type: enum, opciones ['DDR4','DDR5'], label "Tipo"
   - speed_mhz: range, label "Velocidad (MHz)"
   - is_kit: enum, opciones ['true','false'], label "Kit (2x)"
4. Un CATEGORY_REGISTRY que mapea CategorySlug -> CategorySchema, 
   actualmente solo con 'ram'

En el paquete scraper debe existir el mismo patrón para extractores de specs:
1. Una función extractRamSpecs(productName: string) que devuelva un objeto
   con: capacity_gb (number|null), ram_type (string|null, formato "DDR4"/"DDR5"),
   speed_mhz (number|null), is_kit (boolean). Debe usar regex sobre el nombre
   del producto para extraer estos valores. Documentar los patrones regex
   esperados con al menos 3 ejemplos de nombres reales de producto de RAM
   (ej. "Kingston Fury Beast 16GB DDR4 3200MHz", "Corsair Vengeance 2x8GB DDR4 3600MHz")
   y qué debería extraer cada uno.
2. Un EXTRACTORS registry que mapea CategorySlug -> función extractora,
   actualmente solo con 'ram'

## SCHEMA DE BASE DE DATOS (Prisma) — usar EXACTAMENTE estos modelos

model Product {
  id            Int      @id @default(autoincrement())
  canonicalName String
  category      String
  brand         String?
  specs         Json
  createdAt     DateTime @default(now())
  listings      StoreListing[]
}

model Store {
  id       Int    @id @default(autoincrement())
  name     String
  baseUrl  String
  listings StoreListing[]
}

model StoreListing {
  id               Int      @id @default(autoincrement())
  productId        Int
  product          Product  @relation(fields: [productId], references: [id])
  storeId          Int
  store            Store    @relation(fields: [storeId], references: [id])
  storeProductName String
  url              String
  priceHistory     PriceHistory[]
}

model PriceHistory {
  id        Int      @id @default(autoincrement())
  listingId Int
  listing   StoreListing @relation(fields: [listingId], references: [id])
  price     Decimal
  inStock   Boolean
  scrapedAt DateTime @default(now())
}

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
  category      String
  status        String
  productsFound Int       @default(0)
  errorsCount   Int       @default(0)
  startedAt     DateTime
  finishedAt    DateTime?
  errorSummary  String?
}

(Fase 1 NO necesita User funcional todavía, solo que el modelo exista en el
schema desde el inicio para no tener que hacer una migración destructiva después)

## ESTRATEGIA DE LOGGING (obligatorio en api Y scraper)

Winston configurado con:
- Nivel 'debug' en desarrollo, 'info' en producción (via NODE_ENV)
- Transport a archivo: logs/error.log (solo nivel error) y logs/combined.log (todo)
- Transport a consola SOLO en desarrollo, formato simple
- Formato JSON con timestamp en los archivos

Regla de negocio clara que el .md debe documentar explícitamente:
- Logs detallados (debug, info, cada request, cada producto procesado, stack
  traces) van SOLO a Winston (archivo/consola), NUNCA a la base de datos
- La tabla ScrapeRun en Postgres es el ÚNICO lugar de la BD que registra
  actividad del scraper, y solo guarda el resumen ejecutable de cada corrida
  (status, cuántos productos encontró, cuándo empezó/terminó, resumen corto
  de error si falló) — NO el detalle línea por línea

## ALCANCE ESPECÍFICO DE FASE 0

Objetivo: dejar el monorepo funcionando, sin lógica de negocio todavía.

Debe incluir en el plan:
1. Comandos exactos para inicializar el monorepo con pnpm workspaces
2. Contenido completo de pnpm-workspace.yaml
3. Contenido completo de tsconfig.json base (raíz) y cómo cada paquete lo extiende
4. Contenido completo de docker-compose.yml con servicio de Postgres
   (definir nombre de imagen, puerto, variables de entorno, volumen persistente)
5. Contenido completo de .env.example con DATABASE_URL y JWT_SECRET como mínimo
6. Comandos para inicializar Prisma en el paquete api, y el schema.prisma
   completo con los modelos de arriba
7. Configuración de ESLint + Prettier compartida en la raíz
8. Contenido de .gitignore apropiado para monorepo Node/TS (node_modules,
   .env, dist, logs/, etc.)
9. Criterio de "Fase 0 completa": comando o secuencia de comandos que el
   usuario debe poder correr y qué debería ver como resultado exitoso
   (ej. "pnpm install sin errores" + "docker compose up levanta Postgres" +
   "pnpm prisma migrate dev crea las tablas sin error")

## ALCANCE ESPECÍFICO DE FASE 1

Objetivo: un scraper funcional de RAM en ExtremeTech que corre manualmente
(sin cron todavía) y guarda datos reales en la base de datos.

Debe incluir en el plan:
1. Estructura de carpetas dentro de packages/scraper (ej. src/extractors,
   src/scrapers, src/logger.ts, src/index.ts, etc.)
2. Detalle de cómo debe funcionar el scraper de ExtremeTech paso a paso:
   - Cómo descubrir URLs de productos de RAM (mencionar que debe revisarse
     el sitemap.xml de https://extremetechcr.com/sitemap.xml o la página
     de categoría de RAM del sitio — dejar instrucción de inspeccionar
     manualmente antes de codear)
   - Qué datos extraer de cada página de producto: nombre, precio, 
     disponibilidad/stock, URL
   - User-Agent obligatorio a usar, formato: "ComparadorHW-Bot/1.0 (contacto: 
     [email del usuario])" — dejar placeholder para que el usuario ponga su email
   - Rate limiting obligatorio: mínimo 3-5 segundos de espera entre requests
     a páginas de producto (usar una función de delay explícita en el código,
     no asumir que el usuario se acuerde de ponerla)
   - Manejo de errores: qué pasa si una página no carga, si el precio no
     se puede parsear, si la estructura HTML cambió (debe loggear con 
     Winston nivel 'warn' o 'error' según el caso, y continuar con el
     siguiente producto sin detener todo el scraper)
3. Cómo integrar extractRamSpecs() en el flujo: se aplica sobre el nombre
   del producto extraído, y el resultado se guarda en el campo specs (JSON)
   del modelo Product
4. Cómo se relaciona todo con Prisma: crear/actualizar Store (ExtremeTech),
   crear Product con specs, crear StoreListing, crear PriceHistory con el
   precio actual, y al final crear un registro ScrapeRun con el resumen
5. Un script de entrada (ej. pnpm --filter scraper run scrape:ram) que se
   pueda correr manualmente desde terminal
6. Criterio de "Fase 1 completa": el usuario corre el comando, ve logs de
   Winston en consola mostrando progreso, y al final puede abrir Prisma
   Studio (o una query simple) y ver productos reales de RAM de ExtremeTech
   guardados con specs correctamente extraídas, más un registro en ScrapeRun
   con status 'success' o 'partial'

## FORMATO DE SALIDA DEL PLAN.md

- Usa encabezados claros por fase y por sub-tarea (## Fase 0, ### Tarea 0.1, etc.)
- Cada tarea debe tener: descripción, comandos o código exacto cuando aplique,
  y un checkbox [ ] para poder marcarla como completada
- Al final de cada fase, una sección "Criterio de aceptación" con pasos
  verificables de que la fase está realmente terminada
- No omitas contenido de archivos de configuración por brevedad — este
  documento lo van a leer modelos de IA más pequeños que necesitan el
  contenido completo y exacto, no un resumen ni un "..." 
- Asume que quien ejecuta esto tiene experiencia previa en C#/.NET y 
  ASP.NET Core, pero es nuevo en el ecosistema de Node/TypeScript — evita
  dar por sentado configuraciones "obvias" del ecosistema JS

Genera el PLAN.md completo ahora.
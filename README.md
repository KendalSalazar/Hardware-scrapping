# Hardware Scrapping

Comparador de precios de hardware. El piloto actual recopila memorias RAM de
Faith Technology CR, guarda sus precios históricos en PostgreSQL y los expone
mediante una API REST y un frontend Next.js.

## Estado actual

- Fase 0: monorepo, Docker, PostgreSQL, Prisma y tooling.
- Fase 1: scraper real de RAM para Faith Technology.
- Fase 2: API Express con filtros dinámicos, paginación y detalle de productos.
- Fase 3: frontend Next.js con filtros, ordenamiento, paginación e historial.
- Fase 4: autenticación JWT, usuarios admin y API admin de solo lectura.
- Fase 5: login web, panel admin, scraping manual en background y progreso en vivo.
- Cron fue descartado; no hay scraping programado automático.
- Nuevas categorías, matching multi-tienda y deploy final todavía no están implementados.

## Requisitos

- Node.js 24 (`.nvmrc`)
- pnpm 10+
- Docker Desktop o Docker Engine con Compose

## Instalación

```bash
pnpm install
Copy-Item .env.example .env
docker compose up -d
pnpm db:migrate
```

En Linux/macOS, el segundo comando puede escribirse como:

```bash
cp .env.example .env
```

Revisar especialmente `DATABASE_URL`, `SCRAPER_CONTACT_EMAIL` y
`SCRAPER_USER_AGENT` antes de ejecutar el scraper.

## Ejecución

### API y frontend

Ejecutar en terminales separadas:

```bash
pnpm api:dev
pnpm web:dev
```

URLs principales:

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`
- Health check: `http://localhost:3001/health`

### Scraper

```bash
pnpm --filter @hardware-scrapping/scraper scrape:ram
```

El scraper descubre productos paginando la categoría RAM, descarga cada
página con `curl`, extrae nombre/precio/specs y persiste los datos. Respeta el
retraso configurado en `SCRAPER_DELAY_MS`.

Para recalcular specs usando los nombres ya guardados, sin consultar de nuevo
la tienda:

```bash
# Preview, no modifica la base
pnpm --filter @hardware-scrapping/scraper reextract:ram-specs

# Aplica los cambios
pnpm --filter @hardware-scrapping/scraper reextract:ram-specs -- --apply
```

## API actual

| Endpoint | Función |
|---|---|
| `GET /health` | Comprueba que la API y PostgreSQL estén disponibles |
| `GET /api/categories` | Lista categorías disponibles |
| `GET /api/categories/:slug/filters` | Devuelve filtros dinámicos de una categoría |
| `GET /api/products?category=ram` | Lista productos con precio actual más bajo |
| `GET /api/products/:id` | Detalle e historial de precios |
| `POST /api/auth/login` | Login y emisión de JWT de 8 horas |
| `GET /api/admin/scrape-runs` | Lista protegida de ejecuciones del scraper |
| `GET /api/admin/scrape-runs/:id` | Detalle protegido de una ejecución |
| `GET /api/admin/stats` | Estadísticas protegidas del sistema |
| `POST /api/admin/scrapers/run` | Dispara manualmente el scraper RAM (admin) |
| `POST /api/admin/scrapers/:id/stop` | Detiene una corrida RAM activa (admin) |

Ejemplos:

```bash
curl http://localhost:3001/api/categories
curl "http://localhost:3001/api/products?category=ram&capacity_gb=16&ram_type=DDR4"
curl http://localhost:3001/api/products/13
```

Filtros soportados actualmente:

- Enum: `capacity_gb`, `ram_type`, `is_kit`
- Rango: `speed_mhz_min`, `speed_mhz_max`
- Orden: `price_asc`, `price_desc`, `newest`
- Paginación: `page`, `pageSize` (máximo 100)

Los filtros se validan contra `CATEGORY_REGISTRY`. Los parámetros desconocidos
devuelven `400`.

## Admin API (Fase 4)

Las rutas `/api/admin/*` requieren un JWT de un usuario con `role=admin`.
No existe registro público: crear el primer administrador desde la raíz:

```bash
pnpm --filter @hardware-scrapping/api create-admin -- --email=admin@example.com --password=super-secret-password
```

Login:

```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"super-secret-password"}'
```

Usar el valor `token` recibido para consultar el panel administrativo vía API:

```bash
curl -s http://localhost:3001/api/admin/scrape-runs \
  -H "Authorization: Bearer TOKEN"

curl -s http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer TOKEN"
```

En producción, reemplazar el placeholder de `JWT_SECRET` por un valor aleatorio
largo. El API rechaza el placeholder exacto en `NODE_ENV=production`.

## Admin UI y disparo de scraper (Fase 5)

Ejecutar API y frontend en terminales separadas:

```bash
pnpm api:dev
pnpm web:dev
```

Luego abrir `http://localhost:3000/login`, ingresar con el usuario admin y
visitar `/admin`. El botón inicia el scraper en el servidor y actualiza el
progreso cada cuatro segundos mediante polling.

Características principales de Fase 5:

- La API crea el `ScrapeRun` y dispara el scraper como proceso hijo independiente.
- El proceso hijo recibe `--scrape-run-id` y reutiliza esa fila; no crea una corrida duplicada.
- El scraper actualiza `productsFound` y `errorsCount` después de cada producto.
- Solo se permite una corrida RAM reciente a la vez; un segundo disparo devuelve `409`.
- El botón **Detener scraping** termina la corrida activa y la marca como `failed` con
  `Stopped manually by admin`.
- Corridas `running` antiguas se conservan en el historial, pero no se muestran como
  activas ni bloquean una nueva corrida.
- Cerrar la pestaña no detiene el proceso del servidor; el progreso puede consultarse
  nuevamente desde `/admin`.

El comando CLI clásico sigue disponible y crea su propio `ScrapeRun`:

```bash
pnpm --filter @hardware-scrapping/scraper scrape:ram
```

El endpoint admin crea el `ScrapeRun` y pasa `--scrape-run-id` al proceso hijo;
el scraper reutiliza esa fila y no crea una segunda corrida.

Las corridas `running` antiguas se conservan en el historial, pero no se
consideran activas en la UI. Una corrida reciente puede detenerse con el botón
**Detener scraping**; queda marcada como `failed` con el resumen de detención.

El flujo CLI no requiere login ni la API y mantiene el comportamiento histórico:

```bash
pnpm --filter @hardware-scrapping/scraper scrape:ram
```

## Flujo de datos

```text
Faith Technology
        |
        v
packages/scraper
        |
        v
PostgreSQL / Prisma
        |
        v
packages/api
        |
        v
packages/web
```

El frontend obtiene los filtros desde la API, refleja la selección en la URL y
vuelve a consultar los productos con esos parámetros.

## Datos persistidos

- `Product`: producto normalizado y specs JSON.
- `Store`: tienda de origen.
- `StoreListing`: URL del producto en una tienda.
- `PriceHistory`: precio observado por corrida.
- `ScrapeRun`: resumen de cada ejecución del scraper.

Los precios se almacenan como `Decimal(12,2)` en CRC, pero la API los devuelve
como números enteros. `brand` es nullable y actualmente Faith Technology no
aporta marcas, por lo que suele ser `null`.

## Estructura del monorepo

```text
packages/
├── api/          API Express y servicios de consulta
├── database/     Prisma schema y cliente PostgreSQL
├── scraper/      Scraper y extractores de RAM
├── shared-types/ Registries y tipos compartidos
└── web/          Frontend Next.js
```

## Comandos de mantenimiento

```bash
pnpm build
pnpm lint
pnpm db:generate
pnpm db:migrate
pnpm db:studio
pnpm web:build
```

## Logs

Los logs del scraper se escriben en:

- `packages/scraper/logs/combined.log`
- `packages/scraper/logs/error.log`

La API y el scraper usan Winston. No se deben agregar `console.log` al código
de backend.

## Limitaciones conocidas

- Solo se scrapea Faith Technology.
- Solo existe la categoría RAM.
- La detección de stock todavía usa el valor definido por Fase 1.
- Los rangos de specs se filtran en memoria por el volumen actual de datos.
- No hay tareas programadas: cron fue descartado. El admin web dispara corridas
  manuales y muestra su progreso.
- La versión de Next usada por el scaffold es `15.2.4`; revisar avisos de
  seguridad antes de desplegar a producción.

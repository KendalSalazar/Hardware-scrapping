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

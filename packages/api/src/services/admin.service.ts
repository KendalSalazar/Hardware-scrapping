import { prisma } from '@hardware-scrapping/database';
import { ApiError, ErrorCodes } from '../errors/api-error.js';

export interface ScrapeRunDto {
  id: number;
  storeId: number;
  storeName: string;
  category: string;
  status: string;
  productsFound: number;
  errorsCount: number;
  startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
}

export interface ScrapeRunListResponse {
  page: number;
  pageSize: number;
  totalCount: number;
  runs: ScrapeRunDto[];
}

export interface AdminStatsResponse {
  productsCount: number;
  listingsCount: number;
  priceHistoryCount: number;
  scrapeRunsCount: number;
  scrapeRunsByStatus: Record<string, number>;
  lastRun: ScrapeRunDto | null;
}

export interface ListScrapeRunsQuery {
  page: number;
  pageSize: number;
  status?: string;
  from?: Date;
  to?: Date;
}

function toDto(run: {
  id: number;
  storeId: number;
  category: string;
  status: string;
  productsFound: number;
  errorsCount: number;
  startedAt: Date;
  finishedAt: Date | null;
  errorSummary: string | null;
  store: { name: string };
}): ScrapeRunDto {
  return {
    id: run.id,
    storeId: run.storeId,
    storeName: run.store.name,
    category: run.category,
    status: run.status,
    productsFound: run.productsFound,
    errorsCount: run.errorsCount,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    errorSummary: run.errorSummary,
  };
}

export async function listScrapeRuns(
  query: ListScrapeRunsQuery,
): Promise<ScrapeRunListResponse> {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          startedAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  const [totalCount, rows] = await Promise.all([
    prisma.scrapeRun.count({ where }),
    prisma.scrapeRun.findMany({
      where,
      include: { store: true },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    page: query.page,
    pageSize: query.pageSize,
    totalCount,
    runs: rows.map(toDto),
  };
}

export async function getScrapeRunById(id: number): Promise<ScrapeRunDto> {
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid scrape run id');
  }

  const run = await prisma.scrapeRun.findUnique({
    where: { id },
    include: { store: true },
  });

  if (!run) {
    throw new ApiError(
      404,
      ErrorCodes.SCRAPE_RUN_NOT_FOUND,
      `ScrapeRun with id ${id} not found`,
    );
  }

  return toDto(run);
}

export async function getAdminStats(): Promise<AdminStatsResponse> {
  const [
    productsCount,
    listingsCount,
    priceHistoryCount,
    scrapeRunsCount,
    grouped,
    last,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.storeListing.count(),
    prisma.priceHistory.count(),
    prisma.scrapeRun.count(),
    prisma.scrapeRun.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.scrapeRun.findFirst({
      include: { store: true },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    }),
  ]);

  const scrapeRunsByStatus: Record<string, number> = {};
  for (const row of grouped) {
    scrapeRunsByStatus[row.status] = row._count._all;
  }

  return {
    productsCount,
    listingsCount,
    priceHistoryCount,
    scrapeRunsCount,
    scrapeRunsByStatus,
    lastRun: last ? toDto(last) : null,
  };
}

import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { prisma } from '@hardware-scrapping/database';
import { ApiError, ErrorCodes } from '../errors/api-error.js';
import { logger } from '../logger.js';
import { safeErrorDetails } from '../utils/safe-error.js';
import type { ScrapeRunDto } from './admin.service.js';

const CATEGORY = 'ram';
const STORE_NAME = 'Faith Technology';
const STORE_BASE_URL = 'https://faithtechnologycr.com';

/** Runs older than this are stale and do not block a new manual run. */
export const RUNNING_STALE_MS = 3 * 60 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONOREPO_ROOT = path.resolve(__dirname, '../../../../');
const SCRAPER_PACKAGE_DIR = path.join(MONOREPO_ROOT, 'packages', 'scraper');
const activeChildren = new Map<number, ChildProcess>();

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

async function ensureFaithStore() {
  return prisma.store.upsert({
    where: { name: STORE_NAME },
    create: { name: STORE_NAME, baseUrl: STORE_BASE_URL },
    update: { baseUrl: STORE_BASE_URL },
  });
}

export async function findActiveScrapeRun(category = CATEGORY) {
  const minStartedAt = new Date(Date.now() - RUNNING_STALE_MS);
  return prisma.scrapeRun.findFirst({
    where: {
      category,
      status: 'running',
      finishedAt: null,
      startedAt: { gte: minStartedAt },
    },
    include: { store: true },
    orderBy: { startedAt: 'desc' },
  });
}

async function markRunFailed(runId: number, errorSummary: string): Promise<void> {
  await prisma.scrapeRun.updateMany({
    where: { id: runId, status: 'running' },
    data: {
      status: 'failed',
      finishedAt: new Date(),
      errorSummary: errorSummary.slice(0, 800),
    },
  });
}

function resolveTsxCliPath(): string | undefined {
  const require = createRequire(path.join(SCRAPER_PACKAGE_DIR, 'package.json'));

  try {
    const packageJson = require.resolve('tsx/package.json');
    const tsxRoot = path.dirname(packageJson);
    const candidates = [
      path.join(tsxRoot, 'dist', 'cli.mjs'),
      path.join(tsxRoot, 'dist', 'cli.js'),
    ];
    const cli = candidates.find((candidate) => fs.existsSync(candidate));
    if (cli) return cli;
  } catch (error) {
    logger.warn('Could not resolve tsx directly; using pnpm exec tsx fallback', {
      error: safeErrorDetails(error),
    });
  }

  return undefined;
}

function spawnScraperProcess(scrapeRunId: number): void {
  const tsxCli = resolveTsxCliPath();
  const scraperArgs = ['src/index.ts', 'ram', `--scrape-run-id=${scrapeRunId}`];
  const command = tsxCli ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const args = tsxCli ? [tsxCli, ...scraperArgs] : ['exec', 'tsx', ...scraperArgs];

  logger.info('Spawning scraper child process', {
    scrapeRunId,
    cwd: SCRAPER_PACKAGE_DIR,
    command,
    args,
  });

  const child = spawn(command, args, {
    cwd: SCRAPER_PACKAGE_DIR,
    env: { ...process.env },
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  activeChildren.set(scrapeRunId, child);

  child.on('error', (error) => {
    activeChildren.delete(scrapeRunId);
    logger.error('Scraper child process failed to start', {
      scrapeRunId,
      error: safeErrorDetails(error),
    });
    void markRunFailed(
      scrapeRunId,
      `Failed to start scraper process: ${error instanceof Error ? error.message : 'unknown error'}`,
    ).catch((markError) => {
      logger.error('Failed to mark spawn error', {
        scrapeRunId,
        error: safeErrorDetails(markError),
      });
    });
  });

  child.on('exit', (code, signal) => {
    activeChildren.delete(scrapeRunId);
    logger.info('Scraper child process exited', { scrapeRunId, code, signal });
    void (async () => {
      try {
        const run = await prisma.scrapeRun.findUnique({ where: { id: scrapeRunId } });
        if (run?.status === 'running') {
          await markRunFailed(
            scrapeRunId,
            `Scraper process exited while still running (code=${code ?? 'null'}, signal=${signal ?? 'null'})`,
          );
        }
      } catch (error) {
        logger.error('Failed to apply scraper exit safety net', {
          scrapeRunId,
          error: safeErrorDetails(error),
        });
      }
    })();
  });

  child.unref();
}

export interface StartScrapeResult {
  run: ScrapeRunDto;
}

export async function startRamScrape(): Promise<StartScrapeResult> {
  const active = await findActiveScrapeRun();
  if (active) {
    throw new ApiError(
      409,
      ErrorCodes.SCRAPE_ALREADY_RUNNING,
      `A scrape run is already in progress (id=${active.id}, startedAt=${active.startedAt.toISOString()})`,
    );
  }

  const store = await ensureFaithStore();
  const created = await prisma.scrapeRun.create({
    data: {
      storeId: store.id,
      category: CATEGORY,
      status: 'running',
      productsFound: 0,
      errorsCount: 0,
      startedAt: new Date(),
    },
    include: { store: true },
  });

  try {
    spawnScraperProcess(created.id);
  } catch (error) {
    await markRunFailed(
      created.id,
      `Failed to spawn scraper: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    logger.error('Synchronous spawn failure', {
      scrapeRunId: created.id,
      error: safeErrorDetails(error),
    });
    throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, 'Failed to start scraper process');
  }

  logger.info('Scrape run started via API service', {
    scrapeRunId: created.id,
    category: CATEGORY,
    storeId: store.id,
  });

  return { run: toDto(created) };
}

function terminateChild(child: ChildProcess): Promise<void> {
  if (!child.pid) return Promise.resolve();

  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => resolve());
    });
  }

  child.kill('SIGTERM');
  return Promise.resolve();
}

/** Detiene una corrida reciente iniciada por esta instancia de la API. */
export async function stopRamScrape(scrapeRunId: number): Promise<StartScrapeResult> {
  const run = await prisma.scrapeRun.findUnique({
    where: { id: scrapeRunId },
    include: { store: true },
  });

  if (!run) {
    throw new ApiError(
      404,
      ErrorCodes.SCRAPE_RUN_NOT_FOUND,
      `ScrapeRun with id ${scrapeRunId} not found`,
    );
  }

  const hadActiveChild = Boolean(activeChildren.get(scrapeRunId));
  if (run.status === 'running') {
    const child = activeChildren.get(scrapeRunId);
    if (child) {
      await terminateChild(child);
      activeChildren.delete(scrapeRunId);
    }

    await markRunFailed(scrapeRunId, 'Stopped manually by admin');
  }

  const updated = await prisma.scrapeRun.findUniqueOrThrow({
    where: { id: scrapeRunId },
    include: { store: true },
  });

  logger.info('Scrape run stopped by admin', {
    scrapeRunId,
    hadActiveChild,
  });

  return { run: toDto(updated) };
}

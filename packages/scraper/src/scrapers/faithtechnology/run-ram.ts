import { prisma } from '@hardware-scrapping/database';
import { extractRamSpecs } from '../../extractors/ram.js';
import { delay } from '../../lib/delay.js';
import { fetchHtml } from '../../lib/fetch-html.js';
import { logger } from '../../logger.js';
import { ensureStore, persistRamProduct } from '../../persistence/upsert-product.js';
import { getDelayMs, STORE_BASE_URL, STORE_NAME } from './constants.js';
import { discoverRamProducts } from './discover.js';
import { parseFaithTechnologyProductPage } from './parse-product.js';

const CATEGORY = 'ram';
const MAX_ERROR_SUMMARY_LENGTH = 800;

function summarizeErrors(errors: string[]): string | null {
  if (errors.length === 0) {
    return null;
  }

  return errors.join(' | ').slice(0, MAX_ERROR_SUMMARY_LENGTH);
}

export interface RunRamOptions {
  /** API-created run to reuse; omitted for the legacy CLI flow. */
  scrapeRunId?: number;
}

export async function runFaithTechnologyRamScrape(
  options: RunRamOptions = {},
): Promise<void> {
  const store = await ensureStore(STORE_NAME, STORE_BASE_URL);
  const run = options.scrapeRunId
    ? await prisma.scrapeRun.findUnique({ where: { id: options.scrapeRunId } })
    : await prisma.scrapeRun.create({
        data: {
          storeId: store.id,
          category: CATEGORY,
          status: 'running',
          startedAt: new Date(),
        },
      });

  if (!run) {
    throw new Error(`ScrapeRun ${options.scrapeRunId} not found`);
  }

  if (options.scrapeRunId !== undefined && run.status !== 'running') {
    throw new Error(
      `ScrapeRun ${options.scrapeRunId} is not in running status (got ${run.status})`,
    );
  }

  const runId = run.id;

  if (options.scrapeRunId !== undefined) {
    await prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        storeId: store.id,
        category: CATEGORY,
      },
    });
    logger.info('Reutilizando ScrapeRun creado por la API', { scrapeRunId: runId });
  } else {
    logger.info('ScrapeRun creado por CLI', { scrapeRunId: runId });
  }

  let productsFound = 0;
  let errorsCount = 0;
  const errorSamples: string[] = [];

  async function reportProgress(): Promise<void> {
    await prisma.scrapeRun.update({
      where: { id: runId },
      data: { productsFound, errorsCount },
    });
  }

  try {
    logger.info('Inicio de corrida de scraper RAM', { scrapeRunId: runId });
    const products = await discoverRamProducts();

    if (products.length === 0) {
      await prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorSummary: 'No product URLs discovered',
        },
      });
      logger.error('No se descubrieron productos RAM', { scrapeRunId: runId });
      return;
    }

    for (const discovered of products) {
      try {
        const html = await fetchHtml(discovered.url);
        if (html === null) {
          errorsCount += 1;
          errorSamples.push(`fetch: ${discovered.url}`);
          continue;
        }

        const parsed = parseFaithTechnologyProductPage(discovered.url, html);
        if (parsed === null) {
          errorsCount += 1;
          errorSamples.push(`parse: ${discovered.url}`);
          continue;
        }

        const specs = extractRamSpecs(parsed.name);
        logger.info('Producto RAM procesado', {
          url: parsed.url,
          name: parsed.name,
          price: parsed.price,
          brand: parsed.brand,
          specs,
        });

        const result = await persistRamProduct({
          storeId: store.id,
          parsed,
          specs,
        });
        productsFound += 1;

        if (result === 'skipped_no_price') {
          errorsCount += 1;
          errorSamples.push(`price: ${discovered.url}`);
        }
      } catch (error) {
        errorsCount += 1;
        errorSamples.push(`persist: ${discovered.url}`);
        logger.error('Error procesando producto; se continúa con el siguiente', {
          url: discovered.url,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        try {
          await reportProgress();
        } catch (progressError) {
          logger.warn('No se pudo persistir progreso de ScrapeRun', {
            scrapeRunId: runId,
            message:
              progressError instanceof Error ? progressError.message : String(progressError),
          });
        }
        await delay(getDelayMs());
      }
    }

    const status =
      productsFound === 0 ? 'failed' : errorsCount === 0 ? 'success' : 'partial';

    await prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        status,
        productsFound,
        errorsCount,
        finishedAt: new Date(),
        errorSummary: summarizeErrors(errorSamples),
      },
    });

    logger.info('Corrida de scraper RAM finalizada', {
      scrapeRunId: runId,
      status,
      productsFound,
      errorsCount,
    });
  } catch (error) {
    logger.error('Error no controlado durante la corrida RAM', {
      scrapeRunId: runId,
      message: error instanceof Error ? error.message : String(error),
    });
    await prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        productsFound,
        errorsCount: errorsCount + 1,
        finishedAt: new Date(),
        errorSummary: 'Unhandled scraper error',
      },
    });
  }
}

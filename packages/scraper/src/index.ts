import './load-env.js';
import { prisma } from '@hardware-scrapping/database';
import { logger } from './logger.js';
import { runFaithTechnologyRamScrape } from './scrapers/faithtechnology/run-ram.js';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit?.slice(prefix.length);
}

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const category = positional[0] ?? 'ram';
const scrapeRunIdRaw = readArg('scrape-run-id');
const scrapeRunId =
  scrapeRunIdRaw !== undefined && /^\d+$/.test(scrapeRunIdRaw)
    ? Number(scrapeRunIdRaw)
    : undefined;

async function main(): Promise<void> {
  if (category !== 'ram') {
    logger.error('Categoría no soportada', { category });
    process.exitCode = 1;
    return;
  }

  if (scrapeRunIdRaw !== undefined && scrapeRunId === undefined) {
    logger.error('Invalid --scrape-run-id value', { scrapeRunIdRaw });
    process.exitCode = 1;
    return;
  }

  try {
    await runFaithTechnologyRamScrape({ scrapeRunId });
  } catch (error) {
    logger.error('Scrape abortado por error no controlado', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();

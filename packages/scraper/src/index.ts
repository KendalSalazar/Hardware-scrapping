import './load-env.js';
import { prisma } from '@hardware-scrapping/database';
import { logger } from './logger.js';
import { runFaithTechnologyRamScrape } from './scrapers/faithtechnology/run-ram.js';

const category = process.argv[2] ?? 'ram';

async function main(): Promise<void> {
  if (category !== 'ram') {
    logger.error('Categoría no soportada en Fase 1', { category });
    process.exitCode = 1;
    return;
  }

  try {
    await runFaithTechnologyRamScrape();
  } catch (error) {
    logger.error('Scrape abortado por error no controlado', { error });
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();

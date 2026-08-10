import './load-env.js';
import { logger } from './logger.js';

const category = process.argv[2] ?? 'ram';
logger.info('Scraper scaffold OK (Fase 0). Implementación real en Fase 1.', {
  category,
});

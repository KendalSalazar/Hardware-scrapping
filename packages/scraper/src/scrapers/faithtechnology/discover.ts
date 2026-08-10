import * as cheerio from 'cheerio';
import { delay } from '../../lib/delay.js';
import { fetchHtml } from '../../lib/fetch-html.js';
import { logger } from '../../logger.js';
import {
  getCategoryPageUrl,
  getDelayMs,
  PRODUCT_LINK_SELECTOR,
  STORE_BASE_URL,
} from './constants.js';

export interface DiscoveredRamProduct {
  url: string;
}

export async function discoverRamProducts(): Promise<DiscoveredRamProduct[]> {
  const products = new Map<string, DiscoveredRamProduct>();
  let page = 1;

  while (true) {
    const pageUrl = getCategoryPageUrl(page);
    const html = await fetchHtml(pageUrl);
    if (html === null) {
      logger.info('Fin de paginación por respuesta no disponible', { page, pageUrl });
      break;
    }

    const $ = cheerio.load(html);
    const links = $(PRODUCT_LINK_SELECTOR);
    if (links.length === 0) {
      logger.info('Fin de paginación por página sin productos', { page, pageUrl });
      break;
    }

    links.each((_, element) => {
      const href = $(element).attr('href');
      if (!href) {
        return;
      }

      const url = new URL(href, STORE_BASE_URL).href;
      if (!products.has(url)) {
        products.set(url, { url });
      }
    });

    page += 1;
    await delay(getDelayMs());
  }

  const result = [...products.values()];
  logger.info('URLs de productos RAM descubiertas', { count: result.length });
  return result;
}

export async function discoverRamProductUrls(): Promise<string[]> {
  const products = await discoverRamProducts();
  return products.map(({ url }) => url);
}

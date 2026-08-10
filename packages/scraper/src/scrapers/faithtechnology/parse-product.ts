import * as cheerio from 'cheerio';
import { logger } from '../../logger.js';
import {
  PRICE_SELECTOR,
  PRODUCT_NAME_SELECTOR,
} from './constants.js';

export interface ParsedProductPage {
  url: string;
  name: string;
  price: number | null;
  brand: string | null;
}

interface ParsedPrice {
  price: number | null;
  rawPrice: string;
}

function parsePrice($: cheerio.CheerioAPI): ParsedPrice {
  const amount = $(PRICE_SELECTOR).first().clone();
  amount.find('small').remove();
  const rawPrice = amount.text().trim();
  const digitsOnly = (rawPrice.match(/\d+/g) ?? []).join('');

  if (!digitsOnly) {
    return { price: null, rawPrice };
  }

  const price = Number(digitsOnly);
  return {
    price: Number.isFinite(price) ? price : null,
    rawPrice,
  };
}

export function parseFaithTechnologyProductPage(
  url: string,
  html: string,
): ParsedProductPage | null {
  try {
    const $ = cheerio.load(html);
    const name = $(PRODUCT_NAME_SELECTOR).first().text().replace(/\s+/g, ' ').trim();

    if (!name) {
      logger.warn('Página sin nombre de producto', { url });
      return null;
    }

    const parsedPrice = parsePrice($);
    if (parsedPrice.price === null) {
      logger.warn('Precio no parseable en página de producto', {
        url,
        name,
        rawPrice: parsedPrice.rawPrice,
      });
    }

    return { url, name, price: parsedPrice.price, brand: null };
  } catch (error) {
    logger.error('Error parseando página de producto', { url, error });
    return null;
  }
}

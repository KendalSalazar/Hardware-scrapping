export const STORE_NAME = 'Faith Technology';
export const STORE_BASE_URL = 'https://faithtechnologycr.com';
export const RAM_CATEGORY_URL =
  'https://faithtechnologycr.com/categoria-producto/almacenamiento/memorias-ram-para-pc/';

export const PRODUCT_LINK_SELECTOR = 'h3.wd-entities-title a';
export const PRODUCT_NAME_SELECTOR = 'h1.product_title.entry-title.wd-entities-title';
// Avoids the zero-valued placeholder span included before the product price.
export const PRICE_SELECTOR = 'p.price';

export function getCategoryPageUrl(page: number): string {
  return page === 1 ? RAM_CATEGORY_URL : `${RAM_CATEGORY_URL}page/${page}/`;
}

export function getScraperHeaders(): Record<string, string> {
  const ua =
    process.env.SCRAPER_USER_AGENT ??
    'ComparadorHW-Bot/1.0 (contacto: missing-email@example.com)';

  return {
    'User-Agent': ua,
    'Accept-Language': 'es-CR,es;q=0.9,en;q=0.8',
    Accept: 'text/html,application/xhtml+xml',
  };
}

export function getDelayMs(): number {
  const delayMs = Number(process.env.SCRAPER_DELAY_MS ?? 4000);
  return Number.isFinite(delayMs) && delayMs >= 3000 ? delayMs : 4000;
}

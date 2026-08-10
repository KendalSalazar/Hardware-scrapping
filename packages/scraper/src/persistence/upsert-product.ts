import { prisma } from '@hardware-scrapping/database';
import type { RamSpecs } from '@hardware-scrapping/shared-types';
import type { ParsedProductPage } from '../scrapers/faithtechnology/parse-product.js';

export async function ensureStore(name: string, baseUrl: string) {
  return prisma.store.upsert({
    where: { name },
    create: { name, baseUrl },
    update: { baseUrl },
  });
}

export async function persistRamProduct(params: {
  storeId: number;
  parsed: ParsedProductPage;
  specs: RamSpecs;
}): Promise<'ok' | 'skipped_no_price'> {
  const { storeId, parsed, specs } = params;
  const canonicalName = parsed.name.trim();
  const specsJson = { ...specs };

  const product = await prisma.product.upsert({
    where: {
      canonicalName_category: {
        canonicalName,
        category: 'ram',
      },
    },
    create: {
      canonicalName,
      category: 'ram',
      brand: parsed.brand,
      specs: specsJson,
    },
    update: {
      brand: parsed.brand,
      specs: specsJson,
    },
  });

  const listing = await prisma.storeListing.upsert({
    where: {
      storeId_url: {
        storeId,
        url: parsed.url,
      },
    },
    create: {
      productId: product.id,
      storeId,
      storeProductName: canonicalName,
      url: parsed.url,
    },
    update: {
      productId: product.id,
      storeProductName: canonicalName,
    },
  });

  if (parsed.price === null) {
    return 'skipped_no_price';
  }

  await prisma.priceHistory.create({
    data: {
      listingId: listing.id,
      price: parsed.price,
      // Stock detection is intentionally out of scope for this phase.
      inStock: true,
    },
  });

  return 'ok';
}

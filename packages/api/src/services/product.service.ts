import { prisma } from '@hardware-scrapping/database';
import { ApiError, ErrorCodes } from '../errors/api-error.js';
import { toCrcNumber } from '../utils/money.js';
import type {
  NormalizedEnumFilter,
  NormalizedRangeFilter,
  ValidatedProductQuery,
} from '../validators/product-query.validator.js';

export interface LowestPriceDto {
  price: number;
  storeName: string;
  scrapedAt: string;
  url: string;
}

export interface ProductListItemDto {
  id: number;
  canonicalName: string;
  brand: string | null;
  specs: Record<string, unknown>;
  lowestPrice: LowestPriceDto;
}

export interface ProductListResponseDto {
  category: string;
  page: number;
  pageSize: number;
  totalCount: number;
  products: ProductListItemDto[];
}

export interface PriceHistoryPointDto {
  price: number;
  inStock: boolean;
  scrapedAt: string;
}

export interface ProductListingDto {
  storeId: number;
  storeName: string;
  url: string;
  priceHistory: PriceHistoryPointDto[];
}

export interface ProductDetailDto {
  id: number;
  canonicalName: string;
  category: string;
  brand: string | null;
  specs: Record<string, unknown>;
  listings: ProductListingDto[];
}

function enumCondition(filter: NormalizedEnumFilter) {
  const conditions = filter.values.map((value) => ({
    specs: { path: [filter.key], equals: value },
  }));
  return conditions.length === 1 ? conditions[0]! : { OR: conditions };
}

function currentPriceSort(a: LowestPriceDto, b: LowestPriceDto): number {
  return a.price - b.price || a.storeName.localeCompare(b.storeName) || a.url.localeCompare(b.url);
}

export async function listProducts(
  validated: ValidatedProductQuery,
): Promise<ProductListResponseDto> {
  const enumFilters = validated.filters.filter(
    (filter): filter is NormalizedEnumFilter => filter.kind === 'enum',
  );
  const rangeFilters = validated.filters.filter(
    (filter): filter is NormalizedRangeFilter => filter.kind === 'range',
  );

  const productWhere = {
    category: validated.category,
    AND: enumFilters.map(enumCondition),
  };

  const products = await prisma.product.findMany({
    where: productWhere,
    include: {
      listings: {
        include: {
          store: true,
          priceHistory: {
            orderBy: [{ scrapedAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
      },
    },
  });

  const items: Array<{ item: ProductListItemDto; createdAt: Date }> = [];
  for (const product of products) {
    // Prisma 6 no admite gte/lte sobre un JSON path en el filtro tipado.
    // Por eso usamos el plan B documentado: aplicamos los ranges en memoria
    // después de reducir candidatos por categoría y filtros enum. Es correcto
    // para el volumen actual (~65 productos); a mayor escala debe migrarse a SQL.
    const specs = product.specs as Record<string, unknown>;
    const matchesRanges = rangeFilters.every((filter) => {
      const value = specs[filter.key];
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      if (filter.min !== undefined && value < filter.min) return false;
      if (filter.max !== undefined && value > filter.max) return false;
      return true;
    });
    if (!matchesRanges) continue;

    const currentPrices: LowestPriceDto[] = [];
    for (const listing of product.listings) {
      const latest = listing.priceHistory[0];
      if (!latest) continue;
      currentPrices.push({
        price: toCrcNumber(latest.price),
        storeName: listing.store.name,
        scrapedAt: latest.scrapedAt.toISOString(),
        url: listing.url,
      });
    }
    if (currentPrices.length === 0) continue;

    currentPrices.sort(currentPriceSort);
    items.push({
      item: {
        id: product.id,
        canonicalName: product.canonicalName,
        brand: product.brand,
        specs,
        lowestPrice: currentPrices[0]!,
      },
      createdAt: product.createdAt,
    });
  }

  items.sort((a, b) => {
    if (validated.sort === 'newest') {
      return b.createdAt.getTime() - a.createdAt.getTime() || b.item.id - a.item.id;
    }
    const priceOrder = a.item.lowestPrice.price - b.item.lowestPrice.price;
    const order = validated.sort === 'price_desc' ? -priceOrder : priceOrder;
    return order || a.item.id - b.item.id;
  });

  const totalCount = items.length;
  const start = (validated.page - 1) * validated.pageSize;
  return {
    category: validated.category,
    page: validated.page,
    pageSize: validated.pageSize,
    totalCount,
    products: items.slice(start, start + validated.pageSize).map(({ item }) => item),
  };
}

export async function getProductById(id: number): Promise<ProductDetailDto> {
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid product id');
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      listings: {
        include: {
          store: true,
          priceHistory: {
            orderBy: [{ scrapedAt: 'desc' }, { id: 'desc' }],
          },
        },
      },
    },
  });

  if (!product) {
    throw new ApiError(404, ErrorCodes.PRODUCT_NOT_FOUND, `Product with id ${id} not found`);
  }

  return {
    id: product.id,
    canonicalName: product.canonicalName,
    category: product.category,
    brand: product.brand,
    specs: product.specs as Record<string, unknown>,
    listings: product.listings.map((listing) => ({
      storeId: listing.storeId,
      storeName: listing.store.name,
      url: listing.url,
      priceHistory: listing.priceHistory.map((priceHistory) => ({
        price: toCrcNumber(priceHistory.price),
        inStock: priceHistory.inStock,
        scrapedAt: priceHistory.scrapedAt.toISOString(),
      })),
    })),
  };
}

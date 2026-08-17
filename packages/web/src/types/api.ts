/**
 * DTOs espejo del contrato real de packages/api (Fase 2).
 * No importamos desde @hardware-scrapping/api para no acoplar capas.
 */
export interface CategoryListItem {
  slug: string;
  displayName: string;
}

export interface CategoriesResponse {
  categories: CategoryListItem[];
}

export type FilterTypeDto = 'number' | 'enum' | 'range';

export interface FilterDefinitionDto {
  key: string;
  label: string;
  type: FilterTypeDto;
  options?: string[];
  min?: number;
  max?: number;
}

export interface CategoryFiltersResponse {
  slug: string;
  displayName: string;
  filters: FilterDefinitionDto[];
}

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

export interface ApiErrorBody {
  error: {
    message: string;
    code: string;
  };
}

export type ProductSort = 'price_asc' | 'price_desc' | 'newest';

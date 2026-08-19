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

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  token: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
}

export interface ScrapeRunDto {
  id: number;
  storeId: number;
  storeName: string;
  category: string;
  status: string;
  productsFound: number;
  errorsCount: number;
  startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
}

export interface ScrapeRunListResponseDto {
  page: number;
  pageSize: number;
  totalCount: number;
  runs: ScrapeRunDto[];
}

export interface AdminStatsDto {
  productsCount: number;
  listingsCount: number;
  priceHistoryCount: number;
  scrapeRunsCount: number;
  scrapeRunsByStatus: Record<string, number>;
  lastRun: ScrapeRunDto | null;
}

export interface StartScrapeResponseDto {
  run: ScrapeRunDto;
}

export type ProductSort = 'price_asc' | 'price_desc' | 'newest';

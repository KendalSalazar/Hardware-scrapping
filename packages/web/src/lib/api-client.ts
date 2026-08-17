import type {
  ApiErrorBody,
  CategoriesResponse,
  CategoryFiltersResponse,
  ProductDetailDto,
  ProductListResponseDto,
} from '@/types/api';
import { getApiBaseUrl } from './search-params';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let code = 'INTERNAL_ERROR';
    let message = `API request failed (${response.status})`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (body?.error?.message) message = body.error.message;
      if (body?.error?.code) code = body.error.code;
    } catch {
      // La API puede devolver un body no JSON en un error de infraestructura.
    }
    throw new ApiClientError(response.status, code, message);
  }

  return (await response.json()) as T;
}

export function fetchCategories(): Promise<CategoriesResponse> {
  return apiFetch<CategoriesResponse>('/api/categories');
}

export function fetchCategoryFilters(slug: string): Promise<CategoryFiltersResponse> {
  return apiFetch<CategoryFiltersResponse>(
    `/api/categories/${encodeURIComponent(slug)}/filters`,
  );
}

export function fetchProducts(queryString: string): Promise<ProductListResponseDto> {
  const query = queryString.startsWith('?') ? queryString : `?${queryString}`;
  return apiFetch<ProductListResponseDto>(`/api/products${query}`);
}

export function fetchProductById(id: number): Promise<ProductDetailDto> {
  return apiFetch<ProductDetailDto>(`/api/products/${id}`);
}

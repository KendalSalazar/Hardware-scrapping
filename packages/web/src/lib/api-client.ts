import type {
  AdminStatsDto,
  ApiErrorBody,
  CategoriesResponse,
  CategoryFiltersResponse,
  LoginRequestDto,
  LoginResponseDto,
  ProductDetailDto,
  ProductListResponseDto,
  ScrapeRunDto,
  ScrapeRunListResponseDto,
  StartScrapeResponseDto,
} from '@/types/api';
import { getToken } from './auth-storage';
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

type ApiFetchOptions = RequestInit & { auth?: boolean };

async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');

  if (init?.auth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const requestInit: RequestInit = { ...init };
  delete (requestInit as ApiFetchOptions).auth;
  const response = await fetch(url, {
    ...requestInit,
    headers,
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

export function loginRequest(body: LoginRequestDto): Promise<LoginResponseDto> {
  return apiFetch<LoginResponseDto>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchAdminStats(): Promise<AdminStatsDto> {
  return apiFetch<AdminStatsDto>('/api/admin/stats', { auth: true });
}

export function fetchScrapeRuns(query = 'page=1&pageSize=20'): Promise<ScrapeRunListResponseDto> {
  const normalizedQuery = query.startsWith('?') ? query : `?${query}`;
  return apiFetch<ScrapeRunListResponseDto>(`/api/admin/scrape-runs${normalizedQuery}`, {
    auth: true,
  });
}

export function fetchScrapeRunById(id: number): Promise<ScrapeRunDto> {
  return apiFetch<ScrapeRunDto>(`/api/admin/scrape-runs/${id}`, { auth: true });
}

export function startRamScrape(): Promise<StartScrapeResponseDto> {
  return apiFetch<StartScrapeResponseDto>('/api/admin/scrapers/run', {
    method: 'POST',
    auth: true,
  });
}

export function stopRamScrape(id: number): Promise<StartScrapeResponseDto> {
  return apiFetch<StartScrapeResponseDto>(`/api/admin/scrapers/${id}/stop`, {
    method: 'POST',
    auth: true,
  });
}

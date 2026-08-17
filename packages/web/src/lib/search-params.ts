import type { ProductSort } from '@/types/api';

const CONTROL_KEYS = new Set(['sort', 'page', 'pageSize']);

export function getApiBaseUrl(): string {
  const url =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3001';
  return url.replace(/\/$/, '');
}

export function buildProductsQuery(
  category: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  params.set('category', category);
  const sort = firstString(searchParams.sort) ?? 'price_asc';
  params.set(
    'sort',
    sort === 'price_asc' || sort === 'price_desc' || sort === 'newest'
      ? sort
      : 'price_asc',
  );
  params.set('page', firstString(searchParams.page) ?? '1');
  params.set('pageSize', firstString(searchParams.pageSize) ?? '20');

  for (const [key, raw] of Object.entries(searchParams)) {
    if (CONTROL_KEYS.has(key) || key === 'category') continue;
    const value = firstString(raw);
    if (value !== undefined && value !== '') params.set(key, value);
  }

  return params.toString();
}

export function firstString(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

export function parseSort(value: string | undefined): ProductSort {
  if (value === 'price_desc' || value === 'newest' || value === 'price_asc') {
    return value;
  }
  return 'price_asc';
}

export function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 ? number : fallback;
}

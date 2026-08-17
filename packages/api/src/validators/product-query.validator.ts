import {
  CATEGORY_REGISTRY,
  type CategorySlug,
  type FilterDefinition,
} from '@hardware-scrapping/shared-types';
import { ApiError, ErrorCodes } from '../errors/api-error.js';

export type ProductSort = 'price_asc' | 'price_desc' | 'newest';

export interface NormalizedEnumFilter {
  kind: 'enum';
  key: string;
  values: Array<string | number | boolean>;
}

export interface NormalizedRangeFilter {
  kind: 'range';
  key: string;
  min?: number;
  max?: number;
}

export type NormalizedSpecFilter = NormalizedEnumFilter | NormalizedRangeFilter;

export interface ValidatedProductQuery {
  category: CategorySlug;
  filters: NormalizedSpecFilter[];
  sort: ProductSort;
  page: number;
  pageSize: number;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function asStringList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => asStringList(item));
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
  return [];
}

function fail(message: string): never {
  throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, message);
}

function isCategorySlug(value: string): value is CategorySlug {
  return Object.prototype.hasOwnProperty.call(CATEGORY_REGISTRY, value);
}

function isBooleanFilter(filter: FilterDefinition): boolean {
  return (
    filter.key === 'is_kit' ||
    (filter.options?.length === 2 &&
      filter.options.includes('true') &&
      filter.options.includes('false'))
  );
}

function parseFilterValue(value: string, filter: FilterDefinition): string | number | boolean {
  if (isBooleanFilter(filter)) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    fail(`Invalid boolean value '${value}' for filter '${filter.key}'`);
  }

  if (filter.key.endsWith('_gb') || filter.type === 'number') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      fail(`Invalid numeric value '${value}' for filter '${filter.key}'`);
    }
    return parsed;
  }

  return value;
}

function parsePositiveInteger(value: unknown, name: string, defaultValue: number): number {
  const raw = value === undefined ? String(defaultValue) : asString(value);
  if (raw === undefined || !/^\d+$/.test(raw)) {
    fail(`${name} must be a positive integer`);
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    fail(`${name} must be a positive integer`);
  }
  return parsed;
}

export function validateProductQuery(
  query: Record<string, unknown>,
): ValidatedProductQuery {
  const rawCategory = asString(query.category);
  if (!rawCategory || !isCategorySlug(rawCategory)) {
    fail('category is required and must be a supported category');
  }

  const schema = CATEGORY_REGISTRY[rawCategory];
  const filtersByKey = new Map(schema.filters.map((filter) => [filter.key, filter]));
  const allowedKeys = new Set(['category', 'sort', 'page', 'pageSize']);

  for (const filter of schema.filters) {
    allowedKeys.add(filter.key);
    if (filter.type === 'range') {
      allowedKeys.add(`${filter.key}_min`);
      allowedKeys.add(`${filter.key}_max`);
    }
  }

  const unknownKey = Object.keys(query).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    fail(`Unknown query parameter '${unknownKey}'`);
  }

  const sort = asString(query.sort) ?? 'price_asc';
  if (sort !== 'price_asc' && sort !== 'price_desc' && sort !== 'newest') {
    fail(`Invalid sort '${sort}'`);
  }

  const page = parsePositiveInteger(query.page, 'page', 1);
  const pageSize = parsePositiveInteger(query.pageSize, 'pageSize', 20);
  if (pageSize > 100) {
    fail('pageSize must be between 1 and 100');
  }

  const normalizedFilters: NormalizedSpecFilter[] = [];

  for (const filter of schema.filters) {
    if (filter.type === 'range') {
      const minKey = `${filter.key}_min`;
      const maxKey = `${filter.key}_max`;
      const rawMin = query[minKey] === undefined ? undefined : asString(query[minKey]);
      const rawMax = query[maxKey] === undefined ? undefined : asString(query[maxKey]);

      if (query[minKey] !== undefined && rawMin === undefined) {
        fail(`${minKey} must be numeric`);
      }
      if (query[maxKey] !== undefined && rawMax === undefined) {
        fail(`${maxKey} must be numeric`);
      }

      const min = rawMin === undefined ? undefined : Number(rawMin);
      const max = rawMax === undefined ? undefined : Number(rawMax);
      if (min !== undefined && !Number.isFinite(min)) fail(`${minKey} must be numeric`);
      if (max !== undefined && !Number.isFinite(max)) fail(`${maxKey} must be numeric`);
      if (min !== undefined && max !== undefined && min > max) {
        fail(`${minKey} cannot be greater than ${maxKey}`);
      }
      if (min !== undefined || max !== undefined) {
        normalizedFilters.push({ kind: 'range', key: filter.key, min, max });
      }
      continue;
    }

    if (query[filter.key] === undefined) continue;
    const values = asStringList(query[filter.key]);
    if (values.length === 0) {
      fail(`Filter '${filter.key}' must contain at least one value`);
    }

    normalizedFilters.push({
      kind: 'enum',
      key: filter.key,
      values: values.map((value) => parseFilterValue(value, filtersByKey.get(filter.key)!)),
    });
  }

  return {
    category: rawCategory,
    filters: normalizedFilters,
    sort,
    page,
    pageSize,
  };
}

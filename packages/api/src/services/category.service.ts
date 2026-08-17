import { prisma } from '@hardware-scrapping/database';
import {
  CATEGORY_REGISTRY,
  type CategorySlug,
  type FilterDefinition,
} from '@hardware-scrapping/shared-types';
import { ApiError, ErrorCodes } from '../errors/api-error.js';

function isCategorySlug(value: string): value is CategorySlug {
  return Object.prototype.hasOwnProperty.call(CATEGORY_REGISTRY, value);
}

export function listCategories() {
  return {
    categories: Object.values(CATEGORY_REGISTRY).map((schema) => ({
      slug: schema.slug,
      displayName: schema.displayName,
    })),
  };
}

async function loadDistinctSpecValues(category: CategorySlug, key: string): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { category },
    select: { specs: true },
  });
  const values = new Set<string>();

  for (const product of products) {
    const specs = product.specs as Record<string, unknown>;
    const value = specs[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      values.add(String(value));
    }
  }

  const result = [...values];
  if (result.every((value) => value !== '' && Number.isFinite(Number(value)))) {
    return result.sort((a, b) => Number(a) - Number(b));
  }
  if (result.every((value) => value === 'true' || value === 'false')) {
    return ['true', 'false'].filter((value) => values.has(value));
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function mergeOptions(schemaOptions: string[], dbValues: string[]): string[] {
  const values = [...new Set([...schemaOptions, ...dbValues])];
  if (values.every((value) => value !== '' && Number.isFinite(Number(value)))) {
    return values.sort((a, b) => Number(a) - Number(b));
  }
  if (values.every((value) => value === 'true' || value === 'false')) {
    const valueSet = new Set<string>(values);
    return ['true', 'false'].filter((value) => valueSet.has(value));
  }
  return values.sort((a, b) => a.localeCompare(b));
}

export async function getCategoryFilters(slug: string) {
  if (!isCategorySlug(slug)) {
    throw new ApiError(404, ErrorCodes.CATEGORY_NOT_FOUND, `Category '${slug}' not found`);
  }

  const schema = CATEGORY_REGISTRY[slug];
  const filters: FilterDefinition[] = await Promise.all(
    schema.filters.map(async (filter) => {
      if (filter.type !== 'enum') return { ...filter };
      const dbValues = await loadDistinctSpecValues(schema.slug, filter.key);
      return {
        ...filter,
        options: mergeOptions(filter.options ?? [], dbValues),
      };
    }),
  );

  return {
    slug: schema.slug,
    displayName: schema.displayName,
    filters,
  };
}

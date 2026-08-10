import type { CategorySlug } from '@hardware-scrapping/shared-types';
import { extractRamSpecs } from './ram.js';
import type { SpecsExtractor } from './types.js';

export const EXTRACTORS: Record<CategorySlug, SpecsExtractor> = {
  ram: (name) => extractRamSpecs(name) as unknown as Record<string, unknown>,
};

export function getExtractor(slug: CategorySlug): SpecsExtractor {
  return EXTRACTORS[slug];
}

export { extractRamSpecs } from './ram.js';

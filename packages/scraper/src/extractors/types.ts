import type { CategorySlug, RamSpecs } from '@hardware-scrapping/shared-types';

export type SpecsExtractor = (productName: string) => Record<string, unknown>;

export type ExtractorRegistry = Partial<Record<CategorySlug, SpecsExtractor>>;

export type { RamSpecs };

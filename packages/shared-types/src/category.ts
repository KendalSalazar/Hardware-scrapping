/**
 * CategorySlug: unión de string literales.
 * Para agregar una categoría nueva (ej. 'gpu'):
 * 1. Sumar | 'gpu' a este tipo
 * 2. Crear GPU_SCHEMA
 * 3. Registrar en CATEGORY_REGISTRY
 * No hace falta tocar código de consumidores que iteran el registry.
 */
export type CategorySlug = 'ram';

export type FilterType = 'number' | 'enum' | 'range';

export interface FilterDefinition {
  key: string;
  label: string;
  type: FilterType;
  options?: string[];
  min?: number;
  max?: number;
}

export interface CategorySchema {
  slug: CategorySlug;
  displayName: string;
  filters: FilterDefinition[];
}

export const RAM_SCHEMA: CategorySchema = {
  slug: 'ram',
  displayName: 'Memoria RAM',
  filters: [
    {
      key: 'capacity_gb',
      label: 'Capacidad',
      type: 'enum',
      options: ['8', '16', '32', '64'],
    },
    {
      key: 'ram_type',
      label: 'Tipo',
      type: 'enum',
      options: ['DDR4', 'DDR5'],
    },
    {
      key: 'speed_mhz',
      label: 'Velocidad (MHz)',
      type: 'range',
    },
    {
      key: 'is_kit',
      label: 'Kit (2x)',
      type: 'enum',
      options: ['true', 'false'],
    },
  ],
};

export const CATEGORY_REGISTRY: Record<CategorySlug, CategorySchema> = {
  ram: RAM_SCHEMA,
};

export function getCategorySchema(slug: CategorySlug): CategorySchema {
  return CATEGORY_REGISTRY[slug];
}

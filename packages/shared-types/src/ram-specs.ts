/**
 * Forma del JSON guardado en Product.specs para category === 'ram'.
 * capacity_gb representa la capacidad total del producto.
 * Por ejemplo, "2x8GB" equivale a 16 GB.
 */
export interface RamSpecs {
  capacity_gb: number | null;
  ram_type: 'DDR4' | 'DDR5' | string | null;
  speed_mhz: number | null;
  is_kit: boolean;
}

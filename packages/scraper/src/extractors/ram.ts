import type { RamSpecs } from '@hardware-scrapping/shared-types';

/**
 * Extrae specs de RAM desde el nombre comercial del producto.
 *
 * Patrones usados:
 * - Kit con capacidad total: /(\d+)\s*GB\s*\(\s*(\d+)\s*[x×]\s*(\d+)\s*GB\s*\)/i
 * - Kit NxM: /(\d+)\s*[x×]\s*(\d+)\s*GB/i
 * - Capacidad simple: /(\d+)\s*GB\b/i
 * - Tipo: /DDR\s*([45])/i
 * - Velocidad: se quitan solo tokens DDR4/DDR5 antes de buscar MHz o MT/s
 *
 * La capacidad de un kit es siempre la capacidad total. Por ejemplo,
 * "2x8GB" produce capacity_gb = 16 e is_kit = true.
  */
export function extractRamSpecs(productName: string): RamSpecs {
  const kitWithTotal = productName.match(
    /(\d+)\s*GB\s*\(\s*(\d+)\s*[x×]\s*(\d+)\s*GB\s*\)/i,
  );
  const kit = productName.match(/(\d+)\s*[x×]\s*(\d+)\s*GB/i);
  const simpleCapacity = productName.match(/(\d+)\s*GB\b/i);
  const ramTypeMatch = productName.match(/DDR\s*([45])/i);
  const speedSource = productName.replace(/DDR\s*[45]/gi, '');
  const speedMatch = speedSource.match(/(?<!\d)(\d{3,5})\s*(mhz|mt\/s)/i);

  let capacityGb: number | null = null;
  let isKit = false;

  if (kitWithTotal) {
    capacityGb = Number(kitWithTotal[1]);
    isKit = true;
  } else if (kit) {
    const modules = Number(kit[1]);
    const capacityPerModule = Number(kit[2]);
    if (modules > 0 && capacityPerModule > 0) {
      capacityGb = modules * capacityPerModule;
      isKit = true;
    }
  } else if (simpleCapacity) {
    capacityGb = Number(simpleCapacity[1]);
  }

  const ramType = ramTypeMatch ? `DDR${ramTypeMatch[1]}` : null;
  const speedMhz = speedMatch ? Number(speedMatch[1]) : null;

  return {
    capacity_gb: capacityGb,
    ram_type: ramType,
    speed_mhz: speedMhz,
    is_kit: isKit,
  };
}

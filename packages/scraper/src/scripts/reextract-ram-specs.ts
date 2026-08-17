import '../load-env.js';
import { prisma } from '@hardware-scrapping/database';
import { extractRamSpecs } from '../extractors/ram.js';
import { logger } from '../logger.js';

interface RamProductChange {
  id: number;
  canonicalName: string;
  oldSpecs: unknown;
  newSpecs: ReturnType<typeof extractRamSpecs>;
}

function comparableSpecs(specs: unknown): string {
  const value = specs as Record<string, unknown>;
  return JSON.stringify({
    capacity_gb: value.capacity_gb ?? null,
    ram_type: value.ram_type ?? null,
    speed_mhz: value.speed_mhz ?? null,
    is_kit: value.is_kit ?? false,
  });
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const products = await prisma.product.findMany({
    where: { category: 'ram' },
    orderBy: { id: 'asc' },
  });
  const changes: RamProductChange[] = [];

  for (const product of products) {
    // Deliberately use canonicalName unchanged. It is the stored product name
    // from which Fase 1 originally derived the RAM specs.
    const newSpecs = extractRamSpecs(product.canonicalName);
    if (comparableSpecs(product.specs) !== comparableSpecs(newSpecs)) {
      changes.push({
        id: product.id,
        canonicalName: product.canonicalName,
        oldSpecs: product.specs,
        newSpecs,
      });
    }
  }

  logger.info(
    `${apply ? 'Aplicando' : 'Preview'} de re-extracción RAM: ${changes.length} producto(s) cambiarían`,
  );
  for (const change of changes) {
    logger.info(
      `Producto ${change.id} | ${change.canonicalName} | viejo=${JSON.stringify(change.oldSpecs)} | nuevo=${JSON.stringify(change.newSpecs)}`,
    );
  }

  if (apply) {
    await prisma.$transaction(
      changes.map((change) =>
        prisma.product.update({
          where: { id: change.id },
          data: { specs: { ...change.newSpecs } },
        }),
      ),
    );
    logger.info(`Re-extracción RAM completada: ${changes.length} producto(s) actualizado(s)`);
  } else {
    logger.info('Preview únicamente: no se modificó la base de datos');
  }
}

main()
  .catch((error) => {
    logger.error('Error en re-extracción de specs RAM', { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

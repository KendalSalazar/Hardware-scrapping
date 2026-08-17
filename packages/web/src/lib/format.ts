const crcFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  maximumFractionDigits: 0,
});

/** Formatea enteros CRC. Ejemplo: 33000 -> "₡33,000" según el runtime. */
export function formatCrc(amount: number): string {
  return crcFormatter.format(amount);
}

const dateTimeFormatter = new Intl.DateTimeFormat('es-CR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return dateTimeFormatter.format(date);
}

export function formatFilterOptionLabel(filterKey: string, option: string): string {
  if (filterKey === 'is_kit' || option === 'true' || option === 'false') {
    if (option === 'true') return 'Sí';
    if (option === 'false') return 'No';
  }
  if (filterKey === 'capacity_gb') return `${option} GB`;
  return option;
}

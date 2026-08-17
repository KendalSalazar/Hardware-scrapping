/** Acepta Decimal-like (tiene toNumber), number o string. */
export function toCrcNumber(
  value: { toNumber: () => number } | number | string,
): number {
  if (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof value.toNumber === 'function'
  ) {
    return Math.round(value.toNumber());
  }

  if (typeof value === 'number') {
    return Math.round(value);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Precio no numérico: ${String(value)}`);
  }

  return Math.round(parsed);
}

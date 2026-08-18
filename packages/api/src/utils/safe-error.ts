const OMITTED_ERROR_PROPERTIES = new Set([
  'body',
  'rawBody',
  'request',
  'req',
]);

/**
 * Convierte un error a datos seguros para logging.
 * body-parser agrega el body crudo como `error.body` en errores de parseo;
 * nunca debe serializarse porque puede contener credenciales.
 */
export function safeErrorDetails(error: unknown): Record<string, unknown> {
  if (error === null || typeof error !== 'object') {
    return { value: error };
  }

  const details: Record<string, unknown> = {};
  for (const property of Object.getOwnPropertyNames(error)) {
    if (OMITTED_ERROR_PROPERTIES.has(property)) {
      continue;
    }

    const value = (error as Record<string, unknown>)[property];
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      details[property] = value;
    }
  }

  return details;
}

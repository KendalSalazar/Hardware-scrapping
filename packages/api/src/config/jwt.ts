import { logger } from '../logger.js';

/** Literal exacto del placeholder definido en .env.example de Fase 0. */
export const JWT_SECRET_PLACEHOLDER = 'change-me-to-a-long-random-string';

export const JWT_EXPIRES_IN = '8h';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('JWT_SECRET is missing. Set it in the monorepo root .env file.');
  }
  return secret;
}

/**
 * Valida el secret al arrancar sin exponer su valor en logs.
 * En production, el valor ausente o el placeholder exacto bloquean el boot.
 */
export function assertJwtSecret(): void {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret || secret.trim() === '') {
    const message = 'JWT_SECRET is missing from environment';
    if (isProd) {
      throw new Error(message);
    }
    logger.warn(message);
    return;
  }

  if (secret === JWT_SECRET_PLACEHOLDER) {
    const message =
      'JWT_SECRET still has the Fase 0 placeholder value. Generate a strong secret before any real use.';
    if (isProd) {
      throw new Error(message);
    }
    logger.warn(message);
  }
}

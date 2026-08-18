import type { ErrorRequestHandler } from 'express';
import { logger } from '../logger.js';
import { safeErrorDetails } from '../utils/safe-error.js';
import { ErrorCodes, isApiError } from './api-error.js';

/**
 * Middleware de error de Express (firma de 4 argumentos obligatoria).
 *
 * Política de logging:
 * - 4xx (errores de cliente): nivel warn, sin stack
 * - 5xx (errores de servidor): nivel error, con stack
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isApiError(err)) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, stack: err.stack });
    } else {
      logger.warn(err.message, { code: err.code, statusCode: err.statusCode });
    }

    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected server error';
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(message, {
    code: ErrorCodes.INTERNAL_ERROR,
    stack,
    error: safeErrorDetails(err),
  });

  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: ErrorCodes.INTERNAL_ERROR,
    },
  });
};

import type { NextFunction, Request, Response } from 'express';
import { ApiError, ErrorCodes } from '../errors/api-error.js';

/** Debe ejecutarse después de requireAuth en la cadena de middlewares. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required'));
    return;
  }

  if (req.user.role !== 'admin') {
    next(new ApiError(403, ErrorCodes.FORBIDDEN, 'Admin role required'));
    return;
  }

  next();
}

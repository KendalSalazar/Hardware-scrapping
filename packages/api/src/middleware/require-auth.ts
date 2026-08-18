import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';
import { ApiError, ErrorCodes } from '../errors/api-error.js';
import type { JwtPayload } from '../types/auth.js';

function extractBearerToken(header: string | undefined): string {
  if (!header) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Missing Authorization header');
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(
      401,
      ErrorCodes.UNAUTHORIZED,
      'Authorization header must be: Bearer <token>',
    );
  }

  return token;
}

/** Verifica firma y expiración del JWT antes de adjuntar req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req.header('authorization'));
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded === 'string' || decoded === null) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid token');
    }

    const userId = typeof decoded.sub === 'string' ? Number(decoded.sub) : decoded.sub;
    if (
      typeof userId !== 'number' ||
      !Number.isInteger(userId) ||
      userId < 1 ||
      typeof decoded.email !== 'string' ||
      typeof decoded.role !== 'string'
    ) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid token payload');
    }

    const payload: JwtPayload = {
      sub: userId,
      email: decoded.email,
      role: decoded.role,
    };
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }

    next(new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid or expired token'));
  }
}

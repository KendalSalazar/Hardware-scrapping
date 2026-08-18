import type { JwtPayload } from './auth';

declare global {
  namespace Express {
    interface Request {
      /** Presente solo después de pasar por requireAuth. */
      user?: JwtPayload;
    }
  }
}

export {};

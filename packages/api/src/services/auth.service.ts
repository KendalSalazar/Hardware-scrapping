import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@hardware-scrapping/database';
import { getJwtSecret, JWT_EXPIRES_IN } from '../config/jwt.js';
import { ApiError, ErrorCodes } from '../errors/api-error.js';
import { logger } from '../logger.js';
import type { JwtPayload } from '../types/auth.js';

const BCRYPT_ROUNDS = 12;

export interface LoginResult {
  token: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
}

/** Compara la password y firma un token sin revelar datos sensibles en logs. */
export async function login(email: string, password: string): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    logger.warn('Login failed', { email: normalizedEmail, reason: 'user_not_found' });
    throw new ApiError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials');
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    logger.warn('Login failed', { email: normalizedEmail, reason: 'bad_password' });
    throw new ApiError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials');
  }

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });

  logger.info('Login success', { email: user.email, userId: user.id, role: user.role });

  return {
    token,
    tokenType: 'Bearer',
    expiresIn: JWT_EXPIRES_IN,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}

/** Usado por el script create-admin para guardar solo el hash en la base. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

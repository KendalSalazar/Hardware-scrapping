import { ApiError, ErrorCodes } from '../errors/api-error.js';

export interface LoginBody {
  email: string;
  password: string;
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `${field} is required`);
  }
  return value;
}

/** Valida el body mínimo de login sin usar una regex restrictiva para emails. */
export function validateLoginBody(body: unknown): LoginBody {
  if (body === null || typeof body !== 'object') {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'JSON body is required');
  }

  const record = body as Record<string, unknown>;
  const email = asNonEmptyString(record.email, 'email').trim();
  const password = asNonEmptyString(record.password, 'password');

  if (password.length < 8) {
    throw new ApiError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      'password must be at least 8 characters',
    );
  }

  return { email, password };
}

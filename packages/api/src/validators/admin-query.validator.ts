import { ApiError, ErrorCodes } from '../errors/api-error.js';
import type { ListScrapeRunsQuery } from '../services/admin.service.js';

const ALLOWED_STATUS = new Set(['running', 'success', 'partial', 'failed']);

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function parsePositiveInt(value: unknown, name: string, fallback: number): number {
  const raw = value === undefined ? String(fallback) : asString(value);
  if (raw === undefined || !/^\d+$/.test(raw)) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `${name} must be a positive integer`);
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `${name} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalDate(value: unknown, name: string): Date | undefined {
  const raw = asString(value);
  if (raw === undefined || raw === '') return undefined;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      `${name} must be a valid ISO-8601 date`,
    );
  }
  return date;
}

export function validateScrapeRunsQuery(
  query: Record<string, unknown>,
): ListScrapeRunsQuery {
  const allowed = new Set(['page', 'pageSize', 'status', 'from', 'to']);
  const unknown = Object.keys(query).find((key) => !allowed.has(key));
  if (unknown) {
    throw new ApiError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      `Unknown query parameter '${unknown}'`,
    );
  }

  const page = parsePositiveInt(query.page, 'page', 1);
  const pageSize = parsePositiveInt(query.pageSize, 'pageSize', 20);
  if (pageSize > 100) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'pageSize must be between 1 and 100');
  }

  const statusRaw = asString(query.status);
  let status: string | undefined;
  if (statusRaw !== undefined && statusRaw !== '') {
    if (!ALLOWED_STATUS.has(statusRaw)) {
      throw new ApiError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        `status must be one of: ${[...ALLOWED_STATUS].join(', ')}`,
      );
    }
    status = statusRaw;
  }

  const from = parseOptionalDate(query.from, 'from');
  const to = parseOptionalDate(query.to, 'to');
  if (from && to && from.getTime() > to.getTime()) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'from cannot be greater than to');
  }

  return { page, pageSize, status, from, to };
}

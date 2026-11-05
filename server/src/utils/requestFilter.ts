import { AppError } from '../middleware/errorHandler';

/**
 * Standard Prisma filter ensuring soft-deleted requests are excluded from active queries.
 */
export const ACTIVE_REQUEST_FILTER = {
  deletedAt: null,
} as const;

/**
 * Asserts that a request exists and has not been soft-deleted.
 * Throws AppError('Request not found.', 404) if the request is missing or soft-deleted.
 * This guarantees a consistent 404 response across all access paths without exposing deleted information.
 */
export function assertActiveRequest<T extends { id: string; deletedAt?: Date | null }>(
  request: T | null | undefined
): asserts request is T & { deletedAt: null } {
  if (!request || request.deletedAt != null) {
    throw new AppError('Request not found.', 404);
  }
}

